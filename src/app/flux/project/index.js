import cloneDeep from 'lodash/cloneDeep';
import find from 'lodash/find';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_3DP,
    HEAD_TYPE_ENV_NAME,
    SOURCE_TYPE_IMAGE3D,
    PROCESS_MODE_MESH,
    getCurrentHeadType,
    COORDINATE_MODE_CENTER, COORDINATE_MODE_BOTTOM_CENTER, PAGE_EDITOR, DISPLAYED_TYPE_MODEL,
    MAX_RECENT_FILES_LENGTH
} from '../../constants';
import api from '../../api';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
// import machineAction from '../machine/action-base';
import { actions as workspaceActions } from '../workspace';
import { bubbleSortByAttribute } from '../../lib/numeric-utils';
import { actions as operationHistoryActions } from '../operation-history';

import i18n from '../../lib/i18n';
import UniApi from '../../lib/uni-api';

const INITIAL_STATE = {
    [HEAD_3DP]: {
        findLastEnvironment: false,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    [HEAD_CNC]: {
        findLastEnvironment: false,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    [HEAD_LASER]: {
        findLastEnvironment: false,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    general: {
        recentFiles: [],
        recentFilesLength: -1
    }
};
const ACTION_UPDATE_STATE = 'EDITOR_ACTION_UPDATE_STATE';

const headType2FluxMod = (headType) => {
    return headType === '3dp' ? 'printing' : headType;
};

export const actions = {
    updateState: (headType, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            headType,
            state
        };
    },

    initRecoverService: () => (dispatch, getState) => {
        const startService = (envHeadType) => {
            // disable auto recovery if openedFile set
            const { openedFile } = getState().project[envHeadType];
            if (!openedFile) {
                dispatch(actions.getLastEnvironment(envHeadType));
            }

            const action = actions.autoSaveEnvironment(envHeadType);
            setInterval(() => dispatch(action), 1000);
        };

        startService(HEAD_LASER);
        startService(HEAD_CNC);
        startService(HEAD_3DP);
    },

    autoSaveEnvironment: (headType, force = false) => async (dispatch, getState) => {
        const fluxMod = headType2FluxMod(headType);
        const editorState = getState()[fluxMod];
        const { initState, content: lastString } = getState().project[headType];

        const models = editorState.modelGroup.getModels();
        // dispatch(actions.updateState(headType, { hasModel: !!models.length }));
        if (!models.length && initState) return;

        const machineState = getState().machine;
        const { size, series } = machineState;
        const { defaultMaterialId, defaultQualityId, isRecommended } = editorState;
        const machineInfo = {};
        machineInfo.headType = headType;
        machineInfo.size = size;
        machineInfo.series = series;

        const envObj = { machineInfo, defaultMaterialId, defaultQualityId, isRecommended, models: [], toolpaths: [] };
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            const { materials, coordinateMode, coordinateSize } = getState()[headType];
            envObj.materials = materials;
            envObj.coordinateMode = coordinateMode;
            envObj.coordinateSize = coordinateSize;
        }
        for (let key = 0; key < models.length; key++) {
            const model = models[key];
            envObj.models.push(model.getSerializableConfig());
        }
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            const toolPaths = editorState.toolPathGroup.getToolPaths();
            envObj.toolpaths = toolPaths;
        }
        const content = JSON.stringify(envObj);

        if (force || content !== lastString) {
            dispatch(actions.updateState(headType, { content, unSaved: true, initState: false }));
            await api.saveEnv({ content });
        }
    },

    getLastEnvironment: (headType) => async (dispatch) => {
        const { body: { content } } = await api.getEnv({ headType });
        content && dispatch(actions.updateState(headType, { findLastEnvironment: true, content }));
    },

    clearSavedEnvironment: (headType) => async (dispatch) => {
        try {
            await api.removeEnv({ headType });
        } catch (e) {
            console.log(e);
        }

        dispatch(actions.updateState(headType, { findLastEnvironment: false, unSaved: false }));
    },

    onRecovery: (envHeadType, envObj, backendRecover = true) => async (dispatch, getState) => {
        UniApi.Window.setOpenedFile();
        const { content } = getState().project[envHeadType];
        // backup project if needed
        if (backendRecover) {
            await api.recoverEnv({ content });
        }
        if (!envObj) {
            envObj = JSON.parse(content);
        }
        // const envObj = JSON.parse(content);
        let modActions = null;
        let modState = null;
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            // clear operation history
            dispatch(operationHistoryActions.clear(envHeadType));
            modActions = editorActions;
            modState = getState()[envHeadType];
        }
        if (envHeadType === HEAD_3DP) {
            // clear operation history
            dispatch(operationHistoryActions.clear('printing'));
            modActions = printingActions;
            modState = getState().printing;
            await dispatch(printingActions.initSize());
        }
        const { modelGroup } = modState;
        // await dispatch(modActions.init(envHeadType));
        modelGroup.removeAllModels();

        await modState?.SVGActions?.svgContentGroup.removeAllElements();
        // eslint-disable-next-line prefer-const
        let { models, toolpaths, materials, coordinateMode, coordinateSize, machineInfo, ...restState } = envObj;
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            if (materials) {
                dispatch(editorActions.updateMaterials(envHeadType, materials));
            }
            const isRotate = materials ? materials.isRotate : false;
            if (coordinateMode) {
                dispatch(editorActions.updateState(envHeadType, {
                    coordinateMode: coordinateMode,
                    coordinateSize: coordinateSize ?? machineInfo.size
                }));
            } else {
                dispatch(editorActions.updateState(envHeadType, {
                    coordinateMode: (!isRotate ? COORDINATE_MODE_CENTER : COORDINATE_MODE_BOTTOM_CENTER),
                    coordinateSize: coordinateSize ?? machineInfo.size
                }));
            }
        }
        models = bubbleSortByAttribute(models, ['transformation', 'positionZ']);

        // Compatible with mesh mode
        for (const model of models) {
            if (model.sourceType === SOURCE_TYPE_IMAGE3D) {
                model.mode = PROCESS_MODE_MESH;
            }
        }

        for (let k = 0; k < models.length; k++) {
            const { headType, originalName, uploadName, config, sourceType, gcodeConfig, sourceWidth, sourceHeight, mode, transformation, modelID } = models[k];
            // prevent project recovery recorded into operation history
            if (envHeadType === '3dp') {
                dispatch(operationHistoryActions.excludeModelById('printing', modelID));
            } else {
                dispatch(operationHistoryActions.excludeModelById(envHeadType, modelID));
            }
            await dispatch(modActions.generateModel(headType, originalName, uploadName, sourceWidth, sourceHeight, mode,
                sourceType, config, gcodeConfig, transformation, modelID));
        }
        const { toolPathGroup } = modState;
        if (toolPathGroup && toolPathGroup.toolPaths && toolPathGroup.toolPaths.length) {
            toolPathGroup.deleteAllToolPaths();
        }
        if (toolpaths && toolpaths.length) {
            for (let k = 0; k < toolpaths.length; k++) {
                toolPathGroup.saveToolPath(toolpaths[k], { materials }, false);
            }
            toolPathGroup.selectToolPathById(null);
            dispatch(modActions.updateState(envHeadType, toolPathGroup));
        }
        dispatch(modActions.updateState(envHeadType, restState));

        if (envHeadType === HEAD_3DP) {
            dispatch(modActions.updateState(restState));
        } else {
            dispatch(modActions.updateState(envHeadType, restState));
        }
        // // TODO: set current content to avoid <unSaved> flag mis-set
        // await dispatch(actions.clearSavedEnvironment(envHeadType));
    },

    quitRecovery: (headType) => async (dispatch) => {
        dispatch(actions.clearSavedEnvironment(headType));
    },

    exportFile: (targetFile) => async () => {
        const tmpFile = `/Tmp/${targetFile}`;
        await UniApi.File.exportAs(targetFile, tmpFile);
    },

    exportConfigFile: (targetFile, subCategory) => async () => {
        let configFile;
        if (subCategory) {
            configFile = `/Config/${subCategory}/${targetFile}`;
        } else {
            configFile = `/Config/${targetFile}`;
        }
        await UniApi.File.exportAs(targetFile, configFile);
    },
    setOpenedFileWithType: (headType, openedFile) => async (dispatch) => {
        openedFile && UniApi.Window.setOpenedFile(openedFile?.name);
        await dispatch(actions.updateState(headType, { findLastEnvironment: false, openedFile, unSaved: false }));
        UniApi.Menu.setItemEnabled('save', !!openedFile);
    },

    saveAsFile: (headType) => async (dispatch) => {
        const { body: { targetFile } } = await api.packageEnv({ headType });
        const tmpFile = `/Tmp/${targetFile}`;
        const openedFile = await UniApi.File.saveAs(targetFile, tmpFile);
        if (openedFile) {
            await dispatch(actions.setOpenedFileWithType(headType, openedFile));
        }
        await dispatch(actions.clearSavedEnvironment(headType));
    },
    save: (headType, dialogOptions = false) => async (dispatch, getState) => {
        // save should return when no model in editor
        let modelGroup;
        if (headType === HEAD_3DP) {
            modelGroup = getState().printing.modelGroup;
        } else {
            modelGroup = getState()[headType].modelGroup;
        }
        if (!modelGroup || !modelGroup.hasModel()) {
            return;
        }

        const state = getState().project[headType];
        const { openedFile, unSaved } = state;
        if (!unSaved) {
            return;
        }

        // https://github.com/electron/electron/pull/4029 Should revers change after the electron version is upgraded
        if (dialogOptions) {
            const result = await UniApi.Dialog.showMessageBox({
                ...dialogOptions,
                type: 'warning',
                defaultId: 2,
                cancelId: 1,
                buttons: [
                    i18n._('Save'),
                    i18n._('Cancel'),
                    i18n._('Don\'t Save')
                ]
            });
            if (typeof result === 'boolean') {
                if (!result) {
                    await dispatch(actions.clearSavedEnvironment(headType));
                    return;
                } else {
                    await dispatch(actions.saveAsFile(headType));
                    return;
                }
            } else {
                const idxClicked = result && result.response;
                if (idxClicked === 1) {
                    throw new Error('Cancel');
                } else if (idxClicked === 2) {
                    await dispatch(actions.clearSavedEnvironment(headType));
                    return;
                }
            }
        }
        if (!openedFile) {
            await dispatch(actions.saveAsFile(headType));
            return;
        }

        const { body: { targetFile } } = await api.packageEnv({ headType });
        const tmpFile = `/Tmp/${targetFile}`;
        UniApi.File.save(openedFile.path, tmpFile);
        await dispatch(actions.clearSavedEnvironment(headType));
    },

    openProject: (file, history) => async (dispatch) => {
        // file: { path, name }
        const [, tail] = file.name.split('.');
        if (!tail) return;

        if (tail.substring(0, 4) === 'snap') {
            const formData = new FormData();
            let shouldSetFileName = true;
            if (!(file instanceof File)) {
                if (new RegExp(/^\.\//).test(file?.path)) {
                    shouldSetFileName = false;
                }
                file = JSON.stringify(file);
            }
            formData.append('file', file);
            const { body: { content } } = await api.recoverProjectFile(formData);
            let envObj;
            try {
                envObj = JSON.parse(content);
            } catch (e) {
                console.error(e);
                return;
            }
            const machineInfo = envObj.machineInfo;
            let headType;
            // Compatible with old project file
            if (machineInfo) {
                // new verison of project file
                headType = machineInfo.headType;
            } else {
                // old verison of project file
                headType = envObj.headType;
            }
            const oldHeadType = getCurrentHeadType(history?.location?.pathname) || headType;
            await dispatch(actions.save(oldHeadType, {
                message: i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[oldHeadType] })
            }));
            await dispatch(actions.closeProject(oldHeadType));
            content && dispatch(actions.updateState(headType, { findLastEnvironment: false, content, unSaved: false }));
            if (oldHeadType === headType) {
                history.push('/');
            }
            history.push(`/${headType}`);

            await dispatch(actions.onRecovery(headType, envObj, false));
            if (shouldSetFileName) {
                if (file instanceof File) {
                    await dispatch(actions.setOpenedFileWithType(headType, file));
                } else {
                    await dispatch(actions.setOpenedFileWithType(headType, JSON.parse(file)));
                }
                dispatch(actions.updateState(headType, { unSaved: false }));
            } else {
                dispatch(actions.updateState(headType, { unSaved: false, openedFile: null }));
            }
        } else if (tail === 'gcode') {
            dispatch(workspaceActions.uploadGcodeFile(file));
            history.push('/workspace');
        }
    },

    startProject: (from, to, history) => async (dispatch) => {
        const newHeadType = getCurrentHeadType(to);
        const oldHeadType = getCurrentHeadType(from) || newHeadType;
        if (oldHeadType === null) {
            history.push(to);
            return;
        }
        await dispatch(actions.save(oldHeadType, {
            message: i18n._('Do you want to save the changes in the {{headType}} editor?', { headType: HEAD_TYPE_ENV_NAME[oldHeadType] })
        }));
        await dispatch(actions.closeProject(oldHeadType));

        if (newHeadType === HEAD_CNC || newHeadType === HEAD_LASER) {
            dispatch(editorActions.updateState(newHeadType, {
                page: PAGE_EDITOR,
                displayedType: DISPLAYED_TYPE_MODEL
            }));
        }
        if (from === to) {
            history.push('/');
        }
        dispatch(actions.updateState(newHeadType, { unSaved: false, openedFile: null }));

        history.push(to);

        // clear operation history
        dispatch(operationHistoryActions.clear(newHeadType));
    },

    saveAndClose: (headType, opts) => async (dispatch, getState) => {
        let modState = null;
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            modState = getState()[headType];
        }
        if (headType === HEAD_3DP) {
            modState = getState().printing;
        }

        if (modState.modelGroup.hasModel()) {
            await dispatch(actions.save(headType, opts));
            await dispatch(actions.updateState(headType, { openedFile: undefined }));
        }

        if (headType === HEAD_3DP) {
            dispatch(printingActions.destroyGcodeLine());
            await dispatch(printingActions.initSize());
        }

        modState.toolPathGroup && modState.toolPathGroup.deleteAllToolPaths();
        modState.modelGroup.removeAllModels();
        modState.SVGActions && modState.SVGActions.svgContentGroup.removeAllElements();
        UniApi.Window.setOpenedFile();
    },
    closeProject: (headType) => async (dispatch, getState) => {
        let modState = null;
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            modState = getState()[headType];
        }
        if (headType === HEAD_3DP) {
            modState = getState().printing;
        }

        if (headType === HEAD_3DP) {
            dispatch(printingActions.destroyGcodeLine());
            await dispatch(printingActions.initSize());
        }
        modState.toolPathGroup && modState.toolPathGroup.deleteAllToolPaths();
        modState.modelGroup.removeAllModels();
        modState.SVGActions && modState.SVGActions.svgContentGroup && modState.SVGActions.svgContentGroup.removeAllElements();
        UniApi.Window.setOpenedFile();
    },

    cleanAllRecentFiles: () => async () => {
        UniApi.Menu.cleanAllRecentFiles();
    },

    updateRecentFile: (arr, type) => (dispatch, getState) => {
        const state = getState().project.general;
        let newRecentFiles = cloneDeep(arr);
        if (type === 'reset') {
            newRecentFiles = [];
        } else {
            state.recentFiles.forEach(fileItem => {
                if (newRecentFiles.length >= MAX_RECENT_FILES_LENGTH) {
                    return;
                }
                if (!find(newRecentFiles, { 'name': fileItem.name })) {
                    newRecentFiles.unshift(fileItem);
                }
            });
        }
        state.recentFiles = newRecentFiles;
        state.recentFilesLength = newRecentFiles.length;
        dispatch(actions.updateState('general', state));
    }
};


export default function reducer(state = INITIAL_STATE, action) {
    const { type, headType } = action;
    if (!headType || type !== ACTION_UPDATE_STATE) return state;
    const editorState = Object.assign({}, state[headType], action.state);

    if (type === ACTION_UPDATE_STATE) {
        return Object.assign({}, state, { [headType]: editorState });
    }
    return state;
}
