// A SACP channel (the Ray over SACP-UDP, #260) publishes the heartbeat and
// coordinate subscriptions it already runs for the Luban UI as
// getLatestMachineState(), ConnectionManager hands that to the MCP, and the
// connection diagnostics see a worker and beats. Inert: fake transport and
// SACP client, captured timers, nothing reaches a machine.
import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import { ConnectionDiagnosticState } from '../../machine/connectionDiagnosticState';
import * as sacpMachineState from '../../machine/channels/sacpMachineState';
import { GcodeLease } from '../../machine/gcodeLease';
import * as positionOfRecord from '../positionOfRecord';

type Exports = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MACHINE_DIR = path.join(__dirname, '../../machine');

function stubImports(source: string): Record<string, unknown> {
    const dependencies: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
        dependencies[match[1]] = {};
    }
    return dependencies;
}

interface Timers { pending: Array<{ fn: () => void; ms: number }> }

function load(file: string, overrides: Record<string, unknown>, timers: Timers): Exports {
    const source = fs.readFileSync(path.join(MACHINE_DIR, file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    } });
    const dependencies = { ...stubImports(source), ...overrides };
    const exports = {} as Exports;
    vm.runInNewContext(compiled.outputText, {
        exports,
        Date,
        Promise,
        Buffer,
        setTimeout: (fn: () => void, ms: number) => { timers.pending.push({ fn, ms }); return timers.pending.length; },
        clearTimeout: () => undefined,
        setInterval: () => 0,
        clearInterval: () => undefined,
        process: { env: { NODE_ENV: 'test' } },
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return dependencies[name];
        },
    });
    return exports;
}

const logger = () => ({ info: () => undefined, warn: () => undefined, debug: () => undefined, error: () => undefined });
const events = { Connecting: 'connecting', Connected: 'connected', Ready: 'ready', Disconnected: 'disconnected', ErrorReport: 'error-report' };

class Channel extends EventEmitter {
    public socket = new EventEmitter();

    public getLatestMachineState() { return null; }
}

/** The subscriptions startHeartbeatLegacy opens, with the two the test drives captured. */
class FakeSacpClient {
    public static heartbeat: ((data: object) => void) | null = null;

    public static coordinates: ((data: object) => void) | null = null;

    public static homeRequests = 0;

    public static homeResult = 0;

    public read(): void { /* parsed, never a session change */ }

    public dispose(): void { /* nothing to free */ }

    public setLogger(): void { /* silent */ }

    public async getMachineInfo() { return { data: { type: 0 } }; }

    public async getModuleInfo() { return { data: [] }; }

    public async logFeedbackLevel() { return { response: { result: 1 } }; } // never subscribes the log

    public setHandler(): void { /* homed notification handler kept by the channel */ }

    public async ack() { return undefined; }

    public async subscribeHeartbeat(_opts: object, callback: (data: object) => void) {
        FakeSacpClient.heartbeat = callback;
        return { code: 0 };
    }

    public async unsubscribeHeartbeat() { return { code: 0 }; }

    public async subscribeCurrentCoordinateInfo(_opts: object, callback: (data: object) => void) {
        FakeSacpClient.coordinates = callback;
        return { response: { result: 0 } };
    }

    public async subscribeHotBedTemperature() { return 0; }

    public async subscribeNozzleInfo() { return 0; }

    public async subscribeCncSpeedState() { return 0; }

    public async subscribeLaserPowerState() { return 0; }

    public async subscribeGetPrintCurrentLineNumber() { return 0; }

    public async subscribeGetPrintingTime() { return 0; }

    public async subscribeEnclosureInfo() { return { response: { result: 0 } }; }

    public async subscribeEnclosureLightInfo() { return { response: { result: 0 } }; }

    public async subscribePurifierInfo() { return { response: { result: 0 } }; }

    public async requestHome() {
        FakeSacpClient.homeRequests += 1;
        return { response: { result: FakeSacpClient.homeResult } };
    }
}

class FakeUdpSocket extends EventEmitter {
    public bind(): void { /* no port is bound */ }
}

/** The SDK model as the channel uses it: the test hands the report object itself as `response.data`. */
class FakeCoordinateSystemInfo {
    public homed = 1;

    public coordinates: Array<{ key: number; value: number }> = [];

    public originOffset: Array<{ key: number; value: number }> = [];

    public fromBuffer(report: { homed: number; coordinates: unknown[]; originOffset: unknown[] }) {
        Object.assign(this, report);
        return this;
    }
}

function diagnostics() {
    return new ConnectionDiagnosticState({ instanceId: 'test', pid: 1, startedAt: 0, version: 'test', build: 'test' }, () => undefined);
}

