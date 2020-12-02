import async from 'async';
import mv from 'mv';
import logger from '../../lib/logger';
import path from './api-image';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import { ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import { editorProcess } from '../../lib/editor/process';

const log = logger('api:image');

export const uploadEditorFile = (req, res) => {
    const file = req.files.image;
    const originalName = path.basename(file.name);

    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    const options = req.body;

    async.series([
        (next) => {
            mv(file.path, uploadPath, () => {
                next();
            });
        },
        async (next) => {
            editorProcess(options).then((result) => {
                res.send({
                    originalName: originalName,
                    uploadName: uploadPath,
                    width: result.width,
                    height: result.height
                });
                next();
            }).catch((err) => {
                next(err);
            });
        }
    ], (err) => {
        if (err) {
            log.error(`Failed to read image ${uploadName}`);
            res.status(ERR_INTERNAL_SERVER_ERROR).end();
        } else {
            res.end();
        }
    });
};
