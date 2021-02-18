import _ from 'lodash';

export const EPSILON = 1e-6;

export const isZero = (x) => {
    return Math.abs(x) < EPSILON;
};

export const isEqual = (a, b) => {
    return Math.abs(a - b) < EPSILON;
};

export const angleToPi = (angle) => angle / 180 * Math.PI;
export const piToAngle = (pi) => pi / Math.PI * 180;

export const mmToPixel = (mm) => mm * 7.8; // TODO: remove 7.8 DEFAULT_SCALE
export const pixelToMM = (pi) => pi / 7.8;

export const round = (d, n) => {
    if (n === 0) {
        return Math.round(d);
    } else if (n === 1) {
        return Math.round(d * 10) / 10;
    } else if (n === 2) {
        return Math.round(d * 100) / 100;
    } else if (n === 3) {
        return Math.round(d * 1000) / 1000;
    } else {
        return parseFloat(d.toFixed(n));
    }
};

export const toHump = (name) => {
    return name.replace(/_(\w)/g, (all, letter) => {
        return letter.toUpperCase();
    });
};

export const toLine = (value) => {
    return value.replace(/([A-Z])/g, '_$1').toLowerCase();
};

export const getIndexByValue = (array, value) => {
    for (let i = 0; i < array.length; i++) {
        if (array[i] === value) {
            return i;
        }
    }
    return -1;
};

export const isNull = (d) => {
    return _.isNull(d) || _.isUndefined(d);
};

export const removeSpecialChars = (str) => {
    return str.replace(/[`~!@#$%^&*()_|+\-=?;:'",<>{}[\]\\/]/gi, '');
};

export default {
    isZero,
    isEqual
};
