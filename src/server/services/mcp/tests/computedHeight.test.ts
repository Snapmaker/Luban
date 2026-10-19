// Motion rules R13 in motion (tyeth/Luban#265 WP10): the computed safe height
// of a traverse_xy swept path (computedHeight.ts), the call-time decision
// (safeZPolicy.decideComputedHeightTraverse) and the planner's UP-only entry
// raise (traversePlan.ts) - with the toggle off, the planner's bytes are the
// base's.
import { strict as assert } from 'assert';

import { ComputedTravel, ComputedTravelInput, computeTravelHeight } from '../computedHeight';
import { ObstacleBox } from '../envelopeChecks';
import { ComputedHeightDecisionInput, COMPUTED_HEIGHT_TRAVERSE_POLICY, decideComputedHeightTraverse, setLandmarkReviewProvider } from '../safeZPolicy';
import { ComputedHeightFacts, computedHeightTraversePolicy } from '../motionRules';
import { TraversePlanInput, planTraverseXy, traverseMachinePath } from '../traversePlan';

const BED = 50;
const TOOL = 30;
const BODY = 60; // the toolhead body reaches lower than the tool: it is the lowest point
const TOP = 328;

function travelInput(over: Partial<ComputedTravelInput> = {}): ComputedTravelInput {
    return {
        path: [{ x: 10, y: 10 }, { x: 300, y: 10 }],
        obstacles: [],
        bedPlaneZ: BED,
        lowestPointBelowReferenceMm: BODY,
        idealMm: 50,
        minMm: 20,
        topZ: TOP,
        floorZ: 100,
        ...over,
    };
}

const box = (name: string, x0: number, y0: number, x1: number, y1: number, clearanceZ: number, basis: 'physical' | 'toolhead' = 'physical'): ObstacleBox => ({
    name, machine: { x0, y0, x1, y1 }, clearanceZ, clearanceBasis: basis, mode: 'crossing',
});

const entryOn = {
    motionRules: {
        computedHeight: { value: true, source: 'settings', setAt: 1 },
        toolheadBodyBelowReferenceMm: { value: BODY, source: 'settings', setAt: 1 },
    },
};

function facts(over: Partial<ComputedHeightFacts> = {}): ComputedHeightFacts {
    return {
        hostEnabled: true,
        eligible: true,
        eligibilityReason: null,
        toolProtrusionMm: TOOL,
        bedPlaneZ: BED,
        landmarksConfirmed: true,
        ...over,
    };
}

function decisionInput(
    over: Partial<ComputedHeightDecisionInput> = {},
    travel: ComputedTravel | null = computeTravelHeight(travelInput())
): ComputedHeightDecisionInput {
    return {
        verdict: computedHeightTraversePolicy(entryOn, facts()),
        travel,
        deviceConflict: null,
        hasZ: true,
        reliability: 'heartbeat',
        homed: true,
        currentZ: 327.999,
        topZ: TOP,
        landmarksConfirmed: true,
        ...over,
    };
}

function planInput(over: Partial<TraversePlanInput> = {}): TraversePlanInput {
    return {
        targets: [{ x: 100, y: 50 }, { y: 200 }],
        frame: 'machine',
        currentMachine: { x: 10, y: 20, z: 327.999 },
        originOffset: { x: 0, y: 0, z: 0 },
        travel: { xMin: -19, xMax: 345, yMin: -4, yMax: 357 } as TraversePlanInput['travel'],
        traverseZ: 328,
        motionFloorZ: 320,
        feedRate: 1500,
        obstacles: [box('clamp', 200, 200, 220, 220, 40)],
        toolProtrusionMm: 30,
        clearanceMarginMm: 5,
        reason: 'byte identity fixture',
        ...over,
    };
}

/** planTraverseXy(planInput()).reviewText as mcp/mm-integration (the base) emits it - captured before WP10's edit. */
const BASE_REVIEW_TEXT = '; reason: byte identity fixture\n; frame: machine coords; current machine (10.000, 20.000) at machine Z 327.999\n'
    + '; Z does NOT change: the whole series runs at machine Z 327.999 >= traverse height 328 (law 2)\n'
    + '; step 1: machine (10.000, 20.000) -> (100.000, 50.000) = machine (100.000, 50.000), 94.9 mm F1500\n'
    + '; step 2: machine (100.000, 50.000) -> (100.000, 200.000) = machine (100.000, 200.000), 150.0 mm F1500\n'
    + '; total XY travel 244.9 mm over 2 step(s); landmarks checked against every segment\n'
    + '; sensors: NO contact expected during these moves - a probe/toolsetter trigger\n'
    + '; while moving latches the CRASH alarm (probe feed must be armed).\n'
    + 'G90\nG53;\nG1 X100.000 Y50.000 F1500;\nG54;\n; --- next approved step ---\nG90\nG53;\nG1 X100.000 Y200.000 F1500;\nG54;';

