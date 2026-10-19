// Motion rules (tyeth/Luban#265 WP9): the per-machine "Move at safe top Z
// without approval" toggle - A350 on by default, A150 / A250 / Artisan off
// until the operator turns it on in Settings (and only once their Z policy
// is stated), relative-step machines never, the host switch OFF wins, an
// agent can turn it off but never on - and R13, the computed-height rule's
// pure verdict, settings validation and storage.
import { strict as assert } from 'assert';
import * as motionRules from '../motionRules';
import { CLEARANCE_MARGIN_MM } from '../landmarkClearance';
import { MOTION_RULE_CLEARANCE_IDEAL_MM, MOTION_RULE_CLEARANCE_MIN_MM } from '../procedureLimits';
import { machineToolsFixture } from './machineStore.test';

const A350 = 'Snapmaker 2.0 A350';
const A150 = 'Snapmaker 2.0 A150';
const A250 = 'Snapmaker 2.0 A250';
const ARTISAN = 'A400';
const RAY = 'Ray';
const ORIGINAL = 'Original';
const J1 = 'Snapmaker J1';

/** A connected machine with its Z policy stated by the agent (what makes a non-A350 eligible). */
function connectedWithPolicy(identifier: string, initial: { [key: string]: unknown } = {}, env: Record<string, string> = {}) {
    const f = machineToolsFixture(initial, env);
    f.connect({ machineIdentifier: identifier });
    f.tools.setMachinePolicy({ safe_traverse_z: 100, motion_floor_z: 90, reason: 'measured home Z' });
    return f;
}

const FACTS: motionRules.ComputedHeightFacts = {
    hostEnabled: true,
    eligible: true,
    eligibilityReason: null,
    toolProtrusionMm: 30,
    bedPlaneZ: 12,
    landmarksConfirmed: true,
};

const ON_BY_OPERATOR = { motionRules: { computedHeight: { value: true, source: 'settings', setAt: 1 } } };

