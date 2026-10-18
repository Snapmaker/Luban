// The safe toolhead height over the rotary module, computed from what has
// been measured instead of the ceiling.
//
// The A350's rotary keep-out is a legacy 'toolhead'-basis landmark: its
// clearance has a tool length baked in (a ~73 mm touch probe, the longest
// thing ever fitted), so every crossing goes to the top of travel whatever is
// actually in the spindle. When the pieces are known the height is not a
// guess:
//
//   physical top = max(stock top, chuck top, tailstock top)   (machine Z)
//   toolhead Z   = physical top + live tool protrusion + margin
//
// where the stock top is the rotary axis + the part's radius (or a stated top
// Z), and the chuck / tailstock tops are rotary GEOMETRY (amendment R5 of the
// multi-machine plan), not landmark naming conventions. The stock is a
// per-call argument - a property of the job, never a stored knob.
//
// Any unknown falls back to the conservative height (the machine's safe
// traverse Z), and the result names each measurement that would lower it in
// terms of the tool an agent would call. Nothing here ever makes a height
// LOWER than the fallback on partial knowledge.
//
// Pure: no server imports, unit-tested in tests/rotaryClearance.test.ts.
// Nothing calls it yet; the planners are wired to it separately (WP8).
import { ObstacleBox, POSITION_EPSILON_MM } from './envelopeChecks';
import { CLEARANCE_MARGIN_MM } from './landmarkClearance';

/** A part held between the chuck and the tailstock, as the caller states it for this job. */
export interface RotaryStock {
    /** Radius of the part about the rotary axis (its largest radius along the span). */
    radiusMm: number;
    /** PHYSICAL machine Z of the part's top, when measured directly; overrides axisZ + radius. */
    topZ?: number | null;
}

export interface RotarySafeHeightInputs {
    /** PHYSICAL machine Z of the rotary axis (rotary_axis_z_physical). */
    axisZ: number | null;
    /** Machine Y of the chuck face; reported, used by rotaryKeepOutBox, not needed for the height. */
    chuckFaceY: number | null;
    /** Machine Y of the tailstock centre; reported, used by rotaryKeepOutBox, not needed for the height. */
    tailstockY: number | null;
    /** PHYSICAL machine Z of the top of the chuck end (chuck body, jaws at their widest, headstock housing). */
    chuckTopZ: number | null;
    /** PHYSICAL machine Z of the top of the tailstock bracket. */
    tailstockTopZ: number | null;
    /** The part in the chuck for this call; null = not stated, and an unknown part has an unknown top. */
    stock: RotaryStock | null;
    /** How far the fitted tool hangs below the toolhead (clearanceContext.currentToolProtrusion().mm). */
    toolProtrusionMm: number | null;
    /** Head-room above the physical top; defaults to landmarkClearance's CLEARANCE_MARGIN_MM. */
    marginMm?: number;
    /** The conservative height used whenever the computation cannot be trusted (the machine's safe traverse Z). */
    fallbackZ: number;
}

export type RotaryClearanceBasis = 'computed' | 'fallback';

export interface RotarySafeHeight {
    /** The minimum toolhead machine Z over the rotary. */
    zMm: number;
    basis: RotaryClearanceBasis;
    /** max(stock top, chuck top, tailstock top), when every one of them is known; else null. */
    physicalTopZ: number | null;
    components: {
        stockTopZ: number | null;
        stockTopFrom: 'radius' | 'top_z' | null;
        chuckTopZ: number | null;
        tailstockTopZ: number | null;
        toolProtrusionMm: number | null;
        marginMm: number;
        /** physicalTopZ + protrusion + margin, kept even when it lost to the fallback; null when not computable. */
        computedZ: number | null;
        fallbackZ: number;
        span: { chuckFaceY: number | null; tailstockY: number | null };
    };
    reasons: string[];
    /** Each measurement that would lower the height, phrased as what to call; empty when computed. */
    wouldLowerIf: string[];
    /**
     * False when the measured geometry says even the fallback height does not
     * clear the rotary by the margin: a caller must refuse, not traverse at
     * fallbackZ. true when computed; null when not computable.
     */
    clearsAtFallback: boolean | null;
}

function known(v: number | null | undefined): v is number {
    return typeof v === 'number' && Number.isFinite(v);
}

function round3(v: number): number {
    return Number(v.toFixed(3));
}

/** The advice strings, kept as exported constants so tests and docs match the tool names exactly. */
export const WOULD_LOWER = {
    protrusion: 'measure the tool with run_tool_setter (against a verified setter reference), or state it with '
        + 'set_active_tool protrusion_reference toolhead (tool protrusion unknown)',
    axisZ: 'state the rotary axis height with set_probe_geometry (rotary_axis_z_physical)',
    stock: 'pass stock.radius_mm for the part in the chuck (stock top unknown)',
    chuckTop: 'state the rotary chuck top Z with set_probe_geometry (rotary_chuck_top_z)',
    tailstockTop: 'state the rotary tailstock bracket top Z with set_probe_geometry (rotary_tailstock_top_z)',
} as const;

/**
 * The toolhead Z that clears the rotary, from measured geometry when every
 * input is known and consistent, else the fallback with the reasons.
 */
