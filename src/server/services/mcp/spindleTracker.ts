// Spindle RPM, chatter and runout from a microphone, tracked live.
//
// A port of the tested reference tracker (endmill_burn_calibration/
// rpm_from_audio.py, --selftest passes on synthetic data) into a streaming
// form. The spindle's sound carries its speed as a comb of rotation
// harmonics at k x RPM/60; k = 4 is the tooth-passing tone of a 4-flute
// cutter and dominates while cutting. Each 0.15 s frame is scored for every
// candidate rev frequency within 0.80-1.05 x the commanded S/60 by the
// weighted log power at harmonics {1, 2, 3, 4, 8}; the best candidate is
// refined parabolically. Where the reference aligned a recording to a
// predicted timeline, this tracker is told, per frame, what the machine
// was executing (spindleProgram.ts, from the line number the controller
// reports), so a cut is a cut because the file says so.
//
// Per spindle epoch (one commanded S) it keeps an UNLOADED baseline (free
// frames after the spin-up settles) and the LOADED frames (feed moves) and
// derives, exactly as the reference's grade() / surface_flags():
//   - sag / blip / reach verdicts from the 0.3 s rolling median of RPM
//     relative to the baseline median;
//   - a runout index: (1x-rev power gain while cutting) - (4x tooth-pass
//     gain), dB vs baseline; above -3 dB one flute is doing the work;
//   - chatter: the strongest cut-only tone in 300-6000 Hz that is NOT a
//     rotation harmonic, with the harmonics masked PER FRAME at that frame's
//     tracked RPM (so an RPM dip cannot move a harmonic out of the mask and
//     fake chatter); flagged when > 12 dB above the band median and > 10 dB
//     above the baseline.
// Alerts only: nothing here can touch the machine.
//
// Pure: no server imports, unit-tested in tests/spindleTracker.test.ts.

import { LineKind } from './spindleProgram';

export const SAMPLE_RATE = 16000;
export const WINDOW_S = 0.15;
export const HOP_S = 0.05;
export const NFFT = 16384;
export const WINDOW_SAMPLES = Math.round(WINDOW_S * SAMPLE_RATE);
export const HOP_SAMPLES = Math.round(HOP_S * SAMPLE_RATE);
export const BIN_HZ = SAMPLE_RATE / NFFT;
export const NBINS = NFFT / 2 + 1;
/** The live spectrogram's axis: log-spaced bins from 30 Hz (mains hum and gantry combs) to 8 kHz. */
export const SPECTRUM_BINS = 96;
export const SPECTRUM_LO_HZ = 30;
export const SPECTRUM_HI_HZ = 8000;
/** harmonic -> weight (4 = tooth pass of a 4-flute cutter) */
export const HARMONICS: Array<[number, number]> = [[1, 0.6], [2, 0.6], [3, 0.4], [4, 1.0], [8, 0.5]];
/** Search f_rev within this x commanded S/60. */
export const SEARCH_BAND: [number, number] = [0.80, 1.05];
const CANDIDATES = 500;
export const CHATTER_BAND_HZ: [number, number] = [300, 6000];
/**
 * The MOTION comb: the gantry (steppers, lead screws, frame) sings its own
 * harmonic series - 205 Hz and multiples at the A350's rapid speed, lower
 * at cutting feeds - and it must be seen as a separate thing from the
 * spindle, not mistaken for it. Every frame fits the strongest comb whose
 * fundamental lies in MOTION_BAND_HZ with the spindle's harmonics masked
 * out; a spindle candidate whose fundamental coincides with a stronger
 * motion harmonic is not a lock.
 */
export const MOTION_BAND_HZ: [number, number] = [20, 400];
const MOTION_HARMONICS = 8;
const MOTION_CANDIDATES = 760;
/** Octave-ish level bands recorded per frame (Hz edges). */
export const LEVEL_BANDS_HZ = [50, 100, 200, 400, 800, 1600, 3200, 6400, 8000];
const HARMONIC_MASK_REL = 0.025;
/**
 * A 0.15 s Hann window resolves +-13 Hz (main lobe), wider than 2.5 % of the
 * low harmonics (298 Hz at 17 900 RPM: +-7.5 Hz), so a mask that narrow would
 * leave the 1x line's own leakage reading as a 20 dB "non-harmonic" tone.
 * The mask is never narrower than the second null of the window.
 */
const MASK_MIN_HZ = 20;
const MASK_HARMONICS = 40;
const BAND_PEAK_REL = 0.012;

// Verdict thresholds (the operator's rule: minor blips OK, struggling not).
export const RULES = {
    /** Baseline frames start this long after the epoch's S command (spin-up). */
    spinUpMs: 2000,
    /** Frames this soon after the reported line kind changed are neither baseline nor cut (poll slop). */
    transitionGuardMs: 500,
    /** Rolling median window over the tracked RPM. */
    rollingMs: 300,
    /** A dip is the rolling median below this fraction of the baseline. */
    dipRel: 0.97,
    /** A dip lasting at least this long is a sag, shorter is a blip. */
    sagMs: 1000,
    /** Time below this fraction is reported as "time below 95 %". */
    deepRel: 0.95,
    /** Loaded median more than this below the baseline is a sag. */
    medianDropRel: 0.03,
    /** Unloaded baseline more than this off the commanded S is a reach failure. */
    reachRel: 0.02,
    /** Comb confidence below this = no lock (frame ignored by the rules). */
    minConfidence: 2.0,
    /**
     * A tracked RPM within this fraction of the search band's edges is a
     * failed lock, not a measurement: a clipped or noisy frame falls to the
     * edge (measured 2026-09-29: every "dip" of a clipped run bottomed at
     * exactly 0.80 x S) and would otherwise read as a sag.
     */
    edgeLockRel: 0.01,
    /** Baseline frames also need the RPM settled: the 1 s median within this of the median 1 s earlier (the A350 ramps ~20 s). */
    settleRel: 0.003,
    settleWindowMs: 1500,
    /**
     * Sags are judged against the UNLOADED baseline (the operator's rule and
     * the reference script): the rolling median of the most recent settled
     * free frames. The best sustained loaded median is reported beside it,
     * not used. Measured 2026-09-29 (job d8006b17b237): the A350's 200 W
     * spindle at S8000 reaches ~8010-8030 RPM within 2 s of M3 and holds it
     * unloaded; a 1 mm x 4 mm skim at F500 runs it at 7980-8000 (0.3 %).
     * The "7477 RPM soft-start plateau" read earlier that day was the Z
     * axis descending at the modal F500 - a gantry comb at 125 Hz.
     */
    /** RMS level at or above this (dBFS) is clipping; reported, and the frame's spectrum is not trusted. */
    clipDb: -0.5,
    /** A spindle lock below this confidence is contested when a confident motion comb out-powers it by contestedMarginLn (ln 4 = 6 dB). */
    contestedSpindleConfidence: 3.0,
    contestedMarginLn: Math.log(4),
    /** While moving, a spindle candidate within this fraction of a gantry-comb harmonic is ambiguous. */
    ambiguousRel: 0.02,
    /**
     * A candidate whose 2x line is at least this many dB above its 1x line
     * has the gantry's shape, not the spindle's: the A350's Y and Z axes at
     * F500 sing a 124.5 Hz comb (= 7470 RPM, inside the S8000 band) with the
     * 249 Hz second harmonic 15-17 dB over the fundamental (jobs
     * b3e8f3dd0e34, d8006b17b237), while the spindle's fundamental is its
     * strongest low harmonic idle and cutting (1x +29, 2x +23 dB idle at
     * 8010; 1x +26, 2x +15 cutting). Recorded, never a lock.
     */
    gantryShapeDb: 10,
    gantryShapeFrames: 5,
    /** The idle baseline is the median of the most recent settled free frames (3 s): it follows the spindle while it is still settling. */
    baselineRecentFrames: 60,
    minBaselineFrames: 5,
    minCutFrames: 5,
    runoutIndexDb: -3.0,
    chatterExcessDb: 12.0,
    chatterVsBaseDb: 10.0,
    /** Re-evaluate chatter / runout on a long cut every this often. */
    surfaceCheckMs: 5000,
    /** Blip events emitted per epoch before they are only counted. */
    maxBlipEvents: 10,
};

// ------------------------------------------------------------------ FFT

/** Iterative radix-2 complex FFT with cached tables, sized once. */
export class Fft {
    private readonly n: number;

    private readonly cos: Float64Array;

    private readonly sin: Float64Array;

    private readonly rev: Uint32Array;

