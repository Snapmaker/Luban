import { find } from 'lodash';
import { Color } from 'three';

import { LEFT_EXTRUDER, MACHINE_EXTRUDER_X, MACHINE_EXTRUDER_Y, RIGHT_EXTRUDER } from '../../constants';
import { MaterialPresetModel, PresetModel } from '../../preset-model';
import sceneLogic, { PrimeTowerSettings } from '../../scene/scene.logic';

import baseActions from './actions-base';
import { BYTE_COUNT_LEFT_EXTRUDER, BYTE_COUNT_RIGHT_EXTRUDER } from '../../models/ThreeModel';


const render = () => (dispatch) => {
    dispatch(
        baseActions.updateState({
            renderingTimestamp: +new Date()
        })
    );
};

const checkModelOverstep = () => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const isAnyModelOverstepped = modelGroup.getOverstepped();
        dispatch(baseActions.updateState({ isAnyModelOverstepped }));
    };
};

/**
 * Set both transformMode and modelGroup's transform mode.
 */
const setTransformMode = (value: string) => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        modelGroup.setTransformMode(value);
        dispatch(baseActions.updateState({
            transformMode: value
        }));
        dispatch(render());
    };
};

const startMeshColoringMode = () => {
    return (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.startMeshColoring();
        dispatch(setTransformMode('mesh-coloring'));
        // dispatch(actions.destroyGcodeLine());
        dispatch(render());
    };
};

const endMeshColoringMode = (shouldApplyChanges = false) => {
    return (dispatch, getState) => {
        dispatch(setTransformMode(''));
        const { modelGroup } = getState().printing;

        if (shouldApplyChanges) {
            modelGroup.finishMeshColoring();
        } else {
            modelGroup.finishMeshColoring(false);
        }

        dispatch(render());
    };
};

const updateMeshColoringBrushMark = (mark: string) => {
    return (dispatch) => {
        if (![LEFT_EXTRUDER, RIGHT_EXTRUDER].includes(mark)) {
            return;
        }

        dispatch(baseActions.updateState({
            meshColoringBrushMark: mark
        }));
    };
};

const _getMaterialPresetModel = (materialPresetModels: MaterialPresetModel[], presetId: string): MaterialPresetModel => {
    const index = materialPresetModels.findIndex((m) => m.definitionId === presetId);
    if (index >= 0) {
        return materialPresetModels[index];
    } else {
        return null;
    }
};

/**
 * Apply raycast result to mesh effect.
 */
const applyMeshColoringBrush = (raycastResult) => {
    return (dispatch, getState) => {
        const {
            modelGroup,
            meshColoringBrushMark,

            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight
        } = getState().printing;

        const materialPresetId = meshColoringBrushMark === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;

        const materialPresetModel = _getMaterialPresetModel(materialDefinitions, materialPresetId);
        const colorString = materialPresetModel.settings.color.default_value as string;
        const color = new Color(colorString);

        let faceExtruderMark = 0;
        if (meshColoringBrushMark === LEFT_EXTRUDER) {
            faceExtruderMark = BYTE_COUNT_LEFT_EXTRUDER;
        } else if (meshColoringBrushMark === RIGHT_EXTRUDER) {
            faceExtruderMark = BYTE_COUNT_RIGHT_EXTRUDER;
        }
        modelGroup.applyMeshColoringBrush(raycastResult, faceExtruderMark, color);
    };
};

/**
 * Return material preset model for model.
 *
 * We only take the material used to print shell.
 */
const getModelShellMaterialPresetModel = (model) => {
    return (dispatch, getState) => {
        const {
            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight
        } = getState().printing;

        const materialID = model.extruderConfig.shell === '0' ? defaultMaterialId : defaultMaterialIdRight;
        const index = materialDefinitions.findIndex((d) => d.definitionId === materialID);
        return materialDefinitions[index] ? materialDefinitions[index] : materialDefinitions[0];
    };
};

const applyPrintSettingsToModels = () => (dispatch, getState) => {
    const {
        qualityDefinitions,
        activePresetIds,
        modelGroup,
    } = getState().printing;

    const leftPresetModel = find(qualityDefinitions, {
        definitionId: activePresetIds[LEFT_EXTRUDER],
    });
    const rightPresetModel = find(qualityDefinitions, {
        definitionId: activePresetIds[RIGHT_EXTRUDER],
    });

    const helperExtruderConfig = modelGroup.getHelpersExtruderConfig();

    // update global settings
    const adhesionPresetModel = helperExtruderConfig.adhesion === '0' ? leftPresetModel : rightPresetModel;
    if (adhesionPresetModel) {
        const qualitySetting = adhesionPresetModel.settings;
        modelGroup.updatePlateAdhesion({
            adhesionType: qualitySetting.adhesion_type.default_value,
            skirtLineCount: qualitySetting?.skirt_line_count?.default_value,
            brimLineCount: qualitySetting?.brim_line_count?.default_value,
            brimWidth: qualitySetting?.brim_width?.default_value,
            skirtBrimLineWidth: qualitySetting?.skirt_brim_line_width?.default_value,
            raftMargin: qualitySetting?.raft_margin?.default_value,
            skirtGap: qualitySetting?.skirt_gap?.default_value,
            brimGap: qualitySetting?.brim_gap?.default_value
        });
    }

    // update parameters for each model
    if (leftPresetModel || rightPresetModel) {
        const globalSettings = leftPresetModel.settings;
        modelGroup.getThreeModels().forEach((model) => {
            const materialPresetModel = dispatch(getModelShellMaterialPresetModel(model));
            const materialSettings = materialPresetModel.settings;

            // update material color
            model.updateMaterialColor(materialSettings.color.default_value);

            const layerHeight = globalSettings.layer_height.default_value;
            const bottomThickness = globalSettings.bottom_thickness.default_value;
            const bottomLayers = Math.ceil(Math.round(bottomThickness / layerHeight));
            const topThickness = globalSettings.top_thickness.default_value;
            const topLayers = Math.ceil(Math.round(topThickness / layerHeight));

            model.updateClipperConfig({
                lineWidth: materialSettings.machine_nozzle_size.default_value,
                wallThickness: globalSettings.wall_thickness.default_value,
                topLayers,
                bottomLayers,
                layerHeight,
                infillSparseDensity: globalSettings.infill_sparse_density.default_value,
                infillPattern: globalSettings.infill_pattern.default_value,
                magicSpiralize: globalSettings.magic_spiralize.default_value,
            });
            model.materialPrintTemperature = materialSettings.material_print_temperature.default_value;
        });
    }

    if (leftPresetModel) {
        sceneLogic.onPresetParameterChanged(LEFT_EXTRUDER, leftPresetModel);
    }
    if (rightPresetModel) {
        sceneLogic.onPresetParameterChanged(RIGHT_EXTRUDER, rightPresetModel);
    }

    // TODO:
    const models = modelGroup.getModels();
    modelGroup.models = models.concat();

    dispatch(checkModelOverstep());
    dispatch(render());
};

