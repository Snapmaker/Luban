import fs from 'fs';
import * as THREE from 'three';
import { isUndefined } from 'lodash';
import log from 'loglevel';
import DxfParser from './DxfParser';
import { svgInverse, svgToString } from '../SVGParser/SvgToString';
import bSpline from './bSpline';

// const EPSILON = 1e-6;
function angle2(p1, p2) {
    const v1 = new THREE.Vector2(p1.x, p1.y);
    const v2 = new THREE.Vector2(p2.x, p2.y);
    v2.sub(v1); // sets v2 to be our chord
    v2.normalize();
    if (v2.y < 0) return -Math.acos(v2.x);
    return Math.acos(v2.x);
}

function polar(point, distance, angle) {
    const result = {};
    result.x = point.x + distance * Math.cos(angle);
    result.y = point.y + distance * Math.sin(angle);
    return result;
}
function getBSplinePolyline(
    controlPoints,
    degree,
    knots,
    interpolationsPerSplineSegment,
    weights
) {
    const polyline = [];
    const controlPointsForLib = controlPoints.map((p) => {
        return [p.x, p.y];
    });

    const segmentTs = [knots[degree]];
    const domain = [knots[degree], knots[knots.length - 1 - degree]];

    for (let k = degree + 1; k < knots.length - degree; ++k) {
        if (segmentTs[segmentTs.length - 1] !== knots[k]) {
            segmentTs.push(knots[k]);
        }
    }

    interpolationsPerSplineSegment = interpolationsPerSplineSegment || 25;
    for (let i = 1; i < segmentTs.length; ++i) {
        const uMin = segmentTs[i - 1];
        const uMax = segmentTs[i];
        for (let k = 0; k <= interpolationsPerSplineSegment; ++k) {
            const u = (k / interpolationsPerSplineSegment) * (uMax - uMin) + uMin;
            // Clamp t to 0, 1 to handle numerical precision issues
            let t = (u - domain[0]) / (domain[1] - domain[0]);
            t = Math.max(t, 0);
            t = Math.min(t, 1);
            const p = bSpline(t, degree, controlPointsForLib, knots, weights);
            polyline.push(new THREE.Vector2(p[0], p[1]));
        }
    }
    return polyline;
}

function drawBezierCurve(controlPoints, degreeOfSplineCurve, knotValues) {
    let interpolatedPoints = [];
    const points = getBSplinePolyline(
        controlPoints,
        degreeOfSplineCurve,
        knotValues,
        100
    );
    const curve = new THREE.SplineCurve(points);
    interpolatedPoints = curve.getPoints(points.length);

    return interpolatedPoints;
}
function readFile(originalPath) {
    return new Promise((resolve, reject) => {
        fs.readFile(originalPath, 'utf8', async (err, fileText) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(fileText);
        });
    }).catch((err) => {
        log.error(err);
    });
}
function addInsertContent(entities, dxf, position = { x: 0, y: 0 }) {
    position = {
        x: position.x + entities.position.x,
        y: position.y + entities.position.y
    };
    const oldEntities = dxf.blocks[entities.name].entities;
    let newEntities;
    for (let i = 0; i < oldEntities.length; i++) {
        newEntities = JSON.parse(JSON.stringify(oldEntities[i]));
        if (
            oldEntities[i].type === 'LINE'
            || oldEntities[i].type === 'LWPOLYLINE'
            || oldEntities[i].type === 'POLYLINE'
        ) {
            newEntities.vertices.x += position.x;
            newEntities.vertices.y += position.y;
            dxf.entities.push(newEntities);
        } else if (oldEntities[i].type === 'SPLINE') {
            if (newEntities.fitPoints && newEntities.fitPoints.length > 0) {
                newEntities.fitPoints.map((item) => {
                    item.x += position.x;
                    item.y += position.y;
                    return item;
                });
            } else {
                newEntities.controlPoints.map((item) => {
                    item.x += position.x;
                    item.y += position.y;
                    return item;
                });
            }
            dxf.entities.push(newEntities);
        } else if (oldEntities[i].type === 'POINT') {
            newEntities.position.x += position.x;
            newEntities.position.y += position.y;
            dxf.entities.push(newEntities);
        } else if (
            oldEntities[i].type === 'ARC'
            || oldEntities[i].type === 'CIRCLE'
            || oldEntities[i].type === 'ELLIPSE'
        ) {
            newEntities.center.x += position.x;
            newEntities.center.y += position.y;
            dxf.entities.push(newEntities);
        } else if (oldEntities[i].type === 'INSERT') {
            addInsertContent(newEntities, dxf, position);
        }
    }
}

