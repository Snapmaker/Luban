
// TODO: add more defaults if needed
const defaultAttributes = {
    opacity: 1,
    stroke: 'none',
    rx: 0,
    ry: 0
};

function cleanupAttributes(elem) {
    if (elem.nodeName === 'ellipse') {
        // Ellipse elements require rx and ry attributes
        delete defaultAttributes.rx;
        delete defaultAttributes.ry;
    }

    for (const [key, value] of Object.entries(defaultAttributes)) {
        if (elem.getAttribute(key) === String(value)) {
            elem.removeAttribute(key);
        }
    }
}

/**
 * Set multiple attribute at once.
 *
 * @param elem
 * @param attributes
 */
function setAttributes(elem, attributes) {
    for (const [key, value] of Object.entries(attributes)) {
        elem.setAttribute(key, value);
    }
}

export {
    cleanupAttributes,
    setAttributes
};
