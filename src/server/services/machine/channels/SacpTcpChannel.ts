import crypto from 'crypto';
import fs from 'fs';
import { includes } from 'lodash';
import net from 'net';
import os from 'os';
import path from 'path';
import readline from 'readline';

import CalibrationInfo from '@snapmaker/snapmaker-sacp-sdk/dist/models/CalibrationInfo';
import CoordinateInfo, { Direction } from '@snapmaker/snapmaker-sacp-sdk/dist/models/CoordinateInfo';
import MovementInstruction, { MoveDirection } from '@snapmaker/snapmaker-sacp-sdk/dist/models/MovementInstruction';
import { SACP_TYPE_SERIES_MAP, } from '../../../../app/constants/machines';
import { SnapmakerArtisanMachine, SnapmakerJ1Machine } from '../../../../app/machines';
import DataStorage from '../../../DataStorage';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import logger from '../../../lib/logger';
import SacpClient, { CoordinateType, RequestPhotoInfo, ToolHeadType } from '../sacp/SacpClient';
import { ConnectionType, EventOptions } from '../types';
import { ChannelEvent } from './ChannelEvent';
import SacpChannelBase from './SacpChannel';

const log = logger('machine:channels:SacpTcpChannel');

class SacpTcpChannel extends SacpChannelBase {
    private client: net.Socket;

    private laserFocalLength = 0;

    private thickness = 0;

    public constructor() {
        super();

        this.client = new net.Socket();

        this.client.on('data', (buffer) => {
            this.sacpClient.read(buffer);
        });
        this.client.on('close', () => {
            log.info('TCP connection closed');
            const result = {
                code: 200,
                data: {},
                msg: '',
                text: ''
            };
            this.socket && this.socket.emit('connection:close', result);
        });
        this.client.on('error', (err) => {
            log.error(`TCP connection error: ${err}`);
        });
    }

    public onConnection = () => {
        // empty
    };

    public onDisconnection = () => {
        // empty
    };

    public async connectionOpen(options?: { address: string; token?: string }): Promise<boolean> {
        this.emit(ChannelEvent.Connecting);

        return new Promise((resolve, reject) => {
            this.client.connect({
                host: options.address,
                port: 8888
            }, () => {
                log.info('TCP connected');

                this.sacpClient = new SacpClient('tcp', this.client);

                const hostName = os.hostname();
                log.info(`os hostname: ${hostName}`);
                setTimeout(async () => {
                    // Connecting
                    this.emit(ChannelEvent.Connecting, { requireAuth: true });

                    try {
                        const { response } = await this.sacpClient.wifiConnection(hostName, 'Luban', options.token, () => {
                            // disconnected
                            this.client.destroy();
                            if (this.client.destroyed) {
                                log.info('TCP manually closed');
                                const result = {
                                    code: 200,
                                    data: {},
                                    msg: '',
                                    text: ''
                                };
                                this.socket && this.socket.emit('connection:close', result);
                            }
                        });

                        if (response.result === 0) {
                            this.emit(ChannelEvent.Connected);

                            // Connected
                            this.sacpClient.setLogger(log);
                            this.sacpClient.wifiConnectionHeartBeat();

                            // Get machine info
                            const { data: machineInfos } = await this.sacpClient.getMachineInfo();

                            const machineIdentifier = SACP_TYPE_SERIES_MAP[machineInfos.type];

                            if (machineIdentifier === SnapmakerArtisanMachine.identifier) {
                                this.emit(ChannelEvent.Ready, {
                                    machineIdentifier,
                                });
                            }
                            if (machineIdentifier === SnapmakerJ1Machine.identifier) {
                                this.emit(ChannelEvent.Ready, {
                                    machineIdentifier,
                                });
                            }

                            // TODO: Refactor this to ArtisanInstance
                            // Get module infos
                            const moduleInfos = await this.getModuleInfo();

                            moduleInfos.forEach(module => {
                                // TODO: Hard-coded 10W laser head,
                                if (module.moduleId === 14) {
                                    this.sacpClient.getLaserToolHeadInfo(module.key).then(({ laserToolHeadInfo }) => {
                                        this.laserFocalLength = laserToolHeadInfo.laserFocalLength;

                                        log.debug(`laserToolHeadInfo.laserFocalLength, ${laserToolHeadInfo.laserFocalLength}`);
                                        this.socket && this.socket.emit('Marlin:state', {
                                            type: ConnectionType.WiFi,
                                            state: {
                                                temperature: {
                                                    t: 0,
                                                    tTarget: 0,
                                                    b: 0,
                                                    bTarget: 0
                                                },
                                                laserFocalLength: laserToolHeadInfo.laserFocalLength,
                                                pos: {
                                                    x: 0,
                                                    y: 0,
                                                    z: 0,
                                                    b: 0,
                                                    isFourAxis: false
                                                },
                                                originOffset: {
                                                    x: 0,
                                                    y: 0,
                                                    z: 0,
                                                }
                                            },
                                        });
                                    });

                                    this.sacpClient.getLaserLockStatus(module.key)
                                        .then(({ laserLockStatus }) => {
                                            this.socket && this.socket.emit('machine:laser-status', {
                                                isLocked: laserLockStatus.lockStatus,
                                            });
                                        });
                                }
                            });

                            resolve(true);
                        } else {
                            this.client.destroy();
                            if (this.client.destroyed) {
                                log.info('TCP manually closed');
                                const result = {
                                    code: 200,
                                    data: {},
                                    msg: '',
                                    text: ''
                                };
                                this.socket && this.socket.emit('connection:close', result);
                            }

                            resolve(false);
                        }
                    } catch (e) {
                        log.error(e);
                        reject(e);
                    }
                }, 200);
            });
        });
    }

