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

import { MotionSegment, sequenceMotion } from './envelopeChecks';
import { Bounded, CAPTURE_SETTLE_MS, DESCENT_SEGMENT_MM, MAX_STATED_MACHINE_Z_MM, clampReported, clampTo } from './procedureLimits';

export const PROGRAM_OP_KINDS = ['rotate_b', 'surface_path', 'surface_grid', 'sequence', 'stock_outline', 'wall_follow', 'corner', 'trace', 'capture', 'home'] as const;
export type ProgramOpKindName = typeof PROGRAM_OP_KINDS[number];

export function isProgramOpKind(kind: unknown): kind is ProgramOpKindName {
    return typeof kind === 'string' && (PROGRAM_OP_KINDS as readonly string[]).includes(kind);
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
    /**
     * A toolhead MACHINE Z to frame from (#177): a measured or operator-
     * stated height (in a program a bounded reference), never a guess. Frames
     * from the traverse height cannot resolve a contact point or a pocket
     * wall. After the viewing hop (or from where the previous op left the
     * head) the runner descends to it as a probe_sequence descend step does -
     * fast segments to DESCENT_GUARD_MM above, then 1 mm sensor-checked steps,
     * any contact aborts - settles, takes the frame stamped with that Z and
     * raises STRAIGHT back to the traverse height, so the op still ends
     * raised. null = frame from where the head is.
     */
    z: number | null;
    /** Longest fast segment of that descent (DESCENT_SEGMENT_MM; #166: lowered with descent_segment_mm). */
    descent_segment_mm: number;
    /** What the op asked for when it differs from descent_segment_mm (the clip is reported on the page). */
    descent_segment_requested_mm: number | null;
}

/** Normalise a `capture` op's arguments; every other key is refused so a typo cannot pass silently. */
export function captureOpArgs(raw: { [key: string]: unknown }, where: string): CaptureOpArgs {
    const allowed = ['settle_ms', 'label', 'x', 'y', 'z', 'descent_segment_mm'];
    const unknown = Object.keys(raw).filter((k) => !allowed.includes(k));
    if (unknown.length) {
        throw new Error(`${where} (capture): unknown argument(s) ${unknown.join(', ')} - a capture takes settle_ms, label, an optional viewing position x/y (machine, hopped to at the traverse height), an optional z (a measured or operator-stated toolhead machine Z to descend to for the frame) and descent_segment_mm (${DESCENT_SEGMENT_MM.min}-${DESCENT_SEGMENT_MM.max}, the descent's fast segment length).`);
    }
    if (raw.descent_segment_mm !== undefined && raw.descent_segment_mm !== null && (raw.z === undefined || raw.z === null)) {
        throw new Error(`${where} (capture): descent_segment_mm needs a z to descend to.`);
    }
    const segment = clampReported(raw.descent_segment_mm, DESCENT_SEGMENT_MM);
    let z: number | null = null;
    if (raw.z !== undefined && raw.z !== null) {
        z = Number(raw.z);
        if (typeof raw.z === 'boolean' || raw.z === '' || !Number.isFinite(z) || z < 0 || z > MAX_STATED_MACHINE_Z_MM) {
            throw new Error(`${where} (capture): z must be a toolhead MACHINE Z in 0..${MAX_STATED_MACHINE_Z_MM} - measured or operator-stated, never a guess; omit it to frame from where the head is.`);
        }
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
    return {
        settle_ms: clampTo(raw.settle_ms, CAPTURE_SETTLE_MS as Bounded),
        label,
        view,
        z,
        descent_segment_mm: segment.value,
        descent_segment_requested_mm: segment.clipped ? segment.requested : null,
    };
}

/**
 * The moves a capture op commands, as the envelope check sees them: the
 * viewing hop at the traverse height (a sequence hop in every respect) and,
 * with a stated z, the descent column at the viewing XY - or at `from`'s XY
 * when there is no view - from the traverse height down to z. Checked with
 * the stored landmarks and the program's keep-out boxes (law 4: a column
 * into a VOLUME is refused; a CROSSING landmark allows a column inside it).
 * Empty for a capture that moves nothing.
 */
export function captureMotion(
    capture: Pick<CaptureOpArgs, 'view' | 'z'>,
    from: { x: number; y: number; z: number },
    hopZ: number
): MotionSegment[] {
    const steps: ({ kind: 'hop'; x: number; y: number } | { kind: 'descend'; z: number })[] = [];
    if (capture.view) {
        steps.push({ kind: 'hop', x: capture.view.x, y: capture.view.y });
    }
    if (capture.z !== null) {
        steps.push({ kind: 'descend', z: capture.z });
    }
    return sequenceMotion({ hopZ, staged: from, steps });
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
