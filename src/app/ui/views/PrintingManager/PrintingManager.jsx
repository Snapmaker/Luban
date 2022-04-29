import React from 'react';
import { includes } from 'lodash';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import {
    PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_MATERIAL_CONFIG_KEYS_SINGLE, PRINTING_MATERIAL_CONFIG_KEYS_DUAL,
    PRINTING_QUALITY_CONFIG_KEYS_SINGLE, PRINTING_QUALITY_CONFIG_KEYS_DUAL,
    getMachineSeriesWithToolhead, HEAD_PRINTING,
    PRINTING_MATERIAL_CONFIG_GROUP_SINGLE, PRINTING_MATERIAL_CONFIG_GROUP_DUAL,
    PRINTING_QUALITY_CONFIG_GROUP_SINGLE, PRINTING_QUALITY_CONFIG_GROUP_DUAL,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    LEFT_EXTRUDER
} from '../../../constants';
import ProfileManager from '../ProfileManager';
import i18n from '../../../lib/i18n';

// const materialText = (label, color) => {
//     return (
//         <div>
//             <span>{label}</span>
//             <div className={`width-16 height-16 background-${color}`} />
//         </div>
//     );
// };

function isOfficialDefinition(definition) {
    return definition && includes([
        'material.pla', 'material.abs', 'material.petg',
        'material.pla.black', 'material.abs.black', 'material.petg.black',
        'material.pla.blue', 'material.pla.grey', 'material.pla.red', 'material.pla.yellow',
        'material.petg.blue', 'material.petg.red', 'material.pla.glow', 'material.pla.wood',
        'material.tpu.black', 'material.tpu.yellow',
        'quality.fast_print', 'quality.normal_quality', 'quality.high_quality'
    ], definition.definitionId);
}

