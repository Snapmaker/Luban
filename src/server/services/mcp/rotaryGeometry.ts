/* eslint-disable camelcase */
// The `axis` namespace is read by agents through snake_case reference paths
// (axis.z_contact), matching the MCP argument convention.
import { machineConfig, machineStore } from './machineStore';
import { RimArgs, StylusReachVerdict, checkStylusReach, parseReachMargin, parseRimZ } from './stylusReach';
import { MAX_ROTARY_AXIS_POINTS } from './procedureLimits';
import {
    AxisNamespace,
    RotaryAxisError,
    RotaryAxisLine,
    RotaryAxisPoint,
    axisAt,
    axisNamespaceFor,
    fitRotaryAxisLine,
    normaliseAxisPoint,
    unmeasuredSkewLine,
} from './rotaryAxisLine';

export type { AxisNamespace, RotaryAxisLine, RotaryAxisPoint } from './rotaryAxisLine';
export { axisNamespaceAt } from './rotaryAxisLine';

// Jig and tool constants the operator measures once and a rotary program can
// reference (mcp/48): the rotary axis line and the touch probe's geometry.
// Set through the MCP tool `set_probe_geometry` (like landmarks: operator
// knowledge or a measurement, with a reason), overridable per box by
// environment variables, read back in `get_stored_state`. NOT in the app's
// settings pane and NEVER a prerequisite: only a reference to `axis.*`
// needs them, and then a missing value is a staging error naming the tool.
// Stock size is a property of the stock, not of the jig, so nothing about
// the stock lives here - a rotation's swept radius is a per-program argument.
//
// The axis is a LINE (issue #155): `rotary_axis_points` holds the measured
// (x, z_physical) at two or more Y stations, each with its source and date,
// and the line through them (rotaryAxisLine.ts) gives yaw, pitch and the
// axis at any Y. The scalar fields `rotary_axis_x` / `rotary_axis_z_physical`
// are kept as the line's values at the reference Y (the stations' centroid)
// for everything that reads one number; a store with only the scalars loads
// unchanged as a line of yaw 0 flagged `skew: 'unmeasured'`.

export interface RotaryGeometry {
    /** Machine X of the rotary axis at `referenceY` (the stock runs along machine Y on this jig). */
    axisX: number;
    /** PHYSICAL machine Z of the axis at `referenceY` (not a toolhead-contact Z). */
    axisZ: number;
    /** The Y axisX / axisZ hold at; null when the skew is unmeasured (one value for every Y). */
    referenceY: number | null;
    /** Angle from machine +Y in XY (+ = toward +X as Y increases); 0 when unmeasured. */
    yawDeg: number;
    /** Angle from the XY plane (+ = rising with Y); 0 when unmeasured. */
    pitchDeg: number;
    skew: 'measured' | 'unmeasured';
    /** The measured stations the line runs through (empty when only the legacy scalars exist). */
    points: RotaryAxisPoint[];
    /** The line itself, for anything that needs the axis at a given Y (axisAt). */
    line: RotaryAxisLine;
    /** Machine Y of the tailstock centre, when stated: a known point ON the axis line. */
    tailstockY: number | null;
    /** Machine Y of the chuck face, when stated. Which end is the chuck stops being a guess. */
    chuckFaceY: number | null;
    /** R5: PHYSICAL machine Z of the top of the chuck, when stated. */
    chuckTopZ: number | null;
    /** R5: PHYSICAL machine Z of the top of the tailstock bracket, when stated. */
    tailstockTopZ: number | null;
}

