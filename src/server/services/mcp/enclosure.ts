/* eslint-disable camelcase */
// MCP tool results are snake_case by convention (registry.ts).
/**
 * Enclosure light / fan mapping for the MCP enclosure tools (#142). Pure:
 * no server imports, so the tests run without Luban.
 *
 * Every channel Luban speaks reports the enclosure differently - the SSTP
 * HTTP module endpoint, the SACP EnclosureInfo packet, the Marlin
 * "Enclosure ..." settings lines over a text serial port - and the tools
 * never hand-type an M-code: ConnectionManager makes the same channel calls
 * the Workspace enclosure widget makes and hands the raw report here to be
 * read into one shape.
 */

export type EnclosureSource = 'sstp-http' | 'sacp' | 'text-serial';

/** GET /api/v1/enclosure body, as SstpHttpChannel.readEnclosureStatus parses it. */
export interface SstpEnclosureReport {
    source: 'sstp-http';
    code: number;
    msg?: string;
    data?: { isReady?: boolean; isDoorEnabled?: boolean; led?: number; fan?: number } | null;
}

/** SACP EnclosureInfo (null when the module list holds no enclosure). */
export interface SacpEnclosureReport {
    source: 'sacp';
    info: {
        moduleStatus?: number;
        ledValue?: number;
        fanlevel?: number;
        testStatus?: Array<{ workType: number; State: boolean }>;
    } | null;
}

/** Marlin controller settings over a text serial port (Marlin.js parsers). */
export interface SerialEnclosureReport {
    source: 'text-serial';
    settings: {
        enclosureOnline?: boolean;
        enclosureLight?: number;
        enclosureFan?: number;
        enclosureDoor?: boolean;
        enclosureDoorDetection?: boolean;
    } | null;
}

export type EnclosureRawReport = SstpEnclosureReport | SacpEnclosureReport | SerialEnclosureReport;

export interface EnclosureStatus {
    /** The machine reports an enclosure module that is online. */
    present: boolean;
    light_percent: number | null;
    fan_percent: number | null;
    /** Door-detection switch (pause on open) when the channel reports it; SACP reports it per head type. */
    door_detection: boolean | null;
    door_detection_by_head?: { print: boolean | null; laser: boolean | null; cnc: boolean | null };
    /** Door open right now; only the serial Marlin parser reports it. */
    door_open: boolean | null;
    source: EnclosureSource;
    /** Why `present` is false, or an empty string. */
    reason: string;
}

function percent(value: unknown): number | null {
    const n = Number(value);
    if (value === undefined || value === null || !Number.isFinite(n)) {
        return null;
    }
    return Math.max(0, Math.min(100, Math.round(n)));
}

function flag(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

/** Read any channel's raw enclosure report into the tool result shape. */
export function normaliseEnclosureStatus(report: EnclosureRawReport): EnclosureStatus {
    if (report.source === 'sstp-http') {
        const data = report.code === 200 && report.data && typeof report.data === 'object' ? report.data : null;
        if (!data) {
            return {
                present: false,
                light_percent: null,
                fan_percent: null,
                door_detection: null,
                door_open: null,
                source: report.source,
                reason: report.code === 200
                    ? 'The controller answered the enclosure query with no module report.'
                    : `The controller refused the enclosure query (code ${report.code}${report.msg ? `: ${report.msg}` : ''}).`,
            };
        }
        const present = data.isReady === true;
        return {
            present,
            light_percent: percent(data.led),
            fan_percent: percent(data.fan),
            door_detection: flag(data.isDoorEnabled),
            door_open: null,
            source: report.source,
            reason: present ? '' : 'The controller reports the enclosure module as not ready (isReady false): no enclosure is connected or it is still starting.',
        };
    }
    if (report.source === 'sacp') {
        const info = report.info;
        if (!info) {
            return {
                present: false,
                light_percent: null,
                fan_percent: null,
                door_detection: null,
                door_open: null,
                source: report.source,
                reason: 'The module list holds no enclosure module.',
            };
        }
        // moduleStatus 2 = normal (ConnectionManager.getEnclosureInfo).
        const present = info.moduleStatus === undefined || info.moduleStatus === 2;
        const byHead = { print: null as boolean | null, laser: null as boolean | null, cnc: null as boolean | null };
        for (const entry of info.testStatus || []) {
            // 0: 3dp, 1: laser, 2: cnc
            const key = (['print', 'laser', 'cnc'] as const)[entry.workType];
            if (key) { byHead[key] = flag(entry.State); }
        }
        return {
            present,
            light_percent: percent(info.ledValue),
            fan_percent: percent(info.fanlevel),
            door_detection: null,
            door_detection_by_head: byHead,
            door_open: null,
            source: report.source,
            reason: present ? '' : `The enclosure module reports status ${info.moduleStatus} (2 = normal).`,
        };
    }
    const settings = report.settings;
    if (!settings) {
        return {
            present: false,
            light_percent: null,
            fan_percent: null,
            door_detection: null,
            door_open: null,
            source: report.source,
            reason: 'The serial controller has not reported its settings yet.',
        };
    }
    const present = settings.enclosureOnline === true;
    return {
        present,
        light_percent: percent(settings.enclosureLight),
        fan_percent: percent(settings.enclosureFan),
        door_detection: flag(settings.enclosureDoorDetection),
        door_open: flag(settings.enclosureDoor),
        source: report.source,
        reason: present ? '' : 'The controller reports "Enclosure online: Off".',
    };
}

/**
 * The level a set_enclosure_* call asks for: `percent` 0-100 or `state`
 * on/off (100/0), exactly one of them. The enclosure LED strip and exhaust
 * fan on the Snapmaker 2.0 are driven 0 or 100 by Luban's own widget; other
 * values are passed through unchanged for firmware that accepts them.
 */
export function parseEnclosureLevel(args: { percent?: unknown; state?: unknown }, what: string): number {
    const hasPercent = args.percent !== undefined && args.percent !== null;
    const hasState = args.state !== undefined && args.state !== null;
    if (hasPercent === hasState) {
        throw new Error(`Give exactly one of percent (0-100) or state ("on" | "off") for the ${what}.`);
    }
    if (hasState) {
        const state = String(args.state).trim().toLowerCase();
        if (state === 'on') { return 100; }
        if (state === 'off') { return 0; }
        throw new Error(`state must be "on" or "off" for the ${what}, not ${JSON.stringify(args.state)}.`);
    }
    const value = Number(args.percent);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error(`percent must be an integer from 0 to 100 for the ${what}, not ${JSON.stringify(args.percent)}.`);
    }
    return value;
}
