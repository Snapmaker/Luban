/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import fs from 'fs';
import path from 'path';

import logger from '../../../lib/logger';
import config from '../../configstore';
import { mcpBroadcast } from '../index';
import { connectionManager } from '../../machine/ConnectionManager';
import {
    CapturedFrame,
    cameraSelection,
    captureFrame,
    captureFromDevice,
    clearCameraSelection,
    getCachedFrame,
    getCapturedFrame,
    getCachedFrameDevice,
    getCachedFrameIds,
    listCameraCandidates,
    listCameras,
    selectCamera,
} from '../camera';
import { CameraCandidate, matchCameraDevice, selectionInvalidatesModel } from '../cameraSelection';
import { cameraModelStore } from '../cameraModelStore';
import { cameraStreamService } from '../cameraStream';
import { recordGcodeTiming } from '../diagnostics';
import { jobManager } from '../jobs';
import { bumpGcodeSequence, noteDirectGcodeEnd, noteDirectGcodeStart, noteFrameRestored } from '../positionOfRecord';
import { decodeToGray, trackFeature } from '../tracking';
import { McpToolError, ToolRegistry } from '../registry';
import { gateDirectXy, planGotoWorkOrigin } from '../directMovePlan';
import { clearanceOptions } from '../clearanceContext';
import { WORK_FRAME_RESTORE_GCODE } from '../frameRecovery';
import { landmarkStore } from '../landmarks';
import { routeClearanceForPath } from '../routeClearance';
import { probeFeedService } from '../probeFeed';
import { cameraArtifactPath, cameraImageMime, readCameraSnapshot } from '../cameraArtifacts';
import DataStorage from '../../../DataStorage';
import {
    assertFreshHeartbeat,
    PositionSnapshot,
    assertWithinTravel,
    getPositionSnapshot,
    motionFloorZ,
    requirePlanningTravel,
    safeTraverseZ,
} from './machine';
import { validateStagedEnvelope } from './staging';
import { reliableForMotion } from '../machinePosition';
import { DIRECT_MOVE_FEED, TRACK_PATCH_PX, TRACK_SEARCH_RADIUS_PX, TRAVEL_FEED, TRAVERSE_FEED, clampCount, clampTo } from '../procedureLimits';

// Motion policy (#23, refined): the direct move path is for the odd single
// action only. move_and_capture performs ONE bounded XY move at the current
// Z - there is deliberately no Z parameter; Z changes and any compound
// motion go through submit_gcode_job so the controller's job state machine
// and door interlock stay in charge.

const DEFAULT_MAX_TRAVEL_MM = 100;
const DEFAULT_FEED_RATE = DIRECT_MOVE_FEED.default;
const SETTLE_TOLERANCE_MM = 0.1;
const SETTLE_TIMEOUT_MS = 30000;
const SETTLE_POLL_MS = 250;
const POST_SETTLE_DWELL_MS = 300;
const HOME_TIMEOUT_MS = 120000;
// Two status periods: the judgement needs a beat taken after the workspace change.
const FRAME_RESTORE_SETTLE_MS = 4500;
const HOME_POLL_MS = 1000;

export interface GcodeChannel {
    executeGcode?: (gcode: string) => Promise<{ result: number; text?: string }>;
}

const gcodeLog = logger('service:mcp:gcode');
const cameraLog = logger('service:mcp:camera');

/**
 * Send gcode on the direct path AND mirror exactly what was sent (plus the
 * controller's reply) to the UI console AND the server log - the console
 * broadcast is invisible to anyone reading the process log, and a headless
 * session debugging "controller said ok but nothing moved" needs the reply.
 */
// Direct-gcode sequence: every command through this gate bumps it, so the
// motion engine can tell whether its position of record is still current
// (positionOfRecord.ts). The timing stamps feed diagnostics.ts: idle time
// between the controller's previous reply and the next send is engine +
// sensor window only, so a long one inside a job means late timers.
let lastReplyAt: number | null = null;
const SLOW_IDLE_MS = 750;
const SLOW_IDLE_IGNORE_MS = 15000; // beyond this it is a human/agent pause, not pacing

export { currentGcodeSequence } from '../positionOfRecord';

export interface SentGcode {
    result: number;
    text?: string;
    /** Value of currentGcodeSequence() for this command. */
    sequence: number;
    /** Send -> controller reply. */
    execMs: number;
}

/**
 * Optional timing the motion engine attaches to a send so an idle gap can be
 * attributed: enteredAt = when the engine was entered for this move;
 * lastSense = the sensor wait that preceded it (probing.ts lastSense).
 */
export interface SendTiming {
    enteredAt?: number;
    lastSense?: { kind: string; windowMs: number; elapsedMs: number; endedAt: number; contact: boolean } | null;
    /** probing.ts step trace: "label+ms" marks since the previous reply. */
    trace?: string;
}

export async function sendGcodeVisible(channel: GcodeChannel, tool: string, gcode: string, timing?: SendTiming): Promise<SentGcode> {
    const sequence = bumpGcodeSequence();
    const sentAt = Date.now();
    const idleMs = lastReplyAt === null ? null : sentAt - lastReplyAt;
    // Breakdown of the idle gap (previous reply -> this send):
    //   replyToSenseEndMs: previous reply -> end of the runner's sensor wait
    //   senseMs / senseWindowMs: that wait's actual vs requested length
    //   senseEndToEngineMs: sensor wait end -> engine entry (runner logic)
    //   engineMs: engine entry -> send (overtravel check, snapshot, record)
    const breakdown: { [key: string]: number | string | boolean } = {};
    if (timing && timing.enteredAt) {
        breakdown.engineMs = sentAt - timing.enteredAt;
        const sense = timing.lastSense;
        if (sense && lastReplyAt !== null && sense.endedAt >= lastReplyAt) {
            breakdown.replyToSenseEndMs = sense.endedAt - lastReplyAt;
            breakdown.senseMs = sense.elapsedMs;
            breakdown.senseWindowMs = sense.windowMs;
            breakdown.senseKind = sense.kind;
            breakdown.senseEndToEngineMs = timing.enteredAt - sense.endedAt;
        }
        if (timing.trace) {
            breakdown.trace = timing.trace;
        }
    }
    mcpBroadcast('mcp:gcode', { tool, gcode, idleMs, ...breakdown });
    const breakdownText = Object.keys(breakdown).length
        ? ` [${Object.keys(breakdown).map((key) => `${key}=${breakdown[key]}`).join(' ')}]`
        : '';
    gcodeLog.info(`[${tool}] > ${gcode.replace(/\r?\n/g, ' | ')}${idleMs === null ? '' : ` (idle ${idleMs}ms)`}${breakdownText}`);
    const slowIdle = idleMs !== null && idleMs > SLOW_IDLE_MS && idleMs < SLOW_IDLE_IGNORE_MS && jobManager.getActive() !== null;
    if (slowIdle) {
        mcpBroadcast('mcp:activity', {
            tool: 'diagnostics',
            phase: 'slow_step',
            ms: idleMs,
            note: `${tool}: ${idleMs} ms from the controller's previous reply to this send (engine + sensor window only - `
                + 'compare event_loop_stall / sense_overrun events around it)',
        });
    }
    // Crash-guard bracket: the HTTP channel executes synchronously, so the
    // await spans the motion window - a contact-sensor trigger inside it
    // that no procedure expects is treated as a collision (probeFeed).
    if (typeof channel.executeGcode !== 'function') {
        throw new McpToolError('The connected channel does not support direct moves.');
    }
    probeFeedService.motionBegin();
    noteDirectGcodeStart();
    let executed;
    try {
        executed = await channel.executeGcode(gcode);
    } finally {
        probeFeedService.motionEnd();
        noteDirectGcodeEnd();
    }
    const execMs = Date.now() - sentAt;
    lastReplyAt = Date.now();
    const response = executed.text || (executed.result === 0 ? 'ok' : `result=${executed.result}`);
    mcpBroadcast('mcp:gcode', { tool, response, execMs });
    gcodeLog.info(`[${tool}] < ${String(response).replace(/\r?\n/g, ' | ')} (exec ${execMs}ms)`);
    recordGcodeTiming(tool, execMs, idleMs, slowIdle);
    return { ...executed, sequence, execMs };
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * The camera-to-spindle offset is fixed hardware geometry, so where the
 * endmill images is a constant of the rig, not something to re-discover by
 * vision each frame. The operator records it once in configstore
 * mcpToolRegion (fractional box {u0,v0,u1,v1}, optional note) and every
 * frame carries it - turning tool identification into a lookup.
 */
function expectedToolRegion(): object | null {
    const raw = config.get('mcpToolRegion');
    if (!raw) {
        return null;
    }
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : (raw as object);
    } catch (err) {
        return null;
    }
}

