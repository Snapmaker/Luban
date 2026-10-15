/* eslint-disable camelcase */
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

import * as failureRecovery from '../failureRecovery';
import {
    Exposure,
    FileLineEvidence,
    JobEndCategory,
    PositionReading,
    RecoveryDeps,
    RecoveryEvidence,
    fileModalExposure,
    recordModalSend,
    recoverAfterJobEnd,
} from '../failureRecovery';
import * as jobEnding from '../jobEnding';
import type { JobManager, McpJob } from '../jobs';
import { McpToolError, ToolRegistry } from '../registry';
import { isolatedModule } from './jobDashboard.test';

// Inert (#221): jobs that end outside the call that started them. File jobs
// are judged from their program text; procedure runners from their own
// ledger. No machine, no server; the cleanup's sends land in `sent`.

const AXIS = /[XYZABCIJK]\s*-?\d/i;
const CONN = '3.1';

interface Fake {
    deps: RecoveryDeps;
    sent: Array<{ connection: string | null; gcode: string }>;
    state: { connection: string | null; reading: PositionReading; authorityClosed: string | null; jobRunning: boolean };
}

function fake(): Fake {
    const sent: Fake['sent'] = [];
    const state: Fake['state'] = {
        connection: CONN,
        reading: {
            reliability: 'heartbeat',
            frame: 'work-frame',
            reportedAt: 5000,
            originOffset: { x: 120, y: 80, z: -40 },
            machineStatus: 'idle',
            rawImpossibleAsMachine: true,
        },
        authorityClosed: null,
        jobRunning: false,
    };
    const deps: RecoveryDeps = {
        connectionId: () => state.connection,
        send: async (_label, gcode) => {
            sent.push({ connection: state.connection, gcode });
            return { result: 0, text: 'ok' };
        },
        settle: async () => undefined,
        readPosition: () => state.reading,
        reliableForMotion: (r) => r === 'verified' || r === 'heartbeat',
        jobRunning: () => state.jobRunning,
        manualControl: () => false,
        authorityClosed: () => state.authorityClosed,
        now: () => 1000,
    };
    return { deps, sent, state };
}

// A machine-frame transit, then a work-frame cut, handing the frame back last.
const G53_FILE = ['G90', 'G53', 'G0 Z300', 'G0 X200 Y200', 'G54', 'G0 X0 Y0', 'G1 Z-1 F200', 'G1 X10', 'G0 Z5'].join('\n');
const G91_FILE = ['G54', 'G90', 'G0 X0 Y0', 'G91', 'G1 X1 F300', 'G1 X1', 'G1 X1', 'G90'].join('\n');

const LINES_UNKNOWN: FileLineEvidence = { lastLine: null, totalLines: null, lastProgress: null, ranToEnd: false };

async function judge(category: JobEndCategory, exposure: Exposure, f: Fake | null, startConnection: string | null = CONN): Promise<RecoveryEvidence | null> {
    return recoverAfterJobEnd({ jobId: 'job1', tool: 'file-job:test', category, reason: 'test ending', exposure, startConnection }, f ? f.deps : null);
}

// ----------------------------------------------------------------- gcode.ts harness

function managerFixture(files: Map<string, string>): JobManager {
    const loaded = isolatedModule('jobs.ts', {
        'fs-extra': {
            ensureDirSync: () => undefined,
            writeFileSync: (name: string, text: string) => files.set(name, text),
            readFileSync: (name: string) => files.get(name),
            remove: async (name: string) => files.delete(name),
        },
        '../../DataStorage': { tmpDir: '/fake' },
        '../../lib/logger': () => ({ info: () => undefined }),
        '../configstore': { get: () => undefined },
        './jobEnding': jobEnding,
        './jobDashboardState': require('../jobDashboardState'),
        './telemetryConfig': require('../telemetryConfig'),
        './activeTool': { describeActiveTool: () => ({ active: null }) },
    });
    return new loaded.JobManager();
}

