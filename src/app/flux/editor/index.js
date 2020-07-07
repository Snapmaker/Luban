
import path from 'path';
import uuid from 'uuid';


import { checkParams, DEFAULT_TEXT_CONFIG, generateModelDefaultConfigs, sizeModelByMachineSize } from '../models/ModelInfoUtils';
import { threejsModelActions } from './threejs-model';
import { svgModelActions } from './svg-model';
import { baseActions, checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './base';
import { SVG_EVENT_ADD, SVG_EVENT_MOVE, SVG_EVENT_SELECT } from '../../constants/svg-constatns';
import { PAGE_EDITOR, PAGE_PROCESS, HEAD_CNC, HEAD_LASER, HEAD_3DP } from '../../constants';
import { controller } from '../../lib/controller';


import api from '../../api';
import { actions as printingActions } from '../printing';


const INITIAL_STATE = {
    [HEAD_3DP]: {
        findLastEnviroment: false
    },
    [HEAD_CNC]: {
        findLastEnviroment: false
    },
    [HEAD_LASER]: {
        findLastEnviroment: false
    }
};
const ACTION_UPDATE_STATE = 'EDITOR_ACTION_UPDATE_STATE';

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

    init: (headType) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];
        svgModelGroup.on(SVG_EVENT_ADD, (data) => {
            const { size } = getState().machine;
            const { modelID, content, width, height, transformation } = data;
            const blob = new Blob([content], { type: 'image/svg+xml' });
            const file = new File([blob], `${modelID}.svg`);

            const formData = new FormData();
            formData.append('image', file);

            api.uploadImage(formData)
                .then((res) => {
                    const { originalName, uploadName } = res.body;
                    const sourceType = 'svg';
                    const mode = 'vector';

                    const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode);

                    const options = {
                        modelID,
                        limitSize: size,
                        headType,
                        sourceType,
                        mode,
                        originalName,
                        uploadName,
                        sourceWidth: res.body.width,
                        width,
                        sourceHeight: res.body.height,
                        height,
                        transformation,
                        config: modelDefaultConfigs.config,
                        gcodeConfig: modelDefaultConfigs.gcodeConfig
                    };
                    dispatch(threejsModelActions.generateThreejsModel(headType, options));
                })
                .catch((err) => {
                    console.error(err);
                });
        });

        svgModelGroup.on(SVG_EVENT_MOVE, (data) => {
            const { transformation } = data;
            dispatch(threejsModelActions.updateSelectedModelTransformation(headType, transformation));
        });

        svgModelGroup.on(SVG_EVENT_SELECT, (data) => {
            const { modelID } = data;
            dispatch(threejsModelActions.selectModel(headType, modelID));
        });
    },
    initRecoverService: () => (dispatch) => {
        const startService = (envHeadType) => {
            dispatch(actions.getLastEnviroment(envHeadType));
            const action = actions.autoSaveEnviroment(envHeadType);
            setInterval(() => dispatch(action), 1000);
        };

        startService(HEAD_LASER);
        startService(HEAD_CNC);
        startService(HEAD_3DP);
    },
    uploadImage: (headType, file, mode, onError) => (dispatch) => {
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

    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight,
        mode, sourceType, config, gcodeConfig, transformation) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { toolParams } = getState()[headType];

        sourceType = sourceType || getSourceType(originalName);

        // const sourceType = (path.extname(uploadName).toLowerCase() === '.svg' || path.extname(uploadName).toLowerCase() === '.dxf') ? 'svg' : 'raster';
        let { width, height } = sizeModelByMachineSize(size, sourceWidth, sourceHeight);
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


        api.processImage(options)
            .then((res) => {
                options.processImageName = res.body.filename;

                dispatch(svgModelActions.generateSvgModel(headType, options));
                dispatch(threejsModelActions.generateThreejsModel(headType, options));

                dispatch(baseActions.resetCalculatedState(headType));
                dispatch(baseActions.updateState(headType, {
                    hasModel: true
                }));

                dispatch(baseActions.render(headType));
            })
            .catch((err) => {
                console.error(err);
            });
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

    selectModel: (headType, model) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        const find = modelGroup.getModels().find(v => v.meshObject === model);
        dispatch(actions.selectModelByID(headType, find.modelID));
    },

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
        dispatch(threejsModelActions.updateSelectedModelTransformation(headType, transformation, changeFrom));
        dispatch(svgModelActions.updateSelectedTransformation(headType, transformation));
    },

    duplicateSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, svgModelGroup, toolPathModelGroup } = getState()[headType];

        const modelID = getCount();
        svgModelGroup.duplicateElement(modelID);

        modelGroup.duplicateSelectedModel(modelID);
        toolPathModelGroup.duplicateSelectedModel(modelID);

        // dispatch(actions.recordSnapshot(headType));
        dispatch(actions.manualPreview(headType));
        dispatch(baseActions.render(headType));
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
        dispatch(actions.updateSelectedModelFlip(headType, transformation));
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
                if (toolPathModelTaskInfo && toolPathModelTaskInfo.needPreview && !toolPathModelTaskInfo.hideFlag) {
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

    manualPreview: (headType, isProcess) => (dispatch, getState) => {
        const { page, modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[headType];
        if (page === PAGE_EDITOR) {
            return;
        }
        if (isProcess || autoPreviewEnabled) {
            for (const model of modelGroup.getModels()) {
                const modelTaskInfo = model.getTaskInfo();
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
                if (toolPathModelTaskInfo && toolPathModelTaskInfo.needPreview && !toolPathModelTaskInfo.hideFlag) {
                    const taskInfo = {
                        ...modelTaskInfo,
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
            if (model.hideFlag) continue;
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
    updateState: (headType, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            headType,
            state
        };
    },

    autoSaveEnviroment: (headType) => {
        let lastString = false;

        return async (dispatch, getState) => {
            let fluxMod = headType;
            if (headType === HEAD_3DP) fluxMod = 'printing';
            const state = getState()[fluxMod];

            const models = state.modelGroup.getModels();
            if (!models.length) return;

            const { defaultMaterialId, defaultQualityId } = state;
            const envObj = { headType, defaultMaterialId, defaultQualityId, models: [] };
            for (let key = 0; key < models.length; key++) {
                const model = models[key];
                envObj.models.push(model.getSerializableConfig());
            }
            const content = JSON.stringify(envObj);

            if (content !== lastString) {
                await api.saveEnv({ content });
                lastString = content;
            }
        };
    },

    getLastEnviroment: (headType) => async (dispatch) => {
        const { body: { content } } = await api.getEnv({ headType });
        content && dispatch(actions.updateState(headType, { findLastEnviroment: true, content }));
    },
    clearSavedEnvironment: (headType) => async (dispatch) => {
        await api.removeEnv({ headType });
        dispatch(actions.updateState(headType, { findLastEnviroment: false, envText: undefined }));
    },
    onRecovery: (envHeadType) => async (dispatch, getState) => {
        const { content } = getState().editor[envHeadType];
        await api.recoverEnv({ content });
        const envObj = JSON.parse(content);
        let modActions = null;
        if (envHeadType === HEAD_CNC || envHeadType === HEAD_LASER) {
            modActions = actions;
        }
        if (envHeadType === HEAD_3DP) {
            modActions = printingActions;
        }
        const { models, ...restState } = envObj;
        for (let k = 0; k < models.length; k++) {
            const { headType, originalName, uploadName, config, sourceType, gcodeConfig, sourceWidth, sourceHeight, mode, transformation } = models[k];
            dispatch(modActions.generateModel(headType, originalName, uploadName, sourceWidth, sourceHeight, mode,
                sourceType, config, gcodeConfig, transformation));
        }
        dispatch(modActions.updateState(restState));

        dispatch(actions.clearSavedEnvironment(envHeadType));
    },
    quitRecovery: (headType) => async (dispatch) => {
        dispatch(actions.clearSavedEnvironment(headType));
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
        svgModelGroup.updateTransformation(modelGroup.getSelectedModel().transformation);
        dispatch(baseActions.render(headType));
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
