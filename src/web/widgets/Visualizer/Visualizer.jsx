import React, { Component } from 'react';
import * as THREE from 'three';
import PropTypes from 'prop-types';
import TWEEN from '@tweenjs/tween.js';
import pubsub from 'pubsub-js';
import colornames from 'colornames';
import PrintablePlate from '../../components/PrintablePlate';
import Canvas from '../Canvas/Canvas';
import PrimaryToolbar from './PrimaryToolbar';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import WorkflowControl from './WorkflowControl';
import controller from '../../lib/controller';
import {
    MARLIN, WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING
} from '../../constants';
import { ensureRange } from '../../lib/numeric-utils';
import api from '../../api';
import log from '../../lib/log';
import GCodeVisualizer from './GCodeVisualizer';
import { getBoundingBox, loadTexture } from './helpers';
import Loading from './Loading';
import Rendering from './Rendering';
import ToolHead from './ToolHead';
import TargetPoint from './TargetPoint';
import TextSprite from './TextSprite';

const NAME_GCODE_OBJECT = 'gcode_object';


class Visualizer extends Component {
    static propTypes = {
        show: PropTypes.bool,
        state: PropTypes.object
    };

    printableArea = new PrintablePlate();
    modelGroup = new THREE.Group();
    canvas = null;

    gcodeFilenameObject = null;
    targetPoint = null;
    toolhead = null;
    toolheadRotationAnimation = null;

    pubsubTokens = [];

    gcodeVisualizer = null;

    pauseStatus = {
        headStatus: 'off',
        headPower: 0
    };

    state = {
        coordinateVisible: true,
        toolheadVisible: true,
        gcodeFilenameVisible: true,
        port: controller.port,
        controller: {
            type: controller.type,
            state: controller.state
        },
        workflowState: controller.workflowState,
        workPosition: {
            x: '0.000',
            y: '0.000',
            z: '0.000'
        },
        gcode: {
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
            received: 0
        },
        cameraProjection: 'orthographic'
    };

    controllerEvents = {
        'serialport:open': (options) => {
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.gcodeVisualizer && this.gcodeVisualizer.setFrameIndex(0);

            const { port } = options;
            this.setState({ port: port }, () => {
                this.actions.uploadGcodeToController();
            });
        },
        'serialport:close': (options) => {
            // reset state related to port and controller
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.gcodeVisualizer && this.gcodeVisualizer.setFrameIndex(0);

            this.setState(state => ({
                port: controller.port,
                controller: {
                    type: controller.type,
                    state: controller.state
                },
                workflowState: controller.workflowState,
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
            this.gcodeVisualizer && this.gcodeVisualizer.setFrameIndex(sent);
        },
        'workflow:state': (workflowState) => {
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState: workflowState });
                switch (workflowState) {
                    case WORKFLOW_STATE_IDLE:
                        this.stopToolheadRotationAnimation();
                        this.updateWorkPositionToZero();
                        this.gcodeVisualizer && this.gcodeVisualizer.setFrameIndex(0);
                        break;
                    case WORKFLOW_STATE_RUNNING:
                        this.startToolheadRotationAnimation();
                        break;
                    case WORKFLOW_STATE_PAUSED:
                        this.stopToolheadRotationAnimation();
                        break;
                    default:
                        break;
                }
            }
        },
        // FIXME
        'Marlin:state': (state) => {
            const { pos } = { ...state };
            this.setState({
                controller: {
                    type: MARLIN,
                    state: state
                }
            });
            if (this.state.workflowState === WORKFLOW_STATE_RUNNING) {
                this.updateWorkPosition(pos);
            }
        }
    };

