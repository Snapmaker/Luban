/* eslint-disable camelcase */
// The `axis` namespace is read by agents through snake_case reference paths
// (axis.z_contact), matching the MCP argument convention.
import config from '../configstore';

// Jig and tool constants the operator measures once and a rotary program can
// reference (mcp/48): the rotary axis line and the touch probe's geometry.
// Set through the MCP tool `set_probe_geometry` (like landmarks: operator
// knowledge or a measurement, with a reason), overridable per box by
// environment variables, read back in `get_stored_state`. NOT in the app's
// settings pane and NEVER a prerequisite: only a reference to `axis.*`
// needs them, and then a missing value is a staging error naming the tool.
// Stock size is a property of the stock, not of the jig, so nothing about
// the stock lives here - a rotation's swept radius is a per-program argument.

export interface RotaryGeometry {
    /** Machine X of the rotary axis line (the stock runs along machine Y on this jig). */
    axisX: number;
    /** PHYSICAL machine Z of the axis (not a toolhead-contact Z). */
    axisZ: number;
    /** Machine Y of the tailstock centre, when stated: a known point ON the axis line. */
    tailstockY: number | null;
    /** Machine Y of the chuck face, when stated. Which end is the chuck stops being a guess. */
    chuckFaceY: number | null;
}

export interface ProbeGeometry {
    /** Toolhead Z at contact minus this = physical surface Z. Re-measure after any re-fit. */
    effectiveLength: number;
    /** Side contacts are centre +/- tipDiameter / 2. */
    tipDiameter: number | null;
}

export const GEOMETRY_FIELDS = [
    { field: 'rotary_axis_x', key: 'mcpRotaryAxisX', env: 'LUBAN_MCP_ROTARY_AXIS_X', min: -50, max: 400 },
    { field: 'rotary_axis_z_physical', key: 'mcpRotaryAxisZ', env: 'LUBAN_MCP_ROTARY_AXIS_Z', min: 0, max: 400 },
    { field: 'rotary_tailstock_y', key: 'mcpRotaryTailstockY', env: 'LUBAN_MCP_ROTARY_TAILSTOCK_Y', min: -50, max: 400 },
    { field: 'rotary_chuck_face_y', key: 'mcpRotaryChuckFaceY', env: 'LUBAN_MCP_ROTARY_CHUCK_FACE_Y', min: -50, max: 400 },
    { field: 'probe_effective_length', key: 'mcpProbeEffectiveLength', env: 'LUBAN_MCP_PROBE_LENGTH', min: 1, max: 300 },
    { field: 'probe_tip_diameter', key: 'mcpProbeTipDiameter', env: 'LUBAN_MCP_PROBE_TIP_DIAMETER', min: 0.1, max: 30 },
    { field: 'probe_stylus_exposed_mm', key: 'mcpProbeStylusExposed', env: 'LUBAN_MCP_PROBE_STYLUS_EXPOSED_MM', min: 0.1, max: 300 },
    { field: 'probe_body_diameter_mm', key: 'mcpProbeBodyDiameter', env: 'LUBAN_MCP_PROBE_BODY_DIAMETER_MM', min: 0.1, max: 100 },
    { field: 'bed_plane_z', key: 'mcpBedPlaneZ', env: 'LUBAN_MCP_BED_PLANE_Z', min: -100, max: 400 },
    // Toolhead travel for THIS rig (machineTravel.ts). Unset is the normal
    // case: travel then falls back to the machine definition's size box,
    // widened by positions the toolhead has actually been observed at. State
    // an end when the definition is wrong for the rig - an A350's frame runs
    // X -19...339 against a 320 x 350 definition, and a bracing kit or a
    // different machine moves it again.
    { field: 'travel_x_min', key: 'mcpTravelXMin', env: 'LUBAN_MCP_TRAVEL_X_MIN', min: -500, max: 1000 },
    { field: 'travel_x_max', key: 'mcpTravelXMax', env: 'LUBAN_MCP_TRAVEL_X_MAX', min: -500, max: 1000 },
    { field: 'travel_y_min', key: 'mcpTravelYMin', env: 'LUBAN_MCP_TRAVEL_Y_MIN', min: -500, max: 1000 },
    { field: 'travel_y_max', key: 'mcpTravelYMax', env: 'LUBAN_MCP_TRAVEL_Y_MAX', min: -500, max: 1000 },
] as const;

export type GeometryField = typeof GEOMETRY_FIELDS[number]['field'];

export interface GeometryEntry {
    value: number | null;
    source: 'env' | 'config' | 'unset';
    env: string;
    range: [number, number];
    note: string | null;
    setAt: number | null;
}

function readSetting(spec: typeof GEOMETRY_FIELDS[number]): { value: number | null; source: 'env' | 'config' | 'unset' } {
    const env = process.env[spec.env];
    if (env !== undefined && String(env).trim() !== '') {
        const n = Number(env);
        return { value: Number.isFinite(n) ? n : null, source: 'env' };
    }
    const stored = config.get(spec.key);
    if (stored === undefined || stored === null || stored === '') {
        return { value: null, source: 'unset' };
    }
    const n = Number(stored);
    return { value: Number.isFinite(n) ? n : null, source: 'config' };
}

export function geometryValue(field: GeometryField): number | null {
    const spec = GEOMETRY_FIELDS.find((f) => f.field === field);
    return spec ? readSetting(spec).value : null;
}

export function rotaryGeometry(): RotaryGeometry | null {
    const axisX = geometryValue('rotary_axis_x');
    const axisZ = geometryValue('rotary_axis_z_physical');
    if (axisX === null || axisZ === null) {
        return null;
    }
    return {
        axisX,
        axisZ,
        tailstockY: geometryValue('rotary_tailstock_y'),
        chuckFaceY: geometryValue('rotary_chuck_face_y'),
    };
}