export interface ProbeGeometry {
    /** Legacy contact-conversion offset in its recorded datum convention, not caliper protrusion or a physical clearance bound. */
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
    // R5: the PHYSICAL machine-Z tops of the rotary chuck and the tailstock
    // bracket - obstacles a rotary safe height must clear (WP6). Same range as
    // the axis Z: they are heights on the same bed.
    { field: 'rotary_chuck_top_z', key: 'mcpRotaryChuckTopZ', env: 'LUBAN_MCP_ROTARY_CHUCK_TOP_Z', min: 0, max: 400 },
    { field: 'rotary_tailstock_top_z', key: 'mcpRotaryTailstockTopZ', env: 'LUBAN_MCP_ROTARY_TAILSTOCK_TOP_Z', min: 0, max: 400 },
    { field: 'bed_plane_z', key: 'mcpBedPlaneZ', env: 'LUBAN_MCP_BED_PLANE_Z', min: -100, max: 400 },
    // Toolhead travel stated for ONE machine (machineTravel.ts). Unset is the
    // normal case: the travel is then the machine model's size plus the
    // travel fudge (mcpTravelFudgeMm) at each end. A stated end is a TIGHTER
    // override only. Like every field here it lives in the machine's own
    // entry of the per-machine store (machineStore.ts), so the Ray's ends and
    // the A350's coexist and stating one never touches the other.
    { field: 'travel_x_min', key: 'mcpTravelXMin', env: 'LUBAN_MCP_TRAVEL_X_MIN', min: -500, max: 1000 },
    { field: 'travel_x_max', key: 'mcpTravelXMax', env: 'LUBAN_MCP_TRAVEL_X_MAX', min: -500, max: 1000 },
    { field: 'travel_y_min', key: 'mcpTravelYMin', env: 'LUBAN_MCP_TRAVEL_Y_MIN', min: -500, max: 1000 },
    { field: 'travel_y_max', key: 'mcpTravelYMax', env: 'LUBAN_MCP_TRAVEL_Y_MAX', min: -500, max: 1000 },
] as const;

export type GeometryField = typeof GEOMETRY_FIELDS[number]['field'];

/** The measured axis stations (issue #155): a JSON array of {x, y, z_physical, source, measured_at}. */
export const ROTARY_AXIS_POINTS_FIELD = 'rotary_axis_points';
const ROTARY_AXIS_POINTS_KEY = 'mcpRotaryAxisPoints';
const ROTARY_AXIS_POINTS_ENV = 'LUBAN_MCP_ROTARY_AXIS_POINTS';
/** The two scalar fields the points supersede: while points exist they are derived, not set by hand. */
const AXIS_SCALAR_FIELDS: GeometryField[] = ['rotary_axis_x', 'rotary_axis_z_physical'];
/** Stations closer than this in Y are the same station restated (the position resolution, envelopeChecks.POSITION_EPSILON_MM). */
const SAME_STATION_MM = 0.05;

export interface GeometryEntry {
    value: number | null;
    source: 'env' | 'config' | 'unset';
    env: string;
    range: [number, number];
    note: string | null;
    setAt: number | null;
    /** Set on rotary_axis_x / rotary_axis_z_physical while the axis line is measured: the value is the line's, not a hand-set one. */
    derivedFrom?: string;
}

/** configstore-shaped access to one machine's entry: the current machine's (machineConfig) or a named one. */
interface MachineReader {
    get(key: string): unknown;
}

function storeFor(machineKey: string): MachineReader & { set(key: string, value: unknown): void; unset(key: string): void } {
    return {
        get: (key: string) => machineStore.getFor(machineKey, key),
        set: (key: string, value: unknown) => machineStore.setFor(machineKey, key, value),
        unset: (key: string) => machineStore.unsetFor(machineKey, key),
    };
}

/** env (pins the value for whatever machine is connected) > the machine's own entry > unset. */
function readSetting(spec: typeof GEOMETRY_FIELDS[number], store: MachineReader = machineConfig): { value: number | null; source: 'env' | 'config' | 'unset' } {
    const env = process.env[spec.env];
    if (env !== undefined && String(env).trim() !== '') {
        const n = Number(env);
        return { value: Number.isFinite(n) ? n : null, source: 'env' };
    }
    const stored = store.get(spec.key);
    if (stored === undefined || stored === null || stored === '') {
        return { value: null, source: 'unset' };
    }
    const n = Number(stored);
    return { value: Number.isFinite(n) ? n : null, source: 'config' };
}

export function geometryValue(field: GeometryField, store: MachineReader = machineConfig): number | null {
    const spec = GEOMETRY_FIELDS.find((f) => f.field === field);
    return spec ? readSetting(spec, store).value : null;
}

