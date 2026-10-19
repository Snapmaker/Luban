// Firmware reads for the connected machine (tyeth/Luban#265 follow-up: the
// Ray's GRBL configuration). The queries, allow-list and parsers are pure
// (firmwareQuery.ts); this is the runtime: sending one allow-listed query at a
// time over the channel's reply path (SACP: SacpChannelBase.executeGcodeWithReply,
// sacpGcodeReply.ts), keeping what was read IN MEMORY for the current
// connection only, and the first-connect read.
//
// Operator rule (2026-10-19): firmware values are NOT persisted - a stored
// acceleration from last month is worse than none. They are read once when a
// connection becomes ready (GRBL dialects only, in the background, only while
// the machine is idle with no MCP job), re-read on demand by
// query_firmware_configuration, and dropped when the connection generation
// changes. The one thing that outlives the read is identity: an M1005 product
// SN becomes the connection's deviceSerial when the SACP serial was a fill
// pattern (ConnectionManager.adoptFirmwareSerial), and the per-machine store
// records it as a device alias like any serial.
//
// Marlin dialects (the A350) are untouched: no first-connect read, and
// query_firmware_configuration / query_firmware_position keep M503 S / M114
// exactly as before (tools/camera.ts).

import logger from '../../../lib/logger';
import { connectionManager } from '../../machine/ConnectionManager';
import { GcodeReply } from '../../machine/channels/sacpGcodeReply';
import { mcpBroadcast } from '../index';
import { jobManager } from '../jobs';
import { connectedDialect, connectedMachineTag } from '../connectedMachine';
import { GcodeDialect } from '../gcodeDialect';
import {
    FirmwareValues,
    GrblBuildInfoView,
    GrblOffsets,
    GrblParserState,
    GrblSetting,
    GrblStatusReport,
    configurationQueriesFor,
    firmwareQueryRefusal,
    firmwareValuesFrom,
    laserAccelerationFrom,
    parseGrblBuildInfo,
    parseGrblOffsets,
    parseGrblParserState,
    parseGrblSettings,
    parseGrblStatus,
    parseM1005Serial,
} from '../firmwareQuery';
import { FIRMWARE_QUERY_TIMEOUT_MS, FIRMWARE_REPLY_QUIET_MS, FIRST_CONNECT_READ_WAIT_MS, clampTo } from '../procedureLimits';
import { McpToolError } from '../registry';

const log = logger('service:mcp:firmware');

/** The channel surface a firmware query uses: the SACP reply read, else plain executeGcode (text channels return the reply). */
export interface FirmwareChannel {
    executeGcode?: (gcode: string) => Promise<{ result: number; text?: string }>;
    executeGcodeWithReply?: (gcode: string, options: { timeoutMs?: number; quietMs?: number }) => Promise<GcodeReply>;
}

export interface QueryReply {
    query: string;
    /** 0 = acknowledged; -1 = refused, failed or timed out. */
    result: number;
    text: string | null;
    /** Where the text came from: the SACP ACK payload, the SACP log feedback, or a text channel's reply. */
    source: 'ack-payload' | 'log-feedback' | 'channel-text' | null;
    readAt: number;
    elapsedMs: number;
    timedOut: boolean;
    /** SACP only: what the read saw, so "no text" can be told apart from "nothing pushes a log". */
    sacp: { ackDataBytes: number; ackHex: string | null; logListening: boolean; logSubscribed: boolean | null; logLines: number } | null;
    error: string | null;
}

export interface FirmwareRecord {
    generation: string;
    machineIdentifier: string | null;
    dialect: string;
    trigger: 'first-connect' | 'on-demand';
    /** Latest reply per query string. */
    replies: { [query: string]: QueryReply };
}

let record: FirmwareRecord | null = null;

function connectionGeneration(): string | null {
    const manager = connectionManager as unknown as {
        getConnectionGeneration?: () => string;
        getConnectionStatus?: () => { connected?: boolean; machineIdentifier?: string | null };
    };
    if (typeof manager.getConnectionGeneration !== 'function' || typeof manager.getConnectionStatus !== 'function') {
        return null;
    }
    try {
        return manager.getConnectionStatus().connected ? manager.getConnectionGeneration() : null;
    } catch (err) {
        return null;
    }
}

