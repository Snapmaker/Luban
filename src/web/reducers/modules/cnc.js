// cnc reducer
import * as THREE from 'three';
import api from '../../api';
import {
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_HEIGHT,
    DEFAULT_SIZE_WIDTH,
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    STAGE_IDLE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED
} from '../../constants';
import compareObjectContent from '../compareObjectContent';
import { generateGcodeStr, generateToolPathObject3D, generateImageObject3D } from '../generator';

const ACTION_CHANGE_STAGE = 'cnc/CHANGE_STAGE';
const ACTION_CHANGE_WORK_STATE = 'cnc/CHANGE_WORK_STATE';

const ACTION_CHANGE_IMAGE_PARAMS = 'cnc/ACTION_CHANGE_IMAGE_PARAMS';
const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';
const ACTION_CHANGE_PATH_PARAMS = 'cnc/ACTION_CHANGE_PATH_PARAMS';
const ACTION_CHANGE_GCODE_PARAMS = 'cnc/ACTION_CHANGE_GCODE_PARAMS';
const ACTION_CHANGE_OUTPUT = 'cnc/ACTION_CHANGE_OUTPUT';

const ACTION_CHANGE_TOOL_PATH_STR = 'cnc/ACTION_CHANGE_TOOL_PATH_STR';

const ACTION_CHANGE_DISPLAYED_OBJECT3D = 'cnc/ACTION_CHANGE_DISPLAYED_OBJECT3D';

const getToolPathParams = (state) => {
    // todo: delete unused params
    const { imageParams, toolParams, pathParams } = state;
    return {
        // model parameters
        type: 'cnc',
        mode: 'vector',

        // common
        originWidth: imageParams.originWidth,
        originHeight: imageParams.originHeight,
        imageSrc: imageParams.imageSrc,
        sizeWidth: imageParams.sizeWidth,
        sizeHeight: imageParams.sizeHeight,
        anchor: imageParams.anchor,

        // tool parameters
        toolDiameter: toolParams.toolDiameter,
        toolAngle: toolParams.toolAngle,

        // path parameters
        pathType: pathParams.pathType,
        targetDepth: pathParams.targetDepth,
        stepDown: pathParams.stepDown,
        safetyHeight: pathParams.safetyHeight,
        stopHeight: pathParams.stopHeight,
        clip: pathParams.clip,
        // tab
        enableTab: pathParams.enableTab,
        tabWidth: pathParams.tabWidth,
        tabHeight: pathParams.tabHeight,
        tabSpace: pathParams.tabSpace,

        // use placeholder to generate tool path
        jogSpeed: 'jogSpeed',
        workSpeed: 'workSpeed',
        plungeSpeed: 'plungeSpeed'
    };
};

const getGcodeParams = (state) => {
    return state.gcodeParams;
};