function fieldRange(field: GeometryField): [number, number] {
    const spec = GEOMETRY_FIELDS.find((f) => f.field === field);
    return spec ? [spec.min, spec.max] : [-Infinity, Infinity];
}

/** The ranges a stated axis point must sit in: the scalar fields' own, Y as for the tailstock / chuck face. */
function axisPointRanges(): { x: [number, number]; y: [number, number]; z: [number, number] } {
    return { x: fieldRange('rotary_axis_x'), y: fieldRange('rotary_tailstock_y'), z: fieldRange('rotary_axis_z_physical') };
}

function parsePointList(raw: unknown, where: string, defaultSource: string): RotaryAxisPoint[] {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) {
        throw new RotaryAxisError(`${where}: must be an array of {x, y, z_physical, source, measured_at}.`);
    }
    if (list.length > MAX_ROTARY_AXIS_POINTS) {
        throw new RotaryAxisError(`${where}: at most ${MAX_ROTARY_AXIS_POINTS} stations (got ${list.length}).`);
    }
    return list.map((item, index) => normaliseAxisPoint(item, `${where}[${index}]`, axisPointRanges(), defaultSource));
}

export interface StoredAxisPoints {
    points: RotaryAxisPoint[];
    source: 'env' | 'config' | 'unset';
    note: string | null;
    setAt: number | null;
    /** A stored record that no longer parses (hand-edited store): reported, never silently dropped. */
    error: string | null;
}

/** The stored axis stations with their provenance; a malformed record reads as none, with the error reported. */
export function storedAxisPoints(store: MachineReader = machineConfig): StoredAxisPoints {
    const env = process.env[ROTARY_AXIS_POINTS_ENV];
    const fromEnv = env !== undefined && String(env).trim() !== '';
    const raw = fromEnv ? env : store.get(ROTARY_AXIS_POINTS_KEY);
    if (raw === undefined || raw === null || raw === '') {
        return { points: [], source: 'unset', note: null, setAt: null, error: null };
    }
    const note = store.get(`${ROTARY_AXIS_POINTS_KEY}Note`);
    const at = Number(store.get(`${ROTARY_AXIS_POINTS_KEY}At`));
    const provenance = {
        source: fromEnv ? 'env' as const : 'config' as const,
        note: note ? String(note) : null,
        setAt: Number.isFinite(at) && at > 0 ? at : null,
    };
    try {
        return { points: parsePointList(raw, fromEnv ? ROTARY_AXIS_POINTS_ENV : ROTARY_AXIS_POINTS_FIELD, 'stored'), ...provenance, error: null };
    } catch (err) {
        return { points: [], ...provenance, error: (err as Error).message };
    }
}

function safeFit(points: RotaryAxisPoint[]): RotaryAxisLine | null {
    try {
        return fitRotaryAxisLine(points);
    } catch (err) {
        return null;
    }
}

/**
 * The axis line: through the measured stations when two or more are
 * stored, else the legacy scalars as a line of yaw 0 flagged unmeasured,
 * else null (no axis known at all).
 */
export function rotaryAxisLine(): RotaryAxisLine | null {
    const stored = storedAxisPoints();
    if (stored.points.length >= 2) {
        // set_probe_geometry refuses what fitRotaryAxisLine refuses, so only
        // a hand-edited store fails here; it then falls through to the scalars.
        const line = safeFit(stored.points);
        if (line) {
            return line;
        }
    }
    const axisX = geometryValue('rotary_axis_x');
    const axisZ = geometryValue('rotary_axis_z_physical');
    if (axisX === null || axisZ === null) {
        return null;
    }
    return unmeasuredSkewLine(axisX, axisZ);
}

export function rotaryGeometry(): RotaryGeometry | null {
    const line = rotaryAxisLine();
    if (!line) {
        return null;
    }
    return {
        axisX: line.x,
        axisZ: line.z_physical,
        referenceY: line.reference_y,
        yawDeg: line.yaw_deg,
        pitchDeg: line.pitch_deg,
        skew: line.skew,
        points: line.points,
        line,
        tailstockY: geometryValue('rotary_tailstock_y'),
        chuckFaceY: geometryValue('rotary_chuck_face_y'),
        chuckTopZ: geometryValue('rotary_chuck_top_z'),
        tailstockTopZ: geometryValue('rotary_tailstock_top_z'),
    };
}

