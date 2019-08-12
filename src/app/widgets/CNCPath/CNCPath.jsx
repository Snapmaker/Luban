import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { EXPERIMENTAL_IMAGE_TRACING_CNC } from '../../constants';
import i18n from '../../lib/i18n';
import { actions as sharedActions } from '../../flux/cncLaserShared';
import SvgTrace from '../CncLaserShared/SvgTrace';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import TextParameters from '../CncLaserShared/TextParameters';
import ReliefParameters from './ReliefParameters';
import VectorParameters from './VectorParameters';
import Anchor from '../../components/Anchor';
import Modal from '../../components/Modal';
import modal from '../../lib/modal';
import api from '../../api';
import styles from './styles.styl';

const getAccept = (uploadMode) => {
    let accept = '';
    if (['greyscale'].includes(uploadMode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(uploadMode)) {
        accept = '.svg';
    } else if (['trace'].includes(uploadMode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

class CNCPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        config: PropTypes.object.isRequired,
        transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        uploadImage: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired
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
            selectedModelID, sourceType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig,
            onModelAfterTransform
        } = this.props;
        const { width, height } = this.state.modalSetting;

        const isRasterGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isSvgVector = (sourceType === 'svg' && mode === 'vector');
        const isTextVector = (sourceType === 'text' && mode === 'vector');

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
                <div className={styles['laser-modes']}>
                    <p><b>{i18n._('Select mode to upload:')}</b></p>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('greyscale')}
                        >
                            <i className={styles['laser-mode__icon-greyscale']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('RELIEF')}</span>
                    </div>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('vector')}
                        >
                            <i className={styles['laser-mode__icon-vector']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('VECTOR')}</span>
                    </div>
                    <div className={classNames(styles['laser-mode'])} style={{ marginRight: '0' }}>
                        <Anchor
                            className={classNames(styles['laser-mode__btn'])}
                            onClick={() => actions.onClickInsertText()}
                        >
                            <i className={styles['laser-mode__icon-text']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('TEXT')}</span>
                    </div>
                    {EXPERIMENTAL_IMAGE_TRACING_CNC && (
                        <div className={classNames(styles['laser-mode'])}>
                            <Anchor
                                className={styles['laser-mode__btn']}
                                onClick={() => {
                                    actions.onClickToUpload('trace');
                                }}
                            >
                                <i className={styles['laser-mode__icon-vector']} />
                            </Anchor>
                            <span className={styles['laser-mode__text']}>{i18n._('TRACE')}</span>
                        </div>
                    )}
                </div>
                {selectedModelID && (
                    <div className="sm-parameter-container">
                        <div className={styles.separator} />
                        <div style={{ marginTop: '15px' }} />
                        <Transformation
                            transformation={transformation}
                            sourceType={sourceType}
                            updateSelectedModelTransformation={updateSelectedModelTransformation}
                            onModelAfterTransform={onModelAfterTransform}
                        />
                        {isRasterGreyscale && (
                            <ReliefParameters />
                        )}
                        {isTextVector && (
                            <TextParameters
                                config={config}
                                updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                            />
                        )}
                        {(isSvgVector || isTextVector) && (
                            <VectorParameters />
                        )}
                        <GcodeParameters
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
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    // const { model, transformation, gcodeConfig, printOrder, config } = state.cnc;
    // const sourceType = model ? model.modelInfo.source.type : '';
    // const mode = model ? model.modelInfo.mode : '';
    const { selectedModelID, sourceType, mode, transformation, gcodeConfig, printOrder, config } = state.cnc;

    return {
        printOrder,
        transformation,
        gcodeConfig,
        // model,
        selectedModelID,
        sourceType,
        mode,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(sharedActions.uploadImage('cnc', file, mode, onFailure)),
        updateSelectedModelTransformation: (params) => dispatch(sharedActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(sharedActions.updateSelectedModelGcodeConfig('cnc', params)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(sharedActions.updateSelectedModelPrintOrder('cnc', printOrder)),
        setAutoPreview: (value) => dispatch(sharedActions.setAutoPreview('cnc', value)),
        insertDefaultTextVector: () => dispatch(sharedActions.insertDefaultTextVector('cnc')),
        updateSelectedModelTextConfig: (config) => dispatch(sharedActions.updateSelectedModelTextConfig('cnc', config)),
        onModelAfterTransform: () => dispatch(sharedActions.onModelAfterTransform('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CNCPath);
