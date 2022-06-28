import React from 'react';
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

function getPresetOptions(definitionModels) {
    const presetOptionsObj = {};
    definitionModels.forEach(preset => {
        const typeOfPrinting = preset.typeOfPrinting;
        const category = preset.category && typeOfPrinting ? preset.category : 'Custom';
        const definitionId = preset.definitionId;
        if (Object.keys(preset?.settings).length > 0) {
            const checkboxAndSelectGroup = {};
            const name = preset.name;
            checkboxAndSelectGroup.name = name;
            checkboxAndSelectGroup.definitionId = definitionId;
            checkboxAndSelectGroup.typeOfPrinting = typeOfPrinting;
            checkboxAndSelectGroup.label = `${name}`;
            checkboxAndSelectGroup.value = `${definitionId}-${name}`;
            if (presetOptionsObj[category]) {
                preset.visible && presetOptionsObj[category].options.push(checkboxAndSelectGroup);
            } else {
                const i18nCategory = preset.i18nCategory;
                const groupOptions = {
                    label: category,
                    category: category,
                    i18nCategory: i18nCategory,
                    options: []
                };
                presetOptionsObj[category] = groupOptions;
                preset.visible && groupOptions.options.push(checkboxAndSelectGroup);
            }
        }
    });
    return presetOptionsObj;
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
