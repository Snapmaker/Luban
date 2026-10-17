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
} from './march';
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
    GPIO_SENSOR_DELAY_MS,
    MARCH_TRAVEL_MM,
    WALL_LINE_TOLERANCE_MM,
    WALL_FOLLOW_STATIONS,
    WALL_FOLLOW_STEP_MM,
    WALL_STANDOFF_MM,
    clampCount,
    clampTo,
    resolveMarchParams,
    within,
} from './procedureLimits';
import { McpToolError } from './registry';
import { StylusReachVerdict, describeStylusReach } from './stylusReach';
import { requireStylusReach } from './stylusReachGuard';
import { TipCalibrationSnapshot, projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { probeGeometry } from './rotaryGeometry';
import { assertWithinTravel, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';
import { WallFollowStation, WallLineFit, Xy, alongUnit, fitWallLine, unit2, wallFollowStations } from './wallFollow';
import { WallRunSplit, splitWallRun } from './cornerFit';

// probe_wall_follow (operator request 2026-09-21, handoff §4 item 1): N
// stations along a VERTICAL wall - the pocket side, the boss face - under
// ONE approval, without retreating to the start line between them:
//
//   1. Law 2 to the first station: raise to the traverse height, hop to the
//      start-line point, guarded segmented descent to z_machine (the
//      MEASURED height the wall is probed at: top - depth; any contact on the
//      way down aborts - the start must be over free space).
//   2. Per station: march along `dir` toward the wall up to max_travel_mm
//      (the sensor-gated coarse/release/fine/confirm march); on contact back
//      off standoff_mm along -dir (operator: "back off ~2 mm"); then step
//      ALONG the wall at that standoff to the next station's line as a
//      STEPPED TRAVERSE (march.ts: 1 mm steps, probe expected) whose retreat
//      is AWAY from the face and capped at the approved start line - the low
//      traverse runs only inside the corridor the marches have proven, and a
//      bump (the wall turning toward us) pushes it outward. The next march
//      starts from where the traverse arrives. A miss records no_contact,
//      retreats to the start line and continues (on_miss default), or aborts.
//   3. FIT: total-least-squares line through the contacts, residuals per
//      point (a run of residuals pulling toward the probe at one end is the
//      wall curving - a corner, handoff §4 item 6), yaw against the step
//      direction. The physical wall is one tip radius beyond each contact
//      along `dir` (tip-centre contacts, as everywhere).
//
// Same mechanics probe_stock_outline's sides run on (hardware-proven
// 2026-09-06), exposed as the operator's "surface_path for walls". Also a
// probe_program op kind `wall_follow`.

export interface ProbeWallFollowPlan {
    tool: 'probe_wall_follow';
    /** Machine XY of the first station's start-line point. */
    start: Xy;
    /** Unit march direction (toward the wall). */
    dir: Xy;
    /** Unit step direction along the wall (perpendicular to dir). */
    along: Xy;
    zMachine: number;
    stepMm: number;
    maxTravelMm: number;
    standoffMm: number;
    stations: WallFollowStation[];
    onMiss: 'continue' | 'abort';
    /** Optional: split the run into straight walls and a corner with this residual tolerance (cornerFit.splitWallRun). */
    lineToleranceMm: number | null;
    march: MarchParams;
    hopZ: number;
    staged: Xyz;
    tipDiameterMm: number | null;
    /** Issue #187: the body-vs-rim verdict at z_machine (refused at staging when it fails). */
    stylusReach: StylusReachVerdict;
}

interface WallFollowArgs {
    rim_z_machine?: unknown;
    surface_z_machine?: unknown;
    reach_margin_mm?: unknown;
    line_tolerance_mm?: unknown;
    start_x?: unknown;
    start_y?: unknown;
    z_machine?: unknown;
    dir_x?: unknown;
    dir_y?: unknown;
    along_x?: unknown;
    along_y?: unknown;
    step_mm?: unknown;
    stations?: unknown;
    max_travel_mm?: unknown;
    standoff_mm?: unknown;
    on_miss?: unknown;
    coarse_step_mm?: unknown;
    fine_step_mm?: unknown;
    backoff_mm?: unknown;
    sensor_delay_ms?: unknown;
    confirm_passes?: unknown;
}

const r3 = (v: number) => Number(v.toFixed(3));

function required(value: unknown, name: string): number {
    const n = Number(value);
    if (value === undefined || value === null || value === '' || !Number.isFinite(n)) {
        throw new McpToolError(`${name} is required (a finite number).`);
    }
    return n;
}

/** Motion list for the keep-out check: the descent column, every march corridor, every along-step at the start line. */
export function wallFollowMotion(plan: ProbeWallFollowPlan): MotionSegment[] {
    const out: MotionSegment[] = [];
    const first = plan.stations[0];
    out.push({ kind: 'column', what: `station "${first.label}" descent`, from: { ...first.start, z: plan.hopZ }, to: { ...first.start, z: plan.zMachine } });
    plan.stations.forEach((st, i) => {
        const limit = { x: r3(st.start.x + plan.dir.x * plan.maxTravelMm), y: r3(st.start.y + plan.dir.y * plan.maxTravelMm) };
        out.push({ kind: 'march', what: `station "${st.label}" march`, from: { ...st.start, z: plan.zMachine }, to: { ...limit, z: plan.zMachine } });
        if (i > 0) {
            const prev = plan.stations[i - 1];
            out.push({ kind: 'march', what: `step ${prev.label} -> ${st.label}`, from: { ...prev.start, z: plan.zMachine }, to: { ...st.start, z: plan.zMachine } });
        }
    });
    return out;
}

export function planProbeWallFollow(args: WallFollowArgs, extraObstacles: ObstacleBox[] = []): ProbeWallFollowPlan {
    const snapshot = getPositionSnapshot();
    const { x, y, z } = snapshot.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the wall follow.');
    }
    const hopZ = safeTraverseZ();
    const start = { x: required(args.start_x, 'start_x (machine X of the first march start, over free space)'), y: required(args.start_y, 'start_y (machine Y)') };
    const zMachine = required(args.z_machine, 'z_machine (toolhead machine Z the wall is probed at: a MEASURED top minus a depth, never a guess)');
    if (zMachine <= 0 || zMachine > hopZ) {
        throw new McpToolError(`z_machine ${zMachine} must be in 0..${hopZ} (the safe traverse height).`);
    }
    const dir = unit2({ x: required(args.dir_x, 'dir_x (march direction toward the wall)'), y: required(args.dir_y, 'dir_y') });
    if (!dir) {
        throw new McpToolError('dir_x / dir_y must not both be 0: the march direction toward the wall.');
    }
    const alongRaw = args.along_x === undefined && args.along_y === undefined
        ? null
        : { x: Number(args.along_x) || 0, y: Number(args.along_y) || 0 };
    const along = alongUnit({ x: r3(dir.x), y: r3(dir.y) }, alongRaw);
    if (!along) {
        throw new McpToolError('along_x / along_y is parallel to the march direction - the step direction must run along the wall (omit both for dir turned +90 deg).');
    }
    const stepMm = clampTo(args.step_mm, WALL_FOLLOW_STEP_MM);
    const count = clampCount(args.stations, WALL_FOLLOW_STATIONS);
    const maxTravel = required(args.max_travel_mm, 'max_travel_mm (how far each march may run before it records no_contact)');
    if (!within(maxTravel, MARCH_TRAVEL_MM)) {
        throw new McpToolError(`max_travel_mm must be ${MARCH_TRAVEL_MM.min}..${MARCH_TRAVEL_MM.max}.`);
    }
    const standoff = clampTo(args.standoff_mm, WALL_STANDOFF_MM);
    if (standoff >= maxTravel) {
        throw new McpToolError(`standoff_mm ${standoff} must be less than max_travel_mm ${maxTravel}.`);
    }
    const onMiss = args.on_miss === 'abort' ? 'abort' : 'continue';
    let lineToleranceMm: number | null = null;
    if (args.line_tolerance_mm !== undefined && args.line_tolerance_mm !== null && args.line_tolerance_mm !== '') {
        lineToleranceMm = Number(args.line_tolerance_mm);
        if (!within(lineToleranceMm, WALL_LINE_TOLERANCE_MM)) {
            throw new McpToolError(`line_tolerance_mm must be ${WALL_LINE_TOLERANCE_MM.min}..${WALL_LINE_TOLERANCE_MM.max} (largest residual still "on the wall").`);
        }
    }
    const stations = wallFollowStations(start, along, stepMm, count);
    const dirR = { x: r3(dir.x), y: r3(dir.y) };

    assertWithinTravel(
        [
            ...stations.map((s) => ({ label: `Station ${s.label} start`, x: s.start.x, y: s.start.y })),
            ...stations.map((s) => ({
                label: `Station ${s.label} far limit (shorten max_travel_mm or the run)`,
                x: r3(s.start.x + dirR.x * maxTravel),
                y: r3(s.start.y + dirR.y * maxTravel),
            })),
        ],
        requirePlanningTravel('a wall follow', { x, y })
    );

    const geometry = probeGeometry();
    const plan: ProbeWallFollowPlan = {
        tool: 'probe_wall_follow',
        start,
        dir: dirR,
        along,
        zMachine: r3(zMachine),
        stepMm,
        maxTravelMm: maxTravel,
        standoffMm: standoff,
        stations,
        onMiss,
        lineToleranceMm,
        // Operator law 2026-09-05: never 2 mm; GPIO sensor floor (procedureLimits.ts).
        march: resolveMarchParams(args, { delay: GPIO_SENSOR_DELAY_MS }),
        hopZ,
        staged: { x, y, z },
        tipDiameterMm: geometry ? geometry.tipDiameter : null,
        stylusReach: requireStylusReach(args, r3(zMachine), 'Wall follow'),
    };
    const violations = checkMotion(wallFollowMotion(plan), [...landmarkStore.obstacleBoxes(), ...extraObstacles], { traverseZ: hopZ, ...clearanceOptions() });
    if (violations.length) {
        throw new McpToolError(`Wall follow refused (law 4, landmarks are obstacles): ${describeViolations(violations)}. `
            + 'Move the start line, shorten max_travel_mm or the run, or have the operator adjust the landmark.');
    }
    return plan;
}

export function describeProbeWallFollowPlanAsGcode(plan: ProbeWallFollowPlan): string {
    const first = plan.stations[0];
    const last = plan.stations[plan.stations.length - 1];
    const lines = [
        `; WALL FOLLOW: ${plan.stations.length} station(s) along a vertical wall at toolhead Z${plan.zMachine}, start line from (${first.start.x}, ${first.start.y}) `
            + `to (${last.start.x}, ${last.start.y}), ${plan.stepMm} mm apart along (${plan.along.x}, ${plan.along.y}); marches toward (${plan.dir.x}, ${plan.dir.y}) up to ${plan.maxTravelMm} mm`,
        `; 1) law 2 to station "${first.label}": raise to Z${plan.hopZ}, traverse, descend in <= ${DESCENT_SEGMENT_MM} mm segments then guarded 1 mm steps to Z${plan.zMachine}`,
        ';    (ANY contact on the way down aborts: the start must be over free space).',
        `; 2) per station: march to the wall (${plan.march.coarseStepMm} mm steps F${COARSE_FEED}, release, ${plan.march.fineStepMm} fine, ${plan.march.confirmPasses} confirm pass(es)); `
            + `back off ${plan.standoffMm} mm from the contact; STEP ALONG THE WALL at that standoff to the next station's line as a stepped traverse (1 mm steps F300,`,
        `;    probe expected): a bump retreats ${plan.standoffMm} mm AWAY from the face, capped at the start line (a contact there aborts - something stands in approved`,
        `;    empty space); the next march starts where the step arrives. A miss records no_contact${plan.onMiss === 'abort' ? ' and ABORTS (on_miss: abort)' : ', retreats to the start line and continues'}.`,
        `; 3) FIT: line through the contacts (direction, normal, residuals, yaw)${plan.tipDiameterMm === null ? '' : `; the physical wall is ${r3(plan.tipDiameterMm / 2)} mm beyond each contact along the march`}.`,
        `; march: sensor ${plan.march.sensorDelayMs} ms, backoff ${plan.march.backoffMm}; ends raised at Z${plan.hopZ} (also on any abort, law 8)`,
        describeStylusReach(plan.stylusReach),
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)}) - re-verified before motion`,
        'G90',
        'G53;',
        `G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the safe traverse height (law 2)`,
        `G1 X${first.start.x.toFixed(3)} Y${first.start.y.toFixed(3)} F${TRAVEL_FEED}; traverse to station "${first.label}" start`,
        `G1 Z${Math.min(plan.zMachine + DESCENT_GUARD_MM, plan.hopZ).toFixed(3)} F${TRAVEL_FEED}; descend in <= ${DESCENT_SEGMENT_MM} mm segments (crash guard armed)`,
        `G1 Z${plan.zMachine.toFixed(3)} F${COARSE_FEED}; guarded 1 mm steps (ANY contact aborts)`,
    ];
    plan.stations.forEach((st, i) => {
        const limit = { x: r3(st.start.x + plan.dir.x * plan.maxTravelMm), y: r3(st.start.y + plan.dir.y * plan.maxTravelMm) };
        if (i > 0) {
            lines.push(`; step along the wall ${plan.stations[i - 1].label} -> "${st.label}" at ${plan.standoffMm} mm off the last contact (stepped traverse, retreat away from the face)`);
        }
        lines.push(`; --- "${st.label}": march from the start line (${st.start.x}, ${st.start.y}) toward (${limit.x}, ${limit.y}) ---`);
        lines.push(`G1 X${limit.x.toFixed(3)} Y${limit.y.toFixed(3)} F${COARSE_FEED}; travel limit - no contact by here = no_contact`);
        lines.push(`; back off ${plan.standoffMm} mm along (${-plan.dir.x}, ${-plan.dir.y}) from the contact`);
    });
    lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (also on any abort)`);
    lines.push('G54;');
    return lines.join('\n');
}

