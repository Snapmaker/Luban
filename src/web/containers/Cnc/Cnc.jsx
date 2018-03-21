import _ from 'lodash';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import classNames from 'classnames';
import path from 'path';
import log from '../../lib/log';
import i18n from '../../lib/i18n';
import ensureRange from '../../lib/numeric-utils';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisiualizer from '../../widgets/LaserVisualizer';
import styles from './index.styl';
import Vector from './Vector';
import Relief from './Relief';

import {
    MARLIN,
    WEB_CACHE_IMAGE,
    INTERACTIVE_INPUT_DELAY,
    BOUND_SIZE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT
} from '../../constants';

class Laser extends Component {
    state = this.getInitialState();

    fileInputEl = null;

    actions = {
        // element events
        onClickToUpload: () => {
            if (this.fileInputEl) {
                this.fileInputEl.value = null;
                this.fileInputEl.click();
            } else {
                log.error('this.fileInputEl is not bound');
            }
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
                this.setState({
                    stage: STAGE_IMAGE_LOADED,
                    originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: image.width / density,
                    sizeHeight: image.height / density
                });
                this.onChangeValueFix();
            });
        },
        // mode
        onChangeRelief: () => {
            this.setState({
                mode: 'relief',
                stage: STAGE_PREVIEWED,
                imageSrc: DEFAULT_RASTER_IMAGE,
                originSrc: DEFAULT_RASTER_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH / 10, // default use smaller carve size
                sizeHeight: DEFAULT_SIZE_HEIGHT / 10
            });
        },
        onChangeVector: () => {
            this.setState({
                mode: 'vector',
                stage: STAGE_PREVIEWED,
                imageSrc: DEFAULT_VECTOR_IMAGE,
                originSrc: DEFAULT_VECTOR_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
                subMode: 'svg'
            });
        },
        // common
        onChangeWidth: (event) => {
            const value = parseFloat(event.target.value) || BOUND_SIZE;
            const ratio = this.state.originHeight / this.state.originWidth;
            this.setState({
                sizeWidth: value,
                sizeHeight: value * ratio,
                stage: this.state.subMode === 'svg' ? STAGE_PREVIEWED : STAGE_IMAGE_LOADED
            });
        },
        onChangeHeight: (event) => {
            const value = parseFloat(event.target.value) || BOUND_SIZE;
            const ratio = this.state.originHeight / this.state.originWidth;
            this.setState({
                sizeWidth: value / ratio,
                sizeHeight: value,
                stage: this.state.subMode === 'svg' ? STAGE_PREVIEWED : STAGE_IMAGE_LOADED
            });
        },

        // relief
        onChangeGreyLevel: (options) => {
            this.setState({
                state: STAGE_PREVIEWED,
                greyLevel: options.value
            });
        },
        onToolDiameter: (event) => {
            const value = event.target.value;

            this.setState({
                toolDiameter: value,
                stage: STAGE_PREVIEWED
            });
        },

        // vector
        // vector - raster
        changeVectorThreshold: (value) => {
            const vectorThreshold = Number(value) || 0;
            this.setState({
                vectorThreshold,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onChangeTurdSize: (event) => {
            const value = event.target.value;

            this.setState({
                turdSize: value,
                stage: STAGE_IMAGE_LOADED
            });
        },
        onToggleInvert: (event) => {
            const checked = event.target.checked;
            this.setState({
                isInvert: checked,
                stage: STAGE_IMAGE_LOADED
            });
        },
        // vector - SVG
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
        onChangeWorkSpeed: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                workSpeed: event.target.value
            });
            this.onChangeValueFix();
        },
        onChangeJogSpeed: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                jogSpeed: event.target.value
            });
            this.onChangeValueFix();
        },
        onPlungeSpeed: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                plungeSpeed: event.target.value
            });
        },
        onTargetDepth: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                targetDepth: event.target.value
            });
            this.onChangeValueFix();
        },
        onStepDown: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                stepDown: event.target.value
            });
            this.onChangeValueFix();
        },
        onSafetyHeight: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                safetyHeight: event.target.value
            });
            this.onChangeValueFix();
        },
        onStopHeight: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                stopHeight: event.target.value
            });
            this.onChangeValueFix();
        },
        onToggleEnableTab: (event) => {
            this.setState({
                enableTab: event.target.checked,
                stage: STAGE_PREVIEWED
            });
        },
        onTabHeight: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                tabHeight: event.target.value
            });
            this.onChangeValueFix();
        },
        onTabSpace: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                tabSpace: event.target.value
            });
            this.onChangeValueFix();
        },
        onTabWidth: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                tabWidth: event.target.value
            });
            this.onChangeValueFix();
        },
        onToggleClip: (event) => {
            const checked = event.target.checked;
            this.setState({
                clip: checked,
                stage: STAGE_PREVIEWED
            });
        },
        onToggleOptimizePath: (event) => {
            const checked = event.target.checked;
            this.setState({
                optimizePath: checked,
                stage: STAGE_PREVIEWED
            });
        },
        // When input is not focused, we check if the value is a valid number
        onInputBlur: () => {
            const keys = ['workSpeed', 'jogSpeed', 'plungeSpeed', 'targetDepth', 'stepDown',
                'safetyHeight', 'stopHeight', 'tabHeight', 'tabSpace', 'tabWidth'];

            keys.forEach(key => {
                const value = parseFloat(this.state[key]);
                if (isNaN(value)) {
                    this.setState({ [key]: 0 });
                }
            });
        },
        // Stage functions
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
        'image:generated-cnc': (imageSrc) => {
            this.setState({
                ...this.state,
                imageSrc,
                stage: STAGE_PREVIEWED
            });
        },
        'gcode:generated-cnc': (gcodeSrc) => {
            this.setState({
                ...this.state,
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
            // mode
            type: 'cnc',
            mode: 'vector',
            subMode: 'svg',

            // status
            stage: STAGE_PREVIEWED,
            isReady: false,  // Connection open, ready to load Gcode
            isPrinting: false, // Prevent CPU-critical job during printing

            // common
            jogSpeed: 800,
            workSpeed: 300,
            originSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            imageSrc: DEFAULT_VECTOR_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
            gcodeSrc: '-',
            port: '-',
            stopHeight: 10,
            // relief
            toolDiameter: 0.1,
            greyLevel: '16',

            // vector
            // vector - raster
            vectorThreshold: 128,
            turdSize: 2,
            isInvert: false,
            // vector - svg
            plungeSpeed: 500,
            targetDepth: 2.2,
            stepDown: 0.8,
            safetyHeight: 3,
            clip: true,
            optimizePath: true,
            // tab
            enableTab: false,
            tabWidth: 2,
            tabHeight: -1,
            tabSpace: 24
        };
    }

    // To do debounce on React Input, see
    // [Debounce and onChange](https://github.com/facebook/react/issues/1360)
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

        { // workSpeed
            let value = parseFloat(this.state.workSpeed);
            if (!isNaN(value)) {
                value = ensureRange(value, 1, 3600);
                this.setState({ workSpeed: value });
            }
        }

        { // jobSpeed
            let value = parseFloat(this.state.jogSpeed);
            if (!isNaN(value)) {
                value = ensureRange(value, 1, 6000);
                this.setState({ jogSpeed: value });
            }
        }

        // targetDepth
        let targetDepth = parseFloat(this.state.targetDepth);
        if (!isNaN(targetDepth)) {
            targetDepth = ensureRange(targetDepth, 0, 10);
            this.setState({ targetDepth: targetDepth });
        }

        { // stepDown (dependency: targetDepth)
            let value = parseFloat(this.state.stepDown);
            if (!isNaN(value) && !isNaN(targetDepth)) {
                value = ensureRange(value, 0, this.state.targetDepth);
                this.setState({ stepDown: value });
            }
        }

        { // safetyHeight
            let value = parseFloat(this.state.safetyHeight);
            if (!isNaN(value)) {
                value = ensureRange(value, 0, 10);
                this.setState({ safetyHeight: value });
            }
        }

        { // stopHeight
            let value = parseFloat(this.state.stopHeight);
            if (!isNaN(value)) {
                value = ensureRange(value, 0, Number.MAX_SAFE_INTEGER);
                this.setState({ stopHeight: value });
            }
        }

        { // tabHeight (dependency: targetDepth)
            let value = parseFloat(this.state.tabHeight);
            if (!isNaN(value) && !isNaN(targetDepth)) {
                if (value > 0) {
                    value = -value;
                }
                value = ensureRange(value, -this.state.targetDepth, 0);
                this.setState({ tabHeight: value });
            }
        }

        { // tabSpace
            let value = parseFloat(this.state.tabSpace);
            if (!isNaN(value)) {
                value = ensureRange(value, 0, Number.MAX_SAFE_INTEGER);
                this.setState({ tabSpace: value });
            }
        }

        { // tabWidth
            let value = parseFloat(this.state.tabWidth);
            if (!isNaN(value)) {
                value = ensureRange(value, 0, Number.MAX_SAFE_INTEGER);
                this.setState({ tabWidth: value });
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
                                    onClick={actions.onClickToUpload}
                                >
                                    Upload Image
                                </button>
                            </div>
                            <LaserVisiualizer widgetId="laserVisiualizer" state={state} />
                        </div>

                        <div className={styles.controlBar}>
                            { false && <div style={{ marginBottom: '20px' }}>
                                <div className="button-group">
                                    <button
                                        type="button"
                                        className={classNames('btn', 'btn-default',
                                            {
                                                'btn-select': state.mode === 'relief'
                                            })
                                        }
                                        style={{ width: '50%', margin: '0', borderRadius: '0' }}
                                        onClick={actions.onChangeRelief}
                                    >
                                        RELIEF
                                    </button>
                                    <button
                                        type="button"
                                        className={classNames('btn', 'btn-default',
                                            {
                                                'btn-select': state.mode === 'vector'
                                            })
                                        }
                                        style={{ width: '50%', margin: '0', borderRadius: '0' }}
                                        onClick={actions.onChangeVector}
                                    >
                                        VECTOR
                                    </button>
                                </div>
                            </div>}

                            {false && <hr />}

                            { state.mode === 'relief' && <Relief actions={actions} state={state} /> }
                            { state.mode === 'vector' && <Vector actions={actions} state={state} /> }

                            <hr />

                            <div style={{ marginTop: '30px' }}>
                                {(state.mode === 'vector' && state.subMode === 'raster') &&
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
