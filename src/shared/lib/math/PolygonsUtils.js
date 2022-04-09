import { Vector2 } from './Vector2';
import { Line, TYPE_SEGMENT } from './Line';

export class PolygonUtils {
    static rotate(polygon, angle, center = { x: 0, y: 0 }) {
        const resPolygon = [];
        for (let i = 0; i < polygon.length; i++) {
            const p = Vector2.rotate(polygon[i], angle, center);
            resPolygon.push(p);
        }
        return resPolygon;
    }

    static move(polygon, offset = { x: 0, y: 0 }) {
        const resPolygon = [];
        for (let i = 0; i < polygon.length; i++) {
            const p = Vector2.add(polygon[i], offset);
            resPolygon.push(p);
        }
        return resPolygon;
    }

    static center(polygon) {
        let x = 0;
        let y = 0;
        const count = Vector2.isEqual(polygon[0], polygon[polygon.length - 1]) ? polygon.length - 1 : polygon.length;
        for (let i = 0; i < count; i++) {
            x += polygon[i].x;
            y += polygon[i].y;
        }
        return {
            x: x / count,
            y: y / count
        };
    }

    static area(polygon) {
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            area += p1.x * p2.y - p1.y * p2.x;
        }
        return area / 2;
    }

    static sort(polygon, clockwise) {
        const area = this.area(polygon);
        if (clockwise && area > 0) {
            polygon.reverse();
        }
        if (!clockwise && area < 0) {
            polygon.reverse();
        }
    }

    static isPointInPolygon(point, polygon, isOnLine = false) {
        let inside = false;
        const x = point.x;
        const y = point.y;
        for (let i = 0; i < polygon.length - 1; i++) {
            const p = polygon[i];
            const q = polygon[i + 1];

            if (isOnLine) {
                if (Line.pointInLine2(point, p, q, TYPE_SEGMENT)) {
                    return true;
                }
            }

            if ((p.y > y) !== (q.y > y) && x < p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y)) {
                inside = !inside;
            }
        }
        return inside;
    }

    static getBox(polygon) {
        if (!polygon || polygon.length === 0) {
            return null;
        }
        const box = {
            max: {
                x: polygon[0].x,
                y: polygon[0].y
            },
            min: {
                x: polygon[0].x,
                y: polygon[0].y
            }
        };
        for (let i = 0; i < polygon.length; i++) {
            box.max.x = Math.max(box.max.x, polygon[i].x);
            box.max.y = Math.max(box.max.y, polygon[i].y);

            box.min.x = Math.min(box.min.x, polygon[i].x);
            box.min.y = Math.min(box.min.y, polygon[i].y);
        }
        return box;
    }

    static printArrows(polygons) {
        let s = '[';
        for (let i = 0; i < polygons.length; i++) {
            s += '[';
            for (let j = 0; j < polygons[i].length; j++) {
                const p = polygons[i][j];
                s += `${p.x},${p.y}`;
                if (j !== polygons[i].length - 1) {
                    s += ',';
                }
            }
            s += ']';
            if (i !== polygons.length - 1) {
                s += ',';
            }
        }
        s += ']';

        console.log(s);
    }

    static printTraceRings(traceRings) {
        const resTraceLines = [];
        for (let i = 0; i < traceRings.length; i++) {
            for (let j = 0; j < traceRings[i].length; j++) {
                resTraceLines.push(traceRings[i][j]);
            }
        }
        this.printTraceLines(resTraceLines);
    }

    static printTraceLines(traceLines) {
        let s = '[';
        for (let i = 0; i < traceLines.length; i++) {
            const traceLine = traceLines[i];
            s += '[';
            s += `${traceLine.sp.x},${traceLine.sp.y},${traceLine.ep.x},${traceLine.ep.y}`;
            s += ']';

            if (i !== traceLines.length - 1) {
                s += ',';
            }
        }
        s += ']';

        console.log(s);
    }

    // algorithm: douglasPeucker
    static simplify = (polygon, limit) => {
        if (!polygon || polygon.length < 3) {
            return polygon;
        }

        // polygon = polygon.map((v, i) => {
        //     v.i = i;
        //     return v;
        // });

        const compressLine = (poly, start, end) => {
            const res = [];
            if (start < end) {
                let maxDist = 0;
                let idx = 0;
                const startPoint = poly[start];
                const endPoint = poly[end];

                for (let i = start + 1; i < end; i++) {
                    const currentDist = Line.pointDistance(poly[i], startPoint, endPoint);
                    if (currentDist > maxDist) {
                        maxDist = currentDist;
                        idx = i;
                    }
                }
                if (maxDist >= limit) {
                    const res1 = compressLine(poly, start, idx);
                    const res2 = compressLine(poly, idx, end);
                    for (let i = 0; i < res1.length - 1; i++) {
                        res.push(res1[i]);
                    }
                    for (let i = 0; i < res2.length; i++) {
                        res.push(res2[i]);
                    }
                } else {
                    res.push(poly[start]);
                    res.push(poly[end]);
                }
            }
            return res;
        };

        const result = compressLine(polygon, 0, polygon.length - 2);
        result.push(polygon[polygon.length - 1]);

        return result;
    };
}

export class PolygonsUtils {
    static rotate(polygons, angle, center = { x: 0, y: 0 }) {
        return polygons.map(polygon => PolygonUtils.rotate(polygon, angle, center));
    }

    static move(polygons, offset = { x: 0, y: 0 }) {
        return polygons.map(polygon => PolygonUtils.move(polygon, offset));
    }

    static sort(polygons, clockwise) {
        for (let i = 0; i < polygons.length; i++) {
            PolygonUtils.sort(polygons[i], clockwise);
            clockwise = !clockwise;
        }
    }

    static simplify(polygons, limit) {
        return polygons.map(polygon => PolygonUtils.simplify(polygon, limit));
    }
}
