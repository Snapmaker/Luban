import assert from 'assert';

import { SensorSpec, parseSensor } from '../vibrationConfig';
import { MonitorBatch, decodeBatch } from '../vibrationProtocol';
import { SensorStream } from '../vibrationStream';

type TestCase = [string, () => void | Promise<void>];

function spec(id: string, extra: { [key: string]: unknown } = {}): SensorSpec {
    const parsed = parseSensor({ id, location: 'frame', chip: 'lsm6dsox', odr_hz: 833, ...extra }, 0);
    assert.ok(typeof parsed !== 'string', String(parsed));
    return parsed as SensorSpec;
}

function int16(values: number[]): string {
    const buf = Buffer.alloc(values.length * 2);
    values.forEach((v, i) => buf.writeInt16LE(v, i * 2));
    return buf.toString('base64');
}

function fifo(id: string, seq: number, n: number, stampS: number, first: number, extra: { [key: string]: unknown } = {}): MonitorBatch {
    const values: number[] = [];
    for (let i = 0; i < n; i++) {
        values.push(first + i, 0, 8192);
    }
    return decodeBatch({ t: 'batch', id, mode: 'fifo', seq, n, a: int16(values), as: 0.000122, odr: 833.4, ts: stampS, ...extra });
}

export const tests: TestCase[] = [
    ['a reconnect starts a new run whose first batch is a gap; the very first run is not', () => {
        const stream = new SensorStream(spec('head'), 10);
        stream.newRun(); // the monitor's first ready
        const first = stream.ingest(fifo('head', 0, 83, 100.1, 0), 100100);
        assert.ok(first && !first.gap, 'the first samples ever are not a gap');
        assert.ok(!(stream.ingest(fifo('head', 1, 83, 100.2, 83), 100200) as { gap: boolean }).gap);
        // Bridge restart: the monitor comes back, sequence numbers restart at 0.
        stream.lost();
        assert.strictEqual(stream.state, 'waiting');
        stream.newRun();
        const resumed = stream.ingest(fifo('head', 0, 83, 130.0, 0), 130000);
        assert.ok(resumed && resumed.gap, 'the first batch after a restart is a gap');
        assert.ok(!(stream.ingest(fifo('head', 1, 83, 130.1, 83), 130100) as { gap: boolean }).gap);
        assert.strictEqual(stream.gaps, 1);
        assert.strictEqual(stream.runs, 2);
        assert.strictEqual(stream.samples, 4 * 83);
    }],

    ['eight interleaved streams keep their own samples, clocks and restarts', () => {
        const streams = Array.from({ length: 8 }, (_, i) => new SensorStream(spec(`s${i}`), 30));
        const seen: number[][] = streams.map(() => []);
        let gaps = 0;
        for (let round = 0; round < 40; round++) {
            if (round === 20) {
                // Half of them sit on a board that restarts.
                for (let i = 0; i < 4; i++) {
                    streams[i].lost();
                    streams[i].newRun();
                }
            }
            streams.forEach((stream, i) => {
                const seq = round >= 20 && i < 4 ? round - 20 : round;
                const n = 40 + ((round + i) % 7);
                const base = i * 3000 + seen[i].length;
                const out = stream.ingest(fifo(`s${i}`, seq, n, 1000 + round * 0.05 + i * 0.001, base), (1000 + round * 0.05) * 1000);
                assert.ok(out);
                const samples = out as NonNullable<typeof out>;
                if (samples.gap) {
                    gaps++;
                }
                for (let k = 0; k < samples.accel.length / 3; k++) {
                    seen[i].push(Math.round(samples.accel[k * 3] / 0.000122));
                }
            });
        }
        assert.strictEqual(gaps, 4, 'exactly the four restarted streams report one gap each');
        seen.forEach((values, i) => {
            values.forEach((v, k) => assert.strictEqual(v, i * 3000 + k, `stream ${i} sample ${k}`));
            assert.strictEqual(streams[i].ring?.length, values.length);
        });
    }],

    ['a poll stream with a gyro carries it through the resampler into the ring', () => {
        const stream = new SensorStream(spec('chuck', { chip: 'bno055', gyro: true, poll_hz: 100 }), 10);
        const offsets = Buffer.alloc(3 * 4);
        [0, 10000, 20000].forEach((us, i) => offsets.writeUInt32LE(us, i * 4));
        const batch = decodeBatch({
            id: 'chuck',
            mode: 'poll',
            n: 3,
            a: int16([0, 0, 100, 0, 0, 100, 0, 0, 100]),
            as: 0.01,
            g: int16([10, 0, 0, 20, 0, 0, 30, 0, 0]),
            ng: 3,
            gs: 0.07,
            dt: offsets.toString('base64'),
            ts: 5,
        });
        const out = stream.ingest(batch, 5020);
        assert.ok(out && out.gyro, 'gyro survives the poll path');
        const gyro = (out as NonNullable<typeof out>).gyro as Float32Array;
        assert.deepStrictEqual(Array.from(gyro.filter((_, k) => k % 3 === 0)).map((v) => Math.round(v * 100) / 100), [0.7, 1.4, 2.1]);
        const back = stream.ring?.slice(0, Infinity);
        assert.ok(back && back.gyro && back.gyro.length === 9);
    }],

    ['a board clock is mapped to the host by the least-delayed batch', () => {
        const stream = new SensorStream(spec('tail'), 10);
        const delays = [40, 12, 25, 9, 30];
        let last: Float64Array = new Float64Array(0);
        delays.forEach((delay, seq) => {
            const boardS = 50 + seq * 0.1;
            const out = stream.ingest(fifo('tail', seq, 10, 0, 0, { ts: undefined, tus: Math.round(boardS * 1e6) }), 7000000 + boardS * 1000 + delay);
            last = (out as NonNullable<typeof out>).hostMs;
        });
        // The last batch's final sample = board time + the smallest delay seen (9 ms).
        assert.ok(Math.abs(last[last.length - 1] - (7000000 + 50.4 * 1000 + 9)) < 1e-6, `${last[last.length - 1]}`);
    }],
];
