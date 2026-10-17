/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (the plan builders take the
// probe_surface_path / probe_surface_grid arguments verbatim).
import { ObstacleBox, checkMotion, describeViolations, surfaceMotion } from './envelopeChecks';
import { mcpBroadcast } from './index';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import { steppedTraverseZ } from './march';
import { probeFeedService } from './probeFeed';
import { probeAbortHeld } from './programAbort';
import { ProbeCapturePlan, planProbeCapture } from './probeCapture';
import { captureProbeSpot } from './probeCaptureRuntime';
import { DESCENT_GUARD_MM } from './probeSequence';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    ProcedureStopped,
    TRAVEL_FEED,
    assertChannelReady,
    RECHECK_TOLERANCE_MM,
    DESCENT_SEGMENT_MM,
    assertMachineReadyForProcedure,
    descendInSegments,
    expectMachinePosition,
    knownMachinePosition,
    moveMachineSettled,
    marchInSegments,
    senseAfter,
    senseReleaseAfter,
    isProcedureAbort,
    isProcedureStopped,
    abortRaiseToTop,
} from './probing';
import {
    GPIO_SENSOR_DELAY_MS,
    HOP_LIFT_MM,
    MAX_DESCENT_BAND_MM,
    MAX_PROFILE_RADIUS_MM,
    MAX_TIP_RADIUS_MM,
    SURFACE_COARSE_STEP_MM,
    SURFACE_SLOW_ZONE_MM,
    clampReported,
    clampTo,
    releaseTimeoutFor,
    resolveMarchParams,
    within,
} from './procedureLimits';
import { McpToolError } from './registry';
import { probeGeometry } from './rotaryGeometry';
import { TipCalibrationSnapshot, projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import {
    CIRCLE_MAX_OFFSET_FRACTION,
    CircleProfile,
    ContactSample,
    HOP_SEGMENT_MM,
    MANY_STATIONS,
    SurfacePlanError,
    SurfaceStation,
    assertHopsWithin,
    buildZMatrix,
    circleExpectedZ,
    coarseStepFor,
    fitLine,
    fitPlane,
    hopSegments,
    planGridStations,
    planPathStations,
    renderHeightMap,
    renderPathProfile,
    resolveEnvelope,
    slowZoneFor,
    stationEnvelope,
    summarizeZ,
} from './surfaceScan';
import { assertWithinTravel, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

// Top-surface scans with the spindle touch probe: N stations along a line
// (probe_surface_path) or over a serpentine grid (probe_surface_grid), each
// measured with a -Z sensor-gated march using the hardware-proven
// coarse/release/fine/confirm mechanics of probe_vector / probe_sequence.
// One operator approval covers the whole circuit; the confirm page
// enumerates every commanded move with concrete numbers.
//
// THE LAW-2 EXCEPTION (operator-authorised, 2026-09-05). Motion law 2 says
// every XY move over 1 mm happens at the safe traverse height. The operator's
// words for these two procedures: "with the grid we need the point to point
// variation to not risk the probe toolhead so no more than 20mm z safe delta
// from the top (within a horizontal change of 60mm)". So, INSIDE THESE TWO
// PROCEDURES ONLY, between CONSECUTIVE stations only, and only while the
// horizontal hop is <= max_hop_mm (cap 60), the probe retracts to
// lastContactZ + z_safe_delta_mm (cap 20) and hops AT THAT HEIGHT instead of
// at the gantry. Nothing else inherits this: the approach to the FIRST
// station is a full law-2 traverse (raise to the safe traverse height, hop,
// guarded descent to the operator-stated start_z_machine), and the scan ends
// raised at the traverse height. Caps are enforced by refusal at staging
// (never clamped), the mechanics are enforced at runtime:
//
//   - hops run with NO expected contact, through moveMachineSettled (crash
//     guard armed), in sensor-checked segments of <= HOP_SEGMENT_MM so a
//     graze is caught within one segment: contact during a hop = collision.
//   - each march may search down to max(lastContact - max_drop_mm, the
//     plan's absolute floor); reaching the floor without contact records the
//     station as no_contact (not an abort) and leaves the reference height
//     at the last REAL contact. The first station finding nothing aborts -
//     there would be no measured reference to base the envelope on.

export type SurfaceScanKind = 'path' | 'grid';

export interface ProbeSurfacePlan {
    kind: SurfaceScanKind;
    tool: 'probe_surface_path' | 'probe_surface_grid';
    stations: SurfaceStation[];
    capture: ProbeCapturePlan | null;
    /** Operator-stated toolhead machine Z at which the FIRST march starts (tip just above the surface). */
    startZMachine: number;
    /** Deepest toolhead Z any march may ever command (default start_z - max_drop). */
    absoluteFloorZ: number;
    zSafeDeltaMm: number;
    maxHopMm: number;
    maxDropMm: number;
    /** Largest consecutive-station distance in this plan (already verified <= maxHopMm). */
    worstHopMm: number;
    /** Safe traverse height: approach to station 1 and the final raise. */
    hopZ: number;
    staged: { x: number; y: number; z: number };
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
    confirmationMode: 'fixed' | 'adaptive';
    confirmationToleranceMm: number | null;
    /** Coarse steps stop this far above the expected contact and fine steps take over (caps the press at one fine step). */
    slowZoneMm: number;
    /** Longest fast segment of the approach to station 1 (DESCENT_SEGMENT_MM; #166: lowered per call with descent_segment_mm). */
    descentSegmentMm: number;
    /** What the call asked for when it differs from descentSegmentMm (the clip is reported on the page). */
    descentSegmentRequestedMm: number | null;
    /** Expected contact Z for station 1 (a measured neighbour); null = coarse capped at 1 mm there. */
    expectedZMachine: number | null;
    /** floor_z_machine was given explicitly: station 1 may search down to it (not just start_z - max_drop). */
    floorExplicit: boolean;
    /**
     * Expected contact PROFILE (mcp/48): per-station expected Z from a model
     * of the surface (a cylinder along the rotary axis) instead of the
     * previous station - the slow zone and the max_drop band follow the model.
     */
    profile: CircleProfile | null;
    /**
     * How the probe travels between stations (mcp/48, operator 2026-09-06):
     * 'guarded' (default) hops at last contact + z_safe_delta expecting NO
     * contact (a contact aborts); 'stepped' travels at last contact +
     * hop_lift_mm as a touch-probing traverse - a contact backs off, lifts
     * hop_lift_mm and continues, so the height follows the surface in steps
     * (gentle slope or the wall of a hole) instead of a fixed clearance.
     */
    hopMode: 'guarded' | 'stepped';
    hopLiftMm: number;
    /** Staged ball-radius limit for extra retreat along verified incoming paths. */
    hopBackoffMm: number;
    path?: {
        start: { x: number; y: number };
        end: { x: number; y: number };
        unit: { x: number; y: number };
        lengthMm: number;
        spacingMm: number;
    };
    grid?: {
        xs: number[];
        ys: number[];
        pitchXMm: number;
        pitchYMm: number;
        bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
    };
}

interface CommonArgs {
    capture?: unknown;
    start_z_machine?: unknown;
    floor_z_machine?: unknown;
    z_safe_delta_mm?: unknown;
    max_hop_mm?: unknown;
    max_drop_mm?: unknown;
    coarse_step_mm?: number;
    fine_step_mm?: number;
    backoff_mm?: number;
    sensor_delay_ms?: number;
    confirm_passes?: number;
    confirmation_mode?: unknown;
    confirmation_tolerance_mm?: unknown;
    slow_zone_mm?: number;
    descent_segment_mm?: unknown;
    expected_z_machine?: unknown;
    expected_profile?: unknown;
    hop_mode?: unknown;
    hop_lift_mm?: unknown;
}

/** Surface-only policy; other probe tools retain their existing repeat counts. */
export function resolveSurfaceConfirmation(args: Pick<CommonArgs, 'confirmation_mode' | 'confirmation_tolerance_mm'>): {
    confirmationMode: 'fixed' | 'adaptive'; confirmationToleranceMm: number | null;
} {
    const mode = args.confirmation_mode === undefined ? 'fixed' : args.confirmation_mode;
    if (mode !== 'fixed' && mode !== 'adaptive') {
        throw new McpToolError('confirmation_mode must be "fixed" or "adaptive".');
    }
    const tolerance = args.confirmation_tolerance_mm;
    if (mode === 'adaptive' && (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 1)) {
        throw new McpToolError('Adaptive confirmation requires confirmation_tolerance_mm > 0 and <= 1 (an explicit height-change and retouch-agreement threshold).');
    }
    if (mode === 'fixed' && tolerance !== undefined) {
        throw new McpToolError('confirmation_tolerance_mm is only used with confirmation_mode "adaptive".');
    }
    return { confirmationMode: mode, confirmationToleranceMm: mode === 'adaptive' ? tolerance as number : null };
}

function toToolError<T>(fn: () => T): T {
    try {
        return fn();
    } catch (err) {
        if (err instanceof SurfacePlanError) {
            throw new McpToolError(err.message);
        }
        throw err;
    }
}

/**
 * expected_profile: { circle: { center_x, center_z_contact, radius, tip_radius? } }
 * - a cylinder along machine Y. Every station must lie within 0.7 R of the
 * axis (contact angle <= ~45 deg) and its expected Z inside the march window.
 */
function parseProfile(raw: unknown, stations: SurfaceStation[], startZ: number, floorZ: number): CircleProfile | null {
    if (raw === undefined || raw === null) {
        return null;
    }
    const circle = (raw as { circle?: unknown }).circle as { [k: string]: unknown } | undefined;
    if (!circle || typeof circle !== 'object') {
        throw new McpToolError('expected_profile must be {circle: {center_x, center_z_contact, radius, tip_radius?}}.');
    }
    const centerX = Number(circle.center_x);
    const centerZ = Number(circle.center_z_contact);
    const radius = Number(circle.radius);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerZ) || !Number.isFinite(radius) || radius <= 0 || radius > MAX_PROFILE_RADIUS_MM) {
        throw new McpToolError('expected_profile.circle needs finite center_x, center_z_contact (toolhead Z with the tip on the axis) '
            + `and radius (0-${MAX_PROFILE_RADIUS_MM}).`);
    }
    let tipRadius: number;
    if (circle.tip_radius !== undefined) {
        tipRadius = Number(circle.tip_radius);
        if (!Number.isFinite(tipRadius) || tipRadius < 0 || tipRadius > MAX_TIP_RADIUS_MM) {
            throw new McpToolError(`expected_profile.circle.tip_radius must be 0-${MAX_TIP_RADIUS_MM} mm.`);
        }
    } else {
        const geometry = probeGeometry();
        tipRadius = geometry && geometry.tipDiameter !== null ? geometry.tipDiameter / 2 : 0;
    }
    const profile: CircleProfile = { kind: 'circle', centerX, centerZContact: centerZ, radius, tipRadius };
    for (const st of stations) {
        const z = circleExpectedZ(profile, st.x);
        if (z === null) {
            throw new McpToolError(`Station ${st.label} (X${st.x}) lies more than ${CIRCLE_MAX_OFFSET_FRACTION} x radius from the cylinder axis `
                + `X${centerX} - the tip would glance off the curve (contact angle > 45 deg). Shorten the path.`);
        }
        if (z > startZ + 1e-9 || z < floorZ - 1e-9) {
            throw new McpToolError(`Station ${st.label}: the circle profile expects contact at Z${z}, outside the march window `
                + `floor Z${floorZ.toFixed(3)} .. start Z${startZ.toFixed(3)}.`);
        }
    }
    return profile;
}

