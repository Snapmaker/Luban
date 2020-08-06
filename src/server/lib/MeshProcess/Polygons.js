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
        if (this.path) {
            const p1 = this.path[0];
            const p2 = this.path[this.path.length - 1];
            if (!Vector2.isEqual(p1, p2)) {
                this.path.push(p1);
            }
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
                    || getDist2FromLine(current, newPath[newPath.length - 2], newPath[newPath.length - 1]) <= 25)) {
                newPath.pop();
            }

            accumulatedAreaRemoved = current.x * next.y - current.y * next.x;
            previous = current; // Note that "previous" is only updated if we don't remove the vertex.
            newPath.push(current);
        }

        if (!(newPath.length === 0) && Vector2.vSize2(Vector2.sub(newPath[newPath.length - 1], newPath[0])) > smallestLineSegmentSquared
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
            if (newPath.length > 2 && getDist2FromLine(newPath[0], newPath[newPath.length - 1], newPath[1]) <= 25) {
                newPath.splice(0, 1);
            }
        }

        this.path.splice(0);
        for (const newPathElement of newPath) {
            this.path.push(newPathElement);
        }
    }
}

export class Polygons {
    polygons = [];

    add(polygon) {
        this.polygons.push(polygon);
    }

    /**
     * Removes vertices of the polygons to make sure that they are not too high
     */
    simplify(smallestLineSegment = 0.01, allowedErrorDistance = 0.005) {
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
}
