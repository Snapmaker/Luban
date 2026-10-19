// Pure parser + simulator for CAM-generated PROBING gcode (mcp/49): the
// Grbl / Marlin dialect a Fusion 360, FreeCAD or hand-written inspection
// program comes in - G0/G1 links, G38.2-G38.5 probe cycles, G90/G91, G53,
// G4 dwells, comments - turned into an ordered list of steps in MACHINE
// coordinates that probeCam.ts plans (law 2 links, segmented descents,
// keep-out) and runs with the sensor-gated march. The Snapmaker firmware
// has no probing cycle of its own, so G38 is never sent to the controller:
// each one becomes a server-driven march toward the programmed target, the
// target being the travel limit.
//
// No server imports: unit-testable with ts-node.
import { B_AXIS_DEG, MAX_DWELL_S, within } from './procedureLimits';

export type Xyz = { x: number; y: number; z: number };

export class ProbeGcodeError extends Error {
    public line: number;

    public constructor(line: number, message: string) {
        super(`line ${line}: ${message}`);
        this.line = line;
    }
}

export interface ProbeMeta {
    id?: string;
    name?: string;
    /** Feature group (e.g. "boss1") and the role of this point in it ("x_minus"), for feature-level reporting. */
    group?: string;
    role?: string;
    /** Nominal (CAD) surface point, in the program's frame (work unless the comment says machine). */
    nominal?: Xyz;
    /** Outward surface normal at the nominal. */
    normal?: Xyz;
    /** Upper tolerance (>= 0) and lower tolerance (<= 0, signed as Fusion configures it). */
    upperTolMm?: number;
    lowerTolMm?: number;
    /** Fusion operation:inspectSurfaceOffset (stock allowance on the inspected surface), default 0. */
    surfaceOffsetMm?: number;
    frame?: 'work' | 'machine';
    /**
     * Feature-level data for the Renishaw-style printout (Probe WCS / Probe
     * Geometry results): the feature kind of the group, its nominal size,
     * nominal centre and tolerances. Put on any point of the group.
     */
    feature?: 'boss' | 'hole' | 'web' | 'pocket' | 'point' | 'corner';
    nominalSizeMm?: number;
    nominalCenter?: { x: number; y: number };
    sizeTolMm?: number;
    positionTolMm?: number;
}

/** Program-level results metadata: (RESULTS documentid=.. modelversion=.. toolpathid=1.00001 toolpath=INSPECT_TOP) */
export interface ResultsMeta {
    documentId?: string;
    modelVersion?: string;
    toolpathId?: string;
    toolpath?: string;
}

export type ProbeMode = 'G38.2' | 'G38.3' | 'G38.4' | 'G38.5';

export type CamStep =
    | { kind: 'move'; line: number; source: string; rapid: boolean; from: Xyz; target: Xyz; feed: number | null }
    | { kind: 'probe'; line: number; source: string; mode: ProbeMode; index: number; from: Xyz; target: Xyz; feed: number | null; meta: ProbeMeta; bDeg: number | null }
    | { kind: 'rotate'; line: number; source: string; bDeg: number; fromB: number | null }
    | { kind: 'dwell'; line: number; source: string; seconds: number }
    | { kind: 'note'; line: number; source: string; text: string };

export interface ParsedProbeGcode {
    steps: CamStep[];
    probeCount: number;
    warnings: string[];
    /** Machine position after the last step. */
    end: Xyz;
    lineCount: number;
    /** Absolute B angles commanded, in order (3+2 stations). */
    rotations: number[];
    results: ResultsMeta;
}

export interface ParseOptions {
    /** Machine position when the program starts (the staged position). */
    startMachine: Xyz;
    /** Work origin offset: machine = work - offset (Luban convention). */
    originOffset: Xyz;
    /** Rotary B at start (null = not a 4-axis machine / unknown). */
    startB?: number | null;
}

