// Machine position of record: ONE judged machine-frame position with a
// reliability state, derived from the heartbeat by rules an agent can read
// back, so no consumer ever does `work - offset` on a single beat by hand.
//
// Why (operator law 2026-09-14): the HTTP channel sends a move as `G90` /
// `G53;` / `G1 ...` / `G54;` - four requests - and the 2 s status poll can
// land inside that window. Such a beat may carry machine coordinates with the
// offset still populated (subtracting produced Z 555 / Z 656), the offset
// zeroed, or no offset at all. getPositionSnapshot used to flag the result in
// a `warnings` string that no code read and return the bad number anyway, so
// a Z 555 artefact passed the traverse-height guard and every landmark
// clearance check. The Luban console printed its own unguarded copy of the
// subtraction - the ">500" line the operator complains about.
//
// The operator's rules, verbatim in effect:
//   - the machine sometimes reports work-origin-based coordinates; those beats
//     are to be IGNORED, never reinterpreted - the next coherent sync rectifies;
//   - any coordinate more than 50 mm outside machine bounds is a MISTAKE, a
//     bug and never a position;
//   - the controller's own echo of a commanded move (positionOfRecord) outranks
//     any beat.
//
// Pure module: no server imports, unit-tested in tests/machinePosition.test.ts.
import { AXES, Axis, NullableXyz, OffsetJudgement, Xyz, judgeOffsetReport, ZERO_OFFSET_ACCEPT_BEATS } from './positionOfRecord';

export type Reliability = 'verified' | 'heartbeat' | 'cached-offset' | 'awaiting-resync' | 'stale';
export type FrameJudgement = 'machine-frame' | 'work-frame' | 'undetermined';
export type RejectReason = 'out-of-bounds' | 'frame-flip' | 'no-offset-yet' | 'declared-run-ambiguous';

/** A derived machine coordinate this far outside the travel is a bug, not a position (operator, 2026-09-14). */
export const BOUNDS_MARGIN_MM = 50;

/**
 * Consecutive beats carrying the machine-frame signature before the report is
 * believed AS machine coordinates rather than ignored.
 *
 * One such beat is the ordinary G53-window artefact: the HTTP channel sends a
 * move as four requests and the poll lands inside them, so the next beat
 * rectifies. But a job that declares G53 and never selects a work workspace
 * again leaves the controller there PERMANENTLY, and then every beat is
 * rejected for ever - the position of record never recovers, motion and
 * staging refuse indefinitely, and the no-motion G54 that would fix it is
 * refused too. Live 2026-09-19 the only way out was a re-home.
 *
 * Three beats (~6 s at the 2 s poll) is far longer than any send window and
 * still well short of a wait anyone would notice.
 */
export const SUSTAINED_MACHINE_FRAME_BEATS = 3;

/** An offset smaller than this on every axis cannot tell the two frames apart. */
export const MACHINE_FRAME_OFFSET_TOLERANCE_MM = 0.5;

export interface MachineBounds {
    min: Xyz;
    max: Xyz;
}

/**
 * A run that holds the machine workspace on purpose (the USB pendant's queued
 * G53 window, pendantRuntime.ts). Beats received inside it report MACHINE
 * coordinates, so they are judged as such instead of by the work-frame rules,
 * which would accept an in-bounds G53 beat as a work position (off by the
 * offset) or reject it and hold a stale position. The holder declares it only
 * between its G53 reply and its closing G54 send, and gives the envelope the
 * machine must be inside.
 */
export interface DeclaredMachineFrameRun {
    envelope: MachineBounds;
    marginMm: number;
}

export interface AcceptedPosition {
    machine: Xyz;
    reportedAt: number;
}

