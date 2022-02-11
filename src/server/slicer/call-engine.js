import fs from 'fs';

import lubanEngine from 'snapmaker-luban-engine';
import logger from '../lib/logger';
import DataStorage from '../DataStorage';
import { pathWithRandomSuffix } from '../../shared/lib/random-utils';


const log = logger('laser-cnc-slice');

function slice(modelInfo, onProgress, onSucceed, onError) {
    const { headType, data } = modelInfo;

    for (const d of data) {
        const uploadPath = `${DataStorage.tmpDir}/${d.uploadName}`;

        if (!fs.existsSync(uploadPath)) {
            log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
            return;
        }
    }

    const settingsFilePath = `${DataStorage.tmpDir}/${pathWithRandomSuffix('settings')}.json`;

    fs.writeFileSync(settingsFilePath, JSON.stringify(modelInfo));

    let sliceProgress;

    lubanEngine.slice(headType, DataStorage.tmpDir, DataStorage.tmpDir, settingsFilePath)
        .onStderr('data', (res) => {
            const array = res.toString()
                .split('\n');
            array.map((item) => {
                if (item.length < 10) {
                    return null;
                }
                if (item.indexOf('Progress:') === 0 && item.indexOf('accomplished') === -1) {
                    const start = item.search('[0-9.]*%');
                    const end = item.indexOf('%');
                    sliceProgress = Number(item.slice(start, end));
                    onProgress(sliceProgress);
                }
                if (item.indexOf('ERROR') !== -1) {
                    log.error(item);
                }
                return null;
            });
        })
        .end((err, res) => {
            if (err) {
                log.error(`LubanEngine slice error, Code: ${err.code} | Msg: ${err.msg}`);
                onError();
            } else {
                onSucceed({
                    filenames: data.map(v => v.toolpathFileName)
                });
                log.info(`slice progress closed with code ${res.code}`);
            }
        });
}

export default slice;
