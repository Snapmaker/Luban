/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (the planners take the
// probe_surface_path / probe_surface_grid arguments verbatim).
//
// Pure planning and statistics for the top-surface scans (probe_surface_path
// / probe_surface_grid). NO server imports on purpose: this module has no
// machine, feed or config dependency so it can be compiled alone and
// unit-tested under plain node (see the development workflow in README.md);
// its only import is the equally pure procedureLimits.ts. The machine-facing
// plan builders and the runner live in probeSurface.ts.
import {
    MAX_GRID_LINES_PER_AXIS,
    MAX_GRID_STATIONS,
    MAX_PATH_LENGTH_MM,
    MIN_DROP_MM,
    MIN_HOP_MM,
    MIN_PATH_LENGTH_MM,
} from './procedureLimits';

/** Path stations above this only WARN on the confirm page (duration, event budget); the ceiling is the grid's. */
export const MANY_STATIONS = 60;
export const MAX_PATH_STATIONS = MAX_GRID_STATIONS;
//
// The safety envelope these helpers enforce is the operator's, verbatim
// (2026-09-05): "with the grid we need the point to point variation to not
// risk the probe toolhead so no more than 20mm z safe delta from the top
// (within a horizontal change of 60mm)". Hence the two hard caps below - a
// request beyond them is refused, never clamped silently.

/** Operator-authorised ceiling for the between-station retract (mm above the last contact). */
export const Z_SAFE_DELTA_MAX_MM = 20;
export const Z_SAFE_DELTA_DEFAULT_MM = 20;
export const Z_SAFE_DELTA_MIN_MM = 3;
/** Operator-authorised ceiling for the horizontal distance between consecutive stations. */
export const MAX_HOP_CAP_MM = 60;
export const MAX_HOP_DEFAULT_MM = 60;
/** How far below the previous contact one station's march may search (a pocket floor). */
export const MAX_DROP_CAP_MM = 80;
export const MAX_DROP_DEFAULT_MM = 40;
/** Hops are executed in sensor-checked segments no longer than this. */
export const HOP_SEGMENT_MM = 10;

export interface SurfaceStation {
    /** 1-based execution order. */
    index: number;
    /** Human key: "s3" on a path, "r2c4" on a grid (row = Y line, col = X line). */
    label: string;
    x: number;
    y: number;
    /** Path stations: distance along the path from the start (mm). */
    s?: number;
    /** Grid stations: zero-based row (Y index) / col (X index). */
    row?: number;
    col?: number;
    /** Horizontal distance from the previous station (0 for the first). */
    hopFromPreviousMm: number;
}

export class SurfacePlanError extends Error {}

const round3 = (v: number): number => Number(v.toFixed(3));

function requireFinite(value: unknown, name: string): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new SurfacePlanError(`${name} must be a finite number.`);
    }
    return n;
}

/**
 * Resolve the three envelope parameters against their hard caps. Anything
 * above a cap is REFUSED (the operator picks the numbers, the code never
 * widens them), anything below the sensible minimum too.
 */
export function resolveEnvelope(args: {
    z_safe_delta_mm?: unknown;
    max_hop_mm?: unknown;
    max_drop_mm?: unknown;
}): { zSafeDeltaMm: number; maxHopMm: number; maxDropMm: number } {
    const zSafe = args.z_safe_delta_mm === undefined ? Z_SAFE_DELTA_DEFAULT_MM : requireFinite(args.z_safe_delta_mm, 'z_safe_delta_mm');
    if (zSafe > Z_SAFE_DELTA_MAX_MM + 1e-9) {
        throw new SurfacePlanError(`z_safe_delta_mm ${zSafe} exceeds the operator-authorised maximum of `
            + `${Z_SAFE_DELTA_MAX_MM} mm (hop height above the last contact).`);
    }
    if (zSafe < Z_SAFE_DELTA_MIN_MM) {
        throw new SurfacePlanError(`z_safe_delta_mm must be at least ${Z_SAFE_DELTA_MIN_MM} mm.`);
    }
    const maxHop = args.max_hop_mm === undefined ? MAX_HOP_DEFAULT_MM : requireFinite(args.max_hop_mm, 'max_hop_mm');
    if (maxHop > MAX_HOP_CAP_MM + 1e-9) {
        throw new SurfacePlanError(`max_hop_mm ${maxHop} exceeds the operator-authorised maximum of `
            + `${MAX_HOP_CAP_MM} mm between consecutive stations.`);
    }
    if (maxHop < MIN_HOP_MM) {
        throw new SurfacePlanError(`max_hop_mm must be at least ${MIN_HOP_MM} mm.`);
    }
    const maxDrop = args.max_drop_mm === undefined ? MAX_DROP_DEFAULT_MM : requireFinite(args.max_drop_mm, 'max_drop_mm');
    if (maxDrop > MAX_DROP_CAP_MM + 1e-9) {
        throw new SurfacePlanError(`max_drop_mm ${maxDrop} exceeds the cap of ${MAX_DROP_CAP_MM} mm below the previous contact.`);
    }
    if (maxDrop < MIN_DROP_MM) {
        throw new SurfacePlanError(`max_drop_mm must be at least ${MIN_DROP_MM} mm.`);
    }
    return { zSafeDeltaMm: zSafe, maxHopMm: maxHop, maxDropMm: maxDrop };
}

