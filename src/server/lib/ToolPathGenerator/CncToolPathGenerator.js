/**
 * ToolPathGenerator
 *
 */

import EventEmitter from 'events';
import PolygonOffset from './PolygonOffset';
import { flip, scale, rotate, translate } from '../../../shared/lib/SVGParser';
import { svgToSegments } from './SVGFill';
import Normalizer from './Normalizer';
import XToBToolPath from '../ToolPath/XToBToolPath';
import { angleToPi, round } from '../../../shared/lib/utils';

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
    const d = Math.abs((n[0] * m[1] - n[1] * m[0]) / Math.sqrt(n[0] * n[0] + n[1] * n[1]));
    return d;
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

        const { isRotate, diameter } = modelInfo.materials;
        this.isRotate = isRotate;
        this.diameter = diameter;
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
                        const outlinePoints = new PolygonOffset(path.points).margin(off);
                        path.points = outlinePoints[0];
                        path.outlinePoints = outlinePoints;
                    } else {
                        const outlinePoints = new PolygonOffset(path.points).padding(off);
                        path.points = outlinePoints[0];
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

        const { pathType = 'path', targetDepth, fillEnabled, fillDensity } = gcodeConfig;
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
            fillEnabled: fillEnabled || true,
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
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
        }

        toolPath.move0Z(stopHeight, jogSpeed);
        toolPath.move0XY(0, 0, jogSpeed);
        toolPath.spindleOff();

        return toolPath;
    }


    generateToolPathObj(svg, modelInfo) {
        const { headType, mode, transformation, gcodeConfig, materials } = modelInfo;
        const { isRotate, diameter } = materials;

        const { positionX, positionY, positionZ } = transformation;

        this._processSVG(svg, modelInfo);

        const toolPath = this.generateToolPath(svg, modelInfo);

        const boundingBox = toolPath.boundingBox;

        if (isRotate) {
            boundingBox.max.b += toolPath.toB(positionX);
            boundingBox.min.b += toolPath.toB(positionX);
        } else {
            boundingBox.max.x += positionX;
            boundingBox.min.x += positionX;
        }
        boundingBox.max.y += positionY;
        boundingBox.min.y += positionY;

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
        return this.isRotate ? this._generateRotateViewPath(svg, modelInfo) : this._generateViewPathObj(svg, modelInfo);
    }

    _generateViewPathObj(svg, modelInfo) {
        const { sourceType, mode, transformation, gcodeConfig, toolParams } = modelInfo;

        const { targetDepth } = gcodeConfig;
        const { toolAngle, toolShaftDiameter } = toolParams;

        const { positionX, positionY, positionZ } = transformation;

        this._processSVG(svg, modelInfo);

        const minX = svg.viewBox[0];
        const maxX = svg.viewBox[0] + svg.viewBox[2];
        const minY = svg.viewBox[1];
        const maxY = svg.viewBox[1] + svg.viewBox[3];

        const width = maxX - minX;
        const height = maxY - minY;

        const normalizer = new Normalizer(
            'Center',
            minX,
            maxX,
            minY,
            maxY,
            { x: 1, y: 1 },
            { x: 0, y: 0 }
        );

        // radius needed to carve to `targetDepth`
        const radiusNeeded = (toolAngle === 180)
            ? (toolShaftDiameter * 0.5)
            : (targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180));
        const off = Math.min(radiusNeeded, toolShaftDiameter * 0.5);

        let progress = 0;
        // const polygons = null;
        // scan shapes
        const unions = [];
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

                const result = new PolygonOffset(path.points).ext(off);
                unions.push([result]);
                // polygons = polygons === null ? [result] : martinez.union(polygons, [result]);
            }
            const p = (i + 1) / svg.shapes.length;
            if (p - progress > 0.05) {
                progress = p;
                this.emit('progress', progress);
            }
        }

        const polygons = PolygonOffset.recursiveUnion(unions);

        const boundingBox = {
            min: {
                x: positionX - width / 2 - off,
                y: positionY - height / 2 - off,
                z: -targetDepth
            },
            max: {
                x: positionX + width / 2 + off,
                y: positionY + height / 2 + off,
                z: 0
            },
            length: {
                x: width + 2 * off,
                y: height + 2 * off,
                z: targetDepth
            }
        };

        const boxPoints = [
            [-off, -off],
            [-off, boundingBox.length.y - off],
            [boundingBox.length.x - off, boundingBox.length.y - off],
            [boundingBox.length.x - off, -off],
            [-off, -off]
        ];

        const viewPath = [boxPoints];
        for (const polygon of polygons) {
            for (const path of polygon) {
                viewPath.push(path);
            }
        }

        const data = [];

        for (let i = 0; i < viewPath.length; i++) {
            let order = false;
            for (let j = 0; j < viewPath.length; j++) {
                if (i === j) {
                    continue;
                }
                if (isPointInPolygon(viewPath[i][0], viewPath[j])) {
                    order = !order;
                }
            }
            new PolygonOffset()._orientRings(viewPath[i], order);
            data.push(viewPath[i].map(v => { return { x: normalizer.x(v[0]), y: normalizer.y(v[1]) }; }));
        }

        this.emit('progress', 1);

        return {
            sourceType: sourceType,
            mode: mode,
            positionX: positionX,
            positionY: positionY,
            positionZ: positionZ,
            targetDepth: targetDepth,
            boundingBox: boundingBox,
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
            rotationB: this.toolPath.toB(positionX),
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
