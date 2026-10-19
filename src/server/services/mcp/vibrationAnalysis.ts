// Spectral analysis of accelerometer data: what is shaking, how hard, at
// what frequency, and what that frequency belongs to.
//
// The microphone tracker (spindleTracker.ts) is tuned to one 16 kHz stream
// and one question (did the spindle hold its RPM). An accelerometer is
// bolted to a PART of the machine - the toolhead, the tailstock, the rotary
// chuck, an axis carriage - and is asked several questions:
//   - how much does it vibrate (acceleration RMS in g, velocity RMS in mm/s
//     over the ISO 10816 band, displacement amplitude of each tone in um);
//   - which tones (peaks above the local noise floor, with the share of each
//     tone's power on each sensor axis - the DIRECTION it shakes in);
//   - what turns at that rate (a harmonic comb fitted over an RPM band: the
//     spindle seen through the structure, independent of the microphone);
//   - which tones are NOT rotation harmonics (chatter candidates);
//   - for an axis moving at a known feed, what spatial period each tone has
//     (mm per cycle), so a tone that scales with feed is traced to a screw,
//     belt, bearing or stepper by its length, and a fixed resonance is not;
//   - when the axis was moving (activity segmentation of the vibration
//     envelope), so a back-and-forth run can be cut into legs and the
//     vibration binned by POSITION along the travel.
//
// Units: input samples are g (standard gravity). Velocity mm/s, displacement
// um. Frequencies Hz. Nothing is assumed about the machine: screw leads,
// belt pitches and feeds are arguments, never constants here.
//
// Pure: no server imports, unit-tested in tests/vibrationAnalysis.test.ts.

import { Fft } from './spindleTracker';

