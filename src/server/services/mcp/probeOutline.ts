/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import { MotionSegment, ObstacleBox, checkMotion, describeViolations } from './envelopeChecks';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import {
    MarchParams,
    Xyz,
    makeAnnounce,
    marchToContact,
    pointAlong,
    retreatAlong,
    steppedTraverse,
    steppedTraverseZ,
} from './march';
import {
    SIDES,
    SIDE_UNIT,
    Side,
    SideContact,
    TopSample,
    estimateTop,
    fitOutline,
} from './outlineFit';
import { probeFeedService } from './probeFeed';
import { probeAbortHeld } from './programAbort';
import { DESCENT_GUARD_MM } from './probeSequence';
import {
    COARSE_FEED,
    DESCENT_SEGMENT_MM,
    ProcedureAbort,
    ProcedureStopped,
    RECHECK_TOLERANCE_MM,
    TRAVEL_FEED,
    assertChannelReady,
    assertMachineReadyForProcedure,
    descendInSegments,
    expectMachinePosition,
    knownMachinePosition,
    moveMachineSettled,
    senseAfter,
    isProcedureAbort,
    isProcedureStopped,
    abortRaiseToTop,
} from './probing';
import {
    GPIO_SENSOR_DELAY_MS,
    MAX_DESCENT_BAND_MM,
    SIDE_DEFAULT_TRAVEL_MM,
    SIDE_MAX_TRAVEL_MM,
    SIDE_MIN_REACH_MARGIN_MM,
    SIDE_TRAVEL_BEYOND_ESTIMATE_MM,
    resolveMarchParams,
} from './procedureLimits';
import { McpToolError } from './registry';
import { TipCalibrationSnapshot, projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { probeGeometry } from './rotaryGeometry';
import { assertWithinTravel, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

// probe_stock_outline (operator request 2026-09-06): find a block's top and
// its true outline - and so its centre - from an ESTIMATE of where it is and
// how big it is, in one approved procedure, without re-probing the centre
// for every side:
//
//   1. TOP: -Z marches at a few points around the estimated centre (default
//      three along the longer axis). The top is the HIGHEST contact; a sample
//      lower by more than hole_tolerance_mm is a hole / pocket and is
//      ignored (the first probe landing in a drilled hole must not define
//      the surface). Between the points the probe travels close above the
//      surface as a STEPPED TRAVERSE (march.ts): a contact means the surface
//      is higher there - back off, lift, continue.
//   2. SIDES: for each requested side, horizontal marches toward the stock
//      from OUTSIDE the estimate (over-extended by overextend_mm) at
//      top - side_depth_mm, at points_per_side positions along the side
//      (midpoint first, then away from the corners). The travel is
//      side_max_travel_mm (default 25): the on-box agent's first outline lost
//      a whole side to an 11 mm march when the estimate's centre was 3.85 mm
//      off and its width a few mm out - a short march silently turns ordinary
//      estimate error into a missed face, a generous one only costs time.
//      A march that reaches its travel limit records no_contact and the
//      procedure continues. Between points on one side
//      the probe SKIPS ALONG THE FACE: it backs off the last contact by
//      side_standoff_mm and travels at that standoff as a stepped traverse
//      whose retreat is AWAY from the face (a projection bumps it outward,
//      capped at the approved start line); the next march starts from where
//      it arrives (a dynamic start off the previous contact, never a fresh
//      approach from the outside line). Between sides it goes over the top
//      at the traverse height (law 2).
//   3. FIT: per side the mean coordinate and slope; centre, size (plus the
//      tip diameter when known), yaw. Reported in machine AND work frames.
//
// Laws: every move is enumerated on the confirm page; no clearance is
// invented (start_z_machine and floor_z_machine are the operator's; side
// depth hangs off the MEASURED top); the crash guard stays armed for every
// move that expects no contact; descents are segmented; coarse <= 1 mm.

export interface OutlineTopPoint {
    label: string;
    x: number;
    y: number;
}

export interface OutlineSidePoint {
    side: Side;
    label: string;
    /** March start (outside the estimate), machine XY; Z = top - side_depth at run time. */
    start: { x: number; y: number };
    unit: { x: number; y: number };
    travelMm: number;
}

export interface ProbeOutlinePlan {
    tool: 'probe_stock_outline';
    center: { x: number; y: number };
    size: { x: number; y: number };
    overextendMm: number;
    startZMachine: number;
    floorZMachine: number;
    topPoints: OutlineTopPoint[];
    holeToleranceMm: number;
    sideDepthMm: number;
    sides: Side[];
    sidePoints: OutlineSidePoint[];
    hopLiftMm: number;
    /** Along a side: back off the last contact by this and travel at that standoff to the next point. */
    sideStandoffMm: number;
    march: MarchParams;
    hopZ: number;
    staged: Xyz;
    tipDiameterMm: number | null;
}

interface OutlineArgs {
    center_x?: unknown;
    center_y?: unknown;
    size_x_mm?: unknown;
    size_y_mm?: unknown;
    overextend_mm?: unknown;
    start_z_machine?: unknown;
    floor_z_machine?: unknown;
    top_points?: unknown;
    hole_tolerance_mm?: unknown;
    side_depth_mm?: unknown;
    points_per_side?: unknown;
    sides?: unknown;
    hop_lift_mm?: unknown;
    side_standoff_mm?: unknown;
    side_max_travel_mm?: unknown;
    coarse_step_mm?: unknown;
    fine_step_mm?: unknown;
    backoff_mm?: unknown;
    sensor_delay_ms?: unknown;
    confirm_passes?: unknown;
}

function num(value: unknown, name: string, min: number, max: number, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
        if (fallback === undefined) {
            throw new McpToolError(`${name} is required.`);
        }
        return fallback;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new McpToolError(`${name} must be a number in ${min}..${max} (got ${JSON.stringify(value)}).`);
    }
    return n;
}

const round3 = (v: number) => Number(v.toFixed(3));

const SIDE_ARROW: { [side in Side]: string } = { west: '+X', east: '-X', south: '+Y', north: '-Y' };

/**
 * Offsets along a side for n points over the middle half of the side (corners
 * are where estimates go wrong), MIDPOINT FIRST so the first contact of a side
 * is the most likely one, then outward alternating.
 */
function offsetsFor(n: number, length: number): number[] {
    if (n === 1) {
        return [0];
    }
    const span = length / 2;
    const evenly = Array.from({ length: n }, (_, i) => round3(-span / 2 + (span * i) / (n - 1)));
    return [...evenly].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
}

/** Conservative motion list: side depth at its lowest possible value (floor - side_depth). */
export function outlineMotion(plan: ProbeOutlinePlan): MotionSegment[] {
    const out: MotionSegment[] = [];
    const first = plan.topPoints[0];
    out.push({ kind: 'column', what: `top point "${first.label}" descent`, from: { ...first, z: plan.hopZ }, to: { ...first, z: plan.floorZMachine } });
    for (let i = 1; i < plan.topPoints.length; i++) {
        const a = plan.topPoints[i - 1];
        const b = plan.topPoints[i];
        out.push({ kind: 'march', what: `stepped traverse ${a.label} -> ${b.label}`, from: { ...a, z: plan.floorZMachine }, to: { ...b, z: plan.floorZMachine } });
        out.push({ kind: 'march', what: `top point "${b.label}" march`, from: { ...b, z: plan.startZMachine }, to: { ...b, z: plan.floorZMachine } });
    }
    const lowSide = round3(plan.floorZMachine - plan.sideDepthMm);
    let previous: OutlineSidePoint | null = null;
    for (const p of plan.sidePoints) {
        if (previous && previous.side === p.side) {
            out.push({ kind: 'march', what: `stepped traverse ${previous.label} -> ${p.label}`, from: { ...previous.start, z: lowSide }, to: { ...p.start, z: lowSide } });
        } else {
            out.push({ kind: 'column', what: `side start "${p.label}" descent`, from: { ...p.start, z: plan.hopZ }, to: { ...p.start, z: lowSide } });
        }
        out.push({
            kind: 'march',
            what: `side march "${p.label}"`,
            from: { ...p.start, z: lowSide },
            to: { x: round3(p.start.x + p.unit.x * p.travelMm), y: round3(p.start.y + p.unit.y * p.travelMm), z: lowSide },
        });
        previous = p;
    }
    return out;
}

export function planProbeOutline(args: OutlineArgs, extraObstacles: ObstacleBox[] = []): ProbeOutlinePlan {
    const snapshot = getPositionSnapshot();
    const { x, y, z } = snapshot.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the outline procedure.');
    }
    const hopZ = safeTraverseZ();
    const cx = num(args.center_x, 'center_x', -50, 500, x);
    const cy = num(args.center_y, 'center_y', -50, 500, y);
    const sx = num(args.size_x_mm, 'size_x_mm (estimated stock size along machine X)', 2, 400);
    const sy = num(args.size_y_mm, 'size_y_mm (estimated stock size along machine Y)', 2, 400);
    const overextend = num(args.overextend_mm, 'overextend_mm', 3, 60, 5);
    const startZ = num(args.start_z_machine, 'start_z_machine (toolhead Z above the top where the -Z search starts - operator-stated, never a guess)', 1, hopZ);
    const floorZ = num(args.floor_z_machine, 'floor_z_machine (deepest toolhead Z the top search may reach)', 0, hopZ);
    if (floorZ >= startZ) {
        throw new McpToolError(`floor_z_machine ${floorZ} must be below start_z_machine ${startZ}.`);
    }
    if (startZ - floorZ > MAX_DESCENT_BAND_MM) {
        throw new McpToolError(`start_z_machine - floor_z_machine exceeds ${MAX_DESCENT_BAND_MM} mm.`);
    }
    const topCount = Math.round(num(args.top_points, 'top_points', 1, 5, 3));
    const holeTol = num(args.hole_tolerance_mm, 'hole_tolerance_mm', 0.2, 50, 2);
    const sideDepth = num(args.side_depth_mm, 'side_depth_mm', 1, 40, 2);
    const perSide = Math.round(num(args.points_per_side, 'points_per_side', 1, 4, 3));
    const hopLift = num(args.hop_lift_mm, 'hop_lift_mm', 0.5, 10, 2);
    const sideStandoff = num(args.side_standoff_mm, 'side_standoff_mm', 1, 20, 3);
    let sides: Side[] = SIDES;
    if (args.sides !== undefined) {
        if (!Array.isArray(args.sides) || !args.sides.length || args.sides.some((s) => !SIDES.includes(String(s) as Side))) {
            throw new McpToolError(`sides must list one or more of ${SIDES.join(', ')}.`);
        }
        sides = Array.from(new Set(args.sides.map((s) => String(s) as Side)));
    }

    // Top points: centre, then +/- a quarter of the LONGER estimated axis,
    // then the shorter axis for 4-5 points.
    const longX = sx >= sy;
    const q = (longX ? sx : sy) / 4;
    const q2 = (longX ? sy : sx) / 4;
    const topOffsets: { dx: number; dy: number }[] = [
        { dx: 0, dy: 0 },
        longX ? { dx: q, dy: 0 } : { dx: 0, dy: q },
        longX ? { dx: -q, dy: 0 } : { dx: 0, dy: -q },
        longX ? { dx: 0, dy: q2 } : { dx: q2, dy: 0 },
        longX ? { dx: 0, dy: -q2 } : { dx: -q2, dy: 0 },
    ];
    const topPoints: OutlineTopPoint[] = topOffsets.slice(0, topCount).map((o, i) => ({
        label: i === 0 ? 'top_centre' : `top_${i}`,
        x: round3(cx + o.dx),
        y: round3(cy + o.dy),
    }));

    // Side points: start outside the estimate by overextend_mm and march
    // side_max_travel_mm - generous by default so the combined error of the
    // centre and the width estimate cannot hide a face; never less than what
    // reaches the estimate itself plus a margin (procedureLimits.ts).
    const travel = Math.min(SIDE_MAX_TRAVEL_MM.max, num(
        args.side_max_travel_mm, 'side_max_travel_mm', SIDE_MAX_TRAVEL_MM.min, SIDE_MAX_TRAVEL_MM.max,
        Math.max(SIDE_DEFAULT_TRAVEL_MM, round3(2 * overextend + SIDE_TRAVEL_BEYOND_ESTIMATE_MM))
    ));
    if (travel < overextend + SIDE_MIN_REACH_MARGIN_MM) {
        throw new McpToolError(`side_max_travel_mm ${travel} does not even reach the estimated face (overextend ${overextend} mm `
            + `+ ${SIDE_MIN_REACH_MARGIN_MM}): raise it.`);
    }
    const sidePoints: OutlineSidePoint[] = [];
    for (const side of sides) {
        const along = side === 'west' || side === 'east' ? sy : sx;
        offsetsFor(perSide, along).forEach((off, j) => {
            const label = `${side}_${j + 1}`;
            let start: { x: number; y: number };
            if (side === 'west') {
                start = { x: round3(cx - sx / 2 - overextend), y: round3(cy + off) };
            } else if (side === 'east') {
                start = { x: round3(cx + sx / 2 + overextend), y: round3(cy + off) };
            } else if (side === 'south') {
                start = { x: round3(cx + off), y: round3(cy - sy / 2 - overextend) };
            } else {
                start = { x: round3(cx + off), y: round3(cy + sy / 2 + overextend) };
            }
            sidePoints.push({ side, label, start, unit: SIDE_UNIT[side], travelMm: travel });
        });
    }

    // Every point the procedure visits - top stations, side-march starts and
    // the far end of every side march - inside the toolhead's real travel.
    assertWithinTravel(
        [
            ...topPoints.map((p) => ({ label: `Top point "${p.label}"`, x: p.x, y: p.y })),
            ...sidePoints.map((p) => ({ label: `Side march ${p.label} start`, x: p.start.x, y: p.start.y })),
            ...sidePoints.map((p) => ({
                label: `Side march ${p.label} far limit (shrink the estimate, overextend_mm or side_max_travel_mm)`,
                x: round3(p.start.x + p.unit.x * p.travelMm),
                y: round3(p.start.y + p.unit.y * p.travelMm),
            })),
        ],
        requirePlanningTravel('a stock outline')
    );

    const geometry = probeGeometry();
    const plan: ProbeOutlinePlan = {
        tool: 'probe_stock_outline',
        center: { x: cx, y: cy },
        size: { x: sx, y: sy },
        overextendMm: overextend,
        startZMachine: round3(startZ),
        floorZMachine: round3(floorZ),
        topPoints,
        holeToleranceMm: holeTol,
        sideDepthMm: sideDepth,
        sides,
        sidePoints,
        hopLiftMm: hopLift,
        sideStandoffMm: sideStandoff,
        // Operator law 2026-09-05: never 2 mm; GPIO sensor floor (procedureLimits.ts).
        march: resolveMarchParams(args, { delay: GPIO_SENSOR_DELAY_MS }),
        hopZ,
        staged: { x, y, z },
        tipDiameterMm: geometry ? geometry.tipDiameter : null,
    };

    // Law 4: keep-out. Side marches enter the stock's region deliberately
    // (kind 'march' - exempt from crossing landmarks, checked against volumes).
    const violations = checkMotion(outlineMotion(plan), [...landmarkStore.obstacleBoxes(), ...extraObstacles], { traverseZ: hopZ, ...clearanceOptions() });
    if (violations.length) {
        throw new McpToolError(`Outline refused (law 4, landmarks are obstacles): ${describeViolations(violations)}. `
            + 'Move the estimate, shrink overextend_mm / side points, or have the operator adjust the landmark.');
    }
    return plan;
}