export function probeGeometry(): ProbeGeometry | null {
    const effectiveLength = geometryValue('probe_effective_length');
    if (effectiveLength === null) {
        return null;
    }
    return { effectiveLength, tipDiameter: geometryValue('probe_tip_diameter') };
}

/**
 * The fitted probe's STYLUS geometry (issue #187): how far the tip sticks out
 * below the body. Independent of the contact calibration - a probe's tool
 * length says nothing about its reach into a pocket. Any field may be null
 * (= not stored); nothing here is a prerequisite for probing on an open
 * surface, but a -Z march staged inside a known pocket needs the reach to be
 * checked, and says "stylus reach unknown" when it is not.
 */
export interface StylusGeometry {
    /** probe_stylus_exposed_mm: tip bottom to the first body shoulder. */
    reachMm: number | null;
    /** probe_body_diameter_mm: the body that would land on the rim. */
    bodyDiameterMm: number | null;
    /** probe_tip_diameter: the ball, subtracted from the reach by the check. */
    tipDiameterMm: number | null;
}

export function stylusGeometry(): StylusGeometry {
    return {
        reachMm: geometryValue('probe_stylus_exposed_mm'),
        bodyDiameterMm: geometryValue('probe_body_diameter_mm'),
        tipDiameterMm: geometryValue('probe_tip_diameter'),
    };
}

/**
 * The stylus-reach verdict for a plan whose deepest commanded toolhead Z is
 * `deepestZMachine`, from the stored geometry and the tool's rim arguments.
 * Throws McpToolError-shaped RimArgError text via the caller's mapping; the
 * caller refuses on `status: 'refused'` with the verdict's numbers.
 */
export function stylusReachForPlan(args: RimArgs, deepestZMachine: number): StylusReachVerdict {
    const stylus = stylusGeometry();
    return checkStylusReach({
        reachMm: stylus.reachMm,
        tipDiameterMm: stylus.tipDiameterMm,
        rimZMachine: parseRimZ(args),
        deepestZMachine,
        marginMm: parseReachMargin(args),
    });
}

export const TRAVEL_FIELDS: GeometryField[] = ['travel_x_min', 'travel_x_max', 'travel_y_min', 'travel_y_max'];

const NO_TRAVEL = { xMin: null, xMax: null, yMin: null, yMax: null };

/**
 * Which machine the travel_* values that apply now belong to: the current
 * machine's store entry (machineStore.ts), null when none of its ends is
 * stated. Other machines' ends are in their own entries and untouched.
 */
export function travelScope(): { statedFor: string | null; stated: string[] } {
    const stated = TRAVEL_FIELDS.filter((field) => geometryValue(field) !== null);
    return { statedFor: stated.length ? machineStore.currentMachine().machineKey : null, stated };
}

/**
 * The travel ends stated FOR `machineIdentifier`; any of them may be null
 * (= not stated). Read from that machine's own entry, so the A350's
 * X -19..339 is never a statement about the Ray, and the Ray's never
 * displaces the A350's. An environment pin applies to whatever is connected.
 */
export function statedTravel(machineIdentifier: string | null): { xMin: number | null; xMax: number | null; yMin: number | null; yMax: number | null } {
    const key = machineStore.keyForIdentifier(machineIdentifier);
    if (key === null) {
        return { ...NO_TRAVEL };
    }
    const store = storeFor(key);
    return {
        xMin: geometryValue('travel_x_min', store),
        xMax: geometryValue('travel_x_max', store),
        yMin: geometryValue('travel_y_min', store),
        yMax: geometryValue('travel_y_max', store),
    };
}

/**
 * The axis-station part of set_probe_geometry: `rotary_axis_points` replaces
 * the whole list (null / [] clears it), `rotary_axis_point` adds one station
 * or restates the one already at its Y (within the position resolution).
 * The resulting list must fit a line (fitRotaryAxisLine's rules) before
 * anything is written. Refused while either scalar is pinned by its
 * environment variable: the line would silently disagree with it.
 */
