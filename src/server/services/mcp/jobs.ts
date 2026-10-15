import crypto from 'crypto';
import * as fs from 'fs-extra';
import http from 'http';
import path from 'path';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import config from '../configstore';
import { JobDashboardFeed, summarizeDashboardJob } from './jobDashboardState';
import { JobEnding, McpJobKind, McpJobState, TERMINAL_JOB_STATES } from './jobEnding';
import { resolveTelemetryConfig } from './telemetryConfig';
import { GcodeValidationReport } from './validator';
import { describeActiveTool } from './activeTool';
import type { RecoveryEvidence } from './failureRecovery';

const log = logger('service:mcp:jobs');

// A submitted job may only start after a human approves it in a browser.
// The approval page mints the confirm token and shows it to the human;
// the token is never returned over MCP, so a model driving the MCP surface
// cannot self-authorise motion. (A process with arbitrary local HTTP access
// is outside this trust boundary - it could drive Luban's own APIs anyway.)
const CONFIRM_TOKEN_TTL_MS = 15 * 60 * 1000;
const JOB_RETENTION_LIMIT = 50;

/**
 * The lifecycle types live in jobEnding.ts (pure) so the stop planner can be
 * unit-tested without this server-bound module; they are re-exported here
 * because every caller already imports them from jobs.
 *
 * 'file' runs through prepare_print/start_print (door interlock applies, and
 * the machine interpreter returns to Z top at the job's finish position on
 * completion - XY holds, Z does not; operator-clarified 2026-09-02). 'direct'
 * executes over execute_code on approval - it persists position but is NOT
 * subject to the door interlock, so the confirm page says so and the operator
 * supervises.
 * 'procedure' is a server-driven measurement routine (e.g. the tool setter):
 * the operator approves a motion ENVELOPE and the runner steps within it
 * against live sensor feedback - also on the direct path, not interlocked.
 */
export type { McpJobState, McpJobKind } from './jobEnding';
export { TERMINAL_JOB_STATES } from './jobEnding';

export interface JobEvent {
    at: number;
    /**
     * Position in the job's full event stream (0-based, never reused). The
     * in-memory log is capped, so `events[i]` is not `seq === i` on a long
     * job; get_gcode_job_status pages by seq (since_event / next_event_index).
     */
    seq: number;
    /** State change ('submitted', 'approved', 'started', 'completed', ...), a runner phase, 'gcode', 'progress'. */
    phase: string;
    /** Which tool/source produced it. */
    tool?: string;
    note?: string;
    [detail: string]: unknown;
}

// The event cap (default 2000, 100x that with spindle telemetry on, up to
// 1 000 000) and why it is a setting live in telemetryConfig.ts; the
// constants are re-exported here because every caller imports them from jobs.
export {
    DEFAULT_JOB_EVENT_LIMIT,
    MAX_JOB_EVENT_LIMIT,
    MIN_JOB_EVENT_LIMIT,
    TELEMETRY_JOB_EVENT_LIMIT,
} from './telemetryConfig';

/**
 * How an approval reaches the agent. 'agent' (default; operator request
 * 2026-09-05): start_gcode_job may long-poll with wait_for_approval_ms and the
 * operator's click on the confirm page starts the job - no code to copy. 'code':
 * the one-time code must be relayed by the operator (the original scheme).
 * Either way a human click in a browser is the only thing that authorises
 * motion; the code was never a secret from a process with loopback access.
 * configstore mcpApprovalHandoff or LUBAN_MCP_APPROVAL_HANDOFF.
 */
export type ApprovalHandoff = 'agent' | 'code';

export function approvalHandoff(): ApprovalHandoff {
    const env = process.env.LUBAN_MCP_APPROVAL_HANDOFF;
    const raw = env !== undefined && String(env).trim() !== '' ? env : config.get('mcpApprovalHandoff');
    return String(raw || '').trim().toLowerCase() === 'code' ? 'code' : 'agent';
}

export function jobEventLimit(): number {
    return resolveTelemetryConfig(process.env, (key) => config.get(key)).jobEventLimit;
}


