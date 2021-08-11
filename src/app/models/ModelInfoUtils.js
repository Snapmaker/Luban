import {
    CNC_MESH_SLICE_MODE_ROTATION, BOTTOM, FRONT, HEAD_CNC, HEAD_LASER,
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_HALFTONE,
    PROCESS_MODE_VECTOR,
    SOURCE_TYPE_IMAGE3D,
    SOURCE_TYPE_RASTER,
    SOURCE_TYPE_SVG, SOURCE_TYPE_TEXT, PROCESS_MODE_MESH, SOURCE_TYPE_3DP
} from '../constants';
import { round } from '../../shared/lib/utils';

const DEFAULT_FILL_ENABLED = false;
// const DEFAULT_FILL_DENSITY = 4;
const DEFAULT_FILL_INTERVAL = 0.25;

const DEFAULT_TEXT_CONFIG = {
    text: 'Snapmaker',
    name: 'text.svg',
    'font-size': 24,
    'font-family': 'Georgia',
    'line-height': 1.5,
    alignment: 'left' // left, middle, right
};

/**
 * Limit model size proportionally.
 *
 * @param size
 * @param width
 * @param height
 */
const limitModelSizeByMachineSize = (size, width, height) => {
    let height_ = height;
    let width_ = width;
    if (width_ * size.y >= height_ * size.x && width_ > size.x) {
        height_ = size.x * height_ / width_ * 0.6;
        width_ = size.x * 0.6;
    }
    if (height_ * size.x >= width_ * size.y && height_ > size.y) {
        width_ = size.y * width_ / height_ * 0.6;
        height_ = size.y * 0.6;
    }
    return { width: width_, height: height_, scale: round(width_ / width, 2) };
};

const MIN_SIZE = {
    x: 50,
    y: 50
};

const sizeModelByMinSize = (size = MIN_SIZE, width, height) => {
    if (width < size.x && height < size.y) {
        const scale = round(Math.max(MIN_SIZE.x / width, MIN_SIZE.y / height), 2);
        return { width: width * scale, height: height * scale, scale };
    }
    return null;
};

