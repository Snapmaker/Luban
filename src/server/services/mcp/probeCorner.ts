/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import {
    CircleFit,
    CornerGeometry,
    RadialStation,
    WallLineSpec,
    bisectorReachFor,
    centreDistanceFor,
    cornerGeometry,
    fitCircle,
    radialStations,
    radiusFromBisectorContact,
} from './cornerFit';
import { MotionSegment, ObstacleBox, checkMotion, describeViolations } from './envelopeChecks';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import { MarchParams, Xyz, makeAnnounce, marchToContact, pointAlong, retreatAlong } from './march';
import { probeFeedService } from './probeFeed';
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
    CIRCLE_APPROACH_CLEARANCE_MM,
    CORNER_POINTS,
    GPIO_SENSOR_DELAY_MS,
    MAX_PROFILE_RADIUS_MM,
    clampCount,
    clampTo,
    resolveMarchParams,
} from './procedureLimits';
import { McpToolError } from './registry';
import { TipCalibrationSnapshot, projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { probeGeometry } from './rotaryGeometry';
import { assertWithinTravel, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';
import { Xy } from './wallFollow';

// probe_corner (operator, 2026-09-21 - "rounded corners are the normal
// case"): measure the radius of an INTERNAL corner between two walls that
// earlier marches have fitted, under one approval:
//
//   1. Law 2 to the start: raise, hop, guarded descent to z_machine. The
//      start lies on the corner's BISECTOR, far enough from the apex that a
//      fillet as large as radius_max_mm (the operator's bound, law 3) plus
//      approach_clearance_mm still leaves it in free space.
//   2. BISECTOR march toward the apex. Where it stops tells the radius: a
//      tangent tip-centre arc of radius rho has its mid-point rho (1/sin(t/2)
//      - 1) from the apex (cornerFit.radiusFromBisectorContact). A contact at
//      the apex is a SHARP corner (rho ~ 0) and the radial pass is skipped.
//   3. Retreat along the bisector - the path just proven - to the arc's
//      CENTRE (rho / sin(t/2) from the apex; always short of the contact), and
//      march RADIALLY from it at `points` azimuths from wall A's tangent point
//      to wall B's, retreating to the centre between them. Every station and
//      every link lies on ground a march has proven: the bisector, or the
//      centre itself (the operator's rule (d): never place a station or a
//      link inside a radius not yet measured).
//   4. FIT: Kasa circle through the radial contacts and the bisector contact -
//      radius, centre, per-point residuals (an irregular round shows here and
//      is reported, never hidden); physical radius = tip-centre radius + tip.
//
// The walls are the TIP-CENTRE lines a probe_wall_follow fit returns (its
// fit.point / fit.normal), so everything here is tip-centre geometry and the
// tip enters once, at the end. Also a probe_program op kind `corner`.

export interface ProbeCornerPlan {
    tool: 'probe_corner';
    wallA: WallLineSpec;
    wallB: WallLineSpec;
    geometry: CornerGeometry;
    zMachine: number;
    /** Operator's bound on the PHYSICAL radius (law 3) and the tip-centre radius it implies. */
    radiusMaxMm: number;
    rhoMaxMm: number;
    approachClearanceMm: number;
    /** Where the bisector march starts (machine XY) and how far it may run (to the apex). */
    start: Xy;
    bisectorTravelMm: number;
    /** Radial stations from the (run-time) centre; travel per station from the centre. */
    radials: RadialStation[];
    radialTravelMm: number;
    /** The centre for the LARGEST radius - the worst case the keep-out check plans with. */
    worstCentre: Xy;
    march: MarchParams;
    hopZ: number;
    staged: Xyz;
    tipDiameterMm: number | null;
}

interface CornerArgs {
    wall_a?: unknown;
    wall_b?: unknown;
    z_machine?: unknown;
    radius_max_mm?: unknown;
    points?: unknown;
    approach_clearance_mm?: unknown;
    coarse_step_mm?: unknown;
    fine_step_mm?: unknown;
    backoff_mm?: unknown;
    sensor_delay_ms?: unknown;
    confirm_passes?: unknown;
}

const r3 = (v: number) => Number(v.toFixed(3));

function wallSpec(raw: unknown, name: string): WallLineSpec {
    const o = (raw || {}) as { x?: unknown; y?: unknown; nx?: unknown; ny?: unknown };
    const vals = [o.x, o.y, o.nx, o.ny].map(Number);
    if (vals.some((v) => !Number.isFinite(v))) {
        throw new McpToolError(`${name} is required: {x, y, nx, ny} - a point on the wall's fitted TIP-CENTRE line (machine) and the unit normal `
            + 'toward the free side, as probe_wall_follow returns in fit.point / fit.normal.');
    }
    const len = Math.hypot(vals[2], vals[3]);
    if (len < 1e-9) {
        throw new McpToolError(`${name}.nx/ny must not both be 0.`);
    }
    return { point: { x: vals[0], y: vals[1] }, normal: { x: vals[2] / len, y: vals[3] / len } };
}

export function cornerMotion(plan: ProbeCornerPlan): MotionSegment[] {
    const out: MotionSegment[] = [];
    const z = plan.zMachine;
    out.push({ kind: 'column', what: 'corner start descent', from: { ...plan.start, z: plan.hopZ }, to: { ...plan.start, z } });
    out.push({ kind: 'march', what: 'bisector march', from: { ...plan.start, z }, to: { ...plan.geometry.apex, z } });
    for (const st of plan.radials) {
        const far = { x: r3(plan.worstCentre.x + st.unit.x * plan.radialTravelMm), y: r3(plan.worstCentre.y + st.unit.y * plan.radialTravelMm) };
        out.push({ kind: 'march', what: `radial "${st.label}" march`, from: { ...plan.worstCentre, z }, to: { ...far, z } });
    }
    return out;
}

export function planProbeCorner(args: CornerArgs, extraObstacles: ObstacleBox[] = []): ProbeCornerPlan {
    const snapshot = getPositionSnapshot();
    const { x, y, z } = snapshot.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the corner probe.');
    }
    const hopZ = safeTraverseZ();
    const wallA = wallSpec(args.wall_a, 'wall_a');
    const wallB = wallSpec(args.wall_b, 'wall_b');
    const geometry = cornerGeometry(wallA, wallB);
    if (!geometry) {
        throw new McpToolError('wall_a and wall_b are parallel - no corner between them.');
    }
    const zMachine = Number(args.z_machine);
    if (!Number.isFinite(zMachine) || zMachine <= 0 || zMachine > hopZ) {
        throw new McpToolError(`z_machine is required: the toolhead machine Z the walls were probed at (a MEASURED top minus a depth), 0..${hopZ}.`);
    }
    const radiusMax = Number(args.radius_max_mm);
    if (!Number.isFinite(radiusMax) || radiusMax <= 0 || radiusMax > MAX_PROFILE_RADIUS_MM) {
        throw new McpToolError(`radius_max_mm is required: the operator's bound on the corner's PHYSICAL radius (0..${MAX_PROFILE_RADIUS_MM}); it places the `
            + 'bisector start in free space (law 3).');
    }
    const geometryStore = probeGeometry();
    const tipDiameterMm = geometryStore ? geometryStore.tipDiameter : null;
    const tipR = tipDiameterMm === null ? 0 : tipDiameterMm / 2;
    // Tip-centre radius bound: a physical fillet of radius R is a tip-centre arc of R - tip radius.
    const rhoMax = Math.max(0, r3(radiusMax - tipR));
    const clearance = clampTo(args.approach_clearance_mm, CIRCLE_APPROACH_CLEARANCE_MM);
    const points = clampCount(args.points, CORNER_POINTS);
    const bisectorTravel = r3(bisectorReachFor(rhoMax, geometry.interiorAngleDeg) + clearance);
    const start = { x: r3(geometry.apex.x + geometry.bisector.x * bisectorTravel), y: r3(geometry.apex.y + geometry.bisector.y * bisectorTravel) };
    const worstCentreDist = centreDistanceFor(rhoMax, geometry.interiorAngleDeg);
    const worstCentre = { x: r3(geometry.apex.x + geometry.bisector.x * worstCentreDist), y: r3(geometry.apex.y + geometry.bisector.y * worstCentreDist) };
    const radials = radialStations(wallA, wallB, geometry.bisector, points);
    const radialTravel = r3(rhoMax + clearance);

    assertWithinTravel(
        [
            { label: 'Bisector start', x: start.x, y: start.y },
            { label: 'Corner apex', x: geometry.apex.x, y: geometry.apex.y },
            ...radials.map((st) => ({
                label: `Radial ${st.label} far limit`,
                x: r3(worstCentre.x + st.unit.x * radialTravel),
                y: r3(worstCentre.y + st.unit.y * radialTravel),
            })),
        ],
        requirePlanningTravel('a corner probe', { x, y })
    );

    const plan: ProbeCornerPlan = {
        tool: 'probe_corner',
        wallA,
        wallB,
        geometry,
        zMachine: r3(zMachine),
        radiusMaxMm: radiusMax,
        rhoMaxMm: rhoMax,
        approachClearanceMm: clearance,
        start,
        bisectorTravelMm: bisectorTravel,
        radials,
        radialTravelMm: radialTravel,
        worstCentre,
        // Operator law 2026-09-05: never 2 mm; GPIO sensor floor (procedureLimits.ts).
        march: resolveMarchParams(args, { delay: GPIO_SENSOR_DELAY_MS }),
        hopZ,
        staged: { x, y, z },
        tipDiameterMm,
    };
    const violations = checkMotion(cornerMotion(plan), [...landmarkStore.obstacleBoxes(), ...extraObstacles], { traverseZ: hopZ, ...clearanceOptions() });
    if (violations.length) {
        throw new McpToolError(`Corner probe refused (law 4, landmarks are obstacles): ${describeViolations(violations)}.`);
    }
    return plan;
}

export function describeProbeCornerPlanAsGcode(plan: ProbeCornerPlan): string {
    const g = plan.geometry;
    const lines = [
        `; CORNER PROBE: internal corner between wall A (through (${plan.wallA.point.x}, ${plan.wallA.point.y}), free side (${r3(plan.wallA.normal.x)}, ${r3(plan.wallA.normal.y)})) `
            + `and wall B (through (${plan.wallB.point.x}, ${plan.wallB.point.y}), free side (${r3(plan.wallB.normal.x)}, ${r3(plan.wallB.normal.y)})) - tip-centre lines`,
        `; apex (${g.apex.x}, ${g.apex.y}), interior angle ${g.interiorAngleDeg} deg, bisector (${g.bisector.x}, ${g.bisector.y}) into the free space; toolhead Z${plan.zMachine}`,
        `; radius bound (operator, law 3): physical <= ${plan.radiusMaxMm} mm = tip-centre <= ${plan.rhoMaxMm}${plan.tipDiameterMm === null ? ' (NO tip diameter stored: the bound is taken as tip-centre)' : ''}`,
        `; 1) law 2 to the bisector start (${plan.start.x}, ${plan.start.y}) = apex + ${plan.bisectorTravelMm} mm along the bisector (largest arc's mid-point + ${plan.approachClearanceMm} clearance):`,
        `;    raise to Z${plan.hopZ}, traverse, descend in <= ${DESCENT_SEGMENT_MM} mm segments then guarded 1 mm steps (ANY contact aborts).`,
        `; 2) BISECTOR march toward the apex up to ${plan.bisectorTravelMm} mm (${plan.march.coarseStepMm} mm steps F${COARSE_FEED}, release, ${plan.march.fineStepMm} fine, ${plan.march.confirmPasses} confirm pass(es)):`,
        ';    where it stops gives the radius (rho = reach / (1/sin(angle/2) - 1)); a contact at the apex = SHARP corner, radial pass skipped; no contact = ABORT (the walls are not where stated).',
        `; 3) retreat along the bisector to the arc CENTRE (rho / sin(angle/2) from the apex, always short of the contact), then ${plan.radials.length} RADIAL marches from it`,
        `;    at azimuths ${plan.radials.map((s) => s.azimuthDeg).join(', ')} deg (wall A's tangent point to wall B's), each up to ${plan.radialTravelMm} mm, retreating to the centre between them.`,
        ';    Every station and link lies on the bisector or at the centre - ground a march has proven; nothing is placed inside an unmeasured radius.',
        `; 4) FIT: circle through the contacts - radius, centre, per-point residuals${plan.tipDiameterMm === null ? '' : `; physical radius = tip-centre radius + ${r3(plan.tipDiameterMm / 2)}`}.`,
        `; ends raised at Z${plan.hopZ} (also on any abort, law 8)`,
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)}) - re-verified before motion`,
        'G90',
        'G53;',
        `G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the safe traverse height (law 2)`,
        `G1 X${plan.start.x.toFixed(3)} Y${plan.start.y.toFixed(3)} F${TRAVEL_FEED}; traverse to the bisector start`,
        `G1 Z${Math.min(plan.zMachine + DESCENT_GUARD_MM, plan.hopZ).toFixed(3)} F${TRAVEL_FEED}; descend in <= ${DESCENT_SEGMENT_MM} mm segments (crash guard armed)`,
        `G1 Z${plan.zMachine.toFixed(3)} F${COARSE_FEED}; guarded 1 mm steps (ANY contact aborts)`,
        `G1 X${g.apex.x.toFixed(3)} Y${g.apex.y.toFixed(3)} F${COARSE_FEED}; bisector march travel limit (the apex) - contact expected before it`,
        `; retreat along the bisector to the centre (run-time: for the largest radius it is (${plan.worstCentre.x}, ${plan.worstCentre.y}))`,
    ];
    for (const st of plan.radials) {
        const far = { x: r3(plan.worstCentre.x + st.unit.x * plan.radialTravelMm), y: r3(plan.worstCentre.y + st.unit.y * plan.radialTravelMm) };
        lines.push(`; --- radial "${st.label}" azimuth ${st.azimuthDeg} deg: march from the centre up to ${plan.radialTravelMm} mm (worst-case limit (${far.x}, ${far.y})), retreat to the centre ---`);
    }
    lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (also on any abort)`);
    lines.push('G54;');
    return lines.join('\n');
}

