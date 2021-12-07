import * as THREE from 'three';
import BaseModel, { ModelTransformation, ModelInfo } from './ThreeBaseModel.ts';
import type ModelGroup from './ModelGroup';
import ThreeModel from './ThreeModel';
import ThreeUtils from '../three-extensions/ThreeUtils';
import { HEAD_PRINTING } from '../constants';
import ConvexGeometry from '../three-extensions/ConvexGeometry';

window.THREE = THREE;
require('three/examples/js/utils/BufferGeometryUtils');

export default class ThreeGroup extends BaseModel {
    estimatedTime: number = 0;

    image3dObj: Object;

    processObject3D: Object;

    modelObject3D: Object;

    processImageName: string;

    transformation: ModelTransformation;

    geometry: THREE.Group;

    meshObject: THREE.Object3D;

    children: Array<ThreeModel | ThreeGroup>;

    boundingBox: THREE.Box3;

    overstepped: boolean;

    convexGeometry: THREE.Geometry;

    modelGroup: ModelGroup;

    lastToolPathStr: string;

    isToolPath: boolean;

    sourceType: string = '3d';

    modelName: string;

    supportTag: boolean;

    isSelected: boolean = false;

    limitSize: Object;

    headType: string = HEAD_PRINTING;

    sourceHeight: number;

    sourceWidth: number;

    originalName: string;

    uploadName: string;

    extruderConfig: Object = {
        infill: '0',
        shell: '0',
        // adhesion: '0',
        // support: '0'
    };

    config: Object;

    mode: string;

    parent: ThreeGroup;

    constructor(modelInfo: ModelInfo, modelGroup: ModelGroup) {
        super(modelInfo, modelGroup);
        this.meshObject = new THREE.Group();
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
    }

    add(models: Array<ThreeModel | ThreeGroup>) {
        this.children = [...this.children, ...models];

        models.forEach(model => {
            this.meshObject.add(model.meshObject);
            model.parent = this;
        });
        if (models.length === 1) {
            ThreeUtils.liftObjectOnlyChildMatrix(this.meshObject);
            (this.meshObject as any).uniformScalingState = (this.meshObject.children[0] as any).uniformScalingState;
        } else if (models.length > 1) {
            let p;
            const boundingBoxTemp = ThreeUtils.computeBoundingBox(this.meshObject);
            if (this.meshObject.children.length >= 1) {
                p = new THREE.Vector3(
                    (boundingBoxTemp.max.x + boundingBoxTemp.min.x) / 2,
                    (boundingBoxTemp.max.y + boundingBoxTemp.min.y) / 2,
                    boundingBoxTemp.max.z / 2
                );
            } else {
                p = new THREE.Vector3(
                    0,
                    0,
                    0
                );
            }
            // set selected group position need to remove children temporarily
            const children = [...this.meshObject.children];
            children.map(obj => ThreeUtils.removeObjectParent(obj));
            // only make the diff translation
            const oldPosition = new THREE.Vector3();
            this.meshObject.getWorldPosition(oldPosition);
            const matrix = new THREE.Matrix4().makeTranslation(p.x - oldPosition.x, p.y - oldPosition.y, p.z - oldPosition.z);
            ThreeUtils.applyObjectMatrix(this.meshObject, matrix);
            children.map(obj => ThreeUtils.setObjectParent(obj, this.meshObject));
            (this.meshObject as any).uniformScalingState = true;
        }
    }

    destroy(): ThreeModel[] {
        ThreeUtils.applyObjectMatrix(this.meshObject, new THREE.Matrix4().copy(this.meshObject.matrix).invert());
        // apply group transformation to children
        const models = [];
        // this.meshObject.updateMatrixWorld();
        this.children.forEach(model => {
            model.parent = null;
            // model.meshObject.applyMatrix4(this.meshObject.matrixWorld);
            if (model instanceof ThreeGroup) {
                const children = model.destroy();
                models.push(...children);
            } else {
                ThreeUtils.setObjectParent(model.meshObject, this.meshObject.parent);
                models.push(model);
            }
        });
        this.meshObject.children = [];
        this.children = [];
        return models;
    }

    /**
     * Experimental
     * @returns THREE.BufferGeometry
     */
    mergeGeometriesInGroup(): THREE.BufferGeometry {
        let geometry = new THREE.BufferGeometry();
        if (this.children.length > 0) {
            geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(this.children.map(model => {
                if (model.meshObject instanceof THREE.Group) {
                    return (model as ThreeGroup).mergeGeometriesInGroup();
                } else {
                    model.meshObject.updateMatrixWorld();
                    const clonedGeometry = (model.meshObject as THREE.Mesh).geometry.clone() as THREE.BufferGeometry;
                    clonedGeometry.applyMatrix4(model.meshObject.matrixWorld);
                    return clonedGeometry;
                }
            }));
        }
        return geometry;
    }

    isMeshInGroup(mesh: THREE.Mesh) {
        return this.children.some(model => {
            if (model instanceof ThreeGroup) {
                return model.isMeshInGroup(mesh);
            }
            return model.meshObject === mesh;
        });
    }

    get visible() {
        return this.meshObject.visible;
    }

    set visible(value: boolean) {
        this.meshObject.visible = value;
    }

