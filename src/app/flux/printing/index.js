import { resolveParameterValues } from '@snapmaker/luban-platform';
import { cloneDeep, filter, find, isNil } from 'lodash';
import path from 'path';
import * as THREE from 'three';
import { Box3, Vector3 } from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
// import { resolveDefinition } from '../../../shared/lib/definition-resolver';
import { timestamp } from '../../../shared/lib/random-utils';
import api from '../../api';
import {
    ABSENT_OBJECT,
    BLACK_COLOR, BOTH_EXTRUDER_MAP_NUMBER,
    DATA_PREFIX,
    EPSILON,
    GCODE_VISIBILITY_TYPE,
    GCODEPREVIEWMODES,
    HEAD_PRINTING,
    KEY_DEFAULT_CATEGORY_CUSTOM,
    LEFT_EXTRUDER,
    LEFT_EXTRUDER_MAP_NUMBER,
    LOAD_MODEL_FROM_INNER,
    PRINTING_MANAGER_TYPE_EXTRUDER,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_MATERIAL_CONFIG_GROUP_DUAL,
    PRINTING_MATERIAL_CONFIG_GROUP_SINGLE,
    PRINTING_QUALITY_CONFIG_GROUP_DUAL,
    PRINTING_QUALITY_CONFIG_GROUP_SINGLE,
    RIGHT_EXTRUDER,
    RIGHT_EXTRUDER_MAP_NUMBER,
    WHITE_COLOR,
} from '../../constants';
import { getMachineSeriesWithToolhead, isDualExtruder, MACHINE_SERIES, } from '../../constants/machines';
import { isQualityPresetVisible } from '../../constants/preset';
import { PrintMode } from '../../constants/print-base';
import { controller } from '../../lib/controller';
import { logPritingSlice, logProfileChange, logToolBarOperation, logTransformOperation } from '../../lib/gaEvent';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import ProgressStatesManager, { PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';
import workerManager from '../../lib/manager/workerManager';
import { ModelEvents } from '../../models/events';
import ModelGroup from '../../models/ModelGroup';
import PrimeTowerModel from '../../models/PrimeTowerModel';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import scene from '../../scene/Scene';
import { machineStore } from '../../store/local-storage';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import ModelExporter from '../../ui/widgets/PrintingVisualizer/ModelExporter';
import ModelLoader from '../../ui/widgets/PrintingVisualizer/ModelLoader';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
// eslint-disable-next-line import/no-cycle
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
/* eslint-disable import/no-cycle */
import SimplifyModelOperation from '../operation-history/SimplifyModelOperation';
import UngroupOperation3D from '../operation-history/UngroupOperation3D';
import VisibleOperation3D from '../operation-history/VisibleOperation3D';
import sceneActions from './actions-scene';

const { Transfer } = require('threads');

let initEventFlag = false;
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
        quality: 'qualityDefinitionsRight',
        extruder: 'extruderRDefinition'
    }
};
// const CONFIG_ID = {
//     material: 'material.pla',
//     materialRight: 'material.pla',
//     quality: 'quality.fast_print'
// };
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

    //
    // section: Global Print settings
    //
    printMode: PrintMode.Default,

    //
    // section: Preset
    //
    // printing configurations
    // Hierarchy: FDM Printer -> Snapmaker -> Active Definition (combination of machine, material, adhesion configurations)
    // currently available definitions
    defaultDefinitions: [],
    materialDefinitions: [],
    qualityDefinitions: [],
    qualityDefinitionsRight: [],

    // isRecommended: true, // Using recommended settings, TODO: check to remove this
    defaultQualityId: 'quality.fast_print', // TODO: selectedQualityId

    // Active quality preset ids for stacks (extruders).
    // If the machine has only one extruder, then LEFT_EXTRUDER is the only stack.
    activePresetIds: {
        [LEFT_EXTRUDER]: '',
        [RIGHT_EXTRUDER]: '',
    },

    defaultMaterialId: 'material.pla', // TODO: selectedMaterialId
    defaultMaterialIdRight: 'material.pla', // for dual extruder --- right extruder

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


    // others
    transformMode: '', // translate/scale/rotate
    isGcodeOverstepped: false,
    displayedType: 'model', // model/gcode

    // temp
    renderingTimestamp: 0,

    // check not to duplicated create event

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
        support: LEFT_EXTRUDER_MAP_NUMBER,
        onlySupportInterface: false
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
    },
    simplifyType: 0, // 0: low-polygon, 1: length
    simplifyPercent: 80, // only for low polygon
    simplifyOriginModelInfo: {},
    // profile manager params type
    printingParamsType: 'basic',
    materialParamsType: 'basic',
    customMode: false,
    showParamsProfile: true,
    outOfMemoryForRenderGcode: false,

    // UI: PrintingManager
    showPrintingManager: false,
    managerDisplayType: PRINTING_MANAGER_TYPE_MATERIAL,
    materialManagerDirection: LEFT_EXTRUDER,

    // UI: print parameter modifier
    showPrintParameterModifierDialog: false, // type: false | string indicating stack id
};

const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';
const ACTION_UPDATE_TRANSFORMATION = 'printing/ACTION_UPDATE_TRANSFORMATION';

const createLoadModelWorker = (uploadPath, onMessage) => {
    const task = {
        worker: workerManager.loadModel(uploadPath, data => {
            for (const fn of task.cbOnMessage) {
                if (typeof fn === 'function') {
                    fn(data);
                }
            }
        }),
        cbOnMessage: []
    };

    task.cbOnMessage.push(onMessage);
};

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

export const uploadMesh = async function (mesh, fileName, fileType = 'stl') {
    const stl = new ModelExporter().parse(mesh, fileType, true);
    const blob = new Blob([stl], { type: 'text/plain' });
    const fileOfBlob = new File([blob], fileName);

    const formData = new FormData();
    formData.append('file', fileOfBlob);
    const uploadResult = await api.uploadFile(formData, HEAD_PRINTING);
    return uploadResult;
};


const PRESET_KEY_QUALITY_LEFT = 'quality_0';
const PRESET_KEY_QUALITY_RIGHT = 'quality_1';
const PRESET_KEY_MATERIAL_LEFT = 'material_0';
const PRESET_KEY_MATERIAL_RIGHT = 'material_1';

/**
 * Get saved preset ids.
 *
 * {
 *      [quality_0]: '',
 *      [quality_1]: '',
 *      [material_0]: '',
 *      [material_1]: '',
 * }
 */
function getSavedMachinePresetIds(series) {
    const savedData = machineStore.get('preset_ids');
    if (savedData) {
        try {
            const machinePresetIds = JSON.parse(savedData);
            return machinePresetIds[series] || {};
        } catch (e) {
            return {};
        }
    } else {
        return {};
    }
}

/**
 * Set saved preset ids.
 *
 * @param series
 * @param presetIds
 */
