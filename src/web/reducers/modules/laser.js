import path from 'path';
import api from '../../api';
import ModelGroup2D from '../ModelGroup2D';
import Model2D from '../Model2D';
import { generateModelInfo } from '../ModelInfoUtils';

const ACTION_CHANGE_WORK_STATE = 'laser/CHANGE_WORK_STATE';
const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_SET_FONTS = 'laser/ACTION_SET_FONTS';
const ACTION_SET_GCODE_BEANS = 'laser/ACTION_SET_GCODE_BEANS';

const initialState = {
    modelGroup: new ModelGroup2D(),
    workState: 'idle', // workflowState: idle, running, paused
    gcodeBeans: [], // gcodeBean: { modelInfo, gcode }
    fonts: [] // available fonts to use
};

export const actions = {
    changeWorkState: (workState) => {
        return {
            type: ACTION_CHANGE_WORK_STATE,
            workState
        };
    },
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
            })
            .catch(() => {
                onFailure && onFailure();
            });
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
        dispatch(actions.setGcodeBeans(gcodeBeans));
    },
    setGcodeBeans: (gcodeBeans) => {
        return {
            type: ACTION_SET_GCODE_BEANS,
            gcodeBeans
        };
    }
};

// reducers
export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_CHANGE_WORK_STATE: {
            return Object.assign({}, state, {
                workState: action.workState
            });
        }
        case ACTION_SET_GCODE_BEANS: {
            return Object.assign({}, state, {
                gcodeBeans: action.gcodeBeans
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
        default:
            return state;
    }
}
