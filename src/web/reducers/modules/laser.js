// Laser reducer
import * as THREE from 'three';
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
import ToolPathRenderer from '../../widgets/ToolPathRenderer';
import GcodeGenerator from '../../widgets/GcodeGenerator';

const getToolPathParams = (state) => {
    const target = {
        ...state.target,
        jogSpeed: 'jogSpeed',
        workSpeed: 'workSpeed',
        dwellTime: 'dwellTime'
    };

    const params = {
        type: 'laser', // hard-coded laser
        mode: state.mode,
        source: state.source,
        target: target,
        multiPass: state.multiPass
    };

    if (state.mode === 'bw') {
        params.bwMode = state.bwMode;
    } else if (state.mode === 'greyscale') {
        params.greyscaleMode = state.greyscaleMode;
    } else if (state.mode === 'vector') {
        params.vectorMode = state.vectorMode;
    } else if (state.mode === 'text') {
        params.textMode = state.textMode;
    }

    return params;
};

const getGcodeParams = (state) => {
    const target = state.target;
    const params = {
        jogSpeed: target.jogSpeed,
        workSpeed: target.workSpeed,
        dwellTime: target.dwellTime,
        fixedPowerEnabled: target.fixedPowerEnabled,
        fixedPower: target.fixedPower,
        multiPass: state.multiPass
    };
    return params;
};

const generateImageObject3D = (state) => {
    const { source, target } = state;
    const { image } = source;
    const { width, height, anchor } = target;

    if (!image || !width || !height || !anchor) {
        return null;
    }

    const geometry = new THREE.PlaneGeometry(width, height);
    const texture = new THREE.TextureLoader().load(image);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        opacity: 0.75,
        transparent: true
    });
    const object3D = new THREE.Mesh(geometry, material);
    let position = new THREE.Vector3(0, 0, 0);
    switch (anchor) {
        case 'Center':
        case 'Center Left':
        case 'Center Right':
            position = new THREE.Vector3(0, 0, 0);
            break;
        case 'Bottom Left':
            position = new THREE.Vector3(width / 2, height / 2, 0);
            break;
        case 'Bottom Middle':
            position = new THREE.Vector3(0, height / 2, 0);
            break;
        case 'Bottom Right':
            position = new THREE.Vector3(-width / 2, height / 2, 0);
            break;
        case 'Top Left':
            position = new THREE.Vector3(width / 2, -height / 2, 0);
            break;
        case 'Top Middle':
            position = new THREE.Vector3(0, -height / 2, 0);
            break;
        case 'Top Right':
            position = new THREE.Vector3(-width / 2, -height / 2, 0);
            break;
        default:
            break;
    }
    object3D.position.copy(position);
    return object3D;
};

const generateToolPathObject3D = (toolPathStr) => {
    const toolPathRenderer = new ToolPathRenderer();
    const object3D = toolPathRenderer.render(toolPathStr);
    object3D.position.set(0, 0, 0);
    object3D.scale.set(1, 1, 1);
    return object3D;
};

// state
const initialState = {
    mode: 'bw',
    stage: STAGE_IDLE,
    workState: 'idle',
    source: {
        accept: '.png, .jpg, .jpeg, .bmp',
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
        dwellTime: 42,
        fixedPowerEnabled: false, // whether to use fixed power setting
        fixedPower: 100
    },
    multiPass: {
        enabled: false,
        passes: 2,
        depth: 1 // unit is mm
    },
    output: {
        gcodeStr: ''
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
        fillEnabled: false,
        fillDensity: 10,
        optimizePath: true
    },
    // text mode parameters
    textMode: {
        text: 'Snapmaker',
        size: 24,
        font: 'Georgia',
        lineHeight: 1.5,
        alignment: 'left', // left, middle, right
        fillEnabled: true,
        fillDensity: 10
    },
    // available fonts to use
    fonts: [],

    toolPathStr: '',

    // threejs object3D
    imageObject3D: null,
    toolPathObject3D: null,
    displayedObject3D: null
};

// actions
const ACTION_CHANGE_WORK_STATE = 'laser/CHANGE_WORK_STATE';
const ACTION_CHANGE_PROCESSED_IMAGE = 'laser/CHANGE_PROCESSED_IMAGE';
const ACTION_TARGET_SET_STATE = 'laser/TARGET_SET_STATE';
const ACTION_CHANGE_TARGET_SIZE = 'laser/CHANGE_TARGET_SIZE';
const ACTION_CHANGE_OUTPUT = 'laser/CHANGE_OUTPUT';
const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_CHANGE_FONTS = 'laser/CHANGE_FONTS';

