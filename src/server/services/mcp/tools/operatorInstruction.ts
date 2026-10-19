/* eslint-disable camelcase */
// Result keys are snake_case: they are serialised straight into tool results.
//
// "Allow moves without an approval page" (tyeth/Luban#326): an operator-only,
// per-machine setting, default off (motionRules.ts). With it on, a direct move
// a motion tool has just staged runs on the call instead of waiting for the
// confirm page - ONLY when the agent quotes the operator's explicit instruction
// from the current session (`operator_instruction`). This is the "operator
// confirmed in session, by the agent" mode: there is still no motion without
// an explicit operator instruction.
//
// Every other gate still applies. The staging tool has already made its own
// checks (idle, homed, toolhead off, travel, landmarks) before this runs; the
// job then goes through approveByPolicy + runPolicyApprovedDirectJob, the path
// the top-Z policy uses, so the motor-power gate (#321), the start position
// re-check (#323), the machine binding and the token all apply exactly as for
// an approved job. The instruction is recorded on the job (an
// `operator_instruction` event and the approval reason) and in the result.
import { McpJob, jobManager } from '../jobs';
import { reliableForMotion } from '../machinePosition';
import { MOVES_WITHOUT_APPROVAL_TOGGLE, operatorInstructionOf } from '../motionRules';
import { machineStore } from '../machineStore';
import { runPolicyApprovedDirectJob } from './gcode';
import { approvalFreeSettingsFor, getPositionSnapshot } from './machine';

/** The policy name an on-the-call move is approved under (job.approval.policy, the dashboard). */
export const OPERATOR_INSTRUCTION_POLICY = 'operator-instruction';

/** The argument every motion tool that honours the setting takes. */
export const OPERATOR_INSTRUCTION_ARG = {
    type: 'string',
    description: 'Only with the operator-only setting "Allow moves without an approval page" on for this machine: quote the '
        + 'operator\'s explicit instruction for THIS move from the current session, word for word. The move then runs on the call '
        + '(every other gate still applies) and the quote is recorded on the job and the result. Never invent or paraphrase one; '
        + 'without it, or with the setting off, the move stages a confirm page as usual.',
};

export interface OperatorInstructionOutcome {
    /** True when the move ran on the call; `result` then holds the fields to merge into the tool's result. */
    ran: boolean;
    result: { [key: string]: unknown } | null;
    /** Why it staged instead, when an instruction was given or the setting is on; null otherwise. */
    staged_because: string | null;
}

/**
 * Run `job` (a direct job the caller has just staged) on the call when the
 * setting is on for the connected machine and `args.operator_instruction`
 * quotes the operator; otherwise leave it staged and say why. Each step is
 * awaited (the start re-check between steps needs the previous endpoint).
 */
export async function runDirectOnOperatorInstruction(job: McpJob, args: { operator_instruction?: unknown }): Promise<OperatorInstructionOutcome> {
    const instruction = operatorInstructionOf(args.operator_instruction);
    const setting = approvalFreeSettingsFor(machineStore.currentMachine().machineKey).moves;
    if (!setting.on) {
        return {
            ran: false,
            result: null,
            staged_because: instruction
                ? `operator_instruction was given, but '${MOVES_WITHOUT_APPROVAL_TOGGLE}' is off for this machine - only the operator `
                    + 'turns it on, in Luban\'s Settings > MCP > Motion rules; the move is staged for their click'
                : null,
        };
    }
    if (!instruction) {
        return {
            ran: false,
            result: null,
            staged_because: `'${MOVES_WITHOUT_APPROVAL_TOGGLE}' is on, but no operator_instruction was given: the move is staged for the `
                + 'operator\'s click (quote their explicit instruction from this session to run it on the call)',
        };
    }
    const position = getPositionSnapshot();
    if (position.isHomed !== true || !reliableForMotion(position.reliability)) {
        return {
            ran: false,
            result: null,
            staged_because: `'${MOVES_WITHOUT_APPROVAL_TOGGLE}' needs a homed, verified/heartbeat/cached-offset position; this one is `
                + `${position.isHomed === true ? 'homed' : 'not homed'}, ${position.reliability} - staged for the operator's click`,
        };
    }
    const reason = `'${MOVES_WITHOUT_APPROVAL_TOGGLE}' is on for this machine and the agent quoted the operator's instruction from this `
        + `session: "${instruction}"`;
    const token = jobManager.approveByPolicy(job, OPERATOR_INSTRUCTION_POLICY, reason);
    jobManager.appendEvent(job, 'operator_instruction', { note: reason, operator_instruction: instruction, setting: MOVES_WITHOUT_APPROVAL_TOGGLE });
    const run = await runPolicyApprovedDirectJob(job, token, true);
    return {
        ran: true,
        staged_because: null,
        result: {
            job: jobManager.describe(job),
            executed_without_approval: true,
            approval: { source: 'policy', policy: OPERATOR_INSTRUCTION_POLICY, reason },
            approval_free_setting: MOVES_WITHOUT_APPROVAL_TOGGLE,
            operator_instruction: instruction,
            steps_executed: run.stepsExecuted,
            position: run.settle.position,
            position_verified: run.settle.verified,
            warning: run.settle.warning,
            note: `Executed on the call under '${MOVES_WITHOUT_APPROVAL_TOGGLE}' (no confirm page), on the operator's instruction as `
                + 'quoted; the job is on the dashboard with that quote. Every other gate applied. Only the operator turns the setting '
                + 'off, in Settings > MCP > Motion rules.',
        },
    };
}
