/**
 * Offline import of the observed Machining Doctor thread-milling controller variants.
 * No machine state, transport or origin writes. Emit explicit absolute G0/G1
 * blocks so preview and validation see the same polygon the controller runs.
 */
import { GcodeValidationReport, validateGcode } from './validator';

export const THREAD_MILLING_CONTROLLERS = ['fanuc', 'okuma', 'mazak', 'haas', 'siemens_c', 'siemens_d', 'mitsubishi', 'mori_seiki'] as const;
export type ThreadMillingController = typeof THREAD_MILLING_CONTROLLERS[number];

export interface ThreadMillingOptions {
    sourceController?: ThreadMillingController;
    /** Caller has verified that D compensation is zero; D1 is a register, not 1 mm. */
    toolCenterPath: boolean;
    /** Work Z is already referenced to the fitted tool tip; do not apply H again. */
    toolLengthApplied: boolean;
    /** Explicit toolhead mode; never infer a percentage from Fanuc S RPM. */
    spindleMode: 'power_percent' | 'cnc_200w_rpm';
    spindlePowerPercent?: number;
    chordToleranceMm?: number;
}

export interface ThreadMillingConversion {
    gcode: string;
    warnings: string[];
    changes: string[];
    sourceSpindleRpm: number[];
    arcCount: number;
    fullCircleCount: number;
    segmentCount: number;
    validation: GcodeValidationReport;
}

type Axis = 'X' | 'Y' | 'Z';
const AXES: Axis[] = ['X', 'Y', 'Z'];
const TAU = 2 * Math.PI;
const MAX_SEGMENTS = 200000;
const MAX_COORDINATE = 1000000;

function fail(line: number, message: string): never {
    throw new Error(`Line ${line}: ${message}`);
}

