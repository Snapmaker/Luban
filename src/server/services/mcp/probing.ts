import { connectionManager } from '../machine/ConnectionManager';
import { mcpBroadcast } from './index';
import {
    AXES,
    BeatObservation,
    noteFrameRestored,
    NullableXyz,
    PositionSource,
    Xyz,
    completeTarget,
    describeReport,
    getPositionOfRecord,
    getTrustedOffset,
    judgeRecheck,
    machineFromReport,
    matchFrameWithOffsets,
    setPositionOfRecord,
    setTrustedOffset,
} from './positionOfRecord';
import { ProbeChannel, probeFeedService, resolveSensorEnabled, sensorLabel } from './probeFeed';
import { MARCH_SEGMENT_MM, TRAVEL_FEED, marchSegments } from './procedureLimits';
import { McpToolError } from './registry';
import { GcodeChannel, SentGcode, currentGcodeSequence, sendGcodeVisible } from './tools/camera';
import { PositionSnapshot, assertFreshHeartbeat, getPositionSnapshot, safeTraverseZ } from './tools/machine';
import { ProcedureAbort, checkProcedureStop } from './procedureAbort';
import { TRAVERSE_Z_TOLERANCE_MM, planRaiseToTop } from './traversePlan';
import { ROTATE_FEED, judgeRotation } from './rotaryMotion';
import { reliableForMotion } from './machinePosition';

// The shared sensor-gated motion engine: settled single moves on the direct
// path, contact/release sensing against a probe feed channel, and the
// readiness guard. Extracted from the tool setter (where every piece was
// hardware-proven 2026-08-31/09-01) so the CNC touch probe reuses the exact
// same verified mechanics against its own feed channel.

// The feeds live in procedureLimits (pure) so the confirm-page describers can
// render the runner's plan without the server; re-exported for the runners.
export { TRAVEL_FEED, COARSE_FEED, FINE_FEED } from './procedureLimits';
const SETTLE_TIMEOUT_MS = 30000;
const SETTLE_POLL_MS = 250;
export const SETTLE_TOLERANCE_MM = 0.15;
export const MAX_RETREAT_MM = 5; // still triggered after this much retreat = stuck sensor
const SENSE_OVERRUN_MS = 200;

export interface SenseTiming {
    kind: 'contact' | 'release';
    windowMs: number;
    elapsedMs: number;
    endedAt: number;
    contact: boolean;
}

/** The most recent sensor wait (window asked for, time it took, when it ended) - stamped on the next send event. */
let lastSense: SenseTiming | null = null;

export function getLastSense(): SenseTiming | null {
    return lastSense;
}

/**
 * Step trace: wall-clock marks at every boundary between one controller
 * reply and the next send, attached to that send's event. Job cdbc29371b97
 * (2026-09-05) placed the whole 1-4.5 s idle between the reply and the
 * start of the sensor wait - a stretch of synchronous code and promise
 * resumptions with no timer in it - so each boundary is stamped:
 * reply-returned (sendGcodeVisible handed back), echo-match / echo-miss,
 * engine-exit, settled-exit (moveMachineSettled returned), sense-start,
 * sense-end, then the runner enters the engine again.
 */
const stepTrace: { label: string; at: number }[] = [];

export function traceMark(label: string): void {
    stepTrace.push({ label, at: Date.now() });
    if (stepTrace.length > 24) {
        stepTrace.splice(0, stepTrace.length - 24);
    }
}

/** Marks since the previous send as "label+ms" relative to `since`, then reset. */
export function takeStepTrace(since: number | null): string | undefined {
    if (!stepTrace.length) {
        return undefined;
    }
    const base = since === null ? stepTrace[0].at : since;
    const text = stepTrace.map((mark) => `${mark.label}+${mark.at - base}`).join(' ');
    stepTrace.length = 0;
    return text;
}

// Abort classes live in procedureAbort.ts (pure, unit-tested): test them with
// isProcedureAbort / isProcedureStopped, never instanceof (see that file).
export { ProcedureAbort, ProcedureStopped, isProcedureAbort, isProcedureStopped } from './procedureAbort';

// The cooperative stop-request state lives in procedureAbort.ts (pure, no
// server imports) so tools/camera.ts can read it without importing this
// module - camera.ts <-> probing.ts was an import cycle. Re-exported here so
// every existing importer keeps working; it is the SAME module state.
export {
    checkProcedureStop,
    clearProcedureStop,
    procedureStopRequested,
    requestProcedureStop,
} from './procedureAbort';

export interface StepResult {
    contact: boolean;
    reading: { value: string; receivedAt: number } | null;
    // Which channel fired, when sensing across several (e.g. measuring the
    // spindle touch probe on the tool setter accepts either).
    channel?: ProbeChannel;
}

export function getDirectChannel(): GcodeChannel {
    const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
    if (!channel || typeof channel.executeGcode !== 'function') {
        throw new ProcedureAbort('No machine channel with direct command support.');
    }
    return channel;
}

export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// Operator rule (2026-09-05): a move of <= INCH_ESTIMATE_MM whose controller
// reply carried no contradicting position may be taken as arrived when the
// heartbeat has not caught up within INCH_GRACE_MS - inching must not be paced
// by the 2 s status poll. Recorded as an `estimated` position of record.
export const INCH_ESTIMATE_MM = 1;
const INCH_GRACE_MS = 400;
const INCH_GRACE_POLL_MS = 100;
const ECHO_TOLERANCE_MM = 0.02;

function parseEcho(text: string | undefined): NullableXyz | null {
    const echo = String(text || '').match(/X:(-?\d+(?:\.\d+)?)\s+Y:(-?\d+(?:\.\d+)?)\s+Z:(-?\d+(?:\.\d+)?)/);
    return echo ? { x: Number(echo[1]), y: Number(echo[2]), z: Number(echo[3]) } : null;
}

