/* eslint-disable camelcase */
// Results are returned to agents verbatim, so their fields are snake_case.
//
// Recordings of the accelerometer feed ("captures") and what is built on
// them: the per-sensor report (levels, tones, rotation, chatter, spatial
// periods, position profile, tilt against a baseline), the rotary chuck's
// absolute angle, and an automatic recording of every file job.
//
// A capture subscribes to the feed for its window (optionally reaching back
// into the look-back ring: "that noise just happened"), feeds each sensor's
// samples into a TrackBuilder (vibrationReport.ts) and writes the raw
// samples to disk - <userData>/mcp-vibration/<id>/<sensor>.f32, float32
// little-endian, interleaved ax ay az [gx gy gz] - with meta.json beside
// them, so a capture can be re-analysed over a sub-window, at another
// resolution, or after a restart, and opened offline (numpy.fromfile).
//
// Read-only with respect to the machine. The controller's reported B and
// machine status are recorded with each capture (for the rotary
// calibration); nothing here moves anything or writes the controller.

import path from 'path';
import * as fs from 'fs-extra';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import config from '../configstore';
import { connectionManager } from '../machine/ConnectionManager';
import { McpJob, jobManager } from './jobs';
import { parseSpindleProgram } from './spindleProgram';
import { RotaryCalibration, Vec3, angleSigmaDeg, rotaryAngle } from './rotaryGravity';
import { SensorSpec, toMachineFrame } from './vibrationConfig';
import { streamRate, vibrationFeedService } from './vibrationFeed';
import { SensorStream } from './vibrationStream';
import { ReportOptions, TrackBuilder, TrackData, angleBetweenDeg, buildReport, gravityStandardError, sampleAtTime } from './vibrationReport';
import { round } from './vibrationAnalysis';

const log = logger('service:mcp:vibration');

/** Bounds on what an agent may ask for (procedureLimits-style: named once, with the reason). */
export const VIBRATION_LIMITS = {
    /** A capture's own length: long enough for a slow axis pass, short enough that a waiting tool call returns. */
    captureS: { default: 10, min: 0.5, max: 600 },
    /** Seconds reached back into the ring: bounded by the ring itself (mcpVibrationBufferS). */
    lookbackS: { default: 0, min: 0, max: 900 },
    /** Welch resolution, Hz: 1 Hz separates a 133 Hz spindle line from a 124.5 Hz gantry comb with room to spare. */
    resolutionHz: { default: 1, min: 0.05, max: 20 },
    maxPeaks: { default: 8, min: 1, max: 40 },
    binMm: { default: 5, min: 0.5, max: 50 },
    spectrumPoints: { default: 0, min: 0, max: 600 },
    /** A rotary angle reading: a few seconds averages the noise to hundredths of a degree. */
    rotaryS: { default: 5, min: 4, max: 30 },
    /** A file job's automatic capture stops here whatever the job does. */
    jobCaptureS: 4 * 3600,
    /** Raw samples kept on disk per sensor per capture; the report keeps accumulating past it. */
    rawBytes: 256 * 1024 * 1024,
    /** Raw bytes all recording captures together may write (4 captures x 8 sensors could otherwise reach 8 GB). */
    activeRawBytes: 1024 * 1024 * 1024,
    /** A new capture is refused while the captures directory holds more than this. */
    diskBytes: 4 * 1024 * 1024 * 1024,
    /** Raw bytes queued behind a slow disk before the raw file stops (the report keeps accumulating). */
    writeBacklogBytes: 16 * 1024 * 1024,
    /** Re-analysis reads at most this many seconds of raw samples. */
    reanalyseS: 600,
    activeCaptures: 4,
    keptInMemory: 30,
};

export const ROTARY_CALIBRATION_KEY = 'mcpRotaryGravityCalibration';
/** A reading is still when the vibration (AC) RMS is below this, g, and the gyro (if any) below ROTARY_STILL_DPS. */
export const ROTARY_STILL_G = 0.02;
export const ROTARY_STILL_DPS = 0.5;
/** ...and gravity turned less than this between its first and last whole second (B at 600 deg/min would turn 30 deg in 3 s). */
export const ROTARY_STILL_DRIFT_DEG = 0.1;
/** Whole seconds a still reading needs (drift and standard error come from per-second means). */
export const ROTARY_MIN_SECONDS = 3;


export class VibrationError extends Error {
}

export function bounded(raw: unknown, limit: { default: number; min: number; max: number }): number {
    const value = Number(raw);
    if (raw === undefined || raw === null || !Number.isFinite(value)) {
        return limit.default;
    }
    return Math.min(Math.max(value, limit.min), limit.max);
}

interface ControllerSnapshot {
    at: string;
    b: number | null;
    machine_status: string | null;
    /** Age of the controller report the B came from, ms. */
    report_age_ms: number | null;
}

/**
 * The controller's last report, read raw: B and the status. Deliberately NOT
 * getPositionSnapshot(), which feeds the position-of-record judge and clears
 * it when the machine is disconnected - a recording must not change what
 * the motion tools believe.
 */
function controllerSnapshot(): ControllerSnapshot | null {
    try {
        if (!connectionManager.getConnectionStatus().connected) {
            return null;
        }
        const state = connectionManager.getLatestMachineState() as { pos?: { b?: unknown }; status?: string; timestamp?: number } | null;
        if (!state) {
            return null;
        }
        const b = Number(state.pos ? state.pos.b : NaN);
        return {
            at: new Date().toISOString(),
            b: Number.isFinite(b) ? b : null,
            machine_status: state.status || null,
            report_age_ms: typeof state.timestamp === 'number' ? Date.now() - state.timestamp : null,
        };
    } catch (err) {
        return null;
    }
}

