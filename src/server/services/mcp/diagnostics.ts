import logger from '../../lib/logger';
import config from '../configstore';
import { connectionManager } from '../machine/ConnectionManager';
import { mcpBroadcast, mcpBroadcastLive } from './index';
import { isFrameFlip } from './machinePosition';
import { getPositionSnapshot, noteMachineDisconnected } from './tools/machine';

// Timing diagnostics for the sensor-gated motion engine.
//
// Why (2026-09-05, job 1db4902a4cd6): a surface scan's 0.1 mm fine steps took
// ~370 ms at the controller and ~100 ms of sensor window, yet one step in
// four sat idle for 1.3-2.1 s between the controller's reply and the next
// send - and the resumptions fell on a strict ~4 s grid. Every controller
// echo matched, so the engine's settle wait was NOT involved; something
// periodic held the server's timers (event-loop block or CPU starvation on
// the Celeron box). The server log could not say what. This module records
// the evidence the next run needs, as job events (so an agent reading
// get_gcode_job_status sees them in sequence with the gcode traffic) and as
// counters in get_mcp_diagnostics / the Settings API:
//   - event-loop stalls: a 100 ms ticker whose lateness beyond 250 ms is a
//     stall (`event_loop_stall`);
//   - heartbeat cadence (the WiFi status poll runs every 2 s with a 3 s
//     timeout - not the ~1 s the docs assumed), gaps (`heartbeat_gap`),
//     beats carrying no origin offset, and beats whose raw position jumped by
//     exactly the offset (`heartbeat_frame_flip`: a status poll that landed
//     inside a move's G53 window and reported machine coordinates);
//   - gcode timing per command (exec ms, idle ms since the previous reply -
//     stamped on the gcode events by tools/camera.ts) and slow steps;
//   - sensor pipe latency (GPIO monitor timestamp -> server receipt).
// None of this touches the machine. Costs: one 100 ms and one 250 ms timer.

const log = logger('service:mcp:diag');

const LOOP_TICK_MS = 100;
export const LOOP_STALL_MS = 250;
const HEARTBEAT_WATCH_MS = 250;
export const HEARTBEAT_GAP_MS = 4500;
// How many recent stalls / gaps / flips / slow idles each list keeps. Long
// jobs need more: configstore mcpDiagnosticsRecentLimit (Settings -> MCP
// Server) or LUBAN_MCP_DIAGNOSTICS_RECENT_LIMIT.
export const DEFAULT_RECENT_LIMIT = 40;
export const MIN_RECENT_LIMIT = 10;
export const MAX_RECENT_LIMIT = 10000;

export function diagnosticsRecentLimit(): number {
    const env = process.env.LUBAN_MCP_DIAGNOSTICS_RECENT_LIMIT;
    const raw = env !== undefined && String(env).trim() !== '' ? Number(env) : Number(config.get('mcpDiagnosticsRecentLimit'));
    if (!Number.isFinite(raw) || raw <= 0) {
        return DEFAULT_RECENT_LIMIT;
    }
    return Math.min(Math.max(Math.round(raw), MIN_RECENT_LIMIT), MAX_RECENT_LIMIT);
}

interface Stamp {
    at: number;
    ms: number;
    note?: string;
}

interface LoopStats {
    running: boolean;
    since: number | null;
    ticks: number;
    maxLagMs: number;
    stallCount: number;
    stallTotalMs: number;
    recentStalls: Stamp[];
}

interface HeartbeatStats {
    beats: number;
    lastAt: number | null;
    minIntervalMs: number | null;
    maxIntervalMs: number;
    meanIntervalMs: number | null;
    gapCount: number;
    recentGaps: Stamp[];
    missingOffsetBeats: number;
    zeroOffsetBeats: number;
    frameFlipBeats: number;
    recentFrameFlips: Stamp[];
}

interface GcodeStats {
    sent: number;
    execMaxMs: number;
    execMeanMs: number | null;
    slowIdleCount: number;
    recentSlowIdles: Stamp[];
}

interface SensorStats {
    stamped: number;
    pipeLatencyLastMs: number | null;
    pipeLatencyMaxMs: number;
    pipeLatencyMeanMs: number | null;
}

