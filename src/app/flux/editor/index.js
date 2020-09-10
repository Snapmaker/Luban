import path from 'path';
import uuid from 'uuid';
import api from '../../api';
import {
    checkParams,
    DEFAULT_TEXT_CONFIG,
    generateModelDefaultConfigs,
    sizeModelByMachineSize
} from '../models/ModelInfoUtils';

import { threejsModelActions } from './threejs-model';
import { svgModelActions } from './svg-model';
import { baseActions, checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './base';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';
import { controller } from '../../lib/controller';

const getCount = (() => {
    let count = 0;

    return () => {
        return `modelID${count++}`;
    };
})();

const getSourceType = (fileName) => {
    let sourceType;
    const extname = path.extname(fileName)
        .toLowerCase();
    if (extname === '.svg') {
        sourceType = 'svg';
    } else if (extname === '.dxf') {
        sourceType = 'dxf';
    } else {
        sourceType = 'raster';
    }
    return sourceType;
};

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

export const actions = {

    ...baseActions,

    init: () => () => {},

    uploadImage: (headType, file, mode, onError) => (dispatch) => {
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;
                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, undefined, { svgNodeName: 'image' }));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },

    uploadCaseImage: (headType, file, mode, caseConfigs, caseTransformation, onError) => (dispatch) => {
        api.uploadLaserCaseImage(file)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;
                const { config } = caseConfigs;
                const { gcodeConfig } = caseConfigs;
                if (gcodeConfig.toolSnap) {
                    dispatch(baseActions.updateState(headType, {
                        toolSnap: gcodeConfig.toolSnap
                    }));
                }
                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, null, config, gcodeConfig, caseTransformation));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },

    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, config, gcodeConfig, transformation) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { toolParams, modelGroup, svgModelGroup } = getState()[headType];

        sourceType = sourceType || getSourceType(originalName);

        // const sourceType = (path.extname(uploadName).toLowerCase() === '.svg' || path.extname(uploadName).toLowerCase() === '.dxf') ? 'svg' : 'raster';
        let { width, height } = sizeModelByMachineSize(size, sourceWidth / 8, sourceHeight / 8);
        if (sourceType === 'text') {
            const textSize = computeTransformationSizeForTextVector(
                DEFAULT_TEXT_CONFIG.text, DEFAULT_TEXT_CONFIG.size, DEFAULT_TEXT_CONFIG.lineHeight, {
                    width: sourceWidth,
                    height: sourceHeight
                }
            );
            width = textSize.width;
            height = textSize.height;
        }
        // Generate geometry

        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode);

        if (!checkParams(headType, sourceType, mode)) {
            console.error(`sourceType or mode error, sourceType:${sourceType}, mode:${mode}`);
            return;
        }

        const defaultConfig = modelDefaultConfigs.config;
        const defaultGcodeConfig = headType === 'cnc'
            ? {
                ...modelDefaultConfigs.gcodeConfig,
                toolDiameter: toolParams.toolDiameter,
                toolAngle: toolParams.toolAngle
            }
            : modelDefaultConfigs.gcodeConfig;
        const defaultTransformation = `${headType}-${sourceType}-${mode}` === 'cnc-raster-greyscale'
            ? {
                width: 40,
                height: 40 * height / width
            } : {
                width: width,
                height: height
            };
        config = {
            ...defaultConfig,
            ...config
        };
        gcodeConfig = {
            ...defaultGcodeConfig,
            ...gcodeConfig
        };
        transformation = {
            ...defaultTransformation,
            ...transformation
        };

        const modelID = getCount();
        const options = {
            modelID,
            limitSize: size,
            headType,
            sourceType,
            mode,
            originalName,
            uploadName,
            sourceWidth,
            width,
            sourceHeight,
            height,
            transformation,
            config,
            gcodeConfig
        };
        const model = modelGroup.addModel(options);
        svgModelGroup.createFromModel(model);


        // console.log(options, 'before processImage');
        // api.processImage(options)
        //     .then((res) => {
        //         options.processImageName = res.body.filename;
        //         console.log(options, 'after processImage');
        //         dispatch(svgModelActions.generateSvgModel(headType, options));
        //         // dispatch(threejsModelActions.generateThreejsModel(headType, options));

        //         // dispatch(baseActions.resetCalculatedState(headType));
        //         // dispatch(baseActions.updateState(headType, {
        //         //     hasModel: true
        //         // }));

        //         // dispatch(baseActions.render(headType));
        //     })
        //     .catch((err) => {
        //         console.error(err);
        //     });
    },

    insertDefaultTextVector: (headType) => (dispatch) => {
        api.convertTextToSvg({
            ...DEFAULT_TEXT_CONFIG
        })
            .then(async (res) => {
                // const { name, filename, width, height } = res.body;
                const { originalName, uploadName, width, height } = res.body;
                const sourceType = 'text';
                const mode = 'vector';

                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, sourceType));
            });
    },

    // TODO: Check usage of this method
    // selectModel: (headType, model) => (dispatch, getState) => {
    //     const { modelGroup } = getState()[headType];
    //     const find = modelGroup.getModels().find(v => v.meshObject === model);
    //     dispatch(actions.selectModelByID(headType, find.modelID));
    // },

    // TODO: rename to selectModel(headType, model, isMultiSelect = true)
    // TODO: method docs
    selectTargetModel: (model, headType, shiftKey) => (dispatch, getState) => {
        // console.log('----bug select----', model, headType, shiftKey, dispatch, getState);
        const { modelGroup } = getState()[headType];
        if (!shiftKey) {
            // remove all selected model
            modelGroup.emptySelectedModelArray();
            dispatch(svgModelActions.emptySelectedModelArray(headType));
        }
        dispatch(svgModelActions.addSelectedSvgModels(headType, [model]));
        // todo, donot reset here
        dispatch(svgModelActions.resetSelection(headType));

        // todo multi select toopath model
        dispatch(threejsModelActions.selectModel(headType, model));
    },

    // TODO: Check usage of this method
    selectModelByID: (headType, modelID) => (dispatch) => {
        dispatch(svgModelActions.selectModel(headType, modelID));
        dispatch(threejsModelActions.selectModel(headType, modelID));
    },

    unselectAllModels: (headType) => (dispatch) => {
        dispatch(svgModelActions.selectModel(headType, null));
        dispatch(threejsModelActions.selectModel(headType, null));
    },

    changeSelectedModelMode: (headType, sourceType, mode) => async (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup } = getState()[headType];
        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode);

        const { config } = modelDefaultConfigs;

        const selectedModel = modelGroup.getSelectedModel();
        const options = {
            headType: headType,
            uploadName: selectedModel.uploadName,
            sourceType: sourceType,
            mode: mode,
            transformation: {
                width: selectedModel.transformation.width,
                height: selectedModel.transformation.height,
                rotationZ: 0,
                flip: selectedModel.transformation.flip
            },
            config: {
                ...config,
                ...selectedModel.getModeConfig(mode)
            }
        };


        api.processImage(options)
            .then((res) => {
                const processImageName = res.body.filename;
                if (!processImageName) {
                    return;
                }

                svgModelGroup.updateElementImage(processImageName);

                const modelState = modelGroup.updateSelectedMode(mode, config, processImageName);

                let { gcodeConfig } = modelDefaultConfigs;
                if (headType === 'cnc') {
                    const { toolDiameter, toolAngle } = getState().cnc.toolParams;
                    gcodeConfig = {
                        ...gcodeConfig,
                        toolDiameter,
                        toolAngle
                    };
                }
                const toolPathModelState = toolPathModelGroup.updateSelectedMode(mode, gcodeConfig);

                dispatch(baseActions.updateState(headType, {
                    ...modelState,
                    ...toolPathModelState
                }));
                // dispatch(baseActions.recordSnapshot(headType));
                dispatch(baseActions.render(headType));
            });
    },

    changeSelectedModelShowOrigin: (headType) => (dispatch, getState) => {
        const { svgModelGroup, modelGroup } = getState()[headType];
        const res = modelGroup.changeShowOrigin();
        svgModelGroup.updateElementImage(res.showImageName);

        dispatch(baseActions.updateState(headType, {
            showOrigin: res.showOrigin,
            renderingTimestamp: +new Date()
        }));
    },

    updateSelectedModelFlip: (headType, transformation) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup } = getState()[headType];
        const selectedModel = modelGroup.getSelectedModel();
        const options = {
            headType: headType,
            uploadName: selectedModel.uploadName,
            sourceType: selectedModel.sourceType,
            mode: selectedModel.mode,
            transformation: {
                width: selectedModel.transformation.width,
                height: selectedModel.transformation.height,
                rotationZ: 0,
                flip: transformation.flip
            },
            config: selectedModel.config
        };

        dispatch(svgModelActions.updateSelectedTransformation(headType, transformation));

        api.processImage(options)
            .then((res) => {
                const processImageName = res.body.filename;
                if (!processImageName) {
                    return;
                }
                svgModelGroup.updateElementImage(processImageName);
                dispatch(threejsModelActions.updateSelectedModelTransformation(headType, transformation));
            });
    },
    // updateSelectedModelUniformScalingState: (headType, transformation) => (dispatch) => {
    // dispatch(threejsModelActions.updateSelectedModelTransformation(headType, transformation));
    // dispatch(svgModelActions.updateSelectedTransformation(headType, transformation));
    // },

    updateSelectedModelConfig: (headType, config) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup } = getState()[headType];

        const selectedModel = modelGroup.getSelectedModel();
        const options = {
            headType: headType,
            uploadName: selectedModel.uploadName,
            sourceType: selectedModel.sourceType,
            mode: selectedModel.mode,
            transformation: {
                width: selectedModel.transformation.width,
                height: selectedModel.transformation.height,
                rotationZ: 0,
                flip: selectedModel.transformation.flip
            },
            config: {
                ...selectedModel.config,
                ...config
            }
        };

        api.processImage(options)
            .then((res) => {
                const processImageName = res.body.filename;
                if (!processImageName) {
                    return;
                }
                svgModelGroup.updateElementImage(processImageName);
                modelGroup.updateSelectedConfig(config, processImageName);
                toolPathModelGroup.updateSelectedNeedPreview(true);
                dispatch(baseActions.updateConfig(headType, config));
                // dispatch(baseActions.recordSnapshot(headType));
                dispatch(baseActions.resetCalculatedState(headType));
            });
    },

    updateSelectedModelTransformation: (headType, transformation, changeFrom) => (dispatch) => {
        // todo
        // dispatch(threejsModelActions.updateSelectedModelTransformation(headType, transformation, changeFrom));
        // todo
        dispatch(svgModelActions.updateSelectedTransformation(headType, transformation, changeFrom));
    },

    duplicateSelectedModel: (headType) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];

        const modelID = getCount();
        svgModelGroup.duplicateElement(modelID);
    },

    onFlipSelectedModel: (headType, flipStr) => (dispatch, getState) => {
        const model = getState()[headType].modelGroup.getSelectedModel();
        let { scaleX, scaleY } = model.transformation;

        switch (flipStr) {
            case 'Vertical':
                scaleY *= -1;
                break;
            case 'Horizontal':
                scaleX *= -1;
                break;
            case 'Reset':
                scaleX = Math.abs(scaleX);
                scaleY = Math.abs(scaleY);
                break;
            default:
        }
        if (model.modelID) {
            model.updateAndRefresh({
                transformation: {
                    scaleX,
                    scaleY
                }
            });
        }


        // const flip = transformation.flip;
        // const svgflip = 0;

        // transformation.flip = flip;
        // transformation.svgflip = svgflip;
        // dispatch(actions.updateSelectedModelFlip(headType, transformation));
        // dispatch(svgModelActions.updateSelectedTransformation(headType, transformation));
    },

    removeSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup } = getState()[headType];
        svgModelGroup.deleteElement();
        const modelState = modelGroup.removeSelectedModel();
        const toolPathModelState = toolPathModelGroup.removeSelectedToolPathModel();

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));
        if (!modelState.hasModel) {
            dispatch(baseActions.updateState(headType, {
                stage: 0,
                progress: 0
            }));
        }
        // dispatch(actions.recordSnapshot(headType));
        dispatch(baseActions.render(headType));
    },

    onSetSelectedModelPosition: (headType, position) => (dispatch, getState) => {
        // const { model } = getState()[headType];
        // const transformation = model.modelInfo.transformation;
        const model = getState()[headType].modelGroup.getSelectedModel();
        if (!model) return;

        const { transformation } = model;
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
        model.updateAndRefresh({ transformation });
        // dispatch(actions.updateSelectedModelTransformation(headType, transformation));
        // dispatch(actions.onModelAfterTransform(headType));
    },

    onModelTransform: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, transformationUpdateTime } = getState()[headType];

        const modelState = modelGroup.onModelTransform();
        toolPathModelGroup.updateSelectedNeedPreview(true);
        dispatch(actions.changeModelVisualizer(headType, modelState.modelID, false));
        if (new Date().getTime() - transformationUpdateTime > 50) {
            dispatch(baseActions.updateTransformation(headType, modelState.transformation));
        }
    },

    onModelAfterTransform: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        if (modelGroup) {
            const modelState = modelGroup.onModelAfterTransform();

            if (modelState) {
                dispatch(svgModelActions.updateSelectedTransformation(headType, modelState.transformation));
                dispatch(baseActions.updateState(headType, { modelState }));
                dispatch(baseActions.updateTransformation(headType, modelState.transformation));
                dispatch(actions.previewModel(headType));
                // dispatch(actions.recordSnapshot(headType));
            }
        }
    },

    updateSelectedModelTextConfig: (headType, newConfig) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup, config } = getState()[headType];
        newConfig = {
            ...config,
            ...newConfig
        };
        api.convertTextToSvg(newConfig)
            .then(async (res) => {
                const { originalName, uploadName, width, height } = res.body;

                const selectedModel = modelGroup.getSelectedModel();

                const textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, newConfig.lineHeight, {
                    width,
                    height
                });
                const source = {
                    originalName,
                    uploadName,
                    sourceHeight: height,
                    width: textSize.width,
                    sourceWidth: width,
                    height: textSize.height
                };
                const transformation = {
                    width: selectedModel.transformation.width / selectedModel.width * textSize.width,
                    height: selectedModel.transformation.height / selectedModel.height * textSize.height
                };

                svgModelGroup.updateElementImage(uploadName);
                svgModelGroup.updateTransformation(transformation);
                modelGroup.updateSelectedSource(source);
                modelGroup.updateSelectedModelTransformation(transformation);
                modelGroup.updateSelectedConfig(newConfig);
                toolPathModelGroup.updateSelectedNeedPreview(true);

                // dispatch(actions.showModelObj3D(headType));
                dispatch(baseActions.updateConfig(headType, newConfig));
                dispatch(baseActions.updateTransformation(headType, {
                    ...textSize
                }));
                dispatch(baseActions.resetCalculatedState(headType));
                // dispatch(baseActions.recordSnapshot(headType));
                dispatch(baseActions.render(headType));
            });
    },

    previewModel: (headType, isProcess) => (dispatch, getState) => {
        const { page, modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[headType];
        if (page === PAGE_EDITOR) {
            return;
        }
        if (isProcess || autoPreviewEnabled) {
            const modelState = modelGroup.getSelectedModel()
                .getTaskInfo();
            if (modelState) {
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelState.modelID);
                if (toolPathModelTaskInfo && toolPathModelTaskInfo.needPreview && toolPathModelTaskInfo.visible) {
                    const taskInfo = {
                        ...modelState,
                        ...toolPathModelTaskInfo
                    };
                    controller.commitToolPathTask({
                        taskId: taskInfo.modelID,
                        headType: headType,
                        data: taskInfo
                    });
                    dispatch(baseActions.updateState(headType, {
                        stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
                        progress: 0
                    }));
                }
            }
        }
    },

    manualPreview: (headType, isProcess) => async (dispatch, getState) => {
        const { page, modelGroup, autoPreviewEnabled } = getState()[headType];

        if (page === PAGE_EDITOR) {
            return;
        }
        if (isProcess || autoPreviewEnabled) {
            for (const model of modelGroup.getModels()) {
                await model.preview();
            }
        }
    },

    changeModelVisualizer: (headType, modelID, isProcess) => (dispatch, getState) => {
        const { page, modelGroup, toolPathModelGroup } = getState()[headType];
        if (page === PAGE_PROCESS) {
            const model = modelGroup.getModel(modelID);
            const toolPathModel = toolPathModelGroup.getToolPathModel(modelID);
            if (isProcess) {
                model.updateVisible(false);
                toolPathModel.updateVisible(true);
            } else {
                model.updateVisible(true);
                toolPathModel.updateVisible(false);
            }
        }
    },

    setAutoPreview: (headType, value) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            autoPreviewEnabled: value
        }));
        dispatch(actions.manualPreview(headType));
    },

    initSelectedModelListener: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];

        // modelGroup.addEventListener('update', () => {
        modelGroup.object.addEventListener('update', () => {
            dispatch(baseActions.render(headType));
        });
    },

    initModelsPreviewChecker: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, isAllModelsPreviewed } = getState()[headType];
        const check = () => {
            const isAllModelsPreviewedN = checkIsAllModelsPreviewed(modelGroup, toolPathModelGroup);
            if (isAllModelsPreviewedN !== isAllModelsPreviewed) {
                dispatch(baseActions.updateState(headType, { isAllModelsPreviewed: isAllModelsPreviewedN }));
            }
            setTimeout(check, 200);
        };
        check();
    },

    showAllModelsObj3D: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.showAllModelsObj3D();
        toolPathModelGroup.hideAllToolPathModelsObj3D();
    },

    onReceiveTaskResult: (headType, taskResult) => async (dispatch, getState) => {
        // const state = getState()[headType];
        const { toolPathModelGroup } = getState()[headType];

        const { data, filename } = taskResult;

        if (taskResult.taskStatus === 'failed' && toolPathModelGroup.getToolPathModelByID(data.id)) {
            dispatch(baseActions.updateState(headType, {
                previewFailed: true,
                stage: CNC_LASER_STAGE.GENERATE_TOOLPATH_FAILED,
                progress: 1
            }));
            dispatch(actions.setAutoPreview(headType, false));
            return;
        }

        dispatch(baseActions.updateState({
            stage: CNC_LASER_STAGE.PREVIEWING,
            progress: 0
        }));

        const toolPathModelState = await toolPathModelGroup.receiveTaskResult(data, filename);

        if (toolPathModelState) {
            dispatch(actions.changeModelVisualizer(headType, toolPathModelState.modelID, true));
            // dispatch(actions.togglePage(headType, PAGE_PROCESS));
            dispatch(baseActions.updateState(headType, {
                previewFailed: false,
                stage: CNC_LASER_STAGE.PREVIEW_SUCCESS,
                progress: 1
            }));
            dispatch(baseActions.render(headType));
        } else {
            dispatch(baseActions.updateState(headType, {
                previewFailed: false,
                stage: CNC_LASER_STAGE.RE_PREVIEW,
                progress: 1
            }));
            dispatch(baseActions.render(headType));
        }
    },

    updateSelectedModelPrintOrder: (headType, printOrder) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[headType];
        toolPathModelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(baseActions.updateState(headType, { printOrder }));
        dispatch(baseActions.resetCalculatedState(headType));
    },

    updateSelectedModelGcodeConfig: (headType, gcodeConfig) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[headType];
        toolPathModelGroup.updateSelectedGcodeConfig(gcodeConfig);
        dispatch(baseActions.updateGcodeConfig(headType, gcodeConfig));
        dispatch(actions.previewModel(headType));
        dispatch(baseActions.resetCalculatedState(headType));
    },

    updateAllModelGcodeConfig: (headType, gcodeConfig) => (dispatch, getState) => {
        // const { modelGroup, model } = getState()[headType];
        const { toolPathModelGroup, selectedModelID } = getState()[headType];
        toolPathModelGroup.updateAllModelGcodeConfig(gcodeConfig);
        dispatch(actions.manualPreview(headType));
        if (selectedModelID) {
            dispatch(baseActions.updateGcodeConfig(headType, gcodeConfig));
            dispatch(baseActions.resetCalculatedState(headType));
            dispatch(baseActions.render(headType));
        }
    },

    /**
     * Callback function trigger by event when G-code generated.
     *
     * @param headType
     * @param taskResult
     * @returns {Function}
     */
    onReceiveGcodeTaskResult: (headType, taskResult) => async (dispatch) => {
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
                lastModifiedDate: gcodeFile.lastModifiedDate,
                thumbnail: gcodeFile.thumbnail
            },
            stage: CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS,
            progress: 1
        }));
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

    togglePage: (headType, page) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        dispatch(baseActions.updateState(headType, {
            page: page
        }));
        if (page === PAGE_EDITOR) {
            modelGroup.showAllModelsObj3D();
            toolPathModelGroup.hideAllToolPathModelsObj3D();
        } else {
            toolPathModelGroup.showAllToolPathModelsObj3D();
            for (const model of modelGroup.getModels()) {
                const toolPath = toolPathModelGroup.getToolPathModel(model.modelID);
                // if (toolPath.needPreview) {
                toolPath.updateVisible(false);
                model.updateVisible(true);
                // } else {
                // toolPath.updateVisible(true);
                // model.updateVisible(false);
                // }
            }
            dispatch(actions.manualPreview(headType));
        }
        dispatch(baseActions.render(headType));
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
            if (!model.visible) continue;
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
        const orderModelInfos = modelInfos.map(d => d)
            .sort((d1, d2) => {
                if (d1.printOrder > d2.printOrder) {
                    return 1;
                } else if (d1.printOrder < d2.printOrder) {
                    return -1;
                } else {
                    return 1;
                }
            });
        dispatch(baseActions.updateState(
            headType, {
                isGcodeGenerating: true
            }
        ));
        orderModelInfos[0].thumbnail = thumbnail;
        controller.commitGcodeTask({
            taskId: uuid.v4(),
            headType: headType,
            data: orderModelInfos
        });
        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.GENERATING_GCODE,
            progress: 0
        }));
    },

    bringSelectedModelToFront: (headType) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup } = getState()[headType];
        svgModelGroup.bringElementToFront();
        modelGroup.bringSelectedModelToFront();
    },

    sendSelectedModelToBack: (headType) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup } = getState()[headType];
        svgModelGroup.sendElementToBack();
        modelGroup.sendSelectedModelToBack();
    },

    arrangeAllModels2D: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.arrangeAllModels2D();
        const modelState = modelGroup.onModelTransform();
        toolPathModelGroup.updateAllNeedPreview(true);

        dispatch(actions.showAllModelsObj3D(headType));
        dispatch(baseActions.updateTransformation(headType, modelState.transformation));
        dispatch(actions.manualPreview(headType));
        dispatch(actions.recordSnapshot(headType));
        dispatch(baseActions.render(headType));
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

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            ...toolPathModelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(actions.manualPreview(headType));
        dispatch(baseActions.render(headType));
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

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            ...toolPathModelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(actions.manualPreview(headType));
        dispatch(baseActions.render(headType));
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
        dispatch(baseActions.updateState(headType, {
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
    },

    hideSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.hideSelectedModel();
        toolPathModelGroup.hideSelectedModel();
        svgModelGroup.hideSelectedElement();
        dispatch(baseActions.render(headType));
    },

    showSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.showSelectedModel();
        toolPathModelGroup.showSelectedModel();
        svgModelGroup.showSelectedElement();
        // svgModelGroup.updateTransformation(modelGroup.getSelectedModel().transformation);
        dispatch(baseActions.render(headType));
    }
};

export default function reducer() {
    return {};
}
