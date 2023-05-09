import { AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { useSelector } from 'react-redux';

import { timestamp } from '../../../shared/lib/random-utils';
import { MaterialPresetModel, PresetModel, QualityPresetModel } from '../../preset-model';
import type { RootState } from '../index.def';
import { KEY_DEFAULT_CATEGORY_CUSTOM, LEFT_EXTRUDER } from '../../constants';
import definitionManager from '../manager/DefinitionManager';
import baseActions from './actions-base';

const QUALITY_PRESET_PREFIX = 'quality';

/**
 * Helper function used to generate a proper preset name.
 */
function generateQualityPresetName(presetModel: QualityPresetModel, existingPresetModels: PresetModel[]): string {
    const existingModels = existingPresetModels.filter((model) => {
        if (presetModel.category === KEY_DEFAULT_CATEGORY_CUSTOM) {
            return model.category === KEY_DEFAULT_CATEGORY_CUSTOM || !model.category;
        } else {
            return model.category === presetModel.category;
        }
    });

    let name = presetModel.name;
    while (existingModels.findIndex((model) => model.name === name) !== -1) {
        name = `#${name}`;
    }

    return name;
}

/**
 * Create a new quality preset from qualityPresetModel.
 *
 * @param qualityPresetModel quality preset to be created
 */
export const createQualityPresetAction = (qualityPresetModel: QualityPresetModel): ThunkAction<
    Promise<QualityPresetModel>,
    RootState,
    unknown,
    AnyAction
> => {
    return async (dispatch, getState) => {
        // always create a new definition ID
        const definitionId = `${QUALITY_PRESET_PREFIX}.${timestamp()}`;
        qualityPresetModel.definitionId = definitionId;

        // re-check for duplicated name
        const existingPresetModels = getState().printing.qualityDefinitions;
        const name = generateQualityPresetName(qualityPresetModel, existingPresetModels);
        qualityPresetModel.name = name;

        // metadata
        if (qualityPresetModel.metadata.readonly) {
            qualityPresetModel.metadata.readonly = false;
        }

        const data = qualityPresetModel.getSimplifiedData();
        const newPresetData = await definitionManager.createDefinition(data);
        const newPresetModel = new QualityPresetModel(newPresetData);

        // Update quality preset list
        dispatch(
            baseActions.updateState({
                qualityDefinitions: [...existingPresetModels, newPresetModel],
            })
        );

        return newPresetModel;
    };
};


// TODO: Move to other place
export const useMaterialPresetModel = (stackId: string): MaterialPresetModel | null => {
    const {
        materialDefinitions,
        defaultMaterialId,
        defaultMaterialIdRight
    } = useSelector((state: RootState) => state.printing);

    const presetId = stackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;

    const index = materialDefinitions.findIndex((m: MaterialPresetModel) => m.definitionId === presetId);
    if (index >= 0) {
        return materialDefinitions[index];
    } else {
        return null;
    }
};
