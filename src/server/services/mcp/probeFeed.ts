import { EventEmitter } from 'events';
import os from 'os';

import logger from '../../lib/logger';
import config from '../configstore';
import { connectionManager } from '../machine/ConnectionManager';
import { GpioProbeTransport, describePin, resolveGpioFeedConfig } from './gpioFeed';
import { mcpBroadcast } from './index';
import { MqttClient } from './mqtt';
import { describeFeedHealth } from './probeFeedHealth';
import { PROBE_CHANNELS, ProbeChannel, ProbeTransport, ProbeTransportKind, ReadingMeta } from './probeTransport';
import { McpToolError } from './registry';

const log = logger('service:mcp:probe-feed');

// External probe sensors (tool height setter, CNC touch probe) report over a
// sensor feed rather than the machine controller - the controller has no
// input for them. The transport is abstracted behind ProbeFeedService
// (see probeTransport.ts for the contract); the backends are MQTT
// (Adafruit IO, below in this file) and Blinka GPIO (gpioFeed.ts, direct
// pins over U2IF/native). Each is configured from environment variables
// with the server configstore as the fallback, editable on the Settings ->
// MCP Server pane; LUBAN_MCP_PROBE_TRANSPORT / mcpProbeTransport picks the
// backend (default mqtt, or gpio when only gpio is configured).
//
// The overtravel channel is a TRIPWIRE: the sensor only reports overtravel
// when the physical mechanism has been pushed past its safe range. While a
// sensor-gated procedure is running (or MCP direct motion is in flight - see
// procedureArmed), a triggered reading immediately stops the running job,
// force-closes the machine connection, latches an alarm that blocks every
// motion tool, and reports to the operator. The latch clears only on the
// operator's explicit word (clear_overtravel_alarm) or an application
// restart. Outside that window (machine idle, operator bump-testing the
// switch by hand) it is reported but does not latch (operator, 2026-09-04).

// Channel names moved to probeTransport.ts (shared with the transport
// backends); re-exported here so existing consumers keep their import path.
export { PROBE_CHANNELS };
export type { ProbeChannel };

interface FieldSpec {
    env: string;
    key: string;
}

const FIELDS: { [name: string]: FieldSpec } = {
    host: { env: 'LUBAN_MCP_MQTT_HOST', key: 'mcpMqttHost' },
    port: { env: 'LUBAN_MCP_MQTT_PORT', key: 'mcpMqttPort' },
    username: { env: 'LUBAN_MCP_MQTT_USER', key: 'mcpMqttUser' },
    password: { env: 'LUBAN_MCP_MQTT_PASS', key: 'mcpMqttPass' },
    clientId: { env: 'LUBAN_MCP_MQTT_CLIENT_ID', key: 'mcpMqttClientId' },
    toolsetter: { env: 'LUBAN_MCP_MQTT_FEED_TOOLSETTER', key: 'mcpMqttFeedToolsetter' },
    overtravel: { env: 'LUBAN_MCP_MQTT_FEED_OVERTRAVEL', key: 'mcpMqttFeedOvertravel' },
    probe: { env: 'LUBAN_MCP_MQTT_FEED_PROBE', key: 'mcpMqttFeedProbe' },
    // Comma-separated channel names whose sensors idle HIGH and read low on
    // contact (normally-open probe circuits with a pull-up): "probe" marks
    // the CNC touch probe inverted while the tool setter stays direct.
    inverted: { env: 'LUBAN_MCP_MQTT_INVERTED', key: 'mcpMqttInverted' },
};

function resolveField(name: string): { value: string; source: 'env' | 'config' | null } {
    const spec = FIELDS[name];
    const envRaw = process.env[spec.env];
    if (envRaw !== undefined && String(envRaw).trim() !== '') {
        return { value: String(envRaw).trim(), source: 'env' };
    }
    const configRaw = config.get(spec.key);
    if (configRaw !== undefined && configRaw !== null && String(configRaw).trim() !== '') {
        return { value: String(configRaw).trim(), source: 'config' };
    }
    return { value: '', source: null };
}