/** Every consecutive pair must be within maxHopMm - refuse otherwise, naming the pair. */
export function assertHopsWithin(stations: SurfaceStation[], maxHopMm: number): number {
    let worst = 0;
    for (let i = 1; i < stations.length; i++) {
        const d = stations[i].hopFromPreviousMm;
        worst = Math.max(worst, d);
        if (d > maxHopMm + 1e-6) {
            throw new SurfacePlanError(`Stations ${stations[i - 1].label} -> ${stations[i].label} are ${d.toFixed(2)} mm apart, `
                + `over max_hop_mm ${maxHopMm}. The operator picks a closer spacing/pitch; the plan is never split silently.`);
        }
    }
    return round3(worst);
}

/**
 * Stations along a straight line. Either an end point or a direction +
 * length defines the segment; either a station count or a spacing defines
 * the sampling. Both ends are always stations.
 */
export function planPathStations(args: {
    start_x: unknown;
    start_y: unknown;
    end_x?: unknown;
    end_y?: unknown;
    dx?: unknown;
    dy?: unknown;
    length_mm?: unknown;
    stations?: unknown;
    spacing_mm?: unknown;
}): {
    stations: SurfaceStation[];
    start: { x: number; y: number };
    end: { x: number; y: number };
    unit: { x: number; y: number };
    lengthMm: number;
    spacingMm: number;
} {
    const sx = requireFinite(args.start_x, 'start_x');
    const sy = requireFinite(args.start_y, 'start_y');
    let ex: number;
    let ey: number;
    if (args.end_x !== undefined || args.end_y !== undefined) {
        ex = requireFinite(args.end_x, 'end_x');
        ey = requireFinite(args.end_y, 'end_y');
    } else {
        const dx = Number(args.dx) || 0;
        const dy = Number(args.dy) || 0;
        const norm = Math.hypot(dx, dy);
        if (norm < 1e-9) {
            throw new SurfacePlanError('Give either end_x/end_y or a direction dx/dy (at least one non-zero) with length_mm.');
        }
        const length = requireFinite(args.length_mm, 'length_mm');
        if (length <= 0) {
            throw new SurfacePlanError('length_mm must be positive.');
        }
        ex = sx + (dx / norm) * length;
        ey = sy + (dy / norm) * length;
    }
    const lengthMm = Math.hypot(ex - sx, ey - sy);
    if (lengthMm < MIN_PATH_LENGTH_MM) {
        throw new SurfacePlanError(`The path is under ${MIN_PATH_LENGTH_MM} mm long.`);
    }
    if (lengthMm > MAX_PATH_LENGTH_MM) {
        throw new SurfacePlanError(`The path is over ${MAX_PATH_LENGTH_MM} mm long - longer than the bed.`);
    }
    const unit = { x: (ex - sx) / lengthMm, y: (ey - sy) / lengthMm };

    let count: number;
    if (args.stations !== undefined) {
        count = Math.round(requireFinite(args.stations, 'stations'));
        // Station count is a time/event budget, not a safety line: above
        // MANY_STATIONS the confirm preview warns, the ceiling matches the grid's.
        if (count < 2 || count > MAX_PATH_STATIONS) {
            throw new SurfacePlanError(`stations must be 2-${MAX_PATH_STATIONS}.`);
        }
    } else if (args.spacing_mm !== undefined) {
        const spacing = requireFinite(args.spacing_mm, 'spacing_mm');
        if (spacing <= 0) {
            throw new SurfacePlanError('spacing_mm must be positive.');
        }
        // Spacing is a MAXIMUM: the length is divided evenly into steps no
        // larger than it, so both ends are covered (same rule as survey_bed).
        count = Math.max(1, Math.ceil(lengthMm / spacing - 1e-9)) + 1;
        if (count > MAX_PATH_STATIONS) {
            throw new SurfacePlanError(`spacing_mm ${spacing} over ${lengthMm.toFixed(1)} mm gives ${count} stations (max ${MAX_PATH_STATIONS}).`);
        }
    } else {
        throw new SurfacePlanError('Give either stations (count) or spacing_mm.');
    }
    const spacingMm = lengthMm / (count - 1);
    const stations: SurfaceStation[] = [];
    for (let i = 0; i < count; i++) {
        const s = spacingMm * i;
        stations.push({
            index: i + 1,
            label: `s${i + 1}`,
            x: round3(sx + unit.x * s),
            y: round3(sy + unit.y * s),
            s: round3(s),
            hopFromPreviousMm: i === 0 ? 0 : round3(spacingMm),
        });
    }
    return {
        stations,
        start: { x: round3(sx), y: round3(sy) },
        end: { x: round3(ex), y: round3(ey) },
        unit: { x: Number(unit.x.toFixed(6)), y: Number(unit.y.toFixed(6)) },
        lengthMm: round3(lengthMm),
        spacingMm: round3(spacingMm),
    };
}