    /**
     * Experimental
     * @returns ModelTransformation
     */
    onTransform() {
        const geometrySize = ThreeUtils.getGeometrySize(this.mergeGeometriesInGroup(), true);
        const { uniformScalingState } = this.meshObject as any;

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
            width: geometrySize.x * scale.x,
            height: geometrySize.y * scale.y,
            uniformScalingState
        };

        this.transformation = {
            ...this.transformation,
            ...transformation
        };

        this.children.forEach(model => model.onTransform());

        return this.transformation;
    }

    updateTransformation(transformation: ModelTransformation): ModelTransformation {
        super.updateTransformation(transformation);
        return this.transformation;
    }

    computeBoundingBox() {
        this.boundingBox = ThreeUtils.computeBoundingBox(this.meshObject);
    }

    setConvexGeometry(convexGeometry: THREE.BufferGeometry | THREE.Geometry) {
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
        this.meshObject.position.z -= this.boundingBox.min.z;
        this.computeBoundingBox(); // update boundingbox after position changed
        this.onTransform();
        revert();
    }

    setMatrix(matrix: THREE.Matrix4) {
        this.meshObject.updateMatrix();
        this.meshObject.applyMatrix4(this.meshObject.matrix.clone().invert());
        this.meshObject.applyMatrix4(matrix);
    }

    setOversteppedAndSelected(overstepped: boolean, isSelected: boolean) {
        this.overstepped = overstepped;
        this.children.forEach(model => {
            model.overstepped = overstepped;
        });
        this.setSelected(isSelected);
    }

    setSelected(isSelected?: boolean) {
        if (typeof isSelected === 'boolean') {
            this.isSelected = isSelected;
        }
        this.children.forEach(model => {
            model.setSelected(isSelected);
        });
    }

    clone(modelGroup: ModelGroup) {
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
            config: this.config,
            mode: this.mode,
            // visible: this.visible,
            transformation: this.transformation,
            processImageName: this.processImageName,
            supportTag: this.supportTag
        };
        this.children.forEach(model => {
            clonedSubModels.push(model.clone(modelGroup));
        });
        const clone = new ThreeGroup(modelInfo, modelGroup);
        clone.add(clonedSubModels);
        clone.isSelected = true;
        return clone;
    }

    /**
     * Experimental
     * @returns void
     */
    autoRotate() {
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return;
        }

        const revertParent = ThreeUtils.removeObjectParent(this.meshObject);
        this.meshObject.updateMatrixWorld();
        this.computeBoundingBox();
        const box3 = this.boundingBox;
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
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.mergeGeometriesInGroup(), this.meshObject.matrixWorld, bigPlanes.planes, center, false);

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

    /**
     * Experimental
     * @returns void
     */
    rotateByPlane(targetPlane: THREE.Plane) {
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
    computeConvex() {
        const bufferGeometry = this.mergeGeometriesInGroup();
        const positions = bufferGeometry.getAttribute('position').array;
        // Calculate convex of model
        const vertices = [];
        for (let i = 0; i < positions.length; i += 3) {
            vertices.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
        }
        const convexGeometry = new ConvexGeometry(vertices);

        this.setConvexGeometry(convexGeometry as unknown as THREE.Geometry);
    }

    /**
     * Experimental
     * @returns Object
     */
    analyzeRotation() {
        if (this.sourceType !== '3d' || !this.convexGeometry) {
            return null;
        }
        this.computeBoundingBox();
        const box3 = this.boundingBox;
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
        const objPlanes = ThreeUtils.computeGeometryPlanes(this.mergeGeometriesInGroup(), this.meshObject.matrixWorld, bigPlanes.planes, center, false);
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

    /**
     * Experimental
     * @returns void
     */
    setSupportPosition(position: THREE.Vector3) {
        const object = this.meshObject;
        object.position.copy(position);
        object.updateMatrix();
        this.generateSupportGeometry();
    }

    /**
     * Experimental
     * @returns void
     */
    generateSupportGeometry() {}

    /**
     * Experimental
     * @returns void
     */
    setVertexColors() {
        this.meshObject.updateMatrixWorld();
        const bufferGeometry = this.mergeGeometriesInGroup();
        const clone = bufferGeometry.clone();
        clone.applyMatrix4(this.meshObject.matrixWorld.clone());

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
                bufferGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                this.setSelected(true);
                this.modelGroup.modelChanged();
            }
        };

        setTimeout(worker, 10);
    }

    /**
     * Experimental
     * @returns void
     */
    removeVertexColors() {
        const bufferGeometry = this.mergeGeometriesInGroup();
        bufferGeometry.deleteAttribute('color');
        this.setSelected();
        this.modelGroup && this.modelGroup.modelChanged();
    }

    cloneMeshWithoutSupports(): THREE.Object3D {
        const clonedGroup = this.meshObject.clone();
        this.children.forEach(model => {
            const mesh: THREE.Mesh = model.cloneMeshWithoutSupports() as unknown as THREE.Mesh;
            clonedGroup.add(mesh);
        });
        return clonedGroup;
    }

    getSerializableConfig(): ModelInfo {
        const {
            modelID, limitSize, headType, sourceType, sourceHeight, sourceWidth, originalName, uploadName, config, mode,
            transformation, processImageName, supportTag, visible, extruderConfig, modelName
        } = this;
        const children = this.children.map(model => {
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
            config,
            mode,
            visible,
            transformation,
            processImageName,
            supportTag,
            extruderConfig,
            children,
            modelName
        };
    }
}
