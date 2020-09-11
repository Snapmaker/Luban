import { baseActions } from './base';
// import { EPSILON } from '../../constants';

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

    selectModel: (headType, model) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        // const selectedModelState = modelGroup.selectModelById(model);
        const selectedModelState = modelGroup.state;
        const toolPathModelState = toolPathModelGroup.selectToolPathModel(model.modelID);

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

    updateSelectedModelTransformation: (headType, transformation, changeFrom) => (dispatch, getState) => {
        const { modelGroup, toolPathModelGroup } = getState()[headType];
        const modelState = modelGroup.updateSelectedModelTransformation(transformation);
        if (changeFrom && modelState && modelState.transformation.uniformScalingState === true) {
            if (changeFrom.height === modelState.transformation.height) {
                modelState.transformation.height = changeFrom.height * modelState.transformation.width / changeFrom.width;
            } else if (changeFrom.width === modelState.transformation.width) {
                modelState.transformation.width = changeFrom.width * modelState.transformation.height / changeFrom.height;
            }
        }

        if (changeFrom && modelState && modelState.transformation.uniformScalingState === true) {
            if (changeFrom.height === modelState.transformation.height) {
                modelState.transformation.height = changeFrom.height * modelState.transformation.width / changeFrom.width;
            } else if (changeFrom.width === modelState.transformation.width) {
                modelState.transformation.width = changeFrom.width * modelState.transformation.height / changeFrom.height;
            }
        }

        if (modelState) {
            toolPathModelGroup.updateSelectedNeedPreview(true);
            dispatch(baseActions.updateTransformation(headType, modelState.transformation));
            dispatch(baseActions.resetCalculatedState(headType));
            dispatch(baseActions.render(headType));
        }
    }
};
