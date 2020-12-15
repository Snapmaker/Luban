import ModelGroup from '../../models/ModelGroup';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import ToolPathModelGroup from '../../models/ToolPathModelGroup';
import { controller } from '../../lib/controller';
import {
    ACTION_RESET_CALCULATED_STATE, ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
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
    activeToolDefinition: null,
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
            activeToolDefinition: definitionManager.activeToolDefinition
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
    duplicateToolCategoryDefinition: (activeToolCategory) => async (dispatch, getState) => {
        const state = getState().cnc;
        const newToolCategory = {
            ...activeToolCategory
        };
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
        while (activeToolCategoryDefinition.toolList.find(d => d.toolName === newToolListDefinition.toolName)) {
            newToolListDefinition.toolName = `#${newToolListDefinition.toolName}`;
        }
        const newToolDefinitions = state.toolDefinitions;
        const createdDefinition = await definitionManager.createToolListDefinition(activeToolCategoryDefinition, newToolListDefinition);
        const isReplacedDefinition = (d) => d.category === createdDefinition.category;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1, createdDefinition);

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions]
        }));
        return newToolListDefinition.toolName;
    },
    removeToolCategoryDefinition: (activeToolCategory) => async (dispatch, getState) => {
        const state = getState().cnc;
        await definitionManager.removeToolCategoryDefinition(activeToolCategory);

        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: state.toolDefinitions.filter(d => d.category !== activeToolCategory.category)
        }));
    },
    removeToolListDefinition: (activeToolCategory, activeToolList) => async (dispatch, getState) => {
        const state = getState().cnc;
        const createdDefinition = await definitionManager.removeToolListDefinition(activeToolCategory, activeToolList);

        const newToolDefinitions = state.toolDefinitions;
        const isReplacedDefinition = (d) => d.category === createdDefinition.category;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1, createdDefinition);
        console.log('removeToolListDefinition', newToolDefinitions);
        dispatch(editorActions.updateState('cnc', {
            toolDefinitions: [...newToolDefinitions]
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
