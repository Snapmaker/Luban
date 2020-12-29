import ModelGroup from '../../models/ModelGroup';
import i18n from '../../lib/i18n';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import ToolPathModelGroup from '../../models/ToolPathModelGroup';
import { controller } from '../../lib/controller';
import api from '../../api';
import {
    ACTION_RESET_CALCULATED_STATE, ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { timestamp } from '../../../shared/lib/random-utils';
import { actions as editorActions, CNC_LASER_STAGE } from '../editor';
import { PAGE_EDITOR, CNC_TOOL_SNAP_V_BIT_CONFIG } from '../../constants';
import definitionManager from './DefinitionManager';

const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';

const initModelGroup = new ModelGroup('cnc');
const INITIAL_STATE = {

    materials: {
        isRotate: false,
        diameter: 35,
        length: 75,
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
    toolPathModelGroup: new ToolPathModelGroup(initModelGroup),
    SVGActions: new SVGActionsFactory(initModelGroup),

    isAllModelsPreviewed: false,
    isGcodeGenerating: false,
    gcodeFile: null,

    // model: null,
    selectedModelID: null,
    selectedModelVisible: true,
    sourceType: '',
    mode: '', // bw, greyscale, vector
    showOrigin: null,

    printOrder: 1,
    transformation: {},
    transformationUpdateTime: new Date().getTime(),

    gcodeConfig: {},
    config: {},

    toolSnap: '',
    toolParams: {
        toolDiameter: CNC_TOOL_SNAP_V_BIT_CONFIG.diameter, // tool diameter (in mm)
        toolAngle: CNC_TOOL_SNAP_V_BIT_CONFIG.angle, // tool angle (in degree, defaults to 30° for V-Bit)，
        toolShaftDiameter: CNC_TOOL_SNAP_V_BIT_CONFIG.shaftDiameter // tool angle (in degree, defaults to 30° for V-Bit)
    },
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

    previewFailed: false,
    autoPreviewEnabled: true,

    // rendering
    renderingTimestamp: 0
};

export const actions = {
    init: () => async (dispatch, getState) => {
        const { modelGroup } = getState().cnc;
        modelGroup.setDataChangedCallback(() => {
            dispatch(editorActions.render('cnc'));
        });
        await definitionManager.init();

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: definitionManager.toolDefinitions,
            activeToolListDefinition: definitionManager.activeToolListDefinition
        }));

        // TODO: not yet to clear old events before regist
        const controllerEvents = {
            'taskProgress:generateToolPath': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.updateState('cnc', {
                        progress: taskResult.progress
                    }));
                }
            },
            'taskCompleted:generateToolPath': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.onReceiveTaskResult('cnc', taskResult));
                }
            },

            'taskProgress:generateGcode': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.updateState('cnc', {
                        progress: taskResult.progress
                    }));
                }
            },
            'taskCompleted:generateGcode': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.onReceiveGcodeTaskResult('cnc', taskResult));
                }
            },
            'taskCompleted:processImage': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.onReceiveProcessImageTaskResult('cnc', taskResult));
                }
            },
            'taskProgress:generateViewPath': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.updateState('cnc', {
                        progress: taskResult.progress
                    }));
                }
            },
            'taskCompleted:generateViewPath': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    if (taskResult.headType === 'cnc') {
                        dispatch(editorActions.onReceiveViewPathTaskResult('cnc', taskResult));
                    }
                }
            },
            'taskProgress:processImage': (taskResult) => {
                if (taskResult.headType === 'cnc') {
                    dispatch(editorActions.updateState('cnc', {
                        progress: taskResult.progress
                    }));
                }
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });
    },
    updateToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const { toolDefinitions } = getState().cnc;
        const newToolCategory = toolDefinitions.find((d) => d.definitionId === activeToolList.definitionId);
        const newToolList = newToolCategory.toolList;
        // find the old tool list definition and replace it
        const isReplacedTool = (d) => d.name === activeToolList.name;
        const toolIndex = newToolList.findIndex(isReplacedTool);
        newToolList.splice(toolIndex, 1, {
            name: activeToolList.name,
            config: activeToolList.config
        });

        await definitionManager.updateToolDefinition(newToolCategory);
        const isReplacedDefinition = (d) => d.definitionId === newToolCategory.definitionId;
        const defintionIndex = toolDefinitions.findIndex(isReplacedDefinition);
        toolDefinitions.splice(defintionIndex, 1, newToolCategory);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...toolDefinitions]
        }));

        return null;
    },
    updateToolDefinitionName: (isCategorySelected, definitionId, oldName, newName) => async (dispatch, getState) => {
        let duplicated;
        const { toolDefinitions } = getState().cnc;
        const activeDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
        if (!newName || newName.trim().length === 0) {
            return Promise.reject(i18n._('Failed to rename. Please enter a new name.'));
        }
        if (isCategorySelected) {
            duplicated = toolDefinitions.find(d => d.category === newName);

            if (duplicated && duplicated !== activeDefinition) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            activeDefinition.category = newName;
        } else {
            const duplicatedToolList = activeDefinition.toolList.find(d => d.name === newName);
            if (duplicatedToolList) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            const oldToolList = activeDefinition.toolList.find(d => d.name === oldName);
            oldToolList.name = newName;
        }

        await definitionManager.updateToolDefinition(activeDefinition);
        // find the old tool category definition and replace it
        const isReplacedDefinition = (d) => d.definitionId === activeDefinition.definitionId;
        const index = toolDefinitions.findIndex(isReplacedDefinition);
        toolDefinitions.splice(index, 1, activeDefinition);

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...toolDefinitions]
        }));

        return null;
    },
    duplicateToolCategoryDefinition: (activeToolCategory) => async (dispatch, getState) => {
        const state = getState().cnc;
        const newToolCategory = {
            ...activeToolCategory
        };
        const definitionId = `${activeToolCategory.definitionId}${timestamp()}`;
        newToolCategory.definitionId = definitionId;
        // make sure category is not repeated
        while (state.toolDefinitions.find(d => d.category === newToolCategory.category)) {
            newToolCategory.category = `#${newToolCategory.category}`;
        }
        const createdDefinition = await definitionManager.createToolCategoryDefinition(newToolCategory);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...state.toolDefinitions, createdDefinition]
        }));

        return createdDefinition;
    },
    duplicateToolListDefinition: (activeToolCategoryDefinition, activeToolListDefinition) => async (dispatch, getState) => {
        const state = getState().cnc;
        const newToolListDefinition = {
            ...activeToolListDefinition
        };
        // make sure name is not repeated
        while (activeToolCategoryDefinition.toolList.find(d => d.name === newToolListDefinition.name)) {
            newToolListDefinition.name = `#${newToolListDefinition.name}`;
        }
        const newToolDefinitions = state.toolDefinitions;
        const createdDefinition = await definitionManager.createToolListDefinition(activeToolCategoryDefinition, newToolListDefinition);
        const isReplacedDefinition = (d) => d.definitionId === createdDefinition.definitionId;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1, createdDefinition);

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions]
        }));
        return newToolListDefinition.name;
    },
    removeToolCategoryDefinition: (definitionId) => async (dispatch, getState) => {
        const state = getState().cnc;
        await definitionManager.removeToolCategoryDefinition(definitionId);

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: state.toolDefinitions.filter(d => d.definitionId !== definitionId)
        }));
    },
    removeToolListDefinition: (activeToolCategory, activeToolList) => async (dispatch, getState) => {
        const state = getState().cnc;
        const createdDefinition = await definitionManager.removeToolListDefinition(activeToolCategory, activeToolList);

        const newToolDefinitions = state.toolDefinitions;
        const isReplacedDefinition = (d) => d.definitionId === createdDefinition.definitionId;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1, createdDefinition);
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
            case ACTION_RESET_CALCULATED_STATE: {
                return Object.assign({}, state, {
                    isAllModelsPreviewed: false
                });
            }
            case ACTION_UPDATE_TRANSFORMATION: {
                return Object.assign({}, state, {
                    transformation: { ...state.transformation, ...action.transformation },
                    transformationUpdateTime: +new Date()
                });
            }
            case ACTION_UPDATE_GCODE_CONFIG: {
                return Object.assign({}, state, {
                    gcodeConfig: { ...state.gcodeConfig, ...action.gcodeConfig }
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
