import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import pubsub from 'pubsub-js';
import {
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    ACTION_CHANGE_IMAGE_LASER,
    ACTION_CHANGE_PARAMETER_LASER,
    ACTION_REQ_PREVIEW_LASER
} from '../../constants';
import api from '../../api';
import { toFixed } from '../../lib/numeric-utils';
import modal from '../../lib/modal';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/modules/laser';
import Bwline from './Bwline';
import Greyscale from './Greyscale';
import Vector from './Vector';
import TextMode from './TextMode';
import styles from './styles.styl';


class LaserParameters extends PureComponent {
    static propTypes = {
        stage: PropTypes.number.isRequired,
        changeSourceImage: PropTypes.func.isRequired,
        setTarget: PropTypes.func.isRequired,
        changeTargetSize: PropTypes.func.isRequired
    };
    fileInput = null;

    state = {
        // 'bw', 'greyscale', 'vector'
        mode: 'bw',
        subMode: 'svg', // 'svg' or 'raster', only works when mode === 'vector'

        filename: '(default image)',
        originSrc: DEFAULT_RASTER_IMAGE,
        imageSrc: DEFAULT_RASTER_IMAGE,
        originWidth: DEFAULT_SIZE_WIDTH,
        originHeight: DEFAULT_SIZE_HEIGHT,
        sizeWidth: DEFAULT_SIZE_WIDTH / 10,
        sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
        density: 10, // B&W / GrayScale

        // B&W
        bwThreshold: 128,
        direction: 'Horizontal',

        // Greyscale
        contrast: 50,
        brightness: 50,
        whiteClip: 255,
        algorithm: 'FloyedSteinburg',

        // Vector
        alignment: 'none',
        optimizePath: true,
        vectorThreshold: 128,
        isInvert: false,
        turdSize: 2
    };

