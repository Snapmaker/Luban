/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import * as fs from 'fs-extra';

import logger from '../../../lib/logger';
import { connectionManager } from '../../machine/ConnectionManager';
import { FileJobModalTrack, McpJob, TERMINAL_JOB_STATES, approvalHandoff, gcodeUploads, jobInbox, jobManager } from '../jobs';
import { GcodeIntakeError, ProgramSource, describeProgramIdentity, resolveInboxPath } from '../gcodeIntake';
import {
    Exposure,
    JobEndCategory,
    ModalLedger,
    RecoveryDeps,
    RecoveryEvidence,
    closeLedger,
    currentLedger,
    describeEvidence,
    fileModalExposure,
    finishDetachedLedger,
    recoverAfterJobEnd,
    runWithLedger,
} from '../failureRecovery';
import { manualControlGate } from '../manualControl';
import { clearanceOptions, currentToolProtrusion } from '../clearanceContext';
import { ComputedTravel, computeTravelHeight } from '../computedHeight';
import { machineStore } from '../machineStore';
import { COMPUTED_HEIGHT_TOGGLE } from '../motionRules';
import { classifyProcedureEnding, countMeasured, planJobStop } from '../jobEnding';
import { FILE_JOB_ACTIVE_STATUSES, FileStartReport, fileStartEvidence } from '../fileJobStart';
import { summarizeJobTiming } from '../jobTiming';
import { landmarkStore } from '../landmarks';
import { matchFrame } from '../positionOfRecord';
import { probeFeedService } from '../probeFeed';
import { spindleTelemetryService } from '../spindleTelemetry';
import { vibrationCaptureService } from '../vibrationCaptures';
import { clearProcedureStop, procedureStopRequested, requestProcedureStop } from '../probing';
import { McpToolError, ToolRegistry } from '../registry';
import { STOCK_ARG_SCHEMA } from '../rotaryCallContext';
import { ComputedHeightDecision, decideComputedHeightTraverse, decideSafeZRaise, decideSafeZTraverse } from '../safeZPolicy';
import { TraversePlan, TraversePlanInput, parseSettleComment, planTraverseXy, traverseMachinePath } from '../traversePlan';
import { machineFrameMove, needsPlannerSync, relativeStep, workFrameMove } from '../gcodeForms';
import { machineStatusOf } from '../logicalFrame';
import { assertToolheadNotOn, connectedConnectionId, connectedDialect, connectedMachineCapability, connectedMachineTag, connectedToolhead,
    connectedToolheadNote, describeConnectedMachine } from '../connectedMachine';
import { laserOffSentIn, noteMcpFileJob } from '../toolheadState';
import { JobFrame, TRANSPORT_REFUSAL, isPureTransport, resolveJobFrame, spindleRefusal, suggestGcode, validateGcode } from '../validator';
import { GcodeChannel, GcodeNotSentError, sendGcodeVisible } from './camera';
import { connectedStagingMachine, connectedValidationOptions, stagingFrameContext, validateStagedEnvelope } from './staging';
import { parseGcodeHeader } from '../gcodeHeader';
import { verifyFileJobWorkspace } from './workspace';
import { TRAVEL_EPSILON_MM } from '../machineTravel';
import { MoveZPlanError, describeFeedClamps, resolveZTargets } from '../moveZPlan';
import {
    EVENT_POLL_MS,
    MAX_GCODE_PROGRAM_BYTES,
    MAX_WAIT_MS,
    SETTLE_MATCH_MM,
    STOP_WAIT_DEFAULT_MS,
    TRAVEL_FEED,
    TRAVERSE_FEED,
    clampTo,
} from '../procedureLimits';
import {
    MotionRuleLiveFacts,
    PositionSnapshot,
    assertFreshHeartbeat,
    computedHeightRuleFor,
    describePlanningTravel,
    getMachineSizeByIdentifier,
    getPositionSnapshot,
    motionDialect,
    motionFloorZ,
    motionGcodeForm,
    requirePlanningTravel,
    requireZAxis,
    safeTraverseZ,
    traverseMachine,
    safeZApprovalInput,
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
    startGcodeJob?: () => Promise<{ ok: boolean; code?: number; text?: string; notSent?: boolean }>;
    stopGcodeJob?: () => Promise<{ ok: boolean; code?: number; text?: string }>;
}

type FileJobChannel = JobChannel & Required<Pick<JobChannel, 'uploadGcodeFile' | 'startGcodeJob'>>;

function getConnectedChannel(): JobChannel {
    const channel = connectionManager.getCurrentChannel() as unknown as JobChannel;
    if (!channel) {
        throw new McpToolError('No machine connected.');
    }
    return channel;
}

function getJobChannel(): FileJobChannel {
    const channel = getConnectedChannel();
    if (typeof channel.uploadGcodeFile !== 'function' || typeof channel.startGcodeJob !== 'function') {
        throw new McpToolError('The connected channel does not support file job submission.');
    }
    return channel as FileJobChannel;
}

/**
 * The connected channel, checked for what THIS job kind's executor uses: a
 * file job uploads and starts a file; a direct job (executeDirectStep) and a
 * procedure runner (sendGcodeVisible) send G-code through executeGcode. The
 * Ray (SacpUdpChannel) and the Original (TextSerialChannel) have executeGcode
 * but no file-job path, so requiring file upload for every kind refused every
 * approved direct move there (live 2026-10-19, jobs 36fa11c67b4e/7a19f87b186a).
 * The A350 over Wi-Fi (SstpHttpChannel) has both.
 */
function getJobChannelFor(kind: McpJob['kind']): JobChannel {
    if (kind === 'file') {
        return getJobChannel();
    }
    const channel = getConnectedChannel();
    if (typeof channel.executeGcode !== 'function') {
        throw new McpToolError(kind === 'direct'
            ? `The connected channel does not support direct moves. ${connectedMachineTag()}`
            : `The connected channel cannot send G-code, so it cannot run a server-driven procedure. ${connectedMachineTag()}`);
    }
    return channel;
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
        // USB text serial (the Original): its M114 is the planner's QUEUED
        // target, so only a report taken after the step's planner sync proves
        // arrival, and only while the logical frame is still the machine frame
        // (a G92 written meanwhile voids it).
        if (now.motionAtRest === false || (now.logicalFrame && !now.logicalFrame.trusted)) {
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
    // SACP/SSTP `status`, or the text-serial workflowState mapped explicitly (tools/machine.ts).
    return machineStatusOf(connectionManager.getLatestMachineState() as { [key: string]: unknown } | null);
}

const log = logger('service:mcp:gcode-jobs');

type DirectSettle = { position: PositionSnapshot | null; verified: boolean; warning?: string };

/**
 * Execute ONE approved step of a direct job (or its whole single move) over
 * the realtime path, exactly as start_gcode_job always has: the staged
 * text's comment header is stripped (the controller never replied to a
 * payload led by comment lines - hung live 2026-09-02, job e34b19a913ff),
 * the job is the active job while the move is in flight, the arrival is
 * verified against the heartbeat unless `shouldWait` is false, and a
 * controller refusal ends the job as start_failed. A batch re-arms its token
 * for the remaining steps; the last step completes the job.
 */
async function executeDirectStep(job: McpJob, channel: GcodeChannel, shouldWait: boolean): Promise<{
    settle: DirectSettle;
    remainingSteps: number;
    /** The laser-off line this step led with (the Ray's M5, gcodeForms.relativeStep), or null. */
    laserOffSent: string | null;
}> {
    job.state = 'starting';
    const issuedAt = Date.now();
    job.startedAt = job.startedAt || issuedAt;
    const batch = Array.isArray(job.steps) && job.steps.length > 0 ? job.steps : null;
    const stepIndex = job.nextStep ?? 0;
    const gcodeText = batch
        ? batch[stepIndex]
        : fs.readFileSync(job.filePath, 'utf8');
    const executable = gcodeText
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith(';');
        })
        .join('\n');
    jobManager.appendEvent(job, 'started', { note: batch ? `direct step ${stepIndex + 1}/${batch.length}` : 'direct move' });
    jobManager.setActive(job);
    let settle: DirectSettle;
    let laserOffSent: string | null = null;
    try {
        let executed;
        try {
            executed = await sendGcodeVisible(channel, `direct:${job.name}`, executable);
        } catch (err) {
            // Refused before sending (GRBL over SACP, sacpLineGuard.ts): the job ends here, nothing ran.
            if (err instanceof GcodeNotSentError) {
                job.state = 'start_failed';
                job.error = err.message;
                job.endedAt = Date.now();
                job.ending = { kind: 'operation-failure', reason: job.error, at: job.endedAt };
                jobManager.appendEvent(job, 'failed', { note: job.error, not_sent: true });
            }
            throw err;
        }
        laserOffSent = laserOffSentIn(connectedToolhead(), executable);
        if (laserOffSent) {
            jobManager.appendEvent(job, 'laser_off_sent', { note: `${laserOffSent} led the step: this machine never reports its laser state` });
        }
        if (executed.result !== 0) {
            job.state = 'start_failed';
            job.error = `Controller rejected the move: ${executed.text || executed.result}`;
            job.endedAt = Date.now();
            job.ending = { kind: 'controller-rejected', reason: job.error, at: job.endedAt };
            jobManager.appendEvent(job, 'failed', { note: job.error });
            throw new McpToolError(job.error);
        }
        // A relative step names its absolute machine endpoint in a
        // `; mcp-settle machine X.. Y.. [Z..]` comment (stripped before
        // sending, read from the staged text here) - Z too for a relative Z
        // step (move_z on the Original); an absolute step is parsed from its G1.
        const settleTarget = parseSettleComment(gcodeText);
        const expect: DirectTarget | undefined = settleTarget
            ? { frame: 'machine', x: settleTarget.x, y: settleTarget.y, z: settleTarget.z }
            : parseDirectTarget(executable);
        settle = !shouldWait
            ? {
                position: null,
                verified: false,
                warning: 'wait_until_moved was false: the move was accepted but not awaited - '
                    + 'poll get_position (or query_firmware_position) before relying on position.',
            }
            : await waitForStableHeartbeat(issuedAt, expect);
        jobManager.appendEvent(job, 'settled', { position: settle.position, verified: settle.verified });
    } finally {
        jobManager.setActive(null);
    }
    if (batch) {
        job.nextStep = stepIndex + 1;
        if (job.nextStep < batch.length) {
            // Same operator-approved list; keep the token usable for the
            // remaining steps.
            job.tokenUsed = false;
            job.state = 'started';
            return { settle, remainingSteps: batch.length - job.nextStep, laserOffSent };
        }
    }
    job.state = 'completed';
    job.endedAt = Date.now();
    job.ending = { kind: 'completed', reason: 'direct move(s) done and settled', at: job.endedAt };
    jobManager.appendEvent(job, 'completed', { note: 'direct move(s) done' });
    return { settle, remainingSteps: 0, laserOffSent };
}