/**
 * Issue one absolute machine-frame move and block until it verifiably
 * completed. Fast path: the HTTP channel executes gcode synchronously and its
 * reply echoes the completed position - an exact match (0.02 mm) in EITHER
 * frame (work coordinates normally; raw machine coordinates when the reply
 * was framed inside the G53 window - positionOfRecord.ts) is proof of
 * arrival with no heartbeat wait. Fallback: heartbeat settle (report newer
 * than issue, machine idle, axes at target in either frame; moves larger than
 * 3x the tolerance accept the first at-target beat, smaller ones require two
 * DISTINCT agreeing beats since a stale beat could pass). Moves of <= 1 mm
 * with no contradicting echo are estimated after a short grace (operator
 * rule above). Every verified arrival becomes the position of record. The
 * overtravel latch is re-checked before the move and on every poll.
 */
export interface MoveOptions {
    /**
     * Descent segments (operator law 2026-09-05): the controller's ok is
     * enough - never wait on the heartbeat when the echo is missing or
     * misframed; record the commanded position as `estimated` and move on.
     * Each segment is <= DESCENT_SEGMENT_MM and sensor-checked by the caller.
     */
    lenient?: boolean;
    /** Called once the controller acknowledged the whole batch (result 0), before the arrival is judged. */
    onReply?: () => void;
}

async function moveMachineSettledUnguarded(
    tool: string,
    target: { x?: number; y?: number; z?: number },
    feed: number,
    options: MoveOptions = {}
): Promise<void> {
    const enteredAt = Date.now();
    traceMark('engine-enter');
    probeFeedService.assertNoOvertravel();
    const channel = getDirectChannel();
    const words = [
        target.x !== undefined ? `X${target.x.toFixed(3)}` : '',
        target.y !== undefined ? `Y${target.y.toFixed(3)}` : '',
        target.z !== undefined ? `Z${target.z.toFixed(3)}` : '',
    ].filter(Boolean).join(' ');
    // The trailing G54 is also what makes this call "settled": on the Snapmaker
    // controller select_coordinate_system() runs planner.synchronize() when the
    // workspace changes, so its reply (the last of four HTTP requests) only
    // arrives once the G1 has finished. A bare G53 does not synchronize.
    const gcode = `G90
G53;
G1 ${words} F${feed};
G54;`;

    const before = getPositionSnapshot();
    // Where the move starts: the engine's own record while it is current (no
    // other gcode since it was taken), else the heartbeat.
    const record = getPositionOfRecord(currentGcodeSequence());
    const from: NullableXyz = record ? record.machine : before.machine;
    const deltas = AXES
        .filter((axis) => target[axis] !== undefined)
        .map((axis) => (from[axis] === null ? null : Math.abs((target[axis] as number) - (from[axis] as number))));
    const bigMove = deltas.every((d) => d !== null && d > SETTLE_TOLERANCE_MM * 3);
    const inchMove = deltas.every((d) => d !== null && d <= INCH_ESTIMATE_MM);

    const issuedAt = Date.now();
    // Timing stamps for the send event (diagnostics): how long the engine
    // took from entry to send, and what the last sensor wait cost - so an
    // idle gap between steps can be attributed to the runner, the sensor
    // window, or the engine (job d8f6ec1b5c11: 1-4 s idles, echo matched,
    // event loop idle - unexplained without this).
    const executed = await sendGcodeVisible(channel, tool, gcode, { enteredAt, lastSense, trace: takeStepTrace(null) });
    traceMark('reply-returned');
    if (executed.result !== 0) {
        throw new ProcedureAbort(`Controller rejected the move: ${executed.text || executed.result}`);
    }
    if (options.onReply) {
        options.onReply();
    }
    const arrived = (machine: NullableXyz, source: PositionSource) => {
        const full = completeTarget(machine, target);
        if (full) {
            setPositionOfRecord(full, source, executed.sequence, tool);
        }
        traceMark(`engine-exit:${source}`);
    };

    // Offsets to judge the echo with: the engine's own trusted offset (the
    // one that last proved an arrival) before whatever the latest heartbeat
    // carried - which reads 0,0,0 inside G53 windows and cost 28 settle-waits
    // in the run after the snapshot fix.
    const offsetCandidates: Xyz[] = [];
    const trusted = getTrustedOffset();
    if (trusted) {
        offsetCandidates.push(trusted);
    }
    offsetCandidates.push(before.originOffset);
    const echo = parseEcho(executed.text);
    let echoContradicts = false;
    if (echo) {
        const match = matchFrameWithOffsets(echo, offsetCandidates, target, ECHO_TOLERANCE_MM);
        if (match) {
            traceMark(`echo-match:${match.frame}`);
            if (match.frame === 'work-frame') {
                setTrustedOffset(match.offset);
            }
            arrived(machineFromReport(echo, match.offset, match.frame), 'echo');
            return;
        }
        traceMark('echo-miss');
        echoContradicts = true;
    } else {
        traceMark('echo-absent');
    }

    if (options.lenient) {
        const estimate = completeTarget(from, target);
        if (estimate) {
            setPositionOfRecord(estimate, 'estimated', executed.sequence, tool);
            traceMark('engine-exit:estimated-lenient');
            mcpBroadcast('mcp:activity', {
                tool,
                phase: 'position-estimated',
                note: `${words}: descent segment - controller accepted, ${echo ? 'echo misframed' : 'no echo'}; not waiting on the `
                    + 'heartbeat (operator rule 2026-09-05), commanded position recorded as estimated',
            });
            return;
        }
    }

    // Reaching here means the controller's reply did not prove arrival. Say
    // so on the job record with the evidence (job cdbc29371b97 placed 1-4 s
    // idles between the reply and the sensor window; this is the only
    // heartbeat wait in that stretch, so it must announce itself).
    mcpBroadcast('mcp:activity', {
        tool,
        phase: 'settle-wait',
        note: `${words}: ${echo ? 'echo did not match either frame' : 'no position echo'} - waiting on the heartbeat`,
        echo: echo ? `${echo.x},${echo.y},${echo.z}` : null,
        offset: `${before.originOffset.x},${before.originOffset.y},${before.originOffset.z}`,
        offsetSource: before.originOffsetSource,
        trustedOffset: trusted ? `${trusted.x},${trusted.y},${trusted.z}` : null,
        target: words,
        inchMove,
        bigMove,
    });
    const settleStartedAt = Date.now();
    const deadline = issuedAt + SETTLE_TIMEOUT_MS;
    let graceUntil: number | null = inchMove && !echoContradicts ? issuedAt + INCH_GRACE_MS : null;
    let previous: string | null = null;
    let previousReportTime: number | null = null;
    while (Date.now() < deadline) {
        await sleep(graceUntil !== null ? INCH_GRACE_POLL_MS : SETTLE_POLL_MS);
        probeFeedService.assertNoOvertravel();
        let now: PositionSnapshot;
        try {
            now = getPositionSnapshot();
        } catch (err) {
            continue;
        }
        const reportTime = now.reportedAt;
        const fingerprint = JSON.stringify([now.work, now.originOffset]);
        // "Stable" = two DISTINCT beats agreeing (the poll here is faster than
        // the 2 s heartbeat, so the same beat read twice proves nothing).
        const stable = fingerprint === previous && previousReportTime !== null && previousReportTime !== reportTime;
        if (previousReportTime !== reportTime) {
            previous = fingerprint;
            previousReportTime = reportTime;
        }
        const fresh = reportTime > issuedAt && now.machineStatus === 'idle';
        if (fresh && (bigMove || stable)) {
            const beatOffsets = trusted ? [now.originOffset, trusted] : [now.originOffset];
            const match = matchFrameWithOffsets(now.work, beatOffsets, target, SETTLE_TOLERANCE_MM);
            if (match) {
                mcpBroadcast('mcp:activity', {
                    tool,
                    phase: 'settle-done',
                    note: `${words}: heartbeat (${match.frame}) confirmed arrival after ${Date.now() - settleStartedAt} ms`,
                });
                if (match.frame === 'work-frame') {
                    setTrustedOffset(match.offset);
                }
                arrived(machineFromReport(now.work, match.offset, match.frame), 'heartbeat');
                return;
            }
        }
        if (graceUntil !== null && Date.now() >= graceUntil) {
            graceUntil = null;
            // No post-issue report at all yet: the status poll is simply
            // behind a move this small. A fresh report that disagrees is NOT
            // estimated over - fall through to the full settle wait.
            const estimate = fresh ? null : completeTarget(from, target);
            if (estimate) {
                setPositionOfRecord(estimate, 'estimated', executed.sequence, tool);
                mcpBroadcast('mcp:activity', {
                    tool,
                    phase: 'position-estimated',
                    note: `${words}: controller accepted a <= ${INCH_ESTIMATE_MM} mm move with no position echo and the `
                        + `latest status report is ${Date.now() - reportTime} ms old - taking the commanded position as `
                        + 'arrived (operator rule 2026-09-05)',
                });
                return;
            }
        }
    }
    throw new ProcedureAbort(`Timed out waiting for the heartbeat to verify the move to ${words}.`);
}

