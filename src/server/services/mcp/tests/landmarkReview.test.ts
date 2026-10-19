/* eslint-disable camelcase */
// Review fields are MCP tool results, snake_case by convention.
import { strict as assert } from 'assert';

import { CLEARANCE_MARGIN_MM } from '../landmarkClearance';
import {
    LandmarkConfirmation,
    ReviewDeviceConflict,
    classifyLandmarkChange,
    describeReviewedLandmark,
    landmarkSetFingerprint,
    mergeLandmarkUpdate,
    reviewLandmarks,
} from '../landmarkReview';
import { FlowLandmark, FlowMachine, NewFlowLandmark, createLandmarkReviewFlow } from '../landmarkReviewFlow';
import { OperatorReviewStore } from '../operatorReviews';

const A350 = 'Snapmaker 2.0 A350';
const RAY = 'Snapmaker Ray';
const HOUR = 3600000;

function landmark(over: Partial<FlowLandmark> = {}): FlowLandmark {
    return {
        id: 'rot1',
        name: 'rotary',
        description: 'rotary module span',
        machine: { x0: 140, y0: 0, x1: 200, y1: 300 },
        clearanceZ: 280,
        clearanceBasis: 'toolhead',
        notes: null,
        createdAt: 0,
        machineIdentifier: A350,
        ...over,
    };
}

/** The A350 as stored today: two legacy toolhead clearances of 280. */
function a350Landmarks(): FlowLandmark[] {
    return [
        landmark(),
        landmark({ id: 'ts1', name: 'tool-setter', description: 'tool length setter', machine: { x0: 300, y0: 280, x1: 340, y1: 320 } }),
    ];
}

/** A whole flow over in-memory fakes: the real flow, stage -> approve -> apply, without a server. */
function harness(initial: FlowLandmark[] = [], machine: Partial<FlowMachine> = {}) {
    const state = {
        now: 10 * HOUR,
        session: 'p1:1.1' as string | null,
        landmarks: initial.map((l) => ({ ...l, machine: { ...l.machine } })),
        machine: { identifier: A350, machineKey: A350, deviceConflict: null as ReviewDeviceConflict | null, ...machine },
        confirmations: {} as { [key: string]: LandmarkConfirmation | null },
        ttlHours: 24,
        protrusion: 40 as number | null,
        assigned: [] as boolean[],
        nextId: 1,
    };
    const reviews = new OperatorReviewStore(() => state.now);
    const flow = createLandmarkReviewFlow({
        store: {
            listFor: (id) => state.landmarks.filter((l) => l.machineIdentifier === id),
            add: (l: NewFlowLandmark) => {
                state.landmarks = state.landmarks.filter((x) => !(x.name === l.name && x.machineIdentifier === l.machineIdentifier));
                const full: FlowLandmark = { ...l, id: `n${state.nextId++}`, createdAt: state.now };
                state.landmarks.push(full);
                return full;
            },
            put: (l) => {
                const i = state.landmarks.findIndex((x) => x.id === l.id);
                if (i < 0) {
                    throw new Error('unknown id');
                }
                state.landmarks[i] = { ...l };
            },
            removeId: (id) => {
                const before = state.landmarks.length;
                state.landmarks = state.landmarks.filter((l) => l.id !== id);
                return state.landmarks.length !== before;
            },
        },
        reviews,
        now: () => state.now,
        machine: () => state.machine,
        session: () => state.session,
        ttlHours: () => state.ttlHours,
        getConfirmation: (key) => (key ? state.confirmations[key] || null : null),
        setConfirmation: (key, c) => {
            state.confirmations[key] = c;
        },
        toolProtrusionMm: () => state.protrusion,
        assignMachineDevice: (same) => {
            state.assigned.push(same);
            state.machine = { ...state.machine, deviceConflict: null };
            return { machineKey: A350, deviceId: 'sn:2', created: !same };
        },
        confirmBaseUrl: () => 'http://127.0.0.1:40889',
    });
    /** The operator's click: the only path that confirms. */
    const operator = (staged: object, action: 'approve' | 'reject' = 'approve') => {
        const id = (staged as { staged: { review_id: string } }).staged.review_id;
        return reviews.decide(id, action, state.machine.machineKey);
    };
    const confirm = () => operator(flow.stageConfirmation(null));
    return { state, flow, reviews, operator, confirm };
}

