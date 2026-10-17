/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planProbeSequence takes
// the probe_sequence arguments verbatim).
import { ObstacleBox, checkMotion, describeViolations, sequenceMotion } from './envelopeChecks';
import { mcpBroadcast } from './index';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import { probeFeedService } from './probeFeed';
import { ProbeCapturePlan, planProbeCapture } from './probeCapture';
import { captureProbeSpot } from './probeCaptureRuntime';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    ProcedureStopped,
    TRAVEL_FEED,
    assertChannelReady,
    RECHECK_TOLERANCE_MM,
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
import { McpToolError } from './registry';
import { projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { outsideTravel } from './machineTravel';
import { MARCH_TRAVEL_MM, releaseTimeoutFor, resolveMarchParams, within } from './procedureLimits';
import { getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

// A whole measurement CIRCUIT as ONE staged, operator-approved procedure
// (operator-requested 2026-09-02: "I won't do separate approvals"). The
// operator approves a single enumerated plan of steps:
//
//   hop     - XY traverse; the runner FIRST raises to the safe traverse
//             height (motion law 2 is enforced mechanically, not by trust),
//             then moves XY. Contact during a hop latches CRASH.
//   descend - absolute Z move at the current XY (a "measured or operator-
//             stated number, never a guess" - the confirm page shows every
//             one). Contact during a descent latches CRASH.
//   probe   - a sensor-gated march along +/-X, +/-Y or -Z (or any unit
//             vector) from the position the plan has walked to, with the
//             proven coarse/release/fine/confirm mechanics. Contact is
//             EXPECTED only here. Each march is named; results are keyed
//             by name.
//
// The plan is SIMULATED at staging: the page enumerates every commanded
// move with concrete numbers, and the runner re-verifies the machine is
// where the simulation says it should be (+/-0.5mm) before every march.
// The sequence ends raised at the traverse height.

interface SequenceStepHop {
    kind: 'hop';
    x: number;
    y: number;
}
interface SequenceStepDescend {
    kind: 'descend';
    z: number;
}
interface SequenceStepProbe {
    kind: 'probe';
    name: string;
    unit: { x: number; y: number; z: number };
    maxTravelMm: number;
    start: { x: number; y: number; z: number }; // simulated position at march start
    /**
     * Reaching max_travel_mm without contact: record a no_contact result and
     * carry on with the next step (default), or abort the whole sequence.
     * Operator, 2026-09-06 (job 5ad5fcce6b3a): a side march that missed the
     * stock at a corner aborted a six-op program with five ops complete -
     * "less than ideal usually". The limit itself was approved, so a miss is
     * a measurement ("nothing within N mm"), not a fault.
     */
    onMiss: 'continue' | 'abort';
    capture: ProbeCapturePlan | null;
}
type SequenceStep = SequenceStepHop | SequenceStepDescend | SequenceStepProbe;

export const DESCENT_GUARD_MM = 20;

export interface ProbeSequencePlan {
    steps: SequenceStep[];
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
    hopZ: number;
    staged: { x: number; y: number; z: number };
}

export function planProbeSequence(args: {
    steps?: unknown;
    coarse_step_mm?: number;
    fine_step_mm?: number;
    backoff_mm?: number;
    sensor_delay_ms?: number;
    confirm_passes?: number;
}, extraObstacles: ObstacleBox[] = []): ProbeSequencePlan {
    if (!Array.isArray(args.steps) || args.steps.length < 1 || args.steps.length > 60) {
        throw new McpToolError('steps is required: 1-60 entries of {kind: hop|descend|probe, ...}.');
    }

    const position = getPositionSnapshot();
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the envelope.');
    }
    const staged = { x, y, z };
    const hopZ = safeTraverseZ();
    // Every hop and every march's far limit inside the toolhead's real travel
    // (machineTravel.ts), not the garbage-beat filter's -25..size+40.
    const toolheadTravel = requirePlanningTravel('a probe sequence', { x, y });
    const outside = (px: number, py: number) => outsideTravel({ x: px, y: py }, toolheadTravel.limits);

    // Simulate the walk so every step is anchored to concrete coordinates.
    const virtual = { ...staged };
    const steps: SequenceStep[] = [];
    const names = new Set<string>();
    let probeCount = 0;
    (args.steps as { [key: string]: unknown }[]).forEach((raw, index) => {
        const kind = String(raw.kind || '');
        const at = `steps[${index}]`;
        if (raw.capture !== undefined && kind !== 'probe') {
            throw new McpToolError(`${at}: capture is available only on a probe step, before its retreat.`);
        }
        if (kind === 'hop') {
            const hx = Number(raw.x);
            const hy = Number(raw.y);
            if (!Number.isFinite(hx) || !Number.isFinite(hy)) {
                throw new McpToolError(`${at}: hop needs finite machine x/y.`);
            }
            const hopOutside = outside(hx, hy);
            if (hopOutside) {
                throw new McpToolError(`${at}: hop target is outside the toolhead travel: ${hopOutside}.`);
            }
            steps.push({ kind: 'hop', x: hx, y: hy });
            virtual.x = hx;
            virtual.y = hy;
            virtual.z = hopZ; // the runner raises before every hop
        } else if (kind === 'descend') {
            const dz = Number(raw.z);
            if (!Number.isFinite(dz) || dz < 0 || dz > hopZ) {
                throw new McpToolError(`${at}: descend needs an absolute machine Z in 0..${hopZ}.`);
            }
            steps.push({ kind: 'descend', z: dz });
            virtual.z = dz;
        } else if (kind === 'probe') {
            const name = String(raw.name || `probe${probeCount + 1}`);
            if (names.has(name)) {
                throw new McpToolError(`${at}: duplicate probe name "${name}".`);
            }
            const dx = Number(raw.dx) || 0;
            const dy = Number(raw.dy) || 0;
            const dz = Number(raw.dz) || 0;
            const norm = Math.hypot(dx, dy, dz);
            if (!Number.isFinite(norm) || norm < 1e-9) {
                throw new McpToolError(`${at}: probe needs a direction (dx/dy/dz, at least one non-zero).`);
            }
            if (dz > 1e-9) {
                throw new McpToolError(`${at}: upward probing (dz > 0) is refused.`);
            }
            const unit = {
                x: Number((dx / norm).toFixed(6)),
                y: Number((dy / norm).toFixed(6)),
                z: Number((dz / norm).toFixed(6)),
            };
            const travel = Number(raw.max_travel_mm);
            if (!within(travel, MARCH_TRAVEL_MM)) {
                throw new McpToolError(`${at}: max_travel_mm required (${MARCH_TRAVEL_MM.min}-${MARCH_TRAVEL_MM.max}).`);
            }
            const limit = {
                x: virtual.x + unit.x * travel,
                y: virtual.y + unit.y * travel,
                z: virtual.z + unit.z * travel,
            };
            const limitOutside = outside(limit.x, limit.y);
            if (limitOutside) {
                throw new McpToolError(`${at}: the march's far limit is outside the toolhead travel: ${limitOutside}. `
                    + 'Shorten max_travel_mm or start the march nearer the face.');
            }
            if (limit.z < 0) {
                throw new McpToolError(`${at}: the march's far limit is below machine Z 0 (the bed).`);
            }
            const onMissRaw = raw.on_miss === undefined ? 'continue' : String(raw.on_miss);
            if (onMissRaw !== 'continue' && onMissRaw !== 'abort') {
                throw new McpToolError(`${at}: on_miss must be "continue" (default: record no_contact, carry on) or "abort".`);
            }
            steps.push({
                kind: 'probe',
                name,
                unit,
                maxTravelMm: travel,
                start: { ...virtual },
                onMiss: onMissRaw,
                capture: planProbeCapture(raw.capture),
            });
            names.add(name);
            probeCount += 1;
            // The march retreats to its own start; the runner then raises to
            // the traverse height before whatever comes next.
            virtual.z = hopZ;
        } else {
            throw new McpToolError(`${at}: kind must be hop, descend or probe.`);
        }
    });
    if (probeCount === 0) {
        throw new McpToolError('The sequence has no probe steps - use move_z / a gcode job for pure motion.');
    }

    // Law 4 (mcp/48): every hop, descend column and march is checked against
    // the obstacle landmarks and the program's transient keep-out boxes at
    // staging - refused, not left for the operator to spot on the page.
    const violations = checkMotion(
        sequenceMotion({ hopZ, staged, steps }),
        [...landmarkStore.obstacleBoxes(), ...extraObstacles],
        { traverseZ: hopZ, ...clearanceOptions() }
    );
    if (violations.length) {
        throw new McpToolError(`Sequence refused (law 4, landmarks are obstacles): ${describeViolations(violations)}. `
            + 'Raise the descend / march Z above the clearance, move the step, or have the operator adjust the landmark.');
    }

    return {
        steps,
        // Coarse / fine / backoff / sensor delay / confirm passes, clamped to
        // the named limits (procedureLimits.ts; operator law 2026-09-05: never 2 mm).
        ...resolveMarchParams(args),
        hopZ,
        staged,
    };
}

function pointAlong(start: { x: number; y: number; z: number }, unit: { x: number; y: number; z: number }, s: number) {
    return {
        x: Number((start.x + unit.x * s).toFixed(3)),
        y: Number((start.y + unit.y * s).toFixed(3)),
        z: Number((start.z + unit.z * s).toFixed(3)),
    };
}

function marchWords(step: SequenceStepProbe, s: number): { x?: number; y?: number; z?: number } {
    const p = pointAlong(step.start, step.unit, s);
    const words: { x?: number; y?: number; z?: number } = {};
    if (Math.abs(step.unit.x) > 1e-9) {
        words.x = p.x;
    }
    if (Math.abs(step.unit.y) > 1e-9) {
        words.y = p.y;
    }
    if (Math.abs(step.unit.z) > 1e-9) {
        words.z = p.z;
    }
    return words;
}

/** Confirm-page gcode: the whole circuit, every commanded move enumerated. */
export function describeProbeSequencePlanAsGcode(plan: ProbeSequencePlan): string {
    const probes = plan.steps.filter((s) => s.kind === 'probe').length;
    const lines = [
        `; PROBE SEQUENCE: one approved circuit of ${plan.steps.length} steps (${probes} sensor-gated marches)`,
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)})`
            + ' - re-verified before any motion, and before EVERY march',
        `; law 2 enforced mechanically: every hop first raises to the traverse height Z${plan.hopZ};`,
        '; every march retreats to its start and raises before the next step.',
        '; sensors: contact is EXPECTED only during marches - a probe/toolsetter trigger during',
        '; any hop, raise or descent latches the CRASH alarm (feed must be armed).',
        '; overtravel feed trips -> job stop + connection close + latched alarm',
        'G90',
        'G53;',
    ];
    for (const step of plan.steps) {
        if (step.kind === 'hop') {
            lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to traverse height (law 2)`);
            lines.push(`G1 X${step.x.toFixed(3)} Y${step.y.toFixed(3)} F${TRAVEL_FEED}; hop`);
        } else if (step.kind === 'descend') {
            lines.push(`G1 Z${(step.z + DESCENT_GUARD_MM).toFixed(3)} F${TRAVEL_FEED}; descend (<= 5 mm segments (crash guard armed)) to ${DESCENT_GUARD_MM} mm above target`);
            lines.push('; ...guarded final approach (operator, 2026-09-02): 1 mm steps, sensor-checked after each -');
            lines.push('; ANY contact during a descent aborts and latches the CRASH alarm.');
            for (let gz = step.z + DESCENT_GUARD_MM - 1; gz > step.z - 1e-9; gz -= 1) {
                const zz = Math.max(gz, step.z);
                lines.push(`G1 Z${zz.toFixed(3)} F${COARSE_FEED}; guarded descent step`);
            }
        } else {
            const dir = `(${step.unit.x}, ${step.unit.y}, ${step.unit.z})`;
            lines.push(`; --- march "${step.name}" along ${dir}, max ${step.maxTravelMm} mm ---`);
            let s = 0;
            let n = 0;
            while (step.maxTravelMm - s > 1e-9) {
                s = Math.min(s + plan.coarseStepMm, step.maxTravelMm);
                n += 1;
                const w = marchWords(step, s);
                const text = [
                    w.x !== undefined ? `X${w.x.toFixed(3)}` : '',
                    w.y !== undefined ? `Y${w.y.toFixed(3)}` : '',
                    w.z !== undefined ? `Z${w.z.toFixed(3)}` : '',
                ].filter(Boolean).join(' ');
                lines.push(`G1 ${text} F${COARSE_FEED}; coarse ${n} - settle, check probe, stop at contact`);
            }
            lines.push(`; ...on contact: retreat/release, ${plan.fineStepMm} mm fine approach, `
                + `${plan.confirmPasses} confirm cycle(s) (lift ${plan.backoffMm} mm); at the limit without contact: `
                + `${step.onMiss === 'abort' ? 'ABORTS the sequence' : 'records no_contact, retreats and CONTINUES with the next step (on_miss: continue)'}`);
            if (step.capture) {
                lines.push(`; CAMERA: stationary at final confirmed contact BEFORE retract, settle ${step.capture.settleMs} ms; save frame with result. A continuing miss captures at its search limit.`);
            }
            lines.push(`G1 X${step.start.x.toFixed(3)} Y${step.start.y.toFixed(3)} Z${step.start.z.toFixed(3)} `
                + `F${TRAVEL_FEED}; retreat to the march start (an ABORT raises straight up to the traverse height instead)`);
            lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to traverse height`);
        }
    }
    lines.push('G54;');
    return lines.join('\n');
}

export async function runProbeSequenceProcedure(plan: ProbeSequencePlan): Promise<object> {
    assertChannelReady('probe', 'probe sequence');
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();

    const position = getPositionSnapshot();
    const here = position.machine;
    if (here.x === null || here.y === null || here.z === null
        || Math.abs(here.x - plan.staged.x) > 0.5
        || Math.abs(here.y - plan.staged.y) > 0.5
        || Math.abs(here.z - plan.staged.z) > 0.5) {
        throw new McpToolError('The machine is not at the position this sequence was staged from '
            + `(staged (${plan.staged.x}, ${plan.staged.y}, ${plan.staged.z}), now `
            + `(${here.x}, ${here.y}, ${here.z})). Stage probe_sequence again.`);
    }

    const phases: { phase: string; note?: string }[] = [];
    const announce = (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool: 'probe_sequence', phase, note });
    };
    const releaseTimeoutMs = releaseTimeoutFor(plan.sensorDelayMs);
    const results: {
        name: string;
        status: 'contact' | 'no_contact';
        contactMachine: { x: number; y: number; z: number } | null;
        contactDistanceMm: number | null;
        confirmPassContacts: number[];
        spreadMm: number;
        /** no_contact: where the march ended (its approved limit), machine coords. */
        limitMachine?: { x: number; y: number; z: number };
        maxTravelMm?: number;
        capture?: object;
    }[] = [];

    let stepIndex = 0;
    try {
        for (const step of plan.steps) {
            stepIndex += 1;
            if (step.kind === 'hop') {
                probeFeedService.clearExpectedContact();
                await moveMachineSettled(`seq:raise:${stepIndex}`, { z: plan.hopZ }, TRAVEL_FEED);
                await moveMachineSettled(`seq:hop:${stepIndex}`, { x: step.x, y: step.y }, TRAVEL_FEED);
                announce(`hop-${stepIndex}`, `(${step.x}, ${step.y}) at Z${plan.hopZ}`);
            } else if (step.kind === 'descend') {
                probeFeedService.clearExpectedContact();
                const guardTop = step.z + DESCENT_GUARD_MM;
                // Verified position (record) over a single heartbeat - see
                // probing.knownMachinePosition (job 42df7b9351b7).
                const known = knownMachinePosition();
                const zNow = known.position.z;
                if (zNow !== null && zNow < step.z - RECHECK_TOLERANCE_MM) {
                    throw new ProcedureAbort(`Descend step ${stepIndex}: the toolhead is at machine Z${zNow} (${known.source}), BELOW the `
                        + `planned descent target Z${step.z} - a descent never rises. Re-stage from a verified position.`);
                }
                if (zNow !== null && zNow > guardTop + TRAVERSE_Z_TOLERANCE_MM) {
                    // Operator law 2026-09-05: descents in <= 5 mm sensor-checked
                    // segments, never one long move toward the work.
                    await descendInSegments(`seq:descend:${stepIndex}`, zNow, guardTop, 'probe', plan.sensorDelayMs);
                }
                let gz = Math.min(zNow === null ? guardTop : Math.max(zNow, step.z), guardTop);
                while (gz - step.z > 1e-9) {
                    const t0 = Date.now();
                    gz = Math.max(gz - 1, step.z);
                    await moveMachineSettled(`seq:descend-guard:${stepIndex}`, { z: gz }, COARSE_FEED);
                    const sensed = await senseAfter('probe', t0, plan.sensorDelayMs);
                    if (sensed.contact) {
                        throw new ProcedureAbort(`UNEXPECTED CONTACT during guarded descent at Z${gz.toFixed(3)} `
                            + '- something is where the plan says nothing should be. Machine held.');
                    }
                }
                announce(`descend-${stepIndex}`, `Z${step.z} (guarded final ${DESCENT_GUARD_MM} mm)`);
            } else {
                // Re-verify the walk matches the simulation before marching.
                // Every preceding move already verified its own arrival, so
                // the engine's position of record and an either-frame reading
                // of the heartbeat decide (positionOfRecord.ts; jobs
                // 44abebd9bab3 and 1db4902a4cd6, 2026-09-05).
                const check = await expectMachinePosition(step.start, `March "${step.name}"`,
                    (message) => new ProcedureAbort(message));
                if (check.note) {
                    announce(`recheck-${stepIndex}`, check.note);
                }
                probeFeedService.setExpectedContact(['probe']);
                const move = async (tool: string, s: number, feed: number) => {
                    await moveMachineSettled(tool, marchWords(step, s), feed);
                };

                let s = 0;
                let coarseContactS: number | null = null;
                while (step.maxTravelMm - s > 1e-9) {
                    // The coarse step is the logical advance; the physical moves
                    // are <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts).
                    const advance = await marchInSegments(
                        async (v) => move(`seq:coarse:${step.name}`, v, COARSE_FEED),
                        s, Math.min(s + plan.coarseStepMm, step.maxTravelMm), 'probe', plan.sensorDelayMs
                    );
                    s = advance.s;
                    if (advance.sensed.contact) {
                        coarseContactS = s;
                        announce(`coarse-contact-${step.name}`, `${s.toFixed(3)} mm along`);
                        break;
                    }
                }
                if (coarseContactS === null) {
                    if (step.onMiss === 'abort') {
                        throw new ProcedureAbort(`March "${step.name}": no contact within ${step.maxTravelMm} mm (on_miss: abort).`);
                    }
                    // A miss is a measurement: nothing within the approved
                    // travel. Record it, retreat to the start, raise, carry on.
                    const limit = pointAlong(step.start, step.unit, step.maxTravelMm);
                    results.push({
                        name: step.name,
                        status: 'no_contact',
                        contactMachine: null,
                        contactDistanceMm: null,
                        confirmPassContacts: [],
                        spreadMm: 0,
                        limitMachine: limit,
                        maxTravelMm: step.maxTravelMm,
                    });
                    announce(`no-contact-${step.name}`, `nothing within ${step.maxTravelMm} mm (limit at ${limit.x}, ${limit.y}, ${limit.z}); continuing`);
                    if (step.capture) {
                        results[results.length - 1].capture = await captureProbeSpot(step.capture, 'probe_sequence', step.name);
                        announce(`capture-${step.name}`, JSON.stringify(results[results.length - 1].capture));
                    }
                    await moveMachineSettled(`seq:retreat:${step.name}`, {
                        x: step.start.x, y: step.start.y, z: step.start.z,
                    }, TRAVEL_FEED);
                    probeFeedService.clearExpectedContact();
                    await moveMachineSettled(`seq:raise:${step.name}`, { z: plan.hopZ }, TRAVEL_FEED);
                    continue;
                }
                let released = false;
                while (s > 1e-9 && coarseContactS - s < MAX_RETREAT_MM + 1e-9) {
                    const t0 = Date.now();
                    s = Math.max(s - plan.coarseStepMm, 0);
                    await move(`seq:release:${step.name}`, s, COARSE_FEED);
                    const sensed = await senseReleaseAfter('probe', t0, releaseTimeoutMs);
                    if (!sensed.contact) {
                        released = true;
                        break;
                    }
                }
                if (!released) {
                    throw new ProcedureAbort(`March "${step.name}": still triggered ${MAX_RETREAT_MM} mm back.`);
                }
                let fineContactS: number | null = null;
                while (step.maxTravelMm - s > 1e-9) {
                    const t0 = Date.now();
                    s = Math.min(s + plan.fineStepMm, step.maxTravelMm);
                    await move(`seq:fine:${step.name}`, s, FINE_FEED);
                    const sensed = await senseAfter('probe', t0, plan.sensorDelayMs);
                    if (sensed.contact) {
                        fineContactS = s;
                        break;
                    }
                }
                if (fineContactS === null) {
                    throw new ProcedureAbort(`March "${step.name}": fine approach lost the contact.`);
                }
                const passContacts: number[] = [];
                const cycleLimit = Math.min(fineContactS + Math.max(0.5, plan.backoffMm), step.maxTravelMm);
                let reference = fineContactS;
                for (let pass = 1; pass <= plan.confirmPasses; pass++) {
                    const t0 = Date.now();
                    s = Math.max(reference - plan.backoffMm, 0);
                    await move(`seq:backoff:${step.name}`, s, FINE_FEED);
                    const lifted = await senseReleaseAfter('probe', t0, releaseTimeoutMs);
                    if (lifted.contact) {
                        throw new ProcedureAbort(`March "${step.name}": hysteresis exceeds the backoff.`);
                    }
                    let passContact: number | null = null;
                    while (cycleLimit - s > 1e-9) {
                        const t1 = Date.now();
                        s = Math.min(s + plan.fineStepMm, cycleLimit);
                        await move(`seq:confirm:${step.name}`, s, FINE_FEED);
                        const sensed = await senseAfter('probe', t1, plan.sensorDelayMs);
                        if (sensed.contact) {
                            passContact = s;
                            break;
                        }
                    }
                    if (passContact === null) {
                        throw new ProcedureAbort(`March "${step.name}": confirm pass ${pass} lost the contact.`);
                    }
                    passContacts.push(Number(passContact.toFixed(3)));
                    reference = passContact;
                }
                const sorted = [...passContacts].sort((a, b) => a - b);
                const measuredS = sorted[Math.floor((sorted.length - 1) / 2)];
                const spreadMm = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3));
                const contact = pointAlong(step.start, step.unit, measuredS);
                results.push({
                    name: step.name,
                    status: 'contact',
                    contactMachine: contact,
                    contactDistanceMm: measuredS,
                    confirmPassContacts: passContacts,
                    spreadMm,
                });
                announce(`measured-${step.name}`, `(${contact.x}, ${contact.y}, ${contact.z}) spread ${spreadMm}`);

                if (step.capture) {
                    results[results.length - 1].capture = await captureProbeSpot(step.capture, 'probe_sequence', step.name);
                    announce(`capture-${step.name}`, JSON.stringify(results[results.length - 1].capture));
                }
                // Retreat to the march start, then raise (still expected-contact
                // until physically clear of the surface).
                await moveMachineSettled(`seq:retreat:${step.name}`, {
                    x: step.start.x, y: step.start.y, z: step.start.z,
                }, TRAVEL_FEED);
                probeFeedService.clearExpectedContact();
                await moveMachineSettled(`seq:raise:${step.name}`, { z: plan.hopZ }, TRAVEL_FEED);
            }
        }

        const contacts = results.filter((r) => r.status === 'contact');
        const misses = results.filter((r) => r.status === 'no_contact').map((r) => r.name);
        announce('sequence-complete', `${contacts.length} contacts${misses.length ? `, ${misses.length} no_contact (${misses.join(', ')})` : ''}`);
        return {
            tipCalibration,
            results: results.map((r) => ({ ...r, ...projectToolTipZ(r.contactMachine?.z ?? null, tipCalibration) })),
            contactCount: contacts.length,
            noContactProbes: misses,
            phases,
            note: `Probe sequence complete: ${contacts.length} contacts${misses.length ? `, ${misses.length} march(es) found nothing within their approved travel (${misses.join(', ')})` : ''}, `
                + 'all MACHINE coordinates. Worst confirm spread '
                + `${(contacts.length ? Math.max(...contacts.map((r) => r.spreadMm)) : 0).toFixed(3)} mm.`,
        };
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (!isTrip) {
            try {
                await abortRaiseToTop('seq', (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            const partial = { results: results.map((r) => ({ ...r, ...projectToolTipZ(r.contactMachine?.z ?? null, tipCalibration) })), tipCalibration, phases, aborted: true, abortedAtStep: stepIndex };
            const Ctor = isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
            throw new Ctor(`Probe sequence aborted at step ${stepIndex}: ${err.message} `
                + `${results.length} contact(s) measured before the abort are on the job record.`, partial);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
