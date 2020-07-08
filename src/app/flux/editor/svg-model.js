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
        svgModelGroup && svgModelGroup.updateTransformation(transformation);
    },

    selectModel: (headType, modelID) => (dispatch, getState) => {
        const { svgModelGroup } = getState()[headType];
        svgModelGroup && svgModelGroup.selectElementById(modelID);
    }
};
