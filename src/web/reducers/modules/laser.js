// Laser reducer

import {
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT
} from '../../constants';
import api from '../../api';

// state
const initialState = {
    stage: STAGE_IDLE,
    workState: 'idle',
    source: {
        image: DEFAULT_RASTER_IMAGE,
        width: DEFAULT_SIZE_WIDTH,
        height: DEFAULT_SIZE_HEIGHT / 10
    },
    target: {
        width: DEFAULT_SIZE_WIDTH / 10,
        height: DEFAULT_SIZE_HEIGHT / 10,
        anchor: 'Bottom Left',
        jogSpeed: 1500,
        workSpeed: 220,
        dwellTime: 42
    },
    output: {
        gcodePath: ''
    },
    // text mode parameters
    textMode: {
        text: 'Snapmaker',
        size: 24,
        font: 'Georgia',
        lineHeight: 1.5,
        alignment: 'left' // left, middle, right
    },
    // available fonts to use
    fonts: []
};

// actions
const ACTION_CHANGE_STAGE = 'laser/CHANGE_STAGE';
const ACTION_CHANGE_WORK_STATE = 'laser/CHANGE_WORK_STATE';
const ACTION_CHANGE_SOURCE_IMAGE = 'laser/CHANGE_SOURCE_IMAGE';
const ACTION_TARGET_SET_STATE = 'laser/TARGET_SET_STATE';
const ACTION_CHANGE_TARGET_SIZE = 'laser/CHANGE_TARGET_SIZE';
const ACTION_CHANGE_OUTPUT = 'laser/CHANGE_OUTPUT';
const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_CHANGE_FONTS = 'laser/CHANGE_FONTS';

const ACTION_TEXT_MODE_SET_STATE = 'laser/textMode/setState';

export const actions = {
    changeStage: (stage) => {
        return {
            type: ACTION_CHANGE_STAGE,
            stage
        };
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_CHANGE_WORK_STATE,
            workState
        };
    },
    changeSourceImage: (image, width, height) => {
        return {
            type: ACTION_CHANGE_SOURCE_IMAGE,
            image,
            width,
            height
        };
    },
    targetSetState: (state) => {
        return {
            type: ACTION_TARGET_SET_STATE,
            state
        };
    },
    changeTargetSize: (width, height) => {
        return {
            type: ACTION_CHANGE_TARGET_SIZE,
            width,
            height
        };
    },
    changeOutputGcodePath: (gcodePath) => {
        return {
            type: ACTION_CHANGE_OUTPUT,
            gcodePath
        };
    },
    addFont: (font) => {
        return {
            type: ACTION_ADD_FONT,
            font
        };
    },
    changeFonts: (fonts) => {
        return {
            type: ACTION_CHANGE_FONTS,
            fonts
        };
    },
    generateGcode: () => {
        return (dispatch, getState) => {
            const state = getState().laser;
            const options = {
                type: 'laser', // hard-coded laser
                mode: 'text', // hard-coded text
                source: state.source,
                target: state.target,
                textMode: state.textMode
            };
            api.generateGCode(options).then((res) => {
                // update output
                dispatch(actions.changeOutputGcodePath(res.body.gcodePath));

                // change stage
                dispatch(actions.changeStage(STAGE_GENERATED));
            }).catch((err) => {
                // log.error(String(err));
            });
        };
    },
    // text mode no-reducer setState
    textModeSetState: (state) => {
        return {
            type: ACTION_TEXT_MODE_SET_STATE,
            state
        };
    },
    textModeInit: () => {
        return (dispatch) => {
            api.utils.getFonts()
                .then((res) => {
                    const fonts = res.body.fonts || [];
                    dispatch(actions.changeFonts(fonts));

                    if (fonts.length > 1) {
                        dispatch(actions.textModeSetState({
                            font: fonts[0].fontFamily
                        }));
                    }
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

                dispatch(actions.textModeSetState({
                    font: font.fontFamily
                }));
            });
    },
    textModePreview: () => {
        return (dispatch, getState) => {
            const state = getState().laser;

            const options = {
                mode: 'text',
                text: state.textMode.text,
                font: state.textMode.font,
                size: state.textMode.size,
                lineHeight: state.textMode.lineHeight,
                alignment: state.textMode.alignment,
                anchor: state.textMode.anchor
            };

            api.processImage(options)
                .then((res) => {
                    const { filename, width, height } = res.body;
                    const path = `${WEB_CACHE_IMAGE}/${filename}`;
                    dispatch(actions.changeSourceImage(path, width, height));

                    const numberOfLines = state.textMode.text.split('\n').length;
                    const targetHeight = state.textMode.size / 72 * 25.4 * numberOfLines;
                    const targetWidth = targetHeight / height * width;
                    dispatch(actions.changeTargetSize(targetWidth, targetHeight));

                    dispatch(actions.changeStage(STAGE_PREVIEWED));
                })
                .catch((err) => {
                    console.error('error processing text', err);
                });
        };
    }
};

// reducers
export default function reducer(state = initialState, action) {
    switch (action.type) {
    case ACTION_CHANGE_STAGE: {
        return Object.assign({}, state, {
            stage: action.stage
        });
    }
    case ACTION_CHANGE_WORK_STATE: {
        return Object.assign({}, state, {
            workState: action.workState
        });
    }
    case ACTION_CHANGE_SOURCE_IMAGE: {
        return Object.assign({}, state, {
            source: {
                image: action.image,
                width: action.width || state.source.width, // keep width & height unchanged
                height: action.height || state.source.height
            }
        });
    }
    // target setState
    case ACTION_TARGET_SET_STATE: {
        const target = Object.assign({}, state.target, action.state);
        return Object.assign({}, state, { target });
    }
    case ACTION_CHANGE_TARGET_SIZE: {
        const ratio = action.width / action.height;
        let { width, height } = action;
        if (width >= height && width > BOUND_SIZE) {
            width = BOUND_SIZE;
            height = BOUND_SIZE / ratio;
        }
        if (height >= width && height > BOUND_SIZE) {
            width = BOUND_SIZE * ratio;
            height = BOUND_SIZE;
        }
        const target = Object.assign({}, state.target, {
            width: width,
            height: height
        });
        return Object.assign({}, state, { target });
    }
    case ACTION_CHANGE_OUTPUT: {
        return Object.assign({}, state, {
            output: {
                gcodePath: action.gcodePath
            }
        });
    }
    case ACTION_ADD_FONT: {
        return Object.assign({}, state, {
            fonts: state.fonts.concat([action.font])
        });
    }
    case ACTION_CHANGE_FONTS: {
        return Object.assign({}, state, {
            fonts: action.fonts
        });
    }
    // text mode
    case ACTION_TEXT_MODE_SET_STATE: {
        const textMode = Object.assign({}, state.textMode, action.state);
        return Object.assign({}, state, {
            stage: STAGE_IMAGE_LOADED, // once parameters changed, set stage back to STAGE_IMAGE_LOADED
            textMode
        });
    }
    default:
        return state;
    }
}
