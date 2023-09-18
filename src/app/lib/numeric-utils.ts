import { isNil } from 'lodash';
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

function getAttribute(model, attributePath) {
    return attributePath.slice(0).reduce((result, attribute, i, arr) => {
        if (isNil(result[attribute])) {
            arr.splice(i);
        } // eject early by mutating iterated copy
        return result[attribute];
    }, model);
}
/**
 * bubbleSort for 'models' array inside project file.
 *
 * @param arr
 * @param attribute
 * @return {array}
 */
function bubbleSortByAttribute(arr, attribute = []) {
    const len = arr.length;
    for (let i = 0; i < len - 1; i++) {
        for (let j = 0; j < len - 1 - i; j++) {
            if (getAttribute(arr[j], attribute) > getAttribute(arr[j + 1], attribute)) {
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
            const num = Number(value.toFixed(fractionDigits));
            return num;
        }
    }
    return value; // no fix needed
};

const toFixedNumber = (value, fractionDigits) => {
    // actual fraction digits > maximum fraction digits
    let num = Number(value.toFixed(fractionDigits));
    if (num < -180) {
        num = (num + 360) % 360;
    }
    return num;
};

const checkVector3NaN = (vector3) => {
    if (vector3 && !vector3.isVector3) {
        return true;
    }
    return vector3.toArray().some((d) => {
        return Number.isNaN(d);
    });
};
const convertSVGPointToLogicalPoint = (p, size) => {
    return {
        x: p.x - size.x,
        y: -p.y + size.y
    };
};

export const naturalSortKeys = (name: string): Array<string | number> => {
    const items = name.split(' ');
    return items.map(item => {
        const found = item.match(/(\d+\.\d+|\d+)/g);
        if (found) {
            return Number(found[0]);
        } else {
            return item;
        }
    });
};

export {
    EPS,
    ensureRange,
    bubbleSortByAttribute,
    toFixed,
    toFixedNumber,
    checkVector3NaN,
    convertSVGPointToLogicalPoint
};
