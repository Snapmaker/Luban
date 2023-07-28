/* eslint-disable import/no-cycle */
import events from 'events';

import { actions as workspaceActions } from '.';
import {
    CONNECTION_CLOSE,
    CONNECTION_CLOSE_IMPROPER,
    CONNECTION_COORDINATE_MOVE,
    CONNECTION_EXECUTE_GCODE,
    CONNECTION_GO_HOME,
    CONNECTION_HEARTBEAT,
    CONNECTION_OPEN,
    CONNECTION_SET_WORK_ORIGIN,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STOP_GCODE,
    CONNECTION_TYPE_SERIAL,
    CONNECTION_TYPE_WIFI,
} from '../../constants';
import { controller } from '../../lib/controller';
import log from '../../lib/log';
import { dispatch } from '../../store';
import { machineStore } from '../../store/local-storage';
import baseActions from './actions-base';
import connectActions from './actions-connect';
import ControllerEvent from '../../connection/controller-events';

/**
 * Server represents HTTP Server on Snapmaker 2.
 */

const isNotNull = (value) => {
    return value !== null && value !== undefined;
};

export class Server extends events.EventEmitter {
    gcodePrintingInfo = {};

    constructor({ name = '', address = '', model, port = '', sacp = '', addByUser = false }) {
        super();
        this.name = name;
        this.address = address;
        this.token = '';
        this.port = port;
        this.model = model || 'Unknown Model';
        this.selected = false;
        this.addByUser = addByUser;
        this.sacp = sacp;
    }

    get isWifi() {
        return Boolean(this.address);
    }

    openServer(callback) {
        log.warn(`open server ${this.address}, sacp = ${this.sacp}`);

        controller
            .emitEvent(CONNECTION_OPEN, {
                host: this.host,
                token: this.token,
                connectionType: this.isWifi ? CONNECTION_TYPE_WIFI : CONNECTION_TYPE_SERIAL,
                port: this.port,
                sacp: this.sacp,
                addByUser: this.addByUser,
                address: this.address
            })
            .once(CONNECTION_OPEN, ({ msg, data, text, code }) => {
                if (msg) {
                    callback && callback({ msg, data, text, code });
                    return;
                }
                if (this.isWifi) {
                    dispatch(baseActions.updateState({
                        isOpen: true,
                        connectionStatus: CONNECTION_STATUS_CONNECTING
                    }));
                    if (data?.token) {
                        this.token = data?.token;
                    }
                    dispatch(connectActions.setServerAddress(this.address));
                    dispatch(connectActions.setServerName(this.name));
                    dispatch(connectActions.setServerToken(this.token));

                    // Start heartbeat
                    // delay 1000ms to make sure machine state is correct
                    setTimeout(() => {
                        controller.emitEvent(CONNECTION_HEARTBEAT);
                    }, 1000);

                    callback && callback({ msg, text });
                } else {
                    dispatch(workspaceActions.resetMachineState(CONNECTION_TYPE_SERIAL));
                    machineStore.set('port', this.port);
                }
            });
    }

    closeServer() {
        controller.emitEvent(CONNECTION_CLOSE)
            .once(CONNECTION_CLOSE, () => {
                dispatch(workspaceActions.resetMachineState());
                dispatch(workspaceActions.updateMachineState({
                    headType: '',
                    toolHead: ''
                }));
            });
    }

    closeServerImproper() {
        controller.emitEvent(CONNECTION_CLOSE_IMPROPER)
            .once(CONNECTION_CLOSE_IMPROPER, () => {
                dispatch(workspaceActions.resetMachineState());
                dispatch(workspaceActions.updateMachineState({
                    headType: '',
                    toolHead: ''
                }));
            });

        // No matter success or not, clear state
        dispatch(workspaceActions.resetMachineState());
        dispatch(workspaceActions.updateMachineState({
            headType: '',
            toolHead: ''
        }));
    }

    coordinateMove(moveOrders, gcode, jogSpeed, headType) {
        controller.emitEvent(CONNECTION_COORDINATE_MOVE, { moveOrders, gcode, jogSpeed, headType }, () => {
            // homed
        });
    }

    setWorkOrigin(xPosition, yPosition, zPosition, bPosition) {
        controller.emitEvent(CONNECTION_SET_WORK_ORIGIN, { xPosition, yPosition, zPosition, bPosition });
    }