/** The record for the CURRENT connection, or null (nothing read yet, or read on a connection that has since gone). */
export function currentFirmwareRecord(): FirmwareRecord | null {
    const generation = connectionGeneration();
    return record && generation !== null && record.generation === generation ? record : null;
}

/** Test seam: replace or clear the in-memory record. */
export function setFirmwareRecordForTest(next: FirmwareRecord | null): void {
    record = next;
}

export interface FirmwareParsed {
    settings: { [key: string]: GrblSetting } | null;
    values: FirmwareValues | null;
    offsets: GrblOffsets | null;
    parserState: GrblParserState | null;
    buildInfo: GrblBuildInfoView | null;
    m1005Serial: string | null;
}

/** Everything parsed from a record's replies (each part null when its query has not returned text). */
export function parseFirmwareRecord(current: FirmwareRecord | null): FirmwareParsed {
    const text = (query: string) => (current && current.replies[query] ? current.replies[query].text : null);
    const settingsText = text('$$');
    const settings = settingsText ? parseGrblSettings(settingsText) : null;
    const hasSettings = !!settings && Object.keys(settings).length > 0;
    const offsetsText = text('$#');
    const offsets = offsetsText ? parseGrblOffsets(offsetsText) : null;
    const buildText = text('$I');
    return {
        settings: hasSettings ? settings : null,
        values: hasSettings && settings ? firmwareValuesFrom(settings) : null,
        offsets: offsets && Object.keys(offsets).length ? offsets : null,
        parserState: parseGrblParserState(text('$G')),
        buildInfo: buildText ? parseGrblBuildInfo(buildText) : null,
        m1005Serial: parseM1005Serial(text('M1005')),
    };
}

/** When the M4 rule may use a read acceleration: this connection's $120/$121, else null (the rule states its assumption). */
export function currentLaserAcceleration(): { value: number; source: string; readAt: number } | null {
    const current = currentFirmwareRecord();
    const parsed = parseFirmwareRecord(current);
    const acceleration = laserAccelerationFrom(parsed.values);
    if (!acceleration || !current) {
        return null;
    }
    const readAt = current.replies.$$.readAt;
    return {
        value: acceleration.value,
        source: `firmware $$ ${acceleration.settings.join('/')} (the lower), read ${new Date(readAt).toISOString()} on this connection`,
        readAt,
    };
}

/**
 * The `firmware` block of get_machine_profile / get_connection_status: what
 * this connection read, when, from which queries; null when nothing was read.
 * `raw` (every reply's text) only when asked - query_firmware_configuration.
 */
export function firmwareView(options: { raw?: boolean } = {}) {
    const current = currentFirmwareRecord();
    if (!current) {
        return null;
    }
    const parsed = parseFirmwareRecord(current);
    const replies = Object.values(current.replies);
    const answered = replies.filter((r) => r.text);
    const readAt = replies.length ? Math.max(...replies.map((r) => r.readAt)) : null;
    const acceleration = currentLaserAcceleration();
    return {
        readAt: readAt !== null ? new Date(readAt).toISOString() : null,
        trigger: current.trigger,
        source: answered.length ? answered.map((r) => r.query).join(' ') : null,
        replyRoute: answered.length ? Array.from(new Set(answered.map((r) => r.source))).join(', ') : null,
        values: parsed.values,
        laserAcceleration: acceleration ? { value: acceleration.value, unit: 'mm/s^2', source: acceleration.source } : null,
        m1005Serial: parsed.m1005Serial,
        parserState: parsed.parserState ? { modes: parsed.parserState.modes, workspace: parsed.parserState.workspace } : null,
        buildInfo: parsed.buildInfo ? { version: parsed.buildInfo.version, options: parsed.buildInfo.options } : null,
        queries: replies.map((r) => ({ query: r.query, result: r.result, hasText: !!r.text, source: r.source, error: r.error })),
        note: 'Read from the controller on THIS connection and kept in memory only (never stored): it is dropped on '
            + 'disconnect. query_firmware_configuration re-reads it.',
        ...(options.raw ? { raw: replies.reduce((all: { [query: string]: string | null }, r) => ({ ...all, [r.query]: r.text }), {}) } : {}),
    };
}

