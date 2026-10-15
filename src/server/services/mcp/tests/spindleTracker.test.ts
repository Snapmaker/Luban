import { strict as assert } from 'assert';

import {
    EpochSummary,
    Fft,
    FrameResult,
    NFFT,
    SpindleAudioAnalyser,
    SpindleEvent,
    SynthEpoch,
    combTrack,
    synthesise,
} from '../spindleTracker';

// The reference selftest's ladder, shortened: the same faults injected in
// the same way (a 5 % 0.4 s blip, a sustained 6 % sag, a one-flute-dominant
// cut, a 1290 Hz non-harmonic tone) and the same expectations.
const LADDER: SynthEpoch[] = [
    { s: 18000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 8, recoverS: 1.5, droop: 0.005, blip: [3.0, 0.4, 0.05] },
    { s: 12000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 8, recoverS: 1.5, droop: 0.005, chatter: [1290, 0.25] },
    { s: 18000, feed: 350, spinUpS: 2.5, baselineS: 3, cutS: 8, recoverS: 1.5, droop: 0.005, runoutAmp: 1.2 },
    { s: 8000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 8, recoverS: 1.5, droop: 0.005, sag: [1.0, 0.06] },
];

interface Run {
    summaries: EpochSummary[];
    events: SpindleEvent[];
    frames: FrameResult[];
}

let cached: Run | null = null;

function run(): Run {
    if (cached) {
        return cached;
    }
    const synth = synthesise(LADDER);
    const events: SpindleEvent[] = [];
    const frames: FrameResult[] = [];
    const analyser = new SpindleAudioAnalyser({
        contextAt: synth.contextAt,
        onEvent: (event) => events.push(event),
        onFrame: (frame) => frames.push(frame),
    });
    // Feed in uneven chunks, as a pipe would.
    let offset = 0;
    const chunk = 3001;
    while (offset < synth.samples.length) {
        analyser.push(synth.samples.subarray(offset, Math.min(offset + chunk, synth.samples.length)));
        offset += chunk;
    }
    cached = { summaries: analyser.finish(), events, frames };
    return cached;
}

function byEpoch(kind: string): number[] {
    return run().events.filter((event) => event.kind === kind).map((event) => event.epoch);
}

