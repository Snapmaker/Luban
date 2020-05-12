import fs from 'fs';
import * as THREE from 'three';
import { isUndefined } from 'lodash';
import DxfParser from './DxfParser';

const cricleAngle = 360 * Math.PI / 180;

function drawBezierCurve(degreeOfSplineCurve, controlPoints, fitPoints) {
    let points;
    let interpolatedPoints = [];
    let curve;
    if (fitPoints && fitPoints.length > 0) {
        points = fitPoints.map((vec) => {
            return new THREE.Vector2(vec.x, vec.y);
        });
        if (degreeOfSplineCurve === 2) {
            for (let i = 0; i + 2 < points.length; i += 2) {
                curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                interpolatedPoints.push(...curve.getPoints(points.length * 4));
            }
        } else {
            curve = new THREE.SplineCurve(points);
            interpolatedPoints = curve.getPoints(points.length * 8);
        }
    } else {
        // interpolatedPoints = controlPoints;
        if (controlPoints && controlPoints.length > 7) {
            interpolatedPoints = controlPoints;
        } else {
            if (controlPoints.length === 4) {
                let p0, p1;
                for (let t = 0; t < 1; t += 0.1) {
                    p0 = (1 - t) ** 3 * controlPoints[0].x + 3 * t * (1 - t) ** 2 * controlPoints[1].x + 3 * t ** 2 * (1 - t) * controlPoints[2].x + t ** 3 * controlPoints[3].x;
                    p1 = (1 - t) ** 3 * controlPoints[0].y + 3 * t * (1 - t) ** 2 * controlPoints[1].y + 3 * t ** 2 * (1 - t) * controlPoints[2].y + t ** 3 * controlPoints[3].y;
                    interpolatedPoints.push({ x: p0, y: p1, z: 0 });
                }
            } else {
                points = controlPoints.map((vec) => {
                    return new THREE.Vector2(vec.x, vec.y);
                });
                if (degreeOfSplineCurve === 2) {
                    for (let i = 0; i + 2 < points.length; i += 2) {
                        curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                        interpolatedPoints.push(...curve.getPoints(points.length));
                    }
                } else {
                    curve = new THREE.SplineCurve(points);
                    interpolatedPoints = curve.getPoints(points.length * 2);
                }
            }
        }
    }
    // if (controlPoints.length === 4 && fitPoints.length === 0) {
    //     let p0, p1;
    //     for (let t = 0; t < 1; t += 0.1) {
    //         p0 = (1 - t) ** 3 * controlPoints[0].x + 3 * t * (1 - t) ** 2 * controlPoints[1].x + 3 * t ** 2 * (1 - t) * controlPoints[2].x + t ** 3 * controlPoints[3].x;
    //         p1 = (1 - t) ** 3 * controlPoints[0].y + 3 * t * (1 - t) ** 2 * controlPoints[1].y + 3 * t ** 2 * (1 - t) * controlPoints[2].y + t ** 3 * controlPoints[3].y;
    //         res.push({ x: p0, y: p1, z: 0 });
    //     }
    // }else snapmaker.com/download/luban/snapmaker-luban-3.2.0-win-x64.exe

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
        console.log(err);
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
        if (oldEntities[i].type === 'LINE' || oldEntities[i].type === 'LWPOLYLINE' || oldEntities[i].type === 'POLYLINE') {
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
        } else if (oldEntities[i].type === 'ARC' || oldEntities[i].type === 'CIRCLE' || oldEntities[i].type === 'ELLIPSE') {
            newEntities.center.x += position.x;
            newEntities.center.y += position.y;
            dxf.entities.push(newEntities);
        } else if (oldEntities[i].type === 'INSERT') {
            addInsertContent(newEntities, dxf, position);
        }
    }
}

