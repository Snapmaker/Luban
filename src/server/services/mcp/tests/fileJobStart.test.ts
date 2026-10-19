/* eslint-disable camelcase */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as fileStart from '../fileJobStart';
import * as jobEnding from '../jobEnding';
import type { McpJob } from '../jobs';
import { frameRestoreJobRefusal } from '../frameRecovery';
import { McpToolError } from '../registry';
import { DialectId, dialectById } from '../gcodeDialect';
import { toolheadStubs } from './fixtures/toolheadStubs';
import { isolatedModule } from './jobDashboard.test';
import { managerFixture } from './jobModalRecovery.test';

// Exercise the registered tool with the real job manager and a fake clock,
// channel and heartbeat. No machine/server/network access.
// Channel shapes: 'file+direct' is the A350 over Wi-Fi (SstpHttpChannel: file
// upload/start AND executeGcode); 'direct-only' is the Ray (SacpUdpChannel) or
// the Original (TextSerialChannel): executeGcode, no file-job path.
type ChannelShape = 'file+direct' | 'direct-only' | 'none';

/** `machine` 'ray' loads the Ray's dialect row, whose motor-power mode is read through `readMotorPowerMode` (#321). */
/**
 * The judged position getPositionSnapshot reports (#323: a direct job records it
 * at staging and a relative-steps start compares it); setPosition moves it.
 */
export interface FixturePosition {
    machine: { x: number | null; y: number | null; z: number | null };
    reliability: string;
    isHomed: boolean | null;
    connectedMachine: { hasZ: boolean };
}

export function fixture(shape: ChannelShape = 'file+direct', machine: { dialect?: DialectId; readMotorPowerMode?: () => Promise<unknown> } = {}) {
    const dialect = dialectById(machine.dialect || 'sm2-marlin');
    let position: FixturePosition = {
        machine: { x: 1, y: 399, z: 0 }, reliability: 'heartbeat', isHomed: true, connectedMachine: { hasZ: dialect.id !== 'ray-grbl' },
    };
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
    const executed: string[] = [];
    const fileApi = {
        uploadGcodeFile: (_path: string, _head: string, _name: string, callback: (msg: unknown) => void) => { uploads++; upload(callback); },
        startGcodeJob: async () => { starts++; return start(); },
        stopGcodeJob: async () => { stops++; return { ok: true }; },
    };
    const executeGcode = async (gcode: string) => { executed.push(gcode); return { result: 0, text: 'ok' }; };
    const channel = { 'file+direct': { ...fileApi, executeGcode }, 'direct-only': { executeGcode }, none: {} }[shape];
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
        './machine': { assertFreshHeartbeat: () => undefined, getPositionSnapshot: () => position },
        '../startPosition': require('../startPosition'),
        // WP4a: pure modules, the real ones.
        '../logicalFrame': require('../logicalFrame'),
        '../gcodeForms': require('../gcodeForms'),
        '../gcodeDialect': require('../gcodeDialect'),
        '../toolheadState': require('../toolheadState'),
        '../connectedMachine': {
            ...toolheadStubs(() => report as never, dialect, McpToolError, machine.readMotorPowerMode || null),
            connectedDialect: () => dialect,
            connectedMachineTag: () => `(machine: ${shape})`,
        },
        // The direct-step path (executeDirectStep): the send goes straight to the channel.
        './camera': {
            GcodeNotSentError: class GcodeNotSentError extends Error {},
            sendGcodeVisible: async (target: { executeGcode: typeof executeGcode }, _tool: string, payload: string) => target.executeGcode(payload),
        },
        '../traversePlan': { parseSettleComment: () => null },
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
    // An approved direct job as traverse_xy / goto_work_origin stage it on the Ray (M5 leads the step).
    const createDirectJob = (kind: 'direct' | 'procedure' = 'direct') => {
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 1 } as unknown as McpJob['validation'];
        const job = manager.submit('; direct move\nM5\nG91\nG0 X10 Y0\nG90', 'traverse', 'cnc', validation, kind);
        job.state = 'approved'; job.confirmToken = 'human'; job.approvedAt = Date.now();
        return job;
    };
    // An approved direct BATCH (traverse_xy on the Ray): each step names its endpoint in a settle line.
    const createDirectBatch = (steps: string[]) => {
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: steps.length } as unknown as McpJob['validation'];
        const job = manager.submit(steps.join('\n; --- next approved step ---\n'), 'traverse', 'cnc', validation, 'direct', steps);
        job.state = 'approved'; job.confirmToken = 'human'; job.approvedAt = Date.now();
        return job;
    };
    return {
        manager,
        createJob,
        createDirectJob,
        createDirectBatch,
        setPosition: (change: Partial<FixturePosition> & { at?: Partial<FixturePosition['machine']> }) => {
            const { at, ...rest } = change;
            position = { ...position, ...rest, machine: { ...position.machine, ...(at || {}) } };
        },
        executed,
        startDirect: async (job: McpJob) => handlers.start_gcode_job({ job_id: job.id, confirm_token: 'human', wait_until_moved: false }),
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
    // Live 2026-10-19 on the Ray (jobs 36fa11c67b4e, 7a19f87b186a): every approved
    // direct job was refused at start by the file-upload check.
    ['executeGcode-only channel (Ray, Original): an approved direct job runs through the direct-step path', async () => {
        const f = fixture('direct-only'); const job = f.createDirectJob();
        const result = await f.startDirect(job);
        assert.equal(job.state, 'completed', JSON.stringify(result));
        assert.equal(f.executed.length, 1);
        assert.match(f.executed[0], /^M5\n/, 'the staged M5 still leads the step');
        assert.ok(!/^;/m.test(f.executed[0]), 'comment lines are not sent');
        assert.equal(f.counts().uploads, 0); assert.equal(f.counts().starts, 0);
    }],
    ['executeGcode-only channel still refuses a FILE job, before the approval is consumed', async () => {
        const f = fixture('direct-only'); const job = f.createJob();
        await assert.rejects(f.call(job), /does not support file job submission/);
        assert.equal(job.state, 'approved'); assert.equal(job.confirmToken, 'human'); assert.ok(!job.tokenUsed);
        assert.equal(f.executed.length, 0); assert.equal(f.counts().uploads, 0);
    }],
    ['a channel without executeGcode refuses direct jobs and procedures by name, before the approval is consumed', async () => {
        const f = fixture('none');
        const direct = f.createDirectJob();
        await assert.rejects(f.startDirect(direct), /does not support direct moves\. \(machine: none\)/);
        assert.equal(direct.state, 'approved'); assert.ok(!direct.tokenUsed);
        const procedure = f.createDirectJob('procedure');
        let ran = false;
        procedure.runner = async () => { ran = true; return {}; };
        await assert.rejects(f.call(procedure), /cannot run a server-driven procedure/);
        assert.equal(procedure.state, 'approved'); assert.ok(!procedure.tokenUsed); assert.equal(ran, false);
    }],
    ['both-capability channel (A350): a direct job runs over executeGcode and never uploads', async () => {
        const f = fixture(); const job = f.createDirectJob();
        await f.startDirect(job);
        assert.equal(job.state, 'completed');
        assert.equal(f.executed.length, 1);
        assert.equal(f.counts().uploads, 0); assert.equal(f.counts().starts, 0);
    }],
    ['stopping a handed-over direct job on an executeGcode-only channel names the missing stop, not file submission', async () => {
        const f = fixture('direct-only'); const job = f.createDirectJob();
        job.state = 'started';
        await assert.rejects(f.stop(job), /does not support stopping jobs/);
    }],
];
