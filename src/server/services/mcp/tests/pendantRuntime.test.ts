import assert from 'assert';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import * as envelopeChecks from '../envelopeChecks';
import { ManualControlGate } from '../manualControl';
import * as pendant from '../pendant';
import { pendantPosition } from '../pendantPosition';
import { pendantPage } from '../pendantPage';
import { requiredToolheadZ } from '../landmarkClearance';

function fixture(a350 = false) {
    let now = 1000;
    let epoch = 1;
    let tick: (() => void) | null = null;
    let finish: (() => void) | null = null;
    let moves = 0;
    let immediate: (() => void) | null = null;
    let readyError = false;
    let estimated = false;
    let machineStatus = 'idle';
    let warnings: string[] = [];
    const gate = new ManualControlGate();
    const obstacles: object[] = [];
    const machine = a350 ? { x: 124, y: 203.3289948730469, z: 327.9990070800781 } : { x: 10, y: 10, z: 10 };
    const logs: string[] = [];
    const settingsChanges: object[] = [];
    const homes: unknown[][] = [];
    let restores = 0;
    const snapshot = () => ({ machine, work: machine, originOffset: { x: 0, y: 0, z: 0 }, originOffsetSource: 'heartbeat', machineStatus, reliability: 'heartbeat', warnings, reportAgeMs: 0 });
    class Port extends EventEmitter {
        public static current: Port;

        public static async list() { return [{ path: 'COM42', vendorId: '239a', productId: '8124' }]; }

        public isOpen = false;

        public writableLength = 0;

        public path = 'COM42';

        public writes: object[] = [];

        public constructor() { super(); Port.current = this; }

        public open(done: (err?: Error) => void) { this.isOpen = true; done(); }

        public close() { this.isOpen = false; this.emit('close'); }

        public write(data: string, done: (err?: Error) => void) { this.writes.push(JSON.parse(data)); done(); }
    }
    const dependencies: Record<string, unknown> = {
        crypto,
        http: {},
        '../../lib/logger': () => ({ info: (message: string) => logs.push(message), warn: (message: string) => logs.push(message) }),
        serialport: { SerialPort: Port },
        '../machine/ConnectionManager': { connectionManager: { getConnectionStatus: () => ({ machineIdentifier: 'mock', connected: true }) } },
        './clearanceContext': { clearanceOptions: () => ({ toolProtrusionMm: null, clearanceMarginMm: 5 }) },
        './envelopeChecks': envelopeChecks,
        './jobs': { jobManager: { getActive: () => null } },
        './landmarks': { landmarkStore: { obstacleBoxes: () => obstacles } },
        './landmarkClearance': { requiredToolheadZ },
        './manualControl': { manualControlGate: gate },
        './McpServer': { isLoopback: (address: string) => address === '127.0.0.1' },
        './pendant': pendant,
        './pendantPosition': { pendantPosition },
        './pendantPage': { pendantPage },
        './pendantSettings': { pendantSettings: () => ({}), updatePendantSettings: (args: object) => settingsChanges.push(args) },
        './positionOfRecord': { currentGcodeSequence: () => 0, getTrustedOffset: () => null, getPositionOfRecord: () => (estimated ? { source: 'estimated' } : null) },
        './probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
        './probing': { assertMachineReadyForProcedure: () => { if (readyError) { throw Error('not idle'); } },
            moveMachineSettled: async () => { moves += 1; await new Promise<void>((resolve) => { finish = resolve; }); } },
        './tools/camera': { sendWorkFrameRestore: async () => { restores += 1; return { result: 0 }; }, homeMachine: async (...args: unknown[]) => { homes.push(args); await new Promise<void>((resolve) => { finish = resolve; }); } },
        './tools/machine': { HEARTBEAT_STALE_MS: 10000,
            connectionEpoch: () => epoch,
            getMachineSizeByIdentifier: () => ({ x: 350, y: 350, z: a350 ? 325 : 100 }),
            getPositionSnapshot: snapshot,
            safeTraverseZ: () => (a350 ? 328 : 100),
            requirePlanningTravel: () => ({ limits: { xMin: a350 ? -19 : 0, xMax: a350 ? 330 : 100, yMin: 0, yMax: a350 ? 342 : 100 }, conflicts: [] }) }
    };
    const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    const source = fs.readFileSync(path.resolve(__dirname, '../pendantRuntime.ts'), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true } }).outputText;
    class Clock extends Date { public static now() { return now; } }
    vm.runInNewContext(output, { exports,
        require: (name: string) => {
            if (!(name in dependencies)) { throw Error(`Unexpected dependency ${name}`); }
            return dependencies[name];
        },
        Date: Clock,
        Buffer,
        URL,
        setInterval: (fn: () => void) => { tick = fn; return 1; },
        setImmediate: (fn: () => void) => { immediate = fn; return 1; },
        clearImmediate: () => { immediate = null; },
        setTimeout: () => 0,
        clearTimeout: () => undefined,
        clearInterval: () => undefined });
    const runtime = exports.pendantRuntime;
    let token = '';
    const request = async (pathname: string, args?: object, host = '127.0.0.1:40889', origin?: string) => {
        let status = 0;
        let body = '';
        const req = { method: args ? 'POST' : 'GET',
            socket: { remoteAddress: '127.0.0.1' },
            headers: { host, origin, 'x-pendant-token': token },
            async* [Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(args || {})); } };
        const res = { writeHead: (code: number) => { status = code; }, end: (data: string) => { body = data; } };
        await runtime.handleRequest(req, res, new URL(pathname, 'http://localhost'));
        return { status, body };
    };
    const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
    let seq = 0;
    const input = (extra: object = {}) => Port.current.emit('data', Buffer.from(`${JSON.stringify({ v: 1,
        seq: seq++,
        x: 0,
        y: 0,
        z: 0,
        mode: 'feed',
        feed: 300,
        ready: true,
        deadman: false,
        stop: false,
        ...extra })}\n`));
    const arm = async () => request('/pendant/arm', { clearanceConfirmed: true,
        bounds: { xMin: 5, xMax: 15, yMin: 5, yMax: 15, zMin: 5, zMax: 15 } });
    return {
        runtime,
        request,
        input,
        arm,
        gate,
        obstacles,
        machine,
        logs,
        settingsChanges,
        homes,
        restores: () => restores,
        setWarnings: (value: string[]) => { warnings = value; },
        setMachineStatus: (status: string) => { machineStatus = status; },
        writes: () => Port.current.writes,
        initialize: async () => {
            const page = await request('/pendant');
            const match = page.body.match(/const token="([a-f0-9]+)"/);
            assert.ok(match);
            if (!match) { throw new Error('Missing page token'); }
            token = match[1];
            assert.equal((await request('/pendant/connect', { path: 'COM42' })).status, 200);
            input();
        },
        tick: async () => { if (tick) { tick(); } await settle(); },
        moves: () => moves,
        immediate: async () => { const fn = immediate; immediate = null; if (fn) { fn(); } await settle(); },
        rawInput: (data: string) => Port.current.emit('data', Buffer.from(data)),
        finish: async () => { if (finish) { finish(); } await settle(); },
        advance: (ms: number) => { now += ms; },
        reconnect: () => { epoch += 1; },
        failReady: () => { readyError = true; },
        estimate: () => { estimated = true; }
    };
}