function BulgeGeometry(startPoint, endPoint, bulge, segments) {
    let vertex, i;
    THREE.Geometry.call(this);
    const p0 = startPoint
        ? new THREE.Vector2(startPoint.x, startPoint.y)
        : new THREE.Vector2(0, 0);
    const p1 = endPoint
        ? new THREE.Vector2(endPoint.x, endPoint.y)
        : new THREE.Vector2(1, 0);
    bulge = bulge || 1;
    this.startPoint = p0;
    this.endPoint = p1;
    this.bulge = bulge;

    const angle = 4 * Math.atan(bulge);
    const radius = p0.distanceTo(p1) / 2 / Math.sin(angle / 2);
    const center = polar(
        startPoint,
        radius,
        angle2(p0, p1) + (Math.PI / 2 - angle / 2)
    );

    if (segments !== undefined) {
        this.segments = segments;
    } else {
        this.segments = Math.max(
            Math.abs(Math.ceil(angle / (Math.PI / 36))),
            6
        ); // By default want a segment roughly every 5 degrees
    }

    const startAngle = angle2(center, p0);
    const thetaAngle = angle / this.segments;

    this.vertices.push(new THREE.Vector3(p0.x, p0.y, 0));

    for (i = 1; i <= this.segments - 1; i++) {
        vertex = polar(center, Math.abs(radius), startAngle + thetaAngle * i);

        this.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0));
    }
}

BulgeGeometry.prototype = Object.create(THREE.Geometry.prototype);

export const dxfToSvg = (dxf, strokeWidth = 0.72) => {
    const shapes = [];
    let res = {};
    for (const entities of dxf.entities) {
        if (
            dxf.tables
            && dxf.tables.layer
            && !isUndefined(dxf.tables.layer.layers[entities.layer].visible)
            && !dxf.tables.layer.layers[entities.layer].visible
        ) {
            continue;
        }

        const shape = {};
        shape.paths = [];
        const pathsObj = {};
        pathsObj.points = [];

        if (
            entities.type === 'LINE'
            || entities.type === 'POLYLINE'
            || entities.type === 'LWPOLYLINE'
        ) {
            pathsObj.points = [];
            pathsObj.closed = false;

            let vertex, startPoint, endPoint, bulgeGeometry, bulge, i;

            // create geometry
            for (i = 0; i < entities.vertices.length; i++) {
                if (entities.vertices[i].bulge) {
                    bulge = entities.vertices[i].bulge;
                    startPoint = entities.vertices[i];
                    endPoint = i + 1 < entities.vertices.length
                        ? entities.vertices[i + 1]
                        : entities.vertices[0];

                    bulgeGeometry = new BulgeGeometry(
                        startPoint,
                        endPoint,
                        bulge
                    );
                    bulgeGeometry.vertices.forEach((vertice) => {
                        pathsObj.points.push([vertice.x, vertice.y]);
                    });
                } else {
                    vertex = entities.vertices[i];
                    if (entities.extrusionDirection && entities.extrusionDirection.z === -1) {
                        pathsObj.points.push([-vertex.x, vertex.y]);
                    } else {
                        pathsObj.points.push([vertex.x, vertex.y]);
                    }
                }
            }

            if (entities.vertices.length > 2 && entities.shape === true) {
                pathsObj.points.push([
                    entities.vertices[0].x,
                    entities.vertices[0].y
                ]);
            }
            pathsObj.closed = false;
            shape.paths.push(pathsObj);
        } else if (entities.type === 'SPLINE') {
            let newControlPoints = [];
            newControlPoints = drawBezierCurve(
                entities.controlPoints,
                entities.degreeOfSplineCurve,
                entities.knotValues
            );
            entities.controlPoints = newControlPoints;

            pathsObj.points = [];
            entities.controlPoints.forEach((item) => {
                pathsObj.points.push([item.x, item.y]);
            });
            pathsObj.closed = entities.closed;
            if (pathsObj.closed) {
                pathsObj.points.push([
                    entities.controlPoints[0].x,
                    entities.controlPoints[0].y
                ]);
            }
            shape.paths.push(pathsObj);
        } else if (entities.type === 'POINT') {
            if (entities.position.y === 0 && entities.position.x === 0) {
                continue;
            }
            pathsObj.closed = false;
            pathsObj.points.push([entities.position.x, entities.position.y]);
            shape.paths.push(pathsObj);
        } else if (entities.type === 'ARC') {
            const { radius, startAngle, endAngle, angleLength } = entities;

            if (startAngle <= endAngle) {
                const geometry = new THREE.CircleGeometry(radius, 64, startAngle, angleLength);
                geometry.vertices.shift();
                geometry.vertices.forEach((item) => {
                    pathsObj.points.push([
                        item.x + entities.center.x,
                        item.y + entities.center.y
                    ]);
                });
            } else {
                const geometry2 = new THREE.CircleGeometry(radius, 64, startAngle, Math.PI * 2 + angleLength);
                geometry2.vertices.shift();
                geometry2.vertices.forEach((item) => {
                    pathsObj.points.push([
                        item.x + entities.center.x,
                        item.y + entities.center.y
                    ]);
                });
            }

            pathsObj.closed = false;
            shape.paths.push(pathsObj);
        } else if (entities.type === 'CIRCLE') {
            const { radius } = entities;
            const centerX = entities.center.x;
            const centerY = entities.center.y;
            pathsObj.closed = false;
            for (let i = 0; i <= 360; i += 5) {
                const x1 = centerX + radius * Math.cos((i * Math.PI) / 180);
                const y1 = centerY + radius * Math.sin((i * Math.PI) / 180);
                pathsObj.points.push([x1, y1]);
            }
            shape.paths.push(pathsObj);
        } else if (entities.type === 'ELLIPSE') {
            const xrad = Math.sqrt(
                entities.majorAxisEndPoint.x ** 2
                + entities.majorAxisEndPoint.y ** 2
            );
            const yrad = xrad * entities.axisRatio;
            const rotation = Math.atan2(
                entities.majorAxisEndPoint.y,
                entities.majorAxisEndPoint.x
            );

            const curve = new THREE.EllipseCurve(
                entities.center.x,
                entities.center.y,
                xrad,
                yrad,
                entities.startAngle,
                entities.endAngle,
                false, // Always counterclockwise
                rotation
            );
            const points = curve.getPoints(80);
            points.forEach((item) => {
                pathsObj.points.push([item.x, item.y]);
            });
            shape.paths.push(pathsObj);
        } else if (entities.type === 'INSERT') {
            continue;
        }
        shape.fill = 'none';
        shape.stroke = '#000000';
        shape.strokeWidth = strokeWidth;
        shape.visibility = true;
        shapes.push(shape);
    }

    res = {
        shapes
    };

    return res;
};
export function updateShapeBoundingBox(shape) {
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };
    for (const path of shape.paths) {
        // for (const path of Object.values(shape.paths)) {
        for (const point of path.points) {
            boundingBox.minX = Math.min(boundingBox.minX, point[0]);
            boundingBox.maxX = Math.max(boundingBox.maxX, point[0]);
            boundingBox.minY = Math.min(boundingBox.minY, point[1]);
            boundingBox.maxY = Math.max(boundingBox.maxY, point[1]);
        }
    }

    shape.boundingBox = boundingBox;
}