function udpChannel(diag: ConnectionDiagnosticState) {
    const timers: Timers = { pending: [] };
    const base = load('channels/SacpChannel.ts', {
        '@snapmaker/luban-platform': { WorkflowStatus: { Idle: 'idle', Unknown: 'unknown', Starting: 'starting', Running: 'running', Paused: 'paused' } },
        '@snapmaker/snapmaker-sacp-sdk/dist/helper': {
            readUint8: (buffer: Buffer, index: number) => buffer[index], readString: () => ({ result: '' }), readUint16: () => 0, readUint32: () => 0,
        },
        '@snapmaker/snapmaker-sacp-sdk/dist/models': { CoordinateSystemInfo: FakeCoordinateSystemInfo },
        '../../../../app/constants': { WORKFLOW_STATUS_MAP: { 0: 'idle', 1: 'running' }, HEAD_PRINTING: 'printing', HEAD_LASER: 'laser', HEAD_CNC: 'cnc' },
        '../../../../app/constants/machines': { MODULEID_MAP: {}, MODULEID_TOOLHEAD_MAP: { 0: 'extruder' } },
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value), find: () => undefined },
        '../../../lib/logger': logger,
        '../sacp/SacpClient': FakeSacpClient,
        '../connectionDiagnostics': { connectionDiagnostics: diag },
        './sacpMachineState': sacpMachineState,
        './Channel': Channel,
        './ChannelEvent': { ChannelEvent: events },
    }, timers);
    const module = load('channels/SacpUdpChannel.ts', {
        dgram: { createSocket: () => new FakeUdpSocket() },
        '../../../lib/logger': logger,
        '../sacp/SacpClient': FakeSacpClient,
        './ChannelEvent': { ChannelEvent: events },
        './SacpChannel': base,
        './Channel': {},
        '../../../../app/constants/machines': { SACP_TYPE_SERIES_MAP: {} },
        '../gcodeLease': { gcodeLease: new GcodeLease() },
    }, timers);
    const UdpChannel = module.default;
    const channel = new UdpChannel();
    channel.socket = new EventEmitter();
    return { channel, timers };
}

function connectionManager(channel: object, diag: ConnectionDiagnosticState) {
    const timers: Timers = { pending: [] };
    const module = load('ConnectionManager.ts', {
        '../../lib/logger': logger,
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
        './gcodeLease': { gcodeLease: new GcodeLease() },
        '../mcp/positionOfRecord': positionOfRecord,
        './connectionDiagnostics': { connectionDiagnostics: diag, diagnosticId: () => 'diagnostic-id' },
        '../../constants': { HEAD_CNC: 'cnc', HEAD_LASER: 'laser', HEAD_PRINTING: 'printing' },
        './ProtocolDetector': { NetworkProtocol: { HTTP: 'HTTP', SacpOverTCP: 'SACP-TCP', SacpOverUDP: 'SACP-UDP', Unknown: 'Unknown' },
            SerialPortProtocol: { SacpOverSerialPort: 'SACP-Serial', PlainText: 'text' } },
        './types': { ConnectionType: { WiFi: 'wifi', Serial: 'serial' } },
    }, timers);
    const cm = module.connectionManager;
    cm.channel = channel;
    cm.protocol = 'SACP-UDP';
    cm.connectionType = 'wifi';
    return cm;
}

const X = sacpMachineState.SACP_AXIS_KEY.x;
const Y = sacpMachineState.SACP_AXIS_KEY.y;

/** A Ray coordinate report: X/Y only, work origin at machine zero, homed. */
function rayReport(x: number, y: number, homed = 0) {
    const coordinates = [{ key: X, value: x }, { key: Y, value: y }];
    const originOffset = [{ key: X, value: 0 }, { key: Y, value: 0 }];
    return { response: { data: { homed, coordinates, originOffset } } };
}

