import fs from 'fs';
import path from 'path';
import { APP_CACHE_IMAGE } from '../constants';

export const set = (req, res) => {
    let filename = path.basename(req.files.image.originalFilename);

    fs.rename(req.files.image.path, `${APP_CACHE_IMAGE}/${filename}`, () => {
        res.send(filename);
        res.end();
    });
};