/** Everything both scans share once the stations exist. */
function finishPlan(
    kind: SurfaceScanKind,
    stations: SurfaceStation[],
    args: CommonArgs,
    extraObstacles: ObstacleBox[] = []
): Omit<ProbeSurfacePlan, 'path' | 'grid'> {
    const env = toToolError(() => resolveEnvelope(args));
    const worstHopMm = toToolError(() => assertHopsWithin(stations, env.maxHopMm));

    const hopZ = safeTraverseZ();
    // The first approach's fast segment length (#166): the 5 mm default or
    // the shorter length the call states, a clip reported on the page.
    const descentSegment = clampReported(args.descent_segment_mm, DESCENT_SEGMENT_MM);
    const startZ = Number(args.start_z_machine);
    if (args.start_z_machine === undefined || !Number.isFinite(startZ)) {
        throw new McpToolError('start_z_machine is REQUIRED: the toolhead machine Z at which the first -Z march '
            + 'starts, with the probe tip just above the surface - a measured or operator-stated number, never a guess.');
    }
    if (startZ <= 0 || startZ > hopZ) {
        throw new McpToolError(`start_z_machine ${startZ} must be in 0..${hopZ} (the safe traverse height).`);
    }
    const floorZ = args.floor_z_machine === undefined ? startZ - env.maxDropMm : Number(args.floor_z_machine);
    if (!Number.isFinite(floorZ) || floorZ < 0) {
        throw new McpToolError('floor_z_machine must be a finite machine Z >= 0.');
    }
    if (floorZ >= startZ) {
        throw new McpToolError(`floor_z_machine ${floorZ} must be below start_z_machine ${startZ}.`);
    }
    if (startZ - floorZ > MAX_DESCENT_BAND_MM) {
        throw new McpToolError(`start_z_machine - floor_z_machine = ${(startZ - floorZ).toFixed(1)} mm exceeds ${MAX_DESCENT_BAND_MM} mm.`);
    }

    const position = getPositionSnapshot();
    assertWithinTravel(
        stations.map((st) => ({ label: `Station ${st.label}`, x: st.x, y: st.y })),
        requirePlanningTravel('a surface scan', { x: position.machine.x, y: position.machine.y })
    );
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the scan.');
    }

    let expectedZ: number | null = null;
    if (args.expected_z_machine !== undefined && args.expected_z_machine !== null && args.expected_z_machine !== '') {
        expectedZ = Number(args.expected_z_machine);
        if (!Number.isFinite(expectedZ)) {
            throw new McpToolError('expected_z_machine must be a number (toolhead machine Z of a measured neighbouring contact).');
        }
        if (expectedZ > startZ + 1e-9 || expectedZ < floorZ - 1e-9) {
            throw new McpToolError(`expected_z_machine ${expectedZ} must lie between floor_z_machine ${floorZ.toFixed(3)} and start_z_machine ${startZ.toFixed(3)}.`);
        }
        expectedZ = Number(expectedZ.toFixed(3));
    }

    const confirmation = resolveSurfaceConfirmation(args);
    const profile = parseProfile(args.expected_profile, stations, startZ, floorZ);
    const hopMode = args.hop_mode === undefined || args.hop_mode === null || args.hop_mode === '' ? 'guarded' : String(args.hop_mode);
    if (hopMode !== 'guarded' && hopMode !== 'stepped') {
        throw new McpToolError('hop_mode must be "guarded" (hop at last contact + z_safe_delta, contact aborts) or "stepped" (touch-probing traverse that lifts on contact).');
    }
    const hopLiftMm = args.hop_lift_mm === undefined ? HOP_LIFT_MM.default : Number(args.hop_lift_mm);
    if (!within(hopLiftMm, HOP_LIFT_MM)) {
        throw new McpToolError(`hop_lift_mm must be ${HOP_LIFT_MM.min}-${HOP_LIFT_MM.max}.`);
    }

    // Law 4 (mcp/48): station-1 descent, every hop at its lowest possible
    // height (floor + z_safe_delta) and every march column down to the floor
    // are checked against obstacle landmarks and the program's keep-out boxes.
    const violations = checkMotion(
        surfaceMotion({ hopZ, absoluteFloorZ: floorZ, zSafeDeltaMm: hopMode === 'stepped' ? hopLiftMm : env.zSafeDeltaMm, hopMode, stations }),
        [...landmarkStore.obstacleBoxes(), ...extraObstacles],
        { traverseZ: hopZ, ...clearanceOptions() }
    );
    if (violations.length) {
        throw new McpToolError(`Scan refused (law 4, landmarks are obstacles): ${describeViolations(violations)}. `
            + 'Raise floor_z_machine, shorten the path / grid, or have the operator adjust the landmark.');
    }

    return {
        kind,
        tool: kind === 'path' ? 'probe_surface_path' : 'probe_surface_grid',
        stations,
        capture: planProbeCapture(args.capture, stations.length),
        startZMachine: Number(startZ.toFixed(3)),
        absoluteFloorZ: Number(floorZ.toFixed(3)),
        zSafeDeltaMm: env.zSafeDeltaMm,
        maxHopMm: env.maxHopMm,
        maxDropMm: env.maxDropMm,
        worstHopMm,
        hopZ,
        staged: { x, y, z },
        // Operator (2026-09-05, job cdbc29371b97): never 2 mm. The surface
        // scans floor the coarse step at 0.5 and run on the GPIO transport's
        // 30 ms sensor floor - both named, with their reasons, in
        // procedureLimits.ts.
        ...resolveMarchParams(args, { coarse: SURFACE_COARSE_STEP_MM, delay: GPIO_SENSOR_DELAY_MS }),
        ...confirmation,
        slowZoneMm: clampTo(args.slow_zone_mm, { ...SURFACE_SLOW_ZONE_MM, max: env.zSafeDeltaMm }),
        descentSegmentMm: descentSegment.value,
        descentSegmentRequestedMm: descentSegment.clipped ? descentSegment.requested : null,
        expectedZMachine: profile && expectedZ === null ? circleExpectedZ(profile, stations[0].x) : expectedZ,
        floorExplicit: args.floor_z_machine !== undefined && args.floor_z_machine !== null && args.floor_z_machine !== '',
        profile,
        hopMode,
        hopLiftMm,
        hopBackoffMm: Math.max(0, Math.min(MAX_TIP_RADIUS_MM, (probeGeometry()?.tipDiameter || 0) / 2)),
    };
}


