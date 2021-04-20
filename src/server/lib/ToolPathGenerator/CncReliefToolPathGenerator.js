import Jimp from 'jimp';
import EventEmitter from 'events';
// import GcodeParser from './GcodeParser';
import Normalizer from './Normalizer';
import { round } from '../../../shared/lib/utils';
import XToBToolPath from '../ToolPath/XToBToolPath';

const OVERLAP_RATE = 0.5;
const MAX_DENSITY = 20;

class ZState {
    constructor() {
        this.init();
    }

    update(state) {
        this.isUpdate = true;
        state.x !== undefined && (this.x = state.x);
        state.y !== undefined && (this.y = state.y);
        state.z !== undefined && (this.z = state.z);
        state.f !== undefined && (this.f = state.f);
        if (state.z !== undefined) {
            this.z = state.z;
            if (this.maxZ !== null) {
                this.maxZ = Math.max(this.maxZ, state.z);
            } else {
                this.maxZ = state.z;
            }
        }
    }

    move(toolPath) {
        if (this.isUpdate) {
            const lastCommand = toolPath.getLastCommand();
            if (lastCommand.G !== 0 || lastCommand.Z < this.maxZ) {
                toolPath.move0Z(this.maxZ, this.f);
            }
            if (this.x !== null && this.y !== null) {
                toolPath.move0XY(this.x, this.y, this.f);
            } else if (this.x !== null) {
                toolPath.move0X(this.x, this.f);
            } else if (this.y !== null) {
                toolPath.move0Y(this.y, this.f);
            }
            toolPath.move0Z(this.z, this.f);

            this.init();
        }
    }

    init() {
        this.isUpdate = false;
        this.x = null;
        this.y = null;
        this.z = null;
        this.maxZ = null;
        this.f = null;
    }
}

export default class CncReliefToolPathGenerator extends EventEmitter {
    constructor(modelInfo, modelPath) {
        super();

        const { config, transformation, gcodeConfig, materials, toolParams } = modelInfo;
        const { targetDepth, allowance, stepDown, density, isModel = false } = gcodeConfig;
        const { isRotate, diameter } = materials;
        const { toolDiameter, toolAngle } = toolParams;

        const { invert } = config;

        const radius = diameter / 2;

        this.modelInfo = modelInfo;
        this.modelPath = modelPath;

        this.gcodeConfig = gcodeConfig;
        this.transformation = transformation;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.isRotateModel = isRotate && isModel;

        this.targetDepth = targetDepth;
        this.allowance = allowance;

        this.initialZ = isRotate ? radius : 0;

        this.imageInitalZ = this.initialZ;
        this.imageFinalZ = this.initialZ - this.targetDepth;

        if (this.isRotateModel) {
            this.modelDiameter = transformation.width / Math.PI;
            this.targetDepth = radius;
            this.imageInitalZ = this.modelDiameter / 2;
            this.imageFinalZ = 0;
        }

        this.stepDown = stepDown;

        this.density = Math.min(density, this.calMaxDensity(toolDiameter, transformation));

        this.toolAngle = toolAngle;
        this.toolParams = toolParams;

        this.rotationZ = transformation.rotationZ;
        this.scaleX = transformation.scaleX;
        this.scaleY = transformation.scaleY;
        this.invert = invert;

        this.toolPath = new XToBToolPath({ isRotate: this.isRotate, diameter: this.isRotateModel ? this.modelDiameter : this.diameter });

        const targetWidth = Math.round(transformation.width * this.density);
        const targetHeight = Math.round(transformation.height * this.density);

        this._initGenerator(targetWidth, targetHeight);
    }

    _initGenerator(targetWidth, targetHeight) {
        this.targetWidth = targetWidth;
        this.targetHeight = targetHeight;

        this.normalizer = new Normalizer(
            'Center',
            0,
            this.targetWidth - 1,
            0,
            this.targetHeight - 1,
            { x: 1 / this.density, y: 1 / this.density },
            { x: 0, y: 0 }
        );
    }

