// Continuous X/Y hold for the USB pendant (LUBAN_PENDANT_PIPELINE=1): the pure
// parts. One G53 at D1 press, clock-paced G1 increments while the stick is
// held, one G54 at release or at any stop. No server imports, so every piece
// here is unit-tested without a machine (tests/pendantHold.test.ts).
//
// Why there are no "runs" any more (operator, hardware, 2026-10-05): the
// earlier pipeline queued about a second of G1 segments up front, closed the
// run with a G54 that drained the planner (~550 ms), then waited up to 2 s for
// a verified beat before the next run. The result was a second of motion, a
// 0.5-2 s stop, repeat, and ~0.5 s of queued motion after D1 was released. The
// run concept itself was the cause, so it is gone: the hold is one G53 window
// paced by the clock, and the only G54 is the one that closes it.
//
// Hardware facts this module is built on (measured by the operator): G53 does
// not wait for motion; a G1 is acknowledged in 38-69 ms while the move itself
// takes ~175 ms (the controller replies once the move is queued); the status
// report carries the planner's queued position, not the stepper position;
// `M503 S` and `M220 S100` work over HTTP.
import { JogPosition } from './pendant';

/** The pacing clock: one decision (and at most one new increment) this often. */
export const HOLD_TICK_MS = 100;
/** Each increment is worth this much travel at the current feed. */
export const HOLD_MOVE_MS = 100;
/**
 * At most this much commanded motion is queued ahead of the clock model's
 * executed position. After any stop at most this much runs out (plus up to
 * half a round trip: the model starts each increment at its send time, the
 * controller receives it ~RTT/2 later).
 */
export const HOLD_QUEUE_AHEAD_MS = 200;
/** A Feather report older than this stops the hold (the Feather sends every 50 ms). */
export const HOLD_FEATHER_GAP_MS = 150;
/** `M114` (Count) is polled this often during a hold. */
export const HOLD_COUNT_POLL_MS = 250;
/** A G1 reply slower than this means the controller is holding the request (planner full): stop. */
export const HOLD_REPLY_LATE_MS = HOLD_QUEUE_AHEAD_MS;
/**
 * A status report older than this during a hold means the connection is
 * faltering: stop. The WiFi poll runs every 2 s with a 3 s timeout, so one
 * late poll must not flip a hold into a settled burst and back; two missed
 * periods (plus jitter) is the connection symptom this guards.
 */
export const HOLD_HEARTBEAT_MAX_AGE_MS = 4500;
/**
 * A late reply (a G1 acknowledged after HOLD_REPLY_LATE_MS, or in enforced
 * mode an M114 slower than one tick) stops the hold it happens in. Only this
 * many consecutive late events within one arm turn continuous jogging off
 * until re-arm; a hold that ends for any other reason resets the count.
 */
export const HOLD_LATE_EVENTS_TO_DISABLE = 3;
/**
 * Arm-time firmware check (M503 S): the clock model charges each increment
 * its commanded time only. Below this acceleration a 100 ms increment at the
 * pendant's maximum feed (50 mm/s) would spend more than its whole commanded
 * time accelerating, and the model would be meaningless. The Count check
 * measures whatever error remains above it.
 */
export const HOLD_MIN_ACCEL = 500;
/**
 * Steps per mm used to turn M114 `Count` steps into millimetres when `M503 S`
 * does not report `M92`. The A350's X/Y/Z default (8 mm lead, 200 steps x 16
 * microsteps).
 */
export const A350_STEPS_PER_MM: JogPosition = { x: 400, y: 400, z: 400 };

/**
 * What the M114 Count check may do. 'observe' (the default) traces every
 * sample and never gates; 'enforced' stops the hold when the Count-derived
 * position is more than one increment from the expected executed position or
 * when the M114 reply is late. The operator flips it with
 * LUBAN_PENDANT_COUNT_CHECK=enforced once hardware has shown that Count keeps
 * up and that M114 answers promptly during motion.
 */
export type CountCheckMode = 'enforced' | 'observe';

export function countCheckMode(raw: string | undefined | null): CountCheckMode {
    return /^enforced$/i.test(String(raw || '').trim()) ? 'enforced' : 'observe';
}

/**
 * The G1 for one queued machine-frame increment. The hold omits the Z word
 * (Marlin keeps the current Z for `G1 X Y`): the hold's Z is the heartbeat-
 * derived record Z, and a wrong reused offset must make the close's M114
 * proof fail rather than move Z by the error at stick feed.
 */
export function queuedMoveGcode(target: JogPosition, feed: number, omitZ: boolean): string {
    const words = `X${target.x.toFixed(3)} Y${target.y.toFixed(3)}${omitZ ? '' : ` Z${target.z.toFixed(3)}`}`;
    return `G1 ${words} F${feed};`;
}

