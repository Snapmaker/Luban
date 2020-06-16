// nodemon --exec babel-node src/server/tasks/test.js 
const LevelingGcode = require('./LevelingGcode').default;

process.chdir('D:\\code\\Luban\\output\\server');

const cb = (func) => (data) => console.log(func, data);
const worker = new LevelingGcode();
const zValues = [30, -50, 50, -30, 50, -30, 50, -30, 50];
const rect = { startx: -50, starty: -40, endx: 60, endy: 40 };
const gridNum = 3;
const sourceFile = `${__dirname}/testfile.cnc`;
worker.startTask({

    data: {
        rect: { startx: 0, starty: 0, endx: 49.55, endy: 53.147 },
        zValues: [
            7.248417555511587,
            7.327068455934224,
            5.627749150901437,
            1.4057730189092927,
            2.115116583084033,
            5.214567097139277,
            3.843085369504495,
            6.4891485630612955,
            7.111208496475774
        ],
        gridNum: 3,
        uploadName: 'part2_51005038.nc'
    },
    onComplete: cb('complete'),
    onProgress: cb('progress')
});
