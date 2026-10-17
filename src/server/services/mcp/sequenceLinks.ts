/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (local_links is read verbatim).
//
// Local links for probe_sequence (issue #242, operator request 2026-10-17).
//
// Until now every probe in a sequence retreated to its own start, raised to
// the traverse height (Z328), hopped, and descended ~124 mm again - about
// 59 s of every 98 s station on the 2026-10-17 FR4 re-registration (tops:
// 405 s for 4 contacts within 0.05 mm; edges: 575 s for 6). With
// `local_links` the operator approves, on the one confirm page, a stated
// LOCAL clearance (a toolhead machine Z above the measured top, e.g. a
// program reference `tops.max_contact_z + 4`) and the runner hops between
// stations at that height instead of the top: after a march it retreats to
// the march start as before, and the NEXT hop raises to max(clearance,
// current Z) - never lower than where the head already is. The first hop
// from the staged position (normally at the top) and the final exit are
// still full law-2 moves. A low hop is bounded like the surface scans'
// links: <= max_hop_mm (cap MAX_HOP_CAP_MM, 60), one plain move expecting no
// contact (the crash guard latches on a touch), checked at staging against
// every landmark and keep-out box at ITS height (law 4).
//
// Pure: no server imports; unit-tested in tests/sequenceLinks.test.ts.
import { MAX_HOP_CAP_MM, MAX_HOP_DEFAULT_MM } from './surfaceScan';
import { MIN_HOP_MM } from './procedureLimits';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

export interface LocalLinks {
    /** Toolhead machine Z the low hops run at (or higher, if the head is already higher). */
    clearanceZ: number;
    /** Longest XY hop allowed at the local clearance. */
    maxHopMm: number;
}

export class LocalLinksError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'LocalLinksError';
    }
}

/**
 * Parse `local_links` as staged. `hopZ` is the traverse height: the
 * clearance must be a finite machine Z strictly below it (equal would be the
 * default behaviour) and above the bed.
 */
export function resolveLocalLinks(raw: unknown, hopZ: number): LocalLinks | null {
    if (raw === undefined || raw === null) {
        return null;
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new LocalLinksError('local_links must be an object {clearance_z, max_hop_mm?}.');
    }
    const args = raw as { clearance_z?: unknown; max_hop_mm?: unknown };
    const clearanceZ = Number(args.clearance_z);
    if (args.clearance_z === undefined || !Number.isFinite(clearanceZ)) {
        throw new LocalLinksError('local_links.clearance_z is required: the toolhead MACHINE Z the low hops run at - a measured '
            + 'top plus a few mm (in a probe_program, a reference such as {"from": "tops.top.z", "plus": 4, "between": [...]}).');
    }
    if (clearanceZ <= 0) {
        throw new LocalLinksError(`local_links.clearance_z ${clearanceZ} is at or below the bed (machine Z 0).`);
    }
    if (clearanceZ >= hopZ - TRAVERSE_Z_TOLERANCE_MM) {
        throw new LocalLinksError(`local_links.clearance_z ${clearanceZ} is not below the traverse height ${hopZ}; omit local_links `
            + 'to hop at the traverse height.');
    }
    const maxHopMm = args.max_hop_mm === undefined || args.max_hop_mm === null ? MAX_HOP_DEFAULT_MM : Number(args.max_hop_mm);
    if (!Number.isFinite(maxHopMm) || maxHopMm < MIN_HOP_MM) {
        throw new LocalLinksError(`local_links.max_hop_mm must be a number >= ${MIN_HOP_MM}.`);
    }
    if (maxHopMm > MAX_HOP_CAP_MM + 1e-9) {
        throw new LocalLinksError(`local_links.max_hop_mm ${maxHopMm} exceeds the operator-authorised maximum of ${MAX_HOP_CAP_MM} mm `
            + 'for a low link (the surface scans\' cap); split the link with an extra hop step.');
    }
    return { clearanceZ: Number(clearanceZ.toFixed(3)), maxHopMm };
}

/**
 * Height of the next hop: the traverse height without local links; with
 * them, the clearance or the height the head is already at, whichever is
 * higher - a hop never starts by descending.
 */
export function hopHeight(links: LocalLinks | null, currentZ: number, hopZ: number): number {
    if (!links) {
        return hopZ;
    }
    return Number(Math.min(Math.max(links.clearanceZ, currentZ), hopZ).toFixed(3));
}

/** True when a hop at `z` is below the traverse height, i.e. a bounded local link. */
export function isLocalHop(z: number, hopZ: number): boolean {
    return z < hopZ - TRAVERSE_Z_TOLERANCE_MM;
}

/**
 * Staging check for one hop: a local (low) hop must be within max_hop_mm.
 * Returns the refusal text, or null.
 */
export function localHopRefusal(
    links: LocalLinks | null,
    hop: { z: number; distanceMm: number; index: number },
    hopZ: number
): string | null {
    if (!links || !isLocalHop(hop.z, hopZ)) {
        return null;
    }
    if (hop.distanceMm > links.maxHopMm + 1e-9) {
        return `steps[${hop.index}]: a local link of ${hop.distanceMm.toFixed(1)} mm at machine Z ${hop.z.toFixed(3)} exceeds `
            + `local_links.max_hop_mm ${links.maxHopMm} (cap ${MAX_HOP_CAP_MM}); add an intermediate hop step, or omit local_links `
            + 'so this hop goes via the traverse height.';
    }
    return null;
}
