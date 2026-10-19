import { strict as assert } from 'assert';

import { GotoWorkOriginInput, gateDirectXy, planGotoWorkOrigin } from '../directMovePlan';
import { ObstacleBox } from '../envelopeChecks';
import { TraversePlanError } from '../traversePlan';
import { resolveJobFrame, validateGcode } from '../validator';

const TRAVEL = { xMin: -19, xMax: 320, yMin: 0, yMax: 350 };
// Work origin at machine (51, 122): machine = work - offset.
const OFFSET = { x: -51, y: -122, z: -328 };
const ROTARY: ObstacleBox = { name: 'rotary-axis', machine: { x0: 140, y0: 0, x1: 200, y1: 350 }, clearanceZ: 328, mode: 'crossing' };
const A350 = { frameArgument: null, originOffsetZ: -328, offsetReliable: true, machineZMax: 330 };

function input(over: Partial<GotoWorkOriginInput> = {}): GotoWorkOriginInput {
    return {
        currentMachine: { x: -19, y: 342, z: 328 },
        originOffset: OFFSET,
        offsetSource: 'heartbeat',
        positionWarnings: [],
        travel: TRAVEL,
        traverseZ: 328,
        motionFloorZ: 320,
        feedRate: 1500,
        obstacles: [ROTARY],
        reason: 'back to the datum for a look',
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
    // ---- move_and_capture Z gate ----
    ['an unknown machine Z refuses the XY - even with operator_confirmed_clearance', () => {
        const gate = gateDirectXy(null, 320, false);
        assert.equal(gate.action, 'refuse');
        assert.equal(gate.planZ, null);
        assert.ok(gate.reason.includes('cannot be established'), gate.reason);
        assert.equal(gateDirectXy(null, 320, true).action, 'refuse', 'nobody can confirm a height the record does not hold');
        assert.equal(gateDirectXy(Number.NaN, 320, false).action, 'refuse');
    }],

    ['at the motion floor (within the heartbeat\'s float noise) the XY proceeds at that Z', () => {
        const gate = gateDirectXy(319.999, 320, false);
        assert.equal(gate.action, 'proceed');
        assert.equal(gate.planZ, 319.999);
        assert.equal(gate.toZ, null);
        assert.equal(gateDirectXy(320.5, 320, false).action, 'proceed');
        // Operator ruling 2026-09-21: the gate is the MOTION FLOOR, not the park
        // height - a head at 322 is already legal to traverse at, so no raise.
        assert.equal(gateDirectXy(322, 320, false).action, 'proceed');
    }],

    ['below the motion floor the head is raised FIRST and the XY is planned at the raised Z', () => {
        const gate = gateDirectXy(300, 320, false);
        assert.equal(gate.action, 'raise');
        assert.equal(gate.fromZ, 300);
        assert.equal(gate.toZ, 320);
        assert.equal(gate.planZ, 320, 'path checks use the Z the XY will actually run at');
        assert.ok(gate.reason.includes('raise straight up first'), gate.reason);
    }],

    ['operator_confirmed_clearance is the one escape hatch: proceed at the CURRENT Z, no raise', () => {
        const gate = gateDirectXy(300, 320, true);
        assert.equal(gate.action, 'proceed');
        assert.equal(gate.planZ, 300);
        assert.ok(gate.reason.includes('operator confirmed this corridor'), gate.reason);
    }],

    // ---- goto_work_origin, staged ----
    ['work (0, 0) is resolved to MACHINE coordinates, shown on the page, and the move is emitted in the machine frame', () => {
        const plan = planGotoWorkOrigin(input());
        assert.deepEqual(plan.destinationMachine, { x: 51, y: 122 });
        assert.ok(plan.header.includes('work (0, 0) = MACHINE (51.000, 122.000)'), plan.header);
        assert.ok(plan.header.includes('die on a machine reboot'), plan.header);
        assert.equal(plan.steps.length, 1);
        assert.equal(plan.steps[0].gcode, 'G90\nG53;\nG1 X51.000 Y122.000 F1500;\nG54;');
        assert.ok(plan.name.startsWith('goto-work-origin -> machine (51.0, 122.0)'), plan.name);
        assert.ok(plan.reviewText.includes('G53;'), 'the body declares the machine frame');
        const resolved = resolveJobFrame(validateGcode(plan.reviewText), A350);
        assert.equal(resolved.refusal, null);
        assert.equal(resolved.report.frame.declared, 'machine');
        assert.deepEqual(resolved.report.extents.x, { min: 51, max: 51 });
        assert.deepEqual(resolved.report.extents.y, { min: 122, max: 122 });
        assert.equal(resolved.report.extents.z, null, 'Z is not touched');
    }],

    ['a cached or assumed origin offset refuses - work zero through an untrusted offset is anywhere on the bed', () => {
        refuses(() => planGotoWorkOrigin(input({ offsetSource: 'cached' })), 'source "cached"');
        refuses(() => planGotoWorkOrigin(input({ offsetSource: 'assumed-zero' })), 'source "assumed-zero"');
    }],

    ['a position of record with warnings refuses', () => {
        refuses(() => planGotoWorkOrigin(input({ positionWarnings: ['offset missing on the last beat; reused the cached one'] })), 'carries warnings');
    }],

    ['the travel check runs against the RESOLVED machine destination', () => {
        // Work origin resolves to machine X 400 - off the bed, whatever "work (0, 0)" sounds like.
        refuses(() => planGotoWorkOrigin(input({ originOffset: { x: -400, y: -122, z: -328 } })), 'machine (400.000, 122.000)');
    }],

    ['the landmark check runs against the resolved destination: a crossing below the clearance refuses, equal passes', () => {
        // Work origin at machine (170, 122) - the path from home enters the rotary box.
        const toRotary = { originOffset: { x: -170, y: -122, z: -328 } };
        const equal = planGotoWorkOrigin(input(toRotary));
        assert.deepEqual(equal.destinationMachine, { x: 170, y: 122 }, 'a hop AT the clearance passes (equal passes)');
        refuses(() => planGotoWorkOrigin(input({ ...toRotary, obstacles: [{ ...ROTARY, clearanceZ: 330 }] })), 'crosses a landmark');
    }],

    ['below the motion floor the move is refused - law 2 applies to the work origin like any traverse', () => {
        refuses(() => planGotoWorkOrigin(input({ currentMachine: { x: -19, y: 342, z: 300 } })), 'below the motion floor');
    }],

    // ---- The Ray (#260 follow-up): no Z axis ----
    ['on a machine with no Z axis the direct XY gate proceeds at the only height, even at Z0 or with Z unknown', () => {
        const atZero = gateDirectXy(0, 328, false, false);
        assert.equal(atZero.action, 'proceed');
        assert.equal(atZero.planZ, 0);
        assert.match(atZero.reason, /no Z axis/);
        assert.ok(!atZero.reason.includes('move_z'));
        const unknown = gateDirectXy(null, 328, false, false);
        assert.equal(unknown.action, 'proceed', 'an unknown Z on a Z-less machine is not a Z to establish');
        assert.equal(unknown.planZ, 0);
        // The A350 gate is byte-for-byte what it was: Z0 raises first, unknown refuses.
        assert.equal(gateDirectXy(0, 328, false, true).action, 'raise');
        assert.equal(gateDirectXy(0, 328, false).action, 'raise');
        assert.equal(gateDirectXy(null, 328, false, true).action, 'refuse');
    }],

    ['goto_work_origin on the Ray at Z0 is planned as a relative step, not refused below a floor', () => {
        const plan = planGotoWorkOrigin(input({
            currentMachine: { x: 181, y: 49, z: 0 },
            originOffset: { x: -181, y: -49, z: 0 },
            travel: { xMin: -25, xMax: 625, yMin: -25, yMax: 425 },
            obstacles: [],
            machine: { hasZ: false, gcode: 'grbl-relative' },
        }));
        assert.deepEqual(plan.destinationMachine, { x: 181, y: 49 });
        assert.equal(plan.relative, true);
        assert.equal(plan.steps[0].gcode, '; mcp-settle machine X181.000 Y49.000\nG91\nG1 X0.000 Y0.000 F1500\nG90');
    }],
];
