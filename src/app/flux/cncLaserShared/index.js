import path from 'path';
import * as THREE from 'three';
import uuid from 'uuid';
import api from '../../api';
import { controller } from '../../lib/controller';
import { DEFAULT_TEXT_CONFIG, sizeModelByMachineSize, generateModelDefaultConfigs, checkParams } from '../models/ModelInfoUtils';
import { checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './helpers';
import {
    ACTION_UPDATE_STATE,
    ACTION_RESET_CALCULATED_STATE,
    ACTION_UPDATE_TRANSFORMATION,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_CONFIG
} from '../actionType';


export const CNC_LASER_STAGE = {
    EMPTY: 0,
    GENERATING_TOOLPATH: 1,
    GENERATE_TOOLPATH_SUCCESS: 2,
    GENERATE_TOOLPATH_FAILED: 3,
    PREVIEWING: 4,
    PREVIEW_SUCCESS: 5,
    PREVIEW_FAILED: 6,
    GENERATING_GCODE: 7,
    GENERATE_GCODE_SUCCESS: 8,
    GENERATE_GCODE_FAILED: 9
};

// from: cnc/laser
export const actions = {
    updateState: (from, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            from,
            state
        };
    },

    updateTransformation: (from, transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            from,
            transformation
        };
    },

    updateGcodeConfig: (from, gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            from,
            gcodeConfig
        };
    },

    updateConfig: (from, config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            from,
            config
        };
    },

    // Model configurations
    resetCalculatedState: (from) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            from
        };
    },

    render: (from) => (dispatch) => {
        dispatch(actions.updateState(from, {
            renderingTimestamp: +new Date()
        }));
    },

    uploadImage: (headerType, file, mode, onError) => (dispatch) => {
        // check params

        if (!['cnc', 'laser'].includes(headerType)) {
            onError(`Params error: func = ${headerType}`);
            return;
        }
        if (!file) {
            onError(`Params error: file = ${file}`);
            return;
        }
        if (!['greyscale', 'bw', 'vector', 'trace'].includes(mode)) {
            onError(`Params error: mode = ${mode}`);
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;

                dispatch(actions.generateModel(headerType, originalName, uploadName, width, height, mode));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },

    uploadCaseImage: (headerType, file, mode, caseConfigs, caseTransformation, onError) => (dispatch) => {
        // check params

        if (!['cnc', 'laser'].includes(headerType)) {
            onError(`Params error: func = ${headerType}`);

            return;
        }

        if (!['greyscale', 'bw', 'vector', 'trace'].includes(mode)) {
            onError(`Params error: mode = ${mode}`);
            return;
        }
        api.uploadLaserCaseImage(file)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;
                dispatch(actions.generateModel(headerType, originalName, uploadName, width, height, mode, caseConfigs, caseTransformation));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },
    generateModel: (headerType, originalName, uploadName, sourceWidth, sourceHeight, mode, configs, caseTransformation) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { modelGroup, toolPathModelGroup } = getState()[headerType];

        const sourceType = path.extname(uploadName).toLowerCase() === '.svg' ? 'svg' : 'raster';

        const { width, height } = sizeModelByMachineSize(size, sourceWidth, sourceHeight);
        // Generate geometry

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        if (!checkParams(headerType, sourceType, mode)) {
            return;
        }

        const modelDefaultConfigs = generateModelDefaultConfigs(headerType, sourceType, mode);
        let { config } = modelDefaultConfigs;
        const { gcodeConfig } = modelDefaultConfigs;


        if (headerType === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            config = { ...config, toolDiameter, toolAngle };
        }
        // Pay attention to judgment conditions
        if (configs && configs.tool) {
            dispatch(actions.updateState('cnc', {
                toolSnap: configs.tool
            }));
        }
        if (configs && configs.config) {
            Object.entries(configs.config).forEach(([key, value]) => {
                if (config[key] !== null && config[key] !== undefined) {
                    config[key] = value;
                }
            });
        }
        if (configs && configs.gcodeConfig) {
            Object.entries(configs.gcodeConfig).forEach(([key, value]) => {
                if (gcodeConfig[key] !== null && gcodeConfig[key] !== undefined) {
                    gcodeConfig[key] = value;
                }
            });
        }

        let transformation = caseTransformation || {};

        if (`${headerType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            // model.updateTransformation({ width: 40 });
            transformation = { ...transformation, width: 40 };
        }


        const modelState = modelGroup.generateModel({
            limitSize: size,
            headerType,
            sourceType,
            originalName,
            uploadName,
            mode,
            sourceWidth,
            sourceHeight,
            geometry,
            material,
            transformation
        });
        const toolPathModelState = toolPathModelGroup.generateToolPathModel({
            modelID: modelState.selectedModelID,
            config,
            gcodeConfig
        });

        dispatch(actions.updateState(headerType, {
            ...modelState,
            ...toolPathModelState
        }));

        dispatch(actions.previewModel(headerType));
        dispatch(actions.resetCalculatedState(headerType));
        dispatch(actions.updateState(headerType, {
            hasModel: true
        }));

        dispatch(actions.recordSnapshot(headerType));
        dispatch(actions.render(headerType));
    },

    insertDefaultTextVector: (from, caseConfigs, caseTransformation) => (dispatch, getState) => {
        const { size } = getState().machine;

        api.convertTextToSvg({
            ...DEFAULT_TEXT_CONFIG
        })
            .then((res) => {
                // const { name, filename, width, height } = res.body;
                const { originalName, uploadName, width, height } = res.body;
                const { modelGroup, toolPathModelGroup } = getState()[from];
                const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });
                const sourceType = 'text';
                const mode = 'vector';
                const textSize = computeTransformationSizeForTextVector(
                    DEFAULT_TEXT_CONFIG.text, DEFAULT_TEXT_CONFIG.size, DEFAULT_TEXT_CONFIG.lineHeight, { width, height }
                );
                const geometry = new THREE.PlaneGeometry(textSize.width, textSize.height);

                if (!checkParams(from, sourceType, mode)) {
                    return;
                }

                const modelDefaultConfigs = generateModelDefaultConfigs(from, sourceType, mode);

                const config = { ...modelDefaultConfigs.config, ...DEFAULT_TEXT_CONFIG };
                const { gcodeConfig } = modelDefaultConfigs;

                if (caseConfigs && caseConfigs.config) {
                    Object.entries(caseConfigs.config).forEach(([key, value]) => {
                        if (config[key]) {
                            config[key] = value;
                        }
                    });
                }

                if (caseConfigs && caseConfigs.gcodeConfig) {
                    Object.entries(caseConfigs.gcodeConfig).forEach(([key, value]) => {
                        gcodeConfig[key] = value;
                    });
                }
                // const model = new Model(modelInfo);
                let transformation = caseTransformation || {};
                transformation = {
                    ...transformation,
                    width: textSize.width,
                    height: textSize.height
                };

                const modelState = modelGroup.generateModel({
                    limitSize: size,
                    headerType: from,
                    mode,
                    sourceType,
                    originalName,
                    uploadName,
                    sourceWidth: width,
                    sourceHeight: height,
                    geometry,
                    material,
                    transformation
                });
                const toolPathModelState = toolPathModelGroup.generateToolPathModel({
                    modelID: modelState.selectedModelID,
                    config,
                    gcodeConfig
                });
                dispatch(actions.updateState(from, {
                    ...modelState,
                    ...toolPathModelState
                }));

                dispatch(actions.previewModel(from));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.updateState(from, {
                    hasModel: true
                }));
                dispatch(actions.recordSnapshot(from));
                dispatch(actions.render(from));
            });
    },

    // call once
    initModelsPreviewChecker: (from) => (dispatch, getState) => {
        const { modelGroup, isAllModelsPreviewed } = getState()[from];
        const check = () => {
            const isAllModelsPreviewedN = checkIsAllModelsPreviewed(modelGroup);
            if (isAllModelsPreviewedN !== isAllModelsPreviewed) {
                dispatch(actions.updateState(from, { isAllModelsPreviewed: isAllModelsPreviewedN }));
            }
            setTimeout(check, 100);
        };
        check();
    },

    getEstimatedTime: (from, type) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        if (type === 'selected') {
            return modelGroup.estimatedTime;
        } else {
            // for (const model of modelGroup.children) {
            return modelGroup.totalEstimatedTime();
        }
    },

    getSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        return modelGroup.getSelectedModel();
    },

    selectModel: (from, modelMeshObject) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const selectedModelState = modelGroup.selectModel(modelMeshObject);
        const toolPathModelState = toolPathModelGroup.selectToolPathModel(selectedModelState.selectedModelID);

        const state = {
            ...selectedModelState,
            ...toolPathModelState
        };
        dispatch(actions.updateState(from, state));
    },

    removeSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const modelState = modelGroup.removeSelectedModel();
        const toolPathModelState = toolPathModelGroup.removeSelectedToolPathModel();
        dispatch(actions.updateState(from, {
            ...modelState,
            ...toolPathModelState
        }));
        if (!modelState.hasModel) {
            dispatch(actions.updateState(from, {
                stage: 0,
                progress: 0
            }));
        }
        dispatch(actions.recordSnapshot(from));
        dispatch(actions.render(from));
    },

    unselectAllModels: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const modelState = modelGroup.unselectAllModels();
        const toolPathModelState = toolPathModelGroup.unselectAllModels();
        dispatch(actions.updateState(from, {
            ...modelState,
            ...toolPathModelState
        }));
    },

    /**
     * Generate G-code.
     *
     * @param from
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    generateGcode: (from, thumbnail) => (dispatch, getState) => {
        const modelInfos = [];
        const { modelGroup, toolPathModelGroup } = getState()[from];
        for (const model of modelGroup.getModels()) {
            const modelTaskInfo = model.getTaskInfo();
            const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
            if (toolPathModelTaskInfo) {
                const taskInfo = {
                    ...modelTaskInfo,
                    ...toolPathModelTaskInfo
                };
                modelInfos.push(taskInfo);
            }
        }
        if (modelInfos.length === 0) {
            return;
        }
        const orderModelInfos = modelInfos.map(d => d).sort((d1, d2) => {
            if (d1.printOrder > d2.printOrder) {
                return 1;
            } else if (d1.printOrder < d2.printOrder) {
                return -1;
            } else {
                return 1;
            }
        });
        dispatch(actions.updateState(
            from, {
                isGcodeGenerating: true
            }
        ));
        orderModelInfos[0].thumbnail = thumbnail;
        controller.commitGcodeTask({ taskId: uuid.v4(), headType: from, data: orderModelInfos });
        dispatch(actions.updateState(from, {
            stage: CNC_LASER_STAGE.GENERATING_GCODE,
            progress: 0
        }));
    },

    /**
     * Callback function trigger by event when G-code generated.
     *
     * @param from
     * @param taskResult
     * @returns {Function}
     */
    onReceiveGcodeTaskResult: (from, taskResult) => async (dispatch) => {
        dispatch(actions.updateState(
            from, {
                isGcodeGenerating: false
            }
        ));
        if (taskResult.taskStatus === 'failed') {
            dispatch(actions.updateState(from, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
            return;
        }
        const { gcodeFile } = taskResult;

        dispatch(actions.updateState(from, {
            gcodeFile: {
                name: gcodeFile.name,
                uploadName: gcodeFile.name,
                size: gcodeFile.size,
                lastModifiedDate: gcodeFile.lastModifiedDate,
                thumbnail: gcodeFile.thumbnail
            },
            stage: CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS,
            progress: 1
        }));
    },

    updateSelectedModelPrintOrder: (from, printOrder) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[from];
        toolPathModelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(actions.updateState(from, { printOrder }));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[from];
        toolPathModelGroup.updateSelectedGcodeConfig(gcodeConfig);
        dispatch(actions.updateGcodeConfig(from, gcodeConfig));
        dispatch(actions.previewModel(from));
        dispatch(actions.recordSnapshot(from));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateConfig(config);
        const { toolPathModelGroup } = getState()[from];
        toolPathModelGroup.updateSelectedConfig(config);
        dispatch(actions.updateConfig(from, config));
        dispatch(actions.previewModel(from));
        dispatch(actions.recordSnapshot(from));
        dispatch(actions.resetCalculatedState(from));
    },

    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        // const { modelGroup, model } = getState()[from];
        const { toolPathModelGroup, selectedModelID } = getState()[from];
        toolPathModelGroup.updateAllModelConfig(config);
        dispatch(actions.manualPreview(from));
        if (selectedModelID) {
            dispatch(actions.updateConfig(from, config));
            dispatch(actions.resetCalculatedState(from));
            dispatch(actions.render(from));
        }
    },

    updateSelectedModelTextConfig: (from, config) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, transformation } = getState()[from];
        const toolPathModelState = toolPathModelGroup.getSelectedToolPathModelState();
        const newConfig = {
            ...toolPathModelState.config,
            ...config
        };
        api.convertTextToSvg(newConfig)
            .then((res) => {
                const { originalName, uploadName, width, height } = res.body;

                const source = { originalName, uploadName, sourceHeight: height, sourceWidth: width };

                const textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, newConfig.lineHeight, { width, height });

                modelGroup.updateSelectedSource(source);
                modelGroup.updateSelectedModelTransformation({ ...textSize });
                toolPathModelGroup.updateSelectedConfig(newConfig);

                dispatch(actions.updateState(from, {
                    ...source,
                    newConfig,
                    transformation: {
                        ...transformation,
                        ...textSize
                    }
                }));

                dispatch(actions.showModelObj3D(from));
                dispatch(actions.previewModel(from));
                dispatch(actions.updateConfig(from, newConfig));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.recordSnapshot(from));
                dispatch(actions.render(from));
            });
    },

    onSetSelectedModelPosition: (from, position) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // const transformation = model.modelInfo.transformation;
        const { transformation } = getState()[from];
        let posX = 0;
        let posY = 0;
        const { width, height } = transformation;
        switch (position) {
            case 'Top Left':
                posX = -width / 2;
                posY = height / 2;
                break;
            case 'Top Middle':
                posX = 0;
                posY = height / 2;
                break;
            case 'Top Right':
                posX = width / 2;
                posY = height / 2;
                break;
            case 'Center Left':
                posX = -width / 2;
                posY = 0;
                break;
            case 'Center':
                posX = 0;
                posY = 0;
                break;
            case 'Center Right':
                posX = width / 2;
                posY = 0;
                break;
            case 'Bottom Left':
                posX = -width / 2;
                posY = -height / 2;
                break;
            case 'Bottom Middle':
                posX = 0;
                posY = -height / 2;
                break;
            case 'Bottom Right':
                posX = width / 2;
                posY = -height / 2;
                break;
            default:
                posX = 0;
                posY = 0;
        }
        transformation.positionX = posX;
        transformation.positionY = posY;
        transformation.rotationZ = 0;
        dispatch(actions.updateSelectedModelTransformation(from, transformation));
        dispatch(actions.onModelAfterTransform(from));
    },

    onFlipSelectedModel: (from, flipStr) => (dispatch, getState) => {
        // const { model } = getState()[from];
        const { transformation } = getState()[from];
        let flip = transformation.flip;
        switch (flipStr) {
            case 'Vertical':
                flip ^= 1;
                break;
            case 'Horizontal':
                flip ^= 2;
                break;
            case 'Reset':
                flip = 0;
                break;
            default:
        }
        transformation.flip = flip;
        dispatch(actions.updateSelectedModelTransformation(from, transformation));
        dispatch(actions.onModelAfterTransform(from));
    },

    /*
    bringSelectedModelToFront() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.position.z = (sorted.length + 2) * margin;
    }

    sendSelectedModelToBack() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.position.z = 0;
    }
    */

    bringSelectedModelToFront: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.bringSelectedModelToFront();
    },

    sendSelectedModelToBack: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.sendSelectedModelToBack();
    },

    arrangeAllModels2D: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.arrangeAllModels2D();
    },

    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        // const { model } = getState()[from];
        // model.updateTransformation(transformation);
        const { modelGroup } = getState()[from];
        const modelState = modelGroup.updateSelectedModelTransformation(transformation);

        dispatch(actions.updateTransformation(from, modelState.transformation));
        dispatch(actions.showModelObj3D(from));
        // preview on onModelAfterTransform
        // dispatch(actions.previewModel(from));
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const modelState = modelGroup.onModelTransform();
        toolPathModelGroup.cancelSelectedPreview();
        dispatch(actions.updateTransformation(from, modelState.transformation));
        dispatch(actions.showModelObj3D(from));
    },

    onModelAfterTransform: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        if (modelGroup) {
            const modelState = modelGroup.onModelAfterTransform();
            dispatch(actions.updateState(from, { modelState }));
            dispatch(actions.previewModel(from));
            dispatch(actions.recordSnapshot(from));
        }
    },

    setAutoPreview: (from, value) => (dispatch) => {
        dispatch(actions.updateState(from, {
            autoPreviewEnabled: value
        }));
        dispatch(actions.manualPreview(from));
    },

    // todo: listen config, gcodeConfig
    initSelectedModelListener: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];

        modelGroup.onSelectedModelTransformChanged = () => {
            // const { model } = getState()[from];
            // model.onTransform();
            // model.updateTransformationFromModel();
            const modelState = modelGroup.onModelTransform();
            dispatch(actions.showAllModelsObj3D(from));
            dispatch(actions.manualPreview(from));
            dispatch(actions.updateTransformation(from, modelState.transformation));
            dispatch(actions.recordSnapshot(from));
            dispatch(actions.render(from));
        };

        // modelGroup.addEventListener('update', () => {
        modelGroup.object.addEventListener('update', () => {
            dispatch(actions.render(from));
        });
    },

    showAllModelsObj3D: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        modelGroup.showAllModelsObj3D();
        toolPathModelGroup.hideAllModelsObj3D();
    },

    showModelObj3D: (from, modelID) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        if (!modelID) {
            const modelState = modelGroup.getSelectedModelTaskInfo();
            if (!modelState) {
                return;
            }
            modelID = modelState.modelID;
        }
        modelGroup.showModelObj3D(modelID);
        toolPathModelGroup.hideToolPathObj3D(modelID);
    },

    showToolPathModelObj3D: (from, modelID) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        if (!modelID) {
            const modelState = modelGroup.getSelectedModelTaskInfo();
            if (!modelState) {
                return;
            }
            modelID = modelState.modelID;
        }
        if (modelID) {
            modelGroup.hideModelObj3D(modelID);
            toolPathModelGroup.showToolPathObj3D(modelID);
        }
    },

    manualPreview: (from, isPreview) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[from];
        if (isPreview || autoPreviewEnabled) {
            for (const model of modelGroup.getModels()) {
                const modelTaskInfo = model.getTaskInfo();
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
                if (toolPathModelTaskInfo) {
                    const taskInfo = {
                        ...modelTaskInfo,
                        ...toolPathModelTaskInfo
                    };
                    controller.commitToolPathTask({ taskId: taskInfo.modelID, headType: from, data: taskInfo });
                    dispatch(actions.updateState(from, {
                        stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                        progress: 0
                    }));
                }
            }
        }
    },

    previewModel: (from, isPreview) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[from];
        if (isPreview || autoPreviewEnabled) {
            const modelTaskInfo = modelGroup.getSelectedModelTaskInfo();
            if (modelTaskInfo) {
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
                if (toolPathModelTaskInfo) {
                    const taskInfo = {
                        ...modelTaskInfo,
                        ...toolPathModelTaskInfo
                    };
                    controller.commitToolPathTask({ taskId: taskInfo.modelID, headType: from, data: taskInfo });
                    dispatch(actions.updateState(from, {
                        stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                        progress: 0
                    }));
                }
            }
        }
    },

    onReceiveTaskResult: (from, taskResult) => async (dispatch, getState) => {
        // const state = getState()[from];
        const { toolPathModelGroup } = getState()[from];

        const { data, filename } = taskResult;

        if (taskResult.taskStatus === 'failed' && toolPathModelGroup.getToolPathModelByID(data.id)) {
            dispatch(actions.updateState(from, {
                previewUpdated: +new Date(),
                previewFailed: true,
                stage: CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED,
                progress: 1
            }));
            dispatch(actions.setAutoPreview(from, false));
            return;
        }

        dispatch(actions.updateState({
            stage: CNC_LASER_STAGE.PREVIEWING,
            progress: 0
        }));

        const toolPathModelState = await toolPathModelGroup.receiveTaskResult(data, filename);

        if (toolPathModelState) {
            dispatch(actions.showToolPathModelObj3D(from, toolPathModelState.modelID));
        }

        dispatch(actions.updateState(from, {
            previewUpdated: +new Date(),
            previewFailed: false,
            stage: CNC_LASER_STAGE.PREVIEW_SUCCESS,
            progress: 1
        }));
        dispatch(actions.render(from));
    },

    undo: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, undoSnapshots, redoSnapshots } = getState()[from];
        if (undoSnapshots.length <= 1) {
            return;
        }
        redoSnapshots.push(undoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);
        const toolPathModelState = toolPathModelGroup.undoRedo(snapshots.toolPathModels);

        dispatch(actions.updateState(from, {
            ...modelState,
            ...toolPathModelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        // dispatch(actions.showAllModelsObj3D(from));
        dispatch(actions.manualPreview(from));
        dispatch(actions.render(from));
    },

    redo: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, undoSnapshots, redoSnapshots } = getState()[from];
        if (redoSnapshots.length === 0) {
            return;
        }

        undoSnapshots.push(redoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);
        const toolPathModelState = toolPathModelGroup.undoRedo(snapshots.toolPathModels);

        dispatch(actions.updateState(from, {
            ...modelState,
            ...toolPathModelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        // dispatch(actions.showAllModelsObj3D(from));
        dispatch(actions.manualPreview(from));
        dispatch(actions.render(from));
    },


    recordSnapshot: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, undoSnapshots, redoSnapshots } = getState()[from];
        const cloneModels = modelGroup.cloneModels();
        const cloneToolPathModels = toolPathModelGroup.cloneToolPathModels();
        undoSnapshots.push({
            models: cloneModels,
            toolPathModels: cloneToolPathModels
        });
        redoSnapshots.splice(0);
        dispatch(actions.updateState(from, {
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
    }
};

export default function reducer() {
    return {};
}
