import type { Machine, ToolHead } from '@snapmaker/luban-platform';
import { throttle } from 'lodash';

import {
    BOTH_EXTRUDER_MAP_NUMBER,
    LEFT_EXTRUDER,
    LEFT_EXTRUDER_MAP_NUMBER,
    RIGHT_EXTRUDER,
    RIGHT_EXTRUDER_MAP_NUMBER
} from '../constants';
import { Size2D } from '../models/BaseModel';
import ThreeModel from '../models/ThreeModel';
import { PresetModel } from '../preset-model';
import scene, { SceneEvent } from './Scene';


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
            if (attributeName === 'color') {
                this.processPrimeTowerAsync();
            }
        });

        scene.on(SceneEvent.BuildVolumeChanged, () => {
            this.processPrimeTowerAsync();
        });
    }

    public onVisualizeInitialized(machine: Machine, toolHead: ToolHead): void {
        const toolHeadOptions = machine.metadata.toolHeads.find(opts => opts.identifier === toolHead.identifier);
        if (!toolHeadOptions) {
            return;
        }

        const size = machine.metadata.size;
        if (toolHeadOptions.workRange) {
            size.z = toolHeadOptions.workRange.max[2];
        }

        const buildVolume = scene.getBuildVolume();
        buildVolume.updateSize(
            machine.identifier,
            size,
            {},
        );
    }

    public canSplit(): boolean {
        const modelGroup = scene.getModelGroup();
        if (!modelGroup) {
            return false;
        }

        const selectedModels = modelGroup.selectedModelArray;
        if (selectedModels.length !== 1) return false;

        const targetModel = selectedModels[0];
        if (!targetModel.visible) return false;

        return true;
    }

    private _processPrimeTower(): void {
        const modelGroup = scene.getModelGroup();
        if (!modelGroup) {
            return;
        }
        const primeTower = modelGroup.getPrimeTower();

        // count extruders actually used
        const extrudersUsed = new Set();
        const models = modelGroup.getModels<ThreeModel>();
        for (const model of models) {
            if (model.isColored) {
                extrudersUsed.add(LEFT_EXTRUDER_MAP_NUMBER);
                extrudersUsed.add(RIGHT_EXTRUDER_MAP_NUMBER);
            } else {
                extrudersUsed.add(model.extruderConfig.infill);
                extrudersUsed.add(model.extruderConfig.shell);
            }
        }

        const supportExtruderConfig = modelGroup.getSupportExtruderConfig();
        if (this.supportEnabled) {
            extrudersUsed.add(supportExtruderConfig.support);
            extrudersUsed.add(supportExtruderConfig.interface);
        }

        if (extrudersUsed.has(BOTH_EXTRUDER_MAP_NUMBER)) {
            extrudersUsed.delete(BOTH_EXTRUDER_MAP_NUMBER);
            extrudersUsed.add(LEFT_EXTRUDER_MAP_NUMBER);
            extrudersUsed.add(RIGHT_EXTRUDER_MAP_NUMBER);
        }

        // calculate the visibility of prime tower
        // 1. Dual extruder
        // 2. Has at least one mesh
        // 3. Has at least 2 extruders actually being used
        if (this.primeTowerEnabled && models.length > 0 && extrudersUsed.size > 1) {
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
        const models = modelGroup.getModels<ThreeModel>();

        for (const model of models) {
            const h = model.boundingBox.max.z;

            const modelExtruders = new Set<string>();
            if (model.isColored) {
                modelExtruders.add(LEFT_EXTRUDER_MAP_NUMBER);
                modelExtruders.add(RIGHT_EXTRUDER_MAP_NUMBER);
            } else {
                modelExtruders.add(model.extruderConfig.infill);
                modelExtruders.add(model.extruderConfig.shell);
            }

            if (modelExtruders.has(BOTH_EXTRUDER_MAP_NUMBER)) {
                modelExtruders.delete(BOTH_EXTRUDER_MAP_NUMBER);
                modelExtruders.add(LEFT_EXTRUDER_MAP_NUMBER);
                modelExtruders.add(RIGHT_EXTRUDER_MAP_NUMBER);
            }

            for (const extruderNumber of modelExtruders) {
                maxHeights[extruderNumber] = maxHeights[extruderNumber] || 0;
                maxHeights[extruderNumber] = Math.max(maxHeights[extruderNumber], h);
            }
        }

        const supportExtruderConfig = modelGroup.getSupportExtruderConfig();
        if (this.supportEnabled) {
            // max possible height: max model height
            const extruderNumber = supportExtruderConfig.support;
            maxHeights[extruderNumber] = maxHeights[extruderNumber] || 0;
            maxHeights[extruderNumber] = Math.max(maxHeights[extruderNumber], ...Object.values(maxHeights));

            const nr2 = supportExtruderConfig.interface;
            maxHeights[nr2] = maxHeights[nr2] || 0;
            maxHeights[nr2] = Math.max(maxHeights[nr2], ...Object.values(maxHeights));
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

        // If no meshes exist, Place prime tower in the top right corner
        if (boundingBox.isEmpty()) {
            primeTowerX = size.x / 2 - stopArea.right - 15;
            primeTowerY = size.y / 2 - stopArea.back - 15;
            placed = true;
        }

        // Try place the prime tower on the back of models
        if (!placed) {
            const guessY = boundingBox.max.y + 15 + primeTowerSize / 2;
            if (guessY + primeTowerSize / 2 + stopArea.back <= size.y / 2) {
                primeTowerX = (boundingBox.min.x + boundingBox.max.x) / 2;
                primeTowerY = guessY;
                placed = true;
            }
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
    public onPresetParameterChanged(stackId: string, preset: PresetModel) {
        // prime tower logic
        if (stackId === LEFT_EXTRUDER) {
            const primeTowerEnabled = preset.settings.prime_tower_enable?.default_value || false;
            if (primeTowerEnabled !== this.primeTowerEnabled) {
                this.primeTowerEnabled = primeTowerEnabled as boolean;

                this.processPrimeTowerAsync();
            }
        }

        const modelGroup = scene.getModelGroup();
        const supportExtruderConfig = modelGroup.getSupportExtruderConfig();

        // support
        if (stackId === LEFT_EXTRUDER && supportExtruderConfig.support === '0'
            || stackId === RIGHT_EXTRUDER && supportExtruderConfig.support === '1') {
            const supportEnabled = preset.settings.support_enable?.default_value || false;

            if (supportEnabled !== this.supportEnabled) {
                this.supportEnabled = supportEnabled as boolean;
                this.processPrimeTowerAsync();
            }
        }
    }
}

const sceneLogic = new SceneLogic();

export default sceneLogic;
