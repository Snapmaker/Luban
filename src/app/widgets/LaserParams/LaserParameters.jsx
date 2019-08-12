import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as sharedActions } from '../../flux/cncLaserShared';
import Modal from '../../components/Modal';
import SvgTrace from '../CncLaserShared/SvgTrace';
import ConfigRasterBW from './ConfigRasterBW';
import ConfigGreyscale from './ConfigGreyscale';
import ConfigRasterVector from './ConfigRasterVector';
import ConfigSvgVector from './ConfigSvgVector';
import TextParameters from '../CncLaserShared/TextParameters';
// import ConfigSvgTrace from './ConfigSvgTrace';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import api from '../../api';
import { EXPERIMENTAL_IMAGE_TRACING } from '../../constants';

import styles from './styles.styl';


const getAccept = (mode) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(mode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector', 'trace'].includes(mode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

class LaserParameters extends PureComponent {
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
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired
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
                this.props.uploadImage(file, uploadMode, () => {
                    modal({
                        title: i18n._('Parse Image Error'),
                        body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                    });
                });
            }
        },
        onClickInsertText: () => {
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
        this.props.setTitle(i18n._('Preview Settings'));
    }

    render() {
        const { accept } = this.state;
        const {
            selectedModelID, sourceType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig,
            onModelAfterTransform
        } = this.props;
        const actions = this.actions;
        const { width, height } = this.state.modalSetting;

        const isBW = (sourceType === 'raster' && mode === 'bw');
        const isGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isRasterVector = (sourceType === 'raster' && mode === 'vector');
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
                <div className={styles['laser-modes']}>
                    <p><b>{i18n._('Select mode to upload:')}</b></p>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('bw')}
                        >
                            <i className={styles['laser-mode__icon-bw']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('B&W')}</span>
                    </div>
                    <div className={classNames(styles['laser-mode'])}>
                        <Anchor
                            className={styles['laser-mode__btn']}
                            onClick={() => actions.onClickToUpload('greyscale')}
                        >
                            <i className={styles['laser-mode__icon-greyscale']} />
                        </Anchor>
                        <span className={styles['laser-mode__text']}>{i18n._('GREYSCALE')}</span>
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
                                onClick={() => actions.onClickToUpload('trace')}
                            >
                                <i className={styles['laser-mode__icon-vector']} />
                            </Anchor>
                            <span className={styles['laser-mode__text']}>{i18n._('TRACE')}</span>
                        </div>
                    )}
                </div>
                {selectedModelID && (
                    <div>
                        <div className={styles.separator} />
                        <Transformation
                            sourceType={sourceType}
                            transformation={transformation}
                            updateSelectedModelTransformation={updateSelectedModelTransformation}
                            onModelAfterTransform={onModelAfterTransform}
                        />
                        <div style={{ marginTop: '15px' }}>
                            {isBW && <ConfigRasterBW />}
                            {isGreyscale && <ConfigGreyscale />}
                            {isRasterVector && <ConfigRasterVector />}
                            {isSvgVector && <ConfigSvgVector />}
                            {isTextVector && (
                                <TextParameters
                                    config={config}
                                    updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                                />
                            )}
                            {isTextVector && (
                                <ConfigSvgVector />
                            )}
                        </div>
                        <GcodeParameters
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
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    // const { model, transformation, gcodeConfig, printOrder, config } = state.laser;
    // const sourceType = model ? model.modelInfo.source.type : '';
    // const mode = model ? model.modelInfo.mode : '';
    const { selectedModelID, sourceType, mode, transformation, gcodeConfig, printOrder, config } = state.laser;

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
        uploadImage: (file, mode, onFailure) => dispatch(sharedActions.uploadImage('laser', file, mode, onFailure)),
        insertDefaultTextVector: () => dispatch(sharedActions.insertDefaultTextVector('laser')),
        updateSelectedModelTransformation: (params) => dispatch(sharedActions.updateSelectedModelTransformation('laser', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(sharedActions.updateSelectedModelGcodeConfig('laser', params)),
        updateSelectedModelTextConfig: (config) => dispatch(sharedActions.updateSelectedModelTextConfig('laser', config)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(sharedActions.updateSelectedModelPrintOrder('laser', printOrder)),
        onModelAfterTransform: () => dispatch(sharedActions.onModelAfterTransform('laser'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
