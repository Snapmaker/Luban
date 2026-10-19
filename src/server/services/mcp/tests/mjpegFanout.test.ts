import { strict as assert } from 'assert';

import {
    FrameHub,
    JpegFrameSplitter,
    MJPEG_BOUNDARY,
    backoffMs,
    clampFps,
    clampMaxClients,
    mjpegPart,
    resolveStreamEnabled,
} from '../mjpegFanout';

/**
 * A minimal but structurally valid JPEG: SOI, an APP0 segment, a DQT, an
 * SOS with entropy data containing stuffed 0xFF00 and an RST marker, then
 * EOI. `payload` distinguishes frames; `thumbnail` embeds a whole inner
 * JPEG (SOI..EOI) inside APP1, as EXIF does.
 */
function jpeg(payload: number, thumbnail = false): Buffer {
    const parts: Buffer[] = [Buffer.from([0xFF, 0xD8])];
    if (thumbnail) {
        const inner = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9])]);
        const len = inner.length + 2;
        parts.push(Buffer.from([0xFF, 0xE1, len >> 8, len & 0xFF]), inner);
    }
    parts.push(Buffer.from([0xFF, 0xE0, 0x00, 0x04, 0x4A, 0x46])); // APP0, 4 bytes
    parts.push(Buffer.from([0xFF, 0xDB, 0x00, 0x03, payload & 0xFF])); // DQT, 3 bytes
    parts.push(Buffer.from([0xFF, 0xDA, 0x00, 0x02])); // SOS, empty header
    parts.push(Buffer.from([0x01, 0xFF, 0x00, 0x02, 0xFF, 0xD0, 0x03, payload & 0xFF])); // entropy data: stuffing + RST0
    parts.push(Buffer.from([0xFF, 0xD9]));
    return Buffer.concat(parts);
}

class Sink {
    public chunks: Buffer[] = [];

    public ok = true;

    public write(chunk: Buffer): boolean {
        this.chunks.push(chunk);
        return this.ok;
    }
}

