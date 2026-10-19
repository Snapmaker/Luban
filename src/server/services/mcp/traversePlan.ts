// traverse_xy planner: law-2 transport. An XY series at the traverse height,
// staged for ONE operator approval and executed one step per start_gcode_job
// call, like move_z - the twin the 100 mm move_and_capture cap kept forcing
// into hand-written file jobs (which is how a frameless `G0 Z0` got staged on
// 2026-09-12). Pure: no server imports, unit-tested in tests/traversePlan.test.ts.
import { MotionSegment, ObstacleBox, POSITION_EPSILON_MM, checkMotion, describeViolations } from './envelopeChecks';
import { TravelLimits, outsideTravel } from './machineTravel';
import { GcodeDialect, dialectById } from './gcodeDialect';
import { machineFrameMove, needsPlannerSync, relativeStep, relativeStepText, workFrameMove } from './gcodeForms';

export { SETTLE_COMMENT_PREFIX, parseSettleComment, settleComment } from './gcodeForms';

export interface Xyz {
    x: number;
    y: number;
    z: number;
}

export interface TraverseTarget {
    x?: number;
    y?: number;
}

export interface TraversePlanInput {
    /** 1-20 targets in `frame`; an omitted axis keeps its previous value. */
    targets: TraverseTarget[];
    frame: 'machine' | 'work';
    /** The judged machine position (position of record). */
    currentMachine: Xyz;
    /** machine = work - originOffset. */
    originOffset: Xyz;
    /**
     * The toolhead's XY travel as resolved for THIS rig (machineTravel.ts /
     * planningTravel()); null when it is unknown, in which case targets are
     * not checked against it - the caller decides whether that is acceptable.
     */
    travel: TravelLimits | null;
    /** The law-2 traverse height (mcpSafeTraverseZ). The current Z must be at or above it. */
    traverseZ: number;
    feedRate: number;
    /** Stored landmarks (+ any program keep-outs) as obstacle boxes. */
    obstacles: ObstacleBox[];
    /**
     * Lowest machine Z this transport may happen at (law 2). Defaults to
     * traverseZ, which is what it was until the two were told apart.
     */
    motionFloorZ?: number;
    /** clearanceContext.currentToolProtrusion().mm - a physically stated obstacle needs it. */
    toolProtrusionMm?: number | null;
    clearanceMarginMm?: number;
    /**
     * The connected machine's transport traits (traverseMachine() in
     * tools/machine.ts). Omitted = the A350 as it always was: a Z axis, and
     * Snapmaker 2.0 own-line G53 / G54 frame declarations.
     */
    machine?: TraverseMachine;
    reason: string;
}

export interface TraverseMachine {
    /**
     * false on a machine with no Z axis (the Ray, definition size.z 0): there
     * is no motion floor and no traverse height, the series runs at the
     * machine's only height, and nothing about Z is written or demanded.
     */
    hasZ: boolean;
    /**
     * 'snapmaker-2' - own-line `G53;` / `G54;` around an absolute G1, the form
     * the Snapmaker 2.0 Marlin firmware honours (it ignores an inline G53).
     * 'grbl-relative' - the Ray. Luban's own Ray jog (ConnectionControl/
     * ControlPanel.tsx relativeMove) sends `G91 / G1 X.. Y.. F.. / G90` over
     * executeGcode and never a G53 or G54, so that is what its firmware is
     * known to execute. GRBL's G53 is a same-block prefix (`G53 G1 X Y`),
     * not the own-line form every MCP emitter uses, and whether the Ray's
     * GRBL-derived firmware honours either form has not been seen on
     * hardware; a relative step needs no frame at all. Each step is the
     * delta from the planned previous endpoint, and carries a `; mcp-settle`
     * comment naming the absolute MACHINE endpoint so the direct runner can
     * verify arrival against the heartbeat (tools/gcode.ts parseDirectTarget).
     */
    gcode: 'snapmaker-2' | 'grbl-relative';
    /**
     * The connected machine's dialect row (gcodeDialect.ts), from which `gcode`
     * was derived (tools/machine.ts traverseMachine). The steps are written by
     * gcodeForms.ts from it; omitted = the Snapmaker 2.0 row for 'snapmaker-2'
     * and #264's Ray form (no planner sync) for 'grbl-relative'.
     */
    dialect?: GcodeDialect;
}

export const DEFAULT_TRAVERSE_MACHINE: TraverseMachine = { hasZ: true, gcode: 'snapmaker-2' };

/**
 * A relative XY step in Luban's own GRBL jog form (see TraverseMachine.gcode),
 * with its settle comment and no planner sync - #264's Ray form, byte for byte
 * (gcodeForms.relativeStepText). The settle comment helpers moved to
 * gcodeForms.ts and are re-exported above.
 */
