// Reading a firmware's reply to a G-code sent over SACP (tyeth/Luban#265
// follow-up: the Ray's GRBL `$$`, `$#`, `$G`, `$I` and `M1005`).
//
// What the protocol says. SACP 0x01 0x02 "Execute G-code" takes the line as a
// SACP String (UInt16 LE length + bytes) and its ACK is documented as
// `Result UInt8` ONLY (Snapmaker/Snapmaker-SACP docs/System-Commands.md). The
// SDK keeps whatever follows the result byte (Response.fromBuffer: result =
// byte 0, data = the rest), so SacpClient.executeGcode already returns it -
// it is Luban's channels (SacpChannelBase / SacpUdpChannel.executeGcode) that
// answer `{ result, text: 'ok' }` and drop the payload.
//
// So the reply text can only arrive one of two ways, and a reply read watches
// both: (1) bytes after the result in the ACK (undocumented - an extension a
// firmware may carry), and (2) the controller's log feedback, SACP 0x01 0xa1,
// which startHeartbeatLegacy subscribes on the Ray / Artisan / J1 path at level
// 2 and has always ignored. Which source carried the text (if any) is reported
// with the reply, so the first read on hardware settles it.
//
// The Ray (V1.7.4 over UDP, 2026-10-19) acknowledged every query with result 0
// and no payload, and Luban's own log subscription was NOT live on that
// connection - nothing pushed a log. So a read that finds no subscription
// makes one for itself (withLogFeed): level 2 and 0x01 0xa1 for the read,
// then removes exactly what it added; Luban's own subscription is never touched.
//
// Pure module: no server or SDK imports, unit-tested in
// mcp/tests/sacpGcodeReply.test.ts against packets built with the SDK.

export const SACP_GCODE_COMMAND = { commandSet: 0x01, commandId: 0x02 } as const;
export const SACP_LOG_FEEDBACK = { commandSet: 0x01, commandId: 0xa1 } as const;

/** The Dispatcher's event name for a command: commandSet * 256 + commandId (Dispatcher.evalBusinessId). */
export function sacpBusinessId(command: { commandSet: number; commandId: number }): string {
    return String(command.commandSet * 256 + command.commandId);
}

/** How long a reply read waits for the ACK and for log lines (ms). The MCP passes its own bounded values. */
export const REPLY_TIMEOUT_MS_DEFAULT = 3000;
/** After the ACK: the read ends once no log line has arrived for this long (or a terminator arrived). */
export const REPLY_QUIET_MS_DEFAULT = 400;

/** A SACP String (UInt16 LE length + bytes) occupying the whole buffer, else null. */
function wholeSacpString(data: Buffer): string | null {
    if (data.length < 2) {
        return null;
    }
    const length = data.readUInt16LE(0);
    return length === data.length - 2 ? data.slice(2).toString('utf8') : null;
}

/** Text a person could read: printable ASCII, tabs and line breaks. */
function printable(text: string): boolean {
    return /^[\t\r\n\x20-\x7e]*$/.test(text);
}

export interface AckPayloadText {
    /** Bytes after the result byte. 0 = the documented ACK (result only). */
    bytes: number;
    /** The decoded text, or null when there were no bytes or they are not text. */
    text: string | null;
    /** 'sacp-string' (length-prefixed), 'raw' (plain bytes), or null. */
    form: 'sacp-string' | 'raw' | null;
    /** The bytes as hex when they did not decode (capped), for the report. */
    hex: string | null;
}

const HEX_CAP_BYTES = 64;

/**
 * The text in a 0x01 0x02 ACK's data (Response.data: everything after the
 * result byte). A whole-buffer SACP String is decoded as one; otherwise
 * printable bytes are taken as they are; anything else is reported as hex.
 */
export function parseGcodeAckData(data: Buffer | null | undefined): AckPayloadText {
    if (!data || !data.length) {
        return { bytes: 0, text: null, form: null, hex: null };
    }
    const asString = wholeSacpString(data);
    if (asString !== null && printable(asString)) {
        return { bytes: data.length, text: asString, form: 'sacp-string', hex: null };
    }
    const raw = data.toString('utf8').replace(/\0+$/, '');
    if (raw && printable(raw)) {
        return { bytes: data.length, text: raw, form: 'raw', hex: null };
    }
    return { bytes: data.length, text: null, form: null, hex: data.slice(0, HEX_CAP_BYTES).toString('hex') };
}

