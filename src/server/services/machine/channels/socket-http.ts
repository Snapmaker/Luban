// import store from '../../store';
import EventEmitter from 'events';
import { isEqual, isNil } from 'lodash';
import request from 'superagent';

import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, } from '../../../../app/constants/machines';
import DataStorage from '../../../DataStorage';
import {
    CONNECTION_TYPE_WIFI,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MACHINE_SERIES,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    STANDARD_CNC_TOOLHEAD_FOR_SM2
} from '../../../constants';
import SocketServer from '../../../lib/SocketManager';
import { valueOf } from '../../../lib/contants-utils';
import logger from '../../../lib/logger';
import workerManager from '../../task-manager/workerManager';
import { EventOptions } from '../types';

let waitConfirm: boolean;
const log = logger('lib:SocketHttp');


const isJSON = (str: string) => {
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

const _getResult = (err, res) => {
    if (err) {
        if (res && isJSON(res.text) && JSON.parse(res.text).code === 202) {
            return {
                msg: err.message,
                code: 202,
                text: res && res.text,
                data: res && res.body
            };
        } else if (res && isJSON(res.text) && JSON.parse(res.text).code === 203) {
            return {
                msg: err.message,
                code: 203,
                text: res && res.text,
                data: res && res.body
            };
        } else {
            return {
                msg: err.message,
                code: (res && res.status) || (err && err.code),
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
// let timeoutHandle = null;
let intervalHandle = null;

export type StateOptions = {
    headType?: string,
    toolHead?: string,
    series?: string
};

export type GcodeResult = {
    text?: string,
    data?: any,
    msg?: string,
    code?: number
};

/**
 * A singleton to manage devices connection.
 */
class SocketHttp extends EventEmitter {
    private isGcodeExecuting = false;

    private gcodeInfos = [];

    private socket: SocketServer = null;

    private host = '';

    private token = '';

    private state: StateOptions = {};

    private heartBeatWorker = null;

    private moduleSettings = null;

    private getLaserMaterialThicknessReq = null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onConnection = () => {
        this.stopHeartBeat();
    };

    public onDisconnection = () => {
        // empty
    };

    public init = () => {
        this.gcodeInfos = [];
        this.isGcodeExecuting = false;
    };

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        const { host, token } = options;
        this.host = host;
        this.token = token;
        this.socket = socket;
        this.init();
        log.debug(`wifi host="${this.host}" : token=${this.token}`);
        const api = `${this.host}/api/v1/connect`;
        request
            .post(api)
            .timeout(3000)
            .send(this.token ? `token=${this.token}` : '')
            .end((err, res) => {
                if (res?.body?.token) {
                    this.token = res.body.token;
                }

                const result = _getResult(err, res);
                if (err) {
                    log.debug(`err="${err}"`);
                    this.socket && this.socket.emit('connection:open', result);
                    return;
                }

                const { data } = result;
                if (data) {
                    const { series } = data;
                    const seriesValue = valueOf(MACHINE_SERIES, 'alias', series);
                    this.state.series = seriesValue ? seriesValue.value : null;

                    let headType = data.headType;
                    let toolHead: string;
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
                        case 5:
                            headType = HEAD_PRINTING;
                            toolHead = DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;
                            break;
                        default:
                            headType = HEAD_PRINTING;
                            toolHead = undefined;
                    }
                    this.state.headType = headType;
                    this.state.toolHead = toolHead;
                    if (!(this.state.series && headType && headType !== 'UNKNOWN')) {
                        this.socket && this.socket.emit('connection:open', {
                            msg: 'key-Workspace/Connection-The machine or toolhead cannot be correctly recognized. Make sure the firmware is up to date and the machine is wired correctly.',
                            code: 500,
                        });
                    } else {
                        this.socket && this.socket.emit('connection:open', result);
                    }
                }


                // Get module info
                this.getModuleList();

                // Get enclosure status (every 1000ms)
                clearInterval(intervalHandle);
                intervalHandle = setInterval(this.getEnclosureStatus, 1000);

                // Get Active extruder
                this.getActiveExtruder({ eventName: 'connection:getActiveExtruder' });
            });
    };

    public connectionClose = (socket: SocketServer, options: EventOptions) => {
        const { eventName } = options;
        if (this.host) {
            const api = `${this.host}/api/v1/disconnect`;
            request
                .post(api)
                .timeout(3000)
                .send(`token=${this.token}`)
                .end((err, res) => {
                    socket && socket.emit(eventName, _getResult(err, res));
                });
            this.host = '';
            this.token = '';
            this.stopHeartBeat();
        } else {
            socket && socket.emit(eventName, _getResult(new Error('connection not exist'), null));
        }
        clearInterval(intervalHandle);
    };

    public startHeartbeat = () => {
        this.stopHeartBeat();

        waitConfirm = true;
        this.heartBeatWorker = workerManager.heartBeat([{
            host: this.host,
            token: this.token
        }], (result: any) => {
            if (result.status === 'offline') {
                log.info(`[wifi connection offline]: msg=${result.msg}`);
                clearInterval(intervalHandle);
                this.socket && this.socket.emit('connection:close');
                return;
            }
            const { data, code } = _getResult(null, result.res);
            // No Content
            if (Object.keys(data).length === 0 || code === 204) {
                return;
            }
            const state = {
                ...data,
                ...this.state,
                gcodePrintingInfo: this.getGcodePrintingInfo(data),
                isHomed: data?.homed,
                status: data.status.toLowerCase(),
                airPurifier: !isNil(data.airPurifierSwitch),
                pos: {
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    b: data.b,
                    isFourAxis: !isNil(data.b)
                },
                originOffset: {
                    x: data.offsetX,
                    y: data.offsetY,
                    z: data.offsetZ,
                }
            };
            if (waitConfirm) {
                waitConfirm = false;

                this.socket && this.socket.emit('connection:connected', {
                    state,
                    err: state?.err,
                    type: CONNECTION_TYPE_WIFI
                });
            } else {
                // this.socket && this.socket.emit('sender:status', {
                //     data: this.getGcodePrintingInfo(state)
                // });
                this.socket && this.socket.emit('Marlin:state', {
                    state,
                    type: CONNECTION_TYPE_WIFI
                });
            }
        });
    };

    private stopHeartBeat = () => {
        this.heartBeatWorker && this.heartBeatWorker.terminate();
        this.heartBeatWorker = null;
    };

    /**
     * Get module list.
     */
    public getModuleList = () => {
        log.info('Get Module List...');

        request
            .get(`${this.host}/api/v1/module_list?token=${this.token}`)
            .timeout(1000)
            .end((err, res) => {
                const result = _getResult(err, res);
                const data = result?.data;
                if (!err) {
                    this.socket && this.socket.emit('machine:module-list', {
                        moduleList: data.moduleList || [],
                    });
                }
            });
    };

    public startGcode = (options: EventOptions) => {
        log.info('Starting print...');
        const { eventName } = options;
        const api = `${this.host}/api/v1/start_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const result = _getResult(err, res) || {};
                log.info('Print job started.');
                this.socket && this.socket.emit(eventName, result);
            });
    };

    public resumeGcode = (options: EventOptions) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/resume_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public pauseGcode = (options: EventOptions) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/pause_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public stopGcode = (options: EventOptions) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/stop_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public executeGcode = async (options: EventOptions, callback) => {
        return new Promise((resolve) => {
            const { gcode, eventName } = options;
            const split = gcode.split('\n');
            this.gcodeInfos.push({
                gcodes: split,
                callback: (result) => {
                    callback && callback(result);
                    resolve(result);
                }
            });
            this.startExecuteGcode(eventName);
        });
    };

    public startExecuteGcode = async (eventName: string) => {
        if (this.isGcodeExecuting) {
            return;
        }
        this.isGcodeExecuting = true;
        while (this.gcodeInfos.length > 0) {
            const splice = this.gcodeInfos.splice(0, 1)[0];
            const result = [];
            for (const gcode of splice.gcodes) {
                const { text } = await this._executeGcode(gcode) as GcodeResult;
                result.push(gcode);
                if (text) {
                    result.push(text);
                }
            }
            splice.callback && splice.callback(result);
            this.socket && this.socket.emit(eventName || 'connection:executeGcode', result);
        }
        this.isGcodeExecuting = false;
    };

    public _executeGcode = async (gcode: string) => {
        const api = `${this.host}/api/v1/execute_code`;
        return new Promise((resolve) => {
            const req = request.post(api);
            req.timeout(300000)
                .send(`token=${this.token}`)
                .send(`code=${gcode}`)
                // .send(formData)
                .end((err, res) => {
                    const { data, text } = _getResult(err, res);
                    resolve({ data, text });
                });
        });
    };

    private getGcodePrintingInfo(data) {
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
        return {
            sent,
            received,
            total,
            finishTime,
            estimatedTime: estimatedTime * 1000,
            elapsedTime: elapsedTime * 1000,
            remainingTime: remainingTime * 1000,
            name: fileName,
            progress,
            printStatus
        };
    }

    public uploadGcodeFile = (gcodeFilePath: string, type: string, renderName: string, callback) => {
        log.info('Preparing for a print job...');

        const api = `${this.host}/api/v1/prepare_print`;
        if (type === HEAD_PRINTING) {
            type = '3DP';
        } else if (type === HEAD_LASER) {
            type = 'Laser';
        } else if (type === HEAD_CNC) {
            type = 'CNC';
        }

        request
            .post(api)
            .field('token', this.token)
            .field('type', type)
            .attach('file', gcodeFilePath, { filename: renderName })
            .end((err, res) => {
                const { msg, data, text } = _getResult(err, res);

                log.info(`File upload: ${text}.`);
                if (callback) {
                    callback(msg, data);
                }
            });
    };

    public abortLaserMaterialThickness = () => {
        this.getLaserMaterialThicknessReq && this.getLaserMaterialThicknessReq.abort();
    };

    public getLaserMaterialThickness = (options: EventOptions) => {
        const { x, y, feedRate, eventName } = options;
        const api = `${this.host}/api/request_Laser_Material_Thickness?token=${this.token}&x=${x}&y=${y}&feedRate=${feedRate}`;
        const req = request.get(api);
        this.getLaserMaterialThicknessReq = req;
        req.end((err, res) => {
            this.socket && this.socket.emit(eventName, _getResult(err, res));
        });
    };

    public getGcodeFile = (options: EventOptions) => {
        const { eventName } = options;

        const api = `${this.host}/api/v1/print_file?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                if (err) {
                    this.socket && this.socket.emit(eventName, {
                        msg: err?.message,
                        text: res.text
                    });
                } else {
                    let gcodeStr = '';
                    res.on('data', (chunk) => {
                        gcodeStr += chunk;
                    });
                    res.once('end', () => {
                        this.socket && this.socket.emit(eventName, {
                            msg: err?.message,
                            text: gcodeStr
                        });
                    });
                    res.once('error', (error) => {
                        this.socket && this.socket.emit(eventName, {
                            msg: error?.message,
                            text: ''
                        });
                    });
                }
            });
    };

    public uploadFile = (options: EventOptions) => {
        const { gcodePath, eventName, renderGcodeFileName } = options;
        const api = `${this.host}/api/v1/upload`;
        request
            .post(api)
            .timeout(300000)
            .field('token', this.token)
            .attach('file', DataStorage.tmpDir + gcodePath, { filename: renderGcodeFileName })
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public getActiveExtruder = (options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/active_extruder?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateActiveExtruder = ({ extruderIndex, eventName }) => {
        const api = `${this.host}/api/v1/switch_extruder`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`active=${extruderIndex}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateNozzleTemperature = (options: EventOptions) => {
        const { nozzleTemperatureValue, eventName } = options;
        const api = `${this.host}/api/v1/override_nozzle_temperature`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`nozzleTemp=${nozzleTemperatureValue}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateBedTemperature = (options: EventOptions) => {
        const { heatedBedTemperatureValue, eventName } = options;
        const api = `${this.host}/api/v1/override_bed_temperature`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`heatedBedTemp=${heatedBedTemperatureValue}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateZOffset = (options: EventOptions) => {
        const { zOffset, eventName } = options;
        const api = `${this.host}/api/v1/override_z_offset`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`zOffset=${zOffset}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public loadFilament = (options: EventOptions, eventName: string) => {
        const api = `${this.host}/api/v1/filament_load`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public unloadFilament = (options: EventOptions) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/filament_unload`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateWorkSpeedFactor = (options: EventOptions) => {
        const { eventName, workSpeedValue } = options;
        const api = `${this.host}/api/v1/override_work_speed`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`workSpeed=${workSpeedValue}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateLaserPower = (options: EventOptions) => {
        const { eventName, laserPower } = options;
        const api = `${this.host}/api/v1/override_laser_power`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`laserPower=${laserPower}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public getEnclosureStatus = () => {
        const api = `${this.host}/api/v1/enclosure?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                const currentModuleStatus = _getResult(err, res)?.data;
                if (!isEqual(this.moduleSettings, currentModuleStatus)) {
                    this.moduleSettings = currentModuleStatus;
                    this.socket && this.socket.emit('Marlin:settings', {
                        settings: {
                            enclosureDoorDetection: currentModuleStatus?.isDoorEnabled,
                            enclosureOnline: currentModuleStatus?.isReady,
                            enclosureFan: currentModuleStatus?.fan,
                            enclosureLight: currentModuleStatus?.led,
                        }
                    });
                }
            });
    };

    public setEnclosureLight = (options: EventOptions) => {
        const { eventName, value } = options;
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`led=${value}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setEnclosureFan = (options: EventOptions) => {
        const { eventName, value } = options;
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`fan=${value}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setDoorDetection = (options: EventOptions) => {
        const { eventName, enable } = options;
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`isDoorEnabled=${enable}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setFilterSwitch = (options: EventOptions) => {
        const { eventName, enable } = options;
        const api = `${this.host}/api/v1/air_purifier_switch`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`switch=${enable}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setFilterWorkSpeed = (options: EventOptions) => {
        const { eventName, value } = options;
        const api = `${this.host}/api/v1/air_purifier_fan_speed`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`fan_speed=${value}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public wifiStatusTest = (options: EventOptions) => {
        const { host } = options;
        const api = `${host}/api/v1/status`;
        log.info(`the test api is: ${api}`);

        const apiTest = (count) => {
            if (count <= 0) {
                return;
            }
            setTimeout(() => {
                const time = new Date().getTime();
                request
                    .get(api)
                    .timeout(3000)
                    .end(() => {
                        const costTime = (new Date().getTime() - time);
                        log.info(`the test api time is: ${costTime} ms`);
                        apiTest(count - 1);
                    });
            }, 1000);
        };

        apiTest(5);
    }
}

const socketHttp = new SocketHttp();

export default socketHttp;
