import { v4 as uuid } from 'uuid';
import * as THREE from 'three';
import {
    LOAD_MODEL_FROM_INNER
} from '../constants';

import ThreeUtils from '../three-extensions/ThreeUtils';

import BaseModel from './ThreeBaseModel';
import WorkerManager from '../lib/manager/WorkerManager';
import ThreeGroup from './ThreeGroup';

const materialOverstepped = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});
class ThreeModel extends BaseModel {
    loadFrom = LOAD_MODEL_FROM_INNER;

    parent = null;

    isThreeModel = true;

    extruderConfig = {
        infill: '0',
        shell: '0',
        // adhesion: '0',
        // support: '0'
    };

    isSelected = false;

    target = null;

    supportTag = false;

    constructor(modelInfo, modelGroup) {
        super(modelInfo, modelGroup);
        const { width, height, processImageName } = modelInfo;


        this.geometry = modelInfo.geometry || new THREE.PlaneGeometry(width, height);
        const material = modelInfo.material || new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        this.meshObject = new THREE.Mesh(this.geometry, material);

        this.processImageName = processImageName;

        if (!this.transformation.width && !this.transformation.height) {
            this.transformation.width = width;
            this.transformation.height = height;
        }
        if (width && height) {
            this.transformation.scaleX = this.transformation.width / width;
            this.transformation.scaleY = this.transformation.height / height;
        }

        this.modelObject3D = null;
        this.processObject3D = null;

        // for cnc model visualizer
        this.image3dObj = null;

        this.estimatedTime = 0;

        this.boundingBox = null;
        this.overstepped = false;
        this.convexGeometry = null;
        this.modelGroup = modelGroup;

        this.lastToolPathStr = null;
        this.isToolPath = false;
        this.extruderConfig = {
            ...this.extruderConfig,
            ...modelInfo.extruderConfig
        };

        if (modelInfo.convexGeometry) {
            this.setConvexGeometry(modelInfo.convexGeometry);
        }

        this.updateTransformation(this.transformation);
        this.meshObject.addEventListener('update', this.modelGroup.onModelUpdate);
        if (modelInfo.loadFrom === LOAD_MODEL_FROM_INNER) {
            if (this.sourceType === '3d' && this.transformation.positionX === 0 && this.transformation.positionY === 0) {
                this.stickToPlate();
                const point = modelGroup._computeAvailableXY(this);
                this.meshObject.position.x = point.x;
                this.meshObject.position.y = point.y;
                this.transformation.positionX = point.x;
                this.transformation.positionY = point.y;
            }
        }

        this.updateMaterialColor(modelInfo.color ?? '#cecece');
    }

    get visible() {
        return this.meshObject.visible;
    }

    set visible(value) {
        this.meshObject.visible = value;
    }

    updateModelName(newName) {
        this.modelName = newName;
    }

    updateMaterialColor(color) {
        this._materialNormal = new THREE.MeshPhongMaterial({
            color: color,
            side: THREE.DoubleSide
        });
        this._materialSelected = new THREE.MeshPhysicalMaterial({
            color: color,
            side: THREE.DoubleSide
        });
        this.setSelected();
    }

    onTransform() {
        const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
        const { uniformScalingState } = this.meshObject;

        let position, scale, rotation;
        if (this.parent) {
            if (this.modelGroup.isModelSelected(this)) {
                const { recovery } = this.modelGroup.unselectAllModels({ recursive: true });
                position = this.meshObject.position.clone();
                scale = this.meshObject.scale.clone();
                rotation = this.meshObject.rotation.clone();
                recovery();
            } else {
                position = this.meshObject.position.clone();
                scale = this.meshObject.scale.clone();
                rotation = this.meshObject.rotation.clone();
            }
        } else {
            position = new THREE.Vector3();
            this.meshObject.getWorldPosition(position);
            scale = new THREE.Vector3();
            this.meshObject.getWorldScale(scale);
            const quaternion = new THREE.Quaternion();
            this.meshObject.getWorldQuaternion(quaternion);
            rotation = new THREE.Euler().setFromQuaternion(quaternion, undefined, false);
        }

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
            height: geometrySize.y * scale.y,
            uniformScalingState
        };

