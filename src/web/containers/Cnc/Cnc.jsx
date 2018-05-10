import path from 'path';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import Sortable from 'react-sortablejs';
import classNames from 'classnames';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import log from '../../lib/log';
import i18n from '../../lib/i18n';
import { ensureRange } from '../../lib/numeric-utils';
import {
    MARLIN,
    WEB_CACHE_IMAGE,
    BOUND_SIZE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_VECTOR_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    ACTION_REQ_PREVIEW_CNC,
    ACTION_REQ_GENERATE_GCODE_CNC,
    ACTION_CHANGE_STAGE_CNC,
    ACTION_CHANGE_IMAGE_CNC,
    ACTION_CHANGE_TOOL,
    ACTION_CHANGE_PATH,
    ACTION_CHANGE_GENERATE_GCODE_CNC
} from '../../constants';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import styles from './index.styl';


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

                const imageInfo = {
                    originSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    imageSrc: `${WEB_CACHE_IMAGE}/${image.filename}`,
                    originWidth: image.width,
                    originHeight: image.height,
                    sizeWidth: width,
                    sizeHeight: height
                };

                this.setState(imageInfo);
                pubsub.publish(ACTION_CHANGE_IMAGE_CNC, imageInfo);

                this.setState({ stage: STAGE_IMAGE_LOADED });
                pubsub.publish(ACTION_CHANGE_STAGE_CNC, { stage: STAGE_IMAGE_LOADED });
            });
        },

        onLoadGcode: () => {
            const gcodePath = `${WEB_CACHE_IMAGE}/${this.state.gcodePath}`;
            document.location.href = '/#/workspace';
            window.scrollTo(0, 0);
            jQuery.get(gcodePath, (result) => {
                pubsub.publish('gcode:upload', { gcode: result, meta: { name: gcodePath } });
            });
        },
        onExport: () => {
            // https://stackoverflow.com/questions/3682805/javascript-load-a-page-on-button-click
            const gcodePath = this.state.gcodePath;
            const filename = path.basename(gcodePath);
            document.location.href = '/api/gcode/download_cache?filename=' + filename;
        }
    };

    controllerEvents = {
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

    subscriptions = [];

    componentDidMount() {
        this.addControllerEvents();
        this.subscribe();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.unsubscribe();
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

    subscribe() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_TOOL, (msg, data) => {
                this.setState(data);
            }),
            pubsub.subscribe(ACTION_CHANGE_PATH, (msg, data) => {
                this.setState(data);
            }),
            pubsub.subscribe(ACTION_CHANGE_GENERATE_GCODE_CNC, (msg, data) => {
                this.setState(data);
            }),
            pubsub.subscribe(ACTION_REQ_PREVIEW_CNC, () => {
                // TODO: draw outline of polygon and show
                this.setState({ stage: STAGE_PREVIEWED });
                pubsub.publish(ACTION_CHANGE_STAGE_CNC, { stage: STAGE_PREVIEWED });
            }),
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_CNC, () => {
                // controller.generateGcode(this.state);
                // TODO: avoid use this.state
                api.generateGCode(this.state).then((res) => {
                    const { gcodePath } = res.body;
                    this.setState({
                        stage: STAGE_GENERATED,
                        gcodePath: gcodePath
                    });
                    pubsub.publish(ACTION_CHANGE_STAGE_CNC, { stage: STAGE_GENERATED });
                });
            })
        ];
    }

    unsubscribe() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    getInitialState() {
        return {
            widgets: ['cnc-tool', 'cnc-path', 'cnc-generate-gcode'],

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
            isReady: false, // Connection open, ready to load G-code
            isPrinting: false, // Prevent CPU-critical job during printing

            // tool parameters
            toolDiameter: 3.175, // tool diameter (in mm)
            toolAngle: 30, // tool angle (in degree, defaults to 30° for V-Bit)

            // path parameters
            pathType: 'outline', // default
            targetDepth: 2.2,
            stepDown: 0.8,
            safetyHeight: 3,
            stopHeight: 10,
            alignment: 'clip',
            optimizePath: true,
            // tab
            enableTab: false,
            tabWidth: 2,
            tabHeight: -1,
            tabSpace: 24,

            // G-code parameters
            jogSpeed: 800,
            workSpeed: 300,
            plungeSpeed: 500
        };
    }

    render() {
        const style = this.props.style;
        const state = { ...this.state };
        const actions = { ...this.actions };

        const widgets = this.state.widgets
            .map((widgetId) => (
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget widgetId={widgetId} />
                </div>
            ));

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
                                    title="Upload Image"
                                    onClick={actions.onClickToUpload}
                                >
                                    Upload Image
                                </button>
                            </div>
                            <LaserVisualizer widgetId="laserVisualizer" state={state} />
                        </div>

                        <form className={styles.controlBar} noValidate={true}>
                            <Sortable
                                options={{
                                    animation: 150,
                                    delay: 0,
                                    group: {
                                        name: 'cnc-control'
                                    },
                                    handle: '.sortable-handle',
                                    filter: '.sortable-filter',
                                    chosenClass: 'sortable-chosen',
                                    ghostClass: 'sortable-ghost',
                                    dataIdAttr: 'data-widget-id',
                                    onStart: () => {},
                                    onEnd: () => {}
                                }}
                                onChange={(order) => {
                                    this.setState({ widgets: order });
                                }}
                            >
                                {widgets}
                            </Sortable>

                            <div style={{ marginTop: '3px', padding: '15px' }}>
                                <button
                                    type="button"
                                    className={classNames(styles.btn, styles.btnLargeBlue)}
                                    onClick={actions.onLoadGcode}
                                    disabled={(!state.isReady || state.stage < STAGE_GENERATED) || state.isPrinting}
                                    title="Must open connection first"
                                    style={{ display: 'block', width: '100%', margin: '10px 0 10px 0' }}
                                >
                                    Load
                                </button>
                                <button
                                    type="button"
                                    className={classNames(styles.btn, styles.btnLargeBlue)}
                                    onClick={actions.onExport}
                                    disabled={state.stage < STAGE_GENERATED || state.isPrinting}
                                    style={{ display: 'block', width: '100%', margin: '10px 0 10px 0' }}
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
