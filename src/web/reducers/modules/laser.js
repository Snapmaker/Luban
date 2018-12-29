import path from 'path';
import api from '../../api';
import ModelGroup2D from '../ModelGroup2D';
import Model2D from '../Model2D';
import { CONFIG_DEFAULT_TEXT_VECTOR, generateModelInfo } from '../ModelInfoUtils';

// set: change instance
// update: update some properties of instance
const ACTION_UPDATE_STATE = 'laser/ACTION_UPDATE_STATE';

const ACTION_SET_WORK_STATE = 'laser/ACTION_SET_WORK_STATE';
const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_SET_FONTS = 'laser/ACTION_SET_FONTS';

const ACTION_UPDATE_TRANSFORMATION = 'laser/ACTION_UPDATE_TRANSFORMATION';
const ACTION_UPDATE_GCODE_CONFIG = 'laser/ACTION_UPDATE_GCODE_CONFIG';
const ACTION_UPDATE_CONFIG = 'laser/ACTION_UPDATE_CONFIG';

const computeTransformationSizeForTextVector = (modelInfo) => {
    const { config, origin } = modelInfo;
    const { text, size } = config;
    const numberOfLines = text.split('\n').length;
    const height = size / 72 * 25.4 * numberOfLines;
    const width = height / origin.height * origin.width;
    return {
        width: width,
        height: height
    };
};

const checkIsAllModelsPreviewed = (modelGroup) => {
    let isAllModelsPreviewed = true;
    const models = modelGroup.getModels();
    for (let i = 0; i < models.length; i++) {
        if (['idle', 'previewing'].includes(models[i].stage)) {
            isAllModelsPreviewed = false;
            break;
        }
    }
    return isAllModelsPreviewed;
};

const initialState = {
    modelGroup: new ModelGroup2D(),
    // the followings are updated by calling "updateState action"
    canPreview: false,
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }
    model: null, // selected model
    modelType: '', // raster, svg, text
    processMode: '', // bw, greyscale, vector
    // the followings are updated by their own actions
    transformation: {},
    gcodeConfig: {},
    config: {},
    workState: 'idle', // workflowState: idle, running, paused
    fonts: [], // available fonts to use
};

export const actions = {
    updateState: (params) => {
        return {
            type: ACTION_UPDATE_STATE,
            params
        };
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_SET_WORK_STATE,
            workState
        };
    },
    // operate model
    uploadImage: (file, processMode, onFailure) => (dispatch, getState) => {
        const state = getState().laser;
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, filename } = res.body;
                const origin = {
                    width: width,
                    height: height,
                    filename: filename
                };

                let modelType = 'raster';
                if (path.extname(file.name).toLowerCase() === '.svg') {
                    modelType = 'svg';
                    processMode = 'vector';
                }

                const modelInfo = generateModelInfo(modelType, processMode, origin);
                const model2D = new Model2D(modelInfo);
                state.modelGroup.addModel(model2D);

                dispatch(actions.updateState({
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }));
            })
            .catch(() => {
                onFailure && onFailure();
            });
    },
    insertDefaultTextVector: () => (dispatch, getState) => {
        const state = getState().laser;
        const options = CONFIG_DEFAULT_TEXT_VECTOR;
        api.convertTextToSvg(options)
            .then((res) => {
                const { width, height, filename } = res.body;
                const origin = {
                    width: width,
                    height: height,
                    filename: filename
                };
                const modelInfo = generateModelInfo('text', 'vector', origin);
                const transformationSize = computeTransformationSizeForTextVector(modelInfo);
                const model2D = new Model2D(modelInfo);
                model2D.updateTransformation(transformationSize);
                state.modelGroup.addModel(model2D);

                dispatch(actions.updateState({
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }));
            });
    },
    previewSelectedModel: () => (dispatch, getState) => {
        const state = getState().laser;
        const { modelType, processMode, modelGroup } = state;

        const isTextVector = (modelType === 'text' && processMode === 'vector');
        if (!isTextVector) {
            modelGroup.previewSelectedModel(() => {
                dispatch(actions.updateState({
                    isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }));
            });
            return;
        }

        const model = state.model;
        const modelInfo = model.getModelInfo();
        const { config } = modelInfo;
        api.convertTextToSvg(config)
            .then((res) => {
                const { width, height, filename } = res.body;
                const origin = {
                    width: width,
                    height: height,
                    filename: filename
                };
                modelInfo.origin = origin;
                const transformationSize = computeTransformationSizeForTextVector(modelInfo);
                modelGroup.updateSelectedModelTransformation(transformationSize);
                modelGroup.resizeSelectedModel();

                // transformation has changed after resize
                const { transformation } = modelInfo;
                dispatch(actions.updateState({
                    transformation: transformation
                }));

                modelGroup.previewSelectedModel(() => {
                    dispatch(actions.updateState({
                        isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
                        isGcodeGenerated: false,
                        gcodeBeans: []
                    }));
                });
            });
    },
    selectModel: (model) => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.selectModel(model);
        const modelInfo = model.getModelInfo();
        const { modelType, processMode, config, gcodeConfig, transformation } = modelInfo;
        dispatch(actions.updateState({
            canPreview: true,
            isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
            model: model,
            modelType: modelType,
            processMode: processMode,
            transformation: transformation,
            gcodeConfig: gcodeConfig,
            config: config
        }));
    },
    removeSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.removeSelectedModel();
        dispatch(actions.updateState({
            canPreview: false,
            isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
            model: null,
            modelType: '',
            processMode: '',
            transformation: {},
            gcodeConfig: {},
            config: {}
        }));
    },
    unselectAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.unselectAllModels();
        dispatch(actions.updateState({
            canPreview: false,
            isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
            model: null,
            modelType: '',
            processMode: '',
            transformation: {},
            gcodeConfig: {},
            config: {}
        }));
    },
    // text
    textModeInit: () => {
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
    },
    // gcode
    generateGcode: () => (dispatch, getState) => {
        const gcodeBeans = [];
        const models = getState().laser.modelGroup.getModels();
        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            const gcode = model.generateGcode();
            const modelInfo = model.getModelInfo();
            const gcodeBean = {
                gcode: gcode,
                modelInfo: modelInfo
            };
            gcodeBeans.push(gcodeBean);
        }
        dispatch(actions.updateState({
            isGcodeGenerated: true,
            gcodeBeans: gcodeBeans
        }));
    },
    updateTransformation: (params) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            params
        };
    },
    updateGcodeConfig: (params) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            params
        };
    },
    updateConfig: (params) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            params
        };
    }
};

export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            const pp = { ...action.params };
            pp.model = null;
            console.log('update state -> ' + JSON.stringify(pp));
            return Object.assign({}, state, { ...action.params });
        }
        case ACTION_SET_WORK_STATE: {
            return Object.assign({}, state, {
                workState: action.workState
            });
        }
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
        case ACTION_UPDATE_TRANSFORMATION: {
            // width and height are linked
            const { model } = state;
            model.updateTransformation(action.params);
            const modelInfo = model.getModelInfo();
            const { transformation } = modelInfo;
            return Object.assign({}, state, {
                transformation: transformation,
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        case ACTION_UPDATE_GCODE_CONFIG: {
            state.model.updateGcodeConfig(action.params);
            const data = {
                ...state.gcodeConfig,
                ...action.params
            };
            return Object.assign({}, state, {
                gcodeConfig: data,
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        case ACTION_UPDATE_CONFIG: {
            state.model.updateConfig(action.params);
            const data = {
                ...state.config,
                ...action.params
            };
            return Object.assign({}, state, {
                config: data,
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        default:
            return state;
    }
}