export const tests: Array<[string, () => void | Promise<void>]> = [
    // ---- Top-Z toggle: eligibility matrix -------------------------------------
    ['A350: on by default, listed with its 328/320 policy, unchanged gate', () => {
        const f = machineToolsFixture({});
        f.connect({ machineIdentifier: A350 });
        const policy = f.tools.traverseWithoutApprovalPolicy();
        assert.equal(policy.enabled, true);
        assert.equal(policy.gatedBy, null);
        assert.equal(policy.source, 'default');
        const [row] = f.tools.describeMotionRules().machines;
        assert.equal(row.machineKey, A350);
        assert.equal(row.current, 'connected');
        assert.equal(row.traverseWithoutApproval.on, true);
        assert.equal(row.traverseWithoutApproval.effective, true);
        assert.equal(row.traverseWithoutApproval.eligible, true);
        assert.equal(row.zPolicy.safeTraverseZ.value, 328);
        assert.equal(row.zPolicy.motionFloorZ.value, 320);
        assert.equal(row.dialect.transportForm, 'sm2');
    }],

    ['A250 / A150 / Artisan: off and not eligible until the Z policy is stated; then off until the operator turns it on', () => {
        for (const identifier of [A250, A150, ARTISAN]) {
            const f = machineToolsFixture({});
            f.connect({ machineIdentifier: identifier });
            assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false, identifier);
            assert.match(f.tools.motionRuleEligibility(identifier).reason, /safe_traverse_z \/ motion_floor_z.*set_machine_policy/, identifier);
            assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: identifier, traverseWithoutApprovalAtSafeZ: true }),
                /cannot be turned on.*set_machine_policy/, identifier);
            f.tools.setMachinePolicy({ safe_traverse_z: 100, motion_floor_z: 90 });
            assert.equal(f.tools.motionRuleEligibility(identifier).eligible, true, identifier);
            const off = f.tools.traverseWithoutApprovalPolicy();
            assert.equal(off.enabled, false, `${identifier} stays off until the operator enables it`);
            assert.equal(off.gatedBy, `enable 'Move at safe top Z without approval' for ${identifier} in Settings > MCP > Motion rules to move at safe top Z without approval`);
            const result = f.tools.setMotionRuleFromSettings({ machineKey: identifier, traverseWithoutApprovalAtSafeZ: true });
            assert.equal(result.traverseWithoutApprovalAtSafeZ.enabled, true, identifier);
            assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), true, identifier);
            const flag = f.tools.traverseWithoutApprovalPolicy().machineFlag;
            assert.equal(flag.source, 'settings');
            assert.equal(typeof flag.setAt, 'number');
            assert.equal(f.tools.describeMotionRules().machines[0].traverseWithoutApproval.on, true);
        }
    }],

    ['clearing an enabled machine\'s Z policy takes its toggle back out of force', () => {
        const f = connectedWithPolicy(A250);
        f.tools.setMotionRuleFromSettings({ machineKey: A250, traverseWithoutApprovalAtSafeZ: true });
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), true);
        f.tools.setMachinePolicy({ safe_traverse_z: null });
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false);
        assert.match(f.tools.traverseWithoutApprovalPolicy().gatedBy, /safe_traverse_z is stated/);
    }],

    ['Ray / Original / J1: never, with the relative-step reason, settings refuse ON but accept OFF', () => {
        for (const identifier of [RAY, ORIGINAL, J1]) {
            const f = machineToolsFixture({});
            f.connect({ machineIdentifier: identifier });
            assert.equal(f.tools.motionRuleEligibility(identifier).reason, 'relative-step machine: every move is staged', identifier);
            assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false, identifier);
            assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: identifier, traverseWithoutApprovalAtSafeZ: true }),
                /relative-step machine/, identifier);
            f.tools.setMotionRuleFromSettings({ machineKey: identifier, traverseWithoutApprovalAtSafeZ: false });
            const row = f.tools.describeMotionRules().machines.find((m: { machineKey: string }) => m.machineKey === identifier);
            assert.equal(row.traverseWithoutApproval.on, false, identifier);
            assert.equal(row.traverseWithoutApproval.eligible, false, identifier);
        }
    }],

    ['the host switch OFF wins over an operator-enabled machine and over the A350 default', () => {
        const f = connectedWithPolicy(A250, { mcpTraverseWithoutApprovalAtSafeZ: false });
        f.tools.setMotionRuleFromSettings({ machineKey: A250, traverseWithoutApprovalAtSafeZ: true });
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false);
        assert.equal(f.tools.traverseWithoutApprovalPolicy().source, 'host-setting');
        assert.equal(f.tools.describeMotionRules().host.enabled, false);
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false);
        const env = connectedWithPolicy(A250, {}, { LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z: '1' });
        assert.equal(env.tools.traverseWithoutApprovalAtSafeZ(), false, 'an env pin never enables a machine the operator has not');
        const envA350 = machineToolsFixture({}, { LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z: '1' });
        envA350.connect({ machineIdentifier: A350 });
        assert.equal(envA350.tools.traverseWithoutApprovalAtSafeZ(), true, 'the A350 env pin is unchanged');
        envA350.tools.setMotionRuleFromSettings({ machineKey: A350, traverseWithoutApprovalAtSafeZ: false });
        assert.equal(envA350.tools.traverseWithoutApprovalAtSafeZ(), false, 'nor does it beat the operator\'s OFF');
    }],

    ['agent set_machine_policy: can disable any machine, can never enable a non-A350, never overrides the operator\'s A350 OFF', () => {
        const f = connectedWithPolicy(A250);
        assert.throws(() => f.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: true }), /only the operator can enable/);
        f.tools.setMotionRuleFromSettings({ machineKey: A250, traverseWithoutApprovalAtSafeZ: true });
        f.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: false, reason: 'agent stops' });
        assert.equal(f.tools.traverseWithoutApprovalAtSafeZ(), false);
        assert.match(f.tools.traverseWithoutApprovalPolicy().machineFlag.source, /^set_machine_policy/);
        assert.throws(() => f.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: true }), /only the operator/);

        const a350 = machineToolsFixture({});
        a350.connect({ machineIdentifier: A350 });
        a350.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: false });
        assert.equal(a350.tools.traverseWithoutApprovalAtSafeZ(), false);
        a350.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: true });
        assert.equal(a350.tools.traverseWithoutApprovalAtSafeZ(), true, 'the A350 agent ON is unchanged');
        a350.tools.setMotionRuleFromSettings({ machineKey: A350, traverseWithoutApprovalAtSafeZ: false });
        assert.equal(a350.tools.traverseWithoutApprovalAtSafeZ(), false);
        assert.throws(() => a350.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: true }), /operator turned/);
        assert.throws(() => a350.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: null }), /operator turned/);
        a350.tools.setMachinePolicy({ traverse_without_approval_at_safe_z: false });
        assert.equal(a350.tools.traverseWithoutApprovalPolicy().machineFlag.source, 'settings', 'an agent OFF keeps the operator\'s provenance');
        a350.tools.setMotionRuleFromSettings({ machineKey: A350, traverseWithoutApprovalAtSafeZ: true });
        assert.equal(a350.tools.traverseWithoutApprovalAtSafeZ(), true, 'the operator turns it back on');
    }],

    ['settings API: unknown machine, bad values and a device conflict are refused; known store entries are listed', () => {
        const f = machineToolsFixture({});
        assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: A250, traverseWithoutApprovalAtSafeZ: false }), /not a machine the MCP knows/);
        f.connect({ machineIdentifier: A350 });
        assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: A350 }), /Nothing to set/);
        assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: A350, traverseWithoutApprovalAtSafeZ: 'yes' }), /true or false/);
        assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: '', traverseWithoutApprovalAtSafeZ: true }), /machineKey/);
        f.tools.setMachinePolicy({ travel_fudge_mm: 5 });
        f.connect({ machineIdentifier: RAY });
        f.tools.setMachinePolicy({ travel_fudge_mm: 3 });
        const keys = f.tools.describeMotionRules().machines.map((m: { machineKey: string }) => m.machineKey).sort();
        assert.deepEqual([...keys], [A350, RAY].sort());
        f.tools.setMotionRuleFromSettings({ machineKey: A350, traverseWithoutApprovalAtSafeZ: false });
        assert.equal(f.store.load().machines[A350].zPolicy.traverseWithoutApprovalAtSafeZ, false, 'a stored machine that is not connected');

        const conflict = machineToolsFixture({});
        conflict.connect({ machineIdentifier: A350, deviceSerial: '1' });
        conflict.store.currentMachine();
        conflict.connect({ machineIdentifier: A350, deviceSerial: '2' });
        assert.throws(() => conflict.tools.setMotionRuleFromSettings({ machineKey: A350, traverseWithoutApprovalAtSafeZ: true }), /device conflict/);
    }],

    // ---- R13: computed-height rule -------------------------------------------
    ['R13 limits: ideal 50, min 20 >= CLEARANCE_MARGIN_MM, both capped at 150', () => {
        assert.equal(MOTION_RULE_CLEARANCE_IDEAL_MM.default, 50);
        assert.equal(MOTION_RULE_CLEARANCE_MIN_MM.default, 20);
        assert.equal(MOTION_RULE_CLEARANCE_MIN_MM.min, CLEARANCE_MARGIN_MM);
        assert.equal(MOTION_RULE_CLEARANCE_IDEAL_MM.min, CLEARANCE_MARGIN_MM);
        assert.ok(MOTION_RULE_CLEARANCE_IDEAL_MM.default >= MOTION_RULE_CLEARANCE_MIN_MM.default);
    }],

    ['computedHeightTraversePolicy: default OFF everywhere, every unknown is unmet, all met = allowed', () => {
        const none = motionRules.computedHeightTraversePolicy(undefined, FACTS);
        assert.equal(none.allowed, false);
        assert.equal(none.idealMm, 50);
        assert.equal(none.minMm, 20);
        assert.equal(none.unmet.length, 2, 'operator toggle off and toolhead body unknown');
        assert.match(none.unmet[0], /only the operator turns it on/);

        const entry = { motionRules: { ...ON_BY_OPERATOR.motionRules, toolheadBodyBelowReferenceMm: { value: 40, source: 'set_machine_policy', setAt: 2 } } };
        const all = motionRules.computedHeightTraversePolicy(entry, FACTS);
        assert.equal(all.allowed, true);
        assert.deepEqual(all.unmet, []);
        assert.equal(all.lowestPointBelowReferenceMm, 40, 'the body hangs lower than the 30 mm tool');
        assert.equal(all.bedContactToolheadZ, 52);

        const agentOn = { motionRules: { computedHeight: { value: true, source: 'set_machine_policy', setAt: 1 } } };
        assert.equal(motionRules.computedHeightTraversePolicy(agentOn, FACTS).requirements[0].met, false, 'only the settings source counts');

        const unknowns = motionRules.computedHeightTraversePolicy(entry, {
            ...FACTS, hostEnabled: false, toolProtrusionMm: null, bedPlaneZ: null, landmarksConfirmed: null,
        });
        assert.equal(unknowns.allowed, false);
        assert.deepEqual(unknowns.requirements.filter((r) => r.met !== true).map((r) => r.id), ['host', 'tool-protrusion', 'bed-plane', 'landmarks']);
        assert.match(unknowns.unmet.join('\n'), /unknown until the landmark review lands/);
        assert.equal(unknowns.bedContactToolheadZ, null);
        const ineligible = motionRules.computedHeightTraversePolicy(entry, { ...FACTS, eligible: false, eligibilityReason: 'relative-step machine: every move is staged' });
        assert.match(ineligible.unmet.join(), /not eligible: relative-step/);
    }],

    ['validateClearanceSettings: ranges, ideal >= min on the result, null/empty back to the default', () => {
        assert.deepEqual(motionRules.validateClearanceSettings({ clearanceIdealMm: 60, clearanceMinMm: '25' }, {}), { idealMm: 60, minMm: 25 });
        assert.throws(() => motionRules.validateClearanceSettings({ clearanceMinMm: 4 }, {}), /5\.\.150/);
        assert.throws(() => motionRules.validateClearanceSettings({ clearanceIdealMm: 151 }, {}), /5\.\.150/);
        assert.throws(() => motionRules.validateClearanceSettings({ clearanceIdealMm: 'x' }, {}), /must be a number/);
        assert.throws(() => motionRules.validateClearanceSettings({ clearanceIdealMm: 15 }, {}), /cannot be below the minimum clearance \(20 mm\)/);
        const stored = { clearanceIdealMm: { value: 60, source: 'settings', setAt: 1 }, clearanceMinMm: { value: 40, source: 'settings', setAt: 1 } };
        assert.throws(() => motionRules.validateClearanceSettings({ clearanceIdealMm: 30 }, stored), /below the minimum clearance \(40 mm\)/);
        assert.deepEqual(motionRules.validateClearanceSettings({ clearanceIdealMm: '' }, stored), { idealMm: null, minMm: 40 });
        assert.deepEqual(motionRules.clearancesOf(motionRules.motionRulesOf({ motionRules: { clearanceIdealMm: { value: 10, source: 's' } } })),
            { idealMm: 50, minMm: 20, source: { ideal: 'default', min: 'default' } }, 'a stored inverted pair reads as the defaults');
    }],

    ['R13 storage: operator-only ON (eligible machines), agent OFF only, body offset stated by set_machine_policy', () => {
        const f = connectedWithPolicy(A250);
        let rule = f.tools.computedHeightRuleFor(A250);
        assert.equal(rule.on, false, 'default OFF');
        assert.equal(rule.allowed, false);
        f.tools.setMotionRuleFromSettings({ machineKey: A250, computedHeightTraverse: true, clearanceIdealMm: 60, clearanceMinMm: 30 });
        rule = f.tools.computedHeightRuleFor(A250, { toolProtrusionMm: 25 });
        assert.equal(rule.on, true);
        assert.equal(rule.source, 'settings');
        assert.equal(rule.idealMm, 60);
        assert.equal(rule.minMm, 30);
        assert.match(rule.unmet.join('\n'), /toolhead_body_below_reference_mm/);
        assert.match(rule.unmet.join('\n'), /bed_plane_z/);
        assert.throws(() => f.tools.setMachinePolicy({ traverse_without_approval_at_computed_height: true }), /only the operator/);
        f.tools.setMachinePolicy({ toolhead_body_below_reference_mm: 35, reason: 'measured shoe' });
        assert.throws(() => f.tools.setMachinePolicy({ toolhead_body_below_reference_mm: 200 }), /0\.\.150/);
        f.store.machineConfig.set('mcpBedPlaneZ', 5);
        rule = f.tools.computedHeightRuleFor(A250, { toolProtrusionMm: 25 });
        assert.equal(rule.bedContactToolheadZ, 40);
        assert.deepEqual(rule.unmet, ['unknown until the landmark review lands (#265 WP5)']);
        f.tools.setMachinePolicy({ traverse_without_approval_at_computed_height: false });
        assert.equal(f.tools.computedHeightRuleFor(A250).on, false);
        assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: A250, clearanceIdealMm: 10 }), /cannot be below/);

        const ray = machineToolsFixture({});
        ray.connect({ machineIdentifier: RAY });
        assert.throws(() => ray.tools.setMotionRuleFromSettings({ machineKey: RAY, computedHeightTraverse: true }), /relative-step/);
        const a350 = machineToolsFixture({});
        a350.connect({ machineIdentifier: A350 });
        assert.equal(a350.tools.computedHeightRuleFor(A350).on, false, 'default OFF on the A350 too');
        assert.match(a350.tools.computedHeightRuleFor(A350, { toolProtrusionMm: null, toolProtrusionNote: 'no tool' }).unmet.join(), /no tool/);
    }],
];
