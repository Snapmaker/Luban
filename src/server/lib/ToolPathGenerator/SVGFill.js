function mapPointToInteger(p, density) {
    return [
        Math.floor(p[0] * density),
        Math.floor(p[1] * density)
    ];
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

function fillShape(image, width, height, shape, color) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const path of shape.paths) {
        for (const point of path.points) {
            minY = Math.min(minY, point[1]);
            maxY = Math.max(maxY, point[1]);
        }
    }

    for (let y = minY; y <= maxY; y++) {
        const jointXs = [];

        for (const path of shape.paths) {
            const points = path.points;
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                const [x1, y1] = p1;
                const [x2, y2] = p2;

                // duplicate point
                if (x1 === x2 && y1 === y2) {
                    continue;
                }

                if (y1 <= y && y <= y2 || y2 <= y && y <= y1) {
                    if (y === y1 && y === y2) {
                        // don't count
                    } else {
                        const x = Math.round(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
                        if (y !== Math.max(y1, y2)) {
                            jointXs.push(x);
                        }
                    }
                }
            }
        }

        jointXs.sort((a, b) => (a - b));

        for (let i = 0; i < jointXs.length; i += 2) {
            const x1 = jointXs[i];
            const x2 = jointXs[i + 1];
            for (let x = x1; x <= x2; x++) {
                drawPoint(image, width, height, x, y, color);
            }
        }
    }
}

function canvasToSegments(canvas, width, height, density) {
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

    const segments = [];
    const direction = { x: 1, y: 0 };
    for (let y = 0; y < height; y++) {
        const isReverse = (y % 2 === 1);
        const sign = isReverse ? -1 : 1;

        for (let x = (isReverse ? width - 1 : 0); isReverse ? x >= 0 : x < width; x += sign) {
            if (canvas[x][y] === 1) {
                const start = { x, y };
                const segment = extractSegment(canvas, width, height, start, direction, sign);

                // convert to metric coordinate
                segments.push({
                    start: [segment.start.x / density, segment.start.y / density],
                    end: [segment.end.x / density, segment.end.y / density]
                });
                x = segment.end.x;
            }
        }
    }
    return segments;
}

export function svgToSegments(svg, options = {}) {
    if (!options.fillEnabled) {
        const segments = [];
        for (const shape of svg.shapes) {
            if (!shape.visibility) {
                continue;
            }

            for (const path of shape.paths) {
                for (let i = 0; i < path.points.length - 1; i++) {
                    const p1 = path.points[i];
                    const p2 = path.points[i + 1];
                    segments.push({ start: p1, end: p2 });
                }
            }
        }
        return segments;
    } else {
        options.width = options.width || 10; // defaults to 10mm
        options.height = options.height || 10; // defaults to 10mm

        const color = 1; // only black & white, use 1 to mark canvas as painted
        const width = Math.round(options.width * options.fillDensity);
        const height = Math.round(options.height * options.fillDensity);

        const canvas = new Array(width);
        for (let i = 0; i < width; i++) {
            canvas[i] = new Uint8Array(height);
        }

        for (const shape of svg.shapes) {
            if (!shape.visibility) {
                continue;
            }

            for (const path of shape.paths) {
                for (let i = 0; i < path.points.length - 1; i++) {
                    const p1 = mapPointToInteger(path.points[i], options.fillDensity);
                    const p2 = mapPointToInteger(path.points[i + 1], options.fillDensity);
                    drawLine(canvas, width, height, p1, p2, color);
                }
            }

            if (shape.fill) {
                const newShape = {
                    paths: []
                };
                for (const path of shape.paths) {
                    if (path.closed) {
                        const newPath = {
                            points: []
                        };
                        for (const point of path.points) {
                            newPath.points.push(mapPointToInteger(point, options.fillDensity));
                        }
                        newShape.paths.push(newPath);
                    }
                }
                fillShape(canvas, width, height, newShape, color);
            }
        }

        return canvasToSegments(canvas, width, height, options.fillDensity);
    }
}
