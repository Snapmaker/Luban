// Laser toolset planner (multi-machine overhaul tyeth/Luban#265 WP7, plan 2.5):
// laser_frame, set_air_assist, set_crosshair and the laser_focus refusal.
//
// Every body here is written from the connected machine's dialect row
// (gcodeDialect.ts) - its S range and P word, its air-assist and crosshair
// lines - and its motion through gcodeForms.ts: relative steps with settle
// comments on the Ray and the Original, the own-line G53 machine-frame form on
// the Snapmaker 2.0 and the Artisan. Nothing is guessed: a row without air
// assist or a crosshair refuses, naming the machine.
//
// Laser safety rules this module enforces:
//   - power 0 (the default) is laser OFF: step 1 leads with M5 and every move
//     is a G0 (on the Ray G0 is laser-off by definition: the wiki's Motion row,
//     "G0 (laser off, max rate)"; on the 2.0 "G0 and G28 also turn the laser
//     off"). No M3/M4 is ever written.
//   - power > 0 is capped by LASER_FRAME_POWER_PERCENT (5 %), the clip
//     reported; and the laser is NEVER on across a step boundary: each side of
//     the frame is its own approved step `M3 <power>` / the move / `M5`, so a
//     series abandoned between steps leaves the laser off.
//   - every step names its absolute machine endpoint in a settle comment (the
//     sm2 G0 form too: the direct runner parses only G1 lines otherwise).
//
// Pure: no server imports, unit-tested in tests/laserPlan.test.ts.
import { MotionSegment, ObstacleBox, POSITION_EPSILON_MM, checkMotion, describeViolations } from './envelopeChecks';
import { GcodeDialect } from './gcodeDialect';
import { GcodeForm, PLANNER_SYNC, gcodeFormOf, machineFrameMove, needsPlannerSync, relativeStep, settleComment } from './gcodeForms';
import { TravelLimits, outsideTravel } from './machineTravel';
import { Bounded, ClampReport, LASER_FRAME_FEED, LASER_FRAME_POWER_PERCENT, LASER_FRAME_REPEAT, clampReported } from './procedureLimits';
import { STEP_SEPARATOR, wrapCommentText } from './traversePlan';

export class LaserPlanError extends Error {
    public constructor(message: string) {
        super(message);
        // Checked by name at the tool boundary: instanceof is unreliable across the bundle.
        this.name = 'LaserPlanError';
    }
}

const f3 = (n: number) => n.toFixed(3);

