import events from 'events';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    MACHINE_SERIES,
    WORKFLOW_STATUS_UNKNOWN,
    CONNECTION_HEARTBEAT,
    LEVEL_TWO_POWER_LASER_FOR_SM2, STANDARD_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_ONE_POWER_LASER_FOR_SM2, SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_IDLE,
    // CONNECTION_OPEN,
    CONNECTION_CLOSE,
    CONNECTION_EXECUTE_GCODE,
    CONNECTION_START_GCODE,
    CONNECTION_RESUME_GCODE,
    CONNECTION_PAUSE_GCODE,
    CONNECTION_STOP_GCODE,
    // CONNECTION_GET_GCODEFILE
} from '../../constants';
import { valueOf } from '../../lib/contants-utils';
import { controller } from '../../lib/controller';
import { actions as workspaceActions } from '../workspace';
import { actions as machineActions } from './index.js';
import { dispatch } from '../../store';

/**
 * Server represents HTTP Server on Snapmaker 2.
 */

const isNotNull = (value) => {
    return value !== null && value !== undefined;
};

export class Server extends events.EventEmitter {
    statusTimer = null;

    errorCount = 0;

    gcodeInfos = [];

    isGcodeExecuting = false;

    constructor(name = '', address = '', port = '') {
        super();
        this.name = name;
        this.address = address;
        this.token = '';
        this.port = port || 8080;
        // this.model = model || 'Unknown Model';
        this.selected = false;
        this._stateInit();
    }

    get isWifi() {
        return Boolean(this.address);
    }

    closeServer() {
        controller.emitEvent(CONNECTION_CLOSE)
            .once(CONNECTION_CLOSE, (options) => {
                console.log('options', options);
                this._closeServer();
                dispatch(machineActions.resetMachineState());
                dispatch(workspaceActions.updateMachineState({
                    headType: '',
                    toolHead: ''
                }));
            });
    }

    executeGcode(gcode, context, cmd) {
        controller
            .emitEvent(CONNECTION_EXECUTE_GCODE, { gcode, context, cmd })
            .once(CONNECTION_EXECUTE_GCODE, (gcodeArray) => {
                if (gcodeArray) {
                    dispatch(machineActions.addConsoleLogs(gcodeArray));
                }
            });
    }

    startServerGcode(args, callback) {
        controller.emitEvent(CONNECTION_START_GCODE, args)
            .once(CONNECTION_START_GCODE, ({ msg, code }) => {
                dispatch(machineActions.updateState({
                    isSendedOnWifi: true
                }));
                if (msg) {
                    callback && callback({ msg, code });
                    return;
                }
                if (this.isWifi) {
                    this.state.gcodePrintingInfo.startTime = new Date().getTime();
                    dispatch(machineActions.updateState({
                        workflowStatus: WORKFLOW_STATUS_RUNNING
                    }));
                }
            });

        dispatch(machineActions.updateState({
            isSendedOnWifi: false
        }));
    }

    resumeServerGcode(args, callback) {
        controller.emitEvent(CONNECTION_RESUME_GCODE, args)
            .once(CONNECTION_RESUME_GCODE, (options) => {
                callback && callback(options);
            });
    }

    pauseServerGcode(callback) {
        controller.emitEvent(CONNECTION_PAUSE_GCODE)
            .once(CONNECTION_PAUSE_GCODE, (options) => {
                callback && callback(options);
            });
    }

    stopServerGcode(callback) {
        controller.emitEvent(CONNECTION_STOP_GCODE)
            .once(CONNECTION_STOP_GCODE, (options) => {
                const { msg, code, data } = options;
                if (msg) {
                    callback && callback({ msg, code, data });
                    return;
                }
                dispatch(machineActions.updateState({
                    workflowStatus: WORKFLOW_STATUS_IDLE
                }));
            });
    }

    setToken(token) {
        this.token = token;
    }

