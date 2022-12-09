import { indexOf, orderBy } from 'lodash';
import React from 'react';
import {
    DEFAULT_PRESET_IDS,
    isQualityPresetVisible,
    PRESET_CATEGORY_CUSTOM,
    PRESET_CATEGORY_DEFAULT
} from '../../constants/preset';

import { MaterialWithColor } from '../widgets/PrintingMaterial/MaterialWithColor';


function getSelectOptions(printingDefinitions) {
    const toolDefinitionOptionsObj = {};
    const toolDefinitionOptions = [];
    printingDefinitions.forEach(tool => {
        const category = tool.category;
        const definitionId = tool.definitionId;
        if (Object.keys(tool?.settings).length > 0) {
            const checkboxAndSelectGroup = {};
            const name = tool.name;
            checkboxAndSelectGroup.name = name;
            checkboxAndSelectGroup.definitionId = definitionId;
            checkboxAndSelectGroup.label = `${name}`;
            checkboxAndSelectGroup.value = `${definitionId}-${name}`;
            if (toolDefinitionOptionsObj[category]) {
                toolDefinitionOptionsObj[category].options.push(checkboxAndSelectGroup);
            } else {
                const groupOptions = {
                    label: category,
                    definitionId: definitionId,
                    options: []
                };
                toolDefinitionOptionsObj[category] = groupOptions;
                groupOptions.options.push(checkboxAndSelectGroup);
            }
        }
    });
    Object.values(toolDefinitionOptionsObj).forEach((item) => {
        toolDefinitionOptions.push(item);
    });
    return toolDefinitionOptions;
}

/**
 * Pick available presets for material.
 *
 * @param presetModels
 * @param materialPreset
 */
export function pickAvailablePresetModels(presetModels, materialPreset) {
    if (!materialPreset) {
        return [];
    }

    const availablePresetModels = [];
    for (const presetModel of presetModels) {
        const visible = isQualityPresetVisible(presetModel, {
            materialType: materialPreset?.materialType,
        });
        if (visible) {
            availablePresetModels.push(presetModel);
        }
    }

    return availablePresetModels;
}


/**
 * Get preset Options from definitions.
 *
 * @param presetModels
 * @param materialPreset
 *
 * @return
 *
 * {
 *      [category: string]: {
 *          label,
 *          category,
 *          i18nCategoory,
 *          options: [{
 *              name,
 *              definitionId,
 *              typeOfPrinting,
 *              label,
 *              value,
 *              rank,
 *          }]
 *      },
 * }
 */
function getPresetOptions(presetModels, materialPreset) {
    if (!materialPreset) {
        return {};
    }

    const availablePresetModels = pickAvailablePresetModels(presetModels, materialPreset);

    const presetOptions = {
        [PRESET_CATEGORY_DEFAULT]: {
            label: PRESET_CATEGORY_DEFAULT,
            category: PRESET_CATEGORY_DEFAULT,
            options: [],
        }
    };

    for (const presetModel of availablePresetModels) {
        const {
            definitionId, name,
            category = PRESET_CATEGORY_CUSTOM,
            typeOfPrinting,
        } = presetModel;

        const checkboxAndSelectGroup = {};
        checkboxAndSelectGroup.name = name;
        checkboxAndSelectGroup.definitionId = definitionId;
        checkboxAndSelectGroup.typeOfPrinting = typeOfPrinting;
        checkboxAndSelectGroup.label = `${name}`;
        checkboxAndSelectGroup.value = `${definitionId}-${name}`;
        checkboxAndSelectGroup.rank = indexOf(DEFAULT_PRESET_IDS, definitionId);

        if (!presetOptions[category]) {
            presetOptions[category] = {
                label: category,
                category,
                options: [],
            };
        }

        presetOptions[category].options.push(checkboxAndSelectGroup);
    }

    // sort preset options
    Object.keys(presetOptions).forEach(category => {
        presetOptions[category].options = orderBy(presetOptions[category].options, ['rank'], ['asc']);
    });

    return presetOptions;
}

function getMaterialSelectOptions(materialDefinitions) {
    const materialDefinitionOptionsObj = {};
    const materialDefinitionOptions = [];
    materialDefinitions.forEach(tool => {
        const category = tool.category;
        const definitionId = tool.definitionId;
        if (Object.keys(tool?.settings).length > 0) {
            const checkboxAndSelectGroup = {};
            const name = tool.name;
            const color = tool?.settings?.color?.default_value;
            checkboxAndSelectGroup.name = <MaterialWithColor name={name} color={color} />;
            checkboxAndSelectGroup.definitionId = definitionId;
            checkboxAndSelectGroup.value = `${definitionId}-${name}`;
            if (materialDefinitionOptionsObj[category]) {
                materialDefinitionOptionsObj[category].options.push(checkboxAndSelectGroup);
            } else {
                const groupOptions = {
                    label: category,
                    definitionId: definitionId,
                    options: []
                };
                materialDefinitionOptionsObj[category] = groupOptions;
                groupOptions.options.push(checkboxAndSelectGroup);
            }
        }
    });
    Object.values(materialDefinitionOptionsObj).forEach((item) => {
        materialDefinitionOptions.push(item);
    });
    return materialDefinitionOptions;
}

export {
    getSelectOptions,
    getMaterialSelectOptions,
    getPresetOptions
};
