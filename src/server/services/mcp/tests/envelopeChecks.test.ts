import { strict as assert } from 'assert';

import { MotionSegment, ObstacleBox, POSITION_EPSILON_MM, checkMotion, describeViolations, isStraightZUp } from '../envelopeChecks';

// The rotary-axis landmark as stored on the A350: X140-200 x Y0-350, clearance 328
// (the box includes the tailstock, whose height is unmeasured).
const ROTARY: ObstacleBox = { name: 'rotary-axis', machine: { x0: 140, y0: 0, x1: 200, y1: 350 }, clearanceZ: 328, mode: 'crossing' };
// A program keep-out for the chuck jaws: a VOLUME nothing enters.
const JAWS: ObstacleBox = { name: 'chuck jaws', machine: { x0: 150, y0: 269, x1: 190, y1: 310 }, clearanceZ: 250, mode: 'volume' };

function hop(z: number, fromX: number, toX: number, y = 105): MotionSegment {
    return { what: `hop at Z${z}`, kind: 'hop', from: { x: fromX, y, z }, to: { x: toX, y, z } };
}

export const tests: Array<[string, () => void]> = [
    ['a straight Z-up exit is only XY-unchanged (within epsilon) and strictly rising', () => {
        const from = { x: 170, y: 100, z: 300 };
        assert.equal(isStraightZUp(from, { x: 170, y: 100, z: 301 }), true);
        assert.equal(isStraightZUp(from, { x: 170 + POSITION_EPSILON_MM * 0.9, y: 100 - POSITION_EPSILON_MM * 0.9, z: 301 }), true);
        assert.equal(isStraightZUp(from, { x: 170.2, y: 100, z: 301 }), false);
        assert.equal(isStraightZUp(from, { x: 170, y: 100.06, z: 301 }), false);
        assert.equal(isStraightZUp(from, { x: 170, y: 100, z: 300 }), false);
        assert.equal(isStraightZUp(from, { x: 170, y: 100, z: 299 }), false);
    }],
    ['a hop at 328 across the rotary footprint passes on its own merits (no exemption needed)', () => {
        const v = checkMotion([hop(328, 20, 290)], [ROTARY], { traverseZ: 328 });
        assert.deepEqual(v, []);
    }],

    ['a hop at 320 across the rotary footprint is refused - the old exemption is gone', () => {
        const v = checkMotion([hop(320, 20, 290)], [ROTARY], { traverseZ: 320 });
        assert.equal(v.length, 1);
        assert.equal(v[0].obstacle, 'rotary-axis');
        assert.equal(v[0].z, 320);
        assert.equal(v[0].clearanceZ, 328);
    }],

    ['the exemption is gone even when the planner says 320 is its traverse height', () => {
        // This is exactly the case that used to `continue`: lowZ >= traverseZ.
        const v = checkMotion([hop(320, 20, 290)], [ROTARY], { traverseZ: 320 });
        assert.equal(v.length, 1);
    }],

    ['a low hop wholly INSIDE a crossing landmark is allowed (probing the stock is the job)', () => {
        const v = checkMotion([hop(220, 160, 180, 200)], [ROTARY], { traverseZ: 328 });
        assert.deepEqual(v, []);
    }],

    ['a march into a crossing landmark is allowed; a plain hop entering it low is not', () => {
        const march: MotionSegment = { what: 'march -X into stock', kind: 'march', from: { x: 230, y: 200, z: 220 }, to: { x: 190, y: 200, z: 220 } };
        assert.deepEqual(checkMotion([march], [ROTARY]), []);
        const entering: MotionSegment = { what: 'hop into stock', kind: 'hop', from: { x: 230, y: 200, z: 220 }, to: { x: 190, y: 200, z: 220 } };
        assert.equal(checkMotion([entering], [ROTARY]).length, 1);
    }],

    ['a volume keep-out refuses everything below its clearance, even a column and even at the traverse height', () => {
        const column: MotionSegment = { what: 'descend column', kind: 'column', from: { x: 170, y: 290, z: 328 }, to: { x: 170, y: 290, z: 240 } };
        assert.equal(checkMotion([column], [JAWS], { traverseZ: 328 }).length, 1);
        const low = checkMotion([hop(240, 100, 250, 290)], [JAWS], { traverseZ: 328 });
        assert.equal(low.length, 1);
        assert.deepEqual(checkMotion([hop(328, 100, 250, 290)], [JAWS], { traverseZ: 328 }), [], 'above the volume clearance is fine');
    }],

    // A1: the heartbeat's float noise is not a clearance violation. Live
    // 2026-09-19: an XY move was refused because machine Z read 327.999994
    // against the rotary landmark's clearance of 328 - 6 nanometres.
    ['a hop a float-noise hair below the clearance is allowed', () => {
        assert.deepEqual(checkMotion([hop(327.999994, 20, 290)], [ROTARY]), []);
    }],

    ['a hop exactly at the clearance is allowed', () => {
        assert.deepEqual(checkMotion([hop(328, 20, 290)], [ROTARY]), []);
    }],

    ['a hop at the epsilon boundary is allowed; one hair below it is refused', () => {
        assert.deepEqual(checkMotion([hop(328 - POSITION_EPSILON_MM, 20, 290)], [ROTARY]), [],
            'exactly one epsilon below the clearance still clears');
        const v = checkMotion([hop(328 - POSITION_EPSILON_MM - 0.001, 20, 290)], [ROTARY]);
        assert.equal(v.length, 1, 'beyond the epsilon it is a real violation');
        assert.equal(v[0].clearanceZ, 328);
    }],

    ['a tenth of a millimetre low is still a violation - the epsilon is noise, not slack', () => {
        assert.equal(checkMotion([hop(327.9, 20, 290)], [ROTARY]).length, 1);
    }],

    // B3: an obstacle stated physically is judged against the live tool.
    ['a physically stated obstacle is cleared by a short tool and not by a long one', () => {
        const ROTARY_PHYSICAL: ObstacleBox = {
            name: 'rotary-axis',
            machine: { x0: 140, y0: 0, x1: 200, y1: 350 },
            clearanceZ: 250,
            clearanceBasis: 'physical',
            mode: 'crossing',
        };
        // 73 mm touch probe + 5 mm margin: the old blanket 328 falls out of it.
        assert.equal(checkMotion([hop(328, 20, 290)], [ROTARY_PHYSICAL], { toolProtrusionMm: 73 }).length, 0);
        assert.equal(checkMotion([hop(327, 20, 290)], [ROTARY_PHYSICAL], { toolProtrusionMm: 73 }).length, 1);
        // 2 mm engraving bit: 257 is enough, and the machine gets its room back.
        assert.equal(checkMotion([hop(320, 20, 290)], [ROTARY_PHYSICAL], { toolProtrusionMm: 2 }).length, 0);
        assert.equal(checkMotion([hop(256, 20, 290)], [ROTARY_PHYSICAL], { toolProtrusionMm: 2 }).length, 1);
    }],

    ['a physically stated obstacle with no tool length known is impassable', () => {
        const PHYSICAL: ObstacleBox = {
            name: 'tailstock',
            machine: { x0: 140, y0: 0, x1: 200, y1: 350 },
            clearanceZ: 250,
            clearanceBasis: 'physical',
            mode: 'crossing',
        };
        const v = checkMotion([hop(328, 20, 290)], [PHYSICAL], { toolProtrusionMm: null });
        assert.equal(v.length, 1, 'unknown is refused, never waved through');
        assert.equal(v[0].requiredZ, null);
        assert.ok(/no tool length is known/.test(describeViolations(v)), describeViolations(v));
        assert.ok(/longest_bit_length_mm/.test(describeViolations(v)), 'names how to fix it');
    }],

    ['a legacy obstacle is enforced exactly as before, tool length or not', () => {
        assert.equal(checkMotion([hop(328, 20, 290)], [ROTARY], { toolProtrusionMm: null }).length, 0);
        assert.equal(checkMotion([hop(320, 20, 290)], [ROTARY], { toolProtrusionMm: 73 }).length, 1,
            'the stored number is not inflated by the tool a second time');
        const v = checkMotion([hop(320, 20, 290)], [ROTARY]);
        assert.equal(v[0].basis, 'toolhead');
        assert.equal(v[0].requiredZ, 328);
    }],

    ['the refusal says which number it wants and why', () => {
        const PHYSICAL: ObstacleBox = {
            name: 'rotary-axis',
            machine: { x0: 140, y0: 0, x1: 200, y1: 350 },
            clearanceZ: 250,
            clearanceBasis: 'physical',
            mode: 'crossing',
        };
        const text = describeViolations(checkMotion([hop(300, 20, 290)], [PHYSICAL], { toolProtrusionMm: 73 }));
        assert.ok(/top Z 250/.test(text), text);
        assert.ok(/needs Z 328/.test(text) || /toolhead needs Z 328/.test(text), text);
    }],
];
