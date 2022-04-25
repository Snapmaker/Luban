import * as THREE from 'three';
import { v4 as uuid } from 'uuid';
import type ModelGroup from './ModelGroup';
import type ThreeGroup from './ThreeGroup';

export type ModelTransformation = {
    positionX?: number;
    positionY?: number;
    positionZ?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    uniformScalingState?: boolean;
    width?: number;
    height?: number;
};

export type ModelInfo = {
    modelID?: string,
    parentModelID?: string,
    limitSize?: Object,
    headType?: string,
    sourceType?: string,
    sourceHeight?: number,
    sourceWidth?: number,
    originalName?: string,
    uploadName?: string,
    modelName?: string,
    config?: Object,
    mode?: string,
    visible?: boolean,
    transformation?: ModelTransformation,
    processImageName?: string,
    supportTag?: boolean,
    extruderConfig?: any,
    children?: Array<ModelInfo>
    geometry?: THREE.BufferGeometry,
    material?: THREE.Material,
    type?: string
};

const DEFAULT_TRANSFORMATION: ModelTransformation = {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    uniformScalingState: true,
    width: 0,
    height: 0
};

// BaseModel only do data process
// isolated from Model.js which renamed to ThreeModel.js
export default class BaseModel {
    parent: ThreeGroup;

    modelGroup: ModelGroup;

    modelID: string;

    modelName: string;

    transformation: ModelTransformation;

    meshObject: THREE.Object3D;

    type: string;

    canAttachSupport: boolean = true; // PrimeTowerModel should set false

    displayedType: string = 'model';

    isSelected: boolean = false;

    gcodeModeMaterial: THREE.Material;

    modelModeMaterial: THREE.Material = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, visible: false });

    constructor(modelInfo, modelGroup) {
        this.modelGroup = modelGroup;

        // eslint-disable-next-line no-return-assign
        Object.keys(modelInfo).map(key => this[key] = modelInfo[key]);

        this.modelID = this.modelID || `id${uuid()}`;
        this.modelName = this.modelName ?? 'unnamed';
        this.transformation = { ...DEFAULT_TRANSFORMATION, ...this.transformation };
        this.type = modelInfo.type || 'baseModel';
        this.gcodeModeMaterial = new THREE.MeshLambertMaterial({
            color: '#2a2c2e',
            side: THREE.FrontSide,
            depthWrite: false,
            transparent: true,
            opacity: 0.3,
            polygonOffset: true,
            polygonOffsetFactor: -5,
            polygonOffsetUnits: -0.1
        });
    }

    updateTransformation(transformation: ModelTransformation): ModelTransformation {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;

        if (uniformScalingState !== undefined) {
            (this.meshObject as any).uniformScalingState = uniformScalingState;
            this.transformation.uniformScalingState = uniformScalingState;
        }

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
        this.transformation = { ...this.transformation };
        return this.transformation;
    }

    rotateModelByZaxis(angle = 0) {
        const unitZ = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromAxisAngle(unitZ, angle * Math.PI / 180);
        this.meshObject.applyQuaternion(quaternion);
    }

    updateDisplayedType(value) {
        this.displayedType = value;
        this.setSelectedGroup();
    }

    setSelectedGroup(isSelected?: boolean) {
        if (typeof isSelected === 'boolean') {
            this.isSelected = isSelected;
        }
        if (this.displayedType !== 'model') {
            (this.meshObject as any).material = this.gcodeModeMaterial;
        } else {
            (this.meshObject as any).material = this.modelModeMaterial;
            (this.meshObject as any).material.color.set(new THREE.Color('#cecece'));
        }
    }
}
