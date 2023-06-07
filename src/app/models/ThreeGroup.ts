import { ConvexGeometry } from '@snapmaker/luban-platform';
import { cloneDeep } from 'lodash';
import * as THREE from 'three';

import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { BOTH_EXTRUDER_MAP_NUMBER } from '../constants';
import ThreeUtils from '../scene/three-extensions/ThreeUtils';
import type ModelGroup from './ModelGroup';
import BaseModel, { ModelInfo, ModelTransformation, TSize } from './ThreeBaseModel';
import type ThreeModel from './ThreeModel';
import { ModelEvents } from './events';

type traverseCallback = (mesh: ThreeModel) => void;

export default class ThreeGroup extends BaseModel {
    public children: Array<ThreeModel | ThreeGroup>;

    declare public meshObject: THREE.Group;

    private processImageName: string;

    private convexGeometry: THREE.Geometry;

    private mergedGeometry: THREE.BufferGeometry;

    public isColored: boolean = false;

    public constructor(modelInfo: ModelInfo, modelGroup: ModelGroup) {
        super(modelInfo, modelGroup);
        this.meshObject = new THREE.Group();
        this.meshObject.userData = {
            name: 'ThreeGroup'
        };
        this.children = [];
        this.transformation = {
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            uniformScalingState: true
        };
        this.type = modelInfo.type || 'group';
    }

    public get visible() {
        return this.meshObject.visible as boolean;
    }

    public set visible(value: boolean) {
        this.meshObject.visible = value;
    }

    private modelAttributesListener = (attribute: string) => {
        if (attribute === 'isColored') {
            this.updateGroupExtruder();
        }
    };

    public add(models: Array<(ThreeModel | ThreeGroup)>) {
        this.children = [...this.children, ...models];

        // newly added children models
        models.forEach((model) => {
            ThreeUtils.setObjectParent(model.meshObject, this.meshObject);
            model.parent = this;

            model.on(ModelEvents.ModelAttribtuesChanged, this.modelAttributesListener);
        });

        if (models.length === 1) {
            ThreeUtils.liftObjectOnlyChildMatrix(this.meshObject);
            this.meshObject.uniformScalingState = this.meshObject.children[0].uniformScalingState;
        } else if (models.length > 1) {
            this.computeBoundingBox();
            this.meshObject.uniformScalingState = true;
        }

        this.onTransform();
        this.updateGroupExtruder();
    }

    public disassemble() {
        ThreeUtils.applyObjectMatrix(this.meshObject, new THREE.Matrix4().copy(this.meshObject.matrix).invert());
        // apply group transformation to children
        const models = [] as ThreeModel[];
        // this.meshObject.updateMatrixWorld();
        this.children.forEach((model) => {
            model.off(ModelEvents.ModelAttribtuesChanged, this.modelAttributesListener);

            model.parent = undefined;
            if (model instanceof ThreeGroup) {
                const children = model.disassemble();
                models.push(...children);
            } else {
                ThreeUtils.setObjectParent(model.meshObject, this.meshObject.parent);
                models.push(model);
            }
        });
        this.meshObject.children = [];
        this.children = [];
        this.extruderConfig = {
            infill: '0',
            shell: '0'
        };
        this.mergedGeometry = null;
        this.convexGeometry = null;
        return models;
    }

    /**
     * Experimental
     * @returns THREE.BufferGeometry
     */
    public mergeGeometriesInGroup(): THREE.BufferGeometry {
        let geometry = new THREE.BufferGeometry();
        if (this.children.length > 0) {
            geometry = BufferGeometryUtils.mergeBufferGeometries(this.children.map((model) => {
                if (model.meshObject instanceof THREE.Group) {
                    return (model as ThreeGroup).mergeGeometriesInGroup();
                } else {
                    model.updateTransformation(model.transformation);
                    model.meshObject.updateMatrix();
                    const clonedGeometry = (model.meshObject as THREE.Mesh).geometry.clone() as THREE.BufferGeometry;
                    clonedGeometry.applyMatrix4(model.meshObject.matrix);
                    return clonedGeometry;
                }
            }));
        }
        // this.meshObject.updateMatrixWorld();
        // geometry.applyMatrix4(this.meshObject.matrixWorld);
        this.mergedGeometry = geometry;
        return geometry;
    }

    public traverse(callback: traverseCallback) {
        this.children.forEach((model) => {
            if (model instanceof ThreeGroup) {
                model.traverse(callback);
            } else {
                (typeof callback === 'function') && callback(model);
            }
        });
    }

