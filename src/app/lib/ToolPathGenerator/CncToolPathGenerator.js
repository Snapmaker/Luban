/**
 * ToolPathGenerator
 *
 */

import Offset from './polygon-offset';
import { flip, scale, clip } from '../SVGParser';
import Toolpath from '../ToolPath';
import GcodeParser from './GcodeParser';

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

        if ((p[1] > point[1]) !== (q[1] > point[1]) &&
            point[0] < p[0] + (q[0] - p[0]) * (point[1] - p[1]) / (q[1] - p[1])) {
            inside = !inside;
        }
    }
    return inside;
}


/**
 * ToolPathGenerator
 */
export default class CNCToolPathGenerator {
    constructor(svg, options) {
        this.svg = svg || {};
        flip(this.svg);
        this.options = options || {};
    }

    static processAnchor(svg, anchor) {
        let offsetX, offsetY;

        if (anchor.endsWith('Left')) {
            offsetX = svg.boundingBox.minX;
        } else if (anchor.endsWith('Right')) {
            offsetX = svg.boundingBox.maxX;
        } else {
            offsetX = (svg.boundingBox.minX + svg.boundingBox.maxX) * 0.5;
        }

        if (anchor.startsWith('Bottom')) {
            offsetY = svg.boundingBox.minY;
        } else if (anchor.startsWith('Top')) {
            offsetY = svg.boundingBox.maxY;
        } else {
            offsetY = (svg.boundingBox.minY + svg.boundingBox.maxY) * 0.5;
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

    // Static method to generate `ToolPath` from SVG
    static generateToolPathObj(svg, options) {
        const {
            pathType = 'path',
            toolDiameter, toolAngle,
            targetDepth, stepDown, jogSpeed, workSpeed, plungeSpeed, safetyHeight, stopHeight,
            enableTab = false, tabWidth, tabHeight, tabSpace
        } = options;

        const passes = Math.ceil(targetDepth / stepDown);

        const toolPath = new Toolpath();
        toolPath.spindleOn();
        toolPath.move0Z(safetyHeight, jogSpeed);

        let z = 0;
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

                    let points = [];
                    if (pathType === 'path') {
                        points = path.points;
                    } else if (pathType === 'outline' && path.closed) {
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

                        // radius needed to carve to `targetDepth`
                        const radiusNeeded = targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180);
                        const off = Math.min(radiusNeeded, toolDiameter * 0.5);

                        // use margin / padding depending on `inside`
                        if (!inside) {
                            points = offset.data(path.points).margin(off)[0];
                        } else {
                            points = offset.data(path.points).padding(off)[0];
                        }
                    } else {
                        points = path.points;
                    }

                    // move to target start point
                    let p0 = points[0];
                    toolPath.move0XY(p0[0], p0[1], jogSpeed);

                    // plunge down
                    toolPath.move1Z(z, plungeSpeed);

                    if (enableTab && z < tabHeight) {
                        let tabMode = false;
                        let modeLimit = tabSpace;
                        let modeHeight = z;
                        let modeDistance = 0;
                        let modePoint = p0;

                        let i = 1;
                        while (i < points.length) {
                            const p = points[i];
                            const edgeLength = distance(modePoint, p);

                            if (modeDistance + edgeLength >= modeLimit) {
                                const factor = 1 - (modeLimit - modeDistance) / edgeLength;
                                const joint = [
                                    modePoint[0] * factor + p[0] * (1 - factor),
                                    modePoint[1] * factor + p[1] * (1 - factor)
                                ];

                                // run to joint in current mode
                                toolPath.move1XY(joint[0], joint[1], workSpeed);

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
                                toolPath.move1XY(p[0], p[1], workSpeed);
                                i++;
                            }
                        }
                    } else {
                        for (let i = 1, length = points.length; i < length; i++) {
                            const p = points[i];
                            toolPath.move1XY(p[0], p[1], workSpeed);
                        }
                    }

                    // move to safety height
                    toolPath.move0Z(safetyHeight, jogSpeed);
                }
            }
        }

        toolPath.move0Z(stopHeight, jogSpeed);
        toolPath.move0XY(0, 0, jogSpeed);
        toolPath.spindleOff();

        return toolPath;
    }

    generateToolPath() {
        const { sizeWidth, sizeHeight, originWidth, originHeight } = this.options;

        // TODO: add pipelines to filter & process data
        scale(this.svg, {
            x: sizeWidth / originWidth,
            y: sizeHeight / originHeight
        });

        if (this.options.clip) {
            clip(this.svg);
        }
        if (this.options.anchor) {
            CNCToolPathGenerator.processAnchor(this.svg, this.options.anchor);
        }

        return CNCToolPathGenerator.generateToolPathObj(this.svg, this.options);
    }

    generateGcode() {
        const toolPath = this.generateToolPath();
        return toolPath.toGcode();
    }

    generateToolPathObj() {
        const { sizeWidth, sizeHeight, originWidth, originHeight, type } = this.options;

        // TODO: add pipelines to filter & process data
        scale(this.svg, {
            x: sizeWidth / originWidth,
            y: sizeHeight / originHeight
        });

        if (this.options.clip) {
            clip(this.svg);
        }
        if (this.options.anchor) {
            CNCToolPathGenerator.processAnchor(this.svg, this.options.anchor);
        }

        const toolPath = CNCToolPathGenerator.generateToolPathObj(this.svg, this.options);
        const fakeGcode = toolPath.toGcode();
        const toolPathObject = new GcodeParser().parseGcodeToToolPathObj(fakeGcode, type);
        return toolPathObject;
    }
}
