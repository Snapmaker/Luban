import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';
import i18n from '../../lib/i18n';
import SvgTrace from '../CncLaserShared/SvgTrace';
import TextParameters from '../CncLaserShared/TextParameters';
// import Appearance from '../CncLaserShared/Appearance';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import VectorParameters from './VectorParameters';
import Modal from '../../components/Modal';
import modal from '../../lib/modal';
import api from '../../api';
import ImageProcessMode from './ImageProcessMode';
import ReliefGcodeParameters from './gcodeconfig/ReliefGcodeParameters';
import { actions as editorActions } from '../../flux/editor';

const getAccept = (uploadMode) => {
    let accept = '';
    if (['greyscale'].includes(uploadMode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(uploadMode)) {
        accept = '.svg, .dxf';
    } else if (['trace'].includes(uploadMode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

class CNCPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        selectedModelArray: PropTypes.array,
        selectedModelVisible: PropTypes.bool,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        // transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        uploadImage: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelFlip: PropTypes.func.isRequired,
        updateSelectedModelUniformScalingState: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,

        togglePage: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,
        selectedModel: PropTypes.object

    };

    fileInput = React.createRef();

    state = {
        uploadMode: '', // raster, vector
        from: 'cnc',
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
        status: 'Idle',
        showModal: false
    };

    actions = {
        onClickToUpload: (uploadMode) => {
            this.setState({
                uploadMode: uploadMode,
                accept: getAccept(uploadMode)
            }, () => {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            });
        },
        processTrace: () => {
            this.setState({
                status: 'Busy'
            });
            api.processTrace(this.state.options)
                .then((res) => {
                    this.setState({
                        traceFilenames: res.body.filenames,
                        status: 'Idle',
                        showModal: true
                    });
                });
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];

            const uploadMode = this.state.uploadMode;
            this.props.togglePage(PAGE_EDITOR);
            if (uploadMode === 'trace') {
                this.setState({
                    mode: uploadMode
                });
                const formData = new FormData();
                formData.append('image', file);
                api.uploadImage(formData)
                    .then(async (res) => {
                        const newOptions = {
                            originalName: res.body.originalName,
                            uploadName: res.body.uploadName,
                            width: res.body.width,
                            height: res.body.height
                        };
                        this.actions.updateOptions(newOptions);
                        await this.actions.processTrace();
                    });
            } else {
                if (uploadMode === 'greyscale') {
                    this.props.setAutoPreview(false);
                }
                this.props.uploadImage(file, uploadMode, () => {
                    modal({
                        title: i18n._('Parse Error'),
                        body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                    });
                });
            }
        },
        onClickInsertText: () => {
            this.props.togglePage(PAGE_EDITOR);
            this.props.insertDefaultTextVector();
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
                modalSetting: setting
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

    render() {
        const actions = this.actions;
        const { accept } = this.state;
        const {
            page, selectedModelArray,
            selectedModelID, selectedModelVisible, sourceType, mode,
            showOrigin,
            updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig,
            changeSelectedModelShowOrigin, changeSelectedModelMode, updateSelectedModelFlip,
            updateSelectedModelUniformScalingState,

            selectedModel
        } = this.props;
        const selectedNotHide = selectedModelID && selectedModelVisible;

        const { width, height } = this.state.modalSetting;

        const isRasterGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isSvgVector = ((sourceType === 'svg' || sourceType === 'dxf') && mode === 'vector');
        const isTextVector = (sourceType === 'raster' && mode === 'vector' && config.svgNodeName === 'text');
        const isEditor = page === PAGE_EDITOR;
        const isProcess = page === PAGE_PROCESS;
        const isProcessMode = isEditor && sourceType === 'raster';
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
                    <Modal style={{ width: `${width}px`, height: `${height}px` }} size="lg" onClose={this.actions.hideModal}>
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
                        headType="cnc"
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelFlip={updateSelectedModelFlip}
                        updateSelectedModelUniformScalingState={updateSelectedModelUniformScalingState}

                    />
                )}
                {selectedModelID && (
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
                                updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                            />
                        )}
                        {/* {isEditor && isSvgElement && (
                            <Appearance
                                disabled={selectedModelVisible}
                                config={config}
                                selectedModel={selectedModel}
                                updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                            />
                        )} */}
                        {isProcess && (isSvgVector || isTextVector) && (
                            <VectorParameters
                                disabled={!selectedModelVisible}
                            />
                        )}
                        {isProcess && isRasterGreyscale && (
                            <ReliefGcodeParameters
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
    const { page, modelGroup, toolPathModelGroup, printOrder } = state.cnc;
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
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        togglePage: (page) => dispatch(editorActions.togglePage('cnc', page)),
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
        updateSelectedModelTransformation: (params, changeFrom) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params, changeFrom)),
        updateSelectedModelFlip: (params) => dispatch(editorActions.updateSelectedModelFlip('cnc', params)),
        updateSelectedModelUniformScalingState: (params) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(editorActions.updateSelectedModelGcodeConfig('cnc', params)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(editorActions.updateSelectedModelPrintOrder('cnc', printOrder)),
        setAutoPreview: (value) => dispatch(editorActions.setAutoPreview('cnc', value)),
        insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('cnc')),
        updateSelectedModelTextConfig: (config) => dispatch(editorActions.updateSelectedModelTextConfig('cnc', config)),
        onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('cnc')),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('cnc')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('cnc', sourceType, mode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CNCPath);
