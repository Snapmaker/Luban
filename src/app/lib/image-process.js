import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import * as opentype from 'opentype.js';
import Jimp from 'jimp';
import potrace from 'potrace';
import fontManager from './FontManager';
import { APP_CACHE_IMAGE } from '../constants';
import { pathWithRandomSuffix } from './random-utils';
import logger from '../lib/logger';


const log = logger('image-process');

const bit = function (x) {
    if (x >= 128) {
        return 255;
    } else {
        return 0;
    }
};

const normailize = function (x) {
    if (x < 0) {
        return 0;
    } else if (x > 255) {
        return 255;
    }
    return x;
};


const algorithms = {
    Atkinson: [
        [0, 0, 1 / 8, 1 / 8],
        [1 / 8, 1 / 8, 1 / 8, 0],
        [0, 1 / 8, 0, 0]
    ],
    Burks: [
        [0, 0, 0, 8 / 32, 4 / 32],
        [2 / 32, 4 / 32, 8 / 32, 4 / 32, 2 / 32]
    ],
    FloyedSteinburg: [
        [0, 0, 7 / 16],
        [3 / 16, 5 / 16, 1 / 16]
    ],
    JarvisJudiceNinke: [
        [0, 0, 0, 7 / 18, 5 / 48],
        [3 / 48, 5 / 48, 7 / 48, 5 / 48, 3 / 48],
        [1 / 48, 3 / 48, 5 / 48, 3 / 48, 1 / 48]
    ],
    Sierra2: [
        [0, 0, 0, 4 / 16, 3 / 16],
        [1 / 16, 2 / 16, 3 / 16, 2 / 16, 1 / 16]
    ],
    Sierra3: [
        [0, 0, 0, 5 / 32, 3 / 32],
        [2 / 32, 4 / 32, 5 / 32, 4 / 32, 2 / 32],
        [0, 2 / 32, 3 / 32, 2 / 32, 0]
    ],
    SierraLite: [
        [0, 0, 2 / 4],
        [1 / 4, 1 / 4, 0]
    ],
    Stucki: [
        [0, 0, 0, 8 / 42, 4 / 42],
        [2 / 42, 4 / 42, 8 / 42, 4 / 42, 2 / 42],
        [1 / 42, 2 / 42, 4 / 42, 2 / 42, 1 / 42]
    ]
};

function processGreyscale(options) {
    const { image, width, height, contrast, brightness, whiteClip, algorithm, density } = options;

    const filename = path.basename(image);
    const outputFilename = pathWithRandomSuffix(filename);

    const matrix = algorithms[algorithm];
    const _matrixHeight = matrix.length;
    const _matrixWidth = matrix[0].length;

    let _startingOffset = 0;
    for (let k = 1; k < _matrixWidth; k++) {
        if (matrix[0][k] > 0) {
            _startingOffset = k - 1;
            break;
        }
    }

    return Jimp
        .read(`${APP_CACHE_IMAGE}/${filename}`)
        .then(img => new Promise(resolve => {
            img
                .resize(width * density, height * density)
                .brightness((brightness - 50.0) / 50)
                .contrast((contrast - 50.0) / 50)
                .quality(100)
                .greyscale()
                .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                    for (let k = 0; k < 3; ++k) {
                        if (img.bitmap.data[idx + k] >= whiteClip) {
                            img.bitmap.data[idx + k] = 255;
                        }
                    }
                })
                .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                    for (let k = 0; k < 3; ++k) {
                        const _idx = idx + k;
                        const origin = img.bitmap.data[_idx];
                        img.bitmap.data[_idx] = bit(origin);

                        const err = -img.bitmap.data[_idx] + origin;

                        for (let i = 0; i < _matrixWidth; i++) {
                            for (let j = 0; j < _matrixHeight; j++) {
                                if (matrix[j][i] > 0) {
                                    let _x = x + i - _startingOffset;
                                    let _y = y + j;

                                    if (_x >= 0 && _x < img.bitmap.width && _y < img.bitmap.height) {
                                        let _idx2 = _idx + (_x - x) * 4 + (_y - y) * img.bitmap.width * 4;
                                        img.bitmap.data[_idx2] = normailize(img.bitmap.data[_idx2] + matrix[j][i] * err);
                                    }
                                }
                            }
                        }
                    }
                })
                .write(`${APP_CACHE_IMAGE}/${outputFilename}`, () => {
                    resolve({
                        filename: outputFilename
                    });
                });
        }));
}

