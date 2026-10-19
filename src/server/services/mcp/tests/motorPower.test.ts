/* eslint-disable camelcase */
// The Ray's motor-power gate (tyeth/Luban#321): the pure read and refusal
// (motorPower.ts), the real connectedMachine.ts read over a stub connection
// (the A350, the Original, the Artisan and the J1 send nothing), and home and
// start_gcode_job over the stubbed tool modules (each mode on the Ray; the
// start refuses before the approval is consumed). No machine access.
import assert from 'assert';
import * as motorPower from '../motorPower';
import * as gcodeDialect from '../gcodeDialect';
import * as machineCapability from '../machineCapability';
import * as toolheadState from '../toolheadState';
import { McpToolError } from '../registry';
import { clearMcpLaserRecord } from '../toolheadState';
import { isolatedModule } from './jobDashboard.test';
import { cameraFixture } from './sstpConnection.test';
import { fixture as jobFixture } from './fileJobStart.test';

const SHUT_ALL_MESSAGE = 'the Ray\'s motors are off (Manual Mode / SHUTAll): it acknowledges commands and ignores them. '
    + 'Switch Luban\'s Set Origin Mode to Control Mode, then retry.';

const SHUT_ALL = 1;
const ONLY_LINEAR = 2;
const STAY_POWER = 3;

/** A reader that answers `mode` and counts its calls; `mode` may change between calls (the operator switching in Luban). */
function reader(initial: unknown) {
    const r = {
        mode: initial,
        calls: 0,
        read: async () => {
            r.calls += 1;
            if (r.mode instanceof Error) {
                throw r.mode;
            }
            return r.mode;
        },
    };
    return r;
}

