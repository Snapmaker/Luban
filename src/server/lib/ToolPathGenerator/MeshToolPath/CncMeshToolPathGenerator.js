import EventEmitter from 'events';
import { BACK, CNC_MESH_SLICE_MODE_LINKAGE, CNC_MESH_SLICE_MODE_ROTATION, FRONT, LEFT, RIGHT } from '../../../constants';
import CncReliefToolPathGenerator from '../CncReliefToolPathGenerator';
import { DIRECTION_FACE_OPTIONS, MeshProcess } from '../../MeshProcess/MeshProcess';
import XToBToolPath from '../../ToolPath/XToBToolPath';
import CncMeshLinkageToolPathGenerator from './CncMeshLinkageToolPathGenerator';

export default class CncMeshToolPathGenerator extends EventEmitter {
    constructor(modelInfo) {
        super();
        const { uploadName, gcodeConfig = {}, transformation = {}, processImageName, materials } = modelInfo;
        const { isRotate, diameter } = materials;

        const { density = 5, toolAngle = 20, sliceMode = CNC_MESH_SLICE_MODE_ROTATION } = gcodeConfig;

        this.modelInfo = modelInfo;
        this.uploadName = uploadName;
        this.processImageName = processImageName;
        this.transformation = transformation;
        this.gcodeConfig = gcodeConfig;

        this.sliceMode = sliceMode;

        this.density = density;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.toolPath = new XToBToolPath({ isRotate, diameter: diameter });

        this.toolAngle = toolAngle;
    }

    async generateToolPathSliceModeRotation() {
        const meshProcess = new MeshProcess(this.modelInfo);

        const { width, height } = meshProcess.getWidthAndHeight();
        if (this.transformation.width && this.transformation.height) {
            meshProcess.mesh.resize({
                x: this.transformation.width / width,
                y: this.transformation.width / width,
                z: this.transformation.height / height
            });
        }

        const generator = new CncReliefToolPathGenerator(this.modelInfo);

        const { data, imageWidth, imageHeight } = meshProcess.convertToData(generator.density);

        generator.targetWidth = imageWidth;
        generator.targetHeight = imageHeight;

        generator.on('progress', (p) => {
            this.emit('progress', p);
        });

        generator.upSmooth(data);
        return generator.parseImageToToolPathObj(data);
    }

    async generateToolPathSliceModeLinkage() {
        const generator = new CncMeshLinkageToolPathGenerator(this.modelInfo);
        generator.on('progress', (p) => {
            this.emit('progress', p);
        });
        return generator.generateToolPathObj();
    }

    async generateToolPathSliceModeMultiFace() {
        const meshProcess = new MeshProcess(this.modelInfo);
        const { width, height } = meshProcess.getWidthAndHeight();
        meshProcess.mesh.resize({
            x: this.transformation.width / width,
            y: this.transformation.width / width,
            z: this.transformation.height / height
        });

        const parseToToolPath = async (face, i) => {
            meshProcess.mesh.setCoordinateSystem(DIRECTION_FACE_OPTIONS[face]);
            meshProcess.mesh.offset({
                x: -meshProcess.mesh.aabb.min.x,
                y: -(meshProcess.mesh.aabb.min.y + meshProcess.mesh.aabb.max.y) / 2,
                z: -meshProcess.mesh.aabb.min.z
            });
            const res = await meshProcess.convertTo3AxisImage();
            const modelInfo = {
                ...this.modelInfo,
                materials: {
                    isRotate: false
                },
                transformation: {
                    ...this.modelInfo.transformation,
                    width: res.width,
                    height: res.height
                }
            };
            const modelPath = `${process.env.Tmpdir}/${res.filename}`;
            const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
            generator.on('progress', (p) => {
                this.emit('progress', p * (i + 1) / 4);
            });
            generator.initialZ = this.diameter / 2;
            generator.imageInitalZ = meshProcess.mesh.aabb.length.y / 2;
            generator.imageFinalZ = 0;
            return generator.generateToolPathObj();
        };

        const faces = [LEFT, FRONT, RIGHT, BACK];

        const { jogSpeed } = this.gcodeConfig;

        for (let i = 0; i < faces.length; i++) {
            const toolPath = await parseToToolPath(faces[i], i);
            this.toolPath.move0B(i * 90, jogSpeed);
            for (const command of toolPath.data) {
                this.toolPath.setCommand(command);
            }
        }

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

        const { headType, mode } = this.modelInfo;

        return {
            headType: headType,
            mode: mode,
            movementMode: '',
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
    }

    async generateToolPathObj() {
        let res = null;
        if (this.isRotate) {
            if (this.sliceMode === CNC_MESH_SLICE_MODE_ROTATION) {
                res = await this.generateToolPathSliceModeRotation();
            } else if (this.sliceMode === CNC_MESH_SLICE_MODE_LINKAGE) {
                res = await this.generateToolPathSliceModeLinkage();
            }
        } else {
            res = await this.generateToolPathSliceModeRotation();
        }
        this.emit('progress', 1);

        return res;
    }

    generateViewPathObj() {
        const meshProcess = new MeshProcess(this.modelInfo);

        const { width, height } = meshProcess.getWidthAndHeight();
        if (this.transformation.width && this.transformation.height) {
            meshProcess.mesh.resize({
                x: this.transformation.width / width,
                y: this.transformation.width / width,
                z: this.transformation.height / height
            });
        }

        const generator = new CncReliefToolPathGenerator(this.modelInfo);

        const { data, imageWidth, imageHeight } = meshProcess.convertToData(generator.density);

        generator.on('progress', (p) => {
            this.emit('progress', p);
        });

        generator.targetWidth = imageWidth;
        generator.targetHeight = imageHeight;

        generator.upSmooth(data);
        return this.isRotate ? generator.parseRotateImageToViewPathObj(data)
            : generator.parseImageToViewPathObj(data);
    }
}
