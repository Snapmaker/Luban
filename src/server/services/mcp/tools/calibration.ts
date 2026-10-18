/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import { CalibrationEntry, calibrationStore } from '../calibration';
import { jacobianAt } from '../cameraGeometry';
import { judgeCameraModel } from '../cameraModel';
import { cameraModelStore } from '../cameraModelStore';
import { modelContext } from './cameraModel';
import { McpToolError, ToolRegistry } from '../registry';
import { executeBoundedMoveAndCapture } from './camera';
import { getPositionSnapshot } from './machine';
import { connectedMachineIdentifier } from '../connectedMachine';
import { appliesToMachine } from '../machineCapability';

// visual_servo executes ONE correction step per call - the agent supplies
// the pixel error, the stored calibration turns it into a machine XY move,
// and the loop lives in the agent, not here. Each step goes through the
// same guarded single-move path as move_and_capture (#23).

const DEFAULT_STEP_LIMIT_MM = 5;
const MAX_STEP_LIMIT_MM = 20;
const DEFAULT_Y_TOLERANCE_MM = 2;
// Auto-select gives up only beyond this - a single servo step routinely
// drifts Y by 2-6mm, so the old hard 2mm cutoff forced explicit ids.
const MAX_Y_DISTANCE_MM = 25;

function isMatrix(value: unknown): value is [[number, number], [number, number]] {
    return Array.isArray(value) && value.length === 2
        && value.every((row) => Array.isArray(row) && row.length === 2
            && row.every((cell) => Number.isFinite(Number(cell))));
}

function describeEntry(entry: CalibrationEntry): object {
    // Which machine the matrix belongs to, and whether it applies to the one
    // connected now (machineCapability.ts; untagged = the A350 by rule).
    return {
        ...entry,
        machineScope: {
            machineIdentifier: entry.machineIdentifier,
            legacy: entry.legacyScope === true,
            appliesToConnectedMachine: appliesToMachine(entry.machineIdentifier, connectedMachineIdentifier()),
        },
    };
}

