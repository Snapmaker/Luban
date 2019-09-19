import * as pathSeg from 'pathseg'; // eslint-disable-line no-unused-vars

import { setAttributes, getBBox } from './element-utils';
import {
    isIdentity,
    transformListToTransform,
    transformPoint,
    transformBox,
    getTransformList
} from './element-transform';

const PATH_MAP = [
    0, 'z', 'M', 'm', 'L', 'l', 'C', 'c', 'Q', 'q',
    'A', 'a', 'H', 'h', 'V', 'v', 'S', 's', 'T', 't'
];

function remapElement(elem, changes, m) {
    function remap(x, y) {
        return transformPoint(x, y, m);
    }

    function scaleW(w) {
        return m.a * w;
    }

    function scaleH(w) {
        return m.d * w;
    }

    function finishUp() {
        setAttributes(elem, changes);
    }

    const bbox = getBBox(elem);

    switch (elem.tagName) {
        case 'circle': {
            const c = remap(changes.cx, changes.cy);
            changes.cx = c.x;
            changes.cy = c.y;

            const newBbox = transformBox(bbox.x, bbox.y, bbox.width, bbox.height, m);
            changes.r = Math.min(newBbox.width, newBbox.height) / 2;
            finishUp();
            break;
        }
        case 'ellipse': {
            const c = remap(changes.cx, changes.cy);
            changes.cx = c.x;
            changes.cy = c.y;
            changes.rx = scaleW(changes.rx);
            changes.ry = scaleH(changes.ry);
            changes.rx = Math.abs(changes.rx);
            changes.ry = Math.abs(changes.ry);
            finishUp();
            break;
        }
        case 'line': {
            const pt1 = remap(changes.x1, changes.y1);
            const pt2 = remap(changes.x2, changes.y2);
            changes.x1 = pt1.x;
            changes.y1 = pt1.y;
            changes.x2 = pt2.x;
            changes.y2 = pt2.y;
            finishUp();
            break;
        }
        case 'path': {
            const pathSegList = elem.pathSegList;
            const len = pathSegList.numberOfItems;
            changes.d = [];
            for (let i = 0; i < len; i++) {
                const seg = pathSegList.getItem(i);
                changes.d[i] = {
                    type: seg.pathSegType,
                    x: seg.x,
                    y: seg.y,
                    x1: seg.x1,
                    y1: seg.y1,
                    x2: seg.x2,
                    y2: seg.y2,
                    r1: seg.r1,
                    r2: seg.r2,
                    angle: seg.angle,
                    largeArcFlag: seg.largeArcFlag,
                    sweepFlag: seg.sweepFlag
                };
            }

            const firstSeg = changes.d[0];
            const pt0 = remap(firstSeg.x, firstSeg.y);
            changes.d[0].x = pt0.x;
            changes.d[0].y = pt0.y;
            for (let i = 1; i < len; i++) {
                const seg = changes.d[i];

                if (seg.type % 2 === 0) { // absolute
                    const x = (seg.x !== undefined) ? seg.x : pt0.x;
                    const y = (seg.y !== undefined) ? seg.y : pt0.y;

                    const pt = remap(x, y);
                    const pt1 = remap(seg.x1, seg.y1);
                    const pt2 = remap(seg.x2, seg.y2);
                    seg.x = pt.x;
                    seg.y = pt.y;
                    seg.x1 = pt1.x;
                    seg.y1 = pt1.y;
                    seg.x2 = pt2.x;
                    seg.y2 = pt2.y;
                    seg.r1 = scaleW(seg.r1);
                    seg.r2 = scaleH(seg.r2);
                } else { // relative
                    seg.x = scaleW(seg.x);
                    seg.y = scaleW(seg.y);
                    seg.x1 = scaleW(seg.x1);
                    seg.y1 = scaleW(seg.y1);
                    seg.x2 = scaleW(seg.x2);
                    seg.y2 = scaleW(seg.y2);
                    seg.r1 = scaleW(seg.r1);
                    seg.r2 = scaleW(seg.r2);
                }
            }

            let d = '';
            for (let i = 0; i < len; i++) {
                const seg = changes.d[i];
                d += PATH_MAP[seg.type];
                switch (seg.type) {
                    case 2: // M, m
                    case 3:
                    case 4: // L, l
                    case 5:
                    case 18: // T, t
                    case 19:
                        d += `${seg.x},${seg.y} `;
                        break;
                    case 12: // H, h
                    case 13:
                        d += `${seg.x} `;
                        break;
                    case 14: // V, v
                    case 15:
                        d += `${seg.y} `;
                        break;
                    case 6: // C, c
                    case 7:
                        d += `${seg.x1},${seg.y} ${seg.x2},${seg.y2} ${seg.x},${seg.y} `;
                        break;
                    case 8: // Q, q
                    case 9:
                        d += `${seg.x1},${seg.y} ${seg.x},${seg.y} `;
                        break;
                    case 10: // A, a
                    case 11:
                        d += `${seg.r1},${seg.r2} ${seg.angle} ${seg.largeArcFlag} ${seg.sweepFlag} ${seg.x},${seg.y} `;
                        break;
                    case 16: // S, s
                    case 17:
                        d += `${seg.x2},${seg.y2} ${seg.x},${seg.y} `;
                        break;
                    default:
                        break;
                }
            }

            elem.setAttribute('d', d);
            break;
        }
        case 'rect': {
            const pt1 = remap(changes.x, changes.y);
            changes.width = scaleW(changes.width);
            changes.height = scaleH(changes.height);
            changes.x = pt1.x + Math.min(0, changes.width);
            changes.y = pt1.y + Math.min(0, changes.height);
            changes.width = Math.abs(changes.width);
            changes.height = Math.abs(changes.height);
            finishUp();
            break;
        }
        default:
            break;
    }
}

