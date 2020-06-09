import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';
import i18n from '../../lib/i18n';
import SvgTrace from '../CncLaserShared/SvgTrace';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import TextParameters from '../CncLaserShared/TextParameters';
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
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        uploadImage: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelFlip: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired
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
                        title: i18n._('Parse Image Error'),
                        body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                    });
                });
            }
        },
        updateOptions: (options) => {
            this.setState({
                options: {
                    ...this.state.options,
                    ...options
                }
            });
        },
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
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
            page,
            selectedModelID, sourceType, mode,
            showOrigin,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig,
            onModelAfterTransform, changeSelectedModelShowOrigin, changeSelectedModelMode, updateSelectedModelFlip
        } = this.props;
        const { width, height } = this.state.modalSetting;

        const isRasterGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isSvgVector = ((sourceType === 'svg' || sourceType === 'dxf') && mode === 'vector');
        const isTextVector = (sourceType === 'text' && mode === 'vector');
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
                        selectedModelID={selectedModelID}
                        transformation={transformation}
                        sourceType={sourceType}
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelFlip={updateSelectedModelFlip}
                        onModelAfterTransform={onModelAfterTransform}
                    />
                )}
                {selectedModelID && (
                    <div className="sm-parameter-container">
                        {isProcessMode && (
                            <ImageProcessMode
                                sourceType={sourceType}
                                mode={mode}
                                showOrigin={showOrigin}
                                changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                                changeSelectedModelMode={changeSelectedModelMode}
                            />
                        )}
                        {isEditor && isTextVector && (
                            <TextParameters
                                config={config}
                                updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                            />
                        )}
                        {isProcess && (isSvgVector || isTextVector) && (
                            <VectorParameters />
                        )}
                        {isProcess && isRasterGreyscale && (
                            <ReliefGcodeParameters />
                        )}
                    </div>
                )}
                {isProcess && (
                    <GcodeParameters
                        selectedModelID={selectedModelID}
                        printOrder={printOrder}
                        gcodeConfig={gcodeConfig}
                        updateSelectedModelGcodeConfig={updateSelectedModelGcodeConfig}
                        updateSelectedModelPrintOrder={updateSelectedModelPrintOrder}
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

const mapStateToProps = (state) => {
    const { page, selectedModelID, sourceType, mode, showOrigin, transformation, gcodeConfig, printOrder, config } = state.cnc;

    return {
        page,
        printOrder,
        transformation,
        gcodeConfig,
        // model,
        selectedModelID,
        sourceType,
        mode,
        showOrigin,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
        updateSelectedModelTransformation: (params) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelFlip: (params) => dispatch(editorActions.updateSelectedModelFlip('cnc', params)),
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
