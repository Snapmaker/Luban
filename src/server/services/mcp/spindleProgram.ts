// The commanded spindle speed and motion kind at every line of a file job,
// so telemetry can align a status report or an audio frame to what the
// controller was told - by the line number the machine reports, not by
// guessing where a cut falls on a timeline.
//
// A file job runs on the machine's own interpreter. The status poll's
// `currentLine` is the PARSER's position, not the executing line: measured
// 2026-09-29 (job ad892e15b651) the A350 had consumed 85 of 104 lines one
// second in and the whole file by 44 s of a five-minute job, so a tracker
// keyed on it read `M5` while the cut was still running. The executing line
// is therefore INFERRED from the reported position against the file's own
// path (inferExecutingLine): the motion line whose segment the head is on,
// or - when the head sits at a segment's end - the dwell / spindle lines
// that follow it, with the parser line as an upper bound. Commanded S at
// that line is the last `M3 S` / `M4 S` (or a bare `S` while the spindle is
// on) at or before it; the line's kind says whether the spindle is loaded
// (a G1/G2/G3 feed move) or free (rapid, dwell, spindle command, comment).
//
// Pure: no server imports, unit-tested in tests/spindleProgram.test.ts.

export type LineKind = 'feed' | 'rapid' | 'dwell' | 'spindle' | 'other';

export interface Point3 {
    x: number;
    y: number;
    z: number;
}

export interface ProgramLine {
    kind: LineKind;
    /** Commanded S in effect AFTER this line, null while the spindle is off. */
    s: number | null;
    /** Feed rate in effect after this line (mm/min), null until an F word is seen. */
    feed: number | null;
    /** Index into `epochs` of the spindle epoch this line belongs to, -1 while off. */
    epoch: number;
    /** Motion lines: the segment this line commands (absolute file coordinates; NaN = axis never set). */
    motion?: { from: Point3; to: Point3 };
}

export type LineMatch = 'segment' | 'endpoint' | 'unmatched';

export interface ExecutingLine {
    /** 1-based line the machine is judged to be executing. */
    line: number;
    context: ProgramLine;
    match: LineMatch;
    /** Distance from the reported position to the matched segment, mm. */
    distanceMm: number;
}

/** One run of a constant commanded S with the spindle on. */
export interface SpindleEpoch {
    index: number;
    /** 1-based line of the command that started it. */
    line: number;
    s: number;
}

export interface SpindleProgram {
    lines: ProgramLine[];
    epochs: SpindleEpoch[];
    lineCount: number;
}

const AXIS_WORDS = ['X', 'Y', 'Z', 'A', 'B', 'C', 'I', 'J', 'K', 'R'];

function stripComments(line: string): string {
    return line.replace(/\(.*?\)/g, ' ').replace(/;.*$/, ' ');
}

export function parseSpindleProgram(text: string): SpindleProgram {
    const raw = String(text || '').split(/\r?\n/);
    const lines: ProgramLine[] = [];
    const epochs: SpindleEpoch[] = [];
    let s: number | null = null;
    let feed: number | null = null;
    let motion: 'G0' | 'G1' = 'G0';
    let epoch = -1;
    let relative = false;
    const position: Point3 = { x: NaN, y: NaN, z: NaN };

    raw.forEach((source, index) => {
        const body = stripComments(source).toUpperCase();
        const words: { [letter: string]: number } = {};
        const gCodes: number[] = [];
        const mCodes: number[] = [];
        const wordRe = /([A-Z])\s*([-+]?\d*\.?\d+)/g;
        let match: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((match = wordRe.exec(body)) !== null) {
            const letter = match[1];
            const value = Number(match[2]);
            if (letter === 'G') {
                gCodes.push(value);
            } else if (letter === 'M') {
                mCodes.push(value);
            } else {
                words[letter] = value;
            }
        }
        if (words.F !== undefined && words.F > 0) {
            feed = words.F;
        }
        let kind: LineKind = 'other';
        if (mCodes.includes(3) || mCodes.includes(4)) {
            kind = 'spindle';
            const commanded = words.S !== undefined ? words.S : s;
            if (commanded !== null && commanded > 0) {
                if (s !== commanded || epoch < 0) {
                    epoch = epochs.length;
                    epochs.push({ index: epoch, line: index + 1, s: commanded });
                }
                s = commanded;
            }
        } else if (mCodes.includes(5)) {
            kind = 'spindle';
            s = null;
            epoch = -1;
        } else if (words.S !== undefined && s !== null && words.S > 0 && words.S !== s && !gCodes.length) {
            // A bare S word while running changes the speed (Marlin/Snapmaker).
            kind = 'spindle';
            s = words.S;
            epoch = epochs.length;
            epochs.push({ index: epoch, line: index + 1, s });
        }
        if (gCodes.includes(90)) {
            relative = false;
        }
        if (gCodes.includes(91)) {
            relative = true;
        }
        let segment: { from: Point3; to: Point3 } | undefined;
        if (gCodes.includes(4)) {
            kind = 'dwell';
        } else if (kind !== 'spindle') {
            if (gCodes.includes(0)) {
                motion = 'G0';
            } else if (gCodes.some((g) => g === 1 || g === 2 || g === 3)) {
                motion = 'G1';
            }
            const hasAxis = AXIS_WORDS.some((axis) => words[axis] !== undefined);
            const motionWord = gCodes.some((g) => g === 0 || g === 1 || g === 2 || g === 3);
            if (hasAxis && (motionWord || !gCodes.length)) {
                kind = motion === 'G1' ? 'feed' : 'rapid';
                const from = { ...position };
                for (const axis of ['x', 'y', 'z'] as const) {
                    const word = words[axis.toUpperCase()];
                    if (word !== undefined) {
                        position[axis] = relative && Number.isFinite(position[axis]) ? position[axis] + word : word;
                    }
                }
                segment = { from, to: { ...position } };
            }
        }
        lines.push(segment ? { kind, s, feed, epoch, motion: segment } : { kind, s, feed, epoch });
    });
    return { lines, epochs, lineCount: lines.length };
}