function axisLines(min: number, max: number, pitch: unknown, count: unknown, axis: string): { values: number[]; pitchMm: number } {
    const span = max - min;
    if (!(span > 0)) {
        throw new SurfacePlanError(`${axis} extent is empty (min ${min}, max ${max}).`);
    }
    let intervals: number;
    if (count !== undefined) {
        const n = Math.round(requireFinite(count, `${axis}_count`));
        if (n < 2 || n > MAX_GRID_LINES_PER_AXIS) {
            throw new SurfacePlanError(`${axis}_count must be 2-${MAX_GRID_LINES_PER_AXIS}.`);
        }
        intervals = n - 1;
    } else if (pitch !== undefined) {
        const p = requireFinite(pitch, 'pitch_mm');
        if (p <= 0) {
            throw new SurfacePlanError('pitch_mm must be positive.');
        }
        // Pitch is a MAXIMUM: even division, both edges covered.
        intervals = Math.max(1, Math.ceil(span / p - 1e-9));
        if (intervals + 1 > MAX_GRID_LINES_PER_AXIS) {
            throw new SurfacePlanError(`pitch_mm ${p} over the ${axis} extent ${span.toFixed(1)} mm gives ${intervals + 1} lines (max ${MAX_GRID_LINES_PER_AXIS}).`);
        }
    } else {
        throw new SurfacePlanError(`Give pitch_mm or ${axis}_count.`);
    }
    const step = span / intervals;
    const values: number[] = [];
    for (let i = 0; i <= intervals; i++) {
        values.push(round3(min + step * i));
    }
    return { values, pitchMm: round3(step) };
}

/**
 * Serpentine grid: rows are lines of constant Y (ascending), each row walked
 * along X in alternating direction so consecutive stations are always one
 * pitch apart - including the row-to-row turn.
 */
