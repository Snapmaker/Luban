// Position of record: what the sensor-gated motion engine KNOWS about where
// the machine is, independent of the heartbeat.
//
// Why this exists (hardware, 2026-09-05, job 1db4902a4cd6): a surface scan
// aborted at its station-4 position re-check after three clean stations. The
// two hop segments had each been echoed by the controller at their commanded
// positions, so the machine was exactly where the plan said - but the re-check
// judged the heartbeat instead:
//   - beat 1 still showed the segment-1 position (the status poll runs on its
//     own ~1 s cadence and lags a synchronous move by up to a period or two);
//   - beat 2 carried (170, 207.571, 227.7) in its x/y/z fields with the origin
//     offset still populated. Those are the MACHINE coordinates of the move
//     just completed: the HTTP channel sends `G90`, `G53;`, `G1 ...`, `G54;`
//     as four separate requests, and a status poll landing inside that window
//     reports the G53 frame. Subtracting the offset again produced
//     (221, 329.6, 555.7) and the scan aborted.
// The earlier fix (missing offsets reuse the last complete one) covered a
// different transient. This module covers both, plus the lag:
//   1. matchFrame() accepts a report in EITHER frame - work (the normal case)
//      or raw machine coordinates when the offset makes the two
//      distinguishable (the G53-window signature).
//   2. The engine records every verified arrival (controller echo or settled
//      heartbeat), and re-checks let that record outrank a heartbeat that
//      predates it. Any other gcode sent to the machine invalidates it.
//   3. Operator rule (2026-09-05): a move of <= 1 mm whose controller reply
//      carried no contradicting position may be taken as arrived when the
//      heartbeat is late, so inching is not paced by the status poll. Such a
//      position is recorded as `estimated`.
// Position judgements stay pure functions here so they can be unit-tested
// without a machine.

export interface Xyz {
    x: number;
    y: number;
    z: number;
}

export interface NullableXyz {
    x: number | null;
    y: number | null;
    z: number | null;
}

export type Axis = 'x' | 'y' | 'z';
export const AXES: readonly Axis[] = ['x', 'y', 'z'];

/** Which reading of a status report agrees with an expected MACHINE position. */
export type FrameMatch = 'work-frame' | 'machine-frame' | null;

/**
 * Judge one status report (raw x/y/z fields plus the origin offset it came
 * with) against an expected machine position on the axes `expected` names.
 * 'work-frame': machine = raw - offset matches (the documented convention).
 * 'machine-frame': the raw fields themselves match and the offset is large
 * enough on a compared axis to tell the two apart - a report taken while G53
 * was selected. null: neither reading matches.
 */
export function matchFrame(
    raw: NullableXyz,
    offset: Xyz,
    expected: Partial<Xyz>,
    toleranceMm: number
): FrameMatch {
    const axes = AXES.filter((axis) => expected[axis] !== undefined);
    if (!axes.length) {
        return 'work-frame';
    }
    const within = (value: number | null, want: number) => value !== null && Math.abs(value - want) <= toleranceMm;
    if (axes.every((axis) => within(raw[axis] === null ? null : (raw[axis] as number) - offset[axis], expected[axis] as number))) {
        return 'work-frame';
    }
    const distinguishable = axes.some((axis) => Math.abs(offset[axis]) > toleranceMm);
    if (distinguishable && axes.every((axis) => within(raw[axis], expected[axis] as number))) {
        return 'machine-frame';
    }
    return null;
}

/** Machine coordinates implied by a report once its frame is known. */
export function machineFromReport(raw: NullableXyz, offset: Xyz, frame: 'work-frame' | 'machine-frame'): NullableXyz {
    const convert = (value: number | null, shift: number) => {
        if (value === null) {
            return null;
        }
        return frame === 'work-frame' ? value - shift : value;
    };
    return {
        x: convert(raw.x, offset.x),
        y: convert(raw.y, offset.y),
        z: convert(raw.z, offset.z),
    };
}

/** Whether a machine position lies within `toleranceMm` of `expected` on every axis. */
export function nearMachine(position: NullableXyz, expected: Xyz, toleranceMm: number): boolean {
    return AXES.every((axis) => position[axis] !== null && Math.abs((position[axis] as number) - expected[axis]) <= toleranceMm);
}

