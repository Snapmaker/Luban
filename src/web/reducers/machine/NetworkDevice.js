import request from 'superagent';

export class NetworkDevice {
    constructor(name, address, model) {
        this.name = name;
        this.address = address;
        this.model = model || 'Unknown Model';
        this.selected = false;
        this.status = 'UNKNOWN'; // UNKNOWN, IDLE, RUNNING, PAUSED
    }

    get host() {
        return `http://${this.address}:8080`;
    }

    uploadFile(filename, file, callback) {
        const api = `${this.host}/api/upload`;
        request
            .post(api)
            .attach(filename, file)
            .end(callback);
    }

    requestStatus(callback) {
        const api = `${this.host}/api/machine_status`;
        request.get(api).timeout(1000).end((err, res) => {
            if (err) {
                this.status = 'UNKNOWN';
            } else {
                this.status = res.body.status;
            }
            callback(err, res);
        });
    }
}
