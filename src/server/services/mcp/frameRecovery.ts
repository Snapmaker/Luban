// Recovering the controller's coordinate FRAME, and the words used to tell an
// agent how.
//
// Why this exists (live 2026-09-19): an agent-authored job declared `G53` and
// never selected a work workspace again, so the controller kept reporting in
// the machine workspace. Every heartbeat then carried machine coordinates in
// its raw fields WITH the work-origin offset still populated, `raw - offset`
// fell outside the travel, and the position of record judged every beat
// incoherent - permanently. Motion and staging refuse while the position is
// `awaiting-resync`, so the one thing that would have fixed it - a no-motion
// `G54` - was refused too, and only a re-home cleared the state.
//
// Pure: no server imports, unit-tested in tests/frameRecovery.test.ts.

/**
 * The no-motion program that puts the controller back in the work workspace.
 * `G90` first so the file declares its distance mode (the validator refuses a
 * file that assumes one), then `G54` on its own line - this controller does
 * not honour an inline `G53`/`G54` carried on a motion line, and every MCP
 * emitter uses the same "code on its own line" form.
 *
 * Deliberately contains no axis word: restoring the frame must never move the
 * machine, which is exactly why it is allowed to run when nothing else is.
 */
export const WORK_FRAME_RESTORE_GCODE = 'G90\nG54;';

/** Reliability values, mirrored from machinePosition.ts to keep this module pure. */
export type ReliabilityName = 'verified' | 'heartbeat' | 'cached-offset' | 'awaiting-resync' | 'stale';

/**
 * What an agent should DO about a position it may not act on. The remedy has
 * to be named in the refusal itself: the session that hit this read the
 * refusal, correctly concluded the position was untrustworthy, and had no way
 * to learn that a no-motion frame restore was both possible and permitted.
 */
export function resyncHint(reliability: ReliabilityName): string {
    if (reliability === 'awaiting-resync') {
        return ' Wait for the next status report (2 s) and read get_position again. If it persists, the controller is '
            + 'probably still in the machine workspace after a G53 job: call restore_work_frame (no motion, allowed '
            + 'while the position is incoherent) and read get_position again. query_firmware_position shows which '
            + 'frame the controller is actually in. A re-home is not the remedy.';
    }
    if (reliability === 'stale') {
        return ' Reconnect the machine and re-verify get_position before any motion.';
    }
    return '';
}

/** True when `restore_work_frame` is worth running rather than waiting. */
export function frameRestoreIsWorthTrying(reliability: ReliabilityName): boolean {
    return reliability === 'awaiting-resync' || reliability === 'stale';
}

/** A work offset no larger than this on every axis makes the work and machine frames indistinguishable. */
export const FRAME_VERIFY_MIN_OFFSET_MM = 0.5;

/** One status-poll period: a beat must be stamped at least this long after the restore reply to count. */
export const FRAME_VERIFY_MIN_BEAT_DELAY_MS = 2000;

/**
 * How far a status report taken after a `G54` proves the controller is in the
 * work workspace. Most to least conclusive:
 *  - verified: a fresh beat reads as a work position AND its raw fields are
 *    impossible as a machine position, so only the work frame fits it;
 *  - consistent-unverified: a fresh work-frame beat that would ALSO be a legal
 *    machine position (the judge spots G53 only when raw - offset is absurd);
 *  - unverifiable-zero-offset: the work offset is ~0, both frames read alike;
 *  - no-fresh-beat: no beat-judged frame stamped a poll period after the reply
 *    (also an incoherent beat, a stale connection, or a move echo outranking it);
 *  - machine-frame: a fresh beat still carries the sustained G53 signature.
 */
export type WorkspaceVerification =
    | 'verified'
    | 'consistent-unverified'
    | 'unverifiable-zero-offset'
    | 'no-fresh-beat'
    | 'machine-frame';

