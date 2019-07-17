import path from 'path';
import * as THREE from 'three';
import api from '../../api';
// import Model from '../models/Model';
import { ModelInfo, DEFAULT_TEXT_CONFIG } from '../models/ModelInfoUtils';
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

    render: (from) => (dispatch) => {
        dispatch(actions.updateState(
            from,
            {
                renderingTimestamp: +new Date()
            }
        ));
    },

    uploadImage: (headerType, file, mode, onError) => (dispatch) => {
        // check params
        if (!['cnc', 'laser'].includes(headerType)) {
            onError(`Params error: func = ${headerType}`);
            return;
        }
        if (!file) {
            onError(`Params error: file = ${file}`);
            return;
        }
        if (!['greyscale', 'bw', 'vector', 'trace'].includes(mode)) {
            onError(`Params error: mode = ${mode}`);
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, originalName, uploadName } = res.body;

                dispatch(actions.generateModel(headerType, originalName, uploadName, width, height, mode));
            })
            .catch((err) => {
                console.error(err);
                onError && onError(err);
            });
    },

    // generateModel: (from, name, filename, width, height, mode) => (dispatch, getState) => {
    generateModel: (headerType, originalName, uploadName, width, height, mode) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { modelGroup } = getState()[headerType];
        // const ext = path.extname(filename).toLowerCase().substring(1);
        let sourceType = 'raster';
        if (path.extname(uploadName).toLowerCase() === '.svg') {
            sourceType = 'svg';
        }

        // ModelInfo
        const modelInfo = new ModelInfo(size);
        modelInfo.setHeaderType(headerType);
        // modelInfo.setSource(sourceType, name, filename, width, height);
        modelInfo.setSource(sourceType, originalName, uploadName, height, width);
        modelInfo.setMode(mode);
        let height_ = height;
        let width_ = width;
        if (width_ * size.y >= height_ * size.x && width_ > size.x) {
            height_ = size.x * height_ / width_;
            width_ = size.x;
        }
        if (height_ * size.x >= width_ * size.y && height_ > size.y) {
            width_ = size.y * width_ / height_;
            height_ = size.y;
        }

        // Generate geometry
        const geometry = new THREE.PlaneGeometry(width_, height_);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });
        modelInfo.setGeometry(geometry);
        modelInfo.setMaterial(material);
        modelInfo.generateDefaults();

        // Generate model
        // const model = new Model(modelInfo);
        const model = modelGroup.generateModel(modelInfo);
        modelGroup.addModel(model);
        // modelGroup.selectModel(model);
        dispatch(actions.selectModel(headerType, model));
        // must update tool params
        if (headerType === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            // model.updateConfig({ toolDiameter });
            // model.updateConfig({ toolAngle });
            modelGroup.updateSelectedConfig({ toolDiameter });
            modelGroup.updateSelectedConfig({ toolAngle });
        }
        // set size smaller when cnc-raster-greyscale
        if (`${headerType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            // model.updateTransformation({ width: 40 });
            modelGroup.updateSelectedModelTransformation({ width: 40 });
        }

        dispatch(actions.resetCalculatedState(headerType));
        dispatch(actions.updateState(
            headerType,
            {
                hasModel: true
            }
        ));

        dispatch(actions.render(headerType));
    },

    insertDefaultTextVector: (from) => (dispatch, getState) => {
        const { size } = getState().machine;

        api.convertTextToSvg(DEFAULT_TEXT_CONFIG)
            .then((res) => {
                // const { name, filename, width, height } = res.body;
                const { originalName, uploadName, width, height } = res.body;
                const { modelGroup } = getState()[from];
                const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

                const modelInfo = new ModelInfo(size);
                modelInfo.setHeaderType(from);
                // modelInfo.setSource('text', name, filename, width, height);
                modelInfo.setSource('text', originalName, uploadName, height, width);
                modelInfo.setMode('vector');
                let height_ = height;
                let width_ = width;
                if (width_ * size.y >= height_ * size.x && width_ > size.x) {
                    height_ = size.x * height_ / width_;
                    width_ = size.x;
                }
                if (height_ * size.x >= width_ * size.y && height_ > size.y) {
                    width_ = size.y * width_ / height_;
                    height_ = size.y;
                }
                const boundSize = { width: width_, height: height_ };

                modelInfo.generateDefaults();
                const textSize = computeTransformationSizeForTextVector(modelInfo.config.text, modelInfo.config.size, boundSize);
                const geometry = new THREE.PlaneGeometry(textSize.width, textSize.height);
                modelInfo.setGeometry(geometry);
                modelInfo.setMaterial(material);
                // modelInfo.generateDefaults();

                // const model = new Model(modelInfo);
                const model = modelGroup.generateModel(modelInfo);
                modelGroup.addModel(model);
                // modelGroup.selectModel(model);

                dispatch(actions.selectModel(from, model));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.updateState(
                    from,
                    {
                        hasModel: true
                    }
                ));
                // const textSize = computeTransformationSizeForTextVector(modelInfo.config.text, modelInfo.config.size, { width, height });
                dispatch(actions.updateSelectedModelTransformation(
                    from,
                    { ...textSize }
                ));
                dispatch(actions.render(from));
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

    getEstimatedTime: (from, type) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        if (type === 'selected') {
            return modelGroup.estimatedTime;
        } else {
            let totalEstimatedTime_ = 0;
            // for (const model of modelGroup.children) {
            for (const model of modelGroup.models) {
                const estimatedTime_ = model.estimatedTime;
                if (typeof estimatedTime_ !== 'number' || !Number.isNaN(estimatedTime_)) {
                    totalEstimatedTime_ += estimatedTime_;
                }
            }
            return totalEstimatedTime_;
        }
    },

    getSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        return modelGroup.getSelectedModel();
    },

    /*
    getSelectedModelInfo: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        return modelGroup.getSelectedModelInfo();
    },
    */

    selectModel: (from, modelMeshObject) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.selectModel(modelMeshObject);
        // const { selectedModelID } = model;

        // Copy state from model.modelInfo
        // const modelInfo = model.modelInfo;
        // const modelInfo = modelGroup.getSelectedModelInfo();
        // const { mode, source, config, gcodeConfig, transformation, printOrder } = modelInfo;
        const selectedModel = modelGroup.getSelectedModel();
        const selectedModelID = selectedModel.modelID;
        const { mode, sourceType, config, gcodeConfig, transformation, printOrder } = selectedModel;

        dispatch(actions.updateState(
            from,
            {
                // model,
                selectedModelID,
                sourceType,
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
                // model: null,
                selectedModelID: null,
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
                // model: null,
                selectedModelID: null,
                mode: '',
                transformation: {},
                printOrder: 0,
                gcodeConfig: {},
                config: {}
            }
        ));
    },

    // gcode
    // TODO
    generateGcode: (from) => (dispatch, getState) => {
        const gcodeBeans = [];
        const { modelGroup } = getState()[from];
        // bubble sort: https://codingmiles.com/sorting-algorithms-bubble-sort-using-javascript/
        const sorted = modelGroup.getModels();
        const length = sorted.length;
        for (let i = 0; i < length; i++) {
            for (let j = 0; j < (length - i - 1); j++) {
                if (sorted[j].printOrder > sorted[j + 1].printOrder) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }

        for (let i = 0; i < length; i++) {
            const model = sorted[i];
            const gcode = model.generateGcode();
            // const gcode = modelGroup.generateSelectedGcode();
            // TODO
            // const modelInfo = model.modelInfo;
            /*
            const modelInfo = {
                sourceType: this.sourceType,
                originalName: this.originalName,
                uploadName: this.uploadName,
                uploadPath: this.uploadPath,
                geometry: this.meshObject.geometry,
                material: this.meshObject.material,
                transformation: this.transformation,
                config: this.config,
                gcodeConfig: this.gcodeConfig,
                mode: this.mode,
                movementMode: this.movementMode,
                printOrder: this.printOrder,
                gcodeConfigPlaceholder: this.gcodeConfigPlaceholder
            };
            */
            const modelInfo = {
                mode: model.mode,
                originalName: model.originalName,
                config: model.config
            };
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
        // const { model } = getState()[from];
        // model.modelInfo.printOrder = printOrder;
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(actions.updateState(
            from,
            { printOrder }
        ));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelSource: (from, source) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateSource(source);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedSource(source);

        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        // const { model } = getState()[from];
        // model.updateTransformation(transformation);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedModelTransformation(transformation);

        // Update state
        // dispatch(actions.updateTransformation(from, model.modelInfo.transformation));
        dispatch(actions.updateTransformation(from, modelGroup.getSelectedModel().transformation));
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateGcodeConfig(gcodeConfig);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedGcodeConfig(gcodeConfig);

        // dispatch(actions.updateGcodeConfig(from, model.modelInfo.gcodeConfig));
        dispatch(actions.updateGcodeConfig(from, modelGroup.getSelectedModel().gcodeConfig));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateConfig(config);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedConfig(config);
        // dispatch(actions.updateConfig(from, model.modelInfo.config));
        dispatch(actions.updateConfig(from, modelGroup.getSelectedModel().config));
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    // TODO
    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        // const { modelGroup, model } = getState()[from];
        const { modelGroup, selectedModelID } = getState()[from];
        const models = modelGroup.getModels();
        for (let i = 0; i < models.length; i++) {
            models[i].updateConfig(config);
        }
        if (selectedModelID) {
            dispatch(actions.updateConfig(from, modelGroup.getSelectedModel().config));
            dispatch(actions.resetCalculatedState(from));
            dispatch(actions.render(from));
        }
    },

    updateSelectedModelTextConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        const { modelGroup } = getState()[from];
        // const modelInfo = model.modelInfo;
        const model = modelGroup.getSelectedModel();
        const newConfig = {
            ...model.config,
            ...config
        };
        api.convertTextToSvg(newConfig)
            .then((res) => {
                // const { name, filename, width, height } = res.body;
                const { originalName, uploadName, width, height } = res.body;
                /*
                const source = {
                    name,
                    filename,
                    width,
                    height
                };
                */
                const sourceHeight = height;
                const sourceWidth = width;
                const source = { originalName, uploadName, sourceHeight, sourceWidth };

                const size = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, { width, height });
                // const source = { originalName, uploadName, sourceHeight: size.height, sourceWidth: size.width };
                console.log('size ', size);

                dispatch(actions.updateSelectedModelSource(from, source));
                dispatch(actions.updateSelectedModelTransformation(from, { ...size }));
                dispatch(actions.updateSelectedModelConfig(from, newConfig));
                dispatch(actions.render(from));
            });
    },

    onSetSelectedModelPosition: (from, position) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // const transformation = model.modelInfo.transformation;
        const { modelGroup } = getState()[from];
        const transformation = modelGroup.getSelectedModel().transformation;
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
        transformation.positionX = posX;
        transformation.positionY = posY;
        transformation.rotationZ = 0;
        dispatch(actions.updateSelectedModelTransformation(from, transformation));
    },

    onFlipSelectedModel: (from, flipStr) => (dispatch, getState) => {
        // const { model } = getState()[from];
        const { modelGroup } = getState()[from];
        let flip = modelGroup.getSelectedModel().transformation.flip;
        switch (flipStr) {
            case 'Vertical':
                flip ^= 1;
                break;
            case 'Horizontal':
                flip ^= 2;
                break;
            case 'Reset':
                flip = 0;
                break;
            default:
        }
        modelGroup.getSelectedModel().transformation.flip = flip;
        dispatch(actions.updateSelectedModelTransformation(from, modelGroup.getSelectedModel().transformation));
    },

    /*
    bringSelectedModelToFront() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.position.z = (sorted.length + 2) * margin;
    }

    sendSelectedModelToBack() {
        const margin = 0.01;
        const sorted = this.getSortedModelsByPositionZ();
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].position.z = (i + 1) * margin;
        }
        const selected = this.getSelectedModel();
        selected.position.z = 0;
    }
    */

    bringSelectedModelToFront: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.bringSelectedModelToFront();
    },

    sendSelectedModelToBack: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.sendSelectedModelToBack();
    },

    arrangeAllModels2D: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.arrangeAllModels2D();
    },

    undo: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.undo();
    },

    redo: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.redo();
    },

    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.onTransform();
        // model.updateTransformationFromModel();
        const { modelGroup } = getState()[from];
        modelGroup.onSelectedTransform();
        modelGroup.updateTransformationFromSelectedModel();

        // TODO need?
        dispatch(actions.updateTransformation(from, modelGroup.getSelectedModel().transformation));
    },

    // TODO
    onModelAfterTransform: () => (dispatch, getState) => {
        for (const from of ['laser', 'cnc']) {
            const { modelGroup } = getState()[from];
            if (modelGroup) {
                modelGroup.onModelAfterTransform();
            }
        }
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
            // const { model } = getState()[from];
            // model.onTransform();
            // model.updateTransformationFromModel();
            modelGroup.onSelectedTransform();
            modelGroup.updateTransformationFromSelectedModel();

            dispatch(actions.updateTransformation(from, modelGroup.getSelectedModel().transformation));
            dispatch(actions.render(from));
        };

        // modelGroup.addEventListener('update', () => {
        modelGroup.object.addEventListener('update', () => {
            dispatch(actions.render(from));
        });
    },

    onReceiveTaskResult: (taskResult) => async (dispatch, getState) => {
        for (const from of ['laser', 'cnc']) {
            // const state = getState()[from];
            // const { modelGroup } = state;
            const { modelGroup } = getState()[from];

            let taskModel = null;
            // for (const child of modelGroup.children) {
            for (const model of modelGroup.models) {
                // if (child.modelInfo.taskID === taskResult.taskID) {
                if (model.taskID === taskResult.taskID) {
                    taskModel = model;
                    break;
                }
            }

            if (taskModel !== null) {
                if (taskResult.status === 'previewed') {
                    // taskModel.modelInfo.taskStatus = 'success';
                    taskModel.taskStatus = 'success';
                    await taskModel.loadToolPath(taskResult.filename, taskResult.taskID);
                } else if (taskResult.status === 'failed') {
                    // taskModel.modelInfo.taskStatus = 'failed';
                    taskModel.taskStatus = 'failed';
                }

                let failed = false;
                // for (const child of modelGroup.children) {
                for (const model of modelGroup.models) {
                    // if (child.modelInfo.taskStatus === 'failed') {
                    if (model.taskStatus === 'failed') {
                        failed = true;
                        break;
                    }
                }

                dispatch(actions.updateState(from, {
                    previewUpdated: +new Date(),
                    previewFailed: failed
                }));
            }
        }
    }
};

export default function reducer() {
    return {};
}
