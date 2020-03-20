import DxfParser from 'dxf-parser';
import fs from 'fs';
import { Matrix4, Euler } from 'three';
import * as THREE from 'three';
import { isUndefined } from 'lodash';

function drawBezierCurve(points) {
    let res = [];
    if (points.length === 4) {
        let ax, ay, bx, by, cx, cy, dx, dy, p0, p1;
        for (let t = 0; t < 1; t += 0.1) {
            p0 = (1 - t) ** 3 * points[0].x + 3 * t * (1 - t) ** 2 * points[1].x + 3 * t ** 2 * (1 - t) * points[2].x + t ** 3 * points[3].x;
            p1 = (1 - t) ** 3 * points[0].y + 3 * t * (1 - t) ** 2 * points[1].y + 3 * t ** 2 * (1 - t) * points[2].y + t ** 3 * points[3].y;
            res.push({ x: p0, y: p1, z: 0 });
        }
    } else if (points.length === 3) {
        // console.log('points,length ==== 3');
    } else {
        res = points;
    }
    return res;
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
/**
 * Apply Matrix4 to dxf object.
 *
 * Assumes the upper 3x3 of m is a pure translation/rotation matrix (i.e, unscaled).
 * You can generate Matrix4 from euler rotation:
 *
 *     const m = new Matrix4().makeRotationFromEuler(euler);
 */
// export function applyMatrix4(dxf, m) {
//     const e = m.elements;
//     const { maxX, maxY, minX, minY } = dxf.boundary;
//     for (const entities of dxf.entities) {
//         if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE' || entities.type === 'POLYLINE') {
//             entities.vertices.map((point) => {
//                 const x = point.x;
//                 const y = point.y;
//                 point.y = e[0] * x + e[4] * y + e[12];
//                 point.x = e[1] * x + e[5] * y + e[13];
//                 return point;
//             });
//         } else if (entities.type === 'SPLINE') {
//             entities.controlPoints.map((point) => {
//                 const x = point.x;
//                 const y = point.y;
//                 point.y = e[0] * x + e[4] * y + e[12];
//                 point.x = e[1] * x + e[5] * y + e[13];
//                 return point;
//             });
//         } else if (entities.type === 'CIRCLE') {
//             const x = entities.center.x;
//             const y = entities.center.y;
//             entities.center.y = e[0] * x + e[4] * y + e[12];
//             entities.center.x = e[1] * x + e[5] * y + e[13];
//         } else if (entities.type === 'POINT') {
//             if (entities.position.y === 0 && entities.position.x === 0) {
//                 continue;
//             }
//             const x = entities.position.x;
//             const y = entities.position.y;
//             entities.position.y = e[0] * x + e[4] * y + e[12];
//             entities.position.x = e[1] * x + e[5] * y + e[13];
//         }
//     }
//
//     const corners = [[minX, minY], [minX, maxY], [maxX, minY], [maxX, maxY]];
//     for (let i = 0; i < 4; i++) {
//         const x = corners[i][0], y = corners[i][1];
//         corners[i][0] = e[0] * x + e[4] * y + e[12];
//         corners[i][1] = e[1] * x + e[5] * y + e[13];
//     }
//
//     dxf.boundary.minX = Math.min(...corners.map(corner => corner[0]));
//     dxf.boundary.maxX = Math.min(...corners.map(corner => corner[1]));
//     dxf.boundary.minY = Math.max(...corners.map(corner => corner[0]));
//     dxf.boundary.maxY = Math.max(...corners.map(corner => corner[1]));
//
//     return measureBoundary(dxf);
// }


// Add flipFlag: 0 Reset; 1: Vertical; 2: Horizontal; 3: Both
// export const dxfFlip = (dxf, flipFlag) => {
//     const { maxX, maxY, minX, minY } = dxf.boundary;
//
//     for (const entities of dxf.entities) {
//         if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE'
//          || entities.type === 'POLYLINE') {
//             entities.vertices.forEach((point) => {
//                 switch (flipFlag) {
//                     case 1:
//                         point.y = minY + (maxY - point.y);// 1:  Up Down;
//                         break;
//                     case 2:
//                         point.x = minX + (maxX - point.x); // 2: Left Right;
//                         break;
//                     case 3:
//                         // 3: Both Up Down and Left Right
//                         point.y = minY + (maxY - point.y);
//                         point.x = minX + (maxX - point.x);
//                         break;
//                     default:
//                         break;
//                 }
//             });
//         } else if (entities.type === 'CIRCLE') {
//             switch (flipFlag) {
//                 case 1:
//                     entities.center.y = minY + (maxY - entities.center.y);
//                     break;
//                 case 2:
//                     entities.center.x = minX + (maxX - entities.center.x);
//                     break;
//                 case 3:
//                     entities.center.y = minY + (maxY - entities.center.y);
//                     entities.center.x = minX + (maxX - entities.center.x);
//                     break;
//                 default:
//                     break;
//             }
//         } else if (entities.type === 'POINT') {
//             if (entities.position.y === 0 && entities.position.x === 0) {
//                 continue;
//             }
//             switch (flipFlag) {
//                 case 1:
//                     entities.position.y = minY + (maxY - entities.position.y);
//                     break;
//                 case 2:
//                     entities.position.x = minX + (maxX - entities.position.x);
//                     break;
//                 case 3:
//                     entities.position.y = minY + (maxY - entities.position.y);
//                     entities.position.x = minX + (maxX - entities.position.x);
//                     break;
//                 default:
//                     break;
//             }
//         } else if (entities.type === 'SPLINE') {
//             entities.controlPoints.forEach((point) => {
//                 switch (flipFlag) {
//                     case 1:
//                         point.y = minY + (maxY - point.y);// 1:  Up Down;
//                         break;
//                     case 2:
//                         point.x = minX + (maxX - point.x); // 2: Left Right;
//                         break;
//                     case 3:
//                         // 3: Both Up Down and Left Right
//                         point.y = minY + (maxY - point.y);
//                         point.x = minX + (maxX - point.x);
//                         break;
//                     default:
//                         break;
//                 }
//             });
//         }
//     }
//     measureBoundary(dxf);
// };
//
// export const dxfScale = (dxf, scale) => {
//     let { maxX, maxY, minX, minY } = dxf.boundary;
//     maxX *= scale.x;
//     maxY *= scale.y;
//     minX *= scale.x;
//     minY *= scale.y;
//     for (const entities of dxf.entities) {
//         if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE' || entities.type === 'POLYLINE') {
//             entities.vertices.map((point) => {
//                 point.y *= scale.y;
//                 point.x *= scale.x;
//                 return point;
//             });
//         } else if (entities.type === 'SPLINE') {
//             entities.controlPoints.map((point) => {
//                 point.y *= scale.y;
//                 point.x *= scale.x;
//                 return point;
//             });
//         } else if (entities.type === 'CIRCLE') {
//             entities.center.y *= scale.y;
//             entities.center.x *= scale.x;
//             entities.radius *= scale.x;
//         } else if (entities.type === 'POINT') {
//             if (entities.position.y === 0 && entities.position.x === 0) {
//                 continue;
//             }
//             entities.position.y *= scale.y;
//             entities.position.x *= scale.x;
//         }
//     }
//     measureBoundary(dxf);
// };
//
// export function dxfRotate(dxf, radian) {
//     const rotation = new Euler(0, 0, radian);
//     const anchorPoint = [dxf.boundary.minX + dxf.boundary.width * 0.5, dxf.boundary.minY + dxf.boundary.height * 0.5];
//
//     const move1 = new Matrix4().makeTranslation(-anchorPoint[0], -anchorPoint[1], 0);
//     applyMatrix4(dxf, move1);
//
//     const rotationMatrix = new Matrix4().makeRotationFromEuler(rotation);
//     applyMatrix4(dxf, rotationMatrix);
//
//     const move2 = new Matrix4().makeTranslation(anchorPoint[0], anchorPoint[1], 0);
//     applyMatrix4(dxf, move2);
//
//     return measureBoundary(dxf);
// }
//
// export function dxfTranslate(dxf, x, y) {
//     const move = new Matrix4().makeTranslation(x, y, 0);
//     applyMatrix4(dxf, move);
//     return measureBoundary(dxf);
// }
//
// export function dxfSort(dxf) {
//     const entities = dxf.entities;
//     const newShapes = [];
//     const usedSet = new Set();
//     let from = [0, 0];
//     for (let loop = 0; loop < entities.length; loop++) {
//         let minDist = Infinity;
//         let idx = -1;
//         let rev = false;
//
//         for (let i = 0; i < entities.length; ++i) {
//             const shape = entities[i];
//             if (usedSet.has(i)) {
//                 continue;
//             }
//             if (shape.type === 'LINE' || shape.type === 'LWPOLYLINE' || shape.type === 'POLYLINE') {
//                 let tmpDist = dist2([shape.vertices[0].x, shape.vertices[0].y], from);
//                 if (tmpDist < minDist) {
//                     minDist = tmpDist;
//                     rev = false;
//                     idx = i;
//                 }
//                 tmpDist = dist2([shape.vertices[shape.vertices.length - 1].x, shape.vertices[shape.vertices.length - 1].y], from);
//                 if (tmpDist < minDist) {
//                     minDist = tmpDist;
//                     rev = true;
//                     idx = i;
//                 }
//             } else if (shape.type === 'SPLINE') {
//                 let tmpDist = dist2([shape.controlPoints[0].x, shape.controlPoints[0].y], from);
//                 if (tmpDist < minDist) {
//                     minDist = tmpDist;
//                     rev = false;
//                     idx = i;
//                 }
//                 tmpDist = dist2([shape.controlPoints[shape.controlPoints.length - 1].x, shape.controlPoints[shape.controlPoints.length - 1].y], from);
//                 if (tmpDist < minDist) {
//                     minDist = tmpDist;
//                     rev = true;
//                     idx = i;
//                 }
//             } else {
//                 idx = i;
//             }
//         }
//         // use entities[idx] first
//         if (idx !== -1) {
//             const shape = entities[idx];
//             if (rev) {
//                 if (shape.type === 'LINE' || shape.type === 'LWPOLYLINE' || shape.type === 'POLYLINE') {
//                     shape.vertices = shape.vertices.reverse();
//                     from = [shape.vertices[shape.vertices.length - 1].x, shape.vertices[shape.vertices.length - 1].y];
//                 } else if (shape.type === 'SPLINE') {
//                     shape.controlPoints = shape.controlPoints.reverse();
//                     from = [shape.controlPoints[shape.controlPoints.length - 1].x, shape.controlPoints[shape.controlPoints.length - 1].y];
//                 } else if (shape.type === 'CIRCLE') {
//                     from = [shape.center.x, shape.center.y + shape.radius];
//                 } else if (shape.type === 'POINT' && (shape.position.x !== 0 && shape.position.y !== 0)) {
//                     from = [shape.position.x, shape.position.y];
//                 }
//             }
//             newShapes.push(shape);
//         }
//         usedSet.add(idx);
//     }
//
//     dxf.entities = newShapes;
//
//     return dxf;
// }

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
            entities.vertices.forEach((item, i) => {
                pathsObj.points.push([item.x, item.y]);
            });
            pathsObj.closed = false;
            shape.paths.push(pathsObj);
        } else if (entities.type === 'POLYLINE') {
            pathsObj.points = [];
            pathsObj.closed = false;
            entities.vertices.forEach((item, i) => {
                pathsObj.points.push([item.x, item.y]);
            });
            if (entities.vertices.length > 2) {
                pathsObj.points.push([entities.vertices[0].x, entities.vertices[0].y]);
            }
            pathsObj.closed = false;
            shape.paths.push(pathsObj);
        } else if (entities.type === 'SPLINE') {
            let newControlPoints = [];
            newControlPoints = drawBezierCurve(entities.controlPoints);
            entities.controlPoints = newControlPoints;

            pathsObj.points = [];
            pathsObj.closed = false;
            entities.controlPoints.forEach((item, i) => {
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
            const { radius, startAngle, endAngle } = entities;
            const centerX = entities.center.x;
            const centerY = entities.center.y;
            pathsObj.closed = false;
            for (let i = startAngle; i < endAngle; i += 2 * Math.PI / 180) {
                const circleObj = {};
                const x1 = centerX + radius * Math.cos(i);
                const y1 = centerY + radius * Math.sin(i);
                pathsObj.points.push([x1, y1]);
            }
            shape.paths.push(pathsObj);
        } else if (entities.type === 'CIRCLE') {
            const { radius } = entities;
            const centerX = entities.center.x;
            const centerY = entities.center.y;
            pathsObj.closed = false;
            for (let i = 0; i <= 360; i += 5) {
                const circleObj = {};
                const x1 = centerX + radius * Math.cos(i * Math.PI / 180);
                const y1 = centerY + radius * Math.sin(i * Math.PI / 180);
                pathsObj.points.push([x1, y1]);
            }
            shape.paths.push(pathsObj);
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
    // variable
    let maxX = Number.MIN_SAFE_INTEGER, minX = Number.MAX_SAFE_INTEGER, maxY = Number.MIN_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER;
    for (const variable of dxf.entities) {
        if (variable.type === 'LINE' || variable.type === 'LWPOLYLINE') {
            variable.vertices.forEach((point) => {
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
            });
        } else if (variable.type === 'POLYLINE') {
            variable.vertices.forEach((point) => {
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
            });
        } else if (variable.type === 'SPLINE') {
            variable.controlPoints.forEach((point) => {
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
            });
        } else if (variable.type === 'POINT') {
            const position = variable.position;
            if (position.x === 0 && position.y === 0) {
                continue;
            }
            maxX = Math.max(position.x, maxX);
            minX = Math.min(position.x, minX);
            maxY = Math.max(position.y, maxY);
            minY = Math.min(position.y, minY);
        } else if (variable.type === 'CIRCLE' || variable.type === 'ARC') {
            const { center, radius } = variable;
            maxX = Math.max(center.x + radius, maxX);
            minX = Math.min(center.x - radius, minX);
            maxY = Math.max(center.y + radius, maxY);
            minY = Math.min(center.y - radius, minY);
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

    const dxfStr = await parser.parseSync(fileText);
    measureBoundary(dxfStr);
    // dxfStr = dxfToSvg(dxfStr);
    // updateSvgBoundingBox(dxfStr);
    // fs.writeFile(originalPath.replace(/(\.dxf)$/, 'laserdxf.json'), JSON.stringify(dxfStr), (err) => {
    //     if (err) {
    //         reject(err);
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
