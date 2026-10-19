// Connection-layer follow-ups to WPC (#265): a Snapmaker 2.0 over SACP-TCP
// reports its model and serial number without a Ready (Luban prepares no
// instance for it there), and an unplugged text-serial port reports
// Disconnected, so ConnectionManager clears the identity and bumps the
// generation. Inert: fake sockets, SACP client and MarlinController,
// captured timers, nothing reaches a machine.
import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import { ConnectionDiagnosticState } from '../../machine/connectionDiagnosticState';
import * as sacpMachineState from '../../machine/channels/sacpMachineState';
import * as textSerialMachineState from '../../machine/channels/textSerialMachineState';
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

/** Captured timers: nothing runs unless a test fires it. */
interface Timers { pending: Array<{ fn: () => unknown; ms: number }> }

function load(file: string, overrides: Record<string, unknown>, timers: Timers = { pending: [] }): Exports {
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
        setTimeout: (fn: () => unknown, ms: number) => { timers.pending.push({ fn, ms }); return timers.pending.length; },
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
const MACHINES = {
    SnapmakerA150Machine: { identifier: 'A150' },
    SnapmakerA250Machine: { identifier: 'A250' },
    SnapmakerA350Machine: { identifier: 'A350' },
    SnapmakerArtisanMachine: { identifier: 'Artisan' },
    SnapmakerJ1Machine: { identifier: 'J1' },
    SnapmakerRayMachine: { identifier: 'Ray' },
};
const SERIES = { 0: 'A150', 1: 'A250', 2: 'A350', 3: 'Artisan', 4: 'J1', 5: 'Ray' };

class Channel extends EventEmitter {
    public socket = new EventEmitter();
}

/** The SACP calls SacpTcpChannel.connectionOpen makes, answering as the test sets. */
class FakeSacpClient {
    public static machineType = 2;

    public static serialNumber: unknown = 20481234;

    public read(): void { /* parsed, never a session change */ }

    public dispose(): void { /* nothing to free */ }

    public setLogger(): void { /* silent */ }

    public async wifiConnection() { return { response: { result: 0 } }; }

    public wifiConnectionHeartBeat(): void { /* keep-alive, not a machine heartbeat */ }

    public async wifiConnectionClose() { return { response: { result: 0 } }; }

    public async getMachineInfo() {
        return { data: { type: FakeSacpClient.machineType, masterControlSerialNumber: FakeSacpClient.serialNumber } };
    }

    public async getModuleInfo() { return { data: [] }; }
}

class FakeTcpSocket extends EventEmitter {
    public destroyed = false;

    public connect(_opts: object, onConnect: () => void): void {
        this.destroyed = false;
        onConnect();
    }

    public destroy(): void { this.destroyed = true; }
}

function diagnostics() {
    return new ConnectionDiagnosticState({ instanceId: 'test', pid: 1, startedAt: 0, version: 'test', build: 'test' }, () => undefined);
}

function tcpChannel() {
    const timers: Timers = { pending: [] };
    const socket = { last: null as FakeTcpSocket | null };
    const base = load('channels/SacpChannel.ts', {
        '@snapmaker/luban-platform': { WorkflowStatus: { Idle: 'idle', Unknown: 'unknown', Starting: 'starting', Running: 'running' } },
        '@snapmaker/snapmaker-sacp-sdk/dist/helper': { readUint8: () => 0, readString: () => ({ result: '' }), readUint16: () => 0, readUint32: () => 0 },
        '../../../../app/constants': { WORKFLOW_STATUS_MAP: { 0: 'idle' } },
        '../../../../app/constants/machines': { MODULEID_MAP: {}, MODULEID_TOOLHEAD_MAP: {} },
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value), find: () => undefined },
        '../../../lib/logger': logger,
        '../sacp/SacpClient': FakeSacpClient,
        '../connectionDiagnostics': { connectionDiagnostics: diagnostics() },
        './sacpMachineState': sacpMachineState,
        './Channel': Channel,
        './ChannelEvent': { ChannelEvent: events },
    }, timers);
    const module = load('channels/SacpTcpChannel.ts', {
        net: { Socket: class extends FakeTcpSocket { public constructor() { super(); socket.last = this; } } },
        os: { hostname: () => 'test-host' },
        '../../../lib/logger': logger,
        '../sacp/SacpClient': FakeSacpClient,
        './ChannelEvent': { ChannelEvent: events },
        './SacpChannel': base,
        '../../../../app/constants/machines': { SACP_TYPE_SERIES_MAP: SERIES },
        '../../../../app/machines': MACHINES,
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
    }, timers);
    const ChannelClass = module.default;
    const channel = new ChannelClass();
    channel.socket = new EventEmitter();
    /** connectionOpen with its 200 ms authentication timer fired. */
    const open = async () => {
        const opened = channel.connectionOpen({ address: '192.0.2.5' });
        const auth = timers.pending.filter((timer) => timer.ms === 200).pop();
        timers.pending.length = 0;
        assert.ok(auth, 'the authentication timer was captured');
        await auth.fn();
        return opened;
    };
    return { channel, open, tcp: () => socket.last as FakeTcpSocket };
}

