// Where the TOOLHEAD can actually go, as a planner may assume it.
//
// Operator rule (2026-10-18, the Ray follow-up to #260): the travel comes
// from the CHOSEN MACHINE MODEL - the connected machine's profile size (Ray
// 600 x 400, A350 320 x 350) - plus a FUDGE at each end of each axis:
//
//     allowed range per axis = [0 - fudge, size + fudge]
//
// Real homes sit a little outside the nominal box: the Ray homes to about
// X-1 / Y399 against 600 x 400, the A350's frame runs X -19...339 / Y 0...342
// against 320 x 350 (home X-19, X339 found by sweep). The default fudge of
// 25 mm covers every one of those (-19 >= -25, 339 <= 345, 399 <= 425) and
// still refuses X650 on the Ray (> 625). It is ONE configurable setting
// (configstore mcpTravelFudgeMm / LUBAN_MCP_TRAVEL_FUDGE_MM, with per-axis
// overrides mcpTravelFudgeXMm / mcpTravelFudgeYMm), read by tools/machine.ts
// travelFudge(); this module just takes the numbers.
//
// Before this the travel was a global "stated" box (set_probe_geometry
// travel_*) widened by observed positions, which (a) was the A350's box
// applied to Ray coordinates and (b) let a wrong statement stand. Now:
//
//   1. MODEL  - size +/- fudge, always available for a known machine.
//   2. STATED - an operator-stated end, scoped to the machine it was stated
//      on, is honoured only as a TIGHTER override. A statement looser than
//      the model + fudge is reported and the model governs: the fudge is the
//      one knob for "my rig reaches further", not a per-end statement.
//
// An observed position outside the result is reported as a conflict (the
// position judge or the statement is wrong), never silently believed: the
// fudge already covers legitimate overtravel at home.
//
// Pure: no server imports, unit-tested in tests/machineTravel.test.ts.

