import * as THREE from 'three';
import { v4 as uuid } from 'uuid';
import EventEmitter from 'events';
import { HEAD_PRINTING } from '../constants';
import { SvgModelElement } from './BaseModel';
import type ModelGroup from './ModelGroup';
import ThreeGroup from './ThreeGroup';
import { TDisplayedType } from './ModelGroup';
import ThreeUtils from '../scene/three-extensions/ThreeUtils';
import workerManager from '../lib/manager/workerManager';
/* eslint-disable-next-line */
const { Transfer } = require('threads');

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
    infill: '0' | '1' | 'mixed',
    shell: '0' | '1' | 'mixed',
};

export type ModelLoadedInGroup = {
    positions: Float32Array;
    meshName?: string;
    matrix?: number[];
}

export type ModelInfo = {
    modelID?: string,
    parentModelID?: string,
    parentUploadName?: string,
    limitSize?: TSize,
    headType?: typeof HEAD_PRINTING,
    sourceType?: '3d',
    sourceHeight?: number,
    sourceWidth?: number,
    originalName?: string,
    uploadName?: string,
    modelName?: string,
    config?: {
        [key: string]: number | boolean | string
    },
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
    positionsArr?: {
        children: Array<ModelLoadedInGroup>;
        matrix?: number[];
    },
    baseName?: string
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
export default class BaseModel extends EventEmitter {
    public headType: typeof HEAD_PRINTING = HEAD_PRINTING;
    public sourceType: '3d' = '3d';

    public modelID: string;
    public originModelID: string;
    public modelName: string;
    public baseName: string;
    public sourceHeight: number;
    public sourceWidth: number;
    public originalName: string;
    public originalPosition: TSize;
    public uploadName: string;
    public meshObject: (THREE.Mesh | THREE.Group) & {
        uniformScalingState?: boolean
    };

    public parent: ThreeGroup;
    public overstepped: boolean;

    public estimatedTime = 0;

    public transformation: ModelTransformation;
    public boundingBox: THREE.Box3;
    public limitSize: TSize;
    public isSelected = false;

    public modelGroup: ModelGroup;
    public type: string;
    public needRepair: boolean;

    public extruderConfig: ExtruderConfig;

    public mode: '3d';

    protected displayedType: TDisplayedType = 'model';

    protected gcodeModeMaterial: THREE.MeshLambertMaterial;
    public parentUploadName?: string;

    protected modelModeMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, visible: false });

    public constructor(modelInfo: ModelInfo, modelGroup: ModelGroup) {
        super();
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

    public rotateModelByZaxis(angle = 0) {
        const unitZ = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromAxisAngle(unitZ, angle * Math.PI / 180);
        this.meshObject.applyQuaternion(quaternion);
    }

    public updateDisplayedType(value: TDisplayedType) {
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


    public async analyzeRotation() {
        return new Promise((resolve, reject) => {
            if (this.sourceType !== '3d') {
                resolve(null);
            }
            const selectedModelInfo = [],
                positionAttribute = [],
                normalAttribute = [];
            const revertParentArr = [];
            let geometry = null;
            if (this instanceof ThreeGroup) {
                this.computeConvex && this.computeConvex();
                geometry = this.mergedGeometry;
            } else {
                geometry = this.meshObject.geometry;
            }
            const revertParent = ThreeUtils.removeObjectParent(
                this.meshObject
            );
            revertParentArr.push(revertParent);
            this.meshObject.updateMatrixWorld();
            geometry.computeBoundingBox();
            const inverseNormal = this.transformation.scaleX / Math.abs(this.transformation.scaleX) < 0;

            const modelItemInfo = {
                matrixWorld: this.meshObject.matrixWorld,
                convexGeometry: this.convexGeometry,
                inverseNormal
            };
            selectedModelInfo.push(modelItemInfo);
            positionAttribute.push(geometry.getAttribute('position'));
            normalAttribute.push(geometry.getAttribute('normal'));

            workerManager.autoRotateModels(
                {
                    selectedModelInfo,
                    positionAttribute: Transfer(positionAttribute),
                    normalAttribute: Transfer(normalAttribute)
                },
                payload => {
                    const { status, value } = payload;
                    switch (status) {
                        case 'PARTIAL_SUCCESS': {
                            const { index } = value;
                            const { planes } = value;
                            value.planes = planes.map(({ normal, constant }) => {
                                return new THREE.Plane(new THREE.Vector3(normal.x, normal.y, normal.z), constant);
                            });
                            const revertParentFunc = revertParentArr[index];
                            revertParentFunc && revertParentFunc();
                            resolve(value);
                            break;
                        }
                        case 'ERROR': {
                            reject();
                            break;
                        }
                        default:
                            break;
                    }
                }
            );
        });
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
