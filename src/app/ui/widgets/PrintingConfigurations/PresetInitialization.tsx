import React, { useEffect } from 'react';

import { useSelector, useDispatch } from 'react-redux';

import { LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { pickAvailablePresetModels } from '../../utils/profileManager';
import { RootState } from '../../../flux/index.def';
import { actions as printingActions } from '../../../flux/printing';


const PresetInitialization: React.FC = () => {
    const dispatch = useDispatch();

    const {
        qualityDefinitions: qualityDefinitionModels,
        qualityDefinitionsRight: qualityDefinitionModelsRight,
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

    useEffect(() => {
        if (qualityDefinitionModels.length > 0) {
            let presetModel = qualityDefinitionModels.find(p => p.definitionId === activePresetIds[LEFT_EXTRUDER]);
            if (!presetModel) {
                // definition no found, select first official definition
                const availablePresetModels = pickAvailablePresetModels(qualityDefinitionModels, materialPreset);
                presetModel = availablePresetModels.length > 0 && availablePresetModels[0];

                if (presetModel) {
                    setPreset(LEFT_EXTRUDER, presetModel);

                    console.log(`Select Preset ${presetModel.definitionId} for left extruder..`);
                }
            }
        }
    }, [qualityDefinitionModels, activePresetIds, defaultMaterialId]);

    useEffect(() => {
        if (qualityDefinitionModelsRight.length > 0) {
            let presetModel = qualityDefinitionModelsRight.find(p => p.definitionId === activePresetIds[RIGHT_EXTRUDER]);
            if (!presetModel) {
                // definition no found, select first official definition
                const availablePresetModels = pickAvailablePresetModels(qualityDefinitionModelsRight, materialPresetRight);
                presetModel = availablePresetModels.length > 0 && availablePresetModels[0];

                if (presetModel) {
                    setPreset(RIGHT_EXTRUDER, presetModel);

                    console.log(`Select Preset ${presetModel.definitionId} for right extruder..`);
                }
            }
        }
    }, [qualityDefinitionModelsRight, activePresetIds, defaultMaterialIdRight]);

    return (<div className="display-none" />);
};

export default PresetInitialization;