const SUPPORTED_G = new Set(['G0', 'G1', 'G4', 'G17', 'G20', 'G21', 'G38.2', 'G38.3', 'G38.4', 'G38.5', 'G53', 'G54', 'G90', 'G91', 'G94', 'G43', 'G49', 'G40', 'G80']);
const IGNORED_M = new Set(['M5', 'M05', 'M9', 'M09', 'M400', 'M114', 'M117', 'M118']);
const END_M = new Set(['M2', 'M02', 'M30']);

function normalizeCode(letter: string, value: string): string {
    // G01 -> G1, G38.20 -> G38.2
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return `${letter}${value}`;
    }
    return `${letter}${Number.isInteger(n) ? n : Number(n.toFixed(1))}`;
}

const r3 = (v: number) => Number(v.toFixed(3));

/** Strip comments; return the code part, the comments, and the line without N/checksum words. */
function splitLine(raw: string): { code: string; comments: string[] } {
    const comments: string[] = [];
    let code = '';
    let i = 0;
    while (i < raw.length) {
        const ch = raw[i];
        if (ch === ';') {
            comments.push(raw.slice(i + 1).trim());
            break;
        }
        if (ch === '(') {
            // Nested parentheses are legal inside a comment - LinuxCNC's own
            // (MSG, do (this)) does it - so match depth, not the first ')'.
            let depth = 1;
            let j = i + 1;
            while (j < raw.length && depth > 0) {
                if (raw[j] === '(') {
                    depth += 1;
                } else if (raw[j] === ')') {
                    depth -= 1;
                }
                j += 1;
            }
            comments.push(raw.slice(i + 1, depth === 0 ? j - 1 : raw.length).trim());
            i = j;
            continue;
        }
        code += ch;
        i += 1;
    }
    // Checksum "*nn" and line numbers "N123" carry nothing; "%" program
    // start/end markers and "O1234" program numbers neither.
    code = code.replace(/\*\d+\s*$/, '').replace(/^\s*N\d+\s*/i, '').trim();
    if (code === '%' || /^O\d+$/i.test(code)) {
        code = '';
    }
    return { code, comments };
}

function parseTriple(text: string): Xyz | null {
    const parts = text.split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
        return null;
    }
    return { x: parts[0], y: parts[1], z: parts[2] };
}

/** (RESULTS documentid=.. modelversion=.. toolpathid=.. toolpath=..) - carried into the Fusion results file. */
export function parseResultsMeta(comment: string): ResultsMeta | null {
    if (!/^\s*results\b/i.test(comment)) {
        return null;
    }
    const meta: ResultsMeta = {};
    const re = /([a-z_]+)\s*=\s*(\S+)/gi;
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(comment)) !== null) {
        const key = m[1].toLowerCase();
        const value = m[2].trim();
        if (key === 'documentid') {
            meta.documentId = value;
        } else if (key === 'modelversion') {
            meta.modelVersion = value;
        } else if (key === 'toolpathid') {
            meta.toolpathId = value;
        } else if (key === 'toolpath') {
            meta.toolpath = value;
        }
    }
    return meta;
}

/**
 * Structured probe metadata in a comment, e.g.
 *   (PROBE id=3 name=top_left group=boss1 role=x_minus nominal=10,20,0 normal=0,0,1 tol=0.1,-0.1 offset=0 frame=work)
 *   ; probe: id=3 nominal=10 20 0
 * Applies to the next G38 line. Returns null for an ordinary comment.
 * Tolerances keep Fusion's convention: upper >= 0, lower <= 0 (a positive
 * lower value is taken as its magnitude below the nominal).
 */
