import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import SvgTrace from '../CncLaserShared/SvgTrace';
import TextParameters from '../CncLaserShared/TextParameters';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';

import ImageProcessMode from './ImageProcessMode';
import GcodeConfigVector from './gcodeconfig/GcodeConfigVector';
import GcodeConfigRasterBW from './gcodeconfig/GcodeConfigRasterBW';
import GcodeConfigGreyscale from './gcodeconfig/GcodeConfigGreyscale';
// import GcodeConfigRasterVector from './gcodeconfig/GcodeConfigRasterVector';
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
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        headType: PropTypes.string,

        setDisplay: PropTypes.func.isRequired,

        uploadImage: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        togglePage: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,

        // operator functions
        modifyText: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        uploadMode: '',
        from: 'laser',
        mode: '', // bw, greyscale, vector
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
        },
        modalSetting: {
            width: 640,
            height: 640
        },
        traceFilenames: [],
        status: 'IDLE',
        showModal: false
    };

    actions = {
        onChangeFile: (event) => {
            const file = event.target.files[0];

            const uploadMode = this.state.uploadMode;
            this.props.togglePage(PAGE_EDITOR);

            if (uploadMode === 'greyscale') {
                this.props.setAutoPreview(false);
            }

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
        },
        updateModalSetting: (setting) => {
            this.setState({
                modalSetting: {
                    ...this.state.modalSetting,
                    ...setting
                }
            });
        },
        hideModal: () => {
            this.setState({
                showModal: false
            });
        }
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
        const { accept } = this.state;
        const {
            selectedModelArray, selectedModelVisible, modelGroup, sourceType, mode,
            updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config,
            changeSelectedModelMode, showOrigin, changeSelectedModelShowOrigin,
            onModelAfterTransform, headType, updateSelectedModelUniformScalingState, transformation,
            modifyText
        } = this.props;

        const actions = this.actions;
        const { width, height } = this.state.modalSetting;

        const isEditor = this.props.page === PAGE_EDITOR;
        const isProcess = this.props.page === PAGE_PROCESS;
        const isBW = (mode === 'bw' || mode === 'halftone');
        const isGreyscale = (mode === 'greyscale');
        const isVector = mode === 'vector';
        const isTextVector = (config.svgNodeName === 'text');
        const showImageProcessMode = (sourceType === 'raster' || sourceType === 'svg') && config.svgNodeName === 'image';

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
                {this.state.mode === 'trace' && this.state.showModal && (
                    <Modal
                        style={{ width: `${width}px`, height: `${height}px` }}
                        size="lg"
                        onClose={this.actions.hideModal}
                    >
                        <Modal.Body style={{ margin: '0', padding: '0', height: '100%' }}>
                            <SvgTrace
                                state={this.state}
                                from={this.state.from}
                                traceFilenames={this.state.traceFilenames}
                                status={this.state.status}
                                actions={this.actions}
                            />
                        </Modal.Body>
                    </Modal>
                )}
                {isEditor && (
                    <Transformation
                        selectedModelArray={selectedModelArray}
                        selectedModelVisible={selectedModelVisible}
                        modelGroup={modelGroup}
                        sourceType={sourceType}
                        transformation={transformation}
                        headType={headType}
                        onModelAfterTransform={onModelAfterTransform}
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelUniformScalingState={updateSelectedModelUniformScalingState}
                    />
                )}
                {isEditor && showImageProcessMode && (selectedModelArray.length === 1) && (
                    <ImageProcessMode
                        disabled={!selectedModelVisible}
                        sourceType={sourceType}
                        mode={mode}
                        showOrigin={showOrigin}
                        changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                        changeSelectedModelMode={changeSelectedModelMode}
                    />
                )}

                {isEditor && isTextVector && (selectedModelArray.length === 1) && (
                    <TextParameters
                        disabled={!selectedModelVisible}
                        headType={headType}
                        config={config}
                        modifyText={modifyText}
                    />
                )}
                {isProcess && isBW && (selectedModelArray && selectedModelArray.length === 1) && (
                    <GcodeConfigRasterBW disabled={!selectedModelVisible} />
                )}
                {isProcess && isGreyscale && (selectedModelArray && selectedModelArray.length === 1) && (
                    <GcodeConfigGreyscale disabled={!selectedModelVisible} />
                )}
                {isProcess && (isVector || isTextVector) && (selectedModelArray && selectedModelArray.length === 1) && (
                    <GcodeConfigVector disabled={!selectedModelVisible} />
                )}

                {isProcess && (
                    <GcodeParameters
                        selectedModelVisible={selectedModelVisible}
                        selectedModelArray={selectedModelArray}
                        printOrder={printOrder}
                        gcodeConfig={gcodeConfig}
                        updateSelectedModelPrintOrder={updateSelectedModelPrintOrder}
                        updateSelectedModelGcodeConfig={updateSelectedModelGcodeConfig}
                        paramsDescs={
                            {
                                jogSpeed: i18n._('Determines how fast the machine moves when it’s not engraving.'),
                                workSpeed: i18n._('Determines how fast the machine moves when it’s engraving.'),
                                dwellTime: i18n._('Determines how long the laser keeps on when it’s engraving a dot.')
                            }
                        }
                    />
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { page, modelGroup, toolPathModelGroup, printOrder } = state.laser;
    const gcodeConfig = toolPathModelGroup.getSelectedModel().gcodeConfig;
    const selectedModelArray = modelGroup.getSelectedModelArray();
    const selectedModel = ((selectedModelArray && selectedModelArray.length > 0) ? selectedModelArray[0] : {
        // modelGroup.mockModel
        mock: true,
        sourceType: '',
        mode: '',
        config: {},
        visible: true,
        transformation: {
            rotationZ: 0,
            width: 0,
            height: 0,
            positionX: 0,
            positionY: 0,
            flip: 0
        }
    });
    const {
        mode,
        sourceType,
        showOrigin,
        transformation,
        config,
        visible
    } = selectedModel;
    return {
        page,
        printOrder,
        transformation,
        gcodeConfig,
        selectedModelArray,
        selectedModel,
        // todo, next version fix like selectedModelID
        selectedModelVisible: visible,
        modelGroup,
        sourceType,
        mode,
        showOrigin,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        togglePage: (page) => dispatch(editorActions.togglePage('laser', page)),
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('laser', file, mode, onFailure)),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('laser')),
        updateSelectedModelTransformation: (params, changeFrom) => dispatch(editorActions.updateSelectedModelTransformation('laser', params, changeFrom)),
        updateSelectedModelUniformScalingState: (params) => dispatch(editorActions.updateSelectedModelTransformation('laser', params)),
        updateSelectedModelFlip: (params) => dispatch(editorActions.updateSelectedModelFlip('laser', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(editorActions.updateSelectedModelGcodeConfig('laser', params)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(editorActions.updateSelectedModelPrintOrder('laser', printOrder)),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('laser')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('laser', sourceType, mode)),
        onModelAfterTransform: () => {},
        setAutoPreview: (value) => dispatch(editorActions.setAutoPreview('laser', value)),

        modifyText: (element, options) => dispatch(editorActions.modifyText('laser', element, options))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
