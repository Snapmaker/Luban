import React, { PureComponent } from 'react';
import classNames from 'classnames';
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
    ACTION_REQ_PREVIEW_LASER, ACTION_CHANGE_STAGE_LASER
} from '../../constants';
import api from '../../api';
import { ensureRange, toFixed } from '../../lib/numeric-utils';
import Bwline from './Bwline';
import Greyscale from './Greyscale';
import Vector from './Vector';
// import styles from './styles.styl';


class LaserParameters extends PureComponent {
    fileInput = null;

    state = {
        // 'bw', 'greyscale', 'vector'
        mode: 'bw',
        subMode: 'svg', // 'svg' or 'raster', only works when mode === 'vector'

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

        // Grayscale
        contrast: 50,
        brightness: 50,
        whiteClip: 255,
        algorithm: 'FloyedSteinburg',

        // Vector
        alignment: 'clip',
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
                    originSrc: DEFAULT_RASTER_IMAGE,
                    imageSrc: DEFAULT_RASTER_IMAGE,
                    originWidth: DEFAULT_SIZE_WIDTH,
                    originHeight: DEFAULT_SIZE_HEIGHT,
                    sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                    sizeHeight: DEFAULT_SIZE_HEIGHT / 10
                });
            } else if (mode === 'greyscale') {
                this.update({ mode: 'greyscale' });
                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    originSrc: DEFAULT_RASTER_IMAGE,
                    imageSrc: DEFAULT_RASTER_IMAGE,
                    originWidth: DEFAULT_SIZE_WIDTH,
                    originHeight: DEFAULT_SIZE_HEIGHT,
                    sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                    sizeHeight: DEFAULT_SIZE_HEIGHT / 10
                });
            } else {
                this.update({ mode: 'vector', subMode: 'svg' });
                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    originSrc: DEFAULT_VECTOR_IMAGE,
                    imageSrc: DEFAULT_VECTOR_IMAGE,
                    originWidth: DEFAULT_SIZE_WIDTH,
                    originHeight: DEFAULT_SIZE_HEIGHT,
                    sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                    sizeHeight: DEFAULT_SIZE_HEIGHT / 10
                });
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
                // DPI to px/mm
                const density = ensureRange((image.density / 25.4).toFixed(1), 1, 10);

                // check ranges of width / height
                const ratio = image.width / image.height;
                let width = image.width / density;
                let height = image.height / density;
                if (width >= height && width > BOUND_SIZE) {
                    width = BOUND_SIZE;
                    height = BOUND_SIZE / ratio;
                }
                if (height >= width && height > BOUND_SIZE) {
                    width = BOUND_SIZE * ratio;
                    height = BOUND_SIZE;
                }

                this.update(ACTION_CHANGE_IMAGE_LASER, {
                    originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: width,
                    sizeHeight: height,
                    density: density
                });
            });
        },
        onChangeWidth: (width) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const height = toFixed(width * ratio, 2);
            if (height <= 0 || height > BOUND_SIZE) {
                return false;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
            return true;
        },
        onChangeHeight: (height) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const width = height / ratio;
            if (width <= 0 || width > BOUND_SIZE) {
                return false;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
            return true;
        },
        onChangeDensity: (density) => {
            this.update({ density });
            return true;
        },

        // BW
        changeBWThreshold: (bwThreshold) => {
            this.update({ bwThreshold });
        },
        onChangeDirection: (options) => {
            this.update({ direction: options.value });
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
            this.update({
                subMode: options.value,
                imageSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                originSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                originWidth: DEFAULT_SIZE_WIDTH,
                originHeight: DEFAULT_SIZE_HEIGHT,
                sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                sizeHeight: DEFAULT_SIZE_HEIGHT / 10
            });
        },
        changeVectorThreshold: (vectorThreshold) => {
            this.update({ vectorThreshold });
        },
        onChangeTurdSize: (turdSize) => {
            this.update({ turdSize });
            return true;
        },

        onToggleInvert: (event) => {
            this.update({ isInvert: event.target.checked });
        },
        onSelectAlignment: (options) => {
            this.update({ alignment: options.value });
        },
        onToggleOptimizePath: (event) => {
            this.update({ optimizePath: event.target.checked });
        },

        onClickPreview: () => {
            pubsub.publish(ACTION_REQ_PREVIEW_LASER);
        }
    };

    subscriptions = [];

    update(action, state) {
        if (state === undefined) {
            state = action;
            action = ACTION_CHANGE_PARAMETER_LASER;
        }

        this.setState(state);
        pubsub.publish(action, state);
    }

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_STAGE_LASER, (msg, data) => {
                // update stage and imageSrc
                this.setState(data);
            })
        ];
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.state;
        const actions = this.actions;

        return (
            <div>
                <div className="button-group" style={{ marginBottom: '20px' }}>
                    <button
                        type="button"
                        className={classNames('btn', 'btn-default', { 'btn-select': state.mode === 'bw' })
                        }
                        style={{ width: '33%', margin: '0', borderRadius: '0' }}
                        onClick={() => actions.onChangeMode('bw')}
                    >
                        B&W
                    </button>
                    <button
                        type="button"
                        className={classNames('btn', 'btn-default', { 'btn-select': state.mode === 'greyscale' })}
                        style={{ width: '33%', margin: '0', borderRadius: '0' }}
                        onClick={() => actions.onChangeMode('greyscale')}
                    >
                        GREYSCALE
                    </button>
                    <button
                        type="button"
                        className={classNames('btn', 'btn-default', { 'btn-select': state.mode === 'vector' })}
                        style={{ width: '33%', margin: '0', borderRadius: '0' }}
                        onClick={() => actions.onChangeMode('vector')}
                    >
                        VECTOR
                    </button>
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <input
                        // The ref attribute adds a reference to the component to
                        // this.refs when the component is mounted.
                        ref={(node) => {
                            this.fileInput = node;
                        }}
                        type="file"
                        accept={state.mode === 'vector' && state.subMode === 'svg' ? '.svg' : '.png, .jpg, .jpeg, .bmp'}
                        style={{ display: 'none' }}
                        multiple={false}
                        onChange={actions.onChangeFile}
                    />
                    <button
                        type="button"
                        className="btn btn-primary"
                        title="Upload Image"
                        onClick={actions.onClickUpload}
                    >
                        Upload Image
                    </button>
                </div>

                {state.mode === 'bw' && <Bwline actions={actions} state={state} />}
                {state.mode === 'greyscale' && <Greyscale actions={actions} state={state} />}
                {state.mode === 'vector' && <Vector actions={actions} state={state} />}

                <button
                    type="button"
                    className="btn btn-default"
                    onClick={actions.onClickPreview}
                    style={{
                        display: 'block',
                        width: '100%',
                        margin: '10px 0 10px 0'
                    }}
                >
                    Preview
                </button>
            </div>
        );
    }
}

export default LaserParameters;
