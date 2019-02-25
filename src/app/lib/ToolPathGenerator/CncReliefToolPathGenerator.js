import Jimp from 'jimp';
import GcodeParser from './GcodeParser';
import { Normalizer } from './Normalizer';

// const pixel2mm = 0.1; // every pixel -> 0.1mm
const pixel2mm = 0.1 * 5; // for faster
export default class CncReliefToolPathGenerator {
    constructor(modelInfo, modelPath) {
        const { config, transformation, gcodeConfigPlaceholder } = modelInfo;
        const { jogSpeed, workSpeed, plungeSpeed } = gcodeConfigPlaceholder;
        // todo: toolDiameter, toolAngle
        const { toolAngle, targetDepth, stepDown, safetyHeight, stopHeight, isInvert } = config;

        this.modelInfo = modelInfo;
        this.jogSpeed = jogSpeed;
        this.workSpeed = workSpeed;
        this.plungeSpeed = plungeSpeed;

        this.targetDepth = targetDepth;
        this.stepDown = stepDown;
        this.safetyHeight = safetyHeight;
        this.stopHeight = stopHeight;

        this.targetWidth = transformation.width / pixel2mm;
        this.targetHeight = transformation.height / pixel2mm;
        this.rotation = transformation.rotation;
        this.isInvert = isInvert;

        this.modelPath = modelPath;
        this.toolSlope = Math.tan(toolAngle / 2 * Math.PI / 180);
    }

    generateToolPathObj() {
        let data = null;
        return Jimp
            .read(this.modelPath)
            .then(img => new Promise(resolve => {
                img
                    .greyscale()
                    .resize(this.targetWidth, this.targetHeight)
                    .background(0xffffffff)
                    .rotate(-this.rotation * 180 / Math.PI) // rotate: unit is degree and clockwise
                    .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                        if (x === 0 && y === 0) {
                            // targetWidth&targetHeight will be changed after rotated
                            this.targetWidth = img.bitmap.width;
                            this.targetHeight = img.bitmap.height;
                            data = this.getDoubleDimensionalArr(this.targetWidth, this.targetHeight);
                        }
                        if (this.isInvert) {
                            data[x][y] = 256 - img.bitmap.data[idx];
                        } else {
                            data[x][y] = img.bitmap.data[idx];
                        }

                        if (x === img.bitmap.width - 1 && y === img.bitmap.height - 1) {
                            // image scan finished, do your stuff
                            let smooth = false;
                            // let cnt = 0;
                            while (!smooth) {
                                smooth = !this.upSmooth(data);
                                // console.log(`Smoothing : ${++cnt}`);
                            }
                            const fakeGcode = this.genGCode(data);
                            const toolPathObject = new GcodeParser().parseGcodeToToolPathObj(fakeGcode, this.modelInfo);
                            resolve(toolPathObject);
                        }
                    });
            }));
    }

    calc(z) {
        return (z / 255 * this.targetDepth - pixel2mm / this.toolSlope) * 255 / this.targetDepth;
    }

    getDoubleDimensionalArr(width, height) {
        const arr = [];
        for (let i = 0; i < width; i++) {
            arr[i] = [];
            for (let j = 0; j < height; j++) {
                arr[i][j] = 0;
            }
        }
        return arr;
    }

    // data: double dimensional array
    upSmooth = (data) => {
        const width = data.length;
        const height = data[0].length;
        let updated = false;
        for (let i = 0; i < width; ++i) {
            for (let j = 0; j < height; ++j) {
                if (i > 0 && data[i][j] < this.calc(data[i - 1][j])) {
                    updated = true;
                    data[i][j] = this.calc(data[i - 1][j]);
                }
                if (i + 1 < width && data[i][j] < this.calc(data[i + 1][j])) {
                    updated = true;
                    data[i][j] = this.calc(data[i + 1][j]);
                }
                if (j > 0 && data[i][j] < this.calc(data[i][j - 1])) {
                    updated = true;
                    data[i][j] = this.calc(data[i][j - 1]);
                }
                if (j + 1 < height && data[i][j] < this.calc(data[i][j + 1])) {
                    updated = true;
                    data[i][j] = this.calc(data[i][j + 1]);
                }
            }
        }
        return updated;
    };

    genGCode = (data) => {
        let cutDown = true;
        let curDepth = -this.stepDown;
        let gcode = [];
        let curZ = 0;

        const normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth * pixel2mm,
            0,
            this.targetHeight * pixel2mm,
            { x: 1, y: 1 }
        );

        gcode.push('M3');
        gcode.push(`G0 X${normalizer.x(0)} Y${normalizer.y(this.targetHeight * pixel2mm)} Z${this.safetyHeight}`);

        while (cutDown) {
            cutDown = false;
            for (let i = 0; i < this.targetWidth; ++i) {
                for (let j = 0; j < this.targetHeight; ++j) {
                    let z = -data[i][j] / 255 * this.targetDepth;
                    // console.log(z);
                    let x = i * pixel2mm;
                    let y = (this.targetHeight - j) * pixel2mm;
                    if (z > curZ) {
                        gcode.push(`G0 Z${z} F${this.workSpeed}\n`);
                        curZ = z;
                        if (z < curDepth + this.stepDown) {
                            gcode.push(`G1 X${normalizer.x(x)} Y${normalizer.y(y)} F${this.workSpeed}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${normalizer.x(x)} Y${normalizer.y(y)} F${this.workSpeed}`);
                        }
                    } else {
                        if (z < curDepth + this.stepDown) {
                            z = Math.max(curDepth, z);
                            curZ = z;
                            gcode.push(`G1 X${normalizer.x(x)} Y${normalizer.y(y)} Z${z} F${this.plungeSpeed}`);
                            // console.log(`X${x} Y${y} Z${z} curDepth: ${curDepth}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${normalizer.x(x)} Y${normalizer.y(y)} F${this.workSpeed}`);
                        }
                    }
                }
                gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
                gcode.push(`G0 X${normalizer.x(i * pixel2mm)} Y${normalizer.y(this.targetHeight * pixel2mm)} F${this.jogSpeed}`);
                curZ = 3;
            }
            gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
            gcode.push(`G0 X${normalizer.x(0)} Y${normalizer.y(this.targetHeight * pixel2mm)} F${this.jogSpeed}`);
            curZ = 3;
            curDepth -= this.stepDown;
            // console.log(curDepth);
        }
        gcode.push(`G0 Z${this.stopHeight} F${this.jogSpeed}`);
        gcode.push('M5');
        return gcode.join('\n');
    };
}

// let modelPath = './experiment/avatar.jpg';
// let modelPath = './experiment/avatar.jpg';
// let modelPath = './experiment/dragon.bmp';
// let modelPath = './experiment/dragon-death.jpeg';
// let modelPath = './experiment/dragon.bmp';
// const modelInfo = {
//     config: {
//         toolAngle: 30,
//         targetDepth: 4,
//         stepDown: 2,
//         safetyHeight: 3,
//         stopHeight: 10,
//         isInvert: false
//     },
//     transformation: {
//         width: 20,
//         height: 20
//     },
//     gcodeConfigPlaceholder: {
//         jogSpeed: 800,
//         workSpeed: 300,
//         plungeSpeed: 500
//     }
// };

// const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
// generator.generateToolPathObj().then(toolPathObj => {
//     const toolPathStr = JSON.stringify(toolPathObj);
//     console.log('toolPathStr -> ' + toolPathStr);
// });

