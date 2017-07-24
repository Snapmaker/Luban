import fs from 'fs';
import path from 'path';
import { APP_CACHE_IMAGE } from '../constants';

export const set = (req, res) => {
    console.log(req.files);
    let filename = path.basename(req.files.image.path);

    fs.rename(req.files.image.path, `${APP_CACHE_IMAGE}/${filename}`, () => {
        res.send(filename);
        res.end();
    });
};
