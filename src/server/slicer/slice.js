import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

import { pathWithRandomSuffix } from '../lib/random-utils';
import logger from '../lib/logger';
import { CURA_ENGINE_MACOS, CURA_ENGINE_WIN64, CURA_ENGINE_LINUX } from '../constants';
import DataStorage from '../DataStorage';


const log = logger('print3d-slice');

let curaEnginePath;

// Determine path of Cura Engine
(() => {
    if (process.platform === 'darwin') {
        curaEnginePath = `${CURA_ENGINE_MACOS}`;
    } else if (process.platform === 'win32') {
        if (process.arch === 'x64') {
            curaEnginePath = `${CURA_ENGINE_WIN64}`;
        }
    } else if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            curaEnginePath = CURA_ENGINE_LINUX;
        }
    }
    if (!curaEnginePath || !fs.existsSync(curaEnginePath)) {
        log.error(`Cura Engine not found: ${curaEnginePath}`);
    }
})();

function callCuraEngine(modelPath, configPath, outputPath) {
    return childProcess.spawn(
        curaEnginePath,
        ['slice', '-v', '-p', '-j', configPath, '-o', outputPath, '-l', modelPath]
    );
}

let sliceProgress, filamentLength, filamentWeight, printTime;

function slice(params, onProgress, onSucceed, onError) {
    if (!fs.existsSync(curaEnginePath)) {
        log.error(`Cura Engine not found: ${curaEnginePath}`);
        onError(`Slice Error: Cura Engine not found: ${curaEnginePath}`);
        return;
    }

    const { originalName, uploadName } = params;
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    if (!fs.existsSync(uploadPath)) {
        log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
        onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
        return;
    }

    const configFilePath = `${DataStorage.configDir}/active_final.def.json`;

    const gcodeFileName = pathWithRandomSuffix(`${path.parse(originalName).name}.gcode`);
    const gcodeFilePath = `${DataStorage.tmpDir}/${gcodeFileName}`;

    const process = callCuraEngine(uploadPath, configFilePath, gcodeFilePath);

    process.stderr.on('data', (data) => {
        const array = data.toString().split('\n');

        array.map((item) => {
            if (item.length < 10) {
                return null;
            }
            if (item.indexOf('Progress:inset+skin:') === 0 || item.indexOf('Progress:export:') === 0) {
                const start = item.indexOf('0.');
                const end = item.indexOf('%');
                sliceProgress = Number(item.slice(start, end));
                onProgress(sliceProgress);
            } else if (item.indexOf(';Filament used:') === 0) {
                filamentLength = Number(item.replace(';Filament used:', '').replace('m', ''));
                filamentWeight = Math.PI * (1.75 / 2) * (1.75 / 2) * filamentLength * 1.24;
            } else if (item.indexOf('Print time (s):') === 0) {
                // Times empirical parameter: 1.07
                printTime = Number(item.replace('Print time (s):', '')) * 1.07;
            }
            return null;
        });
    });

    process.on('close', (code) => {
        if (filamentLength && filamentWeight && printTime) {
            sliceProgress = 1;
            onProgress(sliceProgress);
            onSucceed({
                gcodeFileName: gcodeFileName,
                printTime: printTime,
                filamentLength: filamentLength,
                filamentWeight: filamentWeight,
                gcodeFilePath: gcodeFilePath
            });
        }
        log.info(`slice progress closed with code ${code}`);
    });
}

export default slice;
