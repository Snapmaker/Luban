import React from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { includes, cloneDeep } from 'lodash';

import { actions as cncActions } from '../../../flux/cnc';
import { actions as projectActions } from '../../../flux/project';
import styles from './styles.styl';

import { CNC_TOOL_CONFIG_GROUP } from '../../../constants';
import ProfileManager from '../profile-manager';
import i18n from '../../../lib/i18n';

const SUBCATEGORY = 'CncConfig';
const defaultToolListNames = [
    'Carving V-bit',
    'Flat End Mill',
    'Ball End Mill',
    'Straight Groove V-bit'
];

function isOfficialDefinition(activeToolList) {
    return includes(['Default'],
        activeToolList.definitionId)
            && includes(defaultToolListNames,
                activeToolList.name);
}
function isDefinitionEditable(activeToolList) {
    return !(includes(['Default'],
        activeToolList.definitionId)
            && includes(defaultToolListNames,
                activeToolList.name));
}


function adaptateToProfileDefinitions(toolDefinitions) {
    const newDefinitions = cloneDeep(toolDefinitions);
    const result = [];
    newDefinitions.forEach((toolCategory) => {
        toolCategory.toolList.forEach((list) => {
            if (list) {
                const item = {};
                item.category = toolCategory.category;
                item.definitionId = toolCategory.definitionId;
                item.name = list.name;
                item.settings = list.config;
                result.push(item);
            }
        });
        if (toolCategory.toolList.length === 0) {
            const item = {};
            item.category = toolCategory.category;
            item.definitionId = toolCategory.definitionId;
            item.settings = {};
            result.push(item);
        }
    });
    return result;
}
function adaptateToToolDefinition(toolDefinitions, definition, newName) {
    const newDefinitions = cloneDeep(toolDefinitions);
    const activeToolCategory = newDefinitions.find((toolCategory) => toolCategory?.definitionId === definition?.definitionId);
    const activeToolList = newName ? { ...definition, name: newName } : definition;
    const oldConfig = activeToolList.settings;
    activeToolList.config = oldConfig;
    return {
        activeToolCategory,
        activeToolList
    };
}

function CncToolManager() {
    const showCncToolManager = useSelector(state => state?.cnc?.showCncToolManager, shallowEqual);
    const toolDefinitions = useSelector(state => state?.cnc?.toolDefinitions);
    // const activeToolListDefinition = useSelector(state => state?.cnc?.activeToolListDefinition, shallowEqual);
    const dispatch = useDispatch();
    if (!showCncToolManager) {
        return null;
    }

    const actions = {
        closeManager: () => {
            dispatch(cncActions.updateShowCncToolManager(false));
        },
        onChangeFileForManager: (event) => {
            const toolFile = event.target.files[0];
            dispatch(cncActions.onUploadToolDefinition(toolFile));
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            dispatch(projectActions.exportConfigFile(targetFile, SUBCATEGORY));
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const { definitionId, name } = definitionForManager;
            dispatch(cncActions.changeActiveToolListDefinition(definitionId, name));
        },
        onSaveDefinitionForManager: async (definition) => {
            const { activeToolList } = adaptateToToolDefinition(toolDefinitions, definition);
            dispatch(cncActions.updateToolListDefinition(activeToolList));
        },
        updateDefinitionName: async (definition, selectedName) => {
            try {
                const { activeToolList } = adaptateToToolDefinition(toolDefinitions, definition);
                await dispatch(cncActions.updateToolDefinitionName(false, activeToolList.definitionId, activeToolList.name, selectedName));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('Failed to rename. Name already exists.'));
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                const { activeToolList } = adaptateToToolDefinition(toolDefinitions, definition);
                await dispatch(cncActions.updateToolDefinitionName(true, activeToolList.definitionId, activeToolList.category, selectedName));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('Failed to rename. Name already exists.'));
            }
        },
        onCreateManagerDefinition: async (definition, name, isCategorySelected, isEmptyCategory = false) => {
            const { activeToolCategory, activeToolList } = adaptateToToolDefinition(toolDefinitions, definition, name);
            let result = {};
            if (isCategorySelected) {
                activeToolCategory.category = name;
                if (isEmptyCategory) {
                    activeToolCategory.toolList = [];
                }
                result = await dispatch(cncActions.duplicateToolCategoryDefinition(activeToolCategory));
            } else {
                result = await dispatch(cncActions.duplicateToolListDefinition(activeToolCategory, activeToolList));
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            const { activeToolCategory, activeToolList } = adaptateToToolDefinition(toolDefinitions, definition);
            await dispatch(cncActions.removeToolListDefinition(activeToolCategory, activeToolList));
        },
        removeToolCategoryDefinition: (definitionId) => {
            dispatch(cncActions.removeToolCategoryDefinition(definitionId));
        }
    };
    const optionConfigGroup = CNC_TOOL_CONFIG_GROUP;
    const allDefinitions = adaptateToProfileDefinitions(toolDefinitions);
    const defaultKeysAndId = {
        id: 'Default',
        name: 'Carving V-bit',
        keysArray: []
    };
    // console.log('cnc allDefinitions', allDefinitions);
    return (
        <ProfileManager
            styles={styles}
            outsideActions={actions}
            isDefinitionEditable={isDefinitionEditable}
            isOfficialDefinition={isOfficialDefinition}
            optionConfigGroup={optionConfigGroup}
            allDefinitions={allDefinitions}
            disableCategory={false}
            managerTitle="Tool"
            defaultKeysAndId={defaultKeysAndId}
        />
    );
}
export default CncToolManager;