export const tests: Array<[string, () => Promise<void>]> = [
    ['USB feedback stays compact while full position warnings remain on the page', async () => {
        const f = fixture(); await f.initialize();
        f.setWarnings(['frame detail '.repeat(300)]); await f.tick();
        const packet = f.writes().slice(-1)[0] as { input_seq: number; warnings: string[] }; // eslint-disable-line camelcase -- USB protocol key
        assert.ok(packet.input_seq >= 0);
        assert.ok(JSON.stringify(packet).length < 1024);
        assert.equal(packet.warnings[0].length, 160);
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.ok(status.dro.heartbeatWarnings[0].length > 1000);
    }],
    ['feedback loss disarms, and completion samples latest USB intent without a timer delay', async () => {
        const f = fixture(); await f.initialize(); await f.arm(); f.input();
        f.input({ x: 1, deadman: true }); await f.tick(); assert.equal(f.moves(), 1);
        await f.finish();
        f.input({ x: -1, deadman: true }); await f.immediate(); assert.equal(f.moves(), 2);
        await f.finish();
        f.input({ feedback_ok: false }); await f.immediate(); assert.equal(f.moves(), 2);
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, false); assert.match(status.error, /feedback exceeded one second/);
        assert.equal((await f.arm()).status, 400);
        f.input({ feedback_ok: true, round_trip_ms: 50 }); assert.equal((await f.arm()).status, 200);
    }],
    ['frame recovery uses the shared no-motion command and leaves jogging disarmed', async () => {
        const f = fixture(); await f.initialize(); await f.arm();
        f.setMachineStatus('running');
        assert.equal((await f.request('/pendant/restore-frame', {})).status, 400);
        assert.equal(f.restores(), 0);
        f.setMachineStatus('idle');
        assert.equal((await f.request('/pendant/restore-frame', {})).status, 200);
        assert.equal(f.restores(), 1); assert.equal(f.moves(), 0);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).armed, false);
    }],
    ['operator Home disarms and uses the shared stale-only homing override under exclusive ownership', async () => {
        const f = fixture(); await f.initialize(); await f.arm();
        assert.equal((await f.request('/pendant/home', {})).status, 400);
        assert.equal(f.homes.length, 0);
        const homing = f.request('/pendant/home', { confirmHoming: true });
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.deepEqual(f.homes, [['usb_pendant:home', true, true]]);
        assert.throws(() => f.gate.enterTool('home'), /pendant/);
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, false); assert.equal(status.busy, true);
        f.input({ x: 1, deadman: true }); await f.tick(); assert.equal(f.moves(), 0);
        await f.finish(); assert.equal((await homing).status, 200);
        f.gate.enterTool('home')();
    }],

    ['A350 defaults include park; whole-bed request is clipped to known travel', async () => {
        const f = fixture(true); await f.initialize();
        const before = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(before.defaultBounds.zMin, 280);
        assert.equal(before.defaultBounds.zMax, 329);
        assert.equal(before.travelBounds.zMax, 328);
        const requested = { xMin: -20, xMax: 331, yMin: -1, yMax: 343, zMin: 280, zMax: 329 };
        assert.equal((await f.request('/pendant/arm', { bounds: requested, clearanceConfirmed: true })).status, 200);
        const after = JSON.parse((await f.request('/pendant/status')).body);
        assert.deepEqual(after.bounds, { xMin: -19, xMax: 330, yMin: 0, yMax: 342, zMin: 280, zMax: 328 });
        assert.equal(f.moves(), 0);
        await f.request('/pendant/disarm', {});
        f.obstacles.push({ name: 'rotary', machine: { x0: 160, x1: 180, y0: 280, y1: 330 }, clearanceZ: 328 });
        const accepted = await f.request('/pendant/arm', { bounds: requested, clearanceConfirmed: true });
        assert.equal(accepted.status, 200);
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, true);
        assert.equal(status.obstacleExclusions[0].name, 'rotary');
        assert.equal(status.obstacleExclusions[0].requiredZ, 328);
        assert.equal(status.obstacleExclusions[0].machine.x0, 155);
        assert.equal(f.moves(), 0);
    }],
    ['broad envelope permits clear low jogs but stops before entering an obstacle', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'fixture', machine: { x0: 20, x1: 21, y0: 5, y1: 15 }, clearanceZ: 20 });
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 0, xMax: 50, yMin: 0, yMax: 50, zMin: 0, zMax: 50 } })).status, 200);
        f.input(); f.input({ x: 1, deadman: true });
        await f.tick(); assert.equal(f.moves(), 1); await f.finish();
        f.machine.x = 14.95;
        f.input({ x: 1, deadman: true }); await f.tick();
        const stopped = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(stopped.armed, false);
        assert.match(stopped.error, /fixture.*machine Z at or above 20.000/);
        assert.equal(f.moves(), 1);
        await f.tick();
        assert.match(JSON.stringify(f.writes().slice(-1)), /fixture/);
    }],
    ['clearance check covers complete diagonals, Z-only descent, unknown tools and changed landmarks', async () => {
        for (const kind of ['diagonal', 'descent', 'unknown', 'changed']) {
            const f = fixture(); await f.initialize();
            assert.equal((await f.arm()).status, 200);
            f.input();
            if (kind === 'diagonal') {
                // Both endpoints miss this tiny padded corner, but the segment crosses it.
                f.obstacles.push({ name: kind, machine: { x0: 15.04, x1: 15.04, y0: 4.94, y1: 4.94 }, clearanceZ: 20 });
                f.input({ x: 1, y: -1, deadman: true, feed: 3000 });
            } else if (kind === 'descent') {
                f.machine.z = 10;
                f.obstacles.push({ name: kind, machine: { x0: 10, x1: 11, y0: 10, y1: 11 }, clearanceZ: 10 });
                f.input({ z: -1, mode: 'z', deadman: true });
            } else {
                f.obstacles.push({ name: kind,
                    machine: { x0: 10, x1: 11, y0: 10, y1: 11 },
                    clearanceZ: kind === 'unknown' ? 1 : 20,
                    clearanceBasis: kind === 'unknown' ? 'physical' : 'toolhead' });
                f.input({ x: 1, deadman: true });
            }
            await f.tick();
            const status = JSON.parse((await f.request('/pendant/status')).body);
            assert.equal(status.armed, false, kind);
            assert.match(status.error, new RegExp(kind));
            assert.equal(f.moves(), 0, kind);
        }
    }],
    ['jogs over a landmark at its required Z accept normal heartbeat noise', async () => {
        const f = fixture(true); await f.initialize();
        f.obstacles.push({ name: 'rotary', machine: { x0: 120, x1: 180, y0: 190, y1: 330 }, clearanceZ: 328 });
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 0, xMax: 200, yMin: 0, yMax: 342, zMin: 280, zMax: 329 } })).status, 200);
        f.input(); f.input({ x: 1, deadman: true });
        await f.tick(); assert.equal(f.moves(), 1); await f.finish();
    }],
    ['operator settings disarm, exclude in-flight motion and pending MCP mutations, and require re-arm', async () => {
        const f = fixture(); await f.initialize(); await f.arm();
        f.input(); f.input({ x: 1, deadman: true }); await f.tick();
        const update = { kind: 'tool', protrusionMm: 10 };
        assert.equal((await f.request('/pendant/settings', update)).status, 400);
        assert.equal(f.settingsChanges.length, 0);
        await f.finish();
        f.setMachineStatus('running');
        assert.equal((await f.request('/pendant/settings', update)).status, 400);
        assert.equal(f.settingsChanges.length, 0);
        f.setMachineStatus('idle');
        const leave = f.gate.enterTool('set_landmark');
        assert.equal((await f.request('/pendant/settings', update)).status, 400);
        assert.equal(f.settingsChanges.length, 0); leave();
        assert.equal((await f.request('/pendant/settings', update)).status, 200);
        assert.equal(f.settingsChanges.length, 1);
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, false);
        f.input({ x: 1, deadman: true }); await f.tick(); assert.equal(f.moves(), 1);
        assert.equal((await f.arm()).status, 200);
    }],
    ['page stop reaches USB and preserves diagnostics without further movement', async () => {
        const f = fixture(); await f.initialize(); await f.arm(); f.input();
        await f.tick();
        assert.equal((f.writes().slice(-1)[0] as { armed: boolean }).armed, true);
        await f.request('/pendant/disarm', {});
        f.input({ x: 1, deadman: true });
        await f.tick();
        const reply = f.writes().slice(-1)[0] as { armed: boolean; message: string };
        assert.equal(reply.armed, false);
        assert.match(reply.message, /Disarmed by operator/);
        assert.equal(f.moves(), 0);
        assert.ok(JSON.parse((await f.request('/pendant/status')).body).input);
    }],
    ['firmware sequence restart recovers telemetry but requires explicit fresh arm', async () => {
        const f = fixture(); await f.initialize(); await f.arm();
        f.input({ seq: 800 });
        f.input({ seq: 0, x: 1, deadman: true });
        await f.tick();
        const stopped = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(stopped.armed, false);
        assert.match(stopped.error, /sequence/);
        f.input({ seq: 1 });
        f.input({ seq: 2, x: 1, deadman: true });
        await f.tick();
        assert.equal(f.moves(), 0);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).input.seq, 2);
        assert.equal((await f.arm()).status, 200);
        f.input({ seq: 3, x: 1, deadman: true });
        await f.tick(); assert.equal(f.moves(), 0);
        f.input({ seq: 4 }); f.input({ seq: 5, x: 1, deadman: true });
        await f.tick(); assert.equal(f.moves(), 1); await f.finish();
    }],
    ['operator routes refuse cross-origin, hostile Host and missing page token', async () => {
        const f = fixture();
        assert.equal((await f.request('/pendant/arm', {})).status, 403);
        assert.equal((await f.request('/pendant', undefined, 'evil.example:40889')).status, 403);
        assert.equal((await f.request('/pendant', undefined, '127.0.0.1:40889', 'https://evil.example')).status, 403);
    }],
    ['one move in flight; stop keeps ownership until the accepted segment settles', async () => {
        const f = fixture();
        await f.initialize();
        assert.equal((await f.arm()).status, 200);
        f.input();
        f.input({ x: 1, deadman: true });
        await f.tick(); await f.tick();
        assert.equal(f.moves(), 1);
        f.input({ stop: true });
        await f.tick();
        assert.throws(() => f.gate.enterTool('home'));
        await f.finish();
        f.gate.enterTool('home')();
        await f.tick();
        assert.equal(f.moves(), 1);
    }],
    ['USB timeout and machine reconnect disarm without extra moves', async () => {
        for (const reason of ['USB', 'epoch']) {
            const f = fixture(); await f.initialize(); await f.arm(); f.input();
            if (reason === 'USB') { f.advance(901); } else { f.reconnect(); }
            await f.tick();
            const status = JSON.parse((await f.request('/pendant/status')).body);
            assert.equal(status.armed, false);
            assert.equal(f.moves(), 0);
        }
    }],
    ['browser timeout and malformed USB input disarm a stationary session', async () => {
        for (const reason of ['browser', 'wire']) {
            const f = fixture(); await f.initialize(); await f.arm();
            await f.tick();
            assert.throws(() => f.gate.enterTool('home'), /pendant/);
            if (reason === 'browser') { f.advance(2001); f.input(); } else { f.rawInput('{broken\n'); }
            await f.tick();
            const status = JSON.parse((await f.request('/pendant/status')).body);
            assert.equal(status.armed, false);
            assert.equal(f.moves(), 0);
            f.gate.enterTool('home')();
        }
    }],
    ['pending MCP mutation and missing clearance consent cannot arm', async () => {
        const f = fixture(); await f.initialize();
        const leave = f.gate.enterTool('start_gcode_job');
        assert.equal((await f.arm()).status, 400);
        leave();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: false })).status, 400);
        assert.equal((await f.arm()).status, 200);
    }],
    ['arming refuses a current position inside an excluded volume and a non-idle machine', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'corner obstacle',
            machine: { x0: 5, x1: 5.2, y0: 14, y1: 14.2 },
            clearanceZ: 20,
            clearanceBasis: 'toolhead',
            mode: 'crossing' });
        assert.equal((await f.arm()).status, 400);
        f.obstacles.length = 0;
        f.failReady();
        assert.equal((await f.arm()).status, 400);
    }],
    ['estimated motion is explicitly marked on the DRO and cannot authorize a new jog', async () => {
        const f = fixture(); await f.initialize(); f.estimate();
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.dro.reliability, 'estimated');
        assert.equal((await f.arm()).status, 400);
        assert.equal(f.moves(), 0);
    }],
];