/**
 * Run a POLICY-approved direct job to completion on the staging call itself
 * (safeZPolicy.ts; operator ruling 2026-10-17, #241). The caller has already
 * made every check the staging path makes (fresh heartbeat, idle, homed,
 * toolhead off, travel, landmarks) and approved the job under a named policy;
 * this consumes that token through the same consumeToken + executeDirectStep
 * path an operator-approved job takes, step after step, so the job record,
 * the console `reason` broadcast and stop_gcode_job behave identically. Only
 * the confirm page is missing.
 */
/** What traverse_xy reports and decides under Motion rules R13 (#265 WP10). */
interface TraverseComputedHeight {
    decision: ComputedHeightDecision;
    travel: ComputedTravel | null;
    report: {
        allowed: boolean;
        travelZ: number | null;
        clearanceUsed: number | null;
        ideal: number;
        min: number;
        governedBy: string | null;
        unmet: string[];
        bed_contact_toolhead_z: number | null;
        lowest_point_below_reference_mm: number | null;
        highest_on_path: string | null;
        on_path: ComputedTravel['onPath'];
        note: string | null;
    };
}

/**
 * Motion rules R13 for one traverse_xy call (#265 WP10): null while the
 * operator's toggle is off for the connected machine - the call is then
 * exactly what it was. Otherwise the R13 verdict is read NOW (toggle, master
 * switch, eligibility, trusted protrusion, toolhead body, bed plane, the live
 * landmark review), the height is computed over the whole swept path, and
 * safeZPolicy.decideComputedHeightTraverse adds the call-time conditions
 * (device conflict, verified/heartbeat position, homed, known Z).
 */
function computedHeightForTraverse(input: {
    targets: Array<{ x?: number; y?: number }>;
    frame: 'machine' | 'work';
    position: PositionSnapshot;
    hasZ: boolean;
}): TraverseComputedHeight | null {
    const current = machineStore.currentMachine();
    if (current.machineKey === null) {
        return null;
    }
    let live: MotionRuleLiveFacts;
    try {
        const protrusion = currentToolProtrusion();
        live = { toolProtrusionMm: protrusion.mm, toolProtrusionNote: protrusion.mm === null ? protrusion.note : null };
    } catch (err) {
        live = { toolProtrusionMm: null, toolProtrusionNote: (err as Error).message };
    }
    const rule = computedHeightRuleFor(current.machineKey, live);
    if (!rule.on) {
        return null;
    }
    const { x, y, z } = input.position.machine;
    let topZ: number | null = null;
    let travel: ComputedTravel | null = null;
    const extra: string[] = [];
    try {
        topZ = safeTraverseZ();
        const floorZ = motionFloorZ();
        const path = x === null || y === null ? null : traverseMachinePath(input.targets, input.frame, { x, y }, input.position.originOffset);
        if (!path) {
            extra.push('the swept path is unknown (current XY or a target)');
        } else if (rule.bedPlaneZ !== null && rule.lowestPointBelowReferenceMm !== null) {
            travel = computeTravelHeight({
                path,
                // Only this machine's landmarks, with this call's rotary keep-out (rotaryCallContext.ts).
                obstacles: landmarkStore.obstacleBoxes(),
                bedPlaneZ: rule.bedPlaneZ,
                lowestPointBelowReferenceMm: rule.lowestPointBelowReferenceMm,
                idealMm: rule.idealMm,
                minMm: rule.minMm,
                topZ,
                floorZ,
            });
        }
    } catch (err) {
        extra.push((err as Error).message);
    }
    const decision = decideComputedHeightTraverse({
        verdict: { ...rule, unmet: [...rule.unmet, ...extra] },
        travel,
        deviceConflict: current.deviceConflict ? current.deviceConflict.note : null,
        hasZ: input.hasZ,
        reliability: input.position.reliability,
        homed: input.position.isHomed,
        currentZ: z,
        topZ: topZ === null ? NaN : topZ,
    });
    return {
        decision,
        travel,
        report: {
            allowed: decision.allowed,
            travelZ: travel ? travel.travelZ : null,
            clearanceUsed: travel ? travel.clearanceUsed : null,
            ideal: rule.idealMm,
            min: rule.minMm,
            governedBy: travel ? travel.governedBy : null,
            unmet: decision.unmet,
            bed_contact_toolhead_z: rule.bedContactToolheadZ,
            lowest_point_below_reference_mm: rule.lowestPointBelowReferenceMm,
            highest_on_path: travel ? travel.highest : null,
            on_path: travel ? travel.onPath : [],
            note: travel ? travel.note : null,
        },
    };
}

export async function runPolicyApprovedDirectJob(job: McpJob, token: string, shouldWait: boolean): Promise<{
    settle: DirectSettle;
    stepsExecuted: number;
}> {
    const active = jobManager.getActive();
    if (active && active !== job && ['starting', 'started', 'start_unverified'].includes(active.state)) {
        throw new McpToolError('Another job or step is still active; wait for it to finish before this transport.');
    }
    const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
    if (!channel || typeof channel.executeGcode !== 'function') {
        throw new McpToolError('The connected channel does not support direct moves.');
    }
    const verdict = jobManager.consumeToken(job, token);
    if (!verdict.ok) {
        throw new McpToolError(verdict.reason || 'Policy approval could not be consumed.');
    }
    let stepsExecuted = 0;
    let outcome = await executeDirectStep(job, channel, shouldWait);
    stepsExecuted += 1;
    while (outcome.remainingSteps > 0) {
        // The series was approved as one list; a stop request between steps
        // (stop_gcode_job withdraws / machine-stops the job) ends it here.
        if (job.state !== 'started' || job.confirmToken === null) {
            break;
        }
        const next = jobManager.consumeToken(job, job.confirmToken);
        if (!next.ok) {
            throw new McpToolError(`Series interrupted after ${stepsExecuted} step(s): ${next.reason}`);
        }
        outcome = await executeDirectStep(job, channel, shouldWait);
        stepsExecuted += 1;
    }
    return { settle: outcome.settle, stepsExecuted };
}

// ---- Modal cleanup for jobs that end outside the call that started them (#221) ----
//
// The registry's hook covers what a tool call sends in its own async context.
// A file job runs on the controller's interpreter and ends minutes later; a
// procedure runner is detached from start_gcode_job onto its own ledger.
// Both are judged here, with the runtime the registry was given (camera.ts
// injects it), and leave evidence on the job record. Policy: a stop, a trip,
// a lost connection or a completion NEVER sends anything (evidence plus
// restore_work_frame); only a job that failed on its own may get the
// separate, axis-free G90/G54, and only under the call hook's guards.

let recoveryDepsSource: () => RecoveryDeps | null = () => null;

function recoveryDeps(): RecoveryDeps | null {
    try {
        return recoveryDepsSource();
    } catch (err) {
        return null;
    }
}

function connectionNow(): string | null {
    try {
        const deps = recoveryDeps();
        return deps ? deps.connectionId() : null;
    } catch (err) {
        return null;
    }
}

/** Why command authority is closed (crash/overtravel latch, stop request), or null. */
function authorityClosedNow(): string | null {
    try {
        const deps = recoveryDeps();
        return deps ? deps.authorityClosed() : null;
    } catch (err) {
        return 'the safety latch state could not be read';
    }
}

/**
 * Hold the MCP ownership gate while cleanup may be sent from outside a tool
 * call, so the pendant cannot arm in the middle of it. When the pendant
 * already owns control the gate refuses and the deps' manual-control guard
 * skips the cleanup.
 */
async function withRecoveryGate<T>(name: string, fn: () => Promise<T>): Promise<T> {
    let leave: () => void = () => undefined;
    try {
        leave = manualControlGate.enterTool(name);
    } catch (err) {
        leave = () => undefined;
    }
    try {
        return await fn();
    } finally {
        leave();
    }
}

function newModalTrack(): FileJobModalTrack {
    return { startConnection: connectionNow(), lastLine: null, totalLines: null, lastProgress: null, stoppingSeen: false };
}

/** Fold one status report's printing info into the job's modal track (highest line / progress seen). */
function noteFileJobProgress(job: McpJob, info: { sent?: unknown; total?: unknown; progress?: unknown } | null | undefined): void {
    const track = job.modalTrack;
    if (!track || !info) {
        return;
    }
    const line = Number(info.sent);
    if (Number.isFinite(line) && line > 0) {
        track.lastLine = Math.max(track.lastLine || 0, line);
    }
    const total = Number(info.total);
    if (Number.isFinite(total) && total > 0) {
        track.totalLines = total;
    }
    const raw = Number(info.progress);
    if (Number.isFinite(raw) && raw > 0) {
        const fraction = raw <= 1 ? raw : raw / 100;
        track.lastProgress = Math.max(track.lastProgress || 0, Math.min(fraction, 1));
    }
}

