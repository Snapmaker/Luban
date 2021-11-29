import React from 'react';
import { includes } from 'lodash';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_MATERIAL_CONFIG_KEYS, PRINTING_QUALITY_CONFIG_KEYS,
    getMachineSeriesWithToolhead, HEAD_PRINTING,
    PRINTING_MATERIAL_CONFIG_GROUP, PRINTING_QUALITY_CONFIG_GROUP } from '../../../constants';
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

// Only custom material is editable, changes on diameter is not allowed as well
function isDefinitionEditable(definition, key) {
    return !definition?.metadata?.readonly
        && key !== 'material_diameter';
}

function isOfficialDefinition(definition) {
    return definition && includes(['material.pla', 'material.abs', 'material.petg', 'quality.fast_print', 'quality.normal_quality', 'quality.high_quality'],
        definition.definitionId);
}

function PrintingManager() {
    const showPrintingManager = useSelector(state => state?.printing?.showPrintingManager, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultQualityId = useSelector(state => state?.printing?.defaultQualityId, shallowEqual);
    const managerDisplayType = useSelector(state => state?.printing?.managerDisplayType, shallowEqual);
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions);
    // TODO: Update materialDifinitions Data, for TreeSelect
    // const [materialOptions, setMaterialOptions] = useState(materialDefinitions);
    const qualityDefinitions = useSelector(state => state?.printing?.qualityDefinitions);
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const dispatch = useDispatch();
    if (!showPrintingManager) {
        return null;
    }

    // useEffect(() => {
    //     const newMaterialOptions = [];
    //     materialDefinitions.forEach(item => {
    //         const color = item.name.split('-')[1];
    //         console.log({ color });
    //         newMaterialOptions.push({
    //             title: <div>test</div>,
    //             value: item.definitionId
    //         });
    //     });
    //     setMaterialOptions(newMaterialOptions);
    //     console.log({ newMaterialOptions, materialOptions });
    // }, []);
    const actions = {
        closeManager: () => {
            dispatch(printingActions.updateShowPrintingManager(false));
        },
        onChangeFileForManager: (event) => {
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                const materialFile = event.target.files[0];
                dispatch(printingActions.onUploadManagerDefinition(materialFile, managerDisplayType));
            } else {
                const qualityFile = event.target.files[0];
                dispatch(printingActions.onUploadManagerDefinition(qualityFile, managerDisplayType));
            }
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
            dispatch(projectActions.exportConfigFile(targetFile, `${HEAD_PRINTING}/${currentMachine.configPathname[HEAD_PRINTING]}`));
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            dispatch(printingActions.updateDefaultIdByType(managerDisplayType, definitionId));
        },
        onSaveDefinitionForManager: (newDefinition) => {
            // now setDefinitionState is synchronize, so remove setTimeout
            if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
                actions.onSaveMaterialForManager(managerDisplayType, newDefinition);
            } else {
                actions.onSaveQualityForManager(managerDisplayType, newDefinition);
            }
        },
        onSaveQualityForManager: async (type, newDefinition) => {
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(newDefinition.settings)) {
                if (PRINTING_QUALITY_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }

            await dispatch(printingActions.updateDefinitionSettings(newDefinition, newDefinitionSettings));
            dispatch(printingActions.updateDefinitionsForManager(newDefinition.definitionId, type));
        },
        onSaveMaterialForManager: async (type, newDefinition) => {
            const newDefinitionSettings = {};
            for (const [key, value] of Object.entries(newDefinition?.settings)) {
                if (PRINTING_MATERIAL_CONFIG_KEYS.indexOf(key) > -1) {
                    newDefinitionSettings[key] = { 'default_value': value.default_value };
                }
            }
            await dispatch(printingActions.updateDefinitionSettings(newDefinition, newDefinitionSettings));
            dispatch(printingActions.updateDefinitionsForManager(newDefinition.definitionId, type));
        },

        updateDefinitionName: async (definition, selectedName) => {
            try {
                await dispatch(printingActions.updateDefinitionNameByType(managerDisplayType, definition, selectedName));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('key-Printing/PrintingManager_rename_error_prompt'));
            }
        },

        // TODO
        onCreateManagerDefinition: async (definition, name) => {
            const newDefinition = await dispatch(printingActions.duplicateDefinitionByType(managerDisplayType, definition, undefined, name));
            return newDefinition;
        },
        removeManagerDefinition: async (definition) => {
            await dispatch(printingActions.removeDefinitionByType(managerDisplayType, definition));
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(printingActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (id) => {
            dispatch(printingActions.resetDefinitionById(id));
        }
    };

    const optionConfigGroup = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? PRINTING_MATERIAL_CONFIG_GROUP : PRINTING_QUALITY_CONFIG_GROUP;
    const allDefinitions = managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? materialDefinitions : qualityDefinitions;

    const selectedIds = {
        [PRINTING_MANAGER_TYPE_MATERIAL]: {
            id: defaultMaterialId
        },
        [PRINTING_MANAGER_TYPE_QUALITY]: {
            id: defaultQualityId
        }
    };
    return (
        <ProfileManager
            outsideActions={actions}
            isDefinitionEditable={isDefinitionEditable}
            isOfficialDefinition={isOfficialDefinition}
            optionConfigGroup={optionConfigGroup}
            allDefinitions={allDefinitions}
            managerTitle={managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? 'key-Printing/PrintingConfigurations-Material Settings' : 'key-Printing/PrintingConfigurations-Printing Settings'}
            selectedId={selectedIds[managerDisplayType].id}
            headType="printing"
        />
    );
}

export default PrintingManager;
