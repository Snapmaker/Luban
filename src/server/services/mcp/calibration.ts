import crypto from 'crypto';
import * as fs from 'fs-extra';
import path from 'path';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import { connectedMachineIdentifier } from './connectedMachine';
import { appliesToMachine, isLegacyScope, recordMachineScope } from './machineCapability';

const log = logger('service:mcp:calibration');

// Persisted pixel-to-machine calibration (#13). On the SM2 gantry the
// platform travels in Y, so a mapping derived from a frame is only valid
// at the machine Y it was captured at - entries are keyed by that Y (and
// record Z, since camera height changes scale).
//
// The 2x2 matrix maps a pixel delta (du, dv) to the machine XY move (mm)
// that cancels it: [dx, dy] = M . [du, dv]. Deriving M (rectification,
// parallax handling) is the calibrating agent's job; the store only keeps
// and serves it.

export interface CalibrationEntry {
    id: string;
    validAtY: number; // machine Y the frame was captured at
    z: number; // machine Z the frame was captured at
    matrix: [[number, number], [number, number]];
    // Physical surface the calibration was derived on (#51): a matrix is only
    // valid for features on the same depth plane - applying a bracket-derived
    // matrix to the board surface read ~4x wrong on hardware (parallax).
    surface: string | null;
    notes: string | null;
    createdAt: number;
    /**
     * The machine the matrix was derived on. A pixel-to-machine mapping at
     * "machine Y 199" is a statement about one gantry; applied to another
     * machine's Y 199 it is noise. Untagged entries (before 2026-10-18) are
     * the A350's (machineCapability.LEGACY_MACHINE_IDENTIFIER). findNearest
     * serves only the connected machine's entries; list() shows all.
     */
    machineIdentifier: string;
    legacyScope?: boolean;
}

interface CalibrationFile {
    entries: CalibrationEntry[];
}

export class CalibrationStore {
    private filePath: string | null = null;

    private cache: CalibrationFile | null = null;

    private file(): string {
        if (!this.filePath) {
            this.filePath = path.join(DataStorage.userDataDir, 'mcp-camera-calibration.json');
        }
        return this.filePath;
    }

    private load(): CalibrationFile {
        if (this.cache) {
            return this.cache;
        }
        try {
            const raw = fs.readJsonSync(this.file());
            const entries = (Array.isArray(raw?.entries) ? raw.entries : []).map((entry: CalibrationEntry) => ({
                ...entry,
                machineIdentifier: recordMachineScope(entry.machineIdentifier),
                legacyScope: isLegacyScope(entry.machineIdentifier),
            }));
            this.cache = { entries };
        } catch (err) {
            this.cache = { entries: [] };
        }
        return this.cache;
    }

    private save(): void {
        try {
            fs.writeJsonSync(this.file(), this.cache, { spaces: 2 });
        } catch (err) {
            log.error(`Failed to persist camera calibration: ${(err as Error).message}`);
        }
    }

    /** Store an entry for `machineIdentifier` - the connected machine when omitted; refused when none can be named. */
    public add(entry: Omit<CalibrationEntry, 'id' | 'createdAt' | 'machineIdentifier' | 'legacyScope'> & { machineIdentifier?: string | null }): CalibrationEntry {
        const machineIdentifier = entry.machineIdentifier || connectedMachineIdentifier();
        if (!machineIdentifier) {
            throw new Error('A camera calibration maps pixels to ONE machine\'s coordinates, and no machine is connected to tag it with.');
        }
        const data = this.load();
        const full: CalibrationEntry = {
            ...entry,
            machineIdentifier,
            legacyScope: false,
            id: crypto.randomBytes(4).toString('hex'),
            createdAt: Date.now(),
        };
        data.entries.push(full);
        this.save();
        log.info(`Camera calibration ${full.id} stored (valid at Y ${full.validAtY}, Z ${full.z})`);
        return full;
    }

    /** Every stored entry, for every machine, each with its machineIdentifier. */
    public list(): CalibrationEntry[] {
        return this.load().entries;
    }

    /** The entries that apply to `machineIdentifier` (the connected machine when omitted). */
    public listFor(machineIdentifier: string | null = connectedMachineIdentifier()): CalibrationEntry[] {
        return this.load().entries.filter((entry) => appliesToMachine(entry.machineIdentifier, machineIdentifier));
    }

    public get(id: string): CalibrationEntry | null {
        return this.load().entries.find((entry) => entry.id === id) || null;
    }

    public remove(id: string): boolean {
        const data = this.load();
        const before = data.entries.length;
        data.entries = data.entries.filter((entry) => entry.id !== id);
        if (data.entries.length !== before) {
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Nearest entry by |validAtY - y|, or null when none is within tolerance.
     */
    public findNearest(
        y: number,
        toleranceMm: number,
        machineIdentifier: string | null = connectedMachineIdentifier()
    ): { entry: CalibrationEntry; distance: number } | null {
        let best: { entry: CalibrationEntry; distance: number } | null = null;
        for (const entry of this.listFor(machineIdentifier)) {
            const distance = Math.abs(entry.validAtY - y);
            if (!best || distance < best.distance) {
                best = { entry, distance };
            }
        }
        return best && best.distance <= toleranceMm ? best : null;
    }
}

export const calibrationStore = new CalibrationStore();