    public constructor(n: number) {
        if (n < 2 || (n & (n - 1)) !== 0) {
            throw new Error('FFT size must be a power of two');
        }
        this.n = n;
        this.cos = new Float64Array(n / 2);
        this.sin = new Float64Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            this.cos[i] = Math.cos((-2 * Math.PI * i) / n);
            this.sin[i] = Math.sin((-2 * Math.PI * i) / n);
        }
        this.rev = new Uint32Array(n);
        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let r = 0;
            for (let b = 0; b < bits; b++) {
                r = (r << 1) | ((i >> b) & 1);
            }
            this.rev[i] = r;
        }
    }

    /** In-place forward transform of (re, im). */
    public transform(re: Float64Array, im: Float64Array): void {
        const n = this.n;
        for (let i = 0; i < n; i++) {
            const j = this.rev[i];
            if (j > i) {
                let t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
        }
        for (let size = 2; size <= n; size <<= 1) {
            const half = size >> 1;
            const step = n / size;
            for (let start = 0; start < n; start += size) {
                for (let k = 0; k < half; k++) {
                    const wr = this.cos[k * step];
                    const wi = this.sin[k * step];
                    const a = start + k;
                    const b = a + half;
                    const tr = re[b] * wr - im[b] * wi;
                    const ti = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - tr;
                    im[b] = im[a] - ti;
                    re[a] += tr;
                    im[a] += ti;
                }
            }
        }
    }
}

const hann = (() => {
    const w = new Float64Array(WINDOW_SAMPLES);
    for (let i = 0; i < WINDOW_SAMPLES; i++) {
        w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WINDOW_SAMPLES - 1));
    }
    return w;
})();

/** Power spectrum (|X|^2, NBINS bins) of one Hann-windowed frame zero-padded to NFFT. */
export function framePower(fft: Fft, samples: ArrayLike<number>, offset: number, re: Float64Array, im: Float64Array, out: Float64Array): void {
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < WINDOW_SAMPLES; i++) {
        re[i] = samples[offset + i] * hann[i];
    }
    fft.transform(re, im);
    for (let k = 0; k < NBINS; k++) {
        out[k] = re[k] * re[k] + im[k] * im[k];
    }
}

// ------------------------------------------------------------ comb tracker

export interface CombResult {
    rpm: number;
    /** (best score - median score) / std over the candidate scores. */
    confidence: number;
    /** The best candidate sat within RULES.edgeLockRel of the search band's edge: not a lock. */
    edge: boolean;
}

/**
 * f_rev by weighted log-harmonic comb within SEARCH_BAND x sCommanded/60,
 * parabolic peak refinement. `logPower` is ln(power + eps) per bin.
 */
export function combTrack(logPower: Float64Array, sCommanded: number, scores: Float64Array = new Float64Array(CANDIDATES)): CombResult {
    const fr0 = sCommanded / 60;
    const lo = SEARCH_BAND[0] * fr0;
    const hi = SEARCH_BAND[1] * fr0;
    const stepHz = (hi - lo) / (CANDIDATES - 1);
    const maxBin = NBINS - 2;
    let best = 0;
    for (let c = 0; c < CANDIDATES; c++) {
        const f = lo + c * stepHz;
        let score = 0;
        for (const [k, weight] of HARMONICS) {
            const idx = (k * f) / BIN_HZ;
            if (idx >= maxBin) {
                continue;
            }
            const i0 = Math.floor(idx);
            const frac = idx - i0;
            score += weight * ((1 - frac) * logPower[i0] + frac * logPower[i0 + 1]);
        }
        scores[c] = score;
        if (score > scores[best]) {
            best = c;
        }
    }
    let f = lo + best * stepHz;
    if (best > 0 && best < CANDIDATES - 1) {
        const y0 = scores[best - 1];
        const y1 = scores[best];
        const y2 = scores[best + 1];
        const den = y0 - 2 * y1 + y2;
        const off = den !== 0 ? (0.5 * (y0 - y2)) / den : 0;
        f += off * stepHz;
    }
    // Confidence: the peak's prominence over the candidate score distribution.
    let sum = 0;
    let sumSq = 0;
    for (let c = 0; c < CANDIDATES; c++) {
        sum += scores[c];
        sumSq += scores[c] * scores[c];
    }
    const mean = sum / CANDIDATES;
    const std = Math.sqrt(Math.max(0, sumSq / CANDIDATES - mean * mean));
    const sorted = Float64Array.from(scores).sort();
    const medianScore = sorted[CANDIDATES >> 1];
    const edge = f <= lo * (1 + RULES.edgeLockRel) || f >= hi * (1 - RULES.edgeLockRel);
    return { rpm: 60 * f, confidence: (scores[best] - medianScore) / (std + 1e-9), edge };
}

// ------------------------------------------------------------ band helpers

const BAND_LO_BIN = Math.ceil(CHATTER_BAND_HZ[0] / BIN_HZ);
const BAND_HI_BIN = Math.min(NBINS - 1, Math.floor(CHATTER_BAND_HZ[1] / BIN_HZ));
const BAND_BINS = BAND_HI_BIN - BAND_LO_BIN + 1;

/** Max power (dB) within +-BAND_PEAK_REL of fc. */
function peakDb(power: Float64Array, fc: number): number {
    const lo = Math.max(0, Math.ceil((fc * (1 - BAND_PEAK_REL)) / BIN_HZ));
    const hi = Math.min(NBINS - 1, Math.floor((fc * (1 + BAND_PEAK_REL)) / BIN_HZ));
    if (hi < lo) {
        return -180;
    }
    let best = 0;
    for (let k = lo; k <= hi; k++) {
        if (power[k] > best) {
            best = power[k];
        }
    }
    return 10 * Math.log10(best + 1e-18);
}

/** Mark the rotation harmonics (+-2.5 %) of fRev as false in a band mask. */
function harmonicMask(fRev: number, mask: Uint8Array): void {
    mask.fill(1);
    for (let k = 1; k <= MASK_HARMONICS; k++) {
        const f = k * fRev;
        const half = Math.max(HARMONIC_MASK_REL * f, MASK_MIN_HZ);
        const lo = Math.max(BAND_LO_BIN, Math.ceil((f - half) / BIN_HZ));
        const hi = Math.min(BAND_HI_BIN, Math.floor((f + half) / BIN_HZ));
        for (let b = lo; b <= hi; b++) {
            mask[b - BAND_LO_BIN] = 0;
        }
        if (f - half > CHATTER_BAND_HZ[1]) {
            break;
        }
    }
}

function median(values: ArrayLike<number>): number {
    const n = values.length;
    if (!n) {
        return NaN;
    }
    const sorted = Float64Array.from(values).sort();
    return n % 2 ? sorted[(n - 1) / 2] : 0.5 * (sorted[n / 2 - 1] + sorted[n / 2]);
}

// -------------------------------------------------------------- analyser

/** What the machine was executing when a frame was captured. */
export interface FrameContext {
    /** Commanded S (null = spindle off / unknown: the frame is not tracked). */
    s: number | null;
    kind: LineKind;
    /** Feed in effect (mm/min) for rib spacing; null if unknown. */
    feed: number | null;
    /** Spindle epoch index (a new S starts a new epoch); -1 when off. */
    epoch: number;
    /** ms since the reported line kind last changed (poll slop guard). */
    sinceTransitionMs: number;
    /** ms since the epoch's S command was reported. */
    sinceEpochMs: number;
}

export type FrameRole = 'off' | 'spinup' | 'transition' | 'baseline' | 'cut';

export interface FrameResult {
    /** Frame centre, ms from the analyser's start. */
    tMs: number;
    epoch: number;
    role: FrameRole;
    sCommanded: number | null;
    rpm: number;
    confidence: number;
    /** Rolling-median RPM relative to the epoch baseline (NaN outside cuts). */
    rel: number;
    /** Strongest non-harmonic tone in the chatter band this frame: dB over the band median. */
    chatterExcessDb: number;
    chatterHz: number;
    /** Live runout index for the epoch so far (NaN until both sets exist). */
    runoutIndexDb: number;
    /** Wall-clock cost of analysing this frame, ms. */
    costMs: number;
    /** Frame loudness: RMS of the raw samples in dBFS (0 = full scale), every frame including 'off'. */
    levelDb: number;
    /** The frame's RMS reached RULES.clipDb: the microphone gain is too high. */
    clipped: boolean;
    /** The comb fell to the search band's edge (or was clipped / unconfident): no RPM lock this frame. */
    locked: boolean;
    /** Fundamental of the strongest harmonic series in MOTION_BAND_HZ with the spindle masked (gantry / frame tone), Hz. */
    motionHz: number;
    /** Level of that series' strongest harmonic, dBFS-ish (10 log10 power). */
    motionDb: number;
    /** Prominence of the motion comb over the candidate scores. */
    motionConf: number;
    /** Level per LEVEL_BANDS_HZ band (dB), every frame. */
    bands: number[];
    /** The spindle candidate coincided with a stronger motion-comb harmonic: not trusted as the spindle. */
    contested: boolean;
    /** The head was moving and the spindle candidate sits on a harmonic of the gantry's own (unmasked) comb: recorded, not used as RPM. */
    ambiguous: boolean;
    /** The candidate's 2x line dominates its 1x by RULES.gantryShapeDb: the Y/Z gantry comb, whatever the context says. Never a lock. */
    gantryLike: boolean;
}

