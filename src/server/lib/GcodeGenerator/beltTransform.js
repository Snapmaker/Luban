/**
 * Belt (sideways-rollers) G-code transform for laser jobs.
 *
 * Some Snapmaker setups replace the rotary chuck with a pair of rollers driving
 * a conveyor belt, with the rotary module mounted SIDEWAYS. The 4th (B) axis
 * then feeds a flat strip past the laser instead of spinning a cylinder:
 *
 *   - the laser sweep must happen on X (across the belt), and
 *   - the belt feed on B (already in chuck degrees for the roller diameter,
 *     since the job is sliced with diameter = roller, so 1 deg maps 1:1 to belt
 *     travel and no feed rescaling is needed).
 *
 * Luban's engine emits an ordinary rotary toolpath (motion in Y and B, plus a
 * seed `G0 X0.00`). This module relabels that motion for the belt rig:
 *
 *   - sweep axis (auto-detected: Y or B) -> X  (unscaled)
 *   - feed  axis (the other of Y/B)      -> B  (unscaled)
 *   - the unused seed axis                -> dropped
 *   - end-of-program park moves and G92 rotary-origin resets -> dropped
 *
 * It also (optionally) shifts B so the belt feed starts at 0 and runs positive,
 * and reports the transformed X/B extents so the caller can rewrite the G-code
 * header's boundary fields to match the remapped motion.
 *
 * This is a JavaScript port of the standalone `remap_sideways.py` post-processor
 * (degrees-only path), moved inline so belt jobs export ready to run.
 */

// Axis token like  X12.34  B-2.20  Y0.40  (letter + signed decimal).
const TOKEN = /([XYB])(-?\d+(?:\.\d+)?)/g;
const B_OUT = /\bB(-?\d+(?:\.\d+)?)/;

/**
 * Auto-detect which axis is the laser sweep vs the belt feed.
 *
 * The scan (sweep) axis moves on nearly every engraving line; the feed axis
 * only steps between sweeps. Count, over engraving moves (`G1 ... S`), how often
 * each of Y/B is the only one of the two present. The dominant one is the sweep.
 *
 * @param {string[]} lines
 * @returns {{ scanAxis: 'Y'|'B', feedAxis: 'Y'|'B' }}
 */
function detectLayout(lines) {
    let yOnly = 0;
    let bOnly = 0;
    for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('G1 ') || !s.includes('S')) {
            continue;
        }
        const hasY = s.includes('Y');
        const hasB = s.includes('B');
        if (hasY && !hasB) {
            yOnly += 1;
        } else if (hasB && !hasY) {
            bOnly += 1;
        }
    }
    if (yOnly >= bOnly) {
        return { scanAxis: 'Y', feedAxis: 'B' };
    }
    return { scanAxis: 'B', feedAxis: 'Y' };
}

/**
 * Remap one G-code line: scanAxis -> X, feedAxis -> B, drop the unused seed axis.
 * Returns null for lines that should be dropped entirely (seed-only moves, park
 * moves, G92 resets).
 *
 * @param {string} line
 * @param {{ scanAxis: string, feedAxis: string }} layout
 * @returns {string|null}
 */
function transformLine(line, layout) {
    const { scanAxis, feedAxis } = layout;
    // The axis that is neither scan nor feed is the unused seed (usually X).
    const unusedAxis = ['X', 'Y', 'B'].find((a) => a !== scanAxis && a !== feedAxis);

    const stripped = line.trim();

    // Drop the G92 rotary-origin reset: its origin is meaningless once the axes
    // are repurposed for the belt.
    if (stripped.startsWith('G92')) {
        return null;
    }

    // Drop end-of-program park moves: a G0 carrying the feed axis is the
    // retract/park, not an engraving move.
    if (stripped.startsWith('G0 ') && new RegExp(`\\b${feedAxis}-?\\d`).test(stripped)) {
        return null;
    }

    if (!(stripped.startsWith('G0 ') || stripped.startsWith('G1 ')
        || stripped === 'G0' || stripped === 'G1')) {
        return line;
    }

    let out = line.replace(TOKEN, (match, axis, valStr) => {
        const val = parseFloat(valStr);
        if (axis === scanAxis) {
            return `X${val.toFixed(2)}`;
        }
        if (axis === feedAxis) {
            return `B${val.toFixed(2)}`;
        }
        if (axis === unusedAxis) {
            return ''; // drop the unused seed axis
        }
        return match;
    });

    // Collapse the doubled spaces left where a token was removed.
    out = out.replace(/[ \t]{2,}/g, ' ');

    // A line that has become a bare "G0" (its only axis was the dropped seed) is
    // a no-op; drop it.
    if (/^G0\s*$/.test(out.trim())) {
        return null;
    }
    return out;
}

