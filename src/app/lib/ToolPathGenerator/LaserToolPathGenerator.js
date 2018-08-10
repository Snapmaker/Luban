import Jimp from 'jimp';
import SvgReader from '../svgreader';


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

class LaserToolPathGenerator {
    constructor(options) {
        this.options = options;
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
        // const { dwellTime, imageSrc, density, workSpeed, alignment } = this.options;
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

                let content = '';
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
            ].join('\n');
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

    generateGcodeVector() {
        const { source, target, vectorMode } = this.options;

        const svgReader = new SvgReader(0.08);

        return svgReader
            .parseFile(source.processed)
            .then((result) => {
                const boundaries = result.boundaries;

                function dist2(a, b) {
                    return Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2);
                }

                function sortBySeekTime(paths) {
                    let newPaths = [];
                    let from = [0, 0];
                    let usedSet = new Set();
                    let idx = 0;
                    let rev = false;

                    for (let k = 0; k < paths.length; ++k) {
                        let minDist = Infinity;
                        idx = 0;
                        rev = false;

                        for (let i = 0; i < paths.length; ++i) {
                            if (!usedSet.has(i)) {
                                let tmpDist = dist2(paths[i][0], from);
                                if (tmpDist < minDist) {
                                    minDist = tmpDist;
                                    rev = false;
                                    idx = i;
                                }

                                tmpDist = dist2(paths[i][paths[i].length - 1], from);
                                if (tmpDist < minDist) {
                                    minDist = tmpDist;
                                    rev = true;
                                    idx = i;
                                }
                            }
                        }

                        usedSet.add(idx);
                        if (rev) {
                            paths[idx] = paths[idx].reverse();
                        }
                        from = paths[idx][paths[idx].length - 1];
                        newPaths.push(paths[idx]);
                    }
                    return newPaths;
                }

                let minX = Infinity;
                let maxX = -Infinity;
                let minY = Infinity;
                let maxY = -Infinity;

                // first pass get boundary
                Object.keys(boundaries).forEach(color => {
                    let paths = boundaries[color];
                    for (let i = 0; i < paths.length; ++i) {
                        let path = paths[i];
                        for (let j = 0; j < path.length; ++j) {
                            minX = Math.min(minX, path[j][0]);
                            maxX = Math.max(maxX, path[j][0]);
                            minY = Math.min(minY, path[j][1]);
                            maxY = Math.max(maxY, path[j][1]);
                        }
                    }
                });

                const normalizer = new Normalizer(target.anchor, minX, maxX, minY, maxY, {
                    x: target.width / source.width,
                    y: target.height / source.height
                });

                // second pass generate gcode
                let content = '';
                content += `G0 F${target.jogSpeed}\n`;
                content += `G1 F${target.workSpeed}\n`;
                Object.keys(boundaries).forEach(color => {
                    let paths = boundaries[color];

                    if (vectorMode.optimizePath) {
                        paths = sortBySeekTime(paths);
                    }

                    for (let i = 0, pathsLen = paths.length; i < pathsLen; i++) {
                        const path = paths[i];
                        for (let j = 0, pathLen = path.length; j < pathLen; j++) {
                            const x = path[j][0];
                            const y = minY + (maxY - path[j][1]);
                            if (j === 0) {
                                content += `G0 X${normalizer.x(x)} Y${normalizer.y(y)}\n`;
                                content += 'M3\n';
                            } else {
                                content += `G1 X${normalizer.x(x)} Y${normalizer.y(y)}\n`;
                                if (j + 1 === path.length) {
                                    content += 'M5\n';
                                }
                            }
                        }
                    }
                });

                content += 'G0 X0 Y0';
                return content;
            });
    }

    generateGcodeText() {
        const { source, target } = this.options;

        const svgReader = new SvgReader(0.08);

        return svgReader
            .parseFile(source.image)
            .then((result) => {
                const boundaries = result.boundaries;

                let minX = Infinity;
                let maxX = -Infinity;
                let minY = Infinity;
                let maxY = -Infinity;

                // first pass get boundary
                Object.keys(boundaries).forEach(color => {
                    let paths = boundaries[color];
                    for (let i = 0; i < paths.length; ++i) {
                        let path = paths[i];
                        for (let j = 0; j < path.length; ++j) {
                            minX = Math.min(minX, path[j][0]);
                            maxX = Math.max(maxX, path[j][0]);
                            minY = Math.min(minY, path[j][1]);
                            maxY = Math.max(maxY, path[j][1]);
                        }
                    }
                });

                const normalizer = new Normalizer(target.anchor, minX, maxX, minY, maxY, {
                    x: target.width / source.width,
                    y: target.height / source.height
                });

                // second pass generate gcode
                let content = '';
                content += `G0 F${target.jogSpeed}\n`;
                content += `G1 F${target.workSpeed}\n`;
                Object.keys(boundaries).forEach(color => {
                    const paths = boundaries[color];

                    for (let i = 0, pathsLen = paths.length; i < pathsLen; i++) {
                        const path = paths[i];
                        for (let j = 0, pathLen = path.length; j < pathLen; j++) {
                            const x = path[j][0];
                            const y = minY + (maxY - path[j][1]);
                            if (j === 0) {
                                content += `G0 X${normalizer.x(x)} Y${normalizer.y(y)}\n`;
                                content += 'M3\n';
                            } else {
                                content += `G1 X${normalizer.x(x)} Y${normalizer.y(y)}\n`;
                                if (j + 1 === path.length) {
                                    content += 'M5\n';
                                }
                            }
                        }
                    }
                });

                content += 'G0 X0 Y0';
                return content;
            });
    }
}

export default LaserToolPathGenerator;