const loop: LoopStats = {
    running: false, since: null, ticks: 0, maxLagMs: 0, stallCount: 0, stallTotalMs: 0, recentStalls: [],
};
const heartbeat: HeartbeatStats = {
    beats: 0,
    lastAt: null,
    minIntervalMs: null,
    maxIntervalMs: 0,
    meanIntervalMs: null,
    gapCount: 0,
    recentGaps: [],
    missingOffsetBeats: 0,
    zeroOffsetBeats: 0,
    frameFlipBeats: 0,
    recentFrameFlips: [],
};
const gcode: GcodeStats = { sent: 0, execMaxMs: 0, execMeanMs: null, slowIdleCount: 0, recentSlowIdles: [] };
const sensor: SensorStats = { stamped: 0, pipeLatencyLastMs: null, pipeLatencyMaxMs: 0, pipeLatencyMeanMs: null };

let intervalSum = 0;
let execSum = 0;
let pipeSum = 0;
let loopTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let lastRaw: { x: number; y: number; z: number } | null = null;

function remember(list: Stamp[], stamp: Stamp): void {
    list.push(stamp);
    const limit = diagnosticsRecentLimit();
    if (list.length > limit) {
        list.splice(0, list.length - limit);
    }
}

function num(value: unknown): number | null {
    const n = Number(value);
    return value === undefined || value === null || value === '' || !Number.isFinite(n) ? null : n;
}

function startLoopMonitor(): void {
    let expected = Date.now() + LOOP_TICK_MS;
    loop.running = true;
    loop.since = Date.now();
    loopTimer = setInterval(() => {
        const now = Date.now();
        const lag = now - expected;
        expected = now + LOOP_TICK_MS;
        loop.ticks += 1;
        if (lag > loop.maxLagMs) {
            loop.maxLagMs = lag;
        }
        if (lag > LOOP_STALL_MS) {
            loop.stallCount += 1;
            loop.stallTotalMs += lag;
            remember(loop.recentStalls, { at: now, ms: lag });
            const note = `server timers ran ${lag} ms late (event loop blocked or process starved of CPU)`;
            log.warn(`event loop stall: ${note}`);
            mcpBroadcast('mcp:activity', { tool: 'diagnostics', phase: 'event_loop_stall', ms: lag, note });
        }
    }, LOOP_TICK_MS);
    loopTimer.unref();
}

/**
 * Publish the judged position of record once per beat for the Workspace
 * console (and, later, a DRO): the same machine value and reliability the
 * motion guards use, so the operator and the agent read ONE position.
 */
function publishPosition(): void {
    try {
        const snapshot = getPositionSnapshot();
        mcpBroadcastLive('mcp:position', {
            machine: snapshot.machine,
            reliability: snapshot.reliability,
            frame: snapshot.frame,
            b: snapshot.b,
            reportedAt: snapshot.reportedAt,
            machineReportedAt: snapshot.machineReportedAt,
            rejectedReason: snapshot.judged.rejectedReason,
            derived: snapshot.judged.accepted ? undefined : snapshot.judged.derived,
        });
    } catch (err) {
        // Not connected / no heartbeat: nothing to publish.
    }
}

