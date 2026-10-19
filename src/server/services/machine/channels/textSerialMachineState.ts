// Latest machine state of the USB text-serial channel (the Snapmaker Original,
// and a Snapmaker 2.0 or Ray on plain-text USB), plan amendment R1 of #265.
// Until this module the channel kept no state, Channel.getLatestMachineState()
// returned null, and every heartbeat-gated MCP tool refused with "No heartbeat
// received yet" on the Original.
//
// Source: the M114 replies MarlinController ALREADY polls (queryTimer ->
// queryState -> query.issue writes M114 in rotation with the other status
// queries). Nothing here sends anything; the channel notes each position
// reply the Marlin line parser has parsed.
//
// Frame honesty: Marlin's M114 X/Y/Z is the LOGICAL position - the planner's
// current (queued) target in the coordinate system G92 and, on a Snapmaker
// 2.0, the selected work origin shift. It is not a machine coordinate and the
// state never pretends it is: `positionFrame: 'logical'`, and NO `originOffset`
// key, so the MCP judge cannot derive a machine position from a reported
// offset. The Snapmaker 2.0's M1007 work-origin replies are kept as
// `controllerOriginOffset` for the MCP to decide on (WP4a). The "Count" tail
// of the reply (stepper position; steps on Marlin >= 1.1, mm on 1.0) is kept
// as printed in `counts`.
//
// `timestamp` is the time the last M114 position reply was PARSED, never a
// timer tick, so a stalled serial link reads stale to the MCP.
//
// Write-path evidence (WP4a): every line MarlinController writes to the port
// (feeder, sender, queries, console - its writeln is the only serial write) is
// noted here too, so the MCP can decide whether the logical frame IS the
// machine frame. On a machine with no workspaces (the Original) it is exactly
// when a full G28 completed on this connection and nothing that shifts the
// logical position (G92, G53/G54-G59.x, M206, M428, M501/M502) has been
// written since. "Completed" is observed, not assumed: an M114 written AFTER
// the G28 was answered (Marlin runs commands in order, so that reply comes
// after the homing). `controllerHomed` (MarlinController sets isHomed when it
// SENDS a G28) is never used for this. The same bookkeeping marks a position
// reply `reportAtRest` when its M114 was written after a planner sync (G4,
// M400, G28) that followed the last motion line - M114 reports the planner's
// QUEUED target, so only such a reply says where the head actually is.
// Replies are matched to M114 writes in order; a lost reply makes the
// matching lag (conservative), never lead.
//
// Snapmaker 2.0 work offset (#265 follow-up, text-serial position trust):
// M1007 replies (Snapmaker2-Controller snapmaker/src/gcode/M1005_1007.cpp)
// print "Selected origin num: <active workspace + 1, 0 = G53>", "Selected ==
// Current: YES|NO" and "Origin offset X/Y/Z/B: ...". With G53 selected the
// offset printed is position_shift (the shift in force); with a workspace
// selected it is the STORED coordinate_system[active], which is the shift in
// force only when "Selected == Current" says YES. Replies are matched to M1007
// writes in order like M114 (a lost reply lags, never leads), one reply at a
// time, so values of two replies are never spliced. `workOffset` is the last
// complete reply; `countAnchor` is the first resting report after a home with
// a matched, consistent M1007 answered after every shift, kept so the MCP can
// check later reports' Count against it (logicalFrame.ts).
//
// Stepper idle (the Original, #265 follow-up): Marlin releases the steppers
// after its inactivity timeout (M18/M84 S<seconds> sets it, S0 = never; a
// bare M18/M84 releases at once). The idle clock restarts at every motion
// line written and at every report whose position or Count moved (stamped at
// the PREVIOUS report: the move was under way by then at the latest).
// Queries (M114, M105, M1007...) are not activity. `idle` keeps the gaps
// since the last full home so the MCP can judge them against the policy
// timeout; a timeout written on this connection is judged here and latched.
//
// Pure module: no server imports, unit-tested in mcp/tests/textSerialState.test.ts.

export interface TextSerialPosition {
    x: number | null;
    y: number | null;
    z: number | null;
    b: number | null;
    isFourAxis: boolean;
}

export interface TextSerialCounts {
    x: number | null;
    y: number | null;
    z: number | null;
}

export interface TextSerialOriginOffset {
    x: number | null;
    y: number | null;
    z: number | null;
    b: number | null;
}

