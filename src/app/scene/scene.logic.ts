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
            this._processPrimeTower();
        });
        scene.on(SceneEvent.MeshPositionChanged, () => {
            this._computePrimeTowerHeight();
        });

        scene.on(SceneEvent.ModelAttributesChanged, (attributeName) => {
            if (attributeName === 'extruderConfig') {
                this._processPrimeTower();
            }
        });
    }

    private _processPrimeTower(): void {
        const modelGroup = scene.getModelGroup();
        const primeTower = modelGroup.getPrimeTower();

        // count extruders actually used
        const extrudersUsed = new Set();
        const models = modelGroup.getModels<Model3D>();
        for (const model of models) {
            extrudersUsed.add(model.extruderConfig.infill);
            extrudersUsed.add(model.extruderConfig.shell);
        }

        // calculate the visibility of prime tower
        // 1. Dual extruder
        // 2. At least extruders are actually used
        if (this.primeTowerEnabled && extrudersUsed.size > 1) {
            primeTower.visible = this.primeTowerEnabled;
        } else {
            primeTower.visible = false;
        }

        this._computePrimeTowerHeight();
    }

    private _computePrimeTowerHeight(): void {
        const modelGroup = scene.getModelGroup();
        const primeTowerModel = modelGroup.getPrimeTower();

        if (!primeTowerModel.visible) {
            return;
        }

        // max height of extruders
        const maxHeights: { [extruderNumber: string]: number } = {};
        const models = modelGroup.getModels<Model3D>();

        for (const model of models) {
            const h = model.boundingBox.max.z;

            const modelExtruders = new Set([model.extruderConfig.infill, model.extruderConfig.shell]);
            for (const extruderNumber of modelExtruders) {
                maxHeights[extruderNumber] = maxHeights[extruderNumber] || 0;
                maxHeights[extruderNumber] = Math.max(maxHeights[extruderNumber], h);
            }
        }

        if (Object.keys(maxHeights).length < 2) {
            return;
        }

        const estimatedHeight = Math.min(...Object.values(maxHeights)); // we assume that there are exactly 2 heights
        if (estimatedHeight !== primeTowerModel.getHeight()) {
            primeTowerModel.setHeight(estimatedHeight);

            primeTowerModel.updateTransformation({
                scaleZ: estimatedHeight,
            });
            primeTowerModel.stickToPlate();
        }
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

            this._processPrimeTower();
        }
    }
}

const sceneLogic = new SceneLogic();

export default sceneLogic;
