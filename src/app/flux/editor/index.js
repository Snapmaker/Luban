import * as THREE from 'three';
import path from 'path';
import uuid from 'uuid';
import includes from 'lodash/includes';

import api from '../../api';
import {
    checkParams,
    DEFAULT_TEXT_CONFIG,
    generateModelDefaultConfigs,
    limitModelSizeByMachineSize
} from '../../models/ModelInfoUtils';

import {
    PAGE_EDITOR,
    PAGE_PROCESS,
    SOURCE_TYPE_IMAGE3D,
    DATA_PREFIX,
    COORDINATE_MODE_BOTTOM_CENTER
} from '../../constants';
import { baseActions } from './actions-base';
import { processActions } from './actions-process';

import LoadModelWorker from '../../workers/LoadModel.worker';
import { controller } from '../../lib/controller';
import { isEqual, round } from '../../../shared/lib/utils';
import { machineStore } from '../../store/local-storage';

import { CNC_LASER_STAGE } from './utils';

const getSourceType = (fileName) => {
    let sourceType;
    const extname = path.extname(fileName)
        .toLowerCase();
    if (extname === '.svg' || extname === '.dxf') {
        sourceType = 'svg';
    } else if (extname === '.stl') {
        sourceType = 'image3d';
    } else {
        sourceType = 'raster';
    }
    return sourceType;
};

/**
 * Recalculate model size
 */
const sizeModel = (size, materials, sourceWidth, sourceHeight) => {
    let width = sourceWidth;
    let height = sourceHeight;
    let scale = 1;

    if (!materials.isRotate) {
        const isX = sourceWidth > sourceHeight;
        const value = isX ? sourceWidth : sourceHeight;
        const max = isX ? size.x : size.y;
        const min = 30;

        if (value > max) {
            scale = max / value;
        } else if (value < min) {
            scale = min / value;
        }

        width = scale * sourceWidth;
        height = scale * sourceHeight;
    } else {
        const max = Math.max(materials.x - 1, 90);
        const min = Math.min(90);

        if (width >= max) {
            scale = max / sourceWidth;
        } else if (width < min) {
            scale = min / sourceWidth;
        }
        width = scale * sourceWidth;
        height = scale * sourceHeight;
    }

    return { width, height, scale };
};

