// The per-machine G-code dialect table (gcodeDialect.ts) and the supports
// flags / capability refusals derived from it (machineCapability.ts,
// connectedMachine.ts requireCapability) - tyeth/Luban#265 WP1.
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

import * as gcodeDialect from '../gcodeDialect';
import * as machineCapability from '../machineCapability';
import { McpToolError } from '../registry';

const { DIALECTS, WIKI, codeStatus, dialectById, dialectEmits, dialectFor } = gcodeDialect;
const { G28_HOME_SEQUENCE, capabilityRefusal, deriveMachineCapability } = machineCapability;

// The eight Luban machine definitions, identifiers and toolhead identifiers
// copied verbatim from src/app/machines/*.ts and src/app/constants/machines.ts
// (the real modules import @snapmaker/luban-platform, which is ESM and does not
// load under the test runner).
const SM2_HEADS = [
    'singleExtruderToolheadForSM2', 'dualExtruderToolheadForSM2', 'levelOneLaserToolheadForSM2', 'levelTwoLaserToolheadForSM2',
    '20W Laser Module', '40W Laser Module', '2W Laser Module', 'standardCNCToolheadForSM2', 'levelTwoCNCToolheadForSM2',
];
const ORIGINAL_HEADS = ['singleExtruderToolheadForOriginal', 'levelOneLaserToolheadForOriginal', 'levelTwoLaserToolheadForOriginal', 'standardCNCToolheadForOriginal'];
function definition(identifier: string, machineType: string, size: [number, number, number], heads: string[]) {
    return { identifier, machineType, metadata: { size: { x: size[0], y: size[1], z: size[2] }, toolHeads: heads.map((id) => ({ identifier: id })) } };
}
const DEFINITIONS = {
    original: definition('Original', 'Multi-function 3D Printer', [125, 125, 125], ORIGINAL_HEADS),
    originalLongZ: definition('Original Long Z-axis', 'Multi-function 3D Printer', [125, 125, 221], ORIGINAL_HEADS),
    a150: definition('Snapmaker 2.0 A150', 'Multi-function 3D Printer', [160, 160, 140], SM2_HEADS),
    a250: definition('Snapmaker 2.0 A250', 'Multi-function 3D Printer', [230, 250, 230], SM2_HEADS),
    a350: definition('Snapmaker 2.0 A350', 'Multi-function 3D Printer', [320, 350, 325], SM2_HEADS),
    artisan: definition('A400', 'Multi-function 3D Printer', [400, 400, 400], [
        'dualExtruderToolheadForSM2', 'dualExtruderToolheadForArtisan', 'levelTwoLaserToolheadForSM2',
        '20W Laser Module', '40W Laser Module', '2W Laser Module', 'levelTwoCNCToolheadForSM2',
    ]),
    j1: definition('Snapmaker J1', '3D Printer', [324, 200, 200], ['Snapmaker J1 IDEX Tool Head']),
    ray: definition('Ray', 'Laser', [600, 400, 0], ['20W Laser Module', '40W Laser Module', '2W Laser Module']),
};

/** connectedMachine.ts loaded with its server imports stubbed (pattern of connectionLease.test.ts). */
function loadConnectedMachine(connected: string | null) {
    const file = path.join(__dirname, '../connectedMachine.ts');
    const source = fs.readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    } });
    const machines = Object.values(DEFINITIONS);
    const dependencies: Record<string, unknown> = {
        '../../../app/machines': {
            SnapmakerOriginalMachine: DEFINITIONS.original,
            SnapmakerOriginalExtendedMachine: DEFINITIONS.originalLongZ,
            SnapmakerA150Machine: DEFINITIONS.a150,
            SnapmakerA250Machine: DEFINITIONS.a250,
            SnapmakerA350Machine: DEFINITIONS.a350,
            SnapmakerArtisanMachine: DEFINITIONS.artisan,
            SnapmakerJ1Machine: DEFINITIONS.j1,
            SnapmakerRayMachine: DEFINITIONS.ray,
        },
        '../machine/ConnectionManager': { connectionManager: { getConnectionStatus: () => ({ machineIdentifier: connected }) } },
        './gcodeDialect': gcodeDialect,
        './machineCapability': machineCapability,
        './registry': { McpToolError },
        './toolheadState': require('../toolheadState'),
        './motorPower': require('../motorPower'),
    };
    const exports = {} as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    vm.runInNewContext(compiled.outputText, {
        exports,
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return dependencies[name];
        },
    });
    assert.equal(machines.length, 8);
    return exports;
}

