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
import { DASHBOARD_REVIEW_LIMIT, DashboardReview, JobDashboardFeed, dashboardReviews, summarizeDashboardJob } from '../jobDashboardState';
import { OperatorReviewSpec, OperatorReviewStore } from '../operatorReviews';
import { dashboardHtml, notificationWorker } from '../jobDashboardPage';
import { dialectById } from '../gcodeDialect';
import { toolheadStubs } from './fixtures/toolheadStubs';

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

async function request(manager: object, route: string, method = 'GET', headers = {}, stop: (id: string) => Promise<object> = async () => ({ ok: true }),
    reviews?: () => DashboardReview[]) {
    return new Promise<{ status: number; body: string; headers: Record<string, string> }>((resolve) => {
        let status: number;
        let responseHeaders: Record<string, string>;
        const res = {
            writeHead(code: number, values: Record<string, string>) { status = code; responseHeaders = values; },
            end(body: string) { resolve({ status, body, headers: responseHeaders }); },
        } as http.ServerResponse;
        handleJobDashboardRequest({ method, headers } as http.IncomingMessage, res, new URL(route, 'http://localhost'), manager as JobManager, stop, undefined, reviews);
    });
}

// Load server-bound code with explicit inert dependencies; never start Luban or connect to hardware.
export function isolatedModule(file: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true } });
    const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    vm.runInNewContext(compiled.outputText, {
        exports,
        Buffer,
        setTimeout,
        setInterval,
        clearInterval,
        ...globals,
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
        '../../DataStorage': { tmpDir: '/fake', userDataDir: '/fake' },
        '../../lib/logger': () => ({ info: () => undefined }),
        '../configstore': { get: () => undefined },
        // Pure (crypto/path only): the real module, so the identity on every staged job is the real one.
        './gcodeIntake': require('../gcodeIntake'),
        './jobEnding': jobEnding,
        './jobDashboardState': require('../jobDashboardState'),
        './telemetryConfig': require('../telemetryConfig'),
        './jobMachineBinding': require('../jobMachineBinding'),
        './activeTool': { describeActiveTool: () => ({ active: null }) },
    });
    return loaded;
}

function reviewSpec(overrides: Partial<OperatorReviewSpec> = {}): OperatorReviewSpec {
    return {
        kind: 'landmark-review',
        title: 'review',
        machineKey: 'a350',
        subject: 'review',
        bodyHtml: '<p>page body only</p>',
        summary: { args: 'raw policy args' },
        precondition: () => null,
        apply: () => ({ result: 'apply result' }),
        ...overrides,
    };
}

function feedManager() {
    return { dashboardJobs: () => [], getActive: () => null, dashboardFeed: new JobDashboardFeed() };
}

function escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Just enough DOM to run the dashboard script: text only ever goes in through
// textContent / text nodes, and innerHTML throws, so markup in feed data can
// only ever end up as text. html() serializes the way a browser would.
class FakeNode {
    public children: FakeNode[] = [];

    public parent: FakeNode | null = null;

    public className = '';

    public id = '';

    public href = '';

    public target = '';

    public rel = '';

    public value = 'all';

    public hidden = false;

    public disabled = false;

    public attributes: Record<string, string> = {};

    private text = '';

    public readonly tagName: string;

    public constructor(tagName: string) {
        this.tagName = tagName;
    }

    public get textContent(): string {
        return this.tagName === '#text' ? this.text : this.children.map((child) => child.textContent).join('');
    }

    public set textContent(value: string) {
        this.children = [];
        if (this.tagName === '#text') {
            this.text = String(value);
        } else if (String(value) !== '') {
            const child = new FakeNode('#text');
            child.textContent = String(value);
            this.append(child);
        }
    }

    public get innerHTML(): string {
        throw new Error(`innerHTML read on <${this.tagName}>`);
    }

    public set innerHTML(_value: string) {
        throw new Error(`innerHTML written on <${this.tagName}>`);
    }

