import fs from 'fs';
import path from 'path';
import { pathWithRandomSuffix } from './random-utils';
import logger from './logger';
import { CURA_ENGINE_MACOS, APP_CACHE_IMAGE, CURA_ENGINE_WIN64, CURA_ENGINE_LINUX_X64 } from '../constants';

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
            curaEnginePath = CURA_ENGINE_LINUX_X64;
        }
    }
    if (!fs.existsSync(curaEnginePath)) {
        log.error(`Cura Engine not found: ${curaEnginePath}`);
    }
})();

function callCuraEngine(modelPath, configPath, outputPath) {
    const childProcess = require('child_process');
    return childProcess.spawn(
        curaEnginePath,
        ['slice', '-v', '-p', '-j', configPath, '-o', outputPath, '-l', modelPath]
    );
}

let sliceProgress, filamentLength, filamentWeight, printTime;

function Print3DSlice(params, onProgress, onSucceed, onError) {
    if (!fs.existsSync(curaEnginePath)) {
        log.error(`Cura Engine not found: ${curaEnginePath}`);
        onError(`Slice Error: Cura Engine not found: ${curaEnginePath}`);
        return;
    }

    const { configFilePath, modelName, modelFileName } = params;
    const modelPath = `${APP_CACHE_IMAGE}/${modelFileName}`;

    if (!fs.existsSync(configFilePath)) {
        log.error('Slice Error: config file does not exist -> ' + configFilePath);
        onError('Slice Error: config file does not exist -> ' + configFilePath);
        return;
    }
    if (!fs.existsSync(modelPath)) {
        log.error('Slice Error: 3d model file does not exist -> ' + modelPath);
        onError('Slice Error: 3d model file does not exist -> ' + modelPath);
        return;
    }

    const gcodeFileName = pathWithRandomSuffix(`${path.parse(modelName).name}.gcode`);
    const gcodeFilePath = `${APP_CACHE_IMAGE}/${gcodeFileName}`;

    const process = callCuraEngine(modelPath, configFilePath, gcodeFilePath);

    process.stderr.on('data', (data) => {
        let array = data.toString().split('\n');

        array.map((item) => {
            if (item.length < 10) {
                return null;
            }
            if (item.indexOf('Progress:inset+skin:') === 0 || item.indexOf('Progress:export:') === 0) {
                let start = item.indexOf('0.');
                let end = item.indexOf('%');
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
        console.log(filamentLength,
            filamentWeight,
            printTime
        );
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
        log.info('slice progress closed with code ' + code);
    });
}

export default Print3DSlice;
