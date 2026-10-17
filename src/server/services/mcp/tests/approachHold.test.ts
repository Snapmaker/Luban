import { strict as assert } from 'assert';

import {
    APPROACH_DESCENT_GUARD_MM,
    ApproachHoldInput,
    describeApproachHoldPlan,
    holdHandoffText,
    judgeApproachEnd,
    marchWords,
    planApproachHold,
    planHoldRelease,
} from '../approachHold';
import { resolveMarchParams } from '../procedureLimits';
import { StylusReachVerdict } from '../stylusReach';

// The A350: home X-19 Y342 Z328; the stock top in the 2026-09-23 setup was
// touched at toolhead Z ~205.
const travel = { xMin: -19, xMax: 339, yMin: 0, yMax: 342 };
const march = resolveMarchParams({});
const atHome = { x: -19, y: 342, z: 328 };

function input(over: Partial<ApproachHoldInput> = {}): ApproachHoldInput {
    return { staged: atHome, traverseZ: 328, travel, march, x: 150, y: 120, start_z_machine: 210, max_travel_mm: 10, ...over };
}

const reachUnknown: StylusReachVerdict = { status: 'reach-unknown', depthBelowRimMm: null, rimZMachine: null, deepestZMachine: 200, note: 'stylus reach unknown: body collision not checked' };

