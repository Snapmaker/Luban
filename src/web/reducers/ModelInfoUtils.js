const MAX_SIZE = 40;

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 10;

const CONFIG_DEFAULT_TEXT_VECTOR = {
    optimizePath: false,
    fillEnabled: DEFAULT_FILL_ENABLED,
    fillDensity: DEFAULT_FILL_DENSITY,
    text: 'Snapmaker',
    size: 24,
    font: 'Georgia',
    lineHeight: 1.5,
    alignment: 'left' // left, middle, right
};

const DEFAULT_GCODE_CONFIG_RASTER_GREYSCALE = {
    jogSpeed: 1500,
    dwellTime: 42,
    fixedPowerEnabled: false,
    fixedPower: 100,
    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

const DEFAULT_GCODE_CONFIG = {
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

const generateModelInfo = (modelType, processMode, origin) => {
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
                algorithm: 'FloyedSteinburg',
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
            config = { ...CONFIG_DEFAULT_TEXT_VECTOR };
            break;
        default:
            break;
    }

    // gcodeConfig
    let gcodeConfig = { ...DEFAULT_GCODE_CONFIG };
    if (processMode === 'greyscale') {
        gcodeConfig = { ...DEFAULT_GCODE_CONFIG_RASTER_GREYSCALE };
    }

    const modelInfo = {
        type: 'laser',
        modelType: modelType,
        processMode: processMode,
        printPriority: 1,
        origin: origin,
        transformation: transformation,
        config: config,
        gcodeConfig: gcodeConfig,
        gcodeConfigPlaceholder: { ...GCODE_CONFIG_PLACEHOLDER }
    };

    return modelInfo;
};

export { generateModelInfo, CONFIG_DEFAULT_TEXT_VECTOR };
