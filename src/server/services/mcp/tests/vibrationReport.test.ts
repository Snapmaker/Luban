/* eslint-disable camelcase */
import assert from 'assert';

import { TrackBuilder, angleBetweenDeg, buildReport, gravityStandardError, sampleAtTime } from '../vibrationReport';

type TestCase = [string, () => void | Promise<void>];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Report = { [key: string]: any };

/** A toolhead sensor: gravity on z, a spindle comb at S, optionally a chatter tone and a static tilt. */
function record(opts: { fs: number; seconds: number; rpm?: number; chatterHz?: number; tiltDeg?: number; seed?: number }): TrackBuilder {
    const builder = new TrackBuilder(opts.fs, false, 1);
    const n = Math.round(opts.fs * opts.seconds);
    const tilt = ((opts.tiltDeg ?? 0) * Math.PI) / 180;
    let s = (opts.seed ?? 3) >>> 0;
    const rnd = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296 - 0.5;
    };
    const chunk = new Float64Array(3 * 500);
    let filled = 0;
    for (let i = 0; i < n; i++) {
        const t = i / opts.fs;
        let v = 0;
        if (opts.rpm) {
            const f0 = opts.rpm / 60;
            v += 0.02 * Math.sin(2 * Math.PI * f0 * t) + 0.01 * Math.sin(2 * Math.PI * 2 * f0 * t);
        }
        if (opts.chatterHz) {
            v += 0.03 * Math.sin(2 * Math.PI * opts.chatterHz * t);
        }
        chunk[filled * 3] = v + Math.sin(tilt) + 0.002 * rnd();
        chunk[filled * 3 + 1] = 0.5 * v + 0.002 * rnd();
        chunk[filled * 3 + 2] = Math.cos(tilt) + 0.002 * rnd();
        filled++;
        if (filled === 500) {
            builder.push(chunk, filled);
            filled = 0;
        }
    }
    builder.push(chunk, filled);
    return builder;
}

export const tests: TestCase[] = [
    ['a toolhead report: levels, the spindle lock from its comb, and the chatter tone it does not explain', () => {
        const data = record({ fs: 1666, seconds: 12, rpm: 8000, chatterHz: 377 }).data();
        const report = buildReport(data, { rpmHint: 8000 }) as Report;
        assert.ok(report.rotation.locked, JSON.stringify(report.rotation));
        assert.ok(Math.abs(report.rotation.rpm - 8000) < 5, `rpm ${report.rotation.rpm}`);
        assert.ok(report.rotation.non_harmonic_peaks.some((p: { hz: number }) => Math.abs(p.hz - 377) < 0.5));
        assert.ok(report.level.velocity_rms_mm_s > 0);
        assert.ok(Math.abs(report.gravity.magnitude_g - 1) < 0.001);
        assert.strictEqual(report.level.velocity_band_hz[1], 833);
        assert.strictEqual(report.samples, 1666 * 12);
    }],

    ['against a baseline, a 0.05 deg tilt is significant and carried to the tool tip by the lever', () => {
        const base = record({ fs: 833, seconds: 10, seed: 1 }).data();
        const loaded = record({ fs: 833, seconds: 10, tiltDeg: 0.05, seed: 2 }).data();
        const report = buildReport(loaded, { baseline: base, leverMm: 100 }) as Report;
        const change = report.change_vs_baseline;
        assert.ok(Math.abs(change.tilt_change_deg - 0.05) < 0.005, JSON.stringify(change));
        assert.strictEqual(change.tilt_significant, true);
        assert.ok(Math.abs(change.lateral_displacement_um - 87.3) < 9, `${change.lateral_displacement_um}`);
    }],

    ['a band outside the spectrum says so instead of fitting noise', () => {
        const data = record({ fs: 208, seconds: 10, rpm: 8000 }).data();
        const report = buildReport(data, { rpmHint: 8000 }) as Report;
        assert.match(report.rotation.note, /outside this stream's spectrum/);
    }],

    ['gyro bias is not rotation; slow tilt shows in the time-domain level', () => {
        const builder = new TrackBuilder(100, true, 1);
        const accel = new Float64Array(300 * 3);
        const gyro = new Float64Array(300 * 3);
        for (let i = 0; i < 300; i++) {
            accel[i * 3 + 2] = 1;
            accel[i * 3] = 0.05 * (i / 300); // a slow lean, far below any spectral band
            gyro[i * 3] = 1.2; // zero-rate offset
            gyro[i * 3 + 1] = -0.8;
        }
        builder.push(accel, 300, gyro);
        const data = builder.data();
        assert.ok((data.gyroRmsDps as number) < 1e-6, `${data.gyroRmsDps}`);
        assert.ok(data.acRmsG > 0.01, `${data.acRmsG}`);
    }],

    ['a window maps through the time index, so an outage does not shift it', () => {
        // 1666 Hz: 10 s from t = 1 s, a 30 s outage, then the stream resumes at 41 s.
        const index: Array<[number, number]> = [[0, 1000], [8330, 6000], [16660, 41000]];
        assert.strictEqual(sampleAtTime(index, 1666, 1000), 0);
        assert.strictEqual(sampleAtTime(index, 1666, 3500), 4165);
        assert.strictEqual(sampleAtTime(index, 1666, 25000), 16660, 'inside the outage: the gap edge, never past it');
        assert.strictEqual(sampleAtTime(index, 1666, 41500), 16660 + 833);
        assert.strictEqual(sampleAtTime([], 1666, 5000), 0);
    }],

    ['gravity standard error comes from per-second means; angles between vectors', () => {
        assert.strictEqual(gravityStandardError([[0, 0, 1], [0, 0, 1]]), null);
        const se = gravityStandardError([[0, 0, 1], [0.001, 0, 1], [0, 0, 1], [0.001, 0, 1]]) as number[];
        assert.ok(se[0] > 0 && se[2] === 0);
        assert.ok(Math.abs(angleBetweenDeg([0, 0, 1], [0, 1, 0]) - 90) < 1e-9);
    }],
];
