import fs from 'fs';
import childProcess from 'child_process';

import lubanEngine from 'snapmaker-luban-engine';
import logger from '../lib/logger';
import DataStorage from '../DataStorage';
import { pathWithRandomSuffix } from '../../shared/lib/random-utils';
import { HEAD_LASER } from '../../app/constants';


const log = logger('laser-cnc-slice');

let LubanEnginePath;

// Determine path of Cura Engine
(() => {
    if (process.platform === 'darwin') {
        LubanEnginePath = lubanEngine.getPath();
    } else if (process.platform === 'win32') {
        if (process.arch === 'x64') {
            LubanEnginePath = lubanEngine.getPath();
        }
    } else if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            LubanEnginePath = lubanEngine.getPath();
        }
    }
    if (!LubanEnginePath || !fs.existsSync(LubanEnginePath)) {
        log.error(`Luban Engine not found: ${LubanEnginePath}`);
    }
})();

/**
 * @param headType laser or cnc
 * @param configPath config path
 * @param inputPath input file dir
 * @param outputPath output file dir
 * @returns {*}
 */
function callLubanEngine(headType, configPath, inputPath, outputPath) {
    let args;
    if (headType === HEAD_LASER) {
        args = ['slicelaser', '-v', '-p', '-j', configPath, '-l', inputPath, '-o', outputPath];
    } else {
        args = ['slicecnc', '-v', '-p', '-j', configPath, '-l', inputPath, '-o', outputPath];
    }

    // console.log(args);
    return childProcess.spawn(
        LubanEnginePath,
        args
    );
}

let isSuccess = false;

function slice(modelInfo, onProgress, onSucceed, onError) {
    if (!fs.existsSync(LubanEnginePath)) {
        log.error(`Cura Engine not found: ${LubanEnginePath}`);
        onError(`Slice Error: Cura Engine not found: ${LubanEnginePath}`);
        return;
    }

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

    const process = callLubanEngine(headType, settingsFilePath, DataStorage.tmpDir, DataStorage.tmpDir);

    process.stderr.on('data', (res) => {
        const array = res.toString()
            .split('\n');

        array.map((item) => {
            if (item.indexOf('Success') === 0) {
                isSuccess = true;
            }
            return null;
        });
    });

    process.on('close', (code) => {
        if (isSuccess) {
            onSucceed({
                filename: data[0].toolpathFileName
            });
        } else {
            onError();
        }
        log.info(`slice progress closed with code ${code}`);
    });
}

export default slice;
