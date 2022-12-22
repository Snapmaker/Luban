import PresetDefinitionModel from '../flux/manager/PresetDefinitionModel';
import scene, { SceneEvent } from './Scene';
import { Model3D } from '../models/ModelGroup';


export declare interface PrimeTowerSettings {
    enabled: boolean;
    size?: number;
    positionX?: number;
    positionY?: number;
}


class SceneLogic {
    private primeTowerEnabled: boolean = false;

    public constructor() {
        scene.on(SceneEvent.MeshChanged, () => {
            this._computePrimeTowerHeight();
        });
        scene.on(SceneEvent.MeshPositionChanged, () => {
            this._computePrimeTowerHeight();
        });
    }

    private _recalculatePrimeTower(): void {
        const modelGroup = scene.getModelGroup();
        const primeTower = modelGroup.getPrimeTower();

        // calculate the visibility of prime tower
        // 1. Dual extruder
        // 2. At least extruders are actually used
        primeTower.visible = this.primeTowerEnabled;

        this._computePrimeTowerHeight();
    }

    private _computePrimeTowerHeight(): void {
        const modelGroup = scene.getModelGroup();
        const primeTowerModel = modelGroup.getPrimeTower();

        if (!primeTowerModel.visible) {
            return;
        }

        // min height of max extruder height
        let maxHeight = 0.1;
        modelGroup.getModels<Model3D>().forEach((modelItem) => {
            const modelItemHeight = modelItem.boundingBox?.max.z - modelItem.boundingBox?.min.z;
            maxHeight = Math.max(maxHeight, modelItemHeight);
        });
        const height = maxHeight;

        if (height !== primeTowerModel.getHeight()) {
            primeTowerModel.setHeight(height);

            primeTowerModel.updateTransformation({
                scaleZ: height
            });
            primeTowerModel.stickToPlate();
        }

        console.log('_computePrimeTowerHeight, height =', maxHeight);
        // this.primeTowerModel.
    }

    /**
     * Preset changed, or parameter changed.
     *
     * @param preset - the global / left extruder preset.
     */
    public onPresetParameterChanged(preset: PresetDefinitionModel) {
        const settings = preset.settings;

        // prime tower logic
        const primeTowerEnabled = settings.prime_tower_enable?.default_value || false;
        if (primeTowerEnabled !== this.primeTowerEnabled) {
            this.primeTowerEnabled = primeTowerEnabled;

            this._recalculatePrimeTower();
        }
    }
}

const sceneLogic = new SceneLogic();

export default sceneLogic;