export interface BeatInput {
    /** Raw x/y/z fields of the status report. */
    raw: NullableXyz;
    /** offsetX/Y/Z as the report carried them (null = absent). */
    offsetReported: NullableXyz;
    /** Last complete offset believed on this connection. */
    cachedOffset: Xyz | null;
    /** Distinct consecutive quiet beats that reported an all-zero offset (positionOfRecord.judgeOffsetReport). */
    zeroStreak: number;
    /** Raw fields of the previous ACCEPTED beat, for the frame-flip signature. */
    previousRaw: Xyz | null;
    bounds: MachineBounds | null;
    reportedAt: number;
    now: number;
    staleMs: number;
    lastAccepted: AcceptedPosition | null;
    /** Controller-echo position of record still valid for the current gcode sequence, if any. */
    verified: Xyz | null;
    /** Consecutive PRIOR beats that carried the machine-frame signature (judgeBeatStateful keeps it). */
    machineFrameStreak: number;
    /** Set while a declared machine-frame run covers this beat. */
    declaredRun?: DeclaredMachineFrameRun | null;
}

export interface BeatJudgement {
    /** The judged machine position: derived when the beat is accepted, the last accepted position when it is not. */
    machine: NullableXyz;
    /** Beat timestamp the judged position comes from (the held position's own time when rejected). */
    machineReportedAt: number | null;
    frame: FrameJudgement;
    reliability: Reliability;
    accepted: boolean;
    rejectedReason: RejectReason | null;
    offset: OffsetJudgement;
    /** raw - offset, always, for diagnostics - NOT for motion. */
    derived: NullableXyz;
    /** Axes on which `derived` sits more than BOUNDS_MARGIN_MM outside the travel. */
    outsideAxes: Axis[];
    reasons: string[];
    /** What the caller should hold as lastAccepted after this beat. */
    nextAccepted: AcceptedPosition | null;
    /**
     * This beat reads as a legal MACHINE position while its work-frame reading
     * is impossible - the signature of a controller left in the machine
     * workspace. The caller counts these to decide when it is not a transient.
     */
    machineFrameSuspect: boolean;
    /** Judged under a declared machine-frame run (raw = machine coordinates). */
    declaredRun: boolean;
}

function complete(v: NullableXyz): v is Xyz {
    return v.x !== null && v.y !== null && v.z !== null;
}

/** Axes on which a machine coordinate lies more than `margin` outside [min, max]. */
export function outsideBounds(machine: NullableXyz, bounds: MachineBounds | null, margin: number = BOUNDS_MARGIN_MM): Axis[] {
    if (!bounds) {
        return [];
    }
    return AXES.filter((axis) => {
        const v = machine[axis];
        return v !== null && (v < bounds.min[axis] - margin || v > bounds.max[axis] + margin);
    });
}

/**
 * The frame-flip signature (moved here from diagnostics.ts): a report in the
 * other frame differs from the previous one by exactly the offset on every
 * axis the offset is non-zero on. No real move does that on all axes at once.
 */
export function isFrameFlip(raw: Xyz, previousRaw: Xyz, offset: Xyz, toleranceMm: number = 0.5): boolean {
    const axes = AXES.filter((axis) => Math.abs(offset[axis]) > toleranceMm);
    if (!axes.length) {
        return false;
    }
    const delta = { x: raw.x - previousRaw.x, y: raw.y - previousRaw.y, z: raw.z - previousRaw.z };
    return axes.every((axis) => Math.abs(delta[axis] + offset[axis]) <= toleranceMm)
        || axes.every((axis) => Math.abs(delta[axis] - offset[axis]) <= toleranceMm);
}

function machineBeatsText(beats: number): string {
    return `${beats} consecutive beat${beats === 1 ? '' : 's'}`;
}

/**
 * What the caller holds as the last accepted position. A sustained
 * machine-frame beat updates it too: its raw fields are the machine position,
 * and holding a position from before the frame broke would strand the record
 * wherever the machine happened to be minutes ago.
 */
function nextAcceptedFrom(
    input: BeatInput,
    derived: NullableXyz,
    accepted: boolean,
    stale: boolean,
    sustainedMachineFrame: boolean
): AcceptedPosition | null {
    if (stale) {
        return input.lastAccepted;
    }
    if (accepted && complete(derived)) {
        return { machine: { x: derived.x, y: derived.y, z: derived.z }, reportedAt: input.reportedAt };
    }
    if (sustainedMachineFrame && complete(input.raw)) {
        return { machine: { ...input.raw }, reportedAt: input.reportedAt };
    }
    return input.lastAccepted;
}

