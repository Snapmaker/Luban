// Staged operator decisions that carry no G-code (tyeth/Luban#265 WP5): the
// landmark review (confirm_landmarks), a landmark deletion or loosening, the
// answer to a device conflict (assign_machine_device), and (WP10) a
// set_machine_policy change that loosens a stated safety bound.
//
// Same gate as a staged job - an agent stages, the operator reads a page on
// the loopback/LAN confirm server and clicks Approve or Reject - and the same
// URL shape (/confirm/<id>, dispatched here before jobs.ts sees it; review ids
// start with 'r' so they never collide with a hex job id). What differs: there
// is nothing to run, so there is no one-time code for the agent to hand back.
// The click itself applies the decision, server-side, after re-checking that
// what the page showed is still what is stored (precondition) - an approval of
// a page that has gone out of date is refused and says to stage again.
//
// No server imports beyond http types: unit-tested through
// tests/landmarkReview.test.ts with a fresh store.
import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export type OperatorReviewKind = 'landmark-review' | 'landmark-change' | 'landmark-delete' | 'device-assign' | 'policy-loosen';

export type OperatorReviewState = 'awaiting_confirmation' | 'approved' | 'rejected' | 'superseded' | 'refused';

export interface OperatorReviewSpec {
    kind: OperatorReviewKind;
    title: string;
    /** The machine store key the decision is for; the approval is refused on another machine. */
    machineKey: string | null;
    /** Groups items that supersede each other (e.g. the landmark id, or 'review'). */
    subject: string;
    /** Rendered page body (already escaped): what the operator is approving. */
    bodyHtml: string;
    /** Plain summary for tool results and the agent. */
    summary: object;
    /** Re-checked on approval: a reason the page is out of date, or null. */
    precondition: () => string | null;
    /** Applies the decision on approval; its return value is recorded as the result. */
    apply: () => unknown;
}

export interface OperatorReviewItem extends OperatorReviewSpec {
    id: string;
    createdAt: number;
    state: OperatorReviewState;
    decidedAt: number | null;
    result: unknown;
    error: string | null;
}

export function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const KIND_LABEL: { [kind in OperatorReviewKind]: string } = {
    'landmark-review': 'Landmark review',
    'landmark-change': 'Landmark loosening',
    'landmark-delete': 'Landmark deletion',
    'device-assign': 'Device assignment',
    'policy-loosen': 'Machine policy loosening',
};

/** The heading a review page uses for its kind (also the /jobs dashboard label). */
export function operatorReviewKindLabel(kind: OperatorReviewKind): string {
    return KIND_LABEL[kind] || kind;
}

export class OperatorReviewStore {
    private readonly items = new Map<string, OperatorReviewItem>();

    private readonly now: () => number;

    public constructor(now: () => number = () => Date.now()) {
        this.now = now;
    }

    /** Stage a decision; any still-pending item of the same kind and subject on the same machine is superseded. */
    public stage(spec: OperatorReviewSpec): OperatorReviewItem {
        for (const other of this.items.values()) {
            if (other.state === 'awaiting_confirmation' && other.kind === spec.kind && other.subject === spec.subject
                && other.machineKey === spec.machineKey) {
                other.state = 'superseded';
                other.decidedAt = this.now();
            }
        }
        const item: OperatorReviewItem = {
            ...spec,
            id: `r${crypto.randomBytes(6).toString('hex')}`,
            createdAt: this.now(),
            state: 'awaiting_confirmation',
            decidedAt: null,
            result: null,
            error: null,
        };
        this.items.set(item.id, item);
        return item;
    }

    public get(id: string): OperatorReviewItem | null {
        return this.items.get(id) || null;
    }

    /** Every staged item, decided or not, in staging order (read-only view for the /jobs dashboard). */
    public list(): ReadonlyArray<Readonly<OperatorReviewItem>> {
        return [...this.items.values()];
    }

    public pending(machineKey?: string | null): OperatorReviewItem[] {
        return [...this.items.values()].filter((item) => item.state === 'awaiting_confirmation'
            && (machineKey === undefined || item.machineKey === machineKey));
    }

