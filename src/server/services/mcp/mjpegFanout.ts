// Pure parts of the live camera stream (cameraStream.ts does the I/O):
//   - JpegFrameSplitter: cut complete JPEG frames out of an ffmpeg
//     `-f mjpeg pipe:1` byte stream by walking the marker segments (an EOI
//     byte pair can legitimately appear inside an embedded EXIF thumbnail,
//     so a naive FFD9 search is not enough).
//   - FrameHub: ONE latest frame, fanned out to N stream clients with a
//     per-client rate cap and socket backpressure (a slow client skips
//     frames, it never queues them), a client cap, a stale judgement, and
//     `awaitFrame` for MCP tools that want the next fresh frame.
//   - mjpegPart / backoffMs / resolveStreamEnabled / clampFps helpers.
// No server imports on purpose: tests/mjpegFanout.test.ts runs these alone.

export const MJPEG_BOUNDARY = 'luban-mcp-frame';

export const DEFAULT_STREAM_FPS = 5;
export const MIN_STREAM_FPS = 1;
export const MAX_STREAM_FPS = 15;
export const DEFAULT_MAX_CLIENTS = 4;
export const MAX_MAX_CLIENTS = 16;

const SOI = 0xD8;
const EOI = 0xD9;
const SOS = 0xDA;

type Scan =
    | { kind: 'incomplete'; start: number }
    | { kind: 'corrupt'; start: number }
    | { kind: 'frame'; start: number; end: number };

function findSoi(buf: Buffer, from: number): number {
    for (let i = from; i + 2 < buf.length; i++) {
        if (buf[i] === 0xFF && buf[i + 1] === SOI && buf[i + 2] === 0xFF) {
            return i;
        }
    }
    return -1;
}

/** Walk one JPEG from `start` (an SOI); report its end, or that more bytes are needed. */
function scanJpeg(buf: Buffer, start: number): Scan {
    let pos = start + 2;
    for (;;) {
        if (pos + 1 >= buf.length) {
            return { kind: 'incomplete', start };
        }
        if (buf[pos] !== 0xFF) {
            return { kind: 'corrupt', start };
        }
        // 0xFF fill bytes before a marker are legal.
        while (buf[pos + 1] === 0xFF) {
            pos += 1;
            if (pos + 1 >= buf.length) {
                return { kind: 'incomplete', start };
            }
        }
        const marker = buf[pos + 1];
        if (marker === SOI) {
            return { kind: 'corrupt', start };
        }
        if (marker === EOI) {
            return { kind: 'frame', start, end: pos + 2 };
        }
        if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
            pos += 2; // standalone marker, no length
            continue;
        }
        if (pos + 3 >= buf.length) {
            return { kind: 'incomplete', start };
        }
        const segLen = buf.readUInt16BE(pos + 2);
        if (segLen < 2) {
            return { kind: 'corrupt', start };
        }
        pos += 2 + segLen;
        if (marker !== SOS) {
            continue;
        }
        // Entropy-coded data: 0xFF is always followed by 0x00 (stuffing) or
        // an RSTn marker; anything else is the next real marker.
        let found = false;
        for (let i = pos; i + 1 < buf.length; i++) {
            if (buf[i] !== 0xFF) {
                continue;
            }
            const m = buf[i + 1];
            if (m === 0x00 || m === 0xFF || (m >= 0xD0 && m <= 0xD7)) {
                continue;
            }
            if (m === EOI) {
                return { kind: 'frame', start, end: i + 2 };
            }
            pos = i; // e.g. a DHT between progressive scans
            found = true;
            break;
        }
        if (!found) {
            return { kind: 'incomplete', start };
        }
    }
}

export class JpegFrameSplitter {
    private buffer: Buffer = Buffer.alloc(0);

    private readonly maxFrameBytes: number;

    /** Bytes thrown away as garbage between frames or as an over-size/corrupt frame. */
    public discarded = 0;

    public constructor(maxFrameBytes = 8 * 1024 * 1024) {
        this.maxFrameBytes = maxFrameBytes;
    }

    public get pending(): number {
        return this.buffer.length;
    }

