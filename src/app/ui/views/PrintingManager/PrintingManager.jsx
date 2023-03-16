import React, { useCallback, useEffect, useState } from 'react';
import { includes } from 'lodash';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';


import {
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY,
    HEAD_PRINTING,
    LEFT_EXTRUDER
} from '../../../constants';
import { getMachineSeriesWithToolhead } from '../../../constants/machines';

/* eslint-disable import/no-cycle */
import i18n from '../../../lib/i18n';

import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import { actions as machineActions } from '../../../flux/machine';

import ProfileManager from '../ProfileManager';
import { PresetModifierModal } from '../PresetModifier';

// const materialText = (label, color) => {
//     return (
//         <div>
//             <span>{label}</span>
//             <div className={`width-16 height-16 background-${color}`} />
//         </div>
//     );
// };

function isOfficialDefinition(definition) {
    return definition?.isRecommended;
}

function PrintingManager() {
    const showPrintingManager = useSelector((state) => state?.printing?.showPrintingManager);
    const showPrintParameterModifierDialog = useSelector(
        (state) => state.printing.showPrintParameterModifierDialog
    );
    const defaultMaterialId = useSelector(
        (state) => state?.printing?.defaultMaterialId,
        shallowEqual
    );
    const defaultMaterialIdRight = useSelector(
        (state) => state?.printing?.defaultMaterialIdRight,
        shallowEqual
    );
    const activePresetIds = useSelector((state) => state.printing.activePresetIds);
    const managerDisplayType = useSelector(
        (state) => state?.printing?.managerDisplayType,
        shallowEqual
    );

    const materialDefinitions = useSelector((state) => state.printing.materialDefinitions);

    const materialManagerDirection = useSelector(
        (state) => state?.printing?.materialManagerDirection,
        shallowEqual
    );
    // TODO: Update materialDifinitions Data, for TreeSelect
    // const [materialOptions, setMaterialOptions] = useState(materialDefinitions);
    const qualityDefinitionsModels = useSelector(
        (state) => state?.printing?.qualityDefinitions
    );
    const series = useSelector((state) => state?.machine?.series);
    const toolHead = useSelector((state) => state?.machine?.toolHead);
    const printingProfileLevel = useSelector((state) => state?.printing?.printingProfileLevel);
    const materialProfileLevel = useSelector((state) => state?.printing?.materialProfileLevel);
    const dispatch = useDispatch();
    const [allDefinitions, setAllDefinitions] = useState();
    const customConfigs = useSelector(state => state?.machine?.printingCustomConfigsWithCategory);
    const onChangeCustomConfig = useCallback((key, checked, category) => {
        const newCustomConfig = { ...customConfigs };
        if (checked && !includes(newCustomConfig[category], key)) {
            newCustomConfig[category] = newCustomConfig[category] || [];
            newCustomConfig[category].push(key);
        } else if (!checked) {
            newCustomConfig[category] = newCustomConfig[category].filter(a => a !== key);
        }

        dispatch(machineActions.updatePrintingCustomConfigsWithCategory(newCustomConfig[category], category));
    }, [customConfigs]);

    useEffect(() => {
        if (managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL) {
            setAllDefinitions(materialDefinitions);
        } else {
            // showing all quality presets (not only for active material)
            setAllDefinitions(qualityDefinitionsModels);
        }
    }, [managerDisplayType, materialDefinitions, qualityDefinitionsModels, defaultMaterialId]);

    const actions = {
        closeManager: () => {
            dispatch(printingActions.updateShowPrintingManager(false));
        },
        closePrintParameterModifier: () => {
            dispatch(printingActions.updateState({
                showPrintParameterModifierDialog: false
            }));
        },
        onChangeFileForManager: (event) => {
            const file = event.target.files[0];
            return dispatch(
                printingActions.onUploadManagerDefinition(
                    file,
                    managerDisplayType
                )
            );
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(
                series,
                toolHead
            );
            dispatch(
                projectActions.exportConfigFile(
                    targetFile,
                    currentMachine.configPathname[HEAD_PRINTING],
                    `${definitionForManager?.name}.def.json`
                )
            );
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            dispatch(printingActions.updateDefaultIdByType(managerDisplayType, definitionId, materialManagerDirection));
            dispatch(projectActions.autoSaveEnvironment(HEAD_PRINTING));
        },
        onSaveDefinitionForManager: async (
            newDefinition,
            changedSettingArray = [],
            shouldUpdateActive
        ) => {
            await dispatch(
                printingActions.updateCurrentDefinition({
                    definitionModel: newDefinition,
                    changedSettingArray,
                    managerDisplayType
                })
            );
            if (shouldUpdateActive) {
                dispatch(printingActions.destroyGcodeLine());
                dispatch(printingActions.displayModel());
            }
        },

        onUpdatePreset: (presetModel, changedSettingArray = []) => {
            return dispatch(
                printingActions.updateCurrentDefinition({
                    managerDisplayType,
                    definitionModel: presetModel,
                    changedSettingArray,
                })
            );
        },

        updateDefinitionName: async (definition, selectedName) => {
            try {
                await dispatch(
                    printingActions.updateDefinitionNameByType(
                        managerDisplayType,
                        definition,
                        selectedName
                    )
                );
                return null;
            } catch (e) {
                return Promise.reject(
                    i18n._('key-Printing/PrintingManager_rename_error_prompt')
                );
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                await dispatch(
                    printingActions.updateDefinitionNameByType(
                        managerDisplayType,
                        definition,
                        selectedName,
                        true
                    )
                );
                return null;
            } catch (e) {
                return Promise.reject(
                    i18n._('key-Laser/PresentManager_rename_error_prompt')
                );
            }
        },
        onCreateManagerDefinition: async (
            definition,
            name,
            isCategorySelected,
            isCreate
        ) => {
            let result = {};
            if (isCategorySelected) {
                const oldCategoryName = definition.category;
                definition.category = name;
                result = await dispatch(
                    printingActions.duplicateMaterialCategoryDefinitionByType(
                        managerDisplayType,
                        definition,
                        isCreate,
                        oldCategoryName
                    )
                );
            } else {
                definition.name = name;
                result = await dispatch(
                    printingActions.duplicateDefinitionByType(
                        managerDisplayType,
                        definition,
                        undefined,
                        name
                    )
                );
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            await dispatch(
                printingActions.removeDefinitionByType(
                    managerDisplayType,
                    definition
                )
            );
        },
        removeCategoryDefinition: async (definition) => {
            await dispatch(
                printingActions.removeToolCategoryDefinition(
                    managerDisplayType,
                    definition.category
                )
            );
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(printingActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (definitionId, shouldDestroyGcodeLine) => {
            return dispatch(
                printingActions.resetDefinitionById(
                    managerDisplayType,
                    definitionId,
                    shouldDestroyGcodeLine
                )
            );
        }
    };

    const selectedIds = {
        [PRINTING_MANAGER_TYPE_MATERIAL]: {
            id:
                materialManagerDirection === LEFT_EXTRUDER
                    ? defaultMaterialId
                    : defaultMaterialIdRight
        },
        [PRINTING_MANAGER_TYPE_QUALITY]: {
            id: activePresetIds[LEFT_EXTRUDER],
        }
    };

    if (!showPrintingManager && !showPrintParameterModifierDialog) {
        return null;
    }

    return (
        <>
            {
                showPrintingManager && (
                    <ProfileManager
                        outsideActions={actions}
                        isOfficialDefinition={isOfficialDefinition}
                        customConfig={customConfigs}
                        optionConfigGroup={managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL ? materialProfileLevel : printingProfileLevel}
                        allDefinitions={allDefinitions}
                        managerTitle={
                            managerDisplayType === PRINTING_MANAGER_TYPE_MATERIAL
                                ? i18n._('key-Printing/PrintingConfigurations-Material Settings')
                                : i18n._('key-Printing/PrintingConfigurations-Printing Settings')
                        }
                        activeDefinitionID={selectedIds[managerDisplayType].id}
                        managerType={managerDisplayType}
                        onChangeCustomConfig={onChangeCustomConfig}
                    />
                )
            }
            {
                showPrintParameterModifierDialog && (
                    <PresetModifierModal
                        outsideActions={actions}
                        defaultStackId={showPrintParameterModifierDialog}
                    />
                )
            }
        </>
    );
}

export default PrintingManager;
