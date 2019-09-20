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
import Firmware from './Firmware';
import HeaterControl from './HeaterControl';
import PrintablePlate from './PrintablePlate';
import store from '../../store';
import styles from './index.styl';
import { TEMPERATURE_MIN, TEMPERATURE_MAX } from './constants';

const MAX_LINE_POINTS = 300;

const normalizeToRange = (n, min, max) => {
    return Math.max(Math.min(n, max), min);
};

class DeveloperPanel extends PureComponent {
    static propTypes = {
        port: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    textarea = React.createRef();

    monitor = React.createRef();

    printableArea = null;

    scene = null;

    state = {
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
        bedTargetTemperature: 60,
        calibrationZOffset: 0.1,
        calibrationMargin: 0,
        gcodeFile: '',
        updateFile: '',
        targetString: '',
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
        switchOn: () => {
            this.props.executeGcode('M1024');
        },
        switchOff: () => {
            this.props.executeGcode('switch off');
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
        updateLine: (nozzleTemperature) => {
            const { vertices } = this.line.geometry;
            vertices.push(vertices.shift());
            vertices[MAX_LINE_POINTS - 1] = new Vector3(this.timeStamp, nozzleTemperature, 0);
            this.line.geometry.verticesNeedUpdate = true;
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
            this.camera.position.x = this.timeStamp > 300 ? this.timeStamp - 90 : 210;
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
            if (controllerState && controllerState.temperature.t) {
                this.actions.updateLine(Number(state.temperature.t));
            }
            this.setState({
                controller: {
                    ...this.state.controller,
                    state: state
                }
            });
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
        'serialport:read': (data) => {
            const targetString = this.state.targetString || '';
            if (!isEmpty(targetString) && data.match(targetString)) {
                this.textarea.value += `${data}\n`;
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
        const width = this.getVisibleWidth();
        // const height = this.getVisibleHeight();
        const geometry = new Geometry();
        for (let i = 0; i < MAX_LINE_POINTS; i++) {
            geometry.vertices.push(
                new Vector3(0, 0, 0)
            );
        }
        const material = new LineBasicMaterial({ color: 0x0000ff });
        this.timeStamp = 0;
        this.line = new Line(geometry, material);
        this.line.geometry.dynamic = true;
        // avoid computing boundingbox
        this.line.frustumCulled = false;
        this.printableArea = new PrintablePlate(size);

        // this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
        this.camera = new PerspectiveCamera(45, 1.0, 0.1, 10000);
        this.camera.position.copy(new Vector3(210, 60, 600));
        this.renderer = new WebGLRenderer({ antialias: true });
        // this.renderer.setClearColor(new Color(0xfafafa), 1);
        this.renderer.setClearColor(new Color(0xffffff), 1);
        // this.renderer.setSize(width, height);
        this.renderer.setSize(width, width);
        // this.renderer.setSize(586, 586);

        this.scene = new Scene();
        this.scene.add(this.printableArea);
        this.scene.add(this.line);
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
        const { defaultWidgets, renderStamp, machineSetting } = this.state;
        const { calibrationZOffset, calibrationMargin, extrudeLength, extrudeSpeed, gcodeFile, updateFile, bedTargetTemperature, nozzleTargetTemperature } = this.state;
        const controllerState = this.state.controller.state || {};
        const { updateProgress = 0, updateCount = 0, firmwareVersion = '', newProtocolEnabled, temperature } = controllerState;
        const canClick = !!this.props.port;
        return (
            <div>

                <div className={styles['developer-panel']}>
                    <PrimaryWidgets
                        defaultWidgets={defaultWidgets}
                    />
                    <p style={{ margin: '12px 18px 12px 0' }}>{i18n._('Switch Protocol')}</p>
                    <div className="btn-group btn-group-sm">
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
                                onClick={this.actions.switchOff}
                            >
                                <i className="fa fa-toggle-on" />
                                {i18n._('Off')}
                            </button>
                        )}
                    </div>
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
                                onChange={(event) => {
                                    const { value } = event.target;
                                    this.setState({ targetString: value });
                                }}
                            />
                            <TextArea
                                style={{ width: '586px' }}
                                minRows={30}
                                maxRows={30}
                                inputRef={(tag) => {
                                    this.textarea = tag;
                                }}
                            />
                            <div>
                                <button className={styles['btn-calc']} type="button" onClick={() => { this.textarea.value = ''; }}>{i18n._('Clear')}</button>
                            </div>
                        </Tab>
                        <Tab
                            eventKey="calibration"
                            title={i18n._('Calibration')}
                            disabled={!newProtocolEnabled}
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
                            disabled={!newProtocolEnabled}
                        >
                            <GcodeFile
                                gcodeFile={gcodeFile}
                                onChangeGcodeFile={this.actions.onChangeGcodeFile}
                                executeGcode={this.props.executeGcode}
                            />
                        </Tab>
                        <Tab
                            eventKey="update"
                            title={i18n._('Update')}
                            disabled={!newProtocolEnabled}
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
                            disabled={!newProtocolEnabled}
                        >
                            <Setting
                                renderStamp={renderStamp}
                                machineSetting={machineSetting}
                                changeMachineSetting={this.actions.changeMachineSetting}
                                getMachineSetting={this.actions.getMachineSetting}
                                executeGcode={this.props.executeGcode}
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

    return {
        port
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);
