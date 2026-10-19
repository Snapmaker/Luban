import { strict as assert } from 'assert';

import { ObstacleBox } from '../envelopeChecks';
import {
    TraverseMachine,
    TraversePlanError,
    TraversePlanInput,
    mayDescend,
    parseSettleComment,
    planRaiseToTop,
    planToolSetterEnd,
    planTraverseXy,
    relativeXyStep,
} from '../traversePlan';

// The A350 travel as resolved with the head observed at home X-19: the definition's box, widened by the evidence.
const TRAVEL = { xMin: -19, xMax: 320, yMin: 0, yMax: 350 };
const OFFSET = { x: -51, y: -122, z: -328 };
const ROTARY: ObstacleBox = { name: 'rotary-axis', machine: { x0: 140, y0: 0, x1: 200, y1: 350 }, clearanceZ: 328, mode: 'crossing' };

function input(over: Partial<TraversePlanInput> = {}): TraversePlanInput {
    return {
        targets: [{ x: 290, y: 105 }],
        frame: 'machine',
        currentMachine: { x: -19, y: 342, z: 328 },
        originOffset: OFFSET,
        travel: TRAVEL,
        traverseZ: 328,
        feedRate: 1500,
        obstacles: [ROTARY],
        reason: 'transit to the tailstock viewing pose',
        ...over,
    };
}

function refuses(fn: () => unknown, needle: string): void {
    try {
        fn();
    } catch (err) {
        assert.ok(err instanceof TraversePlanError, `expected TraversePlanError, got ${String(err)}`);
        assert.ok((err as Error).message.includes(needle), (err as Error).message);
        return;
    }
    assert.fail(`expected a refusal containing "${needle}"`);
}

