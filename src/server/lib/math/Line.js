import { Vector3 } from './Vector3';
import { isZero } from '../../../shared/lib/utils';
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

    static pointInLine(v, l) {
        const v0 = Vector2.sub(v, l.v0);
        const v1 = Vector2.sub(l.v1, l.v0);

        if (Vector2.isZero(v0)) {
            return true;
        }

        const vn0 = Vector2.normalize(v0);
        const vn1 = Vector2.normalize(v1);

        if (l.type === TYPE_LINE) {
            return Vector2.isEqual(vn0, vn1) || Vector2.isEqual(vn0, { x: -vn1.x, y: -vn1.y });
        } else if (l.type === TYPE_RAY) {
            return Vector2.isEqual(vn0, vn1);
        } else {
            return Vector2.length2(v0) <= Vector2.length2(v1);
        }
    }

    static intersectionPoint(l1, l2) {
        const vCross = Vector3.cross({ x: l1.A, y: l1.B, z: l1.C }, { x: l2.A, y: l2.B, z: l2.C });

        if (isZero(vCross.x) && isZero(vCross.y) && isZero(vCross.z)) {
            let v = l1.v0;
            v = v.y > l1.v1.y ? v : l1.v1;
            v = v.y > l2.v0.y ? v : l2.v0;
            v = v.y > l2.v1.y ? v : l2.v1;
            return v;
        }

        if (isZero(vCross.z)) {
            return null;
        }

        const v = {
            x: vCross.x / vCross.z,
            y: vCross.y / vCross.z
        };

        if (Line.pointInLine(v, l1) && Line.pointInLine(v, l2)) {
            return v;
        }

        return null;
    }
}
