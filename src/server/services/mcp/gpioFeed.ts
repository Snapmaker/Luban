import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

import logger from '../../lib/logger';
import config from '../configstore';
import { recordSensorLatency } from './diagnostics';
import { PROBE_CHANNELS, ProbeChannel, ProbeTransport } from './probeTransport';
import { EMPTY_PROGRESS, MonitorProgress, describeReadyTimeout } from './probeFeedHealth';
import { BridgeResetResult, describeBridgeReset, resetStrandedBridges } from './usbBridgeReset';

const log = logger('service:mcp:gpio-feed');

// Direct-GPIO probe feed transport: the contact sensors are wired to pins
// read through Adafruit Blinka (the CircuitPython-on-CPython compatibility
// layer), by default via U2IF - a Raspberry Pi Pico acting as a USB GPIO
// bridge (BLINKA_U2IF=1). Blinka is Python, so this transport spawns a small
// monitor subprocess (embedded below, passed via `python -c`) that polls the
// pins and streams JSON lines on stdout; the Node side turns those into the
// same reading events the MQTT transport produces. Latency is the poll
// interval plus a USB round trip - single-digit milliseconds against MQTT's
// hardware-measured ~120-150 ms cloud trip.
//
// The monitor emits a 'reading' line only when a pin CHANGES, plus a 1 Hz
// heartbeat carrying every pin's current value. The heartbeat is both the
// liveness watchdog (a silent monitor is killed and the service reconnects)
// and a freshness refresh for the reading cache - unlike MQTT, "no message"
// here never has to be trusted to mean "unchanged".

interface FieldSpec {
    env: string;
    key: string;
}

const FIELDS: { [name: string]: FieldSpec } = {
    python: { env: 'LUBAN_MCP_GPIO_PYTHON', key: 'mcpGpioPython' },
    // Pin per channel: a Blinka board pin name with an optional pull suffix,
    // e.g. "GP6:up", "GP7:down", "GP8" or "GP8:float" (floating is default).
    toolsetter: { env: 'LUBAN_MCP_GPIO_PIN_TOOLSETTER', key: 'mcpGpioPinToolsetter' },
    overtravel: { env: 'LUBAN_MCP_GPIO_PIN_OVERTRAVEL', key: 'mcpGpioPinOvertravel' },
    probe: { env: 'LUBAN_MCP_GPIO_PIN_PROBE', key: 'mcpGpioPinProbe' },
    // Comma-separated channel names whose sensors idle HIGH and read low on
    // contact - same semantics as the MQTT `inverted` field.
    inverted: { env: 'LUBAN_MCP_GPIO_INVERTED', key: 'mcpGpioInverted' },
    pollMs: { env: 'LUBAN_MCP_GPIO_POLL_MS', key: 'mcpGpioPollMs' },
    // Environment handed to the monitor so Blinka picks the right board:
    // "BLINKA_U2IF=1" (default; Pico/KB2040 U2IF bridge), "BLINKA_MCP2221=1",
    // "BLINKA_FT232H=1", "BLINKA_FORCEBOARD=..." etc. - space/comma separated
    // NAME=VALUE pairs - or "native" for Blinka's own detection (Pi header).
    blinkaEnv: { env: 'LUBAN_MCP_GPIO_BLINKA_ENV', key: 'mcpGpioBlinkaEnv' },
};

export const DEFAULT_BLINKA_ENV = 'BLINKA_U2IF=1';

/**
 * Parse the Blinka environment field. Returns the env map, or a string
 * describing what is wrong with the text. "native"/"none" -> empty map.
 */
export function parseBlinkaEnv(text: string): { [name: string]: string } | string {
    const trimmed = text.trim();
    if (!trimmed || ['native', 'none', 'off'].includes(trimmed.toLowerCase())) {
        return {};
    }
    const env: { [name: string]: string } = {};
    for (const token of trimmed.split(/[\s,]+/).filter(Boolean)) {
        const match = token.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) {
            return `Blinka environment entry "${token}" is not NAME=VALUE`;
        }
        env[match[1]] = match[2];
    }
    return env;
}

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

export type GpioPull = 'up' | 'down' | 'float';

export interface GpioPinSpec {
    pin: string;
    pull: GpioPull;
}

export interface GpioFeedConfig {
    configured: boolean;
    missing: string[];
    python: string;
    /** As configured (or the default) - shown in status. */
    blinkaEnvText: string;
    /** Parsed NAME=VALUE pairs merged into the monitor's environment. */
    blinkaEnv: { [name: string]: string };
    pollMs: number;
    pins: { [channel in ProbeChannel]: GpioPinSpec | null };
    inverted: { [channel in ProbeChannel]: boolean };
    sources: { [field: string]: 'env' | 'config' | null };
}