function setMachineSavedPresetIds(series, presetIds) {
    const savedData = machineStore.get('preset_ids');
    let machinePresetIds;

    if (savedData) {
        try {
            machinePresetIds = JSON.parse(savedData);
        } catch (e) {
            machinePresetIds = {}; // new object
        }
    } else {
        machinePresetIds = {}; // new object
    }

    machinePresetIds[series] = presetIds;
    machineStore.set('preset_ids', JSON.stringify(machinePresetIds));
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
        const { gcodeLineGroup } = printingState;
        const { toolHead, series, size } = getState().machine;

        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        await definitionManager.init(CONFIG_HEADTYPE, currentMachine.configPathname[CONFIG_HEADTYPE]);

        const allMaterialDefinitions = await definitionManager.getDefinitionsByPrefixName(
            'material'
        );
        const allQualityDefinitions = await definitionManager.getDefinitionsByPrefixName(
            'quality'
        );

        const qualityParamModels = [];
        const qualityParamModelsRight = [];
        const materialPresetModels = [];

        const activeMaterialType = dispatch(actions.getActiveMaterialType());
        const activeMaterialTypeRight = dispatch(actions.getActiveMaterialType(undefined, RIGHT_EXTRUDER));

        // const extruderLDefinition = await definitionManager.getDefinition('snapmaker_extruder_0');
        // const extruderRDefinition = await definitionManager.getDefinition('snapmaker_extruder_1');
        const extruderLDefinition = definitionManager.extruderLDefinition;
        const extruderRDefinition = definitionManager.extruderRDefinition;

        allMaterialDefinitions.forEach((eachDefinition) => {
            const paramModel = new PresetDefinitionModel(eachDefinition);
            materialPresetModels.push(paramModel);
        });

        allQualityDefinitions.forEach((eachDefinition) => {
            const paramModel = new PresetDefinitionModel(
                eachDefinition,
                activeMaterialType,
                extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            qualityParamModels.push(paramModel);

            const paramModelRight = new PresetDefinitionModel(
                eachDefinition,
                activeMaterialTypeRight,
                extruderRDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            qualityParamModelsRight.push(paramModelRight);
        });

        dispatch(
            actions.updateState({
                materialDefinitions: materialPresetModels,
                qualityDefinitions: qualityParamModels,
                qualityDefinitionsRight: qualityParamModelsRight,
                extruderLDefinition,
                extruderRDefinition,
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

        const { modelGroup, gcodeLineGroup } = printingState;
        scene.setModelGroup(modelGroup);

        const { toolHead } = getState().machine;

        modelGroup.setDataChangedCallback(
            () => {
                dispatch(sceneActions.render());
            },
            height => {
                dispatch(actions.updateState({ primeTowerHeight: height }));
            }
        );

        let { series } = getState().machine;
        series = getRealSeries(series);

        const currentMachine = getMachineSeriesWithToolhead(series, toolHead);

        // init definition manager
        await definitionManager.init(
            CONFIG_HEADTYPE,
            currentMachine.configPathname[CONFIG_HEADTYPE]
        );

        // Restore saved preset ids for active machine
        const savedPresetIds = getSavedMachinePresetIds(series);
        if (savedPresetIds) {
            let qualityPresetIdLeft = '';
            let qualityPresetIdRight = '';
            let materialPresetIdLeft = 'material.pla';
            let materialPresetIdRight = 'material.pla';

            if (savedPresetIds[PRESET_KEY_QUALITY_LEFT]) {
                qualityPresetIdLeft = savedPresetIds[PRESET_KEY_QUALITY_LEFT];
            }
            if (savedPresetIds[PRESET_KEY_QUALITY_RIGHT]) {
                qualityPresetIdRight = savedPresetIds[PRESET_KEY_QUALITY_RIGHT];
            }
            if (savedPresetIds[PRESET_KEY_MATERIAL_LEFT]) {
                materialPresetIdLeft = savedPresetIds[PRESET_KEY_MATERIAL_LEFT];
            }
            if (savedPresetIds[PRESET_KEY_MATERIAL_RIGHT]) {
                materialPresetIdRight = savedPresetIds[PRESET_KEY_MATERIAL_RIGHT];
            }

            dispatch(actions.updateState({
                activePresetIds: {
                    [LEFT_EXTRUDER]: qualityPresetIdLeft,
                    [RIGHT_EXTRUDER]: qualityPresetIdRight,
                },
                defaultMaterialId: materialPresetIdLeft,
                defaultMaterialIdRight: materialPresetIdRight,
            }));
        }

        dispatch(
            actions.updateState({
                helpersExtruderConfig: {
                    adhesion: LEFT_EXTRUDER_MAP_NUMBER,
                    support: LEFT_EXTRUDER_MAP_NUMBER
                },
                extruderLDefinition: definitionManager.extruderLDefinition,
                extruderRDefinition: definitionManager.extruderRDefinition,
            })
        );

        // Update machine size after active definition is loaded
        const allQualityDefinitions = await definitionManager.getDefinitionsByPrefixName('quality');
        const allMaterialDefinitions = await definitionManager.getDefinitionsByPrefixName('material');

        const activeMaterialType = dispatch(actions.getActiveMaterialType()); // TODO: Consider another extruder

        const materialParamModels = allMaterialDefinitions.map((eachDefinition) => {
            const paramModel = new PresetDefinitionModel(
                eachDefinition,
                activeMaterialType,
                definitionManager.extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            return paramModel;
        });

        const qualityPresetModels = [];
        const qualityPresetModelsRight = [];
        for (const preset of allQualityDefinitions) {
            const paramModel = new PresetDefinitionModel(
                preset,
                activeMaterialType,
                definitionManager.extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            qualityPresetModels.push(paramModel);

            const paramModelRight = new PresetDefinitionModel(
                preset,
                activeMaterialType,
                definitionManager.extruderRDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            qualityPresetModelsRight.push(paramModelRight);
        }

        const defaultDefinitions = definitionManager?.defaultDefinitions.map((eachDefinition) => {
            const paramModel = new PresetDefinitionModel(
                eachDefinition,
                activeMaterialType,
                definitionManager.extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
            return paramModel;
        });
        dispatch(
            actions.updateState({
                defaultDefinitions: defaultDefinitions,
                materialDefinitions: materialParamModels,
                qualityDefinitions: qualityPresetModels,
                qualityDefinitionsRight: qualityPresetModelsRight,
                printingProfileLevel: definitionManager.printingProfileLevel,
                materialProfileLevel: definitionManager.materialProfileLevel,
            })
        );

        // model group
        dispatch(actions.updateBoundingBox());

        // Re-position model group
        const { size } = getState().machine;
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);
    },

    // scene: sceneActions,

    updateProfileParamsType: (managerType, value) => (dispatch) => {
        if (managerType === PRINTING_MANAGER_TYPE_MATERIAL) {
            dispatch(actions.updateState({
                materialParamsType: value
            }));
        } else {
            dispatch(actions.updateState({
                printingParamsType: value
            }));
        }
    },

    updateParamsProfileShow: (value) => (dispatch) => {
        dispatch(actions.updateState({
            showParamsProfile: value
        }));
    },

    updateCustomMode: (value) => (dispatch) => {
        dispatch(actions.updateState({
            customMode: value
        }));
    },

    /**
     * Update bounding box of editable area.
     *
     * Editable area is area that can be used to place models.
     *
     * Considering:
     *  - machine size
     *  - print mode (different edit areas for specific print modes)
     *  - adhesion parameters (reducing edit area)
     */
    updateBoundingBox: () => (dispatch, getState) => {
        const {
            modelGroup,
            printMode,
            qualityDefinitions,
            extruderLDefinition,
            extruderRDefinition,
            activePresetIds,
            helpersExtruderConfig,
        } = getState().printing;

        const extruderLDefinitionSettings = extruderLDefinition?.settings;
        const extruderRDefinitionSettings = extruderRDefinition?.settings;

        const activeQualityDefinition = find(qualityDefinitions, {
            definitionId: activePresetIds[LEFT_EXTRUDER]
        }); // what if it doesn't exist?

        const { size, activeMachine } = getState().machine;

        const printModes = activeMachine.metadata?.printModes || [];

        // Get work range for print mode
        const maxWorkRange = new Box3(
            new Vector3(0, 0, 0),
            new Vector3(size.x, size.y, size.z),
        );
        let workRange;
        if (!printModes || printModes.length === 0) {
            workRange = maxWorkRange; // Default
        } else {
            const foundPrintModeData = printModes.find(d => d.mode === printMode);
            if (foundPrintModeData?.workRange) {
                const data = foundPrintModeData.workRange;
                workRange = new Box3(
                    new Vector3(data.min[0], data.min[1], data.min[2]),
                    new Vector3(data.max[0], data.max[1], data.max[2])
                );
            } else {
                workRange = maxWorkRange;
            }
        }

        const adhesionType = activeQualityDefinition?.settings?.adhesion_type?.default_value;

        let border = 0;
        let supportLineWidth = 0;
        switch (adhesionType) {
            case 'skirt': {
                const skirtLineCount = activeQualityDefinition?.settings?.skirt_line_count?.default_value;
                supportLineWidth = extruderLDefinitionSettings?.machine_nozzle_size?.default_value ?? 0;
                if (helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER) {
                    supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size.default_value;
                }
                border = 7 + (skirtLineCount - 1) * supportLineWidth;
                break;
            }
            case 'brim': {
                const brimLineCount = activeQualityDefinition?.settings?.brim_line_count?.default_value;
                supportLineWidth = extruderLDefinitionSettings?.machine_nozzle_size?.default_value ?? 0;
                if (helpersExtruderConfig.adhesion === RIGHT_EXTRUDER_MAP_NUMBER) {
                    supportLineWidth = extruderRDefinitionSettings.machine_nozzle_size.default_value;
                }
                border = brimLineCount * supportLineWidth;
                break;
            }
            case 'raft': {
                const raftMargin = activeQualityDefinition?.settings?.raft_margin?.default_value;
                border = raftMargin;
                break;
            }
            default:
                border = 0;
                break;
        }

        const sceneZero = new Vector3(-size.x / 2, -size.y / 2, 0);
        const boundingBox = new Box3(
            new Vector3(
                sceneZero.x + workRange.min.x + border - EPSILON,
                sceneZero.y + workRange.min.y + border - EPSILON,
                sceneZero.z + workRange.min.z - EPSILON,
            ),
            new Vector3(
                sceneZero.x + workRange.max.x - border + EPSILON,
                sceneZero.y + workRange.max.y - border + EPSILON,
                sceneZero.z + workRange.max.z + EPSILON,
            ),
        );
        const modelState = modelGroup.updateBoundingBox(boundingBox);
        dispatch(actions.updateState(modelState));

        const newStopArea = {
            left: boundingBox.min.x - sceneZero.x,
            right: size.x / 2 - boundingBox.max.x,
            front: boundingBox.min.y - sceneZero.y,
            back: size.y / 2 - boundingBox.max.y,
        };
        dispatch(
            actions.updateState({
                stopArea: newStopArea
            })
        );
    },

    /**
     * Initialize socket events.
     *
     * @private
     */
    initSocketEvent: () => async (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        // generate gcode event
        if (!initEventFlag) {
            initEventFlag = true;
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

                // FIXME: why gcodeFile hard-coded?
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

            // for simplify-model
            controller.on('simplify-model:started', ({ firstTime, uploadName, transformation }) => {
                const { progressStatesManager, simplifyOriginModelInfo } = getState().printing;
                // progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SIMPLIFY_MODEL);
                if (firstTime && uploadName) {
                    dispatch(actions.updateState({
                        simplifyOriginModelInfo: {
                            ...simplifyOriginModelInfo,
                            uploadName: uploadName,
                            transformation: transformation,
                        }
                    }));
                }
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_SIMPLIFY_MODEL,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SIMPLIFY_MODEL, 0.3),
                }));
            });

            controller.on('simplify-model:progress', _progress => {
                const { progressStatesManager, progress } = getState().printing;
                if (_progress - progress > 0.01 || progress > 1 - EPSILON) {
                    dispatch(actions.updateState({
                        progress: progressStatesManager.updateProgress(
                            STEP_STAGE.PRINTING_SIMPLIFY_MODEL,
                            _progress
                        )
                    }));
                }
            });

            controller.on('simplify-model:error', () => {
                const { progressStatesManager } = getState().printing;
                progressStatesManager.finishProgress(false);
                dispatch(actions.updateState({
                    stage: STEP_STAGE.PRINTING_SIMPLIFY_MODEL_FAILED
                }));
            });

            controller.on('simplify-model:completed', (params) => {
                const { modelOutputName, modelID } = params;
                actions.loadSimplifyModel({ modelID, modelOutputName })(dispatch, getState);
                workerManager.continueClipper();
            });
        }
    },

    // TODO: init should be re-called
    init: () => async (dispatch, getState) => {
        await dispatch(actions.initSize());

        const printingState = getState().printing;
        const { modelGroup } = printingState;
        const { series } = getState().machine;
        modelGroup.setSeries(series);

        modelGroup.removeAllModels();

        dispatch(actions.initSocketEvent());
        dispatch(actions.applyProfileToAllModels());
    },

    updatePrintMode: (printMode) => (dispatch) => {
        // TODO: Check if printMode is acceptable by active machine
        dispatch(actions.updateState({ printMode }));

        dispatch(actions.updateBoundingBox());

        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    loadSimplifyModel: ({ modelID, modelOutputName, isCancelSimplify = false }) => async (dispatch, getState) => {
        const { progressStatesManager, simplifyOriginModelInfo } = getState().printing;
        !isCancelSimplify && dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_SIMPLIFY_MODEL,
                progress: progressStatesManager.updateProgress(
                    STEP_STAGE.PRINTING_SIMPLIFY_MODEL,
                    1
                ),
                simplifyOriginModelInfo: {
                    ...simplifyOriginModelInfo,
                    simplifyResultFimeName: modelOutputName
                }
            })
        );
        const uploadName = modelOutputName;
        await dispatch(actions.updateModelMesh([{
            modelID,
            uploadName,
            reloadSimplifyModel: true
        }], true));
    },

    logGenerateGcode: () => (dispatch, getState) => {
        const {
            extruderLDefinition,
            extruderRDefinition,
            activePresetIds,
            defaultMaterialId,
            defaultMaterialIdRight,
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

        const activeActiveQualityDefinition = find(qualityDefinitions, { definitionId: activePresetIds[LEFT_EXTRUDER] });
        const defaultQualityDefinition = defaultDefinitions.find(d => d.definitionId === activePresetIds[LEFT_EXTRUDER]);
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

        if (!isDualExtruder(toolHead.printingToolhead)) {
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

    gcodeRenderingCallback: (data, extruderColors) => async (dispatch, getState) => {
        const { gcodeLineGroup, gcodePreviewMode, gcodeEntity } = getState().printing;

        const { status, value } = data;
        switch (status) {
            case 'succeed': {
                const { vertexNumber, gcodeEntityLayers: bufferGeometry, layerCount, bounds } = value;
                const freeMemory = await controller.getFreeMemory();
                let outOfMemoryForRenderGcode = (freeMemory - vertexNumber * 0.25) < 0;
                outOfMemoryForRenderGcode = false;
                if (!outOfMemoryForRenderGcode) {
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
                }

                const { progressStatesManager } = getState().printing;
                dispatch(actions.updateState({
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_PREVIEWING, 1)
                }));
                progressStatesManager.startNextStep();
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_PREVIEWING,
                        outOfMemoryForRenderGcode
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

    getDefaultDefinition: (id) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().printing;
        const def = defaultDefinitions.find((d) => d.definitionId === id);
        return def?.settings;
    },

    updateDefaultDefinition: (id, paramKey, paramValue) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().printing;
        const index = defaultDefinitions.findIndex(
            (d) => d.definitionId === id
        );
        const newDefModel = defaultDefinitions[index];
        resolveParameterValues(newDefModel, [[paramKey, paramValue]]);
        definitionManager.updateDefaultDefinition(newDefModel);
        defaultDefinitions[index] = newDefModel;

        dispatch(
            actions.updateState({
                defaultDefinitions: [...defaultDefinitions]
            })
        );
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

    updateMachineDefinition: (
        {
            paramKey,
            paramValue,
            direction,
        }
    ) => async (dispatch, getState) => {
        if (!isNil(paramValue)) {
            const printingState = getState().printing;
            const machineDefinition = definitionManager.machineDefinition;
            const { materialDefinitions, qualityDefinitions } = printingState;

            let isNozzleSizeChanged = false;
            if (direction) {
                const definitionsKey = definitionKeysWithDirection[direction][PRINTING_MANAGER_TYPE_EXTRUDER];
                const definitionModel = printingState[definitionsKey];
                if (definitionModel.settings[paramKey]) {
                    definitionModel.settings[paramKey].default_value = paramValue;
                }
                if (direction === LEFT_EXTRUDER) {
                    if (paramKey === 'machine_nozzle_size') {
                        isNozzleSizeChanged = true;
                    }
                }
                dispatch(
                    actions.updateState({
                        [definitionsKey]: definitionModel
                    })
                );
            }

            if (machineDefinition.settings[paramKey]) {
                machineDefinition.settings[paramKey].default_value = paramValue;
            }

            // TODO: Consider left & right stacks
            const {
                newMaterialDefinitions,
                newQualityDefinitions,
            } = await definitionManager.updateMachineDefinition({
                isNozzleSize: isNozzleSizeChanged,
                machineDefinition,
                materialDefinitions,
                qualityDefinitions,
            });
            dispatch(actions.updateDefaultDefinition(
                'quality.normal_other_quality',
                paramKey,
                paramValue
            ));

            if (newMaterialDefinitions) {
                dispatch(actions.updateState({
                    qualityDefinitions: newQualityDefinitions,
                    materialDefinitions: newMaterialDefinitions,
                }));
            } else {
                dispatch(actions.updateState({
                    qualityDefinitions: newQualityDefinitions,
                }));
            }

            if (isNozzleSizeChanged) {
                // Nozzle size has changed
                dispatch(actions.validateActiveQualityPreset(direction));
            }

            setTimeout(() => {
                dispatch(actions.applyProfileToAllModels());
            });
        }
    },

    updateCurrentDefinition: (
        {
            definitionModel,
            managerDisplayType: type,
            changedSettingArray,
            direction = LEFT_EXTRUDER,
        }
    ) => (dispatch, getState) => {
        const printingState = getState().printing;
        const { qualityDefinitions } = printingState;
        const id = definitionModel?.definitionId;
        let updatePresetModel = false;

        // TODO: ?
        const definitionsKey = definitionKeysWithDirection[direction][type];

        // extruder definition
        if (['snapmaker_extruder_0', 'snapmaker_extruder_1'].includes(id)) {
            if (id === 'snapmaker_extruder_0') {
                updatePresetModel = true;
            }
            dispatch(
                actions.updateState({
                    [definitionsKey]: definitionModel
                })
            );
        } else if (type === PRINTING_MANAGER_TYPE_EXTRUDER) {
            updatePresetModel = true;
            resolveParameterValues(definitionModel, changedSettingArray);

            dispatch(
                actions.updateState({
                    [definitionsKey]: definitionModel
                })
            );
        } else {
            updatePresetModel = true;

            resolveParameterValues(definitionModel, changedSettingArray);

            const definitions = printingState[definitionsKey];
            const index = definitions.findIndex((d) => d.definitionId === id);
            definitions[index] = definitionModel;
            dispatch(
                actions.updateState({
                    [definitionsKey]: [...definitions]
                })
            );

            dispatch(actions.updateBoundingBox());
        }

        definitionManager.updateDefinition(definitionModel);

        if (updatePresetModel) {
            dispatch(actions.validateActiveQualityPreset(direction));
            dispatch(actions.updateState({ qualityDefinitions: [...qualityDefinitions] }));
        }

        /*
        TODO: Check overstep for auto-generated meshes, including adhesion, prime tower, support.
        if (shouldUpdateIsOverstepped) {
            const { modelGroup } = printingState;
            const isAnyModelOverstepped = modelGroup.getOverstepped(
                definitionModel?.settings?.prime_tower_enable?.default_value
            );
            dispatch(actions.updateState({ isAnyModelOverstepped }));
        }
        */

        // TODO: why use setTimeout here? add comment describe the reason.
        setTimeout(() => {
            dispatch(actions.applyProfileToAllModels());
        });
    },

    updateDefinition: ({ managerDisplayType, definitionModel, changedSettingArray }) => (dispatch) => {
        dispatch(actions.updateCurrentDefinition({
            managerDisplayType,
            definitionModel,
            changedSettingArray,
        }));
    },

    onUploadManagerDefinition: (file, type) => (dispatch, getState) => {
        const state = getState().printing;

        return new Promise(resolve => {
            const formData = new FormData();
            formData.append('file', file);
            api.uploadFile(formData, HEAD_PRINTING)
                .then(async (res) => {
                    const response = res.body;
                    const definitionId = `${type}.${timestamp()}`;
                    let definition = await definitionManager.uploadDefinition(
                        definitionId,
                        response.uploadName
                    );
                    let name = definition.name;
                    definition.isRecommended = false;
                    const definitionsKey = defaultDefinitionKeys[type].definitions;
                    const definitions = state[definitionsKey];
                    const extruderLDefinition = state.extruderLDefinition;
                    const activeMaterialType = dispatch(actions.getActiveMaterialType());
                    while (definitions.find((e) => {
                        if ((definition.category && e.category === definition.category && e.name === name)
                            || (!definition.category && e.name === name)) {
                            return true;
                        }
                        return false;
                    })) {
                        name = `#${name}`;
                        definition.name = name;
                    }
                    definition = new PresetDefinitionModel(
                        definition,
                        activeMaterialType,
                        extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
                    );
                    await definitionManager.updateDefinition({
                        definitionId: definition.definitionId,
                        name
                    });
                    dispatch(
                        actions.updateState({
                            [definitionsKey]: [...definitions, definition]
                        })
                    );
                    resolve(definition);
                })
                .catch((err) => {
                    // Ignore error
                    console.error('err', err);
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
     * @param {*}
     * type: 'material'|'quality'
     * definition: definitionModel
     * newCategoryName: string
     */
    updateDefinitionCategoryName: (type, definition, newCategoryName) => async (dispatch, getState) => {
        const definitionsKey = defaultDefinitionKeys[type]?.definitions;
        const definitions = getState().printing[definitionsKey];
        definition.category = newCategoryName;
        await definitionManager.updateDefinition(definition);
        const index = definitions.findIndex(
            (d) => d.definitionId === definition?.definitionId
        );
        definitions[index] = definition;
        dispatch(
            actions.updateState({
                [definitionsKey]: [...definitions]
            })
        );
    },

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
            (d) => {
                if (definition.category === '') {
                    return d.category === i18n._(KEY_DEFAULT_CATEGORY_CUSTOM);
                } else {
                    return d.category === definition.category;
                }
            }
        );

        // make sure name is not repeated
        while (definitionsWithSameCategory.find((d) => d.name === newDefinition.name)) {
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

        createdDefinitionModel = new PresetDefinitionModel(
            createdDefinitionModel,
            activeMaterialType,
            extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
        );

        dispatch(
            actions.updateState({
                [definitionsKey]: [...state[definitionsKey], createdDefinitionModel]
            })
        );

        return createdDefinitionModel;
    },

    getActiveMaterialType: (defaultId, direction = LEFT_EXTRUDER) => (dispatch, getState) => {
        const { materialDefinitions, defaultMaterialId, defaultMaterialIdRight } = getState().printing;

        // defaultId
        const id = defaultId || direction === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;

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
            const createdDefinition = await definitionManager.createDefinition(
                newDefinition
            );
            const createdDefinitionModel = new PresetDefinitionModel(
                createdDefinition,
                activeMaterialType,
                extruderLDefinition?.settings?.machine_nozzle_size?.default_value,
            );
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

        // FIXME: Consider right extruder
        !loop && dispatch(
            actions.updateState({
                [definitionsKey]: defintions
            })
        );

        // TODO: Return success or fail?
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
        const { materialDefinitions } = getState().printing;

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

        const newMaterialPresetModels = [];
        for (const presetModel of materialDefinitions) {
            if (defaultDefinitionIds.includes(presetModel.definitionId)) {
                newMaterialPresetModels.push(presetModel);
                continue;
            }
            definitionManager.removeDefinition(presetModel);
        }

        dispatch(
            actions.updateState({
                materialDefinitions: newMaterialPresetModels
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

    updateDefaultIdByType: (type, newDefinitionId, stackId = LEFT_EXTRUDER) => dispatch => {
        let defaultKey;
        if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            defaultKey = stackId === LEFT_EXTRUDER ? 'defaultMaterialId' : 'defaultMaterialIdRight';
        } else {
            // FIXME:
            defaultKey = defaultDefinitionKeys[type].id;
            throw Error('Unable to get key for definition');
        }
        dispatch(actions.updateSavedPresetIds(type, newDefinitionId, stackId));
        dispatch(
            actions.updateState({
                [defaultKey]: newDefinitionId
            })
        );
        dispatch(actions.validateActiveQualityPreset(stackId));
        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    updateDefaultMaterialId: (materialId, stackId = LEFT_EXTRUDER) => (dispatch) => {
        const updateKey = stackId === LEFT_EXTRUDER ? 'defaultMaterialId' : 'defaultMaterialIdRight';

        dispatch(actions.updateSavedPresetIds(PRINTING_MANAGER_TYPE_MATERIAL, materialId, stackId));
        dispatch(actions.updateState({
            [updateKey]: materialId,
        }));
        dispatch(actions.validateActiveQualityPreset(stackId));
        dispatch(actions.applyProfileToAllModels());
    },

    /**
     * Update active quality preset.
     *
     * @param stackId
     * @param presetId
     */
    updateActiveQualityPresetId: (stackId = LEFT_EXTRUDER, presetId) => (dispatch, getState) => {
        const { activePresetIds } = getState().printing;
        dispatch(actions.updateState({
            activePresetIds: {
                ...activePresetIds,
                [stackId]: presetId,
            }
        }));
        dispatch(actions.updateSavedPresetIds(PRINTING_MANAGER_TYPE_QUALITY, presetId, stackId));
        dispatch(actions.validateActiveQualityPreset(stackId));
        dispatch(actions.applyProfileToAllModels());
    },

    /**
     * Update saved preset ids.
     *
     * @param type
     * @param presetId
     * @param direction
     */
    updateSavedPresetIds: (type, presetId, direction = LEFT_EXTRUDER) => (dispatch, getState) => {
        let { series } = getState().machine;
        series = getRealSeries(series);

        const savedPresetIds = getSavedMachinePresetIds(series);
        let dirty = false;

        if (type === PRINTING_MANAGER_TYPE_QUALITY) {
            const presetKey = direction === LEFT_EXTRUDER ? PRESET_KEY_QUALITY_LEFT : PRESET_KEY_QUALITY_RIGHT;

            if (presetId !== savedPresetIds[presetKey]) {
                savedPresetIds[presetKey] = presetId;
                dirty = true;
                logProfileChange(HEAD_PRINTING, presetKey);
            }
        } else if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            const presetKey = direction === LEFT_EXTRUDER ? PRESET_KEY_MATERIAL_LEFT : PRESET_KEY_MATERIAL_RIGHT;

            if (presetId !== savedPresetIds[presetKey]) {
                savedPresetIds[presetKey] = presetId;
                dirty = true;
                logProfileChange(HEAD_PRINTING, presetKey);
            }
        }

        if (dirty) {
            setMachineSavedPresetIds(series, savedPresetIds);
        }
    },

    /**
     * Validate if active quality preset id is suitable for material at stack.
     *
     * @param stackId
     */
    validateActiveQualityPreset: (stackId = LEFT_EXTRUDER) => (dispatch, getState) => {
        const { qualityDefinitions, qualityDefinitionsRight, activePresetIds } = getState().printing;

        const presetModels = stackId === LEFT_EXTRUDER ? qualityDefinitions : qualityDefinitionsRight;

        const materialType = dispatch(actions.getActiveMaterialType(undefined, stackId));

        const presetModel = presetModels.find(p => p.definitionId === activePresetIds[stackId]);

        // TODO: Consider nozzle size
        // machineNozzleSize: actualExtruderDefinition.settings?.machine_nozzle_size?.default_value,
        if (presetModel && isQualityPresetVisible(presetModel, { materialType: materialType })) {
            // the quality preset looks fine
            return;
        }

        // find a new quality preset for active material type
        for (const presetModel2 of presetModels) {
            const visible = isQualityPresetVisible(presetModel2, { materialType: materialType });
            if (visible) {
                dispatch(actions.updateActiveQualityPresetId(stackId, presetModel2.definitionId));
                break;
            }
        }
    },

    /**
     * Load and parse 3D model and create corresponding Model object.
     *
     * @private
     */
    __loadModel: (files) => async dispatch => {
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
    uploadModel: (files) => async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);

        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 0.01)
            })
        );

        const ps = Array.from(files).map(async file => {
            // Notice user that model is being loading
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.uploadFile(formData, HEAD_PRINTING);
            const { originalName, uploadName, children = [] } = res.body;
            return { originalName, uploadName, children };
        });
        const promiseResults = await Promise.allSettled(ps);
        const fileNames = promiseResults.map((promiseTask, index) => {
            let res = {};
            if (promiseTask.value) {
                res = promiseTask.value;
            } else {
                promiseTask.originalName = files[index]?.name;
                res = promiseTask;
            }
            return res;
        });
        const allChild = [];
        fileNames.forEach((item) => {
            if (item.children) {
                if (item.children.length) {
                    item.isGroup = true;
                }
                allChild.push(...item.children);
            }
        });
        if (allChild.length) {
            allChild.push(...fileNames);
            actions.__loadModel(allChild)(dispatch, getState);
        } else {
            actions.__loadModel(fileNames)(dispatch, getState);
        }
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
        const { gcodeFile, gcodeLineGroup } = getState().printing;
        if (gcodeFile) {
            ThreeUtils.dispose(gcodeLineGroup);
            gcodeLineGroup.clear();
            dispatch(actions.updateState({
                gcodeFile: null,
                gcodeLine: null,
                displayedType: 'model',
                outOfMemoryForRenderGcode: false
            }));
        }
    },

    generateGrayModeObject: () => async (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        if (modelGroup.grayModeObject) {
            modelGroup.grayModeObject.children.forEach(child => {
                ThreeUtils.dispose(child);
            });
            modelGroup.grayModeObject.clear();
        } else {
            modelGroup.grayModeObject = new THREE.Group();
        }
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
            let meshObject = find(modelGroup.object.children, {
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
        workerManager.setClipperWorkerEnable(false);

        const {
            printMode,
            hasModel,
            modelGroup,
            progressStatesManager,
            helpersExtruderConfig,
            layerCount,
            extruderLDefinition,
            extruderRDefinition,
            activePresetIds,
            defaultMaterialId,
            defaultMaterialIdRight,
            qualityDefinitions,
            qualityDefinitionsRight,
            materialDefinitions,
        } = getState().printing;
        modelGroup.updateClippingPlane();
        const {
            size,
            series,
            toolHead: { printingToolhead },
            activeMachine,
        } = getState().machine;
        const isDual = isDualExtruder(printingToolhead);

        const models = modelGroup.getVisibleValidModels();
        if (!models || models.length === 0 || !hasModel) {
            log.warn('No model(s) to be sliced.');
            return;
        }
        // update extruder definitions
        const qualityPresets = {
            [LEFT_EXTRUDER]: qualityDefinitions.find(p => p.definitionId === activePresetIds[LEFT_EXTRUDER]),
            [RIGHT_EXTRUDER]: qualityDefinitionsRight.find(p => p.definitionId === activePresetIds[RIGHT_EXTRUDER]),
        };

        const globalQualityPreset = cloneDeep(qualityPresets[LEFT_EXTRUDER]);

        const indexL = materialDefinitions.findIndex(
            (d) => d.definitionId === defaultMaterialId
        );
        const indexR = materialDefinitions.findIndex(
            (d) => d.definitionId === defaultMaterialIdRight
        );

        // Apply scene changes to global preset, and extruders
        dispatch(sceneActions.finalizeSceneSettings(
            isDual ? [extruderLDefinition, extruderRDefinition] : [extruderLDefinition],
            globalQualityPreset,
            [qualityPresets[LEFT_EXTRUDER], qualityPresets[RIGHT_EXTRUDER]]
        ));

        // Finalize extruder settings based on (quality preset, extruder settings, material settings)
        let newExtruderLDefinition = extruderLDefinition;
        if (extruderLDefinition) {
            newExtruderLDefinition = definitionManager.finalizeExtruderDefinition(
                {
                    activeQualityDefinition: qualityPresets[LEFT_EXTRUDER],
                    extruderDefinition: extruderLDefinition,
                    materialDefinition: materialDefinitions[indexL],
                }
            );
            definitionManager.updateDefinition({
                ...newExtruderLDefinition,
                definitionId: 'snapmaker_extruder_0'
            });
        }

        let newExtruderRDefinition = extruderRDefinition;
        if (extruderRDefinition) {
            newExtruderRDefinition = definitionManager.finalizeExtruderDefinition(
                {
                    activeQualityDefinition: qualityPresets[RIGHT_EXTRUDER],
                    extruderDefinition: extruderRDefinition,
                    materialDefinition: materialDefinitions[indexR],
                }
            );
            definitionManager.updateDefinition({
                ...newExtruderRDefinition,
                definitionId: 'snapmaker_extruder_1'
            });
        }

        definitionManager.calculateDependencies(
            globalQualityPreset.settings,
            modelGroup && modelGroup.hasSupportModel()
        );

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
                    0.2
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

        const finalDefinition = definitionManager.finalizeActiveDefinition(
            printMode,
            globalQualityPreset,
            qualityPresets[LEFT_EXTRUDER],
            qualityPresets[RIGHT_EXTRUDER],
            newExtruderLDefinition,
            newExtruderRDefinition,
            size,
            isDual,
            {
                adhesion: helpersExtruderConfig.adhesion,
                support: helpersExtruderConfig.support,
                onlySupportInterface: helpersExtruderConfig.onlySupportInterface,
            },
        );

        const options = {};
        if (modelGroup.models.every(m => !m.hasOversteppedHotArea)) {
            options.center = 'Center';
        } else {
            options.all = 'All';
        }
        finalDefinition.settings.machine_heated_bed_area = {
            label: 'Machine Heated Bed Area',
            description: '',
            type: 'enum',
            options,
            default_value: 'all',
            enabled: 'false',
            settable_per_mesh: false,
            settable_per_extruder: false,
            settable_per_meshgroup: false
        };
        await definitionManager.createDefinition(finalDefinition);

        // slice
        // save line width and layer height for gcode preview
        dispatch(actions.updateState({
            gcodeEntity: {
                extruderLlineWidth0: extruderLDefinition.settings.wall_line_width_0.default_value,
                extruderLlineWidth: extruderLDefinition.settings.wall_line_width_x.default_value,
                extruderRlineWidth0: extruderRDefinition?.settings.wall_line_width_0.default_value || 0.4,
                extruderRlineWidth: extruderRDefinition?.settings.wall_line_width_x.default_value || 0.4,
                layerHeight0: finalDefinition.settings.layer_height_0.default_value,
                layerHeight: finalDefinition.settings.layer_height.default_value,
            }
        }));

        const boundingBox = modelGroup.getBoundingBox();

        const originOffsetX = activeMachine.size.x / 2;
        const originOffsetY = activeMachine.size.y / 2;

        const gcodeBoundingBox = new Box3(
            new Vector3(boundingBox.min.x + originOffsetX, boundingBox.min.y + originOffsetY, boundingBox.min.z),
            new Vector3(boundingBox.max.x + originOffsetX, boundingBox.max.y + originOffsetY, boundingBox.max.z),
        );

        const version = activeMachine.metadata?.slicerVersion || 0;

        const printModesMap = {
            [PrintMode.Default]: 'Default',
            [PrintMode.IDEXBackup]: 'IDEX Backup',
            [PrintMode.IDEXDuplication]: 'IDEX Duplication',
            [PrintMode.IDEXMirror]: 'IDEX Mirror',
        };

        const params = {
            version,
            definition,
            model,
            support,
            originalName,
            boundingBox: gcodeBoundingBox,
            thumbnail: thumbnail,
            series,
            printingToolhead,
            material0: materialDefinitions[indexL]?.name,
            material1: isDual ? materialDefinitions[indexR]?.name : '',
            layerCount,
            renderGcodeFileName,
            metadata: {
                printMode: printModesMap[printMode] || 'Default',
            },
        };
        controller.slice(params);
    },

    prepareModel: () => (dispatch, getState) => {
        return new Promise((resolve) => {
            const {
                modelGroup,
                qualityDefinitions,
                activePresetIds,
                extruderLDefinition,
                extruderRDefinition,
            } = getState().printing;

            const activeQualityDefinition = find(qualityDefinitions, {
                definitionId: activePresetIds[LEFT_EXTRUDER]
            });

            // Use setTimeout to force export executes in next tick, preventing block of updateState()
            setTimeout(async () => {
                const models = modelGroup.getThreeModels()
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
                        extruderRDefinition,
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
                displayedType: 'model',
                outOfMemoryForRenderGcode: false
            })
        );
        dispatch(actions.render());
        workerManager.setClipperWorkerEnable();
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
        // TODO: Performance optimization test
        // dispatch(actions.render());
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
                target: model,
                dispatch
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

    updateSelectedModelsExtruder: (extruderConfig) => (dispatch, getState) => {
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
                    ...modelItem.extruderConfig,
                    ...extruderConfig,
                };

                if (modelItem.children) {
                    modelItem.children.forEach((item) => {
                        if (extruderConfig.shell && extruderConfig.shell !== BOTH_EXTRUDER_MAP_NUMBER) {
                            item.extruderConfig = {
                                ...item.extruderConfig,
                                shell: extruderConfig.shell,
                            };
                        }
                        if (extruderConfig.infill && extruderConfig.infill !== BOTH_EXTRUDER_MAP_NUMBER) {
                            item.extruderConfig = {
                                ...item.extruderConfig,
                                infill: extruderConfig.infill,
                            };
                        }
                    });
                }
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
        modelGroup.modelAttributesChanged('extruderConfig');
    },

    updateHelpersExtruder: (extruderConfig) => (dispatch, getState) => {
        dispatch(
            actions.updateState({ helpersExtruderConfig: extruderConfig })
        );
        const { modelGroup } = getState().printing;
        modelGroup.setHelpersExtruderConfig(extruderConfig);

        dispatch(actions.applyProfileToAllModels());

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
        modelGroup.getVisibleValidModels().forEach(model => {
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

        workerManager.arrangeModels(
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

    isMirrored: (model) => (dispatch, getState) => {
        const { targetTmpState } = getState().printing;

        const x = targetTmpState[model.modelID].from.scaleX
            * targetTmpState[model.modelID].to.scaleX;
        const y = targetTmpState[model.modelID].from.scaleY
            * targetTmpState[model.modelID].to.scaleY;
        const z = targetTmpState[model.modelID].from.scaleZ
            * targetTmpState[model.modelID].to.scaleZ;
        if (x / Math.abs(x) === -1) {
            return 'mirrorX';
        }
        if (y / Math.abs(y) === -1) {
            return 'mirrorY';
        }
        if (z / Math.abs(z) === -1) {
            return 'mirrorZ';
        }
        return '';
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
        let isMirror = false;
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
                case 'scale': {
                    const mirrorType = dispatch(actions.isMirrored(model));
                    if (mirrorType) {
                        isMirror = true;
                    }
                    operation = new ScaleOperation3D({
                        target: model,
                        ...targetTmpState[model.modelID]
                    });
                    break;
                }
                default:
                    break;
            }
            operations.push(operation);
        }

        if (transformMode === 'scale' && isMirror) {
            dispatch(actions.clearAllManualSupport(operations));
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
        workerManager.setClipperWorkerEnable(false);

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

    isModelsRepaired: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const selectedModels = modelGroup.getSelectedModelArray();
        const repaired = selectedModels.every((model) => {
            return !model.needRepair;
        });

        return new Promise(async (resolve) => {
            if (repaired) {
                resolve(true);
            } else {
                const { allPepaired } = await dispatch(actions.repairSelectedModels());
                resolve(allPepaired);
            }
        });
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
            parentUploadName = '',
            children,
            primeTowerTag,
            isGuideTours = false
        }
    ) => async (dispatch, getState) => {
        workerManager.stopClipper();
        const { progressStatesManager, modelGroup } = getState().printing;
        const { promptDamageModel } = getState().machine;
        const { size } = getState().machine;
        const models = [...modelGroup.models];
        const modelNames = files || [{ originalName, uploadName, isGroup, parentUploadName, modelID, children }];
        let _progress = 0;
        const promptTasks = [];

        const checkResultMap = new Map();
        const checkPromises = modelNames.filter((item) => {
            return !item.isGroup && ['.obj', '.stl'].includes(path.extname(item.uploadName)) && item.uploadName.indexOf('prime_tower_') !== 0;
        }).map(async (item) => {
            return controller.checkModel({
                uploadName: item.uploadName
            }, (data) => {
                if (data.type === 'error') {
                    checkResultMap.set(item.uploadName, {
                        isDamage: true
                    });
                } else if (data.type === 'success') {
                    checkResultMap.set(item.uploadName, {
                        isDamage: false
                    });
                }
            });
        });
        const promises = modelNames.map((model) => {
            if (model.parentUploadName) {
                dispatch(operationHistoryActions.excludeModelById(HEAD_PRINTING, model.modelID));
            }
            return new Promise(async (resolve, reject) => {
                _progress = modelNames.length === 1 ? 0.25 : 0.001;
                dispatch(
                    actions.updateState({
                        stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, _progress)
                    })
                );
                // if (!model.uploadName) {
                //     resolve();
                // }
                const uploadPath = `${DATA_PREFIX}/${model.uploadName}`;
                if (model.isGroup) {
                    modelGroup.generateModel({
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
                        geometry: null,
                        material: null,
                        transformation,
                        modelID: model.modelID,
                        extruderConfig,
                        isGroup: model.isGroup,
                        children: model.children,
                    }).then(() => {
                        const modelState = modelGroup.getState();
                        dispatch(actions.updateState(modelState));

                        dispatch(actions.displayModel());
                        dispatch(actions.destroyGcodeLine());
                        resolve();
                    });
                } else if (primeTowerTag) {
                    modelGroup.primeTower && modelGroup.primeTower.updateTowerTransformation(transformation);
                    resolve();
                } else {
                    const onMessage = async data => {
                        const { type } = data;
                        switch (type) {
                            case 'LOAD_MODEL_POSITIONS': {
                                let { positions, originalPosition } = data;
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

                                modelGroup.generateModel(
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
                                        modelID: model.modelID,
                                        extruderConfig,
                                        parentModelID,
                                        parentUploadName: model.parentUploadName
                                    }
                                ).then(() => {
                                    const modelState = modelGroup.getState();
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
                                }).catch(() => {
                                    promptTasks.push({
                                        status: 'load-model-fail',
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
                                });
                                positions = null;
                                originalPosition = null;
                                break;
                            }
                            case 'LOAD_MODEL_CONVEX': {
                                let { positions } = data;

                                const convexGeometry = new THREE.BufferGeometry();
                                const positionAttribute = new THREE.BufferAttribute(
                                    positions,
                                    3
                                );
                                convexGeometry.setAttribute(
                                    'position',
                                    positionAttribute
                                );

                                modelGroup.setConvexGeometry(
                                    model.uploadName,
                                    convexGeometry
                                );
                                positions = null;
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
                                    status: 'load-model-fail',
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
                            default:
                                break;
                        }
                    };
                    createLoadModelWorker(uploadPath, onMessage);
                }
            });
        });

        await Promise.allSettled(checkPromises);
        await Promise.allSettled(promises);

        const newModels = modelGroup.models.filter(model => {
            return !models.includes(model) && model;
        });
        modelGroup.groupsChildrenMap.forEach((subModels, group) => {
            if (subModels.every(id => id instanceof ThreeModel)) {
                modelGroup.unselectAllModels();
                group.meshObject.updateMatrixWorld();
                const groupMatrix = group.meshObject.matrixWorld.clone();
                const allSubmodelsId = subModels.map(d => d.modelID);
                const leftModels = modelGroup.models.filter((model) => {
                    return !(model instanceof ThreeModel && allSubmodelsId.includes(model.modelID));
                });
                group.add(subModels);
                const point = modelGroup._computeAvailableXY(group, leftModels);
                group.meshObject.position.x = point.x;
                group.meshObject.position.y = point.y;

                modelGroup.groupsChildrenMap.delete(group);
                modelGroup.models = [...leftModels, group];
                group.meshObject.applyMatrix4(groupMatrix);

                group.stickToPlate();
                group.computeBoundingBox();
                const overstepped = modelGroup._checkOverstepped(group);

                group.setOversteppedAndSelected(overstepped, group.isSelected);
                modelGroup.addModelToSelectedGroup(group);
            }
            modelGroup.emit(ModelEvents.AddModel, group);
        });
        modelGroup.childrenChanged();

        newModels.forEach((model) => {
            if (model instanceof ThreeModel) {
                modelGroup.initModelClipper(model);

                const checkResult = checkResultMap.get(model.uploadName);
                if (checkResult && checkResult.isDamage && !isGuideTours) {
                    promptDamageModel && promptTasks.push({
                        status: 'need-repair-model',
                        model
                    });
                    model.needRepair = true;
                } else {
                    model.needRepair = false;
                }
            } else {
                model.needRepair = false;
            }

            if (!model.parentUploadName) {
                const modelSize = new Vector3();
                model.boundingBox.getSize(modelSize);
                const isLarge = ['x', 'y', 'z'].some(key => modelSize[key] >= size[key]);
                if (isLarge) {
                    promptTasks.push({
                        status: 'needScaletoFit',
                        model
                    });
                }
            }
        });
        dispatch(actions.applyProfileToAllModels());
        modelGroup.models = modelGroup.models.concat();

        if (modelNames.length === 1 && newModels.length === 0) {
            if (!(modelNames[0]?.children?.length)) {
                progressStatesManager.finishProgress(false);
                dispatch(
                    actions.updateState({
                        modelGroup,
                        stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                        progress: 0,
                        promptTasks
                    })
                );
            }
        } else {
            dispatch(
                actions.updateState({
                    modelGroup,
                    stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                    progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1),
                    promptTasks
                })
            );
        }
        workerManager.continueClipper();
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
        modelGroup.calaClippingMap();
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
                .catch((err) => {
                    log.warn('err =', err);
                });
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
        modelGroup.calaClippingMap();

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

    applyProfileToAllModels: () => (dispatch) => {
        dispatch(sceneActions.applyPrintSettingsToModels());
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
                log.error('error =', err);
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
        const { size } = getState().machine;

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
        params.size = size;
        controller.generateSupport(params);
    },

    uploadModelsForSupport: (models, angle) => (dispatch, getState) => {
        const { qualityDefinitions, activePresetIds } = getState().printing;
        const activeQualityDefinition = find(qualityDefinitions, {
            definitionId: activePresetIds[LEFT_EXTRUDER],
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
                            () => {
                            },
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
                dispatch(sceneActions.render());
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
        dispatch(sceneActions.render());
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
        dispatch(sceneActions.render());
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
        dispatch(sceneActions.render());
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
    },

    applySupportBrush: raycastResult => (dispatch, getState) => {
        const { modelGroup, supportBrushStatus } = getState().printing;
        modelGroup.applySupportBrush(raycastResult, supportBrushStatus);
    },

    clearAllSupport: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.clearAllSupport();
        dispatch(sceneActions.render());
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
        dispatch(sceneActions.render());
    },

    modelSimplify: (simplifyType = 0, simplifyPercent = 80, isFirstTime = false) => async (dispatch, getState) => {
        dispatch(actions.updateState({
            enableShortcut: false,
            leftBarOverlayVisible: true,
            transformMode: 'simplify-model'
        }));
        const {
            progressStatesManager,
            modelGroup,
            activePresetIds,
            qualityDefinitions,
            simplifyOriginModelInfo,
        } = getState().printing;

        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_SIMPLIFY_MODEL);
        dispatch(actions.updateState({
            stage: STEP_STAGE.PRINTING_SIMPLIFY_MODEL,
            progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_SIMPLIFY_MODEL, 0.1),
            simplifyType,
            simplifyPercent
        }));
        const layerHeight = find(qualityDefinitions, { definitionId: activePresetIds[LEFT_EXTRUDER] })?.settings?.layer_height?.default_value;
        let transformation = {};
        const simplifyModel = modelGroup.selectedModelArray[0];
        let uploadResult = null;
        if (isFirstTime) {
            transformation = simplifyModel.transformation;
            const mesh = simplifyModel.meshObject.clone(false);
            mesh.clear();
            const basenameWithoutExt = path.basename(
                `${DATA_PREFIX}/${simplifyModel.originalName}`,
                path.extname(`${DATA_PREFIX}/${simplifyModel.originalName}`)
            );
            const sourceSimplifyName = `${basenameWithoutExt}.stl`;
            uploadResult = await uploadMesh(mesh, sourceSimplifyName, 'stl');
            mesh.applyMatrix4(simplifyModel.meshObject.parent.matrix);
            await dispatch(actions.updateState({
                simplifyOriginModelInfo: {
                    ...simplifyOriginModelInfo,
                    originModel: simplifyModel,
                    sourceSimplifyName: uploadResult.body.uploadName
                }
            }));
        }
        const params = {
            uploadName: simplifyOriginModelInfo.uploadName || simplifyModel.uploadName,
            sourceSimplify: uploadResult?.body?.uploadName || simplifyOriginModelInfo.sourceSimplifyName,
            modelID: simplifyModel?.modelID,
            simplifyType,
            simplifyPercent,
            isFirstTime,
            transformation: transformation,
            layerHeight: layerHeight,
        };
        workerManager.stopClipper();
        controller.simplifyModel(params);
    },

    recordSimplifyModel: () => (dispatch, getState) => {
        const { simplifyOriginModelInfo: { sourceSimplifyName, simplifyResultFimeName }, modelGroup } = getState().printing;
        const target = modelGroup.selectedModelArray[0];
        const operations = new Operations();
        const operation = new SimplifyModelOperation({
            target,
            sourceSimplify: sourceSimplifyName,
            dispatch: dispatch,
            simplifyResultFimeName: simplifyResultFimeName
        });
        operations.push(operation);
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations
            )
        );
    },

    resetSimplifyOriginModelInfo: () => (dispatch) => {
        dispatch(actions.updateState({
            simplifyOriginModelInfo: {},
            enableShortcut: true,
            leftBarOverlayVisible: false
        }));
    },

    /**
     * @param {*} modelInfos: { modelID:string, uploadName:string, reloadSimplifyModel?: bool }[]
     */
    updateModelMesh: (modelInfos, silentLoading = false) => async (dispatch, getState) => {
        const { modelGroup, progressStatesManager } = getState().printing;
        if (!silentLoading) {
            progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);
        }
        let _progress = 0;
        const promptTasks = [];
        const { recovery } = modelGroup.unselectAllModels();

        const promises = modelInfos.map((res) => {
            const uploadPath = `${DATA_PREFIX}/${res.uploadName}`;
            const model = modelGroup.findModelByID(res.modelID);
            model.uploadName = res.uploadName;
            // When repairing and simplifying, there must be no problem with the model
            model.needRepair = false;
            return new Promise((resolve, reject) => {
                const onMessage = async data => {
                    const { type } = data;
                    switch (type) {
                        case 'LOAD_MODEL_POSITIONS': {
                            const { positions } = data;

                            model.updateBufferGeometry(positions);

                            if (!silentLoading && modelInfos.length > 1) {
                                _progress += 1 / modelInfos.length;
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
                            modelGroup.setConvexGeometry(
                                model.uploadName,
                                convexGeometry
                            );

                            break;
                        }
                        case 'LOAD_MODEL_PROGRESS': {
                            if (modelInfos.length === 1) {
                                const state = getState().printing;
                                const progress = 0.25 + data.progress * 0.5;
                                if (!silentLoading && progress - state.progress > 0.01 || progress > 0.75 - EPSILON) {
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
                                status: 'load-model-fail',
                                originalName: model.originalName
                            });
                            if (!silentLoading && modelInfos.length > 1) {
                                _progress += 1 / modelInfos.length;
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
                        default:
                            break;
                    }
                };
                createLoadModelWorker(uploadPath, onMessage, res.reloadSimplifyModel);
            });
        });

        await Promise.allSettled(promises);
        modelGroup.models = modelGroup.models.concat();

        recovery();
        if (!silentLoading) {
            dispatch(actions.updateState({
                modelGroup,
                stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1),
                promptTasks
            }));
        }
        modelGroup.meshChanged();
        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.displayModel());
        dispatch(actions.destroyGcodeLine());
    },

    repairSelectedModels: () => async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);

        const { results, allPepaired } = await dispatch(appGlobalActions.repairSelectedModels(HEAD_PRINTING));

        await dispatch(actions.updateModelMesh(results, true));

        return { allPepaired };
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