function captureRoot(): string {
    return path.join(DataStorage.userDataDir, 'mcp-vibration');
}

/** Raw bytes the recording captures have written so far (the global budget). */
let activeRawBytes = 0;

/** Bytes under the captures directory (one level of capture folders). */
function captureDiskBytes(): number {
    let total = 0;
    try {
        for (const id of fs.readdirSync(captureRoot())) {
            const dir = path.join(captureRoot(), id);
            for (const file of fs.readdirSync(dir)) {
                total += fs.statSync(path.join(dir, file)).size;
            }
        }
    } catch (err) {
        // no directory yet, or a capture removed while counting
    }
    return total;
}

function rescale(data: TrackData, factor: number): TrackData {
    if (factor === 1) {
        return data;
    }
    const scalePsd = (psd: Float64Array) => psd.map((v) => v / factor);
    return {
        ...data,
        fs: data.fs * factor,
        df: data.df * factor,
        durationS: data.durationS / factor,
        psd: data.psd.map(scalePsd),
        gyroPsd: data.gyroPsd ? data.gyroPsd.map(scalePsd) : null,
        windowS: data.windowS / factor,
    };
}

class CaptureTrack {
    public readonly spec: SensorSpec;

    public readonly startRate: number;

    public readonly channels: number;

    public builder: TrackBuilder;

    public firstMs: number | null = null;

    public lastMs: number | null = null;

    public rawBytes = 0;

    public rawTruncated = false;

    public finalRate: number | null = null;

    public data: TrackData | null = null;

    /** [sample index, host ms] at the first sample, at every gap and about once a second: maps capture time to file position across outages. */
    public readonly index: Array<[number, number]> = [];

    /** Why the raw file stopped short, when it did. */
    public rawStopReason: string | null = null;

    /** Resolves when the raw file is flushed and closed. */
    public closed: Promise<void> = Promise.resolve();

    private out: fs.WriteStream | null = null;

    public constructor(spec: SensorSpec, rate: number, file: string, resolutionHz: number) {
        this.spec = spec;
        this.startRate = rate;
        // Gyro rides along whenever the sensor streams it, FIFO or poll.
        this.channels = spec.gyro ? 6 : 3;
        this.builder = new TrackBuilder(rate, this.channels === 6, resolutionHz);
        try {
            // Asynchronous writes: the event loop also serves the probe
            // tripwires and job polls, and must never wait on the disk.
            this.out = fs.createWriteStream(file);
            this.out.on('error', (err: Error) => {
                log.warn(`vibration: raw write to ${file} failed: ${err.message}`);
                this.stopRaw(`write failed: ${err.message}`);
            });
        } catch (err) {
            log.warn(`vibration: cannot write ${file}: ${(err as Error).message}`);
            this.out = null;
            this.rawStopReason = `cannot open: ${(err as Error).message}`;
        }
    }

    /** Stop the raw file for good (the report keeps accumulating); a gap in the file would misplace every later sample. */
    private stopRaw(reason: string): void {
        if (!this.rawTruncated) {
            this.rawTruncated = true;
            this.rawStopReason = reason;
        }
    }

    public push(times: Float64Array, accel: Float32Array, gyro: Float32Array | null, gap: boolean): void {
        const n = times.length;
        if (!n) {
            return;
        }
        if (gap) {
            this.builder.gaps++;
        }
        const at = this.builder.samples;
        const last = this.index[this.index.length - 1];
        if (!last || gap || times[0] - last[1] >= 1000) {
            this.index.push([at, times[0]]);
        }
        if (this.firstMs === null) {
            this.firstMs = times[0];
        }
        this.lastMs = times[n - 1];
        this.builder.push(accel, n, this.channels === 6 ? gyro : null);
        if (this.out === null || this.rawTruncated) {
            return;
        }
        const frame = new Float32Array(n * this.channels);
        for (let i = 0; i < n; i++) {
            frame[i * this.channels] = accel[i * 3];
            frame[i * this.channels + 1] = accel[i * 3 + 1];
            frame[i * this.channels + 2] = accel[i * 3 + 2];
            if (this.channels === 6 && gyro) {
                frame[i * 6 + 3] = gyro[i * 3];
                frame[i * 6 + 4] = gyro[i * 3 + 1];
                frame[i * 6 + 5] = gyro[i * 3 + 2];
            }
        }
        const bytes = Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
        if (this.rawBytes + bytes.length > VIBRATION_LIMITS.rawBytes) {
            this.stopRaw(`per-sensor raw limit ${VIBRATION_LIMITS.rawBytes / 1048576} MB reached`);
            return;
        }
        if (activeRawBytes + bytes.length > VIBRATION_LIMITS.activeRawBytes) {
            this.stopRaw(`all recording captures together reached ${VIBRATION_LIMITS.activeRawBytes / 1048576} MB of raw samples`);
            return;
        }
        if (this.out.writableLength > VIBRATION_LIMITS.writeBacklogBytes) {
            this.stopRaw(`the disk fell ${Math.round(this.out.writableLength / 1048576)} MB behind`);
            return;
        }
        this.out.write(bytes);
        this.rawBytes += bytes.length;
        activeRawBytes += bytes.length;
    }