export function rotarySafeHeight(inputs: RotarySafeHeightInputs): RotarySafeHeight {
    const { axisZ, chuckFaceY, tailstockY, chuckTopZ, tailstockTopZ, stock, toolProtrusionMm, fallbackZ } = inputs;
    if (!known(fallbackZ)) {
        throw new RangeError(`rotarySafeHeight: fallbackZ must be a finite machine Z (got ${fallbackZ})`);
    }
    const marginMm = inputs.marginMm === undefined ? CLEARANCE_MARGIN_MM : inputs.marginMm;
    const reasons: string[] = [];
    const wouldLowerIf: string[] = [];

    if (!known(marginMm) || marginMm < 0) {
        reasons.push(`margin ${marginMm} mm is not a non-negative number`);
    }
    const protrusion = known(toolProtrusionMm) && toolProtrusionMm > 0 ? toolProtrusionMm : null;
    if (protrusion === null) {
        reasons.push(known(toolProtrusionMm)
            ? `tool protrusion ${toolProtrusionMm} mm is not a positive length`
            : 'tool protrusion is unknown');
        wouldLowerIf.push(WOULD_LOWER.protrusion);
    }
    const axis = known(axisZ) ? axisZ : null;
    if (axis === null) {
        reasons.push('rotary axis physical Z is unknown');
        wouldLowerIf.push(WOULD_LOWER.axisZ);
    }

    // The stock top. A part in the chuck surrounds the axis, so its top is at
    // or above it; a stated top below the axis is a mis-stated number.
    let stockTopZ: number | null = null;
    let stockTopFrom: 'radius' | 'top_z' | null = null;
    if (!stock) {
        reasons.push('no stock was stated for this call, so the top of the part in the chuck is unknown');
        wouldLowerIf.push(WOULD_LOWER.stock);
    } else if (known(stock.topZ)) {
        if (axis !== null && stock.topZ < axis - POSITION_EPSILON_MM) {
            reasons.push(`stock.top_z ${stock.topZ} is below the rotary axis Z ${axis}; a part held on the axis cannot be`);
            wouldLowerIf.push('re-state stock.top_z as the physical machine Z of the part\'s top (at or above the rotary axis), or pass stock.radius_mm');
        } else {
            stockTopZ = stock.topZ;
            stockTopFrom = 'top_z';
        }
    } else if (known(stock.radiusMm) && stock.radiusMm > 0) {
        if (axis !== null) {
            stockTopZ = round3(axis + stock.radiusMm);
            stockTopFrom = 'radius';
        }
    } else {
        reasons.push(`stock.radius_mm ${stock.radiusMm} is not a positive length`);
        wouldLowerIf.push(WOULD_LOWER.stock);
    }

    // Hardware tops: the chuck and tailstock bracket stand around the axis, so
    // a physical top below it was stated wrong (likely a different datum).
    const hardwareTop = (value: number | null, label: string, advice: string): number | null => {
        if (!known(value)) {
            reasons.push(`${label} is unknown`);
            wouldLowerIf.push(advice);
            return null;
        }
        if (axis !== null && value < axis - POSITION_EPSILON_MM) {
            reasons.push(`${label} ${value} is below the rotary axis Z ${axis}; it must be the physical top of the hardware`);
            wouldLowerIf.push(`re-state it: ${advice}`);
            return null;
        }
        return value;
    };
    const chuck = hardwareTop(chuckTopZ, 'rotary chuck top Z', WOULD_LOWER.chuckTop);
    const tailstock = hardwareTop(tailstockTopZ, 'rotary tailstock top Z', WOULD_LOWER.tailstockTop);

    const components = {
        stockTopZ,
        stockTopFrom,
        chuckTopZ: chuck,
        tailstockTopZ: tailstock,
        toolProtrusionMm: protrusion,
        marginMm,
        computedZ: null as number | null,
        fallbackZ,
        span: { chuckFaceY: known(chuckFaceY) ? chuckFaceY : null, tailstockY: known(tailstockY) ? tailstockY : null },
    };
    const fallback = (physicalTopZ: number | null, clearsAtFallback: boolean | null): RotarySafeHeight => ({
        zMm: fallbackZ, basis: 'fallback', physicalTopZ, components, reasons, wouldLowerIf, clearsAtFallback,
    });

    if (reasons.length || stockTopZ === null || chuck === null || tailstock === null || protrusion === null) {
        reasons.push(`using the conservative fallback Z${fallbackZ}`);
        return fallback(null, null);
    }

    const physicalTopZ = Math.max(stockTopZ, chuck, tailstock);
    const computedZ = round3(physicalTopZ + protrusion + marginMm);
    components.computedZ = computedZ;
    if (computedZ > fallbackZ + POSITION_EPSILON_MM) {
        reasons.push(`the measured geometry needs toolhead Z${computedZ} (top ${physicalTopZ} + tool ${protrusion} `
            + `+ margin ${marginMm}), above the fallback Z${fallbackZ}: even the fallback does not clear the rotary `
            + 'by the margin with this tool and part - do not traverse over it');
        return fallback(physicalTopZ, false);
    }
    reasons.push(`computed from top ${physicalTopZ} (stock ${stockTopZ}, chuck ${chuck}, tailstock ${tailstock}) `
        + `+ tool ${protrusion} + margin ${marginMm}`);
    return {
        // Within the heartbeat epsilon of the fallback is the fallback itself.
        zMm: Math.min(computedZ, fallbackZ),
        basis: 'computed',
        physicalTopZ,
        components,
        reasons,
        wouldLowerIf: [],
        clearsAtFallback: true,
    };
}

