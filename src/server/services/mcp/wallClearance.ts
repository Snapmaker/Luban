/* eslint-disable camelcase */
// known_walls / wall_margin_mm / radial_tolerance_deg are MCP tool arguments (snake_case).
//
// Wall clearance at PLANNING time for a CAM probing program (handoff
// 2026-09-21 §4 item 0a): every station start and every link path must keep
// the probe TIP - a ball of the stored tip radius - at least `margin` clear of
// every wall the program knows about, and a corner arc is approached RADIALLY
// from its fitted centre, not axis-parallel along a wall that is curving away.
//
// Where the walls come from:
//  - `known_walls`: walls the agent DECLARES from measured data - an earlier
//    program's contacts (pocket pass 1: the chuck-end wall at Y 247.9), a
//    fitted corner arc (pass 2: r 3.9 at (-50.98, -24.24) model). A start or a
//    link inside tip radius + margin of one of these REFUSES the program: the
//    pass-2 generator placed station 68's start 0.5 mm from a wall it had
//    measured the day before, and the 1.25 mm tip could not fit.
//  - the program's own (PROBE nominal= normal=) metadata: a side march's
//    nominal with a horizontal normal describes the wall the station expects,
//    and nominals of one group with the same normal span a segment of it.
//    These are CAD intent, of unknown extent, so a start inside one WARNS on
//    the confirm page rather than refusing.
//
// No bound is invented here (memory: no-invented-bounds): the tip radius is
// the stored measurement, the margin is the caller's argument (a Range in
// procedureLimits.ts), radii and centres are the caller's fitted data. With
// no tip diameter stored the declared-wall check cannot be judged and the
// program is refused rather than passed (law 4's rule for an unknown tool).
//
// Pure: no server imports, unit-tested in tests/wallClearance.test.ts.

import { CamStep, Xyz } from './probeGcode';
import { MAX_KNOWN_WALLS, MAX_PROFILE_RADIUS_MM } from './procedureLimits';

export type Xy = { x: number; y: number };

export interface WallLine {
    name: string;
    kind: 'line';
    /** Endpoints of the wall SURFACE in the program frame (converted to machine by the planner). */
    a: Xy;
    b: Xy;
    /** Unit normal pointing to the FREE side (toward the probe's approach). */
    normal: Xy;
    /** Toolhead Z band the wall occupies; null = every Z. */
    zTop: number | null;
    zBottom: number | null;
    /** Declared (known_walls) or read off the program's own nominals. */
    source: 'declared' | 'nominal';
}

export interface WallArc {
    name: string;
    kind: 'arc';
    center: Xy;
    radius: number;
    /** Where the material is: 'outside' the arc (a pocket corner / lobe), 'inside' it (a boss). */
    material: 'inside' | 'outside';
    /** Angular sector of the arc (degrees, counter-clockwise from +X); null = full circle. */
    fromDeg: number | null;
    toDeg: number | null;
    zTop: number | null;
    zBottom: number | null;
    source: 'declared' | 'nominal';
}

export type KnownWall = WallLine | WallArc;

export class WallSpecError extends Error {}

const r3 = (v: number) => Number(v.toFixed(3));

function xy(raw: unknown, where: string): Xy {
    const o = (raw || {}) as { x?: unknown; y?: unknown };
    const x = Number(o.x);
    const y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new WallSpecError(`${where}: {x, y} must be finite numbers.`);
    }
    return { x, y };
}

function optionalZ(raw: unknown, where: string): number | null {
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
        throw new WallSpecError(`${where}: must be a finite toolhead Z.`);
    }
    return n;
}

/**
 * Validate the `known_walls` argument. `toMachine` maps a program-frame XY to
 * machine coordinates (identity for a machine-frame program).
 */
