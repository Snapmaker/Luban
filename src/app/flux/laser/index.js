import * as THREE from 'three';
// import { DATA_PREFIX, EPSILON } from '../../constants';
import { cloneDeep } from 'lodash';
import {
    COORDINATE_MODE_BOTTOM_CENTER,
    COORDINATE_MODE_BOTTOM_LEFT,
    COORDINATE_MODE_CENTER,
    DATA_PREFIX,
    DISPLAYED_TYPE_MODEL,
    HEAD_LASER,
    PAGE_EDITOR
} from '../../constants';
import ModelGroup from '../../models/ModelGroup';
import OperationHistory from '../operation-history/OperationHistory';
import SVGActionsFactory from '../../models/SVGActionsFactory';

import {
    ACTION_UPDATE_CONFIG,
    ACTION_UPDATE_STATE,
    ACTION_UPDATE_TRANSFORMATION
} from '../actionType';
import { actions as editorActions } from '../editor';
import ToolPathGroup from '../../toolpaths/ToolPathGroup';
import { CNC_LASER_STAGE } from '../editor/utils';
import definitionManager from '../manager/DefinitionManager';
import i18n from '../../lib/i18n';
import { timestamp } from '../../../shared/lib/random-utils';
import api from '../../api';


const initModelGroup = new ModelGroup('laser');
const operationHistory = new OperationHistory();
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

    history: operationHistory,
    targetTmpState: {},
    // When project recovered, the operation history should be cleared,
    // however we can not identify while the recovery is done, just exclude
    // them when the models loaded at the first time.
    excludeModelIDs: {},

    // modelGroup state
    hasModel: false,
    isAnyModelOverstepped: false,

    // boundingBox: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()), // bbox of selected model
    background: {
        enabled: false,
        group: new THREE.Group()
    },
    useBackground: false,

    previewFailed: false,
    autoPreviewEnabled: false,
    needToPreview: true,

    // rendering
    renderingTimestamp: 0,

    // coordinateMode
    coordinateMode: COORDINATE_MODE_CENTER,
    coordinateSize: { x: 0, y: 0 },

    // check to remove models
    removingModelsWarning: false,
    emptyToolPaths: [],

    // check not to duplicated create event
    initEventFlag: false,
    // used to manually control the gcode ganeration including thumbnails
    shouldGenerateGcodeCounter: 0
};

const ACTION_SET_BACKGROUND_ENABLED = 'laser/ACTION_SET_BACKGROUND_ENABLED';

