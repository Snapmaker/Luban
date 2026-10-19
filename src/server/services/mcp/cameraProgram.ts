/* eslint-disable camelcase */
// Composite, operator-approved camera workflow.  This deliberately keeps the
// camera operations in one procedure rather than nesting independently staged
// move_z/survey/capture jobs, so the confirm page is the complete sequence.
import * as fs from 'fs-extra';

import { captureFrame, getCachedFrame } from './camera';
import { clearanceOptions } from './clearanceContext';
import { cameraOpSchemas, validateCameraOps } from './cameraProgramSchema';
import { belowCameraFloor } from './cameraSafety';
import { calibrationStore } from './calibration';
import { checkMotion, describeViolations, MotionSegment } from './envelopeChecks';
import { landmarkStore } from './landmarks';
import { jobManager } from './jobs';
import { mcpBroadcast } from './index';
import { programFramePath } from './programFrames';
import { probeFeedService } from './probeFeed';
import {
    MAX_OVERLAP_FRACTION,
    MAX_SURVEY_LEVELS,
    SURVEY_MARGIN_MM,
    SURVEY_PITCH_MM,
    SURVEY_LINK_FEED_FACTOR,
    TRAVEL_FEED,
    clampTo,
} from './procedureLimits';
import { McpToolError, ToolRegistry } from './registry';
import { SurveyLeg, planSurvey } from './surveyPlan';
import { decodeToGray, trackFeature } from './tracking';
import { validateStagedEnvelope } from './tools/staging';
import {
    getMachineSizeByIdentifier,
    getPositionSnapshot,
    motionFloorZ,
    requireReliableMachine,
    requirePlanningTravel,
    safeTraverseZ,
} from './tools/machine';
import { connectionManager } from '../machine/ConnectionManager';
import { moveMachineSettled, assertMachineReadyForProcedure, checkProcedureStop } from './probing';
import { cameraFailure } from './cameraRecovery';
import { routeClearanceForPath } from './routeClearance';
import { fovAt } from './cameraGeometry';
import { cameraModelStore } from './cameraModelStore';
import { judgeCameraModel } from './cameraModel';
import { modelContext } from './tools/cameraModel';
import { pitchForOverlap } from './surveyMosaic';

const MAX_OPS = 80;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const POSITION_TOLERANCE_MM = 0.05;

type CameraOpKind = 'move_z' | 'survey_bed' | 'move_and_capture' | 'capture' | 'track_feature' | 'fit_calibration' | 'verify_calibration';

interface CameraOp {
    id: string;
    kind: CameraOpKind;
    args: { [key: string]: unknown };
}

interface PlannedSurvey {
    kind: 'survey_bed';
    levels: number[];
    plan: ReturnType<typeof planSurvey>;
    pitch: number;
    xs: number[];
    ys: number[];
    planeZ: number;
    machineZ: number | null;
}

interface CameraProgramPlan {
    name: string;
    reason: string;
    ops: CameraOp[];
    previews: string[];
    staged: { x: number; y: number; z: number };
    keepOut: [];
    surveys: { [id: string]: PlannedSurvey };
    operatorConfirmedClearance: boolean;
}

interface FrameResult {
    frameId: string;
    file: string;
    machine: object;
    capturedAt: number;
}

function finite(value: unknown, field: string): number {
    const number = value as number;
    if (typeof number !== 'number' || !Number.isFinite(number)) {
        throw new McpToolError(`${field} must be a finite number.`);
    }
    return number;
}

function frameLine(id: string, frame: FrameResult): string {
    return `; ${id}: capture frame ${frame.frameId} at machine ${JSON.stringify(frame.machine)} -> ${frame.file}`;
}

function machineTop(): number {
    const size = getMachineSizeByIdentifier(connectionManager.getConnectionStatus().machineIdentifier);
    return Math.max(size ? size.z : 0, safeTraverseZ());
}

function gridPoints(min: number, max: number, pitch: number): number[] {
    const intervals = Math.max(1, Math.ceil((max - min) / pitch - 1e-9));
    const step = (max - min) / intervals;
    return Array.from({ length: intervals + 1 }, (_, i) => Number((min + step * i).toFixed(1)));
}

