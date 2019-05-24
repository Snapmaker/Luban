import * as THREE from 'three';
import { DATA_PREFIX } from '../../constants';
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

    previewUpdated: 0,
    previewFailed: false,
    autoPreviewEnabled: true,

    // rendering
    renderingTimestamp: 0
};

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
    // background img
    setBackgroundEnabled: (enabled) => {
        return {
            type: ACTION_SET_BACKGROUND_ENABLED,
            enabled
        };
    },
    setBackgroundImage: (filename, width, height, dx, dy) => (dispatch, getState) => {
        const imgPath = `${DATA_PREFIX}/${filename}`;
        const texture = new THREE.TextureLoader().load(imgPath);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture
        });
        const geometry = new THREE.PlaneGeometry(width, height);
        const mesh = new THREE.Mesh(geometry, material);
        const x = dx + width / 2;
        const y = dy + height / 2;
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