/** Is `hz` within the spindle's harmonic mask (+-2.5 % or +-MASK_MIN_HZ of any k x fRev)? */
function nearSpindleHarmonic(hz: number, fRev: number | null): boolean {
    if (fRev === null || !(fRev > 0)) {
        return false;
    }
    const k = Math.round(hz / fRev);
    if (k < 1) {
        return false;
    }
    const f = k * fRev;
    return Math.abs(hz - f) <= Math.max(HARMONIC_MASK_REL * f, MASK_MIN_HZ);
}

/** Strongest harmonic series with a fundamental in MOTION_BAND_HZ, skipping bins on the spindle's harmonics (any frequency). */
export function motionComb(logPower: Float64Array, spindleFRev: number | null): { hz: number; confidence: number; peakDb: number; meanLog: number } {
    const lo = MOTION_BAND_HZ[0];
    const hi = MOTION_BAND_HZ[1];
    const stepHz = (hi - lo) / (MOTION_CANDIDATES - 1);
    const scores = new Float64Array(MOTION_CANDIDATES);
    let best = 0;
    for (let c = 0; c < MOTION_CANDIDATES; c++) {
        const f = lo + c * stepHz;
        let score = 0;
        let used = 0;
        for (let k = 1; k <= MOTION_HARMONICS; k++) {
            const bin = Math.round((k * f) / BIN_HZ);
            if (bin >= NBINS - 1) {
                break;
            }
            if (nearSpindleHarmonic(k * f, spindleFRev)) {
                continue;
            }
            score += logPower[bin];
            used += 1;
        }
        scores[c] = used ? score / used : -Infinity;
        if (scores[c] > scores[best]) {
            best = c;
        }
    }
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let c = 0; c < MOTION_CANDIDATES; c++) {
        if (Number.isFinite(scores[c])) {
            sum += scores[c];
            sumSq += scores[c] * scores[c];
            n += 1;
        }
    }
    const mean = n ? sum / n : 0;
    const std = n ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 1;
    const f = lo + best * stepHz;
    let peak = -Infinity;
    for (let k = 1; k <= MOTION_HARMONICS; k++) {
        const bin = Math.round((k * f) / BIN_HZ);
        if (bin < NBINS && logPower[bin] > peak) {
            peak = logPower[bin];
        }
    }
    return { hz: f, confidence: (scores[best] - mean) / (std + 1e-9), peakDb: (10 * peak) / Math.LN10, meanLog: scores[best] };
}

/** dB level in each LEVEL_BANDS_HZ band of a power spectrum. */
export function bandLevels(power: Float64Array): number[] {
    const out: number[] = [];
    for (let b = 0; b + 1 < LEVEL_BANDS_HZ.length; b++) {
        const lo = Math.ceil(LEVEL_BANDS_HZ[b] / BIN_HZ);
        const hi = Math.min(NBINS - 1, Math.floor(LEVEL_BANDS_HZ[b + 1] / BIN_HZ));
        let sum = 0;
        for (let k = lo; k <= hi; k++) {
            sum += power[k];
        }
        out.push(10 * Math.log10(sum / Math.max(1, hi - lo + 1) + 1e-18));
    }
    return out;
}

export type SpindleEventKind = 'spindle_sag' | 'spindle_blip' | 'spindle_reach' | 'chatter' | 'runout' | 'spindle_nolock' | 'spindle_epoch';

export interface SpindleEvent {
    kind: SpindleEventKind;
    tMs: number;
    epoch: number;
    sCommanded: number;
    note: string;
    [detail: string]: unknown;
}

export type Verdict = 'HOLD' | 'BLIP' | 'STRUGGLE' | 'NO-LOCK' | 'NO-BASELINE' | 'NO-CUT';

export interface EpochSummary {
    epoch: number;
    sCommanded: number;
    feed: number | null;
    startMs: number;
    endMs: number;
    baselineFrames: number;
    cutFrames: number;
    baselineRpm: number | null;
    baselineSource: 'epoch' | 'previous-epoch' | 'commanded';
    /** loadedRef / commanded - 1 once a loaded reference exists, else idle / commanded - 1. */
    reachError: number | null;
    reachFlag: boolean;
    /** Unloaded (idle) RPM / commanded - 1: how far the free-running spindle sits from S. */
    idleError: number | null;
    /** The regulated speed under load: the best 0.3 s rolling median sustained while cutting. */
    loadedRefRpm: number | null;
    cutMedianRpm: number | null;
    cutMinRpm: number | null;
    /** 1 - median(cut / baseline) */
    medianDrop: number | null;
    minRel: number | null;
    longestBelow97Ms: number;
    timeBelow95Ms: number;
    timeBelow97Ms: number;
    blips: number;
    sags: number;
    verdict: Verdict;
    runoutIndexDb: number | null;
    runoutFlag: boolean;
    chatterHz: number | null;
    chatterExcessDb: number | null;
    chatterVsBaseDb: number | null;
    chatterFlag: boolean;
    /** Rib spacing implied by the chatter tone, vf / f (mm). */
    chatterRibMm: number | null;
    /** Rib spacing of one-flute-dominant cutting, F / S (mm per rev). */
    revRibMm: number | null;
}

interface DipState {
    startMs: number;
    minRel: number;
    sagEmitted: boolean;
}

class Epoch {
    public readonly index: number;

    public readonly s: number;

    public readonly startMs: number;

    public endMs: number;

    public feed: number | null = null;

    public baselineRpm: number[] = [];

    public baselineP1: number[] = [];

    public baselineP4: number[] = [];

    public baselineMasked = new Float64Array(BAND_BINS);

    public baselineMaskedN = new Uint32Array(BAND_BINS);

    public baselineFrames = 0;

    public cutRpm: number[] = [];

    public cutT: number[] = [];

    public cutRel: number[] = [];

    public cutConf: number[] = [];

    public cutP1: number[] = [];

    public cutP4: number[] = [];

    public cutMasked = new Float64Array(BAND_BINS);

    public cutMaskedN = new Uint32Array(BAND_BINS);

    public cutFrames = 0;

    public rolling: number[] = [];

    public dip: DipState | null = null;

    public blips = 0;

    public sags = 0;

    public blipEvents = 0;

    public reachEmitted = false;

    public chatterEmitted = false;

    public runoutEmitted = false;

    public baselineSource: EpochSummary['baselineSource'] = 'epoch';

    public baselineOverride: number | null = null;

    /** The best 0.3 s rolling-median RPM sustained while cutting: the loaded reference. */
    public loadedRef: number | null = null;

    /**
     * The reference a cut's rolling median is judged against: the operator's
     * rule and the reference script use the UNLOADED baseline, and with the
     * rolling idle baseline (the most recent settled free frames) that is the
     * spindle's settled speed even if it was still ramping. The best sustained
     * loaded median is reported beside it but not used: a single high
     * mis-lock cluster made it 8280 on job beb4bf0a3d22 and every honest
     * 8000 read as a 3.4 % sag.
     */
    public sagReference(): number | null {
        return this.baseline();
    }

    /** Called with each full rolling window's median while cutting; the reference only ever rises. */
    public noteLoaded(rollingMedian: number): void {
        if (this.loadedRef === null || rollingMedian > this.loadedRef) {
            this.loadedRef = rollingMedian;
        }
    }

    public lastSurfaceCheckMs = 0;

    public lastRunout = NaN;

    /** Lock flags of the last few cut frames; the dip rules run only on a majority-locked window. */
    public lockHistory: boolean[] = [];

    /** Locked RPM readings of free frames, for the spin-up settle test. */
    public spinHistory: Array<[number, number]> = [];

    /** Once settled, an epoch stays settled (a load dip is not a spin-up). */
    public settled = false;