function PrintingManager() {
    const showPrintingManager = useSelector(state => state?.printing?.showPrintingManager, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);
    const defaultQualityId = useSelector(state => state?.printing?.defaultQualityId, shallowEqual);
    const managerDisplayType = useSelector(state => state?.printing?.managerDisplayType, shallowEqual);
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions);
    const materialManagerDirection = useSelector(state => state?.printing?.materialManagerDirection, shallowEqual);
    // TODO: Update materialDifinitions Data, for TreeSelect
    // const [materialOptions, setMaterialOptions] = useState(materialDefinitions);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions);
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const dispatch = useDispatch();
    let printingMaterialConfigKeys, printingQualityConfigKeys, printingMaterialConfigGroup, printingQualityConfigGroup;
    if (toolHead.printingToolhead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2) {
        printingMaterialConfigKeys = PRINTING_MATERIAL_CONFIG_KEYS_SINGLE;
        printingQualityConfigKeys = PRINTING_QUALITY_CONFIG_KEYS_SINGLE;
        printingMaterialConfigGroup = PRINTING_MATERIAL_CONFIG_GROUP_SINGLE;
        printingQualityConfigGroup = PRINTING_QUALITY_CONFIG_GROUP_SINGLE;
    } else {
        printingMaterialConfigKeys = PRINTING_MATERIAL_CONFIG_KEYS_DUAL;
        printingQualityConfigKeys = PRINTING_QUALITY_CONFIG_KEYS_DUAL;
        printingMaterialConfigGroup = PRINTING_MATERIAL_CONFIG_GROUP_DUAL;
        printingQualityConfigGroup = PRINTING_QUALITY_CONFIG_GROUP_DUAL;
    }
    if (!showPrintingManager) {
        return null;
    }

    const actions = {
        closeManager: () => {
            dispatch(printingActions.updateShowPrintingManager(false));
        },
        onChangeFileForManager: (event) => {
            const file = event.target.files[0];
            return dispatch(printingActions.onUploadManagerDefinition(file, managerDisplayType));
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
            dispatch(projectActions.exportConfigFile(targetFile, `${HEAD_PRINTING}/${currentMachine.configPathname[HEAD_PRINTING]}`));
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            dispatch(printingActions.updateDefaultIdByType(managerDisplayType, definitionId, materialManagerDirection));
        },
        onSaveDefinitionForManager: async (newDefinition, shouldUpdateActive) => {
            // now setDefinitionState is synchronize, so remove setTimeout
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                await actions.onSaveMaterialForManager(managerDisplayType, newDefinition);
            } else {
                await actions.onSaveQualityForManager(managerDisplayType, newDefinition);
            }
            if (shouldUpdateActive) {
                actions.updateActiveDefinition(newDefinition.definitionId);
                dispatch(printingActions.destroyGcodeLine());
                dispatch(printingActions.displayModel());
            }
        },
        onSaveQualityForManager: async (type, newDefinition) => {
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(newDefinition.settings)) {
                if (printingQualityConfigKeys.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }

            await dispatch(printingActions.updateDefinitionSettings(newDefinition, newDefinitionSettings));
            return dispatch(printingActions.updateDefinitionsForManager(newDefinition.definitionId, type));
        },
        onSaveMaterialForManager: async (type, newDefinition) => {
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(newDefinition?.settings)) {
                if (printingMaterialConfigKeys.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }
            await dispatch(printingActions.updateDefinitionSettings(newDefinition, newDefinitionSettings));
            return dispatch(printingActions.updateDefinitionsForManager(newDefinition.definitionId, type));
        },

        updateDefinitionName: async (definition, selectedName) => {
            try {
                await dispatch(printingActions.updateDefinitionNameByType(managerDisplayType, definition, selectedName));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('key-Printing/PrintingManager_rename_error_prompt'));
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                await dispatch(printingActions.updateDefinitionNameByType(managerDisplayType, definition, selectedName, true));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('key-Laser/PresentManager_rename_error_prompt'));
            }
        },
        onCreateManagerDefinition: async (definition, name, isCategorySelected, isCreate) => {
            let result = {};
            if (isCategorySelected) {
                const oldCategoryName = definition.category;
                definition.category = name;
                result = await dispatch(printingActions.duplicateMaterialCategoryDefinitionByType(managerDisplayType, definition, isCreate, oldCategoryName));
            } else {
                definition.name = name;
                result = await dispatch(printingActions.duplicateDefinitionByType(managerDisplayType, definition, undefined, name));
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            await dispatch(printingActions.removeDefinitionByType(managerDisplayType, definition));
        },
        removeCategoryDefinition: async (definition) => {
            await dispatch(printingActions.removeToolCategoryDefinition(managerDisplayType, definition.category));
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(printingActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (definitionId, shouldDestroyGcodeLine) => {
            return dispatch(printingActions.resetDefinitionById(managerDisplayType, definitionId, shouldDestroyGcodeLine));
        },
        updateActiveDefinition: (definitionId) => {
            dispatch(printingActions.updateActiveDefinitionById(managerDisplayType, definitionId));
        }
    };

    const optionConfigGroup = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? printingMaterialConfigGroup : printingQualityConfigGroup;
    const allDefinitions = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? materialDefinitions : qualityDefinitions;

    const selectedIds = {
        [PRINTING_MANAGER_TYPE_MATERIAL]: {
            id: materialManagerDirection === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight
        },
        [PRINTING_MANAGER_TYPE_QUALITY]: {
            id: defaultQualityId
        }
    };
    return (
        <ProfileManager
            outsideActions={actions}
            isOfficialDefinition={isOfficialDefinition}
            optionConfigGroup={optionConfigGroup}
            allDefinitions={allDefinitions}
            managerTitle={managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? 'key-Printing/PrintingConfigurations-Material Settings' : 'key-Printing/PrintingConfigurations-Printing Settings'}
            activeDefinitionID={selectedIds[managerDisplayType].id}
            managerType={managerDisplayType}
        />
    );
}

export default PrintingManager;
