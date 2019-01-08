/**
 * Random Utils
 */
import path from 'path';

function timestamp() {
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }
    const d = new Date();

    return d.getFullYear()
        + pad(d.getMonth() + 1)
        + pad(d.getDate())
        + pad(d.getHours())
        + pad(d.getMinutes())
        + pad(d.getMilliseconds())
        + pad(Math.floor(Math.random() * 10));
}

/**
 * Provide acceptable filename with random suffix.
 *
 * @param pathString
 */
function pathWithRandomSuffix(pathString) {
    const pathInfo = path.parse(pathString);

    // remove previous added timestamp
    const normalName = pathInfo.name.replace(/_[0-9]{14}$/, '');

    // use substring of length 30 to avoid save issue on Windows
    pathInfo.name = `${normalName.substr(0, 30)}_${timestamp()}`;
    pathInfo.base = '';

    return path.format(pathInfo);
}

export {
    pathWithRandomSuffix
};