export interface WallFollowContact {
    label: string;
    index: number;
    status: 'contact' | 'no_contact';
    /** Where the march started (machine), and the tip-centre contact (null on a miss). */
    startMachine: Xyz;
    contactMachine: Xyz | null;
    travelMm: number | null;
    maxTravelMm: number;
    spreadMm: number | null;
}

export interface WallFollowResult {
    tipCalibration?: TipCalibrationSnapshot;
    tool: 'probe_wall_follow';
    zMachine: number;
    dir: Xy;
    along: Xy;
    contacts: WallFollowContact[];
    /** Bumps during the along-steps: the wall turned toward the probe here (tip centre, machine). */
    bumps: { during: string; x: number; y: number; z: number; retreatMm: number }[];
    fit: WallLineFit | null;
    /**
     * With line_tolerance_mm: the run split into the straight wall at each end
     * and the corner between (indices into `contacts` that made contact), with
     * the corner's arc fit and residuals - operator rule (a), a contact off
     * its wall's line is a corner. null when no tolerance was given.
     */
    segments: WallRunSplit | null;
    tipDiameterMm: number | null;
    stylusReach: StylusReachVerdict;
    /** Contacts pushed one tip radius along the march: the physical wall. null without a stored tip diameter. */
    surfacePoints: Xy[] | null;
    phases: { phase: string; note?: string }[];
    note: string;
    aborted?: boolean;
}

