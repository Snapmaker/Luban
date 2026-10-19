// Pure geometry for rounded corners (no server imports): the Kasa circle fit
// every circle-shaped measurement uses (probe_circle, probe_corner, the lobe
// analysis), the split of an ordered wall run into straight runs and a
// corner, and the geometry of an internal corner between two fitted walls -
// apex, bisector, the radius one bisector contact implies, the radial
// stations that sample the arc.
//
// Operator, 2026-09-21 (handoff §4 item 6): "rounded corners are the normal
// case, not a special one". Every wall tool assumed four straight sides
// meeting at points; a station that lands in the radius reads a blend. The
// pocket's chuck corners were r ~4-6 (not the r 5 assumed) and its lobes are
// irregular rounds that no circle fits well - which the residuals must say.
//
// Everything here is TIP-CENTRE geometry: the lines are the fitted tip-centre
// lines a wall follow returns, the arcs are tip-centre arcs. For an INTERNAL
// (pocket) corner the physical fillet radius is the tip-centre radius plus the
// tip radius; for an external (boss) corner it is minus. Only internal corners
// are planned here (the pocket case); the analysis functions work for both.

import { WallLineFit, Xy, fitWallLine } from './wallFollow';

const r3 = (v: number) => Number(v.toFixed(3));
const r4 = (v: number) => Number(v.toFixed(4));

export interface CircleFit {
    center: Xy;
    radius: number;
    /** Signed radial residual per point (positive = outside the fitted circle), 4 dp. */
    residuals: number[];
    rmsResidual: number;
    maxResidual: number;
    points: number;
}

/**
 * Kasa least-squares circle fit (the linear system x^2 + y^2 = 2ax + 2by + c
 * by normal equations, Gaussian elimination with pivoting). null when the
 * points are (nearly) collinear or fewer than three - a caller that needs an
 * arc turns that into its own refusal. Moved here from probeCircle.ts
 * unchanged in its arithmetic.
 */
export function fitCircle(contacts: Xy[]): CircleFit | null {
    const n = contacts.length;
    if (n < 3) {
        return null;
    }
    let sxx = 0; let sxy = 0; let syy = 0; let sx = 0; let sy = 0;
    let sxz = 0; let syz = 0; let sz = 0;
    for (const p of contacts) {
        const zz = p.x * p.x + p.y * p.y;
        sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y;
        sx += p.x; sy += p.y;
        sxz += p.x * zz; syz += p.y * zz; sz += zz;
    }
    const m = [
        [2 * sxx, 2 * sxy, sx, sxz],
        [2 * sxy, 2 * syy, sy, syz],
        [2 * sx, 2 * sy, n, sz],
    ];
    for (let col = 0; col < 3; col++) {
        let pivot = col;
        for (let row = col + 1; row < 3; row++) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
                pivot = row;
            }
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        if (Math.abs(m[col][col]) < 1e-12) {
            return null;
        }
        for (let row = 0; row < 3; row++) {
            if (row === col) {
                continue;
            }
            const factor = m[row][col] / m[col][col];
            for (let k = col; k < 4; k++) {
                m[row][k] -= factor * m[col][k];
            }
        }
    }
    const a = m[0][3] / m[0][0];
    const b = m[1][3] / m[1][1];
    const c = m[2][3] / m[2][2];
    const radius = Math.sqrt(Math.max(c + a * a + b * b, 0));
    if (!Number.isFinite(radius) || radius < 1e-9) {
        return null;
    }
    const residuals = contacts.map((p) => r4(Math.hypot(p.x - a, p.y - b) - radius));
    const rms = Math.sqrt(residuals.reduce((acc, r) => acc + r * r, 0) / n);
    return {
        center: { x: r3(a), y: r3(b) },
        radius: r4(radius),
        residuals,
        rmsResidual: r4(rms),
        maxResidual: r4(Math.max(...residuals.map((r) => Math.abs(r)))),
        points: n,
    };
}

export interface WallRunSplit {
    /** Straight run at the start of the ordered contacts (indices into the run) and its line, or null when fewer than two points fit. */
    lineA: { indices: number[]; fit: WallLineFit } | null;
    /** Straight run at the end. */
    lineB: { indices: number[]; fit: WallLineFit } | null;
    /**
     * Contacts between the two straight runs (plus the last point of each run,
     * which lies on the arc's tangent) and the circle through them. null when
     * the whole run is one straight wall; `arc` null when the corner points
     * are too few or collinear.
     */
    corner: { indices: number[]; arc: CircleFit | null } | null;
    /** How many points sit off BOTH lines: 0 = straight wall, 1-2 = a sharp corner, more = a radius worth sampling. */
    offLinePoints: number;
}

