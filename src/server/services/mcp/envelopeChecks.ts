/* eslint-disable camelcase */
// keep_out is an MCP tool argument (snake_case by convention).
// Pure keep-out geometry for procedure planners (mcp/48, law 4: landmarks
// are obstacles). Until now only the direct XY move guard consulted the
// landmark store; a staged procedure could plan a descent column, a side
// march or a low surface hop straight into the chuck and the operator had to
// catch it on the confirm page. Every planner now hands its motion list
// through checkMotion() and refuses at staging.
//
// No machine or server imports: unit-testable with ts-node.

import { CLEARANCE_MARGIN_MM, ClearanceBasis, normaliseClearanceBasis, requiredToolheadZ } from './landmarkClearance';
import { MAX_KEEP_OUT_BOXES, MAX_STATED_MACHINE_Z_MM } from './procedureLimits';

export interface ObstacleBox {
    name: string;
    /** Machine-coordinate XY extent. */
    machine: { x0: number; y0: number; x1: number; y1: number };
    /** The clearance height, meaning whatever `clearanceBasis` says it is measured to. */
    clearanceZ: number;
    /** Defaults to the legacy 'toolhead' basis when absent. */
    clearanceBasis?: ClearanceBasis;
    /**
     * What the box forbids below its clearance:
     *  - 'crossing': entering or leaving the box on a low horizontal path
     *    (a stored landmark such as "rotary-axis" X140-200 x Y0-350: you do
     *    not TRAVERSE across the rotary low, but probing INTO it is the whole
     *    point of a procedure the operator approves on the page - a descent
     *    column or a march wholly inside the box is allowed);
     *  - 'volume': nothing enters, not even a column (a program's keep_out:
     *    the chuck jaws, the tailstock).
     */
    mode: 'crossing' | 'volume';
}

export interface MotionSegment {
    /** What the segment is, for the refusal message ("steps[3] descend column", "hop s4 -> s5"). */
    what: string;
    /**
     * 'hop': a plain move expecting no contact (crash guard); 'column': a
     * vertical descent (segmented, guarded); 'march': a sensor-gated probing
     * move that STOPS on contact (a -Z or side march, a stepped traverse).
     * Marches are exempt from 'crossing' landmarks - probing INTO the rotary
     * footprint from outside is the job - but never from 'volume' keep-outs.
     */
    kind?: 'hop' | 'column' | 'march';
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
}

export interface Violation {
    what: string;
    obstacle: string;
    /** Lowest toolhead Z the segment reaches while over the (inflated) box. */
    z: number;
    /** The stored clearance, as stored. */
    clearanceZ: number;
    /** What that number is measured to. */
    basis: ClearanceBasis;
    /**
     * The toolhead Z actually demanded: the stored number for a 'toolhead'
     * clearance, obstacle top + tool + margin for a 'physical' one. null when
     * a physical clearance could not be judged because no tool length is
     * known - which is itself the violation.
     */
    requiredZ: number | null;
}

/**
 * The heartbeat's float noise, shared by every comparison of a machine Z
 * against a stated height. Home reports machine Z 327.9989959716797 for a 328
 * home (live 2026-09-14): an exact compare refused a traverse from home, and
 * an exact compare here refused an XY move over a landmark whose clearance is
 * the traverse height because the live Z read 327.999994 (live 2026-09-19).
 * `TRAVERSE_Z_TOLERANCE_MM` in traversePlan.ts is this same number.
 */
export const POSITION_EPSILON_MM = 0.05;

export const OBSTACLE_MARGIN_MM = 5;

/**
 * A straight Z-up exit: X and Y unchanged within POSITION_EPSILON_MM and Z strictly
 * increasing. A vertical climb cannot strike an obstacle beneath the tool, so manual
 * pendant jogs permit it regardless of obstacle boxes (envelope and travel Z limits
 * still apply). Any XY component, or a descent, gets no exemption.
 */
