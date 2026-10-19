import crypto from 'crypto';
import * as fs from 'fs-extra';
import path from 'path';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import { connectedMachineIdentifier } from './connectedMachine';
import { ObstacleBox, POSITION_EPSILON_MM, segmentHitsBox2D } from './envelopeChecks';
import { ClearanceBasis, normaliseClearanceBasis, requiredToolheadZ } from './landmarkClearance';
import { LandmarkSource, LegacyClearance } from './landmarkReview';
import { appliesToMachine, isLegacyScope, recordMachineScope } from './machineCapability';
import { applyCallObstacleTransform } from './rotaryCallContext';

const log = logger('service:mcp:landmarks');

// Named scene landmarks (#50): expectedToolRegion solved "what is that blurry
// thing" for the endmill; this does the same for fixed scene features (tool
// height checker, rotary span, tool post). Set once from operator knowledge,
// persisted, and surfaced on every capture taken near their machine
// coordinates - so no agent re-derives an identity the operator already gave.

export interface Landmark {
    id: string;
    name: string;
    description: string;
    // Machine-coordinate XY extent of the feature on/over the bed.
    machine: { x0: number; y0: number; x1: number; y1: number };
    // Obstacle clearance: minimum safe TOOLHEAD machine Z when the XY path
    // crosses this landmark's box (operator accounts for tool length when
    // setting it). null = not an obstacle. Enforced by the direct XY move
    // guard - added after the 2026-09-01 probe crash, where a traverse at a
    // fabricated "clearance" height crossed the rotary and destroyed the
    // fitted touch probe.
    clearanceZ: number | null;
    /**
     * What clearanceZ is measured to. 'toolhead' (the legacy meaning, and the
     * default for every record written before this existed) is a minimum safe
     * toolhead Z with tool length already baked in; 'physical' is the top of
     * the obstacle itself, and the live tool is added at check time.
     */
    clearanceBasis: ClearanceBasis;
    notes: string | null;
    createdAt: number;
    /**
     * The machine this landmark's coordinates belong to (the connection's
     * machineIdentifier when it was set). A landmark is machine coordinates
     * on ONE bed: the A350's rotary keep-out at X140-200 means nothing on a
     * Ray. Records written before this existed (2026-10-18) carry no tag and
     * are the A350's - machineCapability.LEGACY_MACHINE_IDENTIFIER - because
     * that is the only machine they were ever set on. Checks apply only the
     * landmarks whose machine is the connected one; list() still shows all.
     */
    machineIdentifier: string;
    /** True when machineIdentifier was attributed by the legacy rule rather than recorded. */
    legacyScope?: boolean;
    /** Who stated the height (WP5): the operator, or a measurement named by measuredBy (a job id). Absent = operator. */
    source?: LandmarkSource;
    measuredBy?: string | null;
    /** The legacy toolhead clearance a physical restatement retired - audit only, never enforced. */
    legacy?: LegacyClearance | null;
    /** Last edit (set_landmark update / an approved loosening); createdAt until then. */
    updatedAt?: number;
}

interface LandmarkFile {
    landmarks: Landmark[];
}

export class LandmarkStore {
    private filePath: string | null = null;

    private cache: LandmarkFile | null = null;

    private file(): string {
        if (!this.filePath) {
            this.filePath = path.join(DataStorage.userDataDir, 'mcp-landmarks.json');
        }
        return this.filePath;
    }

    private load(): LandmarkFile {
        if (this.cache) {
            return this.cache;
        }
        try {
            const raw = fs.readJsonSync(this.file());
            const landmarks = (Array.isArray(raw?.landmarks) ? raw.landmarks : [])
                .map((l: Landmark) => ({
                    ...l,
                    clearanceZ: Number.isFinite(Number(l.clearanceZ)) ? Number(l.clearanceZ) : null,
                    clearanceBasis: normaliseClearanceBasis(l.clearanceBasis),
                    machineIdentifier: recordMachineScope(l.machineIdentifier),
                    legacyScope: isLegacyScope(l.machineIdentifier),
                }));
            this.cache = { landmarks };
        } catch (err) {
            this.cache = { landmarks: [] };
        }
        return this.cache;
    }

    private save(): void {
        try {
            fs.writeJsonSync(this.file(), this.cache, { spaces: 2 });
        } catch (err) {
            log.error(`Failed to persist landmarks: ${(err as Error).message}`);
        }
    }

    /**
     * Store a landmark for `machineIdentifier` - the connected machine when
     * omitted. Refused when no machine can be named: a landmark is machine
     * coordinates, and coordinates without a machine are not a landmark.
     */
    public add(landmark: Omit<Landmark, 'id' | 'createdAt' | 'machineIdentifier' | 'legacyScope'> & { machineIdentifier?: string | null }): Landmark {
        const machineIdentifier = landmark.machineIdentifier || connectedMachineIdentifier();
        if (!machineIdentifier) {
            throw new Error('A landmark is machine coordinates on ONE machine, and no machine is connected to tag it with. '
                + 'Connect the machine first.');
        }
        const data = this.load();
        // Same name replaces, within the same machine: landmarks are
        // identities, not history - and "tool-setter" on the A350 is not
        // "tool-setter" on the Ray.
        data.landmarks = data.landmarks.filter((l) => !(l.name === landmark.name && l.machineIdentifier === machineIdentifier));
        const full: Landmark = {
            ...landmark,
            machineIdentifier,
            legacyScope: false,
            id: crypto.randomBytes(4).toString('hex'),
            createdAt: Date.now(),
        };
        data.landmarks.push(full);
        this.save();
        log.info(`Landmark stored: ${full.name} (${full.id})`);
        return full;
    }

