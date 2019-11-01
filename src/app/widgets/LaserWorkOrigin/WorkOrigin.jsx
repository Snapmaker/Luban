import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import isEmpty from 'lodash/isEmpty';
import { Button } from '@trendmicro/react-buttons';
import pubsub from 'pubsub-js';
import i18n from '../../lib/i18n';
import SerialClient from '../../lib/serialClient';
import Modal from '../../components/Modal';
import api from '../../api';
import ManualMode from './ManualMode';
import CameraAidedMode from './CameraAidedMode';
import generateLaserRulerGcode from '../../lib/generateLaserRulerGcode';
import { actions as workspaceActions } from '../../flux/workspace';
import { actions as widgetActions } from '../../flux/widget';
import styles from './styles.styl';
import {
    PROTOCOL_TEXT,
    WORKFLOW_STATE_IDLE,
    MACHINE_HEAD_TYPE,
    THICKNESS_MIN,
    THICKNESS_MAX,
    THICKNESS_STEP,
    RULER_Z_OFFSET,
    LASER_HOOD_HEIGHT
} from '../../constants';

const controller = new SerialClient({ dataSource: PROTOCOL_TEXT });

const normalizeToRange = (n, min, max) => {
    if (n < min) {
        return min;
    }
    if (n > max) {
        return max;
    }
    return n;
};

class SetWorkOrigin extends PureComponent {
    static propTypes = {
        server: PropTypes.object.isRequired,
        isHomed: PropTypes.bool,
        workOriginDefined: PropTypes.bool.isRequired,
        size: PropTypes.object.isRequired,
        zFocus: PropTypes.number.isRequired,
        focusShift: PropTypes.number.isRequired,
        hasFocusShift: PropTypes.bool.isRequired,
        selectedThickness: PropTypes.number.isRequired,
        customThickness: PropTypes.number.isRequired,
        workPosition: PropTypes.object.isRequired,
        headType: PropTypes.string.isRequired,
        setTitle: PropTypes.func.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,

        updateWidgetState: PropTypes.func.isRequired
    };

    state = {
        previewPower: 1,
        workPower: 100,
        jogStep: 1,
        zOffset: 0,
        zOffsetSlider: 2,
        coarseFocus: this.props.zFocus || LASER_HOOD_HEIGHT,
        focusShiftLoaded: false,
        hoodTouchHeight: LASER_HOOD_HEIGHT,
        isConnected: false,
        hasHoodTouchHeight: false,
        snapShot: '',
        success: null,
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
        selectedThickness: this.props.selectedThickness || 1.5,
        customThickness: this.props.customThickness || 1.5,
        isCameraAidedModal: false,
        isManualModal: false,
        modalStage: 0
    };