export const tests: Array<[string, () => void]> = [
    // ---- status matrix ----
    ['status matrix: empty, legacy-basis, unconfirmed, stale, device-conflict, confirmed', () => {
        const ray = harness([], { identifier: RAY, machineKey: RAY });
        const empty = ray.flow.review();
        assert.equal(empty.status, 'empty');
        assert.equal(empty.confirmed, false);
        assert.match(empty.question as string, /What is on the bed right now/);
        assert.match(empty.question as string, /Snapmaker Ray/);

        const a = harness(a350Landmarks());
        const legacy = a.flow.review();
        assert.equal(legacy.status, 'legacy-basis');
        assert.deepEqual(legacy.landmarks.map((l) => l.name), ['rotary', 'tool-setter']);
        assert.match(legacy.question as string, /'rotary' and 'tool-setter' are on the legacy basis/);
        assert.match(legacy.question as string, /PHYSICAL top/);
        assert.match(legacy.question as string, /X140..200 Y0..300/);

        const physical = harness([landmark({ clearanceBasis: 'physical', clearanceZ: 150 })]);
        assert.equal(physical.flow.review().status, 'unconfirmed');

        physical.confirm();
        assert.equal(physical.flow.review().status, 'confirmed');
        assert.equal(physical.flow.review().question, null);
        physical.state.session = 'p1:2.1';
        const stale = physical.flow.review();
        assert.equal(stale.status, 'stale');
        assert.match(stale.invalidated_because as string, /disconnected/);

        const conflicted = harness(a350Landmarks(), {
            deviceConflict: { deviceId: 'sn:2', recorded: ['sn:1'], note: 'This A350 presents sn:2.' },
        });
        const conflict = conflicted.flow.review();
        assert.equal(conflict.status, 'device-conflict');
        assert.match(conflict.question as string, /same physical machine as sn:1/);
        assert.match(conflict.answer_with[0], /assign_machine_device/);
    }],
    ['confirmed wins over legacy-basis once the operator approves: the A350 acceptance path', () => {
        const a = harness(a350Landmarks());
        a.confirm();
        const r = a.flow.review();
        assert.equal(r.status, 'confirmed');
        assert.equal(r.landmarks[0].confirmedAt, a.state.now);
        assert.equal(r.landmarks[0].requiredToolheadZ, 280, 'legacy record still enforced as stated');
    }],
    ['an empty bed is confirmable (the Ray / Original would otherwise stage every move forever)', () => {
        const ray = harness([], { identifier: RAY, machineKey: RAY });
        ray.confirm();
        assert.equal(ray.flow.review().status, 'confirmed');
    }],

    // ---- R4: only the operator's click confirms ----
    ['confirm_landmarks alone confirms nothing; the approval does; a rejection changes nothing', () => {
        const a = harness(a350Landmarks());
        const staged = a.flow.stageConfirmation('operator says the rotary is fitted') as { confirmed: boolean; staged: { confirm_url: string; state: string } };
        assert.equal(staged.confirmed, false);
        assert.match(staged.staged.confirm_url, /^http:\/\/127\.0\.0\.1:40889\/confirm\/r[0-9a-f]+$/);
        assert.equal(staged.staged.state, 'awaiting_confirmation');
        assert.equal(a.flow.review().status, 'legacy-basis');
        assert.equal(a.state.confirmations[A350], undefined);
        assert.equal(a.flow.review().pending_reviews.length, 1);

        a.operator(staged, 'reject');
        assert.equal(a.flow.review().status, 'legacy-basis');
        assert.equal(a.state.confirmations[A350], undefined);

        const again = a.flow.stageConfirmation(null);
        const item = a.operator(again);
        assert.equal(item.state, 'approved');
        assert.equal(a.flow.review().status, 'confirmed');
        assert.equal((a.state.confirmations[A350] as LandmarkConfirmation).reviewId, item.id);
    }],
    ['a review page staged before an edit, a reconnect or on another machine is refused on approval', () => {
        const a = harness(a350Landmarks());
        const staged = a.flow.stageConfirmation(null);
        a.flow.setLandmark({ name: 'vise', description: 'bench vise', box: { x0: 0, y0: 0, x1: 50, y1: 50 }, clearance: { z: 90, basis: 'physical' } }, A350);
        const refused = a.operator(staged);
        assert.equal(refused.state, 'refused');
        assert.match(refused.error as string, /landmarks changed after this page was staged/);
        assert.notEqual(a.flow.review().status, 'confirmed');

        const b = harness(a350Landmarks());
        const s2 = b.flow.stageConfirmation(null);
        b.state.session = 'p1:2.1';
        assert.match(b.operator(s2).error as string, /reconnected/);

        const c = harness(a350Landmarks());
        const s3 = c.flow.stageConfirmation(null) as { staged: { review_id: string } };
        const other = c.reviews.decide(s3.staged.review_id, 'approve', RAY);
        assert.equal(other.state, 'refused');
        assert.match(other.error as string, /staged for Snapmaker 2.0 A350/);
    }],
    ['confirm_landmarks is refused with no machine connected and while a device conflict is open', () => {
        const a = harness(a350Landmarks());
        a.state.session = null;
        assert.throws(() => a.flow.stageConfirmation(null), /No machine is connected/);
        const b = harness(a350Landmarks(), { deviceConflict: { deviceId: 'sn:2', recorded: ['sn:1'], note: 'Conflict.' } });
        assert.throws(() => b.flow.stageConfirmation(null), /assign_machine_device/);
    }],

    // ---- resets ----
    ['confirmation resets on any edit, a device conflict, a disconnect and the TTL', () => {
        const a = harness([landmark({ clearanceBasis: 'physical', clearanceZ: 150 })]);
        a.confirm();
        // Edit (tightening applies at once, and asks again).
        const raised = a.flow.setLandmark({ name: 'rotary', clearance: { z: 160, basis: 'physical' } }, A350);
        assert.equal(raised.applied, true);
        const edited = a.flow.review();
        assert.equal(edited.status, 'unconfirmed');
        assert.match(edited.invalidated_because as string, /edited/);

        a.confirm();
        a.state.machine = { ...a.state.machine, deviceConflict: { deviceId: 'sn:2', recorded: ['sn:1'], note: 'Conflict.' } };
        assert.equal(a.flow.review().status, 'device-conflict');
        a.state.machine = { ...a.state.machine, deviceConflict: null };

        a.state.session = null;
        assert.equal(a.flow.review().status, 'stale');
        a.state.session = 'p1:1.1';
        assert.equal(a.flow.review().status, 'confirmed', 'same connection again (the fake never changed it)');

        a.state.now += 24 * HOUR + 1;
        const expired = a.flow.review();
        assert.equal(expired.status, 'stale');
        assert.match(expired.invalidated_because as string, /landmark_confirm_ttl_hours \(24 h\)/);
    }],
    ['a stale or unconfirmed landmark is still listed and enforced with its full requirement', () => {
        const a = harness(a350Landmarks());
        a.confirm();
        a.state.now += 48 * HOUR;
        const r = a.flow.review();
        // Legacy records outrank 'stale': the restatement question is the one to ask.
        assert.equal(r.status, 'legacy-basis');
        assert.match(r.invalidated_because as string, /landmark_confirm_ttl_hours/);
        assert.equal(r.landmarks.length, 2);
        assert.equal(r.landmarks[0].requiredToolheadZ, 280);
        assert.match(r.enforcement, /ENFORCED in full/);
        assert.equal(a.state.landmarks.length, 2, 'staleness never removes anything');
    }],
    ['the device-conflict page calls assignMachineDevice only on approval, and asks the review again', () => {
        const a = harness(a350Landmarks(), { deviceConflict: { deviceId: 'sn:2', recorded: ['sn:1'], note: 'Conflict.' } });
        a.state.confirmations[A350] = {
            at: a.state.now, session: 'p1:1.1', fingerprint: landmarkSetFingerprint(a.state.landmarks), items: {}, reviewId: 'old', note: null,
        };
        const staged = a.flow.stageDeviceAssignment(true);
        assert.deepEqual(a.state.assigned, []);
        a.operator(staged);
        assert.deepEqual(a.state.assigned, [true]);
        assert.equal(a.state.confirmations[A350], null);
        assert.equal(a.flow.review().status, 'legacy-basis');
        assert.throws(() => a.flow.stageDeviceAssignment(true), /No device conflict/);
    }],

    // ---- delete and loosening are staged; tightening is immediate ----
    ['delete_landmark stages: nothing is removed until the operator approves', () => {
        const a = harness(a350Landmarks());
        const staged = a.flow.deleteLandmark('tool-setter', A350) as { removed: boolean };
        assert.equal(staged.removed, false);
        assert.equal(a.state.landmarks.length, 2);
        a.operator(staged);
        assert.deepEqual(a.state.landmarks.map((l) => l.name), ['rotary']);
        assert.throws(() => a.flow.deleteLandmark('nope', A350), /No landmark "nope"/);
        // Another machine's records are not reachable by name.
        assert.throws(() => a.flow.deleteLandmark('rotary', RAY), /No landmark "rotary" applies to Snapmaker Ray/);
    }],
    ['loosening stages and the old record applies until approval; a lower physical top, a smaller box, un-marking', () => {
        const a = harness([landmark({ clearanceBasis: 'physical', clearanceZ: 150 })]);
        const lower = a.flow.setLandmark({ name: 'rotary', clearance: { z: 120, basis: 'physical' } }, A350);
        assert.equal(lower.applied, false);
        assert.equal(lower.change.kind, 'loosen');
        assert.equal(a.state.landmarks[0].clearanceZ, 150, 'still enforced at the old top');
        a.operator(lower);
        assert.equal(a.state.landmarks[0].clearanceZ, 120);

        const smaller = a.flow.setLandmark({ name: 'rotary', box: { x0: 150, y0: 0, x1: 200, y1: 300 } }, A350);
        assert.equal(smaller.applied, false);
        assert.match(smaller.change.reasons[0], /no longer covers/);
        const unmark = a.flow.setLandmark({ name: 'rotary', clearance: { z: null, basis: 'physical' } }, A350);
        assert.equal(unmark.applied, false);
        assert.match(unmark.change.reasons.join(' '), /no longer be an obstacle/);
        assert.equal(a.state.landmarks[0].machine.x0, 140);
    }],
    ['A350 restatement: a physical top that could demand less than the legacy 280 is staged; the legacy height applies until approved', () => {
        const a = harness(a350Landmarks());
        const r = a.flow.setLandmark({ name: 'tool-setter', clearance: { z: 205, basis: 'physical' }, source: 'measured', measuredBy: 'job-abc' }, A350);
        assert.equal(r.applied, false);
        assert.match(r.change.reasons[0], /as little as toolhead Z 210/);
        const ts = a.state.landmarks.find((l) => l.name === 'tool-setter') as FlowLandmark;
        assert.equal(ts.clearanceBasis, 'toolhead');
        assert.equal(ts.clearanceZ, 280);
        a.operator(r);
        const after = a.state.landmarks.find((l) => l.name === 'tool-setter') as FlowLandmark;
        assert.equal(after.clearanceBasis, 'physical');
        assert.equal(after.clearanceZ, 205);
        assert.deepEqual(after.legacy, { clearanceZ: 280, basis: 'toolhead', retiredAt: a.state.now });
        assert.equal(after.source, 'measured');
        assert.equal(after.measuredBy, 'job-abc');
        assert.deepEqual(after.machine, { x0: 300, y0: 280, x1: 340, y1: 320 }, 'box kept');
    }],
    ['tightening and adding apply at once; a restatement whose top + margin still clears the legacy height applies at once', () => {
        const a = harness(a350Landmarks());
        const grow = a.flow.setLandmark({ name: 'rotary', box: { x0: 130, y0: 0, x1: 210, y1: 300 } }, A350);
        assert.equal(grow.applied, true);
        assert.equal(grow.change.kind, 'tighten');
        const high = a.flow.setLandmark({ name: 'tool-setter', clearance: { z: 280 - CLEARANCE_MARGIN_MM, basis: 'physical' } }, A350);
        assert.equal(high.applied, true);
        assert.equal(high.landmark.legacy && high.landmark.legacy.clearanceZ, 280);
        const added = a.flow.setLandmark({ name: 'vise', description: 'vise', box: { x0: 0, y0: 0, x1: 40, y1: 40 }, clearance: { z: 90, basis: 'physical' } }, A350);
        assert.equal(added.applied, true);
        assert.equal(added.change.kind, 'add');
        assert.equal(added.landmark.source, 'operator');
        assert.throws(() => a.flow.setLandmark({ name: 'clamp', clearance: { z: 30, basis: 'physical' } }, A350), /needs description and x0, y0, x1, y1/);
        assert.throws(() => a.flow.setLandmark({ name: 'vise', source: 'measured' }, A350), /measured_by/);
    }],
    ['update keeps the box and every field not given; description-only edits do not reset the review', () => {
        const a = harness([landmark({ clearanceBasis: 'physical', clearanceZ: 150 })]);
        a.confirm();
        const r = a.flow.setLandmark({ name: 'rotary', description: 'rotary, chuck at Y0' }, A350);
        assert.equal(r.applied, true);
        assert.equal(r.change.kind, 'unchanged');
        assert.deepEqual(a.state.landmarks[0].machine, { x0: 140, y0: 0, x1: 200, y1: 300 });
        assert.equal(a.state.landmarks[0].clearanceZ, 150);
        assert.equal(a.state.landmarks[0].description, 'rotary, chuck at Y0');
        assert.equal(a.flow.review().status, 'confirmed');
    }],
    ['classification judges every tool: physical -> toolhead always loosens; equal heights are unchanged', () => {
        const phys = landmark({ clearanceBasis: 'physical', clearanceZ: 150 });
        assert.equal(classifyLandmarkChange(phys, { ...phys, clearanceBasis: 'toolhead', clearanceZ: 320 }).kind, 'loosen');
        assert.equal(classifyLandmarkChange(phys, { ...phys, clearanceZ: 150.01 }).kind, 'unchanged', 'within the 0.05 mm epsilon');
        assert.equal(classifyLandmarkChange(phys, null).kind, 'delete');
        const merged = mergeLandmarkUpdate(phys, { clearance: { z: 170, basis: 'physical' } }, 5);
        assert.equal(merged.legacy, undefined, 'physical -> physical keeps no legacy block');
        assert.equal(merged.updatedAt, 5);
    }],

    // ---- arithmetic ----
    ['physical top + live protrusion + margin; unknown tool = impassable; legacy toolhead adds nothing', () => {
        const base = { now: 0, confirmation: null };
        const top = landmark({ clearanceBasis: 'physical', clearanceZ: 100 });
        assert.equal(describeReviewedLandmark(top, { ...base, toolProtrusionMm: 40 }).requiredToolheadZ, 100 + 40 + CLEARANCE_MARGIN_MM);
        assert.equal(describeReviewedLandmark(top, { ...base, toolProtrusionMm: null }).requiredToolheadZ, null);
        assert.match(describeReviewedLandmark(top, { ...base, toolProtrusionMm: null }).requirementNote, /IMPASSABLE/);
        assert.equal(describeReviewedLandmark(landmark(), { ...base, toolProtrusionMm: 40 }).requiredToolheadZ, 280);
        const shown = describeReviewedLandmark(top, { ...base, toolProtrusionMm: 40 });
        assert.equal(shown.obstacle_top_z, 100);
        assert.equal(shown.clearance_z, null);
        const review = reviewLandmarks({
            landmarks: [top],
            confirmation: null,
            now: 0,
            ttlHours: 24,
            session: 's',
            deviceConflict: null,
            machine: { identifier: A350, machineKey: A350 },
            toolProtrusionMm: 40,
        });
        assert.match(review.question as string, /physical top Z 100 -> needs toolhead Z 145/);
    }],
];
