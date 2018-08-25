// Laser reducer

import {
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT
} from '../../constants';
import api from '../../api';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';

// state
const initialState = {
    mode: 'bw',
    stage: STAGE_IDLE,
    workState: 'idle',
    source: {
        filename: '(default image)',
        image: DEFAULT_RASTER_IMAGE,
        processed: DEFAULT_RASTER_IMAGE, // move to a proper position?
        width: DEFAULT_SIZE_WIDTH / 10,
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
    // bw mode
    bwMode: {
        bwThreshold: 168,
        direction: 'Horizontal',
        density: 10
    },
    // greyscale mode
    greyscaleMode: {
        contrast: 50,
        brightness: 50,
        whiteClip: 255,
        algorithm: 'FloyedSteinburg',
        density: 10
    },
    // vector mode
    vectorMode: {
        subMode: 'svg',
        vectorThreshold: 128,
        isInvert: false,
        turdSize: 2,
        optimizePath: true
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
const ACTION_CHANGE_WORK_STATE = 'laser/CHANGE_WORK_STATE';
const ACTION_CHANGE_SOURCE_IMAGE = 'laser/CHANGE_SOURCE_IMAGE';
const ACTION_CHANGE_PROCESSED_IMAGE = 'laser/CHANGE_PROCESSED_IMAGE';
const ACTION_TARGET_SET_STATE = 'laser/TARGET_SET_STATE';
const ACTION_CHANGE_TARGET_SIZE = 'laser/CHANGE_TARGET_SIZE';
const ACTION_CHANGE_OUTPUT = 'laser/CHANGE_OUTPUT';
const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_CHANGE_FONTS = 'laser/CHANGE_FONTS';

const ACTION_SET_STATE = 'laser/setState';
const ACTION_BW_MODE_SET_STATE = 'laser/bwMode/setState';
const ACTION_GREYSCALE_MODE_SET_STATE = 'laser/greyscaleMode/setState';
const ACTION_VECTOR_MODE_SET_STATE = 'laser/vectorMode/setState';
const ACTION_TEXT_MODE_SET_STATE = 'laser/textMode/setState';

export const actions = {
    // no-reducer setState
    setState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state
        };
    },
    bwSetState: (state) => {
        return {
            type: ACTION_BW_MODE_SET_STATE,
            state
        };
    },
    greyscaleSetState: (state) => {
        return {
            type: ACTION_GREYSCALE_MODE_SET_STATE,
            state
        };
    },
    vectorModeSetState: (state) => {
        return {
            type: ACTION_VECTOR_MODE_SET_STATE,
            state
        };
    },
    textModeSetState: (state) => {
        return {
            type: ACTION_TEXT_MODE_SET_STATE,
            state
        };
    },

    // actions
    switchMode: (mode) => (dispatch, getState) => {
        const state = getState().laser;

        dispatch(actions.setState({ mode: mode }));
        if (mode === 'bw') {
            dispatch(actions.changeSourceImage(DEFAULT_RASTER_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
            dispatch(actions.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10));
        } else if (mode === 'greyscale') {
            dispatch(actions.changeSourceImage(DEFAULT_RASTER_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
            dispatch(actions.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10));
        } else if (mode === 'vector') {
            if (state.vectorMode.subMode === 'svg') {
                dispatch(actions.changeSourceImage(DEFAULT_VECTOR_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
            } else {
                dispatch(actions.changeSourceImage(DEFAULT_RASTER_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
            }
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
            dispatch(actions.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10));
        } else {
            // clear image
            dispatch(actions.changeSourceImage('', '', 1, 1));
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
        }
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_CHANGE_WORK_STATE,
            workState
        };
    },
    changeSourceImage: (image, filename, width, height) => {
        return {
            type: ACTION_CHANGE_SOURCE_IMAGE,
            image,
            filename,
            width,
            height
        };
    },
    uploadImage: (file, onFailure) => (dispatch) => {
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const image = res.body;
                dispatch(actions.changeSourceImage(`${WEB_CACHE_IMAGE}/${image.filename}`, image.filename, image.width, image.height));
                dispatch(actions.changeTargetSize(image.width, image.height));
            })
            .catch(() => {
                onFailure && onFailure();
            });
    },
    changeProcessedImage: (processed) => {
        return {
            type: ACTION_CHANGE_PROCESSED_IMAGE,
            processed
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
    generateGcode: () => (dispatch, getState) => {
        const state = getState().laser;

        const options = {
            type: 'laser', // hard-coded laser
            mode: state.mode,
            source: state.source,
            target: state.target
        };
        if (state.mode === 'bw') {
            options.bwMode = state.bwMode;
        } else if (state.mode === 'greyscale') {
            options.greyscaleMode = state.greyscaleMode;
        } else if (state.mode === 'vector') {
            options.vectorMode = state.vectorMode;
        } else if (state.mode === 'text') {
            // options.textMode = state.textMode;
        }

        api.generateGCode(options).then((res) => {
            // update output
            dispatch(actions.changeOutputGcodePath(res.body.gcodePath));

            // change stage
            dispatch(actions.setState({ stage: STAGE_GENERATED }));
        }).catch((err) => {
            // log.error(String(err));
        });
    },

    bwModePreview: () => (dispatch, getState) => {
        const state = getState().laser;

        const options = {
            mode: 'bw',
            image: state.source.image,
            width: state.target.width,
            height: state.target.height,
            bwThreshold: state.bwMode.bwThreshold,
            density: state.bwMode.density
        };

        api.processImage(options)
            .then((res) => {
                const { filename } = res.body;
                const path = `${WEB_CACHE_IMAGE}/${filename}`;

                dispatch(actions.changeProcessedImage(path));

                dispatch(actions.setState({ stage: STAGE_PREVIEWED }));
            });
    },

    greyscaleModePreview: () => (dispatch, getState) => {
        const state = getState().laser;

        const options = {
            mode: state.mode,
            image: state.source.image,
            width: state.target.width,
            height: state.target.height,
            contrast: state.greyscaleMode.contrast,
            brightness: state.greyscaleMode.brightness,
            whiteClip: state.greyscaleMode.whiteClip,
            algorithm: state.greyscaleMode.algorithm,
            density: state.greyscaleMode.density
        };

        api.processImage(options)
            .then((res) => {
                const { filename } = res.body;
                const path = `${WEB_CACHE_IMAGE}/${filename}`;

                dispatch(actions.changeProcessedImage(path));

                dispatch(actions.setState({ stage: STAGE_PREVIEWED }));
            });
    },
    vectorModePreview: () => (dispatch, getState) => {
        const state = getState().laser;

        if (state.vectorMode.subMode === 'svg') {
            dispatch(actions.setState({ stage: STAGE_PREVIEWED }));
            return;
        }

        const options = {
            mode: state.mode,
            image: state.source.image,
            // width: state.target.width,
            // height: state.target.height,
            vectorThreshold: state.vectorMode.vectorThreshold,
            isInvert: state.vectorMode.isInvert,
            turdSize: state.vectorMode.turdSize
        };

        api.processImage(options)
            .then((res) => {
                const { filename } = res.body;
                const path = `${WEB_CACHE_IMAGE}/${filename}`;

                dispatch(actions.changeProcessedImage(path));

                dispatch(actions.setState({ stage: STAGE_PREVIEWED }));
            });
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
    textModePreview: () => (dispatch, getState) => {
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
                dispatch(actions.changeSourceImage(path, filename, width, height));

                const numberOfLines = state.textMode.text.split('\n').length;
                const targetHeight = state.textMode.size / 72 * 25.4 * numberOfLines;
                const targetWidth = targetHeight / height * width;
                dispatch(actions.changeTargetSize(targetWidth, targetHeight));

                dispatch(actions.setState({ stage: STAGE_PREVIEWED }));
            })
            .catch((err) => {
                console.error('error processing text', err);
            });
    }
};

// reducers
export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, action.state);
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
                    processed: action.image,
                    filename: action.filename,
                    width: action.width,
                    height: action.height
                }
            });
        }
        case ACTION_CHANGE_PROCESSED_IMAGE: {
            const source = Object.assign({}, state.source, {
                processed: action.processed
            });
            return Object.assign({}, state, { source });
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
                height = toFixed(BOUND_SIZE / ratio, 2);
            }
            if (height >= width && height > BOUND_SIZE) {
                width = toFixed(BOUND_SIZE * ratio, 2);
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
        case ACTION_BW_MODE_SET_STATE: {
            const bwMode = Object.assign({}, state.bwMode, action.state);
            return Object.assign({}, state, {
                stage: STAGE_IMAGE_LOADED, // once parameters changed, set stage back to STAGE_IMAGE_LOADED
                bwMode
            });
        }
        case ACTION_GREYSCALE_MODE_SET_STATE: {
            const greyscaleMode = Object.assign({}, state.greyscaleMode, action.state);
            return Object.assign({}, state, {
                stage: STAGE_IMAGE_LOADED, // once parameters changed, set stage back to STAGE_IMAGE_LOADED
                greyscaleMode
            });
        }
        case ACTION_VECTOR_MODE_SET_STATE: {
            const vectorMode = Object.assign({}, state.vectorMode, action.state);
            return Object.assign({}, state, {
                stage: STAGE_IMAGE_LOADED, // once parameters changed, set stage back to STAGE_IMAGE_LOADED
                vectorMode
            });
        }
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
