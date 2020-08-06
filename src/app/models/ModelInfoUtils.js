import {
    ABSENT_VALUE, CNC_MESH_SLICE_MODE_ROTATION, FACE_FRONT, HEAD_CNC, HEAD_LASER,
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE, PROCESS_MODE_HALFTONE,
    PROCESS_MODE_VECTOR,
    SOURCE_TYPE_IMAGE3D,
    SOURCE_TYPE_RASTER,
    SOURCE_TYPE_SVG, SOURCE_TYPE_TEXT
} from '../constants';

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 4;

const DEFAULT_TEXT_CONFIG = {
    text: 'Snapmaker',
    name: 'text.svg',
    'font-size': 24,
    'font-family': 'Georgia',
    'line-height': 1.5,
    alignment: 'left' // left, middle, right
};

const sizeModelByMachineSize = (size, width, height) => {
    let height_ = height;
    let width_ = width;
    if (width_ * size.y >= height_ * size.x && width_ > size.x) {
        height_ = size.x * height_ / width_;
        width_ = size.x;
    }
    if (height_ * size.x >= width_ * size.y && height_ > size.y) {
        width_ = size.y * width_ / height_;
        height_ = size.y;
    }
    return { width: width_, height: height_ };
};

const checkParams = (headType, sourceType, mode) => {
    if (headType !== 'laser' && headType !== 'cnc' && headType !== '3dp') {
        return false;
    }
    if (!['3d', 'raster', 'svg', 'dxf', 'text', 'image3d'].includes(sourceType)) {
        return false;
    }
    if (!['bw', 'greyscale', 'vector', 'trace', 'text', 'halftone'].includes(mode)) {
        return false;
    }
    return true;
};

const toKey = (...args) => {
    return args.join('-');
};

const defaultConfigs = {

    // Laser
    [toKey(HEAD_LASER, PROCESS_MODE_BW)]: {
        invert: false,
        bwThreshold: 168
    },
    [toKey(HEAD_LASER, PROCESS_MODE_HALFTONE)]: {
        invert: false,
        threshold: 255, // turn pixel to white
        bwThreshold: 168, // used by toolpath generator
        npType: 'line',
        npSize: 30,
        npAngle: 135
    },
    [toKey(HEAD_LASER, PROCESS_MODE_GREYSCALE)]: {
        invert: false,
        contrast: 50,
        brightness: 50,
        whiteClip: 255,
        bwThreshold: 168,
        algorithm: 'Atkinson'
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER)]: {
        vectorThreshold: 128,
        invert: false,
        turdSize: 2
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_SVG)]: {
        'stroke-width': '0.25'
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_TEXT)]: {
        ...DEFAULT_TEXT_CONFIG,
        invert: false,
        contrast: 50,
        brightness: 50,
        whiteClip: 255,
        bwThreshold: 168,
        algorithm: 'Atkinson'
    },

    // Cnc
    [toKey(HEAD_CNC, PROCESS_MODE_GREYSCALE)]: {
        invert: false
    },
    [toKey(HEAD_CNC, PROCESS_MODE_GREYSCALE, SOURCE_TYPE_IMAGE3D)]: {
        face: FACE_FRONT,
        minGray: 0,
        maxGray: 255,
        sliceDensity: 5,
        extensionX: 0,
        extensionY: 0
    },
    [toKey(HEAD_CNC, PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER)]: {
        vectorThreshold: 128,
        invert: false,
        turdSize: 2
    },
    [toKey(HEAD_CNC, PROCESS_MODE_VECTOR, SOURCE_TYPE_TEXT)]: {
        ...DEFAULT_TEXT_CONFIG
    }
};

