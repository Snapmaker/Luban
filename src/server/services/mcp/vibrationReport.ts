/* eslint-disable camelcase */
// Report fields are snake_case: they are returned to agents verbatim (MCP convention).
//
// One sensor's recording, accumulated as it streams, and the report built
// from it. The builder keeps only what the questions need - a Welch PSD per
// axis (and per gyro axis), a 50 ms vibration envelope, the gravity vector's
// mean and its per-second means - so a capture of an hour costs a few
// hundred kilobytes in memory; the raw samples go to disk separately.
//
// Pure: no server imports, tests/vibrationReport.test.ts.

import {
    EnvelopeAccumulator,
    MotionLeg,
    Peak,
    WelchAccumulator,
    bandLevels,
    bandRms,
    combRpm,
    displacementRmsUm,
    findPeaks,
    nonHarmonicPeaks,
    octaveEdges,
    positionProfile,
    round,
    runningMedian,
    segmentActivity,
    segmentFor,
    spatialOrders,
    sumPsd,
    velocityRmsMmS,
} from './vibrationAnalysis';

/** Envelope: high-passed above this (gravity, tilt and slow drift removed), 50 ms windows. */
export const ENVELOPE_HP_HZ = 10;
export const ENVELOPE_WINDOW_S = 0.05;
/** ISO 10816 velocity band; the top is cut to the stream's Nyquist. */
export const VELOCITY_BAND_HZ: [number, number] = [10, 1000];
/** Displacement is integrated from here up (lower would integrate sensor noise into microns). */
export const DISPLACEMENT_LO_HZ = 20;

export interface TrackData {
    fs: number;
    df: number;
    samples: number;
    durationS: number;
    psd: Float64Array[];
    gyroPsd: Float64Array[] | null;
    envelope: number[];
    windowS: number;
    /** Mean acceleration (gravity + static load), sensor frame, g. */
    gravity: [number, number, number];
    /** Mean per completed second, for drift and the standard error. */
    secondMeans: Array<[number, number, number]>;
    /** RMS of the gyro about its own mean (bias removed), dps (stillness), when streamed. */
    gyroRmsDps: number | null;
    /** Time-domain RMS of the acceleration about its mean (all frequencies, the slow ones included), g. */
    acRmsG: number;
    gaps: number;
}

/** Streaming accumulator for one sensor (accel x,y,z [+ gyro x,y,z]). */
export class TrackBuilder {
    public readonly fs: number;

    private readonly accel: WelchAccumulator[];

    private readonly gyro: WelchAccumulator[] | null;

    private readonly envelope: EnvelopeAccumulator;

    private sum: [number, number, number] = [0, 0, 0];

    private secondSum: [number, number, number] = [0, 0, 0];

    private secondCount = 0;

    private readonly perSecond: number;

    private readonly secondMeans: Array<[number, number, number]> = [];

    private count = 0;

    private gyroSum: [number, number, number] = [0, 0, 0];

    private gyroSq: [number, number, number] = [0, 0, 0];

    private gyroCount = 0;

    private sumSq: [number, number, number] = [0, 0, 0];

    public gaps = 0;

    public constructor(fs: number, withGyro: boolean, resolutionHz: number) {
        this.fs = fs;
        const n = segmentFor(fs, resolutionHz);
        this.accel = [0, 1, 2].map(() => new WelchAccumulator(fs, n));
        this.gyro = withGyro ? [0, 1, 2].map(() => new WelchAccumulator(fs, n)) : null;
        this.envelope = new EnvelopeAccumulator(fs, 3, ENVELOPE_HP_HZ, ENVELOPE_WINDOW_S);
        this.perSecond = Math.max(1, Math.round(fs));
    }

