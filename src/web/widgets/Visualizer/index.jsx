import classNames from 'classnames';
import includes from 'lodash/includes';
import get from 'lodash/get';
import mapValues from 'lodash/mapValues';
import pubsub from 'pubsub-js';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import Detector from 'three/examples/js/Detector';
import api from '../../api';
import Anchor from '../../components/Anchor';
import Widget from '../../components/Widget';
import controller from '../../lib/controller';
import modal from '../../lib/modal';
import log from '../../lib/log';
import { in2mm } from '../../lib/units';
import WidgetConfig from '../WidgetConfig';
import PrimaryToolbar from './PrimaryToolbar';
import SecondaryToolbar from './SecondaryToolbar';
import WorkflowControl from './WorkflowControl';
import Visualizer from './Visualizer';
import Dashboard from './Dashboard';
import WatchDirectory from './WatchDirectory';
import Loading from './Loading';
import Rendering from './Rendering';
import {
    // Units
    IMPERIAL_UNITS,
    METRIC_UNITS,
    // Grbl
    GRBL,
    GRBL_ACTIVE_STATE_RUN,
    // Marlin
    MARLIN,
    // Smoothie
    SMOOTHIE,
    SMOOTHIE_ACTIVE_STATE_RUN,
    // TinyG
    TINYG,
    TINYG_MACHINE_STATE_RUN,
    // Workflow
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE
} from '../../constants';
import {
    CAMERA_MODE_PAN,
    CAMERA_MODE_ROTATE,
    MODAL_WATCH_DIRECTORY
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

class VisualizerWidget extends Component {
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
        openModal: (name = '', params = {}) => {
            this.setState({
                modal: {
                    name: name,
                    params: params
                }
            });
        },
        closeModal: () => {
            this.setState({
                modal: {
                    name: '',
                    params: {}
                }
            });
        },
        updateModalParams: (params = {}) => {
            this.setState({
                modal: {
                    ...this.state.modal,
                    params: {
                        ...this.state.modal.params,
                        ...params
                    }
                }
            });
        },
        // Load file from watch directory
        loadFile: (file) => {
            this.setState({
                gcode: {
                    ...this.state.gcode,
                    loading: true,
                    rendering: false,
                    ready: false
                }
            });

            controller.command('watchdir:load', file, (err, data) => {
                if (err) {
                    this.setState({
                        gcode: {
                            ...this.state.gcode,
                            loading: false,
                            rendering: false,
                            ready: false
                        }
                    });

                    log.error(err);
                    return;
                }

                const { name = '', gcode = '' } = { ...data };
                pubsub.publish('gcode:load', { name, gcode });
            });
        },
        uploadFile: (gcode, meta) => {
            const { name } = { ...meta };
            const { port } = this.state;

            this.setState({
                gcode: {
                    ...this.state.gcode,
                    loading: true,
                    rendering: false,
                    ready: false
                }
            });

            api.loadGCode({ port, name, gcode })
                .then((res) => {
                    const { name = '', gcode = '' } = { ...res.body };
                    pubsub.publish('gcode:load', { name, gcode });
                })
                .catch((res) => {
                    this.setState({
                        gcode: {
                            ...this.state.gcode,
                            loading: false,
                            rendering: false,
                            ready: false
                        }
                    });

                    log.error('Failed to upload G-code file');
                });
        },
        loadGCode: (name, gcode) => {
            const capable = {
                view3D: !!this.visualizer
            };

            const nextState = {
                gcode: {
                    ...this.state.gcode,
                    loading: false,
                    rendering: capable.view3D,
                    ready: !capable.view3D,
                    content: gcode,
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
            };

            this.setState(nextState, () => {
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

                if (!capable.view3D) {
                    return;
                }

                setTimeout(() => {
                    this.visualizer.load(name, gcode, ({ bbox }) => {
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

                        this.setState({
                            gcode: {
                                ...this.state.gcode,
                                loading: false,
                                rendering: false,
                                ready: true,
                                bbox: bbox
                            }
                        });
                    });
                }, 0);
            });
        },
        unloadGCode: () => {
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
                    loading: false,
                    rendering: false,
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
                controller.command('gcode:start');
            }
            if (workflowState === WORKFLOW_STATE_PAUSED) {
                if (this.pauseStatus.headStatus === 'on') {
                    controller.command('gcode', `M3 P${this.pauseStatus.headPower}`);
                    log.debug('Open Head');
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
            // delay 500ms to let buffer executed. and status propogated
            const that = this;
            setTimeout(() => {
                if (this.state.gcode.received >= this.state.gcode.sent) {
                    that.pauseStatus = {
                        headStatus: that.state.controller.state.headStatus,
                        headPower: that.state.controller.state.headPower
                    };

                    log.debug(that.pauseStatus);
                    if (that.pauseStatus.headStatus === 'on') {
                        controller.command('gcode', 'M5');
                        log.debug('close head');
                    }
                } else {
                    that.actions.try();
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
        toggle3DView: () => {
            if (!Detector.webgl && this.state.disabled) {
                displayWebGLErrorMessage();
                return;
            }

            this.setState({
                disabled: !this.state.disabled
            });
        },
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
    controllerEvents = {
        'serialport:open': (options) => {
            const { port } = options;
            this.setState({ port: port });
        },
        'serialport:close': (options) => {
            pubsub.publish('gcode:unload');

            const initialState = this.getInitialState();
            this.setState({ ...initialState });
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
        'Grbl:state': (state) => {
            const { status, parserstate } = { ...state };
            const { wpos } = status;
            const { modal = {} } = { ...parserstate };
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            this.setState({
                units: units,
                controller: {
                    type: GRBL,
                    state: state
                },
                workPosition: {
                    ...this.state.workPosition,
                    ...wpos
                }
            });
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
        },
        'Smoothie:state': (state) => {
            const { status, parserstate } = { ...state };
            const { wpos } = status;
            const { modal = {} } = { ...parserstate };
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            this.setState({
                units: units,
                controller: {
                    type: SMOOTHIE,
                    state: state
                },
                workPosition: {
                    ...this.state.workPosition,
                    ...wpos
                }
            });
        },
        'TinyG:state': (state) => {
            const { sr } = { ...state };
            const { wpos, modal = {} } = sr;
            const units = {
                'G20': IMPERIAL_UNITS,
                'G21': METRIC_UNITS
            }[modal.units] || this.state.units;

            // https://github.com/synthetos/g2/wiki/Status-Reports
            // Work position are reported in current units, and also apply any offsets.
            const workPosition = mapValues({
                ...this.state.workPosition,
                ...wpos
            }, (val) => {
                return (units === IMPERIAL_UNITS) ? in2mm(val) : val;
            });

            this.setState({
                units: units,
                controller: {
                    type: TINYG,
                    state: state
                },
                workPosition: workPosition
            });
        }
    };
    pubsubTokens = [];

    // refs
    widgetContent = null;
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
    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
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
        log.debug('Visiual Initialized');
        return {
            port: controller.port,
            units: METRIC_UNITS,
            controller: {
                type: controller.type,
                state: controller.state
            },
            modal: {
                name: '',
                params: {}
            },
            workflowState: controller.workflowState,
            workPosition: { // Work position
                x: '0.000',
                y: '0.000',
                z: '0.000'
            },
            gcode: {
                displayName: this.config.get('gcode.displayName', true),
                loading: false,
                rendering: false,
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
                received: 0
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
                log.debug(meta);
                actions.uploadFile(gcode, meta);
            }),
            pubsub.subscribe('gcode:load', (msg, { name, gcode }) => {
                const actions = this.actions;
                actions.loadGCode(name, gcode);
            }),
            pubsub.subscribe('gcode:unload', (msg) => {
                const actions = this.actions;
                actions.unloadGCode();
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
        const controllerType = this.state.controller.type;
        const controllerState = this.state.controller.state;

        if (workflowState !== WORKFLOW_STATE_RUNNING) {
            return false;
        }
        // Return false when 3D view is disabled
        if (disabled) {
            return false;
        }
        // Return false when toolhead is not visible
        if (!objects.toolhead.visible) {
            return false;
        }
        if (!includes([GRBL, MARLIN, SMOOTHIE, TINYG], controllerType)) {
            return false;
        }
        if (controllerType === GRBL) {
            const activeState = get(controllerState, 'status.activeState');
            if (activeState !== GRBL_ACTIVE_STATE_RUN) {
                return false;
            }
        }
        if (controllerType === MARLIN) {
            // Unsupported
        }
        if (controllerType === SMOOTHIE) {
            const activeState = get(controllerState, 'status.activeState');
            if (activeState !== SMOOTHIE_ACTIVE_STATE_RUN) {
                return false;
            }
        }
        if (controllerType === TINYG) {
            const machineState = get(controllerState, 'sr.machineState');
            if (machineState !== TINYG_MACHINE_STATE_RUN) {
                return false;
            }
        }

        return true;
    }
    render() {
        const state = {
            ...this.state,
            isAgitated: this.isAgitated()
        };
        const actions = {
            ...this.actions
        };
        const showLoader = state.gcode.loading || state.gcode.rendering;
        const capable = {
            view3D: Detector.webgl && !state.disabled
        };

        return (
            <Widget borderless>
                <Widget.Header className={styles.widgetHeader} fixed>
                    <PrimaryToolbar
                        state={state}
                        actions={actions}
                    />
                </Widget.Header>
                <Widget.Content
                    ref={node => {
                        this.widgetContent = node;
                    }}
                    className={classNames(
                        styles.widgetContent,
                        { [styles.view3D]: capable.view3D }
                    )}
                >
                    {state.gcode.loading &&
                    <Loading />
                    }
                    {state.gcode.rendering &&
                    <Rendering />
                    }
                    {state.modal.name === MODAL_WATCH_DIRECTORY &&
                    <WatchDirectory
                        state={state}
                        actions={actions}
                    />
                    }
                    <WorkflowControl
                        state={state}
                        actions={actions}
                    />
                    <Dashboard
                        show={!capable.view3D && !showLoader}
                        state={state}
                    />
                    {Detector.webgl &&
                    <Visualizer
                        show={capable.view3D && !showLoader}
                        ref={node => {
                            this.visualizer = node;
                        }}
                        state={state}
                    />
                    }
                </Widget.Content>
                {capable.view3D &&
                <Widget.Footer className={styles.widgetFooter}>
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
