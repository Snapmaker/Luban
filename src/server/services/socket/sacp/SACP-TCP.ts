import net from 'net';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { includes } from 'lodash';
import wifiServerManager from '../WifiServerManager';
import type SocketServer from '../../../lib/SocketManager';
import { ConnectedData, EventOptions } from '../types';
import logger from '../../../lib/logger';
import { CONNECTION_TYPE_WIFI, HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import Business, { CoordinateType, RequestPhotoInfo, ToolHeadType } from './Business';
import CalibrationInfo from '../../../lib/SACP-SDK/SACP/business/models/CalibrationInfo';
import DataStorage from '../../../DataStorage';
// import MovementInstruction, { MoveDirection } from '../../lib/SACP-SDK/SACP/business/models/MovementInstruction';
import CoordinateInfo, { Direction } from '../../../lib/SACP-SDK/SACP/business/models/CoordinateInfo';
import MovementInstruction, { MoveDirection } from '../../../lib/SACP-SDK/SACP/business/models/MovementInstruction';
import SocketBASE from './SACP-BASE';
import { CNC_MODULE, EMERGENCY_STOP_BUTTON, LASER_MODULE, MODULEID_TOOLHEAD_MAP, PRINTING_MODULE, ROTARY_MODULES, SERIAL_MAP_SACP } from '../../../../app/constants';

const log = logger('lib:SocketTCP');

class SocketTCP extends SocketBASE {
    private client: net.Socket;

    private laserFocalLength: number = 0;

    private thickness: number = 0;

    constructor() {
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

    public onConnection = (socket: SocketServer) => {
        wifiServerManager.onConnection(socket);
    }

    public onDisconnection = (socket: SocketServer) => {
        wifiServerManager.onDisconnection(socket);
    }

    public refreshDevices = () => {
        wifiServerManager.refreshDevices();
    }

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        this.socket = socket;
        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });
        this.client.connect({
            host: options.address,
            port: 8888
        }, () => {
            log.info('TCP connected');

            this.sacpClient = new Business('tcp', this.client);
            this.sacpClient.setLogger(log);
            this.socket && this.socket.emit('connection:open', {});
            const hostName = os.hostname();
            log.info(`os hostname: ${hostName}`);
            this.sacpClient.wifiConnection(hostName, 'Luban', options.token, () => {
                this.client.destroy();
                if (this.client.destroyed) {
                    log.info('TCP manually closed');
                    const result = {
                        code: 200,
                        data: {},
                        msg: '',
                        text: ''
                    };
                    socket && socket.emit('connection:close', result);
                }
            }).then(async ({ response }) => {
                if (response.result === 0) {
                    let state: ConnectedData = {
                        isHomed: true,
                        err: null
                    };
                    await this.sacpClient.getMachineInfo().then(({ data: machineInfos }) => {
                        state = {
                            ...state,
                            series: SERIAL_MAP_SACP[machineInfos.type]
                        };
                        // log.debug(`serial, ${SERIAL_MAP_SACP[machineInfos.type]}`);
                    });
                    await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
                        const moduleListStatus = {
                            emergencyStopButton: false,
                            rotaryModule: false
                        };
                        moduleInfos.forEach(module => {
                            // let ariPurifier = false;
                            if (includes(PRINTING_MODULE, module.moduleId)) {
                                state.headType = HEAD_PRINTING;
                                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                            } else if (includes(LASER_MODULE, module.moduleId)) {
                                state.headType = HEAD_LASER;
                                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                            } else if (includes(CNC_MODULE, module.moduleId)) {
                                state.headType = HEAD_CNC;
                                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                            }
                            if (includes(ROTARY_MODULES, module.moduleId)) {
                                moduleListStatus.rotaryModule = true;
                            }
                            if (includes(EMERGENCY_STOP_BUTTON, module.moduleId)) {
                                moduleListStatus.emergencyStopButton = true;
                            }
                            if (module.moduleId === 14) {
                                this.sacpClient.getLaserToolHeadInfo(module.key).then(({ laserToolHeadInfo }) => {
                                    this.laserFocalLength = laserToolHeadInfo.laserFocalLength;
                                    log.debug(`laserToolHeadInfo.laserFocalLength, ${laserToolHeadInfo.laserFocalLength}`);
                                    this.socket && this.socket.emit('Marlin:state', {
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
                                        type: CONNECTION_TYPE_WIFI
                                    });
                                });
                            }
                        });
                        state.moduleStatusList = moduleListStatus;
                    });
                    this.socket && this.socket.emit('connection:connected', {
                        state,
                        err: state?.err,
                        type: CONNECTION_TYPE_WIFI
                    });
                    this.startHeartbeatBase(this.sacpClient, this.client);
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
                        socket && socket.emit('connection:close', result);
                    }
                }
            });
        });
    }

    public connectionClose = async (socket: SocketServer, options: EventOptions) => {
        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });
        await this.sacpClient.unSubscribeLogFeedback(this.subscribeLogCallback).then(res => {
            log.info(`unsubscribeLog: ${res}`);
        });
        await this.sacpClient.unSubscribeCurrentCoordinateInfo(this.subscribeCoordinateCallback).then(res => {
            log.info(`unSubscribeCoordinate: ${res}`);
        });
        await this.sacpClient.unSubscribeHotBedTemperature(this.subscribeHotBedCallback).then(res => {
            log.info(`unSubscribeHotBed, ${res}`);
        });
        await this.sacpClient.unSubscribeNozzleInfo(this.subscribeNozzleCallback).then(res => {
            log.info(`unSubscribeNozzle: ${res}`);
        });
        await this.sacpClient.unsubscribeHeartbeat(this.subscribeHeartCallback).then(res => {
            log.info(`unSubscribeHeart, ${res}`);
        });
        this.sacpClient.wifiConnectionClose().then(({ response }) => {
            if (response.result === 0) {
                setTimeout(() => {
                    this.sacpClient?.dispose();
                    this.client.destroy();
                    if (this.client.destroyed) {
                        log.info('TCP manually closed');
                        const result = {
                            code: 200,
                            data: {},
                            msg: '',
                            text: ''
                        };
                        socket && socket.emit(options.eventName, result);
                    }
                }, 3000);
            }
        });
    }

    public startHeartbeat = () => {
        this.startHeartbeatBase(this.sacpClient);
    };

    public uploadFile = (options: EventOptions) => {
        const { gcodePath, eventName } = options;
        const gcodeFullPath = `${DataStorage.tmpDir}${gcodePath}`;
        this.sacpClient.uploadFile(path.resolve(gcodeFullPath)).then((res) => {
            const result = {
                err: null,
                text: ''
            };
            if (res.response.result === 0) {
                log.info('ready to upload file');
            } else {
                result.text = 'can not upload file';
                result.err = 'fail';
                log.error('can not upload file');
            }
            this.socket && this.socket.emit(eventName, result);
        });
    };

    public takePhoto = async (params: RequestPhotoInfo, callback: (result: { status: boolean }) => void) => {
        return this.sacpClient.takePhoto(params).then(({ response }) => {
            if (response.result === 0) {
                callback({ status: true });
            } else {
                callback({ status: false });
            }
        });
    }

    public getCameraCalibration = async (callback: (matrix: CalibrationInfo) => void) => {
        return this.sacpClient.getCameraCalibration(ToolHeadType.LASER10000mW).then(({ response }) => {
            if (response.result === 0) {
                const calibrationInfo = new CalibrationInfo().fromBuffer(response.data);
                callback(calibrationInfo);
            } else {
                callback(new CalibrationInfo());
            }
        });
    }

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
    }

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
    }

    public setMatrix = async (params: { matrix: CalibrationInfo }, callback: (result: string) => void) => {
        return this.sacpClient.setMatrix(ToolHeadType.LASER10000mW, params.matrix).then(({ response }) => {
            if (response.result === 0) {
                callback('');
            } else {
                callback('error');
            }
        });
    }

    public getLaserMaterialThickness = (options: EventOptions) => {
        const { x, y, feedRate, eventName } = options;
        this.sacpClient.getLaserMaterialThickness({
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

                    const newX = new CoordinateInfo(Direction.X1, xNow);
                    const newY = new CoordinateInfo(Direction.Y1, yNow);
                    const newZ = new CoordinateInfo(Direction.Z1, zNow - (this.laserFocalLength + this.thickness));
                    const newCoord = [newX, newY, newZ];

                    log.debug(`new positions, ${newCoord}`);

                    await this.sacpClient.setWorkOrigin(newCoord);

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
    public async laseAutoSetMaterialHeight(options) {
        const { x, y, feedRate, toolHead } = options;
        const { response, thickness } = await this.sacpClient.getLaserMaterialThickness({
            token: '',
            x,
            y,
            feedRate
        });
        const result = {
            status: false,
            thickness: 0
        };
        if (response.result !== 0) {
            log.error(`useLaseAutoMode error: ${JSON.stringify(response)}`);
            return;
        }
        result.status = true;
        result.thickness = thickness;
        this.thickness = result.thickness;

        await this.laserSetWorkHeight({ toolHead: toolHead, materialThickness: this.thickness });
    }

    public uploadGcodeFile = (gcodeFilePath: string, type: string, callback: (msg: string, data: boolean) => void) => {
        this.sacpClient.uploadFile(gcodeFilePath).then(({ response }) => {
            let msg = '', data = false;
            if (response.result === 0) {
                msg = '';
                data = true;
            }
            callback(msg, data);
        });
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
        readStream.once('end', () => {
            this.sacpClient.startScreenPrint({
                headType: type, filename: uploadName, hash: md5.digest().toString('hex')
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
    }
}

export default new SocketTCP();
