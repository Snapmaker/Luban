/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import config from '../../configstore';
import { connectionManager } from '../../machine/ConnectionManager';
import { calibrationStore } from '../calibration';
import { cameraStreamService } from '../cameraStream';
import { Landmark, landmarkStore } from '../landmarks';
import { gcodeUploads, jobInbox } from '../jobs';
import { probeFeedService } from '../probeFeed';
import { McpToolError, ToolRegistry } from '../registry';
import { GEOMETRY_FIELDS, ROTARY_AXIS_POINTS_FIELD, geometrySettings, setGeometryValues } from '../rotaryGeometry';
import { connectedMachineCapability, connectedMachineIdentifier, describeConnectedMachine } from '../connectedMachine';
import { LEGACY_MACHINE_IDENTIFIER, appliesToMachine } from '../machineCapability';
import { MAX_ROTARY_AXIS_POINTS } from '../procedureLimits';
import { getMeasurements, getToolSetterConfig } from '../toolSetter';
import { describeActiveTool } from '../activeTool';
import { currentSetterDatum, getProbeTipCalibration } from '../toolDatumState';
import { currentToolProtrusion } from '../clearanceContext';
import {
    CLEARANCE_MARGIN_MM,
    ClearanceBasis,
    needsRestatement,
    requiredToolheadZ,
    restatementAdvice,
} from '../landmarkClearance';
import { describePlanningTravel, motionFloorZ, planningTravel, readAppMachineSettings, safeTraverseZ, travelFudge } from './machine';
import { vibrationCaptureService } from '../vibrationCaptures';
import { vibrationFeedService } from '../vibrationFeed';

// Named scene landmarks (#50) and the stored-state overview (#53): operator
// knowledge captured once, surfaced every session, so no agent spends moves
// re-deriving what the operator already said.

/**
 * A landmark plus what its clearance actually demands of the toolhead right
 * now, and - for a record still on the legacy basis - what to do about it.
 * An agent reading get_stored_state should not have to work out that a
 * clearance of 328 is a toolhead height with a probe baked into it.
 */
function landmarkScope(landmark: Landmark): object {
    return {
        machineIdentifier: landmark.machineIdentifier,
        /** Attributed by the legacy rule (untagged = the A350) rather than recorded when set. */
        legacy: landmark.legacyScope === true,
        appliesToConnectedMachine: appliesToMachine(landmark.machineIdentifier, connectedMachineIdentifier()),
    };
}

/**
 * The machine a new record is tagged with: the connected machine, else the
 * one selected in Luban Machine Settings (an operator can describe a bed
 * while the machine is off). Refused when neither names one.
 */
function machineForNewRecord(what: string): string {
    const connected = connectedMachineIdentifier();
    if (connected) {
        return connected;
    }
    const settings = readAppMachineSettings();
    if (settings && settings.series) {
        return settings.series;
    }
    throw new McpToolError(`${what} is machine coordinates on ONE machine, and no machine is connected or selected in Luban `
        + 'Machine Settings to tag it with. Connect or select the machine first.');
}

function describeLandmark(landmark: Landmark): object {
    if (landmark.clearanceZ === null) {
        return { ...landmark, machineScope: landmarkScope(landmark), requiredToolheadZ: null };
    }
    const protrusion = currentToolProtrusion();
    const required = requiredToolheadZ(landmark.clearanceZ, landmark.clearanceBasis, protrusion.mm);
    return {
        ...landmark,
        machineScope: landmarkScope(landmark),
        requiredToolheadZ: required,
        clearanceNote: required === null
            ? `No tool length is known, so the toolhead Z this obstacle needs cannot be computed. ${protrusion.note}`
            : `Needs toolhead machine Z ${required}${landmark.clearanceBasis === 'physical'
                ? ` (top ${landmark.clearanceZ} + ${protrusion.mm} mm tool + ${CLEARANCE_MARGIN_MM} mm margin)`
                : ' (stated as a toolhead height, tool length already included)'}.`,
        restatement: needsRestatement(landmark.clearanceZ, landmark.clearanceBasis)
            ? restatementAdvice(landmark.name, landmark.clearanceZ)
            : null,
    };
}