    public async connectionClose(options?: { force: boolean }): Promise<boolean> {
        // await this.sacpClient.unSubscribeLogFeedback(this.subscribeLogCallback).then(res => {
        //     log.info(`unsubscribeLog: ${res}`);
        // });
        // await this.sacpClient.unSubscribeCurrentCoordinateInfo(this.subscribeCoordinateCallback).then(res => {
        //     log.info(`unSubscribeCoordinate: ${res}`);
        // });
        // await this.sacpClient.unSubscribeHotBedTemperature(this.subscribeHotBedCallback).then(res => {
        //     log.info(`unSubscribeHotBed, ${res}`);
        // });
        // await this.sacpClient.unSubscribeNozzleInfo(this.subscribeNozzleCallback).then(res => {
        //     log.info(`unSubscribeNozzle: ${res}`);
        // });
        // await this.sacpClient.unsubscribeHeartbeat(this.subscribeHeartCallback).then(res => {
        //     log.info(`unSubscribeHeart, ${res}`);
        // });

        const force = options?.force || false;

        if (!force) {
            const { response } = await this.sacpClient.wifiConnectionClose();

            if (response.result === 0) {
                return new Promise<boolean>((resolve) => {
                    // TODO: why wait 500ms, please document this.
                    setTimeout(() => {
                        this.sacpClient?.dispose();

                        this.client.destroy();
                        if (this.client.destroyed) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }, 500);
                });
            } else {
                // close failed
                return false;
            }
        } else {
            // Force close the socket connection.
            this.sacpClient?.dispose();
            this.client && this.client.destroy();
            if (this.client.destroyed) {
                return true;
            } else {
                return false;
            }
        }
    }

    public async startHeartbeat(): Promise<void> {
        return super.startHeartbeat();
    }

    public async stopHeartbeat(): Promise<void> {
        return super.stopHeartbeat();
    }

