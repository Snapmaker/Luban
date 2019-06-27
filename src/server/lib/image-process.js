import Jimp from 'jimp';
import { pathWithRandomSuffix } from './random-utils';
import { convertRasterToSvg } from './svg-convert';
import DataStorage from '../DataStorage';


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

async function processGreyscale(modelInfo) {
    const { uploadName } = modelInfo;
    const { width, height, rotationZ, flip } = modelInfo.transformation;

    const { invertGreyscale, contrast, brightness, whiteClip, algorithm, density } = modelInfo.config;

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

    img
        .background(0xffffffff)
        .brightness((brightness - 50.0) / 50)
        .quality(100)
        .contrast((contrast - 50.0) / 50)
        .greyscale()
        .resize(width * density, height * density)
        .rotate(-rotationZ * 180 / Math.PI)
        .flip((flip & 2) > 0, (flip & 1) > 0)
        .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
            const data = img.bitmap.data;

            if (data[idx + 3] === 0) {
                data[idx] = 255;
            } else {
                if (invertGreyscale) {
                    data[idx] = 255 - data[idx];
                    if (data[idx] < 255 - whiteClip) {
                        data[idx] = 0;
                    }
                } else {
                    if (data[idx] >= whiteClip) {
                        data[idx] = 255;
                    }
                }
            }
        });

    // serpentine path
    for (let y = 0; y < img.bitmap.height; y++) {
        const reverse = (y & 1) === 1;

        for (let x = reverse ? img.bitmap.width - 1 : 0; reverse ? x >= 0 : x < img.bitmap.width; reverse ? x-- : x++) {
            const index = (y * img.bitmap.width + x) << 2;
            const origin = img.bitmap.data[index];

            img.bitmap.data[index] = bit(origin);
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

function processBW(modelInfo) {
    const { uploadName } = modelInfo;
    // rotation: degree and counter-clockwise
    const { width, height, rotationZ, flip } = modelInfo.transformation;

    const { invertGreyscale, bwThreshold, density } = modelInfo.config;

    const outputFilename = pathWithRandomSuffix(uploadName);
    return Jimp
        .read(`${DataStorage.tmpDir}/${uploadName}`)
        .then(img => new Promise(resolve => {
            img
                .greyscale()
                .flip(!!(Math.floor(flip / 2)), !!(flip % 2))
                .resize(width * density, height * density)
                .rotate(-rotationZ * 180 / Math.PI) // rotate: unit is degree and clockwise
                .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                    if (img.bitmap.data[idx + 3] === 0) {
                        // transparent
                        for (let k = 0; k < 3; ++k) {
                            img.bitmap.data[idx + k] = 255;
                        }
                    } else {
                        const value = img.bitmap.data[idx];
                        if (invertGreyscale) {
                            if (value <= bwThreshold) {
                                for (let k = 0; k < 3; ++k) {
                                    img.bitmap.data[idx + k] = 255;
                                }
                            } else {
                                for (let k = 0; k < 3; ++k) {
                                    img.bitmap.data[idx + k] = 0;
                                }
                            }
                        } else {
                            if (value <= bwThreshold) {
                                for (let k = 0; k < 3; ++k) {
                                    img.bitmap.data[idx + k] = 0;
                                }
                            } else {
                                for (let k = 0; k < 3; ++k) {
                                    img.bitmap.data[idx + k] = 255;
                                }
                            }
                        }
                    }
                })
                .background(0xffffffff)
                .write(`${DataStorage.tmpDir}/${outputFilename}`, () => {
                    resolve({
                        filename: outputFilename
                    });
                });
        }));
}

function processVector(modelInfo) {
    // options: { filename, vectorThreshold, isInvert, turdSize }
    const { vectorThreshold, isInvert, turdSize } = modelInfo.config;
    const options = {
        uploadName: modelInfo.uploadName,
        vectorThreshold: vectorThreshold,
        isInvert: isInvert,
        turdSize: turdSize
    };
    return convertRasterToSvg(options);
}

function process(modelInfo) {
    const { sourceType, mode } = modelInfo;
    if (sourceType === 'raster') {
        if (mode === 'greyscale') {
            return processGreyscale(modelInfo);
        } else if (mode === 'bw') {
            return processBW(modelInfo);
        } else if (mode === 'vector') {
            return processVector(modelInfo);
        } else {
            return Promise.reject(new Error(`Unsupported process mode: ${mode}`));
        }
    } else {
        return Promise.reject(new Error(`Unsupported source type: ${sourceType}`));
    }
}

export default process;
