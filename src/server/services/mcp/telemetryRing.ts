// Compact per-job telemetry storage: a columnar typed-array ring with a hard
// sample cap, plus a min/max-preserving downsampler for the read side.
//
// Why not job events: a status report every 200 ms and an audio frame every
// 50 ms for an hour is ~90 000 samples; as ~700-byte event objects that is
// tens of megabytes per job, and the event log is spliced from the middle
// when it overflows, which destroys exactly the series a sag analysis needs.
// Here a sample is 10-16 bytes, the buffer grows by doubling up to the cap,
// and hitting the cap halves the rate (every second sample is dropped) so a
// long job keeps its start, its end and its whole shape at lower resolution.
// Summary statistics are computed live by the analyser, never from the ring,
// so decimation only affects what get_job_telemetry can plot.
//
// Pure: no server imports, unit-tested in tests/telemetryRing.test.ts.

export type ColumnType = 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'i32' | 'f32';

export interface ColumnSpec {
    name: string;
    type: ColumnType;
    /** Stored value = round(value * scale); read back divided. Default 1. */
    scale?: number;
    /** Raw stored value that means "no data" (read back as NaN). Defaults per type; f32 uses NaN itself. */
    missing?: number;
}

type TypedArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array;

const BYTES: { [type in ColumnType]: number } = { u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4 };
const DEFAULT_MISSING: { [type in ColumnType]: number } = {
    u8: 255, i8: -128, u16: 65535, i16: -32768, u32: 4294967295, i32: -2147483648, f32: NaN,
};
const RANGE: { [type in ColumnType]: [number, number] } = {
    u8: [0, 254], i8: [-127, 127], u16: [0, 65534], i16: [-32767, 32767], u32: [0, 4294967294], i32: [-2147483647, 2147483647], f32: [-Infinity, Infinity],
};

function allocate(type: ColumnType, capacity: number): TypedArray {
    switch (type) {
        case 'u8': return new Uint8Array(capacity);
        case 'i8': return new Int8Array(capacity);
        case 'u16': return new Uint16Array(capacity);
        case 'i16': return new Int16Array(capacity);
        case 'u32': return new Uint32Array(capacity);
        case 'i32': return new Int32Array(capacity);
        default: return new Float32Array(capacity);
    }
}

export interface RingOptions {
    /** Hard cap on samples kept; reaching it decimates 2:1. */
    maxSamples: number;
    /** First allocation (doubles up to maxSamples). Default 1024. */
    initialCapacity?: number;
}

export class TelemetryRing {
    public readonly columns: ColumnSpec[];

    public readonly bytesPerSample: number;

    private readonly maxSamples: number;

    private arrays = new Map<string, TypedArray>();

    private capacity: number;

    private count = 0;

    /** Samples ever pushed (before decimation). */
    private pushed = 0;

    /** Every Nth pushed sample survives: 1 until the cap is first hit, then 2, 4, ... */
    private stride = 1;

    /** Pushes skipped under the current stride since the last kept sample. */
    private skip = 0;

    public constructor(columns: ColumnSpec[], options: RingOptions) {
        if (!columns.length) {
            throw new Error('TelemetryRing needs at least one column');
        }
        this.columns = columns.map((column) => ({ ...column, scale: column.scale || 1, missing: column.missing ?? DEFAULT_MISSING[column.type] }));
        this.maxSamples = Math.max(2, Math.floor(options.maxSamples));
        this.capacity = Math.min(this.maxSamples, Math.max(2, Math.floor(options.initialCapacity || 1024)));
        this.bytesPerSample = this.columns.reduce((sum, column) => sum + BYTES[column.type], 0);
        for (const column of this.columns) {
            this.arrays.set(column.name, allocate(column.type, this.capacity));
        }
    }

    public get length(): number {
        return this.count;
    }

    public get totalPushed(): number {
        return this.pushed;
    }

    /** 1 while every sample is kept; 2, 4, ... after the cap forced decimation. */
    public get decimation(): number {
        return this.stride;
    }

    public get limit(): number {
        return this.maxSamples;
    }

    public get bytesAllocated(): number {
        return this.capacity * this.bytesPerSample;
    }

    /** Append one sample; NaN / undefined columns are stored as "missing". */
    public push(values: { [column: string]: number | null | undefined }): void {
        this.pushed += 1;
        if (this.stride > 1) {
            // Under decimation keep one sample per stride so the kept series
            // stays uniformly spaced with the halved history.
            this.skip += 1;
            if (this.skip < this.stride) {
                return;
            }
            this.skip = 0;
        }
        if (this.count === this.capacity) {
            if (this.capacity < this.maxSamples) {
                this.grow();
            } else {
                this.decimate();
            }
        }
        for (const column of this.columns) {
            const array = this.arrays.get(column.name) as TypedArray;
            array[this.count] = this.encode(column, values[column.name]);
        }
        this.count += 1;
    }