/** tools/gcode.ts with inert dependencies and the REAL failureRecovery module (shared ledgers). */
function gcodeTools(manager: JobManager, files: Map<string, string>, firmwareStops: { count: number }) {
    const dependencies: Record<string, unknown> = {};
    const source = fs.readFileSync(path.join(__dirname, '../tools/gcode.ts'), 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) {
        dependencies[match[1]] = {};
    }
    const channel = {
        uploadGcodeFile: () => undefined,
        startGcodeJob: async () => ({ ok: true }),
        stopGcodeJob: async () => { firmwareStops.count += 1; return { ok: true }; },
    };
    Object.assign(dependencies, {
        'fs-extra': { readFileSync: (name: string) => files.get(name) },
        '../../../lib/logger': () => ({ info: () => undefined, warn: () => undefined, error: () => undefined }),
        '../../machine/ConnectionManager': {
            connectionManager: {
                getCurrentChannel: () => channel,
                getLatestMachineState: () => ({ status: 'idle', timestamp: Date.now() }),
            },
        },
        '../jobs': { jobManager: manager, TERMINAL_JOB_STATES: jobEnding.TERMINAL_JOB_STATES, approvalHandoff: () => 'agent' },
        '../jobEnding': jobEnding,
        '../jobTiming': { summarizeJobTiming: () => ({}) },
        '../failureRecovery': failureRecovery,
        '../manualControl': require('../manualControl'),
        '../registry': { McpToolError },
        '../procedureLimits': { MAX_WAIT_MS: 120000, STOP_WAIT_DEFAULT_MS: 20000, EVENT_POLL_MS: 50 },
        '../probing': { clearProcedureStop: () => undefined, procedureStopRequested: () => null, requestProcedureStop: () => ({ requestedAt: Date.now() }) },
        '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined, getTrip: () => null } },
        '../spindleTelemetry': { spindleTelemetryService: { startForJob: () => undefined, summary: () => null } },
        './machine': { assertFreshHeartbeat: () => undefined },
    });
    return isolatedModule('tools/gcode.ts', dependencies);
}

