import path from 'path';
import mv from 'mv';
import { pathWithRandomSuffix } from '../lib/random-utils';
import logger from '../lib/logger';
import DataStorage from '../DataStorage';

const log = logger('api:file');

export const set = (req, res) => {
    const file = req.files.file;
    const originalName = path.basename(file.name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName: originalName,
                uploadName: uploadName
            });
            res.end();
        }
    });
};
