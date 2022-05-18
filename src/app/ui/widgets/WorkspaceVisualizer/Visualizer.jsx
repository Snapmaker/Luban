import isEqual from 'lodash/isEqual';
import React, { PureComponent } from 'react';
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
    MARLIN,
    PROTOCOL_TEXT,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATUS_UNKNOWN,
    IMAGE_WIFI_ERROR,
    IMAGE_WIFI_WARNING,
    HEAD_CNC,
    HEAD_PRINTING,
    HEAD_LASER
} from '../../../constants';
import TargetPoint from '../../../three-extensions/TargetPoint';
import { actions as machineActions } from '../../../flux/machine';
import { actions as workspaceActions, WORKSPACE_STAGE } from '../../../flux/workspace';
import PrintablePlate from './PrintablePlate';

import { loadTexture } from './helpers';
import Loading from './Loading';
import Rendering from './Rendering';
import ToolHead from './ToolHead';
// import WorkflowControl from './WorkflowControl';
import SecondaryToolbar from '../CanvasToolbar/SecondaryToolbar';
import ModalSmall from '../../components/Modal/ModalSmall';

import i18n from '../../../lib/i18n';
import modalSmallHOC from '../../components/Modal/modal-small';
import ProgressBar from '../../components/ProgressBar';

// import modal from '../../lib/modal';


class Visualizer extends PureComponent {
    static propTypes = {
        // redux
        isEnclosureDoorOpen: PropTypes.bool,
        doorSwitchCount: PropTypes.number,
        isEmergencyStopped: PropTypes.bool,

        laser10WErrorState: PropTypes.number,

        uploadState: PropTypes.string.isRequired,
        boundingBox: PropTypes.object,
        server: PropTypes.object.isRequired,
        connectionType: PropTypes.string.isRequired,
        workflowStatus: PropTypes.string,
        renderState: PropTypes.string.isRequired,
        renderingTimestamp: PropTypes.number.isRequired,
        stage: PropTypes.number.isRequired,
        progress: PropTypes.number.isRequired,
        unloadGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        setGcodePrintingIndex: PropTypes.func.isRequired,

        executeGcode: PropTypes.func.isRequired,
        updatePause3dpStatus: PropTypes.func.isRequired,
        pause3dpStatus: PropTypes.object,

        isRotate: PropTypes.bool,
        toolHead: PropTypes.string,
        gcodeFile: PropTypes.object,
        series: PropTypes.string,
        headType: PropTypes.string,
        size: PropTypes.object.isRequired,

        isLaserPrintAutoMode: PropTypes.bool.isRequired,
        materialThickness: PropTypes.number.isRequired,
        laserFocalLength: PropTypes.number,
        background: PropTypes.object.isRequired,
        workPosition: PropTypes.object.isRequired,
        originOffset: PropTypes.object.isRequired,

        gcodePrintingInfo: PropTypes.shape({
            sent: PropTypes.number
        }),

        modelGroup: PropTypes.object,
        onRef: PropTypes.func,
        preview: PropTypes.bool,
    };

    previewPrintableArea = null;

    visualizerGroup = { object: new THREE.Group() };

    canvas = React.createRef();

    previewCanvas = React.createRef();

    targetPoint = null;

    toolhead = null;

    toolheadRotationAnimation = null;

    pubsubTokens = [];

    pauseStatus = {
        headStatus: false,
        headPower: 0
    };

    state = {
        printableArea: null,
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
        isEmergencyStopped: false,

        isLaser10WCheck1: false,
        isLaser10WCheck2: false
    };

