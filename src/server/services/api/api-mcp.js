import config from '../configstore';
import { getMcpHealth, getMcpStatus } from '../mcp';
import { MAX_MAX_CLIENTS, MAX_STREAM_FPS, MIN_STREAM_FPS, STREAM_ENABLED_KEY, STREAM_FPS_KEY, STREAM_MAX_CLIENTS_KEY, cameraStreamService } from '../mcp/cameraStream';
import { MAX_RECENT_LIMIT, MIN_RECENT_LIMIT, diagnosticsRecentLimit } from '../mcp/diagnostics';
import { DEFAULT_BLINKA_ENV, resolveGpioFeedConfig } from '../mcp/gpioFeed';
import { MAX_JOB_EVENT_LIMIT, MIN_JOB_EVENT_LIMIT, approvalHandoff, jobEventLimit } from '../mcp/jobs';
import { probeFeedService, resolveProbeFeedConfig, resolveProbeTransportKind, resolveSensorEnabled } from '../mcp/probeFeed';
import { listAudioSources } from '../mcp/audioDevices';
import { describeSourceChoice, matchAudioDevice } from '../mcp/audioSelection';
import { currentTelemetryConfig, spindleTelemetryService } from '../mcp/spindleTelemetry';
import { MAX_STATUS_POLL_MS, MIN_STATUS_POLL_MS, TELEMETRY_KEYS } from '../mcp/telemetryConfig';

const ERR_BAD_REQUEST = 400;

// Probe feed (MQTT) fields editable on the Settings -> MCP Server pane.
// Environment variables (LUBAN_MCP_MQTT_*) override these at resolve time;
// the pane shows stored values and flags active env overrides.
const MQTT_FIELD_KEYS = {
    host: 'mcpMqttHost',
    port: 'mcpMqttPort',
    user: 'mcpMqttUser',
    pass: 'mcpMqttPass',
    clientId: 'mcpMqttClientId',
    feedToolsetter: 'mcpMqttFeedToolsetter',
    feedOvertravel: 'mcpMqttFeedOvertravel',
    feedProbe: 'mcpMqttFeedProbe',
    inverted: 'mcpMqttInverted',
};

// api field name -> probeFeed resolver field name (for env-override display)
const MQTT_SOURCE_FIELDS = {
    host: 'host',
    port: 'port',
    user: 'username',
    pass: 'password',
    clientId: 'clientId',
    feedToolsetter: 'toolsetter',
    feedOvertravel: 'overtravel',
    feedProbe: 'probe',
    inverted: 'inverted',
};

// Probe feed (Blinka GPIO) fields, same env-first resolution
// (LUBAN_MCP_GPIO_*). Pin values are a Blinka pin name with an optional
// pull suffix, e.g. "GP6:up".
const GPIO_FIELD_KEYS = {
    python: 'mcpGpioPython',
    pinToolsetter: 'mcpGpioPinToolsetter',
    pinOvertravel: 'mcpGpioPinOvertravel',
    pinProbe: 'mcpGpioPinProbe',
    inverted: 'mcpGpioInverted',
    pollMs: 'mcpGpioPollMs',
    blinkaEnv: 'mcpGpioBlinkaEnv',
};

// api field name -> gpioFeed resolver field name (for env-override display)
const GPIO_SOURCE_FIELDS = {
    python: 'python',
    pinToolsetter: 'toolsetter',
    pinOvertravel: 'overtravel',
    pinProbe: 'probe',
    inverted: 'inverted',
    pollMs: 'pollMs',
    blinkaEnv: 'blinkaEnv',
};

function mqttSettings() {
    const resolved = resolveProbeFeedConfig();
    const values = {};
    for (const [field, key] of Object.entries(MQTT_FIELD_KEYS)) {
        if (field === 'pass') {
            continue; // never echo the password, stored or otherwise
        }
        const raw = config.get(key);
        values[field] = (raw === undefined || raw === null) ? '' : String(raw);
    }
    const envOverrides = Object.entries(MQTT_SOURCE_FIELDS)
        .filter(([, sourceField]) => resolved.sources[sourceField] === 'env')
        .map(([field]) => field);
    return {
        values,
        passSet: !!config.get(MQTT_FIELD_KEYS.pass),
        envOverrides,
        configured: resolved.configured,
        missing: resolved.missing,
        defaultClientId: resolved.clientId,
    };
}

