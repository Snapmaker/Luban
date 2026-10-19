// Evidence for an HTTP start whose reply may have been lost (#256).
// Idle is not proof of rejection: a short program may already have finished.
export const FILE_JOB_ACTIVE_STATUSES = ['running', 'paused', 'pausing', 'stopping', 'resuming'];

export interface FileStartReport {
    timestamp: number;
    status?: unknown;
    gcodePrintingInfo?: { name?: string; total?: number; sent?: number; progress?: number };
}

export interface FileStartAttempt {
    requestedAt: number;
    acknowledged: boolean;
    observedRunningAt: number | null;
    error: string | null;
    machineStatusAfter: string | null;
    retrySafe: boolean;
}

/** Only a new, fresh report from the original session can identify this run. */
export function fileStartEvidence(report: FileStartReport | null, requestedAt: number, now: number,
    sameConnection: boolean, filename: string, lineCount?: number): 'active' | 'idle' | 'unknown' {
    if (!sameConnection || !report || report.timestamp <= requestedAt
        || report.timestamp > now || now - report.timestamp > 10000) {
        return 'unknown';
    }
    const name = report.gcodePrintingInfo?.name;
    if (name && name !== filename) {
        return 'unknown';
    }
    if (FILE_JOB_ACTIVE_STATUSES.includes(String(report.status))) {
        const total = report.gcodePrintingInfo?.total;
        if (!name && total && lineCount && total !== lineCount) {
            return 'unknown';
        }
        return 'active';
    }
    return report.status === 'idle' ? 'idle' : 'unknown';
}