/** What is known about the rotary's footprint on the bed (machine XY). */
export interface RotaryFootprint {
    /** Machine X of the rotary axis. */
    axisX: number | null;
    chuckFaceY: number | null;
    tailstockY: number | null;
    /**
     * Half the width (in X) of the widest hardware around the axis, when
     * stated. No such field is stored today, so X comes from the legacy box.
     */
    halfWidthMm?: number | null;
}

export interface RotaryKeepOutBox extends ObstacleBox {
    /** The computed height this box demands (= clearanceZ on the 'toolhead' basis). */
    requiredToolheadZ: number;
    basis: RotaryClearanceBasis;
    /**
     * Copied from the height result: false means even clearanceZ (the
     * fallback) does not clear the rotary with this tool and part, so a
     * crossing must be REFUSED, not planned at clearanceZ.
     */
    clearsAtFallback: boolean | null;
    extentFrom: { x: 'geometry' | 'legacy' | 'both'; y: 'geometry' | 'legacy' | 'both' };
}

type Extent = { lo: number; hi: number };

function union(a: Extent | null, b: Extent | null): Extent | null {
    if (!a) return b;
    if (!b) return a;
    return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };
}

function source(geometry: Extent | null, legacy: Extent | null): 'geometry' | 'legacy' | 'both' {
    if (geometry && legacy) return 'both';
    return geometry ? 'geometry' : 'legacy';
}

/**
 * The keep-out box the rotary safe height applies to: the UNION of the legacy
 * rotary landmark's box and whatever the geometry gives (Y over the chuck face
 * to tailstock span, X over axisX +/- halfWidthMm). The span runs face to
 * tailstock centre - it does not cover the headstock behind the face or the
 * bracket past the centre - so the box never shrinks below the legacy one.
 * null when neither a legacy box nor a complete geometry extent exists:
 * refuse rather than invent a footprint.
 *
 * The box is on the 'toolhead' basis with clearanceZ = result.zMm, because
 * zMm already includes the tool and the margin (a 'physical' box would add
 * them a second time).
 */
export function rotaryKeepOutBox(
    geometry: RotaryFootprint,
    result: RotarySafeHeight,
    legacy: ObstacleBox | null,
): RotaryKeepOutBox | null {
    const geoX = known(geometry.axisX) && known(geometry.halfWidthMm) && geometry.halfWidthMm > 0
        ? { lo: geometry.axisX - geometry.halfWidthMm, hi: geometry.axisX + geometry.halfWidthMm } : null;
    const geoY = known(geometry.chuckFaceY) && known(geometry.tailstockY)
        ? { lo: Math.min(geometry.chuckFaceY, geometry.tailstockY), hi: Math.max(geometry.chuckFaceY, geometry.tailstockY) } : null;
    const legX = legacy ? { lo: Math.min(legacy.machine.x0, legacy.machine.x1), hi: Math.max(legacy.machine.x0, legacy.machine.x1) } : null;
    const legY = legacy ? { lo: Math.min(legacy.machine.y0, legacy.machine.y1), hi: Math.max(legacy.machine.y0, legacy.machine.y1) } : null;
    const x = union(geoX, legX);
    const y = union(geoY, legY);
    if (!x || !y) {
        return null;
    }
    return {
        name: legacy?.name ?? 'rotary',
        machine: { x0: x.lo, y0: y.lo, x1: x.hi, y1: y.hi },
        clearanceZ: result.zMm,
        clearanceBasis: 'toolhead',
        mode: legacy?.mode ?? 'crossing',
        requiredToolheadZ: result.zMm,
        basis: result.basis,
        clearsAtFallback: result.clearsAtFallback,
        extentFrom: { x: source(geoX, legX), y: source(geoY, legY) },
    };
}

/**
 * Whether a computed rotary box may replace the legacy rotary landmark's
 * requirement: only when the height was COMPUTED from measured inputs and the
 * computed box covers the legacy box's whole extent (within the position
 * epsilon). Otherwise the legacy requirement stands - the A350 is unchanged
 * until the inputs exist.
 */
export function supersedesLegacy(legacy: ObstacleBox, computed: RotaryKeepOutBox | null): boolean {
    if (!computed || computed.basis !== 'computed') {
        return false;
    }
    const l = legacy.machine;
    const c = computed.machine;
    const e = POSITION_EPSILON_MM;
    return c.x0 <= Math.min(l.x0, l.x1) + e && c.x1 >= Math.max(l.x0, l.x1) - e
        && c.y0 <= Math.min(l.y0, l.y1) + e && c.y1 >= Math.max(l.y0, l.y1) - e;
}