export const measureBoundary = (dxfString) => {
    const dxf = dxfString;
    // entities
    let maxX = Number.MIN_SAFE_INTEGER,
        minX = Number.MAX_SAFE_INTEGER,
        maxY = Number.MIN_SAFE_INTEGER,
        minY = Number.MAX_SAFE_INTEGER;

    for (const entities of dxf.entities) {
        if (entities.type === 'INSERT') {
            addInsertContent(entities, dxf);
        }
    }
    for (const entities of dxf.entities) {
        if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE') {
            entities.vertices.forEach((point) => {
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
            });
        } else if (entities.type === 'POLYLINE') {
            const pointsArr = [];
            for (let i = 0; i < entities.vertices.length; i++) {
                if (entities.vertices[i].bulge) {
                    const bulge = entities.vertices[i].bulge;
                    const startPoint = entities.vertices[i];
                    const endPoint = i + 1 < entities.vertices.length
                        ? entities.vertices[i + 1]
                        : entities.vertices[0];

                    const bulgeGeometry = new BulgeGeometry(
                        startPoint,
                        endPoint,
                        bulge
                    );
                    bulgeGeometry.vertices.forEach((vertice) => {
                        pointsArr.push([vertice.x, vertice.y]);
                    });
                } else {
                    const vertex = entities.vertices[i];
                    pointsArr.push([vertex.x, vertex.y]);
                }
            }
            pointsArr.forEach((point) => {
                maxX = Math.max(point[0], maxX);
                minX = Math.min(point[0], minX);
                maxY = Math.max(point[1], maxY);
                minY = Math.min(point[1], minY);
            });
        } else if (entities.type === 'SPLINE') {
            let points;
            let interpolatedPoints = [];
            let curve;
            if (entities.fitPoints && entities.fitPoints.length > 0) {
                points = entities.fitPoints.map((vec) => {
                    return new THREE.Vector2(vec.x, vec.y);
                });
                if (entities.degreeOfSplineCurve === 2) {
                    for (let i = 0; i + 2 < points.length; i += 2) {
                        curve = new THREE.QuadraticBezierCurve(
                            points[i],
                            points[i + 1],
                            points[i + 2]
                        );
                        interpolatedPoints.push(
                            ...curve.getPoints(points.length)
                        );
                    }
                } else {
                    curve = new THREE.SplineCurve(points);
                    interpolatedPoints = curve.getPoints(points.length * 2);
                }
            } else {
                interpolatedPoints = entities.controlPoints;
            }
            interpolatedPoints.forEach((point) => {
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
            });
        } else if (entities.type === 'POINT') {
            const position = entities.position;
            if (position.x === 0 && position.y === 0) {
                continue;
            }
            maxX = Math.max(position.x, maxX);
            minX = Math.min(position.x, minX);
            maxY = Math.max(position.y, maxY);
            minY = Math.min(position.y, minY);
        } else if (entities.type === 'CIRCLE') {
            const { center, radius } = entities;
            maxX = Math.max(center.x + radius, maxX);
            minX = Math.min(center.x - radius, minX);
            maxY = Math.max(center.y + radius, maxY);
            minY = Math.min(center.y - radius, minY);
        } else if (entities.type === 'ARC') {
            const { center, radius, startAngle, endAngle, angleLength } = entities;
            let geometry;
            if (startAngle <= endAngle) {
                geometry = new THREE.CircleGeometry(radius, 64, startAngle, angleLength);
            } else {
                geometry = new THREE.CircleGeometry(radius, 64, startAngle, Math.PI * 2 + angleLength);
            }
            geometry.vertices.shift();
            geometry.vertices.forEach((item) => {
                maxX = Math.max(item.x + center.x, maxX);
                minX = Math.min(item.x + center.x, minX);
                maxY = Math.max(item.y + center.y, maxY);
                minY = Math.min(item.y + center.y, minY);
            });
        } else if (entities.type === 'ELLIPSE') {
            const centerX = entities.center.x;
            const centerY = entities.center.y;
            let disX;
            let disY;
            if (entities.majorAxisEndPoint.x === 0) {
                disY = Math.abs(entities.majorAxisEndPoint.y);
                disX = disY * entities.axisRatio;
            } else {
                disX = Math.abs(entities.majorAxisEndPoint.x);
                disY = disX * entities.axisRatio;
            }
            maxX = Math.max(centerX + disX, maxX);
            minX = Math.min(centerX - disX, minX);
            maxY = Math.max(centerY + disY, maxY);
            minY = Math.min(centerY - disY, minY);
        }
    }

    dxf.boundary = {
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY
    };
    dxf.width = dxf.boundary.maxX - dxf.boundary.minX;
    dxf.height = dxf.boundary.maxY - dxf.boundary.minY;
    return dxf;
};
export const updateDxfBoundingBox = (svg) => {
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };

    for (const shape of svg.shapes) {
        updateShapeBoundingBox(shape);
        if (shape.visibility) {
            boundingBox.minX = Math.min(
                boundingBox.minX,
                shape.boundingBox.minX
            );
            boundingBox.maxX = Math.max(
                boundingBox.maxX,
                shape.boundingBox.maxX
            );
            boundingBox.minY = Math.min(
                boundingBox.minY,
                shape.boundingBox.minY
            );
            boundingBox.maxY = Math.max(
                boundingBox.maxY,
                shape.boundingBox.maxY
            );
        }
    }

    svg.boundingBox = boundingBox;
    svg.width = svg.boundingBox.maxX - svg.boundingBox.minX;
    svg.height = svg.boundingBox.maxY - svg.boundingBox.minY;
    svg.viewBox = [boundingBox.minX, boundingBox.minY, svg.width, svg.height];

    return svg;
};
export const parseDxf = async (originalPath) => {
    const parser = new DxfParser();
    const fileText = await readFile(originalPath);

    let dxfStr = await parser.parseSync(fileText);
    dxfStr = measureBoundary(dxfStr);

    // fs.writeFile(
    //     originalPath.replace(/(\.dxf)$/, 'laserdxf.json'),
    //     JSON.stringify(dxfStr),
    //     (err) => {
    //         if (err) {
    //             console.log(err);
    //         } else {
    //             console.log('successful>>>>>>>>>>>>>');
    //         }
    //     }
    // );
    return {
        svg: dxfStr,
        width: dxfStr.width,
        height: dxfStr.height
    };
};
export const generateSvgFromDxf = (dxf, tempPath, tempName) => {
    return new Promise((resolve, reject) => {
        const svg = dxfToSvg(dxf, 0.1);
        const uploadPath = tempPath.replace(/\.dxf$/, 'parsed.svg');
        const uploadName = tempName.replace(/\.dxf$/, 'parsed.svg');
        updateDxfBoundingBox(svg);
        svgInverse(svg, 2);
        fs.writeFile(uploadPath, svgToString(svg), 'utf8', (error) => {
            if (error) throw reject(error);
            resolve({ uploadName });
        });
    });
};
