
const INITIAL_STATE = {
    import: {
        time: 0,
        content: ''
    }
};

const ACTION_UPDATE_STATE = 'svg/ACTION_UPDATE_STATE';
const ACTION_IMPORT = 'svg/IMPORT';

export const actions = {
    importSVGString: (svgString) => {
        return {
            type: ACTION_IMPORT,
            time: +new Date(),
            content: svgString
        };
    }
    /*
    clearImport: () => (dispatch, getState) => {
        const state = getState().svgeditor;
        // instead of evoke a update state, we clear import content directly
        // since it won't trigger any rendering.
        state.import.content = '';
    }
    */
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        case ACTION_IMPORT: {
            return Object.assign({}, state, {
                import: { ...state.import, time: action.time, content: action.content }
            });
        }
        default:
            return state;
    }
}
