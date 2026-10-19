import crypto from 'crypto';
import * as fs from 'fs-extra';
import path from 'path';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import { CameraModel } from './cameraModel';
import { LEGACY_MACHINE_IDENTIFIER, isLegacyScope, recordMachineScope } from './machineCapability';
import { machineStore } from './machineStore';

const log = logger('service:mcp:cameraModel');

// Persisted camera models. A new solve NEVER overwrites the previous one in
// place: the old model is kept `superseded` with its residuals, so "was the
// camera moved between these two jobs?" is answerable after the fact. Keeping
// them is cheap and the question is not.
//
// Per machine (tyeth/Luban#265 follow-up): a model is intrinsics (the camera)
// plus extrinsics (how that camera is mounted on ONE machine's toolhead), so
// it applies to the machine it was solved on and nowhere else - a Ray must
// never convert pixels through the A350 rig's model. Every model carries the
// machineIdentifier it was stored for; current() serves only the current
// machine's (the connected one, else the machine selected in Luban Machine
// Settings, as the per-machine store resolves it), and a new solve supersedes
// only that machine's models. The camera device the model was solved for is
// fingerprint.deviceId - the same name select_camera stores per machine in
// mcpCameraDevice - and a device mismatch stays the judge's call
// (cameraModel.ts fingerprintMatches), not a lookup key.
//
// Migration (idempotent, on first read): a file written before scoping holds
// untagged models. They were all solved on the A350 (the legacy rule,
// LEGACY_MACHINE_IDENTIFIER), so they are tagged as its with legacyScope:
// true - persisted, so the flag survives the next save - and the original file
// is copied once to BACKUP_FILE first. Rolling back means restoring that copy:
// the pre-scoping build serves the newest live model to every machine, and
// after scoping there is one live model per machine.

export const MODEL_FILE = 'mcp-camera-model.json';
export const BACKUP_FILE = 'mcp-camera-model.pre-machine-scope.json';
export const MODEL_FILE_VERSION = 2;

interface ModelMigration {
    at: number;
    /** Ids of the untagged models attributed to the legacy machine. */
    models: string[];
    machineIdentifier: string;
    /** The untouched pre-scoping file, kept for a rollback. */
    backup: string | null;
    note: string;
}

interface ModelFile {
    version: number;
    models: CameraModel[];
    migratedFrom: ModelMigration | null;
}

/** Which machine's model applies now, and why. */
export interface CameraModelScope {
    machineIdentifier: string | null;
    /** 'connected' | 'selected' (Luban's selected machine while nothing is connected) | null. */
    basis: 'connected' | 'selected' | null;
    /** The per-machine store's open device conflict for this machine, if any (reported, not enforced here). */
    deviceConflict: string | null;
}

export interface CameraModelStoreDeps {
    file: () => string;
    scope: () => CameraModelScope;
}

const RETENTION = 20;

/** The live scope: the per-machine store's current machine (connected, else selected). */
export function currentCameraModelScope(): CameraModelScope {
    const current = machineStore.currentMachine();
    return {
        machineIdentifier: current.machineIdentifier,
        basis: current.basis,
        deviceConflict: current.deviceConflict ? current.deviceConflict.note : null,
    };
}

/** "Snapmaker 2.0 A350 (legacy)": the machine whose model applied, for results and refusals. */
export function cameraModelScopeLabel(scope: CameraModelScope, model: CameraModel | null): string {
    if (!scope.machineIdentifier) {
        return 'no machine connected or selected';
    }
    return `${scope.machineIdentifier}${model && model.legacyScope === true ? ' (legacy)' : ''}`;
}

/** The machineScope object the camera-model tools return. */
export function describeCameraModelScope(scope: CameraModelScope, model: CameraModel | null): object {
    return {
        label: cameraModelScopeLabel(scope, model),
        machineIdentifier: scope.machineIdentifier,
        /** Attributed by the legacy rule (untagged = the A350) rather than recorded when solved. */
        legacy: !!model && model.legacyScope === true,
        basis: scope.basis,
        cameraDevice: model ? model.fingerprint.deviceId : null,
        ...(scope.deviceConflict ? { deviceConflict: scope.deviceConflict } : {}),
    };
}

