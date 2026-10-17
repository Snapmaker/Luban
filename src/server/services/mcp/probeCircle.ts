/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planProbeCircle takes the
// probe_circle arguments verbatim).
import { CircleFit, fitCircle as fitCircleKasa } from './cornerFit';
import { mcpBroadcast } from './index';
import { probeFeedService } from './probeFeed';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    TRAVEL_FEED,
    assertChannelReady,
    assertMachineReadyForProcedure,
    DESCENT_SEGMENT_MM,
    descendInSegments,
    moveMachineSettled,
    marchInSegments,
    senseAfter,
    senseReleaseAfter,
    isProcedureAbort,
    abortRaiseToTop,
} from './probing';
import { DESCENT_GUARD_MM } from './probeSequence';
import {
    CIRCLE_APPROACH_CLEARANCE_MM,
    CIRCLE_COARSE_STEP_MM,
    CIRCLE_CONFIRM_PASSES,
    CIRCLE_POINTS,
    CIRCLE_PROBE_DEPTH_MM,
    CIRCLE_RESIDUAL_WARN_MM,
    MARCH_SEGMENT_MM,
    MAX_CIRCLE_DIAMETER_MM,
    MAX_STATED_MACHINE_Z_MM,
    MIN_RADIAL_APPROACH_MM,
    clampCount,
    clampTo,
    releaseTimeoutFor,
    resolveMarchParams,
} from './procedureLimits';
import { McpToolError } from './registry';
import { StylusReachVerdict, describeStylusReach } from './stylusReach';
import { requireStylusReach } from './stylusReachGuard';
import { projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { assertWithinTravel, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

// Circle probing: N sensor-gated radial marches around (or inside) a
// roughly-round vertical feature, then a least-squares circle fit.
//
// OUTSIDE mode (a post, a boss, a pin): marches start beyond the feature and
// step inward. Every contact adds the probe tip's effective radius, so the
// fit yields the COMBINED diameter (feature + tip). Repositioning between
// points obeys motion law 2 in full (operator, 2026-09-02: "x/y motion over
// 1mm is never below gantry height"): every hop lifts to the safe traverse
// height, traverses, then descends.
//
// INSIDE mode (a hole, operator-requested 2026-09-02): the operator
// positions the tip INSIDE the hole at the measuring depth first; every
// march starts from that staged position and steps OUTWARD to the wall,
// retreating back to the start between azimuths - no hops, no Z motion
// until the final raise to the traverse height (a vertical exit along the
// path the probe entered by). Contacts SUBTRACT the tip radius: the fit
// yields hole diameter MINUS tip diameter.
//
// The operator's min/max diameter estimates bound every march - outside:
// start beyond max/2, abort at min/2; inside: abort at max/2 (+ the
// eccentricity margin) - so a wrong guess aborts instead of pressing on.
//
// Safety inherits the probe_point mechanics (hardware-proven), plus: the
// probe channel is EXPECTED contact only while marching/confirming - during
// repositioning hops and descents it is not, so a graze there latches the
// CRASH alarm instead of being absorbed.

export interface ProbeCirclePoint {
    azimuthDeg: number;
    startXY: { x: number; y: number };
}

export interface ProbeCirclePlan {
    inside: boolean;
    center: { x: number; y: number }; // machine coords: estimate (outside) / march origin (inside)
    diameterMinMm: number;
    diameterMaxMm: number;
    topZMachine: number | null; // toolhead machine Z with the tip at the feature top (outside mode)
    probeZ: number; // side-contact toolhead Z
    hopZ: number; // repositioning / final-raise toolhead Z: the safe traverse height (law 2)
    startRadiusMm: number; // outside: approach start radius; inside: 0
    limitRadiusMm: number; // outside: abort floor (min/2); inside: abort ceiling (max/2 + margin)
    points: ProbeCirclePoint[];
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
    staged: { x: number; y: number; z: number }; // position at staging
    /** Issue #187: the body-vs-rim verdict at the side-contact Z (refused at staging when it fails). */
    stylusReach: StylusReachVerdict;
}

export function planProbeCircle(args: {
    inside?: boolean;
    center_x?: number;
    center_y?: number;
    diameter_min_mm?: number;
    diameter_max_mm?: number;
    top_z_machine?: number;
    probe_depth_mm?: number;
    points?: number;
    approach_clearance_mm?: number;
    coarse_step_mm?: number;
    fine_step_mm?: number;
    backoff_mm?: number;
    sensor_delay_ms?: number;
    confirm_passes?: number;
    rim_z_machine?: unknown;
    surface_z_machine?: unknown;
    reach_margin_mm?: unknown;
}): ProbeCirclePlan {
    const inside = args.inside === true;
    const dMin = Number(args.diameter_min_mm);
    const dMax = Number(args.diameter_max_mm);
    if (!Number.isFinite(dMin) || !Number.isFinite(dMax) || dMin <= 0 || dMax < dMin || dMax > MAX_CIRCLE_DIAMETER_MM) {
        throw new McpToolError('diameter_min_mm and diameter_max_mm are required: the operator\'s bounds '
            + `on the feature diameter (0 < min <= max <= ${MAX_CIRCLE_DIAMETER_MM}). They bound every march - a wrong guess `
            + 'aborts instead of pressing on.');
    }
    const pointCount = clampCount(args.points, CIRCLE_POINTS);
    const approach = clampTo(args.approach_clearance_mm, CIRCLE_APPROACH_CLEARANCE_MM);

    const position = getPositionSnapshot();
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the envelope.');
    }
    const staged = { x, y, z };
    const travel = requirePlanningTravel('a circle measurement', { x, y });

    let center: { x: number; y: number };
    let probeZ: number;
    let topZ: number | null;
    let startRadius: number;
    let limitRadius: number;
    if (inside) {
        // The operator has already positioned the tip inside the hole at the
        // measuring depth: the staged position is the march origin AND the
        // probing depth. No estimated centre is needed - the fit finds it.
        center = { x, y };
        probeZ = z;
        topZ = args.top_z_machine !== undefined ? Number(args.top_z_machine) : null;
        startRadius = 0;
        // The eccentricity margin: the staged position may sit off the true
        // hole centre; marches may legitimately travel farther on one side.
        limitRadius = Number((dMax / 2 + approach).toFixed(3));
    } else {
        const centerX = Number(args.center_x);
        const centerY = Number(args.center_y);
        if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
            throw new McpToolError('center_x and center_y (machine coords, operator estimate) are '
                + 'required for an outside measurement.');
        }
        center = { x: centerX, y: centerY };
        topZ = Number(args.top_z_machine);
        if (!Number.isFinite(topZ) || topZ <= 0 || topZ > MAX_STATED_MACHINE_Z_MM) {
            throw new McpToolError('top_z_machine is required: the toolhead machine Z at which the probe '
                + 'tip touches the feature TOP - a measured or operator-stated number, never a guess.');
        }
        const probeDepth = clampTo(args.probe_depth_mm, CIRCLE_PROBE_DEPTH_MM);
        probeZ = Number((topZ - probeDepth).toFixed(3));
        startRadius = Number((dMax / 2 + approach).toFixed(3));
        limitRadius = Number((dMin / 2).toFixed(3));
        if (startRadius - limitRadius < MIN_RADIAL_APPROACH_MM) {
            throw new McpToolError(`Less than ${MIN_RADIAL_APPROACH_MM} mm between the approach start radius and the `
                + 'min-diameter floor - widen approach_clearance_mm or the diameter bounds.');
        }
    }

    // Issue #187: the side contacts run at probeZ - inside a hole that is a
    // depth below its rim, and the body must still clear that rim.
    const stylusReach = requireStylusReach(args, probeZ, 'Circle probe');

    const points: ProbeCirclePoint[] = [];
    for (let i = 0; i < pointCount; i++) {
        const azimuth = (360 / pointCount) * i;
        const rad = (azimuth * Math.PI) / 180;
        const reach = inside ? limitRadius : startRadius;
        const sx = Number((center.x + (inside ? 0 : startRadius) * Math.cos(rad)).toFixed(3));
        const sy = Number((center.y + (inside ? 0 : startRadius) * Math.sin(rad)).toFixed(3));
        const fx = Number((center.x + reach * Math.cos(rad)).toFixed(3));
        const fy = Number((center.y + reach * Math.sin(rad)).toFixed(3));
        // Both ends of every march inside the toolhead's real travel: the
        // start it hops to and the far limit it would reach with no contact.
        assertWithinTravel([
            { label: `March for azimuth ${azimuth.toFixed(0)} deg, start`, x: sx, y: sy },
            { label: `March for azimuth ${azimuth.toFixed(0)} deg, far limit`, x: fx, y: fy },
        ], travel);
        points.push({ azimuthDeg: azimuth, startXY: { x: sx, y: sy } });
    }

    return {
        inside,
        center,
        diameterMinMm: dMin,
        diameterMaxMm: dMax,
        topZMachine: topZ,
        probeZ,
        hopZ: safeTraverseZ(),
        startRadiusMm: startRadius,
        limitRadiusMm: limitRadius,
        points,
        // Radial marches: 0.5 mm coarse default (up to 2 mm as a logical
        // advance - the physical moves are segmented), fewer confirm passes
        // per azimuth (procedureLimits.ts).
        ...resolveMarchParams(args, { coarse: CIRCLE_COARSE_STEP_MM, passes: CIRCLE_CONFIRM_PASSES }),
        staged,
        stylusReach,
    };
}

