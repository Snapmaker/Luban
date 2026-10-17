// Where the TOOLHEAD can actually go, as a planner may assume it.
//
// Nothing in the MCP knew this. `checkMotion` checks obstacles, and the
// position of record checks beats against the machine-definition size with a
// 50 mm slop - a sanity filter for garbage readings, deliberately loose, and
// never a statement about reachable travel. So a planner that wanted a band
// of XY to sweep had nothing to clamp against and invented its own slop:
// camera_bootstrap's search band used `max(-25, ...)` and `min(size.x + 40,
// ...)`, which on the A350 plans a first waypoint at X-25 when the travel
// stops at X-19 (live 2026-09-20). The procedure would have aborted on its
// first move, after an operator approval.
//
// The numbers vary per machine AND per rig: an A350's definition says
// 320 x 350, while its machine frame runs X -19...339 (home X-19, and X339
// found by sweep) and Y 0...342. A bracing kit, an Artisan, a re-homed
// firmware limit all move them again. So travel resolves in three layers,
// strongest first:
//
//   1. STATED - travel_x_min / travel_x_max / travel_y_min / travel_y_max in
//      the geometry store (set_probe_geometry, env-overridable). The
//      operator's measured limit for THIS rig.
//   2. OBSERVED - a position the machine has actually been at is proof that
//      point is reachable, so it widens an end nobody has stated. Home is the
//      usual source: an A350 sitting at X-19 has demonstrated X-19.
//   3. NOMINAL - the machine definition's size box, 0..size per axis.
//
// Evidence never overrides the operator: an observed position outside a
// STATED end is reported as a conflict rather than silently widening it,
// because one of the two is wrong and a planner should not pick.
//
// Pure: no server imports, unit-tested in tests/machineTravel.test.ts.

