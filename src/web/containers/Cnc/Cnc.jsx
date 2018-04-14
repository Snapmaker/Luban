import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import classNames from 'classnames';
import path from 'path';
import log from '../../lib/log';
import i18n from '../../lib/i18n';
import { ensureRange, toFixed } from '../../lib/numeric-utils';
import {
    MARLIN,
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
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
import LaserVisualizer from '../../widgets/LaserVisualizer';
import styles from './index.styl';
import Vector from './Vector';
import ToolParameters from './ToolParameters';


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
                this.setState({
                    stage: STAGE_IMAGE_LOADED,
                    originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: width,
                    sizeHeight: height
                });
            });
        },
        // -- Model Parameters --
        onChangeRelief: () => {
            this.setState({
                mode: 'relief',
                stage: STAGE_PREVIEWED,
                imageSrc: DEFAULT_RASTER_IMAGE,
                originSrc: DEFAULT_RASTER_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                sizeHeight: DEFAULT_SIZE_HEIGHT / 10
            });
        },
        // mode: vector (we support SVG currently)
        onChangeVector: () => {
            this.setState({
                mode: 'vector',
                stage: STAGE_PREVIEWED,
                imageSrc: DEFAULT_VECTOR_IMAGE,
                originSrc: DEFAULT_VECTOR_IMAGE,
                sizeWidth: DEFAULT_SIZE_WIDTH / 10,
                sizeHeight: DEFAULT_SIZE_HEIGHT / 10
            });
        },
        // carve width (in mm)
        onChangeWidth: (width) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const height = toFixed(width * ratio, 2);
            if (height < 1 || height > BOUND_SIZE) {
                return false;
            }

            this.setState({
                stage: STAGE_IMAGE_LOADED,
                sizeWidth: width,
                sizeHeight: height
            });
            return true;
        },
        // carve height (in mm)
        onChangeHeight: (height) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const width = height / ratio;
            if (width <= 0 || width > BOUND_SIZE) {
                return false;
            }

            this.setState({
                stage: STAGE_IMAGE_LOADED,
                sizeWidth: width,
                sizeHeight: height
            });
            return true;
        },

        // -- Tool Parameters --
        // tool diameter (in mm)
        onChangeToolDiameter: (toolDiameter) => {
            this.setState({ stage: STAGE_IMAGE_LOADED, toolDiameter });
            return true;
        },
        onChangeToolAngle: (toolAngle) => {
            this.setState({ stage: STAGE_IMAGE_LOADED, toolAngle });
            return true;
        },
        onChangeJogSpeed: (jogSpeed) => {
            this.setState({ jogSpeed });
            return true;
        },
        onChangeWorkSpeed: (workSpeed) => {
            this.setState({ workSpeed });
            return true;
        },
        onChangePlungeSpeed: (plungeSpeed) => {
            this.setState({ plungeSpeed });
            return true;
        },

        // -- Carve Parameters --

        // relief
        /*
        onChangeGreyLevel: (options) => {
            this.setState({
                state: STAGE_PREVIEWED,
                greyLevel: options.value
            });
        },*/

        onChangePathType: (options) => {
            this.setState({
                stage: STAGE_IMAGE_LOADED,
                pathType: options.value
            });
        },
        onChangeTargetDepth: (targetDepth) => {
            // TODO: update targetDepth to the height of material (if we can set material parameters)
            if (targetDepth > BOUND_SIZE) {
                return false;
            }
            this.setState({
                stage: STAGE_IMAGE_LOADED,
                targetDepth
            });
            // TODO: use subscription pattern on changes of dependencies
            if (targetDepth < this.state.stepDown) {
                this.setState({ stepDown: targetDepth });
            }
            if (-targetDepth > this.state.tabHeight) {
                this.setState({ tabHeight: -targetDepth });
            }
            return true;
        },
        onChangeStepDown: (stepDown) => {
            this.setState({ stepDown });
            return true;
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.setState({ safetyHeight });
            return true;
        },
        onChangeStopHeight: (stopHeight) => {
            this.setState({ stopHeight });
            return true;
        },
        onToggleEnableTab: (event) => {
            this.setState({
                stage: STAGE_PREVIEWED,
                enableTab: event.target.checked
            });
        },
        onTabHeight: (tabHeight) => {
            this.setState({ tabHeight });
            return true;
        },
        onTabSpace: (tabSpace) => {
            this.setState({ tabSpace });
            return true;
        },
        onTabWidth: (tabWidth) => {
            this.setState({ tabWidth });
            return true;
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
                stage: STAGE_PREVIEWED,
                optimizePath: checked
            });
        },
        // Stage functions
        onChangePreview: () => {
            // TODO: draw outline of polygon and show
            this.setState({ stage: STAGE_PREVIEWED });

            // raster preview
            // controller.generateImage(this.state);
        },
        onChangeGcode: () => {
            // controller.generateGcode(this.state);
            // TODO: avoid use this.state
            api.generateGCode(this.state).then((res) => {
                const { gcodePath } = { ...res.body };
                this.setState({
                    ...this.state,
                    stage: STAGE_GENERATED,
                    gcodePath: gcodePath
                });
            });
        },
        onLoadGcode: () => {
            const gcodePath = `${WEB_CACHE_IMAGE}/${this.state.gcodePath}`;
            location.href = '/#/workspace';
            window.scrollTo(0, 0);
            jQuery.get(gcodePath, (result) => {
                pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodePath } });
            });
        },
        onExport: () => {
            // https://stackoverflow.com/questions/3682805/javascript-load-a-page-on-button-click
            const gcodePath = this.state.gcodePath;
            const filename = path.basename(gcodePath);
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
            // model parameters
            type: 'cnc',
            mode: 'vector',

            // common
            originSrc: DEFAULT_VECTOR_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            imageSrc: DEFAULT_VECTOR_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
            gcodePath: '-',
            port: '-',

            // status
            stage: STAGE_IMAGE_LOADED,
            isReady: false,  // Connection open, ready to load G-code
            isPrinting: false, // Prevent CPU-critical job during printing

            // tool parameters
            toolDiameter: 3.175, // tool diameter (in mm)
            toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)
            jogSpeed: 800,
            workSpeed: 300,
            plungeSpeed: 500,

            // carve parameters
            pathType: 'outline', // default
            // relief
            // greyLevel: '16',

            // vector
            // vector - raster
            // vectorThreshold: 128,
            // turdSize: 2,
            // isInvert: false,
            // vector - svg
            targetDepth: 2.2,
            stepDown: 0.8,
            safetyHeight: 3,
            stopHeight: 10,
            clip: true,
            optimizePath: true,
            // tab
            enableTab: false,
            tabWidth: 2,
            tabHeight: -1,
            tabSpace: 24
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
                                    accept={state.mode === 'vector' ? '.svg' : '.png, .jpg, .jpeg, .bmp'}
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
                            <LaserVisualizer widgetId="laserVisiualizer" state={state} />
                        </div>

                        <form className={styles.controlBar} noValidate={true}>
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
                            </div> }

                            <ToolParameters actions={actions} state={state} />

                            <hr />

                            { state.mode === 'vector' && <Vector actions={actions} state={state} /> }

                            <hr />

                            <div style={{ marginTop: '30px' }}>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onChangePreview}
                                    disabled={state.stage < STAGE_IMAGE_LOADED || state.isPrinting}
                                    style={{
                                        display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', marginTop: '10px', marginBottom: '10px'
                                    }}
                                >
                                    Preview
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onChangeGcode}
                                    disabled={state.stage < STAGE_PREVIEWED || state.isPrinting}
                                    style={{
                                        display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', marginTop: '10px', marginBottom: '10px'
                                    }}
                                >
                                    GenerateGCode
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onLoadGcode}
                                    disabled={(!state.isReady || state.stage < STAGE_GENERATED) || state.isPrinting}
                                    title="Must open connection first"
                                    style={{
                                        display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', marginTop: '10px', marginBottom: '10px'
                                    }}
                                >
                                    Load
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={actions.onExport}
                                    disabled={state.stage < STAGE_GENERATED || state.isPrinting}
                                    style={{
                                        display: 'block', width: '200px', marginLeft: 'auto', marginRight: 'auto', marginTop: '10px', marginBottom: '10px'
                                    }}
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
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(Laser);
