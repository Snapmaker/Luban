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
import { GcodeLease, isHomeSequence, isRecoveryCommand } from '../../machine/gcodeLease';
import * as frameRecovery from '../frameRecovery';
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
        '../mcp/positionOfRecord': positionOfRecord,
        '../../constants': { HEAD_CNC: 'cnc', HEAD_LASER: 'laser', HEAD_PRINTING: 'printing' },
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
        '../../../lib/logger': logger,
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
        '../frameRecovery': frameRecovery,
        '../registry': { McpToolError },
    });
    return { tools: module, lease, state };
}

export const tests: Array<[string, () => Promise<void>]> = [
    ['a recovery hold admits only no-motion recovery, the whole home sequence, queries and job stop, and blocks a new lease', async () => {
        for (const ok of ['G90\nG54;', 'G53;\nG28;\nG54;', 'G53\nG28\nG54', 'M114', 'M503 S', 'M5', 'home', 'stop job']) { assert.equal(isRecoveryCommand(ok), true, ok); }
        // A bare G53 (or G28) is not recovery: it selects a frame with nothing to hand it back (2026-10-05 review).
        for (const bad of ['G0 X0 Y0', 'G0 Z0', 'G91', 'G92 X0', 'G1 X1 F600;', 'M220 S100', 'start job', 'G90\nG0 X1', '', 'G53', 'G53;', 'G28', 'G53\nG28', 'G28\nG54', 'G54\nG28\nG53', 'G53\nG0 X1\nG54']) {
            assert.equal(isRecoveryCommand(bad), false, bad);
        }
        // Inside a UI home sequence the three lines are admitted one request at a time, nothing else.
        for (const line of ['G53', 'G28', 'G54']) { assert.equal(isRecoveryCommand(line, { homing: true }), true, line); }
        assert.equal(isRecoveryCommand('G0 X0', { homing: true }), false);
        assert.equal(isHomeSequence(['G53;', 'G28;', 'G54;']), true);
        assert.equal(isHomeSequence(['G53;', 'G54;']), false);
        // The hold IS the frame latch: holdForRecovery raises it, and only clearing the latch ends the hold.
        const lease = new GcodeLease();
        try {
            lease.holdForRecovery('test');
            assert.match(String(positionOfRecord.getFrameLatch()?.reason), /^test$/);
            assert.throws(() => lease.acquire('pendant', Infinity), /recovered first \(test\)/);
            assert.match(String(lease.refusal('G53')), /machine workspace/, 'a bare G53 is refused under the hold');
            assert.equal(lease.refusal('G53;\nG28;\nG54;'), null, 'the whole home sequence passes');
            assert.equal(await lease.runAsHomeSequence(async () => lease.refusal('G53')), null, 'a UI home line passes inside its sequence');
            positionOfRecord.clearFrameLatch();
            assert.equal(lease.status().recovery, null);
            assert.ok(lease.acquire('pendant', Infinity));
        } finally {
            positionOfRecord.clearFrameLatch();
        }
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
        try {
            f.lease.holdForRecovery('a queued pendant jog could not restore the work frame', id);
            await f.cm.coordinateMove(f.socket, { gcode: 'G0 X0 Y0' }, () => undefined);
            assert.deepEqual(f.calls, []);
            // The UI home's three separate requests pass as a sequence, and its accepted
            // G54 marks the frame restored (a verified beat still has to clear the latch).
            await f.cm.goHome(f.socket, { headType: 'cnc' }, () => undefined);
            assert.deepEqual(f.calls, ['G53', 'G28', 'G54'], 'homing passes the recovery hold');
            assert.ok(positionOfRecord.getFrameLatch()?.restoredAt, 'UI home marked the frame restored');
            assert.ok(positionOfRecord.getFrameLatch(), 'the latch itself waits for a verified beat');
            f.calls.length = 0;
            positionOfRecord.clearFrameLatch();
            await f.cm.coordinateMove(f.socket, { gcode: 'G0 X0 Y0' }, () => undefined);
            assert.deepEqual(f.calls.slice(-1), ['G0 X0 Y0']);
        } finally {
            positionOfRecord.clearFrameLatch();
        }
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
    ['the latch file is fail-safe: a torn or non-object file raises the latch on startup, and writes are whole', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'latch-'));
        const file = path.join(dir, 'mcp-frame-latch.json');
        try {
            fs.writeFileSync(file, '{"reason": "run inter'); // a torn write from a crash
            positionOfRecord.onFrameLatchChange(null);
            const f = machineToolsFixture(dir);
            assert.match(String(positionOfRecord.getFrameLatch()?.reason), /unreadable latch file \(mcp-frame-latch\.json\)/);
            assert.ok(f.lease.status().recovery, 'the hold is the latch');
            assert.match(String(f.lease.refusal('G0 X0 Y0')), /machine workspace/);
            assert.throws(() => f.tools.requireReliableMachine(f.tools.getPositionSnapshot(), 'a move'), /FRAME UNCERTAIN: Carried over/);
            // A raise rewrites the file whole: no temp file left behind, and it parses.
            positionOfRecord.latchFrameUncertain('fresh');
            assert.deepEqual(fs.readdirSync(dir), ['mcp-frame-latch.json']);
            assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).reason, 'fresh');
            positionOfRecord.clearFrameLatch();
            assert.equal(fs.existsSync(file), false);
            // A file that parses to something other than an object is unreadable too.
            fs.writeFileSync(file, '[1, 2]');
            positionOfRecord.onFrameLatchChange(null);
            machineToolsFixture(dir);
            assert.match(String(positionOfRecord.getFrameLatch()?.reason), /unreadable latch file/);
            assert.equal(positionOfRecord.getFrameLatch()?.restoredAt, null);
        } finally {
            positionOfRecord.onFrameLatchChange(null);
            positionOfRecord.clearFrameLatch();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }],
    ['latch listeners fan out to every subscriber and unsubscribe individually', async () => {
        const seen: string[] = [];
        try {
            const offA = positionOfRecord.onFrameLatchChange((latch) => seen.push(`a:${latch ? 'set' : 'clear'}`));
            positionOfRecord.onFrameLatchChange((latch) => seen.push(`b:${latch ? `set@${latch.restoredAt === null ? 'raised' : 'restored'}` : 'clear'}`));
            positionOfRecord.latchFrameUncertain('x');
            positionOfRecord.noteFrameRestored();
            offA();
            positionOfRecord.clearFrameLatch();
            assert.deepEqual(seen, ['a:set', 'b:set@raised', 'a:set', 'b:set@restored', 'b:clear']);
        } finally {
            positionOfRecord.onFrameLatchChange(null);
            positionOfRecord.clearFrameLatch();
        }
    }],
    ['the lease shortens every request while held; a hold re-raises a latch that a beat cleared mid-run (the dead end)', async () => {
        try {
            const lease = new GcodeLease();
            assert.equal(lease.requestTimeoutMs(300000), 300000);
            const id = lease.acquire('the USB pendant (queued jog)', Infinity, 0, 10000);
            assert.equal(lease.requestTimeoutMs(300000, 1), 10000, 'a hung request fails the run instead of blocking Restore for 300 s');
            assert.equal(lease.requestTimeoutMs(5000, 1), 5000, 'never longer than the channel default');
            assert.equal(lease.status(1).held?.requestTimeoutMs, 10000);
            // The run latched before its G53, the settle's G54 was acknowledged, a beat
            // verified the latch away - and then the fallback restore failed.
            positionOfRecord.latchFrameUncertain('A queued USB pendant jog selected the machine workspace (G53).');
            positionOfRecord.noteFrameRestored();
            positionOfRecord.clearFrameLatch();
            lease.holdForRecovery('a queued pendant jog could not restore the work frame', id);
            assert.equal(lease.status().held, null, 'the lease is released');
            const latch = positionOfRecord.getFrameLatch();
            assert.match(String(latch?.reason), /could not restore the work frame/, 're-raised, so the hold cannot outlive its latch');
            assert.equal(latch?.restoredAt, null, 'a fresh restore is required');
            assert.match(String(lease.refusal('G0 X1')), /machine workspace/);
            assert.equal(lease.refusal('G90\nG54;'), null);
            // restore_work_frame succeeds and a verified beat follows: the hold ends with the latch.
            positionOfRecord.noteFrameRestored();
            positionOfRecord.clearFrameLatch();
            assert.equal(lease.status().recovery, null);
            assert.equal(lease.refusal('G0 X1'), null);
            assert.equal(lease.requestTimeoutMs(300000), 300000);
        } finally {
            positionOfRecord.clearFrameLatch();
        }
    }],
    ['an M114 after a zero-segment restore proves the position only when it reads in the work frame', async () => {
        const offset = { x: -51, y: -122, z: -328 };
        const expected = { x: 124, y: 203, z: 328 };
        // Work-frame reply (raw = machine + offset): proven.
        assert.deepEqual(positionOfRecord.judgeRestoredEcho({ x: 73, y: 81, z: 0 }, [offset], expected, 0.05), expected);
        // Raw machine coordinates - what a controller still in G53 reports: refused.
        assert.equal(positionOfRecord.judgeRestoredEcho({ x: 124, y: 203, z: 328 }, [offset], expected, 0.05), null);
        // A transient zero heartbeat offset after the trusted one does not rescue it: the first match wins and is machine-frame.
        assert.equal(positionOfRecord.judgeRestoredEcho({ x: 124, y: 203, z: 328 }, [offset, { x: 0, y: 0, z: 0 }], expected, 0.05), null);
        // With a ~0 offset the frames coincide, matchFrame reports work-frame, and nothing claims to tell them apart.
        assert.deepEqual(positionOfRecord.judgeRestoredEcho({ x: 124, y: 203, z: 328 }, [{ x: 0, y: 0, z: 0 }], expected, 0.05), expected);
        // Elsewhere entirely: not proven.
        assert.equal(positionOfRecord.judgeRestoredEcho({ x: 70, y: 81, z: 0 }, [offset], expected, 0.05), null);
    }],
];
