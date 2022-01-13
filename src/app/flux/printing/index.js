import * as THREE from 'three';
import path from 'path';
import { cloneDeep, isNil, filter, find as lodashFind } from 'lodash';
// import FileSaver from 'file-saver';
import LoadModelWorker from '../../workers/LoadModel.worker';
import GcodeToBufferGeometryWorker from '../../workers/GcodeToBufferGeometry.worker';
import {
    ABSENT_OBJECT,
    EPSILON,
    DATA_PREFIX,
    ALIGN_OPERATION,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY,
    MACHINE_SERIES,
    HEAD_PRINTING,
    getMachineSeriesWithToolhead,
    LOAD_MODEL_FROM_INNER,
    LEFT_EXTRUDER,
    RIGHT_EXTRUDER,
    LEFT_EXTRUDER_MAP_NUMBER,
    RIGHT_EXTRUDER_MAP_NUMBER,
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
} from '../../constants';
import { timestamp } from '../../../shared/lib/random-utils';
import { machineStore } from '../../store/local-storage';
import ProgressStatesManager, { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';

import i18n from '../../lib/i18n';
import definitionManager from '../manager/DefinitionManager';
import api from '../../api';
import ModelGroup from '../../models/ModelGroup';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import ModelExporter from '../../ui/widgets/PrintingVisualizer/ModelExporter';
import { controller } from '../../lib/controller';
import { actions as operationHistoryActions } from '../operation-history';
import Operations from '../operation-history/Operations';
import MoveOperation3D from '../operation-history/MoveOperation3D';
import RotateOperation3D from '../operation-history/RotateOperation3D';
import ScaleOperation3D from '../operation-history/ScaleOperation3D';
import DeleteOperation3D from '../operation-history/DeleteOperation3D';
import AddOperation3D from '../operation-history/AddOperation3D';
import VisibleOperation3D from '../operation-history/VisibleOperation3D';
import OperationHistory from '../operation-history/OperationHistory';
import GroupOperation3D from '../operation-history/GroupOperation3D';
import GroupAlignOperation3D from '../operation-history/GroupAlignOperation3D';
import ThreeGroup from '../../models/ThreeGroup';
import UngroupOperation3D from '../operation-history/UngroupOperation3D';

const operationHistory = new OperationHistory();

const isDefaultQualityDefinition = (definitionId) => {
    return definitionId.indexOf('quality') !== -1
        && (definitionId.indexOf('fast_print') !== -1
            || definitionId.indexOf('high_quality') !== -1
            || definitionId.indexOf('normal_quality') !== -1
        );
};
const getRealSeries = (series) => {
    if (
        series === MACHINE_SERIES.ORIGINAL_LZ.value
        || series === MACHINE_SERIES.CUSTOM.value
    ) {
        series = MACHINE_SERIES.ORIGINAL.value;
    }
    return series;
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
const CONFIG_ID = {
    material: 'material.pla',
    materialRight: 'material.pla',
    quality: 'quality.fast_print'
};
const CONFIG_HEADTYPE = 'printing';
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

const INITIAL_STATE = {
    name: 'printing',
    // printing configurations
    defaultDefinitions: [],
    materialDefinitions: [],
    qualityDefinitions: [],
    isRecommended: true, // Using recommended settings
    defaultMaterialId: 'material.pla', // TODO: selectedMaterialId
    defaultMaterialIdRight: 'material.pla', // for dual extruder --- right extruder
    defaultQualityId: '', // TODO: selectedQualityId
    // Active definition
    // Hierarchy: FDM Printer -> Snapmaker -> Active Definition (combination of machine, material, adhesion configurations)
    activeDefinition: ABSENT_OBJECT,
    extruderLDefinition: ABSENT_OBJECT,
    extruderRDefinition: ABSENT_OBJECT,

    // Stage reflects current state of visualizer
    stage: STEP_STAGE.EMPTY,

    selectedModelIDArray: [],
    selectedModelArray: [],
    modelGroup: new ModelGroup(HEAD_PRINTING),

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
    renderLineType: false,

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

    history: operationHistory,
    targetTmpState: {},
    // When project recovered, the operation history should be cleared,
    // however we can not identify while the recovery is done, just exclude
    // them when the models loaded at the first time.
    excludeModelIDs: {},

    // modelGroup state
    hasModel: false,
    isAnyModelOverstepped: false,
    // model: null, // selected model
    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model

    // PrintingManager
    showPrintingManager: false,
    managerDisplayType: PRINTING_MANAGER_TYPE_MATERIAL,
    materialManagerDirection: LEFT_EXTRUDER,

    // others
    transformMode: 'translate', // translate/scale/rotate
    isGcodeOverstepped: false,
    displayedType: 'model', // model/gcode

    // temp
    renderingTimestamp: 0,

    // check not to duplicated create event
    initEventFlag: false,

    // progress states manager
    progressStatesManager: new ProgressStatesManager(),

    rotationAnalysisTable: [],
    rotationAnalysisSelectedRowId: -1,
    leftBarOverlayVisible: false,

    enableShortcut: true,

    // helpers extruder config
    helpersExtruderConfig: {
        adhesion: LEFT_EXTRUDER_MAP_NUMBER,
        support: LEFT_EXTRUDER_MAP_NUMBER
    },
    // extruder modal
    isOpenSelectModals: false,
    isOpenHelpers: false,
    modelExtruderInfoShow: true,
    helpersExtruderInfoShow: true,
    // Prime Tower
    enabledPrimeTower: true,
    primeTowerHeight: 0.1,
    isNewUser: true,
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
        // const { seriesWithToolhead, size } = getState().machine;
        // await definitionManager.init(CONFIG_HEADTYPE, seriesWithToolhead.seriesWithToolhead);

        const { toolHead, series, size } = getState().machine;
        // await dispatch(machineActions.updateMachineToolHead(toolHead, series, CONFIG_HEADTYPE));
        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        await definitionManager.init(CONFIG_HEADTYPE, currentMachine.configPathname[CONFIG_HEADTYPE]);

        dispatch(actions.updateState({
            activeDefinition: definitionManager.activeDefinition,
            materialDefinitions: await definitionManager.getDefinitionsByPrefixName('material'),
            qualityDefinitions: await definitionManager.getDefinitionsByPrefixName('quality'),
            extruderLDefinition: await definitionManager.getDefinitionsByPrefixName('snapmaker_extruder_0'),
            extruderRDefinition: await definitionManager.getDefinitionsByPrefixName('snapmaker_extruder_1')
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
        const { toolHead } = getState().machine;
        modelGroup.setDataChangedCallback(() => {
            dispatch(actions.render());
        }, (height) => {
            dispatch(actions.updateState({ primeTowerHeight: height }));
        });

        let { series } = getState().machine;
        series = getRealSeries(series);
        // await dispatch(machineActions.updateMachineToolHead(toolHead, series, CONFIG_HEADTYPE));
        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        await definitionManager.init(CONFIG_HEADTYPE, currentMachine.configPathname[CONFIG_HEADTYPE]);

        const defaultConfigId = machineStore.get('defaultConfigId');
        if (defaultConfigId && Object.prototype.toString.call(defaultConfigId) === '[object String]') {
            const newConfigId = JSON.parse(defaultConfigId);
            if (newConfigId[series]) {
                dispatch(actions.updateState({
                    defaultMaterialId: newConfigId[series]?.material,
                    defaultMaterialIdRight: newConfigId[series]?.materialRight || 'material.pla',
                    defaultQualityId: newConfigId[series]?.quality
                }));
            }
        }
        dispatch(actions.updateState({
            activeDefinition: definitionManager.activeDefinition,
            helpersExtruderConfig: { adhesion: LEFT_EXTRUDER_MAP_NUMBER, support: LEFT_EXTRUDER_MAP_NUMBER },

            extruderLDefinition: definitionManager.extruderLDefinition,
            extruderRDefinition: definitionManager.extruderRDefinition,
        }));
        // todo：init 'activeDefinition' by localStorage
        // dispatch(actions.updateActiveDefinition(definitionManager.snapmakerDefinition));

        // Update machine size after active definition is loaded
        const { size } = getState().machine;
        dispatch(actions.updateActiveDefinitionMachineSize(size));
        dispatch(actions.updateState({
            defaultDefinitions: definitionManager?.defaultDefinitions,
            materialDefinitions: await definitionManager.getDefinitionsByPrefixName('material'),
            qualityDefinitions: await definitionManager.getDefinitionsByPrefixName('quality')
        }));

        // model group
        modelGroup.updateBoundingBox(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON, -size.y / 2 - EPSILON, -EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON, size.y / 2 + EPSILON, size.z + EPSILON)
        ));

        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    updateDefaultConfigId: (type, defaultId, direction = LEFT_EXTRUDER) => (dispatch, getState) => {
        let { series } = getState().machine;
        series = getRealSeries(series);
        let originalConfigId = {};
        if (machineStore.get('defaultConfigId')) {
            originalConfigId = JSON.parse(machineStore.get('defaultConfigId'));
        }
        if (originalConfigId[series]) {
            if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
                switch (direction) {
                    case LEFT_EXTRUDER:
                        originalConfigId[series].material = defaultId;
                        break;
                    case RIGHT_EXTRUDER:
                        originalConfigId[series].materialRight = defaultId;
                        break;
                    default:
                        break;
                }
            } else {
                originalConfigId[series][type] = defaultId;
            }
        } else {
            originalConfigId[series] = {
                ...CONFIG_ID,
                [type]: defaultId
            };
        }

        machineStore.set('defaultConfigId', JSON.stringify(originalConfigId));
    },

    // TODO: init should be  re-called
    init: () => async (dispatch, getState) => {
        await dispatch(actions.initSize());

        const printingState = getState().printing;
        const { modelGroup, gcodeLineGroup, initEventFlag, qualityDefinitions, defaultQualityId } = printingState;
        const printingToolhead = machineStore.get('machine.toolHead.printingToolhead');
        const activeQualityDefinition = lodashFind(qualityDefinitions, { definitionId: defaultQualityId });
        modelGroup.removeAllModels();
        if (printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            modelGroup.initPrimeTower();
            const primeTowerModel = lodashFind(modelGroup.models, { type: 'primeTower' });
            const enablePrimeTower = activeQualityDefinition?.settings?.prime_tower_enable?.default_value;
            !enablePrimeTower && dispatch(actions.hideSelectedModel(primeTowerModel));
        }
        if (!initEventFlag) {
            dispatch(actions.updateState({
                initEventFlag: true
            }));
            // generate gcode event
            controller.on('slice:started', () => {
                const { progressStatesManager } = getState().printing;
                progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SLICE_AND_PREVIEW);
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_SLICING,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SLICING, 0.01)
                }));
            });
            controller.on('slice:completed', (args) => {
                const { gcodeFilename, gcodeFileLength, printTime, filamentLength, filamentWeight, renderGcodeFileName } = args;
                const { progressStatesManager } = getState().printing;
                dispatch(actions.updateState({
                    gcodeFile: {
                        name: gcodeFilename,
                        uploadName: gcodeFilename,
                        size: gcodeFileLength,
                        lastModified: +new Date(),
                        thumbnail: '',
                        renderGcodeFileName
                    },
                    printTime,
                    filamentLength,
                    filamentWeight,
                    stage: STEP_STAGE.PRINTING_SLICING,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SLICING, 1)
                }));
                progressStatesManager.startNextStep();

                modelGroup.unselectAllModels();
                dispatch(actions.loadGcode(gcodeFilename));
            });
            controller.on('slice:progress', (progress) => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                if (progress - state.progress > 0.01 || progress > 1 - EPSILON) {
                    dispatch(actions.updateState({
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SLICING, progress)
                    }));
                }
            });
            controller.on('slice:error', () => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                progressStatesManager.finishProgress(false);
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_SLICE_FAILED
                }));
            });
        }

        gcodeRenderingWorker.onmessage = (e) => {
            const data = e.data;
            const { status, value } = data;
            switch (status) {
                case 'succeed': {
                    const { positions, colors, colors1, layerIndices, typeCodes, toolCodes, layerCount, bounds } = value;
                    const bufferGeometry = new THREE.BufferGeometry();
                    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
                    const colorAttribute = new THREE.Uint8BufferAttribute(colors, 3);
                    // this will map the buffer values to 0.0f - +1.0f in the shader
                    colorAttribute.normalized = true;
                    const color1Attribute = new THREE.Uint8BufferAttribute(colors1, 3);
                    color1Attribute.normalized = true;
                    const layerIndexAttribute = new THREE.Float32BufferAttribute(layerIndices, 1);
                    const typeCodeAttribute = new THREE.Float32BufferAttribute(typeCodes, 1);
                    const toolCodeAttribute = new THREE.Float32BufferAttribute(toolCodes, 1);

                    bufferGeometry.setAttribute('position', positionAttribute);
                    bufferGeometry.setAttribute('a_color', colorAttribute);
                    bufferGeometry.setAttribute('a_color1', color1Attribute);
                    bufferGeometry.setAttribute('a_layer_index', layerIndexAttribute);
                    bufferGeometry.setAttribute('a_type_code', typeCodeAttribute);
                    bufferGeometry.setAttribute('a_tool_code', toolCodeAttribute);

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
                        UNKNOWN: true,
                        TOOL0: true,
                        TOOL1: true
                    };
                    dispatch(actions.updateState({
                        layerCount,
                        layerCountDisplayed: layerCount - 1,
                        gcodeTypeInitialVisibility: {
                            ...gcodeTypeInitialVisibility
                        },
                        renderLineType: false,
                        gcodeLine: object3D
                    }));

                    Object.keys(gcodeTypeInitialVisibility).forEach((type) => {
                        const visible = gcodeTypeInitialVisibility[type];
                        dispatch(actions.setGcodeVisibilityByTypeAndDirection(type, LEFT_EXTRUDER, visible ? 1 : 0));
                        dispatch(actions.setGcodeVisibilityByTypeAndDirection(type, RIGHT_EXTRUDER, visible ? 1 : 0));
                    });
                    dispatch(actions.setGcodeColorByRenderLineType());

                    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
                    dispatch(actions.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ));
                    dispatch(actions.showGcodeLayers(layerCount - 1));
                    dispatch(actions.displayGcode());

                    const { progressStatesManager } = getState().printing;
                    progressStatesManager.startNextStep();
                    dispatch(actions.updateState({
                        stage: STEP_STAGE.PRINTING_PREVIEWING
                    }));
                    break;
                }
                case 'progress': {
                    const state = getState().printing;
                    const { progressStatesManager } = state;
                    if (Math.abs(value - state.progress) > 0.01 || value > 1 - EPSILON) {
                        dispatch(actions.updateState({
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_PREVIEWING, value)
                        }));
                    }
                    break;
                }
                case 'err': {
                    const { progressStatesManager } = getState().printing;
                    progressStatesManager.finishProgress(false);
                    dispatch(actions.updateState({
                        stage: STEP_STAGE.PRINTING_PREVIEW_FAILED,
                        progress: 0
                    }));
                    break;
                }
                default:
                    break;
            }
        };
    },

    getDefaultDefinition: (id) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().printing;
        const def = defaultDefinitions.find(d => d.definitionId === id);
        return def?.settings;
    },

    resetDefinitionById: (definitionId) => (dispatch, getState) => {
        const { defaultDefinitions, qualityDefinitions, materialDefinitions } = getState().printing;
        const newDef = cloneDeep(defaultDefinitions.find(d => d.definitionId === definitionId));
        definitionManager.updateDefinition(newDef);
        dispatch(actions.updateActiveDefinition(newDef));
        // const definition =
        if (definitionId.indexOf('quality') !== -1
            && (definitionId.indexOf('fast_print') !== -1
                || definitionId.indexOf('high_quality') !== -1
                || definitionId.indexOf('normal_quality') !== -1
            )) {
            const index = qualityDefinitions.findIndex(d => d.definitionId === definitionId);
            qualityDefinitions[index] = newDef;
            dispatch(actions.updateState({
                qualityDefinitions: [...qualityDefinitions]
            }));
        } else {
            const index = materialDefinitions.findIndex(d => d.definitionId === definitionId);
            materialDefinitions[index] = newDef;
            dispatch(actions.updateState({
                materialDefinitions: [...materialDefinitions]
            }));
        }
    },

    updateShowPrintingManager: (showPrintingManager, direction = LEFT_EXTRUDER) => (dispatch) => {
        dispatch(actions.updateState({
            showPrintingManager,
            materialManagerDirection: direction
        }));
    },

    updateManagerDisplayType: (managerDisplayType) => (dispatch) => {
        dispatch(actions.updateState({ managerDisplayType }));
    },

    // Update definition settings and save.
    updateDefinitionSettings: (definition, settings) => (dispatch, getState) => {
        const { modelGroup, extruderLDefinition, extruderRDefinition, helpersExtruderConfig } = getState().printing;
        const {
            settings: newSettings,
            extruderLDefinitionSettings,
            extruderRDefinitionSettings
        } = definitionManager.calculateDependencies(
            definition,
            settings,
            modelGroup && modelGroup.hasSupportModel(),
            extruderLDefinition.settings,
            extruderRDefinition.settings,
            helpersExtruderConfig
        );
        settings = newSettings;
        definitionManager.updateDefinition({
            definitionId: 'snapmaker_extruder_0',
            settings: extruderLDefinitionSettings
        });
        extruderLDefinition.settings = extruderLDefinitionSettings;
        dispatch(actions.updateState({
            extruderLDefinition
        }));
        definitionManager.updateDefinition({
            definitionId: 'snapmaker_extruder_1',
            settings: extruderRDefinitionSettings
        });
        extruderRDefinition.settings = extruderRDefinitionSettings;
        dispatch(actions.updateState({
            extruderRDefinition
        }));
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
                if (typeof activeDefinition.settings === 'undefined') {
                    return;
                }
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
            const {
                modelGroup,
                extruderLDefinition,
                extruderRDefinition,
                helpersExtruderConfig
            } = getState().printing;
            definitionManager.calculateDependencies(
                activeDefinition,
                activeDefinition.settings,
                modelGroup && modelGroup.hasSupportModel(),
                extruderLDefinition.settings,
                extruderRDefinition.settings,
                helpersExtruderConfig
            );
        }

        // Update activeDefinition to force component re-render
        dispatch(actions.updateState({ activeDefinition }));
    },

    /**
     *
     * @param definition
     *      {
     *          nozzleSize
     *      }
     * @param direction
     */
    updateExtuderDefinition: (definition, direction = LEFT_EXTRUDER) => (dispatch, getState) => {
        const { activeDefinition, extruderLDefinition, extruderRDefinition, helpersExtruderConfig } = getState().printing;


        if (!definition) {
            return;
        }

        let extruderDef = {};
        if (direction === LEFT_EXTRUDER) {
            extruderDef = extruderLDefinition;
        } else {
            extruderDef = extruderRDefinition;
        }

        if (definition !== extruderDef) {
            if (direction === LEFT_EXTRUDER) {
                extruderDef = {
                    ...extruderLDefinition
                };
            } else {
                extruderDef = {
                    ...extruderRDefinition
                };
            }
            for (const key of definition.ownKeys) {
                if (typeof extruderDef.settings === 'undefined') {
                    return;
                }
                if (extruderDef.settings[key] === undefined) {
                    continue;
                }
                extruderDef.settings[key].default_value = definition.settings[key].default_value;
                extruderDef.settings[key].from = definition.definitionId;
            }
        }

        // update relative definitions
        // nozzle size
        const nozzleSize = extruderDef.settings.machine_nozzle_size.default_value;
        const nozzleSizeRelationSettingsKeys = [
            'line_width',
            'wall_line_width', 'wall_line_width_0', 'wall_line_width_x',
            'skin_line_width',
            'infill_line_width',
            'skirt_brim_line_width',
            'support_line_width',
            'support_interface_line_width', 'support_roof_line_width', 'support_bottom_line_width',
            'prime_tower_line_width'
        ];
        for (const key of nozzleSizeRelationSettingsKeys) {
            extruderDef.settings[key].default_value = nozzleSize;
        }

        // line width active final
        if (helpersExtruderConfig.adhesion === LEFT_EXTRUDER_MAP_NUMBER && direction === LEFT_EXTRUDER
            || helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER && direction === RIGHT_EXTRUDER) {
            activeDefinition.settings.skirt_brim_line_width.default_value = extruderDef.settings.skirt_brim_line_width.default_value;
        }
        if (helpersExtruderConfig.support === LEFT_EXTRUDER_MAP_NUMBER && direction === LEFT_EXTRUDER
            || helpersExtruderConfig.support === RIGHT_EXTRUDER_MAP_NUMBER && direction === RIGHT_EXTRUDER) {
            activeDefinition.settings.support_line_width.default_value = extruderDef.settings.support_line_width.default_value;
            activeDefinition.settings.support_interface_line_width.default_value = extruderDef.settings.support_interface_line_width.default_value;
            activeDefinition.settings.support_roof_line_width.default_value = extruderDef.settings.support_roof_line_width.default_value;
            activeDefinition.settings.support_bottom_line_width.default_value = extruderDef.settings.support_bottom_line_width.default_value;
            activeDefinition.settings.prime_tower_line_width.default_value = extruderDef.settings.prime_tower_line_width.default_value;
        }
        dispatch(actions.updateDefinitionSettings(activeDefinition, activeDefinition.settings));

        if (direction === LEFT_EXTRUDER) {
            dispatch(actions.updateState({
                extruderLDefinition: extruderDef
            }));
            definitionManager.updateDefinition({
                ...extruderDef,
                definitionId: 'snapmaker_extruder_0'
            });
        } else {
            dispatch(actions.updateState({
                extruderRDefinition: extruderDef
            }));
            definitionManager.updateDefinition({
                ...extruderDef,
                definitionId: 'snapmaker_extruder_1'
            });
        }
        dispatch(actions.updateAllModelColors());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
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
        dispatch(actions.updateAllModelColors());
    },

    onUploadManagerDefinition: (file, type) => (dispatch, getState) => {
        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData)
            .then(async (res) => {
                const response = res.body;
                const definitionId = `${type}.${timestamp()}`;
                const definition = await definitionManager.uploadDefinition(definitionId, response.uploadName);
                definition.category = i18n._('key-default_category-Custom');
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
                    name,
                    category: definition.category
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
            return Promise.reject(i18n._('key-Printing/Common-Failed to rename. Please enter a new name.'));
        }
        const definitionsKey = defaultDefinitionKeys[type]?.definitions;

        const definitions = getState().printing[definitionsKey];
        const duplicated = definitions.find(d => d.name === name);

        if (duplicated && duplicated !== definition) {
            return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { name }));
        }

        await definitionManager.updateDefinition({
            definitionId: definition.definitionId,
            name
        });
        const index = definitions.findIndex(d => d.definitionId === definition?.definitionId);
        definitions[index].name = name;
        dispatch(actions.updateState({
            [definitionsKey]: [...definitions]
        }));
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
            category: definition.category,
            ownKeys: definition.ownKeys,
            metadata,
            settings: {}
        };
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        // Find a name not being used
        while (state[definitionsKey].find(d => d.name === newDefinition.name)) {
            newDefinition.name = `#${newDefinition.name}`;
        }
        while (state[definitionsKey].find(d => d.category === newDefinition.category)) {
            newDefinition.category = `#${newDefinition.category}`;
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
    // now only used in reset settings
    removeAllMaterialDefinitions: () => async (dispatch, getState) => {
        const state = getState().printing;

        const newMaterialDefinitions = [];
        const defaultDefinitionIds = ['material.pla', 'material.abs', 'material.petg', 'material.pla.black', 'material.abs.black', 'material.petg.black'];
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
    updateDefaultIdByType: (type, newDefinitionId, direction = LEFT_EXTRUDER) => (dispatch) => {
        let defaultId;
        if (type === 'material') {
            defaultId = direction === LEFT_EXTRUDER ? 'defaultMaterialId' : 'defaultMaterialIdRight';
        } else {
            defaultId = defaultDefinitionKeys[type].id;
        }
        dispatch(actions.updateDefaultConfigId(type, newDefinitionId));
        dispatch(actions.updateState({
            [defaultId]: newDefinitionId
        }));
        dispatch(actions.updateAllModelColors());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },
    updateDefaultMaterialId: (materialId, direction = LEFT_EXTRUDER) => (dispatch) => {
        const updateKey = direction === LEFT_EXTRUDER ? 'defaultMaterialId' : 'defaultMaterialIdRight';
        dispatch(actions.updateDefaultConfigId(PRINTING_MANAGER_TYPE_MATERIAL, materialId, direction));
        dispatch(actions.updateState({ [updateKey]: materialId }));
    },

    updateDefaultQualityId: (qualityId) => (dispatch) => {
        dispatch(actions.updateDefaultConfigId(PRINTING_MANAGER_TYPE_QUALITY, qualityId));
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
    __loadModel: (originalName, uploadName) => async (dispatch) => {
        const headType = 'printing';
        const sourceType = '3d';
        const mode = '3d';
        const width = 0;
        const height = 0;

        await dispatch(actions.generateModel(headType, {
            originalName, uploadName, sourceWidth: width, sourceHeight: height, mode, sourceType, transformation: {}
        }));
    },

    // Upload model
    // @param file
    uploadModel: (file) => async (dispatch, getState) => {
        // Notice user that model is being loading
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.uploadFile(formData);
        const { originalName, uploadName } = res.body;

        actions.__loadModel(originalName, uploadName)(dispatch, getState);
    },

    setTransformMode: (value) => (dispatch) => {
        // dispatch(actions.destroyGcodeLine());
        // dispatch(actions.displayModel());
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
                gcodeFile: null,
                gcodeLine: null,
                displayedType: 'model'
            }));
        }
    },

    generateGcode: (thumbnail, isGuideTours = false) => async (dispatch, getState) => {
        const { hasModel, activeDefinition, modelGroup, progressStatesManager, helpersExtruderConfig,
            extruderLDefinition, extruderRDefinition, defaultMaterialId, defaultMaterialIdRight, materialDefinitions } = getState().printing;
        if (!hasModel) {
            return;
        }
        // update extruder definitions
        const indexL = materialDefinitions.findIndex(d => d.definitionId === defaultMaterialId);
        const indexR = materialDefinitions.findIndex(d => d.definitionId === defaultMaterialIdRight);
        const newExtruderLDefinition = definitionManager.finalizeExtruderDefinition(extruderLDefinition, materialDefinitions[indexL]);
        const newExtruderRDefinition = definitionManager.finalizeExtruderDefinition(extruderRDefinition, materialDefinitions[indexR]);
        dispatch(actions.updateState({
            extruderLDefinition: newExtruderLDefinition,
            extruderRDefinition: newExtruderRDefinition
        }));
        definitionManager.updateDefinition({
            ...newExtruderLDefinition,
            definitionId: 'snapmaker_extruder_0'
        });
        definitionManager.updateDefinition({
            ...newExtruderRDefinition,
            definitionId: 'snapmaker_extruder_1'
        });

        const models = filter(modelGroup.getModels(), { 'visible': true });

        if (!models || models.length === 0) {
            return;
        }

        modelGroup.unselectAllModels();
        if (isGuideTours) {
            dispatch(actions.updateState({
                thumbnail: thumbnail
            }));
        }
        // Info user that slice has started
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SLICE_AND_PREVIEW);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_SLICING,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SLICING, 0)
        }));

        // Prepare model file
        const { model, support, definition, originalName } = await dispatch(actions.prepareModel());
        const currentModelName = path.basename(models[0]?.modelName, path.extname(models[0]?.modelName));
        const renderGcodeFileName = `${currentModelName}_${new Date().getTime()}`;
        // Prepare definition file
        const { size } = getState().machine;
        await dispatch(actions.updateActiveDefinitionMachineSize(size));

        const finalDefinition = definitionManager.finalizeActiveDefinition(activeDefinition);
        const adhesionExtruder = helpersExtruderConfig.adhesion;
        const supportExtruder = helpersExtruderConfig.support;
        finalDefinition.settings.adhesion_extruder_nr.default_value = adhesionExtruder;
        finalDefinition.settings.support_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_infill_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_extruder_nr_layer_0.default_value = supportExtruder;
        finalDefinition.settings.support_interface_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_roof_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_bottom_extruder_nr.default_value = supportExtruder;

        finalDefinition.settings.machine_heated_bed.default_value = extruderLDefinition.settings.machine_heated_bed.default_value;
        finalDefinition.settings.material_bed_temperature.default_value = extruderLDefinition.settings.material_bed_temperature.default_value;
        finalDefinition.settings.material_bed_temperature_layer_0.default_value = extruderLDefinition.settings.material_bed_temperature_layer_0.default_value;

        await api.profileDefinitions.createDefinition(CONFIG_HEADTYPE, finalDefinition);

        // slice
        /*
        const params = {
            modelName: name,
            modelFileName: filename
        };
        */

        const boundingBox = modelGroup.getBoundingBox();
        const params = {
            definition,
            model,
            support,
            originalName,
            boundingBox,
            thumbnail: thumbnail,
            renderGcodeFileName
        };
        controller.slice(params);
    },

    prepareModel: () => (dispatch, getState) => {
        return new Promise((resolve) => {
            const { modelGroup, activeDefinition, extruderLDefinition, extruderRDefinition } = getState().printing;


            // modelGroup.removeHiddenMeshObjects();

            // Use setTimeout to force export executes in next tick, preventing block of updateState()

            setTimeout(async () => {
                const models = modelGroup.models.filter(i => i.visible).reduce((pre, model) => {
                    if (model instanceof ThreeGroup) {
                        pre.push(...model.children);
                    } else {
                        pre.push(model);
                    }
                    return pre;
                }, []);
                const ret = { model: [], support: [], definition: [], originalName: null };
                for (const item of models) {
                    const modelDefinition = definitionManager.finalizeModelDefinition(activeDefinition, item, extruderLDefinition, extruderRDefinition);

                    const mesh = item.cloneMeshWithoutSupports();
                    // mesh.children = []; // remove support children
                    mesh.applyMatrix4(item.meshObject.parent.matrix);
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
                        const definitionName = uploadResult.body.uploadName.replace(/\.stl$/, '');
                        const definitionRes = await api.profileDefinitions.createTmpDefinition(modelDefinition, definitionName);
                        ret.definition.push(definitionRes.body.uploadName);
                    }
                }

                resolve(ret);
            }, 50);
        });
    },

    // preview
    setGcodeVisibilityByTypeAndDirection: (type, direction = LEFT_EXTRUDER, visible) => (dispatch, getState) => {
        const { gcodeLine } = getState().printing;
        const uniforms = gcodeLine.material.uniforms;
        const value = visible ? 1 : 0;
        if (direction === LEFT_EXTRUDER) {
            switch (type) {
                case 'WALL-INNER':
                    uniforms.u_l_wall_inner_visible.value = value;
                    break;
                case 'WALL-OUTER':
                    uniforms.u_l_wall_outer_visible.value = value;
                    break;
                case 'SKIN':
                    uniforms.u_l_skin_visible.value = value;
                    break;
                case 'SKIRT':
                    uniforms.u_l_skirt_visible.value = value;
                    break;
                case 'SUPPORT':
                    uniforms.u_l_support_visible.value = value;
                    break;
                case 'FILL':
                    uniforms.u_l_fill_visible.value = value;
                    break;
                case 'TRAVEL':
                    uniforms.u_l_travel_visible.value = value;
                    break;
                case 'UNKNOWN':
                    uniforms.u_l_unknown_visible.value = value;
                    break;
                default:
                    break;
            }
        } else {
            switch (type) {
                case 'WALL-INNER':
                    uniforms.u_r_wall_inner_visible.value = value;
                    break;
                case 'WALL-OUTER':
                    uniforms.u_r_wall_outer_visible.value = value;
                    break;
                case 'SKIN':
                    uniforms.u_r_skin_visible.value = value;
                    break;
                case 'SKIRT':
                    uniforms.u_r_skirt_visible.value = value;
                    break;
                case 'SUPPORT':
                    uniforms.u_r_support_visible.value = value;
                    break;
                case 'FILL':
                    uniforms.u_r_fill_visible.value = value;
                    break;
                case 'TRAVEL':
                    uniforms.u_r_travel_visible.value = value;
                    break;
                case 'UNKNOWN':
                    uniforms.u_r_unknown_visible.value = value;
                    break;
                default:
                    break;
            }
        }
        dispatch(actions.render());
    },

    setGcodeColorByRenderLineType: () => (dispatch, getState) => {
        const { gcodeLine, renderLineType } = getState().printing;
        const uniforms = gcodeLine.material.uniforms;
        uniforms.u_color_type.value = renderLineType ? 1 : 0;
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
        let transformMode;
        switch (true) {
            // TODO: transformMode update to Array
            case ['scaleX', 'scaleY', 'scaleZ'].some(item => item in transformation):
                transformMode = 'scale';
                break;
            case ['positionX', 'positionY'].some(item => item in transformation):
                transformMode = 'translate';
                break;
            case ['rotationX', 'rotationY', 'rotationZ'].some(item => item in transformation):
                transformMode = 'rotate';
                break;
            default: break;
        }
        dispatch(actions.recordModelBeforeTransform(modelGroup));
        // TODO
        modelGroup.updateSelectedGroupTransformation(transformation, newUniformScalingState);
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform(transformMode, modelGroup));
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
        dispatch(actions.unselectAllModels());
        const modelState = modelGroup.selectAllModels();
        dispatch(actions.updateState(modelState));
    },

    hideSelectedModel: (targetModel) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        let targetModels;
        if (!targetModel) {
            targetModels = modelGroup.getSelectedModelArray();
        } else {
            targetModels = [targetModel];
        }

        const modelState = modelGroup.hideSelectedModel(targetModels);

        const operations = new Operations();
        // targetModels.forEach(model => {
        //     const operation = new VisibleOperation3D({
        //         target: model,
        //         visible: false
        //     });
        //     operations.push(operation);
        // });
        for (const model of targetModels) {
            if (model.type === 'primeTower') continue;
            const operation = new VisibleOperation3D({
                target: model,
                visible: false
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });

        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    showSelectedModel: (targetModel) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.showSelectedModel([targetModel]);

        const operation = new VisibleOperation3D({
            target: targetModel,
            visible: true
        });
        const operations = new Operations();
        if (targetModel.type !== 'primeTower') {
            operations.push(operation);
            operations.registCallbackAfterAll(() => {
                dispatch(actions.updateState(modelGroup.getState()));
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.displayModel());
            });
        }

        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        dispatch(actions.updateState(modelState));
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
        const operations = new Operations();
        for (const model of modelGroup.selectedModelArray) {
            if (model.type === 'primeTower') {
                continue;
            }
            const operation = new DeleteOperation3D({
                target: model
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            const modelState = modelGroup.getState();
            if (!modelState.hasModel) {
                dispatch(actions.updateState({
                    stage: STEP_STAGE.EMPTY,
                    progress: 0
                }));
            }
            dispatch(actions.updateState(modelState));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });
        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));

        const modelState = modelGroup.removeSelectedModel();
        if (!modelState.hasModel) {
            dispatch(actions.updateState({
                stage: STEP_STAGE.EMPTY,
                progress: 0
            }));
        }
        // updateState need before displayModel
        dispatch(actions.updateState(
            modelState
        ));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    removeAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const operations = new Operations();
        for (const model of modelGroup.models) {
            if (model.type === 'primeTower') continue;
            const operation = new DeleteOperation3D({
                target: model,
                parent: null
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            const modelState = modelGroup.getState();
            if (!modelState.hasModel) {
                dispatch(actions.updateState({
                    stage: STEP_STAGE.EMPTY,
                    progress: 0
                }));
            }
            dispatch(actions.updateState(modelState));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.render());
        });
        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));

        const modelState = modelGroup.removeAllModels();

        dispatch(actions.updateState({
            stage: STEP_STAGE.EMPTY,
            progress: 0
        }));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.render());
    },

    updateSelectedModelsExtruder: (extruderConfig) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const models = Object.assign([], getState().printing.modelGroup.models);
        for (const model of modelGroup.selectedModelArray) {
            let modelItem = null;
            modelGroup.traverseModels(models, (item) => {
                if (model.modelID === item.modelID) {
                    modelItem = item;
                }
            });
            if (modelItem) {
                modelItem.extruderConfig = extruderConfig;
                modelItem.children && modelItem.children.length && modelItem.children.forEach(item => {
                    item.extruderConfig = extruderConfig;
                });
            }
        }
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateAllModelColors());
        modelGroup.models = [...models];
        // dispatch(actions.updateState({
        //     modelGroup
        // }));
    },

    updateHelpersExtruder: (extruderConfig) => (dispatch) => {
        dispatch(actions.updateState({ helpersExtruderConfig: extruderConfig }));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },
    arrangeAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        const modelState = modelGroup.arrangeAllModels();
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('translate', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.render());
    },

    recordModelBeforeTransform: (modelGroup) => (dispatch) => {
        dispatch(operationHistoryActions.clearTargetTmpState(INITIAL_STATE.name));
        for (const model of modelGroup.selectedModelArray) {
            if (model.supportTag) {
                dispatch(actions.onModelTransform());
            }
            dispatch(operationHistoryActions.updateTargetTmpState(INITIAL_STATE.name, model.modelID, {
                from: { ...model.transformation }
            }));
        }
    },

    recordModelAfterTransform: (transformMode, modelGroup) => (dispatch, getState) => {
        const { targetTmpState } = getState().printing;
        const operations = new Operations();
        let operation;

        function stateEqual(model, stateFrom, stateTo) {
            for (const key of Object.keys(stateFrom)) {
                if ((model.parent instanceof ThreeGroup || key !== 'positionZ') && Math.abs(stateFrom[key] - stateTo[key]) > EPSILON) {
                    return false;
                }
            }
            return true;
        }
        if (transformMode === 'rotate') {
            dispatch(actions.clearAllManualSupport(operations));
        }
        for (const model of modelGroup.selectedModelArray) {
            dispatch(operationHistoryActions.updateTargetTmpState(INITIAL_STATE.name, model.modelID, {
                to: { ...model.transformation }
            }));
            if (stateEqual(model, targetTmpState[model.modelID].from, targetTmpState[model.modelID].to)) {
                continue;
            }
            switch (transformMode) {
                case 'translate':
                    operation = new MoveOperation3D({
                        target: model,
                        ...targetTmpState[model.modelID]
                    });
                    break;
                case 'rotate':
                    operation = new RotateOperation3D({
                        target: model,
                        ...targetTmpState[model.modelID]
                    });
                    break;
                case 'scale':
                    operation = new ScaleOperation3D({
                        target: model,
                        ...targetTmpState[model.modelID]
                    });
                    break;
                default: break;
            }
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
            dispatch(actions.render());
        });
        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
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
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        // }
    },


    duplicateSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.duplicateSelectedModel();
        const canDuplicateModels = filter(modelGroup.selectedModelArray, (model) => model.type !== 'primeTower');
        const operations = new Operations();
        for (const model of canDuplicateModels) {
            const operation = new AddOperation3D({
                target: model,
                parent: null
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });
        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));

        dispatch(actions.updateState(modelState));
        dispatch(actions.updateAllModelColors());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    cut: () => (dispatch) => {
        dispatch(actions.copy());
        dispatch(actions.removeSelectedModel());
    },

    copy: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.copy();
        dispatch(actions.render());
    },

    paste: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.paste();

        const operations = new Operations();
        for (const model of modelGroup.getSelectedModelArray()) {
            if (model.type === 'primeTower') continue;
            const operation = new AddOperation3D({
                target: model,
                parent: null
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });
        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));

        dispatch(actions.updateState(modelState));
        dispatch(actions.updateAllModelColors());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    layFlatSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        const modelState = modelGroup.layFlatSelectedModel();
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('rotate', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    autoRotateSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        const modelState = modelGroup.autoRotateSelectedModel();
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('rotate', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    scaleToFitSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const { size } = getState().machine;
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        const modelState = modelGroup.scaleToFitSelectedModel(size);
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('scale', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    resetSelectedModelTransformation: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        const modelState = modelGroup.resetSelectedModelTransformation();
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('scale', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    // uploadModel
    undo: () => (dispatch, getState) => {
        const { canUndo } = getState().printing.history;
        if (canUndo) {
            dispatch(operationHistoryActions.undo(INITIAL_STATE.name));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
            dispatch(actions.render());
        }
    },

    redo: () => (dispatch, getState) => {
        const { canRedo } = getState().printing.history;
        if (canRedo) {
            dispatch(operationHistoryActions.redo(INITIAL_STATE.name));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
            dispatch(actions.render());
        }
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

    loadGcode: (gcodeFilename) => (dispatch, getState) => {
        const { progressStatesManager, extruderLDefinition, extruderRDefinition } = getState().printing;
        progressStatesManager.startNextStep();
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_PREVIEWING,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SLICING, 0)
        }));
        const extruderColors = { toolColor0: extruderLDefinition.settings.color.default_value, toolColor1: extruderRDefinition.settings.color.default_value };
        gcodeRenderingWorker.postMessage({ func: '3DP', gcodeFilename, extruderColors });
    },
    saveSupport: (model) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.saveSupportModel(model);
        if (!model.isInitSupport) {
            // save generated support into operation history
            const operation = new AddOperation3D({
                target: model,
                parent: model.target
            });
            operation.description = 'AddSupport';
            const operations = new Operations();
            operations.push(operation);
            dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        }
    },
    clearAllManualSupport: (combinedOperations) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const supports = modelGroup.getSupports();
        if (supports && supports.length > 0) {
            let operations = new Operations();
            if (combinedOperations) {
                operations = combinedOperations;
            }
            for (const model of supports) {
                const operation = new DeleteOperation3D({
                    target: model
                });
                operations.push(operation);
            }
            if (!combinedOperations) {
                dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
            }

            modelGroup.removeAllManualSupport();
        }
    },
    setDefaultSupportSize: (size) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.defaultSupportSize = size;
    },
    generateModel: (headType, { loadFrom = LOAD_MODEL_FROM_INNER, originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, transformation, modelID, extruderConfig, isGroup = false, parentModelID = '', modelName, children, primeTowerTag }) => async (dispatch, getState) => {
        const { progressStatesManager, defaultQualityId, qualityDefinitions } = getState().printing;
        const { toolHead: { printingToolhead } } = getState().machine;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_LOADING_MODEL,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 0.25)
        }));

        const { size } = getState().machine;
        const uploadPath = `${DATA_PREFIX}/${uploadName}`;
        const { modelGroup } = getState().printing;

        if (isGroup) {
            const modelState = await modelGroup.generateModel({
                loadFrom,
                limitSize: size,
                headType,
                sourceType,
                originalName,
                uploadName,
                modelName,
                mode: mode,
                sourceWidth,
                width: sourceWidth,
                sourceHeight,
                height: sourceHeight,
                geometry: null,
                material: null,
                transformation,
                modelID,
                extruderConfig,
                isGroup,
                children
            });
            dispatch(actions.updateState(modelState));
            dispatch(actions.displayModel());
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.updateState({
                stage: STEP_STAGE.PRINTING_LOAD_MODEL_SUCCEED,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1)
            }));
        } else if (primeTowerTag && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            const activeActiveQualityDefinition = lodashFind(qualityDefinitions, { definitionId: defaultQualityId });
            const initHeight = transformation?.scaleZ || 0.1;
            modelGroup.initPrimeTower(initHeight, transformation);
            const enabledPrimeTower = activeActiveQualityDefinition.settings.prime_tower_enable.default_value;
            const primeTowerModel = lodashFind(modelGroup.models, { type: 'primeTower' });
            !enabledPrimeTower && dispatch(actions.hideSelectedModel(primeTowerModel));
        } else {
            const onMessage = async (e) => {
                const data = e.data;

                const { type } = data;
                switch (type) {
                    case 'LOAD_MODEL_POSITIONS': {
                        const { positions, originalPosition } = data;

                        const bufferGeometry = new THREE.BufferGeometry();
                        const modelPositionAttribute = new THREE.BufferAttribute(positions, 3);
                        const material = new THREE.MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 0 });

                        bufferGeometry.setAttribute('position', modelPositionAttribute);
                        bufferGeometry.computeVertexNormals();
                        // Create model
                        // modelGroup.generateModel(modelInfo);

                        const modelState = await modelGroup.generateModel({
                            loadFrom,
                            limitSize: size,
                            headType,
                            sourceType,
                            originalName,
                            modelName,
                            uploadName,
                            mode: mode,
                            sourceWidth,
                            width: sourceWidth,
                            sourceHeight,
                            height: sourceHeight,
                            geometry: bufferGeometry,
                            material: material,
                            transformation,
                            originalPosition,
                            modelID,
                            extruderConfig,
                            parentModelID
                        });
                        dispatch(actions.updateState(modelState));
                        dispatch(actions.updateAllModelColors());
                        dispatch(actions.displayModel());
                        dispatch(actions.destroyGcodeLine());
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_LOAD_MODEL_SUCCEED,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1)
                        }));
                        break;
                    }
                    case 'LOAD_MODEL_CONVEX': {
                        const { positions } = data;

                        const convexGeometry = new THREE.BufferGeometry();
                        const positionAttribute = new THREE.BufferAttribute(positions, 3);
                        convexGeometry.setAttribute('position', positionAttribute);

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
                        progressStatesManager.finishProgress(false);
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_LOAD_MODEL_FAILED,
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
    },
    recordAddOperation: (model) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        if (!model.supportTag) {
            // support should be recorded when mouse clicked
            const operation = new AddOperation3D({
                target: model,
                parent: null
            });
            const operations = new Operations();
            operations.push(operation);
            operations.registCallbackAfterAll(() => {
                const modelState = modelGroup.getState();
                if (!modelState.hasModel) {
                    dispatch(actions.updateState({
                        stage: STEP_STAGE.EMPTY,
                        progress: 0
                    }));
                }
                dispatch(actions.updateState(modelState));
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.render());
            });
            dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        }
    },

    startAnalyzeRotationProgress: () => (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_ROTATE_ANALYZE);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_ROTATE_ANALYZE,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ROTATE_ANALYZE, 0.25)
        }));
    },

    rotateByPlane: (targetPlane) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.rotateByPlane(targetPlane);
        modelGroup.onModelAfterTransform();

        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    analyzeSelectedModelRotation: () => (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;
        if (modelGroup.getSelectedModelArray()?.length === 1) {
            // calculate model rotation info, convex calculation may take more time, use async way
            modelGroup.analyzeSelectedModelRotationAsync().then(tableResult => {
                if (tableResult) {
                    dispatch(actions.updateState({
                        rotationAnalysisTable: tableResult
                    }));
                }
                dispatch(actions.setTransformMode('rotate-placement'));
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_ROTATE_ANALYZE,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ROTATE_ANALYZE, 1)
                }));
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.displayModel());
            }).catch(() => { });
        }
    },

    clearRotationAnalysisTableData: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.resetSelectedModelConvexMeshGroup();
        dispatch(actions.updateState({
            rotationAnalysisTable: []
        }));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    setRotationPlacementFace: (userData) => (dispatch) => {
        dispatch(actions.updateState({
            rotationAnalysisSelectedRowId: userData.index
        }));
    },

    setShortcutStatus: (enabled) => (dispatch) => {
        dispatch(actions.updateState({
            enableShortcut: enabled
        }));
    },

    setLeftBarOverlayVisible: (visible) => (dispatch) => {
        dispatch(actions.updateState({
            leftBarOverlayVisible: visible
        }));
    },
    groupAndAlign: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const modelsbeforeGroup = modelGroup.getModels().slice(0);
        const selectedModels = modelGroup.getSelectedModelArray().slice(0);
        const selectedModelsPositionMap = new Map();
        selectedModels.forEach(model => {
            selectedModelsPositionMap.set(model.modelID, {
                x: model.transformation.positionX,
                y: model.transformation.positionY,
                z: model.transformation.positionZ,
            });
        });
        // const groups = modelGroup.getSelectedModelArray().filter(model => model instanceof ThreeGroup);
        // const groupChildrenMap = new Map();
        // groups.forEach(group => {
        //     groupChildrenMap.set(group, group.children.slice(0));
        // });
        const newPosition = modelGroup.updateModelsPositionBaseFirstModel(selectedModels);
        const operations = new Operations();

        dispatch(actions.clearAllManualSupport(operations));
        const { modelState } = modelGroup.group(ALIGN_OPERATION);
        const modelsafterGroup = modelGroup.getModels().slice(0);

        const operation = new GroupAlignOperation3D({
            selectedModelsPositionMap,
            // groupChildrenMap,
            modelsbeforeGroup,
            modelsafterGroup,
            selectedModels,
            newPosition,
            target: modelGroup.getSelectedModelArray()[0],
            modelGroup
        });
        operations.push(operation);
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });

        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    group: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const groups = modelGroup.getSelectedModelArray().filter(model => model instanceof ThreeGroup);
        const modelsBeforeGroup = modelGroup.getModels().slice(0);
        const selectedModels = modelGroup.getSelectedModelArray().slice(0);
        const groupChildrenMap = new Map();
        groups.forEach(group => {
            groupChildrenMap.set(group, group.children.slice(0));
        });
        const operations = new Operations();

        const { recovery } = modelGroup.unselectAllModels({ recursive: true });

        const modelsInGroup = selectedModels.reduce((pre, selectd) => {
            const group = selectd.parent?.clone(modelGroup);
            pre.set(selectd.modelID, {
                groupModel: group,
                groupMesh: selectd.parent?.meshObject.clone(),
                modelTransformation: { ...selectd.transformation },
                groupTransformation: { ...group?.transformation }
            });
            if (selectd instanceof ThreeGroup) {
                selectd.children.forEach((subModel) => {
                    pre.set(subModel.modelID, {
                        modelTransformation: { ...subModel.transformation }
                    });
                });
            }
            return pre;
        }, new Map());
        recovery();


        dispatch(actions.clearAllManualSupport(operations));
        const modelState = modelGroup.group();

        const modelsAfterGroup = modelGroup.getModels().slice(0);
        const newGroup = modelGroup.getSelectedModelArray()[0];
        const operation = new GroupOperation3D({
            groupChildrenMap,
            modelsBeforeGroup,
            modelsAfterGroup,
            selectedModels,
            target: newGroup,
            targetTransformation: { ...newGroup.transformation },
            targetChildrenTransformation: newGroup.children.reduce((pre, subModel) => {
                pre.set(subModel.modelID, {
                    ...subModel.transformation
                });
                return pre;
            }, new Map()),
            modelGroup,
            modelsInGroup
        });
        operations.push(operation);
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });

        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    ungroup: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        const groups = modelGroup.getSelectedModelArray().filter(model => model instanceof ThreeGroup);
        const modelsBeforeUngroup = modelGroup.getModels().slice(0);
        const groupChildrenMap = new Map();
        groups.forEach(group => {
            groupChildrenMap.set(group, {
                groupTransformation: { ...group.transformation },
                subModelStates: group.children.map(model => {
                    return {
                        target: model,
                        transformation: { ...model.transformation }
                    };
                })
            });
        });
        const operations = new Operations();

        dispatch(actions.clearAllManualSupport(operations));
        const modelState = modelGroup.ungroup();

        groups.forEach(group => {
            const operation = new UngroupOperation3D({
                modelsBeforeUngroup,
                target: group,
                groupTransformation: groupChildrenMap.get(group).groupTransformation,
                subModelStates: groupChildrenMap.get(group).subModelStates,
                modelGroup,
            });
            operations.push(operation);
        });
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });

        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    setModelsMeshColor: (direction, color) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const models = modelGroup.getModels();
        modelGroup.traverseModels(models, (model) => {
            if (model.extruderConfig.shell === (direction === LEFT_EXTRUDER ? '0' : '1')) {
                model.updateMaterialColor(color);
            }
            if (model?.parent && model.parent instanceof ThreeGroup) {
                const groupShell = model.parent.children.reduce((pre, subModel) => {
                    pre.add(subModel.extruderConfig.shell);
                    return pre;
                }, new Set());
                if (groupShell.size === 1) {
                    model.parent.extruderConfig.shell = Array.from(groupShell.values())[0];
                } else {
                    model.parent.extruderConfig.shell = '2';
                }
            }
        });
        modelGroup.models = models.concat();
        dispatch(actions.render());
    },

    getMeshColor: (direction) => (dispatch, getState) => {
        const { materialDefinitions, defaultMaterialId, defaultMaterialIdRight } = getState().printing;
        const materialID = (direction === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight);
        const index = materialDefinitions.findIndex(d => d.definitionId === materialID);
        if (index >= 0) {
            return materialDefinitions[index].settings.color.default_value;
        } else {
            return materialDefinitions[0].settings.color.default_value;
        }
    },

    updateAllModelColors: () => (dispatch) => {
        const leftColor = dispatch(actions.getMeshColor(LEFT_EXTRUDER));
        dispatch(actions.setModelsMeshColor(LEFT_EXTRUDER, leftColor));
        const rightColor = dispatch(actions.getMeshColor(RIGHT_EXTRUDER));
        dispatch(actions.setModelsMeshColor(RIGHT_EXTRUDER, rightColor));
    },

    checkNewUser: () => (dispatch) => {
        api.checkNewUser().then((res) => {
            const isNewUser = res?.body?.isNewUser;
            dispatch(actions.updateState({
                isNewUser
            }));
        }).catch((err) => {
            console.log({ err });
            dispatch(actions.updateState({
                isNewUser: true
            }));
        });
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
