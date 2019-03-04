import ModelGroup2D from '../ModelGroup2D';
import {
    ACTION_RESET_CALCULATED_STATE, ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';

const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';

const INITIAL_STATE = {
    modelGroup: new ModelGroup2D(),
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }
    hasModel: false,
    // selected
    model: null,
    mode: '', // bw, greyscale, vector
    printOrder: 1,
    transformation: {},
    gcodeConfig: {},
    config: {},

    toolParams: {
        toolDiameter: 3.175, // tool diameter (in mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    },

    autoPreviewEnabled: true
};

export const actions = {
    changeToolParams: (toolParams) => {
        return {
            type: ACTION_CHANGE_TOOL_PARAMS,
            toolParams
        };
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    const { from, type } = action;
    if (from === 'cnc') {
        switch (type) {
            case ACTION_UPDATE_STATE: {
                return Object.assign({}, state, { ...action.state });
            }
            case ACTION_RESET_CALCULATED_STATE: {
                return Object.assign({}, state, {
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                });
            }
            case ACTION_UPDATE_TRANSFORMATION: {
                return Object.assign({}, state, {
                    transformation: { ...state.transformation, ...action.transformation },
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
