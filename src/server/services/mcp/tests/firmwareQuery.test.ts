import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { dialectById } from '../gcodeDialect';
import * as gcodeDialect from '../gcodeDialect';
import * as firmwareQuery from '../firmwareQuery';
import * as procedureLimits from '../procedureLimits';
import * as machineCapability from '../machineCapability';
import * as machineTravel from '../machineTravel';
import {
    FIRMWARE_QUERY_ALLOW_LIST, configurationQueriesFor, firmwareQueryRefusal, firmwareValuesFrom, laserAccelerationFrom,
    parseGrblBuildInfo, parseGrblOffsets, parseGrblParserState, parseGrblSettings, parseGrblStatus, parseM1005Serial, positionQueryFor,
} from '../firmwareQuery';
import { isFillPatternSerial, sacpDeviceSerial } from '../../machine/channels/sacpMachineState';
import { assembleReply } from '../../machine/channels/sacpGcodeReply';
import { validateGcode } from '../validator';
import { resolveTravel } from '../machineTravel';
import { isolatedModule } from './jobDashboard.test';
import { machineStoreFixture, machineToolsFixture } from './machineStore.test';

// Read-only firmware queries (#265 follow-up): the allow-list, the GRBL
// parsers on realistic GRBL 1.1 text, the fill-pattern serial rule and the
// store's no-conflict on a serial that was a fill pattern, the validator's use
// of a READ acceleration, the in-memory per-connection record
// (tools/firmware.ts) and the query tools' dialect routing (never M114 on GRBL).

const RAY = dialectById('ray-grbl');
const SM2 = dialectById('sm2-marlin');
const UNKNOWN = dialectById('unknown');

// GRBL 1.1f `$$` as it prints it. The VALUES are illustrative, not the Ray's -
// the hardware acceptance test reads the real ones.
const SETTINGS_TEXT = [
    '$0=10', '$1=25', '$2=0', '$3=0', '$4=0', '$5=0', '$6=0', '$10=1', '$11=0.010', '$12=0.002', '$13=0',
    '$20=1', '$21=1', '$22=1', '$23=3', '$24=1000.000', '$25=3000.000', '$26=250', '$27=2.000',
    '$30=1000', '$31=0', '$32=1',
    '$100=80.000', '$101=80.000', '$102=80.000', '$104=88.889',
    '$110=10000.000', '$111=10000.000', '$112=1000.000',
    '$120=1500.000', '$121=1200.000', '$122=100.000',
    '$130=600.000', '$131=400.000', '$132=0.000',
    'ok',
].join('\r\n');

const OFFSETS_TEXT = [
    '[G54:-50.000,-20.000,0.000,0.000]', '[G55:0.000,0.000,0.000,0.000]', '[G56:0.000,0.000,0.000,0.000]',
    '[G57:0.000,0.000,0.000,0.000]', '[G58:0.000,0.000,0.000,0.000]', '[G59:0.000,0.000,0.000,0.000]',
    '[G28:0.000,0.000,0.000,0.000]', '[G30:0.000,0.000,0.000,0.000]', '[G92:0.000,0.000,0.000,0.000]',
    '[TLO:0.000]', '[PRB:0.000,0.000,0.000,0.000:0]', 'ok',
].join('\n');

const PARSER_TEXT = '[GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0]\nok';
const BUILD_TEXT = '[VER:1.1f.20170801:]\n[OPT:V,15,128]\nok';
const M1005_TEXT = 'Machine: Snapmaker Ray\nFirmware Version: V1.7.4\nSN: RAY20AB1234567\nok';

interface Tool {
    name: string;
    handler: (args: object) => Promise<Record<string, unknown>>;
}

/** A registered tool's handler, asserting it exists. */
async function call(tools: Map<string, Tool>, name: string, args: object): Promise<Record<string, unknown>> {
    const tool = tools.get(name);
    assert.ok(tool, name);
    return (tool as Tool).handler(args);
}

const logger = () => ({ info: () => undefined, warn: () => undefined, debug: () => undefined, error: () => undefined });

