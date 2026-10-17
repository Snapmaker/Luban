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
    fw?: string; // Firmware build identifier, logged on connect and change.
    log?: string; // Rare firmware event (link change, short write), logged only when tracing.
}

export const PENDANT_FEED_MIN = 60;
export const PENDANT_FEED_MAX = 3000;
export const PENDANT_Z_FEED_MAX = 1000;

export interface JogBounds {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
}

export interface JogPosition { x: number; y: number; z: number }

// The reason names the first failing field so a firmware/host mismatch is diagnosable from the log.
export function pendantFrameProblem(p: PendantInput): string | null {
    if (!p || typeof p !== 'object') { return 'not an object'; }
    if (p.v !== 1) { return `protocol v ${JSON.stringify(p.v)}`; }
    // Live values (seq, axes, timings) stay out of the reason so a bad stream logs one line, not 20/s.
    if (!Number.isSafeInteger(p.seq) || p.seq < 0) { return 'seq'; }
    for (const axis of ['x', 'y', 'z'] as const) {
        const n = p[axis];
        if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1) { return `${axis} not a number in -1..1`; }
    }
    if (typeof p.feed !== 'number' || !Number.isFinite(p.feed) || p.feed < PENDANT_FEED_MIN || p.feed > PENDANT_FEED_MAX) {
        return `feed ${JSON.stringify(p.feed)} outside ${PENDANT_FEED_MIN}–${PENDANT_FEED_MAX} mm/min (update the Feather firmware?)`;
    }
    if (!['feed', 'z'].includes(p.mode)) { return `mode ${JSON.stringify(p.mode)}`; }
    if (p.mode === 'z' && p.feed > PENDANT_Z_FEED_MAX) {
        return `feed ${p.feed} above the Z-mode limit ${PENDANT_Z_FEED_MAX} mm/min (update the Feather firmware?)`;
    }
    for (const key of ['deadman', 'stop', 'ready'] as const) {
        if (typeof p[key] !== 'boolean') { return `${key} not boolean`; }
    }
    if (p.feedback_ok !== undefined && typeof p.feedback_ok !== 'boolean') { return 'feedback_ok not boolean'; }
    if (p.round_trip_ms != null && (!Number.isFinite(p.round_trip_ms) || p.round_trip_ms < 0)) {
        return 'round_trip_ms';
    }
    if (p.mode === 'feed' && p.z !== 0) { return 'nonzero z in feed mode'; }
    if (p.fw !== undefined && (typeof p.fw !== 'string' || p.fw.length > 32)) { return 'fw'; }
    if (p.log !== undefined && (typeof p.log !== 'string' || p.log.length > 160)) { return 'log'; }
    return null;
}

export function parsePendantInput(line: string): PendantInput {
    if (line.length > 512) { throw new Error('USB frame too long.'); }
    let p: PendantInput;
    try { p = JSON.parse(line) as PendantInput; } catch (err) { throw new Error('Invalid USB pendant frame: not JSON.'); }
    const problem = pendantFrameProblem(p);
    if (problem) { throw new Error(`Invalid USB pendant frame: ${problem}.`); }
    return p;
}

// Same value as envelopeChecks POSITION_EPSILON_MM; kept local so this module stays import-free.
const EDGE_TOLERANCE_MM = 0.05;

export function validateJogBounds(bounds: JogBounds, current: JogPosition): void {
    if (!bounds || typeof bounds !== 'object') { throw new Error('Machine XYZ bounds are required.'); }
    for (const axis of ['x', 'y', 'z'] as const) {
        const lo = bounds[`${axis}Min`];
        const hi = bounds[`${axis}Max`];
        // Heartbeat noise at a travel edge (e.g. Y -0.000005 with travel clipped to Y0)
        // must not refuse the arm.
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo
            || current[axis] < lo - EDGE_TOLERANCE_MM || current[axis] > hi + EDGE_TOLERANCE_MM) {
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

    /**
     * The next segment from `current`. `segmentCapMs`, when given, replaces the
     * overhead-compensated ceiling: pipelined jogging (pendantRuntime) has no
     * per-segment stop to compensate and bounds its whole queue instead. The
     * operator's maxSegmentMs still caps every segment either way.
     */
    public target(current: JogPosition, now: number, overheadMs = 0, segmentCapMs?: number)
        : { position: JogPosition; feed: number; durationMs: number; distanceMm: number } | null {
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
        const ceilingMs = segmentCapMs !== undefined ? Math.min(this.maxSegmentMs, Math.max(50, segmentCapMs))
            : Math.min(this.maxSegmentMs, Math.max(50, 900 - Math.max(0, overheadMs)));
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
            let clipped = Math.max(this.bounds[`${axis}Min`], Math.min(this.bounds[`${axis}Max`], position[axis]));
            // A head already outside the bounds (heartbeat noise, or a DRO correction after
            // overtravel) is never pulled by the clamp: unrequested or opposite moves hold.
            if (clipped !== current[axis] && Math.sign(clipped - current[axis]) !== Math.sign(position[axis] - current[axis])) {
                clipped = current[axis];
            }
            if (clipped !== position[axis]) { this.limitedAxes.push(axis.toUpperCase()); }
            position[axis] = clipped;
        }
        const distanceMm = Math.hypot(position.x - current.x, position.y - current.y, position.z - current.z);
        if (distanceMm < 0.001) { return null; }
        return { position, feed, durationMs: distanceMm / feed * 60000, distanceMm };
    }
}

/**
 * Pipelined jogging assumes the controller runs X/Y at the commanded feed with
 * at least `minAccel` acceleration. Judge the firmware's own `M503 S` report
 * (Marlin `M203` max feed mm/s, `M201` max acceleration, `M204` P/T
 * acceleration) against that. null when every value is present and
 * sufficient; otherwise the reason pipelining must stay off. Pure.
 */
export function firmwareMotionProblem(m503: string, maxFeedMmMin: number, minAccel: number): string | null {
    const num = (re: RegExp): number[] | null => {
        const m = m503.match(re);
        return m ? m.slice(1).map(Number) : null;
    };
    const feeds = num(/M203\s+X(-?[\d.]+)\s+Y(-?[\d.]+)/);
    const maxAccel = num(/M201\s+X(-?[\d.]+)\s+Y(-?[\d.]+)/);
    const accel = num(/M204\s+P(-?[\d.]+)(?:\s+R-?[\d.]+)?\s+T(-?[\d.]+)/);
    if (!feeds || !maxAccel || !accel || [...feeds, ...maxAccel, ...accel].some((v) => !Number.isFinite(v))) {
        return 'M503 S did not report M203 X/Y, M201 X/Y and M204 P/T, so the controller\'s motion limits are unknown.';
    }
    const needFeed = maxFeedMmMin / 60;
    if (Math.min(...feeds) < needFeed) {
        return `Controller max feed X/Y ${feeds.join('/')} mm/s is below the pendant's ${needFeed} mm/s (M203).`;
    }
    if (Math.min(...maxAccel, ...accel) < minAccel) {
        return `Controller acceleration (M201 X/Y ${maxAccel.join('/')}, M204 P/T ${accel.join('/')} mm/s²) is below the model's ${minAccel} mm/s².`;
    }
    return null;
}
