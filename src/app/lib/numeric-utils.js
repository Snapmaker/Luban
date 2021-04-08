
// epsilon
const EPS = 1e-6;

/**
 * Ensure numeric range.
 *
 * @param {number} value - Number to be fixed
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @return {number}
 */
const ensureRange = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};
/**
 * bubbleSort for 'models' array inside project file.
 *
 * @param arr
 * @param attribute
 * @return {array}
 */
function bubbleSortByAttribute(arr, attribute) {
    const len = arr.length;
    for (let i = 0; i < len - 1; i++) {
        for (let j = 0; j < len - 1 - i; j++) {
            if (arr[j][attribute] > arr[j + 1][attribute]) {
                const temp = arr[j + 1];
                arr[j + 1] = arr[j];
                arr[j] = temp;
            }
        }
    }
    return arr;
}
/**
 * Wrapper for `toFixed`.
 *
 * @param value
 * @param fractionDigits
 * @return {*|string}
 */
const toFixed = (value, fractionDigits) => {
    const stringValue = String(value);
    const pos = stringValue.indexOf('.');
    if (pos !== -1) {
        const d = stringValue.length - pos - 1;
        if (d > fractionDigits) {
            // actual fraction digits > maximum fraction digits
            return Number(value.toFixed(fractionDigits));
        }
    }
    return value; // no fix needed
};

export {
    EPS,
    ensureRange,
    bubbleSortByAttribute,
    toFixed
};
