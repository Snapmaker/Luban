const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';

const updateState = (state: object) => {
    return {
        type: ACTION_UPDATE_STATE,
        state
    };
};


export default {
    updateState,
};
