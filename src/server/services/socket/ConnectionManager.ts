import fs from 'fs';
import net from 'net';
import { SerialPort } from 'serialport';

import { AUTO_STRING } from '../../../app/constants';
import DataStorage from '../../DataStorage';
import {
    CONNECTION_TYPE_SERIAL,
    CONNECTION_TYPE_WIFI,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MACHINE_SERIES,
    PORT_SCREEN_HTTP,
    PORT_SCREEN_SACP,
    SACP_PROTOCOL,
    SERIAL_PROTOCOL,
    STANDARD_CNC_TOOLHEAD_FOR_SM2,
    WORKFLOW_STATE_PAUSED,
} from '../../constants';
import ScheduledTasks from '../../lib/ScheduledTasks';
import logger from '../../lib/logger';
import socketSerialNew from './sacp/SACP-SERIAL';
import socketTcp from './sacp/SACP-TCP';
import socketHttp from './socket-http';
import socketSerial from './socket-serial';

const log = logger('lib:ConnectionManager');
const ensureRange = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};
let timer = null;

/**
 * A singleton to manage devices connection.
 */
class ConnectionManager {
    private socket = null;

    private connectionType = CONNECTION_TYPE_WIFI;

    private protocol = '';

    private scheduledTasksHandle;

    public onConnection = (socket) => {
        socketHttp.onConnection(socket);
        this.scheduledTasksHandle = new ScheduledTasks(socket);
    };

    public onDisconnection = (socket) => {
        socketHttp.onDisconnection(socket);
        socketSerial.onDisconnection(socket);
        this.scheduledTasksHandle.cancelTasks();
    };

