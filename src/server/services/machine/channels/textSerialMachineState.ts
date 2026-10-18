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
}

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

    public constructor(now: () => number = Date.now) {
        this.now = now;
    }

    private adopt(generation: number): void {
        if (this.generation !== generation) {
            this.clear();
            this.generation = generation;
        }
    }

    /** One parsed M114 reply. Returns false (and keeps the previous report) when it carried no X/Y/Z. */
    public notePosition(payload: MarlinPositionPayload, generation: number): boolean {
        this.adopt(generation);
        const mapped = mapPositionPayload(payload);
        if (!mapped) {
            return false;
        }
        this.report = { ...mapped, at: this.now() };
        return true;
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
        };
    }

    public clear(): void {
        this.report = null;
        this.originOffset = null;
        this.originOffsetAt = null;
        this.generation = null;
    }
}