function applyAxisPoints(
    values: { [field: string]: unknown },
    note: string,
    envOverridden: (spec: typeof GEOMETRY_FIELDS[number]) => boolean,
    store: ReturnType<typeof storeFor>
): { changed: boolean; points: RotaryAxisPoint[]; line: RotaryAxisLine | null } {
    const replace = values[ROTARY_AXIS_POINTS_FIELD];
    const add = values.rotary_axis_point;
    const current = storedAxisPoints(store);
    if (replace === undefined && add === undefined) {
        return { changed: false, points: current.points, line: current.points.length >= 2 ? safeFit(current.points) : null };
    }
    const envPoints = process.env[ROTARY_AXIS_POINTS_ENV];
    if (envPoints !== undefined && String(envPoints).trim() !== '') {
        throw new Error(`${ROTARY_AXIS_POINTS_FIELD} is overridden by the environment variable ${ROTARY_AXIS_POINTS_ENV} on this box; change it there.`);
    }
    for (const spec of GEOMETRY_FIELDS.filter((f) => AXIS_SCALAR_FIELDS.includes(f.field))) {
        if (envOverridden(spec)) {
            throw new Error(`${spec.field} is overridden by the environment variable ${spec.env} on this box, so the axis line cannot be stored `
                + 'beside it; unset the variable first.');
        }
    }
    for (const scalar of AXIS_SCALAR_FIELDS) {
        if (values[scalar] !== undefined && values[scalar] !== null && values[scalar] !== '') {
            throw new Error(`Give ${ROTARY_AXIS_POINTS_FIELD} / rotary_axis_point or ${scalar}, not both: the scalar is derived from the line.`);
        }
    }
    let points: RotaryAxisPoint[];
    try {
        if (replace !== undefined) {
            points = replace === null || replace === '' ? [] : parsePointList(replace, ROTARY_AXIS_POINTS_FIELD, note);
        } else {
            points = [...current.points];
        }
        if (add !== undefined && add !== null) {
            const point = normaliseAxisPoint(add, 'rotary_axis_point', axisPointRanges(), note);
            // Same station restated: replace rather than fit two points 0.02 mm apart.
            points = points.filter((p) => Math.abs(p.y - point.y) > SAME_STATION_MM);
            points.push(point);
            if (points.length > MAX_ROTARY_AXIS_POINTS) {
                throw new RotaryAxisError(`rotary_axis_point: at most ${MAX_ROTARY_AXIS_POINTS} stations; restate one or replace the list.`);
            }
        }
        points.sort((a, b) => a.y - b.y);
        if (points.length === 1) {
            throw new RotaryAxisError(`One axis station (Y ${points[0].y}) does not fix a line: state a second station at a different Y in the same `
                + 'call (rotary_axis_points: [first, second]), or keep the scalar rotary_axis_x / rotary_axis_z_physical until it is measured.');
        }
        if (!points.length) {
            store.unset(ROTARY_AXIS_POINTS_KEY);
            store.unset(`${ROTARY_AXIS_POINTS_KEY}Note`);
            store.unset(`${ROTARY_AXIS_POINTS_KEY}At`);
            return { changed: true, points, line: null };
        }
        const line = fitRotaryAxisLine(points);
        store.set(ROTARY_AXIS_POINTS_KEY, points);
        store.set(`${ROTARY_AXIS_POINTS_KEY}Note`, note);
        store.set(`${ROTARY_AXIS_POINTS_KEY}At`, Date.now());
        return { changed: true, points, line };
    } catch (err) {
        if (err instanceof RotaryAxisError || err instanceof SyntaxError) {
            throw new Error(err.message);
        }
        throw err;
    }
}

/**
 * Store operator-stated / measured values (set_probe_geometry) in the entry of
 * `machineIdentifier` (the connected machine, else the one selected in Luban
 * Machine Settings - the caller resolves it). `null` or '' clears a field.
 * Env-overridden fields are refused so the stored value and the live value
 * never disagree silently. Nothing here touches another machine's entry.
 */
