import path from 'path';
import * as THREE from 'three';
import api from '../../api';
import modelGroup2D from '../ModelGroup2D';
import Model2D from '../Model2D';
import { WEB_CACHE_IMAGE } from '../../constants';
import { ModelInfo, DEFAULT_TEXT_CONFIG } from '../ModelInfoUtils';
import { checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './helpers';


const INITIAL_STATE = {
    // workflowState: idle, running, paused
    workState: 'idle',

    // Model
    modelGroup: modelGroup2D,
    background: {
        enabled: false,
        group: new THREE.Group()
    },
    fonts: [], // available fonts to use
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }

    // Selected
    model: null, // selected model
    mode: '', // bw, greyscale, vector
    printOrder: 1,
    transformation: {},
    gcodeConfig: {},
    config: {}
};

const ACTION_UPDATE_STATE = 'laser/ACTION_UPDATE_STATE';

const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_SET_FONTS = 'laser/ACTION_SET_FONTS';

const ACTION_RESET_CALCULATED_STATE = 'laser/ACTION_RESET_CALCULATED_STATE';

const ACTION_UPDATE_TRANSFORMATION = 'laser/ACTION_UPDATE_TRANSFORMATION';
const ACTION_UPDATE_GCODE_CONFIG = 'laser/ACTION_UPDATE_GCODE_CONFIG';
const ACTION_UPDATE_CONFIG = 'laser/ACTION_UPDATE_CONFIG';

const ACTION_SET_BACKGROUND_ENABLED = 'laser/ACTION_SET_BACKGROUND_ENABLED';