    public get firstChild(): FakeNode | null {
        return this.children[0] || null;
    }

    public append(...nodes: FakeNode[]): void {
        for (const node of nodes) {
            node.remove();
            node.parent = this;
            this.children.push(node);
        }
    }

    public insertBefore(node: FakeNode, before: FakeNode | null): void {
        node.remove();
        node.parent = this;
        const index = before ? this.children.indexOf(before) : -1;
        if (index < 0) { this.children.push(node); } else { this.children.splice(index, 0, node); }
    }

    public remove(): void {
        if (this.parent) {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
            this.parent = null;
        }
    }

    public setAttribute(name: string, value: string): void {
        this.attributes[name] = String(value);
    }

    public addEventListener = (): void => undefined;

    public all(): FakeNode[] {
        return [this, ...this.children.flatMap((child) => child.all())];
    }

    public html(): string {
        if (this.tagName === '#text') {
            return escapeText(this.text);
        }
        const attributes = `${this.className ? ` class="${escapeText(this.className)}"` : ''}${this.href ? ` href="${escapeText(this.href)}"` : ''}`;
        return `<${this.tagName}${attributes}>${this.children.map((child) => child.html()).join('')}</${this.tagName}>`;
    }
}

/** Runs the real dashboard script against one status.json snapshot; nothing polls again (setInterval is inert). */
async function renderDashboard(snapshot: object) {
    const byId = new Map<string, FakeNode>();
    const created: FakeNode[] = [];
    const document = {
        hidden: false,
        getElementById: (id: string) => {
            if (!byId.has(id)) {
                const root = new FakeNode('div');
                root.id = id;
                byId.set(id, root);
            }
            return byId.get(id);
        },
        createElement: (tag: string) => { const node = new FakeNode(tag); created.push(node); return node; },
        createTextNode: (text: string) => { const node = new FakeNode('#text'); node.textContent = text; return node; },
        querySelectorAll: (selector: string) => [...byId.values()].flatMap((root) => root.all())
            .filter((node) => node.className.split(' ').includes(selector.replace(/^\./, ''))),
        addEventListener: () => undefined,
    };
    const script = dashboardHtml.match(/<script>([\s\S]*?)<\/script>/);
    assert(script);
    vm.runInNewContext(script[1], {
        document,
        URL,
        AbortController,
        window: { location: { href: 'http://127.0.0.1:40889/jobs' }, isSecureContext: false },
        navigator: {},
        sessionStorage: { getItem: () => null, setItem: () => undefined },
        setTimeout: () => 0,
        clearTimeout: () => undefined,
        setInterval: () => 0,
        fetch: async () => ({ ok: true, json: async () => snapshot }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    return { byId, created };
}

function dashboardSnapshot(reviews?: unknown[]) {
    return { jobs: [], activeId: null, trust: null, instance: 'test', cursor: 0, reset: true, missed: false, notices: [], ...(reviews ? { reviews } : {}) };
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
            '../connectedMachine': toolheadStubs(() => state, dialectById('sm2-marlin')),
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
            // WP4a: pure modules, the real ones.
            '../logicalFrame': require('../logicalFrame'),
            '../gcodeForms': require('../gcodeForms'),
            '../gcodeDialect': require('../gcodeDialect'),
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
    ['an unverified start remains stoppable from the operator dashboard', async () => {
        const active = job('abcdef', 'start_unverified');
        const manager = { get: () => active, getActive: () => active };
        let calls = 0;
        const stop = async () => { calls++; return { ok: true }; };
        const response = await request(manager, '/jobs/abcdef/stop', 'POST', { 'x-luban-job-action': '1' }, stop);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(calls, 1);
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
    ['status feed lists operator reviews pending first with links, decided ones marked, no page internals', async () => {
        let clock = 10;
        const store = new OperatorReviewStore(() => clock);
        const approved = store.stage(reviewSpec({ kind: 'landmark-delete', subject: 'x', title: "delete 'corner'" }));
        clock = 11;
        store.decide(approved.id, 'approve', 'a350');
        clock = 12;
        const rejected = store.stage(reviewSpec({ kind: 'landmark-change', subject: 'y' }));
        clock = 13;
        store.decide(rejected.id, 'reject', 'a350');
        clock = 14;
        const refused = store.stage(reviewSpec({ subject: 'z', precondition: () => 'the landmark changed since this page was staged' }));
        clock = 15;
        store.decide(refused.id, 'approve', 'a350');
        clock = 16;
        const superseded = store.stage(reviewSpec({ subject: 'w' }));
        clock = 17;
        const replacement = store.stage(reviewSpec({ subject: 'w', title: '2 landmark(s) on a350' }));
        clock = 18;
        const device = store.stage(reviewSpec({ kind: 'device-assign', subject: 'dev', machineKey: 'ray', title: 'COM7 is a different machine' }));
        assert.strictEqual(superseded.state, 'superseded');
        assert.strictEqual(refused.state, 'refused');

        const feed = dashboardReviews(store.list());
        assert.deepStrictEqual(feed.map((review) => review.id), [device.id, replacement.id, superseded.id, refused.id, rejected.id, approved.id]);
        assert.deepStrictEqual(feed.map((review) => review.state), ['pending', 'pending', 'stale', 'stale', 'rejected', 'approved']);
        assert.deepStrictEqual(feed.map((review) => review.detail),
            ['awaiting_confirmation', 'awaiting_confirmation', 'superseded', 'refused', 'rejected', 'approved']);
        assert.deepStrictEqual(feed[0], {
            id: device.id,
            kind: 'device-assign',
            kindLabel: 'Device assignment',
            machine: 'ray',
            title: 'COM7 is a different machine',
            createdAt: 18,
            decidedAt: null,
            state: 'pending',
            detail: 'awaiting_confirmation',
            error: null,
            link: `/confirm/${device.id}`,
        });
        assert(feed.every((review) => /^\/confirm\/r[0-9a-f]+$/.test(review.link)));
        assert.strictEqual(feed[5].decidedAt, 11);
        assert.strictEqual(feed[5].kindLabel, 'Landmark deletion');
        assert(feed[3].error && feed[3].error.includes('the landmark changed'));
        const json = JSON.stringify(feed);
        for (const internal of ['page body only', 'raw policy args', 'apply result', 'bodyHtml', 'summary', 'precondition']) {
            assert(!json.includes(internal), `feed leaks ${internal}`);
        }

        const status = await request(feedManager(), '/jobs/status.json', 'GET', {}, undefined, () => dashboardReviews(store.list()));
        assert.strictEqual(status.status, 200);
        assert.strictEqual(status.headers['Cache-Control'], 'no-store');
        assert.deepStrictEqual(JSON.parse(status.body).reviews, feed);
        // The dashboard only links: no review route or action is served under /jobs.
        assert.strictEqual((await request(feedManager(), `/jobs/${device.id}/approve`, 'POST', { 'x-luban-job-action': '1' })).status, 405);
        assert.strictEqual(device.state, 'awaiting_confirmation');
    }],
    ['review feed keeps every pending review and bounds decided history like the job list', () => {
        let clock = 0;
        const store = new OperatorReviewStore(() => clock);
        for (let i = 0; i < 60; i++) {
            clock += 1;
            const item = store.stage(reviewSpec({ subject: `decided-${i}` }));
            store.decide(item.id, 'reject', 'a350');
        }
        const pending = [1, 2, 3].map((i) => { clock += 1; return store.stage(reviewSpec({ subject: `pending-${i}` })); });
        assert.strictEqual(DASHBOARD_REVIEW_LIMIT, 50);
        const feed = dashboardReviews(store.list());
        assert.strictEqual(feed.length, DASHBOARD_REVIEW_LIMIT);
        assert.deepStrictEqual(feed.slice(0, 3).map((review) => review.id), pending.map((item) => item.id).reverse());
        assert(feed.slice(3).every((review) => review.state === 'rejected'));
        const decidedAt = feed.slice(3).map((review) => review.decidedAt as number);
        assert.deepStrictEqual(decidedAt, [...decidedAt].sort((a, b) => b - a));
        assert.strictEqual(decidedAt[0], 60);
        // Pending reviews are never dropped, even past the bound.
        assert.deepStrictEqual(dashboardReviews(store.list(), 2).map((review) => review.state), ['pending', 'pending', 'pending']);
    }],
    ['review feed empty state: no store items and the default injector both give an empty list', async () => {
        assert.deepStrictEqual(dashboardReviews(new OperatorReviewStore().list()), []);
        const status = await request(feedManager(), '/jobs/status.json');
        assert.strictEqual(status.status, 200);
        assert.deepStrictEqual(JSON.parse(status.body).reviews, []);
    }],
    ['dashboard renders reviews as escaped text with links to the review page and no decision controls', async () => {
        const store = new OperatorReviewStore();
        const hostile = store.stage(reviewSpec({ title: '<img src=x onerror=alert(1)> & "quoted"', machineKey: 'a350<b>' }));
        const decided = store.stage(reviewSpec({ kind: 'landmark-delete', subject: 'gone', title: "delete '<script>'" }));
        store.decide(decided.id, 'approve', 'a350');
        const feed = dashboardReviews(store.list());
        feed.push({ ...feed[0], id: 'not-a-review"><a', state: 'rejected', detail: 'rejected', title: 'forged id' });
        const { byId, created } = await renderDashboard(dashboardSnapshot(feed));

        assert.strictEqual(byId.get('reviews-count')?.textContent, '1');
        const pendingHtml = byId.get('reviews')?.html() || '';
        assert(pendingHtml.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot;'), pendingHtml);
        assert(pendingHtml.includes('a350&lt;b&gt;'));
        assert(!/<img|<script|<b>/.test(pendingHtml));
        assert(!created.some((node) => ['img', 'script', 'b'].includes(node.tagName)), 'markup in feed data never becomes an element');
        const reviewNodes = byId.get('reviews')?.all() || [];
        assert(!reviewNodes.some((node) => node.tagName === 'button' || node.tagName === 'form'), 'no decision controls on the dashboard');
        const link = reviewNodes.find((node) => node.tagName === 'a');
        assert.strictEqual(link?.href, `/confirm/${hostile.id}`);
        assert.strictEqual(link?.target, '_blank');
        assert.strictEqual(link?.textContent, 'Open review page');

        const historyNodes = byId.get('review-history')?.all() || [];
        const historyText = byId.get('review-history')?.textContent || '';
        assert(historyText.includes('Approved'));
        assert(historyText.includes("delete '<script>'"));
        assert(!(byId.get('review-history')?.html() || '').includes('<script>'));
        const historyLinks = historyNodes.filter((node) => node.tagName === 'a');
        assert.deepStrictEqual(historyLinks.map((node) => node.href), [`/confirm/${decided.id}`, '']);
        // The job groups keep their own empty notices alongside the review list.
        assert.strictEqual(byId.get('running')?.textContent, 'No running jobs.');
    }],
    ['dashboard review section empty state, and an older feed without reviews still renders', async () => {
        for (const snapshot of [dashboardSnapshot([]), dashboardSnapshot()]) {
            // eslint-disable-next-line no-await-in-loop
            const { byId } = await renderDashboard(snapshot);
            assert.strictEqual(byId.get('reviews-count')?.textContent, '0');
            assert.strictEqual(byId.get('reviews')?.textContent, 'No reviews waiting for you.');
            assert.strictEqual(byId.get('review-history')?.textContent, 'None yet.');
            assert.strictEqual(byId.get('ready')?.textContent, 'No jobs waiting here.');
        }
        assert(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(dashboardHtml));
        assert(!/\/(approve|reject)\b/.test(dashboardHtml), 'the dashboard never posts a review decision');
    }],
];
