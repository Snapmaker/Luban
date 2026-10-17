import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import type http from 'http';
import type { JobManager, McpJob } from '../jobs';
import * as jobEnding from '../jobEnding';
import * as workspace from '../workspace';
import { validateGcode } from '../validator';
import { handleJobDashboardRequest } from '../jobDashboard';
import { JobDashboardFeed, summarizeDashboardJob } from '../jobDashboardState';
import { dashboardHtml, notificationWorker } from '../jobDashboardPage';

function job(id = 'abcdef', state: McpJob['state'] = 'awaiting_confirmation'): McpJob {
    return {
        id,
        state,
        name: 'test',
        kind: 'file',
        events: [],
        eventSeq: 0,
        createdAt: 1,
        confirmToken: 'secret',
        filePath: '/secret/job.nc',
        runner: async () => ({}),
    } as unknown as McpJob;
}

async function request(manager: object, route: string, method = 'GET', headers = {}, stop: (id: string) => Promise<object> = async () => ({ ok: true })) {
    return new Promise<{ status: number; body: string; headers: Record<string, string> }>((resolve) => {
        let status: number;
        let responseHeaders: Record<string, string>;
        const res = {
            writeHead(code: number, values: Record<string, string>) { status = code; responseHeaders = values; },
            end(body: string) { resolve({ status, body, headers: responseHeaders }); },
        } as http.ServerResponse;
        handleJobDashboardRequest({ method, headers } as http.IncomingMessage, res, new URL(route, 'http://localhost'), manager as JobManager, stop);
    });
}

// Load server-bound code with explicit inert dependencies; never start Luban or connect to hardware.
export function isolatedModule(file: string, dependencies: Record<string, unknown>) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true } });
    const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    vm.runInNewContext(compiled.outputText, {
        exports,
        Buffer,
        setTimeout,
        process: { env: {} },
        require: (name: string) => {
            if (name in dependencies) { return dependencies[name]; }
            if (name === 'crypto') { return require('crypto'); }
            if (name === 'path') { return path; }
            throw new Error(`Unstubbed dependency: ${name}`);
        },
    }, { filename: file });
    return exports;
}

