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

const materialSelected = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0xb0b0b0, shininess: 30 });
const materialNormal = new THREE.MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30 });
const materialOverstepped = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});

class Model extends THREE.Mesh {
    // constructor(modelInfo, geometry, modelName, modelPath) {
    constructor(modelInfo) {
        super();
        // super(new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });
        // super(geometry, materialNormal);
        // this.isModel = true;
        this.boundingBox = null; // the boundingBox is aligned parent axis
        // this.selected = false;
        // this.overstepped = false;
        // this.geometry = geometry;
        this.convexGeometry = null;
        // this.modelName = modelName;
        // this.modelPath = modelPath;

        this.modelID = uuid.v4();
        // this.isModel2D = true;
        this.stage = 'idle'; // idle, previewing, previewed
        // this._selected = false;
        this.modelInfo = modelInfo;
        const { name, filename } = modelInfo.source;
        const { width, height } = modelInfo.transformation;
        this.modelPath = `${DATA_PREFIX}/${filename}`;
        this.modelName = name;
        this.toolPath = null;
        this.toolPathObj3D = null;
        this.modelObject3D = null;
        this.estimatedTime = 0;
        this.autoPreviewEnabled = false;
        this.displayToolPathId = null;
        this.boundingBox = null;

        // this.position = { x: 0, y: 0, z: 0 };
        // this.rotation = { x: 0, y: 0, z: 0 };
        // this.scale = { x: 0, y: 0, z: 0 };
        this.flip = 0;

        if (this.modelInfo.source.type === '3d') {
            // this.geometry = new THREE.BufferGeometry();
            this.geometry = modelInfo.geometry;
        } else {
            // this.geometry = new THREE.PlaneGeometry(width, height);
            // this.mesh = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });
            // this.mesh = new THREE.MeshBasicMaterial({ color: 0x000000, visible: false });
            this.displayModelObject3D(name, filename, width, height);
        }
        // this.setSelected(this._selected);
    }


    displayModelObject3D(name, filename, width, height) {
        this.modelObject3D && this.remove(this.modelObject3D);
        const modelPath = `${DATA_PREFIX}/${filename}`;
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
    }

    updateTransformationFromModel() {
        const geometrySize = ThreeUtils.getGeometrySize(this.geometry, true);
        const transformation = {
            rotationZ: this.rotation.z,
            positionX: this.position.x,
            positionY: this.position.y,
            width: geometrySize.x * this.scale.x,
            height: geometrySize.y * this.scale.y
        };
        this.modelInfo.transformation = {
            ...this.modelInfo.transformation,
            ...transformation
        };
    }

    onTransform() {
        const { width, height, rotationZ } = this.modelInfo.transformation;

        this.updateTransformationFromModel();

        const transformation = this.modelInfo.transformation;
        if (width !== transformation.width || height !== transformation.height || rotationZ !== transformation.rotationZ) {
            this.showModelObject3D();
            this.autoPreview();
        }
    }

    updateTransformation(transformation) {
        let needAutoPreview = false;
        const { source } = this.modelInfo;
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, flip } = transformation;
        console.log('rotatez ', rotationZ);

        if (positionX !== undefined) {
            this.position.x = positionX;
            this.modelInfo.transformation.positionX = positionX;
        }
        if (positionY !== undefined) {
            this.position.y = positionY;
            this.modelInfo.transformation.positionY = positionY;
        }
        if (rotationZ !== undefined) {
            console.log('rotate ', rotationZ);
            this.rotation.z = rotationZ;
            this.modelInfo.transformation.rotationZ = rotationZ;
            needAutoPreview = true;
        }
        if (flip !== undefined) {
            this.flip = flip;
            this.modelInfo.transformation.flip = flip;
            needAutoPreview = true;
        }
        // uniform scale
        if (source.type === '3d') {
            // positionX !== undefined && (this.position.x = positionX);
            positionZ !== undefined && (this.position.z = positionZ);

            rotationX !== undefined && (this.rotation.x = rotationX);
            rotationY !== undefined && (this.rotation.y = rotationY);
            // rotationZ !== undefined && (this.rotation.z = rotationZ);

            scaleX !== undefined && (this.scale.x = scaleX);
            scaleY !== undefined && (this.scale.y = scaleY);
            scaleZ !== undefined && (this.scale.z = scaleZ);
        } else if (transformation.width || transformation.height) {
            let { width, height } = transformation;
            if (!width) {
                width = height * source.width / source.height;
            } else {
                height = width * source.height / source.width;
            }
            // scale model2D
            const geometrySize = ThreeUtils.getGeometrySize(this.geometry, true);
            const scaleX = width / geometrySize.x;
            const scaleY = height / geometrySize.y;
            this.scale.set(scaleX, scaleY, 1);

            this.modelInfo.transformation.width = width;
            this.modelInfo.transformation.height = height;
            needAutoPreview = true;
        }

