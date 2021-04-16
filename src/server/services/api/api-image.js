import path from 'path';
import fs from 'fs';
import mv from 'mv';
import jimp from 'jimp';
import async from 'async';
import logger from '../../lib/logger';
import SVGParser from '../../../shared/lib/SVGParser';
import { parseDxf } from '../../../shared/lib/DXFParser/Parser';
import { unzipFile } from '../../lib/archive';
import { editorProcess } from '../../lib/editor/process';
import { pathWithRandomSuffix } from '../../lib/random-utils';
import stockRemap from '../../lib/stock-remap';
import trace from '../../lib/image-trace';
import { ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import DataStorage from '../../DataStorage';
import { stitch, stitchEach } from '../../lib/image-stitch';
import { calibrationPhoto, getCameraCalibration, getPhoto, setMatrix, takePhoto } from '../../lib/image-getPhoto';
import { removeSpecialChars } from '../../../shared/lib/utils';
import { Mesh } from '../../lib/MeshProcess/Mesh';

const log = logger('api:image');

export const set = (req, res) => {
    const files = req.files;
    const { isRotate } = req.body;
    let originalName, uploadName, uploadPath, originalPath;
    // if 'files' does not exist, the model in the case library is being loaded
    if (files) {
        const file = files.image;
        originalName = path.basename(file.name);
        uploadName = pathWithRandomSuffix(removeSpecialChars(originalName));
        uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
        originalPath = file.path;
    } else {
        const { name, casePath } = req.body;
        originalName = name;
        originalPath = `${DataStorage.userCaseDir}/${casePath}/${name}`;
        uploadName = pathWithRandomSuffix(removeSpecialChars(originalName));
        uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    }
    const extname = path.extname(uploadName).toLowerCase();

    async.series([
        (next) => {
            if (files) {
                mv(originalPath, uploadPath, () => {
                    next();
                });
            } else {
                fs.copyFile(originalPath, uploadPath, () => {
                    next();
                });
            }
        },
        async (next) => {
            if (extname === '.svg') {
                const svgParser = new SVGParser();
                const svg = await svgParser.parseFile(uploadPath);

                res.send({
                    originalName: originalName,
                    uploadName: uploadName,
                    width: svg.width,
                    height: svg.height
                });

                next();
            } else if (extname === '.dxf') {
                const result = await parseDxf(uploadPath);
                const { width, height } = result;

                res.send({
                    originalName: originalName,
                    uploadName: uploadName,
                    width,
                    height
                });

                next();
            } else if (extname === '.stl' || extname === '.zip') {
                if (extname === '.zip') {
                    await unzipFile(`${uploadName}`, `${DataStorage.tmpDir}`);
                    originalName = originalName.replace(/\.zip$/, '');
                    uploadName = originalName;
                }
                const { width, height } = Mesh.loadSize(`${DataStorage.tmpDir}/${uploadName}`, isRotate === 'true' || isRotate === true);
                res.send({
                    originalName: originalName,
                    uploadName: uploadName,
                    width: width,
                    height: height
                });
                next();
            } else {
                jimp.read(uploadPath).then((image) => {
                    res.send({
                        originalName: originalName,
                        uploadName: uploadName,
                        width: image.bitmap.width,
                        height: image.bitmap.height
                    });
                    next();
                }).catch((err) => {
                    next(err);
                });
            }
        }
    ], (err) => {
        if (err) {
            log.error(`Failed to read image ${uploadName}`);
            res.status(ERR_INTERNAL_SERVER_ERROR).end();
        } else {
            res.end();
        }
    });
};
/**
 * Process Image for Laser.
 *
 * @param req
 * @param res
 */
export const process = (req, res) => {
    const options = req.body;

    editorProcess(options)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err)
            });
        });
};

export const stockRemapProcess = (req, res) => {
    const options = req.body;

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`
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
                error: String(err)
            });
        });
};

export const processTrace = (req, res) => {
    const options = req.body;

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`
        };
    } else {
        imageOptions = options;
    }

    /*
    async (imageOptions) => {
        const result = await trace(imageOptions);
        res.send(result);
    };
    */
    trace(imageOptions)
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Unable to process image',
                error: String(err)
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
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`
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
                error: String(err)
            });
        });
};

export const processStitchEach = (req, res) => {
    const options = req.body;

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`
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
                error: String(err)
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
                error: String(err)
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
                error: String(err)
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
                error: String(err)
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
                error: String(err)
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
                error: String(err)
            });
        });
};
