import * as THREE from 'three';
import path from 'path';
import noop from 'lodash/noop';
import File3dToGeometryWorker from 'worker-loader!../../workers/File3dToGeometry.worker';
import GcodeToObj3dWorker from 'worker-loader!../../workers/GcodeToObj3d.worker';
import { ABSENT_OBJECT, EPSILON, WEB_CACHE_IMAGE } from '../../constants';
import { timestamp } from '../../../shared/lib/random-utils';
import i18n from '../../lib/i18n';
import definitionManager from './DefinitionManager';
import ModelGroup from '../../widgets/PrintingVisualizer/ModelGroup';
import api from '../../api';
import Model from '../../widgets/PrintingVisualizer/Model';
import controller from '../../lib/controller';
import { exportModel3d } from '../../async';

const INITIAL_STATE = {
    // printing config
    materialDefinitions: [],
    qualityDefinitions: [],
    // Active definition
    // fdm -> snapmaker -> active (machine, material, adhesion)
    activeDefinition: ABSENT_OBJECT,

    // model
    modelGroup: new ModelGroup(),

    // generated gcode result
    printTime: 0,
    filamentLength: 0,
    filamentWeight: 0,
    // G-code
    gcodePath: '',
    gcodeLineGroup: new THREE.Group(),
    gcodeLine: null,
    layerCount: 0,
    layerCountDisplayed: 0,
    gcodeTypeInitialVisibility: {},
    // progress bar
    progressTitle: '',
    progress: 0,
    // modelGroup state
    canUndo: false,
    canRedo: false,
    hasModel: false,
    isModelOverstepped: false,
    model: null, // selected model
    boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of // selected model
    // selected model transformation
    positionX: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scale: 1,
    // others
    transformMode: 'translate', // translate/scale/rotate
    isGcodeOverstepped: false,
    isSlicing: false,
    displayedType: 'model' // model/gcode
};


