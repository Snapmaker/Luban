import { DATA_PREFIX, ABSENT_VALUE } from '../../constants';

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 4;

const DEFAULT_TEXT_CONFIG = {
    optimizePath: false,
    fillEnabled: DEFAULT_FILL_ENABLED,
    fillDensity: DEFAULT_FILL_DENSITY,
    text: 'Snapmaker',
    size: 24,
    font: 'Georgia',
    lineHeight: 1.5,
    alignment: 'left' // left, middle, right
};

const GCODE_CONFIG_PLACEHOLDER = {
    jogSpeed: 'jogSpeed',
    workSpeed: 'workSpeed',
    dwellTime: 'dwellTime',
    plungeSpeed: 'plungeSpeed'
};

export const sizeModelByMachineSize = (size, width, height) => {
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

export const checkoutParams = (headerType, sourceType, mode) => {
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
                algorithm: 'FloydSteinburg',
                movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
                density: DEFAULT_FILL_DENSITY
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
            workSpeed: 500,
            plungeSpeed: ABSENT_VALUE,
            dwellTime: ABSENT_VALUE,
            fixedPowerEnabled: false,
            fixedPower: 100,
            multiPassEnabled: false,
            multiPasses: 2,
            multiPassDepth: 1
        };
    } else {
        gcodeConfig = {
            jogSpeed: 1500,
            workSpeed: 220,
            plungeSpeed: ABSENT_VALUE,
            dwellTime: ABSENT_VALUE,
            fixedPowerEnabled: false,
            fixedPower: 100,
            multiPassEnabled: false,
            multiPasses: 2,
            multiPassDepth: 1
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
                stepDown: 0.2,
                safetyHeight: 0.2,
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
                stepDown: 0.2,
                safetyHeight: 0.2,
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
        jogSpeed: 800,
        workSpeed: 300,
        plungeSpeed: 500,
        dwellTime: ABSENT_VALUE
    };
    return { config, gcodeConfig };
};

export const generateModelDefaultConfigs = (headerType, sourceType, mode) => {
    let defaultConfigs = {};
    if (headerType === 'laser') {
        defaultConfigs = generateLaserDefaults(mode, sourceType);
    } else if (headerType === 'cnc') {
        defaultConfigs = generateCNCDefaults(mode);
    }
    return defaultConfigs;
};


class ModelInfo {
    headerType = null;

    sourceType = null;

    originalName = '';

    uploadName = '';

    transformation = null;

    mode = null;

    movementMode = 'line';

    config = null;

    gcodeConfig = null;

    printOrder = 1;

    gcodeConfigPlaceholder = GCODE_CONFIG_PLACEHOLDER;

    geometry = null;

    material = null;

    canBuilder = true;

    constructor(limitSize) {
        this.limitSize = limitSize;
        this.transformation = {
            width: 0,
            height: 0,
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            flip: 0
        };
    }

    /*
    get originalName() {
        return this.originalName;
    }

    get sourceType() {
        return this.sourceType;
    }
    */

    setHeaderType(headerType) {
        if (headerType !== 'laser' && headerType !== 'cnc' && headerType !== '3dp') {
            this.canBuilder = false;
        }
        this.headerType = headerType;
        return this;
    }

    // setSource(sourceType, originalName, uploadName) {
    setSource(sourceType, originalName, uploadName, sourceHeight, sourceWidth, mode) {
        if (!['3d', 'raster', 'svg', 'text'].includes(sourceType)) {
            this.canBuilder = false;
        }

        this.sourceType = sourceType;
        this.originalName = originalName;
        this.uploadName = uploadName;
        this.uploadPath = `${DATA_PREFIX}/${uploadName}`;
        this.sourceHeight = sourceHeight;
        this.sourceWidth = sourceWidth;

        /*
        this.source = {
            sourceType, originalName, uploadName, width, height
        };
        */
        const { width, height } = sizeModelByMachineSize(this.limitSize, sourceWidth, sourceHeight);

        this.transformation = {
            ...this.transformation,
            height: height,
            width: width
        };

        if (!['bw', 'greyscale', 'vector', 'trace'].includes(mode)) {
            this.canBuilder = false;
        }

        this.mode = mode;
        return this;
    }


    setGeometry(geometry) {
        this.geometry = geometry;
        return this;
    }

    setMaterial(material) {
        this.material = material;
        return this;
    }