function gpioSettings() {
    const resolved = resolveGpioFeedConfig();
    const values = {};
    for (const [field, key] of Object.entries(GPIO_FIELD_KEYS)) {
        const raw = config.get(key);
        values[field] = (raw === undefined || raw === null) ? '' : String(raw);
    }
    const envOverrides = Object.entries(GPIO_SOURCE_FIELDS)
        .filter(([, sourceField]) => resolved.sources[sourceField] === 'env')
        .map(([field]) => field);
    return {
        values,
        envOverrides,
        configured: resolved.configured,
        missing: resolved.missing,
        defaultPython: resolved.python,
        defaultBlinkaEnv: DEFAULT_BLINKA_ENV,
    };
}

function sensorSettings() {
    const enabled = resolveSensorEnabled();
    return {
        toolSetter: enabled.toolsetter,
        probe: enabled.probe,
        stored: {
            toolSetter: config.get('mcpToolSetterEnabled'),
            probe: config.get('mcpProbeToolEnabled'),
        },
        envOverrides: ['LUBAN_MCP_TOOLSETTER_ENABLED', 'LUBAN_MCP_PROBE_ENABLED'].filter((name) => !!(process.env[name] || '').trim()),
    };
}

// Diagnostic buffer sizes (jobs.ts / diagnostics.ts). Env overrides win.
function limitSource(envName, configKey) {
    if (process.env[envName]) {
        return 'env';
    }
    return config.get(configKey) ? 'config' : 'default';
}

function bufferSettings() {
    return {
        jobEventLimit: jobEventLimit(),
        jobEventLimitRange: [MIN_JOB_EVENT_LIMIT, MAX_JOB_EVENT_LIMIT],
        jobEventLimitSource: limitSource('LUBAN_MCP_JOB_EVENT_LIMIT', 'mcpJobEventLimit'),
        diagnosticsRecentLimit: diagnosticsRecentLimit(),
        diagnosticsRecentLimitRange: [MIN_RECENT_LIMIT, MAX_RECENT_LIMIT],
        diagnosticsRecentLimitSource: limitSource('LUBAN_MCP_DIAGNOSTICS_RECENT_LIMIT', 'mcpDiagnosticsRecentLimit'),
    };
}

function transportSettings() {
    return {
        // What the operator stored (may be empty = auto), and what is live.
        stored: String(config.get('mcpProbeTransport') || ''),
        envOverride: !!(process.env.LUBAN_MCP_PROBE_TRANSPORT || '').trim(),
        active: resolveProbeTransportKind(),
    };
}

// Job approval hand-off (jobs.ts approvalHandoff): 'agent' lets a waiting
// start_gcode_job start on the operator's click; 'code' requires the relayed code.
function approvalSettings() {
    return {
        handoff: approvalHandoff(),
        source: limitSource('LUBAN_MCP_APPROVAL_HANDOFF', 'mcpApprovalHandoff'),
    };
}

// Spindle telemetry (spindleTelemetry.ts): opt-in status RPM recording, the
// optional faster status poll, the microphone and WHICH microphone. The
// capture sources are listed so the pane can offer them; nothing here
// chooses one - the operator does.
async function spindleTelemetrySettings() {
    const cfg = currentTelemetryConfig();
    let listing = { sources: [], backends: [] };
    try {
        listing = await listAudioSources();
    } catch (err) {
        listing = { sources: [], backends: [{ command: 'list', ok: false, count: 0, error: err.message }] };
    }
    const match = cfg.audioDevice ? matchAudioDevice(cfg.audioDevice, listing.sources) : null;
    let resolution = 'no device configured';
    if (match) {
        resolution = match.ok ? `matched on ${match.matchedOn}` : match.reason;
    }
    return {
        enabled: cfg.enabled,
        statusPollMs: cfg.statusPollMs,
        statusPollRange: [MIN_STATUS_POLL_MS, MAX_STATUS_POLL_MS],
        audioEnabled: cfg.audioEnabled,
        audioDevice: cfg.audioDevice,
        sampleLimit: cfg.sampleLimit,
        sources: cfg.sources,
        envNames: Object.fromEntries(Object.entries(TELEMETRY_KEYS).map(([field, names]) => [field, names.env])),
        devices: listing.sources.map((source) => ({
            entry: source.entry, description: source.description, backend: source.backend, builtIn: source.builtIn, usb: source.usb,
        })),
        listingCommands: listing.backends,
        resolves: match ? match.ok : false,
        resolution,
        guidance: describeSourceChoice(listing.sources),
        live: spindleTelemetryService.status(),
    };
}

function settingsPayload() {
    return {
        ...getMcpStatus(),
        transport: transportSettings(),
        sensors: sensorSettings(),
        mqtt: mqttSettings(),
        gpio: gpioSettings(),
        buffers: bufferSettings(),
        approval: approvalSettings(),
    };
}

export const getHealth = (req, res) => {
    res.send(getMcpHealth());
};

