import * as THREE from 'three';
import path from 'path';
import uuid from 'uuid';
import _, { includes } from 'lodash';

import ToolpathRendererWorker from '../../workers/ToolpathRenderer.worker';

import api from '../../api';
import {
    checkParams,
    DEFAULT_TEXT_CONFIG,
    generateModelDefaultConfigs,
    limitModelSizeByMachineSize,
    isOverSizeModel
} from '../../models/ModelInfoUtils';

import {
    PROCESS_MODES_EXCEPT_VECTOR,
    PROCESS_MODE_VECTOR,
    PAGE_EDITOR,
    PAGE_PROCESS,
    SOURCE_TYPE_IMAGE3D,
    DATA_PREFIX,
    COORDINATE_MODE_CENTER,
    COORDINATE_MODE_BOTTOM_CENTER, DISPLAYED_TYPE_MODEL,
    MIN_LASER_CNC_CANVAS_SCALE, MAX_LASER_CNC_CANVAS_SCALE
} from '../../constants';
import { baseActions } from './actions-base';
import { processActions } from './actions-process';

import LoadModelWorker from '../../workers/LoadModel.worker';
import { controller } from '../../lib/controller';
import { isEqual, round } from '../../../shared/lib/utils';

import { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';
import VisibleOperation2D from '../operation-history/VisibleOperation2D';
import AddOperation2D from '../operation-history/AddOperation2D';
import DeleteOperation2D from '../operation-history/DeleteOperation2D';
import { actions as operationHistoryActions } from '../operation-history';
import Operations from '../operation-history/Operations';
import MoveOperation2D from '../operation-history/MoveOperation2D';
import ScaleOperation2D from '../operation-history/ScaleOperation2D';
import RotateOperation2D from '../operation-history/RotateOperation2D';
import ModelLoader from '../../ui/widgets/PrintingVisualizer/ModelLoader';
import SvgModel from '../../models/SvgModel';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import { NS } from '../../ui/SVGEditor/lib/namespaces';

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

    return {
        width,
        height,
        scale
    };
};

function shouldProcessModel(selectedModel) {
    if (selectedModel.sourceType === 'image3d' || selectedModel.mode === 'vector') {
        return false;
    }
    return true;
}

// a wrapper function for recording scaled models states
function recordScaleActionsToHistory(scaleActionsFn, elements, SVGActions, headType, machine, dispatch) {
    if (typeof scaleActionsFn === 'function') {
        const tmpTransformationState = {};
        const operations = new Operations();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = { ...svgModel.transformation, refImage: element.href?.baseVal };
        }

        scaleActionsFn();

        const promises = elements.map(element => {
            const svgModel = SVGActions.getSVGModelByElement(element);
            // record image element final state after image has been processed asynchrously,
            // other elements state can be recorded immediately
            if (element.tagName.toLowerCase() === 'image') {
                return new Promise((resolve, reject) => {
                    element.onerror = reject;
                    element.onload = () => {
                        // resize action
                        // [T][R][S][T]
                        const transformList = SvgModel.getTransformList(element);
                        const { x, y, width, height } = element.getBBox();

                        const angle = transformList.getItem(1).angle;
                        const scaleX = transformList.getItem(2).matrix.a;
                        const scaleY = transformList.getItem(2).matrix.d;

                        const transform = transformList.consolidate();
                        const matrix = transform.matrix;
                        const svg = document.createElementNS(NS.SVG, 'svg');
                        const center = svg.createSVGPoint();
                        center.x = x + width / 2;
                        center.y = y + height / 2;

                        const newCenter = center.matrixTransform(matrix);

                        const t = {
                            x: newCenter.x,
                            y: newCenter.y,
                            width: Math.abs(width * scaleX),
                            height: Math.abs(height * scaleY),
                            scaleX: scaleX / Math.abs(scaleX), // normalize scale: -2.2 => -1, 1.8 => 1
                            scaleY: scaleY / Math.abs(scaleY),
                            angle
                        };
                        element.setAttribute('x', t.x - t.width / 2);
                        element.setAttribute('y', t.y - t.height / 2);
                        element.setAttribute('width', t.width);
                        element.setAttribute('height', t.height);
                        SvgModel.recalculateElementTransformList(element, { x: t.x, y: t.y, scaleX: t.scaleX, scaleY: t.scaleY, angle: t.angle });

                        SVGActions.getSVGModelByElement(element).onTransform();
                        // update selector
                        SVGActions.svgContentGroup.resizeSelectorFinish(elements);
                        // update t
                        const _t = SVGActionsFactory.calculateElementsTransformation(elements);
                        SVGActions._setSelectedElementsTransformation(_t);

                        element.onload = null;
                        if (!_.isEqual(tmpTransformationState[element.id], svgModel.transformation)) {
                            const operation = new ScaleOperation2D({
                                target: svgModel,
                                svgActions: SVGActions,
                                machine,
                                from: tmpTransformationState[element.id],
                                to: { ...svgModel.transformation, refImage: element.href.baseVal }
                            });
                            operations.push(operation);
                        }
                        resolve();
                    };
                    if (svgModel.sourceType === 'svg' && /(\.svg|\.svg\?_=\d*)$/.test(element.href.baseVal)) {
                        // after SVG file scaled, reload href and skip browser cache
                        // convert `/data/Tmp/18382283_21075036parsed.svg?_=1636096912083` to `/data/Tmp/18382283_21075036parsed.svg`
                        const originalHref = element.href.baseVal.replace(/\?_=\d*$/ig, '');
                        element.setAttribute('href', `${originalHref}?_=${Date.now()}`);
                    } else if (svgModel.sourceType === 'image3d') {
                        element.onload();
                    }
                });
            } else {
                // <rect> and <ellipse> elements go here, others go above
                return new Promise((resolve) => {
                    if (!_.isEqual(tmpTransformationState[element.id], svgModel.transformation)) {
                        const operation = new ScaleOperation2D({
                            target: svgModel,
                            svgActions: SVGActions,
                            machine,
                            from: tmpTransformationState[element.id],
                            to: { ...svgModel.transformation, refImage: element.href?.baseVal }
                        });
                        operations.push(operation);
                    }
                    resolve();
                });
            }
        });
        // all the SVGModel changed, record operations to history
        Promise.all(promises).then(() => {
            dispatch(operationHistoryActions.setOperations(headType, operations));
        }).catch(() => {
            dispatch(operationHistoryActions.setOperations(headType, operations));
        });
    }
}

