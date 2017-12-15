/* eslint-disable */

import path from 'path';
import fs from 'fs';
import Jimp from 'jimp';
import xml2js from 'xml2js';
import { APP_CACHE_IMAGE, LASER_GCODE_SUFFIX, CNC_GCODE_SUFFIX } from '../constants';
import { SvgReader} from './svgreader/svg_reader';

function generateGreyscale(param, cb) {
    const { dwellTime, imageSrc, quality, workSpeed } = param;

    let filenameExt = path.basename(imageSrc);
    let filename = path.parse(filenameExt).name;
    let content = '';
    content += 'G90\n';
    content += 'G21\n';
    content += `G1 F${workSpeed}\n`;

    Jimp.read(`${APP_CACHE_IMAGE}/${filenameExt}`, (err, img) => {
        img.flip(false, true, () => {
            for (let i = 0; i < img.bitmap.width; ++i) {
                const isReverse = (i % 2 === 0);
                for (let j = (isReverse ? img.bitmap.height : 0); isReverse ? j >= 0 : j < img.bitmap.height; isReverse ? --j : ++j) {
                    const idx = i * 4 + j * img.bitmap.width * 4;
                    if (img.bitmap.data[idx] < 128) {
                        content += `G1 X${i / quality} Y${j / quality}\n`;
                        content += 'M03\n';
                        content += `G4 P${dwellTime}\n`;
                        content += 'M05\n';
                    }
                }
            }
            content += 'G0 X0 Y0';
            fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${LASER_GCODE_SUFFIX}`, content, () => {
                cb(`${filename}.${LASER_GCODE_SUFFIX}`);
            });
        });
    });
}


function extractSegment(data, start, box, direction, sign) {
    let len = 1;
    function idx(pos) {
        return pos.x * 4 + pos.y * box.width * 4;
    }
    while (true) {
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


function genStart() {
    let content = '';

    content += 'G90\n';
    content += 'G21\n';
    content += 'G0 F1500\n';
    content += 'G1 F288\n';

    return content;
}


function generateBw(param, cb) {
    const { quality, imageSrc, direction, workSpeed, jogSpeed } = param;

    function genMovement(start, direction, sign, len, jogSpeed, workSpeed) {
        let content = '';
        let end = {
            x: start.x + direction.x * len * sign,
            y: start.y + direction.y * len * sign
        };

        content += `G0 X${start.x / quality} Y${start.y / quality} F${jogSpeed}\n`;
        content += 'M03\n';
        content += `G1 X${end.x / quality} Y${end.y / quality} F${workSpeed}\n`;
        content += 'M05\n';

        return content;
    }

    let filenameExt = path.basename(imageSrc);
    let filename = path.parse(filenameExt).name;

    Jimp.read(`${APP_CACHE_IMAGE}/${filenameExt}`, (err, img) => {
        if (err) {
            throw err;
        }

        img.flip(false, true, () => {
            let content = genStart();

            if (direction === 'Horizontal') {
                let direction = {
                    x: 1,
                    y: 0
                };
                for (let j = 0; j < img.bitmap.height; ++j) {
                    let len = 0;
                    const isRerverse = (j % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    for (let i = (isRerverse ? img.bitmap.width - 1 : 0);
                        isRerverse ? i >= 0 : i < img.bitmap.width; i += len * sign) {
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
                            //console.log(`${i} ${j} ${len}`)
                            content += genMovement(start, direction, sign, len, jogSpeed, workSpeed);
                        } else {
                            len = 1;
                        }
                    }
                }
                content += 'G0 X0 Y0\n';
                fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${LASER_GCODE_SUFFIX}`, content, () => {
                    console.log('Horizonal.gcode generated');
                    cb(`${filename}.${LASER_GCODE_SUFFIX}`);
                });
            }

            if (direction === 'Vertical') {
                let direction = {
                    x: 0,
                    y: 1
                };

                for (let i = 0; i < img.bitmap.width; ++i) {
                    let len = 0;
                    const isRerverse = (i % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    for (let j = (isRerverse ? img.bitmap.height - 1 : 0);
                        isRerverse ? j >= 0 : j < img.bitmap.height; j += len * sign) {
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

                            content += genMovement(start, direction, sign, len, jogSpeed, workSpeed);
                        } else {
                            len = 1;
                        }
                    }
                }
                content += 'G0 X0 Y0\n';

                fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${LASER_GCODE_SUFFIX}`, content, () => {
                    console.log('Vertical.gcode generated');
                    cb(`${filename}.${LASER_GCODE_SUFFIX}`);
                });
            }

            if (direction === 'Diagonal') {
                let direction = {
                    x: 1,
                    y: -1
                };

                for (let k = 0; k < img.bitmap.width + img.bitmap.height - 1; ++k) {
                    let len = 0;
                    const isRerverse = (k % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    for (let i = (isRerverse ? img.bitmap.width - 1 : 0);
                        isRerverse ? i >= 0 : i < img.bitmap.width; i += len * sign) {
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
                                //console.log(`${i} ${j} ${len}`)
                                content += genMovement(start, direction, sign, len, jogSpeed, workSpeed);
                            } else {
                                len = 1;
                            }
                        }
                    }
                }
                content += 'G0 X0 Y0\n';

                fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${LASER_GCODE_SUFFIX}`, content, () => {
                    console.log('diagonal generated');
                    cb(`${filename}.${LASER_GCODE_SUFFIX}`);
                });
            }

            if (direction === 'Diagonal2') {
                let direction = {
                    x: 1,
                    y: 1
                };

                for (let k = -img.bitmap.height; k <= img.bitmap.width; ++k) {
                    const isRerverse = (k % 2 !== 0);
                    const sign = isRerverse ? -1 : 1;
                    let len = 0;
                    for (let i = (isRerverse ? img.bitmap.width - 1 : 0);
                        isRerverse ? i >= 0 : i < img.bitmap.width;
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
                                //console.log(`${i} ${j} ${len}`)

                                content += genMovement(start, direction, sign, len, jogSpeed, workSpeed);
                            } else {
                                len = 1;
                            }
                        }
                    }
                }

                content += 'G0 X0 Y0\n';

                fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${LASER_GCODE_SUFFIX}`, content, () => {
                    console.log('diagonal2 generated');
                    cb(`${filename}.${LASER_GCODE_SUFFIX}`);
                });
            }
        });
    });
}

function generateVectorLaser(param, cb) {
    const { workSpeed, jogSpeed, imageSrc, sizeWidth, sizeHeight, clip, optimizePath } = param;

    let filenameExt = path.basename(imageSrc);
    let filename = path.parse(filenameExt).name;

    const SCALE = 1;

    function genGcode(boundarys) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        // first pass get boundary
        for (let color in boundarys) {
            let paths = boundarys[color];
            for (let i = 0; i < paths.length; ++i) {
                let path = paths[i];
                for (let j = 0; j < path.length; ++j) {
                    minX = Math.min(minX, path[j][0]);
                    maxX = Math.max(maxX, path[j][0]);
                    minY = Math.min(minY, path[j][1]);
                    maxY = Math.max(maxY, path[j][1]);
                }
            }
        }

        function normalizeX(x) {
            if (clip) {
                return (x - minX) * SCALE;
            } else {
                return x * SCALE;
            }
        }
        function normalizeY(x) {
            if (clip) {
                return ((maxY - minY) - (x - minY)) * SCALE;
            } else {
                return (sizeHeight - x) * SCALE;
            }

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
        for (let color in boundarys) {
            let paths = boundarys[color];

            if (optimizePath) {
                paths = sortBySeekTime(paths);
            }

            for (let i = 0; i < paths.length; ++i) {
                let path = paths[i];
                for (let j = 0; j < path.length; ++j) {
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
        }

        content += 'G0 X0 Y0';
        return content;
    }

    fs.readFile(`${APP_CACHE_IMAGE}/${filenameExt}`, 'utf8', (err, xml) => {
        if (err) {
            console.log(err);
        } else {
            xml2js.parseString(xml, (err, result) => {
                let svgReader = SvgReader(0.08, [sizeWidth, sizeHeight], result);
                svgReader.parse();
                fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${LASER_GCODE_SUFFIX}`, genGcode(svgReader.boundarys), () => {
                    console.log('vector gcode generated');
                    cb(`${filename}.${LASER_GCODE_SUFFIX}`);
                });
            });
        }
    });
}


