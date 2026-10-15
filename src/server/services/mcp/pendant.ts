// USB wire protocol and bounded operator jogging. No server or serial imports.
export interface PendantInput {
    v: 1;
    seq: number;
    x: number;
    y: number;
    z: number;
    feed: number;
    mode: 'feed' | 'z';
    deadman: boolean;
    stop: boolean;
    ready: boolean;
    feedback_ok?: boolean; // eslint-disable-line camelcase -- USB protocol key
    round_trip_ms?: number | null; // eslint-disable-line camelcase -- USB protocol key
}

export interface JogBounds {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
}

export interface JogPosition { x: number; y: number; z: number }

export function parsePendantInput(line: string): PendantInput {
    if (line.length > 512) { throw new Error('USB frame too long.'); }
    const p = JSON.parse(line) as PendantInput;
    if (!p || p.v !== 1 || !Number.isSafeInteger(p.seq) || p.seq < 0
        || ![p.x, p.y, p.z].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1)
        || typeof p.feed !== 'number' || !Number.isFinite(p.feed) || p.feed < 300 || p.feed > 3000
        || !['feed', 'z'].includes(p.mode) || typeof p.deadman !== 'boolean' || typeof p.stop !== 'boolean'
        || typeof p.ready !== 'boolean'
        || (p.feedback_ok !== undefined && typeof p.feedback_ok !== 'boolean')
        || (p.round_trip_ms != null && (!Number.isFinite(p.round_trip_ms) || p.round_trip_ms < 0))
        || (p.mode === 'feed' && p.z !== 0)) {
        throw new Error('Invalid USB pendant frame.');
    }
    return p;
}

export function validateJogBounds(bounds: JogBounds, current: JogPosition): void {
    if (!bounds || typeof bounds !== 'object') { throw new Error('Machine XYZ bounds are required.'); }
    for (const axis of ['x', 'y', 'z'] as const) {
        const lo = bounds[`${axis}Min`];
        const hi = bounds[`${axis}Max`];
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo
            || current[axis] < lo || current[axis] > hi) {
            throw new Error(`Invalid machine ${axis.toUpperCase()} envelope ${lo}..${hi}; must be finite, ordered and contain current position ${current[axis]}.`);
        }
    }
}

export class PendantSession {
    public armed = false;

    public neutral = false;

    public latest: PendantInput | null = null;

    public receivedAt = 0;

    public expiresAt = 0;

    public bounds: JogBounds | null = null;

    private sequence = -1;

    public maxSegmentMs = 500;

    public limitedAxes: string[] = [];

    private intent: PendantInput | null = null;

    private changedAt = 0;

    public get inputSequence(): number { return this.sequence; }

    public arm(bounds: JogBounds, current: JogPosition, now: number, maxSegmentMs = 500): void {
        validateJogBounds(bounds, current);
        if (!Number.isFinite(maxSegmentMs) || maxSegmentMs < 500 || maxSegmentMs > 1000) {
            throw new Error('Jog duration limit must be 500–1000 ms.');
        }
        this.maxSegmentMs = maxSegmentMs;
        this.intent = null;
        this.changedAt = now;
        this.limitedAxes = [];
        this.bounds = { ...bounds };
        this.armed = true;
        this.neutral = false;
        this.latest = null;
        this.expiresAt = now + 10 * 60 * 1000;
    }

    public disarm(): void {
        this.armed = false;
        this.neutral = false;
        this.latest = null;
    }

    public reset(): void {
        this.disarm();
        this.sequence = -1;
        this.receivedAt = 0;
        this.bounds = null;
        this.expiresAt = 0;
    }

    public receive(input: PendantInput, now: number): void {
        if (input.seq <= this.sequence) {
            // A firmware reset restarts seq. Drop authority before accepting the new baseline.
            this.disarm();
            this.sequence = input.seq;
            this.receivedAt = 0;
            throw new Error('USB sequence restarted or repeated. Centre axes and re-arm.');
        }
        this.sequence = input.seq;
        const previous = this.intent;
        if (!previous || (['x', 'y', 'z'] as const).some((axis) => Math.abs(input[axis] - previous[axis]) > 0.05)
            || Math.abs(input.feed - previous.feed) > Math.max(10, previous.feed * 0.05)
            || input.deadman !== previous.deadman || input.mode !== previous.mode || input.ready !== previous.ready) {
            this.intent = input;
            this.changedAt = now;
        }
        this.latest = input;
        this.receivedAt = now;
        if (input.stop) { this.disarm(); return; }
        if (input.ready && !input.deadman && input.x === 0 && input.y === 0 && input.z === 0) {
            this.neutral = true;
            this.limitedAxes = [];
        }
    }

    public target(current: JogPosition, now: number, overheadMs = 0): { position: JogPosition; feed: number; durationMs: number; distanceMm: number } | null {
        if (!this.armed) { return null; }
        if (now >= this.expiresAt || now - this.receivedAt > 900) {
            this.disarm();
            return null;
        }
        // A short USB scheduling gap pauses new motion; only a sustained loss
        // revokes the arm. Never issue a new segment on old analog intent.
        if (now - this.receivedAt > 300) { return null; }
        const p = this.latest;
        if (!this.neutral || !p || !p.ready || !p.deadman || !this.bounds || p.feedback_ok === false) { return null; }
        const magnitude = Math.hypot(p.x, p.y, p.z);
        if (magnitude < 0.01) { return null; }
        // Changing intent gets a short segment. Stable intent ramps to the
        // operator's time limit, never over one second. No queued trajectory.
        // Reserve measured controller/transport overhead plus 100 ms, so the
        // whole request aims to finish inside a second, not just its G1 travel.
        const ceilingMs = Math.min(this.maxSegmentMs, Math.max(50, 900 - Math.max(0, overheadMs)));
        const durationMs = Math.min(ceilingMs, 100 + Math.max(0, now - this.changedAt - 100) * 0.8);
        const feed = Math.max(1, Math.round(p.feed * Math.min(1, magnitude)));
        const distance = feed * durationMs / 60000;
        const position = {
            x: current.x + p.x / magnitude * distance,
            y: current.y + p.y / magnitude * distance,
            z: current.z + p.z / magnitude * distance,
        };
        this.limitedAxes = [];
        for (const axis of ['x', 'y', 'z'] as const) {
            const clipped = Math.max(this.bounds[`${axis}Min`], Math.min(this.bounds[`${axis}Max`], position[axis]));
            if (clipped !== position[axis]) { this.limitedAxes.push(axis.toUpperCase()); }
            position[axis] = clipped;
        }
        const distanceMm = Math.hypot(position.x - current.x, position.y - current.y, position.z - current.z);
        if (distanceMm < 0.001) { return null; }
        return { position, feed, durationMs: distanceMm / feed * 60000, distanceMm };
    }
}