    /** Interleaved x,y,z frames (g), and optionally gyro frames (dps) of the same count. */
    public push(accel: ArrayLike<number>, frames: number, gyro: ArrayLike<number> | null = null): void {
        for (let c = 0; c < 3; c++) {
            this.accel[c].push(accel, c, 3, frames);
        }
        this.envelope.push(accel, 3, frames);
        for (let i = 0; i < frames; i++) {
            for (let c = 0; c < 3; c++) {
                const v = accel[i * 3 + c];
                this.sum[c] += v;
                this.sumSq[c] += v * v;
                this.secondSum[c] += v;
            }
            this.secondCount++;
            if (this.secondCount === this.perSecond) {
                this.secondMeans.push([this.secondSum[0] / this.secondCount, this.secondSum[1] / this.secondCount, this.secondSum[2] / this.secondCount]);
                this.secondSum = [0, 0, 0];
                this.secondCount = 0;
            }
        }
        this.count += frames;
        if (gyro && this.gyro) {
            for (let c = 0; c < 3; c++) {
                this.gyro[c].push(gyro, c, 3, frames);
            }
            for (let i = 0; i < frames; i++) {
                for (let c = 0; c < 3; c++) {
                    const v = gyro[i * 3 + c];
                    this.gyroSum[c] += v;
                    this.gyroSq[c] += v * v;
                }
            }
            this.gyroCount += frames;
        }
    }

    public get samples(): number {
        return this.count;
    }

    public data(): TrackData {
        const n = Math.max(this.count, 1);
        return {
            fs: this.fs,
            df: this.accel[0].df,
            samples: this.count,
            durationS: this.count / this.fs,
            psd: this.accel.map((acc) => acc.psd()),
            gyroPsd: this.gyro ? this.gyro.map((acc) => acc.psd()) : null,
            envelope: this.envelope.values.slice(),
            windowS: this.envelope.windowS,
            gravity: [this.sum[0] / n, this.sum[1] / n, this.sum[2] / n],
            secondMeans: this.secondMeans.slice(),
            // The zero-rate level (+-1 dps typical) is not rotation: about the mean.
            gyroRmsDps: this.gyroCount ? Math.sqrt([0, 1, 2].reduce((acc, c) => acc
                + Math.max(0, this.gyroSq[c] / this.gyroCount - (this.gyroSum[c] / this.gyroCount) ** 2), 0)) : null,
            acRmsG: Math.sqrt([0, 1, 2].reduce((acc, c) => acc + Math.max(0, this.sumSq[c] / n - (this.sum[c] / n) ** 2), 0)),
            gaps: this.gaps,
        };
    }
}

/** File sample index of host time `tMs`, through a track's [index, ms] table (linear at `rate` between entries, never past the next). */
export function sampleAtTime(index: Array<[number, number]>, rate: number, tMs: number): number {
    if (!index.length) {
        return 0;
    }
    let i = 0;
    while (i + 1 < index.length && index[i + 1][1] <= tMs) {
        i++;
    }
    const [at, ms] = index[i];
    if (tMs <= ms) {
        return at;
    }
    const estimate = at + Math.round(((tMs - ms) / 1000) * rate);
    return i + 1 < index.length ? Math.min(estimate, index[i + 1][0]) : estimate;
}

export interface ReportOptions {
    maxPeaks?: number;
    minProminenceDb?: number;
    /** Search band for the rotation comb, RPM. Both or neither. */
    rpmMin?: number;
    rpmMax?: number;
    /** Commanded S: searches 0.80-1.05 x of it (the microphone tracker's band) unless rpmMin/rpmMax are given. */
    rpmHint?: number;
    /** Cutter flutes: adds the tooth-passing harmonic to the comb. */
    flutes?: number;
    /** Constant-speed motion during the window: express peaks as spatial periods and bin the envelope by position. */
    motion?: {
        axis: string;
        feedMmMin: number;
        legs?: MotionLeg[];
        binMm?: number;
        references?: { [name: string]: number };
    };
    /** Compare against this earlier recording of the same sensor (tilt and level changes). */
    baseline?: TrackData;
    /** Lever from the tilt pivot to the point of interest (tool tip), mm: tilt -> lateral displacement. */
    leverMm?: number;
    /** Include a downsampled log spectrum. */
    spectrumPoints?: number;
}