    public finish(rt: SensorStream | null): void {
        activeRawBytes = Math.max(0, activeRawBytes - this.rawBytes);
        if (this.out !== null) {
            const out = this.out;
            this.out = null;
            this.closed = new Promise<void>((resolve) => {
                out.once('close', () => resolve());
                out.once('error', () => resolve());
                out.end();
            });
        }
        // The clock keeps refining the rate while it streams; scale the
        // frequency axis to the best estimate at the end (density rescaled
        // so the integrals keep their meaning).
        const best = rt ? streamRate(rt) : this.startRate;
        this.finalRate = Math.abs(best / this.startRate - 1) < 0.02 ? best : this.startRate;
        this.data = rescale(this.builder.data(), this.finalRate / this.startRate);
    }
}

export interface CaptureSensorMeta {
    spec: SensorSpec;
    sample_rate_hz: number | null;
    samples: number;
    channels: number;
    raw_file: string;
    raw_bytes: number;
    raw_truncated: boolean;
    raw_stop_reason: string | null;
    gaps: number;
    first_ms: number | null;
    last_ms: number | null;
    /** [sample index, host ms] pairs; windows are mapped through them. */
    index: Array<[number, number]>;
}

export interface CaptureMeta {
    id: string;
    label: string | null;
    created_at: string;
    state: 'recording' | 'done' | 'stopped' | 'failed';
    stop_reason: string | null;
    job_id: string | null;
    window: { start: string; end: string | null; lookback_s: number; requested_s: number | null };
    controller_at_start: ControllerSnapshot | null;
    controller_at_end: ControllerSnapshot | null;
    sensors: { [id: string]: CaptureSensorMeta };
    rpm_hint: { min: number; max: number } | null;
}

type SamplesListener = (id: string, times: Float64Array, accel: Float32Array, gyro: Float32Array | null, gap: boolean) => void;

interface CaptureOptions {
    label: string | null;
    durationS: number | null;
    lookbackS: number;
    jobId: string | null;
    resolutionHz: number;
}

export class Capture {
    public readonly id: string;

    public readonly dir: string;

    public meta: CaptureMeta;

    public readonly tracks = new Map<string, CaptureTrack>();

    private timer: NodeJS.Timeout | null = null;

    private waiters: Array<() => void> = [];

    private readonly listener: SamplesListener;

    private readonly windowStartMs: number;

    public constructor(id: string, sensors: SensorSpec[], opts: CaptureOptions) {
        this.id = id;
        this.dir = path.join(captureRoot(), id);
        fs.ensureDirSync(this.dir);
        const now = Date.now();
        this.windowStartMs = now - opts.lookbackS * 1000;
        this.meta = {
            id,
            label: opts.label,
            created_at: new Date(now).toISOString(),
            state: 'recording',
            stop_reason: null,
            job_id: opts.jobId,
            window: { start: new Date(this.windowStartMs).toISOString(), end: null, lookback_s: opts.lookbackS, requested_s: opts.durationS },
            controller_at_start: controllerSnapshot(),
            controller_at_end: null,
            sensors: {},
            rpm_hint: null,
        };
        for (const spec of sensors) {
            const rt = vibrationFeedService.runtime(spec.id);
            const rate = rt ? streamRate(rt) : spec.rateHz;
            const track = new CaptureTrack(spec, rate, path.join(this.dir, `${spec.id}.f32`), opts.resolutionHz);
            this.tracks.set(spec.id, track);
            // The ring is pushed and emitted synchronously together, so this
            // slice and the live batches after the subscription never overlap.
            if (rt && rt.ring && opts.lookbackS > 0) {
                const back = rt.ring.slice(this.windowStartMs, now + 1);
                track.push(back.times, back.accel, back.gyro, false);
            }
        }
        this.listener = (sensorId, times, accel, gyro, gap) => {
            const track = this.tracks.get(sensorId);
            if (track) {
                track.push(times, accel, gyro, gap);
            }
        };
        vibrationFeedService.on('samples', this.listener);
        // On disk from the start, so a capture cut short by a crash is still listed.
        this.writeMeta();
        const length = opts.durationS === null ? VIBRATION_LIMITS.jobCaptureS : opts.durationS;
        this.timer = setTimeout(() => this.finish('done', null), length * 1000);
        if (typeof this.timer.unref === 'function') {
            this.timer.unref();
        }
    }

    public get recording(): boolean {
        return this.meta.state === 'recording';
    }

    public finish(state: 'done' | 'stopped' | 'failed', reason: string | null): void {
        if (!this.recording) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        vibrationFeedService.removeListener('samples', this.listener);
        this.meta.state = state;
        this.meta.stop_reason = reason;
        this.meta.window.end = new Date().toISOString();
        this.meta.controller_at_end = controllerSnapshot();
        for (const [id, track] of this.tracks) {
            track.finish(vibrationFeedService.runtime(id));
            this.meta.sensors[id] = {
                spec: track.spec,
                sample_rate_hz: track.finalRate,
                samples: track.builder.samples,
                channels: track.channels,
                raw_file: path.join(this.dir, `${id}.f32`),
                raw_bytes: track.rawBytes,
                raw_truncated: track.rawTruncated,
                raw_stop_reason: track.rawStopReason,
                gaps: track.builder.gaps,
                first_ms: track.firstMs,
                last_ms: track.lastMs,
                index: track.index,
            };
        }
        this.writeMeta();
        const waiters = this.waiters;
        this.waiters = [];
        waiters.forEach((resolve) => resolve());
    }