/** The payload MarlinLineParserResultPosition produces: axis values as fixed-point strings, plus the raw line. */
export interface MarlinPositionPayload {
    pos?: { [axis: string]: unknown };
    raw?: string;
}

/** The payload MarlinParserOriginOffset produces: one axis per "Origin offset X: 1.23" line. */
export interface MarlinOriginOffsetPayload {
    originOffset?: { [axis: string]: unknown };
}

/** Controller facts read when the state is read (they have no report time of their own). */
export interface TextSerialLiveFields {
    /** MarlinController's sender workflow ('idle' | 'running' | 'paused'): Luban streaming a file, not motion. */
    workflowState?: unknown;
    /** Marlin state isHomed: set by a "Homed: YES/NO" reply (M1005 at connect) AND by Luban sending a G28 line. */
    isHomed?: unknown;
    headType?: unknown;
    headStatus?: unknown;
    headPower?: unknown;
}

/** One line written to the port that the frame evidence remembers. */
export interface WrittenLine {
    line: string;
    at: number;
}

/** What the write path says about the logical frame on THIS connection generation (see the header). */
export interface TextSerialFrameEvidence {
    /** When a full home (G28 with no axis words, or all of X Y Z) was observed complete; null before any, or once lost. */
    homedAt: number | null;
    /** The G28 line that homing was, as written. */
    homeLine: string | null;
    /** A full G28 written whose completion has not been observed yet. */
    homePending: WrittenLine | null;
    /** The last transient shift (G92*, G53, G54-G59.x) written after the homing G28 - or since connect while not homed. */
    shift: WrittenLine | null;
    /** A shift a home does not clear (M206, M428, M501, M502) written on this connection. */
    persistentShift: WrittenLine | null;
    /** A line after which the homed position may be lost (M112, M410, a bare M18/M84), written after the homing G28. */
    lost: WrittenLine | null;
    /** The last complete M1007 reply of this connection (see the header), null before any. */
    workOffset: TextSerialWorkOffset | null;
    /** The last workspace select written (G53 = origin 0, G54 = 1 ... G59.3 = 9), null before any. */
    lastSelect: (WrittenLine & { origin: number }) | null;
    /** The current report's M114 was written before this shift (G92*, G53, G54-G59.x) or home line, or matched no write: an older frame. */
    reportStaleBecause: WrittenLine | null;
    /** First resting report after the current home with a fresh, consistent work offset (null before one, or on a machine without M1007). */
    countAnchor: TextSerialCountAnchor | null;
    /** Stepper idle evidence since the last full home written (see the header). */
    idle: TextSerialIdleEvidence;
}

/** One complete M1007 reply, matched to the M1007 write it answers. */
export interface TextSerialWorkOffset {
    x: number;
    y: number;
    z: number;
    /** "Selected origin num": 0 = G53 (machine frame), 1 = G54 ... 9 = G59.3. Null when the reply carried none. */
    selectedOrigin: number | null;
    /** "Selected == Current": the printed offset IS the shift in force. Null when the reply carried no such line. */
    selectedEqualsCurrent: boolean | null;
    /** When the reply completed. */
    at: number;
    /** When the M1007 it answers was written; null when no outstanding M1007 write matched it. */
    writtenAt: number | null;
    /** A shift or home line written AFTER that M1007 (or an unmatched reply): it predates the frame in force. Null when fresh. */
    staleBecause: WrittenLine | null;
}

export interface TextSerialCountAnchor {
    counts: { x: number; y: number; z: number };
    pos: { x: number; y: number; z: number };
    offset: { x: number; y: number; z: number };
    at: number;
}

export interface TextSerialIdleEvidence {
    /** Last activity (motion line written, or position/Count moved) since the last full home written; null before any home. */
    lastActivityAt: number | null;
    /** The last M18/M84 S<seconds> written on this connection (0 = never release), null when none. */
    writtenTimeout: (WrittenLine & { seconds: number }) | null;
    /** Longest closed idle gap since the home while NO timeout had been written (judged against the policy timeout), 0 when none. */
    longestUnwrittenGapMs: number;
    /** A written timeout ran out since the home (latched until the next home). */
    expired: WrittenLine | null;
}

