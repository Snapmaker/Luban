import request from 'superagent';

/**
 * Server represents HTTP Server on Snapmaker 2.
 */
export class Server {
    constructor(name, address, model) {
        this.name = name;
        this.address = address;
        this.model = model || 'Unknown Model';
        this.selected = false;
        this.status = 'UNKNOWN'; // UNKNOWN, IDLE, RUNNING, PAUSED
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }

    get host() {
        return `http://${this.address}:8080`;
    }

    uploadFile(filename, file, callback) {
        const api = `${this.host}/api/upload`;
        request
            .post(api)
            .attach('file', file, filename)
            .end(callback);
    }

    requestStatus(callback) {
        const api = `${this.host}/api/machine_status`;
        request.get(api).timeout(1000).end((err, res) => {
            if (err) {
                this.status = 'UNKNOWN';
                callback(err);
                console.error('Get status failed');
                return;
            }
            const { status, x, y, z } = res.body;
            this.status = status;
            this.x = x;
            this.y = y;
            this.z = z;
            callback(err, res);
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
}
