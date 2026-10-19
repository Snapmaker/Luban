// Spindle telemetry for file jobs: did the 200 W spindle hold its commanded
// RPM under load, and did the cut chatter or run out - answered from the
// job record, with nothing for the operator to write down.
//
// Opt-in (telemetryConfig.ts: mcpSpindleTelemetry, mcpSpindleAudio,
// mcpAudioDevice, mcpSpindleStatusPollMs). Per started file job a session
//   - samples every status report the heartbeat delivers (and, optionally,
//     its own faster /api/v1/status polls that touch nothing else) into a
//     typed-array ring: time, reported RPM, target RPM, the line the
//     controller says it is on and the S that line commands;
//   - optionally records the operator-chosen microphone to FLAC and runs
//     the harmonic-comb tracker on the live stream (spindleTracker.ts),
//     aligned to the commanded S by the reported line number;
//   - appends LOW-VOLUME job events (spindle_sag / spindle_blip /
//     spindle_reach / chatter / runout / per-S epoch verdicts) and keeps a
//     summary for get_gcode_job_status and the series for
//     get_job_telemetry.
// Alerts only. Nothing here commands, pauses or stops the machine, and the
// heartbeat / position-of-record path is not touched.

import path from 'path';
import * as fs from 'fs-extra';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import config from '../configstore';
import { connectionManager } from '../machine/ConnectionManager';
import { listAudioSources, ffmpegBinary } from './audioDevices';
import { AudioSource, describeSourceChoice, matchAudioDevice } from './audioSelection';
import { McpJob, jobManager } from './jobs';
import { ExecutionEstimator } from './executionModel';
import { LineKind, Point3, ProgramLine, SpindleProgram, inferExecutingLine, parseSpindleProgram } from './spindleProgram';
import { AudioRecorder, RecorderStats } from './spindleAudio';
import {
    EpochSummary,
    FrameContext,
    FrameResult,
    HOP_S,
    SAMPLE_RATE,
    SpindleAudioAnalyser,
    SpindleEvent,
} from './spindleTracker';
import { TelemetryConfig, resolveTelemetryConfig } from './telemetryConfig';
import { ColumnSpec, TelemetryRing, downsampleMinMax } from './telemetryRing';

const log = logger('service:mcp:spindle-telemetry');

export function currentTelemetryConfig(): TelemetryConfig {
    return resolveTelemetryConfig(process.env, (key) => config.get(key));
}

// Which raw status fields carry the spindle speed. The Wi-Fi (SSTP/HTTP)
// status payload is spread into the machine state untouched, so whatever
// the controller names the field appears under that name; the SACP channel
// writes cncCurrentSpindleSpeed / cncTargetSpindleSpeed and the serial
// Marlin parser currRpm. The first present numeric field wins and its name
// is recorded on the summary; when none is present the summary lists the
// scalar keys the controller did send, so the list can be extended without
// guessing.
const RPM_FIELDS = ['cncCurrentSpindleSpeed', 'spindleSpeed', 'currentSpindleSpeed', 'spindleCurrentSpeed', 'currRpm', 'currentRpm', 'rpm', 'spindle_speed'];
const TARGET_FIELDS = ['cncTargetSpindleSpeed', 'targetSpindleSpeed', 'spindleTargetSpeed', 'targetRpm', 'target_spindle_speed'];
const LINE_FIELDS = ['currentLine', 'current_line', 'line'];

const HEARTBEAT_SAMPLE_MS = 250;
const WATCH_MS = 500;
const POLL_ERROR_PAUSE_MS = 10000;
const POLL_ERRORS_BEFORE_PAUSE = 5;
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
/** Sessions whose rings stay in memory; older ones keep only their summary. */
const KEEP_RINGS = 4;
const AUDIO_TAIL_MS = 1500;
const DEFAULT_QUERY_POINTS = 2000;
const MAX_QUERY_POINTS = 20000;

// `line` is the estimated EXECUTING line (executionModel.ts: file timing
// from the last sync, bounded by the queue); `queuedLine` is the line whose
// segment the reported x/y/z sit on - the planner's queued position, which
// leads the head by up to `plannerLeadBlocks` moves; `parserLine` is the
// controller's currentLine, further ahead still. x/y/z are the reported
// coordinates in the file's frame at 0.02 mm; `match` says how the queued
// line was found (0 unmatched / held, 1 on a segment, 2 at a segment end);
// `estimate` how the executing line was (0 time, 1 queue upper bound,
// 2 queue lower bound, 3 dwell anchor); `leadBlocks` queued - executing.
const STATUS_COLUMNS: ColumnSpec[] = [
    { name: 't', type: 'u32' },
    { name: 'line', type: 'u32' },
    { name: 'queuedLine', type: 'u32' },
    { name: 'estimate', type: 'u8' },
    { name: 'leadBlocks', type: 'u8' },
    { name: 'parserLine', type: 'u32' },
    { name: 'x', type: 'i16', scale: 50 },
    { name: 'y', type: 'i16', scale: 50 },
    { name: 'z', type: 'i16', scale: 50 },
    { name: 'match', type: 'u8' },
    { name: 'rpm', type: 'i16' },
    { name: 'target', type: 'i16' },
    { name: 'commandedS', type: 'i16' },
    { name: 'pollMs', type: 'u16' },
    { name: 'source', type: 'u8' },
];
const MATCH_CODES: { [match: string]: number } = { unmatched: 0, segment: 1, endpoint: 2 };
const ESTIMATE_CODES: { [mode: string]: number } = { time: 0, 'queue-upper': 1, 'queue-lower': 2, anchor: 3 };

/** Bits of the audio ring's `flags` column. */
export const FRAME_FLAGS = { locked: 1, clipped: 2, contested: 4, ambiguous: 8, gantryLike: 16 };

/**
 * The modal feed the controller is left holding by the last file job this
 * process saw run (its last F word): the A350 runs a file's leading G0s at
 * it (measured 2026-09-29, jobs d8006b17b237 / b3e8f3dd0e34). Unknown
 * after a Luban restart or a machine power cycle - the estimator then
 * assumes true rapids, which makes the spindle context start late, never
 * early.
 */
let lastModalFeed: number | null = null;

function lastFeedOf(program: SpindleProgram): number | null {
    for (let i = program.lines.length - 1; i >= 0; i--) {
        const feed = program.lines[i].feed;
        if (feed !== null && feed > 0) {
            return feed;
        }
    }
    return null;
}

