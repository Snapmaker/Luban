// The per-machine store (tyeth/Luban#265, WP2): migration from the legacy
// global keys (the operator's real A350 values, redacted, from the Luban host),
// coexisting machine entries (the #264 single-scope defect), device aliases
// and conflicts, the env > per-machine > default order, and the Z policy
// (A350 defaults unchanged; any other Z machine refuses until stated).
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import * as machineCapability from '../machineCapability';
import * as machinePosition from '../machinePosition';
import * as motionRules from '../motionRules';
import * as procedureLimits from '../procedureLimits';
import * as rotaryAxisLine from '../rotaryAxisLine';
import * as stylusReach from '../stylusReach';
import { McpToolError } from '../registry';

const A350 = 'Snapmaker 2.0 A350';
const A150 = 'Snapmaker 2.0 A150';
const RAY = 'Ray';
const ORIGINAL = 'Original';
const A250 = 'Snapmaker 2.0 A250';
const ARTISAN = 'A400';
const J1 = 'Snapmaker J1';

/** The operator's per-machine keys as the Luban host held them (pre-#264 build: no mcpTravelMachine). */
const BOX: { [key: string]: unknown } = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'box-mcp-per-machine-keys.json'), 'utf8'));

// Like jobDashboard.test's isolatedModule, but every import not handed in is an
// inert {} and process.env is the test's own (env pins are part of the contract).
function load(file: string, dependencies: Record<string, unknown>, env: Record<string, string> = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true } });
    const exports = {} as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const stubs: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) { stubs[match[1]] = {}; }
    const all = { ...stubs, ...dependencies };
    vm.runInNewContext(compiled.outputText, {
        exports,
        Date,
        JSON,
        process: { env, platform: 'linux' },
        require: (name: string) => {
            if (!(name in all)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return all[name];
        },
    }, { filename: file });
    return exports;
}

/** deepEqual across the vm realm: values built inside an isolated module have that realm's prototypes. */
function same(actual: unknown, expected: unknown, message?: string): void {
    assert.deepEqual(actual === undefined ? actual : JSON.parse(JSON.stringify(actual)), expected, message);
}

interface Status { connected?: boolean; machineIdentifier?: string | null; deviceSerial?: string | null; host?: string | null }

/** A configstore over a Map that counts writes, a mutable connection, and the real machineStore.ts on both. */
export function machineStoreFixture(initial: { [key: string]: unknown } = {}, env: Record<string, string> = {}) {
    const values = new Map<string, unknown>(Object.entries(JSON.parse(JSON.stringify(initial))));
    const writes: string[] = [];
    const config = {
        get: (key: string) => values.get(key),
        set: (key: string, value: unknown) => { writes.push(key); values.set(key, JSON.parse(JSON.stringify(value))); },
        unset: (key: string) => { writes.push(key); values.delete(key); },
    };
    let status: Status = { connected: false, machineIdentifier: null };
    const logs: string[] = [];
    const module = load('machineStore.ts', {
        '../configstore': config,
        './machineCapability': machineCapability,
        '../../lib/logger': () => ({ info: (line: string) => logs.push(line) }),
    }, env);
    module.setMachineStoreSources({ status: () => status, selectedMachine: () => null });
    return {
        module,
        store: module.machineStore,
        config,
        values,
        writes,
        logs,
        status: () => status,
        connect: (next: Status) => { status = { connected: true, ...next }; },
        disconnect: () => { status = { connected: false, machineIdentifier: null }; },
    };
}

function rotaryFixture(initial: { [key: string]: unknown } = {}, env: Record<string, string> = {}) {
    const f = machineStoreFixture(initial, env);
    const rotary = load('rotaryGeometry.ts', {
        './machineStore': f.module,
        './stylusReach': stylusReach,
        './procedureLimits': procedureLimits,
        './rotaryAxisLine': rotaryAxisLine,
    }, env);
    return { ...f, rotary };
}