function positionOrNull(): PositionSnapshot | null {
    try {
        return getPositionSnapshot();
    } catch (err) {
        return null;
    }
}

/**
 * Landmarks near the current machine XY (#50): identities the operator has
 * stated once, surfaced on every capture so they are never re-guessed.
 */
function nearbyLandmarks(): object[] {
    const position = positionOrNull();
    const x = position?.machine.x;
    const y = position?.machine.y;
    if (x === null || x === undefined || y === null || y === undefined) {
        return [];
    }
    return landmarkStore.near(x, y, 120);
}

function frameContent(frame: CapturedFrame, meta: object): object {
    return {
        mcpContent: [
            { type: 'image', data: frame.imageBase64, mimeType: frame.mimeType },
            {
                type: 'text',
                text: JSON.stringify({
                    ...meta,
                    camera: {
                        frameId: frame.frameId,
                        file: frame.file,
                        provider: frame.provider,
                        device: frame.device,
                        capturedAt: frame.capturedAt,
                        // 'stream' = served by the live MJPEG loop an operator is
                        // watching (/camera); 'one-shot' = this call opened the device.
                        source: frame.source,
                        stream_url: cameraStreamService.isEnabled() ? cameraStreamService.urls().page : null,
                        expectedToolRegion: expectedToolRegion(),
                        nearbyLandmarks: nearbyLandmarks(),
                    },
                }),
            },
        ],
    };
}

function assertSafeToMove(position: PositionSnapshot, operatorConfirmedClearance: boolean): void {
    probeFeedService.assertNoOvertravel();
    assertFreshHeartbeat('a direct move');
    if (position.machineStatus !== 'idle') {
        throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
    }
    const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
    const headPower = Number(state?.headPower);
    if ((Number.isFinite(headPower) && headPower > 0) || state?.headStatus === true || state?.headStatus === 'on') {
        throw new McpToolError('Toolhead appears to be on (headStatus/headPower); refusing to move.');
    }
    // Homing raises Z first and is the only cure for a stale position state
    // after a reconnect, so it is the default precondition. The override is
    // for when the OPERATOR has confirmed the Z height and a clear path at
    // this Z - never pass it on the model's own judgment.
    if (position.isHomed !== true && !operatorConfirmedClearance) {
        throw new McpToolError('Machine does not report homed. Call the home tool first (Z raises before '
            + 'XY), or - only after the operator has explicitly confirmed the current Z and an '
            + 'obstacle-free path at this Z - retry with operator_confirmed_clearance: true.');
    }
}


export interface BoundedMoveArgs {
    x?: number;
    y?: number;
    coordinate_system?: string;
    feed_rate?: number;
    // Why this move is happening - required, shown in the console/log, so a
    // motion whose real goal is transport rather than vision is visible.
    reason?: string;
    operator_confirmed_clearance?: boolean;
    wait_until_moved?: boolean;
    capture?: boolean;
}

/**
 * Wait for a post-command heartbeat that satisfies `matches`, twice in a row,
 * so a returned position is what the firmware says rather than what was
 * commanded (#11). null when it does not happen within SETTLE_TIMEOUT_MS.
 */
async function settleUntil(issuedAt: number, matches: (now: PositionSnapshot) => boolean): Promise<PositionSnapshot | null> {
    let stableReports = 0;
    let lastTimestamp = 0;
    const deadline = issuedAt + SETTLE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(SETTLE_POLL_MS);
        const now = getPositionSnapshot();
        const reportTime = Date.now() - now.reportAgeMs;
        if (reportTime <= issuedAt || reportTime === lastTimestamp) {
            continue; // not a fresh post-command report
        }
        lastTimestamp = reportTime;
        if (matches(now)) {
            stableReports += 1;
            if (stableReports >= 2) {
                return now;
            }
        } else {
            stableReports = 0;
        }
    }
    return null;
}

/**
 * The Z gate's raise (operator ruling 2026-09-21, "move_and_capture should be
 * z gated first"): a Z-only machine-frame move to the traverse height - the
 * one move that cannot descend (law 8) - awaited until the heartbeat reports
 * it twice. Throws if the controller refuses it or it does not settle; the
 * XY is never sent on an unproven Z.
 */
async function raiseBeforeXy(channel: GcodeChannel, fromZ: number, toZ: number, reason: string): Promise<{ from: number; to: number }> {
    const gcode = ['G90', 'G53;', `G1 Z${toZ.toFixed(3)} F${TRAVEL_FEED};`, 'G54;'].join('\n');
    const issuedAt = Date.now();
    const executed = await sendGcodeVisible(channel, `raise before xy - ${reason.slice(0, 50)}`, gcode);
    if (executed.result !== 0) {
        throw new McpToolError(`Raise to the traverse height rejected by controller: ${executed.text || executed.result}. The XY move was NOT sent.`);
    }
    const settled = await settleUntil(issuedAt, (now) => now.machine.z !== null && Math.abs(now.machine.z - toZ) <= SETTLE_TOLERANCE_MM);
    if (!settled) {
        const last = positionOrNull();
        throw new McpToolError(`Raise from machine Z ${fromZ.toFixed(3)} to Z ${toZ.toFixed(3)} did not settle within ${SETTLE_TIMEOUT_MS / 1000}s; `
            + `the XY move was NOT sent. Last reported machine position: ${JSON.stringify(last && last.machine)}`);
    }
    return { from: fromZ, to: toZ };
}

// Pacing guard (2026-09-01, interface-respect): direct XY moves are single
// supervised actions, not a scripting primitive. Rapid sequences belong in
// the staged, operator-approved mechanisms (survey_bed, batch move_z,
// procedures). Timestamps of recent SENT direct moves:
const recentDirectMoves: number[] = [];
const PACING_WINDOW_MS = 15000;
const PACING_REFUSE_AT = 4; // the 4th move inside the window is refused

/** One obstacle, with the toolhead Z it demands and where that number came from. */
function describeObstacleRequirement(l: { name: string; clearanceZ: number | null; clearanceBasis: string; requiredZ: number | null }): string {
    if (l.requiredZ === null) {
        return `"${l.name}" (top Z ${l.clearanceZ}, but no tool length is known so the toolhead Z it needs cannot be `
            + 'computed - state one with set_tool_setter_config longest_bit_length_mm or set_probe_geometry '
            + 'probe_effective_length)';
    }
    if (l.clearanceBasis === 'physical') {
        return `"${l.name}" (top Z ${l.clearanceZ}, needs toolhead Z ${l.requiredZ} with the tool and margin above it)`;
    }
    return `"${l.name}" (clearance Z ${l.clearanceZ})`;
}

/**
 * The single bounded XY move + settle + capture behind move_and_capture,
 * shared with visual_servo. Enforces every guard.
 */
