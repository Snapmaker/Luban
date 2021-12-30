const ACTION_UPDATE_STATE = 'printing/ACTION_UPDATE_STATE';

export const baseActions = {
    updateState: (_, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    }
};
