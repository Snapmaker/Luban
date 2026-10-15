// Integration checks for the queued-pendant guards outside pendantRuntime:
// ConnectionManager's own entry points refuse callers while the gcode lease is
// held, and the frame-uncertainty latch is cleared (and persisted) by the real
// getPositionSnapshot / requireReliableMachine in tools/machine.ts.
import assert from 'assert';
import fs from 'fs';
import fse from 'fs-extra';
import os from 'os';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import { GcodeLease, isRecoveryCommand } from '../../machine/gcodeLease';
import * as machinePosition from '../machinePosition';
import * as machineTravel from '../machineTravel';
import * as positionOfRecord from '../positionOfRecord';
import { McpToolError } from '../registry';

function load(file: string, dependencies: Record<string, unknown>) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    } });
    const exports = {} as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const pattern = /from ['"]([^'"]+)['"]/g;
    const stubs: Record<string, unknown> = {};
    for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) { stubs[match[1]] = {}; }
    const all = { ...stubs, ...dependencies };
    vm.runInNewContext(compiled.outputText, {
        exports,
        Date,
        setTimeout,
        clearTimeout,
        process: { env: {} },
        require: (name: string) => {
            if (!(name in all)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return all[name];
        },
    });
    return exports;
}

const logger = () => ({ info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined });

function connectionManagerFixture() {
    const lease = new GcodeLease();
    const module = load('../../machine/ConnectionManager.ts', {
        '../../lib/logger': logger,
        lodash: { includes: (items: unknown[], value: unknown) => items.includes(value) },
        './gcodeLease': { gcodeLease: lease },
        './ProtocolDetector': { NetworkProtocol: { HTTP: 'HTTP', SacpOverTCP: 'SACP-TCP', SacpOverUDP: 'SACP-UDP', Unknown: 'Unknown' },
            SerialPortProtocol: { SacpOverSerialPort: 'SACP-Serial' } },
        './types': { ConnectionType: { WiFi: 'wifi', Serial: 'serial' } },
    });
    const cm = module.connectionManager;
    const calls: string[] = [];
    cm.channel = {
        executeGcode: async (gcode: string) => { calls.push(gcode); return { result: 0, text: 'ok' }; },
        startGcode: () => { calls.push('startGcode'); },
        resumeGcode: () => { calls.push('resumeGcode'); },
        coordinateMove: () => { calls.push('coordinateMove'); },
        setWorkOrigin: () => { calls.push('setWorkOrigin'); },
        goHome: () => { calls.push('goHome'); },
    };
    cm.protocol = 'HTTP';
    cm.connectionType = 'wifi';
    const emitted: Array<[string, object]> = [];
    const socket = { emit: (event: string, body: object) => { emitted.push([event, body]); } };
    return { cm, lease, calls, emitted, socket };
}

function machineToolsFixture(userDataDir: string) {
    const lease = new GcodeLease();
    const state = { pos: { x: 119, y: 77, z: -88 }, originOffset: { x: -51, y: -122, z: -328 }, timestamp: Date.now(), status: 'idle', isHomed: true };
    const machine = (identifier: string) => ({ identifier, metadata: { size: { x: 320, y: 350, z: 330 } } });
    const module = load('../tools/machine.ts', {
        'fs-extra': fse,
        path,
        '../../../../app/machines': {
            SnapmakerOriginalMachine: machine('Original'),
            SnapmakerOriginalExtendedMachine: machine('Original Extended'),
            SnapmakerA150Machine: machine('A150'),
            SnapmakerA250Machine: machine('A250'),
            SnapmakerA350Machine: machine('A350'),
            SnapmakerArtisanMachine: machine('Artisan'),
            SnapmakerJ1Machine: machine('J1'),
            SnapmakerRayMachine: machine('Ray'),
        },
        '../../../DataStorage': { userDataDir },
        '../../configstore': { get: () => undefined },
        '../../machine/ConnectionManager': { connectionManager: {
            getConnectionStatus: () => ({ connected: true, machineIdentifier: 'A350' }),
            getLatestMachineState: () => state,
        } },
        '../../machine/gcodeLease': { gcodeLease: lease },
        '../activeTool': { invalidateActiveTool: () => undefined },
        '../machinePosition': machinePosition,
        '../machineTravel': machineTravel,
        '../rotaryGeometry': { statedTravel: () => null },
        '../positionOfRecord': positionOfRecord,
        '../frameRecovery': { resyncHint: () => '' },
        '../registry': { McpToolError },
    });
    return { tools: module, lease, state };
}

