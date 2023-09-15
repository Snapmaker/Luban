import { EventEmitter } from 'events';

import SocketEvent from '../../communication/socket-events';
import { CUSTOM_SERVER_NAME } from '../../constants';
import { controller } from '../../communication/socket-communication';
import log from '../../lib/log';
import { dispatch } from '../../store';
import baseActions from './actions-base';
import { ConnectionType } from './state';

interface CreateOptions {
    name: string;
    address: string;
    port?: string;
    baudRate?: number;
    protocol?: string;
}

export interface ConnectResult {
    code: number | string;
    msg: string;
}

/**
 * class for Networked Machine.
 *
 * This class actually uses dispatch to update redux state, which is not elegant.
 * Refactor this ASAP.
 */
export class MachineAgent extends EventEmitter {
    private gcodePrintingInfo = {};

    public name: string;

    public address: string; // for networked machine, it's IP address

    private token?: string; // possible token for authentication

    private model?: string; // indicates which machine
    private protocol?: string; // which protocol to use
    private addByUser: boolean = false;

    public port: string; // for serial machine, it's serial port path
    public baudRate: number = 0;

    // TODO: creation methods

    public static createAgent(options: CreateOptions): MachineAgent {
        const agent = new MachineAgent();

        agent.name = options.name;
        agent.address = options.address;
        agent.port = options.port;
        agent.baudRate = options?.baudRate;
        agent.protocol = options?.protocol || ''; // unknown protocol

        return agent;
    }

    /**
     * Manually add agent.
     */
    public static createManualAgent(options: CreateOptions): MachineAgent {
        const agent = new MachineAgent();

        agent.name = options.name || CUSTOM_SERVER_NAME;
        agent.address = options.address;
        agent.addByUser = true;

        return agent;
    }

    /**
     * Networked or wired.
     */
    public get isNetworkedMachine() {
        return Boolean(this.address);
    }

    public getToken(): string {
        return this.token;
    }

    public setToken(token: string): void {
        this.token = token;
    }

