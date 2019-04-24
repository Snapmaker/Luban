import api from '../../api';

const ACTION_ADD_FONT = 'text/ADD_FONT';
const ACTION_SET_FONTS = 'text/ACTION_SET_FONTS';

const INITIAL_STATE = {
    fonts: [] // available fonts to use
};

export const actions = {
    init: () => {
        return (dispatch) => {
            api.utils.getFonts()
                .then((res) => {
                    const fonts = res.body.fonts || [];
                    dispatch(actions.setFonts(fonts));
                });
        };
    },
    uploadFont: (file) => (dispatch) => {
        const formData = new FormData();
        formData.append('font', file);
        api.utils.uploadFont(formData)
            .then((res) => {
                const font = res.body.font;
                dispatch(actions.addFont(font));
            });
    },
    addFont: (font) => {
        return {
            type: ACTION_ADD_FONT,
            font
        };
    },
    setFonts: (fonts) => {
        return {
            type: ACTION_SET_FONTS,
            fonts
        };
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    const { type } = action;
    switch (type) {
        case ACTION_ADD_FONT: {
            return Object.assign({}, state, {
                fonts: state.fonts.concat([action.font])
            });
        }
        case ACTION_SET_FONTS: {
            return Object.assign({}, state, {
                fonts: action.fonts
            });
        }
        default:
            return state;
    }
}
