import { isNil } from 'lodash';

export const UniformToolpathConfig = (config) => {
    const machineInfo = config?.machineInfo;
    const headType = machineInfo?.headType;
    const toolPaths = config?.toolpaths;

    if (toolPaths) {
        const arrIndex = [];
        toolPaths.forEach((toolpathConfig, index) => {
            const gcodeConfig = toolpathConfig?.gcodeConfig;
            if (toolpathConfig?.name === 'dxf') {
                arrIndex.push(index);
            }
            if (headType === 'laser') {
                if (isNil(gcodeConfig.fillInterval) && !isNil(gcodeConfig.density)) {
                    gcodeConfig.fillInterval = 1 / gcodeConfig.density;
                }
                if (isNil(gcodeConfig.fillInterval) && !isNil(gcodeConfig.fillDensity)) {
                    gcodeConfig.fillInterval = 1 / gcodeConfig.fillDensity;
                }
                if (isNil(gcodeConfig.movementMode)) {
                    gcodeConfig.movementMode = 'greyscale-line';
                }
            } else if (headType === 'cnc') {
                if (isNil(gcodeConfig.stepOver) && !isNil(gcodeConfig.density)) {
                    gcodeConfig.stepOver = 1 / gcodeConfig.density;
                }
            }
        });
        arrIndex.forEach((idx) => {
            toolPaths.splice(idx, 1);
        });
    }
};
