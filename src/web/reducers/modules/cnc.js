// cnc reducer

import {
    STAGE_IDLE
} from '../../constants';

const initialState = {
    stage: STAGE_IDLE,
    workState: 'idle',
    output: {
        gcodePath: ''
    }
};

const ACTION_CHANGE_STAGE = 'cnc/CHANGE_STAGE';
const ACTION_CHANGE_WORK_STATE = 'cnc/CHANGE_WORK_STATE';
const ACTION_CHANGE_OUTPUT = 'cnc/CHANGE_OUTPUT';

export const actions = {
    changeStage: (stage) => {
        return {
            type: ACTION_CHANGE_STAGE,
            stage
        };
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_CHANGE_WORK_STATE,
            workState
        };
    },
    changeOutputGcodePath: (gcodePath) => {
        return {
            type: ACTION_CHANGE_OUTPUT,
            gcodePath
        };
    }
};


export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_CHANGE_STAGE: {
            return Object.assign({}, state, {
                stage: action.stage
            });
        }
        case ACTION_CHANGE_WORK_STATE: {
            return Object.assign({}, state, {
                workState: action.workState
            });
        }
        case ACTION_CHANGE_OUTPUT: {
            return Object.assign({}, state, {
                output: {
                    gcodePath: action.gcodePath
                }
            });
        }
        default:
            return state;
    }
}
