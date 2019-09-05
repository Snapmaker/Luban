import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
// import pick from 'lodash/pick';

import { actions as machineActions } from '../../flux/machine';
import { actions as workspaceActions } from '../../flux/workspace';
import Connection from '../../widgets/Connection';
import api from '../../api';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import controller from '../../lib/controller';
// import log from '../../lib/log';
import styles from './index.styl';


class DeveloperPanel extends PureComponent {
    static propTypes = {
        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        gcodeList: PropTypes.array.isRequired,
        addGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        loadGcode: PropTypes.func.isRequired,
        unloadGcode: PropTypes.func.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    fileInput = React.createRef();
    /*
    state = {
    };
    */

    controllerEvents = {
        'serialport:open': () => {
            this.actions.loadGcode();
        },
        'serialport:close': () => {
            this.props.unloadGcode();
        }
    };

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        /*
        onChangeFile: (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onloadend = (e) => {
                const { result, error } = e.target;

                if (error) {
                    return;
                }

                log.debug('FileReader:', pick(file, [
                    'lastModified',
                    'lastModifiedDate',
                    'meta',
                    'name',
                    'size',
                    'type'
                ]));
                this.actions.addGcode(file.name, result);
            };
            try {
                reader.readAsText(file);
            } catch (err) {
                // Ignore error
            }
        },
        */
        onChangeFile: async (event) => {
            const file = event.target.files[0];
            try {
                await this.actions.upload(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to upload file'),
                    body: e.message
                });
            }
        },
        upload: async (file) => {
            const formData = new FormData();
            const { port } = this.props.port;
            // TODO port -> null
            // const port = '/dev/ttyUSB0';
            formData.append('file', file);
            formData.append('port', port);
            await api.uploadGcodeFile(formData);
            // const res = await api.uploadGcodeFile(formData);
            // const { originalName, uploadName } = res.body;
        },
        addGcode: (name, gcode, renderMethod = 'line') => {
            this.props.clearGcode();
            this.props.addGcode(name, gcode, renderMethod);
        },
        loadGcode: (gcodeList) => {
            gcodeList = gcodeList || this.props.gcodeList;
            if (gcodeList.length === 0) {
                return;
            }
            // Upload G-code to controller if connected
            const { port } = this.props;
            if (!port) {
                return;
            }
            const name = gcodeList[0].name;
            const gcode = gcodeList.map(gcodeBean => gcodeBean.gcode).join('\n');
            this.props.loadGcode(port, name, gcode);
        },
        switch: () => {
            // TODO need to send two times
            this.props.executeGcode('M1024');
            this.props.executeGcode('M1024');
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
        },
        sendCommand: (cmd) => {
            this.props.executeGcode(cmd);
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
        return (
            <div className={styles['laser-table']}>
                <div className={styles['laser-table-row']}>
                    <div style={{ width: '30%' }}>
                        <Connection widgetId="connection" />
                    </div>
                    <div className={styles['svg-control-bar']}>
                        <p>Switch Protocol</p>
                        <button type="button" onClick={() => this.actions.switch()}>Switch</button>
                    </div>
                    <div className={styles['svg-control-bar']}>
                        <p>Motion</p>
                        <button type="button" onClick={() => this.actions.sendCommand('G1 X5')}>JogX</button>
                        <button type="button" onClick={() => this.actions.sendCommand('G28')}>Home</button>
                        <button type="button" onClick={() => this.actions.zUp()}>Z Up</button>
                        <button type="button" onClick={() => this.actions.zDown()}>Z Down</button>
                    </div>
                    <div className={styles['svg-control-bar']}>
                        <p>File</p>
                        <input
                            ref={this.fileInput}
                            type="file"
                            accept=".gcode, .nc, .cnc"
                            style={{ display: 'none' }}
                            multiple={false}
                            onChange={this.actions.onChangeFile}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                this.actions.onClickToUpload();
                                // this.actions.sendCommand('load print file');
                            }}
                        >
                            Upload
                        </button>
                        <button type="button" onClick={() => this.actions.sendCommand('start print file')}>Start</button>
                    </div>
                    <div className={styles['svg-control-bar']}>
                        <p>Calibration</p>
                        <button type="button" onClick={() => this.actions.sendCommand('start auto calibration')}>Start Auto Calibration</button>
                        <button type="button" onClick={() => this.actions.sendCommand('start manual calibration')}>Start Manual Calibration</button>
                        <button type="button" onClick={() => this.actions.gotoCalibrationPoint(1)}>Point 1</button>
                        <button type="button" onClick={() => this.actions.gotoCalibrationPoint(5)}>Point 5</button>
                        <button type="button" onClick={() => this.actions.gotoCalibrationPoint(9)}>Point 9</button>
                        <button type="button" onClick={() => this.actions.changeCalibrationZOffset(10)}>Calibration Z</button>
                        <button type="button" onClick={() => this.actions.sendCommand('reset calibration')}>Reset Calibration</button>
                        <button type="button" onClick={() => this.actions.sendCommand('exit calibration')}>Exit Calibration</button>
                        <button type="button" onClick={() => this.actions.sendCommand('save calibration')}>Save Calibration</button>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { port, server } = state.machine;
    const { gcodeList } = state.workspace;


    return {
        port,
        server,
        gcodeList
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        addGcode: (name, gcode, renderMethod) => dispatch(workspaceActions.addGcode(name, gcode, renderMethod)),
        clearGcode: () => dispatch(workspaceActions.clearGcode()),
        loadGcode: (port, name, gcode) => dispatch(workspaceActions.loadGcode(port, name, gcode)),
        unloadGcode: () => dispatch(workspaceActions.unloadGcode()),
        executeGcode: (gcode, context) => dispatch(machineActions.executeGcode(gcode, context))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);

// export default DeveloperPanel;