export function round(value: number, digits: number): number {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

/** mm/s^2 per g. */
export const G_MM_S2 = 9806.65;

const ffts = new Map<number, Fft>();

function fftOf(n: number): Fft {
    let fft = ffts.get(n);
    if (!fft) {
        fft = new Fft(n);
        ffts.set(n, fft);
    }
    return fft;
}

export function nextPow2(n: number): number {
    let p = 2;
    while (p < n) {
        p <<= 1;
    }
    return p;
}

const hannCache = new Map<number, { w: Float64Array; s2: number }>();

export function hannWindow(n: number): { w: Float64Array; s2: number } {
    let cached = hannCache.get(n);
    if (!cached) {
        const w = new Float64Array(n);
        let s2 = 0;
        for (let i = 0; i < n; i++) {
            w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
            s2 += w[i] * w[i];
        }
        cached = { w, s2 };
        hannCache.set(n, cached);
    }
    return cached;
}

/** Segment length (power of two) giving roughly `resolutionHz` bin spacing at `fs`, bounded to [64, 65536]. */
export function segmentFor(fs: number, resolutionHz: number): number {
    const n = nextPow2(Math.max(8, Math.round(fs / Math.max(resolutionHz, 1e-3))));
    return Math.min(Math.max(n, 64), 65536);
}

// ------------------------------------------------------------- Welch PSD

/**
 * Streaming Welch estimator for one channel: Hann segments of `n` samples,
 * 50 % overlap, mean removed per segment, one-sided PSD in units^2/Hz. Feed
 * it samples in any chunking; `psd()` is the average periodogram so far.
 * Sum(psd) * df equals the channel's AC variance (Parseval), so a pure tone
 * of amplitude A integrates to A^2/2 over its main lobe.
 */
export class WelchAccumulator {
    public readonly n: number;

    public readonly fs: number;

    public readonly df: number;

    private readonly hop: number;

    private readonly buf: Float64Array;

    private fill = 0;

    private readonly sum: Float64Array;

    private segments = 0;

    private readonly re: Float64Array;

    private readonly im: Float64Array;

    public constructor(fs: number, n: number) {
        if (n < 8 || (n & (n - 1)) !== 0) {
            throw new Error('Welch segment must be a power of two >= 8');
        }
        this.fs = fs;
        this.n = n;
        this.df = fs / n;
        this.hop = n >> 1;
        this.buf = new Float64Array(n);
        this.sum = new Float64Array(n / 2 + 1);
        this.re = new Float64Array(n);
        this.im = new Float64Array(n);
    }

    public push(samples: ArrayLike<number>, offset = 0, stride = 1, count = -1): void {
        const total = count >= 0 ? count : Math.floor((samples.length - offset + stride - 1) / stride);
        for (let i = 0; i < total; i++) {
            this.buf[this.fill++] = samples[offset + i * stride];
            if (this.fill === this.n) {
                this.segment();
                this.buf.copyWithin(0, this.hop, this.n);
                this.fill = this.n - this.hop;
            }
        }
    }

    public get segmentCount(): number {
        return this.segments;
    }

    /** Mean periodogram (one-sided PSD). Zeros until the first full segment. */
    public psd(): Float64Array {
        const out = new Float64Array(this.sum.length);
        if (this.segments > 0) {
            for (let k = 0; k < out.length; k++) {
                out[k] = this.sum[k] / this.segments;
            }
        }
        return out;
    }

    private segment(): void {
        const { w, s2 } = hannWindow(this.n);
        let mean = 0;
        for (let i = 0; i < this.n; i++) {
            mean += this.buf[i];
        }
        mean /= this.n;
        for (let i = 0; i < this.n; i++) {
            this.re[i] = (this.buf[i] - mean) * w[i];
            this.im[i] = 0;
        }
        fftOf(this.n).transform(this.re, this.im);
        const scale = 1 / (this.fs * s2);
        const last = this.n / 2;
        for (let k = 0; k <= last; k++) {
            const p = (this.re[k] * this.re[k] + this.im[k] * this.im[k]) * scale;
            this.sum[k] += k === 0 || k === last ? p : 2 * p;
        }
        this.segments++;
    }
}

/** One-shot Welch PSD of a whole array (or a strided channel of an interleaved one). */
export function welchPsd(samples: ArrayLike<number>, fs: number, n: number, offset = 0, stride = 1): { psd: Float64Array; df: number; segments: number } {
    const acc = new WelchAccumulator(fs, n);
    acc.push(samples, offset, stride);
    return { psd: acc.psd(), df: acc.df, segments: acc.segmentCount };
}

/** Element-wise sum of PSDs (the vector magnitude's spectrum: power on every axis). */
export function sumPsd(psds: Float64Array[]): Float64Array {
    const out = new Float64Array(psds[0].length);
    for (const psd of psds) {
        for (let k = 0; k < out.length; k++) {
            out[k] += psd[k];
        }
    }
    return out;
}

// ------------------------------------------------------- integrated levels

function binRange(df: number, len: number, loHz: number, hiHz: number): [number, number] {
    const lo = Math.max(1, Math.ceil(loHz / df));
    const hi = Math.min(len - 1, Math.floor(hiHz / df));
    return [lo, hi];
}

/** Acceleration RMS (input units, g) between loHz and hiHz. */
export function bandRms(psd: Float64Array, df: number, loHz: number, hiHz: number): number {
    const [lo, hi] = binRange(df, psd.length, loHz, hiHz);
    let sum = 0;
    for (let k = lo; k <= hi; k++) {
        sum += psd[k];
    }
    return Math.sqrt(sum * df);
}

/** Velocity RMS in mm/s between loHz and hiHz (acceleration PSD in g^2/Hz divided by (2 pi f)^2). */
export function velocityRmsMmS(psd: Float64Array, df: number, loHz: number, hiHz: number): number {
    const [lo, hi] = binRange(df, psd.length, loHz, hiHz);
    let sum = 0;
    for (let k = lo; k <= hi; k++) {
        const w = 2 * Math.PI * k * df;
        sum += psd[k] * (G_MM_S2 / w) ** 2;
    }
    return Math.sqrt(sum * df);
}

/**
 * Displacement RMS in um between loHz and hiHz. Double integration blows up
 * accelerometer noise at low frequency, so the band's lower edge is the
 * caller's explicit choice and is reported beside the number.
 */
export function displacementRmsUm(psd: Float64Array, df: number, loHz: number, hiHz: number): number {
    const [lo, hi] = binRange(df, psd.length, loHz, hiHz);
    let sum = 0;
    for (let k = lo; k <= hi; k++) {
        const w = 2 * Math.PI * k * df;
        sum += psd[k] * (G_MM_S2 / (w * w)) ** 2;
    }
    return Math.sqrt(sum * df) * 1000;
}

/** RMS per band between consecutive edges (Hz), g. */
export function bandLevels(psd: Float64Array, df: number, edges: number[]): Array<{ loHz: number; hiHz: number; rmsG: number }> {
    const out: Array<{ loHz: number; hiHz: number; rmsG: number }> = [];
    const nyquist = df * (psd.length - 1);
    for (let i = 0; i + 1 < edges.length; i++) {
        if (edges[i] >= nyquist) {
            break;
        }
        const hi = Math.min(edges[i + 1], nyquist);
        out.push({ loHz: edges[i], hiHz: hi, rmsG: bandRms(psd, df, edges[i], hi) });
    }
    return out;
}

/** Octave edges from `lo` up to `nyquist`. */
export function octaveEdges(lo: number, nyquist: number): number[] {
    const edges: number[] = [];
    for (let f = lo; f < nyquist; f *= 2) {
        edges.push(f);
    }
    edges.push(nyquist);
    return edges;
}

// ------------------------------------------------------------------ peaks

/** Running median of `x` over +-half bins (edges use what exists). */
export function runningMedian(x: Float64Array, half: number): Float64Array {
    const out = new Float64Array(x.length);
    const window: number[] = [];
    for (let k = 0; k < x.length; k++) {
        window.length = 0;
        const lo = Math.max(0, k - half);
        const hi = Math.min(x.length - 1, k + half);
        for (let j = lo; j <= hi; j++) {
            window.push(x[j]);
        }
        window.sort((a, b) => a - b);
        out[k] = window[window.length >> 1];
    }
    return out;
}

export interface Peak {
    hz: number;
    /** 10 log10 of the PSD at the peak bin, dB re 1 g^2/Hz. */
    psdDb: number;
    /** Peak over the running-median noise floor, dB. */
    prominenceDb: number;
    /** RMS acceleration of the tone (main lobe integrated), g. */
    rmsG: number;
    /** Velocity amplitude (peak) of the tone, mm/s. */
    velocityPkMmS: number;
    /** Displacement amplitude (peak, i.e. half peak-to-peak) of the tone, um. */
    displacementPkUm: number;
    /** Share of the tone's power on each input channel (sums to 1), when more than one PSD was given. */
    axisShare: number[] | null;
}

export interface PeakOptions {
    maxPeaks?: number;
    minProminenceDb?: number;
    minHz?: number;
    maxHz?: number;
    /** Half-width of the running median used as the noise floor, bins. */
    floorHalfBins?: number;
}

/** Hann main lobe: +-2 bins hold all but a fraction of a percent of a tone's power. */
const LOBE_BINS = 2;

/**
 * Tones in a PSD: local maxima at least minProminenceDb over the running
 * median floor, strongest first, frequency refined by a parabola through the
 * log power. `perAxis` (the channels `psd` is the sum of) gives each tone's
 * direction as a power share per channel.
 */
export function findPeaks(psd: Float64Array, df: number, opts: PeakOptions = {}, perAxis: Float64Array[] | null = null): Peak[] {
    const maxPeaks = opts.maxPeaks ?? 8;
    const minProm = opts.minProminenceDb ?? 10;
    const floor = runningMedian(psd, opts.floorHalfBins ?? 15);
    const loBin = Math.max(LOBE_BINS + 1, Math.ceil((opts.minHz ?? 0) / df));
    const hiBin = Math.min(psd.length - 1 - LOBE_BINS, Math.floor((opts.maxHz ?? Infinity) / df));
    const candidates: number[] = [];
    for (let k = loBin; k <= hiBin; k++) {
        const p = psd[k];
        if (p <= 0 || floor[k] <= 0) {
            continue;
        }
        let isMax = true;
        for (let j = k - LOBE_BINS; j <= k + LOBE_BINS; j++) {
            if (j !== k && (psd[j] > p || (psd[j] === p && j < k))) {
                isMax = false;
                break;
            }
        }
        if (isMax && 10 * Math.log10(p / floor[k]) >= minProm) {
            candidates.push(k);
        }
    }
    candidates.sort((a, b) => psd[b] - psd[a]);
    return candidates.slice(0, maxPeaks).map((k) => {
        const a = Math.log(Math.max(psd[k - 1], 1e-300));
        const b = Math.log(psd[k]);
        const c = Math.log(Math.max(psd[k + 1], 1e-300));
        const denom = a - 2 * b + c;
        const delta = denom !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
        const hz = (k + delta) * df;
        let power = 0;
        for (let j = k - LOBE_BINS; j <= k + LOBE_BINS; j++) {
            power += psd[j];
        }
        power *= df;
        const rmsG = Math.sqrt(power);
        const amp = rmsG * Math.SQRT2 * G_MM_S2;
        const w = 2 * Math.PI * hz;
        let axisShare: number[] | null = null;
        if (perAxis && perAxis.length > 1) {
            const shares = perAxis.map((axis) => {
                let s = 0;
                for (let j = k - LOBE_BINS; j <= k + LOBE_BINS; j++) {
                    s += axis[j];
                }
                return s;
            });
            const total = shares.reduce((s, v) => s + v, 0) || 1;
            axisShare = shares.map((s) => round(s / total, 3));
        }
        return {
            hz: round(hz, 2),
            psdDb: round(10 * Math.log10(psd[k]), 1),
            prominenceDb: round(10 * Math.log10(psd[k] / floor[k]), 1),
            rmsG: round(rmsG, 6),
            velocityPkMmS: round(amp / w, 4),
            displacementPkUm: round((amp / (w * w)) * 1000, 4),
            axisShare,
        };
    });
}

// --------------------------------------------------------------- RPM comb

export interface CombOptions {
    minRpm: number;
    maxRpm: number;
    /** [harmonic, weight]: 1x is unbalance/runout, flutes x is tooth passing. */
    harmonics?: Array<[number, number]>;
}

export interface CombFit {
    rpm: number;
    hz: number;
    /** (best - median) / std of the candidate scores; below ~3 is not a lock. */
    confidence: number;
    /** Excess over the floor at each harmonic used, dB. */
    harmonicsDb: Array<{ k: number; hz: number; excessDb: number }>;
    /** A clear line (>= 6 dB) at half the fitted rate: an octave error cannot be ruled out. */
    halfRateAmbiguous: boolean;
    /** The fit sat on the edge of the searched band: not a lock. */
    edge: boolean;
}

/** A line at f0 / 2 this far over the floor (6 dB, natural log units) makes the fit's octave ambiguous. */
const HALF_RATE_LINE = Math.log(4);

/** A harmonic takes part in the frequency refinement only this far over the floor (10 dB, natural log units). */
const REFINE_MIN_EXCESS = Math.log(10);

export const DEFAULT_COMB_HARMONICS: Array<[number, number]> = [[1, 1.0], [2, 0.6], [3, 0.4]];

/**
 * Fit a harmonic comb k * f0 over [minRpm, maxRpm]/60 to the excess of the
 * PSD over its running-median floor (so a harmonic in a quiet band counts as
 * much as one in a loud band). Returns null when the band is outside the
 * spectrum or too narrow to search.
 */
export function combRpm(psd: Float64Array, df: number, opts: CombOptions, floor: Float64Array | null = null): CombFit | null {
    const harmonics = opts.harmonics && opts.harmonics.length ? opts.harmonics : DEFAULT_COMB_HARMONICS;
    const nyquist = df * (psd.length - 1);
    const fLo = opts.minRpm / 60;
    const fHi = Math.min(opts.maxRpm / 60, nyquist * 0.95);
    if (!(fHi > fLo) || fLo <= df) {
        return null;
    }
    const fl = floor || runningMedian(psd, 15);
    const excess = new Float64Array(psd.length);
    for (let k = 0; k < psd.length; k++) {
        excess[k] = psd[k] > 0 && fl[k] > 0 ? Math.log(psd[k] / fl[k]) : 0;
    }
    // A harmonic's value is the best bin within +-1 of where it should be:
    // a tone between bins must not lose to its neighbour.
    const at = (hz: number): number => {
        const k = Math.round(hz / df);
        if (k < 1 || k >= psd.length - 1) {
            return NaN;
        }
        return Math.max(excess[k - 1], excess[k], excess[k + 1]);
    };
    // Every harmonic's weight counts, in range or not: dividing by the
    // in-range weights only let 2 x f0 (whose upper harmonics fall past
    // Nyquist) beat the true f0 of a 2-flute cut with a weak 1x line - an
    // octave error at full confidence (review, 2026-10-04).
    const wsum = harmonics.reduce((sum, [, w]) => sum + w, 0);
    const score = (f0: number): number => {
        let s = 0;
        for (const [k, w] of harmonics) {
            const v = at(k * f0);
            if (Number.isFinite(v)) {
                s += w * v;
            }
        }
        return wsum > 0 ? s / wsum : -Infinity;
    };
    const step = df / 4;
    const count = Math.floor((fHi - fLo) / step) + 1;
    if (count < 8) {
        return null;
    }
    const scores = new Float64Array(count);
    let best = 0;
    for (let i = 0; i < count; i++) {
        scores[i] = score(fLo + i * step);
        if (scores[i] > scores[best]) {
            best = i;
        }
    }
    const finite = Array.from(scores).filter(Number.isFinite).sort((a, b) => a - b);
    const median = finite[finite.length >> 1];
    const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
    const std = Math.sqrt(finite.reduce((s, v) => s + (v - mean) ** 2, 0) / finite.length) || 1e-9;
    let f0 = fLo + best * step;
    if (best > 0 && best < count - 1) {
        const a = scores[best - 1];
        const b = scores[best];
        const c = scores[best + 1];
        const denom = a - 2 * b + c;
        if (denom < 0) {
            f0 += Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) * step;
        }
    }
    // The grid scores a harmonic by the best bin within +-1, so its argmax
    // is only good to a bin; refine from the harmonics themselves: each
    // clear one's parabolic peak frequency f_k ~ k f0, weighted least
    // squares (higher harmonics pin f0 harder).
    let num = 0;
    let den = 0;
    for (const [k, w] of harmonics) {
        const centre = Math.round((k * f0) / df);
        if (centre < 2 || centre >= psd.length - 2) {
            continue;
        }
        // The grid's best point can sit anywhere on a ~3-bin plateau of a
        // strong line, so look +-2 bins for the line itself.
        let peakBin = centre;
        for (let j = Math.max(1, centre - 2); j <= Math.min(psd.length - 2, centre + 2); j++) {
            if (psd[j] > psd[peakBin]) {
                peakBin = j;
            }
        }
        // Only a clear line pins f0: a noise bin a few dB over the median
        // floor at 3 x f0 pulled a 5 s capture 30 RPM off (2026-10-04).
        if (excess[peakBin] < REFINE_MIN_EXCESS) {
            continue;
        }
        const a = Math.log(Math.max(psd[peakBin - 1], 1e-300));
        const b = Math.log(psd[peakBin]);
        const c = Math.log(Math.max(psd[peakBin + 1], 1e-300));
        const denom = a - 2 * b + c;
        const fk = (peakBin + (denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0)) * df;
        num += w * k * fk;
        den += w * k * k;
    }
    if (den > 0) {
        const refined = num / den;
        if (Math.abs(refined - f0) <= 2 * df) {
            f0 = refined;
        }
    }
    // Half the rate is a real possibility when there is a line there: a
    // clear tone at f0 / 2 means f0 may be its second harmonic.
    const halfBin = Math.round(f0 / 2 / df);
    const halfLine = halfBin >= 1 && halfBin < psd.length - 1
        ? Math.max(excess[halfBin - 1], excess[halfBin], excess[halfBin + 1])
        : 0;
    const edgeBins = Math.max(2, Math.round(count * 0.01));
    return {
        rpm: round(f0 * 60, 1),
        hz: round(f0, 3),
        confidence: round((scores[best] - median) / std, 2),
        harmonicsDb: harmonics
            .filter(([k]) => k * f0 < nyquist)
            .map(([k]) => ({ k, hz: round(k * f0, 2), excessDb: round((10 / Math.LN10) * at(k * f0), 1) })),
        halfRateAmbiguous: halfLine >= HALF_RATE_LINE,
        edge: best < edgeBins || best > count - 1 - edgeBins,
    };
}

