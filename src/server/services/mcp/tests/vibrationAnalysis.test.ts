import assert from 'assert';

import {
    EnvelopeAccumulator,
    WelchAccumulator,
    bandRms,
    combRpm,
    displacementRmsUm,
    findPeaks,
    nonHarmonicPeaks,
    positionProfile,
    segmentActivity,
    spatialOrders,
    sumPsd,
    velocityRmsMmS,
    welchPsd,
} from '../vibrationAnalysis';

type TestCase = [string, () => void | Promise<void>];

/** Deterministic noise (LCG) so the tests never flake. */
function noise(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296 - 0.5;
    };
}

function tones(fs: number, seconds: number, parts: Array<[number, number]>, noiseRms = 0, seed = 1): Float64Array {
    const n = Math.round(fs * seconds);
    const out = new Float64Array(n);
    const rnd = noise(seed);
    for (let i = 0; i < n; i++) {
        let v = 0;
        for (const [hz, amp] of parts) {
            v += amp * Math.sin(2 * Math.PI * hz * (i / fs));
        }
        // uniform(-0.5, 0.5) has variance 1/12
        out[i] = v + noiseRms * Math.sqrt(12) * rnd();
    }
    return out;
}

export const tests: TestCase[] = [
    ['Welch PSD integrates to the signal variance (Parseval) and a tone to A^2/2', () => {
        const fs = 1666;
        const x = tones(fs, 20, [[133.3, 0.05]], 0.01);
        const { psd, df } = welchPsd(x, fs, 2048);
        const total = bandRms(psd, df, 0.5, fs / 2);
        const expected = Math.sqrt(0.05 ** 2 / 2 + 0.01 ** 2);
        assert.ok(Math.abs(total / expected - 1) < 0.03, `total ${total} vs ${expected}`);
        const peaks = findPeaks(psd, df);
        assert.ok(Math.abs(peaks[0].hz - 133.3) < 0.2, `peak at ${peaks[0].hz}`);
        assert.ok(Math.abs(peaks[0].rmsG / (0.05 / Math.SQRT2) - 1) < 0.03, `tone rms ${peaks[0].rmsG}`);
    }],

    ['streaming in odd chunks gives the same PSD as one shot', () => {
        const fs = 833;
        const x = tones(fs, 10, [[50, 0.1], [210, 0.02]], 0.005, 7);
        const one = welchPsd(x, fs, 1024).psd;
        const acc = new WelchAccumulator(fs, 1024);
        for (let i = 0; i < x.length; i += 37) {
            acc.push(x.subarray(i, Math.min(x.length, i + 37)));
        }
        const streamed = acc.psd();
        for (let k = 0; k < one.length; k++) {
            assert.ok(Math.abs(one[k] - streamed[k]) <= 1e-12 * Math.max(1, one[k]), `bin ${k}`);
        }
    }],

    ['velocity and displacement of a tone follow a/(2 pi f) and a/(2 pi f)^2', () => {
        const fs = 1666;
        const amp = 0.1; // g peak at 100 Hz
        const x = tones(fs, 20, [[100, amp]]);
        const { psd, df } = welchPsd(x, fs, 2048);
        const w = 2 * Math.PI * 100;
        const aRms = (amp * 9806.65) / Math.SQRT2;
        const v = velocityRmsMmS(psd, df, 10, 800);
        assert.ok(Math.abs(v / (aRms / w) - 1) < 0.03, `velocity ${v} vs ${aRms / w}`);
        const d = displacementRmsUm(psd, df, 20, 800);
        assert.ok(Math.abs(d / ((aRms / (w * w)) * 1000) - 1) < 0.03, `displacement ${d}`);
        const peak = findPeaks(psd, df)[0];
        assert.ok(Math.abs(peak.displacementPkUm / ((amp * 9806.65 * 1000) / (w * w)) - 1) < 0.03, `peak displacement ${peak.displacementPkUm}`);
    }],

    ['peaks report the direction a tone shakes in as a per-axis power share', () => {
        const fs = 1666;
        const x = tones(fs, 10, [[120, 0.03]], 0.002, 1);
        const y = tones(fs, 10, [[120, 0.01]], 0.002, 2);
        const z = tones(fs, 10, [], 0.002, 3);
        const per = [x, y, z].map((c) => welchPsd(c, fs, 2048).psd);
        const df = fs / 2048;
        const [peak] = findPeaks(sumPsd(per), df, {}, per);
        assert.ok(peak.axisShare);
        const share = peak.axisShare as number[];
        assert.ok(Math.abs(share[0] - 0.9) < 0.02 && Math.abs(share[1] - 0.1) < 0.02 && share[2] < 0.01, JSON.stringify(share));
    }],

    ['the comb finds the spindle from its 1x/2x/3x and refuses a band it cannot see', () => {
        const fs = 1666;
        const f0 = 8010 / 60;
        const x = tones(fs, 20, [[f0, 0.02], [2 * f0, 0.01], [3 * f0, 0.006], [301, 0.03]], 0.004);
        const { psd, df } = welchPsd(x, fs, 2048);
        const fit = combRpm(psd, df, { minRpm: 6400, maxRpm: 8400 });
        assert.ok(fit);
        const lock = fit as NonNullable<typeof fit>;
        assert.ok(Math.abs(lock.rpm - 8010) < 10, `rpm ${lock.rpm}`);
        assert.ok(lock.confidence > 3, `confidence ${lock.confidence}`);
        assert.ok(!lock.edge);
        // 301 Hz is not a harmonic of 133.5: it survives the mask as a chatter candidate.
        const others = nonHarmonicPeaks(findPeaks(psd, df), lock.hz, 3);
        assert.ok(others.some((p) => Math.abs(p.hz - 301) < 0.5));
        assert.ok(!others.some((p) => Math.abs(p.hz - 2 * f0) < 1));
        assert.strictEqual(combRpm(psd, df, { minRpm: 60000, maxRpm: 70000 }), null);
    }],

    ['a short capture with only 1x and 2x clear is not dragged off by a noise bin at 3x', () => {
        const fs = 1659.25;
        const f0 = 8010 / 60;
        for (let seed = 1; seed <= 5; seed++) {
            const x = tones(fs, 5, [[f0, 0.02], [2 * f0, 0.01], [377, 0.015]], 0.0003, seed);
            const { psd, df } = welchPsd(x, fs, 2048);
            const fit = combRpm(psd, df, { minRpm: 6400, maxRpm: 8400 });
            assert.ok(fit && Math.abs(fit.rpm - 8010) < 3, `seed ${seed}: ${fit && fit.rpm}`);
        }
    }],

    ['a lone clean 1x line is not read a bin and a half low (the score plateau)', () => {
        const fs = 833.4;
        let worst = 0;
        for (let rpm = 9000; rpm <= 16400; rpm += 370) {
            const x = tones(fs, 5, [[rpm / 60, 0.02]], 0.0005, rpm);
            const { psd, df } = welchPsd(x, fs, 1024);
            const fit = combRpm(psd, df, { minRpm: rpm * 0.8, maxRpm: rpm * 1.05 });
            assert.ok(fit, `rpm ${rpm}`);
            worst = Math.max(worst, Math.abs((fit as NonNullable<typeof fit>).rpm - rpm));
        }
        assert.ok(worst < 6, `worst error ${worst} RPM`);
    }],

    ['a 2-flute cut with a weak 1x is not locked an octave high in a wide band', () => {
        const fs = 833;
        let wrong = 0;
        for (let f0 = 150; f0 < 200; f0 += 5) {
            const x = tones(fs, 8, [[f0, 0.002], [2 * f0, 0.02]], 0.0003, f0);
            const { psd, df } = welchPsd(x, fs, 1024);
            const fit = combRpm(psd, df, { minRpm: 6000, maxRpm: 24000, harmonics: [[1, 1], [2, 0.8], [3, 0.4]] });
            if (!fit || Math.abs(fit.hz - f0) > 1) {
                wrong++;
            }
        }
        assert.strictEqual(wrong, 0, `${wrong} of 10 fits off the true rate`);
    }],

    ['a line at half the fitted rate flags the octave as ambiguous', () => {
        const fs = 1666;
        const x = tones(fs, 6, [[100, 0.01], [200, 0.03], [400, 0.01]], 0.0003);
        const { psd, df } = welchPsd(x, fs, 2048);
        const fit = combRpm(psd, df, { minRpm: 10000, maxRpm: 13000 });
        assert.ok(fit && fit.halfRateAmbiguous, JSON.stringify(fit));
    }],

    ['the envelope reports the window it really uses (whole samples)', () => {
        const env = new EnvelopeAccumulator(13.02, 3, 1, 0.05);
        assert.ok(Math.abs(env.windowS - 1 / 13.02) < 1e-12, `${env.windowS}`);
        const n = Math.round(13.02 * 60);
        env.push(new Float64Array(n * 3), 3, n);
        assert.ok(Math.abs(env.values.length * env.windowS - 60) < 0.1);
    }],

    ['a tone that scales with feed reads as a spatial period; references give its order', () => {
        const peaks = [{ hz: 41.67, psdDb: 0, prominenceDb: 20, rmsG: 0.01, velocityPkMmS: 0, displacementPkUm: 0, axisShare: null }];
        const [p] = spatialOrders(peaks, 10, { 'screw lead': 8 }); // F600 = 10 mm/s
        assert.ok(Math.abs(p.wavelengthMm - 0.24) < 0.001);
        assert.ok(Math.abs(p.orders['screw lead'] - 33.336) < 0.01);
    }],

    ['activity segmentation finds back-and-forth legs between dwells, and none in a steady record', () => {
        const fs = 833;
        const parts: number[] = [];
        const rnd = noise(5);
        const phases: Array<[number, number]> = [[1, 0.002], [3, 0.05], [1, 0.002], [3, 0.05], [1, 0.002]];
        for (const [seconds, level] of phases) {
            for (let i = 0; i < seconds * fs; i++) {
                const v = level * Math.sin(2 * Math.PI * 124.5 * (i / fs)) + 0.001 * rnd();
                parts.push(v, 0.3 * v, 1 + 0.2 * v);
            }
        }
        const env = new EnvelopeAccumulator(fs, 3, 10, 0.05);
        env.push(parts, 3, parts.length / 3);
        const seg = segmentActivity(env.values, 0.05);
        assert.strictEqual(seg.segments.length, 2, JSON.stringify(seg.segments));
        assert.ok(Math.abs(seg.segments[0].startS - 1) < 0.15 && Math.abs(seg.segments[0].endS - 4) < 0.15, JSON.stringify(seg.segments[0]));
        assert.ok(Math.abs(seg.segments[1].startS - 5) < 0.15);
        const steady = segmentActivity(new Array(200).fill(0.01), 0.05);
        assert.strictEqual(steady.segments.length, 0);
    }],

    ['position profile maps each movement onto its stated leg and refuses a count mismatch', () => {
        const windowS = 0.1;
        // 2 s out (Y 100 -> 200), noisy in the middle; 2 s back.
        const envelope: number[] = [];
        for (let i = 0; i < 20; i++) {
            envelope.push(i >= 10 && i <= 11 ? 0.1 : 0.01);
        }
        for (let i = 0; i < 20; i++) {
            envelope.push(0.01);
        }
        const segments = [{ startS: 0, endS: 2, rmsG: 0.02 }, { startS: 2, endS: 4, rmsG: 0.01 }];
        const legs = [{ from: 100, to: 200 }, { from: 200, to: 100 }];
        const profile = positionProfile(envelope, windowS, segments, legs, 10);
        assert.ok(profile.ok);
        const loud = profile.bins.filter((b) => b.direction === '+').sort((a, b) => b.rmsG - a.rmsG)[0];
        assert.strictEqual(loud.at, 155);
        assert.strictEqual(profile.legs[0].averageSpeedMmS, 50);
        const mismatch = positionProfile(envelope, windowS, segments, legs.slice(0, 1), 10);
        assert.ok(!mismatch.ok && /guessed correspondence/.test(String(mismatch.reason)));
    }],
];
