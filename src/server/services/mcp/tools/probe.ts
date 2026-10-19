/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import { McpToolError, ToolRegistry } from '../registry';
import { probeFeedService, resolveActiveProbeConfig } from '../probeFeed';

// External probe sensors (tool height setter, CNC touch probe, overtravel
// switch) report over a sensor feed - MQTT (Adafruit IO) or direct GPIO
// (Blinka/U2IF), chosen by LUBAN_MCP_PROBE_TRANSPORT / mcpProbeTransport.
// These tools manage the feed connection; the sensors themselves are read by
// the measurement procedures that consume them.

export function registerProbeTools(registry: ToolRegistry): void {
    registry.register({
        name: 'get_probe_feed_status',
        description: 'State of the external probe sensor feed (transport mqtt or gpio): configuration, '
            + 'connection, the last reading per channel (toolsetter / overtravel / probe) with its age, '
            + 'and whether the overtravel alarm is latched. Read-only.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => probeFeedService.status(),
    });

    registry.register({
        name: 'connect_probe_feed',
        description: 'Connect (or reconnect) to the probe sensor feed using the current settings '
            + '(environment variables first, then the Settings -> MCP Server fields) over the '
            + 'configured transport - MQTT topics, or direct GPIO pins polled through a Blinka '
            + 'monitor subprocess. Binds the configured toolsetter/overtravel/probe channels and '
            + 'arms the overtravel tripwire (which latches only while a sensor-gated procedure or '
            + 'MCP motion is in progress). Idempotent.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const cfg = resolveActiveProbeConfig();
            if (!cfg.configured) {
                throw new McpToolError(`Probe feed (${cfg.kind} transport) is not configured: `
                    + `missing ${cfg.missing.join(', ')}. Ask the operator: ${cfg.settingsHint} `
                    + 'Then retry.');
            }
            try {
                await probeFeedService.connect();
            } catch (err) {
                throw new McpToolError(`Probe feed connection failed: ${(err as Error).message}`);
            }
            return probeFeedService.status();
        },
    });

    registry.register({
        name: 'disconnect_probe_feed',
        description: 'Disconnect from the probe sensor feed and stop reconnecting. NOTE: this '
            + 'disarms the overtravel tripwire - do not disconnect while any probing procedure '
            + 'could run. A latched overtravel alarm persists across disconnects.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            probeFeedService.disconnect();
            return probeFeedService.status();
        },
    });

    registry.register({
        name: 'clear_overtravel_alarm',
        description: 'Clear the latched safety alarm (overtravel OR crash - a contact sensor firing '
            + 'during motion that expected no contact) that is blocking all motion. ONLY on the '
            + 'operator\'s explicit word, after they have physically inspected the machine: pass '
            + 'operator_confirmed: true and repeat their words in reason. Refused while the tripped '
            + 'channel still reports triggered.',
        inputSchema: {
            type: 'object',
            properties: {
                operator_confirmed: {
                    type: 'boolean',
                    description: 'true ONLY when the human operator has explicitly said the machine '
                        + 'has been inspected and the alarm may be cleared. Never on the model\'s own judgment.',
                },
                reason: { type: 'string', description: 'The operator\'s words authorising the clear.' },
            },
            required: ['operator_confirmed', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { operator_confirmed?: boolean; reason?: string }) => {
            if (args.operator_confirmed !== true) {
                throw new McpToolError('Refusing: operator_confirmed must be true, and only on the '
                    + 'operator\'s explicit word after physical inspection.');
            }
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('Provide the operator\'s authorisation as reason.');
            }
            const trip = probeFeedService.getTrip();
            if (!trip) {
                return { cleared: false, note: 'No overtravel alarm is latched.' };
            }
            probeFeedService.clearTrip();
            return { cleared: true, previous_trip: trip };
        },
    });
}