function noTextNote(reply: QueryReply): string {
    if (!reply.sacp) {
        return 'the channel returned no reply text';
    }
    const { sacp } = reply;
    return `SACP ACK result ${reply.result} with ${sacp.ackDataBytes} payload byte(s) after the result`
        + `${sacp.ackHex ? ` (hex ${sacp.ackHex})` : ''}; log feedback ${sacp.logSubscribed === false
            ? 'is NOT subscribed on this connection'
            : `${sacp.logLines} line(s) during the read${sacp.logSubscribed === null ? '' : ' (subscribed)'}`}`;
}

/**
 * Send ONE allow-listed query and return its reply. Mirrors the query and
 * the reply to the UI console and the server log (like every MCP send), but
 * it is read-only: no gcode sequence bump, no modal ledger entry.
 */
export async function sendFirmwareQuery(channel: FirmwareChannel, tool: string, dialect: GcodeDialect, query: string,
    options: { timeoutMs?: number; quietMs?: number } = {}): Promise<QueryReply> {
    const refusal = firmwareQueryRefusal(dialect, query);
    if (refusal) {
        throw new McpToolError(`${refusal} ${connectedMachineTag()}`);
    }
    const line = query.trim();
    const timeoutMs = clampTo(options.timeoutMs, FIRMWARE_QUERY_TIMEOUT_MS);
    const quietMs = clampTo(options.quietMs, FIRMWARE_REPLY_QUIET_MS);
    mcpBroadcast('mcp:gcode', { tool, gcode: line });
    log.info(`[${tool}] > ${line}`);
    const started = Date.now();
    let reply: QueryReply;
    if (typeof channel.executeGcodeWithReply === 'function') {
        const read = await channel.executeGcodeWithReply(line, { timeoutMs, quietMs });
        reply = {
            query: line,
            result: read.result,
            text: read.text,
            source: read.source,
            readAt: Date.now(),
            elapsedMs: read.elapsedMs,
            timedOut: read.timedOut,
            sacp: {
                ackDataBytes: read.ack.bytes,
                ackHex: read.ack.hex,
                logListening: read.log.listening,
                logSubscribed: read.log.subscribed,
                logLines: read.log.lines.length,
            },
            error: read.error || null,
        };
    } else if (typeof channel.executeGcode === 'function') {
        let timer: NodeJS.Timeout | null = null;
        const timeout = new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), timeoutMs);
        });
        const executed = await Promise.race([channel.executeGcode(line), timeout]);
        if (timer) {
            clearTimeout(timer);
        }
        const text = executed && executed.text && executed.text.trim() && !/^ok\s*$/i.test(executed.text.trim()) ? executed.text : null;
        reply = {
            query: line,
            result: executed ? executed.result : -1,
            text,
            source: text ? 'channel-text' : null,
            readAt: Date.now(),
            elapsedMs: Date.now() - started,
            timedOut: !executed,
            sacp: null,
            error: executed ? null : `no reply within ${timeoutMs} ms`,
        };
    } else {
        throw new McpToolError('No machine connected, or the channel does not support direct commands.');
    }
    const untext = reply.result === 0 ? `ok (no text: ${noTextNote(reply)})` : `failed: ${reply.error}`;
    const shown = reply.text ? reply.text.replace(/\r?\n/g, ' | ') : untext;
    mcpBroadcast('mcp:gcode', { tool, response: reply.text || (reply.result === 0 ? 'ok' : `result=${reply.result}`), execMs: reply.elapsedMs });
    log.info(`[${tool}] < ${shown.slice(0, 400)} (${reply.elapsedMs} ms${reply.source ? `, via ${reply.source}` : ''})`);
    return reply;
}