export function parseProbeMeta(comment: string): ProbeMeta | null {
    if (!/^\s*probe\b/i.test(comment)) {
        return null;
    }
    const meta: ProbeMeta = {};
    const re = /([a-z_]+)\s*=\s*([^\s=]+(?:\s*,\s*[^\s=,]+)*)/gi;
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(comment)) !== null) {
        const key = m[1].toLowerCase();
        const value = m[2].trim();
        if (key === 'id') {
            meta.id = value;
        } else if (key === 'name') {
            meta.name = value;
        } else if (key === 'group') {
            meta.group = value;
        } else if (key === 'role') {
            meta.role = value;
        } else if (key === 'offset') {
            const n = Number(value);
            if (Number.isFinite(n)) {
                meta.surfaceOffsetMm = n;
            }
        } else if (key === 'feature') {
            const f = value.toLowerCase();
            if (['boss', 'hole', 'web', 'pocket', 'point', 'corner'].includes(f)) {
                meta.feature = f as ProbeMeta['feature'];
            }
        } else if (key === 'nominal_size' || key === 'size') {
            const n = Number(value);
            if (Number.isFinite(n)) {
                meta.nominalSizeMm = n;
            }
        } else if (key === 'nominal_center' || key === 'center') {
            const parts = value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
            if (parts.length >= 2) {
                meta.nominalCenter = { x: parts[0], y: parts[1] };
            }
        } else if (key === 'tol_size') {
            const n = Number(value);
            if (Number.isFinite(n)) {
                meta.sizeTolMm = Math.abs(n);
            }
        } else if (key === 'tol_pos') {
            const n = Number(value);
            if (Number.isFinite(n)) {
                meta.positionTolMm = Math.abs(n);
            }
        } else if (key === 'nominal') {
            const t = parseTriple(value);
            if (t) {
                meta.nominal = t;
            }
        } else if (key === 'normal') {
            const t = parseTriple(value);
            if (t) {
                meta.normal = t;
            }
        } else if (key === 'tol') {
            const parts = value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
            if (parts.length === 1) {
                meta.upperTolMm = Math.abs(parts[0]);
                meta.lowerTolMm = -Math.abs(parts[0]);
            } else if (parts.length >= 2) {
                meta.upperTolMm = Math.abs(parts[0]);
                meta.lowerTolMm = -Math.abs(parts[1]);
            }
        } else if (key === 'frame') {
            meta.frame = value.toLowerCase() === 'machine' ? 'machine' : 'work';
        }
    }
    return meta;
}

