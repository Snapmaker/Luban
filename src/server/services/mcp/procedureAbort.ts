// Procedure abort signalling, kept pure so it can be unit-tested.
//
// Why a marker instead of instanceof (hardware, 2026-09-14, job 885cb85b5f32):
// a 60-station surface scan was stopped with stop_gcode_job; the runner's
// abort path tested `err instanceof ProcedureAbort`, the test was FALSE for the
// ProcedureStopped that checkProcedureStop() had thrown, the partial result
// (52 measured stations) was never attached, and the job surfaced the raw stop
// message with `result: null`. Subclassing Error under a down-levelled build
// loses the prototype chain, so instanceof cannot be trusted across the app.
// Every abort now carries a marker property and the runners test THAT.

export class ProcedureAbort extends Error {
    /** Partial result (completed stations / ops) so an abort never loses what was measured. */
    public partial?: object;

    /** Marker for isProcedureAbort(): survives a lost prototype chain. */
    public readonly procedureAbort: true = true;

    public procedureStopped = false;

    public constructor(message: string, partial?: object) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'ProcedureAbort';
        this.partial = partial;
    }
}

/** Thrown at the first step boundary after requestProcedureStop(): a graceful, operator/agent-initiated stop. */
export class ProcedureStopped extends ProcedureAbort {
    public constructor(message: string, partial?: object) {
        super(message, partial);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'ProcedureStopped';
        this.procedureStopped = true;
    }
}

export function isProcedureAbort(err: unknown): err is ProcedureAbort {
    return !!err && typeof err === 'object' && (err as { procedureAbort?: unknown }).procedureAbort === true;
}

export function isProcedureStopped(err: unknown): err is ProcedureStopped {
    return isProcedureAbort(err) && (err as { procedureStopped?: unknown }).procedureStopped === true;
}

// ---------------------------------------------------------------- cooperative stop
//
// A procedure is a server-driven loop of <= 1-5 mm settled steps, not a
// firmware print job: the machine's stop_print cannot end it (job
// 5ad5fcce6b3a, 2026-09-06 - three stop_gcode_job calls answered ok:false
// while the scan kept stepping). stop_gcode_job now records a stop REQUEST;
// every motion primitive checks it before sending, so the procedure stops at
// the next step boundary (within one <= 1 mm step or one sensor window),
// throws ProcedureStopped, and the runner's normal abort path raises the head
// to the traverse height and keeps every completed result. The first check
// throws and marks the request acknowledged so the abort path's own moves
// (raise, retreat) are not refused; a program runner sees the request and
// stops regardless of on_fail.
export interface StopRequest {
    reason: string;
    requestedAt: number;
    acknowledged: boolean;
}

let stopRequest: StopRequest | null = null;

export function requestProcedureStop(reason: string): StopRequest {
    if (!stopRequest) {
        stopRequest = { reason, requestedAt: Date.now(), acknowledged: false };
    }
    return stopRequest;
}

export function clearProcedureStop(): void {
    stopRequest = null;
}

export function procedureStopRequested(): StopRequest | null {
    return stopRequest;
}

/** Called at every step boundary: throws ProcedureStopped once per request. */
export function checkProcedureStop(): void {
    if (stopRequest && !stopRequest.acknowledged) {
        stopRequest.acknowledged = true;
        throw new ProcedureStopped(`Stopped on request (${stopRequest.reason}) at a step boundary, `
            + `${Date.now() - stopRequest.requestedAt} ms after the request. Raising to the traverse height; completed results kept.`);
    }
}
