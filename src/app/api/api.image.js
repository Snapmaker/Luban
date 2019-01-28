import path from 'path';
import mv from 'mv';
import jimp from 'jimp';
import series from 'async/series';
import { APP_CACHE_IMAGE, ERR_INTERNAL_SERVER_ERROR } from '../constants';
import logger from '../lib/logger';
import SVGParser from '../lib/SVGParser';
import imageProcess from '../lib/image-process';
import { pathWithRandomSuffix } from '../lib/random-utils';
import stockRemap from '../lib/stock-remap';

const log = logger('api:image');

export const set = (req, res) => {
    const image = req.files.image;
    const originalFilename = path.basename(image.originalFilename);
    const filename = pathWithRandomSuffix(originalFilename);
    const imagePath = `${APP_CACHE_IMAGE}/${filename}`;

    series([
        (next) => {
            mv(image.path, imagePath, () => {
                next();
            });
        },
        async (next) => {
            if (path.extname(filename) === '.svg') {
                const svgParser = new SVGParser();
                const svg = await svgParser.parseFile(imagePath);

                res.send({
                    filename: filename,
                    // filePath: imagePath,
                    width: svg.width,
                    height: svg.height
                });

                next();
            } else {
                jimp.read(imagePath).then((image) => {
                    res.send({
                        filename: filename,
                        // filePath: imagePath,
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
            image: `${APP_CACHE_IMAGE}/${path.parse(options.image).base}`
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
            image: `${APP_CACHE_IMAGE}/${path.parse(options.image).base}`
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
