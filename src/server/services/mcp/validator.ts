/**
 * Static G-code inspection for the MCP gate.
 *
 * Reports facts an agent and a human reviewer need before a job runs:
 * motion extents, feeds, spindle commands, the coordinate FRAME the job
 * declares, and hazards worth flagging. It renders judgment material, not
 * judgment - starting a job still requires human confirmation - with one
 * exception: resolveJobFrame() refuses a job that never declares its frame,
 * because an undeclared job runs in whatever workspace the controller happens
 * to have selected (operator law, 2026-09-14, after a work-frame `G0 Z0`
 * transit job reached the confirm page reading "Z 0 .. 0, warnings: none").
 *
 * Machine-aware rules (multi-machine overhaul, #265 WP3): validateGcode()
 * takes the connected machine's dialect and judges the file by its rules
 * (dialectRules.ts), reporting which ones under `machine.rulesApplied` with the
 * Luban header it read (`header`, gcodeHeader.ts). Called without options it
 * behaves exactly as before: the Snapmaker 2.0 A350's rules, no new findings.
 *
 * No server imports: unit-testable with ts-node.
 */

import {
    DialectRuleId, RuleFinding, RuleLine, RulePhase, applyDialectRules,
} from './dialectRules';
import { DialectId, G53Form, GcodeDialect, dialectById, dialectFor } from './gcodeDialect';
import { GcodeHeader, parseGcodeHeader } from './gcodeHeader';
import { ResolvedTravel } from './machineTravel';

export type JobFrame = 'machine' | 'work';

export interface FrameDeclaration {
    /** Frame in force at the first motion line: G53 -> machine, G54..G59.3 -> work, none -> null. */
    declared: JobFrame | null;
    /** Where the declaration came from: a code in the file, the submit argument, or nothing. */
    source: 'gcode' | 'argument' | null;
    /** 1-based line of the declaring code when source is 'gcode'. */
    line: number | null;
    /** 1-based line of the first G0..G3, or null when the file has no motion. */
    firstMotionLine: number | null;
    /** Motion occurred under BOTH frames (a trailing G54 with no motion after it is not mixed). */
    mixed: boolean;
    /** Distinct workspace-select codes seen (G54..G59.3). */
    workspaceSelects: string[];
    /** Lines carrying G53 together with a motion word - this controller does not honour inline G53. */
    inlineG53Lines: number[];
    /**
     * Frame still selected when the file ENDS. The controller keeps the last
     * workspace selected after a job finishes, so a file that ends in 'machine'
     * leaves every later heartbeat reporting machine coordinates (live
     * 2026-09-19: the position of record then rejected every beat until a
     * re-home). null = the file selected no workspace at all.
     */
    endsInFrame: JobFrame | null;
}

export interface GcodeValidationReport {
    lineCount: number;
    motionLineCount: number;
    extents: {
        x: { min: number; max: number } | null;
        y: { min: number; max: number } | null;
        z: { min: number; max: number } | null;
        b: { min: number; max: number } | null;
    };
    feedRates: { min: number; max: number } | null;
    spindle: {
        onCommands: number; // M3/M4 count
        offCommands: number; // M5 count
        maxS: number | null;
        /**
         * M3/M4 still in force when the file ends - never turned off, or turned
         * on again after the last M5. A CAM post always ends `M5`; a file that
         * does not is the signature of a truncated paste (2026-10-15: an agent
         * submitted the first part of a 295 KB V-carve and the only sign was
         * the old "M3 without M5" warning). spindleRefusal() turns it into a
         * refusal at staging (#237).
         */
        onAtEnd: boolean;
    };
    usesRelativeMotion: boolean; // any G91 present
    assumesDistanceMode: boolean; // motion before any G90/G91
    endsInRelativeMode: boolean; // G91 still active at end of file
    usesArcs: boolean; // G2/G3 present (extents are approximated from endpoints)
    /** Any G38.x probing cycle. This firmware has none - probing programs go through run_probing_gcode. */
    usesProbing: boolean;
    /**
     * Any G28 (machine home). Homing drives every axis to its limit switch -
     * real travel the X/Y/Z/B extents cannot include, so it is reported
     * beside them instead of hiding inside a comment.
     */
    usesHoming: boolean;
    /** Motion lines carrying an X or Y word, a Z word, and both at once. */
    motionAxes: { xy: number; z: number; both: number };
    fourAxis: boolean; // any B-axis word
    minZWithSpindleOn: number | null;
    /** G92 rewrites the work origin; use the human-gated workspace or tool-length tool. */
    setsWorkOrigin: boolean;
    frame: FrameDeclaration;
    /**
     * Z extents in MACHINE coordinates: the raw extents for a machine-frame job,
     * raw minus the staging origin offset for a work-frame job. Filled by
     * resolveJobFrame(); null until then, and null when the offset was not
     * reliable at staging.
     */
    machineZExtents: { min: number; max: number } | null;
    /** Work-origin Z offset used to resolve machineZExtents (work-frame jobs only). */
    originOffsetZAtStaging: number | null;
    /**
     * The workspace whose offset machineZExtents assume, for a file that selects
     * only G54 before its first move. The heartbeat does not name the active
     * workspace, so start_gcode_job selects it and verifies its offset before
     * streaming. null when the file selects no workspace (it runs in the active
     * one, which the live offset describes) and when the extents are unresolved.
     */
    machineZResolvedFor: 'G54' | null;
    warnings: string[];
    /**
     * Which machine the file was judged for, by which rules (dialectRules.ts),
     * and what those rules refuse. Optional on the type only because jobs
     * persisted before #265 lack it; validateGcode() always fills it.
     */
    machine?: ValidationMachine;
    /** The Luban `;Header Start` block (gcodeHeader.ts), or null when the file has none. */
    header?: GcodeHeader | null;
}

