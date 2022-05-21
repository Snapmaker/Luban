import net from 'net';
import logger from '../../lib/logger';
// import workerManager from '../task-manager/workerManager';
import socketSerial from './socket-serial';
import socketHttp from './socket-http';
import socketTcp from './sacp/SACP-TCP';
import socketSerialNew from './sacp/SACP-SERIAL';
import { HEAD_PRINTING, HEAD_LASER, LEVEL_TWO_POWER_LASER_FOR_SM2, MACHINE_SERIES,
    CONNECTION_TYPE_WIFI, CONNECTION_TYPE_SERIAL, WORKFLOW_STATE_PAUSED, PORT_SCREEN_HTTP, PORT_SCREEN_SACP, SACP_PROTOCOL } from '../../constants';
import DataStorage from '../../DataStorage';
import ScheduledTasks from '../../lib/ScheduledTasks';

const log = logger('lib:ConnectionManager');
const ensureRange = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

/**
 * A singleton to manage devices connection.
 */
class ConnectionManager {
    socket = null;

    connectionType = CONNECTION_TYPE_WIFI;

    protocol = '';

    scheduledTasksHandle

    onConnection = (socket) => {
        socketHttp.onConnection(socket);
        socketSerial.onConnection(socket);
        this.scheduledTasksHandle = new ScheduledTasks(socket);
    }

    onDisconnection = (socket) => {
        socketHttp.onDisconnection(socket);
        socketSerial.onDisconnection(socket);
        this.scheduledTasksHandle.cancelTasks();
    }