export function isStraightZUp(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
): boolean {
    return Math.abs(to.x - from.x) <= POSITION_EPSILON_MM && Math.abs(to.y - from.y) <= POSITION_EPSILON_MM
        && to.z > from.z;
}

/** 2D segment-vs-AABB slab test; the box is inflated by `margin` on every side. */
export function segmentHitsBox2D(
    x0: number, y0: number, x1: number, y1: number,
    box: { x0: number; y0: number; x1: number; y1: number },
    margin: number = OBSTACLE_MARGIN_MM
): boolean {
    const bx0 = Math.min(box.x0, box.x1) - margin;
    const by0 = Math.min(box.y0, box.y1) - margin;
    const bx1 = Math.max(box.x0, box.x1) + margin;
    const by1 = Math.max(box.y0, box.y1) + margin;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let tMin = 0;
    let tMax = 1;
    for (const [p, d, lo, hi] of [[x0, dx, bx0, bx1], [y0, dy, by0, by1]] as [number, number, number, number][]) {
        if (Math.abs(d) < 1e-12) {
            if (p < lo || p > hi) {
                return false;
            }
        } else {
            let t1 = (lo - p) / d;
            let t2 = (hi - p) / d;
            if (t1 > t2) {
                [t1, t2] = [t2, t1];
            }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax) {
                return false;
            }
        }
    }
    return true;
}

export function pointInBox2D(x: number, y: number, box: { x0: number; y0: number; x1: number; y1: number }, margin: number = OBSTACLE_MARGIN_MM): boolean {
    return x >= Math.min(box.x0, box.x1) - margin && x <= Math.max(box.x0, box.x1) + margin
        && y >= Math.min(box.y0, box.y1) - margin && y <= Math.max(box.y0, box.y1) + margin;
}

/**
 * Every (segment, obstacle) pair the obstacle forbids: the segment's lowest Z
 * is below the clearance and, for a 'volume' box, the segment touches the
 * inflated box at all; for a 'crossing' box, the segment touches it with at
 * least one endpoint OUTSIDE it (it enters or leaves low). A vertical column
 * (from.xy == to.xy) is a segment of zero XY length: forbidden inside a
 * volume, allowed inside a crossing box.
 */
export function checkMotion(
    segments: MotionSegment[],
    obstacles: ObstacleBox[],
    options: {
        margin?: number;
        /** informational: the planner's hop height */
        traverseZ?: number;
        /**
         * How far the fitted tool hangs below the toolhead (toolProtrusion.ts).
         * Only a 'physical' clearance needs it; a legacy 'toolhead' one already
         * has a tool baked in. null/absent makes every physical obstacle
         * impassable rather than passable.
         */
        toolProtrusionMm?: number | null;
        clearanceMarginMm?: number;
    } = {}
): Violation[] {
    const margin = options.margin === undefined ? OBSTACLE_MARGIN_MM : options.margin;
    const protrusion = options.toolProtrusionMm === undefined ? null : options.toolProtrusionMm;
    const clearanceMargin = options.clearanceMarginMm === undefined ? CLEARANCE_MARGIN_MM : options.clearanceMarginMm;
    const out: Violation[] = [];
    for (const seg of segments) {
        const lowZ = Math.min(seg.from.z, seg.to.z);
        for (const ob of obstacles) {
            const basis = normaliseClearanceBasis(ob.clearanceBasis);
            const requiredZ = requiredToolheadZ(ob.clearanceZ, basis, protrusion, clearanceMargin);
            if (requiredZ !== null && lowZ >= requiredZ - POSITION_EPSILON_MM) {
                continue;
            }
            // No traverse-height exemption (removed 2026-09-14). The safe
            // traverse height is now 328 = home Z, at or above every stored
            // clearance, so a hop there passes the clearance test on its own
            // merits; a hop BELOW it is checked like any low segment. The old
            // clamp (traverse 320 < the rotary landmark's 328) let a traverse
            // cross the unmeasured tailstock with 8 mm of unverified headroom.
            if (!segmentHitsBox2D(seg.from.x, seg.from.y, seg.to.x, seg.to.y, ob.machine, margin)) {
                continue;
            }
            if (ob.mode === 'crossing' && seg.kind === 'march') {
                continue; // a sensor-gated approach into the footprint is the procedure itself
            }
            if (ob.mode === 'crossing'
                && pointInBox2D(seg.from.x, seg.from.y, ob.machine, margin)
                && pointInBox2D(seg.to.x, seg.to.y, ob.machine, margin)) {
                continue; // wholly inside: the approved procedure works here
            }
            out.push({
                what: seg.what,
                obstacle: ob.name,
                z: Number(lowZ.toFixed(3)),
                clearanceZ: ob.clearanceZ,
                basis,
                requiredZ,
            });
        }
    }
    return out;
}