    /*
    setNormalizedModelSize(height, width) {
        // let { height, width } = transformation;

        let height_ = 0;
        let width_ = 0;
        if (width * this.limitSize.y >= height * this.limitSize.x && width > this.limitSize.x) {
            height_ = this.limitSize.x * height / width;
            width_ = this.limitSize.x;
        }
        if (height_ * this.limitSize.x >= width_ * this.limitSize.y && height_ > this.limitSize.y) {
            width_ = this.limitSize.y * width_ / height_;
            height_ = this.limitSize.y;
        }
        console.log('hw ', width_, height_);

        this.transformation = {
            ...this.transformation,
            width: width_,
            height: height_
        };
    }
    */


    generateDefaults() {
        if (this.headerType === 'laser') {
            this.generateLaserDefaults();
        } else if (this.headerType === 'cnc') {
            this.generateCNCDefaults();
        }
        return this;
    }

    generateLaserDefaults() {
        switch (this.mode) {
            case 'bw': {
                this.config = {
                    invertGreyscale: false,
                    bwThreshold: 168,
                    density: DEFAULT_FILL_DENSITY,
                    direction: 'Horizontal'
                };
                break;
            }
            case 'greyscale': {
                this.config = {
                    invertGreyscale: false,
                    contrast: 50,
                    brightness: 50,
                    whiteClip: 255,
                    bwThreshold: 168,
                    algorithm: 'FloydSteinburg',
                    movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
                    density: DEFAULT_FILL_DENSITY
                };
                break;
            }
            case 'vector': {
                switch (this.sourceType) {
                    case 'raster': {
                        this.config = {
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
                        this.config = {
                            optimizePath: false,
                            fillEnabled: DEFAULT_FILL_ENABLED,
                            fillDensity: DEFAULT_FILL_DENSITY
                        };
                        break;
                    }
                    case 'text': {
                        this.config = { ...DEFAULT_TEXT_CONFIG };
                        break;
                    }
                    default:
                        break;
                }
                break;
            }
            case 'trace': {
                this.config = {
                    optimizePath: false,
                    fillEnabled: DEFAULT_FILL_ENABLED,
                    fillDensity: DEFAULT_FILL_DENSITY
                };
                break;
            }
            default:
                break;
        }

        if (this.mode === 'greyscale') {
            this.gcodeConfig = {
                // Default movement mode is greyscale-line
                // greyscale-line: workSpeed: 500, dwellTime: null
                // greyscale-dot: workSpeed: null, dwellTime: 42
                jogSpeed: 1500,
                workSpeed: 500,
                plungeSpeed: ABSENT_VALUE,
                dwellTime: ABSENT_VALUE,
                fixedPowerEnabled: false,
                fixedPower: 100,
                multiPassEnabled: false,
                multiPasses: 2,
                multiPassDepth: 1
            };
        } else {
            this.gcodeConfig = {
                jogSpeed: 1500,
                workSpeed: 220,
                plungeSpeed: ABSENT_VALUE,
                dwellTime: ABSENT_VALUE,
                fixedPowerEnabled: false,
                fixedPower: 100,
                multiPassEnabled: false,
                multiPasses: 2,
                multiPassDepth: 1
            };
        }
    }

    generateCNCDefaults() {
        switch (this.mode) {
            case 'greyscale':
                this.config = {
                    toolDiameter: 3.175, // tool diameter (in mm)
                    toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                    targetDepth: 1.0,
                    stepDown: 0.2,
                    safetyHeight: 0.2,
                    stopHeight: 10,
                    isInvert: true,
                    density: 5
                };
                break;
            case 'vector':
                this.config = {
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
                    anchor: 'Center',
                    ...DEFAULT_TEXT_CONFIG
                };
                break;
            case 'trace':
                this.config = {
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

        this.gcodeConfig = {
            jogSpeed: 800,
            workSpeed: 300,
            plungeSpeed: 500,
            dwellTime: ABSENT_VALUE
        };
    }

    updateTransformation(transformation) {
        if (transformation) {
            let { width, height } = transformation;
            if (width || height) {
                width = width || height * this.sourceWidth / this.sourceHeight;
                height = height || width * this.sourceHeight / this.sourceWidth;
                this.transformation = {
                    ...this.transformation,
                    ...transformation,
                    width,
                    height
                };
            } else {
                this.transformation = {
                    ...this.transformation,
                    ...transformation
                };
            }
        }
        return this;
    }

    updateConfig(config) {
        if (config) {
            this.config = {
                ...this.config,
                ...config
            };
        }
        return this;
    }

    updateGcodeConfig(gcodeConfig) {
        if (gcodeConfig) {
            this.gcodeConfig = {
                ...this.gcodeConfig,
                ...gcodeConfig
            };
        }
        return this;
    }
}


export {
    ModelInfo,
    DEFAULT_TEXT_CONFIG
};