    public takePhoto = async (params: RequestPhotoInfo, callback: (result: { status: boolean }) => void) => {
        return this.sacpClient.takePhoto(params).then(({ response }) => {
            if (response.result === 0) {
                callback({ status: true });
            } else {
                callback({ status: false });
            }
        });
    };

    public getCameraCalibration = async (callback: (matrix: CalibrationInfo) => void) => {
        return this.sacpClient.getCameraCalibration(ToolHeadType.LASER10000mW).then(({ response }) => {
            if (response.result === 0) {
                const calibrationInfo = new CalibrationInfo().fromBuffer(response.data);
                callback(calibrationInfo);
            } else {
                callback(new CalibrationInfo());
            }
        });
    };

    public getPhoto = async (callback: (result: { success: boolean, filename: string }) => void) => {
        return this.sacpClient.getPhoto(0).then(({ response, data }) => {
            let success = false;
            let filename = '';
            if (response.result === 0) {
                success = true;
                filename = data.filename;
            }
            callback({
                success,
                filename
            });
        });
    };

    public getCalibrationPhoto = async (callback: (result: { success: boolean, filename: string }) => void) => {
        return this.sacpClient.getCalibrationPhoto(ToolHeadType.LASER10000mW).then(({ response, data }) => {
            let success = false;
            let filename = '';
            if (response.result === 0) {
                success = true;
                filename = data.filename;
            }
            callback({
                success,
                filename
            });
        });
    };

    public setMatrix = async (params: { matrix: CalibrationInfo }, callback: (result: string) => void) => {
        return this.sacpClient.setMatrix(ToolHeadType.LASER10000mW, params.matrix).then(({ response }) => {
            if (response.result === 0) {
                callback('');
            } else {
                callback('error');
            }
        });
    };