        this.transformation = {
            ...this.transformation,
            ...transformation
        };
        return this.transformation;
    }

    updateTransformation(transformation) {
        super.updateTransformation(transformation);
    }

    computeBoundingBox() {
        this.boundingBox = ThreeUtils.computeBoundingBox(this.meshObject);
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

    isModelInGroup() {
        return this.parent && this.parent instanceof ThreeGroup;
    }

    stickToPlate() {
        if (this.sourceType !== '3d') {
            return;
        }
        if (this.isModelInGroup()) {
            this.parent.stickToPlate();
            return;
        }
        const revert = ThreeUtils.removeObjectParent(this.meshObject);

        this.computeBoundingBox();
        this.meshObject.position.z -= this.boundingBox.min.z;
        this.computeBoundingBox(); // update boundingbox after position changed
        this.onTransform();
        revert();
    }

    // 3D
    setMatrix(matrix) {
        this.meshObject.updateMatrix();
        this.meshObject.applyMatrix4(new THREE.Matrix4().copy(this.meshObject.matrix).invert());
        this.meshObject.applyMatrix4(matrix);
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

    setOversteppedAndSelected(overstepped, isSelected) {
        this.overstepped = overstepped;
        this.setSelected(isSelected);
    }

    setSelected(isSelected) {
        if (typeof isSelected === 'boolean') {
            this.isSelected = isSelected;
        }
        if (this.overstepped === true) {
            this.meshObject.material = materialOverstepped.clone();
        } else if (this.isSelected === true) {
            this.meshObject.material = this._materialSelected.clone();
        } else {
            this.meshObject.material = this._materialNormal.clone();
        }

        // for indexed geometry
        if (isSelected && this.type !== 'primeTower' && this.meshObject.geometry.getAttribute('color')) {
            this.meshObject.material.vertexColors = true;
        }

        // for support geometry
        if (this.supportTag) {
            this.meshObject.material.color.set(0xFFD700);
        }
    }

    /**
     * Note that you need to give cloned Model a new model name.
     *
     * @returns {ThreeModel}
     */
    clone(modelGroup) {
        const modelInfo = {
            ...this,
            loadFrom: LOAD_MODEL_FROM_INNER,
            material: this.meshObject.material
        };
        const clone = new ThreeModel(modelInfo, modelGroup);
        clone.originModelID = this.modelID;
        clone.modelID = uuid();
        this.meshObject.updateMatrixWorld();

        clone.setMatrix(this.meshObject.matrixWorld);
        // set proper material for new model
        clone.setSelected();

        return clone;
    }

    /**
     * Find the best fit direction, and rotate the model
     * step1. get big planes of convex geometry
     * step2. calculate area, support volumes of each big plane
     * step3. find the best fit plane using formula below
     */
    autoRotate() {
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return;
        }

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        const geometry = this.meshObject.geometry;
        geometry.computeBoundingBox();
        const box3 = geometry.boundingBox;
        const x = (box3.max.x + box3.min.x) / 2;
        const y = (box3.max.y + box3.min.y) / 2;
        const z = (box3.max.z + box3.min.z) / 2;
        const center = new THREE.Vector3(x, y, z);
        center.applyMatrix4(this.meshObject.matrixWorld);

        // mirror operation on model may cause convex plane normal vector inverse, if it does, inverse it back
        const inverseNormal = (this.transformation.scaleX / Math.abs(this.transformation.scaleX) < 0);
        // TODO: how about do not use matrix to speed up
        const { planes, areas } = ThreeUtils.computeGeometryPlanes(this.convexGeometry, this.meshObject.matrixWorld, [], center, inverseNormal);
        const maxArea = Math.max.apply(null, areas);
        const bigPlanes = { planes: null, areas: [] };
        bigPlanes.planes = planes.filter((p, idx) => {
            // filter big planes, 0.1 can be change to improve perfomance
            const isBig = areas[idx] > maxArea * 0.1;
            isBig && bigPlanes.areas.push(areas[idx]);
            return isBig;
        });

        if (!bigPlanes.planes.length) return;

        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.meshObject.geometry, this.meshObject.matrixWorld, bigPlanes.planes, center, false);

        let targetPlane;
        const minSupportVolume = Math.min.apply(null, objPlanes.supportVolumes);
        // if has a direction without support, choose it
        if (minSupportVolume < 1) {
            const idx = objPlanes.supportVolumes.findIndex(i => i === minSupportVolume);
            targetPlane = objPlanes.planes[idx];
        }

        if (!targetPlane) {
            const rates = [];
            for (let idx = 0, len = bigPlanes.planes.length; idx < len; idx++) {
                // update rate formula to improve performance
                const areasFactor = objPlanes.areas[idx] / bigPlanes.areas[idx];
                let supportVolumesFactor = 0;
                if (objPlanes.supportVolumes[idx] !== 0) {
                    supportVolumesFactor = minSupportVolume / objPlanes.supportVolumes[idx];
                } else if (minSupportVolume === 0) {
                    supportVolumesFactor = 1;
                }
                rates.push(objPlanes.areas[idx] * areasFactor * supportVolumesFactor);
            }

            const maxRate = Math.max.apply(null, rates);
            const idx = rates.findIndex(r => r === maxRate);
            targetPlane = bigPlanes.planes[idx];
        }
        // WARNING: applyQuternion DONT update Matrix...
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(targetPlane.normal, xyPlaneNormal));
        this.meshObject.updateMatrix();

        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    rotateByPlane(targetPlane) {
        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(targetPlane.normal, xyPlaneNormal));
        this.meshObject.updateMatrix();

        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    analyzeRotation() {
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return null;
        }
        const geometry = this.meshObject.geometry;
        geometry.computeBoundingBox();
        const box3 = geometry.boundingBox;
        const x = (box3.max.x + box3.min.x) / 2;
        const y = (box3.max.y + box3.min.y) / 2;
        const z = (box3.max.z + box3.min.z) / 2;
        const center = new THREE.Vector3(x, y, z);
        center.applyMatrix4(this.meshObject.matrixWorld);

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();

        // mirror operation on model may cause convex plane normal vector inverse, if it does, inverse it back
        const inverseNormal = (this.transformation.scaleX / Math.abs(this.transformation.scaleX) < 0);
        // TODO: how about do not use matrix to speed up
        const { planes, areas, planesPosition } = ThreeUtils.computeGeometryPlanes(this.convexGeometry, this.meshObject.matrixWorld, [], center, inverseNormal);
        const maxArea = Math.max.apply(null, areas);
        const bigPlanes = { planes: null, areas: [], planesPosition: [] };
        bigPlanes.planes = planes.filter((p, idx) => {
            // filter big planes, 0.1 can be change to improve perfomance
            const isBig = areas[idx] > maxArea * 0.1;
            if (isBig) {
                bigPlanes.areas.push(areas[idx]);
                bigPlanes.planesPosition.push(planesPosition[idx]);
            }
            return isBig;
        });

        if (!bigPlanes.planes.length) return null;
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.meshObject.geometry, this.meshObject.matrixWorld, bigPlanes.planes, center, false);
        revertParent();

        const minSupportVolume = Math.min.apply(null, objPlanes.supportVolumes);

        const rates = [];
        for (let idx = 0, len = bigPlanes.planes.length; idx < len; idx++) {
            // update rate formula to improve performance
            const areasFactor = objPlanes.areas[idx] / bigPlanes.areas[idx];
            let supportVolumesFactor = 0;
            if (objPlanes.supportVolumes[idx] !== 0) {
                supportVolumesFactor = minSupportVolume / objPlanes.supportVolumes[idx];
            } else if (minSupportVolume === 0) {
                supportVolumesFactor = 1;
            }
            rates.push(objPlanes.areas[idx] * areasFactor * supportVolumesFactor);
        }
        const result = {
            rates: rates,
            planes: objPlanes.planes,
            planesPosition: bigPlanes.planesPosition,
            areas: objPlanes.areas,
            supportVolumes: objPlanes.supportVolumes
        };
        return result;
    }

    scaleToFit(size) {
        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        const modelSize = new THREE.Vector3();
        this.computeBoundingBox();
        this.boundingBox.getSize(modelSize);
        const scalar = ['x', 'y', 'z'].reduce((prev, key) => Math.min((size[key] - 5) / modelSize[key], prev), Number.POSITIVE_INFINITY);
        this.meshObject.scale.multiplyScalar(scalar);
        this.meshObject.position.set(0, 0, 0);
        this.meshObject.updateMatrix();
        this.setSelected();
        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    layFlat() {
        if (this.sourceType !== '3d') {
            return;
        }

        const positionX = this.meshObject.position.x;
        const positionY = this.meshObject.position.y;

        if (!this.convexGeometry) {
            return;
        }

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        // Attention: the minY-vertex and min-angle-vertex must be in the same face
        // transform convexGeometry clone
        const convexGeometryClone = this.convexGeometry.clone();
        convexGeometryClone.computeVertexNormals();
        // this.updateMatrix();
        this.meshObject.updateMatrix();
        convexGeometryClone.applyMatrix4(this.meshObject.matrix);
        const faces = convexGeometryClone.faces;
        let minAngleFace = null;
        let minAngle = Math.PI;
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const angle = face.normal.angleTo(new THREE.Vector3(0, 0, -1));
            if (angle < minAngle) {
                minAngle = angle;
                minAngleFace = face;
            }
        }


        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const vb2 = minAngleFace.normal;
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vb2, xyPlaneNormal));
        this.stickToPlate();
        this.meshObject.position.x = positionX;
        this.meshObject.position.y = positionY;
        this.meshObject.updateMatrix();

        this.onTransform();
        revertParent();
    }

    setSupportPosition(position) {
        const object = this.meshObject;
        object.position.copy(position);
        object.updateMatrix();
        this.generateSupportGeometry();
    }

    generateSupportGeometry() {
        const target = this.target;
        const center = new THREE.Vector3();
        this.meshObject.getWorldPosition(center);
        center.setZ(0);

        const rayDirection = new THREE.Vector3(0, 0, 1);
        const size = this.supportSize;
        const raycaster = new THREE.Raycaster(center, rayDirection);
        const intersects = raycaster.intersectObject(target.meshObject, true);

        let intersect = intersects[0];
        if (intersects.length >= 2) {
            intersect = intersects[intersects.length - 2];
        }
        this.isInitSupport = true;
        let height = 100;
        if (intersect && intersect.distance > 0) {
            this.isInitSupport = false;
            height = intersect.point.z;
        }

        const geometry = ThreeUtils.generateSupportBoxGeometry(size.x, size.y, height);

        geometry.computeVertexNormals();

        this.meshObject.geometry = geometry;
        this.geometry = geometry;
        this.computeBoundingBox();
    }

    setVertexColors() {
        this.meshObject.updateMatrixWorld();
        const bufferGeometry = this.meshObject.geometry;
        const clone = bufferGeometry.clone();
        clone.applyMatrix4(this.meshObject.matrixWorld.clone());

        const positions = clone.getAttribute('position').array;
        const normals = clone.getAttribute('normal').array;

        WorkerManager.evaluateSupportArea({ positions, normals }, (e) => {
            const { colors } = e.data;
            bufferGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            this.setSelected(true);
            this.modelGroup.modelChanged();
        });
    }

    removeVertexColors() {
        const bufferGeometry = this.meshObject.geometry;
        bufferGeometry.deleteAttribute('color');
        this.setSelected();
        this.modelGroup && this.modelGroup.modelChanged();
    }

    cloneMeshWithoutSupports() {
        const clonedMesh = this.meshObject.clone(false);
        return clonedMesh;
    }

    getSerializableConfig() {
        const {
            modelID, limitSize, headType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, config, mode,
            transformation, processImageName, supportTag, visible, extruderConfig, modelName
        } = this;

        return {
            modelID,
            limitSize,
            headType,
            sourceType,
            sourceHeight,
            sourceWidth,
            originalName,
            uploadName,
            config,
            mode,
            visible,
            transformation,
            processImageName,
            supportTag,
            extruderConfig,
            modelName
        };
    }
}

export default ThreeModel;
