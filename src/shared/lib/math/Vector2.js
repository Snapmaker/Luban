import { angleToPi, isEqual, piToAngle } from '../utils';

export class Vector2 {
    static ZERO = {
        x: 0, y: 0, z: 0
    };

    static add(v1, v2) {
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y
        };
    }

    static sub(v1, v2) {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y
        };
    }

    static mul(v1, v2) {
        return {
            x: v1.x * v2.x,
            y: v1.y * v2.y
        };
    }

    static mulScale(v1, scale) {
        return {
            x: v1.x * scale,
            y: v1.y * scale
        };
    }

    static div(v1, v2) {
        return {
            x: v1.x / v2.x,
            y: v1.y / v2.x
        };
    }

    static divScale(v1, scale) {
        return {
            x: v1.x / scale,
            y: v1.y / scale
        };
    }

    static isZero(v) {
        return Vector2.isEqual(v, Vector2.ZERO);
    }

    static isEqual(v0, v1) {
        return isEqual(v0.x, v1.x) && isEqual(v0.y, v1.y);
    }

    static _length(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    static length2(v) {
        return v.x * v.x + v.y * v.y;
    }

    static cross(v1, v2) {
        return v1.x * v2.y - v1.y * v2.x;
    }

    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    }

    static normalize(v) {
        const length = Vector2._length(v);
        return {
            x: v.x / length,
            y: v.y / length
        };
    }

    static testLength(v, len) {
        if (v.x > len || v.x < -len) return false;
        if (v.y > len || v.y < -len) return false;
        return Vector2.length2(v) <= len * len;
    }

    static sameSide(v1, v2, p1, p2) {
        const c1 = Vector2.cross(Vector2.sub(v2, v1), Vector2.sub(p1, v1));
        const c2 = Vector2.cross(Vector2.sub(v2, v1), Vector2.sub(p2, v1));
        return (c1 >= 0 && c2 >= 0) || (c1 <= 0 && c2 <= 0);
    }

    static anglePoint(p1, p2) {
        const angle = piToAngle(Math.atan2(p2.y - p1.y, p2.x - p1.x));
        return angle > 0 ? angle : angle + 360;
    }

    static angle(v) {
        const angle = piToAngle(Math.atan2(v.y, v.x));
        return angle > 0 ? angle : angle + 360;
    }

    static rotate(p, angle, center = { x: 0, y: 0 }) {
        const pi = angleToPi(angle);
        const x = (p.x - center.x) * Math.cos(pi) - (p.y - center.y) * Math.sin(pi) + center.x;
        const y = (p.x - center.x) * Math.sin(pi) + (p.y - center.y) * Math.cos(pi) + center.y;
        return { x, y };
    }

    static area(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            area += p1.x * p2.y - p1.y * p2.x;
        }
        return area / 2;
    }

    static areaForArray(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            area += p1[0] * p2[1] - p1[1] * p2[0];
        }
        return area;
    }

    static pointInCommonLine(p1, p2, p3) {
        return isEqual((p2.y - p1.y) * (p3.x - p2.x), (p3.y - p2.y) * (p2.x - p1.x));
    }
}