export function describeViolations(violations: Violation[]): string {
    return violations
        .map((v) => {
            if (v.requiredZ === null) {
                return `${v.what} crosses "${v.obstacle}", whose top is machine Z ${v.clearanceZ}, but no tool length is `
                    + 'known - so the toolhead Z this needs cannot be computed. State one (set_tool_setter_config '
                    + 'longest_bit_length_mm, or set_probe_geometry probe_effective_length) and retry';
            }
            if (v.basis === 'physical') {
                return `${v.what} reaches toolhead Z ${v.z} over / into "${v.obstacle}" (top Z ${v.clearanceZ}, `
                    + `so the toolhead needs Z ${v.requiredZ} with the tool and margin above it)`;
            }
            return `${v.what} reaches toolhead Z ${v.z} over / into "${v.obstacle}" (clearance Z ${v.clearanceZ})`;
        })
        .join('; ');
}

/**
 * Motion list of a probe sequence plan (hop / descend / probe steps, already
 * simulated by the planner): hops at the traverse height, descend columns,
 * marches from their start to their far limit.
 */
export function sequenceMotion(plan: {
    hopZ: number;
    staged: { x: number; y: number; z: number };
    steps: ({ kind: 'hop'; x: number; y: number }
        | { kind: 'descend'; z: number }
        | { kind: 'probe'; name: string; unit: { x: number; y: number; z: number }; maxTravelMm: number; start: { x: number; y: number; z: number } })[];
}): MotionSegment[] {
    const out: MotionSegment[] = [];
    const virtual = { x: plan.staged.x, y: plan.staged.y, z: plan.hopZ };
    plan.steps.forEach((step, index) => {
        const at = `steps[${index}]`;
        if (step.kind === 'hop') {
            out.push({ kind: 'hop', what: `${at} hop`, from: { ...virtual, z: plan.hopZ }, to: { x: step.x, y: step.y, z: plan.hopZ } });
            virtual.x = step.x;
            virtual.y = step.y;
            virtual.z = plan.hopZ;
        } else if (step.kind === 'descend') {
            out.push({ kind: 'column', what: `${at} descend column`, from: { ...virtual }, to: { x: virtual.x, y: virtual.y, z: step.z } });
            virtual.z = step.z;
        } else {
            const s = step.start;
            const limit = {
                x: Number((s.x + step.unit.x * step.maxTravelMm).toFixed(3)),
                y: Number((s.y + step.unit.y * step.maxTravelMm).toFixed(3)),
                z: Number((s.z + step.unit.z * step.maxTravelMm).toFixed(3)),
            };
            out.push({ kind: 'march', what: `${at} probe "${step.name}" march`, from: { ...s }, to: limit });
            virtual.x = s.x;
            virtual.y = s.y;
            virtual.z = plan.hopZ;
        }
    });
    return out;
}

/**
 * Motion list of a surface scan plan, conservatively: the first station's
 * descent from the traverse height to the plan's absolute floor; every hop
 * at the LOWEST height it could use (any contact is >= the absolute floor,
 * so the hop is >= floor + z_safe_delta); every station's column down to the
 * absolute floor.
 */
