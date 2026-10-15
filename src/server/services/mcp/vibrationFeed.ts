// The accelerometer feed: runs the sensor monitor (vibration_monitor.py)
// on every configured LINK, turns its batches into timed samples per sensor
// (vibrationStream.ts: clock, ring, run boundaries), and hands samples to
// whoever is recording (captures).
//
// Links, one monitor each:
//   - blinka: the monitor runs here under Python + Adafruit Blinka, spawned
//     like the GPIO probe monitor, on a USB I2C bridge of its OWN (or a Pi
//     header). The configuration holds explicit resource leases (bridge,
//     pins) and refuses any the probe feed holds - stored settings AND the
//     running feed: the probe and crash sensors are safety equipment and
//     never share a USB device or pin with an experiment.
//   - serial: CircuitPython boards near the machine run the same file as
//     code.py and stream over USB serial, one link per board (port); each
//     board has its own I2C bus and sensors. Several boards suit sensors
//     spread over the toolhead, tailstock, rotary and axes.
//
// A sensor's stream outlives its monitor: a reconnect or a board restart
// starts a new run whose first batch is a gap. A configuration change ends
// the streams (and, via 'reconfigured', the captures recording them).
//
// Read-only with respect to the machine: nothing here commands, pauses or
// stops anything, and nothing in the motion or probe path waits on it.

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

import logger from '../../lib/logger';
import config from '../configstore';
import { probeFeedService } from './probeFeed';
import { VibrationConfig, VibrationLink, blinkaLeases, leaseConflict, monitorConfig, parseEnvPairs, resolveVibrationConfig } from './vibrationConfig';
import { VIBRATION_MONITOR_SOURCE } from './vibrationMonitorSource';
import { MonitorBatch, ProtocolError, decodeBatch } from './vibrationProtocol';
import { SensorStream } from './vibrationStream';

const log = logger('service:mcp:vibration-feed');

const HEARTBEAT_MS = 1000;
/** No line at all for this long after ready: the monitor (or cable) is dead. */
const STALL_MS = 6000;
/** First Blinka import + bridge enumeration can be slow. */
const READY_TIMEOUT_MS = 30000;
const BACKOFF_MS = [2000, 4000, 8000, 15000, 30000];
const STDERR_TAIL_CHARS = 2000;

export function currentVibrationConfig(): VibrationConfig {
    return resolveVibrationConfig(process.env, (key) => config.get(key));
}

/** The sample rate a stream is recorded at right now (Hz). */
export function streamRate(stream: SensorStream): number {
    return stream.rateHz();
}

interface LineTransport extends EventEmitter {
    open(): void;
    close(): void;
    send(line: string): void;
    describe(): { [key: string]: unknown };
}

class ChildTransport extends EventEmitter implements LineTransport {
    private child: ChildProcess | null = null;

    private buffer = '';

    private stderrTail = '';

    public constructor(private readonly cfg: VibrationConfig, private readonly cfgJson: string) {
        super();
    }

    public open(): void {
        // Only the configured bridge: a BLINKA_* left in Luban's own
        // environment (the probe feed's U2IF, say) must not reach the child.
        const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('BLINKA_')));
        let child: ChildProcess;
        try {
            child = spawn(this.cfg.python, ['-u', '-c', VIBRATION_MONITOR_SOURCE, this.cfgJson], {
                env: { ...inherited, ...this.cfg.blinkaEnv },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });
        } catch (err) {
            setImmediate(() => this.emit('close', `failed to spawn "${this.cfg.python}": ${(err as Error).message}`));
            return;
        }
        this.child = child;
        child.on('error', (err: Error) => {
            this.emit('close', `monitor spawn failed ("${this.cfg.python}"): ${err.message}`);
        });
        if (child.stderr) {
            child.stderr.on('data', (chunk: Buffer) => {
                this.stderrTail = (this.stderrTail + chunk.toString('utf8')).slice(-STDERR_TAIL_CHARS);
            });
        }
        if (child.stdout) {
            child.stdout.on('data', (chunk: Buffer) => {
                this.buffer += chunk.toString('utf8');
                let newline = this.buffer.indexOf('\n');
                while (newline >= 0) {
                    const line = this.buffer.slice(0, newline).trim();
                    this.buffer = this.buffer.slice(newline + 1);
                    if (line) {
                        this.emit('line', line);
                    }
                    newline = this.buffer.indexOf('\n');
                }
            });
        }
        child.on('exit', (code: number | null, signal: string | null) => {
            if (this.child === child) {
                this.child = null;
            }
            const tail = this.stderrTail.trim().split('\n').slice(-3).join(' | ');
            this.emit('close', `monitor exited (${signal || `code ${code}`})${tail ? `: ${tail}` : ''}`);
        });
    }

    public close(): void {
        const child = this.child;
        this.child = null;
        if (child) {
            try {
                child.kill();
            } catch (err) {
                // already gone
            }
        }
    }

    public send(): void {
        // The child takes its configuration on the command line.
    }

    public describe(): { [key: string]: unknown } {
        return { transport: 'blinka', python: this.cfg.python, blinkaEnv: this.cfg.blinkaEnvText, pid: this.child ? this.child.pid : null };
    }
}

