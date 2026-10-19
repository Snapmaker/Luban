// Generic motion in each machine's dialect (WP4a, tyeth/Luban#265 plan 2.4 /
// R6): gcodeForms.ts, and the planners that now write through it. The A350's
// bytes are pinned to the literals every earlier emitter wrote.
import assert from 'assert';
import { dialectById, dialectFor } from '../gcodeDialect';
import {
    PLANNER_SYNC,
    gcodeFormOf,
    genericMotionRefusal,
    homeSequence,
    machineFrameMove,
    needsPlannerSync,
    parseSettleComment,
    relativeStep,
    settleComment,
    workFrameMove,
    workFrameRestore,
    workFrameRestoreCommands,
} from '../gcodeForms';
import { WORK_FRAME_RESTORE_GCODE } from '../frameRecovery';
import { G28_HOME_SEQUENCE, GRBL_HOME, RAY_IDENTIFIER } from '../machineCapability';
import { planTraverseXy, relativeXyStep } from '../traversePlan';
import { restoreCommands } from '../failureRecovery';
import { resolveJobFrame, validateGcode } from '../validator';

const SM2 = dialectById('sm2-marlin');
const RAY = dialectById('ray-grbl');
const ORIGINAL = dialectById('original-marlin');
const J1 = dialectById('j1-marlin');
const ARTISAN = dialectById('artisan-marlin');
const UNKNOWN = dialectById('unknown');

const text = { sacp: false, machineIdentifier: 'Original', canExecuteGcode: true, canGoHome: false };

function throwsNamed(fn: () => unknown, pattern: RegExp): void {
    assert.throws(fn, (err: Error) => err.name === 'GcodeFormError' && pattern.test(err.message));
}

const baseTraverse = {
    frame: 'machine' as const,
    currentMachine: { x: 100, y: 100, z: 328 },
    originOffset: { x: 0, y: 0, z: 0 },
    travel: null,
    traverseZ: 328,
    motionFloorZ: 320,
    feedRate: 1500,
    obstacles: [],
    reason: 'test',
};

