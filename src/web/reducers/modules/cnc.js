// cnc reducer
import * as THREE from 'three';
import path from 'path';
import api from '../../api';
import {
    STAGE_IDLE, STAGE_PREVIEWING,
    STAGE_GENERATED, STAGE_PREVIEWED
} from '../../constants';
import { generateModelInfo } from '../ModelInfoUtils';
import Model2D from '../Model2D';

const ACTION_CHANGE_WORK_STATE = 'cnc/CHANGE_WORK_STATE';

const ACTION_CHANGE_TOOL_PARAMS = 'cnc/ACTION_CHANGE_TOOL_PARAMS';
const ACTION_UPDATE_STATE = 'cnc/ACTION_UPDATE_STATE';

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
    processMode: '', // greyscale, vector
    transformation: {},
    gcodeConfig: {},
    config: {},
    gcodeStr: ''
};

export const actions = {
    updateState: (params) => {
        return {
            type: ACTION_UPDATE_STATE,
            params
        };
    },
    uploadImage: (file, processMode, onFailure) => (dispatch, getState) => {
        const state = getState().cnc;
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

                const modelInfo = generateModelInfo('cnc', modelType, processMode, origin);
                const model = new Model2D(modelInfo, false);
                model.setSelected(true);
                state.modelGroup.remove(...state.modelGroup.children);
                state.modelGroup.add(model);
                const { transformation, gcodeConfig, config } = modelInfo;
                dispatch(actions.updateState({
                    model: model,
                    transformation: transformation,
                    gcodeConfig: gcodeConfig,
                    config: config,
                    modelType: modelInfo.modelType,
                    processMode: modelInfo.processMode,
                    stage: STAGE_IDLE
                }));
            })
            .catch(() => {
                onFailure && onFailure();
            });
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
    },
    changeToolParams: (params) => {
        return {
            type: ACTION_CHANGE_TOOL_PARAMS,
            params
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
        dispatch(actions.updateState({
            gcodeStr: gcodeStr,
            stage: STAGE_GENERATED
        }));
    },
    generateToolPath: () => (dispatch, getState) => {
        const state = getState().cnc;
        state.model.updateConfig(state.toolParams);
        dispatch(actions.updateState({
            stage: STAGE_PREVIEWING
        }));
        state.model.preview((err) => {
            if (!err) {
                dispatch(actions.updateState({
                    stage: STAGE_PREVIEWED
                }));
            } else {
                dispatch(actions.updateState({
                    stage: STAGE_IDLE
                }));
                // console.log('Err: preview');
            }
        });
    }
};

export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, { ...action.params });
        }
        case ACTION_CHANGE_WORK_STATE: {
            return Object.assign({}, state, { workState: action.workState });
        }
        case ACTION_UPDATE_TRANSFORMATION: {
            // width and height are linked
            const { model } = state;
            model.updateTransformation(action.params);
            const modelInfo = model.getModelInfo();
            const { transformation } = modelInfo;
            return Object.assign({}, state, {
                transformation: transformation,
                stage: STAGE_IDLE
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
                stage: STAGE_IDLE
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
                stage: STAGE_IDLE
            });
        }
        case ACTION_CHANGE_TOOL_PARAMS: {
            const params = Object.assign({}, state.toolParams, action.params);
            return Object.assign({}, state, {
                toolParams: params,
                stage: STAGE_IDLE
            });
        }
        default:
            return state;
    }
}
