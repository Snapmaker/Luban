// from mm to in
const mm2in = (val = 0) => val / 25.4;

// from in to mm
const in2mm = (val = 0) => val * 25.4;

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
    mm2in,
    in2mm,

    checkIsSnapmakerProjectFile,
    checkIsGCodeFile
};