export function planProbeSurfacePath(args: CommonArgs & {
    start_x?: unknown;
    start_y?: unknown;
    end_x?: unknown;
    end_y?: unknown;
    dx?: unknown;
    dy?: unknown;
    length_mm?: unknown;
    stations?: unknown;
    spacing_mm?: unknown;
}, extraObstacles: ObstacleBox[] = []): ProbeSurfacePlan {
    const path = toToolError(() => planPathStations({
        start_x: args.start_x,
        start_y: args.start_y,
        end_x: args.end_x,
        end_y: args.end_y,
        dx: args.dx,
        dy: args.dy,
        length_mm: args.length_mm,
        stations: args.stations,
        spacing_mm: args.spacing_mm,
    }));
    return {
        ...finishPlan('path', path.stations, args, extraObstacles),
        path: { start: path.start, end: path.end, unit: path.unit, lengthMm: path.lengthMm, spacingMm: path.spacingMm },
    };
}

export function planProbeSurfaceGrid(args: CommonArgs & {
    x_min?: unknown;
    x_max?: unknown;
    y_min?: unknown;
    y_max?: unknown;
    center_x?: unknown;
    center_y?: unknown;
    size_x_mm?: unknown;
    size_y_mm?: unknown;
    pitch_mm?: unknown;
    x_count?: unknown;
    y_count?: unknown;
}, extraObstacles: ObstacleBox[] = []): ProbeSurfacePlan {
    const grid = toToolError(() => planGridStations(args));
    return {
        ...finishPlan('grid', grid.stations, args, extraObstacles),
        grid: { xs: grid.xs, ys: grid.ys, pitchXMm: grid.pitchXMm, pitchYMm: grid.pitchYMm, bounds: grid.bounds },
    };
}

