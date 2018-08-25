// testCncToolPathGenerator.js
//
// add this script to package.json
// "exp": "babel-node experiment/testCncToolPathGenerator.js",

import fs from 'fs';
import path from 'path';
import imageProcess from '../src/app/lib/image-process';
import { LaserToolPathGenerator } from '../src/app/lib/ToolPathGenerator';

const filePath = path.resolve('./src/web/images/snap-logo-square-256x256.png');

const imageOptions = {
    mode: 'bw',
    image: filePath,
    width: 256,
    height: 256,
    bwThreshold: 128,
    density: 10
};

const options = {
    mode: 'bw',
    source: {
        image: filePath,
        processed: filePath,
        width: 256,
        height: 256
    },
    target: {
        anchor: 'Bottom Left',
        jogSpeed: 900,
        workSpeed: 288
    },
    bwMode: {
        direction: 'Horizontal',
        density: 10
    }
};

imageProcess(imageOptions)
    .then((res) => {
        const { filename } = res;

        // const processedPath = `./src/web/image/_cache/${filename}`;
        const processedPath = path.resolve(`../web/images/_cache/${filename}`);

        console.log(processedPath);

        options.source.processed = processedPath;

        const generator = new LaserToolPathGenerator(options);

        generator
            .generateGcode()
            .then((gcode) => {
                const outputPath = './test.cnc';
                fs.writeFile(outputPath, gcode, () => {
                    console.log('DONE.');
                });
            });
    })



