import * as THREE from 'three';
// import { DATA_PREFIX, EPSILON } from '../../constants';
import { COORDINATE_MODE_CENTER, DATA_PREFIX, DISPLAYED_TYPE_MODEL, HEAD_LASER, PAGE_EDITOR } from '../../constants';
import ModelGroup from '../../models/ModelGroup';
import SVGActionsFactory from '../../models/SVGActionsFactory';

import {
    ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { actions as editorActions } from '../editor';
import { machineStore } from '../../store/local-storage';
import ToolPathGroup from '../../toolpaths/ToolPathGroup';
import { CNC_LASER_STAGE } from '../editor/utils';


const initModelGroup = new ModelGroup('laser');
const INITIAL_STATE = {

    page: PAGE_EDITOR,

    materials: {
        isRotate: false,
        diameter: 40,
        length: 75,
        fixtureLength: 20,
        x: 0,
        y: 0,
        z: 0
    },

    stage: CNC_LASER_STAGE.EMPTY,
    progress: 0,
    inProgress: false,
    scale: 1,
    target: null,

    modelGroup: initModelGroup,
    SVGActions: new SVGActionsFactory(initModelGroup),

    displayedType: DISPLAYED_TYPE_MODEL,
    toolPathGroup: new ToolPathGroup(initModelGroup, 'laser'),
    updatingToolPath: null,
    showToolPath: false,
    showSimulation: false,

    isGcodeGenerating: false,
    isChangedAfterGcodeGenerating: true,
    gcodeFile: null,

    // model: null,
    selectedModelID: null,
    selectedModelVisible: true,
    sourceType: '',
    mode: '',
    showOrigin: null,

    printOrder: 1,
    transformation: {},
    transformationUpdateTime: new Date().getTime(),

    gcodeConfig: {},
    config: {},

    // snapshot state
    undoSnapshots: [{ models: [], toolPathModels: [] }], // snapshot { models, toolPathModels }
    redoSnapshots: [], // snapshot { models, toolPathModels }
    canUndo: false,
    canRedo: false,

    // modelGroup state
    hasModel: false,
    isAnyModelOverstepped: false,

    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model
    background: {
        enabled: false,
        group: new THREE.Group()
    },

    previewFailed: false,
    autoPreviewEnabled: false,

    // rendering
    renderingTimestamp: 0,

    // coordinateMode
    coordinateMode: COORDINATE_MODE_CENTER,
    coordinateSize: { x: 0, y: 0 }
};

const ACTION_SET_BACKGROUND_ENABLED = 'laser/ACTION_SET_BACKGROUND_ENABLED';

export const actions = {
    init: () => (dispatch, getState) => {
        dispatch(editorActions._init(HEAD_LASER));

        const materials = machineStore.get('laser.materials');
        if (materials) {
            dispatch(editorActions.updateMaterials('laser', materials));
        }

        // // Set machine size into coordinate default size
        const { size } = getState().machine;
        if (size) {
            dispatch(editorActions.updateState('laser', {
                coordinateSize: size
            }));
        }
    },

    setBackgroundEnabled: (enabled) => {
        return {
            type: ACTION_SET_BACKGROUND_ENABLED,
            enabled
        };
    },

    setBackgroundImage: (filename, width, height, dx, dy) => (dispatch, getState) => {
        const state = getState().laser;
        const { SVGActions } = state;

        SVGActions.addImageBackgroundToSVG({
            modelID: 'image-background',
            uploadName: filename,
            transformation: {
                width: width,
                height: height,
                positionX: dx + width / 2,
                positionY: dy + height / 2
            }
        });

        const imgPath = `${DATA_PREFIX}/${filename}`;
        const texture = new THREE.TextureLoader().load(imgPath, () => {
            dispatch(editorActions.render('laser'));
        });
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

        mesh.position.set(x, y, -0.001);
        const { group } = state.background;
        group.remove(...group.children);
        group.add(mesh);
        dispatch(actions.setBackgroundEnabled(true));
        dispatch(editorActions.render('laser'));
    },

    removeBackgroundImage: () => (dispatch, getState) => {
        const state = getState().laser;
        dispatch(editorActions.clearBackgroundImage('laser'));

        const { group } = state.background;
        group.remove(...group.children);
        dispatch(actions.setBackgroundEnabled(false));
        dispatch(editorActions.render('laser'));
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    const { headType, type } = action;
    if (headType === 'laser') {
        switch (type) {
            case ACTION_UPDATE_STATE: {
                return Object.assign({}, state, { ...action.state });
            }
            case ACTION_UPDATE_TRANSFORMATION: {
                return Object.assign({}, state, {
                    transformation: { ...state.transformation, ...action.transformation },
                    transformationUpdateTime: +new Date()
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
