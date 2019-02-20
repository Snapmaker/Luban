import path from 'path';
import api from '../../api';
import ModelGroup2D from '../ModelGroup2D';
import Model2D from '../Model2D';
import { ModelInfo, DEFAULT_TEXT_CONFIG } from '../ModelInfoUtils';
import { checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './helpers';

const ACTION_UPDATE_STATE = 'model/ACTION_UPDATE_STATE';
const ACTION_RESET_CALCULATED_STATE = 'model/ACTION_RESET_CALCULATED_STATE';

const ACTION_UPDATE_TRANSFORMATION = 'model/ACTION_UPDATE_TRANSFORMATION';
const ACTION_UPDATE_GCODE_CONFIG = 'model/ACTION_UPDATE_GCODE_CONFIG';
const ACTION_UPDATE_CONFIG = 'model/ACTION_UPDATE_CONFIG';

const BASE_INITIAL_STATE = {
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }

    // selected
    model: null,
    mode: '', // bw, greyscale, vector
    printOrder: 1,
    transformation: {},
    gcodeConfig: {},
    config: {}
};

const INITIAL_STATE = {
    laser: {
        modelGroup: new ModelGroup2D(),
        ...BASE_INITIAL_STATE
    },
    cnc: {
        modelGroup: new ModelGroup2D(),
        ...BASE_INITIAL_STATE
    }
};

