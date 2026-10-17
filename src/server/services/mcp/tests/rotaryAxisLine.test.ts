/* eslint-disable camelcase */
import { strict as assert } from 'assert';

import { distanceFromSweptAxis, insideSweptCylinder } from '../envelopeChecks';
import {
    RotaryAxisError,
    RotaryAxisPoint,
    axisAt,
    axisNamespaceAt,
    axisNamespaceFor,
    fitRotaryAxisLine,
    normaliseAxisPoint,
    unmeasuredSkewLine,
} from '../rotaryAxisLine';

// The operator's rotary (issue #155): ~1.2 deg of yaw off machine Y, which
// over 250 mm of stock is ~5.2 mm of X. Two stations 250 mm apart, X
// shifted by exactly tan(1.2 deg) * 250, Z level.
const YAW_DEG = 1.2;
const DX_250 = Number((Math.tan(YAW_DEG * Math.PI / 180) * 250).toFixed(3)); // 5.237
const NEAR: RotaryAxisPoint = { x: 170.0, y: 50, z_physical: 112.4, source: 'side pair job aaa, 70.95 mm probe', measured_at: 1760000000000 };
const FAR: RotaryAxisPoint = { x: Number((170.0 + DX_250).toFixed(3)), y: 300, z_physical: 112.4, source: 'side pair job bbb, 70.95 mm probe', measured_at: 1760000100000 };
const PROBE = { effectiveLength: 70.95, tipDiameter: 2 };

