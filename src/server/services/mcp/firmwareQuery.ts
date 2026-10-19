// Read-only firmware queries, per dialect (tyeth/Luban#265 follow-up: read the
// Ray's GRBL configuration). What each dialect is asked, a STRICT allow-list
// of what may be sent at all, and parsers for the replies.
//
// The Ray (GRBL 1.1f on an ESP32, gcodeDialect.ts RAY) is asked `$$`
// (settings), `$#` (coordinate offsets), `$G` (parser modal state), `$I`
// (build info) and `M1005` (machine info, the product SN - the Ray wiki row
// lists it), one at a time; its position report is `?`. The Marlin dialects
// keep M503 S / M114. Nothing else is ever sent by the query tools: the
// allow-list refuses `$X` (alarm unlock), `$H` (home), `$RST=` (reset),
// `$N=value` (setting writes), `$J=` (jog), `$C`, `$SLP`, motion, multi-line
// text and anything carrying `=`.
//
// Pure module: no server imports, unit-tested in tests/firmwareQuery.test.ts.

import { GcodeDialect } from './gcodeDialect';

export type FirmwareQueryFamily = 'grbl' | 'marlin';

/** Every query string the firmware tools may send, by family. Exact match after trim (case-insensitive). */
export const FIRMWARE_QUERY_ALLOW_LIST: { readonly [family in FirmwareQueryFamily]: readonly string[] } = {
    grbl: ['$$', '$#', '$G', '$I', 'M1005', '?'],
    marlin: ['M503 S', 'M114'],
};

/** The configuration read, in the order it is sent. */
export function configurationQueriesFor(dialect: GcodeDialect): string[] {
    if (dialect.family === 'grbl') {
        return ['$$', '$#', '$G', '$I', 'M1005'];
    }
    if (dialect.family === 'marlin') {
        return ['M503 S'];
    }
    return [];
}

/** The position query: GRBL `?`, Marlin `M114` (gcodeDialect.ts `status`); null when the dialect has none. */
export function positionQueryFor(dialect: GcodeDialect): string | null {
    if (dialect.status === 'grbl-?') {
        return '?';
    }
    if (dialect.status === 'M114') {
        return 'M114';
    }
    return null;
}

/**
 * null when `query` may be sent to a machine of this dialect, else the
 * refusal. Strict: one line, exactly one of the family's allow-listed strings.
 */
export function firmwareQueryRefusal(dialect: GcodeDialect, query: unknown): string | null {
    if (dialect.family === 'unknown') {
        return `${dialect.label}: no firmware query is known for a machine the dialect table does not list, so nothing is sent.`;
    }
    if (typeof query !== 'string' || !query.trim()) {
        return 'A firmware query must be a non-empty string.';
    }
    if (/[\r\n;]/.test(query)) {
        return `Refused ${JSON.stringify(query)}: one query per call - line breaks and ';' are not allowed (a second line would be sent too).`;
    }
    const wanted = query.trim().toUpperCase();
    const allowed = FIRMWARE_QUERY_ALLOW_LIST[dialect.family];
    if (allowed.some((entry) => entry.toUpperCase() === wanted)) {
        return null;
    }
    const why = /=/.test(wanted)
        ? ' It carries "=", which on GRBL WRITES a setting or runs a command ($N=, $RST=, $J=).'
        : '';
    return `Refused ${JSON.stringify(query.trim())}: not a read-only query for ${dialect.label}.${why} `
        + `Allowed: ${allowed.join(', ')}.`;
}

// ---- GRBL settings ($$) ------------------------------------------------------