export function registerCalibrationTools(registry: ToolRegistry): void {
    // Divergence tripwire: a sign-flipped matrix makes each "correction" grow
    // the error. Remember the last step per calibration+target and warn the
    // moment the error fails to shrink - one wasted step instead of a manual
    // catch several steps later.
    let lastServoStep: {
        calibrationId: string;
        tu: number;
        tv: number;
        magnitude: number;
        du: number;
        dv: number;
        appliedDx: number;
        appliedDy: number;
        matrix: [[number, number], [number, number]];
        at: number;
    } | null = null;
    registry.register({
        name: 'set_camera_calibration',
        description: 'Persist a pixel-to-machine calibration, keyed by the machine Y it was '
            + 'derived at (the SM2 platform travels in Y, so a mapping is only valid at that Y). '
            + 'matrix maps a pixel delta [du, dv] to the machine XY move [dx, dy] in mm that '
            + 'cancels it - i.e. M = +J^-1 where J is the forward Jacobian (pixel shift per mm of '
            + 'machine move), and visual_servo applies M to error = target - feature. VERIFY THE '
            + 'SIGN before storing: J.(M.e) must reproduce +e, not -e - a flipped M silently '
            + 'drives the servo away from the target. Survives restarts.',
        inputSchema: {
            type: 'object',
            properties: {
                valid_at_y: { type: 'number', description: 'Machine Y the calibration frame was captured at.' },
                z: { type: 'number', description: 'Machine Z the calibration frame was captured at.' },
                matrix: {
                    type: 'array',
                    description: '2x2 row-major: [[m00, m01], [m10, m11]]; [dx, dy] = M . [du, dv].',
                    items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                    minItems: 2,
                    maxItems: 2,
                },
                notes: { type: 'string', description: 'Free-form provenance: grid used, residuals, tilt.' },
                surface: {
                    type: 'string',
                    description: 'Physical surface the calibration was derived on (e.g. "board", '
                        + '"bracket"). A matrix is only valid on its own depth plane - cross-plane '
                        + 'use read ~4x wrong on hardware.',
                },
                jacobian: {
                    type: 'array',
                    description: 'Optional 2x2 forward Jacobian J (pixel shift per mm) you fitted. When '
                        + 'given, the tool checks M.J against +identity and REJECTS a sign-flipped matrix '
                        + 'before it can reach hardware.',
                    items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                    minItems: 2,
                    maxItems: 2,
                },
            },
            required: ['valid_at_y', 'z', 'matrix'],
            additionalProperties: false,
        },
        handler: async (args: { valid_at_y?: number; z?: number; matrix?: unknown; notes?: string; surface?: string; jacobian?: unknown }) => {
            const validAtY = Number(args.valid_at_y);
            const z = Number(args.z);
            if (!Number.isFinite(validAtY) || !Number.isFinite(z)) {
                throw new McpToolError('valid_at_y and z must be finite numbers.');
            }
            if (!isMatrix(args.matrix)) {
                throw new McpToolError('matrix must be a 2x2 array of numbers.');
            }

            const warnings: string[] = [];
            if (args.jacobian !== undefined) {
                if (!isMatrix(args.jacobian)) {
                    throw new McpToolError('jacobian must be a 2x2 array of numbers.');
                }
                // P = M.J should be +identity: -identity is the sign flip that
                // drives the servo away from the target - reject it outright.
                const m = args.matrix;
                const j = args.jacobian;
                const p = [
                    [m[0][0] * j[0][0] + m[0][1] * j[1][0], m[0][0] * j[0][1] + m[0][1] * j[1][1]],
                    [m[1][0] * j[0][0] + m[1][1] * j[1][0], m[1][0] * j[0][1] + m[1][1] * j[1][1]],
                ];
                const devPlus = Math.max(Math.abs(p[0][0] - 1), Math.abs(p[1][1] - 1), Math.abs(p[0][1]), Math.abs(p[1][0]));
                const devMinus = Math.max(Math.abs(p[0][0] + 1), Math.abs(p[1][1] + 1), Math.abs(p[0][1]), Math.abs(p[1][0]));
                if (devMinus < devPlus && devMinus < 0.5) {
                    throw new McpToolError('REJECTED: matrix is sign-flipped - M.J is approximately -identity, '
                        + 'so every correction would drive AWAY from the target. Store M = +J^-1, not -J^-1.');
                }
                if (devPlus > 0.25) {
                    warnings.push(`M.J deviates from identity (max residual ${devPlus.toFixed(2)}) - the matrix `
                        + 'may be inaccurate; expect slow or wandering convergence.');
                }
            }

            let entry: CalibrationEntry;
            try {
                // Tagged with the connected machine: a matrix at "machine Y 199" is about one gantry.
                entry = calibrationStore.add({
                    validAtY,
                    z,
                    matrix: args.matrix,
                    surface: args.surface ? String(args.surface) : null,
                    notes: args.notes ? String(args.notes) : null,
                });
            } catch (err) {
                throw new McpToolError((err as Error).message);
            }
            return { entry: describeEntry(entry), warnings };
        },
    });

    registry.register({
        name: 'get_camera_calibration',
        description: 'Fetch calibrations: by id, nearest to a machine Y (within tolerance), or all. '
            + 'Read-only.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                y: { type: 'number', description: 'Machine Y to match against valid_at_y.' },
                tolerance_mm: { type: 'number', description: `Match tolerance for y, default ${DEFAULT_Y_TOLERANCE_MM}.` },
            },
            additionalProperties: false,
        },
        handler: async (args: { id?: string; y?: number; tolerance_mm?: number }) => {
            if (args.id) {
                const entry = calibrationStore.get(String(args.id));
                if (!entry) {
                    throw new McpToolError('Unknown calibration id.');
                }
                return { entry: describeEntry(entry) };
            }
            if (args.y !== undefined) {
                const tolerance = Number(args.tolerance_mm) || DEFAULT_Y_TOLERANCE_MM;
                const match = calibrationStore.findNearest(Number(args.y), tolerance);
                return {
                    entry: match ? describeEntry(match.entry) : null,
                    distance_mm: match ? match.distance : null,
                    all: calibrationStore.list().map((e) => ({ id: e.id, validAtY: e.validAtY, z: e.z })),
                };
            }
            return { entries: calibrationStore.list().map(describeEntry) };
        },
    });

    registry.register({
        name: 'delete_camera_calibration',
        description: 'Delete one stored calibration by id.',
        inputSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
        },
        handler: async (args: { id?: string }) => {
            const removed = calibrationStore.remove(String(args.id || ''));
            if (!removed) {
                throw new McpToolError('Unknown calibration id.');
            }
            return { removed: true };
        },
    });

    registry.register({
        name: 'visual_servo',
        description: 'One visual-servo correction step: computes error = target_pixel - '
            + 'feature_pixel (this exact convention), applies the stored matrix to it, executes '
            + 'the machine XY move through the same guarded single-move path as move_and_capture, '
            + 'and returns the new frame. The iteration loop belongs to the caller. Step size is '
            + `clamped (max_step_mm, default ${DEFAULT_STEP_LIMIT_MM}, cap ${MAX_STEP_LIMIT_MM}). `
            + 'If the pixel error GROWS between consecutive steps with the same calibration and '
            + 'target, the response warns of a likely sign-flipped matrix - stop and re-verify '
            + 'rather than iterating.',
        inputSchema: {
            type: 'object',
            properties: {
                feature_pixel: {
                    type: 'object',
                    properties: { u: { type: 'number' }, v: { type: 'number' } },
                    required: ['u', 'v'],
                    description: 'Where the feature currently images.',
                },
                target_pixel: {
                    type: 'object',
                    properties: { u: { type: 'number' }, v: { type: 'number' } },
                    required: ['u', 'v'],
                    description: 'Where the feature should image.',
                },
                plane_z: {
                    type: 'number',
                    description: 'Machine Z of the plane the tracked feature sits ON. Given this, and a verified '
                        + 'camera model, the pixel-to-machine matrix is derived from the model at this exact pose '
                        + 'instead of read from a stored calibration - which is both more accurate and able to say '
                        + 'whether it is still about the camera that is plugged in. Omit to use a stored matrix.',
                },
                calibration_id: { type: 'string', description: 'Omit to auto-select nearest to the current machine Y.' },
                max_step_mm: { type: 'number' },
                feed_rate: { type: 'number' },
                operator_confirmed_clearance: {
                    type: 'boolean',
                    description: 'Set true ONLY when the human operator has explicitly confirmed the '
                        + 'current Z and an obstacle-free path at this Z; skips the homed-first requirement.',
                },
            },
            required: ['feature_pixel', 'target_pixel'],
            additionalProperties: false,
        },
        handler: async (args: {
            feature_pixel?: { u?: number; v?: number };
            target_pixel?: { u?: number; v?: number };
            calibration_id?: string;
            plane_z?: number;
            max_step_mm?: number;
            feed_rate?: number;
            operator_confirmed_clearance?: boolean;
        }) => {
            const du = Number(args.target_pixel?.u) - Number(args.feature_pixel?.u);
            const dv = Number(args.target_pixel?.v) - Number(args.feature_pixel?.v);
            if (!Number.isFinite(du) || !Number.isFinite(dv)) {
                throw new McpToolError('feature_pixel and target_pixel must have numeric u and v.');
            }

            const position = getPositionSnapshot();
            if (position.machine.x === null || position.machine.y === null) {
                throw new McpToolError('Current machine position unknown.');
            }

            // The camera model, when there is a verified one and a depth plane
            // to solve on, is the better answer: the stored 2x2 IS that model
            // linearised at one Y and one Z, and unlike the model it cannot say
            // whether it is still about the camera that is plugged in. Derived
            // here as an entry so everything downstream - the sign check, the
            // depth-plane cross-check, the series memory - is untouched.
            const model = cameraModelStore.current();
            let entry: CalibrationEntry | null = null;
            let entryDistance: number | null = null;
            let derivedFromModel = false;
            if (model && judgeCameraModel(model, modelContext(null)).usable && Number.isFinite(Number(args.plane_z))) {
                const planeZ = Number(args.plane_z);
                const toolhead = {
                    x: position.machine.x as number,
                    y: position.machine.y as number,
                    z: position.machine.z as number,
                };
                entry = {
                    id: model.id,
                    validAtY: toolhead.y,
                    z: toolhead.z,
                    matrix: jacobianAt(model, toolhead, planeZ),
                    surface: `plane machine Z ${planeZ}`,
                    notes: `derived from camera model ${model.id} at this pose - not a stored calibration`,
                    createdAt: model.solvedAt,
                    // Solved against the live position of record, so it is the connected machine's by construction.
                    machineIdentifier: connectedMachineIdentifier() || 'connected machine',
                };
                entryDistance = 0;
                derivedFromModel = true;
            } else if (args.calibration_id) {
                entry = calibrationStore.get(String(args.calibration_id));
                if (!entry) {
                    throw new McpToolError('Unknown calibration id.');
                }
                entryDistance = Math.abs(entry.validAtY - position.machine.y);
            } else {
                const match = calibrationStore.findNearest(position.machine.y, MAX_Y_DISTANCE_MM);
                if (!match) {
                    throw new McpToolError(`No calibration within ${MAX_Y_DISTANCE_MM} mm of machine Y `
                        + `${position.machine.y.toFixed(1)}, and no verified camera model to derive one from. `
                        + 'Either run camera_bootstrap and pass plane_z (preferred - it says which camera it is '
                        + 'about and survives a change of pose), or store a matrix with set_camera_calibration.');
                }
                entry = match.entry;
                entryDistance = match.distance;
            }

            const [[m00, m01], [m10, m11]] = (entry as CalibrationEntry).matrix;
            let dx = m00 * du + m01 * dv;
            let dy = m10 * du + m11 * dv;

            const stepLimit = Math.min(Number(args.max_step_mm) || DEFAULT_STEP_LIMIT_MM, MAX_STEP_LIMIT_MM);
            const magnitude = Math.hypot(dx, dy);
            const clamped = magnitude > stepLimit;
            if (clamped && magnitude > 0) {
                dx *= stepLimit / magnitude;
                dy *= stepLimit / magnitude;
            }

            const warnings: string[] = [];
            const errorMagnitude = Math.hypot(du, dv);
            const tu = Number(args.target_pixel?.u);
            const tv = Number(args.target_pixel?.v);
            const previousStep = lastServoStep;
            const sameSeries = previousStep
                && previousStep.calibrationId === entry.id
                && Math.abs(previousStep.tu - tu) < 5 && Math.abs(previousStep.tv - tv) < 5
                && Date.now() - previousStep.at < 10 * 60 * 1000;
            if (sameSeries && errorMagnitude >= previousStep.magnitude * 0.95) {
                warnings.push('Pixel error did not shrink after the previous servo step with this calibration '
                    + `(${previousStep.magnitude.toFixed(1)}px -> ${errorMagnitude.toFixed(1)}px). A sign-flipped or `
                    + 'badly scaled matrix drives AWAY from the target: verify J.(M.e) reproduces +e before '
                    + 'iterating further.');
            }
            // Depth-plane / wrong-match cross-check (#51): predict this step
            // error from the last one using J = inverse(M) and the applied
            // move; sharp divergence means the tracked feature sits on a
            // different physical surface than the calibration (parallax read
            // ~4x wrong on hardware) or the match latched onto the wrong spot.
            if (sameSeries) {
                const m = previousStep.matrix;
                const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
                if (Math.abs(det) > 1e-9) {
                    const j = [
                        [m[1][1] / det, -m[0][1] / det],
                        [-m[1][0] / det, m[0][0] / det],
                    ];
                    const predDu = previousStep.du - (j[0][0] * previousStep.appliedDx + j[0][1] * previousStep.appliedDy);
                    const predDv = previousStep.dv - (j[1][0] * previousStep.appliedDx + j[1][1] * previousStep.appliedDy);
                    const expectedChange = Math.hypot(previousStep.du - predDu, previousStep.dv - predDv);
                    const deviation = Math.hypot(du - predDu, dv - predDv);
                    if (expectedChange > 3 && deviation > Math.max(0.5 * expectedChange, 5)) {
                        warnings.push('Measured response diverges from the calibration prediction (expected error near '
                            + `(${predDu.toFixed(0)}, ${predDv.toFixed(0)})px, measured (${du.toFixed(0)}, ${dv.toFixed(0)})px). `
                            + 'Likely a depth-plane mismatch - the feature sits on a different surface than the calibration'
                            + `${entry.surface ? ` (derived on "${entry.surface}")` : ''} - or the tracked match is wrong. `
                            + 'Re-derive on the working surface before iterating.');
                    }
                }
            }
            if (derivedFromModel) {
                warnings.push(`The 2x2 was derived from camera model ${(entry as CalibrationEntry).id} at this pose `
                    + `on the plane machine Z ${args.plane_z}, not read from a stored calibration. If the feature is `
                    + 'not on that plane, say so with the right plane_z rather than iterating.');
            }
            if (entryDistance !== null && entryDistance > DEFAULT_Y_TOLERANCE_MM) {
                warnings.push(`Calibration ${entry.id} is ${entryDistance.toFixed(1)} mm from the current Y; scale may be off.`);
            }
            if (Math.abs(dy) > DEFAULT_Y_TOLERANCE_MM) {
                warnings.push('This step moves Y; the calibration is keyed to Y, so re-derive or re-select after the move.');
            }

            const result = await executeBoundedMoveAndCapture({
                x: position.machine.x + dx,
                y: position.machine.y + dy,
                coordinate_system: 'machine',
                reason: 'visual servo correction step',
                feed_rate: args.feed_rate,
                operator_confirmed_clearance: args.operator_confirmed_clearance,
            }) as { mcpContent: object[] };

            lastServoStep = {
                calibrationId: entry.id,
                tu,
                tv,
                magnitude: errorMagnitude,
                du,
                dv,
                appliedDx: dx,
                appliedDy: dy,
                matrix: entry.matrix,
                at: Date.now(),
            };

            // Splice servo metadata into the text part of the frame result.
            const servoMeta = {
                pixel_error: { du, dv },
                applied_mm: { dx, dy },
                clamped,
                calibration: { id: entry.id, validAtY: entry.validAtY, z: entry.z, distance_mm: entryDistance },
                warnings,
            };
            return {
                mcpContent: [
                    ...result.mcpContent,
                    { type: 'text', text: JSON.stringify({ visual_servo: servoMeta }) },
                ],
            };
        },
    });
}