export function normalizeKnownWalls(raw: unknown, toMachine: (p: Xy) => Xy, where: string = 'known_walls'): KnownWall[] {
    if (raw === undefined || raw === null) {
        return [];
    }
    if (!Array.isArray(raw) || raw.length > MAX_KNOWN_WALLS) {
        throw new WallSpecError(`${where}: must be an array of up to ${MAX_KNOWN_WALLS} walls ({kind: "line", a, b, normal} or {kind: "arc", center, radius, material}).`);
    }
    return raw.map((item, index) => {
        const at = `${where}[${index}]`;
        if (!item || typeof item !== 'object') {
            throw new WallSpecError(`${at}: must be an object.`);
        }
        const o = item as { [key: string]: unknown };
        const name = String(o.name || `wall ${index + 1}`).trim().slice(0, 60);
        const zTop = optionalZ(o.z_top, `${at}.z_top`);
        const zBottom = optionalZ(o.z_bottom, `${at}.z_bottom`);
        if (zTop !== null && zBottom !== null && zBottom > zTop) {
            throw new WallSpecError(`${at}: z_bottom ${zBottom} is above z_top ${zTop}.`);
        }
        if (o.kind === 'arc') {
            const center = toMachine(xy(o.center, `${at}.center`));
            const radius = Number(o.radius);
            if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_PROFILE_RADIUS_MM) {
                throw new WallSpecError(`${at}: radius must be 0..${MAX_PROFILE_RADIUS_MM} mm (a fitted corner / lobe radius).`);
            }
            if (o.material !== 'inside' && o.material !== 'outside') {
                throw new WallSpecError(`${at}: material must be "outside" (a pocket corner or lobe: the free space is inside the arc) or "inside" (a boss).`);
            }
            const fromDeg = optionalZ(o.from_deg, `${at}.from_deg`);
            const toDeg = optionalZ(o.to_deg, `${at}.to_deg`);
            if ((fromDeg === null) !== (toDeg === null)) {
                throw new WallSpecError(`${at}: give both from_deg and to_deg (the arc's sector, counter-clockwise from +X) or neither.`);
            }
            return { name, kind: 'arc', center, radius: r3(radius), material: o.material, fromDeg, toDeg, zTop, zBottom, source: 'declared' } as WallArc;
        }
        if (o.kind !== undefined && o.kind !== 'line') {
            throw new WallSpecError(`${at}: kind must be "line" or "arc".`);
        }
        const a = toMachine(xy(o.a, `${at}.a`));
        const b = toMachine(xy(o.b, `${at}.b`));
        const n = xy(o.normal, `${at}.normal (unit vector toward the FREE side of the wall)`);
        const len = Math.hypot(n.x, n.y);
        if (len < 1e-9) {
            throw new WallSpecError(`${at}.normal: zero vector.`);
        }
        // The normal is in the program frame but a frame shift does not turn it.
        return { name, kind: 'line', a, b, normal: { x: n.x / len, y: n.y / len }, zTop, zBottom, source: 'declared' } as WallLine;
    });
}

function inZBand(wall: KnownWall, z: number, epsilon: number): boolean {
    if (wall.zTop !== null && z > wall.zTop + epsilon) {
        return false;
    }
    if (wall.zBottom !== null && z < wall.zBottom - epsilon) {
        return false;
    }
    return true;
}

function angleDeg(v: Xy): number {
    return ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360;
}

function inSector(wall: WallArc, p: Xy): boolean {
    if (wall.fromDeg === null || wall.toDeg === null) {
        return true;
    }
    const a = angleDeg({ x: p.x - wall.center.x, y: p.y - wall.center.y });
    const from = ((wall.fromDeg % 360) + 360) % 360;
    const span = ((wall.toDeg - wall.fromDeg) % 360 + 360) % 360 || 360;
    const rel = ((a - from) % 360 + 360) % 360;
    return rel <= span + 1e-9;
}

/**
 * Signed clearance of a tip-CENTRE point from a wall's surface: positive on
 * the free side, negative inside the material. null when the point is not
 * abreast of the wall (beyond a line's ends, outside an arc's sector).
 */