export interface TextSerialMachineState {
    [key: string]: unknown;
    /** When the newest M114 position reply was parsed (the MCP's beat clock). */
    timestamp: number;
    /** M114 reports the logical (G92 / work-origin shifted) position, never machine coordinates. */
    positionFrame: 'logical';
    pos: TextSerialPosition;
    /** Extruder position from the same reply, null when absent. */
    e: number | null;
    /** The reply's "Count X: Y: Z:" stepper fields as printed, null when the firmware sent none. */
    counts: TextSerialCounts | null;
    /** The M114 reply line exactly as received. */
    raw: string;
    /** Axes M1007 "Origin offset" replies reported on THIS connection, null before any. */
    controllerOriginOffset: TextSerialOriginOffset | null;
    controllerOriginOffsetAt: number | null;
    /** Luban's sender state, not the controller's motion state (Marlin has no idle report over M114). */
    workflowState: string | null;
    /** See TextSerialLiveFields.isHomed: a sent G28 sets it, so it is a hint, not a fact. Null when nothing set it. */
    controllerHomed: boolean | null;
    headType: string | null;
    headStatus: boolean | null;
    headPower: number | null;
    /** This reply's M114 was written after a planner sync that followed the last motion line: the head was at rest there. */
    reportAtRest: boolean;
    /** Write-path evidence about the logical frame (see the header). */
    frameEvidence: TextSerialFrameEvidence;
}

// ---- Write-path line classification -----------------------------------------

export type WrittenLineKind = 'm114' | 'm1007' | 'full-home' | 'partial-home' | 'motion' | 'sync' | 'shift' | 'persistent-shift' | 'lost'
    | 'idle-timeout' | 'other';

/** The G/M code words of one line, comments (`;`, `(...)`), line numbers and checksums removed: ['G28'], ['G92', 'X'...]. */
function lineWords(raw: string): { codes: string[]; axes: string[]; s: number | null } {
    const line = String(raw)
        .replace(/\(.*?\)/g, ' ')
        .replace(/;.*$/, '')
        .replace(/\*\d+\s*$/, '')
        .toUpperCase();
    const codes: string[] = [];
    const axes: string[] = [];
    let s: number | null = null;
    const pattern = /([A-Z])\s*(-?\d+(?:\.\d+)?)?/g;
    for (let match = pattern.exec(line); match !== null; match = pattern.exec(line)) {
        const letter = match[1];
        if ((letter === 'G' || letter === 'M') && match[2] !== undefined) {
            // G01 -> G1, G92.1 stays G92.1.
            const [whole, fraction] = match[2].replace(/^-/, '').split('.');
            codes.push(`${letter}${Number(whole)}${fraction === undefined ? '' : `.${fraction}`}`);
        } else if (letter === 'X' || letter === 'Y' || letter === 'Z') {
            axes.push(letter);
        } else if (letter === 'S' && match[2] !== undefined && s === null) {
            s = Number(match[2]);
        }
    }
    return { codes, axes, s };
}

/** Workspace number M1007 prints for a select line ("Selected origin num" = active index + 1): G53 0, G54 1 ... G59.3 9. */
const SELECT_ORIGIN: { [code: string]: number } = {
    G53: 0, G54: 1, G55: 2, G56: 3, G57: 4, G58: 5, G59: 6, 'G59.1': 7, 'G59.2': 8, 'G59.3': 9,
};

/** The workspace a written line selects (SELECT_ORIGIN), null when it selects none. */
export function selectedOriginOf(raw: string): number | null {
    const { codes } = lineWords(raw);
    for (let i = codes.length - 1; i >= 0; i--) {
        if (SELECT_ORIGIN[codes[i]] !== undefined) {
            return SELECT_ORIGIN[codes[i]];
        }
    }
    return null;
}

/**
 * The stepper inactivity timeout an M18/M84 line sets, in seconds: `M84 S<n>`
 * only sets it (Marlin gcode_M18_M84: with S the steppers are NOT released;
 * S0 = never release). Null for any other line, and for a bare M18/M84.
 */
export function writtenIdleTimeoutSeconds(raw: string): number | null {
    const { codes, s } = lineWords(raw);
    if (s === null || !Number.isFinite(s) || s < 0 || !codes.some((code) => code === 'M18' || code === 'M84')) {
        return null;
    }
    return s;
}