function validateColumn(from: { x: number; y: number; z: number }, z: number, where: string): void {
    if (z < 0 || z > machineTop()) throw new McpToolError(`${where}: machine Z outside travel.`);
    const violations = checkMotion([{ kind: 'column', what: where, from, to: { ...from, z } }],
        landmarkStore.obstacleBoxes().map((box) => ({ ...box, mode: 'volume' as const })), clearanceOptions());
    if (violations.length) throw new McpToolError(`${where}: ${describeViolations(violations)}`);
}

function surveyArgs(
    args: { [key: string]: unknown },
    virtual: { x: number; y: number; z: number },
    operatorConfirmedClearance: boolean,
    where: string
): PlannedSurvey {
    const travel = requirePlanningTravel(`${where} survey`, virtual);
    const margin = clampTo(args.margin_mm, SURVEY_MARGIN_MM);
    let pitch = clampTo(args.pitch_mm, SURVEY_PITCH_MM);
    const limits = travel.limits;
    const xMin = args.x_min === undefined ? limits.xMin + margin : finite(args.x_min, `${where}.x_min`);
    const xMax = args.x_max === undefined ? limits.xMax - margin : finite(args.x_max, `${where}.x_max`);
    const yMin = args.y_min === undefined ? limits.yMin + margin : finite(args.y_min, `${where}.y_min`);
    const yMax = args.y_max === undefined ? limits.yMax - margin : finite(args.y_max, `${where}.y_max`);
    if (!(xMax > xMin) || !(yMax > yMin)) {
        throw new McpToolError(`${where}: survey bounds are empty.`);
    }
    if (xMin < limits.xMin || xMax > limits.xMax || yMin < limits.yMin || yMax > limits.yMax) {
        throw new McpToolError(`${where}: bounds exceed machine travel; use bounds from get_stored_state or standalone survey_bed for reported clipping.`);
    }
    const rawLevels = Array.isArray(args.z_levels) && args.z_levels.length
        ? args.z_levels.map((value) => finite(value, `${where}.z_levels`))
        : [args.machine_z === undefined ? virtual.z : finite(args.machine_z, `${where}.machine_z`)];
    if (rawLevels.length > MAX_SURVEY_LEVELS) {
        throw new McpToolError(`${where}: at most ${MAX_SURVEY_LEVELS} z_levels are allowed.`);
    }
    const levels = [...new Set(rawLevels.map((level) => Number(level.toFixed(3))))].sort((a, b) => b - a);
    if (levels.some((level) => level < 0 || level > machineTop())) {
        throw new McpToolError(`${where}: every survey Z must be within machine travel 0..${machineTop()}.`);
    }
    if (belowCameraFloor(levels, motionFloorZ(), POSITION_TOLERANCE_MM, operatorConfirmedClearance).length) {
        throw new McpToolError(`${where}: camera XY below motion floor ${motionFloorZ()} requires explicit operator clearance for this op. An active tool does not bound unmapped obstacles.`);
    }
    const machineZ = args.machine_z === undefined ? null : finite(args.machine_z, `${where}.machine_z`);
    const planeZ = args.plane_z === undefined ? 0 : finite(args.plane_z, `${where}.plane_z`);
    if (args.overlap_fraction !== undefined) {
        const overlap = finite(args.overlap_fraction, `${where}.overlap_fraction`);
        if (overlap < 0 || overlap > MAX_OVERLAP_FRACTION) {
            throw new McpToolError(`${where}: overlap_fraction must be 0..${MAX_OVERLAP_FRACTION}.`);
        }
        const model = cameraModelStore.current();
        if (!model || !judgeCameraModel(model, modelContext(null)).usable) {
            throw new McpToolError(`${where}: overlap_fraction needs a verified camera model.`);
        }
        for (const level of levels) {
            const fov = fovAt(model, { x: virtual.x, y: virtual.y, z: level }, planeZ);
            const derived = pitchForOverlap(fov.widthMm, fov.heightMm, overlap);
            if (!Number.isFinite(derived.x) || !Number.isFinite(derived.y) || Math.min(derived.x, derived.y) <= 0) {
                throw new McpToolError(`${where}: camera model produced an invalid overlap pitch.`);
            }
            pitch = Math.min(pitch, derived.x, derived.y);
        }
    }
    const count = (Math.ceil((xMax - xMin) / pitch) + 1) * (Math.ceil((yMax - yMin) / pitch) + 1) * levels.length;
    if (count > 2000) throw new McpToolError(`${where}: ${count} captures exceed 2000; narrow bounds or reduce overlap.`);
    const xs = gridPoints(xMin, xMax, pitch);
    const ys = gridPoints(yMin, yMax, pitch);
    const waypoints: { x: number; y: number }[] = [];
    ys.forEach((y, row) => (row % 2 === 0 ? xs : [...xs].reverse()).forEach((x) => waypoints.push({ x, y })));
    if (machineZ !== null) validateColumn(virtual, machineZ, where);
    const plan = planSurvey({
        levels,
        waypoints,
        parkZ: safeTraverseZ(),
        fromMachine: { ...virtual, z: machineZ === null ? virtual.z : machineZ },
        obstacles: landmarkStore.obstacleBoxes(),
        ...clearanceOptions(),
    });
    if (!plan.captureCount) throw new McpToolError(`${where}: every waypoint is blocked at every requested level.`);
    return { kind: 'survey_bed', levels, plan, pitch, xs, ys, planeZ, machineZ };
}