const DEFAULT_POLL_MS = 10;
const HEARTBEAT_MS = 1000;

/** Human label for a pin binding, shown in status: "GP6 (pull-up)". */
export function describePin(spec: GpioPinSpec | null): string | null {
    if (!spec) {
        return null;
    }
    return spec.pull === 'float' ? spec.pin : `${spec.pin} (pull-${spec.pull})`;
}

/**
 * Resolve the GPIO feed configuration, environment first then configstore,
 * mirroring resolveProbeFeedConfig. Read fresh on every connect attempt.
 */
export function resolveGpioFeedConfig(): GpioFeedConfig {
    const sources: { [field: string]: 'env' | 'config' | null } = {};
    const raw: { [field: string]: string } = {};
    for (const name of Object.keys(FIELDS)) {
        const field = resolveField(name);
        raw[name] = field.value;
        sources[name] = field.source;
    }

    const missing: string[] = [];
    const pins = {} as { [channel in ProbeChannel]: GpioPinSpec | null };
    for (const channel of PROBE_CHANNELS) {
        const text = raw[channel];
        if (!text) {
            pins[channel] = null;
            continue;
        }
        const [pin, ...rest] = text.split(':').map((part) => part.trim());
        const pull = (rest.join(':') || 'float').toLowerCase();
        if (!pin || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(pin)) {
            missing.push(`${channel} pin "${text}" is not a Blinka pin name`);
            pins[channel] = null;
        } else if (pull !== 'up' && pull !== 'down' && pull !== 'float') {
            missing.push(`${channel} pin "${text}" pull must be up, down or float`);
            pins[channel] = null;
        } else {
            pins[channel] = { pin, pull: pull as GpioPull };
        }
    }
    if (!PROBE_CHANNELS.some((channel) => pins[channel])) {
        missing.push('at least one pin (LUBAN_MCP_GPIO_PIN_TOOLSETTER / _OVERTRAVEL / _PROBE)');
    }

    const invertedNames = raw.inverted.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
    const inverted = {} as { [channel in ProbeChannel]: boolean };
    for (const channel of PROBE_CHANNELS) {
        inverted[channel] = invertedNames.includes(channel);
    }

    const pollMs = Math.min(Math.max(Number(raw.pollMs) || DEFAULT_POLL_MS, 2), 1000);
    const blinkaEnvText = raw.blinkaEnv || DEFAULT_BLINKA_ENV;
    const parsedEnv = parseBlinkaEnv(blinkaEnvText);
    let blinkaEnv: { [name: string]: string } = {};
    if (typeof parsedEnv === 'string') {
        missing.push(parsedEnv);
    } else {
        blinkaEnv = parsedEnv;
    }

    return {
        configured: missing.length === 0,
        missing,
        python: raw.python || (process.platform === 'win32' ? 'python' : 'python3'),
        blinkaEnvText,
        blinkaEnv,
        pollMs,
        pins,
        inverted,
        sources,
    };
}

// The monitor subprocess. Plain Python 3, stdlib + Blinka only, config as a
// JSON argv - nothing here may contain a backtick or "${" (it lives in a TS
// template literal). Protocol: one JSON object per stdout line, "t" field is
// ready | reading | hb | fatal.
const MONITOR_SOURCE = `
import json
import sys
import time

def emit(obj):
    print(json.dumps(obj), flush=True)

def main():
    cfg = json.loads(sys.argv[1])
    try:
        import board
        import digitalio
    except Exception as err:
        emit({'t': 'fatal', 'error': 'Blinka import failed (pip install adafruit-blinka): %s' % err})
        return 1
    board_id = getattr(board, 'board_id', 'unknown')
    emit({'t': 'progress', 'stage': 'imported', 'board': board_id})
    lines = {}
    for channel, spec in cfg['pins'].items():
        name = spec['pin']
        if not hasattr(board, name):
            available = [n for n in dir(board) if not n.startswith('_')]
            emit({'t': 'fatal', 'error': 'board %s has no pin %s' % (board_id, name), 'available': available})
            return 1
        try:
            line = digitalio.DigitalInOut(getattr(board, name))
            line.direction = digitalio.Direction.INPUT
            pull = spec.get('pull', 'float')
            if pull == 'up':
                line.pull = digitalio.Pull.UP
            elif pull == 'down':
                line.pull = digitalio.Pull.DOWN
        except Exception as err:
            emit({'t': 'fatal', 'error': 'configuring %s (%s) failed: %s' % (name, channel, err)})
            return 1
        lines[channel] = line
        emit({'t': 'progress', 'stage': 'pin', 'channel': channel, 'pin': name})
    emit({'t': 'ready', 'board': board_id})
    poll_s = cfg['poll_ms'] / 1000.0
    hb_s = cfg['heartbeat_ms'] / 1000.0
    last = {}
    next_hb = 0.0
    while True:
        try:
            values = {}
            for channel, line in lines.items():
                value = '1' if line.value else '0'
                values[channel] = value
                if last.get(channel) != value:
                    last[channel] = value
                    # ts: wall clock at detection, so the server can measure
                    # the pipe latency (same host, same clock).
                    emit({'t': 'reading', 'channel': channel, 'value': value, 'ts': time.time()})
            now = time.monotonic()
            if now >= next_hb:
                next_hb = now + hb_s
                emit({'t': 'hb', 'values': values, 'ts': time.time()})
            time.sleep(poll_s)
        except Exception as err:
            emit({'t': 'fatal', 'error': 'read loop failed: %s' % err})
            return 1

sys.exit(main())
`;