interface SerialPortLike extends EventEmitter {
    open(callback: (err: Error | null) => void): void;
    close(callback?: (err: Error | null) => void): void;
    write(data: string): boolean;
    isOpen: boolean;
}

class SerialTransport extends EventEmitter implements LineTransport {
    private port: SerialPortLike | null = null;

    private closed = false;

    private buffer = '';

    public constructor(private readonly path: string) {
        super();
    }

    public open(): void {
        let port: SerialPortLike;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
            const { SerialPort } = require('serialport');
            // USB CDC ignores the baud rate; 115200 for a UART adapter.
            port = new SerialPort({ path: this.path, baudRate: 115200, autoOpen: false }) as SerialPortLike;
        } catch (err) {
            setImmediate(() => this.emit('close', `serial port unavailable: ${(err as Error).message}`));
            return;
        }
        this.port = port;
        port.on('data', (chunk: Buffer) => {
            this.buffer += chunk.toString('utf8');
            if (this.buffer.length > 1 << 22) {
                this.buffer = '';
            }
            let newline = this.buffer.indexOf('\n');
            while (newline >= 0) {
                const line = this.buffer.slice(0, newline).trim();
                this.buffer = this.buffer.slice(newline + 1);
                if (line) {
                    this.emit('line', line);
                }
                newline = this.buffer.indexOf('\n');
            }
        });
        port.on('close', () => {
            if (this.port === port) {
                this.port = null;
            }
            this.emit('close', `serial port ${this.path} closed`);
        });
        port.on('error', (err: Error) => {
            log.warn(`vibration serial ${this.path}: ${err.message}`);
        });
        port.open((err: Error | null) => {
            if (this.closed || this.port !== port) {
                // close() ran while the port was still opening: release it
                // now, or it stays held and every later open is refused.
                if (!err && port.isOpen) {
                    port.close();
                }
                return;
            }
            if (err) {
                this.port = null;
                this.emit('close', `cannot open ${this.path}: ${err.message}`);
                return;
            }
            this.emit('opened');
        });
    }

    public close(): void {
        this.closed = true;
        const port = this.port;
        this.port = null;
        if (port && port.isOpen) {
            port.close();
        }
    }

    public send(line: string): void {
        if (this.port && this.port.isOpen) {
            this.port.write(`${line}\r\n`);
        }
    }

    public describe(): { [key: string]: unknown } {
        return { transport: 'serial', port: this.path, open: !!(this.port && this.port.isOpen) };
    }
}

export type FeedState = 'off' | 'unconfigured' | 'starting' | 'running' | 'retrying';

