import fs from 'fs';
import path from 'path';
import jimp from 'jimp';
import series from 'async/series';
import { APP_CACHE_IMAGE, ERR_INTERNAL_SERVER_ERROR } from '../constants';
import logger from '../lib/logger';
import XMLUtils from '../lib/XMLUtils';
import SvgReader from '../lib/svgreader';
import imageProcess from '../lib/image-process';

const log = logger('api:image');

export const set = (req, res) => {
    const image = req.files.image;
    const filename = path.basename(image.originalFilename);
    const imagePath = `${APP_CACHE_IMAGE}/${filename}`;

    series([
        (next) => {
            fs.rename(image.path, imagePath, () => {
                next();
            });
        },
        (next) => {
            if (path.extname(filename) === '.svg') {
                XMLUtils.readFile(imagePath, (err, node) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    const svgReader = new SvgReader(0.08);
                    const parseResult = svgReader.parse(node);
                    res.send({
                        filename: filename,
                        filePath: imagePath,
                        width: parseResult.originalSize.width,
                        height: parseResult.originalSize.height
                    });
                    next();
                });
            } else {
                jimp.read(imagePath).then((image) => {
                    res.send({
                        filename: filename,
                        filePath: imagePath,
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

    const imageOptions = {
        ...options,
        image: `${APP_CACHE_IMAGE}/${path.parse(options.image).base}`
    };

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