export async function runProbeWallFollowProcedure(plan: ProbeWallFollowPlan): Promise<WallFollowResult> {
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();
    assertChannelReady('probe', 'wall follow');
    const phases: { phase: string; note?: string }[] = [];
    const announce = makeAnnounce(plan.tool, phases);
    const tag = 'wall';
    const contacts: WallFollowContact[] = [];
    const bumps: WallFollowResult['bumps'] = [];
    const dir: Xyz = { x: plan.dir.x, y: plan.dir.y, z: 0 };

    const build = (aborted: boolean): WallFollowResult => {
        const hits = contacts.filter((c): c is WallFollowContact & { contactMachine: Xyz } => c.contactMachine !== null);
        const hitXy = hits.map((c) => ({ x: c.contactMachine.x, y: c.contactMachine.y }));
        const fit = fitWallLine(hitXy, plan.dir, plan.along);
        const segments = plan.lineToleranceMm === null ? null : splitWallRun(hitXy, plan.lineToleranceMm, plan.dir);
        const tipR = plan.tipDiameterMm === null ? null : plan.tipDiameterMm / 2;
        return {
            tool: plan.tool,
            zMachine: plan.zMachine,
            dir: plan.dir,
            along: plan.along,
            tipCalibration,
            contacts: contacts.map((r) => ({ ...r, ...projectToolTipZ(r.contactMachine?.z ?? null, tipCalibration) })),
            bumps: bumps.map((r) => ({ ...r, ...projectToolTipZ(r.z, tipCalibration) })),
            fit,
            segments,
            tipDiameterMm: plan.tipDiameterMm,
            stylusReach: plan.stylusReach,
            surfacePoints: tipR === null
                ? null
                : hits.map((c) => ({ x: r3(c.contactMachine.x + plan.dir.x * tipR), y: r3(c.contactMachine.y + plan.dir.y * tipR) })),
            phases,
            note: `${aborted ? 'ABORTED. ' : ''}${hits.length}/${plan.stations.length} station(s) made contact at toolhead Z${plan.zMachine}`
                + `${fit ? `; wall line through (${fit.point.x}, ${fit.point.y}) along (${fit.direction.x}, ${fit.direction.y}), yaw ${fit.yawFromAlongDeg} deg from the step direction, `
                    + `residual rms ${fit.rmsMm} / max ${fit.maxAbsMm} mm` : ''}`
                + `${bumps.length ? `; ${bumps.length} bump(s) during the along-steps (the wall turned toward the probe)` : ''}`
                + `${segments && segments.corner ? `; ${segments.offLinePoints} contact(s) off the wall line = a CORNER${segments.corner.arc
                    ? ` (arc r ${segments.corner.arc.radius} tip-centre about (${segments.corner.arc.center.x}, ${segments.corner.arc.center.y}), max residual ${segments.corner.arc.maxResidual})`
                    : ' (too few points for an arc)'}` : ''}. `
                + `Contacts are tip-centre; the wall is ${tipR === null ? 'one tip radius (unknown: set_probe_geometry)' : `${r3(tipR)} mm`} beyond them along (${plan.dir.x}, ${plan.dir.y}).`,
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
            `The machine is not at the position this wall follow was staged from. ${message} Stage probe_wall_follow again.`
        ));
        probeFeedService.clearExpectedContact();
        const first = plan.stations[0];
        await moveMachineSettled(`${tag}:raise`, { z: plan.hopZ }, TRAVEL_FEED);
        await moveMachineSettled(`${tag}:traverse`, { x: first.start.x, y: first.start.y }, TRAVEL_FEED);
        announce('traverse', `(${first.start.x}, ${first.start.y}) at Z${plan.hopZ}`);
        await guardedDescent(first.label, plan.zMachine, 'the start line is not over free space at z_machine.');

        // Distance from the start line at which the probe rests after each
        // station (contact - standoff, or 0 after a miss).
        let restS = 0;
        let previous: WallFollowStation | null = null;
        for (const st of plan.stations) {
            const line: Xyz = { x: st.start.x, y: st.start.y, z: plan.zMachine };
            let startS = 0;
            if (previous) {
                // Step along the wall from the previous rest point to the same
                // offset on this station's line: a stepped traverse whose
                // retreat is AWAY from the face, capped at the start line.
                const prevLine: Xyz = { x: previous.start.x, y: previous.start.y, z: plan.zMachine };
                const traverse = await steppedTraverse(tag, st.label, pointAlong(prevLine, dir, restS), pointAlong(line, dir, restS), {
                    retreatUnit: { x: -dir.x, y: -dir.y, z: 0 },
                    liftMm: plan.standoffMm,
                    maxLiftTotalMm: restS,
                    onMax: 'stop-lifting',
                    sensorDelayMs: plan.march.sensorDelayMs,
                }, announce);
                for (const l of traverse.lifts) {
                    bumps.push({ during: `${previous.label} -> ${st.label}`, x: l.x, y: l.y, z: l.z, retreatMm: l.liftMm });
                }
                startS = r3(restS - traverse.liftTotalMm);
                announce(`step-${st.label}`, `along the wall from ${previous.label}: ${traverse.lifts.length} bump(s), march starts ${startS} mm in from the start line`);
            }
            const startPoint = pointAlong(line, dir, startS);
            await expectMachinePosition(startPoint, `station "${st.label}" march start`, (m) => new ProcedureAbort(m));
            probeFeedService.setExpectedContact(['probe']);
            const travel = r3(plan.maxTravelMm - startS);
            const contact = travel > plan.march.fineStepMm
                ? await marchToContact(tag, st.label, startPoint, dir, travel, plan.march, announce)
                : null;
            if (contact) {
                contacts.push({ label: st.label, index: st.index, status: 'contact', startMachine: startPoint, contactMachine: contact.point, travelMm: contact.s, maxTravelMm: travel, spreadMm: contact.spreadMm });
                restS = Math.max(0, r3(startS + contact.s - plan.standoffMm));
            } else {
                contacts.push({ label: st.label, index: st.index, status: 'no_contact', startMachine: startPoint, contactMachine: null, travelMm: null, maxTravelMm: travel, spreadMm: null });
                announce(`no-contact-${st.label}`, `nothing within ${travel} mm of the march start - the wall is further than max_travel_mm here (it ended, or turned away)`);
                restS = 0;
                if (plan.onMiss === 'abort') {
                    await retreatAlong(tag, st.label, line, dir, 0);
                    probeFeedService.clearExpectedContact();
                    throw new ProcedureAbort(`Station "${st.label}": no contact within ${travel} mm (on_miss: abort).`);
                }
            }
            // Back off the face (or to the start line after a miss); the probe may still be in contact, so keep it expected.
            await retreatAlong(tag, st.label, line, dir, restS);
            probeFeedService.clearExpectedContact();
            previous = st;
        }

        probeFeedService.clearExpectedContact();
        await moveMachineSettled(`${tag}:final-raise`, { z: plan.hopZ }, TRAVEL_FEED);
        const result = build(false);
        announce('wall-follow-complete', result.note);
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
            throw new Ctor(`Wall follow aborted: ${err.message} ${contacts.length} station(s) so far are on the job record.`, build(true));
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
