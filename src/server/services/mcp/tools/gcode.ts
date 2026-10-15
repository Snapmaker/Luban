/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import * as fs from 'fs-extra';

import logger from '../../../lib/logger';
import { connectionManager } from '../../machine/ConnectionManager';
import { McpJob, TERMINAL_JOB_STATES, approvalHandoff, jobManager } from '../jobs';
import { clearanceOptions } from '../clearanceContext';
import { classifyProcedureEnding, countMeasured, planJobStop } from '../jobEnding';
import { summarizeJobTiming } from '../jobTiming';
import { landmarkStore } from '../landmarks';
import { matchFrame } from '../positionOfRecord';
import { probeFeedService } from '../probeFeed';
import { spindleTelemetryService } from '../spindleTelemetry';
import { clearProcedureStop, procedureStopRequested, requestProcedureStop } from '../probing';
import { McpToolError, ToolRegistry } from '../registry';
import { planTraverseXy } from '../traversePlan';
import { JobFrame, TRANSPORT_REFUSAL, isPureTransport, resolveJobFrame, suggestGcode, validateGcode } from '../validator';
import { GcodeChannel, sendGcodeVisible } from './camera';
import { stagingFrameContext, validateStagedEnvelope } from './staging';
import { verifyFileJobWorkspace } from './workspace';
import { TRAVEL_EPSILON_MM } from '../machineTravel';
import {
    EVENT_POLL_MS,
    MAX_WAIT_MS,
    MAX_Z_TARGETS,
    MOVE_Z_FEED,
    SETTLE_MATCH_MM,
    STOP_WAIT_DEFAULT_MS,
    TRAVERSE_FEED,
    clampTo,
} from '../procedureLimits';
import {
    PositionSnapshot,
    assertFreshHeartbeat,
    getMachineSizeByIdentifier,
    getPositionSnapshot,
    motionFloorZ,
    requirePlanningTravel,
    safeTraverseZ,
} from './machine';

// Motion policy (#23): compound motion leaves this process only as a G-code
// file submitted through the same prepare/start path as "Start on Luban",
// so the controller's job state machine and the enclosure door interlock
// apply. Starting requires a one-time code that only the human approval
// page mints (see jobs.ts).

const HEAD_TYPES = ['cnc', 'laser', 'printing'];
const JOB_FRAMES: JobFrame[] = ['machine', 'work'];

interface JobChannel {
    executeGcode?: (gcode: string) => Promise<{ result: number; text?: string }>;
    uploadGcodeFile?: (filePath: string, type: string, renderName: string, callback: (msg: unknown, data?: unknown) => void) => void;
    startGcodeJob?: () => Promise<{ ok: boolean; code?: number; text?: string }>;
    stopGcodeJob?: () => Promise<{ ok: boolean; code?: number; text?: string }>;
}

type FileJobChannel = JobChannel & Required<Pick<JobChannel, 'uploadGcodeFile' | 'startGcodeJob'>>;

function getJobChannel(): FileJobChannel {
    const channel = connectionManager.getCurrentChannel() as unknown as JobChannel;
    if (!channel) {
        throw new McpToolError('No machine connected.');
    }
    if (typeof channel.uploadGcodeFile !== 'function' || typeof channel.startGcodeJob !== 'function') {
        throw new McpToolError('The connected channel does not support file job submission.');
    }
    return channel as FileJobChannel;
}

interface DirectTarget {
    frame: 'work' | 'machine';
    x?: number;
    y?: number;
    z?: number;
}

/**
 * Absolute target of a direct-move gcode (whichever of X/Y/Z the G1 line
 * names), for settle verification. G53-wrapped moves are machine-frame;
 * plain ones are work-frame (move_z / traverse_xy declare G54 explicitly).
 */