    public writeMeta(): void {
        try {
            fs.writeJsonSync(path.join(this.dir, 'meta.json'), this.meta, { spaces: 1 });
        } catch (err) {
            log.warn(`vibration: cannot write meta for ${this.id}: ${(err as Error).message}`);
        }
    }

    /** Resolve when the capture ends or after `ms`. */
    public async wait(ms: number): Promise<void> {
        if (!this.recording || ms <= 0) {
            return;
        }
        await new Promise<void>((resolve) => {
            let timer: NodeJS.Timeout | null = null;
            const waiter = () => {
                if (timer) {
                    clearTimeout(timer);
                }
                resolve();
            };
            timer = setTimeout(() => {
                this.waiters = this.waiters.filter((w) => w !== waiter);
                resolve();
            }, ms);
            this.waiters.push(waiter);
        });
    }
}

function newId(): string {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
    return `${stamp}-${Math.random().toString(16).slice(2, 8)}`;
}

/** Machine-frame shares of a tone's power by a sensor's orientation (signs do not matter for power). */
function machineShares(orientation: SensorSpec['orientation'], share: unknown): { x: number; y: number; z: number } | null {
    if (!orientation || !Array.isArray(share) || share.length !== 3) {
        return null;
    }
    const out = { x: 0, y: 0, z: 0 };
    orientation.forEach((axis, i) => {
        out[axis[1] as 'x' | 'y' | 'z'] += Number(share[i]);
    });
    return out;
}

/** Add the machine-frame view (when the sensor's orientation is known) to a report. */
function withMachineFrame(spec: SensorSpec, report: { [key: string]: unknown }): { [key: string]: unknown } {
    if (!spec.orientation) {
        report.frame_note = 'axes are the SENSOR\'s: state the sensor\'s orientation (orientation "x:+y,y:-x,z:+z") to get machine axes';
        return report;
    }
    const mapPeaks = (peaks: unknown) => (Array.isArray(peaks)
        ? peaks.map((p: { axis_share?: unknown }) => ({ ...p, axis_share_machine: machineShares(spec.orientation, p.axis_share) }))
        : peaks);
    report.peaks = mapPeaks(report.peaks);
    const gravity = report.gravity as { mean_g: number[] } | undefined;
    if (gravity) {
        (gravity as { [key: string]: unknown }).mean_machine_g = toMachineFrame(spec.orientation, gravity.mean_g as [number, number, number]);
    }
    const rotation = report.rotation as { non_harmonic_peaks?: unknown } | undefined;
    if (rotation && rotation.non_harmonic_peaks) {
        rotation.non_harmonic_peaks = mapPeaks(rotation.non_harmonic_peaks);
    }
    return report;
}

export interface AnalyseArgs {
    sensor?: string;
    from_s?: number;
    to_s?: number;
    resolution_hz?: number;
    max_peaks?: number;
    min_prominence_db?: number;
    rpm_min?: number;
    rpm_max?: number;
    rpm_hint?: number;
    flutes?: number;
    motion?: {
        axis?: string;
        feed_mm_min?: number;
        legs?: Array<{ from?: number; to?: number }>;
        targets?: number[];
        bin_mm?: number;
        references_mm?: { [name: string]: number };
    };
    baseline_capture_id?: string;
    lever_mm?: number;
    spectrum_points?: number;
}

function motionOptions(motion: NonNullable<AnalyseArgs['motion']>): ReportOptions['motion'] {
    const feed = Number(motion.feed_mm_min);
    if (!(feed > 0)) {
        throw new VibrationError('motion.feed_mm_min is required (the feed the axis moved at, mm/min): a spatial period is frequency / speed');
    }
    let legs: Array<{ from: number; to: number }> | undefined;
    if (Array.isArray(motion.targets) && motion.targets.length >= 2) {
        legs = [];
        for (let i = 0; i + 1 < motion.targets.length; i++) {
            legs.push({ from: Number(motion.targets[i]), to: Number(motion.targets[i + 1]) });
        }
    } else if (Array.isArray(motion.legs)) {
        legs = motion.legs.map((leg) => ({ from: Number(leg.from), to: Number(leg.to) }));
    }
    if (legs && legs.some((leg) => !Number.isFinite(leg.from) || !Number.isFinite(leg.to) || leg.from === leg.to)) {
        throw new VibrationError('motion legs need distinct finite from/to machine coordinates');
    }
    const references: { [name: string]: number } = {};
    for (const [name, length] of Object.entries(motion.references_mm || {})) {
        if (Number(length) > 0) {
            references[name] = Number(length);
        }
    }
    return {
        axis: String(motion.axis || 'unstated'),
        feedMmMin: feed,
        legs,
        binMm: bounded(motion.bin_mm, VIBRATION_LIMITS.binMm),
        references,
    };
}

export interface GravityReading {
    g: Vec3;
    standardErrorG: number | null;
    acRmsG: number;
    gyroRmsDps: number | null;
    driftDeg: number | null;
    still: boolean;
    /** Why it is not still (empty when it is). */
    notStill: string[];
    samples: number;
}

export interface TrackResult {
    data: TrackData;
    spec: SensorSpec;
    source: 'memory' | 'raw';
}

export interface StartOptions {
    sensors?: string[];
    durationS: number | null;
    lookbackS?: number;
    label?: string | null;
    jobId?: string | null;
    resolutionHz?: number;
}

export class VibrationCaptureService {
    private readonly captures = new Map<string, Capture>();

    private readonly jobCaptures = new Map<string, string>();