const SHIFT_CODE = /^(G92(\.\d+)?|G53|G5[4-8]|G59(\.[1-3])?)$/;
const PERSISTENT_SHIFT_CODE = /^(M206|M428|M501|M502)$/;
const LOST_CODE = /^(M112|M410|M18|M84)$/;
/**
 * G words known NOT to move (planes, units, distance mode). Every other G word
 * counts as motion - an unlisted one (MarlinController's own `G28.2 X Y Z`, a
 * G29 probe) must never leave an outstanding M114 marked at rest. G4 is the
 * sync; the shifts and G28 are classified before this is consulted.
 */
const NON_MOTION_G = /^(G17|G18|G19|G20|G21|G90|G91)$/;
const SYNC_CODE = /^(G4|M400)$/;

/** What one written line means to the frame evidence; the most consequential kind wins. */
export function classifyWrittenLine(raw: string): WrittenLineKind {
    const { codes, axes } = lineWords(raw);
    if (!codes.length) {
        return 'other';
    }
    if (codes.some((code) => PERSISTENT_SHIFT_CODE.test(code))) {
        return 'persistent-shift';
    }
    if (codes.some((code) => SHIFT_CODE.test(code))) {
        return 'shift';
    }
    if (codes.some((code) => LOST_CODE.test(code))) {
        // M18/M84 S<n> sets the inactivity timeout and releases nothing; M112/M410 always lose the position.
        const onlyTimeout = writtenIdleTimeoutSeconds(raw) !== null && !codes.some((code) => code === 'M112' || code === 'M410');
        return onlyTimeout ? 'idle-timeout' : 'lost';
    }
    if (codes.includes('G28')) {
        const all = ['X', 'Y', 'Z'].every((axis) => axes.includes(axis));
        return axes.length === 0 || all ? 'full-home' : 'partial-home';
    }
    // A G28 subcode (G28.2) moves but is never a full home.
    if (codes.some((code) => code.startsWith('G') && !SYNC_CODE.test(code) && !NON_MOTION_G.test(code))) {
        return 'motion';
    }
    if (codes.some((code) => SYNC_CODE.test(code))) {
        return 'sync';
    }
    if (codes.includes('M114')) {
        return 'm114';
    }
    if (codes.includes('M1007')) {
        return 'm1007';
    }
    return 'other';
}

/**
 * The home counts as lost this long BEFORE the stepper idle timeout runs out.
 * The MCP's clock starts when a motion line is WRITTEN, before the firmware
 * even reads it, so it already runs ahead of Marlin's; the margin covers
 * what is left - the host-to-controller clock skew over a long idle and the
 * M114 poll that reports the move - so the MCP never trusts a home the
 * firmware has just released.
 */
export const STEPPER_IDLE_EPSILON_MS = 1000;

/** M114 replies outstanding at once is one or two (queries wait for the previous ok); far beyond that is lost replies. */
const MAX_PENDING_M114 = 32;

