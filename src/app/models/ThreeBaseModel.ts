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
    groupFrom?: string,
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

    constructor(modelInfo, modelGroup) {
        this.modelGroup = modelGroup;

        // eslint-disable-next-line no-return-assign
        Object.keys(modelInfo).map(key => this[key] = modelInfo[key]);

        this.modelID = this.modelID || `id${uuid()}`;
        this.modelName = this.modelName ?? 'unnamed';
        this.transformation = { ...DEFAULT_TRANSFORMATION, ...this.transformation };
        this.type = modelInfo.type || 'baseModel';
    }

    updateTransformation(transformation: ModelTransformation): ModelTransformation {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;
        const { width, height } = transformation;

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
        // width & height dont effected on meshobject any more
        if (width) {
            this.transformation.width = width;
        }
        if (height) {
            this.transformation.height = height;
        }
        this.transformation = { ...this.transformation };
        return this.transformation;
    }
}
