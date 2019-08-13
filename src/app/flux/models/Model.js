import uuid from 'uuid';
import * as THREE from 'three';
import { DATA_PREFIX } from '../../constants';
import { sizeModelByMachineSize } from './ModelInfoUtils';

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

const DEFAULT_TRANSFORMATION = {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    flip: 0
};

// class Model extends THREE.Mesh {
class Model {
    constructor(modelInfo) {
        const { limitSize, headerType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, mode, geometry, material,
            transformation } = modelInfo;
        this.limitSize = limitSize;

        this.meshObject = new THREE.Mesh(geometry, material);

        this.modelID = uuid.v4();

        this.headerType = headerType;
        this.sourceType = sourceType; // 3d, raster, svg, text
        this.sourceHeight = sourceHeight;
        this.sourceWidth = sourceWidth;
        this.originalName = originalName;
        this.uploadName = uploadName;
        this.mode = mode;

        this.transformation = {
            ...DEFAULT_TRANSFORMATION,
            ...transformation
        };
        if (!this.transformation.width && !this.transformation.height) {
            const { width, height } = sizeModelByMachineSize(limitSize, sourceWidth, sourceHeight);
            this.transformation.width = width;
            this.transformation.height = height;
        }

        this.modelObject3D = null;

        this.estimatedTime = 0;

        this.boundingBox = null;
        this.overstepped = false;
        this.convexGeometry = null;
    }

    getTaskInfo() {
        return {
            headerType: this.headerType,
            sourceType: this.sourceType,
            modelID: this.modelID,
            sourceHeight: this.sourceHeight,
            sourceWidth: this.sourceWidth,
            originalName: this.originalName,
            uploadName: this.uploadName,
            mode: this.mode,
            geometry: this.meshObject.geometry,
            material: this.meshObject.material,
            transformation: this.transformation
        };
    }

    generateModelObject3D() {
        if (this.sourceType !== '3d') {
            // this.modelObject3D && this.remove(this.modelObject3D);
            // this.modelObject3D && this.meshObject.remove(this.modelObject3D);
            const uploadPath = `${DATA_PREFIX}/${this.uploadName}`;
            // const texture = new THREE.TextureLoader().load(uploadPath);
            const texture = new THREE.TextureLoader().load(uploadPath, () => {
                this.meshObject.dispatchEvent(EVENTS.UPDATE);
            });
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
            // text transformation bug: async mismatch
            // this.meshObject.geometry = new THREE.PlaneGeometry(this.transformation.width, this.transformation.height);
            // this.meshObject.geometry = new THREE.PlaneGeometry(this.sourceWidth, this.sourceHeight);
            const { width, height } = sizeModelByMachineSize(this.limitSize, this.sourceWidth, this.sourceHeight);
            this.meshObject.geometry = new THREE.PlaneGeometry(width, height);
            this.modelObject3D = new THREE.Mesh(this.meshObject.geometry, material);
            this.meshObject.add(this.modelObject3D);
        }

        this.updateTransformation(this.transformation);
    }

    onTransform() {
        const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
        const { position, rotation, scale } = this.meshObject;
        const transformation = {
            positionX: position.x,
            positionY: position.y,
            positionZ: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale.x,
            scaleY: scale.y,
            scaleZ: scale.z,
            width: geometrySize.x * scale.x,
            height: geometrySize.y * scale.y
        };
        this.transformation = {
            ...this.transformation,
            ...transformation
        };
        return this.transformation;
    }

    updateTransformation(transformation) {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, flip } = transformation;
        let { width, height } = transformation;

        if (positionX !== undefined) {
            this.meshObject.position.x = positionX;
            this.transformation.positionX = positionX;
        }
        if (positionY !== undefined) {
            this.meshObject.position.y = positionY;
            this.transformation.positionY = positionY;
        }
        if (positionZ !== undefined) {
            this.meshObject.position.z = positionZ;
            this.transformation.positionZ = positionZ;
        }
        if (rotationX !== undefined) {
            this.meshObject.rotation.x = rotationX;
            this.transformation.rotationX = rotationX;
        }
        if (rotationY !== undefined) {
            this.meshObject.rotation.y = rotationY;
            this.transformation.rotationY = rotationY;
        }
        if (rotationZ !== undefined) {
            this.meshObject.rotation.z = rotationZ;
            this.transformation.rotationZ = rotationZ;
        }
        if (scaleX !== undefined) {
            this.meshObject.scale.x = scaleX;
            this.transformation.scaleX = scaleX;
        }
        if (scaleY !== undefined) {
            this.meshObject.scale.y = scaleY;
            this.transformation.scaleY = scaleY;
        }
        if (scaleZ !== undefined) {
            this.meshObject.scale.z = scaleZ;
            this.transformation.scaleZ = scaleZ;
        }
        if (flip !== undefined) {
            this.transformation.flip = flip;
        }
        if (width || height) {
            const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
            width = width || height * this.sourceWidth / this.sourceHeight;
            height = height || width * this.sourceHeight / this.sourceWidth;

            const scaleX_ = width / geometrySize.x;
            const scaleY_ = height / geometrySize.y;

            this.meshObject.scale.set(scaleX_, scaleY_, 1);
            this.transformation.width = width;
            this.transformation.height = height;
        }
        return this.transformation;
    }


    // Update source
    updateSource(source) {
        const { sourceType, sourceHeight, sourceWidth, originalName, uploadName } = source;
        this.sourceType = sourceType || this.sourceType;
        this.sourceHeight = sourceHeight || this.sourceHeight;
        this.sourceWidth = sourceWidth || this.sourceWidth;
        this.originalName = originalName || this.originalName;
        this.uploadName = uploadName || this.uploadName;


        // this.displayModelObject3D(uploadName, sourceWidth, sourceHeight);
        // const width = this.transformation.width;
        // const height = sourceHeight / sourceWidth * width;
        this.generateModelObject3D();
    }

    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }

    updateGcodeConfig(gcodeConfig) {
        this.gcodeConfig = {
            ...this.gcodeConfig,
            ...gcodeConfig
        };
    }

    computeBoundingBox() {
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
        if (this.sourceType !== '3d') {
            return;
        }
        this.computeBoundingBox();
        this.meshObject.position.y = this.meshObject.position.y - this.boundingBox.min.y;
        this.onTransform();
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
            // this.material = (this.selected ? materialSelected : materialNormal);
            this.meshObject.material = materialNormal;
        }
    }

    clone() {
        const clone = new Model({
            ...this,
            geometry: this.meshObject.geometry.clone(),
            material: this.meshObject.material.clone()
        });
        clone.modelID = this.modelID;
        clone.generateModelObject3D();
        // this.updateMatrix();
        // clone.setMatrix(this.mesh.Object.matrix);
        this.meshObject.updateMatrix();
        clone.setMatrix(this.meshObject.matrix);
        return clone;
    }

    layFlat() {
        if (this.sourceType !== '3d') {
            return;
        }
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

        this.onTransform();
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
