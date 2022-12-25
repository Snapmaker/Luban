import PresetDefinitionModel from '../flux/manager/PresetDefinitionModel';
import scene, { SceneEvent } from './Scene';
import { Model3D } from '../models/ModelGroup';
import { Size2D } from '../models/BaseModel';


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

        scene.on(SceneEvent.BuildVolumeChanged, () => {
            this._processPrimeTower();
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

        this._computePrimeTowerPosition();
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
            console.log('h =', estimatedHeight);
            primeTowerModel.setHeight(estimatedHeight);
        }
    }

    private _computePrimeTowerPosition(): void {
        const modelGroup = scene.getModelGroup();
        const primeTowerModel = modelGroup.getPrimeTower();

        // Get build volume
        const buildVolume = scene.getBuildVolume();
        const size: Size2D = buildVolume.getSize();
        const stopArea = buildVolume.getStopArea();

        console.log('_computePrimeTowerPosition', size, stopArea);

        // Find a proper position to place it
        // TODO: refactor this soon
        primeTowerModel.updateHeight(1, {
            positionX: size.x / 2 - stopArea.right - 15,
            positionY: size.y / 2 - stopArea.back - 15,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
        });
        primeTowerModel.computeBoundingBox();
        primeTowerModel.overstepped = false;
        primeTowerModel.setSelected(false);
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
