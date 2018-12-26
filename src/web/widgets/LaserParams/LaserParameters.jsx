import path from 'path';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { toFixed } from '../../lib/numeric-utils';
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
import {
    BOUND_SIZE
} from '../../constants';
import api from '../../api';
import Model2D from '../../reducers/Model2D';

const DEFAULT_FILL_ENABLED = false;
const DEFAULT_FILL_DENSITY = 10;

const CONFIG_DEFAULT_TEXT_VECTOR = {
    optimizePath: false,
    fillEnabled: DEFAULT_FILL_ENABLED,
    fillDensity: DEFAULT_FILL_DENSITY,
    text: 'Snapmaker',
    size: 24,
    font: 'Georgia',
    lineHeight: 1.5,
    alignment: 'left' // left, middle, right
};

const DEFAULT_GCODE_CONFIG_RASTER_GREYSCALE = {
    jogSpeed: 1500,
    dwellTime: 42,
    fixedPowerEnabled: false,
    fixedPower: 100,
    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

const DEFAULT_GCODE_CONFIG = {
    jogSpeed: 1500,
    workSpeed: 220,
    fixedPowerEnabled: false,
    fixedPower: 100,
    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

const generateModelInfo = (modelType, processMode, origin) => {
    if (!['raster', 'svg', 'text'].includes(modelType)) {
        return null;
    }
    if (!['bw', 'greyscale', 'vector'].includes(processMode)) {
        return null;
    }

    const combinedMode = `${modelType}-${processMode}`;

    // transformation
    let { width, height } = origin;
    const ratio = width / height;
    if (width >= height && width > BOUND_SIZE) {
        width = BOUND_SIZE;
        height = toFixed(BOUND_SIZE / ratio, 2);
    }
    if (height >= width && height > BOUND_SIZE) {
        width = toFixed(BOUND_SIZE * ratio, 2);
        height = BOUND_SIZE;
    }
    const transformation = {
        rotation: 0,
        width: width,
        height: height,
        translateX: 0,
        translateY: 0
    };
    // for text-vector, extra prop: canResize = false
    if (combinedMode === 'text-vector') {
        transformation.canResize = false;
    }

    // config
    let config = null;
    switch (combinedMode) {
        case 'raster-bw':
            config = {
                bwThreshold: 168,
                density: 10,
                direction: 'Horizontal'
            };
            break;
        case 'raster-greyscale':
            config = {
                contrast: 50,
                brightness: 50,
                whiteClip: 255,
                algorithm: 'FloyedSteinburg',
                density: 10
            };
            break;
        case 'raster-vector':
            config = {
                optimizePath: true,
                fillEnabled: DEFAULT_FILL_ENABLED,
                fillDensity: DEFAULT_FILL_DENSITY,
                vectorThreshold: 128,
                isInvert: false,
                turdSize: 2
            };
            break;
        case 'svg-vector':
            config = {
                optimizePath: false,
                fillEnabled: DEFAULT_FILL_ENABLED,
                fillDensity: DEFAULT_FILL_DENSITY
            };
            break;
        case 'text-vector':
            config = { ...CONFIG_DEFAULT_TEXT_VECTOR };
            break;
        default:
            break;
    }

    // gcodeConfig
    let gcodeConfig = { ...DEFAULT_GCODE_CONFIG };
    if (processMode === 'greyscale') {
        gcodeConfig = { ...DEFAULT_GCODE_CONFIG_RASTER_GREYSCALE };
    }

    const modelInfo = {
        type: 'laser',
        modelType: modelType,
        processMode: processMode,
        layer: 0,
        origin: origin,
        transformation: transformation,
        config: config,
        gcodeConfig: gcodeConfig
    };

    return modelInfo;
};

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
        modelGroup: PropTypes.object.isRequired
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

            api.uploadImage(formData)
                .then((res) => {
                    const { width, height, filename } = res.body;
                    const origin = {
                        width: width,
                        height: height,
                        filename: filename
                    };

                    let modelType = 'raster';
                    if (path.extname(file.name).toLowerCase() === '.svg') {
                        modelType = 'svg';
                    }

                    const modelInfo = generateModelInfo(modelType, this.state.processMode, origin);
                    const model2D = new Model2D(modelInfo);
                    this.modelGroup.addModel(model2D);
                })
                .catch(() => {
                    modal({
                        title: i18n._('Parse Image Error'),
                        body: i18n._('Failed to parse image file {{}}', { filename: file.name })
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

export default connect(mapStateToProps)(LaserParameters);