export interface McpJob {
    activeToolAtStaging?: object;
    id: string;
    name: string;
    kind: McpJobKind;
    headType: string;
    filePath: string;
    createdAt: number;
    validation: GcodeValidationReport;
    state: McpJobState;
    confirmToken: string | null;
    approvedAt: number | null;
    tokenUsed: boolean;
    /** An agent is long-polling start_gcode_job for the approval (approval hand-off); the confirm page says so instead of showing a code to copy. */
    agentWaiting: boolean;
    startedAt: number | null;
    // Set when the job reaches a terminal state (completed / stopped).
    endedAt: number | null;
    error: string | null;
    /**
     * Why the job ended - finished, stopped by the agent/operator, withdrawn,
     * rejected, alarm, unexpected contact, controller refusal, timeout, failure -
     * so a reader never has to infer it from state + error text.
     */
    ending: JobEnding | null;
    // Everything that happened to the job, in order: state changes, the
    // runner's phase announcements, gcode sent/replies while it was the active
    // job, file-job progress. Returned by get_gcode_job_status so an agent
    // never has to read server logs to learn how a job went. Capped.
    events: JobEvent[];
    /** Total events ever appended (next seq); events[] may hold fewer. */
    eventSeq: number;
    // Procedure outcome (tool setter / probe results), kept on the record so
    // a client that timed out waiting on start_gcode_job can still read it.
    result: object | null;
    // Batch direct jobs: the operator approved this exact list; each
    // start_gcode_job call executes ONE step, so captures can happen between
    // steps and the series can be abandoned at any point.
    steps?: string[];
    nextStep?: number;
    // Staged default for direct execution: whether start_gcode_job should
    // block until the move verifiably settles (call-time arg overrides).
    waitUntilMoved?: boolean;
    // Procedure jobs: the server-side runner start_gcode_job invokes after
    // the operator's token is consumed. Never serialised or described.
    runner?: () => Promise<object>;
    /** Workspace state against which this job was staged; old approvals cannot survive a change. */
    workspaceRevision?: number;
    /**
     * Modal cleanup evidence for a job that ended outside the call that
     * started it (#221): a file job, or a detached procedure runner. Null or
     * absent when the job cannot have left G53/G91 behind.
     */
    failureRecovery?: RecoveryEvidence | null;
    /** File jobs: what start and the status polls established, for judging the modes the file may have left. */
    modalTrack?: FileJobModalTrack;
}

export interface FileJobModalTrack {
    /** Connection generation captured as the job started; null when it could not be read. */
    startConnection: string | null;
    /** Highest `currentLine` the status reported while the job ran. */
    lastLine: number | null;
    totalLines: number | null;
    /** Highest progress seen, as a fraction 0..1. */
    lastProgress: number | null;
    /** The machine reported `stopping` before it went idle (a touchscreen or controller stop looks like completion). */
    stoppingSeen: boolean;
}

function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function range(r: { min: number; max: number } | null): string {
    return r ? `${r.min} .. ${r.max}` : '-';
}

export class JobManager {
    public readonly dashboardFeed = new JobDashboardFeed();

    private activeJob: McpJob | null = null;

    private jobs = new Map<string, McpJob>();

    private jobsDir: string | null = null;

    private workspaceRevision = 0;

    private ensureJobsDir(): string {
        if (!this.jobsDir) {
            this.jobsDir = path.join(DataStorage.tmpDir, 'mcp-jobs');
            fs.ensureDirSync(this.jobsDir);
        }
        return this.jobsDir;
    }

    public submit(gcode: string, name: string, headType: string, validation: GcodeValidationReport, kind: McpJobKind = 'file', steps?: string[]): McpJob {
        const id = crypto.randomBytes(6).toString('hex');
        const safeName = (name || 'job').replace(/[^\w.-]/g, '_').slice(0, 64);
        const filePath = path.join(this.ensureJobsDir(), `${id}_${safeName}.nc`);
        fs.writeFileSync(filePath, gcode, 'utf8');

        const job: McpJob = {
            activeToolAtStaging: describeActiveTool(),
            id,
            name: safeName,
            kind,
            headType,
            filePath,
            createdAt: Date.now(),
            validation,
            workspaceRevision: this.workspaceRevision,
            state: 'awaiting_confirmation',
            confirmToken: null,
            approvedAt: null,
            agentWaiting: false,
            tokenUsed: false,
            startedAt: null,
            endedAt: null,
            error: null,
            ending: null,
            events: [],
            eventSeq: 0,
            result: null,
            steps,
            nextStep: steps ? 0 : undefined,
        };
        this.jobs.set(id, job);
        this.prune();
        this.appendEvent(job, 'submitted', { note: `${kind} job staged, awaiting human confirmation` });
        log.info(`MCP job submitted: ${id} (${safeName}), awaiting human confirmation`);
        return job;
    }

