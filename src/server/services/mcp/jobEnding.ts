// Why a job ended, as a structured record on the job (operator request
// 2026-09-14: a stopped run must keep its results AND say why it stopped -
// finished, stopped by the agent, door/pause, alarm, failure in operation).
// Pure: unit-tested in tests/jobEnding.test.ts.

/**
 * Job lifecycle state. Lives here rather than in jobs.ts so the pure stop
 * planner below can reason about it without importing the server-bound job
 * manager; jobs.ts re-exports both names.
 */
export type McpJobState =
    | 'awaiting_confirmation'
    | 'approved'
    | 'rejected'
    | 'starting'
    | 'start_unverified'
    | 'started'
    | 'start_failed'
    | 'stopped'
    | 'completed';

export type McpJobKind = 'file' | 'direct' | 'procedure';

export const TERMINAL_JOB_STATES: McpJobState[] = ['rejected', 'start_failed', 'stopped', 'completed'];

export type JobEndingKind =
    | 'completed'
    | 'stopped-by-agent'
    | 'stopped-by-operator'
    | 'withdrawn'
    | 'rejected-by-operator'
    | 'crash-alarm'
    | 'overtravel-alarm'
    | 'unexpected-contact'
    | 'controller-rejected'
    /** A file job whose machine Z assumed a workspace offset that did not verify before streaming. */
    | 'workspace-unverified'
    | 'timeout'
    | 'operation-failure'
    | 'machine-stopped'
    | 'completion-unverified';

export interface JobEnding {
    kind: JobEndingKind;
    /** Human-readable cause, e.g. the abort message or "operator rejected on the confirm page". */
    reason: string;
    at: number;
    /** Set for procedures: how many stations / contacts / ops were measured before the end. */
    measured?: number;
    /** The sensor channel that tripped an alarm. */
    channel?: string;
}

export interface ProcedureEndingInput {
    message: string;
    /** Reason of a pending stop request (requestProcedureStop), or null. */
    stopReason: string | null;
    /** A latched safety trip, or null. */
    trip: { kind: 'overtravel' | 'crash'; channel?: string } | null;
    at: number;
    measured?: number;
}

/** Classify how a procedure ended from its abort message and the guard state. */
export function classifyProcedureEnding(input: ProcedureEndingInput): JobEnding {
    const base = { reason: input.message, at: input.at, measured: input.measured };
    if (input.trip) {
        return { ...base, kind: input.trip.kind === 'crash' ? 'crash-alarm' : 'overtravel-alarm', channel: input.trip.channel };
    }
    if (input.stopReason) {
        const byAgent = /agent/i.test(input.stopReason);
        return { ...base, kind: byAgent ? 'stopped-by-agent' : 'stopped-by-operator', reason: `${input.stopReason}: ${input.message}` };
    }
    if (/UNEXPECTED CONTACT/i.test(input.message)) {
        return { ...base, kind: 'unexpected-contact' };
    }
    if (/controller rejected/i.test(input.message)) {
        return { ...base, kind: 'controller-rejected' };
    }
    if (/timed out|not confirmed within/i.test(input.message)) {
        return { ...base, kind: 'timeout' };
    }
    return { ...base, kind: 'operation-failure' };
}

/** Count what a partial/complete procedure result measured, for the ending record. */
export function countMeasured(result: unknown): number | undefined {
    if (!result || typeof result !== 'object') {
        return undefined;
    }
    const r = result as { stations?: unknown; results?: unknown; ops?: unknown; contacts?: unknown };
    const list = [r.stations, r.results, r.ops, r.contacts].find((v) => Array.isArray(v)) as unknown[] | undefined;
    if (!list) {
        return undefined;
    }
    return list.filter((item) => {
        if (!item || typeof item !== 'object') {
            return false;
        }
        const it = item as { status?: unknown; z?: unknown; contactMachine?: unknown };
        if (it.status !== undefined) {
            return it.status === 'contact' || it.status === 'completed' || it.status === 'ok';
        }
        return it.z !== undefined || it.contactMachine !== undefined;
    }).length;
}

