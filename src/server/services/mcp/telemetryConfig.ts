// Spindle telemetry settings and the job-record limits they move, resolved
// env-first from (environment, configstore getter) so the rule is testable
// without the server.
//
// Everything here is opt-in and changes nothing about motion, safety,
// approval or streaming: it only decides what gets RECORDED about a file
// job (status RPM samples, a microphone track) and how much of it is kept.
//
// Pure: no server imports, unit-tested in tests/telemetryConfig.test.ts.

// A surface scan produces ~4 gcode events per 0.1 mm step; the old 400 cap
// lost the first three stations of job 1db4902a4cd6 (2026-09-05) before
// anyone could read them. Long jobs need more, so the cap is a setting:
// configstore mcpJobEventLimit (Settings -> MCP Server) or the environment
// LUBAN_MCP_JOB_EVENT_LIMIT. ~700 bytes per event. With spindle telemetry
// on, a job also carries its low-volume telemetry events (sag / blip /
// reach / chatter / runout / epoch summaries) and the default is raised
// 100x so a long ladder's record is never spliced; the dense time series
// themselves live in typed-array rings (telemetryRing.ts), never as events.
export const DEFAULT_JOB_EVENT_LIMIT = 2000;
export const TELEMETRY_JOB_EVENT_LIMIT = DEFAULT_JOB_EVENT_LIMIT * 100;
export const MIN_JOB_EVENT_LIMIT = 400;
export const MAX_JOB_EVENT_LIMIT = 1000000;

// Samples kept per telemetry stream per job (status reports; audio frames).
// 16 bytes per status sample, 13 per audio frame: the default holds an
// 8-hour job at 20 audio frames/s before the ring halves its rate.
export const DEFAULT_TELEMETRY_SAMPLE_LIMIT = 1000000;
export const MIN_TELEMETRY_SAMPLE_LIMIT = 10000;
export const MAX_TELEMETRY_SAMPLE_LIMIT = 4000000;

// Optional faster status poll during file jobs only (0 = off: the 2 s
// heartbeat is sampled instead). Measured 2026-09-29 on the A350 over
// Wi-Fi: one /api/v1/status round trip is ~25 ms and ~360 bytes idle.
export const MIN_STATUS_POLL_MS = 200;
export const MAX_STATUS_POLL_MS = 2000;

export const TELEMETRY_KEYS = {
    enabled: { env: 'LUBAN_MCP_SPINDLE_TELEMETRY', key: 'mcpSpindleTelemetry' },
    statusPollMs: { env: 'LUBAN_MCP_SPINDLE_STATUS_POLL_MS', key: 'mcpSpindleStatusPollMs' },
    audio: { env: 'LUBAN_MCP_SPINDLE_AUDIO', key: 'mcpSpindleAudio' },
    audioDevice: { env: 'LUBAN_MCP_AUDIO_DEVICE', key: 'mcpAudioDevice' },
    sampleLimit: { env: 'LUBAN_MCP_TELEMETRY_SAMPLE_LIMIT', key: 'mcpTelemetrySampleLimit' },
    jobEventLimit: { env: 'LUBAN_MCP_JOB_EVENT_LIMIT', key: 'mcpJobEventLimit' },
    plannerLeadBlocks: { env: 'LUBAN_MCP_SPINDLE_PLANNER_LEAD', key: 'mcpSpindlePlannerLeadBlocks' },
};

// The controller reports the end of the last QUEUED move, not the head:
// the planner keeps this many moves ahead (Marlin BLOCK_BUFFER_SIZE, 16 on
// the A350 as measured 2026-09-29). executionModel.ts bounds its estimate
// of the executing line by it.
export const DEFAULT_PLANNER_LEAD_BLOCKS = 16;
export const MIN_PLANNER_LEAD_BLOCKS = 1;
export const MAX_PLANNER_LEAD_BLOCKS = 64;

export type SettingSource = 'env' | 'config' | 'default';

