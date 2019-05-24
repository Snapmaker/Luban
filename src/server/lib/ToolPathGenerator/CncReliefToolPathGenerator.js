import Jimp from 'jimp';
import EventEmitter from 'events';
// import GcodeParser from './GcodeParser';
import Normalizer from './Normalizer';

export default class CncReliefToolPathGenerator extends EventEmitter {
    constructor(modelInfo, modelPath) {
        super();
        // const { config, transformation, gcodeConfigPlaceholder } = modelInfo;
        const { config, transformation, gcodeConfig } = modelInfo;
        const { jogSpeed, workSpeed, plungeSpeed } = gcodeConfig;
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

        const maxDensity = Math.min(10, Math.floor(Math.sqrt(5000000 / transformation.width / transformation.height)));
        this.density = Math.min(density, maxDensity);
        // console.log('density', this.density);
        // console.log('max density', Math.floor(Math.sqrt(5000000 / transformation.width / transformation.height)));

        this.targetWidth = Math.round(transformation.width * this.density);
        this.targetHeight = Math.round(transformation.height * this.density);
        this.rotation = transformation.rotation;
        this.isInvert = isInvert;

        this.modelPath = modelPath;
        this.toolSlope = Math.tan(toolAngle / 2 * Math.PI / 180);
        this.toolPath = [];
        this.estimatedTime = 0;
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
                // const fakeGcode = this.genGCode(data);
                // return new GcodeParser().parseGcodeToToolPathObj(fakeGcode, this.modelInfo);
                return this.parseImageToToolPathObj(data);
            });
    }

    calc(grey) {
        // return (color / 255 * this.targetDepth - 1 / this.density / this.toolSlope) * 255 / this.targetDepth;
        return grey - 255 / (this.targetDepth * this.density * this.toolSlope);
    }

    upSmooth = (data) => {
        const width = data.length;
        const height = data[0].length;
        const depthOffsetRatio = this.targetDepth * this.density * this.toolSlope;
        let updated = false;
        const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
        const dy = [-1, 0, 1, -1, 1, -1, 0, 1];
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                let allowedDepth = 0;
                if (depthOffsetRatio < 255) {
                    for (let k = 0; k < 8; k++) {
                        const i2 = i + dx[k];
                        const j2 = j + dy[k];
                        if (i2 < 0 || i2 > width - 1 || j2 < 0 || j2 > height - 1) {
                            continue;
                        }
                        allowedDepth = Math.max(allowedDepth, data[i2][j2]);
                    }
                    allowedDepth = this.calc(allowedDepth);
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
        // let gcode = [];
        let gcode = '';
        let currentZ = 0;
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

        // gcode.push('M3');
        // gcode.push(`G0 X${normalizedX0} Y${normalizedHeight} Z${this.safetyHeight}`);
        gcode += 'M3\n';
        gcode += `G0 X${normalizedX0} Y${normalizedHeight} Z${this.safetyHeight}\n`;
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
                    const gY = normalizer.y(matY);
                    let z = Number((-data[i][j] * this.targetDepth / 255).toFixed(2));
                    if (z > currentZ) {
                        gcode += `G0 Z${z} F${this.workSpeed}\n`;
                        currentZ = z;
                        // if (z < curDepth + this.stepDown) {
                        if (z < curDepth) {
                            gcode += `G1 X${gX} Y${gY} F${this.workSpeed}\n`;
                            cutDown = true;
                        } else {
                            gcode += `G0 X${gX} Y${gY} F${this.workSpeed}\n`;
                        }
                    } else {
                        // if (z < curDepth + this.stepDown) {
                        if (z < curDepth) {
                            // z = Math.max(curDepth, z);
                            z = Math.max(curDepth - this.stepDown, z);
                            currentZ = z;
                            gcode += `G1 X${gX} Y${gY} Z${z} F${this.plungeSpeed}\n`;
                            // console.log(`X${x} Y${y} Z${z} curDepth: ${curDepth}`);
                            cutDown = true;
                        } else {
                            gcode += `G0 X${gX} Y${gY} F${this.workSpeed}\n`;
                        }
                    }
                }
                // really need?
                gcode += `G0 Z${this.safetyHeight} F${this.jogSpeed}\n`; // back to safety distance.
                gcode += `G0 X${gX} Y${normalizedHeight} F${this.jogSpeed}\n`;
                currentZ = this.safetyHeight;
                const p = i / (this.targetWidth - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
            gcode += `G0 Z${this.safetyHeight} F${this.jogSpeed}\n`; // back to safety distance.
            gcode += `G0 X${normalizedX0} Y${normalizedHeight} F${this.jogSpeed}\n`;
            currentZ = this.safetyHeight;
            curDepth -= this.stepDown;
            cutDownTimes += 1;
        }
        gcode += `G0 Z${this.stopHeight} F${this.jogSpeed}\n`;
        gcode += 'M5\n';
        // return gcode.join('\n');
        return gcode;
    };

    parseImageToToolPathObj = (data) => {
        let cutDown = true;
        let curDepth = 0;
        // let gcode = '';
        let currentZ = 0;
        let progress = 0;
        let cutDownTimes = 0;
        const { type, mode, transformation, config } = this.modelInfo;
        const { translateX, translateY, translateZ } = transformation;
        const normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth,
            0,
            this.targetHeight,
            { x: 1 / this.density, y: 1 / this.density }
        );
        let startPoint = {
            X: undefined,
            Y: undefined,
            Z: undefined
        };
        let endPoint = {
            X: undefined,
            Y: undefined,
            Z: undefined
        };
        const normalizedX0 = normalizer.x(0);
        const normalizedHeight = normalizer.y(this.targetHeight);
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        // gcode.push('M3');
        // gcode.push(`G0 X${normalizedX0} Y${normalizedHeight} Z${this.safetyHeight}`);
        this.toolPath.push({ M: 3 });
        this.toolPath.push({ G: 0, X: normalizedX0, Y: normalizedHeight, Z: this.safetyHeight });
        startPoint = { X: normalizedX0, Y: normalizedHeight, Z: this.safetyHeight };
        // endPoint.X !== undefined && (startPoint.X = endPoint.X);
        // endPoint.Y !== undefined && (startPoint.Y = endPoint.Y);
        // endPoint.Z !== undefined && (startPoint.Z = endPoint.Z);

        while (cutDown) {
            cutDown = false;
            for (let i = 0; i < this.targetWidth; ++i) {
                const gX = normalizer.x(i);
                for (let j = 0; j < this.targetHeight; ++j) {
                    const matY = (this.targetHeight - j);
                    const gY = normalizer.y(matY);
                    // let z = -data[i][j] * this.targetDepth / 255;
                    let z = Number((-data[i][j] * this.targetDepth / 255).toFixed(2));
                    if (z > currentZ) {
                        // gcode += `G0 Z${z} F${this.workSpeed}\n`;
                        this.toolPath.push({ G: 0, Z: z, F: this.workSpeed });
                        currentZ = z;
                        if (z < curDepth) {
                            // gcode += `G1 X${gX} Y${gY} F${this.workSpeed}\n`;
                            this.toolPath.push({ G: 1, X: gX, Y: gY, F: this.workSpeed });
                            endPoint = { X: gX, Y: gY, Z: z };
                            this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.workSpeed;
                            startPoint = { ...endPoint };
                            cutDown = true;
                        } else {
                            // gcode += `G0 X${gX} Y${gY} F${this.workSpeed}\n`;
                            this.toolPath.push({ G: 0, X: gX, Y: gY, F: this.workSpeed });
                            endPoint = { X: gX, Y: gY, Z: z };
                            this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.workSpeed;
                            startPoint = { ...endPoint };
                        }
                    } else {
                        if (z < curDepth) {
                            z = Math.max(curDepth - this.stepDown, z);
                            currentZ = z;
                            // gcode += `G1 X${gX} Y${gY} Z${z} F${this.plungeSpeed}\n`;
                            this.toolPath.push({ G: 1, X: gX, Y: gY, Z: z, F: this.plungeSpeed });
                            endPoint = { X: gX, Y: gY, Z: z };
                            this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.plungeSpeed;
                            startPoint = { ...endPoint };
                            cutDown = true;
                        } else {
                            // gcode += `G0 X${gX} Y${gY} F${this.workSpeed}\n`;
                            this.toolPath.push({ G: 0, X: gX, Y: gY, Z: z, F: this.workSpeed });
                            endPoint = { X: gX, Y: gY, Z: z };
                            this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.workSpeed;
                            startPoint = { ...endPoint };
                        }
                    }
                }
                // gcode += `G0 Z${this.safetyHeight} F${this.jogSpeed}\n`; // back to safety distance.
                // gcode += `G0 X${gX} Y${normalizedHeight} F${this.jogSpeed}\n`;
                this.toolPath.push({ G: 0, Z: this.safetyHeight, F: this.jogSpeed });
                this.toolPath.push({ G: 0, X: gX, Y: normalizedHeight, F: this.jogSpeed });
                endPoint = { X: gX, Y: normalizedHeight, Z: this.safetyHeight };
                this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.jogSpeed;
                startPoint = { ...endPoint };
                currentZ = this.safetyHeight;
                const p = i / (this.targetWidth - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
            // gcode += `G0 Z${this.safetyHeight} F${this.jogSpeed}\n`; // back to safety distance.
            // gcode += `G0 X${normalizedX0} Y${normalizedHeight} F${this.jogSpeed}\n`;
            this.toolPath.push({ G: 0, Z: this.safetyHeight, F: this.jogSpeed });
            this.toolPath.push({ G: 0, X: normalizedX0, Y: normalizedHeight, F: this.jogSpeed });
            endPoint = { X: normalizedX0, Y: normalizedHeight, Z: this.safetyHeight };
            this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.jogSpeed;
            startPoint = { ...endPoint };
            currentZ = this.safetyHeight;
            curDepth -= this.stepDown;
            cutDownTimes += 1;
        }
        // gcode += `G0 Z${this.stopHeight} F${this.jogSpeed}\n`;
        // gcode += 'M5\n';
        this.toolPath.push({ G: 0, Z: this.stopHeight, F: this.jogSpeed });
        this.toolPath.push({ M: 5 });
        endPoint = { X: normalizedX0, Y: normalizedHeight, Z: this.stopHeight };
        this.estimatedTime += this.getLineLength3D(startPoint, endPoint) * 60.0 / this.jogSpeed;
        startPoint = { ...endPoint };

        return {
            type: type,
            mode: mode,
            movementMode: (type === 'laser' && mode === 'greyscale') ? config.movementMode : '',
            data: this.toolPath,
            estimatedTime: this.estimatedTime * 1.4,
            translateX: translateX,
            translateY: translateY,
            translateZ: translateZ
        };
    };

    getLineLength3D(startPoint, endPoint) {
        if (((endPoint.X - startPoint.X < 1e-6) && (endPoint.Y - startPoint.Y < 1e-6) && (endPoint.Z - startPoint.Z < 1e-6)) ||
            startPoint.X === undefined || startPoint.Y === undefined || startPoint.Z === undefined ||
            endPoint.X === undefined || endPoint.Y === undefined || endPoint.Z === undefined) {
            return 0;
        }
        return Math.sqrt((endPoint.X - startPoint.X) * (endPoint.X - startPoint.X) +
            (endPoint.Y - startPoint.Y) * (endPoint.Y - startPoint.Y) +
            (endPoint.Z - startPoint.Z) * (endPoint.Z - startPoint.Z));
    }
}
