/* eslint-disable camelcase */
// Review fields are MCP tool results, snake_case by convention.
// Operator-confirmed landmark review, per machine (tyeth/Luban#265 WP5, plan
// 2.6 + amendments R3/R4).
//
// Operator rule: "Landmarks should be assumed temporary but not removed
// unless human confirmed." Every stored landmark keeps being ENFORCED in full
// whatever this module says about it: a stale or unconfirmed set only makes
// the system more cautious (the question is asked, approval-free transport
// stages), never less. What this module adds is the QUESTION - what is on the
// bed now, are the heights and keep-outs right, and for a legacy record what
// its physical top is - and the bookkeeping that says whether the operator
// has answered it for this connection.
//
// The answer is the operator's click on a staged review page, never an agent
// call (R4): confirm_landmarks only stages the page. The approval records a
// LandmarkConfirmation - when, on which connection, and a fingerprint of the
// set it showed - and that confirmation stops counting the moment the set
// changes (any edit, from any path, including the pendant settings page), the
// connection changes (disconnect / reconnect / restart), the per-machine TTL
// passes, or a device conflict opens.
//
// Changes are judged here too (classifyLandmarkChange): adding or tightening a
// landmark takes effect at once; removing or loosening one (lower, smaller,
// no longer an obstacle, or a legacy toolhead height restated as a physical
// top that could demand less) is staged for the operator's approval, and the
// old record keeps applying until then.
//
// Pure: no server imports, unit-tested in tests/landmarkReview.test.ts.
import crypto from 'crypto';

import { CLEARANCE_MARGIN_MM, ClearanceBasis, needsRestatement, requiredToolheadZ } from './landmarkClearance';
import { POSITION_EPSILON_MM } from './envelopeChecks';

export type LandmarkReviewStatus = 'empty' | 'unconfirmed' | 'stale' | 'legacy-basis' | 'device-conflict' | 'confirmed';

/** Who stated a landmark's height: the operator, or a measurement (a setter / probe job, named in measuredBy). */
export type LandmarkSource = 'operator' | 'measured';

/** The retired legacy toolhead clearance a physical restatement replaced, kept for audit only - never enforced. */
export interface LegacyClearance {
    clearanceZ: number;
    basis: 'toolhead';
    retiredAt: number;
}

export interface LandmarkBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/** The fields of landmarks.ts's Landmark this module reads (structural, so it stays import-free). */
export interface ReviewLandmark {
    id: string;
    name: string;
    description?: string;
    machine: LandmarkBox;
    clearanceZ: number | null;
    clearanceBasis: ClearanceBasis;
    notes?: string | null;
    createdAt: number;
    updatedAt?: number;
    source?: LandmarkSource;
    measuredBy?: string | null;
    legacy?: LegacyClearance | null;
    machineIdentifier?: string;
    legacyScope?: boolean;
}

/** What the operator's approval of a review page records, per machine (machineStore `landmarksConfirmed`). */
export interface LandmarkConfirmation {
    at: number;
    /** The connection the page was approved on (connection generation + a per-process id): a reconnect or a restart ends it. */
    session: string;
    /** landmarkSetFingerprint() of the set the page showed. */
    fingerprint: string;
    /** Per landmark id, the landmarkFingerprint() the page showed - so an unchanged record keeps its confirmedAt in the report. */
    items: { [id: string]: string };
    reviewId: string;
    note: string | null;
}

export interface ReviewDeviceConflict {
    deviceId: string;
    recorded: string[];
    note: string;
}

export interface ReviewInput {
    /** The landmarks that apply to the connected machine (landmarkStore.listFor()). */
    landmarks: ReviewLandmark[];
    confirmation: LandmarkConfirmation | null;
    now: number;
    ttlHours: number;
    /** The live connection session; null when no machine is connected (nothing can be confirmed then). */
    session: string | null;
    deviceConflict: ReviewDeviceConflict | null;
    machine: { identifier: string | null; machineKey: string | null };
    /** clearanceContext.currentToolProtrusion().mm - only for the requiredToolheadZ shown. */
    toolProtrusionMm: number | null;
    clearanceMarginMm?: number;
}