export const tests: Array<[string, () => Promise<void>]> = [
    ['a recovery hold admits only no-motion recovery, homing, queries and job stop, and blocks a new lease', async () => {
        for (const ok of ['G90\nG54;', 'G53;\nG28;\nG54;', 'M114', 'M503 S', 'M5', 'home', 'stop job']) { assert.equal(isRecoveryCommand(ok), true, ok); }
        for (const bad of ['G0 X0 Y0', 'G0 Z0', 'G91', 'G92 X0', 'G1 X1 F600;', 'M220 S100', 'start job', 'G90\nG0 X1', '']) {
            assert.equal(isRecoveryCommand(bad), false, bad);
        }
        const lease = new GcodeLease();
        lease.holdForRecovery('test');
        assert.throws(() => lease.acquire('pendant', Infinity), /recovered first/);
        lease.endRecovery();
        assert.ok(lease.acquire('pendant', Infinity));
    }],
    ['ConnectionManager entry points refuse a UI job, jog or origin change while the pendant holds the lease', async () => {
        const f = connectionManagerFixture();
        const id = f.lease.acquire('the USB pendant (queued jog)', Infinity);
        await f.cm.startGcode(f.socket, { eventName: 'connection:startGcode', headType: 'cnc' });
        await f.cm.startGcodeAction(f.socket, { eventName: 'connection:headBeginWork' });
        await f.cm.resumeGcode(f.socket, {}, (reply: { msg: string }) => f.emitted.push(['resume', reply]));
        await f.cm.coordinateMove(f.socket, { gcode: 'G0 X0 Y0' }, () => undefined);
        await f.cm.setWorkOrigin(f.socket, { xPosition: 1 }, () => undefined);
        await f.cm.goHome(f.socket, { headType: 'cnc' }, () => undefined);
        assert.deepEqual(f.calls, [], 'nothing reached the channel');
        assert.ok(f.emitted.every(([, body]) => /reserved by the USB pendant/.test(JSON.stringify(body))));
        assert.equal(f.emitted.length, 3);
        // A recovery hold after a failed restore still admits homing, nothing else.
        f.lease.holdForRecovery('a queued pendant jog could not restore the work frame', id);
        await f.cm.coordinateMove(f.socket, { gcode: 'G0 X0 Y0' }, () => undefined);
        assert.deepEqual(f.calls, []);
        await f.cm.goHome(f.socket, { headType: 'cnc' }, () => undefined);
        assert.deepEqual(f.calls.slice(0, 2), ['G53', 'G28'], 'homing passes the recovery hold');
        f.calls.length = 0;
        f.lease.endRecovery();
        await f.cm.coordinateMove(f.socket, { gcode: 'G0 X0 Y0' }, () => undefined);
        assert.deepEqual(f.calls.slice(-1), ['G0 X0 Y0']);
    }],
    ['getPositionSnapshot clears the frame latch only after a restore and a fresh verified beat, and persists it', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'latch-'));
        const file = path.join(dir, 'mcp-frame-latch.json');
        try {
            const f = machineToolsFixture(dir);
            positionOfRecord.latchFrameUncertain('A queued USB pendant jog selected the machine workspace (G53).');
            assert.ok(fs.existsSync(file), 'persisted');
            const latched = f.tools.getPositionSnapshot();
            assert.ok(latched.warnings.some((w: string) => /FRAME UNCERTAIN/.test(w)));
            assert.throws(() => f.tools.requireReliableMachine(latched, 'a move'), /Refusing a move: FRAME UNCERTAIN/);
            f.state.timestamp = Date.now();
            f.tools.getPositionSnapshot();
            assert.ok(positionOfRecord.getFrameLatch(), 'no restore yet: a beat alone does not clear it');
            positionOfRecord.noteFrameRestored(Date.now() - 2000);
            f.state.timestamp = Date.now();
            const cleared = f.tools.getPositionSnapshot();
            assert.equal(positionOfRecord.getFrameLatch(), null);
            assert.ok(!cleared.warnings.some((w: string) => /FRAME UNCERTAIN/.test(w)));
            assert.doesNotThrow(() => f.tools.requireReliableMachine(cleared, 'a move'));
            assert.equal(fs.existsSync(file), false, 'cleared on disk too');
            // Restart: a latch left on disk comes back with a recovery hold on the lease.
            fs.writeFileSync(file, JSON.stringify({ reason: 'run interrupted', since: 1, restoredAt: null }));
            positionOfRecord.onFrameLatchChange(null);
            const restarted = machineToolsFixture(dir);
            assert.match(String(positionOfRecord.getFrameLatch()?.reason), /Carried over from before Luban restarted: run interrupted/);
            assert.ok(restarted.lease.status().recovery);
            assert.match(String(restarted.lease.refusal('G0 X0 Y0')), /machine workspace/);
            assert.equal(restarted.lease.refusal('G90\nG54;'), null);
            positionOfRecord.noteFrameRestored(Date.now() - 2000);
            restarted.state.timestamp = Date.now();
            restarted.tools.getPositionSnapshot();
            assert.equal(positionOfRecord.getFrameLatch(), null);
            assert.equal(restarted.lease.status().recovery, null, 'recovery hold ends with the latch');
        } finally {
            positionOfRecord.onFrameLatchChange(null);
            positionOfRecord.clearFrameLatch();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }],
];
