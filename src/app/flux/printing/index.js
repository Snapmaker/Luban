import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import path from 'path';
import { throttle, cloneDeep, isNil, filter, find as lodashFind } from 'lodash';
// import FileSaver from 'file-saver';
import { Vector3 } from 'three';
import { GCodeParser } from '../../lib/gcode-viewer/parser';
import workerManager from '../../lib/manager/workerManager';
import {
    ABSENT_OBJECT,
    EPSILON,
    DATA_PREFIX,
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
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    DUAL_EXTRUDER_LIMIT_WIDTH_L,
    DUAL_EXTRUDER_LIMIT_WIDTH_R, BOTH_EXTRUDER_MAP_NUMBER,
    WHITE_COLOR,
    BLACK_COLOR,
    GCODE_VISIBILITY_TYPE,
    GCODEPREVIEWMODES
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
import ModelLoader from '../../ui/widgets/PrintingVisualizer/ModelLoader';
import { controller } from '../../lib/controller';
/* eslint-disable-next-line import/no-cycle */
import { actions as operationHistoryActions } from '../operation-history';
import { actions as appGlobalActions } from '../app-global';
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
import DeleteSupportsOperation3D from '../operation-history/DeleteSupportsOperation3D';
import AddSupportsOperation3D from '../operation-history/AddSupportsOperation3D';
import ArrangeOperation3D from '../operation-history/ArrangeOperation3D';
import ScaleToFitWithRotateOperation3D from '../operation-history/ScaleToFitWithRotateOperation3D';
import PrimeTowerModel from '../../models/PrimeTowerModel';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import { TYPE_SETTINGS } from '../../lib/gcode-viewer/constants';

// register methods for three-mesh-bvh
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

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
    promptTasks: [],

    selectedModelIDArray: [],
    selectedModelArray: [],
    modelGroup: new ModelGroup(HEAD_PRINTING),

    // G-code
    gcodeFile: null,
    printTime: 0,
    filamentLength: 0,
    filamentWeight: 0,
    gcodeLineGroup: new THREE.Group(),
    gcodeLineObjects: [],
    gcodeParser: null,
    gcodeLine: null,
    layerCount: 0,
    layerRangeDisplayed: [0, Infinity],
    gcodeTypeInitialVisibility: {
        [LEFT_EXTRUDER]: {
            ...GCODE_VISIBILITY_TYPE
        },
        [RIGHT_EXTRUDER]: {
            ...GCODE_VISIBILITY_TYPE
        }
    },
    gcodePreviewMode: GCODEPREVIEWMODES[0],
    gcodePreviewModeToogleVisible: false,
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
    stopArea: {
        left: 0,
        right: 0,
        front: 0,
        back: 0
    },


    // PrintingManager
    showPrintingManager: false,
    managerDisplayType: PRINTING_MANAGER_TYPE_MATERIAL,
    materialManagerDirection: LEFT_EXTRUDER,

    // others
    transformMode: '', // translate/scale/rotate
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
    combinedOperations: [], // used for recording different operations

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

    tmpSupportFaceMarks: {},
    supportOverhangAngle: 50,
    supportBrushStatus: 'add' // add | remove
};


const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';
const ACTION_UPDATE_TRANSFORMATION = 'printing/ACTION_UPDATE_TRANSFORMATION';

// avoid parallel loading of same file
const createLoadModelWorker = (() => {
    const runningTasks = {};
    return (uploadPath, onMessage) => {
        let task = runningTasks[uploadPath];
        if (!task) {
            task = {
                worker: workerManager.loadModel([{ uploadPath }], async (data) => {
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
                            fn(data);
                        }
                    }
                }),
                cbOnMessage: []
            };
            runningTasks[uploadPath] = task;
        }

        task.cbOnMessage.push(onMessage);
    };
})();


function stateEqual(model, stateFrom, stateTo) {
    for (const key of Object.keys(stateFrom)) {
        if ((model.parent instanceof ThreeGroup || key !== 'positionZ') && Math.abs(stateFrom[key] - stateTo[key]) > EPSILON) {
            return false;
        }
    }
    return true;
}

