import { Vector3, Scene, Color, WebGLRenderer, PerspectiveCamera, Line, LineBasicMaterial, Geometry } from 'three';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Tabs, Tab } from 'react-bootstrap';
import TextArea from 'react-textarea-autosize';
import isEmpty from 'lodash/isEmpty';
import { actions as machineActions } from '../../flux/machine';
import PrimaryWidgets from './PrimaryWidgets';
import { NumberInput } from '../../components/Input';
import api from '../../api';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
import Calibration from './Calibration';
import GcodeFile from './GcodeFile';
import Setting from './Setting';
import Cnc from './Cnc';
import Laser from './Laser';
import Firmware from './Firmware';
import HeaterControl from './HeaterControl';
import PrintablePlate from './PrintablePlate';
import History from './History';
import store from '../../store';
import styles from './index.styl';
import {
    MAX_LINE_POINTS,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING
} from './constants';

const normalizeToRange = (n, min, max) => {
    return Math.max(Math.min(n, max), min);
};

class DeveloperPanel extends PureComponent {
    static propTypes = {
        size: PropTypes.object,
        port: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    textarea = React.createRef();

    monitor = React.createRef();

    printableArea = null;

    scene = null;

    history = new History(1000);

    state = {
        statusError: true,
        defaultWidgets: store.get('developerPanel.defaultWidgets'),
        renderStamp: +new Date(),
        machineSetting: {
            xSize: 167,
            ySize: 169,
            zSize: 150,
            xOffset: 0,
            yOffset: 0,
            zOffset: 0,
            xMotorDirection: -1,
            yMotorDirection: -1,
            zMotorDirection: -1,
            xHomeDirection: 1,
            yHomeDirection: 1,
            zHomeDirection: 1
        },
        extrudeLength: 10,
        extrudeSpeed: 200,
        nozzleTargetTemperature: 200,
        bedTargetTemperature: 50,
        calibrationZOffset: 0.1,
        calibrationMargin: 0,
        gcodeFile: '',
        updateFile: '',
        targetString: '',
        rpm: 0,
        laserState: {
            laserPercent: 0,
            focusHeight: 0,
            txtFocusX: 10,
            txtFocusY: 10,
            txtFocusZ: 100,
            relativeMode: true,
            txtMovementX: 10,
            txtMovementY: 10,
            txtMovementZ: 30
        },
        workflowState: '',
        workPosition: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000'
        },
        pressEnter: false,
        sender: {
            total: 0,
            sent: 0,
            received: 0
        },
        controller: {}
    };

