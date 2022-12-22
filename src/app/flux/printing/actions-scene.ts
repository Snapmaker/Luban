import { find } from 'lodash';

import { LEFT_EXTRUDER, MACHINE_EXTRUDER_X, MACHINE_EXTRUDER_Y, } from '../../constants';
import baseActions from './actions-base';
import sceneLogic, { PrimeTowerSettings } from '../../scene/scene.logic';
import PresetDefinitionModel from '../manager/PresetDefinitionModel';


const render = () => (dispatch) => {
    dispatch(
        baseActions.updateState({
            renderingTimestamp: +new Date()
        })
    );
};


const getModelMaterialSettings = (model) => (dispatch, getState) => {
    const {
        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight
    } = getState().printing;
    const materialID = model.extruderConfig.shell === '0' ? defaultMaterialId : defaultMaterialIdRight;
    const index = materialDefinitions.findIndex((d) => {
        return d.definitionId === materialID;
    });
    return materialDefinitions[index] ? materialDefinitions[index].settings : materialDefinitions[0].settings;
};

const applyPrintSettingsToModels = () => (dispatch, getState) => {
    const {
        qualityDefinitions,
        activePresetIds,
        modelGroup,
    } = getState().printing;

    // TODO: Not only pick the left extruder
    const activeQualityDefinition = find(qualityDefinitions, {
        definitionId: activePresetIds[LEFT_EXTRUDER],
    });
    if (!activeQualityDefinition) {
        return;
    }

    console.log('actions scene. applyPrintSettingsToModels');

    // update global settings
    const qualitySetting = activeQualityDefinition.settings;
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

    // update parameters for each model
    modelGroup.getThreeModels().forEach((model) => {
        const materialSettings = dispatch(getModelMaterialSettings(model));
        model.updateMaterialColor(materialSettings.color.default_value);

        const layerHeight = qualitySetting.layer_height.default_value;
        const bottomThickness = qualitySetting.bottom_thickness.default_value;
        const bottomLayers = Math.ceil(Math.round(bottomThickness / layerHeight));
        const topThickness = qualitySetting.top_thickness.default_value;
        const topLayers = Math.ceil(Math.round(topThickness / layerHeight));

        model.updateClipperConfig({
            lineWidth: materialSettings.machine_nozzle_size.default_value,
            wallThickness: qualitySetting.wall_thickness.default_value,
            topLayers,
            bottomLayers,
            layerHeight,
            infillSparseDensity: qualitySetting.infill_sparse_density.default_value,
            infillPattern: qualitySetting.infill_pattern.default_value,
            magicSpiralize: qualitySetting.magic_spiralize.default_value,
        });
        model.materialPrintTemperature = materialSettings.material_print_temperature.default_value;
    });

    sceneLogic.onPresetParameterChanged(activeQualityDefinition);

    // TODO:
    const models = modelGroup.getModels();
    modelGroup.models = models.concat();

    dispatch(render());
};

const finalizeSceneSettings = (
    extruderDefinitions: any[],
    globalQualityPreset: PresetDefinitionModel,
    // extruderPresetModels: PresetDefinitionModel[]
) => (dispatch, getState) => {
    const {
        modelGroup,
        // helpersExtruderConfig,
        stopArea: { left, front }
    } = getState().printing;

    const {
        size,
    } = getState().machine;

    const primeTowerModel = modelGroup.getPrimeTower();
    const primeTowerSettings: PrimeTowerSettings = {
        enabled: primeTowerModel.visible,
    };

    // const adhesionExtruder = helpersExtruderConfig.adhesion;

    let primeTowerXDefinition = 0;
    let primeTowerYDefinition = 0;
    if (primeTowerModel.visible) {
        const modelGroupBBox = modelGroup.getValidArea();
        // const primeTowerBrimEnable = presetModel.settings?.prime_tower_brim_enable?.default_value;
        // const adhesionType = presetModel.settings?.adhesion_type?.default_value;
        const primeTowerWidth = primeTowerModel.boundingBox.max.x
            - primeTowerModel.boundingBox.min.x;
        const primeTowerPositionX = modelGroupBBox.max.x
            - (primeTowerModel.boundingBox.max.x
                + primeTowerModel.boundingBox.min.x
                + primeTowerWidth)
            / 2;
        const primeTowerPositionY = modelGroupBBox.max.y
            - (primeTowerModel.boundingBox.max.y
                + primeTowerModel.boundingBox.min.y
                - primeTowerWidth)
            / 2;
        primeTowerXDefinition = size.x - primeTowerPositionX - left;
        primeTowerYDefinition = size.y - primeTowerPositionY - front;
        // const a = size.x * 0.5 + primeTowerModel.transformation.positionX- left;;
        // const b = size.y * 0.5 + primeTowerModel.transformation.positionY - front;

        /*
        if (primeTowerBrimEnable && adhesionType !== 'raft') {
            const initialLayerLineWidthFactor = presetModel?.settings?.initial_layer_line_width_factor?.default_value || 0;
            const brimLineCount = presetModel?.settings?.brim_line_count?.default_value || 0;
            let skirtBrimLineWidth = extruderLDefinition?.settings?.machine_nozzle_size?.default_value;
            if (adhesionExtruder === '1') {
                skirtBrimLineWidth = extruderRDefinition?.settings?.machine_nozzle_size?.default_value;
            }
            const diff = brimLineCount * skirtBrimLineWidth * initialLayerLineWidthFactor / 100;
            primeTowerXDefinition += diff;
            primeTowerYDefinition += diff;
        }*/
    }

    // Rewrite prime tower settings
    globalQualityPreset.settings.prime_tower_enable.default_value = primeTowerSettings.enabled;
    if (primeTowerSettings.enabled) {
        globalQualityPreset.settings.prime_tower_position_x.default_value = primeTowerXDefinition;
        globalQualityPreset.settings.prime_tower_position_y.default_value = primeTowerYDefinition;
        globalQualityPreset.settings.prime_tower_size.default_value = primeTowerSettings.size;
    }

    for (const extruderDefinition of extruderDefinitions) {
        // Rewrite start/end position for extruders
        if (primeTowerSettings.enabled) {
            extruderDefinition.settings.machine_extruder_start_pos_abs.default_value = true;
            extruderDefinition.settings.machine_extruder_end_pos_abs.default_value = true;

            MACHINE_EXTRUDER_X.forEach((keyItem) => {
                extruderDefinition.settings[keyItem].default_value = primeTowerXDefinition;
            });
            MACHINE_EXTRUDER_Y.forEach((keyItem) => {
                extruderDefinition.settings[keyItem].default_value = primeTowerYDefinition;
            });
        } else {
            extruderDefinition.settings.machine_extruder_start_pos_abs.default_value = false;
            extruderDefinition.settings.machine_extruder_end_pos_abs.default_value = false;
        }
    }
};

export default {
    render,

    applyPrintSettingsToModels,

    finalizeSceneSettings,
};
