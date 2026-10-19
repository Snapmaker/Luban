/* eslint-disable camelcase */
// MCP tool arguments and results are snake_case by convention (job_id, since_ms).
import { listAudioSources } from '../audioDevices';
import { describeSourceChoice, matchAudioDevice } from '../audioSelection';
import { jobManager } from '../jobs';
import { McpToolError, ToolRegistry } from '../registry';
import { currentTelemetryConfig, spindleTelemetryService } from '../spindleTelemetry';

// Read-only access to spindle telemetry: the capture sources the operator
// can choose from (never chosen here) and a job's recorded series.
export function registerTelemetryTools(registry: ToolRegistry): void {
    registry.register({
        name: 'list_audio_devices',
        description: 'Every audio capture source on the Luban host (PipeWire/PulseAudio nodes, ALSA cards, DirectShow '
            + 'devices on Windows) with which one is configured for spindle audio telemetry (mcpAudioDevice / '
            + 'LUBAN_MCP_AUDIO_DEVICE) and whether it resolves. The choice is the OPERATOR\'s, made in Settings -> MCP '
            + 'Server or the configstore: a laptop\'s built-in microphone hears its fans, not the spindle, so nothing is '
            + 'ever picked automatically and there is no fallback. Read-only, no motion.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async () => {
            const cfg = currentTelemetryConfig();
            const listing = await listAudioSources();
            const match = cfg.audioDevice ? matchAudioDevice(cfg.audioDevice, listing.sources) : null;
            let resolution = 'no device configured';
            if (match) {
                resolution = match.ok ? `matched on ${match.matchedOn}` : match.reason;
            }
            return {
                sources: listing.sources.map((source) => ({
                    entry: source.entry,
                    backend: source.backend,
                    description: source.description,
                    aliases: source.aliases,
                    built_in: source.builtIn,
                    usb: source.usb,
                    selected: !!(match && match.ok && match.source.entry === source.entry),
                })),
                listing_commands: listing.backends,
                configured: cfg.audioDevice,
                configured_source: cfg.sources.audioDevice,
                resolves: match ? match.ok : false,
                resolution,
                telemetry: { enabled: cfg.enabled, audio_enabled: cfg.audioEnabled, status_poll_ms: cfg.statusPollMs },
                guidance: describeSourceChoice(listing.sources),
            };
        },
    });

    registry.register({
        name: 'get_job_telemetry',
        description: 'Spindle telemetry series of a file job (needs mcpSpindleTelemetry): the controller\'s reported RPM, '
            + 'target RPM, the line it was executing and the S that line commanded, per status report; with '
            + 'mcpSpindleAudio also the microphone-tracked RPM (20 frames/s), its confidence, the RPM relative to the '
            + 'unloaded baseline, the per-frame chatter index (dB, non-harmonic tones with the harmonics masked at that '
            + 'frame\'s RPM), the running runout index and the frame role - plus the per-commanded-S verdicts and the '
            + 'stored FLAC path. Series are downsampled to max_points with every bucket\'s min and max kept, so a blip '
            + 'survives. Times are ms since the job started. get_gcode_job_status carries the summary; this is the data. '
            + 'Read-only.',
        inputSchema: {
            type: 'object',
            properties: {
                job_id: { type: 'string' },
                since_ms: { type: 'number', description: 'Window start, ms since job start (default 0).' },
                until_ms: { type: 'number', description: 'Window end, ms since job start (default: everything).' },
                max_points: { type: 'number', description: 'Points per series after min/max downsampling (default 2000, max 20000).' },
            },
            required: ['job_id'],
            additionalProperties: false,
        },
        handler: async (args: { job_id?: string; since_ms?: number; until_ms?: number; max_points?: number }) => {
            const job = jobManager.get(String(args.job_id || ''));
            if (!job) {
                throw new McpToolError('Unknown job_id.');
            }
            const session = spindleTelemetryService.get(job.id);
            if (!session) {
                const cfg = currentTelemetryConfig();
                throw new McpToolError(cfg.enabled
                    ? `No telemetry was recorded for job ${job.id} (telemetry records file jobs from the moment they start; this job is ${job.kind}/${job.state}).`
                    : 'Spindle telemetry is off: enable mcpSpindleTelemetry (Settings -> MCP Server, or LUBAN_MCP_SPINDLE_TELEMETRY=1) before starting the job.');
            }
            return session.query(args);
        },
    });
}
