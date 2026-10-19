import { strict as assert } from 'assert';

import { TelemetryRing, downsampleMinMax } from '../telemetryRing';

const COLUMNS = [
    { name: 't', type: 'u32' as const },
    { name: 'rpm', type: 'i16' as const },
    { name: 'db', type: 'i8' as const },
    { name: 'conf', type: 'u8' as const, scale: 10 },
];

export const tests: Array<[string, () => void]> = [
    ['bytes per sample follows the column types', () => {
        const ring = new TelemetryRing(COLUMNS, { maxSamples: 100 });
        assert.equal(ring.bytesPerSample, 4 + 2 + 1 + 1);
    }],

    ['samples read back through the scale, missing values as NaN', () => {
        const ring = new TelemetryRing(COLUMNS, { maxSamples: 100, initialCapacity: 2 });
        ring.push({ t: 10, rpm: 17950, db: -4.4, conf: 3.14 });
        ring.push({ t: 20, rpm: NaN, db: undefined, conf: null });
        assert.equal(ring.length, 2);
        assert.deepEqual(ring.at(0), { t: 10, rpm: 17950, db: -4, conf: 3.1 });
        const second = ring.at(1);
        assert.equal(second.t, 20);
        assert.ok(Number.isNaN(second.rpm));
        assert.ok(Number.isNaN(second.db));
        assert.ok(Number.isNaN(second.conf));
    }],

    ['grows by doubling up to the cap', () => {
        const ring = new TelemetryRing(COLUMNS, { maxSamples: 64, initialCapacity: 4 });
        for (let i = 0; i < 40; i++) {
            ring.push({ t: i, rpm: i, db: 0, conf: 0 });
        }
        assert.equal(ring.length, 40);
        assert.equal(ring.decimation, 1);
        assert.equal(ring.bytesAllocated, 64 * ring.bytesPerSample);
        assert.deepEqual(Array.from(ring.series('rpm', 38)), [38, 39]);
    }],

    ['at the cap it halves the rate and keeps the whole history', () => {
        const ring = new TelemetryRing(COLUMNS, { maxSamples: 8, initialCapacity: 8 });
        for (let i = 0; i < 8; i++) {
            ring.push({ t: i, rpm: i, db: 0, conf: 0 });
        }
        assert.equal(ring.decimation, 1);
        ring.push({ t: 8, rpm: 8, db: 0, conf: 0 }); // 9th sample: decimate 2:1, then this one is kept
        assert.equal(ring.decimation, 2);
        assert.deepEqual(Array.from(ring.series('t')), [0, 2, 4, 6, 8]);
        ring.push({ t: 9, rpm: 9, db: 0, conf: 0 }); // skipped under stride 2
        ring.push({ t: 10, rpm: 10, db: 0, conf: 0 }); // kept
        assert.deepEqual(Array.from(ring.series('t')), [0, 2, 4, 6, 8, 10]);
        assert.equal(ring.totalPushed, 11);
        // Fill to the cap again -> stride 4.
        for (let i = 11; i < 16; i++) {
            ring.push({ t: i, rpm: i, db: 0, conf: 0 });
        }
        assert.equal(ring.length, 8);
        assert.deepEqual(Array.from(ring.series('t')), [0, 2, 4, 6, 8, 10, 12, 14]);
        ring.push({ t: 16, rpm: 16, db: 0, conf: 0 });
        assert.equal(ring.decimation, 4);
        assert.deepEqual(Array.from(ring.series('t')), [0, 4, 8, 12, 16]);
        assert.ok(ring.length <= ring.limit);
    }],

    ['lowerBound finds the first sample at or after a time', () => {
        const ring = new TelemetryRing(COLUMNS, { maxSamples: 100 });
        for (let i = 0; i < 10; i++) {
            ring.push({ t: i * 100, rpm: 0, db: 0, conf: 0 });
        }
        assert.equal(ring.lowerBound('t', 0), 0);
        assert.equal(ring.lowerBound('t', 250), 3);
        assert.equal(ring.lowerBound('t', 900), 9);
        assert.equal(ring.lowerBound('t', 901), 10);
    }],

    ['integer columns clamp instead of wrapping', () => {
        const ring = new TelemetryRing([{ name: 't', type: 'u32' }, { name: 'v', type: 'u8' }], { maxSamples: 4 });
        ring.push({ t: -5, v: 900 });
        assert.deepEqual(ring.at(0), { t: 0, v: 254 });
    }],

    ['downsampling preserves every bucket\'s min and max', () => {
        const n = 1000;
        const t = Array.from({ length: n }, (_, i) => i);
        const v = t.map(() => 18000);
        v[437] = 17000; // a one-sample blip
        v[612] = 18400;
        const out = downsampleMinMax(t, v, 50);
        assert.ok(out.t.length <= 50);
        assert.ok(out.v.includes(17000), 'the blip survives');
        assert.ok(out.v.includes(18400), 'the peak survives');
        assert.equal(out.source, n);
        for (let i = 1; i < out.t.length; i++) {
            assert.ok(out.t[i] > out.t[i - 1], 'time order kept');
        }
    }],

    ['downsampling passes short series through and keeps NaN gaps visible', () => {
        const short = downsampleMinMax([1, 2, 3], [5, 6, 7], 10);
        assert.deepEqual(short.t, [1, 2, 3]);
        assert.deepEqual(short.v, [5, 6, 7]);
        const t = Array.from({ length: 100 }, (_, i) => i);
        const v = t.map((i) => (i >= 40 && i < 60 ? NaN : 1));
        const out = downsampleMinMax(t, v, 10);
        assert.ok(out.v.some((x) => Number.isNaN(x)), 'an all-NaN bucket keeps a NaN');
        assert.ok(out.v.filter((x) => !Number.isNaN(x)).every((x) => x === 1));
    }],
];