/**
 * Peaks that are NOT within maskHz of any multiple of f0 (up to the
 * spectrum's top): chatter and structural resonances excited by the cut.
 */
export function nonHarmonicPeaks(peaks: Peak[], f0Hz: number, maskHz: number): Peak[] {
    if (!(f0Hz > 0)) {
        return peaks.slice();
    }
    return peaks.filter((peak) => {
        const k = Math.max(1, Math.round(peak.hz / f0Hz));
        return Math.abs(peak.hz - k * f0Hz) > maskHz;
    });
}

// ------------------------------------------------------- spatial periods

export interface OrderedPeak extends Peak {
    /** Cycles per mm of travel at the stated speed. */
    cyclesPerMm: number;
    /** mm of travel per cycle - the length that identifies the component. */
    wavelengthMm: number;
    /** Each named reference length / wavelength (cycles per reference length): ~1, 2, 1/2 ... ties the tone to it. */
    orders: { [name: string]: number };
}

/**
 * Express peaks measured during a constant-speed move as spatial periods.
 * `references` are named lengths the caller knows (screw lead, belt tooth
 * pitch, full-step length); a tone whose wavelength is a small integer
 * multiple or fraction of one is that component's.
 */
export function spatialOrders(peaks: Peak[], speedMmS: number, references: { [name: string]: number } = {}): OrderedPeak[] {
    return peaks.map((peak) => {
        const cyclesPerMm = peak.hz / speedMmS;
        const wavelengthMm = speedMmS / peak.hz;
        const orders: { [name: string]: number } = {};
        for (const [name, length] of Object.entries(references)) {
            if (length > 0) {
                orders[name] = round(length * cyclesPerMm, 3);
            }
        }
        return { ...peak, cyclesPerMm: round(cyclesPerMm, 4), wavelengthMm: round(wavelengthMm, 4), orders };
    });
}

