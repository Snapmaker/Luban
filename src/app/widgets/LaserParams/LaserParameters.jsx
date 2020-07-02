import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Modal from '../../components/Modal';
import SvgTrace from '../CncLaserShared/SvgTrace';
import TextParameters from '../CncLaserShared/TextParameters';
// import ConfigSvgTrace from './ConfigSvgTrace';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import api from '../../api';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';

import ImageProcessMode from './ImageProcessMode';
import GcodeConfigSvgVector from './gcodeconfig/GcodeConfigSvgVector';
import GcodeConfigRasterBW from './gcodeconfig/GcodeConfigRasterBW';
import GcodeConfigGreyscale from './gcodeconfig/GcodeConfigGreyscale';
import GcodeConfigRasterVector from './gcodeconfig/GcodeConfigRasterVector';
import { actions as editorActions } from '../../flux/editor';


const getAccept = (mode) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(mode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector', 'trace'].includes(mode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
    }
    return accept;
};

class LaserParameters extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        selectedModelHideFlag: PropTypes.bool,
        modelGroup: PropTypes.object,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        uploadImage: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelFlip: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        togglePage: PropTypes.func.isRequired,
        setAutoPreview: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired
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
        onClickToUpload: (mode) => {
            this.setState({
                uploadMode: mode,
                accept: getAccept(mode)
            }, () => {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            });
        },

        processTrace: () => {
            this.setState({
                status: 'BUSY' // no use here
            });
            api.processTrace(this.state.options)
                .then((res) => {
                    this.setState({
                        traceFilenames: res.body.filenames,
                        status: 'IDLE',
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
                        this.actions.updateOptions({
                            originalName: res.body.originalName,
                            uploadName: res.body.uploadName,
                            width: res.body.width,
                            height: res.body.height
                        });
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

    render() {
        const { accept } = this.state;
        const {
            selectedModelID, selectedModelHideFlag, modelGroup, sourceType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig,
            changeSelectedModelMode, showOrigin, changeSelectedModelShowOrigin,
            onModelAfterTransform, updateSelectedModelFlip
        } = this.props;
        const actions = this.actions;
        const { width, height } = this.state.modalSetting;

        const isEditor = this.props.page === PAGE_EDITOR;
        const isProcess = this.props.page === PAGE_PROCESS;
        const isBW = (sourceType === 'raster' && mode === 'bw');
        const isGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isRasterVector = (sourceType === 'raster' && mode === 'vector');
        const isSvgVector = ((sourceType === 'svg' || sourceType === 'dxf') && mode === 'vector');
        const isTextVector = (sourceType === 'text' && mode === 'vector');
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
                        selectedModelID={selectedModelID}
                        selectedModelHideFlag={selectedModelHideFlag}
                        modelGroup={modelGroup}
                        sourceType={sourceType}
                        transformation={transformation}
                        onModelAfterTransform={onModelAfterTransform}
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelFlip={updateSelectedModelFlip}
                    />
                )}
                {selectedModelID && (
                    <div>
                        {isProcessMode && (
                            <ImageProcessMode
                                disabled={selectedModelHideFlag}
                                sourceType={sourceType}
                                mode={mode}
                                showOrigin={showOrigin}
                                changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                                changeSelectedModelMode={changeSelectedModelMode}
                            />
                        )}
                        <div>
                            {isEditor && isTextVector && (
                                <TextParameters
                                    disabled={selectedModelHideFlag}
                                    config={config}
                                    updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                                />
                            )}
                            {isProcess && isBW && (
                                <GcodeConfigRasterBW disabled={selectedModelHideFlag} />
                            )}
                            {isProcess && isGreyscale && (
                                <GcodeConfigGreyscale disabled={selectedModelHideFlag} />
                            )}
                            {isProcess && isRasterVector && (
                                <GcodeConfigRasterVector disabled={selectedModelHideFlag} />
                            )}
                            {isProcess && isSvgVector && (
                                <GcodeConfigSvgVector disabled={selectedModelHideFlag} />
                            )}
                            {isProcess && isTextVector && (
                                <GcodeConfigSvgVector disabled={selectedModelHideFlag} />
                            )}
                        </div>
                    </div>

                )}
                {isProcess && (
                    <GcodeParameters
                        selectedModelHideFlag={selectedModelHideFlag}
                        selectedModelID={selectedModelID}
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
    const { page, selectedModelID, modelGroup, sourceType, mode, showOrigin, transformation, gcodeConfig, printOrder, config } = state.laser;

    return {
        page,
        printOrder,
        transformation,
        gcodeConfig,
        selectedModelID,
        // todo, next version fix like selectedModelID
        selectedModelHideFlag: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().hideFlag,
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
        updateSelectedModelTransformation: (params) => dispatch(editorActions.updateSelectedModelTransformation('laser', params)),
        updateSelectedModelFlip: (params) => dispatch(editorActions.updateSelectedModelFlip('laser', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(editorActions.updateSelectedModelGcodeConfig('laser', params)),
        updateSelectedModelTextConfig: (config) => dispatch(editorActions.updateSelectedModelTextConfig('laser', config)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(editorActions.updateSelectedModelPrintOrder('laser', printOrder)),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('laser')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('laser', sourceType, mode)),
        onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('laser')),
        setAutoPreview: (value) => dispatch(editorActions.setAutoPreview('laser', value))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
