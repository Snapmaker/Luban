import classNames from 'classnames';
import pubsub from 'pubsub-js';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import Detector from 'three/examples/js/Detector';
import Anchor from '../../components/Anchor';
import Widget from '../../components/Widget';
import controller from '../../lib/controller';
import modal from '../../lib/modal';
import WidgetConfig from '../WidgetConfig';
import PrimaryToolbar from './PrimaryToolbar';
import SecondaryToolbar from './SecondaryToolbar';
import Visualizer from './Visualizer';
import log from '../../lib/log';

import {
    // Units
    METRIC_UNITS
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

class LaserVisualizerWidget extends Component {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        state: PropTypes.object
    };

    config = new WidgetConfig(this.props.widgetId);
    state = this.getInitialState();
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
        }
    };
    // refs
    widgetContent = null;
    visualizer = null;

    componentDidMount() {
        this.addControllerEvents();

        if (!Detector.webgl && !this.state.disabled) {
            displayWebGLErrorMessage();

            setTimeout(() => {
                this.setState({ disabled: true });
            }, 0);
        }
    }
    componentWillUnmount() {
        this.removeControllerEvents();
    }
    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.disabled !== prevState.disabled) {
            this.config.set('laser.disabled', this.state.disabled);
        }
        if (this.state.projection !== prevState.projection) {
            this.config.set('laser.projection', this.state.projection);
        }
        if (this.state.cameraMode !== prevState.cameraMode) {
            this.config.set('laser.cameraMode', this.state.cameraMode);
        }
        if (this.state.objects.coordinateSystem.visible !== prevState.objects.coordinateSystem.visible) {
            this.config.set('laser.objects.coordinateSystem.visible', this.state.objects.coordinateSystem.visible);
        }
    }
    getInitialState() {
        log.debug('Visiual Initialized');
        return {
            port: controller.port,
            units: METRIC_UNITS,
            modal: {
                name: '',
                params: {}
            },
            workflowState: controller.workflowState,

            disabled: this.config.get('laser.disabled', false),
            projection: this.config.get('laser.projection', 'orthographic'),
            objects: {
                coordinateSystem: {
                    visible: this.config.get('laser.objects.coordinateSystem.visible', true)
                }
            },
            cameraMode: this.config.get('laser.cameraMode', CAMERA_MODE_PAN)
        };
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
    render() {
        const state = {
            ...this.props.state,
            ...this.state
        };
        const actions = {
            ...this.actions
        };
        const capable = {
            view3D: Detector.webgl
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
                    {Detector.webgl &&
                    <Visualizer
                        show={capable.view3D}
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

export default LaserVisualizerWidget;
