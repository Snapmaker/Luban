import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as sharedActions } from '../../reducers/cncLaserShared';
import Modal from '../../components/Modal';
import SvgTrace from './SvgTrace';
import ConfigRasterBW from './ConfigRasterBW';
import ConfigGreyscale from './ConfigGreyscale';
import ConfigRasterVector from './ConfigRasterVector';
import ConfigSvgVector from './ConfigSvgVector';
import ConfigTextVector from '../CncLaserShared/ConfigTextVector';
// import ConfigSvgTrace from './ConfigSvgTrace';
import Transformation from '../CncLaserShared/Transformation';
import GcodeConfig from '../CncLaserShared/GcodeConfig';
import PrintOrder from '../CncLaserShared/PrintOrder';
import api from '../../api';
import styles from './styles.styl';

const getAccept = (mode) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(mode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(mode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    } else if (['trace'].includes(mode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

class LaserParameters extends PureComponent {
    static propTypes = {
        model: PropTypes.object,
        modelType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        config: PropTypes.object.isRequired,
        transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        uploadImage: PropTypes.func.isRequired,
        setBackgroundImage: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
    };

    fileInput = React.createRef();

    state = {
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
        traceFilenames: [],
        status: 'Idle',
        showModal: false
    };

    actions = {
        onClickToUpload: (mode) => {
            this.setState({
                uploadMode: mode,
                accept: getAccept(mode),
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
        hideModal: () => {
            this.setState({
                showModal: false
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
        }
    };

    render() {
        const { accept } = this.state;
        const {
            model, modelType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig
        } = this.props;
        const actions = this.actions;

        const isBW = (modelType === 'raster' && mode === 'bw');
        const isGreyscale = (modelType === 'raster' && mode === 'greyscale');
        const isRasterVector = (modelType === 'raster' && mode === 'vector');
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
                    <Modal style={{ width: '640px', height: '640px' }} size="lg" onClose={this.actions.hideModal}>
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
                            {isBW && <ConfigRasterBW />}
                            {isGreyscale && <ConfigGreyscale />}
                            {isRasterVector && <ConfigRasterVector />}
                            {isSvgVector && <ConfigSvgVector />}
                            {isTextVector && (
                                <ConfigTextVector
                                    withFill={true}
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
                                        jogSpeed: i18n._('Determines how fast the machine moves when it’s not engraving.'),
                                        workSpeed: i18n._('Determines how fast the machine moves when it’s engraving.'),
                                        dwellTime: i18n._('Determines how long the laser keeps on when it’s engraving a dot.')
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
    const { model, transformation, gcodeConfig, printOrder, config } = state.laser;
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
        uploadImage: (file, mode, onFailure) => dispatch(sharedActions.uploadImage('laser', file, mode, onFailure)),
        insertDefaultTextVector: () => dispatch(sharedActions.insertDefaultTextVector('laser')),
        updateSelectedModelTransformation: (params) => dispatch(sharedActions.updateSelectedModelTransformation('laser', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(sharedActions.updateSelectedModelGcodeConfig('laser', params)),
        updateSelectedModelTextConfig: (config) => dispatch(sharedActions.updateSelectedModelTextConfig('laser', config)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(sharedActions.updateSelectedModelPrintOrder('laser', printOrder)),
        setBackgroundImage: (filename, width, height, dx, dy) => dispatch(sharedActions.setBackgroundImage(filename, width, height, dx, dy))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
