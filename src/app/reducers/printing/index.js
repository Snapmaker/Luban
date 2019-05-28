import * as THREE from 'three';
import path from 'path';
import LoadModelWorker from '../../workers/LoadModel.worker';
import GcodeToBufferGeometryWorker from '../../workers/GcodeToBufferGeometry.worker';
import { ABSENT_OBJECT, EPSILON, DATA_PREFIX } from '../../constants';
import { timestamp } from '../../../shared/lib/random-utils';
import i18n from '../../lib/i18n';
import definitionManager from './DefinitionManager';
import ModelGroup from '../../widgets/PrintingVisualizer/ModelGroup';
import api from '../../api';
import Model from '../../widgets/PrintingVisualizer/Model';
import controller from '../../lib/controller';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import ModelExporter from '../../widgets/PrintingVisualizer/ModelExporter';

// return true if tran1 equals tran2
const customCompareTransformation = (tran1, tran2) => {
    const { positionX: px1, positionZ: pz1, rotationX: rx1, rotationY: ry1, rotationZ: rz1, scaleX: sx1, scaleY: sy1, scaleZ: sz1 } = tran1;
    const { positionX: px2, positionZ: pz2, rotationX: rx2, rotationY: ry2, rotationZ: rz2, scaleX: sx2, scaleY: sy2, scaleZ: sz2 } = tran2;
    return (
        Math.abs(px1 - px2) < EPSILON &&
        Math.abs(pz1 - pz2) < EPSILON &&
        Math.abs(rx1 - rx2) < EPSILON &&
        Math.abs(ry1 - ry2) < EPSILON &&
        Math.abs(rz1 - rz2) < EPSILON &&
        Math.abs(sx1 - sx2) < EPSILON &&
        Math.abs(sy1 - sy2) < EPSILON &&
        Math.abs(sz1 - sz2) < EPSILON
    );
};

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
    // Active definition
    // Hierarchy: FDM Printer -> Snapmaker -> Active Definition (combination of machine, material, adhesion configurations)
    activeDefinition: ABSENT_OBJECT,

    // Stage reflects current state of visualizer
    stage: PRINTING_STAGE.EMPTY,

    // model group, which contains all models loaded on workspace
    modelGroup: new ModelGroup(),

    // G-code
    gcodePath: '',
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

    // modelGroup state
    canUndo: false,
    canRedo: false,
    hasModel: false,
    isAnyModelOverstepped: false,
    model: null, // selected model
    boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model

    // selected model transformation
    positionX: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,

    // others
    transformMode: 'translate', // translate/scale/rotate
    isGcodeOverstepped: false,
    displayedType: 'model', // model/gcode

    // temp
    renderingTimestamp: 0
};


const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';

