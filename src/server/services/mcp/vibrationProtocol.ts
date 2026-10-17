// The accelerometer monitor's line protocol (vibration_monitor.py), decoded,
// and the clock that turns FIFO batches into timed samples.
//
// A FIFO batch is a run of samples evenly spaced at the chip's real output
// data rate, stamped with the moment the read FINISHED. The rate the chip
// reports (nominal trimmed by INTERNAL_FREQ_FINE) is good to ~0.15 %; the
// clock refines it by regression of the cumulative sample count on the
// batch stamps once there are tens of seconds of them, because every RPM and
// every spatial period computed downstream is only as good as this number.
// A FIFO overrun (samples lost) or a counter gap breaks the run: the clock
// restarts and the gap is reported, never papered over.
//
// Poll batches carry their own per-sample offsets (driver reads timed on
// arrival); they are resampled onto an even grid by linear interpolation so
// the same spectral code applies, and their jitter is reported.
//
// Pure: no server imports (Buffer is Node's global), tests/vibrationProtocol.test.ts.

export interface MonitorBatch {
    id: string;
    mode: 'fifo' | 'poll';
    seq: number;
    n: number;
    /** Interleaved x,y,z in g. */
    accel: Float32Array;
    /** Interleaved x,y,z in degrees/s, when streamed. */
    gyro: Float32Array | null;
    /** The chip's own rate statement (fifo), Hz. */
    odr: number | null;
    overrun: boolean;
    /** Stamp in seconds on the monitor's clock (host wall clock, or board monotonic). */
    stampS: number;
    clock: 'host' | 'board';
    /** poll: per-sample offsets from stampS, seconds. */
    offsetsS: Float64Array | null;
}

export class ProtocolError extends Error {
}

function int16Le(b64: string, scale: number, expected: number, what: string): Float32Array {
    const raw = Buffer.from(b64, 'base64');
    if (raw.length !== expected * 6) {
        throw new ProtocolError(`${what}: ${raw.length} bytes for ${expected} samples`);
    }
    const out = new Float32Array(expected * 3);
    for (let i = 0; i < expected * 3; i++) {
        out[i] = raw.readInt16LE(i * 2) * scale;
    }
    return out;
}

/** Decode a `batch` line; throws ProtocolError on anything malformed. */
export function decodeBatch(msg: { [key: string]: unknown }): MonitorBatch {
    const id = String(msg.id ?? '');
    const n = Number(msg.n);
    const scale = Number(msg.as);
    if (!id || !Number.isInteger(n) || n <= 0 || !(scale > 0) || typeof msg.a !== 'string') {
        throw new ProtocolError('batch without id, n, a and as');
    }
    const mode = msg.mode === 'poll' ? 'poll' : 'fifo';
    let stampS: number;
    let clock: 'host' | 'board';
    if (typeof msg.ts === 'number') {
        stampS = msg.ts;
        clock = 'host';
    } else if (typeof msg.tus === 'number') {
        stampS = msg.tus / 1e6;
        clock = 'board';
    } else {
        throw new ProtocolError('batch without a time stamp (ts or tus)');
    }
    const accel = int16Le(msg.a, scale, n, 'accel');
    let gyro: Float32Array | null = null;
    if (typeof msg.g === 'string' && Number(msg.ng) === n && Number(msg.gs) > 0) {
        gyro = int16Le(msg.g, Number(msg.gs), n, 'gyro');
    }
    let offsetsS: Float64Array | null = null;
    if (mode === 'poll') {
        if (typeof msg.dt !== 'string') {
            throw new ProtocolError('poll batch without per-sample offsets');
        }
        const raw = Buffer.from(msg.dt, 'base64');
        if (raw.length !== n * 4) {
            throw new ProtocolError(`poll offsets: ${raw.length} bytes for ${n} samples`);
        }
        offsetsS = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            offsetsS[i] = raw.readUInt32LE(i * 4) / 1e6;
        }
    }
    const odr = Number(msg.odr);
    return {
        id,
        mode,
        seq: Number(msg.seq) || 0,
        n,
        accel,
        gyro,
        odr: Number.isFinite(odr) && odr > 0 ? odr : null,
        overrun: !!msg.ovr,
        stampS,
        clock,
        offsetsS,
    };
}

