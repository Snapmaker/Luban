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

const FILL_ENABLED_DEFAULT = false;
const FILL_DENSITY_DEFAULT = 10;

const TEXT_VECTOR_CONFIG_DEFAULT = {
    optimizePath: false,
    fillEnabled: FILL_ENABLED_DEFAULT,
    fillDensity: FILL_DENSITY_DEFAULT,
    text: 'Snapmaker',
    size: 24,
    font: 'Georgia',
    lineHeight: 1.5,
    alignment: 'left' // left, middle, right
};

const GCODE_CONFIG_DEFAULT_GREY_SCALE = {
    jogSpeed: 1500,
    dwellTime: 42,

    fixedPowerEnabled: false,
    fixedPower: 100,

    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
};

const GCODE_CONFIG_DEFAULT_OTHERS = {
    jogSpeed: 1500,
    workSpeed: 220,

    fixedPowerEnabled: false,
    fixedPower: 100,

    multiPassEnabled: false,
    multiPasses: 2,
    multiPassDepth: 1
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
            console.log(modelType + ' -> ' + processMode);
            this.setState({
                model: model,
                modelType: modelType,
                processMode: processMode
            });
        });
    }

    getAccept(processMode) {
        let accept = '';
        if (['bw', 'greyscale'].includes(processMode)) {
            accept = '.png, .jpg, .jpeg, .bmp';
        } else if (['vector'].includes(processMode)) {
            accept = '.svg, .png, .jpg, .jpeg, .bmp';
        }
        return accept;
    }

    actions = {
        onClickToUpload: (processMode) => {
            this.setState({
                processMode: processMode,
                accept: this.getAccept(processMode)
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
                    // origin: { width, height, filename }
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

                    const processMode = this.state.processMode;

                    const modelInfo = this.generateModelInfo(modelType, processMode, origin);
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
            const options = TEXT_VECTOR_CONFIG_DEFAULT;
            api.convertTextToSvg(options)
                .then((res) => {
                    // origin: { width, height, filename }
                    const { width, height, filename } = res.body;
                    const origin = {
                        width: width,
                        height: height,
                        filename: filename
                    };

                    const modelType = 'text';
                    const processMode = 'vector';

                    const modelInfo = this.generateModelInfo(modelType, processMode, origin);
                    const model2D = new Model2D(modelInfo);
                    this.modelGroup.addModel(model2D);
                });
        },
        preview: () => {
            this.modelGroup.previewSelectedModel();
        },
        deleteSelected: () => {
            this.modelGroup.removeSelectedModel();
        }
    };

    generateModelInfo (modelType, processMode, origin) {
        if (!['raster', 'svg', 'text'].includes(modelType)) {
            return null;
        }
        if (!['bw', 'greyscale', 'vector'].includes(processMode)) {
            return null;
        }

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

        // config
        let config = null;
        if (modelType === 'raster' && processMode === 'bw') {
            config = {
                bwThreshold: 168,
                density: 10,
                direction: 'Horizontal'
            };
        } else if (modelType === 'raster' && processMode === 'greyscale') {
            config = {
                contrast: 50,
                brightness: 50,
                whiteClip: 255,
                algorithm: 'FloyedSteinburg',
                density: 10
            };
        } else if (modelType === 'raster' && processMode === 'vector') {
            config = {
                optimizePath: true,
                fillEnabled: FILL_ENABLED_DEFAULT,
                fillDensity: FILL_DENSITY_DEFAULT,
                vectorThreshold: 128,
                isInvert: false,
                turdSize: 2
            };
        } else if (modelType === 'svg' && processMode === 'vector') {
            config = {
                optimizePath: false,
                fillEnabled: FILL_ENABLED_DEFAULT,
                fillDensity: FILL_DENSITY_DEFAULT
            };
        } else if (modelType === 'text' && processMode === 'vector') {
            config = { ...TEXT_VECTOR_CONFIG_DEFAULT };
        }

        // gcodeConfig
        // deep copy
        let gcodeConfig = null;
        if (processMode === 'greyscale') {
            gcodeConfig = { ...GCODE_CONFIG_DEFAULT_GREY_SCALE };
        } else {
            gcodeConfig = { ...GCODE_CONFIG_DEFAULT_OTHERS };
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
    }

    render() {
        const { model, modelType, processMode, accept } = this.state;
        const actions = this.actions;

        const isRasterBW = (modelType === 'raster' && processMode === 'bw');
        const isRasterGreyscale = (modelType === 'raster' && processMode === 'greyscale');
        const isRasterVector = (modelType === 'raster' && processMode === 'vector');
        const isSvgVector = (modelType === 'svg' && processMode === 'vector');
        const isTextVector = (modelType === 'text' && processMode === 'vector');

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
                            onClick={() => actions.onClickInsertText('text')}
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


                <div style={{ display: isRasterBW ? 'block' : 'none', marginTop: '15px' }}>
                    <ConfigRasterBW />
                </div>
                <div style={{ display: isRasterGreyscale ? 'block' : 'none', marginTop: '15px' }}>
                    <ConfigRasterGreyscale />
                </div>
                <div style={{ display: isRasterVector ? 'block' : 'none', marginTop: '15px' }}>
                    <ConfigRasterVector />
                </div>
                <div style={{ display: isSvgVector ? 'block' : 'none', marginTop: '15px' }}>
                    <ConfigSvgVector />
                </div>
                <div style={{ display: isTextVector ? 'block' : 'none', marginTop: '15px' }}>
                    <ConfigTextVector />
                </div>
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
