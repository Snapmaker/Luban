// Pure helpers for probe_program references (no machine, no server
// imports) so they can be unit-tested: RefSpec parsing, dotted-path lookup
// into earlier op results, bounded resolution, argument substitution.
//
// A reference names ONE operator (exactly one of from / mid / diff / min /
// max), optional scale and plus/minus adjustments (numbers, or paths into
// earlier results so "axis + half-width" is one reference), and REQUIRED
// operator-approved bounds. Resolution stays one level deep on purpose: the
// confirm page prints the whole formula on one line and the operator must be
// able to read it at a glance.

export class RefResolveError extends Error {}

export type RefOperator = 'from' | 'mid' | 'diff' | 'min' | 'max';

export const REF_OPERATORS: RefOperator[] = ['from', 'mid', 'diff', 'min', 'max'];

export interface RefSpec {
    /** "<opId>.<path>" into an earlier op's result, e.g. "c90.top.z" (sequence probe by name) or "ns90.summary.zMean". */
    from?: string;
    /** (a + b) / 2 of two paths, e.g. the stock centre from two side contacts. */
    mid?: string[];
    /** a - b of two paths (times scale), e.g. the width from two side contacts, half-width with scale 0.5. */
    diff?: string[];
    /** Smallest / largest of two or more paths. */
    min?: string[];
    max?: string[];
    /** Multiplier applied to the operator result before plus/minus (default 1). */
    scale?: number;
    /** Added / subtracted after the operator: a number, or a path into earlier results. */
    plus?: number | string;
    minus?: number | string;
    /** REQUIRED operator-approved bounds on the resolved value (after scale/plus/minus). */
    between: [number, number];
}

const PATH_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*\./;

/** The operator a reference uses; null when it is not exactly one of them. */
export function refOperator(value: unknown): RefOperator | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const present = REF_OPERATORS.filter((key) => (value as { [k: string]: unknown })[key] !== undefined);
    return present.length === 1 ? present[0] : null;
}

export function isRef(value: unknown): value is RefSpec {
    return refOperator(value) !== null;
}

/** Every path a reference reads (operator operands plus path-valued plus/minus). */
export function refOperands(ref: RefSpec): string[] {
    const op = refOperator(ref);
    const paths: string[] = [];
    if (op === 'from') {
        paths.push(String(ref.from));
    } else if (op) {
        for (const p of (ref[op] as unknown[]) || []) {
            paths.push(String(p));
        }
    }
    if (typeof ref.plus === 'string') {
        paths.push(ref.plus);
    }
    if (typeof ref.minus === 'string') {
        paths.push(ref.minus);
    }
    return paths;
}

/** Op ids a reference depends on (first path segment of every operand). */
export function refOpIds(ref: RefSpec): string[] {
    return Array.from(new Set(refOperands(ref).map((p) => p.split('.')[0])));
}

export function round3(value: number): number {
    return Number(value.toFixed(3));
}

/** Walk an object by dotted path; arrays may be indexed by number or by an item's name/label. */
export function lookupPath(root: unknown, path: string[]): unknown {
    let cursor: unknown = root;
    for (const token of path) {
        if (cursor === null || cursor === undefined) {
            return undefined;
        }
        if (Array.isArray(cursor)) {
            if (/^\d+$/.test(token)) {
                cursor = cursor[Number(token)];
            } else {
                cursor = cursor.find((item) => item && typeof item === 'object'
                    && ((item as { name?: string }).name === token || (item as { label?: string }).label === token));
            }
            continue;
        }
        if (typeof cursor !== 'object') {
            return undefined;
        }
        cursor = (cursor as { [key: string]: unknown })[token];
    }
    return cursor;
}

/**
 * Read one numeric path from the results so far. Sequence probe results are
 * addressable as "<seqId>.<probeName>.z" (contactMachine.z; likewise .x/.y)
 * as well as by the raw shape.
 */
export function lookupNumber(path: string, results: { [opId: string]: unknown }): number {
    const parts = path.split('.');
    const opId = parts[0];
    if (!(opId in results)) {
        throw new RefResolveError(`Reference "${path}": op "${opId}" has no result yet (order the program so it runs first).`);
    }
    let raw = lookupPath(results[opId], parts.slice(1));
    if ((raw === undefined || raw === null) && parts.length >= 3) {
        const last = parts[parts.length - 1];
        const head = parts.slice(1, -1);
        const candidates = [
            [...head, 'contactMachine', last],
            ['results', ...head, 'contactMachine', last],
            ['results', ...head, last],
        ];
        for (const candidate of candidates) {
            raw = lookupPath(results[opId], candidate);
            if (raw !== undefined && raw !== null) {
                break;
            }
        }
    }
    const numeric = Number(raw);
    if (raw === undefined || raw === null || typeof raw === 'boolean' || !Number.isFinite(numeric)) {
        throw new RefResolveError(`Reference "${path}" did not resolve to a number (got ${JSON.stringify(raw)}).`);
    }
    return numeric;
}

function adjustmentText(ref: RefSpec, values?: { [path: string]: number }): string {
    const show = (term: number | string | undefined) => {
        if (term === undefined) {
            return null;
        }
        if (typeof term === 'string') {
            return values && term in values ? `${term}=${values[term]}` : term;
        }
        return Number(term) ? String(term) : null;
    };
    const plus = show(ref.plus);
    const minus = show(ref.minus);
    return `${plus ? ` + ${plus}` : ''}${minus ? ` - ${minus}` : ''}`;
}

