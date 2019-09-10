import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
// import pick from 'lodash/pick';

import { actions as machineActions } from '../../flux/machine';
import Connection from '../../widgets/Connection';
import Axes from '../../widgets/Axes';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput } from '../../components/Input';
import api from '../../api';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
// import log from '../../lib/log';
import styles from './index.styl';

const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 300;

const normalizeToRange = (n, min, max) => {
    return Math.max(Math.min(n, max), min);
};

class DeveloperPanel extends PureComponent {
    static propTypes = {
        port: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    gcodeFileRef = React.createRef();

    updateFileRef = React.createRef();

    state = {
        machineSettings: {
            xOffset: 167,
            yOffset: 169,
            zOffset: 150,
            xSize: 125,
            ySize: 125,
            zSize: 125,
            xMotorDir: 1,
            yMotorDir: 1,
            zMotorDir: 1,
            xHomeDir: 1,
            yHomeDir: 1,
            zHomeDir: 1
        }
        zOffset: 0.1,
        extrudeLength: 1,
        extrudeSpeed: 200,
        heaterControlSectionExpanded: false,
        nozzleTemperature: 200,
        bedTemperature: 60,
        controller
    };

    actions = {
        clickUploadGcodeFile: () => {
            this.gcodeFileRef.current.value = null;
            this.gcodeFileRef.current.click();
        },
        clickUploadUpdateFile: () => {
            this.updateFileRef.current.value = null;
            this.updateFileRef.current.click();
        },
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
            console.log('rrrrrrrrrrr', originalName);
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
            await api.uploadUpdateFile(formData);
        },
        changeDefaultSetting: () => {

        },
        onChangeDir: (value, key) => {
            value = -value;
            this.setState(state => ({
                machineSettings: {
                    ...state.machineSettings,
                    [key]: value
                }
            }));
        },
        onChangeXOffset: (value) => {
            this.setState((state) => ({
                machineSettings: {
                    ...state.machineSettings,
                    'xOffset': value
                }
            }));
        },
        onChangeYOffset: (value) => {
            this.setState((state) => ({
                machineSettings: {
                    ...state.machineSettings,
                    'yOffset': value
                }
            }));
        },
        onChangeZOffset: (value) => {
            this.setState((state) => ({
                machineSettings: {
                    ...state.machineSettings,
                    'zOffset': value
                }
            }));
        },
        onChangeXSize: (value) => {
            this.setState((state) => ({
                machineSettings: {
                    ...state.machineSettings,
                    'xSize': value
                }
            }));
        },
        onChangeYSize: (value) => {
            this.setState((state) => ({
                machineSettings: {
                    ...state.machineSettings,
                    'ySize': value
                }
            }));
        },
        onChangeZSize: (value) => {
            this.setState((state) => ({
                machineSettings: {
                    ...state.machineSettings,
                    'zSize': value
                }
            }));
        },
        switchOn: () => {
            this.props.executeGcode('M1024');
        },
        switchOff: () => {
            this.props.executeGcode('switch off');
        },
        gotoCalibrationPoint: (point) => {
            this.props.executeGcode('go to calibration point', { point });
        },
        changeCalibrationZOffset: (zOffset) => {
            this.props.executeGcode('G91');
            this.props.executeGcode('change calibration z offset', { zOffset });
            this.props.executeGcode('G90');
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
        changeNozzleTemperature: (nozzleTemperature) => {
            nozzleTemperature = normalizeToRange(nozzleTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ nozzleTemperature });
        },
        changeBedTemperature: (bedTemperature) => {
            bedTemperature = normalizeToRange(bedTemperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
            this.setState({ bedTemperature });
        },
        toggleHeaterControlSection: () => {
            this.setState({ heaterControlSectionExpanded: !this.state.heaterControlSectionExpanded });
        },
        onApplyHeadTemperature: () => {
            this.props.executeGcode(`M104 S${this.state.nozzleTemperature}`);
        },
        onCancelHeadTemperature: () => {
            this.props.executeGcode('M104 S0');
        },
        onApplyBedTemperature: () => {
            this.props.executeGcode(`M140 S${this.state.bedTemperature}`);
        },
        onCancelBedTemperature: () => {
            this.props.executeGcode('M140 S0');
        }
    };

    controllerEvents = {
        'Marlin:state': (state) => {
            console.log('state ', state);
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
<<<<<<< HEAD
        // console.log('panel ', this.props.port, this.props.server);
        const { xOffset, yOffset, zOffset, xSize, ySize, zSize } = this.state.machineSettings;
        const { machineSettings } = this.state;
=======
        const { zOffset, extrudeLength, extrudeSpeed, heaterControlSectionExpanded } = this.state;
        const controllerState = this.state.controller.state || {};
        const { newProtocolEnabled } = controllerState;
        const canClick = !!this.props.port;
        const heaterControlVisible = canClick && heaterControlSectionExpanded;
>>>>>>> backup
        return (
            <div className={styles['laser-table']}>
                <div style={{ width: '350px' }}>
                    <Connection widgetId="connection" />
                </div>
                <div className={styles['developer-panel']}>
                    <p>Switch Protocol</p>
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
                <div style={{ width: '350px' }}>
                    <Axes widgetId="axes" />
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('G28')}>Home</button>
                </div>
                <div>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.extrude()}>Extrude</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.retract()}>Retract</button>
                </div>
                <div>
                    <span style={{ marginLeft: '4px' }}>{i18n._('Length')}</span>
                    <NumberInput
                        style={{ width: '50px' }}
                        value={extrudeLength}
                        min={0}
                        max={100}
                        onChange={this.actions.changeExtrudeLength}
                    />
                    <span style={{ marginLeft: '4px' }}>mm @</span>
                    <NumberInput
                        style={{ width: '50px' }}
                        value={extrudeSpeed}
                        min={0}
                        max={1000}
                        onChange={this.actions.changeExtrudeSpeed}
                    />
                    <span style={{ marginLeft: '4px' }}>mm/min</span>
                </div>
                <div className={styles['developer-panel']}>
                    <p>G-Code File</p>
                    <input
                        ref={this.gcodeFileRef}
                        type="file"
                        accept=".gcode, .nc, .cnc"
                        style={{ display: 'none' }}
                        multiple={false}
                        onChange={this.actions.onChangeGcodeFile}
                    />
                    <button
                        className={styles['btn-func']}
                        type="button"
                        onClick={() => {
                            this.actions.clickUploadGcodeFile();
                        }}
                    >
                        Upload
                    </button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start print file')}>Start</button>
                </div>
                <div className={styles['developer-panel']}>
                    <p>Calibration</p>
                    <div>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start auto calibration')}>Auto</button>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start manual calibration')}>Manual</button>
                    </div>
                    <div>
                        <div>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(7)}>7</button>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(8)}>8</button>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(9)}>9</button>
                        </div>
                        <div>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(4)}>4</button>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(5)}>5</button>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(6)}>6</button>
                        </div>
                        <div>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(1)}>1</button>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(2)}>2</button>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.gotoCalibrationPoint(3)}>3</button>
                        </div>
                    </div>
                    <div>
                        <div>
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.changeCalibrationZOffset(zOffset)}>Z+</button>
                            <NumberInput
                                style={{ width: '50px' }}
                                value={zOffset}
                                min={-100}
                                max={100}
                                onChange={this.actions.changeZOffset}
                            />
                            <button className={styles['btn-cal']} type="button" onClick={() => this.actions.changeCalibrationZOffset(-zOffset)}>Z-</button>
                        </div>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('exit calibration')}>Exit</button>
                        <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('save calibration')}>Save</button>
                    </div>
                </div>
                <div className={styles['developer-panel']}>
                    <p>Update Firmware</p>
                    <input
                        ref={this.updateFileRef}
                        type="file"
                        accept=".bin"
                        style={{ display: 'none' }}
                        multiple={false}
                        onChange={this.actions.onChangeUpdateFile}
                    />
                    <button
                        className={styles['btn-func']}
                        type="button"
                        onClick={() => {
                            this.actions.clickUploadUpdateFile();
                        }}
                    >
                        Upload
                    </button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start update')}>Update</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('query firmware version')}>Version</button>
                </div>
