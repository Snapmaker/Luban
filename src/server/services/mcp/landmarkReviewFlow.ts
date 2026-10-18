/* eslint-disable camelcase */
// Review fields are MCP tool results, snake_case by convention.
// The landmark review flow (tyeth/Luban#265 WP5): what set_landmark,
// delete_landmark, confirm_landmarks and assign_machine_device do, with every
// live input handed in (landmarkReviewState.ts wires the real store, the
// connection and the machine store), so the whole flow - stage, approve,
// apply, invalidate - runs in tests/landmarkReview.test.ts without a server.
//
// The rules it enforces (operator, 2026-10-19):
//  - adding or tightening a landmark applies at once (and the set reads
//    unconfirmed until the operator reviews it again);
//  - deleting or loosening one STAGES an operator page; the old record keeps
//    applying until the operator approves, and the approval applies it;
//  - confirming the set is ONLY the operator's approval of a staged review
//    page - confirm_landmarks stages, it never confirms;
//  - a device conflict is answered the same way (assign_machine_device).
import { ClearanceBasis } from './landmarkClearance';
import {
    LandmarkBox,
    LandmarkChange,
    LandmarkConfirmation,
    LandmarkReview,
    LandmarkSource,
    ReviewDeviceConflict,
    ReviewLandmark,
    boxText,
    classifyLandmarkChange,
    describeReviewedLandmark,
    landmarkFingerprint,
    landmarkItemFingerprints,
    landmarkSetFingerprint,
    mergeLandmarkUpdate,
    reviewLandmarks,
} from './landmarkReview';
import { OperatorReviewItem, OperatorReviewStore, escapeHtml } from './operatorReviews';

export interface FlowLandmark extends ReviewLandmark {
    description: string;
    notes: string | null;
    machineIdentifier: string;
}

export interface NewFlowLandmark {
    name: string;
    description: string;
    machine: LandmarkBox;
    clearanceZ: number | null;
    clearanceBasis: ClearanceBasis;
    notes: string | null;
    machineIdentifier: string;
    source: LandmarkSource;
    measuredBy: string | null;
}

export interface LandmarkStoreLike {
    listFor(machineIdentifier: string | null): FlowLandmark[];
    add(landmark: NewFlowLandmark): FlowLandmark;
    /** Replace the record with the same id. */
    put(landmark: FlowLandmark): void;
    removeId(id: string): boolean;
}

export interface FlowMachine {
    identifier: string | null;
    machineKey: string | null;
    deviceConflict: ReviewDeviceConflict | null;
}

export interface LandmarkReviewDeps {
    store: LandmarkStoreLike;
    reviews: OperatorReviewStore;
    now: () => number;
    machine: () => FlowMachine;
    /** The live connection session (null when not connected): a confirmation lasts for one session. */
    session: () => string | null;
    ttlHours: (machineKey: string | null) => number;
    getConfirmation: (machineKey: string | null) => LandmarkConfirmation | null;
    setConfirmation: (machineKey: string, confirmation: LandmarkConfirmation | null) => void;
    toolProtrusionMm: () => number | null;
    assignMachineDevice: (sameMachine: boolean) => { machineKey: string; deviceId: string; created: boolean };
    confirmBaseUrl: () => string;
}

export interface SetLandmarkRequest {
    name: string;
    description?: string;
    box?: LandmarkBox;
    /** undefined = keep (update) / not an obstacle (new); z null = no longer an obstacle. */
    clearance?: { z: number | null; basis: ClearanceBasis };
    notes?: string | null;
    source?: LandmarkSource;
    measuredBy?: string | null;
}

export interface SetLandmarkResult {
    applied: boolean;
    change: LandmarkChange;
    landmark: FlowLandmark;
    /** The staged page when the change waits for the operator. */
    staged: object | null;
    /** What stays enforced until then. */
    still_enforced: object | null;
}