const defaultGcodeConfigs = {

    // Laser
    [toKey(HEAD_LASER, PROCESS_MODE_GREYSCALE)]: {
        movementMode: 'greyscale-dot', // greyscale-line, greyscale-dot
        density: 7,
        jogSpeed: 1500,
        workSpeed: 2500,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 35,
        multiPassEnabled: false,
        multiPasses: 2,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_BW)]: {
        direction: 'Horizontal',
        density: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 800,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: ABSENT_VALUE,
        fixedPowerEnabled: false,
        fixedPower: 50,
        multiPassEnabled: false,
        multiPasses: 2,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_HALFTONE)]: {
        direction: 'Horizontal',
        density: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 800,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: ABSENT_VALUE,
        fixedPowerEnabled: false,
        fixedPower: 50,
        multiPassEnabled: false,
        multiPasses: 2,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR)]: {
        optimizePath: false,
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 140,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: ABSENT_VALUE,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: true,
        multiPasses: 2,
        multiPassDepth: 0.6
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, true)]: {
        optimizePath: false,
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 800,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: ABSENT_VALUE,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: false,
        multiPasses: 2,
        multiPassDepth: 0.6
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER)]: {
        optimizePath: true,
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 140,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: ABSENT_VALUE,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: true,
        multiPasses: 2,
        multiPassDepth: 0.6
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER, true)]: {
        optimizePath: true,
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 800,
        plungeSpeed: ABSENT_VALUE,
        dwellTime: ABSENT_VALUE,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: false,
        multiPasses: 2,
        multiPassDepth: 0.6
    },

    // Cnc
    [toKey(HEAD_CNC, PROCESS_MODE_GREYSCALE)]: {
        targetDepth: 2.0,
        stepDown: 0.5,
        safetyHeight: 1.0,
        stopHeight: 10,
        density: 5,
        jogSpeed: 3000,
        workSpeed: 600,
        plungeSpeed: 600,
        dwellTime: ABSENT_VALUE
    },
    [toKey(HEAD_CNC, PROCESS_MODE_GREYSCALE, SOURCE_TYPE_IMAGE3D)]: {
        sliceMode: CNC_MESH_SLICE_MODE_ROTATION,
        targetDepth: 2.0,
        stepDown: 0.5,
        safetyHeight: 1.0,
        stopHeight: 10,
        density: 5,
        jogSpeed: 3000,
        workSpeed: 300,
        plungeSpeed: 300,
        dwellTime: ABSENT_VALUE,
        isModel: true
    },
    [toKey(HEAD_CNC)]: {
        optimizePath: false,
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillDensity: DEFAULT_FILL_DENSITY,
        pathType: 'path',
        targetDepth: 2.0,
        stepDown: 0.5,
        safetyHeight: 1,
        stopHeight: 10,
        enableTab: false,
        tabWidth: 2,
        tabHeight: -0.5,
        tabSpace: 24,
        anchor: 'Center',
        jogSpeed: 3000,
        workSpeed: 300,
        plungeSpeed: 300,
        dwellTime: ABSENT_VALUE
    }
};

const generateModelDefaultConfigs = (headType, sourceType, mode, isRotate = false) => {
    const config = defaultConfigs[toKey(headType, mode, sourceType, isRotate)]
        || defaultConfigs[toKey(headType, mode, sourceType)]
        || defaultConfigs[toKey(headType, mode, isRotate)]
        || defaultConfigs[toKey(headType, mode)]
        || defaultConfigs[toKey(headType)]
        || {};
    const gcodeConfig = defaultGcodeConfigs[toKey(headType, mode, sourceType, isRotate)]
        || defaultGcodeConfigs[toKey(headType, mode, sourceType)]
        || defaultGcodeConfigs[toKey(headType, mode, isRotate)]
        || defaultGcodeConfigs[toKey(headType, mode)]
        || defaultGcodeConfigs[toKey(headType)]
        || {};
    return { config, gcodeConfig };
};

export {
    DEFAULT_TEXT_CONFIG,
    sizeModelByMachineSize,
    checkParams,
    generateModelDefaultConfigs
};
