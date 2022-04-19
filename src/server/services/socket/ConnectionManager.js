import logger from '../../lib/logger';
// import workerManager from '../task-manager/workerManager';
import socketSerial from './socket-serial';
import socketHttp from './socket-http';
import { HEAD_PRINTING, HEAD_LASER, LEVEL_TWO_POWER_LASER_FOR_SM2, MACHINE_SERIES,
    CONNECTION_TYPE_WIFI, CONNECTION_TYPE_SERIAL, WORKFLOW_STATE_PAUSED } from '../../constants';
import DataStorage from '../../DataStorage';

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

    onConnection = (socket) => {
        socketHttp.onConnection(socket);
        socketSerial.onConnection(socket);
    }

    onDisconnection = (socket) => {
        socketHttp.onDisconnection(socket);
        socketSerial.onDisconnection(socket);
    }

    refreshDevices = (socket, options) => {
        const { connectionType } = options;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            socketHttp.refreshDevices(socket);
        } else if (connectionType === CONNECTION_TYPE_SERIAL) {
            socketSerial.serialportList(socket);
        }
    }

    connectionOpen = (socket, options) => {
        const { connectionType } = options;
        this.connectionType = connectionType;
        if (connectionType === CONNECTION_TYPE_WIFI) {
            this.socket = socketHttp;
            this.socket.connectionOpen(socket, options);
        } else {
            this.socket = socketSerial;
            this.socket.serialportOpen(socket, options);
        }
        log.debug(`connectionOpen connectionType=${connectionType} this.socket=${this.socket}`);
    };

    connectionClose = (socket, options) => {
        this.socket.connectionClose(socket, options);
    };

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

    resumeGcode = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
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
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
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
            this.socket.command(this.socket, {
                cmd: 'gcode:pause',
            });
            this.socket.command(this.socket, {
                cmd: 'gcode:stop',
            });
            const { eventName } = options;
            socket && socket.emit(eventName, {});
        }
    };

    // when using executeGcode, the cmd param is always 'gcode'
    executeGcode = (socket, options, callback) => {
        const { gcode, context, cmd = 'gcode' } = options;
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.executeGcode(options, callback);
        } else {
            this.socket.command(this.socket, {
                cmd: cmd,
                args: [gcode, context]
            });
        }
    };

    updateNozzleTemperature = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.updateNozzleTemperature(options);
        } else {
            const { nozzleTemperatureValue } = options;
            this.socket.command(this.socket, {
                args: [`M104 S${nozzleTemperatureValue}`]
            });
        }
    }

    updateBedTemperature = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.updateBedTemperature(options);
        } else {
            const { heatedBedTemperatureValue } = options;
            this.socket.command(this.socket, {
                args: [`M140 S${heatedBedTemperatureValue}`]
            });
        }
    }


    loadFilament = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.loadFilament(options);
        } else {
            this.socket.command(this.socket, {
                args: ['G91;\nG0 E60 F200;\nG90;']
            });
        }
    }

    unloadFilament = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.unloadFilament(options);
        } else {
            this.socket.command(this.socket, {
                args: ['G91;\nG0 E6 F200;\nG0 E-60 F150;\nG90;']
            });
        }
    }

    updateWorkSpeedFactor = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.updateWorkSpeedFactor(options);
        } else {
            const { workSpeedValue } = options;
            this.socket.command(this.socket, {
                args: [`M220 S${workSpeedValue}`]
            });
        }
    }

    updateLaserPower = (socket, options) => {
        const { isPrinting, laserPower, laserPowerOpen } = options;
        if (isPrinting) {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.socket.updateLaserPower(options);
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

    switchLaserPower = (socket, options) => {
        const { isSM2, laserPower, laserPowerOpen } = options;
        if (laserPowerOpen) {
            this.executeGcode(
                this.socket,
                { gcode: 'M3 P0 S0' }
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
        this.socket.updateZOffset(options);
    };

    getLaserMaterialThickness = (socket, options) => {
        this.socket.getLaserMaterialThickness(options);
    };

    abortLaserMaterialThickness = (socket, options) => {
        this.socket.abortLaserMaterialThickness(options);
    }
    // only for Wifi
}

const connectionManager = new ConnectionManager();

export default connectionManager;
