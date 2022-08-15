import * as THREE from 'three';
import ThreeModel from './ThreeModel';
import type ModelGroup from './ModelGroup';
import { ModelInfo, ModelTransformation, TSize } from './ThreeBaseModel';

class PrimeTowerModel extends ThreeModel {
    public constructor(initHeight: number, modelGroup: ModelGroup, transformation: ModelTransformation = { positionX: 100, positionY: 100 }) {
        const geometry = new THREE.CylinderBufferGeometry(10, 10, 1, 60);
        const material = new THREE.MeshPhongMaterial({
            side: THREE.DoubleSide,
            color: 0xB9BCBF
        }) as unknown as THREE.MeshStandardMaterial;
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
            mode: '3d',
            geometry,
            material,
            headType: 'printing',
            sourceHeight: 0,
            sourceWidth: 0,
            type: 'primeTower'
        };

        super(modelInfo, modelGroup);

        const positionX = transformation?.positionX || Math.max(modelGroup._bbox.max.x - 50, modelGroup._bbox.min.x - 50);
        const positionY = transformation?.positionY || Math.max(modelGroup._bbox.max.y - 50, modelGroup._bbox.min.y - 50);
        const scaleX = transformation?.scaleX || 1;
        const scaleY = transformation?.scaleY || 1;
        this.updateTransformation({
            positionX,
            positionY,
            scaleX,
            scaleY,
            scaleZ: initHeight,
            uniformScalingState: false
        });
        this.stickToPlate();

        const stencilGroup = this.createPlaneStencilGroup(geometry);
        this.meshObject.add(stencilGroup);
    }


    public updateHeight(height: number, transformation: ModelTransformation = this.transformation) {
        const positionX = transformation?.positionX;
        const positionY = transformation?.positionY;
        const scaleX = transformation?.scaleX;
        const scaleY = transformation?.scaleY;
        this.updateTransformation({
            positionX,
            positionY,
            scaleX,
            scaleY,
            scaleZ: height
        });
    }

    public resetPosition(size: TSize, stopArea) {
        this.updateHeight(0, {
            positionX: size.x / 2 - stopArea.right - 15,
            positionY: size.y / 2 - stopArea.back - 15,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 0
        });
        this.overstepped = false;
        this.setSelected(false);
    }
}

export default PrimeTowerModel;