export function pointClearance(wall: KnownWall, p: Xy): number | null {
    if (wall.kind === 'arc') {
        if (!inSector(wall, p)) {
            return null;
        }
        const d = Math.hypot(p.x - wall.center.x, p.y - wall.center.y);
        return r3(wall.material === 'outside' ? wall.radius - d : d - wall.radius);
    }
    const t = { x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y };
    const len = Math.hypot(t.x, t.y);
    if (len > 1e-9) {
        const along = ((p.x - wall.a.x) * t.x + (p.y - wall.a.y) * t.y) / len;
        if (along < -1e-9 || along > len + 1e-9) {
            return null;
        }
    }
    return r3((p.x - wall.a.x) * wall.normal.x + (p.y - wall.a.y) * wall.normal.y);
}

/**
 * Lowest clearance of a tip-centre PATH from p0 to p1 (straight, at one Z)
 * from the wall, over the part of the path abreast of it. null when no part
 * of the path is. Sampled at both ends plus the interior extremum, which for
 * a line wall is an endpoint of the abreast part and for an arc the closest
 * / farthest point of the segment to the centre.
 */
export function segmentClearance(wall: KnownWall, p0: Xy, p1: Xy): number | null {
    const candidates: Xy[] = [];
    const d = { x: p1.x - p0.x, y: p1.y - p0.y };
    const len2 = d.x * d.x + d.y * d.y;
    if (wall.kind === 'line') {
        const t = { x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y };
        const tl = Math.hypot(t.x, t.y);
        if (tl > 1e-9 && len2 > 1e-18) {
            // Parameters where the path crosses the wall's end planes.
            for (const end of [wall.a, wall.b]) {
                const denom = (d.x * t.x + d.y * t.y) / tl;
                if (Math.abs(denom) > 1e-12) {
                    const s = (((end.x - p0.x) * t.x + (end.y - p0.y) * t.y) / tl) / denom;
                    if (s > 0 && s < 1) {
                        candidates.push({ x: p0.x + d.x * s, y: p0.y + d.y * s });
                    }
                }
            }
        }
    } else if (len2 > 1e-18) {
        // Closest point of the segment to the centre (arc with material outside
        // wants the FARTHEST point; that is an endpoint, already sampled).
        const s = Math.max(0, Math.min(1, ((wall.center.x - p0.x) * d.x + (wall.center.y - p0.y) * d.y) / len2));
        candidates.push({ x: p0.x + d.x * s, y: p0.y + d.y * s });
    }
    candidates.push(p0, p1);
    let min: number | null = null;
    for (const c of candidates) {
        const v = pointClearance(wall, c);
        if (v !== null && (min === null || v < min)) {
            min = v;
        }
    }
    return min;
}

export interface WallViolation {
    /** What was too close: a station start (the head parked at the cycle start) or the link path to it. */
    what: 'station-start' | 'link-path';
    line: number;
    station: string | null;
    wall: string;
    source: 'declared' | 'nominal';
    /** Clearance of the tip CENTRE from the wall surface (negative = inside the material). */
    clearanceMm: number;
    /** What it needed: tip radius + margin. */
    requiredMm: number;
    /** How far the tip's SURFACE is inside the required envelope (positive). */
    shortByMm: number;
    at: Xyz;
}

export interface RadialApproach {
    line: number;
    station: string | null;
    wall: string;
    /** Angle between the march direction and the radial from the arc centre at the target (deg). 0 = radial. */
    offRadialDeg: number;
}

export interface WallCheck {
    tipRadiusMm: number | null;
    marginMm: number;
    walls: KnownWall[];
    /** Against DECLARED walls: refuse the program. */
    violations: WallViolation[];
    /** Against the program's own nominal walls: warn on the confirm page. */
    warnings: WallViolation[];
    radial: RadialApproach[];
    /** Radial approaches whose off-radial angle exceeds the stated tolerance (only when one was given). */
    radialWarnings: RadialApproach[];
}

