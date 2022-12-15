import { useDispatch } from 'react-redux';

import { PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import PresetDefinitionModel from '../../../flux/manager/PresetDefinitionModel';

import { actions as printingActions } from '../../../flux/printing';


export declare type PresetActionsType = {
    onSelectDefinitionById?: (definitionId) => void;

    onCreateManagerDefinition: (definition) => Promise<PresetDefinitionModel>;

    onDeletePresetModel: (preset) => Promise<void>;
};

/**
 * Wrapper for preset redux actions.
 */
const usePresetActions = (): PresetActionsType => {
    const dispatch = useDispatch();

    const onSelectDefinitionById = (definitionId) => {
        // TODO:
        console.log('onSelectDefinitionById', definitionId);
    };

    // PresetDefinitionModel
    const onCreateManagerDefinition = (definition) => {
        return dispatch(printingActions.duplicateDefinitionByType(PRINTING_MANAGER_TYPE_QUALITY, definition));
    };

    const onDeletePresetModel = (presetModel) => {
        return dispatch(printingActions.removeDefinitionByType(
            PRINTING_MANAGER_TYPE_QUALITY,
            presetModel,
        ));
    };

    return {
        onSelectDefinitionById,

        // @ts-ignore
        onCreateManagerDefinition,

        // @ts-ignore
        onDeletePresetModel,
    };
};

export default usePresetActions;
