import { JobEvent } from './jobs';

// Where a procedure's time went, computed from its own event log (pure, so an
// agent gets the breakdown from get_gcode_job_status / get_job_timing instead
// of mining events by hand - operator request 2026-09-05 after the four-face
// scan analysis). Every direct command is one `gcode` send event (tool,
// gcode, idleMs, senseMs...) followed by its reply event (execMs, response);
// the runner's phase events (hop-<label>, measured-<label>, ...) delimit the
// stations. Motion time is distance / feed from the commanded coordinates;
// the rest of execMs is controller + HTTP overhead (four lines per batch on
// the WiFi channel, ~270 ms measured).

export type CommandKind =
    | 'coarse' | 'fine' | 'confirm' | 'backoff' | 'release' | 'retract'
    | 'hop' | 'descend-guard' | 'descend' | 'raise' | 'traverse' | 'travel' | 'retreat' | 'other';

const KIND_PATTERNS: [RegExp, CommandKind][] = [
    [/:descend-guard/, 'descend-guard'],
    [/:descend/, 'descend'],
    [/:coarse/, 'coarse'],
    [/:fine/, 'fine'],
    [/:confirm/, 'confirm'],
    [/:backoff/, 'backoff'],
    [/:release/, 'release'],
    [/:retract/, 'retract'],
    [/:hop/, 'hop'],
    [/(final-|abort-)?raise/, 'raise'],
    [/:traverse/, 'traverse'],
    [/:travel/, 'travel'],
    [/retreat/, 'retreat'],
];

export function classifyCommand(tool: string): CommandKind {
    for (const [pattern, kind] of KIND_PATTERNS) {
        if (pattern.test(tool)) {
            return kind;
        }
    }
    return 'other';
}

export interface CommandRecord {
    seq: number;
    at: number;
    tool: string;
    kind: CommandKind;
    /** Commanded machine-frame words present in the batch. */
    target: { x?: number; y?: number; z?: number };
    feed: number | null;
    /** Straight-line distance from the previous command's target (null when unknown). */
    distanceMm: number | null;
    /** distance / feed, ms (null when unknown). */
    motionMs: number | null;
    /** Send -> controller reply. */
    execMs: number | null;
    /** execMs - motionMs (controller + transport overhead per batch). */
    overheadMs: number | null;
    /** Previous reply -> this send (sensor window + runner logic + engine). */
    idleMs: number | null;
    /** Sensor window that preceded this send. */
    senseMs: number | null;
}

export interface KindSummary {
    kind: CommandKind;
    count: number;
    feeds: number[];
    distanceMm: number;
    execMs: number;
    motionMs: number;
    overheadMs: number;
    idleMs: number;
    senseMs: number;
    meanExecMs: number | null;
    meanOverheadMs: number | null;
}

export interface StationTiming {
    label: string;
    /** Wall time from the previous station's end (or the run start) to this station's measured/no-contact event. */
    ms: number;
    commands: number;
    byKind: { [kind: string]: { count: number; execMs: number; idleMs: number } };
    outcome: 'contact' | 'no_contact' | 'uncertain';
    approach: 'slow-zone' | 'coarse-contact' | 'unknown';
}

export interface JobTiming {
    events: number;
    commands: number;
    /** submitted -> approved */
    approvalWaitMs: number | null;
    /** started -> completed/failed (or the last event while running) */
    runMs: number | null;
    /** Sum over commands. */
    totals: { execMs: number; motionMs: number; overheadMs: number; idleMs: number; senseMs: number };
    byKind: KindSummary[];
    stations: StationTiming[];
    medianStationMs: number | null;
    waits: {
        settleWaits: number;
        settleWaitMs: number;
        slowSteps: number;
        slowStepMs: number;
        positionEstimated: number;
        eventLoopStalls: number;
        heartbeatFrameFlips: number;
    };
    note: string;
}

function round(value: number): number {
    return Math.round(value);
}

function parseWords(gcode: string): { target: { x?: number; y?: number; z?: number }; feed: number | null } {
    const line = (gcode.match(/G0?1\b[^\n]*/) || [''])[0];
    const target: { x?: number; y?: number; z?: number } = {};
    const x = line.match(/\bX(-?\d+(?:\.\d+)?)/);
    const y = line.match(/\bY(-?\d+(?:\.\d+)?)/);
    const z = line.match(/\bZ(-?\d+(?:\.\d+)?)/);
    if (x) {
        target.x = Number(x[1]);
    }
    if (y) {
        target.y = Number(y[1]);
    }
    if (z) {
        target.z = Number(z[1]);
    }
    const f = line.match(/\bF(\d+(?:\.\d+)?)/);
    return { target, feed: f ? Number(f[1]) : null };
}

