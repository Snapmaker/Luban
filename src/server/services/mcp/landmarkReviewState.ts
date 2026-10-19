/* eslint-disable camelcase */
// Review fields are MCP tool results, snake_case by convention.
// The live landmark review (tyeth/Luban#265 WP5): landmarkReviewFlow.ts wired
// to the real landmark store, the connection and the per-machine store, plus
// the provider safeZPolicy asks whether the operator has confirmed.
//
// Registered by tools/landmarks.ts (registerLandmarkTools), so the provider
// exists whenever the MCP tools do; safeZPolicy reads "not confirmed" when it
// does not.
import crypto from 'crypto';

import { connectionManager } from '../machine/ConnectionManager';
import { currentToolProtrusion } from './clearanceContext';
import { connectedMachineIdentifier } from './connectedMachine';
import { Landmark, landmarkStore } from './landmarks';
import { LandmarkReview, LandmarkConfirmation } from './landmarkReview';
import { FlowLandmark, LandmarkStoreLike, createLandmarkReviewFlow } from './landmarkReviewFlow';
import { machineStore } from './machineStore';
import { OperatorReviewStore } from './operatorReviews';
import { setLandmarkReviewProvider } from './safeZPolicy';
import { landmarkConfirmTtlHours } from './tools/machine';

const CONFIRMED_KEY = 'mcpLandmarksConfirmed';

/**
 * Minted once per process: the connection generation restarts at 0 with
 * Luban, so on its own a pre-restart confirmation could match a post-restart
 * connection. With this prefix a restart always ends the confirmation.
 */
const PROCESS_SESSION = crypto.randomBytes(6).toString('hex');

/** The live connection session, or null when no machine is connected. */
export function connectionSession(): string | null {
    if (!connectedMachineIdentifier()) {
        return null;
    }
    try {
        return `${PROCESS_SESSION}:${connectionManager.getConnectionGeneration()}`;
    } catch (err) {
        return null;
    }
}

function readConfirmation(machineKey: string | null): LandmarkConfirmation | null {
    const raw = machineKey ? machineStore.getFor(machineKey, CONFIRMED_KEY) as LandmarkConfirmation | undefined : undefined;
    return raw && typeof raw === 'object' && Number.isFinite(Number(raw.at)) && typeof raw.fingerprint === 'string' ? raw : null;
}

const storeAdapter: LandmarkStoreLike = {
    listFor: (machineIdentifier) => landmarkStore.listFor(machineIdentifier) as FlowLandmark[],
    add: (landmark) => landmarkStore.add(landmark) as FlowLandmark,
    put: (landmark) => landmarkStore.put(landmark as Landmark),
    removeId: (id) => landmarkStore.removeId(id),
};

/** Staged landmark / device pages, served at /confirm/r<id> (index.ts dispatches before jobs.ts). */
export const operatorReviews = new OperatorReviewStore();

let confirmBaseUrl: () => string = () => '';

export function setLandmarkReviewConfirmBaseUrl(base: () => string): void {
    confirmBaseUrl = base;
}

export const landmarkReviewFlow = createLandmarkReviewFlow({
    store: storeAdapter,
    reviews: operatorReviews,
    now: () => Date.now(),
    machine: () => {
        const current = machineStore.currentMachine();
        const connected = current.basis === 'connected';
        return {
            identifier: connected ? current.machineIdentifier : connectedMachineIdentifier(),
            machineKey: connected ? current.machineKey : null,
            deviceConflict: current.deviceConflict,
        };
    },
    session: connectionSession,
    ttlHours: (machineKey) => landmarkConfirmTtlHours(machineKey).hours,
    getConfirmation: readConfirmation,
    setConfirmation: (machineKey, confirmation) => {
        if (confirmation) {
            machineStore.setFor(machineKey, CONFIRMED_KEY, confirmation);
        } else {
            machineStore.unsetFor(machineKey, CONFIRMED_KEY);
        }
    },
    toolProtrusionMm: () => currentToolProtrusion().mm,
    assignMachineDevice: (sameMachine) => machineStore.assignMachineDevice(sameMachine),
    confirmBaseUrl: () => confirmBaseUrl(),
});

/**
 * The review for the connected machine - what get_stored_state carries as
 * landmark_review, and what WP8 injects into motion / staging results and
 * get_position when it is not confirmed.
 */
export function landmarkReviewForConnected(): LandmarkReview & { pending_reviews: object[] } {
    return landmarkReviewFlow.review();
}

/** The current machine key the confirm page checks an approval against. */
export function currentReviewMachineKey(): string | null {
    const current = machineStore.currentMachine();
    return current.basis === 'connected' ? current.machineKey : null;
}

let registered = false;

/** Idempotent: the safeZPolicy provider. */
export function registerLandmarkReviewProvider(): void {
    if (registered) {
        return;
    }
    registered = true;
    setLandmarkReviewProvider(() => {
        const review = landmarkReviewForConnected();
        return { confirmed: review.confirmed, status: review.status, question: review.question };
    });
}