// ------------------------------------------------------ activity envelope

/**
 * Vibration envelope: each channel high-passed by a one-pole filter at
 * `hpHz` (removes gravity and slow tilt), then the RMS of the vector
 * magnitude over consecutive windows of `windowS`. Streaming, so a capture
 * of any length costs one float per window.
 */
export class EnvelopeAccumulator {
    public readonly windowS: number;

    public readonly values: number[] = [];

    private readonly alpha: number;

    private readonly windowSamples: number;

    private prevIn: number[] | null = null;

    private prevOut: number[];

    private acc = 0;

    private count = 0;

    public constructor(fs: number, channels: number, hpHz: number, windowS: number) {
        const rc = 1 / (2 * Math.PI * hpHz);
        const dt = 1 / fs;
        this.alpha = rc / (rc + dt);
        this.windowSamples = Math.max(1, Math.round(fs * windowS));
        // The window actually used: whole samples (at 13 Hz, 0.05 s is one
        // sample = 0.077 s, and every segment time would be off by 35 %).
        this.windowS = this.windowSamples / fs;
        this.prevOut = new Array(channels).fill(0);
    }

    /** Push interleaved frames (`channels` values each). */
    public push(interleaved: ArrayLike<number>, channels: number, frames: number): void {
        for (let i = 0; i < frames; i++) {
            let mag2 = 0;
            const base = i * channels;
            if (!this.prevIn) {
                this.prevIn = [];
                for (let c = 0; c < channels; c++) {
                    this.prevIn.push(interleaved[base + c]);
                }
            }
            for (let c = 0; c < channels; c++) {
                const x = interleaved[base + c];
                const y = this.alpha * (this.prevOut[c] + x - this.prevIn[c]);
                this.prevIn[c] = x;
                this.prevOut[c] = y;
                mag2 += y * y;
            }
            this.acc += mag2;
            this.count++;
            if (this.count === this.windowSamples) {
                this.values.push(Math.sqrt(this.acc / this.count));
                this.acc = 0;
                this.count = 0;
            }
        }
    }
}