function watchHeartbeat(): void {
    const state = connectionManager.getLatestMachineState() as {
        timestamp?: number;
        pos?: { x?: unknown; y?: unknown; z?: unknown };
        originOffset?: { x?: unknown; y?: unknown; z?: unknown };
    } | null;
    if (!state) {
        // Channel closed (or not connected yet): the position of record must
        // not carry the previous connection's offsets into the next one.
        noteMachineDisconnected();
        lastRaw = null;
        return;
    }
    if (!state.timestamp || state.timestamp === heartbeat.lastAt) {
        return;
    }
    const at = state.timestamp;
    if (heartbeat.lastAt !== null) {
        const interval = at - heartbeat.lastAt;
        heartbeat.beats += 1;
        intervalSum += interval;
        heartbeat.meanIntervalMs = Math.round(intervalSum / heartbeat.beats);
        heartbeat.minIntervalMs = heartbeat.minIntervalMs === null ? interval : Math.min(heartbeat.minIntervalMs, interval);
        heartbeat.maxIntervalMs = Math.max(heartbeat.maxIntervalMs, interval);
        if (interval > HEARTBEAT_GAP_MS) {
            heartbeat.gapCount += 1;
            remember(heartbeat.recentGaps, { at, ms: interval });
            const note = `${(interval / 1000).toFixed(1)} s between machine status reports (poll period 2 s)`;
            log.warn(`heartbeat gap: ${note}`);
            mcpBroadcast('mcp:activity', { tool: 'diagnostics', phase: 'heartbeat_gap', ms: interval, note });
        }
    } else {
        heartbeat.beats = 1;
    }
    heartbeat.lastAt = at;

    const pos = state.pos || {};
    const off = state.originOffset || {};
    const raw = { x: num(pos.x), y: num(pos.y), z: num(pos.z) };
    const offset = { x: num(off.x), y: num(off.y), z: num(off.z) };
    if (offset.x === null || offset.y === null || offset.z === null) {
        heartbeat.missingOffsetBeats += 1;
    } else if (offset.x === 0 && offset.y === 0 && offset.z === 0) {
        // G53-window signature #2 (job 70b2b8c675a6): offsets read 0,0,0
        // with pos in machine coordinates. Counted here; getPositionSnapshot
        // sets such a beat aside (positionOfRecord.judgeOffsetReport).
        heartbeat.zeroOffsetBeats += 1;
    }
    if (raw.x !== null && raw.y !== null && raw.z !== null) {
        if (lastRaw && offset.x !== null && offset.y !== null && offset.z !== null) {
            // The frame-flip signature (machinePosition.isFrameFlip): the same
            // test the position of record uses to REJECT the beat.
            const flipped = isFrameFlip(
                { x: raw.x, y: raw.y, z: raw.z },
                lastRaw,
                { x: offset.x as number, y: offset.y as number, z: offset.z as number }
            );
            if (flipped) {
                heartbeat.frameFlipBeats += 1;
                const note = `status report jumped by the origin offset: raw (${raw.x}, ${raw.y}, ${raw.z}) after `
                    + `(${lastRaw.x}, ${lastRaw.y}, ${lastRaw.z}) with offset (${offset.x}, ${offset.y}, ${offset.z}) - a poll `
                    + 'inside a G53 window reporting machine coordinates, or the return from one';
                remember(heartbeat.recentFrameFlips, { at, ms: 0, note });
                log.info(`heartbeat frame flip: ${note}`);
                mcpBroadcast('mcp:activity', { tool: 'diagnostics', phase: 'heartbeat_frame_flip', note });
            }
        }
        lastRaw = { x: raw.x, y: raw.y, z: raw.z };
    }
    publishPosition();
}

/** Called by sendGcodeVisible for every direct command. */
export function recordGcodeTiming(tool: string, execMs: number, idleMs: number | null, slowIdle: boolean): void {
    gcode.sent += 1;
    execSum += execMs;
    gcode.execMeanMs = Math.round(execSum / gcode.sent);
    gcode.execMaxMs = Math.max(gcode.execMaxMs, execMs);
    if (slowIdle && idleMs !== null) {
        gcode.slowIdleCount += 1;
        remember(gcode.recentSlowIdles, { at: Date.now(), ms: idleMs, note: tool });
    }
}

/** Called by the GPIO transport for every reading the monitor timestamped. */
export function recordSensorLatency(ms: number): void {
    sensor.stamped += 1;
    pipeSum += ms;
    sensor.pipeLatencyLastMs = ms;
    sensor.pipeLatencyMaxMs = Math.max(sensor.pipeLatencyMaxMs, ms);
    sensor.pipeLatencyMeanMs = Math.round(pipeSum / sensor.stamped);
}

export function startDiagnostics(): void {
    if (loopTimer) {
        return;
    }
    startLoopMonitor();
    heartbeatTimer = setInterval(watchHeartbeat, HEARTBEAT_WATCH_MS);
    heartbeatTimer.unref();
}

export function stopDiagnostics(): void {
    if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
    }
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    loop.running = false;
}

export function diagnosticsSnapshot() {
    return {
        eventLoop: { ...loop, stallThresholdMs: LOOP_STALL_MS, tickMs: LOOP_TICK_MS },
        heartbeat: { ...heartbeat, gapThresholdMs: HEARTBEAT_GAP_MS, pollPeriodMs: 2000 },
        gcode: { ...gcode },
        sensor: { ...sensor },
        buffers: {
            recentLimit: diagnosticsRecentLimit(),
            recentLimitRange: [MIN_RECENT_LIMIT, MAX_RECENT_LIMIT],
            note: 'Settings -> MCP Server (mcpDiagnosticsRecentLimit / LUBAN_MCP_DIAGNOSTICS_RECENT_LIMIT); the job event '
                + 'log cap is mcpJobEventLimit / LUBAN_MCP_JOB_EVENT_LIMIT (default 2000, 200000 with spindle telemetry on, '
                + 'max 1000000); dense spindle telemetry lives in per-job typed-array rings (get_job_telemetry), not events.',
        },
        note: 'Job events carry the same signals in sequence with the gcode traffic: event_loop_stall, '
            + 'heartbeat_gap, heartbeat_frame_flip, slow_step, sense_overrun, position-estimated; gcode events '
            + 'carry execMs (send -> controller reply) and idleMs (previous reply -> this send).',
    };
}
