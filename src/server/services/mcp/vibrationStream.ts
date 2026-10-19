// One accelerometer's stream between the monitor and the captures: the
// FIFO clock or poll resampler, the host-time mapping of a board's clock,
// the look-back ring, and the run boundaries.
//
// A stream OUTLIVES the monitor process it came from: a reconnect, a bridge
// restart or a board re-initialising starts a new RUN (new sequence numbers,
// new clock), and the first batch of every run after the first is a gap -
// the data on either side are not continuous, and a capture spanning the
// restart must know (review of PR #223, 2026-10-04). Only a configuration
// change creates new streams.
//
// Pure: no server imports, tests/vibrationStream.test.ts.

import { SensorSpec } from './vibrationConfig';
import { ClockStats, FifoClock, MonitorBatch, PollResampler } from './vibrationProtocol';

/** A poll stream silent for longer than this is a gap, not a slow sample. */
export const POLL_MAX_GAP_S = 0.5;
/** Recent batches over which a board clock's offset to the host is taken (lower envelope). */
const BOARD_OFFSET_WINDOW = 100;

/** Fixed-capacity ring of timed samples (host ms; accel x,y,z g; optional gyro dps). */
export class SampleRing {
    public readonly capacity: number;

    private readonly times: Float64Array;

    private readonly accel: Float32Array;

    private gyro: Float32Array | null = null;

    private head = 0;

    private size = 0;

    public constructor(capacity: number) {
        this.capacity = Math.max(16, capacity);
        this.times = new Float64Array(this.capacity);
        this.accel = new Float32Array(this.capacity * 3);
    }

    public push(times: Float64Array, accel: Float32Array, gyro: Float32Array | null): void {
        if (gyro && !this.gyro) {
            this.gyro = new Float32Array(this.capacity * 3);
        }
        for (let i = 0; i < times.length; i++) {
            const at = this.head;
            this.times[at] = times[i];
            this.accel[at * 3] = accel[i * 3];
            this.accel[at * 3 + 1] = accel[i * 3 + 1];
            this.accel[at * 3 + 2] = accel[i * 3 + 2];
            if (this.gyro) {
                this.gyro[at * 3] = gyro ? gyro[i * 3] : 0;
                this.gyro[at * 3 + 1] = gyro ? gyro[i * 3 + 1] : 0;
                this.gyro[at * 3 + 2] = gyro ? gyro[i * 3 + 2] : 0;
            }
            this.head = (this.head + 1) % this.capacity;
            this.size = Math.min(this.size + 1, this.capacity);
        }
    }

    public get length(): number {
        return this.size;
    }

    public span(): { fromMs: number; toMs: number } | null {
        if (!this.size) {
            return null;
        }
        const first = (this.head - this.size + this.capacity) % this.capacity;
        const last = (this.head - 1 + this.capacity) % this.capacity;
        return { fromMs: this.times[first], toMs: this.times[last] };
    }

    /** Samples with fromMs <= t < toMs, oldest first. */
    public slice(fromMs: number, toMs: number): { times: Float64Array; accel: Float32Array; gyro: Float32Array | null } {
        const inWindow = (at: number) => this.times[at] >= fromMs && this.times[at] < toMs;
        let count = 0;
        for (let i = 0; i < this.size; i++) {
            if (inWindow((this.head - this.size + i + this.capacity) % this.capacity)) {
                count++;
            }
        }
        const times = new Float64Array(count);
        const accel = new Float32Array(count * 3);
        const gyro = this.gyro ? new Float32Array(count * 3) : null;
        let out = 0;
        for (let i = 0; i < this.size; i++) {
            const at = (this.head - this.size + i + this.capacity) % this.capacity;
            if (!inWindow(at)) {
                continue;
            }
            times[out] = this.times[at];
            accel.set(this.accel.subarray(at * 3, at * 3 + 3), out * 3);
            if (gyro && this.gyro) {
                gyro.set(this.gyro.subarray(at * 3, at * 3 + 3), out * 3);
            }
            out++;
        }
        return { times, accel, gyro };
    }
}

export interface StreamSamples {
    /** Host ms per sample. */
    hostMs: Float64Array;
    accel: Float32Array;
    gyro: Float32Array | null;
    /** Not continuous with the stream's previous sample (overrun, sequence gap, new monitor run, poll silence). */
    gap: boolean;
}

