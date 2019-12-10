import request from 'superagent';
import events from 'events';
import { MACHINE_HEAD_TYPE, MACHINE_SERIES, SERVER_STATUS_UNKNOWN } from '../../constants';
import { valueOf } from '../../lib/contants-utils';

/**
 * Server represents HTTP Server on Snapmaker 2.
 */

export class Server extends events.EventEmitter {
    statusTimer = null;

    errorCount = 0;

    constructor(name, address, model, port) {
        super();
        this.name = name;
        this.token = '';
        this.isConnected = false;
        this.waitConfirm = false;
        this.address = address;
        this.port = port || 8080;
        this.model = model || 'Unknown Model';
        this.selected = false;

        this.state = {
            series: '',
            pattern: '',
            isHomed: null,
            enclosure: false
        };

        this.status = SERVER_STATUS_UNKNOWN; // UNKNOWN, IDLE, RUNNING, PAUSED
        this.x = 0;
        this.y = 0;
        this.z = 0;
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
                const { msg, data } = this._getResult(err, res);
                if (msg) {
                    callback && callback(msg);
                    return;
                }
                this.token = '';
                this.waitConfirm = false;
                this.state = {
                    series: '',
                    pattern: '',
                    isHomed: null,
                    enclosure: false
                };
                this.endRequestStatus();
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

    requestStatus = (callback) => {
        if (!this.token) {
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/status?token=${this.token}`;
        request
            .get(api)
            .timeout(1000)
            .end((err, res) => {
                const { data, msg, code } = this._getResult(err, res);
                if (msg) {
                    if (callback) {
                        callback(msg);
                    } else {
                        this.errorCount++;
                        if (this.waitConfirm) {
                            this.waitConfirm = false;
                            this.emit('http:confirm', { err: msg });
                        }
                        if (this.errorCount >= 3) {
                            this.emit('http:status', { err: msg });
                            this.endRequestStatus();
                        }
                    }
                    return;
                }
                this.errorCount = 0;
                if (code === 204) {
                    return;
                }
                if (this.waitConfirm) {
                    this.emit('http:confirm', { data: this._getStatus() });
                }
                const { status, x, y, z } = data;
                this.status = status.toLowerCase();
                this.x = x;
                this.y = y;
                this.z = z;
                if (callback) {
                    callback(null, { data: this._getStatus() });
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
            callback && callback({
                msg: 'this token is null'
            });
            return;
        }
        const api = `${this.host}/api/v1/execute_code`;
        // const formData = new FormData();
        // formData.append('gcode', gcode);
        const gcodes = gcode.split('\n');
        for (const gcode1 of gcodes) {
            request
                .post(api)
                .send(`token=${this.token}`)
                .send(`code=${gcode1}`)
                // .send(formData)
                .end((err, res) => {
                    const { msg, data } = this._getResult(err, res);
                    callback && callback({ msg, data });
                });
        }
    };

    _getStatus = () => {
        return {
            status: this.status,
            x: this.x,
            y: this.y,
            z: this.z,
            series: this.state.series,
            headType: this.state.headType
        };
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
        if (code !== 200 && code !== 204) {
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
