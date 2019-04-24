import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { EXPERIMENTAL_IMAGE_TRACING } from '../../constants';
import i18n from '../../lib/i18n';
import { actions as sharedActions } from '../../reducers/cncLaserShared';
import SvgTrace from '../CncLaserShared/SvgTrace';
import styles from './styles.styl';
import Transformation from '../CncLaserShared/Transformation';
import GcodeConfig from '../CncLaserShared/GcodeConfig';
import PrintOrder from '../CncLaserShared/PrintOrder';
import ConfigRasterGreyscale from './ConfigRasterGreyscale';
import ConfigTextVector from '../CncLaserShared/ConfigTextVector';
import ConfigSvgVector from './ConfigSvgVector';
import Anchor from '../../components/Anchor';
import Modal from '../../components/Modal';
import modal from '../../lib/modal';
import api from '../../api';

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

class PathParameters extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        modelType: PropTypes.string,
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
    };

    fileInput = React.createRef();

    state = {
        uploadMode: '', // raster, vector
        from: 'cnc',
        mode: '', // bw, greyscale, vector
        accept: '',
        options: {
            name: '',
            filename: '',
            width: 0,
            height: 0,
            turdSize: 20,
            threshold: 160,
            thV: 33
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
                            name: res.body.name,
                            filename: res.body.filename,
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

    render() {
        const actions = this.actions;
        const { accept } = this.state;
        const {
            model, modelType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig
        } = this.props;
        const { width, height } = this.state.modalSetting;

        const isRasterGreyscale = (modelType === 'raster' && mode === 'greyscale');
        const isSvgVector = (modelType === 'svg' && mode === 'vector');
        const isTextVector = (modelType === 'text' && mode === 'vector');

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
                    {EXPERIMENTAL_IMAGE_TRACING && (
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
                {model && (
                    <div>
                        <div className={styles.separator} />
                        <div style={{ marginTop: '15px' }}>
                            <PrintOrder
                                printOrder={printOrder}
                                updateSelectedModelPrintOrder={updateSelectedModelPrintOrder}
                            />
                        </div>
                        <div style={{ marginTop: '15px' }}>
                            <Transformation
                                transformation={transformation}
                                updateSelectedModelTransformation={updateSelectedModelTransformation}
                            />
                        </div>

                        <div style={{ marginTop: '15px' }}>
                            {isRasterGreyscale && <ConfigRasterGreyscale />}
                            {(isSvgVector || isTextVector) && <ConfigSvgVector />}
                            {isTextVector && (
                                <ConfigTextVector
                                    withFill={false}
                                    config={config}
                                    updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                                />
                            )}
                        </div>
                        <div style={{ marginTop: '15px' }}>
                            <GcodeConfig
                                gcodeConfig={gcodeConfig}
                                updateSelectedModelGcodeConfig={updateSelectedModelGcodeConfig}
                                paramsDescs={
                                    {
                                        jogSpeed: i18n._('Determines how fast the tool moves when it’s not carving.'),
                                        workSpeed: i18n._('Determines how fast the tool feeds into the material.'),
                                        plungeSpeed: i18n._('Determines how fast the tool moves on the material.')
                                    }
                                }
                            />
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { model, transformation, gcodeConfig, printOrder, config } = state.cnc;
    const modelType = model ? model.modelInfo.source.type : '';
    const mode = model ? model.modelInfo.mode : '';
    return {
        printOrder,
        transformation,
        gcodeConfig,
        model,
        modelType,
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
        updateSelectedModelTextConfig: (config) => dispatch(sharedActions.updateSelectedModelTextConfig('cnc', config))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PathParameters);
