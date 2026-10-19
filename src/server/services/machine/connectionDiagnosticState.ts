/** Credential-free connection evidence. No raw request, response body or error message is retained. */
export type DiagnosticFields = {
    attemptId?: string;
    sessionId?: string;
    workerId?: number;
    requestId?: string;
    reason?: string;
    phase?: string;
    httpStatus?: number;
    errorCode?: string;
    timedOut?: boolean;
    durationMs?: number;
    responseBytes?: number;
    reportAccepted?: boolean;
    tokenPresent?: boolean;
    tokenReturned?: boolean;
    allowPairing?: boolean;
    clientConnected?: boolean;
    clientAt?: number;
    target?: string;
    protocol?: string;
};

export function safeIdentifier(value: unknown): string | undefined {
    return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) ? value : undefined;
}

export function safeTarget(value: unknown): string | undefined {
    if (typeof value !== 'string') { return undefined; }
    try { return new URL(value.includes('://') ? value : `http://${value}`).host; } catch { return undefined; }
}

export function httpEvidence(error: unknown, response?: { status?: number; text?: string }) {
    const details = error as { code?: unknown; timeout?: unknown } | null;
    let errorCode: string | undefined;
    if (error) {
        const knownCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EPIPE'];
        errorCode = knownCodes.includes(String(details?.code)) ? String(details?.code) : 'REQUEST_ERROR';
    }
    return {
        httpStatus: response?.status,
        errorCode,
        timedOut: Boolean(details?.timeout),
        responseBytes: typeof response?.text === 'string' ? Buffer.byteLength(response.text, 'utf8') : 0,
    };
}

type Identity = { instanceId: string; pid: number; startedAt: number; version: string; build: string };
type DiagnosticEvent = DiagnosticFields & { event: string; at: number; instanceId: string };
const RECENT_LIMIT = 160;
const OVERDUE_MS = 10000;

export class ConnectionDiagnosticState {
    private recent: DiagnosticEvent[] = [];
    private attemptId?: string;
    private sessionId?: string;
    private workerId?: number;
    private polling = false;
    private expectedSince: number | null = null;
    private lastPollAt: number | null = null;
    private lastPollStartedAt: number | null = null;
    private lastReportAt: number | null = null;
    private overdue = false;
    private workerHasReport = false;
    private lastPollSignature = '';
    private lastPollLoggedAt = 0;
    private captures: Array<{ id: string; at: number; reason: string; evidence: unknown }> = [];

    public constructor(public readonly identity: Identity, private write: (event: object) => void, private now = Date.now) {
        this.record('server_identity');
    }

    public record(event: string, fields: DiagnosticFields = {}): void {
        const entry = { instanceId: this.identity.instanceId,
            attemptId: this.attemptId,
            sessionId: this.sessionId,
            workerId: this.workerId,
            ...fields,
            event,
            at: this.now() };
        this.recent.push(entry);
        if (this.recent.length > RECENT_LIMIT) { this.recent.shift(); }
        this.write({ ...entry, server: this.identity });
    }

    public beginAttempt(attemptId: string, fields: DiagnosticFields): void {
        this.record('connection_request_received', { ...fields, attemptId });
    }

    public beginSession(sessionId: string, attemptId?: string): void {
        this.sessionId = sessionId;
        this.workerId = undefined;
        this.attemptId = attemptId;
        this.lastReportAt = null;
        this.lastPollAt = null;
        this.lastPollStartedAt = null;
        this.record('session_started');
    }

    public startWorker(workerId: number): void {
        this.workerId = workerId;
        this.polling = true;
        this.expectedSince = this.now();
        this.lastPollStartedAt = null;
        this.lastPollAt = null;
        this.workerHasReport = false;
        this.overdue = false;
        this.lastPollSignature = '';
        this.record('heartbeat_worker_started');
    }

    public stopWorker(reason: string): void {
        this.record('heartbeat_worker_stopped', { reason });
        this.polling = false;
        this.expectedSince = null;
    }

    public pollStarted(): void {
        this.lastPollStartedAt = this.now();
    }

    public poll(fields: DiagnosticFields, accepted: boolean): void {
        const now = this.now();
        this.lastPollAt = now;
        const signature = JSON.stringify([fields.httpStatus, fields.errorCode, fields.timedOut, accepted]);
        // Persist changes immediately and a healthy sample every 20s; never log bodies or credentials.
        if (signature !== this.lastPollSignature || now - this.lastPollLoggedAt >= 20000) {
            this.record('heartbeat_response', { ...fields, reportAccepted: accepted });
            this.lastPollSignature = signature;
            this.lastPollLoggedAt = now;
        }
        if (accepted) {
            if (!this.workerHasReport) { this.record('first_heartbeat'); }
            this.workerHasReport = true;
            if (this.overdue) { this.record('heartbeat_resumed', { durationMs: now - (this.lastReportAt ?? this.expectedSince ?? now) }); }
            this.lastReportAt = now;
            this.overdue = false;
        }
    }

    public checkOverdue(): void {
        const since = this.expectedSince === null ? this.lastReportAt : Math.max(this.lastReportAt ?? 0, this.expectedSince);
        if (this.polling && since !== null && !this.overdue && this.now() - since > OVERDUE_MS) {
            this.overdue = true;
            this.record('heartbeat_overdue', { durationMs: this.now() - since });
        }
    }

    private current() {
        const at = this.now();
        return { server: this.identity,
            attemptId: this.attemptId,
            sessionId: this.sessionId,
            heartbeat: { workerId: this.workerId,
                polling: this.polling,
                expectedSince: this.expectedSince,
                lastPollAt: this.lastPollAt,
                lastPollStartedAt: this.lastPollStartedAt,
                lastReportAt: this.lastReportAt,
                reportAgeMs: this.lastReportAt === null ? null : at - this.lastReportAt,
                overdue: this.overdue,
                overdueThresholdMs: OVERDUE_MS },
            recent: this.recent.slice() };
    }

    public snapshot() {
        return { ...this.current(), captures: this.captures.slice(), recentLimit: RECENT_LIMIT };
    }

    public capture(reason: string, id: string): string {
        // Deep copy before recovery mutates session state; keep at most five captures in memory.
        const capture = { id, at: this.now(), reason, evidence: JSON.parse(JSON.stringify(this.current())) };
        this.captures.push(capture);
        if (this.captures.length > 5) { this.captures.shift(); }
        this.write({ event: 'connection_snapshot', instanceId: this.identity.instanceId, ...capture });
        return id;
    }
}
