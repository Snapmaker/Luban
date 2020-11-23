import path from 'path';
import uuid from 'uuid';
import api from '../../api';
import {
    checkParams,
    DEFAULT_TEXT_CONFIG,
    generateModelDefaultConfigs,
    sizeModelByMachineSize
} from '../../models/ModelInfoUtils';

import { baseActions, checkIsAllModelsPreviewed } from './base';
import { PAGE_PROCESS, SOURCE_TYPE_IMAGE3D } from '../../constants';

import { controller } from '../../lib/controller';
import { DEFAULT_SCALE } from '../../ui/SVGEditor/constants';
import { round } from '../../../shared/lib/utils';
import { machineStore } from '../../store/local-storage';

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
    } else if (extname === '.stl') {
        sourceType = 'image3d';
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
    GENERATE_GCODE_FAILED: 10,
    UPLOADING_IMAGE: 11,
    UPLOAD_IMAGE_SUCCESS: 12,
    UPLOAD_IMAGE_FAILED: 13,
    PROCESSING_IMAGE: 14,
    PROCESS_IMAGE_SUCCESS: 15,
    PROCESS_IMAGE_FAILED: 16,
    GENERATING_VIEWPATH: 17,
    GENERATE_VIEWPATH_SUCCESS: 18,
    GENERATE_VIEWPATH_FAILED: 19
};

