// Machine-aware rules the G-code validator applies once it knows which machine
// a program is for (multi-machine overhaul, tyeth/Luban#265, plan section 2.3
// and amendment R8).
//
// Until now validator.ts judged every file by the Snapmaker 2.0 A350's rules,
// whatever was connected: an own-line `G53` was the frame declaration it
// asked for on the Ray too (where GRBL ignores it), S1000 passed on a Marlin
// laser (four times its 0-255 PWM scale), and an A350 CNC file reached the
// Ray's confirm page. Each rule here reads the machine's dialect row
// (gcodeDialect.ts) and returns findings with a stable id, so a report can say
// which rules it was judged by (`machine.rulesApplied`) and a refusal can name
// its rule.
//
// Phases. The same file is judged at three points, and two rules depend on
// which (R8):
// - 'validate' (validate_gcode): nothing is sent. A code the machine's
//   reference calls incompatible, and a header naming another machine, are
//   WARNINGS here - the agent is asking what is wrong.
// - 'submit' (submit_gcode_job): the body will be streamed to the machine
//   as written, so both are REFUSALS.
// - 'staged' (a body the server emitted, tools/staging.ts): it is sent too, so
//   incompatible codes refuse. Probe programs and thread-milling conversions
//   TRANSLATE their G38.x / Fanuc input before staging (probeCam.ts,
//   threadMilling.ts), so the body judged here is the translated one - a G38
//   appears in it only inside comments, which are never parsed.
//
// Pure: no server imports, unit-tested in tests/dialectRules.test.ts. The
// validator hands in its parsed lines (RuleLine) so there is one G-code parser.

import { CodeStatus, GcodeDialect, codeStatus } from './gcodeDialect';
import { GcodeHeader } from './gcodeHeader';
import { ResolvedTravel, describeTravel, outsideTravel } from './machineTravel';

export type DialectRuleId =
    | 'unknown-command'
    | 'frame-form'
    | 's-range'
    | 'laser-mode-dynamic-short-segments'
    | 'z-on-zless'
    | 'travel'
    | 'header-machine'
    | 'homing-form';

/** Every rule, in the order the report lists them. */
export const DIALECT_RULE_IDS: readonly DialectRuleId[] = [
    'unknown-command',
    'frame-form',
    's-range',
    'laser-mode-dynamic-short-segments',
    'z-on-zless',
    'travel',
    'header-machine',
    'homing-form',
];

export type RulePhase = 'validate' | 'submit' | 'staged';

/**
 * The acceleration the M4 short-segment rule assumes, in mm/s^2. ASSUMPTION,
 * not a bound: the Ray's GRBL `$120/$121` (X/Y acceleration) has never been
 * read by this MCP and Snapmaker publishes no figure. 1000 mm/s^2 is the order
 * of a desktop gantry's default; the warning states it so an operator who
 * knows the real value can rescale the threshold (it scales as 1/a).
 */
export const ASSUMED_LASER_ACCELERATION_MM_S2 = 1000;

/** One parsed program line, as validator.ts parses it (comments stripped). */
export interface RuleLine {
    /** 1-based line number. */
    lineNo: number;
    /** The line with comments stripped, trimmed, upper case - for `$` commands the code parser skips. */
    bare: string;
    /** Every G/M code on the line, normalised (G01 -> G1), in order. */
    codes: string[];
    /** Non-code words: X/Y/Z/B/F/S/P ... */
    words: { [letter: string]: number };
}

export interface DialectRuleContext {
    dialect: GcodeDialect;
    /** The connected machine's identifier ('Ray', 'Snapmaker 2.0 A350'), or null when unknown. */
    machineIdentifier: string | null;
    hasZ: boolean;
    /** MachineCapability.supports.rotary - the rotary procedures and a 4-axis job are admissible. */
    supportsRotary: boolean;
    /** The XY travel (model + fudge, tightened by statements); null = not checked. */
    travel: ResolvedTravel | null;
    header: GcodeHeader | null;
    /** The head the job is staged for (submit head_type), when the caller knows it. */
    headType: string | null;
    phase: RulePhase;
    /** Frame facts from the validator. */
    frame: { declared: 'machine' | 'work' | null; source: 'gcode' | 'argument' | null; mixed: boolean };
    /** Raw XY extents (machine coordinates only when frame.declared === 'machine' from the gcode). */
    extents: { x: { min: number; max: number } | null; y: { min: number; max: number } | null };
}