export async function executeBoundedMoveAndCapture(args: BoundedMoveArgs): Promise<object> {
    if (args.x === undefined && args.y === undefined) {
        throw new McpToolError('Provide x and/or y.');
    }
    const reason = String(args.reason || '').trim();
    if (!reason) {
        throw new McpToolError('reason is required: say why this XY move is needed (it is shown to the '
            + 'operator). Direct XY moves are single supervised actions - sequences belong in staged, '
            + 'operator-approved mechanisms (survey_bed, move_z batches, probing procedures).');
    }
    const coordinateSystem = args.coordinate_system || 'work';
    if (!['work', 'machine'].includes(coordinateSystem)) {
        throw new McpToolError('coordinate_system must be "work" or "machine".');
    }
    const feedRate = clampTo(args.feed_rate, DIRECT_MOVE_FEED);

    const before = getPositionSnapshot();
    assertSafeToMove(before, args.operator_confirmed_clearance === true);

    const current = coordinateSystem === 'work' ? before.work : before.machine;
    if (current.x === null || current.y === null) {
        throw new McpToolError('Current position unknown; cannot bound the move.');
    }
    const target = {
        x: args.x !== undefined ? Number(args.x) : current.x,
        y: args.y !== undefined ? Number(args.y) : current.y,
    };
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        throw new McpToolError('x/y must be finite numbers.');
    }

    const travel = Math.hypot(target.x - current.x, target.y - current.y);
    const maxTravel = Number(config.get('mcpMaxJogDistance')) || DEFAULT_MAX_TRAVEL_MM;
    if (travel > maxTravel) {
        throw new McpToolError(`Requested travel ${travel.toFixed(1)} mm exceeds the ${maxTravel} mm `
                    + 'per-call limit. Split the approach, or submit a gcode job.');
    }

    const machineTarget = coordinateSystem === 'machine' ? target : {
        x: target.x - before.originOffset.x,
        y: target.y - before.originOffset.y,
    };

    const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
    if (!channel || typeof channel.executeGcode !== 'function') {
        throw new McpToolError('The connected channel does not support direct moves.');
    }

    if (before.machine.x === null || before.machine.y === null) {
        throw new McpToolError('Machine XY is unknown; cannot compute the route collision envelope.');
    }

    const routeClearance = routeClearanceForPath(
        { x: before.machine.x as number, y: before.machine.y as number },
        machineTarget,
    );

    if (!Number.isFinite(routeClearance.minimumZ)) {
        throw new McpToolError(`XY move refused: ${routeClearance.note}`);
    }
    if (routeClearance.minimumZ > Math.max(safeTraverseZ(), before.machine.z || 0)) {
        throw new McpToolError(`Route requires toolhead Z${routeClearance.minimumZ}, above the current/park height; no automatic raise beyond park is allowed.`);
    }

    // OPERATOR LAW (2026-09-01, after the probe crash; made a hard gate on
    // 2026-09-21 - "move_and_capture should be z gated first"): X/Y happens at
    // the safe traverse height, and that precondition is established BEFORE
    // any XY is commanded, from the position of record (assertSafeToMove has
    // already required a fresh, reliable one). An unknown Z refuses. A head
    // below the height is raised straight up first - the one move that cannot
    // descend (law 8) - and the XY is sent only once that raise has settled.
    // Direct camera nudges retain the park-height Z gate (law 7); an active
    // tool or a clearance flag cannot disable it. Staged surveys use the floor.
    const gate = gateDirectXy(before.machine.z, Math.max(safeTraverseZ(), routeClearance.minimumZ), false);
    if (gate.action === 'refuse' || gate.planZ === null) {
        throw new McpToolError(`XY move refused: ${gate.reason}`);
    }
    let raisedFirst: { from: number; to: number } | null = null;
    if (gate.action === 'raise' && gate.fromZ !== null && gate.toZ !== null) {
        raisedFirst = await raiseBeforeXy(channel, gate.fromZ, gate.toZ, reason);
    }
    // Landmarks are checked at the Z the XY will ACTUALLY run at (the raised
    // height, or the current one), never at a height the head has left.
    const planZ = gate.planZ;
    if (args.operator_confirmed_clearance !== true) {
        const machineFrom = { x: before.machine.x, y: before.machine.y };
        if (machineFrom.x !== null && machineFrom.y !== null) {
            const clearance = clearanceOptions();
            const obstacles = landmarkStore.obstaclesOnPath(
                machineFrom.x, machineFrom.y, machineTarget.x, machineTarget.y, planZ,
                undefined, clearance.toolProtrusionMm, clearance.clearanceMarginMm
            );
            if (obstacles.length) {
                throw new McpToolError('XY move refused: the path crosses obstacle landmark(s) '
                    + `${obstacles.map((l) => describeObstacleRequirement(l)).join(', ')} `
                    + `at machine Z ${planZ.toFixed(3)}${raisedFirst ? ' (the head was raised there first and stays there)' : ''}. `
                    + 'Raise Z above the requirement with move_z, or get the operator\'s explicit confirmation for this corridor.');
            }
        }
    }
    // The target inside the toolhead's travel as resolved for this rig. The
    // A350 X home switch sits at machine -19, so "keep the current X while
    // parked at home" passes because the head has been OBSERVED there, not
    // because of a -25 allowance that also admitted six unreachable
    // millimetres beyond it.
    assertWithinTravel(
        [{ label: 'Target', x: machineTarget.x, y: machineTarget.y }],
        requirePlanningTravel('a direct move', { x: before.machine.x, y: before.machine.y })
    );

    // Pacing: warn on the 2nd+ direct move inside the window; refuse from
    // the 4th unless the operator explicitly confirmed the sequence.
    const pacingNow = Date.now();
    while (recentDirectMoves.length && pacingNow - recentDirectMoves[0] > PACING_WINDOW_MS) {
        recentDirectMoves.shift();
    }
    if (recentDirectMoves.length >= PACING_REFUSE_AT - 1 && args.operator_confirmed_clearance !== true) {
        throw new McpToolError(`Refused: this is direct XY move number ${recentDirectMoves.length + 1} within `
            + `${PACING_WINDOW_MS / 1000}s. Direct moves are single supervised actions, not a scripting `
            + 'primitive - use a staged operator-approved mechanism (survey_bed, move_z batch, a probing '
            + 'procedure, or submit_gcode_job), or pass operator_confirmed_clearance: true only when the '
            + 'operator explicitly directed this sequence.');
    }
    const pacingWarning = recentDirectMoves.length >= 1
        ? `Direct-move pacing: ${recentDirectMoves.length + 1} moves in ${PACING_WINDOW_MS / 1000}s - sequences `
            + 'belong in staged, operator-approved mechanisms.'
        : undefined;
    recentDirectMoves.push(pacingNow);

    const move = `G0 X${target.x.toFixed(3)} Y${target.y.toFixed(3)} F${feedRate}`;
    // Every MCP-emitted motion declares its frame (operator law 2026-09-14):
    // G53 for machine coordinates, an explicit G54 for the work workspace.
    const gcode = coordinateSystem === 'machine' ? `G53;\n${move};\nG54;` : `G54;\n${move}`;
    const issuedAt = Date.now();
    const executed = await sendGcodeVisible(channel, `move - ${reason.slice(0, 60)}`, gcode);
    if (executed.result !== 0) {
        throw new McpToolError(`Move rejected by controller: ${executed.text || executed.result}`);
    }

    if (args.wait_until_moved === false) {
        // Fire-and-return: no settle, no capture - the frame would not show
        // the commanded position. Poll get_position before relying on it.
        return {
            commanded: { ...target, coordinate_system: coordinateSystem, feed_rate: feedRate },
            position: null,
            position_verified: false,
            raised_first: raisedFirst,
            pacing_warning: pacingWarning,
            note: 'wait_until_moved was false: move accepted but not awaited, and no frame was '
                + 'captured (it would not show the commanded position). Poll get_position.',
        };
    }

    // Wait for a post-move heartbeat that reports the target, twice,
    // so the returned position is what the firmware says, not what
    // was commanded (#11).
    const settled = await settleUntil(issuedAt, (now) => {
        const reported = coordinateSystem === 'work' ? now.work : now.machine;
        return reported.x !== null && reported.y !== null
            && Math.abs(reported.x - target.x) <= SETTLE_TOLERANCE_MM
            && Math.abs(reported.y - target.y) <= SETTLE_TOLERANCE_MM;
    });
    if (!settled) {
        const last = positionOrNull();
        throw new McpToolError('Move did not settle at the target within '
                    + `${SETTLE_TIMEOUT_MS / 1000}s. Last reported position: ${JSON.stringify(last && {
                        work: last.work, machine: last.machine,
                    })}`);
    }

    await sleep(POST_SETTLE_DWELL_MS);
    if (args.capture === false) {
        return {
            commanded: { ...target, coordinate_system: coordinateSystem, feed_rate: feedRate },
            position: getPositionSnapshot(),
            position_verified: true,
            raised_first: raisedFirst,
            pacing_warning: pacingWarning,
            note: 'position is firmware-reported after settling; capture was false so no frame was taken',
        };
    }
    const frame = await captureFrame();
    const after = getPositionSnapshot();

    return frameContent(frame, {
        commanded: { ...target, coordinate_system: coordinateSystem, feed_rate: feedRate },
        position: after,
        position_verified: true,
        raised_first: raisedFirst,
        pacing_warning: pacingWarning,
        note: 'position is firmware-reported after settling, not the commanded target',
        route_clearance: routeClearance,
    });
}