function managerFixture() {
    const files = new Map<string, string>();
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
    return loaded;
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['registered workspace tool stages inertly and the real start gate refuses absent approval', async () => {
        const { JobManager: Manager } = managerFixture();
        const manager: JobManager = new Manager();
        let commands = 0;
        let sequence = 0;
        let resetAt = 1;
        let runnerCalls = 0;
        const channel = { uploadGcodeFile: () => undefined, startGcodeJob: () => undefined };
        const state = { timestamp: Date.now(), status: 'idle', headPower: 0 };
        const connection = { getCurrentChannel: () => channel, getLatestMachineState: () => state };
        const position = {
            machine: { x: 230, y: 245, z: 328 },
            work: { x: 60, y: 110, z: 120 },
            originOffset: { x: -170, y: -135, z: -208 },
            originOffsetSource: 'heartbeat',
            reliability: 'heartbeat',
            frame: 'work-frame',
            warnings: [],
            machineStatus: 'idle',
            isHomed: true,
            b: 0,
            isFourAxis: true,
            reportedAt: state.timestamp,
            reportAgeMs: 0,
        };
        const handlers: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
        const registry = { register: (tool: { name: string }) => { handlers[tool.name] = tool; } };
        const dependencies = {
            '../../machine/ConnectionManager': { connectionManager: connection },
            '../jobs': { jobManager: manager },
            '../positionOfRecord': { currentGcodeSequence: () => sequence },
            '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
            '../probing': { assertMachineReadyForProcedure: () => undefined, checkProcedureStop: () => undefined, getDirectChannel: () => channel },
            '../registry': { McpToolError: Error },
            '../workspace': workspace,
            './camera': { sendGcodeVisible: async () => { commands++; return { result: 0 }; } },
            './machine': { getPositionSnapshot: () => position, machinePositionDiagnostics: () => ({ resetAt }) },
            './staging': { validateStagedEnvelope: validateGcode },
        };
        isolatedModule('tools/workspace.ts', dependencies).registerWorkspaceTools(registry, () => 'http://localhost');
        const staged = await handlers.set_workspace_origin.handler({
            workspace: 'G59.3', origin_machine: { x: 230, y: 245, z: 231.3 }, datum_reference: 'Measured datum; probe; B0', reason: 'Existing job',
        });
        assert.strictEqual(commands, 0);
        assert(staged.confirm_url.endsWith(staged.job.id));
        const stagedJob = manager.get(staged.job.id);
        assert(stagedJob);
        assert.strictEqual(stagedJob.state, 'awaiting_confirmation');
        assert.strictEqual(stagedJob.kind, 'procedure');
        assert.strictEqual((manager.describe(stagedJob) as { confirmToken?: string }).confirmToken, undefined);
        const runner = stagedJob.runner;
        assert(runner);
        stagedJob.runner = async () => { runnerCalls++; return {}; };
        const startDeps: Record<string, unknown> = {};
        const source = fs.readFileSync(path.join(__dirname, '../tools/gcode.ts'), 'utf8');
        for (const match of source.matchAll(/from '([^']+)'/g)) startDeps[match[1]] = {};
        Object.assign(startDeps, {
            '../../../lib/logger': () => ({}),
            '../../machine/ConnectionManager': { connectionManager: connection },
            '../jobs': { jobManager: manager, TERMINAL_JOB_STATES: jobEnding.TERMINAL_JOB_STATES },
            '../registry': { McpToolError: Error },
            '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
            './machine': { assertFreshHeartbeat: () => undefined },
        });
        isolatedModule('tools/gcode.ts', startDeps).registerGcodeTools(registry, () => 'http://localhost');
        await assert.rejects(async () => handlers.start_gcode_job.handler({ job_id: stagedJob.id, confirm_token: 'invented' }), /not approved/);
        assert.strictEqual(runnerCalls, 0);
        assert.strictEqual(commands, 0);
        sequence++;
        await assert.rejects(runner, /after staging/);
        sequence--;
        resetAt++;
        await assert.rejects(runner, /connection changed/);
        assert.strictEqual(commands, 0);
        // An idle controller between procedure commands is not an idle server runner.
        stagedJob.state = 'approved'; stagedJob.confirmToken = 'human'; stagedJob.approvedAt = Date.now();
        const active = manager.submit('', 'active procedure', 'cnc', validateGcode(''), 'procedure');
        active.state = 'started'; manager.setActive(active);
        await assert.rejects(async () => handlers.start_gcode_job.handler({ job_id: stagedJob.id, confirm_token: 'human' }), /still active/);
        assert.strictEqual(stagedJob.tokenUsed, false);
        assert.strictEqual(runnerCalls, 0);
    }],

    ['workspace changes invalidate prior approvals even after reapproval, but permit freshly staged jobs', () => {
        const { JobManager: Manager } = managerFixture();
        const manager: JobManager = new Manager();
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 0 } as unknown as McpJob['validation'];
        const old = manager.submit('', 'old', 'cnc', validation);
        old.state = 'approved'; old.confirmToken = 'human-token'; old.approvedAt = Date.now();
        const change = manager.submit('', 'workspace', 'cnc', validation, 'procedure');
        manager.invalidateWorkspaceApprovals(change);
        assert.strictEqual(manager.consumeToken(old, 'human-token').ok, false);
        assert.strictEqual(old.tokenUsed, false);
        assert(manager.consumeToken(old, 'human-token').reason?.includes('restage'));
        const intermediate = manager.submit('', 'during update', 'cnc', validation);
        intermediate.state = 'approved'; intermediate.confirmToken = 'human-token'; intermediate.approvedAt = Date.now();
        manager.invalidateWorkspaceApprovals(change);
        assert.strictEqual(manager.consumeToken(intermediate, 'human-token').ok, false);
        const fresh = manager.submit('', 'new', 'cnc', validation);
        assert.strictEqual(manager.consumeToken(fresh, 'human-token').ok, false);
        fresh.state = 'approved'; fresh.confirmToken = 'human-token'; fresh.approvedAt = Date.now();
        assert.strictEqual(manager.consumeToken(fresh, 'wrong-token').ok, false);
        assert.strictEqual(manager.consumeToken(fresh, 'human-token').ok, true);
    }],
    ['feed preserves quick lifecycle transitions, skips telemetry, and suppresses initial history', () => {
        const feed = new JobDashboardFeed();
        const initial = feed.read(null, null);
        for (const phase of ['submitted', 'approved', 'started', 'gcode', 'completed']) { feed.record(job(), phase); }
        const next = feed.read(initial.cursor, initial.instance);
        assert.deepStrictEqual(next.notices.map((n) => n.phase), ['submitted', 'approved', 'started', 'completed']);
        assert.strictEqual(feed.read(next.cursor, next.instance).notices.length, 0);
        assert.strictEqual(feed.read(null, null).notices.length, 0);
        assert.strictEqual(feed.read(0, 'old-server').reset, true);
        for (let i = 0; i < 400; i++) { feed.record(job(), 'started'); }
        assert.strictEqual(feed.read(0, feed.instance).notices.length, 300);
        assert.strictEqual(feed.read(0, feed.instance).missed, true);
    }],
    ['list summaries never expose approval credentials, local paths, runners or large results', () => {
        const summary = JSON.stringify(summarizeDashboardJob({ ...job(), result: { secret: 'large result' } }));
        for (const privateValue of ['secret', 'filePath', 'runner', 'confirmToken', 'large result']) {
            assert(!summary.includes(privateValue));
        }
    }],
    ['status is uncached and detail logs are bounded', async () => {
        const current = job();
        current.events = Array.from({ length: 150 }, (_, seq) => ({ seq, at: 1, phase: 'progress' }));
        const manager = { get: () => current,
            describe: summarizeDashboardJob,
            dashboardJobs: () => [summarizeDashboardJob(current)],
            getActive: () => current,
            dashboardFeed: new JobDashboardFeed() };
        const status = await request(manager, '/jobs/status.json?since=bad');
        assert.strictEqual(status.status, 200);
        assert.strictEqual(status.headers['Cache-Control'], 'no-store');
        assert.strictEqual(JSON.parse(status.body).activeId, current.id);
        assert.strictEqual(JSON.parse((await request(manager, '/jobs/abcdef.json')).body).events.length, 100);
    }],
    ['stop refuses forms, stale active IDs, ended jobs and unsafe methods', async () => {
        const old = job('abcdef', 'started');
        const active = job('123abc', 'started');
        const manager = { get: () => old, getActive: () => active };
        let calls = 0;
        const stop = async () => { calls++; return { ok: true }; };
        assert.strictEqual((await request(manager, '/jobs/abcdef/stop', 'POST', {}, stop)).status, 403);
        assert.strictEqual((await request(manager, '/jobs/abcdef/stop', 'POST', { 'x-luban-job-action': '1' }, stop)).status, 409);
        manager.getActive = () => old;
        assert.strictEqual((await request(manager, '/jobs/abcdef/stop', 'POST', { 'x-luban-job-action': '1', 'sec-fetch-site': 'cross-site' }, stop)).status, 403);
        old.state = 'completed';
        assert.strictEqual((await request(manager, '/jobs/abcdef/stop', 'POST', { 'x-luban-job-action': '1' }, stop)).status, 409);
        assert.strictEqual((await request(manager, '/jobs/abcdef/stop', 'GET', {}, stop)).status, 404);
        assert.strictEqual(calls, 0);
    }],
    ['operator actions target the selected job and concurrent stops are refused', async () => {
        const active = job('abcdef', 'started');
        const manager = { get: () => active, getActive: () => active };
        let finish: ((value: object) => void) | undefined;
        const ids: string[] = [];
        const pending = request(manager, '/jobs/abcdef/stop', 'POST', { 'x-luban-job-action': '1' }, async (id) => {
            ids.push(id);
            return new Promise((resolve) => { finish = resolve; });
        });
        assert.strictEqual((await request(manager, '/jobs/abcdef/stop', 'POST', { 'x-luban-job-action': '1' })).status, 409);
        assert(finish);
        finish({ ok: true, stopping: true });
        assert.strictEqual((await pending).status, 200);
        assert.deepStrictEqual(ids, ['abcdef']);
        await Promise.resolve();
        active.state = 'approved';
        assert.strictEqual((await request(manager, '/jobs/abcdef/dismiss', 'POST', { 'x-luban-job-action': '1' })).status, 200);
    }],
    ['unknown jobs and stop errors produce visible failures', async () => {
        assert.strictEqual((await request({ get: () => null }, '/jobs/abcdef.json')).status, 404);
        const current = job('abcdef', 'started');
        const failed = await request({ get: () => current, getActive: () => current }, '/jobs/abcdef/stop', 'POST',
            { 'x-luban-job-action': '1' }, async () => { throw new Error('Disconnected'); });
        assert.strictEqual(failed.status, 500);
        assert.strictEqual(JSON.parse(failed.body).error, 'Disconnected');
    }],
    ['shared stop path attributes operator stops, withdraws staged jobs, and requests procedure stops without waiting', async () => {
        const { JobManager: Manager } = managerFixture();
        const manager: JobManager = new Manager();
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 0 } as unknown as McpJob['validation'];
        let firmwareStops = 0;
        let reason = '';
        const dependencies: Record<string, unknown> = {};
        const source = fs.readFileSync(path.join(__dirname, '../tools/gcode.ts'), 'utf8');
        for (const match of source.matchAll(/from '([^']+)'/g)) { dependencies[match[1]] = {}; }
        Object.assign(dependencies, {
            '../../../lib/logger': () => ({}),
            '../../machine/ConnectionManager': { connectionManager: { getCurrentChannel: () => ({
                uploadGcodeFile: () => undefined,
                startGcodeJob: () => undefined,
                stopGcodeJob: async () => { firmwareStops++; return { ok: true }; },
            }) } },
            '../jobs': { jobManager: manager, TERMINAL_JOB_STATES: jobEnding.TERMINAL_JOB_STATES },
            '../jobEnding': jobEnding,
            '../registry': { McpToolError: Error },
            '../procedureLimits': { MAX_WAIT_MS: 120000, STOP_WAIT_DEFAULT_MS: 20000 },
            '../probing': { requestProcedureStop: (value: string) => { reason = value; return { requestedAt: Date.now() }; } },
        });
        const { stopGcodeJob } = isolatedModule('tools/gcode.ts', dependencies);
        const staged = manager.submit('', 'staged', 'cnc', validation);
        await stopGcodeJob({ job_id: staged.id }, 'operator');
        assert.strictEqual(staged.state, 'stopped');
        assert.strictEqual(staged.ending?.kind, 'withdrawn');
        assert(staged.ending?.reason.includes('operator'));
        assert.strictEqual(firmwareStops, 0);
        const running = manager.submit('', 'running', 'cnc', validation);
        running.state = 'started';
        manager.setActive(running);
        await stopGcodeJob({ job_id: running.id }, 'operator');
        assert.strictEqual(firmwareStops, 1);
        assert.strictEqual(running.ending?.kind, 'stopped-by-operator');
        assert.strictEqual(manager.getActive(), null);
        const procedure = manager.submit('', 'procedure', 'cnc', validation, 'procedure');
        procedure.state = 'started';
        manager.setActive(procedure);
        const result = await stopGcodeJob({ job_id: procedure.id, wait_ms: 0 }, 'operator');
        assert.strictEqual(result.stopping, true);
        assert.strictEqual(reason, 'stop_gcode_job by the operator');
        assert.strictEqual(firmwareStops, 1);
    }],
    ['browser scripts parse and pages can be served without server dependencies', async () => {
        const script = dashboardHtml.match(/<script>([\s\S]*?)<\/script>/);
        assert(script);
        assert.doesNotThrow(() => new vm.Script(script[1]));
        assert.doesNotThrow(() => new vm.Script(notificationWorker));
        assert.strictEqual((await request({}, '/jobs')).status, 200);
        assert.strictEqual((await request({}, '/')).status, 200);
        assert.strictEqual((await request({}, '/jobs/notifications.js')).status, 200);
        const manifest = await request({}, '/jobs/manifest.webmanifest');
        assert.strictEqual(manifest.headers['Content-Type'], 'application/manifest+json; charset=utf-8');
        assert.strictEqual(JSON.parse(manifest.body).display, 'standalone');
    }],
    ['notification clicks focus an existing dashboard session or open a fresh dashboard', async () => {
        const listeners: Record<string, (event: object) => void> = {};
        let focused = 0;
        const opened: string[] = [];
        let clients = [{ url: 'https://127.0.0.1/jobs', focus: async () => { focused++; } }];
        vm.runInNewContext(notificationWorker, { URL,
            self: {
                addEventListener: (name: string, fn: (event: object) => void) => { listeners[name] = fn; },
                clients: { matchAll: async () => clients, openWindow: async (url: string) => { opened.push(url); } },
            } });
        let pending: Promise<void> = Promise.resolve();
        const click = { notification: { close: () => undefined }, waitUntil: (work: Promise<void>) => { pending = work; } };
        listeners.notificationclick(click);
        await pending;
        assert.strictEqual(focused, 1);
        assert.strictEqual(opened.length, 0);
        clients = [];
        listeners.notificationclick(click);
        await pending;
        assert.deepStrictEqual(opened, ['/jobs/']);
    }],
    ['retention protects every pending job and stale reject cannot change a running or ended job', () => {
        const { JobManager: Manager } = managerFixture();
        const manager: JobManager = new Manager();
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 0 } as unknown as McpJob['validation'];
        const first = manager.submit('', 'first', 'cnc', validation);
        for (let i = 0; i < 55; i++) { manager.submit('', `job-${i}`, 'cnc', validation); }
        assert(manager.get(first.id));
        for (const state of ['approved', 'started', 'completed', 'stopped', 'rejected'] as McpJob['state'][]) {
            first.state = state;
            let status = 0;
            manager.handleConfirmRequest({ method: 'POST' } as http.IncomingMessage,
                { writeHead: (code: number) => { status = code; }, end: () => undefined } as unknown as http.ServerResponse,
                `/confirm/${first.id}/reject`);
            assert.strictEqual(status, 409);
            assert.strictEqual(first.state, state);
        }
        manager.submit('', 'new', 'cnc', validation);
        assert.strictEqual(manager.get(first.id), null);
    }],
];