/**
 * The walls the program itself describes: every G38.2/G38.3 with a nominal
 * and a horizontal normal. Nominals of one (group, normal) cluster span one
 * segment (a straight wall probed at several points); a lone nominal is a
 * zero-length segment, abreast only of points within the tip's own width.
 */
export function nominalWalls(steps: CamStep[], topZMachine: number | null): WallLine[] {
    const clusters = new Map<string, { normal: Xy; points: Xyz[]; names: string[] }>();
    for (const step of steps) {
        if (step.kind !== 'probe' || !step.meta.nominal || !step.meta.normal) {
            continue;
        }
        const n = step.meta.normal;
        const len = Math.hypot(n.x, n.y, n.z);
        if (len < 1e-9 || Math.abs(n.z / len) >= 0.5) {
            continue; // a top or a steep face is not a wall the tip runs into sideways
        }
        const horiz = Math.hypot(n.x, n.y);
        const unit = { x: r3(n.x / horiz), y: r3(n.y / horiz) };
        const key = `${step.meta.group || `_${step.index}`}|${unit.x},${unit.y}`;
        const nominal = step.meta.nominal;
        const cluster = clusters.get(key) || { normal: unit, points: [], names: [] };
        cluster.points.push(nominal);
        cluster.names.push(step.meta.name || step.meta.id || String(step.index));
        clusters.set(key, cluster);
    }
    const out: WallLine[] = [];
    for (const [key, c] of clusters) {
        const tangent = { x: -c.normal.y, y: c.normal.x };
        const along = c.points.map((p) => p.x * tangent.x + p.y * tangent.y);
        const iMin = along.indexOf(Math.min(...along));
        const iMax = along.indexOf(Math.max(...along));
        // The wall plane sits at the MEAN normal offset of the cluster's nominals.
        const offsets = c.points.map((p) => p.x * c.normal.x + p.y * c.normal.y);
        const mean = offsets.reduce((s, v) => s + v, 0) / offsets.length;
        const shift = (p: Xyz): Xy => {
            const off = p.x * c.normal.x + p.y * c.normal.y;
            return { x: r3(p.x + (mean - off) * c.normal.x), y: r3(p.y + (mean - off) * c.normal.y) };
        };
        const zs = c.points.map((p) => p.z);
        out.push({
            name: `nominal ${key.split('|')[0]} (${c.names.length} point${c.names.length === 1 ? '' : 's'})`,
            kind: 'line',
            a: shift(c.points[iMin]),
            b: shift(c.points[iMax]),
            normal: c.normal,
            zTop: topZMachine === null ? Math.max(...zs) : topZMachine,
            zBottom: Math.min(...zs),
            source: 'nominal',
        });
    }
    return out;
}

export interface WallCheckInput {
    steps: CamStep[];
    /** Machine positions the head parks at before each probe cycle, and the link paths (at their Z) that get it there. */
    stationStarts: { stepIndex: number; line: number; station: string | null; at: Xyz }[];
    linkPaths: { line: number; station: string | null; from: Xyz; to: Xyz }[];
    declared: KnownWall[];
    nominal: WallLine[];
    tipRadiusMm: number | null;
    marginMm: number;
    radialToleranceDeg: number | null;
    /** The heartbeat's float noise for the Z band test. */
    epsilonMm: number;
}