export interface ActivitySegment {
    startS: number;
    endS: number;
    /** Envelope RMS inside the segment, g. */
    rmsG: number;
}

export interface SegmentOptions {
    /** Gaps shorter than this inside one movement are bridged. */
    bridgeS?: number;
    /** Shorter bursts are not movements. */
    minS?: number;
    /** Threshold position between the quiet floor (p20) and the busy level (p95). */
    thresholdFraction?: number;
    /** The busy level must be at least this multiple of the floor, else nothing moved. */
    minContrast?: number;
}

/**
 * Cut an envelope into active segments (an axis moving, a spindle cutting)
 * and quiet gaps (dwells). Returns [] when the record has no contrast - one
 * long steady state is not a set of segments.
 */
export interface Segmentation {
    segments: ActivitySegment[];
    floorG: number;
    busyG: number;
    thresholdG: number;
}

export function segmentActivity(envelope: number[], windowS: number, opts: SegmentOptions = {}): Segmentation {
    const sorted = envelope.slice().sort((a, b) => a - b);
    const pick = (q: number): number => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
    const floorG = pick(0.2);
    const busyG = pick(0.95);
    const thresholdG = floorG + (opts.thresholdFraction ?? 0.25) * (busyG - floorG);
    const result = { segments: [] as ActivitySegment[], floorG, busyG, thresholdG };
    if (!sorted.length || busyG < (opts.minContrast ?? 2) * Math.max(floorG, 1e-9)) {
        return result;
    }
    const bridge = Math.round((opts.bridgeS ?? 0.2) / windowS);
    const minLen = Math.round((opts.minS ?? 0.3) / windowS);
    const runs: Array<[number, number]> = [];
    let start = -1;
    for (let i = 0; i <= envelope.length; i++) {
        const on = i < envelope.length && envelope[i] >= thresholdG;
        if (on && start < 0) {
            start = i;
        } else if (!on && start >= 0) {
            runs.push([start, i]);
            start = -1;
        }
    }
    const merged: Array<[number, number]> = [];
    for (const run of runs) {
        const last = merged[merged.length - 1];
        if (last && run[0] - last[1] <= bridge) {
            last[1] = run[1];
        } else {
            merged.push([run[0], run[1]]);
        }
    }
    for (const [a, b] of merged) {
        if (b - a < minLen) {
            continue;
        }
        let s = 0;
        for (let i = a; i < b; i++) {
            s += envelope[i] * envelope[i];
        }
        result.segments.push({ startS: round(a * windowS, 3), endS: round(b * windowS, 3), rmsG: round(Math.sqrt(s / (b - a)), 6) });
    }
    return result;
}

