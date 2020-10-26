import Jimp from 'jimp';
import EventEmitter from 'events';
// import GcodeParser from './GcodeParser';
import Normalizer from './Normalizer';
import ToolPath from '../ToolPath';

// eslint-disable-next-line no-unused-vars
// const OVERLAP_RATE = 0.75;
// eslint-disable-next-line no-unused-vars
// const TOOL_H = 0.1;
const MAX_DENSITY = 20;

export default class CncReliefToolPathGenerator extends EventEmitter {
    constructor(modelInfo, modelPath) {
        super();
        // const { config, transformation, gcodeConfigPlaceholder } = modelInfo;
        const { config, transformation, gcodeConfig } = modelInfo;
        const {
            jogSpeed, workSpeed, plungeSpeed, toolDiameter, toolAngle, targetDepth,
            stepDown, safetyHeight, stopHeight, density, isRotate, radius
        } = gcodeConfig;

        const { invert } = config;

        const initialZ = isRotate ? radius : 0;

        this.modelInfo = modelInfo;
        this.jogSpeed = jogSpeed;
        this.workSpeed = workSpeed;
        this.plungeSpeed = plungeSpeed;

        this.initialZ = initialZ;
        this.targetDepth = targetDepth;
        this.stepDown = stepDown;
        this.safetyHeight = initialZ + safetyHeight;
        this.stopHeight = initialZ + stopHeight;

        this.toolPath = new ToolPath({ isRotate, radius });

        const maxDensity = this.calMaxDensity(toolDiameter, toolAngle, transformation);
        this.density = Math.min(density, maxDensity);

        this.targetWidth = Math.round(transformation.width * this.density);
        this.targetHeight = Math.round(transformation.height * this.density);
        this.rotationZ = transformation.rotationZ;
        this.flip = transformation.flip;
        this.invert = invert;

        this.modelPath = modelPath;
        this.toolSlope = Math.tan(toolAngle / 2 * Math.PI / 180);
    }

