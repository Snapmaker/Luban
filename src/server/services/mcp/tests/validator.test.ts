import { strict as assert } from 'assert';

import {
    FRAME_REFUSAL_NO_RESTORE,
    FRAME_REFUSAL_UNDECLARED,
    FrameResolutionContext,
    MAX_TRANSPORT_MOTION_LINES,
    RELATIVE_TRANSPORT_NOTE,
    TRANSPORT_REFUSAL,
    isPureTransport,
    isRelativeOnlyTransport,
    resolveJobFrame,
    suggestGcode,
    validateGcode,
} from '../validator';

const A350 = { machineZMax: 330 };

function ctx(over: Partial<FrameResolutionContext> = {}): FrameResolutionContext {
    return { frameArgument: null, originOffsetZ: -328, offsetReliable: true, ...A350, ...over };
}

// The job staged on 2026-09-12: absolute Z0 with no frame anywhere.
const TRANSIT_2026_09_12 = 'G90\nG0 Z0 F1000\nG0 X239 Y-17 F3000\n';
// What move_z emits for a machine-frame step.
const MOVE_Z_MACHINE = 'G90\nG53;\nG1 Z300.000 F300;\nG54;';
// What Luban's own CNC export looks like: G90, moves, no workspace select.
const LUBAN_EXPORT = ';Header Start\nG90\nG0 Z10 F1500\nG1 X10 Y10 F600\nG1 Z-1 F300\nG0 Z10\n';

