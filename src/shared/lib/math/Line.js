import { EPSILON, isEqual } from '../utils';
import { Vector2 } from './Vector2';

export const TYPE_LINE = 'line';
export const TYPE_RAY = 'ray';
export const TYPE_SEGMENT = 'segment';

export class Line {
    constructor(v0, v1, type = TYPE_LINE) {
        this.v0 = v0;
        this.v1 = v1;
        this.type = type;
        this.A = v1.y - v0.y;
        this.B = v0.x - v1.x;
        this.C = v1.x * v0.y - v0.x * v1.y;
    }

    getYByX(x) {
        if (this.B === 0) {
            return null;
        }
        return (-this.C - this.A * x) / this.B;
    }

    static lineParallel(l1, l2) {
        if (l1.B === 0 && l2.B === 0) {
            return true;
        }
        if (l1.B === 0 || l2.B === 0) {
            return false;
        }
        return isEqual(l1.A * l2.B, l2.A * l1.B);
    }

    static pointDistance(p, st, ed) {
        if (Vector2.isEqual(p, st) || Vector2.isEqual(p, ed)) {
            return 0;
        }

        const A = st.y - ed.y;
        const B = ed.x - st.x;
        const C = st.x * ed.y - ed.x * st.y;

        return Math.abs((A * p.x + B * p.y + C) / (Math.sqrt(A * A + B * B)));
    }

    static pointInLine(v, l) {
        return this.pointInLine2(v, l.v0, l.v1, l.type);
    }

    static pointInLine2(v, p0, p1, type = TYPE_LINE) {
        const v0 = Vector2.sub(v, p0);
        const v1 = Vector2.sub(p1, p0);

        if (Vector2.isZero(v0)) {
            return true;
        }

        const vn0 = Vector2.normalize(v0);
        const vn1 = Vector2.normalize(v1);

        if (type === TYPE_LINE) {
            return Vector2.isEqual(vn0, vn1) || Vector2.isEqual(vn0, {
                x: -vn1.x,
                y: -vn1.y
            });
        } else if (type === TYPE_RAY) {
            return Vector2.isEqual(vn0, vn1);
        } else {
            return Vector2.isEqual(vn0, vn1) && Vector2.length2(v0) <= Vector2.length2(v1);
        }
    }

    static intersectionPoint(A, B, E, F, infinite = false) {
        const a1 = B.y - A.y;
        const b1 = A.x - B.x;
        const c1 = B.x * A.y - A.x * B.y;
        const a2 = F.y - E.y;
        const b2 = E.x - F.x;
        const c2 = F.x * E.y - E.x * F.y;

        const denom = a1 * b2 - a2 * b1;

        const x = (b1 * c2 - b2 * c1) / denom;
        const y = (a2 * c1 - a1 * c2) / denom;

        // eslint-disable-next-line no-restricted-globals
        if (!isFinite(x) || !isFinite(y)) {
            return null;
        }

        // lines are colinear
        /* var crossABE = (E.y - A.y) * (B.x - A.x) - (E.x - A.x) * (B.y - A.y);
        var crossABF = (F.y - A.y) * (B.x - A.x) - (F.x - A.x) * (B.y - A.y);
        if(_almostEqual(crossABE,0) && _almostEqual(crossABF,0)){
            return null;
        }*/

        if (!infinite) {
            // coincident points do not count as intersecting
            if (Math.abs(A.x - B.x) > EPSILON && ((A.x < B.x) ? x < A.x || x > B.x : x > A.x || x < B.x)) return null;
            if (Math.abs(A.y - B.y) > EPSILON && ((A.y < B.y) ? y < A.y || y > B.y : y > A.y || y < B.y)) return null;

            if (Math.abs(E.x - F.x) > EPSILON && ((E.x < F.x) ? x < E.x || x > F.x : x > E.x || x < F.x)) return null;
            if (Math.abs(E.y - F.y) > EPSILON && ((E.y < F.y) ? y < E.y || y > F.y : y > E.y || y < F.y)) return null;
        }

        return { x: x, y: y };
    }
}
