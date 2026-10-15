import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import * as procedureLimits from '../procedureLimits';
import { reliableForMotion } from '../machinePosition';
import { ConnectionDiagnosticState, httpEvidence, safeIdentifier, safeTarget } from '../../machine/connectionDiagnosticState';
import { GcodeLease } from '../../machine/gcodeLease';

function load(file: string, dependencies: Record<string, unknown>) {
    const source = fs.readFileSync(path.join(__dirname, '../../machine', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    } });
    const exports = {} as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    vm.runInNewContext(compiled.outputText, {
        exports,
        setInterval,
        clearInterval,
        clearTimeout,
        Date,
        process: { env: { NODE_ENV: 'test' } },
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return dependencies[name];
        },
    });
    return exports;
}

function stubImports(source: string): Record<string, unknown> {
    const dependencies: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    let match = pattern.exec(source);
    while (match !== null) {
        dependencies[match[1]] = {};
        match = pattern.exec(source);
    }
    return dependencies;
}

const events = { Connecting: 'connecting', Connected: 'connected', Ready: 'ready', Disconnected: 'disconnected', ErrorReport: 'error-report' };
const logger = () => ({ info: () => undefined, warn: () => undefined, debug: () => undefined });

function fixture() {
    const diagnostics = new ConnectionDiagnosticState({ instanceId: 'test', pid: 1, startedAt: 0, version: 'test', build: 'test' }, () => undefined);
    const diagnosticModule = { connectionDiagnostics: diagnostics, diagnosticId: () => 'diagnostic-id' };
    const workers: Array<{ callback: (value: object) => void; terminated: boolean; terminate: () => void }> = [];
    const sent: string[] = [];
    const replies: Array<{ err?: object; res?: object }> = [];
    const requests: Array<{ method: string; url: string }> = [];
    const request = (method: string, url: string) => {
        requests.push({ method, url });
        const req = {
            timeout: () => req,
            query: () => req,
            send: (value: string) => { if (value.startsWith('code=')) { sent.push(value.slice(5)); } return req; },
            end: (callback: (err?: object, res?: object) => void) => { const reply = replies.shift(); callback(reply?.err, reply?.res); },
        };
        return req;
    };
    class Channel extends EventEmitter {
        public socket = new EventEmitter();
    }
    const lease = new GcodeLease();
    const module = load('channels/SstpHttpChannel.ts', {
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value), isNil: (value: unknown) => value == null, isEqual: () => false },
        superagent: { post: (url: string) => request('POST', url), get: (url: string) => request('GET', url) },
        '../../../../app/communication/socket-events': { ConnectionOpen: 'connection:open' },
        '../../../../app/constants/machines': {},
        '../../../../app/machines/snapmaker-2-toolheads': {},
        '../../../constants': {},
        '../../../lib/logger': logger,
        '../../task-manager/workerManager': { heartBeat: (_args: unknown, callback: (value: object) => void) => {
            const worker = { callback, terminated: false, terminate: () => { worker.terminated = true; } };
            workers.push(worker);
            return worker;
        } },
        '../connectionDiagnostics': diagnosticModule,
        '../connectionDiagnosticState': { httpEvidence },
        '../types': { ConnectionType: { WiFi: 'wifi' } },
        './Channel': Channel,
        '../gcodeLease': { gcodeLease: lease },
        './ChannelEvent': { ChannelEvent: events },
    });
    const HttpChannel = module.default;
    const channel = new HttpChannel();
    channel.socket = new EventEmitter();
    channel.getGcodePrintingInfo = () => ({});
    return { channel, workers, replies, sent, requests, diagnostics, diagnosticModule, lease };
}

function cameraFixture() {
    const source = fs.readFileSync(path.join(__dirname, '../tools/camera.ts'), 'utf8');
    const dependencies = stubImports(source);
    const commands: string[] = [];
    const replies: Array<{ result: number; text?: string }> = [];
    const state = { machineStatus: 'idle', reliability: 'stale', headPower: 0, frame: 'work-frame', originOffset: { x: 10, y: 20, z: 30 } };
    const alarm = { tripped: false };
    Object.assign(dependencies, {
        '../../../lib/logger': logger,
        '../procedureLimits': procedureLimits,
        '../machinePosition': { reliableForMotion },
        '../index': { mcpBroadcast: () => undefined },
        '../positionOfRecord': { bumpGcodeSequence: () => 1, noteDirectGcodeStart: () => undefined, noteDirectGcodeEnd: () => undefined, noteFrameRestored: () => undefined },
        '../diagnostics': { recordGcodeTiming: () => undefined },
        '../registry': { McpToolError: Error },
        '../probeFeed': { probeFeedService: {
            assertNoOvertravel: () => { if (alarm.tripped) { throw new Error('alarm'); } },
            motionBegin: () => undefined,
            motionEnd: () => undefined,
        } },
        './machine': {
            getPositionSnapshot: () => state,
            assertFreshHeartbeat: () => { throw new Error('Refusing home: unreliable heartbeat'); },
        },
        '../../machine/ConnectionManager': { connectionManager: {
            getLatestMachineState: () => state,
            getCurrentChannel: () => ({ executeGcode: async (gcode: string) => { commands.push(gcode); return replies.shift() || { result: 0 }; } }),
        } },
    });
    return { camera: load('../mcp/tools/camera.ts', dependencies), state, commands, alarm, replies };
}

