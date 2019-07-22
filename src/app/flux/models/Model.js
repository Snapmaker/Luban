import uuid from 'uuid';
import * as THREE from 'three';
import { DATA_PREFIX } from '../../constants';
import api from '../../api';
import { generateToolPathObject3D } from '../generator';
import GcodeGenerator from '../../widgets/GcodeGenerator';
import controller from '../../lib/controller';
import ThreeUtils from '../../components/three-extensions/ThreeUtils';

const EVENTS = {
    UPDATE: { type: 'update' }
};

// const materialSelected = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0xb0b0b0, shininess: 30 });
const materialNormal = new THREE.MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30 });
const materialOverstepped = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});

// class Model extends THREE.Mesh {
class Model {
    // constructor(modelInfo, geometry, modelName, modelPath) {
    constructor(modelInfo) {
        // const { source, transformation, geometry, mesh } = modelInfo;
        const { headerType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, geometry, material,
            transformation, config, gcodeConfig, mode, movementMode, printOrder, gcodeConfigPlaceholder } = modelInfo;
        const { width, height } = transformation;
        // const { name, filename } = source;
        // const { orignalName, uploadName, uploadPath, height, width } = source;
        // const { sourceType, orignalName, uploadName } = source;
        // super(geometry, mesh);
        this.meshObject = new THREE.Mesh(geometry, material);

        // TODO redundant literally, to be removed
        this.modelID = uuid.v4();

        this.taskID = null;

        this.stage = 'idle'; // idle, previewing, previewed
        // this.modelInfo = modelInfo;
        // this.modelPath = `${DATA_PREFIX}/${filename}`;

        // source.type => 3d, raster, svg, text
        this.headerType = headerType;
        this.sourceType = sourceType;
        this.sourceHeight = sourceHeight;
        this.sourceWidth = sourceWidth;
        this.originalName = originalName;
        this.uploadName = uploadName;
        // this.uploadPath = `${DATA_PREFIX}/${uploadName}`;
        this.transformation = transformation;
        this.config = config;
        this.gcodeConfig = gcodeConfig;
        // greyscale bw vector trace
        this.mode = mode;
        this.movementMode = movementMode;
        this.printOrder = printOrder;
        this.gcodeConfigPlaceholder = gcodeConfigPlaceholder;

        this.toolPath = null;
        this.toolPathObj3D = null;
        this.modelObject3D = null;
        this.estimatedTime = 0;
        this.autoPreviewEnabled = false;
        this.displayToolPathId = null;
        this.boundingBox = null;
        this.overstepped = false;
        this.convexGeometry = null;

        this.displayModelObject3D(uploadName, width, height);
    }

