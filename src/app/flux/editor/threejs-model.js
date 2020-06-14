import { baseActions } from './base';

export const threejsModelActions = {
    generateThreejsModel: (headType, options) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];

        const modelState = modelGroup.generateModel(options);
        const toolPathModelState = toolPathModelGroup.generateToolPathModel(options);

        dispatch(baseActions.updateState(headType, {
            ...modelState,
            ...toolPathModelState
        }));
    },

    selectModel: (headType, modelID) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const selectedModelState = modelGroup.selectModelById(modelID);
        const toolPathModelState = toolPathModelGroup.selectToolPathModel(modelID);

        const state = {
            ...selectedModelState,
            ...toolPathModelState
        };
        dispatch(baseActions.updateState(headType, state));
    },

    // unselectAllModels: (headType) => (dispatch, getState) => {
    //     const { modelGroup, toolPathModelGroup } = getState()[headType];
    //     const modelState = modelGroup.unselectAllModels();
    //     const toolPathModelState = toolPathModelGroup.unselectAllModels();
    //     dispatch(baseActions.updateState(headType, {
    //         ...modelState,
    //         ...toolPathModelState
    //     }));
    // },

    // callback

    updateSelectedModelTransformation: (headType, transformation) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelState = modelGroup.updateSelectedModelTransformation(transformation);

        if (modelState) {
            toolPathModelGroup.updateSelectedNeedPreview(true);
            dispatch(baseActions.updateTransformation(headType, modelState.transformation));
            dispatch(baseActions.resetCalculatedState(headType));
            dispatch(baseActions.render(headType));
        }
    }
};