    _stateInit() {
        this.token = '';
        this.isConnected = false;
        this.waitConfirm = false;
        this.status = WORKFLOW_STATUS_UNKNOWN;
        this.state = {
            series: '',
            pattern: '',
            isHomed: null,
            enclosure: false,
            laserFocalLength: null,
            laserPower: null,
            laserCamera: null,
            workSpeed: null,
            nozzleTemperature: 0,
            nozzleTargetTemperature: 0,
            heatedBedTemperature: 0,
            heatedBedTargetTemperature: 0,
            isEnclosureDoorOpen: false,
            doorSwitchCount: 0,
            workPosition: {
                x: 0,
                y: 0,
                z: 0
            },
            originOffset: {
                x: 0,
                y: 0,
                z: 0
            },
            gcodePrintingInfo: {
                sent: 0,
                received: 0,
                total: 0,
                startTime: 0,
                finishTime: 0,
                elapsedTime: 0,
                remainingTime: 0
            },
            isEmergencyStopped: false,
            laser10WErrorState: 0,
            airPurifier: false,
            airPurifierSwitch: false,
            airPurifierFanSpeed: 1,
            airPurifierFilterHealth: 0,
            headType: '',
            toolHead: '',
            moduleStatusList: {}
        };
    }

    _closeServer() {
        this._stateInit();
    }

    get host() {
        return `http://${this.address}:${this.port}`;
    }

    equals(server) {
        const { name, address } = server;
        return (name && name === this.name && address && address === this.address);
    }

    open = (options, callback) => {
        const { msg, data, code, text } = options;
        if (this.token && code === 403) {
            this.token = '';
            this.open(callback);
        }
        if (msg) {
            callback({ msg, status: code }, data, text);
            return;
        }
        if (data) {
            const { series } = data;
            const seriesValue = valueOf(MACHINE_SERIES, 'alias', series);
            data.series = seriesValue ? seriesValue.value : null;

            let headType = data.headType;
            let toolHead;
            switch (data.headType) {
                case 1:
                    headType = HEAD_PRINTING;
                    toolHead = SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2;
                    break;
                case 2:
                    headType = HEAD_CNC;
                    toolHead = STANDARD_CNC_TOOLHEAD_FOR_SM2;
                    break;
                case 3:
                    headType = HEAD_LASER;
                    toolHead = LEVEL_ONE_POWER_LASER_FOR_SM2;
                    break;
                case 4:
                    headType = HEAD_LASER;
                    toolHead = LEVEL_TWO_POWER_LASER_FOR_SM2;
                    break;
                default:
                    headType = data.headType;
                    toolHead = undefined;
            }
            this.state.series = data.series;
            this.state.headType = headType;
            this.state.toolHead = toolHead;
        }

        this.waitConfirm = true;
        this.startHeartbeat();
        callback({ data });
    };

    startHeartbeat = () => {
        // NOTE: For heartbeat, must keep listening to the change event
        controller.emitEvent(CONNECTION_HEARTBEAT)
            .on(CONNECTION_HEARTBEAT, (result) => {
                const { status, msg, res } = result;
                if (status === 'offline') {
                    this.emit('http:close', { err: msg });
                } else {
                    const { data, code } = this._getResult(null, res);
                    this.receiveHeartbeat(data, code);
                }
            });
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
        this._updateGcodePrintingInfo(data);

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
    }

    _updateGcodePrintingInfo(data) {
        if (!data) {
            return;
        }
        const { currentLine, estimatedTime, totalLines, fileName = '', progress, elapsedTime, remainingTime, printStatus } = data;
        if (!currentLine || !estimatedTime || !totalLines) {
            return;
        }
        const sent = currentLine || 0;
        const received = currentLine || 0;
        const total = totalLines || 0;
        let finishTime = 0;
        if (received > 0 && received >= totalLines) {
            finishTime = new Date().getTime();
        }
        this.state.gcodePrintingInfo = {
            ...this.state.gcodePrintingInfo,
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
    }
}
