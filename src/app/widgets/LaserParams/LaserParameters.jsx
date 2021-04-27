import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import TextParameters from '../CncLaserShared/TextParameters';
import TransformationSection from '../CncLaserShared/TransformationSection';
import { PAGE_EDITOR } from '../../constants';


import ImageProcessMode from './ImageProcessMode';
import { actions as editorActions } from '../../flux/editor';

class LaserParameters extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        // model: PropTypes.object,
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        modelGroup: PropTypes.object,
        sourceType: PropTypes.string,
        processMode: PropTypes.string.isRequired,
        processNodeName: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        // config: PropTypes.object.isRequired,
        headType: PropTypes.string,

        setDisplay: PropTypes.func.isRequired,

        uploadImage: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,

        // operator functions
        modifyText: PropTypes.func.isRequired,

        switchToPage: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        uploadMode: '',
        accept: '',
        options: {
            originalName: '',
            uploadName: '',
            width: 0,
            height: 0,
            blackThreshold: 30,
            maskThreshold: 28,
            iterations: 1,
            colorRange: 15,
            numberOfObjects: 2
        }
    };

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];

            // Switch to PAGE_EDITOR page if new image being uploaded
            this.props.switchToPage(PAGE_EDITOR);

            const uploadMode = this.state.uploadMode;

            this.props.uploadImage(file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            });
        },
        updateOptions: (options) => {
            this.setState({
                options: {
                    ...this.state.options,
                    ...options
                }
            });
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Configurations'));
    }

    componentDidMount() {
        const { modelGroup } = this.props;
        if (modelGroup.getSelectedModelArray().length > 0 && this.props.page === PAGE_EDITOR) {
            this.props.setDisplay(true);
        } else {
            this.props.setDisplay(false);
        }
    }

    componentWillReceiveProps(nextProps) {
        const { modelGroup } = nextProps;
        if (modelGroup.getSelectedModelArray().length > 0 && nextProps.page === PAGE_EDITOR) {
            this.props.setDisplay(true);
        } else {
            this.props.setDisplay(false);
        }
    }

    render() {
        const { accept } = this.state;
        const {
            selectedModelArray, selectedModelVisible, sourceType, processMode, processNodeName,
            // config,
            changeSelectedModelMode, showOrigin, changeSelectedModelShowOrigin,
            headType, updateSelectedModelUniformScalingState,
            modifyText
        } = this.props;

        const actions = this.actions;

        const isEditor = this.props.page === PAGE_EDITOR;
        const isTextVector = (processNodeName === 'text');
        const showImageProcessMode = (sourceType === 'raster' || sourceType === 'svg') && processNodeName === 'image';

        return (
            <React.Fragment>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept={accept}
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                {/* Editor: Transformation Section */}
                {isEditor && (
                    <TransformationSection
                        headType={headType}
                        updateSelectedModelUniformScalingState={updateSelectedModelUniformScalingState}
                    />
                )}
                {isEditor && showImageProcessMode && (selectedModelArray.length === 1) && (
                    <ImageProcessMode
                        disabled={!selectedModelVisible}
                        sourceType={sourceType}
                        processMode={processMode}
                        showOrigin={showOrigin}
                        changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                        changeSelectedModelMode={changeSelectedModelMode}
                    />
                )}

                {isEditor && isTextVector && (selectedModelArray.length === 1) && (
                    <TextParameters
                        disabled={!selectedModelVisible}
                        headType={headType}
                        // config={config}
                        modifyText={modifyText}
                    />
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { page, modelGroup, printOrder } = state.laser;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    const selectedModel = ((selectedModelArray && selectedModelArray.length > 0) ? selectedModelArray[0] : {
        // modelGroup.mockModel
        mock: true,
        sourceType: '',
        processMode: '',
        config: {},
        visible: true
    });
    const {
        processMode,
        sourceType,
        showOrigin,
        processNodeName,
        config,
        visible
    } = selectedModel;
    return {
        page,
        printOrder,
        selectedModelArray,
        selectedModel,
        // todo, next version fix like selectedModelID
        selectedModelVisible: visible,
        modelGroup,
        sourceType,
        processMode,
        processNodeName,
        showOrigin,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, processMode, onFailure) => dispatch(editorActions.uploadImage('laser', file, processMode, onFailure)),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('laser')),
        updateSelectedModelUniformScalingState: (params) => dispatch(editorActions.updateSelectedModelTransformation('laser', params)),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('laser')),
        changeSelectedModelMode: (sourceType, processMode) => dispatch(editorActions.changeSelectedModelMode('laser', sourceType, processMode)),
        onModelAfterTransform: () => {},
        modifyText: (element, options) => dispatch(editorActions.modifyText('laser', element, options)),
        switchToPage: (page) => dispatch(editorActions.switchToPage('laser', page))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
