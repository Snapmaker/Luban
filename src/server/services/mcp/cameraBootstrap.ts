/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import crypto from 'crypto';
import * as fs from 'fs-extra';
import path from 'path';

import DataStorage from '../../DataStorage';
import { BootstrapPose, planPoseSweep, planSearchGrid, sweepStops } from './bootstrapPlan';
import { captureFrame } from './camera';
import { cameraFailure, savePartialCameraIndex } from './cameraRecovery';
import { clearanceOptions } from './clearanceContext';
import { checkMotion, describeViolations, MotionSegment } from './envelopeChecks';
import { landmarkStore } from './landmarks';
import { McpToolError } from './registry';
import { rotaryAxisPoints } from './rotaryGeometry';
import { getToolSetterConfig } from './toolSetter';
import { ResolvedTravel, TravelLimits, clampBand, describeClipping } from './machineTravel';
import {
    BOOTSTRAP_REACH_MM,
    BOOTSTRAP_SEARCH_PITCH_MM,
    BOOTSTRAP_SWEEP_STEP_MM,
    BOOTSTRAP_Y_SPAN_MM,
    MAX_BOOTSTRAP_POSES,
    clampTo,
} from './procedureLimits';
import { getPositionSnapshot, motionFloorZ, planningTravel, requireReliableMachine, safeTraverseZ } from './tools/machine';
import { assertMachineReadyForProcedure, descendInSegments, moveMachineSettled, TRAVEL_FEED } from './probing';
import { ProbeChannel } from './probeFeed';

// The camera pre-configuration stage.
//
// Operator law 2026-09-19: the camera can sit differently after every power
// cycle, be knocked, be re-aimed, or be a different camera entirely. So this
// has to bootstrap FROM NOTHING - no assumed direction, no assumed offset, no
// assumed field of view, no assumed lens - and it does that in two staged
// jobs, each with its own approval, because the second cannot be planned until
// a human (or an agent) has looked at the first.
//
//   search: a serpentine grid at the park height across the X band the camera
//     could be looking from, bracketing the tool setter's KNOWN machine XY.
//     Which frames contain it, compared with the toolhead XY of those frames,
//     gives the coarse camera offset INCLUDING ITS SIGN with no prior
//     assumption at all. This is the only step that is meaningful without a
//     calibration, which is exactly why it comes first. On 2026-09-19 the same
//     grid was reached only after forty minutes of single poses.
//
//   poses: with a coarse offset in hand, visit each named pose and sweep Z
//     from the park height down to the motion floor with XY STATIONARY,
//     capturing at every stop. Targets at three different heights over an 8 mm
//     baseline are what turn a flat pixels-per-millimetre number into
//     perspective.
//
// Both write the same indexed frame set, which scripts/camera_bootstrap.py
// solves into a model.

export interface BootstrapTarget {
    name: string;
    machine: { x: number; y: number; z: number };
    /** How its machine coordinates are known - quoted into the index, never guessed. */
    source: string;
    /** A known size in the scene is an absolute scale constraint. */
    diameterMm?: number;
}

/**
 * Everything whose machine coordinates the server already knows well enough to
 * solve against. Emptiness is a refusal, not a warning: a bootstrap with no
 * known target measures nothing.
 */
export function bootstrapTargets(): BootstrapTarget[] {
    const targets: BootstrapTarget[] = [];
    const setter = getToolSetterConfig();
    if (setter) {
        targets.push({
            name: 'tool-setter',
            machine: {
                x: setter.centerX,
                y: setter.centerY,
                // The plate top: the trigger Z is where the REFERENCE BIT's tip
                // sits when it closes the switch, so the plate is that much
                // higher than the toolhead was.
                z: Number((setter.triggerZ - setter.referenceBitLengthMm).toFixed(3)),
            },
            source: 'set_tool_setter_config (centre, and trigger_z - reference_bit_length_mm for the plate top)',
            diameterMm: setter.discDiameterMm,
        });
    }
    for (const point of rotaryAxisPoints()) {
        targets.push({
            name: point.name,
            machine: { x: point.x, y: point.y, z: point.z },
            source: 'set_probe_geometry (rotary_axis_x / rotary_axis_z_physical and the named end)',
        });
    }
    return targets;
}

export interface BootstrapFrameRecord {
    holdout?: boolean;
    file: string;
    label: string;
    machine: { x: number; y: number; z: number };
    capturedAt: number;
}

export interface BootstrapIndex {
    bootstrapId: string;
    stage: 'search' | 'poses';
    createdAt: number;
    /** What the camera was, at the time - the solver writes it into the model. */
    camera: { device: string | null };
    parkZ: number;
    floorZ: number;
    targets: BootstrapTarget[];
    frames: BootstrapFrameRecord[];
    note: string;
}

