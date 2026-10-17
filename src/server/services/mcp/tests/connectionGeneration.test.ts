// Connection generation of the SACP and text-serial channels (#229 follow-up
// to #221): a transport that reconnects or reopens inside the same singleton
// channel object must change ConnectionManager.getConnectionGeneration(), and
// nothing else may. Inert: every transport is a fake EventEmitter, no timers
// run, nothing reaches a machine.
import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

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
interface Timers { pending: Array<{ fn: () => void; ms: number }> }

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
}

/** Fake SACP client: records the heartbeat subscription so a test can drive it. */
class FakeSacpClient {
    public static heartbeat: ((data: object) => void) | null = null;

    public read(): void { /* data is parsed, never a session change */ }

    public dispose(): void { /* nothing to free */ }

    public setLogger(): void { /* silent */ }

    public async getMachineInfo() { return { data: { type: 0 } }; }

    public async subscribeHeartbeat(_opts: object, callback: (data: object) => void) {
        FakeSacpClient.heartbeat = callback;
        return { code: 0 };
    }

    public async subscribePurifierInfo() { return new Promise(() => undefined); }

    public async wifiConnectionClose() { return { response: { result: 0 } }; }
}

class FakeTcpSocket extends EventEmitter {
    public destroyed = false;

    public connect(_opts: object, onConnect: () => void): void {
        this.destroyed = false;
        onConnect();
    }

    public destroy(): void { this.destroyed = true; }
}

class FakeUdpSocket extends EventEmitter {
    public bind(): void { /* no port is bound */ }
}

class FakeSerialPort extends EventEmitter {
    public static last: FakeSerialPort | null = null;

    public constructor() {
        super();
        FakeSerialPort.last = this;
    }

    public open(): void { /* the test emits 'open' itself */ }

    public write(): void { /* nothing is written to a port */ }

    public close(): void { /* closed */ }

    public destroy(): void { /* destroyed */ }
}

function sacpBase(timers: Timers): Exports {
    return load('channels/SacpChannel.ts', {
        '@snapmaker/luban-platform': { WorkflowStatus: { Idle: 'idle', Unknown: 'unknown', Starting: 'starting', Running: 'running' } },
        '@snapmaker/snapmaker-sacp-sdk/dist/helper': { readUint8: () => 0, readString: () => ({ result: '' }), readUint16: () => 0, readUint32: () => 0 },
        '../../../../app/constants': { WORKFLOW_STATUS_MAP: { 0: 'idle' } },
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value), find: () => undefined },
        '../../../lib/logger': logger,
        '../sacp/SacpClient': FakeSacpClient,
        './Channel': Channel,
        './ChannelEvent': { ChannelEvent: events },
    }, timers);
}

function sacpChannel(file: string, extra: Record<string, unknown>) {
    const timers: Timers = { pending: [] };
    const module = load(file, {
        '../../../lib/logger': logger,
        '../sacp/SacpClient': FakeSacpClient,
        './ChannelEvent': { ChannelEvent: events },
        './SacpChannel': sacpBase(timers),
        '../../../../app/constants/machines': { SACP_TYPE_SERIES_MAP: {} },
        '../../../constants': { DEFAULT_BAUDRATE: 115200 },
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
        ...extra,
    }, timers);
    const ChannelClass = module.default;
    const channel = new ChannelClass();
    channel.socket = new EventEmitter();
    return { channel, timers };
}