const NULLS: NullableXyz = { x: null, y: null, z: null };

/**
 * A beat inside a declared machine-frame run: raw IS the machine position when
 * it lies inside the run's envelope. If the work-frame reading (raw - offset)
 * would ALSO lie inside it and the offset can tell the frames apart, the beat
 * may have been sampled before the G53 took effect: it is ambiguous, set aside,
 * and the last accepted position is held. Neither reading inside: set aside.
 */
function judgeDeclaredRun(input: BeatInput, offset: OffsetJudgement, derived: NullableXyz, stale: boolean): BeatJudgement {
    const run = input.declaredRun as DeclaredMachineFrameRun;
    const reasons: string[] = [];
    const inside = (p: NullableXyz) => complete(p) && outsideBounds(p, run.envelope, run.marginMm).length === 0;
    const distinguishable = AXES.some((axis) => Math.abs(offset.offset[axis]) > MACHINE_FRAME_OFFSET_TOLERANCE_MM);
    const asMachine = inside(input.raw);
    const accepted = asMachine && (!distinguishable || !inside(derived));
    let machine: NullableXyz;
    let machineReportedAt: number | null;
    let reliability: Reliability;
    let frame: FrameJudgement;
    if (input.verified) {
        machine = { ...input.verified };
        machineReportedAt = input.reportedAt;
        frame = 'machine-frame';
        reliability = 'verified';
    } else if (accepted) {
        machine = { ...(input.raw as Xyz) };
        machineReportedAt = input.reportedAt;
        frame = 'machine-frame';
        reliability = 'heartbeat';
        reasons.push('Declared machine-frame run (USB pendant queued jog): the report carries machine coordinates and is used as such.');
    } else {
        machine = input.lastAccepted ? { ...input.lastAccepted.machine } : { ...NULLS };
        machineReportedAt = input.lastAccepted ? input.lastAccepted.reportedAt : null;
        frame = 'undetermined';
        reliability = 'awaiting-resync';
        reasons.push(asMachine
            ? 'Declared machine-frame run: this report reads as inside the run envelope in BOTH frames, so it may predate the '
                + 'G53. Set aside; the last accepted position is held.'
            : 'Declared machine-frame run: this report is outside the run envelope as machine coordinates. Set aside; the last '
                + 'accepted position is held.');
    }
    if (stale) {
        reliability = 'stale';
        reasons.push(`STALE: the last status report is ${((input.now - input.reportedAt) / 1000).toFixed(0)}s old.`);
    }
    return {
        machine,
        machineReportedAt,
        frame,
        reliability,
        accepted,
        rejectedReason: accepted ? null : 'declared-run-ambiguous',
        offset,
        derived,
        outsideAxes: [],
        reasons,
        machineFrameSuspect: false,
        declaredRun: true,
        nextAccepted: stale || !accepted ? input.lastAccepted : { machine: { ...(input.raw as Xyz) }, reportedAt: input.reportedAt },
    };
}