export interface ReviewedLandmark {
    id: string;
    name: string;
    box: LandmarkBox;
    /** The physical top of the obstacle itself (basis 'physical'); null for a legacy record or a non-obstacle. */
    obstacle_top_z: number | null;
    /** The legacy toolhead clearance (basis 'toolhead'); null otherwise. */
    clearance_z: number | null;
    basis: ClearanceBasis | null;
    /** The toolhead machine Z a path over the box needs NOW, with the live tool. null = not an obstacle, or impassable (tool unknown). */
    requiredToolheadZ: number | null;
    requirementNote: string;
    source: LandmarkSource;
    measured_by: string | null;
    /** When the operator last confirmed this record as it is now; null when never, or edited since. */
    confirmedAt: number | null;
    ageHours: number;
    legacy: LegacyClearance | null;
}

export interface LandmarkReview {
    status: LandmarkReviewStatus;
    /** True only for 'confirmed'. Every landmark is enforced either way. */
    confirmed: boolean;
    machine: { identifier: string | null; machineKey: string | null; connected: boolean };
    landmarks: ReviewedLandmark[];
    /** The question for the operator; null when confirmed. */
    question: string | null;
    answer_with: string[];
    ttl_hours: number;
    confirmed_at: number | null;
    expires_at: number | null;
    /** Why an existing confirmation no longer counts (edited / disconnected / expired / device conflict); null otherwise. */
    invalidated_because: string | null;
    enforcement: string;
}

const ENFORCEMENT_NOTE = 'Every landmark listed is ENFORCED in full whatever the status: an unconfirmed or stale set only adds caution '
    + '(this question, and moves that would run without approval are staged). Nothing is removed or lowered without the operator\'s '
    + 'approval on a staged page.';

const f3 = (n: number) => Number(n.toFixed(3));

