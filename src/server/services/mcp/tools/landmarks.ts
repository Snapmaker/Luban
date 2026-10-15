/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import config from '../../configstore';
import { connectionManager } from '../../machine/ConnectionManager';
import { calibrationStore } from '../calibration';
import { cameraStreamService } from '../cameraStream';
import { Landmark, landmarkStore } from '../landmarks';
import { probeFeedService } from '../probeFeed';
import { McpToolError, ToolRegistry } from '../registry';
import { GEOMETRY_FIELDS, geometrySettings, setGeometryValues } from '../rotaryGeometry';
import { getToolSetterConfig } from '../toolSetter';
import { currentToolProtrusion } from '../clearanceContext';
import {
    CLEARANCE_MARGIN_MM,
    ClearanceBasis,
    needsRestatement,
    requiredToolheadZ,
    restatementAdvice,
} from '../landmarkClearance';
import { motionFloorZ, readAppMachineSettings, safeTraverseZ } from './machine';

// Named scene landmarks (#50) and the stored-state overview (#53): operator
// knowledge captured once, surfaced every session, so no agent spends moves
// re-deriving what the operator already said.

/**
 * A landmark plus what its clearance actually demands of the toolhead right
 * now, and - for a record still on the legacy basis - what to do about it.
 * An agent reading get_stored_state should not have to work out that a
 * clearance of 328 is a toolhead height with a probe baked into it.
 */
function describeLandmark(landmark: Landmark): object {
    if (landmark.clearanceZ === null) {
        return { ...landmark, requiredToolheadZ: null };
    }
    const protrusion = currentToolProtrusion();
    const required = requiredToolheadZ(landmark.clearanceZ, landmark.clearanceBasis, protrusion.mm);
    return {
        ...landmark,
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
            + 'from OPERATOR knowledge, not visual analogy.',
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
            const landmark = landmarkStore.add({
                name,
                description,
                machine: { x0: box[0], y0: box[1], x1: box[2], y1: box[3] },
                clearanceZ,
                clearanceBasis,
                notes: args.notes ? String(args.notes) : null,
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
            + 'rotary_axis_x (machine X of the axis line), rotary_axis_z_physical (PHYSICAL machine Z of the axis, '
            + 'e.g. from an opposite-face pair: (topA + topB)/2 - probe length), probe_effective_length (toolhead Z at '
            + 'contact minus this = surface; run_tool_setter accept_probe_contact measures it), probe_tip_diameter. '
            + 'Operator-stated or MEASURED values only, with the reason - like set_landmark. Omit a field to leave it; '
            + 'null clears it. None of these is a prerequisite for probing: only a program that references axis.* '
            + 'needs them; B0-only, stationary or off-rotary work needs nothing here. Stock size is never stored '
            + '(a rotation\'s swept radius is a per-program argument).',
        inputSchema: {
            type: 'object',
            properties: {
                rotary_axis_x: { type: ['number', 'null'], description: 'Machine X of the rotary axis line.' },
                rotary_axis_z_physical: { type: ['number', 'null'], description: 'Physical machine Z of the axis (not a contact Z).' },
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
                probe_effective_length: { type: ['number', 'null'], description: 'Probe effective length in mm (this fitting).' },
                probe_tip_diameter: { type: ['number', 'null'], description: 'Probe tip diameter in mm.' },
                probe_stylus_exposed_mm: { type: ['number', 'null'], description: 'Measured exposed stylus length below the body for this fitting. Not overall protrusion. Bounds descents beside walls; reference probe.stylus_exposed_mm in probe_program.' },
                probe_body_diameter_mm: { type: ['number', 'null'], description: 'Measured body diameter for checking rim/wall access, distinct from the ball. Reference probe.body_diameter_mm in probe_program.' },
                bed_plane_z: { type: ['number', 'null'], description: 'Measured PHYSICAL machine Z of the bed for camera overlap/mosaics. Never toolhead height or a photo estimate. Does not describe raised workpieces.' },
                travel_x_min: {
                    type: ['number', 'null'],
                    description: 'Machine X the toolhead can reach at the low end, for THIS rig. Unset = the machine '
                        + 'definition, widened by positions the toolhead has actually been observed at. State it when '
                        + 'the definition is wrong for the rig (an A350 frame runs X -19...339 against a 320 x 350 '
                        + 'definition); planners clamp their bands to it.',
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
            if (!Object.keys(values).length) {
                throw new McpToolError(`Nothing to set: pass one or more of ${GEOMETRY_FIELDS.map((f) => f.field).join(', ')}.`);
            }
            try {
                const outcome = setGeometryValues(values, reason);
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
            + 'config, and the live connection snapshot. Call this first.',
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
            return {
                connection: connectionManager.getConnectionStatus(),
                calibrations: calibrationStore.list(),
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
                    /** The PARK height: where procedures hop, retreat on abort, and end. 328 = home Z. */
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
                // From Luban's Machine Settings (machine.json), never a private key.
                machineSettings: readAppMachineSettings(),
                installedModules: (readAppMachineSettings() || { modules: [] }).modules,
                probeFeed: probeFeedService.status(),
                toolSetter: getToolSetterConfig(),
                // Operator-measured jig/tool constants (Settings -> MCP Server ->
                // Rotary and probe geometry); programs read them as `axis.*`.
                geometry: geometrySettings(),
            };
        },
    });
}