/**
 * Default client id: username followed by the MAC bytes of the first
 * non-internal interface (e.g. "tyeth0123456789ab") - stable per machine,
 * unique per account, and within Adafruit IO's 23-byte-friendly length for
 * short usernames.
 */
function defaultClientId(username: string): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces).sort()) {
        for (const iface of interfaces[name] || []) {
            if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                return `${username}${iface.mac.replace(/:/g, '')}`;
            }
        }
    }
    return `${username}luban`;
}

export interface ProbeFeedConfig {
    configured: boolean;
    host: string;
    port: number;
    tls: boolean;
    username: string;
    password: string;
    clientId: string;
    topics: { [channel in ProbeChannel]: string | null };
    inverted: { [channel in ProbeChannel]: boolean };
    sources: { [field: string]: 'env' | 'config' | null };
    missing: string[];
}

/**
 * Resolve the feed configuration, environment first then configstore, so a
 * one-off env override never persists. Read fresh on every connect attempt -
 * settings changes apply at the next connect, not mid-connection.
 */
export function resolveProbeFeedConfig(): ProbeFeedConfig {
    const sources: { [field: string]: 'env' | 'config' | null } = {};
    const raw: { [field: string]: string } = {};
    for (const name of Object.keys(FIELDS)) {
        const field = resolveField(name);
        raw[name] = field.value;
        sources[name] = field.source;
    }

    const port = Number(raw.port) || 8883;
    const topics = {} as { [channel in ProbeChannel]: string | null };
    for (const channel of PROBE_CHANNELS) {
        const feed = raw[channel];
        if (!feed) {
            topics[channel] = null;
        } else if (feed.includes('/')) {
            topics[channel] = feed; // full topic given
        } else {
            topics[channel] = `${raw.username}/feeds/${feed}`; // Adafruit IO shape
        }
    }

    const invertedNames = raw.inverted.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
    const inverted = {} as { [channel in ProbeChannel]: boolean };
    for (const channel of PROBE_CHANNELS) {
        inverted[channel] = invertedNames.includes(channel);
    }

    const missing = ['host', 'username', 'password'].filter((name) => !raw[name]);
    if (!PROBE_CHANNELS.some((channel) => topics[channel])) {
        missing.push('at least one feed topic');
    }

    return {
        configured: missing.length === 0,
        host: raw.host,
        port,
        tls: port !== 1883, // Adafruit IO default 8883 is TLS; 1883 is plain
        username: raw.username,
        password: raw.password,
        clientId: raw.clientId || defaultClientId(raw.username || 'luban'),
        topics,
        inverted,
        sources,
        missing,
    };
}

/**
 * Which sensors the operator has enabled (Settings -> MCP Server; env
 * LUBAN_MCP_TOOLSETTER_ENABLED / LUBAN_MCP_PROBE_ENABLED override). Default
 * on. A disabled sensor's channel is left UNBOUND on every transport: no
 * topic/pin is subscribed, no readings, no pill, and every procedure that
 * needs it refuses with a clear message. Overtravel belongs to the tool
 * setter (same mechanism) and follows its flag.
 */
export interface SensorEnabled {
    toolsetter: boolean;
    overtravel: boolean;
    probe: boolean;
}

function readEnabledFlag(env: string, key: string): boolean {
    const envRaw = process.env[env];
    if (envRaw !== undefined && String(envRaw).trim() !== '') {
        return !['0', 'false', 'no', 'off'].includes(String(envRaw).trim().toLowerCase());
    }
    const configRaw = config.get(key);
    if (configRaw === undefined || configRaw === null) {
        return true;
    }
    return !(configRaw === false || ['0', 'false', 'no', 'off'].includes(String(configRaw).trim().toLowerCase()));
}

export function resolveSensorEnabled(): SensorEnabled {
    const toolsetter = readEnabledFlag('LUBAN_MCP_TOOLSETTER_ENABLED', 'mcpToolSetterEnabled');
    const probe = readEnabledFlag('LUBAN_MCP_PROBE_ENABLED', 'mcpProbeToolEnabled');
    return { toolsetter, overtravel: toolsetter, probe };
}

