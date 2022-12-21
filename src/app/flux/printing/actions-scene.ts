import { find } from 'lodash';

import { LEFT_EXTRUDER } from '../../constants';
import baseActions from './actions-base';


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

    const models = modelGroup.getModels();
    modelGroup.models = models.concat();

    dispatch(render());
};

export default {
    render,

    applyPrintSettingsToModels,
};