/** null when a firmware read may run now, else why not (an MCP job, or a machine that is not idle). */
export function firmwareReadBlocker(): string | null {
    if (jobManager.getActive()) {
        return 'an MCP G-code job is active; the firmware is read only between jobs';
    }
    const state = connectionManager.getLatestMachineState() as { status?: unknown } | null;
    const status = state && typeof state.status === 'string' ? state.status.toLowerCase() : null;
    if (status && status !== 'idle') {
        return `the machine reports status "${status}"; GRBL answers $$ / $# only while idle, so nothing is sent mid-job`;
    }
    return null;
}

/**
 * Read the configuration queries of the connected GRBL machine (or `queries`,
 * each checked against the allow-list), one at a time, and keep the replies
 * as this connection's record. Adopts an M1005 product SN as the connection's
 * deviceSerial when the SACP serial was absent (a fill pattern).
 */
export async function readFirmwareConfiguration(input: {
    tool: string;
    trigger: FirmwareRecord['trigger'];
    queries?: string[];
    timeoutMs?: number;
    quietMs?: number;
}): Promise<{ record: FirmwareRecord; replies: QueryReply[]; serialAdopted: boolean }> {
    const dialect = connectedDialect();
    const channel = connectionManager.getCurrentChannel() as unknown as FirmwareChannel | null;
    const generation = connectionGeneration();
    if (!channel || generation === null) {
        throw new McpToolError('No machine connected.');
    }
    const queries = input.queries && input.queries.length ? input.queries : configurationQueriesFor(dialect);
    for (const query of queries) {
        const refusal = firmwareQueryRefusal(dialect, query);
        if (refusal) {
            throw new McpToolError(`${refusal} Nothing was sent. ${connectedMachineTag()}`);
        }
    }
    const replies: QueryReply[] = [];
    for (const query of queries) {
        replies.push(await sendFirmwareQuery(channel, input.tool, dialect, query, { timeoutMs: input.timeoutMs, quietMs: input.quietMs }));
        if (connectionGeneration() !== generation) {
            throw new McpToolError('The connection changed during the firmware read; nothing read is kept. Read again.');
        }
    }
    const status = connectionManager.getConnectionStatus() as { machineIdentifier?: string | null };
    const base: FirmwareRecord = record && record.generation === generation
        ? record
        : { generation, machineIdentifier: status.machineIdentifier || null, dialect: dialect.id, trigger: input.trigger, replies: {} };
    const next: FirmwareRecord = { ...base, trigger: input.trigger, replies: { ...base.replies } };
    for (const reply of replies) {
        next.replies[reply.query] = reply;
    }
    record = next;
    let serialAdopted = false;
    const serial = parseFirmwareRecord(next).m1005Serial;
    const manager = connectionManager as unknown as { adoptFirmwareSerial?: (sn: string, generation: string) => boolean };
    if (serial && typeof manager.adoptFirmwareSerial === 'function') {
        serialAdopted = manager.adoptFirmwareSerial(serial, generation);
    }
    return { record: next, replies, serialAdopted };
}

/** One info line: what a read got (for the first-connect log). */
export function describeFirmwareRead(replies: QueryReply[]): string {
    const parsed = parseFirmwareRecord(currentFirmwareRecord());
    const answered = replies.filter((r) => r.text);
    if (!answered.length) {
        const first = replies[0];
        return `no reply text for ${replies.map((r) => r.query).join(' ')}${first ? ` (${noTextNote(first)})` : ''}`;
    }
    const values = parsed.values;
    const parts = [
        `${answered.map((r) => r.query).join(' ')} answered via ${Array.from(new Set(answered.map((r) => r.source))).join('/')}`,
        parsed.settings ? `${Object.keys(parsed.settings).length} settings` : null,
        values && values.acceleration.x ? `accel X ${values.acceleration.x.value}` : null,
        values && values.acceleration.y ? `accel Y ${values.acceleration.y.value}` : null,
        values && values.sMax ? `S max ${values.sMax.value}` : null,
        parsed.buildInfo && parsed.buildInfo.version ? `VER ${parsed.buildInfo.version}` : null,
        parsed.m1005Serial ? `SN ${parsed.m1005Serial}` : null,
    ];
    return parts.filter(Boolean).join(', ');
}