    /** Has the 1 s median of free-frame RPM stopped moving relative to the second before? */
    public isSettled(tMs: number): boolean {
        if (this.settled) {
            return true;
        }
        const recent = this.spinHistory.filter(([at]) => tMs - at <= RULES.settleWindowMs).map(([, rpm]) => rpm);
        const earlier = this.spinHistory.filter(([at]) => tMs - at > RULES.settleWindowMs && tMs - at <= 2 * RULES.settleWindowMs).map(([, rpm]) => rpm);
        if (recent.length < 5 || earlier.length < 5) {
            return false;
        }
        const a = median(recent);
        const b = median(earlier);
        if (Math.abs(a - b) / a <= RULES.settleRel) {
            this.settled = true;
            return true;
        }
        return false;
    }

    public constructor(index: number, s: number, startMs: number) {
        this.index = index;
        this.s = s;
        this.startMs = startMs;
        this.endMs = startMs;
    }

    /** The unloaded RPM this epoch's cuts are judged against. */
    public baseline(): number | null {
        if (this.baselineRpm.length >= RULES.minBaselineFrames) {
            return median(this.baselineRpm.slice(-RULES.baselineRecentFrames));
        }
        return this.baselineOverride;
    }
}

interface PendingFrame {
    result: FrameResult;
    started: number;
    epoch: Epoch;
    role: FrameRole;
    locked: boolean;
    /** RPM moved > 1 % since the previous frame. */
    transient: boolean;
    fRev: number;
    p1: number;
    p4: number;
    /** Chatter-band power with the frame's harmonics zeroed. */
    maskedPower: Float64Array;
    mask: Uint8Array;
    chatterExcess: number;
    chatterHz: number;
}

function accumulateMasked(acc: Float64Array, count: Uint32Array, power: Float64Array, mask: Uint8Array): void {
    for (let b = 0; b < BAND_BINS; b++) {
        if (mask[b]) {
            acc[b] += power[b];
            count[b] += 1;
        }
    }
}

export interface AnalyserOptions {
    contextAt: (tMs: number) => FrameContext | null;
    onFrame?: (frame: FrameResult) => void;
    onEvent?: (event: SpindleEvent) => void;
    /** Analyser clock origin (ms) - frame times are relative to the first sample. */
    now?: () => number;
}

/**
 * Streaming analyser: push mono 16 kHz float samples in any chunk size;
 * every HOP_SAMPLES it analyses one WINDOW frame, calls onFrame, and runs
 * the epoch rules, calling onEvent. finish() closes the last epoch and
 * returns every epoch's summary.
 */
export class SpindleAudioAnalyser {
    private readonly opts: AnalyserOptions;

    private readonly fft = new Fft(NFFT);

    private readonly re = new Float64Array(NFFT);

    private readonly im = new Float64Array(NFFT);

    private readonly power = new Float64Array(NBINS);

    private readonly logPower = new Float64Array(NBINS);

    private readonly scores = new Float64Array(CANDIDATES);

    private readonly mask = new Uint8Array(BAND_BINS);

    private readonly maskedDb = new Float64Array(BAND_BINS);

    private buffer = new Float32Array(SAMPLE_RATE * 2);

    private buffered = 0;

    /** Samples consumed from the stream before the buffer's first sample. */
    private consumed = 0;

    private epochs: Epoch[] = [];

    private current: Epoch | null = null;

    private summaries: EpochSummary[] = [];

    /** The last analysed frame, committed once the following frame's RPM is known. */
    private pending: PendingFrame | null = null;

    public frames = 0;

    /** The last few frames' (2x - 1x) dB for the gantry shape test. */
    private shapeHistory: number[] = [];

    /**
     * The last analysed frame's spectrum on a log frequency axis, SPECTRUM_LO_HZ
     * to SPECTRUM_HI_HZ in `bins` bins (the strongest FFT bin in each, dB):
     * the camera page's spectrogram, where the spindle's comb, the gantry's
     * comb and the mains hum are separate lines.
     */
    public latestSpectrum(bins = SPECTRUM_BINS): { hz: number[]; db: number[] } | null {
        if (!this.frames) {
            return null;
        }
        const ratio = SPECTRUM_HI_HZ / SPECTRUM_LO_HZ;
        const hz: number[] = [];
        const db: number[] = [];
        for (let i = 0; i < bins; i++) {
            const centre = SPECTRUM_LO_HZ * ratio ** (i / (bins - 1));
            const b0 = Math.max(1, Math.round((SPECTRUM_LO_HZ * ratio ** ((i - 0.5) / (bins - 1))) / BIN_HZ));
            const b1 = Math.max(b0, Math.min(NBINS - 1, Math.round((SPECTRUM_LO_HZ * ratio ** ((i + 0.5) / (bins - 1))) / BIN_HZ)));
            let best = -Infinity;
            for (let b = b0; b <= b1; b++) {
                best = Math.max(best, this.logPower[b]);
            }
            hz.push(Math.round(centre));
            db.push(Math.round((10 * best) / Math.LN10));
        }
        return { hz, db };
    }

    public clippedFrames = 0;

    public totalCostMs = 0;

    public maxCostMs = 0;

    public constructor(opts: AnalyserOptions) {
        this.opts = opts;
    }

    public get samplesConsumed(): number {
        return this.consumed + this.buffered;
    }

    public push(samples: Float32Array): void {
        if (this.buffered + samples.length > this.buffer.length) {
            const grown = new Float32Array(Math.max(this.buffer.length * 2, this.buffered + samples.length));
            grown.set(this.buffer.subarray(0, this.buffered));
            this.buffer = grown;
        }
        this.buffer.set(samples, this.buffered);
        this.buffered += samples.length;
        let offset = 0;
        while (offset + WINDOW_SAMPLES <= this.buffered) {
            this.analyseFrame(offset);
            offset += HOP_SAMPLES;
        }
        if (offset > 0) {
            this.buffer.copyWithin(0, offset, this.buffered);
            this.buffered -= offset;
            this.consumed += offset;
        }
    }

    /** Close the open epoch and return every epoch summary. */
    public finish(): EpochSummary[] {
        this.commit(NaN);
        if (this.current) {
            this.closeEpoch(this.current, (this.consumed + this.buffered) / SAMPLE_RATE * 1000);
            this.current = null;
        }
        return this.summaries.slice();
    }

    public epochSummaries(): EpochSummary[] {
        const open = this.current ? [this.summarise(this.current)] : [];
        return [...this.summaries, ...open];
    }