export const tests: Array<[string, () => void]> = [
    ['allowed path over a clear bed: travelZ = bed + lowest point + the ideal 50 (the lowest point counted once)', () => {
        const t = computeTravelHeight(travelInput());
        assert.equal(t.travelZ, BED + BODY + 50);
        assert.equal(t.clearanceUsed, 50);
        assert.equal(t.governedBy, 'ideal-clearance');
        assert.equal(t.highest, 'bed');
        assert.deepEqual(t.unmet, []);
        const d = decideComputedHeightTraverse(decisionInput());
        assert.ok(d.allowed);
        assert.equal(d.allowed && d.policy, COMPUTED_HEIGHT_TRAVERSE_POLICY);
    }],

    ['the lowest point is max(tool protrusion, toolhead body): a longer tool sets it', () => {
        const v = computedHeightTraversePolicy(entryOn, facts({ toolProtrusionMm: 90 }));
        assert.equal(v.lowestPointBelowReferenceMm, 90);
        assert.equal(v.bedPlaneZ, BED);
        const t = computeTravelHeight(travelInput({ lowestPointBelowReferenceMm: v.lowestPointBelowReferenceMm as number }));
        assert.equal(t.travelZ, BED + 90 + 50);
    }],

    ['ideal over top Z: clearance reduced toward the minimum at the top Z, never below the minimum', () => {
        const t = computeTravelHeight(travelInput({ obstacles: [box('fixture', 100, 0, 120, 30, 230)] }));
        // touch = 230 + 60 = 290; ideal -> 340 > 328; 328 - 290 = 38 >= 20
        assert.equal(t.governedBy, 'reduced-clearance');
        assert.equal(t.travelZ, TOP);
        assert.equal(t.clearanceUsed, 38);
        assert.ok((t.clearanceUsed as number) >= 20 && (t.clearanceUsed as number) < 50);
        assert.match(t.note, /reduced to 38 mm \(minimum 20 mm\)/);
    }],

    ['exactly the minimum fits (within 0.05 mm): still a computed height at top Z', () => {
        const t = computeTravelHeight(travelInput({ obstacles: [box('fixture', 100, 0, 120, 30, 248.03)] }));
        // touch = 308.03; 328 - 308.03 = 19.97 >= 20 - 0.05
        assert.equal(t.governedBy, 'reduced-clearance');
        assert.equal(t.travelZ, TOP);
    }],

    ['the minimum does not fit under top Z: no computed height (top-Z behaviour), and the decision stages with why', () => {
        const t = computeTravelHeight(travelInput({ obstacles: [box('fixture', 100, 0, 120, 30, 250)] }));
        // touch = 310; 328 - 310 = 18 < 20
        assert.equal(t.travelZ, null);
        assert.equal(t.governedBy, 'top-z');
        assert.match(t.unmet[0], /even the minimum clearance 20 mm/);
        const d = decideComputedHeightTraverse(decisionInput({ currentZ: 200 }, t));
        assert.equal(d.allowed, false);
        assert.match(d.reason, /even the minimum clearance/);
    }],

    ['swept path: an obstacle in the MIDDLE of a segment (neither endpoint over it) raises travelZ', () => {
        const middle = box('vice', 140, 0, 160, 20, 120); // the path y=10 passes over it between x=10 and x=300
        const t = computeTravelHeight(travelInput({ obstacles: [middle] }));
        assert.equal(t.highest, 'vice');
        assert.equal(t.travelZ, 120 + BODY + 50);
        assert.deepEqual(t.onPath.map((o) => o.name), ['vice']);
        const off = box('elsewhere', 140, 100, 160, 120, 200); // not on the path (beyond the 5 mm margin)
        assert.equal(computeTravelHeight(travelInput({ obstacles: [off] })).travelZ, BED + BODY + 50);
    }],

    ['a later leg of a series counts too', () => {
        const t = computeTravelHeight(travelInput({
            path: [{ x: 10, y: 10 }, { x: 300, y: 10 }, { x: 300, y: 300 }],
            obstacles: [box('tall', 290, 150, 310, 170, 150)],
        }));
        assert.equal(t.travelZ, 150 + BODY + 50);
    }],

    ['a toolhead-basis landmark (legacy, or the computed rotary keep-out) on the path has no physical top: unmet, top-Z behaviour', () => {
        const t = computeTravelHeight(travelInput({ obstacles: [box('rotary-axis', 140, 0, 200, 350, 280, 'toolhead')] }));
        assert.equal(t.travelZ, null);
        assert.equal(t.governedBy, 'top-z');
        assert.match(t.unmet[0], /rotary-axis.*no physical top.*obstacle_top_z/);
        const clear = computeTravelHeight(travelInput({ path: [{ x: 10, y: 10 }, { x: 100, y: 10 }], obstacles: [box('rotary-axis', 140, 0, 200, 350, 280, 'toolhead')] }));
        assert.equal(clear.travelZ, BED + BODY + 50, 'a route that does not cross it is unaffected');
    }],

    ['the motion floor above the computed height governs (law 2), and says so', () => {
        const t = computeTravelHeight(travelInput({ floorZ: 320 }));
        assert.equal(t.travelZ, 320);
        assert.equal(t.governedBy, 'motion-floor');
        assert.equal(t.clearanceUsed, 320 - (BED + BODY));
        assert.match(t.note, /motion floor Z320 is higher and governs/);
    }],

    ['head above the computed height: XY at the current Z, Z not written (never descends)', () => {
        const d = decideComputedHeightTraverse(decisionInput({ currentZ: 327.999 }));
        assert.ok(d.allowed);
        assert.equal(d.allowed && d.runZ, 327.999);
        assert.equal(d.allowed && d.raiseFromZ, null);
        assert.match(d.reason, /Z not written/);
    }],

    ['head below the computed height: an UP-only raise to it first', () => {
        const d = decideComputedHeightTraverse(decisionInput({ currentZ: 120 }));
        assert.ok(d.allowed);
        assert.equal(d.allowed && d.runZ, BED + BODY + 50);
        assert.equal(d.allowed && d.raiseFromZ, 120);
        assert.match(d.reason, /UP-only raise machine Z 120.000 -> 160.000/);
    }],

    ['each unmet R13 requirement stages with that reason', () => {
        const cases: Array<[string, { motionRules?: unknown }, Partial<ComputedHeightFacts>, RegExp]> = [
            ['toggle off (the default)', {}, {}, /is off - only the operator turns it on/],
            ['toggle set by an agent, not the Settings pane', { motionRules: { ...entryOn.motionRules, computedHeight: { value: true, source: 'agent', setAt: 1 } } }, {}, /is off/],
            ['master switch off', entryOn, { hostEnabled: false }, /master switch/],
            ['not eligible', entryOn, { eligible: false, eligibilityReason: 'no Z axis' }, /not eligible: no Z axis/],
            ['tool protrusion not trusted', entryOn, { toolProtrusionMm: null }, /tool protrusion unknown/],
            ['toolhead body not stated', { motionRules: { computedHeight: entryOn.motionRules.computedHeight } }, {}, /toolhead body below the reference not stated/],
            ['bed plane not measured', entryOn, { bedPlaneZ: null }, /bed plane not measured/],
            ['landmarks not confirmed', entryOn, { landmarksConfirmed: false }, /landmarks not confirmed/],
            ['landmark review unknown', entryOn, { landmarksConfirmed: null }, /unknown/],
        ];
        for (const [what, entry, over, reason] of cases) {
            const d = decideComputedHeightTraverse(decisionInput({ verdict: computedHeightTraversePolicy(entry, facts(over)) }));
            assert.equal(d.allowed, false, what);
            assert.match(d.reason, reason, what);
            assert.ok(d.unmet.some((u) => reason.test(u)), what);
        }
    }],

    ['each unmet call-time condition stages with that reason', () => {
        const cases: Array<[string, Partial<ComputedHeightDecisionInput>, RegExp]> = [
            ['device conflict', { deviceConflict: 'serial differs' }, /device conflict: serial differs/],
            ['no Z axis', { hasZ: false }, /no Z axis/],
            ['heartbeat not reliable', { reliability: 'awaiting-resync' as ComputedHeightDecisionInput['reliability'] }, /awaiting-resync, not verified\/heartbeat/],
            ['not homed', { homed: false }, /does not report homed/],
            ['Z unknown', { currentZ: null }, /machine Z is unknown/],
            ['no swept-path height', { travel: null }, /no computed height under the safe top Z/],
        ];
        for (const [what, over, reason] of cases) {
            const d = decideComputedHeightTraverse(decisionInput(over, over.travel === null ? null : undefined));
            assert.equal(d.allowed, false, what);
            assert.match(d.reason, reason, what);
        }
    }],

    ['landmarks re-checked at call time: confirmed in the verdict but edited since -> staged', () => {
        const d = decideComputedHeightTraverse(decisionInput({ landmarksConfirmed: false }));
        assert.equal(d.allowed, false);
        assert.match(d.reason, /landmarks not confirmed now/);
        // Omitted = the live review provider; none registered reads as not confirmed.
        setLandmarkReviewProvider(null);
        const live = decideComputedHeightTraverse(decisionInput({ landmarksConfirmed: undefined }));
        assert.equal(live.allowed, false);
        setLandmarkReviewProvider(() => ({ confirmed: true, status: 'confirmed', question: null }));
        try {
            assert.ok(decideComputedHeightTraverse(decisionInput({ landmarksConfirmed: undefined })).allowed);
        } finally {
            setLandmarkReviewProvider(null);
        }
    }],

    ['toggle off: the planner without an entry raise emits the base bytes exactly', () => {
        assert.equal(planTraverseXy(planInput()).reviewText, BASE_REVIEW_TEXT);
        const plan = planTraverseXy(planInput());
        assert.equal(plan.entryRaise, null);
        assert.deepEqual(plan.stepGcodes, plan.steps.map((s) => s.gcode));
    }],

    ['the entry raise: one UP-only G53 Z move first, the series at that height, landmarks checked there', () => {
        const plan = planTraverseXy(planInput({
            currentMachine: { x: 10, y: 20, z: 120 },
            motionFloorZ: 150,
            entryRaiseZ: 160,
            entryRaiseFeed: 600,
            heightNote: 'computed safe height: test',
        }));
        assert.deepEqual(plan.entryRaise && { from: plan.entryRaise.fromZ, to: plan.entryRaise.toZ }, { from: 120, to: 160 });
        assert.equal(plan.stepGcodes.length, 3);
        assert.equal(plan.stepGcodes[0], 'G90\nG53;\nG1 Z160.000 F600;\nG54;');
        assert.ok(!/Z/.test(plan.stepGcodes[1].replace(/G5[34]/g, '')), 'the XY steps write no Z');
        assert.match(plan.reviewText, /ONE UP-only raise first, machine Z 120.000 -> 160.000/);
        assert.match(plan.reviewText, /; computed safe height: test/);
        assert.equal(plan.steps[0].from.z, 160);
        // the clamp (physical top 40 + tool 30 + 5 = 75) is below 160: passes; a taller one is refused at 160
        assert.throws(() => planTraverseXy(planInput({
            currentMachine: { x: 10, y: 20, z: 120 },
            motionFloorZ: 150,
            entryRaiseZ: 160,
            obstacles: [box('tower', 50, 30, 60, 40, 140)],
        })), /crosses a landmark/);
    }],

    ['the entry raise never descends, never passes the top, never stops under the floor', () => {
        assert.throws(() => planTraverseXy(planInput({ entryRaiseZ: 200 })), /would not be UP/);
        assert.throws(() => planTraverseXy(planInput({ currentMachine: { x: 10, y: 20, z: 100 }, entryRaiseZ: 330 })), /outside the motion floor/);
        assert.throws(() => planTraverseXy(planInput({ currentMachine: { x: 10, y: 20, z: 100 }, entryRaiseZ: 200 })), /outside the motion floor 320/);
        assert.throws(() => planTraverseXy(planInput({
            currentMachine: { x: 10, y: 20, z: 100 }, motionFloorZ: 150, entryRaiseZ: 200, machine: { hasZ: true, gcode: 'grbl-relative' },
        })), /Snapmaker 2.0-form/);
    }],

    ['the swept path resolves omitted axes and the work frame like the planner', () => {
        assert.deepEqual(traverseMachinePath([{ x: 100 }, { y: 50 }], 'machine', { x: 1, y: 2 }, { x: 0, y: 0 }), [{ x: 1, y: 2 }, { x: 100, y: 2 }, { x: 100, y: 50 }]);
        assert.deepEqual(traverseMachinePath([{ x: 10, y: 10 }], 'work', { x: 1, y: 2 }, { x: 5, y: -5 }), [{ x: 1, y: 2 }, { x: 5, y: 15 }]);
        assert.equal(traverseMachinePath([{}], 'machine', { x: 1, y: 2 }, { x: 0, y: 0 }), null);
        const plan = planTraverseXy(planInput({ frame: 'work', originOffset: { x: 5, y: -5, z: 0 }, targets: [{ x: 10, y: 10 }] }));
        assert.deepEqual({ x: plan.steps[0].to.x, y: plan.steps[0].to.y }, { x: 5, y: 15 });
    }],
];