export function parseProbingGcode(text: string, options: ParseOptions): ParsedProbeGcode {
    const steps: CamStep[] = [];
    const warnings: string[] = [];
    const offset = options.originOffset;
    let position: Xyz = { ...options.startMachine };
    let absolute = true;
    let distanceModeSeen = false;
    let unitScale = 1; // G21 mm; G20 inches -> mm
    let motionMode: 'G0' | 'G1' | null = null;
    let probeCount = 0;
    let pendingMeta: ProbeMeta | null = null;
    let ended = false;
    let currentB: number | null = options.startB === undefined ? null : options.startB;
    const rotations: number[] = [];
    const results: ResultsMeta = {};
    const lines = text.split(/\r?\n/);

    lines.forEach((raw, index) => {
        if (ended) {
            return;
        }
        const lineNo = index + 1;
        const { code, comments } = splitLine(raw);
        for (const c of comments) {
            const meta = parseProbeMeta(c);
            const resultsMeta = meta ? null : parseResultsMeta(c);
            if (meta) {
                pendingMeta = { ...(pendingMeta || {}), ...meta };
            } else if (resultsMeta) {
                Object.assign(results, resultsMeta);
            } else if (c) {
                steps.push({ kind: 'note', line: lineNo, source: raw.trim(), text: c });
            }
        }
        if (!code) {
            return;
        }
        if (code.startsWith('$')) {
            // Grbl system commands ($H, $J=..., $X) from sender macros: not a
            // program line. Skipped with a warning; a jog is never motion here.
            warnings.push(`line ${lineNo}: Grbl system command "${code}" skipped (not part of a probing program).`);
            return;
        }
        if (/^o\s*[<\d]/i.test(code)) {
            throw new ProbeGcodeError(lineNo, 'O-word subroutines / flow control (o<name> sub, o100 if ...) are not supported - this is a LinuxCNC macro, not a posted program; post it with literal numbers.');
        }
        if (code.includes('#') || code.includes('[')) {
            throw new ProbeGcodeError(lineNo, 'macro variables / expressions (#, [ ]) are not supported - post the program with literal numbers.');
        }
        // Words: letter followed by a number.
        const words: { letter: string; value: string }[] = [];
        // Fanuc-style trailing decimals (Z0.) are legal: digits with an optional point either side.
        const wordRe = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;
        let wm: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((wm = wordRe.exec(code)) !== null) {
            words.push({ letter: wm[1].toUpperCase(), value: wm[2] });
        }
        const rest = code.replace(wordRe, '').trim();
        if (rest) {
            throw new ProbeGcodeError(lineNo, `unrecognised text "${rest}".`);
        }
        const gCodes = words.filter((w) => w.letter === 'G').map((w) => normalizeCode('G', w.value));
        const mCodes = words.filter((w) => w.letter === 'M').map((w) => normalizeCode('M', w.value));
        const axis: { [letter: string]: number } = {};
        for (const w of words) {
            if ('XYZBFPSTHIJKRQD'.includes(w.letter)) {
                axis[w.letter] = Number(w.value);
            } else if (w.letter === 'A' || w.letter === 'C') {
                throw new ProbeGcodeError(lineNo, `${w.letter} axis words are not supported - the Snapmaker rotary is B (along machine Y).`);
            } else if (w.letter !== 'G' && w.letter !== 'M') {
                throw new ProbeGcodeError(lineNo, `unsupported word ${w.letter}${w.value}.`);
            }
        }

        for (const m of mCodes) {
            if (END_M.has(m)) {
                ended = true;
                return;
            }
            if (IGNORED_M.has(m)) {
                continue;
            }
            if (m === 'M3' || m === 'M03' || m === 'M4' || m === 'M04') {
                throw new ProbeGcodeError(lineNo, `${m} would start the spindle with the touch probe fitted - refused.`);
            }
            if (m === 'M0' || m === 'M00' || m === 'M1' || m === 'M01') {
                throw new ProbeGcodeError(lineNo, `${m} (program pause) needs an operator at the machine - remove it; the confirm page is the approval.`);
            }
            if (m === 'M6' || m === 'M06') {
                throw new ProbeGcodeError(lineNo, 'M6 tool change is not part of a probing program (use the tool-change workflow).');
            }
            throw new ProbeGcodeError(lineNo, `unsupported ${m}.`);
        }
        for (const g of gCodes) {
            if (!SUPPORTED_G.has(g)) {
                if (g === 'G28' || g === 'G28.1') {
                    throw new ProbeGcodeError(lineNo, 'G28 homing is refused inside a probing program (homing also turns the rotary).');
                }
                if (g === 'G92' || /^G5[5-9]$/.test(g)) {
                    throw new ProbeGcodeError(lineNo, `${g} changes the work origin - refused; probing programs run in G54 (or G53 per line).`);
                }
                if (g === 'G2' || g === 'G3') {
                    throw new ProbeGcodeError(lineNo, 'arcs are not part of a probing program.');
                }
                throw new ProbeGcodeError(lineNo, `unsupported ${g}.`);
            }
        }

        // Modal state words on this line.
        let machineFrameThisLine = false;
        let probeMode: ProbeMode | null = null;
        let dwell = false;
        for (const g of gCodes) {
            if (g === 'G90') {
                absolute = true;
                distanceModeSeen = true;
            } else if (g === 'G91') {
                absolute = false;
                distanceModeSeen = true;
            } else if (g === 'G20') {
                unitScale = 25.4;
                warnings.push(`line ${lineNo}: G20 inches - converted to mm.`);
            } else if (g === 'G21') {
                unitScale = 1;
            } else if (g === 'G53') {
                machineFrameThisLine = true;
            } else if (g === 'G0') {
                motionMode = 'G0';
            } else if (g === 'G1') {
                motionMode = 'G1';
            } else if (g === 'G4') {
                dwell = true;
            } else if (g.startsWith('G38.')) {
                probeMode = g as ProbeMode;
            } else if (g === 'G43' || g === 'G49') {
                warnings.push(`line ${lineNo}: ${g} tool length compensation is ignored - positions run as programmed.`);
            }
        }

        if (dwell) {
            // G4 P is milliseconds on Marlin/Grbl when large, seconds when small; S is seconds.
            let seconds = axis.S ?? 0;
            if (axis.P !== undefined) {
                seconds = axis.P > 30 ? axis.P / 1000 : axis.P;
            }
            if (seconds > 0) {
                steps.push({ kind: 'dwell', line: lineNo, source: raw.trim(), seconds: Math.min(seconds, MAX_DWELL_S) });
            }
            return;
        }

        const hasAxis = axis.X !== undefined || axis.Y !== undefined || axis.Z !== undefined;
        if (axis.B !== undefined) {
            // 3+2 station: a bare B word on a G0/G1 line. Simultaneous rotary
            // + linear motion has no place in a probing program (and the
            // sensor-gated march cannot honour it); incremental B neither.
            if (hasAxis || probeMode) {
                throw new ProbeGcodeError(lineNo, 'B together with X/Y/Z or a G38 cycle is not supported - rotate on its own G0 line first.');
            }
            if (!absolute) {
                throw new ProbeGcodeError(lineNo, 'incremental (G91) B rotation is not supported - post absolute B angles.');
            }
            if (!motionMode) {
                throw new ProbeGcodeError(lineNo, 'B word without a motion mode (G0/G1).');
            }
            const b = Number(axis.B);
            if (!within(b, B_AXIS_DEG)) {
                throw new ProbeGcodeError(lineNo, `B${axis.B} is outside ${B_AXIS_DEG.min}..${B_AXIS_DEG.max}.`);
            }
            if (currentB === null || Math.abs(b - currentB) > 1e-6) {
                steps.push({ kind: 'rotate', line: lineNo, source: raw.trim(), bDeg: r3(b), fromB: currentB });
                rotations.push(r3(b));
                currentB = r3(b);
            }
            return;
        }
        if (!hasAxis) {
            return; // pure modal line
        }
        const feed = axis.F !== undefined ? axis.F * unitScale : null;
        if (!probeMode && !motionMode) {
            throw new ProbeGcodeError(lineNo, 'axis words without a motion mode (G0/G1/G38.x).');
        }
        if (!distanceModeSeen) {
            warnings.push(`line ${lineNo}: motion before any G90/G91 - absolute assumed.`);
            distanceModeSeen = true;
        }
        // Target in machine coordinates.
        const target: Xyz = { ...position };
        if (machineFrameThisLine && !absolute) {
            // Senders (UGS) emit G53 recentring moves with G91 still active; the
            // only unambiguous reading of a G53 word is an absolute machine
            // coordinate, so that is what it gets - and the page says so.
            warnings.push(`line ${lineNo}: G53 taken as absolute machine coordinates although G91 is active.`);
        }
        const apply = (letter: 'X' | 'Y' | 'Z', key: 'x' | 'y' | 'z') => {
            if (axis[letter] === undefined) {
                return;
            }
            const v = axis[letter] * unitScale;
            if (machineFrameThisLine) {
                target[key] = r3(v);
            } else if (!absolute) {
                target[key] = r3(position[key] + v);
            } else {
                target[key] = r3(v - offset[key]);
            }
        };
        apply('X', 'x');
        apply('Y', 'y');
        apply('Z', 'z');

        if (probeMode) {
            if (target.x === position.x && target.y === position.y && target.z === position.z) {
                throw new ProbeGcodeError(lineNo, `${probeMode} with no travel.`);
            }
            probeCount += 1;
            const meta: ProbeMeta = pendingMeta || {};
            pendingMeta = null;
            steps.push({ kind: 'probe', line: lineNo, source: raw.trim(), mode: probeMode, index: probeCount, from: { ...position }, target, feed, meta, bDeg: currentB });
            // A probe cycle ends where it made contact (unknown at parse time,
            // somewhere between from and target). The runner retreats to
            // `from` after every probe so the simulation continues from there:
            // links after a probe start at the probe's start point.
            return;
        }
        steps.push({ kind: 'move', line: lineNo, source: raw.trim(), rapid: motionMode === 'G0', from: { ...position }, target, feed });
        position = target;
    });

    if (probeCount === 0) {
        throw new ProbeGcodeError(0, 'the program contains no G38.x probe cycle.');
    }
    return { steps, probeCount, warnings, end: position, lineCount: lines.length, rotations, results };
}
