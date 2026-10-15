import type { McpJob } from './jobs';

const NOTICE_PHASES = new Set(['submitted', 'approved', 'rejected', 'started', 'completed', 'stopped', 'failed', 'stop-requested']);

/** Small, explicit public list view: no approval tokens, files, plans or large results. */
export function summarizeDashboardJob(job: McpJob) {
    return {
        id: job.id,
        name: job.name,
        kind: job.kind,
        state: job.state,
        createdAt: job.createdAt,
        approvedAt: job.approvedAt,
        startedAt: job.startedAt,
        endedAt: job.endedAt,
        ending: job.ending,
        error: job.error,
        // The modal cleanup verdict only (#221); the full evidence is on /jobs/<id>.json.
        modalRecovery: job.failureRecovery ? {
            status: job.failureRecovery.status,
            skipReason: job.failureRecovery.skip_reason,
            recoveryAction: job.failureRecovery.recovery_action,
        } : null,
        lastEvent: job.events.length ? job.events[job.events.length - 1] : null,
    };
}

export interface JobNotice {
    seq: number;
    jobId: string;
    name: string;
    phase: string;
    at: number;
}

/** Separate from high-volume G-code logs, so short jobs survive between browser polls. */
export class JobDashboardFeed {
    public readonly instance = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    private sequence = 0;

    private notices: JobNotice[] = [];

    public record(job: Pick<McpJob, 'id' | 'name'>, phase: string): void {
        if (!NOTICE_PHASES.has(phase)) {
            return;
        }
        this.sequence += 1;
        this.notices.push({ seq: this.sequence, jobId: job.id, name: job.name, phase, at: Date.now() });
        if (this.notices.length > 300) {
            this.notices.shift();
        }
    }

    public read(since: number | null, instance: string | null) {
        const reset = instance !== this.instance || since === null || since > this.sequence;
        const first = this.notices.length ? this.notices[0].seq : this.sequence + 1;
        return {
            instance: this.instance,
            cursor: this.sequence,
            reset,
            missed: !reset && since < first - 1,
            notices: reset ? [] : this.notices.filter((notice) => notice.seq > since),
        };
    }
}