    _processImage() {
        let data = null;
        return Jimp
            .read(this.modelPath)
            .then(async img => {
                console.log('_processImage', img, this.modelPath);
                if (this.invert) {
                    img.invert();
                }

                const { width, height } = img.bitmap;

                img
                    .greyscale()
                    .flip(this.scaleX < 0, this.scaleY < 0)
                    .rotate(-this.rotationZ * 180 / Math.PI);

                const scale = { w: img.bitmap.width / width, h: img.bitmap.height / height };


                // targetWidth&targetHeight will be changed after rotated
                const targetWidth = Math.round(this.targetWidth * scale.w);
                const targetHeight = Math.round(this.targetHeight * scale.h);

                this._initGenerator(targetWidth, targetHeight);

                data = [];
                for (let i = 0; i < this.targetWidth; i++) {
                    data[i] = [];
                    for (let j = 0; j < this.targetHeight; j++) {
                        const x = Math.floor(i / this.targetWidth * img.bitmap.width);
                        const y = Math.floor(j / this.targetHeight * img.bitmap.height);
                        const idx = y * img.bitmap.width * 4 + x * 4;
                        const a = img.bitmap.data[idx + 3];
                        if (a === 0) {
                            data[i][j] = 255;
                        } else {
                            data[i][j] = img.bitmap.data[idx];
                        }
                    }
                }

                if (this.allowance > 0) {
                    this.calculateAllowance(data);
                }

                if (this.toolAngle < 60) {
                    this.upSmooth(data);
                } else {
                    this.preventCollision(data);
                }

                return data;
            });
    }

    /**
     * Calculate the max density
     */
    calMaxDensity(toolDiameter, transformation) {
        const maxDensity1 = Math.floor(Math.sqrt(5000000 / transformation.width / transformation.height));
        const lineWidth = toolDiameter * OVERLAP_RATE;
        const maxDensity2 = 1 / lineWidth;
        return Math.min(MAX_DENSITY, maxDensity1, maxDensity2);
    }

    calc(grey, depthOffsetRatio) {
        return grey - 255 / depthOffsetRatio;
    }

