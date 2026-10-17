/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planProbeVector takes the
// probe_vector arguments verbatim).
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
    abortRaiseToTop,
    knownMachinePosition,
} from './probing';
import { McpToolError } from './registry';
import { projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { MIN_USEFUL_MARCH_MM, clampRay } from './machineTravel';
import { MARCH_SEGMENT_MM, MARCH_TRAVEL_MM, releaseTimeoutFor, resolveMarchParams, within } from './procedureLimits';
import { getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

// Vector probing: a sensor-gated march from the CURRENT position along an
// ARBITRARY direction (any XY heading, optionally angled downward - never
// upward), with the same hardware-proven mechanics as probe_point: coarse
// steps to contact, retreat to release, fine steps, lift-and-retest confirm
// cycles, median + spread. probe_point is the axis-aligned special case;
// this is the general primitive (operator-requested 2026-09-02) that
// composes into edges, chamfers, polygons and inside-a-hole checks. The
// march is parametrized by scalar distance along the unit vector, so every
// commanded position lies on the approved segment.

export interface ProbeVectorPlan {
    unit: { x: number; y: number; z: number };
    start: { x: number; y: number; z: number }; // machine coords at staging
    maxTravelMm: number; // after clamping to the toolhead travel
    requestedTravelMm: number;
    /** Which travel end shortened the march, when one did - shown on the confirm page. */
    travelClippedBy: string | null;
    limit: { x: number; y: number; z: number };
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
}

export function planProbeVector(args: {
    dx?: number;
    dy?: number;
    dz?: number;
    max_travel_mm?: number;
    coarse_step_mm?: number;
    fine_step_mm?: number;
    backoff_mm?: number;
    sensor_delay_ms?: number;
    confirm_passes?: number;
}): ProbeVectorPlan {
    const dx = Number(args.dx) || 0;
    const dy = Number(args.dy) || 0;
    const dz = Number(args.dz) || 0;
    const norm = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(norm) || norm < 1e-9) {
        throw new McpToolError('Direction vector required: at least one of dx, dy, dz non-zero. '
            + 'Magnitude is ignored - only the direction matters.');
    }
    if (dz > 1e-9) {
        throw new McpToolError('Upward probing (dz > 0) is refused - the probe cannot measure the gantry.');
    }
    const unit = { x: dx / norm, y: dy / norm, z: dz / norm };

    const requested = Number(args.max_travel_mm);
    if (!within(requested, MARCH_TRAVEL_MM)) {
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
    const start = { x, y, z: startZ };

    // Clamp the travel SCALAR so the entire segment stays inside the
    // toolhead's real XY travel (machineTravel.ts) and never below machine
    // Z 0 - clamping per-axis would change the direction. Until 2026-09-21
    // this used the garbage-beat filter's -25..size+40, which on an A350 let a
    // -X march plan 6 mm past the end of the machine. What the clamp costs is
    // carried in the plan and shown on the confirm page: a face the shortened
    // march cannot reach would otherwise read as "no contact".
    const ray = clampRay(start, unit, requested, requirePlanningTravel('a vector probe', { x, y }).limits);
    let travel = ray.travelMm;
    let clippedBy = ray.clippedBy;
    if (unit.z < -1e-9) {
        const toFloor = (0 - start.z) / unit.z;
        if (toFloor < travel) {
            travel = Number(Math.max(0, toFloor).toFixed(3));
            clippedBy = 'machine Z 0 (the bed)';
        }
    }
    if (!Number.isFinite(travel) || travel < MIN_USEFUL_MARCH_MM) {
        throw new McpToolError(`The march, clamped to the toolhead travel, is under ${MIN_USEFUL_MARCH_MM} mm - already at `
            + `${clippedBy || 'the travel limit'} along this direction.`);
    }

    return {
        unit: {
            x: Number(unit.x.toFixed(6)),
            y: Number(unit.y.toFixed(6)),
            z: Number(unit.z.toFixed(6)),
        },
        start,
        maxTravelMm: travel,
        requestedTravelMm: requested,
        travelClippedBy: clippedBy,
        limit: {
            x: Number((start.x + unit.x * travel).toFixed(3)),
            y: Number((start.y + unit.y * travel).toFixed(3)),
            z: Number((start.z + unit.z * travel).toFixed(3)),
        },
        // Coarse / fine / backoff / sensor delay / confirm passes, clamped to
        // the named limits (procedureLimits.ts; operator law 2026-09-05: never 2 mm).
        ...resolveMarchParams(args),
    };
}

function pointAt(plan: ProbeVectorPlan, s: number): { x: number; y: number; z: number } {
    return {
        x: Number((plan.start.x + plan.unit.x * s).toFixed(3)),
        y: Number((plan.start.y + plan.unit.y * s).toFixed(3)),
        z: Number((plan.start.z + plan.unit.z * s).toFixed(3)),
    };
}

/** Which axes the move actually needs - pure-XY vectors never command Z. */
function moveWords(plan: ProbeVectorPlan, s: number): { x?: number; y?: number; z?: number } {
    const p = pointAt(plan, s);
    const words: { x?: number; y?: number; z?: number } = {};
    if (Math.abs(plan.unit.x) > 1e-9) {
        words.x = p.x;
    }
    if (Math.abs(plan.unit.y) > 1e-9) {
        words.y = p.y;
    }
    if (Math.abs(plan.unit.z) > 1e-9) {
        words.z = p.z;
    }
    return words;
}

/** Confirm-page gcode: every stepped command as it would execute. */
export function describeProbeVectorPlanAsGcode(plan: ProbeVectorPlan): string {
    const dir = `(${plan.unit.x}, ${plan.unit.y}, ${plan.unit.z})`;
    const lines = [
        '; TOUCH PROBE VECTOR MEASUREMENT (server-driven, sensor-gated on the probe channel)',
        `; march along unit direction ${dir} from the staging position, max travel ${plan.maxTravelMm} mm${
            plan.travelClippedBy
                ? ` (requested ${plan.requestedTravelMm}: shortened by ${plan.travelClippedBy} - a face beyond it reads as no contact)` : ''}`,
        `; every move toward the work is sent as sensor-checked segments of <= ${MARCH_SEGMENT_MM} mm (the coarse step is the logical advance)`,
        '; EVERY LINE IS SENT INDIVIDUALLY: after each move settles, the probe feed is checked',
        '; before the next line. The march stops at first contact; running the full ladder',
        `; without contact ABORTS at (${plan.limit.x}, ${plan.limit.y}, ${plan.limit.z}).`,
        `; anchored at machine (${plan.start.x.toFixed(2)}, ${plan.start.y.toFixed(2)}, ${plan.start.z.toFixed(2)})`
            + ' - re-verified before any motion',
        '; overtravel feed trips -> job stop + connection close + latched alarm',
        'G90',
        'G53;',
    ];
    let s = 0;
    let step = 0;
    while (plan.maxTravelMm - s > 1e-9) {
        s = Math.min(s + plan.coarseStepMm, plan.maxTravelMm);
        step += 1;
        const w = moveWords(plan, s);
        const wordText = [
            w.x !== undefined ? `X${w.x.toFixed(3)}` : '',
            w.y !== undefined ? `Y${w.y.toFixed(3)}` : '',
            w.z !== undefined ? `Z${w.z.toFixed(3)}` : '',
        ].filter(Boolean).join(' ');
        lines.push(`G1 ${wordText} F${COARSE_FEED}; coarse step ${step} (${s.toFixed(3)} mm along) - settle, check probe, stop at contact`);
    }
    lines.push(
        `; ...on contact: retreat ${plan.coarseStepMm} mm steps along the reverse vector until released,`,
        `; approach in ${plan.fineStepMm} mm steps to contact, then ${plan.confirmPasses} quick confirm cycles`,
        `; (lift ${plan.backoffMm} mm along the reverse vector, wait for release, re-approach).`,
        '; Result = median contact distance -> machine XYZ (spread reported).',
        `G1 X${plan.start.x.toFixed(3)} Y${plan.start.y.toFixed(3)} Z${plan.start.z.toFixed(3)} F${TRAVEL_FEED}; retreat to the start when done (an ABORT raises straight up to the traverse height instead)`,
    );
    const traverse = safeTraverseZ();
    if (plan.start.z < traverse) {
        lines.push(`G1 Z${traverse.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (motion law 2)`);
    }
    lines.push('G54;');
    return lines.join('\n');
}

export async function runProbeVectorProcedure(plan: ProbeVectorPlan): Promise<object> {
    assertChannelReady('probe', 'vector probe');
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();
    probeFeedService.setExpectedContact(['probe']);

    const position = getPositionSnapshot();
    const here = position.machine;
    if (here.x === null || here.y === null || here.z === null
        || Math.abs(here.x - plan.start.x) > 0.5
        || Math.abs(here.y - plan.start.y) > 0.5
        || Math.abs(here.z - plan.start.z) > 0.5) {
        throw new McpToolError('The machine is not at the position this probe envelope was staged from '
            + `(staged (${plan.start.x}, ${plan.start.y}, ${plan.start.z}), now `
            + `(${here.x}, ${here.y}, ${here.z})). Stage probe_vector again from the current position.`);
    }

    const phases: { phase: string; s: number; note?: string }[] = [];
    const announce = (phase: string, s: number, note?: string) => {
        phases.push({ phase, s: Number(s.toFixed(3)), note });
        mcpBroadcast('mcp:activity', { tool: 'probe_vector', phase, s: Number(s.toFixed(3)), note });
    };
    const releaseTimeoutMs = releaseTimeoutFor(plan.sensorDelayMs);
    const move = async (tool: string, s: number, feed: number) => {
        await moveMachineSettled(tool, moveWords(plan, s), feed);
    };

    let s = 0;
    try {
        // Coarse march to first contact.
        let coarseContactS: number | null = null;
        while (plan.maxTravelMm - s > 1e-9) {
            // The coarse step is the logical advance; the physical moves are
            // <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts).
            const advance = await marchInSegments(
                async (v) => move('probe-vec:coarse', v, COARSE_FEED),
                s, Math.min(s + plan.coarseStepMm, plan.maxTravelMm), 'probe', plan.sensorDelayMs
            );
            s = advance.s;
            if (advance.sensed.contact) {
                coarseContactS = s;
                announce('coarse-contact', s, `probe "${advance.sensed.reading?.value}"`);
                break;
            }
        }
        if (coarseContactS === null) {
            throw new ProcedureAbort(`Reached the travel limit ${plan.maxTravelMm.toFixed(3)} mm without `
                + 'contact - nothing to probe within max_travel_mm, or the probe is not reporting.');
        }

        // Retreat until released.
        let released = false;
        while (s > 1e-9 && coarseContactS - s < MAX_RETREAT_MM + 1e-9) {
            const stepStart = Date.now();
            s = Math.max(s - plan.coarseStepMm, 0);
            await move('probe-vec:release', s, COARSE_FEED);
            const sensed = await senseReleaseAfter('probe', stepStart, releaseTimeoutMs);
            if (!sensed.contact) {
                released = true;
                announce('released', s);
                break;
            }
        }
        if (!released) {
            throw new ProcedureAbort(`Probe still reads triggered ${MAX_RETREAT_MM} mm back from first `
                + 'contact - stuck probe or feed fault.');
        }

        // Fine approach.
        let fineContactS: number | null = null;
        while (plan.maxTravelMm - s > 1e-9) {
            const stepStart = Date.now();
            s = Math.min(s + plan.fineStepMm, plan.maxTravelMm);
            await move('probe-vec:fine', s, FINE_FEED);
            const sensed = await senseAfter('probe', stepStart, plan.sensorDelayMs);
            if (sensed.contact) {
                fineContactS = s;
                announce('fine-contact', s, `probe "${sensed.reading?.value}"`);
                break;
            }
        }
        if (fineContactS === null) {
            throw new ProcedureAbort('Fine approach reached the travel limit without re-contact after a '
                + 'coarse contact - inconsistent probe.');
        }

        // Quick lift-and-retest confirm cycles; median wins, spread reported.
        const passContacts: number[] = [];
        const cycleLimit = Math.min(fineContactS + Math.max(0.5, plan.backoffMm), plan.maxTravelMm);
        let reference = fineContactS;
        for (let pass = 1; pass <= plan.confirmPasses; pass++) {
            const liftIssuedAt = Date.now();
            s = Math.max(reference - plan.backoffMm, 0);
            await move('probe-vec:backoff', s, FINE_FEED);
            const liftSense = await senseReleaseAfter('probe', liftIssuedAt, releaseTimeoutMs);
            if (liftSense.contact) {
                throw new ProcedureAbort(`Probe still triggered ${releaseTimeoutMs} ms after backing off `
                    + `${plan.backoffMm} mm - hysteresis exceeds the backoff. Rerun with a larger backoff_mm.`);
            }
            let passContact: number | null = null;
            while (cycleLimit - s > 1e-9) {
                const stepStart = Date.now();
                s = Math.min(s + plan.fineStepMm, cycleLimit);
                await move('probe-vec:confirm', s, FINE_FEED);
                const sensed = await senseAfter('probe', stepStart, plan.sensorDelayMs);
                if (sensed.contact) {
                    passContact = s;
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
        const measuredS = sorted[Math.floor((sorted.length - 1) / 2)];
        const spreadMm = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3));
        announce('measured', measuredS, `median of [${passContacts.join(', ')}], spread ${spreadMm} mm`);

        // Retreat along the reverse vector to the start, then finish at
        // the safe traverse height (operator request 2026-09-02).
        await move('probe-vec:retreat', 0, TRAVEL_FEED);
        announce('retreated', 0);
        const traverse = safeTraverseZ();
        if (plan.start.z < traverse) {
            await moveMachineSettled('probe-vec:raise', { z: traverse }, TRAVEL_FEED);
            announce('raised', 0, `safe traverse height Z${traverse}`);
        }

        const contactMachine = pointAt(plan, measuredS);
        const after = getPositionSnapshot();
        return {
            direction: plan.unit,
            contactDistanceMm: measuredS,
            contactMachine,
            ...projectToolTipZ(contactMachine.z, tipCalibration),
            contactWorkOffsetApplied: `work = machine + originOffset (${JSON.stringify(after.originOffset)})`,
            confirmPassContacts: passContacts,
            spreadMm,
            phases,
            note: `Probe contact ${measuredS.toFixed(3)} mm along (${plan.unit.x}, ${plan.unit.y}, `
                + `${plan.unit.z}) from the start -> machine (${contactMachine.x}, ${contactMachine.y}, `
                + `${contactMachine.z}) - median of ${plan.confirmPasses} passes [${passContacts.join(', ')}], `
                + `spread ${spreadMm} mm (+/- ${plan.fineStepMm} mm step resolution, minus the probe tip `
                + 'radius on lateral probes - the tip touches before its centre).',
            warning: spreadMm > plan.fineStepMm + 1e-9
                ? `Confirm passes spread ${spreadMm} mm exceeds one fine step - feed timing was unstable; `
                    + 'consider more confirm_passes or a longer sensor_delay_ms.'
                : undefined,
        };
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (!isTrip) {
            try {
                // Back along the vector to the start - unless the start is
                // BELOW the head (abort before the march began): no descent
                // on an abort, the raise is the whole retreat.
                const known = knownMachinePosition().position;
                if (!mayDescend(known.z, plan.start.z)) {
                    await move('probe-vec:abort-retreat', 0, TRAVEL_FEED);
                    announce('abort-retreated', 0);
                } else {
                    announce('abort-retreat-skipped', 0, 'the march start is below the head - not descending on an abort');
                }
                await abortRaiseToTop('probe-vec', (phase, z, note) => announce(phase, 0, z === null ? note : `Z${z.toFixed(3)} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (err instanceof ProcedureAbort) {
            throw new McpToolError(`Vector probe aborted: ${err.message} Phases completed: ${JSON.stringify(phases)}`);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
