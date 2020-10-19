import { NS } from './namespaces';

/**
 * Extracts the URL from the `url(...)` syntax of some attributes.
 * Three variants:
 *  - `<circle fill="url(someFile.svg#foo)" />`
 *  - `<circle fill="url('someFile.svg#foo')" />`
 *  - `<circle fill='url("someFile.svg#foo")' />`
 * @function module:utilities.getUrlFromAttr
 * @param {string} attrVal The attribute value as a string
 * @returns {string} String with just the URL, like "someFile.svg#foo"
 */
export function getUrlFromAttr(attrVal) {
    if (attrVal) {
        // url('#somegrad')
        if (attrVal.startsWith('url("')) {
            return attrVal.substring(5, attrVal.indexOf('"', 6));
        }
        // url('#somegrad')
        if (attrVal.startsWith("url('")) {
            return attrVal.substring(5, attrVal.indexOf("'", 6));
        }
        if (attrVal.startsWith('url(')) {
            return attrVal.substring(4, attrVal.indexOf(')'));
        }
    }
    return null;
}

/**
 * @function module:utilities.getHref
 * @param {Element} elem
 * @returns {string} The given element's `xlink:href` value
 */
export function getHref(elem) { // eslint-disable-line import/no-mutable-exports
    return elem.getAttributeNS(NS.XLINK, 'href');
}

/**
 * Sets the given element's `xlink:href` value.
 * @function module:utilities.setHref
 * @param {Element} elem
 * @param {string} val
 * @returns {void}
 */
export function setHref(elem, val) { // eslint-disable-line import/no-mutable-exports
    elem.setAttributeNS(NS.XLINK, 'xlink:href', val);
}
