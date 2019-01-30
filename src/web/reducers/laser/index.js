import path from 'path';
import * as THREE from 'three';
import api from '../../api';
import modelGroup2D from '../ModelGroup2D';
import Model2D from '../Model2D';
import { WEB_CACHE_IMAGE } from '../../constants';
import { ModelInfo, DEFAULT_TEXT_CONFIG } from '../ModelInfoUtils';
import { checkIsAllModelsPreviewed, computeTransformationSizeForTextVector } from './helpers';

const ACTION_SET_STATE = 'laser/ACTION_SET_STATE';

const ACTION_SET_WORK_STATE = 'laser/ACTION_SET_WORK_STATE';
const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_SET_FONTS = 'laser/ACTION_SET_FONTS';

const ACTION_SET_PRINT_ORDER = 'laser/ACTION_SET_PRINT_ORDER';
const ACTION_UPDATE_TRANSFORMATION = 'laser/ACTION_UPDATE_TRANSFORMATION';
const ACTION_UPDATE_GCODE_CONFIG = 'laser/ACTION_UPDATE_GCODE_CONFIG';
const ACTION_UPDATE_CONFIG = 'laser/ACTION_UPDATE_CONFIG';
const ACTION_SET_SOURCE = 'laser/ACTION_SET_SOURCE';

const ACTION_ON_MODEL_TRANSFORM = 'laser/ACTION_ON_MODEL_TRANSFORM';

const ACTION_SET_BG_IMG_ENABLED = 'laser/ACTION_SET_BG_IMG_ENABLED';

const INITIAL_STATE = {
    modelGroup: modelGroup2D,
    canPreview: false,
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }

    model: null, // selected model
    mode: '', // bw, greyscale, vector
    printOrder: 1,
    transformation: {},
    gcodeConfig: {},
    config: {},
    workState: 'idle', // workflowState: idle, running, paused
    fonts: [], // available fonts to use
    bgImg: {
        enabled: false,
        meshGroup: new THREE.Group()
    },

    // Calculated values and mirror of properties for display
    display: {
        modelType: '', // raster, svg, text
    },
};

