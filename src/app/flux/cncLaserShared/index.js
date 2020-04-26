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
import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';


export const CNC_LASER_STAGE = {
    EMPTY: 0,
    GENERATING_TOOLPATH: 1,
    GENERATE_TOOLPATH_SUCCESS: 2,
    GENERATE_TOOLPATH_FAILED: 3,
    PREVIEWING: 4,
    PREVIEW_SUCCESS: 5,
    PREVIEW_FAILED: 6,
    RE_PREVIEW: 7,
    GENERATING_GCODE: 8,
    GENERATE_GCODE_SUCCESS: 9,
    GENERATE_GCODE_FAILED: 10
};

// headType: cnc/laser
export const actions = {
    updateState: (headType, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            headType,
            state
        };
    },

    updateTransformation: (headType, transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            headType,
            transformation
        };
    },

    updateGcodeConfig: (headType, gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            headType,
            gcodeConfig
        };
    },

    updateConfig: (headType, config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            headType,
            config
        };
    },

    // Model configurations
    resetCalculatedState: (headType) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            headType
        };
    },

    render: (headType) => (dispatch) => {
        dispatch(actions.updateState(headType, {
            renderingTimestamp: +new Date()
        }));
    },

    togglePage: (headType, page) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        dispatch(actions.updateState(headType, {
            page: page
        }));
        if (page === PAGE_EDITOR) {
            modelGroup.showAllModelsObj3D();
            toolPathModelGroup.hideAllToolPathModelsObj3D();
        } else {
            toolPathModelGroup.showAllToolPathModelsObj3D();
            for (const model of modelGroup.getModels()) {
                const toolPath = toolPathModelGroup.getToolPathModel(model.modelID);
                if (toolPath.needPreview) {
                    toolPath.updateVisible(false);
                    model.updateVisible(true);
                } else {
                    toolPath.updateVisible(true);
                    model.updateVisible(false);
                }
            }
            dispatch(actions.manualPreview(headType));
        }
        dispatch(actions.render(headType));
    },

    uploadImage: (headType, file, mode, onError) => (dispatch) => {
        // check params

        if (!['cnc', 'laser'].includes(headType)) {
            onError(`Params error: func = ${headType}`);
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
                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },

    uploadCaseImage: (headType, file, mode, caseConfigs, caseTransformation, onError) => (dispatch) => {
        // check params

        if (!['cnc', 'laser'].includes(headType)) {
            onError(`Params error: func = ${headType}`);

            return;
        }

        if (!['greyscale', 'bw', 'vector', 'trace'].includes(mode)) {
            onError(`Params error: mode = ${mode}`);
            return;
        }
        api.uploadLaserCaseImage(file)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;
                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, caseConfigs, caseTransformation));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },
    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight, mode, configs, caseTransformation) => async (dispatch, getState) => {
        const { size } = getState().machine;
        const { modelGroup, toolPathModelGroup } = getState()[headType];

        const extname = path.extname(uploadName).toLowerCase();
        let sourceType;
        if (extname === '.svg') {
            sourceType = 'svg';
        } else if (extname === '.dxf') {
            sourceType = 'dxf';
        } else {
            sourceType = 'raster';
        }
        // const sourceType = (path.extname(uploadName).toLowerCase() === '.svg' || path.extname(uploadName).toLowerCase() === '.dxf') ? 'svg' : 'raster';
        const { width, height } = sizeModelByMachineSize(size, sourceWidth, sourceHeight);
        // Generate geometry

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        if (!checkParams(headType, sourceType, mode)) {
            return;
        }


        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode);
        const { config } = modelDefaultConfigs;
        let { gcodeConfig } = modelDefaultConfigs;

        if (headType === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            gcodeConfig = { ...gcodeConfig, toolDiameter, toolAngle };
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

        if (`${headType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            // model.updateTransformation({ width: 40 });
            transformation = { ...transformation, width: 40 };
        }

        const modelState = await modelGroup.generateModel({
            limitSize: size,
            headType,
            sourceType,
            mode,
            originalName,
            uploadName,
            sourceWidth,
            sourceHeight,
            geometry,
            material,
            transformation,
            config
        });

        const toolPathModelState = toolPathModelGroup.generateToolPathModel({
            modelID: modelState.selectedModelID,
            mode,
            gcodeConfig
        });

        dispatch(actions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));

        dispatch(actions.resetCalculatedState(headType));
        dispatch(actions.updateState(headType, {
            hasModel: true
        }));

        dispatch(actions.recordSnapshot(headType));
        dispatch(actions.render(headType));
    },

    insertDefaultTextVector: (headType, caseConfigs, caseTransformation) => (dispatch, getState) => {
        const { size } = getState().machine;

        api.convertTextToSvg({
            ...DEFAULT_TEXT_CONFIG
        })
            .then(async (res) => {
                // const { name, filename, width, height } = res.body;
                const { originalName, uploadName, width, height } = res.body;
                const { modelGroup, toolPathModelGroup } = getState()[headType];
                const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });
                const sourceType = 'text';
                const mode = 'vector';
                const textSize = computeTransformationSizeForTextVector(
                    DEFAULT_TEXT_CONFIG.text, DEFAULT_TEXT_CONFIG.size, DEFAULT_TEXT_CONFIG.lineHeight, { width, height }
                );
                const geometry = new THREE.PlaneGeometry(textSize.width, textSize.height);

                if (!checkParams(headType, sourceType, mode)) {
                    return;
                }

                const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode);

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

                const modelState = await modelGroup.generateModel({
                    limitSize: size,
                    headType: headType,
                    mode,
                    sourceType,
                    originalName,
                    uploadName,
                    sourceWidth: width,
                    sourceHeight: height,
                    geometry,
                    material,
                    transformation,
                    config
                });
                const toolPathModelState = toolPathModelGroup.generateToolPathModel({
                    modelID: modelState.selectedModelID,
                    gcodeConfig
                });
                dispatch(actions.updateState(headType, {
                    ...modelState,
                    ...toolPathModelState
                }));

                dispatch(actions.resetCalculatedState(headType));
                dispatch(actions.updateState(headType, {
                    hasModel: true
                }));
                dispatch(actions.recordSnapshot(headType));
                dispatch(actions.render(headType));
            });
    },

    changeSelectedModelMode: (headType, sourceType, mode) => async (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode);
        const { config } = modelDefaultConfigs;
        let { gcodeConfig } = modelDefaultConfigs;
        if (headType === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            gcodeConfig = { ...gcodeConfig, toolDiameter, toolAngle };
        }
        const modelState = await modelGroup.updateSelectedMode(mode, config);
        const toolPathModelState = toolPathModelGroup.updateSelectedMode(mode, gcodeConfig);

        dispatch(actions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));
        dispatch(actions.recordSnapshot(headType));
        dispatch(actions.render(headType));
    },


    changeSelectedModelShowOrigin: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        const showOrigin = modelGroup.changeShowOrigin();
        dispatch(actions.updateState(headType, {
            showOrigin,
            renderingTimestamp: +new Date()
        }));
    },

    // call once
    initModelsPreviewChecker: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, isAllModelsPreviewed } = getState()[headType];
        const check = () => {
            const isAllModelsPreviewedN = checkIsAllModelsPreviewed(modelGroup, toolPathModelGroup);
            if (isAllModelsPreviewedN !== isAllModelsPreviewed) {
                dispatch(actions.updateState(headType, { isAllModelsPreviewed: isAllModelsPreviewedN }));
            }
            setTimeout(check, 200);
        };
        check();
    },

    getEstimatedTime: (headType, type) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        if (type === 'selected') {
            return modelGroup.estimatedTime;
        } else {
            // for (const model of modelGroup.children) {
            return modelGroup.totalEstimatedTime();
        }
    },

    getSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        return modelGroup.getSelectedModel();
    },

    selectModel: (headType, modelMeshObject) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const selectedModelState = modelGroup.selectModel(modelMeshObject);
        const toolPathModelState = toolPathModelGroup.selectToolPathModel(selectedModelState.selectedModelID);

        const state = {
            ...selectedModelState,
            ...toolPathModelState
        };
        dispatch(actions.updateState(headType, state));
    },

    removeSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelState = modelGroup.removeSelectedModel();
        const toolPathModelState = toolPathModelGroup.removeSelectedToolPathModel();
        dispatch(actions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));
        if (!modelState.hasModel) {
            dispatch(actions.updateState(headType, {
                stage: 0,
                progress: 0
            }));
        }
        dispatch(actions.recordSnapshot(headType));
        dispatch(actions.render(headType));
    },

    unselectAllModels: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelState = modelGroup.unselectAllModels();
        const toolPathModelState = toolPathModelGroup.unselectAllModels();
        dispatch(actions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));
    },

    /**
     * Generate G-code.
     *
     * @param headType
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    generateGcode: (headType, thumbnail) => (dispatch, getState) => {
        const modelInfos = [];
        const { modelGroup, toolPathModelGroup } = getState()[headType];
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
            headType, {
                isGcodeGenerating: true
            }
        ));
        orderModelInfos[0].thumbnail = thumbnail;
        controller.commitGcodeTask({ taskId: uuid.v4(), headType: headType, data: orderModelInfos });
        dispatch(actions.updateState(headType, {
            stage: CNC_LASER_STAGE.GENERATING_GCODE,
            progress: 0
        }));
    },

    /**
     * Callback function trigger by event when G-code generated.
     *
     * @param headType
     * @param taskResult
     * @returns {Function}
     */
    onReceiveGcodeTaskResult: (headType, taskResult) => async (dispatch) => {
        dispatch(actions.updateState(
            headType, {
                isGcodeGenerating: false
            }
        ));
        if (taskResult.taskStatus === 'failed') {
            dispatch(actions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
            return;
        }
        const { gcodeFile } = taskResult;

        dispatch(actions.updateState(headType, {
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

    updateSelectedModelPrintOrder: (headType, printOrder) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[headType];
        toolPathModelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(actions.updateState(headType, { printOrder }));
        dispatch(actions.resetCalculatedState(headType));
    },

    updateSelectedModelGcodeConfig: (headType, gcodeConfig) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[headType];
        toolPathModelGroup.updateSelectedGcodeConfig(gcodeConfig);
        dispatch(actions.updateGcodeConfig(headType, gcodeConfig));
        dispatch(actions.previewModel(headType));
        dispatch(actions.resetCalculatedState(headType));
    },

    updateSelectedModelConfig: (headType, config) => async (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        await modelGroup.updateSelectedConfig(config);
        toolPathModelGroup.updateSelectedNeedPreview(true);
        dispatch(actions.updateConfig(headType, config));
        dispatch(actions.recordSnapshot(headType));
        dispatch(actions.resetCalculatedState(headType));
    },

    updateAllModelGcodeConfig: (headType, gcodeConfig) => (dispatch, getState) => {
        // const { modelGroup, model } = getState()[headType];
        const { toolPathModelGroup, selectedModelID } = getState()[headType];
        toolPathModelGroup.updateAllModelGcodeConfig(gcodeConfig);
        dispatch(actions.manualPreview(headType));
        if (selectedModelID) {
            dispatch(actions.updateGcodeConfig(headType, gcodeConfig));
            dispatch(actions.resetCalculatedState(headType));
            dispatch(actions.render(headType));
        }
    },

    updateSelectedModelTextConfig: (headType, newConfig) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, config } = getState()[headType];
        newConfig = {
            ...config,
            ...newConfig
        };
        api.convertTextToSvg(newConfig)
            .then(async (res) => {
                const { originalName, uploadName, width, height } = res.body;

                const source = { originalName, uploadName, sourceHeight: height, sourceWidth: width };

                const textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, newConfig.lineHeight, { width, height });

                modelGroup.updateSelectedSource(source);
                modelGroup.updateSelectedModelTransformation({ ...textSize });
                await modelGroup.updateSelectedConfig(newConfig);
                toolPathModelGroup.updateSelectedNeedPreview(true);

                // dispatch(actions.showModelObj3D(headType));
                dispatch(actions.updateConfig(headType, newConfig));
                dispatch(actions.updateTransformation(headType, {
                    ...textSize
                }));
                dispatch(actions.resetCalculatedState(headType));
                dispatch(actions.recordSnapshot(headType));
                dispatch(actions.render(headType));
            });
    },

    onSetSelectedModelPosition: (headType, position) => (dispatch, getState) => {
        // const { model } = getState()[headType];
        // const transformation = model.modelInfo.transformation;
        const { transformation } = getState()[headType];
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
        dispatch(actions.updateSelectedModelTransformation(headType, transformation));
        dispatch(actions.onModelAfterTransform(headType));
    },

    onFlipSelectedModel: (headType, flipStr) => (dispatch, getState) => {
        // const { model } = getState()[headType];
        const { transformation } = getState()[headType];
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
        dispatch(actions.updateSelectedModelTransformation(headType, transformation));
        dispatch(actions.onModelAfterTransform(headType));
    },

    bringSelectedModelToFront: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        modelGroup.bringSelectedModelToFront();
    },

    sendSelectedModelToBack: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        modelGroup.sendSelectedModelToBack();
    },

    arrangeAllModels2D: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.arrangeAllModels2D();
        const modelState = modelGroup.onModelTransform();
        toolPathModelGroup.updateAllNeedPreview(true);

        dispatch(actions.showAllModelsObj3D(headType));
        dispatch(actions.updateTransformation(headType, modelState.transformation));
        dispatch(actions.manualPreview(headType));
        dispatch(actions.recordSnapshot(headType));
        dispatch(actions.render(headType));
    },

    updateSelectedModelTransformation: (headType, transformation) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelState = modelGroup.updateSelectedModelTransformation(transformation);

        if (modelState) {
            toolPathModelGroup.updateSelectedNeedPreview(true);
            dispatch(actions.updateTransformation(headType, modelState.transformation));
            dispatch(actions.resetCalculatedState(headType));
            dispatch(actions.render(headType));
        }
    },

    // callback
    onModelTransform: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, transformationUpdateTime } = getState()[headType];

        const modelState = modelGroup.onModelTransform();
        toolPathModelGroup.updateSelectedNeedPreview(true);
        dispatch(actions.changeModelVisualizer(headType, modelState.modelID, false));
        if (new Date().getTime() - transformationUpdateTime > 50) {
            dispatch(actions.updateTransformation(headType, modelState.transformation));
        }
    },

    onModelAfterTransform: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        if (modelGroup) {
            const modelState = modelGroup.onModelAfterTransform();

            if (modelState) {
                dispatch(actions.updateState(headType, { modelState }));
                dispatch(actions.previewModel(headType));
                dispatch(actions.updateTransformation(headType, modelState.transformation));
                dispatch(actions.recordSnapshot(headType));
            }
        }
    },

    setAutoPreview: (headType, value) => (dispatch) => {
        dispatch(actions.updateState(headType, {
            autoPreviewEnabled: value
        }));
        dispatch(actions.manualPreview(headType));
    },

    // todo: listen config, gcodeConfig
    initSelectedModelListener: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];

        // modelGroup.addEventListener('update', () => {
        modelGroup.object.addEventListener('update', () => {
            dispatch(actions.render(headType));
        });
    },

    showAllModelsObj3D: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.showAllModelsObj3D();
        toolPathModelGroup.hideAllToolPathModelsObj3D();
    },

    changeModelVisualizer: (headType, modelID, isPreview) => (dispatch, getState) => {
        const { page, modelGroup, toolPathModelGroup } = getState()[headType];
        if (page === PAGE_PROCESS) {
            const model = modelGroup.getModel(modelID);
            const toolPathModel = toolPathModelGroup.getToolPathModel(modelID);
            if (isPreview) {
                model.updateVisible(false);
                toolPathModel.updateVisible(true);
            } else {
                model.updateVisible(true);
                toolPathModel.updateVisible(false);
            }
        }
    },

    manualPreview: (headType, isPreview) => (dispatch, getState) => {
        const { page, modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[headType];
        if (page === PAGE_EDITOR) {
            return;
        }
        if (isPreview || autoPreviewEnabled) {
            for (const model of modelGroup.getModels()) {
                const modelTaskInfo = model.getTaskInfo();
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
                if (toolPathModelTaskInfo && toolPathModelTaskInfo.needPreview) {
                    const taskInfo = {
                        ...modelTaskInfo,
                        ...toolPathModelTaskInfo
                    };
                    controller.commitToolPathTask({ taskId: taskInfo.modelID, headType: headType, data: taskInfo });
                    dispatch(actions.updateState(headType, {
                        stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                        progress: 0
                    }));
                }
            }
        }
    },

    previewModel: (headType, isPreview) => (dispatch, getState) => {
        const { page, modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[headType];
        if (page === PAGE_EDITOR) {
            return;
        }
        if (isPreview || autoPreviewEnabled) {
            const modelState = modelGroup.getSelectedModel().getTaskInfo();
            if (modelState) {
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelState.modelID);
                if (toolPathModelTaskInfo && toolPathModelTaskInfo.needPreview) {
                    const taskInfo = {
                        ...modelState,
                        ...toolPathModelTaskInfo
                    };
                    controller.commitToolPathTask({ taskId: taskInfo.modelID, headType: headType, data: taskInfo });
                    dispatch(actions.updateState(headType, {
                        stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                        progress: 0
                    }));
                }
            }
        }
    },

    onReceiveTaskResult: (headType, taskResult) => async (dispatch, getState) => {
        // const state = getState()[headType];
        const { toolPathModelGroup } = getState()[headType];

        const { data, filename } = taskResult;

        if (taskResult.taskStatus === 'failed' && toolPathModelGroup.getToolPathModelByID(data.id)) {
            dispatch(actions.updateState(headType, {
                previewFailed: true,
                stage: CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED,
                progress: 1
            }));
            dispatch(actions.setAutoPreview(headType, false));
            return;
        }

        dispatch(actions.updateState({
            stage: CNC_LASER_STAGE.PREVIEWING,
            progress: 0
        }));

        const toolPathModelState = await toolPathModelGroup.receiveTaskResult(data, filename);

        if (toolPathModelState) {
            dispatch(actions.changeModelVisualizer(headType, toolPathModelState.modelID, true));
            // dispatch(actions.togglePage(headType, PAGE_PROCESS));
            dispatch(actions.updateState(headType, {
                previewFailed: false,
                stage: CNC_LASER_STAGE.PREVIEW_SUCCESS,
                progress: 1
            }));
            dispatch(actions.render(headType));
        } else {
            dispatch(actions.updateState(headType, {
                previewFailed: false,
                stage: CNC_LASER_STAGE.RE_PREVIEW,
                progress: 1
            }));
            dispatch(actions.render(headType));
        }
    },

    multiplySelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelState = modelGroup.multiplySelectedModel(1);
        toolPathModelGroup.multiplySelectedModel(modelState.modelID);

        dispatch(actions.recordSnapshot(headType));
        dispatch(actions.manualPreview(headType));
        dispatch(actions.render(headType));
    },

    undo: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, undoSnapshots, redoSnapshots } = getState()[headType];
        if (undoSnapshots.length <= 1) {
            return;
        }
        redoSnapshots.push(undoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);
        const toolPathModelState = toolPathModelGroup.undoRedo(snapshots.toolPathModels);

        toolPathModelGroup.updateAllNeedPreview(true);

        dispatch(actions.updateState(headType, {
            ...modelState,
            ...toolPathModelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(actions.manualPreview(headType));
        dispatch(actions.render(headType));
    },

    redo: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, undoSnapshots, redoSnapshots } = getState()[headType];
        if (redoSnapshots.length === 0) {
            return;
        }

        undoSnapshots.push(redoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);
        const toolPathModelState = toolPathModelGroup.undoRedo(snapshots.toolPathModels);

        toolPathModelGroup.updateAllNeedPreview(true);

        dispatch(actions.updateState(headType, {
            ...modelState,
            ...toolPathModelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(actions.manualPreview(headType));
        dispatch(actions.render(headType));
    },


    recordSnapshot: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, undoSnapshots, redoSnapshots } = getState()[headType];
        const cloneModels = modelGroup.cloneModels();
        const cloneToolPathModels = toolPathModelGroup.cloneToolPathModels();
        undoSnapshots.push({
            models: cloneModels,
            toolPathModels: cloneToolPathModels
        });
        redoSnapshots.splice(0);
        dispatch(actions.updateState(headType, {
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
