import { strict as assert } from 'assert';

import { ObstacleBox } from '../envelopeChecks';
import { CLEARANCE_MARGIN_MM, requiredToolheadZ } from '../landmarkClearance';
import {
    RotarySafeHeightInputs,
    WOULD_LOWER,
    rotaryKeepOutBox,
    rotarySafeHeight,
    supersedesLegacy,
} from '../rotaryClearance';

// The A350's safe traverse Z (top of travel) and its legacy rotary landmark:
// X140-200 x Y0-350, a 'toolhead' clearance with a probe length baked in.
const FALLBACK_Z = 328;
const LEGACY: ObstacleBox = { name: 'rotary-axis', machine: { x0: 140, y0: 0, x1: 200, y1: 350 }, clearanceZ: 328, mode: 'crossing' };

// Measured: axis physical Z 112.4 (README), active tool protrusion 43.5.
// ASSUMED (not yet measured on the A350): chuck top 130, tailstock top 125,
// chuck face Y 20, tailstock Y 300.
function present<T>(v: T | null): T {
    assert.ok(v !== null, 'expected a keep-out box');
    return v as T;
}

function inputs(over: Partial<RotarySafeHeightInputs> = {}): RotarySafeHeightInputs {
    return {
        axisZ: 112.4,
        chuckFaceY: 20,
        tailstockY: 300,
        chuckTopZ: 130,
        tailstockTopZ: 125,
        stock: { radiusMm: 25 },
        toolProtrusionMm: 43.5,
        fallbackZ: FALLBACK_Z,
        ...over,
    };
}

