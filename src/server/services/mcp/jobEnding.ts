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
 */
export type JobStopAction = 'already-ended' | 'withdraw' | 'request-procedure-stop' | 'machine-stop';

export interface JobStopPlan {
    action: JobStopAction;
    /** Shown to the agent; says in words whether the confirm link is now dead. */
    note: string;
}

export function planJobStop(kind: McpJobKind, state: McpJobState): JobStopPlan {
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
    return { action: 'machine-stop', note: 'Job already handed to the machine; sending the firmware stop.' };
}