export interface TelemetryConfig {
    /** Record status-report RPM during file jobs. */
    enabled: boolean;
    /** Extra status polls during file jobs, ms between polls; 0 = heartbeat only. */
    statusPollMs: number;
    /** Record and analyse a microphone during file jobs (needs `enabled`). */
    audioEnabled: boolean;
    /** The operator's stored capture source (audioSelection.ts entry or alias); null = none chosen. */
    audioDevice: string | null;
    sampleLimit: number;
    jobEventLimit: number;
    /** Planner look-ahead in motion blocks (the reported position leads the head by this much). */
    plannerLeadBlocks: number;
    sources: { [field in 'enabled' | 'statusPollMs' | 'audioEnabled' | 'audioDevice' | 'sampleLimit' | 'jobEventLimit' | 'plannerLeadBlocks']: SettingSource };
}

type Env = { [name: string]: string | undefined };
type Getter = (key: string) => unknown;

function present(value: unknown): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function pick(env: Env, get: Getter, field: keyof typeof TELEMETRY_KEYS): { raw: unknown; source: SettingSource } {
    const { env: envName, key } = TELEMETRY_KEYS[field];
    if (present(env[envName])) {
        return { raw: env[envName], source: 'env' };
    }
    const stored = get(key);
    if (present(stored)) {
        return { raw: stored, source: 'config' };
    }
    return { raw: undefined, source: 'default' };
}

export function parseFlag(raw: unknown): boolean {
    if (typeof raw === 'boolean') {
        return raw;
    }
    const text = String(raw ?? '').trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'on' || text === 'yes';
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.min(Math.max(Math.round(value), min), max);
}

/** The job event cap for a raw stored/env value; the default depends on whether telemetry is on. */
export function resolveJobEventLimit(raw: unknown, telemetryEnabled: boolean): number {
    const fallback = telemetryEnabled ? TELEMETRY_JOB_EVENT_LIMIT : DEFAULT_JOB_EVENT_LIMIT;
    return clampInt(raw, MIN_JOB_EVENT_LIMIT, MAX_JOB_EVENT_LIMIT, fallback);
}

export function resolveTelemetryConfig(env: Env, get: Getter): TelemetryConfig {
    const enabled = pick(env, get, 'enabled');
    const poll = pick(env, get, 'statusPollMs');
    const audio = pick(env, get, 'audio');
    const device = pick(env, get, 'audioDevice');
    const samples = pick(env, get, 'sampleLimit');
    const events = pick(env, get, 'jobEventLimit');
    const lead = pick(env, get, 'plannerLeadBlocks');
    const isEnabled = parseFlag(enabled.raw);
    const pollValue = Number(poll.raw);
    return {
        enabled: isEnabled,
        statusPollMs: Number.isFinite(pollValue) && pollValue > 0 ? Math.min(Math.max(Math.round(pollValue), MIN_STATUS_POLL_MS), MAX_STATUS_POLL_MS) : 0,
        audioEnabled: isEnabled && parseFlag(audio.raw),
        audioDevice: present(device.raw) ? String(device.raw).trim() : null,
        sampleLimit: clampInt(samples.raw, MIN_TELEMETRY_SAMPLE_LIMIT, MAX_TELEMETRY_SAMPLE_LIMIT, DEFAULT_TELEMETRY_SAMPLE_LIMIT),
        jobEventLimit: resolveJobEventLimit(events.raw, isEnabled),
        plannerLeadBlocks: clampInt(lead.raw, MIN_PLANNER_LEAD_BLOCKS, MAX_PLANNER_LEAD_BLOCKS, DEFAULT_PLANNER_LEAD_BLOCKS),
        sources: {
            enabled: enabled.source,
            statusPollMs: poll.source,
            audioEnabled: audio.source,
            audioDevice: device.source,
            sampleLimit: samples.source,
            jobEventLimit: events.source,
            plannerLeadBlocks: lead.source,
        },
    };
}