// The sweep expects no contact on either channel; a trigger is a collision.
const PROBE_CHANNELS: ProbeChannel[] = ['probe', 'toolsetter'];
const SENSOR_DELAY_MS = 120;

function bootstrapDir(id: string): string {
    return path.join(DataStorage.userDataDir, 'mcp-camera-bootstrap', id);
}

/**
 * The band the camera could be looking from, given no knowledge of where it
 * looks - clamped to where the TOOLHEAD can actually go.
 *
 * Until 2026-09-20 this used its own slop (`max(-25, ...)`, `min(sizeX + 40,
 * ...)`), which on an A350 planned a first waypoint at X-25 against a travel
 * that stops at X-19: an abort on the first move, after an operator approval.
 * The reach is symmetric but the machine is not - the tool setter sits 98 mm
 * from the X minimum and 260 mm from the maximum - so what the clamp costs is
 * reported rather than silently swallowed.
 */
export function searchBand(
    target: { x: number; y: number },
    travel: TravelLimits,
    reachMm: number,
    ySpanMm: number
): { bounds: { xMin: number; xMax: number; yMin: number; yMax: number }; clipped: string[] } {
    const x = clampBand(target.x, reachMm, travel.xMin, travel.xMax);
    const y = clampBand(target.y, ySpanMm / 2, travel.yMin, travel.yMax);
    const clipped = [describeClipping('X', x), describeClipping('Y', y)].filter(Boolean) as string[];
    return { bounds: { xMin: x.min, xMax: x.max, yMin: y.min, yMax: y.max }, clipped };
}

export interface SearchPlanArgs {
    reach_mm?: number;
    pitch_mm?: number;
    y_span_mm?: number;
}

export function planSearchStage(args: SearchPlanArgs): {
    waypoints: Array<{ x: number; y: number }>;
    target: BootstrapTarget;
    parkZ: number;
    bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
    travel: ResolvedTravel;
    clipped: string[];
} {
    const targets = bootstrapTargets();
    const setter = targets.find((t) => t.name === 'tool-setter');
    if (!setter) {
        throw new McpToolError('The search stage brackets the tool setter, whose machine coordinates are the one thing '
            + 'known exactly without any camera knowledge at all - and no setter is configured. Run '
            + 'set_tool_setter_config first, or state another target the same way.');
    }
    const travel = planningTravel();
    if (!travel) {
        throw new McpToolError('The toolhead travel is unknown for this machine, so a search band cannot be planned '
            + 'without inventing one. State it with set_probe_geometry (travel_x_min, travel_x_max, travel_y_min, '
            + 'travel_y_max) - the measured limits for this rig.');
    }
    const reach = clampTo(args.reach_mm, BOOTSTRAP_REACH_MM);
    const pitch = clampTo(args.pitch_mm, BOOTSTRAP_SEARCH_PITCH_MM);
    const ySpan = clampTo(args.y_span_mm, BOOTSTRAP_Y_SPAN_MM);
    const { bounds, clipped } = searchBand(setter.machine, travel.limits, reach, ySpan);
    return {
        waypoints: planSearchGrid({ ...bounds, pitchMm: pitch }),
        target: setter,
        parkZ: safeTraverseZ(),
        bounds,
        travel,
        clipped: [...clipped, ...travel.conflicts],
    };
}

export interface PosePlanArgs {
    poses?: Array<{ label?: string; x?: number; y?: number; holdout?: boolean }>;
    step_mm?: number;
    floor_z?: number;
}