function segmentForMove(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): MotionSegment {
    return { kind: 'hop', what: 'camera_program move_and_capture', from, to };
}

function validateMoveAndCapture(args: { [key: string]: unknown }, virtual: { x: number; y: number; z: number }, index: number): void {
    const x = finite(args.x, `ops[${index}].x`);
    const y = finite(args.y, `ops[${index}].y`);
    const z = finite(args.machine_z, `ops[${index}].machine_z`);
    validateColumn(virtual, z, `ops[${index}]`);
    // This is an enumerated, staged program leg. The direct-call 100 mm/pacing
    // cap is not a reason to split an otherwise safe, fully reviewed sequence.
    const travel = requirePlanningTravel('camera_program move_and_capture', virtual);
    if (x < travel.limits.xMin || x > travel.limits.xMax || y < travel.limits.yMin || y > travel.limits.yMax) {
        throw new McpToolError(`ops[${index}] move_and_capture target is outside the toolhead travel.`);
    }
    const route = routeClearanceForPath({ x: virtual.x, y: virtual.y }, { x, y }, undefined, args.operator_confirmed_clearance === true);
    if (z < route.minimumZ - POSITION_TOLERANCE_MM) {
        throw new McpToolError(`ops[${index}] move_and_capture Z${z} is below the route collision requirement ${route.minimumZ}: ${route.note}`);
    }
    const violations = checkMotion(
        [segmentForMove({ ...virtual, z }, { x, y, z })],
        landmarkStore.obstacleBoxes(),
        clearanceOptions(),
    );
    if (violations.length) {
        throw new McpToolError(`ops[${index}] move_and_capture refused: ${describeViolations(violations)}.`);
    }
}

