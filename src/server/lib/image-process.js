
import fs from 'fs';
import path from 'path';

import Jimp from './jimp';

import { pathWithRandomSuffix } from './random-utils';
import { convertRasterToSvg } from './svg-convert';
import DataStorage from '../DataStorage';
import { dxfToSvg, parseDxf, updateDxfBoundingBox } from '../../shared/lib/DXFParser/Parser';
import { svgInverse, svgToString } from '../../shared/lib/SVGParser/SvgToString';


function bit(x) {
    if (x >= 128) {
        return 255;
    } else {
        return 0;
    }
}

function normalize(x) {
    if (x < 0) {
        return 0;
    } else if (x > 255) {
        return 255;
    }
    return Math.round(x);
}


const algorithms = {
    Atkinson: [
        [0, 0, 1 / 8, 1 / 8],
        [1 / 8, 1 / 8, 1 / 8, 0],
        [0, 1 / 8, 0, 0]
    ],
    Burkes: [
        [0, 0, 0, 8 / 32, 4 / 32],
        [2 / 32, 4 / 32, 8 / 32, 4 / 32, 2 / 32]
    ],
    FloydSteinburg: [
        [0, 0, 7 / 16],
        [3 / 16, 5 / 16, 1 / 16]
    ],
    JarvisJudiceNinke: [
        [0, 0, 0, 7 / 48, 5 / 48],
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

async function processLaserGreyscale(modelInfo) {
    const { uploadName } = modelInfo;
    const { width, height, rotationZ = 0, flip = 0 } = modelInfo.transformation;

    const { invert, contrast, brightness, whiteClip, algorithm } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};

    const outputFilename = pathWithRandomSuffix(uploadName);

    const matrix = algorithms[algorithm];
    const matrixHeight = matrix.length;
    const matrixWidth = matrix[0].length;

    let matrixOffset = 0;
    for (let k = 1; k < matrixWidth; k++) {
        if (matrix[0][k] > 0) {
            matrixOffset = k - 1;
            break;
        }
    }

    const img = await Jimp.read(`${DataStorage.tmpDir}/${uploadName}`);
    if (invert) {
        img.invert();
    }

    img
        .background(0xffffffff)
        .brightness((brightness - 50.0) / 50)
        .quality(100)
        .contrast((contrast - 50.0) / 50)
        .greyscale()
        .flip(!!(Math.floor(flip / 2)), !!(flip % 2))
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI) // should we do this on generating toolpath?
        .threshold({ max: whiteClip })
        .alphaToWhite(); // apply this after rotate AND invert, to avoid black gcode area
    // serpentine path
    for (let y = 0; y < img.bitmap.height; y++) {
        const reverse = (y & 1) === 1;

        for (let x = reverse ? img.bitmap.width - 1 : 0; reverse ? x >= 0 : x < img.bitmap.width; reverse ? x-- : x++) {
            const index = (y * img.bitmap.width + x) << 2;
            const origin = img.bitmap.data[index];

            img.bitmap.data[index] = bit(origin);
            img.bitmap.data[index + 1] = img.bitmap.data[index];
            img.bitmap.data[index + 2] = img.bitmap.data[index];
            const err = origin - img.bitmap.data[index];

            for (let i = 0; i < matrixWidth; i++) {
                for (let j = 0; j < matrixHeight; j++) {
                    if (matrix[j][i] > 0) {
                        const x2 = reverse ? x - (i - matrixOffset) : x + (i - matrixOffset);
                        const y2 = y + j;
                        if (x2 >= 0 && x2 < img.bitmap.width && y2 < img.bitmap.height) {
                            const idx2 = index + (x2 - x) * 4 + (y2 - y) * img.bitmap.width * 4;
                            img.bitmap.data[idx2] = normalize(img.bitmap.data[idx2] + matrix[j][i] * err);
                        }
                    }
                }
            }
        }
    }

    return new Promise(resolve => {
        img.write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

async function processCNCGreyscale(modelInfo) {
    const { uploadName } = modelInfo;
    const { width, height, rotationZ = 0, flip = 0 } = modelInfo.transformation;

    const { invert } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};

    const outputFilename = pathWithRandomSuffix(uploadName);

    const img = await Jimp.read(`${DataStorage.tmpDir}/${uploadName}`);
    if (invert) {
        img.invert();
    }

    img
        .greyscale()
        .flip(!!(Math.floor(flip / 2)), !!(flip % 2))
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI)
        .background(0xffffffff);

    return new Promise(resolve => {
        img.write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

async function processBW(modelInfo) {
    const { uploadName } = modelInfo;
    // rotation: degree and counter-clockwise
    const { width, height, rotationZ = 0, flip = 0 } = modelInfo.transformation;

    const { invert, bwThreshold } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};

    const outputFilename = pathWithRandomSuffix(uploadName);
    const img = await Jimp.read(`${DataStorage.tmpDir}/${uploadName}`);

    img
        .greyscale()
        .flip(!!(Math.floor(flip / 2)), !!(flip % 2))
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI); // rotate: unit is degree and clockwise

    if (invert) {
        img.invert();
    }
    img.bw(bwThreshold)
        .background(0xffffffff)
        .alphaToWhite();

    return new Promise(resolve => {
        img.write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

async function processHalftone(modelInfo) {
    const { uploadName } = modelInfo;
    // rotation: degree and counter-clockwise
    const { width, height, rotationZ = 0, flip = 0 } = modelInfo.transformation;

    const { npType, npSize, npAngle, threshold } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};
    const outputFilename = pathWithRandomSuffix(uploadName);
    const img = await Jimp.read(`${DataStorage.tmpDir}/${uploadName}`);

    img
        .greyscale()
        .flip(!!(Math.floor(flip / 2)), !!(flip % 2))
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI) // rotate: unit is degree and clockwise
        .threshold({ max: threshold })
        .halftone(npType, npSize, npAngle)
        .background(0xffffffff)
        .alphaToWhite();

    return new Promise(resolve => {
        img.write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

/**
 * Convert raster image to vector image.
 *
 * @param modelInfo
 * @returns {Promise<any>}
 */
function processVector(modelInfo) {
    // options: { filename, vectorThreshold, invert, turdSize }
    const { vectorThreshold, invert, turdSize } = modelInfo.config;
    const options = {
        uploadName: modelInfo.uploadName,
        vectorThreshold: vectorThreshold,
        invert: invert,
        turdSize: turdSize
    };
    return convertRasterToSvg(options);
}

function processDxf(modelInfo) {
    return new Promise(async (resolve) => {
        const { uploadName } = modelInfo;

        let outputFilename = pathWithRandomSuffix(uploadName);
        outputFilename = `${path.basename(outputFilename, '.dxf')}.svg`;

        const result = await parseDxf(`${DataStorage.tmpDir}/${uploadName}`);
        const svg = dxfToSvg(result.svg);
        updateDxfBoundingBox(svg);
        svgInverse(svg, 2);

        fs.writeFile(`${DataStorage.tmpDir}/${outputFilename}`, svgToString(svg), 'utf8', () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}


function process(modelInfo) {
    const { headType, sourceType, mode } = modelInfo;
    if (sourceType === 'raster') {
        if (mode === 'greyscale') {
            if (headType === 'laser') {
                return processLaserGreyscale(modelInfo);
            } else {
                return processCNCGreyscale(modelInfo);
            }
        } else if (mode === 'bw') {
            return processBW(modelInfo);
        } else if (mode === 'vector') {
            // Note that vector is not flipped
            return processVector(modelInfo);
        } else if (mode === 'halftone') {
            return processHalftone(modelInfo);
        } else {
            return Promise.resolve({
                filename: ''
            });
        }
    } else if (sourceType === 'dxf') {
        return processDxf(modelInfo);
    } else {
        return Promise.resolve({
            filename: ''
        });
    }
}

export default process;
