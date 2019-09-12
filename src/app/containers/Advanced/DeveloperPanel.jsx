import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Tabs, Tab } from 'react-bootstrap';
// import pick from 'lodash/pick';

import { actions as machineActions } from '../../flux/machine';
import Connection from '../../widgets/Connection';
import Axes from '../../widgets/Axes';
import { NumberInput } from '../../components/Input';
import api from '../../api';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
// import log from '../../lib/log';
import Calibration from './Calibration';
import GcodeFile from './GcodeFile';
import Firmware from './Firmware';
import HeaterControl from './HeaterControl';
import styles from './index.styl';
import { TEMPERATURE_MIN, TEMPERATURE_MAX } from './constants';

const normalizeToRange = (n, min, max) => {
    return Math.max(Math.min(n, max), min);
};

class DeveloperPanel extends PureComponent {
    static propTypes = {
        port: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    state = {
        extrudeLength: 10,
        extrudeSpeed: 200,
        nozzleTargetTemperature: 200,
        bedTargetTemperature: 60,
        calibrationZOffset: 0.1,
        calibrationMargin: 0,
        // gcodeFile: '',
        // updateFile: '',
        gcodeFile: 't1.gcode',
        updateFile: 't2.bin',
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
        }
    };

    controllerEvents = {
        'Marlin:state': (state) => {
            this.setState({
                controller: {
                    ...this.state.controller,
                    state: state
                }
            });
        }
    };

    componentDidMount() {
        this.addControllerEvents();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
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
        const { calibrationZOffset, calibrationMargin, extrudeLength, extrudeSpeed, gcodeFile, updateFile, bedTargetTemperature, nozzleTargetTemperature } = this.state;
        const controllerState = this.state.controller.state || {};
        const { updateProgress, updateCount, firmwareVersion, newProtocolEnabled, temperature } = controllerState;
        const canClick = !!this.props.port;
        return (
            <div>
                <div className={styles['developer-panel']}>
                    <Connection widgetId="connection" />
                </div>
                <div className={styles['developer-panel']}>
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
                <Tabs className={styles['primary-tab']} id="primary-tabs">
                    <Tab
                        eventKey="control"
                        title="Control"
                    >
                        <div className={styles['developer-panel']}>
                            <Axes widgetId="axes" />
                        </div>
                        <div className={styles['developer-panel']}>
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.extrude()}>Extrude</button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.retract()}>Retract</button>
                        </div>
                        <div className={styles['developer-panel']}>
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
                    </Tab>
                    <Tab
                        eventKey="calibration"
                        title="Calibration"
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
                        title="Gcode"
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
                        title="Update"
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
                </Tabs>
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
