import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
// import pick from 'lodash/pick';

import { actions as machineActions } from '../../flux/machine';
import Connection from '../../widgets/Connection';
import { NumberInput } from '../../components/Input';
import api from '../../api';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
// import log from '../../lib/log';
import styles from './index.styl';


class DeveloperPanel extends PureComponent {
    static propTypes = {
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        zOffset: 0.1
    };

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
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
            await api.uploadGcodeFile(formData);
            // const res = await api.uploadGcodeFile(formData);
            // const { originalName, uploadName } = res.body;
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
            const res = await api.uploadGcodeFile(formData);
            const { uploadName } = res.body;
            console.log('llll', uploadName);
            if (uploadName) {
                // this.props.executeGcode('upload update file');
            }
        },
        onChangeZOffset: (zOffset) => {
            this.setState({ zOffset });
        },
        switch: () => {
            // TODO need to send two times
            this.props.executeGcode('M1024');
            // this.props.executeGcode('M1024');
        },
        zUp: () => {
            this.props.executeGcode('G91');
            this.props.executeGcode('G1 Z0.1 F200');
            this.props.executeGcode('G90');
        },
        zDown: () => {
            this.props.executeGcode('G91');
            this.props.executeGcode('G1 Z-0.1 F200');
            this.props.executeGcode('G90');
        },
        gotoCalibrationPoint: (point) => {
            this.props.executeGcode('go to calibration point', { point });
        },
        changeCalibrationZOffset: (zOffset) => {
            this.props.executeGcode('G91');
            this.props.executeGcode('change calibration z offset', { zOffset });
            this.props.executeGcode('G90');
        }
    };

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
        console.log('panel ', this.props.port, this.props.server);
        const { zOffset } = this.state;
        return (
            <div className={styles['laser-table']}>
                <div style={{ width: '30%' }}>
                    <Connection widgetId="connection" />
                </div>
                <div className={styles['developer-panel']}>
                    <p>Switch Protocol</p>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.switch()}>Switch</button>
                </div>
                <div className={styles['developer-panel']}>
                    <p>Motion</p>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('G1 X5')}>JogX</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('G28')}>Home</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.zUp()}>Z Up</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.actions.zDown()}>Z Down</button>
                </div>
                <div className={styles['developer-panel']}>
                    <p>G-Code File</p>
                    <input
                        ref={this.fileInput}
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
                            this.actions.onClickToUpload();
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
                                onChange={this.actions.onChangeZOffset}
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
                        ref={this.fileInput}
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
                            this.actions.onClickToUpload();
                        }}
                    >
                        Upload
                    </button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('start update')}>Update</button>
                    <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('query firmware version')}>Version</button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { port, server } = state.machine;


    return {
        port,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);

// export default DeveloperPanel;
