/**
 * ToolPathGenerator
 *
 */

import EventEmitter from 'events';
import Offset from './polygon-offset';
import { flip, scale, rotate, translate } from '../SVGParser';
import Toolpath from '../ToolPath';
import GcodeParser from './GcodeParser';
import { svgToSegments } from './SVGFill';
import Normalizer from './Normalizer';

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
 * ToolPathGenerator
 */
export default class CNCToolPathGenerator extends EventEmitter {
    static processAnchor(svg, anchor, minX, maxX, minY, maxY) {
        let offsetX, offsetY;

        if (anchor.endsWith('Left')) {
            offsetX = minX;
        } else if (anchor.endsWith('Right')) {
            offsetX = maxX;
        } else {
            offsetX = (minX + maxX) * 0.5;
        }

        if (anchor.startsWith('Bottom')) {
            offsetY = minY;
        } else if (anchor.startsWith('Top')) {
            offsetY = maxY;
        } else {
            offsetY = (minY + maxY) * 0.5;
        }

        for (const shape of svg.shapes) {
            for (const path of shape.paths) {
                for (const point of path.points) {
                    point[0] -= offsetX;
                    point[1] -= offsetY;
                }
            }
        }

        svg.boundingBox.minX -= offsetX;
        svg.boundingBox.maxX -= offsetX;
        svg.boundingBox.minY -= offsetY;
        svg.boundingBox.maxY -= offsetY;

        return svg;
    }

    processPathType(svg, pathType, options) {
        if (pathType === 'path') {
            // empty
        } else if (pathType === 'outline') {
            const { targetDepth, toolAngle, toolDiameter } = options;

            // radius needed to carve to `targetDepth`
            const radiusNeeded = (toolAngle === 180)
                ? (toolDiameter * 0.5)
                : (targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180));
            const off = Math.min(radiusNeeded, toolDiameter * 0.5);

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
                    const offset = new Offset();

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
                            if (path2.closed && isPointInPolygon(path.points[0], path2)) {
                                inside = !inside;
                            }
                        }
                    }

                    // use margin / padding depending on `inside`
                    if (!inside) {
                        // TODO
                        path.points = offset.data(path.points).margin(off)[0];
                    } else {
                        path.points = offset.data(path.points).padding(off)[0];
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

    // Static method to generate `ToolPath` from SVG
    // static generateToolPathObj(svg, modelInfo) {
    generateToolPath(svg, modelInfo) {
        const { config, gcodeConfigPlaceholder } = modelInfo;
        const {
            pathType = 'path',
            toolDiameter, toolAngle,
            targetDepth, stepDown, safetyHeight, stopHeight,
            enableTab = false, tabWidth, tabHeight, tabSpace,
            fillEnabled, fillDensity
        } = config;
        const { jogSpeed, workSpeed, plungeSpeed } = gcodeConfigPlaceholder;

        // Process path according to path type
        this.processPathType(svg, pathType, {
            width: svg.viewBox[2],
            height: svg.viewBox[3],
            fillEnabled: fillEnabled || true,
            fillDensity: fillDensity || 5,
            targetDepth,
            toolAngle,
            toolDiameter
        });

        /*
        // TODO: normalizer
        CNCToolPathGenerator.processAnchor(svg,
            'Center',
            svg.viewBox[0],
            svg.viewBox[0] + svg.viewBox[2],
            svg.viewBox[1],
            svg.viewBox[1] + svg.viewBox[3]);
        */
        const normalizer = new Normalizer(
            'Center',
            svg.viewBox[0],
            svg.viewBox[0] + svg.viewBox[2],
            svg.viewBox[1],
            svg.viewBox[1] + svg.viewBox[3],
            { x: 1, y: 1 }
        );

        // Start generate tool path
        const toolPath = new Toolpath();
        toolPath.safeStart();
        toolPath.spindleOn();
        // toolPath.move0Z(safetyHeight, jogSpeed);
        toolPath.move0Z(safetyHeight, 100);

        const passes = Math.ceil(targetDepth / stepDown);
        let z = 0;
        let progress = 0;
        for (let pass = 0; pass < passes; pass++) {
            // drop z
            z = Math.max(-targetDepth, z - stepDown);

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

                    const points = path.points;

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

    // generateToolPath() {
    //     const { sizeWidth, sizeHeight, originWidth, originHeight } = this.options;
    //
    //     // TODO: add pipelines to filter & process data
    //     scale(this.svg, {
    //         x: sizeWidth / originWidth,
    //         y: sizeHeight / originHeight
    //     });
    //
    //     if (this.options.clip) {
    //         clip(this.svg);
    //     }
    //     if (this.options.anchor) {
    //         CNCToolPathGenerator.processAnchor(this.svg, this.options.anchor);
    //     }
    //
    //     return CNCToolPathGenerator.generateToolPathObj(this.svg, this.options);
    // }
    //
    // generateGcode() {
    //     const toolPath = this.generateToolPath();
    //     return toolPath.toGcode();
    // }

    generateToolPathObj(svg, modelInfo) {
        const { transformation, source } = modelInfo;

        const originWidth = source.width;
        const originHeight = source.height;

        const targetWidth = transformation.width;
        const targetHeight = transformation.height;

        // rotation: degree and counter-clockwise
        const rotation = transformation.rotation;
        const flipFlag = transformation.flip;

        // TODO: add pipelines to filter & process data
        flip(svg, 1);
        flip(svg, flipFlag);
        scale(svg, {
            x: targetWidth / originWidth,
            y: targetHeight / originHeight
        });
        rotate(svg, rotation);
        translate(svg, -svg.viewBox[0], -svg.viewBox[1]);

        const toolPath = this.generateToolPath(svg, modelInfo);
        const fakeGcode = toolPath.toGcode();
        const toolPathObject = new GcodeParser().parseGcodeToToolPathObj(fakeGcode, modelInfo);
        return toolPathObject;
    }
}
