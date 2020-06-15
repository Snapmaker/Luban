
const LevelingGcode = require('./LevelingGcode').default;

const cb = (func) => (data) => console.log(func, data);
const worker = new LevelingGcode();
const zValues = [30, -50, 50, -30, 50, -30, 50, -30, 50];
const rect = { startx: -50, starty: -40, endx: 60, endy: 40 };
const gridNum = 3;
const sourceFile = `${__dirname}/testfile.cnc`;
worker.startTask({
    data: {
        rect, zValues, gridNum, sourceFile
    },
    onComplete: cb('complete'),
    onProgress: cb('progress')
});