function approvedProcedure(manager: JobManager, runner: () => Promise<object>): McpJob {
    const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 0 } as unknown as McpJob['validation'];
    const job = manager.submit('', 'probe', 'cnc', validation, 'procedure');
    job.runner = runner;
    job.state = 'approved';
    job.confirmToken = 'human';
    job.approvedAt = Date.now();
    return job;
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['G53 file stopped mid-way: skipped, authority closed by the stop, restore_work_frame named, nothing sent', async () => {
        const f = fake();
        const exposure = fileModalExposure(G53_FILE, { ...LINES_UNKNOWN, lastLine: 3, totalLines: 9 });
        assert.equal(exposure.state.workspace, 'unknown', 'the stop may have landed inside the G53 section');
        assert.equal(exposure.g53_possible, true);
        const ev = await judge('stopped', exposure, f) as RecoveryEvidence;
        assert.equal(f.sent.length, 0, 'a stop never gets cleanup');
        assert.equal(ev.status, 'skipped');
        assert.equal(ev.skip_reason, 'stopped-or-tripped');
        assert.equal(ev.failure_kind, 'stopped');
        assert.ok(/closes command authority/.test(ev.explanation));
        assert.equal(ev.recovery_action, 'restore_work_frame');
        assert.equal(ev.job_id, 'job1');
        assert.equal(ev.connection.at_start, CONN);

        const tripped = await judge('authority-closed', exposure, f) as RecoveryEvidence;
        assert.equal(f.sent.length, 0);
        assert.equal(tripped.skip_reason, 'authority-closed');
    }],

    ['G91 file failed on a rejected line with the guards met: exactly G90, no axis words', async () => {
        const f = fake();
        const exposure = fileModalExposure(G91_FILE, { ...LINES_UNKNOWN, lastLine: 5, totalLines: 8 });
        assert.deepEqual(exposure.state, { workspace: 'G54', distance: 'unknown' });
        const ev = await judge('failed', exposure, f) as RecoveryEvidence;
        assert.deepEqual(f.sent.map((s) => s.gcode), ['G90'], 'workspace never changed by the file: only G90');
        assert.ok(f.sent.every((s) => s.connection === CONN && !AXIS.test(s.gcode)));
        assert.equal(ev.status, 'attempted');
        assert.equal(ev.resulting_modes?.distance_verified, false);

        const g53 = fake();
        await judge('failed', fileModalExposure(G53_FILE, { ...LINES_UNKNOWN, lastLine: 3 }), g53);
        assert.deepEqual(g53.sent.map((s) => s.gcode), ['G90', 'G54'], 'G53 possible: G90 then G54, separately');
        assert.ok(g53.sent.every((s) => !AXIS.test(s.gcode)));
    }],

    ['a failed job is never cleaned up behind a latch, a running job or a busy machine', async () => {
        const exposure = fileModalExposure(G91_FILE, LINES_UNKNOWN);
        const latched = fake();
        latched.state.authorityClosed = 'crash alarm latched (probe)';
        assert.equal((await judge('failed', exposure, latched))?.skip_reason, 'authority-closed');
        const running = fake();
        running.state.jobRunning = true;
        assert.equal((await judge('failed', exposure, running))?.skip_reason, 'another-operation-active');
        const busy = fake();
        busy.state.reading.machineStatus = 'running';
        assert.equal((await judge('failed', exposure, busy))?.skip_reason, 'machine-not-idle');
        assert.equal(latched.sent.length + running.sent.length + busy.sent.length, 0);
    }],

    ['failure after a connection replacement: skipped, nothing sent to the new controller', async () => {
        const f = fake();
        f.state.connection = '4.1';
        const ev = await judge('failed', fileModalExposure(G53_FILE, LINES_UNKNOWN), f) as RecoveryEvidence;
        assert.equal(f.sent.length, 0);
        assert.equal(ev.skip_reason, 'connection-replaced');
        assert.equal(ev.connection.at_start, CONN);
        assert.equal(ev.connection.at_cleanup, '4.1');
        // Start generation never captured: the connection cannot be proven the same.
        const g = fake();
        assert.equal((await judge('failed', fileModalExposure(G53_FILE, LINES_UNKNOWN), g, null))?.skip_reason, 'connection-replaced');
        assert.equal(g.sent.length, 0);
        // A lost connection is never cleaned up either.
        const lost = fake();
        lost.state.connection = null;
        assert.equal((await judge('connection-lost', fileModalExposure(G53_FILE, LINES_UNKNOWN), lost))?.skip_reason, 'disconnected');
    }],

    ['a completed job whose file hands the frame back carries no evidence', async () => {
        const f = fake();
        const exposure = fileModalExposure(G53_FILE, { ...LINES_UNKNOWN, ranToEnd: true });
        assert.equal(exposure.exposed, false);
        assert.equal(await judge('completed', exposure, f), null);
        assert.equal(f.sent.length, 0);
    }],

    ['a completed job that leaves G91: warning only, nothing sent', async () => {
        const f = fake();
        const exposure = fileModalExposure('G54\nG91\nG1 X1 F300', { ...LINES_UNKNOWN, ranToEnd: true });
        assert.deepEqual(exposure.state, { workspace: 'G54', distance: 'G91' });
        const ev = await judge('completed', exposure, f) as RecoveryEvidence;
        assert.equal(f.sent.length, 0, 'a completion is never followed by commands');
        assert.equal(ev.status, 'skipped');
        assert.equal(ev.failure_kind, 'none');
        assert.equal(ev.skip_reason, 'job-completed-with-modal-exposure');
        assert.equal(ev.recovery_action, 'restore_work_frame');
        assert.ok(/G54\/G91/.test(ev.warnings[0]));
    }],

    ['currentLine unknown: every prefix is possible, exposure unknown, skipped with a warning', async () => {
        const f = fake();
        const exposure = fileModalExposure(G53_FILE, LINES_UNKNOWN);
        assert.equal(exposure.state.workspace, 'unknown');
        assert.equal(exposure.exposed, true);
        assert.equal(exposure.file_window?.from_line, 0);
        assert.ok(/position in the file is unknown/.test(exposure.file_window?.basis || ''));
        const ev = await judge('stopped', exposure, f) as RecoveryEvidence;
        assert.equal(f.sent.length, 0);
        assert.ok(ev.warnings[0].includes('SKIPPED'));
    }],

    ['a line reading past the G53 section rules it out; the parser may still have read a G53 at the end', () => {
        const body = Array.from({ length: 50 }, (_, i) => `G1 X${i} F300`);
        const head = ['G53', 'G0 Z300', 'G54', ...body].join('\n');
        assert.equal(fileModalExposure(head, { ...LINES_UNKNOWN, lastLine: 40, totalLines: 53 }).exposed, false,
            'line 40 less the queue margin is past the G54');
        const tail = ['G54', ...body, 'G53', 'G0 Z300'].join('\n');
        const late = fileModalExposure(tail, { ...LINES_UNKNOWN, lastLine: 10 });
        assert.equal(late.state.workspace, 'unknown', 'the parser runs ahead of the cutter: the closing G53 may have been read');
        // A totalLines mismatch widens the margin (the controller numbered a different file).
        const shifted = fileModalExposure(head, { ...LINES_UNKNOWN, lastLine: 40, totalLines: 80 });
        assert.equal(shifted.state.workspace, 'unknown');
        // Progress is used only without a line reading.
        assert.equal(fileModalExposure(head, { ...LINES_UNKNOWN, lastProgress: 0.9 }).exposed, false);
    }],

    ['a G55 selection is not exposure for a completed file; G55 in doubt is not reset to G54', async () => {
        assert.equal(fileModalExposure('G55\nG1 X1 F100', { ...LINES_UNKNOWN, ranToEnd: true }).exposed, false);
        const f = fake();
        const exposure = fileModalExposure('G55\nG91\nG1 X1 F100\nG90\nG54', LINES_UNKNOWN);
        assert.equal(exposure.g53_possible, false);
        await judge('failed', exposure, f);
        assert.deepEqual(f.sent.map((s) => s.gcode), ['G90']);
    }],

    ['stop_gcode_job on a running G53 file job reports skipped evidence on the result and the job, sends nothing', async () => {
        const files = new Map<string, string>();
        const manager = managerFixture(files);
        const stops = { count: 0 };
        const { stopGcodeJob } = gcodeTools(manager, files, stops);
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 0 } as unknown as McpJob['validation'];
        const job = manager.submit(G53_FILE, 'g53 file', 'cnc', validation);
        job.state = 'started';
        job.modalTrack = { startConnection: CONN, lastLine: 3, totalLines: 9, lastProgress: null, stoppingSeen: false };
        manager.setActive(job);
        const result = await stopGcodeJob({ job_id: job.id }, 'agent') as { failure_recovery: RecoveryEvidence; job: { failure_recovery: RecoveryEvidence } };
        assert.equal(stops.count, 1);
        assert.equal(result.failure_recovery.skip_reason, 'stopped-or-tripped');
        assert.equal(result.failure_recovery.recovery_action, 'restore_work_frame');
        assert.equal(result.job.failure_recovery.skip_reason, 'stopped-or-tripped', 'also on get_gcode_job_status\'s job record');
        assert.ok(job.events.some((e) => e.phase === 'modal_recovery'));
    }],

    ['a procedure runner that fails inside the start wait gets its own guarded cleanup, reported on the start error', async () => {
        const files = new Map<string, string>();
        const manager = managerFixture(files);
        const f = fake();
        const registry = new ToolRegistry();
        registry.setFailureRecovery(f.deps);
        gcodeTools(manager, files, { count: 0 }).registerGcodeTools(registry, () => 'http://localhost');
        const job = approvedProcedure(manager, async () => {
            recordModalSend(CONN, 'G53')('accepted');
            recordModalSend(CONN, 'G1 X10 F500')('rejected');
            throw new Error('Controller rejected the move: error:22');
        });
        let err: (Error & { failureRecovery?: RecoveryEvidence }) | null = null;
        try {
            await registry.call('start_gcode_job', { job_id: job.id, confirm_token: 'human' });
        } catch (e) {
            err = e as Error & { failureRecovery?: RecoveryEvidence };
        }
        assert.ok(err && err.message.startsWith('Controller rejected the move: error:22\nfailure_recovery: '));
        assert.equal(err?.failureRecovery?.status, 'attempted', 'the waiting start call is the runner\'s owner, not another operation');
        assert.equal(err?.failureRecovery?.job_id, job.id);
        assert.deepEqual(f.sent.map((s) => s.gcode), ['G90', 'G54'], 'once, not again by the start call\'s own hook');
        assert.equal(job.state, 'start_failed');
        assert.equal(job.failureRecovery?.status, 'attempted');
    }],

    ['a runner still pending when start returns "running" gives the start no evidence', async () => {
        const files = new Map<string, string>();
        const manager = managerFixture(files);
        const f = fake();
        const registry = new ToolRegistry();
        registry.setFailureRecovery(f.deps);
        gcodeTools(manager, files, { count: 0 }).registerGcodeTools(registry, () => 'http://localhost');
        let finish: () => void = () => undefined;
        const job = approvedProcedure(manager, async () => {
            recordModalSend(CONN, 'G53'); // never settles within the call
            await new Promise<void>((resolve) => { finish = resolve; });
            return { stations: [] };
        });
        const result = await registry.call('start_gcode_job', { job_id: job.id, confirm_token: 'human', wait_ms: 20 }) as { running?: boolean; failure_recovery?: unknown };
        assert.equal(result.running, true);
        assert.equal(result.failure_recovery, undefined, 'the runner\'s pending G53 is not the start call\'s exposure');
        assert.equal(f.sent.length, 0);
        finish();
    }],
];
