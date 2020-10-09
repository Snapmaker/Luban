export const svgModelActions = {
    // eslint-disable-next-line no-unused-vars
    updateSelectedTransformation: (headType, transformation) => (dispatch, getState) => {
        // eslint-disable-next-line no-unused-vars
        const { SVGActions } = getState()[headType];
        SVGActions && SVGActions.updateSelectedElementsTransformation(transformation);
    },

    selectModel: (headType, model) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions && SVGActions.addSelectedSvgModelsByModels([model]);
    },

    addSelectedSvgModels: (headType, models) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions && SVGActions.addSelectedSvgModelsByModels(models);
    },

    resetSelection: (headType, transformation) => (dispatch, getState) => {
        const { SVGActions } = getState()[headType];
        SVGActions && SVGActions.resetSelection(transformation);
    }
};
