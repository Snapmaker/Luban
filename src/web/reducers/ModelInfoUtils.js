const MAX_SIZE = 125;

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 10;

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

// Default G-code config
const DEFAULT_GCODE_CONFIG = {
    jogSpeed: 1500,
    workSpeed: 220,
    dwellTime: 0, // no dwell
    fixedPowerEnabled: false,
    fixedPower: 100,
    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

// Default G-code config for greyscale mode (line movement)
const DEFAULT_GCODE_CONFIG_GREYSCALE = {
    jogSpeed: 1500,
    workSpeed: 500,
    dwellTime: 42,
    fixedPowerEnabled: false,
    fixedPower: 100,
    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

const GCODE_CONFIG_PLACEHOLDER = {
    jogSpeed: 'jogSpeed',
    workSpeed: 'workSpeed',
    dwellTime: 'dwellTime',
    plungeSpeed: 'plungeSpeed'
};

const CNC_DEFAULT_GCODE_CONFIG = {
    jogSpeed: 800,
    workSpeed: 300,
    plungeSpeed: 500,
};


class ModelInfo {
    type = null;
    source = null;
    transformation = null;
    mode = null;
    movementMode = 'line';
    config = null;
    gcodeConfig = null;
    printOrder = 1;
    gcodeConfigPlaceholder = GCODE_CONFIG_PLACEHOLDER;

    setType(type) {
        if (type !== 'laser' && type !== 'cnc') {
            return;
        }
        this.type = type;
    }

    get modelType() {
        return this.source.type;
    }

    setSource(type, name, filename, width, height) {
        if (!['raster', 'svg', 'text'].includes(type)) {
            return;
        }

        this.source = {
            type, name, filename, width, height
        };

        const ratio = width / height;
        if (width >= height && width > MAX_SIZE) {
            width = MAX_SIZE;
            height = MAX_SIZE / ratio;
        }
        if (height >= width && height > MAX_SIZE) {
            width = MAX_SIZE * ratio;
            height = MAX_SIZE;
        }

        this.transformation = {
            width: width,
            height: height,
            translateX: 0,
            translateY: 0,
            rotation: 0,
            canResize: (type !== 'text')
        };
    }

    setMode(mode) {
        if (!this.source) {
            throw new Error('Call setSource before setProcessMode.');
        }

        if (!['bw', 'greyscale', 'vector'].includes(mode)) {
            return;
        }

        this.mode = mode;
    }

    generateDefaults() {
        if (this.type === 'laser') {
            this.generateLaserDefaults();
        } else if (this.type === 'cnc') {
            this.generateCNCDefaults();
        }
    }

    generateLaserDefaults() {
        switch (this.mode) {
            case 'bw': {
                this.config = {
                    bwThreshold: 168,
                    density: 10,
                    direction: 'Horizontal'
                };
                break;
            }
            case 'greyscale': {
                this.config = {
                    contrast: 50,
                    brightness: 50,
                    whiteClip: 255,
                    bwThreshold: 168,
                    algorithm: 'FloyedSteinburg',
                    movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
                    density: 10
                };
                break;
            }
            case 'vector': {
                switch (this.source.type) {
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
            default:
                break;
        }

        if (this.mode === 'greyscale') {
            this.gcodeConfig = { ...DEFAULT_GCODE_CONFIG_GREYSCALE };
        } else {
            this.gcodeConfig = { ...DEFAULT_GCODE_CONFIG };
        }
    }

    generateCNCDefaults() {
        switch (this.mode) {
            case 'greyscale':
                this.config = {
                    toolDiameter: 3.175, // tool diameter (in mm)
                    toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                    targetDepth: 2.2,
                    stepDown: 0.8,
                    safetyHeight: 3,
                    stopHeight: 10,
                    isInvert: true
                };
                break;
            case 'vector':
                this.config = {
                    toolDiameter: 3.175, // tool diameter (in mm)
                    toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                    pathType: 'path',
                    targetDepth: 2.2,
                    stepDown: 0.8,
                    safetyHeight: 3,
                    stopHeight: 10,
                    clip: true,
                    enableTab: false,
                    tabWidth: 2,
                    tabHeight: -1,
                    tabSpace: 24,
                    anchor: 'Center'
                };
                break;
            default:
                break;
        }

        this.gcodeConfig = { ...CNC_DEFAULT_GCODE_CONFIG };
    }

    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }

    updateGcodeConfig(gcodeConfig) {
        this.gcodeConfig = {
            ...this.gcodeConfig,
            ...gcodeConfig
        };
    }
}

/*
const generateModelInfoCnc = (modelType, processMode, origin) => {
    if (!['raster', 'svg'].includes(modelType)) {
        return null;
    }
    if (!['greyscale', 'vector'].includes(processMode)) {
        return null;
    }

    const combinedMode = `${modelType}-${processMode}`;

    // transformation
    let { width, height } = origin;
    const ratio = width / height;
    if (width >= height && width > MAX_SIZE) {
        width = MAX_SIZE;
        height = MAX_SIZE / ratio;
    }
    if (height >= width && height > MAX_SIZE) {
        width = MAX_SIZE * ratio;
        height = MAX_SIZE;
    }
    const transformation = {
        rotation: 0,
        width: width,
        height: height,
        translateX: 0,
        translateY: 0
    };

    // config
    let config = null;
    switch (combinedMode) {
        case 'raster-greyscale':
            config = {
                toolDiameter: 3.175, // tool diameter (in mm)
                toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                targetDepth: 2.2,
                stepDown: 0.8,
                safetyHeight: 3,
                stopHeight: 10,
                isInvert: true
            };
            break;
        case 'svg-vector':
            config = {
                toolDiameter: 3.175, // tool diameter (in mm)
                toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
                pathType: 'path',
                targetDepth: 2.2,
                stepDown: 0.8,
                safetyHeight: 3,
                stopHeight: 10,
                clip: true,
                enableTab: false,
                tabWidth: 2,
                tabHeight: -1,
                tabSpace: 24,
                anchor: 'Center'
            };
            break;
        default:
            break;
    }

    // gcodeConfig
    let gcodeConfig = { ...CNC_DEFAULT_GCODE_CONFIG };

    return {
        type: 'cnc',
        modelType: modelType,
        processMode: processMode,
        origin: origin,
        transformation: transformation,
        config: config,
        gcodeConfig: gcodeConfig,
        gcodeConfigPlaceholder: { ...GCODE_CONFIG_PLACEHOLDER }
    };
};
*/

export {
    ModelInfo,
    DEFAULT_TEXT_CONFIG
};