    public findModelInGroupByMesh(mesh: THREE.Object3D) {
        let modelFound: ThreeModel = null, hasSelectedModel = false;
        this.traverse((model) => {
            if (model.meshObject === mesh || model.meshObject.children.indexOf(mesh) > -1) {
                modelFound = model;
            }
        });
        this.traverse((model) => {
            if (model.isSelected) {
                hasSelectedModel = true;
            }
        });

        if (modelFound) {
            if (hasSelectedModel) {
                return modelFound;
            } else if (modelFound.isSelected) {
                return modelFound;
            } else if (!this.isSelected) {
                return this;
            }
        }
        return modelFound;
    }

    public intersectSupportTargetMeshInGroup(support: ThreeModel): ThreeModel | null {
        const center = new THREE.Vector3();
        support.meshObject.getWorldPosition(center);
        center.setZ(0);

        const rayDirection = new THREE.Vector3(0, 0, 1);
        const raycaster = new THREE.Raycaster(center, rayDirection);
        const intersects = raycaster.intersectObject(this.meshObject, true);

        let target: ThreeModel = null;
        if (intersects && intersects[0]) {
            this.traverse((model) => {
                if (model.meshObject === intersects[0].object) {
                    target = model;
                }
            });
        }
        return target;
    }

    public scaleToFit(size: TSize) {
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

    public updateMaterialColor(color: string) {
        this.children.forEach((model) => {
            model.updateMaterialColor(color);
        });
    }

    /**
     * Experimental
     * @returns ModelTransformation
     */
    public onTransform() {
        const { uniformScalingState } = this.meshObject;

        const position = new THREE.Vector3();
        this.meshObject.getWorldPosition(position);
        const scale = new THREE.Vector3();
        this.meshObject.getWorldScale(scale);
        const quaternion = new THREE.Quaternion();
        this.meshObject.getWorldQuaternion(quaternion);
        const rotation = new THREE.Euler().setFromQuaternion(quaternion, undefined);

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
            uniformScalingState
        };

        this.transformation = {
            ...this.transformation,
            ...transformation
        };

        this.children.forEach((subModel) => {
            subModel.onTransform();
        });
        return this.transformation;
    }

    public updateTransformation(transformation: ModelTransformation) {
        return super.updateTransformation(transformation);
    }

    public computeBoundingBox() {
        let center;
        if (this.meshObject.children.length >= 1) {
            const boundingBoxTemp = ThreeUtils.computeBoundingBox(this.meshObject);
            center = new THREE.Vector3(
                (boundingBoxTemp.max.x + boundingBoxTemp.min.x) / 2,
                (boundingBoxTemp.max.y + boundingBoxTemp.min.y) / 2,
                boundingBoxTemp.max.z / 2
            );
        } else {
            center = new THREE.Vector3(
                0,
                0,
                0
            );
        }

        // set selected group position need to remove children temporarily
        const children = [...this.meshObject.children];

        children.map((obj) => ThreeUtils.removeObjectParent(obj));
        // only make the diff translation
        const oldPosition = new THREE.Vector3();
        this.meshObject.getWorldPosition(oldPosition);
        const matrix = new THREE.Matrix4().makeTranslation(center.x - oldPosition.x, center.y - oldPosition.y, center.z - oldPosition.z);
        ThreeUtils.applyObjectMatrix(this.meshObject, matrix);
        children.map((obj) => ThreeUtils.setObjectParent(obj, this.meshObject));

        this.boundingBox = ThreeUtils.computeBoundingBox(this.meshObject);
    }

    public setConvexGeometry(convexGeometry: THREE.BufferGeometry | THREE.Geometry) {
        if (convexGeometry instanceof THREE.BufferGeometry) {
            this.convexGeometry = new THREE.Geometry().fromBufferGeometry(convexGeometry);
            // Optimize GC
            convexGeometry = null;
            this.convexGeometry.mergeVertices();
        } else {
            console.error('setConvexGeometry, met Geometry!!');
            this.convexGeometry = convexGeometry;
        }
    }

    public isModelInGroup() {
        return this.parent && this.parent instanceof ThreeGroup;
    }

    public stickToPlate() {
        if (this.sourceType !== '3d') {
            return;
        }

        /**
         * Annotated by fashu-issus-id-1224048, 1408279, 1409789
         */
        if (this.meshObject.children.length < this.children.length) {
            return;
        }

        const revert = ThreeUtils.removeObjectParent(this.meshObject);

        this.computeBoundingBox();
        this.meshObject.position.z -= this.boundingBox.min.z;
        this.computeBoundingBox();
        this.onTransform();
        revert();
    }

    public setMatrix(matrix: THREE.Matrix4) {
        this.meshObject.updateMatrix();
        this.meshObject.applyMatrix4(this.meshObject.matrix.clone().invert());
        this.meshObject.applyMatrix4(matrix);
    }

