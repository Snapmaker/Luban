import * as THREE from 'three';
// import { DATA_PREFIX, EPSILON } from '../../constants';
import { DATA_PREFIX } from '../../constants';
import controller from '../../lib/controller';
import ModelGroup from '../models/ModelGroup';
import {
    ACTION_RESET_CALCULATED_STATE, ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_GCODE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { actions as sharedActions } from '../cncLaserShared';

/*
const compareObject = (objA, objB) => {
    const propsA = Object.getOwnPropertyNames(objA);
    const propsB = Object.getOwnPropertyNames(objB);
    if (propsA.length !== propsB.length) {
        // console.log('AB length ', propsA.length, propsB.length);
        // return false;
    }
    for (let i = 0; i < propsA.length; i++) {
        const pName = propsA[i];
        // ignore list
        // if (pName === 'canUndo' || pName === 'canRedo') {
        if (pName === 'canUndo' || pName === 'canRedo' || pName === 'hasModel') {
            continue;
        }
        // nested object
        // if (typeof objA[pName] === 'object') {
        if (typeof objA[pName] === 'object' && objB[pName] === 'object') {
            console.log('nested ', pName, objA[pName], objB[pName]);
            return compareObject(objA[pName], objB[pName]);
        }
        if (objA[pName] !== objB[pName]) {
            // console.log('AB name1 ', pName, objA[pName], objB[pName]);
            // console.log('AB name1 ', pName);
            return false;
        }
    }
    return true;
};
*/

const INITIAL_STATE = {
    modelGroup: new ModelGroup(),
    isAllModelsPreviewed: false,
    isGcodeGenerated: false,
    gcodeBeans: [], // gcodeBean: { gcode, modelInfo }
    // selected
    // model: null,
    selectedModelID: null,
    sourceType: '',
    mode: '', // bw, greyscale, vector
    printOrder: 1,
    transformation: {},
    gcodeConfig: {},
    config: {},

    // selected model transformation
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,

    // modelGroup state
    canUndo: false,
    canRedo: false,
    hasModel: false,
    isAnyModelOverstepped: false,

    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model
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
    /*
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
    */

    init: () => (dispatch, getState) => {
        const controllerEvents = {
            'task:completed': (taskResult) => {
                dispatch(sharedActions.onReceiveTaskResult(taskResult));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });

        const laserState = getState().laser;
        const { modelGroup } = laserState;
        modelGroup.addStateChangeListener((state) => {
            // const { positionX, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ, hasModel } = state;
            // const tran1 = { positionX, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ };
            const { hasModel } = state;

            // console.log('state ', state);
            // console.log('laser state ', laserState);
            // const eq1 = Object.toJSON(state) === Object.toJSON(laserState);
            // const eq1 = compareObject(state, laserState);
            // console.log('j1', Object.toJSON(state));
            // if (!customCompareTransformation(tran1, tran2)) {
            // transformation changed
            // dispatch(actions.destroyGcodeLine());
            // dispatch(sharedActions.displayModel());
            // }

            if (!hasModel) {
                dispatch(sharedActions.updateState('laser', {
                    // stage: PRINTING_STAGE.EMPTY,
                    stage: 0,
                    progress: 0
                }));
                // dispatch(actions.destroyGcodeLine());
            }
            dispatch(sharedActions.updateState('laser', state));
            dispatch(sharedActions.updateState('laser', { renderingTimestamp: +new Date() }));
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
                    transformation: { ...state.transformation, ...action.transformation }
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
