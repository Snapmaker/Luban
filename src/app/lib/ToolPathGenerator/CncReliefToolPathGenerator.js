import Jimp from 'jimp';
import EventEmitter from 'events';
import GcodeParser from './GcodeParser';
import { Normalizer } from './Normalizer';

export default class CncReliefToolPathGenerator extends EventEmitter {
    constructor(modelInfo, modelPath) {
        super();
        const { config, transformation, gcodeConfigPlaceholder } = modelInfo;
        const { jogSpeed, workSpeed, plungeSpeed } = gcodeConfigPlaceholder;
        // todo: toolDiameter, toolAngle
        const { toolAngle, targetDepth, stepDown, safetyHeight, stopHeight, isInvert, density } = config;

        this.modelInfo = modelInfo;
        this.jogSpeed = jogSpeed;
        this.workSpeed = workSpeed;
        this.plungeSpeed = plungeSpeed;

        this.targetDepth = targetDepth;
        this.stepDown = stepDown;
        this.safetyHeight = safetyHeight;
        this.stopHeight = stopHeight;

        const maxDensity = Math.min(10, Math.floor(Math.sqrt(200000 / transformation.width / transformation.height)));
        this.density = Math.min(density, maxDensity);

        this.targetWidth = Math.round(transformation.width * this.density);
        this.targetHeight = Math.round(transformation.height * this.density);
        this.rotation = transformation.rotation;
        this.flip = transformation.flip;
        this.isInvert = isInvert;

        this.modelPath = modelPath;
        this.toolSlope = Math.tan(toolAngle / 2 * Math.PI / 180);
    }

    generateToolPathObj() {
        let data = null;
        return Jimp
            .read(this.modelPath)
            .then(img => {
                if (this.isInvert) {
                    img.invert();
                }

                const { width, height } = img.bitmap;

                img
                    .greyscale()
                    .flip(!!(Math.floor(this.flip / 2)), !!(this.flip % 2))
                    .rotate(-this.rotation * 180 / Math.PI)
                    .background(0xffffffff);

                // targetWidth&targetHeight will be changed after rotated
                this.targetWidth = Math.round(this.targetWidth * img.bitmap.width / width);
                this.targetHeight = Math.round(this.targetHeight * img.bitmap.height / height);

                data = [];
                for (let i = 0; i < this.targetWidth; i++) {
                    data[i] = [];
                    for (let j = 0; j < this.targetHeight; j++) {
                        const x = Math.floor(i / this.targetWidth * img.bitmap.width);
                        const y = Math.floor(j / this.targetHeight * img.bitmap.height);
                        const idx = y * img.bitmap.width * 4 + x * 4;
                        data[i][j] = img.bitmap.data[idx];
                    }
                }

                // image scan finished, do your stuff
                let smooth = false;
                while (!smooth) {
                    smooth = !this.upSmooth(data);
                }
                const fakeGcode = this.genGCode(data);
                return new GcodeParser().parseGcodeToToolPathObj(fakeGcode, this.modelInfo);
            });
    }

    calc(color) {
        return (color / 255 * this.targetDepth - 1 / this.density / this.toolSlope) * 255 / this.targetDepth;
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
            this.targetWidth,
            0,
            this.targetHeight,
            { x: 1 / this.density, y: 1 / this.density }
        );

        gcode.push('M3');
        gcode.push(`G0 X${normalizer.x(0)} Y${normalizer.y(this.targetHeight)} Z${this.safetyHeight}`);
        let progress = 0;
        let cutDownTimes = 0;
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        while (cutDown) {
            cutDown = false;
            for (let i = 0; i < this.targetWidth; ++i) {
                const matX = i;
                for (let j = 0; j < this.targetHeight; ++j) {
                    const matY = (this.targetHeight - j);
                    let z = -data[i][j] / 255 * this.targetDepth;
                    if (z > curZ) {
                        gcode.push(`G0 Z${z} F${this.workSpeed}\n`);
                        curZ = z;
                        if (z < curDepth + this.stepDown) {
                            gcode.push(`G1 X${normalizer.x(matX)} Y${normalizer.y(matY)} F${this.workSpeed}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${normalizer.x(matX)} Y${normalizer.y(matY)} F${this.workSpeed}`);
                        }
                    } else {
                        if (z < curDepth + this.stepDown) {
                            z = Math.max(curDepth, z);
                            curZ = z;
                            gcode.push(`G1 X${normalizer.x(matX)} Y${normalizer.y(matY)} Z${z} F${this.plungeSpeed}`);
                            // console.log(`X${x} Y${y} Z${z} curDepth: ${curDepth}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${normalizer.x(matX)} Y${normalizer.y(matY)} F${this.workSpeed}`);
                        }
                    }
                }
                gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
                gcode.push(`G0 X${normalizer.x(matX)} Y${normalizer.y(this.targetHeight)} F${this.jogSpeed}`);
                curZ = 3;
                const p = i / (this.targetWidth - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('taskProgress', progress);
                }
            }
            gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
            gcode.push(`G0 X${normalizer.x(0)} Y${normalizer.y(this.targetHeight)} F${this.jogSpeed}`);
            curZ = 3;
            curDepth -= this.stepDown;
            cutDownTimes += 1;
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
