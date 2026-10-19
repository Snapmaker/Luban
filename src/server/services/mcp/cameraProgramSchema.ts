/* eslint-disable camelcase */
// The same operation contracts are advertised to agents and checked before staging.
import { McpToolError } from './registry';
import { MAX_SURVEY_LEVELS } from './procedureLimits';

interface Schema {
    type: string;
    description?: string;
    properties?: Record<string, Schema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: Schema;
    minItems?: number;
    maxItems?: number;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    enum?: string[];
    pattern?: string;
}

const number: Schema = { type: 'number' };
const text: Schema = { type: 'string' };
const positive: Schema = { type: 'number', exclusiveMinimum: 0 };
const z: Schema = { type: 'number', minimum: 0, description: 'TOOLHEAD machine Z, within configured travel; not physical surface Z.' };
const matrix: Schema = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'array', minItems: 2, maxItems: 2, items: number } };
const clearance: Schema = { type: 'boolean', description: 'Only on the operator\'s explicit clearance statement for THIS op. Never inferred from an active tool or camera image. Stored obstacles still apply.' };
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
const op = (kind: string, properties: Record<string, Schema>, required: string[] = []): Schema => object({
    id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,31}$' },
    kind: { type: 'string', enum: [kind] },
    ...properties,
}, ['id', 'kind', ...required]);

export const cameraOpSchemas: Record<string, Schema> = {
    move_z: op('move_z', { machine_z: z }, ['machine_z']),
    survey_bed: op('survey_bed', {
        machine_z: z,
        z_levels: { type: 'array', minItems: 1, maxItems: MAX_SURVEY_LEVELS, items: z },
        x_min: number,
        x_max: number,
        y_min: number,
        y_max: number,
        margin_mm: { type: 'number', minimum: 0, maximum: 50 },
        pitch_mm: { type: 'number', minimum: 20, maximum: 160 },
        plane_z: { ...number, description: 'PHYSICAL machine surface Z for overlap. Required with overlap_fraction; never toolhead Z. No mosaic inside a program; use standalone survey_bed for mosaics.' },
        overlap_fraction: { type: 'number', minimum: 0, maximum: 0.9, description: 'Requires a verified camera MODEL; derives spacing at every requested Z. A 2x2 calibration is insufficient.' },
        operator_confirmed_clearance: clearance,
    }),
    move_and_capture: op('move_and_capture', { x: number, y: number, machine_z: z, operator_confirmed_clearance: clearance }, ['x', 'y', 'machine_z']),
    capture: op('capture', {}),
    track_feature: op('track_feature', {
        template_capture_id: { ...text, description: 'Earlier capture or move_and_capture id, not a survey id.' },
        search_capture_id: text,
        point: object({ u: number, v: number }, ['u', 'v']),
    }, ['template_capture_id', 'search_capture_id', 'point']),
    fit_calibration: op('fit_calibration', {
        samples: { type: 'array', minItems: 2, items: object({ track_id: text, dx_mm: number, dy_mm: number }, ['track_id', 'dx_mm', 'dy_mm']) },
        max_residual_px: { ...positive, description: 'Default 5 px. Fit stores +J inverse in the local 2x2 calibration store, NOT the camera model.' },
        valid_at_y: number,
        z,
        surface: text,
        notes: text,
    }, ['samples']),
    verify_calibration: op('verify_calibration', {
        fit_id: { ...text, description: 'Earlier fit_calibration id, or supply jacobian AND matrix. Checks M*J only; not independent physical verification.' },
        jacobian: matrix,
        matrix,
        tolerance: { ...positive, description: 'Default 0.25, numerical inverse residual.' },
    }),
};

function validate(value: unknown, schema: Schema, where: string): void {
    const fail = (detail: string): never => { throw new McpToolError(`${where}: ${detail}`); };
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('must be an object.');
        const fields = value as Record<string, unknown>;
        for (const key of schema.required || []) if (fields[key] === undefined) fail(`missing ${key}.`);
        for (const [key, field] of Object.entries(fields)) {
            const child = schema.properties?.[key];
            if (!child || !Object.prototype.hasOwnProperty.call(schema.properties, key)) fail(`unknown field ${key}; use the advertised operation schema.`);
            validate(field, child as Schema, `${where}.${key}`);
        }
    } else if (schema.type === 'array') {
        if (!Array.isArray(value)) fail('must be an array.');
        const values = value as unknown[];
        if (values.length < (schema.minItems || 0) || values.length > (schema.maxItems || Infinity)) fail('invalid item count.');
        values.forEach((item, i) => validate(item, schema.items as Schema, `${where}[${i}]`));
    } else if (schema.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) fail('must be a finite number.');
        const n = value as number;
        if ((schema.minimum !== undefined && n < schema.minimum) || (schema.maximum !== undefined && n > schema.maximum)
            || (schema.exclusiveMinimum !== undefined && n <= schema.exclusiveMinimum)) fail('outside the advertised bounds.');
    } else if (schema.type === 'string') {
        if (typeof value !== 'string' || !value.trim()) fail('must be a nonempty string.');
        if (schema.enum && !schema.enum.includes(value as string)) fail('unsupported value.');
        if (schema.pattern && !new RegExp(schema.pattern).test(value as string)) fail('invalid id.');
    } else if (typeof value !== 'boolean') fail('must be a boolean.');
}

export function validateCameraOps(ops: unknown): void {
    if (!Array.isArray(ops) || !ops.length || ops.length > 80) throw new McpToolError('ops must contain 1-80 operations.');
    const earlier = new Map<string, string>();
    ops.forEach((raw, i) => {
        const item = raw as Record<string, unknown>;
        const schema = item && cameraOpSchemas[String(item.kind)];
        if (!schema || !Object.prototype.hasOwnProperty.call(cameraOpSchemas, String(item.kind))) {
            throw new McpToolError(`ops[${i}].kind is unsupported; use move_z, survey_bed, move_and_capture, capture, track_feature, fit_calibration or verify_calibration.`);
        }
        validate(item, schema, `ops[${i}]`);
        if (earlier.has(String(item.id))) throw new McpToolError(`Duplicate operation id ${item.id}.`);
        const ref = (id: unknown, kinds: string[]) => {
            if (!kinds.includes(earlier.get(String(id)) || '')) throw new McpToolError(`ops[${i}]: ${id} must reference an EARLIER ${kinds.join(' or ')} operation.`);
        };
        if (item.kind === 'survey_bed') {
            if (item.machine_z !== undefined && item.z_levels !== undefined) throw new McpToolError('machine_z and z_levels are mutually exclusive.');
            if (item.overlap_fraction !== undefined && item.plane_z === undefined) throw new McpToolError('overlap_fraction requires the physical surface plane_z.');
        }
        if (item.kind === 'track_feature') {
            ref(item.template_capture_id, ['capture', 'move_and_capture']);
            ref(item.search_capture_id, ['capture', 'move_and_capture']);
        }
        if (item.kind === 'fit_calibration') {
            (item.samples as Array<{ track_id: string }>).forEach((sample) => ref(sample.track_id, ['track_feature']));
        }
        if (item.kind === 'verify_calibration') {
            if (item.fit_id !== undefined) {
                ref(item.fit_id, ['fit_calibration']);
                if (item.jacobian !== undefined || item.matrix !== undefined) throw new McpToolError('Use fit_id OR jacobian plus matrix.');
            } else if (!item.jacobian || !item.matrix) throw new McpToolError('verify_calibration requires fit_id OR jacobian plus matrix.');
        }
        earlier.set(String(item.id), String(item.kind));
    });
}