function finite(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Two readings carry the same X/Y/Z. Exact on purpose: this asks whether
 * ANYTHING moved (steps or printed hundredths), not whether two positions
 * agree - that comparison uses the position epsilon (logicalFrame.ts).
 */
function sameAxes(a: { x: number | null; y: number | null; z: number | null } | null,
    b: { x: number | null; y: number | null; z: number | null } | null): boolean {
    if (!a || !b) {
        return a === b;
    }
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** "Count X:12800 Y:1600 Z:0" (Marlin 1.1+) or "Count X: 0.00Y:0.00Z:0.00" (Marlin 1.0). */
export function parseM114Counts(raw: string): TextSerialCounts | null {
    const at = raw.search(/\bCount\b/i);
    if (at < 0) {
        return null;
    }
    const counts: TextSerialCounts = { x: null, y: null, z: null };
    const pattern = /([XYZ]):\s*(-?[0-9]+(?:\.[0-9]+)?)/gi;
    const tail = raw.slice(at);
    for (let match = pattern.exec(tail); match !== null; match = pattern.exec(tail)) {
        const axis = match[1].toLowerCase() as keyof TextSerialCounts;
        if (counts[axis] === null) {
            counts[axis] = finite(match[2]);
        }
    }
    return counts.x === null && counts.y === null && counts.z === null ? null : counts;
}

/** Numbers out of the parser's fixed-point strings; an axis the reply did not carry stays null (never 0). */
export function mapPositionPayload(payload: MarlinPositionPayload): {
    pos: TextSerialPosition;
    e: number | null;
    counts: TextSerialCounts | null;
    raw: string;
} | null {
    const source = payload && payload.pos;
    if (!source || typeof source !== 'object') {
        return null;
    }
    const pos: TextSerialPosition = {
        x: finite(source.x),
        y: finite(source.y),
        z: finite(source.z),
        b: finite(source.b),
        isFourAxis: source.isFourAxis === true,
    };
    if (pos.x === null && pos.y === null && pos.z === null) {
        return null;
    }
    const raw = typeof payload.raw === 'string' ? payload.raw : '';
    return { pos, e: finite(source.e), counts: parseM114Counts(raw), raw };
}

/**
 * Keeps the newest M114 position reply and the M1007 offsets of one
 * connection. Every note carries the channel's connection generation; a read
 * with a different generation (the port was closed or reopened under the
 * channel) clears it, so a reconnect starts with null like the other channels.
 */
export class TextSerialMachineStateTracker {
    private report: { pos: TextSerialPosition; e: number | null; counts: TextSerialCounts | null; raw: string; at: number } | null = null;

    private originOffset: TextSerialOriginOffset | null = null;

    private originOffsetAt: number | null = null;

    private generation: number | null = null;

    private readonly now: () => number;

    // ---- write-path evidence (all per generation) ----

    /** Sequence number of the last written line. */
    private seq = 0;

    /** Seq of the last motion line and of the last planner sync (a G28 is both). */
    private lastMotionSeq = 0;

    private lastSyncSeq = 0;

    /** M114 writes not yet answered, oldest first, each with whether the head was at rest when it would be processed. */
    private pendingM114: Array<{ seq: number; atRest: boolean }> = [];

    private homePending: (WrittenLine & { seq: number }) | null = null;

    private home: (WrittenLine & { seq: number; completedAt: number }) | null = null;

    private shift: (WrittenLine & { seq: number }) | null = null;

    private persistentShift: WrittenLine | null = null;

    private lost: (WrittenLine & { seq: number }) | null = null;

    private reportAtRest = false;

    /** Seq of the M114 write the current report answers (null: matched none). */
    private reportSeq: number | null = null;

    /** Seq and line of the last shift or full-home line written (either changes the logical frame on a Snapmaker 2.0). */
    private frameChange: (WrittenLine & { seq: number }) | null = null;

    private lastSelect: (WrittenLine & { seq: number; origin: number }) | null = null;

    /** M1007 writes not yet answered, oldest first. */
    private pendingM1007: Array<{ seq: number; at: number }> = [];

    /** The M1007 reply being assembled (it spans several lines), and the last complete one. */
    private offsetReply: { seq: number | null; writtenAt: number | null; selectedOrigin: number | null;
        selectedEqualsCurrent: boolean | null; values: { [axis: string]: number } } | null = null;

    private workOffset: (Omit<TextSerialWorkOffset, 'staleBecause'> & { seq: number | null }) | null = null;

    private countAnchor: (TextSerialCountAnchor & { homeSeq: number }) | null = null;

    // ---- stepper idle (since the last full home written) ----

    private lastActivityAt: number | null = null;

    private writtenTimeout: (WrittenLine & { seconds: number }) | null = null;

    private longestUnwrittenGapMs = 0;

    private idleExpired: WrittenLine | null = null;

    public constructor(now: () => number = Date.now) {
        this.now = now;
    }

    private adopt(generation: number): void {
        if (this.generation !== generation) {
            this.clear();
            this.generation = generation;
        }
    }

    /**
     * One line MarlinController wrote to the port (any source). Classified by
     * classifyWrittenLine; a multi-line payload is noted line by line.
     */
    public noteLineWritten(data: string, generation: number): void {
        this.adopt(generation);
        for (const raw of String(data).split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) {
                continue;
            }
            this.seq += 1;
            const seq = this.seq;
            const at = this.now();
            const kind = classifyWrittenLine(line);
            if (kind === 'm114') {
                this.pendingM114.push({ seq, atRest: this.lastSyncSeq >= this.lastMotionSeq });
                if (this.pendingM114.length > MAX_PENDING_M114) {
                    this.pendingM114.shift();
                }
            } else if (kind === 'm1007') {
                this.pendingM1007.push({ seq, at });
                if (this.pendingM1007.length > MAX_PENDING_M114) {
                    this.pendingM1007.shift();
                }
            } else if (kind === 'motion' || kind === 'partial-home' || kind === 'full-home') {
                if (kind === 'full-home') {
                    // A new home: idle gaps before it no longer matter; the idle clock starts here.
                    this.lastActivityAt = at;
                    this.longestUnwrittenGapMs = 0;
                    this.idleExpired = null;
                    this.frameChange = { line, at, seq };
                } else {
                    this.noteActivity(at, line);
                }
                this.lastMotionSeq = seq;
                // A reply to an M114 written before this line comes before the
                // move, but a lost reply would let a later one inherit its
                // flag: nothing outstanding may claim "at rest" any more.
                this.pendingM114.forEach((entry) => {
                    entry.atRest = false;
                });
                if (kind !== 'motion') {
                    // G28 blocks the command queue until homing ends: it is its own sync.
                    this.lastSyncSeq = seq;
                }
                if (kind === 'full-home') {
                    this.homePending = { line, at, seq };
                }
            } else if (kind === 'sync') {
                this.lastSyncSeq = seq;
            } else if (kind === 'shift') {
                this.shift = { line, at, seq };
                this.frameChange = { line, at, seq };
                const origin = selectedOriginOf(line);
                if (origin !== null) {
                    this.lastSelect = { line, at, seq, origin };
                }
            } else if (kind === 'persistent-shift') {
                this.persistentShift = { line, at };
            } else if (kind === 'lost') {
                this.lost = { line, at, seq };
            } else if (kind === 'idle-timeout') {
                this.noteWrittenTimeout(line, at, writtenIdleTimeoutSeconds(line) as number);
            }
        }
    }

    /**
     * Idle clock: activity at `at` closes the gap since the last activity. A
     * gap with no timeout written is kept for the MCP to judge against the
     * policy; under a written timeout it is judged here. Nothing before the
     * first full home counts (lastActivityAt is null until then).
     */
    private noteActivity(at: number, line: string): void {
        if (this.lastActivityAt === null || at <= this.lastActivityAt) {
            return;
        }
        this.closeIdleGap(at, line);
        this.lastActivityAt = at;
    }

    /** Judge the gap from the last activity to `at` (an activity or a timeout write). */
    private closeIdleGap(at: number, line: string): void {
        const from = this.lastActivityAt as number;
        const gap = at - from;
        if (!this.writtenTimeout) {
            this.longestUnwrittenGapMs = Math.max(this.longestUnwrittenGapMs, gap);
            return;
        }
        const limitMs = this.writtenTimeout.seconds * 1000;
        if (limitMs > 0 && gap >= limitMs - STEPPER_IDLE_EPSILON_MS && !this.idleExpired) {
            this.idleExpired = { line: `${this.writtenTimeout.line} (idle ${Math.round(gap / 1000)} s before ${line})`, at: from + limitMs };
        }
    }

    /** M18/M84 S<n>: the firmware's timeout from now on; the gap so far is judged under the old regime first. */
    private noteWrittenTimeout(line: string, at: number, seconds: number): void {
        if (this.lastActivityAt !== null) {
            // The gap so far under whatever applied until now (Marlin keeps
            // its previous_move_ms, so the new timeout also judges the whole
            // open gap - checked here at once, and at every later activity).
            this.closeIdleGap(at, line);
            const gap = at - this.lastActivityAt;
            if (seconds > 0 && gap >= seconds * 1000 - STEPPER_IDLE_EPSILON_MS && !this.idleExpired) {
                this.idleExpired = { line: `${line} (already idle ${Math.round(gap / 1000)} s)`, at };
            }
        }
        this.writtenTimeout = { line, at, seconds };
    }

    /** One parsed M114 reply. Returns false (and keeps the previous report) when it carried no X/Y/Z. */
    public notePosition(payload: MarlinPositionPayload, generation: number): boolean {
        this.adopt(generation);
        const mapped = mapPositionPayload(payload);
        if (!mapped) {
            return false;
        }
        const now = this.now();
        // Replies come in write order: this one answers the oldest outstanding M114.
        const answers = this.pendingM114.shift() || null;
        this.reportAtRest = !!answers && answers.atRest;
        if (answers && this.homePending && answers.seq > this.homePending.seq) {
            this.home = { line: this.homePending.line, at: this.homePending.at, seq: this.homePending.seq, completedAt: now };
            this.homePending = null;
        }
        const previous = this.report;
        if (previous && (!sameAxes(previous.pos, mapped.pos) || !sameAxes(previous.counts, mapped.counts))) {
            // Position or Count moved between the two reports: motion was
            // under way at the previous report at the latest.
            this.noteActivity(previous.at, 'a position report that moved');
        }
        this.report = { ...mapped, at: now };
        this.reportSeq = answers ? answers.seq : null;
        this.maybeAnchor(now);
        return true;
    }

    /** Seq after which a reply is in the frame in force: the last shift or full home written. */
    private frameSeq(): number {
        return this.frameChange ? this.frameChange.seq : 0;
    }

    /** The current report as a Count anchor (see the header), once per home. */
    private maybeAnchor(now: number): void {
        const home = this.home;
        const report = this.report;
        const offset = this.workOffset;
        if (!home || !report || !offset || !this.reportAtRest || this.persistentShift
            || (this.countAnchor && this.countAnchor.homeSeq === home.seq)
            || (this.lost && this.lost.seq > home.seq)) {
            return;
        }
        const { counts, pos } = report;
        if (!counts || counts.x === null || counts.y === null || counts.z === null || pos.x === null || pos.y === null || pos.z === null) {
            return;
        }
        const fresh = offset.seq !== null && offset.seq > this.frameSeq() && this.reportSeq !== null && this.reportSeq > this.frameSeq();
        const selectionAgrees = !this.lastSelect || offset.selectedOrigin === this.lastSelect.origin;
        if (!fresh || offset.selectedEqualsCurrent !== true || !selectionAgrees) {
            return;
        }
        this.countAnchor = {
            counts: { x: counts.x, y: counts.y, z: counts.z },
            pos: { x: pos.x, y: pos.y, z: pos.z },
            offset: { x: offset.x, y: offset.y, z: offset.z },
            at: now,
            homeSeq: home.seq,
        };
    }

    /**
     * One "Selected origin num: N" or "Selected == Current: YES|NO" line of an
     * M1007 reply (MarlinParserSelectedOrigin / MarlinParserSelectedCurrent,
     * payload { message, raw }). "Selected origin num" opens a reply and
     * takes the oldest outstanding M1007 write.
     */
    public noteOriginSelection(payload: { message?: unknown; raw?: unknown }, generation: number): void {
        this.adopt(generation);
        const raw = typeof payload?.raw === 'string' ? payload.raw : '';
        const message = String(payload?.message ?? '').trim();
        if (/^Selected origin num:/i.test(raw)) {
            const answers = this.pendingM1007.shift() || null;
            const n = Number(message);
            this.offsetReply = {
                seq: answers ? answers.seq : null,
                writtenAt: answers ? answers.at : null,
                selectedOrigin: message !== '' && Number.isInteger(n) ? n : null,
                selectedEqualsCurrent: null,
                values: {},
            };
        } else if (/^Selected == Current:/i.test(raw) && this.offsetReply) {
            const word = message.toUpperCase();
            const verdicts: { [word: string]: boolean } = { YES: true, NO: false };
            this.offsetReply.selectedEqualsCurrent = verdicts[word] ?? null;
        }
    }

    /** The write-path evidence as of now (see TextSerialFrameEvidence). */
    public frameEvidence(): TextSerialFrameEvidence {
        const home = this.home;
        const after = (record: (WrittenLine & { seq: number }) | null): WrittenLine | null => {
            if (!record || (home && record.seq < home.seq)) {
                return null;
            }
            return { line: record.line, at: record.at };
        };
        const lost = after(this.lost);
        const change = this.frameChange;
        const changedSince = (seq: number | null, what: string): WrittenLine | null => {
            if (seq === null) {
                return { line: `(${what} matched no outstanding write)`, at: 0 };
            }
            return change && change.seq > seq ? { line: change.line, at: change.at } : null;
        };
        const offset = this.workOffset;
        const anchor = this.countAnchor && home && this.countAnchor.homeSeq === home.seq ? this.countAnchor : null;
        return {
            homedAt: home && !lost ? home.completedAt : null,
            homeLine: home ? home.line : null,
            homePending: this.homePending ? { line: this.homePending.line, at: this.homePending.at } : null,
            shift: after(this.shift),
            persistentShift: this.persistentShift ? { ...this.persistentShift } : null,
            lost,
            workOffset: offset ? {
                x: offset.x,
                y: offset.y,
                z: offset.z,
                selectedOrigin: offset.selectedOrigin,
                selectedEqualsCurrent: offset.selectedEqualsCurrent,
                at: offset.at,
                writtenAt: offset.writtenAt,
                staleBecause: changedSince(offset.seq, 'the M1007 reply'),
            } : null,
            lastSelect: this.lastSelect ? { line: this.lastSelect.line, at: this.lastSelect.at, origin: this.lastSelect.origin } : null,
            reportStaleBecause: this.report ? changedSince(this.reportSeq, 'the M114 reply') : null,
            countAnchor: anchor ? { counts: { ...anchor.counts }, pos: { ...anchor.pos }, offset: { ...anchor.offset }, at: anchor.at } : null,
            idle: {
                lastActivityAt: this.lastActivityAt,
                writtenTimeout: this.writtenTimeout ? { ...this.writtenTimeout } : null,
                longestUnwrittenGapMs: this.longestUnwrittenGapMs,
                expired: this.idleExpired ? { ...this.idleExpired } : null,
            },
        };
    }

    /** One parsed M1007 "Origin offset <axis>: <mm>" line: merged per axis, it is not a position beat. */
    public noteOriginOffset(payload: MarlinOriginOffsetPayload, generation: number): void {
        this.adopt(generation);
        const source = payload && payload.originOffset;
        if (!source || typeof source !== 'object') {
            return;
        }
        const next: TextSerialOriginOffset = { ...(this.originOffset || { x: null, y: null, z: null, b: null }) };
        let changed = false;
        for (const axis of ['x', 'y', 'z', 'b'] as const) {
            const value = finite(source[axis]);
            if (value !== null) {
                next[axis] = value;
                changed = true;
            }
        }
        if (changed) {
            this.originOffset = next;
            this.originOffsetAt = this.now();
        }
        // The reply being assembled: complete once X, Y and Z are in (B, when
        // printed, comes last and is not part of the XYZ mapping).
        const reply = this.offsetReply;
        if (reply) {
            for (const axis of ['x', 'y', 'z'] as const) {
                const value = finite(source[axis]);
                if (value !== null) {
                    reply.values[axis] = value;
                }
            }
            const { x, y, z } = reply.values;
            if (x !== undefined && y !== undefined && z !== undefined) {
                this.workOffset = {
                    x,
                    y,
                    z,
                    selectedOrigin: reply.selectedOrigin,
                    selectedEqualsCurrent: reply.selectedEqualsCurrent,
                    at: this.now(),
                    writtenAt: reply.writtenAt,
                    seq: reply.seq,
                };
                this.offsetReply = null;
                this.maybeAnchor(this.now());
            }
        }
    }

    /** Null until the first position reply of this connection generation. */
    public get(generation: number, live: TextSerialLiveFields = {}): TextSerialMachineState | null {
        if (this.generation !== generation) {
            this.clear();
            return null;
        }
        const report = this.report;
        if (!report) {
            return null;
        }
        return {
            timestamp: report.at,
            positionFrame: 'logical',
            pos: { ...report.pos },
            e: report.e,
            counts: report.counts ? { ...report.counts } : null,
            raw: report.raw,
            controllerOriginOffset: this.originOffset ? { ...this.originOffset } : null,
            controllerOriginOffsetAt: this.originOffsetAt,
            workflowState: typeof live.workflowState === 'string' ? live.workflowState : null,
            controllerHomed: typeof live.isHomed === 'boolean' ? live.isHomed : null,
            headType: typeof live.headType === 'string' && live.headType ? live.headType : null,
            headStatus: typeof live.headStatus === 'boolean' ? live.headStatus : null,
            headPower: finite(live.headPower),
            reportAtRest: this.reportAtRest,
            frameEvidence: this.frameEvidence(),
        };
    }

    public clear(): void {
        this.report = null;
        this.originOffset = null;
        this.originOffsetAt = null;
        this.generation = null;
        this.seq = 0;
        this.lastMotionSeq = 0;
        this.lastSyncSeq = 0;
        this.pendingM114 = [];
        this.homePending = null;
        this.home = null;
        this.shift = null;
        this.persistentShift = null;
        this.lost = null;
        this.reportAtRest = false;
        this.reportSeq = null;
        this.frameChange = null;
        this.lastSelect = null;
        this.pendingM1007 = [];
        this.offsetReply = null;
        this.workOffset = null;
        this.countAnchor = null;
        this.lastActivityAt = null;
        this.writtenTimeout = null;
        this.longestUnwrittenGapMs = 0;
        this.idleExpired = null;
    }
}