/** The position-of-record fields the verification reads. */
export interface FrameReading {
    reliability: ReliabilityName | string;
    /** machinePosition FrameJudgement: 'work-frame' | 'machine-frame' | 'undetermined'. */
    frame: string;
    /** Beat time the judged position rests on (the snapshot's machineReportedAt). */
    reportedAt: number | null;
    originOffset: { x: number; y: number; z: number };
    /** The raw report, read AS a machine position, is outside the travel. */
    rawImpossibleAsMachine: boolean;
}

/**
 * Judge the controller's workspace from the first reading after a frame
 * restore whose reply arrived at `replyAt`. Conservative: anything short of
 * `verified` is not proof. The same rule the failed-call cleanup
 * (failureRecovery.ts) applies inline.
 *
 * A `verified` reliability is a controller echo of a move: its frame label
 * describes the echo, not the workspace, so it never counts as a beat here.
 */
export function verifyWorkFrame(reading: FrameReading | null, replyAt: number): WorkspaceVerification {
    if (!reading || reading.reportedAt === null || reading.reliability === 'stale' || reading.reliability === 'verified'
        || reading.reportedAt < replyAt + FRAME_VERIFY_MIN_BEAT_DELAY_MS) {
        return 'no-fresh-beat';
    }
    if (reading.frame === 'machine-frame') {
        return 'machine-frame';
    }
    if (reading.frame !== 'work-frame') {
        // An undetermined (rejected) beat: the judge holds an older position.
        return 'no-fresh-beat';
    }
    const { x, y, z } = reading.originOffset;
    if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= FRAME_VERIFY_MIN_OFFSET_MM) {
        return 'unverifiable-zero-offset';
    }
    return reading.rawImpossibleAsMachine ? 'verified' : 'consistent-unverified';
}

/** What the agent should do next, per verification outcome. */
export function workFrameVerificationNote(verification: WorkspaceVerification, reliability: string): string {
    switch (verification) {
        case 'verified':
            return 'The controller is back in the work workspace: a status report taken after the restore is only possible '
                + `in the work frame. The position of record is ${reliability}; continue with get_position as usual.`;
        case 'consistent-unverified':
            return 'G54 was accepted and the report after it reads as a work position, but the same raw numbers would also be '
                + 'a legal machine position, so the frame is NOT proven. Call query_firmware_position and compare its M114 '
                + 'with get_position before trusting the frame; tell the operator if they disagree.';
        case 'unverifiable-zero-offset':
            return 'G54 was accepted, but the work offset is ~0 (0.5 mm or less on every axis), so the work and machine frames '
                + 'read alike and no status report can tell them apart. The frame is unverifiable, not wrong: if a work '
                + 'origin should be set, confirm it with the operator before relying on work coordinates.';
        case 'machine-frame':
            return 'The controller STILL reports in the machine workspace after the restore. Do not move. Check the machine '
                + 'is idle, call query_firmware_position to see which frame it is in, and tell the operator. A re-home is not '
                + 'the remedy.';
        case 'no-fresh-beat':
        default:
            return `No status report judged after the restore yet (position of record ${reliability}). Wait about 2 s and `
                + 'read get_position again; if it shows the machine frame, call restore_work_frame again; if it is stale, '
                + 'reconnect the machine. Do not move until it is coherent.';
    }
}

/** The fields of the active MCP job a frame-restore guard reads (jobs.ts McpJob). */
export interface ActiveJobView {
    id: string;
    name: string;
    kind: string;
    state: string;
}

/**
 * restore_work_frame sends `G90` + `G54` straight to the controller. While a
 * job is starting or running, that would land INSIDE its program and change
 * the frame and distance mode under it, so the restore is refused and nothing
 * is sent. Returns the refusal text, or null when the restore may go ahead.
 */
export function frameRestoreJobRefusal(job: ActiveJobView | null): string | null {
    if (!job || (job.state !== 'starting' && job.state !== 'started')) {
        return null;
    }
    return `Refusing restore_work_frame: the ${job.kind} job ${job.id} ("${job.name}") is ${job.state}, and G90/G54 sent now `
        + 'would be injected into its program. Nothing was sent. Wait for the job to end (get_gcode_job_status) or stop it '
        + '(stop_gcode_job), then call restore_work_frame again.';
}