        if (needAutoPreview) {
            this.autoPreview();
        }
    }

    updatePrintOrder(printOrder) {
        this.modelInfo.printOrder = printOrder;
    }

    // Update source
    updateSource(source) {
        this.modelInfo.source = {
            ...this.modelInfo.source,
            ...source
        };
        const { name, filename, width, height } = this.modelInfo.source;
        this.displayModelObject3D(name, filename, width, height);
        this.autoPreview();
    }

    updateConfig(config) {
        this.modelInfo.config = {
            ...this.modelInfo.config,
            ...config
        };
        this.showModelObject3D();
        this.autoPreview();
    }

    updateGcodeConfig(gcodeConfig) {
        this.modelInfo.gcodeConfig = {
            ...this.modelInfo.gcodeConfig,
            ...gcodeConfig
        };
        // TODO only for calculating estimatedTime
        this.showModelObject3D();
        this.autoPreview();
    }

    setSelected(selected) {
        this._selected = selected;
    }

    isSelected() {
        return this._selected;
    }

    displayToolPathObj3D() {
        if (!this.toolPath) {
            return;
        }

        this.toolPathObj3D && (this.remove(this.toolPathObj3D));
        this.toolPathObj3D = generateToolPathObject3D(this.toolPath);
        this.toolPathObj3D.rotation.z = -this.rotation.z;
        const { x, y } = this.scale;
        this.toolPathObj3D.scale.set(1 / x, 1 / y, 1);
        this.add(this.toolPathObj3D);

        this.modelObject3D && (this.modelObject3D.visible = false);
        this.stage = 'previewed';

        this.dispatchEvent(EVENTS.UPDATE);
    }

    showModelObject3D() {
        this.toolPathObj3D && (this.toolPathObj3D.visible = false);
        this.modelObject3D && (this.modelObject3D.visible = true);
        this.stage = 'idle';
    }

    autoPreview(force) {
        if (force || this.autoPreviewEnabled) {
            this.stage = 'previewing';
            this.modelInfo.taskId = uuid.v4();
            this.modelInfo.modelID = this.modelID;
            // api.commitTask(this.modelInfo)
            //     .then((res) => {
            //     });
            // For convenience, use modelInfo as task
            if (this.modelInfo.source.type !== '3d') {
                controller.commitTask(this.modelInfo);
            }
        }
    }

    loadToolPath(filename, taskId) {
        if (this.modelInfo.taskId === taskId && this.displayToolPathId !== taskId) {
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
                        this.displayToolPathId = taskId;
                        if (this.modelInfo.gcodeConfig.multiPassEnabled) {
                            this.estimatedTime = this.toolPath.estimatedTime * this.modelInfo.gcodeConfig.multiPasses;
                            // console.log('t1 ', this.estimatedTime);
                        } else {
                            this.estimatedTime = this.toolPath.estimatedTime;
                            // console.log('t2 ', this.estimatedTime);
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
        api.generateToolPath(this.modelInfo)
            .then((res) => {
                const { filename } = res.body;
                const toolPathFilePath = `${DATA_PREFIX}/${filename}`;
                new THREE.FileLoader().load(
                    toolPathFilePath,
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

        const { gcodeConfig, transformation } = this.modelInfo;
        const { positionX, positionY } = transformation;
        toolPath.positionX = positionX;
        toolPath.positionY = positionY;

        return gcodeGenerator.parseToolPathObjToGcode(toolPath, gcodeConfig);
    }

    computeBoundingBox() {
        // 3D
        if (this.modelInfo.source.type === '3d') {
            // after operated(move/scale/rotate), model.geometry is not changed
            // so need to call: geometry.applyMatrix(matrixLocal);
            // then call: geometry.computeBoundingBox(); to get operated modelMesh BoundingBox
            // clone this.convexGeometry then clone.computeBoundingBox() is faster.
            if (this.convexGeometry) {
                const clone = this.convexGeometry.clone();
                this.updateMatrix();
                clone.applyMatrix(this.matrix);
                clone.computeBoundingBox();
                this.boundingBox = clone.boundingBox;
            } else {
                const clone = this.geometry.clone();
                this.updateMatrix();
                clone.applyMatrix(this.matrix);
                clone.computeBoundingBox();
                this.boundingBox = clone.boundingBox;
            }
        } else {
            const { width, height, rotationZ } = this.modelInfo.transformation;
            const bboxWidth = Math.abs(width * Math.cos(rotationZ)) + Math.abs(height * Math.sin(rotationZ));
            const bboxHeight = Math.abs(width * Math.sin(rotationZ)) + Math.abs(height * Math.cos(rotationZ));
            const { x, y } = this.position;
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
        this.position.y = this.position.y - this.boundingBox.min.y;
    }

    // 3D
    setMatrix(matrix) {
        this.updateMatrix();
        this.applyMatrix(new THREE.Matrix4().getInverse(this.matrix));
        this.applyMatrix(matrix);
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
            this.material = materialOverstepped;
        } else {
            this.material = (this.selected ? materialSelected : materialNormal);
        }
    }

    clone() {
        const modelName = this.modelInfo.source.name;
        const filename = this.modelInfo.source.filename;
        const modelPath = `${DATA_PREFIX}/${filename}`;
        const clone = new Model(
            this.geometry.clone(),
            modelName,
            modelPath
        );
        this.updateMatrix();
        clone.setMatrix(this.matrix);
        return clone;
    }

    layFlat() {
        const epsilon = 1e-6;
        const positionX = this.position.x;
        const positionZ = this.position.z;

        console.log('layflat0 ');
        if (!this.convexGeometry) {
            return;
        }

        console.log('layflat1 ');
        // Attention: the minY-vertex and min-angle-vertex must be in the same face
        // transform convexGeometry clone
        let convexGeometryClone = this.convexGeometry.clone();

        this.updateMatrix();
        convexGeometryClone.applyMatrix(this.matrix);
        let faces = convexGeometryClone.faces;
        let vertices = convexGeometryClone.vertices;

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
            this.applyMatrix(matrix1);
            this.stickToPlate();

            // update geometry
            convexGeometryClone = this.convexGeometry.clone();
            convexGeometryClone.applyMatrix(this.matrix);
            faces = convexGeometryClone.faces;
        }

        // now there must be 2 minY vertices
        // find minAngleFace
        const candidateFaces = [];
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            if ([face.a, face.b, face.c].includes(minYVertexIndex) &&
                [face.a, face.b, face.c].includes(minAngleVertexIndex)) {
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
        this.applyMatrix(matrix2);
        console.log('layflat ');
        this.stickToPlate();
        this.position.x = positionX;
        this.position.z = positionZ;
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
