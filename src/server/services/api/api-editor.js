import mv from 'mv';
import logger from '../../lib/logger';
import path from './api-image';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import { ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import { editorProcess } from '../../lib/editor/process';

const log = logger('api:image');

const moveFile = (originalPath, tempPath) => {
    return new Promise((resolve, reject) => {
        mv(originalPath, tempPath, (err) => {
            if (err) {
                reject(new Error(err));
            } else {
                resolve();
            }
        });
    });
};

export const uploadEditorFile = async (req, res) => {
    const file = req.files.image;
    const originalName = path.basename(file.name);

    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    const options = req.body;

    try {
        await moveFile(file.path, uploadPath);

        const result = await editorProcess(options);
        res.send({
            originalName: originalName,
            uploadName: uploadPath,
            width: result.width,
            height: result.height
        });
        res.end();
    } catch (error) {
        log.error(`Failed to read image ${uploadName}`);
        res.status(ERR_INTERNAL_SERVER_ERROR).end();
    }
};