export interface CornerResult {
    tipCalibration?: TipCalibrationSnapshot;
    tool: 'probe_corner';
    geometry: CornerGeometry;
    zMachine: number;
    bisector: { start: Xy; contactMachine: Xyz | null; contactFromApexMm: number | null; rhoEstimateMm: number | null; spreadMm: number | null };
    sharp: boolean;
    centre: Xy | null;
    radials: { label: string; azimuthDeg: number; status: 'contact' | 'no_contact'; contactMachine: Xyz | null; travelMm: number | null; spreadMm: number | null }[];
    fit: CircleFit | null;
    /** Tip-centre radius from the fit (or the bisector estimate when the radial pass was skipped). */
    radiusTipCentreMm: number | null;
    /** + tip radius (internal corner); null without a stored tip diameter. */
    radiusPhysicalMm: number | null;
    tipDiameterMm: number | null;
    phases: { phase: string; note?: string }[];
    note: string;
    aborted?: boolean;
}

export async function runProbeCornerProcedure(plan: ProbeCornerPlan): Promise<CornerResult> {
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();
    assertChannelReady('probe', 'corner probe');
    const phases: { phase: string; note?: string }[] = [];
    const announce = makeAnnounce(plan.tool, phases);
    const tag = 'corner';
    const g = plan.geometry;
    const toApex: Xyz = { x: -g.bisector.x, y: -g.bisector.y, z: 0 };
    const startXyz: Xyz = { x: plan.start.x, y: plan.start.y, z: plan.zMachine };
    const radials: CornerResult['radials'] = [];
    let bisectorContact: CornerResult['bisector'] = { start: plan.start, contactMachine: null, contactFromApexMm: null, rhoEstimateMm: null, spreadMm: null };
    let centre: Xy | null = null;
    let sharp = false;

    const build = (aborted: boolean): CornerResult => {
        const hits = radials
            .filter((r): r is typeof r & { contactMachine: Xyz } => r.contactMachine !== null)
            .map((r) => ({ x: r.contactMachine.x, y: r.contactMachine.y }));
        if (bisectorContact.contactMachine) {
            hits.push({ x: bisectorContact.contactMachine.x, y: bisectorContact.contactMachine.y });
        }
        const fit = hits.length >= 3 ? fitCircle(hits) : null;
        const rho = fit ? fit.radius : bisectorContact.rhoEstimateMm;
        const tipR = plan.tipDiameterMm === null ? null : plan.tipDiameterMm / 2;
        return {
            tool: plan.tool,
            geometry: g,
            zMachine: plan.zMachine,
            tipCalibration,
            bisector: { ...bisectorContact, ...projectToolTipZ(bisectorContact.contactMachine?.z ?? null, tipCalibration) },
            sharp,
            centre,
            radials: radials.map((r) => ({ ...r, ...projectToolTipZ(r.contactMachine?.z ?? null, tipCalibration) })),
            fit,
            radiusTipCentreMm: rho === null ? null : r3(rho),
            radiusPhysicalMm: rho === null || tipR === null ? null : r3(rho + tipR),
            tipDiameterMm: plan.tipDiameterMm,
            phases,
            note: `${aborted ? 'ABORTED. ' : ''}${sharp ? 'SHARP corner (the bisector march reached the apex). ' : ''}`
                + `${fit ? `Arc through ${fit.points} contact(s): tip-centre radius ${fit.radius} mm about (${fit.center.x}, ${fit.center.y}), residuals rms ${fit.rmsResidual} / max ${fit.maxResidual} mm`
                    + `${fit.maxResidual > plan.march.backoffMm ? ' - the corner is NOT a circular arc at this scale (an irregular round, or a contact was bad): read the residuals by azimuth' : ''}`
                    : `Bisector estimate: tip-centre radius ${bisectorContact.rhoEstimateMm ?? '?'} mm`}. `
                + `${tipR === null ? 'No tip diameter stored: physical radius unknown (set_probe_geometry).' : `Physical radius = tip-centre + ${r3(tipR)} = ${rho === null ? '?' : r3(rho + tipR)} mm.`}`,
            aborted: aborted || undefined,
        };
    };

    const guardedDescent = async (label: string, toZ: number) => {
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
                throw new ProcedureAbort(`UNEXPECTED CONTACT at Z${gz.toFixed(3)} during the guarded descent at "${label}": the bisector start is not over free space `
                    + '(radius_max_mm too small, or the walls are not where stated). Machine held.');
            }
        }
    };

    try {
        await expectMachinePosition(plan.staged, 'staged position', (message) => new McpToolError(
            `The machine is not at the position this corner probe was staged from. ${message} Stage probe_corner again.`
        ));
        probeFeedService.clearExpectedContact();
        await moveMachineSettled(`${tag}:raise`, { z: plan.hopZ }, TRAVEL_FEED);
        await moveMachineSettled(`${tag}:traverse`, { x: plan.start.x, y: plan.start.y }, TRAVEL_FEED);
        announce('traverse', `bisector start (${plan.start.x}, ${plan.start.y}) at Z${plan.hopZ}`);
        await guardedDescent('bisector start', plan.zMachine);

        // ---- bisector march
        probeFeedService.setExpectedContact(['probe']);
        const contact = await marchToContact(tag, 'bisector', startXyz, toApex, plan.bisectorTravelMm, plan.march, announce);
        if (!contact) {
            await retreatAlong(tag, 'bisector', startXyz, toApex, 0);
            probeFeedService.clearExpectedContact();
            throw new ProcedureAbort(`Bisector march reached the apex (${plan.bisectorTravelMm} mm) without contact - the walls are not where wall_a / wall_b say.`);
        }
        const contactFromApex = r3(plan.bisectorTravelMm - contact.s);
        const rho = radiusFromBisectorContact(contactFromApex, g.interiorAngleDeg);
        bisectorContact = {
            start: plan.start, contactMachine: contact.point, contactFromApexMm: contactFromApex, rhoEstimateMm: rho, spreadMm: contact.spreadMm,
        };
        announce('bisector-contact', `${contactFromApex} mm from the apex -> tip-centre radius ~${rho} mm`);
        if (rho > plan.rhoMaxMm + plan.march.backoffMm) {
            await retreatAlong(tag, 'bisector', startXyz, toApex, 0);
            probeFeedService.clearExpectedContact();
            throw new ProcedureAbort(`The bisector contact implies a tip-centre radius of ${rho} mm, beyond the bound ${plan.rhoMaxMm} (radius_max_mm ${plan.radiusMaxMm}) - `
                + 'the corner is larger than stated, or the walls are misplaced. Raise the bound and re-stage.');
        }
        // A radius below the march's own backoff cannot be sampled radially:
        // the confirm cycle would leave the centre. Sharp corner - report it.
        if (rho <= plan.march.backoffMm) {
            sharp = true;
            await retreatAlong(tag, 'bisector', startXyz, toApex, 0);
            probeFeedService.clearExpectedContact();
            announce('sharp-corner', `radius estimate ${rho} mm <= backoff ${plan.march.backoffMm}: no radial pass`);
        } else {
            const centreDist = centreDistanceFor(rho, g.interiorAngleDeg);
            const centreS = r3(plan.bisectorTravelMm - centreDist);
            centre = { x: r3(g.apex.x + g.bisector.x * centreDist), y: r3(g.apex.y + g.bisector.y * centreDist) };
            // The centre lies on the bisector between the start and the contact: retreat there along the proven path.
            await retreatAlong(tag, 'bisector', startXyz, toApex, Math.max(0, Math.min(centreS, contact.s)));
            probeFeedService.clearExpectedContact();
            const centreXyz: Xyz = { x: centre.x, y: centre.y, z: plan.zMachine };
            await expectMachinePosition(centreXyz, 'arc centre', (m) => new ProcedureAbort(m));
            announce('centre', `(${centre.x}, ${centre.y}): ${plan.radials.length} radial march(es) up to ${plan.radialTravelMm} mm`);

            // ---- radial marches
            for (const st of plan.radials) {
                const unit: Xyz = { x: st.unit.x, y: st.unit.y, z: 0 };
                probeFeedService.setExpectedContact(['probe']);
                const hit = await marchToContact(tag, st.label, centreXyz, unit, plan.radialTravelMm, plan.march, announce);
                if (hit) {
                    radials.push({ label: st.label, azimuthDeg: st.azimuthDeg, status: 'contact', contactMachine: hit.point, travelMm: hit.s, spreadMm: hit.spreadMm });
                } else {
                    radials.push({ label: st.label, azimuthDeg: st.azimuthDeg, status: 'no_contact', contactMachine: null, travelMm: null, spreadMm: null });
                    announce(`no-contact-${st.label}`, `nothing within ${plan.radialTravelMm} mm at ${st.azimuthDeg} deg`);
                }
                // Back to the centre along the radial just proven; the probe may still be in contact.
                await retreatAlong(tag, st.label, centreXyz, unit, 0);
                probeFeedService.clearExpectedContact();
                await expectMachinePosition(centreXyz, `centre after "${st.label}"`, (m) => new ProcedureAbort(m));
            }
        }

        probeFeedService.clearExpectedContact();
        await moveMachineSettled(`${tag}:final-raise`, { z: plan.hopZ }, TRAVEL_FEED);
        const result = build(false);
        announce('corner-complete', result.note);
        return result;
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (!isTrip) {
            try {
                await abortRaiseToTop(tag, (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            const Ctor = isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
            throw new Ctor(`Corner probe aborted: ${err.message} ${radials.length} radial(s) so far are on the job record.`, build(true));
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}

/** Keep `pointAlong` in the public surface for callers that place stations on the bisector by hand. */
export { pointAlong };
