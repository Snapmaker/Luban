import * as THREE from 'three';
import path from 'path';
import { isNil } from 'lodash';
// import FileSaver from 'file-saver';
import LoadModelWorker from '../../workers/LoadModel.worker';
import GcodeToBufferGeometryWorker from '../../workers/GcodeToBufferGeometry.worker';
import { ABSENT_OBJECT, EPSILON, DATA_PREFIX, PRINTING_MANAGER_TYPE_MATERIAL } from '../../constants';
import { timestamp } from '../../../shared/lib/random-utils';


import i18n from '../../lib/i18n';
import definitionManager from './DefinitionManager';
import api from '../../api';
import ModelGroup from '../../models/ModelGroup';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import ModelExporter from '../../ui/widgets/PrintingVisualizer/ModelExporter';
import { controller } from '../../lib/controller';

const isDefaultQualityDefinition = (definitionId) => {
    return definitionId.indexOf('quality') !== -1
        && (definitionId.indexOf('fast_print') !== -1
            || definitionId.indexOf('high_quality') !== -1
            || definitionId.indexOf('normal_quality') !== -1
        );
};

const defaultDefinitionKeys = {
    material: {
        definitions: 'materialDefinitions',
        id: 'defaultMaterialId'
    },
    quality: {
        definitions: 'qualityDefinitions',
        id: 'defaultQualityId'
    }
};
// eslint-disable-next-line no-unused-vars
/*
const customCompareTransformation = (tran1, tran2) => {
    const { positionX: px1, positionZ: pz1, rotationX: rx1, rotationY: ry1, rotationZ: rz1, scaleX: sx1, scaleY: sy1, scaleZ: sz1 } = tran1;
    const { positionX: px2, positionZ: pz2, rotationX: rx2, rotationY: ry2, rotationZ: rz2, scaleX: sx2, scaleY: sy2, scaleZ: sz2 } = tran2;
    return (
        Math.abs(px1 - px2) < EPSILON
        && Math.abs(pz1 - pz2) < EPSILON
        && Math.abs(rx1 - rx2) < EPSILON
        && Math.abs(ry1 - ry2) < EPSILON
        && Math.abs(rz1 - rz2) < EPSILON
        && Math.abs(sx1 - sx2) < EPSILON
        && Math.abs(sy1 - sy2) < EPSILON
        && Math.abs(sz1 - sz2) < EPSILON
    );
};
*/

export const PRINTING_STAGE = {
    EMPTY: 0,
    LOADING_MODEL: 1,
    LOAD_MODEL_SUCCEED: 2,
    LOAD_MODEL_FAILED: 3,
    SLICE_PREPARING: 4,
    SLICING: 5,
    SLICE_SUCCEED: 6,
    SLICE_FAILED: 7,
    PREVIEWING: 8,
    PREVIEW_SUCCEED: 9,
    PREVIEW_FAILED: 10
};

const INITIAL_STATE = {
    // printing configurations
    materialDefinitions: [],
    qualityDefinitions: [],
    isRecommended: true, // Using recommended settings
    defaultMaterialId: 'material.pla',
    defaultQualityId: '',
    // Active definition
    // Hierarchy: FDM Printer -> Snapmaker -> Active Definition (combination of machine, material, adhesion configurations)
    activeDefinition: ABSENT_OBJECT,

    // Stage reflects current state of visualizer
    stage: PRINTING_STAGE.EMPTY,

    selectedModelIDArray: [],
    selectedModelArray: [],
    modelGroup: new ModelGroup('printing'),

    // G-code
    gcodeFile: null,
    printTime: 0,
    filamentLength: 0,
    filamentWeight: 0,
    gcodeLineGroup: new THREE.Group(),
    gcodeLine: null,
    layerCount: 0,
    layerCountDisplayed: 0,
    gcodeTypeInitialVisibility: {},

    // progress bar
    progress: 0,
    inProgress: false,

    // selected model transformation
    transformation: {
        positionX: 0,
        positionZ: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        uniformScalingState: true
    },

    // snapshots state
    undoSnapshots: [{ models: [] }], // snapshot { models }
    redoSnapshots: [], // snapshot { models }
    canUndo: false,
    canRedo: false,

    // modelGroup state
    hasModel: false,
    isAnyModelOverstepped: false,
    // model: null, // selected model
    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model

    // PrintingManager
    showPrintingManager: false,
    managerDisplayType: PRINTING_MANAGER_TYPE_MATERIAL,

    // others
    transformMode: 'translate', // translate/scale/rotate
    isGcodeOverstepped: false,
    displayedType: 'model', // model/gcode

    // temp
    renderingTimestamp: 0
};


