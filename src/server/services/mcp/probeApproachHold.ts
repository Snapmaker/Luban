/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planProbeApproachHold
// takes the probe_approach_and_hold arguments verbatim).
//
// probe_approach_and_hold - the machine side (issue #188). The pure plan,
// page text, end-of-march judgement, hold release and handoff text live in
// approachHold.ts; this file drives the proven engine (probing.ts) through
// them: raise -> hop at the traverse height -> guarded descent to
// start_z_machine -> sensor-gated march (coarse / release / fine / confirm,
// exactly probe_vector's mechanics) -> HOLD, and the hold's release when
// stop_gcode_job arrives. The hold is a sanctioned exception to law 8: the
// procedure ends raised NOWHERE until the operator's origin setup is done,
// and the raise is the next motion - stop_gcode_job.
import { mcpBroadcast } from './index';
import {
    ApproachHoldPlan,
    APPROACH_DESCENT_GUARD_MM,
    APPROACH_HOLD_MOVED_MM,
    APPROACH_HOLD_POLL_MS,
    HoldRecord,
    describeApproachHoldPlan,
    holdHandoffText,
    judgeApproachEnd,
    marchWords,
    planApproachHold,
    planHoldRelease,
    pointAlong,
} from './approachHold';
import { ObstacleBox, checkMotion, describeViolations, sequenceMotion } from './envelopeChecks';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import { probeFeedService } from './probeFeed';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    ProcedureStopped,
    RECHECK_TOLERANCE_MM,
    TRAVEL_FEED,
    abortRaiseToTop,
    assertChannelReady,
    assertMachineReadyForProcedure,
    checkProcedureStop,
    descendInSegments,
    expectMachinePosition,
    isProcedureAbort,
    isProcedureStopped,
    knownMachinePosition,
    marchInSegments,
    moveMachineSettled,
    raiseToTop,
    senseAfter,
    senseReleaseAfter,
    sleep,
} from './probing';
import { clearPositionOfRecord } from './positionOfRecord';
import { releaseTimeoutFor, resolveMarchParams } from './procedureLimits';
import { McpToolError } from './registry';
import { StylusReachVerdict } from './stylusReach';
import { requireStylusReach } from './stylusReachGuard';
import { TipCalibrationSnapshot, projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { TRAVERSE_Z_TOLERANCE_MM, mayDescend } from './traversePlan';
import { getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

export interface ProbeApproachHoldPlan extends ApproachHoldPlan {
    stylusReach: StylusReachVerdict;
}

type SensorState = HoldRecord['sensor'];
type ReleasedHow = NonNullable<HoldRecord['released']>['how'];

function sensorStateOf(reading: { triggered: boolean } | null | undefined): SensorState {
    if (!reading) {
        return 'unknown';
    }
    return reading.triggered ? 'triggered' : 'released';
}

/** raiseToTop's outcome as the hold record's release kind. */
function releasedHow(action: 'raised' | 'skipped' | 'held' | 'no-retreat'): ReleasedHow {
    switch (action) {
        case 'raised': return 'raised';
        case 'skipped': return 'raise-skipped';
        case 'held': return 'held-triggered';
        default: return 'no-retreat';
    }
}

export function planProbeApproachHold(args: { [key: string]: unknown }, extraObstacles: ObstacleBox[] = []): ProbeApproachHoldPlan {
    // The hold is worthless - and the march unsafe - without the probe feed:
    // refuse at staging, not after the operator's click.
    assertChannelReady('probe', 'probe approach-and-hold');
    const position = getPositionSnapshot();
    const { x, y, z } = position.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the approach.');
    }
    const traverseZ = safeTraverseZ();
    // A start within tolerance of the traverse height IS the traverse height
    // (home reports 327.999): commanded positions never carry heartbeat noise.
    const staged = { x, y, z: z >= traverseZ - TRAVERSE_Z_TOLERANCE_MM ? traverseZ : z };
    const targetX = args.x === undefined || args.x === null ? x : Number(args.x);
    const targetY = args.y === undefined || args.y === null ? y : Number(args.y);
    let plan: ApproachHoldPlan;
    try {
        plan = planApproachHold({
            ...args,
            staged,
            traverseZ,
            travel: requirePlanningTravel('a probe approach', { x: Number.isFinite(targetX) ? targetX : x, y: Number.isFinite(targetY) ? targetY : y }).limits,
            march: resolveMarchParams(args),
        });
    } catch (err) {
        if ((err as Error).name === 'ApproachHoldPlanError') {
            throw new McpToolError((err as Error).message);
        }
        throw err;
    }
    // Law 4: the hop, the descent column and the march are checked against
    // every landmark and keep-out at staging, like a sequence's steps.
    const violations = checkMotion(
        sequenceMotion({
            hopZ: traverseZ,
            staged,
            steps: [
                { kind: 'hop', x: plan.target.x, y: plan.target.y },
                { kind: 'descend', z: plan.startZ },
                { kind: 'probe', name: 'approach', unit: plan.unit, maxTravelMm: plan.maxTravelMm, start: plan.start, endZ: plan.limit.z },
            ],
        }),
        [...landmarkStore.obstacleBoxes(), ...extraObstacles],
        { traverseZ, ...clearanceOptions() }
    );
    if (violations.length) {
        throw new McpToolError(`Approach refused (law 4, landmarks are obstacles): ${describeViolations(violations)}. `
            + 'Raise start_z_machine, move the target, or have the operator adjust the landmark.');
    }
    return { ...plan, stylusReach: requireStylusReach(args, plan.deepestZ, 'Probe approach') };
}

export function describeProbeApproachHoldAsGcode(plan: ProbeApproachHoldPlan): string {
    return describeApproachHoldPlan(plan, plan.stylusReach);
}

export interface ApproachHoldHooks {
    /** The hold began: put it on the job record. */
    onHold: (record: HoldRecord) => void;
    /** Something changed during or at the end of the hold. */
    onHoldUpdate: (record: HoldRecord) => void;
}

export interface ApproachHoldPartial {
    tool: 'probe_approach_and_hold';
    end: string | null;
    measured: {
        contactMachine: { x: number; y: number; z: number };
        contactDistanceMm: number;
        confirmPassContacts: number[];
        spreadMm: number;
        tipMachineZ: number | null;
        tipCalibration: TipCalibrationSnapshot;
    } | null;
    hold: HoldRecord | null;
    stylusReach: StylusReachVerdict;
    phases: { phase: string; note?: string }[];
}

/**
 * The operator-approved run. It returns NEVER on the success path: the hold
 * lasts until stop_gcode_job (or a safety trip), and the result - the
 * measurement, the hold and how it was released - leaves on the
 * ProcedureStopped's partial, which start_gcode_job keeps as job.result.
 */
export async function runProbeApproachHoldProcedure(plan: ProbeApproachHoldPlan, hooks: ApproachHoldHooks): Promise<object> {
    assertChannelReady('probe', 'probe approach-and-hold');
    assertMachineReadyForProcedure();
    const tipCalibration = getProbeTipCalibration();

    const here = getPositionSnapshot().machine;
    if (here.x === null || here.y === null || here.z === null
        || Math.abs(here.x - plan.staged.x) > RECHECK_TOLERANCE_MM
        || Math.abs(here.y - plan.staged.y) > RECHECK_TOLERANCE_MM
        || Math.abs(here.z - plan.staged.z) > RECHECK_TOLERANCE_MM) {
        throw new McpToolError('The machine is not at the position this approach was staged from '
            + `(staged (${plan.staged.x}, ${plan.staged.y}, ${plan.staged.z}), now (${here.x}, ${here.y}, ${here.z})). `
            + 'Stage probe_approach_and_hold again from the current position.');
    }

    const phases: { phase: string; note?: string }[] = [];
    const announce = (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool: 'probe_approach_and_hold', phase, note });
    };
    const partial: ApproachHoldPartial = { tool: 'probe_approach_and_hold', end: null, measured: null, hold: null, stylusReach: plan.stylusReach, phases };
    const m = plan.march;
    const releaseTimeoutMs = releaseTimeoutFor(m.sensorDelayMs);
    const move = async (tool: string, s: number, feed: number) => {
        await moveMachineSettled(tool, marchWords(plan, s), feed);
    };
    const straightDown = plan.unit.z < -1e-9 && Math.abs(plan.unit.x) < 1e-9 && Math.abs(plan.unit.y) < 1e-9;

    let s = 0;
    let marchBegun = false;
    let record: HoldRecord | null = null;
    try {
        // 1) Raise to the traverse height if below it (law 2), from the
        //    verified position of record. Nothing is expected to touch.
        probeFeedService.clearExpectedContact();
        const known = knownMachinePosition();
        if (known.position.z === null || known.position.z < plan.traverseZ - TRAVERSE_Z_TOLERANCE_MM) {
            await moveMachineSettled('approach:raise', { z: plan.traverseZ }, TRAVEL_FEED);
            announce('raised', `traverse height Z${plan.traverseZ} (law 2) before the hop`);
        }
        // 2) Hop at the traverse height.
        if (plan.hopDistanceMm > 1e-9) {
            await moveMachineSettled('approach:hop', { x: plan.target.x, y: plan.target.y }, TRAVEL_FEED);
            announce('hop', `(${plan.target.x}, ${plan.target.y}) at Z${plan.traverseZ}, ${plan.hopDistanceMm.toFixed(1)} mm`);
        }
        // 3) Guarded descent to start_z_machine: <= 5 mm segments under the
        //    crash guard, then 1 mm sensor-checked steps (operator law
        //    2026-09-02/05). ANY contact here is a collision.
        const guardTop = Math.min(plan.startZ + APPROACH_DESCENT_GUARD_MM, plan.traverseZ);
        const zNow = knownMachinePosition().position.z;
        if (zNow !== null && zNow < plan.startZ - RECHECK_TOLERANCE_MM) {
            throw new ProcedureAbort(`The toolhead is at machine Z${zNow}, BELOW start_z_machine Z${plan.startZ} - a descent never rises. Re-stage from a verified position.`);
        }
        if (zNow !== null && zNow > guardTop + TRAVERSE_Z_TOLERANCE_MM) {
            await descendInSegments('approach:descend', zNow, guardTop, 'probe', m.sensorDelayMs);
        }
        let gz = Math.min(zNow === null ? guardTop : Math.max(zNow, plan.startZ), guardTop);
        while (gz - plan.startZ > 1e-9) {
            const t0 = Date.now();
            gz = Math.max(gz - 1, plan.startZ);
            await moveMachineSettled('approach:descend-guard', { z: gz }, COARSE_FEED);
            const sensed = await senseAfter('probe', t0, m.sensorDelayMs);
            if (sensed.contact) {
                throw new ProcedureAbort(`UNEXPECTED CONTACT during the guarded descent at Z${gz.toFixed(3)} - the surface is above start_z_machine. Machine held, raising.`);
            }
        }
        announce('descended', `start_z_machine Z${plan.startZ} (guarded final ${APPROACH_DESCENT_GUARD_MM} mm)`);
        const check = await expectMachinePosition(plan.start, 'Approach march', (message) => new ProcedureAbort(message));
        if (check.note) {
            announce('recheck', check.note);
        }

        // 4) The sensor-gated march: contact is expected (so the crash guard
        //    stays quiet) and judged synchronously after every segment -
        //    with on_contact "abort" a touch still ENDS the approach, it is
        //    just reported as unexpected rather than confirmed as the datum.
        probeFeedService.setExpectedContact(['probe']);
        marchBegun = true;
        let contactS: number | null = null;
        while (plan.maxTravelMm - s > 1e-9) {
            const advance = await marchInSegments(
                async (v) => move('approach:coarse', v, COARSE_FEED),
                s, Math.min(s + m.coarseStepMm, plan.maxTravelMm), 'probe', m.sensorDelayMs
            );
            s = advance.s;
            if (advance.sensed.contact) {
                contactS = s;
                announce('coarse-contact', `${s.toFixed(3)} mm along, probe "${advance.sensed.reading?.value}"`);
                break;
            }
        }
        const end = judgeApproachEnd(plan, contactS !== null, s);
        partial.end = end.kind;
        announce(`end-${end.kind}`, end.note);
        if (end.kind === 'contact-abort' || end.kind === 'no-contact-abort') {
            throw new ProcedureAbort(end.note);
        }

        let heldS = s;
        if (end.kind === 'contact-hold') {
            // Retreat until released, fine approach, confirm cycles: the
            // median is the datum (probe_vector's proven sequence).
            let released = false;
            while (s > 1e-9 && (contactS as number) - s < MAX_RETREAT_MM + 1e-9) {
                const t0 = Date.now();
                s = Math.max(s - m.coarseStepMm, 0);
                await move('approach:release', s, COARSE_FEED);
                const sensed = await senseReleaseAfter('probe', t0, releaseTimeoutMs);
                if (!sensed.contact) {
                    released = true;
                    announce('released', `${s.toFixed(3)} mm along`);
                    break;
                }
            }
            if (!released) {
                throw new ProcedureAbort(`Probe still reads triggered ${MAX_RETREAT_MM} mm back from first contact - stuck probe or feed fault.`);
            }
            let fineContactS: number | null = null;
            while (plan.maxTravelMm - s > 1e-9) {
                const t0 = Date.now();
                s = Math.min(s + m.fineStepMm, plan.maxTravelMm);
                await move('approach:fine', s, FINE_FEED);
                const sensed = await senseAfter('probe', t0, m.sensorDelayMs);
                if (sensed.contact) {
                    fineContactS = s;
                    announce('fine-contact', `${s.toFixed(3)} mm along`);
                    break;
                }
            }
            if (fineContactS === null) {
                throw new ProcedureAbort('Fine approach reached the travel limit without re-contact after a coarse contact - inconsistent probe.');
            }
            const passContacts: number[] = [];
            const cycleLimit = Math.min(fineContactS + Math.max(0.5, m.backoffMm), plan.maxTravelMm);
            let reference = fineContactS;
            for (let pass = 1; pass <= m.confirmPasses; pass++) {
                const liftAt = Date.now();
                s = Math.max(reference - m.backoffMm, 0);
                await move('approach:backoff', s, FINE_FEED);
                const lifted = await senseReleaseAfter('probe', liftAt, releaseTimeoutMs);
                if (lifted.contact) {
                    throw new ProcedureAbort(`Probe still triggered ${releaseTimeoutMs} ms after backing off ${m.backoffMm} mm - hysteresis exceeds the backoff. Rerun with a larger backoff_mm.`);
                }
                let passContact: number | null = null;
                while (cycleLimit - s > 1e-9) {
                    const t0 = Date.now();
                    s = Math.min(s + m.fineStepMm, cycleLimit);
                    await move('approach:confirm', s, FINE_FEED);
                    const sensed = await senseAfter('probe', t0, m.sensorDelayMs);
                    if (sensed.contact) {
                        passContact = s;
                        break;
                    }
                }
                if (passContact === null) {
                    throw new ProcedureAbort(`Confirm pass ${pass} went 0.5 mm past the first contact without re-contact - inconsistent probe.`);
                }
                passContacts.push(Number(passContact.toFixed(3)));
                announce(`confirm-${pass}`, `${passContact.toFixed(3)} mm along, of ${m.confirmPasses}`);
                reference = passContact;
            }
            const sorted = [...passContacts].sort((a, b) => a - b);
            const measuredS = sorted[Math.floor((sorted.length - 1) / 2)];
            const spreadMm = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3));
            const contactMachine = pointAlong(plan, measuredS);
            partial.measured = {
                contactMachine,
                contactDistanceMm: measuredS,
                confirmPassContacts: passContacts,
                spreadMm,
                ...projectToolTipZ(contactMachine.z, tipCalibration),
            };
            announce('measured', `median of [${passContacts.join(', ')}] = ${measuredS.toFixed(3)} mm along -> machine (${contactMachine.x}, ${contactMachine.y}, ${contactMachine.z}), spread ${spreadMm} mm`);

            // The HELD position is reported separately from the median: the
            // head is driven to it (never blindly to a median it is not at)
            // and the sensor is read there.
            if (plan.holdAt === 'contact') {
                const holdAt = Date.now();
                heldS = measuredS;
                await move('approach:hold', heldS, FINE_FEED);
                const sensed = await senseAfter('probe', holdAt, m.sensorDelayMs);
                if (!sensed.contact) {
                    announce('hold-not-triggered', 'the probe does not read triggered at the median contact - holding there anyway; the held position is reported as released');
                }
            } else {
                const liftAt = Date.now();
                heldS = Math.max(measuredS - m.backoffMm, 0);
                await move('approach:hold-released', heldS, FINE_FEED);
                const lifted = await senseReleaseAfter('probe', liftAt, releaseTimeoutMs);
                if (lifted.contact) {
                    throw new ProcedureAbort(`Probe still triggered ${releaseTimeoutMs} ms after backing off ${m.backoffMm} mm for the released hold.`);
                }
            }
        } else {
            // datum-hold: at the stated datum with the probe released - read it once more.
            const sensed = await senseAfter('probe', Date.now(), m.sensorDelayMs);
            if (sensed.contact) {
                throw new ProcedureAbort(`The probe reads triggered at the stated datum Z${plan.datumZ} after the march reported no contact - inconsistent sensor; raising.`);
            }
        }

        // 5) HOLD. Nothing moves until stop_gcode_job; the record carries
        //    the handoff, and the loop watches the stop request, the trip
        //    latch, the sensor and the heartbeat (the operator's touchscreen
        //    jogs show up there - the position of record is dropped so the
        //    release reasons from the live heartbeat, never a stale record).
        const reading = probeFeedService.getReading('probe');
        const heldMachine = pointAlong(plan, heldS);
        record = {
            kind: end.kind === 'datum-hold' ? 'datum' : plan.holdAt,
            machine: heldMachine,
            heldS,
            measuredContactMachine: partial.measured ? partial.measured.contactMachine : null,
            confirmPassContacts: partial.measured ? partial.measured.confirmPassContacts : [],
            spreadMm: partial.measured ? partial.measured.spreadMm : null,
            sensor: sensorStateOf(reading),
            since: Date.now(),
            handoff: '',
            operatorMoved: null,
            sensorChanged: null,
            released: null,
        };
        record.handoff = holdHandoffText(plan, record);
        partial.hold = record;
        announce('holding', record.handoff);
        hooks.onHold(record);
        let lastSensor = record.sensor;
        let heartbeatWarned = false;
        for (;;) {
            checkProcedureStop();
            probeFeedService.assertNoOvertravel();
            const now = probeFeedService.getReading('probe');
            const sensor = sensorStateOf(now);
            if (sensor !== lastSensor && sensor !== 'unknown') {
                lastSensor = sensor;
                record.sensorChanged = { at: Date.now(), sensor, note: `the probe went ${sensor} during the hold (${now?.value})` };
                announce('hold-sensor-changed', record.sensorChanged.note);
                hooks.onHoldUpdate(record);
            }
            try {
                const beat = getPositionSnapshot().machine;
                if (beat.x !== null && beat.y !== null && beat.z !== null) {
                    const moved = Math.hypot(beat.x - heldMachine.x, beat.y - heldMachine.y, beat.z - heldMachine.z);
                    const previous = record.operatorMoved ? record.operatorMoved.machine : heldMachine;
                    const movedSinceNoted = Math.hypot(beat.x - previous.x, beat.y - previous.y, beat.z - previous.z);
                    if (moved > APPROACH_HOLD_MOVED_MM && movedSinceNoted > APPROACH_HOLD_MOVED_MM) {
                        clearPositionOfRecord();
                        record.operatorMoved = {
                            at: Date.now(),
                            machine: { x: beat.x, y: beat.y, z: beat.z },
                            note: `the heartbeat reads machine (${beat.x}, ${beat.y}, ${beat.z}), ${moved.toFixed(2)} mm from the held position: the operator moved the head `
                                + '(touchscreen). No motion from the hold; the position of record now follows the heartbeat; the release will not back off along the vector.',
                        };
                        announce('hold-operator-moved', record.operatorMoved.note);
                        hooks.onHoldUpdate(record);
                    }
                }
                heartbeatWarned = false;
            } catch (err) {
                if (!heartbeatWarned) {
                    heartbeatWarned = true;
                    announce('hold-heartbeat-unavailable', `${(err as Error).message} - still holding, no motion`);
                }
            }
            await sleep(APPROACH_HOLD_POLL_MS);
        }
    } catch (err) {
        const trip = !!probeFeedService.getTrip();
        if (record) {
            // The hold's release: the tip comes off the surface along the
            // proven reverse vector (from the held position only), then the
            // Z-only raise; a probe still triggered is held, never dragged.
            try {
                const now = probeFeedService.getReading('probe');
                let headAtHeld = true;
                try {
                    const beat = getPositionSnapshot().machine;
                    headAtHeld = beat.x !== null && beat.y !== null && beat.z !== null
                        && Math.hypot(beat.x - record.machine.x, beat.y - record.machine.y, beat.z - record.machine.z) <= APPROACH_HOLD_MOVED_MM;
                } catch (positionErr) {
                    headAtHeld = record.operatorMoved === null;
                }
                const step = planHoldRelease({
                    tripLatched: trip,
                    headAtHeld: headAtHeld && record.operatorMoved === null,
                    triggered: !!(now && now.triggered),
                    heldS: record.heldS,
                    backoffMm: m.backoffMm,
                    straightDown,
                });
                announce('hold-release', step.reason);
                if (step.action === 'none') {
                    record.released = { at: Date.now(), how: 'no-retreat', finalZ: knownMachinePosition().position.z, note: step.reason };
                } else if (step.action === 'backoff-then-raise') {
                    probeFeedService.setExpectedContact(['probe']);
                    const liftAt = Date.now();
                    await move('approach:release-backoff', step.backoffS, FINE_FEED);
                    const lifted = await senseReleaseAfter('probe', liftAt, releaseTimeoutMs);
                    if (lifted.contact) {
                        const note = `probe still triggered ${releaseTimeoutMs} ms after backing off to ${step.backoffS} mm along - HELD for the operator (law 8), not raised`;
                        announce('abort-held', note);
                        record.released = { at: Date.now(), how: 'held-triggered', finalZ: knownMachinePosition().position.z, note };
                    } else {
                        const raised = await abortRaiseToTop('approach', (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`));
                        record.released = { at: Date.now(), how: releasedHow(raised.action), finalZ: raised.z, note: raised.note };
                    }
                } else if (straightDown && headAtHeld && record.operatorMoved === null) {
                    // The Z-only raise IS the release on a straight -Z hold:
                    // it starts in contact, so the probe stays expected for
                    // the lift (the tool setter's success-path lift does the same).
                    probeFeedService.setExpectedContact(['probe']);
                    const raised = await raiseToTop('approach', (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`));
                    record.released = { at: Date.now(), how: releasedHow(raised.action), finalZ: raised.z, note: raised.note };
                } else {
                    const raised = await abortRaiseToTop('approach', (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
                    record.released = { at: Date.now(), how: releasedHow(raised.action), finalZ: raised.z, note: raised.note };
                }
            } catch (releaseErr) {
                const note = `release failed: ${(releaseErr as Error).message}`;
                announce('hold-release-failed', note);
                record.released = { at: Date.now(), how: 'no-retreat', finalZ: knownMachinePosition().position.z, note };
            }
            hooks.onHoldUpdate(record);
        } else if (!trip) {
            // Abort before the hold: back along the vector to the march start
            // when that leg cannot descend (the march began), then the raise.
            try {
                const known = knownMachinePosition().position;
                if (marchBegun && !mayDescend(known.z, plan.start.z)) {
                    await move('approach:abort-retreat', 0, TRAVEL_FEED);
                    announce('abort-retreated', 'back along the vector to the march start');
                }
                await abortRaiseToTop('approach', (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            const Ctor = isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
            throw new Ctor(record
                ? `Hold ended: ${err.message} Released: ${record.released ? `${record.released.how} - ${record.released.note}` : 'not released'}. `
                    + 'The measurement and the hold are on the job record.'
                : `Approach aborted: ${err.message}`, partial);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