/** Reading the generation many times, and ordinary traffic, never changes it. */
function assertSteady(read: () => number | string, traffic: () => void = () => undefined): void {
    const value = read();
    traffic();
    assert.strictEqual(read(), value);
    assert.strictEqual(read(), value);
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['SACP TCP: a new session, a socket close or error and a close all change the generation; traffic does not', async () => {
        const socket = { last: null as FakeTcpSocket | null };
        const { channel } = sacpChannel('channels/SacpTcpChannel.ts', {
            net: { Socket: class extends FakeTcpSocket { public constructor() { super(); socket.last = this; } } },
            os: { hostname: () => 'test-host' },
        });
        const read = () => channel.getConnectionGeneration() as number;
        const tcp = socket.last as FakeTcpSocket;
        assert.strictEqual(typeof read(), 'number');
        assertSteady(read);

        let before = read();
        channel.connectionOpen({ address: '192.0.2.1' }); // never resolves: the 200 ms auth timer is captured, not run
        assert.ok(read() > before, 'a new TCP session is a new generation');
        assertSteady(read, () => tcp.emit('data', Buffer.from([1, 2, 3])));

        before = read();
        tcp.emit('error', new Error('ECONNRESET'));
        assert.ok(read() > before, 'socket error');
        before = read();
        tcp.emit('close');
        assert.ok(read() > before, 'socket close (an internal drop the ConnectionManager never saw)');

        before = read();
        channel.connectionOpen({ address: '192.0.2.1' });
        const reopened = read();
        assert.ok(reopened > before, 'reconnecting the same singleton object is still a new generation');
        assertSteady(read);

        await channel.connectionClose({ force: true });
        assert.ok(read() > reopened, 'forced close');
        before = read();
        channel.connectionClose({ force: false }); // resolves after a captured 500 ms timer
        assert.ok(read() > before, 'orderly close');
    }],

    ['SACP UDP: a new or probe session, a socket close or error and a close change the generation', async () => {
        const socket = { last: null as FakeUdpSocket | null };
        const { channel } = sacpChannel('channels/SacpUdpChannel.ts', {
            dgram: { createSocket: () => { socket.last = new FakeUdpSocket(); return socket.last; } },
            './Channel': {},
        });
        const read = () => channel.getConnectionGeneration() as number;
        const udp = socket.last as FakeUdpSocket;
        let before = read();
        await channel.connectionOpen({ address: '192.0.2.2' });
        assert.ok(read() > before, 'connectionOpen');
        assertSteady(read, () => udp.emit('message', Buffer.from([1])));

        for (const event of ['error', 'close']) {
            before = read();
            udp.emit(event, new Error('gone'));
            assert.ok(read() > before, event);
        }
        before = read();
        await channel.test('192.0.2.2', 8889);
        assert.ok(read() > before, 'test() replaces the SACP session');
        before = read();
        await channel.connectionClose();
        assert.ok(read() > before, 'connectionClose');
    }],

    ['SACP serial: session creation, open, error, close and connectionClose change the generation', async () => {
        const { channel } = sacpChannel('channels/SacpSerialChannel.ts', {
            serialport: { SerialPort: FakeSerialPort },
            '../../../DataStorage': {},
        });
        const read = () => channel.getConnectionGeneration() as number;
        let before = read();
        channel.connectionOpen({ port: 'COM9', baudRate: 115200 }); // resolves only after a captured timer
        const port = FakeSerialPort.last as FakeSerialPort;
        assert.ok(read() > before, 'a new serial session');
        before = read();
        port.emit('open');
        assert.ok(read() > before, 'port opened');
        assertSteady(read, () => port.emit('data', Buffer.from([1])));

        for (const event of ['error', 'close']) {
            before = read();
            port.emit(event, new Error('unplugged'));
            assert.ok(read() > before, event);
        }
        before = read();
        await channel.connectionClose();
        assert.ok(read() > before, 'connectionClose');
        assert.strictEqual(await channel.connectionOpen({ port: '', baudRate: 0 }), false);
        assertSteady(read);
    }],

    ['SACP heartbeat loss closes the session as a new generation; live beats do not', async () => {
        const { channel, timers } = sacpChannel('channels/SacpTcpChannel.ts', {
            net: { Socket: FakeTcpSocket },
            os: { hostname: () => 'test-host' },
        });
        channel.connectionOpen({ address: '192.0.2.1' });
        await channel.startHeartbeat();
        const beat = FakeSacpClient.heartbeat as (data: object) => void;
        const read = () => channel.getConnectionGeneration() as number;
        timers.pending.length = 0;
        assertSteady(read, () => { beat({ response: { data: Buffer.from([0]) } }); beat({ response: { data: Buffer.from([0]) } }); });
        const watchdog = timers.pending.filter((timer) => timer.ms === 10000).pop();
        assert.ok(watchdog, 'each beat re-arms the 10 s watchdog');
        const before = read();
        watchdog.fn();
        assert.ok(read() > before, 'lost heartbeat');
    }],

    ['text serial: open, close and an internal port close/reopen change the generation; reading does not', async () => {
        class FakeMarlinController extends EventEmitter {
            public serialport: object | null = null;

            public state = { headType: 'cnc' };

            public addConnection(): void { /* socket joined */ }

            public isOpen(): boolean { return !!this.serialport; }

            public open(callback: (err?: Error | null) => void): void {
                this.serialport = {};
                callback(null);
            }

            public close(): void { this.serialport = null; }

            public destroy(): void { this.serialport = null; }

            public writeln(): void { /* nothing written */ }
        }
        const module = load('channels/TextSerialChannel.ts', {
            lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
            '../../../controllers': { MarlinController: FakeMarlinController },
            '../../../controllers/constants': { PROTOCOL_TEXT: 'text' },
            '../../../lib/logger': logger,
            './Channel': Channel,
            './ChannelEvent': { ChannelEvent: events },
            '../../../constants': { HEAD_LASER: 'laser' },
        });
        const TextChannel = module.default;
        const channel = new TextChannel();
        channel.socket = new EventEmitter();
        const read = () => channel.getConnectionGeneration() as number;
        assertSteady(read);

        let before = read();
        assert.strictEqual(await channel.connectionOpen({ port: 'COM3' }), true);
        assert.ok(read() > before, 'port opened');
        assertSteady(read);

        // MarlinController closes the port on its own when it drops ('close'
        // listener -> close() -> destroy()), without telling the channel.
        const controller = channel.getController();
        before = read();
        controller.close();
        assert.ok(read() > before, 'internal close');
        before = read();
        controller.open(() => undefined);
        assert.ok(read() > before, 'internal reopen is a new serial connection object');
        assertSteady(read);

        before = read();
        await channel.connectionClose();
        assert.ok(read() > before, 'connectionClose');
    }],

    ['ConnectionManager picks up the SACP generation without reassigning the channel', () => {
        const { channel } = sacpChannel('channels/SacpTcpChannel.ts', {
            net: { Socket: FakeTcpSocket },
            os: { hostname: () => 'test-host' },
        });
        const manager = load('ConnectionManager.ts', {
            '../../lib/logger': logger,
            './ProtocolDetector': { NetworkProtocol: { Unknown: 'Unknown', HTTP: 'HTTP' }, SerialPortProtocol: {} },
            './channels/ChannelEvent': { ChannelEvent: events },
            './channels/SacpTcpChannel': { sacpTcpChannel: channel },
            './types': { ConnectionType: { WiFi: 'wifi' } },
        }).connectionManager;
        manager.channel = channel;
        const first = manager.getConnectionGeneration();
        assert.strictEqual(manager.getConnectionGeneration(), first, 'same session, same identity');
        channel.client.emit('close');
        const second = manager.getConnectionGeneration();
        assert.notStrictEqual(second, first, 'an internal SACP drop changes the identity the failure hook compares');
        assert.strictEqual(second.split('.')[0], first.split('.')[0], 'with no channel reassignment');
    }],
];
