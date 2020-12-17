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

    unshift(p) {
        this.path.unshift(p);
    }

    get(i) {
        return this.path[i];
    }

    pop() {
        this.path.pop();
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

    clone() {
        const polygon = new Polygon();
        polygon.path = this.path.map(v => { return { x: v.x, y: v.y }; });
        return polygon;
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

    isPointInPolygon(point) {
        let inside = false;
        for (let i = 0, len = this.path.length - 1; i < len; i++) {
            const p = this.path[i];
            const q = this.path[i + 1];

            if ((p.y > point.y) !== (q.y > point.y)
                && point.x < p.x + (q.x - p.x) * (point.y - p.y) / (q.y - p.y)) {
                inside = !inside;
            }
        }
        return inside;
    }
}

export class Polygons {
    data = [];

    size() {
        return this.data.length;
    }

    add(polygon) {
        this.data.push(polygon);
    }

    addPolygons(polygons) {
        for (const polygon of polygons.data) {
            this.add(polygon);
        }
    }

    get(i) {
        return this.data[i];
    }

    forEach(callback) {
        for (let i = 0; i < this.data.length; i++) {
            callback(this.data[i], i, this.data);
        }
    }

    /**
     * Removes vertices of the polygons to make sure that they are not too high
     */
    simplify(smallestLineSegment = 0.08, allowedErrorDistance = 0.04) {
        const smallestLineSegmentSquared = smallestLineSegment * smallestLineSegment;
        const allowedErrorDistanceSquared = allowedErrorDistance * allowedErrorDistance;

        let i = 0;
        while (i < this.data.length) {
            const polygon = this.data[i];
            polygon.simplify(smallestLineSegmentSquared, allowedErrorDistanceSquared);
            if (polygon.size() <= 2) {
                this.data.splice(i, 1);
            } else {
                i++;
            }
        }
    }

    removeDegenerateVerts() {
        for (let polyIdx = 0; polyIdx < this.data.length; polyIdx++) {
            const polygon = this.data[polyIdx];
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
                    this.data[polyIdx] = result;
                } else {
                    this.data.splice(polyIdx, 1);
                    polyIdx--; // effectively the next iteration has the same poly_idx (referring to a new poly which is not yet processed)
                }
            }
        }

        this.close();
    }

    close() {
        for (const polygon of this.data) {
            polygon.close();
        }
    }


    convexHull() {
        const newPath = [];

        let first = this.data[0].path[0];

        this.data.forEach((polygon) => {
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
        for (const polygon of this.data) {
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

    splitIntoParts() {
        const polygonsPart = this.union();
        polygonsPart.simplify();
        polygonsPart.removeDegenerateVerts();
        return polygonsPart;
    }

    diff(polygons) {
        let diffPolygonArrays = [];
        for (const polygon of this.data) {
            diffPolygonArrays.push([polygon.path.map(v => [v.x, v.y])]);
        }
        for (const polygon of polygons.data) {
            const polygonPathArray = polygon.path.map(v => [v.x, v.y]);
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

    union(polygons, test = false) {
        const polygonOffsetPaths = [];
        for (const polygon of this.data) {
            polygonOffsetPaths.push([[polygon.path.map(v => [v.x, v.y])]]);
        }
        if (polygons && polygons.size() > 0) {
            for (const polygon of polygons.data) {
                polygonOffsetPaths.push([[polygon.path.map(v => [v.x, v.y])]]);
            }
        }
        const result = PolygonOffset.recursiveUnion(polygonOffsetPaths, test);
        const unionPolygons = new Polygons();
        for (const paths of result) {
            const polygonPart = new Polygon();
            for (const pathElement of paths[0]) {
                polygonPart.add({ x: pathElement[0], y: pathElement[1] });
            }
            unionPolygons.add(polygonPart);
        }
        return unionPolygons;
    }

    intersection(polygons) {
        let intersectionPolygonArrays = [];
        for (const polygon of this.data) {
            intersectionPolygonArrays.push([polygon.path.map(v => [v.x, v.y])]);
        }
        const polygonPathArrays = [];
        for (let i = 0; i < polygons.size(); i++) {
            const polygonPathArray = polygons.get(i).path.map(v => [v.x, v.y]);
            polygonPathArrays.push(polygonPathArray);
        }
        intersectionPolygonArrays = martinez.intersection(intersectionPolygonArrays, [polygonPathArrays]);

        const intersectionPolygons = new Polygons();
        if (intersectionPolygonArrays) {
            for (const intersectionPolygonArray of intersectionPolygonArrays) {
                for (const intersectionPolygon of intersectionPolygonArray) {
                    const polygon = new Polygon();
                    for (const point of intersectionPolygon) {
                        polygon.add({ x: point[0], y: point[1] });
                    }
                    intersectionPolygons.add(polygon);
                }
            }
        }
        return intersectionPolygons;
    }

    padding(offset) {
        const resultPolygons = new Polygons();
        for (const polygon of this.data) {
            const polygonArray = polygon.path.map(v => [v.x, v.y]);
            const result = new PolygonOffset(polygonArray).padding(offset);
            const resultPolygon = new Polygon();
            if (result && result.length > 0 && result[0].length > 0) {
                for (const point of result[0]) {
                    resultPolygon.add({ x: point[0], y: point[1] });
                }
                resultPolygons.add(resultPolygon);
            }
        }
        return resultPolygons;
    }

    rotate(angle) {
        this.data.forEach(polygon => {
            polygon.forEach(point => {
                const { x, y } = Vector2.rotate(point, angle);
                point.x = x;
                point.y = y;
            });
        });
    }

    clone() {
        const polygons = new Polygons();
        polygons.data = this.data.map(v => v.clone());
        return polygons;
    }
}