    /**
     * The operator's decision. Only the confirm-page POST calls this in
     * production; no MCP tool reaches it. `currentMachineKey` is the machine
     * connected now: an approval for another machine is refused.
     */
    public decide(id: string, action: 'approve' | 'reject', currentMachineKey: string | null): OperatorReviewItem {
        const item = this.items.get(id);
        if (!item) {
            throw new Error('Unknown or expired review.');
        }
        if (item.state !== 'awaiting_confirmation') {
            throw new Error(`This review is ${item.state}; nothing to ${action}.`);
        }
        item.decidedAt = this.now();
        if (action === 'reject') {
            item.state = 'rejected';
            return item;
        }
        const stale = item.machineKey !== currentMachineKey
            ? `it was staged for ${item.machineKey || 'no machine'}, and ${currentMachineKey || 'no machine'} is connected now`
            : item.precondition();
        if (stale) {
            item.state = 'refused';
            item.error = `Not applied: ${stale}. Ask the agent to stage it again.`;
            return item;
        }
        try {
            item.result = item.apply();
            item.state = 'approved';
        } catch (err) {
            item.state = 'refused';
            item.error = `Not applied: ${(err as Error).message}`;
        }
        return item;
    }

    public describe(item: OperatorReviewItem, confirmBaseUrl?: string): object {
        return {
            review_id: item.id,
            kind: item.kind,
            title: item.title,
            machine_key: item.machineKey,
            state: item.state,
            staged_at: item.createdAt,
            decided_at: item.decidedAt,
            error: item.error,
            confirm_url: confirmBaseUrl ? `${confirmBaseUrl}/confirm/${item.id}` : `/confirm/${item.id}`,
            summary: item.summary,
        };
    }

    /**
     * /confirm/r<id>[/approve|/reject]. Returns false when the path is not a
     * review (the caller then hands it to jobs.ts). Trust checks (loopback /
     * LAN, Origin) are the caller's, exactly as for job pages.
     */
    public handleConfirmRequest(req: IncomingMessage, res: ServerResponse, pathname: string, currentMachineKey: () => string | null): boolean {
        const match = pathname.match(/^\/confirm\/(r[0-9a-f]+)(\/(approve|reject))?$/);
        if (!match) {
            return false;
        }
        const item = this.items.get(match[1]);
        if (!item) {
            this.page(res, 404, '<p>Unknown or expired review.</p>');
            return true;
        }
        const action = match[3] as 'approve' | 'reject' | undefined;
        if (req.method === 'GET' && !action) {
            this.page(res, 200, this.reviewPage(item));
            return true;
        }
        if (req.method === 'POST' && action) {
            try {
                this.decide(item.id, action, currentMachineKey());
            } catch (err) {
                this.page(res, 409, `<p>${escapeHtml((err as Error).message)}</p>`);
                return true;
            }
            this.page(res, 200, this.reviewPage(item));
            return true;
        }
        res.writeHead(405, { Allow: 'GET, POST' });
        res.end();
        return true;
    }

    public reviewPage(item: OperatorReviewItem): string {
        let footer = `<p>Status: <strong>${escapeHtml(item.state)}</strong>.</p>`;
        if (item.state === 'awaiting_confirmation') {
            footer = `
            <p>Staged by an agent over MCP. Nothing is applied until you approve; nothing moves either way.</p>
            <form method="post" action="/confirm/${item.id}/approve" style="display:inline">
                <button type="submit" style="font-size:1.2em;padding:8px 24px">Approve</button>
            </form>
            <form method="post" action="/confirm/${item.id}/reject" style="display:inline;margin-left:16px">
                <button type="submit" style="font-size:1.2em;padding:8px 24px">Reject</button>
            </form>`;
        } else if (item.state === 'approved') {
            footer = item.kind === 'policy-loosen'
                ? '<h3>Approved and applied</h3><p>The agent sees the result in get_machine_profile.policy; there is no code to copy.</p>'
                : '<h3>Approved and applied</h3><p>The agent sees the result in get_stored_state.landmark_review; there is no code to copy.</p>';
        } else if (item.state === 'refused') {
            footer = `<h3>Not applied</h3><p>${escapeHtml(item.error || '')}</p>`;
        } else if (item.state === 'rejected') {
            footer = '<h3>Rejected</h3><p>Nothing changed.</p>';
        } else if (item.state === 'superseded') {
            footer = '<h3>Superseded</h3><p>A newer page replaced this one; nothing changed.</p>';
        }
        return `<h2>${escapeHtml(KIND_LABEL[item.kind])}: ${escapeHtml(item.title)}</h2>
            <p>Machine: <strong>${escapeHtml(item.machineKey || 'none')}</strong></p>
            ${item.bodyHtml}
            ${footer}`;
    }

    private page(res: ServerResponse, status: number, body: string): void {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Luban MCP operator review</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="font-family:sans-serif;max-width:820px;margin:24px auto;padding:12px"><nav><a href="/jobs">Jobs</a> &middot; <a href="/camera">Camera</a></nav>${body}</body></html>`;
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
    }
}
