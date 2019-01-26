const MAX_SIZE = 40;

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 10;

const LASER_CONFIG_DEFAULT_TEXT_VECTOR = {
    optimizePath: false,
    fillEnabled: DEFAULT_FILL_ENABLED,
    fillDensity: DEFAULT_FILL_DENSITY,
    text: 'Snapmaker',
    size: 24,
    font: 'Georgia',
    lineHeight: 1.5,
    alignment: 'left' // left, middle, right
};

const LASER_DEFAULT_GCODE_CONFIG_RASTER_GREYSCALE = {
    jogSpeed: 1500,
    workSpeed: 500,
    dwellTime: 42,
    fixedPowerEnabled: false,
    fixedPower: 100,
    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

const LASER_DEFAULT_GCODE_CONFIG = {
    jogSpeed: 1500,
    workSpeed: 220,
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

const generateModelInfo = (type, modelType, processMode, origin) => {
    if (type === 'laser') {
        return generateModelInfoLaser(modelType, processMode, origin);
    } else if (type === 'cnc') {
        return generateModelInfoCnc(modelType, processMode, origin);
    }
    return null;
};

const generateModelInfoLaser = (modelType, processMode, origin) => {
    if (!['raster', 'svg', 'text'].includes(modelType)) {
        return null;
    }
    if (!['bw', 'greyscale', 'vector'].includes(processMode)) {
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
    // for text-vector, extra prop: canResize = false
    if (combinedMode === 'text-vector') {
        transformation.canResize = false;
    }

    // config
    let config = null;
    switch (combinedMode) {
        case 'raster-bw':
            config = {
                bwThreshold: 168,
                density: 10,
                direction: 'Horizontal'
            };
            break;
        case 'raster-greyscale':
            config = {
                contrast: 50,
                brightness: 50,
                whiteClip: 255,
                bwThreshold: 168,
                algorithm: 'FloyedSteinburg',
                movementMode: 'greyscale-line', // greyscale-line, greyscale-dot
                density: 10
            };
            break;
        case 'raster-vector':
            config = {
                optimizePath: true,
                fillEnabled: DEFAULT_FILL_ENABLED,
                fillDensity: DEFAULT_FILL_DENSITY,
                vectorThreshold: 128,
                isInvert: false,
                turdSize: 2
            };
            break;
        case 'svg-vector':
            config = {
                optimizePath: false,
                fillEnabled: DEFAULT_FILL_ENABLED,
                fillDensity: DEFAULT_FILL_DENSITY
            };
            break;
        case 'text-vector':
            config = { ...LASER_CONFIG_DEFAULT_TEXT_VECTOR };
            break;
        default:
            break;
    }

    // gcodeConfig
    let gcodeConfig = { ...LASER_DEFAULT_GCODE_CONFIG };
    if (processMode === 'greyscale') {
        gcodeConfig = { ...LASER_DEFAULT_GCODE_CONFIG_RASTER_GREYSCALE };
    }

    const modelInfo = {
        type: 'laser',
        modelType: modelType,
        processMode: processMode,
        printOrder: 1,
        origin: origin,
        transformation: transformation,
        config: config,
        gcodeConfig: gcodeConfig,
        gcodeConfigPlaceholder: { ...GCODE_CONFIG_PLACEHOLDER }
    };

    return modelInfo;
};

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

    const modelInfo = {
        type: 'cnc',
        modelType: modelType,
        processMode: processMode,
        origin: origin,
        transformation: transformation,
        config: config,
        gcodeConfig: gcodeConfig,
        gcodeConfigPlaceholder: { ...GCODE_CONFIG_PLACEHOLDER }
    };

    return modelInfo;
};

export { generateModelInfo, LASER_CONFIG_DEFAULT_TEXT_VECTOR };