    displayModelObject3D(uploadName, width, height) {
        if (this.sourceType === '3d') {
            return;
        }

        // this.modelObject3D && this.remove(this.modelObject3D);
        // this.modelObject3D && this.meshObject.remove(this.modelObject3D);
        const uploadPath = `${DATA_PREFIX}/${uploadName}`;
        const texture = new THREE.TextureLoader().load(uploadPath);

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture,
            side: THREE.DoubleSide
        });
        if (this.modelObject3D) {
            this.meshObject.remove(this.modelObject3D);
            this.modelObject3D = null;
        }
        // TODO async
        // Remember!!!
        // this.meshObject.geometry = new THREE.PlaneGeometry(this.transformation.width, this.transformation.height);
        // this.meshObject.geometry = new THREE.PlaneGeometry(this.sourceWidth, this.sourceHeight);
        // this.meshObject.geometry = new THREE.PlaneGeometry(width, height);

        // solution 1: the previous way
        this.meshObject.geometry = new THREE.PlaneGeometry(width, height);
        this.modelObject3D = new THREE.Mesh(this.meshObject.geometry, material);

        // solution 2: not ok
        // const geometry = new THREE.PlaneGeometry(width, height);
        // this.modelObject3D = new THREE.Mesh(geometry, material);

        this.meshObject.add(this.modelObject3D);
        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        this.meshObject.dispatchEvent(EVENTS.UPDATE);

        /*
        new THREE.TextureLoader().load(uploadPath, (texture) => {
            this.meshObject.dispatchEvent(EVENTS.UPDATE);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                map: texture,
                side: THREE.DoubleSide
            });
            if (this.modelObject3D) {
                this.meshObject.remove(this.modelObject3D);
                this.modelObject3D = null;
            }
            this.meshObject.geometry = new THREE.PlaneGeometry(width, height);
            // this.modelObject3D = new THREE.Mesh(this.geometry, material);
            this.modelObject3D = new THREE.Mesh(this.meshObject.geometry, material);
            this.meshObject.add(this.modelObject3D);
            this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        });
        */
        /*
        const texture = new THREE.TextureLoader().load(modelPath, () => {
            this.dispatchEvent(EVENTS.UPDATE);
        });
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture,
            side: THREE.DoubleSide
        });
        this.geometry = new THREE.PlaneGeometry(width, height);
        this.modelObject3D = new THREE.Mesh(this.geometry, material);
        this.add(this.modelObject3D);
        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        */
    }

    updateTransformationFromModel() {
        const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
        const { position, rotation, scale } = this.meshObject;
        const transformation = {
            rotationZ: rotation.z,
            positionX: position.x,
            positionY: position.y,
            width: geometrySize.x * scale.x,
            height: geometrySize.y * scale.y
        };
        this.transformation = {
            ...this.transformation,
            ...transformation
        };
        // this.transformation = transformation;
    }

    onTransform() {
        const { width, height, rotationZ } = this.transformation;

        this.updateTransformationFromModel();

        const transformation = this.transformation;
        if (width !== transformation.width || height !== transformation.height || rotationZ !== transformation.rotationZ) {
            this.showModelObject3D();
            this.autoPreview();
        }
    }

    updateTransformation(transformation) {
        let needAutoPreview = false;
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, flip } = transformation;
        let { height, width } = transformation;

        if (positionX !== undefined) {
            this.meshObject.position.x = positionX;
            this.transformation.positionX = positionX;
        }
        if (positionY !== undefined) {
            this.meshObject.position.y = positionY;
            this.transformation.positionY = positionY;
        }
        if (rotationZ !== undefined) {
            this.meshObject.rotation.z = rotationZ;
            this.transformation.rotationZ = rotationZ;
            needAutoPreview = true;
        }
        if (scaleX !== undefined) {
            this.meshObject.scale.x = scaleX;
            needAutoPreview = true;
        }
        if (scaleY !== undefined) {
            this.meshObject.scale.y = scaleY;
            needAutoPreview = true;
        }
        if (flip !== undefined) {
            this.transformation.flip = flip;
            needAutoPreview = true;
        }
        if (this.sourceType === '3d') {
            // positionX !== undefined && (this.position.x = positionX);
            positionZ !== undefined && (this.meshObject.position.z = positionZ);

            rotationX !== undefined && (this.meshObject.rotation.x = rotationX);
            rotationY !== undefined && (this.meshObject.rotation.y = rotationY);
            // rotationZ !== undefined && (this.rotation.z = rotationZ);

            // scaleX !== undefined && (this.meshObject.scale.x = scaleX);
            // scaleY !== undefined && (this.meshObject.scale.y = scaleY);
            scaleZ !== undefined && (this.meshObject.scale.z = scaleZ);
        } else if (height || width) {
            const whRatio = this.sourceWidth / this.sourceHeight;
            const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
            if (!width) {
                width = height * whRatio;
            }
            if (!height) {
                height = width / whRatio;
            }
            const scaleX_ = width / geometrySize.x;
            const scaleY_ = height / geometrySize.y;

            console.log('ssxy ', scaleX_, scaleY_);
            this.meshObject.scale.set(scaleX_, scaleY_, 1);
            this.transformation.height = height;
            this.transformation.width = width;
            needAutoPreview = true;
        }

        if (needAutoPreview) {
            this.autoPreview();
        }
    }

    updatePrintOrder(printOrder) {
        this.printOrder = printOrder;
    }

    // Update source
    updateSource(source) {
        /*
        this.modelInfo.source = {
            ...this.modelInfo.source,
            ...source
        };
        */
        const { sourceType, sourceHeight, sourceWidth, originalName, uploadName } = source;
        this.sourceType = sourceType || this.sourceType;
        this.sourceHeight = sourceHeight || this.sourceHeight;
        this.sourceWidth = sourceWidth || this.sourceWidth;
        this.originalName = originalName || this.originalName;
        this.uploadName = uploadName || this.uploadName;

        this.displayModelObject3D(uploadName, sourceWidth, sourceHeight);
        this.autoPreview();
    }

    updateConfig(config) {
        /*
        this.modelInfo.config = {
            ...this.modelInfo.config,
            ...config
        };
        */
        this.config = {
            ...this.config,
            ...config
        };
        /*
        this.config = Object.assign({}, {
            ...this.config,
            ...config
        });
        */
        this.showModelObject3D();
        this.autoPreview();
    }

    updateGcodeConfig(gcodeConfig) {
        /*
        this.modelInfo.gcodeConfig = {
            ...this.modelInfo.gcodeConfig,
            ...gcodeConfig
        };
        */
        this.gcodeConfig = {
            ...this.gcodeConfig,
            ...gcodeConfig
        };
        // TODO only for calculating estimatedTime
        this.showModelObject3D();
        this.autoPreview();
    }

    displayToolPathObj3D() {
        if (!this.toolPath) {
            return;
        }

        this.toolPathObj3D && (this.meshObject.remove(this.toolPathObj3D));
        this.toolPathObj3D = generateToolPathObject3D(this.toolPath);
        this.toolPathObj3D.rotation.z = -this.meshObject.rotation.z;
        const { x, y } = this.meshObject.scale;
        this.toolPathObj3D.scale.set(1 / x, 1 / y, 1);
        this.meshObject.add(this.toolPathObj3D);

        this.modelObject3D && (this.modelObject3D.visible = false);
        this.stage = 'previewed';

        this.meshObject.dispatchEvent(EVENTS.UPDATE);
    }

    showModelObject3D() {
        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        this.modelObject3D && (this.modelObject3D.visible = true);
        this.stage = 'idle';
    }

    autoPreview(force) {
        if (this.sourceType === '3d') {
            return;
        }

        // console.log('autoPreview0 ', force, this.autoPreviewEnabled);
        if (force || this.autoPreviewEnabled) {
            this.stage = 'previewing';
            this.taskID = uuid.v4();
            const modelInfo = {
                taskID: this.taskID,
                headerType: this.headerType,
                sourceType: this.sourceType,
                sourceHeight: this.sourceHeight,
                sourceWidth: this.sourceWidth,
                // originalName: this.originalName,
                uploadName: this.uploadName,
                // uploadPath: this.uploadPath,
                transformation: this.transformation,
                config: this.config,
                gcodeConfig: this.gcodeConfig,
                mode: this.mode,
                movementMode: this.movementMode,
                printOrder: this.printOrder,
                gcodeConfigPlaceholder: this.gcodeConfigPlaceholder
            };
            // console.log('autoPreview1 ');
            controller.commitTask(modelInfo);
        }
        // console.log('autoPreview2 ');
    }

    loadToolPath(filename, taskID) {
        if (this.taskID === taskID && this.displayToolPathId !== taskID) {
            if (this.stage === 'previewed') {
                return Promise.resolve(null);
            }
            const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
            return new Promise((resolve) => {
                new THREE.FileLoader().load(
                    toolPathFilePath,
                    (data) => {
                        this.toolPath = JSON.parse(data);
                        this.displayToolPathObj3D();
                        this.stage = 'previewed';
                        this.displayToolPathId = taskID;
                        if (this.gcodeConfig.multiPassEnabled) {
                            this.estimatedTime = this.toolPath.estimatedTime * this.gcodeConfig.multiPasses;
                        } else {
                            this.estimatedTime = this.toolPath.estimatedTime;
                        }
                        return resolve(null);
                    }
                );
            });
        } else {
            return Promise.resolve(null);
        }
    }

    preview(callback) {
        this.stage = 'previewing';
        const modelInfo = {
            // taskID: this.taskID,
            headerType: this.headerType,
            sourceType: this.sourceType,
            sourceHeight: this.sourceHeight,
            sourceWidth: this.sourceWidth,
            // originalName: this.originalName,
            uploadName: this.uploadName,
            // uploadPath: this.uploadPath,
            transformation: this.transformation,
            config: this.config,
            gcodeConfig: this.gcodeConfig,
            mode: this.mode,
            movementMode: this.movementMode,
            printOrder: this.printOrder,
            gcodeConfigPlaceholder: this.gcodeConfigPlaceholder
        };
        api.generateToolPath(modelInfo)
            .then((res) => {
                // const { filename } = res.body;
                // const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
                const { uploadName } = res.body;
                const uploadPath = `${DATA_PREFIX}/${uploadName}`;
                new THREE.FileLoader().load(
                    // toolPathFilePath,
                    uploadPath,
                    (data) => {
                        this.toolPath = JSON.parse(data);
                        this.displayToolPathObj3D();
                        callback();
                    }
                );
            })
            .catch(() => {
                this.stage = 'idle';
                callback('err');
            });
    }

    generateGcode() {
        const gcodeGenerator = new GcodeGenerator();
        const toolPath = this.toolPath;

        // const { gcodeConfig, transformation } = this.modelInfo;
        const { positionX, positionY } = this.transformation;
        toolPath.positionX = positionX;
        toolPath.positionY = positionY;

        return gcodeGenerator.parseToolPathObjToGcode(toolPath, this.gcodeConfig);
    }

    computeBoundingBox() {
        // 3D
        // if (this.modelInfo.source.type === '3d') {
        if (this.sourceType === '3d') {
            // after operated(move/scale/rotate), model.geometry is not changed
            // so need to call: geometry.applyMatrix(matrixLocal);
            // then call: geometry.computeBoundingBox(); to get operated modelMesh BoundingBox
            // clone this.convexGeometry then clone.computeBoundingBox() is faster.
            if (this.convexGeometry) {
                const clone = this.convexGeometry.clone();
                this.meshObject.updateMatrix();
                clone.applyMatrix(this.meshObject.matrix);
                clone.computeBoundingBox();
                this.boundingBox = clone.boundingBox;
            } else {
                const clone = this.meshObject.geometry.clone();
                this.meshObject.updateMatrix();
                clone.applyMatrix(this.meshObject.matrix);
                clone.computeBoundingBox();
                this.boundingBox = clone.boundingBox;
            }
        } else {
            const { width, height, rotationZ } = this.transformation;
            const bboxWidth = Math.abs(width * Math.cos(rotationZ)) + Math.abs(height * Math.sin(rotationZ));
            const bboxHeight = Math.abs(width * Math.sin(rotationZ)) + Math.abs(height * Math.cos(rotationZ));
            const { x, y } = this.meshObject.position;
            this.boundingBox = new THREE.Box2(
                new THREE.Vector2(x - bboxWidth / 2, y - bboxHeight / 2),
                new THREE.Vector2(x + bboxWidth / 2, y + bboxHeight / 2)
            );
        }
    }

    // 3D
    setConvexGeometry(convexGeometry) {
        if (convexGeometry instanceof THREE.BufferGeometry) {
            this.convexGeometry = new THREE.Geometry().fromBufferGeometry(convexGeometry);
            this.convexGeometry.mergeVertices();
        } else {
            this.convexGeometry = convexGeometry;
        }
    }

    stickToPlate() {
        this.computeBoundingBox();
        this.meshObject.position.y = this.meshObject.position.y - this.boundingBox.min.y;
    }

    // 3D
    setMatrix(matrix) {
        this.meshObject.updateMatrix();
        this.meshObject.applyMatrix(new THREE.Matrix4().getInverse(this.meshObject.matrix));
        this.meshObject.applyMatrix(matrix);
        // attention: do not use Object3D.applyMatrix(matrix : Matrix4)
        // because applyMatrix is accumulated
        // anther way: decompose Matrix and reset position/rotation/scale
        // let position = new THREE.Vector3();
        // let quaternion = new THREE.Quaternion();
        // let scale = new THREE.Vector3();
        // matrix.decompose(position, quaternion, scale);
        // this.position.copy(position);
        // this.quaternion.copy(quaternion);
        // this.scale.copy(scale);
    }

    setOverstepped(overstepped) {
        if (this.overstepped === overstepped) {
            return;
        }
        this.overstepped = overstepped;
        if (this.overstepped) {
            // this.material = materialOverstepped;
            this.meshObject.material = materialOverstepped;
        } else {
            // TODO
            // this.material = (this.selected ? materialSelected : materialNormal);
            // this.material = materialNormal;
            this.meshObject.material = materialNormal;
        }
    }

    clone() {
        const modelInfo = {
            headerType: this.headerType,
            sourceType: this.sourceType,
            sourceHeight: this.sourceHeight,
            sourceWidth: this.sourceWidth,
            originalName: this.originalName,
            uploadName: this.uploadName,
            // uploadPath: this.uploadPath,
            geometry: this.meshObject.geometry,
            material: this.meshObject.material,
            transformation: this.transformation,
            config: this.config,
            gcodeConfig: this.gcodeConfig,
            mode: this.mode,
            movementMode: this.movementMode,
            printOrder: this.printOrder,
            gcodeConfigPlaceholder: this.gcodeConfigPlaceholder
        };
        const clone = new Model(modelInfo);
        // this.updateMatrix();
        // clone.setMatrix(this.mesh.Object.matrix);
        this.meshObject.updateMatrix();
        clone.setMatrix(this.meshObject.matrix);
        return clone;
    }

    layFlat() {
        const epsilon = 1e-6;
        const positionX = this.meshObject.position.x;
        const positionZ = this.meshObject.position.z;

        if (!this.convexGeometry) {
            return;
        }

        // Attention: the minY-vertex and min-angle-vertex must be in the same face
        // transform convexGeometry clone
        let convexGeometryClone = this.convexGeometry.clone();

        // this.updateMatrix();
        this.meshObject.updateMatrix();
        convexGeometryClone.applyMatrix(this.meshObject.matrix);
        let faces = convexGeometryClone.faces;
        const vertices = convexGeometryClone.vertices;

        // find out the following params:
        let minY = Number.MAX_VALUE;
        let minYVertexIndex = -1;
        let minAngleVertexIndex = -1; // The angle between the vector(minY-vertex -> min-angle-vertex) and the x-z plane is minimal
        let minAngleFace = null;

        // find minY and minYVertexIndex
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y < minY) {
                minY = vertices[i].y;
                minYVertexIndex = i;
            }
        }

        // get minY vertices count
        let minYVerticesCount = 0;
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y - minY < epsilon) {
                ++minYVerticesCount;
            }
        }

        if (minYVerticesCount >= 3) {
            // already lay flat
            return;
        }

        // find minAngleVertexIndex
        if (minYVerticesCount === 2) {
            for (let i = 0; i < vertices.length; i++) {
                if (vertices[i].y - minY < epsilon && i !== minYVertexIndex) {
                    minAngleVertexIndex = i;
                }
            }
        } else if (minYVerticesCount === 1) {
            let sinValue = Number.MAX_VALUE; // sin value of the angle between directionVector3 and x-z plane
            for (let i = 1; i < vertices.length; i++) {
                if (i !== minYVertexIndex) {
                    const directionVector3 = new THREE.Vector3().subVectors(vertices[i], vertices[minYVertexIndex]);
                    const length = directionVector3.length();
                    // min sinValue corresponds minAngleVertexIndex
                    if (directionVector3.y / length < sinValue) {
                        sinValue = directionVector3.y / length;
                        minAngleVertexIndex = i;
                    }
                }
            }
            // transform model to make min-angle-vertex y equal to minY
            const vb1 = new THREE.Vector3().subVectors(vertices[minAngleVertexIndex], vertices[minYVertexIndex]);
            const va1 = new THREE.Vector3(vb1.x, 0, vb1.z);
            const matrix1 = this._getRotateMatrix(va1, vb1);
            this.meshObject.applyMatrix(matrix1);
            this.stickToPlate();

            // update geometry
            convexGeometryClone = this.convexGeometry.clone();
            convexGeometryClone.applyMatrix(this.meshObject.matrix);
            faces = convexGeometryClone.faces;
        }

        // now there must be 2 minY vertices
        // find minAngleFace
        const candidateFaces = [];
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            if ([face.a, face.b, face.c].includes(minYVertexIndex)
                && [face.a, face.b, face.c].includes(minAngleVertexIndex)) {
                candidateFaces.push(face);
            }
        }

        // max cos value corresponds min angle
        convexGeometryClone.computeFaceNormals();
        let cosValue = Number.MIN_VALUE;
        for (let i = 0; i < candidateFaces.length; i++) {
            // faceNormal points model outer surface
            const faceNormal = candidateFaces[i].normal;
            if (faceNormal.y < 0) {
                const cos = -faceNormal.y / faceNormal.length();
                if (cos > cosValue) {
                    cosValue = cos;
                    minAngleFace = candidateFaces[i];
                }
            }
        }

        const xzPlaneNormal = new THREE.Vector3(0, -1, 0);
        const vb2 = minAngleFace.normal;
        const matrix2 = this._getRotateMatrix(xzPlaneNormal, vb2);
        this.meshObject.applyMatrix(matrix2);
        this.stickToPlate();
        this.meshObject.position.x = positionX;
        this.meshObject.position.z = positionZ;
    }

    // get matrix for rotating v2 to v1. Applying matrix to v2 can make v2 to parallels v1.
    _getRotateMatrix(v1, v2) {
        // https://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
        const cross = new THREE.Vector3();
        cross.crossVectors(v2, v1);
        const dot = v1.dot(v2);

        const l1 = v1.length();
        const l2 = v2.length();
        const w = l1 * l2 + dot;
        const x = cross.x;
        const y = cross.y;
        const z = cross.z;

        const q = new THREE.Quaternion(x, y, z, w);
        q.normalize();

        const matrix4 = new THREE.Matrix4();
        matrix4.makeRotationFromQuaternion(q);
        return matrix4;
    }
}

export default Model;
