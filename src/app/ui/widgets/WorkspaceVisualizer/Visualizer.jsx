import isEqual from 'lodash/isEqual';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import pubsub from 'pubsub-js';
import colornames from 'colornames';

// import { Button } from '@trendmicro/react-buttons';
import Canvas from '../../components/SMCanvas';
import styles from './index.styl';
import { controller } from '../../../lib/controller';
import {
    CONNECTION_TYPE_SERIAL,
    MACHINE_HEAD_TYPE,
    MARLIN,
    PROTOCOL_TEXT, WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING, WORKFLOW_STATUS_UNKNOWN, IMAGE_WIFI_ERROR, IMAGE_WIFI_WARNING, IMAGE_EMERGENCY_STOP
} from '../../../constants';
import { ensureRange } from '../../../lib/numeric-utils';
import TargetPoint from '../../../three-extensions/TargetPoint';
import { actions as machineActions } from '../../../flux/machine';
import { actions, WORKSPACE_STAGE } from '../../../flux/workspace';
import PrintablePlate from '../CncLaserShared/PrintablePlate';

import { loadTexture } from './helpers';
import Loading from './Loading';
import Rendering from './Rendering';
import ToolHead from './ToolHead';
import WorkflowControl from './WorkflowControl';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import ModalSmall from '../../components/Modal/ModalSmall';

import i18n from '../../../lib/i18n';
import modalSmallHOC from '../../components/Modal/modal-small';
import ProgressBar from '../../components/ProgressBar';

// import modal from '../../lib/modal';


class Visualizer extends Component {
    static propTypes = {
        // redux
        size: PropTypes.object.isRequired,
        isEnclosureDoorOpen: PropTypes.bool,
        doorSwitchCount: PropTypes.number,
        isEmergencyStopped: PropTypes.bool,

        uploadState: PropTypes.string.isRequired,
        headType: PropTypes.string,
        gcodeFile: PropTypes.object,
        boundingBox: PropTypes.object,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        workflowStatus: PropTypes.string.isRequired,
        renderState: PropTypes.string.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,
        unloadGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        setGcodePrintingIndex: PropTypes.func.isRequired,

        startServerGcode: PropTypes.func.isRequired,
        pauseServerGcode: PropTypes.func.isRequired,
        resumeServerGcode: PropTypes.func.isRequired,
        stopServerGcode: PropTypes.func.isRequired,

        gcodePrintingInfo: PropTypes.shape({
            sent: PropTypes.number
        }),
        workPosition: PropTypes.object,

        modelGroup: PropTypes.object
    };

    printableArea = null;

    visualizerGroup = { object: new THREE.Group() };

    canvas = React.createRef();

    targetPoint = null;

    toolhead = null;

    toolheadRotationAnimation = null;

    pubsubTokens = [];

    pauseStatus = {
        headStatus: false,
        headPower: 0
    };

    pause3dpStatus = {
        pausing: false,
        pos: null
    };

