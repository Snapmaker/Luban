import Jimp from 'jimp';
import fs from 'fs';

const rRatio = 0.25;
const gRatio = 0.25;
const bRatio = 0.25;
const aRatio = 0.25;
const d = 0.1; // every pixel -> 0.1mm
const stockDepth = 3; // total Z length -> 5mm.  z / 255 * 5;
const stepDownDepth = 0.5;
const k = Math.tan(30 / 2 * Math.PI / 180); // tool Slope
const safetyHeight = 3;
const stopHeight = 10;
const workSpeed = 200;
const plungeSpeed = 100;
const exitSpeed = 500;

// let filename = './experiment/avatar.jpg';
// let filename = './experiment/dragon.bmp';
// let filename = './experiment/dragon-death.jpeg';
let filename = './experiment/realimg.jpg';

Jimp.read(filename).then(img => {
    console.log(img);
    let width = img.bitmap.width;
    let height = img.bitmap.height;
    let data = [];
    for (let i = 0; i < width; ++i) {
        // data.push(new Int32Array(height));
        let tmp = [];
        for (let j = 0; j < height; ++j) {
            tmp.push(0);
        }
        data.push(tmp);
    }
    for (let i = 0; i < width; ++i) {
        for (let j = 0; j < height; ++j) {
            let idx = j * width * 4 + i * 4;
            data[i][j] = img.bitmap.data[idx] * rRatio + img.bitmap.data[idx + 1] * gRatio + img.bitmap.data[idx + 2] * bRatio + img.bitmap.data[idx + 3] * aRatio;
        }
    }


    function calc(z) {
        return (z / 255 * stockDepth - d / k) * 255 / stockDepth;
    }

    function upSmooth(data) {
        let updated = false;
        for (let i = 0; i < width; ++i) {
            for (let j = 0; j < height; ++j) {
                if (i > 0 && data[i][j] < calc(data[i - 1][j])) {
                    updated = true;
                    data[i][j] = calc(data[i - 1][j]);
                }
                if (i + 1 < width && data[i][j] < calc(data[i + 1][j])) {
                    updated = true;
                    data[i][j] = calc(data[i + 1][j]);
                }
                if (j > 0 && data[i][j] < calc(data[i][j - 1])) {
                    updated = true;
                    data[i][j] = calc(data[i][j - 1]);
                }
                if (j + 1 < height && data[i][j] < calc(data[i][j + 1])) {
                    updated = true;
                    data[i][j] = calc(data[i][j + 1]);
                }
            }
        }
        return updated;
    }
    let smooth = false;
    let cnt = 0;
    while (!smooth) {
        smooth = !upSmooth(data);
        console.log(`Smoothing : ${++cnt}`);
    }
    // fs.writeFileSync('./experiment/output.json', JSON.stringify(data, '\t', null));
    fs.writeFileSync('./output/web/images/_cache/output.json', JSON.stringify(data, '\t', null));

    function genGCode(data) {
        let cutDown = true;
        let curDepth = -stepDownDepth;
        let gcode = [];
        gcode.push('M3');
        gcode.push(`G0 X0 Y${height * d} Z${safetyHeight}`);
        let curZ = 0;


        while (cutDown) {
            cutDown = false;
            for (let i = 0; i < width; ++i) {
                for (let j = 0; j < height; ++j) {
                    let z = -data[i][j] / 255 * stockDepth;
                    // console.log(z);
                    let x = i * d;
                    let y = (height - j) * d;
                    if (z > curZ) {
                        gcode.push(`G0 Z${z} F${workSpeed}\n`);
                        curZ = z;
                        if (z < curDepth + stepDownDepth) {
                            gcode.push(`G1 X${x} Y${y} F${workSpeed}`);
                            cutDown = true;
                            // console.log(`X${x} Y${y} Z${z} curDepth: ${curDepth}`);
                        } else {
                            gcode.push(`G0 X${x} Y${y} F${workSpeed}`);
                        }
                    } else {
                        if (z < curDepth + stepDownDepth) {
                            z = Math.max(curDepth, z);
                            curZ = z;
                            gcode.push(`G1 X${x} Y${y} Z${z} F${plungeSpeed}`);
                            // console.log(`X${x} Y${y} Z${z} curDepth: ${curDepth}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${x} Y${y} F${workSpeed}`);
                        }
                    }
                }
                gcode.push(`G0 Z${safetyHeight} F${exitSpeed}`); // back to safety distance.
                gcode.push(`G0 X${i * d} Y${height * d} F${exitSpeed}`);
                curZ = 3;
            }
            gcode.push(`G0 Z${safetyHeight} F${exitSpeed}`); // back to safety distance.
            gcode.push(`G0 X0 Y${height * d} F${exitSpeed}`);
            curZ = 3;
            curDepth -= stepDownDepth;
            // console.log(curDepth);
        }
        gcode.push(`G0 Z${stopHeight} F${exitSpeed}`);
        gcode.push('M5');
        console.log(gcode.length);
        fs.writeFileSync('./experiment/relief.gcode', gcode.join('\n'));
    }
    genGCode(data);
});
