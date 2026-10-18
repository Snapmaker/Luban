// The G-code dialect of each machine Luban knows, as DATA (multi-machine
// overhaul, tyeth/Luban#265, plan sections 1.2 and 2.1).
//
// Until now the MCP spoke one dialect - the Snapmaker 2.0 A350's - to every
// machine, and PR #264 bolted the Ray's GRBL forms on beside it. Each machine
// gets one row here instead: which frames its firmware takes and in which form
// the MCP must EMIT them, how it homes, how it reports status, its laser and
// spindle words and ranges, the code lists from Snapmaker's per-machine G-code
// reference, and whether this MCP has run on it at all. The planners, the
// validator and the capability gates read the row; nothing in it is guessed
// at run time.
//
// Facts are from Snapmaker's wiki (one page per machine, cited per row;
// fetched 2026-10-19 through a text-render proxy because the wiki renders
// without JS as an empty shell) and from Luban's own generators and controls.
// There is no wiki page for the Original: its row is from Luban's generators,
// unverified against any reference, and says so in its sources.
//
// This module is PURE (no server imports, unit-tested in
// tests/gcodeDialect.test.ts). It does not import machineCapability.ts, which
// derives MachineCapability.dialect / .supports from it.

export type DialectId = 'sm2-marlin' | 'artisan-marlin' | 'j1-marlin' | 'original-marlin' | 'ray-grbl' | 'unknown';

/**
 * How the MCP must WRITE a machine-frame (G53) move on this machine:
 * - 'own-line': `G53;` alone on its line, then the move, then `G54;` - the only
 *   form observed to work on the A350 (an inline `G53 G1 ...` was ignored
 *   there; validator.ts moves it to its own line).
 * - 'same-line': only as a prefix on the move's own line (GRBL: G53 is
 *   non-modal). The MCP still sends relative steps on such a machine
 *   (transportForm) and never relies on the prefix.
 * - 'none': G53/G54 are not documented for this firmware; the MCP never emits them.
 */
export type G53Form = 'own-line' | 'same-line' | 'none';

/**
 * What the MCP emits for its own XY/Z steps:
 * - 'sm2': absolute machine-frame steps (`G90 / G53; / G1 X.. Y.. F..; / G54;`), the A350 form.
 * - 'relative-steps': `G91 / G1 dX dY F / G90` with a `; mcp-settle machine X Y`
 *   comment, verified against the heartbeat per step - frame-independent, so the
 *   only form safe where G53 is unverified or absent.
 * - 'none': the machine is not in this table; the MCP emits nothing on it.
 */
export type TransportForm = 'sm2' | 'relative-steps' | 'none';

/** How the firmware homes: GRBL `$H`, Marlin `G28`, or the SACP home request (a channel call, not gcode). */
export type HomeForm = '$H' | 'G28' | 'sacp-request' | 'none';

/** How a position/status report is asked for outside the SACP/SSTP heartbeat. */
export type StatusQuery = 'M114' | 'grbl-?' | 'none';

export interface LaserDialect {
    /** M3 constant power; M4 dynamic (power scales with speed). */
    modes: ReadonlyArray<'M3' | 'M4'>;
    /** S word range: GRBL 0-1000 (S1000 = 100 %), Marlin PWM 0-255. */
    s: { min: number; max: number };
    /** The P word (0-100 %) where the firmware takes one; null on GRBL. */
    p: 'percent' | null;
    /** Which word wins when both are given. */
    precedence: 'P' | 'S';
    /** Air assist (coolant) words; null when the dialect has none. */
    air: { on: string; off: string } | null;
    /** Crosshair (red-dot pointer) lines; null when the dialect has none. */
    crosshair: { on: string; off: string } | null;
}

export interface SpindleDialect {
    /** M3 P0-100 % sets the speed as a percentage on every Snapmaker spindle. */
    p: 'percent';
    /** S as rpm (the 200 W module, usually 8000-18000); null where S is not rpm. */
    s: { min: number; max: number } | null;
}

export type CodeStatus = 'supported' | 'unverified' | 'incompatible' | 'unlisted';

