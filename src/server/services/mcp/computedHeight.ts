// The computed safe height of an XY traverse (tyeth/Luban#265 WP10, R13,
// operator 2026-10-19): "allow safe traversal if tool distance/height known
// including toolhead unit [i.e. collision with bed machine coordinate
// equivalent] and landmarks known (with extra 50mm clearance [configurable
// ideal distance and min distance])".
//
// Everything here is a PHYSICAL machine Z: the bed plane (set_probe_geometry
// bed_plane_z) and the obstacle tops of the landmarks the swept path crosses.
// The highest of them, plus how far the lowest point of toolhead unit + tool
// hangs below the toolhead reference (motionRules.ts
// lowestPointBelowReferenceMm), is the toolhead Z at which something would
// touch; the clearance goes on top of that:
//
//   travelZ = max(bed, physical tops on the path) + lowest point + clearance
//
// The clearance is the ideal; when that does not fit under the machine's safe
// top Z it is reduced toward the minimum (travelZ = the top Z); when even the
// minimum does not fit, there is no computed height and the existing top-Z
// behaviour applies. The motion floor (law 2) still holds: a travelZ below it
// is raised to it, and the result says which one governs.
//
// A landmark on the path whose clearance is on the legacy 'toolhead' basis
// (or the rotary keep-out WP8 computes, which is a toolhead height too) has no
// known PHYSICAL top - the number already has some tool baked in - so nothing
// can be computed over it: the path is reported unmet and the existing top-Z
// behaviour applies. Re-stating it with set_landmark obstacle_top_z fixes that.
//
// Pure: no server imports, unit-tested in tests/computedHeight.test.ts.
import { OBSTACLE_MARGIN_MM, ObstacleBox, POSITION_EPSILON_MM, segmentHitsBox2D } from './envelopeChecks';
import { normaliseClearanceBasis } from './landmarkClearance';

export interface ComputedTravelInput {
    /** The swept XY path in MACHINE coordinates: the current XY, then every target in order. */
    path: Array<{ x: number; y: number }>;
    /** The landmark obstacle boxes as this call sees them (landmarkStore.obstacleBoxes(), rotary transform applied). */
    obstacles: ObstacleBox[];
    /** Measured physical machine Z of the bed. */
    bedPlaneZ: number;
    /** motionRules.ts lowestPointBelowReferenceMm: max(trusted tool protrusion, toolhead body below the reference). */
    lowestPointBelowReferenceMm: number;
    idealMm: number;
    minMm: number;
    /** The machine's safe top Z (zPolicyFor().safeTraverseZ, 328 on the A350). */
    topZ: number;
    /** The motion floor (law 2); never above topZ (zPolicyFor clamps it). */
    floorZ: number;
    /** XY inflation of every box; default the planners' OBSTACLE_MARGIN_MM. */
    marginMm?: number;
}

/**
 * Which number set travelZ:
 *  - 'ideal-clearance': highest physical top + lowest point + the ideal;
 *  - 'reduced-clearance': the ideal did not fit under top Z, so travelZ IS the
 *    top Z with a clearance between the minimum and the ideal;
 *  - 'motion-floor': the computed height is below the motion floor, which wins;
 *  - 'top-z': no computed height (the minimum does not fit, or a landmark on
 *    the path has no physical top) - the existing top-Z behaviour applies.
 */
export type ComputedTravelGovernor = 'ideal-clearance' | 'reduced-clearance' | 'motion-floor' | 'top-z';

export interface ComputedTravel {
    /** null = no computed height: the existing top-Z behaviour applies. */
    travelZ: number | null;
    /** travelZ - (highest physical top + lowest point); null without a travelZ. */
    clearanceUsed: number | null;
    idealMm: number;
    minMm: number;
    governedBy: ComputedTravelGovernor;
    /** The highest physical Z under the swept path, and what it is ('bed' or a landmark name). */
    highestPhysicalZ: number;
    highest: string;
    /** Every box the swept path touches, with the top used (null = no physical top known). */
    onPath: Array<{ name: string; basis: 'toolhead' | 'physical'; topZ: number | null }>;
    /** Why there is no computed height, when there is none. */
    unmet: string[];
    note: string;
}

