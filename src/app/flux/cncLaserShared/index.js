import path from 'path';
import * as THREE from 'three';
import api from '../../api';
import { DEFAULT_TEXT_CONFIG, sizeModelByMachineSize } from '../models/ModelInfoUtils';
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

    init: (from) => (dispatch, getState) => {
        const laserState = getState()[from];
        const { modelGroup } = laserState;
        modelGroup.addStateChangeListener((type, state) => {
            switch (type) {
                case ACTION_UPDATE_TRANSFORMATION:
                    dispatch(actions.updateTransformation(from, state.transformation));
                    break;
                case ACTION_UPDATE_CONFIG:
                    dispatch(actions.updateConfig(from, state.config));
                    break;
                case ACTION_UPDATE_GCODE_CONFIG:
                    dispatch(actions.updateGcodeConfig(from, state.gcodeConfig));
                    break;
                case ACTION_UPDATE_STATE:
                    dispatch(actions.updateState(from, state));
                    break;
                default:
                    dispatch(actions.updateState(from, state));
                    break;
            }
            // dispatch(sharedActions.render('laser'));
        });
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
        const { modelGroup } = getState()[headerType];

        const sourceType = path.extname(uploadName).toLowerCase() === '.svg' ? 'svg' : 'raster';

        const { width, height } = sizeModelByMachineSize(size, sourceWidth, sourceHeight);
        // Generate geometry
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({ color: 0xe0e0e0, visible: false });

        let config = {};
        if (headerType === 'cnc') {
            const { toolDiameter, toolAngle } = getState().cnc.toolParams;
            config = { toolDiameter, toolAngle };
        }
        let transformation = {};
        if (`${headerType}-${sourceType}-${mode}` === 'cnc-raster-greyscale') {
            // model.updateTransformation({ width: 40 });
            transformation = { width: 40 };
        }

        modelGroup.generateModel({
            size,
            headerType,
            sourceType,
            originalName,
            uploadName,
            sourceWidth,
            sourceHeight,
            mode,
            geometry,
            material,
            config,
            transformation
        });


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
                const whRatio = width / height;
                const sourceType = 'text';
                const mode = 'vector';
                const textSize = computeTransformationSizeForTextVector(DEFAULT_TEXT_CONFIG.text, DEFAULT_TEXT_CONFIG.size, whRatio, size);
                const geometry = new THREE.PlaneGeometry(textSize.width, textSize.height);

                // const model = new Model(modelInfo);
                modelGroup.generateModel({
                    size,
                    headerType: from,
                    sourceType,
                    originalName,
                    uploadName,
                    sourceWidth: width,
                    sourceHeight: height,
                    mode,
                    geometry,
                    material,
                    config: DEFAULT_TEXT_CONFIG,
                    transformation: {
                        width: textSize.width,
                        height: textSize.height
                    }
                });
                // modelGroup.selectModel(model);
                // modelGroup.selectModel(model.meshObject);

                // dispatch(actions.selectModel(from, model));
                // dispatch(actions.selectModel(from, model.meshObject));
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
        const { modelGroup } = getState()[from];
        modelGroup.selectModel(modelMeshObject);
    },

    removeSelectedModel: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.removeSelectedModel();
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
        const { modelGroup } = getState()[from];
        modelGroup.unselectAllModels();
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

    // Model configurations
    resetCalculatedState: (from) => {
        return {
            type: ACTION_RESET_CALCULATED_STATE,
            from
        };
    },

    updateSelectedModelPrintOrder: (from, printOrder) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedPrintOrder(printOrder);

        dispatch(actions.updateState(
            from,
            { printOrder }
        ));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelTransformation: (from, transformation) => (dispatch, getState) => {
        // width and height are linked
        // const { model } = getState()[from];
        // model.updateTransformation(transformation);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedModelTransformation(transformation);
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    updateSelectedModelGcodeConfig: (from, gcodeConfig) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateGcodeConfig(gcodeConfig);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedGcodeConfig(gcodeConfig);

        // dispatch(actions.updateGcodeConfig(from, model.modelInfo.gcodeConfig));
        dispatch(actions.resetCalculatedState(from));
    },

    updateSelectedModelConfig: (from, config) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.updateConfig(config);
        const { modelGroup } = getState()[from];
        modelGroup.updateSelectedConfig(config);
        // dispatch(actions.updateConfig(from, model.modelInfo.config));
        dispatch(actions.resetCalculatedState(from));
        dispatch(actions.render(from));
    },

    updateAllModelConfig: (from, config) => (dispatch, getState) => {
        // const { modelGroup, model } = getState()[from];
        const { modelGroup, selectedModelID } = getState()[from];
        modelGroup.updateAllModelConfig(config);

        if (selectedModelID) {
            modelGroup.updateSelectedConfig(config);

            dispatch(actions.resetCalculatedState(from));
            dispatch(actions.render(from));
        }
    },

    updateSelectedModelTextConfig: (from, config) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { modelGroup } = getState()[from];
        const model = modelGroup.getSelectedModel();
        const newConfig = {
            ...model.config,
            ...config
        };
        api.convertTextToSvg(newConfig)
            .then((res) => {
                const { originalName, uploadName, width, height } = res.body;
                const whRatio = width / height;
                const sourceHeight = height;
                const sourceWidth = width;
                const source = { originalName, uploadName, sourceHeight, sourceWidth };

                const textSize = computeTransformationSizeForTextVector(newConfig.text, newConfig.size, whRatio, size);

                modelGroup.updateSelectedSource(source);
                modelGroup.updateSelectedModelTransformation({ ...textSize });
                modelGroup.updateSelectedConfig(config);

                dispatch(actions.resetCalculatedState(from));
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
        dispatch(actions.render(from));
    },

    redo: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];
        modelGroup.redo();
        dispatch(actions.render(from));
    },

    // callback
    onModelTransform: (from) => (dispatch, getState) => {
        // const { model } = getState()[from];
        // model.onTransform();
        // model.updateTransformationFromModel();
        const { modelGroup } = getState()[from];
        modelGroup.onSelectedTransform();
    },

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
        modelGroup.allModelPreview();
    },

    // todo: listen config, gcodeConfig
    initSelectedModelListener: (from) => (dispatch, getState) => {
        const { modelGroup } = getState()[from];

        modelGroup.onSelectedModelTransformChanged = () => {
            // const { model } = getState()[from];
            // model.onTransform();
            // model.updateTransformationFromModel();
            modelGroup.onSelectedTransform();
            // modelGroup.updateTransformationFromSelectedModel();

            dispatch(actions.render(from));
        };

        // modelGroup.addEventListener('update', () => {
        modelGroup.object.addEventListener('update', () => {
            dispatch(actions.render(from));
        });
    },

    // todo p0
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
