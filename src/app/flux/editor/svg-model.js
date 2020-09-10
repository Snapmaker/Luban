export const svgModelActions = {
    generateSvgModel: (headType, options) => (dispatch, getState) => {
        const { size } = getState().machine;
        const { svgModelGroup } = getState()[headType];

        const { modelID, sourceType, uploadName, processImageName, transformation } = options;

        const { elem } = svgModelGroup.addModelToSVGElement({
            modelID,
            limitSize: size,
            uploadName: sourceType !== 'raster' && sourceType !== 'dxf' ? uploadName : processImageName,
            transformation
        });
        svgModelGroup.addModel(elem);
    },

    // eslint-disable-next-line no-unused-vars
    updateSelectedTransformation: (headType, transformation) => (dispatch, getState) => {
        // eslint-disable-next-line no-unused-vars
        const { svgModelGroup } = getState()[headType];
        svgModelGroup && svgModelGroup.updateSelectedElementsTransformation(transformation);
    },

    selectModel: (headType, model) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];
        svgModelGroup && svgModelGroup.addSelectedSvgModelsByModels([model]);
    },

    addSelectedSvgModels: (headType, models) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];
        svgModelGroup && svgModelGroup.addSelectedSvgModelsByModels(models);
    },

    resetSelection: (headType, transformation) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];
        svgModelGroup && svgModelGroup.resetSelection(transformation);
    },

    emptySelectedModelArray: (headType) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];
        svgModelGroup && svgModelGroup.clearSelection();
    }
};
