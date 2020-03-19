import { isUndefined } from 'lodash';
import * as THREE from 'three';

function drawBSpline(points) {
    let res = [];
    if (points.length === 4) {
        let ax, ay, bx, by, cx, cy, dx, dy, p0, p1;
        for (let t = 0; t < 1; t += 0.1) {
            p0 = (1 - t) ** 3 * points[0].x + 3 * t * (1 - t) ** 2 * points[1].x + 3 * t ** 2 * (1 - t) * points[2].x + t ** 3 * points[3].x;
            p1 = (1 - t) ** 3 * points[0].y + 3 * t * (1 - t) ** 2 * points[1].y + 3 * t ** 2 * (1 - t) * points[2].y + t ** 3 * points[3].y;
            res.push({ x: p0, y: p1, z: 0 });
        }
    } else if (points.length === 3) {
        console.log('points,length ==== 3');
    } else {
        res = points;
    }
    return res;
}

function mapPointToInteger(p, density) {
    return [
        Math.floor(p[0] * density),
        Math.floor(p[1] * density)
    ];
}

function extractSegment(canvas, width, height, start, direction, sign) {
    let len = 1;
    while (true) {
        const next = {
            x: start.x + direction.x * len * sign,
            y: start.y + direction.y * len * sign
        };
        if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) {
            break;
        }

        if (canvas[next.x][next.y] !== 1) {
            break;
        }

        len += 1;
    }
    return {
        start: start,
        end: {
            x: start.x + direction.x * (len - 1) * sign,
            y: start.y + direction.y * (len - 1) * sign
        }
    };
}

function canvasToSegments(segments, canvas, width, height, density) {
    const newSegments = [];
    const direction = { x: 1, y: 0 };
    for (let y = 0; y < height; y++) {
        const isReverse = (y % 2 === 1);
        const sign = isReverse ? -1 : 1;

        for (let x = (isReverse ? width - 1 : 0); isReverse ? x >= 0 : x < width; x += sign) {
            if (canvas[x][y] === 1) {
                const start = { x, y };
                const segment = extractSegment(canvas, width, height, start, direction, sign);

                // convert to metric coordinate
                newSegments.push({
                    start: [segment.start.x / density, segment.start.y / density],
                    end: [segment.end.x / density, segment.end.y / density]
                });
                x = segment.end.x;
            }
        }
    }
    return newSegments.concat(segments);
}

function drawPoint(image, width, height, x, y, color) {
    if (x < 0 || x >= width || y < 0 || y > height) {
        return;
    }
    image[x][y] = color;
}

function drawLine(image, width, height, p1, p2, color) {
    if (Math.abs(p1[0] - p2[0]) >= Math.abs(p1[1] - p2[1]) && p1[0] > p2[0]) {
        const tmp = p1;
        p1 = p2;
        p2 = tmp;
    }
    if (Math.abs(p1[0] - p2[0]) < Math.abs(p1[1] - p2[1]) && p1[1] > p2[1]) {
        const tmp = p1;
        p1 = p2;
        p2 = tmp;
    }

    const [x1, y1] = p1;
    const [x2, y2] = p2;

    if (Math.abs(x1 - x2) >= Math.abs(y1 - y2)) {
        if (x1 === x2) {
            drawPoint(image, width, height, x1, y1, color);
        } else {
            for (let x = x1; x <= x2; x++) {
                const y = Math.round(y1 + (x - x1) * (y2 - y1) / (x2 - x1));
                drawPoint(image, width, height, x, y, color);
            }
        }
    } else {
        if (y1 === y2) {
            drawPoint(image, x1, y1, color);
        } else {
            for (let y = y1; y <= y2; y++) {
                const x = Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
                drawPoint(image, width, height, x, y, color);
            }
        }
    }
}