export function relativeXyStep(from: { x: number; y: number }, to: { x: number; y: number }, feedRate: number, command: 'G0' | 'G1' = 'G1'): string {
    return relativeStepText({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } }, feedRate, { command });
}

export interface TraverseStep {
    /** Machine-frame endpoints, for the operator and the settle check. */
    from: Xyz;
    to: Xyz;
    /** Target as written in `frame`, with both axes filled in. */
    target: { x: number; y: number };
    distanceMm: number;
    gcode: string;
}

export interface TraversePlan {
    steps: TraverseStep[];
    header: string;
    /** header + steps joined with the direct-batch separator - what the operator approves. */
    reviewText: string;
    name: string;
    totalDistanceMm: number;
    /** True when the steps are relative (grbl-relative): frame-independent, verified through their settle comments. */
    relative: boolean;
    machine: TraverseMachine;
}

export class TraversePlanError extends Error {
    public constructor(message: string) {
        super(message);
        // Checked by name at the tool boundary: instanceof is unreliable across the bundle.
        this.name = 'TraversePlanError';
    }
}

export const MAX_TRAVERSE_TARGETS = 20;
/**
 * "At the traverse height" allows the heartbeat's float noise: home reports
 * machine Z 327.9989959716797 for a 328 home (seen live 2026-09-14), and an
 * exact >= 328 refused every traverse from home.
 */
export const TRAVERSE_Z_TOLERANCE_MM = POSITION_EPSILON_MM;
/** The direct-batch separator start_gcode_job and the confirm page know. */
export const STEP_SEPARATOR = '\n; --- next approved step ---\n';

/** Word-wrap a comment for the gcode header (mirrors move_z). */
export function wrapCommentText(text: string, width: number): string[] {
    const words = String(text).split(/\s+/);
    const rows: string[] = [];
    let row = '';
    for (const word of words) {
        if (row && (row.length + word.length + 1) > width) {
            rows.push(row);
            row = word;
        } else {
            row = row ? `${row} ${word}` : word;
        }
    }
    if (row) {
        rows.push(row);
    }
    return rows;
}

const f3 = (n: number) => n.toFixed(3);

