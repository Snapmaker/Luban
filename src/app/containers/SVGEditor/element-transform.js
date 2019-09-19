// https://developer.mozilla.org/en-US/docs/Web/API/SVGTransform
// type
//  0: unknown
//  1: matrix
//  2: translate
//  4: rotate

import { NS } from './lib/namespaces';

const NEAR_ZERO = 1e-14;

const IDENTITY = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0
};

const svg = document.createElementNS(NS.SVG, 'svg');

function isIdentity(m) {
    return (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0);
}

function matrixMultiply(...args) {
    const m = args.reduceRight((prev, m1) => m1.multiply(prev));

    if (Math.abs(m.a) < NEAR_ZERO) {
        m.a = 0;
    }
    if (Math.abs(m.b) < NEAR_ZERO) {
        m.b = 0;
    }
    if (Math.abs(m.c) < NEAR_ZERO) {
        m.c = 0;
    }
    if (Math.abs(m.d) < NEAR_ZERO) {
        m.d = 0;
    }
    if (Math.abs(m.e) < NEAR_ZERO) {
        m.e = 0;
    }
    if (Math.abs(m.f) < NEAR_ZERO) {
        m.f = 0;
    }

    return m;
}

function transformPoint(x, y, m) {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function transformBox(x, y, w, h, m) {
    const topLeft = transformPoint(x, y, m);
    const topRight = transformPoint(x + w, y, m);
    const bottomLeft = transformPoint(x, y + h, m);
    const bottomRight = transformPoint(x + w, y + h, m);

    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// - Transform List

function hasMatrixTransform(transformList) {
    if (!transformList) {
        return false;
    }
    let num = transformList.numberOfItems;
    while (num--) {
        const xform = transformList.getItem(num);
        if (xform.type === 1 && !isIdentity(xform.matrix)) {
            return true;
        }
    }
    return false;
}

function getRotationAngleFromTransformList(transformList) {
    if (!transformList) {
        return 0;
    } // <svg> elements have no tlist
    const n = transformList.numberOfItems;
    for (let i = 0; i < n; ++i) {
        const xform = transformList.getItem(i);
        if (xform.type === 4) {
            return xform.angle;
        }
    }
    return 0.0;
}


function transformListToTransform(transformList, start, end) {
    // if (!transformList) {
    //     return svg.createSVGTransformFromMatrix(svg.createSVGMatrix());
    // }

    const n = transformList.numberOfItems;
    start = start || 0;
    end = end || n - 1;
    let m = svg.createSVGMatrix();
    for (let i = start; i <= end; i++) {
        const ma = transformList.getItem(i).matrix;
        m = matrixMultiply(m, ma);
    }

    return svg.createSVGTransformFromMatrix(m);
}

// - element

function getTransformList(elem) {
    return elem.transform.baseVal;
}

function getRotationAngle(elem) {
    const transformList = getTransformList(elem);
    return getRotationAngleFromTransformList(transformList);
}


export {
    IDENTITY,
    isIdentity,
    transformPoint,
    transformBox,

    hasMatrixTransform,
    transformListToTransform,

    getTransformList,
    getRotationAngle
};
