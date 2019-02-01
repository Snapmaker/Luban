// Reducer for Workspace
import path from 'path';
import GcodeInfo from './GcodeInfo';

import api from '../../api';
import log from '../../lib/log';

// Actions
const ACTION_SET_STATE = 'WORKSPACE/ACTION_SET_STATE';
const ACTION_ADD_GCODE = 'WORKSPACE/ACTION_ADD_GCODE';

const INITIAL_STATE = {
    gcodeList: [],
    uploadState: 'idle' // uploading, uploaded
};


export function getGcodeName(gcodeList) {
    if (gcodeList.length === 0) {
        return null;
    }

    const gcodeBean = gcodeList[0];
    const filename = path.basename(gcodeBean.name);

    if (filename.endsWith('.gcode')
        || filename.endsWith('.nc')
        || filename.endsWith('.cnc')) {
        return filename;
    }

    return filename + '.gcode';
}

export const actions = {
    setState: (state) => {
        return {
            type: ACTION_SET_STATE,
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
    },

    loadGcode: (port, name, gcode) => async (dispatch) => {
        dispatch(actions.setState({ uploadState: 'uploading' }));
        try {
            await api.loadGCode({ port, name, gcode });

            dispatch(actions.setState({ uploadState: 'uploaded' }));
        } catch (e) {
            dispatch(actions.setState({ uploadState: 'idle' }));

            log.error('Failed to upload G-code to controller');
        }
    },

    unloadGcode: () => (dispatch) => {
        // TODO: unload G-code in controller
        dispatch(actions.setState({ uploadState: 'idle' }));
    },
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
        }

        case ACTION_ADD_GCODE: {
            const { name, gcode, renderMethod } = action;

            // New list
            const list = [];
            for (const gcodeInfo of state.gcodeList) {
                list.push(gcodeInfo);
            }
            list.push(new GcodeInfo(name, gcode, renderMethod));

            return Object.assign({}, state, { gcodeList: list });
        }

        default:
            return state;
    }
}