function dxfToSegments(dxf, options = {}) {
    if (!options.fillEnabled) {
        const segments = [];
        for (const entities of dxf.entities) {
            if (dxf.tables && dxf.tables.layer
                && !isUndefined(dxf.tables.layer.layers[entities.layer].visible)
                && !dxf.tables.layer.layers[entities.layer].visible) {
                continue;
            }
            if (entities.type === 'LINE' || entities.type === 'LWPOLYLINE') {
                for (let i = 0; i < entities.vertices.length - 1; i++) {
                    const p1 = [entities.vertices[i].x, entities.vertices[i].y];
                    const p2 = [entities.vertices[i + 1].x, entities.vertices[i + 1].y];
                    segments.push({ start: p1, end: p2 });
                }
            } else if (entities.type === 'SPLINE') {
                let newControlPoints = [];
                newControlPoints = drawBSpline(entities.controlPoints);
                entities.controlPoints = newControlPoints;

                for (let i = 0; i < entities.controlPoints.length - 1; i++) {
                    const p1 = [entities.controlPoints[i].x, entities.controlPoints[i].y];
                    const p2 = [entities.controlPoints[i + 1].x, entities.controlPoints[i + 1].y];
                    segments.push({ start: p1, end: p2 });
                }
            } else if (entities.type === 'POLYLINE') {
                for (let i = 0; i < entities.vertices.length - 1; i++) {
                    const p1 = [entities.vertices[i].x, entities.vertices[i].y];
                    const p2 = [entities.vertices[i + 1].x, entities.vertices[i + 1].y];
                    segments.push({ start: p1, end: p2 });
                }
                const tempFirst = [entities.vertices[0].x, entities.vertices[0].y];
                const tempLast = [entities.vertices[entities.vertices.length - 1].x, entities.vertices[entities.vertices.length - 1].y];
                segments.push({ start: tempLast, end: tempFirst });
            } else if (entities.type === 'POINT') {
                if (entities.position.x === 0 && entities.position.y === 0) {
                    continue;
                }
                const obj = {};
                obj.start = [entities.position.x, entities.position.y];
                obj.end = [entities.position.x, entities.position.y];
                segments.push(obj);
            } else if (entities.type === 'CIRCLE') {
                const radius = entities.radius;
                const centerX = entities.center.x;
                const centerY = entities.center.y;
                for (let i = 0; i < 360; i += 5) {
                    const circleObj = {};
                    const x1 = centerX + radius * Math.cos(i * Math.PI / 180);
                    const y1 = centerY + radius * Math.sin(i * Math.PI / 180);
                    const x2 = centerX + radius * Math.cos((i + 5) * Math.PI / 180);
                    const y2 = centerY + radius * Math.sin((i + 5) * Math.PI / 180);
                    circleObj.start = [x1, y1];
                    circleObj.end = [x2, y2];
                    segments.push(circleObj);
                }
            }
        }
        return segments;
    } else {
        // TODO: entities.type === 'SPLINE'

        options.width = options.width || 10; // defaults to 10mm
        options.height = options.height || 10; // defaults to 10mm

        const color = 1; // only black & white, use 1 to mark canvas as painted
        const width = Math.round(options.width * options.fillDensity);
        const height = Math.round(options.height * options.fillDensity);

        const canvas = new Array(width);
        for (let i = 0; i < width; i++) {
            canvas[i] = new Uint8Array(height);
        }

        const segments = [];
        for (const entities of dxf.entities) {
            if (dxf.tables && dxf.tables.layer
                && !dxf.tables.layer.layers[entities.layer].visible) {
                continue;
            }
            const obj = {};
            if (entities.type === 'LINE' || entities.type === 'POLYLINE' || entities.type === 'LWPOLYLINE') {
                for (let i = 0; i < entities.vertices.length - 1; i++) {
                    const p1 = mapPointToInteger(entities.vertices[i].x, options.fillDensity);
                    const p2 = mapPointToInteger(entities.vertices[i].y, options.fillDensity);
                    drawLine(canvas, width, height, p1, p2, color);
                }
            } else if (entities.type === 'POINT') {
                if (entities.position.x === 0 && entities.position.y === 0) {
                    continue;
                }
                const p1 = mapPointToInteger(entities.position.x, options.fillDensity);
                const p2 = mapPointToInteger(entities.position.y, options.fillDensity);
                drawLine(canvas, width, height, p1, p2, color);
            } else if (entities.type === 'CIRCLE') {
                const radius = entities.radius;
                const centerX = entities.center.x;
                const centerY = entities.center.y;
                for (let i = 0; i < 360; i += 5) {
                    const circleObj = {};
                    const x1 = centerX + radius * Math.cos(i * Math.PI / 180);
                    const y1 = centerY + radius * Math.sin(i * Math.PI / 180);
                    const x2 = centerX + radius * Math.cos((i + 5) * Math.PI / 180);
                    const y2 = centerY + radius * Math.sin((i + 5) * Math.PI / 180);
                    circleObj.start = [x1, y1];
                    circleObj.end = [x2, y2];
                    segments.push(circleObj);
                }
            }
        }


        return canvasToSegments(segments, canvas, width, height, options.fillDensity);
    }
}

export {
    dxfToSegments
};