    executeGcode(gcode, context, cmd) {
        return new Promise((resolve) => {
            controller
                .emitEvent(CONNECTION_EXECUTE_GCODE, { gcode, context, cmd })
                .once(CONNECTION_EXECUTE_GCODE, () => {
                    resolve();
                });
        });
    }

    startServerGcode(args, callback) {
        controller
            .emitEvent(ControllerEvent.StartGCode, args)
            .once(ControllerEvent.StartGCode, ({ msg, code }) => {
                dispatch(baseActions.updateState({
                    isSendedOnWifi: true
                }));
                if (msg) {
                    callback && callback({ msg, code });
                    return;
                }
                if (this.isWifi) {
                    this.gcodePrintingInfo.startTime = new Date().getTime();
                }
            });

        dispatch(baseActions.updateState({
            isSendedOnWifi: false
        }));
    }

    pauseServerGcode(callback) {
        controller
            .emitEvent(ControllerEvent.PauseGCode)
            .once(ControllerEvent.PauseGCode, (options) => {
                callback && callback(options);
            });
    }

    resumeServerGcode(args, callback) {
        controller
            .emitEvent(ControllerEvent.ResumeGCode, args, callback)
            .once(ControllerEvent.ResumeGCode, (options) => {
                callback && callback(options);
            });
    }

    stopServerGcode(callback) {
        controller.emitEvent(CONNECTION_STOP_GCODE, { eventName: CONNECTION_STOP_GCODE })
            .once(CONNECTION_STOP_GCODE, (options) => {
                callback && callback();
                const { msg, code, data } = options;
                if (msg) {
                    callback && callback({ msg, code, data });
                    return;
                }
                dispatch(baseActions.updateState({
                    isSendedOnWifi: true
                }));
            });
    }

    goHome(data, callback) {
        controller.emitEvent(CONNECTION_GO_HOME, data, callback);
    }

    setToken(token) {
        this.token = token;
    }

    get host() {
        return `http://${this.address}:8080`;
    }

    equals(server) {
        const { name, address } = server;
        return (name && name === this.name && address && address === this.address);
    }

    receiveHeartbeat = (data, code) => {
        if (code === 204) { // No Content
            return;
        }

        const { status, x, y, z, b, offsetX, offsetY, offsetZ } = data;

        this.status = status.toLowerCase();
        this.state.workPosition = {
            x: x,
            y: y,
            z: z,
            b: b
        };
        this.state.originOffset = {
            x: offsetX,
            y: offsetY,
            z: offsetZ
        };

        isNotNull(data.homed) && (this.state.isHomed = data.homed);
        isNotNull(data.laserFocalLength) && (this.state.laserFocalLength = data.laserFocalLength);
        isNotNull(data.laserPower) && (this.state.laserPower = data.laserPower);
        isNotNull(data.laserCamera) && (this.state.laserCamera = data.laserCamera);
        isNotNull(data.workSpeed) && (this.state.workSpeed = data.workSpeed);
        isNotNull(data.nozzleTemperature) && (this.state.nozzleTemperature = data.nozzleTemperature);
        isNotNull(data.nozzleTargetTemperature) && (this.state.nozzleTargetTemperature = data.nozzleTargetTemperature);
        isNotNull(data.heatedBedTemperature) && (this.state.heatedBedTemperature = data.heatedBedTemperature);
        isNotNull(data.heatedBedTargetTemperature) && (this.state.heatedBedTargetTemperature = data.heatedBedTargetTemperature);
        isNotNull(data.isEnclosureDoorOpen) && (this.state.isEnclosureDoorOpen = data.isEnclosureDoorOpen);
        isNotNull(data.doorSwitchCount) && (this.state.doorSwitchCount = data.doorSwitchCount);
        isNotNull(data.isEmergencyStopped) && (this.state.isEmergencyStopped = data.isEmergencyStopped);
        isNotNull(data.laser10WErrorState) && (this.state.laser10WErrorState = data.laser10WErrorState);
        // this state controls filter widget disable
        this.state.airPurifier = isNotNull(data.airPurifierSwitch);
        isNotNull(data.airPurifierSwitch) && (this.state.airPurifierSwitch = data.airPurifierSwitch);
        isNotNull(data.airPurifierFanSpeed) && (this.state.airPurifierFanSpeed = data.airPurifierFanSpeed);
        isNotNull(data.airPurifierFilterHealth) && (this.state.airPurifierFilterHealth = data.airPurifierFilterHealth);
        isNotNull(data.moduleList) && (this.state.moduleStatusList = data.moduleList);
        // this._updateGcodePrintingInfo(data);
        if (this.waitConfirm) {
            this.waitConfirm = false;
            this.isConnected = true;
            this.emit('http:confirm', { data: this._getStatus() });
        } else {
            this.emit('http:status', { data: this._getStatus() });
        }
    };