// REFACTOR ME
function generateVectorCnc(param, cb) {
    const { workSpeed, jogSpeed, imageSrc, sizeWidth, sizeHeight, clip, optimizePath, targetDepth, stepDown, plungeSpeed, safetyHeight, stopHeight, enableTab, tabWidth, tabHeight, tabSpace } = param;

    let filenameExt = path.basename(imageSrc);
    let filename = path.parse(filenameExt).name;

    const SCALE = 1;

    function genGcode(boundarys) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        // first pass get boundary
        for (let color in boundarys) {
            let paths = boundarys[color];
            for (let i = 0; i < paths.length; ++i) {
                let path = paths[i];
                for (let j = 0; j < path.length; ++j) {
                    minX = Math.min(minX, path[j][0]);
                    maxX = Math.max(maxX, path[j][0]);
                    minY = Math.min(minY, path[j][1]);
                    maxY = Math.max(maxY, path[j][1]);
                }
            }
        }

        function normalizeX(x) {
            if (clip) {
                return (x - minX) * SCALE;
            } else {
                return x * SCALE;
            }
        }
        function normalizeY(x) {
            if (clip) {
                return ((maxY - minY) - (x - minY)) * SCALE;
            } else {
                return (sizeHeight - x) * SCALE;
            }

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

        if (optimizePath) {
            for (let color in boundarys) {
                let paths = boundarys[color];

                paths = sortBySeekTime(paths);
                boundarys[color] = paths;
            }
        }

        let pass = Math.ceil(-targetDepth / stepDown);

        let content = `M3\nG0 Z${safetyHeight} F${jogSpeed}\n`;
        let curHeight = 0;
        for (let k = 0; k < pass; ++k) {
            curHeight -= stepDown;
            if (curHeight < targetDepth) {
                curHeight = targetDepth;
            }

            for (let color in boundarys) {
                let paths = boundarys[color];

                for (let i = 0; i < paths.length; ++i) {
                    let path = paths[i];
                    let totalDist = 0;
                    let from = path[0];
                    let isTab = false;
                    let step = 0;
                    for (let j = 0; j < path.length; j = j + step) {
                        step = 0;
                        if (j === 0) {
                            content += `G0 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} Z${safetyHeight} F${jogSpeed}\n`;
                            content += `G1 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} Z${curHeight} F${plungeSpeed}\n`;
                        } else {
                            let dist = Math.pow(dist2(from, path[j]), 0.5);
                            if (enableTab && curHeight < tabHeight) {

                                if (!isTab && totalDist < tabSpace && totalDist + dist > tabSpace) {
                                    let factor = (tabSpace - totalDist) / dist;
                                    let joint = [from[0] * (1 - factor) + path[j][0] * factor, from[1] * (1 - factor) + path[j][1] * factor];
                                    // gen gcode
                                    content += `G1 X${normalizeX(joint[0])} Y${normalizeY(joint[1])} Z${curHeight} F${workSpeed}\n`;
                                    content += `G1 Z${tabHeight} F${workSpeed}\n`;
                                    isTab = true;
                                    totalDist = 0;
                                    from = joint;
                                    continue;
                                } else if (isTab && totalDist < tabWidth && totalDist + dist > tabWidth) {
                                    let factor = (tabWidth - totalDist) / dist;
                                    let joint = [from[0] * (1 - factor) + path[j][0] * factor, from[1] * (1 - factor) + path[j][1] * factor];
                                    content += `G1 X${normalizeX(joint[0])} Y${normalizeY(joint[1])} Z${tabHeight} F${workSpeed}\n`;
                                    content += `G1 Z${curHeight} F${workSpeed}\n`;
                                    isTab = false;
                                    totalDist = 0;
                                    from = joint;
                                    continue;
                                } else {
                                    totalDist += dist;
                                }
                            }

                            content += `G1 X${normalizeX(path[j][0])} Y${normalizeY(path[j][1])} Z${isTab ? tabHeight : curHeight} F${workSpeed}\n`;
                            if (j + 1 === path.length) {
                                content += `G0 Z${safetyHeight} F${jogSpeed}\n`;
                            }
                            from = path[j];
                        }
                        step = 1;
                    }
                }
            }
        }
        content += `G0 Z${stopHeight} F${jogSpeed}\n`;
        content += `G0 X0 Y0 Z${stopHeight} F${jogSpeed}\nM5\n`;
        return content;
    }

    fs.readFile(`${APP_CACHE_IMAGE}/${filenameExt}`, 'utf8', (err, xml) => {
        if (err) {
            console.log(err);
        } else {
            xml2js.parseString(xml, (err, result) => {
                let svgReader = SvgReader(0.08, [sizeWidth, sizeHeight], result);
                svgReader.parse();
                fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${CNC_GCODE_SUFFIX}`, genGcode(svgReader.boundarys), () => {
                    console.log('vector gcode generated');
                    cb(`${filename}.${CNC_GCODE_SUFFIX}`);
                });
            });
        }
    });
}

function generateReliefCnc(param, cb) {
    const { workSpeed, jogSpeed, imageSrc, sizeWidth, sizeHeight, targetDepth, toolDiameter, plungeSpeed, safetyHeight, greyLevel, isInvert, stopHeight } = param;

    const lineDistance = toolDiameter / 2;
    const quality = Math.ceil(1 / lineDistance);
    const COLOR = greyLevel;
    const COLOR_DIVIDE = 256 / COLOR;
    const isColorInvert = isInvert;
    const xShift = - sizeWidth / 2;
    const yShift = - sizeHeight / 2;


    let filenameExt = path.basename(imageSrc);
    let filename = path.parse(filenameExt).name;

    function color2(color) {
        color = isColorInvert ? (255 - color) : color;
        return Math.ceil(color / COLOR_DIVIDE) * COLOR;
    }

    function color2distance(color) {
        return color2(color) / 256 * targetDepth;
    }

    function fix3(a) {
        return new Number(a).toFixed(3);
    }

    function extractSegment(data, start, box, direction, sign) {
        let len = 1;

        function idx(pos) {
            return pos.x * 4 + pos.y * box.width * 4;
        }

        while (true) {
            let cur = {
                x: start.x + direction.x * len * sign,
                y: start.y + direction.y * len * sign
            };
            if (color2(data[idx(cur)]) !== color2(data[idx(start)])
                || cur.x < 0 || cur.x >= box.width
                || cur.y < 0 || cur.y >= box.height) {
                break;
            }
            len += 1;
        }
        return len;
    }

    Jimp.read(`${APP_CACHE_IMAGE}/${filenameExt}`, (err, img) => {
        let content = `G0 Z${safetyHeight}\n`;
        content += 'G90\n';

        img.resize(sizeWidth * quality, sizeHeight * quality).greyscale()
            .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                // whitenize transparent
                if (img.bitmap.data[idx + 3] === 0) {
                    for (let k = 0; k < 3; ++k) {
                        img.bitmap.data[idx + k] = 255;
                    }
                    img.bitmap.data[idx + 3] = 255;
                }
            }).flip(false, true, () => {

                let direction = {
                    x: 1,
                    y: 0
                };

                content += `G0 X${xShift} Y${yShift} Z${safetyHeight}\n`;
                let z = color2distance(img.bitmap.data[0]);
                content += `G0 Z${fix3(z)} F${plungeSpeed}\n`;



                for (let j = 0; j < img.bitmap.height; ++j) {
                    let len = 0;
                    const isReverse = (j % 2 !== 0);
                    const sign = isReverse ? -1 : 1;

                    for (let i = (isReverse ? img.bitmap.width - 1 : 0); isReverse ? i >= 0 : i < img.bitmap.width; i += len * sign) {
                        let idx = i * 4 + j * img.bitmap.width * 4;

                        let z = color2distance(img.bitmap.data[idx]);
                        const start = {
                            x: i,
                            y: j
                        };
                        len = extractSegment(img.bitmap.data, start, img.bitmap, direction, sign);

                        // console.log(len);
                        const end = {
                            x: start.x + direction.x * len * sign,
                            y: start.y + direction.y * len * sign
                        };
                        content += `G1 X${fix3(end.x * lineDistance + xShift)} Y${fix3(end.y * lineDistance + yShift)} Z${fix3(z)} F${workSpeed}\n`;
                    }
                }

                content += `G0 Z${stopHeight} F${jogSpeed}\n`;
                content += `G0 X0 Y0 Z${stopHeight} F${jogSpeed}\n`;
            });

            fs.writeFile(`${APP_CACHE_IMAGE}/${filename}.${CNC_GCODE_SUFFIX}`, content, (err) => {
                if (err) {
                    throw err;
                }
                console.log('relief gcode generated');
                cb(`${filename}.${CNC_GCODE_SUFFIX}`);
            });

    })

}

function generate(param, cb) {
    if (param.type === 'laser') {
        if (param.mode === 'greyscale') {
            generateGreyscale(param, cb);
        } else if (param.mode === 'bw') {
            generateBw(param, cb);
        } else {
            generateVectorLaser(param, cb);
        }
    } else {
        if (param.mode === 'vector') {
            generateVectorCnc(param, cb);
        } else {
            generateReliefCnc(param, cb);
        }
    }

}

export default generate;