export interface GcodeDialect {
    id: DialectId;
    /** Human name for refusal text. */
    label: string;
    family: 'marlin' | 'grbl' | 'unknown';
    /** Luban machineIdentifier(s) that speak this dialect (src/app/machines/*.ts). */
    identifiers: readonly string[];
    frames: {
        /** The form the MCP must EMIT (see G53Form). */
        g53: G53Form;
        /** Every form the firmware documents accepting, for reading files (the validator). */
        g53Accepted: ReadonlyArray<'own-line' | 'same-line'>;
        /** Workspace selects the firmware documents ('G54'..'G59.3'); [] when none. */
        workspaces: readonly string[];
        g92: boolean;
        g921: boolean;
    };
    distance: { g90: boolean; g91: boolean };
    home: {
        form: HomeForm;
        /**
         * The text the MCP would send for a gcode home, or null (SACP request,
         * or nothing). Not the send path - homeCommandFor (machineCapability.ts)
         * still decides that from the transport.
         */
        gcode: string | null;
        /** Homing is OBSERVED to home the rotary B axis too (the A350 comes back at B0). false = not observed. */
        homesB: boolean;
    };
    status: StatusQuery;
    laser: LaserDialect | null;
    spindle: SpindleDialect | null;
    /** The rotary axis word on G0/G1, or null. */
    rotaryAxis: 'B' | null;
    supported: readonly string[];
    unverified: readonly string[];
    incompatible: readonly string[];
    transportForm: TransportForm;
    /** This MCP has driven this dialect on real hardware. True only for 'sm2-marlin' - and within it only the A350. */
    verifiedOnHardware: boolean;
    sources: readonly string[];
}

// ---- Code lists -------------------------------------------------------------

/** "M104-M109" -> M104..M109. Only integer ranges; G54-G59.3 is spelt out (WORKSPACES_*). */
function codes(spec: string): string[] {
    const out: string[] = [];
    for (const token of spec.split(/\s+/).filter(Boolean)) {
        const range = /^([GM])(\d+)-[GM]?(\d+)$/.exec(token);
        if (range) {
            for (let n = Number(range[2]); n <= Number(range[3]); n += 1) {
                out.push(`${range[1]}${n}`);
            }
        } else {
            out.push(token);
        }
    }
    return out;
}

const WORKSPACES_G54_G59 = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
const WORKSPACES_G54_G59_3 = [...WORKSPACES_G54_G59, 'G59.1', 'G59.2', 'G59.3'];

/** Luban's own Home button for the Snapmaker 2.0 (machineCapability.ts G28_HOME_SEQUENCE; a test pins them equal). */
const SM2_HOME_GCODE = 'G53;\nG28;\nG54;';

export const WIKI = {
    ray: 'https://wiki.snapmaker.com/en/Snapmaker_Luban/manual/ray_supported_gcode_references',
    sm2: 'https://wiki.snapmaker.com/en/Snapmaker_Luban/manual/2_supported_gcode_references',
    artisan: 'https://wiki.snapmaker.com/en/Snapmaker_Luban/manual/artisan_supported_gcode_references',
    j1: 'https://wiki.snapmaker.com/en/Snapmaker_Luban/manual/j1_j1s_supported_gcode_references',
} as const;

// ---- The rows ---------------------------------------------------------------