export interface ValidationMachine {
    /** The machine the rules were applied for; null when validateGcode() was called without options (legacy A350 rules). */
    identifier: string | null;
    dialect: DialectId;
    /** How this machine takes G53 (gcodeDialect.ts), for the frame text and suggestGcode(). */
    g53Form: G53Form;
    rulesApplied: DialectRuleId[];
    /** The phase the rules ran for (validate / submit / staged); null for the legacy call. */
    phase: RulePhase | null;
    /** Rule refusals: non-empty = submit_gcode_job and staging refuse. validate_gcode reports them. */
    refusals: string[];
    findings: RuleFinding[];
    codesOutsideReference: Array<{ code: string; status: string; firstLine: number }>;
}

/** The machine to judge a file for. Omitted = the legacy A350 behaviour, exactly. */
export interface ValidationOptions {
    /** The dialect row; defaults to the row for machineIdentifier. */
    dialect?: GcodeDialect;
    machineIdentifier?: string | null;
    /** XY travel for the travel rule (machine-frame files only); null/omitted = not checked. */
    travel?: ResolvedTravel | null;
    /** Default true. */
    hasZ?: boolean;
    /** MachineCapability.supports.rotary. Default: the dialect has a rotary axis word and the machine a Z. */
    supportsRotary?: boolean;
    /** The head the job is staged for (submit head_type), when known. */
    headType?: string | null;
    /** Default 'validate'. */
    phase?: RulePhase;
}

const MOTION_RE = /^G0*[0123](?:\.\d+)?$/;
const WORKSPACE_RE = /^G(?:5[4-9]|59\.[123])$/;

interface ParsedLine {
    /** Every G/M code on the line, in order (a line may carry G53 G0 ...). */
    codes: string[];
    /** Non-code words: X/Y/Z/B/F/S ... */
    words: { [letter: string]: number };
    /** The line without comments, trimmed and upper-cased (for `$H` and other non-word commands). */
    bare: string;
}

function normaliseCode(token: string): string {
    // G01 -> G1, G0 -> G0, G38.2 stays, M03 -> M3
    const m = /^([GM])0*(\d+(?:\.\d+)?)$/.exec(token);
    return m ? `${m[1]}${m[2]}` : token;
}

/** A token made only of letter+number words with no spaces: Luban's GRBL export writes `G1 X10Y20F3000S500`. */
const COMPACT_TOKEN_RE = /^(?:[A-Z][-+]?(?:\d+\.?\d*|\.\d+))+$/;
const COMPACT_WORD_RE = /([A-Z])([-+]?(?:\d+\.?\d*|\.\d+))/g;

function parseLine(line: string): ParsedLine {
    // strip comments: ; to end, and ( ... )
    const stripped = line.replace(/;.*$/, '').replace(/\([^)]*\)/g, '').trim();
    if (!stripped) {
        return { codes: [], words: {}, bare: '' };
    }

    const bare = stripped.toUpperCase();
    const tokens = bare.split(/\s+/);
    const words: { [letter: string]: number } = {};
    const codes: string[] = [];
    const take = (letter: string, raw: string, value: number) => {
        if (letter === 'G' || letter === 'M') {
            codes.push(normaliseCode(`${letter}${raw}`));
        } else {
            words[letter] = value;
        }
    };

    for (const token of tokens) {
        const letter = token[0];
        const value = Number(token.slice(1));
        if (letter && !Number.isNaN(value)) {
            take(letter, token.slice(1), value);
        } else if (COMPACT_TOKEN_RE.test(token)) {
            // Words run together (`X10Y20F3000S500`, `G1X5`): split them
            // rather than drop the token - a Ray export is written this way.
            COMPACT_WORD_RE.lastIndex = 0;
            let m = COMPACT_WORD_RE.exec(token);
            while (m) {
                take(m[1], m[2], Number(m[2]));
                m = COMPACT_WORD_RE.exec(token);
            }
        }
    }
    return { codes, words, bare };
}

/** Does this line carry a motion code (G0..G3)? Shared with the program identity lines (gcodeIntake.ts). */
export function lineHasMotion(line: string): boolean {
    return parseLine(line).codes.some((code) => MOTION_RE.test(code));
}