    actions = {
        start: () => {
            const { isHomed, workOriginDefined } = this.props;
            if (!isHomed || workOriginDefined) {
                this.actions.goHome();
            }
            this.actions.goXYCenter();
            this.actions.moveToFocus();
        },
        goHome: () => {
            controller.command('gcode', 'G28');
            this.setState({
                hasHoodTouchHeight: false,
                focusShiftLoaded: false
            });
        },
        goHomeZ: () => {
            controller.command('gcode', 'G28 Z');
            this.setState({
                hasHoodTouchHeight: false,
                focusShiftLoaded: false
            });
        },
        goXYCenter: () => {
            const { size } = this.props;
            const x = size.x / 2;
            const y = size.y / 2;
            controller.command('gcode', `G0 X${x} Y${y} F3000`);
        },
        changePreviewPower: (previewPower) => {
            this.setState({ previewPower });
        },
        changeWorkPower: (workPower) => {
            this.setState({ workPower });
        },
        changeJogStep: (jogStep) => {
            this.setState({ jogStep });
        },
        jog: (motion) => {
            const { jogStep } = this.state;
            let gcodes = null;

            switch (motion) {
                case 'x+':
                    gcodes = ['G91', `G0 X${jogStep} F1000`, 'G90'];
                    break;
                case 'x-':
                    gcodes = ['G91', `G0 X-${jogStep} F1000`, 'G90'];
                    break;
                case 'y+':
                    gcodes = ['G91', `G0 Y${jogStep} F1000`, 'G90'];
                    break;
                case 'y-':
                    gcodes = ['G91', `G0 Y-${jogStep} F1000`, 'G90'];
                    break;
                case 'z+':
                    gcodes = ['G91', `G0 Z${jogStep} F1000`, 'G90'];
                    break;
                case 'z-':
                    gcodes = ['G91', `G0 Z-${jogStep} F1000`, 'G90'];
                    break;
                default:
                    break;
            }
            controller.command('gcode', gcodes.join('\n'));
        },
        onChangeZOffset: (zOffsetSlider) => {
            const zOffset = zOffsetSlider - 2;
            this.setState({
                zOffsetSlider,
                zOffset
            });
        },
        applyMaterialThickness: () => {
            const { selectedThickness } = this.state;
            const gcodes = [
                'G91',
                `G0 Z${selectedThickness} F1000`,
                `G0 Z-${selectedThickness} F1000`,
                'G90'
            ];
            controller.command('gcode', gcodes.join('\n'));
        },
        generateAndLoadGcode: () => {
            const { workPower } = this.state;
            const workSpeed = 1000;
            const jogSpeed = 1500;
            const gcodes = generateLaserRulerGcode(workPower, workSpeed, jogSpeed);
            this.props.clearGcode();
            this.props.addGcode('Laser Fine Tune G-code', gcodes);
        },
        runFocalGcode: () => {
            controller.command('gcode:start');
            this.actions.nextModal();
        },
        snapShotAndDetect: async () => {
            const { address } = this.props.server;
            const path = 'v1/camera_take_photo';
            await api.processSnapShot({ path, address }).then((res) => {
                const { fileName } = res.body;
                this.setState({
                    snapShot: fileName
                });
            });
            const uploadName = this.state.snapShot;
            await api.processFocusOffset({ uploadName }).then((res) => {
                const { minIndex, success } = res.body;
                const zOffset = (minIndex - 10) * 0.2;
                this.setState({
                    zOffset,
                    success
                });
            });
            if (this.state.success) {
                this.actions.nextModal();
            }
        },
        applyZOffset: () => {
            const { zOffset } = this.state;
            let gcodes = null;
            if (zOffset > 0) {
                gcodes = ['G91', `G0 Z${zOffset} F1000`, `G0 Z-${zOffset} F1000`, 'G90'];
            } else {
                gcodes = ['G91', `G0 Z-${-zOffset} F1000`, `G0 Z${-zOffset} F1000`, 'G90'];
            }
            controller.command('gcode', gcodes.join('\n'));
            this.actions.nextModal();
        },
        openLaser: () => {
            const { previewPower } = this.state;
            // TODO M3 S table
            const previewPowerS = Math.floor(previewPower * 255 / 100);
            controller.command('gcode', `M3 P${previewPower} S${previewPowerS}`);
        },
        closeLaser: () => {
            controller.command('gcode', 'M5');
        },
        loadFocusShift: () => {
            this.setState({
                focusShiftLoaded: true,
                zOffset: 0,
                modalStage: 4
            });
        },
        saveHoodTouchHeight: () => {
            const { workPosition, workOriginDefined } = this.props;
            const { selectedThickness } = this.state;
            const saftyHeight = LASER_HOOD_HEIGHT + selectedThickness;
            const hoodTouchHeight = Math.max(parseFloat(workPosition.z), saftyHeight);
            this.setState({
                hoodTouchHeight,
                hasHoodTouchHeight: true,
                focusShiftLoaded: false
            });
            if (workOriginDefined) {
                this.actions.goHomeZ();
            }
            this.actions.moveToFocus();
            this.actions.openLaser();
            this.actions.generateAndLoadGcode();
            this.actions.nextModal();
        },
        moveToFocus: () => {
            const { zFocus } = this.props;
            const { selectedThickness, hoodTouchHeight } = this.state;
            const saftyHeight = LASER_HOOD_HEIGHT + selectedThickness + RULER_Z_OFFSET;
            const z = Math.max(hoodTouchHeight + zFocus - LASER_HOOD_HEIGHT, saftyHeight);
            controller.command('gcode', `G0 Z${z} F3000`);
        },
        saveCoarseFocus: () => {
            const { workPosition } = this.props;
            const { hoodTouchHeight, selectedThickness } = this.state;
            const saftyFocusLength = LASER_HOOD_HEIGHT + RULER_Z_OFFSET + selectedThickness;
            const coarseFocus = Math.max(parseFloat(workPosition.z) - hoodTouchHeight, saftyFocusLength);
            controller.command('gcode', 'M5');
            this.setState({
                coarseFocus
            });
        },
        setWorkOrigin: () => {
            controller.command('gcode', 'G92 X0 Y0 Z0');
        },
        confirmWorkOriginCameraAided: () => {
            const { zFocus, focusShift } = this.props;
            const { zOffset, hoodTouchHeight, selectedThickness, focusShiftLoaded } = this.state;
            let z = null;
            if (focusShiftLoaded) {
                z = Math.max(focusShift + selectedThickness, hoodTouchHeight);
            } else {
                z = Math.max(hoodTouchHeight + zFocus - LASER_HOOD_HEIGHT + zOffset, hoodTouchHeight);
                const newFocusShift = z - selectedThickness;
                this.props.updateWidgetState('focusShift', newFocusShift);
            }
            this.props.updateWidgetState('hasFocusShift', true);
            const gcodes = [
                // add home z in case of confirm twice
                'G28 Z',
                'G90',
                `G0 Z${z} F3000`,
                'G92 X0 Y0 Z0'
            ];
            controller.command('gcode', gcodes.join('\n'));
        },
        confirmWorkOrigin: () => {
            const { hoodTouchHeight, coarseFocus, zOffset, selectedThickness, focusShiftLoaded } = this.state;
            const { focusShift } = this.props;
            let z = null;
            if (focusShiftLoaded) {
                z = Math.max(focusShift + selectedThickness, hoodTouchHeight);
            } else {
                z = Math.max(hoodTouchHeight + coarseFocus - LASER_HOOD_HEIGHT + zOffset, hoodTouchHeight);
                const newFocusShift = z - selectedThickness;
                this.props.updateWidgetState('focusShift', newFocusShift);
            }
            this.props.updateWidgetState('hasFocusShift', true);
            const gcodes = [
                // home z in case of confirm twice
                'G28 Z',
                'G90',
                `G0 Z${z} F3000`,
                'G92 X0 Y0 Z0'
            ];
            controller.command('gcode', gcodes.join('\n'));
        },
        selectThickness: (selectedThickness) => {
            if (!selectedThickness) {
                this.setState({ selectedThickness: this.state.customThickness });
            } else {
                this.setState({ selectedThickness });
            }
        },
        changeCustomThickness: (customThickness) => {
            customThickness = normalizeToRange(customThickness, THICKNESS_MIN, THICKNESS_MAX);
            this.setState({ customThickness });
        },
        increaseCustomThickness: () => {
            const { customThickness } = this.state;
            let thickness = Math.min(Number(customThickness) + THICKNESS_STEP, THICKNESS_MAX);
            thickness = thickness.toFixed(3) * 1;
            this.setState({
                selectedThickness: thickness,
                customThickness: thickness
            });
        },
        decreaseCustomThickness: () => {
            const { customThickness } = this.state;
            let thickness = Math.max(Number(customThickness) - THICKNESS_STEP, THICKNESS_MIN);
            thickness = thickness.toFixed(3) * 1;
            this.setState({
                selectedThickness: thickness,
                customThickness: thickness
            });
        },
        runBoundary: () => {
            const { workPosition } = this.props;
            const { bbox, previewPower } = this.state;
            const jogSpeed = 1500;
            // TODO M3 S table
            const previewPowerS = Math.floor(previewPower * 255 / 100);

            const gcodes = [
                'G90', // absolute position
                `M3 P${previewPower} S${previewPowerS}`,
                `G0 X${bbox.min.x} Y${bbox.min.y} F${jogSpeed}`, // run boundary
                `G0 X${bbox.min.x} Y${bbox.max.y}`,
                `G0 X${bbox.max.x} Y${bbox.max.y}`,
                `G0 X${bbox.max.x} Y${bbox.min.y}`,
                `G0 X${bbox.min.x} Y${bbox.min.y}`,
                `G0 X${workPosition.x} Y${workPosition.y}`, // go back to origin
                'M5'
            ];
            controller.command('gcode', gcodes.join('\n'));
        },
        showCameraAidedModal: () => {
            this.actions.start();
            this.setState({
                isCameraAidedModal: true
            });
        },
        hideCameraAidedModal: () => {
            this.setState({
                isCameraAidedModal: false,
                success: null,
                modalStage: 0
            });
            controller.command('gcode', 'M5');
        },
        showManualModal: () => {
            this.actions.start();
            this.setState({
                isManualModal: true
            });
        },
        hideManualModal: () => {
            this.setState({
                isManualModal: false,
                modalStage: 0
            });
            controller.command('gcode', 'M5');
        },
        previousModal: () => {
            const { modalStage, focusShiftLoaded } = this.state;
            if (focusShiftLoaded && modalStage > 2 && modalStage < 5) {
                this.setState({ modalStage: 1 });
            } else {
                this.setState({ modalStage: modalStage - 1 });
            }
        },
        nextModal: () => {
            const { modalStage, focusShiftLoaded } = this.state;
            if (focusShiftLoaded && modalStage > 1 && modalStage < 4) {
                this.setState({ modalStage: 5 });
            } else {
                this.setState({ modalStage: modalStage + 1 });
            }
        }
    };