function noteModalRecovery(job: McpJob, evidence: RecoveryEvidence): void {
    jobManager.appendEvent(job, 'modal_recovery', {
        note: `${evidence.status}${evidence.skip_reason ? ` (${evidence.skip_reason})` : ''}: ${evidence.explanation}`,
        recovery_action: evidence.recovery_action,
        modes: evidence.exposure.state,
    });
}

/**
 * Judge a FILE job's end from its program text and how far it was seen to
 * get, attach the evidence to the job and log it. Never throws: a job ending
 * must not be broken by its own evidence.
 */
export async function judgeFileJobEnd(job: McpJob, category: JobEndCategory, reason: string): Promise<RecoveryEvidence | null> {
    if (job.kind !== 'file') {
        return null;
    }
    try {
        const track = job.modalTrack || { ...newModalTrack(), startConnection: null };
        let program: string | null = null;
        try {
            program = fs.readFileSync(job.filePath, 'utf8');
        } catch (err) {
            program = null;
        }
        const exposure: Exposure = program !== null
            ? fileModalExposure(program, {
                lastLine: track.lastLine,
                totalLines: track.totalLines,
                lastProgress: track.lastProgress,
                ranToEnd: category === 'completed' && !track.stoppingSeen,
            })
            : {
                exposed: true,
                state: { workspace: 'unknown', distance: 'unknown' },
                pending_payloads: 0,
                connections: [],
                reasons: ['the job file could not be read back, so its modes are unknown'],
                // Conservative on purpose: a file nobody can read back may have
                // selected G53, so the shared frame latch is raised explicitly
                // rather than by g53Exposed's "absent means possible" default.
                g53_possible: true,
            };
        if (category === 'completed' && track.stoppingSeen) {
            exposure.reasons.push('the machine reported "stopping" before it went idle: the file may not have run to its end');
        }
        const run = async () => recoverAfterJobEnd({
            jobId: job.id,
            tool: `file-job:${job.name}`,
            category,
            reason,
            exposure,
            startConnection: track.startConnection,
        }, recoveryDeps());
        const evidence = category === 'failed' ? await withRecoveryGate('file-job-modal-recovery', run) : await run();
        job.failureRecovery = evidence;
        if (evidence) {
            noteModalRecovery(job, evidence);
        }
        return evidence;
    } catch (err) {
        return null;
    }
}

/** A detached runner's own ledger, owned by the start_gcode_job call that launches it; null if unavailable. */
function runnerLedgerFor(job: McpJob): ModalLedger | null {
    try {
        return new ModalLedger(`procedure:${job.name}`, true, connectionNow(), currentLedger());
    } catch (err) {
        return null;
    }
}

/** Close a runner's ledger and judge it like a tool call; evidence lands on the job. Never throws. */
async function settleRunnerLedger(job: McpJob, ledger: ModalLedger | null, outcome: { threw: boolean; thrown?: unknown }): Promise<RecoveryEvidence | null> {
    if (!ledger) {
        return null;
    }
    try {
        const run = async () => finishDetachedLedger(ledger, outcome, recoveryDeps(), job.id);
        const evidence = outcome.threw ? await withRecoveryGate('procedure-modal-recovery', run) : await run();
        job.failureRecovery = evidence;
        if (evidence) {
            noteModalRecovery(job, evidence);
        }
        return evidence;
    } catch (err) {
        return null;
    } finally {
        try {
            closeLedger(ledger);
        } catch (err) {
            // Idempotent; nothing to report.
        }
    }
}

/** The original error first, then the job's evidence - the same shape the registry gives a failed call. */
function withEvidence(error: Error, evidence: RecoveryEvidence | null): Error {
    if (evidence) {
        error.message = `${error.message}\n${describeEvidence(evidence)}`;
        (error as Error & { failureRecovery?: RecoveryEvidence }).failureRecovery = evidence;
    }
    return error;
}

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
const FILE_JOB_START_RECONCILE_MS = 6000;

function markFileStarted(job: McpJob, observedAt?: number): void {
    if (job.startAttempt && observedAt && !job.startAttempt.observedRunningAt) {
        job.startAttempt.observedRunningAt = observedAt;
    }
    if (job.state !== 'starting' && job.state !== 'start_unverified') {
        return;
    }
    job.state = 'started';
    job.startedAt = observedAt || Date.now();
    job.error = null;
    jobManager.appendEvent(job, 'started', { note: observedAt
        ? 'fresh heartbeat confirms the machine is running the uploaded file; start response may be lost'
        : 'controller acknowledged file start (door interlock applies)' });
    log.info(`MCP file job ${job.id} started: ${observedAt ? 'confirmed by fresh heartbeat' : 'controller acknowledged'}; reportAt=${observedAt || 'not yet observed'}`);
    spindleTelemetryService.startForJob(job);
    vibrationCaptureService.startForJob(job);
}

function watchFileJobCompletion(job: McpJob, channel: FileJobChannel): () => void {
    let sawActive = false;
    let idleStreak = 0;
    let unreadableStreak = 0;
    let lastProgress = -1;
    // The machine pauses a file job when the enclosure door opens (or on the
    // operator's pause): record each transition so the ending can say so.
    let lastStatus: string | null = null;
    let pausedSeen = 0;
    let lastReportAt = 0;
    const generation = connectionManager.getConnectionGeneration();
    let timer: ReturnType<typeof setInterval>;
    const release = () => {
        if (jobManager.getActive() === job) {
            jobManager.setActive(null);
        }
    };
    const poll = () => {
        if (TERMINAL_JOB_STATES.includes(job.state)) {
            // Stopped (or otherwise finalised) through another path.
            clearInterval(timer);
            release();
            return;
        }
        const report = connectionManager.getLatestMachineState() as FileStartReport | null;
        const attempt = job.startAttempt;
        const sameConnection = (connectionManager.getCurrentChannel() as unknown) === channel
            && generation === connectionManager.getConnectionGeneration();
        const evidence = fileStartEvidence(report, attempt?.requestedAt || 0, Date.now(), sameConnection, `${job.name}.nc`, job.identity.lineCount);
        const status = evidence === 'unknown' ? null : String(report?.status);
        if (attempt) {
            attempt.machineStatusAfter = status;
        }
        // Keep watching ambiguous starts, including ones whose HTTP call is
        // still pending. Never infer a failed start/completion from idle alone.
        if (evidence === 'active' && report) {
            markFileStarted(job, report.timestamp);
        }
        if (job.state !== 'started') {
            return;
        }
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
                // Retain ownership: loss of status does not stop a real run.
                // Never sends: the job was not seen to end and authority is not established.
                const closed = authorityClosedNow();
                judgeFileJobEnd(job, closed ? 'authority-closed' : 'connection-lost', closed || job.error).catch(() => undefined);
            }
            return;
        }
        // A cached idle report must not count as several completion reports.
        if (!report || report.timestamp <= lastReportAt) {
            return;
        }
        lastReportAt = report.timestamp;
        unreadableStreak = 0;
        if (FILE_JOB_ACTIVE_STATUSES.includes(status)) {
            sawActive = true;
            idleStreak = 0;
            if ((status === 'paused' || status === 'pausing') && lastStatus !== 'paused' && lastStatus !== 'pausing') {
                pausedSeen += 1;
                jobManager.appendEvent(job, 'paused', { note: 'machine paused the file job - enclosure door interlock or operator pause; it resumes from the machine' });
            }
            lastStatus = status;
            if (status === 'stopping' && job.modalTrack) {
                job.modalTrack.stoppingSeen = true;
            }
            // Progress from the heartbeat, recorded every 5 % so the event
            // log shows the job advancing without a reader having to poll.
            const state = connectionManager.getLatestMachineState() as { gcodePrintingInfo?: { progress?: number; sent?: number; total?: number } } | null;
            // How far the parser got: bounds which modes the file may have left (#221).
            noteFileJobProgress(job, state ? state.gcodePrintingInfo : null);
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
                    note: `heartbeat idle for ${idleStreak} distinct reports${sawActive ? '' : ' (job too short for an active heartbeat to be observed)'}`,
                });
                log.info(`MCP file job ${job.id} completed: heartbeat idle for ${idleStreak} distinct reports`
                    + `${sawActive ? '' : ' (job too short for an active heartbeat to be observed)'}`);
                release();
                // Never sends: a completion that left G53/G91 is reported, not second-guessed.
                const closed = authorityClosedNow();
                judgeFileJobEnd(job, closed ? 'authority-closed' : 'completed', closed || job.ending.reason).catch(() => undefined);
            }
            return;
        }
        // Unknown status string: treat as activity of some kind, keep waiting.
        idleStreak = 0;
    };
    timer = setInterval(poll, FILE_JOB_POLL_MS);
    if (typeof timer.unref === 'function') {
        timer.unref();
    }
    return poll;
}

// ---------------------------------------------------------------------------
// Program intake (#237): a job's text comes from exactly one of `gcode`
// (inline), `gcode_path` (a file in an allow-listed inbox directory) or
// `upload_id` (a finished chunked upload). Whatever the route, the text is
// validated, frame-resolved and staged identically.
// ---------------------------------------------------------------------------

interface ProgramArgs {
    gcode?: unknown;
    gcode_path?: unknown;
    upload_id?: unknown;
}

