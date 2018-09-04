import Jimp from 'jimp';
import SVGParser, { sortShapes, flip, scale } from '../SVGParser';


class Normalizer {
    constructor(anchor, minX, maxX, minY, maxY, scale) {
        this.anchor = anchor;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.scale = scale;
    }

    x(x) {
        if (this.anchor.endsWith('Left')) {
            x -= this.minX;
        } else if (this.anchor.endsWith('Right')) {
            x -= this.maxX;
        } else {
            x -= (this.minX + this.maxX) * 0.5;
        }
        return Number((x * this.scale.x).toFixed(4));
    }

    y(y) {
        if (this.anchor.startsWith('Bottom')) {
            y -= this.minY;
        } else if (this.anchor.startsWith('Top')) {
            y -= this.maxY;
        } else {
            y -= (this.minY + this.maxY) * 0.5;
        }
        return Number((y * this.scale.y).toFixed(4));
    }
}

// function cross(p0, p1, p2) {
//     return (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
// }

function pointEqual(p1, p2) {
    return p1[0] === p2[0] && p1[1] === p2[1];
}

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
        const tmp = p1; p1 = p2; p2 = tmp;
    }
    if (Math.abs(p1[0] - p2[0]) < Math.abs(p1[1] - p2[1]) && p1[1] > p2[1]) {
        const tmp = p1; p1 = p2; p2 = tmp;
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
    for (let path of shape.paths) {
        for (let point of path.points) {
            minY = Math.min(minY, point[1]);
            maxY = Math.max(maxY, point[1]);
        }
    }

    for (let y = minY; y <= maxY; y++) {
        const jointXs = [];

        for (let path of shape.paths) {
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
                x: start.x + direction.x * len * sign,
                y: start.y + direction.y * len * sign
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

// @param {object} options.useFill Use fill information or not
function svgToSegments(svg, options = {}) {
    if (!options.density) {
        const segments = [];
        for (let shape of svg.shapes) {
            if (!shape.visibility) {
                continue;
            }

            for (let path of shape.paths) {
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
        const width = Math.round(options.width * options.density);
        const height = Math.round(options.height * options.density);

        const canvas = new Array(width);
        for (let i = 0; i < width; i++) {
            canvas[i] = new Uint8Array(height);
        }

        for (let shape of svg.shapes) {
            if (!shape.visibility) {
                continue;
            }

            for (let path of shape.paths) {
                for (let i = 0; i < path.points.length - 1; i++) {
                    const p1 = mapPointToInteger(path.points[i], options.density);
                    const p2 = mapPointToInteger(path.points[i + 1], options.density);
                    drawLine(canvas, width, height, p1, p2, color);
                }
            }

            if (shape.fill) {
                const newShape = {
                    paths: []
                };
                for (let path of shape.paths) {
                    if (path.closed) {
                        const newPath = {
                            points: []
                        };
                        for (let point of path.points) {
                            newPath.points.push(mapPointToInteger(point, options.density));
                        }
                        newShape.paths.push(newPath);
                    }
                }
                fillShape(canvas, width, height, newShape, color);
            }
        }

        return canvasToSegments(canvas, width, height, options.density);
    }
}


class LaserToolPathGenerator {
    constructor(options) {
        this.options = options;
    }

    getGcodeHeader() {
        const date = new Date();
        return [
            '; Laser text engrave G-code',
            '; Generated by Snapmakerjs',
            `; ${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
        ].join('\n') + '\n';
    }

    generateGcode() {
        const { mode } = this.options;
        if (mode === 'greyscale') {
            return this.generateGcodeGreyscale();
        } else if (mode === 'bw') {
            return this.generateGcodeBW();
        } else if (mode === 'vector') {
            return this.generateGcodeVector();
        } else if (mode === 'text') {
            return this.generateGcodeText();
        } else {
            return Promise.reject(new Error('Unsupported mode'));
        }
    }

    generateGcodeGreyscale() {
        const { source, target, greyscaleMode } = this.options;

        return Jimp
            .read(source.processed)
            .then(img => img.mirror(false, true))
            .then(img => {
                const width = img.bitmap.width;
                const height = img.bitmap.height;

                const normalizer = new Normalizer(target.anchor, 0, width, 0, height, {
                    x: 1 / greyscaleMode.density,
                    y: 1 / greyscaleMode.density
                });

                // const xOffset = alignment === 'center' ? -width / density * 0.5 : 0;
                // const yOffset = alignment === 'center' ? -height / density * 0.5 : 0;

                let content = this.getGcodeHeader();
                content += 'G90\n';
                content += 'G21\n';
                content += `G1 F${target.workSpeed}\n`;

                for (let i = 0; i < width; ++i) {
                    const isReverse = (i % 2 === 0);
                    for (let j = (isReverse ? height : 0); isReverse ? j >= 0 : j < height; isReverse ? j-- : j++) {
                        const idx = j * width * 4 + i * 4;
                        if (img.bitmap.data[idx] < 128) {
                            content += `G1 X${normalizer.x(i)} Y${normalizer.y(j)}\n`;
                            content += 'M03\n';
                            content += `G4 P${target.dwellTime}\n`;
                            content += 'M05\n';
                        }
                    }
                }
                content += 'G0 X0 Y0';

                return content;
            });
    }

    generateGcodeBW() {
        const { source, target, bwMode } = this.options;

        function extractSegment(data, start, box, direction, sign) {
            let len = 1;
            function idx(pos) {
                return pos.x * 4 + pos.y * box.width * 4;
            }
            for (;;) {
                let cur = {
                    x: start.x + direction.x * len * sign,
                    y: start.y + direction.y * len * sign
                };
                if (data[idx(cur)] !== data[idx(start)]
                || cur.x < 0 || cur.x >= box.width
                || cur.y < 0 || cur.y >= box.height) {
                    break;
                }
                len += 1;
            }
            return len;
        }

        function genMovement(normalizer, start, end) {
            return [
                `G0 X${normalizer.x(start.x)} Y${normalizer.y(start.y)}`,
                'M3',
                `G1 X${normalizer.x(end.x)} Y${normalizer.y(end.y)}`,
                'M5'
            ].join('\n') + '\n';
        }

        return Jimp
            .read(source.processed)
            .then(img => img.mirror(false, true))
            .then(img => {
                const width = img.bitmap.width;
                const height = img.bitmap.height;

                const normalizer = new Normalizer(target.anchor, 0, width, 0, height, {
                    x: 1 / bwMode.density,
                    y: 1 / bwMode.density
                });

                let content = '';

                content += 'G90\n';
                content += 'G21\n';
                content += `G0 F${target.jogSpeed}\n`;
                content += `G1 F${target.workSpeed}\n`;

                if (bwMode.direction === 'Horizontal') {
                    const direction = { x: 1, y: 0 };
                    for (let j = 0; j < height; j++) {
                        let len = 0;
                        const isReverse = (j % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                            const idx = i * 4 + j * width * 4;
                            if (img.bitmap.data[idx] <= 128) {
                                const start = {
                                    x: i,
                                    y: j
                                };
                                len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                                const end = {
                                    x: start.x + direction.x * len * sign,
                                    y: start.y + direction.y * len * sign
                                };
                                content += genMovement(normalizer, start, end);
                            } else {
                                len = 1;
                            }
                        }
                    }
                } else if (bwMode.direction === 'Vertical') {
                    let direction = { x: 0, y: 1 };

                    for (let i = 0; i < width; ++i) {
                        let len = 0;
                        const isReverse = (i % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let j = (isReverse ? height - 1 : 0); isReverse ? j >= 0 : j < height; j += len * sign) {
                            const idx = i * 4 + j * width * 4;
                            if (img.bitmap.data[idx] <= 128) {
                                const start = {
                                    x: i,
                                    y: j
                                };
                                len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                                const end = {
                                    x: start.x + direction.x * len * sign,
                                    y: start.y + direction.y * len * sign
                                };
                                content += genMovement(normalizer, start, end);
                            } else {
                                len = 1;
                            }
                        }
                    }
                } else if (bwMode.direction === 'Diagonal') {
                    const direction = { x: 1, y: -1 };

                    for (let k = 0; k < width + height - 1; k++) {
                        let len = 0;
                        const isReverse = (k % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                            const j = k - i;
                            if (j < 0 || j > height) {
                                len = 1; // FIXME: optimize
                            } else {
                                const idx = i * 4 + j * width * 4;
                                if (img.bitmap.data[idx] <= 128) {
                                    const start = {
                                        x: i,
                                        y: j
                                    };
                                    len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                                    const end = {
                                        x: start.x + direction.x * len * sign,
                                        y: start.y + direction.y * len * sign
                                    };
                                    content += genMovement(normalizer, start, end);
                                } else {
                                    len = 1;
                                }
                            }
                        }
                    }
                } else if (bwMode.direction === 'Diagonal2') {
                    const direction = { x: 1, y: 1 };

                    for (let k = -height; k <= width; k++) {
                        const isReverse = (k % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        let len = 0;
                        for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                            const j = i - k;
                            if (j < 0 || j > height) {
                                len = 1;
                            } else {
                                const idx = i * 4 + j * width * 4;
                                if (img.bitmap.data[idx] <= 128) {
                                    let start = {
                                        x: i,
                                        y: j
                                    };
                                    len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);
                                    const end = {
                                        x: start.x + direction.x * len * sign,
                                        y: start.y + direction.y * len * sign
                                    };
                                    content += genMovement(normalizer, start, end);
                                } else {
                                    len = 1;
                                }
                            }
                        }
                    }
                }
                content += 'G0 X0 Y0\n';
                return content;
            });
    }

    async generateGcodeVector() {
        const { source, target, vectorMode } = this.options;

        const svgParser = new SVGParser();

        const svg = await svgParser.parseFile(source.processed);
        flip(svg);
        scale(svg, {
            x: target.width / source.width,
            y: target.height / source.height
        });
        if (vectorMode.optimizePath) {
            sortShapes(svg);
        }

        const normalizer = new Normalizer(
            target.anchor,
            svg.boundingBox.minX,
            svg.boundingBox.maxX,
            svg.boundingBox.minY,
            svg.boundingBox.maxY,
            { x: 1, y: 1 }
        );

        const segments = svgToSegments(svg, {
            width: target.width,
            height: target.height,
            density: vectorMode.fillDensity
        });

        // second pass generate gcode
        let content = this.getGcodeHeader();
        content += `G0 F${target.jogSpeed}\n`;
        content += `G1 F${target.workSpeed}\n`;

        let current = null;
        for (let segment of segments) {
            // G0 move to start
            if (!current || current && !(pointEqual(current, segment.start))) {
                if (current) {
                    content += 'M5\n';
                }
                content += `G0 X${normalizer.x(segment.start[0])} Y${normalizer.y(segment.start[1])}\n`;
            }

            // G0 move to end
            content += 'M3\n';
            content += `G1 X${normalizer.x(segment.end[0])} Y${normalizer.y(segment.end[1])}\n`;

            current = segment.end;
        }

        // turn off
        if (current) {
            content += 'M5\n';
        }

        content += 'G0 X0 Y0\n';

        return content;
    }

    async generateGcodeText() {
        const { source, target, textMode } = this.options;

        const svgParser = new SVGParser();

        const svg = await svgParser.parseFile(source.image);
        flip(svg);
        scale(svg, {
            x: target.width / source.width,
            y: target.height / source.height
        });

        const normalizer = new Normalizer(
            target.anchor,
            svg.boundingBox.minX,
            svg.boundingBox.maxX,
            svg.boundingBox.minY,
            svg.boundingBox.maxY,
            { x: 1, y: 1 }
        );

        const segments = svgToSegments(svg, {
            width: target.width,
            height: target.height,
            density: textMode.fillDensity
        });

        // second pass generate gcode
        let content = this.getGcodeHeader();
        content += `G0 F${target.jogSpeed}\n`;
        content += `G1 F${target.workSpeed}\n`;

        let current = null;
        for (let segment of segments) {
            // G0 move to start
            if (!current || current && !(pointEqual(current, segment.start))) {
                if (current) {
                    content += 'M5\n';
                }
                content += `G0 X${normalizer.x(segment.start[0])} Y${normalizer.y(segment.start[1])}\n`;
            }

            // G0 move to end
            content += 'M3\n';
            content += `G1 X${normalizer.x(segment.end[0])} Y${normalizer.y(segment.end[1])}\n`;

            current = segment.end;
        }

        // turn off
        if (current) {
            content += 'M5\n';
        }

        // move to work zero
        content += 'G0 X0 Y0\n';

        return content;
    }
}

export default LaserToolPathGenerator;