const online = { status: 'online', res: { status: 200, body: { status: 'IDLE', x: 1, y: 2, z: 3, homed: true } } };

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['heartbeat worker rejection and exit propagate, while deliberate cancellation does not look like a crash', async () => {
        for (const reason of ['worker_completed', 'worker_rejected', 'cancelled']) {
            let resolveWorker: () => void = () => undefined;
            let rejectWorker: (error: Error) => void = () => undefined;
            const promise = new Promise<void>((resolve, reject) => { resolveWorker = resolve; rejectWorker = reject; });
            const handle = Object.assign(promise, { cancel: () => rejectWorker(new Error('cancelled token=secret')) });
            const manager = load('../task-manager/workerManager.ts', {
                workerpool: { pool: () => ({ exec: () => handle }) },
                '../../DataStorage': { tmpDir: '/tmp', fontDir: '/tmp' },
            }).default;
            const messages: Array<{ status: string; reason: string }> = [];
            const worker = manager.heartBeat([], (message: { status: string; reason: string }) => messages.push(message));
            if (reason === 'cancelled') { worker.terminate(); } else if (reason === 'worker_completed') { resolveWorker(); } else {
                rejectWorker(new Error('worker failed http://host?token=secret'));
            }
            await Promise.resolve();
            assert.strictEqual(messages.length, reason === 'cancelled' ? 0 : 1);
            if (messages.length) { assert.strictEqual(messages[0].reason, reason); }
            assert(!JSON.stringify(messages).includes('secret'));
        }
    }],
    ['malformed heartbeat is retained as evidence without being labelled authentication-wait', async () => {
        const { channel, workers, diagnostics } = fixture();
        const authStates: boolean[] = [];
        channel.on(events.Connecting, (event: { requireAuth: boolean }) => authStates.push(event.requireAuth));
        await channel.startHeartbeat();
        workers[0].callback({ status: 'poll-start' });
        workers[0].callback({ status: 'online', res: { status: 200, body: {} } });
        assert.strictEqual(channel.getLatestMachineState(), null);
        assert.strictEqual(authStates[0], false);
        assert.strictEqual(typeof diagnostics.snapshot().heartbeat.lastPollStartedAt, 'number');
        workers[0].callback({ status: 'online', res: { status: 204, body: {} } });
        assert.strictEqual(authStates[1], true);
    }],
    ['unexpected heartbeat worker exit clears cached state and retains the reason', async () => {
        const { channel, workers, diagnostics } = fixture();
        await channel.startHeartbeat();
        workers[0].callback(online);
        let disconnected = false;
        channel.on(events.Disconnected, () => { disconnected = true; });
        workers[0].callback({ status: 'worker-exit', reason: 'worker_rejected' });
        assert(disconnected);
        assert.strictEqual(channel.getLatestMachineState(), null);
        assert.strictEqual(diagnostics.snapshot().heartbeat.polling, false);
        assert(diagnostics.snapshot().recent.some(e => e.event === 'heartbeat_worker_exit' && e.reason === 'worker_rejected'));
    }],
    ['a held gcode lease refuses every other caller at the channel and admits only its holder', async () => {
        const { channel, replies, sent, lease, requests } = fixture();
        const id = lease.acquire('the USB pendant (queued jog)', 30000);
        // A UI "go to work origin" inside the pendant's G53 window would be a machine-frame plunge.
        const ui = await channel.executeGcode('G0 X0 Y0\nG0 Z0');
        assert.equal(ui.result, -1);
        assert.match(ui.text, /reserved by the USB pendant/);
        assert.deepEqual(sent, []);
        replies.push({ res: { status: 200, text: 'ok' } });
        const own = await lease.runAs(id, async () => channel.executeGcode('G1 X1 Y1 Z1 F600;') as Promise<{ result: number }>);
        assert.equal(own.result, 0);
        assert.deepEqual(sent, ['G1 X1 Y1 Z1 F600;']);
        assert.equal(lease.status().refused, 1);
        lease.release(id);
        replies.push({ res: { status: 200, text: 'ok' } });
        assert.equal((await channel.executeGcode('G54')).result, 0);
        // The HTTP job and override endpoints are covered too: no request leaves while held.
        const pendant = lease.acquire('the USB pendant (queued jog)', Infinity);
        const emitted: object[] = [];
        channel.socket = { emit: (_event: string, body: object) => { emitted.push(body); } };
        const before = requests.length;
        channel.updateWorkSpeedFactor({ eventName: 'speed', workSpeedValue: 50 });
        channel.startGcode({ eventName: 'start' });
        channel.resumeGcode({ eventName: 'resume' });
        channel.updateLaserPower({ eventName: 'power', laserPower: 10 });
        assert.equal((await channel.startGcodeJob()).ok, false);
        assert.equal(requests.length, before, 'no HTTP request was made');
        assert.equal(emitted.length, 4);
        assert.ok(emitted.every((body) => /reserved by the USB pendant/.test(JSON.stringify(body))));
        lease.release(pendant);
        // A holder that never releases cannot lock the machine out for ever.
        lease.acquire('stuck', 10, 0);
        assert.equal(lease.refusal('M5', 5) !== null, true);
        assert.equal(lease.refusal('M5', 11), null);
        assert.equal(lease.status(11).expired, 1);
    }],
    ['failed commands retain status and timing evidence without leaking error URLs', async () => {
        const { channel, replies, diagnostics } = fixture();
        replies.push({ err: { code: 'ETIMEDOUT', timeout: 3000, message: 'http://host?token=secret' } });
        const result = await channel.executeGcode('M114');
        assert.strictEqual(result.result, -1);
        assert(!result.text.includes('secret'));
        const event = diagnostics.snapshot().recent.find(e => e.event === 'command_response');
        assert.strictEqual(event?.phase, 'M114');
        assert.strictEqual(event?.errorCode, 'ETIMEDOUT');
        assert.strictEqual(event?.timedOut, true);
        assert.strictEqual(typeof event?.durationMs, 'number');
    }],
    ['controller refusal details survive HTTP 400 while tokens and URLs are removed', async () => {
        const { channel, replies } = fixture();
        channel.token = 'secret-session';
        replies.push({ err: { message: 'Bad Request' },
            res: { status: 400,
                text: 'Cannot execute G91: busy. token=secret-session http://host/?token=secret-session' } });
        const result = await channel.executeGcode('G91');
        assert.equal(result.result, -1);
        assert.match(result.text, /400.*Cannot execute G91: busy/);
        assert.ok(!result.text.includes('secret-session'));
        assert.ok(!result.text.includes('http://'));
    }],
    ['HTTP failures propagate and stop a multi-line command, instead of returning success', async () => {
        for (const failure of [
            { err: { message: 'Unauthorized' }, res: { status: 401, text: 'Unauthorized' } },
            { err: { message: 'Timeout', code: 'ETIMEDOUT' } },
            { res: { status: 500, text: 'Internal error' } },
        ]) {
            const { channel, replies, sent } = fixture();
            replies.push(failure);
            const result = await channel.executeGcode('G53\nG28\nG54');
            assert.strictEqual(result.result, -1);
            assert(result.text.includes('Controller request failed'));
            assert.deepStrictEqual(sent, ['G53']);
        }
    }],
    ['successful controller text is retained for M114 and M503 S', async () => {
        const { channel, replies } = fixture();
        replies.push({ res: { status: 200, text: 'X:1 Y:2 Z:3' } }, { res: { status: 200, text: 'configuration' } });
        const result = await channel.executeGcode('M114\nM503 S');
        assert.strictEqual(result.result, 0);
        assert.strictEqual(result.text, 'X:1 Y:2 Z:3\nconfiguration');
    }],
    ['opening a client preserves polling; offline clears position and emits a server disconnect', async () => {
        const { channel, workers } = fixture();
        await channel.startHeartbeat();
        workers[0].callback(online);
        assert(channel.getLatestMachineState());
        channel.onConnection();
        assert.strictEqual(workers[0].terminated, false);
        let disconnected = 0;
        channel.on(events.Disconnected, () => { disconnected++; });
        workers[0].callback({ status: 'offline', msg: 'Timeout' });
        assert.strictEqual(workers[0].terminated, true);
        assert.strictEqual(channel.getLatestMachineState(), null);
        assert.strictEqual(disconnected, 1);
        workers[0].callback(online);
        assert.strictEqual(channel.getLatestMachineState(), null);
        await channel.startHeartbeat();
        workers[0].callback(online);
        assert.strictEqual(channel.getLatestMachineState(), null);
        workers[1].callback(online);
        assert(channel.getLatestMachineState());
    }],
    ['reconnect cancels queued commands and cannot send the tail of an old batch', async () => {
        const { channel } = fixture();
        let finish: (value: { code: number; text: string }) => void = () => assert.fail('No pending request');
        const sent: string[] = [];
        channel._executeGcode = async (command: string) => {
            sent.push(command);
            return new Promise<{ code: number; text: string }>(resolve => { finish = resolve; });
        };
        const active = channel.executeGcode('G53\nG28');
        const queued = channel.executeGcode('G54');
        channel.init();
        assert.strictEqual((await queued).result, -1);
        finish({ code: 200, text: 'ok' });
        assert.strictEqual((await active).result, -1);
        assert.deepStrictEqual(sent, ['G53']);
    }],
    ['blank or invalid tokens never start automatic pairing, or overwrite an existing session', async () => {
        const { channel, requests, replies, diagnostics } = fixture();
        channel.host = 'http://existing';
        channel.token = 'saved';
        const errors: string[] = [];
        channel.socket.on('connection:open', (result: { msg: string }) => errors.push(result.msg));
        for (const token of ['', '   ']) {
            assert.strictEqual(await channel.connectionOpen({ host: 'http://new', token }), false);
        }
        assert.strictEqual(requests.length, 0);
        replies.push({ err: { message: 'Unauthorized token=secret' }, res: { status: 401 } });
        assert.strictEqual(await channel.connectionOpen({ host: 'http://new', token: 'expired', attemptId: 'new-attempt' }), false);
        assert.deepStrictEqual(requests, [{ method: 'GET', url: 'http://new/api/v1/status' }]);
        assert.strictEqual(channel.host, 'http://existing');
        assert.strictEqual(channel.token, 'saved');
        assert(diagnostics.snapshot().recent.some(e => e.event === 'session_check_response' && e.attemptId === 'new-attempt'));
        assert(errors.every(error => !error.includes('secret')));
    }],
    ['retained-session recovery uses GET only and refuses missing, expired and pending-pairing sessions', async () => {
        const { channel, replies, requests } = fixture();
        await assert.rejects(channel.verifyExistingSession(), /No existing HTTP machine session/);
        assert.strictEqual(requests.length, 0);
        channel.host = 'http://existing';
        channel.token = 'saved';
        channel.state.series = 'Snapmaker 2.0 A350';
        for (const res of [{ status: 401 }, { status: 204, body: {} }, { status: 200, body: {} }]) {
            replies.push({ res });
            await assert.rejects(channel.verifyExistingSession(), /No pairing was attempted/);
        }
        replies.push({ res: online.res });
        await channel.verifyExistingSession();
        assert(requests.every(req => req.method === 'GET' && req.url.endsWith('/api/v1/status')));
    }],
    ['homing override is stale-only: default, incoherence, running spindle, busy state and alarm still refuse', async () => {
        const { camera, state, commands, alarm } = cameraFixture();
        await assert.rejects(camera.homeMachine('home'), /unreliable heartbeat/);
        assert.strictEqual(commands.length, 0);
        const result = await camera.homeMachine('home', false, true);
        assert.strictEqual(result.position_verified, false);
        assert.deepStrictEqual(commands, ['G53;\nG28;\nG54;']);
        state.reliability = 'awaiting-resync';
        await assert.rejects(camera.homeMachine('home', false, true), /unreliable heartbeat/);
        state.reliability = 'stale';
        state.headPower = 100;
        await assert.rejects(camera.homeMachine('home', false, true), /Toolhead appears to be on/);
        state.headPower = 0;
        state.machineStatus = 'running';
        await assert.rejects(camera.homeMachine('home', false, true), /not idle/);
        state.machineStatus = 'idle';
        alarm.tripped = true;
        await assert.rejects(camera.homeMachine('home', false, true), /alarm/);
        assert.strictEqual(commands.length, 1);
    }],
    ['fresh M114 does not combine its work coordinates with a stale heartbeat offset', async () => {
        const { camera, commands, replies } = cameraFixture();
        const tools = new Map();
        camera.registerCameraTools({ register: (tool: { name: string }) => tools.set(tool.name, tool) });
        replies.push({ result: 0, text: 'X:1 Y:2 Z:3' });
        const result = await tools.get('query_firmware_position').handler({});
        assert.strictEqual(result.firmware_work.x, 1);
        assert.strictEqual(result.derived_machine, null);
        assert.deepStrictEqual(commands, ['M114']);
    }],
    ['M503 S exposes current configuration text and rejects empty, bare ok and transport failures', async () => {
        const { camera, commands, replies } = cameraFixture();
        const tools = new Map();
        camera.registerCameraTools({ register: (tool: { name: string }) => tools.set(tool.name, tool) });
        const query = tools.get('query_firmware_configuration').handler;
        for (const reply of [{ result: 0 }, { result: 0, text: 'ok' }, { result: -1, text: 'Unauthorized' }]) {
            replies.push(reply);
            await assert.rejects(query({}), /No fresh machine data/);
        }
        replies.push({ result: 0, text: 'M92 X80 Y80 Z400' });
        const result = await query({});
        assert.strictEqual(result.raw, 'M92 X80 Y80 Z400');
        assert(commands.every(command => command === 'M503 S'));
    }],
    ['disconnect clears server state; authenticated recovery restores polling without pairing', async () => {
        const { channel, replies, requests, workers, diagnosticModule } = fixture();
        const source = fs.readFileSync(path.join(__dirname, '../../machine/ConnectionManager.ts'), 'utf8');
        const dependencies = stubImports(source);
        let closed = 0;
        let stopped = 0;
        Object.assign(dependencies, {
            '../../../lib/logger': logger,
            '../../lib/logger': logger,
            './connectionDiagnostics': diagnosticModule,
            './connectionDiagnosticState': { safeIdentifier, safeTarget },
            './types': { ConnectionType: { WiFi: 'wifi' } },
            './ProtocolDetector': { NetworkProtocol: { Unknown: 'Unknown', HTTP: 'HTTP' }, SerialPortProtocol: {} },
            './channels/ChannelEvent': { ChannelEvent: events },
            './channels/SstpHttpChannel': { sstpHttpChannel: channel },
            './adaptor/Octo': { octo: { onStop: () => { stopped++; }, onStart: () => undefined } },
        });
        const manager = load('ConnectionManager.ts', dependencies).connectionManager;
        manager.channel = channel;
        manager.machineIdentifier = 'Snapmaker 2.0 A350';
        manager.machineInstance = { onClosed: async () => { closed++; } };
        manager.onChannelReady = async () => {
            manager.machineInstance = { onClosed: async () => undefined };
            await channel.startHeartbeat();
        };
        manager.bindChannelEvents();
        assert.strictEqual(manager.getConnectionStatus().connected, true);
        let receipt: { attemptId: string; instanceId: string } | undefined;
        await manager.connectionOpen({ emit: () => undefined }, {
            connectionType: 'wifi', protocol: 'HTTP', token: '', attemptId: 'ui-attempt',
        }, (value: { attemptId: string; instanceId: string }) => { receipt = value; });
        assert.strictEqual(receipt?.attemptId, 'ui-attempt');
        assert.strictEqual(receipt?.instanceId, 'test');
        assert(diagnosticModule.connectionDiagnostics.snapshot().recent.some(e => e.event === 'connection_refused' && e.attemptId === 'ui-attempt'));
        channel.emit(events.Disconnected);
        assert.strictEqual(manager.getConnectionStatus().connected, false);
        assert.strictEqual(manager.getConnectionStatus().machineReady, false);
        assert.strictEqual(manager.getCurrentChannel(), null);
        assert.strictEqual(closed, 1);
        assert.strictEqual(stopped, 1);
        await assert.rejects(manager.recoverMachineConnection(), /No existing HTTP machine session/);
        assert.strictEqual(manager.getConnectionStatus().connected, false);
        assert(diagnosticModule.connectionDiagnostics.snapshot().captures.some(c => c.reason === 'before_existing_session_recovery'));
        channel.host = 'http://existing';
        channel.token = 'saved';
        channel.state.series = 'Snapmaker 2.0 A350';
        replies.push({ res: { status: 401 } });
        await assert.rejects(manager.recoverMachineConnection(), /No pairing was attempted/);
        assert.strictEqual(manager.getConnectionStatus().connected, false);
        replies.push({ res: online.res });
        await manager.recoverMachineConnection();
        assert.strictEqual(manager.getConnectionStatus().connected, true);
        workers[0].callback(online);
        assert(manager.getLatestMachineState());
        assert(requests.every(req => req.method === 'GET'));
    }],
];
