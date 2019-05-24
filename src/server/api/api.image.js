import path from 'path';
import mv from 'mv';
import jimp from 'jimp';
import series from 'async/series';
import logger from '../lib/logger';
import SVGParser from '../lib/SVGParser';
import imageProcess from '../lib/image-process';
import { pathWithRandomSuffix } from '../lib/random-utils';
import stockRemap from '../lib/stock-remap';
import trace from '../lib/image-trace';
import { ERR_INTERNAL_SERVER_ERROR } from '../constants';
import DataStorage from '../DataStorage';

const log = logger('api:image');

export const set = (req, res) => {
    const file = req.files.image;
    const originalFilename = path.basename(file.originalFilename);

    const filename = pathWithRandomSuffix(originalFilename);
    const filePath = `${DataStorage.tmpDir}/${filename}`;

    series([
        (next) => {
            mv(file.path, filePath, () => {
                next();
            });
        },
        async (next) => {
            if (path.extname(filename) === '.svg') {
                const svgParser = new SVGParser();
                const svg = await svgParser.parseFile(filePath);

                res.send({
                    name: originalFilename,
                    filename: filename,
                    width: svg.width,
                    height: svg.height
                });

                next();
            } else {
                jimp.read(filePath).then((image) => {
                    res.send({
                        name: originalFilename,
                        filename: filename,
                        width: image.bitmap.width,
                        height: image.bitmap.height
                    });
                    next();
                }).catch((err) => {
                    next(err);
                });
            }
        }
    ], (err, results) => {
        if (err) {
            log.error(`Failed to read image ${filename}`);
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

    let imageOptions;
    if (options.image) {
        imageOptions = {
            ...options,
            image: `${DataStorage.tmpDir}/${path.parse(options.image).base}`
        };
    } else {
        imageOptions = options;
    }

    imageProcess(imageOptions)
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
