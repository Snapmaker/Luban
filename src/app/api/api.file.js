import fs from 'fs';
import path from 'path';
import series from 'async/series';
import { APP_CACHE_IMAGE } from '../constants';
import logger from '../lib/logger';

const log = logger('api:file');

export const set = (req, res) => {
    const file = req.files.file;
    const filename = path.basename(file.originalFilename);
    const filePath = `${APP_CACHE_IMAGE}/${filename}`;

    series([
        (next) => {
            fs.rename(file.path, filePath, () => {
                next();
            });
        },
        (next) => {
            res.send({
                filename: filename,
                filePath: filePath
            });
            next();
        }
    ], (err, results) => {
        if (err) {
            log.error(`Failed to upload file ${filename}`);
        } else {
            res.end();
        }
    });
};
