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
import * as pendantHold from '../pendantHold';

interface Queued { sentAt: number; replyAt: number; target: { x: number; y: number; z: number }; feed: number; run: number; gcode: string }

function fixture(a350 = false, options: { pipeline?: boolean; countCheck?: 'enforced' | 'observe'; serialized?: boolean } = {}) {
    let now = 1000;
    // Pipelined-run doubles: the controller acknowledges each request after rttMs,
    // and an ideal executor (no acceleration) runs accepted segments back to back
    // from rttMs / 2 after the send. queueHold parks acknowledgements for the test.
    let rttMs = 80;
    // The M114 double answers at once unless a reply time is set (the HTTP channel would
    // serialize it behind the G1 in flight; here it runs beside it on the fake clock).
    let countRttMs = 0;
    let countText: string | null = null;
    // The arm-time M114 (offset learning) can be given its own text.
    let armCountText: string | null = null;
    // The M114 double answers result -1 (as SstpHttpChannel does for a transport error).
    let countFail = false;
    // The Count frame's offset from machine coordinates, as the trial A350 showed it (X +19, Y +4, Z +0 mm): the
    // double prints Count = (position + offset) x 400, so every test exercises the learning, never a constant.
    let countOffset = { x: 19, y: 4, z: 0 };
    let queueHold = false;
    let queueFail = false;
    let tripped = false;
    // Controller model limits as M503 S reports them (Snapmaker defaults), with M92 steps/mm.
    let m503 = 'echo:  M92 X400.00 Y400.00 Z400.00 E212.00\necho:  M203 X120.00 Y120.00 Z40.00 E45.00\necho:  M201 X3000 Y3000 Z100 E10000\necho:  M204 P1000.00 R1000.00 T1000.00';
    let enterFail = false;
    // True from the hold's G53 to its closing restore: flush() keeps the fake clock running until then.
    let holdOpen = false;
    let restoreFail = false;
    let onRestore: (() => void) | null = null;
    // M114 after the close matches only as machine coordinates (refused).
    let verifyFail = false;
    let reportAgeMs = 0;
    let latch: { reason: string; since: number; restoredAt: number | null } | null = null;
    let runNo = 0;
    // Executor speed relative to commanded feed (1 = ideal; < 1 = slow or stalled controller).
    let speed = 1;
    let onEnter: (() => void) | null = null;
    let onQueue: ((count: number) => void) | null = null;
    const declared: string[] = [];
    let declaredNow = false;
    const frames: string[] = [];
    // The fixture's own latch copy: the lease reads it as its recovery hold and
    // re-raises it through holdForRecovery, exactly as the real binding does.
    const latchListeners: Array<(value: typeof latch) => void> = [];
    const raiseLatch = (reason: string) => {
        latch = { reason, since: now, restoredAt: null }; frames.push('latch');
        for (const listener of latchListeners) { listener(latch); }
    };
    const lease = new GcodeLease({ get: () => (latch ? { ...latch } : null), raise: raiseLatch });
    const leaseChecks: Array<string | null> = [];
    const countLeaseChecks: Array<string | null> = [];
    const held: Array<() => void> = [];
    const queued: Queued[] = [];
    const counts: Array<{ sentAt: number; execMs: number; text: string }> = [];
    const verified: Array<{ x: number; y: number; z: number }> = [];
    let feedOverride: object | null = null;
    let streaming: object | null = null;
    let streamKeepalive = true;
    let streamUntil = 0;
    let streamedAt = -Infinity;
    let motion = 0;
    // Assigned below, once the USB stream and the executor exist.
    const hooks = { stream: (): void => undefined,
        physicalAt: (t: number): { x: number; y: number; z: number } => ({ x: t * 0, y: 0, z: 0 }),
        clearLatch: (): void => { if (latch) { latch = null; for (const listener of latchListeners) { listener(null); } } } };
    // Serialized channel double (options.serialized): one request in flight at a time,
    // each taking its own reply time after the one ahead of it, and a failed request
    // cancels the requests already waiting behind it, like
    // SstpHttpChannel.consumeGCodeQueue ("Cancelled after an earlier command failed.").
    // A G1 is awaited by the hold loop, so its wait advances the fake clock; an M114 is
    // fire-and-forget, so it resolves once the loop's own sleeps (or a later G1) bring
    // the clock to its reply time. Without the option each double advances the clock
    // by its reply time at once and runs beside the others.
    let channelTail: Promise<void> = Promise.resolve();
    let channelBusyUntil = -Infinity;
    let channelWaiting = 0;
    let channelCancel = false;
    const channel = async <T extends { result: number }>(kind: 'move' | 'query', rttMs0: number, run: () => Promise<T>): Promise<T> => {
        if (!options.serialized) { now += rttMs0; hooks.stream(); return run(); }
        const start = Math.max(now, channelBusyUntil);
        const due = start + rttMs0;
        channelBusyUntil = due;
        const previous = channelTail;
        let done: () => void = () => undefined;
        channelTail = new Promise<void>((resolve) => { done = resolve; });
        channelWaiting += 1;
        try {
            if (kind === 'move') { now = Math.max(now, start); hooks.stream(); } else {
                while (now < due) { await new Promise<void>((resolve) => setImmediate(resolve)); } // eslint-disable-line no-await-in-loop
            }
            await previous;
            channelWaiting -= 1;
            if (channelCancel) {
                if (channelWaiting === 0) { channelCancel = false; }
                throw Error('Controller rejected the queued move: Cancelled after an earlier command failed.');
            }
            if (kind === 'move') { now = Math.max(now, due); hooks.stream(); }
            let out: T;
            try { out = await run(); } catch (err) { channelCancel = channelWaiting > 0; throw err; }
            if (out.result !== 0) { channelCancel = channelWaiting > 0; }
            return out;
        } finally { done(); }
    };
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
    const snapshot = () => ({ originOffset: { x: 0, y: 0, z: 0 },
        originOffsetSource: 'heartbeat',
        machineStatus,
        reliability: 'heartbeat',
        reportAgeMs,
        isHomed: true,
        machine,
        work: machine,
        frame: 'work-frame',
        warnings,
        reportedAt: now - reportAgeMs,
        judged: { declaredRun: declaredNow } });
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
        './pendantHold': pendantHold,
        './pendantPosition': { pendantPosition },
        './pendantPage': { pendantPage },
        './pendantSettings': { pendantSettings: () => ({}), updatePendantSettings: (args: object) => settingsChanges.push(args) },
        '../machine/gcodeLease': { gcodeLease: lease },
        './failureRecovery': { getFeedOverride: () => feedOverride },
        './positionOfRecord': { currentGcodeSequence: () => 0,
            getTrustedOffset: () => null,
            getPositionOfRecord: () => (estimated ? { source: 'estimated' } : null),
            getFrameLatch: () => latch,
            latchFrameUncertain: raiseLatch,
            onFrameLatchChange: (listener: (value: typeof latch) => void) => { latchListeners.push(listener); return () => undefined; } },
        './probeFeed': { probeFeedService: { assertNoOvertravel: () => { if (tripped) { throw Error('Overtravel tripwire latched.'); } },
            motionBegin: () => { motion += 1; },
            motionEnd: () => { motion -= 1; } } },
        './probing': { assertMachineReadyForProcedure: () => { if (readyError) { throw Error('not idle'); } },
            moveMachineSettled: async (_label: string, position: { x: number; y: number; z: number }) => {
                moves += 1; targets.push({ ...position }); await new Promise<void>((resolve) => { finish = resolve; });
            },
            // Let a fire-and-forget M114 settle its reply time before the clock moves on.
            sleep: async (ms: number) => { await new Promise<void>((resolve) => setImmediate(resolve)); now += ms; hooks.stream(); },
            readFirmwareMotionConfig: async () => m503,
            enterMachineFrame: async () => {
                frames.push('enter'); leaseChecks.push(lease.refusal('G53', now)); runNo += 1; holdOpen = true;
                now += rttMs; hooks.stream();
                if (onEnter) { onEnter(); }
                if (enterFail) { throw Error('transport_error after the request was sent'); }
                feedOverride = { gcode: 'M220 S100', at: now, connection: 'c', certain: true, note: null }; // What recordModalSend notes for the accepted payload.
                return { result: 0 };
            },
            queueMachineMove: async (_tool: string, target: { x: number; y: number; z: number }, feed: number, opts?: { omitZ?: boolean }) => {
                const sentAt = now;
                leaseChecks.push(lease.refusal('G1', now));
                if (queueFail) { throw Error('Controller rejected the queued move: transport_error'); }
                if (queueHold) { await new Promise<void>((resolve) => { held.push(resolve); }); }
                return channel('move', queueHold ? 0 : rttMs, async () => {
                    const gcode = pendantHold.queuedMoveGcode(target, feed, opts?.omitZ === true);
                    queued.push({ sentAt, replyAt: now, target: { ...target }, feed, run: runNo, gcode });
                    if (onQueue) { onQueue(queued.length); }
                    return { result: 0 };
                });
            },
            verifyRestoredPosition: async (_tool: string, expected: { x: number; y: number; z: number }) => {
                frames.push('verify'); verified.push({ ...expected });
                if (verifyFail) { return false; }
                Object.assign(machine, expected); // Proven: the next heartbeat shows it.
                hooks.clearLatch();
                return true;
            },
            // M114 during the hold: the ideal executor's stepper position at the send time, as
            // Marlin prints it (Count in steps at 400 steps/mm).
            queryPositionReport: async () => {
                const sentAt = now;
                countLeaseChecks.push(lease.refusal('M114', now));
                const p = hooks.physicalAt(sentAt);
                const override = holdOpen ? countText : armCountText;
                // At arm nothing drives the clock, so the arm-time M114 takes its reply time like an awaited request.
                return channel(holdOpen ? 'query' : 'move', countRttMs, async () => {
                    if (countFail && holdOpen) {
                        counts.push({ sentAt, execMs: now - sentAt, text: 'transport_error' });
                        return { result: -1, text: 'transport_error', sequence: 0, execMs: now - sentAt };
                    }
                    const c = { x: Math.round((p.x + countOffset.x) * 400),
                        y: Math.round((p.y + countOffset.y) * 400),
                        z: Math.round((p.z + countOffset.z) * 400) };
                    const text = override !== null ? override
                        : `X:${p.x.toFixed(3)} Y:${p.y.toFixed(3)} Z:${p.z.toFixed(3)} E:0.00 Count X:${c.x} Y:${c.y} Z:${c.z}`;
                    counts.push({ sentAt, execMs: now - sentAt, text });
                    return { result: 0, text, sequence: 0, execMs: now - sentAt };
                });
            } },
        './tools/camera': {
            sendWorkFrameRestore: async () => {
                restores += 1; frames.push('restore'); holdOpen = false;
                if (onRestore) { onRestore(); }
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
            ...(options.countCheck ? { LUBAN_PENDANT_COUNT_CHECK: options.countCheck } : {}) } },
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
            if (streamKeepalive) { request('/pendant/keepalive', {}).catch(() => undefined); }
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
    // Where the ideal executor's stepper is at clock time t.
    hooks.physicalAt = (t: number) => {
        let position = startPosition;
        for (const run of executed()) {
            const from = position;
            if (t < run.start) { break; }
            if (t < run.end) {
                const k = (t - run.start) / (run.end - run.start);
                return { x: from.x + (run.target.x - from.x) * k, y: from.y + (run.target.y - from.y) * k, z: from.z + (run.target.z - from.z) * k };
            }
            position = run.target;
        }
        return { ...position };
    };
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
        flush: async () => {
            for (let i = 0; i < 20 || (holdOpen && i < 20000); i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
        },
        stream: (extra: object, forMs: number, keepalive = true) => {
            streaming = extra; streamKeepalive = keepalive; streamUntil = now + forMs; streamedAt = -Infinity; hooks.stream();
        },
        stopStream: () => { streaming = null; },
        queued,
        counts,
        verified,
        frames,
        executed,
        motion: () => motion,
        setRtt: (ms: number) => { rttMs = ms; },
        setCountRtt: (ms: number) => { countRttMs = ms; },
        setCountText: (text: string | null) => { countText = text; },
        setArmCountText: (text: string | null) => { armCountText = text; },
        setCountOffset: (offset: { x: number; y: number; z: number }) => { countOffset = offset; },
        failCount: () => { countFail = true; },
        holdQueue: (hold: boolean) => { queueHold = hold; },
        failQueue: () => { queueFail = true; },
        trip: () => { tripped = true; },
        raiseLatch,
        release: async () => { const next = held.shift(); if (next) { next(); } await new Promise<void>((resolve) => setImmediate(resolve)); },
        pendingAcks: () => held.length,
        lease,
        leaseChecks,
        countLeaseChecks,
        declared,
        latch: () => latch,
        setM503: (text: string) => { m503 = text; },
        failEnter: () => { enterFail = true; },
        failVerify: () => { verifyFail = true; },
        failRestore: (fail = true) => { restoreFail = fail; },
        onRestore: (fn: (() => void) | null) => { onRestore = fn; },
        setReportAge: (ms: number) => { reportAgeMs = ms; },
        onQueue: (fn: ((count: number) => void) | null) => { onQueue = fn; },
        onEnter: (fn: (() => void) | null) => { onEnter = fn; },
        setSpeed: (value: number) => { speed = value; },
        verifiedBeat: () => hooks.clearLatch(),
        // A beat verified the latch away while the run was still open (the dead-end scenario).
        clearLatchSilently: () => { latch = null; },
        latchListeners,
    };
}