/** How many cameras one preview call will open, so a box with a hub full of them stays answerable. */
const PREVIEW_DEVICE_LIMIT = 4;

/** The device a capture would actually use right now, under the URL-beats-device precedence. */
function effectiveCamera(): string | null {
    const selection = cameraSelection();
    return selection.url || selection.device || selection.lastGood;
}

function selectionReport(): object {
    const selection = cameraSelection();
    return {
        url: selection.url,
        device: selection.device,
        last_good: selection.lastGood,
        effective: effectiveCamera(),
        pinned: !!(selection.url || selection.device),
    };
}

async function candidatesOrThrow(): Promise<{ provider: string; candidates: CameraCandidate[]; note?: string }> {
    const listed = await listCameraCandidates();
    if (!listed.candidates.length) {
        throw new McpToolError(`No cameras are attached (provider ${listed.provider})`
            + `${listed.note ? `: ${listed.note}` : '.'} Nothing can be previewed or selected until one appears.`);
    }
    return listed;
}

/** One preview frame, or the reason that camera could not produce one - never a substitute frame. */
async function previewOne(entry: string): Promise<{ device: string; frame: CapturedFrame | null; error: string | null }> {
    try {
        return { device: entry, frame: await captureFromDevice(entry), error: null };
    } catch (err) {
        return { device: entry, frame: null, error: (err as Error).message };
    }
}


/**
 * goto_work_origin, STAGED (operator ruling 2026-09-21: "goto work origin is
 * a risk"). Work (0, 0) is resolved through the heartbeat's origin offset at
 * staging, planned like a traverse - motion floor, toolhead travel, landmark
 * crossings, all against the RESOLVED machine destination - and emitted in
 * MACHINE coordinates, so the confirm page shows where the head will go and
 * the approved job goes exactly there. The offset must be the heartbeat's own
 * on a position the record trusts: resolving work zero through a cached or
 * assumed offset is how this move becomes dangerous. No escape hatch - the
 * confirm page is the operator's word.
 */
async function stageGotoWorkOrigin(args: { reason?: string; feed_rate?: number; wait_until_moved?: boolean }): Promise<object> {
    const reason = String(args.reason || '').trim();
    if (!reason) {
        throw new McpToolError('reason is required: say why the head should go to the work origin (it is shown to the operator).');
    }
    const feedRate = clampTo(args.feed_rate, TRAVERSE_FEED);
    const position = getPositionSnapshot();
    // Overtravel, fresh + reliable heartbeat, idle, toolhead off, homed - the
    // same gate as a direct move, with no operator override.
    assertSafeToMove(position, false);
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot plan the move to the work origin.');
    }
    const travel = requirePlanningTravel('the move to the work origin', { x, y });
    let plan;
    try {
        plan = planGotoWorkOrigin({
            currentMachine: { x, y, z },
            originOffset: position.originOffset,
            offsetSource: position.originOffsetSource,
            positionWarnings: position.warnings,
            travel: travel.limits,
            traverseZ: safeTraverseZ(),
            motionFloorZ: motionFloorZ(),
            feedRate,
            obstacles: landmarkStore.obstacleBoxes(),
            ...clearanceOptions(),
            reason,
        });
    } catch (err) {
        if ((err as Error).name === 'TraversePlanError') {
            throw new McpToolError((err as Error).message);
        }
        throw err;
    }
    const validation = validateStagedEnvelope(plan.reviewText, 'goto_work_origin');
    const job = jobManager.submit(plan.reviewText, plan.name, 'cnc', validation, 'direct');
    job.waitUntilMoved = args.wait_until_moved !== false;
    return {
        job: jobManager.describe(job),
        destination_machine: plan.destinationMachine,
        work_origin_offset_at_staging: position.originOffset,
        current_machine: { x, y, z },
        note: 'Staged, awaiting the operator\'s click on the confirm page - read them the MACHINE destination, not "work zero". '
            + 'Then start_gcode_job {job_id, wait_for_approval_ms: 110000}. Z is not touched; no frame is captured on arrival - call capture_frame after.',
    };
}

/**
 * MACHINE home, shared by the `home` tool and the probe_program `home` op:
 * Luban's own G53;G28;G54 (home in the machine workspace, reselect workspace
 * 0), then - unless `waitUntilHomed` is false - wait for two consecutive
 * identical heartbeats that report homed and idle. With the rotary fitted G28
 * also homes B: whoever calls this has told the operator the stock will turn.
 */
export async function homeMachine(tool: string, waitUntilHomed: boolean = true, ignoreStalePosition: boolean = false): Promise<object> {
    probeFeedService.assertNoOvertravel();
    const before = getPositionSnapshot();
    if (!ignoreStalePosition || before.reliability !== 'stale') {
        assertFreshHeartbeat(tool);
    }
    if (before.machineStatus !== 'idle') {
        throw new McpToolError(`Machine is ${before.machineStatus || 'in an unknown state'}, not idle.`);
    }
    const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
    const headPower = Number(state?.headPower);
    if ((Number.isFinite(headPower) && headPower > 0) || state?.headStatus === true || state?.headStatus === 'on') {
        throw new McpToolError('Toolhead appears to be on (headStatus/headPower); refusing to home.');
    }

    const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
    if (!channel || typeof channel.executeGcode !== 'function') {
        throw new McpToolError('The connected channel does not support direct commands.');
    }

    const issuedAt = Date.now();
    // Luban's own Home button sends G53; G28; G54 - home in the
    // machine workspace, then reselect workspace 0. A bare G28 leaves
    // the controller reporting positions in an unselected workspace
    // (observed: derived machine Y 464/Z 656 on the A350).
    const executed = await sendGcodeVisible(channel, tool, 'G53;\nG28;\nG54;');
    if (executed.result !== 0) {
        throw new McpToolError(`Homing rejected by controller: ${executed.text || executed.result}`);
    }
    noteFrameRestored(); // G54 acknowledged after G28; a verified position must still follow.

    if (!waitUntilHomed) {
        return {
            homed: null,
            position_verified: false,
            note: 'wait_until_moved was false: G28 accepted but not awaited (homing takes '
                + '~15-20s). Poll get_position until isHomed is true and the position is '
                + 'stable before any motion.',
        };
    }

    // Homing on the A350 takes tens of seconds; wait for TWO
    // consecutive identical heartbeats (position AND offset) that
    // report homed and idle. A single fresh heartbeat is not enough:
    // mid-sequence the controller reports from the G53 workspace
    // (offset zeroed) before G54 reselects workspace 0, and returning
    // that transient produced a nonsense snapshot on hardware.
    const deadline = issuedAt + HOME_TIMEOUT_MS;
    const initialFingerprint = JSON.stringify([before.work, before.originOffset]);
    let sawChange = false;
    let previous: string | null = null;
    while (Date.now() < deadline) {
        await sleep(HOME_POLL_MS);
        const now = positionOrNull();
        if (!now) {
            continue;
        }
        const reportTime = Date.now() - now.reportAgeMs;
        const fingerprint = JSON.stringify([now.work, now.originOffset]);
        const stable = fingerprint === previous;
        previous = fingerprint;
        if (fingerprint !== initialFingerprint) {
            sawChange = true;
        }
        // The heartbeat lags ~1s, so two identical post-issue beats can
        // both predate the motion. Require the position to have moved
        // off its pre-G28 value at least once - homing always travels -
        // before accepting stability (or 25s, if it started at home).
        const changeOk = sawChange || Date.now() - issuedAt > 25000;
        if (reportTime > issuedAt && stable && changeOk && now.isHomed === true && now.machineStatus === 'idle') {
            return {
                homed: true,
                position: now,
                note: 'Work origins are user-set per workspace and persist across homing. '
                    + 'Check position.warnings, and if coordinates look wrong verify the frame '
                    + 'with query_firmware_position before trusting work coordinates.',
            };
        }
    }
    const last = positionOrNull();
    throw new McpToolError(`Machine did not report homed within ${HOME_TIMEOUT_MS / 1000}s. `
        + `Last state: ${JSON.stringify(last && { isHomed: last.isHomed, machineStatus: last.machineStatus })}`);
}