/**
 * Where the engine knows the machine to be: its position of record while it
 * is current (the last verified arrival, no other gcode since), else the
 * heartbeat snapshot. Runners must use THIS, not a bare snapshot, to decide
 * their next move: job 42df7b9351b7 (2026-09-05) read a single zero-offset
 * beat as machine Z-8 while the traverse echo had just verified Z320, skipped
 * the fast descent and aborted at the station check.
 */
export function knownMachinePosition(): { position: NullableXyz; source: 'record' | 'heartbeat'; snapshot: PositionSnapshot } {
    const snapshot = getPositionSnapshot();
    const record = getPositionOfRecord(currentGcodeSequence());
    if (record) {
        return { position: { ...record.machine }, source: 'record', snapshot };
    }
    return { position: snapshot.machine, source: 'heartbeat', snapshot };
}

export const RECHECK_TOLERANCE_MM = 0.5;
const RECHECK_MAX_MS = 4500; // more than two 2 s heartbeat periods
const RECHECK_POLL_MS = 250;

export interface PositionCheck {
    /** What settled it: a heartbeat in one of the two frames, or the engine's record. */
    frame: 'work-frame' | 'machine-frame' | 'record';
    waitedMs: number;
    /** Set when the check did not pass on the first, plainly-framed read - worth announcing. */
    note: string | null;
}

/**
 * Verify the machine is at `expected` (machine coordinates) before trusting
 * the sensor. Decision (positionOfRecord.judgeRecheck): the latest heartbeat
 * matching in either frame passes; the position of record passes while the
 * heartbeat still predates it; two distinct heartbeats agreeing on somewhere
 * else abort at once (real drift); otherwise keep reading for up to
 * RECHECK_MAX_MS. Replaces the per-runner "re-read once after 1.2 s" checks
 * that aborted job 1db4902a4cd6 on one stale beat and one G53-window beat.
 */