    /** Every stored landmark, for every machine, each with its machineIdentifier. */
    public list(): Landmark[] {
        return this.load().landmarks;
    }

    /** The landmarks that apply to `machineIdentifier` (the connected machine when omitted); none when no machine is connected. */
    public listFor(machineIdentifier: string | null = connectedMachineIdentifier()): Landmark[] {
        return this.load().landmarks.filter((l) => appliesToMachine(l.machineIdentifier, machineIdentifier));
    }

    /**
     * Replace the record with the same id, in place (set_landmark UPDATE
     * semantics and approved loosenings - landmarkReviewFlow.ts). Refused
     * for an unknown id: an update never invents a record.
     */
    public put(landmark: Landmark): void {
        const data = this.load();
        const index = data.landmarks.findIndex((l) => l.id === landmark.id);
        if (index < 0) {
            throw new Error(`Unknown landmark id ${landmark.id}.`);
        }
        data.landmarks[index] = { ...landmark };
        this.save();
        log.info(`Landmark updated: ${landmark.name} (${landmark.id})`);
    }

    /** Remove exactly one record by id (the staged delete_landmark resolves its id first). */
    public removeId(id: string): boolean {
        const data = this.load();
        const before = data.landmarks.length;
        data.landmarks = data.landmarks.filter((l) => l.id !== id);
        if (data.landmarks.length !== before) {
            this.save();
            return true;
        }
        return false;
    }

    public remove(idOrName: string): boolean {
        const data = this.load();
        const before = data.landmarks.length;
        data.landmarks = data.landmarks.filter((l) => l.id !== idOrName && l.name !== idOrName);
        if (data.landmarks.length !== before) {
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Obstacle landmarks (clearanceZ set) whose box - inflated by margin -
     * the straight XY segment from (x0,y0) to (x1,y1) touches, and whose
     * clearanceZ the given toolhead machine Z is BELOW. These are collisions
     * waiting to happen; the direct XY guard refuses them.
     */
    /**
     * Obstacles a direct XY move at `toolheadZ` would cross. Same requirement
     * as the procedure planners' checkMotion: the stored height for a legacy
     * 'toolhead' clearance, obstacle top + tool + margin for a 'physical' one,
     * and an obstacle whose requirement cannot be computed (physical, no tool
     * length known) is impassable rather than passable.
     *
     * `toolProtrusionMm` is clearanceContext.currentToolProtrusion().mm.
     */
    public obstaclesOnPath(
        x0: number, y0: number, x1: number, y1: number,
        toolheadZ: number, marginMm = 5,
        toolProtrusionMm: number | null = null,
        clearanceMarginMm?: number,
        machineIdentifier: string | null = connectedMachineIdentifier()
    ): Array<Landmark & { requiredZ: number | null }> {
        return this.listFor(machineIdentifier)
            .map((l) => ({
                ...l,
                requiredZ: l.clearanceZ === null
                    ? null
                    : requiredToolheadZ(l.clearanceZ, l.clearanceBasis, toolProtrusionMm, clearanceMarginMm),
            }))
            .filter((l) => {
                if (l.clearanceZ === null) {
                    return false;
                }
                // POSITION_EPSILON_MM: home reports 327.999994 for a 328 home,
                // and an exact compare refused the move over a landmark whose
                // clearance IS the traverse height (live 2026-09-19).
                if (l.requiredZ !== null && toolheadZ >= l.requiredZ - POSITION_EPSILON_MM) {
                    return false;
                }
                return segmentHitsBox2D(x0, y0, x1, y1, l.machine, marginMm);
            });
    }

    /**
     * Obstacle landmarks (clearanceZ set) for the procedure planners
     * (envelopeChecks), in 'crossing' mode: a landmark's clearance forbids
     * TRAVERSING across its box low, not probing inside it - the rotary-axis
     * landmark covers the whole stock, and probing the stock is the job.
     */
    public obstacleBoxes(machineIdentifier: string | null = connectedMachineIdentifier()): ObstacleBox[] {
        // Inside a tool call that stated `stock`, the rotary keep-out may be
        // the computed one (rotaryCallContext.ts); elsewhere unchanged.
        return applyCallObstacleTransform(this.listFor(machineIdentifier)
            .filter((l) => l.clearanceZ !== null)
            .map((l) => ({
                name: l.name,
                machine: { ...l.machine },
                clearanceZ: l.clearanceZ as number,
                clearanceBasis: l.clearanceBasis,
                mode: 'crossing' as const,
            })));
    }

    /**
     * Landmarks whose extent lies within `radius` mm of a machine XY point -
     * what a toolhead camera at that position could plausibly see.
     */
    public near(x: number, y: number, radius: number, machineIdentifier: string | null = connectedMachineIdentifier()): Landmark[] {
        return this.listFor(machineIdentifier).filter((l) => {
            const dx = Math.max(l.machine.x0 - x, 0, x - l.machine.x1);
            const dy = Math.max(l.machine.y0 - y, 0, y - l.machine.y1);
            return Math.hypot(dx, dy) <= radius;
        });
    }
}

export const landmarkStore = new LandmarkStore();