export function sensorLabel(channel: ProbeChannel): string {
    return channel === 'probe' ? 'touch probe' : 'tool setter';
}

/**
 * Which transport backend the probe feed uses. Explicit setting wins
 * (LUBAN_MCP_PROBE_TRANSPORT env, then mcpProbeTransport config); with
 * nothing stated the default is mqtt, unless only the GPIO side is
 * configured - so the Blinka box needs nothing beyond its pin variables.
 */
export function resolveProbeTransportKind(): ProbeTransportKind {
    const raw = String(process.env.LUBAN_MCP_PROBE_TRANSPORT || config.get('mcpProbeTransport') || '')
        .trim().toLowerCase();
    if (raw === 'mqtt' || raw === 'gpio') {
        return raw;
    }
    if (raw) {
        log.warn(`Unknown probe transport "${raw}" (expected mqtt or gpio) - falling back to auto-detect`);
    }
    if (!resolveProbeFeedConfig().configured && resolveGpioFeedConfig().configured) {
        return 'gpio';
    }
    return 'mqtt';
}

/** The transport-agnostic view of the active backend's configuration. */
export interface ActiveProbeConfig {
    kind: ProbeTransportKind;
    configured: boolean;
    missing: string[];
    /** Per channel: the MQTT topic or GPIO pin label bound to it, if any. */
    channels: { [channel in ProbeChannel]: string | null };
    inverted: { [channel in ProbeChannel]: boolean };
    /** Channels the operator switched off in Settings (never bound). */
    disabled: ProbeChannel[];
    /** Where the operator fixes a missing configuration, for error messages. */
    settingsHint: string;
}

/**
 * Apply the sensor enable flags to a transport's channel bindings: a
 * disabled channel is unbound, and "configured" is re-judged on what is
 * left so a rig with only disabled sensors bound does not try to connect.
 */
function applySensorFlags(
    channels: { [channel in ProbeChannel]: string | null },
    missing: string[]
): { channels: { [channel in ProbeChannel]: string | null }; missing: string[]; disabled: ProbeChannel[] } {
    const enabled = resolveSensorEnabled();
    const disabled = PROBE_CHANNELS.filter((channel) => !enabled[channel]);
    const filtered = {} as { [channel in ProbeChannel]: string | null };
    for (const channel of PROBE_CHANNELS) {
        filtered[channel] = enabled[channel] ? channels[channel] : null;
    }
    const remaining = missing.filter((item) => !/^at least one (feed topic|pin)/.test(item));
    if (!PROBE_CHANNELS.some((channel) => filtered[channel])) {
        if (disabled.length === PROBE_CHANNELS.length) {
            remaining.push('every sensor is disabled in Settings -> MCP Server');
        } else if (PROBE_CHANNELS.some((channel) => channels[channel])) {
            remaining.push('the only configured sensors are disabled in Settings -> MCP Server');
        } else {
            remaining.push(`at least one ${resolveProbeTransportKind() === 'gpio' ? 'pin' : 'feed topic'} for an enabled sensor`);
        }
    }
    return { channels: filtered, missing: remaining, disabled };
}

export function resolveActiveProbeConfig(): ActiveProbeConfig {
    const kind = resolveProbeTransportKind();
    if (kind === 'gpio') {
        const cfg = resolveGpioFeedConfig();
        const bound = {} as { [channel in ProbeChannel]: string | null };
        for (const channel of PROBE_CHANNELS) {
            bound[channel] = describePin(cfg.pins[channel]);
        }
        const applied = applySensorFlags(bound, cfg.missing);
        return {
            kind,
            configured: applied.missing.length === 0,
            missing: applied.missing,
            channels: applied.channels,
            inverted: cfg.inverted,
            disabled: applied.disabled,
            settingsHint: 'Set LUBAN_MCP_GPIO_PIN_TOOLSETTER/_OVERTRAVEL/_PROBE (Blinka pin name with an '
                + 'optional :up/:down/:float pull suffix, e.g. "GP6:up"), plus LUBAN_MCP_GPIO_PYTHON, '
                + '_INVERTED, _POLL_MS, _BLINKA_ENV as needed - or the matching mcpGpio* config keys '
                + '(Settings -> MCP Server).',
        };
    }
    const cfg = resolveProbeFeedConfig();
    const applied = applySensorFlags(cfg.topics, cfg.missing);
    return {
        kind,
        configured: applied.missing.length === 0,
        missing: applied.missing,
        channels: applied.channels,
        inverted: cfg.inverted,
        disabled: applied.disabled,
        settingsHint: 'Set the MQTT fields on Settings -> MCP Server or the LUBAN_MCP_MQTT_* '
            + 'environment variables.',
    };
}

