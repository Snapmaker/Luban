import uuid from 'uuid';
import * as THREE from 'three';


import ThreeUtils from '../three-extensions/ThreeUtils';

import BaseModel from './BaseModel';

const materialOverstepped = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});
const materialSelected = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    shininess: 10
});

const materialNormal = new THREE.MeshPhongMaterial({
    color: 0xcecece,
    side: THREE.DoubleSide
});

class ThreeModel extends BaseModel {
    isThreeModel = true;

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
        this.showOrigin = (this.sourceType !== 'raster' && this.sourceType !== 'image3d');
        this.modelGroup = modelGroup;

        this.lastToolPathStr = null;
        this.isToolPath = false;

        if (modelInfo.convexGeometry) {
            this.setConvexGeometry(modelInfo.convexGeometry);
        }

        this.updateTransformation(this.transformation);
        this.meshObject.addEventListener('update', this.modelGroup.onModelUpdate);
        if (this.sourceType === '3d' && this.transformation.positionX === 0 && this.transformation.positionY === 0) {
            this.stickToPlate();
            const point = modelGroup._computeAvailableXY(this);
            this.meshObject.position.x = point.x;
            this.meshObject.position.y = point.y;
            this.transformation.positionX = point.x;
            this.transformation.positionY = point.y;
        }
    }

    get visible() {
        return this.meshObject.visible;
    }

    set visible(value) {
        this.meshObject.visible = value;
        this.showOrigin = this.sourceType !== 'raster' && this.sourceType !== 'image3d';
    }

    updateModelName(newName) {
        this.modelName = newName;
    }

    onTransform() {
        const geometrySize = ThreeUtils.getGeometrySize(this.meshObject.geometry, true);
        const { uniformScalingState } = this.meshObject;

        const position = new THREE.Vector3();
        this.meshObject.getWorldPosition(position);
        const scale = new THREE.Vector3();
        this.meshObject.getWorldScale(scale);
        const quaternion = new THREE.Quaternion();
        this.meshObject.getWorldQuaternion(quaternion);
        const rotation = new THREE.Euler().setFromQuaternion(quaternion, undefined, false);

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
        // const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, flip, uniformScalingState } = transformation;
        // const { width, height } = transformation;

        // if (uniformScalingState !== undefined) {
        //     this.meshObject.uniformScalingState = uniformScalingState;
        //     this.transformation.uniformScalingState = uniformScalingState;
        // }

        // if (positionX !== undefined) {
        //     this.meshObject.position.x = positionX;
        //     this.transformation.positionX = positionX;
        // }
        // if (positionY !== undefined) {
        //     this.meshObject.position.y = positionY;
        //     this.transformation.positionY = positionY;
        // }
        // if (positionZ !== undefined) {
        //     this.meshObject.position.z = positionZ;
        //     this.transformation.positionZ = positionZ;
        // }
        // if (rotationX !== undefined) {
        //     this.meshObject.rotation.x = rotationX;
        //     this.transformation.rotationX = rotationX;
        // }
        // if (rotationY !== undefined) {
        //     this.meshObject.rotation.y = rotationY;
        //     this.transformation.rotationY = rotationY;
        // }
        // if (rotationZ !== undefined) {
        //     this.meshObject.rotation.z = rotationZ;
        //     this.transformation.rotationZ = rotationZ;
        // }
        // if (scaleX !== undefined) {
        //     this.meshObject.scale.x = scaleX;
        //     this.transformation.scaleX = scaleX;
        // }
        // if (scaleY !== undefined) {
        //     this.meshObject.scale.y = scaleY;
        //     this.transformation.scaleY = scaleY;
        // }
        // if (scaleZ !== undefined) {
        //     this.meshObject.scale.z = scaleZ;
        //     this.transformation.scaleZ = scaleZ;
        // }
        // if (flip !== undefined) {
        //     this.transformation.flip = flip;
        //     if (this.modelObject3D) {
        //         if (flip === 0) {
        //             this.modelObject3D.rotation.x = 0;
        //             this.modelObject3D.rotation.y = 0;
        //         }
        //         if (flip === 1) {
        //             this.modelObject3D.rotation.x = Math.PI;
        //             this.modelObject3D.rotation.y = 0;
        //         }
        //         if (flip === 2) {
        //             this.modelObject3D.rotation.x = 0;
        //             this.modelObject3D.rotation.y = Math.PI;
        //         }
        //         if (flip === 3) {
        //             this.modelObject3D.rotation.x = Math.PI;
        //             this.modelObject3D.rotation.y = Math.PI;
        //         }
        //     }
        //     if (this.processObject3D) {
        //         if (flip === 0) {
        //             this.processObject3D.rotation.x = 0;
        //             this.processObject3D.rotation.y = 0;
        //         }
        //         if (flip === 1) {
        //             this.processObject3D.rotation.x = Math.PI;
        //             this.processObject3D.rotation.y = 0;
        //         }
        //         if (flip === 2) {
        //             this.processObject3D.rotation.x = 0;
        //             this.processObject3D.rotation.y = Math.PI;
        //         }
        //         if (flip === 3) {
        //             this.processObject3D.rotation.x = Math.PI;
        //             this.processObject3D.rotation.y = Math.PI;
        //         }
        //     }
        // }
        // // width & height dont effected on meshobject any more
        // if (width) {
        //     this.transformation.width = width;
        // }
        // if (height) {
        //     this.transformation.height = height;
        // }
        // this.transformation = { ...this.transformation };
        // return this.transformation;
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

    stickToPlate() {
        if (this.sourceType !== '3d') {
            return;
        }

        const revert = ThreeUtils.removeObjectParent(this.meshObject);

        this.computeBoundingBox();
        this.meshObject.position.z = this.meshObject.position.z - this.boundingBox.min.z;
        this.onTransform();
        revert();
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
            this.meshObject.material = materialSelected.clone();
        } else {
            this.meshObject.material = materialNormal.clone();
        }
        // for indexed geometry
        if (isSelected && this.meshObject.geometry.getAttribute('color')) {
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
            material: this.meshObject.material
        };
        const clone = new ThreeModel(modelInfo, modelGroup);
        clone.originModelID = this.modelID;
        clone.modelID = uuid.v4();
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

        // TODO: how about do not use matrix to speed up
        const { planes, areas } = ThreeUtils.computeGeometryPlanes(this.convexGeometry, this.meshObject.matrixWorld);
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
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.meshObject.geometry, this.meshObject.matrixWorld, bigPlanes.planes);

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
                rates.push(
                    objPlanes.areas[idx]
                    * (objPlanes.areas[idx] / bigPlanes.areas[idx])
                    * (minSupportVolume / objPlanes.supportVolumes[idx])
                );
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
        convexGeometryClone.applyMatrix(this.meshObject.matrix);
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
        clone.applyMatrix(this.meshObject.matrixWorld.clone());

        const positions = clone.getAttribute('position').array;

        const colors = [];
        const normals = clone.getAttribute('normal').array;
        let start = 0;
        const worker = () => {
            let i = start;
            do {
                const normal = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]);
                const angle = normal.angleTo(new THREE.Vector3(0, 0, 1)) / Math.PI * 180;
                const avgZ = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;

                if (angle > 120 && avgZ > 1) {
                    colors.push(1, 0.2, 0.2);
                    colors.push(1, 0.2, 0.2);
                    colors.push(1, 0.2, 0.2);
                } else {
                    colors.push(0.9, 0.9, 0.9);
                    colors.push(0.9, 0.9, 0.9);
                    colors.push(0.9, 0.9, 0.9);
                }
                i += 9;
            } while (i - start < 10000 && i < normals.length);
            if (i < normals.length) {
                start = i;
                setTimeout(worker, 1);
            } else {
                bufferGeometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                this.setSelected(true);
                this.modelGroup.modelChanged();
            }
        };

        setTimeout(worker, 10);
    }

    removeVertexColors() {
        const bufferGeometry = this.meshObject.geometry;
        bufferGeometry.removeAttribute('color');
        this.setSelected();
        this.modelGroup && this.modelGroup.modelChanged();
    }

    getSerializableConfig() {
        const {
            modelID, limitSize, headType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, config, mode,
            transformation, processImageName
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
            transformation,
            processImageName
        };
    }
}

export default ThreeModel;
