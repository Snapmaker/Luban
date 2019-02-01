// cnc reducer
import * as THREE from 'three';
import path from 'path';
import api from '../../api';
import {
    STAGE_IDLE, STAGE_PREVIEWING,
    STAGE_GENERATED, STAGE_PREVIEWED
} from '../../constants';
import { ModelInfo } from '../ModelInfoUtils';
import Model2D from '../Model2D';

const ACTION_CHANGE_WORK_STATE = 'cnc/CHANGE_WORK_STATE';

const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';
const ACTION_SET_STATE = 'cnc/ACTION_SET_STATE';

const ACTION_UPDATE_TRANSFORMATION = 'cnc/ACTION_UPDATE_TRANSFORMATION';
const ACTION_UPDATE_GCODE_CONFIG = 'cnc/ACTION_UPDATE_GCODE_CONFIG';
const ACTION_UPDATE_CONFIG = 'cnc/ACTION_UPDATE_CONFIG';

const initialState = {
    stage: STAGE_IDLE,
    workState: 'idle',

    toolParams: {
        toolDiameter: 3.175, // tool diameter (in mm)
        toolAngle: 30 // tool angle (in degree, defaults to 30° for V-Bit)
    },

    modelGroup: new THREE.Group(),
    model: null, // selected model
    modelType: '', // raster, svg
    mode: '', // greyscale, vector
    transformation: {},
    gcodeConfig: {},
    config: {},
    gcodeStr: ''
};

export const actions = {
    setState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state
        };
    },
    uploadImage: (file, mode, onFailure) => (dispatch, getState) => {
        const state = getState().cnc;
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, name, filename } = res.body;

                let modelType = 'raster';
                if (path.extname(file.name).toLowerCase() === '.svg') {
                    modelType = 'svg';
                    mode = 'vector';
                }

                const modelInfo = new ModelInfo();
                modelInfo.setType('cnc');
                modelInfo.setSource(modelType, name, filename, width, height);
                modelInfo.setMode(mode);
                modelInfo.generateDefaults();

                const model = new Model2D(modelInfo);
                model.setSelected(true);
                state.modelGroup.remove(...state.modelGroup.children);
                state.modelGroup.add(model);
                const { transformation, gcodeConfig, config } = modelInfo;
                dispatch(actions.setState({
                    model: model,
                    transformation: transformation,
                    gcodeConfig: gcodeConfig,
                    config: config,
                    modelType: modelInfo.modelType,
                    mode: modelInfo.mode,
                    stage: STAGE_IDLE
                }));
            })
            .catch((err) => {
                onFailure && onFailure(err);
            });
    },
    updateTransformation: (transformation) => (dispatch, getState) => {
        const { model } = getState().cnc;
        model.updateTransformation(transformation);
        dispatch(actions.setTransformation(model.modelInfo.transformation));
    },
    setTransformation: (transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            transformation
        };
    },
    updateGcodeConfig: (gcodeConfig) => (dispatch, getState) => {
        const { model } = getState().cnc;
        model.updateGcodeConfig(gcodeConfig);
        dispatch(actions.setGcodeConfig(model.modelInfo.gcodeConfig));
    },
    setGcodeConfig: (gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            gcodeConfig
        };
    },
    updateConfig: (config) => (dispatch, getState) => {
        const { model } = getState().cnc;
        model.updateConfig(config);
        dispatch(actions.setConfig(model.modelInfo.config));
    },
    setConfig: (config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            config
        };
    },
    changeToolParams: (toolParams) => {
        return {
            type: ACTION_CHANGE_TOOL_PARAMS,
            toolParams
        };
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_CHANGE_WORK_STATE,
            workState
        };
    },
    generateGcode: () => (dispatch, getState) => {
        const state = getState().cnc;
        const gcodeStr = state.model.generateGcode();
        dispatch(actions.setState({
            gcodeStr: gcodeStr,
            stage: STAGE_GENERATED
        }));
    },
    generateToolPath: () => (dispatch, getState) => {
        const state = getState().cnc;
        state.model.updateConfig(state.toolParams);
        dispatch(actions.setState({
            stage: STAGE_PREVIEWING
        }));
        state.model.preview((err) => {
            if (!err) {
                dispatch(actions.setState({
                    stage: STAGE_PREVIEWED
                }));
            } else {
                dispatch(actions.setState({
                    stage: STAGE_IDLE
                }));
                // console.log('Err: preview');
            }
        });
    }
};

export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
        }
        case ACTION_CHANGE_WORK_STATE: {
            return Object.assign({}, state, { workState: action.workState });
        }
        case ACTION_UPDATE_TRANSFORMATION: {
            return Object.assign({}, state, {
                transformation: { ...state.transformation, ...action.transformation },
                stage: STAGE_IDLE
            });
        }
        case ACTION_UPDATE_GCODE_CONFIG: {
            return Object.assign({}, state, {
                gcodeConfig: { ...state.gcodeConfig, ...action.gcodeConfig },
                stage: STAGE_IDLE
            });
        }
        case ACTION_UPDATE_CONFIG: {
            return Object.assign({}, state, {
                config: { ...state.config, ...action.config },
                stage: STAGE_IDLE
            });
        }
        case ACTION_CHANGE_TOOL_PARAMS: {
            return Object.assign({}, state, {
                toolParams: { ...state.toolParams, ...action.toolParams },
                stage: STAGE_IDLE
            });
        }
        default:
            return state;
    }
}
