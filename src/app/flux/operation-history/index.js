import getOperationHistoryInstance from './OperationHistory';
// import Operations from './Operations';

const ACTIONS_UPDATE_STATE = 'history/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    history: getOperationHistoryInstance(),
    operattingTargets: []
};

export const actions = {
    // one time complete
    setOperations: (operations) => (dispatch, getState) => {
        const { history } = getState().operationHistory;
        history.push(operations);
        dispatch({
            type: ACTIONS_UPDATE_STATE,
            action: {
                history
            }
        });
    },
    undo: () => (dispatch, getState) => {
        const { history } = getState().operationHistory;
        history.undo();
        dispatch({
            type: ACTIONS_UPDATE_STATE,
            action: {
                history
            }
        });
    },
    redo: () => (dispatch, getState) => {
        const { history } = getState().operationHistory;
        history.redo();
        dispatch({
            type: ACTIONS_UPDATE_STATE,
            action: {
                history
            }
        });
    }
    // ,
    // createOperation: (state) => (dispatch, getState) => {
    //     const operationHistory = getState().operationHistory;
    // },
    // updateOperation: (state) => (dispatch, getState) => {
    //     const operationHistory = getState().operationHistory;
    // },
    // finishOperation: (state) => (dispatch, getState) => {
    //     const operationHistory = getState().operationHistory;
    // }
};

export default function reducers(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTIONS_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default: return state;
    }
}