export const tests: Array<[string, () => void]> = [
    ['the 2026-09-12 transit as a staged machine-frame traverse at 328: one declared step, no Z word', () => {
        const plan = planTraverseXy(input());
        assert.equal(plan.steps.length, 1);
        assert.equal(plan.steps[0].gcode, 'G90\nG53;\nG1 X290.000 Y105.000 F1500;\nG54;');
        assert.ok(!/Z/.test(plan.steps[0].gcode.replace(/G53|G54/g, '')), 'no Z word in an XY traverse');
        assert.equal(Math.round(plan.steps[0].distanceMm), 389);
        assert.ok(plan.header.includes('frame: machine coords'));
        assert.ok(plan.header.includes('Z does NOT change'));
        assert.ok(plan.name.startsWith('xy-traverse machine -> (290.0, 105.0)'));
    }],

    ['home reports 327.9989959716797 for Z328: that IS the traverse height (live refusal 2026-09-14)', () => {
        const plan = planTraverseXy(input({ currentMachine: { x: -19, y: 342, z: 327.9989959716797 } }));
        assert.equal(plan.steps.length, 1, 'the rotary landmark (clearance 328) must not refuse a 1 um shortfall either');
        assert.equal(plan.steps[0].to.z, 328, 'segments are planned at the height the head is at');
        refuses(() => planTraverseXy(input({ currentMachine: { x: -19, y: 342, z: 327.9 } })), 'below the motion floor');
    }],

    ['refused below the motion floor, with no override', () => {
        refuses(() => planTraverseXy(input({ currentMachine: { x: 100, y: 100, z: 320 } })), 'below the motion floor 328');
    }],

    ['a series fills omitted axes from the previous target and reports every leg', () => {
        const plan = planTraverseXy(input({ targets: [{ x: 100 }, { y: 200 }, { x: 150, y: 250 }] }));
        assert.deepEqual(plan.steps.map((s) => s.target), [{ x: 100, y: 342 }, { x: 100, y: 200 }, { x: 150, y: 250 }]);
        assert.equal(plan.steps[1].gcode, 'G90\nG53;\nG1 X100.000 Y200.000 F1500;\nG54;');
        assert.ok(plan.reviewText.includes('; --- next approved step ---'));
        assert.ok(plan.name.startsWith('xy-series machine x3'));
        assert.ok(Math.abs(plan.totalDistanceMm - (119 + 142 + Math.hypot(50, 50))) < 0.01);
    }],

    ['work-frame targets convert through the offset for the checks and declare G54', () => {
        const plan = planTraverseXy(input({ frame: 'work', targets: [{ x: 239, y: -17 }] }));
        assert.deepEqual(plan.steps[0].to, { x: 290, y: 105, z: 328 });
        assert.equal(plan.steps[0].gcode, 'G90\nG54;\nG1 X239.000 Y-17.000 F1500');
        assert.ok(plan.header.includes('= machine (290.000, 105.000)'));
    }],

    ['a target outside the travel is refused, naming the axis, the overshoot and the machine coordinates', () => {
        refuses(() => planTraverseXy(input({ targets: [{ x: 400, y: 100 }] })), 'X 400 is 80 mm beyond the X maximum 320');
        // X-25 was admitted by the old -25 slop; the A350 travel stops at X-19.
        refuses(() => planTraverseXy(input({ targets: [{ x: -25, y: 100 }] })), 'X -25 is 6 mm below the X minimum -19');
        // The travel end itself passes, with the heartbeat's float noise tolerated.
        assert.equal(planTraverseXy(input({ targets: [{ x: -19.00000610351563, y: 100 }] })).steps.length, 1);
    }],
    ['with no travel known, targets are not checked against one (the caller decides)', () => {
        assert.equal(planTraverseXy(input({ travel: null, targets: [{ x: 400, y: 100 }] })).steps.length, 1);
        refuses(() => planTraverseXy(input({ frame: 'work', targets: [{ x: 0, y: 300 }] })), 'machine (51.000, 422.000)');
    }],

    ['the real overtravel is inside the margins (home X-19, Y342)', () => {
        const plan = planTraverseXy(input({ currentMachine: { x: 100, y: 100, z: 328 }, targets: [{ x: -19, y: 342 }] }));
        assert.equal(plan.steps.length, 1);
    }],

    ['a landmark taller than the current Z refuses the path and names it', () => {
        const tall: ObstacleBox = { ...ROTARY, name: 'tall-fixture', clearanceZ: 335 };
        refuses(() => planTraverseXy(input({ obstacles: [tall] })), 'tall-fixture');
    }],

    ['at 328 the rotary landmark (clearance 328) is crossed lawfully - no exemption involved', () => {
        const plan = planTraverseXy(input({ traverseZ: 328 }));
        assert.equal(plan.steps.length, 1);
    }],

    ['a lower configured traverse height with the head at that height refuses crossing the rotary box', () => {
        refuses(() => planTraverseXy(input({ traverseZ: 320, currentMachine: { x: -19, y: 342, z: 320 } })), 'rotary-axis');
    }],

    ['abort retreat law: job fd7fa6cb6396 aborted at home (Z 327.999) - nothing is sent, never a plunge to the start height', () => {
        const atHome = planRaiseToTop(327.9989959716797, 328);
        assert.equal(atHome.action, 'skip', 'the head is already at the top within the float tolerance');
        assert.equal(atHome.targetZ, 328);
        const exact = planRaiseToTop(328, 328);
        assert.equal(exact.action, 'skip');
    }],

    ['abort retreat law: below the top the retreat is a Z-only raise TO the traverse height, whatever the start height was', () => {
        const midDescent = planRaiseToTop(205.5, 328);
        assert.equal(midDescent.action, 'raise');
        assert.equal(midDescent.targetZ, 328);
        const justUnder = planRaiseToTop(327.9, 328);
        assert.equal(justUnder.action, 'raise', '0.1 mm under the top is a real shortfall, not float noise');
        const unknown = planRaiseToTop(null, 328);
        assert.equal(unknown.action, 'raise', 'an unknown Z still gets the one move that cannot descend');
        assert.equal(unknown.targetZ, 328);
        assert.ok(unknown.reason.includes('unknown'));
    }],

    ['issue #91: a COMPLETED tool setter run ends at the traverse height - a Z-only raise from the trigger, never the start height', () => {
        // The live rig: trigger ~175.5 with the 75 mm reference, start height ~235, top 328.
        const done = planToolSetterEnd(false, 175.5, 328);
        assert.equal(done.action, 'raise');
        assert.equal(done.targetZ, 328, 'the raise targets the traverse height, not the 235 start height');
        assert.ok(done.reason.includes('raise from machine Z 175.500 to the traverse height 328'), done.reason);
        // The success path and the abort path make the same decision from the same Z.
        assert.deepEqual(done, planRaiseToTop(175.5, 328));
    }],

    ['issue #91: already at the traverse height (float noise included) - nothing is sent', () => {
        const atTop = planToolSetterEnd(false, 327.9989959716797, 328);
        assert.equal(atTop.action, 'skip');
        assert.equal(atTop.targetZ, 328);
        assert.equal(planToolSetterEnd(false, 328, 328).action, 'skip');
        assert.equal(planToolSetterEnd(false, 327.9, 328).action, 'raise', '0.1 mm under the top is a real shortfall');
    }],

    ['issue #91: stay_at_trigger (touchscreen swap wizard) holds in contact - no retreat of any kind', () => {
        const held = planToolSetterEnd(true, 175.5, 328);
        assert.equal(held.action, 'hold');
        assert.equal(held.targetZ, 175.5, 'the head stays at the measured trigger');
        assert.ok(held.reason.includes('no retreat'), held.reason);
        // Holding wins even when a raise would otherwise be due or skipped.
        assert.equal(planToolSetterEnd(true, 328, 328).action, 'hold');
        assert.equal(planToolSetterEnd(true, null, 328).action, 'hold');
    }],

    ['mayDescend: a "back to the start" leg is skipped only when the start is below the head', () => {
        assert.equal(mayDescend(328, 205.5), true, 'abort before the tool-setter travel: start height is 122 mm below');
        assert.equal(mayDescend(200, 205.5), false, 'mid-march: the start is above the contact - retreating to it is a lift');
        assert.equal(mayDescend(205.5, 205.5), false);
        assert.equal(mayDescend(205.52, 205.5), false, 'within the float tolerance is not a descent');
        assert.equal(mayDescend(null, 205.5), true, 'unknown Z: a descent cannot be ruled out, so the leg is skipped and only the raise runs');
    }],

    ['empty, over-long and axis-less target lists are refused', () => {
        refuses(() => planTraverseXy(input({ targets: [] })), 'Provide 1-20');
        refuses(() => planTraverseXy(input({ targets: new Array(21).fill({ x: 1 }) })), 'Provide 1-20');
        refuses(() => planTraverseXy(input({ targets: [{}] })), 'names neither x nor y');
    }],

    // C1: transport is allowed at the motion floor, not only at the park
    // height. The two were one number until 2026-09-19, which is why the park
    // height sat at the ceiling.
    ['transport is allowed at the motion floor and refused below it', () => {
        // A target clear of the rotary box: the floor is about law 2, and the
        // landmark check is exercised separately below.
        const at = (z: number) => planTraverseXy({
            ...input(),
            targets: [{ x: 100, y: 105 }],
            currentMachine: { x: 20, y: 105, z },
            traverseZ: 328,
            motionFloorZ: 320,
        });
        assert.ok(at(328), 'at the park height');
        assert.ok(at(320), 'at the floor');
        assert.ok(at(319.96), 'and a float-noise hair below it');
        assert.throws(() => at(319.9), /below the motion floor 320/);
    }],

    ['the segments are planned where the head actually is, not at the park height', () => {
        const plan = planTraverseXy({
            ...input(),
            targets: [{ x: 100, y: 105 }],
            currentMachine: { x: 20, y: 105, z: 321 },
            traverseZ: 328,
            motionFloorZ: 320,
        });
        assert.equal(plan.steps[0].from.z, 321, 'a corridor the toolhead is actually in');
        assert.equal(plan.steps[0].to.z, 321);
    }],

    ['a landmark is checked at the real height - no exemption for being high', () => {
        // The rotary landmark's clearance is the park height, so transport at
        // the floor across it is refused. That is the point of the floor being
        // safe: the registry does the work the blanket height used to.
        assert.throws(
            () => planTraverseXy({
                ...input(),
                targets: [{ x: 290, y: 105 }],
                currentMachine: { x: 20, y: 105, z: 320 },
                traverseZ: 328,
                motionFloorZ: 320,
                obstacles: [ROTARY],
            }),
            /crosses a landmark/
        );
    }],

    ['omitting the floor keeps the old behaviour exactly', () => {
        assert.throws(
            () => planTraverseXy({ ...input(), currentMachine: { x: 20, y: 105, z: 321 }, traverseZ: 328 }),
            /below the motion floor 328/
        );
    }],

    // ---- The Snapmaker Ray (#260 follow-up, 2026-10-18): no Z axis, GRBL firmware ----
    // The live refusal: at machine X181 Y49 Z0, traverse_xy {x: 176, y: 49} (5 mm) was
    // refused "below the motion floor 320 ... Raise Z with move_z first" - on a machine
    // that has no Z. The Ray's travel is its model 600 x 400 +/- the 25 mm fudge.
    ['the Ray at Z0: a 5 mm traverse is PLANNED, not refused - no Z law applies to a machine without Z', () => {
        const ray: TraverseMachine = { hasZ: false, gcode: 'grbl-relative' };
        const plan = planTraverseXy(input({
            targets: [{ x: 176, y: 49 }],
            currentMachine: { x: 181, y: 49, z: 0 },
            originOffset: { x: -181, y: -49, z: 0 },
            travel: { xMin: -25, xMax: 625, yMin: -25, yMax: 425 },
            obstacles: [],
            machine: ray,
            reason: 'Ray acceptance: 5 mm in -X',
        }));
        assert.equal(plan.steps.length, 1);
        assert.equal(plan.relative, true);
        assert.equal(plan.steps[0].to.z, 0, 'planned at the machine\'s only height');
        assert.ok(!plan.steps[0].gcode.includes('Z'), 'no Z word');
        assert.ok(!plan.steps[0].gcode.includes('G53') && !plan.steps[0].gcode.includes('G54'), 'no frame words: a relative step needs none');
        assert.equal(plan.steps[0].gcode, '; mcp-settle machine X176.000 Y49.000\nG91\nG1 X-5.000 Y0.000 F1500\nG90', 'Luban\'s own Ray jog form');
        assert.deepEqual(parseSettleComment(plan.steps[0].gcode), { x: 176, y: 49 });
        assert.ok(plan.header.includes('this machine has NO Z axis'));
        assert.ok(!plan.header.includes('traverse height 328'), 'the header does not cite a traverse height that does not exist');
        assert.ok(!plan.reviewText.includes('move_z'));
    }],

    ['the same call on an A350 at Z0 is still refused exactly as before, with the move_z advice', () => {
        refuses(() => planTraverseXy(input({
            targets: [{ x: 176, y: 49 }],
            currentMachine: { x: 181, y: 49, z: 0 },
            motionFloorZ: 320,
            obstacles: [],
        })), 'below the motion floor 320 (law 2: all XY over 1 mm at or above it). Raise Z with move_z');
        // And the default machine (omitted) is the A350: absolute G53 steps, byte for byte.
        const plan = planTraverseXy(input());
        assert.equal(plan.relative, false);
        assert.deepEqual(plan.machine, { hasZ: true, gcode: 'snapmaker-2' });
        assert.equal(plan.steps[0].gcode, 'G90\nG53;\nG1 X290.000 Y105.000 F1500;\nG54;');
    }],

    ['the A350 rotary keep-out does not apply on the Ray - the caller scopes landmarks, the planner sees none', () => {
        // The operator's Ray acceptance route: -Y in 50 mm steps from home towards Y80, then +X to X90.
        // X140-200 is the A350 rotary's box; on the Ray the landmark store returns nothing for it.
        const ray: TraverseMachine = { hasZ: false, gcode: 'grbl-relative' };
        const plan = planTraverseXy(input({
            targets: [{ y: 349 }, { y: 299 }, { y: 249 }, { y: 199 }, { y: 149 }, { y: 99 }, { y: 80 }, { x: 90 }],
            currentMachine: { x: -1, y: 399, z: 0 },
            originOffset: { x: 0, y: 0, z: 0 },
            travel: { xMin: -25, xMax: 625, yMin: -25, yMax: 425 },
            obstacles: [],
            machine: ray,
            reason: 'Ray acceptance route',
        }));
        assert.equal(plan.steps.length, 8);
        // Each relative step is the delta from the PREVIOUS planned endpoint and names its absolute endpoint.
        assert.equal(plan.steps[0].gcode, '; mcp-settle machine X-1.000 Y349.000\nG91\nG1 X0.000 Y-50.000 F1500\nG90');
        assert.equal(plan.steps[6].gcode, '; mcp-settle machine X-1.000 Y80.000\nG91\nG1 X0.000 Y-19.000 F1500\nG90');
        assert.equal(plan.steps[7].gcode, '; mcp-settle machine X90.000 Y80.000\nG91\nG1 X91.000 Y0.000 F1500\nG90');
        assert.equal(Math.round(plan.totalDistanceMm), 410);
        // Were the A350 landmark handed in anyway, the Ray plan would still be checked against it
        // at Z0 and refuse - which is exactly why the store scopes by machine.
        refuses(() => planTraverseXy(input({
            targets: [{ x: 250 }],
            currentMachine: { x: -1, y: 80, z: 0 },
            originOffset: { x: 0, y: 0, z: 0 },
            travel: { xMin: -25, xMax: 625, yMin: -25, yMax: 425 },
            obstacles: [ROTARY],
            machine: ray,
        })), 'crosses a landmark');
    }],

    ['the Ray travel check: X650 is refused against the model + fudge, with no set_probe_geometry-only advice', () => {
        const ray: TraverseMachine = { hasZ: false, gcode: 'grbl-relative' };
        refuses(() => planTraverseXy(input({
            targets: [{ x: 650 }],
            currentMachine: { x: 181, y: 49, z: 0 },
            travel: { xMin: -25, xMax: 625, yMin: -25, yMax: 425 },
            obstacles: [],
            machine: ray,
        })), 'X 650 is 25 mm beyond the X maximum 625');
    }],

    ['the settle comment is parsed strictly and only from its own line', () => {
        assert.deepEqual(parseSettleComment('; reason: G1 to X5\n; mcp-settle machine X-1.000 Y349.000\nG91\nG1 X0.000 Y-50.000 F1500\nG90'), { x: -1, y: 349 });
        assert.equal(parseSettleComment('G90\nG53;\nG1 X290.000 Y105.000 F1500;\nG54;'), null);
        assert.equal(parseSettleComment('; mcp-settle machine X1 Y2 extra'), null);
        assert.equal(relativeXyStep({ x: 10, y: 20 }, { x: 12.5, y: 20 }, 1000, 'G0'), '; mcp-settle machine X12.500 Y20.000\nG91\nG0 X2.500 Y0.000 F1000\nG90');
    }],
];
