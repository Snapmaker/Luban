import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import {
    PAGE_EDITOR,
    HEAD_CNC,
    SOURCE_TYPE,
    SVG_NODE_NAME_IMAGE,
    SVG_NODE_NAME_TEXT
} from '../../../constants';
import i18n from '../../../lib/i18n';
import TextParameters from '../CncLaserShared/TextParameters';
import TransformationSection from '../CncLaserShared/TransformationSection';
import Image3dParameters from './Image3dParameters';
import ImageProcessMode from './ImageProcessMode';
import { actions as editorActions } from '../../../flux/editor';

const CNCPath = ({ widgetActions }) => {
    const page = useSelector(state => state?.cnc?.page);
    const selectedModelArray = useSelector(state => state?.cnc?.modelGroup?.getSelectedModelArray());
    const selectedModelVisible = useSelector(state => state?.cnc?.modelGroup?.getSelectedModel()?.visible);
    const selectedModel = useSelector(state => state?.cnc?.modelGroup?.getSelectedModel());
    const hasSelectedModels = useSelector(state => state?.cnc?.modelGroup.getSelectedModelArray().length > 0);

    const {
        sourceType,
        config
    } = selectedModel;
    const selectedNotHide = selectedModelArray && selectedModelArray.length === 1 && selectedModelVisible;

    const isTextVector = (config.svgNodeName === SVG_NODE_NAME_TEXT);
    const isImage3d = (sourceType === SOURCE_TYPE.IMAGE3D);
    const isEditor = page === PAGE_EDITOR;
    const showImageProcessMode = (sourceType === SOURCE_TYPE.RASTER || sourceType === SOURCE_TYPE.SVG) && config.svgNodeName === SVG_NODE_NAME_IMAGE;

    const dispatch = useDispatch();
    useEffect(() => {
        widgetActions.setTitle(i18n._('key_ui/widgets/CNCPath/CNCPath_Transformation'));
    }, []);
    useEffect(() => {
        if (page === PAGE_EDITOR) {
            widgetActions.setDisplay(true);
        } else {
            widgetActions.setDisplay(false);
        }
    }, [page]);

    const actions = {
        modifyText: (element, options) => {
            dispatch(editorActions.modifyText(HEAD_CNC, element, options));
        }
    };

    return (
        <React.Fragment>
            {isEditor && (
                <TransformationSection
                    disabled={!hasSelectedModels}
                    headType={HEAD_CNC}
                    updateSelectedModelUniformScalingState={
                        (params) => dispatch(editorActions.updateSelectedModelUniformScalingState('cnc', params))
                    }
                />
            )}
            {selectedModelArray.length === 1 && (
                <div>
                    {isEditor && showImageProcessMode && (selectedModelArray.length === 1) && (
                        <ImageProcessMode
                            disabled={!selectedNotHide}
                            changeSelectedModelMode={
                                (newSourceType, newMode) => dispatch(editorActions.changeSelectedModelMode('cnc', newSourceType, newMode))
                            }
                        />
                    )}
                    {isEditor && isTextVector && (
                        <TextParameters
                            disabled={!selectedModelVisible}
                            modifyText={actions.modifyText}
                            headType={HEAD_CNC}
                        />
                    )}
                    {isEditor && isImage3d && (
                        <Image3dParameters
                            disabled={!selectedModelVisible}
                            config={config}
                            updateSelectedModelConfig={
                                (params) => dispatch(editorActions.updateSelectedModelConfig('cnc', params))
                            }
                        />
                    )}
                </div>
            )}
        </React.Fragment>
    );
};

CNCPath.propTypes = {
    widgetActions: PropTypes.object.isRequired
};

export default CNCPath;