    actions = {
        onChangeMode: (mode) => {
            if (mode === 'bw') {
                this.update({ mode: 'bw' });
                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    filename: '(default image)',
                    originSrc: DEFAULT_RASTER_IMAGE,
                    imageSrc: DEFAULT_RASTER_IMAGE,
                    originWidth: DEFAULT_SIZE_WIDTH,
                    originHeight: DEFAULT_SIZE_HEIGHT,
                    sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                    sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
                    alignment: 'none'
                });
                this.props.changeSourceImage(DEFAULT_RASTER_IMAGE, DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT);
                this.props.setTarget({ anchor: 'Bottom Left' });
                this.props.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10);
            } else if (mode === 'greyscale') {
                this.update({ mode: 'greyscale' });
                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    filename: '(default image)',
                    originSrc: DEFAULT_RASTER_IMAGE,
                    imageSrc: DEFAULT_RASTER_IMAGE,
                    originWidth: DEFAULT_SIZE_WIDTH,
                    originHeight: DEFAULT_SIZE_HEIGHT,
                    sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                    sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
                    alignment: 'none'
                });
                this.props.changeSourceImage(DEFAULT_RASTER_IMAGE, DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT);
                this.props.setTarget({ anchor: 'Bottom Left' });
                this.props.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10);
            } else if (mode === 'vector') {
                this.update({ mode: 'vector', subMode: 'svg' });
                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    filename: '(default image)',
                    originSrc: DEFAULT_VECTOR_IMAGE,
                    imageSrc: DEFAULT_VECTOR_IMAGE,
                    originWidth: DEFAULT_SIZE_WIDTH,
                    originHeight: DEFAULT_SIZE_HEIGHT,
                    sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                    sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
                    alignment: 'none'
                });
                this.props.changeSourceImage(DEFAULT_VECTOR_IMAGE, DEFAULT_SIZE_WIDTH, DEFAULT_SIZE_HEIGHT);
                this.props.setTarget({ anchor: 'Bottom Left' });
                this.props.changeTargetSize(DEFAULT_SIZE_WIDTH / 10, DEFAULT_SIZE_HEIGHT / 10);
            } else {
                this.update({ mode: 'text' });
            }
        },
        onClickUpload: () => {
            this.fileInput.value = null;
            this.fileInput.click();
        },
        onChangeFile: (event) => {
            const files = event.target.files;
            const file = files[0];
            const formData = new FormData();
            formData.append('image', file);

            api.uploadImage(formData).then((res) => {
                const image = res.body;

                // check ranges of width / height
                const ratio = image.width / image.height;
                let width = image.width;
                let height = image.height;
                if (width >= height && width > BOUND_SIZE) {
                    width = BOUND_SIZE;
                    height = BOUND_SIZE / ratio;
                }
                if (height >= width && height > BOUND_SIZE) {
                    width = BOUND_SIZE * ratio;
                    height = BOUND_SIZE;
                }

                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    filename: image.filename,
                    originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: width,
                    sizeHeight: height
                });

                this.props.changeSourceImage(`${WEB_CACHE_IMAGE}/${image.filename}`, image.width, image.height);
                this.props.changeTargetSize(width, height);
            }).catch(() => {
                modal({
                    title: 'Parse Image Error',
                    body: `Failed to parse image file ${file.name}`
                });
            });
        },
        onChangeWidth: (width) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const height = toFixed(width * ratio, 2);
            if (height <= 0 || height > BOUND_SIZE) {
                return;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
            this.props.changeTargetSize(width, height);
        },
        onChangeHeight: (height) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const width = height / ratio;
            if (width <= 0 || width > BOUND_SIZE) {
                return;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
            this.props.changeTargetSize(width, height);
        },
        onChangeDensity: (density) => {
            this.update({ density });
        },

        // BW
        changeBWThreshold: (bwThreshold) => {
            this.update({ bwThreshold });
        },
        onChangeDirection: (option) => {
            this.update({ direction: option.value });
        },

        // Greyscale
        onChangeContrast: (contrast) => {
            this.update({ contrast });
        },
        onChangeBrightness: (brightness) => {
            this.update({ brightness });
        },
        onChangeWhiteClip: (whiteClip) => {
            this.update({ whiteClip });
        },
        onChangeAlgorithm: (options) => {
            this.update({ algorithm: options.value });
        },

        // Vector
        onChangeSubMode: (options) => {
            const state = {
                subMode: options.value,
                imageSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                originSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                originWidth: DEFAULT_SIZE_WIDTH,
                originHeight: DEFAULT_SIZE_HEIGHT,
                sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                sizeHeight: DEFAULT_SIZE_HEIGHT / 10
            };
            this.update(state);

            this.props.changeSourceImage(state.imageSrc, state.originWidth, state.originHeight);
            this.props.changeTargetSize(state.sizeWidth, state.sizeHeight);
        },
        changeVectorThreshold: (vectorThreshold) => {
            this.update({ vectorThreshold });
        },
        onChangeTurdSize: (turdSize) => {
            return this.update({ turdSize });
        },

        onToggleInvert: (event) => {
            this.update({ isInvert: event.target.checked });
        },
        onSelectAlignment: (option) => {
            this.update({ alignment: option.value });

            let anchor;
            if (option.value === 'center') {
                anchor = 'Center';
            } else if (option.value === 'none') {
                anchor = 'Bottom Left';
            }
            this.props.setTarget({ anchor: anchor });
        },
        onToggleOptimizePath: (event) => {
            this.update({ optimizePath: event.target.checked });
        },

        onClickPreview: () => {
            pubsub.publish(ACTION_REQ_PREVIEW_LASER);
        }
    };

    update(action, state) {
        if (state === undefined) {
            state = action;
            action = ACTION_CHANGE_PARAMETER_LASER;
        }

        this.setState(state);
        pubsub.publish(action, state);
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        const acceptableExtensions = (state.mode === 'vector' && state.subMode === 'svg' ? '.svg' : '.png, .jpg, .jpeg, .bmp');

        return (
            <React.Fragment>
                <div>
                    <div className={styles['laser-mode']}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: state.mode === 'bw' })}
                            onClick={() => actions.onChangeMode('bw')}
                        >
                            <img
                                src="/images/laser/laser-mode-bw-88x88.png"
                                role="presentation"
                                alt="laser mode B&W"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>B&W</span>
                    </div>
                    <div className={styles['laser-mode']}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: state.mode === 'greyscale' })}
                            onClick={() => actions.onChangeMode('greyscale')}
                        >
                            <img
                                src="/images/laser/laser-mode-greyscale-88x88.png"
                                role="presentation"
                                alt="laser mode greyscale"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>GREYSCALE</span>
                    </div>
                    <div className={styles['laser-mode']}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: state.mode === 'vector' })}
                            onClick={() => actions.onChangeMode('vector')}
                        >
                            <img
                                src="/images/laser/laser-mode-vector-88x88.png"
                                role="presentation"
                                alt="laser mode vector"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>VECTOR</span>
                    </div>
                    <div className={styles['laser-mode']} style={{ marginRight: '0' }}>
                        <Anchor
                            className={classNames(styles['laser-mode-btn'], { [styles.selected]: state.mode === 'text' })}
                            onClick={() => actions.onChangeMode('text')}
                        >
                            <img
                                src="/images/laser/laser-mode-text-88x88.png"
                                role="presentation"
                                alt="laser mode vector"
                            />
                        </Anchor>
                        <span className={styles['laser-mode-text']}>TEXT</span>
                    </div>
                </div>

                {state.mode === 'vector' &&
                <table className={styles['parameter-table']} style={{ marginTop: '15px' }}>
                    <tbody>
                        <tr>
                            <td>
                                Source Type
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Source Type')}
                                    content={i18n._('Select the type of the image you want to upload.'
                                        + 'Raster supports PNG and JPEG images, while SVG only supports SVG images.'
                                        + 'The Raster images will be transferred into SVG automatically.')}
                                >
                                    <Select
                                        options={[{
                                            value: 'raster',
                                            label: 'Raster'
                                        }, {
                                            value: 'svg',
                                            label: 'SVG'
                                        }]}
                                        value={state.subMode}
                                        searchable={false}
                                        clearable={false}
                                        backspaceRemoves={false}
                                        onChange={actions.onChangeSubMode}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                }

                {state.mode !== 'text' &&
                <div style={{ marginTop: '15px' }}>
                    <input
                        ref={(node) => {
                            this.fileInput = node;
                        }}
                        type="file"
                        accept={acceptableExtensions}
                        style={{ display: 'none' }}
                        multiple={false}
                        onChange={actions.onChangeFile}
                    />
                    <div style={{ display: 'inline-block', float: 'left', marginTop: '5px' }}>
                        <button
                            type="button"
                            className={classNames(styles.btn, styles['btn-small'])}
                            title="Upload Image"
                            onClick={actions.onClickUpload}
                        >
                            Upload Image
                        </button>
                    </div>
                    <div style={{ display: 'inline-block', marginLeft: '10px' }}>
                        <div><span className={styles['description-text']}>{state.filename}</span></div>
                        <div><span className={styles['description-text']}>{state.originWidth} x {state.originHeight}</span></div>
                    </div>
                </div>
                }

                <div style={{ marginTop: '18px' }}>
                    {state.mode === 'bw' && <Bwline actions={actions} state={state} />}
                    {state.mode === 'greyscale' && <Greyscale actions={actions} state={state} />}
                    {state.mode === 'vector' && <Vector stage={this.props.stage} actions={actions} state={state} />}
                    {state.mode === 'text' && <TextMode actions={actions} state={state} />}
                </div>

                {state.mode !== 'text' &&
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-blue'])}
                    onClick={actions.onClickPreview}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    Preview
                </button>
                }
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        stage: state.laser.stage
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        // temp for image update
        changeSourceImage: (image, width, height) => dispatch(actions.changeSourceImage(image, width, height)),
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        changeTargetSize: (width, height) => dispatch(actions.changeTargetSize(width, height))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(LaserParameters);