/** Confirm-page gcode: the whole scan, every commanded move enumerated with its bounds. */
export function describeProbeSurfacePlanAsGcode(plan: ProbeSurfacePlan): string {
    const n = plan.stations.length;
    const first = plan.stations[0];
    let shape = `${n} stations`;
    if (plan.kind === 'path' && plan.path) {
        shape = `${n} stations along (${plan.path.start.x}, ${plan.path.start.y}) -> (${plan.path.end.x}, ${plan.path.end.y}), `
            + `spacing ${plan.path.spacingMm} mm`;
    } else if (plan.grid) {
        shape = `${plan.grid.xs.length} x ${plan.grid.ys.length} = ${n} stations, pitch X ${plan.grid.pitchXMm} / Y ${plan.grid.pitchYMm} mm, `
            + `X ${plan.grid.bounds.xMin}..${plan.grid.bounds.xMax}, Y ${plan.grid.bounds.yMin}..${plan.grid.bounds.yMax}, serpentine`;
    }
    const firstEnv = stationEnvelope(plan.startZMachine, true, plan.startZMachine, {
        zSafeDeltaMm: plan.zSafeDeltaMm, maxDropMm: plan.maxDropMm, absoluteFloorZ: plan.absoluteFloorZ,
    });
    if (plan.floorExplicit) {
        // Station 1 searches to the explicit floor (runner: stationFloorZ).
        firstEnv.floorZ = plan.absoluteFloorZ;
        firstEnv.travelMm = Number((firstEnv.marchStartZ - plan.absoluteFloorZ).toFixed(3));
    }
    // The guarded descent starts at min(start_z + guard, traverse height): the
    // runner never commands a Z above the height it is already at.
    const guardTop = Math.min(plan.startZMachine + DESCENT_GUARD_MM, plan.hopZ);
    const localLift = plan.hopMode === 'stepped' ? plan.hopLiftMm : plan.zSafeDeltaMm;
    const confirmationText = plan.confirmationMode === 'adaptive'
        ? `adaptive: routine fine contact is single-touch; first station, after a miss, coarse contact, link contact or height change > ${plan.confirmationToleranceMm} mm gets one release-verified retouch; disagreement > ${plan.confirmationToleranceMm} mm stops with uncertain evidence`
        : `${plan.confirmPasses} EXTRA lift-and-retest pass(es) after initial fine contact, median of extra passes`;
    const lines = [
        `; SURFACE ${plan.kind.toUpperCase()} SCAN: ${shape}`,
        '; every station = a -Z sensor-gated march on the probe channel (coarse towards the expected contact,',
        `; ${plan.fineStepMm} mm fine steps inside the SLOW ZONE); ${confirmationText}; all coordinates MACHINE frame.`,
        `; SLOW ZONE (slow_zone_mm ${plan.slowZoneMm}): coarse steps stop ${plan.slowZoneMm} mm ABOVE the expected contact (the previous`,
        `;   station's contact; expected_z_machine ${plan.expectedZMachine === null ? 'not given' : `Z${plan.expectedZMachine}`} for station 1) and`,
        `;   ${plan.fineStepMm} mm steps take over down to ${(plan.slowZoneMm + 2 * plan.coarseStepMm).toFixed(1)} mm BELOW it (coarse resumes below that).`,
        `;   Worst press into the probe: ${plan.fineStepMm} mm where the surface lies in the zone; one coarse step (${plan.coarseStepMm} mm)`,
        `;   where it is higher; station 1 without expected_z_machine uses ${coarseStepFor(plan, plan.expectedZMachine !== null)} mm coarse steps (cap 1).`,
        ...(plan.hopMode === 'stepped' ? [
            `; HOP MODE stepped: extra backoff up to ${plan.hopBackoffMm} mm (one stored ball radius), only along verified same-height incoming path; lifts are sensor-checked every 0.5 mm.`,
            `; HOP MODE stepped: between stations the probe travels at last contact + ${plan.hopLiftMm} mm as a TOUCH-PROBING traverse (1 mm steps, F300,`,
            `;   probe expected): a contact backs off the actual link step (up to 1 mm), lifts ${plan.hopLiftMm} mm and continues - the height follows the surface in steps (never above Z${plan.hopZ}).`,
        ] : []),
        ...(plan.profile ? [
            `; EXPECTED PROFILE: cylinder along machine Y, axis X${plan.profile.centerX}, tip-on-axis Z${plan.profile.centerZContact}, radius ${plan.profile.radius}`
                + ` (tip radius ${plan.profile.tipRadius}); every station's slow zone and max_drop band follow the model, not the previous station:`,
            `;   ${plan.stations.map((st) => `${st.label} Z${circleExpectedZ(plan.profile as CircleProfile, st.x)}`).join(', ')}`,
        ] : []),
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)})`
            + ' - re-verified before any motion, and before EVERY march',
        ';',
        '; ENVELOPE (operator, 2026-09-05: "no more than 20mm z safe delta from the top (within a horizontal',
        '; change of 60mm)") - the operator-authorised EXCEPTION to motion law 2, valid ONLY inside this',
        '; procedure, ONLY between consecutive stations, ONLY for hops <= max_hop_mm:',
        `;   * between stations the probe retracts to LAST CONTACT + ${localLift} mm and verifies release before linking.`,
        ...(plan.hopMode === 'guarded' ? [
            `;     guarded links use <= ${HOP_SEGMENT_MM} mm segments (crash guard armed); contact latches CRASH.`,
        ] : [';     stepped links use <= 1 mm contact-aware segments, verified backoff and 0.5 mm checked lifts; contact during lift holds.']),
        `;   * largest hop in this plan: ${plan.worstHopMm} mm (max_hop_mm ${plan.maxHopMm}, cap 60) - refused at staging otherwise.`,
        `;   * each march searches from the hop height down to max(last contact - ${plan.maxDropMm} mm, FLOOR Z${plan.absoluteFloorZ});`,
        ';     nothing by the floor = station recorded no_contact, reference height unchanged, scan continues',
        ';     (the FIRST station finding nothing aborts - no measured reference).',
        `;   * the deepest toolhead Z this scan can EVER command is Z${plan.absoluteFloorZ} (floor_z_machine).`,
        '; The approach to station 1 and the final raise are full law-2 moves at the traverse height.',
        ...(plan.descentSegmentRequestedMm === null ? [] : [
            `; CLAMPED: descent_segment_mm ${plan.descentSegmentRequestedMm} is outside ${DESCENT_SEGMENT_MM.min}-${DESCENT_SEGMENT_MM.max} - the approach uses ${plan.descentSegmentMm} mm segments`,
        ]),
        ...(plan.stations.length > MANY_STATIONS
            ? [`; WARNING: ${plan.stations.length} stations; duration depends on links, approaches and confirmations. Use prior result.timing; `
                + `rough program estimate ${40 + plan.stations.length * 120} job events before captures (the stored result is never trimmed).`]
            : []),
        '; overtravel feed trips -> job stop + connection close + latched alarm',
        'G90',
        'G53;',
        `G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the safe traverse height (law 2)`,
        `G1 X${first.x.toFixed(3)} Y${first.y.toFixed(3)} F${TRAVEL_FEED}; hop at gantry height to station 1 "${first.label}"`,
        `G1 Z${guardTop.toFixed(3)} F${TRAVEL_FEED}; descend to ${(guardTop - plan.startZMachine).toFixed(1)} mm above start_z_machine in <= ${plan.descentSegmentMm} mm segments (crash guard armed)`,
        '; ...guarded final approach: 1 mm steps, sensor-checked after each - ANY contact here aborts (CRASH).',
    ];
    for (let gz = guardTop - 1; gz > plan.startZMachine - 1e-9; gz -= 1) {
        lines.push(`G1 Z${Math.max(gz, plan.startZMachine).toFixed(3)} F${COARSE_FEED}; guarded descent step`);
    }
    lines.push(`; --- station 1 "${first.label}" (${first.x}, ${first.y}): march -Z from Z${firstEnv.marchStartZ} to floor Z${firstEnv.floorZ} ---`);
    const firstCoarse = coarseStepFor(plan, plan.expectedZMachine !== null);
    const firstZone = slowZoneFor(firstEnv.marchStartZ, plan.expectedZMachine, plan.slowZoneMm, plan.coarseStepMm, firstEnv.travelMm);
    let s = 0;
    let k = 0;
    while (firstEnv.travelMm - s > 1e-9) {
        if (firstZone && s >= firstZone.topS - 1e-9 && s < firstZone.bottomS - 1e-9) {
            lines.push(`; ...slow zone Z${(firstEnv.marchStartZ - firstZone.topS).toFixed(3)} -> Z${(firstEnv.marchStartZ - firstZone.bottomS).toFixed(3)}: `
                + `${plan.fineStepMm} mm steps at F${FINE_FEED}, check probe after each`);
            s = firstZone.bottomS;
            continue;
        }
        let next = Math.min(s + firstCoarse, firstEnv.travelMm);
        if (firstZone && s < firstZone.topS - 1e-9 && next > firstZone.topS + 1e-9) {
            next = firstZone.topS;
        }
        s = next;
        k += 1;
        lines.push(`G1 Z${(firstEnv.marchStartZ - s).toFixed(3)} F${COARSE_FEED}; coarse ${k} - settle, check probe, stop at contact`);
    }
    lines.push(`; ...on coarse contact: release, ${plan.fineStepMm} mm fine approach; ${confirmationText} (confirmation backoff ${plan.backoffMm} mm, release required)`);
    lines.push(`; retract to contact + ${localLift} mm (runtime number, never above Z${plan.hopZ})`);
    for (let i = 1; i < n; i++) {
        const prev = plan.stations[i - 1];
        const st = plan.stations[i];
        lines.push(`; --- station ${i + 1} "${st.label}" (${st.x}, ${st.y}): hop ${st.hopFromPreviousMm} mm at Z = last contact + ${localLift} ---`);
        if (plan.hopMode === 'stepped') {
            lines.push(`; touch-probing link to X${st.x.toFixed(3)} Y${st.y.toFixed(3)}: <= 1 mm steps F300, release-verified backoff and checked lifts on contact`);
        } else {
            const segs = hopSegments({ x: prev.x, y: prev.y }, { x: st.x, y: st.y });
            segs.forEach((seg, j) => {
                lines.push(`G1 X${seg.x.toFixed(3)} Y${seg.y.toFixed(3)} F${TRAVEL_FEED}; hop segment ${j + 1}/${segs.length} - settle, probe must NOT be in contact`);
            });
        }
        lines.push(`; march -Z in ${plan.coarseStepMm} mm steps from the hop height to last contact + ${plan.slowZoneMm}, then ${plan.fineStepMm} mm steps `
            + `through the slow zone; coarse again below it to max(last contact - ${plan.maxDropMm}, Z${plan.absoluteFloorZ})`);
        lines.push(`G1 Z${plan.absoluteFloorZ.toFixed(3)} F${COARSE_FEED}; deepest allowed at this station (absolute floor) - no contact by here = no_contact`);
        lines.push(`; ...on contact: ${confirmationText}; retract to contact + ${localLift} mm and verify release`);
    }
    lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (on abort: raise only if recovery is not held and sensors permit)`);
    if (plan.capture) {
        lines.push(`; CAMERA: stationary at stations ${plan.capture.stations?.join(', ')}, after final contact (or no-contact floor), BEFORE retract; settle ${plan.capture.settleMs} ms. Camera failures are recorded; motion then retreats normally.`);
    }
    lines.push('G54;');
    return lines.join('\n');
}