/** Pair every gcode send with its reply and derive motion/overhead per command. */
export function extractCommands(events: JobEvent[]): CommandRecord[] {
    const commands: CommandRecord[] = [];
    const last: { x?: number; y?: number; z?: number } = {};
    let pendingIndex = -1;
    for (const event of events) {
        if (event.phase !== 'gcode') {
            continue;
        }
        const e = event as JobEvent & { gcode?: string; response?: string; execMs?: number; idleMs?: number; senseMs?: number; tool?: string };
        if (typeof e.gcode === 'string') {
            const { target, feed } = parseWords(e.gcode);
            const axes = (['x', 'y', 'z'] as const).filter((axis) => target[axis] !== undefined);
            let distance: number | null = null;
            if (axes.length && axes.every((axis) => last[axis] !== undefined)) {
                distance = Math.hypot(...axes.map((axis) => (target[axis] as number) - (last[axis] as number)));
            }
            axes.forEach((axis) => {
                last[axis] = target[axis];
            });
            const motionMs = distance !== null && feed ? (distance / feed) * 60000 : null;
            commands.push({
                seq: e.seq,
                at: e.at,
                tool: String(e.tool || ''),
                kind: classifyCommand(String(e.tool || '')),
                target,
                feed,
                distanceMm: distance === null ? null : Number(distance.toFixed(3)),
                motionMs: motionMs === null ? null : round(motionMs),
                execMs: null,
                overheadMs: null,
                idleMs: typeof e.idleMs === 'number' ? e.idleMs : null,
                senseMs: typeof e.senseMs === 'number' ? e.senseMs : null,
            });
            pendingIndex = commands.length - 1;
        } else if (typeof e.response === 'string' && pendingIndex >= 0) {
            const command = commands[pendingIndex];
            if (command.execMs === null) {
                const exec = typeof e.execMs === 'number' ? e.execMs : e.at - command.at;
                command.execMs = exec;
                command.overheadMs = command.motionMs === null ? null : exec - command.motionMs;
            }
        }
    }
    return commands;
}

function summarizeKinds(commands: CommandRecord[]): KindSummary[] {
    const map = new Map<CommandKind, KindSummary>();
    for (const c of commands) {
        let s = map.get(c.kind);
        if (!s) {
            s = {
                kind: c.kind,
                count: 0,
                feeds: [],
                distanceMm: 0,
                execMs: 0,
                motionMs: 0,
                overheadMs: 0,
                idleMs: 0,
                senseMs: 0,
                meanExecMs: null,
                meanOverheadMs: null,
            };
            map.set(c.kind, s);
        }
        s.count += 1;
        if (c.feed !== null && !s.feeds.includes(c.feed)) {
            s.feeds.push(c.feed);
        }
        s.distanceMm += c.distanceMm || 0;
        s.execMs += c.execMs || 0;
        s.motionMs += c.motionMs || 0;
        s.overheadMs += c.overheadMs || 0;
        s.idleMs += c.idleMs || 0;
        s.senseMs += c.senseMs || 0;
    }
    const list = [...map.values()].map((s) => ({
        ...s,
        distanceMm: Number(s.distanceMm.toFixed(3)),
        meanExecMs: s.count ? round(s.execMs / s.count) : null,
        meanOverheadMs: s.count ? round(s.overheadMs / s.count) : null,
    }));
    return list.sort((a, b) => b.execMs + b.idleMs - (a.execMs + a.idleMs));
}

const STATION_END = /^(measured|no-contact|uncertain)-(.+)$/;