const AXES = ['x', 'y', 'z'];
const RAD = 180 / Math.PI;

function norm3(v: [number, number, number]): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/** Angle between two vectors, degrees. */
export function angleBetweenDeg(a: [number, number, number], b: [number, number, number]): number {
    const na = norm3(a);
    const nb = norm3(b);
    if (!(na > 0 && nb > 0)) {
        return NaN;
    }
    const c = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb)));
    return Math.acos(c) * RAD;
}

/** Standard error of the mean gravity vector from per-second means (correlated noise included), g per axis. */
export function gravityStandardError(secondMeans: Array<[number, number, number]>): [number, number, number] | null {
    const n = secondMeans.length;
    if (n < 3) {
        return null;
    }
    const out: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
        const mean = secondMeans.reduce((s, m) => s + m[c], 0) / n;
        const variance = secondMeans.reduce((s, m) => s + (m[c] - mean) ** 2, 0) / (n - 1);
        out[c] = Math.sqrt(variance / n);
    }
    return out;
}

/** Log-spaced spectrum points: [Hz, dB re 1 g^2/Hz] of the summed PSD, max over each bucket. */
export function spectrumPoints(psd: Float64Array, df: number, points: number, loHz: number): Array<[number, number]> {
    const hi = df * (psd.length - 1);
    const lo = Math.max(loHz, df);
    const out: Array<[number, number]> = [];
    const ratio = (hi / lo) ** (1 / points);
    let f = lo;
    for (let i = 0; i < points && f < hi; i++) {
        const next = f * ratio;
        const a = Math.max(1, Math.floor(f / df));
        const b = Math.min(psd.length - 1, Math.max(a, Math.ceil(next / df) - 1));
        let best = 0;
        for (let k = a; k <= b; k++) {
            best = Math.max(best, psd[k]);
        }
        out.push([round(Math.sqrt(f * next), 1), round(10 * Math.log10(Math.max(best, 1e-30)), 1)]);
        f = next;
    }
    return out;
}

function peakOut(peak: Peak): { [key: string]: unknown } {
    return {
        hz: peak.hz,
        prominence_db: peak.prominenceDb,
        rms_g: peak.rmsG,
        velocity_pk_mm_s: peak.velocityPkMmS,
        displacement_pk_um: peak.displacementPkUm,
        axis_share: peak.axisShare,
    };
}

