// cnc reducer
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

const ACTION_CHANGE_STAGE = 'cnc/CHANGE_STAGE';
const ACTION_CHANGE_WORK_STATE = 'cnc/CHANGE_WORK_STATE';

const ACTION_CHANGE_IMAGE_PARAMS = 'cnc/ACTION_CHANGE_IMAGE_PARAMS';
const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';
const ACTION_CHANGE_PATH_PARAMS = 'cnc/ACTION_CHANGE_PATH_PARAMS';
const ACTION_CHANGE_GCODE_PARAMS = 'cnc/ACTION_CHANGE_GCODE_PARAMS';
const ACTION_CHANGE_OUTPUT = 'cnc/ACTION_CHANGE_OUTPUT';

const ACTION_PREVIEW = 'cnc/ACTION_PREVIEW';

const getGenerateGCodeParams = (state) => {
    const { imageParams, toolParams, pathParams, gcodeParams } = state;
    return {
        // model parameters
        type: 'cnc',
        mode: 'vector',

        // common
        originSrc: imageParams.originSrc,
        originWidth: imageParams.originWidth,
        originHeight: imageParams.originHeight,
        imageSrc: imageParams.imageSrc,
        sizeWidth: imageParams.sizeWidth,
        sizeHeight: imageParams.sizeHeight,

        // tool parameters
        toolDiameter: toolParams.toolDiameter,
        toolAngle: toolParams.toolAngle,

        // path parameters
        pathType: pathParams.pathType,
        targetDepth: pathParams.targetDepth,
        stepDown: pathParams.stepDown,
        safetyHeight: pathParams.safetyHeight,
        stopHeight: pathParams.stopHeight,
        anchor: pathParams.anchor,
        clip: pathParams.clip,
        // tab
        enableTab: pathParams.enableTab,
        tabWidth: pathParams.tabWidth,
        tabHeight: pathParams.tabHeight,
        tabSpace: pathParams.tabSpace,

        // G-code parameters
        jogSpeed: gcodeParams.jogSpeed,
        workSpeed: gcodeParams.workSpeed,
        plungeSpeed: gcodeParams.plungeSpeed
    };
};

const initialState = {
    stage: STAGE_IDLE,
    workState: 'idle',
    imageParams: {
        originSrc: '',
        originWidth: 0,
        originHeight: 0,

        imageSrc: '',
        sizeWidth: 0,
        sizeHeight: 0
    },

    toolParams: {
        toolDiameter: 3.175, // tool diameter (in mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    },

    pathParams: {
        pathType: 'path', // default
        targetDepth: 2.2,
        stepDown: 0.8,
        safetyHeight: 3,
        stopHeight: 10,
        anchor: 'center',
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
        gcodePath: ''
    }
};

export const actions = {
    loadDefaultImage: () => (dispatch) => {
        const imageParams = {
            originSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,

            imageSrc: DEFAULT_VECTOR_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10
        };
        dispatch(actions.changeImageParams(imageParams));
        dispatch(actions.changeStage(STAGE_IMAGE_LOADED));
    },
    changeImageParams: (params) => {
        return {
            type: ACTION_CHANGE_IMAGE_PARAMS,
            params
        };
    },
    changeToolParams: (params) => {
        return {
            type: ACTION_CHANGE_TOOL_PARAMS,
            params
        };
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
    uploadImage: (file, onFailure) => (dispatch) => {
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const image = res.body;
                const src = `${WEB_CACHE_IMAGE}/${image.filename}`;
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
                    originSrc: src,
                    originWidth: image.width,
                    originHeight: image.height,

                    imageSrc: src,
                    sizeWidth: width,
                    sizeHeight: height
                };
                dispatch(actions.changeImageParams(imageParams));
                dispatch(actions.changeStage(STAGE_IMAGE_LOADED));
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
    preview: () => {
        // TODO: draw outline of polygon and show
        return {
            type: ACTION_PREVIEW
        };
    },
    generateGCode: (state) => (dispatch) => {
        // ? Which params are needed ?
        const data = getGenerateGCodeParams(state);
        api.generateGCode(data).then((res) => {
            const gcodePath = `${WEB_CACHE_IMAGE}/${res.body.gcodePath}`;
            dispatch(actions.changeStage(STAGE_GENERATED));
            dispatch(actions.changeOutput({ gcodePath: gcodePath }));
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
        case ACTION_PREVIEW: {
            return Object.assign({}, state, { stage: STAGE_PREVIEWED });
        }
        default:
            return state;
    }
}