// Snapmaker Ray: ESP32 GRBL V1.1f, wiki page for firmware V1.7.4 and later.
// G53 is a non-modal same-line prefix; G59.1-G59.3 unsupported; G92.1 resets
// the active offset; G4 P is SECONDS; M114 is not listed (status is `?`).
// Luban: $H home (ConnectionControl/ControlPanel.tsx goHome), jog G91/G1/G90
// and never G53 (ControlPanel.tsx), max_power 1000 for grbl (generateGcode.js),
// S scaled 1000/255 and P% x10 (GcodeGenerator.js), G92 X0 Y0 B0 to set origin
// (RaySetOriginWidget/SetOriginView.tsx - the source of the B axis; the wiki
// does not list it).
const RAY: GcodeDialect = {
    id: 'ray-grbl',
    label: 'Snapmaker Ray (GRBL 1.1f)',
    family: 'grbl',
    identifiers: ['Ray'],
    frames: { g53: 'same-line', g53Accepted: ['same-line'], workspaces: WORKSPACES_G54_G59, g92: true, g921: true },
    distance: { g90: true, g91: true },
    home: { form: '$H', gcode: '$H', homesB: false },
    status: 'grbl-?',
    laser: {
        modes: ['M3', 'M4'],
        s: { min: 0, max: 1000 },
        p: null,
        precedence: 'S',
        air: { on: 'M8', off: 'M9' },
        crosshair: { on: 'M2000 L13 P1', off: 'M2000 L13 P0' },
    },
    spindle: null,
    rotaryAxis: 'B',
    supported: [
        ...codes('G0 G1 G4 G17 G20 G21 G53'), ...WORKSPACES_G54_G59, ...codes('G90 G91 G92 G92.1'),
        ...codes('M3 M4 M5 M8 M9 M1005 M2000 M2003'),
    ],
    unverified: [],
    incompatible: ['G59.1', 'G59.2', 'G59.3'],
    transportForm: 'relative-steps',
    verifiedOnHardware: false,
    sources: [WIKI.ray, 'Luban generateGcode.js / GcodeGenerator.js / ControlPanel.tsx / SetOriginView.tsx'],
};

// Snapmaker 2.0 A150 / A250 / A350: Marlin 2.0.x base. The wiki accepts G53
// alone on a line AND as a same-line prefix; this MCP observed the inline form
// ignored on the A350, so own-line is the only form it emits. G54-G59.3 exist,
// only G53/G54 recommended. G92 yes, G92.1 undocumented. Laser P 0-100 % and S
// PWM 0-255, P wins; M7/M8 air on, M9 off (20 W/40 W modules only); crosshair
// M2002 T3. 200 W CNC: S rpm, usually 8000-18000. G28 homes B too on the A350
// (programEnvelope.ts) - observed only on the A350.
const SM2: GcodeDialect = {
    id: 'sm2-marlin',
    label: 'Snapmaker 2.0 (Marlin 2.0.x)',
    family: 'marlin',
    identifiers: ['Snapmaker 2.0 A150', 'Snapmaker 2.0 A250', 'Snapmaker 2.0 A350'],
    frames: { g53: 'own-line', g53Accepted: ['own-line', 'same-line'], workspaces: WORKSPACES_G54_G59_3, g92: true, g921: false },
    distance: { g90: true, g91: true },
    home: { form: 'G28', gcode: SM2_HOME_GCODE, homesB: true },
    status: 'M114',
    laser: {
        modes: ['M3', 'M4'],
        s: { min: 0, max: 255 },
        p: 'percent',
        precedence: 'P',
        air: { on: 'M8', off: 'M9' },
        crosshair: { on: 'M2002 T3 P1', off: 'M2002 T3 P0' },
    },
    spindle: { p: 'percent', s: { min: 8000, max: 18000 } },
    rotaryAxis: 'B',
    supported: [
        ...codes('G0 G1 G4 G20 G21 G28 G42 G53'), ...WORKSPACES_G54_G59_3, ...codes('G90 G91 G92 G1029'),
        ...codes('M3 M4 M5 M7 M8 M9 M76 M82 M83 M92 M101 M104-M109 M111 M114 M115 M118 M119 M140 M155 M190 M201'),
        ...codes('M203-M205 M211 M220 M221 M301 M302 M400 M412 M420 M425 M500-M504 M600 M900 M1005 M1006 M1010 M1011'),
        ...codes('M2000 M2002 T0 T1'),
    ],
    unverified: codes('G2 G3 G27 G30 M17 M18 M84 M110 M113 M421'),
    incompatible: codes('G29 G38 M25 M31 M42 M75 M77 M81 M85 M112 M117 M120 M121 M206 M217 M218 M226 M303 M401 M402 M410 M413 M428 M851 M999'),
    transportForm: 'sm2',
    verifiedOnHardware: true,
    sources: [WIKI.sm2, 'this MCP on the A350 (own-line G53, G28 homes B); A150/A250 never run with it'],
};