const initialState = {
    stage: STAGE_IDLE,
    workState: 'idle',
    imageParams: {
        imageSrc: '',
        originWidth: 0, // unit: pixel
        originHeight: 0,
        sizeWidth: 0, // unit: mm
        sizeHeight: 0,
        anchor: ''
    },

    toolParams: {
        toolDiameter: 3.175, // tool diameter (in mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    },

    pathParams: {
        pathType: 'path', // default is "path". "path" or "outline"
        targetDepth: 2.2,
        stepDown: 0.8,
        safetyHeight: 3,
        stopHeight: 10,
        clip: true,
        // tab
        enableTab: false,
        tabWidth: 2,
        tabHeight: -1,
        tabSpace: 24
    },

    gcodeParams: {
        jogSpeed: 800,
        workSpeed: 300,
        plungeSpeed: 500
    },

    output: {
        gcodeStr: ''
    },

    toolPathStr: '',

    displayedObject3D: null // display to Canvas. one of "image object3D" or toolPath Object3D"
};

export const actions = {
    loadDefaultImage: () => (dispatch) => {
        const imageParams = {
            imageSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
            anchor: 'Center'
        };
        dispatch(actions.tryToChangeImageParams(imageParams));
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
    displayImage: () => (dispatch, getState) => {
        const { imageParams, displayedObject3D } = getState().cnc;
        let imageParamsBinded = '';
        if (displayedObject3D) {
            imageParamsBinded = displayedObject3D.userData;
        }
        if (!compareObjectContent(imageParams, imageParamsBinded)) {
            const { imageSrc, sizeWidth, sizeHeight, anchor } = imageParams;
            const object3D = generateImageObject3D(imageSrc, sizeWidth, sizeHeight, anchor);
            object3D.userData = { ...imageParams };
            dispatch(actions.changeDisplayedObject3D(object3D));
            dispatch(actions.changeStage(STAGE_IMAGE_LOADED));
        }
    },
    displayToolPath: () => (dispatch, getState) => {
        // todo: change displayed tool path object3D only when params changed
        const { toolPathStr } = getState().cnc;
        const object3D = generateToolPathObject3D(toolPathStr);
        dispatch(actions.changeDisplayedObject3D(object3D));
        dispatch(actions.changeStage(STAGE_PREVIEWED));
    },
    // change displayed image if params changed
    tryToChangeImageParams: (params) => (dispatch, getState) => {
        const oldParams = getState().cnc.imageParams;
        const newParams = {
            ...oldParams,
            ...params
        };
        if (!compareObjectContent(oldParams, newParams)) {
            dispatch(actions.changeImageParams(params));
            dispatch(actions.displayImage());
        }
    },
    changeImageParams: (params) => {
        return {
            type: ACTION_CHANGE_IMAGE_PARAMS,
            params
        };
    },
    tryToChangeToolParams: (params) => (dispatch, getState) => {
        const oldParams = getState().cnc.toolParams;
        const newParams = {
            ...oldParams,
            ...params
        };
        if (!compareObjectContent(oldParams, newParams)) {
            dispatch(actions.changeToolParams(params));
            dispatch(actions.displayImage());
        }
    },
    changeToolParams: (params) => {
        return {
            type: ACTION_CHANGE_TOOL_PARAMS,
            params
        };
    },
    tryToChangePathParams: (params) => (dispatch, getState) => {
        const oldParams = getState().cnc.pathParams;
        const newParams = {
            ...oldParams,
            ...params
        };
        if (!compareObjectContent(oldParams, newParams)) {
            dispatch(actions.changePathParams(params));
            dispatch(actions.displayImage());
        }
    },
    changePathParams: (params) => {
        return {
            type: ACTION_CHANGE_PATH_PARAMS,
            params
        };
    },
    changeGcodeParams: (params) => {
        return {
            type: ACTION_CHANGE_GCODE_PARAMS,
            params
        };
    },
    changeOutput: (params) => {
        return {
            type: ACTION_CHANGE_OUTPUT,
            params
        };
    },
    uploadImage: (file, onFailure) => (dispatch, getState) => {
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const image = res.body;
                const imageSrc = `${WEB_CACHE_IMAGE}/${image.filename}`;
                // check ranges of width / height
                let { width, height } = image;
                const ratio = width / height;
                if (width >= height && width > BOUND_SIZE) {
                    width = BOUND_SIZE;
                    height = BOUND_SIZE / ratio;
                }
                if (height >= width && height > BOUND_SIZE) {
                    width = BOUND_SIZE * ratio;
                    height = BOUND_SIZE;
                }
                const imageParams = {
                    imageSrc: imageSrc,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: width,
                    sizeHeight: height,
                    anchor: 'Center'
                };

                dispatch(actions.tryToChangeImageParams(imageParams));
            })
            .catch(() => {
                onFailure && onFailure();
            });
    },
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
    preview: () => (dispatch) => {
        dispatch(actions.generateToolPath());
    },
    generateGCode: () => (dispatch, getState) => {
        const state = getState().cnc;
        const params = getGcodeParams(state);
        const toolPathObj = JSON.parse(state.toolPathStr);
        toolPathObj.params = params;
        const gcodeStr = generateGcodeStr(toolPathObj);
        dispatch(actions.changeOutput({ gcodeStr: gcodeStr }));
        dispatch(actions.changeStage(STAGE_GENERATED));
    },
    generateToolPath: () => (dispatch, getState) => {
        const state = getState().cnc;
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
                        dispatch(actions.displayToolPath());
                    }
                );
            });
    }
};

export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_CHANGE_IMAGE_PARAMS: {
            const params = Object.assign({}, state.imageParams, action.params);
            return Object.assign({}, state, { imageParams: params });
        }
        case ACTION_CHANGE_TOOL_PARAMS: {
            const params = Object.assign({}, state.toolParams, action.params);
            return Object.assign({}, state, { toolParams: params });
        }
        case ACTION_CHANGE_PATH_PARAMS: {
            const params = Object.assign({}, state.pathParams, action.params);
            return Object.assign({}, state, { pathParams: params });
        }
        case ACTION_CHANGE_GCODE_PARAMS: {
            const params = Object.assign({}, state.gcodeParams, action.params);
            return Object.assign({}, state, { gcodeParams: params });
        }
        case ACTION_CHANGE_OUTPUT: {
            const params = Object.assign({}, state.output, action.params);
            return Object.assign({}, state, { output: params });
        }
        case ACTION_CHANGE_STAGE: {
            return Object.assign({}, state, { stage: action.stage });
        }
        case ACTION_CHANGE_WORK_STATE: {
            return Object.assign({}, state, { workState: action.workState });
        }
        case ACTION_CHANGE_DISPLAYED_OBJECT3D: {
            return Object.assign({}, state, { displayedObject3D: action.object3D });
        }
        case ACTION_CHANGE_TOOL_PATH_STR: {
            return Object.assign({}, state, { toolPathStr: action.toolPathStr });
        }
        default:
            return state;
    }
}
