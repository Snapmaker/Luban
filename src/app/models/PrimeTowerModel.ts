import * as THREE from 'three';
import ThreeModel from './ThreeModel';
import type ModelGroup from './ModelGroup';
import { ModelInfo } from './ThreeBaseModel.ts';

class PrimeTowerModel extends ThreeModel {
    // meshObject: THREE.Object3D;

    constructor(initHeight: Number, modelGroup: ModelGroup) {
        const geometry = new THREE.CylinderBufferGeometry(10, 10, 1, 60);
        const material = new THREE.MeshPhongMaterial({
            side: THREE.DoubleSide,
            color: 0xB9BCBF
        });
        geometry.rotateX(Math.PI / 2);
        const originalName = `prime_tower_${(Math.random() * 1000).toFixed(0)}`;
        const modelName = modelGroup._createNewModelName({
            sourceType: '3d',
            originalName: originalName
        });
        const modelInfo: ModelInfo = {
            sourceType: '3d',
            originalName,
            uploadName: `${originalName}.stl`,
            modelName,
            mode: 'translate',
            geometry,
            material,
            headType: 'printing'
        };

        super(modelInfo, modelGroup);
        this.primeTowerTag = true;
        this.updateTransformation({
            positionX: Math.max(modelGroup._bbox.max.x - 50, modelGroup._bbox.min.x - 50),
            positionY: Math.max(modelGroup._bbox.max.y - 50, modelGroup._bbox.min.y - 50),
            scaleZ: initHeight,
            uniformScalingState: false
        });
        this.stickToPlate();
        // model.computeBoundingBox();
        modelGroup.models = [this, ...modelGroup.models];
        modelGroup.object.add(this.meshObject);
    }
}

export default PrimeTowerModel;