export async function expectMachinePosition(
    expected: Xyz,
    what: string,
    onMismatch: (message: string) => Error,
    toleranceMm: number = RECHECK_TOLERANCE_MM
): Promise<PositionCheck> {
    const record = getPositionOfRecord(currentGcodeSequence());
    const startedAt = Date.now();
    const beats: BeatObservation[] = [];
    let first: PositionSnapshot | null = null;
    for (;;) {
        const snapshot = getPositionSnapshot();
        if (!first) {
            first = snapshot;
        }
        const reportTime = snapshot.reportedAt;
        beats.push({ reportTime, raw: snapshot.work, offset: snapshot.originOffset });
        if (beats.length > 3) {
            beats.shift();
        }
        const verdict = judgeRecheck(beats, expected, toleranceMm, record);
        const waitedMs = Date.now() - startedAt;
        if (verdict.verdict === 'pass') {
            if (verdict.frame === 'record') {
                const r = verdict.record;
                return {
                    frame: 'record',
                    waitedMs,
                    note: `latest status report (${Math.round(Date.now() - reportTime)} ms old) predates the last verified `
                        + `move; position of record (${r.machine.x}, ${r.machine.y}, ${r.machine.z}) from ${r.tool} `
                        + `(${r.source}) used`,
                };
            }
            let note: string | null = null;
            if (verdict.frame === 'machine-frame') {
                note = 'status report carried machine-frame coordinates (G53 window) - accepted as such';
            } else if (waitedMs > 0) {
                note = `passed after ${waitedMs} ms (earlier reads were transient)`;
            }
            return { frame: verdict.frame, waitedMs, note };
        }
        if (verdict.verdict === 'drift' || waitedMs >= RECHECK_MAX_MS) {
            const why = verdict.verdict === 'drift'
                ? 'two consecutive status reports agree the machine is elsewhere'
                : `no status report matched within ${RECHECK_MAX_MS} ms`;
            const recordText = record
                ? `Position of record: (${record.machine.x}, ${record.machine.y}, ${record.machine.z}) from ${record.tool} (${record.source}).`
                : 'No position of record.';
            throw onMismatch(`${what}: the plan expects machine (${expected.x}, ${expected.y}, ${expected.z}) but ${why}. `
                + `Latest: ${describeReport(snapshot.work, snapshot.originOffset, snapshot.originOffsetSource)}. `
                + `First read: ${describeReport(first.work, first.originOffset, first.originOffsetSource)}. ${recordText}`);
        }
        await sleep(RECHECK_POLL_MS);
    }
}

/**
 * moveMachineSettledUnguarded inside the motion-in-flight bracket: while the
 * move runs, a contact sensor the procedure did NOT declare as expected
 * (setExpectedContact) firing is a collision and latches CRASH, and the
 * overtravel tripwire is armed (operator, 2026-09-04: alarm on unexpected
 * probe contact during an X/Y/Z move outside the region of interest).
 */
export async function moveMachineSettled(
    tool: string,
    target: { x?: number; y?: number; z?: number },
    feed: number,
    options: MoveOptions = {}
): Promise<void> {
    checkProcedureStop();
    probeFeedService.motionBegin();
    try {
        await moveMachineSettledUnguarded(tool, target, feed, options);
        traceMark('settled-exit');
    } finally {
        probeFeedService.motionEnd();
    }
}
// ---------------------------------------------------------------------------
// Queued machine-frame moves (USB pendant pipelined jogging, opt-in).
//
// Why a settled move always ends at rest: the engine's trailing `G54;` runs
// select_coordinate_system() in the Snapmaker controller (Marlin
// G53-G59.cpp), which calls planner.synchronize() whenever the workspace
// changes. The HTTP channel sends each line as its own request and waits for
// each reply (SstpHttpChannel.consumeGCodeQueue), so the reply - and the next
// segment - waits for the G1 to finish, and the planner drains between
// segments. The controller's G53() handler, by contrast, selects the machine
// workspace WITHOUT a synchronize, and a plain G1 is acknowledged once it is in
// the planner (a `G0 B180` + `M114` batch answered in 219 ms during an 18 s
// rotation, 2026-09-21). These helpers let a caller hold the machine frame
// across several queued segments and settle ONCE, with the same verified-settle
// engine, at the end. The caller owns every bound on what it queues.

/**
 * Select absolute machine coordinates for a run of queued moves. No motion.
 * `M220 S100` first: the Snapmaker build's M220 reports nothing, so the feed
 * override cannot be read, and the caller's queue model needs commanded feed
 * to be real feed. It is asserted for every run instead.
 */
export async function enterMachineFrame(tool: string): Promise<SentGcode> {
    probeFeedService.assertNoOvertravel();
    checkProcedureStop();
    const executed = await sendGcodeVisible(getDirectChannel(), tool, 'M220 S100\nG90\nG53;');
    if (executed.result !== 0) {
        throw new ProcedureAbort(`Controller rejected the machine-frame select: ${executed.text || executed.result}`);
    }
    return executed;
}

/**
 * Queue one absolute G1 in the machine frame that enterMachineFrame selected.
 * Returns when the controller accepted it, normally long before it finishes.
 * Never call it outside such a run: on its own it would move in the work frame.
 */
export async function queueMachineMove(tool: string, target: Xyz, feed: number): Promise<SentGcode> {
    probeFeedService.assertNoOvertravel();
    checkProcedureStop();
    const words = `X${target.x.toFixed(3)} Y${target.y.toFixed(3)} Z${target.z.toFixed(3)}`;
    const executed = await sendGcodeVisible(getDirectChannel(), tool, `G1 ${words} F${feed};`);
    if (executed.result !== 0) {
        throw new ProcedureAbort(`Controller rejected the queued move: ${executed.text || executed.result}`);
    }
    return executed;
}

