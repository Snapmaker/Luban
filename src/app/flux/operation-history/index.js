import { baseActions as editorBaseActions } from '../editor/actions-base';
import printingBaseActions from '../printing/actions-base';
/* eslint-disable-next-line import/no-cycle */
import { actions as projectActions } from '../project';

const updateState = (headType, state) => {
    if (headType === 'printing') {
        return printingBaseActions.updateState(headType, state);
    } else if (headType === 'cnc' || headType === 'laser') {
        return editorBaseActions.updateState(headType, state);
    }
    return null;
};

export const actions = {
    excludeModelById: (headType, id) => (dispatch, getState) => {
        const { excludeModelIDs } = getState()[headType];
        excludeModelIDs[id] = true;
        dispatch(updateState(headType, {
            excludeModelIDs
        }));
    },
    setOperations: (headType, operations) => (dispatch, getState) => {
        const { excludeModelIDs } = getState()[headType];
        for (let i = operations.length() - 1; i > -1; i--) {
            const modelID = operations.getItem(i).state?.target?.modelID;
            if (modelID && modelID in excludeModelIDs) {
                delete excludeModelIDs[modelID];
                operations.removeItem(i);
            }
        }
        if (!operations.isEmpty()) {
            const { history } = getState()[headType];
            history.push(operations);
            dispatch(updateState(headType, {
                history
            }));
            dispatch(projectActions.autoSaveEnvironment(headType));
        }
    },
    clear: (headType) => (dispatch, getState) => {
        const history = getState()[headType]?.history;
        history.clear();
        dispatch(updateState(headType, {
            history
        }));
    },
    undo: (headType) => (dispatch, getState) => {
        const { history } = getState()[headType];
        history.undo();
        dispatch(projectActions.autoSaveEnvironment(headType));
        dispatch(updateState(headType, {
            history
        }));
    },
    redo: (headType) => (dispatch, getState) => {
        const { history } = getState()[headType];
        history.redo();
        dispatch(projectActions.autoSaveEnvironment(headType));
        dispatch(updateState(headType, {
            history
        }));
    },
    clearTargetTmpState: (headType) => (dispatch, getState) => {
        let { targetTmpState } = getState()[headType];
        targetTmpState = {};
        dispatch(updateState(headType, {
            targetTmpState
        }));
    },
    updateTargetTmpState: (headType, targetId, tmpState) => (dispatch, getState) => {
        const { targetTmpState } = getState()[headType];
        if (!targetTmpState[targetId]) {
            targetTmpState[targetId] = {};
        }
        targetTmpState[targetId] = {
            ...targetTmpState[targetId],
            ...tmpState
        };
        dispatch(updateState(headType, {
            targetTmpState
        }));
    }
};
