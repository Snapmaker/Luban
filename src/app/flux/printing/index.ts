import {
    applyParameterModifications,
    computeAdjacentFaces,
    Machine,
    PrintMode,
    resolveParameterValues,
} from '@snapmaker/luban-platform';
import { cloneDeep, filter, find, includes, isNil, noop } from 'lodash';
import path from 'path';
import { Transfer } from 'threads';
import * as THREE from 'three';
import { Box3, Vector3 } from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

import { timestamp } from '../../../shared/lib/random-utils';
import api from '../../api';
import {
    BLACK_COLOR, BOTH_EXTRUDER_MAP_NUMBER,
    DATA_PREFIX,
    EPSILON,
    EXTRUDER_REGEX,
    GCODE_VISIBILITY_TYPE,
    GCODEPREVIEWMODES,
    HEAD_PRINTING,
    KEY_DEFAULT_CATEGORY_CUSTOM,
    LEFT_EXTRUDER,
    LEFT_EXTRUDER_MAP_NUMBER,
    LOAD_MODEL_FROM_INNER,
    MATERIAL_REGEX,
    PRINTING_MANAGER_TYPE_EXTRUDER,
    PRINTING_MANAGER_TYPE_MATERIAL,
    PRINTING_MANAGER_TYPE_QUALITY,
    PRINTING_MATERIAL_CONFIG_GROUP_DUAL,
    PRINTING_MATERIAL_CONFIG_GROUP_SINGLE,
    PRINTING_QUALITY_CONFIG_GROUP_DUAL,
    PRINTING_QUALITY_CONFIG_GROUP_SINGLE,
    QUALITY_REGEX,
    RIGHT_EXTRUDER,
    RIGHT_EXTRUDER_MAP_NUMBER,
    WHITE_COLOR
} from '../../constants';
import { getMachineToolHeadConfigPath, isDualExtruder } from '../../constants/machines';
import { isQualityPresetVisible, PRESET_CATEGORY_CUSTOM } from '../../constants/preset';

import { controller } from '../../communication/socket-communication';
import { logPritingSlice, logProfileChange, logToolBarOperation, logTransformOperation } from '../../lib/gaEvent';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import ProgressStatesManager, { getProgressStateManagerInstance, PROCESS_STAGE, STEP_STAGE } from '../../lib/manager/ProgressManager';
import workerManager from '../../lib/manager/workerManager';

import CompoundOperation from '../../core/CompoundOperation';
import OperationHistory from '../../core/OperationHistory';
import { getCurrentHeadType } from '../../lib/url-utils';
import { ModelEvents } from '../../models/events';
import ModelGroup, { BrushType } from '../../models/ModelGroup';
import PrimeTowerModel from '../../models/PrimeTowerModel';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import { MaterialPresetModel, PresetModel, QualityPresetModel } from '../../preset-model';
import {
    AddOperation3D,
    AddSupportOperation3D,
    ArrangeOperation3D,
    DeleteOperation3D,
    DeleteSupportsOperation3D,
    MoveOperation3D,
    RotateOperation3D,
    ScaleOperation3D,
    ScaleToFitWithRotateOperation3D
} from '../../scene/operations';
import scene from '../../scene/Scene';
import ThreeUtils from '../../scene/three-extensions/ThreeUtils';
import { machineStore } from '../../store/local-storage';
import { pickAvailableQualityPresetModels } from '../../ui/utils/profileManager';
import ModelLoader from '../../ui/widgets/PrintingVisualizer/ModelLoader';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import type { RootState } from '../index.def';
import definitionManager from '../manager/DefinitionManager';
import baseActions from './actions-base';
import { LoadMeshFileOptions, loadMeshFiles, MeshFileInfo, MeshHelper } from './actions-mesh';
import sceneActions from './actions-scene';

// eslint-disable-next-line import/no-cycle
import { actions as appGlobalActions } from '../app-global';
// eslint-disable-next-line import/no-cycle
import { actions as operationHistoryActions } from '../operation-history';
// eslint-disable-next-line import/no-cycle
import SimplifyModelOperation from '../../scene/operations/SimplifyModelOperation';
import { SnapmakerArtisanMachine, SnapmakerOriginalExtendedMachine, SnapmakerOriginalMachine } from '../../machines';


