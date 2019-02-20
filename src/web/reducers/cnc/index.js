// cnc reducer
const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';

const INITIAL_STATE = {
    toolParams: {
        toolDiameter: 3.175, // tool diameter (in mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    }
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
    switch (action.type) {
        case ACTION_CHANGE_TOOL_PARAMS: {
            return Object.assign({}, state, {
                toolParams: { ...state.toolParams, ...action.toolParams }
            });
        }
        default:
            return state;
    }
}