/**
 * The commanded axes of a move laid over the position it started from. The
 * result is a full machine position only when every uncommanded axis was
 * known; otherwise null (an estimate cannot invent an axis).
 */
export function completeTarget(from: NullableXyz, target: Partial<Xyz>): Xyz | null {
    const merged: NullableXyz = {
        x: target.x !== undefined ? target.x : from.x,
        y: target.y !== undefined ? target.y : from.y,
        z: target.z !== undefined ? target.z : from.z,
    };
    if (merged.x === null || merged.y === null || merged.z === null) {
        return null;
    }
    return { x: merged.x, y: merged.y, z: merged.z };
}

export type PositionSource = 'echo' | 'heartbeat' | 'estimated';

export interface PositionOfRecord {
    machine: Xyz;
    source: PositionSource;
    /** When the engine judged the move arrived (ms epoch). */
    at: number;
    /** Direct-gcode sequence number of the move; any later gcode voids the record. */
    sequence: number;
    tool: string;
    /**
     * Where the machine was before the move that set this record. A status
     * report still showing it was sampled before the move finished, whatever
     * its timestamp says (job de932e286afd, 2026-09-05: a 4 mm hop's echo
     * verified X174, the next beat - stamped 750 ms later - still read X178).
     */
    previousMachine: Xyz | null;
    /**
     * In which frame the report that set this record was read (matchFrame):
     * an echo taken inside a G53 window is 'machine-frame'. Estimates have
     * none. The frame latch is cleared only by a 'work-frame' record.
     */
    frame?: 'work-frame' | 'machine-frame';
}

let record: PositionOfRecord | null = null;

export function setPositionOfRecord(
    machine: Xyz,
    source: PositionSource,
    sequence: number,
    tool: string,
    frame?: 'work-frame' | 'machine-frame'
): PositionOfRecord {
    const previousMachine = record ? { ...record.machine } : null;
    record = {
        machine: { x: machine.x, y: machine.y, z: machine.z },
        source,
        at: Date.now(),
        sequence,
        tool,
        previousMachine,
        ...(frame ? { frame } : {}),
    };
    return record;
}

/**
 * The record, or null when gcode has gone to the machine since it was taken
 * (`currentSequence` is the direct-gcode counter now).
 */
export function getPositionOfRecord(currentSequence: number): PositionOfRecord | null {
    if (!record || record.sequence !== currentSequence) {
        return null;
    }
    return record;
}

export function clearPositionOfRecord(): void {
    record = null;
}

/** One heartbeat as the re-check sees it. */
export interface BeatObservation {
    /** When the machine state was received (ms epoch). */
    reportTime: number;
    raw: NullableXyz;
    offset: Xyz;
}

export type RecheckVerdict =
    | { verdict: 'pass'; frame: 'work-frame' | 'machine-frame' }
    | { verdict: 'pass'; frame: 'record'; record: PositionOfRecord }
    | { verdict: 'drift' }
    | { verdict: 'undecided'; stale?: boolean };

/** Two reports count as distinct beats only this far apart (the poll runs every 2 s). */
export const MIN_DISTINCT_BEAT_MS = 1000;

/** True when a report shows the position the machine held BEFORE the recorded move (either frame). */
export function reportShowsPreviousPosition(beat: BeatObservation, rec: PositionOfRecord | null, toleranceMm: number): boolean {
    if (!rec || !rec.previousMachine) {
        return false;
    }
    return matchFrame(beat.raw, beat.offset, rec.previousMachine, toleranceMm) !== null;
}

/**
 * Pure decision for a position re-check, given the beats seen so far (oldest
 * first) and the position of record if one is valid:
 *  - the newest beat matching in either frame passes;
 *  - a record that matches passes while the newest beat still predates it
 *    (the heartbeat has not caught up with a move the controller confirmed);
 *  - a beat still showing where the machine was BEFORE the recorded move is
 *    stale whatever its timestamp says (the poll samples the machine before
 *    the response is processed): never evidence of drift - keep reading;
 *  - two DISTINCT consecutive beats (>= MIN_DISTINCT_BEAT_MS apart - the same
 *    beat read twice once looked like two through 1 ms of clock jitter) that
 *    agree with each other yet match neither frame mean the machine really is
 *    elsewhere;
 *  - anything else is undecided: keep reading (the caller's deadline aborts).
 */
