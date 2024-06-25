import fs from 'fs';

import lunar from '@snapmaker/snapmaker-lunar';
import logger from '../lib/logger';
import { pathWithRandomSuffix } from '../../shared/lib/random-utils';

const log = logger('laser-cnc-slice');

function slice(modelInfo, onProgress, onSucceed, onError) {
    const {
        headType,
        data,
        toolPathLength
    } = modelInfo;

    for (const d of data) {
        const uploadPath = `${process.env.Tmpdir}/${d.uploadName}`;

        if (!fs.existsSync(uploadPath)) {
            log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            return;
        }
    }

    const settingsFilePath = `${process.env.Tmpdir}/${pathWithRandomSuffix('settings')}.json`;

    fs.writeFileSync(settingsFilePath, JSON.stringify(modelInfo));

    let sliceProgress;

    try {
        lunar.slice(headType, process.env.Tmpdir, process.env.Tmpdir, settingsFilePath)
            .onStderr('data', (item) => {
                log.info('-------------1----', item);
                if (item.length < 10) {
                    return null;
                }
                if (item.indexOf('Progress:') === 0 && item.indexOf('accomplished') === -1) {
                    const start = item.search('[0-9.]*%');
                    const end = item.indexOf('%');
                    sliceProgress = Number(item.slice(start, end));
                    if (toolPathLength < 10) {
                        onProgress(sliceProgress);
                    } else {
                        if (sliceProgress >= 0.8) {
                            onProgress(sliceProgress);
                        }
                    }
                }
                if (item.indexOf('ERROR') !== -1) {
                    log.error(item);
                }
                return null;
            })
            .onStdout('data', (item) => {
                log.info('-----------------', item);
            })
            .end((err, res) => {
                if (err) {
                    log.error(`LunarTPP slice error, Code: ${err.code} | Msg: ${err.msg}`);
                    onError(err);
                } else {
                    onSucceed({
                        filenames: data.map(v => v.toolpathFileName)
                    });
                    log.info(`slice progress closed with code ${res.code}`);
                }
            });
    } catch (err) {
        log.error('LunarTPP slice run error', err);
        onError('LunarTPP slice run error');
    }
}

export default slice;