function extend(range: { min: number; max: number } | null, value: number): { min: number; max: number } {
    if (!range) {
        return { min: value, max: value };
    }
    return { min: Math.min(range.min, value), max: Math.max(range.max, value) };
}

const SM2_DIALECT_ID: DialectId = 'sm2-marlin';

export function validateGcode(gcode: string, options?: ValidationOptions): GcodeValidationReport {
    const lines = gcode.split(/\r?\n/);
    // Rules apply only when the caller names a machine; otherwise the legacy
    // A350 behaviour, finding for finding.
    const judged = !!options && (options.dialect !== undefined || (options.machineIdentifier !== undefined && options.machineIdentifier !== null));
    let dialect: GcodeDialect = dialectById(SM2_DIALECT_ID);
    if (judged && options) {
        dialect = options.dialect || dialectFor(options.machineIdentifier || null);
    }
    const ruleLines: RuleLine[] = [];

    let x: { min: number; max: number } | null = null;
    let y: { min: number; max: number } | null = null;
    // Assigned inside lines.forEach below, which control-flow analysis does
    // not follow; the cast keeps z from narrowing to its null initialiser.
    let z = null as { min: number; max: number } | null;
    let b: { min: number; max: number } | null = null;
    let feed: { min: number; max: number } | null = null;
    let maxS: number | null = null;
    let onCommands = 0;
    let offCommands = 0;
    let motionLineCount = 0;
    let usesRelativeMotion = false;
    let usesArcs = false;
    let usesProbing = false;
    let usesHoming = false;
    const motionAxes = { xy: 0, z: 0, both: 0 };
    let relativeMode = false;
    let distanceModeSet = false;
    let motionBeforeDistanceMode = false;
    let spindleOn = false;
    let minZWithSpindleOn: number | null = null;
    let setsWorkOrigin = false;
    const warnings: string[] = [];
    const fanucCodes = new Set<string>();

    // Frame tracking. On this controller `G53` on its own line selects the
    // machine workspace and stays selected until a G54..G59.3 reselects a work
    // workspace (every MCP emitter and Luban's own Home button rely on that:
    // `G53; G28; G54`). An inline `G53 G0 ...` is NOT honoured by the firmware -
    // the move runs in the selected workspace - so it never counts as a
    // declaration and is flagged.
    let frameModal: JobFrame | null = null;
    let declarationLine: number | null = null;
    let firstMotionLine: number | null = null;
    let declaredAtFirstMotion: JobFrame | null = null;
    const motionFrames = new Set<string>();
    const workspaceSelects = new Set<string>();
    const inlineG53Lines: number[] = [];

    lines.forEach((line, index) => {
        const lineNo = index + 1;
        const { codes, words, bare } = parseLine(line);
        if (bare) {
            ruleLines.push({ lineNo, bare, codes, words });
        }
        if (!codes.length) {
            return;
        }
        const motionCode = codes.find((c) => MOTION_RE.test(c)) || null;
        const hasG53 = codes.includes('G53');
        const workspace = codes.find((c) => WORKSPACE_RE.test(c)) || null;

        if (hasG53 && motionCode) {
            inlineG53Lines.push(lineNo);
        } else if (hasG53) {
            frameModal = 'machine';
            if (declarationLine === null) {
                declarationLine = lineNo;
            }
        }
        if (workspace) {
            workspaceSelects.add(workspace);
            frameModal = 'work';
            if (declarationLine === null) {
                declarationLine = lineNo;
            }
        }

        for (const code of codes) {
            if (['G41', 'G42', 'G43', 'M6', 'M30'].includes(code)) fanucCodes.add(code);
            if (code === 'G90') {
                relativeMode = false;
                distanceModeSet = true;
            } else if (code === 'G91') {
                relativeMode = true;
                usesRelativeMotion = true;
                distanceModeSet = true;
            } else if (code.startsWith('G38')) {
                usesProbing = true;
            } else if (code === 'G28') {
                usesHoming = true;
            } else if (code === 'G92') {
                setsWorkOrigin = true;
            } else if (code === 'M3' || code === 'M4') {
                onCommands += 1;
                spindleOn = true;
                if (words.S !== undefined) {
                    maxS = maxS === null ? words.S : Math.max(maxS, words.S);
                }
            } else if (code === 'M5') {
                offCommands += 1;
                spindleOn = false;
            }
        }

        if (motionCode) {
            motionLineCount += 1;
            if (firstMotionLine === null) {
                firstMotionLine = lineNo;
                declaredAtFirstMotion = frameModal;
            }
            motionFrames.add(frameModal || 'undeclared');
            if (!distanceModeSet) {
                motionBeforeDistanceMode = true;
            }
            if (motionCode === 'G2' || motionCode === 'G3') {
                usesArcs = true;
            }
            if (words.S !== undefined) {
                maxS = maxS === null ? words.S : Math.max(maxS, words.S);
            }
            if (relativeMode && !hasG53) {
                // Relative moves make static extents unreliable; report the
                // fact instead of accumulating wrong numbers. (G53 is absolute
                // even under G91.)
                return;
            }
            const movesXy = words.X !== undefined || words.Y !== undefined;
            const movesZ = words.Z !== undefined;
            if (movesXy && movesZ) {
                motionAxes.both += 1;
            } else if (movesXy) {
                motionAxes.xy += 1;
            } else if (movesZ) {
                motionAxes.z += 1;
            }
            if (words.X !== undefined) x = extend(x, words.X);
            if (words.Y !== undefined) y = extend(y, words.Y);
            if (words.Z !== undefined) {
                z = extend(z, words.Z);
                if (spindleOn) {
                    minZWithSpindleOn = minZWithSpindleOn === null
                        ? words.Z : Math.min(minZWithSpindleOn, words.Z);
                }
            }
            if (words.B !== undefined) b = extend(b, words.B);
            if (words.F !== undefined) feed = extend(feed, words.F);
        }
    });

    // GRBL (the Ray): G53 is a same-line prefix, so a file that prefixes
    // EVERY move is a machine-frame file - the only machine-frame form there
    // is. (frame-form refuses one that prefixes only some.)
    if (judged && dialect.frames.g53 === 'same-line' && declaredAtFirstMotion === null
        && motionLineCount > 0 && inlineG53Lines.length === motionLineCount) {
        declaredAtFirstMotion = 'machine';
        declarationLine = firstMotionLine;
    }
    const frame: FrameDeclaration = {
        endsInFrame: frameModal,
        declared: declaredAtFirstMotion,
        source: declaredAtFirstMotion ? 'gcode' : null,
        line: declaredAtFirstMotion ? declarationLine : null,
        firstMotionLine,
        mixed: motionFrames.has('machine') && motionFrames.has('work'),
        workspaceSelects: [...workspaceSelects].sort(),
        inlineG53Lines,
    };

    if (fanucCodes.size) {
        warnings.push(`Fanuc-style commands (${[...fanucCodes].join(', ')}) do not have their machining-centre semantics on Snapmaker. `
            + 'For thread-milling generator output, use convert_thread_milling_gcode and review its explicit conversions before staging.');
    }

    if (usesRelativeMotion) {
        warnings.push('Contains G91 relative motion; extents exclude relative segments and are unreliable.');
    }
    if (usesArcs) {
        warnings.push('Contains arcs (G2/G3); extents are computed from endpoints only and may understate the true envelope.');
    }
    if (onCommands > 0 && offCommands === 0) {
        warnings.push('Spindle/laser is turned on (M3/M4) but never turned off (M5): submit_gcode_job and validate_gcode refuse this - '
            + 'a complete CAM file ends M5, so this is the signature of a truncated program.');
    } else if (spindleOn) {
        warnings.push('The file ends with the spindle/laser still running (an M3/M4 after the last M5): submit_gcode_job and '
            + 'validate_gcode refuse this - a complete CAM file ends M5, so this is the signature of a truncated program.');
    }
    if (minZWithSpindleOn !== null && minZWithSpindleOn < 0) {
        warnings.push(`Cutting below Z0 with spindle on (min Z ${minZWithSpindleOn}). Verify Z0 is the stock top.`);
    }
    if (z !== null && z.min < 0 && minZWithSpindleOn === null) {
        warnings.push(`Moves to absolute work Z below zero with the spindle off (min Z ${z.min}). `
            + 'If a relative drop was intended, wrap the move in G91 ... G90 instead - an absolute '
            + 'Z-20 is a position, not a distance. Verify the work origin either way.');
    }
    if (motionBeforeDistanceMode) {
        warnings.push('Motion occurs before any G90/G91: the first move executes in whatever distance '
            + 'mode the controller happens to be in. State the mode explicitly first.');
    }
    if (relativeMode) {
        warnings.push('The file ends with G91 still active, leaving the controller in relative mode - '
            + "Luban's convention is to restore G90 after relative moves.");
    }
    if (setsWorkOrigin) {
        warnings.push('Contains G92: this REWRITES the work origin for every job that follows. The only '
            + 'sanctioned MCP origin writes use set_workspace_origin (measured XYZ) or apply_tool_length_offset '
            + '(measured tool change), each human-gated. Remove raw origin writes unless the operator asked for exactly this.');
    }
    // The inline-G53 warning is the Snapmaker 2.0's (own-line G53 is the only
    // form observed to work there). On GRBL the same-line prefix is the only
    // form; on a machine without workspaces frame-form refuses G53 outright.
    if (inlineG53Lines.length && dialect.frames.g53 === 'own-line') {
        warnings.push(`Inline G53 with a move on line(s) ${inlineG53Lines.join(', ')}: this controller does NOT `
            + 'honour a one-shot G53 - the move runs in the selected workspace, not machine coordinates. '
            + 'Put G53 on its own line before the moves (and G54 after) instead.');
    }
    if (frame.mixed) {
        warnings.push('Motion occurs under BOTH frames (G53 machine and G54..G59.3 work). Extents mix the two; '
            + 'review every Z with its frame.');
    }
    if (usesHoming) {
        warnings.push('Contains G28 (machine home): every axis drives to its limit switch, Z first - and B is homed too when '
            + 'the rotary is fitted, so stock on it turns to B0. The extents above do NOT include the homing travel.');
    }
    if (motionLineCount === 0) {
        warnings.push('No motion commands found.');
    }

    const header = parseGcodeHeader(gcode);
    const machine: ValidationMachine = {
        identifier: null,
        dialect: dialect.id,
        g53Form: dialect.frames.g53,
        // The legacy call still applies the Snapmaker 2.0 inline-G53 warning.
        rulesApplied: ['frame-form'],
        phase: null,
        refusals: [],
        findings: [],
        codesOutsideReference: [],
    };
    if (judged && options) {
        const hasZ = options.hasZ !== false;
        const result = applyDialectRules(ruleLines, {
            dialect,
            machineIdentifier: options.machineIdentifier || null,
            hasZ,
            supportsRotary: options.supportsRotary !== undefined ? options.supportsRotary : hasZ && dialect.rotaryAxis !== null,
            travel: options.travel || null,
            header,
            headType: options.headType || null,
            phase: options.phase || 'validate',
            frame: { declared: frame.declared, source: frame.source, mixed: frame.mixed },
            extents: { x, y },
        });
        machine.identifier = options.machineIdentifier || null;
        machine.rulesApplied = result.rulesApplied;
        machine.phase = options.phase || 'validate';
        machine.refusals = result.refusals;
        machine.findings = result.findings;
        machine.codesOutsideReference = result.codesOutsideReference;
        warnings.push(...result.warnings);
    }

    return {
        lineCount: lines.length,
        motionLineCount,
        extents: { x, y, z, b },
        feedRates: feed,
        spindle: { onCommands, offCommands, maxS, onAtEnd: spindleOn },
        usesRelativeMotion,
        assumesDistanceMode: motionBeforeDistanceMode,
        endsInRelativeMode: relativeMode,
        usesArcs,
        usesProbing,
        usesHoming,
        motionAxes,
        fourAxis: b !== null,
        minZWithSpindleOn,
        setsWorkOrigin,
        frame,
        machineZExtents: null,
        originOffsetZAtStaging: null,
        machineZResolvedFor: null,
        warnings,
        machine,
        header,
    };
}