    actions = {
        onChangeGcodeFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.actions.uploadGcodeFile(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload file'),
                    body: e.message
                });
            }
        },
        uploadGcodeFile: async (file) => {
            const formData = new FormData();
            const { port } = this.props;
            formData.append('file', file);
            formData.append('port', port);
            const res = await api.uploadGcodeFile(formData);
            const { originalName } = res.body;
            this.setState({
                gcodeFile: originalName
            });
        },
        onChangeUpdateFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.actions.uploadUpdateFile(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload file'),
                    body: e.message
                });
            }
        },
        uploadUpdateFile: async (file) => {
            const formData = new FormData();
            const { port } = this.props;
            formData.append('file', file);
            formData.append('port', port);
            const res = await api.uploadUpdateFile(formData);
            const { originalName } = res.body;
            this.setState({
                updateFile: originalName
            });
        },
        changeCalibrationZOffset: (calibrationZOffset) => {
            this.setState({ calibrationZOffset });
        },
        changeCalibrationMargin: (calibrationMargin) => {
            this.setState({ calibrationMargin });
        },
        switchHexMode: () => {
            // this.props.executeGcode('switch hex mode');
            controller.command('switch hex mode');
        },
        switchOn: () => {
            this.props.executeGcode('M1024');
        },
        switchOff: () => {
            // this.props.executeGcode('switch off');
            controller.command('switch off');
        },
        forceSwitch: () => {
            // this.props.executeGcode('force switch');
            controller.command('force switch');
            // this.props.executeGcode('clear feeder');
        },
        clearFeeder: () => {
            // this.props.executeGcode('clear feeder');
            controller.command('clear feeder');
        },
        extrude: () => {
            const { extrudeLength, extrudeSpeed } = this.state;
            this.props.executeGcode('G91');
            this.props.executeGcode(`G0 E${extrudeLength} F${extrudeSpeed}`);
            this.props.executeGcode('G90');
        },
        changeExtrudeLength: (extrudeLength) => {
            this.setState({ extrudeLength });
        },
        changeExtrudeSpeed: (extrudeSpeed) => {
            this.setState({ extrudeSpeed });
        },
        retract: () => {
            const { extrudeLength, extrudeSpeed } = this.state;
            this.props.executeGcode('G91');
            this.props.executeGcode(`G0 E-${extrudeLength} F${extrudeSpeed}`);
            this.props.executeGcode('G90');
        },
        changeNozzleTargetTemperature: (nozzleTargetTemperature) => {
            nozzleTargetTemperature = normalizeToRange(nozzleTargetTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ nozzleTargetTemperature });
        },
        changeBedTargetTemperature: (bedTargetTemperature) => {
            bedTargetTemperature = normalizeToRange(bedTargetTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ bedTargetTemperature });
        },
        changeMachineSetting: (setting) => {
            this.setState({
                machineSetting: {
                    ...this.state.machineSetting,
                    ...setting
                }
            });
            this.actions.render();
        },
        getMachineSetting: () => {
            this.props.executeGcode('get setting');
            this.actions.render();
        },
        onchangeCncRpm: (rpm) => {
            this.setState({ rpm });
        },
        onchangeLaserPrecent: (laserPercent) => {
            this.setState({
                laserState: {
                    ...this.state.laserState,
                    laserPercent
                }
            });
        },
        onchangeFocusHeight: (focusHeight) => {
            this.setState({
                laserState: {
                    ...this.state.laserState,
                    focusHeight
                }
            });
        },
        onchangeLaserState: (coordinate) => {
            this.setState({
                laserState: {
                    ...this.state.laserState,
                    ...coordinate
                }
            });
            console.log(this.state.laserState);
            this.actions.render();
        },
        updateWorkPositionToZero: () => {
            this.actions.updateWorkPosition({
                x: '0.000',
                y: '0.000',
                z: '0.000',
                e: '0.000'
            });
        },
        updateWorkPosition: (pos) => {
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
        },
        setTerminalInput: (event) => {
            // Enter
            if (event.keyCode === 13) {
                this.state.pressEnter = true;
                // this.writeln(`${this.prompt}${event.target.value}`);
                if (!isEmpty(event.target.value)) {
                    this.textarea.value += event.target.value;
                    this.textarea.value += '\n';
                    this.props.executeGcode(event.target.value);
                    // Reset the index to the last position of the history array
                    this.history.resetIndex();
                    this.history.push(event.target.value);
                    event.target.value = '';
                }
            }

            // Arrow Up
            if (event.keyCode === 38) {
                if (this.state.pressEnter) {
                    event.target.value = this.history.current() || '';
                    this.state.pressEnter = false;
                } else if (this.history.index > 0) {
                    event.target.value = this.history.back() || '';
                }
            }

            // Arrow Down
            if (event.keyCode === 40) {
                event.target.value = this.history.forward() || '';
            }
        },
        updateLine: (nozzleTemperature, bedTemperature) => {
            const { vertices } = this.line.geometry;
            vertices.push(vertices.shift());
            vertices[MAX_LINE_POINTS - 1] = new Vector3(this.timeStamp, nozzleTemperature, 0);
            this.line.geometry.verticesNeedUpdate = true;
            // Bed
            const { vertices: verticesBed } = this.lineBed.geometry;
            verticesBed.push(verticesBed.shift());
            verticesBed[MAX_LINE_POINTS - 1] = new Vector3(this.timeStamp, bedTemperature, 0);
            this.lineBed.geometry.verticesNeedUpdate = true;
            // needs to update boundingbox of the line
            // https://stackoverflow.com/questions/36497763/three-js-line-disappears-if-one-point-is-outside-of-the-cameras-view
            // this.line.geometry.computeBoundingSphere();
            // avoid computing boundingbox
            // this.line.frustumCulled = false;
            // x-axis step
            this.timeStamp += 1;
            const newSizeX = Math.max(300, this.timeStamp);
            const newSizeY = 300;
            const newSizeZ = 600;
            const newSize = {
                x: newSizeX,
                y: newSizeY,
                z: newSizeZ
            };
            // printableArea
            this.scene.children[0].updateSize(newSize);
            this.camera.aspect = 1.0;
            this.camera.position.x = this.timeStamp > 300 ? this.timeStamp - 80 : 220;
            this.camera.updateProjectionMatrix();
            this.renderScene();
        },
        render: () => {
            this.setState({ renderStamp: +new Date() });
        }
    };

    controllerEvents = {
        'Marlin:state': (state) => {
            const controllerState = this.state.controller.state;
            if (controllerState && controllerState.temperature) {
                // this.actions.updateLine(Number(state.temperature.t));
                this.actions.updateLine(Number(state.temperature.t), Number(state.temperature.b));
            }
            console.log(controllerState);
            this.setState({
                controller: {
                    ...this.state.controller,
                    state: state
                }
            });
            const { pos } = { ...state };
            if (this.state.workflowState === WORKFLOW_STATE_RUNNING) {
                this.actions.updateWorkPosition(pos);
            }
        },
        'machine:settings': (state) => {
            if (state) {
                Object.keys(state).forEach(setting => {
                    if (['xOffset', 'yOffset', 'zOffset', 'xSize', 'ySize', 'zSize'].indexOf(setting) > -1) {
                        if (state[setting] === null) {
                            state[setting] = 0;
                        }
                    } else if (['xMotorDirection', 'yMotorDirection', 'zMotorDirection', 'xHomeDirection', 'yHomeDirection', 'zHomeDirection'].indexOf(setting) > -1) {
                        if (state[setting] === null || state[setting] > 1) {
                            state[setting] = 1;
                        } else {
                            state[setting] = -1;
                        }
                    }
                });
                this.setState({
                    machineSetting: {
                        ...this.state.machineSetting,
                        ...state
                    }
                });
                this.actions.render();
            }
        },
        'laser:focusHeight': (focusHeight) => {
            this.setState({
                laserState: {
                    ...this.state.laserState,
                    focusHeight
                }
            });
            this.actions.render();
        },
        'serialport:read': (data) => {
            const targetString = this.state.targetString || '';
            // if (!isEmpty(targetString) && data.match(targetString)) {
            if (data.match(targetString)) {
                this.textarea.value += `${data}\n`;
            }
            const { length } = this.textarea.value;
            // if (length > 32768) {
            if (length > 16384) {
                this.textarea.value = '';
            }
        },
        'sender:status': (data) => {
            const { total, sent, received } = data;
            this.setState({
                sender: {
                    ...this.state.sender,
                    total,
                    sent,
                    received
                }
            });
        },
        'workflow:state': (workflowState) => {
            if (this.state.workflowState !== workflowState) {
                this.setState({ workflowState });
                switch (workflowState) {
                    case WORKFLOW_STATE_IDLE:
                        this.actions.updateWorkPositionToZero();
                        break;
                    case WORKFLOW_STATE_RUNNING:
                        break;
                    case WORKFLOW_STATE_PAUSED:
                        break;
                    default:
                        break;
                }
            }
        },
        'transfer:hex': (data) => {
            const dataArray = Buffer.from(data, '');
            const hexArray = [];
            for (let i = 0; i < dataArray.length; i++) {
                const hexString = dataArray[i].toString(16);
                if (dataArray[i] < 16) {
                    hexArray.push(`0${hexString}`);
                } else {
                    hexArray.push(`${hexString}`);
                }
            }
            const bufferString = hexArray.join(' ');
            if (!isEmpty(bufferString)) {
                this.textarea.value += `${bufferString}\n`;
            }
        }
    };

    componentDidMount() {
        this.setupScene();
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
    }

    getVisibleWidth() {
        return this.monitor.current.parentElement.clientWidth;
    }

    getVisibleHeight() {
        return this.monitor.current.parentElement.clientHeight;
    }

    setupScene() {
        const size = { x: 300, y: 300, z: 600 };
        const width = this.getVisibleWidth() || 586;
        // const height = this.getVisibleHeight();
        const geometry = new Geometry();
        const geometryBed = new Geometry();
        for (let i = 0; i < MAX_LINE_POINTS; i++) {
            geometry.vertices.push(
                new Vector3(0, 0, 0)
            );
            geometryBed.vertices.push(
                new Vector3(0, 0, 0)
            );
        }
        const material = new LineBasicMaterial({ color: 0x0000ff });
        const materialBed = new LineBasicMaterial({ color: 0xff00ff });
        this.timeStamp = 0;
        this.line = new Line(geometry, material);
        this.lineBed = new Line(geometryBed, materialBed);
        this.line.geometry.dynamic = true;
        this.lineBed.geometry.dynamic = true;
        // skip computing boundingbox
        this.line.frustumCulled = false;
        this.lineBed.frustumCulled = false;
        this.printableArea = new PrintablePlate(size);

        // this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera = new PerspectiveCamera(45, 1.0, 0.1, 10000);
        this.camera.position.copy(new Vector3(220, 80, 600));
        this.renderer = new WebGLRenderer({ antialias: true });
        // this.renderer.setClearColor(new Color(0xfafafa), 1);
        this.renderer.setClearColor(new Color(0xffffff), 1);
        // this.renderer.setSize(width, height);
        this.renderer.setSize(width, width);
        // this.renderer.setSize(586, 586);

        this.scene = new Scene();
        this.scene.add(this.printableArea);
        this.scene.add(this.line);
        this.scene.add(this.lineBed);
        this.monitor.current.appendChild(this.renderer.domElement);
        this.renderScene();
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

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        const { laserPercent, focusHeight } = this.state.laserState;
        const { defaultWidgets, renderStamp, machineSetting, rpm,
            workPosition, workflowState, sender, calibrationZOffset, calibrationMargin, extrudeLength, extrudeSpeed,
            gcodeFile, updateFile, bedTargetTemperature, nozzleTargetTemperature } = this.state;
        const controllerState = this.state.controller.state || {};
        const { updateProgress = 0, updateCount = 0, firmwareVersion = '',
            hexModeEnabled, newProtocolEnabled, temperature, headType, headStatus, headPower } = controllerState;
        // const { updateProgress = 0, updateCount = 0, firmwareVersion = '', temperature, headType, headStatus, headPower } = controllerState;
        const canClick = !!this.props.port;
        // const newProtocolEnabled = true;
        // const canClick = true;
        return (
            <div>
                <div className={styles['developer-panel']}>
                    <div style={{ paddingBottom: '10px' }}>
                        <p style={{ margin: '0 18px 0 0' }}>{i18n._('Switch Protocol')}</p>
                        <div
                            style={{ height: '100px', width: '100px', backgroundColor: 'red', display: 'inline-block', verticalAlign: 'middle' }}
                        />
                        <div style={{ display: 'inline-block', verticalAlign: 'middle', paddingLeft: '10px' }}>
                            <div className="btn-group btn-group-sm">
                                PC button
                                {!newProtocolEnabled && (
                                    <button
                                        type="button"
                                        className="sm-btn-small sm-btn-primary"
                                        disabled={!canClick}
                                        onClick={this.actions.switchOn}
                                    >
                                        <i className="fa fa-toggle-off" />
                                        <span className="space" />
                                        {i18n._('On')}
                                    </button>
                                )}
                                {newProtocolEnabled && (
                                    <button
                                        type="button"
                                        className="sm-btn-small sm-btn-danger"
                                        disabled={!canClick}
                                        onClick={this.actions.switchOff}
                                    >
                                        <i className="fa fa-toggle-on" />
                                        {i18n._('Off')}
                                    </button>
                                )}
                            </div>
                            <div
                                className="btn-group btn-group-sm"
                                style={{ padding: '0 10px' }}
                            >
                                Mock button
                                <button
                                    type="button"
                                    className="sm-btn-small sm-btn-danger"
                                    disabled={!canClick}
                                    onClick={this.actions.forceSwitch}
                                >
                                    {i18n._('Force')}
                                </button>
                            </div>
                            <div>
                                每1s检查一次连接状态
                            </div>
                            {statusError && (
                                <div sytle={{ color: 'red', fontSize: '15px' }}>
                                    err: your port is occupied
                                </div>
                            )}
                        </div>
                        <div>
                            <button className={styles['btn-calc']} type="button">
                                flushBuffer
                            </button>
                        </div>
                    </div>
                    <PrimaryWidgets
                        defaultWidgets={defaultWidgets}
                    />
                </div>
                <div className={styles['developer-panel-right']}>
                    <Tabs className={styles['primary-tab']} id="primary-tabs">
                        <Tab
                            eventKey="basic"
                            title={i18n._('Basic')}
                        >
                            <div>
                                <button className={styles['btn-func']} type="button" onClick={() => this.actions.extrude()}>Extrude</button>
                                <button className={styles['btn-func']} type="button" onClick={() => this.actions.retract()}>Retract</button>
                            </div>
                            <div>
                                <span style={{ margin: '0' }}>{i18n._('Length')}</span>
                                <NumberInput
                                    className={styles['input-normal']}
                                    value={extrudeLength}
                                    min={0}
                                    max={100}
                                    onChange={this.actions.changeExtrudeLength}
                                />
                                <span style={{ margin: '0' }}>mm @</span>
                                <NumberInput
                                    className={styles['input-normal']}
                                    value={extrudeSpeed}
                                    min={0}
                                    max={1000}
                                    onChange={this.actions.changeExtrudeSpeed}
                                />
                                <span style={{ margin: '0' }}>mm/min</span>
                            </div>
                            <HeaterControl
                                temperature={temperature}
                                bedTargetTemperature={bedTargetTemperature}
                                nozzleTargetTemperature={nozzleTargetTemperature}
                                changeBedTargetTemperature={this.actions.changeBedTargetTemperature}
                                changeNozzleTargetTemperature={this.actions.changeNozzleTargetTemperature}
                                executeGcode={this.props.executeGcode}
                            />
                            <div
                                ref={this.monitor}
                                style={{ width: '586px', height: '586px', position: 'relative', top: '0', bottom: '0', left: '0', right: '0' }}
                            />
                        </Tab>
                        <Tab
                            eventKey="filter"
                            title={i18n._('Filter')}
                        >
                            <p>{i18n._('Message Filter')}</p>
                            <input
                                style={{ width: '586px', backgroundColor: '#ffffff', color: '#000000' }}
                                type="text"
                                placeholder="Key Word"
                                onChange={(event) => {
                                    const { value } = event.target;
                                    this.setState({ targetString: value });
                                }}
                            />
                            <TextArea
                                style={{ width: '586px' }}
                                minRows={28}
                                maxRows={28}
                                placeholder="Message"
                                inputRef={(tag) => {
                                    this.textarea = tag;
                                }}
                            />
                            <input
                                style={{ width: '100%', backgroundColor: '#ffffff', color: '#000000' }}
                                type="text"
                                placeholder="Send Command"
                                onKeyDown={(event) => {
                                    this.actions.setTerminalInput(event);
                                }}
                            />
                            <div>
                                <button className={styles['btn-calc']} type="button" onClick={() => { this.textarea.value = ''; }}>{i18n._('Clear')}</button>
                                <input
                                    type="checkbox"
                                    style={{ margin: '4px 2px 0px 2px' }}
                                    checked={hexModeEnabled}
                                    onChange={this.actions.switchHexMode}
                                />
                                {i18n._('Show Hex')}
                            </div>
                        </Tab>
                        <Tab
                            eventKey="calibration"
                            title={i18n._('Calibration')}
                        >
                            <Calibration
                                calibrationZOffset={calibrationZOffset}
                                calibrationMargin={calibrationMargin}
                                changeCalibrationZOffset={this.actions.changeCalibrationZOffset}
                                changeCalibrationMargin={this.actions.changeCalibrationMargin}
                                executeGcode={this.props.executeGcode}
                            />
                        </Tab>
                        <Tab
                            eventKey="gcodefile"
                            title={i18n._('G-Code')}
                        >
                            <GcodeFile
                                sender={sender}
                                size={this.props.size}
                                gcodeFile={gcodeFile}
                                headType={headType}
                                workflowState={workflowState}
                                workPosition={workPosition}
                                headStatus={headStatus}
                                headPower={headPower}
                                onChangeGcodeFile={this.actions.onChangeGcodeFile}
                                executeGcode={this.props.executeGcode}
                            />
                        </Tab>
                        <Tab
                            eventKey="update"
                            title={i18n._('Update')}
                        >
                            <Firmware
                                updateFile={updateFile}
                                updateProgress={updateProgress}
                                updateCount={updateCount}
                                firmwareVersion={firmwareVersion}
                                onChangeUpdateFile={this.actions.onChangeUpdateFile}
                                executeGcode={this.props.executeGcode}
                            />
                        </Tab>
                        <Tab
                            eventKey="setting"
                            title={i18n._('Setting')}
                        >
                            <Setting
                                renderStamp={renderStamp}
                                machineSetting={machineSetting}
                                changeMachineSetting={this.actions.changeMachineSetting}
                                getMachineSetting={this.actions.getMachineSetting}
                                executeGcode={this.props.executeGcode}
                            />
                        </Tab>
                        <Tab
                            eventKey="cnc"
                            title={i18n._('Cnc')}
                        >
                            <Cnc
                                rpm={rpm}
                                executeGcode={this.props.executeGcode}
                                onchangeCncRpm={this.actions.onchangeCncRpm}
                            />
                        </Tab>
                        <Tab
                            eventKey="laser"
                            title={i18n._('Laser')}
                        >
                            <Laser
                                laserState={this.state.laserState}
                                executeGcode={this.props.executeGcode}
                                onchangeLaserPrecent={this.actions.onchangeLaserPrecent}
                                onchangeFocusHeight={this.actions.onchangeFocusHeight}
                                onchangeLaserState={this.actions.onchangeLaserState}
                                controllerState={controllerState}
                            />
                        </Tab>
                    </Tabs>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { port, size } = state.machine;

    return {
        size,
        port
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);
