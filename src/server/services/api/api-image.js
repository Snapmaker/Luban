import path from 'path';
import fs from 'fs';
import mv from 'mv';
import jimp from 'jimp';
import jpegAutoRotate from 'jpeg-autorotate';
import logger from '../../lib/logger';
import SVGParser from '../../../shared/lib/SVGParser';
import {
    parseDxf,
    generateSvgFromDxf,
} from '../../../shared/lib/DXFParser/Parser';
import { unzipFile } from '../../lib/archive';
import stockRemap from '../../lib/stock-remap';
import { ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import DataStorage from '../../DataStorage';
import { stitch, stitchEach } from '../../lib/image-stitch';
import {
    calibrationPhoto,
    getCameraCalibration,
    getPhoto,
    setMatrix,
    takePhoto,
} from '../../lib/image-getPhoto';
import { generateRandomPathName } from '../../../shared/lib/random-utils';
import workerManager from '../task-manager/workerManager';
import { convertFileToSTL } from '../../lib/model-to-stl';

const log = logger('api:image');

const moveFile = (originalPath, tempPath) => {
    return new Promise((resolve, reject) => {
        mv(originalPath, tempPath, (err) => {
            if (err) {
                reject(new Error(err));
            } else {
                resolve();
            }
        });
    });
};

export const set = async (req, res) => {
    const files = req.files;
    const { isRotate } = req.body;
    let originalName, tempName, tempPath, originalPath;
    // if 'files' does not exist, the model in the case library is being loaded
    try {
        if (files) {
            const file = files.image;
            const { filename, filePath } = await convertFileToSTL(file);

            originalName = path.basename(filename);
            tempName = generateRandomPathName(originalName, true);
            tempName = tempName.toLowerCase();
            tempPath = `${DataStorage.tmpDir}/${tempName}`;
            originalPath = filePath;
        } else {
            const { name, casePath } = req.body;
            originalName = name;
            originalPath = `${DataStorage.userCaseDir}/${casePath}/${name}`;
            tempName = generateRandomPathName(originalName, true);
            tempName = tempName.toLowerCase();
            tempPath = `${DataStorage.tmpDir}/${tempName}`;
        }
        const extname = path.extname(tempName).toLowerCase();

        if (files) {
            // jpg image may have EXIF data, parse it
            // https://blog.csdn.net/weixin_40243894/article/details/107049225
            // TODO: png image also can contain EXIF data, but we does not have a test file
            // https://stackoverflow.com/questions/9542359/does-png-contain-exif-data-like-jpg
            if (/jpe?g$/.test(extname)) {
                // according to EXIF data, rotate image to a correct orientation
                try {
                    const { buffer: imageBuffer } = await jpegAutoRotate.rotate(
                        originalPath
                    );
                    await fs.writeFile(tempPath, imageBuffer, (err) => {
                        if (err) {
                            throw new Error(err);
                        }
                    });
                } catch (e) {
                    await moveFile(originalPath, tempPath);
                }
            } else {
                await moveFile(originalPath, tempPath);
            }
        } else {
            await fs.copyFile(originalPath, tempPath, (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
        }
        if (extname === '.svg') {
            const svgParser = new SVGParser();
            const svg = await svgParser.parseFile(tempPath);
            res.send({
                originalName: originalName,
                uploadName: tempName,
                sourceWidth: svg.width,
                sourceHeight: svg.height,
            });
        } else if (extname === '.dxf') {
            const result = await parseDxf(tempPath);
            const svg = await generateSvgFromDxf(
                result.svg,
                tempPath,
                tempName
            );
            const { width, height } = result;

            res.send({
                originalName: originalName,
                uploadName: svg.uploadName,
                sourceWidth: width,
                sourceHeight: height,
            });
        } else if (extname === '.stl' || extname === '.zip') {
            if (extname === '.zip') {
                await unzipFile(`${tempName}`, `${DataStorage.tmpDir}`);
                originalName = originalName.replace(/\.zip$/, '');
                tempName = originalName;
            }
            workerManager.loadSize(
                [{ tempName, isRotate }, DataStorage.tmpDir],
                (payload) => {
                    if (payload.status === 'complete') {
                        const { width, height } = payload;
                        res.send({
                            originalName: originalName,
                            uploadName: tempName,
                            sourceWidth: width,
                            sourceHeight: height,
                        });
                    } else if (payload.status === 'fail') {
                        log.error(`Failed to read image ${tempName} ,${payload.error?.message} `);
                        res.status(ERR_INTERNAL_SERVER_ERROR).end();
                    }
                }
            );
        } else {
            await jimp.read(tempPath)
                .then((image) => {
                    res.send({
                        originalName: originalName,
                        uploadName: tempName,
                        sourceWidth: image.bitmap.width,
                        sourceHeight: image.bitmap.height,
                    });
                })
                .catch((err) => {
                    throw new Error(err);
                });
        }
    } catch (err) {
        log.error(`Failed to read image ${tempName} ,${err.message} `);
        res.status(ERR_INTERNAL_SERVER_ERROR).end();
    }
};

export const stockRemapProcess = (req, res) => {
    const options = req.body;

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`,
        };
    } else {
        imageOptions = options;
    }

    stockRemap(imageOptions)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};

// stitch TODO
export const processStitch = (req, res) => {
    const options = req.body;

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`,
        };
    } else {
        imageOptions = options;
    }

    stitch(imageOptions)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};

export const processStitchEach = (req, res) => {
    const options = req.body;

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`,
        };
    } else {
        imageOptions = options;
    }

    stitchEach(imageOptions)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};

export const processGetPhoto = (req, res) => {
    const options = req.body;

    getPhoto(options)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};

export const cameraCalibrationPhoto = (req, res) => {
    const options = req.body;

    calibrationPhoto(options)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};

export const getCameraCalibrationApi = (req, res) => {
    const options = req.body;

    getCameraCalibration(options)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};

export const processTakePhoto = (req, res) => {
    const options = req.body;

    takePhoto(options)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};
export const setCameraCalibrationMatrix = (req, res) => {
    const options = req.body;
    setMatrix(options)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err),
            });
        });
};
