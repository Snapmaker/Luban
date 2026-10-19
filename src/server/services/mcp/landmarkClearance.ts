// What a stored clearance MEANS, and what toolhead Z it therefore demands.
//
// The original `clearance_z` was "minimum safe toolhead machine Z over this
// box, operator accounts for tool length". Conflating the obstacle's height
// with the fitted tool's length has two costs:
//
//   - the number has to be re-stated every time the tool changes, and nobody
//     does that, so it ends up set for the longest thing ever fitted;
//   - it therefore sits at the machine ceiling. The `rotary-axis` landmark
//     declares 328 - the homing height - because it had to cover a ~73 mm
//     touch probe on top of the hardware. README: job 34d787bdb2d7 lost its
//     last op because a hop at 320 OUTSIDE the rotary footprint was refused
//     against that 328, and the fix at the time exempted high segments from
//     crossing checks, which let a traverse cross the unmeasured tailstock
//     with 8 mm of headroom instead.
//
// Stated as a PHYSICAL height, the same obstacle is judged from measured
// quantities: required toolhead Z = obstacle top + the live tool's protrusion
// + a margin. With the probe fitted that still comes out at the ceiling; with
// a 2 mm engraving bit it does not, and the machine gets its working room
// back without anybody guessing.
//
// Legacy records keep the old meaning until the operator re-states them: a
// silent re-interpretation would turn a conservative number into a dangerous
// one (328 read as a physical top would demand a toolhead Z of 400).
//
// Pure: no server imports, unit-tested in tests/landmarkClearance.test.ts.

/**
 * What a clearance number is measured to:
 *  - 'toolhead': the minimum safe TOOLHEAD Z, tool length already included by
 *    whoever set it (the original meaning, and what every stored record means
 *    until it is re-stated);
 *  - 'physical': the top of the obstacle itself. The tool is added at check
 *    time, so the number stays true across tool changes.
 */
export type ClearanceBasis = 'toolhead' | 'physical';

export const CLEARANCE_BASES: ClearanceBasis[] = ['toolhead', 'physical'];

/** Records written before the basis existed mean what they meant then. */
export const LEGACY_CLEARANCE_BASIS: ClearanceBasis = 'toolhead';

export function normaliseClearanceBasis(raw: unknown): ClearanceBasis {
    return raw === 'physical' ? 'physical' : LEGACY_CLEARANCE_BASIS;
}

/** True when this record still needs re-stating as a physical height. */
export function needsRestatement(clearanceZ: number | null, basis: ClearanceBasis): boolean {
    return clearanceZ !== null && basis === 'toolhead';
}

export function restatementAdvice(name: string, clearanceZ: number): string {
    return `"${name}" declares clearance_z ${clearanceZ} on the legacy basis - a toolhead height with some tool length `
        + 'already baked in. Re-state it with set_landmark obstacle_top_z = the height of the OBSTACLE ITSELF, and the '
        + 'live tool protrusion is added at check time instead. Until then it is still enforced exactly as before.';
}

/**
 * Head-room added above the obstacle on top of the tool, for a physically
 * stated clearance. The obstacle's top is measured, the tool's protrusion is
 * the longest candidate known (toolProtrusion.ts), and this is the slack for
 * everything neither of them covers: an unmeasured collet nut, a workpiece
 * standing proud of what was measured, a fixture that moved.
 */
export const CLEARANCE_MARGIN_MM = 5;

/**
 * The minimum toolhead machine Z a path may reach over this obstacle.
 *
 *  - 'toolhead': the stored number already IS that height - the tool was
 *    accounted for when it was set, so nothing is added (adding to it would
 *    double-count and refuse every traverse on the machine).
 *  - 'physical': obstacle top + how far the tool hangs below the toolhead +
 *    the margin.
 *
 * null when a physical clearance cannot be judged because nothing is known
 * about the tool. A null is a REFUSAL, never a pass: the caller treats the
 * obstacle as impassable until someone states a tool length.
 */
export function requiredToolheadZ(
    clearanceZ: number,
    basis: ClearanceBasis,
    toolProtrusionMm: number | null,
    marginMm: number = CLEARANCE_MARGIN_MM
): number | null {
    if (basis === 'toolhead') {
        return clearanceZ;
    }
    if (toolProtrusionMm === null || !Number.isFinite(toolProtrusionMm)) {
        return null;
    }
    return Number((clearanceZ + toolProtrusionMm + marginMm).toFixed(3));
}