export const dxfToSvg = (dxf) => {
    const shapes = []; let
        res = {};
    for (const entities of dxf.entities) {
        if (dxf.tables && dxf.tables.layer
            && !isUndefined(dxf.tables.layer.layers[entities.layer].visible)
            && !dxf.tables.layer.layers[entities.layer].visible) {
            continue;
        }


        const shape = {};
        shape.paths = [];
        const pathsObj = {};
        pathsObj.points = [];

        if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE') {
            pathsObj.points = [];
            pathsObj.closed = false;
            entities.vertices.forEach((item) => {
                pathsObj.points.push([item.x, item.y]);
            });
            pathsObj.closed = false;
            shape.paths.push(pathsObj);
        } else if (entities.type === 'POLYLINE') {
            pathsObj.points = [];
            pathsObj.closed = false;
            entities.vertices.forEach((item) => {
                pathsObj.points.push([item.x, item.y]);
            });
            if (entities.vertices.length > 2) {
                pathsObj.points.push([entities.vertices[0].x, entities.vertices[0].y]);
            }
            pathsObj.closed = false;
            shape.paths.push(pathsObj);
        } else if (entities.type === 'SPLINE') {
            let newControlPoints = [];
            newControlPoints = drawBezierCurve(entities.degreeOfSplineCurve, entities.controlPoints, entities.fitPoints);
            entities.controlPoints = newControlPoints;

            pathsObj.points = [];
            pathsObj.closed = false;
            entities.controlPoints.forEach((item) => {
                pathsObj.points.push([item.x, item.y]);
            });
            pathsObj.closed = false;
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
                const geometry = new THREE.CircleGeometry(radius, 32, startAngle, angleLength);
                geometry.vertices.shift();
                geometry.vertices.forEach((item) => {
                    pathsObj.points.push([item.x + entities.center.x, item.y + entities.center.y]);
                });
            } else {
                const geometry2 = new THREE.CircleGeometry(radius, 32, startAngle, cricleAngle + angleLength);
                geometry2.vertices.shift();
                geometry2.vertices.forEach((item) => {
                    pathsObj.points.push([item.x + entities.center.x, item.y + entities.center.y]);
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
                const x1 = centerX + radius * Math.cos(i * Math.PI / 180);
                const y1 = centerY + radius * Math.sin(i * Math.PI / 180);
                pathsObj.points.push([x1, y1]);
            }
            shape.paths.push(pathsObj);
        } else if (entities.type === 'ELLIPSE') {
            const xrad = Math.sqrt((entities.majorAxisEndPoint.x ** 2) + (entities.majorAxisEndPoint.y ** 2));
            const yrad = xrad * entities.axisRatio;
            const rotation = Math.atan2(entities.majorAxisEndPoint.y, entities.majorAxisEndPoint.x);

            const curve = new THREE.EllipseCurve(
                entities.center.x, entities.center.y,
                xrad, yrad,
                entities.startAngle, entities.endAngle,
                false, // Always counterclockwise
                rotation
            );
            const points = curve.getPoints(40);
            points.forEach((item) => {
                pathsObj.points.push([item.x, item.y]);
            });
            shape.paths.push(pathsObj);
        } else if (entities.type === 'INSERT') {
            continue;
        }
        shape.fill = null;
        shape.stroke = '#000000';
        shape.strokeWidth = 0.001;
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
    let maxX = Number.MIN_SAFE_INTEGER, minX = Number.MAX_SAFE_INTEGER, maxY = Number.MIN_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER;

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
            entities.vertices.forEach((point) => {
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
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
                        curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                        interpolatedPoints.push(...curve.getPoints(points.length));
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
        } else if (entities.type === 'CIRCLE' || entities.type === 'ARC') {
            const { center, radius } = entities;
            maxX = Math.max(center.x + radius, maxX);
            minX = Math.min(center.x - radius, minX);
            maxY = Math.max(center.y + radius, maxY);
            minY = Math.min(center.y - radius, minY);
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
        minX: minX - 1,
        maxX: maxX + 1,
        minY: minY - 1,
        maxY: maxY + 1
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
            boundingBox.minX = Math.min(boundingBox.minX, shape.boundingBox.minX);
            boundingBox.maxX = Math.max(boundingBox.maxX, shape.boundingBox.maxX);
            boundingBox.minY = Math.min(boundingBox.minY, shape.boundingBox.minY);
            boundingBox.maxY = Math.max(boundingBox.maxY, shape.boundingBox.maxY);
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

    // fs.writeFile(originalPath.replace(/(\.dxf)$/, 'laserdxf.json'), JSON.stringify(dxfStr), (err) => {
    //     if (err) {
    //         console.log(err);
    //     } else {
    //         console.log('successful>>>>>>>>>>>>>');
    //     }
    // });
    return {
        svg: dxfStr,
        width: dxfStr.width,
        height: dxfStr.height
    };
};