export function registerLandmarkTools(registry: ToolRegistry): void {
    registry.register({
        name: 'set_landmark',
        description: 'Persist a named scene landmark (tool height checker, rotary span, tool '
            + 'post...) with its machine-coordinate XY extent and a description. Same name '
            + 'replaces. Landmarks near the current position are surfaced with every capture, '
            + 'so identities the operator has stated once are never re-guessed. Record identity '
            + 'from OPERATOR knowledge, not visual analogy. MACHINE-SCOPED: the record is tagged with the connected '
            + '(else Luban-selected) machine and applies to that machine only - the A350\'s rotary keep-out means nothing '
            + 'on a Ray. Records from before 2026-10-18 carry no tag and are the A350\'s by rule (the only machine they '
            + 'were ever set on); get_stored_state shows each record\'s machineScope.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Short unique name, e.g. "tool-height-checker".' },
                description: { type: 'string', description: 'What it is and how it looks on camera.' },
                x0: { type: 'number', description: 'Machine-coordinate extent of the feature.' },
                y0: { type: 'number' },
                x1: { type: 'number' },
                y1: { type: 'number' },
                obstacle_top_z: {
                    type: 'number',
                    description: 'PREFERRED. Marks this landmark as an OBSTACLE by stating the machine Z of the '
                        + 'top of the OBSTACLE ITSELF - nothing about the tool. The live tool protrusion and a '
                        + 'safety margin are added when a path is checked, so the number stays true across tool '
                        + 'changes instead of having to be set for the longest bit ever fitted. Omit for '
                        + 'non-obstacles.',
                },
                clearance_z: {
                    type: 'number',
                    description: 'LEGACY form of the same thing: the minimum safe TOOLHEAD machine Z when an XY '
                        + 'path crosses this box, with tool length already included by whoever set it. Still '
                        + 'honoured exactly as before, but prefer obstacle_top_z - a toolhead height has to be '
                        + 're-stated on every tool change and in practice ends up pinned at the machine ceiling.',
                },
                notes: { type: 'string' },
            },
            required: ['name', 'description', 'x0', 'y0', 'x1', 'y1'],
            additionalProperties: false,
        },
        handler: async (args: {
            name?: string;
            description?: string;
            x0?: number;
            y0?: number;
            x1?: number;
            y1?: number;
            clearance_z?: number;
            obstacle_top_z?: number;
            notes?: string;
        }) => {
            const name = String(args.name || '').trim();
            const description = String(args.description || '').trim();
            if (!name || !description) {
                throw new McpToolError('name and description are required.');
            }
            const box = [args.x0, args.y0, args.x1, args.y1].map(Number);
            if (box.some((v) => !Number.isFinite(v)) || box[0] >= box[2] || box[1] >= box[3]) {
                throw new McpToolError('Require finite machine coordinates with x0 < x1 and y0 < y1.');
            }
            if (args.obstacle_top_z !== undefined && args.clearance_z !== undefined) {
                throw new McpToolError('Give obstacle_top_z (the top of the obstacle itself - preferred) or '
                    + 'clearance_z (the legacy toolhead height), not both: they are the same number measured to '
                    + 'different things.');
            }
            const physical = args.obstacle_top_z !== undefined;
            const raw = physical ? args.obstacle_top_z : args.clearance_z;
            const clearanceZ = raw !== undefined ? Number(raw) : null;
            if (clearanceZ !== null && !Number.isFinite(clearanceZ)) {
                throw new McpToolError(`${physical ? 'obstacle_top_z' : 'clearance_z'} must be a finite machine Z when given.`);
            }
            const clearanceBasis: ClearanceBasis = physical ? 'physical' : 'toolhead';
            const machineIdentifier = machineForNewRecord('A landmark');
            const landmark = landmarkStore.add({
                name,
                description,
                machine: { x0: box[0], y0: box[1], x1: box[2], y1: box[3] },
                clearanceZ,
                clearanceBasis,
                notes: args.notes ? String(args.notes) : null,
                machineIdentifier,
            });
            return {
                landmark: describeLandmark(landmark),
                note: clearanceBasis === 'toolhead' && clearanceZ !== null
                    ? restatementAdvice(name, clearanceZ)
                    : null,
            };
        },
    });

    registry.register({
        name: 'set_probe_geometry',
        description: 'Store the jig/tool constants a rotary probe_program may reference as the "axis" namespace: '
            + 'the rotary axis as a LINE - rotary_axis_point / rotary_axis_points, the measured (x, z_physical) at two or '
            + 'more Y stations (each the side-pair X and opposite-face Z of the rotary-axis check at that Y, with its source '
            + 'and date), from which yaw, pitch and the axis at any Y derive; a program\'s axis.x / axis.z_contact are then '
            + 'evaluated at each op\'s own Y. rotary_axis_x / rotary_axis_z_physical are the LEGACY one-number form (the '
            + 'line\'s values at its reference Y once points exist, and then derived, not settable); alone they mean yaw 0 '
            + 'assumed, flagged skew "unmeasured". rotary_axis_z_physical is the PHYSICAL machine Z of the axis, '
            + 'with its reference independently established. probe_effective_length (legacy contact-conversion '
            + 'offset in the same documented datum convention as the stored axis), probe_tip_diameter. '
            + 'Read saved raw setter triggers and datum provenance; a conventional offset is not a caliper length '
            + 'or verified physical clearance bound. Legacy values are preserved without reinterpretation. '
            + 'Operator-stated or MEASURED values only, with the reason - like set_landmark. Omit a field to leave it; '
            + 'null clears it. None of these is a prerequisite for probing: only a program that references axis.* '
            + 'needs them; B0-only, stationary or off-rotary work needs nothing here. Stock size is never stored '
            + '(a rotation\'s swept radius is a per-program argument).',
        inputSchema: {
            type: 'object',
            properties: {
                rotary_axis_point: {
                    type: 'object',
                    description: 'ONE measured axis station: {x, y, z_physical, source?, measured_at?} - x = (c90 + c270) / 2 of the '
                        + 'side pair at machine Y y, z_physical = the opposite-face axis Z minus the probe length at that Y (the '
                        + 'rotary-axis check in cnc-probing). Adds the station, or restates the one already at that Y. The '
                        + 'FIRST station needs a second one in the same call (rotary_axis_points) - one point does not fix a line. '
                        + 'source defaults to reason; measured_at is epoch ms or an ISO date.',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        z_physical: { type: 'number' },
                        source: { type: 'string' },
                        measured_at: { type: ['number', 'string'] },
                    },
                    required: ['x', 'y', 'z_physical'],
                    additionalProperties: false,
                },
                rotary_axis_points: {
                    type: ['array', 'null'],
                    description: `The whole list of measured axis stations (2..${MAX_ROTARY_AXIS_POINTS}, replaces what is stored; null clears `
                        + 'it and the legacy scalars stand alone again). Same item shape as rotary_axis_point. Two stations fix the '
                        + 'line exactly; more are fitted by least squares and the worst residual is reported.',
                    items: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' },
                            z_physical: { type: 'number' },
                            source: { type: 'string' },
                            measured_at: { type: ['number', 'string'] },
                        },
                        required: ['x', 'y', 'z_physical'],
                        additionalProperties: false,
                    },
                },
                rotary_axis_x: {
                    type: ['number', 'null'],
                    description: 'LEGACY: machine X of the rotary axis for every Y (yaw 0 assumed). Derived from the points once '
                        + 'they exist - then not settable by hand.',
                },
                rotary_axis_z_physical: {
                    type: ['number', 'null'],
                    description: 'LEGACY: physical machine Z of the axis (not a contact Z) for every Y. Derived from the points once they exist.',
                },
                rotary_tailstock_y: {
                    type: ['number', 'null'],
                    description: 'Machine Y of the tailstock centre. With the axis line this is a fully known 3D '
                        + 'point, which the camera bootstrap solves against.',
                },
                rotary_chuck_face_y: {
                    type: ['number', 'null'],
                    description: 'Machine Y of the chuck face. Also settles which end is which - "the non-chuck end" '
                        + 'stops being a guess.',
                },
                probe_effective_length: { type: ['number', 'null'], description: 'Legacy probe contact-conversion offset in mm for a documented fitting/datum convention; not a caliper length or physical clearance bound. Prefer saved setter trigger + named datum provenance.' },
                probe_tip_diameter: { type: ['number', 'null'], description: 'Probe tip diameter in mm.' },
                probe_stylus_exposed_mm: { type: ['number', 'null'], description: 'Measured exposed stylus length below the body for this fitting. Not overall protrusion. Bounds descents beside walls; reference probe.stylus_exposed_mm in probe_program.' },
                probe_body_diameter_mm: { type: ['number', 'null'], description: 'Measured body diameter for checking rim/wall access, distinct from the ball. Reference probe.body_diameter_mm in probe_program.' },
                bed_plane_z: { type: ['number', 'null'], description: 'Measured PHYSICAL machine Z of the bed for camera overlap/mosaics. Never toolhead height or a photo estimate. Does not describe raised workpieces.' },
                travel_x_min: {
                    type: ['number', 'null'],
                    description: 'Machine X the toolhead may reach at the low end, for the CONNECTED machine only. Unset = the '
                        + 'machine model\'s size plus the travel fudge at each end (mcpTravelFudgeMm, default 25 mm: an A350 '
                        + 'homes at X-19 against a 320 definition, a Ray at about X-1 / Y399 against 600 x 400). A stated end '
                        + 'only TIGHTENS that; a looser statement is reported and ignored - widen the fudge instead. Stating '
                        + 'any end for a different machine retires the ends stated for the previous one.',
                },
                travel_x_max: { type: ['number', 'null'], description: 'Machine X reachable at the high end. See travel_x_min.' },
                travel_y_min: { type: ['number', 'null'], description: 'Machine Y reachable at the low end. See travel_x_min.' },
                travel_y_max: { type: ['number', 'null'], description: 'Machine Y reachable at the high end. See travel_x_min.' },
                reason: { type: 'string', description: 'How the values were obtained (which job / measurement / operator statement).' },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required: say how the values were measured or who stated them.');
            }
            const values: { [field: string]: unknown } = {};
            for (const spec of GEOMETRY_FIELDS) {
                if (args[spec.field] !== undefined) {
                    values[spec.field] = args[spec.field];
                }
            }
            for (const field of [ROTARY_AXIS_POINTS_FIELD, 'rotary_axis_point']) {
                if (args[field] !== undefined) {
                    values[field] = args[field];
                }
            }
            if (!Object.keys(values).length) {
                throw new McpToolError(`Nothing to set: pass one or more of rotary_axis_point, ${ROTARY_AXIS_POINTS_FIELD}, `
                    + `${GEOMETRY_FIELDS.map((f) => f.field).join(', ')}.`);
            }
            try {
                // Travel statements are machine-scoped: tag them with the connected (else selected) machine.
                const travelStated = ['travel_x_min', 'travel_x_max', 'travel_y_min', 'travel_y_max']
                    .some((field) => values[field] !== undefined && values[field] !== null && values[field] !== '');
                const machineIdentifier = travelStated ? machineForNewRecord('A travel limit') : null;
                const outcome = setGeometryValues(values, reason, machineIdentifier);
                return { ...outcome, geometry: geometrySettings() };
            } catch (err) {
                throw new McpToolError((err as Error).message);
            }
        },
    });

    registry.register({
        name: 'delete_landmark',
        description: 'Delete one stored landmark by id or name.',
        inputSchema: {
            type: 'object',
            properties: { id: { type: 'string', description: 'Landmark id or name.' } },
            required: ['id'],
            additionalProperties: false,
        },
        handler: async (args: { id?: string }) => {
            if (!landmarkStore.remove(String(args.id || ''))) {
                throw new McpToolError('Unknown landmark id or name.');
            }
            return { removed: true };
        },
    });

    registry.register({
        name: 'get_stored_state',
        description: 'Everything already known about this machine and bed in one read-only call, '
            + 'so a fresh session orients WITHOUT moving anything: stored calibrations (with '
            + 'surface tags), named landmarks, the expected tool region, motion limits, camera '
            + 'config, and the live connection snapshot. Call this first. connectedMachine says which machine this '
            + 'is and whether it has a Z axis; every landmark and calibration carries machineScope (which machine it was '
            + 'set on, whether it applies to the connected one, and whether it was attributed to the A350 by the legacy '
            + 'untagged rule); limits.travel is the machine model +/- the travel fudge the planners allow.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            let toolRegion: object | null = null;
            const rawRegion = config.get('mcpToolRegion');
            if (rawRegion) {
                try {
                    toolRegion = typeof rawRegion === 'string' ? JSON.parse(rawRegion) : (rawRegion as object);
                } catch (err) {
                    toolRegion = null;
                }
            }
            const capability = connectedMachineCapability();
            const connected = connectedMachineIdentifier();
            const travel = planningTravel();
            return {
                connection: connectionManager.getConnectionStatus(),
                connectedMachine: describeConnectedMachine(),
                /**
                 * Machine scoping (#260 follow-up): landmarks, calibrations and
                 * the stated travel apply only to the machine they were set
                 * on. Records with no tag were set on the A350, the only
                 * machine the MCP ran on before 2026-10-18, and are its by rule.
                 */
                machineScope: {
                    connected,
                    legacyRule: `records with no machineIdentifier belong to ${LEGACY_MACHINE_IDENTIFIER}`,
                    landmarksApplying: landmarkStore.listFor(connected).map((l) => l.name),
                    landmarksNotApplying: landmarkStore.list().filter((l) => !appliesToMachine(l.machineIdentifier, connected))
                        .map((l) => ({ name: l.name, machineIdentifier: l.machineIdentifier })),
                    calibrationsApplying: calibrationStore.listFor(connected).map((e) => e.id),
                    calibrationsNotApplying: calibrationStore.list().filter((e) => !appliesToMachine(e.machineIdentifier, connected))
                        .map((e) => ({ id: e.id, machineIdentifier: e.machineIdentifier })),
                },
                calibrations: calibrationStore.list().map((entry) => ({
                    ...entry,
                    machineScope: {
                        machineIdentifier: entry.machineIdentifier,
                        legacy: entry.legacyScope === true,
                        appliesToConnectedMachine: appliesToMachine(entry.machineIdentifier, connected),
                    },
                })),
                landmarks: landmarkStore.list().map(describeLandmark),
                landmarkClearances: (() => {
                    const legacy = landmarkStore.list().filter((l) => needsRestatement(l.clearanceZ, l.clearanceBasis));
                    const protrusion = currentToolProtrusion();
                    return {
                        toolProtrusionMm: protrusion.mm,
                        toolProtrusionSource: protrusion.source,
                        toolProtrusionNote: protrusion.note,
                        clearanceMarginMm: CLEARANCE_MARGIN_MM,
                        onLegacyBasis: legacy.map((l) => l.name),
                        legacyConsequences: legacy.map((l) => ({ name: l.name,
                            machine: l.machine,
                            requiredToolheadZ: l.clearanceZ,
                            consequence: `Camera waypoints/pose stops below machine toolhead Z${l.clearanceZ} inside this box are dropped or refused; an active tool does not lower this legacy requirement.`,
                            restatement: { tool: 'set_landmark', name: l.name, obstacle_top_z: '<measured physical top; never copy clearanceZ>', requires: 'Operator instruction and measured/stated physical height; keep the existing bounds.' } })),
                        note: legacy.length
                            ? `${legacy.length} obstacle(s) still state a TOOLHEAD height with some tool length baked `
                                + 'in, so they are pinned wherever they were set. Re-state each with set_landmark '
                                + 'obstacle_top_z (the top of the obstacle itself) and the live tool is added at check '
                                + 'time instead. They are enforced exactly as before meanwhile.'
                            : 'Every obstacle states its own physical height; the live tool and margin are added when a path is checked.',
                    };
                })(),
                expectedToolRegion: toolRegion,
                limits: {
                    maxJogDistanceMm: Number(config.get('mcpMaxJogDistance')) || 100,
                    /**
                     * Whether the Z laws below apply at all: false on a machine
                     * with no Z axis (the Ray), where XY runs at the only height
                     * and move_z is refused.
                     */
                    zLawsApply: capability.hasZ,
                    /** The XY travel the planners allow on the connected machine: the model +/- the fudge, tightened by any statement for it. */
                    travel: travel ? { ...travel.limits, basis: describePlanningTravel(travel), conflicts: travel.conflicts } : null,
                    travelFudge: (() => {
                        const fudge = travelFudge();
                        return {
                            xMm: fudge.x,
                            yMm: fudge.y,
                            source: fudge.source,
                            defaultMm: fudge.defaultMm,
                            setting: 'mcpTravelFudgeMm (LUBAN_MCP_TRAVEL_FUDGE_MM); per axis mcpTravelFudgeXMm / mcpTravelFudgeYMm',
                        };
                    })(),
                    /** The PARK height: where procedures hop, retreat on abort, and end. 328 = home Z. Meaningless when zLawsApply is false. */
                    safeTraverseZMm: safeTraverseZ(),
                    /**
                     * The MOTION FLOOR (law 2): the lowest machine Z an XY move
                     * over 1 mm may happen at. Lower than the park height since
                     * 2026-09-19 - landmarks are checked at the real height, so
                     * the registry does the work a blanket ceiling used to.
                     */
                    motionFloorZMm: motionFloorZ(),
                },
                camera: {
                    url: config.get('mcpCameraUrl') || null,
                    device: config.get('mcpCameraDevice') || null,
                    lastGoodDevice: config.get('mcpCameraLastGood') || null,
                    // Live MJPEG view for the operator's browser (cameraStream.ts).
                    stream: (() => {
                        const stream = cameraStreamService.status();
                        return {
                            enabled: stream.enabled,
                            stream_url: stream.pageUrl,
                            running: stream.running,
                            clients: stream.clients,
                            fps: stream.fps,
                        };
                    })(),
                },
                // Where a large program goes (#237): the inbox directories
                // gcode_path may name, the size cap, and uploads in flight.
                jobIntake: (() => {
                    const inbox = jobInbox();
                    const limits = gcodeUploads.limits;
                    return {
                        inboxDir: inbox.inboxDir,
                        inboxProblem: inbox.inboxProblem,
                        extraInboxDir: inbox.extraDir,
                        extraInboxSource: inbox.extraSource,
                        extraInboxProblem: inbox.extraProblem,
                        allowedDirs: inbox.roots.map((root) => root.dir),
                        maxProgramBytes: limits.maxBytes,
                        uploadChunkMaxBytes: limits.chunkMaxBytes,
                        uploadIdleExpiryMs: limits.idleExpiryMs,
                        openUploads: gcodeUploads.list(),
                        note: 'submit_gcode_job / validate_gcode take exactly one of gcode (inline, small), gcode_path (a file in allowedDirs, '
                            + 'read by the Luban server) or upload_id (begin_gcode_upload / append_gcode_chunk / finish_gcode_upload). '
                            + 'Write a real CAM file into inboxDir and pass its name; never emit it as one argument.',
                    };
                })(),
                // From Luban's Machine Settings (machine.json), never a private key.
                machineSettings: readAppMachineSettings(),
                installedModules: (readAppMachineSettings() || { modules: [] }).modules,
                probeFeed: probeFeedService.status(),
                toolSetter: getToolSetterConfig(),
                setterDatum: currentSetterDatum(),
                toolMeasurements: getMeasurements(),
                activeTool: describeActiveTool(),
                probeTipCalibration: getProbeTipCalibration(),
                // Operator-measured jig/tool constants (set_probe_geometry);
                // programs read them as `axis.*`. geometry.rotary carries the
                // axis LINE (yawDeg / pitchDeg / referenceY / points / skew) and
                // geometry.rotaryAxisPoints the stations it was fitted from.
                geometry: geometrySettings(),
                // Accelerometers: where each one is stuck, whether it streams,
                // and the rotary chuck's gravity calibration (absolute B).
                vibration: (() => {
                    const feed = vibrationFeedService.status() as { enabled: boolean; state: string; sensors: Array<{ [key: string]: unknown }> };
                    const rotary = vibrationCaptureService.rotaryCalibration();
                    return {
                        enabled: feed.enabled,
                        state: feed.state,
                        sensors: feed.sensors.map((sensor) => ({
                            id: sensor.id, location: sensor.location, chip: sensor.chip, state: sensor.state, orientation: sensor.orientation,
                        })),
                        rotaryCalibration: rotary ? { sensorId: rotary.sensor_id, createdAt: rotary.created_at, reason: rotary.reason } : null,
                    };
                })(),
            };
        },
    });
}