export const tests: Array<[string, () => void]> = [
    ['two stations give the yaw, the pitch and the line at their centroid', () => {
        const line = fitRotaryAxisLine([FAR, NEAR]);
        assert.equal(line.skew, 'measured');
        assert.equal(line.reference_y, 175);
        assert.equal(line.yaw_deg, YAW_DEG);
        assert.equal(line.pitch_deg, 0);
        assert.ok(Math.abs(line.x - (170 + DX_250 / 2)) < 0.001, `x at the centroid ${line.x}`);
        assert.equal(line.z_physical, 112.4);
        assert.equal(line.dz_per_mm, 0);
        assert.ok(Math.abs(line.dx_per_mm - DX_250 / 250) < 1e-4, `dx/mm ${line.dx_per_mm}`);
        assert.deepEqual(line.points.map((p) => p.y), [50, 300], 'points come back sorted by Y');
        assert.deepEqual(line.fit, { stations: 2, span_y_mm: 250, max_residual_x_mm: 0, max_residual_z_mm: 0 });
    }],

    ['the axis at a Y walks the line: the near station, the far station, and 2 x the lever arm beyond it', () => {
        const line = fitRotaryAxisLine([NEAR, FAR]);
        // Two 3-decimal roundings (the centroid, then the value) may stack to 1 um; the geometry is exact.
        assert.ok(Math.abs(axisAt(line, 50).x - 170) <= 0.0015, `x at the near station ${axisAt(line, 50).x}`);
        assert.ok(Math.abs(axisAt(line, 300).x - FAR.x) <= 0.0015, `x at the far station ${axisAt(line, 300).x}`);
        assert.equal(axisAt(line, 50).z_physical, 112.4);
        assert.equal(axisAt(line, 300).z_physical, 112.4);
        assert.ok(Math.abs(axisAt(line, 175).x - line.x) < 1e-9);
        // 125 mm past the far station is another half shift.
        assert.ok(Math.abs(axisAt(line, 425).x - (170 + DX_250 * 1.5)) < 0.002, `x at 425 = ${axisAt(line, 425).x}`);
    }],

    ['pitch: a Z that rises with Y gives a positive pitch and z at y follows it', () => {
        const line = fitRotaryAxisLine([
            { ...NEAR, z_physical: 112.0 },
            { ...FAR, x: 170, z_physical: 113.0 },
        ]);
        assert.equal(line.yaw_deg, 0);
        assert.equal(line.pitch_deg, Number((Math.atan2(1, 250) * 180 / Math.PI).toFixed(3)));
        assert.equal(line.dz_per_mm, 0.004);
        assert.equal(line.dx_per_mm, 0);
        assert.equal(axisAt(line, 50).z_physical, 112);
        assert.equal(axisAt(line, 300).z_physical, 113);
        assert.equal(axisAt(line, 175).z_physical, 112.5);
    }],

    ['a yaw toward -X as Y increases is negative', () => {
        const line = fitRotaryAxisLine([NEAR, { ...FAR, x: 170 - DX_250 }]);
        assert.equal(line.yaw_deg, -YAW_DEG);
    }],

    ['three stations are fitted by least squares and the odd one out is reported as the residual', () => {
        const mid: RotaryAxisPoint = { x: 170 + DX_250 / 2 + 0.3, y: 175, z_physical: 112.4, source: 'job ccc', measured_at: null };
        const line = fitRotaryAxisLine([NEAR, mid, FAR]);
        assert.equal(line.fit?.stations, 3);
        assert.equal(line.fit?.span_y_mm, 250);
        // The middle point pulls the centroid up by a third of its 0.3 mm; its residual is 0.2.
        assert.equal(line.fit?.max_residual_x_mm, 0.2);
        assert.equal(line.fit?.max_residual_z_mm, 0);
        assert.equal(line.yaw_deg, YAW_DEG, 'a symmetric outlier does not change the slope');
    }],

    ['one station, or two at the same Y, does not fix a line', () => {
        assert.throws(() => fitRotaryAxisLine([NEAR]), (err: Error) => err instanceof RotaryAxisError && /at least two/.test(err.message));
        assert.throws(() => fitRotaryAxisLine([NEAR, { ...FAR, y: 50.02 }]),
            (err: Error) => err instanceof RotaryAxisError && /different Y stations/.test(err.message));
        assert.throws(() => fitRotaryAxisLine([NEAR, { ...NEAR, y: 50.01 }, FAR]),
            (err: Error) => err instanceof RotaryAxisError && /same Y station/.test(err.message));
    }],

    ['a store with only the scalars loads as a yaw-0 line flagged unmeasured, the same at every Y', () => {
        const line = unmeasuredSkewLine(170.1, 112.4);
        assert.equal(line.skew, 'unmeasured');
        assert.equal(line.reference_y, null);
        assert.equal(line.yaw_deg, 0);
        assert.equal(line.pitch_deg, 0);
        assert.equal(line.fit, null);
        assert.deepEqual(axisAt(line, 0), { x: 170.1, z_physical: 112.4 });
        assert.deepEqual(axisAt(line, 340), { x: 170.1, z_physical: 112.4 });
    }],

    ['the seeded axis namespace carries the line and is re-evaluated at an op\'s Y', () => {
        const line = fitRotaryAxisLine([NEAR, FAR]);
        const seeded = axisNamespaceFor(line, PROBE);
        assert.equal(seeded.at_y, 175);
        assert.equal(seeded.reference_y, 175);
        assert.equal(seeded.z_contact, Number((112.4 + 70.95).toFixed(3)));
        assert.equal(seeded.tip_radius, 1);
        assert.equal(seeded.skew, 'measured');
        const atFar = axisNamespaceAt(seeded, 300);
        assert.equal(atFar.at_y, 300);
        assert.ok(Math.abs(atFar.x - FAR.x) < 0.001, `x at the far station ${atFar.x}`);
        assert.equal(atFar.z_contact, seeded.z_contact, 'no pitch: z_contact unchanged');
        assert.equal(atFar.probe_length, 70.95);
        assert.equal(atFar.yaw_deg, YAW_DEG);
        // Z moves with pitch, and z_contact with it.
        const pitched = axisNamespaceFor(fitRotaryAxisLine([{ ...NEAR, z_physical: 112 }, { ...FAR, z_physical: 113 }]), PROBE);
        assert.equal(axisNamespaceAt(pitched, 300).z_physical, 113);
        assert.equal(axisNamespaceAt(pitched, 300).z_contact, Number((113 + 70.95).toFixed(3)));
    }],

    ['an unmeasured namespace is returned unchanged by axisNamespaceAt - at_y stays null', () => {
        const seeded = axisNamespaceFor(unmeasuredSkewLine(170.1, 112.4), PROBE);
        assert.equal(seeded.at_y, null);
        const at = axisNamespaceAt(seeded, 300);
        assert.equal(at, seeded);
        assert.equal(at.at_y, null);
    }],

    ['the swept-cylinder check uses the yawed line: clear at the reference Y, inside 125 mm along', () => {
        const line = fitRotaryAxisLine([NEAR, FAR]);
        const axis = { x: line.x, zPhysical: line.z_physical, radius: 20, referenceY: line.reference_y, dxPerMm: line.dx_per_mm, dzPerMm: line.dz_per_mm };
        // Tip 22 mm +X of the axis at the reference Y, at the axis height: outside a 20 mm cylinder.
        const toolheadX = line.x + 22;
        const toolheadZ = line.z_physical + PROBE.effectiveLength;
        assert.equal(insideSweptCylinder({ x: toolheadX, y: 175, z: toolheadZ }, PROBE.effectiveLength, axis), false);
        // Same toolhead X at the far station: the axis has walked 2.618 mm toward the tip (22 - 2.618 = 19.38 < 20): inside.
        assert.equal(insideSweptCylinder({ x: toolheadX, y: 300, z: toolheadZ }, PROBE.effectiveLength, axis), true);
        // The scalar check (no Y, or no slopes) would have passed it at every Y - the bug the line fixes.
        assert.equal(insideSweptCylinder({ x: toolheadX, z: toolheadZ }, PROBE.effectiveLength, axis), false);
        const scalar = { x: line.x, zPhysical: line.z_physical, radius: 20 };
        assert.equal(insideSweptCylinder({ x: toolheadX, y: 300, z: toolheadZ }, PROBE.effectiveLength, scalar), false);
    }],

    ['the perpendicular distance reduces to hypot(dx, dz) for a straight axis and is exact for a yawed one', () => {
        const straight = { x: 170, zPhysical: 112.4, radius: 1 };
        assert.ok(Math.abs(distanceFromSweptAxis({ x: 173, y: 999, z: 116.4 }, straight) - 5) < 1e-9);
        const line = fitRotaryAxisLine([NEAR, FAR]);
        const yawed = { x: line.x, zPhysical: line.z_physical, radius: 1, referenceY: line.reference_y, dxPerMm: line.dx_per_mm, dzPerMm: line.dz_per_mm };
        // A point ON the line is at distance 0 wherever along it.
        assert.ok(distanceFromSweptAxis({ x: axisAt(line, 300).x, y: 300, z: 112.4 }, yawed) < 1e-3);
        assert.ok(distanceFromSweptAxis({ x: axisAt(line, 10).x, y: 10, z: 112.4 }, yawed) < 1e-3);
        // 10 mm of X beside the line is 10 * cos(yaw) perpendicular.
        const d = distanceFromSweptAxis({ x: axisAt(line, 300).x + 10, y: 300, z: 112.4 }, yawed);
        assert.ok(Math.abs(d - 10 * Math.cos(YAW_DEG * Math.PI / 180)) < 1e-3, `d = ${d}`);
    }],

    ['a stated point is validated: ranges, a source, a date in either form', () => {
        const ranges = { x: [-50, 400] as [number, number], y: [-50, 400] as [number, number], z: [0, 400] as [number, number] };
        const p = normaliseAxisPoint({ x: 170, y: 50, z_physical: 112.4, measured_at: '2026-10-18T10:00:00Z' }, 'rotary_axis_point', ranges, 'reason text');
        assert.equal(p.source, 'reason text', 'source defaults to the call\'s reason');
        assert.equal(p.measured_at, Date.parse('2026-10-18T10:00:00Z'));
        assert.equal(normaliseAxisPoint({ x: 170, y: 50, z_physical: 112.4, measured_at: 1760000000000, source: 'job x' }, 'p', ranges, 'r').measured_at, 1760000000000);
        assert.equal(normaliseAxisPoint({ x: 170, y: 50, z_physical: 112.4 }, 'p', ranges, 'r').measured_at, null);
        assert.throws(() => normaliseAxisPoint({ x: 170, y: 50 }, 'p', ranges, 'r'), /p\.z_physical must be a machine coordinate in 0\.\.400/);
        assert.throws(() => normaliseAxisPoint({ x: 500, y: 50, z_physical: 112 }, 'p', ranges, 'r'), /p\.x must be/);
        assert.throws(() => normaliseAxisPoint({ x: 170, y: 50, z_physical: 112, source: '  ' }, 'p', ranges, 'r'), /p\.source/);
        assert.throws(() => normaliseAxisPoint({ x: 170, y: 50, z_physical: 112, measured_at: 'yesterday' }, 'p', ranges, 'r'), /measured_at/);
        assert.throws(() => normaliseAxisPoint([170, 50, 112], 'p', ranges, 'r'), /must be an object/);
    }],
];
