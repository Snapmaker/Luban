import Jimp from 'jimp';
import EventEmitter from 'events';
import SVGParser, { flip, rotate, scale, sortShapes, translate } from '../SVGParser';
import GcodeParser from './GcodeParser';
import { Normalizer } from './Normalizer';

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

// @param {object} options.useFill Use fill information or not
function svgToSegments(svg, options = {}) {
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

class LaserToolPathGenerator extends EventEmitter {
    getGcodeHeader() {
        const date = new Date();
        return [
            '; G-code for laser engraving',
            '; Generated by Snapmakerjs',
            `; ${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
        ].join('\n') + '\n\n';
    }

    async generateToolPathObj(modelInfo, modelPath) {
        const { mode } = modelInfo;
        const { movementMode } = modelInfo.config;

        let fakeGcode = this.getGcodeHeader();

        fakeGcode += 'G90\n'; // absolute position
        fakeGcode += 'G21\n'; // millimeter units

        let workingGcode = '';
        if (mode === 'bw' || (mode === 'greyscale' && movementMode === 'greyscale-line')) {
            workingGcode = await this.generateGcodeBW(modelInfo, modelPath);
        } else if (mode === 'greyscale') {
            workingGcode = await this.generateGcodeGreyscale(modelInfo, modelPath);
        } else if (mode === 'vector') {
            workingGcode = await this.generateGcodeVector(modelInfo, modelPath);
        } else {
            return Promise.reject(new Error('Unsupported process mode: ' + mode));
        }

        fakeGcode += '; G-code START <<<\n';
        fakeGcode += workingGcode + '\n';
        fakeGcode += '; G-code END <<<\n';

        const toolPathObject = new GcodeParser().parseGcodeToToolPathObj(fakeGcode, modelInfo);
        return toolPathObject;
    }

    generateGcodeGreyscale(modelInfo, modelPath) {
        const { gcodeConfigPlaceholder, config } = modelInfo;
        const { workSpeed, dwellTime } = gcodeConfigPlaceholder;
        const { bwThreshold } = config;
        return Jimp
            .read(modelPath)
            .then(img => img.mirror(false, true))
            .then(img => {
                const width = img.bitmap.width;
                const height = img.bitmap.height;
                const normalizer = new Normalizer('Center', 0, width, 0, height, {
                    x: 1 / config.density,
                    y: 1 / config.density
                });

                // const xOffset = alignment === 'center' ? -width / density * 0.5 : 0;
                // const yOffset = alignment === 'center' ? -height / density * 0.5 : 0;

                let progress = 0;
                let partition = Math.floor(width / 20);
                let content = '';
                content += `G1 F${workSpeed}\n`;

                for (let i = 0; i < width; ++i) {
                    const isReverse = (i % 2 === 0);
                    for (let j = (isReverse ? height : 0); isReverse ? j >= 0 : j < height; isReverse ? j-- : j++) {
                        const idx = j * width * 4 + i * 4;
                        if (img.bitmap.data[idx] < bwThreshold) {
                            content += `G1 X${normalizer.x(i)} Y${normalizer.y(j)}\n`;
                            content += 'M03\n';
                            content += `G4 P${dwellTime}\n`;
                            content += 'M05\n';
                        }
                    }
                    if (partition < 2) {
                        progress = i / (width - 1);
                        this.emit('taskProgress', progress);
                    } else {
                        if (i % partition === 0) {
                            progress = i / (width - 1);
                            this.emit('taskProgress', progress);
                        }
                    }
                }
                content += 'G0 X0 Y0';
                return content;
            });
    }

    generateGcodeBW(modelInfo, modelPath) {
        const { gcodeConfigPlaceholder, config } = modelInfo;
        const { workSpeed, jogSpeed } = gcodeConfigPlaceholder;
        const { bwThreshold } = config;

        function extractSegment(data, start, box, direction, sign) {
            let len = 1;
            function idx(pos) {
                return pos.x * 4 + pos.y * box.width * 4;
            }
            for (;;) {
                const cur = {
                    x: start.x + direction.x * len * sign,
                    y: start.y + direction.y * len * sign
                };
                if (!bitEqual(data[idx(cur)], data[idx(start)]) ||
                    cur.x < 0 || cur.x >= box.width ||
                    cur.y < 0 || cur.y >= box.height) {
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

        function bitEqual(a, b) {
            return (a <= bwThreshold && b <= bwThreshold) || (a > bwThreshold && b > bwThreshold);
        }

        return Jimp
            .read(modelPath)
            .then(img => img.mirror(false, true))
            .then(img => {
                const width = img.bitmap.width;
                const height = img.bitmap.height;

                const normalizer = new Normalizer('Center', 0, width, 0, height, {
                    x: 1 / config.density,
                    y: 1 / config.density
                });

                let progress = 0;
                let partition = Math.floor(height / 20);
                let content = '';
                content += `G0 F${jogSpeed}\n`;
                content += `G1 F${workSpeed}\n`;

                if (!config.direction || config.direction === 'Horizontal') {
                    const direction = { x: 1, y: 0 };
                    for (let j = 0; j < height; j++) {
                        let len = 0;
                        const isReverse = (j % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let i = (isReverse ? width - 1 : 0); isReverse ? i >= 0 : i < width; i += len * sign) {
                            const idx = i * 4 + j * width * 4;
                            if (img.bitmap.data[idx] <= bwThreshold) {
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
                        if (partition < 2) {
                            progress = j / (height - 1);
                            this.emit('taskProgress', progress);
                        } else {
                            if (j % partition === 0) {
                                progress = j / (height - 1);
                                this.emit('taskProgress', progress);
                            }
                        }
                    }
                } else if (config.direction === 'Vertical') {
                    let direction = { x: 0, y: 1 };
                    partition = Math.floor(width / 20);
                    for (let i = 0; i < width; ++i) {
                        let len = 0;
                        const isReverse = (i % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let j = (isReverse ? height - 1 : 0); isReverse ? j >= 0 : j < height; j += len * sign) {
                            const idx = i * 4 + j * width * 4;
                            if (img.bitmap.data[idx] <= bwThreshold) {
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
                        if (partition < 2) {
                            progress = i / (width - 1);
                            this.emit('taskProgress', progress);
                        } else {
                            if (i % partition === 0) {
                                progress = i / (width - 1);
                                this.emit('taskProgress', progress);
                            }
                        }
                    }
                } else if (config.direction === 'Diagonal') {
                    const direction = { x: 1, y: -1 };
                    partition = Math.floor((width + height) / 20);
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
                                if (img.bitmap.data[idx] <= bwThreshold) {
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
                        if (partition < 2) {
                            progress = k / (width + height - 2);
                            this.emit('taskProgress', progress);
                        } else {
                            if (k % partition === 0) {
                                progress = k / (width + height - 2);
                                this.emit('taskProgress', progress);
                            }
                        }
                    }
                } else if (config.direction === 'Diagonal2') {
                    const direction = { x: 1, y: 1 };
                    partition = Math.floor((width + height) / 20);
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
                                if (img.bitmap.data[idx] <= bwThreshold) {
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
                        if (partition < 2) {
                            progress = k / (width + height);
                            this.emit('taskProgress', progress);
                        } else {
                            if (k % partition === 0) {
                                progress = k / (width + height);
                                this.emit('taskProgress', progress);
                            }
                        }
                    }
                }
                content += 'G0 X0 Y0\n';
                return content;
            });
    }

    async generateGcodeVector(modelInfo, modelPath) {
        const { gcodeConfigPlaceholder } = modelInfo;
        const { workSpeed, jogSpeed } = gcodeConfigPlaceholder;
        const originWidth = modelInfo.source.width;
        const originHeight = modelInfo.source.height;

        const targetWidth = modelInfo.transformation.width;
        const targetHeight = modelInfo.transformation.height;

        // rotation: degree and counter-clockwise
        const rotation = modelInfo.transformation.rotation;

        const { fillEnabled, fillDensity, optimizePath } = modelInfo.config;

        const svgParser = new SVGParser();

        const svg = await svgParser.parseFile(modelPath);
        flip(svg);
        scale(svg, {
            x: targetWidth / originWidth,
            y: targetHeight / originHeight
        });
        if (optimizePath) {
            sortShapes(svg);
        }
        rotate(svg, rotation); // rotate: unit is radians and counter-clockwise
        translate(svg, -svg.viewBox[0], -svg.viewBox[1]);

        const normalizer = new Normalizer(
            'Center',
            svg.viewBox[0],
            svg.viewBox[0] + svg.viewBox[2],
            svg.viewBox[1],
            svg.viewBox[1] + svg.viewBox[3],
            { x: 1, y: 1 }
        );

        const segments = svgToSegments(svg, {
            width: svg.viewBox[2],
            height: svg.viewBox[3],
            fillEnabled: fillEnabled,
            fillDensity: fillDensity
        });

        // second pass generate gcode
        let progress = 0;
        let content = '';
        content += `G0 F${jogSpeed}\n`;
        content += `G1 F${workSpeed}\n`;

        let current = null;
        for (const segment of segments) {
            // G0 move to start
            if (!current || current && !(pointEqual(current, segment.start))) {
                if (current) {
                    content += 'M5\n';
                }

                // Move to start point
                content += `G0 X${normalizer.x(segment.start[0])} Y${normalizer.y(segment.start[1])}\n`;
                content += 'M3\n';
            }

            // G0 move to end
            content += `G1 X${normalizer.x(segment.end[0])} Y${normalizer.y(segment.end[1])}\n`;

            current = segment.end;

            progress += 1;
        }
        if (segments.length !== 0) {
            progress /= segments.length;
        }
        this.emit('taskProgress', progress);
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
