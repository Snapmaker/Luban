
// https://developer.mozilla.org/en-US/docs/Web/API/SVGTransform
// type
//  0: unknown
//  1: matrix
//  2: translate
//  4: rotate

function isIdentity(m) {
    return (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0);
}

function transformPoint(x, y, m) {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function getTransformList(elem) {
    return elem.transform.baseVal;
}

export {
    isIdentity,
    transformPoint,
    getTransformList
};