const checkParams = (headType, sourceType, mode) => {
    if (headType !== 'laser' && headType !== 'cnc' && headType !== '3dp') {
        return false;
    }
    if (![SOURCE_TYPE_3DP, SOURCE_TYPE_RASTER, SOURCE_TYPE_SVG, SOURCE_TYPE_TEXT, SOURCE_TYPE_IMAGE3D].includes(sourceType)) {
        return false;
    }
    if (![PROCESS_MODE_BW, PROCESS_MODE_GREYSCALE, PROCESS_MODE_VECTOR, PROCESS_MODE_HALFTONE, PROCESS_MODE_MESH].includes(mode)) {
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
    [toKey(HEAD_CNC, PROCESS_MODE_MESH, SOURCE_TYPE_IMAGE3D)]: {
        direction: FRONT,
        placement: BOTTOM,
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
    [toKey(HEAD_CNC, PROCESS_MODE_VECTOR, SOURCE_TYPE_SVG)]: {
        'stroke-width': '0.25'
    },
    [toKey(HEAD_CNC, PROCESS_MODE_VECTOR, SOURCE_TYPE_TEXT)]: {
        ...DEFAULT_TEXT_CONFIG
    }
};

const defaultGcodeConfigs = {

    // Laser
    [toKey(HEAD_LASER, PROCESS_MODE_GREYSCALE)]: {
        direction: 'Horizontal',
        movementMode: 'greyscale-dot', // greyscale-line, greyscale-dot
        fillInterval: 0.14, // density: 7,
        jogSpeed: 2500,
        workSpeed: 2500,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: true,
        fixedPower: 60,
        multiPassEnabled: true,
        multiPasses: 1,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_BW)]: {
        direction: 'Horizontal',
        movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
        fillInterval: DEFAULT_FILL_INTERVAL, // density: DEFAULT_FILL_DENSITY,
        jogSpeed: 2500,
        workSpeed: 2500,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 60,
        multiPassEnabled: true,
        multiPasses: 1,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_HALFTONE)]: {
        direction: 'Horizontal',
        movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
        fillInterval: DEFAULT_FILL_INTERVAL, // density: DEFAULT_FILL_DENSITY,
        jogSpeed: 2500,
        workSpeed: 2500,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 60,
        multiPassEnabled: true,
        multiPasses: 1,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR)]: {
        optimizePath: false,
        movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillInterval: DEFAULT_FILL_INTERVAL, // fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 140,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: true,
        multiPasses: 2,
        multiPassDepth: 0.6
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, true)]: {
        optimizePath: false,
        movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillInterval: DEFAULT_FILL_INTERVAL, // fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 800,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: true,
        multiPasses: 1,
        multiPassDepth: 1
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER)]: {
        optimizePath: true,
        movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillInterval: DEFAULT_FILL_INTERVAL, // fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 140,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: true,
        multiPasses: 2,
        multiPassDepth: 0.6
    },
    [toKey(HEAD_LASER, PROCESS_MODE_VECTOR, SOURCE_TYPE_RASTER, true)]: {
        optimizePath: true,
        movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
        fillEnabled: DEFAULT_FILL_ENABLED,
        fillInterval: DEFAULT_FILL_INTERVAL, // fillDensity: DEFAULT_FILL_DENSITY,
        jogSpeed: 3000,
        workSpeed: 800,
        plungeSpeed: 800,
        dwellTime: 5,
        fixedPowerEnabled: false,
        fixedPower: 100,
        multiPassEnabled: true,
        multiPasses: 1,
        multiPassDepth: 1
    },

    // Cnc
    [toKey(HEAD_CNC, PROCESS_MODE_GREYSCALE)]: {
        targetDepth: 2.0,
        allowance: 0,
        stepDown: 0.5,
        safetyHeight: 1.0,
        stopHeight: 10,
        stepOver: 0.25, // density: 5,
        jogSpeed: 1500,
        workSpeed: 600,
        plungeSpeed: 600,
        enableTab: false,
        dwellTime: 5
    },
    [toKey(HEAD_CNC, PROCESS_MODE_MESH, SOURCE_TYPE_IMAGE3D)]: {
        sliceMode: CNC_MESH_SLICE_MODE_ROTATION,
        smoothY: true,
        targetDepth: 2.0,
        allowance: 0,
        stepDown: 0.5,
        safetyHeight: 1.0,
        stopHeight: 10,
        stepOver: 0.25, // density: 5,
        enableTab: false,
        jogSpeed: 1500,
        workSpeed: 300,
        plungeSpeed: 300,
        dwellTime: 5,
        isModel: true
    },
    [toKey(HEAD_CNC, PROCESS_MODE_MESH, SOURCE_TYPE_IMAGE3D, true)]: {
        sliceMode: CNC_MESH_SLICE_MODE_ROTATION,
        smoothY: true,
        targetDepth: 2.0,
        allowance: 0,
        stepDown: 10,
        safetyHeight: 1.0,
        stopHeight: 10,
        stepOver: 0.25, // density: 5,
        enableTab: false,
        jogSpeed: 1500,
        workSpeed: 300,
        plungeSpeed: 300,
        dwellTime: 5,
        isModel: true
    },
    [toKey(HEAD_CNC)]: {
        optimizePath: false,
        fillEnabled: DEFAULT_FILL_ENABLED,
        stepOver: 0.25, // fillDensity: DEFAULT_FILL_DENSITY,
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
        jogSpeed: 1500,
        workSpeed: 300,
        plungeSpeed: 300,
        dwellTime: 5
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
    limitModelSizeByMachineSize,
    sizeModelByMinSize,
    checkParams,
    generateModelDefaultConfigs
};