export const actions = {
    // TODO: init should be  re-called
    init: () => async (dispatch, getState) => {
        dispatch(editorActions._init(HEAD_LASER));
        const { series } = getState().machine;

        await definitionManager.init(HEAD_LASER, series);
        dispatch(editorActions.updateState(HEAD_LASER, {
            toolDefinitions: await definitionManager.getConfigDefinitions(),
            activeToolListDefinition: definitionManager?.activeDefinition,
            defaultDefinitions: definitionManager?.defaultDefinitions
        }));

        // Set machine size into coordinate default size
        const { size } = getState().machine;
        const { coordinateSize, materials, useBackground } = getState().laser;
        const { isRotate } = materials;
        if (isRotate) {
            const newCoordinateSize = {
                x: materials.diameter * Math.PI,
                y: materials.length
            };
            dispatch(editorActions.changeCoordinateMode(HEAD_LASER, COORDINATE_MODE_BOTTOM_CENTER, newCoordinateSize));
        } else {
            if (size && coordinateSize.x === 0 && coordinateSize.y === 0) {
                dispatch(editorActions.updateState(HEAD_LASER, {
                    coordinateSize: size
                }));
            }
        }
        if (useBackground) {
            dispatch(actions.removeBackgroundImage());
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
        dispatch(editorActions.changeCoordinateMode(HEAD_LASER, COORDINATE_MODE_BOTTOM_LEFT));
        const { SVGActions } = state;
        const coordinateMode = COORDINATE_MODE_BOTTOM_LEFT; // const { coordinateMode } = state;

        SVGActions.addImageBackgroundToSVG({
            modelID: 'image-background',
            uploadName: filename,
            transformation: {
                width: width,
                height: height,
                positionX: (dx + width / 2) * coordinateMode.setting.sizeMultiplyFactor.x,
                positionY: (dy + height / 2) * coordinateMode.setting.sizeMultiplyFactor.y
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
        dispatch(editorActions.updateState(HEAD_LASER, {
            useBackground: true
        }));
        dispatch(editorActions.render('laser'));
    },

    removeBackgroundImage: () => (dispatch, getState) => {
        const state = getState().laser;
        dispatch(editorActions.clearBackgroundImage('laser'));

        const { group } = state.background;
        group.remove(...group.children);
        dispatch(actions.setBackgroundEnabled(false));
        dispatch(editorActions.updateState(HEAD_LASER, {
            useBackground: false
        }));
        dispatch(editorActions.render('laser'));
    },

    // Definitions
    updateToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const { toolDefinitions } = getState().laser;

        await definitionManager.updateDefinition(activeToolList);
        const isReplacedDefinition = (d) => d.definitionId === activeToolList.definitionId;
        const defintionIndex = toolDefinitions.findIndex(isReplacedDefinition);
        toolDefinitions.splice(defintionIndex, 1, activeToolList);
        dispatch(editorActions.updateState('laser', {
            toolDefinitions: [...toolDefinitions]
        }));

        return null;
    },
    updateToolDefinitionName: (isCategorySelected, definitionId, oldName, newName) => async (dispatch, getState) => {
        let definitionsWithSameCategory;
        const { toolDefinitions } = getState().laser;
        const activeDefinition = toolDefinitions.find(d => d.definitionId === definitionId);
        if (!newName || newName.trim().length === 0) {
            return Promise.reject(i18n._('Failed to rename. Please enter a new name.'));
        }
        if (isCategorySelected) {
            const duplicated = toolDefinitions.find(d => d.category === newName);
            if (duplicated) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            definitionsWithSameCategory = toolDefinitions.filter(d => d.category === oldName);
            for (const definition of definitionsWithSameCategory) {
                definition.category = newName;
                await definitionManager.updateDefinition(definition);
                // find the old tool category definition and replace it
                const isReplacedDefinition = (d) => d.definitionId === definition.definitionId;
                const index = toolDefinitions.findIndex(isReplacedDefinition);
                toolDefinitions.splice(index, 1, definition);
            }
        } else {
            definitionsWithSameCategory = toolDefinitions.filter(d => d.category === activeDefinition.category);
            const duplicatedToolList = definitionsWithSameCategory.find(d => d.name === newName);
            if (duplicatedToolList) {
                return Promise.reject(i18n._('Failed to rename. "{{name}}" already exists.', { newName }));
            }
            activeDefinition.name = newName;

            await definitionManager.updateDefinition(activeDefinition);
            // find the old tool category definition and replace it
            const isReplacedDefinition = (d) => d.definitionId === activeDefinition.definitionId;
            const index = toolDefinitions.findIndex(isReplacedDefinition);
            toolDefinitions.splice(index, 1, activeDefinition);
        }

        dispatch(editorActions.updateState('laser', {
            toolDefinitions: [...toolDefinitions]
        }));

        return null;
    },
    duplicateToolCategoryDefinition: (activeToolList, isCreate, oldCategory) => async (dispatch, getState) => {
        const state = getState().laser;
        const toolDefinitions = cloneDeep(state.toolDefinitions);
        let newCategoryName = activeToolList.category;
        const allDupliateDefinitions = [];
        // make sure category is not repeated
        while (toolDefinitions.find(d => d.category === newCategoryName)) {
            newCategoryName = `#${newCategoryName}`;
        }
        const definitionsWithSameCategory = isCreate ? [{ ...activeToolList, name: 'Default Tool' }]
            : state.toolDefinitions.filter(d => d.category === oldCategory);
        for (let i = 0; i < definitionsWithSameCategory.length; i++) {
            const newDefinition = definitionsWithSameCategory[i];
            newDefinition.category = newCategoryName;
            const definitionId = `${newDefinition.definitionId}${timestamp()}`;
            newDefinition.definitionId = definitionId;
            const createdDefinition = await definitionManager.createDefinition(newDefinition);
            if (createdDefinition) {
                allDupliateDefinitions.push(createdDefinition);
            }
        }
        dispatch(editorActions.updateState('laser', {
            toolDefinitions: [...toolDefinitions, ...allDupliateDefinitions]
        }));
        return allDupliateDefinitions[0];
    },

    removeToolCategoryDefinition: (category) => async (dispatch, getState) => {
        const state = getState().laser;
        const newToolDefinitions = state.toolDefinitions;
        const definitionsWithSameCategory = newToolDefinitions.filter(d => d.category === category);
        for (let i = 0; i < definitionsWithSameCategory.length; i++) {
            await definitionManager.removeDefinition(definitionsWithSameCategory[i]);
        }

        dispatch(editorActions.updateState('laser', {
            toolDefinitions: newToolDefinitions.filter(d => d.category !== category)
        }));
    },
    removeToolListDefinition: (activeToolList) => async (dispatch, getState) => {
        const state = getState().laser;
        await definitionManager.removeDefinition(activeToolList);
        const newToolDefinitions = state.toolDefinitions;
        const isReplacedDefinition = (d) => d.definitionId === activeToolList.definitionId;
        const index = newToolDefinitions.findIndex(isReplacedDefinition);
        newToolDefinitions.splice(index, 1);
        dispatch(editorActions.updateState('laser', {
            toolDefinitions: [...newToolDefinitions]
        }));
    },
    getDefaultDefinition: (definitionId) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().laser;
        const def = defaultDefinitions.find(d => d.definitionId === definitionId);
        return def?.settings;
    },
    resetDefinitionById: (definitionId) => (dispatch, getState) => {
        const { defaultDefinitions } = getState().laser;
        const defaultDefinition = defaultDefinitions.find(d => d.definitionId === definitionId);
        dispatch(actions.updateToolListDefinition(defaultDefinition));
    },
    onUploadToolDefinition: (file) => async (dispatch, getState) => {
        const { toolDefinitions } = getState().laser;
        const formData = new FormData();
        formData.append('file', file);
        // set a new name that cannot be repeated
        formData.append('uploadName', `${file.name.substr(0, file.name.length - 9)}${timestamp()}.def.json`);
        api.uploadFile(formData)
            .then(async (res) => {
                const response = res.body;
                const definitionId = `New.${timestamp()}`;
                const definition = await definitionManager.uploadDefinition(definitionId, response.uploadName);
                dispatch(editorActions.updateState('laser', {
                    toolDefinitions: [...toolDefinitions, definition]
                }));
            })
            .catch(() => {
                // Ignore error
            });
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
