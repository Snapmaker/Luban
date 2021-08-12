import { isNil, lt } from 'lodash';

export const UniformToolpathConfig = (config) => {
    const version = config?.version;
    // const machineInfo = config?.machineInfo;

    if (isNil(version) || lt(version, '4.0.0')) {
        config.toolpaths = [];
    }
};