    actions = {
        uploadFile: (gcode, meta) => {
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.gcodeVisualizer && this.gcodeVisualizer.setFrameIndex(0);

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
            this.destroyPreviousGcodeObject();
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

                    this.gcodeVisualizer = new GCodeVisualizer(renderMethod);

                    const gcodeObject = this.gcodeVisualizer.render(content);
                    gcodeObject.name = NAME_GCODE_OBJECT;
                    this.modelGroup.add(gcodeObject);

                    const bbox = getBoundingBox(gcodeObject);

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

                    // update gcode file name
                    const x = bbox.min.x + (bbox.max.x - bbox.min.x) / 2;
                    const y = bbox.min.y - 5;
                    this.updateGcodeFilename(name, x, y);
                }, 0);
            });
        },
        unloadGcode: () => {
            this.destroyPreviousGcodeObject();

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

            if (workflowState === WORKFLOW_STATE_IDLE) {
                controller.command('gcode:start');
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
            if ([WORKFLOW_STATE_RUNNING].includes(workflowState)) {
                controller.command('gcode:pause');
                this.actions.try();
            }
        },
        handleStop: () => {
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_PAUSED].includes(workflowState)) {
                controller.command('gcode:stop');
            }
        },
        handleClose: () => {
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_IDLE].includes(workflowState)) {
                this.destroyPreviousGcodeObject();
                controller.command('gcode:unload');
                pubsub.publish('gcode:unload'); // Unload the G-code
            }
        },
        // canvas
        switchCoordinateVisibility: () => {
            const visible = !this.state.coordinateVisible;
            this.setState(
                { coordinateVisible: visible },
                () => {
                    this.printableArea.changeCoordinateVisibility(visible);
                }
            );
        },
        zoomIn: () => {
            this.canvas.zoomIn();
        },
        zoomOut: () => {
            this.canvas.zoomOut();
        },
        autoFocus: () => {
            this.canvas.autoFocus();
        },
        setCameraToPerspective: () => {
            this.setState({
                cameraProjection: 'perspective'
            });
            this.canvas.setCameraToPerspective();
        },
        setCameraToOrthographic: () => {
            this.setState({
                cameraProjection: 'orthographic'
            });
            this.canvas.setCameraToOrthographic();
        },
        switchGCodeFilenameVisibility: () => {
            const visible = !this.state.gcodeFilenameVisible;
            this.setState({ gcodeFilenameVisible: visible });
            this.gcodeFilenameObject && (this.gcodeFilenameObject.visible = visible);
        },
        switchToolheadVisibility: () => {
            const visible = !this.state.toolheadVisible;
            this.toolhead.visible = visible;
            this.setState({ toolheadVisible: visible });
        }
    };

    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();
        this.setupToolhead();
        this.setupTargetPoint();
    }

    componentWillUnmount() {
        this.unsubscribe();
        this.removeControllerEvents();
    }

    subscribe() {
        const tokens = [
            pubsub.subscribe('resize', (msg) => {
                this.canvas.resizeWindow();
            }),
            pubsub.subscribe('gcode:upload', (msg, { gcode, meta }) => {
                const actions = this.actions;
                actions.uploadFile(gcode, meta);
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

    destroyPreviousGcodeObject() {
        const gcodeObject = this.modelGroup.getObjectByName(NAME_GCODE_OBJECT);
        gcodeObject && this.modelGroup.remove(gcodeObject);
        this.setState(state => ({
            gcode: {
                ...state.gcode,
                renderState: 'idle',
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
        }));
    }

    updateGcodeFilename(name, x = 0, y = 0, z = 0) {
        // remove pre
        this.gcodeFilenameObject && this.modelGroup.remove(this.gcodeFilenameObject);
        const textSize = 5;
        this.gcodeFilenameObject = new TextSprite({
            x: x,
            y: y,
            z: z,
            size: textSize,
            text: `G-code: ${name}`,
            color: colornames('gray 44'), // grid color
            opacity: 0.5
        });
        this.gcodeFilenameObject.visible = this.state.gcodeFilenameVisible;
        this.modelGroup.add(this.gcodeFilenameObject);
    }

    setupTargetPoint() {
        this.targetPoint = new TargetPoint({
            color: colornames('indianred'),
            radius: 0.5
        });
        this.modelGroup.add(this.targetPoint);
    }

    setupToolhead() {
        const color = colornames('silver');
        const url = 'textures/brushed-steel-texture.jpg';
        loadTexture(url, (err, texture) => {
            this.toolhead = new ToolHead(color, texture);
            this.modelGroup.add(this.toolhead);

            this.toolheadRotationAnimation = new TWEEN.Tween(this.toolhead.rotation)
                .to({ x: 0, y: 0, z: Number.MAX_VALUE }, Number.MAX_VALUE);
        });
    }

    startToolheadRotationAnimation() {
        this.toolheadRotationAnimation.start();
    }

    stopToolheadRotationAnimation() {
        this.toolheadRotationAnimation.stop();
    }

    updateWorkPositionToZero() {
        this.updateWorkPosition({
            x: '0.000',
            y: '0.000',
            z: '0.000'
        });
    }

    updateWorkPosition(pos) {
        this.setState({
            workPosition: {
                ...this.state.workPosition,
                ...pos
            }
        });
        let { x = 0, y = 0, z = 0 } = { ...pos };
        x = (Number(x) || 0);
        y = (Number(y) || 0);
        z = (Number(z) || 0);
        this.toolhead && this.toolhead.position.set(x, y, z);
        this.targetPoint && this.targetPoint.position.set(x, y, z);
    }

    render() {
        const state = this.state;
        const actions = this.actions;
        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
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
                    <Canvas
                        ref={node => {
                            this.canvas = node;
                        }}
                        modelGroup={this.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={false}
                        cameraZ={70}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
            </div>
        );
    }
}

export default Visualizer;