interface ProgramInput {
    text: string;
    source: ProgramSource;
    /** For an upload: remove it from the store once the job is staged (not on a refusal, so a frame refusal costs one re-submit). */
    consume: () => void;
}

/** The inbox description every intake result and refusal carries, so the agent never has to guess where to write. */
function describeInbox(): object {
    const inbox = jobInbox();
    return {
        inbox_dir: inbox.inboxDir,
        inbox_problem: inbox.inboxProblem,
        extra_inbox_dir: inbox.extraDir,
        extra_inbox_source: inbox.extraSource,
        extra_inbox_problem: inbox.extraProblem,
        allowed_dirs: inbox.roots.map((root) => root.dir),
        max_program_bytes: MAX_GCODE_PROGRAM_BYTES,
    };
}

function inboxHint(): string {
    const inbox = jobInbox();
    const dirs = inbox.roots.map((root) => `${root.name}: ${root.dir}`).join('; ');
    return `gcode_path is read by the Luban server from its allow-listed directories (${dirs || 'none available'})`
        + `${inbox.extraProblem ? `; the configured extra directory is unusable: ${inbox.extraProblem}` : ''}. `
        + 'A client that cannot write there uses begin_gcode_upload / append_gcode_chunk / finish_gcode_upload and passes upload_id.';
}

function resolveProgramInput(args: ProgramArgs): ProgramInput {
    const given = (['gcode', 'gcode_path', 'upload_id'] as const)
        .filter((key) => args[key] !== undefined && args[key] !== null && String(args[key]).trim() !== '');
    if (given.length !== 1) {
        throw new McpToolError('Pass exactly one of gcode (inline text), gcode_path (a file in the MCP jobs inbox) or upload_id (a finished '
            + `chunked upload); got ${given.length ? given.join(' and ') : 'none'}. ${inboxHint()}`);
    }
    const key = given[0];
    if (key === 'gcode') {
        if (typeof args.gcode !== 'string' || !args.gcode.trim()) {
            throw new McpToolError('gcode must be a non-empty string.');
        }
        const bytes = Buffer.byteLength(args.gcode, 'utf8');
        if (bytes > MAX_GCODE_PROGRAM_BYTES) {
            throw new McpToolError(`gcode is ${bytes} bytes, over the ${MAX_GCODE_PROGRAM_BYTES}-byte program limit. Split the job into separate programs.`);
        }
        return { text: args.gcode, source: { kind: 'inline' }, consume: () => undefined };
    }
    if (key === 'gcode_path') {
        const inbox = jobInbox();
        const resolved = resolveInboxPath(args.gcode_path, inbox.roots);
        // `=== false`, not `!ok`: the server tsconfig is not strict and only narrows the union on equality.
        if (resolved.ok === false) {
            throw new McpToolError(`${resolved.reason} ${inboxHint()}`);
        }
        const size = fs.statSync(resolved.path).size;
        if (size > MAX_GCODE_PROGRAM_BYTES) {
            throw new McpToolError(`${resolved.path} is ${size} bytes, over the ${MAX_GCODE_PROGRAM_BYTES}-byte program limit. Split the job into separate programs.`);
        }
        const text = fs.readFileSync(resolved.path, 'utf8');
        if (!text.trim()) {
            throw new McpToolError(`${resolved.path} is empty.`);
        }
        return {
            text,
            source: { kind: 'path', path: resolved.path, inbox: resolved.root.dir },
            consume: () => undefined,
        };
    }
    try {
        const found = gcodeUploads.peek(args.upload_id);
        return {
            text: found.text,
            source: { kind: 'upload', upload_id: found.record.upload_id, chunks: found.record.chunks.length },
            consume: () => {
                gcodeUploads.take(found.record.upload_id);
            },
        };
    } catch (err) {
        if (err instanceof GcodeIntakeError) {
            throw new McpToolError(err.message);
        }
        throw err;
    }
}

