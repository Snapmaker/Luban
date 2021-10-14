import { isNil } from 'lodash';

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
    return Object.entries(objOld).every(([key, value]) => {
        // fixed for verison
        if (key === 'processImageName' || key === 'version') {
            return true;
        } else if (!isNil(objNew) && !isNil(objNew[key]) && !isNil(value)) {
            return JSON.stringify(objNew[key]) === JSON.stringify(value);
        } else {
            return false;
        }
    });
};

export {
    checkIsSnapmakerProjectFile,
    checkIsGCodeFile,
    checkObjectIsEqual
};