/** The refusal when the scope's machine has no model: names the machine. */
export function noCameraModelMessage(scope: CameraModelScope): string {
    if (!scope.machineIdentifier) {
        return 'No machine is connected or selected in Luban Machine Settings, so no machine\'s camera model applies '
            + '(camera models are per machine: the camera\'s mounting is one machine\'s rig).';
    }
    return `No camera model is stored for ${scope.machineIdentifier}; run camera_bootstrap on it. Camera models are per `
        + 'machine (the camera\'s mounting is one machine\'s rig), so another machine\'s model never applies here.';
}

export class CameraModelStore {
    private cache: ModelFile | null = null;

    private readonly deps: CameraModelStoreDeps;

    public constructor(deps: CameraModelStoreDeps) {
        this.deps = deps;
    }

    private file(): string {
        return this.deps.file();
    }

    private load(): ModelFile {
        if (this.cache) {
            return this.cache;
        }
        let raw: { version?: unknown; models?: unknown; migratedFrom?: ModelMigration | null } | null = null;
        try {
            raw = fs.readJsonSync(this.file());
        } catch (err) {
            raw = null;
        }
        const rawModels: CameraModel[] = raw && Array.isArray(raw.models) ? raw.models as CameraModel[] : [];
        const untagged = rawModels.filter((m) => isLegacyScope(m.machineIdentifier));
        const models = rawModels.map((m) => ({
            ...m,
            machineIdentifier: recordMachineScope(m.machineIdentifier),
            legacyScope: m.legacyScope === true || isLegacyScope(m.machineIdentifier),
        }));
        this.cache = { version: MODEL_FILE_VERSION, models, migratedFrom: raw && raw.migratedFrom ? raw.migratedFrom : null };
        if (untagged.length) {
            // A pre-scoping file, or models a rolled-back build appended: tag
            // them by the legacy rule and keep the first original for a rollback.
            const backup = path.join(path.dirname(this.file()), BACKUP_FILE);
            let kept: string | null = backup;
            try {
                if (!fs.existsSync(backup)) {
                    fs.copySync(this.file(), backup);
                }
            } catch (err) {
                kept = null;
                log.error(`Failed to back up the camera model file before tagging it: ${(err as Error).message}`);
            }
            this.cache.migratedFrom = {
                at: Date.now(),
                models: untagged.map((m) => m.id),
                machineIdentifier: LEGACY_MACHINE_IDENTIFIER,
                backup: kept,
                note: 'Camera models stored before machine scoping carried no machine; they were solved on the '
                    + `${LEGACY_MACHINE_IDENTIFIER} and are its by the legacy rule. Restore the backup to roll back.`,
            };
            this.save();
            log.info(`Camera models ${untagged.map((m) => m.id).join(', ')} attributed to ${LEGACY_MACHINE_IDENTIFIER} (legacy rule)`);
        }
        return this.cache;
    }

    private save(): void {
        try {
            fs.writeJsonSync(this.file(), this.cache, { spaces: 2 });
        } catch (err) {
            log.error(`Failed to persist the camera model: ${(err as Error).message}`);
        }
    }

    /** Which machine's model applies now (connected, else Luban's selected machine). */
    public scope(): CameraModelScope {
        return this.deps.scope();
    }

    /** The newest model for the scope's machine that is not superseded, or null (always null with no machine). */
    public current(scope: CameraModelScope = this.scope()): CameraModel | null {
        const live = this.list(scope).filter((m) => m.state !== 'superseded');
        return live.length ? live[0] : null;
    }

    /** The scope's machine's models, newest first. */
    public list(scope: CameraModelScope = this.scope()): CameraModel[] {
        if (!scope.machineIdentifier) {
            return [];
        }
        return this.listAll().filter((m) => m.machineIdentifier === scope.machineIdentifier);
    }

