import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import series from 'async/series';
import { APP_CACHE_IMAGE } from '../constants';
import logger from '../lib/logger';

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
    ], (err, results) => {
        if (err) {
            log.error(`Failed to read image ${filename}`);
        } else {
            res.end();
        }
    });
};