/**
 * Decides the course of action based on the element's transform list.
 */
function recalculateDimensions(root, elem) {
    const transformList = getTransformList(elem);

    // Remove any unnecessary transforms
    if (transformList && transformList.numberOfItems > 0) {
        const number = transformList.numberOfItems;
        for (let k = number - 1; k >= 0; k--) {
            const transform = transformList.getItem(k);
            if (transform.type === 0) { // unknown
                transformList.removeItem(k);
            } else if (transform.type === 1) { // matrix
                if (isIdentity(transform.matrix)) {
                    if (number === 1) {
                        // elem.setAttribute('transform', '');
                        elem.removeAttribute('transform');
                        return;
                    }
                    transformList.removeItem(k);
                }
            } else if (transform.type === 4) { // rotate
                if (transform.angle === 0) {
                    transformList.removeItem(k);
                }
            }
        }

        // dealing with only rotation transform
    }

    if (!transformList || transformList.numberOfItems === 0) {
        // elem.setAttribute('transform', '');
        elem.removeAttribute('transform');
        return;
    }

    // initial values that will be affected by reducing the transform list
    const changes = {};
    const numberAttrs = [];
    switch (elem.tagName) {
        case 'circle':
            numberAttrs.push('cx', 'cy', 'r');
            break;
        case 'ellipse':
            numberAttrs.push('cx', 'cy', 'rx', 'ry');
            break;
        case 'line':
            numberAttrs.push('x1', 'y1', 'x2', 'y2');
            break;
        case 'path':
            changes.d = elem.getAttribute('d');
            break;
        case 'rect':
            numberAttrs.push('x', 'y', 'width', 'height');
            break;
        default:
            break;
    }
    if (numberAttrs.length) {
        for (const attr of numberAttrs) {
            changes[attr] = Number(elem.getAttribute(attr));
        }
    }

    const n = transformList.numberOfItems;
    let m;
    // 1: matrix
    // 2: translate
    // 3: scale
    // 4: rotate
    let operation = 0;
    // [M]
    if (n === 1 && transformList.getItem(0).type === 2) {
        operation = 2;
        m = transformList.getItem(0).matrix;
        transformList.removeItem(0);
    }

    // [T][S][T], non-skewed element
    if (n >= 3 && transformList.getItem(n - 2).type === 3 && transformList.getItem(n - 3).type === 2
        && transformList.getItem(n - 1).type === 2) {
        operation = 3; // scale
        m = transformListToTransform(transformList, n - 3, n - 1).matrix;
        transformList.removeItem(n - 1);
        transformList.removeItem(n - 2);
        transformList.removeItem(n - 3);
    }

    if (operation === 2 || operation === 3) {
        remapElement(elem, changes, m);
    }
}

export {
    recalculateDimensions
};
