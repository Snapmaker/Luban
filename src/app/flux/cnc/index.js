import { cloneDeep } from 'lodash';
import ModelGroup from '../../models/ModelGroup';
import i18n from '../../lib/i18n';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import api from '../../api';
import {
    ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { timestamp } from '../../../shared/lib/random-utils';
import { actions as editorActions } from '../editor';
import { PAGE_EDITOR, HEAD_CNC, DISPLAYED_TYPE_MODEL, COORDINATE_MODE_CENTER } from '../../constants';
import definitionManager from './DefinitionManager';
import { machineStore } from '../../store/local-storage';
import ToolPathGroup from '../../toolpaths/ToolPathGroup';
import { CNC_LASER_STAGE } from '../editor/utils';

const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';

const initModelGroup = new ModelGroup('cnc');
const INITIAL_STATE = {

    materials: {
        isRotate: false,
        diameter: 35,
        length: 70,
        fixtureLength: 20,
        x: 0,
        y: 0,
        z: 0
    },

    page: PAGE_EDITOR,

    stage: CNC_LASER_STAGE.EMPTY,
    progress: 0,
    scale: 1,
    target: null,

    modelGroup: initModelGroup,

    displayedType: DISPLAYED_TYPE_MODEL,
    toolPathGroup: new ToolPathGroup(initModelGroup, 'cnc'),
    updatingToolPath: null,
    showToolPath: false,
    showSimulation: false,
    simulationNeedToPreview: true,

    SVGActions: new SVGActionsFactory(initModelGroup),

    isGcodeGenerating: false,
    isChangedAfterGcodeGenerating: true,
    gcodeFile: null,

    // model: null,
    selectedModelID: null,
    selectedModelVisible: true,
    sourceType: '',
    mode: '', // bw, greyscale, vector
    showOrigin: null,

    transformation: {},
    transformationUpdateTime: new Date().getTime(),

    config: {},

    toolDefinitions: [],
    activeToolListDefinition: null,
    showCncToolManager: false,

    // snapshot state
    undoSnapshots: [{ models: [], toolPathModels: [] }], // snapshot { models, toolPathModels }
    redoSnapshots: [], // snapshot { models, toolPathModels }
    canUndo: false,
    canRedo: false,

    // modelGroup state
    hasModel: false,
    isAnyModelOverstepped: false,

    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model

    // stl visualizer state
    stlVisualizer: { show: false },

    previewFailed: false,
    autoPreviewEnabled: false,

    // rendering
    renderingTimestamp: 0,

    // coordinateMode
    coordinateMode: COORDINATE_MODE_CENTER,
    coordinateSize: { x: 0, y: 0 }
};

export const actions = {
    init: () => async (dispatch, getState) => {
        dispatch(editorActions._init(HEAD_CNC));

        await definitionManager.init();

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: definitionManager.toolDefinitions,
            activeToolListDefinition: definitionManager.activeToolListDefinition
        }));

        const materials = machineStore.get('cnc.materials');
        if (materials) {
            dispatch(editorActions.updateMaterials('cnc', materials));
        }

        // Set machine size into coordinate default size
        const { size } = getState().machine;
        if (size) {
            dispatch(editorActions.updateState('cnc', {
                coordinateSize: size
            }));
        }
    },
    updateToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const { toolDefinitions } = getState().cnc;

        await definitionManager.updateToolDefinition(activeToolList);
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
            return Promise.reject(i18n._('Failed to rename. Please enter a new name.'));
        }
        if (isCategorySelected) {
            const duplicated = toolDefinitions.find(d => d.category === newName);
            if (duplicated) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            definitionsWithSameCategory = toolDefinitions.filter(d => d.category === oldName);
            for (const definition of definitionsWithSameCategory) {
                definition.category = newName;
                await definitionManager.updateToolDefinition(definition);
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

            await definitionManager.updateToolDefinition(activeDefinition);
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
    // // TODO:
    duplicateToolCategoryDefinition: (activeToolList, isCreate, oldCategory) => async (dispatch, getState) => {
        const state = getState().cnc;
        const toolDefinitions = cloneDeep(state.toolDefinitions);
        const newToolCategory = activeToolList;
        let newCategoryName = newToolCategory.category;
        const allDupliateDefinitions = [];
        // make sure category is not repeated
        while (toolDefinitions.find(d => d.category === newCategoryName)) {
            newCategoryName = `#${newCategoryName}`;
        }
        const definitionsWithSameCategory = isCreate ? [activeToolList]
            : state.toolDefinitions.filter(d => d.category === oldCategory);
        for (let i = 0; i < definitionsWithSameCategory.length; i++) {
            const newDefinition = definitionsWithSameCategory[i];
            newDefinition.category = newCategoryName;
            const definitionId = `${newDefinition.definitionId}${timestamp()}`;
            newDefinition.definitionId = definitionId;
            const createdDefinition = await definitionManager.createToolListDefinition(newDefinition);
            if (createdDefinition) {
                allDupliateDefinitions.push(createdDefinition);
            }
        }
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...toolDefinitions, ...allDupliateDefinitions]
        }));

        return allDupliateDefinitions[0];
    },
    duplicateToolListDefinition: (activeToolListDefinition) => async (dispatch, getState) => {
        const state = getState().cnc;
        const newToolDefinitions = state.toolDefinitions;
        const category = activeToolListDefinition.category;
        const newToolListDefinition = {
            ...activeToolListDefinition,
            definitionId: `New.${timestamp()}`
        };
        const definitionsWithSameCategory = newToolDefinitions.filter(d => d.category === category);
        // make sure name is not repeated
        while (definitionsWithSameCategory.find(d => d.name === newToolListDefinition.name)) {
            newToolListDefinition.name = `#${newToolListDefinition.name}`;
        }
        const createdDefinition = await definitionManager.createToolListDefinition(newToolListDefinition);

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions, createdDefinition]
        }));
        return createdDefinition;
    },

    removeToolCategoryDefinition: (category) => async (dispatch, getState) => {
        const state = getState().cnc;
        const newToolDefinitions = state.toolDefinitions;
        const definitionsWithSameCategory = newToolDefinitions.filter(d => d.category === category);
        for (let i = 0; i < definitionsWithSameCategory.length; i++) {
            await definitionManager.removeToolListDefinition(definitionsWithSameCategory[i]);
        }

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: newToolDefinitions.filter(d => d.category !== category)
        }));
    },
    removeToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const state = getState().cnc;
        await definitionManager.removeToolListDefinition(activeToolList);
        const newToolDefinitions = state.toolDefinitions;
        const isReplacedDefinition = (d) => d.definitionId === activeToolList.definitionId;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions]
        }));
    },
    onUploadToolDefinition: (file) => async (dispatch, getState) => {
        const formData = new FormData();
        formData.append('file', file);
        // set a new name that cannot be repeated
        formData.append('uploadName', `${file.name.substr(0, file.name.length - 9)}${timestamp()}.def.json`);
        api.uploadFile(formData)
            .then(async (res) => {
                const response = res.body;
                const { toolDefinitions } = getState().cnc;
                const definition = await definitionManager.uploadToolDefinition(response.uploadName, toolDefinitions);
                dispatch(editorActions.updateState('cnc', {
                    toolDefinitions: [...toolDefinitions, definition]
                }));
            })
            .catch(() => {
                // Ignore error
            });
    },
    updateStlVisualizer: (obj) => (dispatch, getState) => {
        const { stlVisualizer } = getState().cnc;
        dispatch(editorActions.updateState('cnc', { stlVisualizer: { ...stlVisualizer, ...obj } }));
    },
    changeActiveToolListDefinition: (definitionId, name) => async (dispatch) => {
        const activeToolListDefinition = await definitionManager.changeActiveToolListDefinition(
            definitionId,
            name
        );
        dispatch(editorActions.updateState('cnc', {
            activeToolListDefinition
        }));
    },
    updateShowCncToolManager: (showCncToolManager) => (dispatch) => {
        dispatch(editorActions.updateState('cnc', { showCncToolManager }));
    },
    changeToolParams: (toolParams) => {
        return {
            type: ACTION_CHANGE_TOOL_PARAMS,
            toolParams
        };
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