    public refreshDevices = (socket, options) => {
        const { connectionType } = options;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            socketHttp.refreshDevices();
        } else if (connectionType === CONNECTION_TYPE_SERIAL) {
            socketSerial.serialportList();
        }
    };

    public subscribeDevices = (socket, bool) => {
        if (bool) {
            socketHttp.onSubscribe(socket);
            socketSerial.onSubscribe(socket);
        } else {
            socketHttp.onDisSubscribe(socket);
            socketSerial.onDisSubscribe(socket);
        }
    };

    public connectionOpen = async (socket, options) => {
        const { connectionType, sacp, addByUser, address } = options;
        this.connectionType = connectionType;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            if (sacp) {
                this.protocol = SACP_PROTOCOL;
                this.socket = socketTcp;
            } else if (addByUser) {
                try {
                    const protocol = await this.inspectProtocol(address);
                    if (protocol === SACP_PROTOCOL) {
                        this.protocol = SACP_PROTOCOL;
                        this.socket = socketTcp;
                    } else {
                        this.protocol = '';
                        this.socket = socketHttp;
                    }
                } catch (e) {
                    log.error(`connectionOpen inspect protocol error: ${e}`);
                }
            } else {
                this.protocol = '';
                this.socket = socketHttp;
            }


            this.socket.connectionOpen(socket, options);
        } else {
            const protocol = await this.inspectProtocol('', CONNECTION_TYPE_SERIAL, options);

            if (protocol === SACP_PROTOCOL) {
                this.socket = socketSerialNew;
                this.protocol = SACP_PROTOCOL;
                this.socket.connectionOpen(socket, options);
            } else {
                this.socket = socketSerial;
                this.protocol = '';
                this.socket.serialportOpen(socket, options);
            }
        }
        log.debug(`connectionOpen connectionType=${connectionType} this.socket=${this.socket}`);
    };

    public connectionClose = (socket, options) => {
        this.socket && this.socket.connectionClose(socket, options);
    };

    public connectionCloseImproper = () => {
        if (this.protocol === SACP_PROTOCOL) {
            this.socket && this.socket.connectionCloseImproper();
        } else {
            log.info('connectionCloseImproper');
            // force close
            // this.socket && this.socket.emit('connection:closeImproper');
        }
    };

    private inspectProtocol = async (address, connectionType = CONNECTION_TYPE_WIFI, options = { port: '' }) => {
        if (connectionType === CONNECTION_TYPE_WIFI) {
            // Inspect if we can connect to the printer via SACP (8888) or HTTP (8080)
            const [resSACP, resHTTP] = await Promise.allSettled([
                this.tryConnect(address, PORT_SCREEN_SACP),
                this.tryConnect(address, PORT_SCREEN_HTTP),
            ]);
            if (resHTTP.status === 'fulfilled' && resHTTP.value) {
                return 'HTTP';
            } else if (resSACP.status === 'fulfilled' && resSACP.value) {
                return SACP_PROTOCOL;
            }
        } else if (connectionType === CONNECTION_TYPE_SERIAL) {
            let protocol = 'HTTP';
            let hasData = false;
            const trySerialConnect = new SerialPort({
                path: options.port,
                baudRate: 115200,
                autoOpen: false
            });

            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                if (!hasData) {
                    protocol = SERIAL_PROTOCOL;
                    trySerialConnect?.close();
                }
            }, 1000);

            await new Promise((resolve) => {
                trySerialConnect.on('data', (data) => {
                    hasData = true;
                    const machineData = data.toString();
                    if (data[0].toString(16) === 'aa' && data[1].toString(16) === '55') {
                        protocol = SACP_PROTOCOL;
                        trySerialConnect?.close();
                    }
                    if (machineData.match(/SACP/g)) {
                        protocol = SACP_PROTOCOL;
                        trySerialConnect?.close();
                    }
                    if (machineData.match(/ok/g)) {
                        trySerialConnect?.close();
                    }
                });
                trySerialConnect.on('close', () => {
                    resolve(true);
                    // callback && callback(protocol);
                });
                // // TODO: return a promise and throw error
                trySerialConnect.on('error', (err) => {
                    log.error(`error = ${err}`);
                });
                trySerialConnect.once('open', () => {
                    trySerialConnect.write('M1006\r\n');
                });
                trySerialConnect.open();
            });

            return protocol;
        }
        return '';
    };

    private tryConnect = async (host, port) => {
        return new Promise((resolve) => {
            const tcpSocket = net.createConnection({
                host,
                port,
                timeout: 1000
            }, () => {
                tcpSocket.destroy();
                resolve(true);
                log.debug(`try connect ${host}:${port}, connected.`);
            });
            tcpSocket.once('timeout', () => {
                tcpSocket.destroy();
                log.debug(`try connect ${host}:${port}, timeout`);
                resolve(false);
            });
            tcpSocket.once('error', (e) => {
                tcpSocket.destroy();
                log.debug(`try connect ${host}:${port}, error: ${e}`);
                resolve(false);
            });
        });
    };

    /**
     *
     * @param {*} socket
     * @param {*} options
     * Only for toolhead printing action (laser/cnc/3dp)
     */
    public startGcodeAction = async (socket, options) => {
        log.info('gcode action begin');
        this.socket.startGcode(options);
    };

    public startGcode = async (socket, options) => {
        const {
            headType, isRotate, toolHead, isLaserPrintAutoMode, materialThickness, laserFocalLength, renderName, eventName, materialThicknessSource
        } = options;
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            const { uploadName, series, background, size, workPosition, originOffset } = options;
            const gcodeFilePath = `${DataStorage.tmpDir}/${uploadName}`;
            const promises = [];

            if (headType === HEAD_LASER) {
                if (this.protocol === SACP_PROTOCOL) {
                    // Snapmaker Artisan (SACP)
                    // this.socket.uploadGcodeFile(gcodeFilePath, headType, renderName, () => {
                    // });
                    if (laserFocalLength && toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2
                        && !isRotate && isLaserPrintAutoMode && materialThickness !== 0 && materialThicknessSource === AUTO_STRING) {
                        await this.socket.laseAutoSetMaterialHeight({ toolHead });
                    }
                    if (((toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2 && !isLaserPrintAutoMode)
                        || (toolHead === LEVEL_ONE_POWER_LASER_FOR_SM2 && isLaserPrintAutoMode))
                        && ((materialThickness !== 0 && materialThickness !== -1) || isRotate)) {
                        await this.socket.laserSetWorkHeight({ toolHead, materialThickness, isRotate });
                    }

                    const { jogSpeed = 1500 } = options;
                    // Since G-code does not contains Z moves, it's our responsibility to move it to Zero
                    const moveOrders = [
                        // { axis: 'X', distance: 0 },
                        // { axis: 'Y', distance: 0 },
                        { axis: 'Z', distance: 0 },
                    ];
                    await this.socket.coordinateMove({ moveOrders, jogSpeed, headType, beforeGcodeStart: true });
                } else if (series !== MACHINE_SERIES.ORIGINAL.identifier) {
                    // SM 2.0

                    // Both 1.6W & 10W laser can't work without a valid focal length
                    if (!laserFocalLength) {
                        return;
                    }

                    if (!isRotate) {
                        if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                            const promise = new Promise((resolve) => {
                                if (materialThickness === -1) {
                                    this.socket.executeGcode({ gcode: 'G0 Z0 F1500;' }, () => {
                                        resolve(true);
                                    });
                                } else {
                                    this.socket.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                        resolve(true);
                                    });
                                }
                            });
                            promises.push(promise);
                        } else {
                            const promise = new Promise((resolve) => {
                                if (isLaserPrintAutoMode) {
                                    this.socket.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                        resolve(true);
                                    });
                                } else {
                                    this.socket.executeGcode({ gcode: 'G0 Z0 F1500;' }, () => {
                                        resolve(true);
                                    });
                                }
                            });
                            promises.push(promise);
                        }
                        // Camera Aid Background mode, force machine to work on machine coordinates (Origin = 0,0)
                        if (background.enabled) {
                            let x = parseFloat(workPosition.x) - parseFloat(originOffset.x);
                            let y = parseFloat(workPosition.y) - parseFloat(originOffset.y);

                            // Fix bug for x or y out of range
                            x = Math.max(0, Math.min(x, size.x - 20));
                            y = Math.max(0, Math.min(y, size.y - 20));

                            const promise = new Promise((resolve) => {
                                this.socket.executeGcode({ gcode: `G53;\nG0 X${x} Y${y};\nG54;\nG92 X${x} Y${y};` }, () => {
                                    resolve(true);
                                });
                            });
                            promises.push(promise);
                        }
                    } else {
                        // Rotary Module origin
                        const promise = new Promise((resolve) => {
                            this.executeGcode(this.socket, { gcode: 'G0 X0 Y0 B0 F1500;\nG0 Z0 F1500;' }, () => {
                                resolve(true);
                            });
                        });
                        promises.push(promise);
                    }

                    // Laser works on G54
                    const promise = new Promise((resolve) => {
                        this.executeGcode(this.socket, { gcode: 'G54;' }, () => {
                            resolve(true);
                        });
                    });
                    promises.push(promise);
                }
            }

            Promise.all(promises)
                .then(() => {
                    this.socket.uploadGcodeFile(gcodeFilePath, headType, renderName, (msg) => {
                        if (msg) {
                            // FIXME: Add abort message
                            return;
                        }
                        this.socket.startGcode(options);
                    });
                });
        } else {
            const { workflowState } = options;
            if (this.protocol === SACP_PROTOCOL) {
                if (headType === HEAD_LASER && !isRotate) {
                    if (materialThickness !== 0) {
                        await this.socket.laserSetWorkHeight({ toolHead, materialThickness });
                    }
                    const { gcode, jogSpeed = 1500 } = options;
                    const moveOrders = [
                        { axis: 'X', distance: 0 },
                        { axis: 'Y', distance: 0 },
                        { axis: 'Z', distance: 0 }
                    ];
                    await this.socket.coordinateMove({ moveOrders, gcode, jogSpeed, headType, beforeGcodeStart: true });
                } else {
                    this.socket.startGcode(options);
                }
                // this.socket.startGcode(options);
            } else {
                if (headType === HEAD_LASER && workflowState !== WORKFLOW_STATE_PAUSED) {
                    this.socket.command(socket, {
                        args: ['G0 X0 Y0 B0 F1000', null]
                    });
                    if (!isRotate) {
                        if (materialThickness === -1) {
                            this.socket.command(socket, {
                                args: ['G0 Z0 F1000', null]
                            });
                        } else {
                            this.socket.command(socket, {
                                args: [`G53;\nG0 Z${materialThickness + laserFocalLength} ;\nG54;`, null]
                            });
                        }
                    } else {
                        this.socket.command(socket, {
                            args: ['G0 Z0 F1000', null]
                        });
                    }
                }
                setTimeout(() => {
                    this.socket.command(socket, {
                        cmd: 'gcode:start',
                    });
                }, 100);
                socket && socket.emit(eventName, {});
            }
        }
    };

    public recoveryCncPosition = (pauseStatus, gcodeFile, sizeZ) => {
        let code = '';
        const pos = pauseStatus.pos;
        const gcodeFilePath = `${DataStorage.tmpDir}/${gcodeFile.uploadName}`;
        const gcode = fs.readFileSync(gcodeFilePath, 'utf8');
        const res = gcode.match(/(?<=max_z\(mm\): )(\d)+/);
        if (res.length) {
            code += `
G1 Z${res[0]}
G1 X${pos.x} Y${pos.y} B${pos.e}
G1 Z${pos.z}
            `;
        } else {
            code += `
G1 Z${sizeZ}
G1 X${pos.x} Y${pos.y} B${pos.e}
G1 Z${pos.z}
        `;
        }
        this.socket.command(this.socket, {
            cmd: 'gcode',
            args: [code]
        });
    };

    public resumeGcode = (socket, options, callback) => {
        if (this.protocol === SACP_PROTOCOL || this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.resumeGcode({ ...options, connectionType: this.connectionType }, callback);
        } else {
            const { headType, pause3dpStatus, pauseStatus, gcodeFile, sizeZ } = options;
            if (headType === HEAD_PRINTING) {
                const pos = pause3dpStatus.pos;
                const code = `G1 X${pos.x} Y${pos.y} Z${pos.z}\n`;
                this.socket.command(this.socket, {
                    cmd: 'gcode',
                    args: [code]
                });
                this.socket.command(this.socket, {
                    cmd: 'gcode:resume',
                });
            } else if (headType === HEAD_LASER) {
                const pos = pauseStatus.pos;
                let code = `G1 Z${pos.z}
G1 X${pos.x} Y${pos.y} B${pos.e}`;

                if (pauseStatus.headStatus) {
                    // resume laser power
                    const powerPercent = ensureRange(pauseStatus.headPower, 0, 100);
                    const powerStrength = Math.floor(powerPercent * 255 / 100);
                    code += powerPercent !== 0 ? `
M3 P${powerPercent} S${powerStrength}`
                        : `
M3`;
                }
                this.socket.command(this.socket, {
                    cmd: 'gcode',
                    args: [code]
                });
                this.socket.command(this.socket, {
                    cmd: 'gcode:resume',
                });
            } else {
                if (pauseStatus.headStatus) {
                    // resume spindle
                    this.socket.command(this.socket, {
                        cmd: 'gcode',
                        args: ['M3']
                    });

                    // for CNC machine, resume need to wait >500ms to let the tool head started
                    setTimeout(() => {
                        this.recoveryCncPosition(pauseStatus, gcodeFile, sizeZ);
                        this.socket.command(this.socket, {
                            cmd: 'gcode:resume',
                        });
                    }, 1000);
                } else {
                    this.recoveryCncPosition(pauseStatus, gcodeFile, sizeZ);
                    this.socket.command(this.socket, {
                        cmd: 'gcode:resume',
                    });
                }
            }
            const { eventName } = options;
            socket && socket.emit(eventName, {});
        }
    };

    public pauseGcode = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL || this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.pauseGcode(options);
        } else {
            const { eventName } = options;
            this.socket.command(this.socket, {
                cmd: 'gcode:pause',
            });
            socket && socket.emit(eventName, {});
        }
    };

    public stopGcode = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.stopGcode(options);
            socket && socket.emit(options.eventName, {});
        } else {
            if (this.protocol === SACP_PROTOCOL) {
                this.socket.stopGcode(options);
            } else {
                this.socket.command(this.socket, {
                    cmd: 'gcode:pause',
                });
                this.socket.command(this.socket, {
                    cmd: 'gcode:stop',
                });
                const { eventName } = options;
                socket && socket.emit(eventName, {});
            }
        }
    };

    // when using executeGcode, the cmd param is always 'gcode'
    public executeGcode = (socket, options, callback = null) => {
        const { gcode, context, cmd = 'gcode' } = options;
        log.info(`executeGcode: ${gcode}, ${this.protocol}`);
        if (this.protocol === SACP_PROTOCOL || this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.executeGcode(options, callback);
        } else {
            this.socket.command(this.socket, {
                cmd: cmd,
                args: [gcode, context]
            });
        }
    };

    public switchExtruder = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex } = options;
            this.socket.switchExtruder(extruderIndex);
        }
    };

    public updateNozzleTemperature = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex, nozzleTemperatureValue } = options;
            this.socket.updateNozzleTemperature(extruderIndex, nozzleTemperatureValue);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.socket.updateNozzleTemperature(options);
            } else {
                const { nozzleTemperatureValue } = options;
                this.socket.command(this.socket, {
                    args: [`M104 S${nozzleTemperatureValue}`]
                });
            }
        }
    };

    public updateBedTemperature = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { /* zoneIndex, */heatedBedTemperatureValue } = options;
            this.socket.updateBedTemperature(0, heatedBedTemperatureValue);
            this.socket.updateBedTemperature(1, heatedBedTemperatureValue);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.socket.updateBedTemperature(options);
            } else {
                const { heatedBedTemperatureValue } = options;
                this.socket.command(this.socket, {
                    args: [`M140 S${heatedBedTemperatureValue}`]
                });
            }
        }
    };

    public loadFilament = (socket, options) => {
        const { eventName } = options;
        if (this.protocol === SACP_PROTOCOL || this.connectionType === CONNECTION_TYPE_WIFI) {
            const { extruderIndex } = options;
            this.socket.loadFilament(extruderIndex, eventName);
        } else {
            this.socket.command(this.socket, {
                args: ['G91;\nG0 E60 F200;\nG90;']
            });
            socket && socket.emit(eventName);
        }
    };

    public unloadFilament = (socket, options) => {
        const { eventName } = options;
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex } = options;
            this.socket.unloadFilament(extruderIndex, eventName);
        } else if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.unloadFilament(options);
        } else {
            this.socket.command(this.socket, {
                args: ['G91;\nG0 E6 F200;\nG0 E-60 F150;\nG90;']
            });
            socket && socket.emit(eventName);
        }
    };

    public updateWorkSpeedFactor = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { toolHead, workSpeedValue, extruderIndex } = options;
            this.socket.updateWorkSpeed(toolHead, workSpeedValue, extruderIndex);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.socket.updateWorkSpeedFactor(options);
            } else {
                const { workSpeedValue } = options;
                this.socket.command(this.socket, {
                    args: [`M220 S${workSpeedValue}`]
                });
            }
        }
    };

    // getWorkSpeedFactor = (socket, options) => {
    //     if (this.protocol === SACP_PROTOCOL) {
    //         this.socket.getWorkSpeed(options);
    //     }
    // }

    public updateLaserPower = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { laserPower } = options;
            log.info(`updateLaserPower set laser power:[${laserPower}]`);

            this.socket.updateLaserPower(laserPower);
        } else {
            const { isPrinting, laserPower, laserPowerOpen } = options;
            if (isPrinting) {
                if (this.connectionType === CONNECTION_TYPE_WIFI) {
                    this.socket.updateLaserPower({
                        ...options,
                        eventName: 'connection:executeGcode'
                    });
                } else {
                    this.executeGcode(
                        this.socket,
                        { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}` }
                    );
                }
            } else {
                if (laserPowerOpen) {
                    this.executeGcode(
                        this.socket,
                        { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}` }
                    );
                }
                this.executeGcode(
                    this.socket,
                    { gcode: 'M500' }
                );
            }
        }
    };

    public switchLaserPower = (socket, options) => {
        const { isSM2, laserPower, laserPowerOpen } = options;
        if (this.protocol === SACP_PROTOCOL) {
            if (laserPowerOpen) {
                this.socket.updateLaserPower(0);
            } else {
                this.socket.updateLaserPower(laserPower);
            }
            return;
        }
        if (laserPowerOpen) {
            this.executeGcode(
                this.socket,
                { gcode: 'M5' } // M3 P0 S0
            );
        } else {
            if (isSM2) {
                this.executeGcode(
                    this.socket,
                    { gcode: 'M3 P1 S2.55' }
                );
            } else {
                this.executeGcode(
                    this.socket,
                    { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}` }
                );
            }
        }
    };

    public setEnclosureLight = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI || this.protocol === SACP_PROTOCOL) {
            this.socket.setEnclosureLight(options);
        } else {
            const { value, eventName } = options;
            this.executeGcode(
                this.socket,
                { gcode: `M1010 S3 P${value};` }
            );
            socket && socket.emit(eventName);
        }
    };

    public setEnclosureFan = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI || this.protocol === SACP_PROTOCOL) {
            this.socket.setEnclosureFan(options);
        } else {
            const { value, eventName } = options;
            this.executeGcode(
                this.socket,
                { gcode: `M1010 S4 P${value};` }
            );
            socket && socket.emit(eventName);
        }
    };

    public setFilterSwitch = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI || this.protocol === SACP_PROTOCOL) {
            this.socket.setFilterSwitch(options);
        } else {
            const { value, enable } = options;
            this.executeGcode(
                this.socket,
                { gcode: `M1011 F${enable ? value : 0};` }
            );
        }
    };

    public setFilterWorkSpeed = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI || this.protocol === SACP_PROTOCOL) {
            this.socket.setFilterWorkSpeed(options);
        } else {
            const { value } = options;
            this.executeGcode(
                this.socket,
                { gcode: `M1011 F${value};` }
            );
        }
    };

    // only for Wifi
    public setDoorDetection = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI || this.protocol === SACP_PROTOCOL) {
            this.socket.setDoorDetection(options);
        }
    };

    public startHeartbeat = (socket, options) => {
        this.socket.startHeartbeat(options);
    };

    public getGcodeFile = (socket, options) => {
        this.socket.getGcodeFile(options);
    };

    public uploadFile = (socket, options) => {
        this.socket.uploadFile(options);
    };

    public updateZOffset = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex, zOffset } = options;
            this.socket.updateNozzleOffset(extruderIndex, 2, zOffset);
        } else {
            this.socket.updateZOffset(options);
        }
    };

    public getLaserMaterialThickness = (socket, options) => {
        this.socket.getLaserMaterialThickness(options);
    };

    public abortLaserMaterialThickness = (socket, options) => {
        this.socket.abortLaserMaterialThickness(options);
    };

    // camera capture related, currently for socket-tcp
    public takePhoto = (params, callback) => {
        this.socket.takePhoto(params, callback);
    };

    public getCameraCalibration = (callback) => {
        this.socket.getCameraCalibration(callback);
    };

    public getPhoto = (callback) => {
        this.socket.getPhoto(callback);
    };

    public getCalibrationPhoto = (callback) => {
        this.socket.getCalibrationPhoto(callback);
    };

    public setMatrix = (params, callback) => {
        this.socket.setMatrix(params, callback);
    };
    // only for Wifi

    public goHome = (socket, options, callback) => {
        const { headType } = options;
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.goHome();
            socket && socket.emit('move:status', { isHoming: true });
        } else {
            this.executeGcode(this.socket, {
                gcode: 'G53'
            });
            this.executeGcode(this.socket, {
                gcode: 'G28'
            }, callback);
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                socket && socket.emit('move:status', { isHoming: true });
            }
            (headType === HEAD_LASER || headType === HEAD_CNC) && this.executeGcode(this.socket, {
                gcode: 'G54'
            });
        }
    };

    public coordinateMove = (socket, options, callback) => {
        const { moveOrders, gcode, jogSpeed, headType } = options;
        // const { moveOrders, gcode, context, cmd, jogSpeed, headType } = options;
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.coordinateMove({ moveOrders, jogSpeed, headType });
        } else {
            this.executeGcode(this.socket, { gcode }, callback);
        }
    };

    public setWorkOrigin = (socket, options, callback) => {
        const { xPosition, yPosition, zPosition, bPosition } = options;
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.setWorkOrigin({ xPosition, yPosition, zPosition, bPosition });
        } else {
            this.executeGcode(this.socket, { gcode: 'G92 X0 Y0 Z0 B0' }, callback);
        }
    };

    public updateToolHeadSpeed = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { speed } = options;
            this.socket.updateToolHeadSpeed(speed);
        }
    };

    public switchCNC = async (socket, options, callback) => {
        const { headStatus, speed, toolHead } = options;
        if (this.protocol === SACP_PROTOCOL) {
            if (toolHead === STANDARD_CNC_TOOLHEAD_FOR_SM2) {
                await this.socket.setCncPower(100); // default 10
            } else {
                await this.socket.updateToolHeadSpeed(speed);
            }
            await this.socket.switchCNC(headStatus);
        } else {
            if (headStatus) {
                this.executeGcode(this.socket, { gcode: 'M5' }, callback);
            } else {
                this.executeGcode(this.socket, { gcode: 'M3 P100' }, callback);
            }
        }
    };

    public wifiStatusTest = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            socketHttp.wifiStatusTest(options);
        }
    }
}

const connectionManager = new ConnectionManager();

export {
    connectionManager,
};

// export default connectionManager;