/** The report for one sensor's window. */
export function buildReport(data: TrackData, opts: ReportOptions = {}): { [key: string]: unknown } {
    const nyquist = data.fs / 2;
    const total = sumPsd(data.psd);
    const floor = runningMedian(total, 15);
    const peaks = findPeaks(total, data.df, { maxPeaks: opts.maxPeaks ?? 8, minProminenceDb: opts.minProminenceDb ?? 10, minHz: 2 }, data.psd);
    const velTop = Math.min(VELOCITY_BAND_HZ[1], nyquist);
    const report: { [key: string]: unknown } = {
        sample_rate_hz: round(data.fs, 3),
        resolution_hz: round(data.df, 4),
        duration_s: round(data.durationS, 2),
        samples: data.samples,
        gaps: data.gaps,
        level: {
            accel_rms_g: Object.fromEntries(AXES.map((axis, i) => [axis, round(bandRms(data.psd[i], data.df, 1, nyquist), 5)])),
            accel_rms_total_g: round(bandRms(total, data.df, 1, nyquist), 5),
            velocity_rms_mm_s: round(velocityRmsMmS(total, data.df, VELOCITY_BAND_HZ[0], velTop), 4),
            velocity_band_hz: [VELOCITY_BAND_HZ[0], round(velTop, 1)],
            displacement_rms_um: round(displacementRmsUm(total, data.df, DISPLACEMENT_LO_HZ, nyquist), 3),
            displacement_band_hz: [DISPLACEMENT_LO_HZ, round(nyquist, 1)],
            octave_bands: bandLevels(total, data.df, octaveEdges(10, nyquist))
                .map((band) => ({ lo_hz: round(band.loHz, 1), hi_hz: round(band.hiHz, 1), rms_g: round(band.rmsG, 5) })),
        },
        peaks: peaks.map(peakOut),
    };

    // Gravity: the static part. Tilt and the rotary angle come from it.
    const gravityNorm = norm3(data.gravity);
    const se = gravityStandardError(data.secondMeans);
    report.gravity = {
        mean_g: data.gravity.map((v) => round(v, 5)),
        magnitude_g: round(gravityNorm, 5),
        standard_error_g: se ? se.map((v) => round(v, 6)) : null,
        tilt_resolution_deg: se && gravityNorm > 0 ? round((norm3(se) / gravityNorm) * RAD, 4) : null,
        drift_deg: data.secondMeans.length >= 2 ? round(angleBetweenDeg(data.secondMeans[0], data.secondMeans[data.secondMeans.length - 1]), 4) : null,
    };
    if (data.gyroPsd) {
        const gyroTotal = sumPsd(data.gyroPsd);
        report.gyro = {
            rms_dps: data.gyroRmsDps === null ? null : round(data.gyroRmsDps, 4),
            peaks: findPeaks(gyroTotal, data.df, { maxPeaks: 4, minProminenceDb: opts.minProminenceDb ?? 10, minHz: 2 }, data.gyroPsd)
                .map((p) => ({ hz: p.hz, prominence_db: p.prominenceDb, axis_share: p.axisShare })),
        };
    }

    // Rotation: the comb over a band the caller chose (or the commanded S).
    let rpmMin = opts.rpmMin;
    let rpmMax = opts.rpmMax;
    if ((rpmMin === undefined || rpmMax === undefined) && opts.rpmHint && opts.rpmHint > 0) {
        rpmMin = opts.rpmHint * 0.8;
        rpmMax = opts.rpmHint * 1.05;
    }
    if (rpmMin !== undefined && rpmMax !== undefined) {
        const harmonics: Array<[number, number]> = [[1, 1.0], [2, 0.6], [3, 0.4]];
        if (opts.flutes && opts.flutes > 3) {
            harmonics.push([opts.flutes, 0.8]);
        }
        const fit = combRpm(total, data.df, { minRpm: rpmMin, maxRpm: rpmMax, harmonics }, floor);
        if (!fit) {
            report.rotation = {
                searched_rpm: [rpmMin, rpmMax],
                note: `the band is outside this stream's spectrum (Nyquist ${round(nyquist, 1)} Hz, resolution ${round(data.df, 3)} Hz)`,
            };
        } else {
            const maskHz = Math.max(3 * data.df, 2);
            const locked = fit.confidence >= 3 && !fit.edge;
            report.rotation = {
                searched_rpm: [round(rpmMin, 1), round(rpmMax, 1)],
                rpm: fit.rpm,
                hz: fit.hz,
                confidence: fit.confidence,
                locked,
                edge: fit.edge,
                half_rate_ambiguous: fit.halfRateAmbiguous,
                harmonics: fit.harmonicsDb.map((h) => ({ k: h.k, hz: h.hz, excess_db: h.excessDb })),
                // Tones the rotation does not explain: chatter, resonances, other machinery.
                non_harmonic_peaks: locked ? nonHarmonicPeaks(peaks, fit.hz, maskHz).map(peakOut) : null,
                note: locked ? null : 'no confident lock (confidence < 3 or at the band edge): the rotation is not resolved in this window',
            };
        }
    }

    // Motion: spatial periods and the position profile.
    if (opts.motion && opts.motion.feedMmMin > 0) {
        const speed = opts.motion.feedMmMin / 60;
        const segmentation = segmentActivity(data.envelope, data.windowS);
        const motion: { [key: string]: unknown } = {
            axis: opts.motion.axis,
            feed_mm_min: opts.motion.feedMmMin,
            speed_mm_s: round(speed, 4),
            peaks_as_spatial_periods: spatialOrders(peaks, speed, opts.motion.references || {}).map((p) => ({
                hz: p.hz,
                prominence_db: p.prominenceDb,
                rms_g: p.rmsG,
                wavelength_mm: p.wavelengthMm,
                cycles_per_mm: p.cyclesPerMm,
                orders: p.orders,
                axis_share: p.axisShare,
            })),
            segments: segmentation.segments.map((s) => ({ start_s: s.startS, end_s: s.endS, rms_g: s.rmsG })),
            envelope_floor_g: round(segmentation.floorG, 6),
            envelope_busy_g: round(segmentation.busyG, 6),
        };
        if (opts.motion.legs && opts.motion.legs.length) {
            const profile = positionProfile(data.envelope, data.windowS, segmentation.segments, opts.motion.legs, opts.motion.binMm ?? 5);
            motion.position_profile = profile.ok
                ? {
                    bin_mm: opts.motion.binMm ?? 5,
                    legs: profile.legs.map((leg) => ({
                        from: leg.from,
                        to: leg.to,
                        duration_s: leg.durationS,
                        average_speed_mm_s: leg.averageSpeedMmS,
                        // The movement the stated feed would take: a big difference means the legs and the segments do not belong together.
                        expected_duration_s: round(Math.abs(leg.to - leg.from) / speed, 2),
                    })),
                    bins: profile.bins.map((bin) => ({ at_mm: bin.at, direction: bin.direction, rms_g: bin.rmsG, windows: bin.windows })),
                    note: 'position is linear in time inside each movement (average speed): the acceleration ramps smear the first and last few mm of every leg',
                }
                : { error: profile.reason };
        }
        report.motion = motion;
    }

    // Change against a baseline recording of the same sensor.
    if (opts.baseline) {
        const base = opts.baseline;
        const tilt = angleBetweenDeg(base.gravity, data.gravity);
        const baseSe = gravityStandardError(base.secondMeans);
        const baseTotal = sumPsd(base.psd);
        const baseVel = velocityRmsMmS(baseTotal, base.df, VELOCITY_BAND_HZ[0], Math.min(VELOCITY_BAND_HZ[1], base.fs / 2));
        const vel = velocityRmsMmS(total, data.df, VELOCITY_BAND_HZ[0], velTop);
        const resolution = se && baseSe && gravityNorm > 0 ? (Math.sqrt(norm3(se) ** 2 + norm3(baseSe) ** 2) / gravityNorm) * RAD : null;
        const change: { [key: string]: unknown } = {
            tilt_change_deg: round(tilt, 4),
            tilt_resolution_deg: resolution === null ? null : round(resolution, 4),
            tilt_significant: resolution === null ? null : tilt > 3 * resolution,
            gravity_delta_g: data.gravity.map((v, i) => round(v - base.gravity[i], 5)),
            velocity_rms_change_db: baseVel > 0 && vel > 0 ? round(20 * Math.log10(vel / baseVel), 2) : null,
        };
        if (opts.leverMm && opts.leverMm > 0) {
            change.lever_mm = opts.leverMm;
            change.lateral_displacement_um = round(opts.leverMm * Math.tan(tilt / RAD) * 1000, 2);
            change.lateral_displacement_note = 'tilt x lever: the rotation of the sensor\'s mount carried to the stated point; a pure translation of the mount does not tilt and is not seen';
        }
        report.change_vs_baseline = change;
    }

    if (opts.spectrumPoints && opts.spectrumPoints > 0) {
        report.spectrum_db = spectrumPoints(total, data.df, opts.spectrumPoints, 2);
    }
    return report;
}
