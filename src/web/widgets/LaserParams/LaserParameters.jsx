import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import ConfigRasterBW from './ConfigRasterBW';
import ConfigRasterGreyscale from './ConfigRasterGreyscale';
import ConfigRasterVector from './ConfigRasterVector';
import ConfigSvgVector from './ConfigSvgVector';
import ConfigTextVector from './ConfigTextVector';
import Transformation from './Transformation';
import GcodeConfig from './GcodeConfig';
import styles from './styles.styl';
import api from '../../api';
import Model2D from '../../reducers/Model2D';
import { generateModelInfo, CONFIG_DEFAULT_TEXT_VECTOR } from '../../reducers/ModelInfoUtils';
import { actions } from '../../reducers/modules/laser';

const getAccept = (processMode) => {
    let accept = '';
    if (['bw', 'greyscale'].includes(processMode)) {
        accept = '.png, .jpg, .jpeg, .bmp';
    } else if (['vector'].includes(processMode)) {
        accept = '.svg, .png, .jpg, .jpeg, .bmp';
    }
    return accept;
};

const computeTransformationSizeForTextVector = (modelInfo) => {
    const { config, origin } = modelInfo;
    const { text, size } = config;
    const numberOfLines = text.split('\n').length;
    const height = size / 72 * 25.4 * numberOfLines;
    const width = height / origin.height * origin.width;
    return {
        width: width,
        height: height
    };
};

class LaserParameters extends PureComponent {
    static propTypes = {
        modelGroup: PropTypes.object.isRequired,
        uploadImage: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired
    };

    fileInputEl = null;
    modelGroup = null;

    state = {
        modelType: '', // raster, svg, text
        processMode: '', // bw, greyscale, vector
        accept: '',
        model: null
    };

    componentDidMount() {
        this.modelGroup = this.props.modelGroup;
        this.modelGroup.addChangeListener((newState) => {
            const { model, modelType, processMode } = newState;
            this.setState({
                model: model,
                modelType: modelType,
                processMode: processMode
            });
        });
    }

    actions = {
        onClickToUpload: (processMode) => {
            this.setState({
                processMode: processMode,
                accept: getAccept(processMode)
            }, () => {
                this.fileInputEl.value = null;
                this.fileInputEl.click();
            });
        },
        onChangeFile: (event) => {
            const formData = new FormData();
            const file = event.target.files[0];
            formData.append('image', file);

            this.props.uploadImage(file, this.state.processMode, () => {
                modal({
                    title: i18n._('Parse Image Error'),
                    body: i18n._('Failed to parse image file {{filename}}', { filename: file.name })
                });
            });
        },
        onClickInsertText: () => {
            const options = CONFIG_DEFAULT_TEXT_VECTOR;
            api.convertTextToSvg(options)
                .then((res) => {
                    const { width, height, filename } = res.body;
                    const origin = {
                        width: width,
                        height: height,
                        filename: filename
                    };
                    const modelInfo = generateModelInfo('text', 'vector', origin);
                    const transformationSize = computeTransformationSizeForTextVector(modelInfo);
                    const model2D = new Model2D(modelInfo);
                    model2D.updateTransformation(transformationSize);
                    this.modelGroup.addModel(model2D);
                });
        },
        preview: () => {
            const isTextVector = (this.state.modelType === 'text' && this.state.processMode === 'vector');
            if (isTextVector) {
                const model = this.state.model;
                const modelInfo = model.getModelInfo();
                const { config } = modelInfo;
                api.convertTextToSvg(config)
                    .then((res) => {
                        const { width, height, filename } = res.body;
                        const origin = {
                            width: width,
                            height: height,
                            filename: filename
                        };
                        modelInfo.origin = origin;
                        const transformationSize = computeTransformationSizeForTextVector(modelInfo);
                        this.modelGroup.transformSelectedModel(transformationSize);
                        this.modelGroup.resizeSelectedModel();
                        this.modelGroup.previewSelectedModel();
                    });
            } else {
                this.modelGroup.previewSelectedModel();
            }
        },
        deleteSelected: () => {
            this.modelGroup.removeSelectedModel();
        },
        generateGcode: () => {
            this.props.generateGcode();
        }
    };

    render() {
        const { model, modelType, processMode, accept } = this.state;
        const actions = this.actions;

        const combinedMode = `${modelType}-${processMode}`;
        const isRasterBW = combinedMode === 'raster-bw';
        const isRasterGreyscale = combinedMode === 'raster-greyscale';
        const isRasterVector = combinedMode === 'raster-vector';
        const isSvgVector = combinedMode === 'svg-vector';
        const isTextVector = combinedMode === 'text-vector';

        const isAnyModelSelected = !!model;
        const canPreview = !!model;
        const canGenerateGcode = true;
        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept={accept}
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div className={classNames(styles['laser-mode'])}>
                    <span className={styles['laser-mode__text']}>{modelType + ' - ' + processMode}</span>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <button
                        type="button"
                        className={classNames(styles['btn-large'], styles['btn-default'])}
                        onClick={actions.preview}
                        disabled={!canPreview}
                        style={{ display: 'block', width: '100%' }}
                    >
                        {i18n._('Preview')}
                    </button>
                    <button
                        type="button"
                        className={classNames(styles['btn-large'], styles['btn-default'])}
                        onClick={actions.deleteSelected}
                        disabled={!isAnyModelSelected}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Del Selected')}
                    </button>
                    <button
                        type="button"
                        className={classNames(styles['btn-large'], styles['btn-default'])}
                        onClick={actions.generateGcode}
                        disabled={!canGenerateGcode}
                        style={{ display: 'block', width: '100%', marginTop: '10px' }}
                    >
                        {i18n._('Generate g-Code')}
                    </button>
                </div>
                <div className={styles['laser-modes']}>
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
                <div style={{ display: isAnyModelSelected ? 'block' : 'none', marginTop: '15px' }}>
                    <Transformation />
                </div>
                <div style={{ display: isAnyModelSelected ? 'block' : 'none', marginTop: '15px' }}>
                    <GcodeConfig />
                </div>
                {isRasterBW &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigRasterBW />
                </div>
                }
                {isRasterGreyscale &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigRasterGreyscale />
                </div>
                }
                {isRasterVector &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigRasterVector />
                </div>
                }
                {isSvgVector &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigSvgVector />
                </div>
                }
                {isTextVector &&
                <div style={{ marginTop: '15px' }}>
                    <ConfigTextVector />
                </div>
                }
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        modelGroup: state.laser.modelGroup
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, processMode, onFailure) => dispatch(actions.uploadImage(file, processMode, onFailure)),
        generateGcode: () => dispatch(actions.generateGcode()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);

