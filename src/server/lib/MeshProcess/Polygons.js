import * as martinez from 'martinez-polygon-clipping';
import { Vector2 } from '../../../shared/lib/math/Vector2';

import { isEqual } from '../../../shared/lib/utils';
import PolygonOffset from '../ToolPathGenerator/PolygonOffset';

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

export class Polygon {
    path = [];

    add(p) {
        this.path.push(p);
    }

    get(i) {
        return this.path[i];
    }

    size() {
        return this.path.length;
    }

    back() {
        return this.path[this.path.length - 1];
    }

    close() {
        if (this.path && this.path.length > 0) {
            const p1 = this.path[0];
            const p2 = this.path[this.path.length - 1];
            if (!Vector2.isEqual(p1, p2)) {
                this.path.push(p1);
            }
        }
    }

    forEach(callback) {
        for (let i = 0; i < this.path.length; i++) {
            callback(this.path[i], i, this.path);
        }
    }

    forEachLine(callback) {
        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];
            callback(p1, p2, i, this.path);
        }
    }

    simplify(smallestLineSegmentSquared, allowedErrorDistanceSquared) {
        if (this.path.length < 3) {
            this.path.splice(0);
            return;
        }
        if (this.path.length === 3) {
            return;
        }
        const newPath = [];
        let previous = this.path[0];
        let current = this.path[1];
        let accumulatedAreaRemoved = previous.x * current.y - previous.y * current.x;

        for (let i = 1; i <= this.path.length; i++) {
            current = this.path[i % this.path.length];

            const length2 = Vector2.length2(Vector2.sub(current, previous));

            let next;
            if (i + 1 < this.path.length) {
                next = this.path[i + 1];
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
            && Vector2.length2(Vector2.sub(newPath[newPath.length - 1], this.path[0])) >= smallestLineSegmentSquared
            && Vector2.length2(Vector2.sub(newPath[0] - this.path[0])) >= smallestLineSegmentSquared) {
            newPath.push(this.path[0]);
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

        this.path.splice(0);
        for (const newPathElement of newPath) {
            this.path.push(newPathElement);
        }
    }

    area(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            area += p1.x * p2.y - p1.y * p2.x;
        }
        return area;
    }

    orientRings() {
        if (this.area(this.path) < 0) {
            this.path.reverse();
        }
    }

    convexHull() {
        if (Vector2.isEqual(this.path[0], this.path[this.path.length - 1])) {
            this.path.pop();
        }

        this.orientRings();

        const isConcave = [];
        const len = this.path.length;
        let pre = 0;
        let cur = 1;
        let next = 2;
        let count = 0;
        let isUpdate = true;
        while (isUpdate) {
            for (let i = 1; i < len; i++) {
                pre = (cur - i + len) % len;
                if (!isConcave[pre]) {
                    break;
                }
            }
            for (let i = 1; i < len; i++) {
                next = (cur + i) % len;
                if (!isConcave[next]) {
                    break;
                }
            }
            const p1 = this.path[pre];
            const p2 = this.path[cur];
            const p3 = this.path[next];
            if (this.area([p1, p2, p3]) > 0) {
                count++;
            } else {
                isConcave[cur] = true;
                count = 0;
            }
            cur = next;
            if (count >= len) {
                isUpdate = false;
            }
        }
        const newPath = [];
        for (let i = 0; i < this.path.length; i++) {
            if (!isConcave[i]) {
                newPath.push(this.path[i]);
            }
        }
        this.path = newPath;
        this.close();
    }
}

export class Polygons {
    polygons = [];

    add(polygon) {
        this.polygons.push(polygon);
    }

    forEach(callback) {
        for (let i = 0; i < this.polygons.length; i++) {
            callback(this.polygons[i], i, this.polygons);
        }
    }

    /**
     * Removes vertices of the polygons to make sure that they are not too high
     */
    simplify(smallestLineSegment = 0.05, allowedErrorDistance = 0.025) {
        const smallestLineSegmentSquared = smallestLineSegment * smallestLineSegment;
        const allowedErrorDistanceSquared = allowedErrorDistance * allowedErrorDistance;

        for (const polygon of this.polygons) {
            polygon.simplify(smallestLineSegmentSquared, allowedErrorDistanceSquared);
        }
    }