export interface SurfaceStationResult {
    index: number;
    label: string;
    x: number;
    y: number;
    s?: number;
    row?: number;
    col?: number;
    status: 'contact' | 'no_contact' | 'uncertain';
    /** Accepted toolhead machine Z at contact (null when no_contact or uncertain). */
    z: number | null;
    marchStartZ: number;
    floorZ: number;
    confirmPassContacts?: number[];
    spreadMm?: number | null;
    initialContactZ?: number;
    finalContactZ?: number;
    confirmationReasons?: string[];
    extraPassCount?: number;
    confirmationPassesAttempted?: number;
    confirmationFailure?: 'release-failed' | 'contact-lost';
    /** How the contact was found: fine steps inside the slow zone, or a coarse step (then release + fine). */
    approach?: 'slow-zone' | 'coarse-contact';
    /** Upper bound on how far the probe was pressed past contact by the step that found it. */
    worstPressMm?: number;
    capture?: object;
}

type MarchOutcome = {
    contactZ: number; passContacts: number[]; spreadMm: number | null;
    initialContactZ: number; finalContactZ: number; confirmationReasons: string[]; accepted: boolean;
    approach: 'slow-zone' | 'coarse-contact'; worstPressMm: number;
};

/**
 * One -Z march from startZ down to floorZ at the station's XY: the exact
 * probe_vector / probe_sequence mechanics along the -Z unit vector, except
 * that reaching the floor without contact RETURNS null instead of aborting
 * (a surface scan must record a missing station and carry on).
 */
async function marchDownZ(
    plan: ProbeSurfacePlan,
    station: SurfaceStation,
    startZ: number,
    floorZ: number,
    expectedContactZ: number | null,
    contextReasons: string[],
    recordUncertain: (result: SurfaceStationResult) => void,
    announce: (phase: string, note?: string) => void
): Promise<MarchOutcome | null> {
    const travel = Number((startZ - floorZ).toFixed(3));
    const releaseTimeoutMs = releaseTimeoutFor(plan.sensorDelayMs);
    const zAt = (s: number) => Number((startZ - s).toFixed(3));
    const move = async (tool: string, s: number, feed: number) => {
        await moveMachineSettled(tool, { z: zAt(s) }, feed);
    };
    const tag = `${plan.tool}:${station.label}`;
    const coarseStep = coarseStepFor(plan, expectedContactZ !== null);
    const zone = slowZoneFor(startZ, expectedContactZ, plan.slowZoneMm, plan.coarseStepMm, travel);
    if (zone) {
        announce(`slow-zone-${station.label}`, `fine ${plan.fineStepMm} mm steps between Z${zAt(zone.topS)} and Z${zAt(zone.bottomS)} `
            + `(expected contact Z${expectedContactZ} +${plan.slowZoneMm} / -${(plan.slowZoneMm + 2 * plan.coarseStepMm).toFixed(1)}); coarse ${coarseStep} mm elsewhere`);
    } else {
        announce(`coarse-ladder-${station.label}`, `${coarseStep} mm steps to contact (no expected contact to bound the press)`);
    }
    const inZone = (sv: number) => zone !== null && sv >= zone.topS - 1e-9 && sv < zone.bottomS - 1e-9;

    let s = 0;
    let coarseContactS: number | null = null;
    let fineContactS: number | null = null;
    while (travel - s > 1e-9) {
        const fine = inZone(s);
        let next: number;
        if (fine) {
            next = Math.min(s + plan.fineStepMm, travel, (zone as { bottomS: number }).bottomS);
        } else {
            next = Math.min(s + coarseStep, travel);
            if (zone && s < zone.topS - 1e-9 && next > zone.topS + 1e-9) {
                next = zone.topS; // a coarse step never crosses into the slow zone
            }
        }
        // The step is the logical advance; the physical moves are
        // <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts). A fine step
        // is already below that and goes as one.
        const advance = await marchInSegments(
            async (v) => move(fine ? `${tag}:fine` : `${tag}:coarse`, v, fine ? FINE_FEED : COARSE_FEED),
            s, next, 'probe', plan.sensorDelayMs
        );
        s = advance.s;
        const sensed = advance.sensed;
        if (sensed.contact) {
            if (fine) {
                fineContactS = s;
                announce(`fine-contact-${station.label}`, `Z${zAt(s)} inside the slow zone (press <= ${plan.fineStepMm} mm)`);
            } else {
                coarseContactS = s;
                announce(`coarse-contact-${station.label}`, `Z${zAt(s)} (press <= ${coarseStep} mm)`);
            }
            break;
        }
    }
    if (coarseContactS === null && fineContactS === null) {
        return null;
    }
    const approach: 'slow-zone' | 'coarse-contact' = fineContactS !== null ? 'slow-zone' : 'coarse-contact';
    const worstPressMm = fineContactS !== null ? plan.fineStepMm : coarseStep;
    if (fineContactS === null) {
        // Coarse contact (surface above the slow zone, or no zone): release
        // by coarse steps until the probe reads clear, then fine-step back.
        const contactS = coarseContactS as number;
        let released = false;
        while (s > 1e-9 && contactS - s < MAX_RETREAT_MM + 1e-9) {
            const t0 = Date.now();
            s = Math.max(s - coarseStep, 0);
            await move(`${tag}:release`, s, COARSE_FEED);
            const sensed = await senseReleaseAfter('probe', t0, releaseTimeoutMs);
            if (!sensed.contact) {
                released = true;
                break;
            }
        }
        if (!released) {
            throw new ProcedureAbort(`Station "${station.label}": probe still triggered ${MAX_RETREAT_MM} mm back from first contact - stuck probe or feed fault.`);
        }
        while (travel - s > 1e-9) {
            const t0 = Date.now();
            s = Math.min(s + plan.fineStepMm, travel);
            await move(`${tag}:fine`, s, FINE_FEED);
            const sensed = await senseAfter('probe', t0, plan.sensorDelayMs);
            if (sensed.contact) {
                fineContactS = s;
                break;
            }
        }
        if (fineContactS === null) {
            throw new ProcedureAbort(`Station "${station.label}": fine approach lost the contact.`);
        }
    }
    const initialContactZ = zAt(fineContactS);
    const adaptive = plan.confirmationMode === 'adaptive';
    const confirmationReasons = adaptive ? [...contextReasons] : ['fixed'];
    if (adaptive && approach === 'coarse-contact') {
        confirmationReasons.push('coarse-contact');
    }
    if (adaptive && (expectedContactZ === null || Math.abs(initialContactZ - expectedContactZ) > (plan.confirmationToleranceMm as number) + 1e-9)) {
        confirmationReasons.push(expectedContactZ === null ? 'no-expected-height' : 'height-change');
    }
    // A routine fine observation needs no retouch. Any uncertainty earns ONE
    // released retouch; disagreement is exposed, never hidden by a median.
    const adaptivePasses = confirmationReasons.length ? 1 : 0;
    const passes = adaptive ? adaptivePasses : plan.confirmPasses;
    const passContacts: number[] = [];
    const failConfirmation = (failure: 'release-failed' | 'contact-lost', pass: number, message: string): never => {
        // Retain the observation without accepting it or changing abort motion.
        // A failed release/retouch must reach the existing held-contact recovery.
        recordUncertain({
            ...station,
            status: 'uncertain',
            z: null,
            marchStartZ: startZ,
            floorZ,
            initialContactZ,
            confirmPassContacts: [...passContacts],
            spreadMm: null,
            confirmationReasons,
            extraPassCount: passContacts.length,
            confirmationPassesAttempted: pass,
            confirmationFailure: failure,
            approach,
            worstPressMm,
        });
        throw new ProcedureAbort(message);
    };
    const cycleLimit = Math.min(fineContactS + Math.max(0.5, plan.backoffMm), travel);
    let reference = fineContactS;
    for (let pass = 1; pass <= passes; pass++) {
        const t0 = Date.now();
        s = Math.max(reference - plan.backoffMm, 0);
        await move(`${tag}:backoff`, s, FINE_FEED);
        const lifted = await senseReleaseAfter('probe', t0, releaseTimeoutMs);
        if (lifted.contact) {
            failConfirmation('release-failed', pass, `Station "${station.label}": hysteresis exceeds the backoff ${plan.backoffMm} mm.`);
        }
        let passContact: number | null = null;
        while (cycleLimit - s > 1e-9) {
            const t1 = Date.now();
            s = Math.min(s + plan.fineStepMm, cycleLimit);
            await move(`${tag}:confirm`, s, FINE_FEED);
            const sensed = await senseAfter('probe', t1, plan.sensorDelayMs);
            if (sensed.contact) {
                passContact = s;
                break;
            }
        }
        if (passContact === null) {
            return failConfirmation('contact-lost', pass, `Station "${station.label}": confirm pass ${pass} lost the contact.`);
        }
        passContacts.push(zAt(passContact));
        reference = passContact;
    }
    const observations = [initialContactZ, ...passContacts];
    const sorted = [...(adaptive ? observations : passContacts)].sort((a, b) => a - b);
    const contactZ = adaptive ? observations[observations.length - 1] : sorted[Math.floor((sorted.length - 1) / 2)];
    const spreadMm = sorted.length > 1 || !adaptive ? Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3)) : null;
    const accepted = !adaptive || spreadMm === null || spreadMm <= (plan.confirmationToleranceMm as number) + 1e-9;
    return { contactZ,
        passContacts,
        spreadMm,
        initialContactZ,
        finalContactZ: observations[observations.length - 1],
        confirmationReasons,
        accepted,
        approach,
        worstPressMm };
}

