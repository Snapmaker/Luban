import uuid from 'uuid';
import { baseActions } from './actions-base';
import { controller } from '../../lib/controller';
import { CNC_LASER_STAGE } from './utils';
import { DISPLAYED_TYPE_MODEL, DISPLAYED_TYPE_TOOLPATH, HEAD_LASER, SELECTEVENT } from '../../constants';
import { getToolPathType } from '../../toolpaths/utils';

import { toast } from '../../ui/components/Toast';

import i18n from '../../lib/i18n';
import { actions as operationHistoryActions } from '../operation-history';
import DeleteToolPathOperation from '../operation-history/DeleteToolPathOperation';
import Operations from '../operation-history/Operations';

let toastId;

export const processActions = {
    recalculateAllToolPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPaths.forEach((toolPath) => {
            dispatch(processActions.commitGenerateToolPath(headType, toolPath.id));
        });
    },

    preview: (headType) => (dispatch, getState) => {
        const { SVGActions, toolPathGroup } = getState()[headType];
        toolPathGroup.toolPaths.forEach((toolPath) => {
            toolPathGroup.toolPathObjects.remove(toolPath.object);
            toolPath.object = toolPath.object.clone();
            toolPathGroup.toolPathObjects.add(toolPath.object);
        });
        toolPathGroup.selectToolPathById();
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
                if (getToolPathType([...selectedModels, model]).length !== 1) {
                    if (!toastId || !toast.isActive(toastId)) {
                        toastId = toast(i18n._('Failed to generate a toolpath. Selected objects should be of the same type.'));
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
        if (getToolPathType(selectedModels).length !== 1) {
            if (!toastId || !toast.isActive(toastId)) {
                toastId = toast(i18n._('Failed to generate a toolpath. Selected objects should be of the same type.'));
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

    updatingToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        const toolPath = toolPathGroup.getToolPath(toolPathId);
        dispatch(baseActions.updateState(headType, {
            updatingToolPath: toolPath
        }));
    },

    saveToolPath: (headType, toolPath) => (dispatch, getState) => {
        const { toolPathGroup, materials, autoPreviewEnabled } = getState()[headType];
        if (toolPathGroup.getToolPath(toolPath.id)) {
            toolPathGroup.updateToolPath(toolPath.id, toolPath, { materials });
        } else {
            toolPathGroup.saveToolPath(toolPath, { materials }, false);
        }
        if (autoPreviewEnabled) {
            dispatch(processActions.preview(headType));
        }
        dispatch(baseActions.updateState(headType, {
            simulationNeedToPreview: true,
            displayedType: DISPLAYED_TYPE_MODEL,
            needToPreview: true,
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
        const { toolPathGroup } = getState()[headType];

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
        dispatch(baseActions.updateState(headType, {
            displayedType: DISPLAYED_TYPE_MODEL,
            needToPreview: true,
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

    onGenerateToolPath: (headType, taskResult) => async (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        await toolPathGroup.onGenerateToolPath(taskResult);
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
            if (toolPathGroup.canGenerateGcode()) {
                dispatch(processActions.commitGenerateGcode(headType));
            }
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
        const { toolPathGroup } = getState()[headType];

        const toolPaths = toolPathGroup.getCommitGenerateGcodeInfos();
        if (!toolPaths || toolPaths.length === 0) {
            return;
        }

        toolPaths[0].thumbnail = toolPathGroup.thumbnail;

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
        const { modelGroup, toolPathGroup } = getState()[headType];
        if (taskResult.taskStatus === 'failed') {
            modelGroup.estimatedTime = 0;
            await dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
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
                name: gcodeFile.name,
                uploadName: gcodeFile.name,
                estimatedTime: gcodeFile.estimatedTime,
                size: gcodeFile.size,
                lastModified: gcodeFile.lastModified,
                thumbnail: gcodeFile.thumbnail
            },
            stage: CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS,
            isGcodeGenerating: false,
            progress: 1
        }));
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
        const size = getState()[headType]?.coordinateSize;
        const { toolPathGroup, materials, coordinateMode } = getState()[headType];
        const { isRotate } = materials;

        if (taskResult.taskStatus === 'failed') {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
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
            showSimulation: true
        }));
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
            if (svgSelectedGroupBoundingBox.y < ChunkAreaY) {
                if (!toastId || !toast.isActive(toastId)) {
                    toastId = toast(i18n._('Moving objects to this area may cause a machine collision.'));
                }
            }
        }
        return null;
    }
};
