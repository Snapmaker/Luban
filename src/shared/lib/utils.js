import _ from 'lodash';

export const EPSILON = 1e-6;

export const isZero = (x) => {
    return Math.abs(x) < EPSILON;
};

export const isEqual = (a, b) => {
    return Math.abs(a - b) < EPSILON;
};

export const round = (d, n) => {
    if (n === 1) {
        return Math.round(d * 10) / 10;
    } else if (n === 2) {
        return Math.round(d * 100) / 100;
    } else {
        return parseFloat(d.toFixed(n));
    }
};

export const isNull = (d) => {
    return _.isNull(d) || _.isUndefined(d);
};

export default {
    isZero,
    isEqual
};