// from: cnc/laser
export const actions = {
    updateState: (from, state) => {
        return {
            type: ACTION_UPDATE_STATE,
            from,
            state
        };
    },
    updateTransformation: (from, transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            from,
            transformation
        };
    },
    updateGcodeConfig: (from, gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            from,
            gcodeConfig
        };
    },
    updateConfig: (from, config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            from,
            config
        };
    },
    uploadImage: (from, file, mode, onError) => (dispatch, getState) => {
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, name, filename } = res.body;

                // Infer model type
                let modelType = 'raster';
                if (path.extname(file.name).toLowerCase() === '.svg') {
                    modelType = 'svg';
                    // mode = 'vector';
                }

                const modelInfo = new ModelInfo();
                modelInfo.setType(from);
                modelInfo.setSource(modelType, name, filename, width, height);
                modelInfo.setMode(mode);
                modelInfo.generateDefaults();

                const model = new Model2D(modelInfo);
                // set size smaller when cnc-raster-greyscale
                if (`${from}-${modelType}-${mode}` === 'cnc-raster-greyscale') {
                    model.updateTransformation({ width: 40 });
                }
                model.enableAutoPreview();

                const { modelGroup } = getState().cncLaserShared[from];
                modelGroup.addModel(model);

                dispatch(actions.selectModel(from, model));
                dispatch(actions.resetCalculatedState(from));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },
    insertDefaultTextVector: (from) => (dispatch, getState) => {
        api.convertTextToSvg(DEFAULT_TEXT_CONFIG)
            .then((res) => {
                const { name, filename, width, height } = res.body;

                const modelInfo = new ModelInfo();
                modelInfo.setType(from);
                modelInfo.setSource('text', name, filename, width, height);
                modelInfo.setMode('vector');
                modelInfo.generateDefaults();

                const model = new Model2D(modelInfo);
                model.enableAutoPreview();

                const { modelGroup } = getState().cncLaserShared[from];
                modelGroup.addModel(model);

                dispatch(actions.selectModel(from, model));
                dispatch(actions.updateState(
                    from,
                    {
                        isAllModelsPreviewed: false,
                        isGcodeGenerated: false,
                        gcodeBeans: []
                    }
                ));

                const size = computeTransformationSizeForTextVector(modelInfo.config.text, modelInfo.config.size, { width, height });
                dispatch(actions.updateSelectedModelTransformation(
                    from,
                    { ...size }
                ));
            });
    },
    updateIsAllModelsPreviewed: (from) => (dispatch, getState) => {
        const { modelGroup } = getState().cncLaserShared[from];
        const isAllModelsPreviewed = checkIsAllModelsPreviewed(modelGroup);
        dispatch(actions.updateState(
            from,
            { isAllModelsPreviewed }
        ));
        return isAllModelsPreviewed;
    },
    selectModel: (from, model) => (dispatch, getState) => {
        const { modelGroup } = getState().cncLaserShared[from];
        modelGroup.selectModel(model);

        // Copy state from model.modelInfo
        const modelInfo = model.modelInfo;
        const { mode, config, gcodeConfig, transformation, printOrder } = modelInfo;
        dispatch(actions.updateState(
            from,
            {
                model,
                mode,
                printOrder,
                transformation,
                gcodeConfig,
                config
            }
        ));
    },
    removeSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState().cncLaserShared[from];
        modelGroup.removeSelectedModel();
        dispatch(actions.updateState(
            from,
            {
                model: null,
                mode: '',
                transformation: {},
                printOrder: 0,
                gcodeConfig: {},
                config: {}
            }
        ));
    },
    unselectAllModels: (from) => (dispatch, getState) => {
        const { modelGroup } = getState().cncLaserShared[from];
        modelGroup.unselectAllModels();
        dispatch(actions.updateState(
            from,
            {
                model: null,
                mode: '',
                transformation: {},
                printOrder: 0,
                gcodeConfig: {},
                config: {},
            }
        ));
    },
    // gcode
    generateGcode: (from) => (dispatch, getState) => {
        const gcodeBeans = [];
        const { modelGroup } = getState().cncLaserShared[from];
        // bubble sort: https://codingmiles.com/sorting-algorithms-bubble-sort-using-javascript/
        const sorted = modelGroup.getModels();
        const length = sorted.length;
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < (length - i - 1); j++) {
                if (sorted[j].modelInfo.printOrder > sorted[j + 1].modelInfo.printOrder) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }

        for (let i = 0; i < length; i++) {
            const model = sorted[i];
            const gcode = model.generateGcode();
            const modelInfo = model.modelInfo;
            const gcodeBean = {
                gcode,
                modelInfo
            };
            gcodeBeans.push(gcodeBean);
        }
        dispatch(actions.updateState(
            from,
            {
                isGcodeGenerated: true,
                gcodeBeans
            }
        ));
    },
    // Model configurations
    resetCalculatedState: (from) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            from
        };
    },
    updateSelectedModelPrintOrder: (from, printOrder) => (dispatch, getState) => {
        const { model } = getState().cncLaserShared[from];
        model.modelInfo.printOrder = printOrder;

        dispatch(actions.updateState(
            from,
            { printOrder }
        ));
        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelSource: (from, source) => (dispatch, getState) => {
        const { model } = getState().cncLaserShared[from];
        model.updateSource(source);

        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        const { model } = getState().cncLaserShared[from];
        model.updateTransformation(transformation);

        // Update state
        dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        const { model } = getState().cncLaserShared[from];
        model.updateGcodeConfig(gcodeConfig);
        dispatch(actions.updateGcodeConfig(from, model.modelInfo.gcodeConfig));
        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        const { model } = getState().cncLaserShared[from];
        model.updateConfig(config);
        dispatch(actions.updateConfig(from, model.modelInfo.config));
        dispatch(actions.resetCalculatedState(from));
    },
    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        const { modelGroup, model } = getState().cncLaserShared[from];
        const models = modelGroup.getModels();
        for (let i = 0; i < models.length; i++) {
            models[i].updateConfig(config);
        }
        if (model) {
            dispatch(actions.updateConfig(from, model.modelInfo.config));
            dispatch(actions.resetCalculatedState(from));
        }
    },
    updateSelectedModelTextConfig: (from, config) => (dispatch, getState) => {
        const { model } = getState().cncLaserShared[from];
        const modelInfo = model.modelInfo;
        const newConfig = {
            ...modelInfo.config,
            ...config
        };
        api.convertTextToSvg(newConfig)
            .then((res) => {
                const { name, filename, width, height } = res.body;
                const source = {
                    name,
                    filename,
                    width,
                    height
                };

                const size = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, { width, height });

                dispatch(actions.updateSelectedModelSource(from, source));

                dispatch(actions.updateSelectedModelTransformation(from, { ...size }));

                dispatch(actions.updateSelectedModelConfig(from, newConfig));
            });
    },
    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        const { model } = getState().cncLaserShared[from];
        model.onTransform();
        model.updateTransformationFromModel();

        dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    const from = action.from;
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, {
                [from]: {
                    ...state[from],
                    ...action.state
                }
            });
        }
        case ACTION_RESET_CALCULATED_STATE: {
            return Object.assign({}, state, {
                [from]: {
                    ...state[from],
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }
            });
        }
        case ACTION_UPDATE_TRANSFORMATION: {
            return Object.assign({}, state, {
                [from]: {
                    ...state[from],
                    transformation: {
                        ...state[from].transformation,
                        ...action.transformation
                    }
                }
            });
        }
        case ACTION_UPDATE_GCODE_CONFIG: {
            return Object.assign({}, state, {
                [from]: {
                    ...state[from],
                    gcodeConfig: {
                        ...state[from].gcodeConfig,
                        ...action.gcodeConfig
                    }
                }
            });
        }
        case ACTION_UPDATE_CONFIG: {
            return Object.assign({}, state, {
                [from]: {
                    ...state[from],
                    config: {
                        ...state[from].config,
                        ...action.config
                    }
                }
            });
        }
        default:
            return state;
    }
}
