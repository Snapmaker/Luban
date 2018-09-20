import includes from 'lodash/includes';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Detector from 'three/examples/js/Detector';
import api from '../../api';
import Anchor from '../../components/Anchor';
import Widget from '../../components/Widget';
import { ensureRange } from '../../lib/numeric-utils';
import controller from '../../lib/controller';
import modal from '../../lib/modal';
import log from '../../lib/log';
import WidgetConfig from '../WidgetConfig';
import PrimaryToolbar from './PrimaryToolbar';
import SecondaryToolbar from './SecondaryToolbar';
import WorkflowControl from './WorkflowControl';
import Visualizer from './Visualizer';
// import Dashboard from './Dashboard';
import Loading from './Loading';
import Rendering from './Rendering';
import {
    // Units
    METRIC_UNITS,
    // Marlin
    MARLIN,
    // Workflow
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE,
    ACTION_LASER_MULTI_PASS_CHANGE
} from '../../constants';
import {
    CAMERA_MODE_PAN,
    CAMERA_MODE_ROTATE
} from './constants';
import styles from './index.styl';

const displayWebGLErrorMessage = () => {
    modal({
        title: 'WebGL Error Message',
        body: (
            <div>
                {window.WebGLRenderingContext &&
                <div>
                    Your graphics card does not seem to support <Anchor href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">WebGL</Anchor>.
                    <br />
                    Find out how to get it <Anchor href="http://get.webgl.org/">here</Anchor>.
                </div>
                }
                {!window.WebGLRenderingContext &&
                <div>
                    Your browser does not seem to support <Anchor href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">WebGL</Anchor>.
                    <br />
                    Find out how to get it <Anchor href="http://get.webgl.org/">here</Anchor>.
                </div>
                }
            </div>
        )
    });
};

class VisualizerWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired
    };

    config = new WidgetConfig(this.props.widgetId);
    state = this.getInitialState();
    pauseStatus = {
        headStatus: 'off',
        headPower: 0
    };

    actions = {
        uploadFile: (gcode, meta) => {
            const { name, renderMethod = 'line' } = { ...meta };

            this.setState(state => ({
                gcode: {
                    ...state.gcode,
                    name,
                    renderMethod,
                    content: gcode,
                    uploadState: 'idle',
                    renderState: 'idle',
                    ready: false
                }
            }), () => {
                this.actions.uploadGcodeToController();

                this.actions.renderGcode();
            });
        },
        uploadGcodeToController: async () => {
            // Upload G-code to controller if connected
            const { port } = this.state;
            if (!port) {
                return;
            }

            const { name, content } = this.state.gcode;
            if (!content) {
                return;
            }

            this.setState(state => ({
                gcode: {
                    ...state.gcode,
                    uploadState: 'uploading'
                }
            }));

            try {
                await api.loadGCode({ port, name, gcode: content });

                this.setState(state => ({
                    gcode: {
                        ...state.gcode,
                        uploadState: 'uploaded',
                        ready: state.gcode.renderState === 'rendered'
                    }
                }));
            } catch (e) {
                this.setState({
                    gcode: {
                        ...this.state.gcode,
                        uploadState: 'idle',
                        renderState: 'idle',
                        ready: false
                    }
                });

                log.error('Failed to upload G-code to controller');
            }
        },
        renderGcode: () => {
            this.setState(state => ({
                gcode: {
                    ...state.gcode,
                    renderState: 'rendering',
                    bbox: {
                        min: {
                            x: 0,
                            y: 0,
                            z: 0
                        },
                        max: {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    }
                }
            }), () => {
                // Clear gcode bounding box
                controller.context = {
                    ...controller.context,
                    xmin: 0,
                    xmax: 0,
                    ymin: 0,
                    ymax: 0,
                    zmin: 0,
                    zmax: 0
                };

                setTimeout(() => {
                    const { name, renderMethod, content } = this.state.gcode;
                    this.visualizer.load(name, renderMethod, content, ({ bbox }) => {
                        // Set gcode bounding box
                        controller.context = {
                            ...controller.context,
                            xmin: bbox.min.x,
                            xmax: bbox.max.x,
                            ymin: bbox.min.y,
                            ymax: bbox.max.y,
                            zmin: bbox.min.z,
                            zmax: bbox.max.z
                        };

                        pubsub.publish('gcode:bbox', bbox);

                        this.setState(state => ({
                            gcode: {
                                ...state.gcode,
                                renderState: 'rendered',
                                ready: state.uploadState === 'uploaded',
                                bbox: bbox
                            }
                        }));
                    });
                }, 0);
            });
        },
        unloadGcode: () => {
            const visualizer = this.visualizer;
            if (visualizer) {
                visualizer.unload();
            }

            // Clear gcode bounding box
            controller.context = {
                ...controller.context,
                xmin: 0,
                xmax: 0,
                ymin: 0,
                ymax: 0,
                zmin: 0,
                zmax: 0
            };

            this.setState({
                gcode: {
                    ...this.state.gcode,
                    uploadState: 'idle',
                    renderState: 'idle',
                    ready: false,
                    content: '',
                    bbox: {
                        min: {
                            x: 0,
                            y: 0,
                            z: 0
                        },
                        max: {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    },
                    workPosition: {
                        x: '0.000',
                        y: '0.000',
                        z: '0.000'
                    }
                }
            });
        },
        isCNC: () => {
            return (this.state.controller.state.headType === 'CNC');
        },
        handleRun: () => {
            const { workflowState } = this.state;
            console.assert(includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATE_PAUSED], workflowState));

            if (workflowState === WORKFLOW_STATE_IDLE) {
                // handle laser multi-pass
                const { enableMultiPass = false, passTimes = 1, stepDepth = 0 } = this.state.gcode.multiPassInfos;
                if (enableMultiPass) {
                    try {
                        const { port } = this.state;
                        let { name, content } = this.state.gcode;
                        content = this.getGcodeContentForMultiPass(content, passTimes, stepDepth);
                        api.loadGCode({ port, name, gcode: content }).then((res) => {
                            controller.command('gcode:start');
                        });
                    } catch (e) {
                        this.setState({
                            gcode: {
                                ...this.state.gcode,
                                uploadState: 'idle',
                                renderState: 'idle',
                                ready: false
                            }
                        });
                        log.error('Failed to upload G-code(multi-pass) to controller');
                    }
                } else {
                    controller.command('gcode:start');
                }
            }
            if (workflowState === WORKFLOW_STATE_PAUSED) {
                if (this.pauseStatus.headStatus === 'on') {
                    const powerPercent = ensureRange(this.pauseStatus.headPower, 0, 100);
                    const powerStrength = Math.floor(powerPercent * 255 / 100);
                    controller.command('gcode', `M3 P${powerPercent} S${powerStrength}`);
                }

                if (this.actions.isCNC()) {
                    log.debug('This is CNC Machine, resume need to wait 500ms to let toolhead started');
                    setTimeout(() => {
                        controller.command('gcode:resume');
                    }, 1000);
                } else {
                    controller.command('gcode:resume');
                }
            }
        },
        try: () => {
            // delay 500ms to let buffer executed. and status propagated
            setTimeout(() => {
                if (this.state.gcode.received >= this.state.gcode.sent) {
                    this.pauseStatus = {
                        headStatus: this.state.controller.state.headStatus,
                        headPower: this.state.controller.state.headPower
                    };

                    if (this.pauseStatus.headStatus === 'on') {
                        controller.command('gcode', 'M5');
                    }
                } else {
                    this.actions.try();
                }
            }, 50);
        },
        handlePause: () => {
            const { workflowState } = this.state;
            console.assert(includes([WORKFLOW_STATE_RUNNING], workflowState));

            controller.command('gcode:pause');

            this.actions.try();
        },
        handleStop: () => {
            const { workflowState } = this.state;
            console.assert(includes([WORKFLOW_STATE_PAUSED], workflowState));

            controller.command('gcode:stop');
        },
        handleClose: () => {
            const { workflowState } = this.state;
            console.assert(includes([WORKFLOW_STATE_IDLE], workflowState));

            controller.command('gcode:unload');

            pubsub.publish('gcode:unload'); // Unload the G-code
        },
        setBoundingBox: (bbox) => {
            this.setState({
                gcode: {
                    ...this.state.gcode,
                    bbox: bbox
                }
            });
        },
        /*
        toggle3DView: () => {
            if (!Detector.webgl && this.state.disabled) {
                displayWebGLErrorMessage();
                return;
            }

            this.setState({
                disabled: !this.state.disabled
            });
        },
        */
        toPerspectiveProjection: (projection) => {
            this.setState({
                projection: 'perspective'
            });
        },
        toOrthographicProjection: (projection) => {
            this.setState({
                projection: 'orthographic'
            });
        },
        toggleGCodeFilename: () => {
            this.setState({
                gcode: {
                    ...this.state.gcode,
                    displayName: !this.state.gcode.displayName
                }
            });
        },
        toggleCoordinateSystemVisibility: () => {
            this.setState({
                objects: {
                    ...this.state.objects,
                    coordinateSystem: {
                        ...this.state.objects.coordinateSystem,
                        visible: !this.state.objects.coordinateSystem.visible
                    }
                }
            });
        },
        toggleToolheadVisibility: () => {
            this.setState({
                objects: {
                    ...this.state.objects,
                    toolhead: {
                        ...this.state.objects.toolhead,
                        visible: !this.state.objects.toolhead.visible
                    }
                }
            });
        },
        camera: {
            toRotateMode: () => {
                this.setState({ cameraMode: CAMERA_MODE_ROTATE });
            },
            toPanMode: () => {
                this.setState({ cameraMode: CAMERA_MODE_PAN });
            },
            zoomIn: () => {
                if (this.visualizer) {
                    this.visualizer.zoomIn();
                }
            },
            zoomOut: () => {
                if (this.visualizer) {
                    this.visualizer.zoomOut();
                }
            },
            panUp: () => {
                if (this.visualizer) {
                    this.visualizer.panUp();
                }
            },
            panDown: () => {
                if (this.visualizer) {
                    this.visualizer.panDown();
                }
            },
            panLeft: () => {
                if (this.visualizer) {
                    this.visualizer.panLeft();
                }
            },
            panRight: () => {
                if (this.visualizer) {
                    this.visualizer.panRight();
                }
            },
            lookAtCenter: () => {
                if (this.visualizer) {
                    this.visualizer.lookAtCenter();
                }
            }
        }
    };
    getGcodeContentForMultiPass(gcodeContent, passTimes, stepDepth) {
        let result = gcodeContent + '\n';
        for (let i = 0; i < passTimes - 1; i++) {
            result += ';start: for laser multi-pass, pass index is ' + (i + 2) + '\n';
            result += 'G0 F150\n';
            // todo: switch G21/G20, inch or mm
            result += 'G91\n'; // relative positioning
            result += 'G0 Z-' + stepDepth + '\n';
            result += 'G90\n'; // absolute positioning
            result += 'G92 Z0\n'; // set position z to 0
            result += ';end\n\n';
            result += gcodeContent + '\n';
        }
        return result;
    }
    controllerEvents = {
        'serialport:open': (options) => {
            const { port } = options;
            this.setState({ port: port }, () => {
                this.actions.uploadGcodeToController();
            });
        },
        'serialport:close': (options) => {
            // reset state related to port and controller
            this.setState(state => ({
                port: controller.port,
                units: METRIC_UNITS,
                controller: {
                    type: controller.type,
                    state: controller.state
                },
                workflowState: controller.workflowState,
                workPosition: { // Work position
                    x: '0.000',
                    y: '0.000',
                    z: '0.000'
                },
                gcode: {
                    ...state.gcode,
                    uploadState: 'idle'
                }
            }));
        },
        'sender:status': (data) => {
            const { name, size, total, sent, received } = data;
            this.setState({
                gcode: {
                    ...this.state.gcode,
                    name,
                    size,
                    total,
                    sent,
                    received
                }
            });
        },
        'workflow:state': (workflowState) => {
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState: workflowState });
            }
        },
        // FIXME
        'Marlin:state': (state) => {
            const { pos } = { ...state };

            this.setState({
                controller: {
                    type: MARLIN,
                    state: state
                },
                workPosition: {
                    ...this.state.workPosition,
                    ...pos
                }
            });
        }
    };
    pubsubTokens = [];

    // refs
    visualizer = null;

    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();

        if (!Detector.webgl && !this.state.disabled) {
            displayWebGLErrorMessage();

            setTimeout(() => {
                this.setState({ disabled: true });
            }, 0);
        }
    }
    componentWillUnmount() {
        this.unsubscribe();
        this.removeControllerEvents();
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.disabled !== prevState.disabled) {
            this.config.set('disabled', this.state.disabled);
        }
        if (this.state.projection !== prevState.projection) {
            this.config.set('projection', this.state.projection);
        }
        if (this.state.cameraMode !== prevState.cameraMode) {
            this.config.set('cameraMode', this.state.cameraMode);
        }
        if (this.state.gcode.displayName !== prevState.gcode.displayName) {
            this.config.set('gcode.displayName', this.state.gcode.displayName);
        }
        if (this.state.objects.coordinateSystem.visible !== prevState.objects.coordinateSystem.visible) {
            this.config.set('objects.coordinateSystem.visible', this.state.objects.coordinateSystem.visible);
        }
        if (this.state.objects.toolhead.visible !== prevState.objects.toolhead.visible) {
            this.config.set('objects.toolhead.visible', this.state.objects.toolhead.visible);
        }
    }
    getInitialState() {
        log.debug('Visual Initialized');
        return {
            port: controller.port,
            units: METRIC_UNITS,
            controller: {
                type: controller.type,
                state: controller.state
            },
            workflowState: controller.workflowState,
            workPosition: { // Work position
                x: '0.000',
                y: '0.000',
                z: '0.000'
            },
            gcode: {
                displayName: this.config.get('gcode.displayName', true),
                uploadState: 'idle', // idle, uploading, uploaded
                renderState: 'idle', // idle, rendering, rendered
                ready: false,
                content: '',
                bbox: {
                    min: {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    max: {
                        x: 0,
                        y: 0,
                        z: 0
                    }
                },
                // Updates by the "sender:status" event
                name: '',
                size: 0,
                total: 0,
                sent: 0,
                received: 0,
                // only for laser multi-pass
                multiPassInfos: {
                    enableMultiPass: false,
                    passTimes: 1,
                    stepDepth: 0
                }
            },
            disabled: this.config.get('disabled', false),
            projection: this.config.get('projection', 'orthographic'),
            objects: {
                coordinateSystem: {
                    visible: this.config.get('objects.coordinateSystem.visible', true)
                },
                toolhead: {
                    visible: this.config.get('objects.toolhead.visible', true)
                }
            },
            cameraMode: this.config.get('cameraMode', CAMERA_MODE_PAN),
            isAgitated: false // Defaults to false
        };
    }
    subscribe() {
        const tokens = [
            pubsub.subscribe('gcode:upload', (msg, { gcode, meta }) => {
                const actions = this.actions;
                actions.uploadFile(gcode, meta);
            }),
            pubsub.subscribe('gcode:uploaded', (msg) => {
                // workaround for upload G-code through dragging (in Workspace.jsx), refactor this later
                this.setState(state => ({
                    gcode: {
                        ...state.gcode,
                        uploadState: 'unloaded'
                    }
                }));
            }),
            pubsub.subscribe('gcode:render', (msg, { name, gcode }) => {
                const actions = this.actions;
                this.setState(state => ({
                    gcode: {
                        ...state.gcode,
                        name: name,
                        content: gcode
                    }
                }), () => {
                    actions.renderGcode();
                });
            }),
            pubsub.subscribe('gcode:unload', (msg) => {
                const actions = this.actions;
                actions.unloadGcode();
            }),
            pubsub.subscribe(ACTION_LASER_MULTI_PASS_CHANGE, (msg, data) => {
                const { enableMultiPass = false, passTimes = 1, stepDepth = 0 } = data;
                this.setState(state => ({
                    gcode: {
                        ...state.gcode,
                        multiPassInfos: {
                            enableMultiPass: enableMultiPass,
                            passTimes: passTimes,
                            stepDepth: stepDepth
                        }
                    }
                }));
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }
    unsubscribe() {
        this.pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
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
    isAgitated() {
        const { workflowState, disabled, objects } = this.state;

        if (workflowState !== WORKFLOW_STATE_RUNNING) {
            return false;
        }
        // Return false when 3D view is disabled
        if (disabled) {
            return false;
        }
        // Return false when toolhead is not visible
        return objects.toolhead.visible;
    }
    render() {
        const state = {
            ...this.state,
            isAgitated: this.isAgitated()
        };
        const actions = {
            ...this.actions
        };
        const isLoading = state.gcode.uploadState === 'uploading' || state.gcode.renderState === 'rendering';
        const capable = {
            view3D: Detector.webgl && !state.disabled
        };

        return (
            <Widget borderless>
                <Widget.Header className={styles['widget-header']} fixed>
                    <PrimaryToolbar
                        state={state}
                        actions={actions}
                    />
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles['widget-content'],
                        { [styles.view3D]: capable.view3D }
                    )}
                >
                    {state.gcode.uploadState === 'uploading' &&
                    <Loading />
                    }
                    {state.gcode.renderState === 'rendering' &&
                    <Rendering />
                    }
                    <WorkflowControl
                        state={state}
                        actions={actions}
                    />
                    {Detector.webgl &&
                    <Visualizer
                        show={capable.view3D && !isLoading}
                        ref={node => {
                            this.visualizer = node;
                        }}
                        state={state}
                    />
                    }
                </Widget.Content>
                {capable.view3D &&
                <Widget.Footer className={styles['widget-footer']}>
                    <SecondaryToolbar
                        state={state}
                        actions={actions}
                    />
                </Widget.Footer>
                }
            </Widget>
        );
    }
}

export default VisualizerWidget;
