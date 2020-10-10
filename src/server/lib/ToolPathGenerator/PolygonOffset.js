import isArray from 'lodash/isArray';

import * as martinez from 'martinez-polygon-clipping';


const equals = (p1, p2) => {
    return p1[0] === p2[0] && p1[1] === p2[1];
};

class Edge {
    constructor(current, next) {
        this.current = current;
        this.next = next;
        this._inNormal = this.inwardsNormal();
        this._outNormal = this.outwardsNormal();
    }

    inwardsNormal() {
        const dx = this.next[0] - this.current[0],
            dy = this.next[1] - this.current[1],
            edgeLength = Math.sqrt(dx * dx + dy * dy);

        if (edgeLength === 0) throw new Error('Vertices overlap');

        return [
            -dy / edgeLength,
            dx / edgeLength
        ];
    }

    outwardsNormal() {
        const inwards = this.inwardsNormal();
        return [
            -inwards[0],
            -inwards[1]
        ];
    }

    offset(dx, dy) {
        return Edge.offsetEdge(this.current, this.next, dx, dy);
    }

    inverseOffset(dx, dy) {
        return Edge.offsetEdge(this.next, this.current, dx, dy);
    }

    static offsetEdge(current, next, dx, dy) {
        return new Edge([
            current[0] + dx,
            current[1] + dy
        ], [
            next[0] + dx,
            next[1] + dy
        ]);
    }
}


class PolygonOffset {
    vertices = [];

    _edges = [];

    _distance = 0;

    _arcSegments = 5;

    constructor(vertices) {
        if (vertices) {
            if (!isArray(vertices) || !isArray(vertices[0]) || typeof vertices[0][0] !== 'number') {
                throw new Error('Cannot construct PolygonOffset because vertices is error');
            }
            this.vertices = this._preProcessVertices(vertices);
            this._orientRings(this.vertices);
            this._processContour();
        }
    }

    union(poly1, poly2) {
        const result = martinez.union(poly1, poly2);
        for (let i = 0; i < result.length; i++) {
            const polys = result[i];
            for (let j = 0; j < polys.length; j++) {
                this._orientRings(polys[j], j % 2 === 0);
            }
        }
        return result;
    }

