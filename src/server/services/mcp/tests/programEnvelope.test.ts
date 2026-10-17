import { strict as assert } from 'assert';

import { COARSE_FEED, DESCENT_GUARD_MM, DESCENT_SEGMENT_MM, TRAVEL_FEED } from '../procedureLimits';
import {
    ProgramEnvelope,
    describeCaptureOp,
    describeHomeOp,
    describeProbeProgramAsGcode,
    describeRotateOp,
    unwrapFrameBlock,
} from '../programEnvelope';
import { FrameResolutionContext, resolveJobFrame, validateGcode } from '../validator';

// Staging context of a connected A350 with the work origin at the bed top.
const A350: FrameResolutionContext = { frameArgument: null, originOffsetZ: -328, offsetReliable: true, machineZMax: 330 };
const HOP_Z = 328;
const AT_HOME = { x: -19, y: 342, z: 328, b: 0 };

function program(over: Partial<ProgramEnvelope> = {}): ProgramEnvelope {
    return {
        name: 'look',
        ops: [],
        hopZ: HOP_Z,
        staged: AT_HOME,
        previews: [],
        rotations: [],
        seeds: {},
        keepOut: [],
        groups: [],
        eventBudget: 110,
        homesAtEnd: false,
        captures: [],
        ...over,
    };
}

// Job 96baca79b3b8 (2026-09-21): ONE capture op viewing from machine (190, 140).
const NO_DESCENT = { descent_segment_mm: DESCENT_SEGMENT_MM.default, descent_segment_requested_mm: null };
const VIEW = { settle_ms: 500, label: null, view: { x: 190, y: 140 }, z: null, ...NO_DESCENT };
// Issue #177: the same view, framed from a stated toolhead machine Z (a measured top + 7).
const VIEW_AT_Z = { settle_ms: 500, label: 'pocket wall', view: { x: 190, y: 140 }, z: 215, ...NO_DESCENT };
function captureOnlyProgram(): ProgramEnvelope {
    return program({
        ops: [{ id: 'look', kind: 'capture', on_fail: 'stop', args: { x: 190, y: 140, settle_ms: 500, label: null } }],
        previews: [{ id: 'look', text: describeCaptureOp(VIEW, HOP_Z) }],
        captures: ['look'],
    });
}

// What describeProbeSequencePlanAsGcode emits for a one-hop circuit, wrapper included.
const SEQUENCE_PREVIEW = [
    '; PROBE SEQUENCE: one approved circuit of 1 steps (0 sensor-gated marches)',
    'G90',
    'G53;',
    'G1 Z328.000 F600; raise to traverse height (law 2)',
    'G1 X100.000 Y200.000 F600; hop',
    'G54;',
].join('\n');

