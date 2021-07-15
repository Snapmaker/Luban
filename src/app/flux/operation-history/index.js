import getOperationHistoryInstance from './OperationHistory';
// import Operations from './Operations';

const ACTIONS_UPDATE_STATE = 'history/ACTION_UPDATE_STATE';

const INITIAL_STATE = {
    history: getOperationHistoryInstance(),
    targetTmpState: {},
    // When project recovered, the operation history should be cleared,
    // however we can not identify while the recovery is done, just exclude
    // them when the models loaded at the first time.
    excludeModelIDs: {}
};

export const actions = {
    excludeModelById: (id) => (dispatch, getState) => {
        const { excludeModelIDs } = getState().operationHistory;
        excludeModelIDs[id] = true;
        dispatch({
            type: ACTIONS_UPDATE_STATE,
            action: {
                excludeModelIDs
            }
        });
    },
    setOperations: (operations) => (dispatch, getState) => {
        const { excludeModelIDs } = getState().operationHistory;
        for (let i = operations.length() - 1; i > -1; i--) {
            const modelID = operations.getItem(i).state.target.modelID;
            if (modelID in excludeModelIDs) {
                delete excludeModelIDs[modelID];
                operations.removeItem(i);
            }
        }
        if (!operations.isEmpty()) {
            const { history } = getState().operationHistory;
            history.push(operations);
            dispatch({
                type: ACTIONS_UPDATE_STATE,
                action: {
                    history
                }
            });
        }
    },
    clear: () => (dispatch, getState) => {
        const { history } = getState().operationHistory;
        history.clear();
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
    },
    clearTargetTmpState: () => (dispatch, getState) => {
        let { targetTmpState } = getState().operationHistory;
        targetTmpState = {};
        dispatch({
            type: ACTIONS_UPDATE_STATE,
            action: {
                targetTmpState
            }
        });
    },
    updateTargetTmpState: (targetId, tmpState) => (dispatch, getState) => {
        const { targetTmpState } = getState().operationHistory;
        if (!targetTmpState[targetId]) {
            targetTmpState[targetId] = {};
        }
        targetTmpState[targetId] = {
            ...targetTmpState[targetId],
            ...tmpState
        };
        dispatch({
            type: ACTIONS_UPDATE_STATE,
            action: {
                targetTmpState
            }
        });
    }
};

export default function reducers(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTIONS_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default: return state;
    }
}