async function uploadMesh(mesh, stlFileName) {
    const stl = new ModelExporter().parse(mesh, 'stl', true);
    const blob = new Blob([stl], { type: 'text/plain' });
    const fileOfBlob = new File([blob], stlFileName);

    const formData = new FormData();
    formData.append('file', fileOfBlob);
    const uploadResult = await api.uploadFile(formData);
    return uploadResult;
}

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
        const { gcodeLineGroup } = printingState;
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
        dispatch(actions.updateBoundingBox());
        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    initSize: () => async (dispatch, getState) => {
        // also used in actions.saveAndClose of project/index.js

        // state
        const printingState = getState().printing;
        const { modelGroup, gcodeLineGroup, defaultMaterialId, defaultQualityId } = printingState;
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
        dispatch(actions.updateActiveDefinitionById(PRINTING_MANAGER_TYPE_MATERIAL, defaultMaterialId, false));
        dispatch(actions.updateActiveDefinitionById(PRINTING_MANAGER_TYPE_QUALITY, defaultQualityId, false));

        // Update machine size after active definition is loaded
        const { size } = getState().machine;
        dispatch(actions.updateActiveDefinitionMachineSize(size));
        dispatch(actions.updateState({
            defaultDefinitions: definitionManager?.defaultDefinitions,
            materialDefinitions: await definitionManager.getDefinitionsByPrefixName('material'),
            qualityDefinitions: await definitionManager.getDefinitionsByPrefixName('quality')
        }));

        // model group
        dispatch(actions.updateBoundingBox());

        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    updateBoundingBox: () => (dispatch, getState) => {
        const { modelGroup, activeDefinition, extruderLDefinition, extruderRDefinition, helpersExtruderConfig } = getState().printing;
        const extruderLDefinitionSettings = extruderLDefinition.settings;
        const extruderRDefinitionSettings = extruderRDefinition.settings;
        const { size, toolHead: { printingToolhead } } = getState().machine;
        // TODO
        let useLeft = false;
        let useRight = false;
        if (helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER) {
            useRight = true;
        } else {
            useLeft = true;
        }
        if (helpersExtruderConfig.support === RIGHT_EXTRUDER_MAP_NUMBER) {
            useRight = true;
        } else {
            useLeft = true;
        }
        modelGroup.getModels().forEach((model) => {
            // TODO, use constants
            if (model.type === 'baseModel' || model.type === 'group') {
                if (model.extruderConfig.infill === RIGHT_EXTRUDER_MAP_NUMBER || model.extruderConfig.infill === BOTH_EXTRUDER_MAP_NUMBER) {
                    useRight = true;
                }
                if (model.extruderConfig.infill === LEFT_EXTRUDER_MAP_NUMBER || model.extruderConfig.infill === BOTH_EXTRUDER_MAP_NUMBER) {
                    useLeft = true;
                }
                if (model.extruderConfig.shell === RIGHT_EXTRUDER_MAP_NUMBER || model.extruderConfig.shell === BOTH_EXTRUDER_MAP_NUMBER) {
                    useRight = true;
                }
                if (model.extruderConfig.shell === LEFT_EXTRUDER_MAP_NUMBER || model.extruderConfig.shell === BOTH_EXTRUDER_MAP_NUMBER) {
                    useLeft = true;
                }
            }
        });

        const leftExtruderBorder = ((useRight && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) ? DUAL_EXTRUDER_LIMIT_WIDTH_L : 0);
        const rightExtruderBorder = ((useLeft && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) ? DUAL_EXTRUDER_LIMIT_WIDTH_R : 0);

        const adhesionType = activeDefinition?.settings?.adhesion_type?.default_value;
        let border = 0;
        let supportLineWidth = 0;
        switch (adhesionType) {
            case 'skirt': {
                const skirtLineCount = activeDefinition?.settings?.skirt_line_count?.default_value;
                supportLineWidth = extruderLDefinitionSettings?.machine_nozzle_size?.default_value ?? 0;
                if (helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER) {
                    supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size.default_value;
                }
                border = 7 + (skirtLineCount - 1) * supportLineWidth;

                break;
            }
            case 'brim': {
                const brimLineCount = activeDefinition?.settings?.brim_line_count?.default_value;
                supportLineWidth = extruderLDefinitionSettings?.machine_nozzle_size?.default_value ?? 0;
                if (helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER) {
                    supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size.default_value;
                }
                border = brimLineCount * supportLineWidth;
                break;
            }
            case 'raft': {
                const raftMargin = activeDefinition?.settings?.raft_margin?.default_value;
                border = raftMargin;
                break;
            }
            default:
                border = 0;
                break;
        }
        const newStopArea = {
            left: leftExtruderBorder + border,
            right: rightExtruderBorder + border,
            front: border,
            back: border
        };
        dispatch(actions.updateState({
            stopArea: newStopArea
        }));

        modelGroup.updateBoundingBox(new THREE.Box3(
            new THREE.Vector3(-size.x / 2 - EPSILON + newStopArea.left, -size.y / 2 + newStopArea.front - EPSILON, -EPSILON),
            new THREE.Vector3(size.x / 2 + EPSILON - newStopArea.right, size.y / 2 - newStopArea.back + EPSILON, size.z + EPSILON)
        ));
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
        const { modelGroup, initEventFlag, qualityDefinitions, defaultQualityId } = printingState;
        // TODO
        const { toolHead: { printingToolhead } } = getState().machine;
        // const printingToolhead = machineStore.get('machine.toolHead.printingToolhead');
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
                dispatch(actions.setTransformMode(''));
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

            // generate supports
            controller.on('generate-support:started', () => {
                const { progressStatesManager } = getState().printing;
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL, 0.01)
                }));
            });
            controller.on('generate-support:completed', (args) => {
                const { supportFilePaths } = args;
                const { progressStatesManager } = getState().printing;
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL, 1)
                }));

                dispatch(actions.loadSupports(supportFilePaths));
            });
            controller.on('generate-support:progress', (progress) => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                if (progress - state.progress > 0.01 || progress > 1 - EPSILON) {
                    dispatch(actions.updateState({
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL, progress)
                    }));
                }
            });
            controller.on('generate-support:error', () => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                progressStatesManager.finishProgress(false);
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_FAILED
                }));
            });
        }
    },
    gcodeRenderingCallback: (data) => (dispatch, getState) => {
        const { gcodeLineGroup, gcodeTypeInitialVisibility, gcodePreviewMode, gcodeLineObjects, gcodeParser } = getState().printing;

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
                // gcodeLineGroup.add(object3D);
                console.log('object3D', object3D);
                // const testObj = new LineTubeGeometry(8);
                // const p1 = new LinePoint(new THREE.Vector3(100, 100, 0), 20, new THREE.Color('29BEB0'));
                // const p2 = new LinePoint(new THREE.Vector3(50, 50, 0), 20, new THREE.Color('29BEB0'));
                // testObj.add(p1);
                // testObj.add(p2);
                // testObj.finish();
                // testObj.slice(0, 1);
                // gcodeLineGroup.add(testObj);

                gcodeLineObjects.forEach(object => {
                    gcodeLineGroup.remove(object);
                });
                gcodeParser && gcodeParser.dispose();

                const gcode = value.gcode;
                const parser = new GCodeParser(gcode);
                parser.travelWidth = 0.1;
                parser.radialSegments = 3;
                parser.parse();
                parser.slice();
                console.log('geometries', parser.getGeometries());

                const json = JSON.parse(machineStore.get('scene'));
                const objectLoader = new THREE.ObjectLoader();
                const images = objectLoader.parseImages(json.images);
                const textures = objectLoader.parseTextures(json.textures, images);
                const materials = objectLoader.parseMaterials(json.materials, textures);
                const newMaterial = Object.values(materials)[0];
                const material = newMaterial.clone();
                material.vertexColors = true;

                const newGcodeLineObjects = [];
                parser.getGeometries().forEach(geometry => {
                    const newGcodeLineObject = new THREE.Mesh(geometry, material);
                    // console.log('geometry', geometry);
                    gcodeLineGroup.add(newGcodeLineObject);
                    newGcodeLineObjects.push(newGcodeLineObject);
                });

                object3D.position.copy(new THREE.Vector3());
                dispatch(actions.updateState({
                    layerCount,
                    layerRangeDisplayed: [0, layerCount - 1],
                    renderLineType: false,
                    gcodeLine: object3D,
                    gcodeLineObjects: newGcodeLineObjects,
                    gcodeParser: parser
                }));
                dispatch(actions.renderShowGcodeLines());

                dispatch(actions.updateGcodePreviewMode(gcodePreviewMode));

                Object.keys(GCODE_VISIBILITY_TYPE).forEach((type) => {
                    dispatch(actions.setGcodeVisibilityByTypeAndDirection(type, LEFT_EXTRUDER, gcodeTypeInitialVisibility[LEFT_EXTRUDER][type] ? 1 : 0));
                    dispatch(actions.setGcodeVisibilityByTypeAndDirection(type, RIGHT_EXTRUDER, gcodeTypeInitialVisibility[RIGHT_EXTRUDER][type] ? 1 : 0));
                });
                dispatch(actions.setGcodeColorByRenderLineType());

                const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
                dispatch(actions.checkGcodeBoundary(minX, minY, minZ, maxX, maxY, maxZ));
                dispatch(actions.showGcodeLayers([0, layerCount - 1]));
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
    },

    getDefaultDefinition: (id) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().printing;
        const def = defaultDefinitions.find(d => d.definitionId === id);
        return def?.settings;
    },

    resetDefinitionById: (type, definitionId, shouldDestroyGcodeLine) => (dispatch, getState) => {
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const state = getState().printing;
        const defaultDefinitions = state.defaultDefinitions;
        const definitions = getState().printing[definitionsKey];

        const newDef = cloneDeep(defaultDefinitions.find(d => d.definitionId === definitionId));
        definitionManager.updateDefinition(newDef);
        dispatch(actions.updateActiveDefinition(newDef));
        const index = definitions.findIndex(d => d.definitionId === definitionId);
        definitions[index] = newDef;

        dispatch(actions.updateState({
            [definitionsKey]: [...definitions]
        }));
        dispatch(actions.updateBoundingBox());
        if (shouldDestroyGcodeLine) {
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        }
        return newDef;
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
    updateDefinitionSettings: (definition, settings, updateExtruderDefinition = true) => (dispatch, getState) => {
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
        if (updateExtruderDefinition) {
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
        }
        dispatch(actions.updateBoundingBox());
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

    updateActiveDefinitionById: (type, definitionId, shouldSave = true) => (dispatch, getState) => {
        const state = getState().printing;
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const definition = state[definitionsKey].find((item) => {
            return item.definitionId === definitionId;
        });
        if (definition) {
            dispatch(actions.updateActiveDefinition(definition, shouldSave));
        }
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
        dispatch(actions.updateBoundingBox());
    },

    /**
     *
     * @param definition
     *      {
     *          nozzleSize
     *      }
     * @param direction
     */
    updateExtruderDefinition: (definition, direction = LEFT_EXTRUDER) => (dispatch, getState) => {
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
            activeDefinition.settings.prime_tower_wipe_enabled.default_value = true;
        }
        dispatch(actions.updateDefinitionSettings(activeDefinition, activeDefinition.settings, false));

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
        dispatch(actions.updateBoundingBox());
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
        return new Promise((resolve) => {
            const formData = new FormData();
            formData.append('file', file);
            api.uploadFile(formData)
                .then(async (res) => {
                    const response = res.body;
                    const definitionId = `${type}.${timestamp()}`;
                    const definition = await definitionManager.uploadDefinition(definitionId, response.uploadName);

                    let name = definition.name;
                    const definitionsKey = defaultDefinitionKeys[type].definitions;
                    const definitions = getState().printing[definitionsKey];
                    while (definitions.find(e => e.name === name)) {
                        name = `#${name}`;
                    }
                    await definitionManager.updateDefinition({
                        definitionId: definition.definitionId,
                        name
                    });
                    dispatch(actions.updateState({
                        [definitionsKey]: [...definitions, definition]
                        // Newly imported profiles should not be automatically applied
                        // [defaultId]: definitionId
                    }));
                    resolve(definition);
                })
                .catch(() => {
                    // Ignore error
                });
        });
    },

    updateDefinitionNameByType: (type, definition, name, isCategorySelected = false) => async (dispatch, getState) => {
        if (!name || name.trim().length === 0) {
            return Promise.reject(i18n._('key-Printing/Common-Failed to rename. Please enter a new name.'));
        }
        const definitionsKey = defaultDefinitionKeys[type]?.definitions;

        const definitions = getState().printing[definitionsKey];
        const duplicated = definitions.find(d => d.name === name);

        if (duplicated && duplicated !== definition) {
            return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { name }));
        }
        if (isCategorySelected) {
            const oldCategory = definition.category;
            definitions.forEach((item) => {
                if (item.category === oldCategory) {
                    item.category = name;
                    item.i18nCategory = '';
                    definitionManager.updateDefinition(item);
                }
            });
        } else {
            await definitionManager.updateDefinition({
                definitionId: definition.definitionId,
                name
            });
            const index = definitions.findIndex(d => d.definitionId === definition?.definitionId);
            definitions[index].name = name;
        }
        dispatch(actions.updateState({
            [definitionsKey]: [...definitions]
        }));
        return null;
    },

    /**
     * @param {*} type 'material'|'quality'
     */
    duplicateDefinitionByType: (type, definition, newDefinitionId, newDefinitionName) => async (dispatch, getState) => {
        const state = getState().printing;
        let name = newDefinitionName || definition.name;
        let definitionId;
        if (type === PRINTING_MANAGER_TYPE_QUALITY && isDefaultQualityDefinition(definition.definitionId)) {
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
            i18nCategory: definition.i18nCategory,
            ownKeys: definition.ownKeys,
            metadata,
            settings: {}
        };
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        const definitionsWithSameCategory = state[definitionsKey].filter(d => d.category === definition.category);
        // make sure name is not repeated
        while (definitionsWithSameCategory.find(d => d.name === newDefinition.name)) {
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

    duplicateMaterialCategoryDefinitionByType: (type, activeToolList, isCreate, oldCategory) => async (dispatch, getState) => {
        const state = getState().printing;
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const definitions = cloneDeep(state[definitionsKey]);
        let newCategoryName = activeToolList.category;
        const allDupliateDefinitions = [];
        // make sure category is not repeated
        while (definitions.find(d => d.category === newCategoryName)) {
            newCategoryName = `#${newCategoryName}`;
        }
        const definitionsWithSameCategory = isCreate ? [{
            ...activeToolList,
            name: type === PRINTING_MANAGER_TYPE_MATERIAL ? i18n._('key-default_category-Default Material') : i18n._('key-default_category-Default Preset'),
            settings: definitions[0]?.settings
        }]
            : state[definitionsKey].filter(d => d.category === oldCategory);
        for (let i = 0; i < definitionsWithSameCategory.length; i++) {
            const newDefinition = definitionsWithSameCategory[i];
            newDefinition.category = newCategoryName;
            newDefinition.i18nCategory = '';
            const definitionId = `${newDefinition.definitionId}${timestamp()}`;
            newDefinition.definitionId = definitionId;
            const createdDefinition = await definitionManager.createDefinition(newDefinition);
            if (createdDefinition) {
                allDupliateDefinitions.push(createdDefinition);
            }
        }
        dispatch(actions.updateState({
            [definitionsKey]: [...definitions, ...allDupliateDefinitions]
        }));
        return allDupliateDefinitions[0];
    },

    removeDefinitionByType: (type, definition, loop = false) => async (dispatch, getState) => {
        const state = getState().printing;

        await definitionManager.removeDefinition(definition);
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const defintions = state[definitionsKey].filter(d => d.definitionId !== definition.definitionId);

        if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            const defaultMaterialId = state?.defaultMaterialId;
            const defaultMaterialIdRight = state?.defaultMaterialIdRight;
            if (defaultMaterialId === definition.definitionId) {
                dispatch(actions.updateDefaultIdByType(type, defintions[0].definitionId, LEFT_EXTRUDER));
            }
            if (defaultMaterialIdRight === definition.definitionId) {
                dispatch(actions.updateDefaultIdByType(type, defintions[0].definitionId, RIGHT_EXTRUDER));
            }
        }
        !loop && dispatch(actions.updateState({
            [definitionsKey]: defintions
        }));
    },

    removeToolCategoryDefinition: (type, category) => async (dispatch, getState) => {
        const state = getState().printing;
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        const definitions = state[definitionsKey];
        const newDefinitions = [];
        const definitionsWithSameCategory = definitions.filter(d => {
            if (d.category === category) {
                return true;
            } else {
                newDefinitions.push(d);
                return false;
            }
        });
        const ps = definitionsWithSameCategory.map((item) => {
            return dispatch(actions.removeDefinitionByType(type, item, true));
        });
        await Promise.all(ps);

        dispatch(actions.updateState({
            [definitionsKey]: newDefinitions
        }));
    },

    // removes all non-predefined definitions
    // now only used in reset settings
    removeAllMaterialDefinitions: () => async (dispatch, getState) => {
        const state = getState().printing;

        const newMaterialDefinitions = [];
        const defaultDefinitionIds = [
            'material.pla', 'material.abs', 'material.petg',
            'material.pla.black', 'material.abs.black', 'material.petg.black',
            'material.pla.blue', 'material.pla.grey', 'material.pla.red', 'material.pla.yellow',
            'material.petg.blue', 'material.petg.red'
        ];
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
        if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            defaultId = direction === LEFT_EXTRUDER ? 'defaultMaterialId' : 'defaultMaterialIdRight';
        } else {
            defaultId = defaultDefinitionKeys[type].id;
        }
        dispatch(actions.updateDefaultConfigId(type, newDefinitionId, direction));
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
    __loadModel: (files) => async (dispatch) => {
        const headType = 'printing';
        const sourceType = '3d';
        const mode = '3d';
        const width = 0;
        const height = 0;

        await dispatch(actions.generateModel(headType, {
            files, sourceWidth: width, sourceHeight: height, mode, sourceType, transformation: {}
        }));
    },

    // Upload model
    // @param files
    uploadModel: (files) => async (dispatch, getState) => {
        const ps = Array.from(files).map(async (file) => {
            // Notice user that model is being loading
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.uploadFile(formData);
            const { originalName, uploadName } = res.body;
            return { originalName, uploadName };
        });
        const fileNames = await Promise.all(ps);
        actions.__loadModel(fileNames)(dispatch, getState);
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
            extruderLDefinition, extruderRDefinition, defaultMaterialId, defaultMaterialIdRight, materialDefinitions, stopArea: { left, front } } = getState().printing;
        const { size, toolHead: { printingToolhead } } = getState().machine;
        if (!hasModel) {
            return;
        }
        // update extruder definitions
        const hasPrimeTower = (printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2 && activeDefinition.settings.prime_tower_enable.default_value);
        let primeTowerXDefinition = 0;
        let primeTowerYDefinition = 0;
        if (hasPrimeTower) {
            const modelGroupBBox = modelGroup._bbox;
            const primeTowerModel = lodashFind(modelGroup.getModels(), { type: 'primeTower' });
            const primeTowerWidth = primeTowerModel.boundingBox.max.x - primeTowerModel.boundingBox.min.x;
            const primeTowerPositionX = modelGroupBBox.max.x - (primeTowerModel.boundingBox.max.x + primeTowerModel.boundingBox.min.x + primeTowerWidth) / 2;
            const primeTowerPositionY = modelGroupBBox.max.y - (primeTowerModel.boundingBox.max.y + primeTowerModel.boundingBox.min.y - primeTowerWidth) / 2;
            primeTowerXDefinition = size.x - primeTowerPositionX - left;
            primeTowerYDefinition = size.y - primeTowerPositionY - front;
            activeDefinition.settings.prime_tower_position_x.default_value = primeTowerXDefinition;
            activeDefinition.settings.prime_tower_position_y.default_value = primeTowerYDefinition;
            activeDefinition.settings.prime_tower_size.default_value = primeTowerWidth;
            activeDefinition.settings.prime_tower_wipe_enabled.default_value = true;
        }
        const indexL = materialDefinitions.findIndex(d => d.definitionId === defaultMaterialId);
        const indexR = materialDefinitions.findIndex(d => d.definitionId === defaultMaterialIdRight);
        const newExtruderLDefinition = definitionManager.finalizeExtruderDefinition({
            extruderDefinition: extruderLDefinition,
            materialDefinition: materialDefinitions[indexL],
            hasPrimeTower,
            primeTowerXDefinition,
            primeTowerYDefinition
        });
        const newExtruderRDefinition = definitionManager.finalizeExtruderDefinition({
            extruderDefinition: extruderRDefinition,
            materialDefinition: materialDefinitions[indexR],
            hasPrimeTower,
            primeTowerXDefinition,
            primeTowerYDefinition
        });
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

        const models = filter(modelGroup.getModels(), (modelItem) => {
            return modelItem.visible && modelItem.type !== 'primeTower';
        });
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
        await dispatch(actions.updateActiveDefinitionMachineSize(size));

        activeDefinition.settings.machine_heated_bed.default_value = extruderLDefinition.settings.machine_heated_bed.default_value;
        activeDefinition.settings.material_bed_temperature.default_value = extruderLDefinition.settings.material_bed_temperature.default_value;
        activeDefinition.settings.material_bed_temperature_layer_0.default_value = extruderLDefinition.settings.material_bed_temperature_layer_0.default_value;


        const finalDefinition = definitionManager.finalizeActiveDefinition(activeDefinition, true);
        const adhesionExtruder = helpersExtruderConfig.adhesion;
        const supportExtruder = helpersExtruderConfig.support;
        finalDefinition.settings.adhesion_extruder_nr.default_value = adhesionExtruder;
        finalDefinition.settings.support_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_infill_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_extruder_nr_layer_0.default_value = supportExtruder;
        finalDefinition.settings.support_interface_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_roof_extruder_nr.default_value = supportExtruder;
        finalDefinition.settings.support_bottom_extruder_nr.default_value = supportExtruder;

        await definitionManager.createDefinition(finalDefinition);

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
                const models = modelGroup.models.filter(i => i.visible && i.type !== 'primeTower').reduce((pre, model) => {
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

                    const originalName = item.originalName;
                    const uploadPath = `${DATA_PREFIX}/${originalName}`;
                    const basenameWithoutExt = path.basename(uploadPath, path.extname(uploadPath));
                    const stlFileName = `${basenameWithoutExt}.stl`;

                    const mesh = item.meshObject.clone(false);
                    const supportMesh = mesh.children[0];
                    mesh.clear();

                    mesh.applyMatrix4(item.meshObject.parent.matrix);
                    const uploadResult = await uploadMesh(mesh, stlFileName);

                    ret.model.push(uploadResult.body.uploadName);
                    if (!ret.originalName) {
                        ret.originalName = uploadResult.body.originalName;
                    }
                    const definitionName = uploadResult.body.uploadName.replace(/\.stl$/, '');
                    const uploadName = await definitionManager.createTmpDefinition(modelDefinition, definitionName);
                    ret.definition.push(uploadName);

                    // upload support of model
                    if (supportMesh) {
                        supportMesh.applyMatrix4(mesh.matrix);
                        const supportName = stlFileName.replace(/(\.stl)$/, '_support$1');
                        const supportUploadResult = await uploadMesh(supportMesh, supportName);
                        ret.support.push(supportUploadResult.body.uploadName);
                    }
                }

                resolve(ret);
            }, 50);
        });
    },

    // preview
    setGcodeVisibilityByTypeAndDirection: (type, direction = LEFT_EXTRUDER, visible) => (dispatch, getState) => {
        const { gcodeLine, gcodeParser } = getState().printing;
        console.log('set type', type, direction, visible, TYPE_SETTINGS[type]);
        const { showTypes } = gcodeParser;
        if (type === 'TOOL0') {
            for (let i = 0; i < 8; i++) {
                showTypes[i] = visible;
            }
        } else if (type === 'TOOL1') {
            for (let i = 8; i < 16; i++) {
                showTypes[i] = visible;
            }
        } else {
            let i = 0;
            if (direction === RIGHT_EXTRUDER) {
                i = 8;
            }
            i += TYPE_SETTINGS[type].typeCode - 1;
            showTypes[i] = visible;
        }
        dispatch(actions.renderShowGcodeLines());

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

    updateGcodePreviewMode: (mode) => (dispatch, getState) => {
        const { gcodeLine, layerRangeDisplayed, layerCount, gcodeParser } = getState().printing;
        gcodeParser.setColortypes(mode === 'GrayUnderTheTopFloor');

        const uniforms = gcodeLine.material.uniforms;

        if (mode === 'GrayUnderTheTopFloor') {
            uniforms.u_middle_layer_set_gray.value = 1;
        } else {
            uniforms.u_middle_layer_set_gray.value = 0;
        }
        dispatch(actions.updateState({
            gcodePreviewModeToogleVisible: 0,
            gcodePreviewMode: mode
        }));

        if (mode === 'SingleLayer') {
            dispatch(actions.showGcodeLayers([
                layerRangeDisplayed[1], layerRangeDisplayed[1]
            ]));
        } else if (mode === 'Ordinary' || mode === 'GrayUnderTheTopFloor') {
            if (layerRangeDisplayed[0] === layerRangeDisplayed[1]) {
                dispatch(actions.showGcodeLayers([0, layerCount - 1]));
            } else {
                dispatch(actions.render());
            }
        }
    },

    setGcodeColorByRenderLineType: () => (dispatch, getState) => {
        const { gcodeLine, renderLineType, gcodeParser, extruderLDefinition, extruderRDefinition } = getState().printing;
        if (renderLineType) {
            gcodeParser.extruderColors = [
                extruderLDefinition?.settings?.color?.default_value || WHITE_COLOR,
                extruderRDefinition?.settings?.color?.default_value || BLACK_COLOR
            ];
        }
        gcodeParser.setColortypes(undefined, renderLineType);

        const uniforms = gcodeLine.material.uniforms;
        uniforms.u_color_type.value = renderLineType ? 1 : 0;
        dispatch(actions.render());
    },

    renderShowGcodeLines: () => (dispatch, getState) => {
        const { gcodeParser, gcodeLineObjects } = getState().printing;
        const { startLayer, endLayer, showTypes } = gcodeParser;
        gcodeLineObjects.forEach((mesh, i) => {
            if (i < (startLayer ?? 0) * 16 || i > (endLayer ?? 0) * 16 + 15 || !showTypes[i & 15]) {
                mesh.visible = false;
            } else {
                mesh.visible = true;
            }
        });
    },

    showGcodeLayers: (range) => (dispatch, getState) => {
        throttle(() => {
            const {
                layerCount,
                gcodeLine,
                gcodePreviewMode,
                layerRangeDisplayed,
                gcodeParser
            } = getState().printing;
            gcodeParser.startLayer = Math.floor(range[0]);
            gcodeParser.endLayer = Math.floor(range[1]);
            dispatch(actions.renderShowGcodeLines());

            if (!gcodeLine) {
                return;
            }

            if (range >= layerCount) {
                dispatch(actions.displayModel());
            } else {
                dispatch(actions.displayGcode());
            }
            if (gcodePreviewMode === 'SingleLayer') {
                // The moving direction is down
                if (layerRangeDisplayed[0] > range[0]) {
                    range = [
                        range[0] || 0,
                        range[0] || 0
                    ];
                } else {
                    range = [
                        Math.min(layerCount, range[1]),
                        Math.min(layerCount, range[1])
                    ];
                }
            } else {
                if ((range[0] > layerRangeDisplayed[0] || range[1] > layerRangeDisplayed[1])) {
                    if (range[0] > layerRangeDisplayed[0] && range[0] > range[1]) {
                        const tmp = range[1];
                        range[1] = range[0];
                        range[0] = tmp;
                    }
                    range[1] = Math.min(layerCount, range[1]);
                    range[0] = Math.min(layerCount, range[0]);
                }

                if ((range[0] < layerRangeDisplayed[0] || range[1] < layerRangeDisplayed[1])) {
                    if (range[1] < layerRangeDisplayed[0] && range[0] > range[1]) {
                        const tmp = range[1];
                        range[1] = range[0];
                        range[0] = tmp;
                    }
                    range[1] = range[1] || 0;
                    range[0] = range[0] || 0;
                }
            }
            range[0] = range[0] < 0 ? 0 : range[0];
            gcodeLine.material.uniforms.u_visible_layer_range_start.value = Math.round(range[0], 10);
            gcodeLine.material.uniforms.u_visible_layer_range_end.value = Math.round(range[1], 10);
            dispatch(actions.updateState({
                layerRangeDisplayed: range
            }));
            dispatch(actions.render());
        }, 1000)();
    },

    // make an offset of gcode layer count
    // offset can be negative
    offsetGcodeLayers: (offset) => (dispatch, getState) => {
        const { layerRangeDisplayed } = getState().printing;
        dispatch(actions.showGcodeLayers([layerRangeDisplayed[0] + offset, layerRangeDisplayed[1] + offset]));
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
        // modelGroup.object.visible = true;
        modelGroup.setDisplayType('model');
        gcodeLineGroup.visible = false;
        dispatch(actions.updateState({
            displayedType: 'model'
        }));
        dispatch(actions.render());
    },

    updateSelectedModelTransformation: (transformation, newUniformScalingState, isAllRotate) => (dispatch, getState) => {
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
        modelGroup.updateSelectedGroupTransformation(transformation, newUniformScalingState, isAllRotate);
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
        const selectedModelArray = modelGroup.selectedModelArray.concat();
        const { recovery } = modelGroup.unselectAllModels();
        for (const model of selectedModelArray) {
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
        recovery();
        const modelState = modelGroup.removeSelectedModel();
        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));

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
                modelItem.extruderConfig = {
                    ...extruderConfig
                };
                modelItem.children && modelItem.children.length && modelItem.children.forEach(item => {
                    if (extruderConfig.infill !== '2') {
                        item.extruderConfig = {
                            ...item.extruderConfig,
                            infill: extruderConfig.infill
                        };
                    }
                    if (extruderConfig.shell !== '2') {
                        item.extruderConfig = {
                            ...item.extruderConfig,
                            shell: extruderConfig.shell
                        };
                    }
                });
                if (modelItem.parent && modelItem.parent instanceof ThreeGroup) {
                    modelItem.parent.updateGroupExtruder();
                }
            }
        }
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateAllModelColors());
        dispatch(actions.updateBoundingBox());
        modelGroup.models = [...models];
        // dispatch(actions.updateState({
        //     modelGroup
        // }));
    },

    updateHelpersExtruder: (extruderConfig) => (dispatch) => {
        dispatch(actions.updateState({ helpersExtruderConfig: extruderConfig }));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateBoundingBox());
    },
    arrangeAllModels: (angle = 45, offset = 1, padding = 0) => (dispatch, getState) => {
        const operations = new Operations();
        let operation;
        const froms = {};

        dispatch(actions.unselectAllModels());
        const { modelGroup, progressStatesManager } = getState().printing;
        const { size } = getState().machine;

        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_ARRANGE_MODELS);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ARRANGING_MODELS, 0.01)
        }));

        const models = [];
        modelGroup.getModels().forEach((model) => {
            if (model instanceof PrimeTowerModel) {
                return;
            }
            const modelInfo = {
                modelID: model.modelID,
                isGroup: (model instanceof ThreeGroup)
            };
            if (modelInfo.isGroup) {
                const children = [];
                model.children.forEach((child) => {
                    children.push({
                        count: child.geometry.getAttribute('position').count,
                        array: child.geometry.getAttribute('position').array,
                        matrix: child.meshObject.matrix
                    });
                });
                modelInfo.children = children;
                modelInfo.center = {
                    x: model.transformation.positionX,
                    y: model.transformation.positionY
                };
            } else {
                modelInfo.children = [{
                    count: model.geometry.getAttribute('position').count,
                    array: model.geometry.getAttribute('position').array,
                    matrix: model.meshObject.matrix
                }];
                modelInfo.center = {
                    x: model.transformation.positionX,
                    y: model.transformation.positionY
                };
            }
            models.push(modelInfo);
        });

        const res = workerManager.arrangeModels([{
            models,
            validArea: modelGroup.getValidArea(),
            angle,
            offset: offset / 2,
            padding,
            memory: performance.memory.jsHeapSizeLimit
        }], (payload) => {
            const { status, value } = payload;
            switch (status) {
                case 'succeed': {
                    const { parts } = value;
                    let allArranged = true;

                    parts.forEach((part) => {
                        const model = modelGroup.getModel(part.modelID);

                        const from = cloneDeep(model.transformation);
                        froms[part.modelID] = from;

                        if (part.angle !== undefined && part.position !== undefined) {
                            model.updateTransformation({
                                positionX: part.position.x,
                                positionY: part.position.y
                            });
                            model.rotateModelByZaxis(part.angle);
                            model.stickToPlate();
                            model.onTransform();
                            modelGroup.selectModelById(part.modelID, true);
                        }
                    });
                    const validArea = modelGroup.getValidArea();
                    modelGroup.updateSelectedGroupTransformation({
                        positionX: (validArea.max.x + validArea.min.x) / 2,
                        positionY: (validArea.max.y + validArea.min.y) / 2
                    });

                    parts.forEach((part) => {
                        const model = modelGroup.getModel(part.modelID);
                        if (part.angle === undefined || part.position === undefined) {
                            allArranged = false;
                            model.updateTransformation({
                                positionX: 0,
                                positionY: 0
                            });
                        }
                    });
                    parts.forEach((part) => {
                        const model = modelGroup.getModel(part.modelID);
                        if (part.angle === undefined || part.position === undefined) {
                            const position = modelGroup.arrangeOutsidePlate(model, size);
                            model.updateTransformation({
                                positionX: position.x,
                                positionY: position.y
                            });
                            modelGroup.stickToPlateAndCheckOverstepped(model);
                        }
                    });

                    // record for undo|redo
                    dispatch(actions.onModelAfterTransform());
                    modelGroup.getModels().forEach((model) => {
                        if (model instanceof PrimeTowerModel) {
                            return;
                        }
                        operation = new ArrangeOperation3D({
                            target: model,
                            from: froms[model.modelID],
                            to: cloneDeep(model.transformation)
                        });
                        operations.push(operation);
                    });
                    operations.registCallbackAfterAll(() => {
                        dispatch(actions.onModelAfterTransform());
                    });
                    dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));

                    dispatch(actions.updateState({
                        stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ARRANGING_MODELS, 1)
                    }));
                    progressStatesManager.finishProgress(true);
                    if (!allArranged) {
                        dispatch(appGlobalActions.updateShowArrangeModelsError({
                            showArrangeModelsError: true
                        }));
                    }
                    res.terminate();
                    break;
                }
                case 'progress': {
                    const { progress } = value;
                    dispatch(actions.updateState({
                        stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ARRANGING_MODELS, progress)
                    }));
                    break;
                }
                case 'err': {
                    // TODO: STOP AND MODAL
                    dispatch(actions.updateState({
                        stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ARRANGING_MODELS, 1)
                    }));
                    progressStatesManager.finishProgress(false);
                    dispatch(actions.updateState({
                        stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ARRANGING_MODELS, 1)
                    }));
                    dispatch(appGlobalActions.updateShowArrangeModelsError({
                        showArrangeModelsError: true
                    }));
                    res.terminate();
                    break;
                }
                default:
                    break;
            }
        });
    },

    recordModelBeforeTransform: (modelGroup) => (dispatch) => {
        dispatch(operationHistoryActions.clearTargetTmpState(INITIAL_STATE.name));
        const selectedModelArray = modelGroup.selectedModelArray.concat();
        const { recovery } = modelGroup.unselectAllModels();
        for (const model of selectedModelArray) {
            modelGroup.unselectAllModels();
            modelGroup.addModelToSelectedGroup(model);
            if (model.supportTag) {
                dispatch(actions.onModelTransform());
            }
            dispatch(operationHistoryActions.updateTargetTmpState(INITIAL_STATE.name, model.modelID, {
                from: { ...modelGroup.getSelectedModelTransformationForPrinting() }
            }));
        }
        recovery();
    },

    recordModelAfterTransform: (transformMode, modelGroup, combinedOperations) => (dispatch, getState) => {
        const { targetTmpState } = getState().printing;
        let operations, operation;
        if (combinedOperations) {
            operations = combinedOperations;
        } else {
            operations = new Operations();
            if (transformMode === 'rotate') {
                dispatch(actions.clearAllManualSupport(operations));
            }
        }

        const selectedModelArray = modelGroup.selectedModelArray.concat();
        const { recovery } = modelGroup.unselectAllModels();
        for (const model of selectedModelArray) {
            modelGroup.unselectAllModels();
            modelGroup.addModelToSelectedGroup(model);
            dispatch(operationHistoryActions.updateTargetTmpState(INITIAL_STATE.name, model.modelID, {
                to: { ...modelGroup.getSelectedModelTransformationForPrinting() }
            }));
            if (stateEqual(model, targetTmpState[model.modelID].from, targetTmpState[model.modelID].to)) {
                continue;
            }
            // model in group translate on Z-axis should clear supports in its group
            if (transformMode === 'translate' && model.isModelInGroup() && Math.abs(targetTmpState[model.modelID].from.positionZ - targetTmpState[model.modelID].to.positionZ) > EPSILON) {
                dispatch(actions.clearSupportInGroup(operations, model));
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

        if (transformMode === 'scale') {
            const isMirror = modelGroup.selectedModelArray.some(model => {
                const x = targetTmpState[model.modelID].from.scaleX * targetTmpState[model.modelID].to.scaleX;
                const y = targetTmpState[model.modelID].from.scaleY * targetTmpState[model.modelID].to.scaleY;
                const z = targetTmpState[model.modelID].from.scaleZ * targetTmpState[model.modelID].to.scaleZ;
                return x / Math.abs(x) === -1 || y / Math.abs(y) === -1 || z / Math.abs(z) === -1;
            });
            if (isMirror) {
                dispatch(actions.clearAllManualSupport(operations));
            }
        }

        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
            dispatch(actions.render());
        });
        recovery();
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
        const { modelGroup, progressStatesManager } = getState().printing;
        const operations = new Operations();
        dispatch(actions.clearAllManualSupport(operations));
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_AUTO_ROTATE);
        let selected = [];
        if (modelGroup.getSelectedModelArray().length > 0) {
            selected = modelGroup.getSelectedModelArray().filter(item => item.visible);
        } else {
            selected = modelGroup.getModels('primeTower').filter(item => item.visible);
        }
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 0.01)
        }));
        setTimeout(() => {
            if (selected.length === 1) {
                dispatch(actions.updateState({
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 0.25)
                }));
            }
            const selectedModelInfo = [];
            const revertParentArr = [];
            selected.forEach((modelItem) => {
                let geometry = null;
                if (modelItem instanceof ThreeGroup) {
                    modelItem.computeConvex();
                    geometry = modelItem.mergedGeometry;
                } else {
                    geometry = modelItem.meshObject.geometry;
                }
                const revertParent = ThreeUtils.removeObjectParent(modelItem.meshObject);
                revertParentArr.push(revertParent);
                modelItem.meshObject.updateMatrixWorld();
                geometry.computeBoundingBox();
                const inverseNormal = (modelItem.transformation.scaleX / Math.abs(modelItem.transformation.scaleX) < 0);
                const modelItemInfo = {
                    geometryJSON: geometry.toJSON(),
                    matrixWorld: modelItem.meshObject.matrixWorld,
                    convexGeometry: modelItem.convexGeometry,
                    inverseNormal
                };
                selectedModelInfo.push(modelItemInfo);
            });
            workerManager.autoRotateModels([{
                selectedModelInfo
            }], (payload) => {
                const { status, value } = payload;
                switch (status) {
                    case 'PARTIAL_SUCCESS': {
                        const { progress, targetPlane, xyPlaneNormal, index, isFinish, isUpdateProgress } = value;
                        if (isUpdateProgress) {
                            dispatch(actions.updateState({
                                progress
                            }));
                            return;
                        }
                        const rotateModel = selected[index];
                        const _targetPlane = new THREE.Vector3(targetPlane.x, targetPlane.y, targetPlane.z);
                        const _xyPlaneNormal = new THREE.Vector3(xyPlaneNormal.x, xyPlaneNormal.y, xyPlaneNormal.z);
                        const newQuaternion = new THREE.Quaternion().setFromUnitVectors(_targetPlane, _xyPlaneNormal);
                        rotateModel.meshObject.applyQuaternion(newQuaternion);
                        rotateModel.meshObject.updateMatrix();
                        rotateModel.stickToPlate();
                        rotateModel.onTransform();
                        const revertParentFunc = revertParentArr[index];
                        // revertParentFunc();
                        // const revertParent = ThreeUtils.removeObjectParent(rotateModel);
                        revertParentFunc();
                        // rotateModel.computeBoundingBox();
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, progress)
                        }));
                        if (isFinish) {
                            const modelState = modelGroup.getState();
                            modelGroup.onModelAfterTransform();
                            dispatch(actions.recordModelAfterTransform('rotate', modelGroup, operations));
                            dispatch(actions.updateState(modelState));
                            dispatch(actions.destroyGcodeLine());
                            dispatch(actions.displayModel());
                            dispatch(actions.updateState({
                                stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 1)
                            }));
                        }
                        break;
                    }
                    case 'PROGRESS': {
                        const { progress } = value;
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, progress)
                        }));
                        break;
                    }
                    case 'ERROR': {
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_AUTO_ROTATE_FAILED,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 1)
                        }));
                        break;
                    }
                    default:
                        break;
                }
            });
        }, 200);
    },

    scaleToFitSelectedModel: (models) => (dispatch, getState) => {
        const { modelGroup, stopArea: { left, right, front, back } } = getState().printing;
        let { size } = getState().machine;
        size = {
            x: size.x - left - right,
            y: size.y - front - back,
            z: size.z
        };
        const offsetX = (left - right) / 2;
        const offsetY = (front - back) / 2;
        dispatch(actions.recordModelBeforeTransform(modelGroup));

        const modelState = (() => {
            if (models && models.length > 0) {
                return modelGroup.scaleToFitFromModel(size, offsetX, offsetY, models);
            } else {
                return modelGroup.scaleToFitSelectedModel(size, offsetX, offsetY);
            }
        })();
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('scale', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    scaleToFitSelectedModelWithRotate: () => (dispatch, getState) => {
        const { progressStatesManager, modelGroup, stopArea: { left, right, front, back } } = getState().printing;
        const { size } = getState().machine;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, 0.15)
        }));
        setTimeout(() => {
            const meshObjectJSON = [];
            // console.log(modelGroup.selectedModelArray);
            modelGroup.selectedModelArray.forEach(modelItem => {
                if (modelItem instanceof ThreeGroup) {
                    modelItem.children.forEach(child => {
                        meshObjectJSON.push({
                            ...child.meshObject.geometry.toJSON(),
                            modelItemMatrix: child.meshObject.matrixWorld.clone()
                        });
                    });
                } else {
                    meshObjectJSON.push({ ...modelItem.meshObject.geometry.toJSON(), modelItemMatrix: modelItem.meshObject.matrixWorld.clone() });
                }
            });
            dispatch(actions.recordModelBeforeTransform(modelGroup));
            const data = {
                size,
                meshObjectJSON,
                left,
                right,
                front,
                back,
                selectedGroupMatrix: modelGroup.selectedGroup.matrix.clone(),
                selectedCount: modelGroup.selectedModelArray.length
            };
            workerManager.scaleToFitWithRotate([{
                data
            }], (payload) => {
                const { status, value } = payload;
                switch (status) {
                    case 'FINISH': {
                        const operations = new Operations();
                        const originQuaternion = modelGroup.selectedGroup.quaternion.clone();
                        let operation;
                        const { rotateAngel, maxScale, offsetX } = value;
                        const { scale: originScale } = modelGroup.selectedGroup;
                        dispatch(actions.clearAllManualSupport(operations));
                        const newTransformation = {
                            scaleX: originScale.x * maxScale,
                            scaleY: originScale.y * maxScale,
                            scaleZ: originScale.z * maxScale,
                            positionX: 0,
                            positionY: 0
                        };
                        // dispatch(actions.recordModelBeforeTransform(modelGroup, operations));
                        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.Math.degToRad(rotateAngel));
                        modelGroup.selectedGroup.quaternion.copy(quaternion).multiply(originQuaternion).normalize();
                        modelGroup.updateSelectedGroupTransformation(newTransformation, undefined, true);
                        const { targetTmpState } = getState().printing;
                        modelGroup.selectedModelArray.forEach(modelItem => {
                            operation = new ScaleToFitWithRotateOperation3D({
                                target: modelItem,
                                ...targetTmpState[modelItem.modelID],
                                to: { ...modelGroup.getSelectedModelTransformationForPrinting() }
                            });
                            operations.push(operation);
                        });
                        const center = new THREE.Vector3();
                        ThreeUtils.computeBoundingBox(modelGroup.selectedGroup).getCenter(center);
                        const oldPosition = modelGroup.selectedGroup.position;
                        modelGroup.updateSelectedGroupTransformation({
                            positionX: offsetX + (oldPosition.x - center.x),
                            positionY: oldPosition.y - center.y,
                        });
                        modelGroup.onModelAfterTransform();
                        modelGroup.selectedModelArray.forEach(modelItem => {
                            operation = new ScaleToFitWithRotateOperation3D({
                                target: modelItem,
                                ...targetTmpState[modelItem.modelID],
                                to: { ...modelGroup.getSelectedModelTransformationForPrinting() }
                            });
                            operations.push(operation);
                        });
                        // dispatch(actions.recordModelAfterTransform('scale', modelGroup, operations));
                        const modelState = modelGroup.getState();
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, 1),
                        }));
                        dispatch(actions.updateState(modelState));
                        operations.registCallbackAfterAll(() => {
                            dispatch(actions.updateState(modelGroup.getState()));
                            dispatch(actions.destroyGcodeLine());
                            dispatch(actions.displayModel());
                            dispatch(actions.render());
                        });
                        dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
                        break;
                    }
                    case 'UPDATE_PROGRESS': {
                        const { progress } = value;
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, progress)
                        }));
                        break;
                    }
                    case 'ERR': {
                        dispatch(actions.updateState({
                            stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE_FAILED,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, 1)
                        }));
                        break;
                    }
                    default:
                        break;
                }
            });
        }, 200);
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
        // modelGroup.object.visible = false;
        modelGroup.setDisplayType('gcode');
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
        const extruderColors = {
            toolColor0: extruderLDefinition?.settings?.color?.default_value || WHITE_COLOR,
            toolColor1: extruderRDefinition?.settings?.color?.default_value || BLACK_COLOR
        };
        workerManager.gcodeToBufferGeometry([{ func: '3DP', gcodeFilename, extruderColors }], (data) => {
            dispatch(actions.gcodeRenderingCallback(data));
        });
    },
    /**
     * deprecated
     */
    // saveSupport: (model) => (dispatch, getState) => {
    //     const { modelGroup } = getState().printing;
    //     modelGroup.saveSupportModel(model);
    //     if (!model.isInitSupport) {
    //         // save generated support into operation history
    //         const operation = new AddOperation3D({
    //             target: model,
    //             parent: model.target
    //         });
    //         operation.description = 'AddSupport';
    //         const operations = new Operations();
    //         operations.push(operation);
    //         dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
    //     }
    // },
    clearAllManualSupport: (combinedOperations) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelsWithSupport = modelGroup.getModelsAttachedSupport(false);
        if (modelsWithSupport.length > 0) {
            let operations = new Operations();
            if (combinedOperations) {
                operations = combinedOperations;
            }
            for (const model of modelsWithSupport) {
                const operation = new DeleteSupportsOperation3D({
                    target: model,
                    support: model.meshObject.children[0],
                    faceMarks: model.supportFaceMarks.slice(0)
                });
                operations.push(operation);
            }
            if (!combinedOperations) {
                dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
            }

            modelGroup.clearAllSupport();
        }
    },
    setDefaultSupportSize: (size) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.defaultSupportSize = size;
    },
    generateModel: (headType, { loadFrom = LOAD_MODEL_FROM_INNER, files, originalName, uploadName, sourceWidth, sourceHeight, mode, sourceType, transformation, modelID, extruderConfig, isGroup = false, parentModelID = '', modelName, children, primeTowerTag }) => async (dispatch, getState) => {
        const { progressStatesManager, defaultQualityId, qualityDefinitions, modelGroup } = getState().printing;
        const { size } = getState().machine;
        const models = [...modelGroup.models];
        const modelNames = files || [{ originalName, uploadName }];
        let _progress = 0;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);
        const promptTasks = [];
        const promises = modelNames.map(model => {
            return new Promise(async (resolve, reject) => {
                const { toolHead: { printingToolhead } } = getState().machine;
                _progress = modelNames.length === 1 ? 0.25 : 0.001;
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                }));
                const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;

                if (isGroup) {
                    const modelState = await modelGroup.generateModel({
                        loadFrom,
                        limitSize: size,
                        headType,
                        sourceType,
                        originalName: model.originalName,
                        uploadName: model.uploadName,
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
                    resolve();
                } else if (primeTowerTag && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
                    const activeActiveQualityDefinition = lodashFind(qualityDefinitions, { definitionId: defaultQualityId });
                    const initHeight = transformation?.scaleZ || 0.1;
                    modelGroup.initPrimeTower(initHeight, transformation);
                    const enabledPrimeTower = activeActiveQualityDefinition.settings.prime_tower_enable.default_value;
                    const primeTowerModel = lodashFind(modelGroup.models, { type: 'primeTower' });
                    !enabledPrimeTower && dispatch(actions.hideSelectedModel(primeTowerModel));
                    resolve();
                } else {
                    const onMessage = async (data) => {
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
                                    originalName: model.originalName,
                                    uploadName: model.uploadName,
                                    modelName: model.modelName,
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
                                if (modelNames.length > 1) {
                                    _progress += 1 / modelNames.length;
                                    dispatch(actions.updateState({
                                        stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                                    }));
                                }
                                resolve();
                                break;
                            }
                            case 'LOAD_MODEL_CONVEX': {
                                const { positions } = data;

                                const convexGeometry = new THREE.BufferGeometry();
                                const positionAttribute = new THREE.BufferAttribute(positions, 3);
                                convexGeometry.setAttribute('position', positionAttribute);

                                // const model = modelGroup.children.find(m => m.uploadName === uploadName);
                                modelGroup.setConvexGeometry(model.uploadName, convexGeometry);

                                break;
                            }
                            case 'LOAD_MODEL_PROGRESS': {
                                if (modelNames.length === 1) {
                                    const state = getState().printing;
                                    const progress = 0.25 + data.progress * 0.5;
                                    if (progress - state.progress > 0.01 || progress > 0.75 - EPSILON) {
                                        dispatch(actions.updateState({
                                            stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, progress)
                                        }));
                                    }
                                }
                                break;
                            }
                            case 'LOAD_MODEL_FAILED': {
                                promptTasks.push({
                                    status: 'fail',
                                    originalName: model.originalName
                                });
                                if (modelNames.length > 1) {
                                    _progress += 1 / modelNames.length;
                                    dispatch(actions.updateState({
                                        stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                                    }));
                                }
                                reject();
                                break;
                            }
                            default:
                                break;
                        }
                    };
                    createLoadModelWorker(uploadPath, onMessage);
                }
            });
        });

        await Promise.allSettled(promises);

        const newModels = modelGroup.models.filter((model) => {
            return !models.includes(model);
        });
        newModels.forEach(model => {
            const modelSize = new Vector3();
            model.boundingBox.getSize(modelSize);
            const isLarge = ['x', 'y', 'z'].some((key) => modelSize[key] >= size[key]);

            if (isLarge) {
                promptTasks.push({
                    status: 'needScaletoFit',
                    model
                });
            }
        });
        if (modelNames.length === 1 && newModels.length === 0) {
            progressStatesManager.finishProgress(false);
            dispatch(actions.updateState({
                stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                progress: 0,
                promptTasks
            }));
        } else {
            dispatch(actions.updateState({
                stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1),
                promptTasks
            }));
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

    startAnalyzeRotation: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const operations = new Operations();
        dispatch(actions.clearAllManualSupport(operations));
        // record current rotation for undo & redo
        dispatch(actions.recordModelBeforeTransform(modelGroup));
        // keep the operation for `finishAnalyzeRotation` action
        dispatch(actions.updateState({
            combinedOperations: operations
        }));
    },

    finishAnalyzeRotation: () => (dispatch, getState) => {
        const { modelGroup, combinedOperations } = getState().printing;
        dispatch(actions.clearRotationAnalysisTableData());
        // record the last rotation to undo & redo
        dispatch(actions.recordModelAfterTransform('rotate', modelGroup, combinedOperations));
        dispatch(actions.setTransformMode('rotate'));
        dispatch(actions.updateState({
            combinedOperations: []
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
            const { recovery } = modelGroup.unselectAllModels();
            modelGroup.selectModelById(model.modelID);
            selectedModelsPositionMap.set(model.modelID, {
                ...modelGroup.getSelectedModelTransformationForPrinting()
            });
            recovery();
        });
        modelGroup.updateModelsPositionBaseFirstModel(selectedModels);
        const operations = new Operations();

        const { newGroup, modelState } = modelGroup.group();
        const modelsafterGroup = modelGroup.getModels().slice(0);

        const operation = new GroupAlignOperation3D({
            selectedModelsPositionMap,
            // groupChildrenMap,
            modelsbeforeGroup,
            modelsafterGroup,
            selectedModels,
            newPosition: newGroup.transformation,
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
        // Stores the model structure before the group operation, which is used for undo operation
        const modelsBeforeGroup = modelGroup.getModels().slice(0);
        const selectedModels = modelGroup.getSelectedModelArray().slice(0);
        const operations = new Operations();
        const { recovery } = modelGroup.unselectAllModels();
        // Record the relationship between model and group
        const modelsRelation = selectedModels.reduce((pre, selectd) => {
            const groupModelID = selectd.parent?.modelID;
            pre.set(selectd.modelID, {
                groupModelID,
                children: selectd instanceof ThreeGroup ? selectd.children.slice(0) : null,
                modelTransformation: { ...selectd.transformation }
            });
            return pre;
        }, new Map());
        recovery();

        const modelState = modelGroup.group();
        // Stores the model structure after the group operation, which is used for redo operation
        const modelsAfterGroup = modelGroup.getModels().slice(0);
        const newGroup = modelGroup.getSelectedModelArray()[0];
        const operation = new GroupOperation3D({
            modelsBeforeGroup,
            modelsAfterGroup,
            selectedModels,
            target: newGroup,
            modelGroup,
            modelsRelation
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
            console.error({ err });
            dispatch(actions.updateState({
                isNewUser: true
            }));
        });
    },

    updateSupportOverhangAngle: (angle) => (dispatch) => {
        dispatch(actions.updateState({
            supportOverhangAngle: angle
        }));
    },

    generateSupports: (models, angle) => async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;

        if (!models || models.length === 0) {
            return;
        }

        if (!progressStatesManager.inProgress()) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1]);
        } else {
            progressStatesManager.startNextStep();
        }
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL, 0)
        }));

        const params = await dispatch(actions.uploadModelsForSupport(models, angle));
        controller.generateSupport(params);
    },

    uploadModelsForSupport: (models, angle) => (dispatch, getState) => {
        const { activeDefinition } = getState().printing;
        return new Promise((resolve) => {
            // upload model stl
            setTimeout(async () => {
                const params = {
                    data: []
                };
                for (const model of models) {
                    const mesh = model.meshObject.clone(false);
                    mesh.clear();
                    model.meshObject.parent.updateMatrixWorld();
                    mesh.applyMatrix4(model.meshObject.parent.matrixWorld);

                    // negative scale flips normals, just flip them back by changing the winding order of faces
                    // https://stackoverflow.com/questions/16469270/transforming-vertex-normals-in-three-js/16469913#16469913
                    if (model.transformation.scaleX * model.transformation.scaleY * model.transformation.scaleZ < 0) {
                        mesh.geometry = mesh.geometry.clone();
                        const positions = mesh.geometry.getAttribute('position').array;

                        for (let i = 0; i < positions.length; i += 9) {
                            const tempX = positions[i + 0];
                            const tempY = positions[i + 1];
                            const tempZ = positions[i + 2];

                            positions[i + 0] = positions[i + 6];
                            positions[i + 1] = positions[i + 7];
                            positions[i + 2] = positions[i + 8];

                            positions[i + 6] = tempX;
                            positions[i + 7] = tempY;
                            positions[i + 8] = tempZ;
                        }
                        mesh.geometry.computeFaceNormals();
                        mesh.geometry.computeVertexNormals();
                    }
                    // add support_mark attribute for STL binary exporter
                    mesh.geometry.setAttribute('support_mark', new THREE.Float32BufferAttribute(model.supportFaceMarks.slice(0), 1));

                    const originalName = model.originalName;
                    const uploadPath = `${DATA_PREFIX}/${originalName}`;
                    const basenameWithoutExt = path.basename(uploadPath, path.extname(uploadPath));
                    const stlFileName = `${basenameWithoutExt}.stl`;
                    const uploadResult = await uploadMesh(mesh, stlFileName);
                    mesh.geometry.deleteAttribute('support_mark');

                    params.data.push({
                        modelID: model.modelID,
                        uploadName: uploadResult.body.uploadName,
                        // specify generated support name
                        supportStlFilename: uploadResult.body.uploadName.replace(/\.stl$/, `_support_${Date.now()}.stl`),
                        config: {
                            support_angle: angle,
                            layer_height_0: activeDefinition.settings.layer_height_0.default_value,
                            support_mark_area: false // tell engine to use marks in binary STL file
                        }
                    });
                }
                resolve(params);
            }, 50);
        });
    },

    loadSupports: (supportFilePaths) => (dispatch, getState) => {
        const { modelGroup, tmpSupportFaceMarks } = getState().printing;
        // use worker to load supports
        const operations = new Operations();
        const promises = supportFilePaths.map(info => {
            return new Promise((resolve, reject) => {
                const model = modelGroup.findModelByID(info.modelID);
                const previousFaceMarks = tmpSupportFaceMarks[info.modelID];
                if (model) {
                    const operation = new AddSupportsOperation3D({
                        target: model,
                        currentFaceMarks: model.supportFaceMarks.slice(0),
                        currentSupport: null,
                        previousSupport: model.meshObject.children[0] || model.tmpSupportMesh,
                        previousFaceMarks
                    });
                    model.meshObject.clear();
                    operations.push(operation);

                    if (info.supportStlFilename) {
                        new ModelLoader().load(`${DATA_PREFIX}/${info.supportStlFilename}`, (geometry) => {
                            const mesh = modelGroup.generateSupportMesh(geometry, model.meshObject);

                            operation.state.currentSupport = mesh;
                            model.meshObject.add(mesh);
                            resolve();
                        }, () => { }, (err) => {
                            reject(err);
                        });
                    } else {
                        resolve();
                    }
                } else {
                    resolve();
                }
            });
        });
        Promise.all(promises).then(() => {
            dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
            dispatch(actions.render());
            dispatch(actions.updateState({
                tmpSupportFaceMarks: {}
            }));
        }).catch(console.error);
    },

    startEditSupportArea: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.startEditSupportArea();
        dispatch(actions.setTransformMode('support-edit'));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.render());
    },

    finishEditSupportArea: (shouldApplyChanges = false) => (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;
        dispatch(actions.setTransformMode('support'));
        if (shouldApplyChanges) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1, 1]);
            dispatch(actions.updateState({
                stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 0.25)
            }));

            // record previous support face marks for undo&redo
            const tmpSupportFaceMarks = {};
            const availModels = modelGroup.getModelsAttachedSupport();
            availModels.forEach(model => {
                tmpSupportFaceMarks[model.modelID] = model.supportFaceMarks;
            });
            dispatch(actions.updateState({
                tmpSupportFaceMarks
            }));

            const models = modelGroup.finishEditSupportArea(shouldApplyChanges);

            dispatch(actions.updateState({
                stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 1)
            }));

            dispatch(actions.generateSupports(models, 0));
        } else {
            modelGroup.finishEditSupportArea(shouldApplyChanges);
        }
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.render());
    },

    clearSupportInGroup: (combinedOperations, modelInGroup) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelsWithSupport = modelGroup.filterModelsCanAttachSupport(modelInGroup.parent.children);
        if (modelsWithSupport.length > 0) {
            let operations = new Operations();
            if (combinedOperations) {
                operations = combinedOperations;
            }
            for (const model of modelsWithSupport) {
                const operation = new DeleteSupportsOperation3D({
                    target: model,
                    support: model.meshObject.children[0],
                    faceMarks: model.supportFaceMarks.slice(0)
                });
                operations.push(operation);
                model.meshObject.clear();
            }
            if (!combinedOperations) {
                dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
            }
        }
    },

    setSupportBrushRadius: (radius) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.setSupportBrushRadius(radius);
        dispatch(actions.render());
    },

    // status: add | remove
    setSupportBrushStatus: (status) => (dispatch) => {
        dispatch(actions.updateState({
            supportBrushStatus: status
        }));
    },

    moveSupportBrush: (raycastResult) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.moveSupportBrush(raycastResult);
        dispatch(actions.render());
    },

    applySupportBrush: (raycastResult) => (dispatch, getState) => {
        const { modelGroup, supportBrushStatus } = getState().printing;
        modelGroup.applySupportBrush(raycastResult, supportBrushStatus);
        dispatch(actions.render());
    },

    clearAllSupport: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.clearAllSupport();
        dispatch(actions.render());
    },

    computeAutoSupports: (angle) => (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;

        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1, 1]);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 0.25)
        }));

        // record previous support face marks for undo&redo
        const tmpSupportFaceMarks = {};
        const availModels = modelGroup.getModelsAttachedSupport();
        availModels.forEach(model => {
            tmpSupportFaceMarks[model.modelID] = model.supportFaceMarks;
        });
        dispatch(actions.updateState({
            tmpSupportFaceMarks
        }));

        const models = modelGroup.computeSupportArea(angle);

        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 1)
        }));
        if (models.length > 0) {
            dispatch(actions.generateSupports(models, angle));
        }
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            const s = Object.assign({}, state, action.state);
            window.pp = s;
            return s;
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
