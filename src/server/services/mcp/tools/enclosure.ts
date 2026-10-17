import { connectionManager } from '../../machine/ConnectionManager';
import { EnclosureStatus, normaliseEnclosureStatus, parseEnclosureLevel } from '../enclosure';
import { McpToolError, ToolRegistry } from '../registry';

/**
 * Enclosure tools (#142): the LED strip and exhaust fan of the Snapmaker
 * enclosure as first-class calls. No motion, so no confirm page; the calls
 * go through ConnectionManager to the same channel methods the Workspace
 * enclosure widget uses (SSTP /api/v1/enclosure, SACP EnclosureInfo, the
 * serial M1010), never an M-code typed by the agent. Refused when the
 * machine reports no enclosure.
 */

async function readEnclosureStatus(): Promise<EnclosureStatus> {
    const connection = connectionManager.getConnectionStatus();
    if (!connection.connected) {
        throw new McpToolError('Not connected to a machine; the enclosure cannot be read.');
    }
    const report = await connectionManager.readEnclosureReport();
    if (!report) {
        throw new McpToolError(`The ${connection.channelName || 'current'} channel does not report an enclosure.`);
    }
    return normaliseEnclosureStatus(report);
}

function requirePresent(status: EnclosureStatus, verb: string): void {
    if (!status.present) {
        throw new McpToolError(`Refused to ${verb}: the machine reports no enclosure. ${status.reason}`.trim());
    }
}

const LEVEL_SCHEMA = {
    percent: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: '0-100. The Snapmaker 2.0 enclosure drives its LED strip and fan at 0 or 100 (what Luban\'s widget sends); other values pass through unchanged.',
    },
    state: {
        type: 'string',
        enum: ['on', 'off'],
        description: 'Shorthand for percent 100 / 0. Give state or percent, not both.',
    },
};

async function applyLevel(part: 'light' | 'fan', args: { percent?: unknown; state?: unknown }): Promise<object> {
    const what = part === 'light' ? 'enclosure light' : 'enclosure fan';
    let requested: number;
    try {
        requested = parseEnclosureLevel(args, what);
    } catch (err) {
        throw new McpToolError((err as Error).message);
    }
    const before = await readEnclosureStatus();
    requirePresent(before, `set the ${what}`);
    const outcome = await connectionManager.setEnclosureLevel(part, requested);
    if (!outcome.ok) {
        throw new McpToolError(`The controller did not accept the ${what} request: ${outcome.detail}`);
    }
    // The SSTP report refreshes on the controller's own schedule (Luban polls
    // it every second), so the readback may still show the old level.
    const after = await readEnclosureStatus();
    const reported = part === 'light' ? after.light_percent : after.fan_percent;
    return {
        part,
        requested_percent: requested,
        accepted: true,
        detail: outcome.detail,
        reported_percent: reported,
        readback_matches: reported === null ? null : reported === requested,
        before,
        after,
        note: 'No motion. The enclosure was read before and after the request; a readback that still shows the old level '
            + 'usually catches up on the next report - call get_enclosure_status again rather than resending.',
    };
}

export function registerEnclosureTools(registry: ToolRegistry): void {
    registry.register({
        name: 'get_enclosure_status',
        description: 'Report the Snapmaker enclosure: present (the machine reports the module online), light and fan '
            + 'levels in percent, the door-detection switch and (serial only) whether the door is open. Read-only, no '
            + 'motion, nothing sent beyond the same enclosure query Luban already polls. `present: false` means the '
            + 'set_enclosure_* tools will refuse.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => readEnclosureStatus(),
    });

    registry.register({
        name: 'set_enclosure_light',
        description: 'Turn the enclosure LED strip on/off or set its level (percent 0-100 or state on/off). No motion, '
            + 'no confirm page: runs on the call through the same channel call as the Workspace enclosure widget (never '
            + 'a hand-typed M-code). Refused when not connected or when the machine reports no enclosure. Returns the '
            + 'status before and after.',
        inputSchema: { type: 'object', properties: LEVEL_SCHEMA, additionalProperties: false },
        handler: async (args: { percent?: number; state?: string }) => applyLevel('light', args),
    });

    registry.register({
        name: 'set_enclosure_fan',
        description: 'Turn the enclosure exhaust fan on/off or set its level (percent 0-100 or state on/off). No '
            + 'motion, no confirm page: runs on the call through the same channel call as the Workspace enclosure '
            + 'widget (never a hand-typed M-code). Refused when not connected or when the machine reports no enclosure. '
            + 'Returns the status before and after.',
        inputSchema: { type: 'object', properties: LEVEL_SCHEMA, additionalProperties: false },
        handler: async (args: { percent?: number; state?: string }) => applyLevel('fan', args),
    });
}