export function planPoseStage(args: PosePlanArgs) {
    const raw = Array.isArray(args.poses) ? args.poses : [];
    if (!raw.length || raw.length > MAX_BOOTSTRAP_POSES) {
        throw new McpToolError(`Provide 1-${MAX_BOOTSTRAP_POSES} poses: the toolhead XY to view each target from, derived from the search `
            + 'stage\'s coarse offset. plan_view_pose computes them once a model exists.');
    }
    const poses: BootstrapPose[] = raw.map((p, i) => {
        const x = Number(p.x);
        const y = Number(p.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new McpToolError(`Pose ${i + 1} needs finite machine x and y (where the TOOLHEAD goes).`);
        }
        return { label: String(p.label || `pose-${i + 1}`).slice(0, 40), x, y, holdout: p.holdout === true };
    });
    // Leave the head at a held-out view, ready for a fresh verification capture.
    poses.sort((a, b) => Number(a.holdout) - Number(b.holdout));
    if (new Set(poses.map((pose) => pose.label.replace(/[^\w.-]/g, '_'))).size !== poses.length) {
        throw new McpToolError('Pose labels must be unique after filename sanitization.');
    }
    if (poses.some((pose) => pose.holdout && poses.some((fit) => !fit.holdout && fit.x === pose.x && fit.y === pose.y))) {
        throw new McpToolError('Holdout XY must differ from every fit pose; a duplicate view is not independent verification.');
    }
    const position = getPositionSnapshot();
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown.');
    }
    const parkZ = safeTraverseZ();
    const floorZ = Math.max(Number(args.floor_z) || motionFloorZ(), motionFloorZ());
    const plan = planPoseSweep({
        poses,
        parkZ,
        floorZ,
        stepMm: Number(args.step_mm) || BOOTSTRAP_SWEEP_STEP_MM,
        obstacles: landmarkStore.obstacleBoxes(),
        fromMachine: { x, y, z },
        ...clearanceOptions(),
    });
    if (!plan.poses.length) {
        throw new McpToolError(`No pose survives the obstacle check: ${plan.dropped.map((d) => `${d.label}: ${d.reason}`).join(' ')}`);
    }
    if (poses.some((pose) => pose.holdout) && (!plan.poses.some((pose) => pose.holdout)
        || plan.poses.filter((pose) => !pose.holdout).length < 2)) {
        throw new McpToolError('Bootstrap needs at least two surviving fit poses and a surviving holdout. Widen the search; do not shrink obstacle boxes.');
    }
    return { plan, parkZ, floorZ, stops: sweepStops(parkZ, floorZ, Number(args.step_mm) || BOOTSTRAP_SWEEP_STEP_MM) };
}

/** The gcode envelope an operator approves for either stage. */
export function describeBootstrapGcode(lines: string[]): string {
    return ['G90', 'G53;', ...lines, 'G54;'].join('\n');
}

/** Check the actual initial lift and every noncontact leg with the current fitted tool. */
export function validateBootstrapMotion(parkZ: number, points: Array<{ x: number; y: number; z: number }>): void {
    const snapshot = getPositionSnapshot();
    requireReliableMachine(snapshot, 'camera bootstrap');
    const { x, y, z } = snapshot.machine;
    if (x === null || y === null || z === null) throw new McpToolError('Bootstrap requires a known starting machine position.');
    let from = { x, y, z };
    const segments: MotionSegment[] = [{ kind: 'column', what: 'bootstrap initial park', from, to: { x, y, z: parkZ } }];
    from = { x, y, z: parkZ };
    points.forEach((to, i) => {
        segments.push({ kind: from.x === to.x && from.y === to.y ? 'column' : 'hop', what: `bootstrap leg ${i + 1}`, from, to });
        from = to;
    });
    const obstacles = landmarkStore.obstacleBoxes().map((box) => ({ ...box, mode: 'volume' as const }));
    const violations = checkMotion(segments, obstacles, clearanceOptions());
    if (violations.length) throw new McpToolError(`Bootstrap envelope: ${describeViolations(violations)}`);
}

export function bootstrapPosePoints(planned: ReturnType<typeof planPoseStage>): Array<{ x: number; y: number; z: number }> {
    return planned.plan.poses.flatMap((pose) => [
        { x: pose.x, y: pose.y, z: planned.parkZ },
        ...pose.stops.map((stop) => ({ x: pose.x, y: pose.y, z: stop.z })),
        { x: pose.x, y: pose.y, z: planned.parkZ },
    ]);
}

export async function runSearchStage(
    plan: ReturnType<typeof planSearchStage>,
    announce: (phase: string, note: string) => void
): Promise<object> {
    assertMachineReadyForProcedure();
    validateBootstrapMotion(plan.parkZ, plan.waypoints.map((p) => ({ ...p, z: plan.parkZ })));
    const id = crypto.randomBytes(4).toString('hex');
    const dir = bootstrapDir(id);
    fs.ensureDirSync(dir);
    const frames: BootstrapFrameRecord[] = [];
    let device: string | null = null;
    try {
        await moveMachineSettled('bootstrap:park', { z: plan.parkZ }, TRAVEL_FEED);
        for (let i = 0; i < plan.waypoints.length; i++) {
            const w = plan.waypoints[i];
            announce('search:move', `waypoint ${i + 1}/${plan.waypoints.length} (${w.x}, ${w.y})`);
            await moveMachineSettled('bootstrap:search', { x: w.x, y: w.y }, TRAVEL_FEED * 4);
            const frame = await captureFrame();
            device = frame.device;
            const file = path.join(dir, `search${String(i + 1).padStart(3, '0')}_x${w.x}_y${w.y}.jpg`);
            fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
            frames.push({ file, label: 'search', machine: { x: w.x, y: w.y, z: plan.parkZ }, capturedAt: frame.capturedAt });
        }
        const index: BootstrapIndex = {
            bootstrapId: id,
            stage: 'search',
            createdAt: Date.now(),
            camera: { device },
            parkZ: plan.parkZ,
            floorZ: plan.parkZ,
            targets: bootstrapTargets(),
            frames,
            note: 'Stage 0. Find which frames contain the tool setter. Its machine XY is known exactly, so the toolhead XY '
            + 'of the frames that show it gives the camera offset INCLUDING ITS SIGN, to within half the grid pitch, '
            + 'with no prior assumption about where the camera looks. Then plan the pose stage from that.',
        };
        fs.writeJsonSync(path.join(dir, 'index.json'), index, { spaces: 2 });
        return {
            bootstrapId: id,
            directory: dir,
            stage: 'search',
            frameCount: frames.length,
            targets: index.targets,
            next_step: index.note,
        };
    } catch (err) {
        const partial = { bootstrapId: id, directory: dir, stage: 'search', frames, targets: bootstrapTargets(), camera: { device } };
        savePartialCameraIndex(dir, partial);
        return cameraFailure('camera_bootstrap', err, partial);
    }
}