export const tests: Array<[string, () => void]> = [
    ['splitter: two frames in one chunk come out whole and in order', () => {
        const s = new JpegFrameSplitter();
        const a = jpeg(1);
        const b = jpeg(2);
        const frames = s.push(Buffer.concat([a, b]));
        assert.equal(frames.length, 2);
        assert.ok(frames[0].equals(a));
        assert.ok(frames[1].equals(b));
        assert.equal(s.pending, 0);
        assert.equal(s.discarded, 0);
    }],

    ['splitter: a frame split byte by byte is reassembled exactly once', () => {
        const s = new JpegFrameSplitter();
        const a = jpeg(7);
        const out: Buffer[] = [];
        for (const byte of a) {
            out.push(...s.push(Buffer.from([byte])));
        }
        assert.equal(out.length, 1);
        assert.ok(out[0].equals(a));
    }],

    ['splitter: stuffed 0xFF00, RST markers and an EXIF thumbnail with its own EOI do not end the frame early', () => {
        const s = new JpegFrameSplitter();
        const a = jpeg(3, true);
        const frames = s.push(a);
        assert.equal(frames.length, 1);
        assert.equal(frames[0].length, a.length, 'the inner thumbnail EOI must not terminate the outer frame');
    }],

    ['splitter: garbage before the first SOI is discarded and counted; a partial tail is kept', () => {
        const s = new JpegFrameSplitter();
        const a = jpeg(4);
        const junk = Buffer.from('ffmpeg noise', 'ascii');
        const half = Math.floor(a.length / 2);
        let frames = s.push(Buffer.concat([junk, a.slice(0, half)]));
        assert.equal(frames.length, 0);
        assert.equal(s.discarded, junk.length);
        frames = s.push(a.slice(half));
        assert.equal(frames.length, 1);
        assert.ok(frames[0].equals(a));
    }],

    ['splitter: a corrupt frame (segment without a marker) is skipped and the next frame still decodes', () => {
        const s = new JpegFrameSplitter();
        const bad = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00, 0x12, 0x34, 0x56]); // length points at non-FF
        const good = jpeg(5);
        const frames = s.push(Buffer.concat([bad, good]));
        assert.equal(frames.length, 1);
        assert.ok(frames[0].equals(good));
        assert.ok(s.discarded > 0);
    }],

    ['mjpegPart: boundary, content headers, exact length and trailing CRLF', () => {
        const jpg = jpeg(9);
        const part = mjpegPart({ jpg, capturedAt: 1234, seq: 3 });
        const text = part.toString('latin1');
        assert.ok(text.startsWith(`--${MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n`));
        assert.ok(text.includes('X-Frame-Seq: 3\r\nX-Frame-Captured-At: 1234\r\n\r\n'));
        assert.ok(part.slice(part.length - 2 - jpg.length, part.length - 2).equals(jpg));
        assert.equal(text.slice(-2), '\r\n');
    }],

    ['hub: publish fans out to every client; a late subscriber gets the latest frame at once', () => {
        let now = 1000;
        const hub = new FrameHub({ now: () => now });
        const a = new Sink();
        const b = new Sink();
        const subA = hub.subscribe(a);
        assert.ok(subA);
        assert.equal(a.chunks.length, 0, 'nothing to send before the first frame');
        hub.publish(jpeg(1), now);
        now += 200;
        const subB = hub.subscribe(b);
        assert.ok(subB);
        assert.equal(a.chunks.length, 1);
        assert.equal(b.chunks.length, 1, 'late subscriber receives the latest frame immediately');
        hub.publish(jpeg(2), now);
        assert.equal(a.chunks.length, 2);
        assert.equal(b.chunks.length, 2);
        assert.equal(hub.clientCount, 2);
        subA && subA.unsubscribe();
        hub.publish(jpeg(3), now);
        assert.equal(a.chunks.length, 2, 'unsubscribed client receives nothing more');
        assert.equal(b.chunks.length, 3);
        assert.equal(hub.stats.published, 3);
        assert.equal(hub.stats.sent, 5);
    }],

    ['hub: the client cap refuses the extra viewer and frees the slot on unsubscribe', () => {
        const hub = new FrameHub({ maxClients: 2 });
        const s1 = hub.subscribe(new Sink());
        const s2 = hub.subscribe(new Sink());
        assert.ok(s1 && s2);
        assert.equal(hub.isFull(), true);
        assert.equal(hub.subscribe(new Sink()), null);
        s1 && s1.unsubscribe();
        assert.equal(hub.isFull(), false);
        assert.ok(hub.subscribe(new Sink()));
    }],

    ['hub: a backpressured client skips frames instead of queueing them, until drained', () => {
        let now = 0;
        const hub = new FrameHub({ now: () => now });
        const slow = new Sink();
        const fast = new Sink();
        const sub = hub.subscribe(slow);
        hub.subscribe(fast);
        assert.ok(sub);
        slow.ok = false; // socket buffer full from now on
        hub.publish(jpeg(1), now);
        now += 200;
        hub.publish(jpeg(2), now);
        now += 200;
        hub.publish(jpeg(3), now);
        assert.equal(slow.chunks.length, 1, 'one write returned false; later frames are skipped');
        assert.equal(fast.chunks.length, 3);
        assert.equal(hub.stats.skippedBackpressure, 2);
        slow.ok = true;
        hub.markDrained(sub ? sub.id : -1);
        now += 200;
        hub.publish(jpeg(4), now);
        assert.equal(slow.chunks.length, 2);
    }],

    ['hub: the per-client rate cap drops frames that arrive faster than the interval', () => {
        let now = 0;
        const hub = new FrameHub({ minIntervalMs: 200, now: () => now });
        const sink = new Sink();
        hub.subscribe(sink);
        hub.publish(jpeg(1), now);
        now += 50;
        hub.publish(jpeg(2), now);
        now += 50;
        hub.publish(jpeg(3), now);
        now += 100; // 200 since the first send
        hub.publish(jpeg(4), now);
        assert.equal(sink.chunks.length, 2);
        assert.equal(hub.stats.skippedRate, 2);
        assert.equal(hub.latest && hub.latest.seq, 4, 'the hub always keeps the newest frame regardless of client pacing');
    }],

    ['hub: stale judgement follows the latest frame age', () => {
        let now = 0;
        const hub = new FrameHub({ staleAfterMs: 1000, now: () => now });
        assert.equal(hub.isStale(), true, 'no frame yet = stale');
        assert.equal(hub.ageMs(), null);
        hub.publish(jpeg(1), now);
        now = 900;
        assert.equal(hub.isStale(), false);
        assert.equal(hub.ageMs(), 900);
        now = 1001;
        assert.equal(hub.isStale(), true);
    }],

    ['hub: awaitFrame returns a fresh latest frame at once, otherwise the next published one', async () => {
        let now = 0;
        const hub = new FrameHub({ now: () => now });
        hub.publish(jpeg(1), now);
        now = 100;
        const fresh = await hub.awaitFrame(250, 1000);
        assert.equal(fresh.seq, 1, 'a 100 ms old frame within a 250 ms budget is served immediately');
        now = 2000;
        const pending = hub.awaitFrame(250, 1000);
        assert.equal(hub.pendingWaiters, 1, 'a 2 s old frame is not fresh enough: wait for the next');
        hub.publish(jpeg(2), now);
        const next = await pending;
        assert.equal(next.seq, 2);
        assert.equal(hub.pendingWaiters, 0);
    }],

    ['hub: awaitFrame times out and can be failed by rejectWaiters when the loop dies', async () => {
        let now = 0;
        const hub = new FrameHub({ now: () => now });
        await assert.rejects(hub.awaitFrame(0, 20), /No fresh frame/);
        const pending = hub.awaitFrame(0, 5000);
        hub.rejectWaiters('loop died');
        await assert.rejects(pending, /loop died/);
        assert.equal(hub.pendingWaiters, 0);
        now += 1;
    }],

    ['backoffMs doubles from 1 s and caps at 30 s', () => {
        assert.equal(backoffMs(0), 1000);
        assert.equal(backoffMs(1), 2000);
        assert.equal(backoffMs(4), 16000);
        assert.equal(backoffMs(5), 30000);
        assert.equal(backoffMs(40), 30000);
    }],

    ['clampFps / clampMaxClients: defaults, rounding and bounds', () => {
        assert.equal(clampFps(undefined), 5);
        assert.equal(clampFps(''), 5);
        assert.equal(clampFps('abc'), 5);
        assert.equal(clampFps(0), 1);
        assert.equal(clampFps(7.6), 8);
        assert.equal(clampFps(99), 15);
        assert.equal(clampMaxClients(null), 4);
        assert.equal(clampMaxClients(0), 1);
        assert.equal(clampMaxClients(100), 16);
    }],

    ['resolveStreamEnabled: env beats the stored switch, which beats the camera-configured default', () => {
        assert.deepEqual(resolveStreamEnabled({ env: '0', stored: true, cameraConfigured: true }), { enabled: false, source: 'env' });
        assert.deepEqual(resolveStreamEnabled({ env: 'yes', stored: false, cameraConfigured: false }), { enabled: true, source: 'env' });
        assert.deepEqual(resolveStreamEnabled({ env: '', stored: false, cameraConfigured: true }), { enabled: false, source: 'config' });
        assert.deepEqual(resolveStreamEnabled({ stored: 'off', cameraConfigured: true }), { enabled: false, source: 'config' });
        assert.deepEqual(resolveStreamEnabled({ stored: true, cameraConfigured: false }), { enabled: true, source: 'config' });
        assert.deepEqual(resolveStreamEnabled({ cameraConfigured: true }), { enabled: true, source: 'default' });
        assert.deepEqual(resolveStreamEnabled({ cameraConfigured: false }), { enabled: false, source: 'default' });
    }],
];
