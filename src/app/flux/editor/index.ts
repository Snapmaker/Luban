import { Machine } from '@snapmaker/luban-platform';
import { includes, noop } from 'lodash';
import { isInside } from 'overlap-area';
import path from 'path';
import * as THREE from 'three';
import { v4 as uuid } from 'uuid';

import { isEqual, round, whetherTransformed } from '../../../shared/lib/utils';
import api from '../../api';
import { controller } from '../../communication/socket-communication';
import {
    COORDINATE_MODE_BOTTOM_CENTER,
    DATA_PREFIX,
    DISPLAYED_TYPE_MODEL,
    HEAD_LASER,
    MAX_LASER_CNC_CANVAS_SCALE,
    MIN_LASER_CNC_CANVAS_SCALE,
    PAGE_EDITOR,
    PAGE_PROCESS,
    PROCESS_MODES_EXCEPT_VECTOR,
    PROCESS_MODE_VECTOR,
    SOURCE_TYPE
} from '../../constants';
import {
    CylinderWorkpieceSize,
    JobOffsetMode,
    Materials,
    ObjectReference,
    Origin,
    OriginReference,
    OriginType,
    RectangleWorkpieceSize,
    Workpiece,
    WorkpieceShape,
    getOriginReferenceOptions,
    getOriginTypeOptions
} from '../../constants/coordinate';
import CompoundOperation from '../../core/CompoundOperation';
import OperationHistory from '../../core/OperationHistory';
import log from '../../lib/log';
import ProgressStatesManager, { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';
import workerManager from '../../lib/manager/workerManager';
import ModelGroup from '../../models/ModelGroup';
import ModelGroup2D from '../../models/ModelGroup2D';
import { DEFAULT_TEXT_CONFIG, checkParams, generateModelDefaultConfigs, isOverSizeModel, limitModelSizeByMachineSize } from '../../models/ModelInfoUtils';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import SvgModel from '../../models/SvgModel';
import { machineStore } from '../../store/local-storage';
import ToolPath from '../../toolpaths/ToolPath';
import ToolPathGroup from '../../toolpaths/ToolPathGroup';
import { NS } from '../../ui/SVGEditor/lib/namespaces';
import ModelLoader from '../../ui/widgets/PrintingVisualizer/ModelLoader';
import AddOperation2D from '../operation-history/AddOperation2D';
import DeleteOperation2D from '../operation-history/DeleteOperation2D';
import DrawDelete from '../operation-history/DrawDelete';
import DrawLine from '../operation-history/DrawLine';
import DrawStart from '../operation-history/DrawStart';
import DrawTransform from '../operation-history/DrawTransform';
import DrawTransformComplete from '../operation-history/DrawTransformComplete';
import MoveOperation2D from '../operation-history/MoveOperation2D';
import RotateOperation2D from '../operation-history/RotateOperation2D';
import ScaleOperation2D from '../operation-history/ScaleOperation2D';
import VisibleOperation2D from '../operation-history/VisibleOperation2D';
import { baseActions } from './actions-base';

/* eslint-disable-next-line import/no-cycle */
import { processActions } from './actions-process';
/* eslint-disable-next-line import/no-cycle */
import { actions as operationHistoryActions } from '../operation-history';
/* eslint-disable-next-line import/no-cycle */
import { actions as projectActions } from '../project';
/* eslint-disable-next-line import/no-cycle */
// import { HeadType } from '../../../server/services/machine/sacp/SacpClient';
import { SVGClippingResultType, SVGClippingType } from '../../constants/clipping';
import { actions as appGlobalActions } from '../app-global';
import UpdateHrefOperation2D from '../operation-history/UpdateHrefOperation2D';


declare type HeadType = 'laser' | 'cnc';

const getSourceType = fileName => {
    let sourceType;
    const extname = path.extname(fileName).toLowerCase();
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
async function recordScaleActionsToHistory(scaleActionsFn, elements, SVGActions, headType, machine, dispatch) {
    if (typeof scaleActionsFn === 'function') {
        const tmpTransformationState = {};
        const operations = new CompoundOperation();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = {
                ...svgModel.transformation,
                refImage: element.href?.baseVal
            };
        }

        scaleActionsFn();

        const promises = elements.map(async (element) => {
            const svgModel = SVGActions.getSVGModelByElement(element);
            // record image element final state after image has been processed asynchrously,
            // other elements state can be recorded immediately
            if (element.tagName.toLowerCase() === 'image' && svgModel.sourceType !== 'image3d') {
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
                        SvgModel.recalculateElementTransformList(element, {
                            x: t.x,
                            y: t.y,
                            scaleX: t.scaleX,
                            scaleY: t.scaleY,
                            angle: t.angle
                        });

                        SVGActions.getSVGModelByElement(element).onTransform();
                        // update selector
                        SVGActions.svgContentGroup.resizeSelectorFinish(elements);
                        // update t
                        const _t = SVGActionsFactory.calculateElementsTransformation(elements);
                        SVGActions._setSelectedElementsTransformation(_t);

                        element.onload = null;
                        if (whetherTransformed(tmpTransformationState[element.id], svgModel.transformation)) {
                            const operation = new ScaleOperation2D({
                                target: svgModel,
                                svgActions: SVGActions,
                                machine,
                                from: tmpTransformationState[element.id],
                                to: {
                                    ...svgModel.transformation,
                                    refImage: element.href.baseVal
                                }
                            });
                            operations.push(operation);
                        }
                        resolve();
                    };
                    if ((svgModel.sourceType === 'raster' || svgModel.sourceType === 'svg') && /(\.svg|\.svg\?_=\d*)$/.test(element.href.baseVal)) {
                        // after SVG file scaled, reload href and skip browser cache
                        // convert `/data/Tmp/18382283_21075036parsed.svg?_=1636096912083` to `/data/Tmp/18382283_21075036parsed.svg`
                        const originalHref = element.href.baseVal.replace(/\?_=\d*$/gi, '');
                        element.setAttribute('href', `${originalHref}?_=${Date.now()}`);
                    }
                });
            } else {
                // <rect> and <ellipse> elements go here, others go above
                return new Promise(resolve => {
                    if (whetherTransformed(tmpTransformationState[element.id], svgModel.transformation)) {
                        const operation = new ScaleOperation2D({
                            target: svgModel,
                            svgActions: SVGActions,
                            machine,
                            from: tmpTransformationState[element.id],
                            to: {
                                ...svgModel.transformation,
                                refImage: element.href?.baseVal
                            }
                        });
                        operations.push(operation);
                    }
                    resolve();
                });
            }
        });
        // all the SVGModel changed, record operations to history
        Promise.all(promises)
            .then(() => {
                dispatch(operationHistoryActions.setOperations(headType, operations));
            })
            .catch(() => {
                dispatch(operationHistoryActions.setOperations(headType, operations));
            });
    }
}

const scaleExtname = ['.svg', '.dxf'];
const DEFAULT_STATE = {
    showSVGShapeLibrary: false
};

