import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import i18n from '../../../lib/i18n';
import TextParameters from '../CncLaserShared/TextParameters';
import TransformationSection from '../CncLaserShared/TransformationSection';
import { HEAD_LASER, PAGE_EDITOR, SOURCE_TYPE, SVG_NODE_NAME_IMAGE } from '../../../constants';


import ImageProcessMode from './ImageProcessMode';
import { actions as editorActions } from '../../../flux/editor';

const LaserParameters = ({ widgetActions }) => {
    const dispatch = useDispatch();

    const page = useSelector(state => state?.laser?.page);
    const selectedModelArray = useSelector(state => state?.laser?.modelGroup?.getSelectedModelArray());
    const selectedModelVisible = useSelector(state => state?.laser?.modelGroup?.getSelectedModel()?.visible);
    const selectedModel = useSelector(state => state?.laser?.modelGroup?.getSelectedModel());
    const hasSelectedModels = useSelector(state => state?.laser?.modelGroup.getSelectedModelArray().length > 0);
    const SVGCanvasMode = useSelector(state => state?.laser?.SVGCanvasMode);
    const SVGCanvasExt = useSelector(state => state?.laser?.SVGCanvasExt);

    const {
        sourceType,
        config
    } = selectedModel;

    const isTextVector = config.isText;
    const isEditor = page === PAGE_EDITOR;
    const isDrawing = SVGCanvasMode === 'draw' || (
        SVGCanvasMode === 'select' && SVGCanvasExt?.elem
    );

    const showImageProcessMode = (sourceType === SOURCE_TYPE.RASTER || sourceType === SOURCE_TYPE.SVG) && (
        config.svgNodeName === SVG_NODE_NAME_IMAGE
        || !config.drawn
    );

    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Laser/TransformationSection-Transformation'));
    }, []);

    useEffect(() => {
        if (page === PAGE_EDITOR) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [page]);

    return (
        <React.Fragment>
            {isEditor && (
                <TransformationSection
                    headType={HEAD_LASER}
                    updateSelectedModelUniformScalingState={
                        (params) => dispatch(editorActions.updateSelectedModelUniformScalingState(HEAD_LASER, params))
                    }
                    disabled={!hasSelectedModels}
                />
            )}
            {isEditor && showImageProcessMode && !isDrawing && (selectedModelArray.length === 1) && (
                <ImageProcessMode
                    disabled={!selectedModelVisible}
                />
            )}

            {isEditor && isTextVector && !isDrawing && (selectedModelArray.length === 1) && (
                <TextParameters
                    disabled={!selectedModelVisible}
                    headType={HEAD_LASER}
                    modifyText={
                        (element, options) => dispatch(editorActions.modifyText(HEAD_LASER, element, options))
                    }
                />
            )}
        </React.Fragment>
    );
};

LaserParameters.propTypes = {
    widgetActions: PropTypes.object
};

export default LaserParameters;