    refreshDevices = (socket, options) => {
        const { connectionType } = options;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            socketHttp.refreshDevices(socket);
        } else if (connectionType === CONNECTION_TYPE_SERIAL) {
            socketSerial.serialportList(socket);
        }
    }

    connectionOpen = async (socket, options) => {
        const { connectionType, sacp, addByUser, address } = options;
        this.connectionType = connectionType;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            if (sacp) {
                this.protocol = 'SACP';
                this.socket = socketTcp;
            } else if (addByUser) {
                try {
                    const protocol = await this.inspectProtocol(address);
                    if (protocol === 'SACP') {
                        this.protocol = 'SACP';
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
            // if (sacp) {
            // this.socket = ;
            log.debug('serialSacp');
            this.socket = socketSerialNew;
            this.protocol = 'SACP';
            this.socket.connectionOpen(socket, options);
            // } else {
            // this.socket = socketSerial;
            // this.socket.serialportOpen(socket, options);
            // }
        }
        log.debug(`connectionOpen connectionType=${connectionType} this.socket=${this.socket}`);
    };

    connectionClose = (socket, options) => {
        this.socket && this.socket.connectionClose(socket, options);
    };

    inspectProtocol = async (address) => {
        const [resSACP, resHTTP] = await Promise.allSettled([
            this.tryConnect(address, PORT_SCREEN_SACP),
            this.tryConnect(address, PORT_SCREEN_HTTP)
        ]);
        if (resHTTP.value) {
            return 'HTTP';
        } else if (resSACP.value) {
            return 'SACP';
        }
        return '';
    }

    tryConnect = (host, port) => {
        return new Promise((resolve) => {
            const tcpSocket = net.createConnection({
                host,
                port,
                timeout: 1000
            }, () => {
                tcpSocket.destroy();
                resolve(true);
                log.debug(`tryConnect connected ${host}:${port}`);
            });
            tcpSocket.once('timeout', () => {
                tcpSocket.destroy();
                log.debug(`tryConnect connect ${host}:${port} timeout`);
                resolve(false);
            });
            tcpSocket.once('error', (e) => {
                tcpSocket.destroy();
                log.debug(`tryConnect connect ${host}:${port} error: ${e}`);
                resolve(false);
            });
        });
    }

    startGcode = (socket, options) => {
        const { headType, isRotate, toolHead, isLaserPrintAutoMode, materialThickness, eventName } = options;
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            const { uploadName, series, laserFocalLength, background, size, workPosition, originOffset } = options;
            const gcodeFilePath = `${DataStorage.tmpDir}/${uploadName}`;
            const promises = [];
            if (series !== MACHINE_SERIES.ORIGINAL.value && series !== MACHINE_SERIES.CUSTOM.value && headType === HEAD_LASER && !isRotate) {
                if (laserFocalLength) {
                    const promise = new Promise((resolve) => {
                        if (isLaserPrintAutoMode) {
                            this.socket.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                resolve();
                            });
                        } else {
                            if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                                this.socket.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                    resolve();
                                });
                            } else {
                                this.socket.executeGcode({ gcode: 'G0 Z0 F1500;' }, () => {
                                    resolve();
                                });
                            }
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
                            resolve();
                        });
                    });
                    promises.push(promise);
                }
            }
            Promise.all(promises)
                .then(() => {
                    this.socket.uploadGcodeFile(gcodeFilePath, headType, (msg) => {
                        if (msg) {
                            return;
                        }
                        this.socket.startGcode(options);
                    });
                });
        } else {
            const { workflowState } = options;
            if (this.protocol === SACP_PROTOCOL) {
                this.socket.startGcode(options);
            } else {
                if (headType === HEAD_LASER && workflowState !== WORKFLOW_STATE_PAUSED) {
                    this.socket.command(socket, {
                        args: ['G0 X0 Y0 F1000', null]
                    });
                    if (!isRotate) {
                        if (toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2) {
                            this.socket.command(socket, {
                                args: [`G0 Z${(isLaserPrintAutoMode ? 0 : materialThickness)} F1000`, null]
                            });
                        } else {
                            this.socket.command(socket, {
                                args: [`G0 Z${(isLaserPrintAutoMode ? materialThickness : 0)} F1000`, null]
                            });
                        }
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
    }

    resumeGcode = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL || this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.resumeGcode(options);
        } else {
            const { headType, pause3dpStatus, pauseStatus } = options;
            if (headType === HEAD_PRINTING) {
                const pos = pause3dpStatus.pos;
                const code = `G1 X${pos.x} Y${pos.y} Z${pos.z} F1000\n`;
                this.socket.command(this.socket, {
                    cmd: 'gcode',
                    args: [code]
                });
                this.socket.command(this.socket, {
                    cmd: 'gcode:resume',
                });
            } else if (headType === HEAD_LASER) {
                if (pauseStatus.headStatus) {
                    // resume laser power
                    const powerPercent = ensureRange(pauseStatus.headPower, 0, 100);
                    const powerStrength = Math.floor(powerPercent * 255 / 100);
                    const code = powerPercent !== 0 ? `M3 P${powerPercent} S${powerStrength}`
                        : 'M3';
                    this.socket.command(this.socket, {
                        cmd: 'gcode',
                        args: [code]
                    });
                }

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
                        this.socket.command(this.socket, {
                            cmd: 'gcode:resume',
                        });
                    }, 1000);
                } else {
                    this.socket.command(this.socket, {
                        cmd: 'gcode:resume',
                    });
                }
            }
            const { eventName } = options;
            socket && socket.emit(eventName, {});
        }
    };

    pauseGcode = (socket, options) => {
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

    stopGcode = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.stopGcode(options);
        } else {
            if (this.protocol === SACP_PROTOCOL) {
                this.socket.stopPrint();
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
    executeGcode = (socket, options, callback) => {
        const { gcode, context, cmd = 'gcode' } = options;
        if (this.protocol === SACP_PROTOCOL || this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.executeGcode(options, callback);
        } else {
            this.socket.command(this.socket, {
                cmd: cmd,
                args: [gcode, context]
            });
        }
    };

    switchExtruder = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex } = options;
            this.socket.switchExtruder(extruderIndex);
        }
    }


    updateNozzleTemperature = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex, temperature } = options;
            this.socket.updateNozzleTemperature(extruderIndex, temperature);
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
    }

    updateBedTemperature = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { /* zoneIndex, */temperature } = options;
            this.socket.updateBedTemperature(0, temperature);
            this.socket.updateBedTemperature(1, temperature);
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
    }


    loadFilament = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex } = options;
            this.socket.loadFilament(extruderIndex);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.socket.loadFilament(options);
            } else {
                this.socket.command(this.socket, {
                    args: ['G91;\nG0 E60 F200;\nG90;']
                });
            }
        }
    }

    unloadFilament = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { extruderIndex } = options;
            this.socket.unloadFilament(extruderIndex);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.socket.unloadFilament(options);
            } else {
                this.socket.command(this.socket, {
                    args: ['G91;\nG0 E6 F200;\nG0 E-60 F150;\nG90;']
                });
            }
        }
    }

    updateWorkSpeedFactor = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { toolHead, workSpeed, extruderIndex } = options;
            this.socket.updateWorkSpeed(toolHead, workSpeed, extruderIndex);
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
    }

    updateLaserPower = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { laserPower } = options;
            console.log('set laser power', laserPower);

            this.socket.updateLaserPower(laserPower);
        } else {
            const { isPrinting, laserPower, laserPowerOpen, eventName } = options;
            if (isPrinting) {
                if (this.connectionType === CONNECTION_TYPE_WIFI) {
                    this.socket.updateLaserPower(options);
                } else {
                    this.executeGcode(
                        this.socket,
                        { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}`, eventName }
                    );
                }
            } else {
                if (laserPowerOpen) {
                    this.executeGcode(
                        this.socket,
                        { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}`, eventName }
                    );
                }
                this.executeGcode(
                    this.socket,
                    { gcode: 'M500', eventName }
                );
            }
        }
    }

    switchLaserPower = (socket, options) => {
        const { isSM2, laserPower, laserPowerOpen, eventName } = options;
        if (this.protocol === SACP_PROTOCOL) {
            console.log('switch set laser power', laserPower);
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
                { gcode: 'M3 P0 S0', eventName }
            );
        } else {
            if (isSM2) {
                this.executeGcode(
                    this.socket,
                    { gcode: 'M3 P1 S2.55', eventName }
                );
            } else {
                this.executeGcode(
                    this.socket,
                    { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}`, eventName }
                );
            }
        }
    };

    setEnclosureLight = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
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

    setEnclosureFan = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
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

    setFilterSwitch = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.setFilterSwitch(options);
        } else {
            const { value, enable } = options;
            this.executeGcode(
                this.socket,
                { gcode: `M1011 F${enable ? value : 0};` }
            );
        }
    };

    setFilterWorkSpeed = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
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
    setDoorDetection = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.setDoorDetection(options);
        }
    };

    startHeartbeat = (socket, options) => {
        this.socket.startHeartbeat(options);
    };

    getGcodeFile = (socket, options) => {
        this.socket.getGcodeFile(options);
    };

    uploadFile = (socket, options) => {
        this.socket.uploadFile(options);
    };

    updateZOffset = (socket, options) => {
        const { extruderIndex, direction, distance } = options;
        this.socket.updateZOffset(extruderIndex, direction, distance);
    };

    getLaserMaterialThickness = (socket, options) => {
        this.socket.getLaserMaterialThickness(options);
    };

    abortLaserMaterialThickness = (socket, options) => {
        this.socket.abortLaserMaterialThickness(options);
    }

    // camera capture related, currently for socket-tcp
    takePhoto = (params, callback) => {
        this.socket.takePhoto(params, callback);
    };

    getCameraCalibration = (callback) => {
        this.socket.getCameraCalibration(callback);
    };

    getPhoto = (callback) => {
        this.socket.getPhoto(callback);
    };

    getCalibrationPhoto = (callback) => {
        this.socket.getCalibrationPhoto(callback);
    };

    setMatrix = (params, callback) => {
        this.socket.setMatrix(params, callback);
    };
    // only for Wifi

    goHome = () => {
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.goHome();
        } else {
            this.executeGcode(this.socket, {
                gcode: 'G53'
            });
            this.executeGcode(this.socket, {
                gcode: 'G28'
            });
        }
    }

    coordinateMove = (socket, options) => {
        const { moveOrders, gcode, context, cmd, jogSpeed, headType } = options;
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.coordinateMove({ moveOrders, jogSpeed, headType });
        } else {
            this.executeGcode(this.socket, { gcode });
        }
    }

    setWorkOrigin = (socket, options) => {
        const { xPosition, yPosition, zPosition, bPosition } = options;
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.setWorkOrigin({ xPosition, yPosition, zPosition, bPosition });
        } else {
            this.executeGcode(this.socket, { gcode: 'G92 X0 Y0 Z0 B0' });
        }
    }

    updateToolHeadSpeed = (socket, options) => {
        if (this.protocol === SACP_PROTOCOL) {
            const { speed } = options;
            this.socket.updateToolHeadSpeed(speed);
        }
    }

    switchCNC = (socket, options) => {
        const { headStatus } = options;
        if (this.protocol === SACP_PROTOCOL) {
            this.socket.switchCNC(headStatus);
        } else {
            if (headStatus) {
                this.executeGcode(this.socket, { gcode: 'M5' });
            } else {
                this.executeGcode(this.socket, { gcode: 'M3 P100' });
            }
        }
    }
}

const connectionManager = new ConnectionManager();

export default connectionManager;
