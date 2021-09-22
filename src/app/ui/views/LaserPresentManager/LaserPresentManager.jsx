import React from 'react';
// import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { includes } from 'lodash';
import PropTypes from 'prop-types';
import { actions as laserActions } from '../../../flux/laser';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';

import { LASER_PRESENT_CONFIG_GROUP, HEAD_LASER, DEFAULT_LASER_CONFIG_IDS } from '../../../constants';
import ProfileManager from '../ProfileManager';
import i18n from '../../../lib/i18n';

const selectedId = DEFAULT_LASER_CONFIG_IDS[0];

function isOfficialDefinition(activeToolList) {
    return includes(DEFAULT_LASER_CONFIG_IDS,
        activeToolList.definitionId);
}
function isDefinitionEditable(activeToolList) {
    return !(includes(DEFAULT_LASER_CONFIG_IDS,
        activeToolList.definitionId));
}

function LaserPresentManager({ closeToolManager, shouldSaveToolpath = false, saveToolPath, setCurrentToolDefinition }) {
    const toolDefinitions = useSelector(state => state?.laser?.toolDefinitions);
    const activeToolListDefinition = useSelector(state => state?.laser?.activeToolListDefinition, shallowEqual);
    const series = useSelector(state => state?.machine?.series);
    const dispatch = useDispatch();

    const actions = {
        closeManager: () => {
            closeToolManager && closeToolManager();
        },
        onChangeFileForManager: (event) => {
            const toolFile = event.target.files[0];
            dispatch(editorActions.onUploadToolDefinition(HEAD_LASER, toolFile));
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            dispatch(projectActions.exportConfigFile(targetFile, `${HEAD_LASER}/${series}`));
        },
        onUpdateDefaultDefinition: (definitionForManager) => {
            const { definitionId, name } = definitionForManager;
            dispatch(editorActions.changeActiveToolListDefinition(HEAD_LASER, definitionId, name));
            dispatch(editorActions.resetProcessState(HEAD_LASER));
            if (shouldSaveToolpath) {
                const newDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
                saveToolPath && saveToolPath(newDefinition);
                setCurrentToolDefinition && setCurrentToolDefinition(newDefinition);
            }
            dispatch(editorActions.refreshToolPathPreview(HEAD_LASER));
        },
        onSaveDefinitionForManager: async (definition) => {
            dispatch(laserActions.updateToolListDefinition(definition));
        },
        updateDefinitionName: async (definition, selectedName) => {
            try {
                await dispatch(laserActions.updateToolDefinitionName(false, definition.definitionId, definition.name, selectedName));
                return null;
            } catch (e) {
                return Promise.reject(i18n._('key_ui/views/LaserPresentManager/LaserPresentManager_Failed to rename. Name already exists.'));
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === definition.category);
                for (let i = 0; i < definitionsWithSameCategory.length; i++) {
                    await dispatch(laserActions.updateToolDefinitionName(
                        true,
                        definitionsWithSameCategory[i].definitionId,
                        definitionsWithSameCategory[i].category,
                        selectedName,
                    ));
                }
                return null;
            } catch (e) {
                return Promise.reject(i18n._('key_ui/views/LaserPresentManager/LaserPresentManager_Failed to rename. Name already exists.'));
            }
        },
        onCreateManagerDefinition: async (definition, name, isCategorySelected, isCreate) => {
            let result = {};
            if (isCategorySelected) {
                const oldCategoryName = definition.category;
                definition.category = name;
                result = await dispatch(laserActions.duplicateToolCategoryDefinition(definition, isCreate, oldCategoryName));
            } else {
                definition.name = name;
                result = await dispatch(editorActions.duplicateToolListDefinition(HEAD_LASER, definition));
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            await dispatch(laserActions.removeToolListDefinition(definition));
        },
        removeToolCategoryDefinition: (definition) => {
            dispatch(laserActions.removeToolCategoryDefinition(definition.category));
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(laserActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (definitionId) => {
            dispatch(laserActions.resetDefinitionById(definitionId));
        }
    };
    const optionConfigGroup = LASER_PRESENT_CONFIG_GROUP;
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
            managerTitle="Present Settings"
            selectedId={selectedId}
            headType={HEAD_LASER}
        />
    );
}
LaserPresentManager.propTypes = {
    shouldSaveToolpath: PropTypes.bool,
    saveToolPath: PropTypes.func,
    setCurrentToolDefinition: PropTypes.func,
    closeToolManager: PropTypes.func.isRequired
};
export default LaserPresentManager;