/** The resources the RUNNING probe feed holds (its settings change only at the next MCP start). */
function activeProbeLeases(): string[] {
    try {
        const status = probeFeedService.status() as { transport?: string; blinkaEnv?: unknown; channels?: { [channel: string]: unknown } };
        if (status.transport !== 'gpio' || typeof status.blinkaEnv !== 'string') {
            return [];
        }
        const env = parseEnvPairs(status.blinkaEnv);
        if (typeof env === 'string') {
            return [];
        }
        const pins = Object.values(status.channels || {})
            .filter((pin): pin is string => typeof pin === 'string')
            .map((pin) => pin.split(/[\s(:]/)[0]);
        return blinkaLeases(env, pins);
    } catch (err) {
        return [];
    }
}

/** One monitor: the Blinka process, or one serial board. */
class Link {
    public state: FeedState = 'starting';

    public lastError: string | null = null;

    public ready: { [key: string]: unknown } | null = null;

    public progress: { [key: string]: unknown } | null = null;

    public busy: number | null = null;

    public connectedAt: number | null = null;

    private transport: LineTransport | null = null;

    private stallTimer: NodeJS.Timeout | null = null;

    private readyTimer: NodeJS.Timeout | null = null;

    private retryTimer: NodeJS.Timeout | null = null;

    private configResentAt = 0;

    private attempt = 0;

    private stopped = false;

    public readonly spec: VibrationLink;

    private readonly cfg: VibrationConfig;

    private readonly streams: Map<string, SensorStream>;

    private readonly feed: VibrationFeedService;

    public constructor(spec: VibrationLink, cfg: VibrationConfig, streams: Map<string, SensorStream>, feed: VibrationFeedService) {
        this.spec = spec;
        this.cfg = cfg;
        this.streams = streams;
        this.feed = feed;
    }

    public start(): void {
        this.stopped = false;
        this.connect();
    }

    public stop(): void {
        this.stopped = true;
        this.clearTimers();
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        const transport = this.transport;
        this.transport = null;
        if (transport) {
            transport.removeAllListeners();
            transport.close();
        }
        this.state = 'off';
        this.connectedAt = null;
    }

    public describe(): { [key: string]: unknown } {
        return {
            id: this.spec.id,
            state: this.state,
            transport: this.transport ? this.transport.describe() : { transport: this.spec.transport, port: this.spec.port },
            sensors: this.spec.sensors.map((s) => s.id),
            last_error: this.lastError,
            connected_since: this.connectedAt ? new Date(this.connectedAt).toISOString() : null,
            board: this.ready ? this.ready.board : null,
            i2c_pins: this.ready ? this.ready.pins : (this.progress && this.progress.pins) || null,
            startup_progress: this.state === 'running' ? null : this.progress,
            bus_busy_fraction: this.busy,
        };
    }

    private monitorJson(): string {
        return JSON.stringify(monitorConfig(this.cfg, HEARTBEAT_MS, this.spec.sensors));
    }

    private connect(): void {
        this.state = this.attempt ? 'retrying' : 'starting';
        this.ready = null;
        this.progress = null;
        this.busy = null;
        const transport: LineTransport = this.spec.transport === 'serial'
            ? new SerialTransport(this.spec.port as string)
            : new ChildTransport(this.cfg, this.monitorJson());
        this.transport = transport;
        transport.on('line', (line: string) => this.onLine(line));
        transport.on('opened', () => this.sendConfig());
        transport.on('close', (reason: string) => this.onClose(reason));
        this.readyTimer = setTimeout(() => {
            this.onClose(`no ready line within ${READY_TIMEOUT_MS} ms (startup stage: ${JSON.stringify(this.progress)})`);
        }, READY_TIMEOUT_MS);
        transport.open();
    }

    private sendConfig(): void {
        if (this.transport) {
            this.configResentAt = Date.now();
            this.transport.send(this.monitorJson());
        }
    }

    private onClose(reason: string): void {
        if (!this.transport) {
            return;
        }
        const transport = this.transport;
        this.transport = null;
        transport.removeAllListeners();
        transport.close();
        this.clearTimers();
        this.lastError = reason;
        this.connectedAt = null;
        for (const sensor of this.spec.sensors) {
            const stream = this.streams.get(sensor.id);
            if (stream) {
                stream.lost();
            }
        }
        if (this.stopped) {
            return;
        }
        const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
        this.attempt++;
        this.state = 'retrying';
        log.warn(`vibration link ${this.spec.id} down (${reason}); retrying in ${delay} ms`);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (!this.stopped) {
                this.connect();
            }
        }, delay);
        if (typeof this.retryTimer.unref === 'function') {
            this.retryTimer.unref();
        }
    }

    private clearTimers(): void {
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
        if (this.readyTimer) {
            clearTimeout(this.readyTimer);
            this.readyTimer = null;
        }
    }

    private bumpStall(): void {
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
        }
        this.stallTimer = setTimeout(() => this.onClose(`monitor silent for ${STALL_MS} ms`), STALL_MS);
        if (typeof this.stallTimer.unref === 'function') {
            this.stallTimer.unref();
        }
    }

    private onLine(line: string): void {
        if (line[0] !== '{') {
            // CircuitPython's own console chatter ("Auto-reload...", "Code done running").
            return;
        }
        let msg: { [key: string]: unknown };
        try {
            msg = JSON.parse(line);
        } catch (err) {
            return;
        }
        if (this.state === 'running') {
            this.bumpStall();
        }
        switch (msg.t) {
            case 'progress':
                this.progress = msg;
                if (msg.stage === 'waiting-config' && Date.now() - this.configResentAt > 1500) {
                    this.sendConfig();
                }
                return;
            case 'ready':
                this.onReady(msg);
                return;
            case 'batch':
                this.onBatch(msg);
                return;
            case 'hb':
                this.busy = typeof msg.busy === 'number' ? msg.busy : null;
                if (msg.sensors && typeof msg.sensors === 'object') {
                    for (const [id, counters] of Object.entries(msg.sensors as { [id: string]: { [key: string]: unknown } })) {
                        const stream = this.streams.get(id);
                        if (stream) {
                            stream.counters = counters;
                            if (counters.state === 'ok' || counters.state === 'failed') {
                                stream.state = counters.state;
                            }
                        }
                    }
                }
                return;
            case 'warn': {
                const id = msg.id ? String(msg.id) : null;
                const error = String(msg.error || 'unknown');
                const stream = id ? this.streams.get(id) : null;
                if (stream) {
                    stream.error = error;
                    if (!/switching to one word per read|bad FIFO tag/.test(error)) {
                        stream.state = 'failed';
                    }
                }
                this.feed.warn(id, `${this.spec.id}: ${error}`);
                return;
            }
            case 'fatal':
                this.lastError = String(msg.error || 'fatal');
                this.feed.warn(null, `${this.spec.id}: fatal: ${this.lastError}`);
                break;
            default:
        }
    }

    private onReady(msg: { [key: string]: unknown }): void {
        if (this.readyTimer) {
            clearTimeout(this.readyTimer);
            this.readyTimer = null;
        }
        this.ready = msg;
        this.state = 'running';
        this.attempt = 0;
        this.lastError = null;
        this.connectedAt = Date.now();
        // A new monitor run for every sensor on this link: its first batch is a gap.
        for (const sensor of this.spec.sensors) {
            const stream = this.streams.get(sensor.id);
            if (stream) {
                stream.newRun();
            }
        }
        const described = Array.isArray(msg.sensors) ? msg.sensors as Array<{ [key: string]: unknown }> : [];
        for (const info of described) {
            const stream = this.streams.get(String(info.id));
            if (stream) {
                stream.info = info;
                stream.state = info.state === 'ok' ? 'ok' : 'failed';
                stream.error = info.error ? String(info.error) : null;
            }
        }
        log.info(`vibration link ${this.spec.id} ready on ${String(msg.board)} (${String(msg.pins)}): `
            + `${described.map((s) => `${String(s.id)}=${String(s.state)}`).join(', ')}`);
        this.bumpStall();
    }

    private onBatch(msg: { [key: string]: unknown }): void {
        const stream = this.streams.get(String(msg.id));
        if (!stream || !this.spec.sensors.some((s) => s.id === stream.spec.id)) {
            return;
        }
        let batch: MonitorBatch;
        try {
            batch = decodeBatch(msg);
        } catch (err) {
            stream.protocolErrors++;
            if (stream.protocolErrors <= 3 && err instanceof ProtocolError) {
                this.feed.warn(stream.spec.id, `malformed batch: ${err.message}`);
            }
            return;
        }
        const samples = stream.ingest(batch, Date.now());
        if (samples) {
            this.feed.emit('samples', stream.spec.id, samples.hostMs, samples.accel, samples.gyro, samples.gap);
        }
    }
}