export const actions = {
    // No-Reducer setState
    setState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state
        };
    },
    changeWorkState: (workState) => {
        return {
            type: ACTION_SET_WORK_STATE,
            workState
        };
    },
    changePrintOrder: (printOrder) => {
        return {
            type: ACTION_SET_PRINT_ORDER,
            printOrder
        };
    },

    // Operate models
    uploadImage: (file, mode, onError) => (dispatch, getState) => {
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

                const modelInfo = new ModelInfo();
                modelInfo.setType('laser');
                modelInfo.setSource(modelType, name, filename, width, height);
                modelInfo.setMode(mode);
                modelInfo.generateDefaults();

                const model2D = new Model2D(modelInfo);
                model2D.enableAutoPreview();

                state.modelGroup.addModel(model2D);
                dispatch(actions.selectModel(model2D));

                dispatch(actions.setState({
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }));
            })
            .catch((err) => {
                onError && onError(err);
            });
    },
    insertDefaultTextVector: () => (dispatch, getState) => {
        const state = getState().laser;
        const { modelGroup } = state;
        api.convertTextToSvg(DEFAULT_TEXT_CONFIG)
            .then((res) => {
                const { name, filename, width, height } = res.body;

                // const modelInfo = generateModelInfo('laser', 'text', 'vector', origin);
                const modelInfo = new ModelInfo();
                modelInfo.setType('laser');
                modelInfo.setSource('text', name, filename, width, height);
                modelInfo.setMode('vector');
                modelInfo.generateDefaults();

                const model2D = new Model2D(modelInfo);
                model2D.enableAutoPreview();
                modelGroup.addModel(model2D);

                dispatch(actions.selectModel(model2D));

                dispatch(actions.setState({
                    isAllModelsPreviewed: false,
                    isGcodeGenerated: false,
                    gcodeBeans: []
                }));

                const size = computeTransformationSizeForTextVector({ width, height }, modelInfo.config);
                dispatch(actions.updateTransformation({ ...size }));
            });
    },
    updateIsAllModelsPreviewed: () => (dispatch, getState) => {
        const state = getState().laser;
        let allPreviewed = checkIsAllModelsPreviewed(state.modelGroup);
        dispatch(actions.setState({
            isAllModelsPreviewed: allPreviewed
        }));
        return allPreviewed;
    },
    selectModel: (model) => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.selectModel(model);
        const modelInfo = model.getModelInfo();
        const { mode, config, gcodeConfig, transformation, printOrder } = modelInfo;
        dispatch(actions.setState({
            canPreview: true,
            isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
            model: model,
            mode: mode,
            printOrder: printOrder,
            transformation: transformation,
            gcodeConfig: gcodeConfig,
            config: config,
            display: {
                modelType: model.modelInfo.source.type
            }
        }));
    },
    removeSelectedModel: () => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.removeSelectedModel();
        dispatch(actions.setState({
            canPreview: false,
            isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
            model: null,
            mode: '',
            transformation: {},
            printOrder: 0,
            gcodeConfig: {},
            config: {},
            display: {
                modelType: ''
            }
        }));
    },
    unselectAllModels: () => (dispatch, getState) => {
        const { modelGroup } = getState().laser;
        modelGroup.unselectAllModels();
        dispatch(actions.setState({
            canPreview: false,
            isAllModelsPreviewed: checkIsAllModelsPreviewed(modelGroup),
            model: null,
            mode: '',
            transformation: {},
            printOrder: 0,
            gcodeConfig: {},
            config: {},
            display: {
                modelType: ''
            }
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
                if (sorted[j].getModelInfo().printOrder > sorted[j + 1].getModelInfo().printOrder) {
                    const tmp = sorted[j];
                    sorted[j] = sorted[j + 1];
                    sorted[j + 1] = tmp;
                }
            }
        }

        for (let i = 0; i < length; i++) {
            const model = sorted[i];
            const gcode = model.generateGcode();
            const modelInfo = model.getModelInfo();
            const gcodeBean = {
                gcode: gcode,
                modelInfo: modelInfo
            };
            gcodeBeans.push(gcodeBean);
        }
        dispatch(actions.setState({
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
    updateConfig: (config) => {
        return {
            type: ACTION_UPDATE_CONFIG,
            config
        };
    },
    setSource: (source) => {
        return {
            type: ACTION_SET_SOURCE,
            source
        };
    },
    // for text-vector
    updateTextConfig: (params) => (dispatch, getState) => {
        const state = getState().laser;
        const model = state.model;
        const modelInfo = model.getModelInfo();
        const config = {
            ...modelInfo.config,
            ...params
        };
        api.convertTextToSvg(config)
            .then((res) => {
                const { name, filename, width, height } = res.body;
                const source = {
                    name,
                    filename,
                    width,
                    height
                };
                dispatch(actions.setSource(source));
                const size = computeTransformationSizeForTextVector({ width, height }, config);
                dispatch(actions.updateTransformation({ ...size }));
                dispatch(actions.updateConfig(params));
            });
    },
    // callback
    onModelTransform: () => {
        return {
            type: ACTION_ON_MODEL_TRANSFORM
        };
    },
    // background img
    setBgImgEnabled: (value) => {
        return {
            type: ACTION_SET_BG_IMG_ENABLED,
            value
        };
    },
    deleteBgImg: () => (dispatch, getState) => {
        const state = getState().laser;
        const { bgImg } = state;
        const { meshGroup } = bgImg;
        meshGroup.remove(...meshGroup.children);
        dispatch(actions.setBgImgEnabled(false));
    },
    setBgImg: (filename, leftBottomVector2, length) => (dispatch, getState) => {
        // add img to meshGroup
        const state = getState().laser;
        const { bgImg } = state;
        const { meshGroup } = bgImg;

        const imgPath = `${WEB_CACHE_IMAGE}/${filename}`;
        const texture = new THREE.TextureLoader().load(imgPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            map: texture
        });
        const geometry = new THREE.PlaneGeometry(length, length);
        const mesh = new THREE.Mesh(geometry, material);
        const x = leftBottomVector2.x + length / 2;
        const y = leftBottomVector2.y + length / 2;
        mesh.position.set(x, y, 0);

        meshGroup.remove(...meshGroup.children);
        meshGroup.add(mesh);
        dispatch(actions.setBgImgEnabled(true));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
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
            const config = state.model.updateConfig(action.config);
            return Object.assign({}, state, {
                config: config,
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        case ACTION_SET_SOURCE: {
            state.model.setSource(action.source);
            return Object.assign({}, state, {
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        case ACTION_SET_PRINT_ORDER: {
            const { model } = state;
            const modelInfo = model.getModelInfo();
            modelInfo.printOrder = action.printOrder;
            return Object.assign({}, state, {
                printOrder: action.printOrder,
                isGcodeGenerated: false,
                gcodeBeans: []
            });
        }
        // callback
        case ACTION_ON_MODEL_TRANSFORM: {
            const { model } = state;
            model.onTransform();
            const modelInfo = model.getModelInfo();
            return Object.assign({}, state, {
                isAllModelsPreviewed: false,
                isGcodeGenerated: false,
                gcodeBeans: [],
                transformation: modelInfo.transformation
            });
        }
        // background img
        case ACTION_SET_BG_IMG_ENABLED: {
            const newBgImg = {
                ...state.bgImg,
                enabled: action.value
            };
            return Object.assign({}, state, {
                bgImg: newBgImg
            });
        }
        default:
            return state;
    }
}