export function judgeRecheck(
    beats: BeatObservation[],
    expected: Xyz,
    toleranceMm: number,
    validRecord: PositionOfRecord | null
): RecheckVerdict {
    if (!beats.length) {
        return { verdict: 'undecided' };
    }
    const newest = beats[beats.length - 1];
    const frame = matchFrame(newest.raw, newest.offset, expected, toleranceMm);
    if (frame) {
        return { verdict: 'pass', frame };
    }
    if (validRecord && newest.reportTime <= validRecord.at && nearMachine(validRecord.machine, expected, toleranceMm)) {
        return { verdict: 'pass', frame: 'record', record: validRecord };
    }
    if (reportShowsPreviousPosition(newest, validRecord, toleranceMm)) {
        return { verdict: 'undecided', stale: true };
    }
    if (beats.length >= 2) {
        const previous = beats[beats.length - 2];
        const distinct = Math.abs(newest.reportTime - previous.reportTime) >= MIN_DISTINCT_BEAT_MS;
        const same = JSON.stringify([previous.raw, previous.offset]) === JSON.stringify([newest.raw, newest.offset]);
        if (distinct && same && !reportShowsPreviousPosition(previous, validRecord, toleranceMm)) {
            return { verdict: 'drift' };
        }
    }
    return { verdict: 'undecided' };
}

/**
 * Try several candidate offsets against one report; the first that yields a
 * frame match wins. Used by the engine so its echo check does not depend on
 * whatever offset the latest heartbeat happened to carry.
 */