const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';

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

        const printing = getState().printing;
        const { modelGroup, gcodeLineGroup } = printing;
        gcodeLineGroup.position.copy(new THREE.Vector3(-size.x / 2, -size.z / 2, size.y / 2));
        modelGroup.position.copy(new THREE.Vector3(0, -size.z / 2, 0));
        modelGroup.updateBoundingBox(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON, -EPSILON, -size.z / 2 - EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON, size.y + EPSILON, size.z / 2 + EPSILON)
        ));

        modelGroup.addChangeListener((args) => {
            const { positionX, positionZ, rotationX, rotationY, rotationZ, scale } = args;
            if (positionX !== printing.positionX ||
                positionZ !== printing.positionZ ||
                rotationX !== printing.rotationX ||
                rotationY !== printing.rotationY ||
                rotationZ !== printing.rotationZ ||
                scale !== printing.scale) {
                // transformation changed
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.displayModel());
            }
            dispatch(actions.updateState(args));
        });

        // generate gcode event
        controller.on('print3D:gcode-generated', (args) => {
            const { gcodeFileName, printTime, filamentLength, filamentWeight } = args;
            dispatch(actions.loadGcode(gcodeFileName));
            dispatch(actions.updateState({
                isSlicing: false,
                gcodeFileName,
                gcodePath: `${WEB_CACHE_IMAGE}/${args.gcodeFileName}`,
                printTime,
                filamentLength,
                filamentWeight,
                progress: 100,
                progressTitle: i18n._('Slicing completed.')
            }));
        });
        controller.on('print3D:gcode-slice-progress', (progress) => {
            dispatch(actions.updateState({
                progress: 100.0 * progress,
                progressTitle: i18n._('Slicing {{progress}}%', { progress: (100.0 * progress).toFixed(1) })
            }));
        });
        controller.on('print3D:gcode-slice-err', (err) => {
            dispatch(actions.updateState({
                isSlicing: false,
                progress: 0,
                progressTitle: i18n._('Slice error: ') + JSON.stringify(err)
            }));
        });
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
                    console.error('Unknown key ' + key);
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

    uploadFile3d: (file, onError = noop) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData).then((res) => {
            const file = res.body;
            const modelPath = `${WEB_CACHE_IMAGE}/${file.filename}`;
            const modelName = file.name;

            const worker = new File3dToGeometryWorker();
            worker.postMessage({ modelPath });
            worker.onmessage = (e) => {
                const data = e.data;
                const { status, value } = data;
                switch (status) {
                    case 'succeed': {
                        worker.terminate();
                        const { bufferGeometryJson, convexBufferGeometryJson } = value;
                        const convexBufferGeometry = new THREE.BufferGeometryLoader().parse(convexBufferGeometryJson);
                        const bufferGeometry = new THREE.BufferGeometryLoader().parse(bufferGeometryJson);
                        const model = new Model(bufferGeometry, convexBufferGeometry, modelName, modelPath);
                        modelGroup.addModel(model);
                        dispatch(actions.displayModel());
                        dispatch(actions.destroyGcodeLine());
                        dispatch(actions.updateState({
                            progress: 100,
                            progressTitle: i18n._('Succeed to load model.')
                        }));
                        break;
                    }
                    case 'progress':
                        dispatch(actions.updateState({
                            progress: value * 100,
                            progressTitle: i18n._('Loading model...')
                        }));
                        break;
                    case 'err':
                        worker.terminate();
                        console.error(value);
                        dispatch(actions.updateState({
                            progress: 0,
                            progressTitle: i18n._('Failed to load model.')
                        }));
                        break;
                    default:
                        break;
                }
            };
        }).catch(() => {
            onError();
        });
    },

    setTransformMode: (value) => (dispatch, getState) => {
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
        const { modelGroup, hasModel, activeDefinition } = getState().printing;
        dispatch(actions.updateState({
            isSlicing: true,
            progress: 0,
            progressTitle: i18n._('Preparing for slicing...')
        }));

        // Prepare STL file: gcode name is: stlFileName(without ext) + '_' + timeStamp + '.gcode'
        let stlFileName = 'combined.stl';
        if (hasModel) {
            const modelPath = modelGroup.getModels()[0].modelPath;
            const basenameWithoutExt = path.basename(modelPath, path.extname(modelPath));
            stlFileName = basenameWithoutExt + '.stl';
        }
        const stl = await exportModel3d(modelGroup, 'stl', true);
        const blob = new Blob([stl], { type: 'text/plain' });
        const fileOfBlob = new File([blob], stlFileName);

        const formData = new FormData();
        formData.append('file', fileOfBlob);
        const modelRes = await api.uploadFile(formData);

        // Prepare definition file
        const finalDefinition = definitionManager.finalizeActiveDefinition(activeDefinition);
        const configFilePath = '../CuraEngine/Config/active_final.def.json';
        await api.printingConfigs.createDefinition(finalDefinition);

        // slice
        const params = {
            modelName: modelRes.body.name,
            modelFileName: modelRes.body.filename,
            configFilePath
        };
        controller.print3DSlice(params);
    },

    setSlicing: (value) => (dispatch, getState) => {
        dispatch(actions.updateState({
            isSlicing: value
        }));
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
            displayedType: 'model'
        }));
    },

    displayGcode: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        modelGroup.visible = false;
        gcodeLineGroup.visible = true;
        dispatch(actions.updateState({
            displayedType: 'gcode'
        }));
    },

    loadGcode: (gcodeFilename) => (dispatch, getState) => {
        const { gcodeLineGroup } = getState().printing;
        const worker = new GcodeToObj3dWorker();
        worker.postMessage({ func: '3DP', gcodeFilename });
        worker.onmessage = (e) => {
            const data = e.data;
            const { status, value } = data;
            switch (status) {
                case 'succeed': {
                    worker.terminate();
                    let obj3d;
                    new THREE.ObjectLoader().parse(value, (mObj3d) => {
                        obj3d = mObj3d;
                    });
                    dispatch(actions.destroyGcodeLine());
                    gcodeLineGroup.add(obj3d);

                    obj3d.position.copy(new THREE.Vector3());
                    const { layerCount, bounds } = obj3d.userData;
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
                        progress: 100,
                        gcodeLine: obj3d,
                        progressTitle: i18n._('Rendered G-code successfully.')
                    }));

                    Object.keys(gcodeTypeInitialVisibility).forEach((type) => {
                        const visible = gcodeTypeInitialVisibility[type];
                        const value = visible ? 1 : 0;
                        dispatch(actions.setGcodeVisibilityByType(type, value));
                    });

                    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
                    dispatch(actions.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ));
                    dispatch(actions.displayGcode());
                    dispatch(actions.showGcodeLayers(layerCount - 1));
                    break;
                }
                case 'progress':
                    dispatch(actions.updateState({
                        progress: value * 100,
                        progressTitle: i18n._('Loading gcode...')
                    }));
                    break;
                case 'err':
                    worker.terminate();
                    console.error(value);
                    dispatch(actions.updateState({
                        progress: 0,
                        progressTitle: i18n._('Failed to load gcode.')
                    }));
                    break;
                default:
                    break;
            }
        };
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