const ACTION_SET_STATE = 'laser/setState';
const ACTION_SOURCE_SET_STATE = 'laser/source/setState';
const ACTION_BW_MODE_SET_STATE = 'laser/bwMode/setState';
const ACTION_GREYSCALE_MODE_SET_STATE = 'laser/greyscaleMode/setState';
const ACTION_VECTOR_MODE_SET_STATE = 'laser/vectorMode/setState';
const ACTION_TEXT_MODE_SET_STATE = 'laser/textMode/setState';
const ACTION_MULTI_PASS_SET_STATE = 'laser/multiPass/setState';

const ACTION_CHANGE_TOOL_PATH_STR = 'laser/ACTION_CHANGE_TOOL_PATH_STR';

const ACTION_CHANGE_TOOL_PATH_OBJECT3D = 'laser/ACTION_CHANGE_TOOL_PATH_RENDERED';
const ACTION_CHANGE_IMAGE_OBJECT3D = 'laser/ACTION_CHANGE_IMAGE_OBJECT3D';
const ACTION_CHANGE_DISPLAYED_OBJECT3D = 'laser/ACTION_CHANGE_DISPLAYED_OBJECT3D';

const ACTION_CHANGE_STAGE = 'laser/CHANGE_STAGE';

export const actions = {
    changeStage: (stage) => {
        return {
            type: ACTION_CHANGE_STAGE,
            stage
        };
    },
    changeImageObject3D: (object3D) => {
        return {
            type: ACTION_CHANGE_IMAGE_OBJECT3D,
            object3D
        };
    },
    changeToolPathObject3D: (object3D) => {
        return {
            type: ACTION_CHANGE_TOOL_PATH_OBJECT3D,
            object3D
        };
    },
    changeDisplayedObject3D: (object3D) => {
        return {
            type: ACTION_CHANGE_DISPLAYED_OBJECT3D,
            object3D
        };
    },
    changeToolPathStr: (toolPathStr) => {
        return {
            type: ACTION_CHANGE_TOOL_PATH_STR,
            toolPathStr
        };
    },

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
    sourceSetState: (state) => {
        return {
            type: ACTION_SOURCE_SET_STATE,
            state
        };
    },
    targetSetState: (state) => {
        return {
            type: ACTION_TARGET_SET_STATE,
            state
        };
    },
    multiPassSetState: (multiPass) => {
        return {
            type: ACTION_MULTI_PASS_SET_STATE,
            state: multiPass
        };
    },

    // actions
    switchMode: (mode) => (dispatch, getState) => {
        const state = getState().laser;
        let object3D = null;

        dispatch(actions.setState({ mode: mode }));
        if (mode === 'bw') {
            dispatch(actions.changeSourceImage(DEFAULT_RASTER_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
            dispatch(actions.sourceSetState({ accept: '.png, .jpg, .jpeg, .bmp' }));
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
            dispatch(actions.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10));

            object3D = generateImageObject3D(getState().laser);
        } else if (mode === 'greyscale') {
            dispatch(actions.changeSourceImage(DEFAULT_RASTER_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
            dispatch(actions.sourceSetState({ accept: '.png, .jpg, .jpeg, .bmp' }));
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
            dispatch(actions.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10));

            object3D = generateImageObject3D(getState().laser);
        } else if (mode === 'vector') {
            if (state.vectorMode.subMode === 'svg') {
                dispatch(actions.changeSourceImage(DEFAULT_VECTOR_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
                dispatch(actions.sourceSetState({ accept: '.svg' }));
            } else {
                dispatch(actions.changeSourceImage(DEFAULT_RASTER_IMAGE, i18n._('(default image)'), DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT));
                dispatch(actions.sourceSetState({ accept: '.png, .jpg, .jpeg, .bmp' }));
            }
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
            dispatch(actions.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10));

            object3D = generateImageObject3D(getState().laser);
        } else {
            // clear image
            dispatch(actions.changeSourceImage('', '', 1, 1));
            dispatch(actions.targetSetState({ anchor: 'Bottom Left' }));
        }

        dispatch(actions.changeImageObject3D(object3D));
        dispatch(actions.changeDisplayedObject3D(object3D));
        dispatch(actions.changeStage(STAGE_IMAGE_LOADED));
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_CHANGE_WORK_STATE,
            workState
        };
    },
    changeSourceImage: (image, filename, width, height) => {
        return {
            type: ACTION_SOURCE_SET_STATE,
            state: {
                image,
                filename,
                width,
                height,
                processed: image
            }
        };
    },
    uploadImage: (file, onFailure) => (dispatch, getState) => {
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const image = res.body;
                dispatch(actions.changeSourceImage(`${WEB_CACHE_IMAGE}/${image.filename}`, image.filename, image.width, image.height));
                dispatch(actions.changeTargetSize(image.width, image.height));

                const object3D = generateImageObject3D(getState().laser);
                dispatch(actions.changeImageObject3D(object3D));
                dispatch(actions.changeDisplayedObject3D(object3D));
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
    changeTargetSize: (width, height) => {
        return {
            type: ACTION_CHANGE_TARGET_SIZE,
            width,
            height
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
        const params = getGcodeParams(state);
        const toolPathObj = JSON.parse(state.toolPathStr);
        toolPathObj.params = params;

        const gcodeGenerator = new GcodeGenerator();
        const gcodeStr = gcodeGenerator.parseToolPathObjToGcode(toolPathObj);

        dispatch(actions.changeOutput({ gcodeStr: gcodeStr }));
        dispatch(actions.changeStage(STAGE_GENERATED));
    },

    generateToolPath: () => (dispatch, getState) => {
        const state = getState().laser;
        const params = getToolPathParams(state);

        api.generateToolPath(params)
            .then((res) => {
                const toolPathFilePath = `${WEB_CACHE_IMAGE}/${res.body.toolPathFilename}`;
                return toolPathFilePath;
            })
            .then((toolPathFilePath) => {
                new THREE.FileLoader().load(
                    toolPathFilePath,
                    (toolPathStr) => {
                        dispatch(actions.changeToolPathStr(toolPathStr));

                        const object3D = generateToolPathObject3D(toolPathStr);
                        dispatch(actions.changeToolPathObject3D(object3D));
                        dispatch(actions.changeDisplayedObject3D(object3D));

                        dispatch(actions.changeStage(STAGE_PREVIEWED));
                    }
                );
            })
            .catch((err) => {
                // ignore
            });
    },
    // bw
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
            })
            .then(() => {
                dispatch(actions.generateToolPath());
            });
    },

    // greyscale
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
            })
            .then(() => {
                dispatch(actions.generateToolPath());
            });
    },

    // vector
    vectorModePreview: () => (dispatch, getState) => {
        const state = getState().laser;
        if (state.vectorMode.subMode === 'svg') {
            dispatch(actions.generateToolPath());
        } else {
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
                })
                .then(() => {
                    dispatch(actions.generateToolPath());
                });
        }
    },

    // text
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
            anchor: state.textMode.anchor,
            fillEnabled: state.textMode.fillEnabled,
            fillDensity: state.textMode.fillDensity
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
            })
            .then(() => {
                dispatch(actions.generateToolPath());
            })
            .catch((err) => {
                // ignore
            });
    },
    changeOutput: (params) => {
        return {
            type: ACTION_CHANGE_OUTPUT,
            params
        };
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
        case ACTION_SOURCE_SET_STATE: {
            const source = Object.assign({}, state.source, action.state);
            return Object.assign({}, state, { source });
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
            const params = Object.assign({}, state.output, action.params);
            return Object.assign({}, state, { output: params });
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
                bwMode
            });
        }
        case ACTION_GREYSCALE_MODE_SET_STATE: {
            const greyscaleMode = Object.assign({}, state.greyscaleMode, action.state);
            return Object.assign({}, state, {
                greyscaleMode
            });
        }
        case ACTION_VECTOR_MODE_SET_STATE: {
            const vectorMode = Object.assign({}, state.vectorMode, action.state);
            return Object.assign({}, state, {
                vectorMode
            });
        }
        case ACTION_TEXT_MODE_SET_STATE: {
            const textMode = Object.assign({}, state.textMode, action.state);
            return Object.assign({}, state, {
                textMode
            });
        }
        case ACTION_MULTI_PASS_SET_STATE: {
            const multiPass = Object.assign({}, state.multiPass, action.state);
            return Object.assign({}, state, {
                multiPass
            });
        }

        case ACTION_CHANGE_IMAGE_OBJECT3D: {
            return Object.assign({}, state, { imageObject3D: action.object3D });
        }
        case ACTION_CHANGE_TOOL_PATH_OBJECT3D: {
            return Object.assign({}, state, { toolPathObject3D: action.object3D });
        }
        case ACTION_CHANGE_DISPLAYED_OBJECT3D: {
            return Object.assign({}, state, { displayedObject3D: action.object3D });
        }
        case ACTION_CHANGE_TOOL_PATH_STR: {
            return Object.assign({}, state, { toolPathStr: action.toolPathStr });
        }

        case ACTION_CHANGE_STAGE: {
            return Object.assign({}, state, { stage: action.stage });
        }
        default:
            return state;
    }
}
