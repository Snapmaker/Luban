import { strict as assert } from 'assert';

import { clampBand, clampRay, describeClipping, outsideTravel, resolveTravel } from '../machineTravel';
import type { ResolvedTravel, TravelInput } from '../machineTravel';

// The A350 as it actually is: a 320 x 350 definition, a machine frame that
// runs X -19...339, and a home position at X-19 Y342 that PROVES the low X
// end is reachable however the definition reads.
const A350 = { x: 320, y: 350 };
const NOTHING_STATED = { xMin: null, xMax: null, yMin: null, yMax: null };
const AT_HOME = { x: -19, y: 342 };

function travelFor(input: TravelInput): ResolvedTravel {
    const travel = resolveTravel(input);
    assert.ok(travel, 'travel should resolve');
    return travel;
}

export const tests: Array<[string, () => void]> = [
    ['with nothing stated the travel is the machine definition', () => {
        const travel = travelFor({ size: A350, stated: NOTHING_STATED, observed: null });
        assert.deepEqual(travel.limits, { xMin: 0, xMax: 320, yMin: 0, yMax: 350 });
        assert.equal(travel.ends.xMin.source, 'nominal');
    }],

    ['a position the toolhead has occupied widens an unstated end - it is proof of reach', () => {
        const travel = travelFor({ size: A350, stated: NOTHING_STATED, observed: AT_HOME });
        assert.equal(travel.limits.xMin, -19);
        assert.equal(travel.ends.xMin.source, 'observed');
        // Y342 is INSIDE the nominal 0..350, so it changes nothing.
        assert.equal(travel.limits.yMax, 350);
        assert.equal(travel.ends.yMax.source, 'nominal');
    }],

    ['a stated limit beats both the definition and the observation', () => {
        const travel = travelFor({
            size: A350,
            stated: { xMin: -19, xMax: 339, yMin: 0, yMax: 342 },
            observed: AT_HOME,
        });
        assert.deepEqual(travel.limits, { xMin: -19, xMax: 339, yMin: 0, yMax: 342 });
        assert.equal(travel.ends.xMax.source, 'stated');
        assert.deepEqual(travel.conflicts, []);
    }],

    ['a permitted 1 mm overtravel past a stated end is not a conflict; beyond it is', () => {
        // Operator rule 2026-10-05: the pendant jogged to Y -1 against a stated Y 0 minimum.
        const within = travelFor({ size: A350, stated: { xMin: null, xMax: null, yMin: 0, yMax: null }, observed: { x: 100, y: -1 } });
        assert.deepEqual(within.conflicts, []);
        assert.equal(within.limits.yMin, 0, 'the stated end still governs planning');
        const beyondIt = travelFor({ size: A350, stated: { xMin: null, xMax: null, yMin: 0, yMax: null }, observed: { x: 100, y: -1.2 } });
        assert.equal(beyondIt.conflicts.length, 1);
        assert.match(beyondIt.conflicts[0], /1 mm overtravel allowance/);
    }],
    ['an observation outside a stated limit is a conflict, not a silent widening', () => {
        // Someone stated X can only reach 0, but the machine is sitting at -19.
        const travel = travelFor({
            size: A350,
            stated: { xMin: 0, xMax: null, yMin: null, yMax: null },
            observed: AT_HOME,
        });
        assert.equal(travel.limits.xMin, 0, 'the operator still wins');
        assert.equal(travel.conflicts.length, 1);
        assert.match(travel.conflicts[0], /observed at X -19/);
    }],

    // Live 2026-09-20: the first staging on the box reported a "conflict"
    // because a machine homed to X-19 reports X-19.00000610351563. Six
    // microns is float noise, not a machine that went somewhere it should
    // not have, and a warning that cries wolf is a warning nobody reads.
    ['the heartbeat\'s float noise is not a conflict', () => {
        const travel = travelFor({
            size: A350,
            stated: { xMin: -19, xMax: 339, yMin: 0, yMax: 342 },
            observed: { x: -19.00000610351563, y: 342 },
        });
        assert.deepEqual(travel.conflicts, []);
        assert.equal(travel.limits.xMin, -19);
    }],

    ['float noise does not widen an unstated end either', () => {
        const travel = travelFor({
            size: { x: 320, y: 350 },
            stated: NOTHING_STATED,
            observed: { x: -0.0000061, y: 0 },
        });
        assert.equal(travel.limits.xMin, 0);
        assert.equal(travel.ends.xMin.source, 'nominal');
    }],

    ['a real excursion past a stated limit is still a conflict', () => {
        const travel = travelFor({
            size: A350,
            stated: { xMin: -19, xMax: null, yMin: null, yMax: null },
            observed: { x: -24, y: 342 },
        });
        assert.equal(travel.conflicts.length, 1);
        assert.match(travel.conflicts[0], /observed at X -24/);
    }],

    ['an unknown machine with nothing stated has no honest travel at all', () => {
        assert.equal(resolveTravel({ size: null, stated: NOTHING_STATED, observed: AT_HOME }), null);
    }],

    ['an unknown machine with every end stated is planned from those', () => {
        const travel = travelFor({
            size: null,
            stated: { xMin: -19, xMax: 339, yMin: 0, yMax: 342 },
            observed: null,
        });
        assert.deepEqual(travel.limits, { xMin: -19, xMax: 339, yMin: 0, yMax: 342 });
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