const beat = (status: number) => ({ response: { data: Buffer.from([status]) } });

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['SACP-UDP (Ray, firmware > 1.6.8): the legacy heartbeat + coordinate subscriptions become getLatestMachineState()', async () => {
        const diag = diagnostics();
        const { channel } = udpChannel(diag);
        await channel.connectionOpen({ address: '192.0.2.9' });
        assert.strictEqual(channel.getLatestMachineState(), null, 'nothing before the first beat');
        assert.strictEqual(diag.snapshot().heartbeat.polling, false);

        await channel.startHeartbeatLegacy(channel.sacpClient, undefined, 'ray-id');
        assert.strictEqual(diag.snapshot().heartbeat.polling, true, 'subscribing is the worker starting');
        assert.ok(diag.snapshot().recent.some((e) => e.event === 'heartbeat_worker_started'));
        assert.ok(FakeSacpClient.heartbeat && FakeSacpClient.coordinates, 'both subscriptions opened');

        const before = Date.now();
        (FakeSacpClient.heartbeat as (d: object) => void)(beat(0));
        const afterBeat = channel.getLatestMachineState();
        assert.ok(afterBeat, 'a heartbeat alone publishes state');
        assert.strictEqual(afterBeat.status, 'idle');
        assert.ok(afterBeat.timestamp >= before);
        assert.strictEqual(afterBeat.pos, undefined, 'no position until the coordinate report');
        assert.ok(diag.snapshot().recent.some((e) => e.event === 'first_heartbeat'), 'the beat is counted as an accepted report');
        assert.strictEqual(diag.snapshot().heartbeat.lastReportAt !== null, true);

        (FakeSacpClient.coordinates as (d: object) => void)(rayReport(-1, 399));
        const state = channel.getLatestMachineState();
        assert.deepStrictEqual(state.pos, { x: -1, y: 399, z: 0, b: null, isFourAxis: false });
        assert.deepStrictEqual(state.originOffset, { x: 0, y: 0, z: 0, b: null });
        assert.strictEqual(state.isHomed, true);
        assert.strictEqual(state.status, 'idle');
        assert.deepStrictEqual(state.reportedAxes, ['x', 'y']);

        (FakeSacpClient.heartbeat as (d: object) => void)(beat(1));
        assert.strictEqual(channel.getLatestMachineState().status, 'running');
        assert.deepStrictEqual(channel.getLatestMachineState().pos, state.pos, 'the heartbeat keeps the position');

        await channel.stopHeartbeat('ray-id');
        assert.strictEqual(channel.getLatestMachineState(), null, 'stop clears the state');
        assert.strictEqual(diag.snapshot().heartbeat.polling, false);
        assert.ok(diag.snapshot().recent.some((e) => e.event === 'heartbeat_worker_stopped' && e.reason === 'heartbeat_stop'));
    }],

    ['a lost heartbeat or a new transport session clears the state, so the MCP reads null again', async () => {
        const diag = diagnostics();
        const { channel, timers } = udpChannel(diag);
        await channel.connectionOpen({ address: '192.0.2.9' });
        await channel.startHeartbeatLegacy(channel.sacpClient, undefined, 'ray-id');
        timers.pending.length = 0;
        (FakeSacpClient.heartbeat as (d: object) => void)(beat(0));
        (FakeSacpClient.coordinates as (d: object) => void)(rayReport(-1, 399));
        assert.ok(channel.getLatestMachineState());
        const watchdog = timers.pending.filter((timer) => timer.ms === 10000).pop();
        assert.ok(watchdog, 'the beat armed the 10 s watchdog');
        watchdog.fn();
        assert.strictEqual(channel.getLatestMachineState(), null, 'heartbeat loss');
        assert.ok(diag.snapshot().recent.some((e) => e.event === 'heartbeat_worker_stopped' && e.reason === 'heartbeat_lost'));

        (FakeSacpClient.heartbeat as (d: object) => void)(beat(0));
        assert.ok(channel.getLatestMachineState(), 'a late beat is state again (the session object is the same)');
        await channel.connectionOpen({ address: '192.0.2.9' }); // a new SACP session on the same singleton
        assert.strictEqual(channel.getLatestMachineState(), null, 'a new session starts with no state');
    }],

    ['the pre-1.6.8 startHeartbeat path publishes status only and registers with diagnostics', async () => {
        const diag = diagnostics();
        const { channel } = udpChannel(diag);
        await channel.connectionOpen({ address: '192.0.2.9' });
        await channel.startHeartbeat();
        assert.strictEqual(diag.snapshot().heartbeat.polling, true);
        (FakeSacpClient.heartbeat as (d: object) => void)(beat(0));
        const state = channel.getLatestMachineState();
        assert.strictEqual(state.status, 'idle');
        assert.strictEqual(state.pos, undefined, 'no coordinate subscription on this path: position honestly unknown');
    }],

    ['ConnectionManager hands the SACP state to the MCP unchanged and knows the channel speaks SACP', async () => {
        const diag = diagnostics();
        const { channel } = udpChannel(diag);
        await channel.connectionOpen({ address: '192.0.2.9' });
        const cm = connectionManager(channel, diag);
        assert.strictEqual(cm.getLatestMachineState(), null);
        assert.strictEqual(cm.isSacpChannel(), true);
        await channel.startHeartbeatLegacy(channel.sacpClient, undefined, 'ray-id');
        (FakeSacpClient.heartbeat as (d: object) => void)(beat(0));
        (FakeSacpClient.coordinates as (d: object) => void)(rayReport(-1, 399));
        const state = cm.getLatestMachineState();
        assert.strictEqual(state, channel.getLatestMachineState(), 'the very object the channel keeps');
        assert.deepStrictEqual(state.pos, { x: -1, y: 399, z: 0, b: null, isFourAxis: false });
        assert.strictEqual(typeof state.timestamp, 'number');
        // The HTTP-only recovery says why it refuses here.
        await assert.rejects(cm.recoverMachineConnection(), /speaks SACP.*reconnect the machine through Luban/);
        cm.protocol = 'HTTP';
        assert.strictEqual(cm.isSacpChannel(), false);
        cm.channel = null;
        assert.strictEqual(cm.getLatestMachineState(), null);
        assert.strictEqual(cm.isSacpChannel(), false);
    }],

    ['the UDP channel\'s own home reports the controller\'s acceptance', async () => {
        const diag = diagnostics();
        const { channel } = udpChannel(diag);
        await channel.connectionOpen({ address: '192.0.2.9' });
        FakeSacpClient.homeRequests = 0;
        FakeSacpClient.homeResult = 0;
        assert.strictEqual(await channel.goHome(), true);
        FakeSacpClient.homeResult = 2;
        assert.strictEqual(await channel.goHome(), false);
        assert.strictEqual(FakeSacpClient.homeRequests, 2);
    }],
];