    private analyseFrame(offset: number): void {
        const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const tMs = ((this.consumed + offset + WINDOW_SAMPLES / 2) / SAMPLE_RATE) * 1000;
        const ctx = this.opts.contextAt(tMs);
        const result: FrameResult = {
            tMs,
            epoch: ctx ? ctx.epoch : -1,
            role: 'off',
            sCommanded: ctx ? ctx.s : null,
            rpm: NaN,
            confidence: 0,
            rel: NaN,
            chatterExcessDb: NaN,
            chatterHz: NaN,
            runoutIndexDb: NaN,
            costMs: 0,
            levelDb: NaN,
            clipped: false,
            locked: false,
            motionHz: NaN,
            motionDb: NaN,
            motionConf: 0,
            bands: [],
            contested: false,
            ambiguous: false,
            gantryLike: false,
        };
        // Loudness of the raw frame, cheap and always available: the camera
        // page's noise meter, and a sanity check that the microphone hears.
        let sumSq = 0;
        for (let i = 0; i < WINDOW_SAMPLES; i++) {
            const v = this.buffer[offset + i];
            sumSq += v * v;
        }
        result.levelDb = 10 * Math.log10(sumSq / WINDOW_SAMPLES + 1e-12);
        result.clipped = result.levelDb >= RULES.clipDb;
        if (result.clipped) {
            this.clippedFrames += 1;
        }
        // The spectrum is computed for EVERY frame: the gantry and the
        // room are recorded whether or not the spindle is commanded on.
        framePower(this.fft, this.buffer, offset, this.re, this.im, this.power);
        for (let k = 0; k < NBINS; k++) {
            this.logPower[k] = Math.log(this.power[k] + 1e-18);
        }
        result.bands = bandLevels(this.power);
        if (!ctx || ctx.s === null || ctx.s <= 0 || ctx.epoch < 0) {
            const motion = motionComb(this.logPower, null);
            result.motionHz = motion.hz;
            result.motionDb = motion.peakDb;
            result.motionConf = motion.confidence;
        }
        if (!ctx || ctx.s === null || ctx.s <= 0 || ctx.epoch < 0) {
            this.commit(NaN);
            if (this.current) {
                this.closeEpoch(this.current, tMs);
                this.current = null;
            }
            this.emitFrame(result, started);
            return;
        }
        if (!this.current || this.current.index !== ctx.epoch) {
            this.commit(NaN);
            if (this.current) {
                this.closeEpoch(this.current, tMs);
            }
            this.current = this.openEpoch(ctx.epoch, ctx.s, tMs);
        }
        const epoch = this.current;
        epoch.endMs = tMs;
        if (ctx.feed && ctx.kind === 'feed') {
            epoch.feed = ctx.feed;
        }

        const comb = combTrack(this.logPower, ctx.s, this.scores);
        result.rpm = comb.rpm;
        result.confidence = comb.confidence;
        const fRev = comb.rpm / 60;
        const previous = this.pending && this.pending.epoch === epoch ? this.pending.result.rpm : NaN;
        const transient = !Number.isNaN(previous) && Math.abs(comb.rpm - previous) / comb.rpm > 0.01;

        // Chatter band with THIS frame's harmonics masked: the strongest
        // remaining tone over the band median, and the masked power kept for
        // the epoch's cut / baseline mean spectra.
        harmonicMask(fRev, this.mask);
        {
            const motion = motionComb(this.logPower, fRev);
            result.motionHz = motion.hz;
            result.motionDb = motion.peakDb;
            result.motionConf = motion.confidence;
            // A marginal spindle lock while a confident motion comb is at
            // least 6 dB stronger than the spindle's own harmonics is the
            // gantry being heard, not the spindle: not a lock.
            if (motion.confidence >= RULES.minConfidence && comb.confidence < RULES.contestedSpindleConfidence) {
                let spindleMean = 0;
                let used = 0;
                for (const [k] of HARMONICS) {
                    const bin = Math.round((k * fRev) / BIN_HZ);
                    if (bin < NBINS) {
                        spindleMean += this.logPower[bin];
                        used += 1;
                    }
                }
                spindleMean = used ? spindleMean / used : -Infinity;
                result.contested = motion.meanLog - spindleMean >= RULES.contestedMarginLn;
            }
            // During a RAPID the gantry's own comb is fitted unmasked too; a
            // spindle candidate sitting on one of its harmonics cannot be told
            // from it (the A350's Y and Z axes at F500 sing a 125 Hz comb =
            // 7470 RPM, inside the S8000 band): recorded, not RPM. Rapids
            // carry no load, so nothing is judged from them anyway; feed moves
            // are left alone - while cutting the spindle IS the strongest comb.
            if (ctx.kind === 'rapid') {
                const free = motionComb(this.logPower, null);
                if (free.confidence >= RULES.minConfidence && free.hz > 0) {
                    // Either way round: the spindle line on a gantry harmonic,
                    // or the gantry fundamental on a spindle harmonic.
                    const up = fRev / free.hz;
                    const down = free.hz / fRev;
                    const kUp = Math.round(up);
                    const kDown = Math.round(down);
                    result.ambiguous = (kUp >= 1 && Math.abs(up - kUp) <= RULES.ambiguousRel * kUp)
                        || (kDown >= 1 && Math.abs(down - kDown) <= RULES.ambiguousRel * kDown);
                }
            }
        }
        const maskedPower = new Float64Array(BAND_BINS);
        let n = 0;
        let bestDb = -Infinity;
        let bestBin = -1;
        for (let b = 0; b < BAND_BINS; b++) {
            if (!this.mask[b]) {
                continue;
            }
            const p = this.power[BAND_LO_BIN + b];
            maskedPower[b] = p;
            const db = 10 * Math.log10(p + 1e-18);
            this.maskedDb[n++] = db;
            if (db > bestDb) {
                bestDb = db;
                bestBin = b;
            }
        }
        const chatterExcess = n > 0 ? bestDb - median(this.maskedDb.subarray(0, n)) : NaN;
        const chatterHz = n > 0 ? (BAND_LO_BIN + bestBin) * BIN_HZ : NaN;

        // A lock needs confidence, a candidate away from the band's edges and
        // an unclipped frame; a spin-up needs the RPM to have settled, not
        // just time to have passed (the A350 ramps its spindle for ~20 s).
        // The gantry's shape test needs no context at all: its comb has a
        // dominant second harmonic, the spindle's has a dominant fundamental.
        // (Job b3e8f3dd0e34: the head traversed for 6 s, the spindle never
        // turned, and the estimator's context said "dwell after M3".)
        {
            const lineDb = (k: number): number => {
                const centre = Math.round((k * fRev) / BIN_HZ);
                let best = -Infinity;
                for (let b = Math.max(1, centre - 3); b <= Math.min(NBINS - 1, centre + 3); b++) {
                    best = Math.max(best, this.logPower[b]);
                }
                return (10 * best) / Math.LN10;
            };
            // Smoothed over the last five frames (0.25 s): the per-frame
            // difference wanders +-5 dB around its 15-17 dB mean on the real
            // Z descent and let one frame in ten through unsmoothed.
            this.shapeHistory.push(lineDb(2) - lineDb(1));
            if (this.shapeHistory.length > RULES.gantryShapeFrames) {
                this.shapeHistory.shift();
            }
            result.gantryLike = median(this.shapeHistory) >= RULES.gantryShapeDb;
        }
        const locked = comb.confidence >= RULES.minConfidence && !comb.edge && !result.clipped
            && !result.contested && !result.ambiguous && !result.gantryLike;
        result.locked = locked;
        if (locked && ctx.kind !== 'feed') {
            epoch.spinHistory.push([tMs, comb.rpm]);
            if (epoch.spinHistory.length > 200) {
                epoch.spinHistory.shift();
            }
        }
        let role: FrameRole;
        if (ctx.sinceTransitionMs < RULES.transitionGuardMs) {
            role = 'transition';
        } else if (ctx.kind === 'feed') {
            role = 'cut';
        } else if (ctx.sinceEpochMs >= RULES.spinUpMs && epoch.isSettled(tMs)) {
            role = 'baseline';
        } else {
            role = 'spinup';
        }
        result.role = role;

        // The frame is committed once the NEXT frame's RPM is known: a frame
        // straddling an RPM step carries two harmonic combs, one RPM cannot
        // mask both, and the other comb's lines would read as strong
        // non-harmonic tones. Such frames keep their RPM but contribute
        // nothing to the spectral statistics (one hop, 50 ms, of latency).
        this.commit(comb.rpm);
        this.pending = {
            result,
            started,
            epoch,
            role,
            locked,
            transient,
            fRev,
            p1: peakDb(this.power, fRev),
            p4: peakDb(this.power, 4 * fRev),
            maskedPower,
            mask: Uint8Array.from(this.mask),
            chatterExcess,
            chatterHz,
        };
    }

    /** Commit the pending frame given the RPM of the frame after it (NaN = none in this epoch). */
    private commit(nextRpm: number): void {
        const pending = this.pending;
        if (!pending) {
            return;
        }
        this.pending = null;
        const { result, epoch, role, locked } = pending;
        const tMs = result.tMs;
        const transient = pending.transient || (!Number.isNaN(nextRpm) && Math.abs(nextRpm - result.rpm) / result.rpm > 0.01);
        if (!transient) {
            result.chatterExcessDb = pending.chatterExcess;
            result.chatterHz = pending.chatterHz;
        }
        const rpm = result.rpm;
        const window = Math.max(1, Math.round(RULES.rollingMs / (HOP_S * 1000)));
        if (role === 'baseline' && locked) {
            epoch.baselineRpm.push(rpm);
            if (!transient) {
                epoch.baselineFrames += 1;
                epoch.baselineP1.push(pending.p1);
                epoch.baselineP4.push(pending.p4);
                accumulateMasked(epoch.baselineMasked, epoch.baselineMaskedN, pending.maskedPower, pending.mask);
            }
            if (!epoch.reachEmitted && epoch.baselineRpm.length >= 20) {
                this.checkReach(epoch, tMs);
            }
        } else if (role === 'cut') {
            epoch.cutConf.push(result.confidence);
            epoch.lockHistory.push(locked);
            if (epoch.lockHistory.length > window) {
                epoch.lockHistory.shift();
            }
            if (locked) {
                epoch.cutRpm.push(rpm);
                epoch.cutT.push(tMs);
                if (!transient) {
                    epoch.cutFrames += 1;
                    epoch.cutP1.push(pending.p1);
                    epoch.cutP4.push(pending.p4);
                    accumulateMasked(epoch.cutMasked, epoch.cutMaskedN, pending.maskedPower, pending.mask);
                }
                if (!epoch.reachEmitted) {
                    this.checkReach(epoch, tMs);
                }
                epoch.rolling.push(rpm);
                if (epoch.rolling.length > window) {
                    epoch.rolling.shift();
                }
            }
            // The dip rules need a lock that persists: a majority of the
            // rolling window locked, so noise frames that happen to score
            // cannot manufacture a sag out of random RPM readings.
            const lockedInWindow = epoch.lockHistory.filter(Boolean).length;
            if (locked) {
                // Resolve (and record the source of) the idle baseline the
                // spectral comparisons and the summary use.
                this.resolveBaseline(epoch);
                if (epoch.rolling.length >= window && lockedInWindow === window) {
                    epoch.noteLoaded(median(epoch.rolling));
                }
            }
            const reference = locked && lockedInWindow * 2 > window && epoch.rolling.length >= Math.ceil(window / 2)
                ? (this.resolveBaseline(epoch), epoch.sagReference()) : null;
            if (reference !== null) {
                const rel = median(epoch.rolling) / reference;
                result.rel = rel;
                epoch.cutRel.push(rel);
                this.trackDip(epoch, rel, tMs);
            }
            if (tMs - epoch.lastSurfaceCheckMs >= RULES.surfaceCheckMs) {
                epoch.lastSurfaceCheckMs = tMs;
                this.surfaceCheck(epoch, tMs, false);
            }
        }
        result.runoutIndexDb = epoch.lastRunout;
        this.emitFrame(result, pending.started);
    }

