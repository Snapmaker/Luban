import type { McpJob } from './jobs';
import { directStepsLeft } from './jobEnding';
import { OperatorReviewItem, operatorReviewKindLabel } from './operatorReviews';

const NOTICE_PHASES = new Set(['start_unverified', 'submitted', 'approved', 'rejected', 'started', 'completed', 'stopped', 'failed', 'stop-requested']);

/** Small, explicit public list view: no approval tokens, files, plans or large results. */
export function summarizeDashboardJob(job: McpJob) {
    return {
        id: job.id,
        name: job.name,
        kind: job.kind,
        state: job.state,
        createdAt: job.createdAt,
        approvedAt: job.approvedAt,
        // 'operator' (the click) or 'policy' with its name (safeZPolicy.ts, #241).
        approval: job.approval,
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
        // A direct batch between steps is stoppable though not active (#320): Stop withdraws its remaining steps.
        betweenSteps: job.kind === 'direct' && job.state === 'started' && directStepsLeft(job) > 0,
    };
}

/**
 * Reviews on the feed: every pending one, then the most recently decided up to
 * this total. Matches the job list's retention (JOB_RETENTION_LIMIT = 50 in
 * jobs.ts, not imported so this module stays free of server dependencies).
 */
export const DASHBOARD_REVIEW_LIMIT = 50;

export type DashboardReviewState = 'pending' | 'approved' | 'rejected' | 'stale';

export interface DashboardReview {
    id: string;
    kind: string;
    kindLabel: string;
    machine: string | null;
    title: string;
    createdAt: number;
    decidedAt: number | null;
    state: DashboardReviewState;
    /** The store's own state, so 'stale' can say whether it was superseded or its approval was refused. */
    detail: OperatorReviewItem['state'];
    error: string | null;
    /** Relative, so it follows whatever origin (loopback, LAN, HTTPS) the dashboard was loaded from. */
    link: string;
}

const REVIEW_STATE: { [state in OperatorReviewItem['state']]: DashboardReviewState } = {
    awaiting_confirmation: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    superseded: 'stale',
    refused: 'stale',
};

/**
 * Small, explicit public list view of an operator review (operatorReviews.ts):
 * no page body, summary object (a policy loosening carries its raw args),
 * result, or apply/precondition. The decision stays on /confirm/r<id>.
 */
export function summarizeDashboardReview(item: Readonly<OperatorReviewItem>): DashboardReview {
    return {
        id: item.id,
        kind: item.kind,
        kindLabel: operatorReviewKindLabel(item.kind),
        machine: item.machineKey,
        title: item.title,
        createdAt: item.createdAt,
        decidedAt: item.decidedAt,
        state: REVIEW_STATE[item.state] || 'stale',
        detail: item.state,
        error: item.error,
        link: `/confirm/${item.id}`,
    };
}

/** Pending first (newest staged first), then decided ones newest decision first, bounded as the job list is. */
export function dashboardReviews(items: ReadonlyArray<Readonly<OperatorReviewItem>>, limit = DASHBOARD_REVIEW_LIMIT): DashboardReview[] {
    const pending = items.filter((item) => item.state === 'awaiting_confirmation')
        .sort((a, b) => b.createdAt - a.createdAt);
    const decided = items.filter((item) => item.state !== 'awaiting_confirmation')
        .sort((a, b) => (b.decidedAt ?? b.createdAt) - (a.decidedAt ?? a.createdAt));
    return [...pending, ...decided.slice(0, Math.max(0, limit - pending.length))].map(summarizeDashboardReview);
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
