import uuid from 'uuid';
import { baseActions } from './actions-base';
import { controller } from '../../lib/controller';
import { CNC_LASER_STAGE } from './utils';
import { DISPLAYED_TYPE_MODEL, DISPLAYED_TYPE_TOOLPATH, SELECTEVENT } from '../../constants';
import { getToolPathType } from '../../toolpaths/utils';

import { toast } from '../../components/Toast';

import i18n from '../../lib/i18n';

let toastId;

export const processActions = {
    recalculateAllToolPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPaths.forEach((toolPath) => {
            dispatch(processActions.commitGenerateToolPath(headType, toolPath.id));
        });
    },

    preview: (headType) => (dispatch) => {
        dispatch(processActions.recalculateAllToolPath(headType));
        dispatch(processActions.showToolPathGroupObject(headType));
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
        toolPathGroup.showToolpathObjects(true);
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
                if (getToolPathType([...selectedModels, model]).length !== 1) {
                    if (!toastId || !toast.isActive(toastId)) {
                        toastId = toast(i18n._('Cannot generate toolpath; format of objects have to be the same.'));
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
        const { toolPathGroup, materials } = getState()[headType];
        const toolPath = toolPathGroup.createToolPath({ materials });

        if (toolPath) {
            dispatch(baseActions.updateState(headType, {
                updatingToolPath: toolPath,
                isChangedAfterGcodeGenerating: true
            }));
        }
    },

    fastCreateToolPath: (headType, toolParams) => async (dispatch, getState) => {
        const { toolPathGroup, materials, autoPreviewEnabled } = getState()[headType];
        await toolPathGroup.fastCreateToolPath({ materials, toolParams });
        if (autoPreviewEnabled) {
            dispatch(processActions.preview(headType));
        }
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    cancelUpdateToolPath: (headType) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            updatingToolPath: null
        }));
    },

    selectToolPathId: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.selectToolPathId(toolPathId);
    },

    updatingToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        const toolPath = toolPathGroup.getToolPath(toolPathId);
        dispatch(baseActions.updateState(headType, {
            updatingToolPath: toolPath
        }));
    },

    saveToolPath: (headType, toolPath) => (dispatch, getState) => {
        const { toolPathGroup, materials, autoPreviewEnabled } = getState()[headType];
        console.log('saveToolPath', toolPath);
        if (toolPathGroup.getToolPath(toolPath.id)) {
            toolPathGroup.updateToolPath(toolPath.id, toolPath, { materials });
        } else {
            toolPathGroup.saveToolPath(toolPath, { materials });
        }
        if (autoPreviewEnabled) {
            dispatch(processActions.preview(headType));
        }
        dispatch(baseActions.updateState(headType, {
            updatingToolPath: null,
            isChangedAfterGcodeGenerating: true
        }));
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

    deleteToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.deleteToolPath(toolPathId);
        dispatch(processActions.showSimulationInPreview(headType, false));
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
    },

    commitGenerateToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup, materials } = getState()[headType];
        if (toolPathGroup.commitToolPath(toolPathId, { materials })) {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                isChangedAfterGcodeGenerating: true,
                progress: 0
            }));
        }
    },

    onGenerateToolPath: (headType, taskResult) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.onGenerateToolPath(taskResult);
        if (taskResult.taskStatus === 'failed') {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED,
                progress: 1
            }));
        } else {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_TOOLPATH_SUCCESS,
                progress: 1
            }));
        }
    },

    /**
     * Commit Generate G-code Task.
     *
     * @param headType
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    commitGenerateGcode: (headType, thumbnail) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];

        const toolPaths = toolPathGroup.getCommitGenerateGcodeInfos();
        if (!toolPaths || toolPaths.length === 0) {
            return;
        }

        toolPaths[0].thumbnail = thumbnail;

        dispatch(baseActions.updateState(
            headType, {
                isGcodeGenerating: true
            }
        ));

        controller.commitGcodeTask({
            taskId: uuid.v4(),
            headType: headType,
            data: toolPaths
        });

        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.GENERATING_GCODE,
            progress: 0
        }));
    },

    onGenerateGcode: (headType, taskResult) => async (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        dispatch(baseActions.updateState(
            headType, {
                isGcodeGenerating: false
            }
        ));
        if (taskResult.taskStatus === 'failed') {
            modelGroup.estimatedTime = 0;
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
            return;
        }
        const { gcodeFile } = taskResult;
        modelGroup.estimatedTime = gcodeFile.estimatedTime;

        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: false,
            gcodeFile: {
                name: gcodeFile.name,
                uploadName: gcodeFile.name,
                estimatedTime: gcodeFile.estimatedTime,
                size: gcodeFile.size,
                lastModified: gcodeFile.lastModified,
                thumbnail: gcodeFile.thumbnail
            },
            stage: CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS,
            progress: 1
        }));
    },

    /**
     * Generate View Path.
     *
     * @param headType
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    commitGenerateViewPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup, materials } = getState()[headType];

        const viewPathInfos = toolPathGroup.getCommitGenerateViewPathInfos({ materials });

        if (!viewPathInfos || viewPathInfos.length === 0) {
            return;
        }

        controller.commitViewPathTask({
            taskId: uuid.v4(),
            headType: headType,
            data: viewPathInfos
        });
        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.GENERATING_GCODE,
            simulationNeedToPreview: false,
            progress: 0
        }));
    },

    setAutoPreview: (headType, autoPreviewEnabled) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            autoPreviewEnabled
        }));
    },

    onGenerateViewPath: (headType, taskResult) => async (dispatch, getState) => {
        const { size } = getState().machine;
        const { toolPathGroup, materials } = getState()[headType];
        const { isRotate } = materials;

        if (taskResult.taskStatus === 'failed') {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
            return;
        }
        const { viewPathFile } = taskResult;
        await toolPathGroup.onGenerateViewPath(viewPathFile, isRotate ? materials : size);
        dispatch(baseActions.updateState(headType, {
            showSimulation: true
        }));
        dispatch(baseActions.render(headType));
    }
};
