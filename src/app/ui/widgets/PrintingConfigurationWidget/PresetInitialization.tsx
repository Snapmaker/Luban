import React, { useCallback, useEffect } from 'react';

import { useSelector, useDispatch, shallowEqual } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { isQualityPresetVisible } from '../../../constants/preset';
import log from '../../../lib/log';
import { pickAvailableQualityPresetModels } from '../../utils/profileManager';
import { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';
import type { MaterialPresetModel, PresetModel } from '../../../preset-model';

/**
 * Initialize preset selections.
 *
 * TODO: Refactor this to flux.
 */
const PresetInitialization: React.FC = () => {
    const dispatch = useDispatch();

    const {
        extruderLDefinition,
        extruderRDefinition,

        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight,

        qualityDefinitions: qualityDefinitionModels,
        activePresetIds,
    } = useSelector((state: RootState) => state.printing, shallowEqual);

    const materialPreset = materialDefinitions.find((p: MaterialPresetModel) => p.definitionId === defaultMaterialId);
    const materialPresetRight = materialDefinitions.find((p: MaterialPresetModel) => p.definitionId === defaultMaterialIdRight);

    /**
     * Action to set quality preset.
     */
    const setQualityPreset = useCallback((stackId: string, presetModel: PresetModel) => {
        dispatch(printingActions.updateActiveQualityPresetId(stackId, presetModel.definitionId));
    }, [dispatch]);

    // Check if material preset is valid, otherwise choose default material
    useEffect(() => {
        if (materialDefinitions.length === 0) return;

        const preset = materialDefinitions.find((p: MaterialPresetModel) => p.definitionId === defaultMaterialId);
        if (!preset) {
            dispatch(printingActions.updateDefaultMaterialId('material.pla', LEFT_EXTRUDER));
        }
    }, [dispatch, defaultMaterialId, materialDefinitions]);

    useEffect(() => {
        if (materialDefinitions.length === 0) return;

        const preset = materialDefinitions.find((p: MaterialPresetModel) => p.definitionId === defaultMaterialIdRight);
        if (!preset) {
            dispatch(printingActions.updateDefaultMaterialId('material.pla', RIGHT_EXTRUDER));
        }
    }, [dispatch, defaultMaterialIdRight, materialDefinitions]);


    // Check if quality preset is valid, otherwise choose another quality preset
    useEffect(() => {
        if (qualityDefinitionModels.length > 0) {
            const presetFilters = {
                materialType: materialPreset?.materialType,
                nozzleSize: extruderLDefinition?.settings.machine_nozzle_size.default_value,
            };

            let presetModel = qualityDefinitionModels.find(p => p.definitionId === activePresetIds[LEFT_EXTRUDER]);
            if (presetModel && !isQualityPresetVisible(presetModel, presetFilters)) {
                presetModel = null;
            }

            if (!presetModel) {
                // definition no found, select first official definition
                const availablePresetModels = pickAvailableQualityPresetModels(qualityDefinitionModels, presetFilters);
                presetModel = availablePresetModels.length > 0 && availablePresetModels[0];

                if (presetModel) {
                    log.info(`Select Preset ${presetModel.definitionId} for left extruder..`);

                    setQualityPreset(LEFT_EXTRUDER, presetModel);
                }
            }
        }
    }, [
        qualityDefinitionModels,
        activePresetIds[LEFT_EXTRUDER],
        materialPreset?.materialType,
        setQualityPreset,
        extruderLDefinition?.settings.machine_nozzle_size.default_value,
    ]);

    useEffect(() => {
        if (qualityDefinitionModels.length > 0) {
            const presetFilters = {
                materialType: materialPresetRight?.materialType,
                nozzleSize: extruderRDefinition?.settings.machine_nozzle_size.default_value,
            };

            let presetModel = qualityDefinitionModels.find(p => p.definitionId === activePresetIds[RIGHT_EXTRUDER]);
            if (presetModel && !isQualityPresetVisible(presetModel, presetFilters)) {
                presetModel = null;
            }
            if (!presetModel) {
                // definition no found, select first official definition
                const availablePresetModels = pickAvailableQualityPresetModels(qualityDefinitionModels, presetFilters);
                presetModel = availablePresetModels.length > 0 && availablePresetModels[0];

                if (presetModel) {
                    log.info(`Select Preset ${presetModel.definitionId} for right extruder..`);

                    setQualityPreset(RIGHT_EXTRUDER, presetModel);
                }
            }
        }
    }, [
        qualityDefinitionModels,
        activePresetIds[RIGHT_EXTRUDER],
        materialPresetRight?.materialType,
        setQualityPreset,
        extruderRDefinition?.settings.machine_nozzle_size.default_value,
    ]);

    return (<div className="display-none" />);
};

export default PresetInitialization;
