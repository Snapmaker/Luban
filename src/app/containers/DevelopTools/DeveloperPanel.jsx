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
import i18n from '../../lib/i18n';
import { screenController } from '../../lib/controller';
import Calibration from './Calibration';
import GcodeFile from './GcodeFile';
import Setting from './Setting';
import CNC from './CNC';
import Laser from './Laser';
import Lamp from './Lamp';
import Firmware from './Firmware';
import HeaterControl from './HeaterControl';
import PrintablePlate from './PrintablePlate';
import History from './History';
import styles from './index.styl';
import {
    PROTOCOL_SCREEN,
    MAX_LINE_POINTS,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX
} from '../../constants';

const normalizeToRange = (n, min, max) => {
    return Math.max(Math.min(n, max), min);
};

class DeveloperPanel extends PureComponent {
    static propTypes = {
        port: PropTypes.string.isRequired,
        defaultWidgets: PropTypes.array.isRequired,
        primaryWidgets: PropTypes.array.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    textarea = React.createRef();

    monitor = React.createRef();

    printableArea = null;

    scene = null;

    history = new History(1000);

    state = {
        statusError: false,
        hexModeEnabled: false,
        defaultWidgets: this.props.defaultWidgets,
        primaryWidgets: this.props.primaryWidgets,
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
        pressEnter: false,
        controller: { state: {} }
    };

    actions = {
        changeCalibrationZOffset: (calibrationZOffset) => {
            this.setState({ calibrationZOffset });
        },
        changeCalibrationMargin: (calibrationMargin) => {
            this.setState({ calibrationMargin });
        },
        switchHexMode: () => {
            screenController.command('switch hex mode');
        },
        /*
        switchOn: () => {
            // outdated
            this.props.executeGcode('M1024');
        },
        switchOff: () => {
            // outdated
            controller.command('switch off');
        },
        */
        forceSwitch: () => {
            screenController.command('force switch');
        },
        clearFeeder: () => {
            screenController.command('clear feeder');
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
            this.actions.render();
        },
        setTerminalInput: (event) => {
            // Enter
            if (event.keyCode === 13) {
                this.state.pressEnter = true;
                if (!isEmpty(event.target.value)) {
                    this.textarea.value += event.target.value;
                    this.textarea.value += '\n';
                    this.props.executeGcode(event.target.value);
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
        updateLine: (line, value) => {
            const { vertices } = line.geometry;
            vertices.push(vertices.shift());
            vertices[MAX_LINE_POINTS - 1] = new Vector3(this.timeStamp, value, 0);
            line.geometry.verticesNeedUpdate = true;
        },
        updateLineTarget: (line, value) => {
            const { vertices } = line.geometry;
            vertices[0].x = this.timeStamp > 300 ? this.timeStamp - 300 : 0;
            vertices[0].y = value;
            vertices[1].x = this.timeStamp > 300 ? this.timeStamp : 300;
            vertices[1].y = value;
            line.geometry.verticesNeedUpdate = true;
        },
        updateLines: (nozzleTargetTemperature, bedTargetTemperature) => {
            this.actions.updateLine(this.line, nozzleTargetTemperature);
            this.actions.updateLine(this.lineBed, bedTargetTemperature);

            const { bTarget, tTarget } = this.state.controller.state.temperature;
            const bTargetFloat = parseFloat(bTarget) || 0;
            const tTargetFloat = parseFloat(tTarget) || 0;
            this.actions.updateLineTarget(this.lineTarget, tTargetFloat);
            this.actions.updateLineTarget(this.lineBedTarget, bTargetFloat);

            this.timeStamp += 1;
            const newSizeX = Math.max(300, this.timeStamp);
            const newSizeY = 300;
            const newSizeZ = 600;
            const newSize = {
                x: newSizeX,
                y: newSizeY,
                z: newSizeZ
            };
            this.scene.children[0].updateSize(newSize);
            this.camera.aspect = 1.0;
            this.camera.position.x = this.timeStamp > 300 ? this.timeStamp - 80 : 220;
            this.camera.updateProjectionMatrix();
            this.renderScene();
        },
        render: () => {
            this.setState({ renderStamp: +new Date() });
        },
        setLightMode: (mode) => {
            if (mode === 'status') {
                this.props.executeGcode('set light mode', { lightMode: 'status' });
            } else {
                this.props.executeGcode('set light mode', { lightMode: 'light' });
            }
        }
    };

    controllerEvents = {
        // 'Marlin:state': (state, dataSource) => {
        'Marlin:state': (options) => {
            const { state, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
            const controllerState = this.state.controller.state;
            const { hexModeEnabled, headPower } = state;
            if (controllerState && controllerState.temperature) {
                this.actions.updateLines(Number(state.temperature.t), Number(state.temperature.b));
            }
            this.setState({
                controller: {
                    ...this.state.controller,
                    state
                }
            });
            if (hexModeEnabled !== this.state.hexModeEnabled) {
                this.setState({ hexModeEnabled });
            }
            if (headPower !== this.state.laserState.laserPercent) {
                this.setState({
                    laserState: {
                        ...this.state.laserState,
                        laserPercent: headPower
                    }
                });
            }
        },
        // 'machine:settings': (settings, dataSource) => {
        'machine:settings': (options) => {
            const { settings, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
            if (!isEmpty(settings)) {
                Object.keys(settings).forEach(setting => {
                    if (['xOffset', 'yOffset', 'zOffset', 'xSize', 'ySize', 'zSize'].indexOf(setting) > -1) {
                        if (settings[setting] === null) {
                            settings[setting] = 0;
                        }
                    } else if (['xMotorDirection', 'yMotorDirection', 'zMotorDirection', 'xHomeDirection', 'yHomeDirection', 'zHomeDirection'].indexOf(setting) > -1) {
                        if (settings[setting] === null || settings[setting] > 1) {
                            settings[setting] = 1;
                        } else {
                            settings[setting] = -1;
                        }
                    }
                });
                this.actions.changeMachineSetting(settings);
            }
        },
        // 'serialport:read': (data, dataSource) => {
        'serialport:read': (options) => {
            const { data, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
            const targetString = this.state.targetString || '';
            if (data.match(targetString)) {
                this.textarea.value += `${data}\n`;
            }
            const { length } = this.textarea.value;
            if (length > 16384) {
                this.textarea.value = '';
            }
        },
        // 'transfer:hex': (data, dataSource) => {
        'transfer:hex': (options) => {
            const { data, dataSource } = options;
            if (dataSource !== PROTOCOL_SCREEN) {
                return;
            }
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

    setupScene() {
        const size = { x: 300, y: 300, z: 600 };
        const width = this.getVisibleWidth() > 586 ? this.getVisibleWidth() : 586;
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(45, 1.0, 0.1, 10000);
        this.camera.position.copy(new Vector3(220, 80, 600));
        this.printableArea = new PrintablePlate(size);
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new Color(0xffffff), 1);
        this.renderer.setSize(width, width);
        this.scene.add(this.printableArea);

        this.timeStamp = 0;
        this.line = this.genLine({ color: 0x000080, linewidth: 2 });
        this.lineBed = this.genLine({ color: 0x800080, linewidth: 2 });
        this.lineTarget = this.genLine({ color: 0x0000ff, isTarget: true, linewidth: 1 });
        this.lineBedTarget = this.genLine({ color: 0xff00ff, isTarget: true, linewidth: 1 });

        this.monitor.current.appendChild(this.renderer.domElement);
        this.renderScene();
    }

    genLine(options) {
        const { isTarget = false } = options;
        const geometry = new Geometry();
        const points = isTarget ? 2 : MAX_LINE_POINTS;

        for (let i = 0; i < points; i++) {
            geometry.vertices.push(
                new Vector3(0, 0, 0)
            );
        }
        const material = new LineBasicMaterial(options);
        const line = new Line(geometry, material);
        line.geometry.dynamic = true;
        line.frustumCulled = false;

        if (this.scene) {
            this.scene.add(line);
        }
        return line;
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            screenController.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            screenController.off(eventName, callback);
        });
    }

    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }

    render() {
        const { defaultWidgets, primaryWidgets, renderStamp, machineSetting, rpm, statusError, laserState,
            calibrationZOffset, calibrationMargin, extrudeLength, extrudeSpeed,
            bedTargetTemperature, nozzleTargetTemperature, hexModeEnabled } = this.state;
        const controllerState = this.state.controller.state || {};
        const { isScreenProtocol, temperature } = controllerState;
        const canClick = !!this.props.port;
        return (
            <div>
                <div className={styles['developer-panel']}>
                    <div style={{ paddingBottom: '10px' }}>
                        <div style={{ margin: '10px 0' }}>
                            <span style={{ margin: '0 10px' }}>{i18n._('Protocol Type')}:</span>
                            {!isScreenProtocol && (
                                <button
                                    type="button"
                                    className="sm-btn-small sm-btn-primary"
                                    disabled={!isScreenProtocol}
                                    onClick={this.actions.switchOn}
                                >
                                    <span className="space" />
                                    {i18n._('Text')}
                                    <span className="space" />
                                </button>
                            )}
                            {isScreenProtocol && (
                                <button
                                    type="button"
                                    className="sm-btn-small sm-btn-danger"
                                    disabled={isScreenProtocol}
                                    onClick={this.actions.switchOff}
                                >
                                    {i18n._('Screen')}
                                </button>
                            )}
                        </div>
                        <div>
                            <div
                                className="btn-group btn-group-sm"
                                style={{ padding: '0 10px' }}
                            >
                                <button
                                    type="button"
                                    className="sm-btn-small sm-btn-danger"
                                    disabled={!canClick}
                                    onClick={this.actions.forceSwitch}
                                >
                                    {i18n._('Switch')}
                                </button>
                            </div>
                            <div
                                className="btn-group btn-group-sm"
                                style={{ padding: '0 18px' }}
                            >
                                <button
                                    className="sm-btn-small sm-btn-primary"
                                    type="button"
                                    onClick={this.actions.clearFeeder}
                                >
                                    <span className="space" />
                                    {i18n._('Flush')}
                                </button>
                            </div>
                            {statusError && (
                                <div sytle={{ color: 'red', fontSize: '15px' }}>
                                    err: the port is occupied
                                </div>
                            )}
                        </div>
                    </div>
                    <PrimaryWidgets
                        defaultWidgets={defaultWidgets}
                        primaryWidgets={primaryWidgets}
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
                                style={{ width: '100%', height: '600px', position: 'relative', top: '0', bottom: '0', left: '0', right: '0' }}
                            />
                        </Tab>
                        <Tab
                            eventKey="filter"
                            title={i18n._('Filter')}
                        >
                            <p>{i18n._('Message Filter')}</p>
                            <input
                                style={{ width: '100%', backgroundColor: '#ffffff', color: '#000000' }}
                                type="text"
                                placeholder="Key Word"
                                onChange={(event) => {
                                    const { value } = event.target;
                                    this.setState({ targetString: value });
                                }}
                            />
                            <TextArea
                                style={{ width: '100%' }}
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
                            title={i18n._('G-code')}
                        >
                            <GcodeFile
                                port={this.props.port}
                            />
                        </Tab>
                        <Tab
                            eventKey="update"
                            title={i18n._('Update')}
                        >
                            <Firmware
                                port={this.props.port}
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
                            title={i18n._('CNC')}
                        >
                            <CNC
                                rpm={rpm}
                                executeGcode={this.props.executeGcode}
                                spindleSpeed={controllerState.spindleSpeed}
                                onchangeCncRpm={this.actions.onchangeCncRpm}
                            />
                        </Tab>
                        <Tab
                            eventKey="laser"
                            title={i18n._('Laser')}
                        >
                            <Laser
                                laserState={laserState}
                                executeGcode={this.props.executeGcode}
                                onchangeLaserPrecent={this.actions.onchangeLaserPrecent}
                                onchangeFocusHeight={this.actions.onchangeFocusHeight}
                                onchangeLaserState={this.actions.onchangeLaserState}
                            />
                        </Tab>
                        <Tab
                            eventKey="lamp"
                            title={i18n._('Lamp')}
                        >
                            <Lamp
                                executeGcode={this.props.executeGcode}
                                setLightMode={this.actions.setLightMode}
                            />
                        </Tab>
                    </Tabs>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { port } = state.machine;
    const widget = state.widget;
    const defaultWidgets = widget.developerPanel.default.widgets;
    const primaryWidgets = widget.developerPanel.primary.widgets;
    return {
        port,
        defaultWidgets,
        primaryWidgets
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(PROTOCOL_SCREEN, gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);
