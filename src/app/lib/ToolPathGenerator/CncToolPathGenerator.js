/**
 * ToolPathGenerator
 *
 */

import Offset from './polygon-offset';

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
export default class CncToolPathGenerator {
    constructor(svg, options) {
        this.svg = svg || {};
        this.options = options || {};
    }

    convert(size) {
        // convert boundaries to polygons and flip Y axis
        for (let shapes of this.svg.shapes) {
            for (let path of shapes.paths) {
                for (let point of path.points) {
                    point[1] = size[1] - point[1];
                }
            }
        }
    }

    // remove duplicated points
    /*
    simplifyPath(path) {
        const res = [];
        let lastPoint = null;
        for (let p of path) {
            if (!lastPoint || (p[0] !== lastPoint[0] || p[1] !== lastPoint[1])) {
                res.push(p);
                lastPoint = p;
            }
        }
        return res;
    }*/

    alignmentPipe(paths, alignment = 'clip') {
        if (alignment === 'none') {
            return paths;
        }
        let [minX, maxX] = [Infinity, -Infinity];
        let [minY, maxY] = [Infinity, -Infinity];

        for (let path of paths) {
            for (let point of path) {
                minX = Math.min(minX, point[0]);
                maxX = Math.max(maxX, point[0]);
                minY = Math.min(minY, point[1]);
                maxY = Math.max(maxY, point[1]);
            }
        }
        for (let i = 0, len = paths.length; i < len; i++) {
            const path = paths[i];
            const newPath = [];
            for (let point of path) {
                if (alignment === 'clip') {
                    newPath.push([point[0] - minX, point[1] - minY]);
                } else {
                    newPath.push([point[0] - (minX + maxX) * 0.5, point[1] - (minY + maxY) * 0.5]);
                }
            }
            paths[i] = newPath;
        }

        return paths;
    }

    scalePipe(paths, originalSize, targetSize) {
        const xScale = targetSize[0] / originalSize[0];
        const yScale = targetSize[1] / originalSize[1];

        for (let i = 0, len = paths.length; i < len; i++) {
            const path = paths[i];
            const newPath = [];
            for (let p of path) {
                newPath.push([p[0] * xScale, p[1] * yScale]);
            }
            paths[i] = newPath;
        }
        return paths;
    }

    generatePathToolPath() {
        const paths = [];

        for (let i = 0; i < this.svg.shapes.length; i++) {
            const shape = this.svg.shapes[i];
            if (!shape.visibility) {
                continue;
            }

            for (let j = 0; j < shape.paths.length; j++) {
                const path = shape.paths[j];
                paths.push(path.points);
            }
        }

        return paths;
    }

    generateOutlineToolPath() {
        const { toolDiameter, toolAngle, targetDepth } = this.options;

        // generate offset
        const offset = new Offset();

        const paths = [];
        for (let i = 0; i < this.svg.shapes.length; i++) {
            const shape = this.svg.shapes[i];
            if (!shape.visibility) {
                continue;
            }

            for (let j = 0; j < shape.paths.length; j++) {
                const path = shape.paths[j];

                let inside = false;
                for (let i2 = 0; i2 < this.svg.shapes.length; i2++) {
                    const shape2 = this.svg.shapes[i2];
                    if (!shape2.visibility) {
                        continue;
                    }

                    for (let j2 = 0; j2 < shape2.paths.length; j2++) {
                        if (i === i2 && j === j2) {
                            continue;
                        }

                        const path2 = shape2.paths[j2];
                        // pretend that path2 is closed shape
                        if (isPointInPolygon(path.points[0], path2)) {
                            inside = !inside;
                        }
                    }
                }

                // radius needed to carve to `targetDepth`
                const radiusNeeded = targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180);
                const off = Math.min(radiusNeeded, toolDiameter * 0.5);

                // use margin / padding depending on `inside`
                if (!inside) {
                    const marginPolygons = offset.data(path).margin(off);
                    paths.push(...marginPolygons);
                } else {
                    const paddingPolygons = offset.data(path).padding(off);
                    paths.push(...paddingPolygons);
                }
            }
        }

        return paths;