export function checkWallClearance(input: WallCheckInput): WallCheck {
    const tipR = input.tipRadiusMm === null ? 0 : input.tipRadiusMm;
    const required = r3(tipR + input.marginMm);
    const violations: WallViolation[] = [];
    const warnings: WallViolation[] = [];
    const judge = (wall: KnownWall, what: WallViolation['what'], line: number, station: string | null, clearance: number | null, at: Xyz) => {
        if (clearance === null || clearance >= required - 1e-9) {
            return;
        }
        const v: WallViolation = {
            what, line, station, wall: wall.name, source: wall.source, clearanceMm: clearance, requiredMm: required, shortByMm: r3(required - clearance), at,
        };
        (wall.source === 'declared' ? violations : warnings).push(v);
    };
    const walls = [...input.declared, ...input.nominal];
    for (const wall of walls) {
        for (const s of input.stationStarts) {
            if (!inZBand(wall, s.at.z, input.epsilonMm)) {
                continue;
            }
            judge(wall, 'station-start', s.line, s.station, pointClearance(wall, s.at), s.at);
        }
        for (const l of input.linkPaths) {
            const z = Math.min(l.from.z, l.to.z);
            if (!inZBand(wall, z, input.epsilonMm)) {
                continue;
            }
            judge(wall, 'link-path', l.line, l.station, segmentClearance(wall, l.from, l.to), l.to);
        }
    }
    // Radial approach: a march whose target crosses a declared arc should run
    // along the radial through the crossing (outward for material outside).
    const radial: RadialApproach[] = [];
    for (const wall of input.declared) {
        if (wall.kind !== 'arc') {
            continue;
        }
        for (const step of input.steps) {
            if (step.kind !== 'probe' || (step.mode !== 'G38.2' && step.mode !== 'G38.3')) {
                continue;
            }
            if (!inZBand(wall, step.from.z, input.epsilonMm)) {
                continue;
            }
            const dx = step.target.x - step.from.x;
            const dy = step.target.y - step.from.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-9) {
                continue;
            }
            const startClear = pointClearance(wall, step.from);
            const endClear = pointClearance(wall, step.target);
            // The march must start on the free side and reach the material.
            if (startClear === null || endClear === null || startClear < 0 || endClear >= 0) {
                continue;
            }
            const u = { x: dx / len, y: dy / len };
            // The radial at the point where the march MEETS the arc (the
            // direction the tip approaches the surface), not at the target,
            // which is programmed well past it. Solve |from + u s - c| = r.
            const fx = step.from.x - wall.center.x;
            const fy = step.from.y - wall.center.y;
            const bHalf = fx * u.x + fy * u.y;
            const cc = fx * fx + fy * fy - wall.radius * wall.radius;
            const disc = bHalf * bHalf - cc;
            let hit = { x: step.target.x, y: step.target.y };
            if (disc >= 0) {
                const root = Math.sqrt(disc);
                const s = wall.material === 'outside' ? -bHalf + root : -bHalf - root;
                if (s > 0 && s <= len) {
                    hit = { x: step.from.x + u.x * s, y: step.from.y + u.y * s };
                }
            }
            const rx = hit.x - wall.center.x;
            const ry = hit.y - wall.center.y;
            const rl = Math.hypot(rx, ry) || 1;
            const outward = wall.material === 'outside' ? 1 : -1;
            const dot = Math.max(-1, Math.min(1, (u.x * rx + u.y * ry) / rl * outward));
            radial.push({
                line: step.line,
                station: step.meta.name || step.meta.id || String(step.index),
                wall: wall.name,
                offRadialDeg: r3((Math.acos(dot) * 180) / Math.PI),
            });
        }
    }
    const radialWarnings = input.radialToleranceDeg === null ? [] : radial.filter((r) => r.offRadialDeg > (input.radialToleranceDeg as number) + 1e-9);
    return { tipRadiusMm: input.tipRadiusMm, marginMm: input.marginMm, walls, violations, warnings, radial, radialWarnings };
}

export function describeWallViolation(v: WallViolation): string {
    const where = v.what === 'station-start' ? 'start' : 'link path';
    return `line ${v.line}${v.station ? ` station "${v.station}"` : ''} ${where}: tip centre ${v.clearanceMm < 0 ? `${-v.clearanceMm} mm INSIDE` : `${v.clearanceMm} mm from`} `
        + `${v.source === 'declared' ? 'known wall' : 'the program\'s own nominal wall'} "${v.wall}" - needs tip radius + margin = ${v.requiredMm} mm (short by ${v.shortByMm})`;
}
