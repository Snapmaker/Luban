import Jimp from '../jimp';

import { pathWithRandomSuffix } from '../random-utils';
import { convertRasterToSvg } from '../svg-convert';

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

export async function processLaserGreyscale(modelInfo, onProgress) {
    onProgress && onProgress(0.2);
    const { uploadName } = modelInfo;
    const { rotationZ = 0 } = modelInfo.transformation;
    const { width, height, scaleX = 1, scaleY = 1 } = modelInfo.transformation;

    const { invert, contrast, brightness, whiteClip, greyscaleAlgorithm, algorithm } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};
    const outputFilename = pathWithRandomSuffix(uploadName);

    onProgress && onProgress(0.4);
    const img = await Jimp.read(`${process.env.Tmpdir}/${uploadName}`);
    onProgress && onProgress(0.6);
    img.alphaToWhite();
    if (invert) {
        img.invert();
    }

    img
        .background(0xffffffff)
        .brightness((brightness - 50.0) / 50)
        .quality(100)
        .contrast((contrast - 50.0) / 50)
        .greyscale(greyscaleAlgorithm)
        .flip(scaleX < 0, scaleY < 0)
        .resize(width * density, height * density);
    if (rotationZ !== 0) {
        img.rotate(-rotationZ * 180 / Math.PI); // Rotating zero degrees will result in white edges
    }
    img
        .threshold({ max: whiteClip })
        .alphaToWhite(); // apply this after rotate AND invert, to avoid black gcode area
    // serpentine path
    onProgress && onProgress(0.8);

    const matrix = algorithms[algorithm];
    if (matrix) {
        const matrixHeight = matrix.length;
        const matrixWidth = matrix[0].length;

        let matrixOffset = 0;
        for (let k = 1; k < matrixWidth; k++) {
            if (matrix[0][k] > 0) {
                matrixOffset = k - 1;
                break;
            }
        }
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
    }
    onProgress && onProgress(1);
    return new Promise(resolve => {
        img.write(`${process.env.Tmpdir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

export async function processCNCGreyscale(modelInfo, onProgress) {
    onProgress && onProgress(0.2);
    const { uploadName } = modelInfo;
    const { width, height, rotationZ = 0, scaleX = 1, scaleY = 1 } = modelInfo.transformation;

    const { invert } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};

    const outputFilename = pathWithRandomSuffix(uploadName);

    const img = await Jimp.read(`${process.env.Tmpdir}/${uploadName}`);
    img.alphaToWhite();
    if (invert) {
        img.invert();
    }
    onProgress && onProgress(0.6);
    img
        .greyscale()
        .flip(scaleX < 0, scaleY < 0)
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI)
        .background(0xffffffff);
    onProgress && onProgress(1);
    return new Promise(resolve => {
        img.write(`${process.env.Tmpdir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

export async function processBW(modelInfo, onProgress) {
    onProgress && onProgress(0.2);
    const { uploadName } = modelInfo;
    // rotation: degree and counter-clockwise
    const { width, height, rotationZ = 0, scaleX = 1, scaleY = 1 } = modelInfo.transformation;

    const { invert, bwThreshold } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};

    const outputFilename = pathWithRandomSuffix(uploadName);
    const img = await Jimp.read(`${process.env.Tmpdir}/${uploadName}`);

    onProgress && onProgress(0.5);
    img
        .greyscale()
        .flip(scaleX < 0, scaleY < 0)
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI); // rotate: unit is degree and clockwise

    onProgress && onProgress(0.8);
    img.alphaToWhite();
    if (invert) {
        img.invert();
    }
    img.bw(bwThreshold)
        .background(0xffffffff)
        .alphaToWhite();

    onProgress && onProgress(1);
    return new Promise(resolve => {
        img.write(`${process.env.Tmpdir}/${outputFilename}`, () => {
            resolve({
                filename: outputFilename
            });
        });
    });
}

export async function processHalftone(modelInfo, onProgress) {
    onProgress && onProgress(0.2);
    const { uploadName } = modelInfo;
    // rotation: degree and counter-clockwise
    const { width, height, rotationZ = 0, scaleX = 1, scaleY = 1 } = modelInfo.transformation;

    const { npType, npSize, npAngle, threshold } = modelInfo.config;
    const { density = 4 } = modelInfo.gcodeConfig || {};
    const outputFilename = pathWithRandomSuffix(uploadName);
    const img = await Jimp.read(`${process.env.Tmpdir}/${uploadName}`);
    onProgress && onProgress(0.6);
    img
        .greyscale()
        .flip(scaleX < 0, scaleY < 0)
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI) // rotate: unit is degree and clockwise
        .threshold({ max: threshold })
        .halftone(npType, npSize, npAngle)
        .background(0xffffffff)
        .alphaToWhite();
    onProgress && onProgress(1);
    return new Promise(resolve => {
        img.write(`${process.env.Tmpdir}/${outputFilename}`, () => {
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
export function processVector(modelInfo, onProgress) {
    onProgress && onProgress(0.2);
    // options: { filename, vectorThreshold, invert, turdSize }
    const { vectorThreshold, invert, turdSize } = modelInfo.config;
    const options = {
        uploadName: modelInfo.uploadName,
        vectorThreshold: vectorThreshold,
        invert: invert,
        turdSize: turdSize
    };
    onProgress && onProgress(1);
    // todo: add onProgress in this return function
    return convertRasterToSvg(options);
}
