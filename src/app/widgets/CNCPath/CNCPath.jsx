import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { PAGE_EDITOR, PAGE_PROCESS, SOURCE_TYPE_IMAGE3D } from '../../constants';
import i18n from '../../lib/i18n';
import TextParameters from '../CncLaserShared/TextParameters';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import VectorParameters from './VectorParameters';
import Image3dParameters from './Image3dParameters';
import ImageProcessMode from './ImageProcessMode';
import ReliefGcodeParameters from './gcodeconfig/ReliefGcodeParameters';
import Image3DGcodeParameters from './gcodeconfig/Image3DGcodeParameters';
import { actions as editorActions } from '../../flux/editor';

class CNCPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        modelGroup: PropTypes.object,
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        materials: PropTypes.object.isRequired,
        // transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        selectedModel: PropTypes.object,

        // functions
        setDisplay: PropTypes.func.isRequired,

        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired,

        updateSelectedModelConfig: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,

        // operator functions
        modifyText: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Configurations'));
    }

    componentDidMount() {
        const { modelGroup } = this.props;
        if (modelGroup.getSelectedModelArray().length > 0) {
            this.props.setDisplay(true);
        } else {
            this.props.setDisplay(false);
        }
    }

    componentWillReceiveProps(nextProps) {
        const { modelGroup } = nextProps;
        if (modelGroup.getSelectedModelArray().length > 0) {
            this.props.setDisplay(true);
        } else {
            this.props.setDisplay(false);
        }
    }

    render() {
        const {
            page, selectedModelArray,
            selectedModelVisible, sourceType, mode,
            showOrigin,
            updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config,
            changeSelectedModelShowOrigin, changeSelectedModelMode,
            updateSelectedModelUniformScalingState,
            selectedModel,
            modifyText,
            updateSelectedModelConfig,
            materials
        } = this.props;
        const selectedNotHide = selectedModelArray && selectedModelArray.length === 1 && selectedModelVisible;

        const isRasterGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isSvgVector = ((sourceType === 'svg' || sourceType === 'dxf') && mode === 'vector');
        const isTextVector = (config.svgNodeName === 'text');
        const isImage3d = (sourceType === SOURCE_TYPE_IMAGE3D);
        const isEditor = page === PAGE_EDITOR;
        const isProcess = page === PAGE_PROCESS;
        const isProcessMode = isEditor && sourceType === 'raster' && config.svgNodeName !== 'text';
        const { isRotate } = materials;
        return (
            <React.Fragment>
                {isEditor && (
                    <Transformation
                        headType="cnc"
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelUniformScalingState={updateSelectedModelUniformScalingState}

                    />
                )}
                {selectedModelArray.length === 1 && (
                    <div className="sm-parameter-container">
                        {isProcessMode && (
                            <ImageProcessMode
                                sourceType={sourceType}
                                mode={mode}
                                disabled={!selectedNotHide}
                                showOrigin={showOrigin}
                                changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                                changeSelectedModelMode={changeSelectedModelMode}
                            />
                        )}
                        {isEditor && isTextVector && (
                            <TextParameters
                                disabled={!selectedModelVisible}
                                config={config}
                                headType="cnc"
                                selectedModel={selectedModel}
                                modifyText={modifyText}
                            />
                        )}
                        {isEditor && isImage3d && !isRotate && (
                            <Image3dParameters
                                disabled={!selectedModelVisible}
                                config={config}
                                updateSelectedModelConfig={updateSelectedModelConfig}
                            />
                        )}
                        {isProcess && (isSvgVector) && (
                            <VectorParameters
                                disabled={!selectedModelVisible}
                            />
                        )}
                        {isProcess && isRasterGreyscale && (
                            <ReliefGcodeParameters
                                disabled={!selectedModelVisible}
                            />
                        )}
                        {isProcess && isImage3d && (
                            <Image3DGcodeParameters
                                disabled={!selectedModelVisible}
                            />
                        )}
                    </div>
                )}
                {isProcess && (
                    <GcodeParameters
                        selectedModelArray={selectedModelArray}
                        selectedModelVisible={selectedModelVisible}
                        printOrder={printOrder}
                        gcodeConfig={gcodeConfig}
                        updateSelectedModelPrintOrder={updateSelectedModelPrintOrder}
                        updateSelectedModelGcodeConfig={updateSelectedModelGcodeConfig}
                        paramsDescs={
                            {
                                jogSpeed: i18n._('Determines how fast the tool moves when it’s not carving.'),
                                workSpeed: i18n._('Determines how fast the tool feeds into the material.'),
                                plungeSpeed: i18n._('Determines how fast the tool moves on the material.')
                            }
                        }
                    />
                )}
            </React.Fragment>
        );
    }
}

// todo, selected model will be instead
const mapStateToProps = (state) => {
    const { page, modelGroup, toolPathModelGroup, printOrder, materials } = state.cnc;
    const selectedModel = modelGroup.getSelectedModel();
    const gcodeConfig = toolPathModelGroup.getSelectedModel().gcodeConfig;
    const selectedModelID = selectedModel.modelID;
    const {
        sourceType,
        mode,
        showOrigin,
        transformation,
        config
    } = selectedModel;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    return {
        selectedModelArray,
        page,
        printOrder,
        transformation,
        gcodeConfig,
        selectedModelID,
        selectedModel,
        // todo, next version fix like selectedModelID
        selectedModelVisible: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().visible,
        modelGroup,
        sourceType,
        mode,
        showOrigin,
        config,
        materials
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelTransformation: (params, changeFrom) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params, changeFrom)),
        updateSelectedModelUniformScalingState: (params) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelConfig: (params) => dispatch(editorActions.updateSelectedModelConfig('cnc', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(editorActions.updateSelectedModelGcodeConfig('cnc', params)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(editorActions.updateSelectedModelPrintOrder('cnc', printOrder)),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('cnc')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('cnc', sourceType, mode)),

        modifyText: (element, options) => dispatch(editorActions.modifyText('cnc', element, options))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CNCPath);