const NEWLINE = '\n';

/**
 * The refusal for a program that ends with its spindle running. Pure, from
 * the report alone, so validate_gcode and submit_gcode_job give the same
 * answer and the test suite can hold them to it. The job is never edited
 * to add an M5: the agent must supply the whole file (gcode_path or a
 * chunked upload when it is too big for one argument), and the identity
 * lines on the result say what was actually received.
 */
export function spindleRefusal(report: GcodeValidationReport): string | null {
    if (!report.spindle.onAtEnd) {
        return null;
    }
    const how = report.spindle.offCommands === 0
        ? `the spindle/laser is turned on (M3/M4 x${report.spindle.onCommands}) and never turned off - there is no M5 anywhere in the file`
        : `the file ends with the spindle/laser still running - an M3/M4 after the last M5 (on x${report.spindle.onCommands}, off x${report.spindle.offCommands})`;
    return `Refused: ${how}. Every complete CAM program ends M5, so this is the signature of a TRUNCATED program `
        + '(an inline paste cut short, a partial file, an upload finished early). The MCP never adds an M5 for you. Compare the '
        + `received identity (${report.lineCount} lines, ${report.motionLineCount} motion lines, SHA-256 and last motion line on the result) `
        + 'with the file you generated; if the whole file really is this, fix the program. If it is longer, submit it whole through '
        + 'gcode_path (a file in the MCP jobs inbox) or begin_gcode_upload / append_gcode_chunk / finish_gcode_upload instead of one gcode argument.';
}