export interface ClockStats {
    /** Best current estimate of the sample rate, Hz. */
    rateHz: number;
    /** 'chip' (the part's own statement) until the regression has enough span, then 'measured'. */
    rateSource: 'chip' | 'measured';
    /** Seconds of batches in the current unbroken run. */
    runS: number;
    /** Runs broken by an overrun or sequence gap. */
    breaks: number;
    /** Samples received since the clock started. */
    samples: number;
}

interface RunPoint {
    count: number;
    stamp: number;
}

/** Regression span before the measured rate replaces the chip's statement. */
export const MEASURED_RATE_MIN_S = 20;
/** Batch stamps kept for the regression (10 batches/s -> 10 minutes). */
const MAX_POINTS = 6000;

/**
 * Sample times for a FIFO stream. `place(batch)` returns the time (on the
 * monitor's clock, seconds) of each sample in the batch.
 */
export class FifoClock {
    private points: RunPoint[] = [];

    private runCount = 0;

    private lastSeq: number | null = null;

    private chipRate: number;

    private measured: number | null = null;

    private breaks = 0;

    private total = 0;

    private intercept = 0;

    public constructor(nominalHz: number) {
        this.chipRate = nominalHz;
    }

    /** Times of the batch's samples, and whether this batch starts a new run (a gap before it). */
    public place(batch: MonitorBatch): { times: Float64Array; gap: boolean } {
        if (batch.odr) {
            this.chipRate = batch.odr;
        }
        let gap = false;
        if (batch.overrun || (this.lastSeq !== null && batch.seq !== this.lastSeq + 1)) {
            gap = this.points.length > 0;
            if (gap) {
                this.breaks++;
            }
            this.points = [];
            this.runCount = 0;
        }
        this.lastSeq = batch.seq;
        this.runCount += batch.n;
        this.total += batch.n;
        this.points.push({ count: this.runCount, stamp: batch.stampS });
        if (this.points.length > MAX_POINTS) {
            this.points.splice(0, this.points.length - MAX_POINTS);
        }
        this.refit();
        const rate = this.rateHz();
        // The last sample of this batch was taken (at the latest) at the
        // stamp; with a fitted line, at the line's time for that count.
        const endTime = this.timeOfCount(this.runCount, batch.stampS);
        const times = new Float64Array(batch.n);
        for (let i = 0; i < batch.n; i++) {
            times[i] = endTime - (batch.n - 1 - i) / rate;
        }
        return { times, gap };
    }

    public rateHz(): number {
        return this.measured ?? this.chipRate;
    }

    public stats(): ClockStats {
        const span = this.points.length > 1 ? this.points[this.points.length - 1].stamp - this.points[0].stamp : 0;
        return { rateHz: this.rateHz(), rateSource: this.measured ? 'measured' : 'chip', runS: span, breaks: this.breaks, samples: this.total };
    }

    private timeOfCount(count: number, fallback: number): number {
        if (this.measured === null) {
            return fallback;
        }
        return this.intercept + count / this.measured;
    }

    private refit(): void {
        const pts = this.points;
        if (pts.length < 10 || pts[pts.length - 1].stamp - pts[0].stamp < MEASURED_RATE_MIN_S) {
            this.measured = null;
            return;
        }
        // stamp = intercept + count / rate; the stamps lag the true sample
        // times by a variable read latency, so fit the LOWER envelope: a
        // least-squares line, then again on the points at or below it.
        const fit = (subset: RunPoint[]): { slope: number; intercept: number } => {
            const n = subset.length;
            let sx = 0;
            let sy = 0;
            for (const p of subset) {
                sx += p.count;
                sy += p.stamp;
            }
            const mx = sx / n;
            const my = sy / n;
            let sxx = 0;
            let sxy = 0;
            for (const p of subset) {
                sxx += (p.count - mx) ** 2;
                sxy += (p.count - mx) * (p.stamp - my);
            }
            const slope = sxy / sxx;
            return { slope, intercept: my - slope * mx };
        };
        let line = fit(pts);
        const below = pts.filter((p) => p.stamp <= line.intercept + line.slope * p.count);
        if (below.length >= 5) {
            line = fit(below);
        }
        if (!(line.slope > 0)) {
            this.measured = null;
            return;
        }
        const rate = 1 / line.slope;
        // A measurement more than 5 % off the chip's statement is a broken
        // stream (stalled reads), not a better rate.
        if (Math.abs(rate / this.chipRate - 1) > 0.05) {
            this.measured = null;
            return;
        }
        this.measured = rate;
        this.intercept = line.intercept;
    }
}