    state = {
        coordinateVisible: true,
        toolheadVisible: true,
        controller: {
            type: controller.type,
            state: controller.state,
            settings: controller.settings
        },
        workflowState: controller.workflowState,
        workPosition: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000'
        },
        gcode: {
            ready: false,

            // Updates by the "sender:status" event
            name: '',
            size: 0,
            total: 0,
            sent: 0,
            received: 0
        },
        showEnclosureDoorWarn: false,
        isEmergencyStopped: false
    };

    controllerEvents = {
        'serialport:open': () => {
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.props.setGcodePrintingIndex(0);
        },
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            // reset state related to port and controller
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.props.setGcodePrintingIndex(0);

            this.setState(() => ({
                controller: {
                    type: controller.type,
                    state: controller.state
                },
                workflowState: controller.workflowState
            }));

            this.unloadGcode();
        },
        // 'sender:status': (data, dataSource) => {
        'sender:status': (options) => {
            const { data, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
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
            this.props.setGcodePrintingIndex(sent);
            this.renderScene();
        },
        'workflow:state': (options) => {
            const { dataSource, workflowState } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState });
                switch (workflowState) {
                    case WORKFLOW_STATE_IDLE:
                        this.stopToolheadRotationAnimation();
                        this.updateWorkPositionToZero();
                        this.props.setGcodePrintingIndex(0);
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
        'Marlin:state': (options) => {
            const { state, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            const { pos } = state;
            this.setState({
                controller: {
                    type: MARLIN,
                    ...this.state.controller,
                    state
                }
            });
            if (this.state.workflowState === WORKFLOW_STATE_RUNNING) {
                this.updateWorkPosition(pos);
            }
        },
        'Marlin:settings': (options) => {
            const { settings, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({
                controller: {
                    type: MARLIN,
                    ...this.state.controller,
                    settings
                }
            });
        }
    };

    actions = {
        isCNC: () => {
            return (this.props.headType === MACHINE_HEAD_TYPE.CNC.value);
        },
        is3DP: () => {
            return (this.props.headType === MACHINE_HEAD_TYPE['3DP'].value);
        },
        isLaser: () => {
            return (this.props.headType === MACHINE_HEAD_TYPE.LASER.value);
        },
        handleRun: () => {
            const { connectionType } = this.props;
            if (connectionType === CONNECTION_TYPE_SERIAL) {
                const { workflowState } = this.state;

                if (workflowState === WORKFLOW_STATE_IDLE) {
                    controller.command('gcode:start');
                }
                if (workflowState === WORKFLOW_STATE_PAUSED) {
                    if (this.actions.is3DP()) {
                        this.pause3dpStatus.pausing = false;
                        const pos = this.pause3dpStatus.pos;
                        const cmd = `G1 X${pos.x} Y${pos.y} Z${pos.z} F1000\n`;
                        controller.command('gcode', cmd);
                        controller.command('gcode:resume');
                    } else if (this.actions.isLaser()) {
                        if (this.pauseStatus.headStatus) {
                            // resume laser power
                            const powerPercent = ensureRange(this.pauseStatus.headPower, 0, 100);
                            const powerStrength = Math.floor(powerPercent * 255 / 100);
                            if (powerPercent !== 0) {
                                controller.command('gcode', `M3 P${powerPercent} S${powerStrength}`);
                            } else {
                                controller.command('gcode', 'M3');
                            }
                        }

                        controller.command('gcode:resume');
                    } else {
                        if (this.pauseStatus.headStatus) {
                            // resume spindle
                            controller.command('gcode', 'M3');

                            // for CNC machine, resume need to wait >500ms to let the tool head started
                            setTimeout(() => {
                                controller.command('gcode:resume');
                            }, 1000);
                        } else {
                            controller.command('gcode:resume');
                        }
                    }
                }
            } else {
                const { workflowStatus } = this.props;
                if (workflowStatus === WORKFLOW_STATUS_IDLE) {
                    this.props.startServerGcode((err) => {
                        if (err) {
                            if (err.status === 202) {
                                modalSmallHOC({
                                    title: i18n._('Filament Runout Recovery'),
                                    text: i18n._('Filament has run out. Please load the new filament to continue printing.'),
                                    img: IMAGE_WIFI_ERROR
                                });
                            } else if (err.status === 203) {
                                modalSmallHOC({
                                    title: i18n._('Enclosure Door Open'),
                                    text: i18n._('One or both of the enclosure panels is/are opened. Please close the panel(s) to continue printing.'),
                                    subtext: i18n._('Please wait one second after you close the door to proceed.'),
                                    img: IMAGE_WIFI_WARNING
                                });
                            } else {
                                modalSmallHOC({
                                    title: i18n._(`Error ${err.status}`),
                                    text: i18n._('Unable to start the job.'),
                                    img: IMAGE_WIFI_ERROR
                                });
                            }
                        }
                    });
                }
                if (workflowStatus === WORKFLOW_STATUS_PAUSED) {
                    this.props.resumeServerGcode((err) => {
                        if (err) {
                            if (err.status === 202) {
                                modalSmallHOC({
                                    title: i18n._('Filament Runout Recovery'),
                                    text: i18n._('Filament has run out. Please load the new filament to continue printing.'),
                                    img: IMAGE_WIFI_ERROR
                                });
                            } else if (err.status === 203) {
                                modalSmallHOC({
                                    title: i18n._('Enclosure Door Open'),
                                    text: i18n._('One or both of the enclosure panels is/are opened. Please close the panel(s) to continue printing.'),
                                    subtext: i18n._('Please wait one second after you close the door to proceed.'),
                                    img: IMAGE_WIFI_WARNING
                                });
                            } else {
                                modalSmallHOC({
                                    title: i18n._(`Error ${err.status}`),
                                    text: i18n._('Unable to resume the job.'),
                                    img: IMAGE_WIFI_ERROR
                                });
                            }
                        }
                    });
                }
            }
        },
        tryPause: () => {
            // delay 500ms to let buffer executed. and status propagated
            setTimeout(() => {
                if (this.state.gcode.received >= this.state.gcode.sent) {
                    this.pauseStatus = {
                        headStatus: this.state.controller.state.headStatus,
                        headPower: this.state.controller.state.headPower
                    };

                    if (this.pauseStatus.headStatus) {
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
                        const targetZ = Math.min(pos.z + 30, this.props.size.z);
                        const cmd = [
                            `G1 F3000 E${targetE}\n`,
                            `G1 Z${targetZ} F3000\n`,
                            `G1 F100 E${pos.e}\n`
                        ];
                        controller.command('gcode', cmd);
                    }
                } else {
                    this.actions.tryPause();
                }
            }, 50);
        },
        handlePause: () => {
            const { connectionType } = this.props;
            if (connectionType === CONNECTION_TYPE_SERIAL) {
                const { workflowState } = this.state;
                if ([WORKFLOW_STATE_RUNNING].includes(workflowState)) {
                    controller.command('gcode:pause');

                    if (this.actions.is3DP()) {
                        this.pause3dpStatus.pausing = true;
                        this.pause3dpStatus.pos = null;
                    }

                    this.actions.tryPause();
                }
            } else {
                const { workflowStatus } = this.props;
                if (workflowStatus === WORKFLOW_STATUS_RUNNING) {
                    this.props.pauseServerGcode();
                }
            }
        },
        handleStop: () => {
            const { connectionType } = this.props;
            if (connectionType === CONNECTION_TYPE_SERIAL) {
                const { workflowState } = this.state;
                if ([WORKFLOW_STATE_PAUSED].includes(workflowState)) {
                    controller.command('gcode:stop');
                }
            } else {
                const { workflowStatus } = this.props;
                if (workflowStatus !== WORKFLOW_STATUS_IDLE) {
                    this.props.stopServerGcode();
                }
            }
        },
        handleClose: () => {
            // dismiss gcode file name
            this.props.clearGcode();
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_IDLE].includes(workflowState)) {
                controller.command('gcode:unload');
            }
        },
        // canvas
        switchCoordinateVisibility: () => {
            const visible = !this.state.coordinateVisible;
            this.setState(
                { coordinateVisible: visible },
                () => {
                    this.printableArea.changeCoordinateVisibility(visible);
                    this.renderScene();
                }
            );
        },
        autoFocus: () => {
            this.autoFocus();
        },
        zoomIn: () => {
            this.canvas.current.zoomIn();
        },
        zoomOut: () => {
            this.canvas.current.zoomOut();
        },

        switchToolheadVisibility: () => {
            const visible = !this.state.toolheadVisible;
            this.toolhead.visible = visible;
            this.setState({ toolheadVisible: visible });
            this.renderScene();
        },
        closeModal: () => {
            this.setState({
                // enclosure door warning
                showEnclosureDoorWarn: false,
                // emergency stop
                isEmergencyStopped: false
            });
        }
    };

    constructor(props) {
        super(props);

        const size = props.size;
        this.printableArea = new PrintablePlate({
            x: size.x * 2,
            y: size.y * 2
        });
    }

    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();
        this.setupToolhead();
        this.setupTargetPoint();
        this.visualizerGroup.object.add(this.props.modelGroup);
    }

    /**
     * Listen on props updates.
     *
     * When new G-code list received:
     *  - Re-render G-code objects
     *  - Upload G-code to controller
     */
    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size)) {
            const size = nextProps.size;
            this.printableArea.updateSize({
                x: size.x * 2,
                y: size.y * 2
            });
            this.canvas.current.setCamera(new THREE.Vector3(0, 0, Math.min(size.z * 2, 300)), new THREE.Vector3());
        }

        if (this.props.workflowStatus !== WORKFLOW_STATUS_IDLE && nextProps.workflowStatus === WORKFLOW_STATUS_IDLE) {
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.props.setGcodePrintingIndex(0);
        }
        if (this.props.workflowStatus !== WORKFLOW_STATUS_UNKNOWN && nextProps.workflowStatus === WORKFLOW_STATUS_UNKNOWN) {
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.props.setGcodePrintingIndex(0);
        }
        if (this.props.workflowStatus !== WORKFLOW_STATUS_RUNNING && nextProps.workflowStatus === WORKFLOW_STATUS_RUNNING) {
            for (let i = 0; i < nextProps.gcodePrintingInfo.sent; i++) {
                this.props.setGcodePrintingIndex(i);
            }
            this.startToolheadRotationAnimation();
            this.renderScene();
        }
        if (this.props.workflowStatus !== WORKFLOW_STATUS_PAUSED && nextProps.workflowStatus === WORKFLOW_STATUS_PAUSED) {
            this.stopToolheadRotationAnimation();
        }
        if (nextProps.gcodePrintingInfo.sent > 0 && nextProps.gcodePrintingInfo.sent !== this.props.gcodePrintingInfo.sent) {
            this.updateWorkPosition(this.props.workPosition);
            this.props.setGcodePrintingIndex(nextProps.gcodePrintingInfo.sent);
            this.renderScene();
        }
        if (nextProps.renderingTimestamp !== this.props.renderingTimestamp) {
            this.renderScene();
        }
        if (nextProps.stage !== this.props.stage && nextProps.stage === WORKSPACE_STAGE.LOAD_GCODE_SUCCEED) {
            if (nextProps.boundingBox !== null) {
                const { min, max } = nextProps.boundingBox;
                const target = new THREE.Vector3();

                target.copy(min).add(max).divideScalar(2);
                const width = new THREE.Vector3().add(min).distanceTo(new THREE.Vector3().add(max));
                const position = new THREE.Vector3(target.x, target.y, width * 2);
                this.canvas.current.setCamera(position, target);
            }
        }
        // open the enclosureDoorOpened modal
        if (nextProps.isEnclosureDoorOpen !== this.props.isEnclosureDoorOpen) {
            this.setState({
                showEnclosureDoorWarn: nextProps.isEnclosureDoorOpen
            });
        } else if (this.props.doorSwitchCount !== 0 && nextProps.doorSwitchCount !== this.props.doorSwitchCount) {
            this.setState({
                showEnclosureDoorWarn: true
            });
        }
        // open the emergencyStopped warning modal
        if (nextProps.isEmergencyStopped !== this.props.isEmergencyStopped && nextProps.isEmergencyStopped) {
            this.setState({
                isEmergencyStopped: true
            });
        }
    }

    componentWillUnmount() {
        this.unsubscribe();
        this.removeControllerEvents();
    }

    setupTargetPoint() {
        this.targetPoint = new TargetPoint({
            color: colornames('indianred'),
            radius: 0.5
        });
        this.visualizerGroup.object.add(this.targetPoint);
    }

    setupToolhead() {
        const color = colornames('silver');
        const url = 'textures/brushed-steel-texture.jpg';
        loadTexture(url, (err, texture) => {
            this.toolhead = new ToolHead(color, texture);
            this.visualizerGroup.object.add(this.toolhead);

            this.toolheadRotationAnimation = new TWEEN.Tween(this.toolhead.rotation)
                .to({ x: 0, y: 0, z: Number.MAX_VALUE }, Number.MAX_VALUE);
        });
    }

    unloadGcode() {
        this.props.unloadGcode();
    }

    subscribe() {
        const tokens = [
            pubsub.subscribe('resize', () => {
                this.canvas.current.resizeWindow();
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

    autoFocus() {
        const child = this.props.modelGroup.children[0];
        this.canvas.current.autoFocus(child);
    }

    notice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case WORKSPACE_STAGE.EMPTY:
                return '';
            case WORKSPACE_STAGE.LOADING_GCODE:
                return i18n._('Loading G-code...{{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case WORKSPACE_STAGE.LOAD_GCODE_SUCCEED:
                return i18n._('Loaded G-code successfully.');
            case WORKSPACE_STAGE.LOAD_GCODE_FAILED:
                return i18n._('Failed to load G-code.');
            default:
                return '';
        }
    }

    renderScene() {
        this.canvas.current.renderScene();
    }


    render() {
        const state = this.state;
        const notice = this.notice();
        const { gcodeFile } = this.props;

        return (
            <div style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                <div className={styles['visualizer-progress']}>
                    <ProgressBar tips={notice} progress={this.props.progress * 100} />
                </div>
                {gcodeFile !== null && (
                    <div className={styles['visualizer-info']}>
                        <p>{i18n._(gcodeFile.name)}</p>
                    </div>
                )}
                <div className={styles['canvas-wrapper']}>
                    {this.props.uploadState === 'uploading' && <Loading />}
                    {this.props.renderState === 'rendering' && <Rendering />}
                    <div className={styles['m-3']}>
                        <WorkflowControl
                            workflowStatus={this.props.workflowStatus}
                            isConnected={this.props.isConnected}
                            connectionType={this.props.connectionType}
                            state={state}
                            actions={this.actions}
                            uploadState={this.props.uploadState}
                        />
                    </div>
                    <Canvas
                        ref={this.canvas}
                        size={this.props.size}
                        modelGroup={this.visualizerGroup}
                        printableArea={this.printableArea}
                        cameraInitialPosition={new THREE.Vector3(0, 0, Math.min(this.props.size.z * 2, 300))}
                        cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                    />
                </div>
                <div className={styles['canvas-footer']}>
                    <SecondaryToolbar
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        toFront={this.actions.autoFocus}
                    />
                </div>

                {(state.isEmergencyStopped) && (
                    <ModalSmall
                        title={i18n._('Emergency Stop')}
                        text={i18n._('The network connection has been interrupted, please follow the on-screen instructions to solve the problem.')}
                        img={IMAGE_EMERGENCY_STOP}
                        onClose={this.actions.closeModal}
                    />
                )}
                {(state.showEnclosureDoorWarn) && (
                    <ModalSmall
                        title={i18n._('Enclosure Door Open')}
                        onClose={this.actions.closeModal}
                        text={i18n._('One or both of the enclosure panels is/are opened. Please close the panel(s) to continue printing.')}
                        subtext={i18n._('Please wait one second after you close the door to proceed.')}
                        img={IMAGE_WIFI_WARNING}
                    />
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const workspace = state.workspace;
    return {
        size: machine.size,
        doorSwitchCount: machine.doorSwitchCount,
        isEmergencyStopped: machine.isEmergencyStopped,
        isEnclosureDoorOpen: machine.isEnclosureDoorOpen,
        headType: machine.headType,
        workflowStatus: machine.workflowStatus,
        isConnected: machine.isConnected,
        connectionType: machine.connectionType,
        uploadState: workspace.uploadState,
        gcodeList: workspace.gcodeList,
        gcodeFile: workspace.gcodeFile,
        gcodePrintingInfo: machine.gcodePrintingInfo,
        workPosition: machine.workPosition,
        modelGroup: workspace.modelGroup,
        renderState: workspace.renderState,
        boundingBox: workspace.boundingBox,
        renderingTimestamp: workspace.renderingTimestamp,
        stage: workspace.stage,
        progress: workspace.progress
    };
};

const mapDispatchToProps = (dispatch) => ({
    clearGcode: () => dispatch(actions.clearGcode()),
    unloadGcode: () => dispatch(actions.unloadGcode()),
    setGcodePrintingIndex: (index) => dispatch(actions.setGcodePrintingIndex(index)),

    startServerGcode: (callback) => dispatch(machineActions.startServerGcode(callback)),
    pauseServerGcode: () => dispatch(machineActions.pauseServerGcode()),
    resumeServerGcode: (callback) => dispatch(machineActions.resumeServerGcode(callback)),
    stopServerGcode: () => dispatch(machineActions.stopServerGcode())
});

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
