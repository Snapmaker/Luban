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
import { GcodeLease } from '../../machine/gcodeLease';

interface Queued { sentAt: number; replyAt: number; target: { x: number; y: number; z: number }; feed: number; run: number }

function fixture(a350 = false, options: { pipeline?: boolean; runMs?: number } = {}) {
    let now = 1000;
    // Pipelined-run doubles: the controller acknowledges each request after rttMs,
    // and an ideal executor (no acceleration) runs accepted segments back to back
    // from rttMs / 2 after the send. queueHold parks acknowledgements for the test.
    let rttMs = 80;
    let settleExtraMs = 0;
    let queueHold = false;
    let queueFail = false;
    // Controller model limits as M503 S reports them (Snapmaker defaults).
    let m503 = 'echo:  M203 X120.00 Y120.00 Z40.00 E45.00\necho:  M201 X3000 Y3000 Z100 E10000\necho:  M204 P1000.00 R1000.00 T1000.00';
    let enterFail = false;
    let settleFail = false;
    let restoreFail = false;
    let reportAgeMs = 0;
    let latch: { reason: string; restoredAt: number | null } | null = null;
    let runNo = 0;
    // Executor speed relative to commanded feed (1 = ideal; < 1 = slow or stalled controller).
    let speed = 1;
    let onEnter: (() => void) | null = null;
    // In-run heartbeat override: what a G53-window beat reports (declared run).
    let beat: { machine: { x: number; y: number; z: number }; reportedAt: number } | null = null;
    let onQueue: ((count: number) => void) | null = null;
    const declared: string[] = [];
    let declaredNow = false;
    const lease = new GcodeLease();
    const leaseChecks: Array<string | null> = [];
    const held: Array<() => void> = [];
    const queued: Queued[] = [];
    const frames: string[] = [];
    let settledAt: { x: number; y: number; z: number } | null = null;
    let streaming: object | null = null;
    let streamUntil = 0;
    let streamedAt = -Infinity;
    let motion = 0;
    // Assigned below, once the USB stream and the executor exist.
    const hooks = { stream: (): void => undefined,
        drainEnd: (): number => now,
        clearLatch: (): void => { if (latch) { latch = null; lease.endRecovery(); } } };
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
    const startPosition = { ...machine };
    const logs: string[] = [];
    const settingsChanges: object[] = [];
    const homes: unknown[][] = [];
    const targets: Array<{ x: number; y: number; z: number }> = [];
    let restores = 0;
    const snapshot = () => {
        const common = { originOffset: { x: 0, y: 0, z: 0 }, originOffsetSource: 'heartbeat', machineStatus, reliability: 'heartbeat', reportAgeMs, isHomed: true };
        return beat && declaredNow
            ? { ...common, machine: beat.machine, work: beat.machine, frame: 'machine-frame', warnings: [], reportedAt: beat.reportedAt, judged: { declaredRun: true } }
            : { ...common, machine, work: machine, frame: 'work-frame', warnings, reportedAt: now - reportAgeMs, judged: { declaredRun: false } };
    };
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
        '../machine/ConnectionManager': { connectionManager: { getConnectionStatus: () => ({ machineIdentifier: 'mock', connected: true, protocol: 'HTTP' }), getLatestMachineState: () => ({}) } },
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
        '../machine/gcodeLease': { gcodeLease: lease },
        './positionOfRecord': { currentGcodeSequence: () => 0,
            getTrustedOffset: () => null,
            getPositionOfRecord: () => (estimated ? { source: 'estimated' } : null),
            getFrameLatch: () => latch,
            latchFrameUncertain: (reason: string) => { latch = { reason, restoredAt: null }; frames.push('latch'); } },
        './probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined, motionBegin: () => { motion += 1; }, motionEnd: () => { motion -= 1; } } },
        './probing': { assertMachineReadyForProcedure: () => { if (readyError) { throw Error('not idle'); } },
            moveMachineSettled: async (_label: string, position: { x: number; y: number; z: number }) => {
                moves += 1; targets.push({ ...position }); await new Promise<void>((resolve) => { finish = resolve; });
            },
            sleep: async (ms: number) => { now += ms; hooks.stream(); },
            readFirmwareMotionConfig: async () => m503,
            enterMachineFrame: async () => {
                frames.push('enter'); leaseChecks.push(lease.refusal('G53')); runNo += 1;
                now += rttMs; hooks.stream();
                if (onEnter) { onEnter(); }
                if (enterFail) { throw Error('transport_error after the request was sent'); }
                return { result: 0 };
            },
            queueMachineMove: async (_tool: string, target: { x: number; y: number; z: number }, feed: number) => {
                const sentAt = now;
                leaseChecks.push(lease.refusal('G1'));
                if (queueFail) { throw Error('Controller rejected the queued move: transport_error'); }
                if (queueHold) { await new Promise<void>((resolve) => { held.push(resolve); }); } else { now += rttMs; }
                queued.push({ sentAt, replyAt: now, target: { ...target }, feed, run: runNo });
                hooks.stream();
                if (onQueue) { onQueue(queued.length); }
                return { result: 0 };
            },
            verifyRestoredPosition: async () => { frames.push('verify'); hooks.clearLatch(); return true; },
            settleQueuedMachineMoves: async (_tool: string, last: { x: number; y: number; z: number }, _feed: number, onRestored?: () => void) => {
                frames.push('settle');
                if (settleFail) { throw Error('Overtravel tripwire latched.'); }
                settledAt = { ...last };
                Object.assign(machine, last); // Arrived: the next heartbeat shows it.
                now = Math.max(now + 4 * rttMs, hooks.drainEnd() + rttMs / 2) + settleExtraMs;
                hooks.stream();
                if (onRestored) { onRestored(); }
                hooks.clearLatch(); // Acknowledged G54 plus a verified echo.
            } },
        './tools/camera': {
            sendWorkFrameRestore: async () => {
                restores += 1; frames.push('restore');
                if (restoreFail) { return { result: -1, text: 'transport_error' }; }
                if (latch) { latch.restoredAt = now; } // A verified position must still follow.
                return { result: 0 };
            },
            homeMachine: async (...args: unknown[]) => { homes.push(args); await new Promise<void>((resolve) => { finish = resolve; }); },
        },
        './tools/machine': { HEARTBEAT_STALE_MS: 10000,
            declareMachineFrameRun: () => { declared.push('declare'); declaredNow = true; },
            endMachineFrameRun: () => { if (declaredNow) { declared.push('end'); } declaredNow = false; },
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
        process: { env: { ...(options.pipeline ? { LUBAN_PENDANT_PIPELINE: '1' } : {}),
            ...(options.runMs ? { LUBAN_PENDANT_PIPELINE_RUN_MS: String(options.runMs) } : {}) } },
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
    // Keep the Feather's 20 Hz stream alive on the fake clock while a run sleeps.
    hooks.stream = () => {
        while (streaming && now < streamUntil && now - streamedAt >= 50) {
            streamedAt = now;
            input(streaming);
            request('/pendant/keepalive', {}).catch(() => undefined);
        }
    };
    // Ideal executor: start, end and outstanding commanded time per accepted segment.
    const executed = () => {
        let end = 0;
        let previous: { x: number; y: number; z: number } | null = null;
        return queued.map((q) => {
            const from = previous || startPosition;
            const commandedMs = Math.hypot(q.target.x - from.x, q.target.y - from.y, q.target.z - from.z) / q.feed * 60000;
            const durationMs = commandedMs / speed;
            const arrival = q.sentAt + rttMs / 2;
            const outstandingBefore = Math.max(0, end - arrival);
            const start = Math.max(end, arrival);
            const gap = queued.indexOf(q) > 0 ? Math.max(0, arrival - end) : 0;
            end = start + durationMs;
            previous = q.target;
            const runStart = queued.indexOf(q) === 0 || queued[queued.indexOf(q) - 1].run !== q.run;
            return { ...q, commandedMs, durationMs, start, end, gap: runStart ? 0 : gap, runStart, outstandingAtArrival: outstandingBefore + durationMs };
        });
    };
    hooks.drainEnd = () => { const runs = executed(); return runs.length ? runs[runs.length - 1].end : now; };
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
        targets,
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
        estimate: () => { estimated = true; },
        now: () => now,
        flush: async () => { for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); } },
        stream: (extra: object, forMs: number) => { streaming = extra; streamUntil = now + forMs; streamedAt = -Infinity; hooks.stream(); },
        stopStream: () => { streaming = null; },
        queued,
        frames,
        executed,
        settledAt: () => settledAt,
        motion: () => motion,
        setRtt: (ms: number) => { rttMs = ms; },
        setSettleExtra: (ms: number) => { settleExtraMs = ms; },
        holdQueue: (hold: boolean) => { queueHold = hold; },
        failQueue: () => { queueFail = true; },
        release: async () => { const next = held.shift(); if (next) { next(); } await new Promise<void>((resolve) => setImmediate(resolve)); },
        pendingAcks: () => held.length,
        lease,
        leaseChecks,
        declared,
        latch: () => latch,
        setM503: (text: string) => { m503 = text; },
        failEnter: () => { enterFail = true; },
        failSettle: () => { settleFail = true; },
        failRestore: (fail = true) => { restoreFail = fail; },
        setReportAge: (ms: number) => { reportAgeMs = ms; },
        setBeat: (value: { machine: { x: number; y: number; z: number }; reportedAt: number } | null) => { beat = value; },
        onQueue: (fn: ((count: number) => void) | null) => { onQueue = fn; },
        onEnter: (fn: (() => void) | null) => { onEnter = fn; },
        setSpeed: (value: number) => { speed = value; },
        verifiedBeat: () => hooks.clearLatch()
    };
}

