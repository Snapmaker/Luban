import crypto from 'crypto';
import http from 'http';
import { SerialPort } from 'serialport';

import logger from '../../lib/logger';
import { gcodeLease } from '../machine/gcodeLease';
import { connectionManager } from '../machine/ConnectionManager';
import { clearanceOptions } from './clearanceContext';
import { OBSTACLE_MARGIN_MM, POSITION_EPSILON_MM, isStraightZUp, segmentHitsBox2D } from './envelopeChecks';
import { jobManager } from './jobs';
import { landmarkStore } from './landmarks';
import { requiredToolheadZ } from './landmarkClearance';
import { manualControlGate } from './manualControl';
import { isLoopback } from './McpServer';
import {
    JogBounds, JogPosition, PENDANT_FEED_MAX, PENDANT_Z_FEED_MAX, PendantSession, firmwareMotionProblem, parsePendantInput, validateJogBounds,
} from './pendant';
import {
    A350_STEPS_PER_MM, CountCheckMode, CountSample, HOLD_COUNT_POLL_MS, HOLD_FEATHER_GAP_MS, HOLD_HEARTBEAT_MAX_AGE_MS, HOLD_MIN_ACCEL, HOLD_MOVE_MS,
    CountOffset, HOLD_LATE_EVENTS_TO_DISABLE, HOLD_IDLE_CLOSE_MS, HOLD_LATE_REPLIES_TO_STOP, HOLD_POST_CLOSE_GRACE_MS, HOLD_QUEUE_AHEAD_MS,
    HOLD_CLOSE_PROOF_ATTEMPTS, HOLD_CLOSE_PROOF_RETRY_MS, HOLD_FRESH_REPLY_MS, HOLD_IDLE_POLL_MS, HOLD_ON_DEMAND_PROOF_GAP_MS,
    HOLD_REPLY_LATE_MS, HOLD_REPLY_STOP_MS, HOLD_TICK_MS, HoldQueueModel, capZFeed, countCheckMode, countFault, firmwareZMotionProblem, holdPositionAgrees,
    countToMachine, countToMm, extendAlong, holdMoveMm, holdRunoutMm, judgeCountSample, learnCountOffset, parseCountReport, parseStepsPerMm,
    zBaselineProblem,
} from './pendantHold';
import { pendantPage } from './pendantPage';
import { pendantPosition } from './pendantPosition';
import { pendantSettings, updatePendantSettings } from './pendantSettings';
import { getFeedOverride } from './failureRecovery';
import { currentGcodeSequence, getFrameLatch, getPositionOfRecord, getTrustedOffset, latchFrameUncertain, onFrameLatchChange } from './positionOfRecord';
import { probeFeedService } from './probeFeed';
import {
    assertFullFeedrate, assertMachineReadyForProcedure, enterMachineFrame, moveMachineSettled, queryPositionReport, queueMachineMove,
    readFirmwareMotionConfig, sleep,
    verifyRestoredPosition,
} from './probing';
import { homeMachine, sendWorkFrameRestore } from './tools/camera';
import { HEARTBEAT_STALE_MS, connectionEpoch, declareMachineFrameRun, endMachineFrameRun, getMachineSizeByIdentifier, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

const log = logger('service:mcp:pendant');

// LUBAN_PENDANT_TRACE=1 logs every USB line in both directions (about 30 lines/s) for debugging.
// Off by default; watch it on the console that launched Luban or in the server log.
const traceEnabled = (): boolean => typeof process !== 'undefined' && /^(1|true|on|yes)$/i.test(process.env?.LUBAN_PENDANT_TRACE || '');
const trace = (message: string): void => { if (traceEnabled()) { log.info(`[trace] ${message}`); } };
const PORT_LIST_CACHE_MS = 2000;
// The page's machine-fill margin: reviewed envelopes, and jogs, may reach this far past travel.
const TRAVEL_FILL_MM = 1;
// A shortened approach stops this far outside an obstacle (XY and Z), so heartbeat noise
// cannot report the held toolhead inside the exclusion it was stopped against.
const APPROACH_PAD_XY_MM = 0.5;
const APPROACH_PAD_Z_MM = 0.1;
const MIN_APPROACH_MM = 0.1;
// Displayed heights never understate the requirement: required Z rounds up, asked Z down.
const zUp = (z: number): string => String(Number((Math.ceil(z * 100 - 1e-6) / 100).toFixed(2)));
const zDown = (z: number): string => String(Number((Math.floor(z * 100 + 1e-6) / 100).toFixed(2)));

interface ObstacleExclusion {
    name: string;
    machine: { x0: number; x1: number; y0: number; y1: number };
    requiredZ: number | null;
}

type JogTarget = { position: JogPosition; feed: number; durationMs: number; distanceMm: number };

/**
 * An obstacle that is holding (nothing sent) or limiting (part of the intent sent) the stick,
 * or, with `inside`, that the toolhead is already inside below its required Z (Z-up only).
 */
export interface PendantBlocked {
    name: string;
    requiredZ: number | null;
    requestedZ: number;
    held: boolean;
    inside: boolean;
    text: string;
}

// Continuous X/Y jogging: LUBAN_PENDANT_PIPELINE=1, read on every arm. OFF by
// default; the default is the settled one-segment loop. The hold's pacing
// constants and pure pieces live in pendantHold.ts; the design is described in
// examples/usb-pendant/README.md ("Continuous jogging").
const pipelineRequested = (): boolean => typeof process !== 'undefined' && /^(1|true|on|yes)$/i.test(process.env?.LUBAN_PENDANT_PIPELINE || '');
// LUBAN_PENDANT_COUNT_CHECK=enforced turns the M114 Count check into a gate; read on arm.
const requestedCountCheck = (): CountCheckMode => countCheckMode(typeof process !== 'undefined' ? process.env?.LUBAN_PENDANT_COUNT_CHECK : undefined);
// After a hold's G54, wait this long for the verified position before ready()
// may refuse. Only a WORK-frame reading clears the latch (positionOfRecord.ts
// frameLatchVerified): the close's M114 normally proves it at once
// (verifyRestoredPosition); otherwise the clearing beat is the first heartbeat
// at least 1 s after the restore, which on the 2 s poll can arrive up to 3 s
// after it; the extra second covers HTTP jitter. Nothing moves while this waits.
const FRAME_VERIFY_WAIT_MS = 4000;
// Beats received this long after the G53 reply are judged as machine coordinates.
const PIPELINE_DECLARE_GUARD_MS = 300;
// The lease never lapses while the hold may have G53 selected; `finally` releases it,
// or hands it to a recovery hold when the work frame could not be restored.
const PIPELINE_LEASE_TTL_MS = Infinity;
// While the lease is held, every HTTP request times out this soon instead of the
// channel's 300 s, so a hung request fails the hold (which raises the latch and
// admits Restore work frame) rather than blocking recovery for five minutes. At
// most HOLD_QUEUE_AHEAD_MS of motion is ever queued, so a healthy G54 close is
// far shorter than this.
export const PIPELINE_REQUEST_TIMEOUT_MS = 10000;
// Per-tick records kept for the current or last hold (served at /pendant/hold-trace).
const HOLD_TRACE_LIMIT = 1200;
// The on-demand proof between holds takes the lease this long at most (it sends one M114).
const PROOF_LEASE_TTL_MS = PIPELINE_REQUEST_TIMEOUT_MS + 5000;

/** One decision of the hold loop, for the trace that answers "does Count keep up". */
interface HoldTick {
    at: number;
    kind: 'send' | 'wait' | 'count' | 'baseline' | 'stop';
    /** Clock-model outstanding motion after this decision. */
    outstandingMs: number;
    /** Age of the latest Feather report. */
    inputAgeMs: number;
    sent?: JogPosition;
    /** The increment carried a Z word (only after the hold's Z baseline agreed). */
    zWord?: boolean;
    feed?: number;
    replyMs?: number;
    count?: CountSample;
    /** The Z baseline M114: what it reported against the chain, and the refusal if it did not agree. */
    baseline?: { position: JogPosition | null; chain: JogPosition; execMs: number; problem: string | null };
    reason?: string;
}

interface HoldSummary {
    startedAt: number;
    stopReason: string;
    moves: number;
    distanceMm: number;
    commandedMs: number;
    maxOutstandingMs: number;
    feed: number;
    elapsedMs: number;
    countSamples: number;
    maxLagMm: number | null;
    lateCountReplies: number;
    lateMoveReplies: number;
    restored: boolean;
    proved: boolean | null;
    /** Increments that carried a Z word. */
    zMoves: number;
    /** 'agreed' once the in-hold M114 proved the chain for Z, the refusal text if it did not, null if no Z was asked for. */
    zBaseline: string | null;
}

export class PendantRuntime {
    private session = new PendantSession();

    private port: SerialPort | null = null;

    private buffer = '';

    private busy = false;

    private recovery: string | null = null;

    private nextJog: ReturnType<typeof setImmediate> | null = null;

    private lastJog: { durationMs: number; distanceMm: number; feed: number; elapsedMs: number } | null = null;

    private commandOverheadMs = 500;

    private feedbackHealthy: boolean | null = null;

    private feedbackWritePending = false;

    private owned = false;

    private opening = false;

    private pageAliveAt = 0;

    // Until this time a rejected position report is the hold's own G53-window poll arriving late.
    private postHoldGraceUntil = 0;

    // The last hold's end position when its close was proved by M114 in the work frame:
    // the next press starts from it during the grace instead of waiting for a beat.
    private lastProvedPosition: JogPosition | null = null;

    // Set when an in-hold M114 baseline disagreed with the dead-reckoned chain: the record Z
    // is not trusted, so no Z word is sent by either engine until re-arm. The settled engine
    // always carries an absolute Z word (even for X/Y), so it is refused entirely meanwhile;
    // X/Y continue through the continuous hold, which omits Z.
    private zRefused: string | null = null;

    // A D1 press edge (deadman false -> true) not yet acted on: the hold is entered on the press,
    // with the stick still centred, so G90/G53 (and the Z baseline) are done before the stick moves.
    private d1PressPending = false;

    private lastInputDeadman = false;

    // Wakes an idle hold's tick sleep as soon as the Feather reports a change, instead of
    // the next HOLD_TICK_MS tick (trial 2026-10-05 22:21: up to 100 ms of first-move delay).
    private holdWake: (() => void) | null = null;

    // The last hold's commanded end when its close restored G54 but the M114 proof did not
    // match: the next press proves it on demand (proveLastHoldClose) instead of waiting for a beat.
    private lastHoldClose: { chain: JogPosition; latchSince: number | null } | null = null;

    private lastOnDemandProofAt = -Infinity;

    // Send time of the newest prompt M114 whose position agreed with the hold (an in-hold poll,
    // the Z baseline) or proved a close: position freshness beside the heartbeat (readyInHold).
    private m114FreshAt = -Infinity;

    private lastPorts: Array<{ path: string; serialNumber?: string }> = [];

    private portsAt = 0;

    private portsPending: Promise<Array<{ path: string; serialNumber?: string }>> | null = null;

    // undefined until the first frame of a connection, so a pre-fw board (null) still logs once.
    private firmware: string | null | undefined = undefined;

    private blocked: PendantBlocked | null = null;

    private blockedLogged = new Set<string>();

    private timer: ReturnType<typeof setInterval> | null = null;

    private error: string | null = null;

    private token = crypto.randomBytes(32).toString('hex');

    private epoch: number | null = null;

    private pipeline = { requested: false,
        active: false,
        disabled: null as string | null,
        // Why Z stays on the settled engine this arm (firmware Z limits), or null when holds carry Z.
        zDisabled: null as string | null,
        notice: null as string | null,
        lastHold: null as HoldSummary | null };

    // The M114 Count check: mode read on arm, steps/mm from M503 S (else the A350
    // default), and the Count-frame offset learned from an idle M114 at arm (the
    // trial A350 counts from its homing position: X +19, Y +4, Z +0 mm).
    private countCheck = { mode: 'observe' as CountCheckMode,
        stepsPerMm: A350_STEPS_PER_MM,
        stepsPerMmSource: 'default' as 'M92' | 'default',
        countOffset: null as CountOffset | null,
        countOffsetProblem: null as string | null,
        last: null as CountSample | null };

    private holdPromise: Promise<void> | null = null;

    // Per-tick records of the current or last hold, bounded by HOLD_TRACE_LIMIT.
    private holdTicks: HoldTick[] = [];

    // A hold refused by the obstacle lookahead (or stopped at an obstacle) keeps
    // continuous jogging off until the stick returns to neutral, so a stick held
    // against a box does not open and close a hold several times a second.
    private holdOffUntilNeutral = false;

    // Consecutive late replies within this arm (HOLD_LATE_EVENTS_TO_DISABLE).
    private lateStreak = 0;

    // Crash-guard brackets kept open after a hold could not prove its queue drained.
    private heldMotionGuard = 0;

    public constructor() {
        // The latch clears only after an acknowledged restore AND a verified
        // position, whoever restored (this pendant, MCP restore_work_frame, the
        // failed-call cleanup, a UI home): that is the proof the queue drained,
        // so the held crash guard is released here - with or without a USB
        // pendant open, not only from tick().
        onFrameLatchChange((latch) => { if (!latch) { this.releaseHeldMotionGuard(); } });
    }

    private position(): JogPosition {
        const p = getPositionSnapshot();
        if (!p.machine || !['x', 'y', 'z'].every((a) => Number.isFinite(p.machine[a as keyof JogPosition]))) {
            throw new Error('Complete, reliable machine XYZ is required.');
        }
        return p.machine as JogPosition;
    }

    private machineEpoch(): number | null {
        return connectionEpoch();
    }

    private positionWarnings(): string[] {
        const record = getPositionOfRecord(currentGcodeSequence());
        const p = getPositionSnapshot();
        return this.session.armed ? pendantPosition(p, record, getTrustedOffset(), Date.now(), HEARTBEAT_STALE_MS).warnings : p.warnings;
    }

    private ready(provedPosition = false): void {
        assertMachineReadyForProcedure();
        probeFeedService.assertNoOvertravel();
        const record = getPositionOfRecord(currentGcodeSequence());
        const warnings = provedPosition ? [] : this.positionWarnings();
        if (warnings.length) { throw new Error(`Machine position unavailable: ${warnings.join(' ')}`); }
        if (record && record.source === 'estimated') { throw new Error('Last move was only estimated; wait for a verified position.'); }
        if (jobManager.getActive()?.state === 'started') { throw new Error('A machine job is active.'); }
    }

    private travelBounds(current: JogPosition = this.position()): JogBounds {
        const travel = requirePlanningTravel('manual jogging', current);
        if (travel.conflicts.length) { throw new Error(`Machine travel has unresolved conflicts: ${travel.conflicts.join(' ')}`); }
        const size = getMachineSizeByIdentifier(connectionManager.getConnectionStatus().machineIdentifier);
        if (!size) { throw new Error('Machine travel is unknown.'); }
        // Match stagingFrameContext: A350 profile Z325 excludes its reachable Z328 park.
        return { ...travel.limits, zMin: 0, zMax: Math.max(size.z, safeTraverseZ()) };
    }

    private reviewedBounds(requested: JogBounds): JogBounds {
        validateJogBounds(requested, this.position());
        const travel = this.travelBounds();
        const bounds = { ...requested };
        for (const axis of ['x', 'y', 'z'] as const) {
            bounds[`${axis}Min`] = Math.max(requested[`${axis}Min`], travel[`${axis}Min`] - TRAVEL_FILL_MM);
            bounds[`${axis}Max`] = Math.min(requested[`${axis}Max`], travel[`${axis}Max`] + TRAVEL_FILL_MM);
        }
        this.validateEnvelope(bounds);
        return bounds;
    }

    // A pipelined run passes its queued endpoint: inside the run's G53 window the
    // heartbeat is set aside, and the controller-accepted chain is the position.
    private validateEnvelope(bounds: JogBounds, current: JogPosition = this.position()): void {
        validateJogBounds(bounds, current);
        const travel = this.travelBounds(current);
        // Operator rule: the machine accepts attempted overtravel and so do we, up to
        // TRAVEL_FILL_MM past known travel on every axis; the DRO corrects on the next sync.
        for (const axis of ['x', 'y', 'z'] as const) {
            if (bounds[`${axis}Min`] < travel[`${axis}Min`] - TRAVEL_FILL_MM || bounds[`${axis}Max`] > travel[`${axis}Max`] + TRAVEL_FILL_MM) {
                throw new Error(`Machine ${axis.toUpperCase()} bounds must stay within ${travel[`${axis}Min`] - TRAVEL_FILL_MM}..${travel[`${axis}Max`] + TRAVEL_FILL_MM} mm (travel ±${TRAVEL_FILL_MM} mm).`);
            }
        }
    }

    private obstacleExclusions(): ObstacleExclusion[] {
        const opts = clearanceOptions();
        return landmarkStore.obstacleBoxes().map((box) => ({
            name: box.name,
            machine: {
                x0: Math.min(box.machine.x0, box.machine.x1) - OBSTACLE_MARGIN_MM,
                x1: Math.max(box.machine.x0, box.machine.x1) + OBSTACLE_MARGIN_MM,
                y0: Math.min(box.machine.y0, box.machine.y1) - OBSTACLE_MARGIN_MM,
                y1: Math.max(box.machine.y0, box.machine.y1) + OBSTACLE_MARGIN_MM,
            },
            requiredZ: requiredToolheadZ(box.clearanceZ, box.clearanceBasis || 'toolhead',
                opts.toolProtrusionMm, opts.clearanceMarginMm),
        }));
    }

    // Manual jogs get no probing exemption: check the complete segment, including
    // Z-only descents and moves wholly inside a landmark footprint. The one exception is
    // a straight Z-up exit (isStraightZUp), which climbs away from anything beneath.
    // obstacleHit(p, p) is the point check: is p inside an exclusion below its required Z?
    // With `approach`, each box whose padded volume does not already contain `from` is
    // widened by APPROACH_PAD_XY_MM and raised by APPROACH_PAD_Z_MM, so a hold stops short
    // of the exclusion. Only validateJogSegment uses the exact (unpadded) test.
    private obstacleHit(from: JogPosition, to: JogPosition, boxes: ObstacleExclusion[], approach = false): ObstacleExclusion | null {
        if (isStraightZUp(from, to)) { return null; }
        const below = (box: ObstacleExclusion, z: number, padZ: number) => box.requiredZ === null
            || z < box.requiredZ + padZ - POSITION_EPSILON_MM;
        for (const box of boxes) {
            const padded = approach && !(segmentHitsBox2D(from.x, from.y, from.x, from.y, box.machine, APPROACH_PAD_XY_MM)
                && below(box, from.z, APPROACH_PAD_Z_MM));
            if (segmentHitsBox2D(from.x, from.y, to.x, to.y, box.machine, padded ? APPROACH_PAD_XY_MM : 0)
                && below(box, Math.min(from.z, to.z), padded ? APPROACH_PAD_Z_MM : 0)) {
                return box;
            }
        }
        return null;
    }

    private validateJogSegment(from: JogPosition, to: JogPosition): void {
        const box = this.obstacleHit(from, to, this.obstacleExclusions());
        if (box) {
            const needed = box.requiredZ === null ? 'tool clearance is unknown; this region is excluded'
                : `requires machine Z at or above ${box.requiredZ.toFixed(3)} mm`;
            throw new Error(`Jog blocked by ${box.name}: ${needed}. Requested segment reaches machine Z ${Math.min(from.z, to.z).toFixed(3)} mm. Review the obstacle exclusions before re-arming.`);
        }
    }

    private insideBlocked(box: ObstacleExclusion, z: number): PendantBlocked {
        return { name: box.name,
            requiredZ: box.requiredZ,
            requestedZ: Number(z.toFixed(3)),
            held: true,
            inside: true,
            text: box.requiredZ === null ? `INSIDE ${box.name} (tool unknown): Z-up only`
                : `INSIDE ${box.name} below Z${zUp(box.requiredZ)}: Z-up only` };
    }

    /**
     * Obstacles HOLD the stick instead of disarming. A segment that would enter an
     * exclusion below its required Z is never sent. In its place this tries, in order:
     * the longest clear prefix (stopping short of the box by the approach pad), then the
     * same intent with one or two axis components removed, like envelope clipping, but
     * never removing the dominant one (a Z-down stick does not turn into its XY drift).
     * Every alternative is a subset of the operator's own stick motion inside the armed
     * envelope. Positions are rounded to the 3 decimals moveMachineSettled sends before
     * any check, and the caller still runs the full validateJogSegment on whatever is
     * returned. null means hold: stay armed, send nothing, and report the blocking
     * obstacle until the stick returns to neutral or a full segment is accepted. Inside an
     * exclusion below its required Z only a straight Z-up exit is sent.
     * The exclusions are recomputed on every call, so landmark or tool changes while armed
     * apply to the next segment.
     */
    private obstacleSafeTarget(from: JogPosition, raw: JogTarget | null): JogTarget | null {
        const bounds = this.session.bounds as JogBounds;
        // G-code precision, kept inside the armed envelope; `toward` truncates toward it.
        const gcode = (p: JogPosition, toward?: JogPosition): JogPosition => {
            const out = { ...p };
            for (const axis of ['x', 'y', 'z'] as const) {
                const v = p[axis] * 1000;
                let r = Math.round(v);
                if (toward !== undefined) { r = p[axis] > toward[axis] ? Math.floor(v) : Math.ceil(v); }
                r = Math.max(Math.ceil(bounds[`${axis}Min`] * 1000), Math.min(Math.floor(bounds[`${axis}Max`] * 1000), r));
                out[axis] = Number((r / 1000).toFixed(3));
            }
            return out;
        };
        const segment = (position: JogPosition, feed: number): JogTarget => {
            const distanceMm = Math.hypot(position.x - from.x, position.y - from.y, position.z - from.z);
            return { position, feed, durationMs: distanceMm / feed * 60000, distanceMm };
        };
        let target = raw ? segment(gcode(raw.position), raw.feed) : null;
        if (target && target.distanceMm < 0.001) { target = null; }
        const boxes = this.obstacleExclusions();
        const inside = this.obstacleHit(from, from, boxes);
        if (inside) {
            // Inside an exclusion below its required Z (armed there, or reported there): only a
            // straight climb is sent, with its XY pinned to the current point. Everything else
            // holds, including a climb with any XY component beyond POSITION_EPSILON_MM.
            this.blocked = this.insideBlocked(inside, from.z);
            if (!target) { return null; }
            if (isStraightZUp(from, target.position)) {
                const climb = gcode({ x: from.x, y: from.y, z: target.position.z });
                return isStraightZUp(from, climb) ? segment(climb, target.feed) : null;
            }
            if (!this.blockedLogged.has(inside.name)) {
                this.blockedLogged.add(inside.name);
                log.info(`Jog held inside ${inside.name} at machine Z ${from.z.toFixed(3)} mm: only a straight Z-up exit is sent until the toolhead leaves it. Still armed; that segment was not sent. Later refusals at this obstacle are not logged until the next arm.`);
            }
            return null;
        }
        if (!target) { this.blocked = null; return null; }
        const hit = this.obstacleHit(from, target.position, boxes, true);
        if (!hit) { this.blocked = null; return target; }
        const clear = (candidate: JogTarget) => candidate.distanceMm >= 0.001 && !this.obstacleHit(from, candidate.position, boxes, true);
        const end = target.position;
        const along = (t: number): JogPosition => ({ x: from.x + (end.x - from.x) * t,
            y: from.y + (end.y - from.y) * t,
            z: from.z + (end.z - from.z) * t });
        let chosen: JogTarget | null = null;
        // Hits are monotonic along a straight segment, so bisection finds the clear prefix.
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 24; i += 1) {
            const mid = (lo + hi) / 2;
            if (this.obstacleHit(from, along(mid), boxes, true)) { hi = mid; } else { lo = mid; }
        }
        if (lo * target.distanceMm >= MIN_APPROACH_MM) {
            const prefix = segment(gcode(along(lo), from), target.feed);
            if (clear(prefix)) { chosen = prefix; }
        }
        // Never drop the dominant requested axis: what is left would be only the minor drift.
        const delta = { x: Math.abs(end.x - from.x), y: Math.abs(end.y - from.y), z: Math.abs(end.z - from.z) };
        const dominant = (['x', 'y', 'z'] as const).find((axis) => delta[axis] > 0
            && (['x', 'y', 'z'] as const).every((other) => other === axis || delta[axis] >= 2 * delta[other]));
        const drops: Array<Array<'x' | 'y' | 'z'>> = [['z'], ['x'], ['y'], ['x', 'y'], ['x', 'z'], ['y', 'z']];
        for (const axes of drops) {
            if (chosen) { break; }
            if (dominant && axes.includes(dominant)) { continue; }
            const position = { ...end };
            for (const axis of axes) { position[axis] = from[axis]; }
            const candidate = segment(gcode(position), target.feed);
            if (clear(candidate)) { chosen = candidate; }
        }
        const requestedZ = Number(Math.min(from.z, end.z).toFixed(3));
        const need = hit.requiredZ === null ? 'no entry, tool clearance unknown'
            : `Z>=${zUp(hit.requiredZ)} (asked ${zDown(requestedZ)})`;
        this.blocked = { name: hit.name,
            requiredZ: hit.requiredZ,
            requestedZ,
            held: !chosen,
            inside: false,
            text: `${chosen ? 'LIMITED' : 'BLOCKED'} ${hit.name}: ${need}` };
        if (!this.blockedLogged.has(hit.name)) {
            this.blockedLogged.add(hit.name);
            const needed = hit.requiredZ === null ? 'tool clearance is unknown; the region is excluded'
                : `requires machine Z at or above ${hit.requiredZ.toFixed(3)} mm`;
            log.info(`Jog ${chosen ? 'limited' : 'held'} at ${hit.name}: ${needed}; requested segment reaches machine Z ${requestedZ.toFixed(3)} mm. Still armed; that segment was not sent. Later refusals at this obstacle are not logged until the next arm.`);
        }
        return chosen;
    }

    private release(): void {
        if (this.owned && !this.busy && !this.session.armed) {
            manualControlGate.release();
            this.owned = false;
        }
    }

    public disarm(reason = 'Disarmed by operator.'): void {
        if (this.nextJog !== null) { clearImmediate(this.nextJog); this.nextJog = null; }
        if (this.session.armed || this.error !== reason) { log.info(`Disarmed: ${reason}`); }
        this.session.disarm();
        this.blocked = null;
        this.error = reason;
        this.release();
    }

    private async ports() {
        const ports = (await SerialPort.list()).filter((p) => p.vendorId?.toLowerCase() === '239a'
            && p.productId?.toLowerCase() === '8124');
        this.lastPorts = ports;
        this.portsAt = Date.now();
        return ports;
    }

    // Status polls must stay cheap and must never hang: enumerating serial ports can take
    // hundreds of ms on Linux, so polls reuse the last list and wait at most 1 s for a refresh.
    private async cachedPorts() {
        if (!this.portsPending && Date.now() - this.portsAt > PORT_LIST_CACHE_MS) {
            this.portsPending = this.ports().catch(() => this.lastPorts)
                .finally(() => { this.portsAt = Date.now(); this.portsPending = null; });
        }
        if (!this.portsPending) { return this.lastPorts; }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fallback = new Promise<Array<{ path: string; serialNumber?: string }>>((resolve) => {
            timer = setTimeout(() => resolve(this.lastPorts), 1000);
        });
        try { return await Promise.race([this.portsPending, fallback]); } finally { clearTimeout(timer); }
    }

    private async connect(path: string): Promise<void> {
        if (this.busy || this.opening) { throw new Error('Wait for the current connection or jog to finish.'); }
        this.opening = true;
        try {
            const ports = await this.ports();
            if (!ports.some((p) => p.path === path)) { throw new Error('Select the Feather USB data port.'); }
            this.shutdown();
            this.session.reset();
            this.feedbackHealthy = null;
            this.feedbackWritePending = false;
            this.firmware = undefined;
            const port = new SerialPort({ path, baudRate: 115200, autoOpen: false });
            this.port = port;
            port.on('error', (err: Error) => { if (port === this.port) { this.disarm(err.message); } });
            port.on('close', () => { if (port === this.port) { this.disarm('USB disconnected; reconnect and re-arm.'); } });
            port.on('data', (data: Buffer) => {
                if (port !== this.port) { return; }
                this.buffer += data.toString('utf8');
                if (this.buffer.length > 4096) { this.buffer = ''; this.disarm('USB receive buffer overflow.'); return; }
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop() || '';
                try {
                    for (const line of lines) {
                        if (line.trim()) {
                            trace(`rx ${line.slice(0, 600)}`);
                            let input;
                            try { input = parsePendantInput(line); } catch (err) {
                                if (!traceEnabled() && this.error !== (err as Error).message) {
                                    log.warn(`Rejected USB frame: ${line.slice(0, 300)}`);
                                }
                                throw err;
                            }
                            if (this.firmware === undefined || (input.fw ?? null) !== this.firmware) {
                                this.firmware = input.fw ?? null;
                                log.info(`Feather firmware: ${this.firmware || 'unidentified (pre-fw build)'}`);
                            }
                            if (input.log) { trace(`feather ${input.log}`); }
                            this.feedbackHealthy = input.feedback_ok ?? null;
                            this.session.receive(input, Date.now());
                            if (input.deadman && !this.lastInputDeadman) { this.d1PressPending = true; }
                            if (!input.deadman) { this.d1PressPending = false; }
                            this.lastInputDeadman = input.deadman;
                            if (this.holdWake && (!input.deadman || input.stop || Math.hypot(input.x, input.y, input.z) >= 0.01)) {
                                this.holdWake();
                            }
                            if (input.stop) { this.disarm('Stopped with Feather D2.'); }
                            if (this.session.armed && input.feedback_ok === false) {
                                this.disarm('Feather feedback exceeded one second. Centre axes and re-arm after the USB link recovers.');
                            }
                        }
                    }
                } catch (err) { this.disarm((err as Error).message); }
            });
            await new Promise<void>((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
            this.error = 'Connected. Centre all axes before arming.';
            log.info(`USB connected: ${path}`);
            this.timer = setInterval(() => { this.tick().catch((err: Error) => this.disarm(err.message)); }, 100);
        } finally { this.opening = false; }
    }

    private dro(): object {
        try {
            const p = getPositionSnapshot();
            const record = getPositionOfRecord(currentGcodeSequence());
            return pendantPosition(p, record, getTrustedOffset(), Date.now(), HEARTBEAT_STALE_MS);
        } catch (err) {
            return { machine: null, work: null, reliability: 'disconnected', age_ms: null, warnings: [(err as Error).message] };
        }
    }

    private watchdog(now: number): void {
        if (this.session.armed) {
            if (this.machineEpoch() !== this.epoch) { this.disarm('Machine connection changed. Re-arm at centre.'); } else if (now >= this.session.expiresAt) { this.disarm('The 10-minute jog approval expired. Review bounds and re-arm.'); } else if (now - this.pageAliveAt > 900) { this.disarm('Pendant page heartbeat exceeded the one-second limit. Keep the page visible and re-arm.'); } else if (now - this.session.receivedAt > 900) { this.disarm('Feather input exceeded the one-second limit. Check USB, centre axes and re-arm.'); }
        }
    }

    private async tick(): Promise<void> {
        const now = Date.now();
        this.watchdog(now);
        if (this.port?.isOpen && !this.feedbackWritePending && this.port.writableLength < 1024) {
            const dro = this.dro() as { machine: object | null; work: object | null; reliability: string;
                // eslint-disable-next-line camelcase -- USB protocol keys
                age_ms: number | null; position_age_ms?: number; stale_after_ms?: number; warnings: string[] };
            this.feedbackWritePending = true;
            const frame = `${JSON.stringify({ v: 1,
                type: 'dro',
                armed: this.session.armed,
                neutral: this.session.neutral,
                machine: dro.machine,
                work: dro.work,
                reliability: dro.reliability,
                age_ms: dro.age_ms,
                position_age_ms: dro.position_age_ms,
                stale_after_ms: dro.stale_after_ms,
                moving: this.busy && this.recovery === null,
                // PR #233: the TFT names the limited axis while the stick pushes into the envelope edge.
                // eslint-disable-next-line camelcase -- USB protocol key
                limit_axes: this.session.limitedAxes,
                warnings: dro.warnings.length ? [dro.warnings[0].slice(0, 160)] : [],
                input_seq: this.session.inputSequence >= 0 ? this.session.inputSequence : null,
                input_age_ms: now - this.session.receivedAt,
                // The TFT shows `blocked` on its bottom row while linked; `message` only while not.
                blocked: this.blocked ? { ...this.blocked, name: this.blocked.name.slice(0, 40), text: this.blocked.text.slice(0, 120) } : null,
                message: (this.error || this.blocked?.text || '').slice(0, 240) || null })}\n`;
            trace(`tx ${frame.trimEnd()}`);
            this.port.write(frame, (err) => {
                this.feedbackWritePending = false;
                if (err) { this.disarm(err.message); }
            });
        }
        this.release();
        if (this.busy || !this.session.armed) { return; }
        const latest = this.session.latest;
        if (latest && latest.x === 0 && latest.y === 0 && latest.z === 0) { this.holdOffUntilNeutral = false; }
        const latch = getFrameLatch();
        // The last close was restored but not proved, and the stick asks for motion again: prove
        // its end position now (M114 in the work frame, no motion) instead of waiting up to
        // FRAME_VERIFY_WAIT_MS / HOLD_POST_CLOSE_GRACE_MS for a beat. Only a proof lets it go on.
        if (this.onDemandProofDue(now, latch)) {
            if (await this.proveLastHoldClose()) { this.queueNextTick(); }
            return;
        }
        // A restore was acknowledged; its verified position is still arriving. Hold, do not disarm.
        if (latch && latch.restoredAt !== null && now - latch.restoredAt < FRAME_VERIFY_WAIT_MS) { return; }
        // A status poll issued inside the hold's G53 window can arrive after the closing G54
        // (raw machine Z 329 + offset reads Z 541): wait for the next coherent beat, do not
        // disarm. After the grace the ordinary check applies.
        // When the close was proved by M114, start the next press from that proved end position.
        const graced = now < this.postHoldGraceUntil && this.positionWarnings().length > 0;
        if (graced && !this.lastProvedPosition) { return; }
        this.ready(graced);
        const from = graced ? { ...(this.lastProvedPosition as JogPosition) } : this.position();
        const target = this.obstacleSafeTarget(from, this.session.target(from, now, this.commandOverheadMs));
        if (!target) {
            // Optimistic entry: D1 pressed with the stick centred opens the hold idle (no motion), so the
            // first increment goes out as soon as the stick moves instead of after G90/G53 round trips.
            const latestInput = this.session.latest;
            const centred = !!latestInput && Math.hypot(latestInput.x, latestInput.y, latestInput.z) < 0.01;
            if (this.d1PressPending && centred && latestInput?.deadman === true && !this.holdOffUntilNeutral
                && this.pipelineEligible(from, { position: from, feed: 0, durationMs: 0, distanceMm: 0 } as JogTarget)) {
                this.d1PressPending = false;
                this.holdPromise = this.continuousHold(from);
                try { await this.holdPromise; } finally { this.holdPromise = null; }
                this.queueNextTick();
                return;
            }
            this.release();
            return;
        }
        this.d1PressPending = false;
        if (this.pipelineEligible(from, target) && this.holdAdmits(from, now)) {
            this.holdPromise = this.continuousHold(from);
            try { await this.holdPromise; } finally { this.holdPromise = null; }
            this.queueNextTick();
            return;
        }
        if (this.zRefused) {
            // Every settled segment carries an absolute Z word from the record Z the baseline refused.
            const message = `Z refused until re-arm (the in-hold M114 disagreed: ${this.zRefused}). X/Y jog in continuous holds only.`;
            if (this.error !== message) { this.error = message; log.info(`Settled jog refused: ${message}`); }
            this.release();
            return;
        }
        this.validateEnvelope(this.session.bounds as JogBounds);
        this.validateJogSegment(from, target.position);
        this.busy = true;
        try {
            await moveMachineSettled('usb_pendant', target.position, target.feed);
            this.lastJog = { durationMs: target.durationMs,
                distanceMm: target.distanceMm,
                feed: target.feed,
                elapsedMs: Date.now() - now };
            this.commandOverheadMs = Math.max(this.commandOverheadMs * 0.8, this.lastJog.elapsedMs - target.durationMs, 0);
        } finally {
            this.busy = false;
            this.release();
        }
        this.queueNextTick();
    }

    // Service pending USB events before sampling the next intent. Do not add
    // the periodic timer's 0–100 ms idle gap after each synchronous move.
    private queueNextTick(): void {
        if (this.session.armed && this.nextJog === null) {
            this.nextJog = setImmediate(() => {
                this.nextJog = null;
                this.tick().catch((err: Error) => this.disarm(err.message));
            });
        }
    }

    /**
     * Whether the next press should prove the last hold's close now: that close
     * restored G54 but its M114 did not match (lastHoldClose), we are inside its
     * grace, the stick asks for motion, and the only obstacle is the proof itself
     * (our own latch with its restore acknowledged, or position warnings from a
     * late G53-window beat). Rate-limited to one M114 per HOLD_ON_DEMAND_PROOF_GAP_MS.
     */
    private onDemandProofDue(now: number, latch: ReturnType<typeof getFrameLatch>): boolean {
        const close = this.lastHoldClose;
        if (!close || this.lastProvedPosition || now >= this.postHoldGraceUntil || now - this.lastOnDemandProofAt < HOLD_ON_DEMAND_PROOF_GAP_MS) {
            return false;
        }
        const p = this.session.latest;
        if (!p || !p.ready || !p.deadman || p.feedback_ok === false || Math.hypot(p.x, p.y, p.z) < 0.01) { return false; }
        if (latch) { return latch.restoredAt !== null && latch.since === close.latchSince; }
        return this.positionWarnings().length > 0;
    }

    /**
     * The on-demand proof: verifyRestoredPosition (M114 judged in the WORK frame,
     * the same clearing path the close uses; no motion) against the last close's
     * commanded end. Under a short lease when one can be taken; while our own
     * close's latch stands no lease can be (gcodeLease.acquire refuses), and M114
     * is one of the commands the recovery hold admits. A match clears the latch
     * and becomes lastProvedPosition; anything else waits for a beat as before.
     */
    private async proveLastHoldClose(): Promise<boolean> {
        const close = this.lastHoldClose as { chain: JogPosition; latchSince: number | null };
        const sentAt = Date.now();
        this.lastOnDemandProofAt = sentAt;
        this.busy = true;
        let leaseId: number | null = null;
        try {
            if (!getFrameLatch()) { leaseId = gcodeLease.acquire('the USB pendant (position proof)', PROOF_LEASE_TTL_MS, sentAt, PIPELINE_REQUEST_TIMEOUT_MS); }
            const prove = async () => verifyRestoredPosition('usb_pendant:on-demand-proof', close.chain);
            const proved = leaseId === null ? await prove() : await gcodeLease.runAs(leaseId, prove);
            if (proved) {
                this.lastProvedPosition = { ...close.chain };
                this.lastHoldClose = null;
                this.m114FreshAt = Math.max(this.m114FreshAt, sentAt);
                log.info(`Continuous jog: the next press proved the last hold's end position with M114 in ${Date.now() - sentAt} ms; no beat wait.`);
            } else {
                log.warn('Continuous jog: the on-demand M114 did not prove the last hold\'s end position; waiting for a verified beat.');
            }
            return proved;
        } catch (err) {
            log.warn(`Continuous jog: the on-demand M114 proof failed: ${(err as Error).message}; waiting for a verified beat.`);
            return false;
        } finally {
            if (leaseId !== null) { gcodeLease.release(leaseId); }
            this.busy = false;
            this.release();
        }
    }

    // assertMachineReadyForProcedure() minus its position-reliability check: beats
    // inside the hold's G53 window are judged by the declared run (machinePosition.ts),
    // and the hold starts from a ready() position and ends with the shared restore.
    // Returns a reason to STOP the hold (restore G54, stay armed); throws to disarm.
    private readyInHold(): string | null {
        const p = getPositionSnapshot();
        if (p.machineStatus !== 'idle') {
            throw new Error(`Continuous jog stopped: the controller reported "${p.machineStatus || 'unknown'}" during queued motion. `
                + 'Pendant disarmed; re-arm to continue. If this happens on every jog, this controller reports busy during queued '
                + 'moves: restart Luban without LUBAN_PENDANT_PIPELINE.');
        }
        if (p.isHomed !== true) { throw new Error('Continuous jog stopped: the machine does not report homed. Pendant disarmed.'); }
        const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
        if (Number(state?.headPower) > 0 || state?.headStatus === true || state?.headStatus === 'on') {
            throw new Error('Continuous jog stopped: the toolhead appears to be on. Pendant disarmed.');
        }
        probeFeedService.assertNoOvertravel();
        if (jobManager.getActive()?.state === 'started') { throw new Error('Continuous jog stopped: a machine job is active. Pendant disarmed.'); }
        // Position freshness is the newer of the heartbeat and the last prompt M114 that agreed
        // with the hold (pollCount, the Z baseline, a close proof). A failed, late or disagreeing
        // M114 never refreshes it, so a faltering connection still stops the hold.
        // M114 never replaces the heartbeat entirely: machineStatus, homed and head power come
        // from it, so a beat older than the stale threshold stops the hold regardless.
        if (p.reportAgeMs > HEARTBEAT_STALE_MS) {
            return `machine heartbeat ${p.reportAgeMs} ms old (hard limit ${HEARTBEAT_STALE_MS} ms even with fresh M114)`;
        }
        const m114AgeMs = Date.now() - this.m114FreshAt;
        if (Math.min(p.reportAgeMs, m114AgeMs) > HOLD_HEARTBEAT_MAX_AGE_MS) {
            const m114 = Number.isFinite(m114AgeMs) ? `the last agreeing M114 ${m114AgeMs} ms old` : 'no agreeing M114 yet';
            return `machine heartbeat ${p.reportAgeMs} ms old and ${m114} (limit ${HOLD_HEARTBEAT_MAX_AGE_MS} ms)`;
        }
        return null;
    }

    /** Age of the freshest position evidence: the heartbeat, or a prompt agreeing M114. */
    // The idle tick's sleep, cut short by holdWake when the Feather reports stick motion, release or STOP.
    private async idleSleep(ms: number): Promise<void> {
        await new Promise<void>((resolve) => {
            let done = false;
            const finish = (): void => {
                if (done) { return; }
                done = true;
                if (this.holdWake === finish) { this.holdWake = null; }
                resolve();
            };
            this.holdWake = finish;
            sleep(ms).then(finish, finish);
        });
    }

    private positionFreshAgeMs(): number {
        return Math.min(getPositionSnapshot().reportAgeMs, Date.now() - this.m114FreshAt);
    }

    /** Read the firmware's motion limits and steps/mm once per arm; the hold stays off unless they fit the model. */
    private async preparePipeline(): Promise<void> {
        this.pipeline = { ...this.pipeline, requested: false, disabled: null, zDisabled: null, notice: null };
        this.countCheck = { ...this.countCheck,
            mode: requestedCountCheck(),
            stepsPerMm: A350_STEPS_PER_MM,
            stepsPerMmSource: 'default',
            countOffset: null,
            countOffsetProblem: null };
        this.lateStreak = 0;
        this.holdOffUntilNeutral = false;
        this.lastHoldClose = null;
        this.m114FreshAt = -Infinity;
        if (!pipelineRequested()) { return; }
        let problem: string | null;
        let zProblem: string | null = null;
        try {
            const m503 = await readFirmwareMotionConfig('usb_pendant:pipeline-check');
            problem = firmwareMotionProblem(m503, PENDANT_FEED_MAX, HOLD_MIN_ACCEL);
            zProblem = firmwareZMotionProblem(m503, PENDANT_Z_FEED_MAX);
            const steps = parseStepsPerMm(m503);
            if (steps) { this.countCheck = { ...this.countCheck, stepsPerMm: steps, stepsPerMmSource: 'M92' }; }
        } catch (err) {
            problem = `Could not read the controller's motion limits: ${(err as Error).message}`;
        }
        if (!problem) {
            // Once per arm, not per hold: one fewer request between D1 and the first increment.
            try { await assertFullFeedrate('usb_pendant:pipeline-check'); } catch (err) {
                problem = `Could not assert a 100 % feed override: ${(err as Error).message}`;
            }
        }
        if (!problem) { await this.learnCountOffset(); }
        const offsetNote = this.countCheck.countOffset
            ? `Count offset learned at arm: X ${this.countCheck.countOffset.x.toFixed(3)} Y ${this.countCheck.countOffset.y.toFixed(3)} `
                + `Z ${this.countCheck.countOffset.z.toFixed(3)} mm.`
            : `Count offset unknown (${this.countCheck.countOffsetProblem || 'not read'}): Count is traced raw and cannot be read as a position.`;
        const countNote = this.countCheck.mode === 'enforced'
            ? `The M114 Count check is ENFORCED: a Count position more than one increment from the model, or a late M114 reply, stops the hold. ${offsetNote}`
            : `The M114 Count check is in observe mode: it is traced, it never stops a hold (LUBAN_PENDANT_COUNT_CHECK=enforced turns it into a gate). ${offsetNote}`;
        const zNote = zProblem ? `Z jogs stay on the settled engine: ${zProblem}`
            : `Z rides the hold too (at most F${PENDANT_Z_FEED_MAX}): the first Z increment of each hold waits for the queue to drain and for an M114 `
                + 'inside the hold to agree with the hold\'s position; otherwise no Z word is sent and the hold closes.';
        const notice = problem ? null : ['Continuous jogging is on: one G53 when D1 is pressed, clock-paced increments while it is held, one G54 when it is',
            `released or anything stops the hold; at most ${HOLD_QUEUE_AHEAD_MS} ms of motion is queued ahead. Arming sent M220 S100, which STAYS`,
            'in force afterwards: a reduced touchscreen speed % is overridden for later file jobs too. Set it again before a job that relies on it.',
            'A touchscreen speed change made after arming is not corrected until the next arm (the Count trace shows the lag).',
            zNote, countNote].join(' ');
        this.pipeline = { ...this.pipeline,
            requested: true,
            disabled: problem ? `${problem} Settled jogs only.` : null,
            zDisabled: problem ? null : zProblem,
            notice };
        if (!problem && zProblem) { log.warn(`Continuous Z jog refused: ${zProblem}`); }
        if (problem) { log.warn(`Continuous jog refused: ${problem}`); } else {
            log.info(`Continuous jog enabled (Count check ${this.countCheck.mode}, steps/mm from ${this.countCheck.stepsPerMmSource}): ${notice}`);
        }
    }

    /**
     * Learn the Count-frame offset once per arm: one M114 while idle with the
     * reliable position of record ready() just admitted, offset = Count /
     * steps-per-mm - record machine position. Never compare Count to machine
     * coordinates without it (the trial A350 counts from its homing position,
     * X +19 Y +4 Z +0 mm, so a raw comparison would read a constant 19 mm
     * "lag" and enforced mode would stop every hold). No Count in the reply, or
     * a failed M114, leaves the offset unknown: observe mode then traces raw
     * Count only; enforced mode refuses to arm rather than gate on garbage.
     */
    private async learnCountOffset(): Promise<void> {
        let problem: string | null = null;
        try {
            const machine = this.position();
            const executed = await queryPositionReport('usb_pendant:count-offset');
            const report = executed.result === 0 ? parseCountReport(executed.text) : { position: null, count: null };
            if (report.count) {
                const offset = learnCountOffset(report.count, this.countCheck.stepsPerMm, machine, Date.now());
                this.countCheck = { ...this.countCheck, countOffset: offset, countOffsetProblem: null };
                log.info(`Count offset learned at arm: Count ${JSON.stringify(report.count)} / ${JSON.stringify(this.countCheck.stepsPerMm)} steps/mm at machine `
                    + `${JSON.stringify(machine)} -> offset X ${offset.x.toFixed(3)} Y ${offset.y.toFixed(3)} Z ${offset.z.toFixed(3)} mm.`);
            } else {
                problem = `the arm-time M114 carried no Count fields (result ${executed.result}: ${(executed.text || 'no text').slice(0, 120)})`;
            }
        } catch (err) {
            problem = `the arm-time M114 failed: ${(err as Error).message}`;
        }
        if (!problem) { return; }
        this.countCheck = { ...this.countCheck, countOffset: null, countOffsetProblem: problem };
        if (this.countCheck.mode === 'enforced') {
            throw new Error(`The M114 Count check is enforced but its offset could not be learned: ${problem}. Nothing gates on an unreadable Count; `
                + 'fix the controller reply or start Luban with LUBAN_PENDANT_COUNT_CHECK=observe.');
        }
        log.warn(`Count offset unknown: ${problem}. Count is traced raw only.`);
    }

    // A target whose Z differs from the head's by more than G-code rounding is a Z jog: it rides the
    // hold unless the firmware's Z limits kept Z holds off this arm (then the settled path).
    private pipelineEligible(from: JogPosition, target: JogTarget): boolean {
        if (!this.pipeline.requested || this.pipeline.disabled || getFrameLatch()) { return false; }
        if (this.pipeline.zDisabled && Math.abs(target.position.z - from.z) >= 0.001) { return false; }
        if (connectionManager.getConnectionStatus().protocol !== 'HTTP') { return false; }
        try { return this.positionFreshAgeMs() <= HOLD_HEARTBEAT_MAX_AGE_MS; } catch (err) { return false; }
    }

    /**
     * Whether a hold may open from `from` now: the first increment plus its
     * queued run-out must clear the obstacle map, judged here BEFORE the G53 so a
     * stick pointed at a box within one run-out does not open a hold that its
     * first increment closes again (six requests and a latch cycle at ~3 Hz). A
     * refused lookahead falls through to the settled path once (its clear
     * prefix, as the obstacle hold does) and keeps continuous jogging off until
     * the stick returns to neutral.
     */
    private holdAdmits(from: JogPosition, now: number): boolean {
        if (this.holdOffUntilNeutral) { return false; }
        const origin = this.holdOrigin(from);
        const raw = this.session.target(origin, now, 0, HOLD_MOVE_MS);
        if (!raw) { return false; }
        const capped = capZFeed(origin, raw.position, raw.feed, PENDANT_Z_FEED_MAX);
        const hit = this.holdLookahead(origin, this.holdPosition(origin, capped.to), capped.feed);
        if (!hit) { return true; }
        this.holdOffUntilNeutral = true;
        log.info(`Continuous jog not started: the first increment plus ${holdRunoutMm(capped.feed).toFixed(2)} mm of queued run-out at F${capped.feed} `
            + `would reach ${hit.box.name}; settled jogs until the stick returns to neutral.`);
        return false;
    }

    // The hold's dead-reckoned origin: the press position at G-code precision (the
    // heartbeat carries more decimals than a G1 can state).
    private holdOrigin(from: JogPosition): JogPosition {
        return { x: Number(from.x.toFixed(3)), y: Number(from.y.toFixed(3)), z: Number(from.z.toFixed(3)) };
    }

    /**
     * The hold's obstacle test, side-effect free: the increment from `chain` to
     * `position` (holdPosition) plus the maximum queued run-out beyond it
     * (HOLD_QUEUE_AHEAD_MS at the increment's feed, along its own direction, Z
     * included, clipped to the envelope), or `chain` itself inside an exclusion
     * below its required Z. Inside one, a straight Z-up climb (isStraightZUp) is
     * the one increment that is clear, as on the settled path. Null when clear.
     */
    private holdLookahead(chain: JogPosition, position: JogPosition, feed: number): { box: ObstacleExclusion; inside: boolean } | null {
        const bounds = this.session.bounds as JogBounds;
        const boxes = this.obstacleExclusions();
        const inside = this.obstacleHit(chain, chain, boxes);
        if (inside && !isStraightZUp(chain, position)) { return { box: inside, inside: true }; }
        const lookahead = this.gcodePrecision(extendAlong(chain, position, holdRunoutMm(feed)), bounds);
        // An X/Y increment's run-out stays at its own Z (the clamp must not invent a Z component).
        if (position.z === chain.z) { lookahead.z = chain.z; }
        const hit = this.obstacleHit(chain, lookahead, boxes, true);
        return hit ? { box: hit, inside: false } : null;
    }

    /**
     * An increment's end at G-code precision inside the armed envelope. Z
     * follows the stick only when it asks for Z, and never against it: a head
     * that reads a hair outside the Z bounds is not moved in Z by the envelope
     * clamp (the clamped Z is replaced by the chain's own whenever it would
     * reverse or cancel the request).
     */
    private holdPosition(chain: JogPosition, requested: JogPosition): JogPosition {
        const position = this.gcodePrecision(requested, this.session.bounds as JogBounds);
        const asked = requested.z - chain.z;
        const got = position.z - chain.z;
        if (Math.abs(asked) < 0.001 || Math.abs(got) < 0.001 || Math.sign(got) !== Math.sign(asked)) { position.z = chain.z; }
        return position;
    }

    // G-code precision (three decimals), kept inside the armed envelope.
    private gcodePrecision(p: JogPosition, bounds: JogBounds): JogPosition {
        const out = { ...p };
        for (const axis of ['x', 'y', 'z'] as const) {
            const r = Math.max(Math.ceil(bounds[`${axis}Min`] * 1000), Math.min(Math.floor(bounds[`${axis}Max`] * 1000), Math.round(p[axis] * 1000)));
            out[axis] = Number((r / 1000).toFixed(3));
        }
        return out;
    }

    /**
     * The next hold increment from `chain` (the pendant's own dead-reckoned
     * commanded position: the press position plus every increment sent), or
     * null to STOP the hold with `this.blocked` set. Obstacles stop the hold
     * instead of disarming, as the settled path holds. The obstacle test covers
     * the increment AND the maximum queued run-out beyond it (HOLD_QUEUE_AHEAD_MS
     * at the increment's feed, clipped to the envelope), so motion already
     * queued when the stop is decided can never enter an exclusion. Inside an
     * exclusion below its required Z only a straight Z-up climb is sent, with
     * its X/Y pinned to the chain's (the settled path's exit, inside the hold).
     * An increment with a Z component runs at most F PENDANT_Z_FEED_MAX
     * (capZFeed), whatever the frame asked for.
     */
    private holdTarget(chain: JogPosition, raw: JogTarget): JogTarget | null {
        const capped = capZFeed(chain, raw.position, raw.feed, PENDANT_Z_FEED_MAX);
        const position = this.holdPosition(chain, capped.to);
        const distanceMm = Math.hypot(position.x - chain.x, position.y - chain.y, position.z - chain.z);
        if (distanceMm < 0.001) { this.blocked = null; return null; }
        const found = this.holdLookahead(chain, position, capped.feed);
        if (!found) {
            const inside = isStraightZUp(chain, position) ? this.obstacleHit(chain, chain, this.obstacleExclusions()) : null;
            if (inside) {
                // Climbing out: exactly vertical, and the DRO keeps saying where it is.
                position.x = chain.x;
                position.y = chain.y;
                this.blocked = this.insideBlocked(inside, chain.z);
            } else {
                this.blocked = null;
            }
            const distance = Math.hypot(position.x - chain.x, position.y - chain.y, position.z - chain.z);
            return { position, feed: capped.feed, durationMs: distance / capped.feed * 60000, distanceMm: distance };
        }
        if (found.inside) {
            const inside = found.box;
            this.blocked = this.insideBlocked(inside, chain.z);
            if (!this.blockedLogged.has(inside.name)) {
                this.blockedLogged.add(inside.name);
                log.info(`Continuous jog held inside ${inside.name} at machine Z ${chain.z.toFixed(3)} mm: only a straight Z-up exit is sent until the toolhead leaves it. Still armed.`);
            }
            return null;
        }
        const hit = found.box;
        const requestedZ = Number(Math.min(chain.z, position.z).toFixed(3));
        const need = hit.requiredZ === null ? 'no entry, tool clearance unknown' : `Z>=${zUp(hit.requiredZ)} (asked ${zDown(requestedZ)})`;
        this.blocked = { name: hit.name, requiredZ: hit.requiredZ, requestedZ, held: true, inside: false, text: `BLOCKED ${hit.name}: ${need}` };
        if (!this.blockedLogged.has(hit.name)) {
            this.blockedLogged.add(hit.name);
            const needed = hit.requiredZ === null ? 'tool clearance is unknown; the region is excluded'
                : `requires machine Z at or above ${hit.requiredZ.toFixed(3)} mm`;
            log.info(`Continuous jog held at ${hit.name}: ${needed}; the next increment plus ${holdRunoutMm(capped.feed).toFixed(2)} mm of queued run-out `
                + `at F${capped.feed} would reach it at machine Z ${requestedZ.toFixed(3)} mm. Still armed; nothing further was sent. Later refusals at this obstacle are not logged until the next arm.`);
        }
        return null;
    }

    /** Why `session.target()` returned nothing: the stop reason the hold records. */
    private holdReleaseReason(now: number): string {
        const latest = this.session.latest;
        if (!this.session.armed) { return 'disarmed'; }
        if (now - this.session.receivedAt > HOLD_FEATHER_GAP_MS) { return `Feather report gap ${now - this.session.receivedAt} ms (limit ${HOLD_FEATHER_GAP_MS} ms)`; }
        if (!latest || !latest.ready || latest.feedback_ok === false) { return 'Feather not ready'; }
        if (!latest.deadman) { return 'D1 released'; }
        if (Math.hypot(latest.x, latest.y, latest.z) < 0.01) { return 'stick centred'; }
        if (this.session.limitedAxes.length) { return `at the approved ${this.session.limitedAxes.join('/')} limit`; }
        return 'input released or stale';
    }

    private recordHoldTick(tick: HoldTick): void {
        if (this.holdTicks.length >= HOLD_TRACE_LIMIT) { this.holdTicks.shift(); }
        this.holdTicks.push(tick);
        if (!traceEnabled()) { return; }
        let body = tick.reason || '';
        if (tick.kind === 'send') {
            body = `sent X${tick.sent?.x} Y${tick.sent?.y}${tick.zWord ? ` Z${tick.sent?.z}` : ''} F${tick.feed} reply ${tick.replyMs} ms`;
        } else if (tick.kind === 'baseline' && tick.baseline) {
            const b = tick.baseline;
            body = `Z baseline M114 ${JSON.stringify(b.position)} chain ${JSON.stringify(b.chain)} reply ${b.execMs} ms ${b.problem ? `REFUSED ${b.problem}` : 'agreed'}`;
        } else if (tick.kind === 'count' && tick.count) {
            const c = tick.count;
            body = `count ${JSON.stringify(c.count)} raw ${JSON.stringify(c.rawMm)} derived ${JSON.stringify(c.derived)} expected ${JSON.stringify(c.expected)} `
                + `lag ${c.lagMm === null ? 'n/a' : c.lagMm.toFixed(3)} mm reply ${c.execMs} ms${c.late ? ' LATE' : ''}${c.error ? ` error ${c.error}` : ''}`;
        }
        trace(`[hold] ${tick.kind} outstanding ${tick.outstandingMs} ms input age ${tick.inputAgeMs} ms ${body}`);
    }

    /**
     * One M114 during the hold, through the same lease. Fire-and-forget from the
     * tick loop (the HTTP channel serializes it behind the G1 in flight); the
     * sample is traced, shown in /pendant/status, and in 'enforced' mode becomes
     * the hold's fault. The expected executed position is the clock model's at
     * the send time. A prompt reply (HOLD_FRESH_REPLY_MS) whose X/Y/Z (machine
     * coordinates inside G53) agree with `chain`, the commanded position at the
     * send time (holdPositionAgrees), is position freshness for readyInHold.
     */
    private async pollCount(leased: <T>(fn: () => Promise<T>) => Promise<T>, model: HoldQueueModel, chain: JogPosition, feed: number,
        inputAgeMs: number): Promise<string | null> {
        const sentAt = Date.now();
        const expected = model.expectedAt(sentAt);
        const commanded = { ...chain };
        const moveMm = holdMoveMm(feed);
        let sample: CountSample;
        try {
            const executed = await leased(async () => queryPositionReport('usb_pendant:count'));
            const execMs = Date.now() - sentAt;
            const report = executed.result === 0 ? parseCountReport(executed.text) : { position: null, count: null };
            const { stepsPerMm, countOffset } = this.countCheck;
            const rawMm = report.count ? countToMm(report.count, stepsPerMm) : null;
            const derived = report.count && countOffset ? countToMachine(report.count, stepsPerMm, countOffset) : null;
            const judged = judgeCountSample(derived, expected, moveMm, POSITION_EPSILON_MM);
            const fresh = executed.result === 0 && execMs <= HOLD_FRESH_REPLY_MS
                && holdPositionAgrees(report.position, commanded, expected, moveMm, POSITION_EPSILON_MM);
            if (fresh) { this.m114FreshAt = Math.max(this.m114FreshAt, sentAt); }
            sample = { at: sentAt,
                fresh,
                execMs,
                late: execMs > HOLD_TICK_MS,
                count: report.count,
                rawMm,
                derived,
                position: report.position,
                expected,
                lagMm: judged.lagMm,
                off: judged.off,
                error: executed.result === 0 ? null : `controller result ${executed.result}: ${executed.text || 'no text'}` };
        } catch (err) {
            sample = { at: sentAt,
                fresh: false,
                execMs: Date.now() - sentAt,
                late: false,
                count: null,
                rawMm: null,
                derived: null,
                position: null,
                expected,
                lagMm: null,
                off: false,
                error: (err as Error).message };
        }
        this.countCheck.last = sample;
        this.recordHoldTick({ at: sample.at, kind: 'count', outstandingMs: Math.round(model.outstandingMs(Date.now())), inputAgeMs, count: sample });
        return countFault(sample, moveMm);
    }

    /**
     * The hold's Z baseline, taken once per hold before its first Z word, with
     * nothing queued by the clock model and no other M114 in flight: one M114
     * through the hold's lease (the same serialized channel as the Count poll),
     * inside G53, whose X/Y/Z must agree with `chain` within POSITION_EPSILON_MM
     * on every axis (zBaselineProblem). The chain's Z came from the heartbeat
     * record; this is what turns it into a controller-confirmed machine Z.
     * Returns null when Z words may be sent, else the refusal: no Z word is sent
     * and the caller closes the hold.
     */
    private async zBaseline(leased: <T>(fn: () => Promise<T>) => Promise<T>, chain: JogPosition, inputAgeMs: number): Promise<string | null> {
        const sentAt = Date.now();
        let position: JogPosition | null = null;
        let problem: string | null;
        try {
            const executed = await leased(async () => queryPositionReport('usb_pendant:z-baseline'));
            position = executed.result === 0 ? parseCountReport(executed.text).position : null;
            problem = executed.result === 0 ? zBaselineProblem(position, chain, POSITION_EPSILON_MM)
                : `the M114 failed (controller result ${executed.result}: ${executed.text || 'no text'})`;
        } catch (err) {
            problem = `the M114 failed: ${(err as Error).message}`;
        }
        const execMs = Date.now() - sentAt;
        if (!problem && execMs <= HOLD_FRESH_REPLY_MS) { this.m114FreshAt = Math.max(this.m114FreshAt, sentAt); }
        this.recordHoldTick({ at: sentAt, kind: 'baseline', outstandingMs: 0, inputAgeMs, baseline: { position, chain: { ...chain }, execMs, problem } });
        if (problem) {
            log.warn(`Continuous jog: no Z word sent, the hold's Z could not be confirmed: ${problem}. The hold closes; Z jogs use the settled engine until the stick returns to neutral.`);
        } else {
            log.info(`Continuous jog: Z baseline agreed (M114 ${JSON.stringify(position)} vs chain ${JSON.stringify(chain)}, ${execMs} ms); Z words follow.`);
        }
        return problem;
    }

    /**
     * Continuous X/Y/Z jogging (opt-in): ONE hold from D1 press to release or to
     * any stop, inside one gcode lease acquisition (machine/gcodeLease.ts).
     *  - One G53 at the press (latched BEFORE it is sent, so a lost reply still
     *    counts) and one G54 at the stop, through the shared restore path
     *    (sendWorkFrameRestore -> noteFrameRestored; verifyRestoredPosition's
     *    M114 or a verified work-frame beat clears the latch; a failed restore
     *    hands the lease to the recovery hold, which IS the latch).
     *  - Clock pacing: every HOLD_TICK_MS one G1 worth HOLD_MOVE_MS at the
     *    current feed, following the Feather's latest report, with at most
     *    HOLD_QUEUE_AHEAD_MS queued ahead by the clock model (pendantHold.ts
     *    HoldQueueModel) and every G1 reply awaited before the next is sent.
     *  - Every increment is checked against the reviewed envelope (travel
     *    +/- TRAVEL_FILL_MM, never clipped back) and the obstacle map including
     *    the queued run-out, from the pendant's own dead-reckoned commanded
     *    position, never from the position of record: beats sampled inside the
     *    G53 window are set aside by design, so the record holds at the press
     *    position for the whole hold.
     *  - Stops at once (nothing further sent, then the G54) on: D1 release, a
     *    centred stick, a Feather report gap over HOLD_FEATHER_GAP_MS, page
     *    keepalive loss, a G1 reply error, timeout or rejection, a late reply
     *    (a streak of HOLD_LATE_EVENTS_TO_DISABLE also turns continuous jogging
     *    off until re-arm), any lease refusal, a crash or overtravel alarm, a
     *    connection generation change, the latch changing under it, a non-idle
     *    controller, and (in 'enforced' mode) the Count check. At most the
     *    queued motion runs out.
     *  - Z: X/Y increments carry no Z word (queueMachineMove omitZ): until it is
     *    proved, the hold's Z is the heartbeat-derived record Z, and a wrong
     *    reused offset must fail the close's M114 proof, not move Z. Before the
     *    first increment with a Z component the hold drains its queue and sends
     *    one M114 inside G53 (zBaseline); only if its machine X/Y/Z agree with
     *    the chain within POSITION_EPSILON_MM do Z increments (`G1 X Y Z F`, at
     *    most F PENDANT_Z_FEED_MAX) follow. Otherwise nothing with Z is sent and
     *    the hold closes. Z-down is held at obstacles like X/Y (the lookahead
     *    includes the Z run-out); a straight Z-up climb leaves an exclusion.
     *  - M114 is polled every HOLD_COUNT_POLL_MS while moving and every
     *    HOLD_IDLE_POLL_MS while idle, through the same lease, and traced;
     *    'observe' (default) never gates. A prompt reply that agrees with the
     *    hold is position freshness for readyInHold's age check.
     *  - The close's work-frame M114 proof is retried; a close that still is not
     *    proved is proved on demand by the next press (proveLastHoldClose).
     */
    private async continuousHold(from: JogPosition): Promise<void> {
        const bounds = this.session.bounds as JogBounds;
        const startedAt = Date.now();
        let leaseId: number;
        try {
            leaseId = gcodeLease.acquire('the USB pendant (continuous jog)', PIPELINE_LEASE_TTL_MS, Date.now(), PIPELINE_REQUEST_TIMEOUT_MS);
        } catch (err) {
            this.disarm(`Continuous jog refused: ${(err as Error).message}`);
            return;
        }
        const leased = async <T>(fn: () => Promise<T>): Promise<T> => {
            gcodeLease.renew(leaseId, PIPELINE_LEASE_TTL_MS);
            return gcodeLease.runAs(leaseId, fn);
        };
        // The dead-reckoned commanded position starts at the press position; every
        // increment is checked and sent from here, never from the position of record.
        const origin = this.holdOrigin(from);
        const model = new HoldQueueModel(origin);
        const summary: HoldSummary = { startedAt,
            stopReason: 'input released',
            moves: 0,
            distanceMm: 0,
            commandedMs: 0,
            maxOutstandingMs: 0,
            feed: 0,
            elapsedMs: 0,
            countSamples: 0,
            maxLagMm: null,
            lateCountReplies: 0,
            lateMoveReplies: 0,
            restored: false,
            proved: null,
            zMoves: 0,
            zBaseline: null };
        let chain = origin;
        let idleSince: number | null = null;
        // Z words only after this hold's in-hold M114 agreed with the chain (zBaseline).
        let zProved = false;
        let zPrefetched = false;
        this.lastProvedPosition = null;
        this.lastHoldClose = null;
        let entered = false;
        let restored = false;
        let uncertain = false;
        let latchSince: number | null = null;
        let latchReason: string | null = null;
        // The fire-and-forget M114 in flight (an object property, so TypeScript does not narrow it away).
        const poll: { pending: Promise<void> | null } = { pending: null };
        let countStop: string | null = null;
        let countStopLate = false;
        let lateEvent = false;
        let consecutiveLate = 0;
        let lastCountAt = -Infinity;
        // One fire-and-forget M114 (Count, and position freshness) when the last is this old.
        const pollEvery = (now: number, everyMs: number, feed: number, inputAgeMs: number): void => {
            if (poll.pending || now - lastCountAt < everyMs) { return; }
            lastCountAt = now;
            poll.pending = this.pollCount(leased, model, chain, feed, inputAgeMs).then((fault) => {
                summary.countSamples += 1;
                const last = this.countCheck.last;
                if (last?.late) { summary.lateCountReplies += 1; }
                if (last && last.lagMm !== null) { summary.maxLagMm = Math.max(summary.maxLagMm ?? 0, last.lagMm); }
                if (fault && this.countCheck.mode === 'enforced' && !countStop) { countStop = fault; countStopLate = last?.late === true; }
            }).finally(() => { poll.pending = null; });
        };
        this.busy = true;
        this.pipeline.active = true;
        this.holdTicks = [];
        probeFeedService.motionBegin();
        try {
            try {
                // Latched and marked BEFORE the send: a lost reply may still have selected G53.
                latchFrameUncertain('A continuous USB pendant jog selected the machine workspace (G53).');
                latchSince = getFrameLatch()?.since ?? null;
                latchReason = getFrameLatch()?.reason ?? null;
                entered = true;
                await leased(async () => enterMachineFrame('usb_pendant'));
                declareMachineFrameRun(bounds, Date.now() + PIPELINE_DECLARE_GUARD_MS);
                let nextTickAt = Date.now();
                for (;;) {
                    let now = Date.now();
                    const inputAgeMs = now - this.session.receivedAt;
                    this.watchdog(now);
                    if (!this.session.armed) { summary.stopReason = 'disarmed'; break; }
                    const latch = getFrameLatch();
                    if (!latch || latch.since !== latchSince || latch.reason !== latchReason) {
                        summary.stopReason = latch ? `the frame latch was raised by something else (${latch.reason})` : 'the frame latch was cleared under the hold';
                        break;
                    }
                    const notReady = this.readyInHold();
                    if (notReady) { summary.stopReason = notReady; break; }
                    if (countStop) {
                        summary.stopReason = countStop;
                        if (countStopLate) {
                            lateEvent = true;
                            this.noteLateEvent(`Continuous jog stopped: ${countStop}.`);
                        } else {
                            this.pipeline.disabled = `Continuous jog stopped: ${countStop}; settled jogs until re-armed.`;
                            log.warn(`Continuous jog: ${this.pipeline.disabled}`);
                        }
                        break;
                    }
                    if (inputAgeMs > HOLD_FEATHER_GAP_MS) { summary.stopReason = this.holdReleaseReason(now); break; }
                    const raw = this.session.target(chain, now, 0, HOLD_MOVE_MS);
                    if (!raw) {
                        const reason = this.holdReleaseReason(now);
                        // D1 still held, stick centred: idle in G53 so a reversal needs no close/re-entry.
                        if (reason === 'stick centred') {
                            if (idleSince === null) { idleSince = now; }
                            if (now - idleSince < HOLD_IDLE_CLOSE_MS) {
                                // Idle with nothing queued: take the Z baseline now, once, so a first Z twist
                                // streams at once instead of draining and proving first.
                                if (!zProved && !zPrefetched && !this.zRefused && !this.pipeline.zDisabled
                                    && model.outstandingMs(now) <= 0 && !poll.pending) {
                                    zPrefetched = true;
                                    const problem = await this.zBaseline(leased, chain, inputAgeMs);
                                    summary.zBaseline = problem || 'agreed';
                                    if (problem) {
                                        summary.stopReason = `no Z word sent: ${problem}`;
                                        this.holdOffUntilNeutral = true;
                                        this.zRefused = problem;
                                        log.warn(`Z jogging refused until re-arm: the in-hold M114 baseline disagreed (${problem}).`);
                                        break;
                                    }
                                    zProved = true;
                                    continue;
                                }
                                // Idle in G53: keep proving the position so the hold never ages out waiting for a beat.
                                // Only when the freshest evidence is going stale (a tick early, as the loop looks again a
                                // tick from now), so an idle M114 is rarely in flight ahead of the first increment.
                                if (this.positionFreshAgeMs() > HOLD_IDLE_POLL_MS - HOLD_TICK_MS) { pollEvery(now, 0, summary.feed, inputAgeMs); }
                                nextTickAt = Math.max(nextTickAt, now) + HOLD_TICK_MS;
                                await this.idleSleep(Math.max(0, nextTickAt - now));
                                continue;
                            }
                            summary.stopReason = `stick centred for ${HOLD_IDLE_CLOSE_MS} ms`;
                            break;
                        }
                        summary.stopReason = reason;
                        break;
                    }
                    idleSince = null;
                    if (this.pipeline.zDisabled && raw.position.z !== chain.z) { summary.stopReason = `Z motion uses settled jogs: ${this.pipeline.zDisabled}`; break; }
                    if (this.zRefused && raw.position.z !== chain.z) {
                        summary.stopReason = `Z refused until re-arm: ${this.zRefused}`;
                        this.holdOffUntilNeutral = true;
                        break;
                    }
                    const target = this.holdTarget(chain, raw);
                    if (!target) { summary.stopReason = this.blocked ? `held at ${this.blocked.name}` : this.holdReleaseReason(now); break; }
                    const zWord = Math.abs(target.position.z - chain.z) >= 0.001;
                    if (zWord && !zProved) {
                        // The first Z word of the hold waits for the clock model's queue to drain and
                        // for any Count poll in flight, sending nothing, then proves the chain with M114.
                        if (model.outstandingMs(now) > 0 || poll.pending) {
                            this.recordHoldTick({ at: now, kind: 'wait', outstandingMs: Math.round(model.outstandingMs(now)), inputAgeMs, reason: 'Z baseline: draining' });
                            nextTickAt = Math.max(nextTickAt, now) + HOLD_TICK_MS;
                            await sleep(Math.max(0, Math.min(nextTickAt, model.endsAtMs) - now));
                            continue;
                        }
                        const problem = await this.zBaseline(leased, chain, inputAgeMs);
                        summary.zBaseline = problem || 'agreed';
                        if (problem) {
                            summary.stopReason = `no Z word sent: ${problem}`;
                            this.holdOffUntilNeutral = true;
                            this.zRefused = problem;
                            log.warn(`Z jogging refused until re-arm: the in-hold M114 baseline disagreed (${problem}).`);
                            break;
                        }
                        zProved = true;
                        continue; // Re-sample the stick and every stop condition after the round trip.
                    }
                    const execMs = target.durationMs;
                    if (model.admits(now, execMs)) {
                        this.validateEnvelope(bounds, chain);
                        this.validateJogSegment(chain, target.position);
                        if (zWord && target.feed > PENDANT_Z_FEED_MAX) { throw new Error(`Continuous jog refused a Z increment at F${target.feed} (Z limit F${PENDANT_Z_FEED_MAX}).`); }
                        const sentAt = Date.now();
                        uncertain = true;
                        // X/Y increments omit the Z word; a Z increment carries the proved chain's Z.
                        await leased(async () => queueMachineMove('usb_pendant', target.position, target.feed, { omitZ: !zWord }));
                        uncertain = false;
                        if (zWord) { summary.zMoves += 1; }
                        now = Date.now();
                        const replyMs = now - sentAt;
                        model.sent(sentAt, chain, target.position, execMs);
                        chain = target.position;
                        summary.moves += 1;
                        summary.distanceMm += target.distanceMm;
                        summary.commandedMs += execMs;
                        summary.feed = target.feed;
                        summary.maxOutstandingMs = Math.max(summary.maxOutstandingMs, model.outstandingMs(sentAt));
                        this.recordHoldTick({ at: sentAt,
                            kind: 'send',
                            outstandingMs: Math.round(model.outstandingMs(now)),
                            inputAgeMs,
                            sent: target.position,
                            zWord,
                            feed: target.feed,
                            replyMs });
                        if (replyMs > HOLD_REPLY_LATE_MS) { consecutiveLate += 1; } else { consecutiveLate = 0; }
                        if (replyMs > HOLD_REPLY_LATE_MS) { summary.lateMoveReplies += 1; }
                        // One Wi-Fi hiccup is tolerated: the queue model is paced by send time, so a
                        // late reply never admits extra motion. Stop on a very late reply or a streak.
                        if (replyMs > HOLD_REPLY_STOP_MS || consecutiveLate >= HOLD_LATE_REPLIES_TO_STOP) {
                            summary.stopReason = 'late acknowledgement';
                            lateEvent = true;
                            this.noteLateEvent(`Continuous jog stopped: a queued increment took ${replyMs} ms to be acknowledged (limit ${HOLD_REPLY_LATE_MS} ms): `
                                + 'the controller is holding requests.');
                            break;
                        }
                        continue; // The cap may admit another increment at once (priming); re-check first.
                    }
                    pollEvery(now, HOLD_COUNT_POLL_MS, summary.feed || target.feed, inputAgeMs);
                    this.recordHoldTick({ at: now, kind: 'wait', outstandingMs: Math.round(model.outstandingMs(now)), inputAgeMs });
                    // Wake when the cap admits the next increment, and at least every tick for the stop checks.
                    nextTickAt = Math.max(nextTickAt, now) + HOLD_TICK_MS;
                    const admitAt = model.endsAtMs - (HOLD_QUEUE_AHEAD_MS - execMs);
                    await sleep(Math.max(0, Math.min(nextTickAt, admitAt) - now));
                }
            } catch (err) {
                summary.stopReason = (err as Error).message;
                this.disarm((err as Error).message);
            }
            this.recordHoldTick({ at: Date.now(), kind: 'stop', outstandingMs: Math.round(model.outstandingMs(Date.now())), inputAgeMs: Date.now() - this.session.receivedAt, reason: summary.stopReason });
            if (entered) {
                // Nothing further is sent. Close with the shared restore: its G54 waits for
                // anything still queued (at most HOLD_QUEUE_AHEAD_MS), then M114 proves the
                // commanded end position in the work frame so the latch clears without
                // waiting for a beat. Any failure leaves the latch up and the lease held for recovery.
                try {
                    const result = await leased(async () => sendWorkFrameRestore('usb_pendant:hold-close'));
                    restored = result.result === 0;
                    if (!restored) { throw new Error(result.text || 'Controller refused the work-frame restore.'); }
                    if (!uncertain) {
                        // The proof is retried (HOLD_CLOSE_PROOF_ATTEMPTS, HOLD_CLOSE_PROOF_RETRY_MS apart)
                        // before falling back to a beat: each try is one read-only M114 under the lease.
                        for (let attempt = 0; attempt < HOLD_CLOSE_PROOF_ATTEMPTS && !summary.proved; attempt += 1) {
                            if (attempt) { await sleep(HOLD_CLOSE_PROOF_RETRY_MS); }
                            const proofAt = Date.now();
                            try {
                                summary.proved = await leased(async () => verifyRestoredPosition('usb_pendant:hold-close', chain));
                            } catch (err) {
                                summary.proved = false;
                                log.warn(`Continuous jog: M114 did not verify the commanded end position (try ${attempt + 1}): ${(err as Error).message}`);
                            }
                            if (summary.proved) {
                                this.lastProvedPosition = { ...chain };
                                this.m114FreshAt = Math.max(this.m114FreshAt, proofAt);
                            }
                        }
                        if (!summary.proved) {
                            this.lastHoldClose = { chain: { ...chain }, latchSince };
                            log.warn(`Continuous jog: ${HOLD_CLOSE_PROOF_ATTEMPTS} M114 tries did not verify the commanded end position in the work frame; `
                                + 'the next press proves it on demand, else a verified beat clears it.');
                        }
                    }
                } catch (err) {
                    this.disarm(`Continuous jog could not restore the work frame: ${(err as Error).message} The machine workspace may `
                        + 'still be selected and queued motion may still be running. Motion stays refused; use Restore work frame.');
                } finally {
                    endMachineFrameRun();
                }
                if (poll.pending) { await poll.pending.catch(() => undefined); }
            }
        } finally {
            endMachineFrameRun();
            if (!entered || restored) {
                gcodeLease.release(leaseId);
            } else {
                // The machine workspace may still be selected: refuse everything but recovery
                // (restore, homing, position queries, job stop) until the latch clears. The
                // hold IS the latch; this re-raises it if a beat cleared it meanwhile.
                gcodeLease.holdForRecovery('a continuous pendant jog could not restore the work frame', leaseId);
            }
            // The crash guard stays armed while queued motion may still be running.
            if (!entered || restored) { probeFeedService.motionEnd(); } else { this.heldMotionGuard += 1; }
            if (entered && restored) { this.postHoldGraceUntil = Date.now() + HOLD_POST_CLOSE_GRACE_MS; }
            summary.restored = restored;
            summary.elapsedMs = Date.now() - startedAt;
            summary.maxOutstandingMs = Math.round(summary.maxOutstandingMs);
            this.pipeline.active = false;
            this.pipeline.lastHold = summary;
            if (!lateEvent) { this.lateStreak = 0; }
            if (this.blocked?.held && /^held at /.test(summary.stopReason)) { this.holdOffUntilNeutral = true; }
            log.info(`Continuous jog hold ended: ${JSON.stringify(summary)}`);
            if (summary.moves) {
                this.lastJog = { durationMs: summary.commandedMs, distanceMm: summary.distanceMm, feed: summary.feed, elapsedMs: summary.elapsedMs };
            }
            this.busy = false;
            this.release();
        }
    }

    /** A late reply stops the hold it happens in; only a streak of them turns continuous jogging off until re-arm. */
    private noteLateEvent(what: string): void {
        this.lateStreak += 1;
        if (this.lateStreak >= HOLD_LATE_EVENTS_TO_DISABLE) {
            this.pipeline.disabled = `${what} ${this.lateStreak} late replies in a row; settled jogs until re-armed.`;
            log.warn(`Continuous jog: ${this.pipeline.disabled}`);
        } else {
            log.warn(`${what} Late reply ${this.lateStreak} of ${HOLD_LATE_EVENTS_TO_DISABLE} before continuous jogging is turned off until re-arm.`);
        }
    }

    /** A later successful work-frame restore proves queued motion ended (G54 synchronizes). */
    private releaseHeldMotionGuard(): void {
        for (; this.heldMotionGuard > 0; this.heldMotionGuard -= 1) { probeFeedService.motionEnd(); }
    }

    /** Stops jogging and resolves once any continuous hold has closed and restored its frame. */
    public async shutdown(): Promise<void> {
        this.disarm('USB pendant closed.');
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        const port = this.port;
        this.port = null;
        this.buffer = '';
        this.feedbackWritePending = false;
        if (port?.isOpen) { port.close(); }
        if (this.holdPromise) { await this.holdPromise.catch(() => undefined); }
    }

    private defaultBounds(): JogBounds | null {
        try {
            const p = this.position();
            const travel = this.travelBounds();
            return { xMin: Math.max(travel.xMin, p.x - 5),
                xMax: Math.min(travel.xMax, p.x + 5),
                yMin: Math.max(travel.yMin, p.y - 5),
                yMax: Math.min(travel.yMax, p.y + 5),
                zMin: 280,
                zMax: 329 };
        } catch (err) { return null; }
    }

    public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
        const reply = (status: number, body: object) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        // Manual authority stays loopback-only even if the MCP listener permits LAN clients.
        const host = req.headers.host || '';
        if (!isLoopback(req.socket.remoteAddress) || !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)
            || (req.headers.origin && new URL(req.headers.origin).host !== host)) {
            reply(403, { error: 'USB manual control is local and same-origin only.' }); return;
        }
        if (req.method === 'GET' && url.pathname === '/pendant') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Frame-Options': 'DENY',
                'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
            res.end(pendantPage(this.token)); return;
        }
        if (req.method === 'GET' && url.pathname === '/pendant/status') {
            let travelBounds: JogBounds | null = null;
            try { travelBounds = this.travelBounds(); } catch (err) { /* Unknown travel is shown explicitly. */ }
            reply(200, { armed: this.session.armed,
                neutral: this.session.neutral,
                busy: this.busy,
                recovery: this.recovery,
                maxSegmentMs: this.session.maxSegmentMs,
                limitedAxes: this.session.limitedAxes,
                lastJog: this.lastJog,
                // feedOverride: the last accepted M220 S<n> on the direct path; it persists
                // on the controller after the hold, armed or not, until it is set again.
                // countCheck: the M114 Count check's mode, steps/mm and last sample (lag = the
                // last Count delta from the clock model's expected executed position).
                pipeline: { ...this.pipeline,
                    feedOverride: getFeedOverride(),
                    lateEvents: this.lateStreak,
                    holdOffUntilNeutral: this.holdOffUntilNeutral,
                    // Age of the last prompt M114 that agreed with a hold or proved a close (null: none this arm).
                    m114FreshAgeMs: Number.isFinite(this.m114FreshAt) ? Date.now() - this.m114FreshAt : null,
                    idlePollMs: HOLD_IDLE_POLL_MS,
                    countCheck: { ...this.countCheck,
                        countOffsetMm: this.countCheck.countOffset
                            ? { x: this.countCheck.countOffset.x, y: this.countCheck.countOffset.y, z: this.countCheck.countOffset.z } : null,
                        countOffsetLearnedAt: this.countCheck.countOffset?.learnedAt ?? null,
                        tickMs: HOLD_TICK_MS,
                        moveMs: HOLD_MOVE_MS,
                        queueAheadMs: HOLD_QUEUE_AHEAD_MS,
                        countPollMs: HOLD_COUNT_POLL_MS,
                        lastLagMm: this.countCheck.last?.lagMm ?? null } },
                inputAgeMs: Date.now() - this.session.receivedAt,
                port: this.port?.path || null,
                firmware: this.firmware ?? null,
                trace: traceEnabled(),
                input: this.session.latest,
                error: this.error,
                blocked: this.blocked,
                dro: this.dro(),
                bounds: this.session.bounds,
                defaultBounds: this.defaultBounds(),
                travelBounds,
                obstacleExclusions: this.obstacleExclusions(),
                settings: pendantSettings(),
                ports: await this.cachedPorts() }); return;
        }
        if (req.method === 'GET' && url.pathname === '/pendant/hold-trace') {
            // Per-tick records of the current or last continuous hold: what was sent, how much
            // the clock model had outstanding, the Feather report age, and every M114 Count sample.
            reply(200, { active: this.pipeline.active, hold: this.pipeline.lastHold, countCheck: this.countCheck, ticks: this.holdTicks }); return;
        }
        if (req.method !== 'POST' || req.headers['x-pendant-token'] !== this.token) {
            reply(403, { error: 'Use the local operator page.' }); return;
        }
        let body = '';
        for await (const chunk of req) {
            body += chunk.toString();
            if (body.length > 4096) { reply(413, { error: 'Request too large.' }); return; }
        }
        try {
            const args = JSON.parse(body || '{}');
            switch (url.pathname) {
                case '/pendant/connect':
                    await this.connect(String(args.path || '')); break;
                case '/pendant/arm': {
                    if (!this.port?.isOpen || this.busy || Date.now() - this.session.receivedAt > 300) {
                        throw new Error('No recent USB input, or a jog is still settling.');
                    }
                    if (this.feedbackHealthy === false) {
                        throw new Error('Wait for the Feather to acknowledge host feedback within one second before arming.');
                    }
                    if (args.clearanceConfirmed !== true) { throw new Error('Review and confirm the entire envelope.'); }
                    const latch = getFrameLatch();
                    if (latch) {
                        throw new Error(`The machine frame is uncertain (${latch.reason}). Use Restore work frame and wait for a verified position.`);
                    }
                    this.ready();
                    const bounds = this.reviewedBounds(args.bounds);
                    const current = this.position();
                    // Arming inside an exclusion is allowed so the pendant can climb out:
                    // until it leaves, only a straight Z-up exit is sent (see obstacleSafeTarget).
                    const inside = this.obstacleHit(current, current, this.obstacleExclusions());
                    manualControlGate.acquire(() => this.disarm('Stopped through MCP.'));
                    this.owned = true;
                    this.session.arm(bounds, this.position(), Date.now(), args.maxSegmentMs ?? 500);
                    this.zRefused = null;
                    this.pipeline = { ...this.pipeline, requested: false, disabled: null };
                    this.epoch = this.machineEpoch();
                    this.pageAliveAt = Date.now();
                    this.error = null;
                    this.blocked = inside ? this.insideBlocked(inside, current.z) : null;
                    this.blockedLogged.clear();
                    log.info(`Armed reviewed envelope: ${JSON.stringify(bounds)}`);
                    if (inside) { log.info(`Armed inside ${inside.name} below its required Z: only straight Z-up exits are sent until the toolhead leaves it.`); }
                    await this.preparePipeline();
                    break;
                }
                case '/pendant/settings': {
                    this.disarm('Reviewing operator settings. Re-arm after saving.');
                    if (this.busy || this.opening || ['starting', 'started'].includes(jobManager.getActive()?.state || '')) {
                        throw new Error('Wait for the current move, connection or machine job to finish before changing settings.');
                    }
                    if (connectionManager.getConnectionStatus().connected && getPositionSnapshot().machineStatus !== 'idle') {
                        throw new Error('Wait for the connected machine to report idle before changing settings.');
                    }
                    manualControlGate.acquire();
                    this.owned = true;
                    try { updatePendantSettings(args); } finally { this.release(); }
                    this.error = 'Operator settings saved. Review the updated clearances and re-arm.';
                    break;
                }
                case '/pendant/disarm': this.disarm(); break;
                case '/pendant/restore-frame':
                case '/pendant/home': {
                    const homing = url.pathname === '/pendant/home';
                    this.disarm(homing ? 'Operator requested homing. Pendant disarmed.' : 'Restoring work frame. Pendant disarmed.');
                    if (homing && args.confirmHoming !== true) { throw new Error('Confirm homing all axes, including rotary B, even if position data is stale.'); }
                    if (this.busy || this.opening || ['starting', 'started'].includes(jobManager.getActive()?.state || '')) {
                        throw new Error('Wait for the current move, connection or machine job to finish before recovery.');
                    }
                    if (!homing && getPositionSnapshot().machineStatus !== 'idle') {
                        throw new Error('Wait for the machine to report idle before changing its coordinate mode.');
                    }
                    manualControlGate.acquire();
                    this.owned = true;
                    this.busy = true;
                    this.recovery = homing ? 'Homing and verifying position' : 'Restoring work frame';
                    try {
                        if (homing) {
                            await homeMachine('usb_pendant:home', true, true);
                            this.releaseHeldMotionGuard();
                            this.error = 'Homing completed and verified. Review bounds and re-arm to jog.';
                        } else {
                            const result = await sendWorkFrameRestore('usb_pendant:restore-frame');
                            if (result.result !== 0) { throw new Error(result.text || 'Controller refused frame recovery.'); }
                            this.releaseHeldMotionGuard();
                            this.error = 'G90/G54 restored without axis motion. Wait for fresh coordinates, review bounds and re-arm.';
                        }
                    } finally {
                        this.recovery = null;
                        this.busy = false;
                        this.release();
                    }
                    break;
                }
                case '/pendant/keepalive': this.pageAliveAt = Date.now(); break;
                default: reply(404, { error: 'Unknown pendant action.' }); return;
            }
            reply(200, { ok: true });
        } catch (err) {
            const message = `${url.pathname.split('/').pop()} refused: ${(err as Error).message}`;
            this.disarm(message);
            log.warn(message);
            reply(400, { error: message });
        }
    }
}

export const pendantRuntime = new PendantRuntime();
