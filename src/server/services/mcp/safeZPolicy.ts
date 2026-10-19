// Approval-free transport at the traverse height (operator ruling 2026-10-17,
// issue #241: "if we've got to top z there's no approval for move at top z").
//
// A freshly homed A350 sits at machine Z328 - the traverse height, above
// every stored landmark clearance. An XY-only move from there, planned by
// planTraverseXy (travel + landmark checks, Z never written), is the one
// transport the confirm page adds nothing to: the operator clicked roughly
// ten such pages in one session (traverse to above the first hole, to the
// camera viewpoint, 354 mm to the far X for a tool swap). Precedent: the
// move_and_capture Z gate (#163) already runs XY at 328 on the call.
//
// Pure: the decision is made from the judged position of record and the
// setting; unit-tested in tests/safeZPolicy.test.ts. The callers
// (traverse_xy, goto_tool_change_position's XY step, an up-only move_z) still
// create the job record - auto-approved with the policy named - so the
// dashboard, the job log, get_job_timing, the console `reason` broadcast and
// stop_gcode_job all keep working. Only the click is removed.
import { Reliability } from './machinePosition';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

export const SAFE_Z_TRAVERSE_POLICY = 'policy:safe-z-traverse';
export const SAFE_Z_RAISE_POLICY = 'policy:safe-z-raise';
/** Where the operator turns approval-free transport on or off. */
export const MOTION_RULES_WHERE = 'Settings > MCP > Motion rules';

export interface SafeZPolicyInput {
    /** mcpTraverseWithoutApprovalAtSafeZ (Settings -> MCP Server -> Job approval). */
    enabled: boolean;
    /**
     * Why approval-free transport is off for this machine, in the operator's
     * words (tools/machine.ts traverseWithoutApprovalPolicy().gatedBy, or the
     * host switch). Omitted = the generic sentence naming the setting.
     */
    gatedBy?: string | null;
    /** The judged reliability of the position of record (get_position). */
    reliability: Reliability;
    homed: boolean | null;
    /** Machine Z of record; null when unknown. */
    currentZ: number | null;
    /** mcpSafeTraverseZ (default 328). */
    traverseZ: number;
    /**
     * Whether the connected machine has a Z axis (machineCapability.ts).
     * Omitted = true. On a Z-less machine (the Ray) there is no "safe
     * height" for the head to already be at, so nothing justifies skipping
     * the operator's click: every transport stages, and the reason says so.
     */
    hasZ?: boolean;
    /**
     * Whether the operator has confirmed the connected machine's landmarks
     * on a staged review page (landmarkReview.ts, WP5). Omitted = asked of
     * the registered provider (landmarkReviewState.ts registers it with the
     * landmark tools), so existing callers need no edit; no provider at all
     * reads as NOT confirmed. Not confirmed never refuses a move - it only
     * stages it, with the review question in the reason.
     */
    landmarksConfirmed?: boolean;
}

/** What the landmark review says now: whether it is confirmed, and the question to put to the operator if not. */
export interface LandmarkReviewGate {
    confirmed: boolean;
    status: string;
    question: string | null;
}

let landmarkReviewProvider: (() => LandmarkReviewGate) | null = null;

/** Registered once by landmarkReviewState.ts; null unregisters (tests). */
export function setLandmarkReviewProvider(provider: (() => LandmarkReviewGate) | null): void {
    landmarkReviewProvider = provider;
}

function landmarkGate(input: SafeZPolicyInput): LandmarkReviewGate {
    if (input.landmarksConfirmed !== undefined) {
        return { confirmed: input.landmarksConfirmed, status: input.landmarksConfirmed ? 'confirmed' : 'unconfirmed', question: null };
    }
    if (!landmarkReviewProvider) {
        return { confirmed: false, status: 'unknown', question: 'the landmark review is not available in this build' };
    }
    try {
        return landmarkReviewProvider();
    } catch (err) {
        return { confirmed: false, status: 'unknown', question: `the landmark review could not be read (${(err as Error).message})` };
    }
}

/**
 * The connected machine's landmark review as the policy sees it, for readers
 * that cannot import landmarkReviewState.ts (tools/machine.ts: it imports
 * tools/machine.ts itself). 'unknown' when no provider is registered.
 */
export function currentLandmarkReviewGate(): LandmarkReviewGate {
    return landmarkGate({} as SafeZPolicyInput);
}

export type SafeZDecision =
    | { allowed: true; policy: string; reason: string }
    | { allowed: false; reason: string };

const f3 = (n: number) => n.toFixed(3);

/**
 * Verified means the record rests on the machine's own report: a controller
 * echo of the last commanded move, or a coherent heartbeat with its own
 * offset. A cached offset, a rejected beat (awaiting-resync) or a stale
 * report never qualifies - those stage a page exactly as before.
 */
export function verifiedForPolicy(reliability: Reliability): boolean {
    return reliability === 'verified' || reliability === 'heartbeat';
}

