const ACTION_UPDATE_STATE = 'app-global/ACTION_UPDATE_STATE';
const DEFAULT_MODAL_ZINDEX = 9999;
const DEFAULT_STATE = {
    showSavedModal: false,
    savedModalType: '', // 'web', 'electron'
    savedModalFilePath: '',
    savedModalZIndex: DEFAULT_MODAL_ZINDEX,

    showArrangeModelsError: false,
    arrangeModelZIndex: DEFAULT_MODAL_ZINDEX
};
const SHOW_MODAL_TIME = 15000;
let clearSavedModalTimer = null;
let clearArrangeModelsModalTimer = null;

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    // TODO: need to add an close function
    // options: { showSavedModal, savedModalType, savedModalFilePath }
    updateSavedModal: (options) => (dispatch, getState) => {
        const newState = {
            showSavedModal: options.showSavedModal,
            savedModalType: options.savedModalType,
            savedModalFilePath: options.savedModalFilePath,
            savedModalZIndex: DEFAULT_MODAL_ZINDEX,
            arrangeModelZIndex: getState().appGlobal.arrangeModelZIndex - 1
        };
        if (options.showSavedModal) {
            clearTimeout(clearSavedModalTimer);
            clearSavedModalTimer = setTimeout(() => {
                dispatch(actions.updateSavedModal({
                    showSavedModal: false
                }));
            }, SHOW_MODAL_TIME);
        } else {
            clearTimeout(clearSavedModalTimer);
        }
        dispatch(actions.updateState(newState));
    },

    updateShowArrangeModelsError: (options) => (dispatch, getState) => {
        const newState = {
            showArrangeModelsError: options.showArrangeModelsError,
            arrangeModelZIndex: DEFAULT_MODAL_ZINDEX,
            savedModalZIndex: getState().appGlobal.savedModalZIndex - 1
        };
        if (options.showArrangeModelsError) {
            clearTimeout(clearArrangeModelsModalTimer);
            clearArrangeModelsModalTimer = setTimeout(() => {
                dispatch(actions.updateShowArrangeModelsError({
                    showArrangeModelsError: false
                }));
            }, SHOW_MODAL_TIME);
        } else {
            clearTimeout(clearArrangeModelsModalTimer);
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