export function matchFrameWithOffsets(
    raw: NullableXyz,
    offsets: Xyz[],
    expected: Partial<Xyz>,
    toleranceMm: number
): { frame: 'work-frame' | 'machine-frame'; offset: Xyz } | null {
    const seen = new Set<string>();
    for (const offset of offsets) {
        const key = `${offset.x},${offset.y},${offset.z}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const frame = matchFrame(raw, offset, expected, toleranceMm);
        if (frame) {
            return { frame, offset };
        }
    }
    return null;
}

/**
 * Judge an M114 reply after a no-motion G90/G54 restore (the pendant's
 * zero-segment run): the machine position it proves, or null. Only a WORK-frame
 * reading counts (2026-10-05 review): a reply that matches `expected` only as
 * raw machine coordinates is exactly what a controller still in G53 would say.
 * With a ~0 offset the two readings coincide and matchFrame already reports
 * work-frame - nothing can tell them apart then, and nothing claims to.
 */
export function judgeRestoredEcho(echo: NullableXyz, offsets: Xyz[], expected: Xyz, toleranceMm: number): Xyz | null {
    const match = matchFrameWithOffsets(echo, offsets, expected, toleranceMm);
    if (!match || match.frame !== 'work-frame') {
        return null;
    }
    return completeTarget(machineFromReport(echo, match.offset, match.frame), expected);
}

// The engine's own trusted work-origin offset: the offset that last made a
// controller echo (or a settled heartbeat) agree with a commanded machine
// target. Independent of the per-beat heartbeat value, which reads (0,0,0)
// or goes missing inside G53 windows (jobs 70b2b8c675a6 / 42df7b9351b7 and
// the 28 residual settle-waits of the run after them, all zero-offset).
let trustedOffset: Xyz | null = null;

export function setTrustedOffset(offset: Xyz): void {
    trustedOffset = { x: offset.x, y: offset.y, z: offset.z };
}

export function getTrustedOffset(): Xyz | null {
    return trustedOffset;
}

/** Forget the engine's trusted offset - on every (re)connection: work origins die on a machine reboot. */
export function clearTrustedOffset(): void {
    trustedOffset = null;
}

// Direct-gcode sequence: every send bumps it, and the position of record is
// valid only for the sequence it was recorded at (any other gcode invalidates
// it). It lives here, in the pure module, so tools/machine.ts can read it
// without importing the channel code in tools/camera.ts.
let gcodeSequence = 0;

export function bumpGcodeSequence(): number {
    gcodeSequence += 1;
    return gcodeSequence;
}

export function currentGcodeSequence(): number {
    return gcodeSequence;
}

// Direct-gcode activity, so the snapshot can tell a G53-window beat (a
// command is in flight, or replied within the last couple of seconds - the
// status poll's data may predate its processing) from a quiet beat.
let directGcodeInFlight = 0;
let lastDirectGcodeReplyAt: number | null = null;

export function noteDirectGcodeStart(): void {
    directGcodeInFlight += 1;
}

export function noteDirectGcodeEnd(): void {
    directGcodeInFlight = Math.max(0, directGcodeInFlight - 1);
    lastDirectGcodeReplyAt = Date.now();
}

/** True when no direct gcode is in flight and none replied within `quietMs`. */
export function directGcodeQuiet(quietMs: number): boolean {
    if (directGcodeInFlight > 0) {
        return false;
    }
    return lastDirectGcodeReplyAt === null || Date.now() - lastDirectGcodeReplyAt >= quietMs;
}

export type OffsetSource = 'heartbeat' | 'cached' | 'assumed-zero';

export interface OffsetJudgement {
    offset: Xyz;
    source: OffsetSource;
    /** True when a complete all-zero report was set aside as a G53-window transient. */
    transientZero: boolean;
    /** The cache the caller should keep after this report. */
    cache: Xyz | null;
}

/** Zero offsets must be reported on this many DISTINCT consecutive beats before a non-zero cache is replaced. */
export const ZERO_OFFSET_ACCEPT_BEATS = 3;

/**
 * Resolve the origin offset to use from one status report. Facts behind it
 * (all 2026-09-05): a beat inside a move's G53 window reports offsetX/Y/Z
 * as (0, 0, 0) with pos in machine coordinates (job 70b2b8c675a6: all 84
 * settle-waits carried offset 0,0,0; job 42df7b9351b7: the same beat made
 * a Z320 toolhead read as Z-8 and skipped the fast descent); a beat can
 * also carry no offset at all (job 44abebd9bab3). A genuine zero offset
 * (work origin at machine zero) is legal but PERSISTS, so a zero that
 * contradicts a non-zero offset seen on this connection is believed only
 * after `zeroStreak` distinct beats in a row reached ZERO_OFFSET_ACCEPT_BEATS.
 */
export function judgeOffsetReport(reported: NullableXyz, cached: Xyz | null, zeroStreak: number): OffsetJudgement {
    const complete = reported.x !== null && reported.y !== null && reported.z !== null;
    const allZero = complete && reported.x === 0 && reported.y === 0 && reported.z === 0;
    const cachedNonZero = cached !== null && (cached.x !== 0 || cached.y !== 0 || cached.z !== 0);
    if (complete && allZero && cachedNonZero && zeroStreak < ZERO_OFFSET_ACCEPT_BEATS) {
        return { offset: { ...(cached as Xyz) }, source: 'cached', transientZero: true, cache: cached };
    }
    if (complete) {
        const offset = { x: reported.x as number, y: reported.y as number, z: reported.z as number };
        return { offset, source: 'heartbeat', transientZero: false, cache: offset };
    }
    if (cached) {
        return { offset: { ...cached }, source: 'cached', transientZero: false, cache: cached };
    }
    return {
        offset: { x: reported.x || 0, y: reported.y || 0, z: reported.z || 0 },
        source: 'assumed-zero',
        transientZero: false,
        cache: null,
    };
}

/** Human-readable both-frame reading of a report, for abort messages. */
export function describeReport(raw: NullableXyz, offset: Xyz, offsetSource: string): string {
    const w = machineFromReport(raw, offset, 'work-frame');
    return `raw (${raw.x}, ${raw.y}, ${raw.z}) with offset (${offset.x}, ${offset.y}, ${offset.z}) from ${offsetSource}`
        + ` -> as work-frame machine (${w.x}, ${w.y}, ${w.z}); as machine-frame (${raw.x}, ${raw.y}, ${raw.z})`;
}

// Frame-uncertainty latch: the ONE record that the controller may still have
// the machine workspace (G53) selected. It is raised by whoever may have
// selected G53 and not proven it handed back: the USB pendant's queued run
// (BEFORE its G53 goes out, so a lost reply still counts), the failed-call
// cleanup hook (failureRecovery.ts) for a tool, runner or file job that may
// have left G53, and the persisted copy on a Luban restart. While set it
// refuses motion through requireReliableMachine (tools/machine.ts), refuses
// pendant arming, shows in get_position warnings and diagnostics, and IS the
// gcode lease's recovery hold (machine/gcodeLease.ts reads it directly). It
// clears only after an acknowledged G54 / G90+G54 restore (noteFrameRestored)
// AND a verified fresh position taken after it - the same path for every
// raiser, through getPositionSnapshot.
export interface FrameLatch {
    reason: string;
    since: number;
    /** When a work-frame restore was last acknowledged; null until then. */
    restoredAt: number | null;
}

/** A heartbeat must be received this long after the restore to count as sampled after it. */
export const FRAME_LATCH_BEAT_MS = 1000;

let frameLatch: FrameLatch | null = null;

// Listeners: tools/machine.ts persists the latch across Luban restarts; the
// pendant releases its held crash guard when the latch clears. Every change
// (raised, restore acknowledged, cleared) is reported.
type FrameLatchListener = (latch: FrameLatch | null) => void;
const frameLatchListeners = new Set<FrameLatchListener>();

/**
 * Subscribe to latch changes; returns the unsubscribe. `null` removes every
 * listener (test fixtures that reload the modules that subscribe).
 */
export function onFrameLatchChange(listener: FrameLatchListener | null): () => void {
    if (!listener) {
        frameLatchListeners.clear();
        return () => undefined;
    }
    frameLatchListeners.add(listener);
    return () => { frameLatchListeners.delete(listener); };
}

function notifyFrameLatch(): void {
    for (const listener of [...frameLatchListeners]) {
        try {
            listener(frameLatch ? { ...frameLatch } : null);
        } catch (err) {
            // A listener failure never leaves the latch itself in doubt.
        }
    }
}

export function latchFrameUncertain(reason: string, now: number = Date.now()): void {
    frameLatch = { reason, since: now, restoredAt: null };
    notifyFrameLatch();
}

export function noteFrameRestored(now: number = Date.now()): void {
    if (frameLatch) {
        frameLatch.restoredAt = now;
        notifyFrameLatch();
    }
}

export function getFrameLatch(): FrameLatch | null {
    return frameLatch ? { ...frameLatch } : null;
}

export function clearFrameLatch(): void {
    if (frameLatch) {
        frameLatch = null;
        notifyFrameLatch();
    }
}

/**
 * Pure: whether this evidence verifies a fresh position after the restore. A
 * controller-verified arrival (echo or settled heartbeat, not an estimate)
 * recorded after the restore AND read in the WORK frame, or an accepted
 * work-frame beat with a reported offset received at least FRAME_LATCH_BEAT_MS
 * after it. The frame requirement on the record matters (2026-10-05 review):
 * the pendant's settle writes its echo record after the G54 reply, but that
 * echo was read inside the G53 window as 'machine-frame' - it proves the
 * arrival, not the workspace. A record with no frame never clears the latch.
 */
export function frameLatchVerified(
    latch: FrameLatch,
    rec: PositionOfRecord | null,
    beat: { accepted: boolean; frame: string; offsetSource: string; reportedAt: number; declaredRun: boolean }
): boolean {
    if (latch.restoredAt === null) {
        return false;
    }
    if (rec && rec.source !== 'estimated' && rec.frame === 'work-frame' && rec.at >= latch.restoredAt) {
        return true;
    }
    return beat.accepted && !beat.declaredRun && beat.frame === 'work-frame' && beat.offsetSource === 'heartbeat'
        && beat.reportedAt >= latch.restoredAt + FRAME_LATCH_BEAT_MS;
}