/** The most motion lines a hand-authored TRANSIT plausibly has; beyond it, the file is doing something. */
export const MAX_TRANSPORT_MOTION_LINES = 8;

export const TRANSPORT_REFUSAL = 'Refused: this file is pure transport - a few rapids with no spindle, no probing, '
    + 'no arcs and no rotation - and transport has its own tools. Use `traverse_xy` for XY (it plans the move at the '
    + 'traverse height, checks every leg against the stored landmarks, and stages the series for one approval) or '
    + '`move_z` for Z. They emit the declared, frame-restoring file for you, which is the file a hand-written transit '
    + 'keeps getting wrong: on 2026-09-19 one was rejected for an undeclared distance mode, restaged, and then left '
    + 'the controller in the machine workspace for the rest of the session. A fast-then-slow approach ("F400 to 10 mm '
    + 'above the stock, then F60 for the last 10 mm") is ONE move_z job with PER-STEP feeds (#240): z_targets: [{z, '
    + 'feed_rate: 400}, {z, feed_rate: 60}] - each step carries its own F word, one approval, one start_gcode_job per step. '
    + 'If this really is not transport - it '
    + 'cuts, probes, rotates, or moves in XY and Z together - it will not be refused; only a file that is purely one or the other is.';

/**
 * Whether a staged file is nothing but getting the toolhead from A to B.
 *
 * Deliberately narrow: a file is only transport when EVERY signal agrees, so
 * a real toolpath is never refused for lacking a spindle command. A laser or
 * printing job is excluded by head type at the call site, not here.
 */