export interface TravelLimits {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export type TravelSource = 'stated' | 'observed' | 'nominal';

export interface TravelEnd {
    value: number;
    source: TravelSource;
}

export interface ResolvedTravel {
    limits: TravelLimits;
    ends: { xMin: TravelEnd; xMax: TravelEnd; yMin: TravelEnd; yMax: TravelEnd };
    /** Observed positions that contradict a stated limit - neither is silently believed. */
    conflicts: string[];
}

export interface TravelInput {
    /** The machine definition's size, or null when the machine is unknown. */
    size: { x: number; y: number } | null;
    /** Operator-stated limits; any end may be null (= not stated). */
    stated: { xMin: number | null; xMax: number | null; yMin: number | null; yMax: number | null };
    /** A position the toolhead is known to have occupied, if any. */
    observed: { x: number | null; y: number | null } | null;
}

/**
 * The heartbeat does not report round numbers: a machine homed to X-19 reports
 * X-19.00000610351563, and a 328 park reads 327.9989. Comparing travel ends
 * exactly makes every one of those a "conflict" or a widening of six microns,
 * which is how a real warning gets trained into noise. Same epsilon as the
 * clearance checks (envelopeChecks.POSITION_EPSILON_MM), kept local so this
 * module stays free of server imports.
 */
export const TRAVEL_EPSILON_MM = 0.05;

/**
 * Operator rule (2026-10-05): the machine accepts attempted overtravel, and so do
 * we, on every axis. A toolhead seen up to this far past a stated end is the
 * result of a permitted overtravel (the DRO corrects on the next sync), not a
 * conflict between the statement and reality.
 */
export const TRAVEL_OVERTRAVEL_MM = 1;

/** Is `value` beyond `limit` by more than float noise? */
function beyond(value: number, limit: number, end: 'low' | 'high'): boolean {
    return end === 'low' ? value < limit - TRAVEL_EPSILON_MM : value > limit + TRAVEL_EPSILON_MM;
}

function resolveEnd(
    stated: number | null,
    nominal: number,
    observed: number | null,
    widen: 'low' | 'high',
    axis: string,
    conflicts: string[]
): TravelEnd {
    const seen = observed !== null && Number.isFinite(observed) ? observed : null;
    if (stated !== null && Number.isFinite(stated)) {
        const allowance = widen === 'low' ? stated - TRAVEL_OVERTRAVEL_MM : stated + TRAVEL_OVERTRAVEL_MM;
        if (seen !== null && beyond(seen, allowance, widen)) {
            conflicts.push(`The toolhead has been observed at ${axis} ${Number(seen.toFixed(3))}, outside the stated `
                + `${axis} ${widen === 'low' ? 'minimum' : 'maximum'} of ${stated} by more than the ${TRAVEL_OVERTRAVEL_MM} mm overtravel allowance. One of the two is wrong: `
                + 're-state the travel limit, or find out how it got there.');
        }
        return { value: stated, source: 'stated' };
    }
    if (seen !== null && beyond(seen, nominal, widen)) {
        // Reachability is evidence: the machine went there.
        return { value: Number(seen.toFixed(3)), source: 'observed' };
    }
    return { value: nominal, source: 'nominal' };
}

/**
 * The travel a planner may use, or null when the machine is unknown and
 * nothing has been stated - in which case there is no honest box to clamp to
 * and the caller must refuse rather than guess one.
 */
export function resolveTravel(input: TravelInput): ResolvedTravel | null {
    const { size, stated } = input;
    const statedComplete = [stated.xMin, stated.xMax, stated.yMin, stated.yMax].every((v) => v !== null && Number.isFinite(v));
    if (!size && !statedComplete) {
        return null;
    }
    const observed = input.observed || { x: null, y: null };
    const conflicts: string[] = [];
    const ends = {
        xMin: resolveEnd(stated.xMin, size ? 0 : (stated.xMin as number), observed.x, 'low', 'X', conflicts),
        xMax: resolveEnd(stated.xMax, size ? size.x : (stated.xMax as number), observed.x, 'high', 'X', conflicts),
        yMin: resolveEnd(stated.yMin, size ? 0 : (stated.yMin as number), observed.y, 'low', 'Y', conflicts),
        yMax: resolveEnd(stated.yMax, size ? size.y : (stated.yMax as number), observed.y, 'high', 'Y', conflicts),
    };
    return {
        limits: { xMin: ends.xMin.value, xMax: ends.xMax.value, yMin: ends.yMin.value, yMax: ends.yMax.value },
        ends,
        conflicts,
    };
}

export interface ClampedBand {
    min: number;
    max: number;
    /** The reach that was asked for but lies outside the travel, per end, in mm. */
    clippedLowMm: number;
    clippedHighMm: number;
}

/**
 * A band of `reachMm` either side of `centre`, clamped into [min, max] and
 * SAYING what it lost. The clipping is reported rather than hidden because a
 * symmetric reach around an off-centre target is asymmetric in practice - a
 * tool setter 98 mm from the X minimum and 260 mm from the maximum cannot be
 * searched evenly, and a planner that quietly halves the request leaves
 * someone wondering why the thing was never found.
 */
export function clampBand(centre: number, reachMm: number, min: number, max: number): ClampedBand {
    if (max < min) {
        throw new Error(`Travel maximum ${max} is below its minimum ${min}.`);
    }
    const wanted = { low: centre - reachMm, high: centre + reachMm };
    const low = Math.min(Math.max(wanted.low, min), max);
    const high = Math.max(Math.min(wanted.high, max), min);
    return {
        min: Number(low.toFixed(3)),
        max: Number(high.toFixed(3)),
        clippedLowMm: Number(Math.max(0, min - wanted.low).toFixed(3)),
        clippedHighMm: Number(Math.max(0, wanted.high - max).toFixed(3)),
    };
}

/** One sentence per axis that lost reach, for the staging result and the confirm page. */
export function describeClipping(axis: string, band: ClampedBand): string | null {
    const parts: string[] = [];
    if (band.clippedLowMm > 0) {
        parts.push(`${band.clippedLowMm} mm below ${axis}${band.min}`);
    }
    if (band.clippedHighMm > 0) {
        parts.push(`${band.clippedHighMm} mm above ${axis}${band.max}`);
    }
    if (!parts.length) {
        return null;
    }
    return `${axis} reach clipped to the travel: ${parts.join(' and ')} is unreachable, so it was not planned.`;
}

export interface TravelPoint {
    x: number;
    y: number;
}

/**
 * Where a point lies outside the travel, or null when it is inside (float
 * noise tolerated). One clause per axis that overshoots, with the distance,
 * so the refusal says what to change: "X 355 is 16 mm beyond the X maximum
 * 339" tells the caller more than "outside the envelope".
 */
export function outsideTravel(point: TravelPoint, limits: TravelLimits): string | null {
    const clauses: string[] = [];
    const check = (axis: string, value: number, min: number, max: number) => {
        if (beyond(value, min, 'low')) {
            clauses.push(`${axis} ${Number(value.toFixed(3))} is ${Number((min - value).toFixed(3))} mm below the ${axis} minimum ${min}`);
        } else if (beyond(value, max, 'high')) {
            clauses.push(`${axis} ${Number(value.toFixed(3))} is ${Number((value - max).toFixed(3))} mm beyond the ${axis} maximum ${max}`);
        }
    };
    check('X', point.x, limits.xMin, limits.xMax);
    check('Y', point.y, limits.yMin, limits.yMax);
    return clauses.length ? clauses.join(' and ') : null;
}

/**
 * A march clipped to less than this by the travel is refused at staging
 * rather than planned: the toolhead is already at the end of the machine in
 * that direction, and a half-millimetre ladder finds nothing.
 */
export const MIN_USEFUL_MARCH_MM = 0.5;

export interface ClampedRay {
    /** The travel the march may actually make, mm along the unit vector. */
    travelMm: number;
    /** How much of the requested travel lies outside the limits, mm. */
    clippedMm: number;
    /** Which end stopped it, for the plan and the confirm page; null when nothing was clipped. */
    clippedBy: string | null;
}

/**
 * Shorten a march of `travelMm` from `start` along `unit` so its far end
 * stays inside the XY travel, and say which end it ran into. A march is a
 * sensor-gated move that stops on contact, but nothing stops it at the end
 * of the machine except the overtravel alarm, so its far limit is planned
 * inside the travel - and a march that had to be shortened is reported,
 * because a face the shortened march cannot reach is otherwise "no contact".
 * The scalar is clamped, never a single axis: clamping per axis would change
 * the direction.
 */
export function clampRay(start: TravelPoint, unit: TravelPoint, travelMm: number, limits: TravelLimits): ClampedRay {
    let allowed = travelMm;
    let clippedBy: string | null = null;
    const along = (axis: string, u: number, from: number, min: number, max: number) => {
        if (Math.abs(u) < 1e-9) {
            return;
        }
        const end = u > 0 ? max : min;
        const reach = (end - from) / u;
        if (reach < allowed) {
            allowed = Math.max(0, reach);
            clippedBy = `the ${axis} ${u > 0 ? 'maximum' : 'minimum'} ${end}`;
        }
    };
    along('X', unit.x, start.x, limits.xMin, limits.xMax);
    along('Y', unit.y, start.y, limits.yMin, limits.yMax);
    return {
        travelMm: Number(allowed.toFixed(3)),
        clippedMm: Number(Math.max(0, travelMm - allowed).toFixed(3)),
        clippedBy,
    };
}
