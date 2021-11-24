import cloneDeep from 'lodash/cloneDeep';
import { find } from 'lodash';
import pkg from '../../../package.json';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    HEAD_TYPE_ENV_NAME,
    SOURCE_TYPE_IMAGE3D,
    PROCESS_MODE_MESH,
    getCurrentHeadType,
    COORDINATE_MODE_CENTER, COORDINATE_MODE_BOTTOM_CENTER, PAGE_EDITOR, DISPLAYED_TYPE_MODEL,
    MAX_RECENT_FILES_LENGTH,
    LOAD_MODEL_FROM_OUTER
} from '../../constants';
import api from '../../api';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
// import machineAction from '../machine/action-base';
import { actions as workspaceActions } from '../workspace';
import { bubbleSortByAttribute } from '../../lib/numeric-utils';
import { UniformToolpathConfig } from '../../lib/uniform-toolpath-config';
import { checkIsSnapmakerProjectFile, checkIsGCodeFile, checkObjectIsEqual } from '../../lib/check-name';

import { actions as operationHistoryActions } from '../operation-history';
import { machineStore } from '../../store/local-storage';

import i18n from '../../lib/i18n';
import UniApi from '../../lib/uni-api';

const INITIAL_STATE = {
    [HEAD_PRINTING]: {
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
const interval = {
    HEAD_LASER: null,
    HEAD_CNC: null,
    HEAD_PRINTING: null
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
        const startService = async (envHeadType) => {
            // disable auto recovery if openedFile set
            const { openedFile } = getState().project[envHeadType];
            if (!openedFile) {
                await dispatch(actions.getLastEnvironment(envHeadType));
            }

            const action = await actions.autoSaveEnvironment(envHeadType);
            interval[envHeadType] && clearInterval(interval[envHeadType]);
            interval[envHeadType] = setInterval(() => dispatch(action), 1000);
        };

        startService(HEAD_LASER);
        startService(HEAD_CNC);
        startService(HEAD_PRINTING);
    },

    exitRecoverService: () => () => {
        for (const envHeadType of [HEAD_LASER, HEAD_CNC, HEAD_PRINTING]) {
            interval[envHeadType] && clearInterval(interval[envHeadType]);
            interval[envHeadType] = null;
        }
    },

    autoSaveEnvironment: (headType, force = false) => async (dispatch, getState) => {
        const editorState = getState()[headType];
        const { initState, content: lastString } = getState().project[headType];
        const models = editorState.modelGroup.getModels();
        if (!models.length && initState) return;
        const machineState = getState().machine;
        const { size, series, toolHead } = machineState;
        const machineInfo = {};
        machineInfo.headType = headType;
        machineInfo.size = size;
        machineInfo.series = series;
        machineInfo.toolHead = toolHead;

        const envObj = { machineInfo, models: [], toolpaths: [] };
        envObj.version = pkg?.version;
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            const { materials, coordinateMode, coordinateSize } = editorState;
            envObj.materials = materials;
            envObj.coordinateMode = coordinateMode;
            envObj.coordinateSize = coordinateSize;
        } else if (headType === HEAD_PRINTING) {
            const { defaultMaterialId, defaultQualityId } = editorState;
            envObj.defaultMaterialId = defaultMaterialId;
            envObj.defaultQualityId = defaultQualityId;
        }
        for (let key = 0; key < models.length; key++) {
            const model = models[key];
            envObj.models.push(model.getSerializableConfig());
        }
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            const toolPaths = editorState.toolPathGroup.getToolPaths();
            envObj.toolpaths = toolPaths;
        }
        if (force || !checkObjectIsEqual(JSON.parse(lastString), envObj)) {
            const content = JSON.stringify(envObj);
            dispatch(actions.updateState(headType, { content, unSaved: true, initState: false }));
            await api.saveEnv({ content });
        }
    },

    getLastEnvironment: (headType) => async (dispatch) => {
        const { body: { content } } = await api.getEnv({ headType });
        try {
            const envObj = JSON.parse(content);
            if (!envObj.models.length) return;
        } catch (e) {
            console.info('Error content JSON');
        }

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

    recoverModels: (modActions, models, envHeadType) => async (dispatch) => {
        for (let k = 0; k < models.length; k++) {
            const { headType, originalName, uploadName, modelName, config, sourceType, gcodeConfig,
                sourceWidth, sourceHeight, mode, transformation, modelID, supportTag, extruderConfig, children, parentModelID } = models[k];
            // prevent project recovery recorded into operation history
            if (supportTag) {
                continue;
            }
            if (!children) {
                // excludeModelById only works for models except group
                dispatch(operationHistoryActions.excludeModelById(envHeadType, modelID));
            }

            await dispatch(modActions.generateModel(headType, {
                loadFrom: LOAD_MODEL_FROM_OUTER, originalName, uploadName, modelName, sourceWidth, sourceHeight, mode, sourceType, config, gcodeConfig, transformation, modelID, extruderConfig, isGroup: !!children, parentModelID, children
            }));
            if (children && children.length > 0) {
                await dispatch(actions.recoverModels(modActions, children, envHeadType));
            }
        }
    },

    onRecovery: (envHeadType, envObj, backendRecover = true, shouldSetFileName = true) => async (dispatch, getState) => {
        UniApi.Window.setOpenedFile();
        let { content } = getState().project[envHeadType];
        if (!envObj) {
            envObj = JSON.parse(content);
        }
        // backup project if needed
        if (backendRecover) {
            if (envObj?.machineInfo?.headType === '3dp') envObj.machineInfo.headType = HEAD_PRINTING;
            const allModels = envObj?.models;
            allModels.forEach((model) => {
                if (model.headType === '3dp') {
                    model.headType = HEAD_PRINTING;
                }
            });
            UniformToolpathConfig(envObj);
            content = JSON.stringify(envObj);
            await api.recoverEnv({ content });
        }
        let modActions = null;
        const modState = getState()[envHeadType];
        dispatch(operationHistoryActions.clear(envHeadType));
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            modActions = editorActions;
        }
        if (envHeadType === HEAD_PRINTING) {
            modActions = printingActions;
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

        await dispatch(actions.recoverModels(modActions, models, envHeadType));

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

        if (envHeadType === HEAD_PRINTING) {
            dispatch(modActions.updateState(restState));
        } else {
            dispatch(modActions.updateState(envHeadType, restState));
        }
        // // TODO: set current content to avoid <unSaved> flag mis-set
        if (shouldSetFileName) {
            for (const type of [HEAD_PRINTING, HEAD_CNC, HEAD_LASER]) {
                await dispatch(actions.clearSavedEnvironment(type));
            }
        }
        await dispatch(actions.updateState(envHeadType, { unSaved: true }));
    },

    exportFile: (targetFile, renderGcodeFileName = '') => async () => {
        const tmpFile = `/Tmp/${targetFile}`;
        await UniApi.File.exportAs(targetFile, tmpFile, renderGcodeFileName);
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
        const modelGroup = getState()[headType].modelGroup;
        if (!modelGroup || !modelGroup.hasModelWhole()) {
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
                defaultId: 0,
                cancelId: 1,
                buttons: [
                    i18n._('key-Project/Save-Save'),
                    i18n._('key-Project/Save-Cancel'),
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

    openProject: (file, history, unReload = false, isGuideTours = false) => async (dispatch) => {
        if (checkIsSnapmakerProjectFile(file.name)) {
            const formData = new FormData();
            let shouldSetFileName = true;
            if (!(file instanceof File)) {
                if (new RegExp(/^\.\//).test(file?.path)) {
                    shouldSetFileName = false;
                }
                file = JSON.stringify(file);
            }
            formData.append('file', file);
            const { body: { content, projectPath } } = await api.recoverProjectFile(formData);
            let envObj;
            try {
                envObj = JSON.parse(content);
            } catch (e) {
                console.error(e);
                return;
            }
            const machineInfo = envObj.machineInfo;
            let headType;
            // Start of Compatible with old project file

            if (machineInfo) {
                // new verison of project file
                headType = machineInfo.headType;
                // TODO: for project file of "< version 4.1"
                if (headType === '3dp') {
                    headType = HEAD_PRINTING;
                }
            } else {
                // old verison of project file
                headType = envObj.headType;
            }
            UniformToolpathConfig(envObj);

            // End of Compatible with old project file

            const oldHeadType = getCurrentHeadType(history?.location?.pathname) || headType;
            !isGuideTours && await dispatch(actions.save(oldHeadType, {
                message: i18n._('key-Project/Save-Save the changes you made in the {{headType}} G-code Generator? Your changes will be lost if you don’t save them.', { headType: HEAD_TYPE_ENV_NAME[oldHeadType] })
            }));
            await dispatch(actions.closeProject(oldHeadType));
            content && dispatch(actions.updateState(headType, { findLastEnvironment: false, content, unSaved: false }));
            if (oldHeadType === headType && !unReload) {
                history.push('/');
            }
            history.push(`/${headType}`);

            await dispatch(actions.onRecovery(headType, envObj, false, shouldSetFileName));
            if (shouldSetFileName) {
                if (file instanceof File) {
                    const newOpenedFile = {
                        name: file.name,
                        path: projectPath
                    };
                    await dispatch(actions.setOpenedFileWithType(headType, newOpenedFile));
                } else {
                    await dispatch(actions.setOpenedFileWithType(headType, JSON.parse(file)));
                }
                await dispatch(actions.updateState(headType, { unSaved: false, content }));
            } else {
                await dispatch(actions.updateState(headType, { unSaved: true, openedFile: null }));
            }
        } else if (checkIsGCodeFile(file.name)) {
            dispatch(workspaceActions.uploadGcodeFile(file));
            history.push('/workspace');
        }
    },

    startProject: (from, to, history, restartGuide = false) => async (dispatch, getState) => {
        const newHeadType = getCurrentHeadType(to);
        const oldHeadType = getCurrentHeadType(from) || newHeadType;
        if (oldHeadType === null) {
            history.push(to);
            return;
        }
        await dispatch(actions.save(oldHeadType, {
            message: i18n._('key-Project/Save-Save the changes you made in the {{headType}} G-code Generator? Your changes will be lost if you don’t save them.', { headType: HEAD_TYPE_ENV_NAME[oldHeadType] })
        }));
        await dispatch(actions.closeProject(oldHeadType));

        for (const type of [HEAD_PRINTING, HEAD_CNC, HEAD_LASER]) {
            await dispatch(actions.clearSavedEnvironment(type));
        }

        if (newHeadType === HEAD_CNC || newHeadType === HEAD_LASER) {
            dispatch(editorActions.updateState(newHeadType, {
                page: PAGE_EDITOR,
                displayedType: DISPLAYED_TYPE_MODEL
            }));
        }
        let isGuideTours = false;
        let shouldShowGuideTours = false;
        const toPath = to.slice(1);
        const isRotate = getState()[toPath]?.materials?.isRotate;
        if (from === to) {
            const currentGuideTours = machineStore.get('guideTours');
            history.push({
                pathname: '/',
                state: { shouldNotLogPageView: true }
            });
            // if (toPath !== '3dp') {
            if (toPath !== HEAD_PRINTING) {
                if (isRotate) {
                    const propName = `guideTours${toPath}4Axis`;
                    shouldShowGuideTours = currentGuideTours ? !!currentGuideTours[propName] : undefined;
                } else {
                    const propName = `guideTours${toPath}`;
                    shouldShowGuideTours = currentGuideTours ? !!currentGuideTours[propName] : undefined;
                }
            } else {
                shouldShowGuideTours = currentGuideTours ? !!currentGuideTours.guideTours3dp : undefined;
            }
        }
        await dispatch(actions.setOpenedFileWithType(newHeadType, null));
        // dispatch(actions.updateState(newHeadType, { unSaved: false, openedFile: null }));
        if (restartGuide && to === '/printing') {
            machineStore.set('guideTours.guideTours3dp', false);
        }
        if (toPath !== HEAD_PRINTING) {
            if (isRotate) {
                const propName = `guideTours${toPath}4Axis`;
                isGuideTours = machineStore.get('guideTours') ? !!machineStore.get('guideTours')[propName] : undefined;
            } else {
                const propName = `guideTours${toPath}`;
                isGuideTours = machineStore.get('guideTours') ? !!machineStore.get('guideTours')[propName] : undefined;
            }
        } else {
            isGuideTours = machineStore.get('guideTours')?.guideTours3dp;
        }
        history.push({
            pathname: to,
            state: {
                shouldShowJobType: restartGuide ? false : !!isGuideTours,
                shouldShowGuideTours: to === from ? (!shouldShowGuideTours || restartGuide) : (!isGuideTours || restartGuide)
            }
        });

        // clear operation history
        dispatch(operationHistoryActions.clear(newHeadType));
    },

    saveAndClose: (headType, opts) => async (dispatch, getState) => {
        const modState = getState()[headType];

        if (modState.modelGroup.hasModel()) {
            await dispatch(actions.save(headType, opts));
            await dispatch(actions.updateState(headType, { openedFile: undefined }));
        }

        if (headType === HEAD_PRINTING) {
            dispatch(printingActions.destroyGcodeLine());
            await dispatch(printingActions.initSize());
        }

        modState.toolPathGroup && modState.toolPathGroup.deleteAllToolPaths();
        modState.modelGroup.removeAllModels();
        modState.SVGActions && modState.SVGActions.svgContentGroup.removeAllElements();
        UniApi.Window.setOpenedFile();
    },
    closeProject: (headType) => async (dispatch, getState) => {
        const modState = getState()[headType];

        if (headType === HEAD_PRINTING) {
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
    },


    setOpenedFileWithUnSaved: (headType, unSaved) => async (dispatch, getState) => {
        const { openedFile } = getState().project[headType];
        if (openedFile) {
            UniApi.Window.setOpenedFile(unSaved ? `${openedFile?.name} *` : openedFile?.name);
        } else {
            UniApi.Window.setOpenedFile(unSaved ? 'New *' : 'New');
        }
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
