// Planning the camera pre-configuration stage: which poses, in which order,
// at which heights, and which of them the machine may not actually reach.
//
// The shape of the procedure comes straight from law 2 and law 4:
//
//   - every XY move happens at or above the motion floor, so the plan is a
//     sequence of (traverse, descend, capture..., raise) and never moves in
//     XY and Z together;
//   - the Z sweep happens with XY STATIONARY, which is what makes it a
//     parallax baseline rather than a diagonal through unknown space;
//   - the camera looks into keep-out boxes on purpose - that is where the
//     targets are - but the TOOLHEAD must stay out of them, so every planned
//     pose is checked at the toolhead and a pose that cannot be reached is
//     dropped or restricted WITH A REASON, never quietly adjusted.
//
// Pure: no server imports, unit-tested in tests/bootstrapPlan.test.ts.
import { MotionSegment, ObstacleBox, checkMotion, describeViolations } from './envelopeChecks';

export interface BootstrapPose {
    holdout?: boolean;
    /** What this pose is for, in the report and the frame index. */
    label: string;
    x: number;
    y: number;
}

export interface PoseSweepInput {
    poses: BootstrapPose[];
    /** Where XY transport happens and where the sweep starts. */
    parkZ: number;
    /** The lowest Z the sweep reaches (never below the motion floor). */
    floorZ: number;
    /** Z step of the sweep, mm. */
    stepMm: number;
    obstacles: ObstacleBox[];
    toolProtrusionMm: number | null;
    clearanceMarginMm?: number;
    /** Where the toolhead is now, so the first traverse is checked like any other. */
    fromMachine: { x: number; y: number; z: number };
}

export interface SweepStop {
    z: number;
}

export interface PlannedPose {
    holdout?: boolean;
    label: string;
    x: number;
    y: number;
    /** Heights a frame is captured at, highest first. */
    stops: SweepStop[];
    /** Present when the sweep was shortened or the pose dropped. */
    restriction: string | null;
}

export interface PoseSweepPlan {
    poses: PlannedPose[];
    /** Poses that cannot be visited at all, and why. */
    dropped: Array<{ label: string; x: number; y: number; reason: string }>;
    /** Every motion the plan implies, for the operator's confirm page. */
    segments: MotionSegment[];
    captureCount: number;
}

export const MIN_SWEEP_STEP_MM = 1;
export const MAX_SWEEP_STOPS = 12;

/**
 * The Z heights a sweep visits: the park height first, then down to the floor
 * in steps no larger than `stepMm`, with the floor always included. Highest
 * first, because every sweep starts from the transport height.
 */
export function sweepStops(parkZ: number, floorZ: number, stepMm: number): number[] {
    if (!(parkZ > floorZ)) {
        return [Number(parkZ.toFixed(3))];
    }
    const step = Math.max(stepMm, MIN_SWEEP_STEP_MM);
    const span = parkZ - floorZ;
    const intervals = Math.min(Math.max(1, Math.ceil((span / step) - 1e-9)), MAX_SWEEP_STOPS - 1);
    const actual = span / intervals;
    const stops: number[] = [];
    for (let i = 0; i <= intervals; i++) {
        stops.push(Number((parkZ - (actual * i)).toFixed(3)));
    }
    return stops;
}

/**
 * Plan the pose sweep, checking every leg the way the procedure will run it.
 *
 * A pose whose descent column hits an obstacle keeps only the stops above it -
 * the view from the park height is still worth having - and says so. A pose
 * whose TRAVERSE cannot be made at all is dropped.
 */