const AUDIO_COLUMNS: ColumnSpec[] = [
    { name: 't', type: 'u32' },
    { name: 'flags', type: 'u8' },
    { name: 'rpm', type: 'i16' },
    { name: 'confidence', type: 'u8', scale: 10 },
    { name: 'rel', type: 'u8', scale: 100 },
    { name: 'chatterDb', type: 'i8' },
    { name: 'chatterHz', type: 'u16' },
    { name: 'runoutDb', type: 'i8', scale: 2 },
    { name: 'role', type: 'u8' },
    { name: 'levelDb', type: 'i8' },
    { name: 'motionHz', type: 'u16' },
    { name: 'motionDb', type: 'i8' },
    { name: 'band0', type: 'i8' },
    { name: 'band1', type: 'i8' },
    { name: 'band2', type: 'i8' },
    { name: 'band3', type: 'i8' },
    { name: 'band4', type: 'i8' },
    { name: 'band5', type: 'i8' },
    { name: 'band6', type: 'i8' },
    { name: 'band7', type: 'i8' },
];

/** Sparkline window and resolution served to the camera page. */
const LIVE_WINDOW_MS = 120000;
const LIVE_POINTS = 240;

const ROLE_CODES: { [role: string]: number } = { off: 0, spinup: 1, transition: 2, baseline: 3, cut: 4 };

interface PerSStatus {
    s: number;
    unloaded: number[];
    loaded: number[];
    /** ms of loaded samples below 95 % of the commanded S (sample interval attributed to each). */
    belowMs95: number;
    lastSampleAt: number | null;
    sagEmitted: boolean;
    reachEmitted: boolean;
    consecutiveLow: number;
}

interface PollStats {
    count: number;
    errors: number;
    skipped: number;
    totalMs: number;
    maxMs: number;
    bytes: number;
    pausedUntil: number;
    consecutiveErrors: number;
}

interface StatusChannel {
    fetchStatus?: () => Promise<{ data: Record<string, unknown>; durationMs: number; bytes: number }>;
}

function firstNumber(data: Record<string, unknown>, names: string[]): { name: string; value: number } | null {
    for (const name of names) {
        const value = data[name];
        if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) {
            return { name, value: Number(value) };
        }
    }
    return null;
}