    _getStatus = () => {
        return {
            status: this.status,
            x: this.state.workPosition.x,
            y: this.state.workPosition.y,
            z: this.state.workPosition.z,
            b: this.state.workPosition.b,
            offsetX: this.state.originOffset.x,
            offsetY: this.state.originOffset.y,
            offsetZ: this.state.originOffset.z,
            series: this.state.series,
            headType: this.state.headType,
            toolHead: this.state.toolHead,
            isHomed: this.state.isHomed,
            enclosure: this.state.enclosure,
            laserFocalLength: this.state.laserFocalLength,
            laserPower: this.state.laserPower,
            laserCamera: this.state.laserCamera,
            workSpeed: this.state.workSpeed,
            isEnclosureDoorOpen: this.state.isEnclosureDoorOpen,
            doorSwitchCount: this.state.doorSwitchCount,
            nozzleTemperature: this.state.nozzleTemperature,
            nozzleTargetTemperature: this.state.nozzleTargetTemperature,
            heatedBedTemperature: this.state.heatedBedTemperature,
            heatedBedTargetTemperature: this.state.heatedBedTargetTemperature,
            gcodePrintingInfo: this.state.gcodePrintingInfo,
            isEmergencyStopped: this.state.isEmergencyStopped,
            laser10WErrorState: this.state.laser10WErrorState,
            airPurifier: this.state.airPurifier,
            airPurifierSwitch: this.state.airPurifierSwitch,
            airPurifierFanSpeed: this.state.airPurifierFanSpeed,
            airPurifierFilterHealth: this.state.airPurifierFilterHealth,
            moduleStatusList: this.state.moduleStatusList
        };
    };

    // TODO: to refactor

    isJSON = (str) => {
        if (typeof str === 'string') {
            try {
                const obj = JSON.parse(str);
                if (typeof obj === 'object' && obj) {
                    return true;
                } else {
                    return false;
                }
            } catch (e) {
                return false;
            }
        }
        return false;
    };

    _getResult = (err, res) => {
        if (err) {
            if (res && this.isJSON(res.text) && JSON.parse(res.text).code === 202) {
                return {
                    msg: err.message,
                    code: 202,
                    text: res && res.text,
                    data: res && res.body
                };
            } else if (res && this.isJSON(res.text) && JSON.parse(res.text).code === 203) {
                return {
                    msg: err.message,
                    code: 203,
                    text: res && res.text,
                    data: res && res.body
                };
            } else {
                return {
                    msg: err.message,
                    code: res && res.status,
                    text: res && res.text,
                    data: res && res.body
                };
            }
        }
        const code = res.status;
        if (code !== 200 && code !== 204 && code !== 203) {
            return {
                code,
                msg: res && res.text
            };
        }
        return {
            code,
            msg: '',
            data: res.body,
            text: res.text
        };
    };

    getGcodePrintingInfo(data) {
        if (!data) {
            return {};
        }
        const { currentLine, estimatedTime, totalLines, fileName = '', progress, elapsedTime, remainingTime, printStatus } = data;
        if (!currentLine || !estimatedTime || !totalLines) {
            return {};
        }
        const sent = currentLine || 0;
        const received = currentLine || 0;
        const total = totalLines || 0;
        let finishTime = 0;
        if (received > 0 && received >= totalLines) {
            finishTime = new Date().getTime();
        }
        this.gcodePrintingInfo = {
            ...this.gcodePrintingInfo,
            sent,
            received,
            total,
            finishTime,
            estimatedTime: estimatedTime * 1000,
            elapsedTime: elapsedTime * 1000,
            remainingTime: remainingTime * 1000,
            fileName,
            progress,
            printStatus
        };
        return this.gcodePrintingInfo;
    }

    static closeServerAfterWindowReload() {
        controller.emitEvent(CONNECTION_CLOSE)
            .once(CONNECTION_CLOSE, () => {
                dispatch(workspaceActions.resetMachineState());
                dispatch(workspaceActions.updateMachineState({
                    headType: '',
                    toolHead: ''
                }));
            });
    }
}