export function planPoseSweep(input: PoseSweepInput): PoseSweepPlan {
    const { parkZ, floorZ, obstacles, toolProtrusionMm } = input;
    const clearance = { toolProtrusionMm, clearanceMarginMm: input.clearanceMarginMm };
    const stops = sweepStops(parkZ, floorZ, input.stepMm);

    const columnObstacles = obstacles.map((o) => ({ ...o, mode: 'volume' as const }));
    const planned: PlannedPose[] = [];
    const dropped: Array<{ label: string; x: number; y: number; reason: string }> = [];
    const segments: MotionSegment[] = [];
    let from = { ...input.fromMachine };

    for (const pose of input.poses) {
        // 1. transport, always at the park height.
        const traverse: MotionSegment = {
            what: `traverse to ${pose.label}`,
            kind: 'hop',
            from: { ...from, z: parkZ },
            to: { x: pose.x, y: pose.y, z: parkZ },
        };
        const traverseViolations = checkMotion([traverse], obstacles, clearance);
        if (traverseViolations.length) {
            dropped.push({
                label: pose.label,
                x: pose.x,
                y: pose.y,
                reason: `the toolhead cannot reach this pose: ${describeViolations(traverseViolations)}. The camera may `
                    + 'look into a keep-out, but the toolhead does not enter one - this pose is dropped rather than adjusted.',
            });
            continue;
        }

        // 2. the descent column, XY stationary. Keep the stops that clear.
        //
        // Every obstacle is treated as a VOLUME here, even a landmark stored
        // as 'crossing'. That exemption exists so an approved procedure can
        // probe INSIDE a footprint - descending into the rotary's box is the
        // whole point of probing the stock in it. A camera sweep has no such
        // business: it is looking, and looking can be done from above.
        const kept: SweepStop[] = [];
        let restriction: string | null = null;
        for (const z of stops) {
            const column: MotionSegment = {
                what: `${pose.label} descend to Z${z}`,
                kind: 'column',
                from: { x: pose.x, y: pose.y, z: parkZ },
                to: { x: pose.x, y: pose.y, z },
            };
            const violations = checkMotion([column], columnObstacles, clearance);
            if (violations.length) {
                restriction = `the sweep stops at Z ${kept.length ? kept[kept.length - 1].z : parkZ}: `
                    + `${describeViolations(violations)}. The higher stops are kept - the view from up there is still a view.`;
                break;
            }
            kept.push({ z });
            if (z !== parkZ) {
                segments.push(column);
            }
        }
        if (!kept.length) {
            dropped.push({ label: pose.label, x: pose.x, y: pose.y, reason: restriction || 'no stop in the sweep clears the obstacles.' });
            continue;
        }
        segments.push(traverse);
        planned.push({ label: pose.label, x: pose.x, y: pose.y, stops: kept, restriction, ...(pose.holdout ? { holdout: true } : {}) });
        // 3. back to the park height before the next XY move.
        from = { x: pose.x, y: pose.y, z: parkZ };
    }

    return {
        poses: planned,
        dropped,
        segments,
        captureCount: planned.reduce((n, p) => n + p.stops.length, 0),
    };
}

export interface SearchGridInput {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    pitchMm: number;
}

/**
 * Stage 0: a serpentine grid, at the park height, over the band the camera
 * could be looking from. Nothing about it depends on where the camera points -
 * which is the whole reason it comes first. Both edges are always covered;
 * each axis is divided evenly into steps no larger than the pitch.
 */
export function planSearchGrid(input: SearchGridInput): Array<{ x: number; y: number }> {
    const axis = (min: number, max: number): number[] => {
        const span = max - min;
        if (span <= 0) {
            return [Number(min.toFixed(1))];
        }
        const intervals = Math.max(1, Math.ceil((span / Math.max(input.pitchMm, 1)) - 1e-9));
        const step = span / intervals;
        const points: number[] = [];
        for (let i = 0; i <= intervals; i++) {
            points.push(Number((min + (step * i)).toFixed(1)));
        }
        return points;
    };
    const xs = axis(input.xMin, input.xMax);
    const ys = axis(input.yMin, input.yMax);
    const waypoints: Array<{ x: number; y: number }> = [];
    ys.forEach((y, row) => {
        (row % 2 === 0 ? xs : [...xs].reverse()).forEach((x) => waypoints.push({ x, y }));
    });
    return waypoints;
}
