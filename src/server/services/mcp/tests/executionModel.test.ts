import { strict as assert } from 'assert';

import { ExecutionEstimator, lineDurationsMs } from '../executionModel';
import { parseSpindleProgram } from '../spindleProgram';

// A raster like the levelling skim: 81 mm passes at F500 (9.72 s each) with
// 4 mm steps (0.48 s), preceded by a spindle dwell and a plunge.
function raster(passes: number): { text: string; program: ReturnType<typeof parseSpindleProgram>; passLine: (k: number) => number } {
    const lines = ['G90', 'G54', 'G0 X-40.5 Y11.2', 'G0 Z10', 'M3 S8000', 'G4 P3000', 'G1 Z-1 F200'];
    const passLines: number[] = [];
    for (let k = 0; k < passes; k++) {
        const y = 11.2 + 4 * k;
        passLines.push(lines.length + 1);
        lines.push(`G1 X${k % 2 === 0 ? 40.5 : -40.5} Y${y} F500`);
        if (k + 1 < passes) {
            lines.push(`G1 Y${y + 4} F500`);
        }
    }
    lines.push('G0 Z5', 'M5');
    const text = lines.join('\n');
    return { text, program: parseSpindleProgram(text), passLine: (k) => passLines[k] };
}

export const tests: Array<[string, () => void]> = [
    ['the modal feed survives between files: leading G0s before any F run at the previous job\'s F', () => {
        // Job b3e8f3dd0e34: park at work (-40.5, 128.2, 116), the file's first two lines are G0s
        // with no F, the previous job ended on F500. The 117 mm traverse took ~14 s, not 2.3 s.
        const { text, program } = raster(3);
        const start = { x: -40.5, y: 128.2, z: 116 };
        const rapid = lineDurationsMs(program, text, start);
        const modal = lineDurationsMs(program, text, start, 500);
        assert.equal(Math.round(rapid[2]), 2340, 'a true rapid: 117 mm at 3000 mm/min');
        assert.equal(Math.round(modal[2]), 14040, 'the same G0 at the inherited F500');
        assert.equal(Math.round(modal[3]), 12720, 'the 106 mm Z descent at F500 too');
        assert.equal(Math.round(modal[7]), 9720, 'later lines with their own F are unchanged');
        const est = new ExecutionEstimator(program, text, 16);
        est.setInitialFeed(500);
        est.setStartPosition(start);
        // The matcher reports the dwell (line 6) as soon as the two G0s are queued: a sync, frozen.
        est.update(0, null);
        let e = est.update(500, 6);
        assert.equal(e.line, 3, 'on the XY traverse');
        e = est.update(10000, 6);
        assert.equal(e.line, 3, 'still on the XY traverse at 10 s');
        assert.equal(program.lines[e.line - 1].s, null, 'no spindle context');
        e = est.update(20000, 6);
        assert.equal(e.line, 4, 'on the Z descent at 20 s');
        e = est.update(28000, 6);
        assert.equal(e.line, 6, 'the dwell after M3 from ~26.8 s');
        e = est.update(60000, 6);
        assert.equal(e.line, 6, 'held at the frozen sync however late the clock runs');
    }],

    ['a G0 after an F word travels at that feed; the estimate never runs more than a block past the queue-implied head', () => {
        const text = ['G90', 'M3 S8000', 'G0 X0 Y0', 'G1 X81 F500', 'G0 X0', 'G1 X81', 'G0 X0', 'G1 X81', 'G0 X0'].join('\n');
        const program = parseSpindleProgram(text);
        const ms = lineDurationsMs(program, text, { x: 0, y: 0, z: 0 });
        assert.equal(Math.round(ms[4]), 9720, 'the G0 return runs at the modal F500');
        assert.equal(Math.round(ms[2]), 0, 'a G0 before any F is a true rapid from the start point (0 mm here)');
        // A live queue 2 blocks ahead: with lead 2 the head is on block(queued) - 2 and may be at most one block further.
        const est = new ExecutionEstimator(program, text, 2);
        est.setStartPosition({ x: 0, y: 0, z: 0 });
        est.update(0, null);
        est.update(1000, 6);
        const e = est.update(60000, 6); // the clock says everything is long done
        // Queue on block 4 (line 6) with lead 2: the head is on block 3 (line 5), allowed one block past it.
        assert.ok(e.line <= 6, `bounded to one block past the queue-implied head: line ${e.line}`);
        assert.equal(e.mode, 'queue-upper');
    }],

    ['line durations: feed moves by length / F, rapids at the rapid feed, dwells by P', () => {
        const { text, program } = raster(2);
        const ms = lineDurationsMs(program, text);
        assert.equal(ms[0], 0, 'G90');
        assert.equal(ms[2], 0, 'first rapid from an unknown position has no length');
        assert.equal(ms[3], 0, 'G0 Z10 from an unknown Z has no length either');
        assert.equal(ms[5], 3000, 'G4 P3000');
        assert.equal(Math.round(ms[6]), 3300, 'plunge 11 mm at F200');
        assert.equal(Math.round(ms[7]), 9720, '81 mm pass at F500');
        assert.equal(Math.round(ms[8]), 480, '4 mm step');
    }],

    ['the traverse from the park takes real time: no spindle context before M3 actually runs', () => {
        const { text, program } = raster(3);
        const est = new ExecutionEstimator(program, text, 16);
        // Head parked at work (-100, 100, 116) when the job starts.
        est.setStartPosition({ x: -100, y: 100, z: 116 });
        const ms = lineDurationsMs(program, text, { x: -100, y: 100, z: 116 });
        assert.equal(Math.round(ms[2]), 2138, 'G0 X-40.5 Y11.2 from (-100, 100): 106.9 mm at 3000 mm/min');
        assert.equal(Math.round(ms[3]), 2120, 'G0 Z10 from Z116: 106 mm');
        est.update(0, null);
        let e = est.update(1000, null);
        assert.equal(e.line, 3, 'still on the XY traverse');
        assert.equal(program.lines[e.line - 1].s, null, 'spindle off');
        e = est.update(3000, null);
        assert.equal(e.line, 4, 'on the Z drop');
        assert.equal(program.lines[e.line - 1].s, null);
        e = est.update(4500, null);
        assert.equal(e.line, 6, 'the dwell after M3');
        assert.equal(program.lines[e.line - 1].s, 8000);
    }],

    ['the queue leads by the buffer depth; the estimate follows the file timing behind it', () => {
        const { text, program, passLine } = raster(30);
        const est = new ExecutionEstimator(program, text, 16);
        // t = 0: nothing queued yet.
        let e = est.update(0, null);
        assert.ok(e.line <= 6, `at t = 0 the zero-length setup lines are done and the dwell is in progress: line ${e.line}`);
        // Dwell over at ~3.5 s, plunge to ~6.8 s; the planner fills 16 blocks
        // at once: the reported position is pass 8's end.
        e = est.update(7000, passLine(7));
        assert.ok(e.line >= 7 && e.line <= passLine(0), `during the plunge / start of pass 1: line ${e.line}`);
        // 30 s later (t = 37 s): pass 4 is executing (3.1 passes since 6.3 s); the queue reports pass 10.
        e = est.update(37000, passLine(10));
        assert.equal(e.line, passLine(3), `pass 4 at 37 s: line ${e.line}`);
        assert.equal(e.mode, 'time');
        assert.ok(e.leadBlocks !== null && e.leadBlocks >= 13 && e.leadBlocks <= 16, `lead ${e.leadBlocks}`);
        // Never past the queue-implied head: a wildly late clock is capped a block past it, not at the queue.
        e = est.update(400000, passLine(12));
        assert.ok(e.line < passLine(12) && e.line >= passLine(4), `capped near the head: line ${e.line}`);
        assert.equal(e.mode, 'queue-upper');
    }],

    ['never more than the buffer behind the queue, and never backwards', () => {
        const { text, program, passLine } = raster(30);
        const est = new ExecutionEstimator(program, text, 16);
        est.update(0, null);
        // The clock says pass 1 but the queue is already at pass 20: the head must be within 16 blocks.
        const e = est.update(8000, passLine(20));
        assert.equal(e.mode, 'queue-lower');
        assert.ok(e.leadBlocks !== null && e.leadBlocks <= 16, `lead ${e.leadBlocks}`);
        const later = est.update(8500, passLine(20));
        assert.ok(later.line >= e.line, 'monotonic');
    }],

    ['the end of the file is not a sync: the head keeps running its buffered passes after the queue reads M5', () => {
        const { text, program, passLine } = raster(30);
        const est = new ExecutionEstimator(program, text, 16);
        est.update(0, null);
        // Steady state: the queue 8 passes ahead of the cutter (a pass is 10.2 s).
        for (let t = 7000; t <= 215000; t += 5000) {
            const q = Math.min(29, Math.floor((t - 6300) / 10200) + 7);
            est.update(t, passLine(q));
        }
        // The queue reaches the last pass at ~220 s; the matcher then sits on
        // the file's trailing M5 (a non-motion line) while the head still has
        // eight passes (~80 s) to run.
        const last = program.lines.length; // M5
        est.update(220000, passLine(29));
        est.update(226000, last);
        const mid = est.update(260000, last);
        assert.ok(mid.line >= passLine(22) && mid.line < passLine(29), `on a buffered pass at 260 s: line ${mid.line}`);
        assert.equal(mid.mode, 'time');
        const done = est.update(400000, last);
        assert.equal(done.line, last, 'eventually at the end');
    }],

    ['a dwell is a planner sync: the frozen reported position resuming re-anchors the clock', () => {
        // Two cuts separated by a 4 s dwell (E4 style).
        const text = ['G90', 'M3 S8000', 'G0 X0 Y0', 'G1 X50 F500', 'G4 P4000', 'G1 X0 F500', 'G4 P4000', 'M5'].join('\n');
        const program = parseSpindleProgram(text);
        const est = new ExecutionEstimator(program, text, 16);
        est.update(0, null);
        // The queue reaches the first cut's end at once; the position matcher
        // reports the dwell after it (endpoint mode) and freezes there.
        est.update(500, 5);
        est.update(3000, 5);
        est.update(9000, 5);
        // At 10.5 s the reported position moves on to line 6: the dwell (line 5) has just ended.
        const e = est.update(10500, 6);
        assert.equal(e.mode, 'anchor');
        assert.equal(e.line, 6, 'the dwell just finished: the second cut is starting');
        // 3 s later the second cut (6 s long) is executing.
        const f = est.update(13500, 6);
        assert.equal(f.line, 6);
        assert.equal(f.mode, 'time');
    }],
];
