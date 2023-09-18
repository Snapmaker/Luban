import { isNil, lt } from 'lodash';

export const UniformToolpathConfig = (config) => {
    const version = config?.version;
    // const machineInfo = config?.machineInfo;

    if (isNil(version) || lt(version, '4.0.0')) {
        config.toolpaths = [];
    }

    if (isNil(version) || lt(version, '4.1.0')) {
        config.toolpaths.map((toolPath) => {
            if (!toolPath.toolParams) {
                toolPath.toolParams = {};
            }
            if (!toolPath.toolParams.definitionName) {
                toolPath.toolParams.definitionName = 'CUT';
            }

            if (!toolPath.gcodeConfig.pathType) {
                toolPath.gcodeConfig.pathType = toolPath.gcodeConfig.fillEnabled ? 'fill' : 'path';
            }
            return toolPath;
        });
    }

    if (isNil(version) || lt(version, '4.9.0')) {
        config.toolpaths.map((toolPath) => {
            if (!toolPath.gcodeConfig.auxiliaryAirPump) {
                toolPath.gcodeConfig.auxiliaryAirPump = false;
            }
            if (!toolPath.gcodeConfig.halfDiodeMode) {
                toolPath.gcodeConfig.halfDiodeMode = false;
            }
            if (!toolPath.gcodeConfig.constantPowerMode) {
                toolPath.gcodeConfig.constantPowerMode = true;
            }
            if (!toolPath.gcodeConfig.initialHeightOffset) {
                toolPath.gcodeConfig.initialHeightOffset = 0;
            }
            return toolPath;
        });
    }
};
