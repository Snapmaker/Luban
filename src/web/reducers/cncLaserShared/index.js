import path from 'path';
import api from '../../api';
import Model2D from '../Model2D';
import { ModelInfo, DEFAULT_TEXT_CONFIG } from '../ModelInfoUtils';
import { checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './helpers';
import {
    ACTION_UPDATE_STATE,
    ACTION_RESET_CALCULATED_STATE,
    ACTION_UPDATE_TRANSFORMATION,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_CONFIG
} from '../actionType';

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
        // check params
        if (!['cnc', 'laser', '3dp'].includes(from)) {
            onError('Params error: from = ' + from);
            return;
        }
        if (!file) {
            onError('Params error: file = ' + file);
            return;
        }
        if (!['greyscale', 'bw', 'vector'].includes(mode)) {
            onError('Params error: mode = ' + mode);
            return;
        }

        const { size } = getState().machine;

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

                const modelInfo = new ModelInfo(size);
                modelInfo.setType(from);
                modelInfo.setSource(modelType, name, filename, width, height);
                modelInfo.setMode(mode);
                modelInfo.generateDefaults();

                const model = new Model2D(modelInfo);
                // must update tool params
                if (from === 'cnc') {
                    const { toolDiameter, toolAngle } = getState().cnc.toolParams;
                    model.updateConfig({ toolDiameter });
                    model.updateConfig({ toolAngle });
                }
                // set size smaller when cnc-raster-greyscale
                if (`${from}-${modelType}-${mode}` === 'cnc-raster-greyscale') {
                    model.updateTransformation({ width: 40 });
                }

                const { modelGroup } = getState()[from];
                modelGroup.addModel(model);

                dispatch(actions.selectModel(from, model));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.updateState(
                    from,
                    {
                        hasModel: true
                    }
                ));
            })
            .catch((err) => {
                console.error(err);
                onError && onError(err);
            });
    },
    insertDefaultTextVector: (from) => (dispatch, getState) => {
        const { size } = getState().machine;

        api.convertTextToSvg(DEFAULT_TEXT_CONFIG)
            .then((res) => {
                const { name, filename, width, height } = res.body;

                const modelInfo = new ModelInfo(size);
                modelInfo.setType(from);
                modelInfo.setSource('text', name, filename, width, height);
                modelInfo.setMode('vector');
                modelInfo.generateDefaults();

                const model = new Model2D(modelInfo);
                const { modelGroup } = getState()[from];
                modelGroup.addModel(model);

                dispatch(actions.selectModel(from, model));
                dispatch(actions.updateState(
                    from,
                    {
                        isAllModelsPreviewed: false,
                        isGcodeGenerated: false,
                        gcodeBeans: [],
                        hasModel: true
                    }
                ));

                const textSize = computeTransformationSizeForTextVector(modelInfo.config.text, modelInfo.config.size, { width, height });
                dispatch(actions.updateSelectedModelTransformation(
                    from,
                    { ...textSize }
                ));
            });
    },
    // call once
    initModelsPreviewChecker: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        const check = () => {
            const isAllModelsPreviewed = checkIsAllModelsPreviewed(modelGroup);
            dispatch(actions.updateState(
                from,
                { isAllModelsPreviewed }
            ));
            setTimeout(check, 100);
        };
        check();
    },
    selectModel: (from, model) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
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
        const { modelGroup } = getState()[from];
        modelGroup.removeSelectedModel();
        const hasModel = (modelGroup.getModels().length > 0);
        dispatch(actions.updateState(
            from,
            {
                model: null,
                mode: '',
                transformation: {},
                printOrder: 0,
                gcodeConfig: {},
                config: {},
                hasModel
            }
        ));
    },
    unselectAllModels: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
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
        const { modelGroup } = getState()[from];
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
        const { model } = getState()[from];
        model.modelInfo.printOrder = printOrder;

        dispatch(actions.updateState(
            from,
            { printOrder }
        ));
        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelSource: (from, source) => (dispatch, getState) => {
        const { model } = getState()[from];
        model.updateSource(source);

        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        const { model } = getState()[from];
        model.updateTransformation(transformation);

        // Update state
        dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        const { model } = getState()[from];
        model.updateGcodeConfig(gcodeConfig);
        dispatch(actions.updateGcodeConfig(from, model.modelInfo.gcodeConfig));
        dispatch(actions.resetCalculatedState(from));
    },
    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        const { model } = getState()[from];
        model.updateConfig(config);
        dispatch(actions.updateConfig(from, model.modelInfo.config));
        dispatch(actions.resetCalculatedState(from));
    },
    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        const { modelGroup, model } = getState()[from];
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
        const { model } = getState()[from];
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
    onSetSelectedModelPosition: (from, position) => (dispatch, getState) => {
        const { model } = getState()[from];
        const transformation = model.modelInfo.transformation;
        let posX = 0;
        let posY = 0;
        const { width, height } = transformation;
        switch (position) {
            case 'Top Left':
                posX = -width / 2;
                posY = height / 2;
                break;
            case 'Top Middle':
                posX = 0;
                posY = height / 2;
                break;
            case 'Top Right':
                posX = width / 2;
                posY = height / 2;
                break;
            case 'Center Left':
                posX = -width / 2;
                posY = 0;
                break;
            case 'Center':
                posX = 0;
                posY = 0;
                break;
            case 'Center Right':
                posX = width / 2;
                posY = 0;
                break;
            case 'Bottom Left':
                posX = -width / 2;
                posY = -height / 2;
                break;
            case 'Bottom Middle':
                posX = 0;
                posY = -height / 2;
                break;
            case 'Bottom Right':
                posX = width / 2;
                posY = -height / 2;
                break;
            default:
                posX = 0;
                posY = 0;
        }
        transformation.translateX = posX;
        transformation.translateY = posY;
        transformation.rotation = 0;
        dispatch(actions.updateSelectedModelTransformation(from, transformation));
    },

    getEstimatedTimeStr: (from) => (dispatch, getState) => {
        const { model } = getState()[from];
        if (model && model.toolPathStr) {
            const toolPathStr = model.toolPathStr;
            const targetStr = 'estimatedTime';
            const estimatedTimeFirstIndex = toolPathStr.indexOf(targetStr) + targetStr.length + 2;
            const subToolPathStr = toolPathStr.substring(estimatedTimeFirstIndex, toolPathStr.length);
            const estimatedTimeLastIndex = estimatedTimeFirstIndex + subToolPathStr.indexOf('.');
            let estimatedTime = parseFloat(toolPathStr.substring(estimatedTimeFirstIndex, estimatedTimeLastIndex));
            if (estimatedTime !== undefined && (typeof estimatedTime === 'number')) {
                if (model.modelInfo.gcodeConfig.multiPassEnabled) {
                    estimatedTime *= model.modelInfo.gcodeConfig.multiPasses;
                }
                const hours = Math.floor(estimatedTime / 3600);
                const minutes = Math.ceil((estimatedTime - hours * 3600) / 60);
                return (hours > 0 ? `Estimated Time: ${hours} h ${minutes} min` : `Estimated Time: ${minutes} min`);
            } else {
                return '';
            }
        } else {
            return '';
        }
    },

    onFlipModel: (from, flipStr) => (dispatch, getState) => {
        const { model } = getState()[from];
        const lastFlip = model.modelInfo.transformation.flip;
        let flip = model.modelInfo.transformation.flip;
        switch (flipStr) {
            case 'Upside Down':
                flip = 1;
                break;
            case 'Left to Right':
                flip = 2;
                break;
            case 'Reset':
                flip = 0;
                break;
            default:
        }
        if (lastFlip === flip) {
            flip = 0;
        } else if ((lastFlip === 1 && flip === 2) || (lastFlip === 2 && flip === 1)) {
            flip = 3;
        } else if (lastFlip === 3 && flip !== 0) {
            flip = 3 - flip;
        }
        model.modelInfo.transformation.flip = flip;
        dispatch(actions.updateSelectedModelTransformation(from, model.modelInfo.transformation));
    },

    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        const { model } = getState()[from];
        model.onTransform();
        model.updateTransformationFromModel();

        dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
    },
    setAutoPreview: (from, value) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.setAutoPreview(value);
        dispatch(actions.updateState(
            from,
            {
                autoPreviewEnabled: value
            }
        ));
    },
    manualPreview: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        const models = modelGroup.getModels();
        for (let i = 0; i < models.length; i++) {
            models[i].autoPreview(true);
        }
    },
    // todo: listen config, gcodeConfig
    initSelectedModelListener: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.onSelectedModelTransformChanged = () => {
            const { model } = getState()[from];
            model.onTransform();
            model.updateTransformationFromModel();

            dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
        };
    },
    onReceiveTaskResult: (taskResult) => (dispatch, getState) => {
        for (const from of ['laser', 'cnc']) {
            const state = getState()[from];
            const { modelGroup } = state;

            let task = null;
            for (const child of modelGroup.children) {
                if (child.modelInfo.taskId === taskResult.taskId) {
                    task = child;
                    break;
                }
            }
            if (task !== null) {
                if (taskResult.status === 'previewed') {
                    task.modelInfo.taskStatus = 'success';
                    task.loadToolpathObj(taskResult.filename, taskResult.taskId);
                } else if (taskResult.status === 'failed') {
                    task.modelInfo.taskStatus = 'failed';
                }

                let failed = false;
                for (const child of modelGroup.children) {
                    if (child.modelInfo.taskStatus === 'failed') {
                        failed = true;
                        break;
                    }
                }

                if (failed !== state.previewFailed) {
                    dispatch(actions.updateState(from, {
                        previewFailed: failed
                    }));
                }
            }
        }
    }
};

export default function reducer() {
    return {};
}
