import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { PRINTING_MANAGER_TYPE_QUALITY } from '../../../constants';
import log from '../../../lib/log';
import { PresetModel } from '../../../preset-model';
import type { QualityPresetModel } from '../../../preset-model';

import { actions as printingActions } from '../../../flux/printing';
import { createQualityPresetAction } from '../../../flux/printing/actions-preset';


interface Definition {
    definitionId: string;
}

export declare type PresetActionsType = {
    onSelectDefinitionById: (definitionId: string) => void;

    onCreateManagerDefinition: (definition: Definition) => Promise<PresetModel>;

    onResetPresetModel: (preset: Definition) => Promise<void>;

    onDeletePresetModel: (preset: Definition) => Promise<void>;

    createPreset: (file) => Promise<Definition>;
};

/**
 * Wrapper for preset redux actions.
 */
const usePresetActions = (): PresetActionsType => {
    const dispatch = useDispatch();

    const onSelectDefinitionById = (definitionId: string) => {
        // TODO:
        log.info('onSelectDefinitionById', definitionId);
    };

    // PresetModel
    const onCreateManagerDefinition = useCallback(async (qualityPresetModel: QualityPresetModel) => {
        return dispatch(createQualityPresetAction(qualityPresetModel));
    }, [dispatch]);

    const onResetPresetModel = (presetModel) => {
        return dispatch(printingActions.resetDefinitionById(
            PRINTING_MANAGER_TYPE_QUALITY,
            presetModel.definitionId,
        ));
    };

    const onDeletePresetModel = (presetModel) => {
        return dispatch(printingActions.removeDefinitionByType(
            PRINTING_MANAGER_TYPE_QUALITY,
            presetModel,
        ));
    };

    // Create
    const createPreset = (file) => {
        return dispatch(printingActions.onUploadManagerDefinition(file, PRINTING_MANAGER_TYPE_QUALITY));
    };

    return {
        onSelectDefinitionById,

        // @ts-ignore
        onCreateManagerDefinition,

        // @ts-ignore
        onResetPresetModel,

        // @ts-ignore
        onDeletePresetModel,

        // @ts-ignore
        createPreset,
    };
};

export default usePresetActions;
