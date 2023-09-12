/**
 * Ensure numeric range.
 *
 * @param {number} value - Number to be fixed
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 */
export const ensureRange = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};