function landmarkTable(landmarks: ReviewLandmark[], deps: LandmarkReviewDeps, confirmation: LandmarkConfirmation | null): string {
    if (!landmarks.length) {
        return '<p><strong>No landmarks are recorded for this machine.</strong> Approving says the bed is clear: nothing on it that '
            + 'a traverse could hit.</p>';
    }
    const now = deps.now();
    const protrusion = deps.toolProtrusionMm();
    const rows = landmarks.map((l) => {
        const d = describeReviewedLandmark(l, { now, toolProtrusionMm: protrusion, confirmation });
        let top = '-';
        if (d.obstacle_top_z !== null) {
            top = String(d.obstacle_top_z);
        } else if (d.clearance_z !== null) {
            top = `legacy toolhead Z ${d.clearance_z}`;
        }
        let required = d.basis ? 'IMPASSABLE (no tool length)' : '-';
        if (d.requiredToolheadZ !== null) {
            required = String(d.requiredToolheadZ);
        }
        return `<tr><td><strong>${escapeHtml(d.name)}</strong></td><td>${escapeHtml(boxText(d.box))}</td>
            <td>${escapeHtml(top)}</td>
            <td>${escapeHtml(d.basis || 'not an obstacle')}</td>
            <td>${required}</td>
            <td>${escapeHtml(d.source)}${d.measured_by ? ` (${escapeHtml(d.measured_by)})` : ''}</td>
            <td>${d.ageHours} h</td></tr>`;
    }).join('');
    return `<table border="1" cellpadding="6" style="border-collapse:collapse">
        <tr><th>Landmark</th><th>Box (machine)</th><th>Physical top Z</th><th>Basis</th><th>Required toolhead Z now</th><th>Source</th><th>Age</th></tr>
        ${rows}</table>
        <p>Required toolhead Z uses the tool protrusion known now (${protrusion === null ? 'none known' : `${protrusion} mm`}) plus the margin; a
        legacy toolhead height already includes a tool and is enforced as stated.</p>`;
}

