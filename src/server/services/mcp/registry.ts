/* eslint-disable camelcase */
import { isReadOnlyTool, manualControlGate } from './manualControl';
import {
    ModalLedger,
    RecoveryDeps,
    RecoveryEvidence,
    classifyFailure,
    closeLedger,
    describeEvidence,
    evidenceIsRelevant,
    exposureAfterSuccess,
    hookFailureEvidence,
    recoverAfterFailure,
    runWithLedger,
} from './failureRecovery';
// MCP tool results are snake_case by convention (confirm_url).
/**
 * MCP tool registry.
 *
 * Tools are registered at service start and exposed over the MCP endpoint
 * via tools/list and tools/call. Handlers receive already-parsed arguments
 * and return a JSON-serializable result; throw McpToolError for failures
 * that should surface as a tool error rather than a protocol error.
 */

export class McpToolError extends Error {
}

/**
 * The confirm-page hand-off, stated once and stamped on every staging result
 * (operator law, 2026-09-21). A staged job is worth nothing until the operator
 * has its link, and an agent that blocks on start_gcode_job before handing the
 * link over leaves them staring at a spinner: on 2026-09-21 a move_z was staged,
 * the agent waited 50 s for a click the operator could not give, withdrew the job
 * and drew a conclusion instead. So: the link goes out FIRST, as the last line of
 * the reply, and the turn ENDS. Waiting for the approval happens afterwards, in a
 * background poll or with the code the operator pastes - never before the link.
 */
export const CONFIRM_HANDOFF = {
    rule: 'STAGED - NOT RUNNING. Do this now, in this order, and nothing else: (1) reply to the operator with one sentence '
        + 'saying what they are approving and the confirm_url as the LAST line of the reply, alone; (2) END THE TURN. '
        + 'Do NOT call start_gcode_job with wait_for_approval_ms before the link has been delivered - the operator cannot '
        + 'click a link they have not seen, the wait times out, and the job is left dangling. After the link is out, wait '
        + 'for the approval in a BACKGROUND poll (start_gcode_job wait_for_approval_ms, or get_gcode_job_status wait_ms on '
        + 'the job) or accept the one-time code they paste (start_gcode_job confirm_token). Withdrawing a staged job is '
        + 'the operator\'s decision or a correction they asked for, never a reaction to a wait that timed out.',
    reply_shape: '<one sentence: what the approval runs, in machine coordinates>\n\n<confirm_url>',
};

/** Stamp the hand-off contract on a staging result. Exported for the tools that build their results by hand. */
export function withConfirmHandoff<T extends { confirm_url?: unknown }>(result: T): T & { handoff?: typeof CONFIRM_HANDOFF } {
    if (result && typeof result === 'object' && typeof (result as { confirm_url?: unknown }).confirm_url === 'string') {
        return { ...result, handoff: CONFIRM_HANDOFF };
    }
    return result;
}

export interface McpToolDefinition {
    name: string;
    description: string;

    // JSON Schema for the tool arguments
    inputSchema: object;

    // Method syntax on purpose: each tool narrows args to its own schema's
    // shape, which a function-typed property would reject under
    // strictFunctionTypes. Arguments are validated against inputSchema.
    handler(args: object): Promise<object>;
}

export class ToolRegistry {
    private tools = new Map<string, McpToolDefinition>();

    public register(tool: McpToolDefinition): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`MCP tool already registered: ${tool.name}`);
        }
        this.tools.set(tool.name, tool);
    }

    public list(): object[] {
        return [...this.tools.values()].map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }));
    }

    public has(name: string): boolean {
        return this.tools.has(name);
    }

    // Injected by the camera tools (they own the direct send path); without it
    // failures are reported exactly as before, with no cleanup.
    private recoveryDeps: RecoveryDeps | null = null;

    public setFailureRecovery(deps: RecoveryDeps | null): void {
        this.recoveryDeps = deps;
    }

    /** The injected cleanup runtime, for jobs that end outside a tool call (file jobs, detached runners). */
    public getFailureRecovery(): RecoveryDeps | null {
        return this.recoveryDeps;
    }

    public async call(name: string, args: object): Promise<object> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new McpToolError(`Unknown tool: ${name}`);
        }
        const leave = manualControlGate.enterTool(name);
        // Every direct send made while the handler runs lands on this ledger
        // (failureRecovery.ts), so a FAILED call can be checked for a G53/G91
        // it left behind (#221). Successful calls are not touched.
        const deps = this.recoveryDeps;
        let startConnection: string | null = null;
        try {
            startConnection = deps ? deps.connectionId() : null;
        } catch (err) {
            startConnection = null;
        }
        // stop_gcode_job is never a mutation here: it must not be followed by cleanup.
        const ledger = new ModalLedger(name, !isReadOnlyTool(name) && name !== 'stop_gcode_job', startConnection);
        let result: object | undefined;
        let threw = false;
        let thrown: unknown;
        let evidence: RecoveryEvidence | null = null;
        try {
            try {
                result = await runWithLedger(ledger, async () => tool.handler(args || {}));
            } catch (err) {
                threw = true;
                thrown = err;
            }
            closeLedger(ledger);
            let kind: ReturnType<typeof classifyFailure> = null;
            try {
                kind = classifyFailure(threw, thrown, result);
            } catch (err) {
                // An unreadable error is still a failure; its evidence is best effort.
                kind = threw ? 'thrown' : null;
            }
            if (kind && deps && ledger.mutating) {
                // Runs while this call still holds the ownership gate, and
                // never throws: the original failure is what gets reported.
                const failed = kind;
                evidence = await recoverAfterFailure(ledger, failed, deps).catch((err) => hookFailureEvidence(ledger, failed, err));
            } else if (!kind && deps) {
                // Success: never followed by commands, but a G53/G91 it left is reported
                // (not a payload still pending for a detached runner, nor under a running job).
                try {
                    evidence = exposureAfterSuccess(ledger, deps);
                } catch (err) {
                    evidence = null;
                }
            }
        } finally {
            closeLedger(ledger);
            leave();
        }
        if (threw) {
            if (evidenceIsRelevant(evidence) && thrown instanceof Error) {
                // McpServer serialises only err.message: the original message
                // stays first and unchanged, the evidence follows it. The same
                // error object is rethrown, so its class and .partial survive.
                // An error whose message cannot be rewritten (frozen, getter)
                // is rethrown untouched rather than replaced.
                const original = thrown.message;
                try {
                    thrown.message = `${original}
${describeEvidence(evidence)}`;
                    (thrown as Error & { failureRecovery?: RecoveryEvidence }).failureRecovery = evidence;
                } catch (err) {
                    try {
                        thrown.message = original;
                    } catch (restoreErr) {
                        // Nothing more to do: the original error goes out as it is.
                    }
                }
            }
            throw thrown;
        }
        if (evidenceIsRelevant(evidence)) {
            result = { ...(result as object), failure_recovery: evidence };
        }
        // Every result that carries a confirm_url is a staged job: say how the
        // link is to be handed over, every time, from one place.
        return withConfirmHandoff(result as { confirm_url?: unknown });
    }
}