export function planTraverseXy(input: TraversePlanInput): TraversePlan {
    const { targets, frame, currentMachine, originOffset, travel, traverseZ, feedRate, obstacles } = input;
    const machine = input.machine || DEFAULT_TRAVERSE_MACHINE;
    if (!Array.isArray(targets) || targets.length < 1 || targets.length > MAX_TRAVERSE_TARGETS) {
        throw new TraversePlanError(`Provide 1-${MAX_TRAVERSE_TARGETS} targets.`);
    }
    // Law 2: every XY move over 1 mm happens at or above the motion floor.
    // There is deliberately no override here - transport that cannot happen up
    // there is not transport, it is a procedure with its own envelope. On a
    // machine with no Z axis the law has nothing to say: there is no floor to
    // be below, and "raise Z first" is advice about an axis that does not
    // exist (the Ray refusal of 2026-10-18).
    const floorZ = input.motionFloorZ === undefined ? traverseZ : input.motionFloorZ;
    if (machine.hasZ && currentMachine.z < floorZ - TRAVERSE_Z_TOLERANCE_MM) {
        throw new TraversePlanError(`Refused: the toolhead is at machine Z ${f3(currentMachine.z)}, below the motion floor `
            + `${floorZ} (law 2: all XY over 1 mm at or above it). Raise Z with move_z (coordinate_system "machine") first.`);
    }

    const toMachine = (t: { x: number; y: number }) => (frame === 'machine'
        ? { x: t.x, y: t.y }
        : { x: t.x - originOffset.x, y: t.y - originOffset.y });
    const toFrame = (m: { x: number; y: number }) => (frame === 'machine'
        ? { x: m.x, y: m.y }
        : { x: m.x + originOffset.x, y: m.y + originOffset.y });

    const steps: TraverseStep[] = [];
    const segments: MotionSegment[] = [];
    // Plan the segments at the height the head is ACTUALLY at, snapped up only
    // by the heartbeat's float noise so the landmark check does not fail on
    // 1 um. Planning them at the park height instead would check a corridor
    // the toolhead is not in - harmless while the floor WAS the park height,
    // wrong the moment transport is allowed lower.
    const planZ = machine.hasZ ? Math.max(currentMachine.z, floorZ) : currentMachine.z;
    let fromMachine: Xyz = { ...currentMachine, z: planZ };
    let total = 0;
    targets.forEach((raw, i) => {
        const hasX = raw.x !== undefined && raw.x !== null;
        const hasY = raw.y !== undefined && raw.y !== null;
        if (!hasX && !hasY) {
            throw new TraversePlanError(`Target ${i + 1} names neither x nor y.`);
        }
        const x = hasX ? Number(raw.x) : NaN;
        const y = hasY ? Number(raw.y) : NaN;
        if ((hasX && !Number.isFinite(x)) || (hasY && !Number.isFinite(y))) {
            throw new TraversePlanError(`Target ${i + 1} is not finite.`);
        }
        const previousInFrame = toFrame(fromMachine);
        const target = { x: hasX ? x : previousInFrame.x, y: hasY ? y : previousInFrame.y };
        const m = toMachine(target);
        // The travel is the resolved one for this rig, compared with the
        // heartbeat's float noise tolerated - not the nominal box plus a slop
        // (until 2026-09-21: -25/+40, which admitted X-25 on a machine whose
        // travel stops at X-19).
        const outside = travel ? outsideTravel(m, travel) : null;
        if (travel && outside) {
            throw new TraversePlanError(`Target ${i + 1} ${frame} (${f3(target.x)}, ${f3(target.y)}) = machine (${f3(m.x)}, ${f3(m.y)}) is outside `
                + `the toolhead travel: ${outside} (travel X ${travel.xMin}..${travel.xMax}, Y ${travel.yMin}..${travel.yMax}). `
                + 'State a wider limit with set_probe_geometry travel_* only if this rig genuinely reaches there.');
        }
        const to: Xyz = { x: m.x, y: m.y, z: planZ };
        const distanceMm = Math.hypot(to.x - fromMachine.x, to.y - fromMachine.y);
        total += distanceMm;
        segments.push({ what: `step ${i + 1}`, kind: 'hop', from: { ...fromMachine }, to: { ...to } });
        let gcode: string;
        if (machine.gcode === 'grbl-relative') {
            // Ray / Original: a delta from the planned previous endpoint with
            // the absolute machine endpoint declared for the settle check (see
            // TraverseMachine.gcode); never a G53/G54 (gcodeForms.ts). XY only:
            // a traverse writes no Z word.
            const ends = { from: { x: fromMachine.x, y: fromMachine.y }, to: { x: to.x, y: to.y } };
            gcode = machine.dialect ? relativeStep(machine.dialect, ends, feedRate) : relativeXyStep(fromMachine, to, feedRate);
        } else {
            // Every MCP-emitted motion declares its frame: G53 for machine, an
            // explicit G54 for the work workspace (operator law 2026-09-14).
            const dialect = machine.dialect || dialectById('sm2-marlin');
            const words = `X${f3(target.x)} Y${f3(target.y)}`;
            gcode = frame === 'machine' ? machineFrameMove(dialect, words, feedRate) : workFrameMove(dialect, words, feedRate);
        }
        steps.push({ from: { ...fromMachine }, to, target, distanceMm, gcode });
        fromMachine = to;
    });

    // Landmarks are obstacles (law 4). There is no exemption for height: a hop
    // at the motion floor is checked against every stored box exactly like a
    // low segment, which is what makes a floor below the park height safe.
    const violations = checkMotion(segments, obstacles, {
        traverseZ,
        toolProtrusionMm: input.toolProtrusionMm === undefined ? null : input.toolProtrusionMm,
        clearanceMarginMm: input.clearanceMarginMm,
    });
    if (violations.length) {
        throw new TraversePlanError(`Refused - the path crosses a landmark below its clearance: ${describeViolations(violations)}. `
            + 'Raise the traverse height only if the operator says so; never shrink or delete the landmark.');
    }

    const last = steps[steps.length - 1];
    const relative = machine.gcode === 'grbl-relative';
    const header = [
        ...wrapCommentText(`reason: ${input.reason}`, 90).map((row) => `; ${row}`),
        machine.hasZ
            ? `; frame: ${frame} coords; current machine (${f3(currentMachine.x)}, ${f3(currentMachine.y)}) at machine Z ${f3(currentMachine.z)}`
            : `; frame: ${frame} coords; current machine (${f3(currentMachine.x)}, ${f3(currentMachine.y)}); this machine has NO Z axis`,
        machine.hasZ
            ? `; Z does NOT change: the whole series runs at machine Z ${f3(currentMachine.z)} >= traverse height ${traverseZ} (law 2)`
            : '; no Z axis: the series runs at the machine\'s only height; no motion floor or traverse height applies and no Z word is written',
        ...(relative
            ? ['; steps are RELATIVE (G91 .. G90, Luban\'s own jog form for this machine): each is the delta from the previous planned endpoint,',
                '; and its "; mcp-settle machine" line names the absolute machine endpoint the heartbeat must report before the next step',
                ...(machine.dialect && needsPlannerSync(machine.dialect)
                    ? ['; each step ends G4 P0 (planner sync): this controller\'s M114 reports the QUEUED target, so only a report',
                        '; taken after the sync proves the head has arrived']
                    : [])]
            : []),
        ...steps.map((s, i) => `; step ${i + 1}: ${frame} (${f3(toFrame(s.from).x)}, ${f3(toFrame(s.from).y)}) -> (${f3(s.target.x)}, ${f3(s.target.y)})`
            + ` = machine (${f3(s.to.x)}, ${f3(s.to.y)}), ${s.distanceMm.toFixed(1)} mm F${feedRate}`),
        `; total XY travel ${total.toFixed(1)} mm over ${steps.length} step(s); landmarks checked against every segment`,
        '; sensors: NO contact expected during these moves - a probe/toolsetter trigger',
        '; while moving latches the CRASH alarm (probe feed must be armed).',
    ].join('\n');
    const reviewText = `${header}\n${steps.map((s) => s.gcode).join(STEP_SEPARATOR)}`;
    const name = steps.length > 1
        ? `xy-series ${frame} x${steps.length} -> (${last.target.x.toFixed(1)}, ${last.target.y.toFixed(1)}) ${total.toFixed(0)}mm - ${input.reason.slice(0, 40)}`
        : `xy-traverse ${frame} -> (${last.target.x.toFixed(1)}, ${last.target.y.toFixed(1)}) ${total.toFixed(0)}mm - ${input.reason.slice(0, 40)}`;
    return { steps, header, reviewText, name, totalDistanceMm: total, relative, machine };
}