export function createLandmarkReviewFlow(deps: LandmarkReviewDeps) {
    function review(): LandmarkReview & { pending_reviews: object[] } {
        const machine = deps.machine();
        const result = reviewLandmarks({
            landmarks: deps.store.listFor(machine.identifier),
            confirmation: deps.getConfirmation(machine.machineKey),
            now: deps.now(),
            ttlHours: deps.ttlHours(machine.machineKey),
            session: deps.session(),
            deviceConflict: machine.deviceConflict,
            machine: { identifier: machine.identifier, machineKey: machine.machineKey },
            toolProtrusionMm: deps.toolProtrusionMm(),
        });
        return {
            ...result,
            pending_reviews: deps.reviews.pending(machine.machineKey).map((item) => deps.reviews.describe(item, deps.confirmBaseUrl())),
        };
    }

    function describeStaged(item: OperatorReviewItem): object {
        return {
            ...deps.reviews.describe(item, deps.confirmBaseUrl()),
            next_step: 'Ask the operator to open confirm_url, check every row against the bed, and approve or reject. The click applies '
                + 'it - there is no code to hand back; get_stored_state.landmark_review shows the outcome.',
        };
    }

    function resolveOne(idOrName: string, machineIdentifier: string | null): FlowLandmark {
        const matches = deps.store.listFor(machineIdentifier).filter((l) => l.id === idOrName || l.name === idOrName);
        if (!matches.length) {
            throw new Error(`No landmark "${idOrName}" applies to ${machineIdentifier || 'this machine'}.`);
        }
        if (matches.length > 1) {
            throw new Error(`"${idOrName}" names ${matches.length} landmarks on ${machineIdentifier}: give the id (${matches.map((l) => l.id).join(', ')}).`);
        }
        return matches[0];
    }

    /** Refuses a page whose record changed after staging. */
    function unchangedSince(machineIdentifier: string, before: FlowLandmark): () => string | null {
        const fingerprint = landmarkFingerprint(before);
        return () => {
            const now = deps.store.listFor(machineIdentifier).find((l) => l.id === before.id);
            if (!now) {
                return `landmark '${before.name}' no longer exists`;
            }
            return landmarkFingerprint(now) === fingerprint ? null : `landmark '${before.name}' changed after this page was staged`;
        };
    }

    function changePage(before: FlowLandmark, after: FlowLandmark | null, change: LandmarkChange): string {
        return `<p style="background:#fff3cd;border:1px solid #b8860b;padding:10px"><strong>This makes a keep-out LESS strict.</strong>
            Until you approve, the current record stays enforced exactly as it is.</p>
            <ul>${change.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
            <h3>Now (enforced)</h3>${landmarkTable([before], deps, null)}
            <h3>${after ? 'After approval' : 'After approval: removed - no longer enforced'}</h3>${after ? landmarkTable([after], deps, null) : ''}`;
    }

    function setLandmark(request: SetLandmarkRequest, machineIdentifier: string): SetLandmarkResult {
        if (request.source === 'measured' && !request.measuredBy) {
            throw new Error('source "measured" needs measured_by: the job id (tool setter / probe run) the height came from.');
        }
        const existing = deps.store.listFor(machineIdentifier).filter((l) => l.name === request.name);
        if (existing.length > 1) {
            throw new Error(`"${request.name}" names ${existing.length} landmarks on ${machineIdentifier}; delete the duplicates first.`);
        }
        const source: LandmarkSource | undefined = request.source || (request.measuredBy ? 'measured' : undefined);
        if (!existing.length) {
            if (!request.description || !request.box) {
                throw new Error(`No landmark "${request.name}" exists on ${machineIdentifier}: a new one needs description and x0, y0, x1, y1.`);
            }
            const landmark = deps.store.add({
                name: request.name,
                description: request.description,
                machine: { ...request.box },
                clearanceZ: request.clearance ? request.clearance.z : null,
                clearanceBasis: request.clearance ? request.clearance.basis : 'physical',
                notes: request.notes ?? null,
                machineIdentifier,
                source: source || 'operator',
                measuredBy: source === 'measured' ? (request.measuredBy || null) : null,
            });
            return { applied: true, change: classifyLandmarkChange(null, landmark), landmark, staged: null, still_enforced: null };
        }
        const before = existing[0];
        const after = mergeLandmarkUpdate(before, {
            description: request.description,
            box: request.box,
            clearance: request.clearance,
            notes: request.notes,
            source,
            measuredBy: request.measuredBy,
        }, deps.now());
        after.legacyScope = false;
        const change = classifyLandmarkChange(before, after);
        if (!change.needsApproval) {
            deps.store.put(after);
            return { applied: true, change, landmark: after, staged: null, still_enforced: null };
        }
        const machineKey = deps.machine().machineKey;
        const item = deps.reviews.stage({
            kind: 'landmark-change',
            title: `loosen '${before.name}'`,
            machineKey,
            subject: before.id,
            bodyHtml: changePage(before, after, change),
            summary: { landmark: before.name, reasons: change.reasons },
            precondition: unchangedSince(machineIdentifier, before),
            apply: () => {
                deps.store.put({ ...after, updatedAt: deps.now() });
                return { applied: before.name };
            },
        });
        return {
            applied: false,
            change,
            landmark: before,
            staged: describeStaged(item),
            still_enforced: { name: before.name, box: before.machine, clearanceZ: before.clearanceZ, basis: before.clearanceBasis },
        };
    }

    function deleteLandmark(idOrName: string, machineIdentifier: string | null): object {
        const before = resolveOne(idOrName, machineIdentifier);
        const change = classifyLandmarkChange(before, null);
        const item = deps.reviews.stage({
            kind: 'landmark-delete',
            title: `delete '${before.name}'`,
            machineKey: deps.machine().machineKey,
            subject: before.id,
            bodyHtml: changePage(before, null, change),
            summary: { landmark: before.name, id: before.id },
            precondition: unchangedSince(before.machineIdentifier, before),
            apply: () => {
                if (!deps.store.removeId(before.id)) {
                    throw new Error(`landmark '${before.name}' no longer exists`);
                }
                return { removed: before.name };
            },
        });
        return { removed: false, staged: describeStaged(item), still_enforced: before.name };
    }

    function stageConfirmation(note: string | null): object {
        const machine = deps.machine();
        const session = deps.session();
        if (!machine.identifier || !machine.machineKey || session === null) {
            throw new Error('No machine is connected: a landmark review is confirmed for one connection, so connect the machine first.');
        }
        if (machine.deviceConflict) {
            throw new Error(`${machine.deviceConflict.note} Answer that first with assign_machine_device - the landmarks may not be this machine's.`);
        }
        const identifier = machine.identifier;
        const machineKey = machine.machineKey;
        const landmarks = deps.store.listFor(identifier);
        const fingerprint = landmarkSetFingerprint(landmarks);
        const current = review();
        const item = deps.reviews.stage({
            kind: 'landmark-review',
            title: `${landmarks.length} landmark(s) on ${identifier}`,
            machineKey,
            subject: 'review',
            bodyHtml: `<p><strong>Is this what is on the bed right now?</strong> Check every keep-out box and height against the bed. Approving
                confirms this set for this connection, for up to ${deps.ttlHours(machineKey)} h; any edit, a disconnect or a device conflict
                asks again. Rejecting changes nothing - every landmark stays enforced either way.</p>
                ${current.question ? `<p>${escapeHtml(current.question)}</p>` : ''}
                ${note ? `<p>Agent's note: ${escapeHtml(note)}</p>` : ''}
                ${landmarkTable(landmarks, deps, deps.getConfirmation(machineKey))}`,
            summary: { landmarks: landmarks.map((l) => l.name), status_before: current.status, note },
            precondition: () => {
                const live = deps.machine();
                if (live.deviceConflict) {
                    return 'a device conflict opened since this page was staged';
                }
                if (deps.session() !== session) {
                    return 'the machine reconnected since this page was staged';
                }
                return landmarkSetFingerprint(deps.store.listFor(identifier)) === fingerprint
                    ? null
                    : 'the landmarks changed after this page was staged';
            },
            apply: () => {
                const confirmation: LandmarkConfirmation = {
                    at: deps.now(),
                    session,
                    fingerprint,
                    items: landmarkItemFingerprints(landmarks),
                    reviewId: item.id,
                    note,
                };
                deps.setConfirmation(machineKey, confirmation);
                return { confirmed: landmarks.map((l) => l.name), at: confirmation.at };
            },
        });
        return { confirmed: false, staged: describeStaged(item), landmark_review: current };
    }

    function stageDeviceAssignment(sameMachine: boolean): object {
        const machine = deps.machine();
        const conflict = machine.deviceConflict;
        if (!conflict) {
            throw new Error('No device conflict is open for the connected machine: nothing to assign.');
        }
        const item = deps.reviews.stage({
            kind: 'device-assign',
            title: sameMachine ? `${conflict.deviceId} is the same machine` : `${conflict.deviceId} is a different machine`,
            machineKey: machine.machineKey,
            subject: conflict.deviceId,
            bodyHtml: `<p>${escapeHtml(conflict.note)}</p>
                <p>The agent proposes: <strong>${sameMachine
        ? `${escapeHtml(conflict.deviceId)} IS the same machine as ${escapeHtml(conflict.recorded.join(', '))} - it becomes an alias and uses the stored travel, landmarks, tool setter and geometry`
        : `${escapeHtml(conflict.deviceId)} is a DIFFERENT machine - it gets its own empty record set; nothing stored so far applies to it`}</strong>.</p>
                <p>Either way the landmark review is asked again afterwards.</p>
                ${landmarkTable(deps.store.listFor(machine.identifier), deps, null)}`,
            summary: { device_id: conflict.deviceId, recorded: conflict.recorded, same_machine: sameMachine },
            precondition: () => {
                const live = deps.machine().deviceConflict;
                return live && live.deviceId === conflict.deviceId ? null : 'the device conflict is no longer open';
            },
            apply: () => {
                const assigned = deps.assignMachineDevice(sameMachine);
                deps.setConfirmation(assigned.machineKey, null);
                return assigned;
            },
        });
        return { assigned: false, staged: describeStaged(item) };
    }

    return { review, setLandmark, deleteLandmark, stageConfirmation, stageDeviceAssignment };
}

export type LandmarkReviewFlow = ReturnType<typeof createLandmarkReviewFlow>;