export const tests: Array<[string, () => void]> = [
    ['the default approach is straight -Z from start_z_machine, hopped to at the traverse height, no datum', () => {
        const plan = planApproachHold(input());
        assert.deepEqual(plan.unit, { x: 0, y: 0, z: -1 });
        assert.deepEqual(plan.start, { x: 150, y: 120, z: 210 });
        assert.deepEqual(plan.limit, { x: 150, y: 120, z: 200 });
        assert.equal(plan.maxTravelMm, 10);
        assert.equal(plan.datumZ, null);
        assert.equal(plan.datumS, null);
        assert.equal(plan.deepestZ, 200);
        assert.equal(plan.onContact, 'hold');
        assert.equal(plan.holdAt, 'contact');
        assert.equal(plan.raiseFirst, false);
        assert.equal(plan.hopDistanceMm, Number(Math.hypot(169, 222).toFixed(3)));
        assert.deepEqual(marchWords(plan, 3), { z: 207 });
    }],

    ['a head below the traverse height raises first; omitted x/y keep the staged XY (no hop)', () => {
        const plan = planApproachHold(input({ staged: { x: 150, y: 120, z: 250 }, x: undefined, y: undefined }));
        assert.equal(plan.raiseFirst, true);
        assert.equal(plan.hopDistanceMm, 0);
        assert.deepEqual(plan.target, { x: 150, y: 120 });
    }],

    ['start_z_machine is required and must lie in 0..traverse; the vector must not point up', () => {
        assert.throws(() => planApproachHold(input({ start_z_machine: undefined })), /start_z_machine is REQUIRED/);
        assert.throws(() => planApproachHold(input({ start_z_machine: 400 })), /must be in 0..328/);
        assert.throws(() => planApproachHold(input({ dx: 0, dy: 0, dz: 1 })), /Upward approaches/);
        assert.throws(() => planApproachHold(input({ dx: 0, dy: 0, dz: 0 })), /must not all be 0/);
        assert.throws(() => planApproachHold(input({ max_travel_mm: undefined })), /max_travel_mm is required/);
        assert.throws(() => planApproachHold(input({ on_contact: 'continue' })), /on_contact must be/);
        assert.throws(() => planApproachHold(input({ hold_at: 'park' })), /hold_at must be/);
    }],

    ['a stated datum bounds the march to it: the limit IS the datum, and the scalar follows the vector', () => {
        const plan = planApproachHold(input({ datum_z_machine: 205, max_travel_mm: 30 }));
        assert.equal(plan.datumZ, 205);
        assert.equal(plan.datumS, 5);
        assert.equal(plan.maxTravelMm, 5);
        assert.equal(plan.limit.z, 205);
        assert.equal(plan.deepestZ, 205);
        // 45 deg down: 5 mm of Z is 5 * sqrt(2) mm along.
        const angled = planApproachHold(input({ dx: 1, dy: 0, dz: -1, datum_z_machine: 205, max_travel_mm: 30 }));
        assert.equal(angled.datumS, Number((5 * Math.SQRT2).toFixed(3)));
        assert.equal(angled.limit.z, 205);
    }],

    ['a datum beyond max_travel_mm, above the start, or on a level march is refused with the numbers', () => {
        assert.throws(() => planApproachHold(input({ datum_z_machine: 195, max_travel_mm: 10 })), /lies 15 mm along the vector, beyond the 10 mm/);
        assert.throws(() => planApproachHold(input({ datum_z_machine: 212 })), /must be below start_z_machine/);
        assert.throws(() => planApproachHold(input({ dx: 1, dy: 0, dz: 0, datum_z_machine: 205 })), /needs a downward component/);
    }],

    ['the march is clamped to the toolhead travel and the bed, and says what clipped it', () => {
        const bed = planApproachHold(input({ start_z_machine: 4, max_travel_mm: 10 }));
        assert.equal(bed.maxTravelMm, 4);
        assert.equal(bed.travelClippedBy, 'machine Z 0 (the bed)');
        const side = planApproachHold(input({ x: 335, dx: 1, dy: 0, dz: 0, max_travel_mm: 20 }));
        assert.equal(side.maxTravelMm, 4);
        assert.ok(side.travelClippedBy);
        assert.throws(() => planApproachHold(input({ x: 339, dx: 1, dy: 0, dz: 0, max_travel_mm: 20 })), /under 0.5 mm/);
    }],

    ['the confirm page enumerates every move - raise, hop, segmented and guarded descent, each coarse step - and states the hold and its release', () => {
        const plan = planApproachHold(input({ staged: { x: 10, y: 10, z: 300 }, max_travel_mm: 3 }));
        const text = describeApproachHoldPlan(plan, reachUnknown);
        const lines = text.split('\n');
        assert.ok(lines.includes('G1 Z328.000 F600; 1) raise STRAIGHT UP to the traverse height first (law 2)'));
        assert.ok(lines.some((l) => l.startsWith('G1 X150.000 Y120.000 F600; 2) hop')));
        assert.ok(lines.some((l) => l.startsWith(`G1 Z${(210 + APPROACH_DESCENT_GUARD_MM).toFixed(3)} F600; 3) descend in <= 5 mm segments`)));
        assert.equal(lines.filter((l) => l.endsWith('; guarded descent step')).length, APPROACH_DESCENT_GUARD_MM);
        assert.equal(lines.filter((l) => / F100; coarse \d+ /.test(l)).length, 3);
        assert.ok(lines.includes('G1 Z207.000 F100; coarse 3 (3.000 mm along) - settle, check probe, stop at contact'));
        assert.ok(lines.some((l) => l.includes('HOLD IN CONTACT at the median contact')));
        assert.ok(lines.some((l) => l.includes('at the travel limit without contact: ABORT')));
        assert.ok(lines.some((l) => l.includes('stop_gcode_job {job_id} ends the hold - raise STRAIGHT UP to the traverse height Z328')));
        assert.ok(lines.includes('; STYLUS REACH: stylus reach unknown: body collision not checked'));
        assert.equal(lines[lines.length - 1], 'G54;');
        assert.ok(lines.includes('G90') && lines.includes('G53;'));
    }],

    ['the page distinguishes the positioning form: unexpected contact aborts, the datum is a released hold, an angled release backs off first', () => {
        const plan = planApproachHold(input({ dx: 0, dy: -1, dz: -1, datum_z_machine: 205, max_travel_mm: 30, on_contact: 'abort' }));
        const text = describeApproachHoldPlan(plan, reachUnknown);
        assert.match(text, /on_contact: abort\): a touch ENDS the approach as UNEXPECTED CONTACT/);
        assert.match(text, /at the datum Z205 with the probe still released: HOLD there/);
        assert.match(text, /back off 1 mm along the reverse vector until the probe releases, then raise STRAIGHT UP/);
        assert.doesNotMatch(text, /HOLD IN CONTACT/);
        const released = describeApproachHoldPlan(planApproachHold(input({ hold_at: 'released' })), reachUnknown);
        assert.match(released, /back off 1 mm along the reverse vector, verify the probe released, and HOLD there/);
    }],

    ['judgeApproachEnd: a contact is the datum or an unexpected stop, never a reason to continue; the limit is success only when it is a datum', () => {
        const hold = { onContact: 'hold' as const, datumZ: null, datumS: null, maxTravelMm: 10 };
        assert.equal(judgeApproachEnd(hold, true, 4.2).kind, 'contact-hold');
        assert.equal(judgeApproachEnd(hold, false, 10).kind, 'no-contact-abort');
        const positioning = { onContact: 'abort' as const, datumZ: 205, datumS: 5, maxTravelMm: 5 };
        const early = judgeApproachEnd(positioning, true, 2);
        assert.equal(early.kind, 'contact-abort');
        assert.match(early.note, /^UNEXPECTED CONTACT 2.000 mm along/);
        assert.match(early.note, /Not continued to the target/);
        // Contact exactly at the last increment is still a contact, not an arrival.
        assert.equal(judgeApproachEnd(positioning, true, 5).kind, 'contact-abort');
        assert.equal(judgeApproachEnd(positioning, false, 5).kind, 'datum-hold');
        assert.equal(judgeApproachEnd({ ...positioning, onContact: 'hold' }, true, 5).kind, 'contact-hold');
    }],

    ['planHoldRelease: a trip moves nothing; a moved head gets a Z-only raise and no back-off; an angled triggered hold backs off along the vector first; straight down just raises', () => {
        const base = { tripLatched: false, headAtHeld: true, triggered: true, heldS: 6.4, backoffMm: 1, straightDown: false };
        assert.equal(planHoldRelease({ ...base, tripLatched: true }).action, 'none');
        const moved = planHoldRelease({ ...base, headAtHeld: false });
        assert.equal(moved.action, 'raise');
        assert.match(moved.reason, /operator moved it/);
        assert.match(moved.reason, /HELD instead because the probe still reads triggered/);
        const angled = planHoldRelease(base);
        assert.equal(angled.action, 'backoff-then-raise');
        if (angled.action === 'backoff-then-raise') {
            assert.equal(angled.backoffS, 5.4);
        }
        const straight = planHoldRelease({ ...base, straightDown: true });
        assert.equal(straight.action, 'raise');
        assert.match(straight.reason, /IS the release direction/);
        assert.equal(planHoldRelease({ ...base, triggered: false }).action, 'raise');
        // The back-off never goes past the march start.
        const shallow = planHoldRelease({ ...base, heldS: 0.4 });
        assert.equal(shallow.action === 'backoff-then-raise' ? shallow.backoffS : -1, 0);
    }],

    ['the handoff text names what the operator does, forbids agent motion, and makes stop_gcode_job the raise', () => {
        const plan = planApproachHold(input());
        const text = holdHandoffText(plan, { kind: 'contact', machine: { x: 150, y: 120, z: 205.3 }, measuredContactMachine: { x: 150, y: 120, z: 205.3 } });
        assert.match(text, /^HOLDING: the tip is HELD IN CONTACT at the measured datum machine \(150, 120, 205.3\)/);
        assert.match(text, /OPERATOR: set the work origin from this held position on the touchscreen/);
        assert.match(text, /setting Z does not set X\/Y/);
        assert.match(text, /AGENT: send NO motion while the hold lasts/);
        assert.match(text, /NEXT MOTION IS THE RAISE \(laws 2 and 8\): call stop_gcode_job \{job_id\} - it raises STRAIGHT UP to the traverse height Z328/);
        assert.match(text, /verify WHICH axes the operator set/);
        const datum = holdHandoffText(plan, { kind: 'datum', machine: { x: 150, y: 120, z: 205 }, measuredContactMachine: null });
        assert.match(datum, /reached WITHOUT contact, probe released/);
        const angled = holdHandoffText({ ...plan, unit: { x: 0.707, y: 0, z: -0.707 } }, { kind: 'released', machine: { x: 151, y: 120, z: 206 }, measuredContactMachine: { x: 151.7, y: 120, z: 205.3 } });
        assert.match(angled, /held 1 mm off the measured datum \(contact at machine Z205.3\)/);
        assert.match(angled, /backs off 1 mm along the reverse vector until the probe releases, then raises STRAIGHT UP/);
    }],
];