function caughtMessage(fn: () => unknown): string {
    try {
        fn();
    } catch (err) {
        assert.ok(err instanceof McpToolError, `expected McpToolError, got ${String(err)}`);
        return (err as Error).message;
    }
    throw new Error('expected a refusal');
}

export const tests: Array<[string, () => void]> = [
    // ---- One row per machine (plan 1.2, verified against the wiki 2026-10-19) ----
    ['Ray: GRBL, G53 only as a same-line prefix, relative steps, $H home, S 0-1000, no Z', () => {
        const d = dialectFor(DEFINITIONS.ray);
        assert.equal(d.id, 'ray-grbl');
        assert.equal(d.family, 'grbl');
        assert.equal(d.frames.g53, 'same-line');
        assert.deepEqual(d.frames.workspaces, ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']);
        assert.equal(d.frames.g921, true);
        assert.equal(d.transportForm, 'relative-steps');
        assert.deepEqual(d.home, { form: '$H', gcode: '$H', homesB: false });
        assert.equal(d.status, 'grbl-?');
        assert.equal(d.laser?.s.max, 1000);
        assert.equal(d.laser?.p, null);
        assert.deepEqual(d.laser?.air, { on: 'M8', off: 'M9' });
        assert.equal(d.laser?.crosshair?.on, 'M2000 L13 P1');
        assert.equal(d.spindle, null);
        assert.equal(codeStatus(d, 'G59.1'), 'incompatible');
        assert.equal(codeStatus(d, 'M114'), 'unlisted');
        assert.ok(d.sources.includes(WIKI.ray));
    }],

    ['Snapmaker 2.0 A150/A250/A350: own-line G53 (the only form the MCP emits), G28 homes B, S 0-255 with P winning', () => {
        for (const def of [DEFINITIONS.a150, DEFINITIONS.a250, DEFINITIONS.a350]) {
            assert.equal(dialectFor(def).id, 'sm2-marlin', def.identifier);
        }
        const d = dialectById('sm2-marlin');
        assert.equal(d.frames.g53, 'own-line');
        assert.deepEqual(d.frames.g53Accepted, ['own-line', 'same-line']);
        assert.equal(d.frames.workspaces.length, 9);
        assert.equal(d.frames.g921, false);
        assert.equal(d.transportForm, 'sm2');
        assert.equal(d.home.form, 'G28');
        assert.equal(d.home.homesB, true);
        assert.equal(d.laser?.s.max, 255);
        assert.equal(d.laser?.precedence, 'P');
        assert.equal(d.laser?.crosshair?.on, 'M2002 T3 P1');
        assert.deepEqual(d.spindle?.s, { min: 8000, max: 18000 });
        assert.equal(codeStatus(d, 'G38'), 'incompatible');
        assert.equal(codeStatus(d, 'g2'), 'unverified');
        assert.equal(codeStatus(d, 'M106'), 'supported');
        assert.equal(codeStatus(d, 'M503'), 'supported');
        assert.equal(codeStatus(d, 'G59.3'), 'supported');
    }],

    ['the 2.0 row\'s home gcode is byte-identical to Luban\'s Home sequence the home tool sends', () => {
        assert.equal(dialectById('sm2-marlin').home.gcode, G28_HOME_SEQUENCE);
    }],

    ['Artisan (A400): own-line G53, SACP home request, G92.1, G20 refused, M2000 L13 crosshair', () => {
        const d = dialectFor('A400');
        assert.equal(d.id, 'artisan-marlin');
        assert.equal(d.frames.g53, 'own-line');
        assert.equal(d.frames.g921, true);
        assert.equal(d.transportForm, 'sm2');
        assert.equal(d.home.form, 'sacp-request');
        assert.equal(d.home.gcode, null);
        assert.equal(d.laser?.s.max, 255);
        assert.equal(d.laser?.crosshair?.on, 'M2000 L13 P1');
        assert.equal(codeStatus(d, 'G20'), 'incompatible');
        assert.equal(codeStatus(d, 'G29'), 'unverified');
        assert.equal(codeStatus(d, 'M84'), 'incompatible');
    }],

    ['J1: no G53/G54 at all, relative steps, SACP home, no laser or spindle', () => {
        const d = dialectFor(DEFINITIONS.j1);
        assert.equal(d.id, 'j1-marlin');
        assert.equal(d.frames.g53, 'none');
        assert.deepEqual(d.frames.workspaces, []);
        assert.equal(d.transportForm, 'relative-steps');
        assert.equal(d.home.form, 'sacp-request');
        assert.equal(d.laser, null);
        assert.equal(d.spindle, null);
        assert.equal(codeStatus(d, 'G92.1'), 'incompatible');
        assert.equal(codeStatus(d, 'M84'), 'supported');
    }],

    ['Original and Original Long Z-axis: no G53, relative steps, G28 alone, S 0-255, marked unverified against wiki', () => {
        assert.equal(dialectFor(DEFINITIONS.originalLongZ).id, 'original-marlin');
        const d = dialectFor('Original');
        assert.equal(d.id, 'original-marlin');
        assert.equal(d.frames.g53, 'none');
        assert.equal(d.transportForm, 'relative-steps');
        assert.deepEqual(d.home, { form: 'G28', gcode: 'G28', homesB: false });
        assert.equal(d.laser?.s.max, 255);
        assert.deepEqual(d.laser?.modes, ['M3']);
        assert.match(d.sources.join(' '), /from Luban generators, unverified against wiki/);
    }],

    ['an unlisted machine gets the unknown row, which emits nothing', () => {
        for (const input of ['Some Future Machine', '', null, undefined, { identifier: 'Snapmaker U1' }]) {
            const d = dialectFor(input);
            assert.equal(d.id, 'unknown');
            assert.equal(dialectEmits(d), false);
            assert.equal(d.transportForm, 'none');
            assert.equal(d.home.form, 'none');
            assert.equal(d.laser, null);
        }
        for (const d of DIALECTS.filter((row) => row.id !== 'unknown')) {
            assert.equal(dialectEmits(d), true, d.id);
        }
    }],

    ['verifiedOnHardware is true only for sm2-marlin', () => {
        assert.deepEqual(DIALECTS.filter((d) => d.verifiedOnHardware).map((d) => d.id), ['sm2-marlin']);
    }],

    ['every row cites its source; the code lists never list one code twice or in two lists', () => {
        for (const d of DIALECTS) {
            assert.ok(d.sources.length > 0, d.id);
            const all = [...d.supported, ...d.unverified, ...d.incompatible];
            assert.equal(new Set(all).size, all.length, `${d.id} lists a code twice`);
        }
        assert.ok(dialectById('sm2-marlin').supported.includes('M107'), 'M104-M109 range expands');
    }],

    // ---- supports flags for all eight definitions ----
    ['supports: the 2.0 machines and the Artisan can do everything; the Ray only laser; the J1 only Z; the Original laser, spindle, Z', () => {
        const all = { probing: true, toolSetter: true, rotary: true, laser: true, spindle: true, workspaces: true, zAxis: true };
        const none = { probing: false, toolSetter: false, rotary: false, laser: false, spindle: false, workspaces: false, zAxis: false };
        const expected: Record<keyof typeof DEFINITIONS, typeof all> = {
            original: { ...none, laser: true, spindle: true, zAxis: true },
            originalLongZ: { ...none, laser: true, spindle: true, zAxis: true },
            a150: all,
            a250: all,
            a350: all,
            artisan: all,
            j1: { ...none, zAxis: true },
            ray: { ...none, laser: true },
        };
        for (const [key, def] of Object.entries(DEFINITIONS)) {
            assert.deepEqual(deriveMachineCapability(def).supports, expected[key as keyof typeof DEFINITIONS], key);
        }
    }],

    ['the Ray is Z-less: hasZ false and supports.zAxis false, though its dialect has a B word', () => {
        const cap = deriveMachineCapability(DEFINITIONS.ray);
        assert.equal(cap.hasZ, false);
        assert.equal(cap.supports.zAxis, false);
        assert.equal(cap.dialect.rotaryAxis, 'B');
        assert.equal(cap.supports.rotary, false);
    }],

    ['without a toolhead list the row alone decides laser/spindle; with one, a missing module turns the flag off', () => {
        const bare = { identifier: 'Snapmaker 2.0 A350', machineType: 'x', metadata: { size: { x: 320, y: 350, z: 325 } } };
        assert.equal(deriveMachineCapability(bare).supports.spindle, true);
        const laserOnly = { ...bare, metadata: { ...bare.metadata, toolHeads: [{ identifier: '20W Laser Module' }] } };
        const cap = deriveMachineCapability(laserOnly);
        assert.equal(cap.supports.laser, true);
        assert.equal(cap.supports.spindle, false);
        assert.equal(cap.supports.probing, false);
    }],

    // ---- Refusals ----
    ['capabilityRefusal names the machine, the missing fact and the table source', () => {
        const j1 = deriveMachineCapability(DEFINITIONS.j1);
        const text = capabilityRefusal(j1, 'probing', 'probe_point') || '';
        assert.match(text, /^probe_point needs probing, which this MCP does not support on Snapmaker J1 \(connected machine: Snapmaker J1/);
        assert.match(text, /no spindle words/);
        assert.match(text, /documents no G53\/G54 workspaces/);
        assert.ok(text.includes(WIKI.j1));
        assert.equal(capabilityRefusal(deriveMachineCapability(DEFINITIONS.a350), 'probing', 'probe_point'), null);

        const ray = capabilityRefusal(deriveMachineCapability(DEFINITIONS.ray), 'zAxis', 'move_z') || '';
        assert.match(ray, /no Z axis/);
        const rayWorkspace = capabilityRefusal(deriveMachineCapability(DEFINITIONS.ray), 'workspaces', 'select_workspace') || '';
        assert.match(rayWorkspace, /same-line prefix/);
        const original = capabilityRefusal(deriveMachineCapability(DEFINITIONS.original), 'toolSetter', 'run_tool_setter') || '';
        assert.match(original, /unverified against wiki/);
    }],

    ['requireCapability refuses on the connected J1 / unknown / nothing, and passes on the A350', () => {
        const onJ1 = loadConnectedMachine('Snapmaker J1');
        assert.equal(onJ1.connectedDialect().id, 'j1-marlin');
        assert.match(caughtMessage(() => onJ1.requireCapability('laser', 'laser_frame')), /Snapmaker J1.*no laser words/);

        const onA350 = loadConnectedMachine('Snapmaker 2.0 A350');
        assert.equal(onA350.connectedDialect().id, 'sm2-marlin');
        assert.equal(onA350.requireCapability('toolSetter', 'run_tool_setter').identifier, 'Snapmaker 2.0 A350');
        assert.equal(onA350.describeConnectedMachine().dialect, 'sm2-marlin');

        const onUnknown = loadConnectedMachine('Snapmaker U1');
        assert.equal(onUnknown.connectedDialect().id, 'unknown');
        assert.match(caughtMessage(() => onUnknown.requireCapability('zAxis', 'move_z')), /not in this MCP's G-code dialect table/);

        const offline = loadConnectedMachine(null);
        assert.match(caughtMessage(() => offline.requireCapability('laser', 'laser_frame')), /no machine is connected/);
    }],
];
