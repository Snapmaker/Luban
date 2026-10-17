import assert from 'assert';

import { GravityPoint, RotaryCalibrationError, Vec3, angularSpanDeg, fitRotaryCalibration, rotaryAngle, symmetricEigen3, wrapDeg } from '../rotaryGravity';

type TestCase = [string, () => void | Promise<void>];

const LIMITS = { minPoints: 3, minSpanDeg: 90 };

/** Rodrigues rotation of v about unit k by angle a (radians). */
function rotate(v: Vec3, k: Vec3, a: number): Vec3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const cr: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    return [0, 1, 2].map((i) => v[i] * c + cr[i] * s + k[i] * kv * (1 - c)) as Vec3;
}

/**
 * A sensor stuck on the chuck at an arbitrary orientation, with an offset.
 * World: rotary axis along machine Y (this jig), gravity -Z, tilted by
 * `tiltDeg` about X. `physical(bController)` = bController + powerOnOffset.
 */
function rig(opts: { axisInSensor: Vec3; mountTurnDeg: number; offsetG: Vec3; tiltDeg: number; senseSign: 1 | -1; powerOnOffsetDeg: number }) {
    const k = opts.axisInSensor.map((v) => v / Math.hypot(...opts.axisInSensor)) as Vec3;
    // Gravity in the sensor frame at physical angle 0: perpendicular-ish to k, plus axial component from tilt.
    const helper: Vec3 = Math.abs(k[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const kh = k[0] * helper[0] + k[1] * helper[1] + k[2] * helper[2];
    const perp = [0, 1, 2].map((i) => helper[i] - kh * k[i]) as Vec3;
    const pn = Math.hypot(...perp);
    const tilt = (opts.tiltDeg * Math.PI) / 180;
    const g0 = [0, 1, 2].map((i) => (perp[i] / pn) * Math.cos(tilt) + k[i] * Math.sin(tilt)) as Vec3;
    const g0Turned = rotate(g0, k, (opts.mountTurnDeg * Math.PI) / 180);
    return (bController: number): Vec3 => {
        const physical = ((bController + opts.powerOnOffsetDeg) * Math.PI) / 180;
        const g = rotate(g0Turned, k, -opts.senseSign * physical);
        return [g[0] + opts.offsetG[0], g[1] + opts.offsetG[1], g[2] + opts.offsetG[2]];
    };
}

export const tests: TestCase[] = [
    ['Jacobi eigen-decomposition recovers a known symmetric matrix', () => {
        const { values, vectors } = symmetricEigen3([[2, 1, 0], [1, 2, 0], [0, 0, 5]]);
        assert.ok(Math.abs(values[0] - 1) < 1e-9 && Math.abs(values[1] - 3) < 1e-9 && Math.abs(values[2] - 5) < 1e-9, JSON.stringify(values));
        assert.ok(Math.abs(Math.abs(vectors[0][0]) - Math.SQRT1_2) < 1e-9 && Math.abs(vectors[0][0] + vectors[0][1]) < 1e-9);
    }],

    ['calibration absorbs mount orientation, zero-g offset, axis tilt and rotation sense', () => {
        for (const senseSign of [1, -1] as Array<1 | -1>) {
            const measure = rig({
                axisInSensor: [0.3, -0.8, 0.5], mountTurnDeg: 37, offsetG: [0.021, -0.015, 0.03], tiltDeg: 2, senseSign, powerOnOffsetDeg: 0,
            });
            const points: GravityPoint[] = [0, 90, 180, 270].map((b) => ({ bDeg: b, g: measure(b) }));
            const cal = fitRotaryCalibration(points, LIMITS);
            assert.ok(cal.residualRmsDeg < 1e-6, `residual ${cal.residualRmsDeg}`);
            assert.ok(cal.senseMarginDeg > 10, `sense margin ${cal.senseMarginDeg}`);
            for (const b of [-170, -45, 0, 12.5, 133, 179]) {
                const reading = rotaryAngle(cal, measure(b));
                assert.ok(Math.abs(wrapDeg(reading.absoluteDeg - b)) < 1e-6, `sense ${senseSign}: B${b} read ${reading.absoluteDeg}`);
                assert.ok(Math.abs(reading.radiusRatio - 1) < 1e-9);
                assert.ok(Math.abs(reading.axialShiftG) < 1e-9);
            }
        }
    }],

    ['after a power cycle the reading gives the lost B offset', () => {
        // Calibrated in session 1 (controller B = physical). Session 2 powered up
        // with the chuck 63.4 deg round: controller B0 is physical 63.4.
        const session1 = rig({ axisInSensor: [0, 0, 1], mountTurnDeg: 0, offsetG: [0.01, 0.02, 0], tiltDeg: 0, senseSign: 1, powerOnOffsetDeg: 0 });
        const cal = fitRotaryCalibration([0, 120, 240].map((b) => ({ bDeg: b, g: session1(b) })), LIMITS);
        const session2 = rig({ axisInSensor: [0, 0, 1], mountTurnDeg: 0, offsetG: [0.01, 0.02, 0], tiltDeg: 0, senseSign: 1, powerOnOffsetDeg: 63.4 });
        const reading = rotaryAngle(cal, session2(0));
        assert.ok(Math.abs(reading.absoluteDeg - 63.4) < 1e-6, `${reading.absoluteDeg}`);
    }],

    ['three points need a spread, and noise shows up in the residual', () => {
        const measure = rig({ axisInSensor: [1, 0, 0], mountTurnDeg: 10, offsetG: [0, 0, 0], tiltDeg: 0, senseSign: 1, powerOnOffsetDeg: 0 });
        assert.throws(() => fitRotaryCalibration([0, 20, 40].map((b) => ({ bDeg: b, g: measure(b) })), LIMITS), RotaryCalibrationError);
        assert.throws(() => fitRotaryCalibration([0, 180].map((b) => ({ bDeg: b, g: measure(b) })), LIMITS), /at least 3/);
        const noisy = [0, 60, 120, 180, 240, 300].map((b, i) => {
            const g = measure(b);
            return { bDeg: b, g: [g[0], g[1] + (i % 2 ? 0.004 : -0.004), g[2]] as Vec3 };
        });
        const cal = fitRotaryCalibration(noisy, LIMITS);
        assert.ok(cal.residualRmsDeg > 0.05 && cal.residualRmsDeg < 1, `${cal.residualRmsDeg}`);
    }],

    ['angular span is the smallest arc holding every angle', () => {
        assert.strictEqual(angularSpanDeg([350, 10, 20]), 30);
        assert.strictEqual(angularSpanDeg([0, 90, 180, 270]), 270);
        assert.strictEqual(angularSpanDeg([-90, 90]), 180);
    }],
];