/**
 * End a run of queued moves: the ordinary settled move to the run's last
 * queued endpoint (a zero-length G1, so no new motion), whose trailing G54
 * waits for the planner to drain, restores the work frame and lets the echo
 * verify the arrival. No procedure-stop check here: a stop must still restore
 * the frame, and this adds no travel to what is already queued.
 */
export async function settleQueuedMachineMoves(tool: string, last: Xyz, feed: number, onRestored?: () => void): Promise<void> {
    probeFeedService.motionBegin();
    try {
        await moveMachineSettledUnguarded(tool, last, feed, { onReply: () => {
            noteFrameRestored();
            if (onRestored) { onRestored(); }
        } });
        traceMark('settled-exit');
    } finally {
        probeFeedService.motionEnd();
    }
}

/**
 * After a no-motion G90/G54 restore that queued nothing, prove the position:
 * M114's reply must match `expected` (machine coordinates) in either frame,
 * judged with the engine's trusted offset first. A match becomes the position
 * of record (source `echo`), which clears the frame-uncertainty latch. Returns
 * whether it matched; no motion either way.
 */
export async function verifyRestoredPosition(tool: string, expected: Xyz): Promise<boolean> {
    const executed = await sendGcodeVisible(getDirectChannel(), tool, 'M114');
    const echo = executed.result === 0 ? parseEcho(executed.text) : null;
    if (!echo) {
        return false;
    }
    const trusted = getTrustedOffset();
    const offsets: Xyz[] = trusted ? [trusted] : [];
    try {
        offsets.push(getPositionSnapshot().originOffset);
    } catch (err) {
        // No heartbeat: only the trusted offset can judge the reply.
    }
    const match = matchFrameWithOffsets(echo, offsets, expected, ECHO_TOLERANCE_MM);
    const full = match ? completeTarget(machineFromReport(echo, match.offset, match.frame), expected) : null;
    if (!full) {
        return false;
    }
    setPositionOfRecord(full, 'echo', executed.sequence, tool);
    return true;
}

/** The firmware's current motion limits (`M503 S`, read-only), for the caller to judge. */
export async function readFirmwareMotionConfig(tool: string): Promise<string> {
    const executed = await sendGcodeVisible(getDirectChannel(), tool, 'M503 S');
    if (executed.result !== 0 || !executed.text?.trim()) {
        throw new ProcedureAbort(`M503 S returned no configuration: ${executed.text || executed.result}`);
    }
    return executed.text;
}

/** What raiseToTop did, so a runner can report the head's final Z honestly. */
export interface RaiseToTopOutcome {
    action: 'raised' | 'skipped' | 'held' | 'no-retreat';
    /** Machine Z the head is at afterwards; null when unknown and nothing moved. */
    z: number | null;
    note: string;
}

/** Phase names announced by raiseToTop and the motion's event tag (`<tool>:<moveTag>`). */
export interface RaiseToTopPhases {
    noRetreat: string;
    held: string;
    skipped: string;
    raised: string;
    moveTag: string;
}

const ABORT_RAISE_PHASES: RaiseToTopPhases = {
    noRetreat: 'abort-no-retreat',
    held: 'abort-held',
    skipped: 'abort-raise-skipped',
    raised: 'abort-raised',
    moveTag: 'abort-raise',
};

/**
 * The one retreat every procedure shares, at its end AND on abort (operator
 * law 2026-09-16, issue #91): STRAIGHT UP to the traverse height, never to a
 * start height, never down. Job fd7fa6cb6396 (tool setter, aborted before its
 * travel at Z 327.999) was "retreated" to its start height - a 122 mm plunge
 * from home at the home XY; the success path of run_tool_setter stopped at
 * the same start height until #91.
 *
 * - The overtravel trip closes the connection: no motion is attempted.
 * - `holdIfTriggered`: a probe still reading contact means the tip is against
 *   something - lifting could drag it; hold for the operator.
 * - Already at the top (within the heartbeat's float noise): nothing is sent.
 * - Otherwise a Z-ONLY G53 move to the traverse height - from any known or
 *   unknown position inside the volume this is the one move that cannot descend.
 *
 * `clearExpectedContact` empties the expected-contact set right before the
 * move (an abort's raise expects nothing to touch - a contact during it is a
 * collision). A success-path lift off the tool setter leaves it alone: the
 * lift starts IN contact and keeps the setter channels expected, as its old
 * retreat did.
 *
 * `announce(phase, z, note)` gets the target Z on a raise, the current Z on
 * a skip, and null when the position is unknown and nothing moved.
 */
export async function raiseToTop(
    tool: string,
    announce: (phase: string, z: number | null, note: string) => void,
    options: { holdIfTriggered?: ProbeChannel; phases?: RaiseToTopPhases; clearExpectedContact?: boolean } = {}
): Promise<RaiseToTopOutcome> {
    const phases = options.phases || ABORT_RAISE_PHASES;
    if (probeFeedService.getTrip()) {
        const note = 'overtravel latched - the connection is being closed, no motion issued';
        announce(phases.noRetreat, null, note);
        return { action: 'no-retreat', z: knownMachinePosition().position.z, note };
    }
    if (options.holdIfTriggered) {
        const reading = probeFeedService.getReading(options.holdIfTriggered);
        if (reading && reading.triggered) {
            const note = `${options.holdIfTriggered} still triggered - holding position for the operator`;
            announce(phases.held, null, note);
            return { action: 'held', z: knownMachinePosition().position.z, note };
        }
    }
    const { position } = knownMachinePosition();
    const decision = planRaiseToTop(position.z, safeTraverseZ());
    if (decision.action === 'skip') {
        announce(phases.skipped, position.z, decision.reason);
        return { action: 'skipped', z: position.z, note: decision.reason };
    }
    if (options.clearExpectedContact) {
        probeFeedService.clearExpectedContact();
    }
    await moveMachineSettled(`${tool}:${phases.moveTag}`, { z: decision.targetZ }, TRAVEL_FEED);
    const note = `traverse height - ${decision.reason}`;
    announce(phases.raised, decision.targetZ, note);
    return { action: 'raised', z: decision.targetZ, note };
}

