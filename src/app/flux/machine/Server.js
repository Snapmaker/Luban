import request from 'superagent';
import events from 'events';

/**
 * Server represents HTTP Server on Snapmaker 2.
 */

export class Server extends events.EventEmitter {
    statusTimer = null;

    constructor(name, address, model) {
        super();
        this.name = name;
        this.token = '';
        this.isConnected = false;
        this.address = address;
        this.model = model || 'Unknown Model';
        this.selected = false;

        this.status = 'UNKNOWN';
        this.state = {
            series: '',
            pattern: '',
            isHomed: null,
            enclosure: false
        };

        this.status = 'UNKNOWN'; // UNKNOWN, IDLE, RUNNING, PAUSED
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }

    get host() {
        return `http://${this.address}:8080`;
    }

    open(callback) {
        const api = `${this.host}/api/v1/connect`;
        request
            .post(api)
            .attach('token', this.token)
            .then((res) => {
                const { status, err, data } = this._getResult(res);
                if (status === 200) {
                    this.token || (this.token = data.token);
                }
                callback(err, data);
            })
            .catch(err => {
                callback(err);
            });
    }

    close(callback) {
        const api = `${this.host}/api/v1/disconnect`;
        request
            .post(api)
            .attach('token', this.token)
            .then((res) => {
                const { status, err, data } = this._getResult(res);
                if (status === 200) {
                    this.token = '';
                    this.endRequestStatus();
                }

                callback(err, data);
            })
            .catch(err => {
                callback(err);
            });
    }

    startRequestStatus() {
        this.endRequestStatus();
        this.statusTimer = setInterval(this.requestStatus, 1000);
    }

    endRequestStatus() {
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
    }

    uploadFile(filename, file, callback) {
        const api = `${this.host}/api/upload`;
        request
            .post(api)
            .attach('file', file, filename)
            .end(callback);
    }

    requestStatus() {
        const api = `${this.host}/api/machine_status`;
        request.get(api).timeout(1000).end((err, res) => {
            if (err) {
                this.status = 'UNKNOWN';
                this.emit('http:status', { err });
                return;
            }
            const { status, x, y, z } = res.body;
            this.status = status;
            this.x = x;
            this.y = y;
            this.z = z;
            this.emit('http:status', { state: this._getStatus() });
        });
    }

    executeGcode(gcode, callback) {
        const api = `${this.host}/api/gcode`;
        const data = new FormData();
        data.append('gcode', gcode);
        request.post(api).send(data).end((err, res) => {
            callback && callback(err, res);
        });
    }

    _getStatus() {
        return {
            status: this.status,
            x: this.x,
            y: this.y,
            z: this.z
        };
    }

    _getResult(res) {
        const body = res.body;
        return body.data;
    }
}
