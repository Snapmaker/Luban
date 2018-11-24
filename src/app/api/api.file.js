import path from 'path';
import mv from 'mv';
import { APP_CACHE_IMAGE } from '../constants';
import logger from '../lib/logger';

const log = logger('api:file');

export const set = (req, res) => {
    const file = req.files.file;
    const filename = path.basename(file.originalFilename);
    const filePath = `${APP_CACHE_IMAGE}/${filename}`;
    mv(file.path, filePath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${filename}`);
        } else {
            res.send({
                filename: filename,
                filePath: filePath
            });
            res.end();
        }
    });
};