/** raiseToTop for an ABORT: the `abort-*` phase names, expected contact cleared before the raise. */
export async function abortRaiseToTop(
    tool: string,
    announce: (phase: string, z: number | null, note: string) => void,
    options: { holdIfTriggered?: ProbeChannel } = {}
): Promise<RaiseToTopOutcome> {
    return raiseToTop(tool, announce, { ...options, clearExpectedContact: true });
}



/**
 * CONTACT detection after a settled step: give the sensor's report a short
 * window to arrive (early-exit on a fresh reading), then judge from the LAST
 * KNOWN state - the sensor publishes on change, so silence means unchanged.
 * A late contact message merely costs one extra step (self-correcting).
 */
function noteSense(kind: 'contact' | 'release', windowMs: number, startedAt: number, contact: boolean): void {
    const endedAt = Date.now();
    lastSense = { kind, windowMs, elapsedMs: endedAt - startedAt, endedAt, contact };
    traceMark(`sense-end:${kind}${contact ? ':contact' : ''}`);
}

export async function senseAfter(
    channels: ProbeChannel | ProbeChannel[],
    stepIssuedAt: number,
    delayMs: number
): Promise<StepResult> {
    checkProcedureStop();
    const list = Array.isArray(channels) ? channels : [channels];
    const startedAt = Date.now();
    traceMark('sense-start');
    const deadline = startedAt + delayMs;
    for (;;) {
        for (const channel of list) {
            const state = probeFeedService.getReading(channel);
            if (state && state.triggered) {
                noteSense('contact', delayMs, startedAt, true);
                return {
                    contact: true,
                    reading: { value: state.value, receivedAt: state.receivedAt },
                    channel,
                };
            }
        }
        if (Date.now() >= deadline) {
            noteSense('contact', delayMs, startedAt, false);
            // Diagnostics: the window is timer-paced; finishing well past it
            // means the server's timers ran late (diagnostics.ts).
            const overrun = Date.now() - deadline;
            if (overrun > SENSE_OVERRUN_MS) {
                mcpBroadcast('mcp:activity', {
                    tool: 'diagnostics',
                    phase: 'sense_overrun',
                    ms: overrun,
                    note: `sensor window of ${delayMs} ms finished ${overrun} ms late - timers delayed (event loop or CPU)`,
                });
            }
            const state = probeFeedService.getReading(list[0]);
            return {
                contact: false,
                reading: state ? { value: state.value, receivedAt: state.receivedAt } : null,
                channel: list[0],
            };
        }
        await sleep(Math.min(50, Math.max(1, deadline - Date.now())));
    }
}

/**
 * RELEASE detection needs different patience: a stale "triggered" here is a
 * false abort (live-hit on the tool setter: the cloud round-trip of the
 * release message exceeded the contact window). Wait until the last known
 * state reads untriggered, early-exiting on fresh readings, up to timeoutMs;
 * only then is "still triggered" believed.
 */
export async function senseReleaseAfter(
    channels: ProbeChannel | ProbeChannel[],
    stepIssuedAt: number,
    timeoutMs: number
): Promise<StepResult> {
    const list = Array.isArray(channels) ? channels : [channels];
    const startedAt = Date.now();
    traceMark('sense-start:release');
    const deadline = startedAt + timeoutMs;
    for (;;) {
        const states = list.map((channel) => ({ channel, state: probeFeedService.getReading(channel) }));
        const stillTriggered = states.find((s) => s.state && s.state.triggered);
        if (!stillTriggered) {
            noteSense('release', timeoutMs, startedAt, false);
            const first = states[0].state;
            return {
                contact: false,
                reading: first ? { value: first.value, receivedAt: first.receivedAt } : null,
                channel: states[0].channel,
            };
        }
        if (Date.now() >= deadline) {
            noteSense('release', timeoutMs, startedAt, true);
            return {
                contact: true,
                reading: stillTriggered.state
                    ? { value: stillTriggered.state.value, receivedAt: stillTriggered.state.receivedAt }
                    : null,
                channel: stillTriggered.channel,
            };
        }
        await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
    }
}

/**
 * The sensor must be connected, have reported at least once, and read
 * untriggered before any sensor-gated approach may start.
 */
export function assertChannelReady(channel: ProbeChannel, what: string): void {
    probeFeedService.assertNoOvertravel();
    if (!resolveSensorEnabled()[channel]) {
        throw new McpToolError(`The ${sensorLabel(channel)} is disabled (Settings -> MCP Server -> Probe sensor feed). `
            + `Ask the operator to enable it before a ${what} run.`);
    }
    if (!probeFeedService.isConnected()) {
        throw new McpToolError('Probe feed is not connected - connect_probe_feed first. The overtravel '
            + `tripwire MUST be armed for a ${what} run.`);
    }
    const reading = probeFeedService.getReading(channel);
    if (!reading) {
        throw new McpToolError(`No reading has ever arrived on the ${channel} feed - cannot trust the `
            + 'sensor. Ask the operator to trigger it by hand and watch get_probe_feed_status until '
            + 'the touch shows up.');
    }
    if (reading.triggered) {
        throw new McpToolError(`The ${channel} feed already reads triggered ("${reading.value}") before `
            + 'any approach - the sensor is stuck or already in contact. Resolve physically first.');
    }
}

