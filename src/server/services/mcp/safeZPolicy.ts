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

export interface SafeZPolicyInput {
    /** mcpTraverseWithoutApprovalAtSafeZ (Settings -> MCP Server -> Job approval). */
    enabled: boolean;
    /** The judged reliability of the position of record (get_position). */
    reliability: Reliability;
    homed: boolean | null;
    /** Machine Z of record; null when unknown. */
    currentZ: number | null;
    /** mcpSafeTraverseZ (default 328). */
    traverseZ: number;
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
    if (!input.enabled) {
        return 'mcpTraverseWithoutApprovalAtSafeZ is off - staged for the operator\'s click as usual';
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
