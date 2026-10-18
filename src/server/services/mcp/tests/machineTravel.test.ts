import { strict as assert } from 'assert';

import { DEFAULT_TRAVEL_FUDGE_MM, clampBand, clampRay, describeClipping, describeTravel, modelTravel, outsideTravel, resolveTravel } from '../machineTravel';
import type { ResolvedTravel, TravelInput } from '../machineTravel';

// The two machines as their definitions describe them, and as they actually
// are: the A350's frame runs X -19...339 / Y 0...342 against 320 x 350; the
// Ray homes to about X-1 / Y399 against 600 x 400. The default fudge covers
// both homes and still refuses the absurd.
const A350 = { x: 320, y: 350 };
const RAY = { x: 600, y: 400 };
const FUDGE = { x: DEFAULT_TRAVEL_FUDGE_MM, y: DEFAULT_TRAVEL_FUDGE_MM };
const NOTHING_STATED = { xMin: null, xMax: null, yMin: null, yMax: null };
const A350_HOME = { x: -19, y: 342 };
const RAY_HOME = { x: -1, y: 399 };

function travelFor(input: TravelInput): ResolvedTravel {
    const travel = resolveTravel(input);
    assert.ok(travel, 'travel should resolve');
    return travel;
}

export const tests: Array<[string, () => void]> = [
    ['the default fudge is 25 mm, and the model box is size +/- fudge at each end of each axis', () => {
        assert.equal(DEFAULT_TRAVEL_FUDGE_MM, 25);
        assert.deepEqual(modelTravel(A350, FUDGE), { xMin: -25, xMax: 345, yMin: -25, yMax: 375 });
        assert.deepEqual(modelTravel(RAY, FUDGE), { xMin: -25, xMax: 625, yMin: -25, yMax: 425 });
    }],

    ['with nothing stated the travel IS the model plus the fudge, from the model', () => {
        const travel = travelFor({ size: A350, fudge: FUDGE, stated: NOTHING_STATED, observed: null });
        assert.deepEqual(travel.limits, { xMin: -25, xMax: 345, yMin: -25, yMax: 375 });
        assert.equal(travel.ends.xMin.source, 'model');
        assert.deepEqual(travel.conflicts, []);
        assert.equal(describeTravel(travel, 'Snapmaker 2.0 A350'), 'Snapmaker 2.0 A350 model 320 x 350 + 25 mm fudge each end: X -25..345, Y -25..375');
    }],

    // The operator's acceptance cases (2026-10-18).
    ['the Ray home at about X-1 Y399 is inside the travel', () => {
        const travel = travelFor({ size: RAY, fudge: FUDGE, stated: NOTHING_STATED, observed: RAY_HOME });
        assert.equal(outsideTravel(RAY_HOME, travel.limits), null);
        assert.equal(outsideTravel({ x: 1, y: 399 }, travel.limits), null);
        assert.deepEqual(travel.conflicts, [], 'home is not a conflict');
    }],

    ['Ray X650 is rejected: 25 mm beyond the model + fudge maximum 625', () => {
        const travel = travelFor({ size: RAY, fudge: FUDGE, stated: NOTHING_STATED, observed: RAY_HOME });
        assert.equal(outsideTravel({ x: 650, y: 100 }, travel.limits), 'X 650 is 25 mm beyond the X maximum 625');
        assert.equal(outsideTravel({ x: 100, y: -30 }, travel.limits), 'Y -30 is 5 mm below the Y minimum -25');
    }],

    ['the A350\'s real X-19 home and X339 far end are inside the default fudge; Y342 too', () => {
        const travel = travelFor({ size: A350, fudge: FUDGE, stated: NOTHING_STATED, observed: A350_HOME });
        assert.equal(outsideTravel({ x: -19, y: 342 }, travel.limits), null);
        assert.equal(outsideTravel({ x: 339, y: 0 }, travel.limits), null);
        assert.deepEqual(travel.conflicts, []);
        // And the old -25 slop's first waypoint is now legal exactly at the edge, while -26 is not.
        assert.equal(outsideTravel({ x: -25, y: 100 }, travel.limits), null);
        assert.equal(outsideTravel({ x: -26, y: 100 }, travel.limits), 'X -26 is 1 mm below the X minimum -25');
    }],

    ['a smaller fudge shrinks the box; per-axis fudge applies per axis', () => {
        const travel = travelFor({ size: A350, fudge: { x: 20, y: 0 }, stated: NOTHING_STATED, observed: null });
        assert.deepEqual(travel.limits, { xMin: -20, xMax: 340, yMin: 0, yMax: 350 });
        assert.equal(describeTravel(travel, 'Snapmaker 2.0 A350'), 'Snapmaker 2.0 A350 model 320 x 350 + fudge X 20 / Y 0 mm each end: X -20..340, Y 0..350');
    }],

    // Stated travel is a TIGHTER override for the machine it was stated on, never looser.
    ['a stated end tighter than the model tightens it', () => {
        const travel = travelFor({ size: A350, fudge: FUDGE, stated: { xMin: -19, xMax: 339, yMin: 0, yMax: 342 }, observed: A350_HOME });
        assert.deepEqual(travel.limits, { xMin: -19, xMax: 339, yMin: 0, yMax: 342 });
        assert.equal(travel.ends.xMax.source, 'stated');
        assert.deepEqual(travel.conflicts, []);
        assert.match(describeTravel(travel, 'Snapmaker 2.0 A350'), /tightened by an operator statement/);
    }],

    ['a stated end LOOSER than the model is reported and the model governs', () => {
        const travel = travelFor({ size: A350, fudge: FUDGE, stated: { xMin: -40, xMax: null, yMin: null, yMax: null }, observed: null });
        assert.equal(travel.limits.xMin, -25, 'the model + fudge wins');
        assert.equal(travel.ends.xMin.source, 'model');
        assert.equal(travel.conflicts.length, 1);
        assert.match(travel.conflicts[0], /stated X minimum -40 is looser than the machine model plus fudge \(-25\)/);
        assert.match(travel.conflicts[0], /mcpTravelFudgeMm/);
    }],

    ['a statement equal to the model within float noise is not "looser"', () => {
        const travel = travelFor({ size: A350, fudge: FUDGE, stated: { xMin: -25.00001, xMax: null, yMin: null, yMax: null }, observed: null });
        assert.deepEqual(travel.conflicts, []);
        assert.equal(travel.ends.xMin.source, 'stated');
    }],

    // Observed positions: evidence that something is wrong, never a silent widening.
    ['a permitted 1 mm overtravel past an end is not a conflict; beyond it is', () => {
        // Operator rule 2026-10-05: the pendant jogged to Y -1 against a stated Y 0 minimum.
        const stated = { xMin: null, xMax: null, yMin: 0, yMax: null };
        const within = travelFor({ size: A350, fudge: FUDGE, stated, observed: { x: 100, y: -1 } });
        assert.deepEqual(within.conflicts, []);
        assert.equal(within.limits.yMin, 0, 'the stated end still governs planning');
        const beyondIt = travelFor({ size: A350, fudge: FUDGE, stated, observed: { x: 100, y: -1.2 } });
        assert.equal(beyondIt.conflicts.length, 1);
        assert.match(beyondIt.conflicts[0], /1 mm overtravel allowance/);
    }],

    ['an observation outside the model + fudge is a conflict, not a widening', () => {
        const travel = travelFor({ size: A350, fudge: FUDGE, stated: NOTHING_STATED, observed: { x: -30, y: 342 } });
        assert.equal(travel.limits.xMin, -25, 'the model still governs');
        assert.equal(travel.conflicts.length, 1);
        assert.match(travel.conflicts[0], /observed at X -30, outside the travel X -25..345/);
    }],

    // Live 2026-09-20: a machine homed to X-19 reports X-19.00000610351563.
    ['the heartbeat\'s float noise is not a conflict', () => {
        const travel = travelFor({
            size: A350,
            fudge: FUDGE,
            stated: { xMin: -19, xMax: 339, yMin: 0, yMax: 342 },
            observed: { x: -19.00000610351563, y: 342 },
        });
        assert.deepEqual(travel.conflicts, []);
        assert.equal(travel.limits.xMin, -19);
    }],

    ['an unknown machine with nothing stated has no honest travel at all', () => {
        assert.equal(resolveTravel({ size: null, fudge: FUDGE, stated: NOTHING_STATED, observed: A350_HOME }), null);
    }],

    ['an unknown machine with every end stated is planned from those', () => {
        const travel = travelFor({
            size: null,
            fudge: FUDGE,
            stated: { xMin: -19, xMax: 339, yMin: 0, yMax: 342 },
            observed: null,
        });
        assert.deepEqual(travel.limits, { xMin: -19, xMax: 339, yMin: 0, yMax: 342 });
        assert.equal(travel.model, null);
        assert.match(describeTravel(travel, null), /stated travel \(unknown machine\)/);
    }],

    // The bug this exists to stop: a symmetric reach around an off-centre
    // target, planned past the end of the machine.
    ['a reach that overruns the low end is clipped and says how much it lost', () => {
        const band = clampBand(79, 200, -19, 339);
        assert.equal(band.min, -19);
        assert.equal(band.max, 279);
        assert.equal(band.clippedLowMm, 102, '79 - 200 = -121, which is 102 mm below the travel');
        assert.equal(band.clippedHighMm, 0);
    }],

    ['a reach that fits loses nothing', () => {
        const band = clampBand(79, 98, -19, 339);
        assert.deepEqual([band.min, band.max, band.clippedLowMm, band.clippedHighMm], [-19, 177, 0, 0]);
    }],

    ['a reach that overruns BOTH ends is clipped at both', () => {
        const band = clampBand(160, 400, -19, 339);
        assert.equal(band.min, -19);
        assert.equal(band.max, 339);
        assert.equal(band.clippedLowMm, 221);
        assert.equal(band.clippedHighMm, 221);
    }],

    ['a target near the high edge clips the high side, not the low', () => {
        // The "nearer another edge" case: a setter at X330 on a 339 limit.
        const band = clampBand(330, 100, -19, 339);
        assert.equal(band.min, 230);
        assert.equal(band.max, 339);
        assert.equal(band.clippedLowMm, 0);
        assert.equal(band.clippedHighMm, 91);
    }],

    ['a zero span is a single line at the target, not an error', () => {
        const band = clampBand(293, 0, 0, 342);
        assert.deepEqual([band.min, band.max], [293, 293]);
    }],

    ['a target outside the travel collapses onto the nearest reachable point', () => {
        // Never a waypoint the toolhead cannot reach, whatever was asked for.
        const band = clampBand(400, 50, -19, 339);
        assert.equal(band.min, 339);
        assert.equal(band.max, 339);
    }],

    ['an inverted travel is a programming error, not a band', () => {
        assert.throws(() => clampBand(0, 10, 100, 50), /below its minimum/);
    }],

    ['clipping is described only when something was actually lost', () => {
        assert.equal(describeClipping('X', clampBand(79, 98, -19, 339)), null);
        const text = describeClipping('X', clampBand(79, 200, -19, 339));
        assert.ok(text);
        assert.match(text, /102 mm below X-19/);
        assert.match(text, /not planned/);
    }],

    ['a point inside the travel, or on its end within float noise, is not outside', () => {
        const limits = { xMin: -19, xMax: 339, yMin: 0, yMax: 342 };
        assert.equal(outsideTravel({ x: 100, y: 100 }, limits), null);
        // The heartbeat's own reading of home: six microns past the end is the end.
        assert.equal(outsideTravel({ x: -19.00000610351563, y: 342.0000001 }, limits), null);
    }],

    ['a point outside the travel says which end, and by how much', () => {
        const limits = { xMin: -19, xMax: 339, yMin: 0, yMax: 342 };
        // The old -25 slop's first waypoint, against the A350's real X minimum.
        assert.equal(outsideTravel({ x: -25, y: 100 }, limits), 'X -25 is 6 mm below the X minimum -19');
        assert.equal(outsideTravel({ x: 355, y: 350 }, limits),
            'X 355 is 16 mm beyond the X maximum 339 and Y 350 is 8 mm beyond the Y maximum 342');
    }],

    ['a march is shortened to the travel end it would run into, and says which', () => {
        const limits = { xMin: -19, xMax: 339, yMin: 0, yMax: 342 };
        // -X from X10 for 40 mm reaches X-30; the travel stops at X-19.
        const ray = clampRay({ x: 10, y: 100 }, { x: -1, y: 0 }, 40, limits);
        assert.deepEqual(ray, { travelMm: 29, clippedMm: 11, clippedBy: 'the X minimum -19' });
        // A diagonal is clamped as a scalar - the direction never changes.
        const diag = clampRay({ x: 330, y: 100 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 50, limits);
        assert.equal(diag.clippedBy, 'the X maximum 339');
        assert.ok(Math.abs(diag.travelMm - 9 * Math.SQRT2) < 1e-3);
    }],

    ['a march that fits is untouched', () => {
        const limits = { xMin: -19, xMax: 339, yMin: 0, yMax: 342 };
        assert.deepEqual(clampRay({ x: 100, y: 100 }, { x: 0, y: 1 }, 25, limits), { travelMm: 25, clippedMm: 0, clippedBy: null });
    }],
];
