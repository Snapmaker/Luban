/**
 * Ensure numeric range.
 *
 * @param {number} value - Number to be fixed
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 */
const ensureRange = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

export {
    ensureRange
};