    private emitFrame(result: FrameResult, started: number): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        result.costMs = now - started;
        this.frames += 1;
        this.totalCostMs += result.costMs;
        if (result.costMs > this.maxCostMs) {
            this.maxCostMs = result.costMs;
        }
        if (this.opts.onFrame) {
            this.opts.onFrame(result);
        }
    }

    private openEpoch(index: number, s: number, tMs: number): Epoch {
        const epoch = new Epoch(index, s, tMs);
        epoch.lastSurfaceCheckMs = tMs;
        this.epochs.push(epoch);
        return epoch;
    }

    /**
     * The baseline for judging a cut: this epoch's own free frames; failing
     * that (a program that cuts straight after M3) the latest earlier epoch at
     * the same S; failing that the commanded S itself, flagged as such.
     */
    private resolveBaseline(epoch: Epoch): number | null {
        const own = epoch.baselineRpm.length >= RULES.minBaselineFrames ? epoch.baseline() : null;
        if (own !== null) {
            epoch.baselineSource = 'epoch';
            epoch.baselineOverride = null;
            return own;
        }
        if (epoch.baselineOverride !== null) {
            return epoch.baselineOverride;
        }
        for (let i = this.epochs.length - 1; i >= 0; i--) {
            const previous = this.epochs[i];
            if (previous !== epoch && previous.s === epoch.s && previous.baselineRpm.length >= RULES.minBaselineFrames) {
                epoch.baselineSource = 'previous-epoch';
                epoch.baselineOverride = previous.baseline();
                return epoch.baselineOverride;
            }
        }
        epoch.baselineSource = 'commanded';
        epoch.baselineOverride = epoch.s;
        return epoch.baselineOverride;
    }

    private checkReach(epoch: Epoch, tMs: number): void {
        if (epoch.baselineRpm.length < RULES.minBaselineFrames) {
            return;
        }
        epoch.reachEmitted = true;
        const baseline = epoch.baseline() as number;
        const err = baseline / epoch.s - 1;
        if (Math.abs(err) > RULES.reachRel) {
            this.emit({
                kind: 'spindle_reach',
                tMs,
                epoch: epoch.index,
                sCommanded: epoch.s,
                baselineRpm: Math.round(baseline),
                reachError: Number(err.toFixed(4)),
                note: `unloaded spindle at ${Math.round(baseline)} RPM, ${(100 * err).toFixed(1)} % off the commanded S${epoch.s} `
                    + '(idle speed; the loaded speed is judged separately)',
            });
        }
    }

    private trackDip(epoch: Epoch, rel: number, tMs: number): void {
        if (rel < RULES.dipRel) {
            if (!epoch.dip) {
                epoch.dip = { startMs: tMs, minRel: rel, sagEmitted: false };
            } else {
                epoch.dip.minRel = Math.min(epoch.dip.minRel, rel);
                if (!epoch.dip.sagEmitted && tMs - epoch.dip.startMs >= RULES.sagMs) {
                    epoch.dip.sagEmitted = true;
                    epoch.sags += 1;
                    this.emit({
                        kind: 'spindle_sag',
                        tMs,
                        epoch: epoch.index,
                        sCommanded: epoch.s,
                        startMs: Math.round(epoch.dip.startMs),
                        minRel: Number(epoch.dip.minRel.toFixed(4)),
                        note: `spindle struggling: ${(100 * (1 - epoch.dip.minRel)).toFixed(1)} % below the unloaded baseline for over ${RULES.sagMs / 1000} s at S${epoch.s}`,
                    });
                }
            }
            return;
        }
        if (epoch.dip) {
            const dip = epoch.dip;
            epoch.dip = null;
            const durationMs = tMs - dip.startMs;
            if (dip.sagEmitted) {
                return;
            }
            epoch.blips += 1;
            if (epoch.blipEvents < RULES.maxBlipEvents) {
                epoch.blipEvents += 1;
                this.emit({
                    kind: 'spindle_blip',
                    tMs,
                    epoch: epoch.index,
                    sCommanded: epoch.s,
                    startMs: Math.round(dip.startMs),
                    durationMs: Math.round(durationMs),
                    minRel: Number(dip.minRel.toFixed(4)),
                    note: `brief dip of ${(100 * (1 - dip.minRel)).toFixed(1)} % for ${Math.round(durationMs)} ms at S${epoch.s} (acceptable blip)`,
                });
            }
        }
    }

    private surfaceCheck(epoch: Epoch, tMs: number, final: boolean): { runout: number | null; chatter: { hz: number; excess: number; vsBase: number } | null } {
        const result: { runout: number | null; chatter: { hz: number; excess: number; vsBase: number } | null } = { runout: null, chatter: null };
        if (epoch.baselineP1.length < RULES.minBaselineFrames || epoch.cutP1.length < RULES.minCutFrames) {
            return result;
        }
        const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
        const d1 = mean(epoch.cutP1) - mean(epoch.baselineP1);
        const d4 = mean(epoch.cutP4) - mean(epoch.baselineP4);
        result.runout = d1 - d4;
        epoch.lastRunout = result.runout;
        if (result.runout > RULES.runoutIndexDb && !epoch.runoutEmitted) {
            epoch.runoutEmitted = true;
            this.emit({
                kind: 'runout',
                tMs,
                epoch: epoch.index,
                sCommanded: epoch.s,
                runoutIndexDb: Number(result.runout.toFixed(1)),
                revRibMm: epoch.feed ? Number((epoch.feed / epoch.s).toFixed(4)) : null,
                note: `runout suspected at S${epoch.s}: cutting adds ${result.runout.toFixed(1)} dB more at 1x rev than at the tooth pass - one flute dominant${
                    epoch.feed ? `, ribs about ${(epoch.feed / epoch.s).toFixed(3)} mm apart` : ''}`,
            });
        }

        // Chatter: masked mean spectra, bins covered in > 80 % of frames of both sets.
        const cutDb = new Float64Array(BAND_BINS);
        const valid: number[] = [];
        for (let b = 0; b < BAND_BINS; b++) {
            const okCut = epoch.cutMaskedN[b] > 0.8 * epoch.cutFrames;
            const okBase = epoch.baselineMaskedN[b] > 0.8 * epoch.baselineFrames;
            if (okCut && okBase && epoch.cutMaskedN[b] > 0 && epoch.baselineMaskedN[b] > 0) {
                cutDb[b] = 10 * Math.log10(epoch.cutMasked[b] / epoch.cutMaskedN[b] + 1e-18);
                valid.push(b);
            }
        }
        if (valid.length) {
            let j = valid[0];
            for (const b of valid) {
                if (cutDb[b] > cutDb[j]) {
                    j = b;
                }
            }
            const excess = cutDb[j] - median(valid.map((b) => cutDb[b]));
            const baseDb = 10 * Math.log10(epoch.baselineMasked[j] / epoch.baselineMaskedN[j] + 1e-18);
            const vsBase = cutDb[j] - baseDb;
            result.chatter = { hz: (BAND_LO_BIN + j) * BIN_HZ, excess, vsBase };
            if (excess > RULES.chatterExcessDb && vsBase > RULES.chatterVsBaseDb && !epoch.chatterEmitted) {
                epoch.chatterEmitted = true;
                const rib = epoch.feed ? (epoch.feed / 60) / result.chatter.hz : null;
                this.emit({
                    kind: 'chatter',
                    tMs,
                    epoch: epoch.index,
                    sCommanded: epoch.s,
                    chatterHz: Number(result.chatter.hz.toFixed(1)),
                    excessDb: Number(excess.toFixed(1)),
                    vsBaselineDb: Number(vsBase.toFixed(1)),
                    ribMm: rib === null ? null : Number(rib.toFixed(4)),
                    note: `chatter at ${result.chatter.hz.toFixed(0)} Hz while cutting at S${epoch.s}: ${excess.toFixed(0)} dB over the band, `
                        + `${vsBase.toFixed(0)} dB over the unloaded baseline${rib === null ? '' : `, ribs about ${rib.toFixed(3)} mm apart`}`,
                });
            }
        }
        if (final) {
            return result;
        }
        return result;
    }

    private closeEpoch(epoch: Epoch, tMs: number): void {
        epoch.endMs = tMs;
        if (epoch.dip && !epoch.dip.sagEmitted) {
            // A dip still open at the end of the cut counts by its length.
            const durationMs = tMs - epoch.dip.startMs;
            if (durationMs >= RULES.sagMs) {
                epoch.sags += 1;
            } else {
                epoch.blips += 1;
            }
            epoch.dip = null;
        }
        this.surfaceCheck(epoch, tMs, true);
        const summary = this.summarise(epoch);
        if (summary.verdict === 'STRUGGLE' && epoch.sags === 0 && summary.medianDrop !== null && summary.medianDrop > RULES.medianDropRel) {
            this.emit({
                kind: 'spindle_sag',
                tMs,
                epoch: epoch.index,
                sCommanded: epoch.s,
                medianDrop: Number(summary.medianDrop.toFixed(4)),
                note: `spindle struggling at S${epoch.s}: loaded median ${(100 * summary.medianDrop).toFixed(1)} % below the unloaded baseline`,
            });
        }
        if (summary.verdict === 'NO-LOCK') {
            this.emit({
                kind: 'spindle_nolock',
                tMs,
                epoch: epoch.index,
                sCommanded: epoch.s,
                note: `the harmonic comb could not be tracked while cutting at S${epoch.s} (too noisy, or the microphone is not hearing the spindle)`,
            });
        }
        this.emit({
            kind: 'spindle_epoch',
            tMs,
            epoch: epoch.index,
            sCommanded: epoch.s,
            verdict: summary.verdict,
            baselineRpm: summary.baselineRpm === null ? null : Math.round(summary.baselineRpm),
            cutMedianRpm: summary.cutMedianRpm === null ? null : Math.round(summary.cutMedianRpm),
            medianDrop: summary.medianDrop === null ? null : Number(summary.medianDrop.toFixed(4)),
            timeBelow95Ms: summary.timeBelow95Ms,
            blips: summary.blips,
            sags: summary.sags,
            runoutIndexDb: summary.runoutIndexDb === null ? null : Number(summary.runoutIndexDb.toFixed(1)),
            chatterFlag: summary.chatterFlag,
            runoutFlag: summary.runoutFlag,
            note: `S${epoch.s}: ${summary.verdict}${summary.reachFlag ? ' REACH?' : ''}`,
        });
        this.summaries.push(summary);
    }

    private summarise(epoch: Epoch): EpochSummary {
        const hopMs = HOP_S * 1000;
        const baseline = epoch.baseline();
        const summary: EpochSummary = {
            epoch: epoch.index,
            sCommanded: epoch.s,
            feed: epoch.feed,
            startMs: Math.round(epoch.startMs),
            endMs: Math.round(epoch.endMs),
            baselineFrames: epoch.baselineFrames,
            cutFrames: epoch.cutConf.length,
            baselineRpm: baseline,
            baselineSource: epoch.baselineRpm.length >= RULES.minBaselineFrames ? 'epoch' : epoch.baselineSource,
            reachError: null,
            reachFlag: false,
            cutMedianRpm: null,
            cutMinRpm: null,
            medianDrop: null,
            minRel: null,
            longestBelow97Ms: 0,
            timeBelow95Ms: 0,
            timeBelow97Ms: 0,
            blips: epoch.blips,
            sags: epoch.sags,
            verdict: 'NO-CUT',
            runoutIndexDb: Number.isNaN(epoch.lastRunout) ? null : epoch.lastRunout,
            runoutFlag: !Number.isNaN(epoch.lastRunout) && epoch.lastRunout > RULES.runoutIndexDb,
            chatterHz: null,
            chatterExcessDb: null,
            chatterVsBaseDb: null,
            chatterFlag: epoch.chatterEmitted,
            chatterRibMm: null,
            revRibMm: epoch.feed ? epoch.feed / epoch.s : null,
            idleError: null,
            loadedRefRpm: epoch.loadedRef,
        };
        if (epoch.baselineRpm.length >= RULES.minBaselineFrames) {
            summary.idleError = (baseline as number) / epoch.s - 1;
        }
        if (summary.idleError !== null) {
            summary.reachError = summary.idleError;
            summary.reachFlag = Math.abs(summary.reachError) > RULES.reachRel;
        } else if (epoch.loadedRef !== null) {
            summary.reachError = epoch.loadedRef / epoch.s - 1;
            summary.reachFlag = Math.abs(summary.reachError) > RULES.reachRel;
        }
        if (epoch.cutConf.length < RULES.minCutFrames) {
            summary.verdict = 'NO-CUT';
            return summary;
        }
        if (epoch.cutRpm.length < RULES.minCutFrames || median(epoch.cutConf) < RULES.minConfidence) {
            summary.verdict = 'NO-LOCK';
            return summary;
        }
        if (baseline === null) {
            summary.verdict = 'NO-BASELINE';
            return summary;
        }
        summary.cutMedianRpm = median(epoch.cutRpm);
        summary.cutMinRpm = Math.min(...epoch.cutRpm);
        const rel = epoch.cutRel;
        if (rel.length) {
            summary.medianDrop = 1 - median(rel);
            summary.minRel = Math.min(...rel);
            let run = 0;
            let longest = 0;
            let below95 = 0;
            let below97 = 0;
            for (const r of rel) {
                if (r < RULES.deepRel) {
                    below95 += 1;
                }
                if (r < RULES.dipRel) {
                    below97 += 1;
                    run += 1;
                    longest = Math.max(longest, run);
                } else {
                    run = 0;
                }
            }
            summary.longestBelow97Ms = Math.round(longest * hopMs);
            summary.timeBelow95Ms = Math.round(below95 * hopMs);
            summary.timeBelow97Ms = Math.round(below97 * hopMs);
            if (summary.medianDrop > RULES.medianDropRel || longest * hopMs >= RULES.sagMs) {
                summary.verdict = 'STRUGGLE';
            } else if (summary.minRel < RULES.dipRel) {
                summary.verdict = 'BLIP';
            } else {
                summary.verdict = 'HOLD';
            }
        } else {
            summary.verdict = 'NO-BASELINE';
        }
        const surface = this.surfaceNumbers(epoch);
        if (surface) {
            summary.chatterHz = surface.hz;
            summary.chatterExcessDb = surface.excess;
            summary.chatterVsBaseDb = surface.vsBase;
            summary.chatterFlag = surface.excess > RULES.chatterExcessDb && surface.vsBase > RULES.chatterVsBaseDb;
            summary.chatterRibMm = epoch.feed ? (epoch.feed / 60) / surface.hz : null;
        }
        return summary;
    }

    /** Chatter numbers without emitting (for summaries). */
    private surfaceNumbers(epoch: Epoch): { hz: number; excess: number; vsBase: number } | null {
        if (epoch.baselineFrames < RULES.minBaselineFrames || epoch.cutFrames < RULES.minCutFrames) {
            return null;
        }
        const cutDb: number[] = [];
        const bins: number[] = [];
        for (let b = 0; b < BAND_BINS; b++) {
            if (epoch.cutMaskedN[b] > 0.8 * epoch.cutFrames && epoch.baselineMaskedN[b] > 0.8 * epoch.baselineFrames) {
                cutDb.push(10 * Math.log10(epoch.cutMasked[b] / epoch.cutMaskedN[b] + 1e-18));
                bins.push(b);
            }
        }
        if (!bins.length) {
            return null;
        }
        let j = 0;
        for (let i = 1; i < bins.length; i++) {
            if (cutDb[i] > cutDb[j]) {
                j = i;
            }
        }
        const b = bins[j];
        const baseDb = 10 * Math.log10(epoch.baselineMasked[b] / epoch.baselineMaskedN[b] + 1e-18);
        return { hz: (BAND_LO_BIN + b) * BIN_HZ, excess: cutDb[j] - median(cutDb), vsBase: cutDb[j] - baseDb };
    }

    private emit(event: SpindleEvent): void {
        if (this.opts.onEvent) {
            this.opts.onEvent(event);
        }
    }
}

