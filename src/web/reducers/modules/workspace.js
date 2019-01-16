// Reducer for Workspace
import uuid from 'uuid';

// No-reducer action
const ACTION_NO_REDUCER_SET_STATE = 'WORKSPACE/ACTION_NO_REDUCER_SET_STATE';

const ACTION_ADD_GCODE = 'WORKSPACE/ACTION_ADD_GCODE';

const INITIAL_STATE = {
    gcodeList: []
};

class GcodeBean {
    constructor(name, gcode, renderMethod) {
        this.name = name;
        this.gcode = gcode;
        this.renderMethod = renderMethod;
        this.uuid = uuid.v4();
    }

    get uniqueName() {
        return `${this.name}-${this.uuid}`;
    }
}

export const actions = {
    setState: (state) => {
        return {
            type: ACTION_NO_REDUCER_SET_STATE,
            state
        };
    },

    // Add G-code
    addGcode: (name, gcode, renderMethod = 'line') => {
        return {
            type: ACTION_ADD_GCODE,
            name,
            gcode,
            renderMethod
        };
    },

    // Clear G-code list
    clearGcode: () => {
        return actions.setState({ gcodeList: [] });
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_NO_REDUCER_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
        }

        case ACTION_ADD_GCODE: {
            const { name, gcode, renderMethod } = action;

            // New list
            const list = [];
            for (const gcodeBean of state.gcodeList) {
                list.push(gcodeBean);
            }
            list.push(new GcodeBean(name, gcode, renderMethod));

            return Object.assign({}, state, { gcodeList: list });
        }

        default:
            return state;
    }
}
