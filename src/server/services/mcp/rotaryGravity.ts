// The rotary chuck's ABSOLUTE angle from gravity, read by an accelerometer
// that turns with it.
//
// The A350's B axis has no home switch: the controller counts B from
// wherever the chuck was when it powered up (operator, 2026-10-04: "it's
// actually reset sometimes, not always, between power off"), so after a
// power cycle B0 can be any physical angle. Gravity is an absolute
// reference the chuck cannot lose: an accelerometer fixed to the chuck sees
// the gravity vector turn by -dB about the rotary axis whenever the chuck
// turns by dB.
//
// Nothing about the sensor's mounting is assumed. A calibration is FITTED
// from readings taken at several controller B angles (in one power
// session, so the controller's count is consistent):
//   - the readings lie on a circle (gravity sweeping a cone about the axis);
//     the plane of that circle gives the axis direction in the sensor frame
//     (the smallest-variance direction of the points);
//   - the circle's centre absorbs the accelerometer's zero-g offset in that
//     plane (LSM6DS-class parts are specified to tens of mg, which is a
//     degree of angle - a centre at the origin would be wrong by that much);
//   - the circle's radius is g * cos(axis tilt) times the sensor's scale
//     error, reported, never assumed;
//   - the direction of rotation (+B turns gravity one way or the other in the
//     sensor frame) and the angle at B0 are fitted, and the residual is the
//     calibration's own accuracy statement.
// The calibration defines the ABSOLUTE zero as the physical angle the chuck
// had at controller B0 during calibration. Afterwards, any still reading
// gives the chuck's absolute angle, and its difference from the controller's
// B is what the power cycle lost.
//
// Read-only arithmetic: nothing here moves anything or writes the
// controller's B. Pure: no server imports, tests/rotaryGravity.test.ts.

export type Vec3 = [number, number, number];

export interface GravityPoint {
    /** The controller's B for this reading, degrees. */
    bDeg: number;
    /** Mean acceleration over a still window, sensor frame, g. */
    g: Vec3;
}

export interface RotaryCalibration {
    /** Rotary axis direction in the sensor frame (unit). */
    axis: Vec3;
    /** Plane basis in the sensor frame (unit, orthogonal to axis and each other). */
    e1: Vec3;
    e2: Vec3;
    /** Centroid of the calibration readings (sensor frame, g): the plane's anchor. */
    origin: Vec3;
    /** Circle centre in (e1, e2) relative to origin, g - the in-plane offset. */
    centre: [number, number];
    /** Circle radius, g: g * cos(axis tilt) * scale error. */
    radiusG: number;
    /** +1 or -1: the in-plane gravity angle advances by sign * dB. */
    sign: 1 | -1;
    /** In-plane gravity angle at controller B0 during calibration, radians. */
    theta0Rad: number;
    /** Gravity component along the axis at calibration (centroid . axis), g. */
    axialG: number;
    /** RMS of the fit residuals, degrees. */
    residualRmsDeg: number;
    /** Largest residual, degrees. */
    residualMaxDeg: number;
    /** Span of the calibration B angles, degrees (the larger, the better the axis). */
    spanDeg: number;
    points: number;
    /** How far the wrong rotation sense fits worse, degrees RMS - the sense is proven, not guessed. */
    senseMarginDeg: number;
}

export class RotaryCalibrationError extends Error {
}

function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(a: Vec3): number {
    return Math.sqrt(dot(a, a));
}

function scale(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s];
}

function unit(a: Vec3): Vec3 {
    const n = norm(a);
    return n > 0 ? scale(a, 1 / n) : [0, 0, 0];
}

/** Wrap radians into (-pi, pi]. */
export function wrapRad(a: number): number {
    let x = a % (2 * Math.PI);
    if (x <= -Math.PI) {
        x += 2 * Math.PI;
    } else if (x > Math.PI) {
        x -= 2 * Math.PI;
    }
    return x;
}

/** Wrap degrees into (-180, 180]. */
export function wrapDeg(a: number): number {
    return (wrapRad((a * Math.PI) / 180) * 180) / Math.PI;
}

/** Eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi). Values ascending, vectors as columns-in-rows. */
export function symmetricEigen3(m: number[][]): { values: number[]; vectors: Vec3[] } {
    const a = m.map((row) => row.slice());
    const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 50; sweep++) {
        const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
        if (off < 1e-30) {
            break;
        }
        for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
            if (Math.abs(a[p][q]) < 1e-300) {
                continue;
            }
            const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
            const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
            const c = 1 / Math.sqrt(t * t + 1);
            const s = t * c;
            for (let k = 0; k < 3; k++) {
                const akp = a[k][p];
                const akq = a[k][q];
                a[k][p] = c * akp - s * akq;
                a[k][q] = s * akp + c * akq;
            }
            for (let k = 0; k < 3; k++) {
                const apk = a[p][k];
                const aqk = a[q][k];
                a[p][k] = c * apk - s * aqk;
                a[q][k] = s * apk + c * aqk;
            }
            for (let k = 0; k < 3; k++) {
                const vkp = v[k][p];
                const vkq = v[k][q];
                v[k][p] = c * vkp - s * vkq;
                v[k][q] = s * vkp + c * vkq;
            }
        }
    }
    const order = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
    return {
        values: order.map((i) => a[i][i]),
        vectors: order.map((i) => [v[0][i], v[1][i], v[2][i]] as Vec3),
    };
}

function solve3(a: number[][], b: number[]): number[] | null {
    const m = a.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < 3; col++) {
        let pivot = col;
        for (let r = col + 1; r < 3; r++) {
            if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) {
                pivot = r;
            }
        }
        if (Math.abs(m[pivot][col]) < 1e-15) {
            return null;
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        for (let r = 0; r < 3; r++) {
            if (r !== col) {
                const f = m[r][col] / m[col][col];
                for (let c = col; c < 4; c++) {
                    m[r][c] -= f * m[col][c];
                }
            }
        }
    }
    return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/** Least-squares circle (Kasa): x^2 + y^2 + D x + E y + F = 0. */
export function fitCircle(points: Array<[number, number]>): { cx: number; cy: number; r: number } {
    // Normal equations for [D, E, F].
    const ata = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const atb = [0, 0, 0];
    for (const [x, y] of points) {
        const row = [x, y, 1];
        const rhs = -(x * x + y * y);
        for (let i = 0; i < 3; i++) {
            atb[i] += row[i] * rhs;
            for (let j = 0; j < 3; j++) {
                ata[i][j] += row[i] * row[j];
            }
        }
    }
    const sol = solve3(ata, atb);
    if (!sol) {
        throw new RotaryCalibrationError('the readings do not determine a circle (are they all at the same B?)');
    }
    const [d, e, f] = sol;
    const cx = -d / 2;
    const cy = -e / 2;
    const r2 = cx * cx + cy * cy - f;
    if (!(r2 > 0)) {
        throw new RotaryCalibrationError('the readings do not lie on a circle');
    }
    return { cx, cy, r: Math.sqrt(r2) };
}

function circularMean(angles: number[]): number {
    let s = 0;
    let c = 0;
    for (const a of angles) {
        s += Math.sin(a);
        c += Math.cos(a);
    }
    return Math.atan2(s, c);
}

/** Smallest arc (degrees) containing every B angle, modulo 360. */
export function angularSpanDeg(bDeg: number[]): number {
    const sorted = bDeg.map((b) => ((b % 360) + 360) % 360).sort((x, y) => x - y);
    if (sorted.length < 2) {
        return 0;
    }
    let largestGap = 360 - sorted[sorted.length - 1] + sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        largestGap = Math.max(largestGap, sorted[i] - sorted[i - 1]);
    }
    return 360 - largestGap;
}

export interface CalibrationLimits {
    minPoints: number;
    minSpanDeg: number;
}