function inert(file: string, overrides: Record<string, unknown>) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const deps: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    for (let m = pattern.exec(source); m !== null; m = pattern.exec(source)) { deps[m[1]] = {}; }
    return isolatedModule(file, { ...deps, ...overrides }, { clearTimeout, Date, JSON });
}

/** tools/firmware.ts with a scripted Ray channel over SACP. */
function firmwareFixture(script: { [query: string]: string | null } = {}) {
    const sent: string[] = [];
    const adopted: Array<[string, string]> = [];
    const listeners: Array<(ready: { generation: string; machineIdentifier: string | null }) => void> = [];
    const live = { generation: '1.1', connected: true, status: 'idle' as string | null, job: null as object | null, state: true };
    const channel = {
        executeGcode: async (line: string) => { sent.push(`plain:${line}`); return { result: 0, text: 'ok' }; },
        executeGcodeWithReply: async (line: string) => {
            sent.push(line);
            const text = line in script ? script[line] : null;
            const lines = text ? [{ level: 2, text }] : [];
            return assembleReply({ result: 0, ackData: null, ackReceived: true, listening: true, subscribed: true, lines, timedOut: false, elapsedMs: 3 });
        },
    };
    const connectionManager = {
        getConnectionGeneration: () => live.generation,
        getConnectionStatus: () => ({ connected: live.connected, machineIdentifier: 'Ray', deviceSerial: null }),
        getCurrentChannel: () => channel,
        getLatestMachineState: () => (live.state ? { status: live.status, timestamp: Date.now() } : null),
        adoptFirmwareSerial: (sn: string, generation: string) => { adopted.push([sn, generation]); return true; },
        onMachineReady: (listener: (ready: { generation: string; machineIdentifier: string | null }) => void) => {
            listeners.push(listener);
            return () => undefined;
        },
    };
    const firmware = inert('tools/firmware.ts', {
        '../../../lib/logger': logger,
        '../../machine/ConnectionManager': { connectionManager },
        '../index': { mcpBroadcast: () => undefined },
        '../jobs': { jobManager: { getActive: () => live.job } },
        '../connectedMachine': { connectedDialect: () => RAY, connectedMachineTag: () => '(machine: Ray)' },
        '../gcodeDialect': gcodeDialect,
        '../firmwareQuery': firmwareQuery,
        '../procedureLimits': procedureLimits,
        '../registry': { McpToolError: Error },
    });
    return { firmware, sent, adopted, live, listeners };
}

const FULL_SCRIPT = { $$: SETTINGS_TEXT, '$#': OFFSETS_TEXT, $G: PARSER_TEXT, $I: BUILD_TEXT, M1005: M1005_TEXT };