/** Judge one status report. Pure. */
export function judgeBeat(input: BeatInput): BeatJudgement {
    const offset = judgeOffsetReport(input.offsetReported, input.cachedOffset, input.zeroStreak);
    const derived: NullableXyz = {
        x: input.raw.x === null ? null : input.raw.x - offset.offset.x,
        y: input.raw.y === null ? null : input.raw.y - offset.offset.y,
        z: input.raw.z === null ? null : input.raw.z - offset.offset.z,
    };
    const reasons: string[] = [];
    let rejectedReason: RejectReason | null = null;

    if (offset.source === 'assumed-zero') {
        rejectedReason = 'no-offset-yet';
        reasons.push('No work-origin offset has been reported on this connection yet; a machine position cannot be derived '
            + 'without assuming one, and nothing is assumed.');
    }
    if (!rejectedReason && complete(input.raw) && input.previousRaw && complete(input.offsetReported)
        && isFrameFlip(input.raw, input.previousRaw, input.offsetReported)) {
        rejectedReason = 'frame-flip';
        reasons.push(`Status report jumped by exactly the origin offset: raw (${input.raw.x}, ${input.raw.y}, ${input.raw.z}) after `
            + `(${input.previousRaw.x}, ${input.previousRaw.y}, ${input.previousRaw.z}) with offset (${input.offsetReported.x}, `
            + `${input.offsetReported.y}, ${input.offsetReported.z}) - a poll inside a G53 window, or the return from one. Ignored.`);
    }
    const derivedOutside = outsideBounds(derived, input.bounds);
    const outsideAxes = rejectedReason ? [] : derivedOutside;
    if (!rejectedReason && outsideAxes.length) {
        rejectedReason = 'out-of-bounds';
        reasons.push(`Derived machine ${outsideAxes.join('/')} (${outsideAxes.map((a) => `${a}=${(derived[a] as number).toFixed(1)}`).join(', ')}) `
            + `is more than ${BOUNDS_MARGIN_MM} mm outside the travel - a mistake, not a position (the controller reported `
            + 'work-origin-based or workspace-less coordinates). Ignored; the next coherent report rectifies it.');
    }
    if (offset.transientZero) {
        reasons.push(`The report carried a zero work-origin offset while this connection has seen (${offset.offset.x}, `
            + `${offset.offset.y}, ${offset.offset.z}) - a G53-window transient; the last complete offset is used (a zero is `
            + `believed after ${ZERO_OFFSET_ACCEPT_BEATS} consecutive quiet beats).`);
    } else if (offset.source === 'cached') {
        reasons.push(`The report carried no work-origin offset; the last complete offset (${offset.offset.x}, ${offset.offset.y}, `
            + `${offset.offset.z}) is used. Re-read before trusting a position CHECK.`);
    }

    const stale = input.now - input.reportedAt > input.staleMs;
    if (input.declaredRun && rejectedReason !== 'no-offset-yet') {
        return judgeDeclaredRun(input, offset, derived, stale);
    }
    const accepted = rejectedReason === null && complete(derived);

    // The machine-frame signature: the raw fields read as a legal machine
    // position while the work-frame reading (raw - offset) is impossible, and
    // the offset is big enough to tell the two apart. One such beat is the
    // ordinary G53-window artefact; a run of them means the controller was
    // left in the machine workspace and no amount of waiting will rectify it.
    const offsetDistinguishable = AXES.some((axis) => Math.abs(offset.offset[axis]) > MACHINE_FRAME_OFFSET_TOLERANCE_MM);
    const machineFrameSuspect = rejectedReason !== null
        && rejectedReason !== 'no-offset-yet'
        && complete(input.raw)
        && derivedOutside.length > 0
        && outsideBounds(input.raw, input.bounds).length === 0
        && offsetDistinguishable;
    const machineFrameBeats = machineFrameSuspect ? input.machineFrameStreak + 1 : 0;
    const sustainedMachineFrame = machineFrameBeats >= SUSTAINED_MACHINE_FRAME_BEATS;

    let reliability: Reliability;
    let machine: NullableXyz;
    let machineReportedAt: number | null;
    let frame: FrameJudgement;

    if (input.verified) {
        machine = { ...input.verified };
        machineReportedAt = input.reportedAt;
        frame = 'machine-frame';
        reliability = 'verified';
        if (rejectedReason) {
            reasons.push('The controller\'s own echo of the last commanded move outranks this beat.');
        }
    } else if (accepted) {
        machine = derived;
        machineReportedAt = input.reportedAt;
        frame = 'work-frame';
        reliability = offset.source === 'heartbeat' ? 'heartbeat' : 'cached-offset';
    } else if (sustainedMachineFrame) {
        // Believed AS machine coordinates: that reading is legal, the work
        // reading is impossible, and it has held for long enough not to be a
        // send window. The position is usable - the FRAME is what is broken.
        machine = { ...(input.raw as Xyz) };
        machineReportedAt = input.reportedAt;
        frame = 'machine-frame';
        reliability = 'heartbeat';
        reasons.push(`The controller has reported in the MACHINE workspace for ${machineBeatsText(machineFrameBeats)} - a job `
            + 'declared G53 and never selected a work workspace again, so the heartbeat carries machine coordinates while the '
            + 'work-origin offset is still populated. These raw fields ARE the machine position and are used as such; the '
            + 'work coordinates and the offset are not to be trusted until the frame is handed back. Call restore_work_frame '
            + '(no motion) to fix it - a re-home is not the remedy.');
    } else {
        machine = input.lastAccepted ? { ...input.lastAccepted.machine } : { ...NULLS };
        machineReportedAt = input.lastAccepted ? input.lastAccepted.reportedAt : null;
        frame = 'undetermined';
        reliability = 'awaiting-resync';
        reasons.push(input.lastAccepted
            ? `Holding the last accepted machine position (${input.lastAccepted.machine.x}, ${input.lastAccepted.machine.y}, `
                + `${input.lastAccepted.machine.z}) from ${((input.now - input.lastAccepted.reportedAt) / 1000).toFixed(1)}s ago until a `
                + 'coherent report arrives. Motion and staging are refused meanwhile.'
            : 'No accepted machine position yet on this connection. Motion and staging are refused until a coherent report arrives.');
    }
    if (stale) {
        reliability = 'stale';
        reasons.push(`STALE: the last status report is ${((input.now - input.reportedAt) / 1000).toFixed(0)}s old (poll period 2 s) - the `
            + 'machine connection has likely dropped without the server noticing (observed live 2026-09-02). Do NOT trust this '
            + 'position; reconnect and re-verify before any motion.');
    }

    return {
        machine,
        machineReportedAt,
        frame,
        reliability,
        accepted,
        rejectedReason,
        offset,
        derived,
        outsideAxes,
        reasons,
        machineFrameSuspect,
        declaredRun: false,
        nextAccepted: nextAcceptedFrom(input, derived, accepted, stale, sustainedMachineFrame),
    };
}