/** Distance a queue of HOLD_QUEUE_AHEAD_MS runs out at `feed` mm/min. */
export function holdRunoutMm(feed: number): number {
    return feed * HOLD_QUEUE_AHEAD_MS / 60000;
}

/** Distance of one increment at `feed` mm/min. */
export function holdMoveMm(feed: number): number {
    return feed * HOLD_MOVE_MS / 60000;
}

/** `to` pushed `extraMm` further along the direction from `from`; `to` itself when they coincide. */
export function extendAlong(from: JogPosition, to: JogPosition, extraMm: number): JogPosition {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (!(len > 0) || !(extraMm > 0)) { return { ...to }; }
    const k = extraMm / len;
    return { x: to.x + dx * k, y: to.y + dy * k, z: to.z + dz * k };
}

export interface HoldMove {
    from: JogPosition;
    to: JogPosition;
    /** Clock time the model starts executing this increment (send time, or the previous end). */
    start: number;
    end: number;
}

/**
 * The clock queue model: outstanding = sent - estimated executed by the
 * clock. Each increment is charged its commanded duration from the later of
 * its send time and the previous increment's end. The number of unanswered
 * G1 requests is bounded separately by the caller (it awaits every reply
 * before it sends the next increment).
 */
export class HoldQueueModel {
    private moves: HoldMove[] = [];

    private endsAt = -Infinity;

    private origin: JogPosition;

    public constructor(origin: JogPosition) {
        this.origin = { ...origin };
    }

    public outstandingMs(now: number): number {
        return Math.max(0, this.endsAt - now);
    }

    /** Whether an increment of `execMs` may be sent now without exceeding the queue-ahead cap. */
    public admits(now: number, execMs: number): boolean {
        return this.outstandingMs(now) + execMs <= HOLD_QUEUE_AHEAD_MS + 1e-9;
    }

    public sent(sentAt: number, from: JogPosition, to: JogPosition, execMs: number): HoldMove {
        const start = Math.max(this.endsAt, sentAt);
        const move = { from: { ...from }, to: { ...to }, start, end: start + execMs };
        this.moves.push(move);
        this.endsAt = move.end;
        return move;
    }

    /** The position the model expects the stepper to have reached at clock time `t`. */
    public expectedAt(t: number): JogPosition {
        let position = this.origin;
        for (const move of this.moves) {
            if (t <= move.start) { break; }
            if (t >= move.end) { position = move.to; continue; }
            const k = (t - move.start) / (move.end - move.start);
            return { x: move.from.x + (move.to.x - move.from.x) * k,
                y: move.from.y + (move.to.y - move.from.y) * k,
                z: move.from.z + (move.to.z - move.from.z) * k };
        }
        return { ...position };
    }

    public get count(): number { return this.moves.length; }

    /** When the model expects everything sent so far to have executed. */
    public get endsAtMs(): number { return this.endsAt; }
}

export interface CountReport {
    /** The `X: Y: Z:` fields: the position in the controller's selected workspace. */
    position: JogPosition | null;
    /** The `Count X: Y: Z:` fields: stepper counts, in steps. */
    count: JogPosition | null;
}

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const POSITION_RE = new RegExp(`(?:^|[^A-Za-z])X:\\s*${NUM}\\s+Y:\\s*${NUM}\\s+Z:\\s*${NUM}`);
const COUNT_RE = new RegExp(`Count\\s+X:\\s*${NUM}\\s+Y:\\s*${NUM}\\s+Z:\\s*${NUM}`, 'i');

/**
 * Parse an M114 reply. Marlin prints `X:… Y:… Z:… E:… Count X:… Y:… Z:…`
 * (1.x puts a space after each `Count` axis colon; 2.x does not). Either
 * half may be missing: a reply with no Count fields is reported as such, it
 * is never invented.
 */
export function parseCountReport(text: string | undefined | null): CountReport {
    const raw = String(text || '');
    const countMatch = raw.match(COUNT_RE);
    const before = countMatch && countMatch.index !== undefined ? raw.slice(0, countMatch.index) : raw;
    const positionMatch = before.match(POSITION_RE);
    const xyz = (m: RegExpMatchArray | null): JogPosition | null => (m
        ? { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) }
        : null);
    return { position: xyz(positionMatch), count: xyz(countMatch) };
}

