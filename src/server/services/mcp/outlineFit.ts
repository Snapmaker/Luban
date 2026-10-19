// Pure geometry for probe_stock_outline (no server imports): the top height
// from several samples with hole rejection, and a rectangle fit from side
// contacts - centre, size, yaw. Every number is a tip-CENTRE machine
// coordinate unless the tip diameter is supplied.

export type Side = 'west' | 'east' | 'south' | 'north';

export const SIDES: Side[] = ['west', 'east', 'south', 'north'];

/** Unit march direction for each side (toward the stock). */
export const SIDE_UNIT: { [side in Side]: { x: number; y: number } } = {
    west: { x: 1, y: 0 },
    east: { x: -1, y: 0 },
    south: { x: 0, y: 1 },
    north: { x: 0, y: -1 },
};

export interface TopSample {
    x: number;
    y: number;
    z: number | null;
    label: string;
}

export interface TopEstimate {
    /** Highest contact = the top surface (toolhead Z). */
    z: number | null;
    /** Samples lower than the top by more than the tolerance (a hole, a pocket, a chamfer). */
    holes: string[];
    /** Samples agreeing with the top within the tolerance. */
    agreeing: string[];
    missing: string[];
    spreadMm: number | null;
}

export function estimateTop(samples: TopSample[], holeToleranceMm: number): TopEstimate {
    const hits = samples.filter((s): s is TopSample & { z: number } => s.z !== null);
    if (!hits.length) {
        return { z: null, holes: [], agreeing: [], missing: samples.map((s) => s.label), spreadMm: null };
    }
    const top = Math.max(...hits.map((s) => s.z));
    const agreeing = hits.filter((s) => top - s.z <= holeToleranceMm + 1e-9);
    return {
        z: top,
        holes: hits.filter((s) => top - s.z > holeToleranceMm + 1e-9).map((s) => s.label),
        agreeing: agreeing.map((s) => s.label),
        missing: samples.filter((s) => s.z === null).map((s) => s.label),
        spreadMm: Number((top - Math.min(...agreeing.map((s) => s.z))).toFixed(3)),
    };
}

export interface SideContact {
    side: Side;
    label: string;
    /** Tip-centre machine coordinates of the contact (null = nothing within the travel). */
    x: number | null;
    y: number | null;
    z: number;
}

export interface SideFit {
    side: Side;
    contacts: number;
    /** Mean of the side's constant coordinate (x for west/east, y for south/north), tip centre. */
    mean: number | null;
    /** Slope of that coordinate along the side (mm per 100 mm), from >= 2 contacts. */
    slopePer100Mm: number | null;
}

export interface OutlineFit {
    sides: SideFit[];
    /** Tip-centre rectangle: centre and centre-to-centre size of the stylus-centre contacts. */
    centerMachine: { x: number | null; y: number | null };
    sizeMm: { x: number | null; y: number | null };
    /**
     * Physical size = centre-to-centre size MINUS the tip diameter: on opposite
     * EXTERNAL faces each stylus centre stops one tip radius outside its face
     * (on-box agent's correction 2026-09-06; the earlier "+ tip" was wrong).
     * The centre is unaffected. null without a stored tip diameter.
     */
    sizePhysicalMm: { x: number | null; y: number | null };
    /** Yaw about Z in degrees (+ = the +Y end of the stock is displaced toward +X), mean of the side slopes. */
    yawDeg: number | null;
    note: string;
}

function round3(v: number): number {
    return Number(v.toFixed(3));
}

function slopePer100(points: { s: number; v: number }[]): number | null {
    if (points.length < 2) {
        return null;
    }
    const n = points.length;
    const ms = points.reduce((a, p) => a + p.s, 0) / n;
    const mv = points.reduce((a, p) => a + p.v, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        num += (p.s - ms) * (p.v - mv);
        den += (p.s - ms) * (p.s - ms);
    }
    return den < 1e-12 ? null : round3((num / den) * 100);
}

export function fitOutline(contacts: SideContact[], tipDiameterMm: number | null): OutlineFit {
    const sides: SideFit[] = SIDES.map((side) => {
        const hits = contacts.filter((c) => c.side === side && c.x !== null && c.y !== null) as (SideContact & { x: number; y: number })[];
        if (!hits.length) {
            return { side, contacts: 0, mean: null, slopePer100Mm: null };
        }
        const alongY = side === 'west' || side === 'east';
        const values = hits.map((h) => (alongY ? h.x : h.y));
        const mean = round3(values.reduce((a, v) => a + v, 0) / values.length);
        // Slope of the side: x vs y for west/east, y vs x for south/north.
        const slope = slopePer100(hits.map((h) => (alongY ? { s: h.y, v: h.x } : { s: h.x, v: h.y })));
        return { side, contacts: hits.length, mean, slopePer100Mm: slope };
    });
    const by = (side: Side) => sides.find((s) => s.side === side) as SideFit;
    const west = by('west').mean;
    const east = by('east').mean;
    const south = by('south').mean;
    const north = by('north').mean;
    const cx = west !== null && east !== null ? round3((west + east) / 2) : null;
    const cy = south !== null && north !== null ? round3((south + north) / 2) : null;
    const sx = west !== null && east !== null ? round3(east - west) : null;
    const sy = south !== null && north !== null ? round3(north - south) : null;
    // Yaw: west/east slopes are dx/dy (positive = the +Y end sits toward +X);
    // south/north slopes are dy/dx, whose sign convention is the opposite for
    // the same rotation, so they enter negated.
    const yawSamples: number[] = [];
    for (const s of sides) {
        if (s.slopePer100Mm === null) {
            continue;
        }
        yawSamples.push(s.side === 'west' || s.side === 'east' ? s.slopePer100Mm : -s.slopePer100Mm);
    }
    const yawDeg = yawSamples.length
        ? Number((Math.atan((yawSamples.reduce((a, v) => a + v, 0) / yawSamples.length) / 100) * 180 / Math.PI).toFixed(3))
        : null;
    const parts: string[] = [];
    if (cx !== null && cy !== null) {
        parts.push(`centre (${cx}, ${cy}) machine`);
    } else if (cx !== null) {
        parts.push(`centre X ${cx} (Y needs both south and north)`);
    } else if (cy !== null) {
        parts.push(`centre Y ${cy} (X needs both west and east)`);
    }
    if (sx !== null || sy !== null) {
        parts.push(`size ${sx ?? '?'} x ${sy ?? '?'} mm centre-to-centre${tipDiameterMm !== null
            ? ` = ${sx === null ? '?' : round3(sx - tipDiameterMm)} x ${sy === null ? '?' : round3(sy - tipDiameterMm)} physical (minus the ${tipDiameterMm} mm tip)`
            : ' (physical = minus the tip diameter)'}`);
    }
    if (yawDeg !== null) {
        parts.push(`yaw ${yawDeg} deg`);
    }
    return {
        sides,
        centerMachine: { x: cx, y: cy },
        sizeMm: { x: sx, y: sy },
        sizePhysicalMm: {
            x: sx === null || tipDiameterMm === null ? null : round3(sx - tipDiameterMm),
            y: sy === null || tipDiameterMm === null ? null : round3(sy - tipDiameterMm),
        },
        yawDeg,
        note: parts.length ? `Outline: ${parts.join('; ')}. Tip-centre coordinates; each true face lies one tip radius INSIDE its contact (toward the stock).` : 'Outline: no side contacts.',
    };
}
