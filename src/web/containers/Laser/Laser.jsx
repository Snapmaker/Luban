import _ from 'lodash';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import path from 'path';
import classNames from 'classnames';
import ensureRange from '../../lib/numeric-utils';
import i18n from '../../lib/i18n';
import {
    MARLIN,
    INTERACTIVE_INPUT_DELAY,
    BOUND_SIZE,
    WEB_CACHE_IMAGE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT
} from '../../constants';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisiualizer from '../../widgets/LaserVisualizer';
import styles from './index.styl';
import Greyscale from './Greyscale';
import Bwline from './Bwline';
import Vector from './Vector';

class Laser extends Component {

    state = this.getInitialState();

    fileInputEl = null;

    onClickToUpload() {
        this.fileInputEl.value = null;
        this.fileInputEl.click();
    }

    actions = {
        // Mode selection
        onChangeBW: () => {
            this.setState({
                mode: 'bw',
                stage: STAGE_IMAGE_LOADED,
                originSrc: DEFAULT_RASTER_IMAGE,
                imageSrc: DEFAULT_RASTER_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT
            });
        },
        onChangeGreyscale: () => {
            this.setState({
                mode: 'greyscale',
                stage: STAGE_IMAGE_LOADED,
                originSrc: DEFAULT_RASTER_IMAGE,
                imageSrc: DEFAULT_RASTER_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT
            });
        },
        onChangeVector: () => {
            this.setState({
                mode: 'vector',
                stage: STAGE_PREVIEWED,
                originSrc: DEFAULT_VECTOR_IMAGE,
                imageSrc: DEFAULT_VECTOR_IMAGE,
                subMode: 'svg',
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT
            });
        },

        // common
        // Upload Image
        onChangeFile: (event) => {
            const files = event.target.files;
            const file = files[0];
            const formData = new FormData();
            formData.append('image', file);

            api.uploadImage(formData).then((res) => {
                const image = res.body;
                // DPI to px/mm
                const density = ensureRange((image.density / 25.4).toFixed(1), 1, 10);
                this.setState({
                    originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: image.width / density,
                    sizeHeight: image.height / density,
                    density: density,
                    stage: this.state.mode === 'vector' && this.state.subMode === 'svg' ? STAGE_PREVIEWED : STAGE_IMAGE_LOADED
                });
                this.onChangeValueFix();
            });
        },
        onChangeJogSpeed: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                jogSpeed: event.target.value
            });
            this.onChangeValueFix();
        },
        onChangeWorkSpeed: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                workSpeed: event.target.value
            });
            this.onChangeValueFix();
        },
        onChangeWidth: (event) => {
            const value = parseFloat(event.target.value) || BOUND_SIZE;
            const ratio = this.state.originHeight / this.state.originWidth;
            this.setState({
                sizeWidth: value,
                sizeHeight: value * ratio,
                stage: this.state.mode === 'vector' ? STAGE_PREVIEWED : STAGE_IMAGE_LOADED
            });
            this.onChangeValueFix();
        },
        onChangeHeight: (event) => {
            const value = parseFloat(event.target.value) || BOUND_SIZE;
            const ratio = this.state.originHeight / this.state.originWidth;
            this.setState({
                sizeWidth: value / ratio,
                sizeHeight: value,
                stage: this.state.mode === 'vector' ? STAGE_PREVIEWED : STAGE_IMAGE_LOADED
            });
            this.onChangeValueFix();
        },

        // BW
        changeBWThreshold: (value) => {
            const bwThreshold = Number(value) || 0;
            this.setState({
                bwThreshold,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onChangeDirection: (options) => {
            this.setState({
                direction: options.value,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },

        // GreyScale
        onChangeContrast: (value) => {
            const contrast = Number(value) || 0;
            this.setState({
                contrast,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onChangeBrightness: (value) => {
            const brightness = Number(value) || 0;
            this.setState({
                brightness,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onChangeWhiteClip: (value) => {
            const whiteClip = Number(value) || 255;
            this.setState({
                whiteClip,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onChangeAlgorithm: (options) => {
            this.setState({
                algorithm: options.value,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onChangeDwellTime: (event) => {
            this.setState({
                stage: Math.min(this.state.stage, STAGE_PREVIEWED),
                dwellTime: event.target.value
            });
            this.onChangeValueFix();
        },
        onChangeDensity: (event) => {
            this.setState({
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED),
                density: event.target.value
            });
            this.onChangeValueFix();
        },

        // Vector
        onChangeSubMode: (options) => {
            this.setState({
                subMode: options.value,
                stage: options.value === 'raster' ? STAGE_IMAGE_LOADED : STAGE_PREVIEWED,
                imageSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                originSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT
            });
        },
        changeVectorThreshold: (value) => {
            const vectorThreshold = Number(value) || 0;
            this.setState({
                vectorThreshold,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onChangeTurdSize: (event) => {
            const value = event.target.value;

            this.setState({
                turdSize: value,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },

        onToggleInvert: (event) => {
            const checked = event.target.checked;
            this.setState({
                isInvert: checked,
                stage: Math.min(this.state.stage, STAGE_IMAGE_LOADED)
            });
        },
        onToggleClip: (event) => {
            const checked = event.target.checked;
            this.setState({
                clip: checked,
                stage: Math.min(this.state.stage, STAGE_PREVIEWED)
            });
        },
        onToggleOptimizePath: (event) => {
            const checked = event.target.checked;
            this.setState({
                optimizePath: checked,
                stage: Math.min(this.state.stage, STAGE_PREVIEWED)
            });
        },
        // When input is not focused, we check if the value is a valid number
        onInputBlur: () => {
            const keys = ['density', 'workSpeed', 'jogSpeed', 'dwellTime'];

            keys.forEach(key => {
                const value = parseFloat(this.state[key]);
                if (isNaN(value)) {
                    this.setState({ [key]: 0 });
                }
            });
        },

        // actions
        onChangePreview: () => {
            controller.generateImage(this.state);
        },

        onChangeGcode: () => {
            controller.generateGcode(this.state);
        },
        onLoadGcode: () => {
            const gcodeSrc = this.state.gcodeSrc;
            location.href = '/#/workspace';
            window.scrollTo(0, 0);
            jQuery.get(gcodeSrc, (result) => {
                //pubsub.publish('gcode:load', { name: gcodeSrc, gcode: result });
                pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodeSrc } });
            });
        },
        onExport: () => {
            // https://stackoverflow.com/questions/3682805/javascript-load-a-page-on-button-click
            const gcodeSrc = this.state.gcodeSrc;
            const filename = path.basename(gcodeSrc);
            location.href = '/api/gcode/download_cache?filename=' + filename;
        }
    };

    controllerEvents = {
        'image:generated': (imageSrc) => {
            this.setState({
                imageSrc,
                stage: STAGE_PREVIEWED
            });
        },
        'gcode:generated': (gcodeSrc) => {
            this.setState({
                gcodeSrc,
                stage: STAGE_GENERATED
            });
        },
        'serialport:open': (options) => {
            const { port, controllerType } = options;
            this.setState({
                isReady: controllerType === MARLIN,
                port: port
            });
        },
        'serialport:close': (options) => {
            this.setState({ isReady: false });
        },
        'workflow:state': (workflowState) => {
            this.setState({ isPrinting: workflowState === 'running' });
        }
    };
    componentDidMount() {
        this.addControllerEvents();
    }
    componentWillUnmount() {
        this.removeControllerEvents();
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }


    getInitialState() {
        return {
            // ModeType
            type: 'laser',
            mode: 'bw',
            // status
            stage: STAGE_IMAGE_LOADED,
            isReady: false,  // Connection open, ready to load Gcode
            isPrinting: false, // Prevent CPU-critical job during printing
            port: '-',
            // common
            jogSpeed: 1500,
            workSpeed: 288,
            originSrc: DEFAULT_RASTER_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH * 10,
            originHeight: DEFAULT_SIZE_HEIGHT * 10,
            imageSrc: DEFAULT_RASTER_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH,
            sizeHeight: DEFAULT_SIZE_HEIGHT,
            gcodeSrc: '-',
            // BW
            bwThreshold: 128,
            direction: 'Horizontal',
            density: 10, // BW & GrayScale
            // GrayScale
            contrast: 50,
            brightness: 50,
            whiteClip: 255,
            algorithm: 'FloyedSteinburg',
            dwellTime: 42,
            // vector
            subMode: 'svg',
            clip: true,
            optimizePath: true,
            vectorThreshold: 128,
            isInvert: false,
            turdSize: 2
        };
    }

    onChangeValueFix = _.debounce(() => {
        { // width & height
            let width = parseFloat(this.state.sizeWidth);
            let height = parseFloat(this.state.sizeHeight);
            if (!isNaN(width) && !isNaN(height)) {
                if (width >= height && width > BOUND_SIZE) {
                    const ratio = width / height;
                    width = BOUND_SIZE;
                    height = width / ratio;
                }
                if (height >= width && height > BOUND_SIZE) {
                    const ratio = width / height;
                    width = BOUND_SIZE * ratio;
                    height = BOUND_SIZE;
                }
                width = width.toFixed(1);
                height = height.toFixed(1);
                this.setState({ sizeWidth: width, sizeHeight: height });
            }
        }

        { // density
            let value = parseFloat(this.state.density);
            if (!isNaN(value)) {
                value = ensureRange(value, 1, 10);
                this.setState({ density: value });
            }
        }

        { // workSpeed
            let value = parseFloat(this.state.workSpeed);
            if (!isNaN(value)) {
                value = ensureRange(value, 1, 6000);
                this.setState({ workSpeed: value });
            }
        }

        { // jogSpeed
            let value = parseFloat(this.state.jogSpeed);
            if (!isNaN(value)) {
                value = ensureRange(value, 1, 6000);
                this.setState({ jogSpeed: value });
            }
        }

        // Gray Scale
        { // dwellTime
            let value = parseFloat(this.state.dwellTime);
            if (!isNaN(value)) {
                value = ensureRange(value, 1, 10000);
                this.setState({ dwellTime: value });
            }
        }
    }, INTERACTIVE_INPUT_DELAY);

    render() {
        const style = this.props.style;
        const state = { ...this.state };
        const actions = { ...this.actions };
        return (
            <div style={style}>
                <div className={styles.laserTable}>
                    <div className={styles.laserTableRow}>

                        <div className={styles.viewSpace}>
                            <div style={{ position: 'absolute', top: '50px', left: '30px', zIndex: '300' }}>
                                <input
                                    // The ref attribute adds a reference to the component to
                                    // this.refs when the component is mounted.
                                    ref={(node) => {
                                        this.fileInputEl = node;
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
                                    title={'Upload Image'}
                                    onClick={::this.onClickToUpload}
                                >
                                    Upload Image
                                </button>
                            </div>
                            <LaserVisiualizer widgetId="laserVisiualizer" state={state} />
                        </div>

                        <div className={styles.controlBar}>
                            <div style={{ marginBottom: '20px' }}>
                                <div className="button-group">
                                    <button
                                        type="button"
                                        className={classNames('btn', 'btn-default',
                                            {
                                                'btn-select': state.mode === 'bw'
                                            })
                                        }
                                        style={{ width: '33%', margin: '0', borderRadius: '0' }}
                                        onClick={actions.onChangeBW}
                                    >
                                        B&W
                                    </button>
                                    <button
                                        type="button"
                                        className={classNames('btn', 'btn-default',
                                            {
                                                'btn-select': state.mode === 'greyscale'
                                            })
                                        }
                                        style={{ width: '33%', margin: '0', borderRadius: '0' }}
                                        onClick={actions.onChangeGreyscale}
                                    >
                                        GREYSCALE
                                    </button>
                                    <button
                                        type="button"
                                        className={classNames('btn', 'btn-default',
                                            {
                                                'btn-select': state.mode === 'vector'
                                            })
                                        }
                                        style={{ width: '33%', margin: '0', borderRadius: '0' }}
                                        onClick={actions.onChangeVector}
                                    >
                                        VECTOR
                                    </button>
                                </div>
                            </div>

                            <hr />

                            {state.mode === 'greyscale' && <Greyscale actions={actions} state={state} />}
                            {state.mode === 'bw' && <Bwline actions={actions} state={state} />}
                            {state.mode === 'vector' && <Vector actions={actions} state={state} />}

                            <hr />

                            <div style={{ marginTop: '30px' }}>
                                {(state.mode !== 'vector' || state.subMode === 'raster') &&
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onChangePreview}
                                    disabled={state.stage < STAGE_IMAGE_LOADED || state.isPrinting}
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', marginTop: '10px', marginBottom: '10px' }}
                                >
                                    Preview
                                </button>}
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onChangeGcode}
                                    disabled={state.stage < STAGE_PREVIEWED || state.isPrinting}
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', mariginTop: '10px', marginBottom: '10px' }}
                                >
                                    GenerateGCode
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onLoadGcode}
                                    disabled={(!state.isReady || state.stage < STAGE_GENERATED) || state.isPrinting}
                                    title="Must open connection first"
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', mariginTop: '10px', marginBottom: '10px' }}
                                >
                                    Load
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onExport}
                                    disabled={state.stage < STAGE_GENERATED || state.isPrinting}
                                    style={{ display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', mariginTop: '10px', marginBottom: '10px' }}
                                >
                                    Export
                                </button>

                            </div>
                            <div className={styles.warnInfo}>
                                {state.isPrinting &&
                                <div className="alert alert-success" role="alert">
                                    {i18n._('Notice: You are printing! Pause the print if you want to preview again.')}
                                </div>
                                }
                                {!state.isPrinting && state.stage < STAGE_IMAGE_LOADED &&
                                <div className="alert alert-info" role="alert">
                                    {i18n._('Please upload image!')}
                                </div>
                                }
                                {!state.isPrinting && state.stage === STAGE_IMAGE_LOADED &&
                                <div className="alert alert-info" role="alert">
                                    {i18n._('Adjust parameter then preview!')}
                                </div>
                                }
                                {!state.isPrinting && state.stage === STAGE_PREVIEWED &&
                                <div className="alert alert-info" role="alert">
                                    {i18n._('Adjust parameter then generate G-Code!')}
                                </div>
                                }
                                {!state.isPrinting && state.stage === STAGE_GENERATED &&
                                <div className="alert alert-info" role="alert">
                                    <p>{i18n._('Now you can:')}</p>
                                    <p>{i18n._('1. Click "Load" to load generated G-Code and then you are ready for printing. Or')}</p>
                                    <p>{i18n._('2. Click "Export" to export generated G-Code file for later printing.')}</p>
                                </div>
                                }
                                {!state.isPrinting && state.stage === STAGE_GENERATED && !state.isReady &&
                                <div className="alert alert-warning" role="alert">
                                    {i18n._('An active connection is required to load generated G-Code.')}
                                </div>
                                }
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        );
    }
}

export default withRouter(Laser);