export function planCameraProgram(args: { name?: unknown; reason?: unknown; ops?: unknown; operator_confirmed_clearance?: unknown }): CameraProgramPlan {
    const name = String(args.name || '').trim();
    const reason = String(args.reason || '').trim();
    if (args.operator_confirmed_clearance !== undefined) {
        throw new McpToolError('Program-wide clearance is not accepted. Put operator_confirmed_clearance only on the specific survey_bed or move_and_capture ops the operator explicitly cleared.');
    }
    validateCameraOps(args.ops);
    if (!name || !reason) {
        throw new McpToolError('name and reason are required.');
    }
    if (!Array.isArray(args.ops) || !args.ops.length || args.ops.length > MAX_OPS) {
        throw new McpToolError(`ops is required and must contain 1-${MAX_OPS} operations.`);
    }
    probeFeedService.assertNoOvertravel();
    const snapshot = getPositionSnapshot();
    requireReliableMachine(snapshot, 'a camera program');
    if (snapshot.machine.x === null || snapshot.machine.y === null || snapshot.machine.z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor camera_program.');
    }
    const virtual = { x: snapshot.machine.x, y: snapshot.machine.y, z: snapshot.machine.z };
    const ops: CameraOp[] = [];
    const previews: string[] = [`; CAMERA PROGRAM: ${name}`, `; reason: ${reason}`, '; every operation below is covered by this one operator approval'];
    const surveys: { [id: string]: PlannedSurvey } = {};
    const ids = new Set<string>();
    for (const [index, raw] of args.ops.entries()) {
        if (!raw || typeof raw !== 'object') {
            throw new McpToolError(`ops[${index}] must be an object.`);
        }
        const op = raw as { [key: string]: unknown };
        const id = String(op.id || '');
        const kind = String(op.kind || '') as CameraOpKind;
        if (!ID_PATTERN.test(id) || ids.has(id)) {
            throw new McpToolError(`ops[${index}].id must be unique and match ${ID_PATTERN}.`);
        }
        if (!['move_z', 'survey_bed', 'move_and_capture', 'capture', 'track_feature', 'fit_calibration', 'verify_calibration'].includes(kind)) {
            throw new McpToolError(`ops[${index}].kind is unsupported.`);
        }
        ids.add(id);
        const opArgs = { ...op };
        delete opArgs.id;
        delete opArgs.kind;
        ops.push({ id, kind, args: opArgs });
        if (kind === 'move_z') {
            const z = finite(opArgs.machine_z === undefined ? opArgs.z : opArgs.machine_z, `ops[${index}].machine_z`);
            if (z < 0 || z > machineTop()) {
                throw new McpToolError(`ops[${index}] move_z is outside machine Z 0..${machineTop()}.`);
            }
            validateColumn(virtual, z, `ops[${index}] move_z`);
            previews.push(`; ${id}: assert machine Z${z.toFixed(3)} before the next operation`);
            virtual.z = z;
        } else if (kind === 'survey_bed') {
            const survey = surveyArgs(opArgs, virtual, opArgs.operator_confirmed_clearance === true, `ops[${index}]`);
            surveys[id] = survey;
            previews.push(`; ${id}: survey ${survey.plan.captureCount} waypoint(s) at machine Z ${survey.levels.join(', ')}`);
            previews.push(`; ${id}: pitch ${survey.pitch} mm; physical plane Z${survey.planeZ}; ${survey.plan.dropped.length} dropped waypoint(s); no mosaic`);
            previews.push(...survey.plan.dropped.map((d) => `; ${id}: DROPPED (${d.x}, ${d.y}) Z${d.z}: ${d.reason}`));
            if (survey.machineZ !== null) {
                previews.push(`; ${id}: assert machine Z${survey.machineZ.toFixed(3)} before any survey XY motion`);
            }
            previews.push(...survey.plan.levels.flatMap((level) => level.legs.map((leg) => {
                if (leg.kind === 'capture') return `; ${id}: capture waypoint ${leg.index} at (${leg.x}, ${leg.y}) Z${leg.z}`;
                return `; ${id}: ${leg.kind} (${leg.x}, ${leg.y}) Z${leg.z}`;
            })));
            const legs = survey.plan.levels.flatMap((level) => level.legs);
            const last = legs[legs.length - 1];
            if (last) Object.assign(virtual, { x: last.x, y: last.y, z: last.z });
        } else if (kind === 'move_and_capture') {
            validateMoveAndCapture(opArgs, virtual, index);
            const x = finite(opArgs.x, `ops[${index}].x`);
            const y = finite(opArgs.y, `ops[${index}].y`);
            const z = finite(opArgs.machine_z, `ops[${index}].machine_z`);
            previews.push(`; ${id}: move machine Z${z.toFixed(3)} then XY (${x.toFixed(3)}, ${y.toFixed(3)}) and capture`);
            Object.assign(virtual, { x, y, z });
        } else if (kind === 'capture') {
            previews.push(`; ${id}: capture at the verified position (no motion)`);
        } else if (kind === 'track_feature') {
            const template = String(opArgs.template_capture_id || '');
            const search = String(opArgs.search_capture_id || '');
            if (!ids.has(template) || !ids.has(search)) {
                throw new McpToolError(`ops[${index}] track_feature must reference earlier capture operation ids.`);
            }
            const point = opArgs.point as { u?: unknown; v?: unknown };
            finite(point?.u, `ops[${index}].point.u`);
            finite(point?.v, `ops[${index}].point.v`);
            previews.push(`; ${id}: track feature from ${template} to ${search} using NCC (no motion)`);
        } else if (kind === 'fit_calibration') {
            if (!Array.isArray(opArgs.samples) || opArgs.samples.length < 2) {
                throw new McpToolError(`ops[${index}] fit_calibration needs at least two {track_id, dx_mm, dy_mm} samples.`);
            }
            for (const sample of opArgs.samples as Array<{ track_id?: unknown; dx_mm?: unknown; dy_mm?: unknown }>) {
                if (!ids.has(String(sample.track_id || ''))) throw new McpToolError(`ops[${index}] fit sample references a later or unknown track_feature.`);
                finite(sample.dx_mm, `ops[${index}].samples.dx_mm`);
                finite(sample.dy_mm, `ops[${index}].samples.dy_mm`);
            }
            previews.push(`; ${id}: fit forward pixel/mm Jacobian from ${opArgs.samples.length} tracked displacement(s), reject poor residuals, store +J^-1`);
        } else {
            const fit = String(opArgs.fit_id || '');
            if (fit && !ids.has(fit)) throw new McpToolError(`ops[${index}] verify_calibration references an earlier fit_calibration.`);
            previews.push(`; ${id}: verify M.J ~= identity${fit ? ` for fit ${fit}` : ''} before accepting the calibration`);
        }
        if (opArgs.operator_confirmed_clearance === true) previews.push(`; ${id}: OPERATOR CLEARANCE EXCEPTION for this op only; stored obstacles still checked`);
        if (['track_feature', 'fit_calibration', 'verify_calibration'].includes(kind)) {
            previews.push(`; ${id}: parameters ${JSON.stringify(opArgs)}`);
        }
    }
    return {
        name,
        reason,
        ops,
        previews,
        staged: { x: snapshot.machine.x, y: snapshot.machine.y, z: snapshot.machine.z },
        keepOut: [],
        surveys,
        operatorConfirmedClearance: false,
    };
}

