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

export {
    checkIsSnapmakerProjectFile,
    checkIsGCodeFile
};