    /** Feed bytes; get every complete JPEG they finished, in order. */
    public push(chunk: Buffer): Buffer[] {
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        const frames: Buffer[] = [];
        let cursor = 0;
        for (;;) {
            const start = findSoi(this.buffer, cursor);
            if (start < 0) {
                // No frame start in view: keep only a possible partial SOI tail.
                const keep = Math.min(2, this.buffer.length - cursor);
                this.discarded += Math.max(0, this.buffer.length - cursor - keep);
                this.buffer = this.buffer.slice(this.buffer.length - keep);
                return frames;
            }
            this.discarded += start - cursor;
            const scan = scanJpeg(this.buffer, start);
            if (scan.kind === 'frame') {
                frames.push(this.buffer.slice(scan.start, scan.end));
                cursor = scan.end;
                continue;
            }
            if (scan.kind === 'corrupt' || this.buffer.length - start > this.maxFrameBytes) {
                // Skip this SOI and look for the next one.
                this.discarded += 2;
                cursor = start + 2;
                continue;
            }
            this.buffer = this.buffer.slice(start);
            return frames;
        }
    }

    public reset(): void {
        this.buffer = Buffer.alloc(0);
    }
}

export interface LiveFrame {
    jpg: Buffer;
    /** Wall-clock time the frame left the capture process. */
    capturedAt: number;
    seq: number;
}

/** What a stream client looks like to the hub: a socket-ish sink. `write` false = backpressured. */
export interface FrameSink {
    write(chunk: Buffer): boolean;
}

interface ClientState {
    sink: FrameSink;
    lastSentAt: number;
    blocked: boolean;
    sent: number;
    skipped: number;
}

export interface FrameHubOptions {
    maxClients?: number;
    /** Per-client floor between frames (the fps cap seen by a browser). */
    minIntervalMs?: number;
    /** Latest frame older than this is reported stale. */
    staleAfterMs?: number;
    now?: () => number;
}

export interface FrameHubStats {
    published: number;
    sent: number;
    skippedBackpressure: number;
    skippedRate: number;
}

/** One multipart/x-mixed-replace part carrying a JPEG. */
export function mjpegPart(frame: LiveFrame, boundary = MJPEG_BOUNDARY): Buffer {
    const head = `--${boundary}\r\n`
        + 'Content-Type: image/jpeg\r\n'
        + `Content-Length: ${frame.jpg.length}\r\n`
        + `X-Frame-Seq: ${frame.seq}\r\n`
        + `X-Frame-Captured-At: ${frame.capturedAt}\r\n\r\n`;
    return Buffer.concat([Buffer.from(head, 'ascii'), frame.jpg, Buffer.from('\r\n', 'ascii')]);
}

export class FrameHub {
    private clients = new Map<number, ClientState>();

    private nextClientId = 1;

    private seq = 0;

    private waiters: Array<{ resolve: (frame: LiveFrame) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> | null }> = [];

    private readonly maxClients: number;

    private readonly minIntervalMs: number;

    private readonly staleAfterMs: number;

    private readonly now: () => number;

    public latest: LiveFrame | null = null;

    public stats: FrameHubStats = { published: 0, sent: 0, skippedBackpressure: 0, skippedRate: 0 };

    public constructor(options: FrameHubOptions = {}) {
        this.maxClients = options.maxClients || DEFAULT_MAX_CLIENTS;
        this.minIntervalMs = options.minIntervalMs || 0;
        this.staleAfterMs = options.staleAfterMs || 3000;
        this.now = options.now || Date.now;
    }

    public get clientCount(): number {
        return this.clients.size;
    }

    public hasClients(): boolean {
        return this.clients.size > 0;
    }

    public isFull(): boolean {
        return this.clients.size >= this.maxClients;
    }

    /** null when the client cap is reached. The latest frame (if any) is sent at once. */
    public subscribe(sink: FrameSink): { id: number; unsubscribe: () => void } | null {
        if (this.clients.size >= this.maxClients) {
            return null;
        }
        const id = this.nextClientId++;
        const client: ClientState = { sink, lastSentAt: -Infinity, blocked: false, sent: 0, skipped: 0 };
        this.clients.set(id, client);
        if (this.latest) {
            this.send(client, this.latest);
        }
        return { id, unsubscribe: () => this.unsubscribe(id) };
    }

    public unsubscribe(id: number): void {
        this.clients.delete(id);
    }

    /** The client's socket drained: it may receive frames again. */
    public markDrained(id: number): void {
        const client = this.clients.get(id);
        if (client) {
            client.blocked = false;
        }
    }