export const actions = {

    ...baseActions,

    init: (headType) => (dispatch) => {
        const materials = machineStore.get(`${headType}.materials`);
        if (materials) {
            dispatch(actions.updateMaterials(headType, materials));
        }
    },

    onSizeUpdated: (headType, size) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.updateSize(size);
    },

    /**
     * Save content group in state.
     */
    initContentGroup: (headType, svgContentGroup) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        dispatch(baseActions.updateState(headType, { contentGroup: svgContentGroup }));

        SVGActions.init(svgContentGroup);
    },

    /**
     * Clear background image from editor.
     */
    clearBackgroundImage: (headType) => (dispatch, getState) => {
        const { contentGroup } = getState()[headType];

        const backgroundGroup = contentGroup.backgroundGroup;
        while (backgroundGroup.firstChild) {
            backgroundGroup.removeChild(backgroundGroup.lastChild);
        }
    },

    /**
     * Generate Mold
     *
     * @param {Object} options - of { originalName, uploadName, width, height }
     * @returns {Function}
     */

    // TODO: continue refactoring afterwards
    /*
    generateMoldFromImage: (headType, options) => (dispatch, getState) => {
        let { sourceType = null } = options; // svg, dxf, raster

        sourceType = sourceType || getSourceType(sourceType);
    },
    */

    /**
     * Upload image in editor, or drag image into editor to upload.
     *
     * 1. Upload image to backend
     * 2. Create Mold from image information
     */
    uploadImage: (headType, file, mode, onError) => (dispatch, getState) => {
        dispatch(actions.updateState(headType, {
            stage: CNC_LASER_STAGE.UPLOADING_IMAGE,
            progress: 0.25
        }));
        const { materials } = getState()[headType];
        const formData = new FormData();
        formData.append('image', file);
        formData.append('isRotate', materials.isRotate);


        api.uploadImage(formData)
            .then((res) => {
                dispatch(actions.updateState(headType, {
                    stage: CNC_LASER_STAGE.UPLOAD_IMAGE_SUCCESS,
                    progress: 1
                }));
                const { width, height, originalName, uploadName } = res.body;
                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, undefined, { svgNodeName: 'image' }));
                // dispatch(actions.generateMoldFromImage(headType, { originalName, uploadName, width, height }));
            })
            .catch((err) => {
                onError && onError(err);
                dispatch(actions.updateState(headType, {
                    stage: CNC_LASER_STAGE.UPLOAD_IMAGE_FAILED,
                    progress: 1
                }));
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
                dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, null, { svgNodeName: 'image', ...config }, gcodeConfig, caseTransformation));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },

    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, config, gcodeConfig, transformation) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { materials, toolParams, modelGroup, SVGActions } = getState()[headType];

        sourceType = sourceType || getSourceType(originalName);

        // const sourceType = (path.extname(uploadName).toLowerCase() === '.svg' || path.extname(uploadName).toLowerCase() === '.dxf') ? 'svg' : 'raster';
        let { width, height } = sizeModelByMachineSize(size, sourceWidth / DEFAULT_SCALE, sourceHeight / DEFAULT_SCALE);
        // Generate geometry

        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode, materials.isRotate);

        if (!checkParams(headType, sourceType, mode)) {
            console.error(`sourceType or mode error, sourceType:${sourceType}, mode:${mode}`);
            return;
        }

        const defaultConfig = modelDefaultConfigs.config;
        const defaultGcodeConfig = headType === 'cnc'
            ? {
                ...modelDefaultConfigs.gcodeConfig,
                toolDiameter: toolParams.toolDiameter,
                toolAngle: toolParams.toolAngle,
                toolShaftDiameter: toolParams.toolShaftDiameter
            }
            : modelDefaultConfigs.gcodeConfig;
        // cnc size limit
        if (`${headType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            width = 40;
            height = 40 * sourceHeight / sourceWidth;
        }
        const defaultTransformation = {
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
        // make caseConfigs's width as really width
        if (transformation.width) {
            width = transformation.width;
        }
        if (transformation.height) {
            height = transformation.height;
        }

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
            gcodeConfig,
            isRotate: materials.isRotate
        };

        const model = modelGroup.addModel(options);
        SVGActions.createFromModel(model);
        SVGActions.clearSelection();
        SVGActions.addSelectedSvgModelsByModels([model]);

        // Process image right after created
        dispatch(actions.showAllModelsObj3D(headType));
        dispatch(actions.processSelectedModel(headType));
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

    // TODO: method docs
    selectTargetModel: (model, headType, isMultiSelect = false) => (dispatch, getState) => {
        const { SVGActions, toolPathModelGroup } = getState()[headType];
        if (!isMultiSelect) {
            // remove all selected model
            dispatch(actions.clearSelection(headType));
        }

        SVGActions.addSelectedSvgModelsByModels([model]);

        // todo, donot reset here
        SVGActions.resetSelection();

        // todo, multi select tool path model and `modelGroup.state` is undefined
        const toolPathModelState = toolPathModelGroup.selectToolPathModel(model.modelID);
        dispatch(baseActions.updateState(headType, toolPathModelState));
    },

    // todo, select model by toolPathModel ??? meshObject ???
    selectModelInProcess: (headType, intersect) => (dispatch, getState) => {
        const { SVGActions, modelGroup, toolPathModelGroup } = getState()[headType];

        dispatch(actions.clearSelection(headType));

        if (intersect) {
            const model = modelGroup.getSelectedModelByIntersect(intersect);

            if (model) {
                SVGActions.addSelectedSvgModelsByModels([model]);

                toolPathModelGroup.selectToolPathModel(model.modelID);
                const toolPathModelState = toolPathModelGroup.selectToolPathModel(model.modelID);
                dispatch(baseActions.updateState(headType, toolPathModelState));
                dispatch(baseActions.render(headType));
            }
        } else {
            toolPathModelGroup.selectToolPathModel();
        }
    },

    changeSelectedModelMode: (headType, sourceType, mode) => async (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, materials } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }

        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode, materials.isRotate);

        const selectedModel = selectedModels[0];

        // Set or replace image config
        const config = {
            ...modelDefaultConfigs.config,
            ...selectedModel.getModeConfig(mode)
        };
        modelGroup.updateSelectedMode(mode, config);

        // Set or replace G-code config of new mode
        let { gcodeConfig } = modelDefaultConfigs;
        if (headType === 'cnc') {
            const { toolDiameter, toolAngle, toolShaftDiameter } = getState().cnc.toolParams;
            gcodeConfig = {
                ...gcodeConfig,
                toolDiameter,
                toolAngle,
                toolShaftDiameter
            };
        }
        const toolPathModelState = toolPathModelGroup.updateSelectedMode(mode, gcodeConfig);
        dispatch(baseActions.updateState(headType, {
            // ...modelState,
            ...toolPathModelState
        }));

        dispatch(actions.processSelectedModel(headType));
    },

    changeSelectedModelShowOrigin: (headType) => (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const res = modelGroup.changeShowOrigin();
        SVGActions.updateElementImage(res.showImageName);

        dispatch(baseActions.updateState(headType, {
            showOrigin: res.showOrigin,
            renderingTimestamp: +new Date()
        }));
    },

    /**
     *
     * @param headType
     * @param transformation
     *        - positionX
     *        - positionY
     *        - positionZ?
     *        - scaleX
     *        - scaleY
     *        - rotateZ
     *        - width
     *        - height
     *        - uniformScalingState
     * @returns {Function}
     */
    updateSelectedModelTransformation: (headType, transformation) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions.updateSelectedElementsTransformation(transformation);

        // note that reprocess model only after resize and flip
        if (transformation.scaleX || transformation.scaleY) {
            dispatch(actions.processSelectedModel(headType));
        }
        dispatch(actions.resetProcessState(headType));
    },

    updateSelectedModelConfig: (headType, config) => (dispatch, getState) => {
        const { modelGroup, materials } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }

        const selectedModel = selectedModels[0];

        const modelDefaultConfigs = generateModelDefaultConfigs(headType, selectedModel.sourceType, selectedModel.mode, materials.isRotate);
        const newConfig = {
            ...modelDefaultConfigs.config,
            ...selectedModel.config,
            ...config
        };

        modelGroup.updateSelectedConfig(newConfig);
        dispatch(actions.showAllModelsObj3D(headType));
    },

    // TODO: temporary workaround for model image processing
    processSelectedModel: (headType) => (dispatch, getState) => {
        const { materials, modelGroup } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }

        const selectedModel = selectedModels[0];
        if (selectedModel.sourceType !== 'raster' && selectedModel.sourceType !== 'image3d' && selectedModel.config.svgNodeName !== 'text' && selectedModel.sourceType !== 'dxf') {
            return;
        }

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
                ...selectedModel.config
            },
            materials: materials
        };
        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.PROCESSING_IMAGE,
            progress: 0
        }));

        controller.commitProcessImage({
            taskId: uuid.v4(),
            headType: headType,
            data: options
        });
        // =======
        //         api.processImage(options)
        //             .then((res) => {
        //                 const processImageName = res.body.filename;
        //                 if (!processImageName) {
        //                     return;
        //                 }
        //
        //                 const svgModel = selectedModel.relatedModels.svgModel;
        //
        //                 if (selectedModel.sourceType === 'image3d') {
        //                     const modelOptions = {
        //                         sourceWidth: res.body.width * DEFAULT_SCALE,
        //                         sourceHeight: res.body.height * DEFAULT_SCALE,
        //                         width: res.body.width,
        //                         height: res.body.height,
        //                         transformation: {
        //                             width: Math.abs(res.body.width * selectedModel.transformation.scaleX),
        //                             height: Math.abs(res.body.height * selectedModel.transformation.scaleY)
        //                         }
        //                     };
        //                     selectedModel.updateAndRefresh(modelOptions);
        //                     SVGActions.resetSelection();
        //                 }
        //
        //                 // modelGroup.updateSelectedModelProcessImage(processImageName);
        //                 selectedModel.updateProcessImageName(processImageName);
        //
        //                 // SVGActions.updateElementImage(processImageName);
        //                 SVGActions.updateSvgModelImage(svgModel, processImageName);
        //
        //                 // dispatch(baseActions.recordSnapshot(headType));
        //                 dispatch(baseActions.resetCalculatedState(headType));
        //                 dispatch(baseActions.render(headType));
        //             })
        //             .catch((e) => {
        //                 // TODO: use log
        //                 console.error(e);
        //             });
        // >>>>>>> Feature: Add 4 axis module
    },

    // processAllMeshModel: (headType) => (dispatch, getState) => {
    //     const { materials, modelGroup, SVGActions } = getState()[headType];
    //     const { size } = getState().machine;
    //
    //     const models = modelGroup.getModels().filter(m => m.sourceType === 'image3d');
    //
    //     console.log(models);
    //
    //     if (models.length === 0) {
    //         return;
    //     }
    //
    //     for (const model of models) {
    //         const options = {
    //             headType: headType,
    //             uploadName: model.uploadName,
    //             sourceType: model.sourceType,
    //             mode: model.mode,
    //             transformation: {
    //                 width: model.transformation.width,
    //                 height: model.transformation.height,
    //                 rotationZ: 0,
    //                 flip: model.transformation.flip
    //             },
    //
    //             config: {
    //                 ...model.config
    //             },
    //             isRotate: materials.isRotate
    //         };
    //
    //         api.processImage(options)
    //             .then((res) => {
    //                 const processImageName = res.body.filename;
    //                 if (!processImageName) {
    //                     return;
    //                 }
    //
    //                 const { width, height } = res.body;
    //
    //                 const svgModel = model.relatedModels.svgModel;
    //                 const { sourceWidth, sourceHeight } = sizeModelByMachineSize(size, width, height);
    //                 const modelOptions = {
    //                     sourceWidth: sourceWidth,
    //                     sourceHeight: sourceHeight,
    //                     width: width,
    //                     height: height,
    //                     transformation: {
    //                         width: width * model.transformation.scaleX,
    //                         height: height * model.transformation.scaleY
    //                     }
    //                 };
    //                 model.updateAndRefresh(modelOptions);
    //
    //                 // modelGroup.updateSelectedModelProcessImage(processImageName);
    //                 model.updateProcessImageName(processImageName);
    //
    //                 // SVGActions.updateElementImage(processImageName);
    //                 SVGActions.updateSvgModelImage(svgModel, processImageName);
    //
    //                 // dispatch(baseActions.recordSnapshot(headType));
    //                 dispatch(baseActions.resetCalculatedState(headType));
    //                 dispatch(baseActions.render(headType));
    //             })
    //             .catch((e) => {
    //                 // TODO: use log
    //                 console.error(e);
    //             });
    //     }
    // },

    duplicateSelectedModel: (headType) => (dispatch, getState) => {
        const { page, modelGroup } = getState()[headType];
        if (page === PAGE_PROCESS) return;

        const { originalName, uploadName, config, sourceType, gcodeConfig, sourceWidth, sourceHeight, mode, transformation } = modelGroup.getSelectedModel();
        dispatch(actions.generateModel(headType, originalName, uploadName, sourceWidth, sourceHeight, mode,
            sourceType, config, gcodeConfig, transformation));
        dispatch(actions.resetProcessState(headType));
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
        dispatch(actions.processSelectedModel(headType));
        dispatch(actions.resetProcessState(headType));
    },

    removeSelectedModel: (headType) => (dispatch, getState) => {
        const { page, modelGroup, SVGActions, toolPathModelGroup } = getState()[headType];

        if (page === PAGE_PROCESS) return;

        SVGActions.deleteSelectedElements();
        // todo
        let toolPathModelState = null;
        for (const model of modelGroup.getSelectedModelArray()) {
            toolPathModelGroup.selectToolPathModel(model.modelID);
            toolPathModelState = toolPathModelGroup.removeSelectedToolPathModel();
        }
        const modelState = modelGroup.removeSelectedModel();

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));
        if (!modelState.hasModel) {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.EMPTY,
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

        const { SVGActions } = getState()[headType];

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

        SVGActions.updateSelectedElementsTransformation(transformation);
    },

    onModelTransform: (headType) => (dispatch, getState) => {
        const { modelGroup, transformationUpdateTime } = getState()[headType];

        const modelState = modelGroup.onModelTransform();
        dispatch(actions.showAllModelsObj3D(headType));
        if (new Date().getTime() - transformationUpdateTime > 50) {
            dispatch(baseActions.updateTransformation(headType, modelState.transformation));
        }
    },

    onModelAfterTransform: (headType) => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        if (modelGroup) {
            const modelState = modelGroup.onModelAfterTransform();

            if (modelState) {
                // dispatch(svgModelActions.updateSelectedTransformation(headType, modelGroup.getSelectedModelTransformation()));
                const transformation = modelGroup.getSelectedModelTransformation();
                SVGActions.updateSelectedElementsTransformation(transformation);

                dispatch(baseActions.updateState(headType, { modelState }));
                dispatch(baseActions.updateTransformation(headType, modelState.transformation));
                // dispatch(actions.recordSnapshot(headType));
            }
        }
    },

    // UNUSED, replaced by modifyText
    /*
    updateSelectedModelTextConfig: (headType, newConfig) => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathModelGroup, config } = getState()[headType];
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

                SVGActions.updateElementImage(uploadName);
                SVGActions.updateTransformation(transformation);
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
    */

    // previewModel: (headType, isProcess) => (dispatch, getState) => {
    //     const { page, modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[headType];
    //     if (page === PAGE_EDITOR) {
    //         return;
    //     }
    //
    //     const { materials } = getState()[headType];
    //     const { isRotate = false, diameter = 0, isCW = true } = materials || {};
    //
    //     if (isProcess || autoPreviewEnabled) {
    //         const modelState = modelGroup.getSelectedModel()
    //             .getTaskInfo();
    //         if (modelState) {
    //             const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelState.modelID);
    //             if (toolPathModelTaskInfo && toolPathModelTaskInfo.visible) {
    //                 const taskInfo = {
    //                     ...modelState,
    //                     ...toolPathModelTaskInfo,
    //                     isRotate: isRotate,
    //                     diameter: diameter,
    //                     isCW: isCW
    //                 };
    //                 controller.commitToolPathTask({
    //                     taskId: taskInfo.modelID,
    //                     headType: headType,
    //                     data: taskInfo
    //                 });
    //                 dispatch(baseActions.updateState(headType, {
    //                     stage: CNC_LASER_STAGE.GENERATING_TOOLPATH,
    //                     progress: 0
    //                 }));
    //             }
    //         }
    //     }
    // },

    manualPreview: (headType, isProcess) => async (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[headType];

        const { materials } = getState()[headType];

        if (isProcess || autoPreviewEnabled) {
            for (const model of modelGroup.getModels()) {
                await model.preview({ materials });
            }

            const isAllModelsPreviewed = checkIsAllModelsPreviewed(modelGroup, toolPathModelGroup);
            if (isAllModelsPreviewed) {
                dispatch(baseActions.updateState(headType, {
                    isAllModelsPreviewed: isAllModelsPreviewed
                }));
                dispatch(actions.showAllToolPathsObj3D(headType));
                dispatch(baseActions.render(headType));
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

        modelGroup.object.addEventListener('update', () => {
            dispatch(baseActions.render(headType));
        });
    },

    // initModelsPreviewChecker: (headType) => (dispatch, getState) => {
    //     const { modelGroup, toolPathModelGroup, isAllModelsPreviewed } = getState()[headType];
    //     const check = () => {
    //         const isAllModelsPreviewedN = checkIsAllModelsPreviewed(modelGroup, toolPathModelGroup);
    //         if (isAllModelsPreviewedN !== isAllModelsPreviewed) {
    //             dispatch(baseActions.updateState(headType, { isAllModelsPreviewed: isAllModelsPreviewedN }));
    //         }
    //         setTimeout(check, 200);
    //     };
    //     check();
    // },

    showAllToolPathsObj3D: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.hideAllModelsObj3D();
        toolPathModelGroup.showAllToolPathModels();
        toolPathModelGroup.showToolPathObjs();
    },

    showAllModelsObj3D: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        modelGroup.showAllModelsObj3D();
        toolPathModelGroup.hideAllToolPathModels();
    },

    onReceiveTaskResult: (headType, taskResult) => async (dispatch, getState) => {
        // const state = getState()[headType];
        const { modelGroup, toolPathModelGroup } = getState()[headType];
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
            dispatch(baseActions.updateState(headType, {
                previewFailed: false,
                stage: CNC_LASER_STAGE.PREVIEW_SUCCESS,
                progress: 1
            }));
        } else {
            dispatch(baseActions.updateState(headType, {
                previewFailed: false,
                stage: CNC_LASER_STAGE.RE_PREVIEW,
                progress: 1
            }));
        }
        const isAllModelsPreviewed = checkIsAllModelsPreviewed(modelGroup, toolPathModelGroup);
        if (isAllModelsPreviewed) {
            dispatch(actions.showAllToolPathsObj3D(headType));
            dispatch(baseActions.updateState(headType, {
                isAllModelsPreviewed: isAllModelsPreviewed
            }));
        }
        dispatch(baseActions.render(headType));
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
        dispatch(actions.manualPreview(headType));
        dispatch(baseActions.updateGcodeConfig(headType, gcodeConfig));
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
                lastModified: gcodeFile.lastModified,
                thumbnail: gcodeFile.thumbnail
            },
            stage: CNC_LASER_STAGE.GENERATE_GCODE_SUCCESS,
            progress: 1
        }));
    },

    /**
     * Callback function trigger by event when image processed.
     *
     * @param headType
     * @param taskResult
     * @returns {Function}
     */
    onReceiveProcessImageTaskResult: (headType, taskResult) => async (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }

        const selectedModel = selectedModels[0];
        const processImageName = taskResult.filename;
        if (!processImageName) {
            return;
        }

        const svgModel = selectedModel.relatedModels.svgModel;
        // const toolPathModel = selectedModel.relatedModels.toolPathModel;

        if (selectedModel.sourceType === SOURCE_TYPE_IMAGE3D) {
            const { width, height } = taskResult;
            const modelOptions = {
                sourceWidth: width * DEFAULT_SCALE,
                sourceHeight: height * DEFAULT_SCALE,
                width: width,
                height: height,
                transformation: {
                    width: Math.abs(width * selectedModel.transformation.scaleX),
                    height: Math.abs(height * selectedModel.transformation.scaleY)
                }
            };
            selectedModel.updateAndRefresh(modelOptions);
            SVGActions.resetSelection();
        }

        // modelGroup.updateSelectedModelProcessImage(processImageName);
        selectedModel.updateProcessImageName(processImageName);

        // SVGActions.updateElementImage(processImageName);
        SVGActions.updateSvgModelImage(svgModel, processImageName);

        // dispatch(baseActions.recordSnapshot(headType));
        dispatch(baseActions.resetCalculatedState(headType));
        dispatch(baseActions.render(headType));
        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.PROCESS_IMAGE_SUCCESS,
            progress: 1
        }));
    },


    onReceiveViewPathTaskResult: (headType, taskResult) => async (dispatch, getState) => {
        const { size } = getState().machine;
        const { toolPathModelGroup, materials } = getState()[headType];
        const { isRotate } = materials;

        if (taskResult.taskStatus === 'failed') {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.GENERATE_GCODE_FAILED,
                progress: 1
            }));
            return;
        }
        const { viewPathFile } = taskResult;
        toolPathModelGroup.receiveViewPathTaskResult(viewPathFile, isRotate ? materials : size).then(() => {
            dispatch(baseActions.render(headType));
        });
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

    togglePage: (headType, page) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            page: page
        }));
        if (page === PAGE_PROCESS) {
            dispatch(actions.manualPreview(headType));
        }
        dispatch(baseActions.render(headType));
    },

    /**
     * Generate View Path.
     *
     * @param headType
     * @param thumbnail G-code thumbnail should be included in G-code header.
     * @returns {Function}
     */
    generateViewPath: (headType) => (dispatch, getState) => {
        const modelInfos = [];
        const { modelGroup, toolPathModelGroup, materials } = getState()[headType];

        for (const model of modelGroup.getModels()) {
            if (model.hideFlag) continue;
            const modelTaskInfo = model.getTaskInfo();
            const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
            if (toolPathModelTaskInfo) {
                const taskInfo = {
                    ...modelTaskInfo,
                    ...toolPathModelTaskInfo,
                    materials
                };
                modelInfos.push(taskInfo);
            }
        }
        if (modelInfos.length === 0) {
            return;
        }
        controller.commitViewPathTask({
            taskId: uuid.v4(),
            headType: headType,
            data: modelInfos
        });
        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.GENERATING_GCODE,
            progress: 0
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
        const { modelGroup, SVGActions } = getState()[headType];
        SVGActions.bringElementToFront();
        modelGroup.bringSelectedModelToFront();
    },

    sendSelectedModelToBack: (headType) => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        SVGActions.sendElementToBack();
        modelGroup.sendSelectedModelToBack();
    },

    arrangeAllModels2D: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        modelGroup.arrangeAllModels2D();
        const modelState = modelGroup.onModelTransform();

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
        const { modelGroup, SVGActions, toolPathModelGroup } = getState()[headType];
        modelGroup.hideSelectedModel();
        toolPathModelGroup.hideSelectedModel();
        SVGActions.hideSelectedElement();
        dispatch(baseActions.render(headType));
    },

    showSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathModelGroup } = getState()[headType];
        modelGroup.showSelectedModel();
        toolPathModelGroup.showSelectedModel();
        SVGActions.showSelectedElement();
        // SVGActions.updateTransformation(modelGroup.getSelectedModel().transformation);
        dispatch(baseActions.render(headType));
    },

    /**
     * Reset process state after model changes
     */
    resetProcessState: (headType) => (dispatch, getState) => {
        const { isAllModelsPreviewed } = getState()[headType];
        dispatch(actions.showAllModelsObj3D(headType));
        if (isAllModelsPreviewed) {
            dispatch(baseActions.updateState(headType, {
                isAllModelsPreviewed: false
            }));
        }
        dispatch(baseActions.updateState(headType, {
            gcodeFile: null
        }));
    },

    /**
     * Create model from element.
     */
    createModelFromElement: (headType, element) => async (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        await SVGActions.createModelFromElement(element);

        dispatch(actions.resetProcessState(headType));
    },

    /**
     * Select models.
     */
    selectElements: (headType, elements) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.selectElements(elements);

        // select first toolPathModel by default
        // const model = modelGroup.getSelectedModelArray() && modelGroup.getSelectedModelArray().length > 0 && modelGroup.getSelectedModelArray()[0];
        // toolPathModelGroup.selectToolPathModel(model && model.modelID);
    },

    /**
     * Clear selection of models.
     */
    clearSelection: (headType) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.clearSelection();
    },

    /**
     * Resize element.
     */
    resizeElement: (headType, element, { resizeDir, resizeFrom, resizeTo, isUniformScaling }) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.resizeElement(element, { resizeDir, resizeFrom, resizeTo, isUniformScaling });
    },

    // TODO: ...
    /**
     * Resize element.
     */
    afterResizeElement: (headType, element) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.afterResizeElement(element);
        dispatch(actions.resetProcessState(headType));
        dispatch(actions.processSelectedModel(headType));
    },

    /**
     * Move element.
     */
    moveElement: (headType, element, { dx, dy }) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.moveElement(element, { dx, dy });
        dispatch(actions.resetProcessState(headType));
    },

    /**
     * Rotate element.
     */
    rotateElement: (headType, element, { angle, cx, cy }) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.rotateElement(element, { angle, cx, cy });
        dispatch(actions.resetProcessState(headType));
    },

    /**
     * Create text element (but not its corresponding model).
     */
    createText: (headType, content) => async (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        return SVGActions.createText(content);
    },

    /**
     * Modify text element.
     */
    modifyText: (headType, element, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.modifyText(element, options);
    },

    /**
     * Update Selected Model Transformation.
     *
     * TODO: Rename.
     */
    updateModelTransformationByElement: (headType, element, transformation) => (dispatch, getState) => {
        let model, svgModel;
        if (!element) {
            const { modelGroup } = getState()[headType];
            if (modelGroup.getSelectedModelArray.length !== 1) {
                return;
            }
            model = modelGroup.getSelectedModelArray()[0];
            svgModel = model.relatedModel.svgModel;
        } else {
            const { SVGActions } = getState()[headType];
            svgModel = SVGActions.getModelsByElements([element])[0];
            model = svgModel.relatedModel;
        }
        model.updateTransformation(transformation);
        svgModel.onUpdate();
    },

    updateMaterials: (headType, newMaterials) => (dispatch, getState) => {
        const { materials, modelGroup, toolPathModelGroup } = getState()[headType];
        const allMaterials = {
            ...materials,
            ...newMaterials
        };

        machineStore.set(`${headType}.materials`, allMaterials);

        if (allMaterials.isRotate) {
            allMaterials.x = round(allMaterials.diameter * Math.PI, 2);
            allMaterials.y = allMaterials.length;
        } else {
            allMaterials.x = 0;
            allMaterials.y = 0;
        }
        modelGroup.setMaterials(allMaterials);
        if (headType === 'laser') {
            toolPathModelGroup.updateMaterials(allMaterials);
        }
        toolPathModelGroup.object.isRotate = allMaterials.isRotate;
        dispatch(baseActions.updateState(headType, {
            materials: {
                ...allMaterials
            }
        }));
        dispatch(actions.processSelectedModel(headType));
        dispatch(actions.showAllModelsObj3D(headType));
    }
};

export default function reducer() {
    return {};
}