function sha(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** What a confirmation vouches for in one record: identity, box and clearance - not its description or the live tool. */
export function landmarkFingerprint(landmark: ReviewLandmark): string {
    const b = landmark.machine;
    return sha(JSON.stringify([landmark.id, landmark.name, [b.x0, b.y0, b.x1, b.y1], landmark.clearanceZ, landmark.clearanceBasis]));
}

/** The whole applying set, order-independent. An empty set has a fingerprint too: "the bed is clear" is confirmable. */
export function landmarkSetFingerprint(landmarks: ReviewLandmark[]): string {
    return sha(JSON.stringify(landmarks.map(landmarkFingerprint).sort()));
}

/** The per-record fingerprints a confirmation stores. */
export function landmarkItemFingerprints(landmarks: ReviewLandmark[]): { [id: string]: string } {
    const items: { [id: string]: string } = {};
    for (const l of landmarks) {
        items[l.id] = landmarkFingerprint(l);
    }
    return items;
}

export function describeReviewedLandmark(landmark: ReviewLandmark, input: Pick<ReviewInput, 'now' | 'toolProtrusionMm' | 'clearanceMarginMm' | 'confirmation'>): ReviewedLandmark {
    const margin = input.clearanceMarginMm ?? CLEARANCE_MARGIN_MM;
    const obstacle = landmark.clearanceZ !== null;
    const required = obstacle
        ? requiredToolheadZ(landmark.clearanceZ as number, landmark.clearanceBasis, input.toolProtrusionMm, margin)
        : null;
    let requirementNote = 'Not an obstacle (no height stated): surfaced near captures, never a keep-out.';
    if (obstacle && landmark.clearanceBasis === 'toolhead') {
        requirementNote = `Legacy toolhead height ${landmark.clearanceZ}: tool length already baked in, enforced as stated.`;
    } else if (obstacle && required === null) {
        requirementNote = `Physical top ${landmark.clearanceZ}, but no tool length is known: IMPASSABLE until one is stated.`;
    } else if (obstacle) {
        requirementNote = `Physical top ${landmark.clearanceZ} + ${input.toolProtrusionMm} mm tool + ${margin} mm margin = toolhead Z ${required}.`;
    }
    const c = input.confirmation;
    return {
        id: landmark.id,
        name: landmark.name,
        box: { ...landmark.machine },
        obstacle_top_z: obstacle && landmark.clearanceBasis === 'physical' ? landmark.clearanceZ : null,
        clearance_z: obstacle && landmark.clearanceBasis === 'toolhead' ? landmark.clearanceZ : null,
        basis: obstacle ? landmark.clearanceBasis : null,
        requiredToolheadZ: required,
        requirementNote,
        source: landmark.source || 'operator',
        measured_by: landmark.measuredBy || null,
        confirmedAt: c && c.items && c.items[landmark.id] === landmarkFingerprint(landmark) ? c.at : null,
        ageHours: f3(Math.max(0, input.now - (landmark.updatedAt || landmark.createdAt)) / 3600000),
        legacy: landmark.legacy || null,
    };
}

export function boxText(b: LandmarkBox): string {
    return `X${b.x0}..${b.x1} Y${b.y0}..${b.y1}`;
}

export function heightText(l: ReviewedLandmark): string {
    if (l.basis === null) {
        return 'not an obstacle';
    }
    if (l.basis === 'toolhead') {
        return `legacy toolhead Z ${l.clearance_z}`;
    }
    return `physical top Z ${l.obstacle_top_z} -> needs toolhead Z ${l.requiredToolheadZ === null ? 'unknown (impassable: no tool length)' : l.requiredToolheadZ}`;
}

/**
 * Where the operator's last confirmation stands: valid, or why not. An edit
 * is reported before a lapse - the set the operator saw is not the set now.
 */
export function confirmationValidity(input: ReviewInput): { valid: boolean; reason: string | null; expiresAt: number | null; edited: boolean } {
    const c = input.confirmation;
    if (!c) {
        return { valid: false, reason: null, expiresAt: null, edited: false };
    }
    const expiresAt = c.at + input.ttlHours * 3600000;
    if (c.fingerprint !== landmarkSetFingerprint(input.landmarks)) {
        return { valid: false, reason: 'the landmarks were edited after the operator confirmed them', expiresAt, edited: true };
    }
    if (input.session === null) {
        return { valid: false, reason: 'no machine is connected, and a confirmation lasts only for the connection it was made on', expiresAt, edited: false };
    }
    if (c.session !== input.session) {
        return { valid: false, reason: 'the machine was disconnected (or Luban restarted) since the operator confirmed', expiresAt, edited: false };
    }
    if (input.now > expiresAt) {
        return { valid: false, reason: `the confirmation is older than landmark_confirm_ttl_hours (${input.ttlHours} h)`, expiresAt, edited: false };
    }
    return { valid: true, reason: null, expiresAt, edited: false };
}

export const ANSWER_CONFIRM = 'confirm_landmarks {note?} - STAGES a review page listing every landmark; only the operator\'s approval on that page '
    + 'confirms the set (the call alone confirms nothing)';
export const ANSWER_SET = 'set_landmark {name, obstacle_top_z, x0..y1 (new only), source} - adding or tightening applies now; lowering, '
    + 'shrinking or un-marking an obstacle STAGES a page and the old record applies until the operator approves';
export const ANSWER_DELETE = 'delete_landmark {id} - it is no longer on the bed: STAGES a page; removed only on the operator\'s approval';
export const ANSWER_ASSIGN = 'assign_machine_device {same_machine} - STAGES a page; the operator\'s approval answers "is this the same machine?"';

/**
 * The review of the landmarks that apply to the connected machine.
 *
 * Status precedence: device-conflict (the records may not even be this
 * machine's), then - unless a valid confirmation stands - empty, legacy-basis
 * (some record still bakes a tool into its height), stale (a confirmation
 * existed but lapsed: disconnect, restart or TTL), unconfirmed; then
 * confirmed. A confirmed set may still contain legacy records: the operator
 * vouched for them as listed, and they are enforced exactly as before.
 */
export function reviewLandmarks(input: ReviewInput): LandmarkReview {
    const validity = confirmationValidity(input);
    const landmarks = input.landmarks.map((l) => describeReviewedLandmark(l, input));
    const machineName = input.machine.identifier || 'the selected machine (none connected)';
    const legacy = input.landmarks.filter((l) => needsRestatement(l.clearanceZ, l.clearanceBasis));
    const base = {
        machine: { identifier: input.machine.identifier, machineKey: input.machine.machineKey, connected: input.session !== null },
        landmarks,
        ttl_hours: input.ttlHours,
        confirmed_at: input.confirmation ? input.confirmation.at : null,
        expires_at: validity.expiresAt,
        enforcement: ENFORCEMENT_NOTE,
    };

    if (input.deviceConflict) {
        return {
            ...base,
            status: 'device-conflict',
            confirmed: false,
            question: `${input.deviceConflict.note} Is this the same physical machine as ${input.deviceConflict.recorded.join(', ')}? `
                + `Until the operator answers, the ${landmarks.length} stored landmark(s) are enforced but unconfirmed for it.`,
            answer_with: [ANSWER_ASSIGN],
            invalidated_because: input.confirmation ? 'a device conflict is open for this connection' : null,
        };
    }
    if (validity.valid) {
        return { ...base, status: 'confirmed', confirmed: true, question: null, answer_with: [ANSWER_SET, ANSWER_DELETE], invalidated_because: null };
    }

    const lapse = validity.reason ? ` (The last confirmation no longer counts: ${validity.reason}.)` : '';
    if (!landmarks.length) {
        return {
            ...base,
            status: 'empty',
            confirmed: false,
            question: `No landmarks are recorded for ${machineName}. What is on the bed right now - a vise, clamps, a jig, a rotary `
                + 'module, a tool setter, stock standing proud? Record each with set_landmark (its machine-coordinate box and the '
                + 'PHYSICAL top of the obstacle itself, obstacle_top_z), or, if the bed really is clear, say so on the staged '
                + `confirm_landmarks page.${lapse}`,
            answer_with: [ANSWER_SET, ANSWER_CONFIRM],
            invalidated_because: validity.reason,
        };
    }
    const listing = landmarks.map((l) => `'${l.name}' ${boxText(l.box)}, ${heightText(l)}`).join('; ');
    let question = `Before motion on ${machineName}: these ${landmarks.length} landmark(s) are enforced: ${listing}. Is this what is on `
        + 'the bed right now? Are the heights and keep-out boxes right, and is anything on the bed that is not listed?';
    let status: LandmarkReviewStatus = validity.reason && !validity.edited ? 'stale' : 'unconfirmed';
    if (legacy.length) {
        status = 'legacy-basis';
        question += ` ${legacy.map((l) => `'${l.name}'`).join(' and ')} ${legacy.length === 1 ? 'is' : 'are'} on the legacy basis `
            + `(${legacy.map((l) => `toolhead Z ${l.clearanceZ}`).join(', ')} with a tool length baked in): what is the PHYSICAL top of `
            + `${legacy.length === 1 ? 'it' : 'each'} (obstacle_top_z, the obstacle itself, no tool)? Restating it lower than the legacy height `
            + 'is staged for the operator\'s approval; the legacy height applies until then.';
    }
    return {
        ...base,
        status,
        confirmed: false,
        question: question + lapse,
        answer_with: [ANSWER_CONFIRM, ANSWER_SET, ANSWER_DELETE],
        invalidated_because: validity.reason,
    };
}

export type LandmarkChangeKind = 'add' | 'tighten' | 'unchanged' | 'loosen' | 'delete';

export interface LandmarkChange {
    kind: LandmarkChangeKind;
    /** True for loosen and delete: the change waits for the operator's approval on a staged page. */
    needsApproval: boolean;
    reasons: string[];
}

function containsBox(outer: LandmarkBox, inner: LandmarkBox): boolean {
    return outer.x0 <= inner.x0 + POSITION_EPSILON_MM && outer.y0 <= inner.y0 + POSITION_EPSILON_MM
        && outer.x1 >= inner.x1 - POSITION_EPSILON_MM && outer.y1 >= inner.y1 - POSITION_EPSILON_MM;
}

/**
 * Whether replacing `before` by `after` could let a path go lower or closer
 * than before. Judged for EVERY tool that could be fitted, not just today's:
 *  - physical -> physical: the top itself (the same tool is added to both);
 *  - toolhead -> toolhead: the stored heights;
 *  - toolhead -> physical (the guided restatement): the least the physical
 *    record can ever demand is top + margin (a tool that protrudes nothing),
 *    so it loosens unless that is still >= the legacy height. Judging it with
 *    today's long probe would let the next short bit lower it unapproved;
 *  - physical -> toolhead: a fixed height can be below top + a long tool, so
 *    it is always treated as loosening.
 */
export function classifyLandmarkChange(
    before: ReviewLandmark | null,
    after: ReviewLandmark | null,
    marginMm: number = CLEARANCE_MARGIN_MM
): LandmarkChange {
    if (!before) {
        return { kind: 'add', needsApproval: false, reasons: ['new landmark'] };
    }
    if (!after) {
        return { kind: 'delete', needsApproval: true, reasons: [`'${before.name}' would no longer be enforced`] };
    }
    const looser: string[] = [];
    const tighter: string[] = [];
    if (!containsBox(after.machine, before.machine)) {
        looser.push(`the keep-out box ${boxText(after.machine)} no longer covers all of ${boxText(before.machine)}`);
    } else if (!containsBox(before.machine, after.machine)) {
        tighter.push(`the keep-out box grows to ${boxText(after.machine)}`);
    }
    const b = before.clearanceZ;
    const a = after.clearanceZ;
    if (b !== null && a === null) {
        looser.push(`it would no longer be an obstacle (was ${before.clearanceBasis} Z ${b})`);
    } else if (b === null && a !== null) {
        tighter.push(`it becomes an obstacle (${after.clearanceBasis} Z ${a})`);
    } else if (b !== null && a !== null) {
        if (before.clearanceBasis === after.clearanceBasis) {
            if (a < b - POSITION_EPSILON_MM) {
                looser.push(`its ${after.clearanceBasis} height drops ${b} -> ${a}`);
            } else if (a > b + POSITION_EPSILON_MM) {
                tighter.push(`its ${after.clearanceBasis} height rises ${b} -> ${a}`);
            }
        } else if (before.clearanceBasis === 'toolhead') {
            const least = f3(a + marginMm);
            if (least < b - POSITION_EPSILON_MM) {
                looser.push(`restated as physical top ${a}: with a short enough tool it demands as little as toolhead Z ${least} `
                    + `(top + ${marginMm} mm margin), below the legacy toolhead Z ${b}`);
            } else {
                tighter.push(`restated as physical top ${a}: never demands less than the legacy toolhead Z ${b}`);
            }
        } else {
            looser.push(`a fixed toolhead Z ${a} can be below physical top ${b} + a long tool + margin`);
        }
    }
    if (looser.length) {
        return { kind: 'loosen', needsApproval: true, reasons: looser };
    }
    if (tighter.length) {
        return { kind: 'tighten', needsApproval: false, reasons: tighter };
    }
    return { kind: 'unchanged', needsApproval: false, reasons: ['no change to the box or the height'] };
}

export interface LandmarkPatch {
    description?: string;
    box?: LandmarkBox;
    /** undefined = keep; {z: null} = no longer an obstacle. */
    clearance?: { z: number | null; basis: ClearanceBasis };
    notes?: string | null;
    source?: LandmarkSource;
    measuredBy?: string | null;
}

/**
 * UPDATE semantics for set_landmark on an existing name: only the given
 * fields change, the box is kept unless restated. A legacy toolhead record
 * restated physically keeps its old height in `legacy` for audit.
 */
export function mergeLandmarkUpdate<T extends ReviewLandmark>(before: T, patch: LandmarkPatch, now: number): T {
    const after: T = { ...before, machine: { ...before.machine }, updatedAt: now };
    if (patch.description !== undefined) {
        after.description = patch.description;
    }
    if (patch.box) {
        after.machine = { ...patch.box };
    }
    if (patch.notes !== undefined) {
        after.notes = patch.notes;
    }
    if (patch.clearance) {
        after.clearanceZ = patch.clearance.z;
        after.clearanceBasis = patch.clearance.basis;
        if (patch.clearance.z !== null && patch.clearance.basis === 'physical' && before.clearanceBasis === 'toolhead' && before.clearanceZ !== null) {
            after.legacy = { clearanceZ: before.clearanceZ, basis: 'toolhead', retiredAt: now };
        }
    }
    if (patch.source !== undefined) {
        after.source = patch.source;
        after.measuredBy = patch.source === 'measured' ? (patch.measuredBy ?? before.measuredBy ?? null) : null;
    } else if (patch.measuredBy !== undefined) {
        after.measuredBy = patch.measuredBy;
    }
    return after;
}
