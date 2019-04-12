import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import { actions as sharedActions } from '../../reducers/cncLaserShared';
import styles from './styles.styl';
import Transformation from '../CncLaserShared/Transformation';
import GcodeConfig from '../CncLaserShared/GcodeConfig';
import PrintOrder from '../CncLaserShared/PrintOrder';
import ConfigRasterGreyscale from './ConfigRasterGreyscale';
import ConfigTextVector from '../CncLaserShared/ConfigTextVector';
import ConfigSvgVector from './ConfigSvgVector';
import Anchor from '../../components/Anchor';
import modal from '../../lib/modal';

const getAccept = (uploadType) => {
    let accept = '';
    if (['greyscale'].includes(uploadType)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(uploadType)) {
        accept = '.svg';
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
        uploadType: '', // raster, vector
        accept: ''
    };

    actions = {
        onClickToUpload: (uploadType) => {
            this.setState({
                uploadType: uploadType,
                accept: getAccept(uploadType)
            }, () => {
                this.fileInput.current.value = null;
                this.fileInput.current.click();
            });
        },
        onChangeFile: (event) => {
            const formData = new FormData();
            const file = event.target.files[0];
            formData.append('image', file);

            const mode = this.state.uploadType;
            this.props.uploadImage(file, mode, () => {
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
        const actions = this.actions;
        const { accept } = this.state;
        const {
            model, modelType, mode,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig
        } = this.props;

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
                <div className={styles['laser-modes']}>
                    <p><b>{i18n._('Select mode to upload:')}</b></p>
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
                            {isRasterGreyscale && <ConfigRasterGreyscale />}
                            {(isSvgVector || isTextVector) && <ConfigSvgVector />}
                            {isTextVector && (
                                <ConfigTextVector
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