function median(values: number[]): number | null {
    if (!values.length) {
        return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : 0.5 * (sorted[mid - 1] + sorted[mid]);
}

function round(value: number | null, digits = 1): number | null {
    if (value === null || !Number.isFinite(value)) {
        return null;
    }
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

/** Scalar status keys worth showing when the RPM field is unknown (never anything token-like). */
function scalarKeys(data: Record<string, unknown>): { [key: string]: unknown } {
    const out: { [key: string]: unknown } = {};
    for (const [key, value] of Object.entries(data)) {
        if (/token|key|secret|pass/i.test(key)) {
            continue;
        }
        if (typeof value === 'number' || typeof value === 'boolean' || (typeof value === 'string' && value.length <= 40)) {
            out[key] = value;
        }
    }
    return out;
}

class TelemetrySession {
    public readonly job: McpJob;

    public readonly config: TelemetryConfig;

    public readonly startedAt = Date.now();

    public endedAt: number | null = null;

    public state: 'recording' | 'finished' | 'failed' = 'recording';

    public error: string | null = null;

    private readonly program: SpindleProgram;

    private status: TelemetryRing | null;

    private audio: TelemetryRing | null;

    private ringsReleased = false;

    private lastStamp: number | null = null;

    private statusSamples = 0;

    private heartbeatSamples = 0;

    private rpmField: string | null = null;

    private targetField: string | null = null;

    private lineField: string | null = null;

    private lastStatusScalars: { [key: string]: unknown } | null = null;

    private currentLine: number | null = null;

    private queuedLine: number | null = null;

    private parserLine: number | null = null;

    private readonly estimator: ExecutionEstimator;

    private currentContext: ProgramLine | null = null;

    /** How the executing line was found on the last report. */
    private lastMatch: 'segment' | 'endpoint' | 'unmatched' | null = null;

    private unmatchedSamples = 0;

    /** Status samples whose RPM field read exactly 0 while the file commanded a speed. */
    private zeroRpmSamples = 0;

    /** The file's frame: work-frame coordinates compare directly with the report; a G53 file needs machine = work - offset. */
    private readonly fileFrame: 'work' | 'machine';

    private lastKind: LineKind | null = null;

    private lastKindChangeAt: number;

    private lastEpoch = -1;

    private lastEpochChangeAt: number;

    private perS = new Map<number, PerSStatus>();

    private poll: PollStats = { count: 0, errors: 0, skipped: 0, totalMs: 0, maxMs: 0, bytes: 0, pausedUntil: 0, consecutiveErrors: 0 };

    private pollInFlight = false;

    private timers: NodeJS.Timeout[] = [];

    private recorder: AudioRecorder | null = null;

    private analyser: SpindleAudioAnalyser | null = null;

    private audioSource: AudioSource | null = null;

    private audioError: string | null = null;

    private audioOriginWall: number | null = null;

    private audioFrames = 0;

    private clippedFrames = 0;

    private clippingWarned = false;

    private epochSummaries: EpochSummary[] = [];

    private recorderStats: RecorderStats | null = null;

    private eventCounts: { [kind: string]: number } = {};

    private cpuAtStart = process.cpuUsage();

    private cpuMsTotal: number | null = null;

    private stopping = false;

    public constructor(job: McpJob, cfg: TelemetryConfig) {
        this.job = job;
        this.config = cfg;
        this.lastKindChangeAt = this.startedAt;
        this.lastEpochChangeAt = this.startedAt;
        let text = '';
        try {
            text = fs.readFileSync(job.filePath, 'utf8');
        } catch (err) {
            log.warn(`telemetry: cannot read ${job.filePath}: ${(err as Error).message}`);
        }
        this.program = parseSpindleProgram(text);
        const declared = job.validation && job.validation.frame ? job.validation.frame.declared : null;
        this.fileFrame = declared === 'machine' ? 'machine' : 'work';
        this.estimator = new ExecutionEstimator(this.program, text, cfg.plannerLeadBlocks);
        this.estimator.setInitialFeed(lastModalFeed);
        // The head's position BEFORE the file runs gives the leading moves
        // their real durations; it is the last heartbeat report, taken now
        // rather than from the first sample (which may already show the
        // planner's queued target). Telemetry alignment only.
        const before = connectionManager.getLatestMachineState();
        const startPosition = before ? this.reportedPosition(before as Record<string, unknown>) : null;
        if (startPosition && Number.isFinite(startPosition.z)) {
            this.estimator.setStartPosition(startPosition);
        }
        this.status = new TelemetryRing(STATUS_COLUMNS, { maxSamples: cfg.sampleLimit, initialCapacity: 1024 });
        this.audio = cfg.audioEnabled ? new TelemetryRing(AUDIO_COLUMNS, { maxSamples: cfg.sampleLimit, initialCapacity: 4096 }) : null;
    }

    public start(): void {
        this.appendEvent('telemetry_started', {
            note: `spindle telemetry recording: status RPM from the heartbeat${this.config.statusPollMs ? ` + a ${this.config.statusPollMs} ms status poll` : ''}`
                + `${this.config.audioEnabled ? ', microphone audio' : ''}; ${this.program.epochs.length} commanded spindle speed(s) in the file`,
            epochs: this.program.epochs.map((epoch) => ({ line: epoch.line, s: epoch.s })),
        });
        this.timers.push(setInterval(() => this.sampleHeartbeat(), HEARTBEAT_SAMPLE_MS));
        if (this.config.statusPollMs > 0) {
            this.timers.push(setInterval(() => this.pollStatus(), this.config.statusPollMs));
        }
        this.timers.push(setInterval(() => this.watch(), WATCH_MS));
        for (const timer of this.timers) {
            if (typeof timer.unref === 'function') {
                timer.unref();
            }
        }
        this.sampleHeartbeat();
        if (this.config.audioEnabled) {
            this.startAudio().catch((err) => {
                this.audioError = (err as Error).message;
                this.appendEvent('spindle_audio_unavailable', { note: this.audioError });
            });
        }
    }

    // ------------------------------------------------------------ status

    private sampleHeartbeat(): void {
        const state = connectionManager.getLatestMachineState();
        if (!state || state.timestamp === this.lastStamp) {
            return;
        }
        this.lastStamp = state.timestamp;
        this.heartbeatSamples += 1;
        this.record(state as Record<string, unknown>, 0, 0, state.timestamp);
    }

    private pollStatus(): void {
        if (this.stopping || this.pollInFlight || Date.now() < this.poll.pausedUntil) {
            if (this.pollInFlight) {
                this.poll.skipped += 1;
            }
            return;
        }
        const channel = connectionManager.getCurrentChannel() as unknown as StatusChannel | null;
        if (!channel || typeof channel.fetchStatus !== 'function') {
            return;
        }
        this.pollInFlight = true;
        channel.fetchStatus().then((result) => {
            this.pollInFlight = false;
            this.poll.count += 1;
            this.poll.totalMs += result.durationMs;
            this.poll.maxMs = Math.max(this.poll.maxMs, result.durationMs);
            this.poll.bytes += result.bytes;
            this.poll.consecutiveErrors = 0;
            this.record(result.data, 1, result.durationMs, Date.now());
        }).catch((err) => {
            this.pollInFlight = false;
            this.poll.errors += 1;
            this.poll.consecutiveErrors += 1;
            if (this.poll.consecutiveErrors >= POLL_ERRORS_BEFORE_PAUSE) {
                this.poll.pausedUntil = Date.now() + POLL_ERROR_PAUSE_MS;
                this.poll.consecutiveErrors = 0;
                log.warn(`telemetry status poll paused ${POLL_ERROR_PAUSE_MS} ms after repeated errors: ${(err as Error).message}`);
            }
        });
    }

    private record(data: Record<string, unknown>, source: 0 | 1, pollMs: number, at: number): void {
        if (!this.status) {
            return;
        }
        const rpm = firstNumber(data, RPM_FIELDS);
        const target = firstNumber(data, TARGET_FIELDS);
        let line = firstNumber(data, LINE_FIELDS);
        if (!line) {
            const info = data.gcodePrintingInfo as { sent?: unknown } | undefined;
            if (info && Number.isFinite(Number(info.sent))) {
                line = { name: 'gcodePrintingInfo.sent', value: Number(info.sent) };
            }
        }
        if (rpm && !this.rpmField) {
            this.rpmField = rpm.name;
        }
        if (target && !this.targetField) {
            this.targetField = target.name;
        }
        if (line && !this.lineField) {
            this.lineField = line.name;
        }
        if (!rpm && this.statusSamples < 3) {
            this.lastStatusScalars = scalarKeys(data);
        }
        this.statusSamples += 1;
        if (line && line.value > 0) {
            this.parserLine = line.value;
        }

        // The reported x/y/z is the planner's QUEUED position (up to a buffer
        // of moves ahead of the head) and currentLine is the parser's; the
        // executing line is estimated from the file's timing, bounded by both.
        const position = this.reportedPosition(data);
        const inferred = position ? inferExecutingLine(this.program, position, this.parserLine, this.queuedLine) : null;
        if (inferred) {
            this.lastMatch = inferred.match;
            if (inferred.match === 'unmatched') {
                this.unmatchedSamples += 1;
            } else {
                this.queuedLine = inferred.line;
            }
        }
        const estimate = this.estimator.update(at - this.startedAt, this.queuedLine);
        if (estimate.line !== this.currentLine || this.currentContext === null) {
            this.currentLine = estimate.line;
            const ctx = this.program.lines[estimate.line - 1] || null;
            this.currentContext = ctx;
            const kind = ctx ? ctx.kind : null;
            if (kind !== this.lastKind) {
                this.lastKind = kind;
                this.lastKindChangeAt = at;
            }
            const epoch = ctx ? ctx.epoch : -1;
            if (epoch !== this.lastEpoch) {
                this.lastEpoch = epoch;
                this.lastEpochChangeAt = at;
            }
        }
        const ctx = this.currentContext;
        const commandedS = ctx && ctx.s !== null ? ctx.s : NaN;
        if (rpm && rpm.value === 0 && Number.isFinite(commandedS)) {
            this.zeroRpmSamples += 1;
        }
        this.status.push({
            t: at - this.startedAt,
            line: this.currentLine === null ? NaN : this.currentLine,
            queuedLine: this.queuedLine === null ? NaN : this.queuedLine,
            estimate: ESTIMATE_CODES[estimate.mode],
            leadBlocks: estimate.leadBlocks === null ? NaN : Math.min(254, Math.max(0, estimate.leadBlocks)),
            parserLine: this.parserLine === null ? NaN : this.parserLine,
            x: position ? position.x : NaN,
            y: position ? position.y : NaN,
            z: position ? position.z : NaN,
            match: inferred ? MATCH_CODES[inferred.match] : NaN,
            rpm: rpm ? rpm.value : NaN,
            target: target ? target.value : NaN,
            commandedS,
            pollMs,
            source,
        });
        if (rpm && rpm.value > 0 && ctx && ctx.s !== null && ctx.s > 0) {
            this.judgeStatusSample(rpm.value, ctx, at);
        }
    }

    /** The reported coordinates in the file's frame (the status reports the selected workspace; a G53 file wants machine = work - offset). */
    private reportedPosition(data: Record<string, unknown>): Point3 | null {
        const x = Number(data.x);
        const y = Number(data.y);
        const z = Number(data.z);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        const point: Point3 = { x, y, z: Number.isFinite(z) ? z : NaN };
        if (this.fileFrame === 'machine') {
            const ox = Number(data.offsetX);
            const oy = Number(data.offsetY);
            const oz = Number(data.offsetZ);
            if (!Number.isFinite(ox) || !Number.isFinite(oy)) {
                return null;
            }
            // Telemetry alignment only - never a position of record.
            return { x: x - ox, y: y - oy, z: Number.isFinite(z) && Number.isFinite(oz) ? z - oz : NaN };
        }
        return point;
    }

    /**
     * Coarse verdicts from the controller's own RPM report (2 s heartbeat,
     * or the faster poll): per commanded S the unloaded / loaded medians,
     * time below 95 %, and one sag / reach event per S when it is plain
     * even at this resolution. The microphone gives the fine structure.
     */
    private judgeStatusSample(rpm: number, ctx: ProgramLine, at: number): void {
        const s = ctx.s as number;
        let stats = this.perS.get(s);
        if (!stats) {
            stats = { s, unloaded: [], loaded: [], belowMs95: 0, lastSampleAt: null, sagEmitted: false, reachEmitted: false, consecutiveLow: 0 };
            this.perS.set(s, stats);
        }
        const interval = stats.lastSampleAt === null ? 0 : Math.min(at - stats.lastSampleAt, 5000);
        stats.lastSampleAt = at;
        const settled = at - this.lastEpochChangeAt >= 2000 && at - this.lastKindChangeAt >= 500;
        if (!settled || rpm <= 0) {
            return;
        }
        if (ctx.kind === 'feed') {
            stats.loaded.push(rpm);
            if (rpm < 0.95 * s) {
                stats.belowMs95 += interval;
                stats.consecutiveLow += 1;
                if (stats.consecutiveLow >= 2 && !stats.sagEmitted) {
                    stats.sagEmitted = true;
                    this.appendEvent('spindle_sag', {
                        source: 'status',
                        sCommanded: s,
                        rpm,
                        line: this.currentLine,
                        note: `controller reports ${rpm} RPM under load against S${s} (${(100 * (1 - rpm / s)).toFixed(1)} % low) on consecutive status reports`,
                    });
                }
            } else {
                stats.consecutiveLow = 0;
            }
        } else {
            stats.unloaded.push(rpm);
            if (stats.unloaded.length >= 3 && !stats.reachEmitted) {
                stats.reachEmitted = true;
                const base = median(stats.unloaded) as number;
                if (Math.abs(base / s - 1) > 0.02) {
                    this.appendEvent('spindle_reach', {
                        source: 'status',
                        sCommanded: s,
                        unloadedRpm: base,
                        line: this.currentLine,
                        note: `controller reports ${Math.round(base)} RPM unloaded against S${s} (${(100 * (base / s - 1)).toFixed(1)} % off)`,
                    });
                }
            }
        }
    }

    // ------------------------------------------------------------- audio

    private async startAudio(): Promise<void> {
        const listing = await listAudioSources();
        const match = matchAudioDevice(this.config.audioDevice || '', listing.sources);
        if (!match.ok) {
            throw new Error(`${match.reason} ${describeSourceChoice(listing.sources)}`);
        }
        if (this.stopping) {
            return;
        }
        this.audioSource = match.source;
        const dir = path.join(DataStorage.userDataDir, 'mcp-audio');
        await fs.ensureDir(dir);
        const filePath = path.join(dir, `${this.job.id}_${this.job.name}.flac`);
        const recorder = new AudioRecorder(ffmpegBinary(), match.source, filePath);
        this.recorder = recorder;
        this.analyser = new SpindleAudioAnalyser({
            contextAt: (tMs) => this.contextAt(tMs),
            onFrame: (frame) => this.onFrame(frame),
            onEvent: (event) => this.onSpindleEvent(event),
        });
        recorder.on('pcm', (samples: Float32Array) => {
            if (this.audioOriginWall === null) {
                this.audioOriginWall = Date.now() - (samples.length / SAMPLE_RATE) * 1000;
            }
            if (this.analyser) {
                this.analyser.push(samples);
            }
        });
        recorder.on('error', (message: string) => {
            if (!this.audioError) {
                this.audioError = message;
                this.appendEvent('spindle_audio_error', { note: message, device: match.source.entry });
            }
        });
        recorder.start();
        this.appendEvent('spindle_audio_started', {
            device: match.source.entry,
            description: match.source.description,
            matchedOn: match.matchedOn,
            file: filePath,
            note: `recording ${match.source.description} (${match.source.entry}) to ${path.basename(filePath)}${
                match.source.builtIn ? ' - this is the host\'s built-in microphone, far from the spindle' : ''}`,
        });
    }

    private contextAt(tMs: number): FrameContext | null {
        const ctx = this.currentContext;
        const wall = (this.audioOriginWall === null ? this.startedAt : this.audioOriginWall) + tMs;
        if (!ctx) {
            return null;
        }
        return {
            s: ctx.s,
            kind: ctx.kind,
            feed: ctx.feed,
            epoch: ctx.epoch,
            sinceTransitionMs: Math.max(0, wall - this.lastKindChangeAt),
            sinceEpochMs: Math.max(0, wall - this.lastEpochChangeAt),
        };
    }

    private onFrame(frame: FrameResult): void {
        this.audioFrames += 1;
        if (frame.clipped) {
            this.clippedFrames += 1;
            // One warning per job, once clipping is clearly not a stray transient.
            if (!this.clippingWarned && this.audioFrames >= 200 && this.clippedFrames >= 0.01 * this.audioFrames) {
                this.clippingWarned = true;
                this.appendEvent('audio_clipping', {
                    source: 'audio',
                    clippedFrames: this.clippedFrames,
                    frames: this.audioFrames,
                    levelDb: Math.round(frame.levelDb),
                    note: `microphone clipping (${this.clippedFrames} of ${this.audioFrames} frames at full scale): reduce the capture gain - `
                        + 'clipped frames are not trusted for RPM, so sags cannot be judged while it lasts',
                });
            }
        }
        if (!this.audio) {
            return;
        }
        const wall = (this.audioOriginWall === null ? this.startedAt : this.audioOriginWall) + frame.tMs;
        this.audio.push({
            t: wall - this.startedAt,
            flags: (frame.locked ? FRAME_FLAGS.locked : 0) | (frame.clipped ? FRAME_FLAGS.clipped : 0)
                | (frame.contested ? FRAME_FLAGS.contested : 0) | (frame.ambiguous ? FRAME_FLAGS.ambiguous : 0)
                | (frame.gantryLike ? FRAME_FLAGS.gantryLike : 0),
            rpm: frame.rpm,
            confidence: Math.min(25, frame.confidence),
            rel: frame.rel,
            chatterDb: frame.chatterExcessDb,
            chatterHz: frame.chatterHz,
            runoutDb: frame.runoutIndexDb,
            role: ROLE_CODES[frame.role],
            levelDb: frame.levelDb,
            motionHz: frame.motionHz,
            motionDb: frame.motionDb,
            band0: frame.bands[0],
            band1: frame.bands[1],
            band2: frame.bands[2],
            band3: frame.bands[3],
            band4: frame.bands[4],
            band5: frame.bands[5],
            band6: frame.bands[6],
            band7: frame.bands[7],
        });
    }

    /**
     * The latest sample of each stream plus min/max-downsampled tails of the
     * last two minutes, for the camera page's side panel (polled at 1 Hz).
     */
    public live(): TelemetryLive {
        const tNow = (this.endedAt || Date.now()) - this.startedAt;
        const tail = (ring: TelemetryRing | null, columns: string[]) => {
            if (!ring || !ring.length) {
                return null;
            }
            const from = ring.lowerBound('t', Math.max(0, tNow - LIVE_WINDOW_MS));
            const t = ring.series('t', from);
            const out: { [column: string]: { t: number[]; v: number[] } } = {};
            for (const column of columns) {
                const down = downsampleMinMax(t, ring.series(column, from), LIVE_POINTS);
                out[column] = { t: down.t, v: down.v };
            }
            return out;
        };
        const last = (ring: TelemetryRing | null) => (ring && ring.length ? ring.at(ring.length - 1) : null);
        const status = last(this.status);
        const audio = last(this.audio);
        return {
            jobId: this.job.id,
            jobName: this.job.name,
            state: this.state,
            startedAt: this.startedAt,
            tNowMs: tNow,
            status: status ? { ...status, ageMs: tNow - status.t } : null,
            audio: audio ? { ...audio, ageMs: tNow - audio.t, device: this.audioSource ? this.audioSource.entry : null, error: this.audioError } : null,
            spark: {
                status: tail(this.status, ['rpm', 'target', 'commandedS', 'line']),
                audio: tail(this.audio, ['rpm', 'rel', 'levelDb', 'chatterDb', 'motionHz', 'motionDb']),
            },
            events: this.eventCounts,
            windowMs: LIVE_WINDOW_MS,
            spectrum: this.analyser ? this.analyser.latestSpectrum() : null,
        };
    }

    private onSpindleEvent(event: SpindleEvent): void {
        const { kind, tMs, ...detail } = event;
        const wall = (this.audioOriginWall === null ? this.startedAt : this.audioOriginWall) + tMs;
        this.appendEvent(kind, { source: 'audio', atMs: Math.round(wall - this.startedAt), line: this.currentLine, ...detail });
        if (kind === 'spindle_epoch' && this.analyser) {
            this.epochSummaries = this.analyser.epochSummaries().filter((summary) => summary.endMs > summary.startMs);
        }
    }

    // ---------------------------------------------------------- lifecycle

    private watch(): void {
        if (this.stopping) {
            return;
        }
        if (jobManager.isTerminal(this.job)) {
            this.stop(`job ${this.job.state}`).catch((err) => log.warn(`telemetry stop failed: ${(err as Error).message}`));
        } else if (Date.now() - this.startedAt > MAX_SESSION_MS) {
            this.stop('session time limit').catch((err) => log.warn(`telemetry stop failed: ${(err as Error).message}`));
        }
    }

    public async stop(reason: string): Promise<void> {
        if (this.stopping) {
            return;
        }
        lastModalFeed = lastFeedOf(this.program) || lastModalFeed;
        this.stopping = true;
        for (const timer of this.timers) {
            clearInterval(timer);
        }
        this.timers = [];
        if (this.recorder) {
            // Let the tail of the last cut land before finalising.
            await new Promise<void>((resolve) => {
                setTimeout(resolve, AUDIO_TAIL_MS);
            });
            this.recorderStats = await this.recorder.stop();
            if (this.analyser) {
                this.epochSummaries = this.analyser.finish();
            }
        }
        const cpu = process.cpuUsage(this.cpuAtStart);
        this.cpuMsTotal = (cpu.user + cpu.system) / 1000;
        this.endedAt = Date.now();
        this.state = this.audioError && !this.recorderStats ? 'failed' : 'finished';
        const summary = this.summary();
        this.appendEvent('telemetry_finished', {
            note: `spindle telemetry stopped (${reason}): ${summary.status.samples} status samples${
                summary.audio ? `, ${summary.audio.frames} audio frames, ${summary.audio.epochs.map((e) => `S${e.sCommanded} ${e.verdict}`).join(', ') || 'no spindle epochs'}` : ''}`,
            verdicts: summary.audio ? summary.audio.epochs.map((e) => ({ s: e.sCommanded, verdict: e.verdict })) : undefined,
        });
        log.info(`telemetry for job ${this.job.id} stopped: ${reason}`);
    }

    private audioFilePath(): string | null {
        if (this.recorderStats) {
            return this.recorderStats.filePath;
        }
        return this.recorder ? this.recorder.stats.filePath : null;
    }

    /** Drop the dense series (older sessions), keeping the summary. */
    public releaseRings(): void {
        this.status = null;
        this.audio = null;
        this.ringsReleased = true;
    }

    private appendEvent(phase: string, detail: { [key: string]: unknown }): void {
        this.eventCounts[phase] = (this.eventCounts[phase] || 0) + 1;
        jobManager.appendEvent(this.job, phase, { tool: 'spindle-telemetry', ...detail });
    }

    // ------------------------------------------------------------ reading

    public summary(): TelemetrySummary {
        const now = this.endedAt || Date.now();
        const wallMs = Math.max(1, now - this.startedAt);
        const perS = [...this.perS.values()].sort((a, b) => a.s - b.s).map((stats) => {
            const unloadedMedian = median(stats.unloaded);
            const loadedMedian = median(stats.loaded);
            return {
                s: stats.s,
                unloadedSamples: stats.unloaded.length,
                unloadedMedianRpm: round(unloadedMedian, 0),
                reachError: unloadedMedian === null ? null : round(unloadedMedian / stats.s - 1, 4),
                loadedSamples: stats.loaded.length,
                loadedMedianRpm: round(loadedMedian, 0),
                loadedMinRpm: stats.loaded.length ? Math.min(...stats.loaded) : null,
                loadedMedianDrop: loadedMedian === null || unloadedMedian === null ? null : round(1 - loadedMedian / unloadedMedian, 4),
                timeBelow95Ms: Math.round(stats.belowMs95),
            };
        });
        const pollMean = this.poll.count ? this.poll.totalMs / this.poll.count : null;
        const status = {
            samples: this.statusSamples,
            heartbeatSamples: this.heartbeatSamples,
            kept: this.status ? this.status.length : null,
            decimation: this.status ? this.status.decimation : null,
            bytesPerSample: STATUS_COLUMNS.reduce((sum, c) => sum + ({ u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4 })[c.type], 0),
            rateHz: round(this.statusSamples / (wallMs / 1000), 2),
            rpmField: this.rpmField,
            targetField: this.targetField,
            lineField: this.lineField,
            statusScalarsSeen: this.rpmField ? undefined : this.lastStatusScalars,
            lineSource: 'executing line ESTIMATED from the file timing anchored at the job start and at dwell ends, bounded by the queued line '
                + '(the reported x/y/z is the planner\'s queued position, up to plannerLeadBlocks moves ahead) and by parserLine (currentLine, further ahead)',
            currentLine: this.currentLine,
            queuedLine: this.queuedLine,
            plannerLeadBlocks: this.config.plannerLeadBlocks,
            parserLine: this.parserLine,
            lastMatch: this.lastMatch,
            unmatchedSamples: this.unmatchedSamples,
            zeroRpmSamples: this.zeroRpmSamples,
            poll: this.config.statusPollMs ? {
                periodMs: this.config.statusPollMs,
                count: this.poll.count,
                errors: this.poll.errors,
                skippedBusy: this.poll.skipped,
                meanMs: round(pollMean, 1),
                maxMs: this.poll.maxMs,
                bytesTotal: this.poll.bytes,
                bytesPerSecond: round(this.poll.bytes / (wallMs / 1000), 1),
                requestsPerSecond: round(this.poll.count / (wallMs / 1000), 2),
                controllerBusyPercent: round((100 * this.poll.totalMs) / wallMs, 1),
            } : null,
            perCommandedS: perS,
        };
        let audio: TelemetrySummary['audio'] = null;
        if (this.config.audioEnabled) {
            const stats = this.recorderStats || (this.recorder ? this.recorder.stats : null);
            const analyser = this.analyser;
            let epochSource = this.epochSummaries;
            if (!epochSource.length && analyser) {
                epochSource = analyser.epochSummaries();
            }
            const epochs = epochSource
                .map((epoch) => ({
                    epoch: epoch.epoch,
                    sCommanded: epoch.sCommanded,
                    feed: epoch.feed,
                    verdict: epoch.verdict,
                    baselineRpm: round(epoch.baselineRpm, 0),
                    baselineSource: epoch.baselineSource,
                    reachError: round(epoch.reachError, 4),
                    reachFlag: epoch.reachFlag,
                    idleError: round(epoch.idleError, 4),
                    loadedRefRpm: round(epoch.loadedRefRpm, 0),
                    cutMedianRpm: round(epoch.cutMedianRpm, 0),
                    cutMinRpm: round(epoch.cutMinRpm, 0),
                    medianDrop: round(epoch.medianDrop, 4),
                    minRel: round(epoch.minRel, 4),
                    timeBelow95Ms: epoch.timeBelow95Ms,
                    timeBelow97Ms: epoch.timeBelow97Ms,
                    longestBelow97Ms: epoch.longestBelow97Ms,
                    blips: epoch.blips,
                    sags: epoch.sags,
                    runoutIndexDb: round(epoch.runoutIndexDb, 1),
                    runoutFlag: epoch.runoutFlag,
                    chatterHz: round(epoch.chatterHz, 0),
                    chatterExcessDb: round(epoch.chatterExcessDb, 1),
                    chatterVsBaseDb: round(epoch.chatterVsBaseDb, 1),
                    chatterFlag: epoch.chatterFlag,
                    chatterRibMm: round(epoch.chatterRibMm, 4),
                    revRibMm: round(epoch.revRibMm, 4),
                    baselineFrames: epoch.baselineFrames,
                    cutFrames: epoch.cutFrames,
                }));
            const frameCost = analyser && analyser.frames ? analyser.totalCostMs / analyser.frames : null;
            const recordingMs = stats && stats.startedAt ? (stats.endedAt || now) - stats.startedAt : null;
            audio = {
                device: this.audioSource ? this.audioSource.entry : this.config.audioDevice,
                deviceDescription: this.audioSource ? this.audioSource.description : null,
                builtInMicrophone: this.audioSource ? this.audioSource.builtIn : null,
                file: stats ? stats.filePath : null,
                bytesOnDisk: stats ? stats.bytesOnDisk : 0,
                samples: stats ? stats.samples : 0,
                durationS: stats ? round(stats.samples / SAMPLE_RATE, 1) : null,
                frames: this.audioFrames,
                clippedFrames: this.clippedFrames,
                kept: this.audio ? this.audio.length : null,
                decimation: this.audio ? this.audio.decimation : null,
                frameHz: 1 / HOP_S,
                error: this.audioError || (stats ? stats.error : null),
                analysis: {
                    meanCostMsPerFrame: round(frameCost, 2),
                    maxCostMs: analyser ? round(analyser.maxCostMs, 1) : null,
                    /** Share of one core spent tracking (frame cost / hop). */
                    cpuPercent: frameCost === null ? null : round((100 * frameCost) / (HOP_S * 1000), 1),
                },
                ffmpegCpuPercent: stats && stats.cpuMs !== null && recordingMs ? round((100 * stats.cpuMs) / recordingMs, 1) : null,
                epochs,
                flags: {
                    sag: epochs.filter((e) => e.verdict === 'STRUGGLE').map((e) => e.sCommanded),
                    blip: epochs.filter((e) => e.verdict === 'BLIP').map((e) => e.sCommanded),
                    reach: epochs.filter((e) => e.reachFlag).map((e) => e.sCommanded),
                    chatter: epochs.filter((e) => e.chatterFlag).map((e) => e.sCommanded),
                    runout: epochs.filter((e) => e.runoutFlag).map((e) => e.sCommanded),
                    noLock: epochs.filter((e) => e.verdict === 'NO-LOCK').map((e) => e.sCommanded),
                },
            };
        }
        return {
            jobId: this.job.id,
            state: this.state,
            startedAt: this.startedAt,
            endedAt: this.endedAt,
            wallMs,
            config: {
                statusPollMs: this.config.statusPollMs,
                audioEnabled: this.config.audioEnabled,
                sampleLimit: this.config.sampleLimit,
                plannerLeadBlocks: this.config.plannerLeadBlocks,
            },
            program: { lines: this.program.lineCount, epochs: this.program.epochs },
            status,
            audio,
            server: {
                cpuPercent: this.cpuMsTotal === null ? null : round((100 * this.cpuMsTotal) / wallMs, 1),
                rssMb: round(process.memoryUsage().rss / 1048576, 0),
            },
            seriesRetained: !this.ringsReleased,
            events: this.eventCounts,
            note: 'Alerts only: telemetry never pauses or stops the machine. Verdicts per commanded S, judged against the LOADED '
                + 'reference (the best 0.3 s rolling median sustained while cutting; the A350 idles ~6.5 % under S and reaches S once '
                + 'loaded): HOLD (within 3 %, no dip > 3 %), BLIP (dips > 3 % shorter than 1 s), STRUGGLE (median > 3 % down or > 1 s '
                + 'below 97 %), REACH flag (loaded speed > 2 % off S; idleError reports the free-running offset), NO-LOCK (comb not '
                + 'trackable). get_job_telemetry returns the series.',
        };
    }

    // eslint-disable-next-line camelcase
    public query(args: { since_ms?: number; until_ms?: number; max_points?: number }): object {
        const since = Math.max(0, Math.floor(Number(args.since_ms) || 0));
        const untilRaw = Number(args.until_ms);
        const until = Number.isFinite(untilRaw) && untilRaw > 0 ? Math.floor(untilRaw) : Number.MAX_SAFE_INTEGER;
        const maxPoints = Math.min(MAX_QUERY_POINTS, Math.max(2, Math.floor(Number(args.max_points) || DEFAULT_QUERY_POINTS)));
        const series = (ring: TelemetryRing | null, columns: string[]) => {
            if (!ring) {
                return null;
            }
            const from = ring.lowerBound('t', since);
            const to = ring.lowerBound('t', until + 1);
            const t = ring.series('t', from, to);
            const out: { [column: string]: { t: number[]; v: number[]; source: number } } = {};
            for (const column of columns) {
                out[column] = downsampleMinMax(t, ring.series(column, from, to), maxPoints);
            }
            return { samples: to - from, kept: ring.length, decimation: ring.decimation, bytesPerSample: ring.bytesPerSample, series: out };
        };
        return {
            job_id: this.job.id,
            state: this.state,
            window_ms: { since: since, until: until === Number.MAX_SAFE_INTEGER ? null : until },
            t_origin: 'ms since telemetry start (job start); status.t and audio.t share it',
            max_points: maxPoints,
            series_retained: !this.ringsReleased,
            status: series(this.status, ['line', 'queuedLine', 'estimate', 'leadBlocks', 'parserLine', 'x', 'y', 'z', 'match', 'rpm', 'target', 'commandedS', 'pollMs', 'source']),
            audio: series(this.audio, ['flags', 'rpm', 'confidence', 'rel', 'chatterDb', 'chatterHz', 'runoutDb', 'role', 'levelDb', 'motionHz', 'motionDb',
                'band0', 'band1', 'band2', 'band3', 'band4', 'band5', 'band6', 'band7']),
            audio_file: this.audioFilePath(),
            audio_device: this.audioSource ? this.audioSource.entry : null,
            epochs: this.summary().audio?.epochs || [],
            legend: {
                status: {
                    source: '0 = heartbeat report, 1 = telemetry poll',
                    line: 'estimated EXECUTING line (file timing from the last sync, bounded by the queue); queuedLine = the line whose segment the reported x/y/z sit on (planner queue, up to plannerLeadBlocks ahead); parserLine = currentLine (further ahead)',
                    estimate: '0 timing, 1 capped at the queued line, 2 raised to queued minus the buffer, 3 re-anchored at a dwell end',
                    leadBlocks: 'motion blocks between the executing estimate and the queued line',
                    match: '0 unmatched (queued line held), 1 on a segment, 2 at a segment end (dwell / spindle lines after it)',
                    commandedS: 'S in effect at the executing line',
                    rpm: 'the controller\'s spindleSpeed field: 250 RPM steps and mostly 0 on the A350 (2026-09-29); zeros are excluded from the per-S statistics',
                },
                audio: {
                    flags: 'bits: 1 locked (rpm trusted), 2 clipped, 4 contested by a stronger motion comb, 8 ambiguous (rapid on a gantry harmonic), '
                        + '16 gantry-like shape (2x >= 1x + 10 dB: the Y/Z axes at F500 sing a 125 Hz comb, not the spindle)',
                    role: '0 off, 1 spin-up, 2 transition, 3 baseline (unloaded), 4 cut',
                    rel: 'rolling-median RPM / loaded reference',
                    chatterDb: 'strongest non-harmonic tone over the band median',
                    runoutDb: '1x gain - 4x gain vs baseline',
                    motionHz: 'fundamental of the strongest harmonic series in 20-400 Hz with the spindle masked (gantry / frame tone), every frame',
                    motionDb: 'that series\' strongest harmonic, 10 log10 power',
                    band0_7: 'level (dB) in 50-100, 100-200, 200-400, 400-800, 800-1600, 1600-3200, 3200-6400, 6400-8000 Hz, every frame',
                },
            },
        };
    }
}

export interface TelemetryLive {
    jobId: string;
    jobName: string;
    state: 'recording' | 'finished' | 'failed';
    startedAt: number;
    tNowMs: number;
    status: { [column: string]: number } | null;
    audio: { [column: string]: number | string | null } | null;
    spark: {
        status: { [column: string]: { t: number[]; v: number[] } } | null;
        audio: { [column: string]: { t: number[]; v: number[] } } | null;
    };
    events: { [kind: string]: number };
    windowMs: number;
    /** The latest audio frame's spectrum on a log frequency axis (max per bin, dB), for the camera page's spectrogram. */
    spectrum: { hz: number[]; db: number[] } | null;
}

export interface TelemetrySummary {
    jobId: string;
    state: 'recording' | 'finished' | 'failed';
    startedAt: number;
    endedAt: number | null;
    wallMs: number;
    config: { statusPollMs: number; audioEnabled: boolean; sampleLimit: number; plannerLeadBlocks: number };
    program: { lines: number; epochs: Array<{ index: number; line: number; s: number }> };
    status: {
        samples: number;
        heartbeatSamples: number;
        kept: number | null;
        decimation: number | null;
        bytesPerSample: number;
        rateHz: number | null;
        rpmField: string | null;
        targetField: string | null;
        lineField: string | null;
        statusScalarsSeen?: { [key: string]: unknown } | null;
        lineSource: string;
        currentLine: number | null;
        queuedLine: number | null;
        plannerLeadBlocks: number;
        parserLine: number | null;
        lastMatch: 'segment' | 'endpoint' | 'unmatched' | null;
        unmatchedSamples: number;
        zeroRpmSamples: number;
        poll: {
            periodMs: number; count: number; errors: number; skippedBusy: number; meanMs: number | null; maxMs: number;
            bytesTotal: number; bytesPerSecond: number | null; requestsPerSecond: number | null; controllerBusyPercent: number | null;
        } | null;
        perCommandedS: Array<{
            s: number; unloadedSamples: number; unloadedMedianRpm: number | null; reachError: number | null;
            loadedSamples: number; loadedMedianRpm: number | null; loadedMinRpm: number | null; loadedMedianDrop: number | null; timeBelow95Ms: number;
        }>;
    };
    audio: {
        device: string | null;
        deviceDescription: string | null;
        builtInMicrophone: boolean | null;
        file: string | null;
        bytesOnDisk: number;
        samples: number;
        durationS: number | null;
        frames: number;
        clippedFrames: number;
        kept: number | null;
        decimation: number | null;
        frameHz: number;
        error: string | null;
        analysis: { meanCostMsPerFrame: number | null; maxCostMs: number | null; cpuPercent: number | null };
        ffmpegCpuPercent: number | null;
        epochs: Array<{ [key: string]: unknown; sCommanded: number; verdict: string; reachFlag: boolean; chatterFlag: boolean; runoutFlag: boolean }>;
        flags: { sag: number[]; blip: number[]; reach: number[]; chatter: number[]; runout: number[]; noLock: number[] };
    } | null;
    server: { cpuPercent: number | null; rssMb: number | null };
    seriesRetained: boolean;
    events: { [kind: string]: number };
    note: string;
}

export class SpindleTelemetryService {
    private sessions = new Map<string, TelemetrySession>();

    /** Start recording for a file job that has just started on the machine. No-op unless enabled. */
    public startForJob(job: McpJob): TelemetrySession | null {
        const cfg = currentTelemetryConfig();
        if (!cfg.enabled || job.kind !== 'file') {
            return null;
        }
        if (this.sessions.has(job.id)) {
            return this.sessions.get(job.id) as TelemetrySession;
        }
        const session = new TelemetrySession(job, cfg);
        this.sessions.set(job.id, session);
        session.start();
        this.prune();
        return session;
    }

    public get(jobId: string): TelemetrySession | null {
        return this.sessions.get(jobId) || null;
    }

    public summary(jobId: string): TelemetrySummary | null {
        const session = this.sessions.get(jobId);
        return session ? session.summary() : null;
    }

    /** The recording session (else the most recent one) for the camera page's panel. */
    public live(): { enabled: boolean; audioEnabled: boolean; audioDevice: string | null; session: TelemetryLive | null } {
        const cfg = currentTelemetryConfig();
        const ordered = [...this.sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
        const session = ordered.find((s) => s.state === 'recording') || ordered[0] || null;
        return { enabled: cfg.enabled, audioEnabled: cfg.audioEnabled, audioDevice: cfg.audioDevice, session: session ? session.live() : null };
    }

    public status(): object {
        const cfg = currentTelemetryConfig();
        const active = [...this.sessions.values()].filter((session) => session.state === 'recording').map((session) => session.job.id);
        return {
            enabled: cfg.enabled,
            statusPollMs: cfg.statusPollMs,
            audioEnabled: cfg.audioEnabled,
            audioDevice: cfg.audioDevice,
            sampleLimit: cfg.sampleLimit,
            sources: cfg.sources,
            activeJobs: active,
            sessionsHeld: this.sessions.size,
        };
    }

    private prune(): void {
        const ordered = [...this.sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
        ordered.slice(KEEP_RINGS).forEach((session) => {
            if (session.state !== 'recording') {
                session.releaseRings();
            }
        });
        // Summaries of jobs the job manager has already forgotten go too.
        for (const [id, session] of this.sessions) {
            if (session.state !== 'recording' && !jobManager.get(id)) {
                this.sessions.delete(id);
            }
        }
    }
}

export const spindleTelemetryService = new SpindleTelemetryService();