function residualFrom(fit: WallLineFit, p: Xy): number {
    return (p.x - fit.point.x) * fit.normal.x + (p.y - fit.point.y) * fit.normal.y;
}

function growLine(run: Xy[], order: number[], tolMm: number, marchDir: Xy): { indices: number[]; fit: WallLineFit } | null {
    // Grow from the first two points in `order`. Each candidate is judged by
    // its residual from the line through the points accepted SO FAR (not a
    // refit that includes it - a refit absorbs a gently curving wall point by
    // point and never notices the corner); once accepted the line is refitted.
    let accepted = order.slice(0, 2);
    let fit = fitWallLine(accepted.map((i) => run[i]), marchDir);
    if (!fit) {
        return null;
    }
    for (let k = 2; k < order.length; k++) {
        if (Math.abs(residualFrom(fit, run[order[k]])) > tolMm + 1e-9) {
            break;
        }
        const candidate = [...accepted, order[k]];
        const trial = fitWallLine(candidate.map((i) => run[i]), marchDir);
        if (!trial || trial.maxAbsMm > tolMm + 1e-9) {
            break;
        }
        accepted = candidate;
        fit = trial;
    }
    return { indices: accepted, fit };
}

/**
 * Split an ORDERED run of tip-centre contacts along a wall (a wall follow, a
 * pocket pass) into the straight run at each end and the corner between.
 * `lineTolMm` is the caller's: the largest residual a contact may have and
 * still be "on the wall" (a wall follow's own confirm spread is the floor).
 * A contact off the fitted line of its wall is re-classified as corner (the
 * operator's rule (a)); the corner's arc is fitted through those points and
 * the two tangent points. Not a bound on anything: pure classification.
 */
export function splitWallRun(run: Xy[], lineTolMm: number, marchDir: Xy = { x: 0, y: 0 }): WallRunSplit {
    const n = run.length;
    if (n < 2) {
        return { lineA: null, lineB: null, corner: null, offLinePoints: 0 };
    }
    const forward = run.map((_, i) => i);
    const backward = [...forward].reverse();
    const lineA = growLine(run, forward, lineTolMm, marchDir);
    const lineB = growLine(run, backward, lineTolMm, marchDir);
    const aEnd = lineA ? Math.max(...lineA.indices) : -1;
    const bStart = lineB ? Math.min(...lineB.indices) : n;
    if (lineA && lineA.indices.length === n) {
        return { lineA, lineB: null, corner: null, offLinePoints: 0 };
    }
    // Points on neither line are the corner; include the tangent points.
    const middle: number[] = [];
    for (let i = aEnd + 1; i < bStart; i++) {
        middle.push(i);
    }
    const offLinePoints = middle.length;
    const cornerIdx = [...(aEnd >= 0 ? [aEnd] : []), ...middle, ...(bStart < n ? [bStart] : [])];
    const arc = cornerIdx.length >= 3 ? fitCircle(cornerIdx.map((i) => run[i])) : null;
    return {
        lineA,
        lineB: lineB && lineB.indices.length >= 2 ? { indices: [...lineB.indices].sort((p, q) => p - q), fit: lineB.fit } : null,
        corner: offLinePoints || cornerIdx.length >= 3 ? { indices: cornerIdx, arc } : null,
        offLinePoints,
    };
}

/** A fitted tip-centre wall line: a point on it and the unit normal toward the FREE side. */
export interface WallLineSpec {
    point: Xy;
    normal: Xy;
}

export interface CornerGeometry {
    /** Intersection of the two tip-centre lines. */
    apex: Xy;
    /** Unit vector from the apex into the free space (the corner's bisector). */
    bisector: Xy;
    /** Interior angle between the two walls, degrees (90 for a square pocket corner). */
    interiorAngleDeg: number;
}

function unitOrNull(v: Xy): Xy | null {
    const len = Math.hypot(v.x, v.y);
    return len < 1e-9 ? null : { x: v.x / len, y: v.y / len };
}

