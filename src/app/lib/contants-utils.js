import { isArray, includes } from 'lodash';

export const valueOf = (obj, key, value) => {
    let result = null;
    Object.keys(obj).forEach((k) => {
        const values = obj[k][key];
        if (isArray(values) && includes(values, String(value))) {
            result = obj[k];
        } else if (values === String(value)) {
            result = obj[k];
        }
    });
    return result;
};