/**
 * Events: 'samples' (sensorId, timesMs: Float64Array, accel: Float32Array,
 * gyro: Float32Array | null, gap: boolean) for every decoded batch;
 * 'reconfigured' when the settings changed and the streams were replaced.
 */
export class VibrationFeedService extends EventEmitter {
    private cfg: VibrationConfig | null = null;

    private state: FeedState = 'off';

    private lastError: string | null = null;

    private links: Link[] = [];

    private readonly streams = new Map<string, SensorStream>();

    private warnings: Array<{ at: number; id: string | null; error: string }> = [];

    /** (Re)read the settings and start, restart or stop to match them. */
    public reconfigure(): void {
        const hadStreams = this.streams.size > 0;
        this.shutdown();
        this.streams.clear();
        if (hadStreams) {
            this.emit('reconfigured');
        }
        const cfg = currentVibrationConfig();
        this.cfg = cfg;
        this.lastError = null;
        if (!cfg.enabled) {
            this.state = 'off';
            return;
        }
        const conflict = cfg.transport === 'blinka' ? leaseConflict(cfg.leases, activeProbeLeases(), 'the RUNNING probe feed') : null;
        if (conflict) {
            cfg.problems.push(conflict);
        }
        if (cfg.problems.length) {
            this.state = 'unconfigured';
            this.lastError = cfg.problems.join('; ');
            log.warn(`vibration feed not started: ${this.lastError}`);
            return;
        }
        for (const spec of cfg.sensors) {
            this.streams.set(spec.id, new SensorStream(spec, cfg.bufferS));
        }
        this.links = cfg.links.map((spec) => new Link(spec, cfg, this.streams, this));
        this.state = 'starting';
        this.links.forEach((link) => link.start());
    }