    /** Every machine's models, newest first, each with its machineIdentifier (get_stored_state). */
    public listAll(): CameraModel[] {
        return [...this.load().models].reverse();
    }

    /** get_stored_state: which machine's model applies now, every machine's models with their scope, and the migration. */
    public describe(scope: CameraModelScope = this.scope()): object {
        const current = this.current(scope);
        return {
            machine: scope.machineIdentifier,
            basis: scope.basis,
            applying: current ? { id: current.id, state: current.state, label: cameraModelScopeLabel(scope, current) } : null,
            models: this.listAll().map((m) => ({
                id: m.id,
                state: m.state,
                machineIdentifier: m.machineIdentifier,
                legacy: m.legacyScope === true,
                cameraDevice: m.fingerprint ? m.fingerprint.deviceId : null,
                appliesNow: !!scope.machineIdentifier && m.machineIdentifier === scope.machineIdentifier,
            })),
            legacyRule: `camera models stored with no machineIdentifier belong to ${LEGACY_MACHINE_IDENTIFIER}`,
            migratedFrom: this.load().migratedFrom,
        };
    }

    public get(id: string): CameraModel | null {
        return this.load().models.find((m) => m.id === id) || null;
    }

    /**
     * Store a freshly solved model for the scope's machine; that machine's
     * earlier models become superseded, every other machine's are untouched.
     */
    public add(
        model: Omit<CameraModel, 'id' | 'solvedAt' | 'state' | 'machineIdentifier' | 'legacyScope'>,
        scope: CameraModelScope = this.scope()
    ): CameraModel {
        const machineIdentifier = scope.machineIdentifier;
        if (!machineIdentifier) {
            throw new Error('A camera model describes how the camera sits on ONE machine, and no machine is connected or '
                + 'selected in Luban Machine Settings to store it for.');
        }
        const data = this.load();
        data.models = data.models.map((m) => (m.state === 'superseded' || m.machineIdentifier !== machineIdentifier
            ? m
            : { ...m, state: 'superseded' as const }));
        const full: CameraModel = {
            ...model,
            id: crypto.randomBytes(4).toString('hex'),
            solvedAt: Date.now(),
            // Unverified until it has passed a pose that was not in its own
            // fit: a model that only agrees with the data it was fitted to has
            // demonstrated nothing.
            state: 'unverified',
            machineIdentifier,
            legacyScope: false,
        };
        data.models.push(full);
        // Retention per machine: one machine's solves never evict another's history.
        const own = data.models.filter((m) => m.machineIdentifier === machineIdentifier);
        if (own.length > RETENTION) {
            const drop = new Set(own.slice(0, own.length - RETENTION));
            data.models = data.models.filter((m) => !drop.has(m));
        }
        this.save();
        log.info(`Camera model ${full.id} stored for ${machineIdentifier} (unverified, ${full.residuals.nPoses} poses, rms ${full.residuals.rmsPx} px)`);
        return full;
    }

    /** Record a verification pass (or failure) against a pose outside the fit. */
    public recordVerification(
        id: string,
        verification: CameraModel['verification'],
        passed: boolean
    ): CameraModel | null {
        const data = this.load();
        const model = data.models.find((m) => m.id === id);
        if (!model || model.state === 'superseded') {
            return null;
        }
        model.verification = verification;
        model.state = passed ? 'verified' : 'unverified';
        this.save();
        log.info(`Camera model ${id} ${passed ? 'verified' : 'FAILED verification'}`);
        return model;
    }

    /** Mark the current model unverified again - a knock, a seam mismatch, a failed check. */
    public invalidate(id: string, reason: string): CameraModel | null {
        const data = this.load();
        const model = data.models.find((m) => m.id === id);
        if (!model || model.state === 'superseded') {
            return null;
        }
        model.state = 'unverified';
        this.save();
        log.info(`Camera model ${id} marked unverified: ${reason}`);
        return model;
    }
}

export const cameraModelStore = new CameraModelStore({
    file: () => path.join(DataStorage.userDataDir, MODEL_FILE),
    scope: currentCameraModelScope,
});