export function setGeometryValues(
    values: { [field: string]: unknown },
    note: string,
    /** The machine the values are stated for; required. */
    machineIdentifier: string | null
): { updated: string[]; cleared: string[]; machineKey: string } {
    const machineKey = machineStore.keyForIdentifier(machineIdentifier);
    if (machineKey === null) {
        throw new Error(`${Object.keys(values).join(', ')}: geometry and travel are stated for ONE machine, and no machine is connected or `
            + 'selected to state them for. Connect the machine (or select it in Luban Machine Settings) first.');
    }
    const store = storeFor(machineKey);
    const updated: string[] = [];
    const cleared: string[] = [];
    const envOverridden = (spec: typeof GEOMETRY_FIELDS[number]) => process.env[spec.env] !== undefined && String(process.env[spec.env]).trim() !== '';
    const pointsAfter = applyAxisPoints(values, note, envOverridden, store);
    for (const spec of GEOMETRY_FIELDS) {
        if (!(spec.field in values) || values[spec.field] === undefined) {
            continue;
        }
        if (envOverridden(spec)) {
            throw new Error(`${spec.field} is overridden by the environment variable ${spec.env} on this box; change it there.`);
        }
        if (AXIS_SCALAR_FIELDS.includes(spec.field) && pointsAfter.line) {
            throw new Error(`${spec.field} is derived from ${ROTARY_AXIS_POINTS_FIELD} (the line at reference Y ${pointsAfter.line.reference_y}) while `
                + `${pointsAfter.points.length} axis stations are stored: restate the station (rotary_axis_point) or clear the points `
                + `(${ROTARY_AXIS_POINTS_FIELD}: null) before setting it by hand.`);
        }
        const raw = values[spec.field];
        if (raw === null || raw === '') {
            store.unset(spec.key);
            store.unset(`${spec.key}Note`);
            store.unset(`${spec.key}At`);
            cleared.push(spec.field);
            continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
            throw new Error(`${spec.field} must be a number in ${spec.min}..${spec.max} (got ${JSON.stringify(raw)}).`);
        }
        store.set(spec.key, n);
        store.set(`${spec.key}Note`, note);
        store.set(`${spec.key}At`, Date.now());
        updated.push(spec.field);
    }
    if (pointsAfter.changed) {
        if (pointsAfter.points.length) {
            updated.push(ROTARY_AXIS_POINTS_FIELD);
        } else {
            cleared.push(ROTARY_AXIS_POINTS_FIELD);
        }
        if (pointsAfter.line) {
            // The legacy scalars follow the line (its values at the reference
            // Y) so every reader of one number sees the measured axis; their
            // note says where they came from.
            const line = pointsAfter.line;
            const derivedNote = `derived from ${ROTARY_AXIS_POINTS_FIELD} (${pointsAfter.points.length} stations, line at reference Y `
                + `${line.reference_y}, yaw ${line.yaw_deg} deg, pitch ${line.pitch_deg} deg): ${note}`;
            const derived: [GeometryField, number][] = [['rotary_axis_x', line.x], ['rotary_axis_z_physical', line.z_physical]];
            for (const [field, value] of derived) {
                const spec = GEOMETRY_FIELDS.find((f) => f.field === field) as typeof GEOMETRY_FIELDS[number];
                store.set(spec.key, value);
                store.set(`${spec.key}Note`, derivedNote);
                store.set(`${spec.key}At`, Date.now());
                updated.push(field);
            }
        }
    }
    return { updated, cleared, machineKey };
}

