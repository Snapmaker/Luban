// testCncToolPathGenerator.js
//
// add this script to package.json
// "exp": "babel-node experiment/testCncToolPathGenerator.js",

import fs from 'fs';
import path from 'path';
import { LaserToolPathGenerator } from '../src/app/lib/ToolPathGenerator';

const filePath = path.resolve('./src/web/images/snap-logo-square-256x256.png.svg');

const options = {
    mode: 'vector',
    source: {
        image: filePath,
        processed: filePath,
        width: 256,
        height: 256
    },
    target: {
        anchor: 'Bottom Left',
        width: 120,
        height: 120,
        jogSpeed: 900,
        workSpeed: 288
    },
    vectorMode: {
        subMode: 'svg',
        vectorThreshold: 128,
        isInvert: false,
        turdSize: 2,
        optimizePath: true
    }
};


// const processedPath = `./src/web/image/_cache/${filename}`;
// const processedPath = path.resolve(`../web/images/_cache/${filename}`);

options.source.processed = filePath;

const generator = new LaserToolPathGenerator(options);

generator
    .generateGcode()
    .then((gcode) => {
        const outputPath = './test.cnc';
        fs.writeFile(outputPath, gcode, () => {
            console.log('DONE.');
        });
    });