        /*
        for (let i = 0, len = polygons.length; i < len; i++) {
            const polygon = polygons[i];

            // check if polygon is inside other polygons
            let inside = false;
            for (let j = 0, len = polygons.length; j < len; j++) {
                if (i !== j) {
                    const polygon2 = polygons[j];
                    if (isPointInPolygon(polygon[0], polygon2)) {
                        inside = !inside;
                    }
                }
            }

            // radius needed to carve to `targetDepth`
            const radiusNeeded = targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180);
            const off = Math.min(radiusNeeded, toolDiameter * 0.5);

            // use margin / padding depending on `inside`
            if (!inside) {
                const marginPolygons = offset.data(polygon).margin(off);
                res.push(...marginPolygons);
            } else {
                const paddingPolygons = offset.data(polygon).padding(off);
                res.push(...paddingPolygons);
            }
        }
        return res;
        */
    }

    genToolPath() {
        const pathType = this.options.pathType;

        // TODO: add pipelines to filter & process data
        // convert boundaries to polygons format
        this.convert([this.options.originWidth, this.options.originHeight]);

        // simplify polygons
        /*
        for (let shapes of this.svg.shapes) {
            for (let path of shapes.paths) {
                this.simplifyPath(path);
            }
        }*/

        let paths = [];
        if (pathType === 'path') {
            paths = this.generatePathToolPath();
        } else if (pathType === 'outline') {
            paths = this.generateOutlineToolPath();
        } else {
            paths = [];
        }

        // clip on tool path
        this.paths = this.scalePipe(
            paths,
            [this.options.originWidth, this.options.originHeight],
            [this.options.sizeWidth, this.options.sizeHeight]
        );
        this.paths = this.alignmentPipe(this.paths, this.options.alignment);
    }

    generateGcode() {
        if (!this.paths) {
            this.genToolPath();
        }
        const workSpeed = this.options.workSpeed;
        const jogSpeed = this.options.jogSpeed;
        const plungeSpeed = this.options.plungeSpeed;

        const targetDepth = this.options.targetDepth;
        const stepDown = this.options.stepDown;
        const safetyHeight = this.options.safetyHeight;
        const stopHeight = this.options.stopHeight;

        const enableTab = this.options.enableTab || false;
        const tabWidth = this.options.tabWidth;
        const tabHeight = this.options.tabHeight; // negative
        const tabSpace = this.options.tabSpace;

        const passes = Math.ceil(targetDepth / stepDown);

        const gcodeLines = [
            'M3',
            `G0 Z${safetyHeight} F${jogSpeed}`
        ];

        // note that depth is positive
        let z = 0;
        for (let pass = 0; pass < passes; pass++) {
            z = Math.max(-targetDepth, z - stepDown);

            for (let path of this.paths) {
                const p0 = path[0];

                gcodeLines.push(`G0 X${p0[0]} Y${p0[1]} Z${safetyHeight} F${jogSpeed}`);
                gcodeLines.push(`G1 Z${z} F${plungeSpeed}`);

                if (enableTab && z < tabHeight) {
                    let tabMode = false;
                    let modeLimit = tabSpace;
                    let modeHeight = z;
                    let modeDistance = 0;
                    let modePoint = path[0];

                    let i = 1;
                    while (i < path.length) {
                        const point = path[i];
                        const edgeLength = distance(modePoint, point);

                        if (modeDistance + edgeLength > modeLimit) {
                            const factor = 1 - (modeLimit - modeDistance) / edgeLength;
                            const joint = [
                                modePoint[0] * factor + point[0] * (1 - factor),
                                modePoint[1] * factor + point[1] * (1 - factor)
                            ];

                            // run to joint in current mode
                            gcodeLines.push(`G1 X${joint[0]} Y${joint[1]} Z${modeHeight} F${workSpeed}`);

                            // switch mode
                            tabMode = !tabMode;
                            modeHeight = (tabMode ? tabHeight : z);
                            modeLimit = (tabMode ? tabWidth : tabSpace);
                            modePoint = joint;
                            modeDistance = 0;
                            // run to new height
                            gcodeLines.push(`G1 Z${modeHeight} F${workSpeed}`);
                        } else {
                            modePoint = point;
                            modeDistance += edgeLength;
                            gcodeLines.push(`G1 X${point[0]} Y${point[1]} Z${modeHeight} F${workSpeed}`);
                            i++;
                        }
                    }
                } else {
                    for (let i = 1, length = path.length; i < length; i++) {
                        const point = path[i];
                        gcodeLines.push(`G1 X${point[0]} Y${point[1]} Z${z} F${workSpeed}`);
                    }
                }

                gcodeLines.push(`G1 X${p0[0]} Y${p0[1]} Z${z} F${workSpeed}`);
                gcodeLines.push(`G0 Z${safetyHeight} F${jogSpeed}`);
            }
        }
        gcodeLines.push(`G0 Z${stopHeight} F${jogSpeed}`);
        gcodeLines.push(`G0 X0 Y0 F${jogSpeed}`);
        gcodeLines.push('M5');

        return gcodeLines.join('\n');
    }
}
