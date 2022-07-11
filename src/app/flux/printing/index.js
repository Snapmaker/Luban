/* eslint-disable */
import { cloneDeep, filter, find as lodashFind, isNil } from 'lodash';
import path from 'path';
import * as THREE from 'three';
import { Vector3 } from 'three';
import {
    acceleratedRaycast,
    computeBoundsTree,
    disposeBoundsTree
} from 'three-mesh-bvh';
import { timestamp } from '../../../shared/lib/random-utils';
import api from '../../api';
import {
    ABSENT_OBJECT,
    BLACK_COLOR,
    BOTH_EXTRUDER_MAP_NUMBER,
    DATA_PREFIX,
    DUAL_EXTRUDER_LIMIT_WIDTH_L,
    DUAL_EXTRUDER_LIMIT_WIDTH_R,
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    EPSILON,
    GCODEPREVIEWMODES,
    GCODE_VISIBILITY_TYPE,
    getMachineSeriesWithToolhead,
    HEAD_PRINTING,
    LEFT_EXTRUDER,
    LEFT_EXTRUDER_MAP_NUMBER,
    LOAD_MODEL_FROM_INNER,
    LOAD_MODEL_FROM_OUTER,
    MACHINE_SERIES,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_MANAGER_TYPE_EXTRUDER,
    PRINTING_MATERIAL_CONFIG_GROUP_DUAL,
    PRINTING_MATERIAL_CONFIG_GROUP_SINGLE,
    PRINTING_QUALITY_CONFIG_GROUP_DUAL,
    PRINTING_QUALITY_CONFIG_GROUP_SINGLE,
    RIGHT_EXTRUDER,
    RIGHT_EXTRUDER_MAP_NUMBER,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    WHITE_COLOR
} from '../../constants';
import { controller } from '../../lib/controller';
import {
    logPritingSlice,
    logProfileChange,
    logToolBarOperation,
    logTransformOperation
} from '../../lib/gaEvent';
import i18n from '../../lib/i18n';
import ProgressStatesManager, {
    PROCESS_STAGE,
    STEP_STAGE
} from '../../lib/manager/ProgressManager';
import workerManager from '../../lib/manager/workerManager';
import ModelGroup from '../../models/ModelGroup';
import PrimeTowerModel from '../../models/PrimeTowerModel';
import ThreeGroup from '../../models/ThreeGroup';
import { machineStore } from '../../store/local-storage';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import ModelExporter from '../../ui/widgets/PrintingVisualizer/ModelExporter';
import ModelLoader from '../../ui/widgets/PrintingVisualizer/ModelLoader';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import { actions as appGlobalActions } from '../app-global';
import definitionManager from '../manager/DefinitionManager';
import PresetDefinitionModel from '../manager/PresetDefinitionModel';
// eslint-disable-next-line import/no-cycle
import { actions as operationHistoryActions } from '../operation-history';
import AddOperation3D from '../operation-history/AddOperation3D';
import AddSupportsOperation3D from '../operation-history/AddSupportsOperation3D';
import ArrangeOperation3D from '../operation-history/ArrangeOperation3D';
import DeleteOperation3D from '../operation-history/DeleteOperation3D';
import DeleteSupportsOperation3D from '../operation-history/DeleteSupportsOperation3D';
import GroupAlignOperation3D from '../operation-history/GroupAlignOperation3D';
import GroupOperation3D from '../operation-history/GroupOperation3D';
import MoveOperation3D from '../operation-history/MoveOperation3D';
import OperationHistory from '../operation-history/OperationHistory';
import Operations from '../operation-history/Operations';
import RotateOperation3D from '../operation-history/RotateOperation3D';
import ScaleOperation3D from '../operation-history/ScaleOperation3D';
import ScaleToFitWithRotateOperation3D from '../operation-history/ScaleToFitWithRotateOperation3D';
import UngroupOperation3D from '../operation-history/UngroupOperation3D';
import VisibleOperation3D from '../operation-history/VisibleOperation3D';
import { resolveDefinition } from '../../../shared/lib/definitionResolver';
import ThreeModel from '../../models/ThreeModel';

const { Transfer } = require('threads');

// register methods for three-mesh-bvh
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

const operationHistory = new OperationHistory();

const isDefaultQualityDefinition = (definitionId) => {
    return (
        definitionId.indexOf('quality') !== -1
        && (definitionId.indexOf('fast_print') !== -1
            || definitionId.indexOf('high_quality') !== -1
            || definitionId.indexOf('normal_quality') !== -1)
    );
};