function commonRefusal(input: SafeZPolicyInput): string | null {
    if (input.hasZ === false) {
        return 'this machine has no Z axis, so there is no safe traverse height to justify skipping approval - staged for '
            + 'the operator\'s click (the top-Z policy is about a head already parked at the top of a Z axis)';
    }
    if (!input.enabled) {
        // The old config key name meant nothing to the operator (WP9): say
        // which toggle holds it off and where it lives.
        return input.gatedBy
            ? `${input.gatedBy} - staged for the operator's click as usual`
            : `moving at safe top Z without approval is off (${MOTION_RULES_WHERE}) - staged for the operator's click as usual`;
    }
    if (!verifiedForPolicy(input.reliability)) {
        return `the position of record is ${input.reliability}, not verified/heartbeat - staged for the operator's click`;
    }
    if (input.homed !== true) {
        return 'the machine does not report homed - staged for the operator\'s click';
    }
    if (input.currentZ === null || !Number.isFinite(input.currentZ)) {
        return 'machine Z is unknown - staged for the operator\'s click';
    }
    // Last, so a move refused for a reason above keeps that reason. Every
    // landmark is still enforced on the route; this only adds the click.
    const gate = landmarkGate(input);
    if (!gate.confirmed) {
        return `the operator has not confirmed this machine's landmarks (landmark_review ${gate.status}) - staged for the operator's `
            + 'click: approving it approves this one move with the landmarks listed on its page (Landmarks row); it does not '
            + `confirm the review${gate.question ? `. Review: ${gate.question}` : ''}. `
            + 'confirm_landmarks stages the review page; once the operator approves it, top-Z transport runs on the call again';
    }
    return null;
}

/**
 * XY-only transport may run on the call when the head is ALREADY at or above
 * the traverse height (within the heartbeat's float noise) on a verified,
 * homed position and the setting is on. The route itself must already have
 * passed planTraverseXy at the current Z - a landmark above the head refuses
 * there, before this is consulted. Being above the motion floor but below the
 * traverse height is NOT enough: that stays a staged job.
 */
export function decideSafeZTraverse(input: SafeZPolicyInput): SafeZDecision {
    const refusal = commonRefusal(input);
    if (refusal) {
        return { allowed: false, reason: refusal };
    }
    const z = input.currentZ as number;
    if (z < input.traverseZ - TRAVERSE_Z_TOLERANCE_MM) {
        return {
            allowed: false,
            reason: `machine Z ${f3(z)} is below the traverse height ${input.traverseZ} - staged for the operator's click `
                + '(the approval-free path needs the head already at the top; move_z up first, or approve the page)',
        };
    }
    return {
        allowed: true,
        policy: SAFE_Z_TRAVERSE_POLICY,
        reason: `XY-only at machine Z ${f3(z)} >= traverse height ${input.traverseZ}, position ${input.reliability}, homed, `
            + 'route landmark- and travel-checked; mcpTraverseWithoutApprovalAtSafeZ is on',
    };
}

/**
 * The optional half of #241: a Z-only move that can only go UP, to no higher
 * than the traverse height, is the "retreat first" half of law 2 and the one
 * Z move that cannot descend (raiseToTop's reasoning). Every target must be
 * at or above the previous one (the current Z first) and at or below the
 * traverse height. A series that dips anywhere, or overshoots the top, stages.
 */
export function decideSafeZRaise(input: SafeZPolicyInput & { machineTargets: number[] }): SafeZDecision {
    const refusal = commonRefusal(input);
    if (refusal) {
        return { allowed: false, reason: refusal };
    }
    if (!input.machineTargets.length) {
        return { allowed: false, reason: 'no targets' };
    }
    let previous = input.currentZ as number;
    for (let i = 0; i < input.machineTargets.length; i++) {
        const target = input.machineTargets[i];
        if (!Number.isFinite(target)) {
            return { allowed: false, reason: `target ${i + 1} is not finite` };
        }
        if (target < previous - TRAVERSE_Z_TOLERANCE_MM) {
            return {
                allowed: false,
                reason: `step ${i + 1} descends (machine Z ${f3(previous)} -> ${f3(target)}) - only an UP-only move to the traverse `
                    + 'height runs without approval; staged for the operator\'s click',
            };
        }
        if (target > input.traverseZ + TRAVERSE_Z_TOLERANCE_MM) {
            return {
                allowed: false,
                reason: `step ${i + 1} (machine Z ${f3(target)}) is above the traverse height ${input.traverseZ} - staged for the operator's click`,
            };
        }
        previous = target;
    }
    if (previous <= (input.currentZ as number) + TRAVERSE_Z_TOLERANCE_MM) {
        return { allowed: false, reason: `no net rise (machine Z ${f3(input.currentZ as number)} -> ${f3(previous)}) - staged for the operator's click` };
    }
    return {
        allowed: true,
        policy: SAFE_Z_RAISE_POLICY,
        reason: `Z-only, UP-only: machine Z ${f3(input.currentZ as number)} -> ${f3(previous)} <= traverse height ${input.traverseZ}, `
            + `position ${input.reliability}, homed; mcpTraverseWithoutApprovalAtSafeZ is on`,
    };
}