const toolpathRendererWorker = new ToolpathRendererWorker();
const scaleExtname = ['.svg', '.dxf'];

export const actions = {

    ...baseActions,

    ...processActions,

    _init: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup, initFlag } = getState()[headType];
        modelGroup.removeAllModels();
        modelGroup.setDataChangedCallback(() => {
            dispatch(baseActions.render(headType));
        });
        toolPathGroup.setUpdatedCallBack(() => {
            dispatch(baseActions.render(headType));
        });
        if (!initFlag) {
            dispatch(actions.__initOnControllerEvents(headType));
            dispatch(baseActions.updateState(headType, {
                initFlag: true
            }));
        }

        dispatch(actions.__initToolpathWorker());
    },

    __initOnControllerEvents: (headType) => {
        return (dispatch, getState) => {
            // task progress
            controller.on('taskProgress:processImage', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(actions.updateState(headType, {
                    progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_PROCESSING_IMAGE, taskResult.progress)
                }));
            });

            controller.on('taskProgress:generateToolPath', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(actions.updateState(headType, {
                    progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH, taskResult.progress)
                }));
            });

            controller.on('taskProgress:generateGcode', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(actions.updateState(headType, {
                    progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_GCODE, taskResult.progress)
                }));
            });

            controller.on('taskProgress:generateViewPath', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(actions.updateState(headType, {
                    progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_VIEWPATH, taskResult.progress)
                }));
            });

            controller.on('taskProgress:cutModel', () => {});

            // task completed
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

                const { toolPathGroup, progressStatesManager } = getState()[headType];
                const toolPath = toolPathGroup._getToolPath(taskResult.taskId);

                if (toolPath) {
                    if (taskResult.taskStatus === 'failed') {
                        toolPath.onGenerateToolpathFailed(taskResult);
                    } else {
                        progressStatesManager.startNextStep();

                        toolpathRendererWorker.postMessage({
                            taskResult: taskResult
                        });
                    }
                }
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
                const { progressStatesManager } = getState()[headType];
                progressStatesManager.startNextStep();
                dispatch(actions.updateState(headType, {
                    stage: STEP_STAGE.CNC_LASER_RENDER_VIEWPATH,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_VIEWPATH, 0)
                }));
                dispatch(processActions.onGenerateViewPath(headType, taskResult));
            });

            controller.on('taskCompleted:cutModel', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { cutModelInfo } = getState()[headType];
                dispatch(actions.updateState(headType, {
                    cutModelInfo: {
                        ...cutModelInfo,
                        isProcessing: false,
                        svgInfo: taskResult.svgInfo,
                        stlInfo: taskResult.stlInfo
                    }
                }));
            });
        };
    },

    __initToolpathWorker: () => (dispatch, getState) => {
        toolpathRendererWorker.onmessage = (e) => {
            const data = e.data;
            const { status, headType, value } = data;
            switch (status) {
                case 'succeed': {
                    const { taskResult } = value;
                    const { toolPathGroup, shouldGenerateGcodeCounter } = getState()[headType];
                    const toolpath = toolPathGroup._getToolPath(taskResult.taskId);
                    if (toolpath) {
                        toolpath.onGenerateToolpathFinail();
                    }

                    if (toolPathGroup && toolPathGroup._getCheckAndSuccessToolPaths()) {
                        dispatch(baseActions.updateState(headType, {
                            shouldGenerateGcodeCounter: shouldGenerateGcodeCounter + 1
                        }));
                    }
                    break;
                }
                case 'data': {
                    const { taskResult, index, renderResult } = value;

                    const { toolPathGroup } = getState()[headType];

                    const toolpath = toolPathGroup._getToolPath(taskResult.taskId);

                    if (toolpath) {
                        toolpath.onGenerateToolpathModel(taskResult.data[index], taskResult.filenames[index], renderResult);
                    }

                    break;
                }
                case 'progress': {
                    const { progressStatesManager } = getState()[headType];
                    const { progress } = value;
                    if (progress < 0.1) {
                        progressStatesManager.startNextStep();
                        dispatch(actions.updateState(headType, {
                            stage: STEP_STAGE.CNC_LASER_RENDER_TOOLPATH,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_TOOLPATH, progress)
                        }));
                    } else {
                        dispatch(actions.updateState(headType, {
                            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_TOOLPATH, progress)
                        }));
                    }
                    break;
                }
                case 'err': {
                    const { progressStatesManager } = getState()[headType];
                    dispatch(baseActions.updateState(headType, {
                        stage: STEP_STAGE.CNC_LASER_GENERATE_TOOLPATH_FAILED,
                        progress: 1
                    }));
                    progressStatesManager.finishProgress(false);
                    break;
                }
                default:
                    break;
            }
        };
    },

    onSizeUpdated: (headType, size) => (dispatch, getState) => {
        const { SVGActions, materials, coordinateMode } = getState()[headType];

        SVGActions.updateSize(size);

        const isRotate = materials.isRotate;
        const newMode = (coordinateMode ?? (isRotate ? COORDINATE_MODE_BOTTOM_CENTER : COORDINATE_MODE_CENTER));
        const newSize = (!isRotate ? size : {
            x: materials.diameter * Math.PI,
            y: materials.length
        });
        dispatch(actions.changeCoordinateMode(headType, newMode, newSize));
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
    uploadImage: (headType, file, mode, onError, isLimit = true) => (dispatch, getState) => {
        const { materials, progressStatesManager } = getState()[headType];
        progressStatesManager.startProgress(PROCESS_STAGE.CNC_LASER_UPLOAD_IMAGE, [1, 1]);
        dispatch(actions.updateState(headType, {
            stage: STEP_STAGE.CNC_LASER_UPLOADING_IMAGE,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_UPLOADING_IMAGE, 0.25)
        }));
        const formData = new FormData();
        formData.append('image', file);
        formData.append('isRotate', materials.isRotate);


        api.uploadImage(formData)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;
                dispatch(actions.generateModel(
                    headType, originalName, uploadName,
                    width, height, mode, undefined, { svgNodeName: 'image' },
                    undefined, undefined, undefined, undefined, isLimit
                ));
            })
            .catch((err) => {
                onError && onError(err);
                dispatch(actions.updateState(headType, {
                    stage: STEP_STAGE.CNC_LASER_UPLOAD_IMAGE_FAILED,
                    progress: 1
                }));
                progressStatesManager.finishProgress(false);
            });
    },

    checkIsOversizeImage: (headType, file, onError) => (dispatch, getState) => {
        const { materials, progressStatesManager, coordinateSize } = getState()[headType];
        const formData = new FormData();
        formData.append('image', file);
        formData.append('isRotate', materials.isRotate);
        api.uploadImage(formData).then((res) => {
            const { width, height } = res.body;
            const isOverSize = isOverSizeModel(coordinateSize, width, height);
            dispatch(actions.updateState(headType, {
                isOverSize: isOverSize
            }));
        }).catch((err) => {
            onError && onError(err);
            dispatch(actions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_UPLOAD_IMAGE_FAILED,
                progress: 1
            }));
            progressStatesManager.finishProgress(false);
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
                    const material = new THREE.MeshPhongMaterial({
                        color: 0xa0a0a0,
                        specular: 0xb0b0b0,
                        shininess: 0
                    });

                    bufferGeometry.setAttribute('position', modelPositionAttribute);
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
                    convexGeometry.setAttribute('position', positionAttribute);
                    model.convexGeometry = convexGeometry;

                    break;
                }
                case 'LOAD_MODEL_PROGRESS': {
                    break;
                }
                case 'LOAD_MODEL_FAILED': {
                    worker.terminate();
                    dispatch(actions.updateState(headType, {
                        stage: STEP_STAGE.CNC_LASER_PREVIEW_FAILED,
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
    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, config, gcodeConfig, transformation, modelID, zIndex, isLimit) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { materials, modelGroup, SVGActions, contentGroup, toolPathGroup, coordinateMode, coordinateSize } = getState()[headType];
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
        let width, height, scale;
        if (transformation?.width && transformation?.height) {
            if (transformation?.scaleX && transformation?.scaleY) {
                width = transformation?.width / Math.abs(transformation?.scaleX);
                height = transformation?.height / Math.abs(transformation?.scaleY);
            } else {
                width = transformation?.width;
                height = transformation?.height;
            }
            if (sourceType === SOURCE_TYPE_IMAGE3D) {
                const newModelSize = sizeModel(size, materials, sourceWidth, sourceHeight);
                scale = newModelSize?.scale;
            }
        } else {
            const extname = path.extname(uploadName);
            const isScale = !includes(scaleExtname, extname);
            const newModelSize = sourceType !== SOURCE_TYPE_IMAGE3D
                ? limitModelSizeByMachineSize(coordinateSize, sourceWidth, sourceHeight, isLimit, isScale)
                : sizeModel(size, materials, sourceWidth, sourceHeight);
            width = newModelSize?.width;
            height = newModelSize?.height;
            scale = newModelSize?.scale;
        }

        if (`${headType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            width = 40;
            height = 40 * sourceHeight / sourceWidth;
        }

        const defaultTransformation = {
            width,
            height
        };
        const coorDelta = {
            dx: coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x,
            dy: coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y
        };
        defaultTransformation.positionX = coorDelta.dx;
        if (materials.isRotate) {
            defaultTransformation.positionY = height / 2;
        } else {
            defaultTransformation.positionY = coorDelta.dy;
        }

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
                element: config.svgNodeName === 'text' ? 'image' : config.svgNodeName || 'image',
                attr: { id: modelID }
            }),
            size: size
        };

        const model = modelGroup.addModel(options);

        const operation = new AddOperation2D({
            toolPathGroup,
            svgActions: SVGActions,
            target: model
        });
        const operations = new Operations();
        operations.push(operation);

        dispatch(operationHistoryActions.setOperations(headType, operations));

        SVGActions.clearSelection();
        SVGActions.addSelectedSvgModelsByModels([model]);

        if (path.extname(uploadName)
            .toLowerCase() === '.stl') {
            dispatch(actions.prepareStlVisualizer(headType, model));
        }

        // Process image right after created
        dispatch(actions.processSelectedModel(headType));
        dispatch(actions.updateState(headType, {
            isOverSize: null
        }));
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
        const { SVGActions, modelGroup } = getState()[headType];
        let selected = modelGroup.getSelectedModelArray();
        selected = [...selected];
        dispatch(actions.clearSelection(headType));
        if (!isMultiSelect) {
            // remove all selected model
            SVGActions.addSelectedSvgModelsByModels([model]);
        } else {
            if (selected.find(item => item === model)) {
                const selectedModels = selected.filter(item => item !== model);
                modelGroup.emptySelectedModelArray();
                SVGActions.addSelectedSvgModelsByModels(selectedModels);
            } else {
                SVGActions.addSelectedSvgModelsByModels([...selected, model]);
            }
        }

        dispatch(baseActions.render(headType));
        // todo, donot reset here
        // SVGActions.resetSelection();
    },

    changeSelectedModelMode: (headType, sourceType, mode) => async (dispatch, getState) => {
        const { modelGroup, materials, toolPathGroup } = getState()[headType];

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
        // switch mode will drop the model inside toolpath
        if ((selectedModel.mode === PROCESS_MODE_VECTOR && PROCESS_MODES_EXCEPT_VECTOR.includes(mode))
            || (PROCESS_MODES_EXCEPT_VECTOR.includes(selectedModel.mode) && mode === PROCESS_MODE_VECTOR)
        ) {
            const toolPaths = toolPathGroup.getToolPaths();
            toolPaths.forEach((item) => {
                const idx = item.modelIDs.findIndex((id) => id === selectedModel.modelID);
                if (idx > -1) {
                    if (item.modelIDs?.length === 1) {
                        dispatch(actions.deleteToolPath(headType, [item.id]));
                    } else {
                        item.deleteModel(selectedModel.modelID);
                        dispatch(actions.saveToolPath(headType, item));
                    }
                }
            });
        }
        modelGroup.updateSelectedMode(mode, config);
        dispatch(actions.processSelectedModel(headType));
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
        const { materials, modelGroup, toolParams = {}, progressStatesManager } = getState()[headType];

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

        if (!progressStatesManager.inProgress()) {
            progressStatesManager.startProgress(PROCESS_STAGE.CNC_LASER_PROCESS_IMAGE, [1]);
        } else {
            progressStatesManager.startNextStep();
        }
        dispatch(baseActions.updateState(headType, {
            stage: STEP_STAGE.CNC_LASER_PROCESSING_IMAGE,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_PROCESSING_IMAGE, 0)
        }));

        dispatch(actions.resetProcessState(headType));

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
        const { modelGroup, SVGActions, toolPathGroup } = getState()[headType];

        SVGActions.duplicateSelectedModel();

        const operations = new Operations();
        for (const svgModel of modelGroup.getSelectedModelArray()) {
            const operation = new AddOperation2D({
                target: svgModel,
                svgActions: SVGActions,
                toolPathGroup
            });
            operations.push(operation);
        }

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
        // const { originalName, uploadName, config, sourceType, sourceWidth, sourceHeight, mode } = modelGroup.getSelectedModel();
        // const transformation = { ...modelGroup.getSelectedModel().transformation };
        // transformation.positionX += 5;
        // transformation.positionY -= 5;
        // dispatch(actions.generateModel(headType, originalName, uploadName, sourceWidth, sourceHeight, mode,
        //     sourceType, config, undefined, transformation));
        // dispatch(actions.resetProcessState(headType));
    },


    onFlipSelectedModel: (headType, flipStr) => (dispatch, getState) => {
        const model = getState()[headType].modelGroup.getSelectedModel();

        switch (flipStr) {
            case 'Vertical':
                dispatch(actions.flipElementsVertically(headType, [model.elem]));
                break;
            case 'Horizontal':
                dispatch(actions.flipElementsHorizontally(headType, [model.elem]));
                break;
            case 'Reset':
                dispatch(actions.resetFlipElements(headType, [model.elem]));
                break;
            default:
        }
    },

    removeSelectedModelsByCallback: (headType) => (dispatch) => {
        dispatch(actions.updateState(headType, {
            removingModelsWarningCallback: () => {
                dispatch(actions.removeSelectedModel(headType));
            }
        }));
        dispatch(actions.checkToRemoveSelectedModels(headType));
    },

    checkToRemoveSelectedModels: (headType) => (dispatch, getState) => {
        const { modelGroup, toolPathGroup, removingModelsWarningCallback } = getState()[headType];
        const { selectedModelIDArray, allModelIDs } = modelGroup.getState();
        const toolPaths = toolPathGroup.getToolPaths();
        const emptyToolPaths = [];
        toolPaths.forEach((item) => {
            for (const id of item.modelIDs) {
                if (!selectedModelIDArray.includes(id) && allModelIDs.includes(id)) {
                    return;
                }
            }
            emptyToolPaths.push(item);
        });
        if (emptyToolPaths.length === 0) {
            removingModelsWarningCallback();
            return;
        }

        dispatch(actions.updateState(headType, {
            removingModelsWarning: true,
            emptyToolPaths: emptyToolPaths
        }));
    },

    removeSelectedModel: (headType) => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathGroup } = getState()[headType];

        const operations = new Operations();
        for (const svgModel of modelGroup.getSelectedModelArray()) {
            const operation = new DeleteOperation2D({
                target: svgModel,
                svgActions: SVGActions,
                toolPathGroup,
                toolPaths: toolPathGroup.toolPaths.filter((item) => {
                    const index = item.modelIDs.indexOf(svgModel.modelID);
                    if (index > -1) {
                        item.modelIDs.splice(index, 1);
                        return true;
                    }
                    return false;
                })
            });
            operations.push(operation);
        }

        const { selectedModelIDArray } = modelGroup.getState();
        const toolPaths = toolPathGroup.getToolPaths();
        toolPaths.forEach((item) => {
            for (const id of selectedModelIDArray) {
                if (item.modelIDs.includes(id)) {
                    const index = item.modelIDs.indexOf(id);
                    if (index > -1) {
                        item.modelIDs.splice(index, 1);
                    }
                }
            }
        });

        SVGActions.deleteSelectedElements();
        const modelState = modelGroup.removeSelectedModel();

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(baseActions.updateState(headType, {
            ...modelState
        }));
        if (!modelState.hasModel) {
            dispatch(baseActions.updateState(headType, {
                displayedType: DISPLAYED_TYPE_MODEL,
                needToPreview: true,
                stage: STEP_STAGE.EMPTY,
                progress: 0
            }));
        }
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
    },

    removeEmptyToolPaths: (headType) => (dispatch, getState) => {
        const { emptyToolPaths, toolPathGroup } = getState()[headType];
        emptyToolPaths.forEach((item) => {
            toolPathGroup.deleteToolPath(item.id);
        });
        dispatch(baseActions.updateState(headType, {
            emptyToolPaths: []
        }));
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
        const { SVGActions, modelGroup, progressStatesManager } = getState()[headType];
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

        dispatch(baseActions.resetCalculatedState(headType));
        dispatch(baseActions.render(headType));

        dispatch(baseActions.updateState(headType, {
            stage: STEP_STAGE.CNC_LASER_PROCESSING_IMAGE,
            progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_PROCESSING_IMAGE, 1)
        }));
        progressStatesManager.finishProgress(true);
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
        dispatch(baseActions.render(headType));
    },

    undo: (headType) => (dispatch, getState) => {
        const { canUndo } = getState()[headType].history;
        if (canUndo) {
            dispatch(operationHistoryActions.undo(headType));
            dispatch(actions.resetProcessState(headType));
            dispatch(baseActions.render(headType));
        }
    },

    redo: (headType) => (dispatch, getState) => {
        const { canRedo } = getState()[headType].history;
        if (canRedo) {
            dispatch(operationHistoryActions.redo(headType));
            dispatch(actions.resetProcessState(headType));
            dispatch(baseActions.render(headType));
        }
    },

    hideSelectedModel: (headType, model) => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        const svgElements = SVGActions.svgContentGroup.getSelected();

        modelGroup.hideSelectedModel();
        SVGActions.hideSelectedElement();

        const operation = new VisibleOperation2D({
            svgTarget: svgElements,
            svgActions: SVGActions,
            target: model,
            visible: false
        });
        const operations = new Operations();
        operations.push(operation);

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
    },

    showSelectedModel: (headType, model) => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        const svgElements = SVGActions.svgContentGroup.getSelected();

        modelGroup.showSelectedModel();
        SVGActions.showSelectedElement();
        // SVGActions.updateTransformation(modelGroup.getSelectedModel().transformation);
        const operation = new VisibleOperation2D({
            svgTarget: svgElements,
            svgActions: SVGActions,
            target: model,
            visible: true
        });
        const operations = new Operations();
        operations.push(operation);

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(baseActions.updateState(headType, {
            isChangedAfterGcodeGenerating: true
        }));
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
    },

    /**
     * Reset process state after model changes
     */
    resetProcessState: (headType) => (dispatch) => {
        dispatch(baseActions.updateState(headType, {
            simulationNeedToPreview: true,
            displayedType: DISPLAYED_TYPE_MODEL,
            needToPreview: true
        }));
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
        const { SVGActions, toolPathGroup } = getState()[headType];

        const newSVGModel = await SVGActions.createModelFromElement(element);
        if (newSVGModel) {
            const operation = new AddOperation2D({
                toolPathGroup,
                svgActions: SVGActions,
                target: newSVGModel
            });
            const operations = new Operations();
            operations.push(operation);

            dispatch(operationHistoryActions.setOperations(headType, operations));
        }

        dispatch(actions.resetProcessState(headType));
    },

    selectAllElements: (headType) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        // dispatch(actions.clearSelection(headType));
        SVGActions.selectAllElements();
        dispatch(baseActions.render(headType));
    },

    cut: (headType) => (dispatch) => {
        dispatch(actions.updateState(headType, {
            removingModelsWarningCallback: () => {
                dispatch(actions.copy(headType));
                dispatch(actions.removeSelectedModel(headType));
            }
        }));
        dispatch(actions.checkToRemoveSelectedModels(headType));
    },

    copy: (headType) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions.copy();
        dispatch(baseActions.render(headType));
    },

    paste: (headType) => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathGroup } = getState()[headType];

        SVGActions.paste();

        const operations = new Operations();
        for (const svgModel of modelGroup.getSelectedModelArray()) {
            const operation = new AddOperation2D({
                target: svgModel,
                svgActions: SVGActions,
                toolPathGroup
            });
            operations.push(operation);
        }

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
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
        const { machine } = getState();

        const tmpTransformationState = {};
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = { ...svgModel.transformation };
        }

        SVGActions.moveElementsFinish(elements, options);

        const operations = new Operations();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (!_.isEqual(tmpTransformationState[element.id], svgModel.transformation)) {
                const operation = new MoveOperation2D({
                    target: svgModel,
                    svgActions: SVGActions,
                    machine,
                    from: tmpTransformationState[element.id],
                    to: { ...svgModel.transformation }
                });
                operations.push(operation);
            }
        }
        dispatch(actions.resetProcessState(headType));
        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(baseActions.render(headType));
        dispatch(actions._checkModelsInChunkArea(headType));
    },

    /**
     * Move elements immediately.
     */
    moveElementsImmediately: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        const { machine } = getState();

        const tmpTransformationState = {};
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = { ...svgModel.transformation };
        }

        SVGActions.moveElementsImmediately(elements, options);

        const operations = new Operations();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (!_.isEqual(tmpTransformationState[element.id], svgModel.transformation)) {
                const operation = new MoveOperation2D({
                    target: svgModel,
                    svgActions: SVGActions,
                    machine,
                    from: tmpTransformationState[element.id],
                    to: { ...svgModel.transformation }
                });
                operations.push(operation);
            }
        }
        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(actions.resetProcessState(headType));

        dispatch(baseActions.render(headType));
        dispatch(actions._checkModelsInChunkArea(headType));
    },

    /**
     * Move elements on key down (⬇).
     */
    moveElementsOnKeyDown: (headType, elements, { dx, dy }) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions.moveElementsOnArrowKeyDown(elements, {
            dx,
            dy
        });
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
    resizeElementsFinish: (headType, elements, options) => async (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const { machine } = getState();

        recordScaleActionsToHistory(() => {
            SVGActions.resizeElementsFinish(elements, options);
        }, elements, SVGActions, headType, machine, dispatch);

        dispatch(actions.resetProcessState(headType));
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];
        if (shouldProcessModel(selectedModel)) {
            dispatch(actions.processSelectedModel(headType));
        }

        dispatch(baseActions.render(headType));
        dispatch(actions._checkModelsInChunkArea(headType));
    },

    /**
     * Resize elements immediately.
     */
    resizeElementsImmediately: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const { machine } = getState();

        recordScaleActionsToHistory(() => {
            SVGActions.resizeElementsImmediately(elements, options);
        }, elements, SVGActions, headType, machine, dispatch);

        dispatch(actions.resetProcessState(headType));
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];
        if (shouldProcessModel(selectedModel)) {
            dispatch(actions.processSelectedModel(headType));
        }

        dispatch(baseActions.render(headType));
        dispatch(actions._checkModelsInChunkArea(headType));
    },

    /**
     * Flip elements horizontally.
     *
     * Note that only support flip one element.
     */
    flipElementsHorizontally: (headType, elements) => (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const { machine } = getState();

        recordScaleActionsToHistory(() => {
            SVGActions.flipElementsHorizontally(elements);
        }, elements, SVGActions, headType, machine, dispatch);

        dispatch(actions.resetProcessState(headType));
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];
        if (shouldProcessModel(selectedModel)) {
            dispatch(actions.processSelectedModel(headType));
        }

        dispatch(baseActions.render(headType));
    },

    /**
     * Flip elements vertically.
     *
     * Note that only support flip one element.
     */
    flipElementsVertically: (headType, elements) => (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const { machine } = getState();

        recordScaleActionsToHistory(() => {
            SVGActions.flipElementsVertically(elements);
        }, elements, SVGActions, headType, machine, dispatch);

        dispatch(actions.resetProcessState(headType));
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];
        if (shouldProcessModel(selectedModel)) {
            dispatch(actions.processSelectedModel(headType));
        }

        dispatch(baseActions.render(headType));
    },

    /**
     * Flip elements vertically.
     *
     * Note that only support flip one element.
     */
    resetFlipElements: (headType, elements) => (dispatch, getState) => {
        const { SVGActions, modelGroup } = getState()[headType];
        const { machine } = getState();

        recordScaleActionsToHistory(() => {
            SVGActions.resetFlipElements(elements);
        }, elements, SVGActions, headType, machine, dispatch);

        dispatch(actions.resetProcessState(headType));
        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];
        if (shouldProcessModel(selectedModel)) {
            dispatch(actions.processSelectedModel(headType));
        }

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
        const { machine } = getState();

        const tmpTransformationState = {};
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = { ...svgModel.transformation };
        }

        SVGActions.rotateElementsFinish(elements);

        const operations = new Operations();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (!_.isEqual(tmpTransformationState[element.id], svgModel.transformation)) {
                const operation = new RotateOperation2D({
                    target: svgModel,
                    svgActions: SVGActions,
                    machine,
                    from: tmpTransformationState[element.id],
                    to: { ...svgModel.transformation }
                });
                operations.push(operation);
            }
        }
        dispatch(actions.resetProcessState(headType));
        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(baseActions.render(headType));
        dispatch(actions._checkModelsInChunkArea(headType));
    },

    /**
     * Rotate elements immediately.
     */
    rotateElementsImmediately: (headType, elements, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        const { machine } = getState();

        const tmpTransformationState = {};
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = { ...svgModel.transformation };
        }

        SVGActions.rotateElementsImmediately(elements, options);

        const operations = new Operations();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (!_.isEqual(tmpTransformationState[element.id], svgModel.transformation)) {
                const operation = new RotateOperation2D({
                    target: svgModel,
                    svgActions: SVGActions,
                    machine,
                    from: tmpTransformationState[element.id],
                    to: { ...svgModel.transformation }
                });
                operations.push(operation);
            }
        }
        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(actions.resetProcessState(headType));

        dispatch(baseActions.render(headType));
        dispatch(actions._checkModelsInChunkArea(headType));
    },

    /**
     * Create text element (but not its corresponding model).
     */
    createText: (headType, content) => async (dispatch, getState) => {
        const { SVGActions, coordinateMode, coordinateSize } = getState()[headType];
        const position = {
            x: coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x,
            y: -coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y
        };
        return SVGActions.createText(content, position);
    },

    /**
     * Modify text element.
     */
    modifyText: (headType, element, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.modifyText(element, options);
        dispatch(actions.resetProcessState(headType));
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
        if (coordinateMode.value !== oldCoordinateMode.value) { // move all elements
            const coorDelta = {
                dx: 0,
                dy: 0
            };
            if (oldCoordinateMode.value !== COORDINATE_MODE_BOTTOM_CENTER.value) {
                coorDelta.dx -= coordinateSize.x / 2 * oldCoordinateMode.setting.sizeMultiplyFactor.x;
                coorDelta.dy += coordinateSize.y / 2 * oldCoordinateMode.setting.sizeMultiplyFactor.y;
            }

            if (coordinateMode.value !== COORDINATE_MODE_BOTTOM_CENTER.value) {
                coorDelta.dx += coordinateSize.x / 2 * coordinateMode.setting.sizeMultiplyFactor.x;
                coorDelta.dy -= coordinateSize.y / 2 * coordinateMode.setting.sizeMultiplyFactor.y;
            }

            const { SVGActions } = getState()[headType];
            const elements = SVGActions.getAllModelElements();
            SVGActions.moveElementsStart(elements);
            SVGActions.moveElements(elements, coorDelta);
            SVGActions.moveElementsFinish(elements, coorDelta);
            SVGActions.clearSelection();
            dispatch(baseActions.render(headType));
        }

        dispatch(actions.resetProcessState(headType));
        dispatch(actions.updateState(headType, {
            coordinateMode,
            coordinateSize
        }));
    },

    scaleCanvasToFit: (headType) => (dispatch, getState) => {
        const { coordinateSize } = getState()[headType];
        const longestEdge = Math.max(coordinateSize.x, coordinateSize.y);
        if (longestEdge > 0) {
            let newScale = 350 / longestEdge * 0.6;
            if (newScale < MIN_LASER_CNC_CANVAS_SCALE) {
                newScale = MIN_LASER_CNC_CANVAS_SCALE;
            }
            if (newScale > MAX_LASER_CNC_CANVAS_SCALE) {
                newScale = MAX_LASER_CNC_CANVAS_SCALE;
            }
            dispatch(actions.updateState(headType, {
                scale: newScale
            }));
        }
    },

    importStackedModelSVG: (headType) => (dispatch, getState) => {
        const {
            cutModelInfo: {
                svgInfo
            }
        } = getState()[headType];
        const mode = PROCESS_MODE_VECTOR;
        svgInfo.forEach((svgFileInfo, index) => {
            const width = svgFileInfo.width, height = svgFileInfo.height;
            const uploadName = svgFileInfo.filename, originalName = `${index}.svg`;
            dispatch(actions.generateModel(headType, originalName, uploadName, width, height, mode, undefined, { svgNodeName: 'image' }));
        });
    },

    generateModelStack: (headType, modelWidth, modelHeight, thickness, scale = 1) => (dispatch, getState) => {
        const {
            materials,
            cutModelInfo,
            coordinateSize
        } = getState()[headType];
        const options = {
            // modelID: 'id56746944-1822-4d80-a566-64614921906a',
            // modelName: cutModelInfo.originalName,
            // headType: headType,
            // sourceType: SOURCE_TYPE_IMAGE3D,
            // mode: PROCESS_MODE_VECTOR,
            // visible: true,
            // isToolPathSelect: false,
            // sourceHeight: modelHeight,
            // sourceWidth: modelWidth,
            scale: scale,
            originalName: cutModelInfo.originalName,
            uploadName: cutModelInfo.uploadName,
            transformation: {
                width: modelWidth,
                height: modelHeight
            },
            // config: { svgNodeName: 'image' },
            materials: {
                ...materials,
                width: coordinateSize.x,
                height: coordinateSize.y,
                thickness: thickness
            },
            // toolParams: {},
            modelCuttingSettings: {
                materialThickness: thickness,
                width: coordinateSize.x,
                height: coordinateSize.y
            }
        };
        dispatch(actions.updateState(headType, {
            cutModelInfo: {
                ...cutModelInfo,
                isProcessing: true
            }
        }));
        controller.commitCutModelTask({
            taskId: uuid.v4(),
            headType: headType,
            data: options
        });
    },

    cutModel: (headType, file, onError) => (dispatch, getState) => {
        const { progressStatesManager, coordinateSize } = getState()[headType];
        progressStatesManager.startProgress(PROCESS_STAGE.LASER_CUT_STL);
        dispatch(actions.updateState(headType, {
            stage: STEP_STAGE.LASER_CUTTING_STL,
            progress: progressStatesManager.updateProgress(STEP_STAGE.LASER_CUTTING_STL, 0.25)
        }));
        const formData = new FormData();
        formData.append('file', file);

        api.uploadFile(formData)
            .then((res) => {
                const { originalName, uploadName } = res.body;
                new ModelLoader().load(
                    `${DATA_PREFIX}/${uploadName}`,
                    (geometry) => {
                        let modelInitSize;
                        function findSuitableScale(curScale, limit) {
                            const scaleX = limit.x / modelInitSize.x;
                            const scaleY = limit.y / modelInitSize.y;
                            const scaleZ = limit.z / modelInitSize.z;
                            const maxScale = Math.min(scaleX, scaleY, scaleZ);
                            return Math.min(maxScale, curScale);
                        }

                        if (geometry.getAttribute('position').array.length > 0) {
                            geometry.computeBoundingBox();
                            let box3 = geometry.boundingBox;
                            modelInitSize = {
                                x: box3.max.x - box3.min.x,
                                y: box3.max.y - box3.min.y,
                                z: box3.max.z - box3.min.z
                            };

                            const MAX_Z = 500;
                            const canvasRange = { x: coordinateSize.x, y: coordinateSize.y, z: MAX_Z };
                            if (box3.max.x - box3.min.x > canvasRange.x || box3.max.y - box3.min.y > canvasRange.y) {
                                const _scale = findSuitableScale(Infinity, canvasRange);
                                const scale = 0.9 * _scale;
                                geometry.scale(scale, scale, scale);
                                geometry.computeBoundingBox();
                                box3 = geometry.boundingBox;
                                modelInitSize = {
                                    x: box3.max.x - box3.min.x,
                                    y: box3.max.y - box3.min.y,
                                    z: box3.max.z - box3.min.z
                                };
                            }
                            dispatch(actions.updateState(headType, {
                                showImportStackedModelModal: true,
                                cutModelInfo: {
                                    originalName, uploadName, modelInitSize
                                }
                            }));
                            dispatch(actions.updateState(headType, {
                                stage: STEP_STAGE.LASER_CUTTING_STL,
                                progress: progressStatesManager.updateProgress(STEP_STAGE.LASER_CUTTING_STL, 1)
                            }));
                            progressStatesManager.finishProgress(true);
                        } else {
                            throw new Error('geometry invalid');
                        }
                    },
                    () => {}, // onprogress
                    (err) => {
                        onError && onError(err);
                        dispatch(actions.updateState(headType, {
                            stage: STEP_STAGE.LASER_CUT_STL_SUCCEED,
                            progress: 1
                        }));
                        progressStatesManager.finishProgress(false);
                    }
                );
            })
            .catch((err) => {
                onError && onError(err);
                dispatch(actions.updateState(headType, {
                    stage: STEP_STAGE.LASER_CUT_STL_FAILED,
                    progress: 1
                }));
                progressStatesManager.finishProgress(true);
            });
    },

    setShortcutStatus: (headType, enabled) => (dispatch) => {
        dispatch(actions.updateState(headType, {
            enableShortcut: enabled
        }));
    }
};

export default function reducer() {
    return {};
}