    controllerEvents = {
        'connection:open': () => {
            this.stopToolheadRotationAnimation();
            this.updateWorkPositionToZero();
            this.props.setGcodePrintingIndex(0);
        },
        'connection:close': (options) => {
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
            return (this.props.headType === HEAD_CNC);
        },
        is3DP: () => {
            return (this.props.headType === HEAD_PRINTING);
        },
        isLaser: () => {
            return (this.props.headType === HEAD_LASER);
        },
        handleRun: () => {
            const { server,
                workflowStatus,
                headType, isLaserPrintAutoMode,
                materialThickness,
                isRotate,
                toolHead,
                gcodeFile,
                series,
                laserFocalLength,
                background,
                size,
                workPosition,
                originOffset } = this.props;
            // const { workflowState } = this.state;
            // if ((connectionType === CONNECTION_TYPE_WIFI && workflowStatus === WORKFLOW_STATUS_IDLE)
            //     || (connectionType === CONNECTION_TYPE_SERIAL && workflowState === WORKFLOW_STATE_IDLE)) {
            if (workflowStatus === WORKFLOW_STATUS_IDLE) {
                server.startServerGcode({
                    headType,
                    workflowStatus,
                    isLaserPrintAutoMode,
                    materialThickness,
                    isRotate,
                    toolHead,
                    // for wifi indiviual
                    uploadName: gcodeFile.uploadName,
                    series,
                    laserFocalLength,
                    background,
                    size,
                    workPosition,
                    originOffset,
                    // // for serialport indiviual
                    // workflowStatus,
                }, (res) => {
                    if (res) {
                        const { msg, code } = res;
                        if (msg) {
                            if (code === 202) {
                                modalSmallHOC({
                                    title: i18n._('key-Workspace/Page-Filament Runout Recovery'),
                                    text: i18n._('key-Workspace/Page-Filament has run out. Please load new filament to continue printing.'),
                                    img: IMAGE_WIFI_ERROR
                                });
                            } else if (code === 203) {
                                modalSmallHOC({
                                    title: i18n._('key-Workspace/Page-Enclosure Door Open'),
                                    text: i18n._('key-Workspace/Page-One or both of the enclosure panels is/are opened. Please close the panel(s) to continue printing.'),
                                    subtext: i18n._('key-Workspace/Page-Please wait one second after you close the panel(s) to continue printing.'),
                                    img: IMAGE_WIFI_WARNING
                                });
                            } else {
                                modalSmallHOC({
                                    title: i18n._(`Error ${code}`),
                                    text: i18n._('key-Workspace/Page-Unable to start the job.'),
                                    img: IMAGE_WIFI_ERROR
                                });
                            }
                        }
                    }
                });
            }

            if (workflowStatus === WORKFLOW_STATUS_PAUSED) {
                server.resumeServerGcode({
                    headType: this.props.headType,
                    pause3dpStatus: this.props.pause3dpStatus,
                    pauseStatus: this.pauseStatus
                }, ({ msg, code }) => {
                    if (msg) {
                        if (code === 202) {
                            modalSmallHOC({
                                title: i18n._('key-Workspace/Page-Filament Runout Recovery'),
                                text: i18n._('key-Workspace/Page-Filament has run out. Please load new filament to continue printing.'),
                                img: IMAGE_WIFI_ERROR
                            });
                        } else if (code === 203) {
                            modalSmallHOC({
                                title: i18n._('key-Workspace/Page-Enclosure Door Open'),
                                text: i18n._('key-Workspace/Page-One or both of the enclosure panels is/are opened. Please close the panel(s) to continue printing.'),
                                subtext: i18n._('key-Workspace/Page-Please wait one second after you close the panel(s) to continue printing.'),
                                img: IMAGE_WIFI_WARNING
                            });
                        } else {
                            modalSmallHOC({
                                title: i18n._(`Error ${code}`),
                                text: i18n._('key-Workspace/Page-Unable to resume the job.'),
                                img: IMAGE_WIFI_ERROR
                            });
                        }
                    }
                });
            }
        },
        tryPause: () => {
            // delay 500ms to let buffer executed. and status propagated
            setTimeout(() => {
                if (this.state.gcode.received + 1 >= this.state.gcode.sent) {
                    this.pauseStatus = {
                        headStatus: this.state.controller.state.headStatus,
                        headPower: this.state.controller.state.headPower
                    };
                    if (this.pauseStatus.headStatus) {
                        this.props.executeGcode('M5');
                    }

                    // toolhead has stopped
                    if (this.props.pause3dpStatus?.pausing) {
                        const pause3dpStatus = {};
                        pause3dpStatus.pausing = false;
                        const workPosition = this.state.workPosition;
                        pause3dpStatus.pos = {
                            x: Number(workPosition.x),
                            y: Number(workPosition.y),
                            z: Number(workPosition.z),
                            e: Number(workPosition.e)
                        };
                        const pos = pause3dpStatus.pos;
                        // experience params for retraction: F3000, E->(E-5)
                        const targetE = Math.max(pos.e - 5, 0);
                        const targetZ = Math.min(pos.z + 30, this.props.size.z);
                        const gcode = [
                            `G1 F3000 E${targetE}\n`,
                            `G1 Z${targetZ} F3000\n`,
                            `G1 F100 E${pos.e}\n`
                        ];
                        this.props.executeGcode(gcode);
                        this.props.updatePause3dpStatus(pause3dpStatus);
                    }
                } else {
                    this.actions.tryPause();
                }
            }, 50);
        },
        handlePause: () => {
            const { workflowStatus, connectionType, server } = this.props;
            // const { workflowState } = this.state;
            if (this.actions.is3DP()) {
                this.props.updatePause3dpStatus({
                    pausing: true,
                    pos: null
                });
            }
            if (workflowStatus === WORKFLOW_STATUS_RUNNING) {
                server.pauseServerGcode(() => {
                    if (connectionType === CONNECTION_TYPE_SERIAL) {
                        this.actions.tryPause();
                    }
                });
            }
        },
        handleStop: () => {
            // const { workflowState } = this.state;
            const { workflowStatus, server, connectionType } = this.props;
            if (this.actions.is3DP()) {
                this.props.updatePause3dpStatus({
                    pausing: true,
                    pos: null
                });
            }
            if (workflowStatus !== WORKFLOW_STATE_IDLE) {
                server.stopServerGcode(() => {
                    if (connectionType === CONNECTION_TYPE_SERIAL) {
                        this.actions.tryPause();
                    }
                });
            }
        },
        handleClose: () => {
            // dismiss gcode file name
            this.props.clearGcode();
            const { workflowState } = this.state;
            if ([WORKFLOW_STATE_IDLE].includes(workflowState)) {
                this.props.executeGcode(null, null, 'gcode:unload');
            }
        },
        // canvas
        switchCoordinateVisibility: () => {
            const visible = !this.state.coordinateVisible;
            this.setState(
                { coordinateVisible: visible },
                () => {
                    this.state.printableArea.changeCoordinateVisibility(visible);
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
                isEmergencyStopped: false,
                // laser 10w warning
                isLaser10WCheck1: false,
                isLaser10WCheck2: false
            });
        }
    };

