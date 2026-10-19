/* eslint-disable camelcase */
// Pure expansion of probe_program `group` ops (mcp/48 W5): the same
// sub-program run at several rotary angles. Expanded BEFORE validation, so
// the planner, the confirm page and the runner see plain ops only.
//
//   { id: "faces", kind: "group", for_b: [0, 90, 180, 270], ops: [ ...inner ops... ] }
//
// becomes, per angle: a rotate_b op `<gid>_rot_b<angle>`, then every inner
// op with the literal `${b}` replaced by the angle in EVERY string (ids,
// names, reference paths) and, for inner ids that carry no `${b}`, an
// automatic `_b<angle>` suffix - references to those ids inside the same
// group are rewritten to the suffixed id so the agent writes the sub-program
// once. References to ops OUTSIDE the group are left alone.

export class GroupExpandError extends Error {}

// The literal "${b}" token agents write, without the linter reading it as a template literal.
const B_TOKEN = ['$', '{b}'].join('');

const REF_KEYS = ['from', 'mid', 'diff', 'min', 'max', 'plus', 'minus'];

function substituteB(value: unknown, angle: number): unknown {
    if (typeof value === 'string') {
        return value.replace(/\$\{b\}/g, String(angle));
    }
    if (Array.isArray(value)) {
        return value.map((v) => substituteB(v, angle));
    }
    if (value && typeof value === 'object') {
        const out: { [k: string]: unknown } = {};
        for (const [k, v] of Object.entries(value as object)) {
            out[k] = substituteB(v, angle);
        }
        return out;
    }
    return value;
}

/** Rewrite "<id>.<path>" reference paths whose id is in `rename`. */
function renameRefIds(value: unknown, rename: { [id: string]: string }, key: string | null = null): unknown {
    if (typeof value === 'string' && key !== null && REF_KEYS.includes(key)) {
        const dot = value.indexOf('.');
        if (dot > 0) {
            const id = value.slice(0, dot);
            if (id in rename) {
                return `${rename[id]}${value.slice(dot)}`;
            }
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((v) => renameRefIds(v, rename, key));
    }
    if (value && typeof value === 'object') {
        const out: { [k: string]: unknown } = {};
        for (const [k, v] of Object.entries(value as object)) {
            out[k] = renameRefIds(v, rename, k);
        }
        return out;
    }
    return value;
}

export interface ExpandedGroup {
    id: string;
    angles: number[];
    innerCount: number;
}

/**
 * Expand every `group` op in place order. Returns the flat op list and a
 * description of each group for the confirm page header.
 */
export function expandProgramGroups(rawOps: unknown[]): { ops: unknown[]; groups: ExpandedGroup[] } {
    const ops: unknown[] = [];
    const groups: ExpandedGroup[] = [];
    rawOps.forEach((raw, index) => {
        const op = raw as { [key: string]: unknown } | null;
        if (!op || typeof op !== 'object' || op.kind !== 'group') {
            ops.push(raw);
            return;
        }
        const where = `ops[${index}] (group)`;
        const gid = String(op.id || '');
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(gid)) {
            throw new GroupExpandError(`${where}: id is required (letters, digits, _ or -, max 32 chars).`);
        }
        const angles = Array.isArray(op.for_b) ? op.for_b.map(Number) : [];
        if (angles.length < 1 || angles.length > 8 || angles.some((a) => !Number.isFinite(a) || a < -360 || a > 360)) {
            throw new GroupExpandError(`${where}: for_b must list 1-8 absolute B angles in -360..360.`);
        }
        if (new Set(angles).size !== angles.length) {
            throw new GroupExpandError(`${where}: for_b repeats an angle.`);
        }
        const inner = Array.isArray(op.ops) ? op.ops : [];
        if (inner.length < 1 || inner.length > 20) {
            throw new GroupExpandError(`${where}: ops must hold 1-20 inner operations.`);
        }
        const innerIds = inner.map((o) => String((o as { id?: unknown } | null)?.id || ''));
        if (innerIds.some((id) => !id)) {
            throw new GroupExpandError(`${where}: every inner op needs an id.`);
        }
        if (inner.some((o) => (o as { kind?: unknown } | null)?.kind === 'group')) {
            throw new GroupExpandError(`${where}: groups do not nest.`);
        }
        for (const angle of angles) {
            const rename: { [id: string]: string } = {};
            for (const id of innerIds) {
                if (!id.includes(B_TOKEN)) {
                    rename[id] = `${id}_b${angle}`;
                }
            }
            ops.push({ id: `${gid}_rot_b${angle}`, kind: 'rotate_b', b: angle });
            for (const o of inner) {
                const withB = substituteB(o, angle) as { [key: string]: unknown };
                const renamed = renameRefIds(withB, rename) as { [key: string]: unknown };
                const id = String(renamed.id);
                if (id in rename) {
                    renamed.id = rename[id];
                }
                ops.push(renamed);
            }
        }
        groups.push({ id: gid, angles, innerCount: inner.length });
    });
    return { ops, groups };
}