const DEFINITIONS: { [id: string]: machineCapability.MachineDefinitionLike } = {
    [A350]: { identifier: A350, machineType: 'Multi-function 3D Printer', metadata: { size: { x: 320, y: 350, z: 330 } } },
    [A150]: { identifier: A150, machineType: 'Multi-function 3D Printer', metadata: { size: { x: 160, y: 160, z: 140 } } },
    [RAY]: { identifier: RAY, machineType: 'Laser', metadata: { size: { x: 600, y: 400, z: 0 } } },
    [ORIGINAL]: { identifier: ORIGINAL, machineType: 'Multi-function 3D Printer', metadata: { size: { x: 125, y: 125, z: 125 } } },
    [A250]: { identifier: A250, machineType: 'Multi-function 3D Printer', metadata: { size: { x: 230, y: 250, z: 230 } } },
    [ARTISAN]: { identifier: ARTISAN, machineType: 'Multi-function 3D Printer', metadata: { size: { x: 400, y: 400, z: 400 } } },
    [J1]: { identifier: J1, machineType: 'Printer', metadata: { size: { x: 324, y: 200, z: 200 } } },
};

/** tools/machine.ts on the real store: Z policy, travel fudge, set_machine_policy. Nothing else of it is exercised. */
export function machineToolsFixture(initial: { [key: string]: unknown } = {}, env: Record<string, string> = {}) {
    const f = machineStoreFixture(initial, env);
    const capabilityFor = (id: string | null) => machineCapability.deriveMachineCapability(id ? DEFINITIONS[id] || null : null, id);
    const tools = load('tools/machine.ts', {
        '../../configstore': f.config,
        '../machineStore': f.module,
        '../machineCapability': machineCapability,
        '../machinePosition': machinePosition,
        '../positionOfRecord': { onFrameLatchChange: () => undefined, setFrameLatchMachineSource: () => undefined, stickyMachineSource: (read: () => unknown) => read },
        // No landmark review provider here (landmarkReviewState.ts is not loaded): the review reads unknown.
        '../safeZPolicy': { currentLandmarkReviewGate: () => ({ confirmed: false, status: 'unknown', question: 'the landmark review is not available in this build' }) },
        '../procedureLimits': procedureLimits,
        '../motionRules': motionRules,
        '../registry': { McpToolError },
        '../machineTravel': { DEFAULT_TRAVEL_FUDGE_MM: 25 },
        '../connectedMachine': {
            machineCapabilityFor: capabilityFor,
            connectedMachineTag: () => '(test machine)',
        },
        '../../../DataStorage': { userDataDir: '/nonexistent' },
        '../../../../app/machines': Object.fromEntries(['Original', 'OriginalExtended', 'A150', 'A250', 'A350', 'Artisan', 'J1', 'Ray']
            .map((name) => [`Snapmaker${name}Machine`, { identifier: name }])),
        '../../../lib/logger': () => ({ info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined }),
        'fs-extra': { existsSync: () => false },
        path,
    }, env);
    // tools/machine.ts hands the store its (stubbed) connection at load; point it back at this fixture's.
    f.module.setMachineStoreSources({ status: f.status, selectedMachine: () => null });
    return { ...f, tools };
}