    /** Finished job summaries: get_gcode_job_status is long-polled, the analysis is done once. */
    private readonly jobSummaries = new Map<string, { [key: string]: unknown }>();

    private jobWatch: NodeJS.Timeout | null = null;

    public constructor() {
        // New settings replace the streams (rates, sensors, links): a capture
        // cannot continue across that, so it ends with the reason.
        vibrationFeedService.on('reconfigured', () => {
            for (const capture of this.active()) {
                capture.finish('stopped', 'accelerometer settings changed (the feed restarted with a new configuration)');
            }
        });
    }

    public active(): Capture[] {
        return [...this.captures.values()].filter((c) => c.recording);
    }

    /** Start a capture of `sensorIds` (all streaming sensors when empty). */
    public start(opts: StartOptions): Capture {
        if (!vibrationFeedService.isRunning()) {
            const status = vibrationFeedService.status();
            throw new VibrationError(`the accelerometer feed is not running (state ${String(status.state)}${status.last_error ? `: ${String(status.last_error)}` : ''}). `
                + 'Enable and configure it in Settings -> MCP Server -> Accelerometers; get_vibration_status says what is missing.');
        }
        if (this.active().length >= VIBRATION_LIMITS.activeCaptures) {
            throw new VibrationError(`${VIBRATION_LIMITS.activeCaptures} captures are already recording; stop one first (stop_vibration_capture).`);
        }
        const cfg = vibrationFeedService.config();
        let specs = cfg.sensors;
        if (opts.sensors && opts.sensors.length) {
            const unknown = opts.sensors.filter((id) => !cfg.sensors.some((s) => s.id === id));
            if (unknown.length) {
                throw new VibrationError(`unknown sensor(s) ${unknown.join(', ')}; configured: ${cfg.sensors.map((s) => s.id).join(', ')}`);
            }
            specs = cfg.sensors.filter((s) => (opts.sensors as string[]).includes(s.id));
        }
        const streaming = specs.filter((s) => {
            const rt = vibrationFeedService.runtime(s.id);
            return rt && rt.state === 'ok';
        });
        if (!streaming.length) {
            throw new VibrationError(`none of ${specs.map((s) => s.id).join(', ')} is streaming (see get_vibration_status for each sensor's error)`);
        }
        const onDisk = captureDiskBytes();
        if (onDisk > VIBRATION_LIMITS.diskBytes) {
            throw new VibrationError(`the captures directory ${captureRoot()} holds ${Math.round(onDisk / 1048576)} MB (budget `
                + `${VIBRATION_LIMITS.diskBytes / 1048576} MB): the operator archives or deletes old captures there before recording more `
                + '(nothing is deleted automatically)');
        }
        const lookbackS = Math.min(bounded(opts.lookbackS, VIBRATION_LIMITS.lookbackS), cfg.bufferS);
        const capture = new Capture(newId(), streaming, {
            label: opts.label || null,
            durationS: opts.durationS,
            lookbackS,
            jobId: opts.jobId || null,
            resolutionHz: bounded(opts.resolutionHz, VIBRATION_LIMITS.resolutionHz),
        });
        this.captures.set(capture.id, capture);
        this.prune();
        return capture;
    }

    public stop(id: string, reason: string): Capture {
        const capture = this.captures.get(id);
        if (!capture) {
            throw new VibrationError(`no capture ${id} is held in memory`);
        }
        capture.finish('stopped', reason);
        return capture;
    }

    public get(id: string): Capture | null {
        return this.captures.get(id) || null;
    }

    /** Captures in memory, and the ones on disk from earlier sessions. */
    public list(limit: number): object[] {
        const seen = new Set<string>();
        const rows: Array<{ [key: string]: unknown }> = [];
        for (const capture of this.captures.values()) {
            seen.add(capture.id);
            rows.push(this.describe(capture.meta));
        }
        try {
            for (const id of fs.readdirSync(captureRoot())) {
                if (seen.has(id)) {
                    continue;
                }
                const meta = this.readMeta(id);
                if (meta) {
                    rows.push(this.describe(meta));
                }
            }
        } catch (err) {
            // no captures directory yet
        }
        rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return rows.slice(0, limit);
    }

    public describe(meta: CaptureMeta): { [key: string]: unknown } {
        return {
            capture_id: meta.id,
            label: meta.label,
            created_at: meta.created_at,
            state: meta.state,
            stop_reason: meta.stop_reason,
            job_id: meta.job_id,
            window: meta.window,
            sensors: Object.keys(meta.sensors).length ? Object.keys(meta.sensors) : null,
            controller_b_at_start: meta.controller_at_start ? meta.controller_at_start.b : null,
            controller_b_at_end: meta.controller_at_end ? meta.controller_at_end.b : null,
            directory: path.join(captureRoot(), meta.id),
        };
    }

    private readMeta(id: string): CaptureMeta | null {
        if (!/^[0-9TZ]+-[0-9a-f]+$/.test(id)) {
            return null;
        }
        try {
            return fs.readJsonSync(path.join(captureRoot(), id, 'meta.json')) as CaptureMeta;
        } catch (err) {
            return null;
        }
    }

    /** A finished capture's meta, in memory or on disk. */
    public meta(id: string): CaptureMeta {
        const capture = this.captures.get(id);
        if (capture) {
            return capture.meta;
        }
        const meta = this.readMeta(id);
        if (!meta) {
            throw new VibrationError(`unknown capture_id ${id} (list_vibration_captures lists them)`);
        }
        return meta;
    }

