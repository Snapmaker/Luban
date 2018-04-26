import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import series from 'async/series';
import { APP_CACHE_IMAGE } from '../constants';
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
                    const svgReader = new SvgReader(0.08);
                    const parseResult = svgReader.parse(node);
                    res.send({
                        filename: filename,
                        filePath: imagePath,
                        format: 'svg',
                        width: parseResult.originalSize.width,
                        height: parseResult.originalSize.height,
                        density: 1
                    });
                    next();
                });
            } else {
                // Sharp has bug parsing SVG files with unit
                sharp(imagePath)
                    .metadata()
                    .then((metadata) => {
                        res.send({
                            filename: filename,
                            filePath: imagePath,
                            format: metadata.format,
                            width: metadata.width,
                            height: metadata.height,
                            density: metadata.density || 72 // DPI
                        });
                        next();
                    });
            }
        }
    ], (err, results) => {
        if (err) {
            log.error(`Failed to read image ${filename}`);
        }
        res.end();
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

    imageProcess(options, (filename) => {
        res.send({ filename: filename });
    });
};