export const getStatus = async (req, res) => {
    const payload = settingsPayload();
    try {
        payload.spindleTelemetry = await spindleTelemetrySettings();
    } catch (err) {
        payload.spindleTelemetry = { error: err.message };
    }
    res.send(payload);
};

/**
 * Operator clears the latched safety alarm (overtravel or crash) from the
 * Workspace pill. A human click in the app IS the operator's explicit word;
 * the same guard as clear_overtravel_alarm applies - refused (409) while the
 * tripped channel still reads triggered.
 */
export const clearAlarm = (req, res) => {
    const trip = probeFeedService.getTrip();
    if (!trip) {
        res.send({ cleared: false, note: 'No safety alarm is latched.', probeFeed: probeFeedService.status() });
        return;
    }
    try {
        probeFeedService.clearTrip();
    } catch (err) {
        res.status(409).send({ msg: err.message, probeFeed: probeFeedService.status() });
        return;
    }
    const reason = String((req.body || {}).reason || 'cleared from the Workspace connection panel');
    res.send({ cleared: true, previousTrip: trip, reason, probeFeed: probeFeedService.status() });
};

/**
 * Persist MCP settings (configstore). Applied at the next start; the
 * response carries live status so the UI can say so. MQTT fields apply at
 * the next probe-feed connect. An empty string clears a stored field; an
 * omitted field is left unchanged (the pane omits an untouched password).
 */