    public setOversteppedAndSelected(overstepped: boolean, isSelected: boolean) {
        this.overstepped = overstepped;
        this.children.forEach((model) => {
            model.setOversteppedAndSelected(overstepped, model.isSelected);
        });
        // this.setSelected(isSelected);
        this.isSelected = isSelected;
    }

    public setSelected(isSelected?: boolean) {
        if (typeof isSelected === 'boolean') {
            this.isSelected = isSelected;
        }
        this.children.forEach((model) => {
            model.setSelected(isSelected);
        });
    }

    public clone(modelGroup: ModelGroup) {
        const clonedSubModels = [];
        const modelInfo: ModelInfo = {
            modelID: this.modelID,
            limitSize: this.limitSize,
            headType: this.headType,
            sourceType: this.sourceType,
            sourceHeight: this.sourceHeight,
            sourceWidth: this.sourceWidth,
            originalName: this.originalName,
            uploadName: this.uploadName,
            mode: this.mode,
            transformation: this.transformation,
            processImageName: this.processImageName,
            extruderConfig: cloneDeep(this.extruderConfig),
        };
        this.children.forEach((model) => {
            clonedSubModels.push(model.clone(modelGroup));
        });
        const clone = new ThreeGroup(modelInfo, modelGroup);
        clone.add(clonedSubModels);
        return clone;
    }

    /**
     * Experimental
     * @returns void
     */
    public autoRotate() {
        this.computeConvex();
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return;
        }

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        const geometry = this.mergedGeometry;
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
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.mergedGeometry, this.meshObject.matrixWorld, bigPlanes.planes, center, false);

        let targetPlane;
        const minSupportVolume = Math.min.apply(null, objPlanes.supportVolumes);
        // if has a direction without support, choose it
        if (minSupportVolume < 1) {
            const idx = objPlanes.supportVolumes.findIndex((i) => i === minSupportVolume);
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
            const idx = rates.findIndex((r) => r === maxRate);
            targetPlane = bigPlanes.planes[idx];
        }
        // WARNING: applyQuternion DONT update Matrix...
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(targetPlane.normal, xyPlaneNormal));
        this.meshObject.updateMatrix();

        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    /**
     * Experimental
     * @returns void
     */
    public rotateByPlane(targetPlane: THREE.Plane) {
        const xyPlaneNormal = new THREE.Vector3(0, 0, -1);
        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        this.meshObject.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(targetPlane.normal, xyPlaneNormal));
        this.meshObject.updateMatrix();

        this.stickToPlate();
        this.onTransform();
        revertParent();
    }

    /**
     * Experimental
     * @returns void
     */
    public computeConvex() {
        const bufferGeometry = this.mergeGeometriesInGroup();
        const positions = bufferGeometry.getAttribute('position').array;
        // Calculate convex of model
        const vertices: THREE.Vector3[] = [];
        for (let i = 0; i < positions.length; i += 3) {
            vertices.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
        }
        const convexGeometry = new ConvexGeometry(vertices);
        this.setConvexGeometry(convexGeometry);
    }

    // autoMarkSupportArea(): void {}

    public getSerializableConfig(): ModelInfo {
        const {
            modelID, limitSize, headType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, mode,
            transformation, processImageName, visible, extruderConfig, modelName
        } = this;
        const children = this.children.map((model) => {
            const serializableConfig: ModelInfo = model.getSerializableConfig();
            serializableConfig.parentModelID = modelID;
            return serializableConfig;
        });

        return {
            modelID,
            limitSize,
            headType,
            sourceType,
            sourceHeight,
            sourceWidth,
            originalName,
            uploadName,
            mode,
            visible,
            transformation,
            processImageName,
            extruderConfig,
            children,
            modelName
        };
    }

    public updateGroupExtruder() {
        if (this.children.length === 0) {
            return;
        }

        this.isColored = false;
        this.extruderConfig.shell = this.children[0].extruderConfig.shell;
        this.extruderConfig.infill = this.children[0].extruderConfig.infill;

        for (const childModel of this.children) {
            // Update isColored
            if (childModel.isColored) {
                this.isColored = true;
            }

            // Update extruder config
            if (this.extruderConfig.shell !== childModel.extruderConfig.shell) {
                this.extruderConfig.shell = BOTH_EXTRUDER_MAP_NUMBER;
            }
            if (this.extruderConfig.infill !== childModel.extruderConfig.infill) {
                this.extruderConfig.infill = BOTH_EXTRUDER_MAP_NUMBER;
            }
        }
    }
}