export interface RuleFinding {
    rule: DialectRuleId;
    severity: 'warning' | 'refusal';
    message: string;
}

export interface DialectRuleResult {
    rulesApplied: DialectRuleId[];
    findings: RuleFinding[];
    /** The warning findings' messages, in rule order. */
    warnings: string[];
    /** The refusal findings' messages, in rule order. Non-empty = submit_gcode_job / staging refuse. */
    refusals: string[];
    /**
     * Codes the dialect's reference lists as unverified or does not list at
     * all, with their first line. On a dialect this MCP has run on hardware
     * (the A350) these are reported here and NOT warned: real A350 CAM files
     * carry G2/G3 and G17 and have streamed fine.
     */
    codesOutsideReference: Array<{ code: string; status: CodeStatus; firstLine: number }>;
}

const MOTION_RE = /^G0*[0123](?:\.\d+)?$/;
const CUT_RE = /^G0*[123]$/;
const WORKSPACE_RE = /^G(?:5[4-9]|59\.[123])$/;
const MAX_LINES_LISTED = 8;

function listLines(lines: number[]): string {
    const shown = lines.slice(0, MAX_LINES_LISTED).join(', ');
    return lines.length > MAX_LINES_LISTED ? `${shown} (+${lines.length - MAX_LINES_LISTED} more)` : shown;
}

function round(value: number, places = 3): number {
    return Number(value.toFixed(places));
}

/**
 * A code's place in the dialect's reference. A dotted code the reference does
 * not list exactly is judged by its integer form - `G38.2` by `G38` (the SM2
 * incompatible list names the cycle, not each variant) - while one it does list
 * exactly (`G59.1` on the Ray, `G92.1`) keeps its own entry.
 */
export function codeStatusOf(dialect: GcodeDialect, code: string): CodeStatus {
    const exact = codeStatus(dialect, code);
    if (exact !== 'unlisted' || code.indexOf('.') === -1) {
        return exact;
    }
    return codeStatus(dialect, code.slice(0, code.indexOf('.')));
}

/** Is this a laser job? From the header, then the staged head type, then the machine (a laser-only dialect). */
export function isLaserJob(ctx: Pick<DialectRuleContext, 'dialect' | 'header' | 'headType'>): boolean {
    if (ctx.header && ctx.header.headerType) {
        return ctx.header.headerType === 'laser';
    }
    if (ctx.dialect.laser && !ctx.dialect.spindle) {
        // The Ray: whatever head_type the caller defaulted to, the only head is a laser.
        return true;
    }
    return ctx.headType === 'laser';
}

function machineName(ctx: DialectRuleContext): string {
    return ctx.machineIdentifier ? `the ${ctx.machineIdentifier} (${ctx.dialect.id})` : `this machine (${ctx.dialect.id})`;
}

// ---- Rules ------------------------------------------------------------------

type Push = (rule: DialectRuleId, severity: 'warning' | 'refusal', message: string) => void;

