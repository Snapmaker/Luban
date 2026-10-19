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
// Settled for the Ray V1.7.4 (live read 2026-10-19 and Snapmaker/RayController
// 91a675f): NEITHER route carries text there - the ACK is the result byte
// alone, and the firmware has no log feed (0x01 0x10 -> E_INVALID_CMD_ID).
// tools/firmware.ts therefore sends no query to a GRBL machine over SACP;
// this read remains for controllers that do answer.
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
 * Dispatcher, added and removed here - never subscribe/unsubscribe, which
 * would send 0x01 0x00 / 0x01 0x01 to the controller and (unsubscribe) tear
 * down Luban's own log subscription. `send` resolves with the SDK's
 * `{ response }` for the 0x01 0x02 request.
 */
export async function readGcodeReply(input: {
    emitter: ReplyEmitter | null;
    send: () => Promise<{ response: { result: number; data?: Buffer } } | undefined>;
    timeoutMs?: number;
    quietMs?: number;
    now?: () => number;
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
    const subscribed = emitter && typeof emitter.listenerCount === 'function' ? emitter.listenerCount(event) > 0 : null;
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
