/* eslint-disable camelcase */
// Field names are the MCP surface's snake_case: they are stored, returned
// by get_stored_state and read by agents as reference paths (axis.x).
//
// The rotary axis as a LINE, not a scalar (issue #155). rotaryGeometry.ts
// used to hold one `rotary_axis_x` and one `rotary_axis_z_physical` for
// every Y, so a rotary yawed off machine Y (the operator's is ~1.2 deg, or
// ~1.2 mm over 250 mm - unresolved which) handed every op the same X
// whatever its Y station. The store now keeps the measured axis POINTS -
// `(x, z_physical)` at two or more Y stations, each with its source and
// date - and derives the line through them: yaw and pitch, and the x / z at
// any Y. The legacy scalars survive as the line's values at a reference Y.
//
// Pure: no config, no server imports, so the geometry is unit-tested apart
// from the store (tests/rotaryAxisLine.test.ts).

import { POSITION_EPSILON_MM } from './envelopeChecks';

export interface RotaryAxisPoint {
    /** Machine X of the axis at this station (side pair: (c90 + c270) / 2, tip-centre). */
    x: number;
    /** Machine Y of the station the pair was measured at. */
    y: number;
    /** PHYSICAL machine Z of the axis at this station (opposite tops: (top0 + top180 - T) / 2 - probe length). */
    z_physical: number;
    /** How this point was measured: job ids, probe length at measurement time, clamping. Never empty. */
    source: string;
    /** Epoch ms of the measurement; null when the record did not say. */
    measured_at: number | null;
}

export interface RotaryAxisLine {
    /** Machine X of the axis at reference_y. */
    x: number;
    /** PHYSICAL machine Z of the axis at reference_y. */
    z_physical: number;
    /**
     * The Y at which x / z_physical hold: the centroid of the measured
     * stations (where a least-squares line is exact). null when the skew is
     * unmeasured - then the scalars are the store's legacy values and hold
     * for every Y, which is the pre-#155 model, flagged as such.
     */
    reference_y: number | null;
    /** dX per mm of +Y along the line (0 when unmeasured). */
    dx_per_mm: number;
    /** dZ per mm of +Y along the line (0 when unmeasured). */
    dz_per_mm: number;
    /** Angle of the axis from machine +Y in the XY plane; positive = the axis drifts toward +X as Y increases. */
    yaw_deg: number;
    /** Angle of the axis from the XY plane; positive = the axis rises (+Z) as Y increases. */
    pitch_deg: number;
    /** 'measured' when two or more stations fixed the line; 'unmeasured' when only the legacy scalars exist. */
    skew: 'measured' | 'unmeasured';
    points: RotaryAxisPoint[];
    /** The fit the line came from (null when unmeasured): how many stations, their Y span, the worst residual. */
    fit: { stations: number; span_y_mm: number; max_residual_x_mm: number; max_residual_z_mm: number } | null;
}

/**
 * The seeded `axis` namespace a probe_program reads (axis.x, axis.z_contact,
 * ...). x / z_physical / z_contact hold at `at_y`: the op's own Y station
 * when the runner resolved them per op (axisNamespaceAt), else the line's
 * reference Y. z_contact = z_physical + probe_length, both in the documented
 * datum convention.
 */
export interface AxisNamespace {
    x: number;
    z_physical: number;
    /** Legacy axis Z plus probe offset; both must share the documented datum convention. */
    z_contact: number;
    tip_radius: number | null;
    probe_length: number;
    /** The Y the x / z values above hold at (null = skew unmeasured, same at every Y). */
    at_y: number | null;
    reference_y: number | null;
    yaw_deg: number;
    pitch_deg: number;
    dx_per_mm: number;
    dz_per_mm: number;
    skew: 'measured' | 'unmeasured';
}

export class RotaryAxisError extends Error {}

function round3(v: number): number {
    return Number(v.toFixed(3));
}