/**
 * What stopping a job should actually DO, given its kind and state.
 *
 * Before this, only an un-started PROCEDURE was withdrawn; a staged `file` or
 * `direct` job fell through to the firmware stop, which stops nothing when
 * nothing is running - so the job kept its `approved` state and its confirm
 * link, and an operator could still start it later. Live 2026-09-19 the agent
 * had to tell its operator in prose "do not approve job 245869890315".
 *
 *  - 'already-ended': terminal, nothing to do.
 *  - 'withdraw': never handed to the machine, so mark it stopped here. The
 *    confirm page answers 409 for any non-`awaiting_confirmation` state, so
 *    this genuinely kills the link.
 *  - 'request-procedure-stop': a running server-driven runner stops at its
 *    next step boundary and raises.
 *  - 'machine-stop': a file/direct job already handed over - firmware stop.
 *
 * A direct batch (tyeth/Luban#320) re-arms its token after each step and
 * reads `started` between steps. With its `step` context:
 *  - 'withdraw-remaining': no step call in flight and steps left - withdraw
 *    it: the token is cleared, the job ends withdrawn and nothing is sent.
 *    If the machine is still moving the last step (it was not awaited) and
 *    the channel has a firmware stop, the firmware stop is sent instead, as
 *    before; without one the note says that step cannot be stopped.
 *  - 'withdraw-after-step': a step call is executing on a channel with no
 *    firmware stop (SACP over UDP, text serial) - the remaining steps are
 *    withdrawn, the running step finishes, then the job ends withdrawn.
 *  - 'no-firmware-stop': a single move (or the last step) is executing on such
 *    a channel - nothing is left to withdraw and nothing stops it by command.
 * Without the context (every caller before #320) the plan is unchanged.
 */
export type JobStopAction = 'already-ended' | 'withdraw' | 'request-procedure-stop' | 'machine-stop'
    | 'withdraw-remaining' | 'withdraw-after-step' | 'no-firmware-stop';

/** A direct job's step position, for planJobStop (#320). */
export interface DirectStepContext {
    /** Steps not yet sent, NOT counting one whose call is executing. */
    stepsLeft: number;
    /** Steps the batch has, 0 for a single move. */
    totalSteps: number;
    /** A step's start_gcode_job call is executing (the job is `starting` or the active job). */
    stepInFlight: boolean;
    /** No step call is executing but the machine is not (known to be) idle: a step that was not awaited may still be moving. */
    machineMoving: boolean;
    /** The connected channel has a firmware stop (stopGcodeJob). */
    firmwareStop: boolean;
}

/** Steps a direct batch has not sent yet (nextStep onwards); 0 for anything else. */
export function directStepsLeft(job: { kind: McpJobKind; steps?: string[]; nextStep?: number }): number {
    if (job.kind !== 'direct' || !Array.isArray(job.steps) || job.steps.length === 0) {
        return 0;
    }
    return Math.max(0, job.steps.length - (job.nextStep || 0));
}

export interface JobStopPlan {
    action: JobStopAction;
    /** Shown to the agent; says in words whether the confirm link is now dead. */
    note: string;
}

export function planJobStop(kind: McpJobKind, state: McpJobState, step?: DirectStepContext): JobStopPlan {
    if (TERMINAL_JOB_STATES.includes(state)) {
        return { action: 'already-ended', note: `Job already ${state}.` };
    }
    if (kind === 'procedure') {
        if (state === 'started') {
            return {
                action: 'request-procedure-stop',
                note: 'Procedure stopping at the next step boundary; it raises to the traverse height and keeps every '
                    + 'completed measurement.',
            };
        }
        return {
            action: 'withdraw',
            note: 'Procedure withdrawn before it started. Its confirm link is dead - approving it now does nothing.',
        };
    }
    if (state === 'awaiting_confirmation' || state === 'approved') {
        return {
            action: 'withdraw',
            note: `Job withdrawn before it reached the machine (it was ${state}). Its confirm link is dead - approving `
                + 'it now does nothing, and no one needs to be told to leave it alone.',
        };
    }
    if (kind === 'direct' && step) {
        const done = step.totalSteps - step.stepsLeft - (step.stepInFlight ? 1 : 0);
        const cannotStop = 'a running step cannot be stopped by firmware command over this transport';
        if (!step.stepInFlight && step.stepsLeft > 0 && (!step.machineMoving || !step.firmwareStop)) {
            const moving = step.machineMoving
                ? ` The machine does not read idle: step ${done} (not awaited) may still be moving, and ${cannotStop} - use the machine's own stop.`
                : '';
            return {
                action: 'withdraw-remaining',
                note: `Batch withdrawn between steps, after step ${done} of ${step.totalSteps}: the remaining ${step.stepsLeft} step(s) were `
                    + `never sent and nothing was sent now. Its approval is dead - start_gcode_job refuses the remaining steps.${moving}`,
            };
        }
        if (step.stepInFlight && !step.firmwareStop && step.stepsLeft > 0) {
            return {
                action: 'withdraw-after-step',
                note: `Step ${done + 1} of ${step.totalSteps} is executing, and ${cannotStop}. The remaining ${step.stepsLeft} step(s) are `
                    + 'withdrawn and will never be sent; the running step finishes and the job then ends withdrawn. To halt the running '
                    + 'step use the machine\'s own stop.',
            };
        }
        if (!step.firmwareStop) {
            return {
                action: 'no-firmware-stop',
                note: `The move is executing, and ${cannotStop}; nothing is left to withdraw. To halt it use the machine's own stop.`,
            };
        }
    }
    return { action: 'machine-stop', note: 'Job already handed to the machine; sending the firmware stop.' };
}