/** Apex, bisector and interior angle of an INTERNAL corner between two tip-centre wall lines. null when the walls are parallel. */
export function cornerGeometry(a: WallLineSpec, b: WallLineSpec): CornerGeometry | null {
    const na = unitOrNull(a.normal);
    const nb = unitOrNull(b.normal);
    if (!na || !nb) {
        return null;
    }
    // Lines: n . p = n . point. Solve the 2x2 system.
    const det = na.x * nb.y - na.y * nb.x;
    if (Math.abs(det) < 1e-9) {
        return null;
    }
    const ca = na.x * a.point.x + na.y * a.point.y;
    const cb = nb.x * b.point.x + nb.y * b.point.y;
    const apex = { x: (ca * nb.y - cb * na.y) / det, y: (na.x * cb - nb.x * ca) / det };
    const sum = unitOrNull({ x: na.x + nb.x, y: na.y + nb.y });
    if (!sum) {
        return null;
    }
    const cosInterior = -(na.x * nb.x + na.y * nb.y);
    const interior = (Math.acos(Math.max(-1, Math.min(1, cosInterior))) * 180) / Math.PI;
    return { apex: { x: r3(apex.x), y: r3(apex.y) }, bisector: { x: r3(sum.x), y: r3(sum.y) }, interiorAngleDeg: r3(interior) };
}

/** Distance from the apex to the arc's mid-point on the bisector, for a tangent tip-centre arc of radius rho. */
export function bisectorReachFor(rhoTipCentre: number, interiorAngleDeg: number): number {
    const s = Math.sin((interiorAngleDeg / 2) * (Math.PI / 180));
    return r3(rhoTipCentre * (1 / s - 1));
}

/** Distance from the apex to the centre of a tangent tip-centre arc of radius rho. */
export function centreDistanceFor(rhoTipCentre: number, interiorAngleDeg: number): number {
    const s = Math.sin((interiorAngleDeg / 2) * (Math.PI / 180));
    return r3(rhoTipCentre / s);
}

/**
 * The tip-centre radius one bisector contact implies: a march along the
 * bisector toward the apex stops at distance `contactFromApexMm` from the
 * (tip-centre) apex; a tangent arc of radius rho has its mid-point at
 * rho (1/sin(theta/2) - 1). Zero or negative reach = a sharp corner.
 */
export function radiusFromBisectorContact(contactFromApexMm: number, interiorAngleDeg: number): number {
    const s = Math.sin((interiorAngleDeg / 2) * (Math.PI / 180));
    const k = 1 / s - 1;
    if (k < 1e-9) {
        return 0;
    }
    return r3(Math.max(0, contactFromApexMm) / k);
}

export interface RadialStation {
    index: number;
    label: string;
    azimuthDeg: number;
    /** Unit direction of the march from the arc centre. */
    unit: Xy;
}

/**
 * Radial stations from the arc centre spanning the arc between the two
 * tangent points: the direction from the centre to wall A's tangent point is
 * -normalA, to wall B's -normalB, and the arc runs the short way between
 * them through -bisector (toward the apex). Endpoints included.
 */
export function radialStations(a: WallLineSpec, b: WallLineSpec, bisector: Xy, count: number): RadialStation[] {
    const na = unitOrNull(a.normal) || { x: 0, y: 0 };
    const nb = unitOrNull(b.normal) || { x: 0, y: 0 };
    const toDeg = (v: Xy) => ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360;
    const startDeg = toDeg({ x: -na.x, y: -na.y });
    const endDeg = toDeg({ x: -nb.x, y: -nb.y });
    const midDeg = toDeg({ x: -bisector.x, y: -bisector.y });
    // Sweep from start to end the way that passes through mid.
    let sweep = ((endDeg - startDeg) % 360 + 360) % 360;
    const midRel = ((midDeg - startDeg) % 360 + 360) % 360;
    if (midRel > sweep + 1e-9) {
        sweep -= 360;
    }
    const n = Math.max(1, Math.round(count));
    const out: RadialStation[] = [];
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const deg = ((startDeg + sweep * t) % 360 + 360) % 360;
        const rad = (deg * Math.PI) / 180;
        out.push({ index: i, label: `r${i + 1}`, azimuthDeg: r3(deg), unit: { x: r3(Math.cos(rad)), y: r3(Math.sin(rad)) } });
    }
    return out;
}
