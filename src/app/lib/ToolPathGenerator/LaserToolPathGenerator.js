import Jimp from 'jimp';
import SvgReader from '../svgreader';


class LaserToolPathGenerator {
    constructor(options) {
        this.options = options;
    }

    generateGcode() {
        const { mode } = this.options;
        if (mode === 'greyscale') {
            return this.generateGcodeGreyscale();
        } else if (mode === 'bw') {
            return this.generateGcodeBw();
        } else if (mode === 'vector') {
            return this.generateGcodeVector();
        } else if (mode === 'text') {
            return this.generateGcodeText();
        } else {
            return Promise.reject(new Error('Unsupported mode'));
        }
    }

    generateGcodeGreyscale() {
        const { dwellTime, imageSrc, density, workSpeed, alignment } = this.options;

        return Jimp.read(imageSrc)
            .then(img => {
                img.flip(false, true);
                return img;
            })
            .then(img => {
                const width = img.bitmap.width;
                const height = img.bitmap.height;

                const xOffset = alignment === 'center' ? -width / density * 0.5 : 0;
                const yOffset = alignment === 'center' ? -height / density * 0.5 : 0;

                let content = '';
                content += 'G90\n';
                content += 'G21\n';
                content += `G1 F${workSpeed}\n`;
                for (let i = 0; i < img.bitmap.width; ++i) {
                    const isReverse = (i % 2 === 0);
                    for (let j = (isReverse ? img.bitmap.height : 0); isReverse ? j >= 0 : j < img.bitmap.height; isReverse ? --j : ++j) {
                        const idx = i * 4 + j * img.bitmap.width * 4;
                        if (img.bitmap.data[idx] < 128) {
                            content += `G1 X${i / density + xOffset} Y${j / density + yOffset}\n`;
                            content += 'M03\n';
                            content += `G4 P${dwellTime}\n`;
                            content += 'M05\n';
                        }
                    }
                }
                content += 'G0 X0 Y0';

                return content;
            });
    }

