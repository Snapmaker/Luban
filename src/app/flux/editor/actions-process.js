import uuid from 'uuid';
import { baseActions } from './actions-base';
import { controller } from '../../lib/controller';
import { CNC_LASER_STAGE } from './utils';

export const processActions = {
    showToolPathGroupObject: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup } = getState()[headType];
        modelGroup.hideAllModelsObj3D();
        toolPathGroup.show();
        dispatch(baseActions.updateState(headType, {
            showToolPathGroup: true
        }));
        dispatch(baseActions.render(headType));
    },

    showModelGroupObject: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup } = getState()[headType];
        modelGroup.showAllModelsObj3D();
        toolPathGroup.hide();
        dispatch(baseActions.updateState(headType, {
            showToolPathGroup: false
        }));
        dispatch(baseActions.render(headType));
    },

    createToolPath: (headType) => (dispatch, getState) => {
        const { toolPathGroup, materials } = getState()[headType];
        const toolPath = toolPathGroup.createToolPath({ materials });

        if (toolPath) {
            dispatch(baseActions.updateState(headType, {
                updatingToolPath: toolPath
            }));
        }
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
        const { toolPathGroup, materials } = getState()[headType];

        if (toolPathGroup.getToolPath(toolPath.id)) {
            toolPathGroup.updateToolPath(toolPath.id, toolPath);
        } else {
            toolPathGroup.saveToolPath(toolPath, { materials });
            dispatch(processActions.showToolPathGroupObject(headType));
        }
        dispatch(baseActions.updateState(headType, {
            updatingToolPath: null
        }));
    },

    updateToolPath: (headType, toolPathId, newState) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.updateToolPath(toolPathId, newState);
    },

    toolPathToUp: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPathToUp(toolPathId);
    },

    toolPathToDown: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.toolPathToDown(toolPathId);
    },

    deleteToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.deleteToolPath(toolPathId);
    },

    commitGenerateToolPath: (headType, toolPathId) => (dispatch, getState) => {
        const { toolPathGroup, materials } = getState()[headType];
        toolPathGroup.commitToolPath(toolPathId, { materials });
    },

    onGenerateToolPath: (headType, taskResult) => (dispatch, getState) => {
        const { toolPathGroup } = getState()[headType];
        toolPathGroup.onGenerateToolPath(taskResult);
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

    onGenerateGcode: (headType, taskResult) => async (dispatch) => {
        dispatch(baseActions.updateState(
            headType, {
                isGcodeGenerating: false
            }
        ));
        if (taskResult.taskStatus === 'failed') {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
            return;
        }
        const { gcodeFile } = taskResult;

        dispatch(baseActions.updateState(headType, {
            gcodeFile: {
                name: gcodeFile.name,
                uploadName: gcodeFile.name,
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
            progress: 0
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
        dispatch(baseActions.render(headType));
    }
};