// ------------------------------------------------------------- synthetic

export interface SynthEpoch {
    s: number;
    feed: number;
    spinUpS: number;
    baselineS: number;
    cutS: number;
    recoverS: number;
    /** Steady droop while cutting, fraction (0.01 = 1 %). */
    droop?: number;
    /** A blip: [start s into the cut, duration s, fraction]. */
    blip?: [number, number, number];
    /** Sustained sag from this many s into the cut, fraction. */
    sag?: [number, number];
    /** 1x-rev amplitude while cutting (one flute dominant). */
    runoutAmp?: number;
    /** A non-harmonic chatter tone while cutting: [Hz, amplitude]. */
    chatter?: [number, number];
    /** Spin-up ramp length in seconds (default min(1.5, spinUpS)): the A350 takes ~20 s. */
    rampS?: number;
    /** Free-running speed as a fraction of S (the A350 idles at ~0.935 x S8000); loaded speed is S x (1 - droop). */
    idleRel?: number;
    /** A gantry tone while the head moves (the cut window): [fundamental Hz, amplitude], harmonics 1..6. */
    gantry?: [number, number];
    /** A gantry tone during the free phase: [fundamental Hz, amplitude]. */
    gantryFree?: [number, number];
    /** What the free phase is reported as: a still spindle dwell (default) or rapid moves. */
    freeKind?: 'dwell' | 'rapid';
    /** Spindle tone amplitude factor (default 1; 0 = the spindle never turns, the context lying notwithstanding). */
    spindleAmp?: number;
    /** Relative amplitudes of the gantry tones' harmonics 1..n (default 1/k). The A350's Y/Z comb is 2x-dominant. */
    gantryShape?: number[];
}