function parseDirectTarget(gcode: string): DirectTarget | undefined {
    const line = gcode.match(/G0*1[^;\n]*/i);
    if (!line) {
        return undefined;
    }
    const axis = (letter: string): number | undefined => {
        const m = line[0].match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`, 'i'));
        return m ? Number(m[1]) : undefined;
    };
    const target: DirectTarget = { frame: gcode.includes('G53') ? 'machine' : 'work', x: axis('X'), y: axis('Y'), z: axis('Z') };
    if (target.x === undefined && target.y === undefined && target.z === undefined) {
        return undefined;
    }
    return target;
}

function describeDirectTarget(t: DirectTarget): string {
    return (['x', 'y', 'z'] as const)
        .filter((axis) => t[axis] !== undefined)
        .map((axis) => `${axis.toUpperCase()} ${t[axis]}`)
        .join(' ');
}

/**
 * Wait until the heartbeat is settled AND, when the executed gcode names an
 * absolute Z target, until the reported Z actually matches it. Two identical
 * post-issue beats alone are not enough: the heartbeat lags the controller
 * by ~1s, so both can be pre-motion beats showing the old position (observed
 * live: a -95 move "completed" while still reporting -85). Every returned
 * position is either verified or flagged as not.
 */
async function waitForStableHeartbeat(
    issuedAt: number,
    expect?: DirectTarget
): Promise<{ position: PositionSnapshot | null; verified: boolean; warning?: string }> {
    const deadline = issuedAt + 45000;
    let previous: string | null = null;
    let last: PositionSnapshot | null = null;
    while (Date.now() < deadline) {
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });
        let now: PositionSnapshot;
        try {
            now = getPositionSnapshot();
        } catch (err) {
            continue;
        }
        last = now;
        const reportTime = Date.now() - now.reportAgeMs;
        const fingerprint = JSON.stringify([now.work, now.originOffset]);
        const stable = fingerprint === previous;
        previous = fingerprint;
        if (reportTime <= issuedAt || !stable || now.machineStatus !== 'idle') {
            continue;
        }
        if (expect) {
            // Machine-frame targets accept a report in either frame: a beat
            // inside the move's G53 window carries machine coordinates with
            // the offset still populated (positionOfRecord.ts).
            const wanted = { x: expect.x, y: expect.y, z: expect.z };
            const axes = (['x', 'y', 'z'] as const).filter((axis) => wanted[axis] !== undefined);
            const atTarget = expect.frame === 'work'
                ? axes.every((axis) => now.work[axis] !== null && Math.abs((now.work[axis] as number) - (wanted[axis] as number)) <= SETTLE_MATCH_MM)
                : matchFrame(now.work, now.originOffset, wanted, SETTLE_MATCH_MM) !== null;
            if (!atTarget) {
                continue; // settled, but not AT the target yet - keep waiting
            }
        }
        return { position: now, verified: true };
    }
    return {
        position: last,
        verified: false,
        warning: expect
            ? `Timed out waiting for the heartbeat to report ${expect.frame} ${describeDirectTarget(expect)}; the position `
                + 'shown is the last read and may be stale - verify with query_firmware_position.'
            : 'Timed out waiting for a settled heartbeat; the position shown may be stale - verify with '
                + 'query_firmware_position.',
    };
}


function machineStatus(): string | null {
    const state = connectionManager.getLatestMachineState();
    return state ? ((state as { status?: string }).status || null) : null;
}

const log = logger('service:mcp:gcode-jobs');

// File jobs run on the machine's own interpreter, which reports progress only
// through the heartbeat - nothing calls back when the job ends, so a started
// file job previously stayed "started" forever (observed 2026-09-02, job
// b3f4ef467a93: a 10s job, heartbeat back to idle, state never moved). Watch
// the heartbeat: once the job has been seen active, a debounced return to
// idle is completion. A job too short to ever show as active is completed
// after the heartbeat holds idle for a longer fallback window.
const sleep = async (ms: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
});

// How long start_gcode_job waits for a procedure before handing off to
// get_gcode_job_status long-polling (well inside typical MCP client timeouts).
const PROCEDURE_START_WAIT_MS = 25000;
const FILE_JOB_POLL_MS = 1000;
const FILE_JOB_IDLE_DEBOUNCE_POLLS = 3;
const FILE_JOB_NEVER_SEEN_ACTIVE_IDLE_POLLS = 20;
const FILE_JOB_UNREADABLE_POLLS_GIVE_UP = 120;
const FILE_JOB_ACTIVE_STATUSES = ['running', 'paused', 'pausing', 'stopping', 'resuming'];

function watchFileJobCompletion(job: McpJob): void {
    let sawActive = false;
    let idleStreak = 0;
    let unreadableStreak = 0;
    let lastProgress = -1;
    // The machine pauses a file job when the enclosure door opens (or on the
    // operator's pause): record each transition so the ending can say so.
    let lastStatus: string | null = null;
    let pausedSeen = 0;
    const release = () => {
        if (jobManager.getActive() === job) {
            jobManager.setActive(null);
        }
    };
    const timer = setInterval(() => {
        if (job.state !== 'started') {
            // Stopped (or otherwise finalised) through another path.
            clearInterval(timer);
            release();
            return;
        }
        const status = machineStatus();
        if (status === null) {
            unreadableStreak += 1;
            idleStreak = 0;
            if (unreadableStreak >= FILE_JOB_UNREADABLE_POLLS_GIVE_UP) {
                clearInterval(timer);
                job.error = 'Completion unverified: machine state became unreadable after the job '
                    + 'started (connection lost?). The job may still be running on the machine.';
                job.ending = { kind: 'completion-unverified', reason: job.error, at: Date.now() };
                jobManager.appendEvent(job, 'completion_unverified', { note: job.error });
                log.warn(`MCP file job ${job.id}: ${job.error}`);
                release();
            }
            return;
        }
        unreadableStreak = 0;
        if (FILE_JOB_ACTIVE_STATUSES.includes(status)) {
            sawActive = true;
            idleStreak = 0;
            if ((status === 'paused' || status === 'pausing') && lastStatus !== 'paused' && lastStatus !== 'pausing') {
                pausedSeen += 1;
                jobManager.appendEvent(job, 'paused', { note: 'machine paused the file job - enclosure door interlock or operator pause; it resumes from the machine' });
            }
            lastStatus = status;
            // Progress from the heartbeat, recorded every 5 % so the event
            // log shows the job advancing without a reader having to poll.
            const state = connectionManager.getLatestMachineState() as { gcodePrintingInfo?: { progress?: number } } | null;
            const raw = state && state.gcodePrintingInfo ? Number(state.gcodePrintingInfo.progress) : NaN;
            if (Number.isFinite(raw)) {
                const percent = Math.round((raw <= 1 ? raw * 100 : raw));
                if (percent >= lastProgress + 5) {
                    lastProgress = percent;
                    jobManager.appendEvent(job, 'progress', { percent, machineStatus: status });
                }
            }
            return;
        }
        lastStatus = status;
        if (status === 'idle') {
            idleStreak += 1;
            const needed = sawActive ? FILE_JOB_IDLE_DEBOUNCE_POLLS : FILE_JOB_NEVER_SEEN_ACTIVE_IDLE_POLLS;
            if (idleStreak >= needed) {
                clearInterval(timer);
                job.state = 'completed';
                job.endedAt = Date.now();
                job.ending = {
                    kind: 'completed',
                    reason: `machine interpreter finished the file${pausedSeen ? ` (paused ${pausedSeen}x on the way - door interlock or operator pause)` : ''}`,
                    at: job.endedAt,
                };
                jobManager.appendEvent(job, 'completed', {
                    note: `heartbeat idle for ${idleStreak}s${sawActive ? '' : ' (job too short for an active heartbeat to be observed)'}`,
                });
                log.info(`MCP file job ${job.id} completed: heartbeat idle for ${idleStreak}s`
                    + `${sawActive ? '' : ' (job too short for an active heartbeat to be observed)'}`);
                release();
            }
            return;
        }
        // Unknown status string: treat as activity of some kind, keep waiting.
        idleStreak = 0;
    }, FILE_JOB_POLL_MS);
    if (typeof timer.unref === 'function') {
        timer.unref();
    }
}

/**
 * Append a corrected draft to a staging refusal when the fix is mechanical.
 * The submitted file is never edited - this is the program the agent should
 * have written, handed over so a refusal costs one re-submit instead of a
 * round trip through prose.
 */
function describeSuggestion(suggestion: { gcode: string; changes: string[] } | null): string {
    if (!suggestion) {
        return '';
    }
    return `\n\nRe-submit this instead (${suggestion.changes.join('; ')}):\n${suggestion.gcode}`;
}

/** Shared operator/MCP stop path; actor is server-supplied, never an MCP argument. */
export async function stopGcodeJob(args: { job_id?: string; wait_ms?: number }, actor: 'agent' | 'operator' = 'agent'): Promise<object> {
    const job = jobManager.get(String(args.job_id || ''));
    if (!job) {
        throw new McpToolError('Unknown job_id.');
    }
    const plan = planJobStop(job.kind, job.state);
    if (plan.action === 'already-ended') {
        return { ok: true, stopped: true, stopping: false, withdrawn: false, note: plan.note, job: jobManager.describe(job) };
    }
    if (plan.action === 'withdraw') {
        // Never handed to the machine: withdraw it here so the operator's
        // confirm link cannot start it later. Before this only procedures
        // were withdrawn and a staged file/direct job stayed approvable.
        job.state = 'stopped';
        job.endedAt = Date.now();
        job.ending = { kind: 'withdrawn', reason: `withdrawn by the ${actor} before it started`, at: job.endedAt };
        job.confirmToken = null;
        jobManager.appendEvent(job, 'stopped', { note: `withdrawn by the ${actor} before it started` });
        if (jobManager.getActive() === job) {
            jobManager.setActive(null);
        }
        return { ok: true, stopped: true, stopping: false, withdrawn: true, note: plan.note, job: jobManager.describe(job) };
    }
    if (plan.action === 'request-procedure-stop') {
        const request = requestProcedureStop(`stop_gcode_job by the ${actor}`);
        jobManager.appendEvent(job, 'stop-requested', { note: `stop requested by the ${actor}; the runner stops at the next step boundary and raises` });
        const waitMs = Math.min(Math.max(args.wait_ms === undefined ? STOP_WAIT_DEFAULT_MS : Number(args.wait_ms) || 0, 0), MAX_WAIT_MS);
        const deadline = Date.now() + waitMs;
        while (!TERMINAL_JOB_STATES.includes(job.state) && Date.now() < deadline) {
            await sleep(250);
        }
        const stopped = TERMINAL_JOB_STATES.includes(job.state);
        return {
            ok: true,
            stopped,
            stopping: !stopped,
            withdrawn: false,
            requestedAt: request.requestedAt,
            note: stopped
                ? `Procedure ${job.state} (${job.ending ? job.ending.kind : 'ending unknown'}${job.ending && job.ending.measured !== undefined ? `, ${job.ending.measured} measured` : ''}); `
                    + `completed measurements are in result (${job.error || 'no error'}).`
                : `Stop requested ${Date.now() - request.requestedAt} ms ago; the runner is finishing its current step and raising. Long-poll get_gcode_job_status.`,
            job: jobManager.describe(job),
        };
    }
    const channel = getJobChannel();
    if (typeof channel.stopGcodeJob !== 'function') {
        throw new McpToolError('The connected channel does not support stopping jobs.');
    }
    const stopped = await channel.stopGcodeJob();
    if (stopped.ok) {
        job.state = 'stopped';
        job.endedAt = Date.now();
        job.ending = { kind: actor === 'operator' ? 'stopped-by-operator' : 'machine-stopped', reason: `firmware stop sent by the ${actor}${stopped.text ? `: ${stopped.text}` : ''}`, at: job.endedAt };
        jobManager.appendEvent(job, 'stopped', { note: `stop sent by the ${actor}${stopped.text ? `: ${stopped.text}` : ''}` });
        if (jobManager.getActive() === job) {
            jobManager.setActive(null);
        }
    }
    return {
        ok: stopped.ok,
        stopped: stopped.ok,
        stopping: false,
        withdrawn: false,
        text: stopped.text || null,
        note: plan.note,
        job: jobManager.describe(job),
    };
}

export function registerGcodeTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: 'validate_gcode',
        description: 'Statically inspect G-code: motion extents, feeds, spindle commands and '
            + 'warnings. Sends nothing to the machine.',
        inputSchema: {
            type: 'object',
            properties: {
                gcode: { type: 'string', description: 'Complete G-code text.' },
            },
            required: ['gcode'],
            additionalProperties: false,
        },
        handler: async (args: { gcode?: string }) => {
            if (typeof args.gcode !== 'string' || !args.gcode.trim()) {
                throw new McpToolError('gcode must be a non-empty string.');
            }
            const report = validateGcode(args.gcode);
            const suggestion = suggestGcode(args.gcode, report);
            return {
                ...report,
                // Present only when the fix is mechanical and the corrected
                // draft re-validates clean; your file is never edited.
                suggested_gcode: suggestion ? suggestion.gcode : null,
                suggested_changes: suggestion ? suggestion.changes : [],
            } as unknown as object;
        },
    });

    registry.register({
        name: 'submit_gcode_job',
        description: 'Stage a G-code job for human confirmation. Returns a validation report and '
            + 'a confirm_url the OPERATOR must open in a browser; approving there mints a one-time '
            + 'code the operator gives you for start_gcode_job. Nothing is sent to the machine yet.',
        inputSchema: {
            type: 'object',
            properties: {
                gcode: { type: 'string', description: 'Complete G-code text.' },
                name: { type: 'string', description: 'Short job name shown to the operator.' },
                head_type: { type: 'string', enum: HEAD_TYPES, description: 'Toolhead kind. Default cnc.' },
                frame: {
                    type: 'string',
                    enum: JOB_FRAMES,
                    description: 'Coordinate frame the job runs in. A job that declares its frame in the gcode (G53 on its own line before '
                        + 'the first move = machine; G54..G59 = work) needs no argument. A Luban/slicer export that selects no '
                        + 'workspace MUST pass frame: "work" - the file is never modified. frame: "machine" without a literal G53 is '
                        + 'refused (the controller runs undeclared files in the selected work workspace). A job that declares nothing '
                        + 'and passes nothing is REFUSED: G90/G91 is distance mode, not a frame.',
                },
            },
            required: ['gcode', 'name'],
            additionalProperties: false,
        },
        handler: async (args: { gcode?: string; name?: string; head_type?: string; frame?: string }) => {
            if (typeof args.gcode !== 'string' || !args.gcode.trim()) {
                throw new McpToolError('gcode must be a non-empty string.');
            }
            if (typeof args.name !== 'string' || !args.name.trim()) {
                throw new McpToolError('name must be a non-empty string.');
            }
            const headType = args.head_type || 'cnc';
            if (!HEAD_TYPES.includes(headType)) {
                throw new McpToolError(`head_type must be one of: ${HEAD_TYPES.join(', ')}`);
            }

            const frameArgument = args.frame === undefined || args.frame === null ? null : String(args.frame) as JobFrame;
            if (frameArgument !== null && !JOB_FRAMES.includes(frameArgument)) {
                throw new McpToolError(`frame must be one of: ${JOB_FRAMES.join(', ')}`);
            }
            // The frame handshake (operator law 2026-09-14): an agent-authored job
            // must say which coordinate frame it runs in, or it does not reach the
            // confirm page. The gcode itself is never edited to add a declaration.
            const inspected = validateGcode(args.gcode);
            // Transport has tools. A hand-written transit is the path that
            // produced both the undeclared-frame job of 2026-09-12 and the
            // G53-stranded controller of 2026-09-19.
            if (headType === 'cnc' && isPureTransport(inspected)) {
                throw new McpToolError(TRANSPORT_REFUSAL);
            }
            // A file job's start selects G54 and verifies its offset first (see
            // start_gcode_job), so a G54-only file may resolve its machine Z.
            const resolved = resolveJobFrame(inspected, { ...stagingFrameContext(frameArgument), verifiesG54AtStart: true });
            if (resolved.refusal) {
                throw new McpToolError(resolved.refusal + describeSuggestion(suggestGcode(args.gcode, resolved.report)));
            }
            const validation = resolved.report;
            const job = jobManager.submit(args.gcode, args.name, headType, validation);

            return {
                job: jobManager.describe(job),
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url in a browser, review, and approve. Then either call '
                    + 'start_gcode_job with wait_for_approval_ms (their click starts it - nothing to copy) or pass the '
                    + 'one-time code they relay as confirm_token.',
            };
        },
    });

    registry.register({
        name: 'start_gcode_job',
        description: 'Start an approved job: uploads the file to the machine through the same '
            + 'prepare/start path as "Start on Luban" (door interlock applies) and starts it. '
            + 'A file whose machine Z was resolved for G54 (validation.machineZResolvedFor) first selects G54 with no '
            + 'motion and refuses to stream unless its offset Z matches staging (ending workspace-unverified: verify G54, restage). '
            + 'Authorisation is the operator\'s click on the confirm page. ORDER MATTERS: first deliver the staging '
            + 'result\'s confirm_url to the operator as the last line of a reply and END THE TURN (see the staging '
            + 'result\'s `handoff`); only then wait. EITHER pass the one-time code they paste (confirm_token) OR call '
            + 'with wait_for_approval_ms as a BACKGROUND poll after the link is out: the call stays open until they '
            + 'approve (then the job starts at once - nothing to copy), reject, or the wait expires (returns approved: '
            + 'false, timed_out: true - call again to keep waiting; approval is never lost - a timeout is not a reason to '
            + 'withdraw the job or to conclude anything). Never call this with wait_for_approval_ms BEFORE the operator has '
            + 'the link: they cannot click what they have not seen. The hand-off can be disabled in Settings -> MCP Server, '
            + 'in which case only confirm_token works.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string' },
                wait_ms: {
                    type: 'number',
                    description: 'Procedure jobs only: how long to wait for the result before returning a running status (0-120000, default 25000). The runner continues either way; long-poll get_gcode_job_status.',
                },
                confirm_token: { type: 'string', description: 'One-time code from the operator (not needed with wait_for_approval_ms).' },
                wait_for_approval_ms: {
                    type: 'number',
                    description: 'Wait this long (1-120000, e.g. 110000) for the operator to approve on the confirm page, then start '
                        + 'without a code. Times out with approved: false if they have not clicked yet - call again.',
                },
                wait_until_moved: {
                    type: 'boolean',
                    description: 'Direct jobs only. Default true: block until the heartbeat verifiably '
                        + 'reports the move done. false returns immediately after the controller accepts '
                        + 'the command, with position_verified: false - poll get_position afterwards.',
                },
            },
            required: ['job_id'],
            additionalProperties: false,
        },
        handler: async (args: { job_id?: string; confirm_token?: string; wait_for_approval_ms?: number; wait_until_moved?: boolean; wait_ms?: number }) => {
            probeFeedService.assertNoOvertravel();
            const job = jobManager.get(String(args.job_id || ''));
            if (!job) {
                throw new McpToolError('Unknown job_id.');
            }

            // Approval hand-off (operator request 2026-09-05): with no code
            // given, wait for the operator's click on the confirm page and
            // use the job's own token. The click remains the only authority;
            // this only removes the copying.
            let token = String(args.confirm_token || '');
            if (!token) {
                const waitMs = Math.min(Math.max(Number(args.wait_for_approval_ms) || 0, 0), MAX_WAIT_MS);
                if (waitMs <= 0) {
                    throw new McpToolError('Provide confirm_token (the operator\'s one-time code) or wait_for_approval_ms '
                        + '(1-120000) to wait for the operator to approve on the confirm page.');
                }
                if (approvalHandoff() !== 'agent') {
                    throw new McpToolError('Approval hand-off to agents is disabled in Settings -> MCP Server: the operator '
                        + 'must give you the one-time code from the confirm page (confirm_token).');
                }
                if (job.state === 'awaiting_confirmation') {
                    job.agentWaiting = true;
                    jobManager.appendEvent(job, 'agent_waiting', { note: `agent waiting up to ${waitMs} ms for the operator's approval` });
                    const startedWaiting = Date.now();
                    try {
                        while (job.state === 'awaiting_confirmation' && Date.now() - startedWaiting < waitMs) {
                            await sleep(250);
                        }
                    } finally {
                        job.agentWaiting = false;
                    }
                }
                if (job.state === 'awaiting_confirmation') {
                    return {
                        job: jobManager.describe(job),
                        approved: false,
                        timed_out: true,
                        note: `Not approved within ${waitMs} ms. The confirm page stays valid - call start_gcode_job again with `
                            + 'wait_for_approval_ms to keep waiting, or ask the operator whether they intend to approve.',
                    };
                }
                if (job.state === 'rejected') {
                    throw new McpToolError('The operator rejected this job on the confirm page. Do not restage the same motion without asking why.');
                }
                if (!job.confirmToken) {
                    throw new McpToolError(`Job is ${job.state}; nothing to start.`);
                }
                token = job.confirmToken;
                jobManager.appendEvent(job, 'approval_handed_off', { note: 'operator approved on the confirm page; the waiting agent starts the job (no code relayed)' });
            }

            // Connectivity, heartbeat freshness and idleness are checked
            // before the token is consumed, so an offline attempt does not
            // waste an approval.
            assertFreshHeartbeat('starting a job');
            const channel = getJobChannel();
            const status = machineStatus();
            if (status !== 'idle') {
                throw new McpToolError(`Machine is ${status || 'in an unknown state'}, not idle.`);
            }

            const active = jobManager.getActive();
            if (active?.state === 'started') {
                throw new McpToolError('Another job or step is still active; wait for it to finish before starting this job.');
            }

            // Consumed from here on, success or not - a failed start needs a
            // fresh human approval, not a retry loop.
            const verdict = jobManager.consumeToken(job, token);
            if (!verdict.ok) {
                throw new McpToolError(verdict.reason || 'Confirmation failed.');
            }

            if (job.kind === 'procedure') {
                // Server-driven measurement routine (e.g. run_tool_setter):
                // the operator approved the envelope; the runner steps within
                // it against live sensor feedback and returns the result.
                if (typeof job.runner !== 'function') {
                    throw new McpToolError('Procedure job has no runner (was the server restarted since '
                        + 'submission?). Submit it again.');
                }
                job.state = 'started';
                job.startedAt = Date.now();
                jobManager.appendEvent(job, 'started', { note: 'procedure runner started' });
                jobManager.setActive(job);
                // The runner is DETACHED from this request: a tool setter or
                // probe circuit runs for minutes, longer than MCP clients wait
                // (timeouts seen live 2026-09-04/05), and a client giving up
                // must never abandon the machine mid-procedure or lose the
                // result. The outcome lands on the job record; this call waits
                // a bounded time and returns the result if it arrived, else a
                // "running" status to long-poll with get_gcode_job_status.
                clearProcedureStop();
                const finished = job.runner()
                    .then((outcome) => {
                        // Where the time went, from the job's own events, so
                        // agents optimise from the record (get_job_timing has
                        // the same for running/failed jobs).
                        job.result = { ...(outcome as object), timing: summarizeJobTiming(job.events) };
                        job.state = 'completed';
                        job.endedAt = Date.now();
                        job.ending = { kind: 'completed', reason: 'procedure finished', at: job.endedAt, measured: countMeasured(outcome) };
                        jobManager.appendEvent(job, 'completed', { note: 'procedure finished; result stored on the job' });
                        return { ok: true as const, outcome };
                    })
                    .catch((err: Error) => {
                        // What the procedure measured before it ended stays on
                        // the record (stations, contacts, completed ops).
                        const partial = (err as { partial?: object }).partial;
                        job.error = err.message;
                        job.endedAt = Date.now();
                        const stop = procedureStopRequested();
                        const trip = probeFeedService.getTrip();
                        job.ending = classifyProcedureEnding({
                            message: err.message,
                            stopReason: stop ? stop.reason : null,
                            trip: trip ? { kind: trip.kind, channel: (trip as { channel?: string }).channel } : null,
                            at: job.endedAt,
                            measured: countMeasured(partial),
                        });
                        // Whatever was measured before the end stays on the record, with
                        // the ending beside it - a stopped run is a result, not a loss.
                        job.result = { ...(partial || {}), ending: job.ending, timing: summarizeJobTiming(job.events) };
                        if (stop) {
                            job.state = 'stopped';
                            jobManager.appendEvent(job, 'stopped', { note: `stopped on request (${stop.reason}): ${err.message}`, ending: job.ending });
                            log.info(`Procedure job ${job.id} stopped on request: ${err.message}`);
                        } else {
                            job.state = 'start_failed';
                            jobManager.appendEvent(job, 'failed', { note: err.message, ending: job.ending });
                            log.error(`Procedure job ${job.id} failed (${job.ending.kind}): ${err.message}`);
                        }
                        return { ok: false as const, error: err.message };
                    })
                    .finally(() => {
                        clearProcedureStop();
                        if (jobManager.getActive() === job) {
                            jobManager.setActive(null);
                        }
                    });
                const waitMs = Math.min(Math.max(Number(args.wait_ms) || PROCEDURE_START_WAIT_MS, 0), MAX_WAIT_MS);
                const settledInTime = await Promise.race([
                    finished,
                    sleep(waitMs).then(() => null),
                ]);
                if (settledInTime === null) {
                    return {
                        job: jobManager.describe(job),
                        running: true,
                        note: `The procedure is still running after ${waitMs} ms and continues on the server. `
                            + 'Long-poll get_gcode_job_status (wait_ms up to 120000, since_event) for phases and '
                            + 'the result; do not resubmit.',
                    };
                }
                if (!settledInTime.ok) {
                    throw new McpToolError(settledInTime.error);
                }
                return {
                    job: jobManager.describe(job),
                    result: settledInTime.outcome,
                };
            }

            if (job.kind === 'direct') {
                // Direct moves execute over the realtime path so position
                // PERSISTS - the machine interpreter raises Z to top at the
                // finish position when a file job completes, so a file job
                // cannot hold a working Z (XY holds). The
                // operator approved exactly this gcode on the confirm page.
                // For a batch, each call executes ONE approved step; the
                // token stays valid for the remaining steps (within its TTL).
                job.state = 'starting';
                const issuedAt = Date.now();
                job.startedAt = job.startedAt || issuedAt;
                const batch = Array.isArray(job.steps) && job.steps.length > 0 ? job.steps : null;
                const stepIndex = job.nextStep ?? 0;
                const gcodeText = batch
                    ? batch[stepIndex]
                    : fs.readFileSync(job.filePath, 'utf8');
                // The staged text carries a human-facing comment header for
                // the confirm page; the realtime execute path must get pure
                // commands - the controller never replied to a payload led by
                // comment lines (hung live, 2026-09-02, job e34b19a913ff).
                const executable = gcodeText
                    .split(/\r?\n/)
                    .filter((line) => {
                        const trimmed = line.trim();
                        return trimmed.length > 0 && !trimmed.startsWith(';');
                    })
                    .join('\n');
                jobManager.appendEvent(job, 'started', { note: batch ? `direct step ${stepIndex + 1}/${batch.length}` : 'direct move' });
                jobManager.setActive(job);
                let settle;
                try {
                    const executed = await sendGcodeVisible(channel as GcodeChannel, `direct:${job.name}`, executable);
                    if (executed.result !== 0) {
                        job.state = 'start_failed';
                        job.error = `Controller rejected the move: ${executed.text || executed.result}`;
                        job.endedAt = Date.now();
                        job.ending = { kind: 'controller-rejected', reason: job.error, at: job.endedAt };
                        jobManager.appendEvent(job, 'failed', { note: job.error });
                        throw new McpToolError(job.error);
                    }
                    const shouldWait = args.wait_until_moved !== undefined
                        ? args.wait_until_moved !== false
                        : job.waitUntilMoved !== false;
                    settle = !shouldWait
                        ? {
                            position: null,
                            verified: false,
                            warning: 'wait_until_moved was false: the move was accepted but not awaited - '
                                + 'poll get_position (or query_firmware_position) before relying on position.',
                        }
                        : await waitForStableHeartbeat(issuedAt, parseDirectTarget(executable));
                    jobManager.appendEvent(job, 'settled', { position: settle.position, verified: settle.verified });
                } finally {
                    jobManager.setActive(null);
                }
                if (batch) {
                    job.nextStep = stepIndex + 1;
                    if (job.nextStep < batch.length) {
                        // Same operator-approved list; keep the token usable
                        // for the remaining steps.
                        job.tokenUsed = false;
                        job.state = 'started';
                        return {
                            job: jobManager.describe(job),
                            position: settle.position,
                            position_verified: settle.verified,
                            warning: settle.warning,
                            remaining_steps: batch.length - job.nextStep,
                            note: 'Step executed and settled. Call start_gcode_job again with the same '
                                + 'job_id and code for the next approved step; positions persist.',
                        };
                    }
                }
                job.state = 'completed';
                job.endedAt = Date.now();
                job.ending = { kind: 'completed', reason: 'direct move(s) done and settled', at: job.endedAt };
                jobManager.appendEvent(job, 'completed', { note: 'direct move(s) done' });
                return {
                    job: jobManager.describe(job),
                    position: settle.position,
                    position_verified: settle.verified,
                    warning: settle.warning,
                    note: 'Direct move executed; the position persists (no end-of-job park).',
                };
            }

            job.state = 'starting';
            if (job.validation.machineZResolvedFor) {
                // The confirm page's machine Z assumed the live offset was this
                // workspace's; the heartbeat cannot say so. Prove it (select,
                // acknowledge, two agreeing readbacks, same Z) before streaming.
                try {
                    const verified = await verifyFileJobWorkspace(job);
                    jobManager.appendEvent(job, 'workspace_verified', {
                        note: `${verified.workspace} selected with no motion; offset Z ${verified.originOffset.z} matches staging`
                            + `${verified.selectionChanged ? ' (another workspace was active before; other staged jobs were invalidated)' : ''}`,
                    });
                } catch (err) {
                    job.state = 'start_failed';
                    job.error = `Not started: ${(err as Error).message}`;
                    job.endedAt = Date.now();
                    job.ending = { kind: 'workspace-unverified', reason: job.error, at: job.endedAt };
                    job.result = { workspace_check: (err as { partial?: object }).partial || null };
                    jobManager.appendEvent(job, 'failed', { note: job.error, ending: job.ending });
                    throw new McpToolError(job.error);
                }
            }
            const uploadError = await new Promise<string | null>((resolve) => {
                channel.uploadGcodeFile(job.filePath, job.headType, `${job.name}.nc`, (msg) => {
                    resolve(msg ? String(msg) : null);
                });
            });
            if (uploadError) {
                job.state = 'start_failed';
                job.error = `Upload failed: ${uploadError}`;
                job.endedAt = Date.now();
                jobManager.appendEvent(job, 'failed', { note: job.error });
                throw new McpToolError(job.error);
            }
            jobManager.appendEvent(job, 'uploaded', { note: `${job.name}.nc uploaded to the machine` });

            const started = await channel.startGcodeJob();
            if (!started.ok) {
                job.state = 'start_failed';
                job.error = `Start failed: ${started.text || started.code || 'unknown error'}`;
                job.endedAt = Date.now();
                jobManager.appendEvent(job, 'failed', { note: job.error });
                throw new McpToolError(job.error);
            }

            job.state = 'started';
            job.startedAt = Date.now();
            jobManager.appendEvent(job, 'started', { note: 'machine interpreter running the file (door interlock applies)' });
            jobManager.setActive(job);
            watchFileJobCompletion(job);
            // Opt-in spindle telemetry (status RPM, microphone): observes only.
            spindleTelemetryService.startForJob(job);
            return {
                job: jobManager.describe(job),
                note: 'Job started. Poll get_gcode_job_status with wait_ms to long-poll for progress '
                    + 'events and completion (no need to read server logs); the controller, its door '
                    + 'interlock and the machine UI remain in control. The job is marked completed when '
                    + 'the heartbeat settles back to idle.',
            };
        },
    });

    registry.register({
        name: 'move_z',
        description: 'Request absolute Z motion, executed on the direct path so positions PERSIST '
            + '(the machine interpreter raises Z to top at the finish position when a file job '
            + 'completes, so a file job cannot hold a working Z - firmware behaviour). '
            + 'Either one target (z) or an ordered list (z_targets, max 20) for a methodical search: '
            + 'the operator approves the EXACT list once, and each start_gcode_job call then executes '
            + 'one step, so you can capture between steps and abandon the series at any point. The '
            + 'confirm page shows current Z, every target, deltas and feed; only the operator one-time '
            + 'code executes anything. NOT door-interlocked - the operator supervises. Spindle must be '
            + 'off; the toolhead always carries a tool.',
        inputSchema: {
            type: 'object',
            properties: {
                z: { type: 'number', description: 'Absolute target Z (single move).' },
                z_targets: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 1,
                    maxItems: 20,
                    description: 'Ordered absolute Z targets; one approval covers the exact list, '
                        + 'one start_gcode_job call per step. Mutually exclusive with z.',
                },
                coordinate_system: {
                    type: 'string',
                    enum: ['work', 'machine'],
                    description: 'Which frame z is in. Default work.',
                },
                feed_rate: { type: 'number', description: 'mm/min, default 300, max 600.' },
                reason: { type: 'string', description: 'Shown to the operator: why this Z motion is needed.' },
                wait_until_moved: {
                    type: 'boolean',
                    description: 'Staged default for execution (start_gcode_job can override per call). '
                        + 'Default true: each step blocks until the heartbeat verifiably reports the '
                        + 'target Z. false: steps return on controller accept with '
                        + 'position_verified: false - poll get_position.',
                },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: {
            z?: number;
            z_targets?: number[];
            coordinate_system?: string;
            feed_rate?: number;
            reason?: string;
            wait_until_moved?: boolean;
        }) => {
            probeFeedService.assertNoOvertravel();
            if ((args.z === undefined) === (args.z_targets === undefined)) {
                throw new McpToolError('Provide exactly one of z or z_targets.');
            }
            const targets = args.z_targets !== undefined
                ? args.z_targets.map(Number)
                : [Number(args.z)];
            if (!targets.length || targets.length > MAX_Z_TARGETS || targets.some((t) => !Number.isFinite(t))) {
                throw new McpToolError(`Targets must be 1-${MAX_Z_TARGETS} finite numbers.`);
            }
            const targetZ = targets[targets.length - 1];
            const coordinateSystem = args.coordinate_system || 'work';
            if (!['work', 'machine'].includes(coordinateSystem)) {
                throw new McpToolError('coordinate_system must be "work" or "machine".');
            }
            const feedRate = clampTo(args.feed_rate, MOVE_Z_FEED);

            assertFreshHeartbeat('staging a Z move');
            const position = getPositionSnapshot();
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            if (position.isHomed !== true) {
                throw new McpToolError('Machine does not report homed; home before any Z positioning.');
            }
            const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
            const headPower = Number(state && state.headPower);
            if ((Number.isFinite(headPower) && headPower > 0) || (state && (state.headStatus === true || state.headStatus === 'on'))) {
                throw new McpToolError('Toolhead appears to be on; refusing to move Z.');
            }

            const currentZ = coordinateSystem === 'work' ? position.work.z : position.machine.z;
            if (currentZ === null) {
                throw new McpToolError('Current Z unknown; cannot describe the move to the operator.');
            }
            // Z travel: the bed at machine 0, and at the top whichever is
            // higher of the definition's size and the park height the machine
            // homes to (an A350 homes at 328 against a 330 definition). Not
            // size + 40: nothing has ever been observed up there, and a Z
            // target past the top switch is an overtravel alarm, not a move.
            const size = getMachineSizeByIdentifier(connectionManager.getConnectionStatus().machineIdentifier);
            const zTop = Math.max(size ? size.z : 0, safeTraverseZ());
            for (const t of targets) {
                const machineT = coordinateSystem === 'machine' ? t : t - position.originOffset.z;
                if (machineT < -TRAVEL_EPSILON_MM || machineT > zTop + TRAVEL_EPSILON_MM) {
                    throw new McpToolError(`Target ${coordinateSystem} Z ${t} (machine Z ${machineT.toFixed(1)}) `
                        + `is outside the Z travel 0..${zTop}.`);
                }
            }

            const stepGcode = (t: number) => (coordinateSystem === 'machine'
                ? `G90\nG53;\nG1 Z${t.toFixed(3)} F${feedRate};\nG54;`
                : `G90\nG54;\nG1 Z${t.toFixed(3)} F${feedRate}`);
            const steps = targets.map(stepGcode);
            const isBatch = targets.length > 1;
            const delta = targetZ - currentZ;
            // The gcode preview must let the operator validate the numbers
            // without trusting chat: state the reason, the frame, where the
            // machine is now and the delta of every step (operator request
            // 2026-09-02). Sensors: no contact is expected during a Z move.
            const wrapText = (text: string, width: number): string[] => {
                const words = String(text).split(/\s+/);
                const rows: string[] = [];
                let row = '';
                for (const word of words) {
                    if (row && (row.length + word.length + 1) > width) {
                        rows.push(row);
                        row = word;
                    } else {
                        row = row ? `${row} ${word}` : word;
                    }
                }
                if (row) {
                    rows.push(row);
                }
                return rows;
            };
            const header = [
                ...wrapText(`reason: ${args.reason}`, 90).map((row) => `; ${row}`),
                `; frame: ${coordinateSystem} coords; current ${coordinateSystem} Z ${currentZ.toFixed(3)}`,
                ...targets.map((t, i) => {
                    const from = i === 0 ? currentZ : targets[i - 1];
                    const d = t - from;
                    return `; step ${i + 1}: Z ${from.toFixed(3)} -> ${t.toFixed(3)} (${d >= 0 ? '+' : ''}${d.toFixed(3)} mm) F${feedRate}`;
                }),
                '; sensors: NO contact expected during these moves - a probe/toolsetter trigger',
                '; while moving latches the CRASH alarm (probe feed must be armed).',
            ].join('\n');
            const reviewText = `${header}\n${steps.join('\n; --- next approved step ---\n')}`;
            const name = isBatch
                ? `z-series ${coordinateSystem} [${targets.map((t) => t.toFixed(1)).join(', ')}] - ${String(args.reason).slice(0, 40)}`
                : `z-move ${coordinateSystem} Z${targetZ.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}mm) - ${String(args.reason).slice(0, 40)}`;

            const validation = validateStagedEnvelope(reviewText, 'move_z');
            const job = jobManager.submit(reviewText, name, 'cnc', validation, 'direct', isBatch ? steps : undefined);
            job.waitUntilMoved = args.wait_until_moved !== false;

            return {
                job: jobManager.describe(job),
                current_z: currentZ,
                targets,
                final_delta_mm: delta,
                feed_rate: feedRate,
                coordinate_system: coordinateSystem,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: isBatch
                    ? 'Ask the operator to open confirm_url, review the DIRECT-move banner and the full '
                        + 'target list, and approve once. Then call start_gcode_job with the code once PER '
                        + 'STEP - each call executes the next approved target and settles; capture between '
                        + 'steps as needed. The series can be abandoned at any point.'
                    : 'Ask the operator to open confirm_url, review the DIRECT-move banner '
                        + '(current Z, target, delta, feed), and approve. Their one-time code passed to '
                        + 'start_gcode_job executes the move; the position then persists.',
            };
        },
    });

    registry.register({
        name: 'traverse_xy',
        description: 'Law-2 TRANSPORT: an absolute XY move, or an ordered series (max 20), at the traverse height - '
            + 'staged for ONE operator approval and executed one step per start_gcode_job call on the direct path, '
            + 'exactly like move_z. Refused unless homed and the toolhead is already at or above mcpMotionFloorZ (default 320); stored landmarks may demand higher Z - '
            + 'raise it with move_z (coordinate_system "machine") first; there is deliberately no override. Every '
            + 'segment is checked against the stored landmarks and every target against the travel; Z is never '
            + 'written. Default frame MACHINE (G53 declared on every step; work-frame steps declare G54). This is the '
            + 'transport tool - move_and_capture is a <= 100 mm vision nudge, and hand-written file jobs for transport '
            + 'are how a frameless "G0 Z0" got staged on 2026-09-12. NOT door-interlocked - the operator supervises.',
        inputSchema: {
            type: 'object',
            properties: {
                x: { type: 'number', description: 'Absolute target X (single move). Omit to keep the current X.' },
                y: { type: 'number', description: 'Absolute target Y (single move). Omit to keep the current Y.' },
                targets: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 20,
                    items: {
                        type: 'object',
                        properties: { x: { type: 'number' }, y: { type: 'number' } },
                        additionalProperties: false,
                    },
                    description: 'Ordered targets {x?, y?} (an omitted axis keeps its previous value); one approval covers the '
                        + 'exact list, one start_gcode_job call per step. Mutually exclusive with x/y.',
                },
                coordinate_system: {
                    type: 'string',
                    enum: ['machine', 'work'],
                    description: 'Frame of the targets. Default MACHINE (agents plan in machine coordinates).',
                },
                feed_rate: { type: 'number', description: 'mm/min, default 1500, max 3000.' },
                reason: { type: 'string', description: 'Shown to the operator: why this transport is needed.' },
                wait_until_moved: {
                    type: 'boolean',
                    description: 'Staged default for execution (start_gcode_job can override per call). Default true: each '
                        + 'step blocks until the heartbeat verifiably reports the target XY. false: steps return on '
                        + 'controller accept with position_verified: false - poll get_position.',
                },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: {
            x?: number;
            y?: number;
            targets?: Array<{ x?: number; y?: number }>;
            coordinate_system?: string;
            feed_rate?: number;
            reason?: string;
            wait_until_moved?: boolean;
        }) => {
            probeFeedService.assertNoOvertravel();
            const single = args.x !== undefined || args.y !== undefined;
            if (single === (args.targets !== undefined)) {
                throw new McpToolError('Provide x and/or y for a single move, or targets for a series - not both, not neither.');
            }
            const targets = args.targets !== undefined ? args.targets : [{ x: args.x, y: args.y }];
            const coordinateSystem = args.coordinate_system || 'machine';
            if (coordinateSystem !== 'machine' && coordinateSystem !== 'work') {
                throw new McpToolError('coordinate_system must be "machine" or "work".');
            }
            const feedRate = clampTo(args.feed_rate, TRAVERSE_FEED);
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }

            assertFreshHeartbeat('staging an XY traverse');
            const position = getPositionSnapshot();
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            if (position.isHomed !== true) {
                throw new McpToolError('Machine does not report homed; home before any XY transport.');
            }
            const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
            const headPower = Number(state && state.headPower);
            if ((Number.isFinite(headPower) && headPower > 0) || (state && (state.headStatus === true || state.headStatus === 'on'))) {
                throw new McpToolError('Toolhead appears to be on; refusing to traverse.');
            }
            const { x: mx, y: my, z: mz } = position.machine;
            if (mx === null || my === null || mz === null) {
                throw new McpToolError('Current machine position unknown; cannot plan the traverse.');
            }
            const travel = requirePlanningTravel('a traverse', { x: mx, y: my });
            let plan;
            try {
                plan = planTraverseXy({
                    targets,
                    frame: coordinateSystem,
                    currentMachine: { x: mx, y: my, z: mz },
                    originOffset: position.originOffset,
                    travel: travel.limits,
                    traverseZ: safeTraverseZ(),
                    motionFloorZ: motionFloorZ(),
                    feedRate,
                    obstacles: landmarkStore.obstacleBoxes(),
                    ...clearanceOptions(),
                    reason,
                });
            } catch (err) {
                if ((err as Error).name === 'TraversePlanError') {
                    throw new McpToolError((err as Error).message);
                }
                throw err;
            }
            const isBatch = plan.steps.length > 1;
            const validation = validateStagedEnvelope(plan.reviewText, 'traverse_xy');
            const stepGcodes = isBatch ? plan.steps.map((step) => step.gcode) : undefined;
            const job = jobManager.submit(plan.reviewText, plan.name, 'cnc', validation, 'direct', stepGcodes);
            job.waitUntilMoved = args.wait_until_moved !== false;

            return {
                job: jobManager.describe(job),
                current_machine: { x: mx, y: my, z: mz },
                traverse_z: safeTraverseZ(),
                coordinate_system: coordinateSystem,
                feed_rate: feedRate,
                steps: plan.steps.map((step) => ({
                    target: step.target,
                    machine: { x: step.to.x, y: step.to.y },
                    distance_mm: Number(step.distanceMm.toFixed(1)),
                })),
                total_distance_mm: Number(plan.totalDistanceMm.toFixed(1)),
                travel: { ...travel.limits, conflicts: travel.conflicts },
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: isBatch
                    ? 'Ask the operator to open confirm_url, review the DIRECT-move banner, the frame and every leg, and '
                        + 'approve once. Then call start_gcode_job once PER STEP (wait_for_approval_ms on the first); each '
                        + 'call executes the next approved leg and settles. The series can be abandoned at any point.'
                    : 'Ask the operator to open confirm_url, review the DIRECT-move banner (frame, from, to, distance, '
                        + 'feed, Z unchanged) and approve; start_gcode_job with wait_for_approval_ms executes the move.',
            };
        },
    });

    registry.register({
        name: 'get_job_timing',
        description: 'Where a job\'s time went, computed from its event log (works for running, completed and failed jobs; '
            + 'completed procedures also carry it as result.timing): per command kind (coarse, fine, confirm, backoff, '
            + 'retract, hop, descend, raise, ...) the count, feeds, distance, controller time (execMs), motion time '
            + '(distance / feed), per-batch overhead, idle time and sensor windows; per station the wall time and its '
            + 'kind breakdown; approval wait, run time, median station; settle-waits, slow steps, estimated positions, '
            + 'event-loop stalls and frame flips. Use it to pick parameters (z_safe_delta_mm, coarse feed, '
            + 'confirm_passes, sensor_delay_ms) instead of mining events by hand.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string' },
            },
            required: ['job_id'],
            additionalProperties: false,
        },
        handler: async (args: { job_id?: string }) => {
            const job = jobManager.get(String(args.job_id || ''));
            if (!job) {
                throw new McpToolError('Unknown job_id.');
            }
            return {
                job: jobManager.describe(job),
                timing: summarizeJobTiming(job.events),
                trimmed: job.eventSeq > job.events.length,
            };
        },
    });

    registry.register({
        name: 'get_gcode_job_status',
        description: 'Job record with `ending` - why it ended: completed | stopped-by-agent | stopped-by-operator | '
            + 'withdrawn | rejected-by-operator | crash-alarm | overtravel-alarm | unexpected-contact | controller-rejected | '
            + 'workspace-unverified | timeout | operation-failure | machine-stopped | completion-unverified, with the reason and how many stations/ops '
            + 'were measured - its event log (state changes, runner phases, gcode traffic while active, file-job progress and '
            + 'pauses), the stored procedure result (a stopped or failed run keeps every completed station under result, with '
            + 'result.ending beside it), and live machine progress. File jobs run with spindle telemetry on '
            + '(mcpSpindleTelemetry) also carry `telemetry`: per commanded S the reported / microphone-tracked RPM '
            + '(min, median, time below 95 %), the HOLD / BLIP / STRUGGLE verdicts, chatter and runout flags, the audio '
            + 'device and the analysis cost - the series themselves come from get_job_telemetry. '
            + 'LONG-POLL: pass wait_ms (up to 120000) and it returns as soon as the job reaches a '
            + 'terminal state or new events arrive past since_event - use this instead of tight '
            + 'polling or reading server logs. Read-only.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string' },
                wait_ms: {
                    type: 'number',
                    description: 'Block up to this long (0-120000) for a terminal state or new events. Default 0 = return now.',
                },
                since_event: {
                    type: 'number',
                    description: 'Return only events at index >= this (the previous response\'s next_event_index); '
                        + 'new events past it also end a wait early. Default 0 = all events.',
                },
            },
            required: ['job_id'],
            additionalProperties: false,
        },
        handler: async (args: { job_id?: string; wait_ms?: number; since_event?: number }) => {
            const job = jobManager.get(String(args.job_id || ''));
            if (!job) {
                throw new McpToolError('Unknown job_id.');
            }
            const waitMs = Math.min(Math.max(Number(args.wait_ms) || 0, 0), MAX_WAIT_MS);
            const since = Math.max(0, Math.floor(Number(args.since_event) || 0));
            const startedWaiting = Date.now();
            let timedOut = false;
            while (!jobManager.isTerminal(job) && job.eventSeq <= since) {
                if (Date.now() - startedWaiting >= waitMs) {
                    timedOut = waitMs > 0;
                    break;
                }
                await sleep(Math.min(EVENT_POLL_MS, waitMs - (Date.now() - startedWaiting)));
            }
            const state = connectionManager.getLatestMachineState();
            return {
                job: jobManager.describe(job),
                result: job.result,
                events: jobManager.eventsSince(job, since),
                next_event_index: job.eventSeq,
                waited_ms: Date.now() - startedWaiting,
                timed_out: timedOut,
                machineStatus: machineStatus(),
                printingInfo: state ? ((state as { gcodePrintingInfo?: object }).gcodePrintingInfo || null) : null,
                reportAgeMs: state ? Date.now() - state.timestamp : null,
                telemetry: spindleTelemetryService.summary(job.id),
            };
        },
    });

    registry.register({
        name: 'stop_gcode_job',
        description: 'Stop a running job. Stopping needs no confirmation. A PROCEDURE (probe_*, probe_program, '
            + 'run_tool_setter, survey) is a server-driven loop, so it stops at the next step boundary (within one '
            + '<= 1 mm step or sensor window), raises the head to the traverse height and keeps every completed '
            + 'station / contact / op on the job record (result, state "stopped"); this call waits up to wait_ms for '
            + 'that. A job that never reached the machine (any kind, awaiting confirmation or approved but not '
            + 'started) is WITHDRAWN: it is marked stopped here and its confirm link dies, so an approval cannot '
            + 'start it later. A file/direct job already handed over is stopped on the machine (firmware '
            + 'stop_print). Result: {ok, stopped, stopping, withdrawn, note, job}.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string', description: 'Job to stop (procedures: the running procedure; file jobs: the machine stop is global).' },
                wait_ms: { type: 'number', description: 'Procedures: how long to wait for the stop to complete (default 20000, max 120000).' },
            },
            required: ['job_id'],
            additionalProperties: false,
        },
        handler: async (args: { job_id?: string; wait_ms?: number }) => {
            return stopGcodeJob(args);
        },
    });
}