    /** One decoded sample. */
    public at(index: number): { [column: string]: number } {
        if (index < 0 || index >= this.count) {
            throw new RangeError(`sample ${index} out of range (0..${this.count - 1})`);
        }
        const out: { [column: string]: number } = {};
        for (const column of this.columns) {
            out[column.name] = this.decode(column, (this.arrays.get(column.name) as TypedArray)[index]);
        }
        return out;
    }

    /** Decoded values of one column over [from, to). */
    public series(name: string, from = 0, to = this.count): Float64Array {
        const column = this.columns.find((c) => c.name === name);
        const array = this.arrays.get(name);
        if (!column || !array) {
            throw new Error(`unknown column ${name}`);
        }
        const lo = Math.max(0, from);
        const hi = Math.min(this.count, to);
        const out = new Float64Array(Math.max(0, hi - lo));
        for (let i = lo; i < hi; i++) {
            out[i - lo] = this.decode(column, array[i]);
        }
        return out;
    }

    /** Index of the first sample whose `column` value is >= value (column must be non-decreasing, e.g. time). */
    public lowerBound(name: string, value: number): number {
        const column = this.columns.find((c) => c.name === name);
        const array = this.arrays.get(name);
        if (!column || !array) {
            throw new Error(`unknown column ${name}`);
        }
        let lo = 0;
        let hi = this.count;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this.decode(column, array[mid]) < value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    private encode(column: ColumnSpec, value: number | null | undefined): number {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return column.missing as number;
        }
        if (column.type === 'f32') {
            return value;
        }
        const [min, max] = RANGE[column.type];
        const scaled = Math.round(value * (column.scale as number));
        return Math.min(max, Math.max(min, scaled));
    }

    private decode(column: ColumnSpec, raw: number): number {
        if (column.type === 'f32') {
            return raw;
        }
        if (raw === column.missing) {
            return NaN;
        }
        return raw / (column.scale as number);
    }

    private grow(): void {
        const next = Math.min(this.maxSamples, this.capacity * 2);
        for (const column of this.columns) {
            const old = this.arrays.get(column.name) as TypedArray;
            const bigger = allocate(column.type, next);
            bigger.set(old.subarray(0, this.count) as never);
            this.arrays.set(column.name, bigger);
        }
        this.capacity = next;
    }

    private decimate(): void {
        const kept = Math.floor(this.count / 2);
        for (const column of this.columns) {
            const array = this.arrays.get(column.name) as TypedArray;
            for (let i = 0; i < kept; i++) {
                array[i] = array[2 * i];
            }
        }
        this.count = kept;
        this.stride *= 2;
        this.skip = 0;
    }
}

export interface Downsampled {
    t: number[];
    v: number[];
    /** Samples in the requested window before downsampling. */
    source: number;
}

/**
 * Min/max-preserving downsample of a series to at most `maxPoints`: the
 * window is cut into buckets of equal sample count and each bucket keeps
 * its minimum and its maximum (in time order), so a 0.4 s blip survives a
 * plot of an hour. Missing values (NaN) never win a bucket; a bucket that
 * is all NaN keeps one NaN so the gap stays visible.
 */
export function downsampleMinMax(t: ArrayLike<number>, v: ArrayLike<number>, maxPoints: number): Downsampled {
    const n = Math.min(t.length, v.length);
    const points = Math.max(2, Math.floor(maxPoints));
    if (n <= points) {
        return { t: Array.from({ length: n }, (_, i) => t[i]), v: Array.from({ length: n }, (_, i) => v[i]), source: n };
    }
    const buckets = Math.max(1, Math.floor(points / 2));
    const outT: number[] = [];
    const outV: number[] = [];
    for (let b = 0; b < buckets; b++) {
        const start = Math.floor((b * n) / buckets);
        const end = b === buckets - 1 ? n : Math.floor(((b + 1) * n) / buckets);
        let minI = -1;
        let maxI = -1;
        for (let i = start; i < end; i++) {
            const value = v[i];
            if (Number.isNaN(value)) {
                continue;
            }
            if (minI < 0 || value < v[minI]) {
                minI = i;
            }
            if (maxI < 0 || value > v[maxI]) {
                maxI = i;
            }
        }
        if (minI < 0) {
            outT.push(t[start]);
            outV.push(NaN);
            continue;
        }
        const first = Math.min(minI, maxI);
        const second = Math.max(minI, maxI);
        outT.push(t[first]);
        outV.push(v[first]);
        if (second !== first) {
            outT.push(t[second]);
            outV.push(v[second]);
        }
    }
    return { t: outT, v: outV, source: n };
}
