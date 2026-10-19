// Agent visibility and integration (tyeth/Luban#265 WP8): the applied-records
// report for each machine, the result hooks that put it (and the landmark
// review when unconfirmed) on every motion / staging result and on the status
// tools, and the rotary safe height wired through the per-call `stock` scope.
// The modules under test import the connection layer, so they are loaded in
// isolation with their sources stubbed (jobDashboard.test's isolatedModule).
import { strict as assert } from 'assert';
import * as fs from 'fs';
import path from 'path';

import * as envelopeChecks from '../envelopeChecks';
import * as jobMachineBinding from '../jobMachineBinding';
import * as rotaryAxisLine from '../rotaryAxisLine';
import * as rotaryCallContext from '../rotaryCallContext';
import * as rotaryClearance from '../rotaryClearance';
import { McpToolError, ToolRegistry } from '../registry';
import { isolatedModule } from './jobDashboard.test';

const A350 = 'Snapmaker 2.0 A350';

function inert(file: string, overrides: Record<string, unknown> = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const deps: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    for (let m = pattern.exec(source); m !== null; m = pattern.exec(source)) { deps[m[1]] = {}; }
    return isolatedModule(file, { ...deps, ...overrides });
}

/** JSON round trip: values built in the vm realm have that realm's prototypes. */
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

const applied = inert('appliedRecords.ts');
const hooksForNote = inert('toolResultHooks.ts');

function facts(over: Record<string, unknown> = {}) {
    return {
        machine: {
            identifier: A350,
            type: 'Multi-function 3D Printer',
            hasZ: true,
            dialect: 'sm2-marlin',
            verifiedOnHardware: true,
            gcodeForm: 'sm2',
            deviceId: 'host:192.168.1.20',
            machineKey: A350,
            basis: 'connected',
            deviceConflict: null,
        },
        travel: { stated: ['xMin', 'xMax'], fudge: { x: 25, y: 25, source: 'default' } },
        zPolicy: { applies: true, safeTraverseZ: { value: 328, source: 'default' }, motionFloorZ: { value: 320, source: 'default' }, missing: [] },
        landmarks: ['rotary', 'tool-setter'],
        landmarkReview: { status: 'unconfirmed', confirmed: false },
        toolSetter: { centerX: 330, centerY: 10, triggerZ: 120 },
        probeGeometry: { effectiveLength: 71.3, tipDiameter: 2 },
        rotaryGeometry: { axisX: 170, axisZ: 60, skew: 'unmeasured', chuckFaceY: 40, tailstockY: 300, chuckTopZ: null, tailstockTopZ: null },
        activeTool: null,
        camera: { device: null, url: null },
        motionRules: { topZWithoutApproval: { on: true, gatedBy: null }, computedHeight: { on: false, unmet: [] } },
        unreadable: {},
        ...over,
    };
}

const RAY_MACHINE = {
    identifier: 'Ray',
    type: 'Laser',
    hasZ: false,
    dialect: 'ray-grbl',
    verifiedOnHardware: true,
    gcodeForm: 'relative-steps',
    deviceId: null,
    machineKey: 'Ray',
    basis: 'connected',
    deviceConflict: null,
};
const ORIGINAL_MACHINE = {
    identifier: 'Original',
    type: 'Multi-function 3D Printer',
    hasZ: true,
    dialect: 'original-marlin',
    verifiedOnHardware: false,
    gcodeForm: 'relative-steps',
    deviceId: null,
    machineKey: 'Original',
    basis: 'connected',
    deviceConflict: null,
};

// --- rotary wiring, isolated with live sources stubbed ---
const wiring = isolatedModule('rotaryWiring.ts', {
    './clearanceContext': { currentToolProtrusion: () => ({ mm: null }) },
    './connectedMachine': { connectedMachineCapability: () => ({ supports: { rotary: true } }), connectedMachineTag: () => '(test)' },
    './envelopeChecks': envelopeChecks,
    './landmarks': { landmarkStore: { obstacleBoxes: () => [] } },
    './registry': { McpToolError },
    './rotaryCallContext': rotaryCallContext,
    './rotaryClearance': rotaryClearance,
    './rotaryGeometry': { rotaryGeometry: () => null },
    './rotaryAxisLine': rotaryAxisLine,
    './tools/machine': { safeTraverseZ: () => 328 },
});

