import { ABSENT_VALUE } from '../../constants';

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 4;

const DEFAULT_TEXT_CONFIG = {
    optimizePath: false,
    fillEnabled: DEFAULT_FILL_ENABLED,
    fillDensity: DEFAULT_FILL_DENSITY,
    text: 'Snapmaker',
    name: 'text.svg',
    size: 24,
    font: 'Georgia',
    lineHeight: 1.5,
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

const checkParams = (headerType, sourceType, mode) => {
    if (headerType !== 'laser' && headerType !== 'cnc' && headerType !== '3dp') {
        return false;
    }
    if (!['3d', 'raster', 'svg', 'text'].includes(sourceType)) {
        return false;
    }
    if (!['bw', 'greyscale', 'vector', 'trace'].includes(mode)) {
        return false;
    }
    return true;
};

const generateLaserDefaults = (mode, sourceType) => {
    let config = null;
    let gcodeConfig = null;
    switch (mode) {
        case 'bw': {
            config = {
                invertGreyscale: false,
                bwThreshold: 168,
                density: DEFAULT_FILL_DENSITY,
                direction: 'Horizontal'
            };
            break;
        }
        case 'greyscale': {
            config = {
                invertGreyscale: false,
                contrast: 50,
                brightness: 50,
                whiteClip: 255,
                bwThreshold: 168,
                algorithm: 'Atkinson',
                movementMode: 'greyscale-dot', // greyscale-line, greyscale-dot
                density: 7
            };
            break;
        }
        case 'vector': {
            switch (sourceType) {
                case 'raster': {
                    config = {
                        optimizePath: true,
                        fillEnabled: DEFAULT_FILL_ENABLED,
                        fillDensity: DEFAULT_FILL_DENSITY,
                        vectorThreshold: 128,
                        isInvert: false,
                        turdSize: 2
                    };
                    break;
                }
                case 'svg': {
                    config = {
                        optimizePath: false,
                        fillEnabled: DEFAULT_FILL_ENABLED,
                        fillDensity: DEFAULT_FILL_DENSITY
                    };
                    break;
                }
                case 'text': {
                    config = { ...DEFAULT_TEXT_CONFIG };
                    break;
                }
                default:
                    break;
            }
            break;
        }
        case 'trace': {
            config = {
                optimizePath: false,
                fillEnabled: DEFAULT_FILL_ENABLED,
                fillDensity: DEFAULT_FILL_DENSITY
            };
            break;
        }
        default:
            break;
    }

    if (mode === 'greyscale') {
        gcodeConfig = {
            // Default movement mode is greyscale-line
            // greyscale-line: workSpeed: 500, dwellTime: null
            // greyscale-dot: workSpeed: null, dwellTime: 42
            jogSpeed: 1500,
            workSpeed: 2500,
            plungeSpeed: ABSENT_VALUE,
            dwellTime: 5,
            fixedPowerEnabled: false,
            fixedPower: 35,
            multiPassEnabled: false,
            multiPasses: 2,
            multiPassDepth: 1
        };
    } else if (mode === 'bw') {
        gcodeConfig = {
            jogSpeed: 3000,
            workSpeed: 800,
            plungeSpeed: ABSENT_VALUE,
            dwellTime: ABSENT_VALUE,
            fixedPowerEnabled: false,
            fixedPower: 50,
            multiPassEnabled: false,
            multiPasses: 2,
            multiPassDepth: 1
        };
    } else {
        gcodeConfig = {
            jogSpeed: 3000,
            workSpeed: 140,
            plungeSpeed: ABSENT_VALUE,
            dwellTime: ABSENT_VALUE,
            fixedPowerEnabled: false,
            fixedPower: 100,
            multiPassEnabled: true,
            multiPasses: 2,
            multiPassDepth: 0.6
        };
    }
    return { config, gcodeConfig };
};

const generateCNCDefaults = (mode) => {
    let config = null;
    switch (mode) {
        case 'greyscale':
            config = {
                toolDiameter: 3.175, // tool diameter (in mm)
                toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                targetDepth: 1.0,
                stepDown: 0.1,
                safetyHeight: 5.0,
                stopHeight: 10,
                isInvert: true,
                density: 5
            };
            break;
        case 'vector':
            config = {
                toolDiameter: 3.175, // tool diameter (in mm)
                toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                pathType: 'path',
                targetDepth: 1.0,
                stepDown: 0.5,
                safetyHeight: 5.0,
                stopHeight: 10,
                enableTab: false,
                tabWidth: 2,
                tabHeight: -0.5,
                tabSpace: 24,
                anchor: 'Center',
                ...DEFAULT_TEXT_CONFIG
            };
            break;
        case 'trace':
            config = {
                toolDiameter: 3.175, // tool diameter (in mm)
                toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                pathType: 'path',
                targetDepth: 1.0,
                stepDown: 0.2,
                safetyHeight: 0.2,
                stopHeight: 10,
                enableTab: false,
                tabWidth: 2,
                tabHeight: -0.5,
                tabSpace: 24,
                anchor: 'Center'
            };
            break;
        default:
            break;
    }

    const gcodeConfig = {
        jogSpeed: 3000,
        workSpeed: 600,
        plungeSpeed: 600,
        dwellTime: ABSENT_VALUE
    };
    return { config, gcodeConfig };
};

const generateModelDefaultConfigs = (headerType, sourceType, mode) => {
    let defaultConfigs = {};
    if (headerType === 'laser') {
        defaultConfigs = generateLaserDefaults(mode, sourceType);
    } else if (headerType === 'cnc') {
        defaultConfigs = generateCNCDefaults(mode);
    }
    return defaultConfigs;
};

export {
    DEFAULT_TEXT_CONFIG,
    sizeModelByMachineSize,
    checkParams,
    generateModelDefaultConfigs
};
