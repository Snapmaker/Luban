import React from 'react';
// import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { includes } from 'lodash';
import PropTypes from 'prop-types';
import { actions as cncActions } from '../../../flux/cnc';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';

import {
    CNC_TOOL_CONFIG_GROUP, HEAD_CNC, DEFAULT_CNC_CONFIG_IDS
} from '../../../constants';
import ProfileManager from '../ProfileManagerForLaserCnc';
import i18n from '../../../lib/i18n';
import { getMachineSeriesWithToolhead } from '../../../constants/machines';

function isOfficialDefinition(activeToolList) {
    return includes(DEFAULT_CNC_CONFIG_IDS,
        activeToolList.definitionId);
}

function CncToolManager({ closeToolManager, shouldSaveToolpath = false, saveToolPath, setCurrentToolDefinition }) {
    const toolDefinitions = useSelector(state => state?.cnc?.toolDefinitions);
    const activeToolListDefinition = useSelector(state => state?.cnc?.activeToolListDefinition, shallowEqual);
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const dispatch = useDispatch();
    const actions = {
        closeManager: () => {
            closeToolManager && closeToolManager();
        },
        onChangeFileForManager: (event) => {
            const toolFile = event.target.files[0];
            return dispatch(editorActions.onUploadToolDefinition(HEAD_CNC, toolFile));
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
            dispatch(projectActions.exportConfigFile(
                targetFile,
                currentMachine.configPathname[HEAD_CNC],
                `${i18n._(definitionForManager.i18nName || definitionForManager.name)}.def.json`
            ));
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const { definitionId, name } = definitionForManager;
            dispatch(editorActions.changeActiveToolListDefinition(HEAD_CNC, definitionId, name));
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
                return Promise.reject(i18n._('key-Cnc/ToolManager-Failed to rename. Name already exists.'));
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === definition.category);
                await dispatch(cncActions.updateToolDefinitionName(
                    true,
                    definitionsWithSameCategory[0].definitionId,
                    definitionsWithSameCategory[0].category,
                    selectedName,
                ));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('key-Cnc/ToolManager-Failed to rename. Name already exists.'));
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
                result = await dispatch(editorActions.duplicateToolListDefinition(HEAD_CNC, definition));
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            const allDefinitions = await dispatch(cncActions.removeToolListDefinition(definition));

            if (activeToolListDefinition.definitionId === definition.definitionId) {
                actions.onUpdateDefaultDefinition(allDefinitions[0]);
            }
        },
        removeCategoryDefinition: async (definition) => {
            const allDefinitions = await dispatch(cncActions.removeToolCategoryDefinition(definition.category));

            if (activeToolListDefinition.category === definition.category) {
                actions.onUpdateDefaultDefinition(allDefinitions[0]);
            }
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(cncActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (definitionId) => {
            return dispatch(cncActions.resetDefinitionById(definitionId));
        }
    };
    const optionConfigGroup = CNC_TOOL_CONFIG_GROUP;
    const allDefinitions = toolDefinitions;

    return (
        <ProfileManager
            outsideActions={actions}
            isOfficialDefinition={isOfficialDefinition}
            optionConfigGroup={optionConfigGroup}
            allDefinitions={allDefinitions}
            managerTitle="key-Cnc/ToolManger-Tool Settings"
            activeDefinitionID={activeToolListDefinition.definitionId}
            managerType={HEAD_CNC}
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
