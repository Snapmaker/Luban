import { strict as assert } from 'assert';

import { inferExecutingLine, lineContext, parseSpindleProgram } from '../spindleProgram';

// The E4 spindle-load ladder as toolpaths.py writes it (abridged).
const E4 = `; E4_spindle_load - Spindle-load ladder
G21
G90
G54
G0 Z10
G0 X-44 Y70
M3 S18000
G4 P3000
; E4 C1 S18000 F200 baseline
G0 Y14
G0 Z-1
G1 Z-7 F400
G4 P4000
; E4 C1 S18000 F200 cut
G1 X44 F200
G4 P2000
G0 Z10
M3 S12000
G4 P3000
G0 X-44 Y26
G0 Z-1
G1 Z-7 F400
G4 P4000
G1 X44 F200
G4 P2000
G0 Z10
M5
G0 Z50`;

export const tests: Array<[string, () => void]> = [
    ['a comment after a dwell is not queued: the match stops at the sync (job b3e8f3dd0e34)', () => {
        const program = parseSpindleProgram([
            'G21', 'G90', 'G54', 'G0 X-40.5 Y11.2', 'G0 Z10', 'M3 S8000', 'G4 P20000', '; plunge in air to the new plane',
            'G1 Z-6.0 F200', '; pass 1', 'G1 X40.5 Y11.2 F500',
        ].join('\n'));
        const atEnd = program.lineCount;
        let hit = inferExecutingLine(program, { x: -40.5, y: 11.2, z: 10 }, atEnd, null);
        assert.equal(hit?.line, 7, 'the dwell, not the comment after it');
        assert.equal(hit?.match, 'endpoint');
        hit = inferExecutingLine(program, { x: -40.5, y: 11.2, z: 10 }, atEnd, 7);
        assert.equal(hit?.line, 7, 'and it stays there while the position is frozen');
        // Once the plunge is queued the reported position is ITS end.
        hit = inferExecutingLine(program, { x: -40.5, y: 11.2, z: -6 }, atEnd, 7);
        assert.equal(hit?.line, 10, 'the comment after the plunge: no sync in that run, so it is a live queue');
        assert.equal(hit?.match, 'endpoint');
    }],

    ['commanded S follows the M3 S words and M5 clears it', () => {
        const program = parseSpindleProgram(E4);
        const lines = E4.split('\n');
        const m5 = lines.indexOf('M5') + 1;
        assert.equal(program.lineCount, lines.length);
        assert.equal(program.epochs.length, 2);
        assert.deepEqual(program.epochs[0], { index: 0, line: lines.indexOf('M3 S18000') + 1, s: 18000 });
        assert.deepEqual(program.epochs[1], { index: 1, line: lines.indexOf('M3 S12000') + 1, s: 12000 });
        assert.equal(lineContext(program, 6)?.s, null, 'before M3');
        assert.equal(lineContext(program, 7)?.s, 18000);
        assert.equal(lineContext(program, 15)?.s, 18000);
        assert.equal(lineContext(program, lines.indexOf('M3 S12000') + 1)?.s, 12000);
        assert.equal(lineContext(program, m5 - 1)?.s, 12000);
        assert.equal(lineContext(program, m5)?.s, null, 'M5');
        assert.equal(lineContext(program, m5)?.epoch, -1);
        assert.equal(lineContext(program, m5 + 1)?.s, null);
    }],

    ['line kinds: feed moves load the spindle, rapids and dwells do not', () => {
        const program = parseSpindleProgram(E4);
        const kinds = program.lines.map((line) => line.kind);
        assert.equal(kinds[0], 'other', 'comment');
        assert.equal(kinds[4], 'rapid', 'G0 Z10');
        assert.equal(kinds[6], 'spindle', 'M3');
        assert.equal(kinds[7], 'dwell', 'G4');
        assert.equal(kinds[11], 'feed', 'G1 Z-7 plunge');
        assert.equal(kinds[14], 'feed', 'G1 X44 cut');
        assert.equal(kinds[E4.split('\n').indexOf('M5')], 'spindle', 'M5');
    }],

    ['feed in effect is carried forward from the last F word', () => {
        const program = parseSpindleProgram(E4);
        assert.equal(lineContext(program, 11)?.feed, null, 'no F yet');
        assert.equal(lineContext(program, 12)?.feed, 400);
        assert.equal(lineContext(program, 15)?.feed, 200);
        assert.equal(lineContext(program, 17)?.feed, 200, 'carried through the rapid');
    }],

    ['modal motion: a bare axis word after G1 is a feed move, after G0 a rapid', () => {
        const program = parseSpindleProgram('M3 S10000\nG1 X10 F300\nX20\nY5\nG0 X0\nY0\n');
        // The trailing newline is a (blank) line too - the controller counts it.
        assert.deepEqual(program.lines.map((line) => line.kind), ['spindle', 'feed', 'feed', 'feed', 'rapid', 'rapid', 'other']);
    }],

    ['a speed change while running, or a bare S word, starts a new epoch; a repeated M3 at the same S does not', () => {
        const program = parseSpindleProgram('M3 S8000\nG4 P1000\nM3 S8000\nS9000\nM3 S9000\nM4 S1000\n');
        assert.deepEqual(program.epochs.map((e) => [e.line, e.s]), [[1, 8000], [4, 9000], [6, 1000]]);
        assert.equal(program.lines[2].epoch, 0);
        assert.equal(program.lines[3].epoch, 1);
    }],

    ['comments in parentheses and after semicolons never command anything', () => {
        const program = parseSpindleProgram('(M3 S5000)\nG0 X1 ; M3 S6000\nM3 S7000 (spindle on)\n');
        assert.equal(program.epochs.length, 1);
        assert.equal(program.epochs[0].s, 7000);
        assert.equal(program.lines[1].kind, 'rapid');
    }],

    ['motion lines carry their segment in absolute coordinates, modal axes carried forward', () => {
        const program = parseSpindleProgram('G90\nG0 X-40.5 Y11.2\nG0 Z10\nG1 Z-1.7 F200\nG1 X40.5 F500\nG1 Y15.4\nG91\nG1 X-1\n');
        const seg = (line: number) => program.lines[line - 1].motion;
        assert.deepEqual(seg(2), { from: { x: NaN, y: NaN, z: NaN }, to: { x: -40.5, y: 11.2, z: NaN } });
        assert.deepEqual(seg(3)?.to, { x: -40.5, y: 11.2, z: 10 });
        assert.deepEqual(seg(5), { from: { x: -40.5, y: 11.2, z: -1.7 }, to: { x: 40.5, y: 11.2, z: -1.7 } });
        assert.deepEqual(seg(6)?.to, { x: 40.5, y: 15.4, z: -1.7 });
        assert.deepEqual(seg(8)?.to, { x: 39.5, y: 15.4, z: -1.7 }, 'G91 adds');
        assert.equal(program.lines[0].motion, undefined);
    }],

    ['the executing line comes from the position, bounded by the parser line, never backwards', () => {
        // The skim: plunge, then a pass along +X at Y11.2, a step to Y15.4, a pass back.
        const program = parseSpindleProgram([
            'G90', 'G54', 'G0 X-40.5 Y11.2', 'G0 Z10', 'M3 S8000', 'G4 P3000', 'G1 Z-1.7 F200',
            '; pass 1', 'G1 X40.5 Y11.2 F500', 'G1 Y15.4 F500', '; pass 2', 'G1 X-40.5 Y15.4 F500', 'G0 Z10', 'M5',
        ].join('\n'));
        const parserAtEnd = program.lineCount; // the controller has read everything
        // Mid pass 1.
        let hit = inferExecutingLine(program, { x: 0, y: 11.2, z: -1.7 }, parserAtEnd, null);
        assert.equal(hit?.line, 9);
        assert.equal(hit?.match, 'segment');
        assert.equal(hit?.context.kind, 'feed');
        assert.equal(hit?.context.s, 8000);
        // Mid pass 2 (same X range, other Y): the later line, not pass 1.
        hit = inferExecutingLine(program, { x: 10, y: 15.4, z: -1.7 }, parserAtEnd, 9);
        assert.equal(hit?.line, 12);
        // Sitting at the end of the plunge while the dwell lines were read: the M3/G4 context, not the plunge.
        hit = inferExecutingLine(program, { x: -40.5, y: 11.2, z: 10 }, parserAtEnd, null);
        assert.equal(hit?.line, 6, 'advanced to the dwell after M3');
        assert.equal(hit?.match, 'endpoint');
        assert.equal(hit?.context.kind, 'dwell');
        // Reported again at the same point with the dwell as the last line: still the dwell,
        // not the plunge that starts there (the queue cannot pass a sync until it executes).
        hit = inferExecutingLine(program, { x: -40.5, y: 11.2, z: 10 }, parserAtEnd, 6);
        assert.equal(hit?.line, 6, 'held at the sync');
        assert.equal(hit?.match, 'endpoint');
        assert.equal(hit?.context.s, 8000);
        // The same position while the parser had only read up to line 4: the rapid's end, spindle still off.
        hit = inferExecutingLine(program, { x: -40.5, y: 11.2, z: 10 }, 4, null);
        assert.equal(hit?.line, 4);
        assert.equal(hit?.context.s, null);
        // After M5 was READ but the head is still on pass 2: the cut, not the end.
        hit = inferExecutingLine(program, { x: -20, y: 15.4, z: -1.7 }, parserAtEnd, 9);
        assert.equal(hit?.line, 12);
        assert.equal(hit?.context.s, 8000);
        // Off the path (between reports, or the approach from the park): held at the last line, flagged.
        hit = inferExecutingLine(program, { x: 100, y: 200, z: 116 }, parserAtEnd, 12);
        assert.equal(hit?.match, 'unmatched');
        assert.equal(hit?.line, 12);
        assert.equal(inferExecutingLine(program, { x: 100, y: 200, z: 116 }, parserAtEnd, null), null);
        // Execution never goes backwards: at (0, 11.2) with pass 2 already seen, no candidate matches.
        hit = inferExecutingLine(program, { x: 0, y: 11.2, z: -1.7 }, parserAtEnd, 12);
        assert.equal(hit?.match, 'unmatched');
    }],

    ['a raster repeated at three depths resolves by Z', () => {
        const lines = ['G90', 'M3 S8000'];
        for (const z of [-1, -2, -3]) {
            lines.push('G0 X-40 Y10', `G1 Z${z} F200`, 'G1 X40 F500', 'G1 Y14', 'G1 X-40', 'G0 Z5');
        }
        lines.push('M5');
        const program = parseSpindleProgram(lines.join('\n'));
        const hit = inferExecutingLine(program, { x: 5, y: 10, z: -2 }, program.lineCount, null);
        assert.equal(hit?.line, 11, 'level 2 pass, not level 1 or 3');
        assert.equal(hit?.context.s, 8000);
    }],

    ['lineContext rejects numbers outside the file', () => {
        const program = parseSpindleProgram('G0 X1');
        assert.equal(lineContext(program, 0), null);
        assert.equal(lineContext(program, 2), null);
        assert.equal(lineContext(program, NaN), null);
        assert.equal(lineContext(program, 1)?.kind, 'rapid');
    }],
];