    public async connect(): Promise<ConnectResult> {
        if (this.isNetworkedMachine) {
            log.info(`Connecting to machine ${this.address}...`);
            log.info(`- protocol = ${this.protocol}`);
        } else {
            log.info(`Connecting to port ${this.port}...`);
            log.info(`- protocol = ${this.protocol}`);
        }

        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.ConnectionOpen, {
                    connectionType: this.isNetworkedMachine ? ConnectionType.WiFi : ConnectionType.Serial,
                    host: this.host,
                    address: this.address,
                    token: this.token,
                    port: this.port,
                    baudRate: this.baudRate,
                    protocol: this.protocol,
                    addByUser: this.addByUser,
                })
                .once(SocketEvent.ConnectionOpen, ({ msg, data, code }) => {
                    if (msg) {
                        resolve({ code, msg });
                        return;
                    }

                    if (this.isNetworkedMachine) {
                        if (data?.token) {
                            this.token = data?.token;
                        }

                        resolve({ code, msg });
                    } else {
                        // serial port
                        resolve({ code, msg });
                    }
                });
        });
    }

    public async disconnect(force = false) {
        log.info('Disconnect from machine...');

        if (!force) {
            return new Promise((resolve) => {
                controller
                    .emitEvent(SocketEvent.ConnectionClose, { force })
                    .once(SocketEvent.ConnectionClose, () => {
                        log.info('Disconnected from machine.');
                        resolve(true);
                    });
            });
        } else {
            return new Promise((resolve) => {
                controller
                    .emitEvent(SocketEvent.ConnectionClose, { force })
                    .once(SocketEvent.ConnectionClose, () => {
                        resolve(true);
                    });

                log.info('Disconnected from machine.');
                // Do not wait for machine response, disconnect from client side
                resolve(true);
            });
        }
    }

    /**
     * Generic method to execute G-code.
     *
     * If G-code contains multiple commands, join them by '\n'.
     */
    public async executeGcode(gcode: string) {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.ExecuteGCode, { gcode })
                .once(SocketEvent.ExecuteGCode, () => {
                    resolve(true);
                });
        });
    }

    /**
     * Generic method to execute a command.
     *
     * This is only for serial port connected SM 2.0.
     */
    public async executeCmd(gcode, context, cmd) {
        return new Promise((resolve) => {
            controller
                .emitEvent(SocketEvent.ExecuteCmd, { gcode, context, cmd })
                .once(SocketEvent.ExecuteCmd, () => {
                    resolve(true);
                });
        });
    }

    public coordinateMove(moveOrders, gcode, jogSpeed, headType) {
        controller.emitEvent(SocketEvent.Move, { moveOrders, gcode, jogSpeed, headType }, () => {
            // homed
        });
    }

    public setWorkOrigin(xPosition, yPosition, zPosition, bPosition) {
        controller.emitEvent(SocketEvent.SetOrigin, { xPosition, yPosition, zPosition, bPosition });
    }

    public startServerGcode(args, callback) {
        dispatch(baseActions.updateState({
            isSendedOnWifi: false
        }));

        controller
            .emitEvent(SocketEvent.StartGCode, args)
            .once(SocketEvent.StartGCode, ({ msg, code }) => {
                dispatch(baseActions.updateState({
                    isSendedOnWifi: true
                }));
                if (msg) {
                    callback && callback({ msg, code });
                    return;
                }
                if (this.isNetworkedMachine) {
                    this.gcodePrintingInfo.startTime = new Date().getTime();
                }
            });
    }

    public pauseServerGcode(callback) {
        controller
            .emitEvent(SocketEvent.PauseGCode)
            .once(SocketEvent.PauseGCode, ({ err }) => {
                // failed on serial
                if (err) {
                    callback && callback();
                }
            });
    }

    public resumeServerGcode(args, callback) {
        controller
            .emitEvent(SocketEvent.ResumeGCode, args, callback)
            .once(SocketEvent.ResumeGCode, (options) => {
                callback && callback(options);
            });
    }

    public stopServerGcode(callback) {
        controller
            .emitEvent(SocketEvent.StopGCode)
            .once(SocketEvent.StopGCode, (options) => {
                callback && callback();
                const { msg, code, data } = options;
                if (msg) {
                    callback && callback({ msg, code, data });
                    return;
                }

                // ?
                dispatch(baseActions.updateState({
                    isSendedOnWifi: true
                }));
            });
    }

    public goHome(data, callback) {
        controller.emitEvent(SocketEvent.GoHome, data, callback);
    }


    public get host() {
        return `http://${this.address}:8080`;
    }

    public equals(server) {
        const { name, address } = server;
        return (name && name === this.name && address && address === this.address);
    }

    public isJSON = (str) => {
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

    public _getResult = (err, res) => {
        if (err) {
            if (res && this.isJSON(res.text) && JSON.parse(res.text).code === 202) {
                return {
                    msg: err.message,
                    code: 202,
                    text: res && res.text,
                    data: res && res.body
                };
            } else if (res && this.isJSON(res.text) && JSON.parse(res.text).code === 203) {
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

    public getGcodePrintingInfo(data) {
        if (!data) {
            return {};
        }
        const { currentLine, estimatedTime, totalLines, fileName = '', progress, elapsedTime, remainingTime, printStatus } = data;
        if (!currentLine || !estimatedTime || !totalLines) {
            return {};
        }
        const sent = currentLine || 0;
        const received = currentLine || 0;
        const total = totalLines || 0;
        let finishTime = 0;
        if (received > 0 && received >= totalLines) {
            finishTime = new Date().getTime();
        }
        this.gcodePrintingInfo = {
            ...this.gcodePrintingInfo,
            sent,
            received,
            total,
            finishTime,
            estimatedTime: estimatedTime * 1000,
            elapsedTime: elapsedTime * 1000,
            remainingTime: remainingTime * 1000,
            fileName,
            progress,
            printStatus
        };
        return this.gcodePrintingInfo;
    }
}
