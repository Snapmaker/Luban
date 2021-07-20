const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';

export const baseActions = {
    updateState: (headType, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    }
};