/** Everything stored, with provenance, for get_stored_state / set_probe_geometry. */
export function geometrySettings() {
    const fields: { [field: string]: GeometryEntry } = {};
    for (const spec of GEOMETRY_FIELDS) {
        const note = machineConfig.get(`${spec.key}Note`);
        const at = Number(machineConfig.get(`${spec.key}At`));
        fields[spec.field] = {
            ...readSetting(spec),
            env: spec.env,
            range: [spec.min, spec.max],
            note: note ? String(note) : null,
            setAt: Number.isFinite(at) && at > 0 ? at : null,
        };
    }
    const stored = storedAxisPoints();
    const rotary = rotaryGeometry();
    if (rotary && rotary.skew === 'measured') {
        for (const field of AXIS_SCALAR_FIELDS) {
            fields[field].derivedFrom = ROTARY_AXIS_POINTS_FIELD;
        }
    }
    const scope = travelScope();
    return {
        fields,
        /**
         * Which machine's entry the travel_* statements shown here come from
         * (every field above is the current machine's; machineStore.ts).
         */
        travel: {
            statedFor: scope.statedFor,
            statedFields: scope.stated,
            note: 'A stated end only TIGHTENS the machine model + travel fudge for the machine it was stated on; it never widens it. '
                + 'Each machine keeps its own ends (get_stored_state.machineStore): stating the Ray\'s leaves the A350\'s untouched.',
        },
        rotary,
        rotaryAxisPoints: {
            field: ROTARY_AXIS_POINTS_FIELD,
            points: stored.points,
            source: stored.source,
            env: ROTARY_AXIS_POINTS_ENV,
            note: stored.note,
            setAt: stored.setAt,
            error: stored.error,
            max: MAX_ROTARY_AXIS_POINTS,
            skew: rotary ? rotary.skew : 'unmeasured',
            fit: rotary ? rotary.line.fit : null,
        },
        probe: probeGeometry(),
        // Issue #187: the reach (tip bottom to the first body shoulder) is
        // what a pocket-floor probe is checked against; its absence is
        // reported by every -Z plan as "stylus reach unknown".
        stylus: {
            ...stylusGeometry(),
            note: 'reachMm = probe_stylus_exposed_mm, the exposed stylus below the body (tip bottom to the first body shoulder) '
                + '- NOT the probe\'s tool length. A -Z march staged with rim_z_machine / surface_z_machine is refused when its '
                + 'contact depth below that rim exceeds reachMm - tipDiameterMm - reach_margin_mm; null = unknown, body collision not checked.',
        },
        note: 'Only programs that reference axis.* need these; B0-only and non-rotary work needs none of them. '
            + 'Set with set_probe_geometry after measuring (axis Z from an opposite-face pair, axis X from a side pair, '
            + 'probe offset from a setter measurement in the SAME documented datum convention). Legacy names do not '
            + 'verify physical machine Z or current fitting applicability; reconcile existing evidence before measuring again. '
            + 'The axis is a LINE: store the side-pair / opposite-face result at each Y station as rotary_axis_point (or the '
            + 'list as rotary_axis_points); rotary.yawDeg / pitchDeg and the axis at any Y derive from two or more stations, '
            + 'and a program\'s axis.x / axis.z_contact are evaluated at each op\'s own Y. skew "unmeasured" = only the legacy '
            + 'scalars exist (yaw 0 assumed, one X for every Y - the pre-#155 model).',
    };
}

/**
 * Namespaces seeded into a program's results before op 1. `axis` exists only
 * when the rotary axis AND the probe length are known (z_contact needs both);
 * otherwise a reference to axis.* is refused at staging with the tool named.
 * The seeded values hold at the line's reference Y; the runner re-evaluates
 * them at each op's own Y station (axisNamespaceAt) when the skew is measured.
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
        axis: axisNamespaceFor(rotary.line, probe),
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
 * camera bootstrap above all. The axis line fixes X and Z at a Y; naming an
 * end fixes Y as well, which is what turns it into a point - evaluated on
 * the measured line, so a yawed axis puts the tailstock where it is.
 */
export function rotaryAxisPoints(): Array<{ name: string; x: number; y: number; z: number }> {
    const g = rotaryGeometry();
    if (!g) {
        return [];
    }
    const points: Array<{ name: string; x: number; y: number; z: number }> = [];
    if (g.tailstockY !== null) {
        const at = axisAt(g.line, g.tailstockY);
        points.push({ name: 'rotary-tailstock', x: at.x, y: g.tailstockY, z: at.z_physical });
    }
    if (g.chuckFaceY !== null) {
        const at = axisAt(g.line, g.chuckFaceY);
        points.push({ name: 'rotary-chuck-face', x: at.x, y: g.chuckFaceY, z: at.z_physical });
    }
    return points;
}