export const tests: Array<[string, () => void]> = [
    ['the FFT of a pure tone peaks at its bin', () => {
        const fft = new Fft(NFFT);
        const re = new Float64Array(NFFT);
        const im = new Float64Array(NFFT);
        const bin = 1000;
        for (let i = 0; i < NFFT; i++) {
            re[i] = Math.cos((2 * Math.PI * bin * i) / NFFT);
        }
        fft.transform(re, im);
        let best = 0;
        for (let k = 1; k < NFFT / 2; k++) {
            if (re[k] * re[k] + im[k] * im[k] > re[best] * re[best] + im[best] * im[best]) {
                best = k;
            }
        }
        assert.equal(best, bin);
        assert.ok(Math.abs(re[bin] - NFFT / 2) < 1e-6);
    }],

    ['the comb locks onto a synthetic harmonic series within 0.1 %', () => {
        const rpm = 17640; // 2 % below commanded, inside the search band
        const fRev = rpm / 60;
        const binHz = 16000 / NFFT;
        const logPower = new Float64Array(NFFT / 2 + 1).fill(Math.log(1e-6));
        for (const k of [1, 2, 3, 4, 8]) {
            logPower[Math.round((k * fRev) / binHz)] = Math.log(1);
        }
        const result = combTrack(logPower, 18000);
        assert.ok(Math.abs(result.rpm - rpm) / rpm < 0.001, `tracked ${result.rpm}`);
        assert.ok(result.confidence > 2, `confidence ${result.confidence}`);
    }],

    ['every epoch is tracked: baselines within 0.5 % of the commanded S', () => {
        const { summaries } = run();
        assert.equal(summaries.length, 4);
        summaries.forEach((summary, i) => {
            assert.ok(summary.baselineRpm !== null, `epoch ${i} has a baseline`);
            assert.ok(Math.abs((summary.baselineRpm as number) / LADDER[i].s - 1) < 0.005, `epoch ${i} baseline ${summary.baselineRpm}`);
            assert.equal(summary.baselineSource, 'epoch');
            assert.equal(summary.reachFlag, false);
            assert.ok(summary.cutFrames > 100, `epoch ${i} cut frames ${summary.cutFrames}`);
        });
    }],

    ['verdicts: blip, hold, hold, struggle - as the reference selftest expects', () => {
        const { summaries } = run();
        assert.deepEqual(summaries.map((s) => s.verdict), ['BLIP', 'HOLD', 'HOLD', 'STRUGGLE']);
        const blip = summaries[0];
        assert.ok((blip.minRel as number) < 0.97 && (blip.minRel as number) > 0.93, `blip depth ${blip.minRel}`);
        assert.ok(blip.longestBelow97Ms < 1000, `blip length ${blip.longestBelow97Ms}`);
        assert.ok((blip.medianDrop as number) < 0.03);
        const sag = summaries[3];
        assert.ok((sag.medianDrop as number) > 0.03, `sag median drop ${sag.medianDrop}`);
        assert.ok(sag.timeBelow95Ms > 5000, `sag time below 95 % ${sag.timeBelow95Ms}`);
    }],

    ['events: one blip, one sag, no reach failures, one epoch summary each', () => {
        assert.deepEqual(byEpoch('spindle_blip'), [0]);
        assert.deepEqual(byEpoch('spindle_sag'), [3]);
        assert.deepEqual(byEpoch('spindle_reach'), []);
        assert.deepEqual(byEpoch('spindle_nolock'), []);
        assert.deepEqual(byEpoch('spindle_epoch'), [0, 1, 2, 3]);
        const sag = run().events.find((event) => event.kind === 'spindle_sag') as SpindleEvent;
        assert.ok(sag.tMs < run().summaries[3].endMs, 'the sag is reported while the cut is still running, not at the end');
    }],

    ['chatter is flagged only where the non-harmonic tone was injected, at its frequency', () => {
        const { summaries } = run();
        assert.deepEqual(summaries.map((s) => s.chatterFlag), [false, true, false, false]);
        assert.deepEqual(byEpoch('chatter'), [1]);
        const chatter = summaries[1];
        assert.ok(Math.abs((chatter.chatterHz as number) - 1290) < 15, `chatter at ${chatter.chatterHz} Hz`);
        assert.ok((chatter.chatterRibMm as number) > 0.002 && (chatter.chatterRibMm as number) < 0.003, `rib ${chatter.chatterRibMm}`);
    }],

    ['a blip is not chatter: the per-frame mask follows the tracked RPM through the dip', () => {
        const { summaries, frames } = run();
        assert.equal(summaries[0].chatterFlag, false);
        // Frames inside the blip keep their chatter index below the flag
        // threshold; the frames straddling the RPM step (two combs at once)
        // carry no index at all rather than a false one.
        const dip = frames.filter((frame) => frame.epoch === 0 && frame.role === 'cut' && frame.rel < 0.97);
        assert.ok(dip.length >= 4, `dip frames ${dip.length}`);
        assert.ok(dip.some((frame) => !Number.isNaN(frame.chatterExcessDb)), 'steady frames inside the dip are indexed');
        for (const frame of dip) {
            assert.ok(Number.isNaN(frame.chatterExcessDb) || frame.chatterExcessDb < 12,
                `frame at ${frame.tMs} ms: chatter index ${frame.chatterExcessDb} dB during the blip`);
        }
    }],

    ['runout is flagged only in the one-flute-dominant epoch', () => {
        const { summaries } = run();
        assert.deepEqual(summaries.map((s) => s.runoutFlag), [false, false, true, false]);
        assert.deepEqual(byEpoch('runout'), [2]);
        assert.ok((summaries[2].runoutIndexDb as number) > -3);
        assert.ok((summaries[0].runoutIndexDb as number) < -3, `clean epoch runout index ${summaries[0].runoutIndexDb}`);
        assert.ok(Math.abs((summaries[2].revRibMm as number) - 350 / 18000) < 1e-6);
    }],

    ['frames outside the spindle epochs are off and untracked', () => {
        const { frames } = run();
        const off = frames.filter((frame) => frame.role === 'off');
        assert.ok(off.length > 5);
        assert.ok(off.every((frame) => Number.isNaN(frame.rpm)));
        const roles = new Set(frames.map((frame) => frame.role));
        for (const role of ['spinup', 'transition', 'baseline', 'cut']) {
            assert.ok(roles.has(role as FrameResult['role']), `saw ${role} frames`);
        }
    }],

    ['a cut with no baseline of its own borrows the previous epoch at the same S, else the commanded S', () => {
        const synth = synthesise([
            { s: 12000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 3, recoverS: 0.5 },
            { s: 12000, feed: 200, spinUpS: 0, baselineS: 0, cutS: 3, recoverS: 0.5 },
            { s: 9000, feed: 200, spinUpS: 0, baselineS: 0, cutS: 3, recoverS: 0.5 },
        ]);
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt });
        analyser.push(synth.samples);
        const summaries = analyser.finish();
        assert.equal(summaries[0].baselineSource, 'epoch');
        assert.equal(summaries[1].baselineSource, 'previous-epoch');
        assert.equal(summaries[2].baselineSource, 'commanded');
        assert.ok(summaries[1].verdict === 'HOLD' || summaries[1].verdict === 'BLIP');
    }],

    ['silence while "cutting" is NO-LOCK, never a sag', () => {
        const synth = synthesise([{ s: 15000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 4, recoverS: 0.5 }]);
        // Replace the cut with noise only.
        const [cutStart, cutEnd] = synth.cuts[0];
        const from = Math.round((cutStart / 1000) * 16000);
        const to = Math.round((cutEnd / 1000) * 16000);
        let seed = 7;
        for (let i = from; i < to; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            synth.samples[i] = (seed / 4294967296 - 0.5) * 0.2;
        }
        const events: SpindleEvent[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onEvent: (event) => events.push(event) });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        assert.equal(summary.verdict, 'NO-LOCK');
        assert.ok(!events.some((event) => event.kind === 'spindle_sag'));
        assert.ok(events.some((event) => event.kind === 'spindle_nolock'));
    }],

    ['every frame carries a loudness, and cutting is louder than the quiet lead-in', () => {
        const { frames } = run();
        assert.ok(frames.every((frame) => Number.isFinite(frame.levelDb)));
        const off = frames.filter((frame) => frame.role === 'off').map((frame) => frame.levelDb);
        const cut = frames.filter((frame) => frame.role === 'cut').map((frame) => frame.levelDb);
        const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
        assert.ok(mean(cut) > mean(off) + 6, `cut ${mean(cut).toFixed(1)} dBFS vs off ${mean(off).toFixed(1)} dBFS`);
        assert.ok(mean(off) < -20, `quiet lead-in ${mean(off).toFixed(1)} dBFS`);
    }],

    ['a spindle far below its band reads NO-LOCK, never STRUGGLE: an edge lock is not a measurement', () => {
        // Runs at 0.2 below S: the comb can only fall to the band's edge.
        const synth = synthesise([{ s: 15000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 5, recoverS: 0.5, droop: 0.2 }]);
        const events: SpindleEvent[] = [];
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({
            contextAt: synth.contextAt,
            onEvent: (event) => events.push(event),
            onFrame: (frame) => frames.push(frame),
        });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        assert.notEqual(summary.verdict, 'STRUGGLE');
        assert.ok(!events.some((event) => event.kind === 'spindle_sag'), 'no sag from edge locks');
        const cut = frames.filter((frame) => frame.role === 'cut');
        assert.ok(cut.length > 50);
        assert.ok(cut.every((frame) => !frame.locked), 'edge-locked frames are unlocked');
    }],

    ['the baseline waits for the spin-up to settle, not just for the clock', () => {
        // A 12 s ramp (the A350 takes ~20 s): baseline frames must start only after it.
        const synth = synthesise([{ s: 12000, feed: 200, spinUpS: 16, baselineS: 3, cutS: 5, recoverS: 0.5, rampS: 12 }]);
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onFrame: (frame) => frames.push(frame) });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        const firstBaseline = frames.find((frame) => frame.role === 'baseline');
        assert.ok(firstBaseline, 'a baseline exists');
        // The epoch starts 0.5 s into the recording; the ramp ends 12 s later.
        assert.ok((firstBaseline as FrameResult).tMs >= 500 + 12000, `baseline began at ${(firstBaseline as FrameResult).tMs} ms`);
        assert.ok(Math.abs((summary.baselineRpm as number) / 12000 - 1) < 0.005, `baseline ${summary.baselineRpm}`);
        assert.equal(summary.verdict, 'HOLD');
        assert.equal(summary.reachFlag, false);
    }],

    ['clipped frames are flagged and never locked', () => {
        const synth = synthesise([{ s: 12000, feed: 200, spinUpS: 2.5, baselineS: 3, cutS: 3, recoverS: 0.5 }]);
        // Drive the signal into hard clipping.
        for (let i = 0; i < synth.samples.length; i++) {
            synth.samples[i] = Math.max(-1, Math.min(1, synth.samples[i] * 400));
        }
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onFrame: (frame) => frames.push(frame) });
        analyser.push(synth.samples);
        analyser.finish();
        const clipped = frames.filter((frame) => frame.clipped);
        assert.ok(clipped.length > frames.length / 2, `clipped ${clipped.length} of ${frames.length}`);
        assert.ok(clipped.every((frame) => !frame.locked));
        assert.equal(analyser.clippedFrames, clipped.length);
    }],

    ['a spindle that idles under S but runs at S once loaded: HOLD, no reach flag, idle offset reported', () => {
        // The A350 at S8000 (2026-09-29): idle 7477, loaded 8000.
        const synth = synthesise([{ s: 8000, feed: 500, spinUpS: 2.5, baselineS: 4, cutS: 8, recoverS: 1, droop: 0.0, idleRel: 0.935 }]);
        const events: SpindleEvent[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onEvent: (event) => events.push(event) });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        assert.equal(summary.verdict, 'HOLD', 'the cut never drops below the unloaded speed');
        assert.equal(summary.reachFlag, true, 'operator rule: unloaded more than 2 % off S is a reach failure (the cut started on the plateau)');
        assert.ok(Math.abs((summary.loadedRefRpm as number) - 8000) < 40, `loaded ref ${summary.loadedRefRpm}`);
        assert.ok(Math.abs((summary.idleError as number) + 0.065) < 0.01, `idle error ${summary.idleError}`);
        assert.ok(Math.abs((summary.baselineRpm as number) - 7480) < 40, `idle ${summary.baselineRpm}`);
        assert.ok(!events.some((event) => event.kind === 'spindle_sag'));
        assert.ok(events.some((event) => event.kind === 'spindle_reach'), 'the idle offset is announced once');
    }],

    ['a spindle that reaches S unloaded but drops 8 % under load is STRUGGLING, with no reach flag', () => {
        const synth = synthesise([{ s: 8000, feed: 500, spinUpS: 2.5, baselineS: 4, cutS: 8, recoverS: 1, droop: 0.08 }]);
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        assert.equal(summary.reachFlag, false, 'unloaded it is on S');
        assert.equal(summary.verdict, 'STRUGGLE');
        assert.ok((summary.medianDrop as number) > 0.06, `median drop ${summary.medianDrop}`);
        assert.ok(Math.abs((summary.loadedRefRpm as number) - 7360) < 60, `loaded ${summary.loadedRefRpm}`);
    }],

    ['the gantry tone is tracked as its own thing and does not disturb the spindle lock', () => {
        const synth = synthesise([{ s: 8000, feed: 500, spinUpS: 2.5, baselineS: 3, cutS: 6, recoverS: 1, gantry: [205, 0.4] }]);
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onFrame: (frame) => frames.push(frame) });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        const cut = frames.filter((frame) => frame.role === 'cut' && frame.locked);
        assert.ok(cut.length > 60, `locked cut frames ${cut.length}`);
        const motion = cut.map((frame) => frame.motionHz).sort((a, b) => a - b);
        assert.ok(Math.abs(motion[motion.length >> 1] - 205) < 2, `motion comb ${motion[motion.length >> 1]} Hz`);
        assert.ok(Math.abs((summary.cutMedianRpm as number) - 8000) < 40, `spindle ${summary.cutMedianRpm}`);
        assert.equal(summary.verdict, 'HOLD');
        assert.ok(frames.every((frame) => frame.bands.length === 8));
        const off = frames.filter((frame) => frame.role === 'off');
        assert.ok(off.every((frame) => Number.isFinite(frame.motionHz)), 'the motion comb is fitted with the spindle off too');
    }],

    ['a rapid singing at the spindle plateau frequency is ambiguous, not RPM', () => {
        // Spindle plateau 0.935 x S8000 = 7480 RPM = 124.7 Hz; the X rapid also makes a 124.7 Hz series.
        const synth = synthesise([{
            s: 8000, feed: 500, spinUpS: 2.5, baselineS: 4, cutS: 4, recoverS: 1, idleRel: 0.935, gantryFree: [124.7, 0.5], freeKind: 'rapid',
        }]);
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onFrame: (frame) => frames.push(frame) });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        // The free phase (rapid moves with the 124.7 Hz gantry series) starts 3.0 s in; the 0.5 s of settled
        // still spindle before it is a legitimate baseline.
        const rapid = frames.filter((frame) => frame.tMs >= 3100 && frame.tMs < 6900 && frame.sCommanded === 8000);
        const flagged = rapid.filter((frame) => frame.ambiguous);
        assert.ok(flagged.length > 0.8 * rapid.length, `ambiguous ${flagged.length} of ${rapid.length} rapid frames`);
        assert.ok(flagged.every((frame) => !frame.locked));
        assert.ok(summary.baselineFrames <= 14, `only the still frames before the rapid form the baseline: ${summary.baselineFrames}`);
        const cut = frames.filter((frame) => frame.role === 'cut' && frame.locked);
        assert.ok(cut.length > 40, 'cutting (spindle at S, no gantry tone on the spindle) still locks');
    }],

    ['the idle baseline follows the spindle up off its soft-start plateau', () => {
        // Two back-to-back epochs at the same S: 12 s free at the plateau (0.935 x S), then 8 s free at S before the cut.
        // The rolling baseline must be the settled 8000, not the plateau, and there is no reach flag.
        const two = synthesise([
            { s: 8000, feed: 500, spinUpS: 0, baselineS: 12, cutS: 0.3, recoverS: 0, idleRel: 0.935 },
            { s: 8000, feed: 500, spinUpS: 0, baselineS: 8, cutS: 4, recoverS: 1 },
        ]);
        const analyser = new SpindleAudioAnalyser({ contextAt: two.contextAt });
        analyser.push(two.samples);
        const summaries = analyser.finish();
        const last = summaries[summaries.length - 1];
        assert.ok(Math.abs((last.baselineRpm as number) - 8000) < 40, `baseline ${last.baselineRpm} (the settled 8000, not the plateau)`);
        assert.equal(last.reachFlag, false);
    }],

    ['a 2x-dominant gantry comb inside the band is never the spindle, even when the context says dwell (job b3e8f3dd0e34)', () => {
        // The spindle never turns; the Y axis traverses at F500 singing 124.5 Hz with its second
        // harmonic 17 dB over the fundamental; the (wrong) context says "dwell after M3 S8000".
        const synth = synthesise([{
            s: 8000,
            feed: 500,
            spinUpS: 0,
            baselineS: 8,
            cutS: 0.3,
            recoverS: 0,
            spindleAmp: 0,
            gantryFree: [124.5, 0.6],
            gantryShape: [0.14, 1, 0.12, 0.6, 0.15, 0.2, 0.05, 0.1],
        }]);
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onFrame: (frame) => frames.push(frame) });
        analyser.push(synth.samples);
        const [summary] = analyser.finish();
        const searched = frames.filter((frame) => frame.role !== 'off');
        const flagged = searched.filter((frame) => frame.gantryLike);
        assert.ok(searched.length > 100, `searched ${searched.length}`);
        assert.ok(flagged.length > searched.length * 0.8, `gantry-like ${flagged.length} of ${searched.length}`);
        assert.ok(searched.every((frame) => !frame.locked), 'no frame locks on the gantry');
        assert.equal(summary.baselineRpm, null, 'no idle baseline from the gantry');
        assert.equal(summary.reachFlag, false, 'no false "not reaching" event');
    }],

    ['the spindle\'s own 1x-dominant comb is not gantry-like', () => {
        const synth = synthesise([{ s: 8000, feed: 500, spinUpS: 1, baselineS: 4, cutS: 4, recoverS: 1 }]);
        const frames: FrameResult[] = [];
        const analyser = new SpindleAudioAnalyser({ contextAt: synth.contextAt, onFrame: (frame) => frames.push(frame) });
        analyser.push(synth.samples);
        analyser.finish();
        const locked = frames.filter((frame) => frame.locked);
        const flagged = frames.filter((frame) => frame.role !== 'off' && frame.gantryLike);
        assert.ok(locked.length > 100, `locked ${locked.length}`);
        assert.ok(flagged.length < 3, `gantry-like ${flagged.length}`);
        const spectrum = analyser.latestSpectrum();
        assert.ok(spectrum && spectrum.db.length === 96 && spectrum.hz[0] === 30 && spectrum.hz[95] === 8000, 'log spectrum for the live view');
    }],

    ['analysis cost is bounded per frame', () => {
        const { frames } = run();
        const cost = frames.map((frame) => frame.costMs);
        const mean = cost.reduce((a, b) => a + b, 0) / cost.length;
        assert.ok(mean < 25, `mean ${mean.toFixed(2)} ms per 50 ms frame`);
    }],
];