export function planGridStations(args: {
    x_min?: unknown;
    x_max?: unknown;
    y_min?: unknown;
    y_max?: unknown;
    center_x?: unknown;
    center_y?: unknown;
    size_x_mm?: unknown;
    size_y_mm?: unknown;
    pitch_mm?: unknown;
    x_count?: unknown;
    y_count?: unknown;
}): {
    stations: SurfaceStation[];
    xs: number[];
    ys: number[];
    pitchXMm: number;
    pitchYMm: number;
    bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
} {
    let xMin: number;
    let xMax: number;
    let yMin: number;
    let yMax: number;
    const hasExtents = args.x_min !== undefined || args.x_max !== undefined || args.y_min !== undefined || args.y_max !== undefined;
    const hasCentre = args.center_x !== undefined || args.center_y !== undefined || args.size_x_mm !== undefined || args.size_y_mm !== undefined;
    if (hasExtents && hasCentre) {
        throw new SurfacePlanError('Give EITHER x_min/x_max/y_min/y_max OR center_x/center_y/size_x_mm/size_y_mm, not both.');
    }
    if (hasExtents) {
        xMin = requireFinite(args.x_min, 'x_min');
        xMax = requireFinite(args.x_max, 'x_max');
        yMin = requireFinite(args.y_min, 'y_min');
        yMax = requireFinite(args.y_max, 'y_max');
    } else if (hasCentre) {
        const cx = requireFinite(args.center_x, 'center_x');
        const cy = requireFinite(args.center_y, 'center_y');
        const sxm = requireFinite(args.size_x_mm, 'size_x_mm');
        const sym = args.size_y_mm === undefined ? sxm : requireFinite(args.size_y_mm, 'size_y_mm');
        if (sxm <= 0 || sym <= 0) {
            throw new SurfacePlanError('size_x_mm / size_y_mm must be positive.');
        }
        xMin = cx - sxm / 2;
        xMax = cx + sxm / 2;
        yMin = cy - sym / 2;
        yMax = cy + sym / 2;
    } else {
        throw new SurfacePlanError('Give the region: x_min/x_max/y_min/y_max, or center_x/center_y/size_x_mm[/size_y_mm].');
    }
    const xAxis = axisLines(xMin, xMax, args.pitch_mm, args.x_count, 'x');
    const yAxis = axisLines(yMin, yMax, args.pitch_mm, args.y_count, 'y');
    if (xAxis.values.length * yAxis.values.length > MAX_GRID_STATIONS) {
        throw new SurfacePlanError(`${xAxis.values.length} x ${yAxis.values.length} = ${xAxis.values.length * yAxis.values.length} stations (max ${MAX_GRID_STATIONS}).`);
    }
    const stations: SurfaceStation[] = [];
    let previous: { x: number; y: number } | null = null;
    yAxis.values.forEach((y, row) => {
        const cols = xAxis.values.map((x, col) => ({ x, col }));
        const ordered = row % 2 === 0 ? cols : [...cols].reverse();
        for (const { x, col } of ordered) {
            stations.push({
                index: stations.length + 1,
                label: `r${row + 1}c${col + 1}`,
                x,
                y,
                row,
                col,
                hopFromPreviousMm: previous ? round3(Math.hypot(x - previous.x, y - previous.y)) : 0,
            });
            previous = { x, y };
        }
    });
    return {
        stations,
        xs: xAxis.values,
        ys: yAxis.values,
        pitchXMm: xAxis.pitchMm,
        pitchYMm: yAxis.pitchMm,
        bounds: { xMin: round3(xMin), xMax: round3(xMax), yMin: round3(yMin), yMax: round3(yMax) },
    };
}

/**
 * Where a station's -Z march may search: from the hop height (reference +
 * z_safe_delta) down to reference - max_drop, but never below the plan's
 * absolute floor. `reference` is the last real contact (or start_z_machine
 * for the first station, whose march starts AT start_z, not above it).
 */
export function stationEnvelope(
    reference: number,
    isFirst: boolean,
    startZ: number,
    env: { zSafeDeltaMm: number; maxDropMm: number; absoluteFloorZ: number }
): { marchStartZ: number; floorZ: number; travelMm: number } {
    const marchStartZ = isFirst ? startZ : round3(reference + env.zSafeDeltaMm);
    const floorZ = round3(Math.max(reference - env.maxDropMm, env.absoluteFloorZ));
    return { marchStartZ, floorZ, travelMm: round3(marchStartZ - floorZ) };
}

/**
 * Where the fine steps take over on a march, given the expected contact
 * (previous station's Z, or expected_z_machine for station 1): the SLOW ZONE
 * runs from expected + slow_zone_mm down to expected - (slow_zone_mm + 2 x
 * coarse), expressed in s (mm below the march start). Coarse steps never
 * cross into it; below it coarse resumes (a pocket edge costs seconds, not
 * minutes). null = no expected contact, or the zone lies wholly outside the
 * march: coarse all the way (capped at 1 mm by coarseStepFor).
 *
 * Why (operator, 2026-09-05, job d8f6ec1b5c11): a coarse step is executed
 * whole by the controller before the runner sees the probe, so the coarse
 * ladder presses the probe past contact by up to a FULL coarse step (0.4 mm
 * at station 1 with 2 mm steps, worst case 2 mm) - the same problem
 * run_tool_setter's slow_zone_mm already solves.
 */