export function probeGeometry(): ProbeGeometry | null {
    const effectiveLength = geometryValue('probe_effective_length');
    if (effectiveLength === null) {
        return null;
    }
    return { effectiveLength, tipDiameter: geometryValue('probe_tip_diameter') };
}

/** The travel ends stated for this rig; any of them may be null (= not stated). */
export function statedTravel(): { xMin: number | null; xMax: number | null; yMin: number | null; yMax: number | null } {
    return {
        xMin: geometryValue('travel_x_min'),
        xMax: geometryValue('travel_x_max'),
        yMin: geometryValue('travel_y_min'),
        yMax: geometryValue('travel_y_max'),
    };
}

/**
 * Store operator-stated / measured values (set_probe_geometry). `null` or ''
 * clears a field. Env-overridden fields are refused so the stored value and
 * the live value never disagree silently.
 */
export function setGeometryValues(
    values: { [field: string]: unknown },
    note: string
): { updated: string[]; cleared: string[] } {
    const updated: string[] = [];
    const cleared: string[] = [];
    for (const spec of GEOMETRY_FIELDS) {
        if (!(spec.field in values) || values[spec.field] === undefined) {
            continue;
        }
        if (process.env[spec.env] !== undefined && String(process.env[spec.env]).trim() !== '') {
            throw new Error(`${spec.field} is overridden by the environment variable ${spec.env} on this box; change it there.`);
        }
        const raw = values[spec.field];
        if (raw === null || raw === '') {
            config.unset(spec.key);
            config.unset(`${spec.key}Note`);
            config.unset(`${spec.key}At`);
            cleared.push(spec.field);
            continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
            throw new Error(`${spec.field} must be a number in ${spec.min}..${spec.max} (got ${JSON.stringify(raw)}).`);
        }
        config.set(spec.key, n);
        config.set(`${spec.key}Note`, note);
        config.set(`${spec.key}At`, Date.now());
        updated.push(spec.field);
    }
    return { updated, cleared };
}

/** Everything stored, with provenance, for get_stored_state / set_probe_geometry. */
export function geometrySettings() {
    const fields: { [field: string]: GeometryEntry } = {};
    for (const spec of GEOMETRY_FIELDS) {
        const note = config.get(`${spec.key}Note`);
        const at = Number(config.get(`${spec.key}At`));
        fields[spec.field] = {
            ...readSetting(spec),
            env: spec.env,
            range: [spec.min, spec.max],
            note: note ? String(note) : null,
            setAt: Number.isFinite(at) && at > 0 ? at : null,
        };
    }
    return {
        fields,
        rotary: rotaryGeometry(),
        probe: probeGeometry(),
        note: 'Only programs that reference axis.* need these; B0-only and non-rotary work needs none of them. '
            + 'Set with set_probe_geometry after measuring (axis Z from an opposite-face pair, axis X from a side pair, '
            + 'probe length from run_tool_setter accept_probe_contact).',
    };
}

export interface AxisNamespace {
    x: number;
    z_physical: number;
    /** Toolhead Z at which the probe tip is on the axis line (z_physical + probe length). */
    z_contact: number;
    tip_radius: number | null;
    probe_length: number;
}

/**
 * Namespaces seeded into a program's results before op 1. `axis` exists only
 * when the rotary axis AND the probe length are known (z_contact needs both);
 * otherwise a reference to axis.* is refused at staging with the tool named.
 */
export function programSeedNamespaces(): { axis?: AxisNamespace; probe: { stylus_exposed_mm: number | null; body_diameter_mm: number | null } } {
    const dimensions = { stylus_exposed_mm: geometryValue('probe_stylus_exposed_mm'), body_diameter_mm: geometryValue('probe_body_diameter_mm') };
    const rotary = rotaryGeometry();
    const probe = probeGeometry();
    if (!rotary || !probe) {
        return { probe: dimensions };
    }
    return {
        probe: dimensions,
        axis: {
            x: rotary.axisX,
            z_physical: rotary.axisZ,
            z_contact: Number((rotary.axisZ + probe.effectiveLength).toFixed(3)),
            tip_radius: probe.tipDiameter === null ? null : Number((probe.tipDiameter / 2).toFixed(3)),
            probe_length: probe.effectiveLength,
        },
    };
}

/** What a staging error should tell the agent when axis.* is referenced without the values. */
export function missingGeometryNote(): string {
    const missing = GEOMETRY_FIELDS
        .filter((f) => ['rotary_axis_x', 'rotary_axis_z_physical', 'probe_effective_length'].includes(f.field))
        .filter((f) => readSetting(f).value === null)
        .map((f) => f.field);
    return missing.length
        ? `The "axis" namespace needs ${missing.join(', ')}: measure them and store with set_probe_geometry `
            + '(or drop the axis.* reference - a program that references only its own earlier ops needs no geometry).'
        : '';
}

/**
 * Points on the rotary axis whose machine coordinates are fully known, for
 * anything that needs to solve against the scene rather than probe it - the
 * camera bootstrap above all. The axis line fixes X and Z; naming an end
 * fixes Y as well, which is what turns it into a point.
 */
export function rotaryAxisPoints(): Array<{ name: string; x: number; y: number; z: number }> {
    const g = rotaryGeometry();
    if (!g) {
        return [];
    }
    const points: Array<{ name: string; x: number; y: number; z: number }> = [];
    if (g.tailstockY !== null) {
        points.push({ name: 'rotary-tailstock', x: g.axisX, y: g.tailstockY, z: g.axisZ });
    }
    if (g.chuckFaceY !== null) {
        points.push({ name: 'rotary-chuck-face', x: g.axisX, y: g.chuckFaceY, z: g.axisZ });
    }
    return points;
}
