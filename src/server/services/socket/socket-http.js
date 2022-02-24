// import store from '../../store';
import request from 'superagent';
import { isEqual } from 'lodash';
import logger from '../../lib/logger';
import workerManager from '../task-manager/workerManager';
import { HEAD_PRINTING, HEAD_LASER, HEAD_CNC } from '../../constants';
import wifiServerManager from './WifiServerManager';

const log = logger('lib:SocketHttp');


const isJSON = (str) => {
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
// let timeoutHandle = null;
let intervalHandle = null;
/**
 * A singleton to manage devices connection.
 */
class SocketHttp {
    isGcodeExecuting = false;

    gcodeInfos = [];

    socket = null;

    host='';

    token='';

    heartBeatWorker= null;

    moduleSettings=null;

    connection = (socket) => {
        wifiServerManager.onConnection(socket);
    }

    disconnection = (socket) => {
        wifiServerManager.onDisconnection(socket);
    }

    connectionOpen = (socket, options) => {
        const { host, token } = options;
        this.host = host;
        this.token = token;
        this.socket = socket;
        log.debug(`wifi host="${this.host}" : token=${this.token}`);
        const api = `${this.host}/api/v1/connect`;
        intervalHandle = setInterval(this.getEnclosureStatus, 1000);
        request
            .post(api)
            .timeout(3000)
            .send(token ? `token=${this.token}` : '')
            .end((err, res) => {
                if (res?.body?.token) {
                    this.token = res.body.token;
                }
                this.socket && this.socket.emit('connection:open', _getResult(err, res));
            });
    };

    connectionClose = (socket, options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/disconnect`;
        request
            .post(api)
            .timeout(3000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
        this.host = '';
        this.token = '';
        this.heartBeatWorker && this.heartBeatWorker.terminate();
        clearInterval(intervalHandle);
    };

    startGcode = (options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/start_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    }

    resumeGcode = (options) => {
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

    pauseGcode = (options) => {
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

    stopGcode = (options) => {
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

    executeGcode = (options, callback) => {
        const { gcode } = options;
        const split = gcode.split('\n');
        this.gcodeInfos.push({
            gcodes: split
        });
        this.startExecuteGcode(callback);
    };

    startExecuteGcode = async (callback) => {
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
            callback && callback();
            this.socket && this.socket.emit('connection:executeGcode', result);
        }
        this.isGcodeExecuting = false;
    };

    _executeGcode = (gcode) => {
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

    startHeartbeat = (options) => {
        const { eventName } = options;
        this.heartBeatWorker = workerManager.heartBeat([{
            host: this.host,
            token: this.token
        }], (result) => {
            this.socket && this.socket.emit(eventName, result);
        });
    }

    uploadGcodeFile = (filename, file, type, callback) => {
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
            .attach('file', file, filename)
            .end((err, res) => {
                const { msg, data } = _getResult(err, res);
                if (callback) {
                    callback(msg, data);
                }
            });
    };

    getLaserMaterialThickness = (options) => {
        const { x, y, feedRate, eventName } = options;
        const api = `${this.host}/api/request_Laser_Material_Thickness?token=${this.token}&x=${x}&y=${y}&feedRate=${feedRate}`;
        request
            .get(api)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    getGcodeFile = (options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/print_file?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    uploadFile = (options) => {
        const { filename, file, eventName } = options;
        console.log('uploadFile', filename, file);
        const api = `${this.host}/api/v1/upload`;
        request
            .post(api)
            .timeout(300000)
            .field('token', this.token)
            .attach('file', file, filename)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    updateNozzleTemperature = (options) => {
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

    updateBedTemperature = (options) => {
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

    updateZOffset = (options) => {
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

    loadFilament = (options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/filament_load`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    unloadFilament = (options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/filament_unload`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    updateWorkSpeedFactor = (options) => {
        const { eventName, workSpeedFactor } = options;
        const api = `${this.host}/api/v1/override_work_speed`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`workSpeed=${workSpeedFactor}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    updateLaserPower = (options) => {
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

    getEnclosureStatus = () => {
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

    setEnclosureLight = (options) => {
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

    setEnclosureFan = (options) => {
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

   setDoorDetection = (options) => {
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

   setFilterSwitch = (options) => {
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

   setFilterWorkSpeed = (options) => {
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

   setFilterSwitch = (options) => {
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

   setFilterWorkSpeed = (options) => {
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
}

const socketHttp = new SocketHttp();

export default socketHttp;
