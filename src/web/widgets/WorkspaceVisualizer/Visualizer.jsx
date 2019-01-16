import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import pubsub from 'pubsub-js';
import colornames from 'colornames';

import { Canvas, PrintablePlate } from '../Canvas';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import styles from '../styles.styl';
import controller from '../../lib/controller';
import {
    MARLIN,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING,
    BOUND_SIZE
} from '../../constants';
import { ensureRange } from '../../lib/numeric-utils';
import api from '../../api';
import log from '../../lib/log';
import TextSprite from '../../components/three-extensions/TextSprite';
import TargetPoint from '../../components/three-extensions/TargetPoint';
import { actions } from '../../reducers/modules/workspace';

import GCodeVisualizer from './GCodeVisualizer';
import { loadTexture } from './helpers';
import Loading from './Loading';
import Rendering from './Rendering';
import ToolHead from './ToolHead';
import WorkflowControl from './WorkflowControl';
import PrimaryToolbar from './PrimaryToolbar';
import FileTransitModal from './FileTransitModal';


class Visualizer extends Component {
    static propTypes = {
        show: PropTypes.bool,
        state: PropTypes.object,
        gcodeList: PropTypes.array.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired
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

    pause3dpStatus = {
        pausing: false,
        pos: null
    };

    state = {
        coordinateVisible: true,
        toolheadVisible: true,
        gcodeFilenameVisible: true,
        fileTransitModalVisible: false,
        port: controller.port,
        controller: {
            type: controller.type,
            state: controller.state
        },
        workflowState: controller.workflowState,
        workPosition: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000'
        },
        bbox: null,
        gcode: {
            uploadState: 'idle', // idle, uploading, uploaded
            renderState: 'idle', // idle, rendering, rendered
            ready: false,

            // Updates by the "sender:status" event
            name: '',
            size: 0,
            total: 0,
            sent: 0,
            received: 0
        }
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
        isCNC: () => {
            return (this.state.controller.state.headType === 'CNC');
        },
        is3DP: () => {
            return (this.state.controller.state.headType === '3DP');
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
                } else if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = false;
                    const pos = this.pause3dpStatus.pos;
                    const cmd = `G1 X${pos.x} Y${pos.y} Z${pos.z} F1800\n`;
                    controller.command('gcode', cmd);
                    controller.command('gcode:resume');
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

                    // toolhead has stopped
                    if (this.pause3dpStatus.pausing) {
                        this.pause3dpStatus.pausing = false;
                        const workPosition = this.state.workPosition;
                        this.pause3dpStatus.pos = {
                            x: Number(workPosition.x),
                            y: Number(workPosition.y),
                            z: Number(workPosition.z),
                            e: Number(workPosition.e)
                        };
                        const pos = this.pause3dpStatus.pos;
                        // experience params for retraction: F3000, E->(E-5)
                        const targetE = Math.max(pos.e - 5, 0);
                        const targetZ = Math.min(pos.z + 30, BOUND_SIZE);
                        const cmd = [
                            `G1 F3000 E${targetE}\n`,
                            `G1 Z${targetZ} F3000\n`,
                            `G1 F100 E${pos.e}\n`
                        ];
                        controller.command('gcode', cmd);
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

                if (this.actions.is3DP()) {
                    this.pause3dpStatus.pausing = true;
                    this.pause3dpStatus.pos = null;
                }

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
                // this.destroyPreviousGcodeObject();
                controller.command('gcode:unload');
                pubsub.publish('gcode:unload'); // Unload the G-code
            }
        },
        handleSend: () => {
            const { workflowState } = this.state;
            if (workflowState === WORKFLOW_STATE_IDLE) {
                this.setState({ fileTransitModalVisible: true });
            }
        },
        handleCancelSend: () => {
            if (this.state.fileTransitModalVisible) {
                this.setState({ fileTransitModalVisible: false });
            }
        },
        handleAddGcode: (name, gcode, renderMethod = 'line') => {
            this.props.clearGcode();
            this.props.addGcode(name, gcode, renderMethod);
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
        autoFocus: () => {
            this.autoFocus();
        },
        zoomIn: () => {
            this.canvas.zoomIn();
        },
        zoomOut: () => {
            this.canvas.zoomOut();
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

    async componentWillReceiveProps(nextProps) {
        if (this.props.gcodeList !== nextProps.gcodeList) {
            // re-calculate
            this.renderGcodeObjects(nextProps.gcodeList);

            // upload G-code
            await this.uploadGcode(nextProps.gcodeList);
        }
    }

    renderGcodeObjects(gcodeList) {
        gcodeList = gcodeList || this.props.gcodeList;

        // Stop animation
        this.stopToolheadRotationAnimation();
        this.updateWorkPositionToZero();
        // Remove G-code objects
        this.clearGcodeObjects();

        // Actually remove all objects
        if (gcodeList.length === 0) {
            this.setState(state => ({
                gcode: {
                    ...state.gcode,
                    renderState: 'idle',
                    uploadState: 'idle'
                }
            }));
            return;
        }

        // Change state to 'rendering'
        this.setState(state => ({
            gcode: {
                ...state.gcode,
                renderState: 'rendering'
            }
        }));

        this.gcodeVisualizer = new GCodeVisualizer();

        for (const gcodeBean of gcodeList) {
            const gcodeObject = this.gcodeVisualizer.addGcode(gcodeBean.gcode, gcodeBean.renderMethod);
            gcodeObject.name = gcodeBean.uniqueName;
            this.modelGroup.add(gcodeObject);
        }

        // Change state back to 'rendered' after a while
        setTimeout(() => this.setState(state => ({
            gcode: {
                ...state.gcode,
                renderState: 'rendered'
            }
        })), 300);

        // Auto focus on first item
        this.autoFocus(gcodeList[0].uniqueName);

        // Update bounding box & filename
        const bbox = this.calculateBoundingBox(gcodeList);
        const x = bbox.min.x + (bbox.max.x - bbox.min.x) / 2;
        const y = bbox.min.y - 5;
        this.updateGcodeFilename(gcodeList[0].name, x, y);
    }

    clearGcodeObjects() {
        for (const gcodeBean of this.props.gcodeList) {
            const gcodeObject = this.modelGroup.getObjectByName(gcodeBean.uniqueName);
            gcodeObject && this.modelGroup.remove(gcodeObject);
        }
        this.setState(state => ({
            gcode: {
                ...state.gcode,
                renderState: 'idle'
            }
        }));
    }

    autoFocus(name = '') {
        if (!name && this.props.gcodeList.length !== 0) {
            name = this.props.gcodeList[0].uniqueName;
        }
        const gcodeObject = this.modelGroup.getObjectByName(name);
        this.canvas.autoFocus(gcodeObject);
    }

    calculateBoundingBox(gcodeList) {
        const box = new THREE.Box3();

        for (const gcodeBean of gcodeList) {
            const gcodeObject = this.modelGroup.getObjectByName(gcodeBean.uniqueName);
            box.expandByObject(gcodeObject);
        }
        const bbox = { min: box.min, max: box.max };

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

        this.setState({ bbox });
        pubsub.publish('gcode:bbox', bbox);

        return bbox;
    }

    async uploadGcode(gcodeList) {
        gcodeList = gcodeList || this.props.gcodeList;

        if (gcodeList.length === 0) {
            return;
        }

        // Upload G-code to controller if connected
        const { port } = this.state;
        if (!port) {
            return;
        }

        this.setState(state => ({
            gcode: {
                ...state.gcode,
                uploadState: 'uploading'
            }
        }));

        const name = 'FIXME';
        const gcode = gcodeList.map(gcodeBean => gcodeBean.gcode).join('\n');

        try {
            await api.loadGCode({ port, name, gcode: gcode });

            this.setState(state => ({
                gcode: {
                    ...state.gcode,
                    uploadState: 'uploaded'
                }
            }));
        } catch (e) {
            this.setState({
                gcode: {
                    ...this.state.gcode,
                    uploadState: 'idle'
                }
            });

            log.error('Failed to upload G-code to controller');
        }
    }

    subscribe() {
        const tokens = [
            pubsub.subscribe('resize', (msg) => {
                this.canvas.resizeWindow();
            }),
            pubsub.subscribe('gcode:render', (msg, { name, gcode }) => {
                this.setState(state => ({
                    gcode: {
                        ...state.gcode,
                        name: name,
                        content: gcode
                    }
                }), async () => {
                    this.renderGcodeObjects();
                    await this.uploadGcode();
                });
            }),
            pubsub.subscribe('gcode:unload', (msg) => {
                controller.command('gcode:unload');
                this.props.clearGcode();
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

    updateGcodeFilename(name, x = 0, y = 0, z = 0) {
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
            z: '0.000',
            e: '0.000'
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

        return (
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                <div className={styles['canvas-header']}>
                    <PrimaryToolbar actions={this.actions} state={this.state} />
                </div>
                <div className={styles['canvas-content']}>
                    {state.gcode.uploadState === 'uploading' && <Loading />}
                    {state.gcode.renderState === 'rendering' && <Rendering />}
                    <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px' }}>
                        <WorkflowControl
                            state={state}
                            actions={this.actions}
                        />
                    </div>
                    {state.fileTransitModalVisible &&
                    <FileTransitModal gcodeName={state.gcode.name} onClose={this.actions.handleCancelSend} />}
                    <Canvas
                        ref={node => {
                            this.canvas = node;
                        }}
                        modelGroup={this.modelGroup}
                        printableArea={this.printableArea}
                        enabledTransformModel={false}
                        modelInitialRotation={new THREE.Euler()}
                        cameraInitialPosition={new THREE.Vector3(0, 0, 150)}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar actions={this.actions} />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const workspace = state.workspace;
    return {
        gcodeList: workspace.gcodeList
    };
};

const mapDispatchToProps = (dispatch) => ({
    addGcode: (name, gcode, renderMethod) => dispatch(actions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(actions.clearGcode())
});

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