function inverse(matrix: [[number, number], [number, number]]): [[number, number], [number, number]] {
    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) throw new McpToolError('Camera calibration fit is singular; use independent X/Y motions and a non-repetitive feature.');
    return [[matrix[1][1] / det, -matrix[0][1] / det], [-matrix[1][0] / det, matrix[0][0] / det]];
}

interface FitResult {
    jacobian: [[number, number], [number, number]];
    matrix: [[number, number], [number, number]];
    rmsePx: number;
    maxResidualPx: number;
}

function fitJacobian(
    samples: Array<{ dx: number; dy: number; du: number; dv: number }>,
    maxResidualPx: number,
): FitResult {
    let xx = 0; let xy = 0; let yy = 0;
    let xdu = 0; let ydu = 0; let xdv = 0; let ydv = 0;
    for (const sample of samples) {
        xx += sample.dx * sample.dx;
        xy += sample.dx * sample.dy;
        yy += sample.dy * sample.dy;
        xdu += sample.dx * sample.du;
        ydu += sample.dy * sample.du;
        xdv += sample.dx * sample.dv;
        ydv += sample.dy * sample.dv;
    }
    const det = xx * yy - xy * xy;
    if (Math.abs(det) < 1e-9) throw new McpToolError('Calibration fit needs non-collinear commanded motions.');
    const jacobian: [[number, number], [number, number]] = [
        [(xdu * yy - ydu * xy) / det, (ydu * xx - xdu * xy) / det],
        [(xdv * yy - ydv * xy) / det, (ydv * xx - xdv * xy) / det],
    ];
    const matrix = inverse(jacobian);
    const residuals = samples.map((sample) => {
        const du = jacobian[0][0] * sample.dx + jacobian[0][1] * sample.dy;
        const dv = jacobian[1][0] * sample.dx + jacobian[1][1] * sample.dy;
        return Math.hypot(du - sample.du, dv - sample.dv);
    });
    const rmsePx = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / residuals.length);
    const max = Math.max(...residuals);
    if (max > maxResidualPx) {
        throw new McpToolError(`Calibration fit rejected: maximum residual ${max.toFixed(2)} px exceeds ${maxResidualPx.toFixed(2)} px. Check feature tracking, repetitive matches, and depth plane.`);
    }
    return { jacobian, matrix, rmsePx, maxResidualPx: max };
}