/** Slopes keep six decimals: 1e-6 mm/mm over the 400 mm of Y travel is 0.4 um, below everything else here. */
function round6(v: number): number {
    return Number(v.toFixed(6));
}

/** The pre-#155 model: one X and one Z for every Y, skew unmeasured. */
export function unmeasuredSkewLine(x: number, zPhysical: number): RotaryAxisLine {
    return {
        x,
        z_physical: zPhysical,
        reference_y: null,
        dx_per_mm: 0,
        dz_per_mm: 0,
        yaw_deg: 0,
        pitch_deg: 0,
        skew: 'unmeasured',
        points: [],
        fit: null,
    };
}

/** Least-squares slope and the value at the Y centroid for v(y). */
function fitLinear(points: { y: number; v: number }[]): { atCentroid: number; slope: number; maxResidual: number } {
    const n = points.length;
    const my = points.reduce((a, p) => a + p.y, 0) / n;
    const mv = points.reduce((a, p) => a + p.v, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        num += (p.y - my) * (p.v - mv);
        den += (p.y - my) * (p.y - my);
    }
    const slope = num / den;
    let maxResidual = 0;
    for (const p of points) {
        maxResidual = Math.max(maxResidual, Math.abs(p.v - (mv + slope * (p.y - my))));
    }
    return { atCentroid: mv, slope, maxResidual };
}

/**
 * The line through two or more measured axis points. Two stations fix it
 * exactly; more are fitted by least squares and the worst residual is
 * reported, so a station that disagrees with the others shows up as a
 * number rather than being averaged away silently. Stations closer in Y
 * than the position resolution are one station, not two: a line through
 * them would be noise.
 */
export function fitRotaryAxisLine(points: RotaryAxisPoint[]): RotaryAxisLine {
    if (points.length < 2) {
        throw new RotaryAxisError(`The rotary axis line needs at least two measured points at different Y stations (got ${points.length}).`);
    }
    const ys = points.map((p) => p.y).sort((a, b) => a - b);
    const span = ys[ys.length - 1] - ys[0];
    if (span <= POSITION_EPSILON_MM) {
        throw new RotaryAxisError(`The rotary axis points must sit at different Y stations: all ${points.length} are within `
            + `${POSITION_EPSILON_MM} mm of Y ${ys[0]} - measure the second station further along the axis.`);
    }
    for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] <= POSITION_EPSILON_MM) {
            throw new RotaryAxisError(`Two rotary axis points sit at the same Y station (${ys[i - 1]} and ${ys[i]}): keep one per station.`);
        }
    }
    const fx = fitLinear(points.map((p) => ({ y: p.y, v: p.x })));
    const fz = fitLinear(points.map((p) => ({ y: p.y, v: p.z_physical })));
    const referenceY = points.reduce((a, p) => a + p.y, 0) / points.length;
    return {
        x: round3(fx.atCentroid),
        z_physical: round3(fz.atCentroid),
        reference_y: round3(referenceY),
        dx_per_mm: round6(fx.slope),
        dz_per_mm: round6(fz.slope),
        yaw_deg: round3(Math.atan2(fx.slope, 1) * 180 / Math.PI),
        pitch_deg: round3(Math.atan2(fz.slope, 1) * 180 / Math.PI),
        skew: 'measured',
        points: [...points].sort((a, b) => a.y - b.y),
        fit: {
            stations: points.length,
            span_y_mm: round3(span),
            max_residual_x_mm: round3(fx.maxResidual),
            max_residual_z_mm: round3(fz.maxResidual),
        },
    };
}

/** The axis's machine X and physical Z at machine Y `y`. An unmeasured line answers the same at every Y. */
export function axisAt(line: RotaryAxisLine, y: number): { x: number; z_physical: number } {
    if (line.reference_y === null) {
        return { x: line.x, z_physical: line.z_physical };
    }
    const dy = y - line.reference_y;
    return { x: round3(line.x + line.dx_per_mm * dy), z_physical: round3(line.z_physical + line.dz_per_mm * dy) };
}

