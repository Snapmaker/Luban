export const ACTION_UPDATE_STATE = 'machine/ACTION_UPDATE_STATE';

// Update state directly
function updateState(state) {
    return {
        type: ACTION_UPDATE_STATE,
        state
    };
}

export default {
    updateState
};
