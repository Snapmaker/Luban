// The USB text-serial channel's machine state (#265 R1, the Snapmaker
// Original): the M114 replies MarlinController already polls become
// getLatestMachineState() in the LOGICAL frame, stamped with the time the
// reply was parsed. Real Marlin.js line parser, fake serial port, injected
// clock; nothing is written to a machine.
import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import { judgeBeat } from '../machinePosition';

type Exports = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SERVER_DIR = path.join(__dirname, '../../..');

function stubImports(source: string): Record<string, unknown> {
    const dependencies: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
        dependencies[match[1]] = {};
    }
    return dependencies;
}

/** The test's clock: the tracker and the channel see only this. */
const clock = { now: 1000 };
const FakeDate = { now: () => clock.now };

function load(file: string, overrides: Record<string, unknown>): Exports {
    const source = fs.readFileSync(path.join(SERVER_DIR, file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true, allowJs: true,
    } });
    const dependencies = { ...stubImports(source), ...overrides };
    const exports = {} as Exports;
    vm.runInNewContext(compiled.outputText, {
        exports,
        Date: FakeDate,
        Promise,
        setTimeout: () => 0,
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

/** Objects built inside the vm context have that realm's prototypes; compare them as plain data. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const logger = () => ({ info: () => undefined, warn: () => undefined, debug: () => undefined, error: () => undefined });
const events = { Connecting: 'connecting', Connected: 'connected', Ready: 'ready', Disconnected: 'disconnected', ErrorReport: 'error-report' };

/* eslint-disable global-require */
const marlinModule = load('controllers/Marlin/Marlin.js', {
    events: require('events'),
    'lodash/get': require('lodash/get'),
    'lodash/isEqual': require('lodash/isEqual'),
    'lodash/isUndefined': require('lodash/isUndefined'),
    'lodash/set': require('lodash/set'),
    semver: require('semver'),
    '../constants': { HEAD_CNC: 'cnc', HEAD_LASER: 'laser', HEAD_PRINTING: 'printing' },
});
/* eslint-enable global-require */
const Marlin = marlinModule.default;

const stateModule = load('services/machine/channels/textSerialMachineState.ts', {});

/**
 * MarlinController as the channel sees it: a real Marlin line parser whose
 * 'pos' / 'originOffset' events are re-emitted exactly as MarlinController's
 * handlers do (checked against its source below), a workflow, a port.
 */
class FakeMarlinController extends EventEmitter {
    public serialport: object | null = null;

    public controller = new Marlin();

    public workflow = { state: 'idle' };

    public state = { headType: 'cnc' };

    public written: string[] = [];

    public constructor() {
        super();
        this.controller.on('pos', (res: unknown) => this.emit('positionReport', res));
        this.controller.on('originOffset', (res: unknown) => this.emit('originOffsetReport', res));
    }

    public addConnection(): void { /* socket joined */ }

    public isOpen(): boolean { return !!this.serialport; }

    public open(callback: (err?: Error | null) => void): void {
        this.serialport = {};
        callback(null);
    }

    public close(): void { this.serialport = null; }

    public destroy(): void { this.serialport = null; }

    public writeln(line: string): void { this.written.push(line); }

    /** A line arriving from the serial port. */
    public receive(line: string): void { this.controller.parse(line); }
}

function textChannel() {
    const module = load('services/machine/channels/TextSerialChannel.ts', {
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
        '../../../controllers': { MarlinController: FakeMarlinController },
        '../../../controllers/constants': { PROTOCOL_TEXT: 'text' },
        '../../../lib/logger': logger,
        './Channel': class extends EventEmitter { public socket = new EventEmitter(); },
        './ChannelEvent': { ChannelEvent: events },
        '../../../constants': { HEAD_LASER: 'laser' },
        './textSerialMachineState': stateModule,
    });
    const TextChannel = module.default;
    const channel = new TextChannel();
    channel.socket = new EventEmitter();
    return channel;
}

// The Original's Marlin 1.x reply and a Snapmaker 2.0 reply with B and step counts.
const ORIGINAL_M114 = 'X:10.00 Y:20.50 Z:5.00 E:0.00 Count X: 800 Y:1640 Z:2000';
const SM2_M114 = 'X:-19.00 Y:4.00 Z:300.00 E:0.00 B:0.00 Count X:0 Y:0 Z:120000';

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['MarlinController re-emits the parsed M114 and M1007 replies the channel listens for', () => {
        const source = fs.readFileSync(path.join(SERVER_DIR, 'controllers/Marlin/MarlinController.js'), 'utf8');
        const posHandler = source.slice(source.indexOf('this.controller.on(\'pos\''), source.indexOf('this.controller.on(\'temperature\''));
        assert.ok(posHandler.includes('this.emit(\'positionReport\', res)'), 'the pos handler emits positionReport');
        const offsetHandler = source.slice(source.indexOf('this.controller.on(\'originOffset\''), source.indexOf('this.controller.on(\'headStatus\''));
        assert.ok(offsetHandler.includes('this.emit(\'originOffsetReport\', res)'), 'the originOffset handler emits originOffsetReport');
    }],

    ['the real Marlin parser hands strings; the state carries numbers, the Count tail and the logical frame', () => {
        const parsed: Array<{ pos: Record<string, unknown>; raw: string }> = [];
        const marlin = new Marlin();
        marlin.on('pos', (res: { pos: Record<string, unknown>; raw: string }) => parsed.push(res));
        marlin.parse(ORIGINAL_M114);
        assert.strictEqual(parsed[0].pos.y, '20.50', 'the parser keeps fixed-point strings');
        assert.strictEqual(parsed[0].pos.count, undefined, 'the Count tail is not in pos');

        const tracker = new stateModule.TextSerialMachineStateTracker(() => 1234);
        assert.strictEqual(tracker.notePosition(parsed[0], 1), true);
        const state = tracker.get(1, { workflowState: 'idle', isHomed: null });
        assert.deepStrictEqual(plain(state.pos), { x: 10, y: 20.5, z: 5, b: null, isFourAxis: false });
        assert.strictEqual(state.e, 0);
        assert.deepStrictEqual(plain(state.counts), { x: 800, y: 1640, z: 2000 });
        assert.strictEqual(state.positionFrame, 'logical');
        assert.strictEqual(state.timestamp, 1234);
        assert.strictEqual(state.raw, ORIGINAL_M114);
        assert.strictEqual('originOffset' in state, false, 'no originOffset: the judge must not derive machine coordinates');
        assert.strictEqual('status' in state, false, 'Luban\'s sender state is not the controller\'s motion state');
        assert.strictEqual(state.workflowState, 'idle');
        assert.strictEqual(state.controllerHomed, null);

        marlin.parse(SM2_M114);
        tracker.notePosition(parsed[1], 1);
        const sm2 = tracker.get(1);
        assert.deepStrictEqual(plain(sm2.pos), { x: -19, y: 4, z: 300, b: 0, isFourAxis: true });
        assert.deepStrictEqual(plain(sm2.counts), { x: 0, y: 0, z: 120000 });
    }],

    ['Count parsing: Marlin 1.0 spacing, no tail, and a missing axis stays null', () => {
        assert.deepStrictEqual(plain(stateModule.parseM114Counts('X:1.00 Y:2.00 Z:3.00 E:0.00 Count X: 1.00Y:2.00Z:3.00')), { x: 1, y: 2, z: 3 });
        assert.strictEqual(stateModule.parseM114Counts('X:1.00 Y:2.00 Z:3.00 E:0.00'), null);
        const mapped = stateModule.mapPositionPayload({ pos: { x: '1.0', y: '2.0' }, raw: 'X:1.0 Y:2.0 ' });
        assert.strictEqual(mapped.pos.z, null, 'an axis the reply did not carry is never read as 0');
        assert.strictEqual(stateModule.mapPositionPayload({ pos: {} }), null);
    }],

    ['the MCP judge refuses to derive a machine position from the logical state (no offset is reported)', () => {
        const tracker = new stateModule.TextSerialMachineStateTracker(() => 1000);
        tracker.notePosition({ pos: { x: '10.00', y: '20.00', z: '5.00' }, raw: 'X:10.00 Y:20.00 Z:5.00 ' }, 1);
        const state = tracker.get(1);
        const offset = (state.originOffset || {}) as { x?: number; y?: number; z?: number };
        const judged = judgeBeat({
            raw: { x: state.pos.x, y: state.pos.y, z: state.pos.z },
            offsetReported: { x: offset.x ?? null, y: offset.y ?? null, z: offset.z ?? null },
            cachedOffset: null,
            zeroStreak: 0,
            previousRaw: null,
            bounds: null,
            reportedAt: state.timestamp,
            now: 1000,
            staleMs: 10000,
            lastAccepted: null,
            verified: null,
            machineFrameStreak: 0,
        });
        assert.strictEqual(judged.accepted, false);
        assert.strictEqual(judged.rejectedReason, 'no-offset-yet');
    }],

    ['channel: null before the first reply, parse time after it, a tick without a reply does not advance it, cleared on close', async () => {
        clock.now = 1000;
        const channel = textChannel();
        assert.strictEqual(channel.getLatestMachineState(), null, 'never opened');
        assert.strictEqual(await channel.connectionOpen({ port: 'COM3' }), true);
        assert.strictEqual(channel.getLatestMachineState(), null, 'open, no report yet');
        const controller = channel.getController() as FakeMarlinController;

        clock.now = 2000;
        controller.receive(ORIGINAL_M114);
        const first = channel.getLatestMachineState();
        assert.strictEqual(first.timestamp, 2000, 'stamped when the reply was parsed');
        assert.strictEqual(first.pos.x, 10);

        // Timer ticks (time passing, other replies, reads) are not position reports.
        clock.now = 9000;
        controller.receive('ok');
        controller.receive('ok T:25.0 /0.0 B:24.0 /0.0 @:0 B@:0');
        assert.strictEqual(channel.getLatestMachineState().timestamp, 2000, 'a stalled position feed reads stale');
        assert.deepStrictEqual(controller.written, [], 'the channel writes nothing');

        controller.workflow.state = 'running';
        controller.controller.state.isHomed = true;
        const live = channel.getLatestMachineState();
        assert.strictEqual(live.workflowState, 'running');
        assert.strictEqual(live.controllerHomed, true);
        assert.strictEqual(live.timestamp, 2000);

        clock.now = 9500;
        controller.receive('Origin offset X: 12.5');
        controller.receive('Origin offset Y: -3');
        const withOffset = channel.getLatestMachineState();
        assert.deepStrictEqual(plain(withOffset.controllerOriginOffset), { x: 12.5, y: -3, z: null, b: null });
        assert.strictEqual(withOffset.controllerOriginOffsetAt, 9500);
        assert.strictEqual(withOffset.timestamp, 2000, 'an M1007 reply is not a position beat');

        await channel.connectionClose();
        assert.strictEqual(channel.getLatestMachineState(), null, 'cleared on close');
    }],

    ['channel: an unplug (port closes under the channel) and a reopen start from null', async () => {
        clock.now = 1000;
        const channel = textChannel();
        await channel.connectionOpen({ port: 'COM3' });
        const controller = channel.getController() as FakeMarlinController;
        controller.receive(ORIGINAL_M114);
        assert.ok(channel.getLatestMachineState());

        controller.close();
        assert.strictEqual(channel.getLatestMachineState(), null, 'the port dropped');
        controller.open(() => undefined);
        assert.strictEqual(channel.getLatestMachineState(), null, 'a new serial connection inherits nothing');
        clock.now = 3000;
        controller.receive(SM2_M114);
        assert.strictEqual(channel.getLatestMachineState().timestamp, 3000);
        assert.strictEqual(channel.getLatestMachineState().controllerOriginOffset, null);
    }],
];
