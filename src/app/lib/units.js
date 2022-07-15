import path from 'path';
import {
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR
} from '../constants';

// from mm to in
const mm2in = (val = 0) => val / 25.4;

// from in to mm
const in2mm = (val = 0) => val * 25.4;

const checkIsSnapmakerProjectFile = (file) => {
    const [, tail] = file.split('.');
    if (!tail) {
        return false;
    }
    return tail.substring(0, 4).toLowerCase() === 'snap';
};

const checkIsGCodeFile = (file) => {
    let [, tail] = file.split('.');
    if (!tail) {
        return false;
    }
    tail = tail.toLowerCase();
    return tail === 'gcode' || tail === 'nc' || tail === 'cnc';
};
const getUploadModeByFilename = (filename) => {
    const extname = path.extname(filename).toLowerCase();
    let uploadMode;
    if (extname === '.svg') {
        uploadMode = PROCESS_MODE_VECTOR;
    } else if (extname === '.dxf') {
        uploadMode = PROCESS_MODE_VECTOR;
    } else if (['.stl', '.3mf', '.amf'].includes(extname)) {
        uploadMode = PROCESS_MODE_MESH;
    } else {
        uploadMode = PROCESS_MODE_GREYSCALE;
    }
    return uploadMode;
};


export {
    mm2in,
    in2mm,
    getUploadModeByFilename,
    checkIsSnapmakerProjectFile,
    checkIsGCodeFile
};
