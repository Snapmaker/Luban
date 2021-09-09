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
            return toolPath;
        });
    }
};