export function describeProbeOutlinePlanAsGcode(plan: ProbeOutlinePlan): string {
    const lines = [
        `; STOCK OUTLINE: estimated centre (${plan.center.x}, ${plan.center.y}), estimated size ${plan.size.x} x ${plan.size.y} mm, over-extended by ${plan.overextendMm} mm`,
        `; 1) TOP at ${plan.topPoints.length} point(s): -Z marches from start_z_machine Z${plan.startZMachine} to the floor Z${plan.floorZMachine}; the HIGHEST contact is the top,`,
        `;    a sample lower by more than ${plan.holeToleranceMm} mm is a hole and is ignored. Between points: STEPPED TRAVERSE at last contact + ${plan.hopLiftMm} mm`,
        `;    (1 mm steps, F300, probe expected: a contact backs off 1 mm, lifts ${plan.hopLiftMm} mm and continues; never above Z${plan.hopZ}).`,
        `; 2) SIDES ${plan.sides.join(', ')}: horizontal marches toward the stock from ${plan.overextendMm} mm outside the estimate at top - ${plan.sideDepthMm} mm,`,
        `;    up to ${plan.sidePoints[0] ? plan.sidePoints[0].travelMm : 0} mm each; a march that finds nothing records no_contact and the procedure continues.`,
        `;    Between points on one side: back off the last contact by ${plan.sideStandoffMm} mm and skip along the face at that standoff as a`,
        `;    stepped traverse (1 mm steps, probe expected; a bump retreats ${plan.hopLiftMm} mm AWAY from the face, capped at the start line);`,
        `;    the next march starts from the arrival point. Between sides: over the top at Z${plan.hopZ} (law 2).`,
        `; 3) FIT: side means + slopes -> centre, size${plan.tipDiameterMm === null ? '' : ` (physical = minus the ${plan.tipDiameterMm} mm tip)`}, yaw; machine and work frames.`,
        `; march: coarse ${plan.march.coarseStepMm} mm F${COARSE_FEED}, fine ${plan.march.fineStepMm}, backoff ${plan.march.backoffMm}, ${plan.march.confirmPasses} confirm pass(es), sensor ${plan.march.sensorDelayMs} ms`,
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)}) - re-verified before motion`,
        'G90',
        'G53;',
        `G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the safe traverse height (law 2)`,
    ];
    const first = plan.topPoints[0];
    lines.push(`G1 X${first.x.toFixed(3)} Y${first.y.toFixed(3)} F${TRAVEL_FEED}; traverse to "${first.label}"`);
    lines.push(`G1 Z${Math.min(plan.startZMachine + DESCENT_GUARD_MM, plan.hopZ).toFixed(3)} F${TRAVEL_FEED}; descend in <= ${DESCENT_SEGMENT_MM} mm segments (crash guard armed)`);
    lines.push(`; ...guarded 1 mm steps to Z${plan.startZMachine} (ANY contact aborts: the surface is above start_z_machine)`);
    plan.topPoints.forEach((tp, i) => {
        if (i > 0) {
            lines.push(`; stepped traverse to "${tp.label}" (${tp.x}, ${tp.y}) at last contact + ${plan.hopLiftMm} mm`);
        }
        lines.push(`; --- "${tp.label}" (${tp.x}, ${tp.y}): march -Z in ${plan.march.coarseStepMm} mm steps, floor Z${plan.floorZMachine} ---`);
        lines.push(`G1 Z${plan.floorZMachine.toFixed(3)} F${COARSE_FEED}; deepest allowed - no contact by here = no_contact at this point`);
        lines.push(`; ...on contact: release, ${plan.march.fineStepMm} mm fine, ${plan.march.confirmPasses} confirm cycle(s)`);
    });
    let previous: OutlineSidePoint | null = null;
    for (const p of plan.sidePoints) {
        const limit = { x: round3(p.start.x + p.unit.x * p.travelMm), y: round3(p.start.y + p.unit.y * p.travelMm) };
        if (!previous || previous.side !== p.side) {
            lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the traverse height`);
            lines.push(`G1 X${p.start.x.toFixed(3)} Y${p.start.y.toFixed(3)} F${TRAVEL_FEED}; traverse to side start "${p.label}"`);
            lines.push(`; descend in <= ${DESCENT_SEGMENT_MM} mm segments, then guarded 1 mm steps, to Z = top - ${plan.sideDepthMm} (runtime; ANY contact here = the stock is larger than estimate + overextend: ABORT)`);
        } else {
            lines.push(`; skip along the face ${previous.label} -> "${p.label}" at ${plan.sideStandoffMm} mm off the last contact (stepped traverse, retreat away from the face), then march on from there`);
        }
        lines.push(`; --- "${p.label}": march ${SIDE_ARROW[p.side]} from (${p.start.x}, ${p.start.y}) up to (${limit.x}, ${limit.y}) ---`);
        lines.push(`G1 X${limit.x.toFixed(3)} Y${limit.y.toFixed(3)} F${COARSE_FEED}; travel limit - no contact by here = no_contact for this side point`);
        lines.push(`G1 X${p.start.x.toFixed(3)} Y${p.start.y.toFixed(3)} F${TRAVEL_FEED}; retreat to the march start`);
        previous = p;
    }
    lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (also on any abort)`);
    lines.push('G54;');
    return lines.join('\n');
}

export interface OutlineResult {
    tipCalibration?: TipCalibrationSnapshot;
    tool: 'probe_stock_outline';
    top: ReturnType<typeof estimateTop>;
    topSamples: (TopSample & { spreadMm?: number })[];
    sides: SideContact[];
    fit: ReturnType<typeof fitOutline>;
    centerMachine: { x: number | null; y: number | null };
    centerWork: { x: number | null; y: number | null } | null;
    sizeMm: { x: number | null; y: number | null };
    sizePhysicalMm: { x: number | null; y: number | null };
    yawDeg: number | null;
    lifts: { during: string; x: number; y: number; fromZ: number; toZ: number }[];
    phases: { phase: string; note?: string }[];
    note: string;
    aborted?: boolean;
}

export async function runProbeOutlineProcedure(plan: ProbeOutlinePlan): Promise<OutlineResult> {
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();
    assertChannelReady('probe', 'stock outline');
    const phases: { phase: string; note?: string }[] = [];
    const announce = makeAnnounce(plan.tool, phases);
    const tag = 'outline';
    const topSamples: OutlineResult['topSamples'] = [];
    const contacts: SideContact[] = [];
    const lifts: OutlineResult['lifts'] = [];

    const build = (aborted: boolean): OutlineResult => {
        const top = estimateTop(topSamples, plan.holeToleranceMm);
        const fit = fitOutline(contacts, plan.tipDiameterMm);
        const offset = getPositionSnapshot().originOffset;
        const centerWork = fit.centerMachine.x !== null && fit.centerMachine.y !== null
            ? { x: round3(fit.centerMachine.x + offset.x), y: round3(fit.centerMachine.y + offset.y) }
            : null;
        return {
            tool: plan.tool,
            top,
            tipCalibration,
            topSamples: topSamples.map((r) => ({ ...r, ...projectToolTipZ(r.z, tipCalibration) })),
            sides: contacts.map((r) => ({ ...r, ...projectToolTipZ(r.x !== null && r.y !== null ? r.z : null, tipCalibration) })),
            fit,
            centerMachine: fit.centerMachine,
            centerWork,
            sizeMm: fit.sizeMm,
            sizePhysicalMm: fit.sizePhysicalMm,
            yawDeg: fit.yawDeg,
            lifts,
            phases,
            note: `${aborted ? 'ABORTED. ' : ''}Top ${top.z === null ? 'not found' : `Z${top.z} (toolhead; ${top.agreeing.length} agreeing sample(s)`
                + `${top.holes.length ? `, holes: ${top.holes.join(', ')}` : ''})`}. ${fit.note}`
                + `${centerWork ? ` Work-frame centre (${centerWork.x}, ${centerWork.y}) with the current origin offset.` : ''}`,
            aborted: aborted || undefined,
        };
    };

    const guardedDescent = async (label: string, toZ: number, what: string) => {
        const known = knownMachinePosition();
        const zNow = known.position.z;
        if (zNow === null) {
            throw new ProcedureAbort(`Machine Z unknown before the descent at "${label}" - refusing to guess.`);
        }
        if (zNow < toZ - RECHECK_TOLERANCE_MM) {
            throw new ProcedureAbort(`"${label}": the toolhead is at Z${zNow} (${known.source}), BELOW the descent target Z${toZ} - a descent never rises.`);
        }
        const guardTop = toZ + DESCENT_GUARD_MM;
        probeFeedService.clearExpectedContact();
        if (zNow > guardTop + TRAVERSE_Z_TOLERANCE_MM) {
            await descendInSegments(`${tag}:descend:${label}`, zNow, guardTop, 'probe', plan.march.sensorDelayMs);
        }
        let gz = Math.min(Math.max(zNow, toZ), guardTop);
        while (gz - toZ > 1e-9) {
            const t0 = Date.now();
            gz = Math.max(gz - 1, toZ);
            await moveMachineSettled(`${tag}:descend-guard:${label}`, { z: gz }, COARSE_FEED);
            const sensed = await senseAfter('probe', t0, plan.march.sensorDelayMs);
            if (sensed.contact) {
                throw new ProcedureAbort(`UNEXPECTED CONTACT at Z${gz.toFixed(3)} during the guarded descent at "${label}": ${what} Machine held.`);
            }
        }
    };

    try {
        await expectMachinePosition(plan.staged, 'staged position', (message) => new McpToolError(
            `The machine is not at the position this outline was staged from. ${message} Stage probe_stock_outline again.`
        ));
        probeFeedService.clearExpectedContact();
        await moveMachineSettled(`${tag}:raise`, { z: plan.hopZ }, TRAVEL_FEED);

        // ---- 1. top
        const first = plan.topPoints[0];
        await moveMachineSettled(`${tag}:traverse`, { x: first.x, y: first.y }, TRAVEL_FEED);
        announce('traverse', `(${first.x}, ${first.y}) at Z${plan.hopZ}`);
        await guardedDescent(first.label, plan.startZMachine, 'the surface is above start_z_machine.');
        let currentZ = plan.startZMachine;
        let lastContactZ: number | null = null;
        for (let i = 0; i < plan.topPoints.length; i++) {
            const tp = plan.topPoints[i];
            if (i > 0) {
                const prev = plan.topPoints[i - 1];
                const hopZ = Math.min(round3((lastContactZ === null ? plan.startZMachine : lastContactZ) + plan.hopLiftMm), plan.hopZ);
                if (hopZ > currentZ + TRAVERSE_Z_TOLERANCE_MM) {
                    probeFeedService.clearExpectedContact();
                    await moveMachineSettled(`${tag}:lift:${tp.label}`, { z: hopZ }, TRAVEL_FEED);
                }
                const traverse = await steppedTraverseZ(tag, tp.label, prev, tp, hopZ, {
                    liftMm: plan.hopLiftMm, maxZ: plan.hopZ, sensorDelayMs: plan.march.sensorDelayMs,
                }, announce);
                for (const l of traverse.lifts) {
                    lifts.push({ during: `${prev.label} -> ${tp.label}`, x: l.x, y: l.y, fromZ: round3(l.z), toZ: round3(l.z + l.liftMm) });
                }
                currentZ = traverse.z;
                await expectMachinePosition({ x: tp.x, y: tp.y, z: currentZ }, `top point "${tp.label}"`, (m) => new ProcedureAbort(m));
            }
            probeFeedService.setExpectedContact(['probe']);
            const travel = round3(currentZ - plan.floorZMachine);
            const contact = travel > plan.march.fineStepMm
                ? await marchToContact(tag, tp.label, { x: tp.x, y: tp.y, z: currentZ }, { x: 0, y: 0, z: -1 }, travel, plan.march, announce)
                : null;
            if (contact) {
                topSamples.push({ label: tp.label, x: tp.x, y: tp.y, z: contact.point.z, spreadMm: contact.spreadMm });
                lastContactZ = contact.point.z;
                currentZ = contact.point.z;
            } else {
                topSamples.push({ label: tp.label, x: tp.x, y: tp.y, z: null });
                currentZ = plan.floorZMachine;
                announce(`no-contact-${tp.label}`, `nothing down to the floor Z${plan.floorZMachine} (a hole, or the surface is below the floor)`);
            }
            probeFeedService.clearExpectedContact();
        }
        const top = estimateTop(topSamples, plan.holeToleranceMm);
        if (top.z === null) {
            throw new ProcedureAbort(`No top surface found at any of the ${plan.topPoints.length} point(s) between Z${plan.startZMachine} and the floor Z${plan.floorZMachine}.`);
        }
        announce('top', `Z${top.z} from ${top.agreeing.join(', ')}${top.holes.length ? `; holes ${top.holes.join(', ')}` : ''}${top.missing.length ? `; no contact at ${top.missing.join(', ')}` : ''}`);

        // ---- 2. sides
        const sideZ = round3(top.z - plan.sideDepthMm);
        let previous: OutlineSidePoint | null = null;
        // Distance from the previous point's start line at which the probe
        // rests after its march (contact - standoff, or 0 after a miss).
        let restS = 0;
        for (const p of plan.sidePoints) {
            const line: Xyz = { x: p.start.x, y: p.start.y, z: sideZ };
            const unit: Xyz = { x: p.unit.x, y: p.unit.y, z: 0 };
            let startS = 0;
            if (!previous || previous.side !== p.side) {
                probeFeedService.clearExpectedContact();
                await moveMachineSettled(`${tag}:raise:${p.label}`, { z: plan.hopZ }, TRAVEL_FEED);
                await moveMachineSettled(`${tag}:traverse:${p.label}`, { x: p.start.x, y: p.start.y }, TRAVEL_FEED);
                announce(`traverse-${p.label}`, `(${p.start.x}, ${p.start.y}) at Z${plan.hopZ}`);
                await guardedDescent(p.label, sideZ, `the stock (or a fixture) is under the side start - larger than the estimate + ${plan.overextendMm} mm. Raise overextend_mm.`);
                currentZ = sideZ;
            } else {
                // Skip along the face from the previous rest point (restS off
                // the start line) to the same offset on this point's line, as
                // a stepped traverse whose retreat is AWAY from the face and
                // capped at the start line (restS). The march then starts
                // from wherever that arrives.
                const prevLine: Xyz = { x: previous.start.x, y: previous.start.y, z: sideZ };
                const fromPoint = pointAlong(prevLine, unit, restS);
                const toPoint = pointAlong(line, unit, restS);
                const traverse = await steppedTraverse(tag, p.label, fromPoint, toPoint, {
                    retreatUnit: { x: -unit.x, y: -unit.y, z: 0 },
                    liftMm: plan.hopLiftMm,
                    maxLiftTotalMm: restS,
                    onMax: 'stop-lifting',
                    sensorDelayMs: plan.march.sensorDelayMs,
                }, announce);
                for (const l of traverse.lifts) {
                    lifts.push({ during: `${previous.label} -> ${p.label}`, x: l.x, y: l.y, fromZ: sideZ, toZ: sideZ });
                }
                startS = round3(restS - traverse.liftTotalMm);
                announce(`skip-${p.label}`, `along the face from ${previous.label}: ${traverse.lifts.length} bump(s), march starts ${startS} mm in from the start line`);
            }
            const startPoint = pointAlong(line, unit, startS);
            await expectMachinePosition(startPoint, `side start "${p.label}"`, (m) => new ProcedureAbort(m));
            probeFeedService.setExpectedContact(['probe']);
            const travel = round3(p.travelMm - startS);
            const contact = travel > plan.march.fineStepMm
                ? await marchToContact(tag, p.label, startPoint, unit, travel, plan.march, announce)
                : null;
            if (contact) {
                contacts.push({ side: p.side, label: p.label, x: contact.point.x, y: contact.point.y, z: sideZ });
                restS = Math.max(0, round3(startS + contact.s - plan.sideStandoffMm));
            } else {
                contacts.push({ side: p.side, label: p.label, x: null, y: null, z: sideZ });
                announce(`no-contact-${p.label}`, `nothing within ${travel} mm of the start point - the face is not where the estimate says on this side`);
                restS = 0;
            }
            // Back off the face (or all the way to the start line after a
            // miss) - the probe may still be in contact, so keep it expected.
            await retreatAlong(tag, p.label, line, unit, restS);
            probeFeedService.clearExpectedContact();
            previous = p;
        }

        probeFeedService.clearExpectedContact();
        await moveMachineSettled(`${tag}:final-raise`, { z: plan.hopZ }, TRAVEL_FEED);
        const result = build(false);
        announce('outline-complete', result.note);
        return result;
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (probeAbortHeld((err as { partial?: object }).partial)) {
            announce('abort-held', 'contact during lift - holding even if the sensor subsequently releases');
        } else if (!isTrip) {
            try {
                await abortRaiseToTop(tag, (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            const Ctor = isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
            throw new Ctor(`Stock outline aborted: ${err.message} ${topSamples.length} top sample(s) and ${contacts.length} side march(es) so far are on the job record.`, build(true));
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
