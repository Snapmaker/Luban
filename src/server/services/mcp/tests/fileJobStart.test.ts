/* eslint-disable camelcase */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as fileStart from '../fileJobStart';
import * as jobEnding from '../jobEnding';
import type { McpJob } from '../jobs';
import { frameRestoreJobRefusal } from '../frameRecovery';
import { McpToolError } from '../registry';
import { isolatedModule } from './jobDashboard.test';
import { managerFixture } from './jobModalRecovery.test';

// Exercise the registered tool with the real job manager and a fake clock,
// channel and heartbeat. No machine/server/network access.
function fixture() {
    const files = new Map<string, string>();
    const manager = managerFixture(files);
    let now = Date.now();
    let tick: (() => void) | null = null;
    let onSleep = () => undefined;
    let report: fileStart.FileStartReport | null = { status: 'idle', timestamp: now };
    let otherChannel = false;
    let generation = '1.0';
    let uploads = 0;
    let starts = 0;
    let telemetry = 0;
    let vibrations = 0;
    let stops = 0;
    let start: () => Promise<{ ok: boolean; text?: string; notSent?: boolean }> = async () => ({ ok: true });
    let upload: (callback: (msg: unknown) => void) => void = (callback) => callback(null);
    const channel = {
        uploadGcodeFile: (_path: string, _head: string, _name: string, callback: (msg: unknown) => void) => { uploads++; upload(callback); },
        startGcodeJob: async () => { starts++; return start(); },
        stopGcodeJob: async () => { stops++; return { ok: true }; },
    };
    const dependencies: Record<string, unknown> = {};
    const source = fs.readFileSync(path.join(__dirname, '../tools/gcode.ts'), 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) dependencies[match[1]] = {};
    Object.assign(dependencies, {
        'fs-extra': { readFileSync: (name: string) => files.get(name) },
        '../../../lib/logger': () => ({ info: () => undefined, warn: () => undefined, error: () => undefined }),
        '../../machine/ConnectionManager': { connectionManager: {
            getCurrentChannel: () => (otherChannel ? {} : channel),
            getLatestMachineState: () => report,
            getConnectionGeneration: () => generation,
        } },
        '../jobs': { jobManager: manager, TERMINAL_JOB_STATES: jobEnding.TERMINAL_JOB_STATES, approvalHandoff: () => 'agent' },
        '../jobEnding': jobEnding,
        '../fileJobStart': fileStart,
        '../registry': { McpToolError },
        '../procedureLimits': { MAX_WAIT_MS: 120000 },
        '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
        '../spindleTelemetry': { spindleTelemetryService: { startForJob: () => { telemetry++; } } },
        '../vibrationCaptures': { vibrationCaptureService: { startForJob: () => { vibrations++; } } },
        './machine': { assertFreshHeartbeat: () => undefined },
    });
    const loaded = isolatedModule('tools/gcode.ts', dependencies, {
        Date: { now: () => now },
        setTimeout: (fn: () => void, ms: number) => { now += ms; onSleep(); fn(); },
        setInterval: (fn: () => void) => { tick = fn; return 1; },
        clearInterval: () => { tick = null; },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, (args: object) => Promise<any>> = {};
    loaded.registerGcodeTools({ register: (tool: { name: string; handler: typeof handlers[string] }) => { handlers[tool.name] = tool.handler; } }, () => 'http://localhost');
    const createJob = () => {
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 1 } as unknown as McpJob['validation'];
        const job = manager.submit('G54\nG90\nG1 X1 F100\nM5', 'drill', 'cnc', validation);
        job.state = 'approved'; job.confirmToken = 'human'; job.approvedAt = Date.now();
        return job;
    };
    return {
        manager,
        createJob,
        handlers,
        setStart: (fn: typeof start) => { start = fn; },
        setUpload: (fn: typeof upload) => { upload = fn; },
        setOnSleep: (fn: () => undefined) => { onSleep = fn; },
        setReport: (status: string, name = 'drill.nc', timestamp?: number) => {
            now += 1000;
            report = { status, timestamp: timestamp ?? now, gcodePrintingInfo: { name, sent: 2, total: 5, progress: 0.4 } };
        },
        disconnect: () => { report = null; },
        reconnect: () => { otherChannel = true; },
        changeGeneration: () => { generation = '1.1'; },
        tick: () => { tick?.(); },
        counts: () => ({ uploads, starts, telemetry, vibrations, stops }),
        call: async (job: McpJob) => handlers.start_gcode_job({ job_id: job.id, confirm_token: 'human' }),
        stop: (job: McpJob) => loaded.stopGcodeJob({ job_id: job.id }),
    };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['lost response plus fresh running heartbeat adopts the run, tracks progress and completes once', async () => {
        const f = fixture(); const job = f.createJob();
        f.setStart(async () => { f.setReport('running'); return { ok: false, text: 'read ECONNRESET' }; });
        const result = await f.call(job);
        assert.equal(result.ok, true); assert.equal(result.retry_safe, false);
        assert.equal(job.state, 'started'); assert.ok(job.startedAt);
        assert.equal(job.startAttempt?.error, 'read ECONNRESET');
        assert.equal(job.modalTrack?.lastLine, 2);
        assert.ok(job.events.some((event) => event.phase === 'progress'));
        f.setReport('paused'); f.tick();
        assert.ok(job.events.some((event) => event.phase === 'paused'));
        f.setReport('idle'); f.tick(); f.tick(); f.tick();
        assert.equal(job.state, 'started', 'one cached idle report is not three reports');
        f.setReport('idle'); f.tick(); f.setReport('idle'); f.tick();
        assert.equal(job.state, 'completed'); assert.equal(f.manager.getActive(), null);
        assert.equal((await f.call(job)).retry_safe, false);
        assert.deepEqual(f.counts(), { uploads: 1, starts: 1, telemetry: 1, vibrations: 1, stops: 0 });
    }],
    ['delayed running heartbeat reconciles within the bounded wait', async () => {
        const f = fixture(); const job = f.createJob();
        f.setStart(async () => ({ ok: false, text: 'timeout' }));
        f.setOnSleep(() => { f.setReport('running'); return undefined; });
        assert.equal((await f.call(job)).ok, true);
        assert.equal(job.state, 'started');
        assert.equal(f.counts().starts, 1);
    }],
    ['idle alone remains unverified, blocks retries and competing jobs, and still allows stop', async () => {
        const f = fixture(); const job = f.createJob();
        f.setStart(async () => { f.setReport('idle'); throw new Error('socket hang up'); });
        const result = await f.call(job);
        assert.equal(result.ok, false); assert.equal(result.retry_safe, false);
        assert.equal(result.machine_status_after, 'idle');
        assert.equal(job.state, 'start_unverified'); assert.equal(job.startedAt, null); assert.equal(job.endedAt, null);
        assert.equal(f.manager.getActive(), job);
        assert.equal((await f.call(job)).retry_safe, false);
        await assert.rejects(f.call(f.createJob()), /still active/);
        assert.match(frameRestoreJobRefusal(job) || '', /start_unverified/);
        assert.equal(jobEnding.planJobStop('file', 'start_unverified').action, 'machine-stop');
        await f.stop(job);
        assert.equal(job.state, 'stopped'); assert.equal(f.manager.getActive(), null);
        assert.equal(f.counts().starts, 1); assert.equal(f.counts().stops, 1);
    }],
    ['late heartbeat after reconciliation timeout still adopts the run', async () => {
        const f = fixture(); const job = f.createJob();
        f.setStart(async () => { f.disconnect(); return { ok: false, text: 'ECONNRESET' }; });
        await f.call(job); assert.equal(job.state, 'start_unverified');
        f.setReport('running'); f.tick(); assert.equal(job.state, 'started');
        assert.equal(f.counts().telemetry, 1);
    }],
    ['a complete short run during a pending HTTP reply is tracked and never resurrected', async () => {
        const f = fixture(); const job = f.createJob();
        f.setStart(async () => {
            f.setReport('running'); f.tick();
            for (let i = 0; i < 3; i++) { f.setReport('idle'); f.tick(); }
            assert.equal(job.state, 'completed');
            return { ok: false, text: 'timeout' };
        });
        assert.equal((await f.call(job)).ok, true);
        assert.equal(job.state, 'completed'); assert.equal(f.manager.getActive(), null);
        assert.equal(f.counts().starts, 1);
    }],
    ['stale, different-file and reconnected reports never confirm an uncertain start', async () => {
        for (const mode of ['stale', 'different-file', 'reconnected', 'new-session']) {
            const f = fixture(); const job = f.createJob();
            f.setStart(async () => {
                f.setReport('running', mode === 'different-file' ? 'another.nc' : 'drill.nc', mode === 'stale' ? 1 : undefined);
                if (mode === 'reconnected') f.reconnect();
                if (mode === 'new-session') f.changeGeneration();
                return { ok: false, text: 'ECONNRESET' };
            });
            await f.call(job);
            assert.equal(job.state, 'start_unverified', mode);
            assert.equal(f.counts().telemetry, 0, mode);
        }
    }],
    ['known pre-send refusal is failed and safe to restage only with new approval', async () => {
        const f = fixture(); const job = f.createJob();
        f.setStart(async () => ({ ok: false, text: 'lease held', notSent: true }));
        assert.equal((await f.call(job)).retry_safe, true);
        assert.equal(job.state, 'start_failed'); assert.equal(f.manager.getActive(), null);
        assert.equal((await f.call(job)).retry_safe, false, 'same job never replays');
        assert.equal(f.counts().starts, 1);
    }],
    ['stop during upload prevents start; stop during pending start is never resurrected', async () => {
        for (const phase of ['upload', 'start']) {
            const f = fixture(); const job = f.createJob();
            if (phase === 'upload') {
                f.setUpload((callback) => { f.stop(job).then(() => callback(null)); });
            } else {
                f.setStart(async () => { await f.stop(job); return { ok: true }; });
            }
            await f.call(job);
            assert.equal(job.state, 'stopped'); assert.equal(f.manager.getActive(), null);
            assert.equal(f.counts().starts, phase === 'upload' ? 0 : 1);
            assert.equal(f.counts().telemetry, 0);
        }
    }],
    ['ordinary acknowledged start attaches telemetry once and completes', async () => {
        const f = fixture(); const job = f.createJob();
        assert.equal((await f.call(job)).ok, true);
        assert.equal(job.state, 'started'); assert.equal(job.startAttempt?.acknowledged, true);
        f.setReport('running'); f.tick();
        for (let i = 0; i < 3; i++) { f.setReport('idle'); f.tick(); }
        assert.equal(job.state, 'completed'); assert.equal(f.counts().telemetry, 1);
    }],
    ['classification rejects pre-request, future and expired reports', () => {
        for (const timestamp of [100, 20000, -10000]) {
            assert.equal(fileStart.fileStartEvidence({ status: 'running', timestamp }, 100, 1000, true, 'drill.nc'), 'unknown');
        }
        assert.equal(fileStart.fileStartEvidence({ status: 'running', timestamp: 200 }, 100, 1000, true, 'drill.nc'), 'active');
        const report = { status: 'running', timestamp: 200, gcodePrintingInfo: { total: 208 } };
        assert.equal(fileStart.fileStartEvidence(report, 100, 1000, true, 'drill.nc', 208), 'active');
        assert.equal(fileStart.fileStartEvidence(report, 100, 1000, true, 'drill.nc', 500), 'unknown');
    }],
];
