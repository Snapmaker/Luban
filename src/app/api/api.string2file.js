import fs from 'fs';
import { APP_CACHE_IMAGE } from '../constants';
import logger from '../lib/logger';

const log = logger('api:file');

export const set = (req, res) => {
    const string = req.body.string;
    const filename = 'output.stl';
    const path = `${APP_CACHE_IMAGE}/${filename}`;
    fs.writeFile(path, string, (err) => {
        if (err) {
            log.error(`err=${err}`);
        } else {
            log.debug(`written string to file ${path}`);
            res.send({
                filename: filename
            });
        }
    });
};