    componentDidMount() {
        this.props.onRef && this.props.onRef(this);
        this.setupToolhead().then(() => {
            const size = this.props.size;
            this.subscribe();
            this.addControllerEvents();
            this.setupTargetPoint();
            this.visualizerGroup.object.add(this.props.modelGroup);
            this.previewPrintableArea = new PrintablePlate({
                x: size.x * 2,
                y: size.y * 2
            });
            this.setState({
                printableArea: new PrintablePlate({
                    x: size.x * 2,
                    y: size.y * 2
                })
            });
        });
    }

    /**
     * Listen on props updates.
     *
     * When new G-code list received:
     *  - Re-render G-code objects
     *  - Upload G-code to controller
     */
    componentWillReceiveProps(nextProps) {
        if (!isEqual(nextProps.size, this.props.size) || !isEqual(nextProps.preview, this.props.preview)) {
            const size = nextProps.size;
            if (nextProps.preview) {
                this.previewPrintableArea && this.previewPrintableArea.updateSize({
                    x: size.x * 2,
                    y: size.y * 2
                });
            } else {
                this.state.printableArea && this.state.printableArea.updateSize({
                    x: size.x * 2,
                    y: size.y * 2
                });
            }
            this.canvas.current && this.canvas.current.setCamera(new THREE.Vector3(0, 0, Math.min(size.z * 2, 300)), new THREE.Vector3());
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
        if (nextProps.gcodePrintingInfo && nextProps.gcodePrintingInfo.sent > 0 && nextProps.gcodePrintingInfo.sent !== this.props.gcodePrintingInfo.sent) {
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
                this.canvas.current && this.canvas.current.setCamera(position, target);
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
        if (nextProps.laser10WErrorState !== this.props.laser10WErrorState) {
            if (nextProps.laser10WErrorState & (1 << 2)) {
                this.setState({
                    isLaser10WCheck2: true,
                    isLaser10WCheck1: false
                });
            } else if (nextProps.laser10WErrorState & (1 << 1)) {
                this.setState({
                    isLaser10WCheck2: false,
                    isLaser10WCheck1: true
                });
            } else {
                this.setState({
                    isLaser10WCheck2: false,
                    isLaser10WCheck1: false
                });
            }
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.onRef !== prevProps && this.props.onRef) {
            this.props.onRef(this);
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
        const url = 'resources/textures/brushed-steel-texture.jpg';
        return new Promise((resolve, reject) => {
            loadTexture(url, (err, texture) => {
                if (err) {
                    reject(err);
                } else {
                    this.toolhead = new ToolHead(color, texture);
                    this.visualizerGroup.object.add(this.toolhead);

                    this.toolheadRotationAnimation = new TWEEN.Tween(this.toolhead.rotation)
                        .to({ x: 0, y: 0, z: Number.MAX_VALUE }, Number.MAX_VALUE);
                    resolve();
                }
            });
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
        this.toolheadRotationAnimation && this.toolheadRotationAnimation.start();
    }

    stopToolheadRotationAnimation() {
        this.toolheadRotationAnimation && this.toolheadRotationAnimation.stop(); // TODO
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
        this.canvas.current.autoFocus(child, true);
    }

    notice() {
        const { stage, progress } = this.props;
        switch (stage) {
            case WORKSPACE_STAGE.EMPTY:
                return '';
            case WORKSPACE_STAGE.LOADING_GCODE:
                return i18n._('key-Workspace/Page-Loading G-code...{{progress}}%', { progress: (100.0 * progress).toFixed(1) });
            case WORKSPACE_STAGE.LOAD_GCODE_SUCCEED:
                return i18n._('key-Workspace/Page-Loaded G-code successfully.');
            case WORKSPACE_STAGE.LOAD_GCODE_FAILED:
                return i18n._('key-Workspace/Page-Failed to load G-code.');
            default:
                return '';
        }
    }

    renderScene() {
        this.canvas.current && this.canvas.current.renderScene();
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
                        <p>{i18n._(gcodeFile?.renderGcodeFileName)}</p>
                    </div>
                )}
                <div className={styles['canvas-wrapper']}>
                    {this.props.uploadState === 'uploading' && <Loading />}
                    {this.props.renderState === 'rendering' && <Rendering />}
                    {state.printableArea && (
                        <Canvas
                            ref={this.canvas}
                            size={this.props.size}
                            modelGroup={this.visualizerGroup}
                            printableArea={this.state.printableArea}
                            cameraInitialPosition={new THREE.Vector3(0, 0, Math.min(this.props.size.z * 2, 300))}
                            cameraInitialTarget={new THREE.Vector3(0, 0, 0)}
                        />
                    )}
                </div>
                <div className="position-ab left-16 bottom-16">
                    <SecondaryToolbar
                        zoomIn={this.actions.zoomIn}
                        zoomOut={this.actions.zoomOut}
                        toFront={this.actions.autoFocus}
                    />
                </div>

                {(state.isEmergencyStopped) && (
                    <ModalSmall
                        title={i18n._('key-Workspace/Page-Emergency Stop')}
                        text={i18n._('key-Workspace/Page-You have pressed the Emergency Stop Button. Solve the emergency and reconnect Luban.')}
                        img="WarningTipsEmergencyStop"
                        iconColor="#FF4D4F"
                        onClose={this.actions.closeModal}
                    />
                )}
                {(state.showEnclosureDoorWarn) && (
                    <ModalSmall
                        title={i18n._('key-Workspace/Page-Enclosure Door Open')}
                        onClose={this.actions.closeModal}
                        text={i18n._('key-Workspace/Page-One or both of the enclosure panels is/are opened. Please close the panel(s) to continue printing.')}
                        subtext={i18n._('key-Workspace/Page-Please wait one second after you close the panel(s) to continue printing.')}
                        img="WarningTipsWarning"
                        iconColor="#FFA940"
                    />
                )}
                {(state.isLaser10WCheck1) && (
                    <ModalSmall
                        title={i18n._('key-Workspace/Window-10W Laser Overheating protection')}
                        text={i18n._('key-Workspace/Window-10W Laser Overheating protection Info')}
                        img="WarningTipsWarning"
                        iconColor="#FFA940"
                        onClose={this.actions.closeModal}
                    />
                )}
                {(state.isLaser10WCheck2) && (
                    <ModalSmall
                        title={i18n._('key-Workspace/Window-10W Laser Attitude detection')}
                        text={i18n._('key-Workspace/Window-10W Laser Attitude detection Info')}
                        img="WarningTipsWarning"
                        iconColor="#FFA940"
                        onClose={this.actions.closeModal}
                    />
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const workspace = state.workspace;
    const laser = state.laser;

    return {
        size: workspace.size,
        server: machine.server,
        pause3dpStatus: machine.pause3dpStatus,
        doorSwitchCount: machine.doorSwitchCount,
        isEmergencyStopped: machine.isEmergencyStopped,
        isEnclosureDoorOpen: machine.isEnclosureDoorOpen,
        laser10WErrorState: machine.laser10WErrorState,
        headType: workspace.headType,
        toolHead: workspace.toolHead,
        workflowStatus: machine.workflowStatus,
        isConnected: machine.isConnected,
        connectionType: machine.connectionType,
        uploadState: workspace.uploadState,
        gcodeList: workspace.gcodeList,
        gcodeFile: workspace.gcodeFile,

        gcodePrintingInfo: machine.gcodePrintingInfo,
        workPosition: machine.workPosition,
        isLaserPrintAutoMode: machine.isLaserPrintAutoMode,
        // type
        materialThickness: machine.materialThickness,
        background: laser.background,
        isRotate: workspace.isRotate,
        // type
        laserFocalLength: machine.laserFocalLength,
        originOffset: machine.originOffset,

        modelGroup: workspace.modelGroup,
        series: workspace.series,
        renderState: workspace.renderState,
        boundingBox: workspace.boundingBox,
        renderingTimestamp: workspace.renderingTimestamp,
        stage: workspace.stage,
        progress: workspace.progress,
    };
};

const mapDispatchToProps = (dispatch) => ({
    clearGcode: () => dispatch(workspaceActions.clearGcode()),
    unloadGcode: () => dispatch(workspaceActions.unloadGcode()),
    setGcodePrintingIndex: (index) => dispatch(workspaceActions.setGcodePrintingIndex(index)),

    executeGcode: (gcode, context, cmd) => dispatch(machineActions.executeGcode(gcode, context, cmd)),
    updatePause3dpStatus: (pause3dpStatus) => dispatch(machineActions.updatePause3dpStatus(pause3dpStatus))
});

export default connect(mapStateToProps, mapDispatchToProps)(Visualizer);