/** `M92 X… Y… Z…` from an `M503 S` report, or null when it is not there. */
export function parseStepsPerMm(m503: string | undefined | null): JogPosition | null {
    const m = String(m503 || '').match(/M92\s+X(-?[\d.]+)\s+Y(-?[\d.]+)\s+Z(-?[\d.]+)/);
    if (!m) { return null; }
    const steps = { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
    return (['x', 'y', 'z'] as const).every((axis) => Number.isFinite(steps[axis]) && steps[axis] > 0) ? steps : null;
}

/** Count / steps-per-mm: millimetres in the COUNT frame, not machine coordinates (see learnCountOffset). */
export function countToMm(count: JogPosition, stepsPerMm: JogPosition): JogPosition {
    return { x: count.x / stepsPerMm.x, y: count.y / stepsPerMm.y, z: count.z / stepsPerMm.z };
}

/**
 * The per-axis offset between the Count frame and machine coordinates,
 * learned once per arm from an M114 taken at rest with a reliable position of
 * record: offset = Count / steps-per-mm - machine. HARDWARE FACT (A350 trial,
 * 2026-10-05, four at-rest samples): Count/400 read machine X + 19, Y + 4,
 * Z + 0 - machine X263.42 Y0 Z299.67 printed `Count X:112966 Y:1600
 * Z:119867`. Count X zero is the X home switch at machine X -19: the counts
 * are measured from the homing position, not machine zero. The values are
 * never assumed; they are learned on every arm (homing could reset them).
 */
export interface CountOffset {
    /** Count frame minus machine frame, mm, per axis. */
    x: number;
    y: number;
    z: number;
    /** Clock time of the arm-time M114 it was learned from. */
    learnedAt: number;
    /** The raw Count and the record machine position it was learned from. */
    count: JogPosition;
    machine: JogPosition;
}

export function learnCountOffset(count: JogPosition, stepsPerMm: JogPosition, machine: JogPosition, now: number): CountOffset {
    const mm = countToMm(count, stepsPerMm);
    return { x: mm.x - machine.x, y: mm.y - machine.y, z: mm.z - machine.z, learnedAt: now, count: { ...count }, machine: { ...machine } };
}

/** Machine coordinates from a Count sample: Count / steps-per-mm minus the learned offset. */
export function countToMachine(count: JogPosition, stepsPerMm: JogPosition, offset: CountOffset): JogPosition {
    const mm = countToMm(count, stepsPerMm);
    return { x: mm.x - offset.x, y: mm.y - offset.y, z: mm.z - offset.z };
}

export interface CountJudgement {
    /** XY distance between the Count-derived position and the expected executed position; null without Count. */
    lagMm: number | null;
    /** True when that distance exceeds one increment (plus the position tolerance), in either direction. */
    off: boolean;
}

/**
 * Judge one Count sample against the clock model. `moveMm` is one increment
 * at the current feed: the Count-derived position may trail OR lead the
 * expected executed position by up to that much plus `toleranceMm` before it
 * counts as off (the distance is symmetric: a stall and a touchscreen speed
 * override above 100 % both count). XY only: the hold never commands Z.
 */
export function judgeCountSample(derived: JogPosition | null, expected: JogPosition, moveMm: number, toleranceMm: number): CountJudgement {
    if (!derived) { return { lagMm: null, off: false }; }
    const lagMm = Math.hypot(derived.x - expected.x, derived.y - expected.y);
    return { lagMm, off: lagMm > moveMm + toleranceMm };
}

/** One Count sample as traced and reported in `/pendant/status`. */
export interface CountSample {
    /** Clock time the M114 was sent. */
    at: number;
    execMs: number;
    /** The reply took longer than one tick. */
    late: boolean;
    count: JogPosition | null;
    /** Count / steps-per-mm before the offset (the Count frame), kept so a trial can see the offset stay constant during motion. */
    rawMm: JogPosition | null;
    /** Count / steps-per-mm minus the learned offset: machine coordinates. Null without Count or without a learned offset. */
    derived: JogPosition | null;
    /** The reply's X/Y/Z fields (the selected workspace: machine coordinates inside the hold). */
    position: JogPosition | null;
    /** The model's expected executed position at the send time. */
    expected: JogPosition;
    lagMm: number | null;
    off: boolean;
    error: string | null;
}

/**
 * What an 'enforced' Count check stops on, or null. 'observe' never gates
 * (the caller does not call this, or ignores the result): the open-loop
 * clock pacing with the queue-ahead cap is the behaviour in observe mode.
 */
export function countFault(sample: CountSample, moveMm: number): string | null {
    if (sample.error) { return `M114 failed during the hold: ${sample.error}`; }
    if (sample.late) { return `the M114 reply took ${sample.execMs} ms (limit one tick, ${HOLD_TICK_MS} ms)`; }
    if (!sample.count) { return 'the M114 reply carried no Count fields, so the executed position cannot be checked'; }
    if (!sample.derived) { return 'the Count offset was not learned at arm, so the Count cannot be read as a machine position'; }
    if (sample.off) {
        return `the Count position is ${(sample.lagMm as number).toFixed(2)} mm from the expected executed position `
            + `(limit one increment, ${moveMm.toFixed(2)} mm)`;
    }
    return null;
}
