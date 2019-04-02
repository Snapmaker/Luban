import * as THREE from 'three';
import api from '../../api';
import { WEB_CACHE_IMAGE } from '../../constants';
import controller from '../../lib/controller';
import ModelGroup2D from '../ModelGroup2D';
import {
    ACTION_RESET_CALCULATED_STATE, ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { actions as sharedActions } from '../cncLaserShared';

const INITIAL_STATE = {
    modelGroup: new ModelGroup2D(),
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }
    hasModel: false,
    // selected
    model: null,
    mode: '', // bw, greyscale, vector
    printOrder: 1,
    transformation: {},
    gcodeConfig: {},
    config: {},

    background: {
        enabled: false,
        group: new THREE.Group()
    },
    fonts: [], // available fonts to use

    previewUpdated: 0,
    previewFailed: false,
    autoPreviewEnabled: true
};

const ACTION_ADD_FONT = 'laser/ADD_FONT';
const ACTION_SET_FONTS = 'laser/ACTION_SET_FONTS';
const ACTION_SET_BACKGROUND_ENABLED = 'laser/ACTION_SET_BACKGROUND_ENABLED';

export const actions = {
    init: () => (dispatch) => {
        const controllerEvents = {
            'task:completed': (taskResult) => {
                dispatch(sharedActions.onReceiveTaskResult(taskResult));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
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
    const { from, type } = action;
    if (from === 'laser') {
        switch (type) {
            case ACTION_UPDATE_STATE: {
                return Object.assign({}, state, { ...action.state });
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
                    transformation: { ...state.transformation, ...action.transformation },
                });
            }
            case ACTION_UPDATE_GCODE_CONFIG: {
                return Object.assign({}, state, {
                    gcodeConfig: { ...state.gcodeConfig, ...action.gcodeConfig }
                });
            }
            case ACTION_UPDATE_CONFIG: {
                return Object.assign({}, state, {
                    config: { ...state.config, ...action.config }
                });
            }
            default:
                return state;
        }
    } else {
        switch (type) {
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
}
