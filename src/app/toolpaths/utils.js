import {
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_HALFTONE, PROCESS_MODE_VECTOR, SOURCE_TYPE_DXF,
    SOURCE_TYPE_IMAGE3D,
    SOURCE_TYPE_RASTER,
    SOURCE_TYPE_SVG, SOURCE_TYPE_TEXT,
    TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR
} from '../constants';

const crossKeys = (...args) => {
    const _crossKeys = (param, keys, res) => {
        for (const key of keys) {
            if (param === '') {
                res.push(`${key}`);
            } else {
                res.push(`${param},${key}`);
            }
        }
    };

    let params = [''];
    let result = [''];

    for (const arg of args) {
        params = result;
        result = [];
        for (const param of params) {
            _crossKeys(param, arg, result);
        }
    }

    return result.map(v => v.split(','));
};

const toolPathTypeMap = new Map();

const setMap = (key, value) => {
    toolPathTypeMap.set(JSON.stringify(key), value);
};

const getMap = (key) => {
    return toolPathTypeMap.get(JSON.stringify(key));
};

crossKeys([SOURCE_TYPE_RASTER], [PROCESS_MODE_BW, PROCESS_MODE_GREYSCALE, PROCESS_MODE_HALFTONE])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_IMAGE);
    });

crossKeys([SOURCE_TYPE_RASTER], [PROCESS_MODE_VECTOR])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_VECTOR);
    });

crossKeys([SOURCE_TYPE_SVG, SOURCE_TYPE_TEXT, SOURCE_TYPE_DXF], [PROCESS_MODE_VECTOR])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_VECTOR);
    });

crossKeys([SOURCE_TYPE_IMAGE3D], [PROCESS_MODE_GREYSCALE])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_SCULPT);
    });


export const getToolPathType = (models) => {
    let types = models.map(v => getMap([v.sourceType, v.mode]));
    types = Array.from(new Set(types));
    return types;
};

let count = 1;

export const createToolPathName = () => {
    return `Toolpath${count++}`;
};

export const IDLE = 'idle';
// eslint-disable-next-line no-unused-vars
export const RUNNING = 'running';
// eslint-disable-next-line no-unused-vars
export const FAILED = 'failed';
// eslint-disable-next-line no-unused-vars
export const SUCCESS = 'success';
// eslint-disable-next-line no-unused-vars
export const WARNING = 'warning';