export function slowZoneFor(
    startZ: number,
    expectedContactZ: number | null,
    slowZoneMm: number,
    coarseStepMm: number,
    travelMm: number
): { topS: number; bottomS: number } | null {
    if (expectedContactZ === null) {
        return null;
    }
    const topS = Math.max(0, round3(startZ - (expectedContactZ + slowZoneMm)));
    const bottomS = Math.min(travelMm, round3(startZ - (expectedContactZ - (slowZoneMm + 2 * coarseStepMm))));
    if (topS >= travelMm - 1e-9 || bottomS <= topS + 1e-9) {
        return null;
    }
    return { topS, bottomS };
}

/** Coarse step actually used on a march: capped at 1 mm when nothing bounds the press. */
export function coarseStepFor(plan: { coarseStepMm: number }, hasExpectedContact: boolean): number {
    return hasExpectedContact ? plan.coarseStepMm : Math.min(plan.coarseStepMm, 1);
}

/** Split a hop into equal segments no longer than HOP_SEGMENT_MM (sensor-checked between). */
export function hopSegments(
    from: { x: number; y: number },
    to: { x: number; y: number },
    segmentMm: number = HOP_SEGMENT_MM
): { x: number; y: number }[] {
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    if (d < 1e-9) {
        return [];
    }
    const n = Math.max(1, Math.ceil(d / segmentMm - 1e-9));
    const out: { x: number; y: number }[] = [];
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        out.push(i === n
            ? { x: to.x, y: to.y }
            : { x: round3(from.x + (to.x - from.x) * t), y: round3(from.y + (to.y - from.y) * t) });
    }
    return out;
}

// ---------------------------------------------------------------- statistics

export interface ContactSample {
    x: number;
    y: number;
    z: number;
    s?: number;
    label: string;
}

export interface ZSummary {
    count: number;
    zMin: number;
    zMax: number;
    zRange: number;
    zMean: number;
    highest: string;
    lowest: string;
    /** Machine XY of the highest / lowest contact (mcp/48: locates a cylinder's crown or a face's high edge by reference). */
    highestAt: { x: number; y: number };
    lowestAt: { x: number; y: number };
}

export function summarizeZ(samples: ContactSample[]): ZSummary | null {
    if (samples.length === 0) {
        return null;
    }
    let lo = samples[0];
    let hi = samples[0];
    let sum = 0;
    for (const p of samples) {
        sum += p.z;
        if (p.z < lo.z) {
            lo = p;
        }
        if (p.z > hi.z) {
            hi = p;
        }
    }
    return {
        count: samples.length,
        zMin: round3(lo.z),
        zMax: round3(hi.z),
        zRange: round3(hi.z - lo.z),
        zMean: round3(sum / samples.length),
        highest: hi.label,
        lowest: lo.label,
        highestAt: { x: hi.x, y: hi.y },
        lowestAt: { x: lo.x, y: lo.y },
    };
}

// ---------------------------------------------------------------- expected profiles

/**
 * Expected contact profile of a CYLINDER lying along machine Y (the rotary
 * axis): a circle in the XZ plane. `centerZContact` is the toolhead Z with
 * the probe tip on the axis line (axis.z_contact); `radius` the stock
 * radius; `tipRadius` the probe tip's. Toolhead Z at contact over lateral
 * offset d from the axis: the tip sphere's centre rides a circle of radius
 * R + rt about the axis, and the contact Z convention (toolhead Z with the
 * tip's lowest point on the surface) subtracts rt again -
 * z(d) = centerZContact + sqrt((R + rt)^2 - d^2) - rt, so z(0) = centre + R.
 */
export interface CircleProfile {
    kind: 'circle';
    centerX: number;
    centerZContact: number;
    radius: number;
    tipRadius: number;
}

/** Contact angle limit: beyond ~45 deg from the crown the tip glances and the side channel would read a crash. */
export const CIRCLE_MAX_OFFSET_FRACTION = 0.7;