type Fixture = ReturnType<typeof fixture>;
const { HOLD_MOVE_MS, HOLD_QUEUE_AHEAD_MS, HOLD_TICK_MS, holdMoveMm } = pendantHold;
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
    ['a hold sends one G53 at the press and one G54 at release, paced by the clock with at most 200 ms queued ahead', async () => {
        for (const feed of [300, 3000]) {
            const f = fixture(false, { pipeline: true });
            let stopAt = 0;
            f.onQueue((count) => { if (count === 12) { f.stopStream(); f.input({ deadman: true }); stopAt = f.now(); } });
            await startRun(f, { feed }, 5000);
            assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify'], `${feed}: one G53, one G54, one M114 proof`);
            assert.equal(f.queued.length, 12, `${feed}: nothing is sent after the stop`);
            assert.ok(f.queued[11].sentAt <= stopAt, `${feed}: the stop was seen before the next send`);
            assert.ok(f.leaseChecks.length > 1 && f.leaseChecks.every((check) => check === null), 'the hold is admitted under its own lease');
            assert.equal(f.lease.status().held, null);
            assert.equal(f.moves(), 0, 'nothing on the settled engine');
            const runs = f.executed();
            for (const run of runs) {
                assert.ok(run.commandedMs <= HOLD_MOVE_MS + 1e-6, `${feed}: increment ${run.commandedMs} ms`);
                assert.ok(run.outstandingAtArrival <= HOLD_QUEUE_AHEAD_MS + 40 + 1e-6, `${feed}: outstanding ${run.outstandingAtArrival} ms at arrival (cap plus half a round trip)`);
                assert.equal(run.gap, 0, `${feed}: the controller never runs dry inside the hold`);
                assert.equal(run.target.z, 10);
                for (const axis of ['x', 'y', 'z'] as const) {
                    assert.equal(run.target[axis], Number(run.target[axis].toFixed(3)), 'validated numbers are the ones sent');
                }
            }
            const sends = f.queued.map((q) => q.sentAt);
            for (let i = 2; i < sends.length; i += 1) {
                assert.ok(sends[i] - sends[i - 1] <= HOLD_TICK_MS + 1e-6, `${feed}: send ${i} came ${sends[i] - sends[i - 1]} ms after the previous`);
            }
            assert.ok(runs[runs.length - 1].end - stopAt <= HOLD_QUEUE_AHEAD_MS + 40 + 1e-6, `${feed}: run-out ${runs[runs.length - 1].end - stopAt} ms after the stop`);
            assert.deepEqual(f.verified[0], f.queued[11].target, 'the close proves the commanded end position, Z included');
            for (const q of f.queued) {
                assert.match(q.gcode, /^G1 X-?\d+\.\d{3} Y-?\d+\.\d{3} F\d+;$/, `${feed}: hold increments carry no Z word (${q.gcode})`);
            }
            const after = await readStatus(f);
            assert.equal(after.busy, false); assert.equal(after.armed, true); assert.equal(after.pipeline.disabled, null);
            assert.equal(after.pipeline.lastHold.stopReason, 'stick centred');
            assert.equal(after.pipeline.lastHold.moves, 12);
            assert.equal(after.pipeline.lastHold.restored, true); assert.equal(after.pipeline.lastHold.proved, true);
            assert.ok(after.pipeline.lastHold.maxOutstandingMs <= HOLD_QUEUE_AHEAD_MS);
            const travelled = f.queued.reduce((sum, q, i) => sum + Math.abs(q.target.x - (i ? f.queued[i - 1].target.x : 10)), 0);
            assert.equal(after.lastJog.distanceMm.toFixed(3), travelled.toFixed(3));
            assert.equal(f.motion(), 0); assert.equal(f.latch(), null);
            assert.ok(f.logs.some((line) => /Continuous jog hold ended/.test(line)));
        }
    }],
    ['a second press after a release starts a new hold: the close proved the frame, so no beat wait is needed', async () => {
        const f = fixture(false, { pipeline: true });
        f.onQueue((count) => { if (count === 4) { f.stopStream(); f.input(); } });
        await startRun(f);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        f.onQueue(null);
        f.stream({ x: -1, deadman: true, feed: 3000 }, 400);
        await f.tick(); await f.flush();
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify', 'latch', 'enter', 'restore', 'verify']);
        assert.ok(f.queued.length > 4);
        assert.ok(f.queued[f.queued.length - 1].target.x < f.queued[3].target.x, 'the second hold followed the reversed stick');
        assert.match((await readStatus(f)).pipeline.lastHold.stopReason, /Feather report gap/);
    }],
    ['every stop trigger ends the hold within one tick and closes it with exactly one G54', async () => {
        const triggers = ['release', 'deadman', 'stop', 'gap', 'keepalive', 'reply-error', 'alarm', 'epoch', 'latch', 'status', 'stale'];
        for (const how of triggers) {
            const f = fixture(false, { pipeline: true });
            let stopAt = 0;
            f.onQueue((count) => {
                if (count !== 5) { return; }
                stopAt = f.now();
                f.stopStream();
                if (how === 'release') { f.input(); } else if (how === 'deadman') { f.input({ x: 1, deadman: false }); } else if (how === 'stop') { f.input({ stop: true }); } else if (how === 'gap') { /* no more Feather reports */ } else if (how === 'keepalive') { f.stream({ x: 1, deadman: true, feed: 3000 }, 3000, false); } else if (how === 'reply-error') { f.failQueue(); f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); } else if (how === 'alarm') { f.trip(); f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); } else if (how === 'epoch') { f.reconnect(); f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); } else if (how === 'latch') { f.raiseLatch('the failed-call hook'); f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); } else if (how === 'status') { f.setMachineStatus('running'); f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); } else { f.setReportAge(5000); f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); }
            });
            await startRun(f, {}, 5000);
            const after = await readStatus(f);
            const lastSend = f.queued[f.queued.length - 1].sentAt;
            const extra = how === 'keepalive' ? 900 : 0; // The page watchdog allows 900 ms of silence before it disarms.
            assert.ok(lastSend <= stopAt + extra + HOLD_TICK_MS + 1e-6, `${how}: last send ${lastSend - stopAt} ms after the trigger`);
            if (how === 'reply-error') {
                assert.deepEqual(f.frames, ['latch', 'enter', 'restore'], `${how}: an unacknowledged G1 restores without proving a position`);
                assert.ok(f.latch()?.restoredAt, `${how}: a verified beat must still follow`);
                f.verifiedBeat();
            } else {
                assert.deepEqual(f.frames.filter((frame) => frame !== 'latch'), ['enter', 'restore', 'verify'], how);
            }
            assert.equal(f.frames.filter((frame) => frame === 'enter').length, 1, `${how}: one G53`);
            assert.equal(f.frames.filter((frame) => frame === 'restore').length, 1, `${how}: one G54`);
            assert.equal(after.busy, false, how);
            assert.equal(f.lease.status().held, null, how);
            if (how === 'latch') { assert.match(after.pipeline.lastHold.stopReason, /latch was raised by something else/, how); }
            // The hold's own G54 plus its M114 proof is a verified restore for whichever latch stands (one clearing path).
            assert.equal(f.latch(), null, how);
            const stillArmed = ['release', 'deadman', 'gap', 'stale', 'latch'].includes(how);
            assert.equal(after.armed, stillArmed, `${how}: armed`);
            if (how === 'stop') { assert.match(after.error, /Feather D2/); }
            if (how === 'keepalive') { assert.match(after.error, /page heartbeat/); }
            if (how === 'alarm') { assert.match(after.error, /Overtravel tripwire/); }
            if (how === 'epoch') { assert.match(after.error, /connection changed/); }
            if (how === 'status') { assert.match(after.error, /reported "running" during queued motion.*re-arm/); }
            if (how === 'stale') { assert.match(after.pipeline.lastHold.stopReason, /heartbeat 5000 ms old/); }
            if (how === 'gap') { assert.match(after.pipeline.lastHold.stopReason, /Feather report gap/); }
            if (how === 'deadman') { assert.equal(after.pipeline.lastHold.stopReason, 'D1 released'); }
            if (how === 'reply-error') { assert.match(after.error, /rejected/); }
            assert.equal(f.motion(), 0, how);
        }
    }],
    ['a lease held by someone else refuses the hold before any G53', async () => {
        const f = fixture(false, { pipeline: true });
        const other = f.lease.acquire('a probing procedure', 60000, f.now());
        await startRun(f);
        assert.deepEqual(f.frames, []);
        assert.equal(f.queued.length, 0);
        const after = await readStatus(f);
        assert.equal(after.armed, false); assert.match(after.error, /reserved by a probing procedure/);
        f.lease.release(other);
    }],
    ['the obstacle test includes the queued run-out: the hold stops one run-out short of the exclusion', async () => {
        for (const [feed, runout] of [[3000, 10], [300, 1]]) {
            const f = fixture(false, { pipeline: true });
            // Exclusion X starts at 25 (obstacle 30 minus the 5 mm margin); the approach pad edge is 24.5.
            f.obstacles.push({ name: 'fixture', machine: { x0: 30, x1: 31, y0: 0, y1: 20 }, clearanceZ: 20 });
            if (feed === 3000) { f.machine.x = 2; } // 5 mm increments plus 10 mm run-out: from X10 the very first increment would already be held.
            await startRun(f, { feed }, 8000);
            const after = await readStatus(f);
            assert.equal(after.armed, true, String(feed));
            assert.ok(after.blocked, `${feed}: ${JSON.stringify([after.pipeline.lastHold, after.error, f.queued.map((q) => q.target.x)])}`);
            assert.equal(after.blocked.name, 'fixture'); assert.equal(after.blocked.held, true);
            assert.match(after.blocked.text, /^BLOCKED fixture: Z>=20/);
            assert.match(after.pipeline.lastHold.stopReason, /held at fixture/);
            assert.ok(f.queued.length >= 2, String(feed));
            const last = f.queued[f.queued.length - 1].target.x;
            assert.ok(last <= 24.5 - runout + 1e-6, `${feed}: last sent X ${last} leaves less than ${runout} mm of run-out before the pad`);
            assert.ok(last > 24.5 - runout - holdMoveMm(feed) - 1e-6, `${feed}: stopped within one increment of the run-out limit (${last}; sent ${JSON.stringify(f.queued.map((q) => q.target.x))})`);
            assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
            assert.ok(f.logs.some((line) => new RegExp(`Continuous jog held at fixture: .*plus ${runout.toFixed(2)} mm of queued run-out`).test(line)), String(feed));
            assert.equal(after.busy, false); assert.equal(f.moves(), 0);
        }
    }],
    ['armed inside an exclusion the hold sends nothing (Z-up exits are settled jogs)', async () => {
        const f = fixture(false, { pipeline: true });
        f.obstacles.push({ name: 'block', machine: { x0: 8, x1: 12, y0: 8, y1: 12 }, clearanceZ: 20, clearanceBasis: 'toolhead' });
        await startRun(f);
        assert.deepEqual(f.frames, [], 'no G53: the settled path already holds inside the exclusion');
        assert.equal(f.queued.length, 0); assert.equal(f.moves(), 0);
        assert.match((await readStatus(f)).blocked.text, /^INSIDE block/);
    }],
    ['the reviewed envelope stands to travel +/-1 mm: the hold jogs out to Y -1 and stops at the limit, never clipped back', async () => {
        const f = fixture(true, { pipeline: true });
        f.machine.y = 0.3;
        const bounds = { xMin: 100, xMax: 150, yMin: -1, yMax: 20, zMin: 280, zMax: 329 };
        await f.initialize();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds })).status, 200);
        f.input();
        f.stream({ y: -1, deadman: true, feed: 3000 }, 3000);
        await f.tick(); await f.flush();
        assert.ok(f.queued.length >= 1, JSON.stringify([f.frames, (await readStatus(f)).pipeline, (await readStatus(f)).error]));
        assert.equal(f.queued[f.queued.length - 1].target.y, -1, 'the last increment ends exactly at the reviewed Y -1');
        assert.ok(f.queued.every((q) => q.target.y >= -1 && q.target.x === 124), 'never past the reviewed edge, no X drift');
        const after = await readStatus(f);
        assert.equal(after.armed, true);
        assert.match(after.pipeline.lastHold.stopReason, /at the approved Y limit/);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
    }],
    ['M114 Count is polled through the lease and traced; observe mode never gates, even with a stalled controller', async () => {
        const f = fixture(false, { pipeline: true });
        f.setSpeed(0.25); // The controller executes at a quarter of the commanded feed: Count falls behind the clock model.
        f.onQueue((count) => { if (count === 15) { f.stopStream(); f.input({ deadman: true }); } });
        await startRun(f, {}, 8000);
        const after = await readStatus(f);
        assert.equal(after.pipeline.countCheck.mode, 'observe');
        assert.equal(after.pipeline.lastHold.stopReason, 'stick centred', 'observe never stops the hold');
        assert.equal(after.pipeline.disabled, null);
        assert.equal(f.queued.length, 15, 'open loop: the clock model kept sending');
        assert.ok(after.pipeline.lastHold.countSamples >= 3, `samples ${after.pipeline.lastHold.countSamples}`);
        assert.ok(f.countLeaseChecks.length >= 3 && f.countLeaseChecks.every((check) => check === null), 'M114 passes under the hold\'s own lease');
        assert.ok(after.pipeline.countCheck.last.off, 'the last sample saw the lag');
        assert.ok(after.pipeline.countCheck.lastLagMm > 5, `lag ${after.pipeline.countCheck.lastLagMm} mm`);
        assert.ok(after.pipeline.lastHold.maxLagMm >= after.pipeline.countCheck.lastLagMm);
        assert.deepEqual(after.pipeline.countCheck.stepsPerMm, { x: 400, y: 400, z: 400 });
        assert.equal(after.pipeline.countCheck.stepsPerMmSource, 'M92');
        assert.equal(after.pipeline.countCheck.queueAheadMs, 200);
        assert.deepEqual(after.pipeline.countCheck.countOffsetMm, { x: 19, y: 4, z: 0 }, 'learned from the arm-time M114, not assumed');
        assert.ok(after.pipeline.countCheck.countOffsetLearnedAt >= 1000);
        assert.equal(after.pipeline.countCheck.countOffsetProblem, null);
        assert.ok(after.pipeline.countCheck.last.rawMm.x - after.pipeline.countCheck.last.derived.x - 19 < 1e-9, 'raw Count frame kept beside the derived position');
        const sampleGaps = f.counts.slice(2).map((c, i) => c.sentAt - f.counts[i + 1].sentAt); // counts[0] is the arm-time offset sample
        assert.ok(sampleGaps.every((gap) => gap >= 250 - 1e-6), `polled every 250 ms: ${sampleGaps}`);
        const traceBody = JSON.parse((await f.request('/pendant/hold-trace')).body);
        const kinds = new Set(traceBody.ticks.map((t: { kind: string }) => t.kind));
        for (const kind of ['send', 'wait', 'count', 'stop']) { assert.ok(kinds.has(kind), `trace has ${kind} records`); }
        const countTick = traceBody.ticks.find((t: { kind: string }) => t.kind === 'count');
        assert.ok(countTick.count.count && countTick.count.rawMm && countTick.count.derived && countTick.count.expected && typeof countTick.count.lagMm === 'number');
        assert.ok(Math.abs(countTick.count.rawMm.x - countTick.count.count.x / 400) < 1e-9, 'the raw Count stays in every trace record');
        assert.ok(traceBody.ticks.every((t: { outstandingMs: number; inputAgeMs: number }) => t.outstandingMs <= 200 && t.inputAgeMs >= 0));
        assert.equal(traceBody.hold.stopReason, 'stick centred');
    }],
    ['enforced Count check stops the hold on lag, on a late M114 reply and on a reply without Count fields', async () => {
        const cases: Array<[string, (f: Fixture) => void, RegExp]> = [
            ['lag', (f) => f.setSpeed(0.25), /Count position .* mm from the expected executed position/],
            ['late', (f) => f.setCountRtt(150), /M114 reply took 150 ms/],
            ['missing', (f) => f.setCountText('ok'), /no Count fields/],
        ];
        for (const [name, arrange, why] of cases) {
            const f = fixture(false, { pipeline: true, countCheck: 'enforced' });
            arrange(f);
            await startRun(f, {}, 8000);
            const after = await readStatus(f);
            assert.equal(after.pipeline.countCheck.mode, 'enforced', name);
            assert.match(after.pipeline.lastHold.stopReason, why, `${name}: ${after.pipeline.lastHold.stopReason}`);
            if (name === 'late') {
                assert.equal(after.pipeline.disabled, null, 'one late M114 stops the hold; only a streak turns continuous jogging off');
                assert.equal(after.pipeline.lateEvents, 1);
            } else {
                assert.match(String(after.pipeline.disabled), why, `${name}: settled jogs until re-armed`);
            }
            assert.equal(after.armed, true, name);
            assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify'], name);
            assert.ok(f.queued.length < 40, `${name}: stopped at ${f.queued.length} increments`);
            if (name === 'lag') {
                const ticks = JSON.parse((await f.request('/pendant/hold-trace')).body).ticks as Array<{ kind: string; count?: { at: number; execMs: number; lagMm: number | null } }>;
                const failing = ticks.find((t) => t.kind === 'count' && t.count && t.count.lagMm !== null && t.count.lagMm > 5 + 0.05);
                assert.ok(failing && failing.count, 'the trace shows the sample that failed');
                const sample = (failing as { count: { at: number; execMs: number } }).count;
                assert.ok(f.queued[f.queued.length - 1].sentAt <= sample.at + sample.execMs + HOLD_TICK_MS + 1e-6, 'no send more than a tick after the failing sample');
            }
            f.input(); f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick(); await f.flush();
            if (name === 'late') {
                assert.equal(f.frames.filter((frame) => frame === 'enter').length, 2, 'continuous jogging is still on after one late reply');
            } else {
                assert.equal(f.moves(), 1, `${name}: settled jogs continue`);
                await f.finish();
            }
        }
        const steady = fixture(false, { pipeline: true, countCheck: 'enforced' });
        // 16 increments of 5 mm stay inside the 100 mm envelope.
        steady.onQueue((count) => { if (count === 16) { steady.stopStream(); steady.input({ deadman: true }); } });
        await startRun(steady, {}, 5000);
        const after = await readStatus(steady);
        assert.equal(after.pipeline.lastHold.stopReason, 'stick centred', `a controller that keeps up is never stopped by the enforced check: ${JSON.stringify([after.pipeline.lastHold, steady.counts])}`);
        assert.ok(after.pipeline.lastHold.countSamples >= 3);
        assert.equal(after.pipeline.lastHold.maxLagMm <= 5.05, true);
    }],
    ['the Count offset is learned on every arm; an arm-time reply without Count leaves it unknown (observe traces raw, enforced refuses to arm)', async () => {
        const f = fixture(false, { pipeline: true });
        f.setCountOffset({ x: 7.25, y: -3, z: 1 });
        await f.initialize();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        let status = await readStatus(f);
        assert.deepEqual(status.pipeline.countCheck.countOffsetMm, { x: 7.25, y: -3, z: 1 }, 'whatever the controller reports, not 19/4/0');
        assert.match(String(status.pipeline.notice), /Count offset learned at arm: X 7\.250 Y -3\.000 Z 1\.000 mm/);
        assert.ok(f.logs.some((line) => /Count offset learned at arm/.test(line)));
        await f.request('/pendant/disarm', {});
        f.setCountOffset({ x: 19, y: 4, z: 0 }); // e.g. after a home: the counts moved, the next arm learns again
        f.input();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        status = await readStatus(f);
        assert.deepEqual(status.pipeline.countCheck.countOffsetMm, { x: 19, y: 4, z: 0 });
        assert.equal(f.counts.length, 2, 'one offset sample per arm');
        f.input(); f.onQueue((count) => { if (count === 8) { f.stopStream(); f.input({ deadman: true }); } });
        f.stream({ x: 1, deadman: true, feed: 3000 }, 3000); await f.tick(); await f.flush();
        status = await readStatus(f);
        assert.ok(status.pipeline.lastHold.countSamples >= 1);
        assert.ok(status.pipeline.countCheck.lastLagMm < 5.05, `the offset is applied: lag ${status.pipeline.countCheck.lastLagMm} mm`);
        // No Count at arm: observe arms and traces raw Count only; nothing is derived or judged.
        const blind = fixture(false, { pipeline: true });
        blind.setArmCountText('X:10.000 Y:10.000 Z:10.000 E:0.00');
        await blind.initialize();
        assert.equal((await blind.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        status = await readStatus(blind);
        assert.equal(status.pipeline.countCheck.countOffsetMm, null);
        assert.match(String(status.pipeline.countCheck.countOffsetProblem), /no Count fields/);
        assert.match(String(status.pipeline.notice), /Count offset unknown/);
        blind.input(); blind.onQueue((count) => { if (count === 8) { blind.stopStream(); blind.input({ deadman: true }); } });
        blind.stream({ x: 1, deadman: true, feed: 3000 }, 3000); await blind.tick(); await blind.flush();
        status = await readStatus(blind);
        assert.equal(status.pipeline.lastHold.stopReason, 'stick centred');
        assert.ok(status.pipeline.lastHold.countSamples >= 1);
        assert.ok(status.pipeline.countCheck.last.count && status.pipeline.countCheck.last.rawMm, 'raw Count traced');
        assert.equal(status.pipeline.countCheck.last.derived, null); assert.equal(status.pipeline.countCheck.lastLagMm, null);
        assert.equal(status.pipeline.lastHold.maxLagMm, null);
        // Enforced cannot gate on an unreadable Count: the arm is refused with the reason.
        const strict = fixture(false, { pipeline: true, countCheck: 'enforced' });
        strict.setArmCountText('ok');
        await strict.initialize();
        const refused = await strict.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide });
        assert.equal(refused.status, 400);
        assert.match(refused.body, /Count check is enforced but its offset could not be learned: the arm-time M114 carried no Count fields/);
        assert.equal((await readStatus(strict)).armed, false);
        assert.deepEqual(strict.frames, []);
    }],
    ['steps per mm fall back to the A350 default when M503 S has no M92', async () => {
        const f = fixture(false, { pipeline: true });
        f.setM503('echo:  M203 X120.00 Y120.00 Z40.00 E45.00\necho:  M201 X3000 Y3000 Z100 E10000\necho:  M204 P1000.00 R1000.00 T1000.00');
        await f.initialize();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        const after = await readStatus(f);
        assert.equal(after.pipeline.countCheck.stepsPerMmSource, 'default');
        assert.deepEqual(after.pipeline.countCheck.stepsPerMm, { x: 400, y: 400, z: 400 });
        assert.equal(after.pipeline.countCheck.last, null);
        assert.match(String(after.pipeline.notice), /Count check is in observe mode/);
    }],
    ['arming with pipelining warns that M220 S100 persists after the hold and names the Count mode', async () => {
        const f = fixture(false, { pipeline: true });
        await f.initialize();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        const notice = String((await readStatus(f)).pipeline.notice);
        assert.match(notice, /M220 S100, which STAYS in force/);
        assert.match(notice, /one G53 when D1 is pressed/);
        assert.match(notice, /observe mode/);
        assert.match(pendantPage('t'), /pipeline-note/);
        const enforced = fixture(false, { pipeline: true, countCheck: 'enforced' });
        await enforced.initialize();
        assert.equal((await enforced.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        assert.match(String((await readStatus(enforced)).pipeline.notice), /Count check is ENFORCED/);
    }],
    ['a UI command during a hold is refused by the lease until the closing G54; the failure hook sees the holder', async () => {
        const f = fixture(false, { pipeline: true });
        f.holdQueue(true);
        await startRun(f);
        assert.equal(f.pendingAcks(), 1);
        assert.match(String(f.lease.refusal('G0 X0 Y0')), /reserved by the USB pendant/);
        assert.match(String(f.lease.refusal('G54')), /reserved/);
        assert.match(String(f.lease.status().held?.owner), /USB pendant \(continuous jog\)/, 'what failureRecoveryDeps.leaseHolder reports, so the hook skips');
        assert.equal(f.lease.status().held?.requestTimeoutMs, 10000, 'every request under the hold times out in 10 s');
        f.stopStream(); f.input();
        f.holdQueue(false);
        await f.release(); await f.flush();
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(f.lease.refusal('G0 X0 Y0'), null);
        assert.equal(f.lease.status().refused, 2);
    }],
    ['STOP, deadman release and browser loss send nothing further and still close the hold before releasing control', async () => {
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
            assert.equal(f.queued.length, 2, `${how}: only the already-sent increment completes`);
            assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify'], how);
            assert.deepEqual(f.verified[0], f.queued[1].target, how);
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
    ['Z intent uses the settled engine; a late acknowledgement returns to it until re-arm', async () => {
        const z = fixture(false, { pipeline: true });
        await z.initialize();
        assert.equal((await z.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        z.input(); z.input({ z: 1, mode: 'z', deadman: true, feed: 600 }); await z.tick();
        assert.equal(z.moves(), 1); assert.equal(z.queued.length, 0); await z.finish();
        const f = fixture(false, { pipeline: true });
        f.setRtt(250);
        await startRun(f, {}, 1500);
        let after = await readStatus(f);
        assert.equal(after.pipeline.lastHold.stopReason, 'late acknowledgement');
        assert.equal(after.pipeline.lastHold.lateMoveReplies, 1);
        assert.equal(after.pipeline.lateEvents, 1);
        assert.equal(after.pipeline.disabled, null, 'one late reply stops the hold but does not turn continuous jogging off');
        assert.equal(after.armed, true);
        assert.equal(f.queued.length, 1);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        // Two more late holds in the same arm turn it off.
        for (let i = 2; i <= 3; i += 1) {
            f.input(); f.stream({ x: 1, deadman: true, feed: 3000 }, 1500); await f.tick(); await f.flush();
            after = await readStatus(f);
            assert.equal(after.pipeline.lateEvents, i);
            assert.equal(f.queued.length, i);
        }
        assert.match(String(after.pipeline.disabled), /3 late replies in a row/);
        assert.equal(after.armed, true);
        await f.request('/pendant/keepalive', {}); f.input(); f.input({ x: -1, deadman: true, feed: 3000 }); await f.tick();
        assert.equal(f.moves(), 1); assert.equal(f.queued.length, 3, 'settled jogs until re-arm');
        await f.finish();
        await f.request('/pendant/disarm', {});
        f.input();
        assert.equal((await f.request('/pendant/arm', { clearanceConfirmed: true, bounds: wide })).status, 200);
        after = await readStatus(f);
        assert.equal(after.pipeline.disabled, null); assert.equal(after.pipeline.lateEvents, 0);
        // A hold that ends for any other reason resets the streak.
        const clean = fixture(false, { pipeline: true });
        clean.setRtt(250);
        await startRun(clean, {}, 1500);
        assert.equal((await readStatus(clean)).pipeline.lateEvents, 1);
        clean.setRtt(80);
        clean.onQueue((count) => { if (count === 4) { clean.stopStream(); clean.input({ deadman: true }); } });
        clean.input(); clean.stream({ x: 1, deadman: true, feed: 3000 }, 1500); await clean.tick(); await clean.flush();
        assert.equal((await readStatus(clean)).pipeline.lateEvents, 0);
    }],
    ['a stick pointed at an obstacle within one run-out never opens a hold: the settled prefix runs once, then nothing until neutral', async () => {
        const f = fixture(false, { pipeline: true });
        // Exclusion X starts at 25; the pad edge is 24.5. From X10 at F3000 the first increment (5 mm) plus 10 mm of run-out reaches it.
        f.obstacles.push({ name: 'fixture', machine: { x0: 30, x1: 31, y0: 0, y1: 20 }, clearanceZ: 20 });
        await startRun(f, {}, 3000);
        assert.deepEqual(f.frames, [], 'no G53');
        assert.equal(f.moves(), 1, 'the settled path sent its segment instead');
        assert.ok(f.targets[0].x <= 24.5 && f.targets[0].x > 10, `settled segment to ${f.targets[0].x}`);
        assert.ok(f.logs.some((line) => /Continuous jog not started: the first increment plus 10\.00 mm of queued run-out/.test(line)));
        let status = await readStatus(f);
        assert.equal(status.pipeline.holdOffUntilNeutral, true);
        assert.equal(status.armed, true);
        await f.finish();
        // The stick stays pointed at the box: re-drive the timers; settled segments run up to
        // the pad and then hold, and nothing opens a hold.
        for (let i = 0; i < 8; i += 1) {
            f.machine.x = f.targets[f.targets.length - 1].x;
            f.input({ x: 1, deadman: true, feed: 3000 }); await f.request('/pendant/keepalive', {});
            await f.immediate(); await f.tick(); await f.flush(); await f.finish();
        }
        assert.deepEqual(f.frames, [], 'still no G53 while the stick points at the box');
        assert.ok(f.targets.every((t) => t.x <= 24.5), `settled targets stop at the pad: ${JSON.stringify(f.targets.map((t) => t.x))}`);
        status = await readStatus(f);
        assert.equal(status.blocked.held, true, 'held at the pad'); assert.equal(status.armed, true);
        // Neutral, then away from the box: a hold opens.
        f.input(); await f.tick();
        assert.equal((await readStatus(f)).pipeline.holdOffUntilNeutral, false);
        f.stream({ x: -1, deadman: true, feed: 3000 }, 600); await f.tick(); await f.flush();
        assert.equal(f.frames.filter((frame) => frame === 'enter').length, 1);
        assert.ok(f.queued.length >= 1 && f.queued[0].target.x < f.targets[f.targets.length - 1].x, 'the hold moves away from the box');
    }],
    ['serialized channel: an M114 in flight inflates the next G1 reply within budget; a slow one makes it late and stops the hold', async () => {
        const within = fixture(false, { pipeline: true, serialized: true });
        within.setCountRtt(100);
        within.onQueue((count) => { if (count === 14) { within.stopStream(); within.input({ deadman: true }); } });
        await startRun(within, {}, 5000);
        let after = await readStatus(within);
        assert.equal(after.pipeline.lastHold.stopReason, 'stick centred');
        assert.equal(after.pipeline.lastHold.lateMoveReplies, 0);
        assert.ok(after.pipeline.lastHold.countSamples >= 2);
        const sends = JSON.parse((await within.request('/pendant/hold-trace')).body).ticks.filter((t: { kind: string }) => t.kind === 'send') as Array<{ replyMs: number }>;
        assert.ok(sends.some((t) => t.replyMs > 80), 'a G1 queued behind the M114 waited for it');
        assert.ok(sends.every((t) => t.replyMs <= 200), 'but stayed within budget');
        const late = fixture(false, { pipeline: true, serialized: true });
        late.setCountRtt(150);
        await startRun(late, {}, 5000);
        after = await readStatus(late);
        assert.equal(after.pipeline.lastHold.stopReason, 'late acknowledgement', 'the G1 behind a 150 ms M114 took over 200 ms');
        assert.equal(after.pipeline.lateEvents, 1);
        assert.equal(after.pipeline.disabled, null);
        assert.equal(after.armed, true);
        assert.deepEqual(late.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(late.motion(), 0);
    }],
    ['serialized channel: a failed M114 cancels the G1 queued behind it, which closes the hold through the restore path even in observe mode', async () => {
        const f = fixture(false, { pipeline: true, serialized: true });
        f.setCountRtt(120); f.failCount();
        await startRun(f, {}, 5000);
        const after = await readStatus(f);
        assert.equal(after.pipeline.countCheck.mode, 'observe');
        assert.match(after.error, /Cancelled after an earlier command failed/);
        assert.equal(after.armed, false);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore'], 'a cancelled G1 is uncertain: restore without an M114 proof');
        assert.ok(f.latch()?.restoredAt, 'a verified beat must still follow');
        assert.ok(after.pipeline.countCheck.last.error, 'the poll failure itself was only recorded');
        assert.equal(after.pipeline.disabled, null, 'observe mode gated nothing; the channel did');
        f.verifiedBeat();
        assert.equal(f.latch(), null); assert.equal(f.motion(), 0);
    }],
    ['a switch to Z mid-hold closes the hold and the Z jog goes to the settled engine', async () => {
        const f = fixture(false, { pipeline: true });
        f.onQueue((count) => { if (count === 3) { f.stream({ z: 1, mode: 'z', deadman: true, feed: 600 }, 1000); } });
        await startRun(f, {}, 400);
        assert.equal((await readStatus(f)).pipeline.lastHold.stopReason, 'Z motion uses settled jogs');
        assert.equal(f.queued.length, 3);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        await f.immediate(); await f.flush();
        assert.equal(f.moves(), 1, 'the Z intent went to the settled engine after the close');
        assert.ok(f.targets[0].z > 10);
        await f.finish();
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
    ['a hold that queues nothing restores G54 and proves the position with M114 without disarming', async () => {
        const f = fixture(false, { pipeline: true });
        f.onEnter(() => { f.stopStream(); f.input(); });
        await startRun(f);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(f.queued.length, 0);
        assert.deepEqual(f.verified[0], { x: 10, y: 10, z: 10 }, 'proved at the press position');
        const after = await readStatus(f);
        assert.equal(after.armed, true); assert.equal(after.error, null);
        assert.equal(after.pipeline.lastHold.moves, 0);
        assert.equal(f.latch(), null); assert.equal(f.lease.status().held, null);
        f.onEnter(null);
        f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick(); await f.flush();
        assert.ok(f.queued.length >= 1, 'jogging continues');
    }],
    ['a lost G53 reply still restores G54 in the close path', async () => {
        const lost = fixture(false, { pipeline: true });
        lost.failEnter();
        await startRun(lost);
        assert.deepEqual(lost.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(lost.queued.length, 0); assert.equal((await readStatus(lost)).armed, false);
        assert.equal(lost.latch(), null); assert.equal(lost.motion(), 0);
        assert.equal(lost.lease.status().held, null);
    }],
    ['if the close restore fails, the latch, crash guard and the recovery hold stand until a verified restore', async () => {
        const f = fixture(false, { pipeline: true });
        f.failRestore();
        f.onQueue((count) => { if (count === 3) { f.stopStream(); f.input(); } });
        await startRun(f);
        const after = await readStatus(f);
        assert.equal(after.armed, false); assert.match(after.error, /could not restore the work frame/);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore']);
        assert.equal(after.pipeline.lastHold.restored, false);
        assert.ok(f.latch()); assert.equal(f.motion(), 1, 'crash guard stays armed while queued motion may run');
        // Luban UI jog, go-to-origin and file start stay refused; recovery commands pass.
        assert.ok(f.lease.status().recovery); assert.equal(f.lease.status().held, null);
        assert.match(String(f.lease.refusal('G0 X0 Y0')), /machine workspace/);
        assert.match(String(f.lease.refusal('start job')), /machine workspace/);
        assert.equal(f.lease.refusal('G90\nG54;'), null);
        assert.equal(f.lease.refusal('M114'), null);
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
    ['the hold dead end: a beat clears the latch just before the close restore fails, and the hold re-raises it', async () => {
        const f = fixture(false, { pipeline: true });
        f.failRestore();
        f.onRestore(() => f.clearLatchSilently());
        f.onQueue((count) => { if (count === 2) { f.stopStream(); f.input(); } });
        await startRun(f);
        const after = await readStatus(f);
        assert.equal(after.armed, false); assert.match(after.error, /could not restore the work frame/);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'latch'], 're-raised by holdForRecovery');
        assert.ok(f.latch(), 'the hold cannot outlive its latch'); assert.equal(f.latch()?.restoredAt, null);
        assert.match(String(f.latch()?.reason), /could not restore the work frame/);
        assert.ok(f.lease.status().recovery); assert.equal(f.lease.status().held, null);
        assert.equal(f.motion(), 1);
        f.failRestore(false); f.onRestore(null);
        assert.equal((await f.request('/pendant/restore-frame', {})).status, 200);
        f.verifiedBeat();
        assert.equal(f.latch(), null); assert.equal(f.lease.status().recovery, null); assert.equal(f.motion(), 0);
    }],
    ['shutdown resolves only after the hold has closed', async () => {
        const f = fixture(false, { pipeline: true });
        f.holdQueue(true);
        await startRun(f);
        let done = false;
        const closing = f.runtime.shutdown().then(() => { done = true; });
        await f.flush();
        assert.equal(done, false);
        f.holdQueue(false);
        await f.release(); await closing;
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.equal(f.lease.status().held, null);
    }],
    ['estimated motion is explicitly marked on the DRO and cannot authorize a new jog', async () => {
        const f = fixture(); await f.initialize(); f.estimate();
        const status = JSON.parse((await f.request('/pendant/status')).body);
        assert.equal(status.dro.reliability, 'estimated');
        assert.equal((await f.arm()).status, 400);
        assert.equal(f.moves(), 0);
    }],
    ['the held crash guard is released when the latch clears, even after the USB pendant was closed', async () => {
        const f = fixture(false, { pipeline: true });
        f.failRestore();
        await startRun(f);
        assert.equal(f.motion(), 1);
        await f.runtime.shutdown(); // No port, no timer, no tick from here on.
        assert.equal(f.motion(), 1, 'closing the pendant does not release a guard the latch still justifies');
        assert.equal(f.latchListeners.length, 1, 'the runtime subscribed to latch changes');
        f.verifiedBeat(); // An MCP restore_work_frame plus its verified beat clears the latch...
        assert.equal(f.motion(), 0, '...and the guard goes with it, with no tick');
    }],
    ['pendant status reports the persisting M220 override after a hold, armed or not', async () => {
        const f = fixture(false, { pipeline: true });
        await startRun(f);
        assert.equal((await readStatus(f)).pipeline.feedOverride.gcode, 'M220 S100');
        await f.request('/pendant/disarm', {});
        const status = await readStatus(f);
        assert.equal(status.armed, false);
        assert.equal(status.pipeline.feedOverride.gcode, 'M220 S100', 'still shown: the controller keeps it');
    }],
    ['a hold whose closing M114 reads only as machine coordinates stays latched until a verified beat', async () => {
        const f = fixture(false, { pipeline: true });
        f.failVerify();
        f.onQueue((count) => { if (count === 3) { f.stopStream(); f.input(); } });
        await startRun(f);
        assert.deepEqual(f.frames, ['latch', 'enter', 'restore', 'verify']);
        assert.ok(f.latch(), 'not proven: a G53 reading is not a position');
        assert.ok(f.latch()?.restoredAt, 'the restore itself was acknowledged');
        assert.equal((await readStatus(f)).pipeline.lastHold.proved, false);
        assert.ok(f.logs.some((line) => /did not verify the commanded end position in the work frame/.test(line)));
        assert.equal((await readStatus(f)).armed, true, 'held, not disarmed: the beat may still verify it');
        f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick();
        assert.equal(f.frames.filter((frame) => frame === 'enter').length, 1, 'no new hold while the latch waits for its beat');
        f.verifiedBeat();
        assert.equal(f.latch(), null);
        f.input({ x: 1, deadman: true, feed: 3000 }); await f.tick(); await f.flush();
        assert.equal(f.frames.filter((frame) => frame === 'enter').length, 2, 'the next press starts a new hold once verified');
    }],
];