/** Human-readable formula for the confirm page (no values). */
export function describeRef(ref: RefSpec): string {
    const op = refOperator(ref) as RefOperator;
    const scale = ref.scale !== undefined && Number(ref.scale) !== 1 ? ` * ${ref.scale}` : '';
    const head = op === 'from' ? String(ref.from) : `${op}(${(ref[op] as string[]).join(', ')})`;
    return `${head}${scale}${adjustmentText(ref)}`;
}

/** Resolve one reference against the results so far. */
export function resolveRef(ref: RefSpec, results: { [opId: string]: unknown }): { value: number; source: string } {
    const op = refOperator(ref);
    if (!op) {
        throw new RefResolveError('A reference needs exactly one of from / mid / diff / min / max.');
    }
    const values: { [path: string]: number } = {};
    for (const path of refOperands(ref)) {
        values[path] = lookupNumber(path, results);
    }
    let base: number;
    let head: string;
    if (op === 'from') {
        base = values[String(ref.from)];
        head = String(ref.from);
    } else {
        const operands = (ref[op] as string[]).map((p) => values[p]);
        if (op === 'mid') {
            base = (operands[0] + operands[1]) / 2;
        } else if (op === 'diff') {
            base = operands[0] - operands[1];
        } else if (op === 'min') {
            base = Math.min(...operands);
        } else {
            base = Math.max(...operands);
        }
        head = `${op}(${(ref[op] as string[]).map((p) => `${p}=${values[p]}`).join(', ')})`;
    }
    const scale = ref.scale === undefined ? 1 : Number(ref.scale);
    const term = (t: number | string | undefined) => (typeof t === 'string' ? values[t] : (Number(t) || 0));
    let value = base * scale + term(ref.plus) - term(ref.minus);
    value = round3(value);
    const [lo, hi] = ref.between;
    if (value < lo - 1e-9 || value > hi + 1e-9) {
        throw new RefResolveError(`Reference ${describeRef(ref)} resolved to ${value}, outside the approved bounds [${lo}, ${hi}] - refusing the op.`);
    }
    const scaleText = scale !== 1 ? ` * ${scale}` : '';
    return { value, source: `${head}${scaleText}${adjustmentText(ref, values)} = ${value}` };
}

export function refMidpoint(ref: RefSpec): number {
    return round3((ref.between[0] + ref.between[1]) / 2);
}

function substituteDeep(
    value: unknown,
    path: string,
    pick: (ref: RefSpec, path: string) => number,
    refs: { path: string; ref: RefSpec }[]
): unknown {
    if (isRef(value)) {
        refs.push({ path, ref: value });
        return pick(value, path);
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => substituteDeep(item, `${path}[${index}]`, pick, refs));
    }
    if (value && typeof value === 'object') {
        const out: { [k: string]: unknown } = {};
        for (const [k, v] of Object.entries(value as object)) {
            out[k] = substituteDeep(v, path ? `${path}.${k}` : k, pick, refs);
        }
        return out;
    }
    return value;
}

/**
 * Replace every reference anywhere in an args object (any depth: top-level
 * numbers, `steps[1].z`, `expected_profile.circle.center_x`) with `pick(ref)`
 * and list them with their dotted paths for the confirm page.
 */
export function substituteRefs(
    args: { [key: string]: unknown },
    pick: (ref: RefSpec, path: string) => number
): { args: { [key: string]: unknown }; refs: { path: string; ref: RefSpec }[] } {
    const refs: { path: string; ref: RefSpec }[] = [];
    const out = substituteDeep(args, '', pick, refs) as { [key: string]: unknown };
    return { args: out, refs };
}

export function validateRef(ref: RefSpec, where: string): void {
    const op = refOperator(ref);
    if (!op) {
        throw new RefResolveError(`${where}: a reference needs exactly one of "from" (path), "mid" [a, b], "diff" [a, b], "min" [...], "max" [...].`);
    }
    if (op !== 'from') {
        const operands = ref[op];
        const need = op === 'mid' || op === 'diff' ? 'exactly 2' : 'at least 2';
        const countOk = Array.isArray(operands) && (op === 'mid' || op === 'diff' ? operands.length === 2 : operands.length >= 2);
        if (!countOk) {
            throw new RefResolveError(`${where}: "${op}" needs ${need} paths.`);
        }
    }
    if (ref.scale !== undefined && (!Number.isFinite(Number(ref.scale)) || Number(ref.scale) === 0)) {
        throw new RefResolveError(`${where}: "scale" must be a non-zero number.`);
    }
    for (const term of [ref.plus, ref.minus]) {
        if (term !== undefined && typeof term !== 'string' && !Number.isFinite(Number(term))) {
            throw new RefResolveError(`${where}: "plus"/"minus" must be a number or a "<opId>.<path>" string.`);
        }
    }
    if (!Array.isArray(ref.between) || ref.between.length !== 2
        || !Number.isFinite(Number(ref.between[0])) || !Number.isFinite(Number(ref.between[1]))
        || Number(ref.between[0]) >= Number(ref.between[1])) {
        throw new RefResolveError(`${where}: a reference needs operator-approved bounds "between": [low, high] (law 3 - the page shows the range).`);
    }
    for (const path of refOperands(ref)) {
        if (typeof path !== 'string' || !PATH_PATTERN.test(path)) {
            throw new RefResolveError(`${where}: every reference path must be "<opId>.<path>" (e.g. "c90.top.z", "ns90.summary.zMean"); got ${JSON.stringify(path)}.`);
        }
    }
}