export const actions = {
    // Update state directly
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },
    // Update workState
    updateWorkState: (workState) => {
        return {
            type: ACTION_UPDATE_STATE,
            state: { workState }
        };
    },
    updateTransformation: (transformation) => {
        return {
            type: ACTION_UPDATE_TRANSFORMATION,
            transformation
        };
    },
    updateGcodeConfig: (gcodeConfig) => {
        return {
            type: ACTION_UPDATE_GCODE_CONFIG,
            gcodeConfig
        };
    },
    updateConfig: (config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            config
        };
    },

    // Operate models
    uploadImage: (file, mode, onError) => (dispatch, getState) => {
        const { size } = getState().machine;

        const state = getState().laser;
        const formData = new FormData();
        formData.append('image', file);

        api.uploadImage(formData)
            .then((res) => {
                const { width, height, name, filename } = res.body;

                // Infer model type
                let modelType = 'raster';
                if (path.extname(file.name).toLowerCase() === '.svg') {
                    modelType = 'svg';
                }

                const modelInfo = new ModelInfo(size);
                modelInfo.setType('laser');
                modelInfo.setSource(modelType, name, filename, width, height);
                modelInfo.setMode(mode);
                modelInfo.generateDefaults();

                const model2D = new Model2D(modelInfo);
                model2D.enableAutoPreview();

                state.modelGroup.addModel(model2D);
                dispatch(actions.selectModel(model2D));

                dispatch(actions.resetCalculatedState());
            })
            .catch((err) => {
                onError && onError(err);
            });
    },
    insertDefaultTextVector: () => (dispatch, getState) => {
        const { size } = getState().machine;

        const state = getState().laser;
        const { modelGroup } = state;
        api.convertTextToSvg(DEFAULT_TEXT_CONFIG)
            .then((res) => {
                const { name, filename, width, height } = res.body;

                const modelInfo = new ModelInfo(size);
                modelInfo.setType('laser');
                modelInfo.setSource('text', name, filename, width, height);
                modelInfo.setMode('vector');
                modelInfo.generateDefaults();

                const model = new Model2D(modelInfo);
                model.enableAutoPreview();
                modelGroup.addModel(model);

                dispatch(actions.selectModel(model));

                dispatch(actions.updateState({
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }));

                const textSize = computeTransformationSizeForTextVector(modelInfo.config.text, modelInfo.config.size, { width, height });
                dispatch(actions.updateSelectedModelTransformation({ ...textSize }));
            });
    },

    updateIsAllModelsPreviewed: () => (dispatch, getState) => {
        const state = getState().laser;
        const { modelGroup } = state;
        let allPreviewed = checkIsAllModelsPreviewed(modelGroup);
        dispatch(actions.updateState({
            isAllModelsPreviewed: allPreviewed
        }));
        return allPreviewed;
    },
    selectModel: (model) => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.selectModel(model);

        // Copy state from model.modelInfo
        const modelInfo = model.modelInfo;
        const { mode, config, gcodeConfig, transformation, printOrder } = modelInfo;
        dispatch(actions.updateState({
            model: model,
            mode: mode,
            printOrder: printOrder,
            transformation: transformation,
            gcodeConfig: gcodeConfig,
            config: config
        }));
    },
    removeSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.removeSelectedModel();
        dispatch(actions.updateState({
            model: null,
            mode: '',
            transformation: {},
            printOrder: 0,
            gcodeConfig: {},
            config: {}
        }));
    },
    unselectAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.unselectAllModels();
        dispatch(actions.updateState({
            model: null,
            mode: '',
            transformation: {},
            printOrder: 0,
            gcodeConfig: {},
            config: {},
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
        // bubble sort: https://codingmiles.com/sorting-algorithms-bubble-sort-using-javascript/
        const sorted = getState().laser.modelGroup.getModels();
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
    // Model configurations
    resetCalculatedState: () => {
        return {
            type: ACTION_RESET_CALCULATED_STATE
        };
    },
    updateSelectedModelPrintOrder: (printOrder) => (dispatch, getState) => {
        const { model } = getState().laser;
        model.modelInfo.printOrder = printOrder;

        dispatch(actions.updateState({ printOrder }));
        dispatch(actions.resetCalculatedState());
    },
    updateSelectedModelSource: (source) => (dispatch, getState) => {
        const { model } = getState().laser;
        model.updateSource(source);

        dispatch(actions.resetCalculatedState());
    },
    updateSelectedModelTransformation: (transformation) => (dispatch, getState) => {
        // width and height are linked
        const { model } = getState().laser;
        model.updateTransformation(transformation);

        // Update state
        dispatch(actions.updateTransformation(model.modelInfo.transformation));
        dispatch(actions.resetCalculatedState());
    },
    updateSelectedModelGcodeConfig: (gcodeConfig) => (dispatch, getState) => {
        const model = getState().laser.model;
        model.updateGcodeConfig(gcodeConfig);
        dispatch(actions.updateGcodeConfig(model.modelInfo.gcodeConfig));
        dispatch(actions.resetCalculatedState());
    },
    updateSelectedModelConfig: (config) => (dispatch, getState) => {
        const state = getState().laser;
        const { model } = state;
        model.updateConfig(config);
        dispatch(actions.updateConfig(model.modelInfo.config));
        dispatch(actions.resetCalculatedState());
    },
    updateSelectedModelTextConfig: (config) => (dispatch, getState) => {
        const state = getState().laser;
        const model = state.model;
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

                dispatch(actions.updateSelectedModelSource(source));

                dispatch(actions.updateSelectedModelTransformation({ ...size }));

                dispatch(actions.updateSelectedModelConfig(newConfig));
            });
    },

    // callback
    onModelTransform: () => (dispatch, getState) => {
        const { model } = getState().laser;
        model.onTransform();
        model.updateTransformationFromModel();

        dispatch(actions.updateTransformation(model.modelInfo.transformation));
    },
    // background img
    setBackgroundEnabled: (enabled) => {
        return {
            type: ACTION_SET_BACKGROUND_ENABLED,
            enabled
        };
    },
    setBackgroundImage: (filename, bottomLeftPoint, sideLength) => (dispatch, getState) => {
        const imgPath = `${WEB_CACHE_IMAGE}/${filename}`;
        const texture = new THREE.TextureLoader().load(imgPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            map: texture
        });
        const geometry = new THREE.PlaneGeometry(sideLength, sideLength);
        const mesh = new THREE.Mesh(geometry, material);
        const x = bottomLeftPoint.x + sideLength / 2;
        const y = bottomLeftPoint.y + sideLength / 2;
        mesh.position.set(x, y, 0);

        const state = getState().laser;
        const { group } = state.background;
        group.remove(...group.children);
        group.add(mesh);
        dispatch(actions.setBackgroundEnabled(true));
    },
    removeBackgroundImage: () => (dispatch, getState) => {
        const state = getState().laser;
        const { group } = state.background;
        group.remove(...group.children);
        dispatch(actions.setBackgroundEnabled(false));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, { ...action.state });
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

        case ACTION_RESET_CALCULATED_STATE: {
            return Object.assign({}, state, {
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        case ACTION_UPDATE_TRANSFORMATION: {
            return Object.assign({}, state, {
                transformation: {
                    ...state.transformation,
                    ...action.transformation
                }
            });
        }
        case ACTION_UPDATE_GCODE_CONFIG: {
            return Object.assign({}, state, {
                gcodeConfig: {
                    ...state.gcodeConfig,
                    ...action.gcodeConfig
                }
            });
        }
        case ACTION_UPDATE_CONFIG: {
            return Object.assign({}, state, {
                config: {
                    ...state.config,
                    ...action.config
                }
            });
        }

        // background image
        case ACTION_SET_BACKGROUND_ENABLED: {
            return Object.assign({}, state, {
                background: {
                    ...state.background,
                    enabled: action.enabled
                }
            });
        }
        default:
            return state;
    }
}
