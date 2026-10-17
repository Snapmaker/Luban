/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (probe_approach_and_hold
// arguments are read verbatim by planApproachHold's caller).
//
// probe_approach_and_hold: the guarded datum approach with an explicit
// operator handoff (issue #188). During the 2026-09-23/24 datum setups the
// operator needed the touch probe brought to the stock - slow near the
// surface, stopped on contact or at a measured datum - and LEFT THERE for the
// touchscreen work-origin confirmation. The pieces existed (run_tool_setter's
// stay_at_trigger, probe_point's march, probe_sequence's guarded descent) but
// did not compose into one approved, sensor-gated approach that holds; an
// assistant proposed one continuous descent to the calculated datum instead,
// and the operator withdrew it.
//
// This module is the PURE part: the plan geometry, the confirm-page text,
// the decision of how a march ended, how a hold is released, and the handoff
// text. probeApproachHold.ts drives the machine with it. No server imports
// (unit-tested in tests/approachHold.test.ts).

import { MIN_USEFUL_MARCH_MM, TravelLimits, clampRay } from './machineTravel';
import {
    COARSE_FEED,
    MARCH_SEGMENT_MM,
    MARCH_TRAVEL_MM,
    ResolvedMarchParams,
    TRAVEL_FEED,
    within,
} from './procedureLimits';
import { StylusReachVerdict, describeStylusReach } from './stylusReach';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

export interface Xyz {
    x: number;
    y: number;
    z: number;
}

/** The guarded final approach to start_z_machine: segmented descent to this far above it, then 1 mm sensor-checked steps (probeSequence.DESCENT_GUARD_MM). */
export const APPROACH_DESCENT_GUARD_MM = 20;
/** How often the hold loop re-reads the stop request, the trip latch, the sensor and the heartbeat. */
export const APPROACH_HOLD_POLL_MS = 250;
/**
 * How far the heartbeat may drift from the held position before the hold
 * reports that the operator moved the head (touchscreen jogs during the
 * origin setup); the runner's own recheck tolerance.
 */
export const APPROACH_HOLD_MOVED_MM = 0.5;

export type OnContact = 'hold' | 'abort';
export type HoldAt = 'contact' | 'released';

export class ApproachHoldPlanError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'ApproachHoldPlanError';
    }
}

export interface ApproachHoldInput {
    /** The position of record at staging (machine). */
    staged: Xyz;
    /** mcpSafeTraverseZ: the hop height and the height every retreat ends at. */
    traverseZ: number;
    /** Where the march starts, machine XY; omitted axes default to the staged position. */
    x?: unknown;
    y?: unknown;
    /** start_z_machine: toolhead Z where the sensor-gated march begins - measured or operator-stated, never a guess. */
    start_z_machine?: unknown;
    /** Direction of the march; default straight down. */
    dx?: unknown;
    dy?: unknown;
    dz?: unknown;
    max_travel_mm?: unknown;
    /** A stated datum Z the march may reach WITHOUT contact and hold there (positioning mode). */
    datum_z_machine?: unknown;
    on_contact?: unknown;
    hold_at?: unknown;
    travel: TravelLimits;
    march: ResolvedMarchParams;
}

export interface ApproachHoldPlan {
    staged: Xyz;
    traverseZ: number;
    /** The head is below the traverse height at staging: the first move is the Z-only raise. */
    raiseFirst: boolean;
    target: { x: number; y: number };
    hopDistanceMm: number;
    startZ: number;
    /** Machine position the march starts from. */
    start: Xyz;
    unit: Xyz;
    requestedTravelMm: number;
    /** The march envelope after the travel and the datum have bounded it. */
    maxTravelMm: number;
    travelClippedBy: string | null;
    limit: Xyz;
    datumZ: number | null;
    /** Scalar along the vector at which the tip reaches the datum (= maxTravelMm when a datum is stated). */
    datumS: number | null;
    /** The deepest toolhead Z the plan can command (stylus reach, issue #187). */
    deepestZ: number;
    onContact: OnContact;
    holdAt: HoldAt;
    march: ResolvedMarchParams;
}

const r3 = (v: number) => Number(v.toFixed(3));