    public getLaserMaterialThickness = async (options: EventOptions) => {
        const { x, y, feedRate, eventName, isCameraCapture = false } = options;
        log.debug(`x, y, feedRate, eventName, isCameraCapture, ${x}, ${y}, ${feedRate}, ${isCameraCapture}`);
        if (isCameraCapture) {
            try {
                await this.sacpClient.getCurrentCoordinateInfo().then(async ({ coordinateSystemInfo }) => {
                    const xNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.X1).value;
                    const yNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Y1).value;
                    const zNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Z1).value;

                    log.debug(`current positions, ${xNow}, ${yNow}, ${zNow}`);
                    log.debug(`thickness & focal, ${this.thickness}, ${this.laserFocalLength}`);

                    await this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE);

                    if (isCameraCapture) {
                        const newX = new CoordinateInfo(Direction.X1, xNow);
                        const newY = new CoordinateInfo(Direction.Y1, yNow);
                        const newZ = new CoordinateInfo(Direction.Z1, zNow - (this.laserFocalLength + this.thickness));
                        const newCoord = [newX, newY, newZ];

                        log.debug(`new positions, ${newCoord}`);

                        await this.sacpClient.setWorkOrigin(newCoord);
                    }
                });
            } catch (e) {
                log.error(`isCameraCapture getLaserMaterialThickness error: ${e}`);
            }
        }

        await this.sacpClient.getLaserMaterialThickness({
            token: '',
            x,
            y,
            feedRate
        }).then(async ({ response, thickness }) => {
            const result = {
                status: false,
                thickness: 0
            };
            if (response.result === 0) {
                result.status = true;
                result.thickness = thickness;
            }
            this.thickness = result.thickness;
            try {
                const res1 = await this.sacpClient.updateCoordinate(CoordinateType.MACHINE);
                log.debug(`=====, ${res1}`);
                this.sacpClient.getCurrentCoordinateInfo().then(async ({ coordinateSystemInfo }) => {
                    const xNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.X1).value;
                    const yNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Y1).value;
                    const zNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Z1).value;

                    log.debug(`current positions, ${xNow}, ${yNow}, ${zNow}`);
                    log.debug(`thickness & focal, ${this.thickness}, ${this.laserFocalLength}`);

                    await this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE);

                    if (isCameraCapture) {
                        const newX = new CoordinateInfo(Direction.X1, xNow);
                        const newY = new CoordinateInfo(Direction.Y1, yNow);
                        const newZ = new CoordinateInfo(Direction.Z1, zNow - (this.laserFocalLength + this.thickness));
                        const newCoord = [newX, newY, newZ];

                        log.debug(`new positions, ${newCoord}`);

                        await this.sacpClient.setWorkOrigin(newCoord);
                    }

                    const zMove = new MovementInstruction(MoveDirection.Z1, 0);
                    await this.sacpClient.moveAbsolutely([zMove], 0);
                    this.socket && this.socket.emit(eventName, { data: result });
                });
            } catch (e) {
                log.error(`getLaserMaterialThickness error: ${e}`);
            }
        });
    };

    public abortLaserMaterialThickness = () => {
        // this.getLaserMaterialThicknessReq && this.getLaserMaterialThicknessReq.abort();
    };

    // set z workoringin: laserFocalLength + platformHeight + laserMaterialThickness
    public async laseAutoSetMaterialHeight({ toolHead }) {
        log.info(`laseAutoSetMaterialHeight: ${toolHead}, ${this.thickness}`);

        await this.laserSetWorkHeight({ toolHead: toolHead, materialThickness: this.thickness });
    }

    public uploadGcodeFile = async (gcodeFilePath: string, type: string, renderName: string, callback: (msg: string, data: boolean) => void) => {
        this.totalLine = null;
        this.estimatedTime = null;
        const rl = readline.createInterface({
            input: fs.createReadStream(gcodeFilePath),
            output: process.stdout,
            terminal: false
        });
        rl.on('line', (data) => {
            if (includes(data, ';file_total_lines')) {
                this.totalLine = parseFloat(data.slice(18));
            }
            if (includes(data, ';Lines')) {
                this.totalLine = parseFloat(data.slice(7));
            }
            if (includes(data, ';estimated_time(s)')) {
                this.estimatedTime = parseFloat(data.slice(19));
            }
            if (includes(data, ';Estimated Print Time')) {
                this.estimatedTime = parseFloat(data.slice(22));
            }
            if (includes(data, ';Header End')) {
                rl.close();
            }
        });

        const success = await this.sacpClient.uploadFile(gcodeFilePath, renderName);
        let msg = '', data = false;
        if (success) {
            msg = '';
            data = true;
        }
        /*
        TODO: wrong event?
        this.socket && this.socket.emit('connection:startGcode', {
            msg: '', res: null
        });
        */
        callback(msg, data);
    };

    // start print
    public startGcode = (options: EventOptions) => {
        const { eventName, headType, uploadName } = options;
        let type = 0;
        if (headType === HEAD_PRINTING) {
            type = 0;
        } else if (headType === HEAD_LASER) {
            type = 2;
        } else if (headType === HEAD_CNC) {
            type = 1;
        }
        const md5 = crypto.createHash('md5');
        const gcodeFullPath = path.resolve(DataStorage.tmpDir, uploadName);
        const readStream = fs.createReadStream(gcodeFullPath);
        readStream.on('data', buf => {
            md5.update(buf);
        });
        readStream.once('end', async () => {
            this.startTime = new Date().getTime();
            this.sacpClient.startScreenPrint({
                headType: type, filename: options.renderName, hash: md5.digest().toString('hex')
            }).then((res) => {
                log.info(`start printing: ${res.response.result}`);
                this.socket && this.socket.emit(eventName, {
                    msg: '', res: null
                });
            });
        });
        readStream.once('error', () => {
            this.socket && this.socket.emit(eventName, {
                msg: 'read gcode file error',
                res: null
            });
        });
    };
}

const channel = new SacpTcpChannel();

export {
    channel as sacpTcpChannel
};

export default SacpTcpChannel;
