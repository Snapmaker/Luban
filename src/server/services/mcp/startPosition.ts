// The head-position re-check at the start of a direct job and before each
// later step of a batch (tyeth/Luban#323; multi-machine overhaul #265).
//
// On a relative-steps machine (the Ray, the Original, the J1) a staged direct
// move is an INCREMENT from where the head was at staging: `G91` /
// `G1 X180 Y-350` / `G90`. If the head moves between staging and start - a UI
// jog, a home, a restart, Luban's switch to Control Mode (which homes the Ray,
// #321) - the approved increment lands somewhere other than the destination
// the operator approved. Live 2026-10-19 the Ray restarted (unhomed, 0,0)
// while two relative jobs planned from X1 Y399 were still startable.
//
// So the job records the judged machine position at staging, and every start
// compares the position now with where this step was planned from:
// - step 1 (or a single move): the position recorded at staging;
// - step N of a batch: step N-1's planned endpoint, the absolute machine
//   position its `; mcp-settle machine X.. Y.. [Z..]` line names
//   (gcodeForms.relativeStep). That is what step N's increment was computed
//   from, so an external move between steps refuses there too.
// A difference over POSITION_EPSILON_MM, an unhomed machine or a position
// that is not reliable for motion refuses BEFORE the approval is used.
//
// The A350 (sm2) is not checked: its steps are absolute G53 moves whose
// destination does not depend on the start, and its position reads
// awaiting-resync for a beat or two after a G53 move, which would turn a
// harmless check into new refusals between steps. Its position is still
// recorded on the job.
//
// Pure: no server imports, unit-tested in tests/startPosition.test.ts.
import { POSITION_EPSILON_MM } from './envelopeChecks';
import { parseSettleComment } from './gcodeForms';
import { Reliability, reliableForMotion } from './machinePosition';

/** The judged machine position recorded when a direct job was staged. */
export interface StagedPosition {
    x: number | null;
    y: number | null;
    z: number | null;
}

/** The lead every refusal here carries (#323). */
export const HEAD_MOVED = 'the head moved since staging - withdraw and restage';

export interface ExpectedStart {
    /** Where this step was planned from; null when that is unknown (the check then refuses). */
    at: StagedPosition | null;
    /** Which record `at` comes from, for the refusal and the job event. */
    basis: string;
}

/**
 * Where step `stepIndex` (0-based) of `job` was planned from: the staging
 * position for the first step, else the previous step's settle line. Null
 * `at` when the staging position was unreadable or the previous step names no
 * endpoint.
 */
export function expectedStepStart(
    job: { steps?: string[]; stagedAtMachine?: StagedPosition | null },
    stepIndex: number
): ExpectedStart {
    const staged = job.stagedAtMachine || null;
    if (stepIndex <= 0 || !Array.isArray(job.steps) || job.steps.length === 0) {
        return { at: staged, basis: staged ? 'the judged machine position recorded at staging' : 'no machine position was readable at staging' };
    }
    const previous = parseSettleComment(job.steps[stepIndex - 1] || '');
    if (!previous) {
        return { at: null, basis: `step ${stepIndex} names no planned endpoint (no "; mcp-settle machine" line)` };
    }
    // A step without Z in its settle line left Z where it was planned: carry
    // it forward from the steps before it, back to the staging Z.
    let z: number | null = previous.z === undefined ? null : previous.z;
    for (let i = stepIndex - 2; z === null && i >= 0; i--) {
        const earlier = parseSettleComment(job.steps[i] || '');
        if (earlier && earlier.z !== undefined) {
            z = earlier.z;
        }
    }
    if (z === null && staged) {
        z = staged.z;
    }
    return { at: { x: previous.x, y: previous.y, z }, basis: `step ${stepIndex}'s planned endpoint (its settle line)` };
}

export interface StartPositionInput {
    expected: ExpectedStart;
    /** The judged machine position now (get_position.machine). */
    current: StagedPosition;
    reliability: Reliability;
    isHomed: boolean | null;
    /** Whether the machine has a Z axis; Z is compared only where it does and the plan names one. */
    hasZ: boolean;
}

const f3 = (n: number | null) => (n === null ? '?' : n.toFixed(3));

/**
 * The refusal reason when this step must not start, else null. Every reason
 * leads with HEAD_MOVED; the caller adds what it left untouched and the machine.
 */
export function startPositionRefusal(input: StartPositionInput): string | null {
    const { expected, current } = input;
    if (input.isHomed !== true) {
        return `${HEAD_MOVED}: the machine does not report homed (isHomed ${String(input.isHomed)}), so its position is not the one `
            + 'this job was planned from.';
    }
    if (!reliableForMotion(input.reliability)) {
        return `${HEAD_MOVED}: the machine position is ${input.reliability}, not verified/heartbeat/cached-offset, so it cannot be `
            + 'checked against where this job was planned from.';
    }
    if (!expected.at) {
        return `${HEAD_MOVED}: where this step was planned from is unknown (${expected.basis}).`;
    }
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y'];
    if (input.hasZ && expected.at.z !== null) {
        axes.push('z');
    }
    const off: string[] = [];
    for (const axis of axes) {
        const want = expected.at[axis];
        const now = current[axis];
        if (want === null || now === null || !Number.isFinite(want) || !Number.isFinite(now)) {
            off.push(`${axis.toUpperCase()} unknown (planned ${f3(want)}, now ${f3(now)})`);
        } else if (Math.abs(now - want) > POSITION_EPSILON_MM) {
            off.push(`${axis.toUpperCase()} planned ${f3(want)}, now ${f3(now)} (${(now - want).toFixed(3)} mm)`);
        }
    }
    if (!off.length) {
        return null;
    }
    return `${HEAD_MOVED}: the machine position differs from ${expected.basis} by more than ${POSITION_EPSILON_MM} mm - `
        + `${off.join('; ')}. A relative step sent now would land that far from the destination the operator approved.`;
}