const getRealSeries = series => {
    if (series === MACHINE_SERIES.ORIGINAL_LZ.value || series === MACHINE_SERIES.CUSTOM.value) {
        series = MACHINE_SERIES.ORIGINAL.value;
    }
    return series;
};
const getGcodeRenderValue = (object, index) => {
    if (index / 8 >= 1) {
        return Object.values(object[LEFT_EXTRUDER])[index % 8];
    } else {
        return Object.values(object[RIGHT_EXTRUDER])[index % 8];
    }
};
function isLarger(a, b) {
    return a - b > EPSILON;
}

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
const definitionKeysWithDirection = {
    left: {
        material: 'materialDefinitions',
        quality: 'qualityDefinitions',
        extruder: 'extruderLDefinition'
    },
    right: {
        material: 'materialDefinitions',
        quality: 'qualityDefinitions',
        extruder: 'extruderRDefinition'
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
    // Hierarchy: FDM Printer -> Snapmaker -> Active Definition (combination of machine, material, adhesion configurations)
    defaultDefinitions: [],
    materialDefinitions: [],
    qualityDefinitions: [],
    isRecommended: true, // Using recommended settings
    defaultMaterialId: 'material.pla', // TODO: selectedMaterialId
    defaultMaterialIdRight: 'material.pla', // for dual extruder --- right extruder
    defaultQualityId: 'quality.fast_print', // TODO: selectedQualityId
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
    // gcodeLineObjects: [],
    // gcodeParser: null,
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
    supportBrushStatus: 'add', // add | remove

    gcodeEntity: {
        extruderLlineWidth0: 0,
        extruderLlineWidth: 0,
        extruderRlineWidth0: 0,
        extruderRlineWidth: 0,
        layerHeight0: 0,
        layerHeight: 0,
    }
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
                worker: workerManager.loadModel(uploadPath, data => {
                    const { type } = data;

                    switch (type) {
                        case 'LOAD_MODEL_FAILED':
                            task.worker.then(result => {
                                result.terminate();
                            });
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
        if (
            (model.parent instanceof ThreeGroup || key !== 'positionZ')
            && Math.abs(stateFrom[key] - stateTo[key]) > EPSILON
        ) {
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
    const uploadResult = await api.uploadFile(formData, HEAD_PRINTING);
    return uploadResult;
}

export const actions = {
    updateState: state => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    updateTransformation: transformation => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            transformation
        };
    },

    render: () => dispatch => {
        dispatch(
            actions.updateState({
                renderingTimestamp: +new Date()
            })
        );
    },
    // Use for switch machine size
    switchSize: () => async (dispatch, getState) => {
        // state
        const printingState = getState().printing;
        const { gcodeLineGroup, defaultMaterialId } = printingState;

        const { toolHead, series, size } = getState().machine;
        // await dispatch(machineActions.updateMachineToolHead(toolHead, series, CONFIG_HEADTYPE));
        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        await definitionManager.init(CONFIG_HEADTYPE, currentMachine.configPathname[CONFIG_HEADTYPE]);

        const allMaterialDefinition = await definitionManager.getDefinitionsByPrefixName(
            'material'
        );
        const allQualityDefinitions = await definitionManager.getDefinitionsByPrefixName(
            'quality'
        );
        const qualityParamModels = [];
        const activeMaterialType = dispatch(actions.getActiveMaterialType());
        const extruderLDefinition = await definitionManager.getDefinitionsByPrefixName('snapmaker_extruder_0');

        allQualityDefinitions.forEach((eachDefinition) => {
            const paramModel = new PresetDefinitionModel(
                eachDefinition,
                activeMaterialType,
                extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            qualityParamModels.push(paramModel);
        });
        dispatch(
            actions.updateState({
                materialDefinitions: allMaterialDefinition,
                qualityDefinitions: qualityParamModels,
                extruderLDefinition,
                extruderRDefinition: await definitionManager.getDefinitionsByPrefixName('snapmaker_extruder_1')
            })
        );
        // model group
        dispatch(actions.updateBoundingBox());
        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    initSize: () => async (dispatch, getState) => {
        // also used in actions.saveAndClose of project/index.js

        // state
        const printingState = getState().printing;
        const { modelGroup, gcodeLineGroup, defaultMaterialId } = printingState;
        const { toolHead } = getState().machine;
        modelGroup.setDataChangedCallback(
            () => {
                dispatch(actions.render());
            },
            height => {
                dispatch(actions.updateState({ primeTowerHeight: height }));
            }
        );

        let { series } = getState().machine;
        let storedDefaultMaterialId = defaultMaterialId;
        series = getRealSeries(series);
        // await dispatch(machineActions.updateMachineToolHead(toolHead, series, CONFIG_HEADTYPE));
        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        const profileLevel = await definitionManager.init(
            CONFIG_HEADTYPE,
            currentMachine.configPathname[CONFIG_HEADTYPE]
        );

        const defaultConfigId = machineStore.get('defaultConfigId');
        if (
            defaultConfigId
            && Object.prototype.toString.call(defaultConfigId) === '[object String]'
        ) {
            const newConfigId = JSON.parse(defaultConfigId);
            if (newConfigId[series]) {
                storedDefaultMaterialId = newConfigId[series]?.material;
                dispatch(
                    actions.updateState({
                        defaultMaterialId: storedDefaultMaterialId,
                        defaultMaterialIdRight: newConfigId[series]?.materialRight || 'material.pla',
                        defaultQualityId: newConfigId[series]?.quality
                    })
                );
            }
        }
        dispatch(
            actions.updateState({
                helpersExtruderConfig: {
                    adhesion: LEFT_EXTRUDER_MAP_NUMBER,
                    support: LEFT_EXTRUDER_MAP_NUMBER
                },
                extruderLDefinition: definitionManager.extruderLDefinition,
                extruderRDefinition: definitionManager.extruderRDefinition
            })
        );

        // Update machine size after active definition is loaded
        const { size } = getState().machine;
        const allMaterialDefinition = await definitionManager.getDefinitionsByPrefixName(
            'material'
        );
        const activeMaterialType = dispatch(actions.getActiveMaterialType());
        const allQualityDefinitions = await definitionManager.getDefinitionsByPrefixName(
            'quality'
        );
        const qualityParamModels = [];
        allQualityDefinitions.forEach((eachDefinition) => {
            const paramModel = new PresetDefinitionModel(
                eachDefinition,
                activeMaterialType,
                definitionManager.extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            qualityParamModels.push(paramModel);
        });
        const defaultDefinitions = definitionManager?.defaultDefinitions.map((eachDefinition) => {
            if (eachDefinition.definitionId.indexOf('quality.') === 0) {
                const paramModel = new PresetDefinitionModel(
                    eachDefinition,
                    activeMaterialType,
                    definitionManager.extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
                );
                return paramModel
            }
            return eachDefinition
        })
        dispatch(
            actions.updateState({
                defaultDefinitions: definitionManager?.defaultDefinitions,
                materialDefinitions: allMaterialDefinition,
                qualityDefinitions: qualityParamModels,
                printingProfileLevel: profileLevel.printingProfileLevel,
                materialProfileLevel: profileLevel.materialProfileLevel
            })
        );

        // model group
        dispatch(actions.updateBoundingBox());

        // Re-position model group
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    updateBoundingBox: () => (dispatch, getState) => {
        const {
            modelGroup,
            defaultQualityId,
            qualityDefinitions,
            extruderLDefinition,
            extruderRDefinition,
            helpersExtruderConfig
        } = getState().printing;
        const extruderLDefinitionSettings = extruderLDefinition.settings;
        const extruderRDefinitionSettings = extruderRDefinition.settings;
        const activeQualityDefinition = lodashFind(qualityDefinitions, {
            definitionId: defaultQualityId
        });
        const {
            size,
            toolHead: { printingToolhead }
        } = getState().machine;
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
        modelGroup.getModels().forEach(model => {
            // TODO, use constants
            if (model.type === 'baseModel' || model.type === 'group') {
                if (
                    model.extruderConfig.infill === RIGHT_EXTRUDER_MAP_NUMBER
                    || model.extruderConfig.infill === BOTH_EXTRUDER_MAP_NUMBER
                ) {
                    useRight = true;
                }
                if (
                    model.extruderConfig.infill === LEFT_EXTRUDER_MAP_NUMBER
                    || model.extruderConfig.infill === BOTH_EXTRUDER_MAP_NUMBER
                ) {
                    useLeft = true;
                }
                if (
                    model.extruderConfig.shell === RIGHT_EXTRUDER_MAP_NUMBER
                    || model.extruderConfig.shell === BOTH_EXTRUDER_MAP_NUMBER
                ) {
                    useRight = true;
                }
                if (
                    model.extruderConfig.shell === LEFT_EXTRUDER_MAP_NUMBER
                    || model.extruderConfig.shell === BOTH_EXTRUDER_MAP_NUMBER
                ) {
                    useLeft = true;
                }
            }
        });

        const leftExtruderBorder = useRight && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
            ? DUAL_EXTRUDER_LIMIT_WIDTH_L
            : 0;
        const rightExtruderBorder = useLeft && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
            ? DUAL_EXTRUDER_LIMIT_WIDTH_R
            : 0;

        const adhesionType = activeQualityDefinition?.settings?.adhesion_type?.default_value;
        let border = 0;
        let supportLineWidth = 0;
        switch (adhesionType) {
            case 'skirt': {
                const skirtLineCount = activeQualityDefinition?.settings?.skirt_line_count
                    ?.default_value;
                supportLineWidth = extruderLDefinitionSettings?.machine_nozzle_size
                    ?.default_value ?? 0;
                if (
                    helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER
                ) {
                    supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size
                        .default_value;
                }
                border = 7 + (skirtLineCount - 1) * supportLineWidth;

                break;
            }
            case 'brim': {
                const brimLineCount = activeQualityDefinition?.settings?.brim_line_count
                    ?.default_value;
                supportLineWidth = extruderLDefinitionSettings?.machine_nozzle_size
                    ?.default_value ?? 0;
                if (
                    helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER
                ) {
                    supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size
                        .default_value;
                }
                border = brimLineCount * supportLineWidth;
                break;
            }
            case 'raft': {
                const raftMargin = activeQualityDefinition?.settings?.raft_margin
                    ?.default_value;
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
        dispatch(
            actions.updateState({
                stopArea: newStopArea
            })
        );

        const modelState = modelGroup.updateBoundingBox(
            new THREE.Box3(
                new THREE.Vector3(
                    -size.x / 2 - EPSILON + newStopArea.left,
                    -size.y / 2 + newStopArea.front - EPSILON,
                    -EPSILON
                ),
                new THREE.Vector3(
                    size.x / 2 + EPSILON - newStopArea.right,
                    size.y / 2 - newStopArea.back + EPSILON,
                    size.z + EPSILON
                )
            )
        );
        dispatch(actions.updateState(modelState));
    },

    updateDefaultConfigId: (type,
        defaultId, direction = LEFT_EXTRUDER) => (
            dispatch,
            getState
        ) => {
            let { series } = getState().machine;
            series = getRealSeries(series);
            const printingState = getState().printing;
            const {
                defaultMaterialId,
                defaultMaterialIdRight,
                defaultQualityId,
                materialDefinitions,
                qualityDefinitions
            } = printingState;
            let activeMaterialType = dispatch(actions.getActiveMaterialType());

            let originalConfigId = {};
            if (machineStore.get('defaultConfigId')) {
                originalConfigId = JSON.parse(machineStore.get('defaultConfigId'));
            }
            if (originalConfigId[series]) {
                if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
                    switch (direction) {
                        case LEFT_EXTRUDER:
                            originalConfigId[series].material = defaultId;
                            activeMaterialType = dispatch(actions.getActiveMaterialType(defaultId));
                            if (defaultMaterialId !== defaultId) {
                                logProfileChange(HEAD_PRINTING, 'material');
                            }
                            break;
                        case RIGHT_EXTRUDER:
                            originalConfigId[series].materialRight = defaultId;
                            if (defaultMaterialIdRight !== defaultId) {
                                logProfileChange(HEAD_PRINTING, 'materialRight');
                            }
                            break;
                        default:
                            break;
                    }
                } else {
                    originalConfigId[series][type] = defaultId;
                    if (defaultQualityId !== defaultId) {
                        logProfileChange(HEAD_PRINTING, type);
                    }
                }
            } else {
                originalConfigId[series] = {
                    ...CONFIG_ID,
                    [type]: defaultId
                };
            }
            dispatch(actions.updateDefinitionModelAndCheckVisible({
                activeMaterialType,
                direction,
                type,
                series,
                originalConfigId
            }))

            machineStore.set('defaultConfigId', JSON.stringify(originalConfigId));


        },

    // when switch 'materialType' or 'nozzleSize', has to check defintion visible
    updateDefinitionModelAndCheckVisible: (
        { activeMaterialType, machineNozzleSize, direction, type, originalConfigId, series }
    ) => (dispatch, getState) => {
        const { qualityDefinitions, defaultQualityId } = getState().printing;
        let isSelectedModelVisible = true;
        qualityDefinitions.forEach((item) => {
            item?.updateParams && item.updateParams(activeMaterialType, machineNozzleSize);
            if (direction === LEFT_EXTRUDER
                && (type === PRINTING_MANAGER_TYPE_MATERIAL || type === PRINTING_MANAGER_TYPE_EXTRUDER)
                && item.definitionId === defaultQualityId
            ) {
                isSelectedModelVisible = item.visible
            }
        });
        if (!isSelectedModelVisible) {
            const newQualityId = qualityDefinitions.find(item => item.visible)?.definitionId;
            originalConfigId[series][PRINTING_MANAGER_TYPE_QUALITY] = newQualityId;
            dispatch(
                actions.updateState({
                    defaultQualityId: newQualityId
                })
            );
        }
    },

    // TODO: init should be  re-called
    init: () => async (dispatch, getState) => {
        await dispatch(actions.initSize());

        const printingState = getState().printing;
        const {
            modelGroup,
            initEventFlag,
            qualityDefinitions,
            defaultQualityId
        } = printingState;
        // TODO
        const {
            toolHead: { printingToolhead }
        } = getState().machine;
        // const printingToolhead = machineStore.get('machine.toolHead.printingToolhead');
        const activeQualityDefinition = lodashFind(qualityDefinitions, {
            definitionId: defaultQualityId
        });
        modelGroup.removeAllModels();
        const primeTowerModel = modelGroup.primeTower;
        if (printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            const enablePrimeTower = activeQualityDefinition?.settings?.prime_tower_enable
                ?.default_value;
            primeTowerModel.visible = enablePrimeTower;
        } else {
            primeTowerModel.visible = false;
        }
        if (!initEventFlag) {
            dispatch(
                actions.updateState({
                    initEventFlag: true
                })
            );
            // generate gcode event
            controller.on('slice:started', () => {
                const { progressStatesManager } = getState().printing;
                progressStatesManager.startProgress(
                    PROCESS_STAGE.PRINTING_SLICE_AND_PREVIEW
                );
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_SLICING,
                        progress: progressStatesManager.updateProgress(
                            STEP_STAGE.PRINTING_SLICING,
                            0.01
                        )
                    })
                );
            });
            controller.on('slice:completed', (args) => {
                const {
                    gcodeFilename,
                    gcodeFileLength,
                    printTime,
                    filamentLength,
                    filamentWeight,
                    renderGcodeFileName,
                    gcodeHeader,
                } = args;
                const { progressStatesManager } = getState().printing;
                dispatch(
                    actions.updateState({
                        gcodeFile: {
                            name: gcodeFilename,
                            uploadName: gcodeFilename,
                            size: gcodeFileLength,
                            lastModified: +new Date(),
                            thumbnail: '',
                            renderGcodeFileName,

                            type: gcodeHeader[';header_type'],
                            tool_head: gcodeHeader[';tool_head'],
                            nozzle_temperature: gcodeHeader[';nozzle_temperature(°C)'],
                            build_plate_temperature: gcodeHeader[';build_plate_temperature(°C)'],
                            work_speed: gcodeHeader[';work_speed(mm/minute)'],
                            estimated_time: gcodeHeader[';estimated_time(s)'],
                            matierial_weight: gcodeHeader[';matierial_weight'],
                            nozzle_1_temperature: gcodeHeader[';nozzle_1_temperature(°C)'],
                            jog_speed: gcodeHeader[';jog_speed(mm/minute)'],
                            power: gcodeHeader[';power(%)'],
                        },
                        printTime,
                        filamentLength,
                        filamentWeight,
                        stage: STEP_STAGE.PRINTING_SLICING,
                        progress: progressStatesManager.updateProgress(
                            STEP_STAGE.PRINTING_SLICING,
                            1
                        )
                    })
                );
                progressStatesManager.startNextStep();

                modelGroup.unselectAllModels();
                dispatch(actions.loadGcode(gcodeFilename));
                dispatch(actions.setTransformMode(''));
            });
            controller.on('slice:progress', progress => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                if (
                    progress - state.progress > 0.01
                    || progress > 1 - EPSILON
                ) {
                    dispatch(
                        actions.updateState({
                            progress: progressStatesManager.updateProgress(
                                STEP_STAGE.PRINTING_SLICING,
                                progress
                            )
                        })
                    );
                }
            });
            controller.on('slice:error', () => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                progressStatesManager.finishProgress(false);
                dispatch(
                    actions.updateState({
                        progress: 100,
                        stage: STEP_STAGE.PRINTING_SLICE_FAILED,
                        promptTasks: [
                            {
                                status: 'fail',
                                type: 'slice'
                            }
                        ]
                    })
                );
            });

            // generate supports
            controller.on('generate-support:started', () => {
                const { progressStatesManager } = getState().printing;
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                        progress: progressStatesManager.updateProgress(
                            STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                            0.01
                        )
                    })
                );
            });
            controller.on('generate-support:completed', args => {
                const { supportFilePaths } = args;
                const { progressStatesManager } = getState().printing;
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                        progress: progressStatesManager.updateProgress(
                            STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                            1
                        )
                    })
                );

                dispatch(actions.loadSupports(supportFilePaths));
            });
            controller.on('generate-support:progress', progress => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                if (
                    progress - state.progress > 0.01
                    || progress > 1 - EPSILON
                ) {
                    dispatch(
                        actions.updateState({
                            progress: progressStatesManager.updateProgress(
                                STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                                progress
                            )
                        })
                    );
                }
            });
            controller.on('generate-support:error', () => {
                const state = getState().printing;
                const { progressStatesManager } = state;
                progressStatesManager.finishProgress(false);
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_FAILED
                    })
                );
            });
        }
    },

    logGenerateGcode: () => (dispatch, getState) => {
        const {
            extruderLDefinition,
            extruderRDefinition,
            defaultMaterialId,
            defaultMaterialIdRight,
            defaultQualityId,
            qualityDefinitions,
            defaultDefinitions
        } = getState().printing;

        const extruderLDefaultDefinition = defaultDefinitions.find(
            (d) => d.definitionId === defaultMaterialId
        );
        const { toolHead } = getState().machine;
        let defaultMaterialL = extruderLDefaultDefinition?.isDefault
            ? '0'
            : '2';

        const activeActiveQualityDefinition = lodashFind(qualityDefinitions, {
            definitionId: defaultQualityId
        });
        const defaultQualityDefinition = defaultDefinitions.find(d => d.definitionId === defaultQualityId);
        let defaultMaterialQuality = defaultQualityDefinition?.isDefault ? '0' : '2';

        const settings = {
            layer_height:
                activeActiveQualityDefinition.settings?.layer_height
                    ?.default_value,
            infill_pattern:
                activeActiveQualityDefinition.settings?.infill_pattern
                    ?.default_value,
            auto_support:
                activeActiveQualityDefinition.settings?.support_enable
                    ?.default_value,
            initial_layer_height:
                activeActiveQualityDefinition.settings?.layer_height_0
                    ?.default_value,
            build_plate_adhesion_type:
                activeActiveQualityDefinition.settings?.adhesion_type
                    ?.default_value,
            initial_layer_line_width_factor:
                activeActiveQualityDefinition.settings
                    ?.initial_layer_line_width_factor?.default_value
        };

        if (toolHead.printingToolhead === SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2) {
            settings.nozzle_diameter_L = extruderLDefinition.settings?.machine_nozzle_size?.default_value;

            if (defaultMaterialL === '0') {
                defaultMaterialL = PRINTING_MATERIAL_CONFIG_GROUP_SINGLE.some(item => {
                    return item.fields.some(key => {
                        if (!extruderLDefaultDefinition.settings[key] || !extruderLDefinition.settings[key]) {
                            return false;
                        }
                        return extruderLDefaultDefinition?.settings[key]?.default_value !== extruderLDefinition.settings[key]?.default_value;
                    });
                })
                    ? '1'
                    : '0';
            }
            if (defaultMaterialQuality === '0') {
                defaultMaterialQuality = PRINTING_QUALITY_CONFIG_GROUP_SINGLE.some(item => {
                    return item.fields.some(key => {
                        if (!activeActiveQualityDefinition.settings[key] || !defaultQualityDefinition.settings[key]) {
                            return false;
                        }
                        return activeActiveQualityDefinition.settings[key]?.default_value !== defaultQualityDefinition.settings[key]?.default_value;
                    });
                })
                    ? '1'
                    : '0';
            }
            logPritingSlice(
                HEAD_PRINTING,
                {
                    defaultMaterialL,
                    defaultMaterialR: '',
                    defaultMaterialQuality
                },
                JSON.stringify(settings)
            );
        } else {
            const extruderRDefaultDefinition = defaultDefinitions.find(
                (d) => d.definitionId === defaultMaterialIdRight
            );

            settings.nozzle_diameter_L = extruderLDefinition.settings?.machine_nozzle_size?.default_value;
            settings.nozzle_diameter_R = extruderRDefinition.settings?.machine_nozzle_size?.default_value;

            if (defaultMaterialL === '0') {
                defaultMaterialL = PRINTING_MATERIAL_CONFIG_GROUP_SINGLE.some(item => {
                    return item.fields.some(key => {
                        if (!extruderLDefaultDefinition.settings[key] || !extruderLDefinition.settings[key]) {
                            return false;
                        }
                        return extruderLDefaultDefinition.settings[key].default_value !== extruderLDefinition.settings[key].default_value;
                    });
                })
                    ? '1'
                    : '0';
            }

            let defaultMaterialR = extruderRDefaultDefinition?.isDefault
                ? '0'
                : '2';
            if (defaultMaterialR === '0') {
                defaultMaterialR = PRINTING_MATERIAL_CONFIG_GROUP_DUAL.some(item => {
                    return item.fields.some(key => {
                        if (!extruderRDefaultDefinition.settings[key] || !extruderRDefinition.settings[key]) {
                            return false;
                        }
                        return extruderRDefaultDefinition?.settings[key].default_value !== extruderRDefinition.settings[key].default_value;
                    });
                })
                    ? '1'
                    : '0';
            }

            if (defaultMaterialQuality === '0') {
                defaultMaterialQuality = PRINTING_QUALITY_CONFIG_GROUP_DUAL.some(item => {
                    return item.fields.some(key => {
                        if (!activeActiveQualityDefinition.settings[key] || !defaultQualityDefinition.settings[key]) {
                            return false;
                        }
                        return activeActiveQualityDefinition.settings[key].default_value !== defaultQualityDefinition.settings[key].default_value;
                    });
                })
                    ? '1'
                    : '0';
            }
            logPritingSlice(
                HEAD_PRINTING,
                {
                    defaultMaterialL,
                    defaultMaterialR,
                    defaultMaterialQuality
                },
                JSON.stringify(settings)
            );
        }
    },

    gcodeRenderingCallback: (data, extruderColors) => (dispatch, getState) => {
        const { gcodeLineGroup, gcodePreviewMode, gcodeEntity } = getState().printing;

        const { status, value } = data;
        switch (status) {
            case 'succeed': {
                const { gcodeEntityLayers: bufferGeometry, layerCount, bounds } = value;

                dispatch(actions.destroyGcodeLine());

                const object3D = gcodeBufferGeometryToObj3d('3DP', bufferGeometry, null, {
                    ...gcodeEntity,
                    extruderColors
                });
                gcodeLineGroup.add(object3D);

                object3D.position.copy(new THREE.Vector3());
                dispatch(actions.updateState({
                    layerCount,
                    layerRangeDisplayed: [0, layerCount - 1],
                    gcodeLine: object3D
                }));

                dispatch(actions.updateGcodePreviewMode(gcodePreviewMode));

                const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
                dispatch(
                    actions.checkGcodeBoundary(
                        minX,
                        minY,
                        minZ,
                        maxX,
                        maxY,
                        maxZ
                    )
                );
                dispatch(actions.showGcodeLayers([0, layerCount - 1]));
                dispatch(actions.displayGcode());

                const { progressStatesManager } = getState().printing;
                dispatch(actions.updateState({
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_PREVIEWING, 1)
                }));
                progressStatesManager.startNextStep();
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_PREVIEWING
                    })
                );
                dispatch(actions.logGenerateGcode(layerCount));
                break;
            }
            case 'progress': {
                const state = getState().printing;
                const { progressStatesManager } = state;
                if (Math.abs(value - state.progress) > 0.01 || value > 1 - EPSILON) {
                    dispatch(
                        actions.updateState({
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_PREVIEWING, value)
                        })
                    );
                }
                break;
            }
            case 'err': {
                const { progressStatesManager } = getState().printing;
                progressStatesManager.finishProgress(false);
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_PREVIEW_FAILED,
                        progress: 0
                    })
                );
                break;
            }
            default:
                break;
        }
    },

    getDefaultDefinition: id => (dispatch, getState) => {
        const { defaultDefinitions } = getState().printing;
        const def = defaultDefinitions.find((d) => d.definitionId === id);
        return def?.settings;
    },

    resetDefinitionById: (type, definitionId, shouldDestroyGcodeLine) => (
        dispatch,
        getState
    ) => {
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const state = getState().printing;
        const defaultDefinitions = state.defaultDefinitions;
        const definitions = state[definitionsKey];

        const newDefModel = cloneDeep(
            defaultDefinitions.find((d) => d.definitionId === definitionId)
        );
        definitionManager.updateDefinition(newDefModel);
        const index = definitions.findIndex(
            (d) => d.definitionId === definitionId
        );
        definitions[index] = newDefModel;

        dispatch(
            actions.updateState({
                [definitionsKey]: [...definitions]
            })
        );
        dispatch(actions.updateBoundingBox());
        if (shouldDestroyGcodeLine) {
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        }
        return newDefModel;
    },

    updateShowPrintingManager: (
        showPrintingManager,
        direction = LEFT_EXTRUDER
    ) => (dispatch) => {
        dispatch(
            actions.updateState({
                showPrintingManager,
                materialManagerDirection: direction
            })
        );
    },

    updateManagerDisplayType: managerDisplayType => dispatch => {
        dispatch(actions.updateState({ managerDisplayType }));
    },

    updateCurrentDefinition: ({
        definitionModel,
        managerDisplayType: type,
        changedSettingArray,
        direction = LEFT_EXTRUDER,
        shouldUpdateIsOversteped = false
    }) => (dispatch, getState) => {
        const printingState = getState().printing;
        const { series } = getState().machine;
        const { qualityDefinitions } = printingState;
        const id = definitionModel?.definitionId;
        const definitionsKey = definitionKeysWithDirection[direction][type];
        let { extruderLDefinition: actualExtruderDefinition } = printingState;
        let UpdatePresetModel = false;
        resolveDefinition(definitionModel, changedSettingArray);
        // Todo
        if (['snapmaker_extruder_0', 'snapmaker_extruder_1'].includes(id)) {
            if (id === 'snapmaker_extruder_0') {
                actualExtruderDefinition = definitionModel
                UpdatePresetModel = true;
            }
            dispatch(
                actions.updateState({
                    [definitionsKey]: definitionModel
                })
            );
        } else {
            const definitions = printingState[definitionsKey];
            const index = definitions.findIndex((d) => d.definitionId === id);
            definitions[index] = definitionModel;
            dispatch(
                actions.updateState({
                    [definitionsKey]: [...definitions]
                })
            );
        }
        dispatch(actions.updateDefinitionModelAndCheckVisible({
            type,
            direction,
            series,
            machineNozzleSize: actualExtruderDefinition.settings?.machine_nozzle_size?.default_value,
            originalConfigId: machineStore.get('defaultConfigId') ? JSON.parse(machineStore.get('defaultConfigId')) : {}
        }))
        definitionManager.updateDefinition(definitionModel);
        if (UpdatePresetModel) {
            dispatch(actions.updateState({ qualityDefinitions: [...qualityDefinitions] }));
        }
        if (shouldUpdateIsOversteped) {
            const { modelGroup } = printingState;
            const isAnyModelOverstepped = modelGroup.getOverstepped(
                definitionModel?.settings?.prime_tower_enable?.default_value
            );
            dispatch(actions.updateState({ isAnyModelOverstepped }));
        }
        dispatch(actions.applyProfileToAllModels());
    },

    onUploadManagerDefinition: (file, type) => (dispatch, getState) => {
        return new Promise(resolve => {
            const formData = new FormData();
            formData.append('file', file);
            api.uploadFile(formData, HEAD_PRINTING)
                .then(async (res) => {
                    const response = res.body;
                    const definitionId = `${type}.${timestamp()}`;
                    const definition = await definitionManager.uploadDefinition(
                        definitionId,
                        response.uploadName
                    );
                    let name = definition.name;
                    definition.isRecommended = false;
                    const definitionsKey = defaultDefinitionKeys[type].definitions;
                    const definitions = getState().printing[definitionsKey];
                    while (definitions.find((e) => e.name === name)) {
                        name = `#${name}`;
                    }
                    await definitionManager.updateDefinition({
                        definitionId: definition.definitionId,
                        name
                    });
                    dispatch(
                        actions.updateState({
                            [definitionsKey]: [...definitions, definition]
                            // Newly imported profiles should not be automatically applied
                            // [defaultId]: definitionId
                        })
                    );
                    resolve(definition);
                })
                .catch(() => {
                    // Ignore error
                });
        });
    },

    updateDefinitionNameByType: (
        type,
        definition,
        name,
        isCategorySelected = false
    ) => async (dispatch, getState) => {
        if (!name || name.trim().length === 0) {
            return Promise.reject(
                i18n._(
                    'key-Printing/Common-Failed to rename. Please enter a new name.'
                )
            );
        }
        const definitionsKey = defaultDefinitionKeys[type]?.definitions;

        const definitions = getState().printing[definitionsKey];
        const duplicated = definitions.find((d) => d.name === name);

        if (duplicated && duplicated !== definition) {
            return Promise.reject(
                i18n._('Failed to rename. "{{name}}" already exists.', { name })
            );
        }
        if (isCategorySelected) {
            const oldCategory = definition.category;
            definitions.forEach(item => {
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
            const index = definitions.findIndex(
                (d) => d.definitionId === definition?.definitionId
            );
            definitions[index].name = name;
        }
        dispatch(
            actions.updateState({
                [definitionsKey]: [...definitions]
            })
        );
        return null;
    },

    /**
     * @param {*} type 'material'|'quality'
     */
    duplicateDefinitionByType: (
        type,
        definition,
        newDefinitionId,
        newDefinitionName
    ) => async (dispatch, getState) => {
        const state = getState().printing;
        let name = newDefinitionName || definition.name;
        let definitionId;
        if (
            type === PRINTING_MANAGER_TYPE_QUALITY
            && isDefaultQualityDefinition(definition.definitionId)
        ) {
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

        const definitionsWithSameCategory = state[definitionsKey].filter(
            (d) => d.category === definition.category
        );
        // make sure name is not repeated
        while (
            definitionsWithSameCategory.find(
                (d) => d.name === newDefinition.name
            )
        ) {
            newDefinition.name = `#${newDefinition.name}`;
        }

        // Simplify settings
        for (const key of definition.ownKeys) {
            newDefinition.settings[key] = {
                default_value: definition.settings[key].default_value
            };
        }
        let createdDefinitionModel = await definitionManager.createDefinition(newDefinition);
        const { extruderLDefinition } = state;
        const activeMaterialType = dispatch(actions.getActiveMaterialType());
        if (createdDefinitionModel.definitionId.indexOf('quality.') === 0) {
            createdDefinitionModel = new PresetDefinitionModel(
                createdDefinitionModel,
                activeMaterialType,
                extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
        }

        dispatch(
            actions.updateState({
                [definitionsKey]: [...state[definitionsKey], createdDefinitionModel]
            })
        );

        return createdDefinitionModel;
    },

    getActiveMaterialType: (defaultId) => (undefined, getState) => {
        const { materialDefinitions, defaultMaterialId } = getState().printing;
        const id = defaultId || defaultMaterialId;
        const activeMaterialDefinition = materialDefinitions.find((d) => d.definitionId === id);
        return activeMaterialDefinition?.settings?.material_type?.default_value;
    },

    duplicateMaterialCategoryDefinitionByType: (
        type,
        activeToolList,
        isCreate,
        oldCategory
    ) => async (dispatch, getState) => {
        const state = getState().printing;
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const definitions = cloneDeep(state[definitionsKey]);
        let newCategoryName = activeToolList.category;
        const allDupliateDefinitions = [];
        // make sure category is not repeated
        while (definitions.find((d) => d.category === newCategoryName)) {
            newCategoryName = `#${newCategoryName}`;
        }
        const definitionModelsWithSameCategory = isCreate
            ? [
                {
                    ...activeToolList,
                    name:
                        type === PRINTING_MANAGER_TYPE_MATERIAL
                            ? i18n._('key-default_category-Default Material')
                            : i18n._('key-default_category-Default Preset'),
                    settings: definitions[0]?.settings
                }
            ]
            : state[definitionsKey].filter((d) => d.category === oldCategory);

        const { extruderLDefinition } = state;
        const activeMaterialType = dispatch(actions.getActiveMaterialType());

        for (let i = 0; i < definitionModelsWithSameCategory.length; i++) {
            const newDefinition = definitionModelsWithSameCategory[i];
            newDefinition.category = newCategoryName;
            newDefinition.i18nCategory = '';
            const definitionId = `${newDefinition.definitionId}${timestamp()}`;
            newDefinition.definitionId = definitionId;
            const createdDefinitionModel = await definitionManager.createDefinition(
                newDefinition
            );
            if (createdDefinitionModel.definitionId.indexOf('quality.') === 0) {
                createdDefinitionModel = new PresetDefinitionModel(
                    createdDefinitionModel,
                    activeMaterialType,
                    extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
                );
            }
            if (createdDefinitionModel) {
                allDupliateDefinitions.push(createdDefinitionModel);
            }
        }
        dispatch(
            actions.updateState({
                [definitionsKey]: [...definitions, ...allDupliateDefinitions]
            })
        );
        return allDupliateDefinitions[0];
    },

    removeDefinitionByType: (type, definition, loop = false) => async (
        dispatch,
        getState
    ) => {
        const state = getState().printing;

        await definitionManager.removeDefinition(definition);
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const defintions = state[definitionsKey].filter(
            (d) => d.definitionId !== definition.definitionId
        );

        if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            const defaultMaterialId = state?.defaultMaterialId;
            const defaultMaterialIdRight = state?.defaultMaterialIdRight;
            if (defaultMaterialId === definition.definitionId) {
                dispatch(
                    actions.updateDefaultIdByType(
                        type,
                        defintions[0].definitionId,
                        LEFT_EXTRUDER
                    )
                );
            }
            if (defaultMaterialIdRight === definition.definitionId) {
                dispatch(
                    actions.updateDefaultIdByType(
                        type,
                        defintions[0].definitionId,
                        RIGHT_EXTRUDER
                    )
                );
            }
        }
        !loop
            && dispatch(
                actions.updateState({
                    [definitionsKey]: defintions
                })
            );
    },

    removeToolCategoryDefinition: (type, category) => async (
        dispatch,
        getState
    ) => {
        const state = getState().printing;
        const definitionsKey = defaultDefinitionKeys[type].definitions;

        const definitions = state[definitionsKey];
        const newDefinitions = [];
        const definitionsWithSameCategory = definitions.filter((d) => {
            if (d.category === category) {
                return true;
            } else {
                newDefinitions.push(d);
                return false;
            }
        });
        const ps = definitionsWithSameCategory.map(item => {
            return dispatch(actions.removeDefinitionByType(type, item, true));
        });
        await Promise.all(ps);

        dispatch(
            actions.updateState({
                [definitionsKey]: newDefinitions
            })
        );
    },

    // removes all non-predefined definitions
    // now only used in reset settings
    removeAllMaterialDefinitions: () => async (dispatch, getState) => {
        const state = getState().printing;

        const newMaterialDefinitions = [];
        const defaultDefinitionIds = [
            'material.pla',
            'material.abs',
            'material.petg',
            'material.pla.black',
            'material.abs.black',
            'material.petg.black',
            'material.pla.blue',
            'material.pla.grey',
            'material.pla.red',
            'material.pla.yellow',
            'material.petg.blue',
            'material.petg.red',
            'material.pla.glow',
            'material.pla.wood',
            'material.tpu.black',
            'material.tpu.yellow'
        ];
        for (const definition of state.materialDefinitions) {
            if (defaultDefinitionIds.includes(definition.definitionId)) {
                newMaterialDefinitions.push(definition);
                continue;
            }
            definitionManager.removeDefinition(definition);
        }

        dispatch(
            actions.updateState({
                materialDefinitions: newMaterialDefinitions
            })
        );
    },

    // removes all non-predefined definitions
    removeAllQualityDefinitions: () => async (dispatch, getState) => {
        const state = getState().printing;

        const newQualityDefinitions = [];
        for (const definition of state.qualityDefinitions) {
            if (definition.isRecommended) {
                newQualityDefinitions.push(definition);
                continue;
            }
            definitionManager.removeDefinition(definition);
        }

        dispatch(
            actions.updateState({
                qualityDefinitions: newQualityDefinitions
            })
        );
    },

    updateIsRecommended: isRecommended => dispatch => {
        dispatch(actions.updateState({ isRecommended }));
    },
    updateDefaultIdByType: (type, newDefinitionId, direction = LEFT_EXTRUDER) => dispatch => {
        let defaultId;
        if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            defaultId = direction === LEFT_EXTRUDER
                ? 'defaultMaterialId'
                : 'defaultMaterialIdRight';
        } else {
            defaultId = defaultDefinitionKeys[type].id;
        }
        dispatch(actions.updateDefaultConfigId(type, newDefinitionId, direction));
        dispatch(
            actions.updateState({
                [defaultId]: newDefinitionId
            })
        );
        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },
    updateDefaultMaterialId: (materialId, direction = LEFT_EXTRUDER) => dispatch => {
        const updateKey = direction === LEFT_EXTRUDER ? 'defaultMaterialId' : 'defaultMaterialIdRight';
        dispatch(actions.updateDefaultConfigId(PRINTING_MANAGER_TYPE_MATERIAL, materialId, direction));
        dispatch(actions.updateState({ [updateKey]: materialId }));
    },

    updateDefaultQualityId: qualityId => dispatch => {
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
    __loadModel: files => async dispatch => {
        const headType = 'printing';
        const sourceType = '3d';
        const mode = '3d';
        const width = 0;
        const height = 0;

        await dispatch(
            actions.generateModel(headType, {
                files,
                sourceWidth: width,
                sourceHeight: height,
                mode,
                sourceType,
                transformation: {}
            })
        );
    },

    // Upload model
    // @param files
    uploadModel: files => async (dispatch, getState) => {
        const ps = Array.from(files).map(async file => {
            // Notice user that model is being loading
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.uploadFile(formData, HEAD_PRINTING);
            const { originalName, uploadName } = res.body;
            return { originalName, uploadName };
        });
        const fileNames = await Promise.all(ps);
        actions.__loadModel(fileNames)(dispatch, getState);
    },

    setTransformMode: (value) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        modelGroup.setTransformMode(value);
        dispatch(actions.updateState({
            transformMode: value
        }));
        dispatch(actions.render());
    },

    destroyGcodeLine: () => (dispatch, getState) => {
        const { gcodeLine, gcodeLineGroup } = getState().printing;
        if (gcodeLine) {
            gcodeLineGroup.remove(gcodeLine);
            // gcodeLine.geometry.dispose();
            dispatch(actions.updateState({
                gcodeFile: null,
                gcodeLine: null,
                displayedType: 'model'
            }));
        }
    },

    generateGrayModeObject: () => async (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.grayModeObject = new THREE.Group();
        const materialNormal = new THREE.MeshLambertMaterial({
            color: '#2a2c2e',
            side: THREE.FrontSide,
            depthWrite: false,
            transparent: true,
            opacity: 0.3,
            polygonOffset: true,
            polygonOffsetFactor: -5,
            polygonOffsetUnits: -0.1
        });
        const models = filter(modelGroup.getModels(), (modelItem) => {
            return modelItem.visible;
        });
        models.forEach((model) => {
            let meshObject = lodashFind(modelGroup.object.children, {
                uuid: model.meshObject.uuid
            });
            meshObject = meshObject.clone();
            meshObject.material = materialNormal;
            if (model instanceof ThreeGroup) {
                meshObject.children.forEach((mesh) => {
                    mesh.material = materialNormal;
                    mesh.clear(); // clear support mesh
                });
            } else {
                meshObject.clear(); // clear support mesh
            }
            modelGroup.grayModeObject.add(meshObject);
        });
    },

    generateGcode: (thumbnail, isGuideTours = false) => async (dispatch, getState) => {
        const {
            hasModel,
            modelGroup,
            progressStatesManager,
            helpersExtruderConfig,
            layerCount,
            extruderLDefinition,
            extruderRDefinition,
            defaultMaterialId,
            defaultMaterialIdRight,
            defaultQualityId,
            qualityDefinitions,
            materialDefinitions,
            stopArea: { left, front }
        } = getState().printing;
        const {
            size,
            series,
            toolHead: { printingToolhead }
        } = getState().machine;
        const models = modelGroup.getVisibleValidModels();
        if (!models || models.length === 0 || !hasModel) {
            return;
        }
        // update extruder definitions
        const activeQualityDefinition = qualityDefinitions.find(
            (d) => d.definitionId === defaultQualityId
        );
        const hasPrimeTower = printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
            && activeQualityDefinition.settings.prime_tower_enable.default_value;
        let primeTowerXDefinition = 0;
        let primeTowerYDefinition = 0;
        if (hasPrimeTower) {
            const modelGroupBBox = modelGroup._bbox;
            const primeTowerModel = modelGroup.primeTower;
            const primeTowerWidth = primeTowerModel.boundingBox.max.x
                - primeTowerModel.boundingBox.min.x;
            const primeTowerPositionX = modelGroupBBox.max.x
                - (primeTowerModel.boundingBox.max.x
                    + primeTowerModel.boundingBox.min.x
                    + primeTowerWidth)
                / 2;
            const primeTowerPositionY = modelGroupBBox.max.y
                - (primeTowerModel.boundingBox.max.y
                    + primeTowerModel.boundingBox.min.y
                    - primeTowerWidth)
                / 2;
            primeTowerXDefinition = size.x - primeTowerPositionX - left;
            primeTowerYDefinition = size.y - primeTowerPositionY - front;
            activeQualityDefinition.settings.prime_tower_position_x.default_value = primeTowerXDefinition;
            activeQualityDefinition.settings.prime_tower_position_y.default_value = primeTowerYDefinition;
            activeQualityDefinition.settings.prime_tower_size.default_value = primeTowerWidth;
        }
        const indexL = materialDefinitions.findIndex(
            (d) => d.definitionId === defaultMaterialId
        );
        const indexR = materialDefinitions.findIndex(
            (d) => d.definitionId === defaultMaterialIdRight
        );
        const newExtruderLDefinition = definitionManager.finalizeExtruderDefinition(
            {
                extruderDefinition: extruderLDefinition,
                materialDefinition: materialDefinitions[indexL],
                hasPrimeTower,
                primeTowerXDefinition,
                primeTowerYDefinition
            }
        );
        const newExtruderRDefinition = definitionManager.finalizeExtruderDefinition(
            {
                extruderDefinition: extruderRDefinition,
                materialDefinition: materialDefinitions[indexR],
                hasPrimeTower,
                primeTowerXDefinition,
                primeTowerYDefinition
            }
        );
        definitionManager.calculateDependencies(
            activeQualityDefinition.settings,
            modelGroup && modelGroup.hasSupportModel(),
            newExtruderLDefinition.settings,
            newExtruderRDefinition.settings,
            helpersExtruderConfig
        );
        definitionManager.updateDefinition({
            ...newExtruderLDefinition,
            definitionId: 'snapmaker_extruder_0'
        });
        definitionManager.updateDefinition({
            ...newExtruderRDefinition,
            definitionId: 'snapmaker_extruder_1'
        });

        modelGroup.unselectAllModels();
        if (isGuideTours) {
            dispatch(
                actions.updateState({
                    thumbnail: thumbnail
                })
            );
        }
        // Info user that slice has started
        progressStatesManager.startProgress(
            PROCESS_STAGE.PRINTING_SLICE_AND_PREVIEW
        );
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_SLICING,
                progress: progressStatesManager.updateProgress(
                    STEP_STAGE.PRINTING_SLICING,
                    0
                )
            })
        );

        // Prepare model file
        const { model, support, definition, originalName } = await dispatch(
            actions.prepareModel()
        );
        const currentModelName = path.basename(
            models[0]?.modelName,
            path.extname(models[0]?.modelName)
        );
        const renderGcodeFileName = `${currentModelName}_${new Date().getTime()}`;

        activeQualityDefinition.settings.machine_heated_bed.default_value = extruderLDefinition.settings.machine_heated_bed.default_value;
        activeQualityDefinition.settings.material_bed_temperature.default_value = extruderLDefinition.settings.material_bed_temperature.default_value;
        activeQualityDefinition.settings.material_bed_temperature_layer_0.default_value = extruderLDefinition.settings.material_bed_temperature_layer_0.default_value;

        const activeExtruderDefinition = helpersExtruderConfig.adhesion === '0'
            ? extruderLDefinition
            : extruderRDefinition;
        const finalDefinition = definitionManager.finalizeActiveDefinition(
            activeQualityDefinition,
            activeExtruderDefinition,
            size,
            hasPrimeTower
        );
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
        // save line width and layer height for gcode preview
        dispatch(actions.updateState({
            gcodeEntity: {
                extruderLlineWidth0: extruderLDefinition.settings.wall_line_width_0.default_value,
                extruderLlineWidth: extruderLDefinition.settings.wall_line_width_x.default_value,
                extruderRlineWidth0: extruderRDefinition.settings.wall_line_width_0.default_value,
                extruderRlineWidth: extruderRDefinition.settings.wall_line_width_x.default_value,
                layerHeight0: finalDefinition.settings.layer_height_0.default_value,
                layerHeight: finalDefinition.settings.layer_height.default_value,
            }
        }));

        const boundingBox = modelGroup.getBoundingBox();
        const params = {
            definition,
            model,
            support,
            originalName,
            boundingBox,
            thumbnail: thumbnail,
            renderGcodeFileName,
            layerCount,
            matierial0: materialDefinitions[indexL]?.name,
            matierial1: materialDefinitions[indexR]?.name,
            printingToolhead,
            series
        };
        controller.slice(params);
    },

    prepareModel: () => (dispatch, getState) => {
        return new Promise((resolve) => {
            const {
                modelGroup,
                defaultQualityId,
                qualityDefinitions,
                extruderLDefinition,
                extruderRDefinition
            } = getState().printing;
            const activeQualityDefinition = lodashFind(qualityDefinitions, {
                definitionId: defaultQualityId
            });
            // Use setTimeout to force export executes in next tick, preventing block of updateState()

            setTimeout(async () => {
                const models = modelGroup.models
                    .filter((i) => i.visible)
                    .reduce((pre, model) => {
                        if (model instanceof ThreeGroup) {
                            pre.push(...model.children);
                        } else {
                            pre.push(model);
                        }
                        return pre;
                    }, []);
                const ret = {
                    model: [],
                    support: [],
                    definition: [],
                    originalName: null
                };
                for (const item of models) {
                    const modelDefinition = definitionManager.finalizeModelDefinition(
                        activeQualityDefinition,
                        item,
                        extruderLDefinition,
                        extruderRDefinition
                    );

                    const originalName = item.originalName;
                    const uploadPath = `${DATA_PREFIX}/${originalName}`;
                    const basenameWithoutExt = path.basename(
                        uploadPath,
                        path.extname(uploadPath)
                    );
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
                    const definitionName = uploadResult.body.uploadName.replace(
                        /\.stl$/,
                        ''
                    );
                    const uploadName = await definitionManager.createTmpDefinition(
                        modelDefinition,
                        definitionName
                    );
                    ret.definition.push(uploadName);

                    // upload support of model
                    if (supportMesh) {
                        supportMesh.applyMatrix4(mesh.matrix);
                        const supportName = stlFileName.replace(
                            /(\.stl)$/,
                            '_support$1'
                        );
                        const supportUploadResult = await uploadMesh(
                            supportMesh,
                            supportName
                        );
                        ret.support.push(supportUploadResult.body.uploadName);
                    }
                }

                resolve(ret);
            }, 50);
        });
    },

    setShowOriginalModel: show => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        // modelGroup.object.visible = show;
        modelGroup.object.visible = false;
        modelGroup.grayModeObject.visible = show;
        dispatch(actions.render());
    },

    // preview
    setGcodeVisibilityByTypeAndDirection: (type, direction = LEFT_EXTRUDER, visible) => (dispatch, getState) => {
        const { gcodeLine, gcodeTypeInitialVisibility } = getState().printing;
        if (type === 'TOOL0') {
            const gcodeVisibleType = gcodeTypeInitialVisibility[LEFT_EXTRUDER];
            Object.entries(gcodeVisibleType).forEach(([key]) => {
                gcodeVisibleType[key] = visible;
            });
        } else if (type === 'TOOL1') {
            const gcodeVisibleType = gcodeTypeInitialVisibility[RIGHT_EXTRUDER];
            Object.entries(gcodeVisibleType).forEach(([key]) => {
                gcodeVisibleType[key] = visible;
            });
        } else {
            let gcodeVisibleType = gcodeTypeInitialVisibility[LEFT_EXTRUDER];
            if (direction === RIGHT_EXTRUDER) {
                gcodeVisibleType = gcodeTypeInitialVisibility[RIGHT_EXTRUDER];
            }
            gcodeVisibleType[type] = visible;
        }
        dispatch(actions.updateState({ gcodeTypeInitialVisibility }));
        // dispatch(actions.renderShowGcodeLines());
        if (gcodeLine) {
            // const uniforms = gcodeLine.material.uniforms;
            const value = visible ? 1 : 0;
            if (direction === LEFT_EXTRUDER) {
                gcodeLine.children.forEach(mesh => {
                    const uniforms = mesh.material.uniforms;
                    switch (type) {
                        case 'WALL-INNER':
                            uniforms.u_l_wall_inner_visible.value = value;
                            break;
                        case 'WALL-OUTER':
                            uniforms.u_l_wall_outer_visible.value = value;
                            break;
                        case 'SKIN':
                            uniforms.u_l_skin_visible.value = value;
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
                });
            } else {
                gcodeLine.children.forEach(mesh => {
                    const uniforms = mesh.material.uniforms;
                    switch (type) {
                        case 'WALL-INNER':
                            uniforms.u_r_wall_inner_visible.value = value;
                            break;
                        case 'WALL-OUTER':
                            uniforms.u_r_wall_outer_visible.value = value;
                            break;
                        case 'SKIN':
                            uniforms.u_r_skin_visible.value = value;
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
                });
            }
        }
        dispatch(actions.render());
    },

    updateGcodePreviewMode: (mode) => (dispatch, getState) => {
        const { gcodeLine, layerRangeDisplayed, layerCount } = getState().printing;
        // gcodeParser.setColortypes(mode === GCODEPREVIEWMODES[2]);
        if (gcodeLine) {
            // const uniforms = gcodeLine.material.uniforms;
            gcodeLine.children.forEach(mesh => {
                const uniforms = mesh.material.uniforms;
                if (mode === GCODEPREVIEWMODES[2]) {
                    uniforms.u_middle_layer_set_gray.value = 1;
                } else {
                    uniforms.u_middle_layer_set_gray.value = 0;
                }
            });
        }

        dispatch(
            actions.updateState({
                gcodePreviewModeToogleVisible: 0,
                gcodePreviewMode: mode
            })
        );

        if (mode === GCODEPREVIEWMODES[1]) {
            dispatch(
                actions.showGcodeLayers([
                    layerRangeDisplayed[1],
                    layerRangeDisplayed[1]
                ])
            );
        } else if (
            mode === GCODEPREVIEWMODES[0]
            || mode === GCODEPREVIEWMODES[2]
        ) {
            if (layerRangeDisplayed[0] === layerRangeDisplayed[1]) {
                dispatch(actions.showGcodeLayers([0, layerCount - 1]));
            } else {
                dispatch(actions.render());
            }
        }
    },

    setGcodeColorByRenderLineType: () => (dispatch, getState) => {
        const { gcodeLine, renderLineType } = getState().printing;
        // if (renderLineType) {
        //     gcodeParser.extruderColors = {
        //         toolColor0: extruderLDefinition?.settings?.color?.default_value || WHITE_COLOR,
        //         toolColor1: extruderRDefinition?.settings?.color?.default_value || BLACK_COLOR
        //     };
        // }
        // gcodeParser.setColortypes(undefined, renderLineType);
        // console.log(gcodeLine, renderLineType);
        if (gcodeLine) {
            // const uniforms = gcodeLine.material.uniforms;
            gcodeLine.children.forEach(mesh => {
                const uniforms = mesh.material.uniforms;
                uniforms.u_color_type.value = renderLineType ? 1 : 0;
            });
        }
        dispatch(actions.render());
    },

    renderShowGcodeLines: () => (dispatch, getState) => {
        const {
            gcodeParser,
            gcodeLineObjects,
            gcodeTypeInitialVisibility
        } = getState().printing;
        const { startLayer, endLayer } = gcodeParser;
        gcodeLineObjects.forEach((mesh, i) => {
            if (
                i < (startLayer ?? 0)
                || i > (endLayer ?? 0)
                || !getGcodeRenderValue(gcodeTypeInitialVisibility, i)
            ) {
                mesh.visible = false;
            } else {
                mesh.visible = true;
            }
        });
    },

    showGcodeLayers: range => (dispatch, getState) => {
        const {
            layerCount,
            // gcodeLineObjects,
            gcodeLine,
            gcodePreviewMode,
            layerRangeDisplayed
            // gcodeParser
        } = getState().printing;

        if (!gcodeLine) {
            return;
        }
        if (range[1] >= layerCount) {
            dispatch(actions.displayModel());
        } else {
            dispatch(actions.displayGcode());
        }
        let isUp = false;
        if (gcodePreviewMode === GCODEPREVIEWMODES[1]) {
            // The moving direction is down
            if (range[0] - layerRangeDisplayed[0] > EPSILON) {
                range = [range[0] || 0, range[0] || 0];
                isUp = true;
            } else if (range[1] - layerRangeDisplayed[1] > EPSILON) {
                range = [Math.min(layerCount, range[1]), Math.min(layerCount, range[1])];
                isUp = true;
            } else if (layerRangeDisplayed[0] - range[0] > EPSILON) {
                range = [range[0] || 0, range[0] || 0];
            } else {
                range = [Math.max(Math.min(layerCount, range[1]), 0), Math.max(Math.min(layerCount, range[1]), 0)];
            }
        } else {
            let isRelated = false;
            if (
                Math.abs(layerRangeDisplayed[0] - layerRangeDisplayed[1]) === 0
            ) {
                isRelated = true;
            }
            if (
                isLarger(range[0], layerRangeDisplayed[0])
                || isLarger(range[1], layerRangeDisplayed[1])
            ) {
                if (isRelated && isLarger(range[0], layerRangeDisplayed[0])) {
                    range[1] = range[0];
                }
                if (
                    isLarger(range[0], layerRangeDisplayed[0])
                    && isLarger(range[0], range[1])
                ) {
                    const tmp = range[1];
                    range[1] = range[0];
                    range[0] = tmp;
                }
                isUp = true;
                range[1] = Math.min(layerCount, range[1]);
                range[0] = Math.min(layerCount, range[0]);
            }
            if (
                isLarger(layerRangeDisplayed[0], range[0])
                || isLarger(layerRangeDisplayed[1], range[1])
            ) {
                if (isRelated && isLarger(layerRangeDisplayed[1], range[1])) {
                    range[0] = range[1];
                }
                // TODO: ?
                if (range[1] < layerRangeDisplayed[0] && range[0] > range[1]) {
                    const tmp = range[1];
                    range[1] = range[0];
                    range[0] = tmp;
                }
                range[1] = range[1] < 0 ? 0 : range[1];
                range[0] = range[0] < 0 ? 0 : range[0];
            }
        }
        const prevRange = [...range];
        range[0] = range[0] < 0 ? 0 : Math.round(range[0]);
        range[1] = range[1] < 0 ? 0 : Math.round(range[1]);
        range[0] = range[0] > layerCount - 1 ? layerCount - 1 : range[0];
        range[1] = range[1] > layerCount - 1 ? layerCount - 1 : range[1];
        // gcodeParser.startLayer = range[0];
        // gcodeParser.endLayer = range[1];
        // dispatch(actions.renderShowGcodeLines());
        if (gcodeLine) {
            gcodeLine.children.forEach(mesh => {
                mesh.material.uniforms.u_visible_layer_range_start.value = range[0] || -100;
                mesh.material.uniforms.u_visible_layer_range_end.value = range[1];
            });
        }
        if (isUp && (range[0] - prevRange[0]) > 0 && (range[0] - prevRange[0]) < 1
            && (range[1] - prevRange[1]) > 0 && (range[1] - prevRange[1]) < 1) {
            range[0] = prevRange[0];
            range[1] = prevRange[1];
        }
        if (
            !isUp
            && range[0] - prevRange[0] > 0
            && prevRange[0] - range[0] < 1
            && range[1] - prevRange[1] > 0
            && prevRange[1] - range[1] < 1
        ) {
            range[0] = prevRange[0];
            range[1] = prevRange[1];
        }
        dispatch(
            actions.updateState({
                layerRangeDisplayed: range
            })
        );
        dispatch(actions.render());
    },

    // make an offset of gcode layer count
    // offset can be negative
    offsetGcodeLayers: offset => (dispatch, getState) => {
        const { layerRangeDisplayed } = getState().printing;
        dispatch(
            actions.showGcodeLayers([
                layerRangeDisplayed[0] + offset,
                layerRangeDisplayed[1] + offset
            ])
        );
    },

    checkGcodeBoundary: (minX, minY, minZ, maxX, maxY, maxZ) => (
        dispatch,
        getState
    ) => {
        const { size } = getState().machine;
        // TODO: provide a precise margin (use EPSILON?)
        const margin = 1;
        const widthOverstepped = minX < -margin || maxX > size.x + margin;
        const depthOverstepped = minY < -margin || maxY > size.y + margin;
        const heightOverstepped = minZ < -margin || maxZ > size.z + margin;
        const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
        dispatch(
            actions.updateState({
                isGcodeOverstepped: overstepped
            })
        );
    },

    exitPreview: () => (dispatch, getState) => {
        const { displayedType } = getState().printing;
        if (displayedType !== 'model') {
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        }
    },

    displayModel: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        modelGroup.object.visible = true;
        modelGroup.setDisplayType('model');
        gcodeLineGroup.visible = false;
        dispatch(
            actions.updateState({
                displayedType: 'model'
            })
        );
        dispatch(actions.render());
    },

    updateSelectedModelTransformation: (
        transformation,
        newUniformScalingState,
        isAllRotate
    ) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        let transformMode;
        switch (true) {
            // TODO: transformMode update to Array
            case ['scaleX', 'scaleY', 'scaleZ'].some(
                (item) => item in transformation
            ):
                transformMode = 'scale';
                break;
            case ['positionX', 'positionY'].some(
                (item) => item in transformation
            ):
                transformMode = 'translate';
                break;
            case ['rotationX', 'rotationY', 'rotationZ'].some(
                (item) => item in transformation
            ):
                transformMode = 'rotate';
                break;
            default:
                break;
        }
        dispatch(actions.recordModelBeforeTransform(modelGroup));
        modelGroup.updateSelectedGroupTransformation(
            transformation,
            newUniformScalingState,
            isAllRotate
        );
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
        const modelState = modelGroup.selectModelById(
            model.modelID,
            isMultiSelect
        );

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

    hideSelectedModel: targetModel => (dispatch, getState) => {
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

        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    showSelectedModel: targetModel => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const modelState = modelGroup.showSelectedModel([targetModel]);

        const operation = new VisibleOperation3D({
            target: targetModel,
            visible: true
        });
        const operations = new Operations();
        operations.push(operation);
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });

        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
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
            const operation = new DeleteOperation3D({
                target: model
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            const modelState = modelGroup.getState();
            if (!modelState.hasModel) {
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.EMPTY,
                        progress: 0
                    })
                );
            }
            dispatch(actions.updateState(modelState));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });
        recovery();
        const modelState = modelGroup.removeSelectedModel();
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );

        if (!modelState.hasModel) {
            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.EMPTY,
                    progress: 0
                })
            );
        }
        // updateState need before displayModel
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    removeAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const operations = new Operations();
        for (const model of modelGroup.models) {
            const operation = new DeleteOperation3D({
                target: model,
                parent: null
            });
            operations.push(operation);
        }
        operations.registCallbackAfterAll(() => {
            const modelState = modelGroup.getState();
            if (!modelState.hasModel) {
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.EMPTY,
                        progress: 0
                    })
                );
            }
            dispatch(actions.updateState(modelState));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.render());
        });
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );

        const modelState = modelGroup.removeAllModels();

        dispatch(
            actions.updateState({
                stage: STEP_STAGE.EMPTY,
                progress: 0
            })
        );
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.render());
    },

    updateSelectedModelsExtruder: extruderConfig => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const models = Object.assign([], getState().printing.modelGroup.models);
        for (const model of modelGroup.selectedModelArray) {
            let modelItem = null;
            modelGroup.traverseModels(models, item => {
                if (model.modelID === item.modelID) {
                    modelItem = item;
                }
            });
            if (modelItem) {
                modelItem.extruderConfig = {
                    ...extruderConfig
                };
                modelItem.children
                    && modelItem.children.length
                    && modelItem.children.forEach((item) => {
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
                if (
                    modelItem.parent
                    && modelItem.parent instanceof ThreeGroup
                ) {
                    modelItem.parent.updateGroupExtruder();
                }
            }
        }
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.updateBoundingBox());
        modelGroup.models = [...models];
        // dispatch(actions.updateState({
        //     modelGroup
        // }));
    },

    updateHelpersExtruder: (extruderConfig) => (dispatch) => {
        dispatch(
            actions.updateState({ helpersExtruderConfig: extruderConfig })
        );
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateBoundingBox());
    },
    arrangeAllModels: (angle = 45, offset = 1, padding = 0) => (
        dispatch,
        getState
    ) => {
        const operations = new Operations();
        let operation;
        const froms = {};

        dispatch(actions.unselectAllModels());
        const { modelGroup, progressStatesManager } = getState().printing;
        const { size } = getState().machine;

        progressStatesManager.startProgress(
            PROCESS_STAGE.PRINTING_ARRANGE_MODELS
        );
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                progress: progressStatesManager.updateProgress(
                    STEP_STAGE.PRINTING_ARRANGING_MODELS,
                    0.01
                )
            })
        );

        const models = [];
        modelGroup.getModels().forEach(model => {
            if (model instanceof PrimeTowerModel) {
                return;
            }
            const modelInfo = {
                modelID: model.modelID,
                isGroup: model instanceof ThreeGroup
            };
            if (modelInfo.isGroup) {
                const children = [];
                model.children.forEach(child => {
                    children.push({
                        count: child.geometry.getAttribute('position').count,
                        array: Transfer(child.geometry.getAttribute('position').array),
                        matrix: child.meshObject.matrix
                    });
                });
                modelInfo.children = children;
                modelInfo.center = {
                    x: model.transformation.positionX,
                    y: model.transformation.positionY
                };
            } else {
                modelInfo.children = [
                    {
                        count: model.geometry.getAttribute('position').count,
                        array: Transfer(model.geometry.getAttribute('position').array),
                        matrix: model.meshObject.matrix
                    }
                ];
                modelInfo.center = {
                    x: model.transformation.positionX,
                    y: model.transformation.positionY
                };
            }
            models.push(modelInfo);
        });

        const res = workerManager.arrangeModels(
            {
                models,
                validArea: modelGroup.getValidArea(),
                angle,
                offset: offset / 2,
                padding,
                memory: performance.memory.jsHeapSizeLimit
            },
            payload => {
                const { status, value } = payload;
                switch (status) {
                    case 'succeed': {
                        const { parts } = value;
                        let allArranged = true;

                        parts.forEach(part => {
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

                        parts.forEach(part => {
                            const model = modelGroup.getModel(part.modelID);
                            if (part.angle === undefined || part.position === undefined) {
                                allArranged = false;
                                model.updateTransformation({
                                    positionX: 0,
                                    positionY: 0
                                });
                            }
                        });
                        parts.forEach(part => {
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
                        modelGroup.getModels().forEach(model => {
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

                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ARRANGING_MODELS, 1)
                            })
                        );
                        progressStatesManager.finishProgress(true);
                        if (!allArranged) {
                            dispatch(
                                appGlobalActions.updateShowArrangeModelsError({
                                    showArrangeModelsError: true
                                })
                            );
                        }
                        res.then(websocket => websocket.terminate());
                        break;
                    }
                    case 'progress': {
                        const { progress } = value;
                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                progress: progressStatesManager.updateProgress(
                                    STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                    progress
                                )
                            })
                        );
                        break;
                    }
                    case 'err': {
                        // TODO: STOP AND MODAL
                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                progress: progressStatesManager.updateProgress(
                                    STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                    1
                                )
                            })
                        );
                        progressStatesManager.finishProgress(false);
                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                progress: progressStatesManager.updateProgress(
                                    STEP_STAGE.PRINTING_ARRANGING_MODELS,
                                    1
                                )
                            })
                        );
                        dispatch(
                            appGlobalActions.updateShowArrangeModelsError({
                                showArrangeModelsError: true
                            })
                        );
                        res.then(websocket => websocket.terminate());
                        break;
                    }
                    default:
                        break;
                }
            }
        );
    },

    recordModelBeforeTransform: modelGroup => dispatch => {
        dispatch(operationHistoryActions.clearTargetTmpState(INITIAL_STATE.name));
        const selectedModelArray = modelGroup.selectedModelArray.concat();
        modelGroup.onModelBeforeTransform();
        const { recovery } = modelGroup.unselectAllModels();
        for (const model of selectedModelArray) {
            modelGroup.unselectAllModels();
            modelGroup.addModelToSelectedGroup(model);
            if (model.supportTag) {
                dispatch(actions.onModelTransform());
            }
            dispatch(
                operationHistoryActions.updateTargetTmpState(INITIAL_STATE.name, model.modelID, {
                    from: {
                        ...modelGroup.getSelectedModelTransformationForPrinting()
                    }
                })
            );
        }
        recovery();
    },

    recordModelAfterTransform: (
        transformMode,
        modelGroup,
        combinedOperations,
        axis
    ) => (dispatch, getState) => {
        if (axis) {
            logTransformOperation(HEAD_PRINTING, transformMode, axis);
        }
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
            dispatch(
                operationHistoryActions.updateTargetTmpState(INITIAL_STATE.name, model.modelID, {
                    to: {
                        ...modelGroup.getSelectedModelTransformationForPrinting()
                    }
                })
            );
            if (stateEqual(model, targetTmpState[model.modelID].from, targetTmpState[model.modelID].to)) {
                continue;
            }
            // model in group translate on Z-axis should clear supports in its group
            if (
                transformMode === 'translate'
                && model.isModelInGroup()
                && Math.abs(targetTmpState[model.modelID].from.positionZ - targetTmpState[model.modelID].to.positionZ) > EPSILON
            ) {
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
                default:
                    break;
            }
            operations.push(operation);
        }

        if (transformMode === 'scale') {
            const isMirror = modelGroup.selectedModelArray.some((model) => {
                const x = targetTmpState[model.modelID].from.scaleX
                    * targetTmpState[model.modelID].to.scaleX;
                const y = targetTmpState[model.modelID].from.scaleY
                    * targetTmpState[model.modelID].to.scaleY;
                const z = targetTmpState[model.modelID].from.scaleZ
                    * targetTmpState[model.modelID].to.scaleZ;
                return (
                    x / Math.abs(x) === -1
                    || y / Math.abs(y) === -1
                    || z / Math.abs(z) === -1
                );
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
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
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
        const operations = new Operations();
        for (const model of modelGroup.selectedModelArray) {
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
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );

        dispatch(actions.updateState(modelState));
        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    cut: () => dispatch => {
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
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );

        dispatch(actions.updateState(modelState));
        dispatch(actions.applyProfileToAllModels());
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
        if (modelGroup.isSelectedModelAllVisible()) {
            selected = modelGroup.getSelectedModelArray();
        } else {
            selected = modelGroup.getVisibleModels();
        }
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 0.01)
            })
        );
        setTimeout(() => {
            if (selected.length === 1) {
                dispatch(
                    actions.updateState({
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 0.25)
                    })
                );
            }
            const selectedModelInfo = [],
                positionAttribute = [],
                normalAttribute = [];
            const revertParentArr = [];
            selected.forEach(modelItem => {
                let geometry = null;
                if (modelItem instanceof ThreeGroup) {
                    modelItem.computeConvex();
                    geometry = modelItem.mergedGeometry;
                } else {
                    geometry = modelItem.meshObject.geometry;
                }
                const revertParent = ThreeUtils.removeObjectParent(
                    modelItem.meshObject
                );
                revertParentArr.push(revertParent);
                modelItem.meshObject.updateMatrixWorld();
                geometry.computeBoundingBox();
                const inverseNormal = modelItem.transformation.scaleX / Math.abs(modelItem.transformation.scaleX) < 0;

                const modelItemInfo = {
                    matrixWorld: modelItem.meshObject.matrixWorld,
                    convexGeometry: modelItem.convexGeometry,
                    inverseNormal
                };
                selectedModelInfo.push(modelItemInfo);
                positionAttribute.push(geometry.getAttribute('position'));
                normalAttribute.push(geometry.getAttribute('normal'));
            });
            workerManager.autoRotateModels(
                {
                    selectedModelInfo,
                    positionAttribute: Transfer(positionAttribute),
                    normalAttribute: Transfer(normalAttribute)
                },
                payload => {
                    const { status, value } = payload;
                    switch (status) {
                        case 'PARTIAL_SUCCESS': {
                            const { progress, targetPlane, xyPlaneNormal, index, isFinish, isUpdateProgress } = value;
                            if (isUpdateProgress) {
                                dispatch(
                                    actions.updateState({
                                        progress
                                    })
                                );
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
                            dispatch(
                                actions.updateState({
                                    stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, progress)
                                })
                            );
                            if (isFinish) {
                                const modelState = modelGroup.getState();
                                modelGroup.onModelAfterTransform();
                                dispatch(actions.recordModelAfterTransform('rotate', modelGroup, operations));
                                dispatch(actions.updateState(modelState));
                                dispatch(actions.destroyGcodeLine());
                                dispatch(actions.displayModel());
                                dispatch(
                                    actions.updateState({
                                        stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 1)
                                    })
                                );
                            }
                            break;
                        }
                        case 'PROGRESS': {
                            const { progress } = value;
                            dispatch(
                                actions.updateState({
                                    stage: STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS,
                                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, progress)
                                })
                            );
                            break;
                        }
                        case 'ERROR': {
                            dispatch(
                                actions.updateState({
                                    stage: STEP_STAGE.PRINTING_AUTO_ROTATE_FAILED,
                                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_AUTO_ROTATING_MODELS, 1)
                                })
                            );
                            break;
                        }
                        default:
                            break;
                    }
                }
            );
        }, 200);
    },

    scaleToFitSelectedModel: models => (dispatch, getState) => {
        const {
            modelGroup,
            stopArea: { left, right, front, back }
        } = getState().printing;
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
                return modelGroup.scaleToFitFromModel(
                    size,
                    offsetX,
                    offsetY,
                    models
                );
            } else {
                return modelGroup.scaleToFitSelectedModel(
                    size,
                    offsetX,
                    offsetY
                );
            }
        })();
        modelGroup.onModelAfterTransform();

        dispatch(actions.recordModelAfterTransform('scale', modelGroup));
        dispatch(actions.updateState(modelState));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    scaleToFitSelectedModelWithRotate: () => (dispatch, getState) => {
        dispatch(actions.exitPreview());
        const {
            progressStatesManager,
            modelGroup,
            stopArea: { left, right, front, back }
        } = getState().printing;
        const { size } = getState().machine;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE);
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, 0.15)
            })
        );
        setTimeout(() => {
            const positionAttribute = [];
            const normalAttribute = [];
            const matrixWorlds = [];
            modelGroup.selectedModelArray.forEach(modelItem => {
                if (modelItem instanceof ThreeGroup) {
                    modelItem.children.forEach(child => {
                        const childGeometry = child.meshObject.geometry;
                        positionAttribute.push(childGeometry.getAttribute('position'));
                        normalAttribute.push(childGeometry.getAttribute('normal'));
                        matrixWorlds.push(child.meshObject.matrixWorld);
                    });
                } else {
                    const childGeometry = modelItem.meshObject.geometry;
                    positionAttribute.push(childGeometry.getAttribute('position'));
                    normalAttribute.push(childGeometry.getAttribute('normal'));
                    matrixWorlds.push(modelItem.meshObject.matrixWorld);
                }
            });
            dispatch(actions.recordModelBeforeTransform(modelGroup));

            const data = {
                size,
                positionAttribute: Transfer(positionAttribute),
                normalAttribute: Transfer(normalAttribute),
                matrixWorlds: Transfer(matrixWorlds),
                left,
                right,
                front,
                back,
                selectedGroupMatrix: modelGroup.selectedGroup.matrix.clone(),
                selectedCount: modelGroup.selectedModelArray.length
            };
            workerManager.scaleToFitWithRotate(data, payload => {
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
                        modelGroup.selectedGroup.quaternion
                            .copy(quaternion)
                            .multiply(originQuaternion)
                            .normalize();
                        modelGroup.updateSelectedGroupTransformation(newTransformation, undefined, true);
                        const { targetTmpState } = getState().printing;
                        modelGroup.selectedModelArray.forEach(modelItem => {
                            operation = new ScaleToFitWithRotateOperation3D({
                                target: modelItem,
                                ...targetTmpState[modelItem.modelID],
                                to: {
                                    ...modelGroup.getSelectedModelTransformationForPrinting()
                                }
                            });
                            operations.push(operation);
                        });
                        const center = new THREE.Vector3();
                        ThreeUtils.computeBoundingBox(modelGroup.selectedGroup).getCenter(center);
                        const oldPosition = modelGroup.selectedGroup.position;
                        modelGroup.updateSelectedGroupTransformation({
                            positionX: offsetX + (oldPosition.x - center.x),
                            positionY: oldPosition.y - center.y
                        });
                        modelGroup.onModelAfterTransform();
                        modelGroup.selectedModelArray.forEach(modelItem => {
                            operation = new ScaleToFitWithRotateOperation3D({
                                target: modelItem,
                                ...targetTmpState[modelItem.modelID],
                                to: {
                                    ...modelGroup.getSelectedModelTransformationForPrinting()
                                }
                            });
                            operations.push(operation);
                        });
                        // dispatch(actions.recordModelAfterTransform('scale', modelGroup, operations));
                        const modelState = modelGroup.getState();
                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE,
                                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, 1)
                            })
                        );
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
                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE,
                                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, progress)
                            })
                        );
                        break;
                    }
                    case 'ERR': {
                        dispatch(
                            actions.updateState({
                                stage: STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE_FAILED,
                                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SCALE_TO_FIT_WITH_ROTATE, 1)
                            })
                        );
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
        const { history, displayedType } = getState().printing;
        const { canUndo } = history;
        if (displayedType !== 'model') {
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        }
        if (canUndo) {
            logToolBarOperation(HEAD_PRINTING, 'undo');
            dispatch(operationHistoryActions.undo(INITIAL_STATE.name));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
            dispatch(actions.render());
        }
    },

    redo: () => (dispatch, getState) => {
        dispatch(actions.exitPreview());
        const { canRedo } = getState().printing.history;
        if (canRedo) {
            logToolBarOperation(HEAD_PRINTING, 'redo');
            dispatch(operationHistoryActions.redo(INITIAL_STATE.name));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
            dispatch(actions.render());
        }
    },

    displayGcode: () => (dispatch, getState) => {
        const { gcodeLineGroup, modelGroup } = getState().printing;
        modelGroup.setDisplayType('gcode');
        gcodeLineGroup.visible = true;
        dispatch(
            actions.updateState({
                displayedType: 'gcode'
            })
        );
        dispatch(actions.render());
    },

    loadGcode: gcodeFilename => (dispatch, getState) => {
        const { progressStatesManager, extruderLDefinition, extruderRDefinition } = getState().printing;
        progressStatesManager.startNextStep();
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_PREVIEWING,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SLICING, 0)
            })
        );
        const extruderColors = {
            toolColor0:
                extruderLDefinition?.settings?.color?.default_value
                || WHITE_COLOR,
            toolColor1:
                extruderRDefinition?.settings?.color?.default_value
                || BLACK_COLOR
        };
        workerManager.gcodeToBufferGeometry({ func: '3DP', gcodeFilename, extruderColors }, data => {
            dispatch(actions.gcodeRenderingCallback(data, extruderColors));
        });
    },
    clearAllManualSupport: combinedOperations => (dispatch, getState) => {
        dispatch(actions.exitPreview());

        const { modelGroup } = getState().printing;

        // Give priority to the selected supporting models, Second, apply all models
        const selectedAvailModels = modelGroup.getModelsAttachedSupport(false);
        const availModels = selectedAvailModels.length > 0
            ? selectedAvailModels
            : modelGroup.getModelsAttachedSupport();

        if (availModels.length > 0) {
            let operations = new Operations();
            if (combinedOperations) {
                operations = combinedOperations;
            }
            for (const model of availModels) {
                const operation = new DeleteSupportsOperation3D({
                    target: model,
                    support: model.meshObject.children[0],
                    faceMarks: model.supportFaceMarks.slice(0)
                });
                operations.push(operation);
            }
            if (!combinedOperations) {
                dispatch(
                    operationHistoryActions.setOperations(
                        INITIAL_STATE.name,
                        operations
                    )
                );
            }

            modelGroup.clearAllSupport(availModels);
        }
    },
    setDefaultSupportSize: size => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.defaultSupportSize = size;
    },
    generateModel: (
        headType,
        {
            loadFrom = LOAD_MODEL_FROM_INNER,
            files,
            originalName,
            uploadName,
            sourceWidth,
            sourceHeight,
            mode,
            sourceType,
            transformation,
            modelID,
            extruderConfig,
            isGroup = false,
            parentModelID = '',
            isMfRecovery,
            modelName,
            children,
            primeTowerTag
        }
    ) => async (dispatch, getState) => {
        const { progressStatesManager, modelGroup } = getState().printing;
        const { size } = getState().machine;
        const models = [...modelGroup.models];
        const modelNames = files || [{ originalName, uploadName }];
        let _progress = 0;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);
        const promptTasks = [];
        const promises = modelNames.map((model) => {
            return new Promise(async (resolve, reject) => {
                const {
                    toolHead: { printingToolhead }
                } = getState().machine;
                _progress = modelNames.length === 1 ? 0.25 : 0.001;
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                    })
                );
                if (!model.uploadName) {
                    resolve();
                }
                const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;

                if (isGroup && !isMfRecovery) {
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
                } else if (
                    primeTowerTag
                    && printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2
                ) {
                    const initHeight = transformation?.scaleZ || 0.1;
                    const primeTowerModel = modelGroup.primeTower;
                    primeTowerModel.updateHeight(initHeight, transformation);
                    resolve();
                } else {
                    const onMessage = async data => {
                        const { type } = data;
                        switch (type) {
                            case 'LOAD_MODEL_POSITIONS': {
                                const { positions, originalPosition } = data;

                                const bufferGeometry = new THREE.BufferGeometry();
                                const modelPositionAttribute = new THREE.BufferAttribute(positions, 3);
                                const material = new THREE.MeshPhongMaterial({
                                    side: THREE.DoubleSide,
                                    color: 0xa0a0a0,
                                    specular: 0xb0b0b0,
                                    shininess: 0
                                });

                                bufferGeometry.setAttribute(
                                    'position',
                                    modelPositionAttribute
                                );

                                bufferGeometry.computeVertexNormals();
                                // Create model
                                // modelGroup.generateModel(modelInfo);

                                const modelState = await modelGroup.generateModel(
                                    {
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
                                    }
                                );
                                dispatch(actions.updateState(modelState));
                                dispatch(actions.applyProfileToAllModels());
                                dispatch(actions.displayModel());
                                dispatch(actions.destroyGcodeLine());
                                if (modelNames.length > 1) {
                                    _progress += 1 / modelNames.length;
                                    dispatch(
                                        actions.updateState({
                                            stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                                        })
                                    );
                                }
                                resolve();
                                break;
                            }
                            case 'LOAD_MODEL_CONVEX': {
                                const { positions } = data;

                                const convexGeometry = new THREE.BufferGeometry();
                                const positionAttribute = new THREE.BufferAttribute(
                                    positions,
                                    3
                                );
                                convexGeometry.setAttribute(
                                    'position',
                                    positionAttribute
                                );

                                // const model = modelGroup.children.find(m => m.uploadName === uploadName);
                                modelGroup.setConvexGeometry(
                                    model.uploadName,
                                    convexGeometry
                                );

                                break;
                            }
                            case 'LOAD_MODEL_PROGRESS': {
                                if (modelNames.length === 1) {
                                    const state = getState().printing;
                                    const progress = 0.25 + data.progress * 0.5;
                                    if (progress - state.progress > 0.01 || progress > 0.75 - EPSILON) {
                                        dispatch(
                                            actions.updateState({
                                                stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                                                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, progress)
                                            })
                                        );
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
                                    dispatch(
                                        actions.updateState({
                                            stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                                        })
                                    );
                                }
                                reject();
                                break;
                            }
                            case 'LOAD_GROUP_POSITIONS': {
                                const { positionsArr, originalPosition } = data;
                                modelGroup.addGroup({
                                    loadFrom: LOAD_MODEL_FROM_OUTER,
                                    limitSize: size,
                                    headType,
                                    sourceType,
                                    positionsArr,
                                    originalName: model.originalName,
                                    uploadName: model.uploadName,
                                    modelName: null,
                                    children,
                                    originalPosition,
                                    transformation
                                }, isMfRecovery);


                                const modelState = modelGroup.getState();
                                dispatch(actions.updateState(modelState));
                                dispatch(actions.applyProfileToAllModels());
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
                            default:
                                break;
                        }
                    };
                    createLoadModelWorker(uploadPath, onMessage);
                }
            });
        });

        await Promise.allSettled(promises);

        const newModels = modelGroup.models.filter(model => {
            return !models.includes(model);
        });
        modelGroup.traverseModels(newModels, (model) => {
            if (model instanceof ThreeModel) {
                model.initClipper(modelGroup.localPlane);
            }
            const modelSize = new Vector3();
            model.boundingBox.getSize(modelSize);
            const isLarge = ['x', 'y', 'z'].some(key => modelSize[key] >= size[key]);

            if (isLarge) {
                promptTasks.push({
                    status: 'needScaletoFit',
                    model
                });
            }
        });
        dispatch(actions.applyProfileToAllModels());
        if (modelNames.length === 1 && newModels.length === 0) {
            progressStatesManager.finishProgress(false);
            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                    progress: 0,
                    promptTasks
                })
            );
        } else {
            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1),
                    promptTasks
                })
            );
        }
    },
    recordAddOperation: model => (dispatch, getState) => {
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
                    dispatch(
                        actions.updateState({
                            stage: STEP_STAGE.EMPTY,
                            progress: 0
                        })
                    );
                }
                dispatch(actions.updateState(modelState));
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.render());
            });
            dispatch(
                operationHistoryActions.setOperations(
                    INITIAL_STATE.name,
                    operations
                )
            );
        }
    },

    startAnalyzeRotationProgress: () => (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_ROTATE_ANALYZE);
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_ROTATE_ANALYZE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ROTATE_ANALYZE, 0.25)
            })
        );
    },

    startAnalyzeRotation: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const operations = new Operations();
        dispatch(actions.clearAllManualSupport(operations));
        // record current rotation for undo & redo
        dispatch(actions.recordModelBeforeTransform(modelGroup));
        // keep the operation for `finishAnalyzeRotation` action
        dispatch(
            actions.updateState({
                combinedOperations: operations
            })
        );
    },

    finishAnalyzeRotation: () => (dispatch, getState) => {
        const { modelGroup, combinedOperations } = getState().printing;
        dispatch(actions.clearRotationAnalysisTableData());
        // record the last rotation to undo & redo
        dispatch(
            actions.recordModelAfterTransform(
                'rotate',
                modelGroup,
                combinedOperations
            )
        );
        dispatch(actions.setTransformMode('rotate'));
        dispatch(
            actions.updateState({
                combinedOperations: []
            })
        );
    },

    rotateByPlane: targetPlane => (dispatch, getState) => {
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
            modelGroup
                .analyzeSelectedModelRotationAsync()
                .then(tableResult => {
                    if (tableResult) {
                        dispatch(
                            actions.updateState({
                                rotationAnalysisTable: tableResult
                            })
                        );
                    }
                    dispatch(actions.setTransformMode('rotate-placement'));
                    dispatch(
                        actions.updateState({
                            stage: STEP_STAGE.PRINTING_ROTATE_ANALYZE,
                            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_ROTATE_ANALYZE, 1)
                        })
                    );
                    dispatch(actions.destroyGcodeLine());
                    dispatch(actions.displayModel());
                })
                .catch(() => { });
        }
    },

    clearRotationAnalysisTableData: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.resetSelectedModelConvexMeshGroup();
        dispatch(
            actions.updateState({
                rotationAnalysisTable: []
            })
        );
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    setRotationPlacementFace: userData => dispatch => {
        dispatch(
            actions.updateState({
                rotationAnalysisSelectedRowId: userData.index
            })
        );
    },

    setShortcutStatus: (enabled) => (dispatch) => {
        dispatch(
            actions.updateState({
                enableShortcut: enabled
            })
        );
    },

    setLeftBarOverlayVisible: (visible) => (dispatch) => {
        dispatch(
            actions.updateState({
                leftBarOverlayVisible: visible
            })
        );
    },
    groupAndAlign: () => (dispatch, getState) => {
        dispatch(actions.exitPreview());

        const { modelGroup } = getState().printing;

        const modelsbeforeGroup = modelGroup.getModels().slice(0);
        const selectedModels = modelGroup.getSelectedModelArray().slice(0);
        const selectedModelsPositionMap = new Map();
        selectedModels.forEach((model) => {
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

        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
        modelGroup.calaClippingMap();
        dispatch(actions.updateState(modelState));
        logToolBarOperation(HEAD_PRINTING, 'align');
    },

    group: () => (dispatch, getState) => {
        dispatch(actions.exitPreview());

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
                children:
                    selectd instanceof ThreeGroup
                        ? selectd.children.slice(0)
                        : null,
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

        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
        dispatch(actions.updateState(modelState));
        logToolBarOperation(HEAD_PRINTING, 'group');
    },

    ungroup: () => (dispatch, getState) => {
        dispatch(actions.exitPreview());

        const { modelGroup } = getState().printing;

        const groups = modelGroup
            .getSelectedModelArray()
            .filter((model) => model instanceof ThreeGroup);
        const modelsBeforeUngroup = modelGroup.getModels().slice(0);
        const groupChildrenMap = new Map();
        groups.forEach((group) => {
            groupChildrenMap.set(group, {
                groupTransformation: { ...group.transformation },
                subModelStates: group.children.map((model) => {
                    return {
                        target: model,
                        transformation: { ...model.transformation }
                    };
                })
            });
        });
        const operations = new Operations();

        const modelState = modelGroup.ungroup();

        groups.forEach((group) => {
            const operation = new UngroupOperation3D({
                modelsBeforeUngroup,
                target: group,
                groupTransformation: groupChildrenMap.get(group)
                    .groupTransformation,
                subModelStates: groupChildrenMap.get(group).subModelStates,
                modelGroup
            });
            operations.push(operation);
        });
        operations.registCallbackAfterAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });

        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
        dispatch(actions.updateState(modelState));
        logToolBarOperation(HEAD_PRINTING, 'ungroup');
    },

    getModelMaterialSettings: (model) => (dispatch, getState) => {
        const {
            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight
        } = getState().printing;
        const materialID = model.extruderConfig.shell === '0' ? defaultMaterialId : defaultMaterialIdRight;
        const index = materialDefinitions.findIndex((d) => {
            return d.definitionId === materialID;
        });
        return materialDefinitions[index] ? materialDefinitions[index].settings : materialDefinitions[0].settings;
    },

    applyProfileToAllModels: () => (dispatch, getState) => {
        const { qualityDefinitions, defaultQualityId, modelGroup } = getState().printing;
        const activeQualityDefinition = lodashFind(qualityDefinitions, {
            definitionId: defaultQualityId
        });
        if (!activeQualityDefinition) {
            return;
        }
        const qualitySetting = activeQualityDefinition.settings;
        modelGroup.updatePlateAdhesion({
            adhesionType: qualitySetting.adhesion_type.default_value,
            skirtLineCount: qualitySetting?.skirt_line_count?.default_value,
            brimLineCount: qualitySetting?.brim_line_count?.default_value,
            brimWidth: qualitySetting?.brim_width?.default_value,
            skirtBrimLineWidth: qualitySetting?.skirt_brim_line_width?.default_value,
            raftMargin: qualitySetting?.raft_margin?.default_value,
            skirtGap: qualitySetting?.skirt_gap?.default_value,
            brimGap: qualitySetting?.brim_gap?.default_value
        });
        const models = modelGroup.getModels();
        modelGroup.getThreeModels().filter((model) => {
            return model.clipper;
        }).forEach((model) => {
            const materialSettings = dispatch(actions.getModelMaterialSettings(model));
            model.updateMaterialColor(materialSettings.color.default_value);

            const layerHeight = qualitySetting.layer_height.default_value;
            const bottomThickness = qualitySetting.bottom_thickness.default_value;
            const bottomLayers = Math.ceil(Math.round(bottomThickness / layerHeight));
            const topThickness = qualitySetting.top_thickness.default_value;
            const topLayers = Math.ceil(Math.round(topThickness / layerHeight));
            model.clipper.updateClipperConfig({
                lineWidth: materialSettings.machine_nozzle_size.default_value,
                wallThickness: qualitySetting.wall_thickness.default_value,
                topLayers,
                bottomLayers,
                layerHeight,
                infillSparseDensity: qualitySetting.infill_sparse_density.default_value,
                infillPattern: qualitySetting.infill_pattern.default_value,
            });
        });
        modelGroup.models = models.concat();
        dispatch(actions.render());
    },

    checkNewUser: () => dispatch => {
        api.checkNewUser()
            .then(res => {
                const isNewUser = res?.body?.isNewUser;
                dispatch(
                    actions.updateState({
                        isNewUser
                    })
                );
            })
            .catch(err => {
                console.error({ err });
                dispatch(
                    actions.updateState({
                        isNewUser: true
                    })
                );
            });
    },

    updateSupportOverhangAngle: angle => dispatch => {
        dispatch(
            actions.updateState({
                supportOverhangAngle: angle
            })
        );
    },

    generateSupports: (models, angle) => async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;

        if (!models || models.length === 0) {
            return;
        }

        if (!progressStatesManager.inProgress()) {
            progressStatesManager.startProgress(
                PROCESS_STAGE.PRINTING_GENERATE_SUPPORT,
                [1]
            );
        } else {
            progressStatesManager.startNextStep();
        }
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_MODEL, 0)
            })
        );

        const params = await dispatch(
            actions.uploadModelsForSupport(models, angle)
        );
        controller.generateSupport(params);
    },

    uploadModelsForSupport: (models, angle) => (dispatch, getState) => {
        const { qualityDefinitions, defaultQualityId } = getState().printing;
        const activeQualityDefinition = lodashFind(qualityDefinitions, {
            definitionId: defaultQualityId
        });
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
                    if (
                        model.transformation.scaleX
                        * model.transformation.scaleY
                        * model.transformation.scaleZ
                        < 0
                    ) {
                        mesh.geometry = mesh.geometry.clone();
                        const positions = mesh.geometry.getAttribute('position')
                            .array;

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
                    mesh.geometry.setAttribute(
                        'support_mark',
                        new THREE.Float32BufferAttribute(
                            model.supportFaceMarks.slice(0),
                            1
                        )
                    );

                    const originalName = model.originalName;
                    const uploadPath = `${DATA_PREFIX}/${originalName}`;
                    const basenameWithoutExt = path.basename(
                        uploadPath,
                        path.extname(uploadPath)
                    );
                    const stlFileName = `${basenameWithoutExt}.stl`;
                    const uploadResult = await uploadMesh(mesh, stlFileName);
                    mesh.geometry.deleteAttribute('support_mark');

                    params.data.push({
                        modelID: model.modelID,
                        uploadName: uploadResult.body.uploadName,
                        // specify generated support name
                        supportStlFilename: uploadResult.body.uploadName.replace(
                            /\.stl$/,
                            `_support_${Date.now()}.stl`
                        ),
                        config: {
                            support_angle: angle,
                            layer_height_0:
                                activeQualityDefinition.settings.layer_height_0
                                    .default_value,
                            support_mark_area: false // tell engine to use marks in binary STL file
                        }
                    });
                }
                resolve(params);
            }, 50);
        });
    },

    loadSupports: supportFilePaths => (dispatch, getState) => {
        const { modelGroup, tmpSupportFaceMarks } = getState().printing;
        // use worker to load supports
        const operations = new Operations();
        const promises = supportFilePaths.map((info) => {
            return new Promise((resolve, reject) => {
                const model = modelGroup.findModelByID(info.modelID);
                const previousFaceMarks = tmpSupportFaceMarks[info.modelID];
                if (model) {
                    const operation = new AddSupportsOperation3D({
                        target: model,
                        currentFaceMarks: model.supportFaceMarks.slice(0),
                        currentSupport: null,
                        previousSupport:
                            model.meshObject.children[0]
                            || model.tmpSupportMesh,
                        previousFaceMarks
                    });
                    model.meshObject.clear();
                    operations.push(operation);

                    if (info.supportStlFilename) {
                        new ModelLoader().load(
                            `${DATA_PREFIX}/${info.supportStlFilename}`,
                            (geometry) => {
                                const mesh = model.generateSupportMesh(geometry);
                                operation.state.currentSupport = mesh;
                                resolve();
                            },
                            () => { },
                            (err) => {
                                reject(err);
                            }
                        );
                    } else {
                        resolve();
                    }
                } else {
                    resolve();
                }
            });
        });
        Promise.all(promises)
            .then(() => {
                dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
                dispatch(actions.render());
                dispatch(
                    actions.updateState({
                        tmpSupportFaceMarks: {}
                    })
                );
            })
            .catch(console.error);
    },

    startEditSupportArea: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.startEditSupportArea();
        dispatch(actions.setTransformMode('support-edit'));
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.render());
    },

    finishEditSupportArea: (shouldApplyChanges = false) => (
        dispatch,
        getState
    ) => {
        const { modelGroup, progressStatesManager } = getState().printing;
        dispatch(actions.setTransformMode('support'));
        if (shouldApplyChanges) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1, 1]);
            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 0.25)
                })
            );

            // record previous support face marks for undo&redo
            const tmpSupportFaceMarks = {};
            const availModels = modelGroup.getModelsAttachedSupport();
            availModels.forEach((model) => {
                tmpSupportFaceMarks[model.modelID] = model.supportFaceMarks;
            });
            dispatch(
                actions.updateState({
                    tmpSupportFaceMarks
                })
            );

            const models = modelGroup.finishEditSupportArea(shouldApplyChanges);

            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 1)
                })
            );

            dispatch(actions.generateSupports(models, 0));
        } else {
            modelGroup.finishEditSupportArea(shouldApplyChanges);
        }
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.render());
    },

    clearSupportInGroup: (combinedOperations, modelInGroup) => (
        dispatch,
        getState
    ) => {
        const { modelGroup } = getState().printing;
        const modelsWithSupport = modelGroup.filterModelsCanAttachSupport(
            modelInGroup.parent.children
        );
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
                dispatch(
                    operationHistoryActions.setOperations(
                        INITIAL_STATE.name,
                        operations
                    )
                );
            }
        }
    },

    setSupportBrushRadius: radius => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.setSupportBrushRadius(radius);
        dispatch(actions.render());
    },

    // status: add | remove
    setSupportBrushStatus: (status) => (dispatch) => {
        dispatch(
            actions.updateState({
                supportBrushStatus: status
            })
        );
    },

    moveSupportBrush: raycastResult => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.moveSupportBrush(raycastResult);
        dispatch(actions.render());
    },

    applySupportBrush: raycastResult => (dispatch, getState) => {
        const { modelGroup, supportBrushStatus } = getState().printing;
        modelGroup.applySupportBrush(raycastResult, supportBrushStatus);
        dispatch(actions.render());
    },

    clearAllSupport: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.clearAllSupport();
        dispatch(actions.render());
    },

    computeAutoSupports: angle => (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;
        // record previous support face marks for undo&redo
        const tmpSupportFaceMarks = {};
        // Give priority to the selected supporting models, Second, apply all models
        const selectedAvailModels = modelGroup.getModelsAttachedSupport(false);
        const availModels = selectedAvailModels.length > 0
            ? selectedAvailModels
            : modelGroup.getModelsAttachedSupport();

        if (availModels.length > 0) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_GENERATE_SUPPORT, [1, 1]);
            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 0.25)
                })
            );

            availModels.forEach((model) => {
                tmpSupportFaceMarks[model.modelID] = model.supportFaceMarks;
            });
            dispatch(
                actions.updateState({
                    tmpSupportFaceMarks
                })
            );

            const models = modelGroup.computeSupportArea(availModels, angle);

            dispatch(
                actions.updateState({
                    stage: STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_GENERATE_SUPPORT_AREA, 1)
                })
            );
            if (models.length > 0) {
                dispatch(actions.generateSupports(models, angle));
            }
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        }
    },

    updateClippingPlane: (height) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.updateClippingPlane(height);
        dispatch(actions.render());
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        case ACTION_UPDATE_TRANSFORMATION: {
            return Object.assign({}, state, {
                transformation: {
                    ...state.transformation,
                    ...action.transformation
                }
            });
        }
        default:
            return state;
    }
}
