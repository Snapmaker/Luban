import request from 'superagent';
import events from 'events';
import { MACHINE_HEAD_TYPE, MACHINE_SERIES, WORKFLOW_STATUS_IDLE, WORKFLOW_STATUS_UNKNOWN } from '../../constants';
import { valueOf } from '../../lib/contants-utils';

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

    constructor(name, address, model, port) {
        super();
        this.name = name;
        this.address = address;
        this.port = port || 8080;
        this.model = model || 'Unknown Model';
        this.selected = false;
        this._stateInit();
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
            isEmergencyStopped: false
        };
    }

    _closeServer() {
        this._stateInit();
        this.endRequestStatus();
        this.gcodeInfos = [];
        this.isGcodeExecuting = false;
    }

    get host() {
        return `http://${this.address}:${this.port}`;
    }

    equal(server) {
        const { name, address, model } = server;
        if (name && name === this.name && address && address === this.address) {
            return !(model && model !== this.model);
        }
        return false;
    }

    open = (token = '', callback) => {
        const api = `${this.host}/api/v1/connect`;
        request
            .post(api)
            .timeout(3000)
            .send(token ? `token=${token}` : '')
            .end((err, res) => {
                const { msg, data, code, text } = this._getResult(err, res);

                if (token && code === 403) {
                    this.open('', callback);
                }
                if (msg) {
                    callback({ message: msg, status: code }, data, text);
                    return;
                }
                if (data) {
                    const { series, headType } = data;
                    const seriesValue = valueOf(MACHINE_SERIES, 'alias', series);
                    const headTypeValue = valueOf(MACHINE_HEAD_TYPE, 'alias', headType);
                    data.series = seriesValue ? seriesValue.value : null;
                    data.headType = headTypeValue ? headTypeValue.value : null;
                    this.state.series = data.series;
                    this.state.headType = data.headType;
                }
                this.token || (this.token = data.token);
                this.waitConfirm = true;
                this.startRequestStatus();
                callback(null, data);
            });
    };

    close = (callback) => {
        const api = `${this.host}/api/v1/disconnect`;
        request
            .post(api)
            .timeout(3000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this._closeServer();
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    startRequestStatus = () => {
        this.endRequestStatus();
        this.requestStatus();
        this.statusTimer = setInterval(this.requestStatus, 1000);
    };

    endRequestStatus = () => {
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
    };

    uploadFile = (filename, file, callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/upload`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .attach('file', file, filename)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback({ msg, data });
            });
    };

    requestStatus = () => {
        if (!this.token) {
            return;
        }
        const api = `${this.host}/api/v1/status?token=${this.token}`;
        request
            .get(api)
            .timeout(3000)
            .end((err, res) => {
                const { data, msg, code } = this._getResult(err, res);
                if (msg) {
                    this.errorCount++;
                    if (this.errorCount >= 3) {
                        this._closeServer();
                        this.emit('http:close', { err: msg });
                    }
                    return;
                }
                this.errorCount = 0;
                if (code === 204) {
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
                isNotNull(data.workSpeed) && (this.state.workSpeed = data.workSpeed);
                isNotNull(data.nozzleTemperature) && (this.state.nozzleTemperature = data.nozzleTemperature);
                isNotNull(data.nozzleTargetTemperature) && (this.state.nozzleTargetTemperature = data.nozzleTargetTemperature);
                isNotNull(data.heatedBedTemperature) && (this.state.heatedBedTemperature = data.heatedBedTemperature);
                isNotNull(data.heatedBedTargetTemperature) && (this.state.heatedBedTargetTemperature = data.heatedBedTargetTemperature);
                isNotNull(data.isEnclosureDoorOpen) && (this.state.isEnclosureDoorOpen = data.isEnclosureDoorOpen);
                isNotNull(data.doorSwitchCount) && (this.state.doorSwitchCount = data.doorSwitchCount);
                isNotNull(data.isEmergencyStopped) && (this.state.isEmergencyStopped = data.isEmergencyStopped);


                this._updateGcodePrintingInfo(data);

                if (this.waitConfirm) {
                    this.waitConfirm = false;
                    this.isConnected = true;
                    this.emit('http:confirm', { data: this._getStatus() });
                } else {
                    this.emit('http:status', { data: this._getStatus() });
                }
            });
    };

    uploadGcodeFile = (filename, file, type, callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/prepare_print`;
        if (type === MACHINE_HEAD_TYPE['3DP'].value) {
            type = '3DP';
        } else if (type === MACHINE_HEAD_TYPE.LASER.value) {
            type = 'Laser';
        } else if (type === MACHINE_HEAD_TYPE.CNC.value) {
            type = 'CNC';
        }
        request
            .post(api)
            .field('token', this.token)
            .field('type', type)
            .attach('file', file, filename)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                if (callback) {
                    callback(msg, data);
                }
            });
    };


    getGcodeFile = (callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/print_file?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                const { msg } = this._getResult(err, res);
                if (callback) {
                    callback(msg, res.text);
                }
            });
    };


    uploadFile = (filename, file, callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/upload`;
        request
            .post(api)
            .timeout(300000)
            .field('token', this.token)
            .attach('file', file, filename)
            .end((err, res) => {
                const { msg, data, text } = this._getResult(err, res);
                if (callback) {
                    callback(msg, data, text);
                }
            });
    };

    startGcode = (callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/start_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const { msg, code, data } = this._getResult(err, res);
                if (msg) {
                    callback && callback({ message: msg, status: code });
                    return;
                }
                this.state.gcodePrintingInfo.startTime = new Date().getTime();
                callback && callback(null, data);
            });
    };

    pauseGcode = (callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/pause_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                if (msg) {
                    callback && callback(msg);
                    return;
                }
                callback && callback(msg, data);
            });
    };

    resumeGcode = (callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/resume_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const { msg, code, data } = this._getResult(err, res);
                if (msg) {
                    callback && callback({ status: code, message: msg });
                    return;
                }
                callback && callback(null, data);
            });
    };

    stopGcode = (callback) => {
        if (!this.token) {
            callback && callback({ msg: 'this token is null' });
            return;
        }
        const api = `${this.host}/api/v1/stop_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                if (msg) {
                    callback && callback(msg);
                    return;
                }
                callback && callback(msg, data);
            });
    };

    executeGcode = (gcode, callback) => {
        if (!this.token) {
            return Promise.resolve();
        }
        if (this.isConnected && this.status !== WORKFLOW_STATUS_IDLE) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const split = gcode.split('\n');
            this.gcodeInfos.push({
                gcodes: split,
                callback: (result) => {
                    callback && callback(result);
                    resolve(result);
                }
            });
            this.startExecuteGcode();
        });
    };

    _executeGcode = (gcode) => {
        const api = `${this.host}/api/v1/execute_code`;
        return new Promise((resolve) => {
            request
                .post(api)
                .timeout(300000)
                .send(`token=${this.token}`)
                .send(`code=${gcode}`)
                // .send(formData)
                .end((err, res) => {
                    const { data, text } = this._getResult(err, res);
                    resolve({ data, text });
                });
        });
    };

    startExecuteGcode = async () => {
        if (this.isGcodeExecuting) {
            return;
        }
        this.isGcodeExecuting = true;
        while (this.gcodeInfos.length > 0) {
            const splice = this.gcodeInfos.splice(0, 1)[0];
            const result = [];
            for (const gcode of splice.gcodes) {
                const { text } = await this._executeGcode(gcode);
                result.push(gcode);
                if (text) {
                    result.push(text);
                }
            }
            splice.callback && splice.callback(result);
        }
        this.isGcodeExecuting = false;
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
            isHomed: this.state.isHomed,
            enclosure: this.state.enclosure,
            laserFocalLength: this.state.laserFocalLength,
            laserPower: this.state.laserPower,
            workSpeed: this.state.workSpeed,
            isEnclosureDoorOpen: this.state.isEnclosureDoorOpen,
            doorSwitchCount: this.state.doorSwitchCount,
            nozzleTemperature: this.state.nozzleTemperature,
            nozzleTargetTemperature: this.state.nozzleTargetTemperature,
            heatedBedTemperature: this.state.heatedBedTemperature,
            heatedBedTargetTemperature: this.state.heatedBedTargetTemperature,
            gcodePrintingInfo: this.state.gcodePrintingInfo,
            isEmergencyStopped: this.state.isEmergencyStopped
        };
    };

    updateNozzleTemperature = (nozzleTemp, callback) => {
        const api = `${this.host}/api/v1/override_nozzle_temperature`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`nozzleTemp=${nozzleTemp}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    updateBedTemperature = (bedTemperature, callback) => {
        const api = `${this.host}/api/v1/override_bed_temperature`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`heatedBedTemp=${bedTemperature}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    updateZOffset = (zOffset, callback) => {
        const api = `${this.host}/api/v1/override_z_offset`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`zOffset=${zOffset}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    updateWorkSpeedFactor = (workSpeedFactor, callback) => {
        const api = `${this.host}/api/v1/override_work_speed`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`workSpeed=${workSpeedFactor}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    updateLaserPower = (laserPower, callback) => {
        const api = `${this.host}/api/v1/override_laser_power`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`laserPower=${laserPower}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    loadFilament = (callback) => {
        const api = `${this.host}/api/v1/filament_load`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    unloadFilament = (callback) => {
        const api = `${this.host}/api/v1/filament_unload`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    getEnclosureStatus = (callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/enclosure?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                const { msg } = this._getResult(err, res);

                if (callback) {
                    callback(msg, JSON.parse(res.text));
                }
            });
    };

    setEnclosureLight = (value, callback) => {
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`led=${value}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    setEnclosureFan = (value, callback) => {
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`fan=${value}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

    setDoorDetection = (enabled, callback) => {
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`isDoorEnabled=${enabled}`)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                callback && callback(msg, data);
            });
    };

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
            data: res.body,
            text: res.text
        };
    }

    _updateGcodePrintingInfo(data) {
        if (!data) {
            return;
        }
        const { currentLine, estimatedTime, totalLines } = data;
        if (!currentLine || !estimatedTime || !totalLines) {
            return;
        }
        const sent = currentLine || 0;
        const received = currentLine || 0;
        const total = totalLines || 0;
        let elapsedTime = 0;
        let remainingTime = 0;
        if (this.state.gcodePrintingInfo.startTime) {
            elapsedTime = new Date().getTime() - this.state.gcodePrintingInfo.startTime;
            remainingTime = estimatedTime - elapsedTime;
        }
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
            elapsedTime,
            remainingTime
        };
    }
}