/** Machine idle, homed, toolhead off - the common motion preconditions. */
export function assertMachineReadyForProcedure(): void {
    assertFreshHeartbeat('a probing procedure');
    const position = getPositionSnapshot();
    if (position.machineStatus !== 'idle') {
        throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
    }
    if (position.isHomed !== true) {
        throw new McpToolError('Machine does not report homed; home first.');
    }
    const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
    const headPower = Number(state && state.headPower);
    if ((Number.isFinite(headPower) && headPower > 0) || (state && (state.headStatus === true || state.headStatus === 'on'))) {
        throw new McpToolError('Toolhead appears to be on; refusing to run the procedure.');
    }
}

// Rotary B feed for program rotations (deg/min): 600 = 10 deg/s, a 180 deg
// turn in 18 s. Lives in rotaryMotion.ts with the timing rules; re-exported.
export { ROTATE_FEED } from './rotaryMotion';
const ROTATE_TOLERANCE_DEG = 0.05;
const ROTATE_TIMEOUT_MS = 120000;
const IDLE_POLL_MS = 500;
const SETTLE_CONSECUTIVE_BEATS = 2;

export interface SettledMachine {
    snapshot: PositionSnapshot;
    waitedMs: number;
    beats: number;
}

/**
 * Wait until the machine reads idle on SETTLE_CONSECUTIVE_BEATS consecutive
 * heartbeats (and, when `b` is given, reports that B within tolerance) - the
 * gate every no-probe op (capture) passes before it acts on the position, and
 * the confirmation a rotation ends with. Operator, 2026-09-21: "any camera op
 * should await the previous op's position confirmation first".
 */
export async function awaitMachineSettled(tool: string, opts: { b?: number | null; timeoutMs?: number } = {}): Promise<SettledMachine> {
    const started = Date.now();
    const deadline = started + (opts.timeoutMs ?? ROTATE_TIMEOUT_MS);
    let beats = 0;
    let last: PositionSnapshot | null = null;
    while (Date.now() < deadline) {
        checkProcedureStop();
        probeFeedService.assertNoOvertravel();
        const now = getPositionSnapshot();
        const bOk = opts.b === undefined || opts.b === null || (now.b !== null && Math.abs(now.b - opts.b) <= ROTATE_TOLERANCE_DEG);
        const idle = now.machineStatus === 'idle' && reliableForMotion(now.reliability);
        beats = idle && bOk ? beats + 1 : 0;
        last = now;
        if (beats >= SETTLE_CONSECUTIVE_BEATS) {
            return { snapshot: now, waitedMs: Date.now() - started, beats };
        }
        await sleep(IDLE_POLL_MS);
    }
    throw new ProcedureAbort(`${tool}: the machine did not settle within ${(opts.timeoutMs ?? ROTATE_TIMEOUT_MS) / 1000} s `
        + `(last: status ${last?.machineStatus}, reliability ${last?.reliability}, B ${last?.b}${opts.b === undefined || opts.b === null ? '' : ` wanted ${opts.b}`}).`);
}

/**
 * Rotate the rotary axis to an ABSOLUTE B angle on the direct path, inside a
 * probe_program the operator approved with the B schedule enumerated. The
 * toolhead must be at or above `requireZAtLeast` (the safe traverse height:
 * the stock turns under a raised head).
 *
 * Completion is PHYSICAL, never the echo alone (hardware, 2026-09-21: the
 * controller answered "ok" + "B:180.00" 219 ms into an 18 s turn - the
 * buffered target - the next op photographed the stock 5 degrees in, and the
 * op after that homed the machine while B was still turning). So the batch
 * ends in M400 (wait for the planner to drain) before M114, the wall-clock
 * time is checked against the rotation's physical duration
 * (rotaryMotion.judgeRotation), the runner sleeps out any remainder, and the
 * heartbeat must read the target B and idle on two consecutive beats. Any
 * probe contact while the stock turns is a collision (crash guard: the
 * motion bracket is armed, no contact is expected).
 */
export async function rotateB(tool: string, targetDeg: number, requireZAtLeast: number): Promise<{
    from: number | null;
    to: number;
    verifiedBy: 'm400-echo+heartbeat' | 'heartbeat';
    elapsedMs: number;
    expectedMs: number;
    settleWaitMs: number;
}> {
    checkProcedureStop();
    probeFeedService.assertNoOvertravel();
    const known = knownMachinePosition();
    // The heartbeat reads the park height as 327.999 (POSITION_EPSILON_MM); a
    // 1e-9 comparison here refused every rotation from home on 2026-09-21,
    // exactly as run_tool_setter did on 2026-09-16 before its tolerance fix.
    if (known.position.z === null || known.position.z < requireZAtLeast - TRAVERSE_Z_TOLERANCE_MM) {
        throw new ProcedureAbort(`Rotation refused: toolhead machine Z is ${known.position.z} (${known.source}), below the required Z${requireZAtLeast}.`);
    }
    const snapshot = getPositionSnapshot();
    if (!snapshot.isFourAxis) {
        throw new ProcedureAbort('Rotation refused: the heartbeat reports no B axis.');
    }
    const from = snapshot.b;
    const channel = getDirectChannel();
    const target = Number(targetDeg.toFixed(3));
    probeFeedService.clearExpectedContact();
    const sentAt = Date.now();
    const executed = await sendGcodeVisible(channel, tool, `G90\nG0 B${target.toFixed(3)} F${ROTATE_FEED}\nM400\nM114`);
    if (executed.result !== 0) {
        throw new ProcedureAbort(`Controller rejected the rotation: ${executed.text || executed.result}`);
    }
    const elapsedMs = Date.now() - sentAt;
    const echo = String(executed.text || '').match(/\bB:(-?\d+(?:\.\d+)?)/);
    const echoOk = !!echo && Math.abs(Number(echo[1]) - target) <= ROTATE_TOLERANCE_DEG;
    const judged = judgeRotation(from, target, elapsedMs);
    if (!judged.plausible) {
        // The reply is the buffered target: wait out the physical time before
        // asking the heartbeat (which reports the same logical value meanwhile).
        mcpBroadcast('mcp:activity', { tool, phase: 'rotation-in-flight', note: `${judged.note}; waiting ${judged.remainingMs} ms` });
        await sleep(Math.min(judged.remainingMs, ROTATE_TIMEOUT_MS));
    }
    const settled = await awaitMachineSettled(tool, { b: target, timeoutMs: ROTATE_TIMEOUT_MS });
    return {
        from,
        to: target,
        verifiedBy: echoOk && judged.plausible ? 'm400-echo+heartbeat' : 'heartbeat',
        elapsedMs,
        expectedMs: Math.round(judged.expectedMs),
        settleWaitMs: settled.waitedMs,
    };
}