export interface LogFeedbackLine {
    level: number;
    text: string;
}

/**
 * One 0x01 0xa1 log notification's data (Response.data, i.e. the payload
 * after its first byte): level UInt8, then a SACP String - the layout the
 * existing callback reads (`readString(data.response.data, 1)`) and the SDK's
 * LogLevel model. null when the buffer is too short to hold it.
 */
export function parseLogFeedbackData(data: Buffer | null | undefined): LogFeedbackLine | null {
    if (!data || data.length < 3) {
        return null;
    }
    const length = data.readUInt16LE(1);
    if (data.length < 3 + length) {
        return null;
    }
    return { level: data.readUInt8(0), text: data.slice(3, 3 + length).toString('utf8') };
}

/** GRBL ends every reply with `ok` or `error:N`; Marlin with `ok`. */
export function isReplyTerminator(line: string): boolean {
    return /^(?:ok|error:\s*\d+)\s*$/i.test(line.trim());
}

/** True when a log line (which may carry several lines) ends the reply. */
export function endsReply(text: string): boolean {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    return lines.length > 0 && isReplyTerminator(lines[lines.length - 1]);
}

export interface GcodeReply {
    /** 0 = the controller accepted the line; -1 = refused, failed or timed out. */
    result: number;
    /** The reply text, or null when none arrived by either route. */
    text: string | null;
    /** Which route carried `text`. */
    source: 'ack-payload' | 'log-feedback' | null;
    ack: AckPayloadText & { received: boolean };
    /**
     * Log feedback seen during the window (the controller's whole log, so
     * unrelated lines can interleave). `subscribed`: Luban already had a
     * 0x01 0xa1 listener before this read (startHeartbeatLegacy's), so the
     * controller is pushing its log; false = nothing pushes it, null = unknown.
     */
    log: { listening: boolean; subscribed: boolean | null; lines: LogFeedbackLine[] };
    /** What the read did to the log feed around itself (withLogFeed); null when it did not manage it. */
    feed: LogFeedReport | null;
    timedOut: boolean;
    elapsedMs: number;
    /** Why the read failed, when result is -1. */
    error?: string;
}

/**
 * The reply from what a read collected. ACK bytes win (they belong to this
 * request by sequence number); else the log lines received in the window,
 * joined - they are the controller's whole log, which is why the window is
 * short and reads are serialised.
 */
export function assembleReply(input: {
    result: number;
    ackData: Buffer | null;
    ackReceived: boolean;
    listening: boolean;
    subscribed?: boolean | null;
    lines: LogFeedbackLine[];
    feed?: LogFeedReport | null;
    timedOut: boolean;
    elapsedMs: number;
    error?: string;
}): GcodeReply {
    const ack = parseGcodeAckData(input.ackData);
    const logText = input.lines.map((line) => line.text.replace(/\r?\n$/, '')).join('\n').trim();
    let text: string | null = null;
    let source: GcodeReply['source'] = null;
    if (ack.text && ack.text.trim()) {
        text = ack.text;
        source = 'ack-payload';
    } else if (logText) {
        text = logText;
        source = 'log-feedback';
    }
    return {
        result: input.result,
        text,
        source,
        ack: { ...ack, received: input.ackReceived },
        log: { listening: input.listening, subscribed: input.subscribed === undefined ? null : input.subscribed, lines: input.lines },
        feed: input.feed || null,
        timedOut: input.timedOut,
        elapsedMs: input.elapsedMs,
        ...(input.error ? { error: input.error } : {}),
    };
}

/** The listener surface a reply read needs from the SDK Dispatcher (an EventEmitter). */
export interface ReplyEmitter {
    on(event: string, listener: (data: { response: { result: number; data: Buffer } }) => void): unknown;
    removeListener(event: string, listener: (data: { response: { result: number; data: Buffer } }) => void): unknown;
    listenerCount?(event: string): number;
}

/**
 * One G-code with its reply: listens to the log feedback BEFORE sending,
 * sends, then collects until a terminator line, a quiet period after the
 * ACK, or the timeout. The listener is a plain EventEmitter listener on the
 * Dispatcher, added and removed here - this function never subscribes or
 * unsubscribes (withLogFeed does that around it, only when Luban has not
 * subscribed). `send` resolves with the SDK's `{ response }` for the 0x01
 * 0x02 request.
 */