    generateToolPathObj() {
        let data = null;
        return Jimp
            .read(this.modelPath)
            .then(async img => {
                if (this.invert) {
                    img.invert();
                }

                const { width, height } = img.bitmap;

                img
                    .greyscale()
                    .flip((this.flip & 2) > 0, (this.flip & 1) > 0)
                    .rotate(-this.rotationZ * 180 / Math.PI);


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

    /**
     * Calculate the max density
     */
    calMaxDensity(toolDiameter, toolAngle, transformation) {
        const maxDensity1 = Math.floor(Math.sqrt(5000000 / transformation.width / transformation.height));
        // const h = Math.tan((90 - toolAngle / 2) / 180 * Math.PI) * toolDiameter / 2;
        // const lineWidth = TOOL_H > h ? toolDiameter * OVERLAP_RATE : TOOL_H / h * toolDiameter;
        // const maxDensity2 = 1 / lineWidth;
        return Math.min(MAX_DENSITY, maxDensity1);
    }

    calc(grey) {
        // return (color / 255 * this.targetDepth - 1 / this.density / this.toolSlope) * 255 / this.targetDepth;
        return grey + 255 / (this.targetDepth * this.density * this.toolSlope);
    }

    // TODO: Note that with white to be cut, this function is actually downSmooth
    upSmooth = (data) => {
        const width = data.length;
        const height = data[0].length;
        const depthOffsetRatio = this.targetDepth * this.density * this.toolSlope;
        let updated = false;
        const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
        const dy = [-1, 0, 1, -1, 1, -1, 0, 1];
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                let allowedDepth = 255;
                if (depthOffsetRatio < 255) {
                    for (let k = 0; k < 8; k++) {
                        const i2 = i + dx[k];
                        const j2 = j + dy[k];
                        if (i2 < 0 || i2 > width - 1 || j2 < 0 || j2 > height - 1) {
                            continue;
                        }
                        allowedDepth = Math.min(allowedDepth, data[i2][j2]);
                    }
                    allowedDepth = this.calc(allowedDepth);
                }
                if (data[i][j] > allowedDepth) {
                    data[i][j] = allowedDepth;
                    updated = true;
                }
            }
        }
        return updated;
    };


    parseImageToToolPathObj = (data) => {
        let cutDown = true;
        let curDepth = this.initialZ - this.stepDown;
        // let gcode = '';
        let currentZ = this.initialZ;
        let progress = 0;
        let cutDownTimes = 0;
        const { headType, mode, transformation, gcodeConfig } = this.modelInfo;
        const { positionX, positionY, positionZ } = transformation;
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
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        this.toolPath.safeStart(normalizedX0, normalizedHeight, this.stopHeight, this.safetyHeight);

        this.toolPath.spindleOn();

        const move0Z = (zState) => {
            if (zState) {
                const lastCommand = this.toolPath.getLastCommand();
                if (lastCommand.G !== 0 || lastCommand.Z < zState.z) {
                    this.toolPath.move0Z(zState.maxZ, zState.f);
                }
                this.toolPath.move0XY(zState.x, zState.y, zState.f);
                this.toolPath.move0Z(zState.z, zState.f);
            }
        };

        const zMin = [];

        for (let i = 0; i < data.length; i++) {
            zMin[i] = 0;
            for (let j = 0; j < data[i].length; j++) {
                // cut out white color
                const z = this.initialZ + Math.round(-data[i][j] * this.targetDepth / 255 * 100) / 100;
                data[i][j] = z;
                zMin[i] = Math.min(zMin[i], z);
            }
        }

        while (cutDown) {
            cutDown = false;
            let isOrder = false;

            for (let i = 0; i < this.targetWidth; ++i) {
                const gX = normalizer.x(i);

                let zState = null;

                if (zMin[i] >= curDepth + this.stepDown) {
                    continue;
                }

                isOrder = !isOrder;

                for (let k = 0; k < this.targetHeight; ++k) {
                    const j = isOrder ? k : this.targetHeight - 1 - k;
                    const matY = (this.targetHeight - j);
                    const gY = normalizer.y(matY);

                    if (k === 0) {
                        this.toolPath.move0XY(gX, gY, this.jogSpeed);
                    }

                    let z = data[i][j];

                    if (z < curDepth + this.stepDown) {
                        move0Z(zState);
                        zState = null;

                        z = Math.max(curDepth, z);
                        if (currentZ === z) {
                            this.toolPath.move1Y(gY, this.workSpeed);
                        } else {
                            this.toolPath.move1YZ(gY, z, this.workSpeed);
                        }
                        currentZ = z;
                        cutDown = true;
                    } else {
                        if (!zState) {
                            zState = { x: gX, y: gY, z: z, maxZ: z, f: this.jogSpeed };
                        } else {
                            zState = { x: gX, y: gY, z: z, maxZ: Math.max(z, zState.maxZ), f: this.jogSpeed };
                        }
                    }
                }
                if (zState) {
                    zState.z = this.safetyHeight;
                    zState.maxZ = Math.max(zState.maxZ, this.safetyHeight);
                    move0Z(zState);
                } else {
                    this.toolPath.move0Z(this.safetyHeight, this.jogSpeed);
                }

                currentZ = this.safetyHeight;
                const p = i / (this.targetWidth - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            }
            this.toolPath.move0Z(this.safetyHeight, this.jogSpeed);
            this.toolPath.move0XY(normalizedX0, normalizedHeight, this.jogSpeed);

            currentZ = this.safetyHeight;
            curDepth = Math.round((curDepth - this.stepDown) * 100) / 100;

            cutDownTimes += 1;
        }
        this.toolPath.move0Z(this.stopHeight, this.jogSpeed);
        this.toolPath.spindleOff();

        const boundingBox = this.toolPath.boundingBox;

        boundingBox.max.x += positionX;
        boundingBox.min.x += positionX;
        boundingBox.max.y += positionY;
        boundingBox.min.y += positionY;

        return {
            headType: headType,
            mode: mode,
            movementMode: (headType === 'laser' && mode === 'greyscale') ? gcodeConfig.movementMode : '',
            data: this.toolPath.commands,
            estimatedTime: this.toolPath.estimatedTime * 1.6,
            positionX: positionX,
            positionY: positionY,
            positionZ: positionZ,
            boundingBox: boundingBox
        };
    };
}