    ext(dist) {
        if (!dist || dist < 0) {
            throw new Error('Cannot apply negative margin to the line');
        }
        if (dist === 0) {
            return this.vertices;
        }
        this._setDistance(dist);
        if (this.vertices.length === 1) {
            return this._orientRings([this.offsetPoint()]);
        } else {
            const lines = this.offsetLines();
            const result = lines[0];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                for (const lineElement of line) {
                    result.push(lineElement);
                }
            }
            return result;
        }
    }

    offset(dist) {
        if (!dist || dist === 0) {
            return this.vertices;
        } else {
            return dist > 0 ? this.margin(dist) : this.padding(-dist);
        }
    }

    margin(dist, order) {
        if (!dist || dist < 0) {
            throw new Error('Cannot apply negative margin to the line');
        }
        if (dist === 0) {
            return this.vertices;
        }
        this._setDistance(dist);

        if (this.vertices.length === 1) {
            return this._orientRings([this.offsetPoint()]);
        } else {
            let union = this.offsetLines();
            if (this.vertices.length > 1 && equals(this.vertices[0], this.vertices[this.vertices.length - 1])) {
                union = martinez.union([[this.vertices]], union);
            }
            return this._orientRings(union[0], order);
        }
    }

    padding(dist, order) {
        if (!dist || dist < 0) {
            throw new Error('Cannot apply negative padding to the line');
        }
        if (dist === 0) {
            return [this._ensureLastPoint(this.vertices)];
        }
        this._setDistance(dist);

        if (this.vertices.length <= 3) {
            return [[]];
        }

        const union = this.offsetLines(this._distance);
        const diff = martinez.diff(this.margin(dist), union);
        return this._orientRings(diff[0], order);
    }

    _setDistance(dist) {
        this._distance = dist || 0;
    }

    _preProcessVertices(vertices) {
        const newVertices = [];
        newVertices.push(vertices[0]);
        for (let i = 1; i < vertices.length; i++) {
            if (!equals(newVertices[newVertices.length - 1], vertices[i])) {
                newVertices.push(vertices[i]);
            }
        }
        return newVertices;
    }

    _orientRings(vertices, order = true) {
        if (!isArray(vertices) || vertices.length === 0 || !isArray(vertices[0])) {
            return [[]];
        }
        if (typeof vertices[0][0] === 'number') {
            let area = 0;
            const ring = vertices;

            for (let i = 0, len = ring.length; i < len; i++) {
                const pt1 = ring[i];
                const pt2 = ring[(i + 1) % len];
                area += pt1[0] * pt2[1];
                area -= pt2[0] * pt1[1];
            }
            if (order) {
                if (area > 0) {
                    ring.reverse();
                }
            } else {
                if (area < 0) {
                    ring.reverse();
                }
            }
        } else {
            for (let i = 0; i < vertices.length; i++) {
                this._orientRings(vertices[i], order);
            }
        }

        return vertices;
    }

    _processContour() {
        const contour = this.vertices;
        let len = contour.length;
        if (equals(this.vertices[0], this.vertices[len - 1])) {
            len -= 1; // otherwise we get division by zero in normals
        }
        for (let i = 0; i < len; i++) {
            this._edges.push(new Edge(contour[i], contour[(i + 1) % len]));
        }
    }

    offsetLines() {
        const unions = [];
        for (let i = 0, len = this.vertices.length - 1; i < len; i++) {
            const segment = this._ensureLastPoint(this._offsetSegment(this.vertices[i], this.vertices[i + 1], this._edges[i], this._distance));
            unions.push([[segment]]);
        }
        return PolygonOffset.recursiveUnion(unions);
    }


    static recursiveUnion(array) {
        if (array.length === 1) {
            return array[0];
        }
        const len = Math.ceil(array.length / 2);
        const newArr = [];
        for (let i = 0; i < len; i++) {
            const union = martinez.union(array[i], array[array.length - 1 - i]);
            newArr.push(union);
        }
        return this.recursiveUnion(newArr);
    }

    offsetPoint() {
        let verticesLen = this._arcSegments * 2;
        const points = [];
        const center = this.vertices[0];
        const radius = this._distance;
        let angle = 0;

        if (verticesLen % 2 === 0) {
            verticesLen++;
        }

        for (let i = 0; i < verticesLen; i++) {
            angle += (2 * Math.PI / verticesLen); // counter-clockwise
            points.push([center[0] + (radius * Math.cos(angle)), center[1] + (radius * Math.sin(angle))]);
        }

        return this._ensureLastPoint(points);
    }

    _offsetSegment(v1, v2, e1, dist) {
        const vertices = [];
        const offsets = [
            e1.offset(e1._inNormal[0] * dist, e1._inNormal[1] * dist),
            e1.inverseOffset(e1._outNormal[0] * dist, e1._outNormal[1] * dist)
        ];

        for (let i = 0, len = 2; i < len; i++) {
            const thisEdge = offsets[i],
                prevEdge = offsets[(i + len - 1) % len];
            this.createArc(
                vertices,
                i === 0 ? v1 : v2, // edges[i].current, // p1 or p2
                dist,
                prevEdge.next,
                thisEdge.current,
                this._arcSegments,
                true
            );
        }

        return vertices;
    }

    createArc(vertices, center, radius, startVertex,
        endVertex, segments, outwards) {
        const PI2 = Math.PI * 2;
        let startAngle = Math.atan2(startVertex[1] - center[1], startVertex[0] - center[0]);
        let endAngle = Math.atan2(endVertex[1] - center[1], endVertex[0] - center[0]);

        // odd number please
        if (segments % 2 === 0) {
            segments -= 1;
        }

        if (startAngle < 0) {
            startAngle += PI2;
        }

        if (endAngle < 0) {
            endAngle += PI2;
        }

        let angle = ((startAngle > endAngle)
            ? (startAngle - endAngle)
            : (startAngle + PI2 - endAngle));
        const segmentAngle = ((outwards) ? -angle : PI2 - angle) / segments;

        vertices.push(startVertex);
        for (let i = 1; i < segments; ++i) {
            angle = startAngle + segmentAngle * i;
            vertices.push([
                center[0] + Math.cos(angle) * radius,
                center[1] + Math.sin(angle) * radius
            ]);
        }
        vertices.push(endVertex);
        return vertices;
    }

    _ensureLastPoint(vertices) {
        if (!equals(vertices[0], vertices[vertices.length - 1])) {
            vertices.push([
                vertices[0][0],
                vertices[0][1]
            ]);
        }
        return vertices;
    }
}

export default PolygonOffset;