const LEGACY_ROTARY = { name: 'rotary', machine: { x0: 140, y0: 0, x1: 200, y1: 350 }, clearanceZ: 280, clearanceBasis: 'toolhead' as const, mode: 'crossing' as const };
const SETTER = { name: 'tool-setter', machine: { x0: 320, y0: 0, x1: 340, y1: 20 }, clearanceZ: 250, clearanceBasis: 'toolhead' as const, mode: 'crossing' as const };
const GEOMETRY = { axisX: 170, axisZ: 60, chuckFaceY: 40, tailstockY: 300, chuckTopZ: 110, tailstockTopZ: 95 };

function resolve(over: Record<string, unknown> = {}) {
    return wiring.resolveRotaryClearance({
        stock: { radiusMm: 25, topZ: null },
        geometry: GEOMETRY,
        toolProtrusionMm: 40,
        fallbackZ: 328,
        obstacles: [LEGACY_ROTARY, SETTER],
        ...over,
    });
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['applied records: the A350 names its record set, A350 defaults and the review status (compact strings)', () => {
        const report = plain(applied.buildAppliedRecords(facts()));
        assert.deepEqual(report.connected_machine, {
            identifier: A350,
            type: 'Multi-function 3D Printer',
            hasZ: true,
            dialect: 'sm2-marlin',
            deviceId: 'host:192.168.1.20',
            machineKey: A350,
            verifiedOnHardware: true,
            gcode_form: 'sm2',
        });
        assert.equal(report.records.travel, `stated in the ${A350} record (xMin, xMax), else model size +/- fudge X25/Y25 (default)`);
        assert.equal(report.records.zPolicy, 'A350 defaults (park Z328, floor Z320)');
        assert.deepEqual(report.records.landmarks, ['rotary', 'tool-setter']);
        assert.equal(report.records.landmarkReview, 'unconfirmed');
        assert.equal(report.records.toolSetter, `${A350} record: centre X330 Y10, trigger Z120`);
        assert.equal(report.records.rotaryGeometry.axis, 'X170 Z60 (unmeasured)');
        assert.equal(report.records.activeTool, 'none confirmed this session');
        assert.equal(report.records.camera, 'auto (none stated)');
        assert.deepEqual(report.records.motionRules, { topZWithoutApproval: 'on', computedHeight: 'off' });
        assert.equal(report.records.unreadable, undefined);
    }],
    ['applied records: the Ray reports no Z and no A350 records; the Original reports its missing Z policy and gated motion rule', () => {
        const ray = plain(applied.buildAppliedRecords(facts({
            machine: RAY_MACHINE,
            travel: { stated: [], fudge: { x: 25, y: 25, source: 'default' } },
            zPolicy: { applies: false, safeTraverseZ: { value: 328, source: 'not-applicable' }, motionFloorZ: { value: 320, source: 'not-applicable' }, missing: [] },
            landmarks: [],
            landmarkReview: { status: 'empty', confirmed: false },
            toolSetter: null,
            probeGeometry: null,
            rotaryGeometry: null,
            motionRules: { topZWithoutApproval: { on: false, gatedBy: 'Ray: no Z axis' }, computedHeight: { on: false, unmet: [] } },
        })));
        assert.equal(ray.connected_machine.dialect, 'ray-grbl');
        assert.equal(ray.connected_machine.hasZ, false);
        assert.equal(ray.records.zPolicy, 'n/a (no Z axis)');
        assert.equal(ray.records.travel, 'model size +/- fudge X25/Y25 (default) - no travel stated for Ray');
        assert.equal(ray.records.toolSetter, 'none');
        assert.equal(ray.records.rotaryGeometry, 'none');
        assert.equal(ray.records.motionRules.topZWithoutApproval, 'off - Ray: no Z axis');
        const original = plain(applied.buildAppliedRecords(facts({
            machine: ORIGINAL_MACHINE,
            zPolicy: { applies: true, safeTraverseZ: { value: null, source: 'unset' }, motionFloorZ: { value: null, source: 'unset' }, missing: ['safe_traverse_z', 'motion_floor_z'] },
            unreadable: { camera: 'boom' },
        })));
        assert.equal(original.connected_machine.verifiedOnHardware, false);
        assert.equal(original.connected_machine.gcode_form, 'relative-steps');
        assert.equal(original.records.zPolicy, 'missing (safe_traverse_z, motion_floor_z) - set_machine_policy');
        assert.deepEqual(original.records.unreadable, { camera: 'boom' });
    }],
    ['applied records: nothing connected says the records are what WOULD apply; a device conflict is named', () => {
        const report = plain(applied.buildAppliedRecords(facts({
            machine: { ...ORIGINAL_MACHINE, basis: 'selected', deviceConflict: 'sn:2 differs from sn:1' },
            zPolicy: { applies: true, safeTraverseZ: { value: 100, source: 'set_machine_policy' }, motionFloorZ: { value: 90, source: 'set_machine_policy' }, missing: [] },
        })));
        assert.equal(report.connected_machine.basis, 'selected');
        assert.equal(report.connected_machine.device_conflict, 'sn:2 differs from sn:1');
        assert.equal(report.records.zPolicy, 'stated (park Z100, floor Z90; set_machine_policy)');
    }],
    ['result hooks: an unconfirmed review is injected into every motion / staging result and get_position, never into other status tools', () => {
        let confirmed = false;
        const hooksModule = inert('toolResultHooks.ts');
        const sources = {
            appliedRecords: () => applied.buildAppliedRecords(facts({ machine: RAY_MACHINE })),
            landmarkReview: () => ({
                status: confirmed ? 'confirmed' : 'unconfirmed',
                confirmed,
                machine: { identifier: 'Ray', machineKey: 'Ray', connected: true },
                landmarks: [{ name: 'honeycomb' }],
                question: confirmed ? null : 'Is this what is on the bed?',
                answer_with: ['confirm_landmarks'],
                invalidated_because: null,
                pending_reviews: [],
            }),
            rotaryForCall: () => null,
            runScoped: (_t: unknown, fn: () => unknown) => fn(),
        };
        const hooks = hooksModule.createToolCallHooks(sources);
        // traverse_xy on the Ray: its own connected_machine is replaced by the superset, never duplicated.
        const staged = plain(hooks.decorate('traverse_xy', {}, { confirm_url: 'http://x/confirm/1', staged_because: 'no Z axis', connected_machine: { identifier: 'Ray' } }));
        assert.equal(staged.connected_machine.dialect, 'ray-grbl');
        assert.equal(staged.connected_machine.machineKey, 'Ray');
        assert.equal(staged.applied_records.connected_machine.identifier, 'Ray');
        assert.equal(staged.landmark_review.status, 'unconfirmed');
        assert.equal(staged.landmark_review.question, 'Is this what is on the bed?');
        assert.deepEqual(staged.landmark_review.landmarks, ['honeycomb']);
        // Any tool that staged a job, a probe_* tool, and a laser tool by name.
        assert.ok(plain(hooks.decorate('submit_gcode_job', {}, { confirm_url: 'u' })).landmark_review);
        assert.ok(plain(hooks.decorate('probe_surface_grid', {}, { dry_run: true })).applied_records);
        assert.ok(plain(hooks.decorate('laser_frame', {}, {})).applied_records);
        assert.ok(plain(hooks.decorate('get_position', {}, { machine: {} })).landmark_review);
        for (const name of ['get_stored_state', 'get_machine_profile', 'get_connection_status']) {
            const out = plain(hooks.decorate(name, {}, { connected: true }));
            assert.ok(out.applied_records.connected_machine, name);
            assert.equal(out.landmark_review, undefined, `${name} carries no injected review`);
        }
        // Not motion, not status: untouched.
        assert.deepEqual(plain(hooks.decorate('get_frame', {}, { frame: 1 })), { frame: 1 });
        confirmed = true;
        const done = plain(hooks.decorate('traverse_xy', {}, { confirm_url: 'u' }));
        assert.equal(done.landmark_review, undefined, 'absent once confirmed');
        assert.equal(plain(hooks.decorate('get_position', {}, {})).landmark_review, undefined);
    }],
    ['result hooks: the stock scope runs the handler with the transform, reports rotary_clearance, and names the rotary in a refusal', async () => {
        const hooksModule = inert('toolResultHooks.ts', { './rotaryWiring': { STOCK_TOOLS: wiring.STOCK_TOOLS } });
        let scoped = 0;
        let resolution: unknown = null;
        const hooks = hooksModule.createToolCallHooks({
            appliedRecords: () => ({}),
            landmarkReview: () => ({ confirmed: true }),
            rotaryForCall: () => resolution,
            runScoped: (_t: unknown, fn: () => unknown) => { scoped++; return fn(); },
        });
        assert.deepEqual(plain(await hooks.around('traverse_xy', {}, async () => ({ ok: 1 }))), { ok: 1 }, 'nothing rotary: unchanged');
        resolution = { report: { basis: 'computed', zMm: 180, applied: 'computed', reasons: ['computed'] }, transform: (b: unknown) => b };
        const out = plain(await hooks.around('traverse_xy', {}, async () => ({ ok: 1 })));
        assert.equal(scoped, 1);
        assert.equal(out.rotary_clearance.basis, 'computed');
        assert.equal(out.rotary_clearance.zMm, 180);
        assert.equal(plain(await hooks.around('home', {}, async () => ({ ok: 2 }))).rotary_clearance, undefined, 'home takes no stock');
        resolution = { report: { basis: 'refused', zMm: 341, applied: 'raised', reasons: ['even Z328 does not clear'] }, transform: (b: unknown) => b };
        await assert.rejects(hooks.around('traverse_xy', {}, async () => { throw new McpToolError('crosses rotary'); }), /crosses rotary\nRotary clearance: even Z328 does not clear/);
    }],
    ['registry: the decorator adds fields after the handler; a decorator failure never fails a call that already ran', async () => {
        const registry = new ToolRegistry();
        registry.register({ name: 'get_fake', description: 'x', inputSchema: { type: 'object' }, handler: async () => ({ ran: true }) });
        registry.setCallHooks({ decorate: (_n: string, _a: object, r: object) => ({ ...r, decorated: true }) });
        assert.deepEqual(await registry.call('get_fake', {}), { ran: true, decorated: true });
        registry.setCallHooks({ decorate: () => { throw new Error('no records'); } });
        assert.deepEqual(await registry.call('get_fake', {}), { ran: true, applied_records_error: 'no records' });
        registry.setCallHooks(null);
        assert.deepEqual(await registry.call('get_fake', {}), { ran: true });
    }],
    ['rotary: stock + every measurement -> computed keep-out supersedes the legacy rotary box (Z below 328); other boxes untouched', () => {
        const r = resolve();
        assert.equal(r.report.basis, 'computed');
        assert.equal(r.report.applied, 'computed');
        // physical top max(60 + 25, 110, 95) = 110; + tool 40 + margin 5.
        assert.equal(r.report.zMm, 155);
        assert.equal(r.report.legacy_landmark, 'rotary');
        const boxes = r.transform([LEGACY_ROTARY, SETTER]);
        assert.equal(boxes.length, 2);
        assert.equal(boxes[0].clearanceZ, 155);
        assert.match(boxes[0].name, /computed rotary keep-out/);
        assert.deepEqual(plain(boxes[1]), plain(SETTER));
    }],
    ['rotary: no stock or no trusted tool -> fallback, the legacy box stands, wouldLowerIf names what to do', () => {
        const noStock = resolve({ stock: null });
        assert.equal(noStock.report.basis, 'fallback');
        assert.equal(noStock.report.applied, 'legacy');
        assert.equal(noStock.transform, null);
        assert.ok(noStock.report.wouldLowerIf.includes(rotaryClearance.WOULD_LOWER.stock));
        const noTool = resolve({ toolProtrusionMm: null });
        assert.equal(noTool.transform, null);
        assert.ok(noTool.report.wouldLowerIf.includes(rotaryClearance.WOULD_LOWER.protrusion));
        const noTops = resolve({ geometry: { ...GEOMETRY, chuckTopZ: null } });
        assert.ok(noTops.report.wouldLowerIf.includes(rotaryClearance.WOULD_LOWER.chuckTop));
        assert.equal(noTops.report.zMm, 328);
    }],
    ['rotary: when even the fallback does not clear (clearsAtFallback false) the crossing is refused, never planned at 328', () => {
        const r = resolve({ stock: { radiusMm: 200, topZ: null } }); // 60 + 200 = 260, + 40 + 5 = 305 <= 328
        assert.equal(r.report.basis, 'computed');
        const tall = resolve({ stock: { radiusMm: 250, topZ: null } }); // 310 + 40 + 5 = 355 > 328
        assert.equal(tall.report.basis, 'refused');
        assert.equal(tall.report.clearsAtFallback, false);
        assert.equal(tall.report.applied, 'raised');
        const boxes = tall.transform([LEGACY_ROTARY, SETTER]);
        const raised = boxes.find((b: { name: string }) => /crossing refused/.test(b.name));
        assert.ok(raised && raised.clearanceZ > 328, 'the box demands more than the fallback');
        // A route across the rotary at Z328 is refused; one beside it is not.
        const across = envelopeChecks.checkMotion([{ what: 'hop', kind: 'hop', from: { x: 100, y: 100, z: 328 }, to: { x: 250, y: 100, z: 328 } }] as never, boxes, { traverseZ: 328 } as never);
        assert.ok(across.length > 0, 'crossing refused');
        const beside = envelopeChecks.checkMotion([{ what: 'hop', kind: 'hop', from: { x: 220, y: 100, z: 328 }, to: { x: 260, y: 100, z: 328 } }] as never, boxes, { traverseZ: 328 } as never);
        assert.equal(beside.length, 0, 'a route that does not cross is untouched');
    }],
    ['rotary: ambiguous or missing legacy box -> nothing superseded; the box is chosen by geometry, not by name', () => {
        const twin = { ...LEGACY_ROTARY, name: 'stock clamp', machine: { x0: 160, y0: 100, x1: 180, y1: 120 } };
        const two = resolve({ obstacles: [LEGACY_ROTARY, twin] });
        assert.equal(two.transform, null);
        assert.match(two.report.reasons.join('\n'), /2 landmark boxes lie over the rotary axis/);
        const renamed = resolve({ obstacles: [{ ...LEGACY_ROTARY, name: 'chuck span' }] });
        assert.equal(renamed.report.legacy_landmark, 'chuck span');
        const none = resolve({ obstacles: [SETTER] });
        assert.equal(none.transform, null);
        assert.equal(none.report.applied, 'legacy');
    }],
    ['rotary: stock argument parsing refuses rather than guesses', () => {
        assert.equal(wiring.parseStockArg(undefined), null);
        assert.deepEqual(plain(wiring.parseStockArg({ radius_mm: 25 })), { radiusMm: 25, topZ: null });
        assert.equal(wiring.parseStockArg({ top_z: 90 }).topZ, 90);
        assert.throws(() => wiring.parseStockArg({ radius_mm: -1 }), /positive length/);
        assert.throws(() => wiring.parseStockArg('25'), /must be an object/);
        assert.throws(() => wiring.parseStockArg({ radius_mm: 25, top_z: 'high' }), /machine Z/);
    }],
    ['rotary: every set_probe_geometry field named in wouldLowerIf exists on both sides (WP2 store, WP6 advice)', () => {
        const geometry = fs.readFileSync(path.join(__dirname, '..', 'rotaryGeometry.ts'), 'utf8');
        const tool = fs.readFileSync(path.join(__dirname, '..', 'tools', 'landmarks.ts'), 'utf8');
        const named = Object.values(rotaryClearance.WOULD_LOWER).join(' ').match(/\(([a-z_]+)\)/g) || [];
        const fields = named.map((m) => m.slice(1, -1)).filter((f) => f.startsWith('rotary_'));
        assert.deepEqual(fields.sort(), ['rotary_axis_z_physical', 'rotary_chuck_top_z', 'rotary_tailstock_top_z']);
        for (const field of fields) {
            assert.ok(geometry.includes(`field: '${field}'`), `${field} in GEOMETRY_FIELDS`);
            assert.ok(tool.includes(`${field}: {`), `${field} in set_probe_geometry's schema`);
        }
        assert.ok(tool.includes('protrusion_reference') || fs.readFileSync(path.join(__dirname, '..', 'tools', 'toolsetter.ts'), 'utf8').includes('protrusion_reference'),
            'set_active_tool protrusion_reference exists');
    }],
    ['confirm page: the Landmarks row lists what was enforced at staging and says the click does not confirm the review', () => {
        const jobs = jobMachineBinding;
        assert.equal(jobs.describeStagedLandmarks(undefined), null, 'jobs staged before WP8 show no row');
        assert.match(String(jobs.describeStagedLandmarks(null)), /no machine connected/);
        const row = jobs.describeStagedLandmarks({ status: 'unconfirmed', landmarks: [{ name: 'rotary', requiredToolheadZ: 280 }, { name: 'clamp', requiredToolheadZ: null }], question: 'q' });
        assert.match(String(row), /^rotary \(needs toolhead Z280\), clamp\. Enforced in full/);
        assert.match(String(row), /it does not confirm the review/);
        assert.match(String(jobs.describeStagedLandmarks({ status: 'confirmed', landmarks: [], question: null })), /none stored for this machine.*review confirmed by the operator/);
        const computed = { report: { applied: 'computed', zMm: 155, legacy_landmark: 'rotary', stock: { radius_mm: 25, top_z: null } }, transform: null };
        const note = hooksForNote.rotaryNote(computed);
        assert.match(note, /computed toolhead Z155 \(stock r25\) - 'rotary' legacy requirement superseded for this job only/);
        assert.match(String(jobs.describeStagedLandmarks({ status: 'confirmed', landmarks: [{ name: 'rotary', requiredToolheadZ: 280 }], question: null, rotaryNote: note })), /Z280.*THIS job: computed toolhead Z155/);
    }],
    ['rotary scope: the transform applies only while the call runs; a failed read without stock never blocks the call', async () => {
        const boxes = [LEGACY_ROTARY];
        const lower = (b: typeof boxes) => b.map((x) => ({ ...x, clearanceZ: 155 }));
        let late: (() => number) | null = null;
        const seen = await rotaryCallContext.runWithObstacleTransform(lower, async () => {
            late = () => rotaryCallContext.applyCallObstacleTransform(boxes)[0].clearanceZ;
            return rotaryCallContext.applyCallObstacleTransform(boxes)[0].clearanceZ;
        }, 'note');
        assert.equal(seen, 155);
        assert.equal((late as unknown as () => number)(), 280, 'a callback run after the call settles sees the stored box');
        assert.equal(rotaryCallContext.callRotaryNote(), null);
        const hooksModule = inert('toolResultHooks.ts', { './rotaryWiring': { STOCK_TOOLS: wiring.STOCK_TOOLS } });
        const hooks = hooksModule.createToolCallHooks({
            appliedRecords: () => ({}),
            landmarkReview: () => ({ confirmed: true }),
            rotaryForCall: () => { throw new Error('axis fit failed'); },
            runScoped: rotaryCallContext.runWithObstacleTransform,
        });
        const out = plain(await hooks.around('traverse_xy', {}, async () => ({ ran: true })));
        assert.equal(out.ran, true, 'no stock: the A350 traverse still runs');
        assert.equal(out.rotary_clearance.error, 'axis fit failed');
        await assert.rejects(hooks.around('traverse_xy', { stock: { radius_mm: 25 } }, async () => ({ ran: true })), /axis fit failed/);
    }],
    ['get_connection_status adds machineKey and dialect next to deviceSerial / host', async () => {
        const run = async (status: Record<string, unknown>, machineKey: string | null) => {
            const statusTools = inert('tools/status.ts', {
                '../../machine/ConnectionManager': { connectionManager: { getConnectionStatus: () => status } },
                '../connectedMachine': { connectedMachineCapability: () => ({ dialect: { id: 'ray-grbl' } }) },
                '../machineStore': { machineStore: { currentMachine: () => ({ basis: machineKey ? 'connected' : 'selected', machineKey }) } },
                '../registry': { McpToolError },
            });
            const handlers: Record<string, (args: object) => Promise<object>> = {};
            type Tool = { name: string; handler: (args: object) => Promise<object> };
            statusTools.registerStatusTools({ register: (tool: Tool) => { handlers[tool.name] = tool.handler; } });
            return plain(await handlers.get_connection_status({}));
        };
        const ray = await run({ connected: true, machineIdentifier: 'Ray', deviceSerial: 'SN1', host: null }, 'Ray');
        assert.deepEqual(ray, { connected: true, machineIdentifier: 'Ray', deviceSerial: 'SN1', host: null, machineKey: 'Ray', dialect: 'ray-grbl' });
        const none = await run({ connected: false, machineIdentifier: null }, null);
        assert.equal(none.machineKey, null);
        assert.equal(none.dialect, null);
    }],
];
