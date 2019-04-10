import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';

import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as sharedActions } from '../../reducers/cncLaserShared';

import ConfigRasterBW from './ConfigRasterBW';
import ConfigGreyscale from './ConfigGreyscale';
import ConfigRasterVector from './ConfigRasterVector';
import ConfigSvgVector from './ConfigSvgVector';
import ConfigTextVector from '../CncLaserShared/ConfigTextVector';
import Transformation from '../CncLaserShared/Transformation';
import GcodeConfig from '../CncLaserShared/GcodeConfig';
import PrintOrder from '../CncLaserShared/PrintOrder';
import styles from './styles.styl';

const getAccept = (mode) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(mode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(mode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
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
        insertDefaultTextVector: PropTypes.func.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
    };

    fileInput = React.createRef();

    state = {
        mode: '', // bw, greyscale, vector
        accept: ''
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
        onChangeFile: (event) => {
            const file = event.target.files[0];

            const uploadMode = this.state.uploadMode;
            this.props.uploadImage(file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                });
            });
        },
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
        }
    };

    render() {
        const { accept } = this.state;
        const { model, modelType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig } = this.props;
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
                            {isTextVector &&
                            <ConfigTextVector
                                config={config}
                                updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                            />
                            }
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
        updateSelectedModelPrintOrder: (printOrder) => dispatch(sharedActions.updateSelectedModelPrintOrder('laser', printOrder)),
        updateSelectedModelTextConfig: (config) => dispatch(sharedActions.updateSelectedModelTextConfig('laser', config))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
