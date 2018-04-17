import fs from 'fs';
import logger from './logger';
import { CURA_ENGINE_MAC, APP_CACHE_IMAGE } from '../constants';

const log = logger('slice-progress');

var sliceProgress, filamentLength, filamentWeight, printTime;
function slice(param, cb) {
    var curaEnginePath = `${CURA_ENGINE_MAC}`;
    var configPath = param.configFilePath;
    var modelPath = `${APP_CACHE_IMAGE}/${param.modelFileName}`;
    var gcodeFileName = 'output.gcode';
    var gcodeFilePath = `${APP_CACHE_IMAGE}/${gcodeFileName}`;
    //check file exist
    if (!fs.existsSync(curaEnginePath)) {
        log.error('Slice Error : CuraEngine is not exist -> ' + curaEnginePath);
        cb('Slice Error : CuraEngine is not exist -> ' + curaEnginePath);
        return;
    }

    if (!fs.existsSync(configPath)) {
        log.error('Slice Error : config file is not exist -> ' + configPath);
        cb('Slice Error : config file is not exist -> ' + configPath);
        return;
    }

    if (!fs.existsSync(modelPath)) {
        log.error('Slice Error : 3d model file is not exist -> ' + modelPath);
        cb('Slice Error : 3d model file is not exist -> ' + modelPath);
        return;
    }
    var childProcess = require('child_process');
    log.info('********************************');
    log.info('call Cura Engine...');
    log.info('configPath = ' + configPath);
    log.info('gcodeFilePath = ' + gcodeFilePath);
    log.info('modelPath = ' + modelPath);
    var wmic = childProcess.spawn(curaEnginePath, ['slice', '-v', '-p', '-j', configPath, '-o', gcodeFilePath, '-l', modelPath]);

    wmic.stderr.on('data', (data) => {
        var array = data.toString().split('\n');

        array.map((item) => {
            if (item.length < 10) {
                return null;
            }

            if (item.indexOf('Progress:inset+skin:') === 0 || item.indexOf('Progress:export:') === 0) {
                var start = item.indexOf('0.');
                var end = item.indexOf('%');
                sliceProgress = Number(item.slice(start, end));
                cb(undefined, sliceProgress);
            } else if (item.indexOf(';Filament used:') === 0) {
                filamentLength = Number(item.replace(';Filament used:', '').replace('m', ''));
                filamentWeight = Math.PI * (1.75 / 2) * (1.75 / 2) * filamentLength * 1.24;
                sliceProgress = 1;
                cb(undefined, sliceProgress, gcodeFileName, printTime, filamentLength, filamentWeight, gcodeFilePath);
            } else if (item.indexOf('Print time:') === 0) {
                //add empirical parameter : 1.07
                printTime = Number(item.replace('Print time:', '')) * 1.07;
                sliceProgress = 1;
                cb(undefined, sliceProgress, gcodeFileName, printTime, filamentLength, filamentWeight, gcodeFilePath);
            }
            return null;
        });
    });

    wmic.on('close', (code) => {
        log.info('slice progress has closed **************************************');
    });
}

export default slice;
