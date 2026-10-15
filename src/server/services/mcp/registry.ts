/* eslint-disable camelcase */
import { manualControlGate } from './manualControl';
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

    public async call(name: string, args: object): Promise<object> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new McpToolError(`Unknown tool: ${name}`);
        }
        const leave = manualControlGate.enterTool(name);
        let result: object;
        try {
            result = await tool.handler(args || {});
        } finally {
            leave();
        }
        // Every result that carries a confirm_url is a staged job: say how the
        // link is to be handed over, every time, from one place.
        return withConfirmHandoff(result as { confirm_url?: unknown });
    }
}
