import assert from 'assert';
import * as fs from 'fs';
import path from 'path';

import { VIBRATION_MONITOR_SOURCE } from '../vibrationMonitorSource';
import { FifoClock, MonitorBatch, PollResampler, ProtocolError, decodeBatch } from '../vibrationProtocol';

type TestCase = [string, () => void | Promise<void>];

function int16(values: number[]): string {
    const buf = Buffer.alloc(values.length * 2);
    values.forEach((v, i) => buf.writeInt16LE(v, i * 2));
    return buf.toString('base64');
}

function fifoBatch(seq: number, n: number, stampS: number, extra: { [key: string]: unknown } = {}): MonitorBatch {
    const values: number[] = [];
    for (let i = 0; i < n; i++) {
        values.push(0, 0, 8197);
    }
    return decodeBatch({ t: 'batch', id: 'head', mode: 'fifo', seq, n, a: int16(values), as: 0.000122, odr: 1666.75, ts: stampS, ...extra });
}

export const tests: TestCase[] = [
    ['the embedded monitor is byte-identical to vibration_monitor.py (the file boards run as code.py)', () => {
        const file = fs.readFileSync(path.join(__dirname, '..', 'vibration_monitor.py'), 'utf8').replace(/\r\n/g, '\n');
        assert.ok(VIBRATION_MONITOR_SOURCE === file, 'vibrationMonitorSource.ts is stale: run node build/embed-vibration-monitor.js');
    }],

    ['a FIFO batch decodes to g, with gyro and the board clock', () => {
        const batch = decodeBatch({
            t: 'batch',
            id: 'tail',
            mode: 'fifo',
            seq: 4,
            n: 2,
            a: int16([100, -100, 8192, 0, 0, -8192]),
            as: 0.000122,
            g: int16([1000, 0, 0, 0, 0, -1000]),
            ng: 2,
            gs: 0.07,
            ovr: true,
            tus: 12_500_000,
        });
        assert.strictEqual(batch.n, 2);
        assert.ok(Math.abs(batch.accel[2] - 0.999424) < 1e-6);
        assert.ok(Math.abs(batch.accel[5] + 0.999424) < 1e-6);
        assert.ok(batch.gyro && Math.abs(batch.gyro[0] - 70) < 1e-4);
        assert.strictEqual(batch.overrun, true);
        assert.strictEqual(batch.clock, 'board');
        assert.strictEqual(batch.stampS, 12.5);
    }],

    ['malformed batches are protocol errors, not samples', () => {
        assert.throws(() => decodeBatch({ id: 'x', n: 2, a: int16([1, 2, 3]), as: 1, ts: 1 }), ProtocolError);
        assert.throws(() => decodeBatch({ id: 'x', n: 1, a: int16([1, 2, 3]), as: 1 }), /time stamp/);
        assert.throws(() => decodeBatch({ id: 'x', mode: 'poll', n: 1, a: int16([1, 2, 3]), as: 1, ts: 1 }), /offsets/);
    }],

    ['the FIFO clock spaces samples at the chip rate, then measures the real rate from the stamps', () => {
        const clock = new FifoClock(1666.75);
        const trueRate = 1660.0; // part runs 0.4 % slow
        let count = 0;
        let last: Float64Array = new Float64Array(0);
        for (let seq = 0; seq < 300; seq++) {
            const n = 166;
            count += n;
            const latency = 0.002 + 0.008 * ((seq * 7919) % 13) / 13; // jittery read completion
            const placed = clock.place(fifoBatch(seq, n, 1000 + count / trueRate + latency));
            last = placed.times;
            assert.strictEqual(placed.gap, false);
        }
        const stats = clock.stats();
        assert.strictEqual(stats.rateSource, 'measured');
        assert.ok(Math.abs(stats.rateHz / trueRate - 1) < 2e-4, `rate ${stats.rateHz}`);
        // the last sample sits on the lower envelope: ~2 ms after its true time
        const lastTrue = 1000 + count / trueRate;
        assert.ok(Math.abs(last[last.length - 1] - lastTrue - 0.002) < 0.002, `${last[last.length - 1] - lastTrue}`);
    }],

    ['an overrun or a sequence gap breaks the run and is reported', () => {
        const clock = new FifoClock(833);
        assert.strictEqual(clock.place(fifoBatch(0, 83, 1.0)).gap, false);
        assert.strictEqual(clock.place(fifoBatch(1, 83, 1.1)).gap, false);
        assert.strictEqual(clock.place(fifoBatch(3, 83, 1.3)).gap, true);
        assert.strictEqual(clock.place(fifoBatch(4, 83, 1.4, { ovr: true })).gap, true);
        assert.strictEqual(clock.stats().breaks, 2);
    }],

    ['poll batches are resampled onto an even grid; a long silence is not bridged', () => {
        const resampler = new PollResampler(100, 0.1);
        const offsets = Buffer.alloc(4 * 4);
        [0, 9000, 21000, 30000].forEach((us, i) => offsets.writeUInt32LE(us, i * 4));
        const batch = decodeBatch({ id: 'chuck', mode: 'poll', n: 4, a: int16([0, 0, 0, 0, 0, 100, 0, 0, 200, 0, 0, 300]), as: 0.01, dt: offsets.toString('base64'), ts: 50 });
        const out = resampler.push(batch);
        assert.deepStrictEqual(Array.from(out.times).map((t) => Math.round((t - 50) * 1000)), [0, 10, 20, 30]);
        assert.ok(Math.abs(out.accel[5] - (1 + (1 / 12) * 1)) < 1e-6, `${out.accel[5]}`);
        const later = decodeBatch({ id: 'chuck', mode: 'poll', n: 1, a: int16([0, 0, 0]), as: 0.01, dt: Buffer.alloc(4).toString('base64'), ts: 51 });
        assert.strictEqual(resampler.push(later).gap, true);
    }],
];