const READY_TIMEOUT_MS = 30000; // first Blinka import + U2IF enumeration can be slow
const STALL_MS = HEARTBEAT_MS * 5;
const STDERR_TAIL_CHARS = 2000;

/**
 * ProbeTransport backend over the Blinka monitor subprocess. Events per the
 * ProbeTransport contract; a dead monitor (exit, stall, spawn failure) emits
 * 'close' and the ProbeFeedService's backoff builds a fresh instance.
 */
export class GpioProbeTransport extends EventEmitter implements ProbeTransport {
    private cfg: GpioFeedConfig;

    private child: ChildProcess | null = null;

    private lineBuffer = '';

    /** How far the current monitor got before it went quiet (describeReadyTimeout). */
    private progress: MonitorProgress = { ...EMPTY_PROGRESS };

    /** What the last automatic USB reset did, for the status. */
    private lastBridgeReset: BridgeResetResult | null = null;

    private stderrTail = '';

    private lastFatal: string | null = null;

    private boardId: string | null = null;

    private bridgeMissing = false;

    private stallTimer: NodeJS.Timeout | null = null;

    private ended = false;

    private ready = false;

    public constructor(cfg: GpioFeedConfig) {
        super();
        this.cfg = cfg;
    }

    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            let settled = false;
            let recovering = false;
            const settle = (err: Error | null) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            };
            // Whatever kills the transport before the ready line (stall
            // watchdog, ready timeout, spawn failure) must also settle the
            // connect promise - 'close' is the common exit of every path.
            this.once('close', () => {
                settle(new Error(`GPIO monitor closed before ready${this.detailSuffix()}`));
            });

            const pins: { [channel: string]: GpioPinSpec } = {};
            for (const channel of PROBE_CHANNELS) {
                const spec = this.cfg.pins[channel];
                if (spec) {
                    pins[channel] = spec;
                }
            }
            const monitorConfig = JSON.stringify({
                pins,
                poll_ms: this.cfg.pollMs,
                heartbeat_ms: HEARTBEAT_MS,
            });

            let child: ChildProcess;
            try {
                child = spawn(this.cfg.python, ['-u', '-c', MONITOR_SOURCE, monitorConfig], {
                    env: { ...process.env, ...this.cfg.blinkaEnv },
                    stdio: ['ignore', 'pipe', 'pipe'],
                    windowsHide: true,
                });
            } catch (err) {
                settle(new Error(`Failed to spawn "${this.cfg.python}": ${(err as Error).message}`));
                return;
            }
            this.child = child;

            this.progress = { ...EMPTY_PROGRESS };
            const readyTimer = setTimeout(async () => {
                let detail = describeReadyTimeout(
                    this.progress,
                    READY_TIMEOUT_MS,
                    this.cfg.python,
                    this.cfg.blinkaEnvText
                );
                // A monitor that got as far as loading the board and then
                // stalled on its first pin is the leaked-claim signature. Clear
                // it here rather than asking a human to walk over and replug
                // the board: USBDEVFS_RESET rebinds the kernel driver and needs
                // no root (the device node carries a plugdev ACL).
                if (this.progress.stage === 'imported' && !this.progress.pinsDone.length) {
                    // A live libusb monitor owns the HID interface as usbfs.
                    // Release that claim before checking for a stranded bridge,
                    // and defer close/reconnect until recovery has completed.
                    recovering = true;
                    const stopped = await this.stopChildForRecovery(child);
                    if (!this.ended && stopped) {
                        this.lastBridgeReset = await resetStrandedBridges(this.cfg.python);
                        detail += describeBridgeReset(this.lastBridgeReset);
                    } else if (!stopped) {
                        detail += ' USB reset skipped because the monitor did not exit.';
                    }
                }
                if (this.ended) {
                    settle(new Error('GPIO connection ended during startup recovery'));
                    return;
                }
                const err = new Error(detail);
                settle(err);
                this.fail(err);
            }, READY_TIMEOUT_MS);

            child.on('error', (err: Error) => {
                // Typically ENOENT: the python executable does not exist.
                clearTimeout(readyTimer);
                const wrapped = new Error(`GPIO monitor spawn failed ("${this.cfg.python}"): ${err.message}`);
                settle(wrapped);
                this.fail(wrapped);
            });

            if (child.stderr) {
                child.stderr.on('data', (chunk: Buffer) => {
                    this.stderrTail = (this.stderrTail + chunk.toString('utf8')).slice(-STDERR_TAIL_CHARS);
                });
            }

            if (child.stdout) {
                child.stdout.on('data', (chunk: Buffer) => {
                    this.bumpWatchdog();
                    this.lineBuffer += chunk.toString('utf8');
                    for (;;) {
                        const newline = this.lineBuffer.indexOf('\n');
                        if (newline < 0) {
                            return;
                        }
                        const line = this.lineBuffer.slice(0, newline).trim();
                        this.lineBuffer = this.lineBuffer.slice(newline + 1);
                        if (!line) {
                            continue;
                        }
                        let message: { t?: string; [key: string]: unknown };
                        try {
                            message = JSON.parse(line);
                        } catch (err) {
                            log.warn(`GPIO monitor emitted a non-JSON line: ${line}`);
                            continue;
                        }
                        this.onMonitorMessage(message, () => {
                            clearTimeout(readyTimer);
                            settle(null);
                        });
                    }
                });
            }

            child.on('exit', (code: number | null, signal: string | null) => {
                clearTimeout(readyTimer);
                if (this.stallTimer) {
                    clearTimeout(this.stallTimer);
                    this.stallTimer = null;
                }
                this.ready = false;
                if (this.child === child) {
                    this.child = null;
                }
                if (recovering) {
                    return;
                }
                const err = new Error(`GPIO monitor exited (${signal || `code ${code}`})${this.detailSuffix()}`);
                if (!settled) {
                    settle(err);
                }
                if (!this.ended) {
                    this.ended = true;
                    if (code !== 0) {
                        this.emit('error', err);
                    }
                    this.emit('close');
                }
            });
        });
    }

    public end(): void {
        this.ended = true;
        this.killChild();
    }

    public isConnected(): boolean {
        return this.ready && !!this.child && !this.ended;
    }

    public describe(): object {
        return {
            python: this.cfg.python,
            blinkaEnv: this.cfg.blinkaEnvText,
            pollMs: this.cfg.pollMs,
            board: this.boardId || this.progress.board,
            bridge: this.bridgeState(),
            monitorProgress: this.ready ? null : this.progress,
            lastBridgeReset: this.lastBridgeReset,
            monitorPid: this.child ? this.child.pid : null,
            configSources: this.cfg.sources,
        };
    }

    /** Channels with a pin configured, in the order the monitor walks them. */
    private pinChannels(): string[] {
        return PROBE_CHANNELS.filter((channel) => this.cfg.pins[channel]);
    }

    private firstPinChannel(): string | null {
        return this.pinChannels()[0] || null;
    }

    private nextPinChannel(done: string[]): string | null {
        return this.pinChannels().find((channel) => !done.includes(channel)) || null;
    }

    private onMonitorMessage(message: { t?: string; [key: string]: unknown }, onReady: () => void): void {
        if (message.t === 'progress') {
            // How far the monitor got. Only read when it never reaches ready,
            // and then it is the difference between "install Blinka" and
            // "replug the board".
            if (message.stage === 'imported') {
                this.progress = { stage: 'imported', board: String(message.board || 'unknown'), pinsDone: [], stuckOn: this.firstPinChannel() };
            } else if (message.stage === 'pin') {
                const done = [...this.progress.pinsDone, String(message.channel)];
                this.progress = {
                    stage: 'pin',
                    board: this.progress.board,
                    pinsDone: done,
                    stuckOn: this.nextPinChannel(done),
                };
            }
            return;
        }
        if (message.t === 'ready') {
            this.ready = true;
            this.bumpWatchdog();
            this.boardId = String(message.board || 'unknown');
            const bound = PROBE_CHANNELS
                .filter((channel) => this.cfg.pins[channel])
                .map((channel) => `${channel}=${describePin(this.cfg.pins[channel])}`);
            log.info(`GPIO monitor ready on board ${this.boardId} (pid ${this.child ? this.child.pid : '?'}, `
                + `python "${this.cfg.python}", env "${this.cfg.blinkaEnvText}"): ${bound.join(', ')}`);
            onReady();
            return;
        }
        if (message.t === 'reading') {
            const channel = String(message.channel) as ProbeChannel;
            if (PROBE_CHANNELS.includes(channel)) {
                // Monitor -> server pipe latency (diagnostics.ts): the monitor
                // stamps wall-clock seconds at detection.
                const sentAt = Number(message.ts) * 1000;
                const meta = Number.isFinite(sentAt) && sentAt > 0 ? { sentAt } : undefined;
                if (meta) {
                    recordSensorLatency(Math.max(0, Date.now() - sentAt));
                }
                this.emit('reading', channel, String(message.value), meta);
            }
            return;
        }
        if (message.t === 'hb') {
            const values = (message.values || {}) as { [channel: string]: string };
            for (const channel of PROBE_CHANNELS) {
                if (values[channel] !== undefined) {
                    this.emit('refresh', channel, String(values[channel]));
                }
            }
            return;
        }
        if (message.t === 'fatal') {
            const raw = String(message.error || 'unknown fatal error');
            // Blinka's wording when BLINKA_U2IF is set and no bridge is on USB,
            // or the device node vanished mid-session: the operator simply has
            // not plugged the sensor bridge in. Say that, not "import failed".
            if (/no compatible device found|open failed|No such device|device disconnected/i.test(raw)) {
                this.bridgeMissing = true;
                this.lastFatal = 'sensor bridge not detected on USB (U2IF board unplugged?) - '
                    + 'the feed will keep retrying quietly; plug it in or disable the sensors in Settings';
            } else {
                this.bridgeMissing = false;
                this.lastFatal = raw;
            }
            if (message.available) {
                this.lastFatal += ` - available pins: ${(message.available as string[]).join(', ')}`;
            }
            log.error(`GPIO monitor fatal: ${this.lastFatal}`);
            // The monitor exits right after a fatal line; the exit handler
            // carries this detail into the error/close events.
        }
    }

    /** After ready, stdout traffic proves liveness; startup has its own recovery deadline. */
    private bumpWatchdog(): void {
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
        }
        // Progress output can precede a stuck pin configuration. Do not let
        // the heartbeat deadline kill it before READY_TIMEOUT_MS can recover USB.
        if (this.ended || !this.ready) {
            return;
        }
        this.stallTimer = setTimeout(() => {
            this.fail(new Error(`GPIO monitor went silent for ${STALL_MS} ms (expected a ${HEARTBEAT_MS} ms `
                + 'heartbeat) - killing it'));
        }, STALL_MS);
    }

    /** Kill the monitor and report the transport dead so the service reconnects. */
    private fail(err: Error): void {
        if (this.ended) {
            return;
        }
        this.ended = true;
        this.ready = false;
        log.error(`GPIO probe transport failed: ${err.message}`);
        this.emit('error', err);
        this.killChild();
        this.emit('close');
    }

    /** Release our libusb claim before the reset helper inspects driver binding. */
    private async stopChildForRecovery(child: ChildProcess): Promise<boolean> {
        return new Promise((resolve) => {
            let forceTimer: NodeJS.Timeout;
            let exitTimer: NodeJS.Timeout;
            const onExit = () => {
                clearTimeout(forceTimer);
                clearTimeout(exitTimer);
                resolve(true);
            };
            forceTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
            exitTimer = setTimeout(() => {
                child.removeListener('exit', onExit);
                resolve(false);
            }, 5000);
            child.once('exit', onExit);
            this.killChild();
        });
    }

    private killChild(): void {
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
        if (this.child) {
            const child = this.child;
            this.child = null;
            try {
                child.kill();
            } catch (err) {
                // Already dead; nothing to do.
            }
        }
    }

    private bridgeState(): 'connected' | 'not detected' | 'unknown' {
        if (this.ready) {
            return 'connected';
        }
        return this.bridgeMissing ? 'not detected' : 'unknown';
    }

    private detailSuffix(): string {
        const detail = this.lastFatal || this.stderrTail.trim().split('\n').slice(-3).join(' | ');
        return detail ? `: ${detail}` : '';
    }
}
