import { find, keys, some } from 'lodash';
import cloneDeep from 'lodash/cloneDeep';

import pkg from '../../../package.json';
import api from '../../api';
import {
    COORDINATE_MODE_BOTTOM_CENTER,
    COORDINATE_MODE_BOTTOM_LEFT,
    COORDINATE_MODE_BOTTOM_RIGHT,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT,
    DISPLAYED_TYPE_MODEL,
    HEAD_TYPE_ENV_NAME,
    LEFT_EXTRUDER,
    LOAD_MODEL_FROM_OUTER,
    MAX_RECENT_FILES_LENGTH,
    PAGE_EDITOR,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PROCESS_MODE_MESH,
    RIGHT_EXTRUDER,
    SOURCE_TYPE
} from '../../constants';
import { CylinderWorkpieceReference, OriginType, RectangleWorkpieceReference, convertMaterialsToWorkpiece } from '../../constants/coordinate';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING, SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2 } from '../../constants/machines';
import { checkIsGCodeFile, checkIsSnapmakerProjectFile } from '../../lib/check-name';
import { logModuleVisit } from '../../lib/gaEvent';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import { PROCESS_STAGE } from '../../lib/manager/ProgressManager';
import workerManager from '../../lib/manager/workerManager';
import { bubbleSortByAttribute } from '../../lib/numeric-utils';
import UniApi from '../../lib/uni-api';
import { UniformToolpathConfig } from '../../lib/uniform-toolpath-config';
import { getCurrentHeadType } from '../../lib/url-utils';
import { machineStore } from '../../store/local-storage';
import { actions as editorActions } from '../editor';
import { actions as printingActions } from '../printing';
import { synchronizeMeshFile } from '../printing/actions-mesh';
import { actions as workspaceActions } from '../workspace';

import ThreeModel from '../../models/ThreeModel';

/* eslint-disable-next-line import/no-cycle */
import { actions as appGlobalActions } from '../app-global';
/* eslint-disable-next-line import/no-cycle */
import { actions as operationHistoryActions } from '../operation-history';