    /** Record something that happened to a job (state change, phase, gcode, progress). */
    public appendEvent(job: McpJob, phase: string, detail: { [key: string]: unknown } = {}): void {
        this.dashboardFeed.record(job, phase);
        const seq = job.eventSeq;
        job.eventSeq += 1;
        job.events.push({ at: Date.now(), seq, phase, ...detail });
        const limit = jobEventLimit();
        if (job.events.length > limit) {
            // Keep the head (submission/approval/start) and the most recent tail.
            job.events.splice(20, job.events.length - limit);
        }
    }

    /** Events with seq >= since, in order (the cap may have dropped some). */
    public eventsSince(job: McpJob, since: number): JobEvent[] {
        return job.events.filter((event) => event.seq >= since);
    }

    /**
     * The job currently driving the machine (a procedure runner, a direct
     * step, a running file job). Activity broadcast while it is active is
     * attached to its event log - see recordActivity.
     */
    public setActive(job: McpJob | null): void {
        this.activeJob = job;
    }

    public getActive(): McpJob | null {
        return this.activeJob;
    }

    /**
     * Hook for mcpBroadcast: phase-style tool activity (runner announcements,
     * probe feed readings/alarms) and gcode traffic land on the active job's
     * event log. Tool-call summaries (ok/duration) are not job events.
     */
    public recordActivity(eventName: string, options?: object): void {
        const job = this.activeJob;
        if (!job || !options) {
            return;
        }
        const payload = options as { [key: string]: unknown };
        if (eventName === 'mcp:activity' && payload.phase !== undefined) {
            const { phase, ...rest } = payload;
            this.appendEvent(job, String(phase), rest);
        } else if (eventName === 'mcp:gcode') {
            const gcode = payload.gcode !== undefined ? String(payload.gcode).slice(0, 300) : undefined;
            const response = payload.response !== undefined ? String(payload.response).slice(0, 300) : undefined;
            // Timing stamps from sendGcodeVisible: idleMs = previous reply ->
            // this send (engine + sensor window), execMs = send -> reply.
            const timing: { [key: string]: unknown } = {};
            for (const key of ['idleMs', 'execMs', 'engineMs', 'replyToSenseEndMs', 'senseMs', 'senseWindowMs', 'senseKind', 'senseEndToEngineMs', 'trace']) {
                if (payload[key] !== undefined && payload[key] !== null) {
                    timing[key] = payload[key];
                }
            }
            this.appendEvent(job, 'gcode', { tool: payload.tool, gcode, response, ...timing });
        }
    }

    public isTerminal(job: McpJob): boolean {
        return TERMINAL_JOB_STATES.includes(job.state);
    }

    public get(id: string): McpJob | null {
        return this.jobs.get(id) || null;
    }

    /** Invalidate reviews made against the old (or intermediate) workspace state. */
    public invalidateWorkspaceApprovals(changingJob: McpJob): void {
        this.workspaceRevision += 1;
        changingJob.workspaceRevision = this.workspaceRevision;
        for (const job of this.jobs.values()) {
            if (job !== changingJob && !this.isTerminal(job)) {
                this.appendEvent(job, 'workspace_approval_stale', { note: 'Workspace state changed; restage this job against the verified offsets before approval.' });
            }
        }
    }