export function isPureTransport(report: GcodeValidationReport): boolean {
    // Exactly what traverse_xy and move_z can express between them: an XY
    // series at a constant Z, or a Z series at a constant XY. A file that
    // moves in both - a toolpath, a slicer export, a plunge-and-cut - is
    // never one of ours, which is what keeps this from refusing real work.
    const xyOnly = report.motionAxes.xy > 0 && report.motionAxes.z === 0 && report.motionAxes.both === 0;
    const zOnly = report.motionAxes.z > 0 && report.motionAxes.xy === 0 && report.motionAxes.both === 0;
    return (xyOnly || zOnly)
        && report.motionLineCount > 0
        && report.motionLineCount <= MAX_TRANSPORT_MOTION_LINES
        && report.spindle.onCommands === 0
        && !report.usesArcs
        && !report.usesProbing
        && !report.fourAxis
        && !report.setsWorkOrigin
        && !report.usesRelativeMotion;
}

export interface GcodeSuggestion {
    /** The corrected program, ready to re-submit unchanged. */
    gcode: string;
    /** One line per edit, in the order they were made. */
    changes: string[];
}

/**
 * A corrected draft for the refusals whose fix is mechanical.
 *
 * The MCP never edits a submitted file - that law stands, and this does not
 * touch the job. It hands the agent the program it should have written, so a
 * refusal costs one re-submit instead of a round trip through prose. Live
 * 2026-09-19 two of six operator approvals were spent re-deriving "put G53 on
 * its own line" and "declare G90" from refusal text.
 *
 * Only three edits are made, all of them mechanical:
 *   - an inline `G53 G0 ...` is split, because this controller runs the move
 *     in the selected workspace instead of honouring a one-shot G53;
 *   - a missing distance mode gets `G90` first, because a file that assumes
 *     one runs in whatever mode the controller happens to be in;
 *   - a file that ends with G53 selected gets `G54;` last, because the
 *     controller keeps that workspace after the job.
 *
 * Anything needing a DECISION - which frame an undeclared file meant, whether
 * a G92 was intended - returns null. A suggestion is only offered when it is
 * certain, and it is verified by re-validating before it is returned.
 */
export function suggestGcode(gcode: string, report: GcodeValidationReport): GcodeSuggestion | null {
    // Every edit below writes the Snapmaker 2.0 frame form (own-line G53, a
    // closing G54). On GRBL that form is refused (frame-form), and a machine
    // without workspaces takes neither: no suggestion there.
    if (report.machine && report.machine.g53Form !== 'own-line') {
        return null;
    }
    const changes: string[] = [];
    const lines = gcode.split(/\r?\n/);
    const out: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (report.frame.inlineG53Lines.includes(i + 1)) {
            const indent = (/^\s*/.exec(line) as RegExpExecArray)[0];
            // Drop the G53 token (with any leading 0s) and keep the rest of the line byte-for-byte.
            const stripped = line.replace(/\bG0*53\b\s*/i, '');
            out.push(`${indent}G53;`);
            out.push(stripped);
            changes.push(`line ${i + 1}: G53 moved onto its own line before the move (this controller does not honour a one-shot G53)`);
        } else {
            out.push(line);
        }
    }

    if (report.assumesDistanceMode) {
        out.unshift('G90');
        changes.push('G90 added first: the file moved before stating its distance mode');
    }
    // Judge the epilogue on the SPLIT program, not the original: an inline
    // `G53 G0 ...` selects nothing (which is the bug), so only after the split
    // does the file actually leave the machine workspace selected.
    if (validateGcode(out.join(NEWLINE)).frame.endsInFrame === 'machine') {
        while (out.length && out[out.length - 1].trim() === '') {
            out.pop();
        }
        out.push('G54;');
        changes.push('G54 added last: the file ended with G53 still selected, which leaves the controller reporting machine coordinates');
    }

    if (!changes.length) {
        return null;
    }
    const suggestion = out.join('\n');
    // Never hand back a draft that is not itself clean.
    const after = validateGcode(suggestion);
    if (after.assumesDistanceMode || after.frame.inlineG53Lines.length || after.frame.endsInFrame === 'machine') {
        return null;
    }
    return { gcode: suggestion, changes };
}

