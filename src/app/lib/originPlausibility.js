/**
 * Decide whether a "Go To Work Origin" move should ask the user to confirm first.
 *
 * The saved work origin (G54 offset) survives homing and toolhead/material changes, so an origin
 * saved on thicker stock or with a longer toolhead can sit below the current physical surface;
 * descending to it then drives the head into the material/bed (audit R10 / 02-F4). We can't verify
 * the origin is still valid, so we ask for confirmation when the move would descend more than a
 * safety margin below the current Z.
 *
 * Plain .js so the tape harness can require it under @babel/register.
 *
 * @param {{ currentZ: number, targetZ: number, margin?: number }} p
 *   currentZ/targetZ in the same coordinate frame (work coordinates); margin defaults to 1 mm.
 * @returns {boolean} true if the descent exceeds the margin and confirmation is warranted
 */
export function originMoveNeedsConfirm(p) {
    if (!p || !Number.isFinite(p.currentZ) || !Number.isFinite(p.targetZ)) {
        return false;
    }
    const margin = Number.isFinite(p.margin) ? p.margin : 1;
    // Descending (targetZ below currentZ) by more than the margin.
    return p.targetZ < p.currentZ - margin;
}
