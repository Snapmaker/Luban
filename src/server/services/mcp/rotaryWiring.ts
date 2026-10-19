/* eslint-disable camelcase */
// Result fields are MCP tool results, snake_case by convention.
// The rotary safe height wired into the planners (tyeth/Luban#265 WP8, R5).
//
// rotaryClearance.ts computes the toolhead Z that clears the rotary from what
// has been measured: the per-machine rotary geometry (axis, chuck face,
// tailstock, chuck / tailstock tops - set_probe_geometry), the trusted live
// tool protrusion (clearanceContext.ts), and the part in the chuck, which is a
// per-call `stock` argument (memory: stock properties are per-program args,
// never a stored knob). This module decides what that height does to the
// obstacle list for ONE call:
//
//  - computed and supersedesLegacy(): the legacy rotary landmark box (a
//    toolhead-basis clearance with the longest tool baked in) is replaced by
//    the computed keep-out for the same extent;
//  - clearsAtFallback === false: even the fallback height (the machine's safe
//    traverse Z, 328 on the A350) does not clear this tool + stock by the
//    margin - the rotary box is raised to the computed height, ABOVE the
//    fallback, so any route that crosses it is refused by the planner (never
//    planned at 328); routes that do not cross it are untouched;
//  - anything else: the legacy requirement stands.
//
// Without a `stock` argument nothing changes (the height cannot be computed
// with the part unknown), so the A350 is unchanged unless the agent states the
// stock AND every measurement is present. The legacy box is identified by
// GEOMETRY, never by name: the one obstacle box over the rotary axis X whose Y
// extent overlaps the chuck-face..tailstock span. None or several -> nothing
// is superseded, and the report says why.
import { currentToolProtrusion } from './clearanceContext';
import { connectedMachineCapability, connectedMachineTag } from './connectedMachine';
import { ObstacleBox, POSITION_EPSILON_MM } from './envelopeChecks';
import { landmarkStore } from './landmarks';
import { McpToolError } from './registry';
import { ObstacleTransform } from './rotaryCallContext';
import { RotaryStock, RotarySafeHeight, rotaryKeepOutBox, rotarySafeHeight, supersedesLegacy } from './rotaryClearance';
import { rotaryGeometry } from './rotaryGeometry';
import { axisAt } from './rotaryAxisLine';
import { safeTraverseZ } from './tools/machine';

export { STOCK_ARG_SCHEMA } from './rotaryCallContext';

/** The tools that take `stock` (the plan's list: transport, the work-origin move, the vision nudge, probe programs). */
export const STOCK_TOOLS = new Set(['traverse_xy', 'goto_work_origin', 'move_and_capture', 'probe_program']);

/** Parse the `stock` argument; undefined/null = not stated. A malformed value is refused, never guessed. */
export function parseStockArg(raw: unknown): RotaryStock | null {
    if (raw === undefined || raw === null) {
        return null;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new McpToolError('stock must be an object {radius_mm, top_z?}.');
    }
    const { radius_mm: radius, top_z: top } = raw as { radius_mm?: unknown; top_z?: unknown };
    const radiusMm = Number(radius);
    const topZ = top === undefined || top === null ? null : Number(top);
    if (topZ !== null && !Number.isFinite(topZ)) {
        throw new McpToolError(`stock.top_z must be a machine Z (got ${String(top)}).`);
    }
    if (topZ === null && !(Number.isFinite(radiusMm) && radiusMm > 0)) {
        throw new McpToolError(`stock.radius_mm must be a positive length when stock.top_z is not given (got ${String(radius)}).`);
    }
    return { radiusMm: Number.isFinite(radiusMm) ? radiusMm : NaN, topZ };
}

export interface RotaryClearanceGeometry {
    axisX: number | null;
    /** PHYSICAL axis Z over the span (the higher end when the axis is pitched). */
    axisZ: number | null;
    chuckFaceY: number | null;
    tailstockY: number | null;
    chuckTopZ: number | null;
    tailstockTopZ: number | null;
}

