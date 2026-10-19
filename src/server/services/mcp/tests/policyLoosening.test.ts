// set_machine_policy never LOOSENS a stated safety bound on an agent's word
// (tyeth/Luban#265 WP10, R11 spirit): lowering safe_traverse_z or
// motion_floor_z (the A350's 328 / 320 count as stated), widening a travel
// fudge, a shallower toolhead body or a longer landmark-confirmation validity
// is staged on an operator review page and applied on the click, after the
// value is re-checked. Tightening and a first statement apply at once.
import { strict as assert } from 'assert';

import { OperatorReviewStore } from '../operatorReviews';
import { machineToolsFixture } from './machineStore.test';

const A350 = 'Snapmaker 2.0 A350';
const ORIGINAL = 'Original';

type Fixture = ReturnType<typeof machineToolsFixture>;

interface Bound {
    arg: string;
    machine: string;
    /** Calls that state the starting values (applied at once: first statements or tightenings). */
    setup: Array<{ [key: string]: unknown }>;
    loosen: unknown;
    tighten: unknown;
    read: (f: Fixture) => number | null;
}

const body = (f: Fixture, key: string) => {
    const rules = f.store.getFor(key, 'mcpMotionRules') as { toolheadBodyBelowReferenceMm?: { value: number } } | undefined;
    return rules && rules.toolheadBodyBelowReferenceMm ? rules.toolheadBodyBelowReferenceMm.value : null;
};

const BOUNDS: Bound[] = [
    { arg: 'safe_traverse_z',
        machine: ORIGINAL,
        setup: [{ safe_traverse_z: 120, motion_floor_z: 110 }],
        loosen: 115,
        tighten: 122,
        read: (f) => f.tools.zPolicyFor().safeTraverseZ.value },
    { arg: 'motion_floor_z',
        machine: ORIGINAL,
        setup: [{ safe_traverse_z: 120, motion_floor_z: 110 }],
        loosen: 100,
        tighten: 112,
        read: (f) => f.tools.zPolicyFor().motionFloorZ.value },
    { arg: 'travel_fudge_mm', machine: A350, setup: [], loosen: 30, tighten: 10, read: (f) => f.tools.travelFudge().x },
    { arg: 'travel_fudge_x_mm', machine: A350, setup: [], loosen: 40, tighten: 5, read: (f) => f.tools.travelFudge().x },
    { arg: 'travel_fudge_y_mm', machine: A350, setup: [], loosen: 40, tighten: 5, read: (f) => f.tools.travelFudge().y },
    { arg: 'toolhead_body_below_reference_mm',
        machine: A350,
        setup: [{ toolhead_body_below_reference_mm: 35 }],
        loosen: 30,
        tighten: 40,
        read: (f) => body(f, A350) },
    { arg: 'landmark_confirm_ttl_hours', machine: A350, setup: [], loosen: 48, tighten: 12, read: (f) => f.tools.landmarkConfirmTtlHours().hours },
];

function connected(machine: string, setup: Array<{ [key: string]: unknown }> = []) {
    const f = machineToolsFixture({});
    f.connect({ machineIdentifier: machine });
    const reviews = new OperatorReviewStore();
    f.tools.setMachinePolicyReviews(reviews);
    for (const call of setup) {
        const result = f.tools.setMachinePolicy(call);
        assert.equal(result.staged, undefined, `setup ${JSON.stringify(call)} applies at once`);
    }
    return { f, reviews };
}