    /** TrackData for one sensor of a capture, over a window, at a resolution: from memory when it matches, else rebuilt from the raw file. */
    public async trackData(id: string, sensorId: string, window: { fromS?: number; toS?: number; resolutionHz?: number } = {}): Promise<TrackResult> {
        const capture = this.captures.get(id);
        if (capture && capture.recording) {
            throw new VibrationError(`capture ${id} is still recording; wait for it (get_vibration_capture wait_ms) or stop it`);
        }
        const meta = this.meta(id);
        const sensor = meta.sensors[sensorId];
        if (!sensor) {
            throw new VibrationError(`capture ${id} has no sensor ${sensorId} (it has ${Object.keys(meta.sensors).join(', ') || 'none'})`);
        }
        const whole = window.fromS === undefined && window.toS === undefined && window.resolutionHz === undefined;
        const track = capture ? capture.tracks.get(sensorId) : null;
        if (whole && track && track.data) {
            return { data: track.data, spec: sensor.spec, source: 'memory' };
        }
        if (track) {
            await track.closed;
        }
        const rate = sensor.sample_rate_hz || sensor.spec.rateHz;
        const frameBytes = sensor.channels * 4;
        const fileSamples = Math.floor(sensor.raw_bytes / frameBytes);
        // Seconds from the capture's window start -> file position, through
        // the index, so an outage inside the capture does not shift a window.
        const startMs = Date.parse(meta.window.start);
        const toSample = (seconds: number): number => sampleAtTime(sensor.index || [], rate, startMs + seconds * 1000);
        const from = Math.max(0, window.fromS === undefined ? 0 : toSample(window.fromS));
        const to = Math.min(fileSamples, window.toS === undefined ? fileSamples : toSample(window.toS));
        if (to - from < 16) {
            throw new VibrationError(`the window holds ${Math.max(0, to - from)} samples of ${sensorId} `
                + `(the raw file holds ${fileSamples} at ${round(rate, 2)} Hz)`);
        }
        if ((to - from) / rate > VIBRATION_LIMITS.reanalyseS) {
            throw new VibrationError(`re-analysis is limited to ${VIBRATION_LIMITS.reanalyseS} s of samples; narrow from_s/to_s`);
        }
        const builder = new TrackBuilder(rate, sensor.channels === 6, bounded(window.resolutionHz, VIBRATION_LIMITS.resolutionHz));
        const fd = fs.openSync(sensor.raw_file, 'r');
        try {
            const chunk = 8192;
            for (let at = from; at < to; at += chunk) {
                const count = Math.min(chunk, to - at);
                const buf = Buffer.alloc(count * frameBytes);
                fs.readSync(fd, buf, 0, buf.length, at * frameBytes);
                const frames = new Float32Array(buf.buffer, buf.byteOffset, count * sensor.channels);
                const accel = new Float32Array(count * 3);
                const gyro = sensor.channels === 6 ? new Float32Array(count * 3) : null;
                for (let i = 0; i < count; i++) {
                    accel[i * 3] = frames[i * sensor.channels];
                    accel[i * 3 + 1] = frames[i * sensor.channels + 1];
                    accel[i * 3 + 2] = frames[i * sensor.channels + 2];
                    if (gyro) {
                        gyro[i * 3] = frames[i * 6 + 3];
                        gyro[i * 3 + 1] = frames[i * 6 + 4];
                        gyro[i * 3 + 2] = frames[i * 6 + 5];
                    }
                }
                builder.push(accel, count, gyro);
                // Long re-analyses must not hold the event loop (probe trips, job polls).
                await new Promise<void>((resolve) => setImmediate(resolve));
            }
        } finally {
            fs.closeSync(fd);
        }
        builder.gaps = sensor.gaps;
        return { data: builder.data(), spec: sensor.spec, source: 'raw' };
    }

    /** The report for every (or one) sensor of a finished capture. */
    public async analyse(id: string, args: AnalyseArgs): Promise<{ [key: string]: unknown }> {
        const meta = this.meta(id);
        const sensorIds = args.sensor ? [args.sensor] : Object.keys(meta.sensors);
        const out: { [key: string]: unknown } = {};
        const windowed = args.from_s !== undefined || args.to_s !== undefined || args.resolution_hz !== undefined;
        for (const sensorId of sensorIds) {
            const window = windowed ? { fromS: args.from_s, toS: args.to_s, resolutionHz: args.resolution_hz } : {};
            const { data, spec, source } = await this.trackData(id, sensorId, window);
            const opts: ReportOptions = {
                maxPeaks: bounded(args.max_peaks, VIBRATION_LIMITS.maxPeaks),
                minProminenceDb: args.min_prominence_db,
                rpmMin: args.rpm_min,
                rpmMax: args.rpm_max,
                rpmHint: args.rpm_hint,
                flutes: args.flutes,
                leverMm: args.lever_mm,
                spectrumPoints: bounded(args.spectrum_points, VIBRATION_LIMITS.spectrumPoints),
            };
            if ((opts.rpmMin === undefined || opts.rpmMax === undefined) && !opts.rpmHint && meta.rpm_hint) {
                opts.rpmMin = meta.rpm_hint.min;
                opts.rpmMax = meta.rpm_hint.max;
            }
            if (args.motion) {
                opts.motion = motionOptions(args.motion);
            }
            if (args.baseline_capture_id) {
                opts.baseline = (await this.trackData(args.baseline_capture_id, sensorId)).data;
            }
            const report = withMachineFrame(spec, buildReport(data, opts));
            out[sensorId] = { location: spec.location, chip: spec.chip, mode: spec.mode, data_source: source, ...report };
        }
        return out;
    }

