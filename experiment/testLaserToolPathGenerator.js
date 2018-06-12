import path from 'path';
import fs from 'fs';
import { LaserToolPathGenerator } from '../src/app/lib/ToolPathGenerator/index';

const filePath = path.resolve('./src/web/images/snap-logo-square-256x256.png.svg');

const options = {
    type: 'laser',

    imageSrc: filePath,

    mode: 'svg',
    workSpeed: 288,
    jogSpeed: 1500,
    originWidth: 256,
    originHeight: 256,
    sizeWidth: 90,
    sizeHeight: 90,
    alignment: 'none',
    optimizePath: false,

    /*
    mode: 'bw',
    density: 10,
    direction: 'Horizontal',
    workSpeed: 1500,
    jogSpeed: 288,
    alignment: 'none',
    */

    /*
    mode: 'greyscale',
    dwellTime: 42,
    density: 10,
    workSpeed: 288,
    alignment: 'center',
    */

    _: ''
};

const p = new Promise(resolve => {
    const generator = new LaserToolPathGenerator(options);

    generator
        .generateGcode()
        .then((gcode) => {
            const lines = gcode.split('\n').length;
            console.log(lines);
            console.log(lines === 13540);

            fs.writeFile('./output.gcode', gcode, () => {
                console.log('write complete.');
                resolve();
            });
        })
        .catch((err) => console.error(err));
});

p.then(() => console.log('done'));