export interface SynthResult {
    samples: Float32Array;
    contextAt: (tMs: number) => FrameContext | null;
    /** [start ms, end ms] of each epoch's cut. */
    cuts: Array<[number, number]>;
}

/** Deterministic pseudo-random normal deviates (Box-Muller over an LCG). */
function gaussian(seed: number): () => number {
    let state = seed >>> 0;
    const uniform = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
    return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}

/**
 * Synthetic recording of a spindle-load ladder, the reference selftest's
 * signal: comb tones at the (drooping) RPM, louder broadband noise while
 * cutting, and the injected faults per epoch. The context function reports
 * exactly what a status poll would (kind, S, epoch) with no slop.
 */
export function synthesise(epochs: SynthEpoch[], seed = 1): SynthResult {
    const total = epochs.reduce((sum, e) => sum + e.spinUpS + e.baselineS + e.cutS + e.recoverS, 0) + 1;
    const n = Math.round(total * SAMPLE_RATE);
    const samples = new Float32Array(n);
    const noise = gaussian(seed);
    // Schedule: per epoch the absolute times of its phases.
    const schedule: Array<{
        epoch: number; s: number; feed: number; start: number; baselineAt: number; cutAt: number; cutEnd: number; end: number; spec: SynthEpoch;
    }> = [];
    let t = 0.5;
    epochs.forEach((spec, index) => {
        const start = t;
        const baselineAt = start + spec.spinUpS;
        const cutAt = baselineAt + spec.baselineS;
        const cutEnd = cutAt + spec.cutS;
        const end = cutEnd + spec.recoverS;
        schedule.push({ epoch: index, s: spec.s, feed: spec.feed, start, baselineAt, cutAt, cutEnd, end, spec });
        t = end;
    });
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const tt = i / SAMPLE_RATE;
        const ep = schedule.find((e) => tt >= e.start && tt < e.end);
        if (!ep) {
            samples[i] = 0.005 * noise();
            continue;
        }
        const cutting = tt >= ep.cutAt && tt < ep.cutEnd;
        let rpm = cutting || ep.spec.idleRel === undefined ? ep.s : ep.s * ep.spec.idleRel;
        // Spin-up ramp over the first 1.5 s of a spin-up phase.
        const since = tt - ep.start;
        const ramp = ep.spec.rampS !== undefined ? ep.spec.rampS : Math.min(1.5, ep.spec.spinUpS);
        if (ramp > 0 && since < ramp) {
            rpm = ep.s * (0.7 + 0.3 * (since / ramp));
        }
        if (cutting) {
            const into = tt - ep.cutAt;
            rpm *= 1 - (ep.spec.droop || 0.005);
            if (ep.spec.blip && into >= ep.spec.blip[0] && into < ep.spec.blip[0] + ep.spec.blip[1]) {
                rpm *= 1 - ep.spec.blip[2];
            }
            if (ep.spec.sag && into >= ep.spec.sag[0]) {
                rpm *= 1 - ep.spec.sag[1];
            }
        }
        phase += (2 * Math.PI * rpm) / 60 / SAMPLE_RATE;
        let x = 0;
        const amps: Array<[number, number]> = [[1, 0.3], [2, 0.2], [3, 0.1], [4, 0.25], [8, 0.1]];
        const spindleAmp = ep.spec.spindleAmp === undefined ? 1 : ep.spec.spindleAmp;
        for (const [k, amp] of amps) {
            let a = amp;
            if (cutting) {
                a = k === 4 ? amp * 3 : amp;
                if (k === 1 && ep.spec.runoutAmp) {
                    a = ep.spec.runoutAmp;
                }
            }
            x += spindleAmp * a * Math.sin(k * phase);
        }
        const gantryHarmonic = (k: number): number => (ep.spec.gantryShape ? (ep.spec.gantryShape[k - 1] || 0) : 1 / k);
        const gantryN = ep.spec.gantryShape ? ep.spec.gantryShape.length : 6;
        const freePhase = tt >= ep.baselineAt && tt < ep.cutAt;
        if (freePhase && ep.spec.gantryFree) {
            for (let k = 1; k <= gantryN; k++) {
                x += ep.spec.gantryFree[1] * gantryHarmonic(k) * Math.sin(2 * Math.PI * k * ep.spec.gantryFree[0] * tt + k);
            }
        }
        if (cutting && ep.spec.gantry) {
            for (let k = 1; k <= gantryN; k++) {
                x += ep.spec.gantry[1] * gantryHarmonic(k) * Math.sin(2 * Math.PI * k * ep.spec.gantry[0] * tt + k);
            }
        }
        if (cutting && ep.spec.chatter) {
            x += ep.spec.chatter[1] * Math.sin(2 * Math.PI * ep.spec.chatter[0] * tt);
        }
        x += noise() * 0.05 * (cutting ? 4 : 1);
        // Keep the synthetic well inside full scale (about -12 dBFS while
        // cutting): a real recording that reaches 0 dBFS is clipping.
        samples[i] = 0.25 * x;
    }
    const contextAt = (tMs: number): FrameContext | null => {
        const tt = tMs / 1000;
        const ep = schedule.find((e) => tt >= e.start && tt < e.end);
        if (!ep) {
            return { s: null, kind: 'other', feed: null, epoch: -1, sinceTransitionMs: 0, sinceEpochMs: 0 };
        }
        let kind: LineKind = 'dwell';
        let transitionAt = ep.start;
        if (tt >= ep.cutAt && tt < ep.cutEnd) {
            kind = 'feed';
            transitionAt = ep.cutAt;
        } else if (tt >= ep.cutEnd) {
            transitionAt = ep.cutEnd;
        } else if (tt >= ep.baselineAt) {
            kind = ep.spec.freeKind || 'dwell';
            transitionAt = ep.baselineAt;
        }
        return {
            s: ep.s,
            kind,
            feed: ep.feed,
            epoch: ep.epoch,
            sinceTransitionMs: (tt - transitionAt) * 1000,
            sinceEpochMs: (tt - ep.start) * 1000,
        };
    };
    return { samples, contextAt, cuts: schedule.map((e) => [e.cutAt * 1000, e.cutEnd * 1000]) };
}
