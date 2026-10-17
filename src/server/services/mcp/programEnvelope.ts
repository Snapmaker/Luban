/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (ops carry them verbatim).
//
// The confirm-page body of a probe_program: the runner's FULL simulated plan
// as declared, machine-readable lines, so the page's extents table, Frame row
// and warnings are computed from what the server will actually command.
//
// Why real gcode lines and not a pseudo-code dialect: every other procedure
// describer (probe_sequence, surface scans, outline, circle, vector, tool
// setter, run_probing_gcode, survey_bed, camera_bootstrap) already renders
// `G90 / G53; / G1 ... F... / G54;` with `;` comments carrying the runner
// semantics, and the summariser (validator.ts) parses exactly that. A second
// dialect would need a second parser, and a line an operator cannot tell from
// gcode IS gcode to them. The lines are honest: probing.moveMachineSettled
// sends each move as `G90 / G53; / G1 <words> F<feed>; / G54;`, so
// `G1 X190.000 Y140.000 F600` is the command, not a picture of it. What makes
// the page unambiguous is the SERVER-DRIVEN banner (jobs.ts) and the header
// comment below, both stating that this text is the plan the runner commands
// one settle-verified line at a time, never a file streamed verbatim.
//
// Job 96baca79b3b8 (2026-09-21): a capture op with a viewing position hopped
// to machine (190, 140) and the page showed X/Y extents "-", Frame UNDECLARED,
// one motion line. The hop was prose. This module is the fix.
//
// Pure: no server imports (unit-tested under ts-node).

import { ObstacleBox } from './envelopeChecks';
import { COARSE_FEED, DESCENT_GUARD_MM, DESCENT_SEGMENT_MM, TRAVEL_FEED } from './procedureLimits';
import { CaptureOpArgs } from './programOps';

/** What the program describer needs of a ProbeProgramPlan (structural, so the plan type stays where it is). */
export interface ProgramEnvelope {
    name: string;
    ops: { id: string; kind: string; on_fail: 'stop' | 'skip'; args: { [key: string]: unknown } }[];
    hopZ: number;
    staged: { x: number; y: number; z: number; b: number | null };
    /** Per-op preview text (comments + the op's own commanded lines), by op id. */
    previews: { id: string; text: string }[];
    rotations: number[];
    seeds: {
        axis?: {
            x: number;
            z_physical: number;
            z_contact: number;
            tip_radius: number | null;
            probe_length: number;
            /** The axis LINE (issue #155): where x / z hold and how it is skewed; absent on a plan staged before the line existed. */
            reference_y?: number | null;
            yaw_deg?: number;
            pitch_deg?: number;
            skew?: 'measured' | 'unmeasured';
        };
    };
    keepOut: ObstacleBox[];
    groups: { id: string; angles: number[]; innerCount: number }[];
    eventBudget: number;
    homesAtEnd: boolean;
    captures: string[];
}

const f3 = (n: number) => n.toFixed(3);

/** A line that is nothing but a frame / distance-mode declaration: `G90`, `G53;`, `G54;` (case, semicolon and spaces tolerated). */
const FRAME_WRAPPER_LINE = /^\s*G0*(90|53|54)\s*;?\s*$/i;

/**
 * Strip the `G90` / `G53;` / `G54;` wrapper lines from a sub-plan's describer
 * output so it can be embedded in a program that declares its frame ONCE. The
 * standalone tools keep their wrapper; a program that kept every nested one
 * ended `G54;` before its own closing raise, which the summariser read as
 * motion under the WORK frame (a false "mixed frames" warning on every program
 * whose last op was a scan or a sequence).
 */
export function unwrapFrameBlock(text: string): string {
    return text.split(/\r?\n/).filter((line) => !FRAME_WRAPPER_LINE.test(line)).join('\n');
}

/**
 * A capture op's block: the viewing hop as the two moves the runner sends
 * (raise to the traverse height, then XY at that height), the descent to a
 * stated z as the column it is (fast segments, then the guarded 1 mm steps),
 * the frame, and the straight raise back when it descended.
 */