export async function runPoseStage(
    planned: ReturnType<typeof planPoseStage>,
    announce: (phase: string, note: string) => void
): Promise<object> {
    assertMachineReadyForProcedure();
    validateBootstrapMotion(planned.parkZ, bootstrapPosePoints(planned));
    const id = crypto.randomBytes(4).toString('hex');
    const dir = bootstrapDir(id);
    fs.ensureDirSync(dir);
    const frames: BootstrapFrameRecord[] = [];
    let device: string | null = null;
    try {
        await moveMachineSettled('bootstrap:park', { z: planned.parkZ }, TRAVEL_FEED);
        for (const pose of planned.plan.poses) {
            announce('poses:traverse', `${pose.label} -> (${pose.x}, ${pose.y}) at Z ${planned.parkZ}`);
            await moveMachineSettled('bootstrap:traverse', { x: pose.x, y: pose.y }, TRAVEL_FEED * 4);
            let fromZ = planned.parkZ;
            for (const stop of pose.stops) {
                if (stop.z !== planned.parkZ) {
                    // XY stationary: the sweep is a vertical baseline, and law 2
                    // is satisfied because nothing moves in XY below the floor.
                    announce('poses:descend', `${pose.label} to Z ${stop.z}`);
                    // Segmented and crash-guarded, like every other descent: the
                    // sweep expects no contact, so a trigger during it is a
                    // collision, not a measurement.
                    await descendInSegments('bootstrap:descend', fromZ, stop.z, PROBE_CHANNELS, SENSOR_DELAY_MS);
                }
                const frame = await captureFrame();
                device = frame.device;
                const file = path.join(dir, `${pose.label}_z${stop.z}.jpg`.replace(/[^\w.-]/g, '_'));
                fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
                frames.push({ file,
                    label: pose.label,
                    machine: { x: pose.x, y: pose.y, z: stop.z },
                    capturedAt: frame.capturedAt,
                    holdout: pose.holdout === true });
                fromZ = stop.z;
            }
            // Back to the park height before the next XY move, always.
            announce('poses:raise', `${pose.label} back to Z ${planned.parkZ}`);
            await moveMachineSettled('bootstrap:raise', { z: planned.parkZ }, TRAVEL_FEED);
        }
        const index: BootstrapIndex = {
            bootstrapId: id,
            stage: 'poses',
            createdAt: Date.now(),
            camera: { device },
            parkZ: planned.parkZ,
            floorZ: planned.floorZ,
            targets: bootstrapTargets(),
            frames,
            note: 'Stage 1-2. Solve with scripts/camera_bootstrap.py <directory>, then store the result with '
            + 'set_camera_model and prove it with a fresh capture at a holdout pose (excluded from fitting). Read index remotely with get_camera_capture_set, images with get_frame.',
        };
        fs.writeJsonSync(path.join(dir, 'index.json'), index, { spaces: 2 });
        return {
            bootstrapId: id,
            directory: dir,
            stage: 'poses',
            frameCount: frames.length,
            poses: planned.plan.poses,
            finalMachine: getPositionSnapshot().machine,
            dropped: planned.plan.dropped,
            targets: index.targets,
            next_step: index.note,
        };
    } catch (err) {
        const partial = { bootstrapId: id, directory: dir, stage: 'poses', frames, targets: bootstrapTargets(), camera: { device } };
        savePartialCameraIndex(dir, partial);
        return cameraFailure('camera_bootstrap', err, partial);
    }
}