/** GRBL 1.1 setting names and units (grbl/doc/markdown/settings.md). Axis settings come from AXIS_SETTINGS. */
const GRBL_SETTING_NAMES: { [n: number]: { name: string; unit?: string } } = {
    0: { name: 'step pulse', unit: 'us' },
    1: { name: 'step idle delay', unit: 'ms' },
    2: { name: 'step port invert mask' },
    3: { name: 'direction port invert mask' },
    4: { name: 'step enable invert' },
    5: { name: 'limit pins invert' },
    6: { name: 'probe pin invert' },
    10: { name: 'status report mask' },
    11: { name: 'junction deviation', unit: 'mm' },
    12: { name: 'arc tolerance', unit: 'mm' },
    13: { name: 'report inches' },
    20: { name: 'soft limits' },
    21: { name: 'hard limits' },
    22: { name: 'homing cycle' },
    23: { name: 'homing direction invert mask' },
    24: { name: 'homing feed', unit: 'mm/min' },
    25: { name: 'homing seek', unit: 'mm/min' },
    26: { name: 'homing debounce', unit: 'ms' },
    27: { name: 'homing pull-off', unit: 'mm' },
    30: { name: 'max spindle speed (S max)', unit: 'S' },
    31: { name: 'min spindle speed (S min)', unit: 'S' },
    32: { name: 'laser mode' },
};

/** $100+axis .. $130+axis; axis index 0..5 = X Y Z A B C (Grbl_Esp32 numbering). */
const AXIS_SETTINGS: Array<{ base: number; name: string; unit: string }> = [
    { base: 100, name: 'steps per mm', unit: 'steps/mm' },
    { base: 110, name: 'max rate', unit: 'mm/min' },
    { base: 120, name: 'acceleration', unit: 'mm/s^2' },
    { base: 130, name: 'max travel', unit: 'mm' },
];
const AXES = ['X', 'Y', 'Z', 'A', 'B', 'C'];

export interface GrblSetting {
    /** `$110` style key, or the named key (`$Sta/SSID`) a Grbl_Esp32 build prints. */
    key: string;
    value: number | string;
    raw: string;
    name: string | null;
    unit: string | null;
}

function settingName(n: number): { name: string; unit?: string } | null {
    if (GRBL_SETTING_NAMES[n]) {
        return GRBL_SETTING_NAMES[n];
    }
    for (const axis of AXIS_SETTINGS) {
        const index = n - axis.base;
        if (index >= 0 && index < AXES.length) {
            return { name: `${AXES[index]} ${axis.name}`, unit: axis.unit };
        }
    }
    return null;
}

/**
 * `$$` reply -> settings by key. Numbered lines (`$120=1000.000`) get GRBL's
 * name and unit; named lines (`$Sta/SSID=...`, Grbl_Esp32) are kept raw; a
 * trailing `(comment)` some builds print is dropped from the value.
 */
export function parseGrblSettings(text: string | null | undefined): { [key: string]: GrblSetting } {
    const out: { [key: string]: GrblSetting } = {};
    for (const rawLine of String(text || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        const match = /^\$([0-9]+|[A-Za-z][\w/]*)\s*=\s*(.*?)\s*(?:\(.*\))?$/.exec(line);
        if (!match) {
            continue;
        }
        const key = `$${match[1]}`;
        const numeric = /^[-+]?\d+(?:\.\d+)?$/.test(match[2]) ? Number(match[2]) : null;
        const known = /^\d+$/.test(match[1]) ? settingName(Number(match[1])) : null;
        out[key] = {
            key,
            value: numeric !== null ? numeric : match[2],
            raw: line,
            name: known ? known.name : null,
            unit: known && known.unit ? known.unit : null,
        };
    }
    return out;
}

// ---- GRBL offsets ($#), parser state ($G), build info ($I), status (?) ------

export interface GrblOffsets {
    /** G54..G59, G28, G30, G92: the axis values in order (3 or more - the Ray reports B too when built with it). */
    [frame: string]: number[] | { values: number[]; success: boolean } | number | undefined;
}

function numbers(list: string): number[] {
    return list.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));
}