// Deliberately strict: never skip an unrecognised word, macro or expression.
function wordsOnLine(source: string, line: number): Array<[string, number]> {
    let depth = 0;
    let code = '';
    for (const char of source) {
        if (char === '(') depth += 1;
        else if (char === ')') {
            if (!depth) fail(line, 'Unmatched comment closing parenthesis.');
            depth -= 1;
        } else if (!depth && char === ';') break;
        else if (!depth) code += char;
    }
    if (depth) fail(line, 'Unclosed comment.');
    code = code.trim().toUpperCase();
    if (!code || code === '%') return [];
    const words: Array<[string, number]> = [];
    while (code) {
        const match = /^([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*/.exec(code);
        if (!match) fail(line, `Unsupported syntax near ${code.slice(0, 40)}.`);
        const value = Number(match[2]);
        if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) fail(line, 'Word value is out of range.');
        words.push([match[1], value]);
        code = code.slice(match[0].length);
    }
    return words;
}

function number(value: number): string {
    return String(Number(value.toFixed(6)));
}

export function convertThreadMillingGcode(source: string, options: ThreadMillingOptions): ThreadMillingConversion {
    if (typeof source !== 'string' || !source.trim() || source.length > 2000000) {
        throw new Error('Provide a non-empty program no larger than 2 MB.');
    }
    const declaredCompensation = /\(CUTTER COMPENSATION D\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/i.exec(source);
    if (declaredCompensation && Number(declaredCompensation[1]) !== 0) {
        throw new Error('Source header declares nonzero cutter compensation; regenerate a tool-centre path with D=0.');
    }
    if (options.toolCenterPath !== true) {
        throw new Error('Confirm tool_center_path: true only for a tool-centre program with zero cutter compensation.');
    }
    if (options.toolLengthApplied !== true) {
        throw new Error('Confirm tool_length_applied: true only when work Z already references the fitted tool tip.');
    }
    const controller = options.sourceController === undefined ? 'fanuc' : options.sourceController;
    if (!THREAD_MILLING_CONTROLLERS.includes(controller)) throw new Error('Unsupported source_controller.');
    const power = options.spindlePowerPercent;
    if (!['power_percent', 'cnc_200w_rpm'].includes(options.spindleMode)) throw new Error('Choose spindle_mode: power_percent or cnc_200w_rpm.');
    if (options.spindleMode === 'cnc_200w_rpm' && power !== undefined) throw new Error('Do not supply power in RPM mode.');
    if (options.spindleMode === 'power_percent' && (typeof power !== 'number' || !Number.isInteger(power) || power <= 0 || power > 100)) {
        throw new Error('spindle_power_percent must be an integer from 1 to 100; Fanuc RPM is not a power percentage.');
    }
    const tolerance = options.chordToleranceMm === undefined ? 0.002 : options.chordToleranceMm;
    if (!Number.isFinite(tolerance) || tolerance < 0.00001 || tolerance > 0.01) {
        throw new Error('chord_tolerance_mm must be between 0.00001 and 0.01 mm.');
    }
    const output = [
        `; Thread-milling import from ${controller}: review before staging`,
        '; Tool-centre path, zero D compensation; work Z already references the fitted tool tip',
        `; Spindle mode: ${options.spindleMode}; source feeds preserved in mm/min`,
        'G21', 'G90', 'G54',
    ];
    const changes = new Set<string>();
    const warnings = [
        'Flute count does not determine the number of axial thread forms. Verify the generator cutter type, diameter, pitch and cutting length.',
        'Source feeds are preserved in mm/min. Review them for the fitted cutter, material and spindle setting.',
        'Initial approach follows the source program. Its starting position and clearance are not known by this offline converter.',
    ];
    let position: Partial<Record<Axis, number>> = {};
    let absolute: boolean | null = null;
    let unitScale: number | null = null;
    let xyPlane = false;
    let perMinute = false;
    let workspace = false;
    let motion: number | null = null;
    let feed: number | undefined;
    let rpm: number | undefined;
    let spindleOn = false;
    let ended = false;
    let toolChanges = 0;
    let arcCount = 0;
    let fullCircleCount = 0;
    let segmentCount = 0;
    let moved = false;
    const sourceSpindleRpm = new Set<number>();

    const emit = (line: number, mode: number, point: Partial<Record<Axis, number>>): void => {
        segmentCount += 1;
        if (segmentCount > MAX_SEGMENTS) fail(line, 'Converted program exceeds 200000 motion segments.');
        if (AXES.some((axis) => point[axis] !== undefined
            && (!Number.isFinite(point[axis]) || Math.abs(point[axis] as number) > MAX_COORDINATE))) {
            fail(line, 'Accumulated position is out of range.');
        }
        const axes = AXES.filter((axis) => point[axis] !== undefined).map((axis) => `${axis}${number(point[axis] as number)}`);
        output.push(`G${mode} ${axes.join(' ')}${feed !== undefined ? ` F${number(feed)}` : ''}`);
    };

    source.split(/\r?\n/).forEach((text, index) => {
        const line = index + 1;
        const programHeader = text.trim().toUpperCase();
        if ((controller === 'okuma' && /^%O[0-9]+\.MIN%$/.test(programHeader))
            || (controller === 'siemens_c' && /^%MPF\s+[0-9]+$/.test(programHeader))) {
            if (moved || ended) fail(line, 'Program header after motion or program end.');
            changes.add('Removed controller-specific program wrapper.');
            return;
        }
        let tokens = wordsOnLine(text, line);
        // The live Mazak export preselects T0 after the actual initial tool.
        // This is not a second fitted tool; only accept the exact observed idiom.
        const toolWords = tokens.filter(([letter]) => letter === 'T');
        if (controller === 'mazak' && !moved && toolChanges === 0 && toolWords.length === 2
            && toolWords[0][1] > 0 && toolWords[1][1] === 0 && tokens.some(([letter, value]) => letter === 'M' && value === 6)) {
            tokens = tokens.filter(([letter, value]) => letter !== 'T' || value !== 0);
            changes.add('Removed Mazak initial T0 preselection; the first T tool must already be fitted.');
        }
        if (!tokens.length) return;
        if (ended) fail(line, 'Executable words after program end.');
        const g: number[] = [];
        const m: number[] = [];
        const words: Record<string, number> = {};
        tokens.forEach(([letter, value]) => {
            if (letter === 'G') g.push(value);
            else if (letter === 'M') m.push(value);
            else {
                if (!'XYZIJFSDHTNO'.includes(letter)) fail(line, `Unsupported word ${letter}.`);
                if (words[letter] !== undefined) fail(line, `Duplicate ${letter} word.`);
                words[letter] = value;
            }
        });
        if (words.N !== undefined && (!Number.isInteger(words.N) || words.N < 0)) fail(line, 'Invalid block number.');
        if (words.O !== undefined) {
            if (tokens.length !== 1 || moved || !Number.isInteger(words.O) || words.O < 0) fail(line, 'Invalid program number.');
            changes.add('Removed program delimiters, block numbers and program number.');
            return;
        }
        if (controller === 'okuma') {
            if (g.includes(43) || g.includes(54)) fail(line, 'Use the generator Okuma G15 H1 / G56 Hn setup, not Fanuc offset codes.');
            if (g.includes(15)) {
                if (g.length !== 1 || m.length || words.H !== 1 || Object.keys(words).some((key) => !['H', 'N'].includes(key))) {
                    fail(line, 'Only a standalone Okuma G15 H1 workspace selection is supported.');
                }
                g[0] = 54;
                delete words.H;
                changes.add('Mapped Okuma G15 H1 to the declared target G54 work origin.');
            }
            if (g.includes(56)) {
                g[g.indexOf(56)] = 43;
                changes.add('Removed Okuma G56/H tool-length lookup under the tool-tip work-origin declaration.');
            }
        }
        const siemensLength = ['siemens_c', 'siemens_d'].includes(controller) && g.includes(0)
            && words.H !== undefined && AXES.some((axis) => words[axis] !== undefined);
        if (siemensLength) changes.add('Removed Siemens H lookup on G0; retained its motion under the tool-tip work-origin declaration.');
        const groups = [[0, 1, 2, 3], [90, 91], [40, 41, 42], [20, 21]];
        groups.forEach((group) => {
            if (g.filter((code) => group.includes(code)).length > 1) fail(line, 'Conflicting modal codes.');
        });
        g.forEach((code) => {
            if ([0, 1, 2, 3].includes(code)) motion = code;
            else if (code === 90 || code === 91) absolute = code === 90;
            else if (code === 20 || code === 21) {
                const scale = code === 20 ? 25.4 : 1;
                if (unitScale !== null && unitScale !== scale && (moved || feed !== undefined)) {
                    fail(line, 'Changing units after feed or motion is unsupported; use one unit system per program.');
                }
                unitScale = scale;
            } else if (code === 17) xyPlane = true;
            else if (code === 94) perMinute = true;
            else if (code === 54) workspace = true;
            else if (code === 91.1) { /* I/J are always incremental in this importer. */ } else if ([40, 41, 42].includes(code)) changes.add('Removed G40/G41/G42 and D register selection under the explicit zero-compensation declaration.');
            else if (code === 43) changes.add('Removed G43/H tool-length lookup; retained its modal motion under the tool-tip work-origin declaration.');
            else fail(line, `Unsupported G${code}; only G17/G94/G54 tool-centre programs are supported.`);
        });
        if (words.D !== undefined && (!g.some((code) => [40, 41, 42].includes(code)) || !Number.isInteger(words.D) || words.D < 0)) {
            fail(line, 'D must be a non-negative register number on a cutter-compensation block.');
        }
        if (g.includes(43) && (words.H === undefined || !AXES.some((axis) => words[axis] !== undefined))) {
            fail(line, 'G43 requires an H register and a modal motion target.');
        }
        if (words.H !== undefined && ((!g.includes(43) && !siemensLength) || !Number.isInteger(words.H) || words.H < 0)) fail(line, 'Invalid H register.');
        if (words.F !== undefined) {
            if (words.F <= 0) fail(line, 'Feed must be positive.');
            if (unitScale === null) fail(line, 'Declare G20/G21 before the feed.');
            feed = words.F * unitScale;
            if (Number(number(feed)) <= 0) fail(line, 'Feed is below output precision.');
        }
        if (words.S !== undefined) {
            if (words.S <= 0) fail(line, 'Spindle RPM must be positive.');
            if (options.spindleMode === 'cnc_200w_rpm' && (!Number.isInteger(words.S) || words.S < 8000 || words.S > 18000)) {
                fail(line, '200 W CNC RPM must be an integer from 8000 to 18000; regenerate feeds/speeds instead of silently clamping.');
            }
            rpm = words.S;
            sourceSpindleRpm.add(rpm);
        }
        if (m.filter((code) => [3, 5, 6, 30, 2].includes(code)).length > 1) fail(line, 'Conflicting spindle/tool/end commands.');
        m.forEach((code) => {
            if (code === 6) {
                toolChanges += 1;
                if (moved || toolChanges > 1 || words.T === undefined) fail(line, 'Only one initial M6 Tn is supported; fit that tool before running.');
                changes.add(`Removed initial M6 T${words.T}; the declared tool must already be fitted.`);
            } else if (code === 3) {
                if (rpm === undefined) fail(line, 'M3 requires source spindle RPM.');
                output.push(options.spindleMode === 'power_percent' ? `M3 P${number(power as number)}` : `M3 S${number(rpm)}`);
                spindleOn = true;
                changes.add(options.spindleMode === 'power_percent'
                    ? 'Replaced Fanuc S RPM with the explicitly supplied Snapmaker M3 P percentage.'
                    : 'Preserved source RPM as M3 S for the explicitly selected 200 W CNC head.');
            } else if (code === 5) {
                output.push('M5');
                spindleOn = false;
            } else if ([7, 8, 9].includes(code)) {
                changes.add('Removed M7/M8/M9 coolant commands; coolant is not controlled by this program.');
            } else if (code === 30 || code === 2) {
                if (AXES.some((axis) => words[axis] !== undefined) || words.I !== undefined || words.J !== undefined) {
                    fail(line, 'Program end cannot share a motion block.');
                }
                ended = true;
                output.push('M5', 'G90');
                spindleOn = false;
                changes.add('Replaced program end with explicit M5 and G90.');
            } else fail(line, `Unsupported M${code}.`);
        });
        if (words.T !== undefined && (!m.includes(6) || !Number.isInteger(words.T) || words.T < 1)) fail(line, 'T must select the single initial tool with M6.');
        if (words.S !== undefined && spindleOn && !m.includes(3) && options.spindleMode === 'cnc_200w_rpm') {
            output.push(`M3 S${number(words.S)}`);
        }
        const hasAxes = AXES.some((axis) => words[axis] !== undefined);
        const hasCenter = words.I !== undefined || words.J !== undefined;
        if (!hasAxes && !hasCenter) return;
        if (unitScale === null || !xyPlane || !perMinute || !workspace || absolute === null) {
            fail(line, 'Declare G20/G21, G17, G94, G54 and G90/G91 before motion.');
        }
        if (motion === null) fail(line, 'No modal motion for these coordinates.');
        if (motion !== 0 && feed === undefined) fail(line, 'Cutting motion requires a feed.');
        if (motion !== 0 && !spindleOn) fail(line, 'Cutting motion requires M3.');
        const target = { ...position };
        AXES.forEach((axis) => {
            if (words[axis] === undefined) return;
            if (!absolute && position[axis] === undefined) fail(line, `Relative ${axis} has no established start coordinate.`);
            target[axis] = (absolute ? 0 : position[axis] as number) + words[axis] * (unitScale as number);
        });
        output.push(`; Source line ${line}`);
        if (motion === 0 || motion === 1) {
            if (hasCenter) fail(line, 'I/J requires G2 or G3.');
            // Do not fabricate unspecified initial coordinates.
            emit(line, motion, Object.fromEntries(AXES.filter((axis) => words[axis] !== undefined).map((axis) => [axis, target[axis]])));
        } else {
            if (!hasCenter || AXES.some((axis) => position[axis] === undefined)) fail(line, 'An arc requires I/J and an established X/Y/Z start.');
            const x = position.X as number;
            const y = position.Y as number;
            const z = position.Z as number;
            const tx = target.X as number;
            const ty = target.Y as number;
            const tz = target.Z as number;
            const cx = x + (words.I || 0) * unitScale;
            const cy = y + (words.J || 0) * unitScale;
            const radius = Math.hypot(x - cx, y - cy);
            const endRadius = Math.hypot(tx - cx, ty - cy);
            if (radius <= 0) fail(line, 'Arc radius must be positive.');
            // Generator coordinates are rounded to 0.001 mm. Do not repair an
            // inconsistent radius by silently drawing a different circle.
            if (endRadius === 0 || Math.abs(endRadius - radius) > Math.min(0.002, radius * 0.01)) {
                fail(line, 'Arc endpoint radius differs from its start by more than 0.002 mm or 1 percent; increase generator precision.');
            }
            const full = Math.hypot(tx - x, ty - y) < 1e-9;
            const startAngle = Math.atan2(y - cy, x - cx);
            let sweep = Math.atan2(ty - cy, tx - cx) - startAngle;
            if (motion === 3) {
                if (sweep <= 0 || full) sweep += TAU;
            } else if (sweep >= 0 || full) sweep -= TAU;
            if (full) sweep = motion === 3 ? TAU : -TAU;
            // Reserve half the chord tolerance for output rounding. Source
            // radius mismatch is separate and reported explicitly.
            const maxAngle = Math.min(Math.PI / 18, 2 * Math.acos(Math.max(-1, 1 - tolerance / (2 * Math.max(radius, endRadius)))));
            const count = Math.ceil(Math.max(Math.abs(sweep) / maxAngle, Math.hypot(sweep * Math.max(radius, endRadius), tz - z, endRadius - radius) / 0.25));
            if (!Number.isFinite(count) || count + segmentCount > MAX_SEGMENTS) fail(line, 'Arc requires too many segments.');
            if (Math.abs(endRadius - radius) > 0.000001) {
                warnings.push(`Line ${line}: rounded arc radii differ by ${number(Math.abs(endRadius - radius))} mm; radius interpolated to preserve the endpoint.`);
            }
            for (let step = 1; step <= count; step += 1) {
                const fraction = step / count;
                const angle = startAngle + sweep * fraction;
                const r = radius + (endRadius - radius) * fraction;
                emit(line, 1, step === count ? target : {
                    X: cx + r * Math.cos(angle), Y: cy + r * Math.sin(angle), Z: z + (tz - z) * fraction,
                });
            }
            arcCount += 1;
            if (full) fullCircleCount += 1;
        }
        position = target;
        moved = true;
    });
    if (!ended) throw new Error('Program must end with M30 or M2.');
    if (!arcCount) throw new Error('No thread-milling arcs found.');
    changes.add('Converted G20/G21 coordinates and feeds to millimetres and mm/min.');
    changes.add('Expanded G90/G91 modal moves into explicit absolute G0/G1 blocks; I/J full circles and helical Z are preserved.');
    changes.add(`Linearised arcs with ${number(tolerance)} mm chord tolerance, at most 10 degrees and 0.25 mm per segment.`);
    const gcode = `${output.join('\n')}\n`;
    return {
        gcode,
        warnings,
        changes: [...changes],
        sourceSpindleRpm: [...sourceSpindleRpm],
        arcCount,
        fullCircleCount,
        segmentCount,
        validation: validateGcode(gcode),
    };
}