/** Structured procedure result (lands on job.result): stations, statistics, renderings. */
function buildResult(
    plan: ProbeSurfacePlan, results: SurfaceStationResult[], phases: { phase: string; note?: string }[], tipCalibration: TipCalibrationSnapshot
): object {
    const contacts: ContactSample[] = results
        .filter((r): r is SurfaceStationResult & { z: number } => r.z !== null)
        .map((r) => ({ x: r.x, y: r.y, z: r.z, s: r.s, label: r.label }));
    const summary = summarizeZ(contacts);
    const noContact = results.filter((r) => r.status === 'no_contact').map((r) => r.label);
    const worstSpread = Math.max(0, ...results.map((r) => r.spreadMm || 0));
    const common = {
        kind: plan.kind,
        tool: plan.tool,
        tipCalibration,
        stations: results.map((r) => ({ ...r, ...projectToolTipZ(r.z, tipCalibration) })),
        contactCount: contacts.length,
        noContactStations: noContact,
        uncertainStations: results.filter((r) => r.status === 'uncertain').map((r) => r.label),
        confirmation: { mode: plan.confirmationMode || 'fixed',
            toleranceMm: plan.confirmationToleranceMm ?? null,
            extraPassesWhenRequired: plan.confirmationMode === 'adaptive' ? 1 : plan.confirmPasses,
            singleTouchCount: results.filter((r) => r.status === 'contact' && r.extraPassCount === 0).length },
        summary,
        worstConfirmSpreadMm: Number(worstSpread.toFixed(3)),
        profile: plan.profile,
        envelope: {
            hopMode: plan.hopMode,
            hopLiftMm: plan.hopLiftMm,
            zSafeDeltaMm: plan.zSafeDeltaMm,
            maxHopMm: plan.maxHopMm,
            worstHopMm: plan.worstHopMm,
            maxDropMm: plan.maxDropMm,
            absoluteFloorZ: plan.absoluteFloorZ,
            startZMachine: plan.startZMachine,
        },
        coordinateNote: 'Station z and fits retain raw TOOLHEAD machine Z. tipMachineZ is a separate tip-bottom projection '
            + 'using the captured tipCalibration; conventional or unknown provenance is not physically verified geometry.',
        phases,
        warning: worstSpread > plan.fineStepMm + 1e-9
            ? `Worst confirm spread ${worstSpread.toFixed(3)} mm exceeds one fine step - feed timing was unstable; `
                + 'consider more confirm_passes or a longer sensor_delay_ms.'
            : undefined,
    };
    if (plan.kind === 'path' && plan.path) {
        const line = fitLine(contacts);
        const profile = renderPathProfile(results.map((r) => ({ label: r.label, s: r.s || 0, z: r.z })));
        return {
            ...common,
            path: plan.path,
            lineFit: line,
            profile,
            note: summary
                ? `Surface path: ${contacts.length}/${results.length} contacts, Z ${summary.zMin}..${summary.zMax} `
                    + `(range ${summary.zRange} mm)${line ? `; best-fit slope ${line.slopeMmPer100Mm} mm per 100 mm (${line.slopeDeg} deg), `
                    + `flatness about the line ${line.flatnessMm} mm (rms residual ${line.rmsResidualMm})` : ''}. MACHINE coordinates.`
                : 'Surface path: no contacts.',
        };
    }
    const grid = plan.grid as NonNullable<ProbeSurfacePlan['grid']>;
    const plane = fitPlane(contacts);
    const zMatrix = buildZMatrix(grid.xs, grid.ys, results.map((r) => ({ row: r.row as number, col: r.col as number, z: r.z })));
    return {
        ...common,
        grid: { xs: grid.xs, ys: grid.ys, pitchXMm: grid.pitchXMm, pitchYMm: grid.pitchYMm, bounds: grid.bounds },
        zMatrix,
        heightMap: renderHeightMap(grid.xs, grid.ys, zMatrix),
        planeFit: plane,
        note: summary
            ? `Surface grid: ${contacts.length}/${results.length} contacts, Z ${summary.zMin}..${summary.zMax} `
                + `(range ${summary.zRange} mm, highest ${summary.highest}, lowest ${summary.lowest})`
                + `${plane ? `; best-fit plane tilt X ${plane.tiltXMmPer100Mm} / Y ${plane.tiltYMmPer100Mm} mm per 100 mm, `
                    + `flatness about the plane ${plane.flatnessMm} mm (rms residual ${plane.rmsResidualMm})` : ''}. `
                + 'MACHINE coordinates; zMatrix rows = ys ascending, cols = xs ascending; heightMap prints +Y at the top.'
            : 'Surface grid: no contacts.',
    };
}

