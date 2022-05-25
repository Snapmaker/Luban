/**
 * ToolPathGenerator
 *
 */

import EventEmitter from 'events';
import { flip, rotate, scale, translate } from '../../../shared/lib/SVGParser';
import { svgToSegments } from './SVGFill';
import Normalizer from './Normalizer';
import XToBToolPath from '../ToolPath/XToBToolPath';
import { angleToPi, round } from '../../../shared/lib/utils';
import { Vector2 } from '../../../shared/lib/math/Vector2';
import { bresenhamLine } from '../bresenham-line';
import { polyOffset } from '../../../shared/lib/clipper/cLipper-adapter';
import { EPS } from '../../constants';
import * as ClipperLib from '../../../shared/lib/clipper/clipper';

function distance(p, q) {
    return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]));
}

/**
 * Check point inside polygon.
 *
 * Use Even-odd rule: https://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
 *
 * @param point
 * @param polygon
 * @return {boolean}
 */
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, len = polygon.length - 1; i < len; i++) {
        const p = polygon[i];
        const q = polygon[i + 1];

        if ((p[1] > point[1]) !== (q[1] > point[1])
            && point[0] < p[0] + (q[0] - p[0]) * (point[1] - p[1]) / (q[1] - p[1])) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Find the distance from point p to line segment p1p2
 * @returns {number}
 */
function pointDistance(p1, p2, p) {
    const n = [p2[0] - p1[0], p2[1] - p1[1]];
    const m = [p2[0] - p[0], p2[1] - p[1]];
    return Math.abs((n[0] * m[1] - n[1] * m[0]) / Math.sqrt(n[0] * n[0] + n[1] * n[1]));
}

/**
 * Get the first point from the svg
 *
 * @param svg
 */
function getFirstPointFromSvg(svg) {
    for (let i = 0; i < svg.shapes.length; i++) {
        const shape = svg.shapes[i];
        if (!shape.visibility) {
            continue;
        }

        for (let j = 0; j < shape.paths.length; j++) {
            const path = shape.paths[j];
            if (path.points.length === 0) {
                continue;
            }

            if (path.outlinePoints) {
                return path.outlinePoints[0][0];
            } else {
                return path.points[0];
            }
        }
    }
    return null;
}

/**
 * ToolPathGenerator
 */
export default class CNCToolPathGenerator extends EventEmitter {
    constructor(modelInfo = {}) {
        super();

        const { gcodeConfig, materials } = modelInfo;

        const { isRotate, diameter } = materials;
        const { targetDepth } = gcodeConfig;
        this.isRotate = isRotate;
        this.diameter = diameter;
        this.density = 10;
        this.targetDepth = targetDepth;
        this.toolPath = new XToBToolPath({ isRotate, diameter });
    }

    _processPathType(svg, pathType, options) {
        if (pathType === 'path') {
            // empty
        } else if (pathType === 'outline') {
            const { targetDepth, toolAngle, toolShaftDiameter } = options;

            // radius needed to carve to `targetDepth`
            const radiusNeeded = (toolAngle === 180)
                ? (toolShaftDiameter * 0.5)
                : (targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180));
            const off = Math.min(radiusNeeded, toolShaftDiameter * 0.5);

            for (let i = 0; i < svg.shapes.length; i++) {
                const shape = svg.shapes[i];
                if (!shape.visibility) {
                    continue;
                }

                for (let j = 0; j < shape.paths.length; j++) {
                    const path = shape.paths[j];
                    if (path.points.length === 0) {
                        continue;
                    }

                    // use inner outline or outer outline of closed path
                    let inside = false;
                    for (let i2 = 0; i2 < svg.shapes.length; i2++) {
                        const shape2 = svg.shapes[i2];
                        if (!shape2.visibility) {
                            continue;
                        }

                        for (let j2 = 0; j2 < shape2.paths.length; j2++) {
                            if (i === i2 && j === j2) {
                                continue;
                            }

                            const path2 = shape2.paths[j2];
                            // count only when path2 is closed
                            if (path2.closed && isPointInPolygon(path.points[0], path2.points)) {
                                inside = !inside;
                            }
                        }
                    }

                    // use margin / padding depending on `inside`
                    if (!inside) {
                        const outlinePoints = polyOffset([path.points], off, ClipperLib.JoinType.jtMiter,
                            path.closed ? ClipperLib.EndType.etClosedPolygon : ClipperLib.EndType.etOpenRound);
                        path.points = outlinePoints[0] || [];
                        path.outlinePoints = outlinePoints;
                    } else {
                        const outlinePoints = polyOffset([path.points], -off, ClipperLib.JoinType.jtMiter,
                            path.closed ? ClipperLib.EndType.etClosedPolygon : ClipperLib.EndType.etOpenRound);
                        path.points = outlinePoints[0] || [];
                        path.outlinePoints = outlinePoints;
                    }
                }
            }
        } else if (pathType === 'pocket') {
            const segments = svgToSegments(svg, options);

            const paths = [];

            for (const segment of segments) {
                const path = {
                    points: [segment.start, segment.end]
                };
                paths.push(path);
            }

            const shape = {
                visibility: true,
                paths
            };
            svg.shapes = [shape];
        }
    }

    _processSVG(svg, modelInfo) {
        const { transformation, sourceType, gcodeConfig, toolParams } = modelInfo;

        const { pathType = 'path', targetDepth, stepOver } = gcodeConfig;
        const fillDensity = 1 / stepOver;
        const { toolDiameter, toolAngle, toolShaftDiameter } = toolParams;

        const { scaleX, scaleY } = transformation;

        const originWidth = svg.width;
        const originHeight = svg.height;
        const targetHeight = transformation.height;
        const targetWidth = transformation.width;

        // rotation: degree and counter-clockwise
        const rotationZ = transformation.rotationZ;
        // const flipFlag = transformation.flip;

        if (sourceType !== 'dxf') {
            flip(svg, 1);
        }

        // flip(svg, flipFlag);
        scale(svg, {
            x: (scaleX > 0 ? 1 : -1) * targetWidth / originWidth,
            y: (scaleY > 0 ? 1 : -1) * targetHeight / originHeight
        });
        rotate(svg, rotationZ);
        translate(svg, -svg.viewBox[0], -svg.viewBox[1]);

        // Process path according to path type
        this._processPathType(svg, pathType, {
            width: svg.viewBox[2],
            height: svg.viewBox[3],
            pathType: pathType || 'fill',
            fillDensity: fillDensity || 5,
            targetDepth,
            toolAngle,
            toolDiameter,
            toolShaftDiameter
        });
    }

    // Static method to generate `ToolPath` from SVG
    generateToolPath(svg, modelInfo) {
        const { materials, gcodeConfig } = modelInfo;
        const { isRotate, diameter } = materials;
        const radius = diameter / 2;
        const {
            stepDown,
            enableTab = false, tabWidth, tabHeight, tabSpace,
            jogSpeed, workSpeed, plungeSpeed
        } = gcodeConfig;
        let { targetDepth, safetyHeight, stopHeight } = gcodeConfig;

        if (isRotate) {
            targetDepth = Math.min(targetDepth, diameter);
        }
        const normalizer = new Normalizer(
            'Center',
            svg.viewBox[0],
            svg.viewBox[0] + svg.viewBox[2],
            svg.viewBox[1],
            svg.viewBox[1] + svg.viewBox[3],
            { x: 1, y: 1 },
            { x: 0, y: 0 }
        );

        const toolPath = new XToBToolPath({ isRotate, diameter });

        const point = getFirstPointFromSvg(svg);

        const initialZ = isRotate ? radius : 0;
        stopHeight += initialZ;
        safetyHeight += initialZ;

        toolPath.safeStart(normalizer.x(point[0]), normalizer.y(point[1]), stopHeight, safetyHeight, jogSpeed);

        toolPath.rotateStart(jogSpeed);

        toolPath.spindleOn({ P: 100 });

        const passes = Math.ceil(targetDepth / stepDown);
        let z = initialZ;
        let progress = 0;
        for (let pass = 0; pass < passes; pass++) {
            // drop z
            z = Math.max(initialZ - targetDepth, z - stepDown);

            // move to safety height
            toolPath.move0Z(safetyHeight, jogSpeed);

            // scan shapes
            for (let i = 0; i < svg.shapes.length; i++) {
                const shape = svg.shapes[i];
                if (!shape.visibility) {
                    continue;
                }

                for (let j = 0; j < shape.paths.length; j++) {
                    const path = shape.paths[j];
                    if (path.points.length === 0) {
                        continue;
                    }

                    const allPoints = [];
                    if (path.outlinePoints) {
                        allPoints.push(...path.outlinePoints);
                    } else {
                        allPoints.push(path.points);
                    }

                    // const points = path.points;
                    for (const points of allPoints) {
                        // move to target start point
                        const p0 = points[0];
                        toolPath.move0XY(normalizer.x(p0[0]), normalizer.y(p0[1]), jogSpeed);

                        // plunge down
                        toolPath.move1Z(z, plungeSpeed);

                        if (enableTab && z < tabHeight) {
                            let tabMode = false;
                            let modeLimit = tabSpace;
                            let modeHeight = z;
                            let modeDistance = 0;
                            let modePoint = p0;

                            let k = 1;
                            while (k < points.length) {
                                const p = points[k];
                                const edgeLength = distance(modePoint, p);

                                if (modeDistance + edgeLength >= modeLimit) {
                                    const factor = 1 - (modeLimit - modeDistance) / edgeLength;
                                    const joint = [
                                        modePoint[0] * factor + p[0] * (1 - factor),
                                        modePoint[1] * factor + p[1] * (1 - factor)
                                    ];

                                    // run to joint in current mode
                                    toolPath.move1XY(normalizer.x(joint[0]), normalizer.y(joint[1]), workSpeed);

                                    // switch mode
                                    tabMode = !tabMode;
                                    modeHeight = (tabMode ? tabHeight : z);
                                    modeLimit = (tabMode ? tabWidth : tabSpace);
                                    modePoint = joint;
                                    modeDistance = 0;

                                    // run to new height
                                    toolPath.move1Z(modeHeight, tabMode ? workSpeed : plungeSpeed);
                                } else {
                                    modePoint = p;
                                    modeDistance += edgeLength;
                                    toolPath.move1XY(normalizer.x(p[0]), normalizer.y(p[1]), workSpeed);
                                    k++;
                                }
                            }
                        } else {
                            for (let k = 1, length = points.length; k < length; k++) {
                                const p = points[k];
                                toolPath.move1XY(normalizer.x(p[0]), normalizer.y(p[1]), workSpeed);
                            }
                        }

                        // move to safety height
                        toolPath.move0Z(safetyHeight, jogSpeed);
                    }
                }
                const p = (i / svg.shapes.length + pass) / passes;
                if (p - progress > EPS) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
        }

        toolPath.move0Z(stopHeight, jogSpeed);
        toolPath.move0XY(0, 0, jogSpeed);
        toolPath.spindleOff();
        toolPath.resetB();

        return toolPath;
    }


    generateToolPathObj(svg, modelInfo) {
        const { headType, mode, transformation, gcodeConfig, materials } = modelInfo;
        const { isRotate, diameter } = materials;

        const { positionX, positionY, positionZ } = transformation;

        this._processSVG(svg, modelInfo);

        const toolPath = this.generateToolPath(svg, modelInfo);

        const boundingBox = toolPath.boundingBox;

        return {
            headType: headType,
            mode: mode,
            movementMode: (headType === 'laser' && mode === 'greyscale') ? gcodeConfig.movementMode : '',
            data: toolPath.commands,
            estimatedTime: toolPath.estimatedTime * 1.4,
            positionX: isRotate ? 0 : positionX,
            positionY: positionY,
            positionZ: positionZ,
            rotationB: isRotate ? toolPath.toB(positionX) : 0,
            boundingBox: boundingBox,
            isRotate: isRotate,
            diameter: diameter
        };
    }

    generateViewPathObj(svg, modelInfo) {
        return this._generateViewPathObj(svg, modelInfo);
    }

    _calculateOffsetBox(viewPaths, p1, p2, offset) {
        if (Vector2.isEqual(p1, p2)) {
            return;
        }

        const k1 = Vector2.mulScale(Vector2.normalize(Vector2.sub(p2, p1)), offset);
        const k2 = Vector2.rotate(k1, 90);
        const k3 = { x: -k1.x, y: -k1.y };
        const k4 = { x: -k2.x, y: -k2.y };

        const bP1 = Vector2.add(Vector2.add(p1, k2), k3);
        const bP2 = Vector2.add(Vector2.add(p1, k3), k4);
        const bP3 = Vector2.add(Vector2.add(p2, k4), k1);
        const bP4 = Vector2.add(Vector2.add(p2, k1), k2);

        const boxRange = new Map();

        const boxes = [].concat(bresenhamLine(bP1, bP2)).concat(bresenhamLine(bP2, bP3)).concat(bresenhamLine(bP3, bP4)).concat(bresenhamLine(bP4, bP1));

        for (const box of boxes) {
            if (boxRange.has(box.x)) {
                const range = boxRange.get(box.x);
                range[0] = Math.min(range[0], box.y);
                range[1] = Math.max(range[1], box.y);
            } else {
                boxRange.set(box.x, [box.y, box.y]);
            }
        }

        for (const key of boxRange.keys()) {
            const range = boxRange.get(key);

            for (let j = range[0]; j <= range[1]; j++) {
                if (j < 0 || j >= viewPaths.length || key < 0 || key >= viewPaths[0].length) {
                    continue;
                }
                viewPaths[j][key].y = -this.targetDepth;
            }
        }
    }

    _generateViewPathObj(svg, modelInfo) {
        this.emit('progress', 0.05);
        const { sourceType, mode, transformation, gcodeConfig, toolParams } = modelInfo;

        const { targetDepth } = gcodeConfig;
        const { toolAngle, toolShaftDiameter } = toolParams;

        const { positionX, positionY, positionZ } = transformation;

        this._processSVG(svg, modelInfo);

        // radius needed to carve to `targetDepth`
        const radiusNeeded = (toolAngle === 180)
            ? (toolShaftDiameter * 0.5)
            : (targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180));
        const off = Math.min(radiusNeeded, toolShaftDiameter * 0.5);
        const offDesity = off * this.density;

        const svgWidth = svg.viewBox[0] + svg.viewBox[2];
        const svgHeight = svg.viewBox[1] + svg.viewBox[3];

        scale(svg, { x: this.density, y: this.density });
        translate(svg, offDesity, offDesity);

        const width = Math.round(svgWidth * this.density + 2 * offDesity);
        const height = Math.round(svgHeight * this.density + 2 * offDesity);

        const viewPaths = [];

        for (let j = 0; j <= height; j++) {
            viewPaths.push([]);

            for (let i = 0; i <= width; i++) {
                viewPaths[j][i] = { x: (i - width / 2) / this.density, y: 0 };
            }
        }

        let progress = 0;
        // const polygons = null;
        // scan shapes
        for (let i = 0; i < svg.shapes.length; i++) {
            const shape = svg.shapes[i];
            if (!shape.visibility) {
                continue;
            }

            for (let j = 0; j < shape.paths.length; j++) {
                const path = shape.paths[j];
                if (path.points.length === 0) {
                    continue;
                }

                for (let k = 0; k < path.points.length - 1; k++) {
                    const p1 = path.points[k];
                    const p2 = path.points[k + 1];
                    this._calculateOffsetBox(viewPaths, { x: p1[0], y: p1[1] }, { x: p2[0], y: p2[1] }, offDesity);
                }
            }
            const p = (i + 1) / svg.shapes.length;
            if (p - progress > EPS) {
                progress = p;
                this.emit('progress', progress);
            }
        }

        viewPaths.reverse();

        let data = null;

        if (this.isRotate) {
            data = [];
            const perimeter = Math.round(this.diameter * Math.PI * this.density);

            for (let j = 0; j <= height; j++) {
                data[j] = [];
                for (let i = 0; i <= Math.max(width, perimeter); i++) {
                    if (i > width) {
                        const x = (i - width / 2) / this.density;
                        const z = this.diameter / 2;
                        const b = angleToPi(this.toolPath.toB(x));
                        const px = round(z * Math.sin(b), 2);
                        const py = round(z * Math.cos(b), 2);
                        data[j][i] = { x: px, y: py, z: z };
                    } else {
                        const ii = i % perimeter;
                        const x = viewPaths[j][i].x;
                        const z = Math.max(viewPaths[j][i].y + this.diameter / 2, 0);
                        if (data[j][ii] && z > data[j][ii].z) {
                            continue;
                        }
                        const b = angleToPi(this.toolPath.toB(x));
                        const px = round(z * Math.sin(b), 2);
                        const py = round(z * Math.cos(b), 2);
                        data[j][ii] = { x: px, y: py, z: z };
                    }
                }
            }
        } else {
            data = viewPaths;
        }

        this.emit('progress', 1);

        const boundingBox = {
            min: {
                x: positionX - width / 2 / this.density,
                y: positionY - height / 2 / this.density,
                z: -targetDepth
            },
            max: {
                x: positionX + width / 2 / this.density,
                y: positionY + height / 2 / this.density,
                z: 0
            },
            length: {
                x: width / this.density,
                y: height / this.density,
                z: targetDepth
            }
        };


        return {
            sourceType: sourceType,
            mode: mode,
            width: width / this.density,
            height: height / this.density,
            positionX: this.isRotate ? 0 : positionX,
            positionY: positionY,
            positionZ: positionZ,
            rotationB: this.isRotate ? this.toolPath.toB(positionX) : 0,
            targetDepth: targetDepth,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter,
            data: data
        };
    }

    _generateRotateViewPath(svg, modelInfo) {
        const { sourceType, mode, transformation, gcodeConfig, materials, toolParams } = modelInfo;
        const { isRotate, diameter } = materials;

        const { targetDepth } = gcodeConfig;
        const { toolAngle, toolShaftDiameter } = toolParams;

        const density = 10;

        const { positionX, positionY } = transformation;

        this._processSVG(svg, modelInfo);

        // radius needed to carve to `targetDepth`
        const radiusNeeded = (toolAngle === 180)
            ? (toolShaftDiameter * 0.5)
            : (targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180));
        const off = Math.min(radiusNeeded, toolShaftDiameter * 0.5);

        translate(svg, off, off);

        const minX = svg.viewBox[0] - off;
        const maxX = svg.viewBox[0] + svg.viewBox[2] + 2 * off;
        const minY = svg.viewBox[1] - off;
        const maxY = svg.viewBox[1] + svg.viewBox[3] + 2 * off;

        const width = maxX - minX;
        const height = maxY - minY;

        const targetWidth = Math.ceil(width * density);
        const targetHeight = Math.ceil(height * density);

        const pathLength = isRotate ? Math.ceil(diameter * Math.PI * density) : targetWidth;

        // const normalizerSvg = new Normalizer(
        //     'Center',
        //     minX,
        //     maxX,
        //     minY,
        //     maxY,
        //     { x: 1, y: 1 },
        //     { x: 0, y: 0 }
        // );

        const normalizer = new Normalizer(
            'Center',
            0,
            targetWidth,
            0,
            targetHeight,
            { x: 1 / density, y: 1 / density },
            { x: 0, y: 0 }
        );

        const viewPaths = [];

        for (let j = 0; j < targetHeight; j++) {
            viewPaths[j] = [];
            for (let i = 0; i < pathLength; i++) {
                const x = normalizer.x(i);
                const z = diameter / 2;
                const b = angleToPi(this.toolPath.toB(x));
                const px = round(z * Math.sin(b), 2);
                const py = round(z * Math.cos(b), 2);
                viewPaths[j][i] = { x: px, y: py };
            }
        }

        const allPoints = this._getSvgAllPoints(svg);

        // eslint-disable-next-line no-unused-vars
        const count = allPoints.reduce((c, v) => {
            return c + v.length;
        }, 0);

        for (const points of allPoints) {
            for (let n = 0; n < points.length - 1; n++) {
                const p1 = points[n];
                const p2 = points[n + 1];

                const startX = Math.ceil((Math.min(p1[0], p2[0]) - off) * density);
                const endX = Math.ceil((Math.max(p1[0], p2[0]) + off) * density);
                const startY = Math.ceil((Math.min(p1[1], p2[1]) - off) * density);
                const endY = Math.ceil((Math.max(p1[1], p2[1]) + off) * density);

                for (let j = startY; j < endY; j++) {
                    for (let i = startX; i < endX; i++) {
                        const ii = i % pathLength;
                        const jj = targetHeight - 1 - j;
                        const x = i / density;
                        const y = j / density;
                        const p = [x, y];
                        if (pointDistance(p1, p2, p) <= off / 2) {
                            const z = Math.max(diameter / 2 - targetDepth, 0);
                            const b = this.toolPath.toB(normalizer.x(i)) / 180 * Math.PI;
                            const px = round(z * Math.sin(b), 2);
                            const py = round(z * Math.cos(b), 2);
                            viewPaths[jj][ii].x = px;
                            viewPaths[jj][ii].y = py;
                        }
                    }
                }

                this.emit('progress', points.length / count);
            }
        }


        const boundingBox = {
            min: {
                x: positionX - width / 2,
                y: positionY - height / 2,
                z: -targetDepth
            },
            max: {
                x: positionX + width / 2,
                y: positionY + height / 2,
                z: 0
            },
            length: {
                x: width,
                y: height,
                z: targetDepth
            }
        };

        this.emit('progress', 1);

        return {
            sourceType: sourceType,
            mode: mode,
            positionX: isRotate ? 0 : positionX,
            positionY: positionY,
            rotationB: isRotate ? this.toolPath.toB(positionX) : 0,
            data: viewPaths,
            width: width,
            height: height,
            boundingBox: boundingBox,
            isRotate: isRotate,
            diameter: diameter
        };
    }

    _getSvgAllPoints(svg) {
        const allPoints = [];
        for (let i = 0; i < svg.shapes.length; i++) {
            const shape = svg.shapes[i];
            if (!shape.visibility) {
                continue;
            }

            for (let j = 0; j < shape.paths.length; j++) {
                const path = shape.paths[j];
                if (path.points.length === 0) {
                    continue;
                }

                if (path.outlinePoints) {
                    for (const outlinePoint of path.outlinePoints) {
                        allPoints.push(outlinePoint);
                    }
                } else {
                    allPoints.push(path.points);
                }
            }
        }
        return allPoints;
    }
}
