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
class ToolPathGenerator {

    constructor(boundaries, options) {
        this.boundaries = boundaries || {};
        this.options = options || {};
    }

    convert() {
        const polygons = [];
        for (let color in this.boundaries) {
            if (Object.prototype.hasOwnProperty.call(this.boundaries, color)) {
                let paths = this.boundaries[color];
                for (let i = 0, nPath = paths.length; i < nPath; i++) {
                    polygons.push(paths[i]);
                }
            }
        }
        return polygons;
    }

    // remove duplicated points
    simplifyPath(path) {
        const res = [];
        let lastPoint;
        for (let p of path) {
            if (!lastPoint || (p[0] !== lastPoint[0] || p[1] !== lastPoint[1])) {
                res.push(p);
                lastPoint = p;
            }
        }
        return res;
    }

    simplifyPipe(polygons) {
        const res = [];
        for (let polygon of polygons) {
            res.push(this.simplifyPath(polygon));
        }
        return res;
    }

    clipPipe(polygons, clip = false) {
        if (!clip) {
            return polygons;
        }
        let [minX, maxY] = [Infinity, -Infinity];

        for (let polygon of polygons) {
            for (let point of polygon) {
                minX = Math.min(minX, point[0]);
                maxY = Math.max(maxY, point[1]);
            }
        }
        for (let i = 0, len = polygons.length; i < len; i++) {
            const polygon = polygons[i];
            const newPolygon = [];
            for (let point of polygon) {
                newPolygon.push([point[0] - minX, maxY - point[1]]);
            }
            polygons[i] = newPolygon;
        }
        return polygons;
    }

    scalePipe(polygons, originalSize, targetSize) {
        const xScale = targetSize[0] / originalSize[0];
        const yScale = targetSize[1] / originalSize[1];

        for (let i = 0, len = polygons.length; i < len; i++) {
            const polygon = polygons[i];
            const newPolygon = [];
            for (let p of polygon) {
                newPolygon.push([p[0] * xScale, p[1] * yScale]);
            }
            polygons[i] = newPolygon;
        }
        return polygons;
    }

    generateOutlineToolPath(polygons) {
        const toolDiameter = this.options.toolDiameter;
        const toolAngle = this.options.toolAngle;
        const targetDepth = this.options.targetDepth;

        // generate offset
        const offset = new Offset();
        const res = [];
        for (let i = 0, len = polygons.length; i < len; i++) {
            const polygon = polygons[i];

            // radius needed to carve to `targetDepth`
            const radiusNeeded = targetDepth * Math.tan(toolAngle / 2 * Math.PI / 180);
            const off = Math.min(radiusNeeded, toolDiameter * 0.5);

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
    }

    genToolPath() {
        const pathType = this.options.pathType;

        // TODO: add pipelines to filter & process data
        // convert boundaries to polygons format
        const polygons1 = this.convert(this.boundaries);
        // simplify polygons
        const polygons = this.simplifyPipe(polygons1);

        if (pathType === 'path') {
            this.polygons = polygons;
        } else if (pathType === 'outline') {
            this.polygons = this.generateOutlineToolPath(polygons);
        } else {
            // unknown path type
            this.polygons = [];
        }

        // clip on tool path
        this.polygons = this.scalePipe(this.polygons,
            [this.options.originWidth, this.options.originHeight],
            [this.options.sizeWidth, this.options.sizeHeight]
        );
        this.polygons = this.clipPipe(this.polygons, this.options.clip);
    }

    genGcode() {
        if (this.boundaries && !this.polygons) {
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
        const tabHeight = this.options.height; // negative
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

            for (let polygon of this.polygons) {
                const p0 = polygon[0];

                gcodeLines.push(`G0 X${p0[0]} Y${p0[1]} Z${safetyHeight} F${jogSpeed}`);
                gcodeLines.push(`G1 Z${z} F${plungeSpeed}`);

                if (enableTab && z < tabHeight) {
                    let tabMode = false;
                    let modeLimit = tabSpace;
                    let modeHeight = z;
                    let modeDistance = 0;
                    let modePoint = polygon[0];

                    let i = 1;
                    while (i < polygon.length) {
                        const point = polygon[i];
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
                            modeDistance += edgeLength;
                            gcodeLines.push(`G1 X${point[0]} Y${point[1]} Z${modeHeight} F${workSpeed}`);
                            i++;
                        }
                    }
                } else {
                    for (let i = 1, length = polygon.length; i < length; i++) {
                        const point = polygon[i];
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

export default ToolPathGenerator;