/** Static (not-yet-connected) transport detail for status reports. */
function describeTransportConfig(kind: ProbeTransportKind): object {
    if (kind === 'gpio') {
        const cfg = resolveGpioFeedConfig();
        return {
            python: cfg.python,
            blinkaEnv: cfg.blinkaEnvText,
            pollMs: cfg.pollMs,
            configSources: cfg.sources,
        };
    }
    const cfg = resolveProbeFeedConfig();
    return {
        host: cfg.host || null,
        port: cfg.port,
        tls: cfg.tls,
        username: cfg.username || null,
        clientId: cfg.clientId,
        configSources: cfg.sources,
    };
}

/**
 * Sensor payloads that count as "in contact" / "tripped". `inverted` flips
 * the polarity for normally-open circuits that idle HIGH and read low on
 * contact (the CNC touch probe); an empty payload is unknown, never contact,
 * regardless of polarity.
 */
export function isTriggeredValue(value: string, inverted = false): boolean {
    const text = String(value).trim().toLowerCase();
    if (text === '') {
        return false;
    }
    const numeric = Number(text);
    const raw = Number.isFinite(numeric)
        ? numeric > 0
        : ['on', 'true', 'touch', 'touched', 'triggered', 'contact', 'high', 'yes'].includes(text);
    return inverted ? !raw : raw;
}

export interface ProbeReading {
    value: string;
    triggered: boolean;
    receivedAt: number;
    /** MQTT topic or GPIO pin label the value arrived on. */
    source: string;
}

interface SafetyTrip {
    kind: 'overtravel' | 'crash';
    channel: ProbeChannel;
    at: number;
    value: string;
    actions: string[];
}

const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60000;

/**
 * ProbeTransport backend over the hand-rolled MqttClient: subscribes the
 * configured channel topics, primes Adafruit IO's last-value replay, and
 * re-emits inbound publishes as channel readings. MQTT brokers only report
 * changes, so this transport never emits 'refresh'.
 */
class MqttProbeTransport extends EventEmitter implements ProbeTransport {
    private cfg: ProbeFeedConfig;

    private client: MqttClient | null = null;

    private connected = false;

    public constructor(cfg: ProbeFeedConfig) {
        super();
        this.cfg = cfg;
    }

    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const cfg = this.cfg;
            const client = new MqttClient({
                host: cfg.host,
                port: cfg.port,
                tls: cfg.tls,
                clientId: cfg.clientId,
                username: cfg.username,
                password: cfg.password,
            });
            this.client = client;
            let settled = false;

            client.on('connect', () => {
                this.connected = true;
                const topics = PROBE_CHANNELS.map((channel) => cfg.topics[channel]).filter(Boolean) as string[];
                client.subscribe(topics);
                // Adafruit IO replays a feed's last value when an empty
                // message is published to <topic>/get - prime the cache so a
                // fresh session knows the resting state without waiting for
                // the sensor to change.
                if (cfg.host.toLowerCase().includes('adafruit')) {
                    for (const topic of topics) {
                        client.publish(`${topic}/get`, '');
                    }
                }
                log.info(`Probe feed connected to ${cfg.host}:${cfg.port} as ${cfg.clientId}, `
                    + `subscribed to ${topics.length} topic(s)`);
                if (!settled) {
                    settled = true;
                    resolve();
                }
            });

            client.on('message', (topic: string, payload: string) => {
                for (const channel of PROBE_CHANNELS) {
                    if (cfg.topics[channel] === topic) {
                        this.emit('reading', channel, payload);
                        return;
                    }
                }
            });

