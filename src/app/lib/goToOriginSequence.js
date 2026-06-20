/**
 * Build a SAFE two-move sequence for "Go To Work Origin" so the toolhead never travels diagonally
 * into the bed.
 *
 * The original code packed all axes into one `G0 X0 Y0 B0 Z0` line, so every axis interpolated
 * simultaneously and the head descended diagonally toward the origin with no Z clearance — a
 * bed-crash path (audit R6 / 02-F2). The per-axis ordering attempted in the UI was dead code
 * (object-key order in a single G-code line has no effect on motion).
 *
 * Rule:
 *  - If the head is ABOVE the work origin (currentZ > 0 in work coordinates): move X/Y/B at the
 *    current (safe) height FIRST, then lower Z straight down LAST.
 *  - If the head is AT/BELOW the origin (currentZ <= 0): raise Z to the origin FIRST, then move XY.
 *
 * Plain .js so the tape harness can require it under @babel/register (no .ts resolution here).
 *
 * When `diagonal` is true (opt-in "workspace clear" mode), all axes are sent in a single G0 so the
 * head travels straight to the origin along the hypotenuse — faster, but no Z clearance, so it must
 * only be used when the user has confirmed the workspace is clear.
 *
 * @param {{ z: number }} current  current work-coordinate position (only Z matters for ordering)
 * @param {number} feed  feedrate (mm/min)
 * @param {boolean} [diagonal]  if true, move all axes simultaneously (single G0)
 * @returns {string[]} G-code line(s): one diagonal move, or two safely-ordered moves
 */
export function sequenceGoToOrigin(current, feed, diagonal = false) {
    if (diagonal) {
        return [`G0 X0 Y0 B0 Z0 F${feed}`];
    }
    const xy = `G0 X0 Y0 B0 F${feed}`;
    const z = `G0 Z0 F${feed}`;
    return current && current.z > 0 ? [xy, z] : [z, xy];
}
