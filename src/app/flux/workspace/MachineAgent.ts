import { EventEmitter } from 'events';

import ControllerEvent from '../../connection/controller-events';
import {
    CONNECTION_COORDINATE_MOVE,
    CONNECTION_GO_HOME,
    CONNECTION_SET_WORK_ORIGIN,
    CUSTOM_SERVER_NAME,
} from '../../constants';
import { controller } from '../../lib/controller';
import log from '../../lib/log';
import { dispatch } from '../../store';
import baseActions from './actions-base';
import { ConnectionType } from './state';

interface CreateOptions {
    name: string;
    address: string;
    port?: string;
    protocol?: string;
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
    public port: string; // for serial machine, it's serial port path

    private token?: string; // possible token for authentication

    private model?: string; // indicates which machine
    private protocol?: string; // which protocol to use
    private addByUser: boolean = false;

    // TODO: creation methods

    public static createAgent(options: CreateOptions): MachineAgent {
        const agent = new MachineAgent();

        agent.name = options.name;
        agent.address = options.address;
        agent.port = options.port;
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

    public async connect(): Promise<{ code: number | string; msg: string; }> {
        if (this.isNetworkedMachine) {
            log.info(`Connecting to machine ${this.address}...`);
            log.info(`- protocol = ${this.protocol}`);
        } else {
            log.info(`Connecting to port ${this.port}...`);
            log.info(`- protocol = ${this.protocol}`);
        }

        return new Promise((resolve) => {
            controller
                .emitEvent(ControllerEvent.ConnectionOpen, {
                    connectionType: this.isNetworkedMachine ? ConnectionType.WiFi : ConnectionType.Serial,
                    host: this.host,
                    address: this.address,
                    token: this.token,
                    port: this.port,
                    protocol: this.protocol,
                    addByUser: this.addByUser,
                })
                .once(ControllerEvent.ConnectionOpen, ({ msg, data, code }) => {
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
                    .emitEvent(ControllerEvent.ConnectionClose, { force })
                    .once(ControllerEvent.ConnectionClose, () => {
                        log.info('Disconnected from machine.');
                        resolve(true);
                    });
            });
        } else {
            return new Promise((resolve) => {
                controller
                    .emitEvent(ControllerEvent.ConnectionClose, { force })
                    .once(ControllerEvent.ConnectionClose, () => {
                        resolve(true);
                    });

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
                .emitEvent(ControllerEvent.ExecuteGCode, { gcode })
                .once(ControllerEvent.ExecuteGCode, () => {
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
                .emitEvent(ControllerEvent.ExecuteCmd, { gcode, context, cmd })
                .once(ControllerEvent.ExecuteCmd, () => {
                    resolve(true);
                });
        });
    }

    public coordinateMove(moveOrders, gcode, jogSpeed, headType) {
        controller.emitEvent(CONNECTION_COORDINATE_MOVE, { moveOrders, gcode, jogSpeed, headType }, () => {
            // homed
        });
    }

    public setWorkOrigin(xPosition, yPosition, zPosition, bPosition) {
        controller.emitEvent(CONNECTION_SET_WORK_ORIGIN, { xPosition, yPosition, zPosition, bPosition });
    }

    public startServerGcode(args, callback) {
        controller
            .emitEvent(ControllerEvent.StartGCode, args)
            .once(ControllerEvent.StartGCode, ({ msg, code }) => {
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

        dispatch(baseActions.updateState({
            isSendedOnWifi: false
        }));
    }

    public pauseServerGcode(callback) {
        controller
            .emitEvent(ControllerEvent.PauseGCode)
            .once(ControllerEvent.PauseGCode, (options) => {
                callback && callback(options);
            });
    }

    public resumeServerGcode(args, callback) {
        controller
            .emitEvent(ControllerEvent.ResumeGCode, args, callback)
            .once(ControllerEvent.ResumeGCode, (options) => {
                callback && callback(options);
            });
    }

    public stopServerGcode(callback) {
        controller
            .emitEvent(ControllerEvent.StopGCode)
            .once(ControllerEvent.StopGCode, (options) => {
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
        controller.emitEvent(CONNECTION_GO_HOME, data, callback);
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