// TODO: invest worker thread memory costs
const gcodeRenderingWorker = new GcodeToBufferGeometryWorker();

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    init: () => async (dispatch, getState) => {
        await definitionManager.init();

        dispatch(actions.updateState({
            materialDefinitions: definitionManager.materialDefinitions,
            qualityDefinitions: definitionManager.qualityDefinitions,
            activeDefinition: definitionManager.activeDefinition
        }));

        dispatch(actions.updateActiveDefinition(definitionManager.snapmakerDefinition));

        // Update machine size after active definition is loaded
        const { size } = getState().machine;
        dispatch(actions.updateActiveDefinitionMachineSize(size));

        let printing = getState().printing;
        const { modelGroup, gcodeLineGroup } = printing;
        gcodeLineGroup.position.copy(new THREE.Vector3(-size.x / 2, 0, size.y / 2));
        // modelGroup.position.copy(new THREE.Vector3(0, -size.z / 2, 0));
        modelGroup.updateBoundingBox(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON, -EPSILON, -size.y / 2 - EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON, size.z + EPSILON, size.y / 2 + EPSILON)
        ));

        modelGroup.addStateChangeListener((state) => {
            printing = getState().printing;
            const { positionX, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, hasModel } = state;
            const tran1 = { positionX, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ };
            const tran2 = {
                positionX: printing.positionX,
                positionZ: printing.positionZ,
                rotationX: printing.rotationX,
                rotationY: printing.rotationY,
                rotationZ: printing.rotationZ,
                scaleX: printing.scaleX,
                scaleY: printing.scaleY,
                scaleZ: printing.scaleZ
            };

            if (!customCompareTransformation(tran1, tran2)) {
                // transformation changed
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.displayModel());
            }

            if (!hasModel) {
                dispatch(actions.updateState({
                    stage: PRINTING_STAGE.EMPTY,
                    progress: 0
                }));
                dispatch(actions.destroyGcodeLine());
            }

            dispatch(actions.updateState(state));

            dispatch(actions.updateState({ renderingTimestamp: +new Date() }));
        });

        // generate gcode event
        controller.on('slice:started', () => {
            dispatch(actions.updateState({
                stage: PRINTING_STAGE.SLICING,
                progress: 0
            }));
        });
        controller.on('slice:completed', (args) => {
            const { gcodeFileName, printTime, filamentLength, filamentWeight } = args;
            dispatch(actions.updateState({
                gcodeFileName,
                gcodePath: `${DATA_PREFIX}/${args.gcodeFileName}`,
                printTime,
                filamentLength,
                filamentWeight,
                stage: PRINTING_STAGE.SLICE_SUCCEED,
                progress: 1
            }));
            dispatch(actions.loadGcode(gcodeFileName));
        });
        controller.on('slice:progress', (progress) => {
            const state = getState().printing;
            if (progress - state.progress > 0.01 || progress > 1 - EPSILON) {
                dispatch(actions.updateState({ progress }));
            }
        });
        controller.on('slice:error', (err) => {
            dispatch(actions.updateState({
                stage: PRINTING_STAGE.SLICE_FAILED
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
                        const value = visible ? 1 : 0;
                        dispatch(actions.setGcodeVisibilityByType(type, value));
                    });

                    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
                    dispatch(actions.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ));
                    dispatch(actions.showGcodeLayers(layerCount - 1));
                    dispatch(actions.displayGcode());

                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.PREVIEW_SUCCEED
                    }));
                    break;
                }
                case 'progress': {
                    const state = getState().printing;
                    if (value - state.progress > 0.01 || value > 1 - EPSILON) {
                        dispatch(actions.updateState({ progress: value }));
                    }
                    break;
                }
                case 'err': {
                    console.error(value);
                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.PREVIEW_FAILED,
                        progress: 0
                    }));
                    break;
                }
                default:
                    break;
            }
        };
    },

    // Update definition settings and save.
    updateDefinitionSettings: (definition, settings) => () => {
        settings = definitionManager.calculateDependencies(definition, settings);

        return definitionManager.updateDefinition({
            definitionId: definition.definitionId,
            settings
        });
    },

    updateActiveDefinitionMachineSize: (size) => (dispatch) => {
        // Update active definition on dimensions
        const definition = {
            definitionId: 'Snapmakerjs',
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
            definitionManager.calculateDependencies(activeDefinition, activeDefinition.settings);
        }

        // Update activeDefinition to force component re-render
        dispatch(actions.updateState({ activeDefinition }));
    },

    duplicateQualityDefinition: (definition) => async (dispatch, getState) => {
        const state = getState().printing;

        const newDefinition = {
            definitionId: 'quality.' + timestamp(),
            name: '#' + definition.name,
            inherits: definition.inherits,
            ownKeys: definition.ownKeys,
            settings: {}
        };

        // Find a name not been used
        while (state.qualityDefinitions.find(d => d.name === newDefinition.name)) {
            newDefinition.name = '#' + newDefinition.name;
        }

        // Simplify settings
        for (const key of definition.ownKeys) {
            newDefinition.settings[key] = {
                default_value: definition.settings[key].default_value
            };
        }

        const createdDefinition = await definitionManager.createDefinition(newDefinition);

        dispatch(actions.updateState({
            qualityDefinitions: [...state.qualityDefinitions, createdDefinition]
        }));

        return createdDefinition;
    },

    removeQualityDefinition: (definition) => async (dispatch, getState) => {
        const state = getState().printing;

        await definitionManager.removeDefinition(definition);

        dispatch(actions.updateState({
            qualityDefinitions: state.qualityDefinitions.filter(d => d.definitionId !== definition.definitionId)
        }));
    },

    updateQualityDefinitionName: (definition, name) => async (dispatch, getState) => {
        if (!name || name.trim().length === 0) {
            return Promise.reject(i18n._('Failed to rename. Please enter a new name.'));
        }

        const { qualityDefinitions } = getState().printing;
        const duplicated = qualityDefinitions.find(d => d.name === name);

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

    // Upload model
    // @param file
    uploadModel: (file) => async (dispatch, getState) => {
        // Notice user that model is being loading
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.LOADING_MODEL,
            progress: 0
        }));

        // Upload model to backend
        const { modelGroup } = getState().printing;
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.uploadFile(formData);
        const { name, filename } = res.body;
        const modelPath = `${DATA_PREFIX}/${filename}`;
        const modelName = name;

        dispatch(actions.updateState({ progress: 0.25 }));

        // Tell worker to generate geometry for model
        const worker = new LoadModelWorker();
        worker.postMessage({ modelPath });
        worker.onmessage = (e) => {
            const data = e.data;

            const { type } = data;
            switch (type) {
                case 'LOAD_MODEL_POSITIONS': {
                    const { positions } = data;

                    const bufferGeometry = new THREE.BufferGeometry();
                    const modelPositionAttribute = new THREE.BufferAttribute(positions, 3);

                    bufferGeometry.addAttribute('position', modelPositionAttribute);
                    bufferGeometry.computeVertexNormals();

                    // Create model
                    const model = new Model(bufferGeometry, modelName, modelPath);
                    modelGroup.addModel(model);

                    dispatch(actions.displayModel());
                    dispatch(actions.destroyGcodeLine());

                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.LOAD_MODEL_SUCCEED,
                        progress: 1
                    }));
                    break;
                }
                case 'LOAD_MODEL_CONVEX': {
                    worker.terminate();
                    const { positions } = data;

                    const convexGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.BufferAttribute(positions, 3);
                    convexGeometry.addAttribute('position', positionAttribute);

                    const model = modelGroup.children.find(m => m.modelName === modelName);

                    if (model !== null) {
                        model.setConvexGeometry(convexGeometry);
                    }

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
                    worker.terminate();
                    console.error(data);
                    dispatch(actions.updateState({
                        stage: PRINTING_STAGE.LOAD_MODEL_FAILED,
                        progress: 0
                    }));
                    break;
                }
                default:
                    break;
            }
        };
    },

    setTransformMode: (value) => (dispatch) => {
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
                gcodeLine: null
            }));
        }
    },

    generateGcode: () => async (dispatch, getState) => {
        const { hasModel, activeDefinition } = getState().printing;
        if (!hasModel) {
            return;
        }

        // Info user that slice has started
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.SLICE_PREPARING,
            progress: 0
        }));

        // Prepare model file
        const result = await dispatch(actions.prepareModel());
        const { name, filename } = result;

        // Prepare definition file
        const finalDefinition = definitionManager.finalizeActiveDefinition(activeDefinition);
        await api.printingConfigs.createDefinition(finalDefinition);

        dispatch(actions.updateState({
            stage: PRINTING_STAGE.SLICING,
            progress: 0
        }));

        // slice
        const params = {
            modelName: name,
            modelFileName: filename
        };
        controller.slice(params);
    },
    prepareModel: () => (dispatch, getState) => {
        return new Promise((resolve) => {
            const { modelGroup } = getState().printing;

            const modelPath = modelGroup.getModels()[0].modelPath;
            const basenameWithoutExt = path.basename(modelPath, path.extname(modelPath));
            const stlFileName = basenameWithoutExt + '.stl';

            // Use setTimeout to force export executes in next tick, preventing block of updateState()
            setTimeout(async () => {
                const stl = new ModelExporter().parse(modelGroup, 'stl', true);
                const blob = new Blob([stl], { type: 'text/plain' });
                const fileOfBlob = new File([blob], stlFileName);

                const formData = new FormData();
                formData.append('file', fileOfBlob);
                const uploadResult = await api.uploadFile(formData);

                resolve(uploadResult.body);
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
    },

    showGcodeLayers: (count) => (dispatch, getState) => {
        const { layerCount, gcodeLine } = getState().printing;
        count = (count > layerCount) ? layerCount : count;
        count = (count < 0) ? 0 : count;
        gcodeLine.material.uniforms.u_visible_layer_count.value = count;
        dispatch(actions.updateState({
            layerCountDisplayed: count
        }));
    },

    checkGcodeBoundary: (minX, minY, minZ, maxX, maxY, maxZ) => (dispatch, getState) => {
        const { size } = getState().machine;
        const EPSILON = 1;
        const widthOverstepped = (minX < -EPSILON || maxX > size.x + EPSILON);
        const depthOverstepped = (minY < -EPSILON || maxY > size.y + EPSILON);
        const heightOverstepped = (minZ < -EPSILON || maxZ > size.z + EPSILON);
        const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
        dispatch(actions.updateState({
            isGcodeOverstepped: overstepped
        }));
    },

    displayModel: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        modelGroup.visible = true;
        gcodeLineGroup.visible = false;
        dispatch(actions.updateState({
            displayedType: 'model',
            renderingTimestamp: +new Date()
        }));
    },

    displayGcode: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        modelGroup.visible = false;
        gcodeLineGroup.visible = true;
        dispatch(actions.updateState({
            displayedType: 'gcode',
            renderingTimestamp: +new Date()
        }));
    },

    loadGcode: (gcodeFilename) => (dispatch) => {
        dispatch(actions.updateState({
            stage: PRINTING_STAGE.PREVIEWING,
            progress: 0
        }));
        gcodeRenderingWorker.postMessage({ func: '3DP', gcodeFilename });
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default:
            return state;
    }
}