function processBW(options) {
    const { image, bwThreshold, density, width, height } = options;

    const filename = path.basename(image);
    const outputFilename = pathWithRandomSuffix(filename);

    return Jimp
        .read(image)
        .then(img => new Promise(resolve => {
            img
                .greyscale()
                .resize(width * density, height * density)
                .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                    for (let k = 0; k < 3; ++k) {
                        let value = img.bitmap.data[idx + k];
                        if (value <= bwThreshold) {
                            img.bitmap.data[idx + k] = 0;
                        } else {
                            img.bitmap.data[idx + k] = 255;
                        }
                    }
                    // transparent
                    if (img.bitmap.data[idx + 3] === 0) {
                        for (let k = 0; k < 4; ++k) {
                            img.bitmap.data[idx + k] = 255;
                        }
                    }
                })
                .write(`${APP_CACHE_IMAGE}/${outputFilename}`, () => {
                    resolve({
                        filename: outputFilename
                    });
                });
        }));
}

function processVector(param) {
    const { image, vectorThreshold, isInvert, turdSize } = param;

    const pathInfo = path.parse(image);
    const filename = pathInfo.base;
    const outputFilename = pathWithRandomSuffix(pathInfo.name + '.svg');

    const params = {
        threshold: vectorThreshold,
        color: 'black',
        background: 'white',
        blackOnWhite: !isInvert,
        turdSize: turdSize
    };

    return new Promise((resolve, reject) => {
        potrace.trace(`${APP_CACHE_IMAGE}/${filename}`, params, (err, svg) => {
            if (err) {
                reject(err);
                return;
            }
            fs.writeFile(`${APP_CACHE_IMAGE}/${outputFilename}`, svg, () => {
                resolve({
                    filename: outputFilename
                });
            });
        });
    });
}

const TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<svg 
    version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="<%= width %>" height="<%= height %>" 
    viewBox="<%= x0 %> <%= y0 %> <%= width %> <%= height %>"
>
  <%= path %>
</svg>
`;

function processText(options) {
    const { text, font, size, lineHeight, alignment, fillDensity } = options;

    const outputFilename = pathWithRandomSuffix('text.svg');

    return fontManager
        .getFont(font)
        .then((font) => {
            const unitsPerEm = font.unitsPerEm;
            const descender = font.tables.os2.sTypoDescender;

            // big enough to being rendered clearly on canvas (still has space for improvements)
            const estimatedFontSize = Math.round(size / 72 * 25.4 * 10);

            const lines = text.split('\n');
            const numberOfLines = lines.length;

            const widths = [];
            let maxWidth = 0;
            for (const line of lines) {
                const p = font.getPath(line, 0, 0, estimatedFontSize);
                const bbox = p.getBoundingBox();
                widths.push(bbox.x2 - bbox.x1);
                maxWidth = Math.max(maxWidth, bbox.x2 - bbox.x1);
            }

            // we use descender line as the bottom of a line
            let y = (unitsPerEm * lineHeight + descender) * estimatedFontSize / unitsPerEm, x = 0;
            const fullPath = new opentype.Path();
            for (let i = 0; i < numberOfLines; i++) {
                const line = lines[i];
                const width = widths[i];
                if (alignment === 'left') {
                    x = 0;
                } else if (alignment === 'middle') {
                    x = (maxWidth - width) / 2;
                } else {
                    x = maxWidth - width;
                }
                const p = font.getPath(line, x, y, estimatedFontSize);
                y += estimatedFontSize * lineHeight;
                fullPath.extend(p);
            }
            const boundingBox = fullPath.getBoundingBox();

            const width = boundingBox.x2 - boundingBox.x1;
            const height = estimatedFontSize * lineHeight * numberOfLines; // boundingBox.y2 - boundingBox.y1;

            fullPath.stroke = 'black';
            if (fillDensity === 0) {
                fullPath.fill = 'none';
            }

            const svgString = _.template(TEMPLATE)({
                path: fullPath.toSVG(),
                x0: boundingBox.x1,
                y0: 0,
                width: width,
                height: height
            });
            return new Promise((resolve, reject) => {
                fs.writeFile(`${APP_CACHE_IMAGE}/${outputFilename}`, svgString, (err) => {
                    if (err) {
                        log.error(err);
                        reject(err);
                    } else {
                        resolve({
                            filename: outputFilename,
                            width: width,
                            height: height
                        });
                    }
                });
            });
        });
}

function process(options) {
    const mode = options.mode;
    if (mode === 'greyscale') {
        return processGreyscale(options);
    } else if (mode === 'bw') {
        return processBW(options);
    } else if (mode === 'vector') {
        return processVector(options);
    } else if (mode === 'text') {
        return processText(options);
    } else {
        return Promise.reject(new Error('Unknown mode: ' + mode));
    }
}

export default process;
