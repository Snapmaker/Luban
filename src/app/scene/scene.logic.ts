import { throttle } from 'lodash';
import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../constants';
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

    private supportEnabled: boolean = false;

    public constructor() {
        scene.on(SceneEvent.MeshChanged, () => {
            this.processPrimeTowerAsync();
        });
        scene.on(SceneEvent.MeshPositionChanged, () => {
            this._computePrimeTowerHeight();
        });

        scene.on(SceneEvent.ModelAttributesChanged, (attributeName) => {
            if (attributeName === 'extruderConfig') {
                this.processPrimeTowerAsync();
            }
        });

        scene.on(SceneEvent.BuildVolumeChanged, () => {
            this.processPrimeTowerAsync();
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

        const helpersExtruderConfig = modelGroup.getHelpersExtruderConfig();
        if (this.supportEnabled) {
            extrudersUsed.add(helpersExtruderConfig.support);
        }

        // calculate the visibility of prime tower
        // 1. Dual extruder
        // 2. At least extruders are actually used
        if (this.primeTowerEnabled && extrudersUsed.size > 1) {
            primeTower.visible = true;
            this._computePrimeTowerPosition();
            this._computePrimeTowerHeight();
        } else {
            primeTower.visible = false;
        }
    }

    private processPrimeTowerAsync = throttle(() => this._processPrimeTower(), 10, { trailing: true });

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

        const helpersExtruderConfig = modelGroup.getHelpersExtruderConfig();
        if (this.supportEnabled) {
            // max possible height: max model height
            const extruderNumber = helpersExtruderConfig.support;
            maxHeights[extruderNumber] = maxHeights[extruderNumber] || 0;
            maxHeights[extruderNumber] = Math.max(maxHeights[extruderNumber], ...Object.values(maxHeights));
        }

        if (Object.keys(maxHeights).length < 2) {
            return;
        }

        const estimatedHeight = Math.min(...Object.values(maxHeights)); // we assume that there are exactly 2 heights
        if (estimatedHeight !== primeTowerModel.getHeight()) {
            primeTowerModel.setHeight(estimatedHeight);
        }
    }

    /**
     * Find a proper position to place the prime tower.
     *
     * @private
     */
    private _computePrimeTowerPosition(): void {
        const modelGroup = scene.getModelGroup();
        const primeTowerModel = modelGroup.getPrimeTower();

        if (!primeTowerModel.visible) {
            return;
        }

        // Get build volume
        const buildVolume = scene.getBuildVolume();
        const size: Size2D = buildVolume.getSize();
        const stopArea = buildVolume.getStopArea();

        let primeTowerX;
        let primeTowerY;

        const boundingBox = modelGroup.getBoundingBox();
        const primeTowerSize = primeTowerModel.getSize();

        let placed = false;

        // Try place the prime tower on the back of models
        const guessY = boundingBox.max.y + 15 + primeTowerSize / 2;
        if (guessY + primeTowerSize / 2 + stopArea.back <= size.y / 2) {
            primeTowerX = (boundingBox.min.x + boundingBox.max.x) / 2;
            primeTowerY = guessY;
            placed = true;
        }

        // Try place the prime tower on the right of models
        if (!placed) {
            const guessX = boundingBox.max.x + 15 + primeTowerSize / 2;
            if (guessX + primeTowerSize / 2 + stopArea.right <= size.x / 2) {
                primeTowerX = guessX;
                primeTowerY = (boundingBox.min.y + boundingBox.max.y) / 2;
                placed = true;
            }
        }

        if (!placed) {
            // fall back to place on top right corner
            primeTowerX = size.x / 2 - stopArea.right - 15;
            primeTowerY = size.y / 2 - stopArea.back - 15;
        }

        // TODO: refactor this soon
        primeTowerModel.updateHeight(1, {
            positionX: primeTowerX,
            positionY: primeTowerY,
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
     * @param stackId - left / right extruder
     * @param preset - the global / left extruder preset.
     */
    public onPresetParameterChanged(stackId: string, preset: PresetDefinitionModel) {
        // prime tower logic
        if (stackId === LEFT_EXTRUDER) {
            const primeTowerEnabled = preset.settings.prime_tower_enable?.default_value || false;
            if (primeTowerEnabled !== this.primeTowerEnabled) {
                this.primeTowerEnabled = primeTowerEnabled;

                this.processPrimeTowerAsync();
            }
        }

        const modelGroup = scene.getModelGroup();
        const helpersExtruderConfig = modelGroup.getHelpersExtruderConfig();

        // support
        if (stackId === LEFT_EXTRUDER && helpersExtruderConfig.support === '0'
            || stackId === RIGHT_EXTRUDER && helpersExtruderConfig.support === '1') {
            const supportEnabled = preset.settings.support_enable?.default_value || false;

            if (supportEnabled !== this.supportEnabled) {
                this.supportEnabled = supportEnabled;
                this.processPrimeTowerAsync();
            }
        }
    }
}

const sceneLogic = new SceneLogic();

export default sceneLogic;