    generateGcodeBw() {
        const { density, imageSrc, direction, workSpeed, jogSpeed, alignment } = this.options;

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

        function genMovement(start, direction, sign, len, jogSpeed, workSpeed, xOffset, yOffset) {
            let content = '';
            let end = {
                x: start.x + direction.x * len * sign,
                y: start.y + direction.y * len * sign
            };

            content += `G0 X${start.x / density + xOffset} Y${start.y / density + yOffset} F${jogSpeed}\n`;
            content += 'M03\n';
            content += `G1 X${end.x / density + xOffset} Y${end.y / density + yOffset} F${workSpeed}\n`;
            content += 'M05\n';

            return content;
        }

        return Jimp.read(imageSrc)
            .then(img => {
                img.flip(false, true);
                return img;
            })
            .then(img => {
                const width = img.bitmap.width;
                const height = img.bitmap.height;

                const xOffset = alignment === 'center' ? -width / density * 0.5 : 0;
                const yOffset = alignment === 'center' ? -height / density * 0.5 : 0;

                let content = '';

                content += 'G90\n';
                content += 'G21\n';
                content += 'G0 F1500\n';
                content += 'G1 F288\n';

                if (direction === 'Horizontal') {
                    let direction = {
                        x: 1,
                        y: 0
                    };
                    for (let j = 0; j < img.bitmap.height; ++j) {
                        let len = 0;
                        const isReverse = (j % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let i = (isReverse ? img.bitmap.width - 1 : 0);
                            isReverse ? i >= 0 : i < img.bitmap.width; i += len * sign) {
                            let idx = i * 4 + j * img.bitmap.width * 4;
                            if (img.bitmap.data[idx] <= 128) {
                                const start = {
                                    x: i,
                                    y: j
                                };
                                len = extractSegment(img.bitmap.data,
                                    start,
                                    img.bitmap,
                                    direction, sign);
                                content += genMovement(start, direction, sign, len, jogSpeed, workSpeed, xOffset, yOffset);
                            } else {
                                len = 1;
                            }
                        }
                    }
                    content += 'G0 X0 Y0\n';
                }

                if (direction === 'Vertical') {
                    let direction = {
                        x: 0,
                        y: 1
                    };

                    for (let i = 0; i < img.bitmap.width; ++i) {
                        let len = 0;
                        const isReverse = (i % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let j = (isReverse ? img.bitmap.height - 1 : 0);
                            isReverse ? j >= 0 : j < img.bitmap.height; j += len * sign) {
                            let idx = i * 4 + j * img.bitmap.width * 4;

                            if (img.bitmap.data[idx] <= 128) {
                                const start = {
                                    x: i,
                                    y: j
                                };

                                len = extractSegment(img.bitmap.data,
                                    start,
                                    img.bitmap,
                                    direction,
                                    sign);

                                content += genMovement(start, direction, sign, len, jogSpeed, workSpeed, xOffset, yOffset);
                            } else {
                                len = 1;
                            }
                        }
                    }
                    content += 'G0 X0 Y0\n';
                }

                if (direction === 'Diagonal') {
                    let direction = {
                        x: 1,
                        y: -1
                    };

                    for (let k = 0; k < img.bitmap.width + img.bitmap.height - 1; ++k) {
                        let len = 0;
                        const isReverse = (k % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        for (let i = (isReverse ? img.bitmap.width - 1 : 0);
                            isReverse ? i >= 0 : i < img.bitmap.width; i += len * sign) {
                            let j = k - i;
                            if (j < 0 || j > img.bitmap.height) {
                                len = 1;
                            } else {
                                let idx = i * 4 + j * img.bitmap.width * 4;

                                if (img.bitmap.data[idx] <= 128) {
                                    let start = {
                                        x: i,
                                        y: j
                                    };
                                    len = extractSegment(img.bitmap.data,
                                        start,
                                        img.bitmap,
                                        direction,
                                        sign);
                                    content += genMovement(start, direction, sign, len, jogSpeed, workSpeed, xOffset, yOffset);
                                } else {
                                    len = 1;
                                }
                            }
                        }
                    }
                    content += 'G0 X0 Y0\n';
                }

                if (direction === 'Diagonal2') {
                    let direction = {
                        x: 1,
                        y: 1
                    };

                    for (let k = -img.bitmap.height; k <= img.bitmap.width; ++k) {
                        const isReverse = (k % 2 !== 0);
                        const sign = isReverse ? -1 : 1;
                        let len = 0;
                        for (let i = (isReverse ? img.bitmap.width - 1 : 0);
                            isReverse ? i >= 0 : i < img.bitmap.width;
                            i += len * sign) {
                            let j = i - k;
                            if (j < 0 || j > img.bitmap.height) {
                                len = 1;
                            } else {
                                let idx = i * 4 + j * img.bitmap.width * 4;

                                if (img.bitmap.data[idx] <= 128) {
                                    let start = {
                                        x: i,
                                        y: j
                                    };
                                    len = extractSegment(img.bitmap.data,
                                        start,
                                        img.bitmap,
                                        direction,
                                        sign);

                                    content += genMovement(start, direction, sign, len, jogSpeed, workSpeed, xOffset, yOffset);
                                } else {
                                    len = 1;
                                }
                            }
                        }
                    }

                    content += 'G0 X0 Y0\n';
                }
                return content;
            });
    }

    generateGcodeVector() {
        const { workSpeed, jogSpeed, imageSrc, originWidth, originHeight, sizeWidth, sizeHeight, alignment, optimizePath } = this.options;

        const svgReader = new SvgReader(0.08);

        return svgReader
            .parseFile(imageSrc)
            .then((result) => {
                const boundaries = result.boundaries;

                const xScale = sizeWidth / originWidth;
                const yScale = sizeHeight / originHeight;

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

                function normalizeX(x) {
                    if (alignment === 'none') {
                        // empty
                    } else if (alignment === 'clip') {
                        x -= minX;
                    } else { // center
                        x -= (minX + maxX) * 0.5;
                    }
                    return (x * xScale).toFixed(4);
                }
                function normalizeY(y) {
                    if (alignment === 'none') {
                        y = originHeight - y;
                    } else if (alignment === 'clip') {
                        y = maxY - y;
                    } else { // center
                        y = (minY + maxY) * 0.5 - y;
                    }
                    return (y * yScale).toFixed(4);
                }

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

                // second pass generate gcode
                let content = '';
                Object.keys(boundaries).forEach(color => {
                    let paths = boundaries[color];

                    if (optimizePath) {
                        paths = sortBySeekTime(paths);
                    }

                    for (let i = 0, pathsLen = paths.length; i < pathsLen; i++) {
                        const path = paths[i];
                        for (let j = 0, pathLen = path.length; j < pathLen; j++) {
                            if (j === 0) {
                                content += `G0 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} F${jogSpeed}\n`;
                                content += 'M3\n';
                            } else {
                                content += `G1 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} F${workSpeed}\n`;
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

        const alignment = 'center';
        const jogSpeed = 1500;
        const workSpeed = 288;

        const svgReader = new SvgReader(0.08);

        return svgReader
            .parseFile(source.image)
            .then((result) => {
                const boundaries = result.boundaries;

                const xScale = target.width / source.width;
                const yScale = target.height / source.height;

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

                function normalizeX(x) {
                    if (alignment === 'none') {
                        // empty
                    } else if (alignment === 'clip') {
                        x -= minX;
                    } else { // center
                        x -= (minX + maxX) * 0.5;
                    }
                    return (x * xScale).toFixed(4);
                }
                function normalizeY(y) {
                    if (alignment === 'none') {
                        y = source.height - y;
                    } else if (alignment === 'clip') {
                        y = maxY - y;
                    } else { // center
                        y = (minY + maxY) * 0.5 - y;
                    }
                    return (y * yScale).toFixed(4);
                }

                // second pass generate gcode
                let content = '';
                Object.keys(boundaries).forEach(color => {
                    let paths = boundaries[color];

                    for (let i = 0, pathsLen = paths.length; i < pathsLen; i++) {
                        const path = paths[i];
                        for (let j = 0, pathLen = path.length; j < pathLen; j++) {
                            if (j === 0) {
                                content += `G0 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} F${jogSpeed}\n`;
                                content += 'M3\n';
                            } else {
                                content += `G1 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} F${workSpeed}\n`;
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