export function describeCaptureOp(capture: CaptureOpArgs, hopZ: number): string {
    const label = capture.label ? ` "${capture.label}"` : '';
    const lines: string[] = [];
    const zText = capture.z === null ? '' : ` at a STATED toolhead machine Z${capture.z}`;
    if (capture.view) {
        lines.push(`; CAPTURE FRAME${label} from machine (${capture.view.x}, ${capture.view.y})${zText} - the runner COMMANDS the moves below (law 2: raise, then hop${capture.z === null ? '' : ', then descend'}):`);
        lines.push(`G1 Z${f3(hopZ)} F${TRAVEL_FEED}; raise to the traverse height FIRST - skipped only when the head is already there`);
        lines.push(`G1 X${f3(capture.view.x)} Y${f3(capture.view.y)} F${TRAVEL_FEED}; hop at Z${hopZ} to the viewing position - re-checked from the LIVE position against the travel and every obstacle box before it is sent`);
    } else if (capture.z !== null) {
        lines.push(`; CAPTURE FRAME${label}${zText}: from the XY where the previous op left the head, the runner COMMANDS the descent below (re-checked from the LIVE position against every obstacle box):`);
    } else {
        lines.push(`; CAPTURE FRAME${label}: NO MOTION - the frame is taken from wherever the previous op left the head.`);
    }
    if (capture.z !== null) {
        const guardTop = Math.min(capture.z + DESCENT_GUARD_MM, hopZ);
        if (capture.descent_segment_requested_mm !== null) {
            lines.push(`; CLAMPED: descent_segment_mm ${capture.descent_segment_requested_mm} is outside ${DESCENT_SEGMENT_MM.min}-${DESCENT_SEGMENT_MM.max} - this descent uses ${capture.descent_segment_mm} mm segments`);
        }
        lines.push(`G1 Z${f3(guardTop)} F${TRAVEL_FEED}; descend in <= ${capture.descent_segment_mm} mm segments (crash guard armed) to ${f3(guardTop - capture.z)} mm above the stated Z`);
        lines.push('; ...guarded final approach: 1 mm steps, sensor-checked after each - ANY contact during the descent aborts the program (nothing should be there).');
        for (let gz = guardTop - 1; gz > capture.z - 1e-9; gz -= 1) {
            lines.push(`G1 Z${f3(Math.max(gz, capture.z))} F${COARSE_FEED}; guarded descent step`);
        }
    }
    lines.push(`; wait ${capture.settle_ms} ms for the platform/rotary to settle, then one frame from the selected camera, stamped with the machine position${capture.z === null ? '' : ` (Z${capture.z})`} and B, `
        + 'saved on the job record (result.file; view with get_frame).');
    if (capture.z !== null) {
        lines.push(`G1 Z${f3(hopZ)} F${TRAVEL_FEED}; raise STRAIGHT back to the traverse height - the op ends raised like every other (law 2)`);
    }
    return lines.join('\n');
}

/**
 * The closing home op: the runner sends Luban's own `G53; G28; G54`. G28 is
 * real travel the extents table cannot see, so the line is emitted (the
 * summariser flags it) rather than hidden in a comment.
 */
export function describeHomeOp(leftAtB: number | null): string {
    return [
        '; MACHINE HOME (last op): sent as G53; G28; G54 - Luban\'s own Home. Z rises first, then every axis drives to its limit switch: machine X-19 Y342 Z328.',
        `; ALSO HOMES B: stock on the rotary turns back to B0${leftAtB === null ? '' : ` from the B ${leftAtB} the program left it at`}. Verified by two identical homed+idle heartbeats.`,
        'G28; home every axis - travel NOT included in the extents table (see the warning); the program ends AT HOME, not raised in place',
    ].join('\n');
}

/**
 * A rotation op's block. The runner sends `G90 / G0 B<deg> F<feed> / M400 /
 * M114` (B has no work offset, so no frame select) and believes the echo only
 * after the turn's physical time plus two idle heartbeats.
 */
export function describeRotateOp(input: { b: number; requireZ: number; fromB: number | null; rotateFeed: number; swept: string | null }): string {
    const from = input.fromB === null ? 180 : input.fromB;
    const seconds = Math.round(Math.abs(input.b - from) / input.rotateFeed * 60);
    return [
        `; ROTATE STOCK: B -> ${input.b} deg (absolute), requires toolhead machine Z >= ${input.requireZ}${input.swept ? `\n${input.swept}` : ''}`,
        `G0 B${f3(input.b)} F${input.rotateFeed}`,
        'M400; wait for the planner to drain',
        `M114; believed only after the turn's physical time (${seconds} s from B${input.fromB === null ? '?' : input.fromB}), then two idle heartbeats at B${input.b}`,
    ].join('\n');
}