    public shutdown(): void {
        this.links.forEach((link) => link.stop());
        this.links = [];
        this.state = 'off';
    }

    /** Running when at least one link streams. */
    public isRunning(): boolean {
        return this.links.some((link) => link.state === 'running');
    }

    public config(): VibrationConfig {
        return this.cfg || currentVibrationConfig();
    }

    public runtime(id: string): SensorStream | null {
        return this.streams.get(id) || null;
    }

    public runtimes(): SensorStream[] {
        return [...this.streams.values()];
    }

    public warn(id: string | null, error: string): void {
        this.warnings.push({ at: Date.now(), id, error });
        if (this.warnings.length > 50) {
            this.warnings.splice(0, this.warnings.length - 50);
        }
        log.warn(`vibration monitor: ${id ? `${id}: ` : ''}${error}`);
    }

    private overallState(): FeedState {
        if (this.state === 'off' || this.state === 'unconfigured' || !this.links.length) {
            return this.state;
        }
        if (this.links.every((link) => link.state === 'running')) {
            return 'running';
        }
        return this.links.some((link) => link.state === 'retrying') ? 'retrying' : 'starting';
    }

    public status(): { [key: string]: unknown } {
        const cfg = this.config();
        const links = this.links.map((link) => link.describe());
        const linkErrors = links.filter((link) => link.last_error).map((link) => `${String(link.id)}: ${String(link.last_error)}`);
        return {
            enabled: cfg.enabled,
            state: this.overallState(),
            transport: cfg.transport,
            links,
            last_error: this.lastError || (linkErrors.length ? linkErrors.join('; ') : null),
            problems: cfg.problems,
            leases: cfg.leases,
            sensors: cfg.sensors.map((spec) => {
                const stream = this.streams.get(spec.id);
                const clock = stream ? stream.clockStats() : null;
                const jitter = stream && stream.resampler ? stream.resampler.jitter() : null;
                const span = stream && stream.ring ? stream.ring.span() : null;
                let rateSource: string | null = null;
                if (clock) {
                    rateSource = clock.rateSource;
                } else if (stream && stream.resampler) {
                    rateSource = 'poll-grid';
                }
                let link: string | null = 'blinka';
                if (cfg.transport === 'serial') {
                    link = spec.port || cfg.serialPorts[0] || null;
                }
                return {
                    id: spec.id,
                    location: spec.location,
                    link,
                    chip: spec.chip,
                    mode: spec.mode,
                    address: `0x${spec.address.toString(16)}`,
                    mux: spec.mux ? { address: `0x${spec.mux.address.toString(16)}`, channel: spec.mux.channel } : null,
                    configured_rate_hz: spec.rateHz,
                    range_g: spec.rangeG,
                    gyro: spec.gyro,
                    orientation: spec.orientation ? `x:${spec.orientation[0]},y:${spec.orientation[1]},z:${spec.orientation[2]}` : null,
                    note: spec.note,
                    state: stream ? stream.state : 'waiting',
                    error: stream ? stream.error : null,
                    chip_report: stream ? stream.info : null,
                    rate_hz: stream ? Math.round(stream.rateHz() * 1000) / 1000 : null,
                    rate_source: rateSource,
                    runs: stream ? stream.runs : 0,
                    gaps: stream ? stream.gaps : 0,
                    poll_jitter_ms: jitter ? { mean: Math.round(jitter.meanS * 10000) / 10, p95: Math.round(jitter.p95S * 10000) / 10 } : null,
                    samples: stream ? stream.samples : 0,
                    buffered_s: span ? Math.round((span.toMs - span.fromMs) / 100) / 10 : 0,
                    last_batch_age_ms: stream && stream.lastBatchAt ? Date.now() - stream.lastBatchAt : null,
                    monitor_counters: stream ? stream.counters : null,
                    protocol_errors: stream ? stream.protocolErrors : 0,
                };
            }),
            recent_warnings: this.warnings.slice(-10).map((w) => ({ at: new Date(w.at).toISOString(), sensor: w.id, error: w.error })),
        };
    }
}

export const vibrationFeedService = new VibrationFeedService();