export interface TravelLimits {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export type TravelSource = 'model' | 'stated';

export interface TravelEnd {
    value: number;
    source: TravelSource;
}

export interface TravelFudge {
    x: number;
    y: number;
}

export interface ResolvedTravel {
    limits: TravelLimits;
    ends: { xMin: TravelEnd; xMax: TravelEnd; yMin: TravelEnd; yMax: TravelEnd };
    /** The model box the limits derive from, for results and the confirm page; null for an unknown machine planned from statements alone. */
    model: { size: { x: number; y: number }; fudge: TravelFudge; limits: TravelLimits } | null;
    /** Statements looser than the model, and observed positions outside the result - neither is silently believed. */
    conflicts: string[];
}

export interface StatedTravel {
    xMin: number | null;
    xMax: number | null;
    yMin: number | null;
    yMax: number | null;
}

export interface TravelInput {
    /** The machine definition's size, or null when the machine is unknown. */
    size: { x: number; y: number } | null;
    /** The fudge applied at each end of each axis (tools/machine.ts travelFudge()). */
    fudge: TravelFudge;
    /** Operator-stated limits FOR THIS MACHINE; any end may be null (= not stated). Pass all-null when nothing is stated for it. */
    stated: StatedTravel;
    /** A position the toolhead is known to have occupied, if any. */
    observed: { x: number | null; y: number | null } | null;
}

/** The default fudge, in mm, at each end of each axis. See the header for why 25. */
export const DEFAULT_TRAVEL_FUDGE_MM = 25;

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
 * we, on every axis. A toolhead seen up to this far past an end is the result
 * of a permitted overtravel (the DRO corrects on the next sync), not a
 * conflict between the travel and reality.
 */
export const TRAVEL_OVERTRAVEL_MM = 1;

/** Is `value` beyond `limit` by more than float noise? */
function beyond(value: number, limit: number, end: 'low' | 'high'): boolean {
    return end === 'low' ? value < limit - TRAVEL_EPSILON_MM : value > limit + TRAVEL_EPSILON_MM;
}

/** The model box: size +/- fudge on each axis. */
export function modelTravel(size: { x: number; y: number }, fudge: TravelFudge): TravelLimits {
    return {
        xMin: Number((0 - fudge.x).toFixed(3)),
        xMax: Number((size.x + fudge.x).toFixed(3)),
        yMin: Number((0 - fudge.y).toFixed(3)),
        yMax: Number((size.y + fudge.y).toFixed(3)),
    };
}

function resolveEnd(
    stated: number | null,
    model: number | null,
    end: 'low' | 'high',
    axis: string,
    conflicts: string[]
): TravelEnd {
    const said = stated !== null && Number.isFinite(stated) ? stated : null;
    if (model === null) {
        // Unknown machine: the caller has checked every end is stated.
        return { value: said as number, source: 'stated' };
    }
    if (said === null) {
        return { value: model, source: 'model' };
    }
    const looser = end === 'low' ? said < model - TRAVEL_EPSILON_MM : said > model + TRAVEL_EPSILON_MM;
    if (looser) {
        conflicts.push(`The stated ${axis} ${end === 'low' ? 'minimum' : 'maximum'} ${said} is looser than the machine model plus `
            + `fudge (${model}); the model governs. Widen the travel fudge (mcpTravelFudgeMm) if this rig genuinely reaches there.`);
        return { value: model, source: 'model' };
    }
    return { value: said, source: 'stated' };
}

function noteObserved(axis: string, seen: number | null, min: number, max: number, conflicts: string[]): void {
    if (seen === null || !Number.isFinite(seen)) {
        return;
    }
    if (beyond(seen, min - TRAVEL_OVERTRAVEL_MM, 'low') || beyond(seen, max + TRAVEL_OVERTRAVEL_MM, 'high')) {
        conflicts.push(`The toolhead has been observed at ${axis} ${Number(seen.toFixed(3))}, outside the travel ${axis} ${min}..${max} `
            + `by more than the ${TRAVEL_OVERTRAVEL_MM} mm overtravel allowance. Either the position of record or the travel is wrong: `
            + 'check get_position, and widen the travel fudge (mcpTravelFudgeMm) only if the machine really reaches there.');
    }
}

/**
 * The travel a planner may use, or null when the machine is unknown and
 * not every end has been stated - in which case there is no honest box to
 * clamp to and the caller must refuse rather than guess one.
 */
export function resolveTravel(input: TravelInput): ResolvedTravel | null {
    const { size, stated, fudge } = input;
    const statedComplete = [stated.xMin, stated.xMax, stated.yMin, stated.yMax].every((v) => v !== null && Number.isFinite(v));
    if (!size && !statedComplete) {
        return null;
    }
    const model = size ? modelTravel(size, fudge) : null;
    const conflicts: string[] = [];
    const ends = {
        xMin: resolveEnd(stated.xMin, model ? model.xMin : null, 'low', 'X', conflicts),
        xMax: resolveEnd(stated.xMax, model ? model.xMax : null, 'high', 'X', conflicts),
        yMin: resolveEnd(stated.yMin, model ? model.yMin : null, 'low', 'Y', conflicts),
        yMax: resolveEnd(stated.yMax, model ? model.yMax : null, 'high', 'Y', conflicts),
    };
    const limits = { xMin: ends.xMin.value, xMax: ends.xMax.value, yMin: ends.yMin.value, yMax: ends.yMax.value };
    const observed = input.observed || { x: null, y: null };
    noteObserved('X', observed.x, limits.xMin, limits.xMax, conflicts);
    noteObserved('Y', observed.y, limits.yMin, limits.yMax, conflicts);
    return {
        limits,
        ends,
        model: size && model ? { size: { x: size.x, y: size.y }, fudge: { ...fudge }, limits: model } : null,
        conflicts,
    };
}

/** One line for results and refusals: "Ray model 600 x 400 + 25 mm fudge each end: X -25..625, Y -25..425". */
export function describeTravel(travel: ResolvedTravel, machineIdentifier: string | null): string {
    const l = travel.limits;
    const box = `X ${l.xMin}..${l.xMax}, Y ${l.yMin}..${l.yMax}`;
    if (!travel.model) {
        return `stated travel (unknown machine): ${box}`;
    }
    const m = travel.model;
    const fudge = m.fudge.x === m.fudge.y ? `${m.fudge.x} mm fudge each end` : `fudge X ${m.fudge.x} / Y ${m.fudge.y} mm each end`;
    const tightened = Object.values(travel.ends).some((e) => e.source === 'stated') ? '; tightened by an operator statement' : '';
    return `${machineIdentifier || 'machine'} model ${m.size.x} x ${m.size.y} + ${fudge}: ${box}${tightened}`;
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
