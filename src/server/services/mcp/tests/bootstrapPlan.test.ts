import { strict as assert } from 'assert';

import { ObstacleBox } from '../envelopeChecks';
import { MAX_SWEEP_STOPS, planPoseSweep, planSearchGrid, sweepStops } from '../bootstrapPlan';

// The rotary as it would be stated physically: top at 250, so with a 73 mm
// probe fitted the toolhead needs 328 to cross it.
const ROTARY: ObstacleBox = {
    name: 'rotary-axis',
    machine: { x0: 140, y0: 0, x1: 200, y1: 350 },
    clearanceZ: 250,
    clearanceBasis: 'physical',
    mode: 'crossing',
};

function sweep(over: Partial<Parameters<typeof planPoseSweep>[0]> = {}) {
    return planPoseSweep({
        poses: [{ label: 'tool-setter', x: 280, y: 150 }],
        parkZ: 328,
        floorZ: 320,
        stepMm: 2,
        obstacles: [],
        toolProtrusionMm: 2,
        fromMachine: { x: -19, y: 342, z: 328 },
        ...over,
    });
}

export const tests: Array<[string, () => void]> = [
    // D5: the sweep is a parallax baseline, so it has to be vertical.
    ['the sweep runs from the park height down to the floor, highest first', () => {
        assert.deepEqual(sweepStops(328, 320, 2), [328, 326, 324, 322, 320]);
        assert.deepEqual(sweepStops(328, 320, 8), [328, 320], 'the floor is always included');
        assert.deepEqual(sweepStops(328, 328, 2), [328], 'no band, one stop');
        assert.deepEqual(sweepStops(328, 320, 0.01), [328, 327, 326, 325, 324, 323, 322, 321, 320],
            'a step below a millimetre is clamped to one - finer than that is not a baseline, it is a queue');
        assert.equal(sweepStops(328, 200, 1).length, MAX_SWEEP_STOPS, 'and the number of stops is capped');
    }],

    ['every descent keeps XY fixed, and every traverse happens at the park height', () => {
        const plan = sweep({ poses: [{ label: 'a', x: 280, y: 150 }, { label: 'b', x: 60, y: 90 }] });
        for (const segment of plan.segments) {
            if (segment.kind === 'column') {
                assert.equal(segment.from.x, segment.to.x, 'a sweep never moves in XY');
                assert.equal(segment.from.y, segment.to.y);
            } else {
                assert.equal(segment.from.z, 328, 'transport at the park height');
                assert.equal(segment.to.z, 328);
            }
        }
    }],

    ['the head is back at the park height before the next pose', () => {
        const plan = sweep({ poses: [{ label: 'a', x: 280, y: 150 }, { label: 'b', x: 60, y: 90 }] });
        const traverses = plan.segments.filter((s) => s.kind === 'hop');
        assert.equal(traverses.length, 2);
        assert.deepEqual(traverses[1].from, { x: 280, y: 150, z: 328 },
            'the second traverse starts from the first pose, at the park height - not from wherever the sweep ended');
    }],

    ['a capture at every stop of every pose', () => {
        const plan = sweep({ poses: [{ label: 'a', x: 280, y: 150 }, { label: 'b', x: 60, y: 90 }] });
        assert.equal(plan.captureCount, 10, '5 stops x 2 poses');
        assert.equal(plan.poses.length, 2);
        assert.deepEqual(plan.dropped, []);
    }],

    // The camera looks INTO keep-outs on purpose; the toolhead does not enter them.
    ['a pose the toolhead cannot reach at all is dropped with a reason, never adjusted', () => {
        // Top 260 + a 73 mm probe + 5 mm margin = 338, above the park height:
        // there is no height at which the toolhead may be over this box.
        const TALL = { ...ROTARY, clearanceZ: 260 };
        const plan = sweep({
            poses: [{ label: 'over-the-rotary', x: 170, y: 150 }],
            obstacles: [TALL],
            toolProtrusionMm: 73,
        });
        assert.equal(plan.poses.length, 0);
        assert.equal(plan.dropped.length, 1);
        assert.ok(/cannot reach this pose/.test(plan.dropped[0].reason));
        assert.ok(/dropped rather than adjusted/.test(plan.dropped[0].reason));
    }],

    ['a pose over a box the toolhead DOES clear at the park height is kept, but may not descend into it', () => {
        // The same box with the probe: 250 + 73 + 5 = 328, exactly the park
        // height. The camera looks into the keep-out; the toolhead is above it.
        // The descent is judged as if the box were a volume: the 'crossing'
        // exemption is for probing inside a footprint, not for sightseeing.
        const plan = sweep({
            poses: [{ label: 'over-the-rotary', x: 170, y: 150 }],
            obstacles: [ROTARY],
            toolProtrusionMm: 73,
        });
        assert.equal(plan.dropped.length, 0);
        assert.deepEqual(plan.poses[0].stops.map((s) => s.z), [328], 'but it may not descend a millimetre');
        assert.ok(/the sweep stops at Z 328/.test(plan.poses[0].restriction as string));
    }],

    ['a pose whose descent is blocked keeps the stops above it and says where it stopped', () => {
        // A box beside the setter: the traverse to the pose clears it, but the
        // column down does not once it drops below what the tool needs.
        const LOW: ObstacleBox = {
            name: 'clamp',
            machine: { x0: 270, y0: 140, x1: 300, y1: 160 },
            clearanceZ: 320,
            clearanceBasis: 'physical',
            mode: 'crossing',
        };
        const plan = sweep({ poses: [{ label: 'tool-setter', x: 280, y: 150 }], obstacles: [LOW], toolProtrusionMm: 2 });
        // required toolhead Z = 320 + 2 + 5 = 327, so only the 328 stop clears.
        assert.equal(plan.poses.length, 1);
        assert.deepEqual(plan.poses[0].stops.map((s) => s.z), [328]);
        assert.ok(/the sweep stops at Z 328/.test(plan.poses[0].restriction as string), plan.poses[0].restriction as string);
        assert.ok(/still a view/.test(plan.poses[0].restriction as string));
    }],

    // Stage 0 needs no calibration to be meaningful, which is why it is first.
    ['the search grid covers both edges and serpentines', () => {
        const grid = planSearchGrid({ xMin: 100, xMax: 300, yMin: 150, yMax: 150, pitchMm: 50 });
        assert.deepEqual(grid.map((p) => p.x), [100, 150, 200, 250, 300]);
        assert.ok(grid.every((p) => p.y === 150));

        const twoRows = planSearchGrid({ xMin: 0, xMax: 100, yMin: 0, yMax: 100, pitchMm: 100 });
        assert.deepEqual(twoRows, [
            { x: 0, y: 0 }, { x: 100, y: 0 },
            { x: 100, y: 100 }, { x: 0, y: 100 },
        ], 'the second row runs back the other way');
    }],

    ['holdout identity survives obstacle-aware pose planning', () => {
        const plan = sweep({ poses: [{ label: 'independent', x: 280, y: 150, holdout: true }] });
        assert.equal(plan.poses[0].holdout, true);
        assert.ok(plan.poses[0].stops.length > 1);
    }],

    ['the grid divides evenly rather than leaving a stub at the far edge', () => {
        const grid = planSearchGrid({ xMin: 0, xMax: 250, yMin: 0, yMax: 0, pitchMm: 80 });
        const xs = grid.map((p) => p.x);
        assert.deepEqual(xs, [0, 62.5, 125, 187.5, 250]);
    }],
];
