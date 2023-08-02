import { WorkflowStatus } from '@snapmaker/luban-platform';
import fs from 'fs';
import { includes } from 'lodash';

import { AUTO_STRING } from '../../../app/constants';
import { SnapmakerArtisanMachine, SnapmakerJ1Machine, SnapmakerRayMachine } from '../../../app/machines';
import DataStorage from '../../DataStorage';
import {
    CONNECTION_TYPE_WIFI,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MACHINE_SERIES,
    STANDARD_CNC_TOOLHEAD_FOR_SM2
} from '../../constants';
import ScheduledTasks from '../../lib/ScheduledTasks';
import SocketServer from '../../lib/SocketManager';
import logger from '../../lib/logger';
import ProtocolDetector, { NetworkProtocol, SerialPortProtocol } from './ProtocolDetector';
import { ChannelEvent } from './channels/ChannelEvent';
import { sacpSerialChannel } from './channels/SacpSerialChannel';
import { sacpTcpChannel } from './channels/SacpTcpChannel';
import { sacpUdpChannel } from './channels/SacpUdpChannel';
import { sstpHttpChannel } from './channels/SstpHttpChannel';
import { textSerialChannel } from './channels/TextSerialChannel';
import { ArtisanMachineInstance, MachineInstance, RayMachineInstance } from './instances';
import J1MachineInstance from './instances/J1Instance';

const log = logger('lib:ConnectionManager');

const ensureRange = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

/**
 * Connection Type
 *
 * Type of connection, either via network or via serial port.
 */
type ConnectionType = 'wifi' | 'serial';

interface ConnectionOpenOptions {
    connectionType: ConnectionType;
    address: string;
    port?: string;
    protocol?: NetworkProtocol | SerialPortProtocol;
}

interface ConnectionCloseOptions {
    force?: boolean;
}

/**
 * A singleton to manage devices connection.
 */
class ConnectionManager {
    private connectionType: ConnectionType = CONNECTION_TYPE_WIFI;

    // socket used to communicate
    private channel = null;

    private protocol: NetworkProtocol | SerialPortProtocol = NetworkProtocol.Unknown;

    private scheduledTasksHandle;

    private machineInstance: MachineInstance = null;

    private socket;

    public onConnection = (socket: SocketServer) => {
        sstpHttpChannel.onConnection();
        this.scheduledTasksHandle = new ScheduledTasks(socket);
    };

    public onDisconnection = (socket: SocketServer) => {
        sstpHttpChannel.onDisconnection();
        textSerialChannel.onDisconnection(socket);
        this.scheduledTasksHandle.cancelTasks();
    };

    private onChannelConnected = () => {
        log.info('channel: Connected');
    }

    private onChannelReady = async (data) => {
        log.info('channel: Ready');

        const machineIdentifier = data?.machineIdentifier;

        log.debug(`machineIdentifier = ${machineIdentifier}`);

        // configure machine instance
        if (machineIdentifier === SnapmakerJ1Machine.identifier) {
            this.machineInstance = new J1MachineInstance();
            this.machineInstance.setChannel(this.channel);
            this.machineInstance.setSocket(this.socket);
        }

        if (machineIdentifier === SnapmakerArtisanMachine.identifier) {
            this.machineInstance = new ArtisanMachineInstance();
            this.machineInstance.setChannel(this.channel);
            this.machineInstance.setSocket(this.socket);
        }

        if (machineIdentifier === SnapmakerRayMachine.identifier) {
            this.machineInstance = new RayMachineInstance();
            this.machineInstance.setChannel(this.channel);
            this.machineInstance.setSocket(this.socket);
        }

        if (this.machineInstance) {
            log.info(`instance = ${this.machineInstance.constructor.name}`);
            log.info('On preparing machine...');
            await this.machineInstance.onPrepare();
            log.info('All done, machine is ready.');
        }
    };