function optionalNumber(raw: unknown, fallback: number, name: string): number {
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
        throw new ApproachHoldPlanError(`${name} must be a finite number.`);
    }
    return n;
}

/**
 * The plan: raise (if needed) -> hop at the traverse height -> guarded
 * descent to start_z_machine -> sensor-gated march along the vector, bounded
 * by max_travel_mm, the toolhead travel, machine Z 0 and the stated datum ->
 * HOLD. Every refusal names the argument; nothing is invented (law 3).
 */
export function planApproachHold(input: ApproachHoldInput): ApproachHoldPlan {
    const { staged, traverseZ } = input;
    const target = {
        x: r3(optionalNumber(input.x, staged.x, 'x')),
        y: r3(optionalNumber(input.y, staged.y, 'y')),
    };
    const startZ = Number(input.start_z_machine);
    if (input.start_z_machine === undefined || input.start_z_machine === null || !Number.isFinite(startZ)) {
        throw new ApproachHoldPlanError('start_z_machine is REQUIRED: the toolhead machine Z at which the sensor-gated march begins '
            + '(a measured top plus a few mm, or an operator-stated clear height) - never a guess.');
    }
    if (startZ <= 0 || startZ > traverseZ) {
        throw new ApproachHoldPlanError(`start_z_machine ${startZ} must be in 0..${traverseZ} (the traverse height).`);
    }
    const dx = optionalNumber(input.dx, 0, 'dx');
    const dy = optionalNumber(input.dy, 0, 'dy');
    const dz = input.dx === undefined && input.dy === undefined && input.dz === undefined ? -1 : optionalNumber(input.dz, 0, 'dz');
    const norm = Math.hypot(dx, dy, dz);
    if (norm < 1e-9) {
        throw new ApproachHoldPlanError('dx/dy/dz must not all be 0 (omit all three for a straight -Z approach).');
    }
    if (dz > 1e-9) {
        throw new ApproachHoldPlanError('Upward approaches (dz > 0) are refused.');
    }
    // Six decimals like probe_vector: a 3-decimal unit puts a 45 deg datum a
    // thousandth of a millimetre off along the vector.
    const unit = { x: Number((dx / norm).toFixed(6)), y: Number((dy / norm).toFixed(6)), z: Number((dz / norm).toFixed(6)) };
    const requested = Number(input.max_travel_mm);
    if (!within(requested, MARCH_TRAVEL_MM)) {
        throw new ApproachHoldPlanError(`max_travel_mm is required: how far the march may run before it ends (${MARCH_TRAVEL_MM.min}-${MARCH_TRAVEL_MM.max}).`);
    }
    const onContactRaw = input.on_contact === undefined ? 'hold' : String(input.on_contact);
    if (onContactRaw !== 'hold' && onContactRaw !== 'abort') {
        throw new ApproachHoldPlanError('on_contact must be "hold" (contact IS the datum: confirm it and hold there) or "abort" (contact is unexpected: stop, report, raise).');
    }
    const holdAtRaw = input.hold_at === undefined ? 'contact' : String(input.hold_at);
    if (holdAtRaw !== 'contact' && holdAtRaw !== 'released') {
        throw new ApproachHoldPlanError('hold_at must be "contact" (tip held against the surface) or "released" (backed off backoff_mm along the reverse vector, sensor released).');
    }

    const start = { x: target.x, y: target.y, z: r3(startZ) };
    const ray = clampRay(start, unit, requested, input.travel);
    let travel = ray.travelMm;
    let clippedBy = ray.clippedBy;
    if (unit.z < -1e-9) {
        const toFloor = (0 - start.z) / unit.z;
        if (toFloor < travel) {
            travel = r3(Math.max(0, toFloor));
            clippedBy = 'machine Z 0 (the bed)';
        }
    }

    let datumZ: number | null = null;
    let datumS: number | null = null;
    if (input.datum_z_machine !== undefined && input.datum_z_machine !== null && input.datum_z_machine !== '') {
        datumZ = Number(input.datum_z_machine);
        if (!Number.isFinite(datumZ) || datumZ < 0) {
            throw new ApproachHoldPlanError('datum_z_machine must be a finite toolhead machine Z >= 0 (a MEASURED datum, never a guess).');
        }
        if (unit.z > -1e-9) {
            throw new ApproachHoldPlanError('datum_z_machine needs a downward component (dz < 0): a level march never reaches a Z datum.');
        }
        if (datumZ >= startZ - TRAVERSE_Z_TOLERANCE_MM) {
            throw new ApproachHoldPlanError(`datum_z_machine ${datumZ} must be below start_z_machine ${startZ}.`);
        }
        datumS = r3((startZ - datumZ) / -unit.z);
        if (datumS > travel + 1e-9) {
            throw new ApproachHoldPlanError(`datum_z_machine ${datumZ} lies ${datumS} mm along the vector, beyond the ${travel} mm the march may run `
                + `(max_travel_mm ${requested}${clippedBy ? `, shortened by ${clippedBy}` : ''}). Raise max_travel_mm or the datum.`);
        }
        travel = datumS;
        clippedBy = clippedBy && ray.travelMm < datumS ? clippedBy : null;
    }
    if (!Number.isFinite(travel) || travel < MIN_USEFUL_MARCH_MM) {
        throw new ApproachHoldPlanError(`The march, bounded by the toolhead travel${datumZ === null ? '' : ' and the datum'}, is under ${MIN_USEFUL_MARCH_MM} mm `
            + `- already at ${clippedBy || 'the limit'} along this direction.`);
    }
    const limit = {
        x: r3(start.x + unit.x * travel),
        y: r3(start.y + unit.y * travel),
        z: r3(datumZ !== null ? datumZ : start.z + unit.z * travel),
    };
    const hopDistanceMm = r3(Math.hypot(target.x - staged.x, target.y - staged.y));
    return {
        staged,
        traverseZ,
        raiseFirst: staged.z < traverseZ - TRAVERSE_Z_TOLERANCE_MM,
        target,
        hopDistanceMm,
        startZ: start.z,
        start,
        unit,
        requestedTravelMm: requested,
        maxTravelMm: r3(travel),
        travelClippedBy: clippedBy,
        limit,
        datumZ: datumZ === null ? null : r3(datumZ),
        datumS,
        deepestZ: Math.min(start.z, limit.z),
        onContact: onContactRaw,
        holdAt: holdAtRaw,
        march: input.march,
    };
}

