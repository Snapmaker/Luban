// eslint-disable-next-line no-unused-vars
import isNumber from 'lodash/isNumber';
import { NS } from './lib/namespaces';
import { getRotationAngle, getScale } from './element-transform';

// eslint-disable-next-line no-unused-vars
import PathTagParser from '../../../shared/lib/SVGParser/PathTagParser';
import AttributesParser from '../../../shared/lib/SVGParser/AttributesParser';
import { isZero } from '../../../shared/lib/utils';
import { DEFAULT_FILL_COLOR } from './constants';

function toXml(str) {
    // &apos; is ok in XML, but not HTML
    // &gt; does not normally need escaping, though it can if within a CDATA expression (and preceded by "]]")
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;'); // Note: `&apos;` is XML only
}

function shortFloat(val) {
    const digits = 5;
    if (!Number.isNaN(val)) {
        return Number(Number(val).toFixed(digits));
    }
    if (Array.isArray(val)) {
        return `${shortFloat(val[0])},${shortFloat(val[1])}`;
    }
    return parseFloat(val).toFixed(digits) - 0;
}


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

/**
 * Create Svg Element
 * @param data
 * @returns {any}
 */
function createSVGElement(data) {
    const element = document.createElementNS(NS.SVG, data.element);

    // set attribute
    setAttributes(element, {
        fill: DEFAULT_FILL_COLOR,
        // If you want to set fill-opacity, before createSVGElement pls.
        // since text is a svg image
        'fill-opacity': 0,
        stroke: '#000000'
    });
    cleanupAttributes(element);
    // if (data.element === 'text' && data.attr.textContent) {
    //     element.textContent = data.attr.textContent;
    // }
    setAttributes(element, data.attr);
    // add children?
    return element;
}


/**
 * Converts a `SVGRect` into an object.
 */
function bboxToObj({ x, y, width, height }) {
    return { x, y, width, height };
}

function getNumberAttributes(elem, attributes) {
    const res = {};
    for (const attribute of attributes) {
        res[attribute] = Number(elem.getAttribute(attribute));
    }
    return res;
}

function getBBoxFromAttribute(elem) {
    if (elem.nodeType !== 1) {
        return null;
    }
    let bbox = { x: 0, y: 0, width: 0, height: 0 };
    let attrs = null;
    switch (elem.tagName) {
        case 'circle':
            attrs = getNumberAttributes(elem, ['cx', 'cy', 'r']);
            bbox = {
                x: attrs.cx - attrs.r,
                y: attrs.cy - attrs.r,
                width: 2 * attrs.r,
                height: 2 * attrs.r
            };
            break;
        case 'ellipse':
            attrs = getNumberAttributes(elem, ['cx', 'cy', 'rx', 'ry']);
            bbox = {
                x: attrs.cx - attrs.rx,
                y: attrs.cy - attrs.ry,
                width: 2 * attrs.rx,
                height: 2 * attrs.ry
            };
            break;
        case 'line':
            attrs = getNumberAttributes(elem, ['x1', 'y1', 'x2', 'y2']);
            bbox = {
                x: Math.min(attrs.x1, attrs.x2),
                y: Math.min(attrs.y1, attrs.y2),
                width: Math.abs(attrs.x1 - attrs.x2),
                height: Math.abs(attrs.y1 - attrs.y2)
            };
            break;
        case 'path': {
            attrs = { xform: [1, 0, 0, 1, 0, 0] };
            new AttributesParser().parseAttribute(attrs, {}, 'd', elem.getAttribute('d'));
            const res = new PathTagParser(1).parse(null, attrs);

            bbox = {
                x: res.boundingBox.minX,
                y: res.boundingBox.minY,
                width: res.boundingBox.maxX - res.boundingBox.minX,
                height: res.boundingBox.maxY - res.boundingBox.minY
            };

            break;
        }
        case 'rect':
        case 'image':
            attrs = getNumberAttributes(elem, ['x', 'y', 'width', 'height']);
            bbox = {
                x: attrs.x,
                y: attrs.y,
                width: attrs.width,
                height: attrs.height
            };
            break;
        default:
            break;
    }
    return bbox;
}

function getBBox(elem) {
    if (elem.nodeType !== 1) {
        return null;
    }

    let bbox = null;
    switch (elem.nodeName) {
        case 'text': {
            if (elem.textContent === '') {
                elem.textContent = 'a'; // Some character needed for the selector to use.
                bbox = elem.getBBox();
                elem.textContent = '';
            } else if (elem.getBBox) {
                bbox = elem.getBBox();
            }
            break;
        }
        default:
            bbox = elem.getBBox();
            break;
    }
    if (bbox) {
        if (isZero(bbox.width) && isZero(bbox.height)) {
            bbox = getBBoxFromAttribute(elem);
        }
        return bboxToObj(bbox);
    }

    return null;
}

// Export SVG
function toString(elem, indent) {
    const out = [];
    out.push(new Array(indent).join(' '));

    switch (elem.nodeType) {
        case 1: {
            // element node
            cleanupAttributes(elem);

            const attrs = Object.values(elem.attributes);
            attrs.sort((a, b) => {
                return a.name > b.name ? -1 : 1;
            });

            out.push('<');
            out.push(elem.nodeName);


            for (let i = attrs.length - 1; i >= 0; i--) {
                const attr = attrs[i];
                let attrVal = toXml(attr.value);
                if (attrVal !== '') {
                    if (attrVal.startsWith('pointer-events')) {
                        continue;
                    }
                    out.push(' ');

                    if (isNumber(attrVal)) {
                        attrVal = shortFloat(attrVal);
                    }

                    out.push(`${attr.nodeName}="${attrVal}"`);
                }
            }

            if (elem.hasChildNodes()) {
                out.push('>');

                for (let i = 0; i < elem.childNodes.length; i++) {
                    const child = elem.childNodes.item(i);

                    const childOutput = toString(child, indent + 1);
                    if (childOutput) {
                        out.push('\n');
                        out.push(childOutput);
                    }
                }

                out.push('\n');
                out.push(new Array(indent).join(' '));
                out.push(`</${elem.nodeName}>`);
            } else {
                out.push('/>');
            }

            break;
        }
        case 3: {
            // text
            const str = elem.nodeValue.replace(/^\s+|\s+$/g, '');
            if (str === '') {
                return '';
            } else {
                out.push(toXml(str));
            }
            break;
        }
        case 4: {
            // CDATA
            out.push(`<![CDATA[${elem.nodeValue}]]>`);
            break;
        }
        case 8: {
            // comment
            out.push(`<!--${elem.data}-->`);
            break;
        }
        default:
            break;
    }

    return out.join('');
}

const SVG_ANGLE_OFFSET = 90;

const transformAngleFromXY = (x, y, cx, cy) => {
    return (Math.atan2(cy - y, cx - x) / Math.PI * 180 + SVG_ANGLE_OFFSET) % 360;
};

const coordGmSvgToModel = (size, elem) => {
    const bbox = getBBox(elem);
    const angle = getRotationAngle(elem) || 0;
    const { scaleX, scaleY } = getScale(elem);


    bbox.positionX = bbox.x + bbox.width / 2 - size.x;
    bbox.positionY = size.y - bbox.y - bbox.height / 2;
    bbox.rotationZ = -angle / 180 * Math.PI;
    bbox.scaleX = scaleX;
    bbox.scaleY = scaleY;
    return bbox;
};

export {
    shortFloat,
    cleanupAttributes,
    setAttributes,
    createSVGElement,
    getBBox,
    toString,
    getBBoxFromAttribute,
    transformAngleFromXY,
    coordGmSvgToModel
};