function unknownCommand(lines: RuleLine[], ctx: DialectRuleContext, push: Push,
    outside: DialectRuleResult['codesOutsideReference']): void {
    const incompatible = new Map<string, number[]>();
    const firstSeen = new Map<string, { status: CodeStatus; line: number }>();
    for (const line of lines) {
        for (const code of line.codes) {
            // homing-form judges G28 where the firmware homes with $H.
            if (code === 'G28' && ctx.dialect.home.form === '$H') {
                continue;
            }
            const status = codeStatusOf(ctx.dialect, code);
            if (status === 'incompatible') {
                const at = incompatible.get(code) || [];
                at.push(line.lineNo);
                incompatible.set(code, at);
            } else if (status !== 'supported' && !firstSeen.has(code)) {
                firstSeen.set(code, { status, line: line.lineNo });
            }
        }
    }
    for (const [code, seen] of firstSeen) {
        outside.push({ code, status: seen.status, firstLine: seen.line });
    }
    if (incompatible.size) {
        const what = [...incompatible].map(([code, at]) => `${code} (line ${listLines(at)})`).join(', ');
        const why = `the ${ctx.dialect.label} G-code reference lists ${incompatible.size === 1 ? 'it' : 'them'} as incompatible `
            + `(${ctx.dialect.sources[0]})`;
        if (ctx.phase === 'validate') {
            push('unknown-command', 'warning', `[unknown-command] ${what}: ${why}. submit_gcode_job REFUSES a file that sends `
                + `${incompatible.size === 1 ? 'it' : 'them'}. A probing program (G38.x) goes through run_probing_gcode, which translates the `
                + 'cycles instead of sending them; a Fanuc thread-milling program through convert_thread_milling_gcode.');
        } else {
            push('unknown-command', 'refusal', `Refused [unknown-command]: ${what} would be sent to ${machineName(ctx)}, and ${why}. `
                + 'Remove them. A probing program (G38.x) goes through run_probing_gcode, which translates the cycles instead of '
                + 'sending them; a Fanuc thread-milling program through convert_thread_milling_gcode.');
        }
    }
    if (!ctx.dialect.verifiedOnHardware && outside.length) {
        const what = outside.map((o) => `${o.code} (${o.status}, line ${o.firstLine})`).join(', ');
        push('unknown-command', 'warning', `[unknown-command] ${what}: not confirmed by the ${ctx.dialect.label} G-code reference, `
            + `and this MCP has never run this dialect on hardware. The firmware may ignore or reject ${outside.length === 1 ? 'it' : 'them'}.`);
    }
}

function frameForm(lines: RuleLine[], ctx: DialectRuleContext, push: Push): void {
    const g53 = ctx.dialect.frames.g53;
    if (g53 === 'same-line') {
        const alone = lines.filter((l) => l.codes.includes('G53') && !l.codes.some((c) => MOTION_RE.test(c))).map((l) => l.lineNo);
        if (alone.length) {
            push('frame-form', 'refusal', `Refused [frame-form]: G53 alone on line(s) ${listLines(alone)}. On ${machineName(ctx)} `
                + 'G53 is NON-MODAL (GRBL): alone on a line it has no effect, and the next move runs in the active work '
                + 'workspace (G54) - not in machine coordinates. GRBL takes G53 only as a prefix on the move\'s own line '
                + '(`G53 G0 X.. Y..`). A Luban export for this machine uses neither: submit it with frame: "work".');
        }
    } else if (g53 === 'none') {
        const frameLines = lines.filter((l) => l.codes.some((c) => c === 'G53' || WORKSPACE_RE.test(c))).map((l) => l.lineNo);
        if (frameLines.length) {
            push('frame-form', 'refusal', `Refused [frame-form]: G53/G54..G59 on line(s) ${listLines(frameLines)}, but the `
                + `${ctx.dialect.label} documents no workspace frames (${ctx.dialect.sources[0]}) and this MCP never sends them `
                + `to ${machineName(ctx)}. Remove them; positions there are relative to the origin set with G92, so submit with frame: "work".`);
        }
    }
    // 'own-line' (the Snapmaker 2.0, Artisan): the inline-G53 warning is the
    // validator's own, unchanged since 2026-09 - credited to this rule.
}

interface LaserState {
    mode: 'M3' | 'M4' | null;
    s: number | null;
    f: number | null;
}