/** Point-to-segment distance over the axes both ends know (NaN axes are ignored); Infinity when nothing is known. */
function segmentDistance(p: Point3, a: Point3, b: Point3): { distance: number; atEnd: boolean; atStart: boolean } {
    const axes = (['x', 'y', 'z'] as const).filter((axis) => Number.isFinite(p[axis]) && Number.isFinite(a[axis]) && Number.isFinite(b[axis]));
    if (!axes.length) {
        return { distance: Infinity, atEnd: false, atStart: false };
    }
    let ab2 = 0;
    let apab = 0;
    for (const axis of axes) {
        const d = b[axis] - a[axis];
        ab2 += d * d;
        apab += (p[axis] - a[axis]) * d;
    }
    const t = ab2 > 0 ? Math.min(1, Math.max(0, apab / ab2)) : 1;
    let dist2 = 0;
    let end2 = 0;
    for (const axis of axes) {
        const proj = a[axis] + t * (b[axis] - a[axis]);
        dist2 += (p[axis] - proj) ** 2;
        end2 += (p[axis] - b[axis]) ** 2;
    }
    return { distance: Math.sqrt(dist2), atEnd: Math.sqrt(end2) <= 1e-9 || t >= 0.999, atStart: ab2 > 0 && t <= 0.001 };
}

/**
 * Which line the machine is executing, from its reported position.
 *
 * Candidates are the motion lines between `lastLine` (execution never goes
 * backwards) and `parserLine` (the controller cannot execute what it has
 * not read). The closest segment within `toleranceMm` wins; ties go to the
 * later line, except that a segment the head has just finished beats one
 * that merely starts at the same point. A head sitting at a segment's END
 * may already be inside the non-motion lines that follow (a dwell after
 * `M3 S`, `M5`), so the answer then advances to the last such line before
 * the next motion line - but not past a planner sync (`G4`, `M3`/`M5`): the
 * queue cannot be beyond a sync until it executes, and the comment lines
 * after it are not "queued". Still bounded by the parser line. `lastLine`
 * only ratchets the search to the last MOTION line at or before it, so a
 * head reported at a sync can be re-matched to the segment it finished.
 * Nothing within tolerance (mid-report, a position the file never visits)
 * keeps `lastLine` and says `unmatched`.
 */
export function inferExecutingLine(
    program: SpindleProgram,
    position: Point3,
    parserLine: number | null,
    lastLine: number | null,
    toleranceMm = 0.5,
): ExecutingLine | null {
    const count = program.lines.length;
    if (!count) {
        return null;
    }
    const upper = parserLine !== null && Number.isFinite(parserLine) ? Math.min(count, Math.max(1, Math.round(parserLine))) : count;
    let lower = 1;
    if (lastLine !== null && Number.isFinite(lastLine)) {
        lower = Math.min(upper, Math.max(1, Math.round(lastLine)));
        while (lower > 1 && !program.lines[lower - 1].motion) {
            lower -= 1;
        }
    }
    let best: { line: number; distance: number; atEnd: boolean; atStart: boolean } | null = null;
    for (let line = lower; line <= upper; line++) {
        const entry = program.lines[line - 1];
        if (!entry.motion) {
            continue;
        }
        const { distance, atEnd, atStart } = segmentDistance(position, entry.motion.from, entry.motion.to);
        if (distance > toleranceMm) {
            continue;
        }
        // Closest wins; on a tie a segment the head has not started (the
        // point at its start) loses to the one it has just finished, then
        // the later line wins.
        const tie = best !== null && Math.abs(distance - best.distance) <= 1e-9;
        if (!best || distance < best.distance - 1e-9 || (tie && (!atStart || best.atStart))) {
            best = { line, distance, atEnd, atStart };
        }
    }
    if (!best) {
        const held = lastLine !== null && lastLine >= 1 && lastLine <= count ? lastLine : null;
        return held === null ? null : { line: held, context: program.lines[held - 1], match: 'unmatched', distanceMm: Infinity };
    }
    let line = best.line;
    let match: LineMatch = 'segment';
    if (best.atEnd) {
        // Advance through the non-motion lines that follow, up to the parser
        // line, stopping at the last planner sync among them (the comments
        // after a dwell are not queued; job b3e8f3dd0e34 read as "live" on
        // the comment after its 20 s dwell and the estimate ran ahead).
        let next = line;
        let sync = 0;
        while (next + 1 <= upper && !program.lines[next].motion) {
            next += 1;
            const kind = program.lines[next - 1].kind;
            if (kind === 'dwell' || kind === 'spindle') {
                sync = next;
            }
        }
        if (sync) {
            next = sync;
        }
        if (next > line) {
            line = next;
            match = 'endpoint';
        }
    }
    return { line, context: program.lines[line - 1], match, distanceMm: best.distance };
}

/** Context at a 1-based line number; null when the number is outside the file. */
export function lineContext(program: SpindleProgram, currentLine: number): ProgramLine | null {
    if (!Number.isFinite(currentLine)) {
        return null;
    }
    const index = Math.round(currentLine) - 1;
    if (index < 0 || index >= program.lines.length) {
        return null;
    }
    return program.lines[index];
}