export interface MotionLeg {
    /** Machine coordinate on the moving axis where the leg starts and ends, mm. */
    from: number;
    to: number;
}

export interface PositionBin {
    /** Bin centre on the moving axis, mm (machine). */
    at: number;
    direction: '+' | '-';
    rmsG: number;
    windows: number;
}

/**
 * Bin the envelope by position along a moving axis. Segment i is leg i: the
 * caller states the legs (the targets it moved through), the segmentation
 * found the movements, and they must agree in number - if they do not,
 * nothing is mapped (a guessed correspondence would put noise at the wrong
 * place on the rail). Inside a leg, position is linear in time between the
 * segment's ends (average speed: acceleration ramps smear the first and last
 * few mm, which is reported).
 */
export function positionProfile(envelope: number[], windowS: number, segments: ActivitySegment[], legs: MotionLeg[], binMm: number): {
    ok: boolean; reason: string | null; bins: PositionBin[]; legs: Array<{ from: number; to: number; durationS: number; averageSpeedMmS: number }>;
} {
    if (segments.length !== legs.length) {
        return {
            ok: false,
            reason: `found ${segments.length} movement(s) in the record but ${legs.length} leg(s) were stated - not mapping noise to positions on a guessed correspondence`,
            bins: [],
            legs: [],
        };
    }
    const acc = new Map<string, { at: number; direction: '+' | '-'; sum: number; n: number }>();
    const legReport: Array<{ from: number; to: number; durationS: number; averageSpeedMmS: number }> = [];
    segments.forEach((segment, i) => {
        const leg = legs[i];
        const duration = segment.endS - segment.startS;
        legReport.push({
            from: leg.from,
            to: leg.to,
            durationS: round(duration, 3),
            averageSpeedMmS: round(Math.abs(leg.to - leg.from) / Math.max(duration, 1e-6), 2),
        });
        const direction: '+' | '-' = leg.to >= leg.from ? '+' : '-';
        const a = Math.floor(segment.startS / windowS);
        const b = Math.min(envelope.length, Math.ceil(segment.endS / windowS));
        for (let w = a; w < b; w++) {
            const frac = Math.min(1, Math.max(0, ((w + 0.5) * windowS - segment.startS) / Math.max(duration, 1e-6)));
            const pos = leg.from + frac * (leg.to - leg.from);
            const centre = (Math.floor(pos / binMm) + 0.5) * binMm;
            const key = `${direction}${centre}`;
            const slot = acc.get(key) || { at: centre, direction, sum: 0, n: 0 };
            slot.sum += envelope[w] * envelope[w];
            slot.n++;
            acc.set(key, slot);
        }
    });
    const bins = [...acc.values()]
        .map((slot) => ({ at: round(slot.at, 3), direction: slot.direction, rmsG: round(Math.sqrt(slot.sum / slot.n), 6), windows: slot.n }))
        .sort((p, q) => (p.direction === q.direction ? p.at - q.at : p.direction.localeCompare(q.direction)));
    return { ok: true, reason: null, bins, legs: legReport };
}
