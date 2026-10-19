// Laser toolset planner (#265 WP7, plan 2.5): laser_frame, set_air_assist,
// set_crosshair and the laser_focus refusal, per machine dialect - and the
// validator accepting every staged body on the machine it was written for.
import assert from 'assert';
import { GcodeDialect, dialectById } from '../gcodeDialect';
import { parseSettleComment } from '../gcodeForms';
import {
    HeadFacts,
    LaserFramePlan,
    boxFromCorners,
    boxFromJobExtents,
    laserFocusRefusal,
    laserPowerWords,
    planAirAssist,
    planCrosshair,
    planLaserFrame,
} from '../laserPlan';
import { TravelLimits } from '../machineTravel';
import { MachineCapability, deriveMachineCapability } from '../machineCapability';
import { LASER_GATES, procedureRefusal } from '../procedureGates';
import { LASER_FRAME_POWER_PERCENT } from '../procedureLimits';
import { STEP_SEPARATOR } from '../traversePlan';
import { resolveJobFrame, validateGcode } from '../validator';

const RAY = dialectById('ray-grbl');
const SM2 = dialectById('sm2-marlin');
const ARTISAN = dialectById('artisan-marlin');
const ORIGINAL = dialectById('original-marlin');
const J1 = dialectById('j1-marlin');

const RAY_TRAVEL: TravelLimits = { xMin: 0, xMax: 600, yMin: 0, yMax: 400 };
const A350_TRAVEL: TravelLimits = { xMin: -19, xMax: 345, yMin: -4, yMax: 357 };
const NO_HEAD: HeadFacts = { headType: null, toolHead: null };
const LASER_20W: HeadFacts = { headType: 'laser', toolHead: '20W Laser Module' };

function rayFrame(extra: Partial<Parameters<typeof planLaserFrame>[0]> = {}): LaserFramePlan {
    return planLaserFrame({
        dialect: RAY,
        hasZ: false,
        current: { x: 10, y: 10, z: null },
        box: boxFromCorners(100, 100, 150, 150),
        boxSource: 'arguments',
        travel: RAY_TRAVEL,
        reason: 'frame the coaster',
        ...extra,
    });
}

function a350Frame(extra: Partial<Parameters<typeof planLaserFrame>[0]> = {}): LaserFramePlan {
    return planLaserFrame({
        dialect: SM2,
        hasZ: true,
        current: { x: 0, y: 0, z: 150 },
        box: boxFromCorners(100, 100, 150, 150),
        boxSource: 'arguments',
        travel: A350_TRAVEL,
        reason: 'frame the coaster',
        ...extra,
    });
}

const MACHINE_OF: { [id: string]: { identifier: string; hasZ: boolean } } = {
    'ray-grbl': { identifier: 'Ray', hasZ: false },
    'sm2-marlin': { identifier: 'Snapmaker 2.0 A350', hasZ: true },
    'artisan-marlin': { identifier: 'A400', hasZ: true },
    'original-marlin': { identifier: 'Original', hasZ: true },
};

/** The two checks validateStagedEnvelope (tools/staging.ts) makes on a server-emitted body. */
function assertStagedAccepted(dialect: GcodeDialect, body: string, relative: boolean, headType: string | null, what: string): void {
    const machine = MACHINE_OF[dialect.id];
    const report = validateGcode(body, { dialect, machineIdentifier: machine.identifier, hasZ: machine.hasZ, phase: 'staged', headType });
    assert.deepEqual(report.machine && report.machine.refusals, [], `${what}: dialect refusals`);
    const context = { frameArgument: null, originOffsetZ: null, offsetReliable: false, machineZMax: null, relativeTransport: relative };
    const resolved = resolveJobFrame(report, context);
    assert.equal(resolved.refusal, null, `${what}: frame refusal ${resolved.refusal}`);
}

