// Pure geometry for probe_wall_follow (no server imports): the station
// start-line points along a VERTICAL wall, and the line fit of the contacts
// with per-point residuals. Every number is a tip-CENTRE machine coordinate;
// the physical wall lies one tip radius further along the march direction.
//
// Operator request 2026-09-21 (handoff §4 item 1): pass 1 of the pocket
// retreated 25 mm to the start line after every wall contact and
// re-approached for the next station. Wanted: march to the wall, back off
// ~2 mm, step ALONG the wall at that standoff, march again - a
// probe_surface_path for vertical walls.

export type Xy = { x: number; y: number };

const r3 = (v: number) => Number(v.toFixed(3));

export function unit2(v: Xy): Xy | null {
    const len = Math.hypot(v.x, v.y);
    if (len < 1e-9) {
        return null;
    }
    return { x: v.x / len, y: v.y / len };
}

/**
 * The step-along direction: the caller's `along`, made perpendicular to the
 * march direction (its component along `dir` removed) and normalised; with
 * none given, `dir` rotated +90 degrees (counter-clockwise, seen from above).
 * null when `along` is parallel to `dir` - there is no wall direction in it.
 */
export function alongUnit(dir: Xy, along: Xy | null): Xy | null {
    if (!along) {
        return { x: r3(-dir.y), y: r3(dir.x) };
    }
    const dot = along.x * dir.x + along.y * dir.y;
    const perp = { x: along.x - dot * dir.x, y: along.y - dot * dir.y };
    const u = unit2(perp);
    return u ? { x: r3(u.x), y: r3(u.y) } : null;
}

export interface WallFollowStation {
    index: number;
    label: string;
    /** Point on the approved START LINE (machine XY) this station's corridor begins at. */
    start: Xy;
}

/** N start-line points from `start`, `stepMm` apart along `along`. */
export function wallFollowStations(start: Xy, along: Xy, stepMm: number, count: number): WallFollowStation[] {
    const out: WallFollowStation[] = [];
    for (let i = 0; i < count; i++) {
        out.push({ index: i, label: `w${i + 1}`, start: { x: r3(start.x + along.x * stepMm * i), y: r3(start.y + along.y * stepMm * i) } });
    }
    return out;
}

export interface WallLineFit {
    /** Centroid of the contacts. */
    point: Xy;
    /** Unit direction of the fitted line (principal axis), oriented along the step direction when one is given. */
    direction: Xy;
    /** Unit normal of the fitted line, pointing AGAINST the march (out of the material, toward the probe). */
    normal: Xy;
    /** Signed distance of each contact from the line along `normal` (positive = toward the probe, i.e. the wall bulges out here). */
    residualsMm: number[];
    rmsMm: number;
    maxAbsMm: number;
    /** Angle of the fitted line from machine +X, degrees, in (-90, 90]. */
    angleDeg: number;
    /** Angle between the fitted line and the step direction (yaw of the wall against the expected direction), degrees. */
    yawFromAlongDeg: number | null;
    points: number;
}

/**
 * Least-squares line through the contacts (principal axis of the 2x2
 * covariance - total least squares, so a wall along any direction fits
 * equally well). null with fewer than two points. The residual sign tells a
 * corner from a straight wall: a run of points pulling away from the line at
 * one end is the wall curving (handoff §4 item 6 reads these).
 */
export function fitWallLine(contacts: Xy[], marchDir: Xy, along: Xy | null = null): WallLineFit | null {
    if (contacts.length < 2) {
        return null;
    }
    const n = contacts.length;
    const cx = contacts.reduce((s, p) => s + p.x, 0) / n;
    const cy = contacts.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const p of contacts) {
        sxx += (p.x - cx) * (p.x - cx);
        sxy += (p.x - cx) * (p.y - cy);
        syy += (p.y - cy) * (p.y - cy);
    }
    // Largest eigenvector of [[sxx, sxy], [sxy, syy]].
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let direction = { x: Math.cos(theta), y: Math.sin(theta) };
    if (along && direction.x * along.x + direction.y * along.y < 0) {
        direction = { x: -direction.x, y: -direction.y };
    }
    let normal = { x: -direction.y, y: direction.x };
    if (normal.x * marchDir.x + normal.y * marchDir.y > 0) {
        normal = { x: -normal.x, y: -normal.y };
    }
    const residualsMm = contacts.map((p) => r3((p.x - cx) * normal.x + (p.y - cy) * normal.y));
    const rms = Math.sqrt(residualsMm.reduce((s, v) => s + v * v, 0) / n);
    let angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
    if (angle > 90) {
        angle -= 180;
    } else if (angle <= -90) {
        angle += 180;
    }
    let yaw: number | null = null;
    if (along) {
        const dot = Math.max(-1, Math.min(1, direction.x * along.x + direction.y * along.y));
        yaw = r3((Math.acos(Math.abs(dot)) * 180) / Math.PI);
    }
    return {
        point: { x: r3(cx), y: r3(cy) },
        direction: { x: r3(direction.x), y: r3(direction.y) },
        normal: { x: r3(normal.x), y: r3(normal.y) },
        residualsMm,
        rmsMm: r3(rms),
        maxAbsMm: r3(Math.max(...residualsMm.map((v) => Math.abs(v)))),
        angleDeg: r3(angle),
        yawFromAlongDeg: yaw,
        points: n,
    };
}
