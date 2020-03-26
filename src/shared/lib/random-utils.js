/**
 * Random Utils
 */
import path from 'path';
import isFunction from 'lodash/isFunction';

// 17 digits
function timestamp() {
    function pad2(n) {
        return n < 10 ? `0${n}` : `${n}`;
    }
    function pad3(n) {
        if (n < 10) {
            return `00${n}`;
        } else if (n < 100) {
            return `0${n}`;
        } else {
            return `${n}`;
        }
    }
    const d = new Date();

    return pad2(d.getMinutes())
        + pad3(d.getMilliseconds())
        + pad3(Math.floor(Math.random() * 100));
}

/**
 * Provide acceptable filename with random suffix.
 *
 * @param pathString
 */
function pathWithRandomSuffix(pathString) {
    if (isFunction(path.parse)) {
        const pathInfo = path.parse(pathString);

        // remove previous added timestamp
        const normalName = pathInfo.name.replace(/_[0-9]{8}$/, '');

        // use substring of length 30 to avoid save issue on Windows
        pathInfo.name = `${normalName.substr(0, 30)}_${timestamp()}`;
        pathInfo.base = '';

        return path.format(pathInfo);
    } else {
        // webpack with browsify-path@0.0.0, which doesn't support path.parse, we
        // need to deal with the filename manually.
        // Check https://github.com/webpack/node-libs-browser/issues/78 for incompatibility.
        const basename = path.basename(pathString);

        const dot = basename.lastIndexOf('.');
        const name = basename.substr(0, dot);
        const ext = basename.substr(dot + 1);

        // remove previous added timestamp
        const normalName = name.replace(/_[0-9]{8}$/, '');

        // use substring of length 30 to avoid save issue on Windows
        return `${normalName.substr(0, 30)}_${timestamp()}.${ext}`;
    }
}

export {
    timestamp,
    pathWithRandomSuffix
};