/**
 * Retreat law (operator, 2026-09-16; issue #91): a procedure ends - whether it
 * aborts or completes - STRAIGHT UP at the traverse height (the Z top), never
 * at its start height and never lower. Job fd7fa6cb6396: the tool setter
 * aborted BEFORE its travel (traverse check at Z 327.999 vs 328) and the old
 * "retreat to start height" plunged the head 122 mm from home to Z 205.5 at
 * the home XY, inside the rotary landmark. The success path of run_tool_setter
 * used to stop at the start height for the same reason (#91). Pure: decided
 * from the known machine Z alone; shared by the abort and success paths
 * (probing.ts raiseToTop / abortRaiseToTop).
 */
export interface RaiseToTopDecision {
    /** raise = issue a Z-only move to targetZ; skip = already at the top. */
    action: 'raise' | 'skip';
    targetZ: number;
    reason: string;
}

export function planRaiseToTop(currentZ: number | null, traverseZ: number): RaiseToTopDecision {
    if (currentZ !== null && currentZ >= traverseZ - TRAVERSE_Z_TOLERANCE_MM) {
        return {
            action: 'skip',
            targetZ: traverseZ,
            reason: `already at the traverse height (machine Z ${currentZ.toFixed(3)} vs ${traverseZ})`,
        };
    }
    return {
        action: 'raise',
        targetZ: traverseZ,
        reason: currentZ === null
            ? `machine Z unknown - a Z-only move to the traverse height ${traverseZ} is the one retreat that cannot descend`
            : `raise from machine Z ${currentZ.toFixed(3)} to the traverse height ${traverseZ}`,
    };
}

/**
 * How run_tool_setter ENDS (issue #91). `stay_at_trigger` (the touchscreen
 * manual-swap wizard) holds the tip in contact at the trigger - no retreat at
 * all; every other run ends exactly like an abort: a Z-only raise straight up
 * to the traverse height, nothing sent if the head is already there. Never the
 * start height. The runtime (probing.ts raiseToTop) applies planRaiseToTop to
 * the position of record; the confirm page describes the same decision.
 */
export type ToolSetterEndDecision =
    | { action: 'hold'; targetZ: number | null; reason: string }
    | RaiseToTopDecision;

export function planToolSetterEnd(holdAtTrigger: boolean, triggerZ: number | null, traverseZ: number): ToolSetterEndDecision {
    if (holdAtTrigger) {
        return {
            action: 'hold',
            targetZ: triggerZ,
            reason: 'stay_at_trigger: the tip is held in contact at the trigger for the touchscreen manual-swap wizard - no retreat',
        };
    }
    return planRaiseToTop(triggerZ, traverseZ);
}

/**
 * True when a move from `fromZ` to `toZ` may LOWER the head: `toZ` is below
 * the known Z (beyond the heartbeat's float noise), or the Z is unknown and a
 * descent cannot be ruled out. An abort path uses this to skip any "back to
 * the start" leg - the start of a Z march is above the contact only once the
 * march has begun; before that it is below the head.
 */
export function mayDescend(fromZ: number | null, toZ: number): boolean {
    return fromZ === null || toZ < fromZ - TRAVERSE_Z_TOLERANCE_MM;
}