export function circleExpectedZ(profile: CircleProfile, x: number): number | null {
    const d = x - profile.centerX;
    const r = profile.radius + profile.tipRadius;
    if (Math.abs(d) > profile.radius * CIRCLE_MAX_OFFSET_FRACTION + 1e-9 || Math.abs(d) >= r) {
        return null;
    }
    return round3(profile.centerZContact + Math.sqrt(r * r - d * d) - profile.tipRadius);
}

export interface LineFit {
    /** z = intercept + slope * s */
    intercept: number;
    slope: number;
    slopeMmPer100Mm: number;
    slopeDeg: number;
    /** end-to-end rise predicted by the fit over the sampled length. */
    riseOverLengthMm: number;
    residuals: { label: string; mm: number }[];
    rmsResidualMm: number;
    maxResidualMm: number;
    /** Peak-to-valley of the residuals = flatness relative to the best-fit line. */
    flatnessMm: number;
}

/** Least-squares line z(s) over path samples (needs >= 2 distinct s). */
export function fitLine(samples: ContactSample[]): LineFit | null {
    const pts = samples.filter((p) => p.s !== undefined);
    if (pts.length < 2) {
        return null;
    }
    const n = pts.length;
    const meanS = pts.reduce((a, p) => a + (p.s as number), 0) / n;
    const meanZ = pts.reduce((a, p) => a + p.z, 0) / n;
    let sxx = 0;
    let sxz = 0;
    for (const p of pts) {
        const ds = (p.s as number) - meanS;
        sxx += ds * ds;
        sxz += ds * (p.z - meanZ);
    }
    if (sxx < 1e-12) {
        return null;
    }
    const slope = sxz / sxx;
    const intercept = meanZ - slope * meanS;
    const residuals = pts.map((p) => ({ label: p.label, mm: round3(p.z - (intercept + slope * (p.s as number))) }));
    const rms = Math.sqrt(residuals.reduce((a, r) => a + r.mm * r.mm, 0) / n);
    const resValues = residuals.map((r) => r.mm);
    const sMin = Math.min(...pts.map((p) => p.s as number));
    const sMax = Math.max(...pts.map((p) => p.s as number));
    return {
        intercept: Number(intercept.toFixed(4)),
        slope: Number(slope.toFixed(6)),
        slopeMmPer100Mm: round3(slope * 100),
        slopeDeg: Number((Math.atan(slope) * 180 / Math.PI).toFixed(3)),
        riseOverLengthMm: round3(slope * (sMax - sMin)),
        residuals,
        rmsResidualMm: Number(rms.toFixed(4)),
        maxResidualMm: round3(Math.max(...resValues.map((r) => Math.abs(r)))),
        flatnessMm: round3(Math.max(...resValues) - Math.min(...resValues)),
    };
}

export interface PlaneFit {
    /** z = a + b*x + c*y */
    a: number;
    b: number;
    c: number;
    tiltXMmPer100Mm: number;
    tiltYMmPer100Mm: number;
    tiltXDeg: number;
    tiltYDeg: number;
    residuals: { label: string; mm: number }[];
    rmsResidualMm: number;
    maxResidualMm: number;
    /** Peak-to-valley of the residuals = flatness relative to the best-fit plane. */
    flatnessMm: number;
}

/** Least-squares plane over >= 3 non-collinear samples (normal equations, 3x3). */
export function fitPlane(samples: ContactSample[]): PlaneFit | null {
    const n = samples.length;
    if (n < 3) {
        return null;
    }
    // Centre the data for conditioning.
    const mx = samples.reduce((a, p) => a + p.x, 0) / n;
    const my = samples.reduce((a, p) => a + p.y, 0) / n;
    const mz = samples.reduce((a, p) => a + p.z, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    let sxz = 0;
    let syz = 0;
    for (const p of samples) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dz = p.z - mz;
        sxx += dx * dx;
        sxy += dx * dy;
        syy += dy * dy;
        sxz += dx * dz;
        syz += dy * dz;
    }
    const det = sxx * syy - sxy * sxy;
    if (Math.abs(det) < 1e-9) {
        return null; // collinear in XY - no plane
    }
    const b = (sxz * syy - syz * sxy) / det;
    const c = (syz * sxx - sxz * sxy) / det;
    const a = mz - b * mx - c * my;
    const residuals = samples.map((p) => ({ label: p.label, mm: round3(p.z - (a + b * p.x + c * p.y)) }));
    const resValues = residuals.map((r) => r.mm);
    const rms = Math.sqrt(resValues.reduce((acc, r) => acc + r * r, 0) / n);
    return {
        a: Number(a.toFixed(4)),
        b: Number(b.toFixed(6)),
        c: Number(c.toFixed(6)),
        tiltXMmPer100Mm: round3(b * 100),
        tiltYMmPer100Mm: round3(c * 100),
        tiltXDeg: Number((Math.atan(b) * 180 / Math.PI).toFixed(3)),
        tiltYDeg: Number((Math.atan(c) * 180 / Math.PI).toFixed(3)),
        residuals,
        rmsResidualMm: Number(rms.toFixed(4)),
        maxResidualMm: round3(Math.max(...resValues.map((r) => Math.abs(r)))),
        flatnessMm: round3(Math.max(...resValues) - Math.min(...resValues)),
    };
}