let initEventFlag = false;
// register methods for three-mesh-bvh
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.BufferGeometry.prototype.computeAdjacentFaces = computeAdjacentFaces;

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
    if (series === SnapmakerOriginalExtendedMachine.identifier) {
        series = SnapmakerOriginalMachine.identifier;
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

    extruderLDefinition: null,
    extruderRDefinition: null,

    // Stage reflects current state of visualizer
    stage: STEP_STAGE.EMPTY,
    promptTasks: [],

    selectedModelIDArray: [],
    selectedModelArray: [],
    modelGroup: new ModelGroup(HEAD_PRINTING),

    // G-code
    gcodeFile: null,
    printTime: 0,
    filamentLength: [],
    filamentWeight: [],
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
    progressStatesManager: getProgressStateManagerInstance(),

    rotationAnalysisTable: [],
    rotationAnalysisSelectedRowId: -1,
    leftBarOverlayVisible: false,
    combinedOperations: [], // used for recording different operations

    enableShortcut: true,

    // helpers extruder config
    helpersExtruderConfig: {
        adhesion: LEFT_EXTRUDER_MAP_NUMBER,
        // support: LEFT_EXTRUDER_MAP_NUMBER,
        onlySupportInterface: false,
    },

    // see preset.ts TSupportExtruderConfig
    supportExtruderConfig: {
        support: '0',
        interface: '0',
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

    // brush
    brushType: BrushType.SmartFillBrush,
    brushStackId: LEFT_EXTRUDER, // LEFT_EXTRUDER | RIGHT_EXTRUDER
    tmpSupportFaceMarks: {},
    supportOverhangAngle: 50,
    supportBrushStatus: 'add', // add | remove

    // G-code
    gcodeEntity: {
        extruderLlineWidth0: 0,
        extruderLlineWidth: 0,
        extruderRlineWidth0: 0,
        extruderRlineWidth: 0,
        layerHeight0: 0,
        layerHeight: 0,
    },

    // simpify
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

let initPromise: Promise<void> = null;

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

    initSize: () => async (dispatch, getState) => {
        // also used in actions.saveAndClose of project/index.js
        // state
        const { modelGroup, gcodeLineGroup } = getState().printing;
        scene.setModelGroup(modelGroup);

        const { activeMachine, toolHead } = getState().machine;

        modelGroup.setDataChangedCallback(() => {
            dispatch(sceneActions.renderScene());
        });

        let { series } = getState().machine;
        series = getRealSeries(series);

        // model group
        dispatch(actions.updateBoundingBox());

        // Re-position model group
        const { size } = getState().machine;
        gcodeLineGroup.position.set(-size.x / 2, -size.y / 2, 0);

        // init definition manager
        const configPath = getMachineToolHeadConfigPath(activeMachine, toolHead.printingToolhead);
        await definitionManager.init(CONFIG_HEADTYPE, configPath);

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

        // Extruder assignment
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

        // Material
        const materialDefinitions = await definitionManager.getDefinitionsByPrefixName('material');
        const materialPresetModels = materialDefinitions.map((definition) => new MaterialPresetModel(definition));

        // Quality
        const qualityDefinitions = await definitionManager.getDefinitionsByPrefixName('quality');
        const qualityPresetModels = qualityDefinitions.map((definition) => new QualityPresetModel(definition));

        // Default Presets
        const defaultPresetModels = definitionManager?.defaultDefinitions.map((eachDefinition) => {
            if (MATERIAL_REGEX.test(eachDefinition.definitionId)) {
                return new MaterialPresetModel(eachDefinition);
            } else if (QUALITY_REGEX.test(eachDefinition.definitionId)) {
                return new QualityPresetModel(eachDefinition);
            } else if (EXTRUDER_REGEX.test(eachDefinition.definitionId)) {
                return new PresetModel(eachDefinition);
            } else {
                log.warn('Unknown definition', eachDefinition.definitionId);
                return new PresetModel(eachDefinition);
            }
        });

        dispatch(
            actions.updateState({
                defaultDefinitions: defaultPresetModels,
                materialDefinitions: materialPresetModels,
                qualityDefinitions: qualityPresetModels,
                printingProfileLevel: definitionManager.printingProfileLevel,
                materialProfileLevel: definitionManager.materialProfileLevel,
            })
        );

        // Create material on demand
        await dispatch(actions.ensurePresetModels());

        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.updateBoundingBox());
    },

    /**
     * Ensure preset model for active machine and tool configuration.
     */
    ensurePresetModels: () => async (dispatch, getState) => {
        const {
            extruderLDefinition,
            extruderRDefinition,

            materialDefinitions,
            defaultMaterialId,
            defaultMaterialIdRight,

            qualityDefinitions,
        } = getState().printing;

        for (const stackId of [LEFT_EXTRUDER, RIGHT_EXTRUDER]) {
            const materialPresetId = stackId === LEFT_EXTRUDER ? defaultMaterialId : defaultMaterialIdRight;
            const materialPreset = materialDefinitions.find(p => p.definitionId === materialPresetId);

            if (!materialPreset) {
                continue;
            }

            const nozzleSize = stackId === LEFT_EXTRUDER
                ? extruderLDefinition?.settings.machine_nozzle_size.default_value
                : extruderRDefinition?.settings.machine_nozzle_size.default_value;

            const presetFilters = {
                materialType: materialPreset?.materialType,
                nozzleSize,
            };

            const availablePresetModels = pickAvailableQualityPresetModels(qualityDefinitions, presetFilters);

            if (availablePresetModels.length === 0) {
                log.warn(`No available quality preset for extruder ${stackId}`);

                const normalPresetModel = qualityDefinitions.find(p => p.definitionId === 'quality.normal_quality');
                if (!normalPresetModel) {
                    continue;
                }

                const newDefinitionId = `quality.${timestamp()}`;

                const newQualityType = (() => {
                    if (includes(['pla', 'abs', 'petg'], materialPreset?.materialType)) {
                        return 'abs';
                    }

                    if (includes(['tpu'], materialPreset?.materialType)) {
                        return 'tpu';
                    }

                    return 'other';
                })();

                const newDefinition = {
                    definitionId: newDefinitionId,
                    name: `${normalPresetModel.name} (${nozzleSize})`,
                    inherits: normalPresetModel.inherits,
                    category: normalPresetModel.category || PRESET_CATEGORY_CUSTOM,
                    ownKeys: [...normalPresetModel.ownKeys],
                    metadata: {
                        ...normalPresetModel.metadata,
                        readonly: false,
                    },
                    settings: normalPresetModel.settings,
                    typeOfPrinting: normalPresetModel.typeOfPrinting,
                    qualityType: newQualityType,
                };

                for (const key of normalPresetModel.ownKeys) {
                    newDefinition.settings[key] = {
                        default_value: normalPresetModel.settings[key].default_value,
                    };
                }
                newDefinition.ownKeys.push('machine_nozzle_size');
                newDefinition.settings.machine_nozzle_size = {
                    default_value: nozzleSize,
                };

                const createdDefinition = await definitionManager.createDefinition(newDefinition);
                const newPresetModel = new QualityPresetModel(createdDefinition);

                // change and resolve
                dispatch(actions.updateCurrentDefinition({
                    definitionModel: newPresetModel,
                    managerDisplayType: PRINTING_MANAGER_TYPE_QUALITY,
                    direction: LEFT_EXTRUDER,
                    changedSettingArray: [
                        ['machine_nozzle_size', nozzleSize],
                        ['layer_height', nozzleSize / 2],
                        ['speed_print', 40],
                    ],
                }));

                await dispatch(
                    actions.updateState({
                        qualityDefinitions: [...qualityDefinitions, newPresetModel],
                    })
                );
            }
        }
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
        const modules = getState().machine.modules as string[];

        const modelGroup: ModelGroup = getState().printing.modelGroup;
        const {
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

        const activeMachine: Machine = getState().machine.activeMachine;
        const { size } = getState().machine;

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

        // Check work range offsets from machine modules
        for (const machineModuleOptions of activeMachine.metadata?.modules || []) {
            const identifier = machineModuleOptions.identifier;
            if (modules.indexOf(identifier) >= 0) {
                if (machineModuleOptions?.workRangeOffset) {
                    workRange.min.x += machineModuleOptions.workRangeOffset[0];
                    workRange.min.y += machineModuleOptions.workRangeOffset[1];
                    workRange.min.z += machineModuleOptions.workRangeOffset[2];
                    workRange.max.x += machineModuleOptions.workRangeOffset[0];
                    workRange.max.y += machineModuleOptions.workRangeOffset[1];
                    workRange.max.z += machineModuleOptions.workRangeOffset[2];
                }
            }
        }

        // validate work range in case it goes off zero
        workRange.min.x = Math.max(workRange.min.x, 0);
        workRange.min.y = Math.max(workRange.min.y, 0);
        workRange.min.z = Math.max(workRange.min.z, 0);

        // Get border from adhesion
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

        // Hard-coded logic for Artisan (work range optimization)
        if (activeMachine && activeMachine.identifier === SnapmakerArtisanMachine.identifier) {
            // Check only single extruder used
            const checkLeftExtruder = (extruderNumber: string) => {
                return extruderNumber === LEFT_EXTRUDER_MAP_NUMBER || extruderNumber === BOTH_EXTRUDER_MAP_NUMBER;
            };

            const models = modelGroup.getModels<ThreeModel>();
            let useLeftExtruder = false;
            for (const model of models) {
                if (model.isColored) {
                    useLeftExtruder = true;
                    break;
                }

                if (checkLeftExtruder(model.extruderConfig.infill) || checkLeftExtruder(model.extruderConfig.shell)) {
                    useLeftExtruder = true;
                    break;
                }
            }

            // adhesion
            const adhesionEnabled = includes(['skirt', 'brim', 'raft'], adhesionType);
            if (!useLeftExtruder && adhesionEnabled) {
                const helperExtruderConfig = modelGroup.getHelpersExtruderConfig();
                useLeftExtruder ||= checkLeftExtruder(helperExtruderConfig.adhesion);
            }

            // support
            const supportEnabled = activeQualityDefinition?.settings.support_enable?.default_value || false;
            if (!useLeftExtruder && supportEnabled) {
                const supportExtruderConfig = modelGroup.getSupportExtruderConfig();
                useLeftExtruder ||= checkLeftExtruder(supportExtruderConfig.support);
                useLeftExtruder ||= checkLeftExtruder(supportExtruderConfig.interface);
            }

            if (useLeftExtruder) {
                // If use left extruder, then right most 25 mm is unreachable
                workRange.max.x -= 25;
            }
        }

        // calculate bounding box
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

        // Update bounding box
        const modelState = modelGroup.updateBoundingBox(boundingBox);
        dispatch(actions.updateState(modelState));

        // Update stop area
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
                const progressStatesManager = getState().printing.progressStatesManager as ProgressStatesManager;
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
                const progressStatesManager = getState().printing.progressStatesManager as ProgressStatesManager;

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

                modelGroup.unselectAllModels();
                dispatch(actions.loadGcode(gcodeFilename));
                dispatch(actions.setTransformMode(''));
            });
            controller.on('slice:progress', progress => {
                const state = getState().printing;
                const progressStatesManager = getState().printing.progressStatesManager as ProgressStatesManager;

                if (progress - state.progress > 0.01 || progress > 1 - EPSILON) {
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
        await dispatch(actions.initPrintConfig());

        const printingState = getState().printing;
        const { modelGroup } = printingState;
        const { series } = getState().machine;
        modelGroup.setSeries(series);

        modelGroup.removeAllModels();

        dispatch(actions.initSocketEvent());
        dispatch(actions.applyProfileToAllModels());
    },

    initPrintConfig: () => {
        return async (dispatch) => {
            // Ensure only one action is initializing print config
            if (initPromise) {
                return initPromise;
            }

            // Start init
            initPromise = dispatch(actions.initSize());
            initPromise
                .then(() => {
                    initPromise = null;
                });

            return initPromise;
        };
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
                        extruderColors,
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

                const progressStatesManager = getState().printing.progressStatesManager as ProgressStatesManager;
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
                dispatch(actions.logGenerateGcode());
                break;
            }
            case 'progress': {
                const state = getState().printing;
                const progressStatesManager = getState().printing.progressStatesManager as ProgressStatesManager;
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

    resetDefinitionById: (type, definitionId, shouldDestroyGcodeLine = false) => (
        dispatch,
        getState
    ) => {
        const definitionsKey = defaultDefinitionKeys[type].definitions;
        const state = getState().printing;
        const defaultDefinitions = state.defaultDefinitions;
        const definitions = state[definitionsKey];

        if (type === PRINTING_MANAGER_TYPE_QUALITY) {
            const presetModel = definitions.find(p => p.definitionId === definitionId);
            const defaultPresetModel = defaultDefinitions.find((d) => d.definitionId === definitionId);
            if (!presetModel || !defaultPresetModel) {
                return null;
            }

            const keys = Object.keys(defaultPresetModel.settings);
            for (const key of keys) {
                presetModel.settings[key].default_value = defaultPresetModel.settings[key].default_value;
            }
            definitionManager.updateDefinition(presetModel);

            dispatch(actions.updateBoundingBox());
            if (shouldDestroyGcodeLine) {
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.displayModel());
            }

            return null;
        } else if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            // Refactor: Unify this with quality after ProfileManager refactored
            const presetModel = definitions.find(p => p.definitionId === definitionId);
            const defaultPresetModel = defaultDefinitions.find((d) => d.definitionId === definitionId);
            if (!presetModel || !defaultPresetModel) {
                return null;
            }

            const keys = Object.keys(defaultPresetModel.settings);
            for (const key of keys) {
                presetModel.settings[key].default_value = defaultPresetModel.settings[key].default_value;
            }
            definitionManager.updateDefinition(presetModel);

            dispatch(actions.updateBoundingBox());
            if (shouldDestroyGcodeLine) {
                dispatch(actions.destroyGcodeLine());
                dispatch(actions.displayModel());
            }

            return presetModel;
        } else {
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
        }
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
            direction = LEFT_EXTRUDER,
        }
    ) => async (dispatch, getState) => {
        const { materialDefinitions, qualityDefinitions, extruderLDefinition, extruderRDefinition } = getState().printing;
        const machineDefinition = definitionManager.machineDefinition;

        // make change on extruder preset
        const definitionModel = direction === LEFT_EXTRUDER ? extruderLDefinition : extruderRDefinition;
        if (definitionModel.settings[paramKey]) {
            definitionModel.settings[paramKey].default_value = paramValue;
        }
        definitionManager.updateDefinition(definitionModel);

        // make change on machine definition
        if (machineDefinition.settings[paramKey]) {
            machineDefinition.settings[paramKey].default_value = paramValue;
        }

        // Resolve all material and quality presets
        const {
            newMaterialDefinitions,
            newQualityDefinitions,
        } = await definitionManager.updateMachineDefinition({
            machineDefinition,
            materialDefinitions,
            qualityDefinitions,
        });

        dispatch(actions.updateState({
            qualityDefinitions: newQualityDefinitions,
            materialDefinitions: newMaterialDefinitions,
        }));

        // Create material on demand
        await dispatch(actions.ensurePresetModels());

        // TODO
        dispatch(actions.validateActiveQualityPreset(direction));

        setTimeout(() => {
            dispatch(actions.applyProfileToAllModels());
        });
    },

    updateCurrentDefinition: (
        {
            definitionModel,
            managerDisplayType: type,
            changedSettingArray = [],
            direction = LEFT_EXTRUDER,
        }
    ) => async (dispatch, getState) => {
        const printingState = getState().printing;
        // const { qualityDefinitions } = printingState;

        // TODO: Refactor this
        const definitionsKey = definitionKeysWithDirection[direction][type];

        // extruder definition
        if (type === PRINTING_MANAGER_TYPE_EXTRUDER) {
            applyParameterModifications(definitionModel, changedSettingArray);

            dispatch(
                actions.updateState({
                    [definitionsKey]: definitionModel
                })
            );
        } else {
            resolveParameterValues(definitionModel, changedSettingArray);

            const definitions = printingState[definitionsKey];
            if (!definitions) {
                log.warn(`definitions for ${definitionsKey} is empty.`);
                return;
            }

            dispatch(
                actions.updateState({
                    [definitionsKey]: [...definitions]
                })
            );

            dispatch(actions.updateBoundingBox());
        }

        await definitionManager.updateDefinition(definitionModel);

        dispatch(actions.validateActiveQualityPreset(direction));
        // dispatch(actions.updateState({ qualityDefinitions: [...qualityDefinitions] }));

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

        dispatch(actions.applyProfileToAllModels());
        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
    },

    updateDefinition: ({ managerDisplayType, definitionModel, changedSettingArray }) => (dispatch) => {
        dispatch(actions.updateCurrentDefinition({
            managerDisplayType,
            definitionModel,
            changedSettingArray,
        }));
    },

    onUploadManagerDefinition: (file, type) => async (dispatch, getState) => {
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
                    definition = new PresetModel(
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
                    log.error('err', err);
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
        newDefinitionId = '',
        newDefinitionName = '',
    ) => async (dispatch, getState) => {
        const state = getState().printing;

        // preset id
        let definitionId;
        if (newDefinitionId) {
            definitionId = newDefinitionId;
        } else {
            definitionId = `${type}.${timestamp()}`;
        }

        // preset name
        let name = newDefinitionName || definition.name;
        if (
            type === PRINTING_MANAGER_TYPE_QUALITY
            && isDefaultQualityDefinition(definition.definitionId)
        ) {
            const machine = getState().machine;
            name = `${machine.series}-${name}`;
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
        const createdDefinitionModel = await definitionManager.createDefinition(newDefinition);

        // TODO: Refactor this
        if (type === PRINTING_MANAGER_TYPE_QUALITY) {
            const newPresetModel = new QualityPresetModel(createdDefinitionModel);
            dispatch(
                actions.updateState({
                    [definitionsKey]: [...state[definitionsKey], newPresetModel]
                })
            );
            return newPresetModel;
        } else if (type === PRINTING_MANAGER_TYPE_MATERIAL) {
            const newPresetModel = new MaterialPresetModel(createdDefinitionModel);
            dispatch(
                actions.updateState({
                    [definitionsKey]: [...state[definitionsKey], newPresetModel]
                })
            );
            return newPresetModel;
        } else {
            const newPresetModel = new PresetModel(createdDefinitionModel);
            dispatch(
                actions.updateState({
                    [definitionsKey]: [...state[definitionsKey], newPresetModel]
                })
            );
            return newPresetModel;
        }
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

        for (let i = 0; i < definitionModelsWithSameCategory.length; i++) {
            const newDefinition = definitionModelsWithSameCategory[i];
            newDefinition.category = newCategoryName;
            newDefinition.i18nCategory = '';
            const definitionId = `${newDefinition.definitionId}${timestamp()}`;
            newDefinition.definitionId = definitionId;
            const createdDefinition = await definitionManager.createDefinition(
                newDefinition
            );
            const createdDefinitionModel = new MaterialPresetModel(createdDefinition);
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
                        PRINTING_MANAGER_TYPE_MATERIAL,
                        defintions[0].definitionId,
                        LEFT_EXTRUDER
                    )
                );
            }
            if (defaultMaterialIdRight === definition.definitionId) {
                dispatch(
                    actions.updateDefaultIdByType(
                        PRINTING_MANAGER_TYPE_MATERIAL,
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
        dispatch(actions.updateSavedPresetIds(PRINTING_MANAGER_TYPE_MATERIAL, materialId, stackId));

        if (stackId === LEFT_EXTRUDER) {
            dispatch(actions.updateState({
                defaultMaterialId: materialId,
            }));
        } else {
            dispatch(actions.updateState({
                defaultMaterialIdRight: materialId,
            }));
        }
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
        dispatch(actions.updateBoundingBox());
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
        const {
            extruderLDefinition,
            extruderRDefinition,

            qualityDefinitions,
            activePresetIds,
        } = getState().printing;

        const materialType = dispatch(actions.getActiveMaterialType(undefined, stackId));

        const presetModel = qualityDefinitions.find(p => p.definitionId === activePresetIds[stackId]);

        const nozzleSize = stackId === LEFT_EXTRUDER
            ? extruderLDefinition?.settings.machine_nozzle_size.default_value
            : extruderRDefinition?.settings.machine_nozzle_size.default_value;

        const presetFilters = {
            materialType: materialType,
            nozzleSize,
        };

        // TODO: Consider nozzle size
        // machineNozzleSize: actualExtruderDefinition.settings?.machine_nozzle_size?.default_value,
        if (presetModel && isQualityPresetVisible(presetModel, presetFilters)) {
            // the quality preset looks fine
            return;
        }

        // find a new quality preset for active material type
        for (const presetModel2 of qualityDefinitions) {
            const visible = isQualityPresetVisible(presetModel2, presetFilters);
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
    __loadModel: (meshFileInfos) => async (dispatch) => {
        const headType = 'printing';
        const sourceType = '3d';
        const mode = '3d';
        const width = 0;
        const height = 0;

        await dispatch(
            actions.generateModel(headType, {
                files: meshFileInfos,
                sourceType,
                sourceWidth: width,
                sourceHeight: height,
                mode,
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

        // Upload mesh files
        const ps = Array.from(files).map(async (file) => {
            // Notice user that model is being loading
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.uploadFile(formData, HEAD_PRINTING);
            const { originalName, uploadName, children = [] } = res.body;
            return { originalName, uploadName, children };
        });
        const promiseResults = await Promise.allSettled(ps);
        const meshFileInfos = promiseResults.map((promiseTask, index) => {
            if (promiseTask.status === 'fulfilled') {
                return promiseTask.value;
            } else {
                return {
                    originalName: files[index]?.name,
                };
            }
        });
        const allChild = [];
        meshFileInfos.forEach((item) => {
            if (item.children) {
                if (item.children.length) {
                    item.isGroup = true;
                }
                allChild.push(...item.children);
            }
        });
        if (allChild.length) {
            allChild.push(...meshFileInfos);
            actions.__loadModel(allChild)(dispatch);
        } else {
            actions.__loadModel(meshFileInfos)(dispatch);
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

            if (meshObject) {
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
            }
        });
    },

    generateGcode: (thumbnail, isGuideTours = false) => async (dispatch, getState) => {
        workerManager.setClipperWorkerEnable(false);

        const {
            printMode,
            modelGroup,
            progressStatesManager,
            helpersExtruderConfig,
            supportExtruderConfig,
            layerCount,
            extruderLDefinition,
            extruderRDefinition,
            activePresetIds,
            defaultMaterialId,
            defaultMaterialIdRight,
            qualityDefinitions,
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

        if (!models || models.length === 0) {
            log.warn('No model(s) to be sliced.');
            return;
        }
        // update extruder definitions
        const qualityPresets = {
            [LEFT_EXTRUDER]: qualityDefinitions.find(p => p.definitionId === activePresetIds[LEFT_EXTRUDER]),
            [RIGHT_EXTRUDER]: qualityDefinitions.find(p => p.definitionId === activePresetIds[RIGHT_EXTRUDER]),
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
            newExtruderLDefinition.definitionId = 'snapmaker_extruder_0';
            await definitionManager.updateDefinition(newExtruderLDefinition);

            dispatch(actions.updateState({
                extruderLDefinition: newExtruderLDefinition,
            }));
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

            dispatch(actions.updateState({
                extruderRDefinition: newExtruderRDefinition,
            }));
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
            helpersExtruderConfig,
            supportExtruderConfig,
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
                extruderLlineWidth0: qualityPresets[LEFT_EXTRUDER].settings.wall_line_width_0.default_value,
                extruderLlineWidth: qualityPresets[LEFT_EXTRUDER].settings.wall_line_width_x.default_value,
                extruderRlineWidth0: qualityPresets[RIGHT_EXTRUDER]?.settings.wall_line_width_0.default_value || 0.4,
                extruderRlineWidth: qualityPresets[RIGHT_EXTRUDER]?.settings.wall_line_width_x.default_value || 0.4,
                layerHeight0: finalDefinition.settings.layer_height_0.default_value,
                layerHeight: finalDefinition.settings.layer_height.default_value,
            }
        }));

        const boundingBox = modelGroup.getBoundingBox();

        const originOffsetX = activeMachine.metadata.size.x / 2;
        const originOffsetY = activeMachine.metadata.size.y / 2;

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

    prepareModel: () => async (dispatch, getState) => {
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
                    const uploadResult = await MeshHelper.uploadMesh(mesh, stlFileName);

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
                        const supportUploadResult = await MeshHelper.uploadMesh(
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
        newUniformScalingState = undefined,
        isAllRotate = undefined,
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

    unselectAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.unselectAllModels();
        dispatch(actions.render());
    },
    removeSelectedModel: () => (dispatch, getState) => {
        const { inProgress } = getState().printing;
        if (inProgress) {
            return;
        }

        const { modelGroup } = getState().printing;
        const operations = new CompoundOperation();
        const selectedModelArray = modelGroup.selectedModelArray.concat();
        const { recovery } = modelGroup.unselectAllModels();
        for (const model of selectedModelArray) {
            const operation = new DeleteOperation3D({
                target: model,
                dispatch
            });
            operations.push(operation);
        }
        operations.registerCallbackAll(() => {
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
        const operations = new CompoundOperation();
        for (const model of modelGroup.models) {
            const operation = new DeleteOperation3D({
                target: model,
                parent: null
            });
            operations.push(operation);
        }
        operations.registerCallbackAll(() => {
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
        const helpersExtruderConfig = getState().printing.helpersExtruderConfig;

        const newHelpersExtruderConfig = {
            ...helpersExtruderConfig,
            ...extruderConfig,
        };

        dispatch(actions.updateState({ helpersExtruderConfig: newHelpersExtruderConfig }));

        const { modelGroup } = getState().printing;
        modelGroup.setHelpersExtruderConfig(newHelpersExtruderConfig);

        dispatch(actions.applyProfileToAllModels());

        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateBoundingBox());
    },

    updateSupportExtruderConfig: (extruderConfig) => (dispatch, getState) => {
        const supportExtruderConfig = getState().printing.supportExtruderConfig;

        const newSupportExtruderConfig = {
            ...supportExtruderConfig,
            ...extruderConfig,
        };

        dispatch(actions.updateState({ supportExtruderConfig: newSupportExtruderConfig }));

        const { modelGroup } = getState().printing;
        modelGroup.setSupportExtruderConfig(newSupportExtruderConfig);

        dispatch(actions.applyProfileToAllModels());

        dispatch(actions.destroyGcodeLine());
        dispatch(actions.displayModel());
        dispatch(actions.updateBoundingBox());
    },

    arrangeAllModels: (angle = 45, offset = 1, padding = 0) => (
        dispatch,
        getState
    ) => {
        const operations = new CompoundOperation();
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
                        operations.registerCallbackAll(() => {
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
            operations = new CompoundOperation();
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

        operations.registerCallbackAll(() => {
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

    cut: () => (dispatch, getState) => {
        const { inProgress } = getState().printing;
        if (inProgress) {
            return;
        }

        dispatch(actions.copy());
        dispatch(actions.removeSelectedModel());
    },

    copy: () => (dispatch, getState) => {
        const { inProgress } = getState().printing;
        if (inProgress) {
            return;
        }

        const { modelGroup } = getState().printing;
        modelGroup.copy();
        dispatch(actions.render());
    },

    paste: () => (dispatch, getState) => {
        const { inProgress } = getState().printing;
        if (inProgress) {
            return;
        }

        const { modelGroup } = getState().printing;
        const modelState = modelGroup.paste();

        const operations = new CompoundOperation();
        for (const model of modelGroup.getSelectedModelArray()) {
            const operation = new AddOperation3D({
                target: model,
                parent: null,
            });
            operations.push(operation);
        }
        operations.registerCallbackAll(() => {
            dispatch(actions.updateState(modelGroup.getState()));
            dispatch(actions.applyProfileToAllModels());
            dispatch(actions.destroyGcodeLine());
            dispatch(actions.displayModel());
        });
        dispatch(
            operationHistoryActions.setOperations(
                INITIAL_STATE.name,
                operations,
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
        const operations = new CompoundOperation();
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
                        const operations = new CompoundOperation();
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
                        operations.registerCallbackAll(() => {
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

    /**
     * Undo operations.
     */
    undo: () => {
        return (dispatch, getState) => {
            const { inProgress } = getState().printing;
            if (inProgress) {
                return;
            }

            const { history } = getState().printing;
            const { canUndo } = history;
            if (!canUndo) {
                return;
            }

            dispatch(sceneActions.discardPreview({ render: false }));

            logToolBarOperation(HEAD_PRINTING, 'undo');
            dispatch(operationHistoryActions.undo(INITIAL_STATE.name));
            // dispatch(actions.destroyGcodeLine());
            // dispatch(actions.displayModel());
            dispatch(sceneActions.renderScene());
        };
    },

    /**
     * Redo operations.
     */
    redo: () => {
        return (dispatch, getState) => {
            const { inProgress } = getState().printing;
            if (inProgress) {
                return;
            }

            const { history } = getState().printing;
            const { canRedo } = history;
            if (!canRedo) {
                return;
            }

            dispatch(sceneActions.discardPreview({ render: false }));

            logToolBarOperation(HEAD_PRINTING, 'redo');
            dispatch(operationHistoryActions.redo(INITIAL_STATE.name));
            // dispatch(actions.destroyGcodeLine());
            // dispatch(actions.displayModel());
            dispatch(actions.render());
        };
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

    loadGcode: (gcodeFilename) => (dispatch, getState) => {
        const { progressStatesManager, extruderLDefinition, extruderRDefinition } = getState().printing;

        // slice finished, start preview
        progressStatesManager.startNextStep();
        dispatch(
            actions.updateState({
                stage: STEP_STAGE.PRINTING_PREVIEWING,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_PREVIEWING, 0)
            })
        );

        // Load G-code and render
        const extruderColors = {
            toolColor0:
                extruderLDefinition?.settings?.color?.default_value
                || WHITE_COLOR,
            toolColor1:
                extruderRDefinition?.settings?.color?.default_value
                || BLACK_COLOR
        };

        workerManager.gcodeToBufferGeometry({ func: '3DP', gcodeFilename, extruderColors }, (data) => {
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
            let operations = new CompoundOperation();
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

    isModelsRepaired: () => async (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        const selectedModels = modelGroup.getSelectedModelArray();
        const repaired = selectedModels.every((model) => {
            return !model.needRepair;
        });

        if (repaired) {
            return true;
        } else {
            const { allPepaired } = await dispatch(actions.repairSelectedModels());
            return allPepaired;
        }
    },

    // TODO: define types for function signature
    generateModel: (
        headType,
        {
            // information directly from mesh file
            files,
            originalName,
            uploadName,
            children,

            // additional information for model
            loadFrom = LOAD_MODEL_FROM_INNER,
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
            primeTowerTag,
            isGuideTours = false
        }
    ) => async (dispatch, getState) => {
        workerManager.stopClipper();

        const progressStatesManager = getState().printing.progressStatesManager as ProgressStatesManager;
        const { modelGroup } = getState().printing;
        const { promptDamageModel } = getState().machine;

        const models = [...modelGroup.models];
        const meshFileInfos: MeshFileInfo[] = files || [{ originalName, uploadName, isGroup, parentUploadName, modelID, children }];
        // let _progress = 0;

        const loadMeshFileOptions: LoadMeshFileOptions = {
            headType,

            loadFrom: loadFrom as (0 | 1), // type inferred as number
            mode,

            sourceType,
            sourceWidth,
            sourceHeight,

            transformation,

            parentModelID,
            primeTowerTag,
            extruderConfig,

            onProgress: (progress) => {
                dispatch(
                    baseActions.updateState({
                        stage: STEP_STAGE.PRINTING_LOADING_MODEL,
                        progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, progress),
                    })
                );
            },
        };


        const loadMeshResult = await loadMeshFiles(meshFileInfos, modelGroup, loadMeshFileOptions);
        const { promptTasks } = loadMeshResult;

        // on mesh file loaded, update state
        const modelState = modelGroup.getState();
        dispatch(actions.updateState(modelState));

        dispatch(actions.displayModel());
        dispatch(actions.destroyGcodeLine());
        // await Promise.allSettled(promises);

        const checkResultMap = await MeshHelper.checkMeshes(meshFileInfos);

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

        // Append repair information
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
        });

        // Append scale to fit prompt
        const { activeMachine } = getState().machine;
        const size = activeMachine.metadata.size;
        newModels.forEach((model) => {
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

        // Done, update progress and prompt tasks
        dispatch(
            actions.updateState({
                modelGroup,
                stage: STEP_STAGE.PRINTING_LOAD_MODEL_COMPLETE,
                progress: progressStatesManager.updateProgress(STEP_STAGE.PRINTING_LOADING_MODEL, 1),
                promptTasks,
            })
        );

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
            const operations = new CompoundOperation();
            operations.push(operation);
            operations.registerCallbackAll(() => {
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
        const operations = new CompoundOperation();
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

    loadSupports: (supportFilePaths) => {
        return (dispatch, getState) => {
            const { modelGroup, tmpSupportFaceMarks } = getState().printing;
            // use worker to load supports
            const operations = new CompoundOperation();
            const promises = supportFilePaths.map(async (info) => {
                return new Promise((resolve, reject) => {
                    const model = modelGroup.findModelByID(info.modelID);
                    const previousFaceMarks = tmpSupportFaceMarks[info.modelID];
                    if (model) {
                        const operation = new AddSupportOperation3D({
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
                                    resolve(true);
                                },
                                noop,
                                (err) => {
                                    reject(err);
                                }
                            );
                        } else {
                            resolve(true);
                        }
                    } else {
                        resolve(true);
                    }
                });
            });
            Promise.all(promises)
                .then(() => {
                    dispatch(operationHistoryActions.setOperations(INITIAL_STATE.name, operations));
                    dispatch(sceneActions.renderScene());
                    dispatch(
                        actions.updateState({
                            tmpSupportFaceMarks: {}
                        })
                    );
                })
                .catch(log.error);
        };
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
            let operations = new CompoundOperation();
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

    clearAllSupport: () => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.clearAllSupport();
        dispatch(sceneActions.renderScene());
    },

    updateClippingPlane: (height) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;
        modelGroup.updateClippingPlane(height);
        dispatch(sceneActions.renderScene());
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
            uploadResult = await MeshHelper.uploadMesh(mesh, sourceSimplifyName);
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
        const operations = new CompoundOperation();
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

        const promises = modelInfos.map(async (res) => {
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
                            resolve(true);
                            break;
                        }
                        case 'LOAD_MODEL_CONVEX': {
                            const { positions } = data;

                            const convexGeometry = new THREE.BufferGeometry();
                            const positionAttribute = new THREE.BufferAttribute(positions, 3);
                            convexGeometry.setAttribute('position', positionAttribute);

                            modelGroup.setConvexGeometry(model.uploadName, convexGeometry);

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

    /**
     * Repair selected models.
     */
    repairSelectedModels: () => async (dispatch, getState) => {
        const { progressStatesManager } = getState().printing;
        progressStatesManager.startProgress(PROCESS_STAGE.PRINTING_LOAD_MODEL);

        const { results, allPepaired } = await dispatch(appGlobalActions.repairSelectedModels(HEAD_PRINTING));

        await dispatch(actions.updateModelMesh(results, true));

        return { allPepaired };
    },

    isShortcutActive: () => (dispatch, getState: () => RootState) => {
        const { enableShortcut } = getState().printing;
        const { currentModalPath } = getState().appbarMenu;

        const headType = getCurrentHeadType(window.location.href);
        return enableShortcut && !currentModalPath && headType === HEAD_PRINTING;
    },
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