/** The header with its comment wrapping undone, for matching a wrapped sentence. */
const oneLine = (header: string) => header.split('\n; ').join(' ');
const executable = (gcode: string) => gcode.split('\n').filter((l) => l.trim() && !l.trim().startsWith(';'));

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['the box comes from the arguments in any corner order, and a box with no area is refused', () => {
        assert.deepEqual(boxFromCorners(150, 150, 100, 100), { xMin: 100, xMax: 150, yMin: 100, yMax: 150 });
        assert.throws(() => boxFromCorners(100, 100, 100, 150), /has no area/);
        assert.throws(() => boxFromCorners(100, NaN, 120, 150), /y0 must be a finite number/);
    }],
    ['the box comes from a staged job: machine extents as-is, work extents only with a reliable offset, refusals otherwise', () => {
        const extents = { x: { min: 10, max: 60 }, y: { min: 20, max: 70 } };
        assert.deepEqual(boxFromJobExtents('j1', { extents, frame: { declared: 'machine', mixed: false }, usesRelativeMotion: false }, null),
            { xMin: 10, xMax: 60, yMin: 20, yMax: 70 });
        // machine = work - originOffset (traversePlan.ts toMachine).
        assert.deepEqual(boxFromJobExtents('j2', { extents, frame: { declared: 'work', mixed: false }, usesRelativeMotion: false }, { x: -100, y: -50 }),
            { xMin: 110, xMax: 160, yMin: 70, yMax: 120 });
        assert.throws(() => boxFromJobExtents('j3', { extents, frame: { declared: 'work', mixed: false }, usesRelativeMotion: false }, null),
            /live work-origin offset is not reliable/);
        assert.throws(() => boxFromJobExtents('j4', { extents: { x: null, y: null }, frame: { declared: 'machine', mixed: false }, usesRelativeMotion: false }, null),
            /no XY extents/);
        assert.throws(() => boxFromJobExtents('j5', { extents, frame: { declared: 'machine', mixed: false }, usesRelativeMotion: true }, null),
            /G91 relative motion/);
        assert.throws(() => boxFromJobExtents('j6', { extents, frame: { declared: 'machine', mixed: true }, usesRelativeMotion: false }, null),
            /both the machine and a work frame/);
        assert.throws(() => boxFromJobExtents('j7', { extents, frame: { declared: null, mixed: false }, usesRelativeMotion: false }, null),
            /declares no coordinate frame/);
    }],
    ['power 0 on the Ray: M5 first, G0 relative steps with settle comments only - no M3/M4 anywhere', () => {
        const plan = rayFrame();
        assert.equal(plan.gcodeForm, 'relative-steps');
        assert.equal(plan.power.line, null);
        assert.equal(plan.steps.length, 5, 'approach + four sides');
        assert.equal(plan.steps[0].gcode.split('\n')[0], 'M5');
        for (const step of plan.steps) {
            assert.equal(step.laser, 'off');
            const lines = executable(step.gcode);
            assert.ok(lines.every((l) => !/^M[34]\b/.test(l)), step.gcode);
            assert.ok(lines.filter((l) => /^G[01]\b/.test(l)).every((l) => l.startsWith('G0 ')), `G0 only: ${step.gcode}`);
            assert.ok(!/G53|G54|Z/.test(lines.join('\n')), 'no frame words, no Z on the Ray');
            assert.deepEqual(parseSettleComment(step.gcode), step.to, `${step.what} settles at its endpoint`);
        }
        assert.equal(plan.steps[1].gcode, '; mcp-settle machine X150.000 Y100.000\nG91\nG0 X50.000 Y0.000 F1500\nG90');
        assert.match(oneLine(plan.header), /G0 is laser-off by definition on the Snapmaker Ray .* "G0 \(laser off, max rate\)"/);
        assert.match(plan.reviewText, /never auto-executed/);
        assert.equal(plan.reviewText.split(STEP_SEPARATOR).length, 5);
    }],
    ['the approach is skipped when the head is already at the first corner (M5 then leads the first side)', () => {
        const plan = rayFrame({ current: { x: 100.02, y: 100, z: null } });
        assert.equal(plan.steps.length, 4);
        assert.equal(plan.steps[0].what, 'bottom side');
        assert.equal(plan.steps[0].gcode.split('\n')[0], 'M5');
    }],
    ['power > 0 on the Ray: M3 S on the 0-1000 scale (2 % = S20), every side M3 .. M5, the approach dark', () => {
        assert.equal(laserPowerWords(RAY, 2).line, 'M3 S20');
        assert.equal(laserPowerWords(RAY, 5).line, 'M3 S50');
        const plan = rayFrame({ powerPercent: 2 });
        assert.equal(plan.power.line, 'M3 S20');
        assert.deepEqual(plan.clipped, []);
        assert.deepEqual(executable(plan.steps[0].gcode), ['M5', 'G91', 'G0 X90.000 Y90.000 F1500', 'G90']);
        for (const step of plan.steps.slice(1)) {
            const lines = executable(step.gcode);
            assert.equal(lines[0], 'M3 S20');
            assert.equal(lines[lines.length - 1], 'M5', 'the laser is off before the step boundary');
            assert.ok(lines.some((l) => l.startsWith('G1 ')));
        }
    }],
    ['the 2.0 / Artisan / Original write the Marlin P/S form: P percent, S = floor(P * 255 / 100)', () => {
        assert.equal(laserPowerWords(SM2, 2).line, 'M3 P2 S5');
        assert.equal(laserPowerWords(SM2, 5).line, 'M3 P5 S12');
        assert.equal(laserPowerWords(ARTISAN, 5).line, 'M3 P5 S12');
        assert.equal(laserPowerWords(ORIGINAL, 2.5).line, 'M3 P2.5 S6');
        assert.throws(() => laserPowerWords(J1, 2), /no laser words/);
    }],
    ['power above 5 % is clamped to the cap and the clip REPORTED in the result and on the page', () => {
        assert.deepEqual(LASER_FRAME_POWER_PERCENT, { default: 0, min: 0, max: 5 });
        const plan = rayFrame({ powerPercent: 40, repeat: 9 });
        assert.equal(plan.power.line, 'M3 S50');
        assert.equal(plan.repeat, 4);
        assert.deepEqual(plan.clipped.map((c) => [c.argument, c.requested, c.value]), [['power_percent', 40, 5], ['repeat', 9, 4]]);
        assert.match(plan.reviewText, /; CLIPPED: power_percent requested 40 -> 5 \(LASER_FRAME_POWER_PERCENT \{min 0, max 5\}/);
        assert.equal(plan.steps.length, 17, 'approach + 4 passes x 4 sides');
        const negative = rayFrame({ powerPercent: -3 });
        assert.equal(negative.power.line, null, 'a negative power clamps to 0 = laser off');
        assert.equal(negative.clipped[0].argument, 'power_percent');
    }],
    ['the A350 frame is the sm2 machine-frame form with settle lines, at the current Z, landmarks checked', () => {
        const plan = a350Frame({ powerPercent: 2 });
        assert.equal(plan.gcodeForm, 'sm2');
        assert.equal(plan.runZ, 150);
        assert.deepEqual(executable(plan.steps[0].gcode), ['M5', 'G90', 'G53;', 'G0 X100.000 Y100.000 F1500;', 'G54;']);
        assert.deepEqual(executable(plan.steps[1].gcode), ['M3 P2 S5', 'G90', 'G53;', 'G1 X150.000 Y100.000 F1500;', 'G54;', 'M5']);
        for (const step of plan.steps) {
            assert.deepEqual(parseSettleComment(step.gcode), step.to, `${step.what}: the G0 form settles through its comment`);
            assert.ok(!/Z/.test(executable(step.gcode).join('\n')), 'Z is never written');
        }
        assert.match(plan.reviewText, /runs at the current machine Z 150\.000 \(the focus height\)/);
        assert.throws(() => a350Frame({ current: { x: 0, y: 0, z: null } }), /Current machine Z unknown/);
        const landmark = { name: 'rotary-axis', machine: { x0: 120, y0: 0, x1: 130, y1: 350 }, clearanceZ: 250, mode: 'crossing' as const };
        assert.throws(() => a350Frame({ obstacles: [landmark] }), /crosses a landmark below its clearance/);
    }],
    ['the Original takes relative steps that end in the planner sync, M5 before it on a powered side', () => {
        const plan = planLaserFrame({
            dialect: ORIGINAL,
            hasZ: true,
            current: { x: 0, y: 0, z: 50 },
            box: boxFromCorners(20, 20, 60, 60),
            boxSource: 'arguments',
            travel: { xMin: 0, xMax: 125, yMin: 0, yMax: 125 },
            powerPercent: 1,
            reason: 'frame',
        });
        assert.deepEqual(executable(plan.steps[1].gcode), ['M3 P1 S2', 'G91', 'G1 X40.000 Y0.000 F1500', 'G90', 'M5', 'G4 P0']);
        assert.deepEqual(executable(plan.steps[0].gcode), ['M5', 'G91', 'G0 X20.000 Y20.000 F1500', 'G90', 'G4 P0']);
        const dark = planLaserFrame({
            dialect: ORIGINAL,
            hasZ: true,
            current: { x: 0, y: 0, z: 50 },
            box: boxFromCorners(20, 20, 60, 60),
            boxSource: 'a',
            travel: { xMin: 0, xMax: 125, yMin: 0, yMax: 125 },
            reason: 'r',
        });
        assert.match(oneLine(dark.header), /no reference saying G0 alone keeps the Snapmaker Original .* laser dark: the M5 does/);
    }],
    ['a corner or the start outside the travel is refused, naming the point', () => {
        assert.throws(() => rayFrame({ box: boxFromCorners(560, 100, 620, 150) }),
            /frame corner \(xMax, yMin\) \(machine 620\.000, 100\.000\) is outside the toolhead travel/);
        assert.throws(() => rayFrame({ current: { x: -5, y: 10, z: null } }), /the current position .* is outside the toolhead travel/);
        assert.throws(() => planLaserFrame({
            dialect: J1, hasZ: true, current: { x: 0, y: 0, z: 0 }, box: boxFromCorners(1, 1, 2, 2), boxSource: 'a', travel: RAY_TRAVEL, reason: 'r',
        }), /no laser words/);
    }],
    ['air assist is M8 / M9 from the row on the Ray, the 2.0 (20 W / 40 W) and the Artisan, refused on the Original and the J1', () => {
        assert.equal(planAirAssist(RAY, NO_HEAD, true, 'r').gcode, 'M8');
        assert.equal(planAirAssist(RAY, NO_HEAD, false, 'r').gcode, 'M9');
        assert.equal(planAirAssist(SM2, LASER_20W, true, 'r').gcode, 'M8');
        assert.equal(planAirAssist(SM2, { headType: 'laser', toolHead: '40W Laser Module' }, false, 'r').gcode, 'M9');
        assert.equal(planAirAssist(ARTISAN, { headType: 'laser', toolHead: null }, true, 'r').gcode, 'M8');
        assert.throws(() => planAirAssist(ORIGINAL, NO_HEAD, true, 'r'), /Snapmaker Original .* has no air-assist words/);
        assert.throws(() => planAirAssist(J1, NO_HEAD, true, 'r'), /Snapmaker J1 .* has no air-assist words/);
    }],
    ['air assist on a 2.0: refused for a CNC head or the 1.6 W / 10 W laser, staged with a note when the head is not knowable', () => {
        assert.throws(() => planAirAssist(SM2, { headType: 'cnc', toolHead: 'standardCNCToolheadForSM2' }, true, 'r'), /not a laser module/);
        assert.throws(() => planAirAssist(SM2, { headType: 'laser', toolHead: 'levelTwoLaserToolheadForSM2' }, true, 'r'),
            /20 W \/ 40 W laser modules only .* levelTwoLaserToolheadForSM2/);
        const unknown = planAirAssist(SM2, NO_HEAD, true, 'r');
        assert.match(unknown.headNote, /NOT KNOWABLE over this connection/);
        assert.match(unknown.reviewText, /NOT KNOWABLE/);
        const laserOnly = planAirAssist(SM2, { headType: 'laser', toolHead: null }, true, 'r');
        assert.match(laserOnly.headNote, /which module is not reported/);
    }],
    ['the crosshair line per dialect: Ray / Artisan M2000 L13, 2.0 M2002 T3; refused on the Original and the J1', () => {
        assert.equal(planCrosshair(RAY, NO_HEAD, true, 'r').gcode, 'M2000 L13 P1');
        assert.equal(planCrosshair(RAY, NO_HEAD, false, 'r').gcode, 'M2000 L13 P0');
        assert.equal(planCrosshair(SM2, LASER_20W, true, 'r').gcode, 'M2002 T3 P1');
        assert.equal(planCrosshair(ARTISAN, NO_HEAD, false, 'r').gcode, 'M2000 L13 P0');
        assert.throws(() => planCrosshair(ORIGINAL, NO_HEAD, true, 'r'), /has no crosshair line/);
        assert.throws(() => planCrosshair(J1, NO_HEAD, true, 'r'), /has no crosshair line/);
        assert.throws(() => planCrosshair(SM2, { headType: 'printing', toolHead: null }, true, 'r'), /not a laser module/);
    }],
    ['the validator accepts every staged body on the machine it was written for (staged phase, frame resolution)', () => {
        const frames: Array<[GcodeDialect, LaserFramePlan, boolean]> = [
            [RAY, rayFrame(), true],
            [RAY, rayFrame({ powerPercent: 5 }), true],
            [SM2, a350Frame(), false],
            [SM2, a350Frame({ powerPercent: 5 }), false],
            [ARTISAN, a350Frame({ dialect: ARTISAN, powerPercent: 2 }), false],
        ];
        const original = planLaserFrame({
            dialect: ORIGINAL,
            hasZ: true,
            current: { x: 0, y: 0, z: 50 },
            box: boxFromCorners(20, 20, 60, 60),
            boxSource: 'a',
            travel: { xMin: 0, xMax: 125, yMin: 0, yMax: 125 },
            powerPercent: 2,
            reason: 'r',
        });
        frames.push([ORIGINAL, original, true]);
        for (const [dialect, plan, relative] of frames) {
            for (const headType of [null, 'laser']) {
                assertStagedAccepted(dialect, plan.reviewText, relative, headType, `${dialect.id} frame ${plan.power.line} head ${headType}`);
                plan.steps.forEach((step, i) => assertStagedAccepted(dialect, step.gcode, relative, headType, `${dialect.id} step ${i + 1}`));
            }
            const report = validateGcode(plan.reviewText, { dialect, phase: 'staged', hasZ: MACHINE_OF[dialect.id].hasZ });
            assert.equal(report.spindle.onAtEnd, false, `${dialect.id}: the body never ends with the laser on`);
        }
        for (const dialect of [RAY, SM2, ARTISAN]) {
            for (const on of [true, false]) {
                assertStagedAccepted(dialect, planAirAssist(dialect, LASER_20W, on, 'r').reviewText, dialect.transportForm === 'relative-steps',
                    null, `${dialect.id} air ${on}`);
                assertStagedAccepted(dialect, planCrosshair(dialect, LASER_20W, on, 'r').reviewText, dialect.transportForm === 'relative-steps',
                    null, `${dialect.id} crosshair ${on}`);
            }
        }
    }],
    ['the laser tools are gated on the laser capability: the Ray, the 2.0, the Artisan and the Original pass; the J1 is refused', () => {
        const machine = (identifier: string, size: [number, number, number], heads: string[]): MachineCapability => deriveMachineCapability({
            identifier, machineType: 'x', metadata: { size: { x: size[0], y: size[1], z: size[2] }, toolHeads: heads.map((id) => ({ identifier: id })) },
        });
        const passing = [
            machine('Ray', [600, 400, 0], ['20W Laser Module', '40W Laser Module', '2W Laser Module']),
            machine('Snapmaker 2.0 A350', [320, 350, 325], ['20W Laser Module', 'standardCNCToolheadForSM2']),
            machine('A400', [400, 400, 400], ['40W Laser Module', 'levelTwoCNCToolheadForSM2']),
            machine('Original', [125, 125, 125], ['levelOneLaserToolheadForOriginal', 'standardCNCToolheadForOriginal']),
        ];
        const j1 = machine('Snapmaker J1', [324, 200, 200], ['Snapmaker J1 IDEX Tool Head']);
        for (const tool of Object.keys(LASER_GATES)) {
            for (const capability of passing) {
                assert.equal(procedureRefusal(capability, tool), null, `${capability.identifier} ${tool}`);
            }
            const refusal = procedureRefusal(j1, tool) || '';
            assert.ok(refusal.startsWith(tool), refusal);
            assert.match(refusal, /needs laser control, .* Snapmaker J1/);
            assert.match(refusal, /This refusal is deliberate: .* the laser tools write each machine's own laser words/);
            assert.doesNotMatch(refusal, /refuses rather than translates/);
            assert.match(procedureRefusal(deriveMachineCapability(null, null), tool) || '', /no machine is connected/);
        }
    }],
    ['laser_focus is refused: no Z on the Ray (focus is mechanical), deferred everywhere else', () => {
        assert.match(laserFocusRefusal(RAY, false, 'Ray'), /^Refusing laser_focus: the Ray has no Z axis: set focus mechanically on the module/);
        assert.match(laserFocusRefusal(SM2, true, 'Snapmaker 2.0 A350'), /^Refusing laser_focus on the Snapmaker 2\.0 A350: deferred/);
        assert.match(laserFocusRefusal(ORIGINAL, true, 'Original'), /Nothing was sent\.$/);
    }],
];