/** rows = ys (ascending), cols = xs (ascending); null where no contact. */
export function buildZMatrix(
    xs: number[],
    ys: number[],
    cells: { row: number; col: number; z: number | null }[]
): (number | null)[][] {
    const matrix: (number | null)[][] = ys.map(() => xs.map(() => null as number | null));
    for (const c of cells) {
        if (c.row >= 0 && c.row < ys.length && c.col >= 0 && c.col < xs.length) {
            matrix[c.row][c.col] = c.z === null ? null : round3(c.z);
        }
    }
    return matrix;
}

/**
 * Compact text height map: a numeric table of Z relative to the highest
 * contact (0.000 = highest, negatives lower; "  --  " = no contact), rows
 * printed with the LARGEST Y first so the picture is oriented like the bed
 * seen from above (+Y away), plus a one-character shade per cell.
 */
export function renderHeightMap(xs: number[], ys: number[], matrix: (number | null)[][]): string {
    const values: number[] = [];
    matrix.forEach((row) => row.forEach((z) => {
        if (z !== null) {
            values.push(z);
        }
    }));
    if (values.length === 0) {
        return 'no contacts';
    }
    const zMax = Math.max(...values);
    const zMin = Math.min(...values);
    const range = zMax - zMin;
    const shades = '.:-=+*#%@';
    const cellW = 8;
    const pad = (text: string, w: number) => (text.length >= w ? text : ' '.repeat(w - text.length) + text);
    const lines: string[] = [];
    lines.push(`Z relative to the highest contact (${zMax.toFixed(3)}); range ${range.toFixed(3)} mm; rows = machine Y (top = +Y), cols = machine X`);
    lines.push(`${pad('Y \\ X', 9)}${xs.map((x) => pad(x.toFixed(1), cellW)).join('')}   shade`);
    for (let r = ys.length - 1; r >= 0; r--) {
        const cells = matrix[r].map((z) => (z === null ? pad('--', cellW) : pad((z - zMax).toFixed(3), cellW)));
        const shade = matrix[r].map((z) => {
            if (z === null) {
                return '?';
            }
            const level = range < 1e-9 ? shades.length - 1 : Math.round(((z - zMin) / range) * (shades.length - 1));
            return shades[Math.min(shades.length - 1, Math.max(0, level))];
        }).join('');
        lines.push(`${pad(ys[r].toFixed(1), 9)}${cells.join('')}   ${shade}`);
    }
    lines.push(`shade: '.' = lowest (${zMin.toFixed(3)}) ... '@' = highest (${zMax.toFixed(3)}); '?' = no contact`);
    return lines.join('\n');
}

/** Path rendering: one line per station with a bar proportional to height above the lowest. */
export function renderPathProfile(samples: { label: string; s: number; z: number | null }[]): string {
    const zs = samples.map((p) => p.z).filter((z): z is number => z !== null);
    if (zs.length === 0) {
        return 'no contacts';
    }
    const zMax = Math.max(...zs);
    const zMin = Math.min(...zs);
    const range = zMax - zMin;
    const width = 30;
    return samples.map((p) => {
        const label = `${p.label.padEnd(4)} s=${p.s.toFixed(1).padStart(7)}`;
        if (p.z === null) {
            return `${label}  no contact`;
        }
        const bars = range < 1e-9 ? width : Math.round(((p.z - zMin) / range) * width);
        return `${label}  z=${p.z.toFixed(3)}  ${(p.z - zMax).toFixed(3).padStart(7)}  |${'#'.repeat(bars)}`;
    }).join('\n');
}