// Snapmaker Artisan (identifier 'A400'). Same G53 wording as the 2.0 (alone
// or same-line); G54-G59.3, only G53/G54 recommended; G92.1 resets the
// selected workspace; G21 only (G20 unsupported); laser P 0-100 % / S 0-255,
// P wins, parameterless M3 allowed on the laser but NOT on CNC; CNC S
// 8000-18000 rpm; M7/M8 air on, M9 off; crosshair M2000 L13; M1005 reports the
// product SN. Homed by the SACP request (PR #264). Never run with this MCP.
const ARTISAN: GcodeDialect = {
    id: 'artisan-marlin',
    label: 'Snapmaker Artisan (Marlin 2.0.x)',
    family: 'marlin',
    identifiers: ['A400'],
    frames: { g53: 'own-line', g53Accepted: ['own-line', 'same-line'], workspaces: WORKSPACES_G54_G59_3, g92: true, g921: true },
    distance: { g90: true, g91: true },
    home: { form: 'sacp-request', gcode: null, homesB: false },
    status: 'M114',
    laser: {
        modes: ['M3', 'M4'],
        s: { min: 0, max: 255 },
        p: 'percent',
        precedence: 'P',
        air: { on: 'M8', off: 'M9' },
        crosshair: { on: 'M2000 L13 P1', off: 'M2000 L13 P0' },
    },
    spindle: { p: 'percent', s: { min: 8000, max: 18000 } },
    rotaryAxis: 'B',
    supported: [
        ...codes('G0 G1 G4 G21 G28 G42 G53'), ...WORKSPACES_G54_G59_3, ...codes('G90 G91 G92 G92.1'),
        ...codes('M3 M4 M5 M7 M8 M9 M82 M83 M92 M101 M104-M109 M111 M114 M115 M118 M119 M140 M155 M190 M201'),
        ...codes('M203-M205 M211 M220 M221 M301 M302 M400 M412 M420 M500-M504 M593 M600 M900 M1005 M1006 M2000 T0 T1'),
    ],
    unverified: codes('G2 G3 G27 G29 G30 M110 M113 M122 M200 M421 M906'),
    incompatible: codes(
        'G20 M17 M18 M31 M42 M75 M76 M77 M81 M84 M85 M112 M120 M121 M206 M217 M218 M226 M290 M303 M401 M402 M410 M428 M569 M710 M851 M997 M999'
    ),
    transportForm: 'sm2',
    verifiedOnHardware: false,
    sources: [WIKI.artisan, 'PR #264 (SACP home request)'],
};

// Snapmaker J1 / J1s: IDEX printer, Marlin 2.0.x, wiki for firmware 2.7.2+.
// G53/G54-G59 are not mentioned at all -> 'none'; G92 yes, G92.1 not
// (incompatible); G21 only; no laser, spindle or air words. Homed by the SACP
// request (PR #264). Never run with this MCP.
const J1: GcodeDialect = {
    id: 'j1-marlin',
    label: 'Snapmaker J1 (Marlin 2.0.x)',
    family: 'marlin',
    identifiers: ['Snapmaker J1'],
    frames: { g53: 'none', g53Accepted: [], workspaces: [], g92: true, g921: false },
    distance: { g90: true, g91: true },
    home: { form: 'sacp-request', gcode: null, homesB: false },
    status: 'M114',
    laser: null,
    spindle: null,
    rotaryAxis: null,
    supported: [
        ...codes('G0 G1 G4 G21 G28 G90 G91 G92'),
        ...codes('M17 M18 M82 M83 M84 M92 M101 M104-M109 M111 M114 M115 M118 M119 M140 M155 M190 M201 M203-M205'),
        ...codes('M211 M220 M221 M301 M303 M304 M355 M400 M412 M500-M504 M593 M600 M605 M900 T0 T1'),
    ],
    unverified: codes('G2 G3 M110 M113 M122 M569 M906'),
    incompatible: codes('G20 G92.1 M31 M75 M76 M77 M81 M85 M112 M120 M121 M141 M191 M200 M206 M217 M218 M410 M428 M999'),
    transportForm: 'relative-steps',
    verifiedOnHardware: false,
    sources: [WIKI.j1, 'PR #264 (SACP home request)'],
};