/** Re-throw an intake rule as a tool refusal; anything else is a bug and propagates. */
async function intake<T>(fn: () => T): Promise<T> {
    try {
        return fn();
    } catch (err) {
        if (err instanceof GcodeIntakeError) {
            throw new McpToolError(err.message);
        }
        throw err;
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
    // A started direct batch stops here too, so only the stop itself is required (not file upload).
    const channel = getConnectedChannel();
    if (typeof channel.stopGcodeJob !== 'function') {
        throw new McpToolError('The connected channel does not support stopping jobs.');
    }
    const stopped = await channel.stopGcodeJob();
    let evidence: RecoveryEvidence | null = null;
    if (stopped.ok) {
        job.state = 'stopped';
        job.endedAt = Date.now();
        job.ending = { kind: actor === 'operator' ? 'stopped-by-operator' : 'machine-stopped', reason: `firmware stop sent by the ${actor}${stopped.text ? `: ${stopped.text}` : ''}`, at: job.endedAt };
        jobManager.appendEvent(job, 'stopped', { note: `stop sent by the ${actor}${stopped.text ? `: ${stopped.text}` : ''}` });
        if (jobManager.getActive() === job) {
            jobManager.setActive(null);
        }
        // A stop closes command authority: the file's modes are reported, never cleaned up (#221).
        evidence = await judgeFileJobEnd(job, 'stopped', job.ending.reason);
    }
    return {
        ok: stopped.ok,
        stopped: stopped.ok,
        stopping: false,
        withdrawn: false,
        text: stopped.text || null,
        note: plan.note,
        job: jobManager.describe(job),
        ...(evidence ? { failure_recovery: evidence } : {}),
    };
}

export function registerGcodeTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    // Read lazily: the camera tools inject the runtime, possibly after this registers.
    recoveryDepsSource = () => (typeof registry.getFailureRecovery === 'function' ? registry.getFailureRecovery() : null);
    // Every staged job records the machine it is for; approval and start refuse on another (#265 WP3).
    if (typeof jobManager.setMachineSource === 'function') {
        jobManager.setMachineSource(connectedStagingMachine);
    }
    registry.register({
        name: 'validate_gcode',
        description: 'Statically inspect G-code: motion extents, feeds, spindle commands and '
            + 'warnings. Sends nothing to the machine. The program comes from exactly ONE of gcode (inline text), '
            + 'gcode_path (a file the Luban server reads from its allow-listed mcp-jobs-inbox directory - see '
            + 'get_stored_state.jobIntake for the path) or upload_id (a finished chunked upload). A large CAM file '
            + 'belongs in the inbox or an upload, never in one argument. REFUSED, not warned: a program whose spindle '
            + 'is still on at the end (M3/M4 never followed by M5) - the signature of a truncated program. The result '
            + 'carries the identity (SHA-256, bytes, line counts, first/last motion lines) of exactly what was received. '
            + 'The program is judged by the CONNECTED machine\'s G-code rules (machine.rulesApplied: frame form, laser S range, '
            + 'M4 short segments, Z on a Z-less machine, travel, Luban header, homing form, codes outside the machine\'s '
            + 'reference); machine.refusals lists what submit_gcode_job will refuse, and header is the Luban header it read.',
        inputSchema: {
            type: 'object',
            properties: {
                gcode: { type: 'string', description: 'Complete G-code text (small programs only).' },
                gcode_path: { type: 'string', description: 'Path of a .nc/.cnc/.gcode file inside the MCP jobs inbox (relative to it, or absolute within it).' },
                upload_id: { type: 'string', description: 'A chunked upload that finish_gcode_upload has verified; the upload stays available for submit_gcode_job.' },
            },
            additionalProperties: false,
        },
        handler: async (args: ProgramArgs) => {
            const input = resolveProgramInput(args);
            // Judged for the connected machine (#265 WP3): an incompatible code
            // or a header for another machine is a warning here and a refusal
            // at submit; the other rule refusals are listed in machine.refusals.
            const report = validateGcode(input.text, connectedValidationOptions('validate'));
            const identity = describeProgramIdentity(input.text);
            const refusal = spindleRefusal(report);
            if (refusal) {
                throw new McpToolError(`${refusal}\n\nReceived: ${identity.bytes} bytes, SHA-256 ${identity.sha256}, ${identity.lineCount} lines, `
                    + `last motion ${identity.lastMotion ? `line ${identity.lastMotion.line}: ${identity.lastMotion.text}` : '-'}, `
                    + `last line ${identity.lastLine ? `line ${identity.lastLine.line}: ${identity.lastLine.text}` : '-'}.`);
            }
            const suggestion = suggestGcode(input.text, report);
            return {
                ...report,
                identity,
                source: input.source,
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
            + 'code the operator gives you for start_gcode_job. Nothing is sent to the machine yet. '
            + 'The program comes from exactly ONE of gcode (inline text), gcode_path (a file the Luban server reads '
            + 'from its allow-listed mcp-jobs-inbox directory - get_stored_state.jobIntake says where) or upload_id (a '
            + 'chunked upload finish_gcode_upload has verified). A real CAM file (hundreds of KB) goes through the inbox or '
            + 'an upload - never emit it as one argument. Every route is validated, frame-resolved and staged identically, '
            + 'and the confirm page shows the program identity (SHA-256, bytes, lines, first/last motion lines). REFUSED: a '
            + 'program whose spindle is still on at the end - the signature of a truncated program; and anything the CONNECTED '
            + 'machine\'s G-code rules refuse (validate_gcode machine.refusals), including a code its reference calls '
            + 'incompatible and a Luban header (;machine:) naming another machine.',
        inputSchema: {
            type: 'object',
            properties: {
                gcode: { type: 'string', description: 'Complete G-code text (small programs only).' },
                gcode_path: { type: 'string', description: 'Path of a file inside the MCP jobs inbox (relative to it, or absolute within it). Read on the server.' },
                upload_id: { type: 'string', description: 'A finished chunked upload; it is consumed when the job is staged.' },
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
            required: ['name'],
            additionalProperties: false,
        },
        handler: async (args: ProgramArgs & { name?: string; head_type?: string; frame?: string }) => {
            const input = resolveProgramInput(args);
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
            const inspected = validateGcode(input.text, connectedValidationOptions('submit', headType));
            // A program whose spindle is still on at the end is a truncated
            // program (2026-10-15: the first part of a 295 KB V-carve reached
            // the page with only a warning). Refused before anything else,
            // with what was received, so the agent can see where it stopped.
            const truncated = spindleRefusal(inspected);
            if (truncated) {
                const identity = describeProgramIdentity(input.text);
                throw new McpToolError(`${truncated}\n\nReceived (${input.source.kind}): ${identity.bytes} bytes, SHA-256 ${identity.sha256}, `
                    + `${identity.lineCount} lines, last motion ${identity.lastMotion ? `line ${identity.lastMotion.line}: ${identity.lastMotion.text}` : '-'}, `
                    + `last line ${identity.lastLine ? `line ${identity.lastLine.line}: ${identity.lastLine.text}` : '-'}.`);
            }
            // Transport has tools. A hand-written transit is the path that
            // produced both the undeclared-frame job of 2026-09-12 and the
            // G53-stranded controller of 2026-09-19.
            if (headType === 'cnc' && isPureTransport(inspected)) {
                throw new McpToolError(TRANSPORT_REFUSAL);
            }
            // The connected machine's G-code rules (#265 WP3): this body is
            // streamed as written, so what they refuse never reaches the page.
            if (inspected.machine && inspected.machine.refusals.length) {
                throw new McpToolError(`${inspected.machine.refusals.join('\n\n')}\n\n(${inspected.machine.identifier}, `
                    + `${inspected.machine.dialect}; rules applied: ${inspected.machine.rulesApplied.join(', ')}.)`);
            }
            // A file job's start selects G54 and verifies its offset first (see
            // start_gcode_job), so a G54-only file may resolve its machine Z.
            const resolved = resolveJobFrame(inspected, { ...stagingFrameContext(frameArgument), verifiesG54AtStart: true });
            if (resolved.refusal) {
                throw new McpToolError(resolved.refusal + describeSuggestion(suggestGcode(input.text, resolved.report)));
            }
            const validation = resolved.report;
            const job = jobManager.submit(input.text, args.name, headType, validation, 'file', undefined, input.source);
            input.consume();

            return {
                job: jobManager.describe(job),
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                machine: validation.machine || null,
                header: validation.header || null,
                intake: describeInbox(),
                next_step: 'Ask the operator to open confirm_url in a browser, review, and approve. Then either call '
                    + 'start_gcode_job with wait_for_approval_ms (their click starts it - nothing to copy) or pass the '
                    + 'one-time code they relay as confirm_token.',
            };
        },
    });

    registry.register({
        name: 'begin_gcode_upload',
        description: 'Start a chunked upload of a G-code program too large for one tool argument, for a client that cannot '
            + 'write into the MCP jobs inbox (gcode_path is simpler when it can). Declare the name, the UTF-8 byte count '
            + 'of the WHOLE program and its SHA-256 up front; then append_gcode_chunk in seq order (0, 1, 2 ...), then '
            + 'finish_gcode_upload, which verifies both before validate_gcode {upload_id} / submit_gcode_job {upload_id} '
            + 'can use it. Split chunks on line boundaries. An upload untouched for 30 minutes is dropped. Nothing is sent to the machine.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Short program name (the job name you will submit).' },
                total_bytes: { type: 'number', description: 'UTF-8 byte count of the whole program, exactly as you will send it (same line endings).' },
                sha256: { type: 'string', description: 'Hex SHA-256 of those bytes.' },
            },
            required: ['name', 'total_bytes', 'sha256'],
            additionalProperties: false,
        },
        handler: async (args: { name?: unknown; total_bytes?: unknown; sha256?: unknown }) => intake(() => ({
            ...gcodeUploads.begin(args),
            // The machine validate/submit will judge the upload by (#265 WP3).
            connected_machine: describeConnectedMachine(),
            chunk_max_bytes: gcodeUploads.limits.chunkMaxBytes,
            next_step: 'append_gcode_chunk {upload_id, seq: 0, text}, then seq 1, 2 ... until remaining_bytes is 0; then finish_gcode_upload.',
        })),
    });

    registry.register({
        name: 'append_gcode_chunk',
        description: 'Send the next slice of a begun upload. Chunks must arrive in seq order starting at 0; a repeat of a seq '
            + 'already received with the same content is accepted as a no-op (safe to retry), a repeat with different content '
            + 'or a gap is refused. Split on line boundaries; each chunk at most chunk_max_bytes (256 KiB) of UTF-8.',
        inputSchema: {
            type: 'object',
            properties: {
                upload_id: { type: 'string' },
                seq: { type: 'number', description: '0-based chunk index; must equal next_seq from the previous result.' },
                text: { type: 'string', description: 'The chunk text, verbatim.' },
            },
            required: ['upload_id', 'seq', 'text'],
            additionalProperties: false,
        },
        handler: async (args: { upload_id?: unknown; seq?: unknown; text?: unknown }) => intake(() => gcodeUploads.append(args.upload_id, args.seq, args.text)),
    });

    registry.register({
        name: 'finish_gcode_upload',
        description: 'Close a chunked upload: refuses unless every declared byte arrived, then verifies the SHA-256 against the '
            + 'one declared at begin (a mismatch discards the upload). Returns the program identity (bytes, hash, line counts, '
            + 'first/last motion lines). Then validate_gcode {upload_id} (non-consuming) and submit_gcode_job {upload_id, name, '
            + 'frame} (consumes it on success).',
        inputSchema: {
            type: 'object',
            properties: {
                upload_id: { type: 'string' },
            },
            required: ['upload_id'],
            additionalProperties: false,
        },
        handler: async (args: { upload_id?: unknown }) => intake(() => {
            const finished = gcodeUploads.finish(args.upload_id);
            // The header the rules will compare with the connected machine (#265 WP3).
            const header = parseGcodeHeader(gcodeUploads.peek(args.upload_id).text);
            return {
                ...finished,
                header,
                connected_machine: describeConnectedMachine(),
                next_step: 'validate_gcode {upload_id} to read the report, then submit_gcode_job {upload_id, name, frame} to stage it.',
            };
        }),
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
            + 'in which case only confirm_token works. File start transport errors are reconciled against fresh heartbeats; '
            + 'start_unverified means it may have run: never retry/restage. Poll status and ask the operator to review; '
            + 'stop_gcode_job remains available. Results include retry_safe and machine_status_after.',
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

            if (job.kind === 'file' && job.startAttempt) {
                return {
                    ok: false,
                    job: jobManager.describe(job),
                    machine_status_after: job.startAttempt.machineStatusAfter,
                    retry_safe: false,
                    note: 'This file already had a start attempt. It may have run; this call sends nothing. '
                        + 'Poll get_gcode_job_status. Do not retry or restage without the operator reviewing the outcome.',
                };
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
            const channel = getJobChannelFor(job.kind);
            const status = machineStatus();
            if (status !== 'idle') {
                throw new McpToolError(`Machine is ${status || 'in an unknown state'}, not idle.`);
            }

            const active = jobManager.getActive();
            if (active && ['starting', 'started', 'start_unverified'].includes(active.state)) {
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
                // The runner is detached from this call's modal ledger (#221):
                // it gets its own, owned by this call while the call waits, so
                // a step still pending when this call returns "running" cannot
                // make the start look exposed, and the runner's own failure is
                // judged when IT ends (settleRunnerLedger), inside or outside
                // this call's wait.
                const runner = job.runner;
                const runnerLedger = runnerLedgerFor(job);
                const launched = runnerLedger ? runWithLedger(runnerLedger, async () => runner()) : runner();
                const finished = launched
                    .then(async (outcome) => {
                        // Where the time went, from the job's own events, so
                        // agents optimise from the record (get_job_timing has
                        // the same for running/failed jobs).
                        job.result = { ...(outcome as object), timing: summarizeJobTiming(job.events) };
                        job.state = 'completed';
                        job.endedAt = Date.now();
                        job.ending = { kind: 'completed', reason: 'procedure finished', at: job.endedAt, measured: countMeasured(outcome) };
                        jobManager.appendEvent(job, 'completed', { note: 'procedure finished; result stored on the job' });
                        // Success is never followed by commands; a G53/G91 it left is reported.
                        const evidence = await settleRunnerLedger(job, runnerLedger, { threw: false });
                        return { ok: true as const, outcome, evidence };
                    })
                    .catch(async (err: Error) => {
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
                        // Judged with the job already terminal and the stop
                        // request still visible: a stop/trip is never cleaned
                        // up; a failure on its own gets the call hook's guarded
                        // G90/G54. Reported on the job either way.
                        const evidence = await settleRunnerLedger(job, runnerLedger, { threw: true, thrown: err });
                        return { ok: false as const, error: err.message, evidence };
                    })
                    .finally(() => {
                        if (runnerLedger) {
                            closeLedger(runnerLedger);
                        }
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
                    // The runner's own evidence travels with its error (this
                    // call's ledger saw none of the runner's sends).
                    throw withEvidence(new McpToolError(settledInTime.error), settledInTime.evidence);
                }
                return {
                    job: jobManager.describe(job),
                    result: settledInTime.outcome,
                    ...(settledInTime.evidence ? { failure_recovery: settledInTime.evidence } : {}),
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
                const shouldWait = args.wait_until_moved !== undefined
                    ? args.wait_until_moved !== false
                    : job.waitUntilMoved !== false;
                const outcome = await executeDirectStep(job, channel as GcodeChannel, shouldWait);
                // The Ray: head state unknown, and the M5 this step led with.
                const stepToolheadNote = connectedToolheadNote(undefined, outcome.laserOffSent);
                const stepToolhead = stepToolheadNote ? { toolhead: stepToolheadNote } : {};
                if (outcome.remainingSteps > 0) {
                    return {
                        job: jobManager.describe(job),
                        ...stepToolhead,
                        position: outcome.settle.position,
                        position_verified: outcome.settle.verified,
                        warning: outcome.settle.warning,
                        remaining_steps: outcome.remainingSteps,
                        note: 'Step executed and settled. Call start_gcode_job again with the same '
                            + 'job_id and code for the next approved step; positions persist.',
                    };
                }
                return {
                    job: jobManager.describe(job),
                    ...stepToolhead,
                    position: outcome.settle.position,
                    position_verified: outcome.settle.verified,
                    warning: outcome.settle.warning,
                    note: 'Direct move executed; the position persists (no end-of-job park).',
                };
            }

            // Only a file job reaches here; getJobChannelFor checked its upload and start.
            const fileChannel = channel as FileJobChannel;
            job.state = 'starting';
            jobManager.setActive(job);
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
                    if (jobManager.getActive() === job) jobManager.setActive(null);
                    throw new McpToolError(job.error);
                }
            }
            // A stop while the workspace check/upload is in flight must not
            // subsequently dispatch a start.
            if (job.state !== 'starting') return { ok: false, job: jobManager.describe(job), retry_safe: false };
            const uploadError = await new Promise<string | null>((resolve) => {
                fileChannel.uploadGcodeFile(job.filePath, job.headType, `${job.name}.nc`, (msg) => {
                    resolve(msg ? String(msg) : null);
                });
            }).catch((err: Error) => err.message);
            if (job.state !== 'starting') return { ok: false, job: jobManager.describe(job), retry_safe: false };
            if (uploadError) {
                job.state = 'start_failed';
                job.error = `Upload failed: ${uploadError}`;
                job.endedAt = Date.now();
                jobManager.appendEvent(job, 'failed', { note: job.error });
                if (jobManager.getActive() === job) jobManager.setActive(null);
                throw new McpToolError(job.error);
            }
            jobManager.appendEvent(job, 'uploaded', { note: `${job.name}.nc uploaded to the machine` });

            // The connection the file will run on (#221): a later job-end judgement
            // must never treat a reconnected controller as the one that ran it.
            job.modalTrack = newModalTrack();
            job.startAttempt = { requestedAt: Date.now(),
                acknowledged: false,
                observedRunningAt: null,
                error: null,
                machineStatusAfter: null,
                retrySafe: false };
            // Observe before sending: even a slow/lost reply must not hide a
            // complete short run or its pauses/progress from the job record.
            const poll = watchFileJobCompletion(job, fileChannel);
            let started: { ok: boolean; code?: number; text?: string; notSent?: boolean };
            try {
                started = await fileChannel.startGcodeJob();
            } catch (err) {
                started = { ok: false, text: (err as Error).message };
            }
            if (connectedDialect().toolhead.state === 'unknown' && started.notSent !== true) {
                // The Ray: the file's own laser words run in the firmware, so the MCP's laser record can no longer vouch for them.
                noteMcpFileJob(connectedConnectionId() || 'none', job.name);
            }
            poll();
            job.startAttempt.acknowledged = started.ok;
            if (!started.ok) {
                job.startAttempt.error = started.text || String(started.code || 'unknown error');
                jobManager.appendEvent(job, 'start_response_error', { note: job.startAttempt.error, not_sent: started.notSent === true });
                log.warn(`MCP file job ${job.id} start response error: ${job.startAttempt.error}; state=${job.state}; notSent=${started.notSent === true}`);
            }
            if (!started.ok && started.notSent && job.state === 'starting') {
                job.state = 'start_failed';
                job.error = `Start failed: ${started.text || started.code || 'unknown error'}`;
                job.endedAt = Date.now();
                job.ending = { kind: 'controller-rejected', reason: job.error, at: job.endedAt };
                job.startAttempt.retrySafe = true;
                jobManager.appendEvent(job, 'failed', { note: job.error });
                if (jobManager.getActive() === job) jobManager.setActive(null);
                return { ok: false,
                    job: jobManager.describe(job),
                    machine_status_after: job.startAttempt.machineStatusAfter,
                    retry_safe: true,
                    note: 'Start was refused before sending. A new operator approval is required to restage.' };
            }
            if (started.ok) {
                markFileStarted(job);
            } else if (job.state === 'starting') {
                job.state = 'start_unverified';
                job.error = `Start unverified: ${job.startAttempt.error}. The file may have run; do not retry or restage. `
                    + 'Monitoring continues. Ask the operator to review the machine; stop_gcode_job remains available.';
                jobManager.appendEvent(job, 'start_unverified', { note: job.error, retry_safe: false });
                log.warn(`MCP file job ${job.id}: ${job.error}`);
                const deadline = Date.now() + FILE_JOB_START_RECONCILE_MS;
                while (job.state === 'start_unverified' && Date.now() < deadline) {
                    await sleep(250);
                    poll();
                }
            }
            return {
                ok: ['started', 'completed'].includes(job.state),
                job: jobManager.describe(job),
                machine_status_after: job.startAttempt.machineStatusAfter,
                retry_safe: false,
                note: job.error || (TERMINAL_JOB_STATES.includes(job.state) ? `Job is ${job.state}; no further start was sent.`
                    : 'File start acknowledged or confirmed by heartbeat. Poll get_gcode_job_status with wait_ms for progress '
                    + 'events and completion (no need to read server logs); the controller, its door '
                    + 'interlock and the machine UI remain in control. The job is marked completed when '
                    + 'the heartbeat settles back to idle.'),
            };
        },
    });

    registry.register({
        name: 'move_z',
        description: 'Request absolute Z motion, executed on the direct path so positions PERSIST '
            + '(on the Snapmaker Original: relative G91 Z steps with a Z settle comment and a G4 P0 planner sync, never G53/G54; '
            + 'refused on a machine with no Z axis or a J1; results carry gcode_form) '
            + '(the machine interpreter raises Z to top at the finish position when a file job '
            + 'completes, so a file job cannot hold a working Z - firmware behaviour). '
            + 'Either one target (z) or an ordered list (z_targets, max 20) for a methodical search: '
            + 'the operator approves the EXACT list once, and each start_gcode_job call then executes '
            + 'one step, so you can capture between steps and abandon the series at any point. Each '
            + 'z_targets entry is a number or {z, feed_rate} - a PER-STEP feed (#240): the standard fast-then-creep '
            + 'approach "F400 to 10 mm above the stock, then F60 for the last 10 mm" is ONE job, '
            + 'z_targets: [{z: 191.5, feed_rate: 400}, {z: 181.5, feed_rate: 60}]; a step without its own feed runs at '
            + 'feed_rate; every feed is clamped to 50-600 mm/min and every clip is reported (result.feed_clamps and the page). The '
            + 'confirm page shows current Z, every target, deltas and each step\'s feed; only the operator one-time '
            + 'code executes anything - except an UP-only series to no higher than mcpSafeTraverseZ on a verified, homed '
            + 'position with mcpTraverseWithoutApprovalAtSafeZ on (#241), which runs on the call (executed_without_approval: '
            + 'true); anything that descends stages. NOT door-interlocked - the operator supervises. Spindle must be '
            + 'off; the toolhead always carries a tool. REFUSED on a machine with no Z axis (get_position.connectedMachine.hasZ '
            + 'false - the Ray): there is nothing to raise, and XY transport there needs no Z first.',
        inputSchema: {
            type: 'object',
            properties: {
                z: { type: 'number', description: 'Absolute target Z (single move).' },
                z_targets: {
                    type: 'array',
                    items: {
                        anyOf: [
                            { type: 'number' },
                            {
                                type: 'object',
                                properties: {
                                    z: { type: 'number', description: 'Absolute target Z of this step.' },
                                    feed_rate: { type: 'number', description: 'mm/min for THIS step (50-600, clamped and reported); omit to use the call\'s feed_rate.' },
                                },
                                required: ['z'],
                                additionalProperties: false,
                            },
                        ],
                    },
                    minItems: 1,
                    maxItems: 20,
                    description: 'Ordered absolute Z targets, each a number or {z, feed_rate?}; one approval covers the exact list, '
                        + 'one start_gcode_job call per step. Mutually exclusive with z.',
                },
                coordinate_system: {
                    type: 'string',
                    enum: ['work', 'machine'],
                    description: 'Which frame z is in. Default work.',
                },
                feed_rate: { type: 'number', description: 'mm/min for every step without its own feed_rate, default 300, 50-600 (clamped and reported).' },
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
            z_targets?: (number | { z: number; feed_rate?: number })[];
            coordinate_system?: string;
            feed_rate?: number;
            reason?: string;
            wait_until_moved?: boolean;
        }) => {
            probeFeedService.assertNoOvertravel();
            // Which form this machine's Z steps take (gcodeForms.ts): the
            // Snapmaker 2.0's absolute G53/G54 step, or a relative step with a
            // Z settle comment (the Original). A printer (J1) or a machine the
            // dialect table does not list is refused here, naming it.
            const machine = traverseMachine('move_z');
            // A machine with no Z axis (the Ray) has no Z to move: say so
            // plainly, naming the machine, before anything else.
            requireZAxis('move_z');
            const relative = machine.gcode === 'grbl-relative';
            // Targets and per-step feeds (#240), every feed clamped to
            // MOVE_Z_FEED with the clip reported - moveZPlan.ts, pure.
            let zPlan: ReturnType<typeof resolveZTargets>;
            try {
                zPlan = resolveZTargets(args);
            } catch (err) {
                if (err instanceof MoveZPlanError) {
                    throw new McpToolError(err.message);
                }
                throw err;
            }
            const zSteps = zPlan.steps;
            const targets = zSteps.map((step) => step.z);
            const targetZ = targets[targets.length - 1];
            const coordinateSystem = args.coordinate_system || 'work';
            if (!['work', 'machine'].includes(coordinateSystem)) {
                throw new McpToolError('coordinate_system must be "work" or "machine".');
            }
            const feedRate = zPlan.defaultFeed;
            const feedClampLines = describeFeedClamps(zPlan.clamps);

            assertFreshHeartbeat('staging a Z move');
            const position = getPositionSnapshot();
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            if (position.isHomed !== true) {
                throw new McpToolError('Machine does not report homed; home before any Z positioning.');
            }
            assertToolheadNotOn('Toolhead appears to be on; refusing to move Z.');

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

            // Each step carries ITS OWN F word: the controller's modal feed
            // survives between files (A350, 2026-10-05), so a step without
            // one would run at whatever the previous step set.
            const dialect = machine.dialect || motionDialect();
            const { x: atX, y: atY } = position.machine;
            if (relative && (atX === null || atY === null || position.machine.z === null)) {
                throw new McpToolError(`Current machine position unknown; a relative Z step names its machine endpoint ${connectedMachineTag()}.`);
            }
            const toMachineZ = (t: number) => (coordinateSystem === 'machine' ? t : t - position.originOffset.z);
            const stepGcode = (t: number, feed: number, previous: number) => {
                if (relative) {
                    // A G91 Z increment from the previous planned endpoint, its
                    // `; mcp-settle machine X Y Z` naming the absolute machine
                    // endpoint (the current X/Y, so drift is caught too) - never
                    // a G53/G54 on this machine.
                    const at = { x: atX as number, y: atY as number };
                    return relativeStep(dialect, { from: { ...at, z: toMachineZ(previous) }, to: { ...at, z: toMachineZ(t) } }, feed,
                        { hasZ: machine.hasZ });
                }
                const words = `Z${t.toFixed(3)}`;
                return coordinateSystem === 'machine' ? machineFrameMove(dialect, words, feed) : workFrameMove(dialect, words, feed);
            };
            const steps = zSteps.map((step, i) => stepGcode(step.z, step.feedRate, i === 0 ? currentZ : targets[i - 1]));
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
                ...zSteps.map((step, i) => {
                    const from = i === 0 ? currentZ : targets[i - 1];
                    const d = step.z - from;
                    const feedNote = step.requestedFeedRate === null ? '' : ' (this step\'s own feed_rate)';
                    return `; step ${i + 1}: Z ${from.toFixed(3)} -> ${step.z.toFixed(3)} (${d >= 0 ? '+' : ''}${d.toFixed(3)} mm) F${step.feedRate}${feedNote}`;
                }),
                ...feedClampLines.map((line) => `; CLAMPED: ${line}`),
                ...(relative
                    ? ['; steps are RELATIVE (G91 Z.. G90, no G53/G54 on this machine): each is the delta from the previous planned Z,',
                        '; and its "; mcp-settle machine" line names the absolute machine X Y Z the position must report before the next step',
                        ...(needsPlannerSync(dialect) ? ['; each step ends G4 P0 (planner sync): only a report taken after it proves arrival'] : [])]
                    : []),
                '; sensors: NO contact expected during these moves - a probe/toolsetter trigger',
                '; while moving latches the CRASH alarm (probe feed must be armed).',
            ].join('\n');
            const reviewText = `${header}\n${steps.join('\n; --- next approved step ---\n')}`;
            const name = isBatch
                ? `z-series ${coordinateSystem} [${targets.map((t) => t.toFixed(1)).join(', ')}] - ${String(args.reason).slice(0, 40)}`
                : `z-move ${coordinateSystem} Z${targetZ.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}mm) - ${String(args.reason).slice(0, 40)}`;

            const validation = validateStagedEnvelope(reviewText, 'move_z', { relativeTransport: relative });
            const job = jobManager.submit(reviewText, name, 'cnc', validation, 'direct', isBatch ? steps : undefined);
            job.waitUntilMoved = args.wait_until_moved !== false;

            // The optional half of #241: a Z-only move that can only go UP, to
            // no higher than the traverse height, is the "retreat first" half
            // of law 2 - the one Z move that cannot descend (raiseToTop's own
            // reasoning). With the setting on and a verified, homed position
            // it runs on the call; a series that dips anywhere, or overshoots
            // the top, stages as before.
            const machineTargets = targets.map((t) => (coordinateSystem === 'machine' ? t : t - position.originOffset.z));
            const policy = decideSafeZRaise({
                ...safeZApprovalInput(),
                reliability: position.reliability,
                homed: position.isHomed,
                currentZ: position.machine.z,
                traverseZ: safeTraverseZ(),
                machineTargets,
            });
            if (policy.allowed) {
                const token = jobManager.approveByPolicy(job, policy.policy, policy.reason);
                const run = await runPolicyApprovedDirectJob(job, token, args.wait_until_moved !== false);
                return {
                    job: jobManager.describe(job),
                    connected_machine: describeConnectedMachine(),
                    gcode_form: motionGcodeForm(),
                    executed_without_approval: true,
                    approval: { source: 'policy', policy: policy.policy, reason: policy.reason },
                    current_z: currentZ,
                    targets,
                    machine_targets: machineTargets,
                    final_delta_mm: delta,
                    feed_rate: feedRate,
                    steps: zSteps.map((step) => ({ z: step.z, feed_rate: step.feedRate })),
                    feed_clamps: zPlan.clamps,
                    coordinate_system: coordinateSystem,
                    steps_executed: run.stepsExecuted,
                    position: run.settle.position,
                    position_verified: run.settle.verified,
                    warning: run.settle.warning,
                    note: `Executed on the call under ${policy.policy} (no confirm page): a Z-only, UP-only move to no higher than the `
                        + `traverse height ${safeTraverseZ()} on a ${position.reliability} position. The job is on the dashboard with this reason. `
                        + 'Turn this off in Settings > MCP > Motion rules.',
                };
            }

            return {
                job: jobManager.describe(job),
                connected_machine: describeConnectedMachine(),
                gcode_form: motionGcodeForm(),
                current_z: currentZ,
                targets,
                final_delta_mm: delta,
                feed_rate: feedRate,
                steps: zSteps.map((step) => ({ z: step.z, feed_rate: step.feedRate })),
                feed_clamps: zPlan.clamps,
                coordinate_system: coordinateSystem,
                staged_because: policy.reason,
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
            + 'exactly like move_z. TOP-Z POLICY (operator ruling 2026-10-17, #241; setting mcpTraverseWithoutApprovalAtSafeZ, '
            + 'default on): when the head is ALREADY at or above mcpSafeTraverseZ (328) on a verified/heartbeat, homed position '
            + 'and the route passes the landmark and travel checks, the call EXECUTES the move(s) itself and returns '
            + 'executed_without_approval: true - no confirm page, no start_gcode_job; the job record (dashboard, log, '
            + 'stop_gcode_job) is kept and marked approved by policy. Otherwise it stages as described and staged_because says why. '
            + 'Refused unless homed and the toolhead is already at or above mcpMotionFloorZ (default 320); stored landmarks may demand higher Z - '
            + 'raise it with move_z (coordinate_system "machine") first; there is deliberately no override. Every '
            + 'segment is checked against the stored landmarks and every target against the travel; Z is never '
            + 'written. Default frame MACHINE (G53 declared on every step; work-frame steps declare G54). This is the '
            + 'transport tool - move_and_capture is a <= 100 mm vision nudge, and hand-written file jobs for transport '
            + 'are how a frameless "G0 Z0" got staged on 2026-09-12. NOT door-interlocked - the operator supervises. '
            + 'MACHINE-AWARE (#260 follow-up): the result carries connected_machine {identifier, type, hasZ}. On a machine with NO Z '
            + 'axis (the Ray, hasZ false) the Z laws do not apply - no motion floor, no traverse height, no raise-first - the series '
            + 'runs at the machine\'s only height, the top-Z policy never auto-executes (there is no safe height to justify skipping '
            + 'approval, staged_because says so), and the steps are RELATIVE G91/G90 increments (Luban\'s own Ray jog form; each step '
            + 'names its absolute machine endpoint for the settle check) rather than G53. Landmarks, calibrations and stated travel '
            + 'are machine-scoped: only records set on the connected machine apply; the travel is the machine model +/- mcpTravelFudgeMm. '
            + 'The Snapmaker Original takes the same relative steps, each ending G4 P0 (its M114 is the queued target; only a report after '
            + 'the sync verifies arrival); a J1 is refused (printer). Results carry gcode_form (sm2 | relative-steps). '
            + 'COMPUTED SAFE HEIGHT (Motion rules R13, #265 WP10; operator-only toggle, default OFF): when the operator has turned '
            + 'it on for this machine and every requirement holds on the call (eligible machine, trusted tool protrusion, '
            + 'toolhead body stated, bed plane measured, landmarks confirmed, no device conflict, verified/heartbeat homed position), '
            + 'the series runs without approval at or above max(bed, physical landmark tops under the whole swept path) + the lowest '
            + 'point of toolhead + tool + the clearance (ideal, reduced toward the minimum under top Z; never below the motion floor). '
            + 'Z is never lowered: a head above that height traverses where it is, a head below it is first raised straight up to it '
            + '(entry_raise). Unless the top-Z policy already ran the call, the result carries computed_height {allowed, travelZ, '
            + 'clearanceUsed, ideal, min, governedBy, unmet}; when it stages, staged_because lists what is unmet. A legacy toolhead-basis landmark on the path has no physical top: '
            + 'top-Z behaviour there.',
        inputSchema: {
            type: 'object',
            properties: {
                stock: STOCK_ARG_SCHEMA,
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

            // Which machine this is decides which laws apply: a Z axis or not,
            // and which gcode form its firmware is known to execute
            // (tools/machine.ts traverseMachine). A printer (J1) or an unlisted
            // machine is refused first, naming it.
            const machine = traverseMachine('traverse_xy');
            assertFreshHeartbeat('staging an XY traverse');
            const position = getPositionSnapshot();
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            if (position.isHomed !== true) {
                throw new McpToolError(`Machine does not report homed; home before any XY transport ${connectedMachineTag()}.`);
            }
            const toolhead = assertToolheadNotOn('Toolhead appears to be on; refusing to traverse.');
            const { x: mx, y: my, z: mz } = position.machine;
            if (mx === null || my === null) {
                throw new McpToolError('Current machine position unknown; cannot plan the traverse.');
            }
            const capability = connectedMachineCapability();
            if (machine.hasZ && mz === null) {
                throw new McpToolError('Current machine Z unknown; cannot plan the traverse.');
            }
            const planZ = mz === null ? 0 : mz;
            const travel = requirePlanningTravel('a traverse', { x: mx, y: my });

            // Operator ruling 2026-10-17 (#241): with the head ALREADY at the
            // traverse height on a verified, homed position, an XY-only
            // transport whose route passes the landmark and travel checks
            // runs on the call - the page would add nothing. Decided from the
            // position of record alone; the plan below must still pass.
            const policy = decideSafeZTraverse({
                ...safeZApprovalInput(),
                reliability: position.reliability,
                homed: position.isHomed,
                currentZ: mz,
                traverseZ: safeTraverseZ(),
                hasZ: capability.hasZ,
            });
            // Motion rules R13 (#265 WP10): only when the top-Z policy does
            // not already run it, and only with the operator's toggle on (null
            // otherwise - the call is then byte for byte what it was).
            const computed = policy.allowed ? null : computedHeightForTraverse({ targets, frame: coordinateSystem, position, hasZ: capability.hasZ });
            const basePlan: TraversePlanInput = {
                targets,
                frame: coordinateSystem,
                currentMachine: { x: mx, y: my, z: planZ },
                originOffset: position.originOffset,
                travel: travel.limits,
                traverseZ: safeTraverseZ(),
                motionFloorZ: motionFloorZ(),
                feedRate,
                // Only landmarks set on THIS machine (landmarks.ts scopes by the connected identifier).
                obstacles: landmarkStore.obstacleBoxes(),
                ...clearanceOptions(),
                machine,
                reason,
            };
            let plan: TraversePlan | null = null;
            if (computed && computed.decision.allowed) {
                const decided = computed.decision;
                try {
                    plan = planTraverseXy({
                        ...basePlan,
                        ...(decided.raiseFromZ !== null ? { entryRaiseZ: decided.runZ, entryRaiseFeed: TRAVEL_FEED } : {}),
                        heightNote: `computed safe height (${COMPUTED_HEIGHT_TOGGLE}): ${computed.report.note || ''}`,
                    });
                } catch (err) {
                    if ((err as Error).name !== 'TraversePlanError') {
                        throw err;
                    }
                    // The computed plan failed its own landmark/travel check:
                    // never run it - plan the ordinary way and stage.
                    const unmet = [`the computed plan was refused: ${(err as Error).message}`];
                    computed.decision = { allowed: false, reason: `computed safe height not allowed: ${unmet[0]}`, unmet };
                    computed.report.allowed = false;
                    computed.report.unmet = unmet;
                }
            }
            if (!plan) {
                try {
                    plan = planTraverseXy(basePlan);
                } catch (err) {
                    if ((err as Error).name === 'TraversePlanError') {
                        throw new McpToolError(`${(err as Error).message} ${connectedMachineTag()}`);
                    }
                    throw err;
                }
            }
            const isBatch = plan.stepGcodes.length > 1;
            const validation = validateStagedEnvelope(plan.reviewText, 'traverse_xy', { relativeTransport: plan.relative });
            const stepGcodes = isBatch ? plan.stepGcodes : undefined;
            const job = jobManager.submit(plan.reviewText, plan.name, 'cnc', validation, 'direct', stepGcodes);
            job.waitUntilMoved = args.wait_until_moved !== false;
            // The Ray: head state unknown, and every step leads with M5 (gcodeForms.relativeStep).
            const toolheadNote = connectedToolheadNote(toolhead);
            const summary = {
                connected_machine: describeConnectedMachine(),
                ...(toolheadNote ? { toolhead: toolheadNote } : {}),
                current_machine: { x: mx, y: my, z: mz },
                /** null on a machine with no Z axis: no traverse height exists there. */
                traverse_z: machine.hasZ ? safeTraverseZ() : null,
                gcode_form: motionGcodeForm(),
                gcode_form_note: plan.relative
                    ? 'relative G91/G90 increments (no G53/G54 on this machine); each step names its machine endpoint in a settle comment'
                    : 'absolute, frame declared per step (G53 machine / G54 work)',
                coordinate_system: coordinateSystem,
                feed_rate: feedRate,
                steps: plan.steps.map((step) => ({
                    target: step.target,
                    machine: { x: step.to.x, y: step.to.y },
                    distance_mm: Number(step.distanceMm.toFixed(1)),
                })),
                total_distance_mm: Number(plan.totalDistanceMm.toFixed(1)),
                travel: { ...travel.limits, basis: describePlanningTravel(travel), conflicts: travel.conflicts },
            };

            // #241: the job record, the console reason and stop_gcode_job are
            // unchanged; only the click is gone. Anything else stages exactly
            // as before.
            if (policy.allowed && mz !== null) {
                const token = jobManager.approveByPolicy(job, policy.policy, policy.reason);
                const run = await runPolicyApprovedDirectJob(job, token, args.wait_until_moved !== false);
                return {
                    job: jobManager.describe(job),
                    executed_without_approval: true,
                    approval: { source: 'policy', policy: policy.policy, reason: policy.reason },
                    ran_at_machine_z: mz,
                    ...summary,
                    steps_executed: run.stepsExecuted,
                    position: run.settle.position,
                    position_verified: run.settle.verified,
                    warning: run.settle.warning,
                    note: `Executed on the call under ${policy.policy} (no confirm page): the head was already at the traverse height `
                        + `(machine Z ${mz.toFixed(3)}) on a ${position.reliability} position, Z was never written, and every leg was `
                        + 'checked against the landmarks and the travel. The job is on the dashboard with this reason; stop_gcode_job '
                        + 'still applies to a running series. Turn this off in Settings > MCP > Motion rules.',
                };
            }

            if (computed && computed.decision.allowed && mz !== null) {
                const decided = computed.decision;
                const token = jobManager.approveByPolicy(job, decided.policy, decided.reason);
                const run = await runPolicyApprovedDirectJob(job, token, args.wait_until_moved !== false);
                return {
                    job: jobManager.describe(job),
                    executed_without_approval: true,
                    approval: { source: 'policy', policy: decided.policy, reason: decided.reason },
                    ran_at_machine_z: decided.runZ,
                    entry_raise: plan.entryRaise
                        ? { from_machine_z: plan.entryRaise.fromZ, to_machine_z: plan.entryRaise.toZ, feed_rate: plan.entryRaise.feedRate }
                        : null,
                    computed_height: computed.report,
                    ...summary,
                    steps_executed: run.stepsExecuted,
                    position: run.settle.position,
                    position_verified: run.settle.verified,
                    warning: run.settle.warning,
                    note: `Executed on the call under ${decided.policy} (no confirm page): every R13 condition held on this call and `
                        + `the series ran at machine Z ${decided.runZ.toFixed(3)}, at or above the computed safe height of its swept path`
                        + `${plan.entryRaise ? ' after ONE straight-up raise to it' : ' (Z not written)'}; Z is never lowered without `
                        + 'the operator. Every leg was checked against the landmarks and the travel. The job is on the dashboard with '
                        + `this reason; stop_gcode_job still applies. Turn this off in Settings > MCP > Motion rules ('${COMPUTED_HEIGHT_TOGGLE}').`,
                };
            }

            return {
                job: jobManager.describe(job),
                ...summary,
                ...(computed ? { computed_height: computed.report } : {}),
                staged_because: computed
                    ? `${policy.reason}. ${computed.decision.reason}`
                    : policy.reason,
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
                vibration: await vibrationCaptureService.jobSummary(job.id),
            };
        },
    });

    registry.register({
        name: 'stop_gcode_job',
        description: 'Stop a running job. Stopping needs no confirmation. A PROCEDURE (probe_*, probe_program, '
            + 'run_tool_setter, survey) is a server-driven loop, so it stops at the next step boundary (within one '
            + '<= 1 mm step or sensor window), raises the head to the traverse height and keeps every completed '
            + 'station / contact / op on the job record (result, state "stopped"); this call waits up to wait_ms for '
            + 'that. A probe_approach_and_hold job HOLDING for the operator (job.hold set) is ENDED by this call: that is the '
            + 'sanctioned release - back off along the approach vector until the probe releases, then raise straight up to the '
            + 'traverse height; result keeps the measurement and the hold (hold.released says how it ended). '
            + 'A job that never reached the machine (any kind, awaiting confirmation or approved but not '
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