export function pointAlong(plan: Pick<ApproachHoldPlan, 'start' | 'unit'>, s: number): Xyz {
    return {
        x: r3(plan.start.x + plan.unit.x * s),
        y: r3(plan.start.y + plan.unit.y * s),
        z: r3(plan.start.z + plan.unit.z * s),
    };
}

/** Which axes the march move needs - a pure -Z approach never commands X or Y. */
export function marchWords(plan: Pick<ApproachHoldPlan, 'start' | 'unit'>, s: number): { x?: number; y?: number; z?: number } {
    const p = pointAlong(plan, s);
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

function wordText(w: { x?: number; y?: number; z?: number }): string {
    return [
        w.x !== undefined ? `X${w.x.toFixed(3)}` : '',
        w.y !== undefined ? `Y${w.y.toFixed(3)}` : '',
        w.z !== undefined ? `Z${w.z.toFixed(3)}` : '',
    ].filter(Boolean).join(' ');
}

/**
 * The confirm page: every move the runner will command, in order, and the
 * one it will NOT make at the end (the hold). The hold's release is stated
 * too, because that is the next motion the operator will see.
 */
export function describeApproachHoldPlan(plan: ApproachHoldPlan, stylusReach: StylusReachVerdict): string {
    const m = plan.march;
    const dir = `(${plan.unit.x}, ${plan.unit.y}, ${plan.unit.z})`;
    const releaseText = plan.unit.z < -1e-9 && Math.abs(plan.unit.x) < 1e-9 && Math.abs(plan.unit.y) < 1e-9
        ? 'raise STRAIGHT UP'
        : `back off ${m.backoffMm} mm along the reverse vector until the probe releases, then raise STRAIGHT UP`;
    const lines = [
        '; PROBE APPROACH AND HOLD (server-driven, sensor-gated on the probe channel; issue #188)',
        '; PURPOSE: bring the probe tip to the work datum and HOLD it there for the operator\'s touchscreen',
        ';   work-origin setup. This procedure does NOT raise at the end - a sanctioned hold (motion law 8,',
        ';   like run_tool_setter stay_at_trigger). The job stays "started" while it holds.',
        `; every move toward the work is sent as sensor-checked segments of <= ${MARCH_SEGMENT_MM} mm (the coarse step is the logical advance);`,
        ';   EVERY LINE IS SENT INDIVIDUALLY: after each move settles the probe feed is read before the next.',
        `; sensors: contact is EXPECTED only during the final march${plan.onContact === 'abort'
            ? ' - and there it is UNEXPECTED (on_contact: abort): a touch ENDS the approach as UNEXPECTED CONTACT and raises; it is never continued to the datum'
            : ' (on_contact: hold - the contact IS the datum)'}; a probe trigger during the raise, hop or`,
        ';   guarded descent latches the CRASH alarm. The probe feed must be connected (overtravel tripwire armed).',
        describeStylusReach(stylusReach),
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)}) - re-verified before any motion`,
        'G90',
        'G53;',
    ];
    if (plan.raiseFirst) {
        lines.push(`G1 Z${plan.traverseZ.toFixed(3)} F${TRAVEL_FEED}; 1) raise STRAIGHT UP to the traverse height first (law 2)`);
    } else {
        lines.push(`; 1) already at the traverse height Z${plan.traverseZ} - no raise`);
    }
    if (plan.hopDistanceMm > 1e-9) {
        lines.push(`G1 X${plan.target.x.toFixed(3)} Y${plan.target.y.toFixed(3)} F${TRAVEL_FEED}; 2) hop ${plan.hopDistanceMm.toFixed(1)} mm at Z${plan.traverseZ} (crash guard armed)`);
    } else {
        lines.push(`; 2) already over (${plan.target.x}, ${plan.target.y}) - no hop`);
    }
    const guardTop = r3(plan.startZ + APPROACH_DESCENT_GUARD_MM);
    lines.push(`G1 Z${Math.min(guardTop, plan.traverseZ).toFixed(3)} F${TRAVEL_FEED}; 3) descend in <= 5 mm segments (crash guard armed) to ${APPROACH_DESCENT_GUARD_MM} mm above start_z_machine`);
    lines.push('; ...guarded final approach: 1 mm steps, sensor-checked after each - ANY contact here aborts (the surface is above start_z_machine) and raises');
    for (let gz = Math.min(guardTop, plan.traverseZ) - 1; gz > plan.startZ - 1e-9; gz -= 1) {
        lines.push(`G1 Z${Math.max(gz, plan.startZ).toFixed(3)} F${COARSE_FEED}; guarded descent step`);
    }
    lines.push(`; --- 4) MARCH along ${dir} from (${plan.start.x}, ${plan.start.y}, ${plan.start.z}), max ${plan.maxTravelMm} mm`
        + `${plan.datumZ !== null ? ` = to the stated datum toolhead Z${plan.datumZ}` : ' (no datum stated: contact is the only success)'}`
        + `${plan.travelClippedBy ? ` (requested ${plan.requestedTravelMm}: shortened by ${plan.travelClippedBy})` : ''} ---`);
    let s = 0;
    let n = 0;
    while (plan.maxTravelMm - s > 1e-9) {
        s = Math.min(s + m.coarseStepMm, plan.maxTravelMm);
        n += 1;
        lines.push(`G1 ${wordText(marchWords(plan, s))} F${COARSE_FEED}; coarse ${n} (${s.toFixed(3)} mm along) - settle, check probe, stop at contact`);
    }
    if (plan.onContact === 'hold') {
        lines.push(`; ...on contact: retreat ${m.coarseStepMm} mm steps until released, ${m.fineStepMm} mm fine approach to contact, ${m.confirmPasses} confirm`
            + ` cycle(s) (lift ${m.backoffMm} mm, wait for release, re-approach); the datum = the median contact (spread reported);`);
        lines.push(plan.holdAt === 'contact'
            ? '; ...then HOLD IN CONTACT at the median contact (the probe reads triggered) - no retreat.'
            : `; ...then back off ${m.backoffMm} mm along the reverse vector, verify the probe released, and HOLD there - no retreat.`);
    } else {
        lines.push('; ...on contact (UNEXPECTED, on_contact: abort): no fine approach, no hold - back off to the march start and raise; the ending says unexpected-contact.');
    }
    lines.push(plan.datumZ !== null
        ? `; ...at the datum Z${plan.datumZ} with the probe still released: HOLD there (released) - the stated datum was reached without contact.`
        : '; ...at the travel limit without contact: ABORT (nothing within max_travel_mm) and raise straight up to the traverse height.');
    lines.push(
        '; 5) HOLD: NO further motion from this procedure. The operator sets the work origin on the touchscreen from the held tip;',
        ';    the job stays "started" and get_gcode_job_status / the job record carry the hold. The agent sends NO motion while it holds.',
        `;    THE NEXT MOTION IS THE RAISE: stop_gcode_job {job_id} ends the hold - ${releaseText} to the traverse height Z${plan.traverseZ}`,
        ';    (law 8); the job ends "stopped" with the measurement and the hold kept in result. A probe still triggered after the back-off',
        ';    is HELD for the operator instead of dragged. Any abort before the hold raises straight up the same way.',
        'G54;',
    );
    return lines.join('\n');
}

export type ApproachEnd =
    | { kind: 'contact-hold'; note: string }
    | { kind: 'contact-abort'; note: string }
    | { kind: 'datum-hold'; note: string }
    | { kind: 'no-contact-abort'; note: string };

/**
 * How the march ended, from what the sensor said and where the march stopped.
 * An early contact is NEVER permission to continue to the numerical target:
 * with on_contact "abort" it ends the approach as UNEXPECTED CONTACT, with
 * "hold" it IS the datum. Reaching the limit without contact is success only
 * when that limit is a stated datum.
 */
export function judgeApproachEnd(
    plan: Pick<ApproachHoldPlan, 'onContact' | 'datumZ' | 'datumS' | 'maxTravelMm'>,
    contact: boolean,
    stoppedAtS: number
): ApproachEnd {
    if (contact) {
        if (plan.onContact === 'abort') {
            return {
                kind: 'contact-abort',
                note: `UNEXPECTED CONTACT ${stoppedAtS.toFixed(3)} mm along the approach (on_contact: abort) - something is where the plan `
                    + `says nothing should be${plan.datumZ !== null ? `, above the stated datum Z${plan.datumZ}` : ''}. Not continued to the target; raising.`,
            };
        }
        return { kind: 'contact-hold', note: `contact ${stoppedAtS.toFixed(3)} mm along the approach: confirming it as the datum, then holding.` };
    }
    if (plan.datumS !== null && stoppedAtS >= plan.datumS - 1e-9) {
        return { kind: 'datum-hold', note: `the stated datum Z${plan.datumZ} was reached with the probe released: holding there.` };
    }
    return {
        kind: 'no-contact-abort',
        note: `reached the travel limit ${plan.maxTravelMm.toFixed(3)} mm without contact - nothing to probe within max_travel_mm, or the probe is not reporting.`,
    };
}

export interface HoldRecord {
    /** What the hold is: the tip in contact at the measured datum, backed off from it, or at the stated datum without contact. */
    kind: 'contact' | 'released' | 'datum';
    /** Where the head is held (machine, the commanded position). */
    machine: Xyz;
    /** Scalar along the approach vector of the held position. */
    heldS: number;
    /** The measured datum (median contact), when a contact was confirmed. */
    measuredContactMachine: Xyz | null;
    confirmPassContacts: number[];
    spreadMm: number | null;
    /** The probe channel's reading when the hold began. */
    sensor: 'triggered' | 'released' | 'unknown';
    since: number;
    /** What the operator does now and what the agent must (not) do. */
    handoff: string;
    /** Set when the heartbeat showed the head somewhere else during the hold: the operator jogged it (touchscreen). */
    operatorMoved: { at: number; machine: Xyz; note: string } | null;
    /** Set when the sensor changed state during the hold. */
    sensorChanged: { at: number; sensor: 'triggered' | 'released'; note: string } | null;
    /** How the hold ended, once it has. */
    released: { at: number; how: 'raised' | 'held-triggered' | 'no-retreat' | 'raise-skipped'; finalZ: number | null; note: string } | null;
}

/**
 * The handoff text: who does what next. The agent's next motion is the
 * raise (law 2 / law 8), and stop_gcode_job is that raise.
 */
export function holdHandoffText(plan: Pick<ApproachHoldPlan, 'traverseZ' | 'unit' | 'march'>, record: Pick<HoldRecord, 'kind' | 'machine' | 'measuredContactMachine'>): string {
    const where = `machine (${record.machine.x}, ${record.machine.y}, ${record.machine.z})`;
    let what: string;
    if (record.kind === 'contact') {
        what = `the tip is HELD IN CONTACT at the measured datum ${where} (probe triggered)`;
    } else if (record.kind === 'released') {
        what = `the tip is held ${plan.march.backoffMm} mm off the measured datum (${record.measuredContactMachine
            ? `contact at machine Z${record.measuredContactMachine.z}` : 'contact'}) at ${where}, probe released`;
    } else {
        what = `the tip is held at the stated datum ${where} - reached WITHOUT contact, probe released`;
    }
    const straightUp = plan.unit.z < -1e-9 && Math.abs(plan.unit.x) < 1e-9 && Math.abs(plan.unit.y) < 1e-9;
    return `HOLDING: ${what}. OPERATOR: set the work origin from this held position on the touchscreen (Z from the tip; X/Y only if this `
        + 'position is their XY datum too - setting Z does not set X/Y). AGENT: send NO motion while the hold lasts; the job stays "started". '
        + `When the operator says the origin is set, the NEXT MOTION IS THE RAISE (laws 2 and 8): call stop_gcode_job {job_id} - it ${straightUp
            ? 'raises STRAIGHT UP' : `backs off ${plan.march.backoffMm} mm along the reverse vector until the probe releases, then raises STRAIGHT UP`} `
        + `to the traverse height Z${plan.traverseZ} and ends the job "stopped" with this measurement and hold kept in result (ending stopped-by-agent). `
        + 'A probe still triggered after the back-off is HELD, not dragged - free it by hand, then stop again. Afterwards re-read get_position '
        + 'and its originOffset to verify WHICH axes the operator set (a Z-only change is not an XYZ setup); never apply a tool-length compensation '
        + 'the touchscreen already applied.';
}

export type HoldReleaseStep =
    | { action: 'none'; reason: string }
    | { action: 'raise'; reason: string }
    | { action: 'backoff-then-raise'; backoffS: number; reason: string };

/**
 * How to end a hold when stop_gcode_job (or any abort) arrives: the tip must
 * come off the surface before the Z-only raise, along the proven reverse
 * vector - but only from the position the hold left it at. If the operator
 * has moved the head, the reverse vector means nothing; the raise is then the
 * one move that cannot descend, and a probe still triggered holds (law 8).
 */
export function planHoldRelease(input: {
    tripLatched: boolean;
    headAtHeld: boolean;
    triggered: boolean;
    heldS: number;
    backoffMm: number;
    straightDown: boolean;
}): HoldReleaseStep {
    if (input.tripLatched) {
        return { action: 'none', reason: 'overtravel / crash latched - the connection is being closed, no motion issued' };
    }
    if (!input.headAtHeld) {
        return {
            action: 'raise',
            reason: 'the head is no longer at the held position (the operator moved it): no reverse-vector back-off; a Z-only raise from '
                + `wherever it is${input.triggered ? ', HELD instead because the probe still reads triggered (law 8)' : ''}`,
        };
    }
    if (input.triggered && !input.straightDown) {
        return {
            action: 'backoff-then-raise',
            backoffS: Math.max(0, Number((input.heldS - input.backoffMm).toFixed(3))),
            reason: `probe triggered at the held position: back off ${input.backoffMm} mm along the reverse vector (the path the confirm cycles proved releases it), verify release, then raise`,
        };
    }
    return {
        action: 'raise',
        reason: input.triggered
            ? 'probe triggered on a straight -Z hold: the Z-only raise IS the release direction'
            : 'probe released at the held position: Z-only raise to the traverse height',
    };
}