function verify(jacobian: [[number, number], [number, number]], matrix: [[number, number], [number, number]], tolerance: number): object {
    const product = [
        [matrix[0][0] * jacobian[0][0] + matrix[0][1] * jacobian[1][0], matrix[0][0] * jacobian[0][1] + matrix[0][1] * jacobian[1][1]],
        [matrix[1][0] * jacobian[0][0] + matrix[1][1] * jacobian[1][0], matrix[1][0] * jacobian[0][1] + matrix[1][1] * jacobian[1][1]],
    ];
    const residual = Math.max(Math.abs(product[0][0] - 1), Math.abs(product[1][1] - 1), Math.abs(product[0][1]), Math.abs(product[1][0]));
    if (residual > tolerance) throw new McpToolError(`Calibration verification rejected: M.J residual ${residual.toFixed(3)} exceeds ${tolerance.toFixed(3)}.`);
    return { product, residual, verified: true };
}

export function describeCameraProgram(plan: CameraProgramPlan): string {
    return [
        `; reason: ${plan.reason}`,
        `; staged anchor machine (${plan.staged.x}, ${plan.staged.y}, ${plan.staged.z})`,
        ...plan.previews,
        '; every XY leg is checked against active-tool clearance and stored obstacle geometry before this page is shown',
        'G90',
        'G53;',
        'G54;',
    ].join('\n');
}