    removeDegenerateVerts() {
        for (let polyIdx = 0; polyIdx < this.polygons.length; polyIdx++) {
            const polygon = this.polygons[polyIdx];
            const result = new Polygon();
            const isDegenerate = function (last, now, next) {
                const lastLine = Vector2.sub(now, last);
                const nextLine = Vector2.sub(next, now);
                return isEqual(Vector2.dot(lastLine, nextLine), -1 * Vector2.length(lastLine) * Vector2.length(nextLine));
            };

            let isChanged = false;
            for (let i = 0; i < polygon.path.length; i++) {
                const last = (result.size() === 0) ? polygon.back() : result.back();
                if (i + 1 === polygon.size() && result.size() === 0) {
                    break;
                }
                const next = (i + 1 === polygon.size()) ? result.path[0] : polygon.path[i + 1];
                if (isDegenerate(last, polygon.path[i], next)) {
                    isChanged = true;
                    while (result.size() > 1 && isDegenerate(result.path[result.size() - 2], result.back(), next)) {
                        result.path.pop();
                    }
                } else {
                    result.add(polygon.path[i]);
                }
            }


            if (isChanged) {
                if (result.size() > 2) {
                    this.polygons[polyIdx] = result;
                } else {
                    this.polygons.splice(polyIdx, 1);
                    polyIdx--; // effectively the next iteration has the same poly_idx (referring to a new poly which is not yet processed)
                }
            }
        }

        this.close();
    }

    close() {
        for (const polygon of this.polygons) {
            polygon.close();
        }
    }

    splitIntoParts() {
        const polygonOffsetPaths = [];
        for (const polygon of this.polygons) {
            polygonOffsetPaths.push([[polygon.path.map(v => [v.x, v.y])]]);
        }
        const result = PolygonOffset.recursiveUnion(polygonOffsetPaths);
        const polygonsParts = new Polygons();
        for (const paths of result) {
            const polygonPart = new Polygon();
            for (const pathElement of paths[0]) {
                polygonPart.add({ x: pathElement[0], y: pathElement[1] });
            }
            polygonsParts.add(polygonPart);
        }
        return polygonsParts;
    }


    convexHull() {
        const newPath = [];

        let first = this.polygons[0].path[0];

        this.polygons.forEach((polygon) => {
            polygon.forEach((point) => {
                if (point.y < first.y) {
                    first = point;
                } else if (point.y === first.y && point.x < first.x) {
                    first = point;
                }
            });
        });

        newPath.push({
            x: first.x,
            y: first.y,
            angle: 0,
            line: 0
        });
        for (const polygon of this.polygons) {
            for (const point of polygon.path) {
                const v = Vector2.sub(point, first);
                const angle = Vector2.angle(v) % 360;
                const line = Vector2.length2(v);
                newPath.push({
                    x: point.x,
                    y: point.y,
                    angle: angle,
                    line: line
                });
            }
        }
        newPath.sort((a, b) => {
            if (a.angle > b.angle) {
                return 1;
            } else if (a.angle < b.angle) {
                return -1;
            } else {
                if (a.line > b.line) {
                    return 1;
                } else if (a.line < b.line) {
                    return -1;
                } else {
                    return 0;
                }
            }
        });
        const polygon = new Polygon();
        for (const newPathElement of newPath) {
            polygon.add({ x: newPathElement.x, y: newPathElement.y });
        }
        polygon.convexHull();

        const polygons = new Polygons();
        polygons.add(polygon);

        return polygons;
    }

    diffPolygons(polygons) {
        let diffPolygonArrays = [];
        for (const polygon of this.polygons) {
            diffPolygonArrays.push([polygon.path.map(v => [v.x, v.y])]);
        }
        for (let i = 0; i < polygons.length; i++) {
            const polygonPathArray = polygons[i].path.map(v => [v.x, v.y]);
            diffPolygonArrays = martinez.diff(diffPolygonArrays, [[polygonPathArray]]);
        }
        const diffPolygons = new Polygons();
        for (const diffPolygonArray of diffPolygonArrays) {
            for (const diffPolygon of diffPolygonArray) {
                const polygon = new Polygon();
                for (const point of diffPolygon) {
                    polygon.add({ x: point[0], y: point[1] });
                }
                diffPolygons.add(polygon);
            }
        }
        return diffPolygons;
    }
}