/** Fit a calibration from still readings at known controller B angles. */
export function fitRotaryCalibration(points: GravityPoint[], limits: CalibrationLimits): RotaryCalibration {
    if (points.length < limits.minPoints) {
        throw new RotaryCalibrationError(`need at least ${limits.minPoints} readings at different B angles, got ${points.length}`);
    }
    const spanDeg = angularSpanDeg(points.map((p) => p.bDeg));
    if (spanDeg < limits.minSpanDeg) {
        throw new RotaryCalibrationError(`the readings span only ${spanDeg.toFixed(1)} deg of B; spread them over at least ${limits.minSpanDeg} deg `
            + '(the axis direction and the rotation sense are fitted from that spread)');
    }
    const n = points.length;
    const origin: Vec3 = [0, 0, 0];
    for (const p of points) {
        origin[0] += p.g[0] / n;
        origin[1] += p.g[1] / n;
        origin[2] += p.g[2] / n;
    }
    const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of points) {
        const d = sub(p.g, origin);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                cov[i][j] += (d[i] * d[j]) / n;
            }
        }
    }
    const eig = symmetricEigen3(cov);
    if (!(eig.values[1] > 1e-6)) {
        throw new RotaryCalibrationError('the readings are collinear: gravity did not sweep a circle (did B actually turn between them?)');
    }
    const axis = unit(eig.vectors[0]);
    // e1 points from the centroid toward the first reading, in the plane.
    let first = sub(points[0].g, origin);
    first = sub(first, scale(axis, dot(first, axis)));
    if (norm(first) < 1e-9) {
        first = eig.vectors[2];
    }
    const e1 = unit(first);
    const e2 = cross(axis, e1);
    const planar: Array<[number, number]> = points.map((p) => {
        const d = sub(p.g, origin);
        return [dot(d, e1), dot(d, e2)];
    });
    const circle = fitCircle(planar);
    const theta = planar.map(([x, y]) => Math.atan2(y - circle.cy, x - circle.cx));
    const bRad = points.map((p) => (p.bDeg * Math.PI) / 180);
    const fitSense = (s: 1 | -1) => {
        const theta0 = circularMean(theta.map((t, i) => t - s * bRad[i]));
        const residuals = theta.map((t, i) => wrapRad(t - (theta0 + s * bRad[i])));
        const rms = Math.sqrt(residuals.reduce((acc, r) => acc + r * r, 0) / residuals.length);
        return { s, theta0, residuals, rms };
    };
    const plus = fitSense(1);
    const minus = fitSense(-1);
    const best = plus.rms <= minus.rms ? plus : minus;
    const other = best === plus ? minus : plus;
    const toDeg = 180 / Math.PI;
    return {
        axis,
        e1,
        e2,
        origin,
        centre: [circle.cx, circle.cy],
        radiusG: circle.r,
        sign: best.s,
        theta0Rad: best.theta0,
        axialG: dot(origin, axis),
        residualRmsDeg: best.rms * toDeg,
        residualMaxDeg: Math.max(...best.residuals.map((r) => Math.abs(r))) * toDeg,
        spanDeg,
        points: n,
        senseMarginDeg: (other.rms - best.rms) * toDeg,
    };
}

export interface AngleReading {
    /** The chuck's absolute angle (the calibration's B0 = 0), degrees in (-180, 180]. */
    absoluteDeg: number;
    /** In-plane gravity magnitude / the calibration radius: 1.00 for a still, unchanged mount. */
    radiusRatio: number;
    /** Gravity along the axis minus the calibration's, g: non-zero means the mount moved or the machine tilted. */
    axialShiftG: number;
}

/** The absolute angle of a still reading under a calibration. */
export function rotaryAngle(cal: RotaryCalibration, g: Vec3): AngleReading {
    const d = sub(g, cal.origin);
    const x = dot(d, cal.e1) - cal.centre[0];
    const y = dot(d, cal.e2) - cal.centre[1];
    const theta = Math.atan2(y, x);
    const b = cal.sign * wrapRad(theta - cal.theta0Rad);
    return {
        absoluteDeg: wrapDeg((b * 180) / Math.PI),
        radiusRatio: Math.sqrt(x * x + y * y) / cal.radiusG,
        axialShiftG: dot(g, cal.axis) - cal.axialG,
    };
}

/** Angular uncertainty (degrees, 1 sigma) of a reading whose in-plane mean has standard error `sigmaG`. */
export function angleSigmaDeg(cal: RotaryCalibration, sigmaG: number): number {
    return ((sigmaG / cal.radiusG) * 180) / Math.PI;
}