export async function runCameraProgramProcedure(plan: CameraProgramPlan): Promise<object> {
    assertMachineReadyForProcedure();
    const anchor = getPositionSnapshot().machine;
    if (anchor.x === null || anchor.y === null || anchor.z === null
        || Math.hypot(anchor.x - plan.staged.x, anchor.y - plan.staged.y, anchor.z - plan.staged.z) > POSITION_TOLERANCE_MM) {
        throw new McpToolError('Camera program anchor changed since staging; stage a new plan from the verified position.');
    }
    // Recheck the complete envelope with the current tool, landmarks and model
    // before sending anything, without enlarging the approved waypoint plan.
    const livePlan = planCameraProgram({ name: plan.name, reason: plan.reason, ops: plan.ops.map((op) => ({ id: op.id, kind: op.kind, ...op.args })) });
    if (JSON.stringify(livePlan.previews) !== JSON.stringify(plan.previews)) throw new McpToolError('Camera plan changed since approval; restage for review.');
    const startedAt = Date.now();
    const results: Record<string, unknown> = {};
    const phases: object[] = [];
    const announce = (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool: 'camera_program', phase, note });
    };
    try {
        for (const [index, op] of plan.ops.entries()) {
            checkProcedureStop();
            announce(`op-${op.id}-start`, `${index + 1}/${plan.ops.length} ${op.kind}`);
            if (op.kind === 'move_z') {
                const z = finite(op.args.machine_z === undefined ? op.args.z : op.args.machine_z, `${op.id}.machine_z`);
                await moveMachineSettled(`camera_program:${op.id}`, { z }, TRAVEL_FEED);
                results[op.id] = { machine_z: z };
            } else if (op.kind === 'survey_bed') {
                const survey = plan.surveys[op.id];
                const frames: object[] = [];
                results[op.id] = { levels: survey.levels, frames, incomplete: true };
                if (survey.machineZ !== null) {
                    const live = getPositionSnapshot().machine.z;
                    if (live === null || Math.abs(live - survey.machineZ) > POSITION_TOLERANCE_MM) {
                        await moveMachineSettled(`camera_program:${op.id}:assert-z`, { z: survey.machineZ }, TRAVEL_FEED);
                    }
                    const verified = getPositionSnapshot().machine.z;
                    if (verified === null || Math.abs(verified - survey.machineZ) > POSITION_TOLERANCE_MM) {
                        throw new McpToolError(`camera_program ${op.id}: explicit machine_z was not verified before XY motion.`);
                    }
                }
                for (const level of survey.plan.levels) {
                    for (const leg of level.legs as SurveyLeg[]) {
                        checkProcedureStop();
                        if (leg.kind === 'raise' || leg.kind === 'descend') {
                            await moveMachineSettled(`camera_program:${op.id}:z`, { z: leg.z }, TRAVEL_FEED);
                        } else if (leg.kind === 'hop') {
                            await moveMachineSettled(`camera_program:${op.id}:xy`, { x: leg.x, y: leg.y }, TRAVEL_FEED * SURVEY_LINK_FEED_FACTOR);
                        } else {
                            const frame = await captureFrame();
                            const file = programFramePath(startedAt, plan.name, `${op.id}_z${level.z}_wp${leg.index}`);
                            fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
                            frames.push({ frame_id: frame.frameId, file, machine: { x: leg.x, y: leg.y, z: leg.z }, captured_at: frame.capturedAt });
                        }
                    }
                }
                results[op.id] = { levels: survey.levels, frame_count: frames.length, frames };
            } else if (op.kind === 'move_and_capture') {
                const z = finite(op.args.machine_z, `${op.id}.machine_z`);
                const x = finite(op.args.x, `${op.id}.x`);
                const y = finite(op.args.y, `${op.id}.y`);
                const liveZ = getPositionSnapshot().machine.z;
                if (liveZ === null || Math.abs(liveZ - z) > POSITION_TOLERANCE_MM) await moveMachineSettled(`camera_program:${op.id}:z`, { z }, TRAVEL_FEED);
                await moveMachineSettled(`camera_program:${op.id}:xy`, { x, y }, TRAVEL_FEED * SURVEY_LINK_FEED_FACTOR);
                const frame = await captureFrame();
                const file = programFramePath(startedAt, plan.name, op.id);
                fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
                results[op.id] = { frame_id: frame.frameId, file, machine: getPositionSnapshot().machine, captured_at: frame.capturedAt };
            } else if (op.kind === 'capture') {
                const frame = await captureFrame();
                const snapshot = getPositionSnapshot();
                const file = programFramePath(startedAt, plan.name, op.id);
                fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
                results[op.id] = { frameId: frame.frameId, file, machine: snapshot.machine, capturedAt: frame.capturedAt } as FrameResult;
                announce(`op-${op.id}-frame`, frameLine(op.id, results[op.id] as FrameResult));
            } else if (op.kind === 'track_feature') {
                const template = results[String(op.args.template_capture_id)] as { frameId?: string; frame_id?: string; file?: string } | undefined;
                const search = results[String(op.args.search_capture_id)] as { frameId?: string; frame_id?: string; file?: string } | undefined;
                const templateId = template?.frameId || template?.frame_id;
                const searchId = search?.frameId || search?.frame_id;
                const templateJpg = template?.file ? fs.readFileSync(template.file) : getCachedFrame(String(templateId || ''));
                const searchJpg = search?.file ? fs.readFileSync(search.file) : getCachedFrame(String(searchId || ''));
                if (!templateJpg || !searchJpg) throw new McpToolError(`camera_program ${op.id}: referenced capture is no longer in the frame cache.`);
                const point = op.args.point as { u?: unknown; v?: unknown };
                const tracked = trackFeature(decodeToGray(templateJpg), decodeToGray(searchJpg),
                    Math.round(Number(point.u)), Math.round(Number(point.v)), 41, 120);
                results[op.id] = tracked;
            } else if (op.kind === 'fit_calibration') {
                const samples = (op.args.samples as Array<{ track_id: string; dx_mm: number; dy_mm: number }>).map((sample) => {
                    const tracked = results[String(sample.track_id)] as { du?: number; dv?: number } | undefined;
                    if (!tracked) throw new McpToolError(`camera_program ${op.id}: track result ${sample.track_id} is missing.`);
                    return { dx: Number(sample.dx_mm), dy: Number(sample.dy_mm), du: Number(tracked.du), dv: Number(tracked.dv) };
                });
                const maxResidual = op.args.max_residual_px === undefined ? 5 : finite(op.args.max_residual_px, `${op.id}.max_residual_px`);
                const fit = fitJacobian(samples, maxResidual);
                const position = getPositionSnapshot().machine;
                const entry = calibrationStore.add({
                    validAtY: op.args.valid_at_y === undefined ? Number(position.y) : finite(op.args.valid_at_y, `${op.id}.valid_at_y`),
                    z: op.args.z === undefined ? Number(position.z) : finite(op.args.z, `${op.id}.z`),
                    matrix: fit.matrix,
                    surface: op.args.surface ? String(op.args.surface) : null,
                    notes: `camera_program ${plan.name}; residual RMSE ${fit.rmsePx.toFixed(3)} px; ${String(op.args.notes || '')}`.trim(),
                });
                results[op.id] = { ...fit, entry };
            } else {
                let jacobian: [[number, number], [number, number]];
                let matrix: [[number, number], [number, number]];
                if (op.args.fit_id) {
                    const fit = results[String(op.args.fit_id)] as FitResult | undefined;
                    if (!fit) throw new McpToolError(`camera_program ${op.id}: fit result is missing.`);
                    jacobian = fit.jacobian;
                    matrix = fit.matrix;
                } else {
                    jacobian = op.args.jacobian as [[number, number], [number, number]];
                    matrix = op.args.matrix as [[number, number], [number, number]];
                }
                if (!Array.isArray(jacobian) || !Array.isArray(matrix)) throw new McpToolError(`camera_program ${op.id}: provide fit_id or both jacobian and matrix.`);
                results[op.id] = verify(jacobian, matrix, op.args.tolerance === undefined ? 0.25 : finite(op.args.tolerance, `${op.id}.tolerance`));
            }
            announce(`op-${op.id}-done`);
        }
        return { name: plan.name, ops: results, phases, finalMachine: getPositionSnapshot().machine, durationMs: Date.now() - startedAt, note: `Camera program ${plan.name} completed with one operator approval.` };
    } catch (err) {
        return cameraFailure('camera_program', err, { name: plan.name, ops: results, phases });
    }
}

