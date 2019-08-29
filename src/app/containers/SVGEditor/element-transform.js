
// https://developer.mozilla.org/en-US/docs/Web/API/SVGTransform
// type
//  0: unknown
//  1: matrix
//  2: translate
//  4: rotate

const IDENTITY = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0
};

function isIdentity(m) {
    return (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0);
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

function getTransformList(elem) {
    return elem.transform.baseVal;
}

export {
    IDENTITY,
    isIdentity,
    transformPoint,
    transformBox,
    getTransformList
};