    private send(client: ClientState, frame: LiveFrame): void {
        const ok = client.sink.write(mjpegPart(frame));
        client.lastSentAt = this.now();
        client.sent += 1;
        this.stats.sent += 1;
        if (!ok) {
            client.blocked = true;
        }
    }

    /** New frame from the capture loop: remember it, fan it out, wake waiters. */
    public publish(jpg: Buffer, capturedAt: number = this.now()): LiveFrame {
        this.seq += 1;
        const frame: LiveFrame = { jpg, capturedAt, seq: this.seq };
        this.latest = frame;
        this.stats.published += 1;
        const now = this.now();
        for (const client of this.clients.values()) {
            if (client.blocked) {
                client.skipped += 1;
                this.stats.skippedBackpressure += 1;
                continue;
            }
            if (now - client.lastSentAt < this.minIntervalMs) {
                client.skipped += 1;
                this.stats.skippedRate += 1;
                continue;
            }
            this.send(client, frame);
        }
        const waiters = this.waiters;
        this.waiters = [];
        for (const waiter of waiters) {
            if (waiter.timer) {
                clearTimeout(waiter.timer);
            }
            waiter.resolve(frame);
        }
        return frame;
    }

    public ageMs(): number | null {
        return this.latest ? this.now() - this.latest.capturedAt : null;
    }

    public isStale(): boolean {
        const age = this.ageMs();
        return age === null || age > this.staleAfterMs;
    }

    /**
     * The latest frame if it is at most `maxAgeMs` old, else the NEXT
     * published frame, or a rejection after `timeoutMs`. MCP captures after a
     * move use this so the frame post-dates the settle, not just the call.
     */
    public async awaitFrame(maxAgeMs: number, timeoutMs: number): Promise<LiveFrame> {
        const age = this.ageMs();
        if (this.latest && age !== null && age <= maxAgeMs) {
            return this.latest;
        }
        return new Promise((resolve, reject) => {
            const waiter = {
                resolve,
                reject,
                timer: null as ReturnType<typeof setTimeout> | null,
            };
            if (timeoutMs > 0) {
                waiter.timer = setTimeout(() => {
                    this.waiters = this.waiters.filter((w) => w !== waiter);
                    reject(new Error(`No fresh frame from the live camera stream within ${timeoutMs} ms.`));
                }, timeoutMs);
            }
            this.waiters.push(waiter);
        });
    }

    /** Fail every pending awaitFrame (the loop died with no clients, or the service stopped). */
    public rejectWaiters(reason: string): void {
        const waiters = this.waiters;
        this.waiters = [];
        for (const waiter of waiters) {
            if (waiter.timer) {
                clearTimeout(waiter.timer);
            }
            waiter.reject(new Error(reason));
        }
    }

    public get pendingWaiters(): number {
        return this.waiters.length;
    }
}

/** Restart delay after the capture process dies: 1, 2, 4 ... capped at 30 s. */
export function backoffMs(attempt: number, capMs = 30000): number {
    const n = Math.max(0, Math.min(30, Math.floor(attempt)));
    return Math.min(capMs, 1000 * (2 ** n));
}

export function clampFps(raw: unknown, fallback = DEFAULT_STREAM_FPS): number {
    const n = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(MAX_STREAM_FPS, Math.max(MIN_STREAM_FPS, Math.round(n)));
}

export function clampMaxClients(raw: unknown, fallback = DEFAULT_MAX_CLIENTS): number {
    const n = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(MAX_MAX_CLIENTS, Math.max(1, Math.round(n)));
}

/**
 * Whether the stream is on. Env wins, then the stored switch, then the
 * default: on only when a camera is already configured (URL, pinned device
 * or a remembered last-good device) - a bare install gets no listener.
 */
export function resolveStreamEnabled(input: {
    env?: string | undefined;
    stored?: unknown;
    cameraConfigured: boolean;
}): { enabled: boolean; source: 'env' | 'config' | 'default' } {
    const env = input.env !== undefined ? String(input.env).trim() : '';
    if (env !== '') {
        return { enabled: !['0', 'false', 'no', 'off'].includes(env.toLowerCase()), source: 'env' };
    }
    if (input.stored !== undefined && input.stored !== null && input.stored !== '') {
        const off = input.stored === false || ['0', 'false', 'no', 'off'].includes(String(input.stored).trim().toLowerCase());
        return { enabled: !off, source: 'config' };
    }
    return { enabled: input.cameraConfigured, source: 'default' };
}