/** The SM2Instance a text-serial Ready prepares: no heartbeat, nothing sent. */
class FakeInstance {
    public setChannel(): void { /* kept by the real instance */ }

    public setSocket(): void { /* kept by the real instance */ }

    public async onPrepare() { /* no heartbeat */ }

    public async onClosing() { /* nothing to stop */ }

    public async onClosed() { /* nothing to free */ }
}

function connectionManager(channelStubs: Record<string, unknown>) {
    const diag = diagnostics();
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
        './adaptor/Octo': { octo: { onStart: () => undefined, onStop: () => undefined } },
        './channels/ChannelEvent': { ChannelEvent: events },
        './instances': { SM2Instance: FakeInstance },
        '../../../app/machines': MACHINES,
        ...channelStubs,
    });
    return module.connectionManager;
}

/** MarlinController as TextSerialChannel sees it, with lib/SerialConnection's close and error events on `serialport`. */
class FakeSerialConnection extends EventEmitter {
    public port: { isOpen: boolean } | null = { isOpen: true };

    public get isOpen(): boolean { return !!this.port && this.port.isOpen; }
}

class FakeMarlinController extends EventEmitter {
    public static created: FakeMarlinController[] = [];

    public serialport: FakeSerialConnection | null = null;

    public state = { headType: 'cnc' };

    public closes = 0;

    public destroyed = false;

    public constructor() {
        super();
        FakeMarlinController.created.push(this);
    }

    public addConnection(): void { /* socket joined */ }

    public isOpen(): boolean { return !!this.serialport && this.serialport.isOpen; }

    public open(callback: (err?: Error | null) => void): void {
        if (this.destroyed) {
            throw new Error('a destroyed MarlinController cannot reopen (workflow is null)');
        }
        const port = new FakeSerialConnection();
        // MarlinController's own listeners, registered before the port opens: 'close' -> close() -> destroy().
        port.on('close', () => this.close());
        port.on('error', () => undefined);
        this.serialport = port;
        callback(null);
    }

    public close(): void {
        this.closes += 1;
        if (this.serialport && this.serialport.isOpen) {
            // SerialConnection.close drops its port listeners first: a clean close emits no 'close'.
            this.serialport.port = null;
        }
        this.destroy();
    }

    public destroy(): void {
        this.serialport = null;
        this.destroyed = true;
    }

    public writeln(): void { /* nothing written */ }
}

