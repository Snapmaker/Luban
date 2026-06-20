/**
 * Build the `G92` set-work-origin G-code, including axes whose value is exactly 0.
 *
 * The original inline code gated each axis with truthiness (`xPosition && ...`), which silently
 * dropped an axis set to 0 (common after homing, or machine X0/Y0 from the AB-position/camera
 * flows), leaving that axis with its previous origin and producing mixed new/stale origins — a
 * bed-crash contributor (audit R13 / 02-F11). Use Number.isFinite so 0 is included.
 *
 * Plain .js so the tape harness can require it under @babel/register (no .ts resolution here);
 * imported by ConnectionManager.ts via allowJs.
 *
 * @param {{x?:number, y?:number, z?:number, b?:number}} axes
 * @returns {string} e.g. "G92 X0 Y0 Z0" or "G92" when no finite axes are given
 */
export function buildSetWorkOriginGcode(axes) {
    const parts = [];
    ['x', 'y', 'z', 'b'].forEach((k) => {
        const v = axes ? axes[k] : undefined;
        if (Number.isFinite(v)) {
            parts.push(`${k.toUpperCase()}${v}`);
        }
    });
    return ['G92', ...parts].join(' ');
}
