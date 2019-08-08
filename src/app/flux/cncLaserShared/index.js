import path from 'path';
import * as THREE from 'three';
import api from '../../api';
import controller from '../../lib/controller';
import { DEFAULT_TEXT_CONFIG, sizeModelByMachineSize, generateModelDefaultConfigs, checkoutParams } from '../models/ModelInfoUtils';
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

    // Model configurations
    resetCalculatedState: (from) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            from
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

    generateModel: (headerType, originalName, uploadName, sourceWidth, sourceHeight, mode) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { modelGroup, toolPathModelGroup } = getState()[headerType];

        const sourceType = path.extname(uploadName).toLowerCase() === '.svg' ? 'svg' : 'raster';

        const { width, height } = sizeModelByMachineSize(size, sourceWidth, sourceHeight);
        // Generate geometry
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        if (!checkoutParams(headerType, sourceType, mode)) {
            return;
        }

        const modelDefaultConfigs = generateModelDefaultConfigs(headerType, sourceType, mode);
        let { config } = modelDefaultConfigs;
        const { gcodeConfig } = modelDefaultConfigs;

        if (headerType === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            config = { ...config, toolDiameter, toolAngle };
        }
        let transformation = {};
        if (`${headerType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            // model.updateTransformation({ width: 40 });
            transformation = { ...transformation, width: 40 };
        }

        const modelState = modelGroup.generateModel({
            limitSize: size,
            headerType,
            sourceType,
            originalName,
            uploadName,
            sourceWidth,
            sourceHeight,
            geometry,
            material,
            transformation
        });
        const toolPathModelState = toolPathModelGroup.generateToolPathModel({
            modelID: modelState.selectedModelID,
            mode,
            config,
            gcodeConfig
        });

        dispatch(actions.updateState(headerType, {
            ...modelState,
            ...toolPathModelState
        }));

        dispatch(actions.previewModel(headerType));
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
                const { modelGroup, toolPathModelGroup } = getState()[from];
                const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });
                const whRatio = width / height;
                const sourceType = 'text';
                const mode = 'vector';
                const textSize = computeTransformationSizeForTextVector(DEFAULT_TEXT_CONFIG.text, DEFAULT_TEXT_CONFIG.size, whRatio, size);
                const geometry = new THREE.PlaneGeometry(textSize.width, textSize.height);

                if (!checkoutParams(from, sourceType, mode)) {
                    return;
                }

                const modelDefaultConfigs = generateModelDefaultConfigs(from, sourceType, mode);
                const config = { ...modelDefaultConfigs.config, ...DEFAULT_TEXT_CONFIG };
                const { gcodeConfig } = modelDefaultConfigs;

                // const model = new Model(modelInfo);
                const modelState = modelGroup.generateModel({
                    limitSize: size,
                    headerType: from,
                    sourceType,
                    originalName,
                    uploadName,
                    sourceWidth: width,
                    sourceHeight: height,
                    geometry,
                    material,
                    transformation: {
                        width: textSize.width,
                        height: textSize.height
                    }
                });
                const toolPathModelState = toolPathModelGroup.generateToolPathModel({
                    modelID: modelState.selectedModelID,
                    mode,
                    config,
                    gcodeConfig
                });

                dispatch(actions.updateState(from, {
                    ...modelState,
                    ...toolPathModelState
                }));

                dispatch(actions.previewModel(from));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.updateState(
                    from,
                    {
                        hasModel: true
                    }
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
            // for (const model of modelGroup.children) {
            return modelGroup.totalEstimatedTime();
        }
    },

    getSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        return modelGroup.getSelectedModel();
    },

    selectModel: (from, modelMeshObject) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const selectedModel = modelGroup.selectModel(modelMeshObject);
        const toolPathModelState = toolPathModelGroup.selectToolPathModel(selectedModel.selectedModelID);

        const state = {
            ...selectedModel,
            ...toolPathModelState
        };
        dispatch(actions.updateState(from, state));
    },

    removeSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const modelState = modelGroup.removeSelectedModel();
        const toolPathModelState = toolPathModelGroup.removeSelectedToolPathModel();
        dispatch(actions.updateState(from, {
            ...modelState,
            ...toolPathModelState
        }));
        dispatch(actions.render(from));
        if (!modelGroup.isHasModel()) {
            dispatch(actions.updateState(
                from,
                {
                    stage: 0,
                    progress: 0
                }
            ));
        }
    },

    unselectAllModels: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        const modelState = modelGroup.unselectAllModels();
        const toolPathModelState = toolPathModelGroup.unselectAllModels();
        dispatch(actions.updateState(from, {
            ...modelState,
            ...toolPathModelState
        }));
    },

    // todo p0
    // gcode
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

    updateSelectedModelPrintOrder: (from, printOrder) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[from];
        toolPathModelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(actions.updateState(
            from,
            { printOrder }
        ));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        const { toolPathModelGroup } = getState()[from];
        toolPathModelGroup.updateSelectedGcodeConfig(gcodeConfig);
        dispatch(actions.updateGcodeConfig(from, gcodeConfig));
        dispatch(actions.previewModel(from));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateConfig(config);
        const { toolPathModelGroup } = getState()[from];
        toolPathModelGroup.updateSelectedConfig(config);
        dispatch(actions.updateConfig(from, config));
        dispatch(actions.previewModel(from));
        dispatch(actions.resetCalculatedState(from));
    },

    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        // const { modelGroup, model } = getState()[from];
        const { toolPathModelGroup, selectedModelID } = getState()[from];
        toolPathModelGroup.updateAllModelConfig(config);
        dispatch(actions.manualPreview(from));
        if (selectedModelID) {
            dispatch(actions.updateConfig(from, config));
            dispatch(actions.resetCalculatedState(from));
            dispatch(actions.render(from));
        }
    },

    updateSelectedModelTextConfig: (from, config) => (dispatch, getState) => {
        console.log('updateSelectedModelTextConfig');
        const { size } = getState().machine;
        const { modelGroup, toolPathModelGroup, transformation } = getState()[from];
        const toolPathModelState = toolPathModelGroup.getSelectedToolPathModelState();
        const newConfig = {
            ...toolPathModelState.config,
            ...config
        };
        api.convertTextToSvg(newConfig)
            .then((res) => {
                const { originalName, uploadName, width, height } = res.body;
                const whRatio = width / height;
                const source = { originalName, uploadName, sourceHeight: height, sourceWidth: width };

                const textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, whRatio, size);

                modelGroup.updateSelectedSource(source);
                modelGroup.updateSelectedModelTransformation({ ...textSize });
                toolPathModelGroup.updateSelectedConfig(newConfig);

                dispatch(actions.updateState(from, {
                    ...source,
                    newConfig,
                    transformation: {
                        ...transformation,
                        ...textSize
                    }
                }));

                dispatch(actions.showModelObj3D(from));
                dispatch(actions.previewModel(from));
                dispatch(actions.updateConfig(from, newConfig));
                dispatch(actions.resetCalculatedState(from));
                dispatch(actions.render(from));
            });
    },

    onSetSelectedModelPosition: (from, position) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // const transformation = model.modelInfo.transformation;
        const { transformation } = getState()[from];
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
        const { transformation } = getState()[from];
        let flip = transformation.flip;
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
        transformation.flip = flip;
        dispatch(actions.updateSelectedModelTransformation(from, transformation));
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
        dispatch(actions.render(from));
    },

    redo: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.redo();
        dispatch(actions.render(from));
    },

    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        // const { model } = getState()[from];
        // model.updateTransformation(transformation);
        const { modelGroup } = getState()[from];
        const modelTransformation = modelGroup.updateSelectedModelTransformation(transformation);

        dispatch(actions.updateTransformation(from, modelTransformation));
        dispatch(actions.showModelObj3D(from));
        // preview on onModelAfterTransform
        // dispatch(actions.previewModel(from));
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        const modelTransformation = modelGroup.onSelectedTransform();
        dispatch(actions.updateTransformation(from, modelTransformation));
        dispatch(actions.showModelObj3D(from));
    },

    onModelAfterTransform: () => (dispatch, getState) => {
        console.log('onModelAfterTransform');
        for (const from of ['laser', 'cnc']) {
            const { modelGroup } = getState()[from];
            if (modelGroup) {
                const modelState = modelGroup.onModelAfterTransform();
                dispatch(actions.updateState(from, {
                    modelState
                }));
                dispatch(actions.previewModel(from));
            }
        }
    },

    setAutoPreview: (from, value) => (dispatch) => {
        dispatch(actions.manualPreview(from));
        dispatch(actions.updateState(
            from,
            {
                autoPreviewEnabled: value
            }
        ));
    },

    manualPreview: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        for (const model of modelGroup.getModels()) {
            const modelTaskInfo = model.getTaskInfo();
            const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
            if (toolPathModelTaskInfo) {
                const taskInfo = {
                    ...modelTaskInfo,
                    ...toolPathModelTaskInfo
                };
                console.log('manualPreview');
                controller.commitTask(taskInfo);
            }
        }
    },

    previewModel: (from, isPreview) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup, autoPreviewEnabled } = getState()[from];
        if (isPreview || autoPreviewEnabled) {
            const modelTaskInfo = modelGroup.getSelectedModelTaskInfo();
            if (modelTaskInfo) {
                const toolPathModelTaskInfo = toolPathModelGroup.getToolPathModelTaskInfo(modelTaskInfo.modelID);
                if (toolPathModelTaskInfo) {
                    const taskInfo = {
                        ...modelTaskInfo,
                        ...toolPathModelTaskInfo
                    };
                    console.log('previewModel:taskInfo');
                    console.log(JSON.stringify(taskInfo));
                    controller.commitTask(taskInfo);
                }
            }
        }
    },

    // todo: listen config, gcodeConfig
    initSelectedModelListener: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];

        modelGroup.onSelectedModelTransformChanged = () => {
            // const { model } = getState()[from];
            // model.onTransform();
            // model.updateTransformationFromModel();
            const transformation = modelGroup.onSelectedTransform();

            dispatch(actions.showAllModelsObj3D(from));
            dispatch(actions.manualPreview(from));
            dispatch(actions.updateTransformation(from, transformation));
            dispatch(actions.render(from));
        };

        // modelGroup.addEventListener('update', () => {
        modelGroup.object.addEventListener('update', () => {
            dispatch(actions.render(from));
        });
    },

    showAllModelsObj3D: (from) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        modelGroup.showAllModelsObj3D();
        toolPathModelGroup.hideAllModelsObj3D();
    },

    showModelObj3D: (from, modelID) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        if (!modelID) {
            modelID = modelGroup.getSelectedModelTaskInfo().modelID;
        }
        modelGroup.showModelObj3D(modelID);
        toolPathModelGroup.hideToolPathObj3D(modelID);
    },

    showToolPathModelObj3D: (from, modelID) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[from];
        if (!modelID) {
            modelID = modelGroup.getSelectedModelTaskInfo().modelID;
        }
        modelGroup.hideModelObj3D(modelID);
        toolPathModelGroup.showToolPathObj3D(modelID);
    },

    // todo p0
    onReceiveTaskResult: (from, taskResult) => async (dispatch, getState) => {
        console.log(`onReceiveTaskResult:${from}`);
        // const state = getState()[from];
        const { toolPathModelGroup } = getState()[from];

        if (taskResult.status === 'failed') {
            dispatch(actions.updateState(from, {
                previewUpdated: +new Date(),
                previewFailed: true
            }));
            return;
        }

        const toolPathModelState = await toolPathModelGroup.receiveTaskResult(taskResult);

        if (toolPathModelState) {
            console.log('toolPathModelState');
            dispatch(actions.showToolPathModelObj3D(from, toolPathModelState.modelID));
        }

        dispatch(actions.updateState(from, {
            previewUpdated: +new Date(),
            previewFailed: false
        }));
        dispatch(actions.render(from));
    }
};

export default function reducer() {
    return {};
}