    // ---------------------------------------------------------------- rotary

    public rotaryCalibration(): { [key: string]: unknown } | null {
        const raw = config.get(ROTARY_CALIBRATION_KEY);
        if (!raw) {
            return null;
        }
        try {
            return (typeof raw === 'string' ? JSON.parse(raw) : raw) as { [key: string]: unknown };
        } catch (err) {
            return null;
        }
    }

    /** The still gravity reading of one sensor in a finished capture, with its quality. */
    public async gravityReading(id: string, sensorId: string): Promise<GravityReading> {
        const { data } = await this.trackData(id, sensorId);
        const se = gravityStandardError(data.secondMeans);
        // Time domain, all frequencies: a slow B rotation is far below any
        // spectral band but moves the mean - the drift catches it.
        const means = data.secondMeans;
        const driftDeg = means.length >= 2 ? angleBetweenDeg(means[0], means[means.length - 1]) : null;
        const reasons: string[] = [];
        if (means.length < ROTARY_MIN_SECONDS) {
            reasons.push(`only ${means.length} whole second(s) of data (need ${ROTARY_MIN_SECONDS})`);
        }
        if (data.acRmsG >= ROTARY_STILL_G) {
            reasons.push(`vibration ${round(data.acRmsG, 4)} g RMS (limit ${ROTARY_STILL_G})`);
        }
        if (driftDeg !== null && driftDeg >= ROTARY_STILL_DRIFT_DEG) {
            reasons.push(`gravity turned ${round(driftDeg, 3)} deg during the reading (limit ${ROTARY_STILL_DRIFT_DEG})`);
        }
        if (data.gyroRmsDps !== null && data.gyroRmsDps >= ROTARY_STILL_DPS) {
            reasons.push(`gyro ${round(data.gyroRmsDps, 2)} dps RMS about its bias (limit ${ROTARY_STILL_DPS})`);
        }
        return {
            g: data.gravity,
            standardErrorG: se ? Math.sqrt(se[0] ** 2 + se[1] ** 2 + se[2] ** 2) : null,
            acRmsG: data.acRmsG,
            gyroRmsDps: data.gyroRmsDps,
            driftDeg,
            still: reasons.length === 0,
            notStill: reasons,
            samples: data.samples,
        };
    }

    /** Absolute angle of the chuck from a finished rotary capture. */
    public async rotaryReading(id: string, sensorId: string): Promise<{ [key: string]: unknown }> {
        const meta = this.meta(id);
        const reading = await this.gravityReading(id, sensorId);
        const stored = this.rotaryCalibration();
        const startB = meta.controller_at_start ? meta.controller_at_start.b : null;
        const endB = meta.controller_at_end ? meta.controller_at_end.b : null;
        const out: { [key: string]: unknown } = {
            capture_id: id,
            sensor: sensorId,
            gravity_g: reading.g.map((v) => round(v, 5)),
            still: reading.still,
            vibration_rms_g: round(reading.acRmsG, 5),
            gyro_rms_dps: reading.gyroRmsDps === null ? null : round(reading.gyroRmsDps, 3),
            drift_deg: reading.driftDeg === null ? null : round(reading.driftDeg, 4),
            controller: {
                b_at_start: startB,
                b_at_end: endB,
                machine_status: meta.controller_at_end ? meta.controller_at_end.machine_status : null,
                report_age_ms: meta.controller_at_end ? meta.controller_at_end.report_age_ms : null,
                b_moved_during_reading: startB !== null && endB !== null && Math.abs(startB - endB) > 0.01,
            },
        };
        if (!reading.still) {
            out.warning = `not still (${reading.notStill.join('; ')}): the angle is only meaningful with B stopped and the spindle off`;
        }
        if (!stored || stored.sensor_id !== sensorId || !stored.calibration) {
            out.calibration = null;
            out.note = stored && stored.sensor_id !== sensorId
                ? `the stored rotary calibration belongs to sensor ${String(stored.sensor_id)}, not ${sensorId}`
                : 'no rotary calibration yet: take still readings at four or more controller B angles (spread over at least 180 deg, 0/90/180/270 ideal) in ONE power session '
                    + 'and pass their capture ids to calibrate_rotary_accelerometer. The B0 of that session becomes the absolute zero.';
            return out;
        }
        const cal = stored.calibration as RotaryCalibration;
        const angle = rotaryAngle(cal, reading.g);
        const sigma = reading.standardErrorG === null ? null : angleSigmaDeg(cal, reading.standardErrorG);
        out.calibration = { created_at: stored.created_at, residual_rms_deg: round(cal.residualRmsDeg, 4), reason: stored.reason };
        out.absolute_b_deg = round(angle.absoluteDeg, 3);
        out.uncertainty_deg = sigma === null ? null : round(Math.sqrt(sigma ** 2 + cal.residualRmsDeg ** 2), 3);
        out.radius_ratio = round(angle.radiusRatio, 4);
        out.axial_shift_g = round(angle.axialShiftG, 5);
        const trust: string[] = [];
        if (Math.abs(angle.radiusRatio - 1) > 0.03) {
            trust.push(`in-plane gravity is ${round(angle.radiusRatio, 3)} x the calibration's: the sensor moved on the chuck, the jig was re-mounted, or the reading is not still`);
        }
        if (Math.abs(angle.axialShiftG) > 0.02) {
            trust.push(`the gravity component along the axis moved by ${round(angle.axialShiftG, 4)} g: the rotary module or the sensor mount changed since calibration`);
        }
        out.trust_problems = trust;
        if (startB !== null) {
            const diff = ((((angle.absoluteDeg - startB) % 360) + 540) % 360) - 180;
            out.controller_minus_absolute_deg = round(-diff, 3);
            out.b_offset_note = 'controller B - absolute B (wrapped to +-180): 0 means the controller\'s B0 is the calibrated zero. '
                + 'A power cycle that loses B shows here as a constant offset. Correcting it is MOTION and a frame decision: '
                + 'a rotation staged through the normal tools on the operator\'s word - nothing here moves B or writes the controller\'s count.';
        }
        return out;
    }