<<<<<<< HEAD


                <div className={styles['developer-panel']}>
                    <p>Setting</p>

                    <ul style={{ listStyle: 'none' }}>
                        <li>
                            <p style={{ display: 'inline-block' }}>size:</p>
                            <p style={{ display: 'inline-block' }}>offset:</p>
                            <p style={{ display: 'inline-block' }}>motor direction:</p>
                            <p style={{ display: 'inline-block' }}>home direction:</p>
                            <p style={{ display: 'inline-block' }}>length:</p>
                            <p style={{ display: 'inline-block' }}>motor dividend:</p>
                        </li>
                        <li>
                            <i>X</i>
                            <NumberInput
                                style={{ width: '50px' }}
                                value={xSize}
                                onChange={this.actions.onChangeXSize}
                            />
                            <NumberInput
                                style={{ width: '50px' }}
                                value={xOffset}
                                onChange={this.actions.onChangeXOffset}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.onChangeDir(machineSettings.xMotorDir, 'xMotorDir')}>
                                {machineSettings.xMotorDir}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.onChangeDir(machineSettings.xHomeDir, 'xHomeDir')}>
                                {machineSettings.xHomeDir}
                            </button>
                        </li>
                        <li>
                            <i>Y</i>
                            <NumberInput
                                style={{ width: '50px' }}
                                value={ySize}
                                onChange={this.actions.onChangeYSize}
                            />
                            <NumberInput
                                style={{ width: '50px' }}
                                value={yOffset}
                                onChange={this.actions.onChangeYOffset}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.onChangeDir(machineSettings.yMotorDir, 'yMotorDir')}>
                                {machineSettings.yMotorDir}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.onChangeDir(machineSettings.yHomeDir, 'yHomeDir')}>
                                {machineSettings.yHomeDir}
                            </button>
                        </li>
                        <li>
                            <i>Z</i>
                            <NumberInput
                                style={{ width: '50px' }}
                                value={zSize}
                                onChange={this.actions.onChangeZSize}
                            />
                            <NumberInput
                                style={{ width: '50px' }}
                                value={zOffset}
                                onChange={this.actions.onChangeZOffset}
                            />
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.onChangeDir(machineSettings.zMotorDir, 'zMotorDir')}>
                                {machineSettings.zMotorDir}
                            </button>
                            <button className={styles['btn-func']} type="button" onClick={() => this.actions.onChangeDir(machineSettings.zHomeDir, 'zHomeDir')}>
                                {machineSettings.zHomeDir}
                            </button>
                        </li>

                        <li>
                            <i>E </i>
                            <i style={{ display: 'inline-block', width: '50px', textAlign: 'center' }}>NA</i>
                            <i style={{ display: 'inline-block', width: '50px', textAlign: 'center' }}>NA</i>
                        </li>

                    </ul>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('get settings')}>get machine settings</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('set settings', { machineSettings })}>set machine settings</button>

                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.changeDefaultSetting('standard')}>standard</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.changeDefaultSetting('plus')}>plus</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.changeDefaultSetting('pro')}>pro</button>