/** The GRBL position query (`?`): never M114 on GRBL. Throws (naming the machine) when no status text comes back. */
export async function queryGrblPosition(tool: string): Promise<{ reply: QueryReply; status: GrblStatusReport }> {
    const dialect = connectedDialect();
    const channel = connectionManager.getCurrentChannel() as unknown as FirmwareChannel | null;
    if (!channel) {
        throw new McpToolError('No machine connected, or the channel does not support direct commands.');
    }
    // Known not to return text on this connection: do not send `?` at all.
    const current = currentFirmwareRecord();
    const seen = current ? Object.values(current.replies) : [];
    if (seen.length && seen.every((r) => r.result === 0 && !r.text)) {
        throw new McpToolError(`${dialect.label} has no M114 (its status query is GRBL "?"), and on this connection the `
            + `firmware's reply text does not come back (${noTextNote(seen[0])} - every firmware query read so far was `
            + 'acknowledged without text), so "?" would return nothing either: nothing was sent. Use get_position (the SACP '
            + `coordinate subscription, the same source as the Luban UI). ${connectedMachineTag()}`);
    }
    const reply = await sendFirmwareQuery(channel, tool, dialect, '?');
    const status = parseGrblStatus(reply.text);
    if (!status) {
        throw new McpToolError(`${dialect.label}: "?" returned no GRBL status report (${reply.text ? `text: ${JSON.stringify(reply.text.slice(0, 200))}`
            : noTextNote(reply)}). M114 is not sent to a GRBL machine. Use get_position. ${connectedMachineTag()}`);
    }
    return { reply, status };
}

/**
 * First-connect read: when a GRBL connection becomes ready, read its
 * configuration once in the background - after the first heartbeat shows it
 * idle with no MCP job, never otherwise - and log one line with what came
 * back. Nothing here throws into the connection.
 */
async function firstConnectRead(ready: { generation: string; machineIdentifier: string | null }): Promise<void> {
    record = null;
    const dialect = connectedDialect();
    if (dialect.family !== 'grbl') {
        return;
    }
    const deadline = Date.now() + FIRST_CONNECT_READ_WAIT_MS;
    while (!connectionManager.getLatestMachineState() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (connectionGeneration() !== ready.generation) {
        return;
    }
    if (!connectionManager.getLatestMachineState()) {
        log.info(`first-connect firmware read on ${ready.machineIdentifier}: skipped, no heartbeat within ${FIRST_CONNECT_READ_WAIT_MS} ms`);
        return;
    }
    const blocker = firmwareReadBlocker();
    if (blocker) {
        log.info(`first-connect firmware read on ${ready.machineIdentifier}: skipped, ${blocker}`);
        return;
    }
    try {
        const { replies, serialAdopted } = await readFirmwareConfiguration({ tool: 'first-connect firmware read', trigger: 'first-connect' });
        log.info(`first-connect firmware read on ${ready.machineIdentifier} (${dialect.id}): ${describeFirmwareRead(replies)}`
            + `${serialAdopted ? '; deviceSerial set from M1005' : ''}`);
    } catch (err) {
        log.info(`first-connect firmware read on ${ready.machineIdentifier}: failed, ${(err as Error).message}`);
    }
}

let unregister: (() => void) | null = null;

/** Register the first-connect read with the connection manager (once; absent in the inert test stub). */
export function startFirmwareReadOnConnect(): void {
    const manager = connectionManager as unknown as {
        onMachineReady?: (listener: (ready: { generation: string; machineIdentifier: string | null }) => void) => () => void;
    };
    if (unregister || typeof manager.onMachineReady !== 'function') {
        return;
    }
    unregister = manager.onMachineReady((ready) => {
        firstConnectRead(ready).catch((err) => log.warn(`first-connect firmware read: ${(err as Error).message}`));
    });
}