export async function readGcodeReply(input: {
    emitter: ReplyEmitter | null;
    send: () => Promise<{ response: { result: number; data?: Buffer } } | undefined>;
    timeoutMs?: number;
    quietMs?: number;
    now?: () => number;
    /** Whether a log subscription was live before the read (withLogFeed knows; else the listener count says). */
    subscribed?: boolean | null;
}): Promise<GcodeReply> {
    const now = input.now || (() => Date.now());
    const timeoutMs = input.timeoutMs || REPLY_TIMEOUT_MS_DEFAULT;
    const quietMs = input.quietMs || REPLY_QUIET_MS_DEFAULT;
    const started = now();
    const lines: LogFeedbackLine[] = [];
    const event = sacpBusinessId(SACP_LOG_FEEDBACK);
    const emitter = input.emitter && typeof input.emitter.on === 'function' && typeof input.emitter.removeListener === 'function'
        ? input.emitter : null;
    let wake: (() => void) | null = null;
    let lastLineAt = 0;
    let terminated = false;
    const listener = (data: { response: { result: number; data: Buffer } }) => {
        const line = parseLogFeedbackData(data && data.response ? data.response.data : null);
        if (!line) {
            return;
        }
        lines.push(line);
        lastLineAt = now();
        if (endsReply(line.text)) {
            terminated = true;
        }
        if (wake) {
            wake();
        }
    };
    let subscribed: boolean | null = input.subscribed === undefined ? null : input.subscribed;
    if (input.subscribed === undefined && emitter && typeof emitter.listenerCount === 'function') {
        subscribed = emitter.listenerCount(event) > 0;
    }
    if (emitter) {
        emitter.on(event, listener);
    }
    const remaining = () => Math.max(0, timeoutMs - (now() - started));
    const waitFor = async (ms: number) => new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
            wake = null;
            resolve();
        }, ms);
        wake = () => {
            clearTimeout(timer);
            wake = null;
            resolve();
        };
    });
    let ackData: Buffer | null = null;
    let ackReceived = false;
    let result = -1;
    let timedOut = false;
    let error: string | undefined;
    try {
        const sent = input.send().then((res) => ({ res }), (err: Error) => ({ err }));
        // The SDK puts no timeout on a non-RTO request: an unanswered line would wait forever.
        let ackTimer: ReturnType<typeof setTimeout> | null = null;
        const raced = await Promise.race([sent, new Promise<null>((resolve) => {
            ackTimer = setTimeout(() => resolve(null), timeoutMs);
        })]);
        if (ackTimer) {
            clearTimeout(ackTimer);
        }
        if (raced === null) {
            timedOut = true;
            error = `no ACK within ${timeoutMs} ms`;
        } else if ('err' in raced) {
            error = raced.err && raced.err.message ? raced.err.message : String(raced.err);
        } else if (!raced.res || !raced.res.response) {
            error = 'the request was not answered (no response)';
        } else {
            ackReceived = true;
            result = raced.res.response.result === 0 ? 0 : -1;
            ackData = raced.res.response.data || null;
            if (result !== 0) {
                error = `the controller answered result ${raced.res.response.result}`;
            }
        }
        // Collect log lines after an accepted ACK: until a terminator, a quiet
        // period since the last line (or since the ACK), or the timeout.
        if (emitter && ackReceived && result === 0 && !parseGcodeAckData(ackData).text) {
            const ackAt = now();
            while (!terminated && remaining() > 0) {
                const since = now() - (lastLineAt || ackAt);
                if (since >= quietMs) {
                    break;
                }
                await waitFor(Math.min(quietMs - since, remaining()));
            }
            if (!terminated && remaining() <= 0) {
                timedOut = true;
            }
        }
    } finally {
        if (emitter) {
            emitter.removeListener(event, listener);
        }
    }
    return assembleReply({ result, ackData, ackReceived, listening: !!emitter, subscribed, lines, timedOut, elapsedMs: now() - started, error });
}