=======
                <div style={{ width: '300px' }}>
                    <Anchor className="sm-parameter-header" onClick={this.actions.toggleHeaterControlSection}>
                        <span className="fa fa-gear sm-parameter-header__indicator" />
                        <span className="sm-parameter-header__title">{i18n._('Heater Control')}</span>
                        <span className={classNames(
                            'fa',
                            heaterControlSectionExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                            'sm-parameter-header__indicator',
                            'pull-right',
                        )}
                        />
                    </Anchor>
                    {heaterControlVisible && (
                        <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '0' }}>
                                        <p style={{ margin: '0', padding: '0 6px' }}>{i18n._('Extruder')}</p>
                                    </td>
                                    <td style={{ width: '10%' }}>
                                        <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                            {controllerState.temperature.t}°C
                                        </div>
                                    </td>
                                    <td style={{ width: '35%' }}>
                                        <TipTrigger
                                            title={i18n._('Extruder')}
                                            content={i18n._('Set the target temperature of the nozzle in real-time.')}
                                        >
                                            <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                                <span style={{ margin: '0 4px' }}>/</span>
                                                <NumberInput
                                                    style={{ width: '50px' }}
                                                    value={this.state.nozzleTemperature}
                                                    min={TEMPERATURE_MIN}
                                                    max={TEMPERATURE_MAX}
                                                    onChange={this.actions.changeNozzleTemperature}
                                                    disabled={!canClick}
                                                />
                                                <span style={{ marginLeft: '4px' }}>°C</span>
                                            </div>
                                        </TipTrigger>
                                    </td>
                                    <td style={{ width: '20%' }}>
                                        <Anchor
                                            className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                            disabled={!canClick}
                                            onClick={this.actions.onApplyHeadTemperature}
                                        />
                                        <Anchor
                                            className={classNames('fa', 'fa-times', styles['fa-btn'])}
                                            disabled={!canClick}
                                            onClick={this.actions.onCancelHeadTemperature}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0' }}>
                                        <p style={{ margin: '0', padding: '0 6px' }}>{i18n._('Bed')}</p>
                                    </td>
                                    <td style={{ width: '10%' }}>
                                        <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                            {controllerState.temperature.b}°C
                                        </div>
                                    </td>
                                    <td style={{ width: '35%' }}>
                                        <TipTrigger
                                            title={i18n._('Heated Bed')}
                                            content={i18n._('Set the target temperature of the heated bed in real-time.')}
                                        >
                                            <div className="input-group input-group-sm">
                                                <span style={{ margin: '0 4px' }}>/</span>
                                                <NumberInput
                                                    style={{ width: '50px' }}
                                                    value={this.state.bedTemperature}
                                                    min={TEMPERATURE_MIN}
                                                    max={TEMPERATURE_MAX}
                                                    onChange={this.actions.changeBedTemperature}
                                                    disabled={!canClick}
                                                />
                                                <span style={{ marginLeft: '4px' }}>°C</span>
                                            </div>
                                        </TipTrigger>
                                    </td>
                                    <td>
                                        <Anchor
                                            className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                            aria-hidden="true"
                                            disabled={!canClick}
                                            onClick={this.actions.onApplyBedTemperature}
                                        />
                                        <Anchor
                                            className={classNames('fa', 'fa-times', styles['fa-btn'])}
                                            disabled={!canClick}
                                            onClick={this.actions.onCancelBedTemperature}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    )}
>>>>>>> backup
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