    public connectionOpen = async (socket, options: ConnectionOpenOptions) => {
        // Cancel subscriptions
        if (this.channel) {
            this.channel.off(ChannelEvent.Connected, this.onChannelConnected);
            this.channel.off(ChannelEvent.Ready, this.onChannelReady);
            this.channel = null;
        }

        const { connectionType, protocol, address } = options;

        this.connectionType = connectionType;

        if (connectionType === CONNECTION_TYPE_WIFI) {
            if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, NetworkProtocol.HTTP], protocol)) {
                this.protocol = protocol;
            } else {
                const detectedProtocol = await this.inspectNetworkProtocol(address);
                this.protocol = detectedProtocol;
            }

            if (this.protocol === NetworkProtocol.SacpOverTCP) {
                this.channel = sacpTcpChannel;
            } else if (this.protocol === NetworkProtocol.SacpOverUDP) {
                this.channel = sacpUdpChannel;
            } else if (this.protocol === NetworkProtocol.HTTP) {
                this.channel = sstpHttpChannel;
            } else {
                this.channel = sstpHttpChannel;
            }
        } else {
            const detectedProtocol = await this.inspectSerialPortProtocol(options.port);
            log.info(`Detected protocol: ${protocol}`);
            this.protocol = detectedProtocol;

            if (this.protocol === SerialPortProtocol.SacpOverSerialPort) {
                this.channel = sacpSerialChannel;
            } else {
                this.channel = textSerialChannel;
            }
        }

        this.socket = socket;

        this.channel.on(ChannelEvent.Connected, this.onChannelConnected);
        this.channel.on(ChannelEvent.Ready, this.onChannelReady);

        log.info(`ConnectionOpen: type = ${connectionType}, channel = ${this.channel.constructor.name}.`);
        this.channel.connectionOpen(socket, options);
    };

    public connectionClose = (socket, options: ConnectionCloseOptions) => {
        log.info('ConnectionClose');

        const force = options?.force || false;
        if (!force) {
            this.channel && this.channel.connectionClose(socket, options);
        } else {
            this.channel && this.channel.connectionCloseImproper();
        }

        if (this.channel) {
            this.channel.off(ChannelEvent.Connected, this.onChannelConnected);
            this.channel.off(ChannelEvent.Ready, this.onChannelReady);

            this.channel = null;
        }
    };

    private async inspectNetworkProtocol(host: string): Promise<NetworkProtocol> {
        const protocolDetector = new ProtocolDetector();
        return protocolDetector.detectNetworkProtocol(host);
    }

    private async inspectSerialPortProtocol(port: string): Promise<SerialPortProtocol> {
        const protocolDetector = new ProtocolDetector();
        return protocolDetector.detectSerialPortProtocol(port);
    }

    /**
     *
     * @param {*} socket
     * @param {*} options
     * Only for toolhead printing action (laser/cnc/3dp)
     */
    public startGcodeAction = async (socket, options) => {
        log.info('gcode action begin');
        this.channel.startGcode(options);
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
                if (includes([NetworkProtocol.SacpOverTCP], this.protocol)) {
                    // Snapmaker Artisan (SACP)
                    // this.socket.uploadGcodeFile(gcodeFilePath, headType, renderName, () => {
                    // });
                    if (laserFocalLength && toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2
                        && !isRotate && isLaserPrintAutoMode && materialThickness !== 0 && materialThicknessSource === AUTO_STRING) {
                        await this.channel.laseAutoSetMaterialHeight({ toolHead });
                    }
                    if (((toolHead === LEVEL_TWO_POWER_LASER_FOR_SM2 && !isLaserPrintAutoMode)
                        || (toolHead === LEVEL_ONE_POWER_LASER_FOR_SM2 && isLaserPrintAutoMode))
                        && ((materialThickness !== 0 && materialThickness !== -1) || isRotate)) {
                        await this.channel.laserSetWorkHeight({ toolHead, materialThickness, isRotate });
                    }

                    const { jogSpeed = 1500 } = options;
                    // Since G-code does not contains Z moves, it's our responsibility to move it to Zero
                    const moveOrders = [
                        // { axis: 'X', distance: 0 },
                        // { axis: 'Y', distance: 0 },
                        { axis: 'Z', distance: 0 },
                    ];
                    await this.channel.coordinateMove({ moveOrders, jogSpeed, headType, beforeGcodeStart: true });
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
                                    this.channel.executeGcode({ gcode: 'G0 Z0 F1500;' }, () => {
                                        resolve(true);
                                    });
                                } else {
                                    this.channel.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                        resolve(true);
                                    });
                                }
                            });
                            promises.push(promise);
                        } else {
                            const promise = new Promise((resolve) => {
                                if (isLaserPrintAutoMode) {
                                    this.channel.executeGcode({ gcode: `G53;\nG0 Z${laserFocalLength + materialThickness} F1500;\nG54;` }, () => {
                                        resolve(true);
                                    });
                                } else {
                                    this.channel.executeGcode({ gcode: 'G0 Z0 F1500;' }, () => {
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
                                this.channel.executeGcode({ gcode: `G53;\nG0 X${x} Y${y};\nG54;\nG92 X${x} Y${y};` }, () => {
                                    resolve(true);
                                });
                            });
                            promises.push(promise);
                        }
                    } else {
                        // Rotary Module origin
                        const promise = new Promise((resolve) => {
                            this.executeGcode(this.channel, { gcode: 'G0 X0 Y0 B0 F1500;\nG0 Z0 F1500;' }, () => {
                                resolve(true);
                            });
                        });
                        promises.push(promise);
                    }

                    // Laser works on G54
                    const promise = new Promise((resolve) => {
                        this.executeGcode(this.channel, { gcode: 'G54;' }, () => {
                            resolve(true);
                        });
                    });
                    promises.push(promise);
                }
            }

            Promise.all(promises)
                .then(() => {
                    this.channel.uploadGcodeFile(gcodeFilePath, headType, renderName, (msg) => {
                        if (msg) {
                            // FIXME: Add abort message
                            return;
                        }
                        this.channel.startGcode(options);
                    });
                });
        } else {
            const { workflowState } = options;
            if (includes([SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
                if (headType === HEAD_LASER && !isRotate) {
                    if (materialThickness !== 0) {
                        await this.channel.laserSetWorkHeight({ toolHead, materialThickness });
                    }
                    const { gcode, jogSpeed = 1500 } = options;
                    const moveOrders = [
                        { axis: 'X', distance: 0 },
                        { axis: 'Y', distance: 0 },
                        { axis: 'Z', distance: 0 }
                    ];
                    await this.channel.coordinateMove({ moveOrders, gcode, jogSpeed, headType, beforeGcodeStart: true });
                } else {
                    this.channel.startGcode(options);
                }
                // this.socket.startGcode(options);
            } else {
                if (headType === HEAD_LASER && workflowState !== WorkflowStatus.Paused) {
                    this.channel.command(socket, {
                        args: ['G0 X0 Y0 B0 F1000', null]
                    });
                    if (!isRotate) {
                        if (materialThickness === -1) {
                            this.channel.command(socket, {
                                args: ['G0 Z0 F1000', null]
                            });
                        } else {
                            this.channel.command(socket, {
                                args: [`G53;\nG0 Z${materialThickness + laserFocalLength} ;\nG54;`, null]
                            });
                        }
                    } else {
                        this.channel.command(socket, {
                            args: ['G0 Z0 F1000', null]
                        });
                    }
                }
                setTimeout(() => {
                    this.channel.command(socket, {
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
        this.channel.command(this.channel, {
            cmd: 'gcode',
            args: [code]
        });
    };

    public resumeGcode = (socket, options, callback) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.resumeGcode({ ...options, connectionType: this.connectionType }, callback);
        } else {
            const { headType, pause3dpStatus, pauseStatus, gcodeFile, sizeZ } = options;
            if (headType === HEAD_PRINTING) {
                const pos = pause3dpStatus.pos;
                const code = `G1 X${pos.x} Y${pos.y} Z${pos.z}\n`;
                this.channel.command(this.channel, {
                    cmd: 'gcode',
                    args: [code]
                });
                this.channel.command(this.channel, {
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
                this.channel.command(this.channel, {
                    cmd: 'gcode',
                    args: [code]
                });
                this.channel.command(this.channel, {
                    cmd: 'gcode:resume',
                });
            } else {
                if (pauseStatus.headStatus) {
                    // resume spindle
                    this.channel.command(this.channel, {
                        cmd: 'gcode',
                        args: ['M3']
                    });

                    // for CNC machine, resume need to wait >500ms to let the tool head started
                    setTimeout(() => {
                        this.recoveryCncPosition(pauseStatus, gcodeFile, sizeZ);
                        this.channel.command(this.channel, {
                            cmd: 'gcode:resume',
                        });
                    }, 1000);
                } else {
                    this.recoveryCncPosition(pauseStatus, gcodeFile, sizeZ);
                    this.channel.command(this.channel, {
                        cmd: 'gcode:resume',
                    });
                }
            }
            const { eventName } = options;
            socket && socket.emit(eventName, {});
        }
    };

    public pauseGcode = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.pauseGcode(options);
        } else {
            const { eventName } = options;
            this.channel.command(this.channel, {
                cmd: 'gcode:pause',
            });
            socket && socket.emit(eventName, {});
        }
    };

    public stopGcode = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, NetworkProtocol.HTTP], this.protocol)) {
            this.channel.stopGcode(options);
            socket && socket.emit(options.eventName, {});
        } else if (includes([SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.stopGcode(options);
        } else {
            this.channel.command(this.channel, {
                cmd: 'gcode:pause',
            });
            this.channel.command(this.channel, {
                cmd: 'gcode:stop',
            });
            const { eventName } = options;
            socket && socket.emit(eventName, {});
        }
    };

    // when using executeGcode, the cmd param is always 'gcode'
    public executeGcode = (socket, options, callback = null) => {
        const { gcode, context, cmd = 'gcode' } = options;
        log.info(`executeGcode: ${gcode}, ${this.protocol}`);
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.executeGcode(options, callback);
        } else {
            this.channel.command(this.channel, {
                cmd: cmd,
                args: [gcode, context]
            });
        }
    };

    // SSTP
    public getActiveExtruder = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.socket.getActiveExtruder(options);
        }
    };

    public switchExtruder = (socket, options) => {
        const extruderIndex = options?.extruderIndex || '0';

        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.switchExtruder(extruderIndex);
        } else if (includes([NetworkProtocol.HTTP], this.protocol)) {
            this.channel.updateActiveExtruder({
                eventName: options.eventName,
                extruderIndex,
            });
        } else {
            // T0 / T1
            this.channel.command(this.socket, {
                args: [`T${extruderIndex}`],
            });
        }
    };

    public updateNozzleTemperature = (socket, options) => {
        const { extruderIndex = -1, nozzleTemperatureValue } = options;

        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.updateNozzleTemperature(extruderIndex, nozzleTemperatureValue);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.channel.updateNozzleTemperature(options);
            } else {
                this.channel.command(this.socket, {
                    args: [`M104 S${nozzleTemperatureValue}`]
                });
            }
        }
    };

    public updateBedTemperature = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { /* zoneIndex, */heatedBedTemperatureValue } = options;
            this.channel.updateBedTemperature(0, heatedBedTemperatureValue);
            this.channel.updateBedTemperature(1, heatedBedTemperatureValue);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.channel.updateBedTemperature(options);
            } else {
                const { heatedBedTemperatureValue } = options;
                this.channel.command(this.channel, {
                    args: [`M140 S${heatedBedTemperatureValue}`]
                });
            }
        }
    };

    public loadFilament = (socket, options) => {
        const { eventName } = options;
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { extruderIndex } = options;
            this.channel.loadFilament(extruderIndex, eventName);
        } else {
            this.channel.command(this.channel, {
                args: ['G91;\nG0 E60 F200;\nG90;']
            });
            socket && socket.emit(eventName);
        }
    };

    public unloadFilament = (socket, options) => {
        const { eventName } = options;
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { extruderIndex } = options;
            this.channel.unloadFilament(extruderIndex, eventName);
        } else if (this.connectionType === CONNECTION_TYPE_WIFI) {
            this.channel.unloadFilament(options);
        } else {
            this.channel.command(this.channel, {
                args: ['G91;\nG0 E6 F200;\nG0 E-60 F150;\nG90;']
            });
            socket && socket.emit(eventName);
        }
    };

    public updateWorkSpeedFactor = (socket, options) => {
        if ([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort].includes(this.protocol)) {
            const { toolHead, workSpeedValue, extruderIndex } = options;
            this.channel.updateWorkSpeed(toolHead, workSpeedValue, extruderIndex);
        } else {
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                this.channel.updateWorkSpeedFactor(options);
            } else {
                const { workSpeedValue } = options;
                this.channel.command(this.channel, {
                    args: [`M220 S${workSpeedValue}`]
                });
            }
        }
    };

    public updateLaserPower = (socket, options) => {
        if ([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort].includes(this.protocol)) {
            const { laserPower } = options;
            log.info(`updateLaserPower set laser power:[${laserPower}]`);

            this.channel.updateLaserPower(laserPower);
        } else {
            const { isPrinting, laserPower, laserPowerOpen } = options;
            if (isPrinting) {
                if (this.connectionType === CONNECTION_TYPE_WIFI) {
                    this.channel.updateLaserPower({
                        ...options,
                        eventName: 'connection:executeGcode'
                    });
                } else {
                    this.executeGcode(
                        this.channel,
                        { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}` }
                    );
                }
            } else {
                if (laserPowerOpen) {
                    this.executeGcode(
                        this.channel,
                        { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}` }
                    );
                }
                this.executeGcode(
                    this.channel,
                    { gcode: 'M500' }
                );
            }
        }
    };

    public switchLaserPower = (socket, options) => {
        const { isSM2, laserPower, laserPowerOpen } = options;
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            if (laserPowerOpen) {
                this.channel.updateLaserPower(0);
            } else {
                this.channel.updateLaserPower(laserPower);
            }
            return;
        }
        if (laserPowerOpen) {
            this.executeGcode(
                this.channel,
                { gcode: 'M5' } // M3 P0 S0
            );
        } else {
            if (isSM2) {
                this.executeGcode(
                    this.channel,
                    { gcode: 'M3 P1 S2.55' }
                );
            } else {
                this.executeGcode(
                    this.channel,
                    { gcode: `M3 P${laserPower} S${laserPower * 255 / 100}` }
                );
            }
        }
    };

    public setEnclosureLight = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.setEnclosureLight(options);
        } else {
            const { value, eventName } = options;
            this.executeGcode(
                this.channel,
                { gcode: `M1010 S3 P${value};` }
            );
            socket && socket.emit(eventName);
        }
    };

    public setEnclosureFan = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.setEnclosureFan(options);
        } else {
            const { value, eventName } = options;
            this.executeGcode(
                this.channel,
                { gcode: `M1010 S4 P${value};` }
            );
            socket && socket.emit(eventName);
        }
    };

    public setFilterSwitch = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.setFilterSwitch(options);
        } else {
            const { value, enable } = options;
            this.executeGcode(
                this.channel,
                { gcode: `M1011 F${enable ? value : 0};` }
            );
        }
    };

    public setFilterWorkSpeed = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.setFilterWorkSpeed(options);
        } else {
            const { value } = options;
            this.executeGcode(
                this.channel,
                { gcode: `M1011 F${value};` }
            );
        }
    };

    // only for Wifi
    public setDoorDetection = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.HTTP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.setDoorDetection(options);
        }
    };

    public startHeartbeat = (socket, options) => {
        console.log('startHeartbeat');

        this.channel.startHeartbeat(options);
    };

    public getGcodeFile = (socket, options) => {
        this.channel.getGcodeFile(options);
    };

    public uploadFile = (socket, options) => {
        this.channel.uploadFile(options);
    };

    public updateZOffset = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { extruderIndex, zOffset } = options;
            this.channel.updateNozzleOffset(extruderIndex, 2, zOffset);
        } else {
            this.channel.updateZOffset(options);
        }
    };

    public getLaserMaterialThickness = (socket, options) => {
        this.channel.getLaserMaterialThickness(options);
    };

    public abortLaserMaterialThickness = (socket, options) => {
        this.channel.abortLaserMaterialThickness(options);
    };

    // camera capture related, currently for socket-tcp
    public takePhoto = (params, callback) => {
        this.channel.takePhoto(params, callback);
    };

    public getCameraCalibration = (callback) => {
        this.channel.getCameraCalibration(callback);
    };

    public getPhoto = (callback) => {
        this.channel.getPhoto(callback);
    };

    public getCalibrationPhoto = (callback) => {
        this.channel.getCalibrationPhoto(callback);
    };

    public setMatrix = (params, callback) => {
        this.channel.setMatrix(params, callback);
    };
    // only for Wifi

    public goHome = (socket, options, callback) => {
        const { headType } = options;
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.goHome();
            socket && socket.emit('move:status', { isHoming: true });
        } else {
            this.executeGcode(this.channel, {
                gcode: 'G53'
            });
            this.executeGcode(this.channel, {
                gcode: 'G28'
            }, callback);
            if (this.connectionType === CONNECTION_TYPE_WIFI) {
                socket && socket.emit('move:status', { isHoming: true });
            }
            (headType === HEAD_LASER || headType === HEAD_CNC) && this.executeGcode(this.channel, {
                gcode: 'G54'
            });
        }
    };

    public coordinateMove = (socket, options, callback) => {
        const { moveOrders, gcode, jogSpeed, headType } = options;
        // const { moveOrders, gcode, context, cmd, jogSpeed, headType } = options;
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.coordinateMove({ moveOrders, jogSpeed, headType });
        } else {
            this.executeGcode(this.channel, { gcode }, callback);
        }
    };

    public setWorkOrigin = (socket, options, callback) => {
        const { xPosition, yPosition, zPosition, bPosition } = options;
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            this.channel.setWorkOrigin({ xPosition, yPosition, zPosition, bPosition });
        } else {
            this.executeGcode(this.channel, { gcode: 'G92 X0 Y0 Z0 B0' }, callback);
        }
    };

    public updateToolHeadSpeed = (socket, options) => {
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { speed } = options;
            this.channel.updateToolHeadSpeed(speed);
        }
    };

    public switchCNC = async (socket, options, callback) => {
        const { headStatus, speed, toolHead } = options;
        if (includes([NetworkProtocol.SacpOverTCP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            if (toolHead === STANDARD_CNC_TOOLHEAD_FOR_SM2) {
                await this.channel.setCncPower(100); // default 10
            } else {
                await this.channel.updateToolHeadSpeed(speed);
            }
            await this.channel.switchCNC(headStatus);
        } else {
            if (headStatus) {
                this.executeGcode(this.channel, { gcode: 'M5' }, callback);
            } else {
                this.executeGcode(this.channel, { gcode: 'M3 P100' }, callback);
            }
        }
    };

    public wifiStatusTest = (socket, options) => {
        if (this.connectionType === CONNECTION_TYPE_WIFI) {
            sstpHttpChannel.wifiStatusTest(options);
        }
    }

    //
    // - Machine Network
    //

    public getNetworkConfiguration = async (socket, options) => {
        const { eventName } = options;

        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { data: networkConfiguration } = await this.channel.getNetworkConfiguration();

            socket.emit(eventName, {
                networkMode: networkConfiguration.networkMode,
                stationIPObtain: networkConfiguration.stationIPObtain,
                stationSSID: networkConfiguration.stationSSID,
                stationPassword: networkConfiguration.stationPassword,
                stationIP: networkConfiguration.stationIP,
            });
        } else {
            socket.emit(eventName, {
                err: 1,
                msg: `Unsupported event: ${eventName}`,
            });
        }
    };

    public getNetworkStationState = async (socket, options) => {
        const { eventName } = options;

        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const { data: networkStationState } = await this.channel.getNetworkStationState();

            socket.emit(eventName, {
                stationIP: networkStationState.stationIP,
                stationState: networkStationState.stationState,
                stationRSSI: networkStationState.stationRSSI,
            });
        } else {
            socket.emit(eventName, {
                err: 1,
                msg: `Unsupported event: ${eventName}`,
            });
        }
    };

    /**
     * Configure machine network.
     *
     * Notice: configure machine network is supported by SACP over TCP/UDP, but it's not recommended.
     * Since you've connected to the machine via network already.
     */
    public configureMachineNetwork = async (socket, options) => {
        const { eventName } = options;

        // Note: supported by SACP over UDP, but it's not needed since you already connected to the machine
        // via network.
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const configureNetworkResult = await this.channel.configureNetwork({
                networkMode: options?.networkMode,
                stationIPObtain: options?.stationIPObtain,
                stationSSID: options?.stationSSID,
                stationPassword: options?.stationPassword,
                stationIP: options?.stationIP,
            });
            if (configureNetworkResult.response.result === 0) {
                // success
            }
        } else {
            socket.emit(eventName, {
                err: 1,
                msg: `Unsupported event: ${eventName}`,
            });
        }
    }

    /**
     * Export log in machine to external storage.
     */
    public exportLogToExternalStorage = async (socket, options) => {
        const { eventName } = options;

        // SACP only
        if (includes([NetworkProtocol.SacpOverTCP, NetworkProtocol.SacpOverUDP, SerialPortProtocol.SacpOverSerialPort], this.protocol)) {
            const result = await this.channel.exportLogToExternalStorage();
            socket.emit(eventName, {
                err: result.response.result !== 0,
            });
        } else {
            socket.emit(eventName, {
                err: 1,
                msg: `Unsupported event: ${eventName}`,
            });
        }
    }
}

const connectionManager = new ConnectionManager();

export {
    connectionManager
};

// export default connectionManager;
