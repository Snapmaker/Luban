// import uuid from 'uuid';
// import * as THREE from 'three';
// import Model from '../models/Model';
// import ModelGroup from '../models/ModelGroup';

/*
const materialSelected = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0xb0b0b0, shininess: 30 });
const materialNormal = new THREE.MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30 });
const materialOverstepped = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});

const INITIAL_STATE = {
    selectedModel: null,
    meterial: null,
    overstepped,
    renderingTimestamp: 0
};

export const actions = {
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    init: () => (dispatch, getState) => {
        modelGroup.addStateChangeListener((state) => {
            const modelState = getState().models;
            if (modelState.selectedModel !== state.selectedModel) {
                dispatch(actions.updateState({
                    selectedModel: state.selectedModel
                }));
            }

            dispatch(actions.updateState(state));

            dispatch(actions.updateState({ renderingTimestamp: +new Date() }));
        });
    },

    setSelected: (selectedModel) => (dispatch, getState) => {
        const modelState = getState().models;
        if (modelState.selectedModel === selectedModel) {
            return;
        }
        modelState.selectedModel = selectedModel;
        if (modelState.overstepped) {
            modelState.material = materialOverstepped;
        } else {
            modelState.material = (modelState.selectedModel ? materialSelected : materialNormal);
        }
    },

    isSelected: (model) => (dispatch, getState) => {
        const from = window.location.hash.split('/')[1];
        return getState()[from].model === model;
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE: {
            return Object.assign({}, state, action.state);
        }
        default:
            return state;
    }
}
*/
