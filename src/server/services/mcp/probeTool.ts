/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planProbePoint takes the
// probe_point arguments verbatim).
import { mcpBroadcast } from './index';
import { TRAVERSE_Z_TOLERANCE_MM, mayDescend } from './traversePlan';
import { probeFeedService } from './probeFeed';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    TRAVEL_FEED,
    assertChannelReady,
    assertMachineReadyForProcedure,
    moveMachineSettled,
    marchInSegments,
    senseAfter,
    senseReleaseAfter,
    isProcedureAbort,
    abortRaiseToTop,
    knownMachinePosition,
} from './probing';
import { McpToolError } from './registry';
import { StylusReachVerdict, describeStylusReach } from './stylusReach';
import { requireStylusReach } from './stylusReachGuard';
import { TipCalibrationSnapshot, projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { MIN_USEFUL_MARCH_MM, clampRay } from './machineTravel';
import { MARCH_SEGMENT_MM, MARCH_TRAVEL_MM, releaseTimeoutFor, resolveMarchParams, within } from './procedureLimits';
import { getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

// Point probing with the spindle-mounted touch probe (normally-open, probe
// feed channel, inverted polarity handled by the feed): a single-axis
// sensor-gated march from the CURRENT position, using the same staged
// mechanics hardware-proven on the tool setter - coarse steps to contact,
// retreat to release, fine steps, then quick lift-and-retest confirm cycles;
// the result is the median contact coordinate with the spread reported.
//
// The envelope the operator approves is anchored to the position at staging:
// the runner re-verifies it before moving, so the page is always truthful.

export type ProbeAxis = 'x' | 'y' | 'z';

export interface ProbePointPlan {
    axis: ProbeAxis;
    direction: 1 | -1;
    start: { x: number; y: number; z: number }; // machine coords at staging
    maxTravelMm: number;
    limitCoord: number; // start[axis] + direction * maxTravel, clamped to the toolhead travel
    /** Which travel end shortened the march, when one did - shown on the confirm page. */
    travelClippedBy: string | null;
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
    /** Issue #187: the body-vs-rim verdict at the deepest commanded Z (refused at staging when it fails). */
    stylusReach: StylusReachVerdict;
}

export function planProbePoint(args: {
    axis?: string;
    direction?: number;
    max_travel_mm?: number;
    coarse_step_mm?: number;
    fine_step_mm?: number;
    backoff_mm?: number;
    sensor_delay_ms?: number;
    confirm_passes?: number;
    rim_z_machine?: unknown;
    surface_z_machine?: unknown;
    reach_margin_mm?: unknown;
}): ProbePointPlan {
    const axis = String(args.axis || '').toLowerCase() as ProbeAxis;
    if (!['x', 'y', 'z'].includes(axis)) {
        throw new McpToolError('axis must be "x", "y" or "z".');
    }
    const direction = Number(args.direction);
    if (direction !== 1 && direction !== -1) {
        throw new McpToolError('direction must be 1 or -1 (the sign of travel along the axis).');
    }
    if (axis === 'z' && direction === 1) {
        throw new McpToolError('Z probing is downward only (direction -1).');
    }
    const maxTravelMm = Number(args.max_travel_mm);
    if (!within(maxTravelMm, MARCH_TRAVEL_MM)) {
        throw new McpToolError(`max_travel_mm is required: how far the probe may march before aborting (${MARCH_TRAVEL_MM.min}-${MARCH_TRAVEL_MM.max}).`);
    }

    const position = getPositionSnapshot();
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the probe envelope.');
    }
    // A start within tolerance of the traverse height IS the traverse height:
    // home reports 327.999 for Z328, and using the raw value put a 1 um
    // 'retreat to 327.999' followed by 'finish at 328.000' on the confirm page
    // (operator, 2026-09-14). Commanded positions never carry heartbeat noise.
    const traverseZ = safeTraverseZ();
    const startZ = z >= traverseZ - TRAVERSE_Z_TOLERANCE_MM ? traverseZ : z;

    // The far limit of the march stays inside the toolhead's real travel
    // (machineTravel.ts; Z never below the bed at machine 0). Until
    // 2026-09-21 this was the garbage-beat filter's -25..size+40, which on an
    // A350 let a -X march plan 6 mm past the end of the machine. A march the
    // travel shortened says so on the confirm page: a face beyond the
    // shortened limit would otherwise read as "no contact".
    const startCoord = { x, y, z: startZ }[axis];
    let travel = maxTravelMm;
    let clippedBy: string | null = null;
    if (axis === 'z') {
        if (startCoord - travel < 0) {
            travel = Number(Math.max(0, startCoord).toFixed(3));
            clippedBy = 'machine Z 0 (the bed)';
        }
    } else {
        const unit = { x: axis === 'x' ? direction : 0, y: axis === 'y' ? direction : 0 };
        const ray = clampRay({ x, y }, unit, maxTravelMm, requirePlanningTravel('a point probe', { x, y }).limits);
        travel = ray.travelMm;
        clippedBy = ray.clippedBy;
    }
    if (travel < MIN_USEFUL_MARCH_MM) {
        throw new McpToolError(`The march, clamped to the toolhead travel, is under ${MIN_USEFUL_MARCH_MM} mm - already at `
            + `${clippedBy || 'the travel limit'} along ${axis.toUpperCase()}${direction > 0 ? '+' : '-'}.`);
    }
    const limitCoord = startCoord + direction * travel;

    return {
        axis,
        direction: direction as 1 | -1,
        start: { x, y, z: startZ },
        maxTravelMm,
        limitCoord: Number(limitCoord.toFixed(3)),
        travelClippedBy: clippedBy,
        // Issue #187: a -Z march's deepest Z is its limit; a side march runs
        // at the start Z, which inside a pocket is already a depth.
        stylusReach: requireStylusReach(args, axis === 'z' ? Number(limitCoord.toFixed(3)) : startZ, 'Point probe'),
        // Coarse / fine / backoff / sensor delay / confirm passes, clamped to
        // the named limits (procedureLimits.ts; operator law 2026-09-05: never 2 mm).
        ...resolveMarchParams(args),
    };
}

/** Confirm-page gcode: every stepped command as it would execute. */
export function describeProbePlanAsGcode(plan: ProbePointPlan): string {
    const word = plan.axis.toUpperCase();
    const lines = [
        '; TOUCH PROBE POINT MEASUREMENT (server-driven, sensor-gated on the probe channel)',
        `; every move toward the work is sent as sensor-checked segments of <= ${MARCH_SEGMENT_MM} mm (the coarse step is the logical advance)`,
        '; EVERY LINE IS SENT INDIVIDUALLY: after each move settles, the probe feed is checked',
        '; before the next line. The march stops at first contact; running the full ladder',
        `; without contact ABORTS at the travel limit ${word} ${plan.limitCoord.toFixed(3)}${plan.travelClippedBy
            ? ` (requested ${plan.maxTravelMm} mm: shortened by ${plan.travelClippedBy} - a face beyond it reads as no contact)` : ''}.`,
        `; anchored at machine (${plan.start.x.toFixed(2)}, ${plan.start.y.toFixed(2)}, ${plan.start.z.toFixed(2)})`
            + ' - re-verified before any motion',
        '; overtravel feed trips -> job stop + connection close + latched alarm',
        describeStylusReach(plan.stylusReach),
        'G90',
        'G53;',
    ];
    let coord = plan.start[plan.axis];
    let step = 0;
    const towards = (value: number) => (plan.direction === 1
        ? Math.min(value, plan.limitCoord) : Math.max(value, plan.limitCoord));
    while (Math.abs(coord - plan.limitCoord) > 1e-9) {
        coord = towards(coord + plan.direction * plan.coarseStepMm);
        step += 1;
        lines.push(`G1 ${word}${coord.toFixed(3)} F${COARSE_FEED}; coarse step ${step} - settle, check probe, stop at contact`);
    }
    lines.push(
        `; ...on contact: retreat ${plan.coarseStepMm} mm steps until released, approach in ${plan.fineStepMm} mm`,
        `; steps to contact, then ${plan.confirmPasses} quick confirm cycles (lift ${plan.backoffMm} mm, wait for release,`,
        `; re-approach). Result = median contact ${word} (spread reported).`,
        `G1 ${word}${plan.start[plan.axis].toFixed(3)} F${TRAVEL_FEED}; retreat to the start ${word} when done (an ABORT raises straight up to the traverse height instead)`,
    );
    const traverse = safeTraverseZ();
    if (plan.start.z < traverse) {
        lines.push(`G1 Z${traverse.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (motion law 2)`);
    }
    lines.push('G54;');
    return lines.join('\n');
}

export interface ProbePointResult {
    axis: ProbeAxis;
    direction: number;
    contactMachine: { x: number; y: number; z: number };
    tipMachineZ?: number | null;
    tipCalibration?: TipCalibrationSnapshot;
    contactWorkOffsetApplied: string;
    confirmPassContacts: number[];
    spreadMm: number;
    phases: { phase: string; coord: number; note?: string }[];
    stylusReach: StylusReachVerdict;
    note: string;
    warning?: string;
}

export async function runProbePointProcedure(plan: ProbePointPlan): Promise<object> {
    assertChannelReady('probe', 'touch probe');
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();
    // The probe is EXPECTED to touch during this procedure; the toolsetter
    // firing instead would be a collision (crash guard). Cleared in finally.
    probeFeedService.setExpectedContact(['probe']);

    const position = getPositionSnapshot();
    const here = position.machine;
    if (here.x === null || here.y === null || here.z === null
        || Math.abs(here.x - plan.start.x) > 0.5
        || Math.abs(here.y - plan.start.y) > 0.5
        || Math.abs(here.z - plan.start.z) > 0.5) {
        throw new McpToolError('The machine is not at the position this probe envelope was staged from '
            + `(staged (${plan.start.x}, ${plan.start.y}, ${plan.start.z}), now `
            + `(${here.x}, ${here.y}, ${here.z})). Stage probe_point again from the current position.`);
    }

    const word = plan.axis.toUpperCase();
    const phases: { phase: string; coord: number; note?: string }[] = [];
    const announce = (phase: string, coord: number, note?: string) => {
        phases.push({ phase, coord: Number(coord.toFixed(3)), note });
        mcpBroadcast('mcp:activity', { tool: 'probe_point', phase, axis: plan.axis, coord: Number(coord.toFixed(3)), note });
    };
    const releaseTimeoutMs = releaseTimeoutFor(plan.sensorDelayMs);
    const startCoord = plan.start[plan.axis];
    const towards = (value: number) => (plan.direction === 1
        ? Math.min(value, plan.limitCoord) : Math.max(value, plan.limitCoord));
    const move = async (tool: string, coord: number, feed: number) => {
        await moveMachineSettled(tool, { [plan.axis]: coord } as { x?: number; y?: number; z?: number }, feed);
    };

    let current = startCoord;
    try {
        // Coarse march to first contact.
        let coarseContact: number | null = null;
        while (Math.abs(current - plan.limitCoord) > 1e-9) {
            // The coarse step is the logical advance; the physical moves are
            // <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts).
            const advance = await marchInSegments(
                async (v) => move('probe:coarse', v, COARSE_FEED),
                current, towards(current + plan.direction * plan.coarseStepMm), 'probe', plan.sensorDelayMs
            );
            current = advance.s;
            if (advance.sensed.contact) {
                coarseContact = current;
                announce('coarse-contact', current, `probe "${advance.sensed.reading?.value}"`);
                break;
            }
        }
        if (coarseContact === null) {
            throw new ProcedureAbort(`Reached the travel limit ${word} ${plan.limitCoord.toFixed(3)} without `
                + 'contact - nothing to probe within max_travel_mm, or the probe is not reporting.');
        }

        // Retreat until released.
        let released = false;
        while (Math.abs(current - startCoord) > 1e-9 && Math.abs(current - coarseContact) < MAX_RETREAT_MM + 1e-9) {
            const stepStart = Date.now();
            current = plan.direction === 1
                ? Math.max(current - plan.coarseStepMm, startCoord)
                : Math.min(current + plan.coarseStepMm, startCoord);
            await move('probe:release', current, COARSE_FEED);
            const sensed = await senseReleaseAfter('probe', stepStart, releaseTimeoutMs);
            if (!sensed.contact) {
                released = true;
                announce('released', current);
                break;
            }
        }
        if (!released) {
            throw new ProcedureAbort(`Probe still reads triggered ${MAX_RETREAT_MM} mm back from first `
                + 'contact - stuck probe or feed fault.');
        }

        // Fine approach.
        let fineContact: number | null = null;
        while (Math.abs(current - plan.limitCoord) > 1e-9) {
            const stepStart = Date.now();
            current = towards(current + plan.direction * plan.fineStepMm);
            await move('probe:fine', current, FINE_FEED);
            const sensed = await senseAfter('probe', stepStart, plan.sensorDelayMs);
            if (sensed.contact) {
                fineContact = current;
                announce('fine-contact', current, `probe "${sensed.reading?.value}"`);
                break;
            }
        }
        if (fineContact === null) {
            throw new ProcedureAbort('Fine approach reached the travel limit without re-contact after a '
                + 'coarse contact - inconsistent probe.');
        }

        // Quick lift-and-retest confirm cycles; median wins, spread reported.
        const passContacts: number[] = [];
        const cycleLimit = towards(fineContact + plan.direction * Math.max(0.5, plan.backoffMm));
        let reference = fineContact;
        for (let pass = 1; pass <= plan.confirmPasses; pass++) {
            const liftIssuedAt = Date.now();
            current = reference - plan.direction * plan.backoffMm;
            await move('probe:backoff', current, FINE_FEED);
            const liftSense = await senseReleaseAfter('probe', liftIssuedAt, releaseTimeoutMs);
            if (liftSense.contact) {
                throw new ProcedureAbort(`Probe still triggered ${releaseTimeoutMs} ms after backing off `
                    + `${plan.backoffMm} mm - hysteresis exceeds the backoff. Rerun with a larger backoff_mm.`);
            }
            let passContact: number | null = null;
            while (Math.abs(current - cycleLimit) > 1e-9) {
                const stepStart = Date.now();
                current = plan.direction === 1
                    ? Math.min(current + plan.fineStepMm, cycleLimit)
                    : Math.max(current - plan.fineStepMm, cycleLimit);
                await move('probe:confirm', current, FINE_FEED);
                const sensed = await senseAfter('probe', stepStart, plan.sensorDelayMs);
                if (sensed.contact) {
                    passContact = current;
                    break;
                }
            }
            if (passContact === null) {
                throw new ProcedureAbort(`Confirm pass ${pass} went 0.5 mm past the first contact without `
                    + 're-contact - inconsistent probe.');
            }
            passContacts.push(Number(passContact.toFixed(3)));
            announce(`confirm-${pass}`, passContact, `of ${plan.confirmPasses}`);
            reference = passContact;
        }
        const sorted = [...passContacts].sort((a, b) => a - b);
        const measured = sorted[Math.floor((sorted.length - 1) / 2)];
        const spreadMm = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3));
        announce('measured', measured, `median of [${passContacts.join(', ')}], spread ${spreadMm} mm`);

        // Retreat along the probed axis to the start coordinate, then finish
        // at the safe traverse height (operator request 2026-09-02) so no
        // separate staged lift is needed before the next reposition.
        await move('probe:retreat', startCoord, TRAVEL_FEED);
        announce('retreated', startCoord);
        const traverse = safeTraverseZ();
        if (plan.start.z < traverse) {
            await moveMachineSettled('probe:raise', { z: traverse }, TRAVEL_FEED);
            announce('raised', traverse, 'safe traverse height');
        }

        const contactMachine = { ...plan.start, [plan.axis]: measured };
        const after = getPositionSnapshot();
        const result: ProbePointResult = {
            axis: plan.axis,
            direction: plan.direction,
            contactMachine,
            ...projectToolTipZ(contactMachine.z, tipCalibration),
            contactWorkOffsetApplied: `work = machine + originOffset (${JSON.stringify(after.originOffset)})`,
            confirmPassContacts: passContacts,
            spreadMm,
            phases,
            stylusReach: plan.stylusReach,
            note: `Probe contact at machine ${word} ${measured.toFixed(3)} - median of ${plan.confirmPasses} `
                + `passes [${passContacts.join(', ')}], spread ${spreadMm} mm (+/- ${plan.fineStepMm} mm step `
                + 'resolution, minus the probe tip radius on side probes - the tip touches before its centre).',
            warning: spreadMm > plan.fineStepMm + 1e-9
                ? `Confirm passes spread ${spreadMm} mm exceeds one fine step - feed timing was unstable; `
                    + 'consider more confirm_passes or a longer sensor_delay_ms.'
                : undefined,
        };
        return result as unknown as object;
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (!isTrip) {
            try {
                // Back off along the probed axis to the start (away from the
                // face) - unless that leg would DESCEND, i.e. the abort came
                // before a Z march ever left its start (traverse refused,
                // station check failed): then the raise is the whole retreat.
                const known = knownMachinePosition().position;
                if (plan.axis !== 'z' || !mayDescend(known.z, startCoord)) {
                    await move('probe:abort-retreat', startCoord, TRAVEL_FEED);
                    announce('abort-retreated', startCoord);
                } else {
                    announce('abort-retreat-skipped', startCoord, 'the start coordinate is below the head - not descending on an abort');
                }
                await abortRaiseToTop('probe', (phase, z, note) => announce(phase, z ?? startCoord, note), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // The abort itself already reports; retreat failure is logged
                // by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            throw new McpToolError(`Probe run aborted: ${err.message} Phases completed: ${JSON.stringify(phases)}`);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
