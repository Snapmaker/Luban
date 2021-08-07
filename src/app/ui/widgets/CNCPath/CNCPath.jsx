import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { PAGE_EDITOR, SOURCE_TYPE_IMAGE3D } from '../../../constants';
import i18n from '../../../lib/i18n';
import TextParameters from '../CncLaserShared/TextParameters';
import TransformationSection from '../CncLaserShared/TransformationSection';
import Image3dParameters from './Image3dParameters';
import ImageProcessMode from './ImageProcessMode';
import { actions as editorActions } from '../../../flux/editor';
import { actions as cncActions } from '../../../flux/cnc';

class CNCPath extends PureComponent {
    static propTypes = {
        widgetActions: PropTypes.object.isRequired,

        page: PropTypes.string.isRequired,

        hasSelectedModels: PropTypes.bool,
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        // transformation: PropTypes.object.isRequired,
        selectedModel: PropTypes.object,
        inProgress: PropTypes.bool.isRequired,
        isDXF: PropTypes.bool.isRequired,

        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
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
        this.props.widgetActions.setTitle(i18n._('Transformation'));
    }

    componentDidMount() {
        if (this.props.page === PAGE_EDITOR) {
            this.props.widgetActions.setDisplay(true);
        } else {
            this.props.widgetActions.setDisplay(false);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.page === PAGE_EDITOR) {
            this.props.widgetActions.setDisplay(true);
        } else {
            this.props.widgetActions.setDisplay(false);
        }
    }

    render() {
        const {
            page, selectedModelArray,
            selectedModelVisible, sourceType, mode,
            showOrigin, isDXF,
            config,
            changeSelectedModelShowOrigin, changeSelectedModelMode,
            updateSelectedModelUniformScalingState,
            selectedModel,
            modifyText,
            updateSelectedModelConfig,
            hasSelectedModels,
            inProgress
        } = this.props;
        const selectedNotHide = selectedModelArray && selectedModelArray.length === 1 && selectedModelVisible;

        const isTextVector = (config.svgNodeName === 'text');
        const isImage3d = (sourceType === SOURCE_TYPE_IMAGE3D);
        const isEditor = page === PAGE_EDITOR;
        const showImageProcessMode = (sourceType === 'raster' || sourceType === 'svg') && config.svgNodeName === 'image';

        return (
            <React.Fragment>
                {isEditor && (
                    <TransformationSection
                        disabled={inProgress || !hasSelectedModels}
                        headType="cnc"
                        updateSelectedModelUniformScalingState={updateSelectedModelUniformScalingState}
                    />
                )}
                {selectedModelArray.length === 1 && (
                    <div className="sm-parameter-container">
                        {isEditor && showImageProcessMode && (selectedModelArray.length === 1) && (
                            <ImageProcessMode
                                isDXF={isDXF}
                                sourceType={sourceType}
                                mode={mode}
                                disabled={inProgress || !selectedNotHide}
                                showOrigin={showOrigin}
                                changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                                changeSelectedModelMode={changeSelectedModelMode}
                            />
                        )}
                        {isEditor && isTextVector && (
                            <TextParameters
                                disabled={inProgress || !selectedModelVisible}
                                config={config}
                                headType="cnc"
                                selectedModel={selectedModel}
                                modifyText={modifyText}
                            />
                        )}
                        {isEditor && isImage3d && (
                            <Image3dParameters
                                disabled={inProgress || !selectedModelVisible}
                                config={config}
                                updateSelectedModelConfig={updateSelectedModelConfig}
                            />
                        )}
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { page, modelGroup, inProgress } = state.cnc;
    const selectedModel = modelGroup.getSelectedModel();
    const selectedModelID = selectedModel.modelID;
    const {
        sourceType,
        mode,
        showOrigin,
        transformation,
        config,
        originalName
    } = selectedModel;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    const hasSelectedModels = modelGroup.getSelectedModelArray().length > 0;
    const isDXF = originalName && (originalName.substr(originalName.length - 4, 4) === '.dxf');
    return {
        isDXF,
        selectedModelArray,
        page,
        transformation,
        selectedModelID,
        selectedModel,
        hasSelectedModels,
        // todo, next version fix like selectedModelID
        selectedModelVisible: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().visible,
        modelGroup,
        sourceType,
        mode,
        showOrigin,
        config,
        inProgress
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeActiveToolListDefinition: (definitionId, name) => dispatch(cncActions.changeActiveToolListDefinition(definitionId, name)),
        updateShowCncToolManager: (showCncToolManager) => dispatch(cncActions.updateShowCncToolManager(showCncToolManager)),
        updateSelectedModelUniformScalingState: (params) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelConfig: (params) => dispatch(editorActions.updateSelectedModelConfig('cnc', params)),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('cnc')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('cnc', sourceType, mode)),
        modifyText: (element, options) => dispatch(editorActions.modifyText('cnc', element, options))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CNCPath);