export const ACTION_UPDATE_STATE = 'editor/ACTION_UPDATE_STATE';
export const actions = {
    ...baseActions,

    ...processActions,

    _init: headType => (dispatch, getState) => {
        const { modelGroup, toolPathGroup, initFlag } = getState()[headType];

        modelGroup.removeAllModels();
        modelGroup.setDataChangedCallback(() => {
            dispatch(baseActions.render(headType));
        });

        toolPathGroup.setUpdatedCallBack(() => {
            dispatch(baseActions.render(headType));
        });

        if (!initFlag) {
            dispatch(actions.__initEditorParameters(headType));

            dispatch(actions.__initOnControllerEvents(headType));

            dispatch(
                baseActions.updateState(headType, {
                    initFlag: true
                })
            );
        }
    },

    __initEditorParameters: (headType: string) => {
        return (dispatch) => {
            const originType = machineStore.get(`${headType}.origin.type`, headType === HEAD_LASER ? OriginType.Object : OriginType.Workpiece);
            const originReference = machineStore.get('origin.reference', ObjectReference.BottomLeft);

            const origin: Origin = {
                type: originType,
                reference: originReference,
                referenceMetadata: {},
            };

            dispatch(baseActions.updateState(headType, {
                origin,
            }));
        };
    },

    __initOnControllerEvents: headType => {
        return (dispatch, getState) => {
            // task progress
            controller.on('taskProgress:generateToolPath', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(
                    actions.updateState(headType, {
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_TOOLPATH, taskResult.progress)
                    })
                );
            });

            controller.on('taskProgress:generateGcode', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(
                    actions.updateState(headType, {
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_GCODE, taskResult.progress)
                    })
                );
            });

            controller.on('taskProgress:generateViewPath', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(
                    actions.updateState(headType, {
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_GENERATING_VIEWPATH, taskResult.progress)
                    })
                );
            });

            controller.on('taskProgress:cutModel', noop);

            controller.on('taskProgress:processImage', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(
                    actions.updateState(headType, {
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_PROCESSING_IMAGE, taskResult.progress)
                    })
                );
            });

            // task completed
            controller.on('taskCompleted:processImage', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(actions.onReceiveProcessImageTaskResult(headType, taskResult));
            });

            controller.on('taskProgress:svgClipping', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                dispatch(
                    actions.updateState(headType, {
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_SVG_CLIPPING, taskResult.progress)
                    })
                );
            });

            // task completed
            controller.on('taskCompleted:svgClipping', (taskResult) => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(actions.onReceiveSVGClippingTaskResult(headType, taskResult));
            });

            controller.on('taskCompleted:generateToolPath', async (toolPathTaskResult) => {
                const { toolPathGroup } = getState()[headType];
                const progressStatesManager = getState()[headType].progressStatesManager as ProgressStatesManager;

                // Failure
                if (headType !== toolPathTaskResult.headType || toolPathTaskResult.taskStatus === 'failed') {
                    dispatch(
                        baseActions.updateState(headType, {
                            stage: STEP_STAGE.CNC_LASER_GENERATE_TOOLPATH_FAILED,
                            progress: 1,
                        })
                    );
                    progressStatesManager.finishProgress(false);
                    return;
                }

                // Start progress
                dispatch(
                    actions.updateState(headType, {
                        stage: STEP_STAGE.CNC_LASER_RENDER_TOOLPATH,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_TOOLPATH, 0),
                    })
                );

                log.info('Start rendering tool path...');

                const toolPathRenderPromises = [];

                toolPathTaskResult.data.forEach((taskResult) => {
                    const toolPath = toolPathGroup._getToolPath(taskResult.taskId);

                    // update stage for generate tool path
                    progressStatesManager.startNextStep();

                    if (toolPath) {
                        taskResult.filenames = toolPathTaskResult.filenames.find(d => d.taskId === taskResult.taskId)?.filenames;
                        // progressStatesManager.startNextStep();
                        const promise = new Promise<boolean>((resolve) => {
                            workerManager.toolpathRenderer(taskResult, (payload) => {
                                const { status, value } = payload;

                                switch (status) {
                                    case 'succeed': {
                                        log.info('Rendering tool path... succeed.');
                                        const { shouldGenerateGcodeCounter } = getState()[headType];

                                        const toolpath = toolPathGroup._getToolPath(taskResult.taskId) as ToolPath;
                                        if (toolpath) {
                                            toolpath.onGenerateToolpathFinail();
                                        }

                                        if (toolPathGroup && toolPathGroup._getCheckAndSuccessToolPaths()) {
                                            toolPathGroup.addSelectedToolpathColor();
                                            dispatch(
                                                baseActions.updateState(headType, {
                                                    shouldGenerateGcodeCounter: shouldGenerateGcodeCounter + 1
                                                })
                                            );
                                        }

                                        // update stage for render tool path
                                        progressStatesManager.startNextStep();

                                        resolve(true);
                                        break;
                                    }
                                    case 'data': {
                                        const { taskResult: newTaskResult, index, renderResult } = value;
                                        const toolpath = toolPathGroup._getToolPath(newTaskResult.taskId);

                                        if (toolpath) {
                                            toolpath.onGenerateToolpathModel(newTaskResult.data[index], newTaskResult.filenames[index], renderResult);
                                        }
                                        break;
                                    }
                                    case 'progress': {
                                        const { progress } = value;
                                        dispatch(
                                            actions.updateState(headType, {
                                                stage: STEP_STAGE.CNC_LASER_RENDER_TOOLPATH,
                                                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_TOOLPATH, progress)
                                            })
                                        );
                                        break;
                                    }
                                    case 'err': {
                                        log.info('Rendering tool path... failed.');
                                        progressStatesManager.finishProgress(false);
                                        dispatch(
                                            baseActions.updateState(headType, {
                                                stage: STEP_STAGE.CNC_LASER_GENERATE_TOOLPATH_FAILED,
                                                progress: 1,
                                            })
                                        );
                                        resolve(false);
                                        break;
                                    }
                                    default:
                                        log.warn('Rendering tool path... unknown status.');
                                        break;
                                }
                            });
                        });

                        // await promise;
                        toolPathRenderPromises.push(promise);
                    }
                });

                await Promise.allSettled(toolPathRenderPromises);
            });

            controller.on('taskCompleted:generateGcode', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                dispatch(processActions.onGenerateGcode(headType, taskResult));
            });

            controller.on('taskCompleted:generateViewPath', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { progressStatesManager } = getState()[headType];
                progressStatesManager.startNextStep();
                dispatch(
                    actions.updateState(headType, {
                        stage: STEP_STAGE.CNC_LASER_RENDER_VIEWPATH,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_RENDER_VIEWPATH, 0)
                    })
                );
                dispatch(processActions.onGenerateViewPath(headType, taskResult));
            });

            controller.on('taskCompleted:cutModel', taskResult => {
                if (headType !== taskResult.headType) {
                    return;
                }
                const { cutModelInfo } = getState()[headType];
                dispatch(
                    actions.updateState(headType, {
                        cutModelInfo: {
                            ...cutModelInfo,
                            isProcessing: false,
                            svgInfo: taskResult.svgInfo,
                            stlInfo: taskResult.stlInfo
                        }
                    })
                );
            });
        };
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
    clearBackgroundImage: headType => (dispatch, getState) => {
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
    uploadImage: (headType, file, mode, onError, isLimit = true, fileInfo) => (dispatch, getState) => {
        const { materials, progressStatesManager } = getState()[headType];
        progressStatesManager.startProgress(PROCESS_STAGE.CNC_LASER_UPLOAD_IMAGE, [1, 1]);
        dispatch(
            actions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_UPLOADING_IMAGE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_UPLOADING_IMAGE, 0.25)
            })
        );
        const formData = new FormData();
        formData.append('image', file);
        formData.append('isRotate', materials.isRotate);
        if (fileInfo) {
            const { sourceWidth, sourceHeight, originalName, uploadName } = fileInfo;

            dispatch(
                actions.generateModel(headType, {
                    originalName,
                    uploadName,
                    sourceWidth,
                    sourceHeight,
                    mode,
                    config: { svgNodeName: 'image' },
                    isLimit
                })
            );
            return;
        }
        api.uploadImage(formData)
            .then(res => {
                const { sourceWidth, sourceHeight, originalName, uploadName } = res.body;
                dispatch(
                    actions.generateModel(headType, {
                        originalName,
                        uploadName,
                        sourceWidth: sourceWidth,
                        sourceHeight: sourceHeight,
                        mode,
                        config: { svgNodeName: 'image' },
                        isLimit
                    })
                );
            })
            .catch(err => {
                log.error(err);
                onError && onError(err);
                dispatch(
                    actions.updateState(headType, {
                        stage: STEP_STAGE.CNC_LASER_UPLOAD_IMAGE_FAILED,
                        progress: 1
                    })
                );
                progressStatesManager.finishProgress(false);
            });
    },

    checkIsOversizeImage: (headType, file, onError) => async (dispatch, getState) => {
        const { materials, progressStatesManager, coordinateSize } = getState()[headType];
        const formData = new FormData();
        formData.append('image', file);
        formData.append('isRotate', materials.isRotate);
        return new Promise((resolve) => {
            api.uploadImage(formData)
                .then(res => {
                    resolve(res.body);
                    // Ensure promise is completed first
                    setTimeout(() => {
                        const { sourceWidth, sourceHeight } = res.body;
                        const isOverSize = isOverSizeModel(coordinateSize, sourceWidth, sourceHeight);
                        dispatch(
                            actions.updateState(headType, {
                                isOverSize: isOverSize
                            })
                        );
                    });
                })
                .catch(err => {
                    resolve();
                    onError && onError(err);
                    dispatch(
                        actions.updateState(headType, {
                            stage: STEP_STAGE.CNC_LASER_UPLOAD_IMAGE_FAILED,
                            progress: 1
                        })
                    );
                    progressStatesManager.finishProgress(false);
                });
        });
    },

    prepareStlVisualizer: (headType, model) => dispatch => {
        const uploadPath = model.resource.originalFile.path;
        const worker = workerManager.loadModel(uploadPath, async data => {
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
                    if (model.image3dObj) {
                        // Before updating mesh, destroy the previous mesh
                        model.image3dObj.parent.remove(model.image3dObj);
                    }
                    model.image3dObj = mesh;
                    break;
                }
                case 'LOAD_MODEL_CONVEX': {
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
                    worker.then(pool => pool.terminate());
                    dispatch(
                        actions.updateState(headType, {
                            stage: STEP_STAGE.CNC_LASER_PREVIEW_FAILED,
                            progress: 0
                        })
                    );
                    break;
                }
                default:
                    break;
            }
        });
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
    generateModel: (
        headType,
        { originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, config, gcodeConfig, transformation, modelID, zIndex, isLimit }
    ) => async (dispatch, getState) => {
        const { size, promptDamageModel } = getState().machine;

        const { materials, modelGroup, SVGActions, contentGroup, toolPathGroup, coordinateMode, coordinateSize } = getState()[headType];
        sourceType = sourceType || getSourceType(originalName);
        if (!checkParams(headType, sourceType, mode)) {
            console.error(`sourceType or mode error, sourceType: ${sourceType}, mode: ${mode}`);
            return;
        }

        let isDamage = false;
        if (path.extname(uploadName).toLowerCase() === '.stl') {
            await controller.checkModel({
                uploadName
            }, (data) => {
                if (data.type === 'error') {
                    isDamage = true;
                } else if (data.type === 'success') {
                    isDamage = false;
                }
            });
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
            if (sourceType === SOURCE_TYPE.IMAGE3D) {
                const newModelSize = sizeModel(coordinateSize, materials, sourceWidth, sourceHeight);
                scale = newModelSize?.scale;
            }
        } else {
            const extname = path.extname(uploadName);
            const isScale = !includes(scaleExtname, extname);
            const newModelSize = sourceType !== SOURCE_TYPE.IMAGE3D
                ? limitModelSizeByMachineSize(coordinateSize, sourceWidth, sourceHeight, isLimit, isScale)
                : sizeModel(size, materials, sourceWidth, sourceHeight);
            width = newModelSize?.width;
            height = newModelSize?.height;
            scale = newModelSize?.scale;
        }

        if (`${headType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            width = 40;
            height = (40 * sourceHeight) / sourceWidth;
        }

        const defaultTransformation = {
            width,
            height
        };
        const coorDelta = {
            dx: (coordinateSize.x / 2) * coordinateMode.setting.sizeMultiplyFactor.x,
            dy: (coordinateSize.y / 2) * coordinateMode.setting.sizeMultiplyFactor.y
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
        model.setPreSelection(contentGroup.preSelectionGroup);
        model.needRepair = isDamage;
        const promptTasks = [];
        promptDamageModel && isDamage && promptTasks.push({
            status: 'need-repair-model',
            model
        });

        const operation = new AddOperation2D({
            toolPathGroup,
            svgActions: SVGActions,
            target: model
        });
        const operations = new CompoundOperation();
        operations.push(operation);

        dispatch(operationHistoryActions.setOperations(headType, operations));

        SVGActions.clearSelection();
        SVGActions.addSelectedSvgModelsByModels([model], materials.isRotate);

        if (path.extname(uploadName).toLowerCase() === '.stl') {
            dispatch(actions.prepareStlVisualizer(headType, model));
        }

        // Process image right after created
        // TODO processImage
        dispatch(actions.processSelectedModel(headType));
        dispatch(
            actions.updateState(headType, {
                stage: promptTasks.length ? STEP_STAGE.CNC_LASER_REPAIRING_MODEL : STEP_STAGE.EMPTY,
                isOverSize: null,
                promptTasks
            })
        );
    },

    insertDefaultTextVector: headType => dispatch => {
        api.convertTextToSvg({
            ...DEFAULT_TEXT_CONFIG
        }).then(async res => {
            // const { name, filename, width, height } = res.body;
            const { originalName, uploadName, sourceWidth, sourceHeight } = res.body;
            const sourceType = 'text';
            const mode = 'vector';

            dispatch(
                actions.generateModel(headType, {
                    originalName,
                    uploadName,
                    sourceWidth,
                    sourceHeight,
                    mode,
                    sourceType
                })
            );
        });
    },

    getMouseTargetByCoordinate: (headType, x, y) => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        const models = modelGroup.models;
        if (models.length > 0) {
            const svgDateElem = models[0].elem?.parentElement;
            const svgDateElemChilds = svgDateElem?.children ? Array.from(svgDateElem?.children) : [];
            if (svgDateElem && svgDateElemChilds) {
                const arr = models
                    .filter(model => {
                        return model.visible;
                    })
                    .sort((a, b) => {
                        return svgDateElemChilds.findIndex(elem => elem === b.elem) - svgDateElemChilds.findIndex(elem => elem === a.elem);
                    });
                const index = arr.findIndex(model => {
                    return isInside([x, y], model.vertexPoints);
                });
                return index === -1 ? null : arr[index]?.elem;
            }
            return null;
        }
        return null;
    },

    // TODO: method docs
    selectTargetModel: (headType: HeadType, model, isMultiSelect = false) => (dispatch, getState) => {
        const SVGActions: SVGActionsFactory = getState()[headType].SVGActions;
        const modelGroup: ModelGroup2D = getState()[headType].modelGroup;
        const workpiece: Workpiece = getState()[headType].workpiece;

        let selected = modelGroup.getSelectedModelArray();
        selected = [...selected];

        // remove all selected model
        dispatch(actions.clearSelection(headType));

        const isRotate = workpiece.shape === WorkpieceShape.Cylinder;

        if (!isMultiSelect) {
            SVGActions.addSelectedSvgModelsByModels([model], isRotate);
        } else {
            // if already selected, then unselect it
            if (selected.find(item => item === model)) {
                const selectedModels = selected.filter(item => item !== model);
                modelGroup.emptySelectedModelArray();
                SVGActions.addSelectedSvgModelsByModels(selectedModels, isRotate);
            } else {
                // add model to selection
                SVGActions.addSelectedSvgModelsByModels([...selected, model], isRotate);
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
        if (
            (selectedModel.mode === PROCESS_MODE_VECTOR && PROCESS_MODES_EXCEPT_VECTOR.includes(mode))
            || (PROCESS_MODES_EXCEPT_VECTOR.includes(selectedModel.mode) && mode === PROCESS_MODE_VECTOR)
        ) {
            const toolPaths = toolPathGroup.getToolPaths();
            toolPaths.forEach(item => {
                if (item.modelMap.has(selectedModel.modelID)) {
                    if (item.modelMap.size === 1) {
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
        dispatch(projectActions.autoSaveEnvironment(headType));
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
    updateSelectedModelUniformScalingState: (headType, uniformScalingState) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions.updateSelectedElementsUniformScalingState(uniformScalingState);

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
        dispatch(projectActions.autoSaveEnvironment(headType));
    },

    // TODO: temporary workaround for model image processing
    processSelectedModel: headType => async (dispatch, getState) => {
        const { materials, modelGroup, toolParams = {}, progressStatesManager } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length !== 1) {
            return;
        }
        const selectedModel = selectedModels[0];

        if (
            selectedModel.sourceType !== 'raster'
            && selectedModel.sourceType !== 'svg'
            && selectedModel.sourceType !== 'image3d'
            && selectedModel.config.svgNodeName !== 'text'
            && selectedModel.sourceType !== 'dxf'
        ) {
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
        dispatch(
            baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_PROCESSING_IMAGE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_PROCESSING_IMAGE, 0)
            })
        );

        dispatch(actions.resetProcessState(headType));

        controller.commitProcessImage({
            taskId: uuid(),
            headType: headType,
            data: options
        });
    },

    updateSVGClipping: (headType, newSVGClipping) => (dispatch, getState) => {
        const { svgClipping } = getState()[headType];
        dispatch(
            baseActions.updateState(headType, {
                svgClipping: {
                    ...svgClipping,
                    ...newSVGClipping
                }
            })
        );
    },

    clippingSelectedSVGModel: (headType, svgClippingOption) => (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState()[headType];

        const selectedModels = modelGroup.getSelectedModelArray();
        if (selectedModels.length < 1) {
            return;
        }

        const taskInfos = selectedModels.map(v => v.getTaskInfo());

        if (!progressStatesManager.inProgress()) {
            progressStatesManager.startProgress(PROCESS_STAGE.CNC_LASER_SVG_CLIPPING, [1]);
        } else {
            progressStatesManager.startNextStep();
        }

        dispatch(
            baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_SVG_CLIPPING,
                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_SVG_CLIPPING, 0.01)
            })
        );

        dispatch(actions.resetProcessState(headType));

        controller.commitSVGClipping({
            taskId: uuid(),
            headType: headType,
            data: {
                config: svgClippingOption,
                modelInfos: taskInfos
            }
        });
    },

    duplicateSelectedModel: headType => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathGroup } = getState()[headType];

        SVGActions.duplicateSelectedModel();

        const operations = new CompoundOperation();
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

    removeSelectedModelsByCallback: (headType, mode) => dispatch => {
        if (mode === 'draw') {
            dispatch(actions.drawDelete(headType));
        } else {
            dispatch(
                actions.updateState(headType, {
                    removingModelsWarningCallback: () => {
                        dispatch(actions.removeSelectedModel(headType, mode));
                    }
                })
            );
            dispatch(actions.checkToRemoveSelectedModels(headType));
        }
    },

    checkToRemoveSelectedModels: headType => (dispatch, getState) => {
        const { modelGroup, toolPathGroup, removingModelsWarningCallback } = getState()[headType];
        const { selectedModelIDArray, allModelIDs } = modelGroup.getState();
        const toolPaths = toolPathGroup.getToolPaths();
        const emptyToolPaths = [];
        toolPaths.forEach(item => {
            if (item.modelMap && item.modelMap.size) {
                for (const id of item.modelMap.keys()) {
                    if (!selectedModelIDArray.includes(id) && allModelIDs.includes(id)) {
                        return;
                    }
                }
                emptyToolPaths.push(item);
            }
        });
        if (emptyToolPaths.length === 0) {
            removingModelsWarningCallback();
            return;
        }

        dispatch(
            actions.updateState(headType, {
                removingModelsWarning: true,
                emptyToolPaths: emptyToolPaths
            })
        );
    },

    removeSelectedModel: headType => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathGroup } = getState()[headType];
        const operations = new CompoundOperation();
        for (const svgModel of modelGroup.getSelectedModelArray()) {
            const operation = new DeleteOperation2D({
                target: svgModel,
                svgActions: SVGActions,
                toolPathGroup,
                toolPaths: toolPathGroup.toolPaths.filter(item => {
                    if (item.modelMap.has(svgModel.modelID)) {
                        item.modelMap.delete(svgModel.modelID);
                        return true;
                    }
                    return false;
                })
            });
            operations.push(operation);
        }

        const { selectedModelIDArray } = modelGroup.getState();
        const toolPaths = toolPathGroup.getToolPaths();
        toolPaths.forEach(item => {
            for (const id of selectedModelIDArray) {
                if (item.modelMap.has(id)) {
                    item.modelMap.delete(id);
                }
            }
        });

        SVGActions.deleteSelectedElements();
        const modelState = modelGroup.removeSelectedModel();

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(
            baseActions.updateState(headType, {
                ...modelState
            })
        );
        if (!modelState.hasModel) {
            dispatch(
                baseActions.updateState(headType, {
                    displayedType: DISPLAYED_TYPE_MODEL,
                    needToPreview: true,
                    stage: STEP_STAGE.EMPTY,
                    progress: 0
                })
            );
        }
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
    },

    removeEmptyToolPaths: headType => (dispatch, getState) => {
        const { emptyToolPaths, toolPathGroup } = getState()[headType];
        emptyToolPaths.forEach(item => {
            toolPathGroup.deleteToolPath(item.id);
        });
        dispatch(
            baseActions.updateState(headType, {
                emptyToolPaths: []
            })
        );
        dispatch(baseActions.render(headType));
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

        if (model.sourceType === SOURCE_TYPE.IMAGE3D) {
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

        if (model.resource.processedFile && model.resource.processedFile.name) {
            const operation = new UpdateHrefOperation2D({
                target: model,
                svgActions: SVGActions,
                fromHref: model.resource.processedFile.name,
                toHref: processImageName
            });
            const operations = new CompoundOperation();
            operations.push(operation);
            dispatch(operationHistoryActions.setOperations(headType, operations));
        }

        model.updateProcessImageName(processImageName);
        SVGActions.updateSvgModelImage(model, processImageName);

        dispatch(baseActions.resetCalculatedState(headType));
        dispatch(baseActions.render(headType));

        dispatch(
            baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_PROCESSING_IMAGE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_PROCESSING_IMAGE, 1)
            })
        );
        progressStatesManager.finishProgress(true);
    },

    /**
     * Callback function trigger by event when image processed.
     *
     * @param headType
     * @param taskResult
     * @returns {Function}
     */
    onReceiveSVGClippingTaskResult: (headType, taskResult) => async (dispatch, getState) => {
        // const { SVGActions, modelGroup, progressStatesManager, materials } = getState()[headType];
        const { progressStatesManager, history, toolPathGroup } = getState()[headType];
        // const { machine } = getState();

        if (taskResult.taskStatus === 'failed') {
            dispatch(
                baseActions.updateState(headType, {
                    stage: STEP_STAGE.CNC_LASER_SVG_CLIPPING,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_SVG_CLIPPING, 1)
                })
            );
            progressStatesManager.finishProgress(false);
            return;
        }

        const { config } = taskResult.data;

        const { result } = taskResult;
        if (!result || result.length <= 0) {
            return;
        }

        let historyCount = 0;

        if (config.type === SVGClippingType.Union || config.type === SVGClippingType.Clip) {
            dispatch(actions.removeSelectedModel(headType));
            const toolPaths = toolPathGroup.getToolPaths();
            toolPaths.forEach(item => {
                if (item.modelMap.size === 0) {
                    toolPathGroup.deleteToolPath(item.id);
                }
            });
            historyCount++;
        }

        for (let i = 0; i < result.length; i++) {
            const res = result[i];

            // const { modelID, resultType, sourceWidth, sourceHeight, baseWidth, baseHeight, transformation, filename } = res;
            const { resultType, sourceWidth, sourceHeight, transformation, filename } = res;

            if (resultType === SVGClippingResultType.Add) {
                dispatch(actions.generateModel(headType, {
                    originalName: filename,
                    uploadName: filename,
                    sourceWidth,
                    sourceHeight,
                    mode: 'vector',
                    sourceType: 'svg',
                    transformation: {
                        ...transformation
                    }
                }));
            }
        }

        historyCount += result.length;

        const operations = new CompoundOperation();
        for (let i = 0; i < historyCount; i++) {
            const pop = history.pop();
            operations.push(pop);
        }
        dispatch(operationHistoryActions.setOperations(headType, operations));

        dispatch(actions.clearSelection(headType));

        dispatch(baseActions.resetCalculatedState(headType));
        dispatch(baseActions.render(headType));

        dispatch(
            baseActions.updateState(headType, {
                stage: STEP_STAGE.CNC_LASER_SVG_CLIPPING,
                progress: progressStatesManager.updateProgress(STEP_STAGE.CNC_LASER_SVG_CLIPPING, 1)
            })
        );
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

    getSelectedModel: headType => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        return modelGroup.getSelectedModel();
    },

    bringSelectedModelToFront: (headType, svgModel) => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        SVGActions.bringElementToFront(svgModel?.elem);
        modelGroup.bringSelectedModelToFront(svgModel);
    },

    sendSelectedModelToBack: headType => (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        SVGActions.sendElementToBack();
        modelGroup.sendSelectedModelToBack();
    },

    arrangeAllModels2D: headType => (dispatch, getState) => {
        const { modelGroup } = getState()[headType];
        modelGroup.arrangeAllModels2D();
        modelGroup.onModelTransform();
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
        const operations = new CompoundOperation();
        operations.push(operation);

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(
            baseActions.updateState(headType, {
                isChangedAfterGcodeGenerating: true
            })
        );
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
        const operations = new CompoundOperation();
        operations.push(operation);

        dispatch(operationHistoryActions.setOperations(headType, operations));
        dispatch(
            baseActions.updateState(headType, {
                isChangedAfterGcodeGenerating: true
            })
        );
        dispatch(actions.resetProcessState(headType));
        dispatch(baseActions.render(headType));
    },

    /**
     * Reset process state after model changes
     */
    resetProcessState: headType => dispatch => {
        dispatch(
            baseActions.updateState(headType, {
                simulationNeedToPreview: true,
                displayedType: DISPLAYED_TYPE_MODEL,
                needToPreview: true
            })
        );
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
            newSVGModel.refresh();
            const operation = new AddOperation2D({
                toolPathGroup,
                svgActions: SVGActions,
                target: newSVGModel
            });
            const operations = new CompoundOperation();
            operations.push(operation);
            dispatch(operationHistoryActions.setOperations(headType, operations));
        }

        dispatch(actions.resetProcessState(headType));
    },

    selectAllElements: headType => async (dispatch, getState) => {
        const { SVGActions, SVGCanvasMode, SVGCanvasExt, materials } = getState()[headType];
        if (SVGCanvasMode === 'draw' || SVGCanvasExt.elem) {
            await SVGActions.svgContentGroup.exitModelEditing(true);
            dispatch(actions.selectAllElements(headType));
            // SVGActions.selectAllElements();
            // dispatch(baseActions.render(headType));
        } else {
            SVGActions.selectAllElements(materials.isRotate);
            dispatch(baseActions.render(headType));
        }
    },

    cut: headType => dispatch => {
        dispatch(
            actions.updateState(headType, {
                removingModelsWarningCallback: () => {
                    dispatch(actions.copy(headType));
                    dispatch(actions.removeSelectedModel(headType));
                }
            })
        );
        dispatch(actions.checkToRemoveSelectedModels(headType));
    },

    copy: headType => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions.copy();
        dispatch(baseActions.render(headType));
    },

    paste: headType => (dispatch, getState) => {
        const { modelGroup, SVGActions, toolPathGroup } = getState()[headType];

        SVGActions.paste();

        const operations = new CompoundOperation();
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
        const { SVGActions, materials } = getState()[headType];
        const isRotate = materials.isRotate;
        SVGActions.selectElements(elements, isRotate);

        dispatch(baseActions.render(headType));
    },

    /**
     * Clear selection of models.
     */
    clearSelection: headType => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        if (SVGActions.svgContentGroup.drawGroup.mode) {
            SVGActions.svgContentGroup.exitModelEditing(true);
            return;
        }
        SVGActions.clearSelection();
        dispatch(baseActions.render(headType));
    },

    isSelectedAllVisible: headType => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        const selectedElements = SVGActions.getSelectedElements();
        const allVisible = selectedElements.every(elem => {
            return elem.getAttribute('display') !== 'none';
        });
        if (allVisible) {
            return selectedElements;
        } else {
            return false;
        }
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

        const operations = new CompoundOperation();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (whetherTransformed(tmpTransformationState[element.id], svgModel.transformation)) {
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

        const operations = new CompoundOperation();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (whetherTransformed(tmpTransformationState[element.id], svgModel.transformation)) {
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
    moveElementsOnKeyUp: headType => (dispatch, getState) => {
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

        recordScaleActionsToHistory(
            () => {
                SVGActions.resizeElementsFinish(elements, options);
            },
            elements,
            SVGActions,
            headType,
            machine,
            dispatch
        );

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

        recordScaleActionsToHistory(
            () => {
                SVGActions.resizeElementsImmediately(elements, options);
            },
            elements,
            SVGActions,
            headType,
            machine,
            dispatch
        );

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

        recordScaleActionsToHistory(
            () => {
                SVGActions.flipElementsHorizontally(elements);
            },
            elements,
            SVGActions,
            headType,
            machine,
            dispatch
        );

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

        recordScaleActionsToHistory(
            () => {
                SVGActions.flipElementsVertically(elements);
            },
            elements,
            SVGActions,
            headType,
            machine,
            dispatch
        );

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

        recordScaleActionsToHistory(
            () => {
                SVGActions.resetFlipElements(elements);
            },
            elements,
            SVGActions,
            headType,
            machine,
            dispatch
        );

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
    getSelectedElementsUniformScalingState: headType => (dispatch, getState) => {
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rotateElementsFinish: (headType, elements, options = {}) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        const { machine } = getState();

        const tmpTransformationState = {};
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            tmpTransformationState[element.id] = { ...svgModel.transformation };
        }

        SVGActions.rotateElementsFinish(elements);

        const operations = new CompoundOperation();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (whetherTransformed(tmpTransformationState[element.id], svgModel.transformation)) {
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

        const operations = new CompoundOperation();
        for (const element of elements) {
            const svgModel = SVGActions.getSVGModelByElement(element);
            if (whetherTransformed(tmpTransformationState[element.id], svgModel.transformation)) {
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
            x: (coordinateSize.x / 2) * coordinateMode.setting.sizeMultiplyFactor.x,
            y: (-coordinateSize.y / 2) * coordinateMode.setting.sizeMultiplyFactor.y
        };
        return SVGActions.createText(content, position);
    },

    /**
     * Modify text element.
     */
    modifyText: (headType, element, options) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        SVGActions.modifyText(element, options);
        dispatch(projectActions.autoSaveEnvironment(headType));
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
     * Initialize workpiece for new project.
     *
     * Set default workpiece.
     */
    initializeWorkpiece: (headType: HeadType, options: { isRotate: boolean }) => {
        return async (dispatch, getState) => {
            const isRotate = options.isRotate;

            const activeMachine: Machine = getState().machine.activeMachine;
            if (!isRotate) {
                await dispatch(actions.setWorkpiece(
                    headType,
                    WorkpieceShape.Rectangle,
                    {
                        x: activeMachine.metadata.size.x,
                        y: activeMachine.metadata.size.y,
                        z: activeMachine.metadata.size.z,
                    }
                ));
                await dispatch(actions.updateWorkpieceObject(headType));
            } else {
                await dispatch(actions.setWorkpiece(
                    headType,
                    WorkpieceShape.Cylinder,
                    {
                        diameter: 40,
                        length: 75,
                    }
                ));
                await dispatch(actions.updateWorkpieceObject(headType));
            }
        };
    },

    initializeOrigin: (headType: HeadType) => {
        return async (dispatch, getState) => {
            const activeMachine: Machine = getState().machine.activeMachine;
            const workpiece: Workpiece = getState()[headType].workpiece;
            const origin: Origin = getState()[headType].origin;

            // origin type
            let originType = origin.type;

            const originTypeOptions = getOriginTypeOptions(workpiece.shape);
            if (!originTypeOptions.find(option => option.value === originType)) {
                originType = originTypeOptions[0].value;
            }

            // origin reference
            let originReference = origin.reference;
            const originReferenceOptions = getOriginReferenceOptions(workpiece.shape, originType);
            if (!originReferenceOptions.find(option => option.value === originReference)) {
                originReference = originReferenceOptions[0].mode.value as OriginReference;
            }

            await dispatch(actions.setOrigin(
                headType,
                {
                    type: originType,
                    reference: originReference,
                    referenceMetadata: {},
                }
            ));

            // TODO: Refactor code below
            // get mode as well
            const targetOption = originReferenceOptions.find(option => option.value === originReference);

            if (workpiece.shape === WorkpieceShape.Rectangle) {
                await dispatch(actions.changeCoordinateMode(
                    headType,
                    targetOption.mode,
                    {
                        x: activeMachine.metadata.size.x,
                        y: activeMachine.metadata.size.y,
                    }
                ));
            } else {
                dispatch(actions.changeCoordinateMode(
                    HEAD_LASER,
                    targetOption.mode,
                    {
                        x: (workpiece.size as CylinderWorkpieceSize).diameter * Math.PI,
                        y: (workpiece.size as CylinderWorkpieceSize).length,
                    }
                ));
            }
        };
    },

    /**
     * Change Coordinate Mode
     *
     * @param headType
     * @param coordinateMode
     * @param coordinateSize
     */
    changeCoordinateMode: (headType, coordinateMode = null, coordinateSize = null) => (dispatch, getState) => {
        // deal with default coordinate size
        if (!coordinateSize) {
            const activeMachine = getState().machine.activeMachine as Machine;
            coordinateSize = coordinateSize ?? {
                x: activeMachine.metadata.size.x,
                y: activeMachine.metadata.size.y,
            };
        }

        // deal with default coordinate mode
        const oldCoordinateMode = getState()[headType].coordinateMode;
        coordinateMode = coordinateMode ?? oldCoordinateMode;

        if (coordinateMode.value !== oldCoordinateMode.value) {
            // move all elements
            const coorDelta = {
                dx: 0,
                dy: 0,
            };
            if (oldCoordinateMode.value !== COORDINATE_MODE_BOTTOM_CENTER.value) {
                coorDelta.dx -= (coordinateSize.x / 2) * oldCoordinateMode.setting.sizeMultiplyFactor.x;
                coorDelta.dy += (coordinateSize.y / 2) * oldCoordinateMode.setting.sizeMultiplyFactor.y;
            }

            if (coordinateMode.value !== COORDINATE_MODE_BOTTOM_CENTER.value) {
                coorDelta.dx += (coordinateSize.x / 2) * coordinateMode.setting.sizeMultiplyFactor.x;
                coorDelta.dy -= (coordinateSize.y / 2) * coordinateMode.setting.sizeMultiplyFactor.y;
            }

            const SVGActions = getState()[headType].SVGActions as SVGActionsFactory;
            const elements = SVGActions.getAllModelElements();
            SVGActions.moveElementsStart(elements);
            SVGActions.moveElements(elements, coorDelta);
            SVGActions.moveElementsFinish(elements);
            SVGActions.clearSelection();
            dispatch(baseActions.render(headType));
        }

        dispatch(actions.resetProcessState(headType));
        dispatch(
            actions.updateState(headType, {
                coordinateMode,
                coordinateSize,
            })
        );
    },

    /**
     * Configure Workpiece.
     *
     * - Update modelGroup & toolPathGroup
     * - Update Canvas (watched by SMCanvas)
     */
    updateWorkpieceObject: (headType: HeadType) => {
        return (dispatch, getState) => {
            const modelGroup = getState()[headType].modelGroup as ModelGroup;
            const toolPathGroup = getState()[headType].toolPathGroup as ToolPathGroup;

            const materials = getState()[headType].materials as Materials;
            // const origin = getState()[headType].origin as Origin;

            if (materials.isRotate) {
                materials.x = round(materials.diameter * Math.PI, 2);
                materials.y = materials.length;
            } else {
                // allMaterials.x = 0;
                // allMaterials.y = 0;
            }
            modelGroup.setMaterials(materials);

            toolPathGroup.updateMaterials(materials);
            toolPathGroup.showSimulationObject(false);

            // Update again in case x and y are re-calculated
            dispatch(
                baseActions.updateState(headType, {
                    materials: {
                        ...materials
                    },
                    showSimulation: false,
                })
            );
        };
    },

    /**
     * Configure workpiece.
     */
    setWorkpiece: (headType: HeadType, shape: WorkpieceShape, size: RectangleWorkpieceSize | CylinderWorkpieceSize) => {
        return (dispatch) => {
            // Update workpiece object, without further validation
            dispatch(actions.updateState(headType, {
                workpiece: {
                    shape: shape,
                    size: size,
                }
            }));

            dispatch(actions.updateState(headType, {
                materials: {
                    isRotate: shape === WorkpieceShape.Cylinder,
                    diameter: (size as CylinderWorkpieceSize).diameter,
                    length: (size as CylinderWorkpieceSize).length,
                    x: (size as RectangleWorkpieceSize).x,
                    y: (size as RectangleWorkpieceSize).y,
                    z: (size as RectangleWorkpieceSize).z,
                }
            }));
        };
    },

    setOrigin: (headType: HeadType, origin: Origin) => {
        return (dispatch, getState) => {
            dispatch(actions.updateState(headType, {
                origin,
            }));

            machineStore.set(`${headType}.origin.type`, origin.type);
            machineStore.set('origin.reference', origin.reference);

            // Update origin of tool path object
            const toolPathGroup = getState()[headType].toolPathGroup as ToolPathGroup;
            toolPathGroup.setOrigin(origin);
        };
    },

    /**
     * Set job offset mode.
     *
     * Using crosshair to set origin, or use laser spot to set origin.
     *
     * Note that this is only used by ray machine now.
     */
    setJobOffsetMode: (jobOffsetMode: JobOffsetMode) => {
        return (dispatch) => {
            dispatch(actions.updateState(HEAD_LASER, {
                jobOffsetMode,
            }));

            machineStore.set('job-offset-mode', jobOffsetMode);
        };
    },

    scaleCanvasToFit: headType => (dispatch, getState) => {
        const { coordinateSize } = getState()[headType];
        const longestEdge = Math.max(coordinateSize.x, coordinateSize.y);
        if (longestEdge > 0) {
            let newScale = (350 / longestEdge) * 0.6;
            if (newScale < MIN_LASER_CNC_CANVAS_SCALE) {
                newScale = MIN_LASER_CNC_CANVAS_SCALE;
            }
            if (newScale > MAX_LASER_CNC_CANVAS_SCALE) {
                newScale = MAX_LASER_CNC_CANVAS_SCALE;
            }
            dispatch(
                actions.updateState(headType, {
                    scale: newScale
                })
            );
        }
    },

    importStackedModelSVG: headType => (dispatch, getState) => {
        const {
            cutModelInfo: { svgInfo },
            coordinateSize
        } = getState()[headType];
        const mode = PROCESS_MODE_VECTOR;
        svgInfo.forEach((svgFileInfo, index) => {
            let width = svgFileInfo.width,
                height = svgFileInfo.height;
            if (width > coordinateSize.x) {
                height *= coordinateSize.x / width;
                width = coordinateSize.x;
            }
            if (height > coordinateSize.y) {
                width *= coordinateSize.y / height;
                height = coordinateSize.y;
            }
            const uploadName = svgFileInfo.filename,
                originalName = `${index}.svg`;
            dispatch(
                actions.generateModel(headType, {
                    originalName,
                    uploadName,
                    sourceWidth: width,
                    sourceHeight: height,
                    mode,
                    sourceType: undefined,
                    config: { svgNodeName: 'image' }
                })
            );
        });
    },

    generateModelStack: (headType, modelWidth, modelHeight, thickness, scale = 1) => (dispatch, getState) => {
        const { materials, cutModelInfo, coordinateSize } = getState()[headType];
        const options = {
            // modelID: 'id56746944-1822-4d80-a566-64614921906a',
            // modelName: cutModelInfo.originalName,
            // headType: headType,
            // sourceType: SOURCE_TYPE.IMAGE3D,
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
        dispatch(
            actions.updateState(headType, {
                cutModelInfo: {
                    ...cutModelInfo,
                    isProcessing: true
                }
            })
        );
        controller.commitCutModelTask({
            taskId: uuid(),
            headType: headType,
            data: options
        });
    },

    cancelCutModel: () => () => {
        controller.cancelCutModelTask();
    },

    cutModel: (headType, file, onError) => (dispatch, getState) => {
        const { progressStatesManager, coordinateSize } = getState()[headType];
        progressStatesManager.startProgress(PROCESS_STAGE.LASER_CUT_STL);
        dispatch(
            actions.updateState(headType, {
                stage: STEP_STAGE.LASER_CUTTING_STL,
                progress: progressStatesManager.updateProgress(STEP_STAGE.LASER_CUTTING_STL, 0.25)
            })
        );
        const formData = new FormData();
        formData.append('file', file);

        api.uploadFile(formData)
            .then(res => {
                const { originalName, uploadName } = res.body;
                new ModelLoader().load(
                    `${DATA_PREFIX}/${uploadName}`,
                    geometry => {
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

                            let scale = 1;
                            const MAX_Z = 500;
                            const canvasRange = {
                                x: coordinateSize.x,
                                y: coordinateSize.y,
                                z: MAX_Z
                            };
                            if (box3.max.x - box3.min.x > canvasRange.x || box3.max.y - box3.min.y > canvasRange.y) {
                                const _scale = findSuitableScale(Infinity, canvasRange);
                                scale = 0.9 * _scale;
                                geometry.scale(scale, scale, scale);
                                geometry.computeBoundingBox();
                                box3 = geometry.boundingBox;
                                modelInitSize = {
                                    x: box3.max.x - box3.min.x,
                                    y: box3.max.y - box3.min.y,
                                    z: box3.max.z - box3.min.z
                                };
                            }
                            dispatch(
                                actions.updateState(headType, {
                                    showImportStackedModelModal: true,
                                    cutModelInfo: {
                                        originalName,
                                        uploadName,
                                        modelInitSize,
                                        initScale: scale
                                    }
                                })
                            );
                            dispatch(
                                actions.updateState(headType, {
                                    stage: STEP_STAGE.LASER_CUTTING_STL,
                                    progress: progressStatesManager.updateProgress(STEP_STAGE.LASER_CUTTING_STL, 1)
                                })
                            );
                            progressStatesManager.finishProgress(true);
                        } else {
                            throw new Error('geometry invalid');
                        }
                    },
                    noop, // onprogress
                    err => {
                        onError && onError(err);
                        dispatch(
                            actions.updateState(headType, {
                                stage: STEP_STAGE.LASER_CUT_STL_SUCCEED,
                                progress: 1
                            })
                        );
                        progressStatesManager.finishProgress(false);
                    }
                );
            })
            .catch(err => {
                onError && onError(err);
                dispatch(
                    actions.updateState(headType, {
                        stage: STEP_STAGE.LASER_CUT_STL_FAILED,
                        progress: 1
                    })
                );
                progressStatesManager.finishProgress(true);
            });
    },

    setShortcutStatus: (headType, enabled) => dispatch => {
        dispatch(
            actions.updateState(headType, {
                enableShortcut: enabled
            })
        );
    },

    drawLine: (headType, line, closedLoop) => (dispatch, getState) => {
        const { contentGroup, history } = getState()[headType];

        const operations = new CompoundOperation();
        const operation = new DrawLine({
            target: line,
            closedLoop,
            drawGroup: contentGroup.drawGroup
        });
        operations.push(operation);

        history.push(operations);
        dispatch(
            actions.updateState(headType, {
                history
            })
        );
    },
    drawDelete: (headType) => {
        return (dispatch, getState) => {
            const { contentGroup, history } = getState()[headType];

            const deletedLineEles = contentGroup.drawGroup.onDelete();
            if (deletedLineEles.length > 0) {
                const operations = new CompoundOperation();
                const operation = new DrawDelete({
                    target: deletedLineEles,
                    drawGroup: contentGroup.drawGroup
                });
                operations.push(operation);
                history.push(operations);
                dispatch(
                    actions.updateState(headType, {
                        history
                    })
                );
            }
        };
    },
    drawTransform: (headType, before, after) => (dispatch, getState) => {
        const { contentGroup, history } = getState()[headType];

        const operations = new CompoundOperation();
        const operation = new DrawTransform({
            before,
            after,
            drawGroup: contentGroup.drawGroup
        });
        operations.push(operation);
        history.push(operations);
        dispatch(
            actions.updateState(headType, {
                history
            })
        );
    },
    drawTransformComplete: (headType, elem, before, after) => (dispatch, getState) => {
        const { contentGroup, history, SVGActions } = getState()[headType];
        history.filter((operations) => {
            return !operations.operations.some(operation => {
                return operation instanceof DrawLine
                    || operation instanceof DrawDelete
                    || operation instanceof DrawTransform
                    || operation instanceof DrawStart;
            });
        });

        if (before !== after) {
            const model = SVGActions.getSVGModelByElement(elem);
            if (after === '') {
                // delete model
                SVGActions.clearSelection();
                SVGActions.addSelectedSvgModelsByModels([model]);
                dispatch(actions.removeSelectedModelsByCallback(headType, 'select'));
                return;
            }
            const operations = new CompoundOperation();
            const operation = new DrawTransformComplete({
                svgModel: model,
                before,
                after,
                drawGroup: contentGroup.drawGroup
            });
            operations.push(operation);
            history.push(operations);

            SvgModel.completeElementTransform(elem);
            model.onTransform();
            model.updateSource();

            dispatch(
                actions.updateState(headType, {
                    history
                })
            );
            dispatch(actions.resetProcessState(headType));
            dispatch(projectActions.autoSaveEnvironment(headType));
        }
    },
    drawStart: (headType, elem) => (dispatch, getState) => {
        const { contentGroup } = getState()[headType];

        const history = getState()[headType].history as OperationHistory;

        const latestOperation = history.get();
        if (latestOperation && latestOperation.getItem(0) instanceof DrawStart) {
            return;
        }

        const operations = new CompoundOperation();
        const operation = new DrawStart({
            elemID: elem ? elem.getAttribute('id') : '',
            contentGroup
        });
        operations.push(operation);

        history.push(operations);
        dispatch(
            actions.updateState(headType, {
                history
            })
        );
    },
    drawComplete: (headType, elem) => (dispatch, getState) => {
        const { history } = getState()[headType];

        if (elem) {
            history.filter((operations) => {
                return !operations.operations.some(operation => {
                    return operation instanceof DrawLine
                        || operation instanceof DrawDelete
                        || operation instanceof DrawTransform
                        || operation instanceof DrawStart;
                });
            });
            dispatch(
                actions.updateState(headType, {
                    history
                })
            );
            dispatch(actions.createModelFromElement(headType, elem, true));
            dispatch(actions.resetProcessState(headType));
        }
    },

    boxSelect: (headType, bbox, onlyContainSelect) => async (dispatch, getState) => {
        const { modelGroup, SVGActions } = getState()[headType];
        const { size } = getState().machine;

        const models = modelGroup.models;
        workerManager.boxSelect(
            {
                bbox,
                modelsBbox: models.map(model => {
                    const { width, height } = model.transformation;
                    return {
                        width,
                        height,
                        vertexPoints: model.vertexPoints,
                        visible: model.visible
                    };
                }),
                onlyContainSelect,
                size
            },
            indexs => {
                if (indexs.length > 0) {
                    let selectedEles = [];
                    const selectedModels = indexs.map(index => {
                        selectedEles = [...selectedEles, models[index].elem];
                        dispatch(actions.bringSelectedModelToFront(headType, models[index]));
                        return models[index];
                    });
                    SVGActions.setSelectedSvgModelsByModels(selectedModels);
                } else {
                    dispatch(actions.clearSelection(headType));
                }
            }
        );
        dispatch(baseActions.render(headType));
    },

    isPointInSelectArea: (headType, x, y) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];

        return SVGActions.isPointInSelectArea([x, y]);
    },

    setCanvasMode: (headType, mode, ext) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        if (!ext) {
            ext = {};
        }
        if (mode === 'draw' || ext?.elem) {
            SVGActions.svgContentGroup.operatorPoints.showOperator(false);
        } else {
            SVGActions.svgContentGroup.operatorPoints.showOperator(true);
            SVGActions.clearSelection();
        }
        dispatch(
            baseActions.updateState(headType, {
                SVGCanvasMode: mode,
                SVGCanvasExt: ext
            })
        );
    },

    onRouterWillLeave: headType => async (dispatch, getState) => {
        const { SVGActions, SVGCanvasMode, SVGCanvasExt } = getState()[headType];

        if (SVGCanvasMode === 'draw' || SVGCanvasExt.elem) {
            await SVGActions.svgContentGroup.exitModelEditing(true);
        }
    },

    repairSelectedModels: (headType) => async (dispatch, getState) => {
        const { modelGroup } = getState()[headType];

        const res = await dispatch(appGlobalActions.repairSelectedModels(headType));
        const { results } = res;
        results.forEach((data) => {
            const model = modelGroup.findModelByID(data.modelID);
            model.needRepair = false;
            model.resource.originalFile.path = `/data/Tmp/${data.uploadName}`;
            dispatch(actions.prepareStlVisualizer(headType, model));
        });

        dispatch(
            baseActions.updateState(headType, {
                displayedType: DISPLAYED_TYPE_MODEL,
                needToPreview: true,
                page: PAGE_EDITOR
            })
        );
    },

    updateEditorState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    }
};

export default function reducer(state = DEFAULT_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default: return state;
    }
    // return {};
}