const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';
const ACTION_UPDATE_TRANSFORMATION = 'printing/ACTION_UPDATE_TRANSFORMATION';

// TODO: invest worker thread memory costs
const gcodeRenderingWorker = new GcodeToBufferGeometryWorker();

// avoid parallel loading of same file
const createLoadModelWorker = (() => {
    const runningTasks = {};
    return (uploadPath, onMessage) => {
        let task = runningTasks[uploadPath];
        if (!task) {
            task = {
                worker: new LoadModelWorker(),
                cbOnMessage: []
            };
            task.worker.postMessage({ uploadPath });
            task.worker.onmessage = async (e) => {
                const data = e.data;
                const { type } = data;

                switch (type) {
                    case 'LOAD_MODEL_CONVEX':
                    case 'LOAD_MODEL_FAILED':
                        task.worker.terminate();
                        delete runningTasks[uploadPath];
                        break;
                    default:
                        break;
                }
                for (const fn of task.cbOnMessage) {
                    if (typeof fn === 'function') {
                        fn(e);
                    }
                }
            };
            runningTasks[uploadPath] = task;
        }

        task.cbOnMessage.push(onMessage);
    };
})();

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    updateTransformation: (transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            transformation
        };
    },

    render: () => (dispatch) => {
        dispatch(actions.updateState(
            {
                renderingTimestamp: +new Date()
            }
        ));
    },
    // Use for switch machine size
    switchSize: () => async (dispatch, getState) => {
        // state
        const printingState = getState().printing;
        const { modelGroup, gcodeLineGroup } = printingState;
        const { series, size } = getState().machine;
        await definitionManager.init(series);
        dispatch(actions.updateState({
            activeDefinition: definitionManager.activeDefinition
        }));
        dispatch(actions.updateState({
            qualityDefinitions: definitionManager.qualityDefinitions
        }));
        // model group
        modelGroup.updateBoundingBox(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON, -size.y / 2 - EPSILON, -EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON, size.y / 2 + EPSILON, size.z + EPSILON)
        ));
        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    initSize: () => async (dispatch, getState) => {
        // also used in actions.saveAndClose of project/index.js

        // state
        const printingState = getState().printing;
        const { modelGroup, gcodeLineGroup } = printingState;
        modelGroup.setDataChangedCallback(() => {
            dispatch(actions.render());
        });

        const { series } = getState().machine;
        await definitionManager.init(series);

        dispatch(actions.updateState({
            activeDefinition: definitionManager.activeDefinition
        }));

        dispatch(actions.updateActiveDefinition(definitionManager.snapmakerDefinition));

        // Update machine size after active definition is loaded
        const { size } = getState().machine;
        dispatch(actions.updateActiveDefinitionMachineSize(size));

        dispatch(actions.updateState({
            materialDefinitions: definitionManager.materialDefinitions,
            qualityDefinitions: definitionManager.qualityDefinitions
        }));

        // model group
        modelGroup.updateBoundingBox(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON, -size.y / 2 - EPSILON, -EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON, size.y / 2 + EPSILON, size.z + EPSILON)
        ));

        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    // TODO: init should be  re-called
    init: () => async (dispatch, getState) => {
        await dispatch(actions.initSize());

        const printingState = getState().printing;
        const { modelGroup, gcodeLineGroup } = printingState;

        modelGroup.removeAllModels();

        // TODO: not yet to clear old events before regist
        // generate gcode event
        controller.on('slice:started', () => {
            dispatch(actions.updateState({
                stage: PRINTING_STAGE.SLICING,
                inProgress: true,
                progress: 0
            }));
        });
        controller.on('slice:completed', (args) => {
            const { gcodeFilename, gcodeFileLength, printTime, filamentLength, filamentWeight } = args;
            dispatch(actions.updateState({
                gcodeFile: {
                    name: gcodeFilename,
                    uploadName: gcodeFilename,
                    size: gcodeFileLength,
                    lastModified: +new Date(),
                    thumbnail: ''
                },
                printTime,
                filamentLength,
                filamentWeight,
                stage: PRINTING_STAGE.SLICE_SUCCEED,
                inProgress: false,
                progress: 1
            }));

            modelGroup.unselectAllModels();
            dispatch(actions.loadGcode(gcodeFilename));
        });
        controller.on('slice:progress', (progress) => {
            const state = getState().printing;
            if (progress - state.progress > 0.01 || progress > 1 - EPSILON) {
                dispatch(actions.updateState({ progress }));
            }
        });
        controller.on('slice:error', () => {
            dispatch(actions.updateState({
                stage: PRINTING_STAGE.SLICE_FAILED,
                inProgress: false
            }));
        });

        gcodeRenderingWorker.onmessage = (e) => {
            const data = e.data;
            const { status, value } = data;
            switch (status) {
                case 'succeed': {
                    const { positions, colors, layerIndices, typeCodes, layerCount, bounds } = value;

                    const bufferGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
                    const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
                    // this will map the buffer values to 0.0f - +1.0f in the shader
                    colorAttribute.normalized = true;
                    const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndices, 1);
                    const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);

                    bufferGeometry.addAttribute('position', positionAttribute);
                    bufferGeometry.addAttribute('a_color', colorAttribute);
                    bufferGeometry.addAttribute('a_layer_index', layerIndexAttribute);
                    bufferGeometry.addAttribute('a_type_code', typeCodeAttribute);

                    const object3D = gcodeBufferGeometryToObj3d('3DP', bufferGeometry);

                    dispatch(actions.destroyGcodeLine());
                    gcodeLineGroup.add(object3D);
                    object3D.position.copy(new THREE.Vector3());
                    const gcodeTypeInitialVisibility = {
                        'WALL-INNER': true,
                        'WALL-OUTER': true,
                        SKIN: true,
                        SKIRT: true,
                        SUPPORT: true,
                        FILL: true,
                        TRAVEL: false,
                        UNKNOWN: true
                    };
                    dispatch(actions.updateState({
                        layerCount,
                        layerCountDisplayed: layerCount - 1,
                        gcodeTypeInitialVisibility,
                        gcodeLine: object3D
                    }));

                    Object.keys(gcodeTypeInitialVisibility).forEach((type) => {
                        const visible = gcodeTypeInitialVisibility[type];
                        dispatch(actions.setGcodeVisibilityByType(type, visible ? 1 : 0));
                    });

                    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
                    dispatch(actions.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ));
                    dispatch(actions.showGcodeLayers(layerCount - 1));
                    dispatch(actions.displayGcode());

                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.PREVIEW_SUCCEED,
                        inProgress: false
                    }));
                    break;
                }
                case 'progress': {
                    const state = getState().printing;
                    if (Math.abs(value - state.progress) > 0.01 || value > 1 - EPSILON) {
                        dispatch(actions.updateState({ progress: value }));
                    }
                    break;
                }
                case 'err': {
                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.PREVIEW_FAILED,
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

    updateShowPrintingManager: (showPrintingManager) => (dispatch) => {
        dispatch(actions.updateState({ showPrintingManager }));
    },

    updateManagerDisplayType: (managerDisplayType) => (dispatch) => {
        dispatch(actions.updateState({ managerDisplayType }));
    },

    // Update definition settings and save.
    updateDefinitionSettings: (definition, settings) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        settings = definitionManager.calculateDependencies(definition, settings, modelGroup && modelGroup.hasSupportModel());
        return definitionManager.updateDefinition({
            definitionId: definition.definitionId,
            settings
        });
    },

    updateActiveDefinitionMachineSize: (size) => (dispatch) => {
        // Update active definition on dimensions
        const definition = {
            definitionId: 'temporary',
            ownKeys: [
                'machine_width',
                'machine_depth',
                'machine_height'
            ],
            settings: {
                machine_width: {
                    default_value: size.x
                },
                machine_depth: {
                    default_value: size.y
                },
                machine_height: {
                    default_value: size.z
                }
            }
        };
        dispatch(actions.updateActiveDefinition(definition));
    },

    updateActiveDefinition: (definition, shouldSave = false) => (dispatch, getState) => {
        const state = getState().printing;

        const activeDefinition = {
            ...state.activeDefinition
        };

        // Note that activeDefinition can be updated by itself
        if (!definition) {
            return;
        }
        if (definition !== state.activeDefinition) {
            for (const key of definition.ownKeys) {
                if (activeDefinition.settings[key] === undefined) {
                    continue;
                }
                activeDefinition.settings[key].default_value = definition.settings[key].default_value;
                activeDefinition.settings[key].from = definition.definitionId;
            }
        }
        if (shouldSave) {
            dispatch(actions.updateDefinitionSettings(activeDefinition, activeDefinition.settings));
        } else {
            // TODO: Optimize performance
            const { modelGroup } = getState().printing;
            definitionManager.calculateDependencies(activeDefinition, activeDefinition.settings, modelGroup && modelGroup.hasSupportModel());
        }

        // Update activeDefinition to force component re-render
        dispatch(actions.updateState({ activeDefinition }));
    },

    updateDefinitionsForManager: (definitionId, type) => async (dispatch, getState) => {
        const state = getState().printing;
        const savedDefinition = await definitionManager.getDefinition(definitionId);
        if (!savedDefinition) {
            return;
        }
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const newDefinitions = state[definitionsKey].map((item) => {
            if (item.definitionId === definitionId) {
                return savedDefinition;
            } else {
                return item;
            }
        });
        dispatch(actions.updateState({
            [definitionsKey]: [...newDefinitions]
        }));
    },

    onUploadManagerDefinition: (file, type) => (dispatch, getState) => {
        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData)
            .then(async (res) => {
                const response = res.body;
                const definitionId = `${type}.${timestamp()}`;
                const definition = await definitionManager.uploadDefinition(definitionId, response.uploadName);
                let name = definition.name;
                const definitionsKey = defaultDefinitionKeys[type].definitions;
                const defaultId = defaultDefinitionKeys[type].id;
                const definitions = getState().printing[definitionsKey];
                while (definitions.find(e => e.name === name)) {
                    name = `#${name}`;
                }
                definition.name = name;
                await definitionManager.updateDefinition({
                    definitionId: definition.definitionId,
                    name
                });
                dispatch(actions.updateState({
                    [definitionsKey]: [...definitions, definition],
                    [defaultId]: definitionId
                }));
            })
            .catch(() => {
                // Ignore error
            });
    },

    updateDefinitionNameByType: (type, definition, name) => async (dispatch, getState) => {
        if (!name || name.trim().length === 0) {
            return Promise.reject(i18n._('Failed to rename. Please enter a new name.'));
        }
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        const definitions = getState().printing[definitionsKey];
        const duplicated = definitions.find(d => d.name === name);

        if (duplicated && duplicated !== definition) {
            return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { name }));
        }

        await definitionManager.updateDefinition({
            definitionId: definition.definitionId,
            name
        });

        definition.name = name;
        return null;
    },

    duplicateDefinitionByType: (type, definition, newDefinitionId, newDefinitionName) => async (dispatch, getState) => {
        const state = getState().printing;
        let name = newDefinitionName || definition.name;
        let definitionId;
        if (type === 'quality' && isDefaultQualityDefinition(definition.definitionId)) {
            const machine = getState().machine;
            name = `${machine.series}-${name}`;
        }
        if (newDefinitionId) {
            definitionId = newDefinitionId;
        } else {
            definitionId = `${type}.${timestamp()}`;
        }
        let metadata = definition.metadata;
        // newDefinitionId is the same as newDefinitionName
        if (isNil(newDefinitionId)) {
            metadata = {
                ...definition.metadata,
                readonly: false
            };
        }

        const newDefinition = {
            definitionId,
            name,
            inherits: definition.inherits,
            ownKeys: definition.ownKeys,
            metadata,
            settings: {}
        };
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        // Find a name not being used
        while (state[definitionsKey].find(d => d.name === newDefinition.name)) {
            newDefinition.name = `#${newDefinition.name}`;
        }

        // Simplify settings
        for (const key of definition.ownKeys) {
            newDefinition.settings[key] = {
                default_value: definition.settings[key].default_value
            };
        }

        const createdDefinition = await definitionManager.createDefinition(newDefinition);


        dispatch(actions.updateState({
            [definitionsKey]: [...state[definitionsKey], createdDefinition]
        }));


        return createdDefinition;
    },

    removeDefinitionByType: (type, definition) => async (dispatch, getState) => {
        const state = getState().printing;

        await definitionManager.removeDefinition(definition);
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        dispatch(actions.updateState({
            [definitionsKey]: state[definitionsKey].filter(d => d.definitionId !== definition.definitionId)
        }));
    },

    // removes all non-predefined definitions
    removeAllMaterialDefinitions: () => async (dispatch, getState) => {
        const state = getState().printing;

        const newMaterialDefinitions = [];
        const defaultDefinitionIds = ['material.pla', 'material.abs'];
        for (const definition of state.materialDefinitions) {
            if (defaultDefinitionIds.includes(definition.definitionId)) {
                newMaterialDefinitions.push(definition);
                continue;
            }
            definitionManager.removeDefinition(definition);
        }

        dispatch(actions.updateState({
            materialDefinitions: newMaterialDefinitions
        }));
    },

    // removes all non-predefined definitions
    removeAllQualityDefinitions: () => async (dispatch, getState) => {
        const state = getState().printing;

        const newQualityDefinitions = [];
        const defaultDefinitionIds = ['quality.fast_print', 'quality.normal_quality', 'quality.high_quality'];
        for (const definition of state.qualityDefinitions) {
            if (defaultDefinitionIds.includes(definition.definitionId)) {
                newQualityDefinitions.push(definition);
                continue;
            }
            definitionManager.removeDefinition(definition);
        }

        dispatch(actions.updateState({
            qualityDefinitions: newQualityDefinitions
        }));
    },

    updateIsRecommended: (isRecommended) => (dispatch) => {
        dispatch(actions.updateState({ isRecommended }));
    },
    updateDefaultIdByType: (type, materialId) => (dispatch) => {
        const defaultId = defaultDefinitionKeys[type].id;
        dispatch(actions.updateState({ [defaultId]: materialId }));
    },
    updateDefaultMaterialId: (materialId) => (dispatch) => {
        dispatch(actions.updateState({ defaultMaterialId: materialId }));
    },

    updateDefaultQualityId: (qualityId) => (dispatch) => {
        dispatch(actions.updateState({ defaultQualityId: qualityId }));
    },

    /**
     * Load and parse 3D model and create corresponding Model object.
     *
     * @param originalName original upload name
     * @param uploadName upload name (actual file name)
     * @returns {Function}
     * @private
     */
    __loadModel: (originalName, uploadName) => (dispatch) => {
        const headType = '3dp';
        const sourceType = '3d';
        const mode = '3d';
        const width = 0;
        const height = 0;

        dispatch(actions.updateState({ progress: 0.25 }));
        dispatch(actions.generateModel(headType, originalName, uploadName, width, height,
            mode, sourceType, null, null, {}));
    },

    // Upload model
    // @param file
    uploadModel: (file) => async (dispatch, getState) => {
        // Notice user that model is being loading
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.LOADING_MODEL,
            inProgress: true,
            progress: 0
        }));

        const formData = new FormData();
        formData.append('file', file);
        const res = await api.uploadFile(formData);

        const { originalName, uploadName } = res.body;

        dispatch(actions.updateState({ progress: 0.25 }));

        actions.__loadModel(originalName, uploadName)(dispatch, getState);
    },
    // Upload model
    // @param file: JSON describe the file
    // pathConfig: {
    //     name: '3DP_test_A150.stl',
    //     casePath: './A150/'
    // }
    uploadCaseModel: (file) => async (dispatch) => {
        // Notice user that model is being loading
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.LOADING_MODEL,
            inProgress: true,
            progress: 0
        }));

        const res = await api.uploadCaseFile(file);
        const { originalName, uploadName } = res.body;

        actions.__loadModel(originalName, uploadName)(dispatch);
    },

    setTransformMode: (value) => (dispatch) => {
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateState({
            transformMode: value
        }));
    },

    destroyGcodeLine: () => (dispatch, getState) => {
        const { gcodeLine, gcodeLineGroup } = getState().printing;
        if (gcodeLine) {
            gcodeLineGroup.remove(gcodeLine);
            gcodeLine.geometry.dispose();
            dispatch(actions.updateState({
                gcodeLine: null,
                displayedType: 'model'
            }));
        }
    },

    generateGcode: (thumbnail) => async (dispatch, getState) => {
        const { hasModel, activeDefinition, modelGroup } = getState().printing;

        if (!hasModel) {
            return;
        }

        const models = modelGroup.getModels();

        if (!models || models.length === 0) {
            return;
        }

        modelGroup.unselectAllModels();
        // Info user that slice has started
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.SLICE_PREPARING,
            inProgress: true,
            progress: 0
        }));

        // Prepare model file
        const { model, support, originalName } = await dispatch(actions.prepareModel());


        // Prepare definition file
        const finalDefinition = definitionManager.finalizeActiveDefinition(activeDefinition);
        await api.printingConfigs.createDefinition(finalDefinition);

        dispatch(actions.updateState({
            stage: PRINTING_STAGE.SLICING,
            inProgress: true,
            progress: 0
        }));

        // slice
        /*
        const params = {
            modelName: name,
            modelFileName: filename
        };
        */

        const boundingBox = modelGroup.getBoundingBox();
        const params = {
            model,
            support,
            originalName,
            boundingBox,
            thumbnail: thumbnail
        };
        controller.slice(params);
    },

    prepareModel: () => (dispatch, getState) => {
        return new Promise((resolve) => {
            const { modelGroup } = getState().printing;


            // modelGroup.removeHiddenMeshObjects();

            // Use setTimeout to force export executes in next tick, preventing block of updateState()

            setTimeout(async () => {
                const models = modelGroup.models.filter(i => i.visible);
                const ret = { model: [], support: [], originalName: null };
                for (const item of models) {
                    const mesh = item.meshObject.clone();
                    mesh.children = []; // remove support children
                    mesh.applyMatrix(item.meshObject.parent.matrix);
                    const stl = new ModelExporter().parse(mesh, 'stl', true);
                    const blob = new Blob([stl], { type: 'text/plain' });

                    const originalName = item.originalName;
                    const uploadPath = `${DATA_PREFIX}/${originalName}`;
                    const basenameWithoutExt = path.basename(uploadPath, path.extname(uploadPath));
                    const stlFileName = `${basenameWithoutExt}.stl`;
                    const fileOfBlob = new File([blob], stlFileName);

                    const formData = new FormData();
                    formData.append('file', fileOfBlob);
                    const uploadResult = await api.uploadFile(formData);
                    if (item.supportTag === true) {
                        ret.support.push(uploadResult.body.uploadName);
                    } else {
                        ret.model.push(uploadResult.body.uploadName);
                        if (!ret.originalName) {
                            ret.originalName = uploadResult.body.originalName;
                        }
                    }
                }

                resolve(ret);
            }, 50);
        });
    },

    // preview
    setGcodeVisibilityByType: (type, visible) => (dispatch, getState) => {
        const { gcodeLine } = getState().printing;
        const uniforms = gcodeLine.material.uniforms;
        const value = visible ? 1 : 0;
        switch (type) {
            case 'WALL-INNER':
                uniforms.u_wall_inner_visible.value = value;
                break;
            case 'WALL-OUTER':
                uniforms.u_wall_outer_visible.value = value;
                break;
            case 'SKIN':
                uniforms.u_skin_visible.value = value;
                break;
            case 'SKIRT':
                uniforms.u_skirt_visible.value = value;
                break;
            case 'SUPPORT':
                uniforms.u_support_visible.value = value;
                break;
            case 'FILL':
                uniforms.u_fill_visible.value = value;
                break;
            case 'TRAVEL':
                uniforms.u_travel_visible.value = value;
                break;
            case 'UNKNOWN':
                uniforms.u_unknown_visible.value = value;
                break;
            default:
                break;
        }
        dispatch(actions.render());
    },

    showGcodeLayers: (count) => (dispatch, getState) => {
        const { layerCount, gcodeLine } = getState().printing;
        if (!gcodeLine) {
            return;
        }

        if (count >= layerCount) {
            dispatch(actions.displayModel());
        } else {
            dispatch(actions.displayGcode());
        }

        count = (count > layerCount) ? layerCount : count;
        count = (count < 0) ? 0 : count;
        gcodeLine.material.uniforms.u_visible_layer_count.value = count;
        dispatch(actions.updateState({
            layerCountDisplayed: count
        }));
        dispatch(actions.render());
    },

    // make an offset of gcode layer count
    // offset can be negative
    offsetGcodeLayers: (offset) => (dispatch, getState) => {
        const { layerCountDisplayed } = getState().printing;
        dispatch(actions.showGcodeLayers(layerCountDisplayed + offset));
    },

    checkGcodeBoundary: (minX, minY, minZ, maxX, maxY, maxZ) => (dispatch, getState) => {
        const { size } = getState().machine;
        // TODO: provide a precise margin (use EPSILON?)
        const margin = 1;
        const widthOverstepped = (minX < -margin || maxX > size.x + margin);
        const depthOverstepped = (minY < -margin || maxY > size.y + margin);
        const heightOverstepped = (minZ < -margin || maxZ > size.z + margin);
        const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
        dispatch(actions.updateState({
            isGcodeOverstepped: overstepped
        }));
    },

    displayModel: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        // modelGroup.visible = true;
        modelGroup.object.visible = true;
        gcodeLineGroup.visible = false;
        dispatch(actions.updateState({
            displayedType: 'model'
        }));
        dispatch(actions.render());
    },

    selectModel: (modelMeshObject) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        let modelState;
        if (modelMeshObject) {
            const find = modelGroup.getModels().find(v => v.meshObject === modelMeshObject);
            modelState = modelGroup.selectModelById(find.modelID);
        } else {
            modelState = modelGroup.selectModelById(modelMeshObject);
        }

        dispatch(actions.updateState(modelState));
        dispatch(actions.displayModel());
    },

    updateSelectedModelTransformation: (transformation, newUniformScalingState) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.updateSelectedGroupTransformation(transformation, newUniformScalingState);
        modelGroup.onModelAfterTransform();
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    selectMultiModel: (intersect, selectEvent) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const modelState = modelGroup.selectMultiModel(intersect, selectEvent);
        dispatch(actions.updateState(modelState));

        dispatch(actions.render());
    },

    selectTargetModel: (model, isMultiSelect) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.selectModelById(model.modelID, isMultiSelect);

        dispatch(actions.updateState(modelState));
        dispatch(actions.render());
    },

    getSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        return modelGroup.selectedModel;
    },

    getSelectedModelArray: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        return modelGroup.selectedModelArray;
    },

    getSelectedModelOriginalName: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const selectedModel = modelGroup.getSelectedModel();
        if (selectedModel) {
            return selectedModel.originalName;
        } else {
            return '';
        }
    },

    selectAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.selectAllModels();
        dispatch(actions.updateState(modelState));
    },

    hideSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.hideSelectedModel();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    showSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.showSelectedModel();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },
    unselectAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.unselectAllModels();
        dispatch(actions.render());
    },
    removeSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.removeSelectedModel();
        if (!modelState.hasModel) {
            dispatch(actions.updateState({
                stage: PRINTING_STAGE.EMPTY,
                inProgress: false,
                progress: 0
            }));
        }
        // updateState need before displayModel
        dispatch(actions.updateState(
            modelState
        ));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    removeAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.removeAllModels();

        dispatch(actions.updateState({
            stage: PRINTING_STAGE.EMPTY,
            inProgress: false,
            progress: 0
        }));
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.render());
    },

    arrangeAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.arrangeAllModels();
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.recordSnapshot());
        dispatch(actions.render());
    },

    onModelTransform: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.onModelTransform();
        // dispatch(actions.updateTransformation(modelState.transformation));
        // dispatch(actions.displayModel());
    },

    onModelAfterTransform: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.onModelAfterTransform();
        // if (!customCompareTransformation(modelState.transformation, transformation)) {
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        // }
    },


    duplicateSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.duplicateSelectedModel();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    copy: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.copy();
    },

    paste: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.paste();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    layFlatSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.layFlatSelectedModel();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    autoRotateSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.autoRotateSelectedModel();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },
    scaleToFitSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const { size } = getState().machine;
        const modelState = modelGroup.scaleToFitSelectedModel(size);
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    resetSelectedModelTransformation: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.resetSelectedModelTransformation();
        dispatch(actions.updateState(modelState));
        dispatch(actions.recordSnapshot());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    // uploadModel
    undo: () => (dispatch, getState) => {
        const { modelGroup, undoSnapshots, redoSnapshots } = getState().printing;
        if (undoSnapshots.length <= 1) {
            return;
        }
        redoSnapshots.push(undoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);

        dispatch(actions.updateState({
            ...modelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.render());
    },

    redo: () => (dispatch, getState) => {
        const { modelGroup, undoSnapshots, redoSnapshots } = getState().printing;
        if (redoSnapshots.length === 0) {
            return;
        }

        undoSnapshots.push(redoSnapshots.pop());
        const snapshots = undoSnapshots[undoSnapshots.length - 1];

        const modelState = modelGroup.undoRedo(snapshots.models);

        dispatch(actions.updateState({
            ...modelState,
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.render());
    },

    recordSnapshot: () => (dispatch, getState) => {
        const { modelGroup, undoSnapshots, redoSnapshots } = getState().printing;
        const cloneModels = modelGroup.cloneModels();
        undoSnapshots.push({
            models: cloneModels
        });
        redoSnapshots.splice(0);
        dispatch(actions.updateState({
            undoSnapshots: undoSnapshots,
            redoSnapshots: redoSnapshots,
            canUndo: undoSnapshots.length > 1,
            canRedo: redoSnapshots.length > 0
        }));
    },


    displayGcode: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        // modelGroup.visible = false;
        modelGroup.object.visible = false;
        gcodeLineGroup.visible = true;
        dispatch(actions.updateState({
            displayedType: 'gcode'
        }));
        dispatch(actions.render());
    },

    loadGcode: (gcodeFilename) => (dispatch) => {
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.PREVIEWING,
            inProgress: true,
            progress: 0
        }));
        gcodeRenderingWorker.postMessage({ func: '3DP', gcodeFilename });
    },
    saveSupport: (model) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.saveSupportModel(model);
        dispatch(actions.recordSnapshot());
    },
    clearAllManualSupport: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.removeAllManualSupport();
        dispatch(actions.recordSnapshot());
    },
    setDefaultSupportSize: (size) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.defaultSupportSize = size;
    },
    generateModel: (headType, originalName, uploadName, sourceWidth, sourceHeight,
        mode, sourceType, config, gcodeConfig, transformation) => async (dispatch, getState) => {
        const { size } = getState().machine;
        const uploadPath = `${DATA_PREFIX}/${uploadName}`;
        const { modelGroup } = getState().printing;
        // const sourceType = '3d';


        const onMessage = async (e) => {
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
                    // Create model
                    // modelGroup.generateModel(modelInfo);

                    const modelState = await modelGroup.generateModel({
                        limitSize: size,
                        headType,
                        sourceType,
                        originalName,
                        uploadName,
                        mode: mode,
                        sourceWidth,
                        width: sourceWidth,
                        sourceHeight,
                        height: sourceHeight,
                        geometry: bufferGeometry,
                        material: material,
                        transformation
                    });
                    dispatch(actions.updateState(modelState));
                    dispatch(actions.displayModel());
                    dispatch(actions.destroyGcodeLine());
                    dispatch(actions.recordSnapshot());
                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.LOAD_MODEL_SUCCEED,
                        inProgress: false,
                        progress: 1
                    }));
                    break;
                }
                case 'LOAD_MODEL_CONVEX': {
                    const { positions } = data;

                    const convexGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.BufferAttribute(positions, 3);
                    convexGeometry.addAttribute('position', positionAttribute);

                    // const model = modelGroup.children.find(m => m.uploadName === uploadName);
                    modelGroup.setConvexGeometry(uploadName, convexGeometry);

                    break;
                }
                case 'LOAD_MODEL_PROGRESS': {
                    const state = getState().printing;
                    const progress = 0.25 + data.progress * 0.5;
                    if (progress - state.progress > 0.01 || progress > 0.75 - EPSILON) {
                        dispatch(actions.updateState({ progress }));
                    }
                    break;
                }
                case 'LOAD_MODEL_FAILED': {
                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.LOAD_MODEL_FAILED,
                        inProgress: false,
                        progress: 0
                    }));
                    break;
                }
                default:
                    break;
            }
        };
        createLoadModelWorker(uploadPath, onMessage);
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        case ACTION_UPDATE_TRANSFORMATION: {
            return Object.assign({}, state, {
                transformation: { ...state.transformation, ...action.transformation }
            });
        }
        default:
            return state;
    }
}