export function surfaceMotion(plan: {
    hopZ: number;
    absoluteFloorZ: number;
    zSafeDeltaMm: number;
    hopMode?: 'guarded' | 'stepped';
    stations: { label: string; x: number; y: number }[];
}): MotionSegment[] {
    const out: MotionSegment[] = [];
    const lowestHopZ = Number((plan.absoluteFloorZ + plan.zSafeDeltaMm).toFixed(3));
    plan.stations.forEach((st, index) => {
        if (index === 0) {
            out.push({ kind: 'column', what: `station ${st.label} descent`, from: { x: st.x, y: st.y, z: plan.hopZ }, to: { x: st.x, y: st.y, z: plan.absoluteFloorZ } });
            return;
        }
        const prev = plan.stations[index - 1];
        out.push({ kind: plan.hopMode === 'stepped' ? 'march' : 'hop', what: `hop ${prev.label} -> ${st.label}`, from: { x: prev.x, y: prev.y, z: lowestHopZ }, to: { x: st.x, y: st.y, z: lowestHopZ } });
        out.push({ kind: 'march', what: `station ${st.label} march`, from: { x: st.x, y: st.y, z: lowestHopZ }, to: { x: st.x, y: st.y, z: plan.absoluteFloorZ } });
    });
    return out;
}

export class KeepOutError extends Error {}

/** Validate a program's transient keep_out argument into obstacle boxes. */
export function normalizeKeepOut(raw: unknown, where: string = 'keep_out'): ObstacleBox[] {
    if (raw === undefined || raw === null) {
        return [];
    }
    if (!Array.isArray(raw) || raw.length > MAX_KEEP_OUT_BOXES) {
        throw new KeepOutError(`${where}: must be an array of up to ${MAX_KEEP_OUT_BOXES} {name, machine: {x0, y0, x1, y1}, clearance_z}.`);
    }
    return raw.map((item, index) => {
        const at = `${where}[${index}]`;
        if (!item || typeof item !== 'object') {
            throw new KeepOutError(`${at}: must be an object.`);
        }
        const o = item as { name?: unknown; machine?: unknown; clearance_z?: unknown };
        const name = String(o.name || '').trim();
        if (!name) {
            throw new KeepOutError(`${at}: name is required (shown on the confirm page).`);
        }
        const m = (o.machine || {}) as { x0?: unknown; y0?: unknown; x1?: unknown; y1?: unknown };
        const nums = [m.x0, m.y0, m.x1, m.y1].map(Number);
        if (nums.some((n) => !Number.isFinite(n))) {
            throw new KeepOutError(`${at}: machine {x0, y0, x1, y1} must be finite machine coordinates.`);
        }
        const clearanceZ = Number(o.clearance_z);
        if (!Number.isFinite(clearanceZ) || clearanceZ < 0 || clearanceZ > MAX_STATED_MACHINE_Z_MM) {
            throw new KeepOutError(`${at}: clearance_z (minimum safe TOOLHEAD machine Z over the box) is required, 0-${MAX_STATED_MACHINE_Z_MM}.`);
        }
        return {
            name,
            machine: { x0: Math.min(nums[0], nums[2]), y0: Math.min(nums[1], nums[3]), x1: Math.max(nums[0], nums[2]), y1: Math.max(nums[1], nums[3]) },
            clearanceZ,
            mode: 'volume',
        };
    });
}

/**
 * Is the probe tip inside the rotary's swept cylinder (axis along machine Y
 * at X = axisX, physical Z = axisZ, radius r)? Used before a rotation.
 */
export function insideSweptCylinder(
    toolhead: { x: number; z: number },
    probeLength: number,
    axis: { x: number; zPhysical: number; radius: number }
): boolean {
    const tipZ = toolhead.z - probeLength;
    return Math.hypot(toolhead.x - axis.x, tipZ - axis.zPhysical) < axis.radius;
}
