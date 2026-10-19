import { strict as assert } from 'assert';

import {
    DEFAULT_JOB_EVENT_LIMIT,
    DEFAULT_TELEMETRY_SAMPLE_LIMIT,
    MAX_JOB_EVENT_LIMIT,
    MAX_TELEMETRY_SAMPLE_LIMIT,
    MIN_JOB_EVENT_LIMIT,
    TELEMETRY_JOB_EVENT_LIMIT,
    resolveJobEventLimit,
    resolveTelemetryConfig,
} from '../telemetryConfig';

function store(values: { [key: string]: unknown }) {
    return (key: string) => values[key];
}

export const tests: Array<[string, () => void]> = [
    ['everything off by default', () => {
        const cfg = resolveTelemetryConfig({}, store({}));
        assert.equal(cfg.enabled, false);
        assert.equal(cfg.audioEnabled, false);
        assert.equal(cfg.statusPollMs, 0);
        assert.equal(cfg.audioDevice, null);
        assert.equal(cfg.sampleLimit, DEFAULT_TELEMETRY_SAMPLE_LIMIT);
        assert.equal(cfg.jobEventLimit, DEFAULT_JOB_EVENT_LIMIT);
        assert.equal(cfg.plannerLeadBlocks, 16);
        assert.deepEqual(Object.values(cfg.sources), ['default', 'default', 'default', 'default', 'default', 'default', 'default']);
    }],

    ['the job event default rises 100x with telemetry on, stored values still win', () => {
        assert.equal(resolveJobEventLimit(undefined, false), 2000);
        assert.equal(resolveJobEventLimit(undefined, true), 200000);
        assert.equal(TELEMETRY_JOB_EVENT_LIMIT, 100 * DEFAULT_JOB_EVENT_LIMIT);
        assert.equal(resolveJobEventLimit(30000, true), 30000);
        assert.equal(resolveJobEventLimit('30000', false), 30000);
        assert.equal(resolveJobEventLimit(10, true), MIN_JOB_EVENT_LIMIT);
        assert.equal(resolveJobEventLimit(5e7, true), MAX_JOB_EVENT_LIMIT);
        assert.equal(MAX_JOB_EVENT_LIMIT, 1000000);
        assert.equal(resolveJobEventLimit('garbage', true), 200000);
        assert.equal(resolveJobEventLimit(0, false), 2000);
    }],

    ['configstore values are read; env overrides them field by field', () => {
        const cfg = resolveTelemetryConfig(
            { LUBAN_MCP_SPINDLE_STATUS_POLL_MS: '250' },
            store({ mcpSpindleTelemetry: true, mcpSpindleAudio: 'yes', mcpAudioDevice: 'pulse:mic', mcpSpindleStatusPollMs: 500, mcpTelemetrySampleLimit: 50000, mcpJobEventLimit: 3000 }),
        );
        assert.equal(cfg.enabled, true);
        assert.equal(cfg.audioEnabled, true);
        assert.equal(cfg.audioDevice, 'pulse:mic');
        assert.equal(cfg.statusPollMs, 250);
        assert.equal(cfg.sampleLimit, 50000);
        assert.equal(cfg.jobEventLimit, 3000);
        assert.equal(cfg.sources.statusPollMs, 'env');
        assert.equal(cfg.sources.enabled, 'config');
        assert.equal(cfg.sources.jobEventLimit, 'config');
    }],

    ['audio needs telemetry: audio on with telemetry off records nothing', () => {
        const cfg = resolveTelemetryConfig({}, store({ mcpSpindleAudio: true, mcpAudioDevice: 'pulse:mic' }));
        assert.equal(cfg.enabled, false);
        assert.equal(cfg.audioEnabled, false);
        assert.equal(cfg.audioDevice, 'pulse:mic', 'the stored device is still reported');
    }],

    ['poll period clamps to 200-2000 ms and 0 / junk means off', () => {
        assert.equal(resolveTelemetryConfig({ LUBAN_MCP_SPINDLE_STATUS_POLL_MS: '50' }, store({})).statusPollMs, 200);
        assert.equal(resolveTelemetryConfig({ LUBAN_MCP_SPINDLE_STATUS_POLL_MS: '9000' }, store({})).statusPollMs, 2000);
        assert.equal(resolveTelemetryConfig({ LUBAN_MCP_SPINDLE_STATUS_POLL_MS: '0' }, store({})).statusPollMs, 0);
        assert.equal(resolveTelemetryConfig({ LUBAN_MCP_SPINDLE_STATUS_POLL_MS: 'fast' }, store({})).statusPollMs, 0);
    }],

    ['sample limit clamps; flags accept 1/true/on/yes only', () => {
        assert.equal(resolveTelemetryConfig({}, store({ mcpTelemetrySampleLimit: 5 })).sampleLimit, 10000);
        assert.equal(resolveTelemetryConfig({}, store({ mcpTelemetrySampleLimit: 1e9 })).sampleLimit, MAX_TELEMETRY_SAMPLE_LIMIT);
        for (const value of ['1', 'true', 'ON', 'yes', true]) {
            assert.equal(resolveTelemetryConfig({}, store({ mcpSpindleTelemetry: value })).enabled, true, String(value));
        }
        for (const value of ['0', 'false', 'off', '', 'maybe', false]) {
            assert.equal(resolveTelemetryConfig({}, store({ mcpSpindleTelemetry: value })).enabled, false, String(value));
        }
    }],
];