    /** Verify a human-supplied confirm token for a job. Single-use, expiring. */
    public consumeToken(job: McpJob, token: string): { ok: boolean; reason?: string } {
        if ((job.workspaceRevision || 0) !== this.workspaceRevision) {
            return { ok: false, reason: 'Workspace state changed since this job was staged; restage it against the verified offsets for a new approval.' };
        }
        // A batch direct job mid-series reads 'started' with steps remaining
        // and its token re-armed; the operator's one approval covers the
        // exact list, so the same code keeps working (bug found live
        // 2026-09-02: step 2 of a 9-step ladder was refused).
        const batchMidSeries = job.state === 'started'
            && Array.isArray(job.steps)
            && (job.nextStep || 0) < job.steps.length
            && !job.tokenUsed;
        if ((job.state !== 'approved' && !batchMidSeries) || !job.confirmToken) {
            return { ok: false, reason: `Job is ${job.state}, not approved.` };
        }
        if (job.tokenUsed) {
            return { ok: false, reason: 'Confirm token already used.' };
        }
        if (Date.now() - (job.approvedAt || 0) > CONFIRM_TOKEN_TTL_MS) {
            return { ok: false, reason: 'Confirm token expired; ask the operator to approve again.' };
        }
        const expected = Buffer.from(job.confirmToken, 'utf8');
        const given = Buffer.from(String(token || ''), 'utf8');
        if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
            return { ok: false, reason: 'Confirm token does not match.' };
        }
        job.tokenUsed = true;
        return { ok: true };
    }

    /**
     * Public view of a job - everything except the confirm token.
     */
    public describe(job: McpJob): object {
        return {
            id: job.id,
            name: job.name,
            kind: job.kind,
            headType: job.headType,
            state: job.state,
            createdAt: job.createdAt,
            approvedAt: job.approvedAt,
            startedAt: job.startedAt,
            endedAt: job.endedAt,
            error: job.error,
            ending: job.ending,
            // eslint-disable-next-line camelcase
            failure_recovery: job.failureRecovery || null,
            terminal: this.isTerminal(job),
            result: job.result,
            eventCount: job.events.length,
            eventsTotal: job.eventSeq,
            lastEvent: job.events.length ? job.events[job.events.length - 1] : null,
            totalSteps: job.steps ? job.steps.length : undefined,
            nextStep: job.steps ? job.nextStep : undefined,
            validation: job.validation,
        };
    }

    public dashboardJobs() {
        return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).map(summarizeDashboardJob);
    }

    private prune(): void {
        if (this.jobs.size <= JOB_RETENTION_LIMIT) {
            return;
        }
        const oldest = [...this.jobs.values()]
            .filter((job) => this.isTerminal(job))
            .sort((a, b) => a.createdAt - b.createdAt);
        for (const job of oldest.slice(0, this.jobs.size - JOB_RETENTION_LIMIT)) {
            this.jobs.delete(job.id);
            fs.remove(job.filePath).catch(() => undefined);
        }
    }

    // ============ human confirmation pages (loopback browser) ============

    /**
     * Routes /confirm/<id> (GET review page, POST approve/reject).
     * Loopback and Origin checks are done by the caller.
     */
    public handleConfirmRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
        const match = pathname.match(/^\/confirm\/([0-9a-f]+)(\/(approve|reject))?$/);
        if (!match) {
            this.page(res, 404, '<p>Not found.</p>');
            return;
        }
        const job = this.jobs.get(match[1]);
        if (!job) {
            this.page(res, 404, '<p>Unknown or expired job.</p>');
            return;
        }
        const action = match[3];

        if (req.method === 'GET' && !action) {
            // Revisiting an approved job re-shows its code while it is still
            // valid (unused, unexpired) - losing the tab must not dead-end
            // the approval (operator request 2026-09-02). MCP still never
            // sees the code; this is the loopback browser only.
            if (job.state === 'approved' && job.confirmToken && !job.tokenUsed
                && Date.now() - (job.approvedAt || 0) <= CONFIRM_TOKEN_TTL_MS) {
                this.page(res, 200, this.approvedPage(job));
                return;
            }
            this.page(res, 200, this.reviewPage(job));
            return;
        }
        if (req.method === 'POST' && action === 'approve') {
            if (job.state !== 'awaiting_confirmation') {
                this.page(res, 409, `<p>Job is ${escapeHtml(job.state)}; nothing to approve.</p>`);
                return;
            }
            job.confirmToken = crypto.randomBytes(4).toString('hex');
            job.approvedAt = Date.now();
            job.state = 'approved';
            this.appendEvent(job, 'approved', { note: 'operator approved on the confirm page' });
            log.info(`MCP job ${job.id} approved by operator`);
            this.page(res, 200, this.approvedPage(job));
            return;
        }
        if (req.method === 'POST' && action === 'reject') {
            if (job.state !== 'awaiting_confirmation') {
                this.page(res, 409, `<p>Job is ${escapeHtml(job.state)}; nothing to reject.</p>`);
                return;
            }
            job.state = 'rejected';
            job.confirmToken = null;
            job.endedAt = Date.now();
            job.ending = { kind: 'rejected-by-operator', reason: 'operator rejected on the confirm page', at: job.endedAt };
            this.appendEvent(job, 'rejected', { note: 'operator rejected on the confirm page' });
            log.info(`MCP job ${job.id} rejected by operator`);
            this.page(res, 200, '<h2>Rejected</h2><p>The job will not run.</p>');
            return;
        }
        res.writeHead(405, { Allow: 'GET, POST' });
        res.end();
    }

    /**
     * The gcode is shown AGAIN next to the code (operator request after the
     * 2026-09-01 probe crash): the last thing seen before handing over the
     * code is exactly what the code will run. Re-rendered on GET while the
     * code is still valid, so a lost tab does not dead-end the approval.
     */
    private approvedPage(job: McpJob): string {
        const approvedGcode = fs.readFileSync(job.filePath, 'utf8');
        const approvedLines = approvedGcode.split(/\r?\n/);
        const approvedPreview = approvedLines.length > 80
            ? [...approvedLines.slice(0, 40), `... ${approvedLines.length - 80} lines elided ...`, ...approvedLines.slice(-40)].join('\n')
            : approvedGcode;
        // Approval hand-off (operator request 2026-09-05): when an agent is
        // already waiting in start_gcode_job, the click IS the start - no code
        // to copy. The code is still printed small in case the agent's wait
        // timed out a moment ago (it stays valid for 15 minutes).
        const handoff = job.agentWaiting && approvalHandoff() === 'agent'
            ? `<p style="background:#e6ffed;border:1px solid #2ea043;padding:10px">
                   <strong>Handed to the waiting agent.</strong> Your click starts
                   <strong>${escapeHtml(job.name)}</strong> now - nothing to copy.
                   Fallback code if the agent reports it stopped waiting: <code>${job.confirmToken}</code></p>`
            : `<p>Give this one-time code to the agent to start <strong>${escapeHtml(job.name)}</strong>:</p>
               <p style="font-size:2em;font-family:monospace;letter-spacing:0.2em">${job.confirmToken}</p>`;
        return `
            <h2>Approved</h2>
            ${handoff}
            <p>It expires 15 minutes after approval and works once
               (a batch of moves: once per approved step).</p>
            <h3>This code will run exactly:</h3>
            <pre style="background:#f6f6f6;padding:12px;overflow:auto;max-height:300px">${escapeHtml(approvedPreview)}</pre>`;
    }

    private reviewPage(job: McpJob): string {
        const v = job.validation;
        const gcodeText = fs.readFileSync(job.filePath, 'utf8');
        const lines = gcodeText.split(/\r?\n/);
        const preview = lines.length > 80
            ? [...lines.slice(0, 40), `... ${lines.length - 80} lines elided ...`, ...lines.slice(-40)].join('\n')
            : gcodeText;

        const warnings = v.warnings.length
            ? `<div style="background:#fff3cd;border:1px solid #b8860b;padding:10px"><ul style="margin:0">${v.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`
            : '<p>None.</p>';
        // The frame row is what lets the operator validate a Z without trusting
        // chat: which workspace the moves run in, and where its Z lands in
        // machine coordinates (operator law 2026-09-14).
        const frame = v.frame;
        const offsetNote = v.originOffsetZAtStaging === null ? '' : `; work-origin Z offset ${v.originOffsetZAtStaging} at staging`;
        let frameText = 'UNDECLARED';
        if (frame && frame.declared === 'machine') {
            frameText = `MACHINE (G53 at line ${frame.line})`;
        } else if (frame && frame.declared === 'work') {
            frameText = frame.source === 'argument'
                ? `WORK - declared by the submit argument; the file selects no workspace${offsetNote}`
                : `WORK (${frame.workspaceSelects.join('/')} at line ${frame.line})${offsetNote}`;
        } else if (v.motionLineCount === 0) {
            frameText = 'n/a (no motion)';
        }
        let machineZ = 'UNRESOLVED - see warnings';
        if (v.machineZExtents && v.machineZResolvedFor) {
            machineZ = `${range(v.machineZExtents)} - if ${v.machineZResolvedFor} is the active workspace; on start, ${v.machineZResolvedFor} is `
                + `selected (no motion) and the job refuses to stream unless its offset Z is ${v.originOffsetZAtStaging}`;
        } else if (v.machineZExtents) {
            machineZ = range(v.machineZExtents);
        } else if (v.motionLineCount === 0) {
            machineZ = '-';
        }

        let directBanner = '';
        if (job.kind === 'direct') {
            directBanner = `<p style="background:#fff3cd;border:1px solid #b8860b;padding:10px">
                   <strong>DIRECT MOVE</strong>: on start this executes over the realtime path so the
                   position <em>persists</em> - but it does NOT run as a job, so the enclosure door
                   interlock does not apply. Supervise it.</p>`;
        } else if (job.kind === 'procedure') {
            directBanner = `<p style="background:#fff3cd;border:1px solid #b8860b;padding:10px">
                   <strong>SERVER-DRIVEN PROCEDURE</strong>: the lines below are the runner's simulated
                   PLAN - every move the server itself will COMMAND, in order, with the numbers it will
                   send - not a file streamed to the controller. On start the server sends them one
                   settle-verified move at a time, gated by live probe-sensor feedback: marches stop
                   early on contact, nothing moves that is not listed, and the table above is computed
                   from exactly these lines. It runs on the realtime path, so the enclosure door
                   interlock does NOT apply, and the overtravel tripwire must be armed. Supervise it.</p>`;
        }

        return `
            <h2>${job.state === 'awaiting_confirmation' ? 'Confirm' : 'Review'} ${{ direct: 'DIRECT move', procedure: 'SERVER-DRIVEN procedure', file: 'G-code job' }[job.kind]}: ${escapeHtml(job.name)}</h2>
            <details open><summary>Fitted tool and clearance provenance</summary>
            <p>At staging:</p><pre>${escapeHtml(JSON.stringify(job.activeToolAtStaging || null, null, 2))}</pre>
            <p>Now (value, source, age and any stale reason):</p><pre>${escapeHtml(JSON.stringify(describeActiveTool(), null, 2))}</pre></details>
            ${job.state === 'awaiting_confirmation'
        ? '<p>Submitted by an agent over MCP. Review before approving - approval mints a one-time code the agent needs to start it.</p>'
        : `<p>Job status: <strong>${escapeHtml(job.state)}</strong>.</p>`}
            ${directBanner}
            <table border="1" cellpadding="6" style="border-collapse:collapse">
                <tr><td>Head</td><td>${escapeHtml(job.headType)}</td></tr>
                <tr><td>Lines / motion lines</td><td>${v.lineCount} / ${v.motionLineCount}</td></tr>
                <tr><td>X extents</td><td>${range(v.extents.x)}</td></tr>
                <tr><td>Y extents</td><td>${range(v.extents.y)}</td></tr>
                <tr><td><strong>Frame</strong></td><td><strong>${escapeHtml(frameText)}</strong></td></tr>
                <tr><td>Z extents (as written)</td><td>${range(v.extents.z)}</td></tr>
                <tr><td><strong>Z extents, MACHINE</strong></td><td><strong>${escapeHtml(machineZ)}</strong></td></tr>
                <tr><td>B extents</td><td>${range(v.extents.b)}</td></tr>
                <tr><td>Feed rates</td><td>${range(v.feedRates)}</td></tr>
                <tr><td>Spindle</td><td>on x${v.spindle.onCommands}, off x${v.spindle.offCommands}, max S ${v.spindle.maxS === null ? '-' : v.spindle.maxS}</td></tr>
                <tr><td>Min Z with spindle on</td><td>${v.minZWithSpindleOn === null ? '-' : v.minZWithSpindleOn}</td></tr>
            </table>
            <h3>Warnings</h3>
            ${warnings}
            ${job.state === 'awaiting_confirmation' ? `
            <form method="post" action="/confirm/${job.id}/approve" style="display:inline">
                <button type="submit" style="font-size:1.2em;padding:8px 24px">Approve</button>
            </form>
            <form method="post" action="/confirm/${job.id}/reject" style="display:inline;margin-left:16px">
                <button type="submit" style="font-size:1.2em;padding:8px 24px">Reject</button>
            </form>
            ` : `<p>Job status: <strong>${escapeHtml(job.state)}</strong>. ${escapeHtml(job.ending?.reason || job.error || '')}</p>`}
            <h3>${job.kind === 'procedure' ? 'Simulated plan - every move the runner will command' : 'G-code'}${lines.length > 80 ? ' (first and last 40 lines)' : ''}</h3>
            <pre style="background:#f6f6f6;padding:12px;overflow:auto;max-height:400px">${escapeHtml(preview)}</pre>`;
    }

    private page(res: http.ServerResponse, status: number, body: string): void {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Luban MCP job confirmation</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="font-family:sans-serif;max-width:720px;margin:24px auto;padding:12px"><nav><a href="/jobs">Jobs</a> &middot; <a href="/camera">Camera</a></nav>${body}</body></html>`;
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
    }
}

export const jobManager = new JobManager();