export function registerCameraProgramTool(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: 'camera_program',
        description: 'Stage one camera procedure; each op uses {id, kind, ...fields} from ops.items.oneOf. Homed, idle, toolhead off. Camera XY obeys the motion floor even with an active tool; operator clearance exceptions are per-op only. machine_z is TOOLHEAD machine Z; plane_z is PHYSICAL surface Z. fit_calibration stores a local 2x2 matrix, NOT the camera model. verify_calibration only checks M*J, not a held-out target. Program surveys save frames but no mosaic (use standalone survey_bed for mosaics). Result.ops is keyed by id: captures have file/machine, tracks have du/dv, fits have matrix/jacobian/residuals/entry. Deliver confirm_url and end the turn before start_gcode_job.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                reason: { type: 'string' },
                ops: { type: 'array', minItems: 1, maxItems: MAX_OPS, items: { oneOf: Object.values(cameraOpSchemas) } },
            },
            required: ['name', 'reason', 'ops'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const plan = planCameraProgram(args);
            const review = describeCameraProgram(plan);
            const validation = validateStagedEnvelope(review, 'camera_program');
            const job = jobManager.submit(review, `camera-program ${plan.name}`, 'cnc', validation, 'procedure');
            job.runner = async () => runCameraProgramProcedure(plan);
            return {
                job: jobManager.describe(job),
                operations: plan.ops.map((op) => ({ id: op.id, kind: op.kind })),
                preview: plan.previews,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to review the complete camera program on confirm_url and approve it. Then start_gcode_job runs the whole enumerated sequence under that single approval.',
            };
        },
    });
}