function sRange(lines: RuleLine[], ctx: DialectRuleContext, push: Push): void {
    const laser = ctx.dialect.laser;
    if (!laser || !isLaserJob(ctx)) {
        return;
    }
    let maxS: number | null = null;
    let maxSLine = 0;
    const overS: number[] = [];
    const badP: number[] = [];
    for (const line of lines) {
        const isLaserCode = line.codes.includes('M3') || line.codes.includes('M4');
        const isMotion = line.codes.some((c) => MOTION_RE.test(c));
        // S is the laser power only on M3/M4 and motion lines (the same
        // lines the report's spindle.maxS counts); M104 S200 or G4 S5 are not power.
        if ((isLaserCode || isMotion) && line.words.S !== undefined) {
            if (maxS === null || line.words.S > maxS) {
                maxS = line.words.S;
                maxSLine = line.lineNo;
            }
            if (line.words.S > laser.s.max || line.words.S < laser.s.min) {
                overS.push(line.lineNo);
            }
        }
        if (isLaserCode && laser.p === 'percent' && line.words.P !== undefined && (line.words.P < 0 || line.words.P > 100)) {
            badP.push(line.lineNo);
        }
    }
    if (overS.length && maxS !== null) {
        const otherScale = laser.s.max === 1000
            ? ''
            : ` S0-1000 is the GRBL (Ray) scale; on this Marlin laser S${maxS} is ${round(maxS / laser.s.max, 1)}x full power - `
                + `use P0-100 (percent) or S0-${laser.s.max}.`;
        push('s-range', 'refusal', `Refused [s-range]: laser power S${maxS} (line ${maxSLine}; ${overS.length} line(s) out of range: `
            + `${listLines(overS)}) is outside S${laser.s.min}-${laser.s.max} on ${machineName(ctx)}.${otherScale}`);
    }
    if (badP.length) {
        push('s-range', 'refusal', `Refused [s-range]: M3/M4 P on line(s) ${listLines(badP)} is outside 0-100 (P is a percentage of full power).`);
    }
    // The flavour hint: a file written for the other scale still in range here.
    const flavour = ctx.header && ctx.header.gcodeFlavor ? ctx.header.gcodeFlavor.toLowerCase() : null;
    if (!overS.length && maxS !== null && maxS > 0 && laser.s.max === 1000 && flavour === 'marlin') {
        push('s-range', 'warning', `[s-range] S${maxS} on ${machineName(ctx)} is ${round((maxS / laser.s.max) * 100, 1)} % power `
            + '(GRBL scale S0-1000), but the header says this file was written for Marlin (S0-255): '
            + `did you mean S${round((maxS * 1000) / 255, 0)}?`);
    }
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The distance a move needs to reach feed `f` (mm/min) from rest at
 * acceleration `a` (mm/s^2): v^2 / 2a.
 */
export function accelerationDistanceMm(f: number, a: number = ASSUMED_LASER_ACCELERATION_MM_S2): number {
    const v = f / 60;
    return (v * v) / (2 * a);
}

function dynamicShortSegments(lines: RuleLine[], ctx: DialectRuleContext, push: Push): void {
    const laser = ctx.dialect.laser;
    if (!laser || !laser.modes.includes('M4') || !isLaserJob(ctx)) {
        return;
    }
    // Luban's only raster marker: greyscale-dot jobs are written renderMethod: point.
    if (ctx.header && ctx.header.renderMethods.includes('point')) {
        return;
    }
    const state: LaserState = { mode: null, s: null, f: null };
    let relative = false;
    let x: number | null = null;
    let y: number | null = null;
    let cuts = 0;
    let unknownFeed = 0;
    const short: Array<{ length: number; f: number; s: number }> = [];
    for (const line of lines) {
        for (const code of line.codes) {
            if (code === 'M3' || code === 'M4') {
                state.mode = code;
            } else if (code === 'M5') {
                state.mode = null;
            } else if (code === 'G90') {
                relative = false;
            } else if (code === 'G91') {
                relative = true;
            } else if (code === 'G92' || code === 'G28' || code === 'G53') {
                // The origin or frame changed under us: the next segment's start is unknown.
                x = null;
                y = null;
            }
        }
        const motion = line.codes.find((c) => MOTION_RE.test(c)) || null;
        if ((line.codes.includes('M3') || line.codes.includes('M4') || motion) && line.words.S !== undefined) {
            state.s = line.words.S;
        }
        if (motion && line.words.F !== undefined) {
            state.f = line.words.F;
        }
        if (!motion || line.codes.includes('G53')) {
            continue;
        }
        const hasXy = line.words.X !== undefined || line.words.Y !== undefined;
        if (!hasXy) {
            continue;
        }
        let length: number | null = null;
        if (relative) {
            length = Math.hypot(line.words.X || 0, line.words.Y || 0);
            // Increments say nothing about where the next absolute move starts.
            x = null;
            y = null;
        } else {
            const nx: number | null = line.words.X !== undefined ? line.words.X : x;
            const ny: number | null = line.words.Y !== undefined ? line.words.Y : y;
            if (x !== null && y !== null && nx !== null && ny !== null) {
                length = Math.hypot(nx - x, ny - y);
            }
            x = nx;
            y = ny;
        }
        if (!CUT_RE.test(motion) || state.mode !== 'M4' || state.s === null || state.s <= 0 || length === null || length === 0) {
            continue;
        }
        cuts += 1;
        if (state.f === null) {
            unknownFeed += 1;
            continue;
        }
        if (length < accelerationDistanceMm(state.f)) {
            short.push({ length, f: state.f, s: state.s });
        }
    }
    if (!short.length) {
        if (unknownFeed) {
            push('laser-mode-dynamic-short-segments', 'warning', `[laser-mode-dynamic-short-segments] ${unknownFeed} M4 cutting `
                + 'segment(s) run before any F word, so whether they reach their feed could not be judged. State F before cutting.');
        }
        return;
    }
    const feeds = [...new Set(short.map((s) => s.f))].sort((a, b) => b - a);
    const fastest = feeds[0];
    const powers = [...new Set(short.map((s) => s.s))].sort((a, b) => b - a);
    const unjudged = unknownFeed ? ` (${unknownFeed} more M4 segment(s) ran before any F word and were not judged.)` : '';
    push('laser-mode-dynamic-short-segments', 'warning', `[laser-mode-dynamic-short-segments] ${short.length} of ${cuts} M4 (dynamic power) `
        + `cutting segments are shorter than the distance needed to reach their programmed feed (median ${round(median(short.map((s) => s.length)))} mm; `
        + `at F${fastest} that distance is ${round(accelerationDistanceMm(fastest))} mm). In M4 the firmware scales power by the speed ACHIEVED, `
        + `so these segments never reach S${powers[0]}${powers.length > 1 ? ` (S ${powers.join('/')})` : ''} - a short opening can fail to `
        + `fire at all. ASSUMPTION: acceleration ${ASSUMED_LASER_ACCELERATION_MM_S2} mm/s^2 (the controller's real value was not read; `
        + `the threshold is (F/60)^2 / (2a)). Feeds involved: F${feeds.slice(0, 4).join(', F')}${feeds.length > 4 ? ' ...' : ''}. `
        + `Fix: use M3 (constant power) for cuts, or lower F.${unjudged}`);
}

function zOnZless(lines: RuleLine[], ctx: DialectRuleContext, push: Push): void {
    if (ctx.hasZ) {
        return;
    }
    const zLines = lines.filter((l) => l.words.Z !== undefined && l.codes.some((c) => MOTION_RE.test(c))).map((l) => l.lineNo);
    if (zLines.length) {
        push('z-on-zless', 'refusal', `Refused [z-on-zless]: Z words on motion line(s) ${listLines(zLines)}, but ${machineName(ctx)} has `
            + 'no Z axis. Remove them (focus is set by hand on this machine).');
    }
}

function travelRule(ctx: DialectRuleContext, push: Push): void {
    // Only literal machine coordinates can be held against the travel: a
    // work-frame file's XY sit on an origin this check does not know.
    if (!ctx.travel || ctx.frame.declared !== 'machine' || ctx.frame.source !== 'gcode' || ctx.frame.mixed) {
        return;
    }
    const { x, y } = ctx.extents;
    if (!x && !y) {
        return;
    }
    const clauses: string[] = [];
    const low = outsideTravel({ x: x ? x.min : ctx.travel.limits.xMin, y: y ? y.min : ctx.travel.limits.yMin }, ctx.travel.limits);
    const high = outsideTravel({ x: x ? x.max : ctx.travel.limits.xMax, y: y ? y.max : ctx.travel.limits.yMax }, ctx.travel.limits);
    if (low) clauses.push(low);
    // A one-point file overshoots at both corners with the same words.
    if (high && high !== low) clauses.push(high);
    if (clauses.length) {
        push('travel', 'refusal', `Refused [travel]: the machine-frame extents are outside the toolhead travel: ${clauses.join(' and ')} `
            + `(${describeTravel(ctx.travel, ctx.machineIdentifier)}). Move the program inside it; widen the travel fudge `
            + '(mcpTravelFudgeMm) only if this rig genuinely reaches there.');
    }
}

function headerMachine(ctx: DialectRuleContext, push: Push): void {
    const header = ctx.header;
    if (!header) {
        return;
    }
    if (header.machine && ctx.machineIdentifier && header.machine !== ctx.machineIdentifier) {
        const text = `the file's Luban header says it was generated for "${header.machine}" (;machine:, header lines `
            + `${header.startLine}-${header.endLine}) but the connected machine is "${ctx.machineIdentifier}". Luban generates per `
            + 'machine - bed size, travel, origin and G-code dialect differ, even between models of one family (an A250 file on an A350).';
        if (ctx.phase === 'validate') {
            push('header-machine', 'warning', `[header-machine] ${text} submit_gcode_job REFUSES it: re-export it from Luban for the connected machine.`);
        } else {
            push('header-machine', 'refusal', `Refused [header-machine]: ${text} Re-export it from Luban for the connected machine.`);
        }
    }
    const flavour = header.gcodeFlavor ? header.gcodeFlavor.toLowerCase() : null;
    if (flavour && ctx.dialect.family !== 'unknown' && flavour !== ctx.dialect.family) {
        push('header-machine', 'refusal', `Refused [header-machine]: the header says ;gcode_flavor: ${header.gcodeFlavor}, but ${machineName(ctx)} `
            + `speaks ${ctx.dialect.family} (${ctx.dialect.label}). Homing, frames and the laser power scale differ between the two.`);
    }
    if (header.isRotate === true && !ctx.supportsRotary) {
        push('header-machine', 'refusal', 'Refused [header-machine]: the header says ;is_rotate: true (a rotary 4-axis job), but the rotary '
            + `is not supported on ${machineName(ctx)} by this MCP.`);
    }
}

function homingForm(lines: RuleLine[], ctx: DialectRuleContext, push: Push): void {
    const home = ctx.dialect.home.form;
    if (ctx.dialect.family === 'marlin') {
        const grblHome = lines.filter((l) => /^\$H\b/.test(l.bare)).map((l) => l.lineNo);
        if (grblHome.length) {
            push('homing-form', 'refusal', `Refused [homing-form]: $H on line(s) ${listLines(grblHome)} is GRBL's home command; `
                + `${machineName(ctx)} runs Marlin, which homes with G28.`);
        }
    }
    if (home === '$H') {
        const g28 = lines.filter((l) => l.codes.includes('G28')).map((l) => l.lineNo);
        if (g28.length) {
            push('homing-form', 'refusal', `Refused [homing-form]: G28 on line(s) ${listLines(g28)}, but ${machineName(ctx)} homes with `
                + '$H (GRBL), where G28 is "go to a stored position", not a home. Home with the home tool before the job instead.');
        }
    }
}

/** Apply every machine-aware rule to a parsed program. */
export function applyDialectRules(lines: RuleLine[], ctx: DialectRuleContext): DialectRuleResult {
    const findings: RuleFinding[] = [];
    const push: Push = (rule, severity, message) => {
        findings.push({ rule, severity, message });
    };
    const codesOutsideReference: DialectRuleResult['codesOutsideReference'] = [];
    const rulesApplied: DialectRuleId[] = ['unknown-command', 'frame-form'];
    unknownCommand(lines, ctx, push, codesOutsideReference);
    frameForm(lines, ctx, push);
    if (ctx.dialect.laser && isLaserJob(ctx)) {
        rulesApplied.push('s-range');
        sRange(lines, ctx, push);
        if (ctx.dialect.laser.modes.includes('M4')) {
            rulesApplied.push('laser-mode-dynamic-short-segments');
            dynamicShortSegments(lines, ctx, push);
        }
    }
    if (!ctx.hasZ) {
        rulesApplied.push('z-on-zless');
        zOnZless(lines, ctx, push);
    }
    if (ctx.travel && ctx.phase !== 'staged') {
        rulesApplied.push('travel');
        travelRule(ctx, push);
    }
    if (ctx.phase !== 'staged') {
        rulesApplied.push('header-machine');
        headerMachine(ctx, push);
    }
    rulesApplied.push('homing-form');
    homingForm(lines, ctx, push);
    return {
        rulesApplied,
        findings,
        warnings: findings.filter((f) => f.severity === 'warning').map((f) => f.message),
        refusals: findings.filter((f) => f.severity === 'refusal').map((f) => f.message),
        codesOutsideReference,
    };
}