const finalizeSceneSettings = (
    extruderDefinitions: object[],
    globalQualityPreset: PresetModel,
    extruderPresetModels: PresetModel[],
) => (dispatch, getState) => {
    const {
        modelGroup,
        helpersExtruderConfig,
    } = getState().printing;

    const {
        size,
    } = getState().machine;

    const primeTowerModel = modelGroup.getPrimeTower();
    const primeTowerSettings: PrimeTowerSettings = {
        enabled: primeTowerModel.visible,
    };

    if (primeTowerModel.visible) {
        // In slice engine, prime tower position is defined as bottom right corner of the shape,
        // yet we define it as center of shape, so add some offset to parameters
        const primeTowerBox = primeTowerModel.boundingBox;
        const primeTowerSize = primeTowerBox.max.x - primeTowerBox.min.x;
        const primeTowerPosition = {
            x: (primeTowerBox.min.x + primeTowerBox.max.x) / 2,
            y: (primeTowerBox.min.y + primeTowerBox.max.y) / 2,
        };

        const primeTowerBottomRightX = primeTowerPosition.x + primeTowerSize / 2;
        const primeTowerBottomRightY = primeTowerPosition.y - primeTowerSize / 2;

        // Very weird offset calculation by the slice engine
        const adhesionType = globalQualityPreset.settings.adhesion_type?.default_value;
        const hasPrimeTowerBrim = globalQualityPreset.settings.prime_tower_brim_enable?.default_value;

        let offset = 0;
        if (hasPrimeTowerBrim && adhesionType !== 'raft') {
            const initialLayerLineWidthFactor = globalQualityPreset.settings.initial_layer_line_width_factor?.default_value || 0;
            const brimLineCount = globalQualityPreset?.settings?.brim_line_count?.default_value;
            const adhesionExtruder = helpersExtruderConfig.adhesion;

            // Note that line width is settable per extruder, we need to use correct extruder preset
            let skirtBrimLineWidth;
            if (adhesionExtruder === '0') {
                skirtBrimLineWidth = extruderPresetModels[0].settings?.skirt_brim_line_width?.default_value;
            } else if (adhesionExtruder === '1') {
                skirtBrimLineWidth = extruderPresetModels[1].settings?.skirt_brim_line_width?.default_value;
            } else {
                skirtBrimLineWidth = globalQualityPreset.settings?.skirt_brim_line_width?.default_value;
            }

            offset = brimLineCount * skirtBrimLineWidth * initialLayerLineWidthFactor / 100;
        }

        // Convert scene position to work position
        primeTowerSettings.size = primeTowerSize;
        primeTowerSettings.positionX = size.x / 2 + primeTowerBottomRightX + offset;
        primeTowerSettings.positionY = size.y / 2 + primeTowerBottomRightY + offset;
    }

    // Rewrite prime tower settings
    globalQualityPreset.settings.prime_tower_enable.default_value = primeTowerSettings.enabled;
    if (primeTowerSettings.enabled) {
        globalQualityPreset.settings.prime_tower_position_x.default_value = primeTowerSettings.positionX;
        globalQualityPreset.settings.prime_tower_position_y.default_value = primeTowerSettings.positionY;
        globalQualityPreset.settings.prime_tower_size.default_value = primeTowerSettings.size;
    }

    for (const extruderDefinition of extruderDefinitions) {
        // Rewrite start/end position for extruders
        if (primeTowerSettings.enabled) {
            extruderDefinition.settings.machine_extruder_start_pos_abs.default_value = true;
            extruderDefinition.settings.machine_extruder_end_pos_abs.default_value = true;

            MACHINE_EXTRUDER_X.forEach((keyItem) => {
                extruderDefinition.settings[keyItem].default_value = primeTowerSettings.positionX;
            });
            MACHINE_EXTRUDER_Y.forEach((keyItem) => {
                extruderDefinition.settings[keyItem].default_value = primeTowerSettings.positionY;
            });
        } else {
            extruderDefinition.settings.machine_extruder_start_pos_abs.default_value = false;
            extruderDefinition.settings.machine_extruder_end_pos_abs.default_value = false;
        }
    }
};

export default {
    // basic scene actions
    render,

    // mesh coloring
    startMeshColoringMode,
    endMeshColoringMode,
    updateMeshColoringBrushMark,
    applyMeshColoringBrush,

    // print settings -> scene
    applyPrintSettingsToModels,

    // scene -> print settings
    finalizeSceneSettings,
};
