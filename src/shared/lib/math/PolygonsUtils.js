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

function getDist2FromLine(p, a, b) {
    const vba = Vector2.sub(b, a);
    const vpa = Vector2.sub(p, a);

    const baSize2 = Vector2.length2(vba);
    const paSize2 = Vector2.length2(vpa);
    if (baSize2 === 0) {
        return paSize2;
    }
    const dot = Vector2.dot(vba, vpa);
    const axSize2 = dot * dot / Vector2.length2(vba);
    const pxSize2 = Math.max(0, paSize2 - axSize2);
    return pxSize2;
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

    static simplify2(polygons, smallestLineSegmentSquared, allowedErrorDistanceSquared) {
        if (polygons.length < 3) {
            polygons.splice(0);
            return [];
        }
        if (polygons.length === 3) {
            return [];
        }
        const newPath = [];
        let previous = polygons[0];
        let current = polygons[1];
        let accumulatedAreaRemoved = previous.x * current.y - previous.y * current.x;

        for (let i = 1; i <= polygons.length; i++) {
            current = polygons[i % polygons.length];

            const length2 = Vector2.length2(Vector2.sub(current, previous));

            let next;
            if (i + 1 < polygons.length) {
                next = polygons[i + 1];
            } else if (newPath.length > 0) {
                next = newPath[0];
            } else {
                break;
            }

            accumulatedAreaRemoved += current.x * next.y - current.y * next.x;

            const areaRemovedSoFar = accumulatedAreaRemoved + next.x * previous.y - next.y * previous.x;
            const baseLength2 = Vector2.length2(Vector2.sub(next, previous));
            if (baseLength2 === 0) { // Two line segments form a line back and forth with no area.
                continue; // Remove the vertex.
            }

            const height2 = (4 * areaRemovedSoFar * areaRemovedSoFar) / baseLength2;
            if (length2 < smallestLineSegmentSquared && height2 <= allowedErrorDistanceSquared) { // Line is small and removing it doesn't introduce too much error.
                continue; // Remove the vertex.
            } else if (length2 >= smallestLineSegmentSquared && newPath.length > 2
                && (Vector2.length2(Vector2.sub(newPath[newPath.length - 2], newPath[newPath.length - 1])) === 0
                    || getDist2FromLine(current, newPath[newPath.length - 2], newPath[newPath.length - 1]) <= allowedErrorDistanceSquared)) {
                newPath.pop();
            }

            accumulatedAreaRemoved = current.x * next.y - current.y * next.x;
            previous = current; // Note that "previous" is only updated if we don't remove the vertex.
            newPath.push(current);
        }

        if (!(newPath.length === 0) && Vector2.length2(Vector2.sub(newPath[newPath.length - 1], newPath[0])) > smallestLineSegmentSquared
            && Vector2.length2(Vector2.sub(newPath[newPath.length - 1], polygons[0])) >= smallestLineSegmentSquared
            && Vector2.length2(Vector2.sub(newPath[0] - polygons[0])) >= smallestLineSegmentSquared) {
            newPath.push(polygons[0]);
        }
        if (newPath.length > 2 && (Vector2.length2(Vector2.sub(newPath[newPath.length - 1], newPath[0])) < smallestLineSegmentSquared || Vector2.length2(Vector2.sub(newPath[newPath.length - 1], newPath[newPath.length - 2])) < smallestLineSegmentSquared)) {
            if (getDist2FromLine(newPath[newPath.length - 1], newPath[newPath.length - 2], newPath[0]) < allowedErrorDistanceSquared) {
                newPath.pop();
            }
        }
        for (let i = 0; i < 2; i++) { // For the first two points we haven't checked yet if they are almost exactly straight.
            if (newPath.length > 2 && getDist2FromLine(newPath[0], newPath[newPath.length - 1], newPath[1]) <= allowedErrorDistanceSquared) {
                newPath.splice(0, 1);
            }
        }
        return newPath;
    }
}
