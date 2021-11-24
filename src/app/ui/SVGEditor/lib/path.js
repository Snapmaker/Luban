// eslint-disable-next-line no-unused-vars
import * as pathSeg from 'pathseg';

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

const PATH_MAP = [
    0, 'z', 'M', 'm', 'L', 'l', 'C', 'c', 'Q', 'q',
    'A', 'a', 'H', 'h', 'V', 'v', 'S', 's', 'T', 't'
];

function pathDSegment(letter, points, morePoints, lastPoint) {
    for (let i = 0, len = points.length; i < len; i++) {
        points[i] = shortFloat(points[i]);
    }

    let segment = letter + points.join(' ');
    if (morePoints) {
        segment += ' ';
        segment += morePoints.join(' ');
    }
    if (lastPoint) {
        segment += ' ';
        segment += shortFloat(lastPoint);
    }
    return segment;
}

function convertPath(pth, toRel) {
    const { pathSegList } = pth;
    const len = pathSegList.numberOfItems;
    let curx = 0, cury = 0;
    let d = '';
    let lastM = null;

    for (let i = 0; i < len; ++i) {
        const seg = pathSegList.getItem(i);
        // if these properties are not in the segment, set them to zero
        let x = seg.x || 0,
            y = seg.y || 0,
            x1 = seg.x1 || 0,
            y1 = seg.y1 || 0,
            x2 = seg.x2 || 0,
            y2 = seg.y2 || 0;

        const type = seg.pathSegType;
        let letter = PATH_MAP[type][toRel ? 'toLowerCase' : 'toUpperCase']();

        switch (type) {
            case 1: // z,Z closepath (Z/z)
                d += 'z';
                if (lastM && !toRel) {
                    curx = lastM[0];
                    cury = lastM[1];
                }
                break;
            case 12: // absolute horizontal line (H)
                x -= curx;
            // Fallthrough
            case 13: // relative horizontal line (h)
                if (toRel) {
                    curx += x;
                    letter = 'l';
                } else {
                    x += curx;
                    curx = x;
                    letter = 'L';
                }
                // Convert to "line" for easier editing
                d += pathDSegment(letter, [[x, cury]]);
                break;
            case 14: // absolute vertical line (V)
                y -= cury;
            // Fallthrough
            case 15: // relative vertical line (v)
                if (toRel) {
                    cury += y;
                    letter = 'l';
                } else {
                    y += cury;
                    cury = y;
                    letter = 'L';
                }
                // Convert to "line" for easier editing
                d += pathDSegment(letter, [[curx, y]]);
                break;
            case 2: // absolute move (M)
            case 4: // absolute line (L)
            case 18: // absolute smooth quad (T)
                x -= curx;
                y -= cury;
            // Fallthrough
            case 5: // relative line (l)
            case 3: // relative move (m)
            case 19: // relative smooth quad (t)
                if (toRel) {
                    curx += x;
                    cury += y;
                } else {
                    x += curx;
                    y += cury;
                    curx = x;
                    cury = y;
                }
                if (type === 2 || type === 3) {
                    lastM = [curx, cury];
                }

                d += pathDSegment(letter, [[x, y]]);
                break;
            case 6: // absolute cubic (C)
                x -= curx;
                x1 -= curx;
                x2 -= curx;
                y -= cury;
                y1 -= cury;
                y2 -= cury;
            // Fallthrough
            case 7: // relative cubic (c)
                if (toRel) {
                    curx += x;
                    cury += y;
                } else {
                    x += curx;
                    x1 += curx;
                    x2 += curx;
                    y += cury;
                    y1 += cury;
                    y2 += cury;
                    curx = x;
                    cury = y;
                }
                d += pathDSegment(letter, [[x1, y1], [x2, y2], [x, y]]);
                break;
            case 8: // absolute quad (Q)
                x -= curx;
                x1 -= curx;
                y -= cury;
                y1 -= cury;
            // Fallthrough
            case 9: // relative quad (q)
                if (toRel) {
                    curx += x;
                    cury += y;
                } else {
                    x += curx;
                    x1 += curx;
                    y += cury;
                    y1 += cury;
                    curx = x;
                    cury = y;
                }
                d += pathDSegment(letter, [[x1, y1], [x, y]]);
                break;
            // eslint-disable-next-line
            case 10: // absolute elliptical arc (A)
                x -= curx;
                y -= cury;
            // Fallthrough
            case 11: // relative elliptical arc (a)
                if (toRel) {
                    curx += x;
                    cury += y;
                } else {
                    x += curx;
                    y += cury;
                    curx = x;
                    cury = y;
                }
                d += pathDSegment(letter, [[seg.r1, seg.r2]], [
                    seg.angle,
                    (seg.largeArcFlag ? 1 : 0),
                    (seg.sweepFlag ? 1 : 0)
                ], [x, y]);
                break;
            case 16: // absolute smooth cubic (S)
                x -= curx;
                x2 -= curx;
                y -= cury;
                y2 -= cury;
            // Fallthrough
            case 17: // relative smooth cubic (s)
                if (toRel) {
                    curx += x;
                    cury += y;
                } else {
                    x += curx;
                    x2 += curx;
                    y += cury;
                    y2 += cury;
                    curx = x;
                    cury = y;
                }
                d += pathDSegment(letter, [[x2, y2], [x, y]]);
                break;
            default:
                break;
        } // switch on path segment type
    } // for each segment
    return d;
}

function fixEnd(path) {
    return path;
}

export {
    convertPath,
    fixEnd
};