/** Longest single Z move toward the work a procedure may issue when NO contact is expected (operator law 2026-09-05). */
export const DESCENT_SEGMENT_MM = 5;

export interface MarchAdvance {
    /** Where the march scalar ended up: `toS`, or the segment a contact stopped it at. */
    s: number;
    sensed: StepResult;
    segments: number;
}

/**
 * Advance a sensor-gated march from `fromS` to `toS` along whatever the
 * caller's `move(s)` parametrises (a scalar along a unit vector, a single
 * axis coordinate, a Z), in physical moves of at most MARCH_SEGMENT_MM, each
 * settle-verified and followed by a sensor read. The caller's coarse step is
 * the LOGICAL advance; this is where the operator law about the physical one
 * lives (2026-09-05: a move once sent cannot be stopped, so "never 2 mm").
 *
 * Contact ends the advance at the segment it was sensed on, which is the
 * position the caller records - a 2 mm coarse step that meets the surface
 * 0.6 mm in reports 0.6 mm in, not 2. Until 2026-09-21 every planner sent
 * its whole coarse step as one move and read the sensor once after it.
 */
export async function marchInSegments(
    move: (s: number) => Promise<void>,
    fromS: number,
    toS: number,
    channels: ProbeChannel | ProbeChannel[],
    sensorDelayMs: number,
    segmentMm: number = MARCH_SEGMENT_MM
): Promise<MarchAdvance> {
    const stops = marchSegments(fromS, toS, segmentMm);
    let s = fromS;
    let sensed: StepResult = { contact: false, reading: null };
    let segments = 0;
    for (const next of stops) {
        const issuedAt = Date.now();
        s = next;
        segments += 1;
        await move(s);
        sensed = await senseAfter(channels, issuedAt, sensorDelayMs);
        if (sensed.contact) {
            break;
        }
    }
    return { s, sensed, segments };
}

/**
 * Descend from `fromZ` to `toZ` (machine Z) in segments of at most
 * DESCENT_SEGMENT_MM. Operator law (2026-09-05): a single long G1 toward the
 * work cannot be stopped once sent - a collision would be driven to the end
 * of the move - so every descent is chopped, and NO segment waits on the
 * heartbeat (lenient settle: the controller's ok is the gate).
 *
 * Contact detection during the descent is ASYNCHRONOUS (operator, same day):
 * the probe feed's crash guard already latches the CRASH alarm the moment a
 * channel the procedure did not declare as expected fires while motion is
 * in flight (probeFeed.onReading -> tripSafety: job stop + connection close),
 * and every segment re-checks the latch before it is sent, so a hit ends the
 * descent within one segment (<= 5 mm) without a serial sensor wait between
 * segments. Callers MUST have cleared the expected-contact set for the
 * channels a hit would arrive on (a descent expects no contact). Where a
 * manoeuvre needs a synchronous verdict as well, `serialCheck` adds a
 * senseAfter window after every segment and aborts on contact.
 * Upward moves are a single move: they leave the work.
 */
export async function descendInSegments(
    tool: string,
    fromZ: number,
    toZ: number,
    channels: ProbeChannel | ProbeChannel[],
    sensorDelayMs: number,
    options: { feed?: number; serialCheck?: boolean } = {}
): Promise<{ segments: number }> {
    const feed = options.feed === undefined ? TRAVEL_FEED : options.feed;
    if (toZ >= fromZ - TRAVERSE_Z_TOLERANCE_MM) {
        await moveMachineSettled(tool, { z: Number(toZ.toFixed(3)) }, feed);
        return { segments: 1 };
    }
    let z = fromZ;
    let segments = 0;
    while (z - toZ > 1e-9) {
        z = Math.max(Number((z - DESCENT_SEGMENT_MM).toFixed(3)), toZ);
        segments += 1;
        const t0 = Date.now();
        // assertNoOvertravel() inside the engine refuses this segment if the
        // crash guard latched during the previous one.
        await moveMachineSettled(tool, { z }, feed, { lenient: true });
        if (options.serialCheck) {
            const sensed = await senseAfter(channels, t0, sensorDelayMs);
            if (sensed.contact) {
                throw new ProcedureAbort(`UNEXPECTED CONTACT (${sensed.channel}) during the descent at Z${z.toFixed(3)} - something is `
                    + 'where the plan says nothing should be. Machine held.');
            }
        }
    }
    // The latch may have fired on the LAST segment with nothing sent after
    // it: surface it here rather than at the caller's next move.
    probeFeedService.assertNoOvertravel();
    return { segments };
}
