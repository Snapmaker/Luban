import React from 'react';
// import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import { actions as laserActions } from '../../../flux/laser';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';

import { getMachineSeriesWithToolhead, LASER_PRESENT_CONFIG_GROUP, HEAD_LASER } from '../../../constants';
import ProfileManager from '../ProfileManager';
import i18n from '../../../lib/i18n';

function isOfficialDefinition(activeToolList) {
    return !!activeToolList.isDefault;
}

function LaserPresentManager({ closeToolManager, shouldSaveToolpath = false, saveToolPath, setCurrentToolDefinition }) {
    const toolDefinitions = useSelector(state => state?.laser?.toolDefinitions);
    const activeToolListDefinition = useSelector(state => state?.laser?.activeToolListDefinition, shallowEqual);
    const series = useSelector(state => state?.machine?.series);
    const toolHead = useSelector(state => state?.machine?.toolHead);
    const dispatch = useDispatch();

    const actions = {
        closeManager: () => {
            closeToolManager && closeToolManager();
        },
        onChangeFileForManager: (event) => {
            const toolFile = event.target.files[0];
            return dispatch(editorActions.onUploadToolDefinition(HEAD_LASER, toolFile));
        },
        exportConfigFile: (definitionForManager) => {
            const definitionId = definitionForManager.definitionId;
            const targetFile = `${definitionId}.def.json`;
            const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
            dispatch(projectActions.exportConfigFile(targetFile, `${HEAD_LASER}/${currentMachine.configPathname[HEAD_LASER]}`));
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
                return Promise.reject(i18n._('key-Laser/PresentManager_rename_error_prompt'));
            }
        },
        updateCategoryName: async (definition, selectedName) => {
            try {
                const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === definition.category);
                await dispatch(laserActions.updateToolDefinitionName(
                    true,
                    definitionsWithSameCategory[0].definitionId,
                    definitionsWithSameCategory[0].category,
                    selectedName,
                ));
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
                result = await dispatch(laserActions.duplicateToolCategoryDefinition(definition, isCreate, oldCategoryName));
            } else {
                definition.name = name;
                result = await dispatch(editorActions.duplicateToolListDefinition(HEAD_LASER, definition));
            }
            return result;
        },
        removeManagerDefinition: async (definition) => {
            const allDefinitions = await dispatch(laserActions.removeToolListDefinition(definition));

            if (activeToolListDefinition.definitionId === definition.definitionId) {
                actions.onUpdateDefaultDefinition(allDefinitions[0]);
            }
        },
        removeCategoryDefinition: async (definition) => {
            const allDefinitions = await dispatch(laserActions.removeToolCategoryDefinition(definition.category));

            if (activeToolListDefinition.category === definition.category) {
                actions.onUpdateDefaultDefinition(allDefinitions[0]);
            }
        },
        getDefaultDefinition: (definitionId) => {
            return dispatch(laserActions.getDefaultDefinition(definitionId));
        },
        resetDefinitionById: (definitionId) => {
            return dispatch(laserActions.resetDefinitionById(definitionId));
        }
    };

    return (
        <ProfileManager
            outsideActions={actions}
            isOfficialDefinition={isOfficialDefinition}
            optionConfigGroup={LASER_PRESENT_CONFIG_GROUP}
            allDefinitions={toolDefinitions}
            managerTitle="key-Laser/PresetManager-Preset Settings"
            activeDefinitionID={activeToolListDefinition.definitionId}
            managerType={HEAD_LASER}
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