export const actions = {

    ...baseActions,

    ...processActions,

    _init: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup } = getState()[headType];
        modelGroup.setDataChangedCallback(() => {
            dispatch(baseActions.render(headType));
        });
        toolPathGroup.setUpdatedCallBack(() => {
            dispatch(baseActions.render(headType));
        });
        dispatch(actions.__initOnControllerEvents(headType));
    },

    __initOnControllerEvents: (headType) => {
        return (dispatch) => {
            ['processImage', 'generateToolPath', 'generateGcode', 'generateViewPath']
                .forEach(key => {
                    controller.on(`taskProgress:${key}`, (taskResult) => {
                        if (headType !== taskResult.headType) {
                            return;
                        }
                        dispatch(actions.updateState(headType, {
                            progress: taskResult.progress
                        }));
                    });
                });

            controller.on('taskCompleted:processImage', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(actions.onReceiveProcessImageTaskResult(headType, taskResult));
            });

            controller.on('taskCompleted:generateToolPath', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(processActions.onGenerateToolPath(headType, taskResult));
            });

            controller.on('taskCompleted:generateGcode', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(processActions.onGenerateGcode(headType, taskResult));
            });

            controller.on('taskCompleted:generateViewPath', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(processActions.onGenerateViewPath(headType, taskResult));
            });
        };
    },

    onSizeUpdated: (headType, size) => (dispatch, getState) => {
        const { SVGActions, materials } = getState()[headType];

        SVGActions.updateSize(size);

        const isRotate = materials.isRotate;
        dispatch(actions.changeCoordinateMode(headType, null, (!isRotate ? size : {
            x: materials.diameter * Math.PI,
            y: materials.length
        })));
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
            inProgress: true,
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
                    inProgress: false,
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
                    inProgress: false,
                    progress: 1
                }));
            });
    },

    uploadCaseImage: (headType, file, mode, caseConfigs, caseTransformation, onError) => (dispatch, getState) => {
        dispatch(actions.updateState(headType, {
            stage: CNC_LASER_STAGE.UPLOADING_IMAGE,
            inProgress: true,
            progress: 0.25
        }));
        const { materials } = getState()[headType];
        file.isRotate = materials.isRotate;
        api.uploadImage(file)
            .then((res) => {
                dispatch(actions.updateState(headType, {
                    stage: CNC_LASER_STAGE.UPLOAD_IMAGE_SUCCESS,
                    inProgress: false,
                    progress: 1
                }));
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

    prepareStlVisualizer: (headType, model) => (dispatch) => {
        const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;
        const worker = new LoadModelWorker();
        worker.postMessage({ uploadPath });
        worker.onmessage = async (e) => {
            const data = e.data;

            const { type } = data;

            switch (type) {
                case 'LOAD_MODEL_POSITIONS': {
                    const { positions } = data;

                    const bufferGeometry = new THREE.BufferGeometry();
                    const modelPositionAttribute = new THREE.BufferAttribute(positions, 3);
                    const material = new THREE.MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 0 });

                    bufferGeometry.addAttribute('position', modelPositionAttribute);
                    bufferGeometry.computeVertexNormals();
                    const mesh = new THREE.Mesh(bufferGeometry, material);
                    model.image3dObj = mesh;
                    break;
                }
                case 'LOAD_MODEL_CONVEX': {
                    worker.terminate();
                    const { positions } = data;

                    const convexGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.BufferAttribute(positions, 3);
                    convexGeometry.addAttribute('position', positionAttribute);
                    model.convexGeometry = convexGeometry;

                    break;
                }
                case 'LOAD_MODEL_PROGRESS': {
                    break;
                }
                case 'LOAD_MODEL_FAILED': {
                    worker.terminate();
                    dispatch(actions.updateState(headType, {
                        stage: CNC_LASER_STAGE.PREVIEW_FAILED,
                        inProgress: false,
                        progress: 0
                    }));
                    break;
                }
                default:
                    break;
            }
        };
    },

    /**
     * Generate model by given parameters.
     *
     * @param headType
     * @param originalName - original name of uploaded image file
     * @param uploadName - modified name of uploaded image file
     * @param sourceWidth - source width of image
     * @param sourceHeight - source height of image
     * @param mode - bw | greyscale | ...
     * @param sourceType - raster | svg | dxf | text | image3d | ...
     * @param config - model config (TODO: can be removed?)
     * @param gcodeConfig - G-code config (TODO: can be removed?)
     * @param transformation - ?
     * @param modelID - optional, used in project recovery
     */
    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, config, gcodeConfig, transformation, modelID, zIndex) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { materials, modelGroup, SVGActions, contentGroup } = getState()[headType];

        sourceType = sourceType || getSourceType(originalName);

        if (!checkParams(headType, sourceType, mode)) {
            console.error(`sourceType or mode error, sourceType: ${sourceType}, mode: ${mode}`);
            return;
        }

        // Get default configurations
        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode, materials.isRotate);

        const defaultConfig = modelDefaultConfigs.config;
        const defaultGcodeConfig = modelDefaultConfigs.gcodeConfig;

        // Limit image size by machine size
        const newModelSize = sourceType !== SOURCE_TYPE_IMAGE3D
            ? limitModelSizeByMachineSize(size, sourceWidth, sourceHeight)
            : sizeModel(size, materials, sourceWidth, sourceHeight);

        let { width, height } = newModelSize;
        const { scale } = newModelSize;

        if (`${headType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            width = 40;
            height = 40 * sourceHeight / sourceWidth;
        }

        const defaultTransformation = {
            width,
            height
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

        if (!transformation.scaleX) {
            transformation.scaleX = transformation.width / width;
        }

        if (!transformation.scaleY) {
            transformation.scaleY = transformation.height / height;
        }

        const options = {
            modelID,
            limitSize: size,
            headType,
            sourceType,
            mode,
            originalName,
            uploadName,
            sourceWidth,
            sourceHeight,
            width,
            height,
            scale,
            transformation,
            config,
            gcodeConfig,
            zIndex,
            isRotate: materials.isRotate,
            elem: contentGroup.addSVGElement({
                element: config.svgNodeName || 'image',
                attr: { id: modelID }
            }),
            size: size
        };

        const model = modelGroup.addModel(options);

        SVGActions.clearSelection();
        SVGActions.addSelectedSvgModelsByModels([model]);

        if (path.extname(uploadName).toLowerCase() === '.stl') {
            dispatch(actions.prepareStlVisualizer(headType, model));
        }

        // Process image right after created
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
        const { SVGActions } = getState()[headType];
        if (!isMultiSelect) {
            // remove all selected model
            dispatch(actions.clearSelection(headType));
        }

        SVGActions.addSelectedSvgModelsByModels([model]);

        // todo, donot reset here
        SVGActions.resetSelection();
    },

    changeSelectedModelMode: (headType, sourceType, mode) => async (dispatch, getState) => {
        const { modelGroup, materials } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }

        const modelDefaultConfigs = generateModelDefaultConfigs(headType, sourceType, mode, materials.isRotate);

        const selectedModel = selectedModels[0];

        // Set or replace image config
        const config = {
            ...selectedModel.config,
            ...modelDefaultConfigs.config,
            ...selectedModel.getModeConfig(mode)
        };
        modelGroup.updateSelectedMode(mode, config);

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
    },

    // TODO: temporary workaround for model image processing
    processSelectedModel: (headType) => async (dispatch, getState) => {
        const { materials, modelGroup, toolParams = {} } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];

        if (selectedModel.sourceType !== 'raster' && selectedModel.sourceType !== 'svg' && selectedModel.sourceType !== 'image3d' && selectedModel.config.svgNodeName !== 'text' && selectedModel.sourceType !== 'dxf') {
            return;
        }
        // svg process as image
        if (selectedModel.sourceType === 'svg' && !selectedModel.uploadImageName) {
            await selectedModel.uploadSourceImage();
        }

        const options = selectedModel.getTaskInfo();
        options.transformation = {
            width: options.transformation.width,
            height: options.transformation.height
        };

        options.materials = materials;
        options.toolParams = toolParams;

        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.PROCESSING_IMAGE,
            inProgress: true,
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


    duplicateSelectedModel: (headType) => (dispatch, getState) => {
        const { page, modelGroup } = getState()[headType];
        if (page === PAGE_PROCESS) return;

        const { originalName, uploadName, config, sourceType, sourceWidth, sourceHeight, mode } = modelGroup.getSelectedModel();
        const transformation = { ...modelGroup.getSelectedModel().transformation };
        transformation.positionX += 5;
        transformation.positionY -= 5;
        dispatch(actions.generateModel(headType, originalName, uploadName, sourceWidth, sourceHeight, mode,
            sourceType, config, undefined, transformation));
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
        const { modelGroup, SVGActions } = getState()[headType];

        SVGActions.deleteSelectedElements();

        const modelState = modelGroup.removeSelectedModel();

        dispatch(baseActions.updateState(headType, {
            ...modelState
        }));
        if (!modelState.hasModel) {
            dispatch(baseActions.updateState(headType, {
                stage: CNC_LASER_STAGE.EMPTY,
                inProgress: false,
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

    initSelectedModelListener: (headType) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];

        modelGroup.object.addEventListener('update', () => {
            dispatch(baseActions.render(headType));
        });
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
        const model = modelGroup.getModel(taskResult.data.modelID);
        if (!model) {
            return;
        }

        const processImageName = taskResult.filename;
        if (!processImageName) {
            return;
        }

        if (model.sourceType === SOURCE_TYPE_IMAGE3D) {
            const { width, height } = taskResult;
            if (!isEqual(width, model.width) || !isEqual(height, model.height)) {
                const modelOptions = {
                    sourceWidth: width / model.scale,
                    sourceHeight: height / model.scale,
                    width: width,
                    height: height,
                    transformation: {
                        width: Math.abs(width * model.transformation.scaleX),
                        height: Math.abs(height * model.transformation.scaleY)
                    }
                };
                model.updateAndRefresh(modelOptions);
                SVGActions.resetSelection();
            }
        }

        // modelGroup.updateSelectedModelProcessImage(processImageName);
        model.updateProcessImageName(processImageName);

        // SVGActions.updateElementImage(processImageName);
        SVGActions.updateSvgModelImage(model, processImageName);

        // dispatch(baseActions.recordSnapshot(headType));
        dispatch(baseActions.resetCalculatedState(headType));
        dispatch(baseActions.render(headType));
        dispatch(baseActions.updateState(headType, {
            stage: CNC_LASER_STAGE.PROCESS_IMAGE_SUCCESS,
            inProgress: false,
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

        dispatch(baseActions.updateTransformation(headType, modelState.transformation));
        dispatch(actions.recordSnapshot(headType));
        dispatch(baseActions.render(headType));
    },

    undo: (headType) => (dispatch, getState) => {
        const { modelGroup, undoSnapshots, redoSnapshots } = getState()[headType];
        if (undoSnapshots.length <= 1) {
            return;
        }
        redoSnapshots.push(undoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(baseActions.render(headType));
    },

    redo: (headType) => (dispatch, getState) => {
        const { modelGroup, undoSnapshots, redoSnapshots } = getState()[headType];
        if (redoSnapshots.length === 0) {
            return;
        }

        undoSnapshots.push(redoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(baseActions.render(headType));
    },

    recordSnapshot: (headType) => (dispatch, getState) => {
        const { modelGroup, undoSnapshots, redoSnapshots } = getState()[headType];
        const cloneModels = modelGroup.cloneModels();
        undoSnapshots.push({
            models: cloneModels
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
        const { modelGroup, SVGActions } = getState()[headType];
        modelGroup.hideSelectedModel();
        SVGActions.hideSelectedElement();
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
        dispatch(baseActions.render(headType));
    },

    showSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        modelGroup.showSelectedModel();
        SVGActions.showSelectedElement();
        // SVGActions.updateTransformation(modelGroup.getSelectedModel().transformation);
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
        dispatch(baseActions.render(headType));
    },

    /**
     * Reset process state after model changes
     */
    // eslint-disable-next-line no-unused-vars
    resetProcessState: (headType) => (dispatch, getState) => {
        // const { isAllModelsPreviewed } = getState()[headType];
        // if (isAllModelsPreviewed) {
        //     dispatch(baseActions.updateState(headType, {
        //         isAllModelsPreviewed: false
        //     }));
        // }
        // dispatch(baseActions.updateState(headType, {
        //     gcodeFile: null
        // }));
    },

    /**
     * SVG Actions below
     **************************************************************************/

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

        dispatch(baseActions.render(headType));
    },

    /**
     * Clear selection of models.
     */
    clearSelection: (headType) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.clearSelection();

        dispatch(baseActions.render(headType));
    },

    /**
     * Move elements start.
     */
    moveElementsStart: (headType, elements) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.moveElementsStart(elements);
    },

    /**
     * Move elements.
     */
    moveElements: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.moveElements(elements, options);
    },

    /**
     * Move elements finish.
     */
    moveElementsFinish: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.moveElementsFinish(elements, options);

        dispatch(baseActions.render(headType));
    },

    /**
     * Move elements immediately.
     */
    moveElementsImmediately: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.moveElementsImmediately(elements, options);

        dispatch(baseActions.render(headType));
    },

    /**
     * Move elements on key down (⬇).
     */
    moveElementsOnKeyDown: (headType, elements, { dx, dy }) => (dispatch, getState) => {
        const { page, SVGActions } = getState()[headType];
        if (page === PAGE_PROCESS) {
            return;
        }
        SVGActions.moveElementsOnArrowKeyDown(elements, { dx, dy });
    },

    /**
     * Move elements on key up (⬆).
     */
    moveElementsOnKeyUp: (headType) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions.moveElementsOnArrowKeyUp();
        dispatch(actions.resetProcessState(headType));
    },

    /**
     * Resize elements start.
     */
    resizeElementsStart: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.resizeElementsStart(elements, options);
    },

    /**
     * Resize elements (resizing).
     */
    resizeElements: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.resizeElements(elements, options);
    },

    /**
     * Resize elements finish.
     */
    resizeElementsFinish: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];

        SVGActions.resizeElementsFinish(elements, options);

        dispatch(actions.resetProcessState(headType));
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];
        if (selectedModel.sourceType !== 'image3d') {
            dispatch(actions.processSelectedModel(headType));
        }

        dispatch(baseActions.render(headType));
    },

    /**
     * Resize elements immediately.
     */
    resizeElementsImmediately: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.resizeElementsImmediately(elements, options);

        dispatch(baseActions.render(headType));
    },

    /**
     * Flip elements horizontally.
     *
     * Note that only support flip one element.
     */
    flipElementsHorizontally: (headType, elements) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.flipElementsHorizontally(elements);

        dispatch(baseActions.render(headType));
    },

    /**
     * Flip elements vertically.
     *
     * Note that only support flip one element.
     */
    flipElementsVertically: (headType, elements) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.flipElementsVertically(elements);

        dispatch(baseActions.render(headType));
    },

    /**
     * Get elements uniform scaling state for resizing.
     */
    getSelectedElementsUniformScalingState: (headType) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        return SVGActions.getSelectedElementsUniformScalingState();
    },

    /**
     * Rotate elements start.
     */
    rotateElementsStart: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.rotateElementsStart(elements, options);
    },

    /**
     * Rotate elements (rotating).
     *
     * @param options.deltaAngle - delta angle
     */
    rotateElements: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.rotateElements(elements, options);
    },

    /**
     * Rotate element.
     */
    rotateElement: (headType, element, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        // FIXME: remove this
        SVGActions.rotateElement(element, options);
        dispatch(actions.resetProcessState(headType));
    },

    /**
     * Rotate elements finish.
     */
    rotateElementsFinish: (headType, elements) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.rotateElementsFinish(elements);

        dispatch(baseActions.render(headType));
    },

    /**
     * Rotate elements immediately.
     */
    rotateElementsImmediately: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.rotateElementsImmediately(elements, options);

        dispatch(baseActions.render(headType));
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
        let model;
        if (!element) {
            const { modelGroup } = getState()[headType];
            if (modelGroup.getSelectedModelArray.length !== 1) {
                return;
            }
            model = modelGroup.getSelectedModelArray()[0];
        } else {
            const { SVGActions } = getState()[headType];
            model = SVGActions.getModelsByElements([element])[0];
        }
        model.updateTransformation(transformation);
        model.onUpdate();
    },

    updateMaterials: (headType, newMaterials) => (dispatch, getState) => {
        const { materials, modelGroup, toolPathGroup } = getState()[headType];
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

        toolPathGroup.updateMaterials(allMaterials);
        toolPathGroup.showSimulationObject(false);

        dispatch(baseActions.updateState(headType, {
            materials: {
                ...allMaterials
            },
            showSimulation: false
        }));
        if (materials.isRotate !== allMaterials.isRotate) {
            dispatch(actions.processSelectedModel(headType));
        }
    },

    /**
     * Switch to another page.
     *
     * @param headType
     * @param page
     */
    switchToPage: (headType, page) => (dispatch, getState) => {
        const { toolPathGroup, autoPreviewEnabled } = getState()[headType];
        if (!includes([PAGE_EDITOR, PAGE_PROCESS], page)) {
            return;
        }
        // switch to `page`
        dispatch(baseActions.updateState(headType, { page }));

        // when switching to "Process" page, we need to
        // trigger preview of all images
        if (page === PAGE_PROCESS) {
            toolPathGroup.checkoutToolPathStatus();
            if (autoPreviewEnabled) {
                dispatch(actions.preview(headType));
            }
        }

        dispatch(baseActions.render(headType));
    },

    /**
     * Change Coordinate Mode
     *
     * @param headType
     * @param coordinateMode
     * @param coordinateSize
     */
    changeCoordinateMode: (headType, coordinateMode = null, coordinateSize = null) => (dispatch, getState) => {
        const oldCoordinateMode = getState()[headType].coordinateMode;
        coordinateMode = coordinateMode ?? oldCoordinateMode;
        const { size } = getState().machine;
        coordinateSize = coordinateSize ?? {
            x: size.x,
            y: size.y
        };
        if (coordinateMode !== oldCoordinateMode) { // move all elements
            const coorDelta = {
                dx: 0,
                dy: 0
            };
            if (oldCoordinateMode !== COORDINATE_MODE_BOTTOM_CENTER) {
                coorDelta.dx -= coordinateSize.x / 2 * oldCoordinateMode.setting.sizeMultiplyFactor.x;
                coorDelta.dy += coordinateSize.y / 2 * oldCoordinateMode.setting.sizeMultiplyFactor.y;
            }

            if (coordinateMode !== COORDINATE_MODE_BOTTOM_CENTER) {
                coorDelta.dx += coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
                coorDelta.dy -= coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;
            }

            const { SVGActions } = getState()[headType];
            const elements = SVGActions.getAllModelElements();
            SVGActions.moveElementsStart(elements);
            SVGActions.moveElements(elements, coorDelta);
            SVGActions.moveElementsFinish(elements, coorDelta);
            dispatch(baseActions.render(headType));
        }

        dispatch(actions.updateState(headType, { coordinateMode, coordinateSize }));
    }
};

export default function reducer() {
    return {};
}