export const tests: Array<[string, () => void]> = [
    ['G53 on its own line before the first move declares MACHINE', () => {
        const r = resolveJobFrame(validateGcode(MOVE_Z_MACHINE), ctx());
        assert.equal(r.refusal, null);
        assert.equal(r.report.frame.declared, 'machine');
        assert.equal(r.report.frame.source, 'gcode');
        assert.equal(r.report.frame.line, 2);
        assert.equal(r.report.frame.firstMotionLine, 3);
        assert.equal(r.report.frame.mixed, false, 'a trailing G54 with no motion after it is not mixed');
        assert.deepEqual(r.report.machineZExtents, { min: 300, max: 300 });
    }],

    ['a G54-only file resolves machine Z against the live offset and names G54 as the assumption start verifies', () => {
        const r = resolveJobFrame(validateGcode('G90\nG54\nG0 Z10\nG1 Z-2\n'), ctx({ originOffsetZ: -200, verifiesG54AtStart: true }));
        assert.equal(r.refusal, null);
        assert.equal(r.report.frame.declared, 'work');
        assert.equal(r.report.frame.source, 'gcode');
        assert.deepEqual(r.report.frame.workspaceSelects, ['G54']);
        assert.deepEqual(r.report.machineZExtents, { min: 198, max: 210 });
        assert.equal(r.report.originOffsetZAtStaging, -200);
        assert.equal(r.report.machineZResolvedFor, 'G54');
        assert(r.report.warnings.some((w) => w.includes('refuses to start unless G54 reports this offset')));
        assert(!r.report.warnings.some((w) => w.includes('UNRESOLVED')));
    }],

    ['a G54-only file with an unreliable offset stays unresolved and carries no assumption', () => {
        const r = resolveJobFrame(validateGcode('G90\nG54\nG0 Z10\n'), ctx({ offsetReliable: false, verifiesG54AtStart: true }));
        assert.equal(r.report.machineZExtents, null);
        assert.equal(r.report.machineZResolvedFor, null);
    }],

    ['G54 selected only AFTER a move (frame from the argument) cannot be resolved by one offset', () => {
        const r = resolveJobFrame(validateGcode('G90\nG0 Z10\nG54\nG0 Z5\n'), ctx({ frameArgument: 'work', originOffsetZ: -200, verifiesG54AtStart: true }));
        assert.equal(r.report.frame.source, 'argument');
        assert.equal(r.report.machineZExtents, null);
        assert.equal(r.report.machineZResolvedFor, null);
        assert(r.report.warnings.some((w) => w.includes('UNRESOLVED')));
    }],

    ['G54 with a G92 origin rewrite or any other workspace stays unresolved', () => {
        for (const code of ['G90\nG54\nG92 Z0\nG0 Z10\n', 'G90\nG54\nG0 Z10\nG55\nG0 Z5\n', 'G90\nG55\nG0 Z10\n']) {
            const r = resolveJobFrame(validateGcode(code), ctx({ originOffsetZ: -200, verifiesG54AtStart: true }));
            assert.equal(r.report.machineZExtents, null, code);
            assert.equal(r.report.machineZResolvedFor, null, code);
        }
    }],

    ['a G54 envelope whose start path does not verify G54 (direct / procedure) stays unresolved', () => {
        const r = resolveJobFrame(validateGcode('G90\nG54;\nG1 Z10 F300'), ctx({ originOffsetZ: -200 }));
        assert.equal(r.report.machineZExtents, null);
        assert.equal(r.report.machineZResolvedFor, null);
        assert(r.report.warnings.some((w) => w.includes('UNRESOLVED')));
    }],

    ['a Luban export resolves without a workspace assumption: it runs in the active workspace', () => {
        const r = resolveJobFrame(validateGcode(LUBAN_EXPORT), ctx({ frameArgument: 'work', originOffsetZ: -150 }));
        assert.equal(r.report.machineZResolvedFor, null);
    }],

    ['a Luban export (no workspace select) is accepted with frame:"work" and left byte-identical', () => {
        const r = resolveJobFrame(validateGcode(LUBAN_EXPORT), ctx({ frameArgument: 'work', originOffsetZ: -150 }));
        assert.equal(r.refusal, null);
        assert.equal(r.report.frame.declared, 'work');
        assert.equal(r.report.frame.source, 'argument');
        assert.equal(r.report.frame.line, null);
        assert.deepEqual(r.report.machineZExtents, { min: 149, max: 160 });
    }],

    ['undeclared with no argument is REFUSED', () => {
        const r = resolveJobFrame(validateGcode(LUBAN_EXPORT), ctx());
        assert.equal(r.refusal, FRAME_REFUSAL_UNDECLARED);
        assert.equal(r.report.frame.declared, null);
    }],

    ['the 2026-09-12 transit job is refused as undeclared', () => {
        const r = resolveJobFrame(validateGcode(TRANSIT_2026_09_12), ctx());
        assert.equal(r.refusal, FRAME_REFUSAL_UNDECLARED);
        assert.equal(r.report.frame.firstMotionLine, 2);
    }],

    ['the 2026-09-12 transit job with frame:"work" names where work Z0 lands in machine Z', () => {
        const r = resolveJobFrame(validateGcode(TRANSIT_2026_09_12), ctx({ frameArgument: 'work', originOffsetZ: -328 }));
        assert.equal(r.refusal, null);
        assert.deepEqual(r.report.machineZExtents, { min: 328, max: 328 });
        assert.ok(r.report.warnings.some((w) => w.includes('work Z0 is machine Z 328.000')), r.report.warnings.join('\n'));
    }],

    ['frame:"machine" without a literal G53 is refused', () => {
        const r = resolveJobFrame(validateGcode(LUBAN_EXPORT), ctx({ frameArgument: 'machine' }));
        assert.ok(r.refusal && r.refusal.includes('no G53 before its first move'), String(r.refusal));
    }],

    ['a declaration that contradicts the argument is refused both ways', () => {
        const a = resolveJobFrame(validateGcode(MOVE_Z_MACHINE), ctx({ frameArgument: 'work' }));
        assert.ok(a.refusal && a.refusal.includes('declares G53'), String(a.refusal));
        const b = resolveJobFrame(validateGcode('G90\nG54\nG0 Z10\n'), ctx({ frameArgument: 'machine' }));
        assert.ok(b.refusal && b.refusal.includes('selects a work workspace'), String(b.refusal));
    }],

    ['inline "G53 G0 ..." is not a declaration on this controller and is flagged', () => {
        const report = validateGcode('G90\nG53 G0 X10 Y10\nG0 Z5\n');
        assert.deepEqual(report.frame.inlineG53Lines, [2]);
        assert.equal(report.frame.declared, null);
        assert.equal(report.motionLineCount, 2, 'the inline line still counts as motion');
        assert.ok(report.warnings.some((w) => w.includes('does NOT honour a one-shot G53')));
        assert.equal(resolveJobFrame(report, ctx()).refusal, FRAME_REFUSAL_UNDECLARED);
    }],

    ['motion under both frames is reported as mixed', () => {
        const report = validateGcode('G90\nG53\nG1 Z300\nG54\nG1 Z10\n');
        assert.equal(report.frame.declared, 'machine');
        assert.equal(report.frame.mixed, true);
        assert.ok(report.warnings.some((w) => w.includes('BOTH frames')));
    }],

    ['G92 is flagged as a work-origin rewrite', () => {
        const report = validateGcode('G90\nG53\nG92 Z0\nG1 Z10\n');
        assert.equal(report.setsWorkOrigin, true);
        assert.ok(report.warnings.some((w) => w.includes('REWRITES the work origin')));
    }],

    ['machine-frame Z outside the travel is warned, not refused', () => {
        const r = resolveJobFrame(validateGcode('G90\nG53\nG1 Z400\nG54\n'), ctx());
        assert.equal(r.refusal, null);
        assert.ok(r.report.warnings.some((w) => w.includes('outside the 0 .. 330 travel')));
    }],

    ['a work-frame job with an unreliable offset gets unresolved machine extents and a warning', () => {
        const r = resolveJobFrame(validateGcode('G90\nG1 Z10\n'), ctx({ frameArgument: 'work', offsetReliable: false }));
        assert.equal(r.refusal, null);
        assert.equal(r.report.machineZExtents, null);
        assert.ok(r.report.warnings.some((w) => w.includes('not reliable right now')));
    }],

    ['a file with no motion needs no frame', () => {
        const r = resolveJobFrame(validateGcode('; comment only\nG90\nM5\n'), ctx());
        assert.equal(r.refusal, null);
        assert.equal(r.report.frame.declared, null);
        assert.equal(r.report.frame.firstMotionLine, null);
    }],

    ['existing extents/feed/spindle facts still come out (regression)', () => {
        const report = validateGcode('G90\nG53\nM3 S8000\nG1 X10 Y20 Z-3 F600\nG1 X30\nM5\n');
        assert.deepEqual(report.extents.x, { min: 10, max: 30 });
        assert.deepEqual(report.extents.z, { min: -3, max: -3 });
        assert.deepEqual(report.feedRates, { min: 600, max: 600 });
        assert.equal(report.spindle.onCommands, 1);
        assert.equal(report.spindle.maxS, 8000);
        assert.equal(report.minZWithSpindleOn, -3);
        assert.equal(report.motionLineCount, 2);
    }],

    // A5: a machine-frame job must hand the frame back. Live 2026-09-19 a
    // hand-authored centre move ended in G53, the controller stayed in the
    // machine workspace, and every later beat was rejected until a re-home.
    ['a machine-frame job that never selects a work workspace again is refused', () => {
        const r = resolveJobFrame(validateGcode('G90\nG53\nG0 X160 Y175\n'), ctx());
        assert.equal(r.refusal, FRAME_REFUSAL_NO_RESTORE);
        assert.ok(/G54/.test(r.refusal as string), 'the refusal states the epilogue it wants');
        assert.equal(r.report.frame.endsInFrame, 'machine');
    }],

    ['the same job with a trailing G54 stages cleanly', () => {
        const r = resolveJobFrame(validateGcode('G90\nG53;\nG0 X160 Y175;\nG54;\n'), ctx());
        assert.equal(r.refusal, null);
        assert.equal(r.report.frame.declared, 'machine');
        assert.equal(r.report.frame.endsInFrame, 'work');
    }],

    ['every MCP emitter already ends in the work frame (regression)', () => {
        assert.equal(validateGcode(MOVE_Z_MACHINE).frame.endsInFrame, 'work');
    }],

    ['a work-frame job is unaffected - it never left the work workspace', () => {
        const r = resolveJobFrame(validateGcode('G90\nG54\nG0 X10 Y10\n'), ctx());
        assert.equal(r.refusal, null);
        assert.equal(r.report.frame.endsInFrame, 'work');
    }],

    ['a no-motion file is never asked for an epilogue', () => {
        const r = resolveJobFrame(validateGcode('G90\nG53;\n'), ctx());
        assert.equal(r.refusal, null, 'nothing ran, so nothing needs handing back');
    }],

    ['mixed frames: ending in work stages, ending in machine does not', () => {
        const ok = resolveJobFrame(validateGcode('G90\nG53;\nG0 X160;\nG54;\nG0 X5;\n'), ctx());
        assert.equal(ok.refusal, null);
        const bad = resolveJobFrame(validateGcode('G90\nG54;\nG0 X5;\nG53;\nG0 X160;\n'), ctx());
        assert.equal(bad.report.frame.endsInFrame, 'machine');
        assert.equal(bad.refusal, FRAME_REFUSAL_NO_RESTORE);
    }],

    // A6: a refusal whose fix is mechanical hands back the corrected program.
    ['the inline-G53 refusal comes with G53 on its own line - and the draft re-validates clean', () => {
        const gcode = 'G90\nG53 G0 X160 Y175\n';
        const suggestion = suggestGcode(gcode, validateGcode(gcode));
        assert.ok(suggestion, 'a suggestion is offered');
        const fixed = (suggestion as NonNullable<typeof suggestion>).gcode;
        assert.equal(fixed, 'G90\nG53;\nG0 X160 Y175\nG54;');
        const after = validateGcode(fixed);
        assert.deepEqual(after.frame.inlineG53Lines, []);
        assert.equal(after.frame.declared, 'machine');
        assert.equal(after.frame.endsInFrame, 'work');
        assert.equal(resolveJobFrame(after, ctx()).refusal, null, 'the draft would stage');
    }],

    ['a file that moves before stating its distance mode gets G90 first', () => {
        const gcode = 'G53;\nG0 X160 Y175;\nG54;';
        const suggestion = suggestGcode(gcode, validateGcode(gcode));
        assert.ok(suggestion);
        const fixed = (suggestion as NonNullable<typeof suggestion>).gcode;
        assert.ok(fixed.startsWith('G90\n'), fixed);
        assert.equal(validateGcode(fixed).assumesDistanceMode, false);
        assert.ok((suggestion as NonNullable<typeof suggestion>).changes.some((c) => /G90 added first/.test(c)));
    }],

    ['a file that ends in the machine frame gets G54 last', () => {
        const gcode = 'G90\nG53;\nG0 X160 Y175;\n';
        const suggestion = suggestGcode(gcode, validateGcode(gcode));
        assert.ok(suggestion);
        const fixed = (suggestion as NonNullable<typeof suggestion>).gcode;
        assert.equal(fixed, 'G90\nG53;\nG0 X160 Y175;\nG54;');
        assert.equal(validateGcode(fixed).frame.endsInFrame, 'work');
    }],

    ['the live 2026-09-19 centre move, corrected in one pass', () => {
        // What the agent actually submitted, twice, before getting it right.
        const gcode = 'G53 G0 X160 Y175 F3000\n';
        const suggestion = suggestGcode(gcode, validateGcode(gcode));
        assert.ok(suggestion);
        const fixed = (suggestion as NonNullable<typeof suggestion>).gcode;
        assert.equal(fixed, 'G90\nG53;\nG0 X160 Y175 F3000\nG54;');
        assert.equal(resolveJobFrame(validateGcode(fixed), ctx()).refusal, null);
        assert.equal((suggestion as NonNullable<typeof suggestion>).changes.length, 3);
    }],

    ['a clean file gets no suggestion, and nothing is invented', () => {
        assert.equal(suggestGcode(MOVE_Z_MACHINE, validateGcode(MOVE_Z_MACHINE)), null);
        assert.equal(suggestGcode(LUBAN_EXPORT, validateGcode(LUBAN_EXPORT)), null,
            'an undeclared file needs a DECISION about its frame - no draft is offered');
    }],

    // A7: transport has tools. A hand-written transit is the path that
    // produced the undeclared 2026-09-12 job and the G53-stranded controller
    // of 2026-09-19.
    ['the hand-written transit job of 2026-09-19 is pure transport', () => {
        assert.equal(isPureTransport(validateGcode('G90\nG53;\nG0 X160 Y175;\nG54;')), true);
        assert.equal(isPureTransport(validateGcode(MOVE_Z_MACHINE)), true, 'what move_z itself emits');
    }],

    ['issue #240: the hand-written fast-then-slow Z approach is pure transport, and the refusal names the move_z form', () => {
        // The exact file the agent wrote on 2026-10-17: Z only, three rapids, a dwell, no spindle.
        const approach = ['G21', 'G90', 'G53', 'G0 Z191.456 F400', 'G1 Z181.456 F60', 'G4 S60', 'G0 Z328 F400'].join('\n');
        assert.equal(isPureTransport(validateGcode(approach)), true);
        assert.ok(TRANSPORT_REFUSAL.includes('PER-STEP feeds'), TRANSPORT_REFUSAL);
        assert.ok(TRANSPORT_REFUSAL.includes('z_targets: [{z, feed_rate: 400}, {z, feed_rate: 60}]'), TRANSPORT_REFUSAL);
    }],

    ['a toolpath is never transport, even between its cuts', () => {
        assert.equal(isPureTransport(validateGcode(LUBAN_EXPORT)), false, 'a slicer export moves in XY and Z');
        assert.equal(isPureTransport(validateGcode(TRANSIT_2026_09_12)), false,
            'XY and Z in one file is not what traverse_xy or move_z emit - it is refused for its frame instead');
        assert.equal(isPureTransport(validateGcode('G90\nG54\nM3 S8000\nG1 X10 F600\nM5')), false, 'spindle on');
        assert.equal(isPureTransport(validateGcode('G90\nG54\nG2 X10 Y10 I5 J0 F600')), false, 'an arc is a cut');
        assert.equal(isPureTransport(validateGcode('G90\nG54\nG38.2 Z-10 F50')), false, 'probing');
        assert.equal(isPureTransport(validateGcode('G90\nG53;\nG0 B90;\nG54;')), false, 'a rotation is not transport');
        assert.equal(isPureTransport(validateGcode('G90\nG53;\nG92 Z0\nG0 Z10;\nG54;')), false, 'it rewrites the origin');
        assert.equal(isPureTransport(validateGcode('G91\nG0 X1\nG90')), false, 'relative inching is not a staged transit');
    }],

    ['a file with no motion is not transport either', () => {
        assert.equal(isPureTransport(validateGcode('G90\nG54;')), false);
    }],

    ['a long spindle-off program is left alone - only a handful of rapids is a transit', () => {
        const short = ['G90', 'G53;'];
        for (let i = 0; i < MAX_TRANSPORT_MOTION_LINES; i++) {
            short.push(`G0 X${10 + i} Y10;`);
        }
        short.push('G54;');
        assert.equal(isPureTransport(validateGcode(short.join('\n'))), true, 'at the limit it is still a transit');
        const long = ['G90', 'G53;'];
        for (let i = 0; i <= MAX_TRANSPORT_MOTION_LINES; i++) {
            long.push(`G0 X${10 + i} Y10;`);
        }
        long.push('G54;');
        assert.equal(isPureTransport(validateGcode(long.join('\n'))), false, 'beyond it, the file is doing something');
    }],

    ['G28 is homing travel the extents cannot see, so it is reported beside them', () => {
        const report = validateGcode('G90\nG53;\nG28; home\nG1 Z300\nG54;');
        assert.equal(report.usesHoming, true);
        assert.equal(report.motionLineCount, 1, 'G28 is not a G0..G3 motion line');
        assert.ok(report.warnings.some((w) => w.includes('G28') && w.includes('do NOT include the homing travel')), report.warnings.join('\n'));
        assert.equal(validateGcode(MOVE_Z_MACHINE).usesHoming, false);
    }],

    ['G38 is recorded so a probing program is never mistaken for a transit', () => {
        assert.equal(validateGcode('G90\nG54\nG38.2 Z-10 F50').usesProbing, true);
        assert.equal(validateGcode(MOVE_Z_MACHINE).usesProbing, false);
    }],

    // ---- Relative transport (the Ray, #260 follow-up): frame-independent, accepted only when the emitter says so ----
    ['a server-emitted G91 .. G90 step passes the frame gate under relativeTransport, and the page gets a note instead of a refusal', () => {
        const step = '; mcp-settle machine X176.000 Y49.000\nG91\nG1 X-5.000 Y0.000 F1500\nG90';
        const report = validateGcode(step);
        assert.equal(isRelativeOnlyTransport(report), true);
        const r = resolveJobFrame(report, ctx({ relativeTransport: true }));
        assert.equal(r.refusal, null);
        assert.ok(r.report.warnings.includes(RELATIVE_TRANSPORT_NOTE));
        assert.ok(!r.report.warnings.some((w) => w.startsWith('Contains G91 relative motion')), 'the generic G91 warning is replaced by the note');
        assert.equal(r.report.frame.declared, null);
    }],

    ['without relativeTransport the same text is refused as undeclared - a submitted file never gets this exemption', () => {
        const step = '; mcp-settle machine X176.000 Y49.000\nG91\nG1 X-5.000 Y0.000 F1500\nG90';
        assert.equal(resolveJobFrame(validateGcode(step), ctx()).refusal, FRAME_REFUSAL_UNDECLARED);
    }],

    ['relativeTransport accepts ONLY all-relative bodies that restore G90', () => {
        // An absolute move mixed in, G91 left active, or motion before the distance mode: not relative transport.
        assert.equal(isRelativeOnlyTransport(validateGcode('G91\nG1 X-5 F1500\nG90\nG1 X10 F1500')), false);
        assert.equal(isRelativeOnlyTransport(validateGcode('G91\nG1 X-5 F1500')), false);
        assert.equal(isRelativeOnlyTransport(validateGcode('G1 X-5 F1500\nG91\nG90')), false);
        assert.notEqual(resolveJobFrame(validateGcode('G91\nG1 X-5 F1500'), ctx({ relativeTransport: true })).refusal, null);
    }],
];
