import Jimp from 'jimp';
import EventEmitter from 'events';
import GcodeParser from './GcodeParser';
import Normalizer from './Normalizer';

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

                let smooth = false;
                while (!smooth) {
                    smooth = !this.upSmooth(data);
                }
                const fakeGcode = this.genGCode(data);
                return new GcodeParser().parseGcodeToToolPathObj(fakeGcode, this.modelInfo);
            });
    }

    calc(grey) {
        // return (color / 255 * this.targetDepth - 1 / this.density / this.toolSlope) * 255 / this.targetDepth;
        return grey - 255 / (this.targetDepth * this.density * this.toolSlope);

    }

    upSmooth_backup = (data) => {
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

    upSmooth = (data) => {
        const width = data.length;
        const height = data[0].length;
        const depthOffsetRatio = this.targetDepth * this.density * this.toolSlope;
        let updated = false;
        for (let i = 1; i < width - 1; ++i) {
            for (let j = 1; j < height - 1; ++j) {
                // let allowedDepth = 128; // it generates additiional background
                let allowedDepth = 0;
                // incase of large tool slope
                if (depthOffsetRatio < 255) {
                    allowedDepth = this.calc(Math.max(data[i - 1][j -1], data[i - 1][j], data[i - 1][j + 1],
                        data[i][j - 1], data[i][j + 1],
                        data[i + 1][j + 1], data[i + 1][j], data[i + 1][j + 1]));
                }
                if (data[i][j] < allowedDepth) {
                    data[i][j] = allowedDepth;
                    updated = true;
                }
            }
        }
        return updated;
    };

    genGCode = (data) => {
        let cutDown = true;
        // let curDepth = -this.stepDown;
        let curDepth = 0;
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
        const normalizedX0 = normalizer.x(0); 
        const normalizedHeight = normalizer.y(this.targetHeight); 

        gcode.push('M3');
        gcode.push(`G0 X${normalizedX0} Y${normalizedHeight} Z${this.safetyHeight}`);
        let progress = 0;
        let cutDownTimes = 0;
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        while (cutDown) {
            cutDown = false;
            for (let i = 0; i < this.targetWidth; ++i) {
                // const matX = i;
                const gX = normalizer.x(i);
                for (let j = 0; j < this.targetHeight; ++j) {
                    const matY = (this.targetHeight - j);
                    // zig zag bad preview 
                    // let matY = j;
                    // if (j % 2 === 0) {
                        // matY = this.targetHeight - j;
                        // matY = this.targetHeight - 1 - j;
                    // }
                    const gY = normalizer.y(matY); 
                    let z = -data[i][j] * this.targetDepth / 255;
                    if (z > curZ) {
                        gcode.push(`G0 Z${z} F${this.workSpeed}\n`);
                        curZ = z;
                        // if (z < curDepth + this.stepDown) {
                        if (z < curDepth) {
                            gcode.push(`G1 X${gX} Y${gY} F${this.workSpeed}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${gX} Y${gY} F${this.workSpeed}`);
                        }
                    } else {
                        // if (z < curDepth + this.stepDown) {
                        if (z < curDepth) {
                            // z = Math.max(curDepth, z);
                            z = Math.max(curDepth - this.stepDown, z);
                            curZ = z;
                            gcode.push(`G1 X${gX} Y${gY} Z${z} F${this.plungeSpeed}`);
                            // console.log(`X${x} Y${y} Z${z} curDepth: ${curDepth}`);
                            cutDown = true;
                        } else {
                            gcode.push(`G0 X${gX} Y${gY} F${this.workSpeed}`);
                        }
                    }
                }
                // really need?
                gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
                gcode.push(`G0 X${gX} Y${normalizedHeight} F${this.jogSpeed}`);
                curZ = this.safetyHeight;
                const p = i / (this.targetWidth - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
            gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
            gcode.push(`G0 X${normalizedX0} Y${normalizedHeight} F${this.jogSpeed}`);
            curZ = this.safetyHeight;
            curDepth -= this.stepDown;
            cutDownTimes += 1;
        }
        gcode.push(`G0 Z${this.stopHeight} F${this.jogSpeed}`);
        gcode.push('M5');
        return gcode.join('\n');
    };

    // dangerous if targetDepth is deep 
    genGCodeOneCutDown = (data) => {
        let gcode = [];
        let progress = 0;
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

        for (let i = 0; i < this.targetWidth; ++i) {
            const matX = i;
            for (let j = 0; j < this.targetHeight; ++j) {
                // const matY = (this.targetHeight - j);
                let matY = j;
                if (j % 2 === 0) {
                    // matY = this.targetHeight - j;
                    matY = this.targetHeight - 1 - j;
                }
                const z = -data[i][j] * this.targetDepth / 255;
                if (z > curZ) {
                    gcode.push(`G0 Z${z} F${this.workSpeed}\n`);
                    gcode.push(`G1 X${normalizer.x(matX)} Y${normalizer.y(matY)} F${this.workSpeed}`);
                } else {
                    gcode.push(`G1 X${normalizer.x(matX)} Y${normalizer.y(matY)} Z${z} F${this.plungeSpeed}`);
                }
                // gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
                curZ = z;
            }
            // gcode.push(`G0 X${normalizer.x(matX)} Y${normalizer.y(this.targetHeight)} F${this.jogSpeed}`);
            const p = i / (this.targetWidth - 1);
            if (p - progress > 0.05) {
                progress = p;
                this.emit('progress', progress);
            }
        }
        gcode.push(`G0 Z${this.safetyHeight} F${this.jogSpeed}`); // back to safety distance.
        gcode.push(`G0 X${normalizer.x(0)} Y${normalizer.y(this.targetHeight)} F${this.jogSpeed}`);
        // curDepth -= this.stepDown;
        gcode.push(`G0 Z${this.stopHeight} F${this.jogSpeed}`);
        gcode.push('M5');
        return gcode.join('\n');
    };
}
