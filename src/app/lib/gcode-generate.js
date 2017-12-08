/* eslint-disable */

import path from 'path';
import fs from 'fs';
import Jimp from 'jimp';
import xml2js from 'xml2js';
import { APP_CACHE_IMAGE, LASER_GCODE_SUFFIX } from '../constants';
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

function generateVector(param, cb) {
    const { workSpeed, jogSpeed, imageSrc, sizeWidth, sizeHeight } = param;

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
            return (x - minX) * SCALE;
        }
        function normalizeY(x) {
            // return ((maxY - minY) - (x - minY)) * SCALE;
            return (sizeHeight - x) * SCALE;
        }

        // second pass generate gcode
        let content = '';
        for (let color in boundarys) {
            let paths = boundarys[color];
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

function generate(param, cb) {
    if (param.mode === 'greyscale') {
        generateGreyscale(param, cb);
    } else if (param.mode === 'bw') {
        generateBw(param, cb);
    } else {
        generateVector(param, cb);
    }
}

export default generate;