/** True when the judgement allows motion to be staged or started on its machine position. */
export function reliableForMotion(reliability: Reliability): boolean {
    return reliability === 'verified' || reliability === 'heartbeat' || reliability === 'cached-offset';
}

// ---------------------------------------------------------------------------
// Stateful wrapper: one instance per server, reset on every (re)connection.

export interface RawBeat {
    raw: NullableXyz;
    offsetReported: NullableXyz;
    reportedAt: number;
}

export interface JudgeContext {
    now: number;
    staleMs: number;
    bounds: MachineBounds | null;
    verified: Xyz | null;
    /** No direct gcode in flight or recently replied - only such beats count toward believing a zero offset. */
    directGcodeQuiet: boolean;
    /** A declared machine-frame run covering this beat (by its receive time), if any. */
    declaredRun?: DeclaredMachineFrameRun | null;
}

export interface MachinePositionState {
    cachedOffset: (Xyz & { at: number }) | null;
    zeroStreak: number;
    zeroSeenAt: number | null;
    zeroTransients: number;
    previousRaw: Xyz | null;
    lastAccepted: AcceptedPosition | null;
    lastBeatAt: number | null;
    /** Consecutive beats carrying the machine-frame signature (judgeBeat's machineFrameSuspect). */
    machineFrameStreak: number;
    /** Inputs of the last distinct beat, so repeated reads of the same beat re-judge (staleness moves) without mutating. */
    lastInput: Omit<BeatInput, 'now' | 'verified'> | null;
    lastJudgement: BeatJudgement | null;
    rejected: { outOfBounds: number; frameFlip: number; noOffsetYet: number };
    /** Rejected -> accepted transitions ("rectified on the next sync"). */
    resyncs: number;
    disconnects: number;
    resetAt: number | null;
}

export function createMachinePositionState(): MachinePositionState {
    return {
        cachedOffset: null,
        zeroStreak: 0,
        zeroSeenAt: null,
        zeroTransients: 0,
        previousRaw: null,
        machineFrameStreak: 0,
        lastAccepted: null,
        lastBeatAt: null,
        lastInput: null,
        lastJudgement: null,
        rejected: { outOfBounds: 0, frameFlip: 0, noOffsetYet: 0 },
        resyncs: 0,
        disconnects: 0,
        resetAt: null,
    };
}

