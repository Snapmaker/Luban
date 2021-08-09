import { isNil } from 'lodash';

export const UniformToolpathConfig = (config) => {
    const machineInfo = config?.machineInfo;
    const headType = machineInfo?.headType;
    console.log('UniformProjectConfig', machineInfo, headType);

    config.toolpaths.forEach((toolpathConfig) => {
        const gcodeConfig = toolpathConfig?.gcodeConfig;
        // console.log('config.gcodeConfig?.stepOver', gcodeConfig);
        if (headType === 'laser') {
            if (isNil(gcodeConfig.fillInterval) && !isNil(gcodeConfig.density)) {
                gcodeConfig.fillInterval = 1 / gcodeConfig.density;
            }
        } else if (headType === 'cnc') {
            if (isNil(gcodeConfig.stepOver) && !isNil(gcodeConfig.density)) {
                gcodeConfig.stepOver = 1 / gcodeConfig.density;
            }
        }
        console.log('fillDensity', toolpathConfig?.gcodeConfig);
    });
    config.models.forEach((model) => {
        if (model?.sourceType === 'dxf') {
            model.sourceType = 'svg';
            console.log('model.sourceType', model.sourceType);
        }
    });
    console.log('UniformProjectConfig models', config.models);
};
