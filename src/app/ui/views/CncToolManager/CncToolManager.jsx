import React from 'react';
// import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { includes } from 'lodash';
import PropTypes from 'prop-types';
import { actions as cncActions } from '../../../flux/cnc';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';

import { CNC_TOOL_CONFIG_GROUP, HEAD_CNC, DEFAULT_CNC_CONFIG_IDS } from '../../../constants';
import ProfileManager from '../ProfileManager';
import i18n from '../../../lib/i18n';

const selectedId = DEFAULT_CNC_CONFIG_IDS[0];

function isOfficialDefinition(activeToolList) {
    return includes(DEFAULT_CNC_CONFIG_IDS,
        activeToolList.definitionId);
}
function isDefinitionEditable(activeToolList) {
    return !(includes(DEFAULT_CNC_CONFIG_IDS,
        activeToolList.definitionId));
}

function CncToolManager({ closeToolManager, shouldSaveToolpath = false, saveToolPath, setCurrentToolDefinition }) {
    const toolDefinitions = useSelector(state => state?.cnc?.toolDefinitions);
    const activeToolListDefinition = useSelector(state => state?.cnc?.activeToolListDefinition, shallowEqual);
    const series = useSelector(state => state?.machine?.series);
    const dispatch = useDispatch();

    const actions = {
        closeManager: () => {
            closeToolManager && closeToolManager();
        },
        onChangeFileForManager: (event) => {
            const toolFile = event.target.files[0];
            dispatch(cncActions.onUploadToolDefinition(toolFile));
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            dispatch(projectActions.exportConfigFile(targetFile, `cnc/${series}`));
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const { definitionId, name } = definitionForManager;
            dispatch(cncActions.changeActiveToolListDefinition(definitionId, name));
            dispatch(editorActions.resetProcessState(HEAD_CNC));
            if (shouldSaveToolpath) {
                const newDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
                saveToolPath && saveToolPath(newDefinition);
                setCurrentToolDefinition && setCurrentToolDefinition(newDefinition);
            }
            dispatch(editorActions.refreshToolPathPreview(HEAD_CNC));
        },
        onSaveDefinitionForManager: async (definition) => {
            dispatch(cncActions.updateToolListDefinition(definition));
        },
        updateDefinitionName: async (definition, selectedName) => {
            try {
                await dispatch(cncActions.updateToolDefinitionName(false, definition.definitionId, definition.name, selectedName));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('Failed to rename. Name already exists.'));
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === definition.category);
                for (let i = 0; i < definitionsWithSameCategory.length; i++) {
                    await dispatch(cncActions.updateToolDefinitionName(
                        true,
                        definitionsWithSameCategory[i].definitionId,
                        definitionsWithSameCategory[i].category,
                        selectedName,
                    ));
                }
                return null;
            } catch (e) {
                return Promise.reject(i18n._('Failed to rename. Name already exists.'));
            }
        },
        onCreateManagerDefinition: async (definition, name, isCategorySelected, isCreate) => {
            let result = {};
            if (isCategorySelected) {
                const oldCategoryName = definition.category;
                definition.category = name;
                result = await dispatch(cncActions.duplicateToolCategoryDefinition(definition, isCreate, oldCategoryName));
            } else {
                definition.name = name;
                result = await dispatch(cncActions.duplicateToolListDefinition(definition));
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            await dispatch(cncActions.removeToolListDefinition(definition));
        },
        removeToolCategoryDefinition: (definition) => {
            dispatch(cncActions.removeToolCategoryDefinition(definition.category));
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(cncActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (definitionId) => {
            dispatch(cncActions.resetDefinitionById(definitionId));
        }
    };
    const optionConfigGroup = CNC_TOOL_CONFIG_GROUP;
    const allDefinitions = toolDefinitions;

    return (
        <ProfileManager
            outsideActions={actions}
            activeDefinition={activeToolListDefinition}
            isDefinitionEditable={isDefinitionEditable}
            isOfficialDefinition={isOfficialDefinition}
            optionConfigGroup={optionConfigGroup}
            allDefinitions={allDefinitions}
            disableCategory={false}
            managerTitle="Tool Settings"
            selectedId={selectedId}
        />
    );
}
CncToolManager.propTypes = {
    shouldSaveToolpath: PropTypes.bool,
    saveToolPath: PropTypes.func,
    setCurrentToolDefinition: PropTypes.func,
    closeToolManager: PropTypes.func.isRequired
};
export default CncToolManager;