/**
 * Even-grid resampler for poll batches: linear interpolation between
 * arrival-timed samples, at a fixed rate. Gaps longer than `maxGapS` are not
 * bridged (the grid restarts after them).
 */
export class PollResampler {
    public readonly rateHz: number;

    private readonly maxGapS: number;

    private prevT: number | null = null;

    /** The previous arrival's channels: accel x,y,z then (once seen) gyro x,y,z. */
    private prev: number[] = [0, 0, 0, 0, 0, 0];

    /** Set once a batch carried gyro: from then on the output has six channels (a batch without them holds the last value). */
    private hasGyro = false;

    /** The grid is gridStart + k / rate (k counted, never accumulated: no drift). */
    private gridStart = 0;

    private gridIndex = 0;

    private intervals: number[] = [];

    public gaps = 0;

    public constructor(rateHz: number, maxGapS: number) {
        this.rateHz = rateHz;
        this.maxGapS = maxGapS;
    }

    public push(batch: MonitorBatch): { times: Float64Array; accel: Float32Array; gyro: Float32Array | null; gap: boolean } {
        const outT: number[] = [];
        const outA: number[] = [];
        const outG: number[] = [];
        let gap = false;
        const offsets = batch.offsetsS as Float64Array;
        const eps = 1e-9;
        if (batch.gyro) {
            this.hasGyro = true;
        }
        const emitAt = (t: number, v: number[]) => {
            outT.push(t);
            outA.push(v[0], v[1], v[2]);
            outG.push(v[3], v[4], v[5]);
        };
        for (let i = 0; i < batch.n; i++) {
            const t = batch.stampS + offsets[i];
            const v = [batch.accel[i * 3], batch.accel[i * 3 + 1], batch.accel[i * 3 + 2]];
            if (batch.gyro) {
                v.push(batch.gyro[i * 3], batch.gyro[i * 3 + 1], batch.gyro[i * 3 + 2]);
            } else {
                v.push(this.prev[3], this.prev[4], this.prev[5]);
            }
            if (this.prevT !== null && t - this.prevT > this.maxGapS) {
                gap = true;
                this.gaps++;
                this.prevT = null;
            }
            if (this.prevT === null) {
                this.prevT = t;
                this.prev = v;
                this.gridStart = t;
                this.gridIndex = 1;
                emitAt(t, v);
                continue;
            }
            if (t <= this.prevT) {
                continue;
            }
            this.intervals.push(t - this.prevT);
            if (this.intervals.length > 2000) {
                this.intervals.splice(0, 1000);
            }
            for (;;) {
                const next = this.gridStart + this.gridIndex / this.rateHz;
                if (next > t + eps) {
                    break;
                }
                const f = Math.min(1, (next - this.prevT) / (t - this.prevT));
                emitAt(next, v.map((value, c) => this.prev[c] + f * (value - this.prev[c])));
                this.gridIndex++;
            }
            this.prevT = t;
            this.prev = v;
        }
        return {
            times: Float64Array.from(outT),
            accel: Float32Array.from(outA),
            gyro: this.hasGyro ? Float32Array.from(outG) : null,
            gap,
        };
    }

    /** Arrival interval statistics (s): how uneven the polling really is. */
    public jitter(): { meanS: number; p95S: number } | null {
        if (this.intervals.length < 10) {
            return null;
        }
        const sorted = this.intervals.slice().sort((a, b) => a - b);
        return {
            meanS: sorted.reduce((s, v) => s + v, 0) / sorted.length,
            p95S: sorted[Math.floor(sorted.length * 0.95)],
        };
    }
}