/** Shared operator/agent frame recovery; deliberately no axis words. */
export async function sendWorkFrameRestore(tool: string): Promise<SentGcode> {
    const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
    if (!channel || typeof channel.executeGcode !== 'function') {
        throw new McpToolError('No machine connected, or the channel does not support direct commands.');
    }
    const executed = await sendGcodeVisible(channel, tool, WORK_FRAME_RESTORE_GCODE);
    // G54 synchronizes the planner, so an acknowledged restore also means no
    // queued motion is left; a fresh verified position still has to follow.
    if (executed.result === 0) { noteFrameRestored(); }
    return executed;
}

export function registerCameraTools(registry: ToolRegistry): void {
    registry.register({
        name: 'list_cameras',
        description: 'List available capture sources: the configured snapshot URL, or DirectShow '
            + 'video devices found by ffmpeg. Reports which one is selected, and the live MJPEG stream '
            + '(stream_url: a page the OPERATOR opens in a browser to watch the camera; not for the agent '
            + 'to fetch). To see what each camera is actually looking at, use preview_cameras; to change '
            + 'the choice, select_camera. Read-only.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const cameras = await listCameras();
            const stream = cameraStreamService.status();
            return {
                ...cameras,
                selection: selectionReport(),
                stream: {
                    enabled: stream.enabled,
                    stream_url: stream.pageUrl,
                    mjpeg_url: stream.streamUrl,
                    snapshot_url: stream.snapshotUrl,
                    running: stream.running,
                    clients: stream.clients,
                    fps: stream.fps,
                },
            } as unknown as object;
        },
    });

    registry.register({
        name: 'capture_frame',
        description: 'Capture one frame from the workshop camera (configstore: mcpCameraUrl for an '
            + 'HTTP snapshot source, else ffmpeg with mcpCameraDevice/mcpFfmpegPath). The frame is '
            + 'stamped with the firmware-reported position it was taken at, when a machine is '
            + 'connected. While an operator watches the live stream (/camera) the frame comes from '
            + 'that loop (camera.source = "stream", one shared device); otherwise this call opens the '
            + 'device itself. Requested snapshots are saved to disk and remain retrievable by frame_id or file after the 12-frame RAM cache rolls over or Luban restarts. No motion.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const frame = await captureFrame();
            return frameContent(frame, { position: positionOrNull() });
        },
    });

    registry.register({
        name: 'get_frame',
        description: 'Read any saved requested snapshot by frame_id (RAM cache then disk), or an image/mosaic by file from MCP camera capture, program-frame, bootstrap or survey directories. There is NO 12-frame retrieval limit: 12 is only the RAM cache size. Remote agents use get_camera_capture_set for job indexes, then get_frame for images. Read-only, no motion or new capture.',
        inputSchema: {
            type: 'object',
            properties: {
                frame_id: { type: 'string', description: 'frameId from any requested capture result; archived snapshots survive cache eviction and restart.' },
                file: { type: 'string', description: 'Image path from a camera/probe program result or a bootstrap/survey index. Server path, not client path.' },
            },
            additionalProperties: false,
        },
        handler: async (args: { frame_id?: string; file?: string }) => {
            const frameId = String(args.frame_id || '').trim();
            let jpg = frameId ? getCachedFrame(frameId) : null;
            let source: 'cache' | 'file' = 'cache';
            let savedFile: string | null = null;
            if (!jpg && frameId) {
                const saved = readCameraSnapshot(DataStorage.userDataDir, frameId);
                if (saved) {
                    jpg = saved.image;
                    savedFile = saved.file;
                    source = 'file';
                }
            }
            if (!jpg && args.file) {
                const file = cameraArtifactPath(DataStorage.userDataDir, String(args.file), 'image');
                jpg = fs.readFileSync(file);
                savedFile = file;
                source = 'file';
            }
            if (!jpg) {
                throw new McpToolError(`Frame "${frameId}" was not found in RAM or the snapshot archive. For older job images, pass the saved file path from the job result/index.`);
            }
            return {
                mcpContent: [
                    { type: 'image', data: jpg.toString('base64'), mimeType: cameraImageMime(jpg) },
                    {
                        type: 'text',
                        text: JSON.stringify({
                            frame_id: frameId || null,
                            source,
                            device: frameId ? getCachedFrameDevice(frameId) : null,
                            file: savedFile,
                        }),
                    },
                ],
            };
        },
    });

    registry.register({
        name: 'get_camera_capture_set',
        description: 'Read the complete position-stamped index of a finished camera_bootstrap or survey_bed. Pass directory from get_gcode_job_status.result. Returns targets, physical plane, dropped poses, frame paths and mosaics as recorded; get_frame reads each image remotely. For an offline solver, save this index.json and the images by basename in a local directory. Read-only; no calibration or motion.',
        inputSchema: {
            type: 'object',
            properties: { directory: { type: 'string', description: 'Server directory returned by the capture job.' } },
            required: ['directory'],
            additionalProperties: false,
        },
        handler: async (args: { directory?: string }) => {
            if (!args.directory) throw new McpToolError('directory is required from the saved job result.');
            const file = cameraArtifactPath(DataStorage.userDataDir, path.join(args.directory, 'index.json'), 'index');
            return { file, index: JSON.parse(fs.readFileSync(file, 'utf8')), next_step: 'Read images with get_frame {file}; keep their machine stamps and holdout flags. Paths are on the server.' };
        },
    });

    registry.register({
        name: 'preview_cameras',
        description: 'Show what each attached camera SEES, one frame per camera, so the right one can be '
            + 'identified before it is selected. Frames come back labelled with the device string and a '
            + 'frame_id; pass that frame_id to select_camera as the evidence for the choice. With two cameras '
            + 'attached, both return perfectly good frames and nothing downstream can tell you picked the '
            + 'wrong one - every measurement is simply wrong - so look first. A camera that cannot be opened '
            + 'is reported as a failure beside the others, never replaced by a substitute frame. Read-only, '
            + 'no motion, and the current selection is left exactly as it is.',
        inputSchema: {
            type: 'object',
            properties: {
                device: {
                    type: 'string',
                    description: 'Preview just this camera (a list_cameras entry, its /dev path or its name). '
                        + 'Omit to preview every attached camera.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args: { device?: string }) => {
            const { provider, candidates, note } = await candidatesOrThrow();
            let wanted = candidates;
            if (args.device !== undefined) {
                const match = matchCameraDevice(String(args.device), candidates);
                if (!match.ok) {
                    throw new McpToolError(match.reason);
                }
                wanted = candidates.filter((candidate) => candidate.entry === match.entry);
            }
            const truncated = wanted.length > PREVIEW_DEVICE_LIMIT;
            wanted = wanted.slice(0, PREVIEW_DEVICE_LIMIT);

            const results = [];
            for (const candidate of wanted) {
                // Sequentially: opening several USB cameras at once is how you
                // get a bandwidth failure that reads like a broken camera.
                // eslint-disable-next-line no-await-in-loop
                results.push(await previewOne(candidate.entry));
            }

            const selected = effectiveCamera();
            const content: object[] = [];
            results.forEach((result, index) => {
                const label = `camera ${index + 1}/${results.length}: "${result.device}"`
                    + `${result.device === selected ? ' [currently selected]' : ''}`;
                if (result.frame) {
                    content.push({ type: 'text', text: `${label} - frame_id ${result.frame.frameId}` });
                    content.push({ type: 'image', data: result.frame.imageBase64, mimeType: result.frame.mimeType });
                } else {
                    content.push({ type: 'text', text: `${label} - NO FRAME: ${result.error}` });
                }
            });
            content.push({
                type: 'text',
                text: JSON.stringify({
                    provider,
                    note,
                    selection: selectionReport(),
                    position: positionOrNull(),
                    previews: results.map((result, index) => ({
                        index: index + 1,
                        device: result.device,
                        frame_id: result.frame ? result.frame.frameId : null,
                        source: result.frame ? result.frame.source : null,
                        currently_selected: result.device === selected,
                        error: result.error,
                    })),
                    truncated_after: truncated ? PREVIEW_DEVICE_LIMIT : null,
                    next: 'select_camera with the device string of the frame that shows the right view, and '
                        + 'that frame\'s frame_id as confirm_frame_id.',
                }),
            });
            return { mcpContent: content };
        },
    });

    registry.register({
        name: 'select_camera',
        description: 'Choose which camera every capture uses from here on (persists as mcpCameraDevice, or '
            + 'mcpCameraUrl for a snapshot URL - picking one clears the other, since the URL would otherwise '
            + 'keep winning). Requires confirm_frame_id: the id of a frame that came from THIS camera, from '
            + 'preview_cameras - a wrong camera produces good-looking frames and silently wrong millimetres, '
            + 'so the choice must be made from a picture, not from a device name that reads plausibly. '
            + 'Selecting a different camera marks the solved camera model unverified: its geometry belonged '
            + 'to the old one. Returns a fresh frame from the camera it just selected. No motion.',
        inputSchema: {
            type: 'object',
            properties: {
                device: {
                    type: 'string',
                    description: 'A list_cameras / preview_cameras entry, its /dev path, its friendly name, or '
                        + 'an http(s) snapshot URL. Must name exactly one attached camera.',
                },
                confirm_frame_id: {
                    type: 'string',
                    description: 'frame_id of a frame taken from this same camera (preview_cameras). Not needed '
                        + 'when only one camera is attached, or when re-selecting the camera already in use.',
                },
                operator_confirmed: {
                    type: 'boolean',
                    description: 'The OPERATOR - not the model - has confirmed this device is the right camera '
                        + 'without a frame. Never pass this on your own judgement.',
                },
                reason: { type: 'string', description: 'Why this camera; recorded in the log.' },
                clear: {
                    type: 'boolean',
                    description: 'Unpin instead of choosing: captures fall back to the last camera that worked. '
                        + 'Use with no device.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args: {
            device?: string;
            confirm_frame_id?: string;
            operator_confirmed?: boolean;
            reason?: string;
            clear?: boolean;
        }) => {
            if (args.clear) {
                if (args.device) {
                    throw new McpToolError('Pass either device or clear: true, not both.');
                }
                const before = clearCameraSelection();
                cameraStreamService.reselectDevice('camera selection cleared');
                return {
                    cleared: true,
                    previous: { url: before.url, device: before.device },
                    selection: selectionReport(),
                    note: 'No camera is pinned. Captures now fall back to the last device that produced a frame, '
                        + 'and a vanished device is still an error rather than a substitution.',
                } as unknown as object;
            }
            if (!args.device) {
                throw new McpToolError('device is required (or clear: true). Run preview_cameras to see what each '
                    + 'attached camera looks at.');
            }
            const { candidates } = await candidatesOrThrow();
            const match = matchCameraDevice(String(args.device), candidates);
            if (!match.ok) {
                throw new McpToolError(match.reason);
            }
            const entry = match.entry;
            const previous = effectiveCamera();
            const unchanged = previous === entry;

            // Evidence for the choice. Waived only where there is nothing to
            // get wrong: one camera attached, or re-pinning the one already
            // in use. The frame must have come from THIS camera - a frame_id
            // from the other camera is exactly the mistake being guarded.
            let confirmedBy = 'operator';
            if (!args.operator_confirmed && !unchanged && candidates.length > 1) {
                const frameId = String(args.confirm_frame_id || '');
                if (!frameId) {
                    throw new McpToolError(`${candidates.length} cameras are attached, so "${entry}" needs `
                        + 'evidence: run preview_cameras, look at the frames, and pass the frame_id of the one '
                        + 'showing the right view as confirm_frame_id (or operator_confirmed: true if the '
                        + 'OPERATOR has confirmed the device by name).');
                }
                if (!getCapturedFrame(frameId)) {
                    throw new McpToolError(`Frame "${frameId}" is not in the cache or snapshot archive. Take a fresh preview_cameras frame.`);
                }
                const frameDevice = getCachedFrameDevice(frameId);
                if (frameDevice === null) {
                    throw new McpToolError(`Frame "${frameId}" is cached but does not name the camera it came from, `
                        + 'so it is evidence for nothing. Take a fresh preview_cameras frame of this camera.');
                }
                if (frameDevice !== entry) {
                    throw new McpToolError(`Frame "${frameId}" came from "${frameDevice}", not from "${entry}". `
                        + 'That frame is evidence about a different camera; preview the one being selected.');
                }
                confirmedBy = `frame ${frameId}`;
            } else if (!args.operator_confirmed) {
                confirmedBy = unchanged ? 'unchanged selection' : 'only camera attached';
            }

            const before = selectCamera(entry);
            cameraLog.info(`select_camera -> "${entry}" (confirmed by ${confirmedBy})`
                + `${args.reason ? `: ${args.reason}` : ''}`);

            // Verify BEFORE the stream loop is moved: it is still holding the
            // old device, so this open cannot collide with it, and when the
            // device is unchanged the loop simply serves the frame.
            let frame: CapturedFrame | null = null;
            let captureError: string | null = null;
            try {
                frame = await captureFromDevice(entry);
            } catch (err) {
                captureError = (err as Error).message;
            }
            const streamRestarted = cameraStreamService.reselectDevice(`camera selected: ${entry}`);

            // The solved model describes the geometry of the camera it was
            // solved for. A different camera has a different geometry
            // entirely, so the model stops being usable on the spot rather
            // than at the next call that happens to pass a fingerprint.
            const model = cameraModelStore.current();
            let modelInvalidated = false;
            if (model && selectionInvalidatesModel(previous, entry)) {
                cameraModelStore.invalidate(model.id, `camera changed from "${previous}" to "${entry}"`);
                modelInvalidated = true;
            }

            const meta = {
                position: positionOrNull(),
                selected: entry,
                matched_on: match.matchedOn,
                confirmed_by: confirmedBy,
                changed: !unchanged,
                previous: { url: before.url, device: before.device, effective: previous },
                selection: selectionReport(),
                stream_restarted: streamRestarted,
                camera_model: modelInvalidated
                    ? {
                        invalidated: true,
                        id: model ? model.id : null,
                        note: 'The stored camera model was solved for the previous camera and is now unverified. '
                            + 'Run camera_bootstrap for this camera before converting any pixel to a machine '
                            + 'coordinate; verify_camera_model refuses a model solved for a different device.',
                    }
                    : { invalidated: false },
                capture_error: captureError,
            };
            if (!frame) {
                return {
                    ...meta,
                    note: `The selection is stored, but "${entry}" produced no frame: ${captureError}. `
                        + 'Fix the camera or select another one - nothing will fall back to a different device.',
                } as unknown as object;
            }
            return frameContent(frame, meta);
        },
    });

    registry.register({
        name: 'set_tool_region',
        description: 'Update the expectedToolRegion that every capture reports: the fractional box '
            + 'where the endmill images (fixed camera-to-spindle geometry). Refine it from live '
            + 'frames instead of round-tripping through configuration edits. Persists.',
        inputSchema: {
            type: 'object',
            properties: {
                u0: { type: 'number' },
                v0: { type: 'number' },
                u1: { type: 'number' },
                v1: { type: 'number' },
                note: { type: 'string', description: 'Provenance: how the box was determined.' },
            },
            required: ['u0', 'v0', 'u1', 'v1'],
            additionalProperties: false,
        },
        handler: async (args: { u0?: number; v0?: number; u1?: number; v1?: number; note?: string }) => {
            const box = [args.u0, args.v0, args.u1, args.v1].map(Number);
            if (box.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
                throw new McpToolError('u0/v0/u1/v1 must be fractions in [0, 1].');
            }
            if (box[0] >= box[2] || box[1] >= box[3]) {
                throw new McpToolError('Require u0 < u1 and v0 < v1.');
            }
            const region = {
                u0: box[0],
                v0: box[1],
                u1: box[2],
                v1: box[3],
                note: args.note ? String(args.note) : undefined,
            };
            config.set('mcpToolRegion', region);
            return { stored: region };
        },
    });

    registry.register({
        name: 'track_feature',
        description: 'Template-match a patch between two captured frames (RAM cache or disk archive, by the frameId each capture '
            + 'reports): give the pixel of a feature in one frame and get its measured pixel in the '
            + 'other, with an NCC confidence score. Use this instead of eyeballing pixel coordinates '
            + 'when deriving calibrations or measuring servo error - hand-estimated pixels were the '
            + 'dominant field error source. A small second-peak gap warns of repetitive-grid '
            + 'ambiguity. No motion, no capture.',
        inputSchema: {
            type: 'object',
            properties: {
                template_frame_id: { type: 'string', description: 'Frame the feature pixel refers to.' },
                search_frame_id: { type: 'string', description: 'Frame to locate the feature in.' },
                point: {
                    type: 'object',
                    properties: { u: { type: 'number' }, v: { type: 'number' } },
                    required: ['u', 'v'],
                    description: 'Feature pixel in the template frame.',
                },
                patch_size: { type: 'number', description: 'Odd patch edge in px, default 41, max 101.' },
                search_radius: { type: 'number', description: 'Search half-window in px, default 120, max 250.' },
                expected_shift: {
                    type: 'object',
                    properties: { du: { type: 'number' }, dv: { type: 'number' } },
                    required: ['du', 'dv'],
                    description: 'Optional predicted pixel shift (e.g. J x commanded move). Breaks '
                        + 'ties among near-best candidates on repetitive grids; the response says '
                        + 'when the expectation, not the raw score, chose the match.',
                },
            },
            required: ['template_frame_id', 'search_frame_id', 'point'],
            additionalProperties: false,
        },
        handler: async (args: {
            template_frame_id?: string;
            search_frame_id?: string;
            point?: { u?: number; v?: number };
            patch_size?: number;
            search_radius?: number;
            expected_shift?: { du?: number; dv?: number };
        }) => {
            const templateJpg = getCapturedFrame(String(args.template_frame_id || ''));
            const searchJpg = getCapturedFrame(String(args.search_frame_id || ''));
            if (!templateJpg || !searchJpg) {
                throw new McpToolError(`Unknown frame id. Cached frames: ${getCachedFrameIds().join(', ') || 'none'} `
                    + 'No matching saved snapshot was found either. Use frameId from a capture result.');
            }
            const u = Math.round(Number(args.point?.u));
            const v = Math.round(Number(args.point?.v));
            if (!Number.isFinite(u) || !Number.isFinite(v)) {
                throw new McpToolError('point.u and point.v must be numbers.');
            }
            let patch = Math.round(Number(args.patch_size) || TRACK_PATCH_PX.default);
            patch = Math.min(Math.max(patch % 2 === 0 ? patch + 1 : patch, TRACK_PATCH_PX.min), TRACK_PATCH_PX.max);
            const radius = clampCount(args.search_radius, TRACK_SEARCH_RADIUS_PX);

            let expected: { du: number; dv: number } | undefined;
            if (args.expected_shift) {
                const edu = Number(args.expected_shift.du);
                const edv = Number(args.expected_shift.dv);
                if (!Number.isFinite(edu) || !Number.isFinite(edv)) {
                    throw new McpToolError('expected_shift.du and .dv must be numbers.');
                }
                expected = { du: edu, dv: edv };
            }

            const result = trackFeature(decodeToGray(templateJpg), decodeToGray(searchJpg), u, v, patch, radius, expected);
            return {
                template_frame_id: args.template_frame_id,
                search_frame_id: args.search_frame_id,
                point: { u, v },
                matched_point: result.matchedPoint,
                pixel_shift: { du: result.du, dv: result.dv },
                score: result.score,
                second_peak_gap: result.secondPeakGap,
                chosen_by: result.chosenBy,
                distance_from_expected: result.distanceFromExpected,
                raw_best: result.rawBest,
                patch_size: patch,
                search_radius: radius,
                warnings: result.warnings,
            };
        },
    });

    registry.register({
        name: 'restore_work_frame',
        description: 'Put the controller back in the WORK workspace (`G90` then `G54` on its own line). NO MOTION: '
            + 'the program carries no axis word, so it is permitted even when the machine position is '
            + 'awaiting-resync or stale - it is the remedy for exactly that state. Use it when get_position '
            + 'reports an incoherent or machine-frame position after a job that declared G53 and never selected a '
            + 'work workspace again: the controller keeps reporting machine coordinates while the heartbeat still '
            + 'carries a work-origin offset, so every derived position is rejected until the frame is handed back. '
            + 'Returns the position of record before and after, re-read two beats later. A re-home is not the remedy.',
        inputSchema: {
            type: 'object',
            properties: {
                reason: { type: 'string', description: 'Why the frame is being restored; logged and shown on the console.' },
            },
            additionalProperties: false,
        },
        handler: async (args: { reason?: string }) => {
            const before = getPositionSnapshot();
            const reason = String(args.reason || '').trim();
            const executed = await sendWorkFrameRestore(`restore_work_frame${reason ? ` - ${reason.slice(0, 60)}` : ''}`);
            // Two status periods: the judgement needs a beat taken AFTER the
            // workspace change, and the poll runs on its own ~2 s cadence.
            await new Promise((resolve) => setTimeout(resolve, FRAME_RESTORE_SETTLE_MS));
            const after = getPositionSnapshot();
            const recovered = reliableForMotion(after.reliability) && !reliableForMotion(before.reliability);
            return {
                sent: WORK_FRAME_RESTORE_GCODE,
                result: executed.result,
                text: executed.text || null,
                before: { reliability: before.reliability, frame: before.frame, machine: before.machine },
                after: { reliability: after.reliability, frame: after.frame, machine: after.machine },
                recovered,
                warnings: after.warnings,
                note: recovered
                    ? 'The controller is back in the work workspace and the position of record is usable again.'
                    : `The position of record is ${after.reliability} after the restore. `
                        + 'Read get_position again in a couple of seconds; if it has not cleared, call '
                        + 'query_firmware_position to see which frame the controller is actually in and tell the operator.',
            };
        },
    });

    registry.register({
        name: 'query_firmware_configuration',
        description: 'Read the configuration currently used by the firmware with M503 S (not necessarily EEPROM values). No motion or settings changes. '
            + 'Use as a liveness diagnostic if M114 returns no position text. An empty reply or transport error '
            + 'is a failure, never proof of a live machine. Does not reconnect or initiate pairing.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
            if (!channel || typeof channel.executeGcode !== 'function') {
                throw new McpToolError('No machine connected, or the channel does not support direct commands.');
            }
            const executed = await sendGcodeVisible(channel, 'query_firmware_configuration', 'M503 S');
            if (executed.result !== 0 || !executed.text?.trim() || /^ok\s*$/i.test(executed.text.trim())) {
                throw new McpToolError(`M503 S returned no configuration or failed: ${executed.text || executed.result}. No fresh machine data was obtained.`);
            }
            return { raw: executed.text, result: executed.result };
        },
    });

    registry.register({
        name: 'query_firmware_position',
        description: 'Ask the firmware directly for its position report (M114) and return the RAW '
            + 'controller response alongside the heartbeat-derived view. This is the authoritative '
            + 'way to establish which coordinate frame the controller is in when heartbeat-derived '
            + 'machine coordinates look wrong (e.g. after homing). Read-only, no motion.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
            if (!channel || typeof channel.executeGcode !== 'function') {
                throw new McpToolError('No machine connected, or the channel does not support direct commands.');
            }
            const executed = await sendGcodeVisible(channel, 'query_firmware_position', 'M114');
            const raw = executed.text || null;
            if (executed.result !== 0 || !raw || !/X:-?\d/.test(raw)) {
                // An "ok" with no position text is not a position report - it
                // is the dead-connection signature (observed live 2026-09-02:
                // the machine had disconnected without the server noticing).
                throw new McpToolError('M114 returned no position text - the connection is likely dead '
                    + 'even though the channel accepted the command. Reconnect the machine and verify '
                    + `get_position is fresh before trusting anything. (raw: ${JSON.stringify(raw)}, `
                    + `result: ${executed.result})`);
            }
            // M114 reports WORK coordinates in the currently selected
            // workspace (operator-clarified 2026-09-02) - it is primarily a
            // liveness/frame check. Machine coordinates are DERIVED here via
            // the heartbeat's originOffset; if the frames disagree (e.g.
            // after a bare G28) the derived values are the thing to distrust.
            const heartbeat = positionOrNull();
            const match = raw.match(/X:(-?\d+(?:\.\d+)?)\s+Y:(-?\d+(?:\.\d+)?)\s+Z:(-?\d+(?:\.\d+)?)/);
            const firmwareWork = match
                ? { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }
                : null;
            const offset = heartbeat && reliableForMotion(heartbeat.reliability) && heartbeat.frame === 'work-frame'
                ? heartbeat.originOffset : null;
            const derivedMachine = firmwareWork && offset
                ? {
                    x: Number((firmwareWork.x - offset.x).toFixed(3)),
                    y: Number((firmwareWork.y - offset.y).toFixed(3)),
                    z: Number((firmwareWork.z - offset.z).toFixed(3)),
                }
                : null;
            return {
                raw,
                result: executed.result,
                firmware_work: firmwareWork,
                derived_machine: derivedMachine,
                note: 'M114 reports WORK coordinates in the selected workspace - primarily a '
                    + 'liveness/frame check. derived_machine is null unless the heartbeat has a reliable work frame; '
                    + 'work origins are volatile (reset on machine reboot), so record MACHINE '
                    + 'coordinates only.',
                heartbeat,
            };
        },
    });

    registry.register({
        name: 'home',
        description: 'MACHINE home (G28): drives every axis to its limit switches - this is NOT the '
            + 'work origin; moving to work X0 Y0 is the separate goto_work_origin operation. Z rises '
            + 'first, making this the default first move after (re)connecting: it also clears any '
            + 'stale position state between Luban and the machine, using the same G53;G28;G54 '
            + 'sequence as Luban itself (home in the machine workspace, then reselect workspace 0). '
            + 'WARNING: with the rotary module '
            + 'fitted, G28 also homes B - stock indexed on the rotary WILL rotate (observed -45 to 0 '
            + 'on hardware); warn the operator first. Requires an idle machine with the toolhead '
            + 'off. Waits for the firmware to report homed. Stale position is refused by default; '
            + 'ignore_stale_position may be true ONLY when the operator explicitly demands homing despite stale data. '
            + 'This does not bypass alarms, toolhead/idle checks or verification after homing.',
        inputSchema: {
            type: 'object',
            properties: {
                ignore_stale_position: {
                    type: 'boolean',
                    default: false,
                    description: 'Only on the operator explicit demand to home despite stale position. Bypasses stale-position rejection only; all other guards and fresh completion verification remain.',
                },
                wait_until_moved: {
                    type: 'boolean',
                    description: 'Default true: block ~15-20s until the firmware reports homed and '
                        + 'settled. false returns right after G28 is accepted - poll get_position '
                        + 'for isHomed before any motion.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args: { wait_until_moved?: boolean; ignore_stale_position?: boolean }) => (
            homeMachine('home', args.wait_until_moved !== false, args.ignore_stale_position === true)
        ),
    });

    registry.register({
        name: 'goto_work_origin',
        description: 'STAGE a move to the WORK origin: one XY move to work X0 Y0 at the CURRENT Z, planned like '
            + 'traverse_xy and approved on the confirm page (operator ruling 2026-09-21: "goto work origin is a '
            + 'risk"). The page shows the destination in MACHINE coordinates - work origins are operator-set and '
            + 'die on a machine reboot, so "work zero" can be anywhere on the bed - and the move is emitted in the '
            + 'machine frame, so what the page shows is where the head goes even if the origin is re-zeroed before '
            + 'start. Refused while the position of record or the origin offset is not trustworthy (awaiting-resync, '
            + 'stale, cached or assumed offset, warnings), below the motion floor (law 2 - raise with move_z first), '
            + 'outside the toolhead travel, or across a landmark below its clearance. Semantically distinct from '
            + 'home, which drives to the machine limit switches. Z is deliberately not touched: no automatic raise '
            + 'and no descent to work Z0. This move does not establish or verify a milling datum; a coherent offset '
            + 'does not prove physical registration. Choose measurable setup references and check the full approach '
            + 'with the fitted tool/holder; unrecorded fixtures are not certified by this guard. After B rotation, '
            + 'a valid retained WCS may have an obstructed zero or approach: do not automatically return there. '
            + 'Recheck the route in the new orientation, or keep the WCS reference and use a separate verified entry. Follow with '
            + 'start_gcode_job {job_id, wait_for_approval_ms: 110000}. No frame is captured on arrival - call '
            + 'capture_frame after.',
        inputSchema: {
            type: 'object',
            properties: {
                reason: { type: 'string', description: 'Why this move is needed; shown to the operator on the confirm page.' },
                feed_rate: { type: 'number', description: `mm/min, default ${TRAVERSE_FEED.default}, max ${TRAVERSE_FEED.max}.` },
                wait_until_moved: {
                    type: 'boolean',
                    description: 'Default true: start_gcode_job blocks until the move verifiably settles at the '
                        + 'origin. false returns right after the controller accepts it; poll get_position afterwards.',
                },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: { reason?: string; feed_rate?: number; wait_until_moved?: boolean }) => stageGotoWorkOrigin(args),
    });

    registry.register({
        name: 'move_and_capture',
        description: 'ONE vision-driven XY reposition: Z-GATED FIRST (operator ruling 2026-09-21), then move, '
            + 'settle-verify, and capture a position-stamped frame. Before any XY is commanded the tool '
            + 'establishes from the position of record that the head is at the safe traverse height '
            + '(mcpSafeTraverseZ, machine Z328): if it is below, it is raised straight up to it first and the '
            + 'XY is sent only once that raise has settled; if Z cannot be established (unknown, unreliable) '
            + 'the call is refused. This is NOT a transport primitive - travel and sequences belong in staged '
            + 'operator-approved mechanisms (traverse_xy, survey_bed, move_z batches, probing procedures, '
            + 'submit_gcode_job), and rapid sequential calls are refused (pacing guard). Obstacle landmarks '
            + 'are checked at the Z the XY actually runs at. No Z parameter by design. Requires an idle machine, toolhead '
            + `off, a stated reason. Travel per call is capped (mcpMaxJogDistance, default ${DEFAULT_MAX_TRAVEL_MM} mm).`,
        inputSchema: {
            type: 'object',
            properties: {
                x: { type: 'number', description: 'Target X. Omit to keep current X.' },
                y: { type: 'number', description: 'Target Y. Omit to keep current Y.' },
                reason: { type: 'string', description: 'Why this move is needed; shown to the operator.' },
                coordinate_system: {
                    type: 'string',
                    enum: ['work', 'machine'],
                    description: 'Which coordinates x/y are in. Default work.',
                },
                feed_rate: { type: 'number', description: `mm/min, default ${DEFAULT_FEED_RATE}, max 3000.` },
                operator_confirmed_clearance: {
                    type: 'boolean',
                    description: 'Set true ONLY when the human operator has explicitly confirmed the '
                        + 'current Z and an obstacle-free path at this Z: the XY then runs at the CURRENT Z '
                        + '(no raise to the traverse height) and the homed-first requirement is skipped. The '
                        + 'one escape hatch - never on the model\'s own judgment.',
                },
                wait_until_moved: {
                    type: 'boolean',
                    description: 'Default true: settle at the target and capture there. false returns '
                        + 'right after the controller accepts the move - no settle, NO FRAME, '
                        + 'position_verified: false; poll get_position afterwards.',
                },
                capture: {
                    type: 'boolean',
                    description: 'Default true. false still settles and verifies the position but '
                        + 'skips the frame - a plain verified move. (The XY travel cap per call is '
                        + 'the configstore key mcpMaxJogDistance, default 100mm.)',
                },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: BoundedMoveArgs) => executeBoundedMoveAndCapture(args),
    });
}
