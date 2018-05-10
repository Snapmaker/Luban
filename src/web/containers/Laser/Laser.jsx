import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import Sortable from 'react-sortablejs';
import classNames from 'classnames';
import jQuery from 'jquery';
import pubsub from 'pubsub-js';
import path from 'path';
import i18n from '../../lib/i18n';
import {
    MARLIN,
    WEB_CACHE_IMAGE,
    STAGE_IMAGE_LOADED,
    STAGE_PREVIEWED,
    STAGE_GENERATED,
    DEFAULT_RASTER_IMAGE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    ACTION_CHANGE_STAGE_LASER,
    ACTION_CHANGE_IMAGE_LASER,
    ACTION_CHANGE_PARAMETER_LASER,
    ACTION_REQ_PREVIEW_LASER,
    ACTION_REQ_GENERATE_GCODE_LASER
} from '../../constants';
import controller from '../../lib/controller';
import api from '../../api';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import styles from './index.styl';


class Laser extends Component {
    state = this.getInitialState();

    actions = {
        // actions
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
            pubsub.subscribe(ACTION_CHANGE_IMAGE_LASER, (msg, data) => {
                this.setState(data);
                this.setState({ stage: STAGE_IMAGE_LOADED });
                pubsub.publish(ACTION_CHANGE_STAGE_LASER, { stage: STAGE_IMAGE_LOADED });
            }),
            pubsub.subscribe(ACTION_CHANGE_PARAMETER_LASER, (msg, data) => {
                this.setState(data);
                this.setState({ stage: STAGE_IMAGE_LOADED });
                pubsub.publish(ACTION_CHANGE_STAGE_LASER, { stage: STAGE_IMAGE_LOADED });
            }),
            pubsub.subscribe(ACTION_REQ_PREVIEW_LASER, () => {
                if (this.state.mode === 'vector' && this.state.subMode === 'svg') {
                    this.setState({ stage: STAGE_PREVIEWED });
                    pubsub.publish(ACTION_CHANGE_STAGE_LASER, { stage: STAGE_PREVIEWED });
                } else {
                    api.processImage(this.state).then(res => {
                        const { filename } = res.body;
                        this.setState({
                            stage: STAGE_PREVIEWED,
                            imageSrc: `${WEB_CACHE_IMAGE}/${filename}`
                        });
                        pubsub.publish(ACTION_CHANGE_STAGE_LASER, {
                            stage: STAGE_PREVIEWED,
                            imageSrc: `${WEB_CACHE_IMAGE}/${filename}`
                        });
                    });
                }
            }),
            pubsub.subscribe(ACTION_REQ_GENERATE_GCODE_LASER, () => {
                api.generateGCode(this.state).then((res) => {
                    const { gcodePath } = res.body;
                    this.setState({
                        stage: STAGE_GENERATED,
                        gcodePath: gcodePath
                    });
                    pubsub.publish(ACTION_CHANGE_STAGE_LASER, {
                        stage: STAGE_GENERATED,
                        gcodePath: gcodePath
                    });
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
            widgets: ['laser-params', 'laser-generate-gcode'],

            // ModeType
            type: 'laser',
            mode: 'bw',
            // status
            stage: STAGE_IMAGE_LOADED,
            isReady: false, // Connection open, ready to load Gcode
            isPrinting: false, // Prevent CPU-critical job during printing
            port: '-',
            // common
            jogSpeed: 1500,
            workSpeed: 288,
            originSrc: DEFAULT_RASTER_IMAGE,
            originWidth: DEFAULT_SIZE_WIDTH,
            originHeight: DEFAULT_SIZE_HEIGHT,
            imageSrc: DEFAULT_RASTER_IMAGE,
            sizeWidth: DEFAULT_SIZE_WIDTH / 10,
            sizeHeight: DEFAULT_SIZE_HEIGHT / 10,
            gcodePath: '-',
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
            alignment: 'clip',
            optimizePath: true,
            vectorThreshold: 128,
            isInvert: false,
            turdSize: 2
        };
    }

    render() {
        const style = this.props.style;
        const state = this.state;
        const actions = this.actions;

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
                            <LaserVisualizer widgetId="laserVisualizer" state={state} />
                        </div>

                        <form className={styles.controlBar} noValidate={true}>
                            <Sortable
                                options={{
                                    animation: 150,
                                    delay: 0,
                                    group: {
                                        name: 'laser-control'
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
                                    style={{ display: 'block', width: '100%', marginBottom: '10px' }}
                                >
                                    Load
                                </button>
                                <button
                                    type="button"
                                    className={classNames(styles.btn, styles.btnLargeBlue)}
                                    onClick={actions.onExport}
                                    disabled={state.stage < STAGE_GENERATED || state.isPrinting}
                                    style={{ display: 'block', width: '100%', marginBottom: '10px', marginLeft: 'auto' }}
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