/** A box in MACHINE coordinates, normalised (min <= max). */
export interface LaserBox {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

/** The box from two corners in any order; refused when it has no area. */
export function boxFromCorners(x0: number, y0: number, x1: number, y1: number): LaserBox {
    for (const [name, value] of [['x0', x0], ['y0', y0], ['x1', x1], ['y1', y1]] as Array<[string, number]>) {
        if (!Number.isFinite(value)) {
            throw new LaserPlanError(`${name} must be a finite number (machine coordinates, mm).`);
        }
    }
    const box = { xMin: Math.min(x0, x1), xMax: Math.max(x0, x1), yMin: Math.min(y0, y1), yMax: Math.max(y0, y1) };
    if (box.xMax - box.xMin <= POSITION_EPSILON_MM || box.yMax - box.yMin <= POSITION_EPSILON_MM) {
        throw new LaserPlanError(`The box X ${f3(box.xMin)}..${f3(box.xMax)} Y ${f3(box.yMin)}..${f3(box.yMax)} has no area: `
            + 'a frame needs a width and a height.');
    }
    return box;
}

/** What laser_frame reads from a staged job's validator report (validator.ts GcodeValidationReport). */
export interface JobExtentsInput {
    extents: { x: { min: number; max: number } | null; y: { min: number; max: number } | null };
    frame: { declared: 'machine' | 'work' | null; mixed: boolean };
    usesRelativeMotion: boolean;
}

/**
 * A staged job's XY extents when they are its real footprint in ONE frame:
 * refused when missing, relative or mixed-frame. Checked before laser_frame
 * spends any time confirming an offset.
 */
export function usableJobExtents(jobId: string, report: JobExtentsInput): { x: { min: number; max: number }; y: { min: number; max: number } } {
    const { x, y } = report.extents;
    if (!x || !y) {
        throw new LaserPlanError(`Job ${jobId} has no XY extents in its validation report (no absolute XY motion), so there is no box to frame. `
            + 'Give the box as x0, y0, x1, y1 in machine coordinates.');
    }
    if (report.usesRelativeMotion) {
        throw new LaserPlanError(`Job ${jobId} uses G91 relative motion: its validator extents exclude the relative segments and are not `
            + 'its real footprint. Give the box as x0, y0, x1, y1 in machine coordinates.');
    }
    if (report.frame.mixed) {
        throw new LaserPlanError(`Job ${jobId} moves in both the machine and a work frame, so its extents are not one box. Give the box `
            + 'as x0, y0, x1, y1 in machine coordinates.');
    }
    return { x, y };
}

/**
 * The machine-coordinate box of a staged job, from its validator extents. A
 * machine-frame job's extents are machine coordinates already; a work-frame
 * job's are converted with machine = work - originOffset, ONLY when the live
 * offset is reliable. Refused - never guessed - when the extents are missing,
 * relative, mixed-frame or undeclared.
 */
export function boxFromJobExtents(jobId: string, report: JobExtentsInput, originOffset: { x: number; y: number } | null): LaserBox {
    const { x, y } = usableJobExtents(jobId, report);
    if (report.frame.declared === 'machine') {
        return boxFromCorners(x.min, y.min, x.max, y.max);
    }
    if (report.frame.declared !== 'work') {
        throw new LaserPlanError(`Job ${jobId} declares no coordinate frame, so its extents cannot be placed on the machine.`);
    }
    if (!originOffset) {
        throw new LaserPlanError(`Job ${jobId} is a work-frame job and the live work-origin offset is not reliable right now (no `
            + 'heartbeat offset, or the position of record carries warnings), so its extents cannot be resolved to machine coordinates. '
            + 'Give the box as x0, y0, x1, y1 in machine coordinates.');
    }
    return boxFromCorners(x.min - originOffset.x, y.min - originOffset.y, x.max - originOffset.x, y.max - originOffset.y);
}

// ---- A Ray work-frame job ---------------------------------------------------
//
// Luban's Ray exports are work-frame files: Set Origin
// (RaySetOriginWidget/SetOriginView.tsx) sends `G92 X0 Y0 B0` at the head and
// the job runs from there. The SACP coordinate report carries the resulting
// work-origin offset (sacpMachineState.ts; live 2026-10-18: machine X181 Y49,
// offset (-181, -49), raw work (0, 0) - the head on a just-set origin). The
// extents map to machine coordinates by the repo convention machine = work -
// offset, and ONLY while that offset is the one the job was staged against
// and two consecutive fresh beats agree on it: an origin moved after staging
// moves the job's outline on the bed, and a frame drawn from the old one
// would show the operator the wrong place.

/**
 * A beat laser_frame waits for must be this much newer than the first: the
 * SACP coordinate report is subscribed at `{ interval: 1000 }` (SacpChannel.ts),
 * and the state timestamp also moves on a plain heartbeat, so a beat less than
 * one interval newer may carry the SAME coordinate sample.
 */
export const RAY_COORDINATE_INTERVAL_MS = 1000;

/** How long laser_frame waits for that beat: one coordinate interval plus the 2 s status poll period, twice over. */
export const OFFSET_CONFIRM_WAIT_MS = 2 * (RAY_COORDINATE_INTERVAL_MS + 2000);

/** One beat's offset, as get_position reports it (PositionSnapshot). */
export interface OffsetBeat {
    offset: { x: number; y: number };
    /** originOffsetSource: only 'heartbeat' (carried by this very beat) counts. */
    source: string;
    reliability: string;
    /** reliableForMotion(reliability) (machinePosition.ts). */
    reliable: boolean;
    reportedAt: number;
    warnings: string[];
}

export interface RayWorkOffsetInput {
    jobId: string;
    /** The job's Luban header (validator report `header`). */
    header: { machine: string | null } | null | undefined;
    /** The identifier a Ray export names in `;machine:` (machineCapability.ts RAY_IDENTIFIER). */
    rayIdentifier: string;
    /** validator report originOffsetAtStaging: undefined = staged before it was recorded. */
    staged: { x: number; y: number; reportedAt: number | null } | null | undefined;
    /** Consecutive beats, oldest first. */
    beats: OffsetBeat[];
    now: number;
    staleMs: number;
}

export interface ConfirmedOffset {
    x: number;
    y: number;
    /** The newest beat's timestamp. */
    reportedAt: number;
    stagedAt: number | null;
}

const RESTAGE = 'Set the origin in Luban, wait until get_position reports reliability "heartbeat" with no warnings, then '
    + 're-stage the job (submit_gcode_job with frame: "work") and frame the new job_id - or give the box as x0, y0, x1, y1 in '
    + 'machine coordinates.';

const xy = (o: { x: number; y: number }) => `(${f3(o.x)}, ${f3(o.y)})`;

/**
 * The work-origin offset a Ray work-frame job's extents may be mapped with -
 * or a refusal saying why not and what to do. Requires: a Luban header naming
 * the Ray; an offset recorded when the job was staged; at least two distinct
 * beats, each fresh, reliable, carrying its own offset ('heartbeat') and no
 * warnings; the beats agreeing within POSITION_EPSILON_MM; and the newest
 * equal to the staged offset within it.
 */
export function confirmRayWorkOffset(input: RayWorkOffsetInput): ConfirmedOffset {
    const { jobId } = input;
    const machine = input.header ? input.header.machine : null;
    if (machine !== input.rayIdentifier) {
        throw new LaserPlanError(`Job ${jobId} is a work-frame job whose Luban header ${machine === null ? 'names no machine (no '
            + '`;machine:` line)' : `names "${machine}"`}, not \`;machine: ${input.rayIdentifier}\`: its extents are not known to be `
            + `${input.rayIdentifier} work coordinates from Luban's Set Origin, so they are not mapped to the bed. Give the box as x0, y0, `
            + 'x1, y1 in machine coordinates.');
    }
    if (input.staged === undefined) {
        throw new LaserPlanError(`Job ${jobId} was staged before the work-origin offset was recorded with a job, so there is no way to `
            + `tell whether the origin has moved since. ${RESTAGE}`);
    }
    if (input.staged === null) {
        throw new LaserPlanError(`Job ${jobId} was staged while the work-origin offset was not reliable (no heartbeat offset, or the `
            + `position of record carried warnings), so no offset was recorded with it. ${RESTAGE}`);
    }
    const beats = input.beats;
    if (beats.length < 2 || beats[beats.length - 1].reportedAt <= beats[0].reportedAt) {
        throw new LaserPlanError(`Job ${jobId}: the work-origin offset needs two consecutive heartbeats to agree, and no second beat `
            + `arrived within ${(OFFSET_CONFIRM_WAIT_MS / 1000).toFixed(0)} s. Check get_position and retry.`);
    }
    for (const beat of beats) {
        const age = input.now - beat.reportedAt;
        const at = new Date(beat.reportedAt).toISOString();
        if (age > input.staleMs) {
            throw new LaserPlanError(`Job ${jobId}: the heartbeat at ${at} is ${(age / 1000).toFixed(0)} s old - stale - so its `
                + 'work-origin offset is not the live one. Reconnect the machine, check get_position, and retry.');
        }
        if (!beat.reliable || beat.source !== 'heartbeat' || beat.warnings.length) {
            const why = beat.source !== 'heartbeat'
                ? `its offset is ${beat.source}, not carried by the beat itself`
                : `the position is ${beat.reliability}${beat.warnings.length ? ` (${beat.warnings[0]})` : ''}`;
            throw new LaserPlanError(`Job ${jobId}: the heartbeat at ${at} does not vouch for the work-origin offset - ${why}. ${RESTAGE}`);
        }
    }
    for (let i = 1; i < beats.length; i += 1) {
        const a = beats[i - 1].offset;
        const b = beats[i].offset;
        if (Math.abs(a.x - b.x) > POSITION_EPSILON_MM || Math.abs(a.y - b.y) > POSITION_EPSILON_MM) {
            throw new LaserPlanError(`Job ${jobId}: the work-origin offset changed between consecutive heartbeats, ${xy(a)} then ${xy(b)} `
                + `(more than ${POSITION_EPSILON_MM} mm) - the origin is being set or the report is in flux. ${RESTAGE}`);
        }
    }
    const live = beats[beats.length - 1];
    const staged = input.staged;
    if (Math.abs(live.offset.x - staged.x) > POSITION_EPSILON_MM || Math.abs(live.offset.y - staged.y) > POSITION_EPSILON_MM) {
        throw new LaserPlanError(`Job ${jobId}: the work origin has moved since the job was staged - offset ${xy(staged)} then, `
            + `${xy(live.offset)} now (machine = work - offset). The job would now run somewhere else on the bed, so its staged `
            + `extents are not framed. ${RESTAGE}`);
    }
    return { x: live.offset.x, y: live.offset.y, reportedAt: live.reportedAt, stagedAt: staged.reportedAt };
}

/** laser_frame's box_source for a Ray work-frame job. */
export function describeRayWorkBoxSource(jobId: string, offset: ConfirmedOffset): string {
    return `job ${jobId} (work frame, offset ${f3(offset.x)},${f3(offset.y)} from heartbeat at ${new Date(offset.reportedAt).toISOString()}; `
        + 'machine = work - offset; unchanged since staging)';
}

// ---- Power -----------------------------------------------------------------

export interface LaserPowerWords {
    percent: number;
    /** The S word written (the dialect's S scale). */
    s: number;
    /** The P word (percent) where the dialect takes one; null on GRBL. */
    p: number | null;
    /** `M3 S50` (Ray) or `M3 P5 S12` (Marlin: P wins, S kept for firmware that reads S). */
    line: string;
}

/**
 * The M3 line for `percent` of full power on this dialect. GRBL (the Ray): S
 * on its 0-1000 scale (S1000 = 100 %), so 5 % = S50 and 2 % = S20. Marlin
 * (2.0, Artisan, Original): `M3 P<percent> S<floor(percent * 255 / 100)>` -
 * P wins, S is Luban's own PWM companion (GcodeGenerator.js / generateLaserFocusGcode.js).
 */
export function laserPowerWords(dialect: GcodeDialect, percent: number): LaserPowerWords {
    const laser = dialect.laser;
    if (!laser) {
        throw new LaserPlanError(`the ${dialect.label} has no laser words in its dialect row (${dialect.sources[0]}).`);
    }
    const clean = Number(percent.toFixed(1));
    if (laser.p === 'percent') {
        const s = Math.floor((clean * laser.s.max) / 100);
        return { percent: clean, s, p: clean, line: `M3 P${clean} S${s}` };
    }
    const s = Math.round((clean * laser.s.max) / 100);
    return { percent: clean, s, p: null, line: `M3 S${s}` };
}

/** Why G0 keeps this machine's laser dark, cited from its dialect row; null where the reference says nothing. */
export function g0LaserOffBasis(dialect: GcodeDialect): string | null {
    if (dialect.id === 'ray-grbl') {
        return `G0 is laser-off by definition on the ${dialect.label} (wiki Motion row: "G0 (laser off, max rate)", ${dialect.sources[0]})`;
    }
    if (dialect.id === 'sm2-marlin') {
        return `G0 also turns the laser off on the ${dialect.label} (wiki Laser row: "G0 and G28 also turn the laser off", ${dialect.sources[0]})`;
    }
    return null;
}

// ---- laser_frame ------------------------------------------------------------

export interface ClipReport {
    argument: string;
    requested: number;
    value: number;
    limit: string;
    reason: string;
}

function clipOf(argument: string, report: ClampReport, name: string, limit: Bounded, reason: string): ClipReport | null {
    if (!report.clipped || report.requested === null) {
        return null;
    }
    return { argument, requested: report.requested, value: report.value, limit: `${name} {min ${limit.min}, max ${limit.max}}`, reason };
}

export interface LaserFrameInput {
    dialect: GcodeDialect;
    hasZ: boolean;
    /** The judged machine position; z null on a machine with no Z axis. */
    current: { x: number; y: number; z: number | null };
    box: LaserBox;
    /** Where the box came from, for the page ("arguments", "job abc123 extents"). */
    boxSource: string;
    powerPercent?: unknown;
    feed?: unknown;
    repeat?: unknown;
    /** The resolved travel (requirePlanningTravel); every corner and the start must be inside it. */
    travel: TravelLimits;
    obstacles?: ObstacleBox[];
    toolProtrusionMm?: number | null;
    clearanceMarginMm?: number;
    reason: string;
}

export interface LaserFrameStep {
    what: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    laser: 'off' | 'on';
    distanceMm: number;
    gcode: string;
}

export interface LaserFramePlan {
    steps: LaserFrameStep[];
    header: string;
    reviewText: string;
    name: string;
    gcodeForm: GcodeForm;
    power: { percent: number; line: string | null; s: number | null; p: number | null };
    feed: number;
    repeat: number;
    clipped: ClipReport[];
    box: LaserBox & { width: number; height: number };
    perimeterMm: number;
    totalDistanceMm: number;
    /** The machine Z the frame runs at (Z machines), or null (no Z axis). */
    runZ: number | null;
}

const POWER_REASON = 'a frame previews where a job runs; no power above 5 % ever comes from the MCP itself (plan 2.5)';
const REPEAT_REASON = 'each repeat adds four approved steps; the series stays inside the 20-step cap';
const FEED_REASON = 'traverse_xy\'s feed cap; the floor keeps a powered trace from dwelling on the stock';

/**
 * The frame as a series of approved direct steps: an approach to (xMin, yMin)
 * with the laser off (skipped when the head is already there), then the four
 * sides counter-clockwise, `repeat` times. Power 0: M5 first, G0 moves only.
 * Power > 0: each side is `M3 <power>` / G1 / `M5`, the approach a G0 after
 * M5. Refused outside the travel, through a landmark below its clearance, or
 * on a Z machine whose Z is unknown.
 */
export function planLaserFrame(input: LaserFrameInput): LaserFramePlan {
    const { dialect, hasZ, current, box, travel } = input;
    const form = gcodeFormOf(dialect);
    if (!dialect.laser) {
        throw new LaserPlanError(`the ${dialect.label} has no laser words in its dialect row (${dialect.sources[0]}).`);
    }
    if (hasZ && (current.z === null || !Number.isFinite(current.z))) {
        throw new LaserPlanError('Current machine Z unknown; a laser frame runs at the current Z and cannot be planned without it.');
    }
    const powerReport = clampReported(input.powerPercent, LASER_FRAME_POWER_PERCENT);
    const feedReport = clampReported(input.feed, LASER_FRAME_FEED);
    const repeatReport = clampReported(input.repeat === undefined ? undefined : Math.round(Number(input.repeat)), LASER_FRAME_REPEAT);
    const clipped = [
        clipOf('power_percent', powerReport, 'LASER_FRAME_POWER_PERCENT', LASER_FRAME_POWER_PERCENT, POWER_REASON),
        clipOf('feed', feedReport, 'LASER_FRAME_FEED', LASER_FRAME_FEED, FEED_REASON),
        clipOf('repeat', repeatReport, 'LASER_FRAME_REPEAT', LASER_FRAME_REPEAT, REPEAT_REASON),
    ].filter((c): c is ClipReport => c !== null);
    const feed = feedReport.value;
    const repeat = Math.round(repeatReport.value);
    const powered = powerReport.value > 0;
    const power = powered ? laserPowerWords(dialect, powerReport.value) : null;

    const corners = [
        { label: 'frame corner (xMin, yMin)', x: box.xMin, y: box.yMin },
        { label: 'frame corner (xMax, yMin)', x: box.xMax, y: box.yMin },
        { label: 'frame corner (xMax, yMax)', x: box.xMax, y: box.yMax },
        { label: 'frame corner (xMin, yMax)', x: box.xMin, y: box.yMax },
    ];
    for (const point of [{ label: 'the current position', x: current.x, y: current.y }, ...corners]) {
        const outside = outsideTravel(point, travel);
        if (outside) {
            throw new LaserPlanError(`${point.label} (machine ${f3(point.x)}, ${f3(point.y)}) is outside the toolhead travel: ${outside} `
                + `(travel X ${travel.xMin}..${travel.xMax}, Y ${travel.yMin}..${travel.yMax}).`);
        }
    }

    const sync = needsPlannerSync(dialect);
    const runZ = hasZ ? (current.z as number) : null;
    const move = (from: { x: number; y: number }, to: { x: number; y: number }, command: 'G0' | 'G1'): string => {
        if (form === 'relative-steps') {
            // laserOff false: this body manages its own M5/M3/M5 (above), so
            // gcodeForms' laser-off lead must not land between M3 and the move.
            return relativeStep(dialect, { from, to }, feed, { command, hasZ, plannerSync: false, laserOff: false });
        }
        return [settleComment(to), machineFrameMove(dialect, `X${f3(to.x)} Y${f3(to.y)}`, feed, { command })].join('\n');
    };
    const steps: LaserFrameStep[] = [];
    let at = { x: current.x, y: current.y };
    const push = (what: string, to: { x: number; y: number }, laser: 'off' | 'on') => {
        const lines: string[] = [];
        if (steps.length === 0) {
            lines.push('M5');
        }
        if (laser === 'on' && power) {
            lines.push(power.line);
        }
        lines.push(move(at, to, laser === 'on' ? 'G1' : 'G0'));
        if (laser === 'on') {
            lines.push('M5');
        }
        if (sync) {
            lines.push(PLANNER_SYNC);
        }
        steps.push({ what, from: { ...at }, to: { ...to }, laser, distanceMm: Math.hypot(to.x - at.x, to.y - at.y), gcode: lines.join('\n') });
        at = { ...to };
    };
    if (Math.hypot(box.xMin - current.x, box.yMin - current.y) > POSITION_EPSILON_MM) {
        push('approach (laser off)', { x: box.xMin, y: box.yMin }, 'off');
    }
    const sides = [
        { what: 'bottom side', to: { x: box.xMax, y: box.yMin } },
        { what: 'right side', to: { x: box.xMax, y: box.yMax } },
        { what: 'top side', to: { x: box.xMin, y: box.yMax } },
        { what: 'left side', to: { x: box.xMin, y: box.yMin } },
    ];
    for (let pass = 1; pass <= repeat; pass += 1) {
        for (const side of sides) {
            push(repeat > 1 ? `pass ${pass} ${side.what}` : side.what, side.to, powered ? 'on' : 'off');
        }
    }

    const segmentZ = runZ === null ? 0 : runZ;
    const segments: MotionSegment[] = steps.map((s) => ({
        what: s.what,
        kind: 'hop',
        from: { x: s.from.x, y: s.from.y, z: segmentZ },
        to: { x: s.to.x, y: s.to.y, z: segmentZ },
    }));
    const violations = checkMotion(segments, input.obstacles || [], {
        traverseZ: segmentZ,
        toolProtrusionMm: input.toolProtrusionMm === undefined ? null : input.toolProtrusionMm,
        clearanceMarginMm: input.clearanceMarginMm,
    });
    if (violations.length) {
        throw new LaserPlanError(`Refused - the frame crosses a landmark below its clearance: ${describeViolations(violations)}. `
            + 'Move the box clear of it; never shrink or delete the landmark.');
    }

    const width = box.xMax - box.xMin;
    const height = box.yMax - box.yMin;
    const perimeter = 2 * (width + height);
    const total = steps.reduce((sum, s) => sum + s.distanceMm, 0);
    const offBasis = g0LaserOffBasis(dialect);
    const header = [
        ...wrapCommentText(`reason: ${input.reason}`, 90).map((row) => `; ${row}`),
        `; laser_frame: machine box X ${f3(box.xMin)}..${f3(box.xMax)} Y ${f3(box.yMin)}..${f3(box.yMax)} (${width.toFixed(1)} x ${height.toFixed(1)} mm, `
            + `from ${input.boxSource}), perimeter ${perimeter.toFixed(1)} mm, ${repeat} pass(es), F${feed}`,
        ...(power
            ? [`; VISIBLE TRACE at ${power.percent} % = ${power.line} (cap LASER_FRAME_POWER_PERCENT ${LASER_FRAME_POWER_PERCENT.max} %).`,
                '; Each side is its own approved step: the power line, the move, M5 - the laser is never on between steps;',
                '; step 1 leads with M5 and the approach is a G0 with the laser off.']
            : ['; LASER OFF throughout: step 1 leads with M5 and every move is a G0. No M3/M4 is written.',
                ...wrapCommentText(offBasis || `this MCP has no reference saying G0 alone keeps the ${dialect.label} laser dark: the M5 does.`, 88)
                    .map((row) => `; ${row}`)]),
        ...clipped.map((c) => `; CLIPPED: ${c.argument} requested ${c.requested} -> ${c.value} (${c.limit}: ${c.reason})`),
        runZ === null
            ? '; no Z axis: the frame runs at the machine\'s only height and no Z word is written'
            : `; Z does NOT change: the frame runs at the current machine Z ${f3(runZ)} (the focus height); landmarks are checked at that Z`,
        '; never auto-executed: a laser frame always waits for the operator\'s approval on this page',
        ...(form === 'relative-steps'
            ? ['; steps are RELATIVE (G91 .. G90): each is the delta from the previous planned endpoint, and its',
                '; "; mcp-settle machine" line names the absolute machine endpoint the heartbeat must report before the next step',
                ...(sync ? ['; each step ends G4 P0 (planner sync): this controller\'s M114 reports the QUEUED target'] : [])]
            : ['; steps are absolute MACHINE-frame moves (own-line G53; ... G54;), each naming its endpoint in a settle line']),
        ...steps.map((s, i) => `; step ${i + 1}: ${s.what}, laser ${s.laser}: machine (${f3(s.from.x)}, ${f3(s.from.y)}) -> `
            + `(${f3(s.to.x)}, ${f3(s.to.y)}), ${s.distanceMm.toFixed(1)} mm`),
        `; total XY travel ${total.toFixed(1)} mm over ${steps.length} step(s); travel and landmarks checked for every corner`,
    ].join('\n');
    const reviewText = `${header}\n${steps.map((s) => s.gcode).join(STEP_SEPARATOR)}`;
    const powerLabel = power ? `${power.percent}%` : 'laser off';
    const name = `laser-frame ${width.toFixed(0)}x${height.toFixed(0)} @ (${box.xMin.toFixed(1)}, ${box.yMin.toFixed(1)}) ${powerLabel}`
        + ` - ${input.reason.slice(0, 40)}`;
    return {
        steps,
        header,
        reviewText,
        name,
        gcodeForm: form,
        power: power ? { percent: power.percent, line: power.line, s: power.s, p: power.p } : { percent: 0, line: null, s: null, p: null },
        feed,
        repeat,
        clipped,
        box: { ...box, width, height },
        perimeterMm: perimeter,
        totalDistanceMm: total,
        runZ,
    };
}

// ---- The connected head ------------------------------------------------------

/** What the connection reports about the fitted head (getLatestMachineState headType / toolHead); null = not reported. */
export interface HeadFacts {
    headType: string | null;
    toolHead: string | null;
}

/** The 2.0 laser modules with air assist (wiki: "M7/M8 on, M9 off (20 W/40 W laser only)"); Luban toolhead identifiers. */
export const SM2_AIR_ASSIST_MODULES = ['20W Laser Module', '40W Laser Module'];

function describeHead(head: HeadFacts): string {
    return head.toolHead ? `${head.toolHead} (${head.headType || 'head type not reported'})` : `a ${head.headType} head`;
}

export interface LaserHeadCheck {
    /** True when the connection proves a laser head is fitted (the Ray: always). */
    laserKnown: boolean;
    /** What the result says about the head. */
    note: string;
}

/**
 * Whether the fitted head is a laser, from the connection's report. The Ray's
 * only head is its laser. Elsewhere a reported non-laser head refuses (named);
 * an unreported one is "not knowable" and the caller decides.
 */
export function laserHeadCheck(dialect: GcodeDialect, head: HeadFacts, action: string): LaserHeadCheck {
    if (dialect.laser && !dialect.spindle) {
        return { laserKnown: true, note: `the ${dialect.label}'s only head is its laser module` };
    }
    if (head.headType && head.headType !== 'laser') {
        throw new LaserPlanError(`Refusing ${action}: the connected head is ${describeHead(head)}, not a laser module.`);
    }
    if (head.headType === 'laser') {
        return { laserKnown: true, note: `connected head: ${describeHead(head)}` };
    }
    return {
        laserKnown: false,
        note: 'the connected head is NOT KNOWABLE over this connection (it reports no head type): the operator must confirm a laser '
            + 'module is fitted before approving',
    };
}

/**
 * laser_frame's head rule, at ANY power: on a machine that also takes spindle
 * words (2.0, Artisan, Original) the frame runs XY at the current Z, below
 * the motion floor - only a laser at its focus height justifies that, and M3
 * would also drive a CNC spindle - so the connection must REPORT a laser head.
 * An unreported head is refused rather than guessed. The Ray always passes.
 */
export function requireLaserHeadForFrame(dialect: GcodeDialect, head: HeadFacts): LaserHeadCheck {
    const check = laserHeadCheck(dialect, head, 'laser_frame');
    if (!check.laserKnown) {
        throw new LaserPlanError(`Refusing laser_frame: this connection does not report which head is fitted. On the ${dialect.label} a `
            + 'frame runs XY at the current Z, below the motion floor, which only a laser module at its focus height justifies, and M3 '
            + 'also drives a CNC spindle - so a laser head must be reported, not assumed. Nothing was sent.');
    }
    return check;
}

// ---- set_air_assist / set_crosshair --------------------------------------------

export interface LaserSwitchPlan {
    gcode: string;
    header: string;
    reviewText: string;
    name: string;
    headNote: string;
}

function switchPlan(what: string, line: string, notes: string[], reason: string, headNote: string): LaserSwitchPlan {
    const header = [
        ...wrapCommentText(`reason: ${reason}`, 90).map((row) => `; ${row}`),
        `; ${what}: ${line} - no motion, no frame change`,
        ...notes.flatMap((note) => wrapCommentText(note, 88).map((row) => `; ${row}`)),
    ].join('\n');
    return { gcode: line, header, reviewText: `${header}\n${line}`, name: `${what} - ${reason.slice(0, 40)}`, headNote };
}

/**
 * Air assist on/off from the dialect row (M8 / M9 on the Ray, the 2.0 and the
 * Artisan). Refused where the row has none (the Original, the J1), on a
 * reported non-laser head, and on a 2.0 whose reported module is not the
 * 20 W / 40 W. An unreported head is staged with the note saying so.
 */
export function planAirAssist(dialect: GcodeDialect, head: HeadFacts, on: boolean, reason: string): LaserSwitchPlan {
    const air = dialect.laser ? dialect.laser.air : null;
    if (!air) {
        throw new LaserPlanError(`Refusing set_air_assist: the ${dialect.label} has no air-assist words in its dialect row `
            + `(${dialect.sources[0]}).`);
    }
    const check = laserHeadCheck(dialect, head, 'set_air_assist');
    let headNote = check.note;
    if (dialect.id === 'sm2-marlin') {
        if (head.toolHead && !SM2_AIR_ASSIST_MODULES.includes(head.toolHead)) {
            throw new LaserPlanError(`Refusing set_air_assist: on the ${dialect.label} air assist is for the 20 W / 40 W laser modules only `
                + `(${dialect.sources[0]}), and the connected head is ${describeHead(head)}.`);
        }
        if (!head.toolHead) {
            headNote = `${check.note}; which module is not reported, and on the ${dialect.label} ${air.on} acts only on the 20 W / 40 W laser `
                + 'modules';
        }
    }
    const line = on ? air.on : air.off;
    return switchPlan(`air assist ${on ? 'ON' : 'OFF'}`, line, [`head: ${headNote}`], reason, headNote);
}

/** Crosshair (red-dot pointer) on/off from the dialect row: Ray/Artisan `M2000 L13 P1/P0`, 2.0 `M2002 T3 P1/P0`. */
export function planCrosshair(dialect: GcodeDialect, head: HeadFacts, on: boolean, reason: string): LaserSwitchPlan {
    const crosshair = dialect.laser ? dialect.laser.crosshair : null;
    if (!crosshair) {
        throw new LaserPlanError(`Refusing set_crosshair: the ${dialect.label} has no crosshair line in its dialect row `
            + `(${dialect.sources[0]}).`);
    }
    const check = laserHeadCheck(dialect, head, 'set_crosshair');
    const line = on ? crosshair.on : crosshair.off;
    return switchPlan(`crosshair ${on ? 'ON' : 'OFF'}`, line, [`head: ${check.note}`], reason, check.note);
}

/** laser_focus is never planned: no Z on the Ray, and deferred everywhere else. Always returns the refusal text. */
export function laserFocusRefusal(dialect: GcodeDialect, hasZ: boolean, machine: string): string {
    if (!hasZ) {
        return `Refusing laser_focus: the ${machine} has no Z axis: set focus mechanically on the module (the ${dialect.label} `
            + 'has no Z to move). Nothing was sent.';
    }
    return `Refusing laser_focus on the ${machine}: deferred - this MCP does not plan a laser focus (a Z move to the module's `
        + 'focal height) on any machine yet; the laser tools ship framing, air assist and crosshair only (#265 WP7). Nothing was sent.';
}