/** Forget everything learnt on the previous connection (work origins die on a machine reboot). */
export function resetMachinePositionState(state: MachinePositionState, now: number): void {
    const keep = { disconnects: state.disconnects, resyncs: state.resyncs, rejected: state.rejected, zeroTransients: state.zeroTransients };
    Object.assign(state, createMachinePositionState(), keep, { resetAt: now });
}

export function noteDisconnected(state: MachinePositionState, now: number): void {
    if (state.lastBeatAt !== null || state.cachedOffset !== null) {
        state.disconnects += 1;
        resetMachinePositionState(state, now);
    }
}

/**
 * Judge the latest beat, updating the state once per DISTINCT beat (by its
 * timestamp). Re-reading the same beat re-evaluates staleness and the
 * verified record but never advances streaks or the previous-raw memory.
 */
export function judgeBeatStateful(state: MachinePositionState, beat: RawBeat, ctx: JudgeContext): BeatJudgement {
    const isNewBeat = beat.reportedAt !== state.lastBeatAt;
    if (isNewBeat) {
        const reportedAllZero = complete(beat.offsetReported)
            && beat.offsetReported.x === 0 && beat.offsetReported.y === 0 && beat.offsetReported.z === 0;
        if (reportedAllZero) {
            if (state.zeroSeenAt !== beat.reportedAt) {
                state.zeroSeenAt = beat.reportedAt;
                state.zeroStreak = ctx.directGcodeQuiet ? state.zeroStreak + 1 : 0;
            }
        } else {
            state.zeroStreak = 0;
            state.zeroSeenAt = null;
        }
        state.lastInput = {
            raw: beat.raw,
            offsetReported: beat.offsetReported,
            cachedOffset: state.cachedOffset ? { x: state.cachedOffset.x, y: state.cachedOffset.y, z: state.cachedOffset.z } : null,
            zeroStreak: state.zeroStreak,
            machineFrameStreak: state.machineFrameStreak,
            previousRaw: state.previousRaw,
            bounds: ctx.bounds,
            reportedAt: beat.reportedAt,
            staleMs: ctx.staleMs,
            lastAccepted: state.lastAccepted,
        };
    }
    const input: BeatInput = { ...(state.lastInput as Omit<BeatInput, 'now' | 'verified'>),
        now: ctx.now,
        verified: ctx.verified,
        bounds: ctx.bounds,
        staleMs: ctx.staleMs,
        declaredRun: ctx.declaredRun ?? null };
    const judgement = judgeBeat(input);

    if (isNewBeat) {
        if (judgement.offset.source === 'heartbeat' && judgement.offset.cache) {
            state.cachedOffset = { ...judgement.offset.cache, at: beat.reportedAt };
        }
        if (judgement.offset.transientZero) {
            state.zeroTransients += 1;
        }
        if (judgement.rejectedReason === 'out-of-bounds') state.rejected.outOfBounds += 1;
        if (judgement.rejectedReason === 'frame-flip') state.rejected.frameFlip += 1;
        if (judgement.rejectedReason === 'no-offset-yet') state.rejected.noOffsetYet += 1;
        if (judgement.accepted && state.lastJudgement && !state.lastJudgement.accepted) {
            state.resyncs += 1;
        }
        // The flip test compares against the last ACCEPTED raw: after a
        // machine-frame artefact the next correct beat differs from it by
        // exactly the offset (the return from the G53 window) and would be
        // mistaken for a flip itself, costing a second beat.
        // A declared-run beat is machine-frame raw: never the work-frame flip reference.
        if (judgement.accepted && !judgement.declaredRun && complete(beat.raw)) {
            state.previousRaw = { x: beat.raw.x, y: beat.raw.y, z: beat.raw.z };
        }
        state.machineFrameStreak = judgement.machineFrameSuspect ? state.machineFrameStreak + 1 : 0;
        state.lastAccepted = judgement.nextAccepted;
        state.lastBeatAt = beat.reportedAt;
        state.lastJudgement = judgement;
    }
    return judgement;
}