/** The real connectedMachine.ts over a stub ConnectionManager: `identifier` connected on a channel with (or without) the read. */
function connectedMachineFor(identifier: string, channel: object | null) {
    const definition = (id: string, z: number) => ({ identifier: id, machineType: 'test', metadata: { size: { x: 600, y: 400, z }, toolHeads: [] } });
    const machines = {
        SnapmakerOriginalMachine: definition('Original', 125),
        SnapmakerOriginalExtendedMachine: definition('Original Long Z-axis', 221),
        SnapmakerA150Machine: definition('Snapmaker 2.0 A150', 150),
        SnapmakerA250Machine: definition('Snapmaker 2.0 A250', 235),
        SnapmakerA350Machine: definition('Snapmaker 2.0 A350', 330),
        SnapmakerArtisanMachine: definition('A400', 400),
        SnapmakerJ1Machine: definition('Snapmaker J1', 200),
        SnapmakerRayMachine: definition('Ray', 0),
    };
    return isolatedModule('connectedMachine.ts', {
        '../../../app/machines': machines,
        '../machine/ConnectionManager': { connectionManager: {
            getConnectionStatus: () => ({ connected: true, machineIdentifier: identifier }),
            getCurrentChannel: () => channel,
            getLatestMachineState: () => null,
        } },
        './gcodeDialect': gcodeDialect,
        './machineCapability': machineCapability,
        './registry': { McpToolError },
        './toolheadState': toolheadState,
        './motorPower': motorPower,
    });
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['the dialect table: only the Ray row keeps a motor-power mode', () => {
        for (const id of ['sm2-marlin', 'artisan-marlin', 'j1-marlin', 'original-marlin', 'unknown'] as const) {
            assert.equal(gcodeDialect.dialectById(id).motorPower.read, 'none', id);
        }
        assert.equal(gcodeDialect.dialectById('ray-grbl').motorPower.read, 'sacp-0x48');
    }],
    ['readMotorPower decodes 1-3 and reports anything else, a failure, a timeout or no reader as unknown', async () => {
        const at = () => 1234;
        assert.deepEqual(await motorPower.readMotorPower(async () => SHUT_ALL, at),
            { mode: 'SHUTAll', raw: 1, source: motorPower.MOTOR_POWER_SOURCE, read_at: 1234, error: null });
        assert.equal((await motorPower.readMotorPower(async () => ONLY_LINEAR, at)).mode, 'ONLYLINEAR');
        assert.equal((await motorPower.readMotorPower(async () => STAY_POWER, at)).mode, 'STAYPOWER');
        const invalid = await motorPower.readMotorPower(async () => 0, at);
        assert.equal(invalid.mode, 'unknown'); assert.equal(invalid.raw, 0); assert.equal(invalid.read_at, null);
        assert.match(invalid.error as string, /not 1-3/);
        assert.equal((await motorPower.readMotorPower(async () => 9, at)).mode, 'unknown');
        assert.match((await motorPower.readMotorPower(async () => undefined, at)).error as string, /returned mode undefined/);
        const failed = await motorPower.readMotorPower(async () => { throw new RangeError('out of range'); }, at);
        assert.equal(failed.mode, 'unknown'); assert.match(failed.error as string, /read failed: out of range/);
        const thrown = await motorPower.readMotorPower(() => { throw new Error('sync'); }, at);
        assert.match(thrown.error as string, /read failed: sync/);
        const started = Date.now();
        const silent = await motorPower.readMotorPower(async () => new Promise(() => undefined), at, 30);
        assert.equal(silent.mode, 'unknown'); assert.match(silent.error as string, /no reply to SACP 0x01 0x48 within 30 ms/);
        assert.ok(Date.now() - started < 2000, 'the timeout bounds the read');
        const none = await motorPower.readMotorPower(null, at);
        assert.equal(none.mode, 'unknown'); assert.match(none.error as string, /cannot send SACP 0x01 0x48/);
    }],
    ['the refusal: SHUTAll and ONLYLINEAR say switch to Control Mode, unknown says so, STAYPOWER passes', async () => {
        const read = async (mode: unknown) => motorPower.readMotorPower(async () => mode);
        const shut = motorPower.motorPowerRefusal(await read(SHUT_ALL), 'home', '(machine: Ray)', 'Nothing was sent.') as string;
        assert.ok(shut.includes(SHUT_ALL_MESSAGE), shut);
        assert.match(shut, /^Refusing home: .*never changes the motor-power mode itself\. Nothing was sent\. \(machine: Ray\)$/);
        const linear = motorPower.motorPowerRefusal(await read(ONLY_LINEAR), 'home', '', '') as string;
        assert.match(linear, /ONLYLINEAR, which its firmware \(V1\.7\.4\) treats exactly as SHUTAll.*Control Mode, then retry/);
        const unknown = motorPower.motorPowerRefusal(await motorPower.readMotorPower(null), 'home', '', '') as string;
        assert.match(unknown, /motor power unknown \(the connected channel cannot send SACP 0x01 0x48/);
        assert.equal(motorPower.motorPowerRefusal(await read(STAY_POWER), 'home', '', ''), null);
        const note = motorPower.motorPowerNote(await read(STAY_POWER), 'basis');
        assert.equal(note.motion_allowed, true); assert.equal(note.basis, 'basis');
        assert.equal(motorPower.motorPowerNote(await read(SHUT_ALL), 'basis').motion_allowed, false);
    }],
    ['connectedMachine: the A350, the Original, the Artisan and the J1 read nothing; the Ray reads fresh on every call', async () => {
        for (const id of ['Snapmaker 2.0 A350', 'Original', 'Original Long Z-axis', 'A400', 'Snapmaker J1']) {
            const r = reader(SHUT_ALL);
            const cm = connectedMachineFor(id, { getMotorPowerMode: r.read, setMotorPowerMode: r.read });
            assert.equal(await cm.connectedMotorPower(), null, id);
            assert.equal(await cm.assertMotorPowered('home', 'Nothing was sent.'), null, `${id}: no gate`);
            assert.equal(cm.connectedMotorPowerNote(null), null);
            assert.equal(r.calls, 0, `${id}: no 0x48 request leaves`);
        }
        const r = reader(STAY_POWER);
        const ray = connectedMachineFor('Ray', { getMotorPowerMode: r.read });
        assert.equal((await ray.connectedMotorPower()).mode, 'STAYPOWER');
        assert.equal((await ray.assertMotorPowered('home', 'Nothing was sent.')).mode, 'STAYPOWER');
        r.mode = SHUT_ALL; // the operator switched to Manual Mode in Luban
        await assert.rejects(ray.assertMotorPowered('home', 'Nothing was sent.'),
            (err: Error) => err instanceof McpToolError && err.message.includes(SHUT_ALL_MESSAGE));
        assert.equal(r.calls, 3, 'one read per call, none cached');
        const note = ray.connectedMotorPowerNote(await ray.connectedMotorPower());
        assert.equal(note.mode, 'SHUTAll'); assert.equal(note.motion_allowed, false); assert.match(note.basis, /#321/);
        // A Ray channel without the read (plain-text USB): unknown, refused - never assumed powered.
        const textRay = connectedMachineFor('Ray', { executeGcode: async () => ({ result: 0 }) });
        assert.equal((await textRay.connectedMotorPower()).mode, 'unknown');
        await assert.rejects(textRay.assertMotorPowered('home', ''), /motor power unknown/);
        const noChannel = connectedMachineFor('Ray', null);
        await assert.rejects(noChannel.assertMotorPowered('home', ''), /motor power unknown/);
    }],
    ['Ray home: SHUTAll, ONLYLINEAR and unknown send nothing (not even M5); STAYPOWER sends M5 then $H and reports the mode', async () => {
        clearMcpLaserRecord();
        const r = reader(SHUT_ALL);
        const { camera, commands } = cameraFixture(true, r.read);
        await assert.rejects(camera.homeMachine('home', false, true), (err: Error) => err.message.includes(SHUT_ALL_MESSAGE));
        r.mode = ONLY_LINEAR;
        await assert.rejects(camera.homeMachine('home', false, true), /ONLYLINEAR/);
        r.mode = new Error('no reply');
        await assert.rejects(camera.homeMachine('home', false, true), /motor power unknown/);
        r.mode = 0;
        await assert.rejects(camera.homeMachine('home', false, true), /motor power unknown/);
        assert.deepEqual(commands, [], 'nothing was sent while the motors were not powered');
        r.mode = STAY_POWER;
        const result = await camera.homeMachine('home', false, true);
        assert.deepEqual(commands, ['M5', '$H']);
        assert.equal(result.motor_power.mode, 'STAYPOWER');
        assert.equal(result.motor_power.motion_allowed, true);
        assert.equal(r.calls, 5, 'read fresh before every home');
        clearMcpLaserRecord();
    }],
    ['A350 home: no motor-power read, no motor_power block, the same G53;G28;G54', async () => {
        const r = reader(SHUT_ALL);
        const { camera, commands } = cameraFixture(false, r.read);
        const result = await camera.homeMachine('home', false, true);
        assert.deepEqual(commands, ['G53;\nG28;\nG54;']);
        assert.ok(!('motor_power' in result));
        assert.equal(r.calls, 0);
    }],
    ['Ray start_gcode_job: SHUTAll, ONLYLINEAR and unknown refuse before the approval is consumed; STAYPOWER runs', async () => {
        const r = reader(SHUT_ALL);
        const f = jobFixture('direct-only', { dialect: 'ray-grbl', readMotorPowerMode: r.read });
        const job = f.createDirectJob();
        await assert.rejects(f.startDirect(job), (err: Error) => err.message.includes(SHUT_ALL_MESSAGE)
            && /the approval was not used/.test(err.message));
        r.mode = ONLY_LINEAR;
        await assert.rejects(f.startDirect(job), /ONLYLINEAR/);
        r.mode = new Error('timeout');
        await assert.rejects(f.startDirect(job), /motor power unknown/);
        assert.equal(job.state, 'approved'); assert.equal(job.confirmToken, 'human'); assert.ok(!job.tokenUsed);
        assert.equal(f.executed.length, 0);
        const procedure = f.createDirectJob('procedure');
        let ran = false;
        procedure.runner = async () => { ran = true; return {}; };
        r.mode = SHUT_ALL;
        await assert.rejects(f.call(procedure), /Manual Mode \/ SHUTAll/);
        assert.equal(procedure.state, 'approved'); assert.ok(!procedure.tokenUsed); assert.equal(ran, false);
        r.mode = STAY_POWER; // the operator switched to Control Mode: the same approval now starts
        await f.startDirect(job);
        assert.equal(job.state, 'completed');
        assert.equal(f.executed.length, 1);
    }],
    ['A350 start_gcode_job: no motor-power read, the direct job runs as before', async () => {
        const r = reader(SHUT_ALL);
        const f = jobFixture('file+direct', { readMotorPowerMode: r.read });
        const job = f.createDirectJob();
        await f.startDirect(job);
        assert.equal(job.state, 'completed');
        assert.equal(r.calls, 0);
    }],
    ['the MCP never sets the motor-power mode: it only calls the read-only getMotorPowerMode', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs'); const path = require('path');
        const root = path.join(__dirname, '..');
        const files: string[] = [];
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory() && entry.name !== 'tests' && entry.name !== 'node_modules') {
                    walk(full);
                } else if (/\.ts$/.test(entry.name)) {
                    files.push(full);
                }
            }
        };
        walk(root);
        const offenders = files.filter((file) => /\.setMotorPower\w*\s*\(|SetMotorPowerMode/.test(fs.readFileSync(file, 'utf8')));
        assert.deepEqual(offenders, [], 'no MCP source may set the motor-power mode');
    }],
];