/** Wait until `done()` or ~1 s. */
async function until(done: () => boolean): Promise<void> {
    for (let i = 0; i < 100 && !done(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

/** The query tools of tools/camera.ts with every import inert and the dialect / firmware runtime stubbed. */
function cameraTools(dialectId: 'ray-grbl' | 'sm2-marlin' | 'unknown') {
    const commands: string[] = [];
    const firmwareCalls: string[] = [];
    const camera = inert('tools/camera.ts', {
        '../../../lib/logger': logger,
        '../procedureLimits': procedureLimits,
        '../index': { mcpBroadcast: () => undefined },
        '../registry': { McpToolError: Error },
        '../positionOfRecord': { bumpGcodeSequence: () => 1, noteDirectGcodeStart: () => undefined, noteDirectGcodeEnd: () => undefined },
        '../diagnostics': { recordGcodeTiming: () => undefined },
        '../failureRecovery': { recordModalSend: () => () => undefined, classifyReply: () => 'accepted' },
        '../probeFeed': { probeFeedService: { motionBegin: () => undefined, motionEnd: () => undefined } },
        '../jobs': { jobManager: { getActive: () => null } },
        './machine': { motionDialect: () => dialectById(dialectId), getPositionSnapshot: () => null },
        '../connectedMachine': { connectedMachineTag: () => `(machine: ${dialectId})`, describeConnectedMachine: () => ({ identifier: dialectId }) },
        '../../machine/ConnectionManager': { connectionManager: {
            getCurrentChannel: () => ({ executeGcode: async (gcode: string) => { commands.push(gcode); return { result: 0, text: 'ok' }; } }),
            getLatestMachineState: () => null,
            getConnectionStatus: () => ({ connected: true, deviceSerial: null }),
        } },
        './firmware': {
            firmwareReadBlocker: () => null,
            queryGrblPosition: async () => { firmwareCalls.push('?'); throw new Error('no GRBL status report - use get_position'); },
            readFirmwareConfiguration: async (input: { queries?: string[] }) => {
                firmwareCalls.push(`config:${(input.queries || ['default']).join(',')}`);
                return { replies: [], serialAdopted: false };
            },
            parseFirmwareRecord: () => ({}),
            currentFirmwareRecord: () => null,
            firmwareView: () => null,
            describeFirmwareRead: () => '',
        },
    });
    const tools: Map<string, Tool> = new Map();
    camera.registerCameraTools({ register: (tool: Tool) => tools.set(tool.name, tool) });
    return { tools, commands, firmwareCalls };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    // ---- Allow-list -----------------------------------------------------------
    ['the configuration set and position query follow the dialect row', () => {
        assert.deepEqual(configurationQueriesFor(RAY), ['$$', '$#', '$G', '$I', 'M1005']);
        assert.deepEqual(configurationQueriesFor(SM2), ['M503 S']);
        assert.deepEqual(configurationQueriesFor(UNKNOWN), []);
        assert.equal(positionQueryFor(RAY), '?', 'GRBL status is "?" - never M114');
        assert.equal(positionQueryFor(SM2), 'M114');
        assert.equal(positionQueryFor(UNKNOWN), null);
        assert.ok(!FIRMWARE_QUERY_ALLOW_LIST.grbl.includes('M114'));
    }],
    ['the allow-list refuses writes, commands, motion and multi-line text', () => {
        for (const ok of ['$$', '$#', '$G', '$I', 'M1005', '?', ' $$ ', '$g']) {
            assert.equal(firmwareQueryRefusal(RAY, ok), null, ok);
        }
        for (const bad of ['$X', '$H', '$RST=*', '$RST=$', '$110=500', '$120=', '$J=G91 X1 F100', '$C', '$SLP', 'G0 X10', 'M3 S1000',
            'M114', '$$\n$X', '$$;$X', '$$\r$H', '', '   ']) {
            assert.ok(firmwareQueryRefusal(RAY, bad), `refused: ${JSON.stringify(bad)}`);
        }
        assert.match(String(firmwareQueryRefusal(RAY, '$110=500')), /WRITES a setting/);
        assert.equal(firmwareQueryRefusal(SM2, 'M503 S'), null);
        assert.ok(firmwareQueryRefusal(SM2, '$$'), 'GRBL queries are not sent to Marlin');
        assert.ok(firmwareQueryRefusal(UNKNOWN, '$$'), 'nothing is sent to an unknown dialect');
        assert.ok(firmwareQueryRefusal(RAY, 42 as unknown as string));
    }],

    // ---- Parsers ---------------------------------------------------------------
    ['$$ parses by number with GRBL names and units; values the MCP uses come out typed', () => {
        const settings = parseGrblSettings(SETTINGS_TEXT);
        assert.equal(Object.keys(settings).length, 35);
        assert.deepEqual({ ...settings.$120 }, { key: '$120', value: 1500, raw: '$120=1500.000', name: 'X acceleration', unit: 'mm/s^2' });
        assert.equal(settings.$111.name, 'Y max rate');
        assert.equal(settings.$131.name, 'Y max travel');
        assert.equal(settings.$30.name, 'max spindle speed (S max)');
        assert.equal(settings.$32.name, 'laser mode');
        assert.equal(settings.$104.name, 'B steps per mm', 'axis index 4 is B (Grbl_Esp32 numbering)');
        const named = parseGrblSettings('$Sta/SSID=Workshop\n$10=3 (status report)\nok');
        assert.equal(named['$Sta/SSID'].value, 'Workshop');
        assert.equal(named.$10.value, 3);
        const values = firmwareValuesFrom(settings);
        assert.equal(values.acceleration.x && values.acceleration.x.value, 1500);
        assert.equal(values.acceleration.y && values.acceleration.y.value, 1200);
        assert.equal(values.sMax && values.sMax.value, 1000);
        assert.equal(values.maxRate.x && values.maxRate.x.value, 10000);
        assert.equal(values.maxTravel.y && values.maxTravel.y.value, 400);
        assert.equal(values.laserMode, true);
        assert.deepEqual({ ...laserAccelerationFrom(values) }, { value: 1200, settings: ['$120', '$121'] }, 'the LOWER of X and Y');
        assert.equal(laserAccelerationFrom(firmwareValuesFrom(parseGrblSettings('$120=0\nok'))), null, 'zero is no acceleration');
    }],
    ['$#, $G, $I and "?" parse; M1005 yields the product SN and rejects fill values', () => {
        const offsets = parseGrblOffsets(OFFSETS_TEXT);
        assert.deepEqual(offsets.G54, [-50, -20, 0, 0]);
        assert.deepEqual(offsets.G92, [0, 0, 0, 0]);
        assert.equal(offsets.TLO, 0);
        assert.deepEqual(offsets.PRB, { values: [0, 0, 0, 0], success: false });
        const parser = parseGrblParserState(PARSER_TEXT);
        assert.ok(parser);
        assert.equal(parser && parser.workspace, 'G54');
        assert.equal(parser && parser.distance, 'absolute');
        assert.equal(parser && parser.units, 'mm');
        assert.equal(parser && parser.spindle, 'M5');
        assert.equal(parser && parser.feed, 0);
        assert.equal(parseGrblParserState('ok'), null);
        assert.deepEqual({ ...parseGrblBuildInfo(BUILD_TEXT) }, { version: '1.1f.20170801', options: 'V,15,128', lines: ['[VER:1.1f.20170801:]', '[OPT:V,15,128]'] });
        const status = parseGrblStatus('<Idle|MPos:12.000,34.500,0.000,90.000|FS:0,0|WCO:2.000,4.000,0.000,0.000>\nok');
        assert.ok(status);
        assert.equal(status && status.state, 'Idle');
        assert.deepEqual(status && status.mpos, [12, 34.5, 0, 90]);
        assert.deepEqual(status && status.wco, [2, 4, 0, 0]);
        assert.equal(parseGrblStatus('ok'), null);
        assert.equal(parseM1005Serial(M1005_TEXT), 'RAY20AB1234567');
        assert.equal(parseM1005Serial('Product SN = 2048ABCDEF'), '2048ABCDEF');
        assert.equal(parseM1005Serial('Serial Number: 00000000'), null, 'a repeated character is no SN');
        assert.equal(parseM1005Serial('Firmware Version: V1.7.4\nok'), null);
    }],

    // ---- Serial identity -------------------------------------------------------
    ['fill-pattern serials (0, 0xFFFFFFFF, one byte repeated) are no serial; real ones pass', () => {
        for (const fill of [0, 0xffffffff, 0x66666666, 1717986918, '1717986918', 0x11111111, 0x01010101]) {
            assert.equal(isFillPatternSerial(fill), true, String(fill));
            assert.equal(sacpDeviceSerial({ masterControlSerialNumber: fill }), null, String(fill));
        }
        for (const real of [20481234, 0x66666667, 1, '111', 0x12121213]) {
            assert.equal(isFillPatternSerial(real), false, String(real));
        }
        assert.equal(sacpDeviceSerial({ masterControlSerialNumber: 20481234 }), '20481234');
        assert.equal(isFillPatternSerial('RAY20AB1234567'), false, 'a non-numeric SN is never a fill pattern');
    }],
    ['a Ray entry recorded under the fill serial gains the M1005 SN as an alias - no split, no deviceConflict', () => {
        const f = machineStoreFixture();
        f.connect({ machineIdentifier: 'Ray', deviceSerial: '1717986918' });
        assert.equal(f.store.currentMachine().deviceId, null, 'the fill pattern presents no device id');
        // The store as the pre-rule build left it: the fill serial recorded as an alias.
        const data = f.store.load();
        data.machines.Ray = { devices: [{ id: 'sn:1717986918', firstSeen: 1, lastSeen: 1 }], travel: { xMax: { value: 400 } } };
        f.config.set('mcpMachines', data);
        f.connect({ machineIdentifier: 'Ray', deviceSerial: 'RAY20AB1234567' });
        const current = f.store.currentMachine();
        assert.equal(current.deviceConflict, null);
        assert.equal(current.machineKey, 'Ray', 'the same entry, not a split');
        assert.deepEqual(f.store.load().machines.Ray.devices.map((d: { id: string }) => d.id), ['sn:1717986918', 'sn:RAY20AB1234567']);
        assert.deepEqual(Object.keys(f.store.load().machines), ['Ray']);
        // A second, different REAL serial still conflicts.
        f.connect({ machineIdentifier: 'Ray', deviceSerial: 'RAY20ZZ9999999' });
        assert.ok(f.store.currentMachine().deviceConflict);
    }],

    // ---- Validator ---------------------------------------------------------------
    ['the M4 short-segment rule uses a READ acceleration when given, else states the 1000 mm/s^2 assumption', () => {
        const travel = resolveTravel({
            size: { x: 600, y: 400 }, fudge: { x: 0, y: 0 }, stated: { xMin: null, xMax: null, yMin: null, yMax: null }, observed: null,
        });
        const options = { dialect: RAY, machineIdentifier: 'Ray', hasZ: false, supportsRotary: false, travel, phase: 'validate' as const };
        // F3000 needs 1.25 mm at 1000 mm/s^2, 0.25 mm at 5000: a 0.5 mm segment is short only under the assumption.
        const gcode = ['G90', 'G0 X10 Y10', 'M4 S500', 'G1 X10.5 Y10 F3000', 'G1 X11 Y10', 'M5'].join('\n');
        const assumed = validateGcode(gcode, options);
        const assumedWarning = assumed.warnings.find((w) => w.includes('[laser-mode-dynamic-short-segments]'));
        assert.ok(assumedWarning && /ASSUMPTION: acceleration 1000 mm\/s\^2/.test(assumedWarning));
        const read = validateGcode(gcode, { ...options, laserAcceleration: { value: 5000, source: 'firmware $$ $120/$121 (the lower), read now' } });
        assert.equal(read.warnings.filter((w) => w.includes('[laser-mode-dynamic-short-segments]')).length, 0, 'long enough at the real 5000');
        const slow = validateGcode(gcode, { ...options, laserAcceleration: { value: 200, source: 'firmware $$ $120/$121 (the lower)' } });
        const slowWarning = slow.warnings.find((w) => w.includes('[laser-mode-dynamic-short-segments]'));
        assert.ok(slowWarning && /Acceleration 200 mm\/s\^2 \(firmware \$\$/.test(slowWarning), String(slowWarning));
        assert.ok(slowWarning && !/ASSUMPTION/.test(slowWarning));
        assert.ok(slowWarning && /that distance is 6\.25 mm/.test(slowWarning), 'the threshold is (F/60)^2 / 2a at the read value');
    }],

    // ---- In-memory per-connection record (tools/firmware.ts) -----------------------
    ['a configuration read sends the five queries one at a time and keeps the parse in memory for THIS connection', async () => {
        const f = firmwareFixture(FULL_SCRIPT);
        const { replies, serialAdopted } = await f.firmware.readFirmwareConfiguration({ tool: 't', trigger: 'on-demand' });
        assert.deepEqual(f.sent, ['$$', '$#', '$G', '$I', 'M1005']);
        assert.equal(replies.length, 5);
        assert.equal(serialAdopted, true);
        assert.deepEqual(f.adopted, [['RAY20AB1234567', '1.1']], 'the M1005 SN, bound to the connection it was read on');
        const view = JSON.parse(JSON.stringify(f.firmware.firmwareView()));
        assert.equal(view.source, '$$ $# $G $I M1005');
        assert.equal(view.replyRoute, 'log-feedback');
        assert.equal(view.values.acceleration.x.value, 1500);
        assert.equal(view.values.sMax.value, 1000);
        assert.equal(view.laserAcceleration.value, 1200);
        assert.equal(view.raw, undefined, 'raw only when asked');
        assert.match(JSON.parse(JSON.stringify(f.firmware.firmwareView({ raw: true }))).raw.$I, /VER:1\.1f/);
        const acceleration = f.firmware.currentLaserAcceleration();
        assert.equal(acceleration.value, 1200);
        assert.match(acceleration.source, /firmware \$\$ \$120\/\$121/);
        // A new connection generation: nothing carries over.
        f.live.generation = '2.1';
        assert.equal(f.firmware.currentFirmwareRecord(), null);
        assert.equal(f.firmware.firmwareView(), null);
        assert.equal(f.firmware.currentLaserAcceleration(), null);
    }],
    ['a refused query sends nothing; only allow-listed strings reach the channel', async () => {
        const f = firmwareFixture(FULL_SCRIPT);
        for (const bad of [['$X'], ['$$', '$110=500'], ['$H'], ['M114']]) {
            await assert.rejects(f.firmware.readFirmwareConfiguration({ tool: 't', trigger: 'on-demand', queries: bad }), /Refused|Nothing was sent/);
        }
        assert.deepEqual(f.sent, []);
        await f.firmware.readFirmwareConfiguration({ tool: 't', trigger: 'on-demand', queries: ['$G'] });
        assert.deepEqual(f.sent, ['$G']);
    }],
    ['GRBL position: "?" only, never M114; refused without sending when this connection returns no text', async () => {
        const answered = firmwareFixture({ '?': '<Idle|MPos:1.000,2.000,0.000|FS:0,0>' });
        const { status } = await answered.firmware.queryGrblPosition('t');
        assert.deepEqual(status.mpos, [1, 2, 0]);
        assert.deepEqual(answered.sent, ['?']);
        const silent = firmwareFixture({});
        await silent.firmware.readFirmwareConfiguration({ tool: 't', trigger: 'on-demand' });
        assert.equal(silent.firmware.firmwareView().source, null, 'acknowledged, no text');
        const before = silent.sent.length;
        await assert.rejects(silent.firmware.queryGrblPosition('t'), /nothing was sent.*get_position/s);
        assert.equal(silent.sent.length, before, '"?" is not sent once the connection is known to return no text');
        assert.ok(!silent.sent.includes('M114') && !answered.sent.includes('M114'));
    }],
    ['first connect: read once in the background when idle with no job; skipped mid-job or while not idle', async () => {
        const busy = firmwareFixture(FULL_SCRIPT);
        busy.firmware.startFirmwareReadOnConnect();
        assert.equal(busy.listeners.length, 1);
        busy.live.job = { id: 'job-1' };
        busy.listeners[0]({ generation: '1.1', machineIdentifier: 'Ray' });
        busy.live.status = 'running';
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.deepEqual(busy.sent, [], 'an MCP job is active: nothing sent');
        const running = firmwareFixture(FULL_SCRIPT);
        running.firmware.startFirmwareReadOnConnect();
        running.live.status = 'running';
        running.listeners[0]({ generation: '1.1', machineIdentifier: 'Ray' });
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.deepEqual(running.sent, [], 'the machine is running: nothing sent');
        const idle = firmwareFixture(FULL_SCRIPT);
        idle.firmware.startFirmwareReadOnConnect();
        idle.listeners[0]({ generation: '1.1', machineIdentifier: 'Ray' });
        await until(() => idle.sent.length === 5 && !!idle.firmware.currentFirmwareRecord());
        assert.deepEqual(idle.sent, ['$$', '$#', '$G', '$I', 'M1005']);
        assert.equal(idle.firmware.currentFirmwareRecord().trigger, 'first-connect');
    }],

    // ---- Tool routing (tools/camera.ts) -------------------------------------------------
    ['query_firmware_position never sends M114 to ray-grbl; the A350 still gets M114; unknown is refused', async () => {
        const ray = cameraTools('ray-grbl');
        await assert.rejects(call(ray.tools, 'query_firmware_position', {}), /get_position/);
        assert.deepEqual(ray.commands, [], 'nothing on the plain path - in particular no M114');
        assert.deepEqual(ray.firmwareCalls, ['?']);
        const unknown = cameraTools('unknown');
        await assert.rejects(call(unknown.tools, 'query_firmware_position', {}), /nothing was sent/);
        await assert.rejects(call(unknown.tools, 'query_firmware_configuration', {}), /nothing was sent/);
        assert.deepEqual(unknown.commands, []);
        const a350 = cameraTools('sm2-marlin');
        await assert.rejects(call(a350.tools, 'query_firmware_position', {}), /no position text/);
        assert.deepEqual(a350.commands, ['M114']);
    }],
    ['query_firmware_configuration: the Ray reads through the firmware runtime; Marlin keeps M503 S and refuses GRBL strings', async () => {
        const ray = cameraTools('ray-grbl');
        await call(ray.tools, 'query_firmware_configuration', {});
        await call(ray.tools, 'query_firmware_configuration', { queries: ['$G'] });
        assert.deepEqual(ray.firmwareCalls, ['config:default', 'config:$G']);
        assert.deepEqual(ray.commands, []);
        const a350 = cameraTools('sm2-marlin');
        await assert.rejects(call(a350.tools, 'query_firmware_configuration', { queries: ['$$'] }), /M503 S only/);
        assert.deepEqual(a350.commands, []);
        await assert.rejects(call(a350.tools, 'query_firmware_configuration', {}), /No fresh machine data/);
        assert.deepEqual(a350.commands, ['M503 S']);
    }],

    // ---- get_machine_profile ---------------------------------------------------------------
    ['get_machine_profile reports the dialect of the machine it describes, and firmware only for the connected one', async () => {
        const firmwareBlock = { readAt: '2026-10-19T10:00:00.000Z', source: '$$ $# $G $I M1005' };
        const machines = ['Ray', 'Snapmaker 2.0 A350'].map((identifier) => ({
            identifier, fullName: identifier, machineType: 'Laser', metadata: { size: { x: 600, y: 400, z: 0 }, toolHeads: [], modules: [] },
        }));
        const capabilityFor = (id: string | null) => machineCapability.deriveMachineCapability(
            (machines.find((m) => m.identifier === id) || null) as never, id,
        );
        const f = machineToolsFixture({}, {}, {
            '../../machine/ConnectionManager': { connectionManager: {
                getConnectionStatus: () => ({ connected: true, machineIdentifier: 'Ray' }),
                getLatestMachineState: () => null,
            } },
            '../connectedMachine': {
                MACHINES: machines,
                findMachine: (id: string) => machines.find((m) => m.identifier === id) || null,
                machineCapabilityFor: capabilityFor,
                connectedMachineTag: () => '(test machine)',
            },
            '../machineTravel': machineTravel,
            './firmware': { firmwareView: () => firmwareBlock },
        });
        f.connect({ machineIdentifier: 'Ray' });
        const handlers: Record<string, (args: object) => Promise<Record<string, unknown>>> = {};
        f.tools.registerMachineTools({ register: (tool: Tool) => {
            handlers[tool.name] = tool.handler;
        } });
        const ray = await handlers.get_machine_profile({});
        assert.equal(ray.dialect, 'ray-grbl');
        assert.deepEqual(JSON.parse(JSON.stringify(ray.firmware)), firmwareBlock);
        const a350 = await handlers.get_machine_profile({ identifier: 'Snapmaker 2.0 A350' });
        assert.equal(a350.dialect, 'sm2-marlin');
        assert.equal(a350.firmware, null, 'not the connected machine');
    }],
];
