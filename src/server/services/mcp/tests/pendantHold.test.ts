import assert from 'assert';
import {
    A350_STEPS_PER_MM, HOLD_COUNT_POLL_MS, HOLD_FEATHER_GAP_MS, HOLD_HEARTBEAT_MAX_AGE_MS, HOLD_LATE_EVENTS_TO_DISABLE, HOLD_MOVE_MS, HOLD_QUEUE_AHEAD_MS,
    HOLD_TICK_MS, HoldQueueModel, countCheckMode, countFault, countToMachine, countToMm, extendAlong, holdMoveMm, holdRunoutMm, judgeCountSample,
    learnCountOffset, parseCountReport, parseStepsPerMm, queuedMoveGcode,
} from '../pendantHold';

const origin = { x: 10, y: 20, z: 300 };

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['the pacing constants are the operator\'s: 100 ms ticks and increments, 200 ms queued ahead, 150 ms Feather gap, 250 ms Count poll', () => {
        assert.equal(HOLD_TICK_MS, 100);
        assert.equal(HOLD_MOVE_MS, 100);
        assert.equal(HOLD_QUEUE_AHEAD_MS, 200);
        assert.equal(HOLD_FEATHER_GAP_MS, 150);
        assert.equal(HOLD_COUNT_POLL_MS, 250);
        assert.equal(HOLD_HEARTBEAT_MAX_AGE_MS, 4500, 'two 2 s poll periods plus jitter: one late poll never flips a hold');
        assert.equal(HOLD_LATE_EVENTS_TO_DISABLE, 3);
        assert.equal(holdMoveMm(3000), 5);
        assert.equal(holdRunoutMm(3000), 10);
        assert.equal(holdRunoutMm(300), 1);
    }],
    ['the clock model admits increments only while at most 200 ms is outstanding and charges each from its send time', () => {
        const model = new HoldQueueModel(origin);
        assert.equal(model.outstandingMs(0), 0);
        assert.ok(model.admits(0, 100));
        model.sent(0, origin, { x: 15, y: 20, z: 300 }, 100);
        assert.equal(model.outstandingMs(0), 100);
        assert.ok(model.admits(0, 100), 'a second increment primes the queue');
        model.sent(50, { x: 15, y: 20, z: 300 }, { x: 20, y: 20, z: 300 }, 100);
        assert.equal(model.endsAtMs, 200, 'queued behind the first, not from its own send time');
        assert.equal(model.outstandingMs(50), 150);
        assert.ok(!model.admits(50, 100), 'a third would exceed the cap');
        assert.ok(!model.admits(99, 100));
        assert.ok(model.admits(100, 100), 'admitted again once a tick has executed');
        model.sent(300, { x: 20, y: 20, z: 300 }, { x: 25, y: 20, z: 300 }, 100);
        assert.equal(model.endsAtMs, 400, 'after a gap the increment starts at its send time');
        assert.equal(model.count, 3);
    }],
    ['the expected executed position interpolates along the sent increments by the clock', () => {
        const model = new HoldQueueModel(origin);
        assert.deepEqual(model.expectedAt(0), origin);
        model.sent(0, origin, { x: 15, y: 20, z: 300 }, 100);
        model.sent(0, { x: 15, y: 20, z: 300 }, { x: 15, y: 30, z: 300 }, 100);
        assert.deepEqual(model.expectedAt(-1), origin);
        assert.deepEqual(model.expectedAt(50), { x: 12.5, y: 20, z: 300 });
        assert.deepEqual(model.expectedAt(100), { x: 15, y: 20, z: 300 });
        assert.deepEqual(model.expectedAt(150), { x: 15, y: 25, z: 300 });
        assert.deepEqual(model.expectedAt(1000), { x: 15, y: 30, z: 300 });
        const copy = model.expectedAt(1000); copy.x = 0;
        assert.equal(model.expectedAt(1000).x, 15, 'returns copies');
    }],
    ['extendAlong pushes the obstacle test past the increment by the queued run-out', () => {
        assert.deepEqual(extendAlong({ x: 0, y: 0, z: 1 }, { x: 3, y: 4, z: 1 }, 5), { x: 6, y: 8, z: 1 });
        assert.deepEqual(extendAlong({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, 5), { x: 0, y: 0, z: 1 }, 'no direction, no extension');
        assert.deepEqual(extendAlong({ x: 0, y: 0, z: 1 }, { x: 3, y: 4, z: 1 }, 0), { x: 3, y: 4, z: 1 });
    }],
    ['M114 Count parsing accepts Marlin 1.x and 2.x spacing and never invents missing fields', () => {
        const two = parseCountReport('X:12.50 Y:-3.00 Z:328.00 E:0.00 Count X:5000 Y:-1200 Z:131200');
        assert.deepEqual(two, { position: { x: 12.5, y: -3, z: 328 }, count: { x: 5000, y: -1200, z: 131200 } });
        const one = parseCountReport('ok X:12.50 Y:-3.00 Z:328.00 E:0.00 Count X: 5000 Y: -1200 Z: 131200\nok');
        assert.deepEqual(one.count, { x: 5000, y: -1200, z: 131200 });
        assert.deepEqual(one.position, { x: 12.5, y: -3, z: 328 });
        assert.deepEqual(parseCountReport('X:1.000 Y:2.000 Z:3.000'), { position: { x: 1, y: 2, z: 3 }, count: null });
        assert.deepEqual(parseCountReport('ok'), { position: null, count: null });
        assert.deepEqual(parseCountReport(undefined), { position: null, count: null });
        assert.deepEqual(parseCountReport('Count X:1 Y:2 Z:3'), { position: null, count: { x: 1, y: 2, z: 3 } }, 'Count alone is not a position');
        assert.deepEqual(countToMm({ x: 5000, y: -1200, z: 131200 }, A350_STEPS_PER_MM), { x: 12.5, y: -3, z: 328 });
    }],
    ['steps per mm come from M92 in the M503 S report, else the caller falls back to the A350 default', () => {
        assert.deepEqual(parseStepsPerMm('echo:  M92 X400.00 Y400.00 Z400.00 E212.00\necho:  M203 X120.00 Y120.00 Z40.00'), { x: 400, y: 400, z: 400 });
        assert.deepEqual(parseStepsPerMm('echo:  M92 X80.00 Y80.00 Z1600.00 E212.00'), { x: 80, y: 80, z: 1600 });
        assert.equal(parseStepsPerMm('echo:  M203 X120.00 Y120.00 Z40.00'), null);
        assert.equal(parseStepsPerMm('echo:  M92 X0 Y400 Z400'), null, 'a zero step count is not usable');
        assert.deepEqual(A350_STEPS_PER_MM, { x: 400, y: 400, z: 400 });
    }],
    ['a Count sample is off only beyond one increment plus the position tolerance, in either direction; no Count is no verdict', () => {
        const expected = { x: 20, y: 20, z: 300 };
        assert.deepEqual(judgeCountSample(null, expected, 5, 0.05), { lagMm: null, off: false });
        assert.deepEqual(judgeCountSample({ x: 15.1, y: 20, z: 300 }, expected, 5, 0.05), { lagMm: 4.9, off: false });
        const edge = judgeCountSample({ x: 14.9, y: 20, z: 300 }, expected, 5, 0.05);
        assert.ok(edge.lagMm !== null && Math.abs(edge.lagMm - 5.1) < 1e-9 && edge.off);
        assert.equal(judgeCountSample({ x: 20, y: 20, z: 0 }, expected, 5, 0.05).off, false, 'Z is not judged: the hold never commands it');
        assert.equal(judgeCountSample({ x: 26, y: 20, z: 300 }, expected, 5, 0.05).off, true, 'leading the model by more than an increment also counts (symmetric)');
    }],
    ['the Count offset is learned from the operator\'s at-rest sample and a later sample reads as 10 mm travelled with zero lag', () => {
        // A350 trial 2026-10-05: machine X263.42 Y0 Z299.67 printed Count X:112966 Y:1600 Z:119867 (400 steps/mm).
        const steps = { x: 400, y: 400, z: 400 };
        const atRest = parseCountReport('X:263.420 Y:0.000 Z:299.670 E:0.00 Count X:112966 Y:1600 Z:119867');
        assert.ok(atRest.count);
        const offset = learnCountOffset(atRest.count as { x: number; y: number; z: number }, steps, { x: 263.42, y: 0, z: 299.67 }, 1234);
        assert.ok(Math.abs(offset.x - 19) < 0.005 && Math.abs(offset.y - 4) < 0.005 && Math.abs(offset.z) < 0.005, JSON.stringify(offset));
        assert.equal(offset.learnedAt, 1234);
        assert.deepEqual(offset.count, { x: 112966, y: 1600, z: 119867 });
        assert.deepEqual(offset.machine, { x: 263.42, y: 0, z: 299.67 });
        // Later, 10 mm further along X: the Count-derived machine position is X273.42 and the lag against the model is nil.
        const later = parseCountReport('Count X:116966 Y:1600 Z:119867').count as { x: number; y: number; z: number };
        const derived = countToMachine(later, steps, offset);
        assert.ok(Math.abs(derived.x - 273.42) < 0.005 && Math.abs(derived.y) < 0.005 && Math.abs(derived.z - 299.67) < 0.005, JSON.stringify(derived));
        assert.ok(Math.abs(derived.x - offset.machine.x - 10) < 0.005, 'ten millimetres travelled');
        const judged = judgeCountSample(derived, { x: 273.42, y: 0, z: 299.67 }, 0.5, 0.05);
        assert.ok(judged.lagMm !== null && judged.lagMm < 0.01 && !judged.off, JSON.stringify(judged));
        // The raw comparison the offset replaces would have read a constant 19.4 mm "lag".
        const raw = judgeCountSample(countToMm(later, steps), { x: 273.42, y: 0, z: 299.67 }, 0.5, 0.05);
        assert.ok(raw.lagMm !== null && raw.lagMm > 19 && raw.off);
    }],
    ['a hold increment is G1 X Y F with no Z word; the settled form still carries Z', () => {
        assert.equal(queuedMoveGcode({ x: 12.3456, y: -0.5, z: 327.999 }, 300, true), 'G1 X12.346 Y-0.500 F300;');
        assert.equal(queuedMoveGcode({ x: 12.3456, y: -0.5, z: 327.999 }, 300, false), 'G1 X12.346 Y-0.500 Z327.999 F300;');
    }],
    ['countFault names the late reply, the missing Count or the lag; a clean sample is no fault', () => {
        const xyz = { x: 1, y: 2, z: 3 };
        const base = { at: 0, execMs: 40, late: false, count: xyz, rawMm: xyz, derived: xyz, position: null, expected: xyz, lagMm: 0, off: false, error: null };
        assert.equal(countFault(base, 5), null);
        assert.match(String(countFault({ ...base, late: true, execMs: 140 }, 5)), /took 140 ms \(limit one tick, 100 ms\)/);
        assert.match(String(countFault({ ...base, count: null, rawMm: null, derived: null }, 5)), /no Count fields/);
        assert.match(String(countFault({ ...base, derived: null }, 5)), /offset was not learned at arm/);
        assert.match(String(countFault({ ...base, lagMm: 7.25, off: true }, 5)),
            /7\.25 mm from the expected executed position \(limit one increment, 5\.00 mm\)/);
        assert.match(String(countFault({ ...base, error: 'transport_error' }, 5)), /M114 failed during the hold: transport_error/);
    }],
    ['the Count check mode is observe unless the operator sets exactly "enforced"', () => {
        assert.equal(countCheckMode(undefined), 'observe');
        assert.equal(countCheckMode(''), 'observe');
        assert.equal(countCheckMode('1'), 'observe');
        assert.equal(countCheckMode('observe'), 'observe');
        assert.equal(countCheckMode('enforced'), 'enforced');
        assert.equal(countCheckMode(' Enforced '), 'enforced');
    }],
];