export const tests: Array<[string, () => void]> = [
    ['forms per dialect: sm2 for the 2.0 and Artisan, relative steps for Ray / Original / J1, none for unknown', () => {
        assert.equal(gcodeFormOf(SM2), 'sm2');
        assert.equal(gcodeFormOf(ARTISAN), 'sm2');
        assert.equal(gcodeFormOf(RAY), 'relative-steps');
        assert.equal(gcodeFormOf(ORIGINAL), 'relative-steps');
        assert.equal(gcodeFormOf(J1), 'relative-steps');
        throwsNamed(() => gcodeFormOf(UNKNOWN), /not in this MCP's G-code dialect table/);
    }],

    ['A350 bytes: machine/work frame moves are the literals every emitter wrote before', () => {
        assert.equal(machineFrameMove(SM2, 'X290.000 Y105.000', 1500), 'G90\nG53;\nG1 X290.000 Y105.000 F1500;\nG54;');
        assert.equal(workFrameMove(SM2, 'X10.000 Y20.000', 1500), 'G90\nG54;\nG1 X10.000 Y20.000 F1500');
        assert.equal(machineFrameMove(SM2, 'Z328.000', 600), 'G90\nG53;\nG1 Z328.000 F600;\nG54;', 'move_z machine step');
        assert.equal(workFrameMove(SM2, 'Z5.000', 600), 'G90\nG54;\nG1 Z5.000 F600', 'move_z work step');
        assert.equal(machineFrameMove(SM2, 'X1.000 Y2.000', 3000, { command: 'G0', declareDistance: false }), 'G53;\nG0 X1.000 Y2.000 F3000;\nG54;',
            'move_and_capture machine nudge');
        assert.equal(workFrameMove(SM2, 'X1.000 Y2.000', 3000, { command: 'G0', declareDistance: false }), 'G54;\nG0 X1.000 Y2.000 F3000');
        const plan = planTraverseXy({ ...baseTraverse, targets: [{ x: 176, y: 49 }] });
        assert.equal(plan.steps[0].gcode, 'G90\nG53;\nG1 X176.000 Y49.000 F1500;\nG54;');
        const withRow = planTraverseXy({ ...baseTraverse, targets: [{ x: 176, y: 49 }], machine: { hasZ: true, gcode: 'snapmaker-2', dialect: SM2 } });
        assert.equal(withRow.steps[0].gcode, plan.steps[0].gcode, 'the A350 row writes the same bytes as the default');
    }],

    ['no G53/G54 form on a relative-steps machine; no relative step on the 2.0', () => {
        for (const dialect of [RAY, ORIGINAL, J1]) {
            throwsNamed(() => machineFrameMove(dialect, 'X1 Y1', 100), /never receives a G53 or G54/);
            throwsNamed(() => workFrameMove(dialect, 'X1 Y1', 100), /never receives a G53 or G54/);
        }
        throwsNamed(() => relativeStep(SM2, { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, 100), /absolute steps/);
    }],

    ['Ray relative step is #264\'s bytes led by M5 (head state unknown); the Original adds the planner sync, no M5', () => {
        const ends = { from: { x: -1, y: 399 }, to: { x: -1, y: 349 } };
        // #264's form unchanged, with the laser-off line after the settle comment (#315: the Ray never reports its laser).
        assert.equal(relativeStep(RAY, ends, 1500, { laserOff: false }), relativeXyStep(ends.from, ends.to, 1500));
        assert.equal(relativeStep(RAY, ends, 1500), '; mcp-settle machine X-1.000 Y349.000\nM5\nG91\nG1 X0.000 Y-50.000 F1500\nG90');
        assert.equal(needsPlannerSync(RAY), false);
        assert.equal(needsPlannerSync(ORIGINAL), true);
        assert.equal(relativeStep(ORIGINAL, ends, 1500), `; mcp-settle machine X-1.000 Y349.000\nG91\nG1 X0.000 Y-50.000 F1500\nG90\n${PLANNER_SYNC}`);
        const rayPlan = planTraverseXy({ ...baseTraverse,
            currentMachine: { x: -1, y: 399, z: 0 },
            targets: [{ x: -1, y: 349 }],
            machine: { hasZ: false, gcode: 'grbl-relative', dialect: RAY } });
        assert.equal(rayPlan.steps[0].gcode, '; mcp-settle machine X-1.000 Y349.000\nM5\nG91\nG1 X0.000 Y-50.000 F1500\nG90');
        const originalPlan = planTraverseXy({ ...baseTraverse,
            currentMachine: { x: 10, y: 10, z: 50 },
            motionFloorZ: 40,
            traverseZ: 50,
            targets: [{ x: 30, y: 10 }],
            machine: { hasZ: true, gcode: 'grbl-relative', dialect: ORIGINAL } });
        assert.equal(originalPlan.steps[0].gcode, '; mcp-settle machine X30.000 Y10.000\nG91\nG1 X20.000 Y0.000 F1500\nG90\nG4 P0');
        assert.ok(!/G53|G54/.test(originalPlan.reviewText), 'no G53/G54 anywhere on the Original');
        assert.ok(originalPlan.relative);
    }],

    ['relative Z step (move_z on the Original): Z word, Z in the settle comment, and the Z-less refusal', () => {
        const step = relativeStep(ORIGINAL, { from: { x: 10, y: 20, z: 50 }, to: { x: 10, y: 20, z: 40 } }, 300, { hasZ: true });
        assert.equal(step, '; mcp-settle machine X10.000 Y20.000 Z40.000\nG91\nG1 X0.000 Y0.000 Z-10.000 F300\nG90\nG4 P0');
        assert.deepEqual(parseSettleComment(step), { x: 10, y: 20, z: 40 });
        throwsNamed(() => relativeStep(RAY, { from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 5 } }, 300, { hasZ: false }), /no Z axis/);
    }],

    ['settle comment: Z is optional and only written when given; strict parse', () => {
        assert.equal(settleComment({ x: 1, y: 2 }), '; mcp-settle machine X1.000 Y2.000');
        assert.equal(settleComment({ x: 1, y: 2, z: null }), '; mcp-settle machine X1.000 Y2.000');
        assert.deepEqual(parseSettleComment('; mcp-settle machine X1.000 Y2.000'), { x: 1, y: 2 });
        assert.equal(Object.keys(parseSettleComment('; mcp-settle machine X1 Y2') || {}).length, 2, 'no z key when absent');
        assert.deepEqual(parseSettleComment('; mcp-settle machine X1 Y2 Z-3.5'), { x: 1, y: 2, z: -3.5 });
        assert.equal(parseSettleComment('; mcp-settle machine X1 Y2 Z3 extra'), null);
        assert.equal(parseSettleComment('; mcp-settle machine X1 Z3'), null);
    }],

    ['work frame restore: G90/G54; on the 2.0 (unchanged constant), G90 alone on the Ray and the Original', () => {
        assert.equal(workFrameRestore(SM2), WORK_FRAME_RESTORE_GCODE);
        assert.equal(workFrameRestore(RAY), 'G90');
        assert.equal(workFrameRestore(ORIGINAL), 'G90');
        assert.deepEqual(workFrameRestoreCommands(SM2), ['G90', 'G54']);
        assert.deepEqual(workFrameRestoreCommands(RAY), ['G90']);
        throwsNamed(() => workFrameRestore(UNKNOWN), /emits nothing/);
    }],

    ['failure cleanup sends G54 only where the machine selects workspaces', () => {
        const exposed = { state: { workspace: 'G53', distance: 'G91' }, g53_possible: true } as unknown as Parameters<typeof restoreCommands>[0];
        assert.deepEqual(restoreCommands(exposed), ['G90', 'G54'], 'default: the A350 as always');
        assert.deepEqual(restoreCommands(exposed, true), ['G90', 'G54']);
        assert.deepEqual(restoreCommands(exposed, false), ['G90'], 'Ray / Original: never a G54');
    }],

    ['home: A350 unchanged, Ray $H, Artisan/J1 SACP request, Original G28 ALONE', () => {
        const a350 = homeSequence(SM2, { sacp: false, machineIdentifier: 'Snapmaker 2.0 A350', canExecuteGcode: true, canGoHome: false });
        assert.equal(a350.gcode, G28_HOME_SEQUENCE);
        assert.equal(a350.kind, 'g28-sequence');
        const ray = homeSequence(RAY, { sacp: true, machineIdentifier: RAY_IDENTIFIER, canExecuteGcode: true, canGoHome: true });
        assert.equal(ray.gcode, GRBL_HOME, '$H stays the exact string observed homing the Ray');
        assert.equal(ray.laserOff, 'M5', 'the Ray\'s laser-off goes out as its own payload before the home');
        assert.equal('laserOff' in a350, false, 'nothing new on the A350');
        assert.equal(homeSequence(ARTISAN, { sacp: true, machineIdentifier: 'A400', canExecuteGcode: true, canGoHome: true }).kind, 'sacp-home-request');
        assert.equal(homeSequence(J1, { sacp: true, machineIdentifier: 'Snapmaker J1', canExecuteGcode: true, canGoHome: true }).kind, 'sacp-home-request');
        const original = homeSequence(ORIGINAL, text);
        assert.equal(original.kind, 'g28-only');
        assert.equal(original.gcode, 'G28');
        assert.ok(!/G53|G54/.test(original.gcode as string));
        assert.equal(homeSequence(dialectFor('Original Long Z-axis'), text).gcode, 'G28');
        throwsNamed(() => homeSequence(UNKNOWN, text), /emits nothing/);
        // Never the 2.0 sequence on another machine's text transport: GRBL's G28 is not a home.
        throwsNamed(() => homeSequence(RAY, { sacp: false, machineIdentifier: RAY_IDENTIFIER, canExecuteGcode: true, canGoHome: false }),
            /cannot be homed over this transport/);
        throwsNamed(() => homeSequence(J1, { sacp: false, machineIdentifier: 'Snapmaker J1', canExecuteGcode: true, canGoHome: false }),
            /cannot be homed over this transport/);
    }],

    ['generic motion: J1 refused with the printer text, unknown refused, the rest allowed', () => {
        assert.match(genericMotionRefusal(J1, 'traverse_xy') as string, /Refusing traverse_xy: the Snapmaker J1 .* is a printer.*except home/);
        assert.match(genericMotionRefusal(UNKNOWN, 'move_z') as string, /Refusing move_z: .*not in this MCP's G-code dialect table/);
        for (const dialect of [SM2, RAY, ORIGINAL, ARTISAN]) {
            assert.equal(genericMotionRefusal(dialect, 'traverse_xy'), null, dialect.id);
        }
    }],

    ['the Original\'s relative traverse and move_z texts pass the staged frame check (relative transport)', () => {
        const ctx = { frameArgument: null, originOffsetZ: null, offsetReliable: false, machineZMax: null, relativeTransport: true };
        const plan = planTraverseXy({ ...baseTraverse,
            currentMachine: { x: 10, y: 10, z: 50 },
            motionFloorZ: 40,
            traverseZ: 50,
            targets: [{ x: 30, y: 10 }, { x: 30, y: 40 }],
            machine: { hasZ: true, gcode: 'grbl-relative', dialect: ORIGINAL } });
        assert.equal(resolveJobFrame(validateGcode(plan.reviewText), ctx).refusal, null, 'traverse');
        const zStep = relativeStep(ORIGINAL, { from: { x: 10, y: 20, z: 50 }, to: { x: 10, y: 20, z: 40 } }, 300, { hasZ: true });
        assert.equal(resolveJobFrame(validateGcode(`; reason: test\n${zStep}`), ctx).refusal, null, 'move_z step');
        assert.notEqual(resolveJobFrame(validateGcode(zStep), { ...ctx, relativeTransport: false }).refusal, null,
            'without the relative-transport flag the frame doctrine still refuses it');
    }],
];