export interface RotaryClearanceReport {
    basis: 'computed' | 'fallback' | 'refused';
    zMm: number;
    /** What replaced what: 'computed' (legacy superseded), 'legacy' (the stored requirement stands), 'raised' (crossing refused). */
    applied: 'computed' | 'legacy' | 'raised';
    legacy_landmark: string | null;
    wouldLowerIf: string[];
    reasons: string[];
    clearsAtFallback: boolean | null;
    stock: { radius_mm: number | null; top_z: number | null } | null;
}

export interface RotaryResolution {
    report: RotaryClearanceReport;
    /** null = the obstacle list is used as stored. */
    transform: ObstacleTransform | null;
}

function known(v: number | null | undefined): v is number {
    return typeof v === 'number' && Number.isFinite(v);
}

/** The obstacle boxes over the rotary: containing the axis X, overlapping the chuck-face..tailstock span in Y. */
export function rotaryLegacyCandidates(obstacles: ObstacleBox[], g: RotaryClearanceGeometry): ObstacleBox[] {
    if (!known(g.axisX) || !known(g.chuckFaceY) || !known(g.tailstockY)) {
        return [];
    }
    const lo = Math.min(g.chuckFaceY, g.tailstockY);
    const hi = Math.max(g.chuckFaceY, g.tailstockY);
    const e = POSITION_EPSILON_MM;
    const axisX = g.axisX;
    return obstacles.filter((box) => {
        const m = box.machine;
        return Math.min(m.x0, m.x1) - e <= axisX && axisX <= Math.max(m.x0, m.x1) + e
            && Math.min(m.y0, m.y1) - e <= hi && lo <= Math.max(m.y0, m.y1) + e;
    });
}

function sameBox(a: ObstacleBox, b: ObstacleBox): boolean {
    return a.name === b.name && a.clearanceZ === b.clearanceZ
        && a.machine.x0 === b.machine.x0 && a.machine.y0 === b.machine.y0 && a.machine.x1 === b.machine.x1 && a.machine.y1 === b.machine.y1;
}

/**
 * Pure: what the rotary safe height does to this call's obstacles. `obstacles`
 * is the stored list (landmarkStore.obstacleBoxes() outside any call scope).
 */
