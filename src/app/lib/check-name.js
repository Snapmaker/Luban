import { isNil, lt } from 'lodash';

const checkIsSnapmakerProjectFile = (file) => {
    const [, tail] = file.split('.');
    if (!tail) {
        return false;
    }
    return tail.substring(0, 4).toLowerCase() === 'snap';
};

const checkIsGCodeFile = (file) => {
    let [, tail] = file.split('.');
    if (!tail) {
        return false;
    }
    tail = tail.toLowerCase();
    return tail === 'gcode' || tail === 'nc' || tail === 'cnc';
};
const checkObjectIsEqual = (objOld, objNew) => {
    if (isNil(objOld) && !isNil(objNew)) {
        return false;
    }
    if (isNil(objOld?.version) || lt(objOld?.version, '4.1.0')) {
        return Object.entries(objOld).every(([key, value]) => {
            if (key === 'version' || key === 'isRecommended') {
                return true;
            } else if (!isNil(objNew) && !isNil(objNew[key]) && !isNil(value)) {
                if (key === 'models') {
                    if (value?.length !== objNew.models?.length) {
                        return false;
                    }
                    return value.every((oldModel, index) => {
                        const newModel = objNew.models[index];
                        return Object.entries(oldModel).every(([modelKey, modelValue]) => {
                            if (modelKey === 'processImageName' || modelKey === 'uploadName' || modelKey === 'visible') {
                                return true;
                            } else {
                                return JSON.stringify(newModel[modelKey]) === JSON.stringify(modelValue);
                            }
                        });
                    });
                } else if (key === 'machineInfo') {
                    const newInfo = objNew.machineInfo;
                    return Object.entries(value).every(([infoKey, infoValue]) => {
                        if (infoKey === 'headType') {
                            return infoValue === '3dp' ? newInfo[infoKey] === 'printing' : infoValue === newInfo[infoKey];
                        } else {
                            return JSON.stringify(newInfo[infoKey]) === JSON.stringify(infoValue);
                        }
                    });
                } else {
                    return JSON.stringify(objNew[key]) === JSON.stringify(value);
                }
            } else {
                return false;
            }
        });
    } else {
        return Object.entries(objOld).every(([key, value]) => {
            if (key === 'version') {
                return true;
            } else if (!isNil(objNew) && !isNil(objNew[key]) && !isNil(value)) {
                if (key === 'models') {
                    if (value?.length !== objNew[key]?.length) {
                        return false;
                    }
                    return value.every((oldModel, index) => {
                        const newModel = objNew[key][index];
                        return Object.entries(oldModel).every(([modelKey, modelValue]) => {
                            if (modelKey === 'processImageName' || modelKey === 'uploadName') {
                                return true;
                            } else {
                                return JSON.stringify(newModel[modelKey]) === JSON.stringify(modelValue);
                            }
                        });
                    });
                } else if (key === 'toolpaths') {
                    if (value?.length !== objNew[key]?.length) {
                        return false;
                    }
                    return value.every((oldModel, index) => {
                        const newModel = objNew[key][index];
                        return Object.entries(oldModel).every(([modelKey, modelValue]) => {
                            if (modelKey === 'status' || modelKey === 'toolPathFiles') {
                                return true;
                            } else {
                                return JSON.stringify(newModel[modelKey]) === JSON.stringify(modelValue);
                            }
                        });
                    });
                } else {
                    return JSON.stringify(objNew[key]) === JSON.stringify(value);
                }
            } else {
                return false;
            }
        });
    }
};

export {
    checkIsSnapmakerProjectFile,
    checkIsGCodeFile,
    checkObjectIsEqual
};