/** The `axis` namespace seeded before op 1: the line's values at its reference Y. */
export function axisNamespaceFor(line: RotaryAxisLine, probe: { effectiveLength: number; tipDiameter: number | null }): AxisNamespace {
    return {
        x: line.x,
        z_physical: line.z_physical,
        z_contact: round3(line.z_physical + probe.effectiveLength),
        tip_radius: probe.tipDiameter === null ? null : round3(probe.tipDiameter / 2),
        probe_length: probe.effectiveLength,
        at_y: line.reference_y,
        reference_y: line.reference_y,
        yaw_deg: line.yaw_deg,
        pitch_deg: line.pitch_deg,
        dx_per_mm: line.dx_per_mm,
        dz_per_mm: line.dz_per_mm,
        skew: line.skew,
    };
}

/**
 * The same namespace evaluated at an op's own Y station: x, z_physical and
 * z_contact move along the line; everything else is unchanged. An
 * unmeasured skew returns the namespace as it is (at_y stays null: the
 * values are not known to hold at that Y, they are simply the only ones).
 */
export function axisNamespaceAt(axis: AxisNamespace, y: number): AxisNamespace {
    if (axis.skew !== 'measured' || axis.reference_y === null) {
        return axis;
    }
    const dy = y - axis.reference_y;
    const x = round3(axis.x + axis.dx_per_mm * dy);
    const zPhysical = round3(axis.z_physical + axis.dz_per_mm * dy);
    return {
        ...axis,
        x,
        z_physical: zPhysical,
        z_contact: round3(zPhysical + axis.probe_length),
        at_y: round3(y),
    };
}

/**
 * Validate one point as an agent states it (set_probe_geometry
 * rotary_axis_point / rotary_axis_points[i]). `source` defaults to the
 * call's reason; `measured_at` accepts epoch ms or an ISO date and is
 * stored as epoch ms. Ranges are the store's own field ranges, passed in
 * so this module stays free of the store.
 */
export function normaliseAxisPoint(
    raw: unknown,
    where: string,
    ranges: { x: [number, number]; y: [number, number]; z: [number, number] },
    defaultSource: string
): RotaryAxisPoint {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RotaryAxisError(`${where}: must be an object {x, y, z_physical, source?, measured_at?}.`);
    }
    const o = raw as { x?: unknown; y?: unknown; z_physical?: unknown; source?: unknown; measured_at?: unknown };
    const check = (value: unknown, name: string, range: [number, number]): number => {
        const n = Number(value);
        if (value === undefined || value === null || value === '' || !Number.isFinite(n) || n < range[0] || n > range[1]) {
            throw new RotaryAxisError(`${where}.${name} must be a machine coordinate in ${range[0]}..${range[1]} (got ${JSON.stringify(value)}).`);
        }
        return n;
    };
    const x = check(o.x, 'x', ranges.x);
    const y = check(o.y, 'y', ranges.y);
    const zPhysical = check(o.z_physical, 'z_physical', ranges.z);
    const source = String(o.source === undefined || o.source === null ? defaultSource : o.source).trim();
    if (!source) {
        throw new RotaryAxisError(`${where}.source: say how this point was measured (job ids, probe length at the time, clamping).`);
    }
    let measuredAt: number | null = null;
    if (o.measured_at !== undefined && o.measured_at !== null && o.measured_at !== '') {
        const n = typeof o.measured_at === 'number' ? o.measured_at : Date.parse(String(o.measured_at));
        if (!Number.isFinite(n) || n <= 0) {
            throw new RotaryAxisError(`${where}.measured_at must be epoch milliseconds or an ISO date (got ${JSON.stringify(o.measured_at)}).`);
        }
        measuredAt = n;
    }
    return { x, y, z_physical: zPhysical, source, measured_at: measuredAt };
}