function summarizeStations(events: JobEvent[], commands: CommandRecord[]): StationTiming[] {
    const stations: StationTiming[] = [];
    const started = events.find((e) => e.phase === 'started');
    // Exclusive lower bound: a command sent in the same millisecond as
    // 'started' still belongs to the first station.
    const firstAt = events.length ? events[0].at : 0;
    let windowStart = (started ? started.at : firstAt) - 1;
    let approach: StationTiming['approach'] = 'unknown';
    for (const event of events) {
        if (/^fine-contact-/.test(event.phase)) {
            approach = 'slow-zone';
        } else if (/^coarse-contact-/.test(event.phase)) {
            approach = 'coarse-contact';
        }
        const m = event.phase.match(STATION_END);
        if (!m) {
            continue;
        }
        const inWindow = commands.filter((c) => c.at > windowStart && c.at <= event.at);
        const byKind: StationTiming['byKind'] = {};
        for (const c of inWindow) {
            const k = byKind[c.kind] || { count: 0, execMs: 0, idleMs: 0 };
            k.count += 1;
            k.execMs += c.execMs || 0;
            k.idleMs += c.idleMs || 0;
            byKind[c.kind] = k;
        }
        stations.push({
            label: m[2],
            ms: event.at - windowStart,
            commands: inWindow.length,
            byKind,
            outcome: m[1] === 'measured' ? 'contact' : m[1] === 'uncertain' ? 'uncertain' : 'no_contact',
            approach,
        });
        windowStart = event.at;
        approach = 'unknown';
    }
    return stations;
}

function sumNotesMs(events: JobEvent[], phase: string): { count: number; ms: number } {
    let count = 0;
    let ms = 0;
    for (const e of events) {
        if (e.phase !== phase) {
            continue;
        }
        count += 1;
        const numeric = (e as JobEvent & { ms?: number }).ms;
        if (typeof numeric === 'number') {
            ms += numeric;
        } else {
            const m = String(e.note || '').match(/after (\d+) ms/);
            if (m) {
                ms += Number(m[1]);
            }
        }
    }
    return { count, ms };
}

export function summarizeJobTiming(events: JobEvent[]): JobTiming {
    const commands = extractCommands(events);
    const byKind = summarizeKinds(commands);
    const stations = summarizeStations(events, commands);
    const totals = commands.reduce((acc, c) => ({
        execMs: acc.execMs + (c.execMs || 0),
        motionMs: acc.motionMs + (c.motionMs || 0),
        overheadMs: acc.overheadMs + (c.overheadMs || 0),
        idleMs: acc.idleMs + (c.idleMs || 0),
        senseMs: acc.senseMs + (c.senseMs || 0),
    }), { execMs: 0, motionMs: 0, overheadMs: 0, idleMs: 0, senseMs: 0 });
    const find = (phase: string) => events.find((e) => e.phase === phase);
    const submitted = find('submitted');
    const approved = find('approved');
    const started = find('started');
    const ended = events.find((e) => e.phase === 'completed' || e.phase === 'failed' || e.phase === 'stopped');
    const lastAt = events.length ? events[events.length - 1].at : null;
    const sortedStations = stations.filter((s) => s.outcome === 'contact').map((s) => s.ms).sort((a, b) => a - b);
    const endAt = ended ? ended.at : lastAt;
    const runMs = started && endAt !== null ? endAt - started.at : null;
    const settle = sumNotesMs(events, 'settle-done');
    const slow = sumNotesMs(events, 'slow_step');
    return {
        events: events.length,
        commands: commands.length,
        approvalWaitMs: submitted && approved ? approved.at - submitted.at : null,
        runMs,
        totals,
        byKind,
        stations,
        medianStationMs: sortedStations.length ? sortedStations[Math.floor((sortedStations.length - 1) / 2)] : null,
        waits: {
            settleWaits: settle.count,
            settleWaitMs: settle.ms,
            slowSteps: slow.count,
            slowStepMs: slow.ms,
            positionEstimated: events.filter((e) => e.phase === 'position-estimated').length,
            eventLoopStalls: events.filter((e) => e.phase === 'event_loop_stall').length,
            heartbeatFrameFlips: events.filter((e) => e.phase === 'heartbeat_frame_flip').length,
        },
        note: 'execMs = send -> controller reply per command batch; motionMs = commanded distance / feed; overheadMs = the '
            + 'difference (controller + transport per batch); idleMs = previous reply -> this send (sensor window + runner); '
            + 'senseMs = the sensor window inside that idle. Stations are delimited by the runner\'s measured-/no-contact- '
            + 'events. Levers: fewer redundant stations, local lift (z_safe_delta_mm guarded / hop_lift_mm stepped), surface confirmation_mode, confirm_passes and transport-appropriate sensor_delay_ms.',
    };
}
