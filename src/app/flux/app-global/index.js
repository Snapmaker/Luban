const ACTION_UPDATE_STATE = 'app-global/ACTION_UPDATE_STATE';
const DEFAULT_STATE = {
    showSavedModal: false,
    savedModalType: '', // 'web', 'electron'
    savedModalFilePath: ''
};
const SHOW_SAVED_MODAL_TIME = 15000;
let clearSavedModalTimer = null;

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    // TODO: need to add an close function
    // options: { showSavedModal, savedModalType, savedModalFilePath }
    updateSavedModal: (options) => (dispatch) => {
        const newState = {
            showSavedModal: options.showSavedModal,
            savedModalType: options.savedModalType,
            savedModalFilePath: options.savedModalFilePath
        };
        if (options.showSavedModal) {
            clearTimeout(clearSavedModalTimer);
            clearSavedModalTimer = setTimeout(() => {
                dispatch(actions.updateSavedModal({
                    showSavedModal: false
                }));
            }, SHOW_SAVED_MODAL_TIME);
        } else {
            clearTimeout(clearSavedModalTimer);
        }
        dispatch(actions.updateState(newState));
    }
};
export default function reducer(state = DEFAULT_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default: {
            return state;
        }
    }
}