/** The whole program: one declared machine-frame block, every op's commanded lines inside it, the closing raise, the frame handed back. */
export function describeProbeProgramAsGcode(plan: ProgramEnvelope): string {
    const captureViews = plan.ops.filter((op) => op.kind === 'capture' && op.args.x !== null && op.args.x !== undefined).length;
    const captureDescents = plan.ops.filter((op) => op.kind === 'capture' && op.args.z !== null && op.args.z !== undefined).length;
    const lines = [
        `; PROBE PROGRAM "${plan.name}": ${plan.ops.length} operations, ONE approval; about ${plan.eventBudget} job events`,
        ...plan.groups.map((g) => `; GROUP "${g.id}": ${g.innerCount} op(s) repeated at B ${g.angles.join(' / ')} deg (each preceded by a rotation)`),
        `; anchored at machine (${plan.staged.x}, ${plan.staged.y}, ${plan.staged.z})${plan.staged.b === null ? '' : ` B${plan.staged.b}`}`,
        '; EVERY MOTION LINE BELOW IS A MOVE THE SERVER\'S RUNNER WILL COMMAND, in this order, one settle-verified move at a time',
        '; (each sent as G90 / G53; / move / G54;). This text is the simulated plan the table above is computed from; it is NOT',
        '; streamed to the controller. Marches stop at contact; nothing moves that is not listed here.',
        '; every operation runs through its own runner (position of record, crash guard, hop envelope, slow zone,',
        `; descents in <= ${DESCENT_SEGMENT_MM.default} mm segments, or the shorter descent_segment_mm an op states) and ends raised at the safe traverse height Z${plan.hopZ}; the next op starts there.`,
        plan.rotations.length
            ? `; THE STOCK WILL ROTATE: B schedule ${plan.rotations.map((b) => `${b} deg`).join(' -> ')}${plan.homesAtEnd ? ' -> 0 (home)' : ''} (absolute), only with the toolhead at Z >= ${plan.hopZ}.`
            : `; no rotations in this program${plan.homesAtEnd ? ' (the closing home still homes B to 0)' : ''}.`,
        ...(plan.homesAtEnd
            ? ['; ENDS WITH MACHINE HOME: G53; G28; G54 - every axis to its switches, B to 0; the program does not end raised in place but AT HOME (X-19 Y342 Z328).']
            : []),
        ...(plan.captures.length
            ? [`; CAMERA CAPTURES: ${plan.captures.length} frame(s) - op(s) ${plan.captures.join(', ')} - saved on the job record, view with get_frame; ${captureViews || captureDescents
                ? `${captureViews ? `${captureViews} of them FIRST hop to a viewing position at Z${plan.hopZ} (the raise and the hop are listed under the op)` : ''}${captureViews && captureDescents ? '; ' : ''}${captureDescents ? `${captureDescents} of them DESCEND to a stated Z for the frame (the column and the straight raise back are listed under the op)` : ''}.`
                : 'none of them moves the head.'}`]
            : []),
        '; A failed operation (no contact where required, hop-guard contact, alarm, rotation not settled) stops the program',
        '; raised at the traverse height and keeps every earlier result; on_fail: skip records the failure and continues.',
        '; References ({from: "<op>.<path>"}, mid/diff/min/max of paths, +/- a number or path) resolve at run time from earlier',
        '; results and are REFUSED outside their approved bounds.',
    ];
    if (plan.keepOut.length) {
        lines.push(`; KEEP-OUT for this clamping (${plan.keepOut.length}, checked with the stored landmarks against every hop, column and march):`);
        for (const k of plan.keepOut) {
            lines.push(`;   "${k.name}": machine X ${k.machine.x0}..${k.machine.x1}, Y ${k.machine.y0}..${k.machine.y1}, toolhead must stay at Z >= ${k.clearanceZ} over it (+5 mm margin)`);
        }
    }
    if (plan.seeds.axis) {
        const a = plan.seeds.axis;
        lines.push(`; JIG GEOMETRY (operator settings, namespace "axis"): axis X${a.x}, physical Z${a.z_physical}, probe ${a.probe_length} mm`
            + ` -> axis.z_contact ${a.z_contact}${a.tip_radius === null ? '' : `, tip radius ${a.tip_radius}`}`);
        if (a.skew === 'measured' && a.reference_y !== null && a.reference_y !== undefined) {
            lines.push(`;   the axis is a LINE: those X / Z hold at reference Y${a.reference_y}; yaw ${a.yaw_deg} deg, pitch ${a.pitch_deg} deg - `
                + 'each op resolves axis.x / axis.z_contact at its OWN Y station (job record: op-<id>-axis)');
        } else {
            lines.push(';   axis skew UNMEASURED: one X / Z assumed for every Y (store two stations with set_probe_geometry rotary_axis_point to measure it)');
        }
    }
    // One declaration for the whole program (frame handshake, cnc-motion-rules
    // section 2): G90, G53 on its own line before the first move, G54 after
    // the last. The sub-plan previews carry their own wrapper for standalone
    // use; embedded, it is stripped so the summariser sees ONE frame.
    lines.push('G90');
    lines.push('G53;');
    plan.ops.forEach((op, index) => {
        lines.push('');
        lines.push(`; ===== OP ${index + 1}/${plan.ops.length} "${op.id}" (${op.kind}${op.on_fail === 'skip' ? ', on_fail: skip' : ''}) =====`);
        const preview = plan.previews.find((p) => p.id === op.id);
        lines.push(preview ? unwrapFrameBlock(preview.text) : '; (no preview)');
    });
    lines.push('');
    lines.push(`G1 Z${f3(plan.hopZ)} F${TRAVEL_FEED}; ${plan.homesAtEnd
        ? 'an ABORT raises straight up to the safe traverse height (a completed program is already at home)'
        : 'program ends raised at the safe traverse height (also on abort)'}`);
    lines.push('G54;');
    return lines.join('\n');
}
