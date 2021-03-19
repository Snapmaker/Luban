import uuid from 'uuid';

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
    uniformScalingState: true
};

// BaseModel only do data process
// isolated from Model.js which renamed to ThreeModel.js
class BaseModel {
    visible = true;

    constructor(modelInfo, modelGroup) {
        this.modelGroup = modelGroup;

        // eslint-disable-next-line no-return-assign
        Object.keys(modelInfo).map(key => this[key] = modelInfo[key]);

        this.modelID = this.modelID || `id${uuid.v4()}`;
        this.modelName = this.modelName ?? 'unnamed';
        this.transformation = { ...DEFAULT_TRANSFORMATION, ...this.transformation };
    }

    updateTransformation(transformation) {
        const { positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, flip, uniformScalingState } = transformation;
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
        if (flip !== undefined) {
            this.transformation.flip = flip;
            if (this.modelObject3D) {
                if (flip === 0) {
                    this.modelObject3D.rotation.x = 0;
                    this.modelObject3D.rotation.y = 0;
                }
                if (flip === 1) {
                    this.modelObject3D.rotation.x = Math.PI;
                    this.modelObject3D.rotation.y = 0;
                }
                if (flip === 2) {
                    this.modelObject3D.rotation.x = 0;
                    this.modelObject3D.rotation.y = Math.PI;
                }
                if (flip === 3) {
                    this.modelObject3D.rotation.x = Math.PI;
                    this.modelObject3D.rotation.y = Math.PI;
                }
            }
            if (this.processObject3D) {
                if (flip === 0) {
                    this.processObject3D.rotation.x = 0;
                    this.processObject3D.rotation.y = 0;
                }
                if (flip === 1) {
                    this.processObject3D.rotation.x = Math.PI;
                    this.processObject3D.rotation.y = 0;
                }
                if (flip === 2) {
                    this.processObject3D.rotation.x = 0;
                    this.processObject3D.rotation.y = Math.PI;
                }
                if (flip === 3) {
                    this.processObject3D.rotation.x = Math.PI;
                    this.processObject3D.rotation.y = Math.PI;
                }
            }
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

export default BaseModel;