/** The level Luban's own connect sets (startHeartbeatLegacy `logFeedbackLevel(2)`); a read that sets one uses the same. */
export const LOG_FEEDBACK_LEVEL = 2;
/** The subscription interval Luban's own connect asks for (startHeartbeatLegacy). */
export const LOG_FEEDBACK_INTERVAL_MS = 60000;
/**
 * Luban's own log setup (level, then subscribe) is not awaited on connect, so
 * a read right after connecting (the first-connect read) waits up to this long
 * after Luban's level request for it to settle before deciding whose
 * subscription it is. Later reads find it settled and do not wait.
 */
export const LUBAN_LOG_SETUP_WAIT_MS = 5000;

export type LogFeedCallback = (data: { response: { result: number; data: Buffer } }) => void;

/** Luban's own log-feed setup on this connection (startHeartbeatLegacy), as the channel records it. */
export interface LubanLogFeed {
    /** Luban's 0x01 0xa1 callback, or null before startHeartbeatLegacy made one. */
    callback: LogFeedCallback | null;
    /** When Luban sent its level request (ms), null when it never did on this connection. */
    requestedAt: number | null;
    /** Luban's level + subscribe chain is still in flight. */
    pending: boolean;
    /** The controller's answer to Luban's level request; null = none (yet, or it failed). */
    levelResult: number | null;
}

/** The SDK surface withLogFeed drives (SacpClient / Dispatcher, adapted by the channel). */
export interface LogFeedOps {
    /** The Dispatcher's current 0x01 0xa1 listeners. */
    listeners(): LogFeedCallback[];
    removeListener(callback: LogFeedCallback): void;
    /** 0x01 0x10 set log level; resolves the result code. */
    setLevel(level: number): Promise<number>;
    /** Dispatcher.subscribe(0x01, 0xa1): resolves the result code (the SDK adds `callback` on result 0). */
    subscribe(callback: LogFeedCallback): Promise<number>;
    /** Dispatcher.unsubscribe(0x01, 0xa1): resolves the result code. */
    unsubscribe(callback: LogFeedCallback): Promise<number>;
}

/** What a read did to the log feed around itself - the evidence when no text arrives. */
export interface LogFeedReport {
    /** Luban's own subscription was live before the read: used as it is, nothing sent, nothing changed. */
    lubanSubscribed: boolean;
    /** Luban's connect had set the level (result 0), so the read did not. */
    lubanLevelSet: boolean;
    /** The read sent 0x01 0x10 (level 2); `levelResult` = the controller's answer, null = none. */
    levelSetByRead: boolean;
    levelResult: number | null;
    /** The controller accepted the read's own 0x01 0xa1 subscribe; `subscribeResult` null = no answer. */
    subscribedByRead: boolean;
    subscribeResult: number | null;
    /** The read's unsubscribe (null = not sent, or no answer). */
    unsubscribeResult: number | null;
    /** The subscription is as it was before the read (Luban's untouched, the read's own removed). */
    restored: boolean;
    /** false when the read set the level (it cannot be put back); null when the read did not set it. */
    levelRestored: boolean | null;
    notes: string[];
}