/** `$#` reply: `[G54:0.000,0.000,0.000]` ... `[TLO:0.000]` `[PRB:0.000,0.000,0.000:0]`. */
export function parseGrblOffsets(text: string | null | undefined): GrblOffsets {
    const out: GrblOffsets = {};
    const re = /\[(G5[4-9]|G28|G30|G92|TLO|PRB):([^\]]*)\]/g;
    let match: RegExpExecArray | null = re.exec(String(text || ''));
    while (match) {
        const [, frame, body] = match;
        if (frame === 'PRB') {
            const [values, success] = body.split(':');
            out.PRB = { values: numbers(values || ''), success: String(success).trim() === '1' };
        } else if (frame === 'TLO') {
            out.TLO = Number(body);
        } else {
            out[frame] = numbers(body);
        }
        match = re.exec(String(text || ''));
    }
    return out;
}

export interface GrblParserState {
    raw: string;
    /** Every modal word in order, e.g. ['G0', 'G54', 'G17', 'G21', 'G90', 'G94', 'M5', 'M9']. */
    modes: string[];
    motion: string | null;
    workspace: string | null;
    plane: string | null;
    units: 'mm' | 'inch' | null;
    distance: 'absolute' | 'relative' | null;
    feedMode: string | null;
    spindle: string | null;
    coolant: string[];
    tool: number | null;
    feed: number | null;
    spindleSpeed: number | null;
}

/** `$G` reply: `[GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0]`; null when absent. */
export function parseGrblParserState(text: string | null | undefined): GrblParserState | null {
    const match = /\[GC:([^\]]*)\]/.exec(String(text || ''));
    if (!match) {
        return null;
    }
    const words = match[1].trim().split(/\s+/).filter(Boolean);
    const modes = words.filter((w) => /^[GM]\d/.test(w));
    const pick = (re: RegExp) => modes.find((w) => re.test(w)) || null;
    const value = (letter: string) => {
        const word = words.find((w) => w[0] === letter && /^[A-Z][-+]?\d/.test(w));
        return word ? Number(word.slice(1)) : null;
    };
    const UNITS: { [code: string]: 'mm' | 'inch' } = { G21: 'mm', G20: 'inch' };
    const DISTANCE: { [code: string]: 'absolute' | 'relative' } = { G90: 'absolute', G91: 'relative' };
    const units = pick(/^G2[01]$/);
    const distance = pick(/^G9[01]$/);
    return {
        raw: match[0],
        modes,
        motion: pick(/^G(?:0|1|2|3|38\.\d|80)$/),
        workspace: pick(/^G5[4-9]$/),
        plane: pick(/^G1[789]$/),
        units: units ? UNITS[units] : null,
        distance: distance ? DISTANCE[distance] : null,
        feedMode: pick(/^G9[34]$/),
        spindle: pick(/^M[345]$/),
        coolant: modes.filter((w) => /^M[789]$/.test(w)),
        tool: value('T'),
        feed: value('F'),
        spindleSpeed: value('S'),
    };
}

export interface GrblBuildInfoView {
    version: string | null;
    options: string | null;
    lines: string[];
}

/** `$I` reply: `[VER:1.1f.20170801:]` `[OPT:V,15,128]`, plus any other bracketed lines kept raw. */
export function parseGrblBuildInfo(text: string | null | undefined): GrblBuildInfoView {
    const source = String(text || '');
    const version = /\[VER:([^\]]*)\]/.exec(source);
    const options = /\[OPT:([^\]]*)\]/.exec(source);
    const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^ok$/i.test(l));
    return {
        version: version ? version[1].replace(/:$/, '') : null,
        options: options ? options[1] : null,
        lines,
    };
}

export interface GrblStatusReport {
    raw: string;
    state: string;
    /** Machine position when reported ($10 bit 0 set). */
    mpos: number[] | null;
    /** Work position when reported instead. */
    wpos: number[] | null;
    /** Work coordinate offset, when this report carries one: WPos = MPos - WCO. */
    wco: number[] | null;
    fields: { [name: string]: string };
}

