import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import { baseActions } from './actions-base';
import { controller } from '../../lib/controller';
import { STEP_STAGE, PROCESS_STAGE } from '../../lib/manager/ProgressManager';
import { DISPLAYED_TYPE_MODEL, DISPLAYED_TYPE_TOOLPATH, HEAD_LASER, SELECTEVENT } from '../../constants';
import { getToolPathType } from '../../toolpaths/utils';

import { toast } from '../../ui/components/Toast';
import { ToastWapper } from '../../ui/components/Toast/toastContainer';

import i18n from '../../lib/i18n';
import { actions as operationHistoryActions } from '../operation-history';
import DeleteToolPathOperation from '../operation-history/DeleteToolPathOperation';
import Operations from '../operation-history/Operations';
import { timestamp } from '../../../shared/lib/random-utils';
import definitionManager from '../manager/DefinitionManager';
import api from '../../api';

let toastId;
export const processActions = {
    recalculateAllToolPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup, progressStatesManager } = getState()[headType];

        // start progress
        dispatch(baseActions.updateState(headType, {
            stage: STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH, 0)
        }));

        // start generate toolpath
        toolPathGroup.toolPaths.forEach((toolPath) => {
            dispatch(processActions.commitGenerateToolPath(headType, toolPath.id));
        });
    },

    refreshToolPathPreview: (headType) => (dispatch, getState) => {
        const { displayedType } = getState()[headType];
        if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
            dispatch(processActions.preview(headType));
        }
    },

    preview: (headType) => (dispatch, getState) => {
        const { SVGActions, toolPathGroup, progressStatesManager } = getState()[headType];
        let visibleToolPathsLength = 0;
        toolPathGroup.toolPaths.forEach((toolPath) => {
            if (toolPath.visible && toolPath.hasVisibleModels()) {
                visibleToolPathsLength += 1;
            }
        });
        if (visibleToolPathsLength > 0) {
            progressStatesManager.startProgress(
                PROCESS_STAGE.CNC_LASER_GENERATE_TOOLPATH_AND_PREVIEW,
                [visibleToolPathsLength, visibleToolPathsLength, visibleToolPathsLength]
            );
        }
        toolPathGroup.toolPaths.forEach((toolPath) => {
            toolPath.setWarningStatus();
            toolPath.clearModelObjects();
            toolPathGroup.toolPathObjects.remove(toolPath.object);
            toolPath.object = toolPath.object.clone();
            toolPathGroup.toolPathObjects.add(toolPath.object);
        });
        // toolPathGroup.selectToolPathById();
        dispatch(baseActions.updateState(headType, {
            needToPreview: false
        }));
        dispatch(processActions.recalculateAllToolPath(headType));
        dispatch(processActions.showToolPathGroupObject(headType));
        // Different models cannot be selected in process page
        SVGActions.clearSelection();
        dispatch(baseActions.render(headType));
    },

    showToolPathGroupObject: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup, displayedType } = getState()[headType];
        if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
            return;
        }
        if (toolPathGroup.toolPaths.length === 0) {
            return;
        }
        modelGroup.hideAllModelsObj3D();
        toolPathGroup.show();
        toolPathGroup.showToolpathObjects(true, headType === HEAD_LASER);
        dispatch(baseActions.updateState(headType, {
            displayedType: DISPLAYED_TYPE_TOOLPATH,
            showToolPath: true,
            showSimulation: false
        }));
        dispatch(baseActions.render(headType));
    },

    showModelGroupObject: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup, displayedType } = getState()[headType];
        if (displayedType === DISPLAYED_TYPE_MODEL) {
            return;
        }
        modelGroup.showAllModelsObj3D();
        toolPathGroup.hide();
        dispatch(baseActions.updateState(headType, {
            displayedType: DISPLAYED_TYPE_MODEL,
            showToolPath: false,
            showSimulation: false
        }));
        dispatch(baseActions.render(headType));
    },

    showToolpathInPreview: (headType, show) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.showToolpathObjects(show);
        dispatch(baseActions.updateState(headType, {
            showToolPath: show
        }));
        dispatch(baseActions.render(headType));
    },

    showSimulationInPreview: (headType, show) => (dispatch, getState) => {
        const { toolPathGroup, displayedType } = getState()[headType];
        if (displayedType === DISPLAYED_TYPE_MODEL) {
            return;
        }
        toolPathGroup.showSimulationObject(show);
        dispatch(baseActions.updateState(headType, {
            showSimulation: show
        }));
        dispatch(baseActions.render(headType));
    },

    resetSimulationPreviewState: (headType) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            simulationNeedToPreview: true
        }));
        dispatch(baseActions.render(headType));
    },

    selectModelInProcess: (headType, intersect, selectEvent) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];

        if (!intersect) {
            modelGroup.setSelectedToolPathModelIDs([]);
        } else {
            const model = modelGroup.getSelectedModelByIntersect(intersect);

            if (selectEvent === SELECTEVENT.UNSELECT_ADDSELECT) {
                modelGroup.setSelectedToolPathModelIDs([model.modelID]);
            } else if (selectEvent === SELECTEVENT.ADDSELECT) {
                const selectedModels = modelGroup.getSelectedToolPathModels();
                const text1 = i18n._('key-CncLaser/Toast-Failed to generate a toolpath. Selected objects should be of the same type.');
                if (getToolPathType([...selectedModels, model]).length !== 1) {
                    if (!toastId || !toast.isActive(toastId)) {
                        // toastId = toast(i18n._('key-CncLaser/Toast-Failed to generate a toolpath. Selected objects should be of the same type.'));
                        toastId = toast(ToastWapper(text1, 'WarningTipsTips', '#1890ff'));
                    }
                } else if (selectedModels.findIndex(m => m === model) === -1) {
                    modelGroup.addSelectedToolPathModelIDs([model.modelID]);
                } else {
                    modelGroup.removeSelectedToolPathModelIDs([model.modelID]);
                }
            } else if (selectEvent === SELECTEVENT.REMOVESELECT) {
                modelGroup.removeSelectedToolPathModelIDs([model.modelID]);
            } else {
                modelGroup.setSelectedToolPathModelIDs([]);
            }
        }
    },

    selectAllToolPathModels: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        modelGroup.setAllSelectedToolPathModelIDs();
    },

    createToolPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup, materials, modelGroup } = getState()[headType];
        const selectedModels = modelGroup.getSelectedModelArray();
        const text1 = i18n._('key-CncLaser/Toast-Failed to generate a toolpath. Selected objects should be of the same type.');
        if (getToolPathType(selectedModels).length !== 1) {
            if (!toastId || !toast.isActive(toastId)) {
                // toastId = toast(i18n._('key-CncLaser/Toast-Failed to generate a toolpath. Selected objects should be of the same type.'));
                toastId = toast(ToastWapper(text1, 'WarningTipsTips', '#1890ff'));
            }
            return null;
        }

        const toolPath = toolPathGroup.createToolPath({ materials });
        if (toolPath) {
            dispatch(baseActions.updateState(headType, {
                isChangedAfterGcodeGenerating: true
            }));
        }
        return toolPath;
    },

    selectToolPathById: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.selectToolPathById(toolPathId);
    },

    selectToolPathId: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.selectToolPathId(toolPathId);
    },

    selectOneToolPathId: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.selectOneToolPathId(toolPathId);
    },

    saveToolPath: (headType, toolPath) => (dispatch, getState) => {
        const { toolPathGroup, materials, autoPreviewEnabled, displayedType } = getState()[headType];
        if (toolPathGroup.getToolPath(toolPath.id)) {
            toolPathGroup.updateToolPath(toolPath.id, toolPath, { materials });
        } else {
            toolPathGroup.saveToolPath(toolPath, { materials }, false);
        }
        if (autoPreviewEnabled) {
            dispatch(processActions.preview(headType));
        }
        if (displayedType !== DISPLAYED_TYPE_TOOLPATH) {
            dispatch(baseActions.updateState(headType, {
                simulationNeedToPreview: true,
                displayedType: DISPLAYED_TYPE_MODEL,
                needToPreview: true,
                isChangedAfterGcodeGenerating: true
            }));
        }
    },

    updateToolPath: (headType, toolPathId, newState) => (dispatch, getState) => {
        const { toolPathGroup, materials } = getState()[headType];
        toolPathGroup.updateToolPath(toolPathId, newState, { materials });
        dispatch(processActions.showSimulationInPreview(headType, false));
        dispatch(processActions.resetSimulationPreviewState(headType));
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    toolPathToUp: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPathToUp(toolPathId);
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    toolPathToDown: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPathToDown(toolPathId);
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    toolPathToTop: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPathToTop(toolPathId);
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    toolPathToBottom: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPathToBottom(toolPathId);
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    deleteToolPath: (headType, selectedToolPathIDArray) => (dispatch, getState) => {
        const { toolPathGroup, displayedType } = getState()[headType];

        const operations = new Operations();
        selectedToolPathIDArray.forEach((id) => {
            const operation = new DeleteToolPathOperation({
                target: toolPathGroup._getToolPath(id),
                toolPathGroup
            });
            operations.push(operation);
            toolPathGroup.deleteToolPath(id);
        });

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(processActions.showSimulationInPreview(headType, false));

        let newDisplayedType = displayedType;
        let newNeedToPreview = false;
        if (!toolPathGroup.checkHasVisibleToolPaths()) {
            newDisplayedType = DISPLAYED_TYPE_MODEL;
            newNeedToPreview = true;
        }
        dispatch(baseActions.updateState(headType, {
            displayedType: newDisplayedType,
            needToPreview: newNeedToPreview,
            isChangedAfterGcodeGenerating: true
        }));
    },

    commitGenerateToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup, materials, progressStatesManager } = getState()[headType];
        if (toolPathGroup.commitToolPath(toolPathId, { materials })) {
            dispatch(baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH,
                isChangedAfterGcodeGenerating: true,
                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH, 0)
            }));
        }
    },

    setThumbnail: (headType, thumbnail) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.updateThumbnail(thumbnail);
    },

    /**
     * Commit Generate G-code Task.
     *
     * @param headType
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    commitGenerateGcode: (headType) => (dispatch, getState) => {
        const { toolPathGroup, progressStatesManager } = getState()[headType];
        const toolPaths = toolPathGroup.getCommitGenerateGcodeInfos();

        if (!toolPaths || toolPaths.length === 0) {
            return;
        }

        toolPaths[0].thumbnail = toolPathGroup.thumbnail;

        dispatch(baseActions.updateState(
            headType, { isGcodeGenerating: true }
        ));
        dispatch(baseActions.updateState(headType, {
            stage: STEP_STAGE.CNC_LASER_GENERATING_GCODE,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_GCODE, 0.1)
        }));
        controller.commitGcodeTask({
            taskId: uuid(),
            headType: headType,
            data: toolPaths
        });
    },

    onGenerateGcode: (headType, taskResult) => async (dispatch, getState) => {
        const { modelGroup, toolPathGroup, progressStatesManager } = getState()[headType];
        const { toolPaths } = toolPathGroup;
        const suffix = headType === 'laser' ? '.nc' : '.cnc';
        const models = _.filter(modelGroup.getModels(), { 'visible': true });
        const toolPathsModelIds = toolPaths.reduce((prev, item) => {
            if (item.visible) {
                prev.add(item.visibleModelIDs);
            }
            return prev;
        }, new Set());
        const currentModelName = _.find(models, (item) => {
            return toolPathsModelIds.has(item.modelID);
        })?.modelName.substr(0, 128);
        const renderGcodeFileName = `${_.replace(currentModelName, /(\.svg|\.dxf|\.png|\.jpg|\.jpeg|\.bmp)$/, '')}_${new Date().getTime()}${suffix}`;
        if (taskResult.taskStatus === 'failed') {
            modelGroup.estimatedTime = 0;
            await dispatch(baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_GENERATE_GCODE_FAILED,
                isGcodeGenerating: false,
                progress: 1
            }));
            return;
        }
        const { gcodeFile } = taskResult;
        modelGroup.estimatedTime = gcodeFile.estimatedTime;
        toolPathGroup.showSimulationObject(false);
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: false,
            gcodeFile: {
                boundingBox: gcodeFile.boundingBox,
                name: gcodeFile.name,
                uploadName: gcodeFile.name,
                estimatedTime: gcodeFile.estimatedTime,
                size: gcodeFile.size,
                lastModified: gcodeFile.lastModified,
                thumbnail: gcodeFile.thumbnail,
                renderGcodeFileName: renderGcodeFileName
            },
            stage: STEP_STAGE.CNC_LASER_GENERATING_GCODE,
            isGcodeGenerating: false,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_GCODE, 1)
        }));
        progressStatesManager.finishProgress(true);
        dispatch(baseActions.render(headType));
    },

    /**
     * Generate View Path.
     *
     * @param headType
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    commitGenerateViewPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup, materials, progressStatesManager } = getState()[headType];

        progressStatesManager.startProgress(PROCESS_STAGE.CNC_LASER_VIEW_PATH, [1, 1]);
        dispatch(baseActions.updateState(headType, {
            stage: STEP_STAGE.CNC_LASER_GENERATING_VIEWPATH,
            simulationNeedToPreview: false,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_VIEWPATH, 0.01)
        }));

        const viewPathInfos = toolPathGroup.getCommitGenerateViewPathInfos({ materials });

        if (!viewPathInfos || viewPathInfos.length === 0) {
            return;
        }

        controller.commitViewPathTask({
            taskId: uuid(),
            headType: headType,
            data: viewPathInfos
        });
    },

    setAutoPreview: (headType, autoPreviewEnabled) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            autoPreviewEnabled
        }));
    },

    onGenerateViewPath: (headType, taskResult) => async (dispatch, getState) => {
        const size = getState()[headType]?.coordinateSize;
        const { toolPathGroup, materials, coordinateMode, progressStatesManager } = getState()[headType];
        const { isRotate } = materials;

        if (taskResult.taskStatus === 'failed') {
            dispatch(baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_GENERATE_GCODE_FAILED,
                progress: 1
            }));
            progressStatesManager.finishProgress(false);
            return;
        }
        const { viewPathFile } = taskResult;
        const coorDelta = {
            dx: size.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x,
            dy: size.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y
        };
        const boundarySize = {
            minX: -size.x / 2 + coorDelta?.dx,
            maxX: size.x / 2 + coorDelta?.dx,
            minY: -size.y / 2 + coorDelta?.dy,
            maxY: size.y / 2 + coorDelta?.dy
        };
        await toolPathGroup.onGenerateViewPath(viewPathFile, isRotate ? materials : boundarySize);

        dispatch(baseActions.updateState(headType, {
            showSimulation: true,
            stage: STEP_STAGE.CNC_LASER_RENDER_VIEWPATH,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_VIEWPATH, 1)
        }));
        progressStatesManager.finishProgress(true);
        dispatch(baseActions.render(headType));
    },

    clearGcodeFile: (headType) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            gcodeFile: null
        }));
        dispatch(baseActions.render(headType));
    },

    _checkModelsInChunkArea: (headType) => (dispatch, getState) => {
        const { materials, SVGActions } = getState()[headType];
        if (materials.isRotate) {
            const { size } = getState().machine;
            const { y = 0, fixtureLength = 0 } = materials;

            const height = Math.min(fixtureLength, y);
            const posY = size.y - y;
            const ChunkAreaY = height + posY;

            const svgSelectedGroupBoundingBox = SVGActions.getSelectedElementsBoundingBox();
            const text1 = i18n._('key-CncLaser/Toast-Moving objects to this area may cause a machine collision.');
            if (svgSelectedGroupBoundingBox.y < ChunkAreaY) {
                if (!toastId || !toast.isActive(toastId)) {
                    toastId = toast(ToastWapper(text1, 'WarningTipsWarning', '#FFA940'));
                }
            }
        }
        return null;
    },

    // profile manager
    changeActiveToolListDefinition: (headType, definitionId, name, shouldSaveToolpath = false) => async (dispatch, getState) => {
        const { toolDefinitions } = getState()[headType];
        const activeToolListDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
        activeToolListDefinition.shouldSaveToolpath = shouldSaveToolpath;
        dispatch(baseActions.updateState(headType, {
            activeToolListDefinition
        }));
    },

    duplicateToolListDefinition: (headType, activeToolListDefinition) => async (dispatch, getState) => {
        const state = getState()[headType];
        const newToolDefinitions = state.toolDefinitions;
        const category = activeToolListDefinition.category;
        const newToolListDefinition = {
            ...activeToolListDefinition,
            definitionId: `tool.${timestamp()}`
        };
        const definitionsWithSameCategory = newToolDefinitions.filter(d => d.category === category);
        // make sure name is not repeated
        while (definitionsWithSameCategory.find(d => d.name === newToolListDefinition.name)) {
            newToolListDefinition.name = `#${newToolListDefinition.name}`;
        }
        const createdDefinition = await definitionManager.createDefinition(newToolListDefinition);

        dispatch(baseActions.updateState(headType, {
            toolDefinitions: [...newToolDefinitions, createdDefinition]
        }));
        return createdDefinition;
    },
    onUploadToolDefinition: (headType, file) => async (dispatch, getState) => {
        const { toolDefinitions } = getState()[headType];
        const formData = new FormData();
        formData.append('file', file);
        // set a new name that cannot be repeated
        formData.append('uploadName', `${file.name.substr(0, file.name.length - 9)}${timestamp()}.def.json`);
        api.uploadFile(formData)
            .then(async (res) => {
                const response = res.body;
                const definitionId = `New.${timestamp()}`;
                const definition = await definitionManager.uploadDefinition(definitionId, response.uploadName);
                let name = definition.name;
                while (toolDefinitions.find(e => e.name === name)) {
                    name = `#${name}`;
                }
                definition.name = name;
                await definitionManager.updateDefinition({
                    definitionId: definition.definitionId,
                    name
                });
                dispatch(baseActions.updateState(headType, {
                    toolDefinitions: [...toolDefinitions, definition]
                }));
            })
            .catch(() => {
                // Ignore error
            });
    }
};
