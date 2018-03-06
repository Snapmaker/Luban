import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import classNames from 'classnames';
import path from 'path';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisiualizer from '../../widgets/LaserVisualizer';
import styles from './index.styl';
import Vector from './Vector';
import Relief from './Relief';

import {
    MARLIN,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWD,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT
} from '../../constants';

class Laser extends Component {
    state = this.getInitialState();

    fileInputEl = null;

    onClickToUpload() {
        this.fileInputEl.value = null;
        this.fileInputEl.click();
    }

    actions = {
        // mode
        onChangeRelief: () => {
            this.setState({
                mode: 'relief',
                stage: STAGE_PREVIEWD,
                imageSrc: DEFAULT_RASTER_IMAGE,
                originSrc: DEFAULT_RASTER_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT
            });
        },
        onChangeVector: () => {
            this.setState({
                mode: 'vector',
                stage: STAGE_PREVIEWD,
                imageSrc: DEFAULT_VECTOR_IMAGE,
                originSrc: DEFAULT_VECTOR_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT,
                subMode: 'svg'
            });
        },
        // common
        onChangeWorkSpeed: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    workSpeed: '',
                    stage: STAGE_PREVIEWD
                });
            } else {
                if (value < 1) {
                    value = 1;
                }
                this.setState({
                    ...this.state.workSpeed,
                    workSpeed: value > 3600 ? 3600 : value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onChangeJogSpeed: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    jogSpeed: '',
                    stage: STAGE_PREVIEWD
                });
            } else {
                if (value < 1) {
                    value = 1;
                }
                this.setState({
                    jogSpeed: value > 6000 ? 6000 : value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onChangeWidth: (event) => {
            const value = event.target.value;
            const scale = this.state.originHeight / this.state.originWidth;

            this.setState({
                sizeWidth: value,
                sizeHeight: value * scale,
                stage: this.state.subMode === 'svg' ? STAGE_PREVIEWD : STAGE_IMAGE_LOADED
            });
        },
        onChangeHeight: (event) => {
            const value = event.target.value;
            const scale = this.state.originHeight / this.state.originWidth;

            this.setState({
                sizeWidth: value / scale,
                sizeHeight: value,
                stage: this.state.mode === 'svg' ? STAGE_PREVIEWD : STAGE_IMAGE_LOADED
            });
        },
        onChangeFile: (event) => {
            const files = event.target.files;
            const file = files[0];
            const formdata = new FormData();
            formdata.append('image', file);

            // get width & height
            let _URL = window.URL || window.webkitURL;
            let img = new Image();
            let that = this;
            img.onload = function() {
                that.setState({
                    quality: 10,
                    originWidth: this.width,
                    originHeight: this.height,
                    sizeWidth: this.width / 10,
                    sizeHeight: this.height / 10

                });
            };
            img.src = _URL.createObjectURL(file);

            api.uploadImage(formdata).then((res) => {
                this.setState({
                    originSrc: `./images/_cache/${res.text}`,
                    imageSrc: `./images/_cache/${res.text}`,
                    stage: that.state.mode === 'vector' && this.state.subMode === 'raster' ? STAGE_IMAGE_LOADED : STAGE_PREVIEWD
                });
            });
        },
        onStopHeight: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stopHeight: '',
                    stage: STAGE_PREVIEWD
                });
            } else {
                if (value < 0) {
                    value = -value;
                }
                this.setState({
                    stopHeight: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },

        // relief
        onChangeGreyLevel: (options) => {
            this.setState({
                state: STAGE_PREVIEWD,
                greyLevel: options.value
            });
        },
        onToolDiameter: (event) => {
            const value = event.target.value;

            this.setState({
                toolDiameter: value,
                stage: STAGE_PREVIEWD
            });
        },


        // vector
        // vertor - raster
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
                stage: options.value === 'raster' ? STAGE_IMAGE_LOADED : STAGE_PREVIEWD,
                imageSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                originSrc: options.value === 'raster' ? DEFAULT_RASTER_IMAGE : DEFAULT_VECTOR_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH,
                sizeHeight: DEFAULT_SIZE_HEIGHT
            });
        },
        onPlungeSpeed: (event) => {
            const value = event.target.value;
            this.setState({
                plungeSpeed: value,
                stage: STAGE_PREVIEWD
            });
        },
        onTagetDepth: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stage: STAGE_PREVIEWD,
                    targetDepth: value.trim()
                });
            } else {
                if (value > 0) {
                    value = -value;
                }
                if (value < -10) {
                    value = -10;
                }
                this.setState({
                    targetDepth: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onStepDown: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stage: STAGE_PREVIEWD,
                    stepDown: ''
                });
            } else {
                if (value < 0) {
                    value = -value;
                }
                if (value > -this.state.targetDepth) {
                    value = -this.state.targetDepth;
                }

                this.setState({
                    stepDown: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onSafetyHeight: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stage: STAGE_PREVIEWD,
                    safetyHeight: ''
                });
            } else {
                if (value < 0) {
                    value = 0;
                }
                if (value > 10) {
                    value = 10;
                }
                this.setState({
                    safetyHeight: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onToggleEnableTab: (event) => {
            this.setState({
                enableTab: event.target.checked,
                stage: STAGE_PREVIEWD
            });
        },
        onTabHeight: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stage: STAGE_PREVIEWD,
                    tabHeight: ''
                });
            } else {
                if (value > 0) {
                    value = -value;
                }
                if (value < this.state.targetDepth) {
                    value = this.state.targetDepth;
                }
                this.setState({
                    tabHeight: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onTabSpace: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stage: STAGE_PREVIEWD,
                    tabSpace: ''
                });
            } else {
                if (value < 0) {
                    value = -value;
                }
                this.setState({
                    tabSpace: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onTabWidth: (event) => {
            let value = event.target.value;
            if (typeof value === 'string' && value.trim() === '') {
                this.setState({
                    stage: STAGE_PREVIEWD,
                    tabWidth: ''
                });
            } else {
                if (value < 0) {
                    value = -value;
                }
                this.setState({
                    tabWidth: value,
                    stage: STAGE_PREVIEWD
                });
            }
        },
        onToggleClip: (event) => {
            const checked = event.target.checked;
            this.setState({
                clip: checked,
                stage: STAGE_PREVIEWD
            });
        },
        onToggleOptimizePath: (event) => {
            const checked = event.target.checked;
            this.setState({
                optimizePath: checked,
                stage: STAGE_PREVIEWD
            });
        },
        // function
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
                stage: STAGE_PREVIEWD
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
            stage: STAGE_PREVIEWD,
            isReady: false,  // Connection open, ready to load Gcode
            isPrinting: false, // Prevent CPU-critical job during printing

            // common
            jogSpeed: 800,
            workSpeed: 300,
            originSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            imageSrc: DEFAULT_VECTOR_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH,
            sizeHeight: DEFAULT_SIZE_HEIGHT,
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
            targetDepth: -2.2,
            stepDown: 0.8,
            safetyHeight: 3,
            clip: true,
            optimizePath: true,
            // tab
            enableTab: false,
            tabWidth: 10,
            tabHeight: -1,
            tabSpace: 100
        };
    }

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

                            { state.mode === 'relief' && <Relief actions={actions} state={state} />}
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
                                    disabled={state.stage < STAGE_PREVIEWD || state.isPrinting}
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
                                  Notice: You are printing! Pause the print if you want to preview again.
                                </div>
                                }
                                {!state.isPrinting && state.stage < STAGE_IMAGE_LOADED &&
                                <div className="alert alert-success" role="alert">
                                  Please upload image!
                                </div>
                                }
                                {!state.isPrinting && state.stage === STAGE_IMAGE_LOADED &&
                                <div className="alert alert-success" role="alert">
                                  Adjust parameter then preview!
                                </div>
                                }
                                {!state.isPrinting && state.stage === STAGE_PREVIEWD &&
                                <div className="alert alert-success" role="alert">
                                  Adjust parameter then generate G-Code!
                                </div>
                                }
                                {!state.isPrinting && (!state.isReady && state.stage === STAGE_GENERATED) &&
                                <div className="alert alert-danger" role="alert">
                                    Must open connection to Load G-Code!
                                </div>
                                }
                                {!state.isPrinting && (state.isReady && state.stage === STAGE_GENERATED) &&
                                <div className="alert alert-success" role="alert">
                                    Load or export Gcode to print! Go~
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
