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
import DataStorage from '../../../DataStorage';
import { CONNECTION_TYPE_WIFI, HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import logger from '../../../lib/logger';
import wifiServerManager from '../../socket/WifiServerManager';
import { ConnectedData, EventOptions } from '../types';
import Business, { CoordinateType, RequestPhotoInfo, ToolHeadType } from '../sacp/Business';
// import MovementInstruction, { MoveDirection } from '../../lib/SACP-SDK/SACP/business/models/MovementInstruction';
import {
    CNC_HEAD_MODULE_IDS,
    EMERGENCY_STOP_BUTTON,
    LASER_HEAD_MODULE_IDS,
    MODULEID_TOOLHEAD_MAP,
    PRINTING_HEAD_MODULE_IDS,
    ROTARY_MODULES,
    SACP_TYPE_SERIES_MAP,
} from '../../../../app/constants/machines';
import SocketServer from '../../../lib/SocketManager';
import SocketBASE from './SACP-BASE';

const log = logger('lib:SocketTCP');

class SocketTCP extends SocketBASE {
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
        // wifiServerManager.onConnection(socket);
    };

    public onDisconnection = (socket: SocketServer) => {
        wifiServerManager.onDisconnection(socket);
    };

    public refreshDevices = () => {
        wifiServerManager.refreshDevices();
    };

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        this.socket = socket;
        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });
        this.client.connect({
            host: options.address,
            port: 8888
        }, () => {
            log.info('TCP connected');

            this.sacpClient = new Business('tcp', this.client);
            this.socket && this.socket.emit('connection:open', {});
            const hostName = os.hostname();
            log.info(`os hostname: ${hostName}`);
            setTimeout(async () => {
                try {
                    const { response } = await this.sacpClient.wifiConnection(hostName, 'Luban', options.token, () => {
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
                    });

                    if (response.result === 0) {
                        // Connected
                        this.sacpClient.setLogger(log);
                        this.sacpClient.wifiConnectionHeartBeat();
                        this.setROTSubscribeApi();
                        let state: ConnectedData = {
                            isHomed: true,
                            err: null
                        };

                        // Get machine info
                        await this.sacpClient.getMachineInfo().then(({ data: machineInfos }) => {
                            state = {
                                ...state,
                                series: SACP_TYPE_SERIES_MAP[machineInfos.type]
                            };
                            // log.debug(`serial, ${SERIAL_MAP_SACP[machineInfos.type]}`);
                        });

                        // Get module infos
                        await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
                            const moduleListStatus = {
                                emergencyStopButton: false,
                                rotaryModule: false,
                            };

                            const toolHeadModules = [];
                            moduleInfos.forEach(module => {
                                // let ariPurifier = false;
                                if (includes(PRINTING_HEAD_MODULE_IDS, module.moduleId)) {
                                    state.headType = HEAD_PRINTING;
                                    toolHeadModules.push(module);
                                } else if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                                    state.headType = HEAD_LASER;
                                    toolHeadModules.push(module);
                                } else if (includes(CNC_HEAD_MODULE_IDS, module.moduleId)) {
                                    state.headType = HEAD_CNC;
                                    toolHeadModules.push(module);
                                }

                                if (includes(ROTARY_MODULES, module.moduleId)) {
                                    moduleListStatus.rotaryModule = true;
                                }
                                if (includes(EMERGENCY_STOP_BUTTON, module.moduleId)) {
                                    moduleListStatus.emergencyStopButton = true;
                                }

                                // TODO: Hard-coded 10W laser head,
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

                                    this.sacpClient.getLaserLockStatus(module.key)
                                        .then(({ laserLockStatus }) => {
                                            this.socket && this.socket.emit('machine:laser-status', {
                                                isLocked: laserLockStatus.lockStatus,
                                            });
                                        });
                                }
                            });

                            if (toolHeadModules.length === 0) {
                                state.toolHead = MODULEID_TOOLHEAD_MAP['0']; // default extruder
                            } else if (toolHeadModules.length === 1) {
                                const module = toolHeadModules[0];
                                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                            } else if (toolHeadModules.length === 2) {
                                // hard-coded IDEX head for J1, refactor this later.
                                state.toolHead = MODULEID_TOOLHEAD_MAP['00'];
                            }

                            state.moduleStatusList = moduleListStatus;
                        });
                        this.socket && this.socket.emit('connection:connected', {
                            state,
                            err: state?.err,
                            type: CONNECTION_TYPE_WIFI
                        });

                        // TODO: Do not start heart beat automatically
                        // this.startHeartbeatBase(this.sacpClient, this.client);
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
                    }
                } catch (e) {
                    log.error(e);
                }
            }, 200);
        });
    };

    public connectionCloseImproper = () => {
        this.client && this.client.destroy();
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
    };

    public connectionClose = (socket: SocketServer, options: EventOptions) => {
        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });
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
                }, 500);
            }
        });
    };

    public startHeartbeat = () => {
        this.startHeartbeatBase(this.sacpClient, undefined);
    };

    public uploadFile = (options: EventOptions) => {
        const { gcodePath, eventName, renderGcodeFileName = '' } = options;
        const renderName = renderGcodeFileName || path.basename(gcodePath);

        const gcodeFullPath = `${DataStorage.tmpDir}${gcodePath}`;
        this.sacpClient.uploadFile(path.resolve(gcodeFullPath), renderName).then((res) => {
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

    public uploadGcodeFile = (gcodeFilePath: string, type: string, renderName: string, callback: (msg: string, data: boolean) => void) => {
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
        this.sacpClient.uploadFile(gcodeFilePath, renderName).then(({ response }) => {
            let msg = '', data = false;
            if (response.result === 0) {
                msg = '';
                data = true;
            }
            this.socket && this.socket.emit('connection:startGcode', {
                msg: '', res: null
            });
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

export default new SocketTCP();