    controllerEvents = {
        'serialport:open': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({ isConnected: true });
        },
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.setState({ isConnected: false });
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Fine Tune Work Origin 2.0'));
    }

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
            pubsub.subscribe('gcode:unload', () => {
                this.setState({
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
                });
            }),
            pubsub.subscribe('gcode:bbox', (msg, bbox) => {
                this.setState({
                    bbox: {
                        min: {
                            x: bbox.min.x,
                            y: bbox.min.y,
                            z: bbox.min.z
                        },
                        max: {
                            x: bbox.max.x,
                            y: bbox.max.y,
                            z: bbox.max.z
                        }
                    }
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

    render() {
        const { workOriginDefined, zFocus, hasFocusShift, focusShift, headType } = this.props;
        const actions = this.actions;
        const { selectedThickness, customThickness, hasHoodTouchHeight, focusShiftLoaded,
            hoodTouchHeight, coarseFocus, zOffsetSlider, previewPower, workPower, jogStep,
            isCameraAidedModal, isManualModal, modalStage, snapShot, success } = this.state;
        const isIdle = controller.getWorkflowState() === WORKFLOW_STATE_IDLE;
        const isConnected = this.state.isConnected || !isEmpty(this.props.server);
        const zOffset = Math.round(this.state.zOffset * 10) / 10;

        if (!(headType === MACHINE_HEAD_TYPE.LASER.value) || !isConnected) {
            return null;
        }
        return (
            <React.Fragment>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={actions.showCameraAidedModal}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    {i18n._('Camera Aided Mode')}
                </button>
                <button
                    type="button"
                    className="sm-btn-large sm-btn-default"
                    onClick={actions.showManualModal}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    {i18n._('Manual Mode')}
                </button>
                {isCameraAidedModal && (
                    <Modal className={styles.modal} onClose={actions.hideCameraAidedModal}>
                        <Modal.Body className={styles.modalBody}>
                            <CameraAidedMode
                                isIdle={isIdle}
                                isConnected={isConnected}
                                workOriginDefined={workOriginDefined}
                                previewPower={previewPower}
                                workPower={workPower}
                                jogStep={jogStep}
                                zOffset={zOffset}
                                zOffsetSlider={zOffsetSlider}
                                selectedThickness={selectedThickness}
                                customThickness={customThickness}
                                hoodTouchHeight={hoodTouchHeight}
                                hasHoodTouchHeight={hasHoodTouchHeight}
                                zFocus={zFocus}
                                hasFocusShift={hasFocusShift}
                                focusShift={focusShift}
                                focusShiftLoaded={focusShiftLoaded}
                                modalStage={modalStage}
                                snapShot={snapShot}
                                success={success}
                                actions={actions}
                            />
                        </Modal.Body>
                        <Modal.Footer>
                            {modalStage !== 0 && (
                                <Button
                                    onClick={actions.previousModal}
                                >
                                    {i18n._('Back')}
                                </Button>
                            )}
                            {modalStage !== 4 && (
                                <Button
                                    onClick={actions.nextModal}
                                >
                                    {i18n._('Next')}
                                </Button>
                            )}
                            {modalStage === 4 && (
                                <Button
                                    onClick={actions.hideCameraAidedModal}
                                >
                                    {i18n._('Exit')}
                                </Button>
                            )}
                        </Modal.Footer>
                    </Modal>
                )}
                {isManualModal && (
                    <Modal className={styles.modal} onClose={actions.hideManualModal}>
                        <Modal.Body className={styles.modalBody}>
                            <ManualMode
                                isIdle={isIdle}
                                isConnected={isConnected}
                                workOriginDefined={workOriginDefined}
                                previewPower={previewPower}
                                workPower={workPower}
                                jogStep={jogStep}
                                zOffset={zOffset}
                                zOffsetSlider={zOffsetSlider}
                                selectedThickness={selectedThickness}
                                customThickness={customThickness}
                                zFocus={zFocus}
                                hasFocusShift={hasFocusShift}
                                focusShift={focusShift}
                                focusShiftLoaded={focusShiftLoaded}
                                hoodTouchHeight={hoodTouchHeight}
                                hasHoodTouchHeight={hasHoodTouchHeight}
                                coarseFocus={coarseFocus}
                                modalStage={modalStage}
                                actions={actions}
                            />
                        </Modal.Body>
                        <Modal.Footer>
                            {modalStage !== 0 && (
                                <Button
                                    onClick={actions.previousModal}
                                >
                                    {i18n._('Back')}
                                </Button>
                            )}
                            {modalStage !== 4 && (
                                <Button
                                    onClick={actions.nextModal}
                                >
                                    {i18n._('Next')}
                                </Button>
                            )}
                            {modalStage === 4 && (
                                <Button
                                    onClick={actions.hideManualModal}
                                >
                                    {i18n._('Exit')}
                                </Button>
                            )}
                        </Modal.Footer>
                    </Modal>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { server, headType, workPosition, isHomed, workOriginDefined, size, zFocus } = state.machine;
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const { hasFocusShift, focusShift, selectedThickness, customThickness } = widgets[widgetId];

    return {
        server,
        isHomed,
        workOriginDefined,
        size,
        zFocus,
        hasFocusShift,
        focusShift,
        selectedThickness,
        customThickness,
        headType,
        workPosition
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    updateWidgetState: (key, value) => dispatch(widgetActions.updateWidgetState(ownProps.widgetId, key, value)),
    addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
    clearGcode: () => dispatch(workspaceActions.clearGcode())
});

export default connect(mapStateToProps, mapDispatchToProps)(SetWorkOrigin);