/** `?` reply: `<Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:...>`; null when there is no status report in the text. */
export function parseGrblStatus(text: string | null | undefined): GrblStatusReport | null {
    const match = /<([^>]*)>/.exec(String(text || ''));
    if (!match) {
        return null;
    }
    const [state, ...rest] = match[1].split('|');
    const fields: { [name: string]: string } = {};
    for (const field of rest) {
        const colon = field.indexOf(':');
        if (colon > 0) {
            fields[field.slice(0, colon)] = field.slice(colon + 1);
        }
    }
    return {
        raw: match[0],
        state: state.trim(),
        mpos: fields.MPos !== undefined ? numbers(fields.MPos) : null,
        wpos: fields.WPos !== undefined ? numbers(fields.WPos) : null,
        wco: fields.WCO !== undefined ? numbers(fields.WCO) : null,
        fields,
    };
}

// ---- M1005 ------------------------------------------------------------------

/**
 * The product SN in an M1005 reply. The Ray's exact wording is not
 * documented (the wiki only says M1005 reports machine info including the
 * SN), so this takes `SN: X`, `SN:X`, `Serial Number: X`, `Product SN: X`
 * (any case, `:` or `=`), 6+ characters of letters, digits, '-' or '_'. A value
 * made of one repeated character (0000..., FFFF...) is no SN. null when none.
 */
export function parseM1005Serial(text: string | null | undefined): string | null {
    const match = /(?:^|[^A-Za-z])(?:product\s*)?(?:SN|serial(?:\s*number)?)\s*[:=]\s*([A-Za-z0-9_-]{6,})/i.exec(String(text || ''));
    if (!match) {
        return null;
    }
    const sn = match[1];
    return /^(.)\1*$/.test(sn) ? null : sn;
}

// ---- What the MCP uses from a read ------------------------------------------

export interface FirmwareValue {
    value: number;
    /** The setting it came from, e.g. '$120'. */
    setting: string;
    unit: string;
}

export interface FirmwareValues {
    acceleration: { x: FirmwareValue | null; y: FirmwareValue | null };
    maxRate: { x: FirmwareValue | null; y: FirmwareValue | null };
    maxTravel: { x: FirmwareValue | null; y: FirmwareValue | null };
    sMax: FirmwareValue | null;
    sMin: FirmwareValue | null;
    laserMode: boolean | null;
}

function settingValue(settings: { [key: string]: GrblSetting }, key: string, unit: string): FirmwareValue | null {
    const setting = settings[key];
    return setting && typeof setting.value === 'number' && Number.isFinite(setting.value)
        ? { value: setting.value, setting: key, unit }
        : null;
}

/** The values the MCP uses, from a parsed `$$`: $120/$121 acceleration, $110/$111 max rate, $130/$131 travel, $30/$31 S range, $32. */
export function firmwareValuesFrom(settings: { [key: string]: GrblSetting }): FirmwareValues {
    const laser = settings.$32;
    return {
        acceleration: { x: settingValue(settings, '$120', 'mm/s^2'), y: settingValue(settings, '$121', 'mm/s^2') },
        maxRate: { x: settingValue(settings, '$110', 'mm/min'), y: settingValue(settings, '$111', 'mm/min') },
        maxTravel: { x: settingValue(settings, '$130', 'mm'), y: settingValue(settings, '$131', 'mm') },
        sMax: settingValue(settings, '$30', 'S'),
        sMin: settingValue(settings, '$31', 'S'),
        laserMode: laser && typeof laser.value === 'number' ? laser.value === 1 : null,
    };
}

/**
 * The acceleration the M4 short-segment rule should use: the LOWER of the X
 * and Y accelerations (a lower acceleration needs a longer distance to reach
 * feed, so the lower one never under-warns). null when neither was read or
 * neither is positive.
 */
export function laserAccelerationFrom(values: FirmwareValues | null | undefined): { value: number; settings: string[] } | null {
    if (!values) {
        return null;
    }
    const read = [values.acceleration.x, values.acceleration.y].filter((v): v is FirmwareValue => !!v && v.value > 0);
    if (!read.length) {
        return null;
    }
    const lowest = Math.min(...read.map((v) => v.value));
    return { value: lowest, settings: read.map((v) => v.setting) };
}