const INITIAL_STATE = {
    [HEAD_PRINTING]: {
        findLastEnvironment: false,
        targetFile: null,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    [HEAD_CNC]: {
        findLastEnvironment: false,
        targetFile: null,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    [HEAD_LASER]: {
        findLastEnvironment: false,
        targetFile: null,
        openedFile: null,
        unSaved: false,
        content: null,
        initState: true
    },
    general: {
        recentFiles: [],
        recentFilesLength: -1,

        // opening project
        opening: false,
    },
};
const ACTION_UPDATE_STATE = 'EDITOR_ACTION_UPDATE_STATE';

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
        };
        startService(HEAD_LASER);
        startService(HEAD_CNC);
        startService(HEAD_PRINTING);
    },

    autoSaveEnvironment: (headType, isSaveEditor = false) => async (dispatch, getState) => {
        const editorState = getState()[headType];
        const { initState } = getState().project[headType];
        const { modelGroup } = editorState;
        const models = modelGroup.getModels();

        if (!models.length && initState && !isSaveEditor) return;

        const envObj = {
            machineInfo: null,
            models: [],
            toolpaths: []
        };

        const machineState = getState().machine;
        const { size, series, toolHead } = machineState;
        const machineInfo = {};
        machineInfo.headType = headType;
        machineInfo.size = size;
        machineInfo.series = series;
        machineInfo.toolHead = toolHead;

        envObj.machineInfo = machineInfo;

        envObj.version = pkg?.version;
        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            const { materials, coordinateMode, coordinateSize, origin } = editorState;
            envObj.materials = materials;
            envObj.origin = origin;
            envObj.coordinateMode = coordinateMode;
            envObj.coordinateSize = coordinateSize;
        } else if (headType === HEAD_PRINTING) {
            const {
                activePresetIds,
                defaultMaterialId,
                defaultMaterialIdRight,
                helpersExtruderConfig,
                supportExtruderConfig,
            } = editorState;
            envObj.defaultMaterialId = defaultMaterialId;
            envObj.defaultMaterialIdRight = defaultMaterialIdRight;
            envObj.activePresetIds = activePresetIds;
            envObj.helpersExtruderConfig = helpersExtruderConfig;
            envObj.supportExtruderConfig = supportExtruderConfig;

            envObj.models.push(modelGroup.primeTower.getSerializableConfig());
        }

        // Save models
        for (const model of models) {
            if (model instanceof ThreeModel) {
                await dispatch(synchronizeMeshFile(model));
            }

            envObj.models.push(model.getSerializableConfig());
        }

        if (headType === HEAD_CNC || headType === HEAD_LASER) {
            const toolPaths = editorState.toolPathGroup.getToolPaths();
            envObj.toolpaths = toolPaths;
        }
        const content = JSON.stringify(envObj);
        dispatch(actions.updateState(headType, { content, unSaved: true, initState: false }));
        await api.env.saveEnv({ content });
    },

    getLastEnvironment: (headType) => async (dispatch) => {
        const { body: { content } } = await api.env.getEnv({ headType });

        if (content) {
            try {
                const envObj = JSON.parse(content);
                if (!envObj.models.length) return;
            } catch (e) {
                log.info(`Unable to parse environment JSON for ${headType}`);
            }

            dispatch(actions.updateState(headType, { findLastEnvironment: true, content }));
        }
    },

    clearSavedEnvironment: (headType) => async (dispatch) => {
        try {
            await api.env.removeEnv({ headType });
        } catch (e) {
            log.error(e);
        }

        dispatch(actions.updateState(headType, { unSaved: false }));
    },

    recoverModels: (promiseArray = [], modActions, models, envHeadType, isGuideTours = false) => (dispatch) => {
        for (let k = 0; k < models.length; k++) {
            const { headType, originalName, uploadName, modelName, config, sourceType, gcodeConfig,
                sourceWidth, sourceHeight, mode, transformation, modelID, supportTag, extruderConfig, children, parentModelID } = models[k];
            const primeTowerTag = uploadName && uploadName.indexOf('prime_tower_') === 0;
            // prevent project recovery recorded into operation history
            if (supportTag) {
                continue;
            }
            if (!children) {
                // excludeModelById only works for models except group
                dispatch(operationHistoryActions.excludeModelById(envHeadType, modelID));
            }

            promiseArray.push(
                dispatch(modActions.generateModel(headType, {
                    loadFrom: LOAD_MODEL_FROM_OUTER,
                    originalName,
                    uploadName,
                    modelName,
                    sourceWidth,
                    sourceHeight,
                    mode,
                    sourceType,
                    config,
                    gcodeConfig,
                    transformation,
                    modelID,
                    extruderConfig,
                    isGroup: !!children,
                    parentModelID,
                    children,
                    primeTowerTag,
                    isGuideTours
                }))
            );
            if (children && children.length > 0) {
                dispatch(actions.recoverModels(promiseArray, modActions, children, envHeadType));
            }
        }
    },

    onRecovery: (envHeadType, envObj, backendRecover = true, shouldSetFileName = true, isGuideTours = false) => async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);
        UniApi.Window.setOpenedFile();
        let { content } = getState().project[envHeadType];
        const { toolHead: { printingToolhead }, size: currentSize } = getState().machine;
        if (!envObj) {
            envObj = JSON.parse(content);
        }
        if (envObj?.machineInfo?.headType === '3dp') envObj.machineInfo.headType = HEAD_PRINTING;
        const allModels = envObj?.models;
        allModels.forEach((model) => {
            if (model.headType === '3dp') {
                model.headType = HEAD_PRINTING;
            }
        });
        // backup project if needed
        if (backendRecover) {
            UniformToolpathConfig(envObj);
            content = JSON.stringify(envObj);
            await api.env.recoverEnv({ content });
        }
        if (envObj?.machineInfo?.headType === HEAD_PRINTING && printingToolhead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2) {
            allModels.forEach((model) => {
                model.extruderConfig = {
                    infill: '0',
                    shell: '0'
                };
            });
        }
        let modActions = null;
        const modState = getState()[envHeadType];
        dispatch(operationHistoryActions.clear(envHeadType));
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            modActions = editorActions;
        }
        if (envHeadType === HEAD_PRINTING) {
            modActions = printingActions;
            await dispatch(printingActions.initPrintConfig());
        }
        const { modelGroup } = modState;
        modelGroup.removeAllModels();

        await modState?.SVGActions?.svgContentGroup.removeAllElements();
        // eslint-disable-next-line prefer-const
        let { models, toolpaths, materials, origin, coordinateMode, coordinateSize, machineInfo, ...restState } = envObj;
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            if (materials) {
                // For old project file, it may have x = 0 and y = 0
                if (materials.x === 0 && materials.y === 0) {
                    materials.x = coordinateSize.x;
                    materials.y = coordinateSize.y;
                }

                const workpiece = convertMaterialsToWorkpiece(materials);
                dispatch(editorActions.setWorkpiece(envHeadType, workpiece.shape, workpiece.size));
                dispatch(editorActions.updateWorkpieceObject(envHeadType));
            }

            const isRotate = materials ? materials.isRotate : false;

            // origin
            if (origin) {
                dispatch(editorActions.setOrigin(envHeadType, origin));
            } else {
                // Old project does not have origin saved, we asssume that they use "Workpiece" origin type
                let reference;
                if (!isRotate) {
                    switch (coordinateMode.value) {
                        case COORDINATE_MODE_CENTER.value:
                            reference = RectangleWorkpieceReference.Center;
                            break;
                        case COORDINATE_MODE_BOTTOM_LEFT.value:
                            reference = RectangleWorkpieceReference.BottomLeft;
                            break;
                        case COORDINATE_MODE_BOTTOM_RIGHT.value:
                            reference = RectangleWorkpieceReference.BottomRight;
                            break;
                        case COORDINATE_MODE_TOP_LEFT.value:
                            reference = RectangleWorkpieceReference.TopLeft;
                            break;
                        case COORDINATE_MODE_TOP_RIGHT.value:
                            reference = RectangleWorkpieceReference.TopLeft;
                            break;
                        default:
                            reference = RectangleWorkpieceReference.Center;
                            break;
                    }
                } else {
                    switch (coordinateMode.value) {
                        case COORDINATE_MODE_BOTTOM_CENTER.value:
                        default:
                            reference = CylinderWorkpieceReference.FrontCenter;
                            break;
                    }
                }

                dispatch(editorActions.setOrigin(envHeadType, {
                    type: OriginType.Workpiece,
                    reference: reference,
                    referenceMetadata: {},
                }));
            }

            const oversize = some(keys(coordinateSize), (key) => {
                return currentSize[key] < coordinateSize[key];
            });
            if (oversize) {
                coordinateSize = currentSize;
            }

            if (coordinateMode) {
                dispatch(editorActions.updateState(envHeadType, {
                    coordinateMode: coordinateMode,
                    coordinateSize: coordinateSize ?? machineInfo.size,
                    projectFileOversize: oversize
                }));
            } else {
                dispatch(editorActions.updateState(envHeadType, {
                    coordinateMode: (!isRotate ? COORDINATE_MODE_CENTER : COORDINATE_MODE_BOTTOM_CENTER),
                    coordinateSize: coordinateSize ?? machineInfo.size,
                    projectFileOversize: oversize
                }));
            }
        }
        models = bubbleSortByAttribute(models, ['transformation', 'positionZ']);

        // Recover models
        // Compatible with mesh mode
        for (const model of models) {
            if (model.sourceType === SOURCE_TYPE.IMAGE3D) {
                model.mode = PROCESS_MODE_MESH;
            }
        }
        const promiseArray = [];
        dispatch(actions.recoverModels(promiseArray, modActions, models, envHeadType, isGuideTours));

        // Create tool paths
        const { toolPathGroup } = modState;
        if (toolPathGroup && toolPathGroup.toolPaths && toolPathGroup.toolPaths.length) {
            toolPathGroup.deleteAllToolPaths();
        }
        if (toolpaths && toolpaths.length) {
            for (let k = 0; k < toolpaths.length; k++) {
                toolPathGroup.saveToolPath(toolpaths[k], { materials, origin }, false);
            }
            toolPathGroup.selectToolPathById(null);
        }

        // Recover selected presets
        if (envHeadType === HEAD_PRINTING) {
            // deal with old project file
            if (restState.defaultQualityId) {
                restState.activePresetIds = {
                    [LEFT_EXTRUDER]: restState.defaultQualityId,
                    [RIGHT_EXTRUDER]: '',
                };
            }

            // deal with old project without supportExtruderConfig
            if (!restState.supportExtruderConfig && restState.helpersExtruderConfig) {
                restState.supportExtruderConfig = {
                    support: restState.helpersExtruderConfig.support,
                    interface: restState.helpersExtruderConfig.support,
                };
            }

            dispatch(modActions.updateState({
                ...restState
            }));

            const { helpersExtruderConfig } = restState;
            dispatch(modActions.updateHelpersExtruder(helpersExtruderConfig));

            const { supportExtruderConfig } = restState;
            dispatch(modActions.updateSupportExtruderConfig(supportExtruderConfig));

            const { defaultMaterialId, defaultMaterialIdRight } = envObj;
            dispatch(modActions.updateSavedPresetIds(PRINTING_MANAGER_TYPE_MATERIAL, defaultMaterialId, LEFT_EXTRUDER));
            dispatch(modActions.updateSavedPresetIds(PRINTING_MANAGER_TYPE_MATERIAL, defaultMaterialIdRight, RIGHT_EXTRUDER));
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

        Promise.all(promiseArray).then(() => {
            dispatch(actions.afterOpened(envHeadType));
        }).catch(log.error);
    },

    exportFile: (targetFile, renderGcodeFileName = null) => async (dispatch) => {
        const tmpFile = `/Tmp/${targetFile}`;
        await UniApi.File.exportAs(targetFile, tmpFile, renderGcodeFileName, (type, filePath = '') => {
            dispatch(appGlobalActions.updateSavedModal({
                showSavedModal: true,
                savedModalType: type,
                savedModalFilePath: filePath
            }));
        });
    },

    exportConfigFile: (targetFile, subCategory, exportName) => async (dispatch) => {
        let configFile;
        if (subCategory) {
            configFile = `/Config/${subCategory}/${targetFile}`;
        } else {
            configFile = `/Config/${targetFile}`;
        }
        await UniApi.File.exportAs(targetFile, configFile, exportName, (type, filePath = '') => {
            dispatch(appGlobalActions.updateSavedModal({
                showSavedModal: true,
                savedModalType: type,
                savedModalFilePath: filePath
            }));
        });
    },

    setOpenedFileWithType: (headType, openedFile) => async (dispatch) => {
        openedFile && UniApi.Window.setOpenedFile(openedFile?.name);
        await dispatch(actions.updateState(headType, { findLastEnvironment: false, openedFile, unSaved: false }));
        UniApi.Menu.setItemEnabled('save', !!openedFile);
    },

    saveAsFile: (headType) => async (dispatch, getState) => {
        const { unSaved, openedFile, targetFile } = getState().project[headType];
        let tmpFile, newTargetFile;
        if (unSaved || !openedFile) {
            const { body: { targetFile: insideTargetFile } } = await api.env.packageEnv({ headType });
            newTargetFile = insideTargetFile;
            tmpFile = `/Tmp/${newTargetFile}`;
            dispatch(actions.updateState(headType, { targetFile: newTargetFile }));
        } else {
            const { name } = openedFile;
            newTargetFile = name;
            tmpFile = `/Tmp/${targetFile}`;
        }

        return new Promise((resolve) => {
            UniApi.File.saveAs(newTargetFile, tmpFile, (type, filePath = '', newOpenedFile) => {
                dispatch(appGlobalActions.updateSavedModal({
                    showSavedModal: true,
                    savedModalType: type,
                    savedModalFilePath: filePath
                }));
                if (newOpenedFile) {
                    dispatch(actions.setOpenedFileWithType(headType, newOpenedFile));
                }
                dispatch(actions.clearSavedEnvironment(headType));

                resolve(); // done
            });
        });
    },
    save: (headType, dialogOptions = false) => async (dispatch, getState) => {
        // save should return when no model in editor
        const modelGroup = getState()[headType].modelGroup;
        if (!modelGroup || !modelGroup.hasModelWhole()) {
            return true;
        }

        const state = getState().project[headType];
        const { openedFile, unSaved } = state;
        if (!unSaved) {
            return true;
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
                    return true;
                } else {
                    await dispatch(actions.autoSaveEnvironment(headType));
                    await dispatch(actions.saveAsFile(headType));
                    return true;
                }
            } else {
                const idxClicked = result && result.response;
                if (idxClicked === 1) {
                    return false;
                } else if (idxClicked === 2) {
                    await dispatch(actions.clearSavedEnvironment(headType));
                    return true;
                }
            }
        }

        if (!openedFile) {
            await dispatch(actions.autoSaveEnvironment(headType));
            await dispatch(actions.saveAsFile(headType));
            return true;
        }

        const { body: { targetFile } } = await api.env.packageEnv({ headType });
        await dispatch(actions.updateState(headType, { targetFile }));
        const tmpFile = `/Tmp/${targetFile}`;
        await new Promise((resolve) => {
            UniApi.File.save(openedFile.path, tmpFile, async () => {
                resolve(true);
            });
        });
        await dispatch(actions.clearSavedEnvironment(headType));

        return true;
    },

    afterOpened: (headType) => (dispatch) => {
        if (headType === HEAD_PRINTING) {
            dispatch(printingActions.applyProfileToAllModels());
        }
        dispatch(actions.autoSaveEnvironment(headType));
    },

    openProject: (file, history, unReload = false, isGuideTours = false) => async (dispatch) => {
        if (checkIsSnapmakerProjectFile(file.name)) {
            dispatch(actions.updateState('general', { opening: true }));

            const formData = new FormData();
            let shouldSetFileName = true;
            if (!(file instanceof File)) {
                if (new RegExp(/^\.\//).test(file?.path)) {
                    shouldSetFileName = false;
                }
                file = JSON.stringify(file);
            }
            formData.append('file', file);
            const { body: { content, projectPath } } = await api.env.recoverProjectFile(formData);
            let envObj;
            try {
                envObj = JSON.parse(content);
            } catch (e) {
                log.error(e);
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
            if (!isGuideTours) {
                await dispatch(actions.save(oldHeadType, {
                    message: i18n._(
                        'key-Project/Save-Save the changes you made in the {{headType}} G-code Generator? Your changes will be lost if you don’t save them.',
                        { headType: i18n._(HEAD_TYPE_ENV_NAME[oldHeadType]) }
                    )
                }));
            }

            await dispatch(actions.closeProject(oldHeadType));
            content && dispatch(actions.updateState(headType, { findLastEnvironment: false, content, unSaved: false }));
            if (oldHeadType === headType && !unReload) {
                history.push('/');
            }
            history.push(
                {
                    pathname: `/${headType}`,
                    state: { initialized: true }
                }
            );
            await dispatch(actions.onRecovery(headType, envObj, false, shouldSetFileName, isGuideTours));
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

            dispatch(actions.updateState('general', { opening: false }));
        } else if (checkIsGCodeFile(file.name)) {
            dispatch(workspaceActions.uploadGcodeFile(file));
            history.push('/workspace');
        }
    },

    startProject: (from, to, history, restartGuide = false, isRotate = false) => async (dispatch, getState) => {
        const newHeadType = getCurrentHeadType(to);
        const oldHeadType = getCurrentHeadType(from) || newHeadType;
        if (oldHeadType === null) {
            history.push(to);
            return;
        }
        const done = await dispatch(actions.save(oldHeadType, {
            message: i18n._('key-Project/Save-Save the changes you made in the {{headType}} G-code Generator? Your changes will be lost if you don’t save them.', { headType: i18n._(HEAD_TYPE_ENV_NAME[oldHeadType]) })
        }));
        if (!done) {
            // action cancelled
            return;
        }

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
        isRotate = restartGuide ? getState()[toPath]?.materials?.isRotate : isRotate;
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
            workerManager.setClipperWorkerEnable(false);
        } else {
            isGuideTours = machineStore.get('guideTours')?.guideTours3dp;
        }
        logModuleVisit(newHeadType, isRotate);

        history.push({
            pathname: to,
            state: {
                shouldShowJobType: restartGuide ? false : !!isGuideTours,
                shouldShowGuideTours: to === from ? (!shouldShowGuideTours || restartGuide) : (!isGuideTours || restartGuide),
                isRotate: isRotate
            }
        });

        dispatch(printingActions.displayModel());
        // clear operation history
        dispatch(operationHistoryActions.clear(newHeadType));
    },

    saveAndClose: (headType, opts) => async (dispatch, getState) => {
        const modState = getState()[headType];

        if (modState.modelGroup.hasModel()) {
            const done = await dispatch(actions.save(headType, opts));
            if (!done) {
                return false;
            }
            await dispatch(actions.updateState(headType, { openedFile: undefined }));
        }

        if (headType === HEAD_PRINTING) {
            dispatch(printingActions.destroyGcodeLine());
            await dispatch(printingActions.initPrintConfig());
        }

        modState.toolPathGroup && modState.toolPathGroup.deleteAllToolPaths();
        modState.modelGroup.removeAllModels();
        modState.SVGActions && modState.SVGActions.svgContentGroup.removeAllElements();
        UniApi.Window.setOpenedFile();

        return true;
    },
    closeProject: (headType) => (dispatch, getState) => {
        const modState = getState()[headType];

        if (headType === HEAD_PRINTING) {
            dispatch(printingActions.destroyGcodeLine());
            dispatch(printingActions.updateState({
                enableShortcut: true,
                leftBarOverlayVisible: false,
                transformMode: ''
            }));
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