    calculateAllowance(data) {
        const width = data.length;
        const height = data[0].length;
        const depth = this.imageInitalZ - this.imageFinalZ;
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                data[i][j] = Math.min(Math.floor(this.allowance / depth * 255 + data[i][j]), 255);
            }
        }
    }

    // TODO: Note that with white to be cut, this function is actually downSmooth
    upSmooth = (data) => {
        const width = data.length;
        const height = data[0].length;
        const depth = this.imageInitalZ - this.imageFinalZ;
        const depthOffsetRatio = depth * this.density * Math.tan(this.toolAngle / 2 * Math.PI / 180);
        let updated = true;
        const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
        const dy = [-1, 0, 1, -1, 1, -1, 0, 1];
        while (updated) {
            updated = false;
            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    let allowedDepth = -255;
                    if (depthOffsetRatio < 255) {
                        for (let k = 0; k < 8; k++) {
                            const i2 = i + dx[k];
                            const j2 = j + dy[k];
                            if (i2 < 0 || i2 > width - 1 || j2 < 0 || j2 > height - 1) {
                                continue;
                            }
                            allowedDepth = Math.max(allowedDepth, data[i2][j2]);
                        }
                        allowedDepth = this.calc(allowedDepth, depthOffsetRatio);
                    }
                    if (data[i][j] < allowedDepth) {
                        data[i][j] = allowedDepth;
                        updated = true;
                    }
                }
            }
        }
    };

    _calculateCollisionOffsetOffsetZ = (offsetX) => {
        const { toolDiameter, toolAngle, toolShaftDiameter } = this.toolParams;
        if (offsetX <= toolDiameter / 2) {
            return 0;
        }
        if (offsetX > toolShaftDiameter / 2) {
            return -1;
        }
        return (offsetX - toolDiameter / 2) / Math.tan(toolAngle / 2 * Math.PI / 180);
    };

    /**
     * Calculate tool collision area
     * @param data
     */
    preventCollision = (data) => {
        const { toolShaftDiameter } = this.toolParams;

        const width = data.length;
        const height = data[0].length;

        const count = Math.round(toolShaftDiameter / 2 * this.density);

        const depth = this.imageInitalZ - this.imageFinalZ;

        const offsetPixels = [];
        for (let i = 0; i <= count; i++) {
            const offsetZ = this._calculateCollisionOffsetOffsetZ(i / this.density);
            offsetPixels[i] = offsetZ / depth * 255;
        }

        const nData = data.map(v => v.map(d => d));

        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                for (let k = Math.max(0, i - count); k <= Math.min(width - 1, i + count); k++) {
                    for (let l = Math.max(0, j - count); l <= Math.min(height - 1, j + count); l++) {
                        const offsetIndex = Math.abs(k - i) + Math.abs(l - j);
                        if (offsetPixels[offsetIndex] === undefined || data[i][j] === 255) {
                            continue;
                        }
                        nData[i][j] = Math.max(nData[i][j], data[k][l] - offsetPixels[offsetIndex]);
                    }
                }
            }
        }

        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                data[i][j] = nData[i][j];
            }
        }
    };

    _calculateThePrintZ(pixel) {
        const z = round(this.imageInitalZ - (this.imageInitalZ - this.imageFinalZ) * (255 - pixel) / 255, 2);
        return Math.min(this.initialZ, z);
    }

    parseRotateImageToViewPathObj = (data) => {
        const normalizer = this.normalizer;

        const paths = [];

        const pathLength = this.isRotateModel ? this.targetWidth : Math.round(this.diameter * Math.PI * this.density);

        const swapPath = (path, start, end) => {
            const pathTmp = [];
            for (let i = start; i <= end; i++) {
                pathTmp.push(path[i % path.length]);
            }
            let index = 0;
            for (let i = end; i >= start; i--) {
                path[i % path.length] = pathTmp[index++];
            }
        };

        const pathNegativeReordering = (path) => {
            let start = 0;
            const len = path.length;
            for (let i = 0; i < len; i++) {
                if (path[i].z > 0) {
                    start = i;
                    break;
                }
            }
            let left = null;
            let right = null;
            for (let i = start; i <= start + len; i++) {
                if (path[i % len].z < 0) {
                    if (left === null) {
                        left = i;
                    }
                } else {
                    if (left !== null) {
                        right = i - 1;
                        swapPath(path, left, right);
                        left = null;
                        right = null;
                    }
                }
            }
        };

        for (let j = 0; j < this.targetHeight; j++) {
            const path = [];
            for (let i = 0; i < Math.max(this.targetWidth, pathLength); i++) {
                const index = i % pathLength;
                const x = normalizer.x(i);
                const z = round(i >= this.targetWidth ? this.diameter / 2 : this._calculateThePrintZ(data[i][j]), 2);
                const b = this.toolPath.toB(x) / 180 * Math.PI;
                const px = round(z * Math.sin(b), 2);
                const py = round(z * Math.cos(b), 2);
                if (path[index] === undefined) {
                    path[index] = { x: px, y: py, z: z };
                } else {
                    if (z < path[index].z) {
                        path[index].x = px;
                        path[index].x = px;
                        path[index].z = z;
                    }
                }
            }
            path.push(path[0]);

            pathNegativeReordering(path);

            paths.push(path);

            this.emit('progress', (j + 1) / this.targetHeight);
        }

        paths.push(paths[paths.length - 1]);

        const width = this.targetWidth / this.density;
        const height = this.targetHeight / this.density;

        const boundingBox = {
            max: {
                x: this.transformation.positionX + width / 2,
                y: this.transformation.positionY + height / 2,
                z: -this.targetDepth
            },
            min: {
                x: this.transformation.positionX - width / 2,
                y: this.transformation.positionY - height / 2,
                z: 0
            },
            length: {
                x: width,
                y: height,
                z: this.targetDepth
            }
        };

        return {
            data: paths,
            positionX: 0,
            positionY: this.transformation.positionY,
            rotationB: this.isRotate ? this.toolPath.toB(this.transformation.positionX) : 0,
            width: width,
            height: height,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter
        };
    };

    parseImageToViewPathObj = (data) => {
        const { positionX, positionY } = this.transformation;

        const normalizer = this.normalizer;

        const paths = [];

        for (let j = 0; j < this.targetHeight; j++) {
            const path = [];
            for (let i = 0; i < this.targetWidth; i++) {
                const x = normalizer.x(i);
                const z = this._calculateThePrintZ(data[i][j]);
                path.push({ x: x, y: z });
            }
            paths.push(path);

            this.emit('progress', (j + 1) / this.targetHeight);
        }

        const width = this.targetWidth / this.density;
        const height = this.targetHeight / this.density;

        const boundingBox = {
            max: {
                x: this.transformation.positionX + width / 2,
                y: this.transformation.positionY + height / 2,
                z: -this.targetDepth
            },
            min: {
                x: this.transformation.positionX - width / 2,
                y: this.transformation.positionY - height / 2,
                z: 0
            },
            length: {
                x: width,
                y: height,
                z: this.targetDepth
            }
        };

        return {
            data: paths,
            width: width,
            height: height,
            targetDepth: this.targetDepth,
            positionX: positionX,
            positionY: positionY,
            boundingBox: boundingBox
        };
    };

    parseImageToToolPathObj = async (data) => {
        const { jogSpeed, workSpeed, plungeSpeed } = this.gcodeConfig;
        let { safetyHeight, stopHeight } = this.gcodeConfig;

        safetyHeight = this.initialZ + safetyHeight;
        stopHeight = this.initialZ + stopHeight;

        let cutDown = true;
        let curDepth = this.initialZ - this.stepDown;
        let currentZ = this.initialZ;
        let progress = 0;
        let cutDownTimes = 0;

        const normalizer = this.normalizer;

        const normalizedX0 = normalizer.x(0);
        const normalizedHeight = normalizer.y(0);
        const zSteps = Math.ceil(this.targetDepth / this.stepDown) + 1;

        // safeStart
        this.toolPath.safeStart(normalizedX0, normalizedHeight, stopHeight, safetyHeight, jogSpeed);
        this.toolPath.rotateStart(jogSpeed);
        this.toolPath.spindleOn({ P: 100 });

        const zMin = [];

        for (let j = 0; j < this.targetHeight; j++) {
            zMin[j] = this.initialZ;
            for (let i = 0; i < this.targetWidth; i++) {
                const z = this._calculateThePrintZ(data[i][j]);
                data[i][j] = round(z, 2);
                zMin[j] = Math.min(zMin[j], z);
            }
        }

        let circle = 0;

        while (cutDown) {
            cutDown = false;
            let isOrder = true;
            const zState = new ZState();

            await this.modelInfo.taskAsyncFor(this.targetHeight - 1, 0, -1, (j) => {
                const gY = normalizer.y(this.targetHeight - 1 - j);

                const isFirst = j === this.targetHeight - 1;

                if (zMin[j] >= curDepth + this.stepDown) {
                    zState.update({
                        y: gY,
                        z: this.initialZ,
                        f: jogSpeed
                    });
                    return;
                }

                if (j < this.targetHeight - 1) {
                    if (!this.isRotateModel) {
                        isOrder = !isOrder;
                    } else {
                        circle++;
                        this.toolPath.setCircle(circle);
                    }
                }

                for (let k = 0; k < this.targetWidth; k++) {
                    const i = isOrder ? k : this.targetWidth - 1 - k;
                    const gX = normalizer.x(i);

                    let z = data[i][j];

                    if (z < curDepth + this.stepDown) {
                        zState.move(this.toolPath);

                        z = Math.max(curDepth, z);
                        if (k === 0) {
                            if (currentZ === z) {
                                this.toolPath.move1XY(gX, gY, isFirst ? workSpeed / 2 : workSpeed);
                            } else {
                                this.toolPath.move1XYZ(gX, gY, z, isFirst ? plungeSpeed / 2 : plungeSpeed);
                            }
                        } else {
                            if (currentZ === z) {
                                this.toolPath.move1X(gX, isFirst ? workSpeed / 2 : workSpeed);
                            } else {
                                this.toolPath.move1XZ(gX, z, isFirst ? plungeSpeed / 2 : plungeSpeed);
                            }
                        }
                        currentZ = z;
                        cutDown = true;
                    } else {
                        zState.update({
                            x: gX,
                            y: gY,
                            z: k === 0 ? this.initialZ : z,
                            f: jogSpeed
                        });
                        currentZ = k === 0 ? this.initialZ : z;
                    }
                }

                zState.move(this.toolPath);

                currentZ = this.initialZ;

                const p = j / (this.targetHeight - 1) / zSteps + cutDownTimes / zSteps;
                if (p - progress > 0.05) {
                    progress = p;
                    this.emit('progress', progress);
                }
            });
            if (cutDown) {
                this.toolPath.move0Z(safetyHeight, jogSpeed);
                this.toolPath.move0XY(normalizedX0, normalizedHeight, jogSpeed);

                currentZ = safetyHeight;
                curDepth = round((curDepth - this.stepDown), 2);
            }

            cutDownTimes += 1;
        }
        this.toolPath.move0Z(stopHeight, jogSpeed);
        this.toolPath.spindleOff();
        this.toolPath.resetB();

        const boundingBox = this.toolPath.boundingBox;
        const { positionX } = this.transformation;

        if (this.isRotate) {
            boundingBox.max.b += this.toolPath.toB(positionX);
            boundingBox.min.b += this.toolPath.toB(positionX);
        } else {
            boundingBox.max.x += positionX;
            boundingBox.min.x += positionX;
        }
        boundingBox.max.y += this.transformation.positionY;
        boundingBox.min.y += this.transformation.positionY;

        const { headType, mode, gcodeConfig } = this.modelInfo;

        return {
            headType: headType,
            mode: mode,
            movementMode: (headType === 'laser' && mode === 'greyscale') ? gcodeConfig.movementMode : '',
            data: this.toolPath.commands,
            estimatedTime: this.toolPath.estimatedTime * 1.6,
            positionX: this.isRotate ? 0 : this.transformation.positionX,
            positionY: this.transformation.positionY,
            positionZ: this.transformation.positionZ,
            rotationB: this.isRotate ? this.toolPath.toB(this.transformation.positionX) : 0,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter
        };
    };

    async generateViewPathObj() {
        const data = await this._processImage();
        return this.isRotate ? this.parseRotateImageToViewPathObj(data)
            : this.parseImageToViewPathObj(data);
    }

    async generateToolPathObj() {
        const data = await this._processImage();
        return this.parseImageToToolPathObj(data);
    }
}
