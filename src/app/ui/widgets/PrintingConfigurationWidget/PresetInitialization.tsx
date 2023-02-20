import React, { useEffect } from 'react';

import { useSelector, useDispatch } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import log from '../../../lib/log';
import { pickAvailablePresetModels } from '../../utils/profileManager';
import { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';

/**
 * Initialize preset selections.
 *
 * TODO: Refactor this to flux.
 */
const PresetInitialization: React.FC = () => {
    const dispatch = useDispatch();

    const {
        qualityDefinitions: qualityDefinitionModels,
        activePresetIds,

        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight,
    } = useSelector((state: RootState) => state.printing);

    const materialPreset = materialDefinitions.find(p => p.definitionId === defaultMaterialId);
    const materialPresetRight = materialDefinitions.find(p => p.definitionId === defaultMaterialIdRight);

    const setPreset = (stackId, presetModel) => {
        dispatch(printingActions.updateActiveQualityPresetId(stackId, presetModel.definitionId));
    };

    // If material doesn't exist, we choose default material
    useEffect(() => {
        if (materialDefinitions.length === 0) return;

        const preset = materialDefinitions.find(p => p.definitionId === defaultMaterialId);
        if (!preset) {
            dispatch(printingActions.updateDefaultMaterialId('material.pla', LEFT_EXTRUDER));
        }
    }, [dispatch, defaultMaterialId, materialDefinitions]);
    useEffect(() => {
        if (materialDefinitions.length === 0) return;

        const preset = materialDefinitions.find(p => p.definitionId === defaultMaterialIdRight);
        if (!preset) {
            dispatch(printingActions.updateDefaultMaterialId('material.pla', RIGHT_EXTRUDER));
        }
    }, [dispatch, defaultMaterialIdRight, materialDefinitions]);

    useEffect(() => {
        if (qualityDefinitionModels.length > 0) {
            let presetModel = qualityDefinitionModels.find(p => p.definitionId === activePresetIds[LEFT_EXTRUDER]);
            if (!presetModel) {
                // definition no found, select first official definition
                const availablePresetModels = pickAvailablePresetModels(qualityDefinitionModels, materialPreset);
                presetModel = availablePresetModels.length > 0 && availablePresetModels[0];

                if (presetModel) {
                    setPreset(LEFT_EXTRUDER, presetModel);

                    log.info(`Select Preset ${presetModel.definitionId} for left extruder..`);
                }
            }
        }
    }, [qualityDefinitionModels, activePresetIds, materialPreset]);

    useEffect(() => {
        if (qualityDefinitionModels.length > 0) {
            let presetModel = qualityDefinitionModels.find(p => p.definitionId === activePresetIds[RIGHT_EXTRUDER]);
            if (!presetModel) {
                // definition no found, select first official definition
                const availablePresetModels = pickAvailablePresetModels(qualityDefinitionModels, materialPresetRight);
                presetModel = availablePresetModels.length > 0 && availablePresetModels[0];

                if (presetModel) {
                    setPreset(RIGHT_EXTRUDER, presetModel);

                    log.info(`Select Preset ${presetModel.definitionId} for right extruder..`);
                }
            }
        }
    }, [qualityDefinitionModels, activePresetIds, defaultMaterialIdRight]);

    return (<div className="display-none" />);
};

export default PresetInitialization;