export const tests: Array<[string, () => void]> = [
    ['loosensBound: lower/higher per direction; no stated value before (first statement) or after (cleared) never loosens', () => {
        const { f } = connected(A350);
        assert.equal(f.tools.loosensBound('lower-loosens', 320, 310), true);
        assert.equal(f.tools.loosensBound('lower-loosens', 320, 325), false);
        assert.equal(f.tools.loosensBound('lower-loosens', 320, 320), false);
        assert.equal(f.tools.loosensBound('higher-loosens', 25, 30), true);
        assert.equal(f.tools.loosensBound('higher-loosens', 25, 10), false);
        assert.equal(f.tools.loosensBound('lower-loosens', null, 10), false);
        assert.equal(f.tools.loosensBound('lower-loosens', 320, null), false);
    }],

    ['each bound: a loosening is staged (value unchanged) and applies on the operator\'s approval', () => {
        for (const b of BOUNDS) {
            const { f, reviews } = connected(b.machine, b.setup);
            const before = b.read(f);
            const result = f.tools.setMachinePolicy({ [b.arg]: b.loosen, reason: 'test' });
            assert.ok(result.staged, `${b.arg}: staged`);
            assert.match(result.staged_because, /LOOSEN a stated safety bound/, b.arg);
            assert.equal(b.read(f), before, `${b.arg}: unchanged until approved`);
            const [item] = reviews.pending();
            assert.equal(item.kind, 'policy-loosen');
            assert.equal(reviews.decide(item.id, 'approve', b.machine).state, 'approved', b.arg);
            assert.equal(b.read(f), b.loosen, `${b.arg}: applied on the click`);
        }
    }],

    ['each bound: a tightening applies at once', () => {
        for (const b of BOUNDS) {
            const { f, reviews } = connected(b.machine, b.setup);
            const result = f.tools.setMachinePolicy({ [b.arg]: b.tighten });
            assert.equal(result.staged, undefined, b.arg);
            assert.equal(b.read(f), b.tighten, b.arg);
            assert.equal(reviews.pending().length, 0, b.arg);
        }
    }],

    ['each bound: a stale page (the value changed since staging) is refused and changes nothing', () => {
        for (const b of BOUNDS) {
            const { f, reviews } = connected(b.machine, b.setup);
            f.tools.setMachinePolicy({ [b.arg]: b.loosen });
            f.tools.setMachinePolicy({ [b.arg]: b.tighten });
            const [item] = reviews.pending();
            const decided = reviews.decide(item.id, 'approve', b.machine);
            assert.equal(decided.state, 'refused', b.arg);
            assert.match(String(decided.error), /now, not the/, b.arg);
            assert.equal(b.read(f), b.tighten, `${b.arg}: the tightened value stands`);
        }
    }],

    ['first statements apply at once: the Original\'s first floor / park Z and a first toolhead body', () => {
        const { f, reviews } = connected(ORIGINAL);
        assert.equal(f.tools.setMachinePolicy({ safe_traverse_z: 100, motion_floor_z: 60 }).staged, undefined);
        assert.equal(f.tools.motionFloorZ(), 60);
        assert.equal(f.tools.setMachinePolicy({ toolhead_body_below_reference_mm: 5 }).staged, undefined);
        assert.equal(body(f, ORIGINAL), 5);
        assert.equal(reviews.pending().length, 0);
        // Clearing to unknown is not a loosening: the Z tools then refuse.
        assert.equal(f.tools.setMachinePolicy({ motion_floor_z: null }).staged, undefined);
        assert.throws(() => f.tools.motionFloorZ(), /set_machine_policy/);
    }],

    ['the A350 defaults count as stated: lowering 320 is staged; clearing back to a LOWER default is staged too', () => {
        const { f, reviews } = connected(A350);
        assert.ok(f.tools.setMachinePolicy({ motion_floor_z: 310 }).staged);
        assert.equal(f.tools.motionFloorZ(), 320);
        assert.equal(reviews.decide(reviews.pending()[0].id, 'approve', A350).state, 'approved');
        assert.equal(f.tools.motionFloorZ(), 310);
        assert.equal(f.tools.setMachinePolicy({ motion_floor_z: 325 }).staged, undefined, 'raising applies at once');
        assert.ok(f.tools.setMachinePolicy({ motion_floor_z: null }).staged, 'null -> the 320 default is lower than 325');
        assert.equal(f.tools.motionFloorZ(), 325);
    }],

    ['a mixed call: the tightening applies now, the loosening is staged', () => {
        const { f, reviews } = connected(A350);
        const result = f.tools.setMachinePolicy({ motion_floor_z: 300, landmark_confirm_ttl_hours: 12, reason: 'mixed' });
        assert.deepEqual([...result.updated], ['landmark_confirm_ttl_hours']);
        assert.equal(f.tools.landmarkConfirmTtlHours().hours, 12);
        assert.equal(f.tools.motionFloorZ(), 320);
        assert.deepEqual(Object.keys(reviews.pending()[0].summary as object).sort(), ['args', 'loosens']);
        reviews.decide(reviews.pending()[0].id, 'approve', A350);
        assert.equal(f.tools.motionFloorZ(), 300);
        assert.match(f.tools.zPolicyFor().motionFloorZ.source, /approved by the operator, review r/);
    }],

    ['rejected, another machine connected, or no review pages: nothing changes', () => {
        const { f, reviews } = connected(A350);
        f.tools.setMachinePolicy({ travel_fudge_mm: 40 });
        reviews.decide(reviews.pending()[0].id, 'reject', A350);
        assert.equal(f.tools.travelFudge().x, 25);
        f.tools.setMachinePolicy({ travel_fudge_mm: 40 });
        assert.equal(reviews.decide(reviews.pending()[0].id, 'approve', ORIGINAL).state, 'refused');
        assert.equal(f.tools.travelFudge().x, 25);
        f.tools.setMachinePolicyReviews(null);
        assert.throws(() => f.tools.setMachinePolicy({ travel_fudge_mm: 40 }), /review pages are not available/);
        assert.equal(f.tools.travelFudge().x, 25);
    }],

    ['an invalid value is refused before anything is staged', () => {
        const { f, reviews } = connected(A350);
        assert.throws(() => f.tools.setMachinePolicy({ motion_floor_z: 330 }), /above safe_traverse_z|0\.\./);
        assert.equal(reviews.pending().length, 0);
    }],
];