/** One sensor's stream; survives monitor restarts. */
export class SensorStream {
    public readonly spec: SensorSpec;

    /** waiting: no word from the monitor yet; ok: streaming; failed: the monitor reported it failed (retried there). */
    public state: 'waiting' | 'ok' | 'failed' = 'waiting';

    public error: string | null = null;

    /** What the monitor said about it at ready (chip, WHO_AM_I, the chip's own ODR, scale). */
    public info: { [key: string]: unknown } | null = null;

    /** The monitor's latest heartbeat counters for it. */
    public counters: { [key: string]: unknown } | null = null;

    public clock: FifoClock | null = null;

    public resampler: PollResampler | null = null;

    /** Allocated on the first sample, so a feed that never starts holds no memory. */
    public ring: SampleRing | null = null;

    public lastBatchAt: number | null = null;

    public batches = 0;

    public samples = 0;

    public gaps = 0;

    /** Monitor runs this stream has seen (1 = the first). */
    public runs = 0;

    public protocolErrors = 0;

    private readonly ringCapacity: number;

    private boardOffsets: number[] = [];

    private freshRun = true;

    public constructor(spec: SensorSpec, bufferS: number) {
        this.spec = spec;
        this.ringCapacity = Math.ceil(spec.rateHz * 1.02 * bufferS);
        this.newRun();
        this.runs = 0; // counted from the monitor's first ready
    }

    /** A monitor (re)started for this sensor: new clock, and its first batch is a gap if anything came before. */
    public newRun(): void {
        this.clock = this.spec.mode === 'fifo' ? new FifoClock(this.spec.rateHz) : null;
        this.resampler = this.spec.mode === 'poll' ? new PollResampler(this.spec.rateHz, POLL_MAX_GAP_S) : null;
        this.boardOffsets = [];
        this.freshRun = true;
        this.runs++;
    }

    /** The monitor went away: the stream waits for the next run. */
    public lost(): void {
        this.state = 'waiting';
    }

    public rateHz(): number {
        if (this.clock) {
            return this.clock.rateHz();
        }
        return this.resampler ? this.resampler.rateHz : this.spec.rateHz;
    }

    public clockStats(): ClockStats | null {
        return this.clock ? this.clock.stats() : null;
    }

    /** Timed samples from a decoded batch (arrivalMs = host time it arrived), or null when it yields none. */
    public ingest(batch: MonitorBatch, arrivalMs: number): StreamSamples | null {
        this.state = 'ok';
        this.lastBatchAt = arrivalMs;
        this.batches++;
        let times: Float64Array;
        let accel: Float32Array;
        let gyro: Float32Array | null;
        let gap: boolean;
        if (this.clock && batch.mode === 'fifo') {
            const placed = this.clock.place(batch);
            times = placed.times;
            accel = batch.accel;
            gyro = batch.gyro;
            gap = placed.gap;
        } else if (this.resampler && batch.mode === 'poll') {
            const resampled = this.resampler.push(batch);
            times = resampled.times;
            accel = resampled.accel;
            gyro = resampled.gyro;
            gap = resampled.gap;
        } else {
            this.protocolErrors++;
            return null;
        }
        if (!times.length) {
            return null;
        }
        if (this.freshRun) {
            gap = gap || this.samples > 0;
            this.freshRun = false;
        }
        if (gap) {
            this.gaps++;
        }
        const hostMs = this.toHostMs(batch, times, arrivalMs);
        this.samples += hostMs.length;
        if (!this.ring) {
            this.ring = new SampleRing(this.ringCapacity);
        }
        this.ring.push(hostMs, accel, gyro);
        return { hostMs, accel, gyro, gap };
    }

    private toHostMs(batch: MonitorBatch, times: Float64Array, arrivalMs: number): Float64Array {
        if (batch.clock === 'host') {
            return times.map((t) => t * 1000);
        }
        // Board clock: the offset to the host is the smallest (arrival -
        // stamp) seen recently - the batch that arrived with least delay.
        this.boardOffsets.push(arrivalMs - batch.stampS * 1000);
        if (this.boardOffsets.length > BOARD_OFFSET_WINDOW) {
            this.boardOffsets.splice(0, this.boardOffsets.length - BOARD_OFFSET_WINDOW);
        }
        const offset = Math.min(...this.boardOffsets);
        return times.map((t) => t * 1000 + offset);
    }
}
