import * as THREE from 'three';
import { Box2, Mesh, Object3D } from 'three';
import { v4 as uuid } from 'uuid';
import {
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_HALFTONE,
    PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR
} from '../../server/constants';
import { HEAD_CNC, HEAD_LASER, SOURCE_TYPE } from '../constants';
import ModelGroup from './ModelGroup';

export interface ModelTransformation {
    positionX: number,
    positionY: number,
    positionZ: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    uniformScalingState: boolean,
    width?: number;
    height?: number;
}

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
    uniformScalingState: true
};

export interface Size2D {
    x: number;
    y: number;
}

export type TSize = {
    x: number;
    y: number;
    z: number;
};

export type SvgModelElement = SVGRectElement | SVGCircleElement | SVGPathElement | SVGImageElement;

export type TMode = typeof PROCESS_MODE_BW
    | typeof PROCESS_MODE_HALFTONE
    | typeof PROCESS_MODE_VECTOR
    | typeof PROCESS_MODE_GREYSCALE
    | typeof PROCESS_MODE_MESH

export type ModelInfo = {
    modelID?: string,
    parentModelID?: string,
    limitSize?: number,
    headType?: typeof HEAD_LASER | typeof HEAD_CNC,
    sourceType: 'svg' | 'image3d' | 'raster' | 'dxf' | '3d',
    sourceHeight?: number,
    sourceWidth?: number,
    originalName?: string,
    uploadName?: string,
    modelName?: string,
    config?: {
        greyscaleAlgorithm: string;
        algorithm: string;
        brightness: number;
        bwThreshold: number;
        contrast: number;
        whiteClip: number;
        invert: boolean
        svgNodeName: string;
    },
    mode: TMode,
    visible?: boolean,
    transformation?: ModelTransformation,
    processImageName?: string,
    type?: string,
    convexGeometry?: THREE.BufferGeometry,
    loadFrom?: 0 | 1,
    color?: string;
    width?: number;
    height?: number;
    elem: SvgModelElement;
    size: TSize,
    reloadSimplifyModel?: boolean,
    baseName?: string
};


// BaseModel only do data process
// isolated from Model.js which renamed to ThreeModel.js
abstract class BaseModel {
    public headType: typeof HEAD_LASER | typeof HEAD_CNC;

    public modelGroup: ModelGroup = null;

    public modelID = '';
    public originModelID = '';
    public originalName: string;
    public modelName = '';
    public baseName: string;
    public uploadImageName = '';
    public sourceType: SOURCE_TYPE;
    public sourceHeight: number;
    public sourceWidth: number;
    public processObject3D?: Object3D;
    public modelObject3D?: Object3D;
    public meshObject: THREE.Mesh & { uniformScalingState?: boolean };
    public parent: SVGGElement;

    public mode: TMode;

    public width: number;
    public height: number;
    public elem: SvgModelElement;
    public size: TSize;
    public transformation: ModelTransformation = DEFAULT_TRANSFORMATION;
    public visible = true;

    public boundingBox: Box2;
    public limitSize: number;

    public config: Record<string, string | number | boolean> = {};
    public needRepair: boolean;

    /**
     * for cnc model visualizer
     */
    public image3dObj: Mesh;
    public scale: number;

    public constructor(modelInfo: ModelInfo, modelGroup: ModelGroup) {
        this.modelGroup = modelGroup;

        Object.keys(modelInfo).forEach((key) => {
            this[key] = modelInfo[key];
        });

        this.modelID = this.modelID || `id${uuid()}`;
        this.modelName = this.modelName || 'unnamed';
        this.transformation = { ...DEFAULT_TRANSFORMATION, ...this.transformation };
    }

    public updateTransformation(transformation: Partial<ModelTransformation>) {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, uniformScalingState } = transformation;
        const { width, height } = transformation;

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

export default BaseModel;