export async function runProbeSurfaceProcedure(plan: ProbeSurfacePlan): Promise<object> {
    assertChannelReady('probe', `surface ${plan.kind} scan`);
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();

    const phases: { phase: string; note?: string }[] = [];
    const announce = (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool: plan.tool, phase, note });
    };

    // Position checks: every preceding move verified its own arrival, so the
    // engine's position of record and an either-frame reading of the
    // heartbeat decide (positionOfRecord.ts). Job 1db4902a4cd6 (2026-09-05)
    // aborted here on one lagging beat and one G53-window beat while the
    // controller had echoed both hop segments at their targets.
    const expectPosition = async (
        expected: { x: number; y: number; z: number },
        what: string,
        onMismatch: (message: string) => Error
    ) => {
        const check = await expectMachinePosition(expected, what, onMismatch);
        if (check.note) {
            announce('position-recheck', `${what}: ${check.note}`);
        }
    };

    await expectPosition(plan.staged, 'staged position', (message) => new McpToolError(
        `The machine is not at the position this scan was staged from. ${message} Stage ${plan.tool} again.`
    ));

    const results: SurfaceStationResult[] = [];
    // Reference height for the envelope: the last REAL contact (toolhead Z).
    let reference: number | null = null;
    const hopHeightFor = (ref: number) => Number(Math.min(ref + (plan.hopMode === 'stepped' ? plan.hopLiftMm : plan.zSafeDeltaMm), plan.hopZ).toFixed(3));

    let stationIndex = 0;
    try {
        // Approach to station 1: full motion law 2 (raise, traverse at the
        // gantry height, guarded descent to the operator-stated start Z).
        const first = plan.stations[0];
        probeFeedService.clearExpectedContact();
        await moveMachineSettled(`${plan.tool}:raise`, { z: plan.hopZ }, TRAVEL_FEED);
        await moveMachineSettled(`${plan.tool}:traverse`, { x: first.x, y: first.y }, TRAVEL_FEED);
        announce('traverse', `(${first.x}, ${first.y}) at Z${plan.hopZ} (law 2)`);
        const guardTop = plan.startZMachine + DESCENT_GUARD_MM;
        // The verified position (traverse echo) decides the descent, never a
        // single heartbeat - job 42df7b9351b7 (2026-09-05) read a zero-offset
        // beat as Z-8 here, skipped this move and aborted at the station check.
        const known = knownMachinePosition();
        const zNow = known.position.z;
        if (zNow === null) {
            throw new ProcedureAbort('Machine Z unknown before the descent to station 1 - refusing to guess.');
        }
        if (zNow < plan.startZMachine - RECHECK_TOLERANCE_MM) {
            throw new ProcedureAbort(`The toolhead is at machine Z${zNow} (${known.source}), BELOW start_z_machine Z${plan.startZMachine} `
                + '- the approach to station 1 must descend, never rise into the surface. Re-stage from a verified position.');
        }
        announce('descend-from', `Z${zNow} (${known.source}) to guard top Z${guardTop} in <= ${plan.descentSegmentMm} mm segments (crash guard armed)`);
        if (zNow > guardTop + TRAVERSE_Z_TOLERANCE_MM) {
            await descendInSegments(`${plan.tool}:descend`, zNow, guardTop, 'probe', plan.sensorDelayMs, { segmentMm: plan.descentSegmentMm });
        }
        let gz = Math.min(zNow === null ? guardTop : Math.max(zNow, plan.startZMachine), guardTop);
        while (gz - plan.startZMachine > 1e-9) {
            const t0 = Date.now();
            gz = Math.max(gz - 1, plan.startZMachine);
            await moveMachineSettled(`${plan.tool}:descend-guard`, { z: gz }, COARSE_FEED);
            const sensed = await senseAfter('probe', t0, plan.sensorDelayMs);
            if (sensed.contact) {
                throw new ProcedureAbort(`UNEXPECTED CONTACT during the guarded descent at Z${gz.toFixed(3)} - the surface `
                    + `is above start_z_machine ${plan.startZMachine}. Machine held.`);
            }
        }
        announce('descend', `Z${plan.startZMachine} (guarded final ${DESCENT_GUARD_MM} mm)`);

        let currentZ = plan.startZMachine;
        let incoming: { ux: number; uy: number; z: number; length: number } | null = null;
        for (const station of plan.stations) {
            stationIndex = station.index;
            const isFirst = station.index === 1;
            const confirmationReasons: string[] = isFirst ? ['first-station'] : [];
            if (!isFirst && results[results.length - 1]?.status === 'no_contact') {
                confirmationReasons.push('after-miss');
            }
            if (!isFirst) {
                // THE LAW-2 EXCEPTION: hop at lastContact + z_safe_delta, in
                // sensor-checked segments, expecting NO contact. See the file
                // header for the operator's authorisation and its bounds.
                const previous = plan.stations[station.index - 2];
                probeFeedService.clearExpectedContact();
                if (plan.hopMode === 'stepped') {
                    const dx = station.x - previous.x;
                    const dy = station.y - previous.y;
                    const length = Math.hypot(dx, dy);
                    const ux = length ? dx / length : 0;
                    const uy = length ? dy / length : 0;
                    const backtrackMm: number = incoming && Math.abs(incoming.z - currentZ) < 1e-6
                        && Math.abs(incoming.ux - ux) < 1e-6 && Math.abs(incoming.uy - uy) < 1e-6
                        ? Math.min(incoming.length, plan.hopBackoffMm) : 0;
                    const traverse = await steppedTraverseZ(plan.tool, station.label, previous, station, currentZ, {
                        liftMm: plan.hopLiftMm,
                        maxZ: plan.hopZ,
                        sensorDelayMs: plan.sensorDelayMs,
                        extraBackoffMm: plan.hopBackoffMm,
                        backtrackMm,
                    }, announce);
                    if (traverse.lifts.length) {
                        confirmationReasons.push('link-contact');
                    }
                    currentZ = traverse.z;
                    incoming = { ux, uy, z: currentZ, length: traverse.clearTailMm || 0 };
                    announce(`hop-${station.label}`, `${station.hopFromPreviousMm} mm to (${station.x}, ${station.y}), stepped traverse: `
                        + `${traverse.lifts.length} lift(s), arrived at Z${currentZ}`);
                } else {
                    const segs = hopSegments({ x: previous.x, y: previous.y }, { x: station.x, y: station.y });
                    for (let j = 0; j < segs.length; j++) {
                        const t0 = Date.now();
                        await moveMachineSettled(`${plan.tool}:hop:${station.label}`, { x: segs[j].x, y: segs[j].y }, TRAVEL_FEED);
                        const sensed = await senseAfter('probe', t0, plan.sensorDelayMs);
                        if (sensed.contact) {
                            throw new ProcedureAbort(`UNEXPECTED CONTACT during the hop to "${station.label}" at `
                                + `(${segs[j].x}, ${segs[j].y}, ${currentZ}) - the surface rises more than ${plan.zSafeDeltaMm} mm `
                                + 'above the last contact. Machine held.');
                        }
                    }
                    announce(`hop-${station.label}`, `${station.hopFromPreviousMm} mm to (${station.x}, ${station.y}) at Z${currentZ} `
                        + `(last contact + ${plan.zSafeDeltaMm})`);
                }
            }

            // With a profile the max_drop band hangs below the MODEL's expectation
            // for this station (a cylinder falls away from the crown faster than
            // max_drop below the previous contact would allow); hops still use
            // the last real contact (the law-2 exception is unchanged).
            const modelZ = plan.profile ? circleExpectedZ(plan.profile, station.x) : null;
            let envReference = reference === null ? plan.startZMachine : reference;
            if (modelZ !== null) {
                envReference = modelZ;
            }
            const env = stationEnvelope(envReference, isFirst, plan.startZMachine, {
                zSafeDeltaMm: plan.zSafeDeltaMm, maxDropMm: plan.maxDropMm, absoluteFloorZ: plan.absoluteFloorZ,
            });
            // Station 1 may search all the way to an EXPLICIT floor_z_machine
            // (job d7ac9247838e aborted because start_z - max_drop was the
            // only window honoured); later stations keep max_drop below the
            // last contact.
            const stationFloorZ = isFirst && plan.floorExplicit ? plan.absoluteFloorZ : env.floorZ;
            // The march starts where the walk left us (start_z for station 1,
            // the hop height otherwise). Re-verify before trusting the sensor.
            const marchStartZ = isFirst ? plan.startZMachine : currentZ;
            await expectPosition({ x: station.x, y: station.y, z: marchStartZ }, `station "${station.label}"`,
                (message) => new ProcedureAbort(message));

            probeFeedService.setExpectedContact(['probe']);
            // Expected contact for the slow zone: the previous real contact,
            // or the caller's expected_z_machine for station 1.
            let expectedContact: number | null = isFirst ? plan.expectedZMachine : reference;
            if (modelZ !== null) {
                expectedContact = modelZ;
            }
            const outcome: MarchOutcome | null = await marchDownZ(plan, station, marchStartZ, stationFloorZ, expectedContact, confirmationReasons,
                (uncertain) => {
                    results.push(uncertain);
                    announce(`uncertain-${station.label}`, `initial contact Z${uncertain.initialContactZ}; ${uncertain.confirmationFailure}; excluded from accepted geometry`);
                }, announce);
            let retractTo: number;
            if (outcome === null) {
                if (reference === null) {
                    throw new ProcedureAbort(`Station "${station.label}" (the first) found no surface between Z${marchStartZ} and the floor `
                        + `Z${stationFloorZ} - no measured reference to base the envelope on. Check start_z_machine / floor_z_machine.`);
                }
                results.push({
                    index: station.index,
                    label: station.label,
                    x: station.x,
                    y: station.y,
                    s: station.s,
                    row: station.row,
                    col: station.col,
                    status: 'no_contact',
                    z: null,
                    marchStartZ,
                    floorZ: stationFloorZ,
                });
                retractTo = hopHeightFor(reference);
                announce(`no-contact-${station.label}`, `nothing between Z${marchStartZ} and the floor Z${stationFloorZ}; reference stays Z${reference}`);
            } else {
                if (outcome.accepted) {
                    reference = outcome.contactZ;
                }
                results.push({
                    index: station.index,
                    label: station.label,
                    x: station.x,
                    y: station.y,
                    s: station.s,
                    row: station.row,
                    col: station.col,
                    status: outcome.accepted ? 'contact' : 'uncertain',
                    z: outcome.accepted ? outcome.contactZ : null,
                    marchStartZ,
                    floorZ: stationFloorZ,
                    confirmPassContacts: outcome.passContacts,
                    spreadMm: outcome.spreadMm,
                    initialContactZ: outcome.initialContactZ,
                    finalContactZ: outcome.finalContactZ,
                    confirmationReasons: outcome.confirmationReasons,
                    extraPassCount: outcome.passContacts.length,
                    approach: outcome.approach,
                    worstPressMm: outcome.worstPressMm,
                });
                retractTo = hopHeightFor(outcome.accepted ? outcome.contactZ : Math.max(outcome.initialContactZ, outcome.finalContactZ));
                announce(`${outcome.accepted ? 'measured' : 'uncertain'}-${station.label}`, `(${station.x}, ${station.y}, ${outcome.contactZ}) spread ${outcome.spreadMm}, `
                    + `${outcome.approach}, press <= ${outcome.worstPressMm} mm`);
            }

            if (plan.capture?.stations?.includes(station.index)) {
                results[results.length - 1].capture = await captureProbeSpot(plan.capture, plan.tool, station.label);
                announce(`capture-${station.label}`, JSON.stringify(results[results.length - 1].capture));
            }

            // Retract to the hop height (contact still expected while leaving
            // the surface), prove the probe released, then hand over to the
            // crash guard for the hop.
            const t0 = Date.now();
            await moveMachineSettled(`${plan.tool}:retract:${station.label}`, { z: retractTo }, TRAVEL_FEED);
            const released = await senseReleaseAfter('probe', t0, releaseTimeoutFor(plan.sensorDelayMs));
            if (released.contact) {
                throw new ProcedureAbort(`Station "${station.label}": probe still triggered after retracting to Z${retractTo} - stuck probe or feed fault.`);
            }
            probeFeedService.clearExpectedContact();
            if (incoming && Math.abs(incoming.z - retractTo) > 1e-6) {
                incoming = null;
            }
            currentZ = retractTo;
            if (outcome && !outcome.accepted) {
                throw new ProcedureAbort(`Station "${station.label}": initial contact Z${outcome.initialContactZ} and retouch Z${outcome.finalContactZ} disagree by ${outcome.spreadMm} mm (threshold ${plan.confirmationToleranceMm}); station is uncertain and excluded from accepted geometry.`);
            }
        }

        await moveMachineSettled(`${plan.tool}:final-raise`, { z: plan.hopZ }, TRAVEL_FEED);
        announce('scan-complete', `${results.filter((r) => r.status === 'contact').length}/${results.length} contacts, raised to Z${plan.hopZ}`);
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (probeAbortHeld((err as { partial?: object }).partial)) {
            announce('abort-held', 'contact during lift - holding even if the sensor subsequently releases');
        } else if (!isTrip) {
            try {
                await abortRaiseToTop(plan.tool, (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            // Keep the class (a program runner tells a requested stop from a
            // fault) and carry the completed stations as the partial result.
            const partial = { ...buildResult(plan, results, phases, tipCalibration), aborted: true, abortedAtStation: stationIndex };
            const Ctor = isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
            throw new Ctor(`Surface ${plan.kind} scan aborted at station ${stationIndex}: ${err.message} `
                + `${results.filter((r) => r.status === 'contact').length} station(s) measured before the abort are on the job record.`, partial);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }

    return buildResult(plan, results, phases, tipCalibration);
}