    // ------------------------------------------------------------- file jobs

    /** Record a file job that has just started, when mcpVibrationJobs is on and the feed runs. */
    public startForJob(job: McpJob): void {
        const cfg = vibrationFeedService.config();
        if (!cfg.enabled || !cfg.jobCapture || job.kind !== 'file' || this.jobCaptures.has(job.id)) {
            return;
        }
        if (!vibrationFeedService.isRunning()) {
            const status = vibrationFeedService.status();
            jobManager.appendEvent(job, 'vibration_capture_unavailable', {
                tool: 'vibration',
                note: `accelerometer feed is ${String(status.state)}${status.last_error ? `: ${String(status.last_error)}` : ''} - this job is not recorded`,
            });
            return;
        }
        try {
            const capture = this.start({ durationS: null, label: `job ${job.id} ${job.name || ''}`.trim(), jobId: job.id });
            try {
                const program = parseSpindleProgram(fs.readFileSync(job.filePath, 'utf8'));
                const speeds = program.epochs.map((epoch) => epoch.s).filter((s) => s > 0);
                if (speeds.length) {
                    capture.meta.rpm_hint = { min: Math.min(...speeds) * 0.8, max: Math.max(...speeds) * 1.05 };
                }
            } catch (err) {
                // no rotation band: the report simply omits the rotation section
            }
            this.jobCaptures.set(job.id, capture.id);
            jobManager.appendEvent(job, 'vibration_capture_started', { tool: 'vibration', capture_id: capture.id, sensors: [...capture.tracks.keys()] });
            if (!this.jobWatch) {
                this.jobWatch = setInterval(() => this.watchJobs(), 1000);
                if (typeof this.jobWatch.unref === 'function') {
                    this.jobWatch.unref();
                }
            }
        } catch (err) {
            jobManager.appendEvent(job, 'vibration_capture_unavailable', { tool: 'vibration', note: (err as Error).message });
        }
    }

    private watchJobs(): void {
        for (const [jobId, captureId] of this.jobCaptures) {
            const job = jobManager.get(jobId);
            const capture = this.captures.get(captureId);
            if (!capture || !capture.recording) {
                continue;
            }
            if (!job || jobManager.isTerminal(job)) {
                capture.finish('done', job ? `job ${job.state}` : 'job forgotten');
            }
        }
        if (!this.active().some((c) => c.meta.job_id)) {
            if (this.jobWatch) {
                clearInterval(this.jobWatch);
                this.jobWatch = null;
            }
        }
    }

    /** A compact summary for get_gcode_job_status. */
    public async jobSummary(jobId: string): Promise<{ [key: string]: unknown } | null> {
        const captureId = this.jobCaptures.get(jobId);
        if (!captureId) {
            return null;
        }
        const cached = this.jobSummaries.get(jobId);
        if (cached) {
            return cached;
        }
        const capture = this.captures.get(captureId);
        if (!capture) {
            return { capture_id: captureId };
        }
        if (capture.recording) {
            return { capture_id: captureId, state: 'recording', sensors: [...capture.tracks.keys()] };
        }
        const sensors: { [id: string]: unknown } = {};
        try {
            const full = await this.analyse(captureId, { max_peaks: 3 }) as { [id: string]: { [key: string]: unknown } };
            for (const [id, report] of Object.entries(full)) {
                const level = report.level as { velocity_rms_mm_s: number; accel_rms_total_g: number };
                sensors[id] = {
                    location: report.location,
                    velocity_rms_mm_s: level.velocity_rms_mm_s,
                    accel_rms_total_g: level.accel_rms_total_g,
                    top_peaks: report.peaks,
                    rotation: report.rotation || null,
                };
            }
        } catch (err) {
            return { capture_id: captureId, state: capture.meta.state, error: (err as Error).message };
        }
        const summary = { capture_id: captureId, state: capture.meta.state, sensors, detail: 'get_vibration_capture with this capture_id (windows, motion, baseline)' };
        this.jobSummaries.set(jobId, summary);
        return summary;
    }

    public shutdown(): void {
        for (const capture of this.active()) {
            capture.finish('stopped', 'MCP service stopped');
        }
        if (this.jobWatch) {
            clearInterval(this.jobWatch);
            this.jobWatch = null;
        }
    }

    private prune(): void {
        const done = [...this.captures.values()]
            .filter((c) => !c.recording)
            .sort((a, b) => a.meta.created_at.localeCompare(b.meta.created_at));
        while (this.captures.size > VIBRATION_LIMITS.keptInMemory && done.length) {
            const oldest = done.shift() as Capture;
            // Still on disk: meta() and trackData() reload it from there.
            this.captures.delete(oldest.id);
        }
    }
}

export const vibrationCaptureService = new VibrationCaptureService();