export const tests: Array<[string, () => void]> = [
    ['job 96baca79b3b8: a capture-only program renders its XY hop and the table sees it', () => {
        const body = describeProbeProgramAsGcode(captureOnlyProgram());
        const report = validateGcode(body);
        assert.ok(body.includes(`G1 X190.000 Y140.000 F${TRAVEL_FEED}`), body);
        assert.deepEqual(report.extents.x, { min: 190, max: 190 }, 'X extents come from the hop');
        assert.deepEqual(report.extents.y, { min: 140, max: 140 }, 'Y extents come from the hop');
        assert.deepEqual(report.extents.z, { min: 328, max: 328 });
        assert.equal(report.motionLineCount, 3, 'raise, hop, closing raise');
        assert.deepEqual(report.feedRates, { min: TRAVEL_FEED, max: TRAVEL_FEED });
    }],

    ['the same program declares MACHINE once, hands the frame back, and states its distance mode', () => {
        const body = describeProbeProgramAsGcode(captureOnlyProgram());
        const report = validateGcode(body);
        assert.equal(report.frame.declared, 'machine');
        assert.equal(report.frame.source, 'gcode');
        assert.equal(report.frame.endsInFrame, 'work', 'ends G54; like every MCP emitter');
        assert.equal(report.frame.mixed, false);
        assert.equal(report.assumesDistanceMode, false, 'G90 precedes the first move');
        assert.deepEqual(report.frame.inlineG53Lines, []);
        assert.ok(!report.warnings.some((w) => w.includes('before any G90')), report.warnings.join('\n'));
        const resolved = resolveJobFrame(report, A350);
        assert.equal(resolved.refusal, null);
        assert.deepEqual(resolved.report.machineZExtents, { min: 328, max: 328 }, 'Z extents, MACHINE resolve');
    }],

    ['the page header says the lines are the runner\'s commands, and counts the capture that moves', () => {
        const body = describeProbeProgramAsGcode(captureOnlyProgram());
        assert.ok(body.includes('EVERY MOTION LINE BELOW IS A MOVE THE SERVER\'S RUNNER WILL COMMAND'), body);
        assert.ok(body.includes('NOT'), 'says it is not streamed');
        assert.ok(body.includes('1 of them FIRST hop to a viewing position at Z328'), body);
        assert.ok(!body.includes('(no motion)'), 'a viewing capture is not "no motion"');
    }],

    ['issue #177: a capture at a stated Z renders the column as the moves the runner sends, the frame, and the straight raise back', () => {
        const text = describeCaptureOp(VIEW_AT_Z, HOP_Z);
        const motion = text.split('\n').filter((l) => /^G[01]\b/.test(l)).map((l) => l.split(';')[0].trim());
        assert.equal(motion[0], `G1 Z328.000 F${TRAVEL_FEED}`, 'raise first');
        assert.equal(motion[1], `G1 X190.000 Y140.000 F${TRAVEL_FEED}`, 'then the hop');
        assert.equal(motion[2], `G1 Z${(215 + DESCENT_GUARD_MM).toFixed(3)} F${TRAVEL_FEED}`, 'fast segments to the guard band');
        const guarded = motion.slice(3, -1);
        assert.equal(guarded.length, DESCENT_GUARD_MM, 'one sensor-checked step per mm of the guard band');
        assert.equal(guarded[0], `G1 Z234.000 F${COARSE_FEED}`);
        assert.equal(guarded[guarded.length - 1], `G1 Z215.000 F${COARSE_FEED}`, 'the last step lands on the stated Z');
        assert.equal(motion[motion.length - 1], `G1 Z328.000 F${TRAVEL_FEED}`, 'raise STRAIGHT back to the traverse height');
        assert.ok(text.includes('STATED toolhead machine Z215'), text);
        assert.ok(text.includes('ANY contact during the descent aborts'), text);
        assert.ok(text.includes('stamped with the machine position (Z215)'), text);
        assert.ok(text.includes(`<= ${DESCENT_SEGMENT_MM.default} mm segments`), 'the page states the segment length');
        // Issue #166: a shorter segment is stated on the page; a request above the cap is clamped AND reported.
        const gentle = describeCaptureOp({ ...VIEW_AT_Z, descent_segment_mm: 2, descent_segment_requested_mm: null }, HOP_Z);
        assert.ok(gentle.includes('<= 2 mm segments'), gentle);
        assert.ok(!gentle.includes('CLAMPED'), 'nothing was clipped');
        const clipped = describeCaptureOp({ ...VIEW_AT_Z, descent_segment_mm: 5, descent_segment_requested_mm: 12 }, HOP_Z);
        assert.ok(clipped.includes('; CLAMPED: descent_segment_mm 12 is outside 1-5 - this descent uses 5 mm segments'), clipped);
        // Whole program: the Z extents reach the stated Z and the header counts the descent.
        const body = describeProbeProgramAsGcode(program({
            ops: [{ id: 'low', kind: 'capture', on_fail: 'stop', args: { x: 190, y: 140, z: 215, settle_ms: 500, label: 'pocket wall' } }],
            previews: [{ id: 'low', text }],
            captures: ['low'],
        }));
        const report = validateGcode(body);
        assert.deepEqual(report.extents.z, { min: 215, max: 328 });
        assert.deepEqual(report.feedRates, { min: COARSE_FEED, max: TRAVEL_FEED });
        assert.equal(report.frame.declared, 'machine');
        assert.equal(report.frame.mixed, false);
        assert.ok(body.includes('1 of them FIRST hop to a viewing position at Z328'), body);
        assert.ok(body.includes('1 of them DESCEND to a stated Z for the frame'), body);
        // Without a view the column stands where the previous op left the head.
        const columnOnly = describeCaptureOp({ ...VIEW_AT_Z, view: null }, HOP_Z);
        assert.ok(columnOnly.includes('from the XY where the previous op left the head'), columnOnly);
        assert.ok(!columnOnly.includes('X190.000'), 'no hop');
        assert.ok(!columnOnly.includes('NO MOTION'), 'a descent is motion');
    }],

    ['a capture with no viewing position moves nothing: only the closing raise is motion', () => {
        const body = describeProbeProgramAsGcode(program({
            ops: [{ id: 'snap', kind: 'capture', on_fail: 'stop', args: { x: null, y: null, settle_ms: 500, label: 'after turn' } }],
            previews: [{ id: 'snap', text: describeCaptureOp({ settle_ms: 500, label: 'after turn', view: null, z: null, ...NO_DESCENT }, HOP_Z) }],
            captures: ['snap'],
        }));
        const report = validateGcode(body);
        assert.equal(report.motionLineCount, 1);
        assert.equal(report.extents.x, null);
        assert.equal(report.extents.y, null);
        assert.ok(body.includes('NO MOTION'), body);
        assert.ok(body.includes('none of them moves the head'), body);
        assert.equal(report.frame.declared, 'machine');
    }],

    ['an embedded sub-plan keeps its moves, loses its wrapper: ONE G53 and no mixed-frame warning', () => {
        const body = describeProbeProgramAsGcode(program({
            ops: [
                { id: 'find', kind: 'sequence', on_fail: 'stop', args: {} },
                { id: 'look', kind: 'capture', on_fail: 'stop', args: { x: 190, y: 140, settle_ms: 500, label: null } },
            ],
            previews: [{ id: 'find', text: SEQUENCE_PREVIEW }, { id: 'look', text: describeCaptureOp(VIEW, HOP_Z) }],
            captures: ['look'],
        }));
        const report = validateGcode(body);
        assert.equal(body.split('\n').filter((l) => /^G53;?$/.test(l.trim())).length, 1, body);
        assert.equal(body.split('\n').filter((l) => /^G54;?$/.test(l.trim())).length, 1, body);
        assert.equal(body.split('\n').filter((l) => /^G90$/.test(l.trim())).length, 1, body);
        assert.deepEqual(report.extents.x, { min: 100, max: 190 });
        assert.deepEqual(report.extents.y, { min: 140, max: 200 });
        assert.equal(report.frame.mixed, false, 'the closing raise is not motion under the work frame');
        assert.ok(!report.warnings.some((w) => w.includes('BOTH frames')), report.warnings.join('\n'));
        assert.ok(body.includes('G1 X100.000 Y200.000 F600; hop'), 'the sub-plan\'s own moves survive');
        assert.ok(body.includes('; PROBE SEQUENCE: one approved circuit'), 'its comments survive');
    }],

    ['unwrapFrameBlock strips only whole-line declarations', () => {
        assert.equal(unwrapFrameBlock('G90\nG53;\nG1 X1 Y2 F600; hop\n; G53 is mentioned here\ng54\nG54 ;\nG0 B90'), 'G1 X1 Y2 F600; hop\n; G53 is mentioned here\nG0 B90');
    }],

    ['a rotation renders the B move the runner sends, so the B extents column fills', () => {
        const body = describeProbeProgramAsGcode(program({
            ops: [{ id: 'turn', kind: 'rotate_b', on_fail: 'stop', args: { b: 90 } }],
            previews: [{ id: 'turn', text: describeRotateOp({ b: 90, requireZ: 328, fromB: 0, rotateFeed: 600, swept: null }) }],
            rotations: [90],
        }));
        const report = validateGcode(body);
        assert.deepEqual(report.extents.b, { min: 90, max: 90 });
        assert.equal(report.fourAxis, true);
        assert.equal(report.frame.declared, 'machine');
        assert.equal(report.frame.mixed, false);
        assert.ok(body.includes('9 s from B0'), body);
    }],

    ['a closing home emits G28, which the summariser reports beside the extents', () => {
        const body = describeProbeProgramAsGcode(program({
            ops: [
                { id: 'turn', kind: 'rotate_b', on_fail: 'stop', args: { b: 90 } },
                { id: 'park', kind: 'home', on_fail: 'stop', args: {} },
            ],
            previews: [
                { id: 'turn', text: describeRotateOp({ b: 90, requireZ: 328, fromB: 0, rotateFeed: 600, swept: null }) },
                { id: 'park', text: describeHomeOp(90) },
            ],
            rotations: [90],
            homesAtEnd: true,
        }));
        const report = validateGcode(body);
        assert.equal(report.usesHoming, true);
        assert.ok(report.warnings.some((w) => w.includes('G28')), report.warnings.join('\n'));
        assert.ok(body.includes('from the B 90 the program left it at'), body);
        assert.ok(body.includes('a completed program is already at home'), body);
        assert.equal(resolveJobFrame(report, A350).refusal, null);
    }],

    ['the capture block is what moveMachineSettled sends: G1 at the travel feed, raise before hop', () => {
        const text = describeCaptureOp(VIEW, HOP_Z);
        const motion = text.split('\n').filter((l) => /^G[01]\b/.test(l));
        assert.deepEqual(motion.map((l) => l.split(';')[0].trim()), [
            `G1 Z328.000 F${TRAVEL_FEED}`,
            `G1 X190.000 Y140.000 F${TRAVEL_FEED}`,
        ]);
    }],
];