export interface FrameResolutionContext {
    /** The submit call's `frame` argument, if any. */
    frameArgument?: JobFrame | null;
    /** Work-origin Z offset from the position of record (machine = work - offset), or null when unknown. */
    originOffsetZ: number | null;
    /** False when the offset is cached / assumed / the position is awaiting resync - resolution is then refused for work jobs. */
    offsetReliable: boolean;
    /** Machine Z travel (home height), for bounds warnings; null when the machine is unknown. */
    machineZMax: number | null;
    /**
     * The job's start path selects G54 and verifies its offset before streaming
     * (submit_gcode_job file jobs). Only then may a G54-only file's extents be
     * resolved on the assumption that the live offset is G54's.
     */
    verifiesG54AtStart?: boolean;
    /**
     * The body is a server-emitted RELATIVE transport step (traversePlan.ts
     * 'grbl-relative': `G91 / G1 X.. Y.. F.. / G90`, Luban's own jog form for
     * the Ray). A relative move is frame-independent, so the frame doctrine
     * has nothing to demand of it; accepted only when EVERY motion line is
     * relative and G90 is restored. Never set for a submitted file.
     */
    relativeTransport?: boolean;
}

/** The note a relative transport body carries on the confirm page in place of a frame declaration. */
export const RELATIVE_TRANSPORT_NOTE = 'Relative transport (G91 .. G90): every move is an increment from where the head is, so no '
    + 'workspace frame applies - the "; mcp-settle machine" line names the absolute MACHINE endpoint the heartbeat must report. '
    + 'This is the form Luban\'s own jog sends to the Ray.';

/**
 * Every motion line runs under G91 and G90 is restored before the end: the
 * extents are all null because the validator does not accumulate relative
 * moves, and nothing moved before the distance mode was set.
 */
export function isRelativeOnlyTransport(report: GcodeValidationReport): boolean {
    return report.motionLineCount > 0
        && report.usesRelativeMotion
        && !report.endsInRelativeMode
        && !report.assumesDistanceMode
        && report.extents.x === null && report.extents.y === null && report.extents.z === null;
}

export interface FrameResolution {
    report: GcodeValidationReport;
    /** Non-null = the job must be REFUSED at staging with this message. */
    refusal: string | null;
}

export const FRAME_REFUSAL_NO_RESTORE = 'Refused: this job never hands the coordinate frame back - it ends with G53 '
    + 'still selected. The controller keeps that workspace after the job finishes, so every later status '
    + 'report carries machine coordinates while the work-origin offset is still populated, the position of record '
    + 'rejects them, and motion and staging refuse (live 2026-09-19: a re-home was the only way out). Put `G54;` on its '
    + 'own line at the end of the file. The MCP never edits your gcode to add it.';

export const FRAME_REFUSAL_UNDECLARED = 'Refused: the job never declares its coordinate frame, so its moves would run in '
    + 'whatever workspace the controller happens to have selected. Declare it: put `G53` on its own line before the '
    + 'first move (and `G54` after the last) for MACHINE coordinates, or pass frame: "work" for a Luban/slicer file '
    + 'that runs in the operator\'s work origin. G90/G91 is distance mode, not a frame.';

/**
 * FRAME_REFUSAL_UNDECLARED tells the agent to write `G53` on its own line - the
 * Snapmaker 2.0 form. On a machine that does not take it (GRBL: same-line
 * prefix only; no workspaces at all) the only declaration is the argument.
 */
export function frameRefusalUndeclared(report: GcodeValidationReport): string {
    const machine = report.machine;
    if (!machine || machine.g53Form === 'own-line') {
        return FRAME_REFUSAL_UNDECLARED;
    }
    const why = machine.g53Form === 'same-line'
        ? 'G53 is a non-modal same-line prefix on GRBL, so an own-line G53 declares nothing there'
        : 'it documents no G53/G54 workspaces at all';
    return 'Refused: the job never declares its coordinate frame, so its moves would run from whatever origin the controller '
        + `happens to hold. On the ${machine.identifier || 'connected machine'} (${machine.dialect}) ${why}: pass frame: "work" for a `
        + 'Luban export, which runs from the origin set on the machine. G90/G91 is distance mode, not a frame.';
}

/**
 * Settle which frame a staged file job runs in, from what the gcode declares
 * and what the caller passed. Pure: the caller supplies the live offset.
 */