/** One SDK step with a bound: the SDK puts no timeout on a non-RTO request, and a failed send resolves undefined. */
async function boundedStep(run: () => Promise<number>, timeoutMs: number, what: string): Promise<{ result: number | null; error: string | null }> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
        const outcome = await Promise.race([
            run().then((result) => ({ result: typeof result === 'number' ? result : null, error: null as string | null })),
            new Promise<{ result: null; error: string }>((resolve) => {
                timer = setTimeout(() => resolve({ result: null, error: `${what}: no answer within ${timeoutMs} ms` }), timeoutMs);
            }),
        ]);
        return outcome.result === null && !outcome.error ? { result: null, error: `${what}: no result` } : outcome;
    } catch (err) {
        return { result: null, error: `${what}: ${err && (err as Error).message ? (err as Error).message : String(err)}` };
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

/**
 * Run a reply read with the log feed on. Luban's own subscription
 * (startHeartbeatLegacy) is used as it is when live - nothing is sent. When
 * it is not: set level 2 (only when Luban's connect did not), subscribe
 * 0x01 0xa1 with a placeholder callback (the Dispatcher only routes a
 * notification while a listener exists; the read collects with its own), run
 * the read, then - in `finally`, whatever the read did - unsubscribe and drop
 * the placeholder, unless Luban subscribed while the read ran (then only the
 * placeholder goes). Every SDK step is bounded. The level is set-only (no read
 * in the SDK or the Snapmaker-SACP docs, and no documented default), so a
 * level the read set stays at 2, the value Luban's own connect sets.
 */
export async function withLogFeed(input: {
    ops: LogFeedOps | null;
    luban: () => LubanLogFeed;
    stepTimeoutMs?: number;
    setupWaitMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}, read: (subscribedBefore: boolean | null) => Promise<GcodeReply>): Promise<GcodeReply> {
    const ops = input.ops;
    if (!ops) {
        return read(null);
    }
    const now = input.now || (() => Date.now());
    const sleep = input.sleep || (async (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const stepTimeoutMs = input.stepTimeoutMs || REPLY_TIMEOUT_MS_DEFAULT;
    const setupWaitMs = input.setupWaitMs === undefined ? LUBAN_LOG_SETUP_WAIT_MS : input.setupWaitMs;
    const report: LogFeedReport = {
        lubanSubscribed: false,
        lubanLevelSet: false,
        levelSetByRead: false,
        levelResult: null,
        subscribedByRead: false,
        subscribeResult: null,
        unsubscribeResult: null,
        restored: false,
        levelRestored: null,
        notes: [],
    };
    let luban = input.luban();
    while (luban.pending && luban.requestedAt !== null && now() - luban.requestedAt < setupWaitMs) {
        await sleep(Math.min(100, setupWaitMs - (now() - luban.requestedAt)));
        luban = input.luban();
    }
    if (luban.pending) {
        report.notes.push(`Luban's own log setup has not settled (level request sent ${luban.requestedAt === null ? '?' : now() - luban.requestedAt} ms ago)`);
    }
    const lubanOwnsFeed = () => {
        const callback = input.luban().callback;
        return !!callback && ops.listeners().includes(callback);
    };
    report.lubanSubscribed = lubanOwnsFeed();
    report.lubanLevelSet = luban.levelResult === 0;
    if (report.lubanSubscribed) {
        report.restored = true;
        return { ...await read(true), feed: report };
    }

    const placeholder: LogFeedCallback = () => undefined;
    let finished = false;
    let subscribeSent = false;
    let reply: GcodeReply;
    try {
        if (!report.lubanLevelSet) {
            report.levelSetByRead = true;
            const level = await boundedStep(async () => ops.setLevel(LOG_FEEDBACK_LEVEL), stepTimeoutMs, 'set log level');
            report.levelResult = level.result;
            if (level.error) {
                report.notes.push(level.error);
            }
        }
        subscribeSent = true;
        const subscribing = Promise.resolve().then(async () => ops.subscribe(placeholder));
        // A late ACK (after the bound) still makes the SDK add the placeholder: drop it then.
        subscribing.then(() => finished && ops.removeListener(placeholder), () => undefined);
        const subscribed = await boundedStep(async () => subscribing, stepTimeoutMs, 'subscribe log feed');
        report.subscribeResult = subscribed.result;
        report.subscribedByRead = subscribed.result === 0;
        if (subscribed.error) {
            report.notes.push(subscribed.error);
        }
        reply = await read(false);
    } finally {
        finished = true;
        // Undo a subscription the controller took - or may have taken (no answer).
        const mayBeSubscribed = subscribeSent && (report.subscribeResult === 0 || report.subscribeResult === null);
        if (!mayBeSubscribed) {
            report.restored = true;
        } else if (lubanOwnsFeed()) {
            report.restored = true;
            report.notes.push('Luban subscribed the log feed while the read ran: its subscription stays, only the read\'s listener was removed');
        } else {
            const unsubscribed = await boundedStep(async () => ops.unsubscribe(placeholder), stepTimeoutMs, 'unsubscribe log feed');
            report.unsubscribeResult = unsubscribed.result;
            report.restored = unsubscribed.result === 0;
            if (unsubscribed.error) {
                report.notes.push(unsubscribed.error);
            } else if (unsubscribed.result !== 0) {
                report.notes.push(`unsubscribe log feed: the controller answered result ${unsubscribed.result}`);
            }
        }
        ops.removeListener(placeholder);
        if (report.levelSetByRead) {
            report.levelRestored = false;
            report.notes.push(`log level left at ${LOG_FEEDBACK_LEVEL} (the level Luban's own connect sets): 0x01 0x10 is set-only and its default is undocumented`);
        }
    }
    return { ...reply, feed: report };
}
