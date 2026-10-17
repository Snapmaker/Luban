/* eslint-disable camelcase */
// Pure rules for the probe_program op list that do not need the machine:
// which kinds exist, what the no-motion `capture` op takes, and where a
// `home` op may sit. probeProgram.ts applies them; the tests exercise them
// without the server (see tests/run.ts for why the split matters).
//
// Why `capture` and `home` are program ops at all (2026-09-21): the operator
// asked for "move over the stock, photo, rotate B to 180, photo, home" as ONE
// approval. Every motion in that request already had a program op or a gated
// tool; the two non-probing steps did not, so the request cost three confirm
// pages. A `capture` is no motion - a position- and B-stamped frame saved on
// the job record - and a `home` is the same G53;G28;G54 the home tool sends,
// allowed only as the LAST op because it moves every axis to its switches
// and homes B: nothing measured after it would relate to what came before.

import { Bounded, CAPTURE_SETTLE_MS, clampTo } from './procedureLimits';

export const PROGRAM_OP_KINDS = ['rotate_b', 'surface_path', 'surface_grid', 'sequence', 'stock_outline', 'wall_follow', 'corner', 'trace', 'capture', 'home'] as const;
export type ProgramOpKindName = typeof PROGRAM_OP_KINDS[number];

export function isProgramOpKind(kind: unknown): kind is ProgramOpKindName {
    return typeof kind === 'string' && (PROGRAM_OP_KINDS as readonly string[]).includes(kind);
}

/**
 * The machine Y an op works at, read from its OWN arguments (issue #155): the
 * Y the runner evaluates `axis.x` / `axis.z_contact` at when the rotary axis
 * line is yawed or pitched. One number per op - the centre of a span - with
 * a note saying which argument(s) it came from, so the job record shows why
 * this op's axis X differs from the last one's. null when the kind has no
 * Y of its own (rotate_b, home, a capture where the head is) or the
 * arguments do not carry one yet (references unresolved, missing).
 */
export function opStationY(kind: string, args: { [key: string]: unknown }): { y: number; note: string } | null {
    const num = (v: unknown): number | null => {
        const n = Number(v);
        return v === undefined || v === null || v === '' || typeof v === 'object' || !Number.isFinite(n) ? null : n;
    };
    const mid = (a: unknown, b: unknown, note: string): { y: number; note: string } | null => {
        const ya = num(a);
        const yb = num(b);
        return ya === null || yb === null ? null : { y: Number(((ya + yb) / 2).toFixed(3)), note };
    };
    const single = (v: unknown, note: string): { y: number; note: string } | null => {
        const y = num(v);
        return y === null ? null : { y, note };
    };
    if (kind === 'surface_path') {
        return mid(args.start_y, args.end_y, 'mid of start_y..end_y');
    }
    if (kind === 'surface_grid') {
        return mid(args.y_min, args.y_max, 'mid of y_min..y_max');
    }
    if (kind === 'stock_outline') {
        return single(args.center_y, 'center_y');
    }
    if (kind === 'wall_follow' || kind === 'trace') {
        return single(args.start_y, 'start_y');
    }
    if (kind === 'corner') {
        const a = (args.wall_a || {}) as { y?: unknown };
        const b = (args.wall_b || {}) as { y?: unknown };
        return mid(a.y, b.y, 'mid of wall_a.y and wall_b.y');
    }
    if (kind === 'sequence') {
        // The hops carry the Y; probes and descents happen where the last hop went.
        const steps = Array.isArray(args.steps) ? args.steps as { kind?: unknown; y?: unknown }[] : [];
        const ys = steps.filter((st) => st && st.kind === 'hop').map((st) => num(st.y)).filter((y): y is number => y !== null);
        if (!ys.length) {
            return null;
        }
        const lo = Math.min(...ys);
        const hi = Math.max(...ys);
        const y = Number((ys.reduce((a, v) => a + v, 0) / ys.length).toFixed(3));
        return { y, note: ys.length === 1 || hi - lo < 1e-9 ? 'the hops\' Y' : `mean of ${ys.length} hop Y values (${lo}..${hi})` };
    }
    if (kind === 'capture') {
        return single(args.y, 'viewing position y');
    }
    return null;
}

/** The kinds a `group` may repeat per angle: anything but `home` (it ends the program) and a nested group. */
export function groupableOpKind(kind: unknown): boolean {
    return isProgramOpKind(kind) && kind !== 'home';
}

export interface CaptureOpArgs {
    /** Damping wait before the frame, ms (CAPTURE_SETTLE_MS). */
    settle_ms: number;
    /** Free text the agent attaches to the frame (what it expects to see). */
    label: string | null;
    /**
     * Where to look FROM: a machine XY the head hops to at the traverse height
     * before the frame (law 2: raise, then XY), checked against travel and
     * every obstacle box exactly like a sequence hop. null = capture where the
     * previous op left the head. A plain hop-only sequence is refused ("pure
     * motion"), so this is the one way a program positions the camera.
     */
    view: { x: number; y: number } | null;
}

/** Normalise a `capture` op's arguments; every other key is refused so a typo cannot pass silently. */
export function captureOpArgs(raw: { [key: string]: unknown }, where: string): CaptureOpArgs {
    const allowed = ['settle_ms', 'label', 'x', 'y'];
    const unknown = Object.keys(raw).filter((k) => !allowed.includes(k));
    if (unknown.length) {
        throw new Error(`${where} (capture): unknown argument(s) ${unknown.join(', ')} - a capture takes settle_ms, label and an optional viewing position x/y (machine, hopped to at the traverse height).`);
    }
    const label = raw.label === undefined || raw.label === null ? null : String(raw.label).trim().slice(0, 120) || null;
    const hasX = raw.x !== undefined && raw.x !== null;
    const hasY = raw.y !== undefined && raw.y !== null;
    let view: { x: number; y: number } | null = null;
    if (hasX || hasY) {
        const x = Number(raw.x);
        const y = Number(raw.y);
        if (!hasX || !hasY || !Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(`${where} (capture): a viewing position needs BOTH x and y (finite machine coordinates); omit both to capture where the head is.`);
        }
        view = { x, y };
    }
    return { settle_ms: clampTo(raw.settle_ms, CAPTURE_SETTLE_MS as Bounded), label, view };
}

/**
 * A `home` op must be the last op of the program: after G28 every axis is at
 * its switch and B is 0, so no later op could reference anything measured
 * before it, and a rotation schedule the page enumerated would be silently
 * undone half way. Returns the refusal text, or null when the order is fine.
 */
export function homeOrderError(kinds: string[]): string | null {
    const first = kinds.indexOf('home');
    if (first === -1) {
        return null;
    }
    if (first !== kinds.length - 1) {
        return `ops[${first}] (home): a home op must be the LAST op of the program - it drives every axis to its switches and homes B, `
            + `so nothing after it relates to what came before (${kinds.length - 1 - first} op(s) follow it).`;
    }
    return null;
}

/** Job-event estimates for the two no-probe ops (measured shapes: a capture logs its phases; a home ~20 s of polled beats). */
export const CAPTURE_EVENT_BUDGET = 10;
export const HOME_EVENT_BUDGET = 30;
