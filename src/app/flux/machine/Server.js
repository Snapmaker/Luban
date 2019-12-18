import request from 'superagent';
import events from 'events';
import { MACHINE_HEAD_TYPE, MACHINE_SERIES, SERVER_STATUS_UNKNOWN } from '../../constants';
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
        this.status = SERVER_STATUS_UNKNOWN;
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
            workPosition: {
                x: 0,
                y: 0,
                z: 0
            },
            originOffset: {
                x: 0,
                y: 0,
                z: 0
            }
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
            .send(token ? `token=${token}` : '')
            .end((err, res) => {
                const { msg, data, code } = this._getResult(err, res);

                if (token && code === 403) {
                    this.open('', callback);
                }
                if (msg) {
                    callback(msg);
                    return;
                }
                if (data) {
                    let { series, headType } = data;
                    series = valueOf(MACHINE_SERIES, 'alias', series).value;
                    headType = valueOf(MACHINE_HEAD_TYPE, 'alias', headType).value;
                    data.series = series;
                    data.headType = headType;
                    this.state.series = series;
                    this.state.headType = headType;
                }
                this.token || (this.token = data.token);
                this.waitConfirm = true;
                this.startRequestStatus();
                callback(msg, data);
            });
    };

    close = (callback) => {
        const api = `${this.host}/api/v1/disconnect`;
        request
            .post(api)
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
            .timeout(2000)
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
                const { status, x, y, z, offsetX, offsetY, offsetZ } = data;
                this.status = status.toLowerCase();
                this.state.workPosition = {
                    x: x,
                    y: y,
                    z: z
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
                if (this.waitConfirm) {
                    this.waitConfirm = false;
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
                const { msg, data } = this._getResult(err, res);
                console.log(data);
                if (callback) {
                    callback(msg, data);
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
            .field('token', this.token)
            .attach('file', file, filename)
            .end((err, res) => {
                const { msg, data } = this._getResult(err, res);
                if (callback) {
                    callback(msg, data);
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

    stopGcode = (callback) => {
        if (!this.token) {
            callback && callback({ msg: 'this token is null' });
            return;
        }
        const api = `${this.host}/api/v1/stop_print`;
        request
            .post(api)
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
            return;
        }
        const split = gcode.split('\n');
        this.gcodeInfos.push({
            gcodes: split,
            callback: callback
        });
        this.startExecuteGcode();
    };

    _executeGcode = (gcode) => {
        const api = `${this.host}/api/v1/execute_code`;
        return new Promise((resolve) => {
            request
                .post(api)
                .timeout(12000)
                .send(`token=${this.token}`)
                .send(`code=${gcode}`)
                // .send(formData)
                .end((err, res) => {
                    const { data } = this._getResult(err, res);
                    resolve(data);
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
            for (const gcode of splice.gcodes) {
                await this._executeGcode(gcode);
            }
            splice.callback && splice.callback();
        }
        this.isGcodeExecuting = false;
    };

    _getStatus = () => {
        return {
            status: this.status,
            x: this.state.workPosition.x,
            y: this.state.workPosition.y,
            z: this.state.workPosition.z,
            offsetX: this.state.originOffset.x,
            offsetY: this.state.originOffset.y,
            offsetZ: this.state.originOffset.z,
            series: this.state.series,
            headType: this.state.headType,
            isHomed: this.state.isHomed,
            enclosure: this.state.enclosure,
            laserFocalLength: this.state.laserFocalLength,
            workSpeed: this.state.workSpeed
        };
    };

    uploadNozzleTemperature = (nozzleTemp, callback) => {
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

    uploadBedTemperature = (bedTemperature, callback) => {
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

    uploadZOffset = (zOffset, callback) => {
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

    uploadWorkSpeedFactor = (workSpeedFactor, callback) => {
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

    uploadLaserPower = (laserPower, callback) => {
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

    _getResult = (err, res) => {
        if (err) {
            return {
                msg: err.message,
                code: res && res.status
            };
        }
        const code = res.status;
        const data = res.body;
        if (code !== 200 && code !== 204 && code !== 203) {
            return {
                code,
                msg: err
            };
        }
        return {
            code,
            data
        };
    }
}