// Snapmaker Original / Original Long Z-axis: USB text-serial only, firmware
// Snapmaker-Base (Marlin 1.x lineage). NO WIKI PAGE - from Luban generators,
// unverified against wiki. Marlin 1.x has no workspace select, so G53/G54 are
// treated as absent. Luban: laser `M3 P<percent> S<0-255>` then M5
// (GcodeGenerator.js, generateLaserFocusGcode.js), CNC M3 P% (parseAsCNC), M114
// position reports (MarlinController.js). Home: R6 has the MCP send G28 alone.
// NOTE Luban's own Home button on text serial (ConnectionManager.goHome) sends
// G53 then G28 (and G54 for laser/CNC heads) to every non-SACP machine, the
// Original included - what its firmware makes of G53/G54 is unverified.
const ORIGINAL: GcodeDialect = {
    id: 'original-marlin',
    label: 'Snapmaker Original (Marlin 1.x, unverified)',
    family: 'marlin',
    identifiers: ['Original', 'Original Long Z-axis'],
    frames: { g53: 'none', g53Accepted: [], workspaces: [], g92: true, g921: false },
    distance: { g90: true, g91: true },
    home: { form: 'G28', gcode: 'G28', homesB: false },
    status: 'M114',
    laser: {
        modes: ['M3'],
        s: { min: 0, max: 255 },
        p: 'percent',
        precedence: 'P',
        air: null,
        crosshair: null,
    },
    spindle: { p: 'percent', s: null },
    rotaryAxis: null,
    supported: codes('G0 G1 G4 G28 G90 G91 G92 M3 M5 M114'),
    unverified: [],
    incompatible: [],
    transportForm: 'relative-steps',
    verifiedOnHardware: false,
    sources: [
        'from Luban generators, unverified against wiki (no Snapmaker wiki page for the Original): '
        + 'GcodeGenerator.js, generateLaserFocusGcode.js, MarlinController.js, ConnectionManager.goHome',
    ],
};

/** A machine not in this table: nothing is known, so the MCP emits nothing on it. */
const UNKNOWN: GcodeDialect = {
    id: 'unknown',
    label: 'unknown machine',
    family: 'unknown',
    identifiers: [],
    frames: { g53: 'none', g53Accepted: [], workspaces: [], g92: false, g921: false },
    distance: { g90: false, g91: false },
    home: { form: 'none', gcode: null, homesB: false },
    status: 'none',
    laser: null,
    spindle: null,
    rotaryAxis: null,
    supported: [],
    unverified: [],
    incompatible: [],
    transportForm: 'none',
    verifiedOnHardware: false,
    sources: ['not in the MCP dialect table (gcodeDialect.ts)'],
};

export const DIALECTS: readonly GcodeDialect[] = [RAY, SM2, ARTISAN, J1, ORIGINAL, UNKNOWN];

/** The row for a dialect id. */
export function dialectById(id: DialectId): GcodeDialect {
    return DIALECTS.find((dialect) => dialect.id === id) || UNKNOWN;
}

/**
 * The dialect of a machine, from its Luban definition or its
 * machineIdentifier. An identifier the table does not list (or none) gets the
 * 'unknown' row, which emits nothing: refuse rather than guess.
 */
export function dialectFor(definitionOrIdentifier: { identifier: string } | string | null | undefined): GcodeDialect {
    let identifier: string | null = null;
    if (typeof definitionOrIdentifier === 'string') {
        identifier = definitionOrIdentifier;
    } else if (definitionOrIdentifier) {
        identifier = definitionOrIdentifier.identifier;
    }
    if (!identifier) {
        return UNKNOWN;
    }
    return DIALECTS.find((dialect) => dialect.identifiers.includes(identifier)) || UNKNOWN;
}

/** Whether the MCP emits anything at all on this dialect (false only for 'unknown'). */
export function dialectEmits(dialect: GcodeDialect): boolean {
    return dialect.transportForm !== 'none';
}

/** Where a code word ('G38', 'M2000', 'G59.1') stands in this dialect's reference. */
export function codeStatus(dialect: GcodeDialect, word: string): CodeStatus {
    const code = word.trim().toUpperCase();
    if (dialect.incompatible.includes(code)) {
        return 'incompatible';
    }
    if (dialect.supported.includes(code)) {
        return 'supported';
    }
    if (dialect.unverified.includes(code)) {
        return 'unverified';
    }
    return 'unlisted';
}