type Fixture = ReturnType<typeof fixture>;
const wide = { xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 50 };
const readStatus = async (f: Fixture) => JSON.parse((await f.request('/pendant/status')).body);
const startRun = async (f: Fixture, extra: object = {}, forMs = 1500, maxSegmentMs = 500) => {
    await f.initialize();
    assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide, maxSegmentMs })).status, 200);
    f.input();
    f.stream({ x: 1, deadman: true, feed: 3000, ...extra }, forMs);
    await f.tick();
    await f.flush();
};

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

    ['a reviewed -1 mm edge stands: overtravel to it is allowed, the head is never pulled', async () => {
        const f = fixture(true); await f.initialize();
        f.machine.y = -0.4;
        const requested = { xMin: 100, xMax: 150, yMin: -1, yMax: 20, zMin: 280, zMax: 329 };
        assert.equal((await f.request('/pendant/arm', { bounds: requested, clearanceConfirmed: true, maxSegmentMs: 500 })).status, 200);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).bounds.yMin, -1);
        f.input(); await f.tick(); assert.equal(f.moves(), 0, 'centred stick never moves the head');
        f.input({ y: -1, deadman: true }); await f.tick(); assert.equal(f.moves(), 1, 'jogging out to the reviewed Y -1 is allowed');
        await f.finish();
        await f.request('/pendant/disarm', {});
        f.input();
        const strict = { ...requested, yMin: 0 };
        assert.equal((await f.request('/pendant/arm', { bounds: strict, clearanceConfirmed: true })).status, 400, 'an explicit Y0 minimum still refuses Y -0.4');
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
        assert.deepEqual(after.bounds, { xMin: -20, xMax: 331, yMin: -1, yMax: 343, zMin: 280, zMax: 329 }, 'travel ±1 mm stands as reviewed');
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
    ['broad envelope permits clear low jogs, holds armed before an obstacle and recovers moving away', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'fixture', machine: { x0: 20, x1: 21, y0: 5, y1: 15 }, clearanceZ: 20 });
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 0, xMax: 50, yMin: 0, yMax: 50, zMin: 0, zMax: 50 } })).status, 200);
        f.input(); f.input({ x: 1, deadman: true });
        await f.tick(); assert.equal(f.moves(), 1); await f.finish();
        f.machine.x = 14.95;
        f.input({ x: 1, deadman: true });
        for (let i = 0; i < 5; i += 1) { await f.tick(); }
        const held = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(held.armed, true);
        assert.equal(held.error, null);
        assert.deepEqual(held.blocked, { name: 'fixture', requiredZ: 20, requestedZ: 10, held: true, inside: false, text: 'BLOCKED fixture: Z>=20 (asked 10)' });
        assert.equal(f.moves(), 1, 'a refused segment is never transmitted, however many ticks pass');
        assert.equal(f.logs.filter((line) => line.startsWith('Jog held at fixture')).length, 1);
        assert.ok(!f.logs.slice(f.logs.findIndex((line) => line.startsWith('Armed reviewed'))).some((line) => line.startsWith('Disarmed')));
        const frame = f.writes().slice(-1)[0] as { armed: boolean; blocked: { name: string; requiredZ: number; requestedZ: number }; message: string };
        assert.equal(frame.armed, true);
        assert.deepEqual([frame.blocked.name, frame.blocked.requiredZ, frame.blocked.requestedZ], ['fixture', 20, 10]);
        assert.match(frame.message, /BLOCKED fixture: Z>=20 \(asked 10\)/);
        f.input(); await f.tick();
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked, null, 'neutral stick clears the hold');
        await f.tick();
        assert.equal((f.writes().slice(-1)[0] as { blocked: unknown }).blocked, null);
        f.input({ x: -1, deadman: true }); await f.tick();
        assert.equal(f.moves(), 2);
        assert.ok(f.targets[1].x < 14.95);
        await f.finish();
    }],
    ['Z-down over a landmark holds armed with no transmission; stick motion clear of it continues', async () => {
        const f = fixture(true); await f.initialize();
        f.obstacles.push({ name: 'rotary', machine: { x0: 140, x1: 200, y0: 0, y1: 350 }, clearanceZ: 328, clearanceBasis: 'toolhead' });
        f.machine.x = 170; f.machine.z = 328;
        const bounds = { xMin: -19, xMax: 330, yMin: 0, yMax: 342, zMin: 280, zMax: 328 };
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds })).status, 200);
        f.input(); f.input({ z: -1, mode: 'z', deadman: true });
        await f.tick(); await f.tick();
        let status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, true);
        assert.equal(f.moves(), 0);
        assert.equal(status.blocked.text, 'BLOCKED rotary: Z>=328 (asked 327.5)');
        f.input({ x: 1, z: -1, mode: 'z', deadman: true }); await f.tick();
        assert.equal(f.moves(), 1, 'the X component that stays at the required Z is sent');
        assert.equal(f.targets[0].z, 328);
        assert.ok(f.targets[0].x > 170);
        status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, true);
        assert.equal(status.blocked.held, false);
        assert.match(status.blocked.text, /^LIMITED rotary: Z>=328/);
        await f.finish();
        f.input({ x: 1, mode: 'z', deadman: true }); await f.tick();
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked, null, 'an accepted full segment clears the reason');
        await f.finish();
        assert.equal(f.logs.filter((line) => line.startsWith('Jog limited at rotary')).length, 0, 'only the first refusal per arm is logged');
        assert.equal(f.logs.filter((line) => line.startsWith('Jog held at rotary')).length, 1);
        await f.request('/pendant/disarm', {});
        f.input(); assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds })).status, 200);
        f.input(); f.input({ z: -1, mode: 'z', deadman: true }); await f.tick();
        assert.equal(f.logs.filter((line) => line.startsWith('Jog held at rotary')).length, 2, 'a new arm logs again');
        assert.equal(f.moves(), 2);
    }],
    ['an approach toward an obstacle stops just outside it, then holds', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'clamp', machine: { x0: 17, x1: 18, y0: 5, y1: 15 }, clearanceZ: 20, clearanceBasis: 'toolhead' });
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 0, xMax: 50, yMin: 0, yMax: 50, zMin: 0, zMax: 50 } })).status, 200);
        f.input(); f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick();
        assert.equal(f.moves(), 1);
        assert.ok(f.targets[0].x > 11.49 && f.targets[0].x < 11.5, `stopped ${f.targets[0].x} 0.5 mm outside the margin`);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked.held, false);
        await f.finish();
        f.machine.x = f.targets[0].x;
        await f.tick(); await f.tick();
        assert.equal(f.moves(), 1);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked.held, true);
    }],
    ['short approach segments stop at the 0.5 mm XY / 0.1 mm Z pad, not the exclusion edge', async () => {
        const f = fixture(); await f.initialize();
        // Exclusion X starts at 15 (obstacle 20 minus the 5 mm margin); the pad edge is 14.5.
        f.obstacles.push({ name: 'wall', machine: { x0: 20, x1: 21, y0: 5, y1: 15 }, clearanceZ: 20, clearanceBasis: 'toolhead' });
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 0, xMax: 50, yMin: 0, yMax: 50, zMin: 0, zMax: 50 } })).status, 200);
        f.machine.x = 14.3;
        f.input(); f.input({ x: 1, deadman: true }); await f.tick();
        // A 100 ms segment at 300 mm/min would end at 14.8: clear of the exclusion but inside the pad.
        assert.equal(f.moves(), 1);
        assert.ok(f.targets[0].x > 14.3 && f.targets[0].x <= 14.5, `stopped at ${f.targets[0].x}`);
        assert.match(JSON.parse((await f.request('/pendant/status')).body).blocked.text, /^LIMITED wall/);
        await f.finish();
        // Z: above the footprint, a descent stops at requiredZ + 0.1 - epsilon, not requiredZ - epsilon.
        f.machine.x = 16; f.machine.z = 20.3;
        f.input(); f.input({ z: -1, mode: 'z', deadman: true }); await f.tick();
        assert.equal(f.moves(), 2);
        assert.ok(f.targets[1].z >= 20.05 && f.targets[1].z < 20.3, `stopped at Z ${f.targets[1].z}`);
        await f.finish();
    }],
    ['every sent target is rounded to G-code precision inside the envelope before it is checked', async () => {
        const f = fixture(); await f.initialize();
        f.machine.x = 10.00049; f.machine.y = 9.99951;
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 5, xMax: 10.2996, yMin: 5, yMax: 15, zMin: 5, zMax: 15 } })).status, 200);
        f.input(); f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick();
        assert.equal(f.moves(), 1);
        const sent = f.targets[0];
        for (const axis of ['x', 'y', 'z'] as const) { assert.equal(Number(sent[axis].toFixed(3)), sent[axis], axis); }
        assert.equal(sent.x, 10.299, 'clipped at 10.2996 and rounded inward, never 10.300');
        assert.equal(sent.y, 10);
        await f.finish();
    }],
    ['displayed heights round the requirement up and the request down', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'fixture', machine: { x0: 20, x1: 21, y0: 5, y1: 15 }, clearanceZ: 20.004, clearanceBasis: 'toolhead' });
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: 0, xMax: 50, yMin: 0, yMax: 50, zMin: 0, zMax: 50 } })).status, 200);
        f.machine.x = 15.2; f.machine.z = 19.996;
        f.input(); f.input({ z: -1, mode: 'z', deadman: true }); await f.tick();
        assert.equal(f.moves(), 0);
        // Requested 19.496 and required 20.004: shown as 19.49 and 20.01, never 19.5 / 20.
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked.text, 'BLOCKED fixture: Z>=20.01 (asked 19.49)');
    }],
    ['a Z-down stick with slight XY drift holds instead of sending only the drift', async () => {
        const f = fixture(true); await f.initialize();
        f.obstacles.push({ name: 'rotary', machine: { x0: 140, x1: 200, y0: 0, y1: 350 }, clearanceZ: 328, clearanceBasis: 'toolhead' });
        f.machine.x = 170; f.machine.z = 328;
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true,
            bounds: { xMin: -19, xMax: 330, yMin: 0, yMax: 342, zMin: 280, zMax: 328 } })).status, 200);
        f.input(); f.input({ z: -1, x: 0.15, mode: 'z', deadman: true }); await f.tick(); await f.tick();
        assert.equal(f.moves(), 0);
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.armed, true);
        assert.equal(status.blocked.held, true);
        assert.match(status.blocked.text, /^BLOCKED rotary: Z>=328/);
    }],
    ['landmark changes while armed apply to the next segment and the inside state', async () => {
        const f = fixture(); await f.initialize(); await f.arm(); f.input();
        await f.tick();
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked, null);
        f.obstacles.push({ name: 'new clamp', machine: { x0: 9, x1: 11, y0: 9, y1: 11 }, clearanceZ: 30, clearanceBasis: 'toolhead' });
        await f.tick();
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked.text, 'INSIDE new clamp below Z30: Z-up only');
        f.input({ x: 1, deadman: true }); await f.tick();
        assert.equal(f.moves(), 0);
    }],
    ['a pre-fw Feather is logged once per connection as unidentified', async () => {
        const f = fixture(); await f.initialize();
        f.input(); f.input();
        const unidentified = () => f.logs.filter((line) => line === 'Feather firmware: unidentified (pre-fw build)').length;
        assert.equal(unidentified(), 1);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).firmware, null);
        assert.equal((await f.request('/pendant/connect', { path: 'COM42' })).status, 200);
        f.input(); assert.equal(unidentified(), 2);
        f.input({ fw: 'pendant-2026-10-05' }); f.input({ fw: 'pendant-2026-10-05' });
        assert.equal(f.logs.filter((line) => line === 'Feather firmware: pendant-2026-10-05').length, 1);
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
            await f.tick(); await f.tick();
            const status = JSON.parse((await f.request('/pendant/status')).body);
            assert.equal(status.armed, true, kind);
            assert.equal(status.blocked.name, kind);
            // Diagonal slides along the clear axis; the others start inside the box and hold.
            assert.equal(f.moves(), kind === 'diagonal' ? 1 : 0, kind);
            assert.equal(status.blocked.held, kind !== 'diagonal', kind);
            for (const to of f.targets) {
                for (const box of status.obstacleExclusions) {
                    assert.ok(!(envelopeChecks.segmentHitsBox2D(f.machine.x, f.machine.y, to.x, to.y, box.machine, 0)
                        && (box.requiredZ === null || Math.min(f.machine.z, to.z) < box.requiredZ - 0.05)), `${kind} sent ${JSON.stringify(to)}`);
                }
            }
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
    ['arming is allowed inside an excluded volume (to climb out) but refused on a non-idle machine', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'corner obstacle',
            machine: { x0: 5, x1: 5.2, y0: 14, y1: 14.2 },
            clearanceZ: 20,
            clearanceBasis: 'toolhead',
            mode: 'crossing' });
        assert.equal((await f.arm()).status, 200);
        assert.equal(JSON.parse((await f.request('/pendant/status')).body).blocked.text, 'INSIDE corner obstacle below Z20: Z-up only');
        await f.request('/pendant/disarm', {});
        f.obstacles.length = 0;
        f.failReady();
        assert.equal((await f.arm()).status, 400);
    }],
    ['the final segment check permits only a straight Z-up exit through an exclusion', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'block', machine: { x0: 8, x1: 12, y0: 8, y1: 12 }, clearanceZ: 20, clearanceBasis: 'toolhead' });
        const from = { x: 10, y: 10, z: 10 };
        f.runtime.validateJogSegment(from, { x: 10, y: 10, z: 11 });
        f.runtime.validateJogSegment(from, { x: 10.04, y: 9.96, z: 11 });
        assert.throws(() => f.runtime.validateJogSegment(from, { x: 10.2, y: 10, z: 11 }), /Jog blocked by block/);
        assert.throws(() => f.runtime.validateJogSegment(from, { x: 10, y: 10, z: 9 }), /Jog blocked by block/);
        assert.throws(() => f.runtime.validateJogSegment(from, { x: 11, y: 10, z: 10 }), /Jog blocked by block/);
        assert.throws(() => f.runtime.validateJogSegment({ x: 0, y: 10, z: 10 }, { x: 10, y: 10, z: 10 }), /Jog blocked by block/);
    }],
    ['armed inside an exclusion only Z-up moves; leaving it at the required Z restores normal motion', async () => {
        const f = fixture(); await f.initialize();
        f.obstacles.push({ name: 'rotary-axis', machine: { x0: 8, x1: 12, y0: 8, y1: 12 }, clearanceZ: 12, clearanceBasis: 'toolhead' });
        assert.equal((await f.arm()).status, 200);
        const status = async () => JSON.parse((await f.request('/pendant/status')).body);
        assert.deepEqual((await status()).blocked, { name: 'rotary-axis', requiredZ: 12, requestedZ: 10, held: true, inside: true, text: 'INSIDE rotary-axis below Z12: Z-up only' });
        f.input();
        await f.tick();
        const frame = f.writes().slice(-1)[0] as { armed: boolean; blocked: { inside: boolean; text: string } };
        assert.equal(frame.armed, true);
        assert.equal(frame.blocked.inside, true);
        assert.equal(frame.blocked.text, 'INSIDE rotary-axis below Z12: Z-up only');
        f.input({ x: 1, deadman: true }); await f.tick(); await f.tick();
        f.input({ y: -1, deadman: true }); await f.tick();
        f.input({ feed: 1000, deadman: true }); await f.tick();
        f.input({ z: -1, mode: 'z', deadman: true }); await f.tick();
        f.input({ z: 1, x: 0.3, mode: 'z', deadman: true }); await f.tick();
        assert.equal(f.moves(), 0, 'XY, feed-mode twist, Z-down and Z-up with an XY component all hold');
        assert.equal((await status()).armed, true);
        assert.equal(f.logs.filter((line) => line.startsWith('Jog held inside rotary-axis')).length, 1);
        f.input({ z: 1, mode: 'z', deadman: true }); await f.tick();
        assert.equal(f.moves(), 1);
        assert.equal(f.targets[0].x, 10); assert.equal(f.targets[0].y, 10);
        assert.ok(f.targets[0].z > 10);
        assert.equal((await status()).blocked.inside, true, 'still inside until the required Z is reached');
        await f.finish();
        f.machine.z = 12;
        f.input({ x: 1, deadman: true }); await f.tick();
        assert.equal(f.moves(), 2);
        assert.ok(f.targets[1].x > 10);
        assert.equal(f.targets[1].z, 12);
        assert.equal((await status()).blocked, null);
        await f.finish();
    }],
    ['pipelining is off by default: X/Y jogs stay on the settled one-segment engine', async () => {
        const f = fixture(); await f.initialize();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        f.input(); f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick();
        assert.equal(f.moves(), 1); assert.equal(f.queued.length, 0); assert.deepEqual(f.frames, []);
        assert.equal((await readStatus(f)).pipeline.requested, false);
        await f.finish();
    }],
    ['a pipelined run never commands more than the approved duration before it settles; raising the budget keeps it fed', async () => {
        for (const maxSegmentMs of [500, 1000]) {
            const f = fixture(false, { pipeline: true });
            await startRun(f, {}, 1500, maxSegmentMs);
            for (let i = 0; i < 6; i += 1) { await f.immediate(); await f.flush(); }
            const runs = f.executed();
            const enters = f.frames.filter((frame) => frame === 'enter').length;
            assert.ok(enters >= 2, `runs ${enters}`);
            assert.equal(f.frames.filter((frame) => frame === 'settle').length, enters);
            assert.ok(f.leaseChecks.length > 1 && f.leaseChecks.every((check) => check === null), 'the run is admitted under its own lease');
            assert.equal(f.lease.status().held, null);
            assert.equal(f.moves(), 0);
            const capMs = Math.floor((maxSegmentMs - 150) / 2);
            const perRun = new Map<number, number>();
            for (const run of runs) {
                perRun.set(run.run, (perRun.get(run.run) || 0) + run.commandedMs);
                assert.ok(run.commandedMs <= capMs + 1e-6, `segment ${run.commandedMs} ms`);
                assert.ok(run.outstandingAtArrival <= maxSegmentMs + 1e-6, `outstanding ${run.outstandingAtArrival} ms`);
                assert.equal(run.gap, 0, 'inside a run the next segment arrives before the controller runs dry');
                assert.equal(run.target.z, 10);
                for (const axis of ['x', 'y', 'z'] as const) {
                    assert.equal(run.target[axis], Number(run.target[axis].toFixed(3)), 'validated numbers are the ones sent');
                }
            }
            for (const [run, commanded] of perRun) { assert.ok(commanded <= maxSegmentMs + 1e-6, `run ${run} commanded ${commanded} ms`); }
            const after = await readStatus(f);
            assert.equal(after.busy, false); assert.equal(after.armed, true); assert.equal(after.pipeline.disabled, null);
            assert.equal(after.pipeline.runBudgetMs, maxSegmentMs);
            assert.equal(f.motion(), 0); assert.equal(f.latch(), null);
        }
        // A budget raised after hardware verification keeps one run fed for longer.
        const long = fixture(false, { pipeline: true, runMs: 2000 });
        await startRun(long, {}, 1500);
        const runs = long.executed();
        assert.ok(runs.length >= 6, `segments ${runs.length}`);
        assert.ok(runs.every((run) => run.gap === 0));
        assert.deepEqual(long.frames, ['latch', 'enter', 'settle'], 'one run for the whole hold');
        assert.equal((await readStatus(long)).pipeline.runBudgetMs, 2000);
    }],
    ['a slow or stalled controller cannot grow the backlog past the run budget, even when beats show only queued targets', async () => {
        for (const speed of [0.25, 0.001]) {
            const f = fixture(false, { pipeline: true });
            f.setSpeed(speed);
            // The A350 heartbeat reports the planner's queued target, so the lag check sees nothing.
            f.onQueue(() => { const last = f.queued[f.queued.length - 1]; f.setBeat({ machine: last.target, reportedAt: f.now() }); });
            await startRun(f, {}, 1500);
            const runs = f.executed().filter((run) => run.run === 1);
            assert.ok(runs.length >= 2);
            const lenMm = (run: { commandedMs: number; feed: number }) => run.commandedMs * run.feed / 60000;
            for (const run of runs) {
                // Unfinished commanded travel already at the controller when this segment arrives.
                const arrival = run.sentAt + 40;
                const backlog = runs.filter((r) => r.sentAt < run.sentAt)
                    .reduce((sum, r) => sum + lenMm(r) * Math.max(0, Math.min(1, (r.end - arrival) / (r.end - r.start))), 0);
                assert.ok(backlog + lenMm(run) <= 25 + 1e-6, `speed ${speed}: backlog ${(backlog + lenMm(run)).toFixed(2)} mm`);
            }
            const total = runs.reduce((sum, run) => sum + lenMm(run), 0);
            assert.ok(total <= 25 + 1e-6, `speed ${speed}: run commanded ${total.toFixed(2)} mm`);
            const after = await readStatus(f);
            assert.doesNotMatch(String(after.pipeline.disabled), /behind the queue model/, 'the lag check is inert here');
            assert.match(String(after.pipeline.disabled), /modelled end/, 'the late drain still turns pipelining off');
        }
    }],
    ['a run that queues nothing restores G54 and proves the position with M114 without disarming', async () => {
        const f = fixture(false, { pipeline: true });
        f.onEnter(() => { f.stopStream(); f.input(); });
        await startRun(f);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(f.queued.length, 0);
        const after = await readStatus(f);
        assert.equal(after.armed, true); assert.equal(after.error, null);
        assert.equal(f.latch(), null); assert.equal(f.lease.status().held, null);
        f.onEnter(null);
        f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick(); await f.flush();
        assert.ok(f.queued.length >= 1, 'jogging continues');
    }],
    ['arming with pipelining warns that M220 S100 persists after the run', async () => {
        const f = fixture(false, { pipeline: true });
        await f.initialize();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        assert.match(String((await readStatus(f)).pipeline.notice), /M220 S100, which STAYS in force/);
        assert.match(pendantPage('t'), /pipeline-note/);
    }],
    ['a UI command during a queued run is refused by the lease until the closing G54', async () => {
        const f = fixture(false, { pipeline: true });
        f.holdQueue(true);
        await startRun(f);
        assert.equal(f.pendingAcks(), 1);
        assert.match(String(f.lease.refusal('G0 X0 Y0')), /reserved by the USB pendant/);
        assert.match(String(f.lease.refusal('G54')), /reserved/);
        f.stopStream(); f.input();
        f.holdQueue(false);
        await f.release(); await f.flush();
        assert.deepEqual(f.frames, ['latch', 'enter', 'settle']);
        assert.equal(f.lease.refusal('G0 X0 Y0'), null);
        assert.equal(f.lease.status().refused, 2);
    }],
    ['STOP, deadman release and browser loss queue nothing further and still settle before releasing control', async () => {
        for (const how of ['stop', 'release', 'browser']) {
            const f = fixture(false, { pipeline: true });
            f.holdQueue(true);
            await startRun(f);
            assert.equal(f.pendingAcks(), 1, how);
            await f.release(); await f.flush();
            assert.equal(f.queued.length, 1, how); assert.equal(f.pendingAcks(), 1, how);
            f.stopStream();
            if (how === 'stop') {
                f.input({ stop: true });
            } else if (how === 'release') {
                f.input();
            } else {
                f.advance(901); f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick();
            }
            assert.throws(() => f.gate.enterTool('home'), /pendant/, how);
            f.holdQueue(false);
            await f.release(); await f.flush();
            assert.equal(f.queued.length, 2, `${how}: only the already-sent segment completes`);
            assert.deepEqual(f.frames, ['latch', 'enter', 'settle'], how);
            assert.deepEqual(f.settledAt(), f.queued[1].target, how);
            const after = await readStatus(f);
            assert.equal(after.busy, false, how);
            assert.equal(after.armed, how === 'release', how);
            if (how === 'browser') { assert.match(after.error, /page heartbeat/); }
            if (how !== 'release') {
                f.gate.enterTool('home')();
                f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick(); await f.flush();
                assert.equal(f.queued.length, 2, how);
            }
        }
    }],
    ['an obstacle hold ends the run with a settle; queued segments stop short of the exclusion', async () => {
        const f = fixture(false, { pipeline: true });
        f.obstacles.push({ name: 'fixture', machine: { x0: 30, x1: 31, y0: 0, y1: 20 }, clearanceZ: 20 });
        await startRun(f, {}, 3000);
        const after = await readStatus(f);
        assert.equal(after.armed, true);
        assert.equal(after.blocked.name, 'fixture'); assert.equal(after.blocked.held, true);
        assert.ok(f.queued.length >= 2);
        for (const q of f.queued) { assert.ok(q.target.x <= 24.5, `queued X ${q.target.x} reaches the padded footprint`); }
        assert.equal(f.frames.filter((frame) => frame === 'enter').length, f.frames.filter((frame) => frame === 'settle').length);
        assert.match(after.pipeline.lastRun.stopReason, /held at fixture/);
        assert.equal(after.busy, false); assert.equal(f.moves(), 0);
    }],
    ['Z intent uses the settled engine; a slow acknowledgement or late drain returns to it until re-arm', async () => {
        const z = fixture(false, { pipeline: true });
        await z.initialize();
        assert.equal((await z.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        z.input(); z.input({ z: 1, mode: 'z', deadman: true, feed: 600 }); await z.tick();
        assert.equal(z.moves(), 1); assert.equal(z.queued.length, 0); await z.finish();
        for (const fault of ['slow', 'late']) {
            const f = fixture(false, { pipeline: true });
            if (fault === 'slow') { f.setRtt(450); } else { f.setSettleExtra(1000); }
            await startRun(f, {}, 1500);
            const after = await readStatus(f);
            assert.match(String(after.pipeline.disabled), fault === 'slow' ? /acknowledged/ : /modelled end/);
            assert.equal(after.armed, true, fault);
            if (fault === 'slow') { assert.equal(f.queued.length, 1); }
            const queued = f.queued.length;
            await f.request('/pendant/keepalive', {}); f.input(); f.input({ x: -1, deadman: true, feed: 3000 }); await f.tick();
            assert.equal(f.moves(), 1, fault); assert.equal(f.queued.length, queued, fault);
            await f.finish();
            await f.request('/pendant/disarm', {});
            f.input();
            assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
            assert.equal((await readStatus(f)).pipeline.disabled, null);
        }
    }],
    ['firmware limits below the model refuse pipelining at arm', async () => {
        for (const [m503, why] of [['echo:  M203 X120 Y120 Z40\necho:  M201 X200 Y3000 Z100\necho:  M204 P1000 R1000 T1000', /acceleration/],
            ['echo:  M203 X30 Y120 Z40\necho:  M201 X3000 Y3000 Z100\necho:  M204 P1000 R1000 T1000', /max feed/],
            ['ok', /unknown/]] as Array<[string, RegExp]>) {
            const f = fixture(false, { pipeline: true });
            f.setM503(m503);
            await f.initialize();
            assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
            const after = await readStatus(f);
            assert.equal(after.pipeline.requested, true);
            assert.match(String(after.pipeline.disabled), why);
            f.input(); f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick();
            assert.equal(f.moves(), 1); assert.equal(f.queued.length, 0); assert.deepEqual(f.frames, []);
            await f.finish();
        }
    }],
    ['an in-run heartbeat behind the queue model ends the run and returns to settled jogs', async () => {
        const f = fixture(false, { pipeline: true, runMs: 2000 });
        // A controller that reported its executing position, still at the start while the queue says it moved.
        f.onQueue((count) => { if (count === 8) { f.setBeat({ machine: { x: 10, y: 10, z: 10 }, reportedAt: f.now() }); } });
        await startRun(f, {}, 1500);
        const after = await readStatus(f);
        assert.match(String(after.pipeline.disabled), /behind the queue model/);
        assert.equal(f.queued.length, 8);
        assert.deepEqual(f.frames, ['latch', 'enter', 'settle']);
        assert.equal(after.armed, true);
    }],
    ['a stale heartbeat ends the run; a non-idle report during queued motion disarms with an explicit message', async () => {
        const stale = fixture(false, { pipeline: true });
        stale.onQueue((count) => { if (count === 3) { stale.setReportAge(3000); } });
        await startRun(stale, {}, 400);
        const after = await readStatus(stale);
        assert.match(after.pipeline.lastRun.stopReason, /heartbeat 3000 ms old/);
        assert.equal(stale.queued.length, 3);
        assert.deepEqual(stale.frames.slice(0, 3), ['latch', 'enter', 'settle']);
        assert.equal(after.armed, true);
        const busy = fixture(false, { pipeline: true });
        busy.onQueue((count) => { if (count === 3) { busy.setMachineStatus('running'); } });
        await startRun(busy, {}, 1500);
        const stopped = await readStatus(busy);
        assert.equal(stopped.armed, false);
        assert.match(stopped.error, /reported "running" during queued motion.*re-arm/);
        assert.deepEqual(busy.frames, ['latch', 'enter', 'settle']);
        await busy.tick();
        assert.match(JSON.stringify(busy.writes().slice(-1)), /during queued motion/);
    }],
    ['a long hold settles every run budget and every two seconds at most', async () => {
        const f = fixture(false, { pipeline: true });
        await startRun(f, { feed: 600 }, 5000);
        for (let i = 0; i < 12; i += 1) { await f.immediate(); await f.flush(); }
        const enters = f.frames.filter((frame) => frame === 'enter').length;
        assert.ok(enters >= 4, `runs ${enters}`);
        assert.equal(f.frames.filter((frame) => frame === 'settle').length, enters);
        const perRun = new Map<number, number>();
        for (const run of f.executed()) { perRun.set(run.run, (perRun.get(run.run) || 0) + run.commandedMs); }
        for (const [run, commanded] of perRun) { assert.ok(commanded <= 500 + 1e-6, `run ${run} commanded ${commanded} ms`); }
    }],
    ['an unacknowledged queued move disarms and restores G54 without commanding a position', async () => {
        const f = fixture(false, { pipeline: true });
        f.failQueue();
        await startRun(f);
        const after = await readStatus(f);
        assert.equal(after.armed, false); assert.match(after.error, /rejected/);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore']);
        assert.equal(f.settledAt(), null); assert.equal(after.busy, false);
        assert.ok(f.latch()?.restoredAt, 'restored; a verified position must still follow');
        f.verifiedBeat();
        assert.equal(f.latch(), null); assert.equal(f.motion(), 0);
    }],
    ['a lost G53 reply or a failed settle still restores G54 in the run exit path', async () => {
        const lost = fixture(false, { pipeline: true });
        lost.failEnter();
        await startRun(lost);
        assert.deepEqual(lost.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(lost.queued.length, 0); assert.equal((await readStatus(lost)).armed, false);
        assert.equal(lost.latch(), null); assert.equal(lost.motion(), 0);
        const crash = fixture(false, { pipeline: true });
        crash.failSettle();
        await startRun(crash);
        assert.deepEqual(crash.frames, ['latch', 'enter', 'settle', 'restore']);
        const after = await readStatus(crash);
        assert.equal(after.armed, false); assert.match(after.error, /did not settle: Overtravel/);
        assert.ok(crash.latch()?.restoredAt); assert.equal(crash.motion(), 0);
        assert.equal(crash.lease.status().held, null); assert.equal(crash.lease.status().recovery, null);
    }],
    ['if the restore also fails, the latch, crash guard and a recovery lease hold until a verified restore', async () => {
        const f = fixture(false, { pipeline: true });
        f.failSettle(); f.failRestore();
        await startRun(f);
        const after = await readStatus(f);
        assert.equal(after.armed, false); assert.match(after.error, /could not restore the work frame/);
        assert.ok(f.latch()); assert.equal(f.motion(), 1, 'crash guard stays armed while queued motion may run');
        // Luban UI jog, go-to-origin and file start stay refused; recovery commands pass.
        assert.ok(f.lease.status().recovery);
        assert.match(String(f.lease.refusal('G0 X0 Y0')), /machine workspace/);
        assert.match(String(f.lease.refusal('start job')), /machine workspace/);
        assert.equal(f.lease.refusal('G90\nG54;'), null);
        assert.equal(f.lease.refusal('G53;\nG28;\nG54;'), null);
        f.input();
        const refused = await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide });
        assert.equal(refused.status, 400); assert.match(refused.body, /machine frame is uncertain/);
        f.failRestore(false);
        assert.equal((await f.request('/pendant/restore-frame', {})).status, 200);
        assert.ok(f.latch()?.restoredAt, 'restored, not yet verified');
        f.input();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 400);
        f.verifiedBeat();
        assert.equal(f.latch(), null); assert.equal(f.lease.status().recovery, null);
        await f.tick();
        assert.equal(f.motion(), 0);
        f.input();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
    }],
    ['shutdown resolves only after the queued run has settled', async () => {
        const f = fixture(false, { pipeline: true });
        f.holdQueue(true);
        await startRun(f);
        let done = false;
        const closing = f.runtime.shutdown().then(() => { done = true; });
        await f.flush();
        assert.equal(done, false);
        f.holdQueue(false);
        await f.release(); await closing;
        assert.deepEqual(f.frames, ['latch', 'enter', 'settle']);
        assert.equal(f.lease.status().held, null);
    }],
    ['estimated motion is explicitly marked on the DRO and cannot authorize a new jog', async () => {
        const f = fixture(); await f.initialize(); f.estimate();
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.dro.reliability, 'estimated');
        assert.equal((await f.arm()).status, 400);
        assert.equal(f.moves(), 0);
    }],
];
