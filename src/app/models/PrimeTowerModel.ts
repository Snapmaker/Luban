import * as THREE from 'three';

import ModelGroup from './ModelGroup';
import { ModelInfo, ModelTransformation } from './ThreeBaseModel';
import ThreeModel from './ThreeModel';

class PrimeTowerModel extends ThreeModel {
    private size: number;
    private height: number;

    public constructor(initHeight: number, modelGroup: ModelGroup, transformation: ModelTransformation = {
        positionX: 100,
        positionY: 100
    }) {
        const geometry = new THREE.CylinderBufferGeometry(10, 10, 1, 60);
        const material = new THREE.MeshPhongMaterial({
            side: THREE.DoubleSide,
            color: 0xB9BCBF
        }) as unknown as THREE.MeshStandardMaterial;
        geometry.rotateX(Math.PI / 2);
        const originalName = `prime_tower_${(Math.random() * 1000).toFixed(0)}`;
        const modelNameObj = modelGroup._createNewModelName({
            sourceType: '3d',
            originalName: originalName
        });
        const modelInfo: ModelInfo = {
            sourceType: '3d',
            originalName,
            uploadName: `${originalName}.stl`,
            modelName: modelNameObj.name,
            baseName: modelNameObj.baseName,
            mode: '3d',
            geometry,
            material,
            headType: 'printing',
            sourceHeight: 0,
            sourceWidth: 0,
            type: 'primeTower'
        };

        super(modelInfo, modelGroup);

        this.size = 20; // 20

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

    public getSize(): number {
        // note: scale x/y on prime tower are identical, scaleX == scaleY
        return this.size * this.transformation.scaleX;
    }

    public getHeight(): number {
        return this.height;
    }

    public setHeight(height: number): void {
        height = Math.max(0.01, height);
        this.height = height;

        this.updateTransformation({
            scaleZ: height,
        });

        this.stickToPlate();
    }

    public updateHeight(height: number, transformation: ModelTransformation = this.transformation) {
        const positionX = transformation?.positionX;
        const positionY = transformation?.positionY;
        const scaleX = transformation?.scaleX;
        const scaleY = transformation?.scaleY;

        height = Math.max(0.01, height);
        this.height = height;

        this.updateTransformation({
            positionX,
            positionY,
            scaleX,
            scaleY,
            scaleZ: height,
        });
        this.stickToPlate();
    }

    public updateTowerTransformation(transformation: ModelTransformation) {
        const positionX = transformation?.positionX || Math.max(this.modelGroup._bbox.max.x - 50, this.modelGroup._bbox.min.x - 50);
        const positionY = transformation?.positionY || Math.max(this.modelGroup._bbox.max.y - 50, this.modelGroup._bbox.min.y - 50);
        const scaleX = transformation?.scaleX || 1;
        const scaleY = transformation?.scaleY || 1;
        const initHeight = transformation?.scaleZ || 0.1;

        this.height = initHeight;

        this.updateTransformation({
            positionX,
            positionY,
            scaleX,
            scaleY,
            scaleZ: initHeight,
            uniformScalingState: false
        });
        this.stickToPlate();
    }
}

export default PrimeTowerModel;