/**
 * Negate + offset every B value so the belt feed starts at 0 and increases.
 *
 * The remapped B is centered on the rotary origin and the feed *decreases*
 * (e.g. +1057 -> -1057). For the belt we want it to start at 0 and run positive.
 * Negating turns the decreasing feed into an increasing one; subtracting the
 * resulting minimum shifts the start to 0. Net: 0 -> +span. Implemented as
 * `new = max(B) - B`.
 *
 * @param {string[]} lines
 * @returns {string[]}
 */
function normalizeBFromZero(lines) {
    const vals = [];
    for (const line of lines) {
        const s = line.trim();
        if (s.startsWith('G0 ') || s.startsWith('G1 ')) {
            const m = line.match(B_OUT);
            if (m) {
                vals.push(parseFloat(m[1]));
            }
        }
    }
    if (vals.length === 0) {
        return lines;
    }
    // Loop, not Math.max(...vals): a real job has 100k+ points and argument
    // spread overflows the call stack.
    let shift = vals[0];
    for (let i = 1; i < vals.length; i++) {
        if (vals[i] > shift) {
            shift = vals[i];
        }
    }

    return lines.map((line) => {
        const s = line.trim();
        if ((s.startsWith('G0 ') || s.startsWith('G1 ')) && line.includes('B')) {
            return line.replace(new RegExp(B_OUT, 'g'), (match, v) => `B${(shift - parseFloat(v)).toFixed(2)}`);
        }
        return line;
    });
}

/**
 * Min/max of the X and B axes across all G0/G1 motion lines, for rewriting the
 * header boundary fields to match the transformed motion.
 *
 * @param {string[]} lines
 * @returns {{ minX: number, maxX: number, minB: number, maxB: number }|null}
 */
function collectExtents(lines) {
    const xs = [];
    const bs = [];
    for (const line of lines) {
        const s = line.trim();
        if (!(s.startsWith('G0 ') || s.startsWith('G1 '))) {
            continue;
        }
        for (const m of line.matchAll(TOKEN)) {
            if (m[1] === 'X') {
                xs.push(parseFloat(m[2]));
            } else if (m[1] === 'B') {
                bs.push(parseFloat(m[2]));
            }
        }
    }
    if (xs.length === 0 && bs.length === 0) {
        return null;
    }
    // Loop-based min/max: Math.min(...arr) overflows the stack on large jobs.
    const minOf = (arr) => {
        let m = arr[0];
        for (let i = 1; i < arr.length; i++) { if (arr[i] < m) m = arr[i]; }
        return m;
    };
    const maxOf = (arr) => {
        let m = arr[0];
        for (let i = 1; i < arr.length; i++) { if (arr[i] > m) m = arr[i]; }
        return m;
    };
    return {
        minX: xs.length ? minOf(xs) : 0,
        maxX: xs.length ? maxOf(xs) : 0,
        minB: bs.length ? minOf(bs) : 0,
        maxB: bs.length ? maxOf(bs) : 0,
    };
}

/**
 * Transform an array of laser G-code lines for the belt rig.
 *
 * @param {string[]} gcodeLines  lines from GcodeGenerator.parseAsLaser
 * @param {object} [options]
 * @param {boolean} [options.bZero=true]  shift B to start at 0 and run positive
 * @returns {{ lines: string[], extents: object|null, layout: object }}
 *   lines   - the transformed G-code lines
 *   extents - { minX, maxX, minB, maxB } of the transformed motion (or null)
 *   layout  - { scanAxis, feedAxis } that was detected
 */
function transformBeltGcode(gcodeLines, options = {}) {
    const { bZero = true } = options;
    const layout = detectLayout(gcodeLines);

    let out = [];
    for (const line of gcodeLines) {
        const t = transformLine(line, layout);
        if (t === null) {
            continue;
        }
        out.push(t);
    }

    if (bZero) {
        out = normalizeBFromZero(out);
    }

    const extents = collectExtents(out);
    return { lines: out, extents, layout };
}

export {
    transformBeltGcode,
    detectLayout,
    transformLine,
    normalizeBFromZero,
    collectExtents,
};