export function resolveJobFrame(input: GcodeValidationReport, ctx: FrameResolutionContext): FrameResolution {
    const report: GcodeValidationReport = {
        ...input,
        frame: { ...input.frame },
        warnings: [...input.warnings],
    };
    const arg = ctx.frameArgument || null;
    const declared = report.frame.declared;

    if (report.motionLineCount === 0) {
        return { report, refusal: null };
    }

    if (declared === 'machine' && arg === 'work') {
        return { report, refusal: `Refused: the gcode declares G53 (machine frame) at line ${report.frame.line} but frame: "work" was passed. Say which one you mean.` };
    }
    if (declared === 'work' && arg === 'machine') {
        return { report, refusal: `Refused: the gcode selects a work workspace (${report.frame.workspaceSelects.join('/')}) at line ${report.frame.line} but frame: "machine" was passed. A machine-frame job must contain G53 literally.` };
    }
    if (declared === null && arg === null && ctx.relativeTransport === true && isRelativeOnlyTransport(report)) {
        report.warnings = report.warnings.filter((w) => !w.startsWith('Contains G91 relative motion'));
        report.warnings.push(RELATIVE_TRANSPORT_NOTE);
        report.machineZExtents = null;
        return { report, refusal: null };
    }
    if (declared === null) {
        if (arg === 'work') {
            report.frame.declared = 'work';
            report.frame.source = 'argument';
        } else if (arg === 'machine') {
            return {
                report,
                refusal: `Refused: frame: "machine" was passed but the gcode contains no G53 before its first move (line ${report.frame.firstMotionLine}). The controller runs an undeclared file in the selected WORK workspace, so a machine-frame job must carry G53 literally - the MCP never edits your gcode to add it.`,
            };
        } else {
            return { report, refusal: frameRefusalUndeclared(report) };
        }
    }

    // A machine-frame job must hand the frame back. Every MCP emitter already
    // ends `G54;` - only a hand-authored file can leave the controller in the
    // machine workspace, and that is exactly what happened on 2026-09-19.
    if (report.frame.endsInFrame === 'machine') {
        return { report, refusal: FRAME_REFUSAL_NO_RESTORE };
    }

    // A heartbeat supplies an offset, not its workspace identity or a table of offsets.
    // Never apply that one offset to named/multiple workspaces or a changing origin.
    // One exception: a submitted file that selects only G54, before its first move
    // (every converted thread-milling program). Its extents resolve against the live
    // offset on the stated assumption that it is G54's, and start_gcode_job proves
    // that by selecting G54 and comparing offsets before anything streams.
    const selectsOnlyG54 = ctx.verifiesG54AtStart === true
        && report.frame.declared === 'work' && report.frame.source === 'gcode'
        && report.frame.workspaceSelects.length === 1 && report.frame.workspaceSelects[0] === 'G54';
    if (report.frame.mixed || report.setsWorkOrigin
        || (report.frame.declared === 'work' && report.frame.workspaceSelects.length > 0 && !selectsOnlyG54)) {
        report.machineZExtents = null;
        report.originOffsetZAtStaging = null;
        report.warnings.push('Machine Z extents are UNRESOLVED: this file selects a named workspace, mixes frames, or rewrites an origin. '
            + 'The live heartbeat does not identify every named workspace offset. Verify each required workspace and review each section against its own offset; '
            + 'one current offset cannot validate the whole file. Prefer one WCS; additional workspaces are supported for existing jobs that require them.');
        return { report, refusal: null };
    }

    const zMax = ctx.machineZMax;
    const rawZ = report.extents.z;
    if (report.frame.declared === 'machine') {
        report.machineZExtents = rawZ ? { ...rawZ } : null;
        if (rawZ && zMax !== null && (rawZ.min < -1 || rawZ.max > zMax + 1)) {
            report.warnings.push(`Machine-frame Z ${rawZ.min} .. ${rawZ.max} is outside the 0 .. ${zMax} travel. `
                + 'A machine coordinate more than 50 mm outside the bounds is a bug, not a position.');
        }
    } else {
        if (!ctx.offsetReliable || ctx.originOffsetZ === null) {
            report.machineZExtents = null;
            report.warnings.push('Work-frame job, but the work-origin offset is not reliable right now (no fresh heartbeat, '
                + 'or the position of record is awaiting resync): the machine-resolved Z extents could not be computed. '
                + 'Re-check get_position before approving.');
        } else {
            report.originOffsetZAtStaging = ctx.originOffsetZ;
            report.machineZExtents = rawZ
                ? { min: rawZ.min - ctx.originOffsetZ, max: rawZ.max - ctx.originOffsetZ }
                : null;
            if (selectsOnlyG54) {
                report.machineZResolvedFor = 'G54';
                report.warnings.push(`Machine Z extents assume the live work-origin offset (Z ${ctx.originOffsetZ}) is G54's: the heartbeat does not `
                    + 'name the active workspace. Before streaming, start_gcode_job selects G54 (no motion) and refuses to start unless '
                    + 'G54 reports this offset.');
            }
            if (rawZ && rawZ.min <= 0 && rawZ.max >= 0) {
                report.warnings.push('Work-frame job with an absolute Z at or crossing 0: with the current origin, work Z0 is '
                    + `machine Z ${(-ctx.originOffsetZ).toFixed(3)}. Confirm that is where you want the tool.`);
            }
            const m = report.machineZExtents;
            if (rawZ && m && zMax !== null && (m.min < -1 || m.max > zMax + 1)) {
                report.warnings.push(`Work-frame Z ${rawZ.min} .. ${rawZ.max} resolves to machine Z ${m.min.toFixed(3)} .. `
                    + `${m.max.toFixed(3)} with the current origin - outside the 0 .. ${zMax} travel.`);
            }
        }
    }
    return { report, refusal: null };
}
