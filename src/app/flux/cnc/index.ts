import { cloneDeep, noop } from 'lodash';

import { timestamp } from '../../../shared/lib/random-utils';
import {
    COORDINATE_MODE_BOTTOM_CENTER,
    COORDINATE_MODE_CENTER,
    DISPLAYED_TYPE_MODEL,
    HEAD_CNC,
    PAGE_EDITOR,
} from '../../constants';
import {
    Origin,
    OriginType,
    RectangleWorkpieceReference,
    Workpiece,
    WorkpieceShape,
} from '../../constants/coordinate';
import { getMachineToolHeadConfigPath } from '../../constants/machines';
import OperationHistory from '../../core/OperationHistory';
import i18n from '../../lib/i18n';
import { STEP_STAGE, getProgressStateManagerInstance } from '../../lib/manager/ProgressManager';
import ModelGroup2D from '../../models/ModelGroup2D';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import ToolPathGroup from '../../toolpaths/ToolPathGroup';
import {
    ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { actions as editorActions } from '../editor';
import { actions as machineActions } from '../machine';
import definitionManager from '../manager/DefinitionManager';

// eslint-disable-next-line import/no-cycle
const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';

const initModelGroup = new ModelGroup2D('cnc');
const operationHistory = new OperationHistory();

const initialWorkpiece: Workpiece = {
    shape: WorkpieceShape.Rectangle,
    size: {
        x: 0,
        y: 0,
        z: 0,
    }
};

const initialOrigin: Origin = {
    type: OriginType.Workpiece,
    reference: RectangleWorkpieceReference.Center,
    referenceMetadata: {},
};

const INITIAL_STATE = {
    materials: {
        isRotate: false,
        diameter: 35,
        length: 70,
        fixtureLength: 20,
        x: 0,
        y: 0,
        z: 0,
    },

    // Coordinate
    coordinateMode: COORDINATE_MODE_CENTER,
    coordinateSize: { x: 0, y: 0 },
    workpiece: initialWorkpiece,
    origin: initialOrigin,
    lockingBlockPosition: 'A',

    page: PAGE_EDITOR,

    stage: STEP_STAGE.EMPTY,
    progress: 0,
    inProgress: false,
    scale: 1,
    target: null,

    modelGroup: initModelGroup,

    displayedType: DISPLAYED_TYPE_MODEL,
    toolPathGroup: new ToolPathGroup(initModelGroup, 'cnc'),
    showToolPath: false,
    showSimulation: false,
    simulationNeedToPreview: true,

    SVGActions: new SVGActionsFactory(initModelGroup),
    SVGCanvasMode: 'select',
    SVGCanvasExt: {
        extShape: '',
        showExtShape: false,
        elem: null
    },

    isGcodeGenerating: false,
    isChangedAfterGcodeGenerating: true,
    gcodeFile: null,

    // model: null,
    selectedModelID: null,
    selectedModelVisible: true,
    sourceType: '',
    mode: '', // bw, greyscale, vector

    transformation: {},
    transformationUpdateTime: new Date().getTime(),

    config: {},

    toolDefinitions: [],
    activeToolListDefinition: null,
    showCncToolManager: false,

    history: operationHistory,
    targetTmpState: {},
    // When project recovered, the operation history should be cleared,
    // however we can not identify while the recovery is done, just exclude
    // them when the models loaded at the first time.
    excludeModelIDs: {},

    // modelGroup state
    hasModel: false,
    isAnyModelOverstepped: false,

    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model

    // stl visualizer state
    stlVisualizer: { show: false },

    previewFailed: false,
    autoPreviewEnabled: false,
    needToPreview: true,

    // rendering
    renderingTimestamp: 0,

    // check to remove models
    removingModelsWarning: false,
    removingModelsWarningCallback: noop,
    emptyToolPaths: [],

    // check not to duplicated create event
    initEventFlag: false,
    // used to manually control the gcode ganeration including thumbnails
    shouldGenerateGcodeCounter: 0,

    // ProgressStatesManager
    progressStatesManager: getProgressStateManagerInstance(),

    enableShortcut: true,
    promptTasks: [],
    projectFileOversize: false,
};

export const actions = {
    // TODO: init should be  re-called
    init: () => async (dispatch, getState) => {
        dispatch(editorActions._init(HEAD_CNC));

        const { activeMachine, toolHead, series } = getState().machine;

        await dispatch(machineActions.updateMachineToolHead(toolHead, series, HEAD_CNC));

        // init definition manager
        const configPath = getMachineToolHeadConfigPath(activeMachine, toolHead.cncToolhead);
        await definitionManager.init(HEAD_CNC, configPath);
        // const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        // await definitionManager.init(HEAD_CNC, currentMachine.configPathname[HEAD_CNC]);

        dispatch(editorActions.updateState(HEAD_CNC, {
            toolDefinitions: await definitionManager.getConfigDefinitions(),
            activeToolListDefinition: definitionManager?.activeDefinition,
            defaultDefinitions: definitionManager?.defaultDefinitions
        }));

        // Set machine size into coordinate default size
        const { size } = getState().machine;
        const { materials, coordinateSize } = getState().cnc;
        const { isRotate } = materials;
        if (!isRotate) {
            if (coordinateSize.x === 0 && coordinateSize.y === 0 && size) {
                dispatch(editorActions.updateState(HEAD_CNC, {
                    coordinateSize: size
                }));

                dispatch(editorActions.setWorkpiece(
                    HEAD_CNC,
                    WorkpieceShape.Rectangle,
                    {
                        x: size.x,
                        y: size.y,
                    }
                ));

                const newCoordinateSize = {
                    x: size.x,
                    y: size.y,
                };
                dispatch(editorActions.changeCoordinateMode(HEAD_CNC, COORDINATE_MODE_CENTER, newCoordinateSize));
            }
        } else {
            dispatch(editorActions.setWorkpiece(
                HEAD_CNC,
                WorkpieceShape.Cylinder,
                {
                    diameter: 35,
                    length: 70,
                }
            ));

            const newCoordinateSize = {
                x: 35 * Math.PI,
                y: 70,
            };
            dispatch(editorActions.changeCoordinateMode(HEAD_CNC, COORDINATE_MODE_BOTTOM_CENTER, newCoordinateSize));
        }
        dispatch(editorActions.updateState(HEAD_CNC, {
            lockingBlockPosition: 'A'
        }));
    },
    updateToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const { toolDefinitions } = getState().cnc;

        await definitionManager.updateDefinition(activeToolList);
        const isReplacedDefinition = (d) => d.definitionId === activeToolList.definitionId;
        const defintionIndex = toolDefinitions.findIndex(isReplacedDefinition);
        toolDefinitions.splice(defintionIndex, 1, activeToolList);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...toolDefinitions]
        }));

        return null;
    },
    updateToolDefinitionName: (isCategorySelected, definitionId, oldName, newName) => async (dispatch, getState) => {
        let definitionsWithSameCategory;
        const { toolDefinitions } = getState().cnc;
        const activeDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
        if (!newName || newName.trim().length === 0) {
            return Promise.reject(i18n._('key-Cnc/common-Failed to rename. Please enter a new name.'));
        }
        if (isCategorySelected) {
            const duplicated = toolDefinitions.find(d => d.category === newName);
            if (duplicated) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            definitionsWithSameCategory = toolDefinitions.filter(d => d.category === oldName);
            for (const definition of definitionsWithSameCategory) {
                definition.category = newName;
                definition.i18nCategory = '';
                await definitionManager.updateDefinition(definition);
                // find the old tool category definition and replace it
                const isReplacedDefinition = (d) => d.definitionId === definition.definitionId;
                const index = toolDefinitions.findIndex(isReplacedDefinition);
                toolDefinitions.splice(index, 1, definition);
            }
        } else {
            definitionsWithSameCategory = toolDefinitions.filter(d => d.category === activeDefinition.category);
            const duplicatedToolList = definitionsWithSameCategory.find(d => d.name === newName);
            if (duplicatedToolList) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            activeDefinition.name = newName;

            await definitionManager.updateDefinition(activeDefinition);
            // find the old tool category definition and replace it
            const isReplacedDefinition = (d) => d.definitionId === activeDefinition.definitionId;
            const index = toolDefinitions.findIndex(isReplacedDefinition);
            toolDefinitions.splice(index, 1, activeDefinition);
        }

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...toolDefinitions]
        }));

        return null;
    },
    duplicateToolCategoryDefinition: (activeToolList, isCreate, oldCategory) => async (dispatch, getState) => {
        const state = getState().cnc;
        const toolDefinitions = cloneDeep(state.toolDefinitions);
        let newCategoryName = activeToolList.category;
        const allDupliateDefinitions = [];
        // make sure category is not repeated
        while (toolDefinitions.find(d => d.category === newCategoryName)) {
            newCategoryName = `#${newCategoryName}`;
        }
        const definitionsWithSameCategory = isCreate ? [{
            ...activeToolList,
            name: i18n._('key-default_category-Default Tool'),
            settings: toolDefinitions[0]?.settings
        }]
            : state.toolDefinitions.filter(d => d.category === oldCategory);
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
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...toolDefinitions, ...allDupliateDefinitions]
        }));
        return allDupliateDefinitions[0];
    },

    removeToolCategoryDefinition: (category) => async (dispatch, getState) => {
        const state = getState().cnc;
        const toolDefinitions = state.toolDefinitions;
        const definitionsWithSameCategory = toolDefinitions.filter(d => d.category === category);
        for (let i = 0; i < definitionsWithSameCategory.length; i++) {
            await definitionManager.removeDefinition(definitionsWithSameCategory[i]);
        }
        const newToolDefinitions = toolDefinitions.filter(d => d.category !== category);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions]
        }));
        return newToolDefinitions;
    },
    removeToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const state = getState().cnc;
        await definitionManager.removeDefinition(activeToolList);
        const newToolDefinitions = state.toolDefinitions;
        const isReplacedDefinition = (d) => d.definitionId === activeToolList.definitionId;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions]
        }));
        return newToolDefinitions;
    },
    getDefaultDefinition: (definitionId) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().cnc;
        const def = defaultDefinitions.find(d => d.definitionId === definitionId);
        return def?.settings;
    },
    resetDefinitionById: (definitionId) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().cnc;
        const defaultDefinition = defaultDefinitions.find(d => d.definitionId === definitionId);
        dispatch(actions.updateToolListDefinition(defaultDefinition));
        return defaultDefinition;
    },
    updateStlVisualizer: (obj) => (dispatch, getState) => {
        const { stlVisualizer } = getState().cnc;
        dispatch(editorActions.updateState('cnc', { stlVisualizer: { ...stlVisualizer, ...obj } }));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    const { headType, type } = action;
    if (headType === 'cnc') {
        switch (type) {
            case ACTION_UPDATE_STATE: {
                return Object.assign({}, state, { ...action.state });
            }
            case ACTION_UPDATE_TRANSFORMATION: {
                return Object.assign({}, state, {
                    transformation: { ...state.transformation, ...action.transformation },
                    transformationUpdateTime: +new Date()
                });
            }
            case ACTION_UPDATE_CONFIG: {
                return Object.assign({}, state, {
                    config: { ...state.config, ...action.config }
                });
            }
            default:
                return state;
        }
    } else {
        switch (type) {
            case ACTION_CHANGE_TOOL_PARAMS: {
                return Object.assign({}, state, {
                    toolParams: { ...state.toolParams, ...action.toolParams }
                });
            }
            default:
                return state;
        }
    }
}