/** Confirm-page gcode: every commanded move of the whole star, enumerated. */
export function describeProbeCirclePlanAsGcode(plan: ProbeCirclePlan): string {
    const lines = plan.inside
        ? [
            `; TOUCH PROBE INSIDE-CIRCLE (HOLE) MEASUREMENT: ${plan.points.length} radial marches `
                + `OUTWARD from the staged position (${plan.center.x}, ${plan.center.y}, Z${plan.probeZ})`,
            '; the operator positioned the tip INSIDE the hole at the measuring depth; each march',
            '; steps outward to the wall and retreats back to the start - no hops, no Z motion',
            `; until the final vertical raise to the traverse height Z${plan.hopZ}.`,
            `; operator hole-diameter bounds ${plan.diameterMinMm}..${plan.diameterMaxMm} mm; a march `
                + `ABORTS at radius ${plan.limitRadiusMm} (max/2 + eccentricity margin) without contact`,
            '; fit yields hole diameter MINUS the probe tip effective diameter.',
        ]
        : [
            `; TOUCH PROBE CIRCLE MEASUREMENT: ${plan.points.length} radial marches around `
                + `estimated centre (${plan.center.x}, ${plan.center.y})`,
            `; operator diameter bounds ${plan.diameterMinMm}..${plan.diameterMaxMm} mm; approaches start at `
                + `radius ${plan.startRadiusMm} and ABORT at radius ${plan.limitRadiusMm} without contact`,
            `; feature top measured at toolhead Z ${plan.topZMachine}; side contacts at Z ${plan.probeZ}; `
                + `hops between points at the safe traverse height Z ${plan.hopZ} (motion law 2)`,
        ];
    lines.push(
        `; every move toward the work is sent as sensor-checked segments of <= ${MARCH_SEGMENT_MM} mm (the coarse step is the logical advance)`,
        '; EVERY LINE IS SENT INDIVIDUALLY and settle-verified; the probe feed is checked after each',
        '; march step. A probe touch during a hop or descent latches the CRASH alarm.',
        '; overtravel feed trips -> job stop + connection close + latched alarm',
        describeStylusReach(plan.stylusReach),
        'G90',
        'G53;',
    );
    for (const point of plan.points) {
        const rad = (point.azimuthDeg * Math.PI) / 180;
        lines.push(`; --- point at azimuth ${point.azimuthDeg.toFixed(1)} deg ---`);
        if (!plan.inside) {
            lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; lift to safe traverse height`);
            lines.push(`G1 X${point.startXY.x.toFixed(3)} Y${point.startXY.y.toFixed(3)} F${TRAVEL_FEED}; approach start`);
            lines.push(`G1 Z${(plan.probeZ + DESCENT_GUARD_MM).toFixed(3)} F${TRAVEL_FEED}; descend (<= ${DESCENT_SEGMENT_MM.default} mm segments (crash guard armed)) to ${DESCENT_GUARD_MM} mm above probing depth`);
            lines.push(`; ...guarded final approach: ${DESCENT_GUARD_MM} x 1 mm sensor-checked steps to Z${plan.probeZ.toFixed(3)} -`);
            lines.push(`G1 Z${plan.probeZ.toFixed(3)} F${COARSE_FEED}; ANY contact during descent aborts + latches CRASH`);
        }
        let r = plan.inside ? 0 : plan.startRadiusMm;
        let step = 0;
        const done = () => (plan.inside ? plan.limitRadiusMm - r <= 1e-9 : r - plan.limitRadiusMm <= 1e-9);
        while (!done()) {
            r = plan.inside
                ? Math.min(r + plan.coarseStepMm, plan.limitRadiusMm)
                : Math.max(r - plan.coarseStepMm, plan.limitRadiusMm);
            step += 1;
            const px = plan.center.x + r * Math.cos(rad);
            const py = plan.center.y + r * Math.sin(rad);
            lines.push(`G1 X${px.toFixed(3)} Y${py.toFixed(3)} F${COARSE_FEED}; coarse step ${step} `
                + `(radius ${r.toFixed(3)}) - settle, check probe, stop at contact`);
        }
        lines.push(`; ...on contact: retreat ${plan.coarseStepMm} mm radially until released, fine approach `
            + `in ${plan.fineStepMm} mm steps, ${plan.confirmPasses} confirm cycle(s) (lift ${plan.backoffMm} mm)`);
        lines.push(`G1 X${point.startXY.x.toFixed(3)} Y${point.startXY.y.toFixed(3)} F${TRAVEL_FEED}; retreat to `
            + `${plan.inside ? 'the march origin' : 'approach start'}`);
    }
    lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; final ${plan.inside ? 'vertical raise out of the hole' : 'lift'} to the traverse height`);
    lines.push('G54;');
    return lines.join('\n');
}

/** Kasa least-squares circle fit (cornerFit.ts, shared with probe_corner); a degenerate set of contacts aborts the procedure. */
function fitCircle(contacts: { x: number; y: number }[]): CircleFit {
    const fit = fitCircleKasa(contacts);
    if (!fit) {
        throw new ProcedureAbort('Circle fit is degenerate (contacts nearly collinear).');
    }
    return fit;
}

export async function runProbeCircleProcedure(plan: ProbeCirclePlan): Promise<object> {
    assertChannelReady('probe', 'circle probe');
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();

    const position = getPositionSnapshot();
    const here = position.machine;
    if (here.x === null || here.y === null || here.z === null
        || Math.abs(here.x - plan.staged.x) > 0.5
        || Math.abs(here.y - plan.staged.y) > 0.5
        || Math.abs(here.z - plan.staged.z) > 0.5) {
        throw new McpToolError('The machine is not at the position this envelope was staged from '
            + `(staged (${plan.staged.x}, ${plan.staged.y}, ${plan.staged.z}), now `
            + `(${here.x}, ${here.y}, ${here.z})). Stage probe_circle again.`);
    }
    if (!plan.inside && here.z < plan.hopZ - 0.5) {
        throw new McpToolError(`Current machine Z ${here.z} is below the hop height ${plan.hopZ}; `
            + 'position at or above it before staging an outside measurement.');
    }

    const phases: { phase: string; note?: string }[] = [];
    const announce = (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool: 'probe_circle', phase, note });
    };
    const releaseTimeoutMs = releaseTimeoutFor(plan.sensorDelayMs);
    const contacts: { azimuthDeg: number; x: number; y: number; radius: number; passRadii: number[]; spreadMm: number }[] = [];

    const radialXY = (azimuthRad: number, r: number) => ({
        x: Number((plan.center.x + r * Math.cos(azimuthRad)).toFixed(3)),
        y: Number((plan.center.y + r * Math.sin(azimuthRad)).toFixed(3)),
    });
    // March parametrization: s grows from 0 as the march advances toward the
    // expected wall. Outside: radius = startRadius - s (inward). Inside:
    // radius = s (outward). Travel budget per point:
    const travelBudget = plan.inside ? plan.limitRadiusMm : plan.startRadiusMm - plan.limitRadiusMm;
    const radiusAt = (s: number) => (plan.inside ? s : plan.startRadiusMm - s);

    try {
        for (const point of plan.points) {
            const rad = (point.azimuthDeg * Math.PI) / 180;
            const label = `az${point.azimuthDeg.toFixed(0)}`;

            if (!plan.inside) {
                // Reposition: contact here is NOT expected - a graze latches CRASH.
                probeFeedService.clearExpectedContact();
                await moveMachineSettled(`circle:hop:${label}`, { z: plan.hopZ }, TRAVEL_FEED);
                await moveMachineSettled(`circle:hop:${label}`, { ...point.startXY }, TRAVEL_FEED);
                // Operator law 2026-09-05: descents in <= 5 mm sensor-checked
                // segments, never one long move toward the work.
                await descendInSegments(`circle:descend:${label}`, plan.hopZ, plan.probeZ + DESCENT_GUARD_MM, 'probe', plan.sensorDelayMs);
                let gz = plan.probeZ + DESCENT_GUARD_MM;
                while (gz - plan.probeZ > 1e-9) {
                    const t0 = Date.now();
                    gz = Math.max(gz - 1, plan.probeZ);
                    await moveMachineSettled(`circle:descend-guard:${label}`, { z: gz }, COARSE_FEED);
                    const sensed = await senseAfter('probe', t0, plan.sensorDelayMs);
                    if (sensed.contact) {
                        throw new ProcedureAbort(`UNEXPECTED CONTACT during guarded descent at Z${gz.toFixed(3)} `
                            + '- something is where the plan says nothing should be. Machine held.');
                    }
                }
                announce(`start-${label}`, `approach start (${point.startXY.x}, ${point.startXY.y}) Z${plan.probeZ}`);
            } else {
                announce(`start-${label}`, `outward march from (${point.startXY.x}, ${point.startXY.y}) Z${plan.probeZ}`);
            }

            // March radially; contact on the probe channel is expected.
            probeFeedService.setExpectedContact(['probe']);
            let s = 0;
            let coarseContactS: number | null = null;
            while (travelBudget - s > 1e-9) {
                // A 2 mm radial coarse step is a logical advance: the physical
                // moves are <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts).
                const advance = await marchInSegments(
                    async (v) => moveMachineSettled(`circle:coarse:${label}`, radialXY(rad, radiusAt(v)), COARSE_FEED),
                    s, Math.min(s + plan.coarseStepMm, travelBudget), 'probe', plan.sensorDelayMs
                );
                s = advance.s;
                if (advance.sensed.contact) {
                    coarseContactS = s;
                    announce(`coarse-contact-${label}`, `radius ${radiusAt(s).toFixed(3)}`);
                    break;
                }
            }
            if (coarseContactS === null) {
                throw new ProcedureAbort(`No contact by radius ${radiusAt(travelBudget).toFixed(3)} at `
                    + `azimuth ${point.azimuthDeg.toFixed(0)} deg - the ${plan.inside ? 'hole is larger '
                        + 'than diameter_max_mm (or the start is not inside it)' : 'centre estimate or '
                        + 'diameter bounds are wrong'}, or the probe is not reporting.`);
            }

            // Retreat until released.
            let released = false;
            while (s > 1e-9 && coarseContactS - s < MAX_RETREAT_MM + 1e-9) {
                const stepStart = Date.now();
                s = Math.max(s - plan.coarseStepMm, 0);
                await moveMachineSettled(`circle:release:${label}`, radialXY(rad, radiusAt(s)), COARSE_FEED);
                const sensed = await senseReleaseAfter('probe', stepStart, releaseTimeoutMs);
                if (!sensed.contact) {
                    released = true;
                    break;
                }
            }
            if (!released) {
                throw new ProcedureAbort(`Probe still triggered ${MAX_RETREAT_MM} mm back from contact at `
                    + `azimuth ${point.azimuthDeg.toFixed(0)} deg - stuck probe or feed fault.`);
            }

            // Fine approach.
            let fineContactS: number | null = null;
            while (travelBudget - s > 1e-9) {
                const stepStart = Date.now();
                s = Math.min(s + plan.fineStepMm, travelBudget);
                await moveMachineSettled(`circle:fine:${label}`, radialXY(rad, radiusAt(s)), FINE_FEED);
                const sensed = await senseAfter('probe', stepStart, plan.sensorDelayMs);
                if (sensed.contact) {
                    fineContactS = s;
                    break;
                }
            }
            if (fineContactS === null) {
                throw new ProcedureAbort(`Fine approach lost the contact at azimuth ${point.azimuthDeg.toFixed(0)} deg.`);
            }

            // Confirm cycles on the march distance; median wins.
            const passS: number[] = [];
            const cycleLimit = Math.min(fineContactS + Math.max(0.5, plan.backoffMm), travelBudget);
            let reference = fineContactS;
            for (let pass = 1; pass <= plan.confirmPasses; pass++) {
                const liftIssuedAt = Date.now();
                s = Math.max(reference - plan.backoffMm, 0);
                await moveMachineSettled(`circle:backoff:${label}`, radialXY(rad, radiusAt(s)), FINE_FEED);
                const liftSense = await senseReleaseAfter('probe', liftIssuedAt, releaseTimeoutMs);
                if (liftSense.contact) {
                    throw new ProcedureAbort(`Probe still triggered after backing off ${plan.backoffMm} mm at `
                        + `azimuth ${point.azimuthDeg.toFixed(0)} deg - hysteresis exceeds the backoff.`);
                }
                let passContact: number | null = null;
                while (cycleLimit - s > 1e-9) {
                    const stepStart = Date.now();
                    s = Math.min(s + plan.fineStepMm, cycleLimit);
                    await moveMachineSettled(`circle:confirm:${label}`, radialXY(rad, radiusAt(s)), FINE_FEED);
                    const sensed = await senseAfter('probe', stepStart, plan.sensorDelayMs);
                    if (sensed.contact) {
                        passContact = s;
                        break;
                    }
                }
                if (passContact === null) {
                    throw new ProcedureAbort(`Confirm pass ${pass} lost the contact at azimuth `
                        + `${point.azimuthDeg.toFixed(0)} deg.`);
                }
                passS.push(passContact);
                reference = passContact;
            }
            const sorted = [...passS].sort((a, b) => a - b);
            const measuredS = sorted[Math.floor((sorted.length - 1) / 2)];
            const passRadii = passS.map((v) => Number(radiusAt(v).toFixed(3)));
            const spreadMm = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3));
            const measuredR = radiusAt(measuredS);
            const contactPoint = radialXY(rad, measuredR);
            contacts.push({
                azimuthDeg: point.azimuthDeg,
                ...contactPoint,
                radius: Number(measuredR.toFixed(3)),
                passRadii,
                spreadMm,
            });
            announce(`measured-${label}`, `radius ${measuredR.toFixed(3)} spread ${spreadMm}`);

            // Retreat radially to the march start (still expected-contact
            // until physically clear).
            await moveMachineSettled(`circle:retreat:${label}`, { ...point.startXY }, TRAVEL_FEED);
        }

        // Final raise; reposition rules apply again.
        probeFeedService.clearExpectedContact();
        await moveMachineSettled('circle:final-lift', { z: plan.hopZ }, TRAVEL_FEED);
        announce('final-lift', `Z${plan.hopZ}`);

        const fit = fitCircle(contacts.map((c) => ({ x: c.x, y: c.y })));
        const fittedDiameter = Number((fit.radius * 2).toFixed(3));
        // Outside: fitted = feature + tip. Inside: fitted = hole - tip.
        const tipMin = plan.inside
            ? Number(Math.max(plan.diameterMinMm - fittedDiameter, 0).toFixed(3))
            : Number(Math.max(fittedDiameter - plan.diameterMaxMm, 0).toFixed(3));
        const tipMax = plan.inside
            ? Number(Math.max(plan.diameterMaxMm - fittedDiameter, 0).toFixed(3))
            : Number(Math.max(fittedDiameter - plan.diameterMinMm, 0).toFixed(3));
        const worstSpread = Math.max(...contacts.map((c) => c.spreadMm));
        return {
            inside: plan.inside,
            stylusReach: plan.stylusReach,
            tipCalibration,
            contacts: contacts.map((r) => ({ ...r, toolheadMachineZ: plan.probeZ, ...projectToolTipZ(plan.probeZ, tipCalibration) })),
            fit: {
                center: fit.center,
                fittedDiameterMm: fittedDiameter,
                rmsResidualMm: fit.rmsResidual,
                maxResidualMm: fit.maxResidual,
                residualsMm: fit.residuals,
            },
            centerOffsetFromEstimate: {
                x: Number((fit.center.x - plan.center.x).toFixed(3)),
                y: Number((fit.center.y - plan.center.y).toFixed(3)),
            },
            tipEffectiveDiameterMm: { min: tipMin, max: tipMax },
            phases,
            note: plan.inside
                ? `Fitted hole centre machine (${fit.center.x}, ${fit.center.y}), fitted diameter `
                    + `${fittedDiameter} mm = hole MINUS probe tip (inseparable without one known: if the `
                    + `hole is truly ${plan.diameterMinMm}..${plan.diameterMaxMm} mm, the tip's effective `
                    + `diameter is ${tipMin}..${tipMax} mm). Fit residuals rms ${fit.rmsResidual} / max `
                    + `${fit.maxResidual} mm. Worst per-point confirm spread ${worstSpread} mm. All in `
                    + 'MACHINE coordinates.'
                : `Fitted centre machine (${fit.center.x}, ${fit.center.y}), COMBINED diameter `
                    + `${fittedDiameter} mm (feature + probe tip - inseparable without one known: if the `
                    + `feature is truly ${plan.diameterMinMm}..${plan.diameterMaxMm} mm, the tip's effective `
                    + `diameter is ${tipMin}..${tipMax} mm). Fit residuals rms ${fit.rmsResidual} / max `
                    + `${fit.maxResidual} mm - direction-dependent residuals mean an out-of-round tip or `
                    + `feature. Worst per-point confirm spread ${worstSpread} mm. All in MACHINE coordinates.`,
            warning: fit.maxResidual > CIRCLE_RESIDUAL_WARN_MM
                ? `Max fit residual exceeds ${CIRCLE_RESIDUAL_WARN_MM} mm: the feature or the probe tip is significantly `
                    + 'out of round, or a contact was bad. Inspect residualsMm by azimuth.'
                : undefined,
        };
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (!isTrip) {
            try {
                // Abort retreat: lift straight up only if the probe reads
                // released; a stuck-triggered probe means physical contact -
                // leave the machine where it is for the operator. Inside a
                // hole, retreat to the march origin first so the vertical
                // exit is the entry path.
                const reading = probeFeedService.getReading('probe');
                if (!reading || !reading.triggered) {
                    if (plan.inside) {
                        await moveMachineSettled('circle:abort-recentre', { x: plan.center.x, y: plan.center.y }, TRAVEL_FEED);
                        announce('abort-recentred', `(${plan.center.x}, ${plan.center.y})`);
                    }
                    await abortRaiseToTop('circle', (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`));
                } else {
                    announce('abort-held', 'probe still triggered - holding position for the operator');
                }
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            throw new McpToolError(`Circle probe aborted: ${err.message} Phases completed: ${JSON.stringify(phases)}`);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