function storedTravelOf(f: ReturnType<typeof rotaryFixture>, identifier: string) {
    return f.rotary.statedTravel(identifier);
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    // ---- Migration --------------------------------------------------------
    ['(a) pre-#264 host: every per-machine value moves under the A350 key unchanged, with a snapshot, legacy keys kept', () => {
        const f = machineStoreFixture({ ...BOX, mcpPort: 40889, mcpGpioPinProbe: 'A0:down' });
        f.connect({ machineIdentifier: A350 });
        for (const [key, value] of Object.entries(BOX)) {
            same(f.store.getFor(A350, key), value, `${key} round-trips`);
        }
        const data = f.values.get('mcpMachines') as { machines: { [k: string]: object }; migratedFrom: { legacyKeys: object; pr264TravelMachine: string | null } };
        same(Object.keys(data.machines), [A350], 'only the A350 entry');
        assert.equal(data.migratedFrom.pr264TravelMachine, null);
        same(Object.keys(data.migratedFrom.legacyKeys).sort(), Object.keys(BOX).sort(), 'the snapshot lists exactly the moved keys');
        // Host keys stay global and untouched; legacy keys stay for a rollback.
        assert.equal(JSON.stringify(data).includes('40889'), false);
        assert.equal(f.values.get('mcpTravelXMin'), -19);
        assert.equal(f.logs.length, 1, 'one info line');
        assert.match(f.logs[0], /mcpTravelXMin/);
    }],

    ['(a) the migrated A350 reads the same travel, probe and rotary values through rotaryGeometry', () => {
        const f = rotaryFixture(BOX);
        f.connect({ machineIdentifier: A350 });
        same(storedTravelOf(f, A350), { xMin: -19, xMax: 339, yMin: 0, yMax: 342 });
        same(f.rotary.probeGeometry(), { effectiveLength: 70.9, tipDiameter: 2 });
        const settings = f.rotary.geometrySettings();
        assert.equal(settings.fields.travel_x_min.note, BOX.mcpTravelXMinNote);
        assert.equal(settings.fields.travel_x_min.setAt, BOX.mcpTravelXMinAt);
        assert.equal(settings.fields.probe_effective_length.note, BOX.mcpProbeEffectiveLengthNote);
        assert.equal(settings.fields.rotary_axis_x.value, 170.1);
        assert.equal(settings.fields.rotary_axis_z_physical.value, 112.4);
        assert.equal(settings.travel.statedFor, A350);
    }],

    ['(b) #264 host with mcpTravelMachine "Ray": the ends go under the Ray, everything else under the A350', () => {
        const f = machineStoreFixture({ mcpTravelMachine: RAY, mcpTravelXMin: 0, mcpTravelXMinNote: 'ray', mcpTravelXMinAt: 5, mcpProbeTipDiameter: 2 });
        const data = f.store.load();
        assert.equal(data.machines[RAY].travel.xMin.value, 0);
        assert.equal(data.machines[RAY].travel.xMin.note, 'ray');
        assert.equal(data.machines[A350].travel, undefined, 'the A350 gets no travel ends');
        assert.equal(data.machines[A350].probe.tipDiameter.value, 2);
        assert.equal(data.migratedFrom.pr264TravelMachine, RAY);
    }],

    ['(c) an already-migrated store is never migrated again: a second load writes nothing', () => {
        const f = machineStoreFixture(BOX);
        f.store.load();
        const first = f.writes.length;
        assert.equal(first, 1, 'the migration is one write');
        const again = load('machineStore.ts', {
            '../configstore': f.config,
            './machineCapability': machineCapability,
            '../../lib/logger': () => ({ info: () => undefined }),
        });
        again.setMachineStoreSources({ status: () => ({ connected: true, machineIdentifier: A350 }), selectedMachine: () => null });
        again.machineStore.load();
        again.machineStore.machineConfig.get('mcpToolSetter');
        assert.equal(f.writes.length, first, 'no write on the second run');
    }],

    ['(c) an empty host migrates to an empty store once (so the next run sees it and does nothing)', () => {
        const f = machineStoreFixture({});
        same(f.store.load().machines, {});
        f.store.load();
        assert.equal(f.writes.length, 1);
        assert.match(f.logs[0], /no legacy per-machine keys/);
    }],

    ['(d) a legacy key edited after migration is ignored', () => {
        const f = rotaryFixture(BOX);
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.rotary.geometryValue('travel_x_min'), -19);
        f.values.set('mcpTravelXMin', -5);
        assert.equal(f.rotary.geometryValue('travel_x_min'), -19);
    }],

    // ---- The #264 defect ---------------------------------------------------
    ['stating the Ray\'s travel leaves the A350\'s ends intact, and each machine reads its own', () => {
        const f = rotaryFixture(BOX);
        f.connect({ machineIdentifier: RAY });
        const outcome = f.rotary.setGeometryValues({ travel_x_min: -1, travel_y_max: 399 }, 'Ray home observed', RAY);
        same(outcome.updated, ['travel_x_min', 'travel_y_max']);
        same(outcome.cleared, [], 'nothing of the A350 is retired');
        same(storedTravelOf(f, RAY), { xMin: -1, xMax: null, yMin: null, yMax: 399 });
        assert.equal(f.rotary.probeGeometry(), null, 'the A350 probe does not apply on the Ray');
        f.connect({ machineIdentifier: A350 });
        same(storedTravelOf(f, A350), { xMin: -19, xMax: 339, yMin: 0, yMax: 342 });
        assert.equal(f.rotary.geometrySettings().fields.travel_x_min.note, BOX.mcpTravelXMinNote);
    }],

    ['geometry writes need a machine, and go to the selected one when none is connected', () => {
        const f = rotaryFixture({});
        assert.throws(() => f.rotary.setGeometryValues({ probe_tip_diameter: 2 }, 'x', null), /no machine is connected or selected/);
        f.rotary.setGeometryValues({ probe_tip_diameter: 2 }, 'x', ORIGINAL);
        assert.equal(f.store.getFor(ORIGINAL, 'mcpProbeTipDiameter'), 2);
    }],

    ['R5: chuck and tailstock tops are rotary geometry, stored per machine with provenance', () => {
        const f = rotaryFixture(BOX);
        f.connect({ machineIdentifier: A350 });
        f.rotary.setGeometryValues({ rotary_chuck_top_z: 160.5, rotary_tailstock_top_z: 150 }, 'calipers', A350);
        const g = f.rotary.rotaryGeometry();
        assert.equal(g.chuckTopZ, 160.5);
        assert.equal(g.tailstockTopZ, 150);
        assert.equal(f.store.load().machines[A350].rotary.chuckTopZ.note, 'calipers');
        assert.throws(() => f.rotary.setGeometryValues({ rotary_chuck_top_z: 500 }, 'x', A350), /0\.\.400/);
    }],

    ['an env pin wins over the machine entry and reports env', () => {
        const f = rotaryFixture(BOX, { LUBAN_MCP_TRAVEL_X_MIN: '-10' });
        f.connect({ machineIdentifier: A350 });
        const field = f.rotary.geometrySettings().fields.travel_x_min;
        assert.equal(field.value, -10);
        assert.equal(field.source, 'env');
        assert.equal(storedTravelOf(f, A350).xMin, -10);
        assert.equal(f.store.getFor(A350, 'mcpTravelXMin'), -19, 'the stored value is untouched');
    }],

    // ---- Devices -----------------------------------------------------------
    ['a device id is recorded as an alias of the model entry; ids of different types never conflict', () => {
        const f = machineStoreFixture(BOX);
        f.connect({ machineIdentifier: A350, deviceSerial: '123' });
        let current = f.store.currentMachine();
        assert.equal(current.machineKey, A350);
        assert.equal(current.deviceId, 'sn:123');
        assert.equal(current.deviceSource, 'sacp-serial-number');
        assert.equal(current.deviceConflict, null);
        f.connect({ machineIdentifier: A350, host: '192.168.1.20' });
        current = f.store.currentMachine();
        assert.equal(current.deviceConflict, null, 'SSTP host vs SACP serial: different types');
        same(f.store.load().machines[A350].devices.map((d: { id: string }) => d.id), ['sn:123', 'host:192.168.1.20']);
        f.connect({ machineIdentifier: A350 });
        current = f.store.currentMachine();
        assert.equal(current.deviceId, null, 'text serial: no device id, model entry');
        assert.equal(current.machineKey, A350);
        assert.equal(f.store.describe().current.deviceScope !== null, true);
    }],

    ['an A350 reconnecting over SSTP from a new address adds an alias: no conflict, auto-execute unaffected', () => {
        const f = machineToolsFixture(BOX);
        f.connect({ machineIdentifier: A350, host: '192.168.1.20' });
        f.store.currentMachine();
        f.connect({ machineIdentifier: A350, host: '192.168.1.57' });
        const current = f.store.currentMachine();
        assert.equal(current.deviceConflict, null, 'a host is weak identity (DHCP), never a conflict');
        assert.equal(current.machineKey, A350);
        same(f.store.load().machines[A350].devices.map((d: { id: string }) => d.id), ['host:192.168.1.20', 'host:192.168.1.57']);
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), true);
        assert.equal(f.tools.traverseWithoutApprovalPolicy().gatedBy, null);
        assert.equal(f.store.machineConfig.get('mcpProbeTipDiameter'), 2, 'its records still apply');
        f.connect({ machineIdentifier: A350, host: '192.168.1.20' });
        f.store.currentMachine();
        assert.equal(f.store.load().machines[A350].devices.length, 2, 'a known host is not added twice');
    }],

    ['two different serials still conflict', () => {
        const f = machineToolsFixture(BOX);
        f.connect({ machineIdentifier: A350, deviceSerial: '111' });
        f.store.currentMachine();
        f.connect({ machineIdentifier: A350, deviceSerial: '222' });
        assert.ok(f.store.currentMachine().deviceConflict);
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false);
    }],

    ['a differing id of a recorded type is a conflict; "same machine" adds the alias', () => {
        const f = machineStoreFixture(BOX);
        f.connect({ machineIdentifier: A350, deviceSerial: '123' });
        f.store.currentMachine();
        f.connect({ machineIdentifier: A350, deviceSerial: '999' });
        const conflict = f.store.currentMachine().deviceConflict;
        assert.ok(conflict);
        same(conflict.recorded, ['sn:123']);
        assert.equal(f.store.describe().deviceConflict.deviceId, 'sn:999');
        assert.equal(f.store.machineConfig.get('mcpProbeTipDiameter'), 2, 'records still read (as unconfirmed)');
        same(f.store.assignMachineDevice(true), { machineKey: A350, deviceId: 'sn:999', created: false });
        assert.equal(f.store.currentMachine().deviceConflict, null);
        assert.throws(() => f.store.assignMachineDevice(true), /No device conflict/);
    }],

    ['"a different machine" splits off an empty entry that the device then reads', () => {
        const f = machineStoreFixture(BOX);
        f.connect({ machineIdentifier: A350, deviceSerial: '123' });
        f.store.currentMachine();
        f.connect({ machineIdentifier: A350, deviceSerial: '555' });
        same(f.store.assignMachineDevice(false), { machineKey: `${A350}#sn:555`, deviceId: 'sn:555', created: true });
        assert.equal(f.store.currentMachine().machineKey, `${A350}#sn:555`);
        assert.equal(f.store.machineConfig.get('mcpProbeTipDiameter'), undefined, 'the split entry starts empty');
        f.store.machineConfig.set('mcpProbeTipDiameter', 3);
        f.connect({ machineIdentifier: A350, deviceSerial: '123' });
        assert.equal(f.store.currentMachine().machineKey, A350);
        assert.equal(f.store.machineConfig.get('mcpProbeTipDiameter'), 2, 'the original keeps its own');
    }],

    ['a sighting is written once per device per run, not on every read', () => {
        const f = machineStoreFixture(BOX);
        f.connect({ machineIdentifier: A350, deviceSerial: '123' });
        f.store.currentMachine();
        const after = f.writes.length;
        for (let i = 0; i < 5; i++) { f.store.machineConfig.get('mcpToolSetter'); }
        assert.equal(f.writes.length, after);
    }],

    // ---- Z policy (R9) -------------------------------------------------------
    ['A350 defaults are unchanged: 328 / 320, approval-free transport on', () => {
        const f = machineToolsFixture({});
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.tools.safeTraverseZ(), 328);
        assert.equal(f.tools.motionFloorZ(), 320);
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), true);
        assert.equal(f.tools.zTravelTop(325), 328, 'the A350 homes above its profile');
        const policy = f.tools.zPolicyFor();
        assert.equal(policy.safeTraverseZ.source, 'default');
        same(policy.missing, []);
    }],

    ['the A350\'s legacy policy keys migrate and still apply, with their source', () => {
        const f = machineToolsFixture({ mcpSafeTraverseZ: 325, mcpMotionFloorZ: 318, mcpTravelFudgeMm: 20 });
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.tools.safeTraverseZ(), 325);
        assert.equal(f.tools.motionFloorZ(), 318);
        assert.match(f.tools.zPolicyFor().safeTraverseZ.source, /migrated from configstore mcpSafeTraverseZ/);
        assert.equal(f.tools.travelFudge().x, 20);
        assert.equal(f.tools.travelFudge(RAY).x, 25, 'the A350 fudge is not the Ray\'s');
    }],

    ['a non-A350 Z machine refuses Z planning until set_machine_policy states both heights', () => {
        const f = machineToolsFixture({});
        f.connect({ machineIdentifier: ORIGINAL });
        assert.throws(() => f.tools.safeTraverseZ(), /set_machine_policy/);
        assert.throws(() => f.tools.motionFloorZ(), /safe_traverse_z \/ motion_floor_z/);
        same(f.tools.zPolicyFor().missing, ['safe_traverse_z', 'motion_floor_z'], 'status reads never throw');
        assert.equal(f.tools.zTravelTop(125), 125, 'range checks (staging, pendant envelope) use size.z and never throw');
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false, 'never approval-free off the A350');
        assert.throws(() => f.tools.setMachinePolicy({ safe_traverse_z: 130 }), /0\.\.125/);
        assert.throws(() => f.tools.setMachinePolicy({ safe_traverse_z: 100, motion_floor_z: 110 }), /above safe_traverse_z/);
        assert.throws(() => f.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: true }), /verified/);
        const result = f.tools.setMachinePolicy({ safe_traverse_z: 120, motion_floor_z: 110, reason: 'operator: home Z 125' });
        same(result.updated, ['safe_traverse_z', 'motion_floor_z']);
        assert.equal(f.tools.safeTraverseZ(), 120);
        assert.equal(f.tools.motionFloorZ(), 110);
        assert.match(f.tools.zPolicyFor().safeTraverseZ.source, /operator: home Z 125/);
        f.connect({ machineIdentifier: A150 });
        assert.throws(() => f.tools.safeTraverseZ(), /set_machine_policy/, 'the Original\'s policy is not the A150\'s');
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.tools.safeTraverseZ(), 328, 'nor the A350\'s');
    }],

    ['the Ray: Z policy not applicable, unchanged numbers for callers that ignore them, no Z statement accepted', () => {
        const f = machineToolsFixture({});
        f.connect({ machineIdentifier: RAY });
        assert.equal(f.tools.safeTraverseZ(), 328);
        assert.equal(f.tools.zPolicyFor().applies, false);
        assert.equal(f.tools.zPolicyFor().safeTraverseZ.source, 'not-applicable');
        assert.throws(() => f.tools.setMachinePolicy({ safe_traverse_z: 10 }), /no Z axis/);
        const fudge = f.tools.setMachinePolicy({ travel_fudge_mm: 5, reason: 'Ray frame is tight' });
        assert.equal(fudge.policy.travelFudge.xMm, 5);
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.tools.travelFudge().x, 25, 'the Ray fudge stays the Ray\'s');
    }],

    ['approval-free transport: host switch OFF wins, a device conflict holds it off, env pins report env', () => {
        const off = machineToolsFixture({ mcpTraverseWithoutApprovalAtSafeZ: false });
        off.connect({ machineIdentifier: A350 });
        assert.equal(off.tools.traverseWithoutApprovalAtSafeZ(), false);
        assert.equal(off.tools.traverseWithoutApprovalPolicy().source, 'host-setting');
        assert.equal(off.tools.traverseWithoutApprovalHostSetting(), false);

        const conflict = machineToolsFixture(BOX);
        conflict.connect({ machineIdentifier: A350, deviceSerial: '1' });
        conflict.store.currentMachine();
        conflict.connect({ machineIdentifier: A350, deviceSerial: '2' });
        assert.equal(conflict.tools.traverseWithoutApprovalAtSafeZ(), false);
        assert.match(conflict.tools.traverseWithoutApprovalPolicy().gatedBy, /device conflict/);
        assert.throws(() => conflict.tools.setMachinePolicy({ travel_fudge_mm: 3 }), /device conflict/);

        const env = machineToolsFixture({}, { LUBAN_MCP_TRAVEL_FUDGE_MM: '7' });
        env.connect({ machineIdentifier: A350 });
        assert.equal(env.tools.travelFudge().x, 7);
        assert.equal(env.tools.travelFudge().source.x, 'env');
        assert.throws(() => env.tools.setMachinePolicy({ travel_fudge_mm: 3 }), /pinned by the environment/);
    }],

    ['set_machine_policy needs a connected machine, and clearing on the A350 returns to the defaults', () => {
        const f = machineToolsFixture({});
        assert.throws(() => f.tools.setMachinePolicy({ safe_traverse_z: 300 }), /none is connected/);
        f.connect({ machineIdentifier: A350 });
        f.tools.setMachinePolicy({ safe_traverse_z: 300, motion_floor_z: 290, landmark_confirm_ttl_hours: 4 });
        assert.equal(f.tools.safeTraverseZ(), 300);
        assert.equal(f.tools.landmarkConfirmTtlHours().hours, 4);
        f.tools.setMachinePolicy({ safe_traverse_z: null, motion_floor_z: null, landmark_confirm_ttl_hours: null });
        assert.equal(f.tools.safeTraverseZ(), 328);
        assert.equal(f.tools.motionFloorZ(), 320);
        assert.equal(f.tools.landmarkConfirmTtlHours().hours, procedureLimits.LANDMARK_CONFIRM_TTL_HOURS.default);
        assert.equal(f.store.load().machines[A350].zPolicy.safeTraverseZ, undefined);
    }],
];
