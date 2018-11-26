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
import ToolPathRender from '../../widgets/ToolPathRender';
import GcodeGenerator from '../../widgets/GcodeGenerator';

const ACTION_CHANGE_STAGE = 'cnc/CHANGE_STAGE';
const ACTION_CHANGE_WORK_STATE = 'cnc/CHANGE_WORK_STATE';

const ACTION_CHANGE_IMAGE_PARAMS = 'cnc/ACTION_CHANGE_IMAGE_PARAMS';
const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';
const ACTION_CHANGE_PATH_PARAMS = 'cnc/ACTION_CHANGE_PATH_PARAMS';
const ACTION_CHANGE_GCODE_PARAMS = 'cnc/ACTION_CHANGE_GCODE_PARAMS';
const ACTION_CHANGE_OUTPUT = 'cnc/ACTION_CHANGE_OUTPUT';

const ACTION_PREVIEW = 'cnc/ACTION_PREVIEW';

const ACTION_CHANGE_TOOL_PATH_STR = 'cnc/ACTION_CHANGE_TOOL_PATH_STR';

const ACTION_CHANGE_TOOL_PATH_OBJECT3D = 'cnc/ACTION_CHANGE_TOOL_PATH_RENDERED';
const ACTION_CHANGE_IMAGE_OBJECT3D = 'cnc/ACTION_CHANGE_IMAGE_OBJECT3D';
const ACTION_CHANGE_DISPLAYED_OBJECT3D = 'cnc/ACTION_CHANGE_DISPLAYED_OBJECT3D';

const getToolPathParams = (state) => {
    const { imageParams, toolParams, pathParams } = state;
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

        // use placeholder to generate tool path
        jogSpeed: 'jogSpeed',
        workSpeed: 'workSpeed',
        plungeSpeed: 'plungeSpeed'
    };
};

const getGcodeParams = (state) => {
    return state.gcodeParams;
};

const generateImageObject3D = (state) => {
    const { imageSrc, sizeWidth, sizeHeight } = state.imageParams;
    const { anchor } = state.pathParams;
    if (!imageSrc || !sizeWidth || !sizeHeight || !anchor) {
        return null;
    }
    const geometry = new THREE.PlaneGeometry(sizeWidth, sizeHeight);
    const texture = new THREE.TextureLoader().load(imageSrc);
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
            position = new THREE.Vector3(sizeWidth / 2, sizeHeight / 2, 0);
            break;
        case 'Bottom Middle':
            position = new THREE.Vector3(0, sizeHeight / 2, 0);
            break;
        case 'Bottom Right':
            position = new THREE.Vector3(-sizeWidth / 2, sizeHeight / 2, 0);
            break;
        case 'Top Left':
            position = new THREE.Vector3(sizeWidth / 2, -sizeHeight / 2, 0);
            break;
        case 'Top Middle':
            position = new THREE.Vector3(0, -sizeHeight / 2, 0);
            break;
        case 'Top Right':
            position = new THREE.Vector3(-sizeWidth / 2, -sizeHeight / 2, 0);
            break;
        default:
            break;
    }
    object3D.position.copy(position);
    return object3D;
};

const generateToolPathObject3D = (toolPathStr) => {
    const toolPathRender = new ToolPathRender();
    const object3D = toolPathRender.render(toolPathStr);
    object3D.position.set(0, 0, 0);
    object3D.scale.set(1, 1, 1);
    return object3D;
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
        gcodeStr: ''
    },

    toolPathStr: '',

    // threejs object3D
    imageObject3D: null,
    toolPathObject3D: null,
    displayedObject3D: null // display to Canvas. one of "imageObject3D, toolPathObject3D"
};

export const actions = {
    loadDefaultImage: () => (dispatch, getState) => {
        const imageParams = {
            originSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,

            imageSrc: DEFAULT_VECTOR_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10
        };
        dispatch(actions.changeImageParams(imageParams));

        const object3D = generateImageObject3D(getState().cnc);
        dispatch(actions.changeImageObject3D(object3D));
        dispatch(actions.changeDisplayedObject3D(object3D));

        dispatch(actions.changeStage(STAGE_IMAGE_LOADED));
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
    uploadImage: (file, onFailure) => (dispatch, getState) => {
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

                const object3D = generateImageObject3D(getState().cnc);
                dispatch(actions.changeImageObject3D(object3D));
                dispatch(actions.changeDisplayedObject3D(object3D));

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
    preview: () => (dispatch) => {
        dispatch(actions.generateToolPath());
    },
    generateGCode: () => (dispatch, getState) => {
        const state = getState().cnc;
        const params = getGcodeParams(state);
        const toolPathObj = JSON.parse(state.toolPathStr);
        toolPathObj.params = params;

        const gcodeGenerator = new GcodeGenerator();
        const gcodeStr = gcodeGenerator.parseToolPathObjToGcode(toolPathObj);

        dispatch(actions.changeOutput({ gcodeStr: gcodeStr }));
        dispatch(actions.changeStage(STAGE_GENERATED));
    },
    generateToolPath: () => (dispatch, getState) => {
        const state = getState().cnc;
        const params = getToolPathParams(state);

        api.generateToolPath(params)
            .then((res) => {
                const toolPathFilePath = `${WEB_CACHE_IMAGE}/${res.body.tooPathFilename}`;
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
        default:
            return state;
    }
}
