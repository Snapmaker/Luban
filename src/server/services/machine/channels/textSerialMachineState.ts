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
    /** A line after which the homed position may be lost (M112, M410, M18, M84), written after the homing G28. */
    lost: WrittenLine | null;
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

export type WrittenLineKind = 'm114' | 'full-home' | 'partial-home' | 'motion' | 'sync' | 'shift' | 'persistent-shift' | 'lost' | 'other';

/** The G/M code words of one line, comments (`;`, `(...)`), line numbers and checksums removed: ['G28'], ['G92', 'X'...]. */
function lineWords(raw: string): { codes: string[]; axes: string[] } {
    const line = String(raw)
        .replace(/\(.*?\)/g, ' ')
        .replace(/;.*$/, '')
        .replace(/\*\d+\s*$/, '')
        .toUpperCase();
    const codes: string[] = [];
    const axes: string[] = [];
    const pattern = /([A-Z])\s*(-?\d+(?:\.\d+)?)?/g;
    for (let match = pattern.exec(line); match !== null; match = pattern.exec(line)) {
        const letter = match[1];
        if ((letter === 'G' || letter === 'M') && match[2] !== undefined) {
            // G01 -> G1, G92.1 stays G92.1.
            const [whole, fraction] = match[2].replace(/^-/, '').split('.');
            codes.push(`${letter}${Number(whole)}${fraction === undefined ? '' : `.${fraction}`}`);
        } else if (letter === 'X' || letter === 'Y' || letter === 'Z') {
            axes.push(letter);
        }
    }
    return { codes, axes };
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
        return 'lost';
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
    return 'other';
}

/** M114 replies outstanding at once is one or two (queries wait for the previous ok); far beyond that is lost replies. */
const MAX_PENDING_M114 = 32;

function finite(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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
            } else if (kind === 'motion' || kind === 'partial-home' || kind === 'full-home') {
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
            } else if (kind === 'persistent-shift') {
                this.persistentShift = { line, at };
            } else if (kind === 'lost') {
                this.lost = { line, at, seq };
            }
        }
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
        this.report = { ...mapped, at: now };
        return true;
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
        return {
            homedAt: home && !lost ? home.completedAt : null,
            homeLine: home ? home.line : null,
            homePending: this.homePending ? { line: this.homePending.line, at: this.homePending.at } : null,
            shift: after(this.shift),
            persistentShift: this.persistentShift ? { ...this.persistentShift } : null,
            lost,
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
    }
}
