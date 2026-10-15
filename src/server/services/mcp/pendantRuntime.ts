import crypto from 'crypto';
import http from 'http';
import { SerialPort } from 'serialport';

import logger from '../../lib/logger';
import { connectionManager } from '../machine/ConnectionManager';
import { clearanceOptions } from './clearanceContext';
import { OBSTACLE_MARGIN_MM, POSITION_EPSILON_MM, isStraightZUp, segmentHitsBox2D } from './envelopeChecks';
import { jobManager } from './jobs';
import { landmarkStore } from './landmarks';
import { requiredToolheadZ } from './landmarkClearance';
import { manualControlGate } from './manualControl';
import { isLoopback } from './McpServer';
import { JogBounds, JogPosition, PendantSession, parsePendantInput, validateJogBounds } from './pendant';
import { pendantPage } from './pendantPage';
import { pendantPosition } from './pendantPosition';
import { pendantSettings, updatePendantSettings } from './pendantSettings';
import { currentGcodeSequence, getPositionOfRecord, getTrustedOffset } from './positionOfRecord';
import { probeFeedService } from './probeFeed';
import { assertMachineReadyForProcedure, moveMachineSettled } from './probing';
import { homeMachine, sendWorkFrameRestore } from './tools/camera';
import { HEARTBEAT_STALE_MS, connectionEpoch, getMachineSizeByIdentifier, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

const log = logger('service:mcp:pendant');

// LUBAN_PENDANT_TRACE=1 logs every USB line in both directions (about 30 lines/s) for debugging.
// Off by default; watch it on the console that launched Luban or in the server log.
const traceEnabled = (): boolean => typeof process !== 'undefined' && /^(1|true|on|yes)$/i.test(process.env?.LUBAN_PENDANT_TRACE || '');
const trace = (message: string): void => { if (traceEnabled()) { log.info(`[trace] ${message}`); } };
const PORT_LIST_CACHE_MS = 2000;
// A shortened approach stops this far outside an obstacle (XY and Z), so heartbeat noise
// cannot report the held toolhead inside the exclusion it was stopped against.
const APPROACH_PAD_XY_MM = 0.5;
const APPROACH_PAD_Z_MM = 0.1;
const MIN_APPROACH_MM = 0.1;
// Displayed heights never understate the requirement: required Z rounds up, asked Z down.
const zUp = (z: number): string => String(Number((Math.ceil(z * 100 - 1e-6) / 100).toFixed(2)));
const zDown = (z: number): string => String(Number((Math.floor(z * 100 + 1e-6) / 100).toFixed(2)));

interface ObstacleExclusion {
    name: string;
    machine: { x0: number; x1: number; y0: number; y1: number };
    requiredZ: number | null;
}

type JogTarget = { position: JogPosition; feed: number; durationMs: number; distanceMm: number };

/**
 * An obstacle that is holding (nothing sent) or limiting (part of the intent sent) the stick,
 * or, with `inside`, that the toolhead is already inside below its required Z (Z-up only).
 */
export interface PendantBlocked {
    name: string;
    requiredZ: number | null;
    requestedZ: number;
    held: boolean;
    inside: boolean;
    text: string;
}

export class PendantRuntime {
    private session = new PendantSession();

    private port: SerialPort | null = null;

    private buffer = '';

    private busy = false;

    private recovery: string | null = null;

    private nextJog: ReturnType<typeof setImmediate> | null = null;

    private lastJog: { durationMs: number; distanceMm: number; feed: number; elapsedMs: number } | null = null;

    private commandOverheadMs = 500;

    private feedbackHealthy: boolean | null = null;

    private feedbackWritePending = false;

    private owned = false;

    private opening = false;

    private pageAliveAt = 0;

    private lastPorts: Array<{ path: string; serialNumber?: string }> = [];

    private portsAt = 0;

    private portsPending: Promise<Array<{ path: string; serialNumber?: string }>> | null = null;

    // undefined until the first frame of a connection, so a pre-fw board (null) still logs once.
    private firmware: string | null | undefined = undefined;

    private blocked: PendantBlocked | null = null;

    private blockedLogged = new Set<string>();

    private timer: ReturnType<typeof setInterval> | null = null;

    private error: string | null = null;

    private token = crypto.randomBytes(32).toString('hex');

    private epoch: number | null = null;

    private position(): JogPosition {
        const p = getPositionSnapshot();
        if (!p.machine || !['x', 'y', 'z'].every((a) => Number.isFinite(p.machine[a as keyof JogPosition]))) {
            throw new Error('Complete, reliable machine XYZ is required.');
        }
        return p.machine as JogPosition;
    }

    private machineEpoch(): number | null {
        return connectionEpoch();
    }

    private ready(): void {
        assertMachineReadyForProcedure();
        probeFeedService.assertNoOvertravel();
        const record = getPositionOfRecord(currentGcodeSequence());
        const p = getPositionSnapshot();
        const warnings = this.session.armed ? pendantPosition(p, record, getTrustedOffset(), Date.now(), HEARTBEAT_STALE_MS).warnings : p.warnings;
        if (warnings.length) { throw new Error(`Machine position unavailable: ${warnings.join(' ')}`); }
        if (record && record.source === 'estimated') { throw new Error('Last move was only estimated; wait for a verified position.'); }
        if (jobManager.getActive()?.state === 'started') { throw new Error('A machine job is active.'); }
    }

    private travelBounds(): JogBounds {
        const travel = requirePlanningTravel('manual jogging', this.position());
        if (travel.conflicts.length) { throw new Error('Machine travel has unresolved conflicts.'); }
        const size = getMachineSizeByIdentifier(connectionManager.getConnectionStatus().machineIdentifier);
        if (!size) { throw new Error('Machine travel is unknown.'); }
        // Match stagingFrameContext: A350 profile Z325 excludes its reachable Z328 park.
        return { ...travel.limits, zMin: 0, zMax: Math.max(size.z, safeTraverseZ()) };
    }

    private reviewedBounds(requested: JogBounds): JogBounds {
        validateJogBounds(requested, this.position());
        const travel = this.travelBounds();
        const bounds = { ...requested };
        for (const axis of ['x', 'y', 'z'] as const) {
            bounds[`${axis}Min`] = Math.max(requested[`${axis}Min`], travel[`${axis}Min`]);
            bounds[`${axis}Max`] = Math.min(requested[`${axis}Max`], travel[`${axis}Max`]);
        }
        this.validateEnvelope(bounds);
        return bounds;
    }

    private validateEnvelope(bounds: JogBounds): void {
        const current = this.position();
        validateJogBounds(bounds, current);
        const travel = this.travelBounds();
        for (const axis of ['x', 'y', 'z'] as const) {
            if (bounds[`${axis}Min`] < travel[`${axis}Min`] || bounds[`${axis}Max`] > travel[`${axis}Max`]) {
                throw new Error(`Machine ${axis.toUpperCase()} bounds must stay within ${travel[`${axis}Min`]}..${travel[`${axis}Max`]} mm.`);
            }
        }
    }

    private obstacleExclusions(): ObstacleExclusion[] {
        const opts = clearanceOptions();
        return landmarkStore.obstacleBoxes().map((box) => ({
            name: box.name,
            machine: {
                x0: Math.min(box.machine.x0, box.machine.x1) - OBSTACLE_MARGIN_MM,
                x1: Math.max(box.machine.x0, box.machine.x1) + OBSTACLE_MARGIN_MM,
                y0: Math.min(box.machine.y0, box.machine.y1) - OBSTACLE_MARGIN_MM,
                y1: Math.max(box.machine.y0, box.machine.y1) + OBSTACLE_MARGIN_MM,
            },
            requiredZ: requiredToolheadZ(box.clearanceZ, box.clearanceBasis || 'toolhead',
                opts.toolProtrusionMm, opts.clearanceMarginMm),
        }));
    }

    // Manual jogs get no probing exemption: check the complete segment, including
    // Z-only descents and moves wholly inside a landmark footprint. The one exception is
    // a straight Z-up exit (isStraightZUp), which climbs away from anything beneath.
    // obstacleHit(p, p) is the point check: is p inside an exclusion below its required Z?
    // With `approach`, each box whose padded volume does not already contain `from` is
    // widened by APPROACH_PAD_XY_MM and raised by APPROACH_PAD_Z_MM, so a hold stops short
    // of the exclusion. Only validateJogSegment uses the exact (unpadded) test.
    private obstacleHit(from: JogPosition, to: JogPosition, boxes: ObstacleExclusion[], approach = false): ObstacleExclusion | null {
        if (isStraightZUp(from, to)) { return null; }
        const below = (box: ObstacleExclusion, z: number, padZ: number) => box.requiredZ === null
            || z < box.requiredZ + padZ - POSITION_EPSILON_MM;
        for (const box of boxes) {
            const padded = approach && !(segmentHitsBox2D(from.x, from.y, from.x, from.y, box.machine, APPROACH_PAD_XY_MM)
                && below(box, from.z, APPROACH_PAD_Z_MM));
            if (segmentHitsBox2D(from.x, from.y, to.x, to.y, box.machine, padded ? APPROACH_PAD_XY_MM : 0)
                && below(box, Math.min(from.z, to.z), padded ? APPROACH_PAD_Z_MM : 0)) {
                return box;
            }
        }
        return null;
    }

    private validateJogSegment(from: JogPosition, to: JogPosition): void {
        const box = this.obstacleHit(from, to, this.obstacleExclusions());
        if (box) {
            const needed = box.requiredZ === null ? 'tool clearance is unknown; this region is excluded'
                : `requires machine Z at or above ${box.requiredZ.toFixed(3)} mm`;
            throw new Error(`Jog blocked by ${box.name}: ${needed}. Requested segment reaches machine Z ${Math.min(from.z, to.z).toFixed(3)} mm. Review the obstacle exclusions before re-arming.`);
        }
    }

    private insideBlocked(box: ObstacleExclusion, z: number): PendantBlocked {
        return { name: box.name,
            requiredZ: box.requiredZ,
            requestedZ: Number(z.toFixed(3)),
            held: true,
            inside: true,
            text: box.requiredZ === null ? `INSIDE ${box.name} (tool unknown): Z-up only`
                : `INSIDE ${box.name} below Z${zUp(box.requiredZ)}: Z-up only` };
    }

    /**
     * Obstacles HOLD the stick instead of disarming. A segment that would enter an
     * exclusion below its required Z is never sent. In its place this tries, in order:
     * the longest clear prefix (stopping short of the box by the approach pad), then the
     * same intent with one or two axis components removed, like envelope clipping, but
     * never removing the dominant one (a Z-down stick does not turn into its XY drift).
     * Every alternative is a subset of the operator's own stick motion inside the armed
     * envelope. Positions are rounded to the 3 decimals moveMachineSettled sends before
     * any check, and the caller still runs the full validateJogSegment on whatever is
     * returned. null means hold: stay armed, send nothing, and report the blocking
     * obstacle until the stick returns to neutral or a full segment is accepted. Inside an
     * exclusion below its required Z only a straight Z-up exit is sent.
     * The exclusions are recomputed on every call, so landmark or tool changes while armed
     * apply to the next segment.
     */
    private obstacleSafeTarget(from: JogPosition, raw: JogTarget | null): JogTarget | null {
        const bounds = this.session.bounds as JogBounds;
        // G-code precision, kept inside the armed envelope; `toward` truncates toward it.
        const gcode = (p: JogPosition, toward?: JogPosition): JogPosition => {
            const out = { ...p };
            for (const axis of ['x', 'y', 'z'] as const) {
                const v = p[axis] * 1000;
                let r = Math.round(v);
                if (toward !== undefined) { r = p[axis] > toward[axis] ? Math.floor(v) : Math.ceil(v); }
                r = Math.max(Math.ceil(bounds[`${axis}Min`] * 1000), Math.min(Math.floor(bounds[`${axis}Max`] * 1000), r));
                out[axis] = Number((r / 1000).toFixed(3));
            }
            return out;
        };
        const segment = (position: JogPosition, feed: number): JogTarget => {
            const distanceMm = Math.hypot(position.x - from.x, position.y - from.y, position.z - from.z);
            return { position, feed, durationMs: distanceMm / feed * 60000, distanceMm };
        };
        let target = raw ? segment(gcode(raw.position), raw.feed) : null;
        if (target && target.distanceMm < 0.001) { target = null; }
        const boxes = this.obstacleExclusions();
        const inside = this.obstacleHit(from, from, boxes);
        if (inside) {
            // Inside an exclusion below its required Z (armed there, or reported there): only a
            // straight climb is sent, with its XY pinned to the current point. Everything else
            // holds, including a climb with any XY component beyond POSITION_EPSILON_MM.
            this.blocked = this.insideBlocked(inside, from.z);
            if (!target) { return null; }
            if (isStraightZUp(from, target.position)) {
                const climb = gcode({ x: from.x, y: from.y, z: target.position.z });
                return isStraightZUp(from, climb) ? segment(climb, target.feed) : null;
            }
            if (!this.blockedLogged.has(inside.name)) {
                this.blockedLogged.add(inside.name);
                log.info(`Jog held inside ${inside.name} at machine Z ${from.z.toFixed(3)} mm: only a straight Z-up exit is sent until the toolhead leaves it. Still armed; that segment was not sent. Later refusals at this obstacle are not logged until the next arm.`);
            }
            return null;
        }
        if (!target) { this.blocked = null; return null; }
        const hit = this.obstacleHit(from, target.position, boxes, true);
        if (!hit) { this.blocked = null; return target; }
        const clear = (candidate: JogTarget) => candidate.distanceMm >= 0.001 && !this.obstacleHit(from, candidate.position, boxes, true);
        const end = target.position;
        const along = (t: number): JogPosition => ({ x: from.x + (end.x - from.x) * t,
            y: from.y + (end.y - from.y) * t,
            z: from.z + (end.z - from.z) * t });
        let chosen: JogTarget | null = null;
        // Hits are monotonic along a straight segment, so bisection finds the clear prefix.
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 24; i += 1) {
            const mid = (lo + hi) / 2;
            if (this.obstacleHit(from, along(mid), boxes, true)) { hi = mid; } else { lo = mid; }
        }
        if (lo * target.distanceMm >= MIN_APPROACH_MM) {
            const prefix = segment(gcode(along(lo), from), target.feed);
            if (clear(prefix)) { chosen = prefix; }
        }
        // Never drop the dominant requested axis: what is left would be only the minor drift.
        const delta = { x: Math.abs(end.x - from.x), y: Math.abs(end.y - from.y), z: Math.abs(end.z - from.z) };
        const dominant = (['x', 'y', 'z'] as const).find((axis) => delta[axis] > 0
            && (['x', 'y', 'z'] as const).every((other) => other === axis || delta[axis] >= 2 * delta[other]));
        const drops: Array<Array<'x' | 'y' | 'z'>> = [['z'], ['x'], ['y'], ['x', 'y'], ['x', 'z'], ['y', 'z']];
        for (const axes of drops) {
            if (chosen) { break; }
            if (dominant && axes.includes(dominant)) { continue; }
            const position = { ...end };
            for (const axis of axes) { position[axis] = from[axis]; }
            const candidate = segment(gcode(position), target.feed);
            if (clear(candidate)) { chosen = candidate; }
        }
        const requestedZ = Number(Math.min(from.z, end.z).toFixed(3));
        const need = hit.requiredZ === null ? 'no entry, tool clearance unknown'
            : `Z>=${zUp(hit.requiredZ)} (asked ${zDown(requestedZ)})`;
        this.blocked = { name: hit.name,
            requiredZ: hit.requiredZ,
            requestedZ,
            held: !chosen,
            inside: false,
            text: `${chosen ? 'LIMITED' : 'BLOCKED'} ${hit.name}: ${need}` };
        if (!this.blockedLogged.has(hit.name)) {
            this.blockedLogged.add(hit.name);
            const needed = hit.requiredZ === null ? 'tool clearance is unknown; the region is excluded'
                : `requires machine Z at or above ${hit.requiredZ.toFixed(3)} mm`;
            log.info(`Jog ${chosen ? 'limited' : 'held'} at ${hit.name}: ${needed}; requested segment reaches machine Z ${requestedZ.toFixed(3)} mm. Still armed; that segment was not sent. Later refusals at this obstacle are not logged until the next arm.`);
        }
        return chosen;
    }

    private release(): void {
        if (this.owned && !this.busy && !this.session.armed) {
            manualControlGate.release();
            this.owned = false;
        }
    }

    public disarm(reason = 'Disarmed by operator.'): void {
        if (this.nextJog !== null) { clearImmediate(this.nextJog); this.nextJog = null; }
        if (this.session.armed || this.error !== reason) { log.info(`Disarmed: ${reason}`); }
        this.session.disarm();
        this.blocked = null;
        this.error = reason;
        this.release();
    }

    private async ports() {
        const ports = (await SerialPort.list()).filter((p) => p.vendorId?.toLowerCase() === '239a'
            && p.productId?.toLowerCase() === '8124');
        this.lastPorts = ports;
        this.portsAt = Date.now();
        return ports;
    }

    // Status polls must stay cheap and must never hang: enumerating serial ports can take
    // hundreds of ms on Linux, so polls reuse the last list and wait at most 1 s for a refresh.
    private async cachedPorts() {
        if (!this.portsPending && Date.now() - this.portsAt > PORT_LIST_CACHE_MS) {
            this.portsPending = this.ports().catch(() => this.lastPorts)
                .finally(() => { this.portsAt = Date.now(); this.portsPending = null; });
        }
        if (!this.portsPending) { return this.lastPorts; }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fallback = new Promise<Array<{ path: string; serialNumber?: string }>>((resolve) => {
            timer = setTimeout(() => resolve(this.lastPorts), 1000);
        });
        try { return await Promise.race([this.portsPending, fallback]); } finally { clearTimeout(timer); }
    }

    private async connect(path: string): Promise<void> {
        if (this.busy || this.opening) { throw new Error('Wait for the current connection or jog to finish.'); }
        this.opening = true;
        try {
            const ports = await this.ports();
            if (!ports.some((p) => p.path === path)) { throw new Error('Select the Feather USB data port.'); }
            this.shutdown();
            this.session.reset();
            this.feedbackHealthy = null;
            this.feedbackWritePending = false;
            this.firmware = undefined;
            const port = new SerialPort({ path, baudRate: 115200, autoOpen: false });
            this.port = port;
            port.on('error', (err: Error) => { if (port === this.port) { this.disarm(err.message); } });
            port.on('close', () => { if (port === this.port) { this.disarm('USB disconnected; reconnect and re-arm.'); } });
            port.on('data', (data: Buffer) => {
                if (port !== this.port) { return; }
                this.buffer += data.toString('utf8');
                if (this.buffer.length > 4096) { this.buffer = ''; this.disarm('USB receive buffer overflow.'); return; }
                const lines = this.buffer.split('\n');
                this.buffer = lines.pop() || '';
                try {
                    for (const line of lines) {
                        if (line.trim()) {
                            trace(`rx ${line.slice(0, 600)}`);
                            let input;
                            try { input = parsePendantInput(line); } catch (err) {
                                if (!traceEnabled() && this.error !== (err as Error).message) {
                                    log.warn(`Rejected USB frame: ${line.slice(0, 300)}`);
                                }
                                throw err;
                            }
                            if (this.firmware === undefined || (input.fw ?? null) !== this.firmware) {
                                this.firmware = input.fw ?? null;
                                log.info(`Feather firmware: ${this.firmware || 'unidentified (pre-fw build)'}`);
                            }
                            if (input.log) { trace(`feather ${input.log}`); }
                            this.feedbackHealthy = input.feedback_ok ?? null;
                            this.session.receive(input, Date.now());
                            if (input.stop) { this.disarm('Stopped with Feather D2.'); }
                            if (this.session.armed && input.feedback_ok === false) {
                                this.disarm('Feather feedback exceeded one second. Centre axes and re-arm after the USB link recovers.');
                            }
                        }
                    }
                } catch (err) { this.disarm((err as Error).message); }
            });
            await new Promise<void>((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
            this.error = 'Connected. Centre all axes before arming.';
            log.info(`USB connected: ${path}`);
            this.timer = setInterval(() => { this.tick().catch((err: Error) => this.disarm(err.message)); }, 100);
        } finally { this.opening = false; }
    }

    private dro(): object {
        try {
            const p = getPositionSnapshot();
            const record = getPositionOfRecord(currentGcodeSequence());
            return pendantPosition(p, record, getTrustedOffset(), Date.now(), HEARTBEAT_STALE_MS);
        } catch (err) {
            return { machine: null, work: null, reliability: 'disconnected', age_ms: null, warnings: [(err as Error).message] };
        }
    }

    private async tick(): Promise<void> {
        const now = Date.now();
        if (this.session.armed) {
            if (this.machineEpoch() !== this.epoch) { this.disarm('Machine connection changed. Re-arm at centre.'); } else if (now >= this.session.expiresAt) { this.disarm('The 10-minute jog approval expired. Review bounds and re-arm.'); } else if (now - this.pageAliveAt > 900) { this.disarm('Pendant page heartbeat exceeded the one-second limit. Keep the page visible and re-arm.'); } else if (now - this.session.receivedAt > 900) { this.disarm('Feather input exceeded the one-second limit. Check USB, centre axes and re-arm.'); }
        }
        if (this.port?.isOpen && !this.feedbackWritePending && this.port.writableLength < 1024) {
            const dro = this.dro() as { machine: object | null; work: object | null; reliability: string;
                // eslint-disable-next-line camelcase -- USB protocol keys
                age_ms: number | null; position_age_ms?: number; stale_after_ms?: number; warnings: string[] };
            this.feedbackWritePending = true;
            const frame = `${JSON.stringify({ v: 1,
                type: 'dro',
                armed: this.session.armed,
                neutral: this.session.neutral,
                machine: dro.machine,
                work: dro.work,
                reliability: dro.reliability,
                age_ms: dro.age_ms,
                position_age_ms: dro.position_age_ms,
                stale_after_ms: dro.stale_after_ms,
                moving: this.busy && this.recovery === null,
                warnings: dro.warnings.length ? [dro.warnings[0].slice(0, 160)] : [],
                input_seq: this.session.inputSequence >= 0 ? this.session.inputSequence : null,
                input_age_ms: now - this.session.receivedAt,
                // The TFT shows `blocked` on its bottom row while linked; `message` only while not.
                blocked: this.blocked ? { ...this.blocked, name: this.blocked.name.slice(0, 40), text: this.blocked.text.slice(0, 120) } : null,
                message: (this.error || this.blocked?.text || '').slice(0, 240) || null })}\n`;
            trace(`tx ${frame.trimEnd()}`);
            this.port.write(frame, (err) => {
                this.feedbackWritePending = false;
                if (err) { this.disarm(err.message); }
            });
        }
        this.release();
        if (this.busy || !this.session.armed) { return; }
        this.ready();
        const from = this.position();
        const target = this.obstacleSafeTarget(from, this.session.target(from, now, this.commandOverheadMs));
        if (!target) { this.release(); return; }
        this.validateEnvelope(this.session.bounds as JogBounds);
        this.validateJogSegment(from, target.position);
        this.busy = true;
        try {
            await moveMachineSettled('usb_pendant', target.position, target.feed);
            this.lastJog = { durationMs: target.durationMs,
                distanceMm: target.distanceMm,
                feed: target.feed,
                elapsedMs: Date.now() - now };
            this.commandOverheadMs = Math.max(this.commandOverheadMs * 0.8, this.lastJog.elapsedMs - target.durationMs, 0);
        } finally {
            this.busy = false;
            this.release();
        }
        // Service pending USB events before sampling the next intent. Do not add
        // the periodic timer's 0–100 ms idle gap after each synchronous move.
        if (this.session.armed && this.nextJog === null) {
            this.nextJog = setImmediate(() => {
                this.nextJog = null;
                this.tick().catch((err: Error) => this.disarm(err.message));
            });
        }
    }

    public shutdown(): void {
        this.disarm('USB pendant closed.');
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        const port = this.port;
        this.port = null;
        this.buffer = '';
        this.feedbackWritePending = false;
        if (port?.isOpen) { port.close(); }
    }

    private defaultBounds(): JogBounds | null {
        try {
            const p = this.position();
            const travel = this.travelBounds();
            return { xMin: Math.max(travel.xMin, p.x - 5),
                xMax: Math.min(travel.xMax, p.x + 5),
                yMin: Math.max(travel.yMin, p.y - 5),
                yMax: Math.min(travel.yMax, p.y + 5),
                zMin: 280,
                zMax: 329 };
        } catch (err) { return null; }
    }

    public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
        const reply = (status: number, body: object) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        // Manual authority stays loopback-only even if the MCP listener permits LAN clients.
        const host = req.headers.host || '';
        if (!isLoopback(req.socket.remoteAddress) || !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)
            || (req.headers.origin && new URL(req.headers.origin).host !== host)) {
            reply(403, { error: 'USB manual control is local and same-origin only.' }); return;
        }
        if (req.method === 'GET' && url.pathname === '/pendant') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Frame-Options': 'DENY',
                'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
            res.end(pendantPage(this.token)); return;
        }
        if (req.method === 'GET' && url.pathname === '/pendant/status') {
            let travelBounds: JogBounds | null = null;
            try { travelBounds = this.travelBounds(); } catch (err) { /* Unknown travel is shown explicitly. */ }
            reply(200, { armed: this.session.armed,
                neutral: this.session.neutral,
                busy: this.busy,
                recovery: this.recovery,
                maxSegmentMs: this.session.maxSegmentMs,
                limitedAxes: this.session.limitedAxes,
                lastJog: this.lastJog,
                inputAgeMs: Date.now() - this.session.receivedAt,
                port: this.port?.path || null,
                firmware: this.firmware ?? null,
                trace: traceEnabled(),
                input: this.session.latest,
                error: this.error,
                blocked: this.blocked,
                dro: this.dro(),
                bounds: this.session.bounds,
                defaultBounds: this.defaultBounds(),
                travelBounds,
                obstacleExclusions: this.obstacleExclusions(),
                settings: pendantSettings(),
                ports: await this.cachedPorts() }); return;
        }
        if (req.method !== 'POST' || req.headers['x-pendant-token'] !== this.token) {
            reply(403, { error: 'Use the local operator page.' }); return;
        }
        let body = '';
        for await (const chunk of req) {
            body += chunk.toString();
            if (body.length > 4096) { reply(413, { error: 'Request too large.' }); return; }
        }
        try {
            const args = JSON.parse(body || '{}');
            switch (url.pathname) {
                case '/pendant/connect':
                    await this.connect(String(args.path || '')); break;
                case '/pendant/arm': {
                    if (!this.port?.isOpen || this.busy || Date.now() - this.session.receivedAt > 300) {
                        throw new Error('No recent USB input, or a jog is still settling.');
                    }
                    if (this.feedbackHealthy === false) {
                        throw new Error('Wait for the Feather to acknowledge host feedback within one second before arming.');
                    }
                    if (args.clearanceConfirmed !== true) { throw new Error('Review and confirm the entire envelope.'); }
                    this.ready();
                    const bounds = this.reviewedBounds(args.bounds);
                    const current = this.position();
                    // Arming inside an exclusion is allowed so the pendant can climb out:
                    // until it leaves, only a straight Z-up exit is sent (see obstacleSafeTarget).
                    const inside = this.obstacleHit(current, current, this.obstacleExclusions());
                    manualControlGate.acquire(() => this.disarm('Stopped through MCP.'));
                    this.owned = true;
                    this.session.arm(bounds, this.position(), Date.now(), args.maxSegmentMs ?? 500);
                    this.epoch = this.machineEpoch();
                    this.pageAliveAt = Date.now();
                    this.error = null;
                    this.blocked = inside ? this.insideBlocked(inside, current.z) : null;
                    this.blockedLogged.clear();
                    log.info(`Armed reviewed envelope: ${JSON.stringify(bounds)}`);
                    if (inside) { log.info(`Armed inside ${inside.name} below its required Z: only straight Z-up exits are sent until the toolhead leaves it.`); }
                    break;
                }
                case '/pendant/settings': {
                    this.disarm('Reviewing operator settings. Re-arm after saving.');
                    if (this.busy || this.opening || ['starting', 'started'].includes(jobManager.getActive()?.state || '')) {
                        throw new Error('Wait for the current move, connection or machine job to finish before changing settings.');
                    }
                    if (connectionManager.getConnectionStatus().connected && getPositionSnapshot().machineStatus !== 'idle') {
                        throw new Error('Wait for the connected machine to report idle before changing settings.');
                    }
                    manualControlGate.acquire();
                    this.owned = true;
                    try { updatePendantSettings(args); } finally { this.release(); }
                    this.error = 'Operator settings saved. Review the updated clearances and re-arm.';
                    break;
                }
                case '/pendant/disarm': this.disarm(); break;
                case '/pendant/restore-frame':
                case '/pendant/home': {
                    const homing = url.pathname === '/pendant/home';
                    this.disarm(homing ? 'Operator requested homing. Pendant disarmed.' : 'Restoring work frame. Pendant disarmed.');
                    if (homing && args.confirmHoming !== true) { throw new Error('Confirm homing all axes, including rotary B, even if position data is stale.'); }
                    if (this.busy || this.opening || ['starting', 'started'].includes(jobManager.getActive()?.state || '')) {
                        throw new Error('Wait for the current move, connection or machine job to finish before recovery.');
                    }
                    if (!homing && getPositionSnapshot().machineStatus !== 'idle') {
                        throw new Error('Wait for the machine to report idle before changing its coordinate mode.');
                    }
                    manualControlGate.acquire();
                    this.owned = true;
                    this.busy = true;
                    this.recovery = homing ? 'Homing and verifying position' : 'Restoring work frame';
                    try {
                        if (homing) {
                            await homeMachine('usb_pendant:home', true, true);
                            this.error = 'Homing completed and verified. Review bounds and re-arm to jog.';
                        } else {
                            const result = await sendWorkFrameRestore('usb_pendant:restore-frame');
                            if (result.result !== 0) { throw new Error(result.text || 'Controller refused frame recovery.'); }
                            this.error = 'G90/G54 restored without axis motion. Wait for fresh coordinates, review bounds and re-arm.';
                        }
                    } finally {
                        this.recovery = null;
                        this.busy = false;
                        this.release();
                    }
                    break;
                }
                case '/pendant/keepalive': this.pageAliveAt = Date.now(); break;
                default: reply(404, { error: 'Unknown pendant action.' }); return;
            }
            reply(200, { ok: true });
        } catch (err) {
            const message = `${url.pathname.split('/').pop()} refused: ${(err as Error).message}`;
            this.disarm(message);
            log.warn(message);
            reply(400, { error: message });
        }
    }
}

export const pendantRuntime = new PendantRuntime();