function textChannel() {
    const module = load('channels/TextSerialChannel.ts', {
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
        '../../../controllers': { MarlinController: FakeMarlinController },
        '../../../controllers/constants': { PROTOCOL_TEXT: 'text' },
        '../../../lib/logger': logger,
        './Channel': Channel,
        './ChannelEvent': { ChannelEvent: events },
        '../../../constants': { HEAD_LASER: 'laser' },
        '../gcodeLease': { gcodeLease: new GcodeLease() },
        './textSerialMachineState': textSerialMachineState,
    });
    const ChannelClass = module.default;
    const channel = new ChannelClass();
    channel.socket = new EventEmitter();
    const manager = connectionManager({ './channels/TextSerialChannel': { textSerialChannel: channel } });
    const uiEvents: string[] = [];
    manager.socket = { emit: (name: string) => { uiEvents.push(name); } };
    const disconnects: number[] = [];
    channel.on(events.Disconnected, () => disconnects.push(1));
    /** Open the port the way ConnectionManager.connectionOpen does for text serial, then identify it. */
    const open = async () => {
        manager.channel = channel;
        manager.channelAssignments += 1;
        manager.protocol = 'text';
        manager.connectionType = 'serial';
        manager.bindChannelEvents();
        assert.strictEqual(await channel.connectionOpen({ port: 'COM3' }), true);
        channel.getController().emit('Ready', { machineIdentifier: 'A350' });
    };
    return { channel, manager, uiEvents, disconnects, open };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['SACP-TCP: an A350 reports machineIdentifier and deviceSerial with no Ready (machineReady false), stable across reconnects', async () => {
        const { channel, open, tcp } = tcpChannel();
        const manager = connectionManager({ './channels/SacpTcpChannel': { sacpTcpChannel: channel } });
        manager.channel = channel;
        manager.protocol = 'SACP-TCP';
        manager.bindChannelEvents();
        const ready: unknown[] = [];
        channel.on(events.Ready, (data: unknown) => ready.push(data));
        FakeSacpClient.machineType = 2;
        FakeSacpClient.serialNumber = 20481234;

        assert.strictEqual(manager.getConnectionStatus().deviceSerial, null, 'nothing before getMachineInfo');
        assert.strictEqual(await open(), true);
        assert.strictEqual(ready.length, 0, 'still no Ready for the A350: no SM2Instance, no heartbeat');
        let status = manager.getConnectionStatus();
        assert.strictEqual(status.channelName, 'sacp-tcp');
        assert.strictEqual(status.machineIdentifier, 'A350');
        assert.strictEqual(status.deviceSerial, '20481234');
        assert.strictEqual(status.machineReady, false, 'no instance prepared it');
        assert.strictEqual(status.host, null);
        assert.ok(!JSON.stringify(status).includes('token'));

        // The socket drops: the identity goes with it (ConnectionManager never sees a Disconnected here).
        tcp().emit('close');
        status = manager.getConnectionStatus();
        assert.strictEqual(status.deviceSerial, null, 'cleared by the socket close');
        assert.strictEqual(status.machineIdentifier, null);

        assert.strictEqual(await open(), true);
        assert.strictEqual(manager.getConnectionStatus().deviceSerial, '20481234', 'the same serial on reconnect');
        tcp().emit('error', new Error('ECONNRESET'));
        assert.strictEqual(manager.getConnectionStatus().deviceSerial, null, 'cleared by a socket error');

        assert.strictEqual(await open(), true);
        await channel.connectionClose({ force: true });
        assert.strictEqual(channel.getIdentifiedWithoutReady(), null, 'cleared by a close');

        // A controller reporting no serial: the model alone.
        FakeSacpClient.serialNumber = 0;
        assert.strictEqual(await open(), true);
        assert.deepStrictEqual({ ...channel.getIdentifiedWithoutReady() }, { machineIdentifier: 'A350', deviceSerial: null });

        // Another channel (or none) never reads the TCP identity.
        manager.channel = null;
        assert.strictEqual(manager.getConnectionStatus().machineIdentifier, null);
        FakeSacpClient.serialNumber = 20481234;
    }],

    ['SACP-TCP: Artisan and J1 keep their Ready, and a Ready identity wins over the fallback', async () => {
        const { channel, open } = tcpChannel();
        const manager = connectionManager({ './channels/SacpTcpChannel': { sacpTcpChannel: channel } });
        manager.channel = channel;
        manager.protocol = 'SACP-TCP';
        const ready: Array<{ machineIdentifier?: string; deviceSerial?: unknown }> = [];
        channel.on(events.Ready, (data: { machineIdentifier?: string }) => ready.push(data));
        for (const [type, identifier] of [[3, 'Artisan'], [4, 'J1']] as Array<[number, string]>) {
            ready.length = 0;
            FakeSacpClient.machineType = type;
            assert.strictEqual(await open(), true);
            assert.strictEqual(ready.length, 1, `${identifier} still gets its Ready`);
            assert.strictEqual(ready[0].machineIdentifier, identifier);
            assert.strictEqual(ready[0].deviceSerial, '20481234');
            assert.strictEqual(channel.getIdentifiedWithoutReady(), null, `${identifier} is not a fallback identity`);
        }
        // Were both present, ConnectionManager's own (Ready) identity is the one reported.
        FakeSacpClient.machineType = 2;
        assert.strictEqual(await open(), true);
        manager.machineIdentifier = 'Artisan';
        manager.deviceSerial = '777';
        assert.strictEqual(manager.getConnectionStatus().deviceSerial, '777');
        assert.strictEqual(manager.getConnectionStatus().machineIdentifier, 'Artisan');
    }],

    ['text serial: an unplug (port close) reports Disconnected; status cleared, generation bumped, UI told', async () => {
        FakeMarlinController.created.length = 0;
        const { channel, manager, uiEvents, disconnects, open } = textChannel();
        await open();
        let status = manager.getConnectionStatus();
        assert.strictEqual(status.connected, true);
        assert.strictEqual(status.channelName, 'text-serial');
        assert.strictEqual(status.machineIdentifier, 'A350');
        const generation = manager.getConnectionGeneration();
        const session = manager.getJudgeConnectionContext().session;
        assert.strictEqual(session, generation);
        const channelGeneration = channel.getConnectionGeneration();

        const controller = channel.getController() as FakeMarlinController;
        const port = controller.serialport as FakeSerialConnection;
        port.port = null; // the device is gone
        port.emit('close', Object.assign(new Error('Disconnected'), { disconnected: true }));

        assert.strictEqual(disconnects.length, 1, 'one Disconnected');
        status = manager.getConnectionStatus();
        assert.strictEqual(status.connected, false);
        assert.strictEqual(status.machineIdentifier, null);
        assert.strictEqual(status.deviceSerial, null);
        assert.strictEqual(status.host, null);
        assert.notStrictEqual(manager.getConnectionGeneration(), generation, 'the per-connection judge state resets');
        assert.strictEqual(manager.getJudgeConnectionContext().session, null);
        assert.ok(channel.getConnectionGeneration() > channelGeneration);
        assert.ok(uiEvents.includes('connection:close'), 'the UI gets the same connection:close as a clean disconnect');
        assert.strictEqual(channel.getController(), null, 'the destroyed controller is dropped');
        assert.strictEqual(channel.getLatestMachineState(), null);

        // A late duplicate event from the dead port changes nothing.
        port.emit('close');
        port.emit('error', new Error('late'));
        assert.strictEqual(disconnects.length, 1);

        // Replug and reconnect: a fresh controller, never the destroyed one.
        await open();
        assert.strictEqual(FakeMarlinController.created.length, 2, 'a new MarlinController');
        assert.strictEqual(manager.getConnectionStatus().connected, true);
        assert.strictEqual(manager.getConnectionStatus().machineIdentifier, 'A350');
    }],

    ['text serial: an error that leaves the port closed is a disconnect; one with the port still open is not', async () => {
        const { channel, manager, disconnects, open } = textChannel();
        await open();
        const controller = channel.getController() as FakeMarlinController;
        const port = controller.serialport as FakeSerialConnection;
        port.emit('error', new Error('write timeout'));
        assert.strictEqual(disconnects.length, 0, 'the port is still open');
        assert.strictEqual(manager.getConnectionStatus().connected, true);

        port.port = null;
        port.emit('error', new Error('port gone'));
        assert.strictEqual(disconnects.length, 1);
        assert.strictEqual(manager.getConnectionStatus().connected, false);
        assert.strictEqual(controller.destroyed, true, 'the controller still holding the port was closed');
    }],

    ['text serial: a clean close still behaves as before (no Disconnected, ConnectionManager clears it)', async () => {
        const { channel, manager, uiEvents, disconnects, open } = textChannel();
        await open();
        const controller = channel.getController() as FakeMarlinController;
        const port = controller.serialport as FakeSerialConnection;
        const generation = channel.getConnectionGeneration();
        const closeAcks: string[] = [];
        await manager.connectionClose({ emit: (name: string) => closeAcks.push(name) }, {});
        assert.strictEqual(disconnects.length, 0, 'a requested close is not a lost link');
        assert.deepStrictEqual(closeAcks, ['connection:close'], 'one acknowledgement, as before');
        assert.ok(!uiEvents.includes('connection:close'), 'no second, unsolicited close');
        assert.strictEqual(controller.closes, 1);
        assert.ok(channel.getConnectionGeneration() > generation);
        const status = manager.getConnectionStatus();
        assert.strictEqual(status.connected, false);
        assert.strictEqual(status.machineIdentifier, null);
        // Even a 'close' the port emits afterwards is not reported.
        port.emit('close');
        assert.strictEqual(disconnects.length, 0);
    }],
];
