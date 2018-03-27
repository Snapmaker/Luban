/**
 * Wrapper for polygon-offset (bugfix).
 */
import Offset from 'polygon-offset';
import isArray from 'lodash/isArray';

var martinez = require('martinez-polygon-clipping');


const orientRings = function orientRings(coordinates, depth, isHole) {
    depth = depth || 0;
    var i, len;
    if (!isArray(coordinates) || !isArray(coordinates[0])) {
        return [];
    }
    if (isArray(coordinates) && typeof coordinates[0][0] === 'number') {
        var area = 0;
        var ring = coordinates;

        for (i = 0, len = ring.length; i < len; i++) {
            var pt1 = ring[i];
            var pt2 = ring[(i + 1) % len];
            area += pt1[0] * pt2[1];
            area -= pt2[0] * pt1[1];
        }
        if ((!isHole && area > 0) || (isHole && area < 0)) {
            ring.reverse();
        }
    } else {
        // for (i = 0, len = coordinates.length; i < len; i++) {
        //     orientRings(coordinates[i], depth + 1, i > 0);
        // }
    }

    return coordinates;
};

/**
 * @param  {Number} dist
 * @return {Array.<Number>}
 */
Offset.prototype.margin = function (dist) {
    this.distance(dist);

    if (typeof this.vertices[0] === 'number') { // point
        return this.offsetPoint(this._distance);
    }

    if (dist === 0) {
        return this.vertices;
    }

    var union = this.offsetLines(this._distance);
    union = martinez.union([this.vertices], union);
    return orientRings(union);
};


/**
 * @param  {Number} dist
 * @return {Array.<Number>}
 */
Offset.prototype.padding = function (dist) {
    this.distance(dist);

    if (this._distance === 0) {
        return this.ensureLastPoint(this.vertices);
    }
    if (this.vertices.length === 2 && typeof this.vertices[0] === 'number') {
        return this.vertices;
    }

    var union = this.offsetLines(this._distance);
    var diff = martinez.diff([this.vertices], union);
    return orientRings(diff);
};


/**
 * Creates margin polygon
 * @param  {Number} dist
 * @return {Array.<Object>}
 */
Offset.prototype.offsetLine = function (dist) {
    if (dist === 0) {
        return this.vertices;
    }
    return orientRings(this.offsetLines(dist));
};


/**
 * Just offsets lines, no fill
 * @param  {Number} dist
 * @return {Array.<Array.<Array.<Number>>>}
 */
Offset.prototype.offsetLines = function (dist) {
    if (dist < 0) {
        throw new Error('Cannot apply negative margin to the line');
    }
    var union;
    this.distance(dist);
    if (isArray(this.vertices[0]) && typeof this.vertices[0][0] !== 'number') {
        for (var i = 0, len = this._edges.length; i < len; i++) {
            union = (i === 0)
                ? this.offsetContour(this.vertices[i], this._edges[i])
                : martinez.union(union, this.offsetContour(this.vertices[i], this._edges[i]));
        }
    } else {
        union = (this.vertices.length === 1) ? this.offsetPoint(dist) : this.offsetContour(this.vertices, this._edges);
    }

    return union;
};


/**
 * @param  {Array.<Array.<Number>>|Array.<Array.<...>>} curve
 * @param  {Array.<Edge>|Array.<Array.<...>>} edges
 * @return {Polygon}
 */
Offset.prototype.offsetContour = function (curve, edges) {
    var union, i, len;
    if (isArray(curve[0]) && typeof curve[0][0] === 'number') {
        // we have 1 less edge than vertices
        for (i = 0, len = curve.length - 1; i < len; i++) {
            var segment = this.ensureLastPoint(this._offsetSegment(curve[i], curve[i + 1], edges[i], this._distance));
            union = (i === 0) ? [this.ensureLastPoint(segment)] : martinez.union(union, this.ensureLastPoint(segment));
        }
    } else {
        for (i = 0, len = edges.length; i < len; i++) {
            union = (i === 0) ? this.offsetContour(curve[i], edges[i]) : martinez.union(union, this.offsetContour(curve[i], edges[i]));
        }
    }
    return union;
};


/**
 * @param  {Number} distance
 * @return {Array.<Array.<Number>}
 */
Offset.prototype.offsetPoint = function (distance) {
    this.distance(distance);
    var vertices = this._arcSegments * 2;
    var points = [];
    var center = this.vertices[0];
    var radius = this._distance;
    var angle = 0;

    if (vertices % 2 === 0) {
        vertices++;
    }

    for (var i = 0; i < vertices; i++) {
        angle += (2 * Math.PI / vertices); // counter-clockwise
        points.push([center[0] + (radius * Math.cos(angle)), center[1] + (radius * Math.sin(angle))]);
    }

    return orientRings([this.ensureLastPoint(points)]);
};


export default Offset;