export const tests: Array<[string, () => void]> = [
    ['the margin is landmarkClearance\'s, not a second number', () => {
        const r = rotarySafeHeight(inputs());
        assert.equal(r.components.marginMm, CLEARANCE_MARGIN_MM);
    }],

    ['A350 worked example: 25 mm radius stock, 43.5 mm tool -> 185.9, well below 328', () => {
        const r = rotarySafeHeight(inputs());
        assert.equal(r.basis, 'computed');
        // 112.4 + 25 = 137.4 stock top (above the assumed chuck 130 / tailstock 125)
        assert.equal(r.components.stockTopZ, 137.4);
        assert.equal(r.components.stockTopFrom, 'radius');
        assert.equal(r.physicalTopZ, 137.4);
        assert.equal(r.zMm, 185.9);
        assert.ok(r.zMm < FALLBACK_Z - 100);
        assert.deepEqual(r.wouldLowerIf, []);
        assert.equal(r.clearsAtFallback, true);
        // The same answer a physical landmark of that top would demand.
        assert.equal(r.zMm, requiredToolheadZ(137.4, 'physical', 43.5));
    }],

    ['a stated stock top Z overrides axis + radius', () => {
        const r = rotarySafeHeight(inputs({ stock: { radiusMm: 25, topZ: 140 } }));
        assert.equal(r.basis, 'computed');
        assert.equal(r.components.stockTopFrom, 'top_z');
        assert.equal(r.physicalTopZ, 140);
        assert.equal(r.zMm, 188.5);
    }],

    ['a chuck taller than the stock sets the top', () => {
        const r = rotarySafeHeight(inputs({ chuckTopZ: 160 }));
        assert.equal(r.basis, 'computed');
        assert.equal(r.physicalTopZ, 160);
        assert.equal(r.zMm, 208.5);
    }],

    ['a tailstock taller than everything sets the top', () => {
        const r = rotarySafeHeight(inputs({ tailstockTopZ: 170.2 }));
        assert.equal(r.basis, 'computed');
        assert.equal(r.physicalTopZ, 170.2);
        assert.equal(r.zMm, 218.7);
    }],

    ['an explicit margin is honoured', () => {
        const r = rotarySafeHeight(inputs({ marginMm: 10 }));
        assert.equal(r.zMm, 190.9);
    }],

    ['unknown tool protrusion -> fallback 328, asks for the tool setter', () => {
        for (const p of [null, Number.NaN, 0, -3]) {
            const r = rotarySafeHeight(inputs({ toolProtrusionMm: p }));
            assert.equal(r.basis, 'fallback');
            assert.equal(r.zMm, FALLBACK_Z);
            assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.protrusion]);
            assert.match(r.wouldLowerIf[0], /run_tool_setter/);
            assert.equal(r.physicalTopZ, null);
            assert.equal(r.clearsAtFallback, null);
        }
    }],

    ['no stock arg -> fallback: an unknown part has an unknown top', () => {
        const r = rotarySafeHeight(inputs({ stock: null }));
        assert.equal(r.basis, 'fallback');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.stock]);
        assert.match(r.wouldLowerIf[0], /stock\.radius_mm/);
    }],

    ['a non-positive stock radius is not a stock', () => {
        const r = rotarySafeHeight(inputs({ stock: { radiusMm: 0 } }));
        assert.equal(r.basis, 'fallback');
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.stock]);
    }],

    ['unknown chuck top -> fallback, asks for rotary_chuck_top_z', () => {
        const r = rotarySafeHeight(inputs({ chuckTopZ: null }));
        assert.equal(r.basis, 'fallback');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.chuckTop]);
        assert.match(r.wouldLowerIf[0], /set_probe_geometry \(rotary_chuck_top_z\)/);
    }],

    ['unknown tailstock top -> fallback, asks for the tailstock bracket top', () => {
        const r = rotarySafeHeight(inputs({ tailstockTopZ: Number.POSITIVE_INFINITY }));
        assert.equal(r.basis, 'fallback');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.tailstockTop]);
        assert.match(r.wouldLowerIf[0], /tailstock bracket top/);
    }],

    ['unknown axis Z -> fallback, asks for rotary_axis_z_physical', () => {
        const r = rotarySafeHeight(inputs({ axisZ: null }));
        assert.equal(r.basis, 'fallback');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.axisZ]);
    }],

    ['the axis is a required input even when stock.top_z is stated', () => {
        // The hardware tops are sanity-checked against the axis, so it is never skipped.
        const r = rotarySafeHeight(inputs({ axisZ: null, stock: { radiusMm: 25, topZ: 140 } }));
        // The axis is still a required input: unknown axis -> fallback.
        assert.equal(r.basis, 'fallback');
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.axisZ]);
    }],

    ['every unknown is listed, each once', () => {
        const r = rotarySafeHeight(inputs({ toolProtrusionMm: null, stock: null, chuckTopZ: null, tailstockTopZ: null }));
        assert.equal(r.basis, 'fallback');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.deepEqual(r.wouldLowerIf, [WOULD_LOWER.protrusion, WOULD_LOWER.stock, WOULD_LOWER.chuckTop, WOULD_LOWER.tailstockTop]);
    }],

    ['a physical top below the axis was stated on the wrong datum -> fallback, re-state', () => {
        const chuck = rotarySafeHeight(inputs({ chuckTopZ: 100 }));
        assert.equal(chuck.basis, 'fallback');
        assert.match(chuck.wouldLowerIf[0], /^re-state it: .*rotary_chuck_top_z/);
        const part = rotarySafeHeight(inputs({ stock: { radiusMm: 25, topZ: 90 } }));
        assert.equal(part.basis, 'fallback');
        assert.match(part.wouldLowerIf[0], /re-state stock\.top_z/);
        // At the axis within the 0.05 mm epsilon is not "below" it.
        assert.equal(rotarySafeHeight(inputs({ chuckTopZ: 112.36 })).basis, 'computed');
    }],

    ['computed above the fallback -> fallback, with the raw value and a do-not-traverse reason', () => {
        // A 73.5 mm probe over a 45 mm radius part and a tall chuck.
        const r = rotarySafeHeight(inputs({ toolProtrusionMm: 73.5, chuckTopZ: 260 }));
        assert.equal(r.basis, 'fallback');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.equal(r.components.computedZ, 338.5);
        assert.equal(r.physicalTopZ, 260);
        assert.equal(r.clearsAtFallback, false);
        assert.deepEqual(r.wouldLowerIf, []);
        assert.ok(r.reasons.some((s) => /even the fallback does not clear/.test(s)));
    }],

    ['computed within the 0.05 mm epsilon above the fallback is the fallback height, still computed', () => {
        // 260 + 63.03 + 5 = 328.03
        const r = rotarySafeHeight(inputs({ toolProtrusionMm: 63.03, chuckTopZ: 260 }));
        assert.equal(r.basis, 'computed');
        assert.equal(r.zMm, FALLBACK_Z);
        assert.equal(r.components.computedZ, 328.03);
    }],

    ['a non-finite fallback is a programmer error', () => {
        assert.throws(() => rotarySafeHeight(inputs({ fallbackZ: Number.NaN })), RangeError);
    }],

    ['the keep-out box is the union of legacy and geometry, on the toolhead basis (no double count)', () => {
        const r = rotarySafeHeight(inputs());
        const box = present(rotaryKeepOutBox({ axisX: 169.7, chuckFaceY: 20, tailstockY: 300 }, r, LEGACY));
        assert.deepEqual(box.machine, { x0: 140, y0: 0, x1: 200, y1: 350 });
        assert.equal(box.clearanceBasis, 'toolhead');
        assert.equal(box.clearanceZ, 185.9);
        assert.equal(box.requiredToolheadZ, 185.9);
        // Read back through the existing rule, the toolhead basis adds nothing.
        assert.equal(requiredToolheadZ(box.clearanceZ, box.clearanceBasis ?? 'toolhead', 43.5), 185.9);
        assert.equal(box.mode, 'crossing');
        assert.deepEqual(box.extentFrom, { x: 'legacy', y: 'both' });
    }],

    ['geometry wider than the legacy box widens it, never narrows it', () => {
        const r = rotarySafeHeight(inputs());
        const box = present(rotaryKeepOutBox({ axisX: 169.7, chuckFaceY: -10, tailstockY: 300, halfWidthMm: 40 }, r, LEGACY));
        assert.deepEqual(box.machine, { x0: 129.7, y0: -10, x1: 209.7, y1: 350 });
        assert.deepEqual(box.extentFrom, { x: 'both', y: 'both' });
    }],

    ['no legacy box and no half-width -> no box (refuse rather than invent a footprint)', () => {
        const r = rotarySafeHeight(inputs());
        assert.equal(rotaryKeepOutBox({ axisX: 169.7, chuckFaceY: 20, tailstockY: 300 }, r, null), null);
        const full = present(rotaryKeepOutBox({ axisX: 169.7, chuckFaceY: 20, tailstockY: 300, halfWidthMm: 30 }, r, null));
        assert.deepEqual(full.machine, { x0: 139.7, y0: 20, x1: 199.7, y1: 300 });
        assert.deepEqual(full.extentFrom, { x: 'geometry', y: 'geometry' });
    }],

    ['the computed box supersedes the legacy one only when computed', () => {
        const footprint = { axisX: 169.7, chuckFaceY: 20, tailstockY: 300 };
        const computed = rotaryKeepOutBox(footprint, rotarySafeHeight(inputs()), LEGACY);
        assert.equal(supersedesLegacy(LEGACY, computed), true);
        // No stock arg: the legacy requirement stands (A350 unchanged).
        const noStock = present(rotaryKeepOutBox(footprint, rotarySafeHeight(inputs({ stock: null })), LEGACY));
        assert.equal(noStock.clearanceZ, FALLBACK_Z);
        assert.equal(supersedesLegacy(LEGACY, noStock), false);
        // Computed above the fallback: never supersedes either.
        const tooTall = rotaryKeepOutBox(footprint, rotarySafeHeight(inputs({ toolProtrusionMm: 73.5, chuckTopZ: 260 })), LEGACY);
        assert.equal(supersedesLegacy(LEGACY, tooTall), false);
        assert.equal(supersedesLegacy(LEGACY, null), false);
    }],

    ['a computed box that does not cover the legacy extent does not supersede it', () => {
        const r = rotarySafeHeight(inputs());
        const narrow = present(rotaryKeepOutBox({ axisX: 169.7, chuckFaceY: 20, tailstockY: 300, halfWidthMm: 30 }, r, null));
        assert.equal(supersedesLegacy(LEGACY, narrow), false);
        // Covering it to within the 0.05 mm epsilon counts as covering it.
        const near = { ...narrow, machine: { x0: 140.04, y0: -0.04, x1: 199.96, y1: 350.04 } };
        assert.equal(supersedesLegacy(LEGACY, near), true);
    }],
];