export const updateSettings = (req, res) => {
    const { enabled, port, allowLan, sensors, mqtt, gpio, transport, buffers, approvalHandoff: handoff, cameraStream, spindleTelemetry } = req.body || {};

    const tls = (req.body || {}).https;
    if (tls !== undefined) {
        if (!tls || typeof tls !== 'object' || Array.isArray(tls)
            || ['certFile', 'keyFile'].some((field) => tls[field] !== undefined && typeof tls[field] !== 'string')) {
            res.status(ERR_BAD_REQUEST).send({ msg: 'https.certFile and https.keyFile must be file path strings.' });
            return;
        }
    }
    if (port !== undefined) {
        const value = Number(port);
        if (!Number.isInteger(value) || value < 1 || value > 65535) {
            res.status(ERR_BAD_REQUEST).send({ msg: `Invalid port: ${port}` });
            return;
        }
        config.set('mcpPort', value);
    }
    if (tls) {
        for (const [field, key] of [['certFile', 'mcpHttpsCert'], ['keyFile', 'mcpHttpsKey']]) {
            if (tls[field] !== undefined) {
                const value = tls[field].trim();
                if (value) { config.set(key, value); } else { config.unset(key); }
            }
        }
    }
    if (enabled !== undefined) {
        config.set('mcpEnabled', !!enabled);
    }
    if (allowLan !== undefined) {
        // Applies at the next start (bind address). No authentication exists:
        // the pane carries the warning; here we only persist the choice.
        config.set('mcpAllowLan', !!allowLan);
    }
    if (handoff !== undefined) {
        const value = String(handoff).trim().toLowerCase();
        if (value === '') {
            config.unset('mcpApprovalHandoff'); // default: agent
        } else if (value === 'agent' || value === 'code') {
            config.set('mcpApprovalHandoff', value);
        } else {
            res.status(ERR_BAD_REQUEST).send({ msg: `Invalid approvalHandoff: ${handoff} (agent, code or empty)` });
            return;
        }
    }
    if (buffers && typeof buffers === 'object') {
        // Diagnostic buffer sizes: applied immediately (read on every append).
        const limits = [
            ['jobEventLimit', 'mcpJobEventLimit', MIN_JOB_EVENT_LIMIT, MAX_JOB_EVENT_LIMIT],
            ['diagnosticsRecentLimit', 'mcpDiagnosticsRecentLimit', MIN_RECENT_LIMIT, MAX_RECENT_LIMIT],
        ];
        for (const [field, key, min, max] of limits) {
            if (buffers[field] === undefined) {
                continue;
            }
            const value = String(buffers[field]).trim();
            if (value === '') {
                config.unset(key); // back to the default
                continue;
            }
            const numeric = Number(value);
            if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
                res.status(ERR_BAD_REQUEST).send({ msg: `Invalid ${field}: ${value} (${min}-${max})` });
                return;
            }
            config.set(key, numeric);
        }
    }
    if (spindleTelemetry && typeof spindleTelemetry === 'object') {
        // Spindle telemetry: read at the next file-job start. The device is
        // stored as typed (an entry or alias from the listing); it is resolved
        // strictly when a job starts and refused, not guessed, if it no
        // longer matches exactly one source.
        if (spindleTelemetry.enabled !== undefined) {
            config.set(TELEMETRY_KEYS.enabled.key, !!spindleTelemetry.enabled);
        }
        if (spindleTelemetry.audioEnabled !== undefined) {
            config.set(TELEMETRY_KEYS.audio.key, !!spindleTelemetry.audioEnabled);
        }
        if (spindleTelemetry.statusPollMs !== undefined) {
            const value = String(spindleTelemetry.statusPollMs).trim();
            if (value === '' || value === '0') {
                config.unset(TELEMETRY_KEYS.statusPollMs.key);
            } else {
                const numeric = Number(value);
                if (!Number.isInteger(numeric) || numeric < MIN_STATUS_POLL_MS || numeric > MAX_STATUS_POLL_MS) {
                    res.status(ERR_BAD_REQUEST).send({ msg: `Invalid spindle status poll: ${value} (${MIN_STATUS_POLL_MS}-${MAX_STATUS_POLL_MS} ms, or empty for off)` });
                    return;
                }
                config.set(TELEMETRY_KEYS.statusPollMs.key, numeric);
            }
        }
        if (spindleTelemetry.audioDevice !== undefined) {
            const value = String(spindleTelemetry.audioDevice).trim();
            if (value === '') {
                config.unset(TELEMETRY_KEYS.audioDevice.key);
            } else if (/^\d+$/.test(value)) {
                res.status(ERR_BAD_REQUEST).send({ msg: 'Name the capture device (an entry from the list), not a number: numbering changes on replug.' });
                return;
            } else {
                config.set(TELEMETRY_KEYS.audioDevice.key, value);
            }
        }
    }
    if (cameraStream && typeof cameraStream === 'object') {
        // Live MJPEG camera view (cameraStream.ts). Applies immediately: off
        // disconnects every stream client; fps / client cap take effect at
        // the next loop start. An empty fps/maxClients returns to the default.
        if (cameraStream.enabled !== undefined) {
            config.set(STREAM_ENABLED_KEY, !!cameraStream.enabled);
        }
        const ranges = [
            ['fps', STREAM_FPS_KEY, MIN_STREAM_FPS, MAX_STREAM_FPS],
            ['maxClients', STREAM_MAX_CLIENTS_KEY, 1, MAX_MAX_CLIENTS],
        ];
        for (const [field, key, min, max] of ranges) {
            if (cameraStream[field] === undefined) {
                continue;
            }
            const value = String(cameraStream[field]).trim();
            if (value === '') {
                config.unset(key);
                continue;
            }
            const numeric = Number(value);
            if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
                res.status(ERR_BAD_REQUEST).send({ msg: `Invalid camera stream ${field}: ${value} (${min}-${max})` });
                return;
            }
            config.set(key, numeric);
        }
        cameraStreamService.applySettings();
    }
    if (sensors && typeof sensors === 'object') {
        if (sensors.toolSetter !== undefined) {
            config.set('mcpToolSetterEnabled', !!sensors.toolSetter);
        }
        if (sensors.probe !== undefined) {
            config.set('mcpProbeToolEnabled', !!sensors.probe);
        }
    }

    if (mqtt && typeof mqtt === 'object') {
        for (const [field, key] of Object.entries(MQTT_FIELD_KEYS)) {
            if (mqtt[field] === undefined) {
                continue;
            }
            const value = String(mqtt[field]).trim();
            if (value === '') {
                config.unset(key);
                continue;
            }
            if (field === 'port') {
                const numeric = Number(value);
                if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
                    res.status(ERR_BAD_REQUEST).send({ msg: `Invalid MQTT port: ${value}` });
                    return;
                }
                config.set(key, numeric);
                continue;
            }
            config.set(key, value);
        }
    }

    if (transport !== undefined) {
        const value = String(transport).trim().toLowerCase();
        if (value === '') {
            config.unset('mcpProbeTransport'); // back to auto-detect
        } else if (value === 'mqtt' || value === 'gpio') {
            config.set('mcpProbeTransport', value);
        } else {
            res.status(ERR_BAD_REQUEST).send({ msg: `Invalid probe transport: ${transport} (mqtt, gpio or empty)` });
            return;
        }
    }

    if (gpio && typeof gpio === 'object') {
        for (const [field, key] of Object.entries(GPIO_FIELD_KEYS)) {
            if (gpio[field] === undefined) {
                continue;
            }
            const value = String(gpio[field]).trim();
            if (value === '') {
                config.unset(key);
                continue;
            }
            if (field === 'pollMs') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric) || numeric < 2 || numeric > 1000) {
                    res.status(ERR_BAD_REQUEST).send({ msg: `Invalid GPIO poll interval: ${value} (2-1000 ms)` });
                    return;
                }
                config.set(key, numeric);
                continue;
            }
            config.set(key, value);
        }
    }

    res.send(settingsPayload());
};