            client.on('error', (err: Error) => {
                if (!settled) {
                    settled = true;
                    reject(err);
                } else {
                    this.emit('error', err);
                }
            });

            client.on('close', () => {
                this.connected = false;
                if (this.client === client) {
                    this.client = null;
                }
                if (!settled) {
                    settled = true;
                    reject(new Error(`MQTT connection to ${cfg.host}:${cfg.port} closed before CONNACK`));
                }
                this.emit('close');
            });

            client.connect();
        });
    }

    public end(): void {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
        this.connected = false;
    }

    public isConnected(): boolean {
        return this.connected && !!this.client && this.client.connected;
    }

    public describe(): object {
        return {
            host: this.cfg.host || null,
            port: this.cfg.port,
            tls: this.cfg.tls,
            username: this.cfg.username || null,
            clientId: this.cfg.clientId,
            configSources: this.cfg.sources,
        };
    }
}

/**
 * Build a fresh transport for the kind from freshly resolved configuration,
 * with disabled sensors' channels removed so they are never subscribed or
 * polled.
 */
function buildTransport(kind: ProbeTransportKind): ProbeTransport {
    const enabled = resolveSensorEnabled();
    if (kind === 'gpio') {
        const cfg = resolveGpioFeedConfig();
        for (const channel of PROBE_CHANNELS) {
            if (!enabled[channel]) {
                cfg.pins[channel] = null;
            }
        }
        return new GpioProbeTransport(cfg);
    }
    const cfg = resolveProbeFeedConfig();
    for (const channel of PROBE_CHANNELS) {
        if (!enabled[channel]) {
            cfg.topics[channel] = null;
        }
    }
    return new MqttProbeTransport(cfg);
}

export class ProbeFeedService {
    private transport: ProbeTransport | null = null;

    private activeConfig: ActiveProbeConfig | null = null;

    private readings = new Map<ProbeChannel, ProbeReading>();

    private contactCounts = new Map<ProbeChannel, number>();

    private trip: SafetyTrip | null = null;

    // Crash guard (added after the 2026-09-01 probe crash): while any
    // sensor-visible motion is in flight, a triggered reading on a contact
    // channel that is NOT expected to touch anything is a collision - same
    // response as overtravel. Procedures declare their expected channels.
    private motionCount = 0;

    private expectedContact = new Set<ProbeChannel>();

    private reconnectTimer: NodeJS.Timeout | null = null;

    private reconnectAttempts = 0;

    private wantConnected = false;

    private connecting = false;

    private lastError: string | null = null;

    /** When the feed first failed on this run; null while it is healthy. */
    private downSince: number | null = null;

    /**
     * Start (or keep) the feed connection. Idempotent; reconnection with
     * backoff is automatic until disconnect() is called. Resolves once the
     * broker accepts the session and subscriptions are sent.
     */
    public async connect(): Promise<void> {
        if (this.transport && this.transport.isConnected()) {
            return;
        }
        const cfg = resolveActiveProbeConfig();
        if (!cfg.configured) {
            throw new Error(`Probe feed (${cfg.kind} transport) is not configured: `
                + `missing ${cfg.missing.join(', ')}. ${cfg.settingsHint}`);
        }
        this.wantConnected = true;
        await this.openOnce(cfg);
    }

