import * as THREE from 'three';
import { v4 as uuid } from 'uuid';
import { HEAD_PRINTING } from '../constants';
import { SvgModelElement } from './BaseModel';
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

export type TSize = {
    x: number;
    y: number;
    z: number;
}

export type ExtruderConfig = {
    infill: '0' | '1' | '2',
    shell: '0' | '1' | '2',
};

export type ModelInfo = {
    modelID?: string,
    parentModelID?: string,
    limitSize?: Object,
    headType?: typeof HEAD_PRINTING,
    sourceType?: '3d',
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
    extruderConfig?: ExtruderConfig,
    children?: Array<ModelInfo>
    geometry?: THREE.BufferGeometry,
    material?: THREE.MeshStandardMaterial,
    type?: string,
    convexGeometry?: THREE.BufferGeometry,
    loadFrom?: 0 | 1,
    color?: string;
    width?: number;
    height?: number;
    isGroup?: boolean;
    // svg
    elem?: SvgModelElement;
    size?: TSize;
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
    public headType: typeof HEAD_PRINTING = HEAD_PRINTING;
    public sourceType: '3d' = '3d';

    public modelID: string;
    public originModelID: string;
    public modelName: string;
    public sourceHeight: number;
    public sourceWidth: number;
    public originalName: string;
    public uploadName: string;
    public meshObject: (THREE.Mesh | THREE.Group) & {
        uniformScalingState?: boolean
    };

    public parent: ThreeGroup;
    public overstepped: boolean;

    public estimatedTime: number = 0

    public transformation: ModelTransformation;
    public boundingBox: THREE.Box3;
    public limitSize: number; // TODO ts remove?
    public isSelected: boolean = false;

    public modelGroup: ModelGroup;
    public type: string;

    public extruderConfig: ExtruderConfig;

    public mode: '3d';

    protected displayedType: string = 'model';

    protected gcodeModeMaterial: THREE.MeshLambertMaterial;

    protected modelModeMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, visible: false });

    public constructor(modelInfo: ModelInfo, modelGroup: ModelGroup) {
        this.modelGroup = modelGroup;

        Object.keys(modelInfo).forEach((key) => {
            this[key] = modelInfo[key];
        });

        if (!this.extruderConfig) {
            this.extruderConfig = {
                infill: '0',
                shell: '0'
            };
        }

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

    public rotateModelByZaxis(angle: number = 0) {
        const unitZ = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromAxisAngle(unitZ, angle * Math.PI / 180);
        this.meshObject.applyQuaternion(quaternion);
    }

    public updateDisplayedType(value: string) {
        this.displayedType = value;
        this.setSelectedGroup();
    }

    public updateTransformation(transformation: ModelTransformation): ModelTransformation {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;

        if (uniformScalingState !== undefined) {
            this.meshObject.uniformScalingState = uniformScalingState;
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

    private setSelectedGroup(isSelected?: boolean) {
        if (this.meshObject instanceof THREE.Mesh) {
            if (typeof isSelected === 'boolean') {
                this.isSelected = isSelected;
            }
            if (this.displayedType !== 'model') {
                this.meshObject.material = this.gcodeModeMaterial;
            } else {
                this.meshObject.material = this.modelModeMaterial;
                (this.meshObject.material as THREE.MeshStandardMaterial).color.set(new THREE.Color('#cecece'));
            }
        }
    }
}