export function resolveRotaryClearance(input: {
    stock: RotaryStock | null;
    geometry: RotaryClearanceGeometry;
    toolProtrusionMm: number | null;
    fallbackZ: number;
    obstacles: ObstacleBox[];
}): RotaryResolution {
    const { stock, geometry: g, fallbackZ, obstacles } = input;
    const height: RotarySafeHeight = rotarySafeHeight({
        axisZ: g.axisZ,
        chuckFaceY: g.chuckFaceY,
        tailstockY: g.tailstockY,
        chuckTopZ: g.chuckTopZ,
        tailstockTopZ: g.tailstockTopZ,
        stock,
        toolProtrusionMm: input.toolProtrusionMm,
        fallbackZ,
    });
    const reasons = [...height.reasons];
    const candidates = rotaryLegacyCandidates(obstacles, g);
    let legacy: ObstacleBox | null = null;
    if (candidates.length === 1) {
        legacy = candidates[0];
    } else if (candidates.length > 1) {
        reasons.push(`${candidates.length} landmark boxes lie over the rotary axis (${candidates.map((c) => c.name).join(', ')}): `
            + 'none is superseded - which one is the rotary keep-out is not guessed');
    } else {
        reasons.push('no landmark box lies over the rotary axis between the chuck face and the tailstock (or that span is not stated)');
    }
    const stockReport = stock ? { radius_mm: known(stock.radiusMm) ? stock.radiusMm : null, top_z: known(stock.topZ) ? stock.topZ : null } : null;
    const base = {
        legacy_landmark: legacy ? legacy.name : null,
        wouldLowerIf: height.wouldLowerIf,
        clearsAtFallback: height.clearsAtFallback,
        stock: stockReport,
    };
    if (height.clearsAtFallback === false) {
        const needed = height.components.computedZ as number;
        const box = rotaryKeepOutBox({ axisX: g.axisX, chuckFaceY: g.chuckFaceY, tailstockY: g.tailstockY }, height, legacy);
        if (!box) {
            reasons.push('no rotary footprint is known (no landmark box over the axis), so a crossing cannot be detected - '
                + 'state the rotary landmark before traversing near it');
            return { report: { ...base, basis: 'refused', zMm: needed, applied: 'legacy', reasons }, transform: null };
        }
        const raised: ObstacleBox = {
            name: `${box.name} (rotary: needs toolhead Z${needed} with this tool and stock, above the safe traverse Z${fallbackZ} - crossing refused)`,
            machine: box.machine,
            clearanceZ: needed,
            clearanceBasis: 'toolhead',
            mode: box.mode,
        };
        const transform: ObstacleTransform = (boxes) => [...boxes.filter((b) => !legacy || !sameBox(b, legacy)), raised];
        return { report: { ...base, basis: 'refused', zMm: needed, applied: 'raised', reasons }, transform };
    }
    if (height.basis === 'computed' && legacy) {
        const box = rotaryKeepOutBox({ axisX: g.axisX, chuckFaceY: g.chuckFaceY, tailstockY: g.tailstockY }, height, legacy);
        if (box && supersedesLegacy(legacy, box)) {
            const computed: ObstacleBox = {
                name: `${legacy.name} (computed rotary keep-out Z${box.clearanceZ})`,
                machine: box.machine,
                clearanceZ: box.clearanceZ,
                clearanceBasis: 'toolhead',
                mode: box.mode,
            };
            const transform: ObstacleTransform = (boxes) => boxes.map((b) => (sameBox(b, legacy as ObstacleBox) ? computed : b));
            reasons.push(`'${legacy.name}' (legacy ${legacy.clearanceBasis || 'toolhead'} Z${legacy.clearanceZ}) superseded by the computed keep-out`);
            return { report: { ...base, basis: 'computed', zMm: height.zMm, applied: 'computed', reasons }, transform };
        }
    }
    if (height.basis === 'computed' && !legacy) {
        reasons.push('computed, but with no single legacy box to replace the stored requirements stand');
    }
    return { report: { ...base, basis: height.basis, zMm: height.zMm, applied: 'legacy', reasons }, transform: null };
}

/** The live geometry from the per-machine store (rotaryGeometry.ts); the axis Z is the higher end of a pitched axis. */
function liveGeometry(): RotaryClearanceGeometry | null {
    const g = rotaryGeometry();
    if (!g) {
        return null;
    }
    let axisZ = g.axisZ;
    for (const y of [g.chuckFaceY, g.tailstockY]) {
        if (known(y)) {
            axisZ = Math.max(axisZ, axisAt(g.line, y).z_physical);
        }
    }
    return { axisX: g.axisX, axisZ, chuckFaceY: g.chuckFaceY, tailstockY: g.tailstockY, chuckTopZ: g.chuckTopZ, tailstockTopZ: g.tailstockTopZ };
}

/**
 * The rotary resolution for one call of a STOCK_TOOLS tool on the connected
 * machine, or null when nothing about the rotary applies (no rotary on this
 * machine and no stock stated). Throws McpToolError only for a malformed
 * `stock` or a stock stated on a machine with no rotary.
 */
export function rotaryResolutionForCall(args: { stock?: unknown }): RotaryResolution | null {
    const stock = parseStockArg(args.stock);
    const capability = connectedMachineCapability();
    if (!capability.supports.rotary) {
        if (stock) {
            throw new McpToolError(`stock describes a part in the rotary chuck; ${connectedMachineTag()} has no rotary axis the MCP drives.`);
        }
        return null;
    }
    const geometry = liveGeometry();
    if (!geometry && !stock) {
        return null;
    }
    let fallbackZ: number;
    try {
        fallbackZ = safeTraverseZ();
    } catch (err) {
        // No stated park height: the planners refuse on their own; nothing to compute against.
        return null;
    }
    return resolveRotaryClearance({
        stock,
        geometry: geometry || { axisX: null, axisZ: null, chuckFaceY: null, tailstockY: null, chuckTopZ: null, tailstockTopZ: null },
        toolProtrusionMm: currentToolProtrusion().mm,
        fallbackZ,
        obstacles: landmarkStore.obstacleBoxes(),
    });
}