    /** Stop the connection and the reconnect loop. The alarm latch persists. */
    public disconnect(): void {
        this.wantConnected = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.transport) {
            this.transport.end();
            this.transport = null;
        }
        this.connecting = false;
    }

    public isConnected(): boolean {
        return !!(this.transport && this.transport.isConnected());
    }

    /** Monotonic trigger count: detects even a touch-and-release during a move. */
    public contactCount(channel: ProbeChannel): number {
        return this.contactCounts.get(channel) || 0;
    }

    public getReading(channel: ProbeChannel): ProbeReading | null {
        return this.readings.get(channel) || null;
    }

    /**
     * Wait for a reading on a channel newer than `sinceTimestamp`. Resolves
     * null on timeout - for a change-reporting sensor, silence means the
     * state has not changed.
     */
    public async waitForReading(channel: ProbeChannel, sinceTimestamp: number, timeoutMs: number): Promise<ProbeReading | null> {
        return new Promise((resolve) => {
            const existing = this.readings.get(channel);
            if (existing && existing.receivedAt > sinceTimestamp) {
                resolve(existing);
                return;
            }
            const started = Date.now();
            const poll = setInterval(() => {
                const reading = this.readings.get(channel);
                if (reading && reading.receivedAt > sinceTimestamp) {
                    clearInterval(poll);
                    resolve(reading);
                } else if (Date.now() - started > timeoutMs) {
                    clearInterval(poll);
                    resolve(null);
                }
            }, 50);
        });
    }

    public getTrip(): SafetyTrip | null {
        return this.trip;
    }

    /**
     * Throws when the overtravel alarm is latched - called by every motion
     * tool before sending anything to the machine.
     */
    public assertNoOvertravel(): void {
        if (this.trip) {
            throw new McpToolError(`${this.trip.kind === 'crash' ? 'CRASH' : 'OVERTRAVEL'} ALARM latched at `
                + `${new Date(this.trip.at).toISOString()} (${this.trip.channel} sensor value "${this.trip.value}"). `
                + 'All motion is blocked. The operator must inspect '
                + 'the machine and explicitly clear the alarm (clear_overtravel_alarm) or restart Luban.');
        }
    }

    /** Operator-authorised alarm clear; refuses while still reporting triggered. */
    public clearTrip(): void {
        const channel = this.trip ? this.trip.channel : 'overtravel';
        const reading = this.readings.get(channel);
        if (reading && reading.triggered) {
            throw new McpToolError(`The ${channel} feed still reports triggered; refusing to clear the alarm.`);
        }
        this.trip = null;
        log.warn('Safety alarm cleared by operator authority.');
    }

    /** Motion-in-flight bracket for the crash guard. Always pair with motionEnd. */
    public motionBegin(): void {
        this.motionCount += 1;
    }

    public motionEnd(): void {
        this.motionCount = Math.max(0, this.motionCount - 1);
    }

    /** Declare which channels a probing procedure EXPECTS to touch. */
    public setExpectedContact(channels: ProbeChannel[]): void {
        this.expectedContact = new Set(channels);
    }

    /**
     * True while the machine is under MCP control that a sensor could
     * legitimately protect: a sensor-gated procedure has declared its
     * expected contacts (tool setter / probing runners bracket their whole
     * run), or a direct motion is in flight (motionBegin). The overtravel
     * tripwire only latches inside this window.
     */
    public procedureArmed(): boolean {
        return this.motionCount > 0 || this.expectedContact.size > 0;
    }

    public clearExpectedContact(): void {
        this.expectedContact.clear();
    }

    public status(): object {
        const cfg = this.activeConfig || resolveActiveProbeConfig();
        const feeds: { [channel: string]: object | null } = {};
        for (const channel of PROBE_CHANNELS) {
            const reading = this.readings.get(channel);
            feeds[channel] = {
                enabled: !cfg.disabled.includes(channel),
                source: cfg.channels[channel],
                inverted: cfg.inverted[channel],
                last: reading ? {
                    value: reading.value,
                    triggered: reading.triggered,
                    receivedAt: reading.receivedAt,
                    ageMs: Date.now() - reading.receivedAt,
                } : null,
            };
        }
        return {
            transport: cfg.kind,
            configured: cfg.configured,
            missing: cfg.missing,
            connected: this.isConnected(),
            connecting: this.connecting,
            disabledSensors: cfg.disabled,
            // A feed that is configured but cannot reach its hardware (the
            // USB sensor bridge unplugged, the broker down) is "unavailable":
            // the UI shows unknown pills, procedures refuse, and the service
            // keeps retrying quietly in the background.
            unavailable: cfg.configured && !this.isConnected() && !this.connecting && this.reconnectAttempts > 0,
            ...(this.transport ? this.transport.describe() : describeTransportConfig(cfg.kind)),
            feeds,
            safetyTrip: this.trip,
            reconnectAttempts: this.reconnectAttempts,
            lastError: this.lastError,
            downForMs: this.downSince === null ? null : Date.now() - this.downSince,
            // The sentence that was missing on 2026-09-19: a dead bridge
            // should not be something you discover by trying to probe.
            ...describeFeedHealth({
                configured: cfg.configured,
                connected: this.isConnected(),
                connecting: this.connecting,
                disabledSensors: cfg.disabled,
                downForMs: this.downSince === null ? null : Date.now() - this.downSince,
                reconnectAttempts: this.reconnectAttempts,
                lastError: this.lastError,
            }),
        };
    }

    private async openOnce(cfg: ActiveProbeConfig): Promise<void> {
        if (this.connecting) {
            return;
        }
        this.connecting = true;
        this.activeConfig = cfg;
        const transport = buildTransport(cfg.kind);
        this.transport = transport;

        transport.on('reading', (channel: ProbeChannel, value: string, meta?: ReadingMeta) => this.onReading(channel, value, false, meta));
        transport.on('refresh', (channel: ProbeChannel, value: string) => this.onReading(channel, value, true));
        transport.on('error', (err: Error) => {
            // An unplugged sensor bridge produces the same error on every
            // retry - log a new message once, then stay quiet about repeats.
            if (err.message !== this.lastError) {
                log.error(`Probe feed error: ${err.message}`);
            }
            this.lastError = err.message;
        });
        transport.on('close', () => {
            this.connecting = false;
            if (this.transport === transport) {
                this.transport = null;
            }
            // Lets the UI's sensor pills fall back to "unknown" rather than
            // showing the last reading as if it were still live.
            mcpBroadcast('mcp:activity', { tool: 'probe_feed', phase: 'disconnected', transport: cfg.kind });
            if (this.wantConnected) {
                this.scheduleReconnect();
            }
        });

        try {
            await transport.connect();
            this.connecting = false;
            this.reconnectAttempts = 0;
            this.lastError = null;
            this.downSince = null;
            mcpBroadcast('mcp:activity', { tool: 'probe_feed', phase: 'connected', transport: cfg.kind });
        } catch (err) {
            this.connecting = false;
            if ((err as Error).message !== this.lastError) {
                log.error(`Probe feed connect failed: ${(err as Error).message}`);
            }
            this.lastError = (err as Error).message;
            throw err;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || !this.wantConnected) {
            return;
        }
        this.reconnectAttempts += 1;
        if (this.downSince === null) {
            this.downSince = Date.now();
        }
        const delay = Math.min(RECONNECT_BASE_MS * (2 ** Math.min(this.reconnectAttempts - 1, 4)), RECONNECT_MAX_MS);
        if (this.reconnectAttempts <= 3 || this.reconnectAttempts % 10 === 0) {
            const why = this.lastError ? ` (last error: ${this.lastError})` : '';
            log.info(`Probe feed reconnect ${this.reconnectAttempts} in ${delay}ms${why}`);
        }
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            const cfg = resolveActiveProbeConfig();
            if (!cfg.configured) {
                this.wantConnected = false;
                return;
            }
            this.openOnce(cfg).catch(() => {
                // close handler schedules the next attempt
            });
        }, delay);
    }

    private onReading(channel: ProbeChannel, value: string, refreshOnly: boolean, meta?: ReadingMeta): void {
        const cfg = this.activeConfig;
        if (!cfg) {
            return;
        }
        const existing = this.readings.get(channel);
        if (refreshOnly && existing && existing.value === value) {
            // Polled-but-unchanged (the GPIO heartbeat): freshness only, no
            // broadcast/log spam. Trip decisions stay on CHANGE events so the
            // latch semantics match the change-reporting MQTT transport; a
            // refresh carrying a DIFFERENT value (a missed change) falls
            // through to full handling as a safety net.
            existing.receivedAt = Date.now();
            return;
        }
        const reading: ProbeReading = {
            value,
            triggered: isTriggeredValue(value, cfg.inverted[channel]),
            receivedAt: Date.now(),
            source: cfg.channels[channel] || channel,
        };
        this.readings.set(channel, reading);
        if (reading.triggered) {
            this.contactCounts.set(channel, this.contactCount(channel) + 1);
        }
        // Transport -> server latency when the transport stamped the reading
        // (GPIO monitor wall clock); part of the sensor-timing evidence.
        const pipeMs = meta && meta.sentAt ? Math.max(0, reading.receivedAt - meta.sentAt) : undefined;
        mcpBroadcast('mcp:activity', {
            tool: 'probe_feed',
            phase: 'reading',
            channel,
            value,
            triggered: reading.triggered,
            pipeMs,
        });
        log.info(`reading ${channel}=${value} triggered=${reading.triggered}${pipeMs === undefined ? '' : ` pipe=${pipeMs}ms`}`);
        if (!this.trip && reading.triggered) {
            if (channel === 'overtravel') {
                // Operator decision (2026-09-04): the overtravel tripwire is
                // armed only while a sensor-gated procedure (tool height
                // test, probing) is running or MCP direct motion is in
                // flight. Pressing the switch by hand with the machine idle
                // is a bump test, not an emergency - report, don't latch.
                if (this.procedureArmed()) {
                    this.tripSafety('overtravel', channel, reading);
                } else {
                    log.warn(`overtravel reported while no procedure is running (value "${value}") - not latching`);
                    mcpBroadcast('mcp:activity', {
                        tool: 'probe_feed',
                        phase: 'overtravel_unarmed',
                        channel,
                        value,
                        message: 'Overtravel switch triggered with no procedure running - no alarm latched.',
                    });
                }
            } else if (this.motionCount > 0 && !this.expectedContact.has(channel)) {
                // A contact sensor fired during motion that expected no
                // contact: collision. Stop everything.
                this.tripSafety('crash', channel, reading);
            }
        }
    }

    /**
     * The overtravel tripwire: stop whatever is running, force-close the
     * machine connection, latch the alarm, tell the operator. Best-effort on
     * every step - a failed stop must not prevent the disconnect.
     */
    private tripSafety(kind: 'overtravel' | 'crash', channel: ProbeChannel, reading: ProbeReading): void {
        const actions: string[] = [];
        this.trip = { kind, channel, at: reading.receivedAt, value: reading.value, actions };
        log.error(`${kind.toUpperCase()} reported by ${channel} feed (value "${reading.value}") - aborting all jobs and connections`);

        const machineChannel = connectionManager.getCurrentChannel() as unknown as {
            stopGcodeJob?: () => Promise<unknown>;
            connectionClose?: (options: { force: boolean }) => Promise<unknown>;
        } | null;
        if (machineChannel) {
            (async () => {
                if (typeof machineChannel.stopGcodeJob === 'function') {
                    try {
                        await machineChannel.stopGcodeJob();
                        actions.push('stop_gcode_job sent');
                        log.error(`${kind} abort: stop sent to the machine`);
                    } catch (err) {
                        actions.push(`stop_gcode_job failed: ${(err as Error).message}`);
                        log.error(`${kind} abort: stop failed: ${(err as Error).message}`);
                    }
                }
                if (typeof machineChannel.connectionClose === 'function') {
                    try {
                        await machineChannel.connectionClose({ force: true });
                        actions.push('connection force-closed');
                        log.error(`${kind} abort: machine connection force-closed`);
                    } catch (err) {
                        actions.push(`connection close failed: ${(err as Error).message}`);
                        log.error(`${kind} abort: close failed: ${(err as Error).message}`);
                    }
                }
            })();
        } else {
            actions.push('no machine channel connected');
        }

        mcpBroadcast('mcp:activity', {
            tool: 'probe_feed',
            phase: kind === 'crash' ? 'CRASH_ALARM' : 'OVERTRAVEL_ALARM',
            channel,
            value: reading.value,
            message: `${kind === 'crash' ? `Collision: ${channel} sensor fired during motion that expected no contact` : 'Overtravel sensor tripped'}: `
                + 'running job stopped, machine connection force-closed, all MCP motion blocked '
                + 'until the operator clears the alarm.',
        });
    }
}

export const probeFeedService = new ProbeFeedService();