const mm = (n: number) => Number(n.toFixed(3));

/** Whether any segment of the swept path (or the single point, for a one-point path) touches the inflated box. */
function pathTouches(path: Array<{ x: number; y: number }>, box: ObstacleBox, margin: number): boolean {
    if (path.length === 1) {
        return segmentHitsBox2D(path[0].x, path[0].y, path[0].x, path[0].y, box.machine, margin);
    }
    for (let i = 0; i + 1 < path.length; i++) {
        if (segmentHitsBox2D(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, box.machine, margin)) {
            return true;
        }
    }
    return false;
}

/**
 * Pure: the computed traverse height for one swept XY path. Every segment of
 * the path is checked against every box (inflated by the margin), so an
 * obstacle in the middle of a segment counts, not just one under an endpoint.
 */
export function computeTravelHeight(input: ComputedTravelInput): ComputedTravel {
    const margin = input.marginMm === undefined ? OBSTACLE_MARGIN_MM : input.marginMm;
    const e = POSITION_EPSILON_MM;
    const { idealMm, minMm, topZ, floorZ } = input;
    const onPath: ComputedTravel['onPath'] = [];
    const unmet: string[] = [];
    let highestPhysicalZ = input.bedPlaneZ;
    let highest = 'bed';
    for (const box of input.obstacles) {
        if (!pathTouches(input.path, box, margin)) {
            continue;
        }
        const basis = normaliseClearanceBasis(box.clearanceBasis);
        if (basis !== 'physical') {
            onPath.push({ name: box.name, basis, topZ: null });
            unmet.push(`landmark "${box.name}" on the path has a toolhead-basis clearance (Z${box.clearanceZ}, some tool already `
                + 'baked in) and no physical top - re-state it with set_landmark obstacle_top_z to compute a height over it');
            continue;
        }
        onPath.push({ name: box.name, basis, topZ: box.clearanceZ });
        if (box.clearanceZ > highestPhysicalZ) {
            highestPhysicalZ = box.clearanceZ;
            highest = box.name;
        }
    }
    const touch = mm(highestPhysicalZ + input.lowestPointBelowReferenceMm);
    const base = { idealMm, minMm, highestPhysicalZ, highest, onPath };
    const touchText = `the lowest point of toolhead + tool (${input.lowestPointBelowReferenceMm} mm below the reference) touches `
        + `${highest === 'bed' ? 'the bed' : `"${highest}"`} (Z${highestPhysicalZ}) at toolhead Z${touch}`;
    if (unmet.length) {
        return { ...base, travelZ: null, clearanceUsed: null, governedBy: 'top-z', unmet, note: `${unmet.join('; ')}.` };
    }
    let travelZ: number;
    let governedBy: ComputedTravelGovernor;
    let note: string;
    if (touch + idealMm <= topZ + e) {
        travelZ = mm(touch + idealMm);
        governedBy = 'ideal-clearance';
        note = `${touchText}; + the ideal clearance ${idealMm} mm = Z${travelZ}`;
    } else if (topZ - touch >= minMm - e) {
        travelZ = topZ;
        governedBy = 'reduced-clearance';
        note = `${touchText}; the ideal clearance ${idealMm} mm would reach Z${mm(touch + idealMm)}, above the safe top Z${topZ}, so the `
            + `clearance is reduced to ${mm(topZ - touch)} mm (minimum ${minMm} mm) at the top Z`;
    } else {
        const why = `${touchText}; even the minimum clearance ${minMm} mm (Z${mm(touch + minMm)}) does not fit under the safe top Z${topZ}`;
        return { ...base, travelZ: null, clearanceUsed: null, governedBy: 'top-z', unmet: [why], note: `${why} - the top-Z behaviour applies.` };
    }
    if (floorZ > travelZ + e) {
        note += `; the motion floor Z${floorZ} is higher and governs (law 2: all XY over 1 mm at or above it)`;
        travelZ = floorZ;
        governedBy = 'motion-floor';
    }
    return { ...base, travelZ, clearanceUsed: mm(travelZ - touch), governedBy, unmet: [], note: `${note}.` };
}
