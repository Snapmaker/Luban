import net from 'net';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import wifiServerManager from '../WifiServerManager';
import type SocketServer from '../../../lib/SocketManager';
import { EventOptions } from '../types';
import logger from '../../../lib/logger';
import { CONNECTION_TYPE_WIFI, DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_CNC, HEAD_LASER, HEAD_PRINTING, WORKFLOW_STATE_PAUSED } from '../../../constants';
import Business, { CoordinateType, RequestPhotoInfo, ToolHeadType } from './Business';
import CalibrationInfo from '../../../lib/SACP-SDK/SACP/business/models/CalibrationInfo';
import DataStorage from '../../../DataStorage';
// import MovementInstruction, { MoveDirection } from '../../lib/SACP-SDK/SACP/business/models/MovementInstruction';
import CoordinateInfo, { Direction } from '../../../lib/SACP-SDK/SACP/business/models/CoordinateInfo';
import MovementInstruction, { MoveDirection } from '../../../lib/SACP-SDK/SACP/business/models/MovementInstruction';
import SocketBASE from './SACP-BASE';

const log = logger('lib:SocketTCP');

class SocketTCP extends SocketBASE {
    // private heartbeatTimer;

    // private socket: SocketServer;

    private client: net.Socket;

    // private sacpClient: Business;

    private laserFocalLength: number = 0;

    private thickness: number = 0;

    constructor() {
        super();
        this.client = new net.Socket();
        this.sacpClient = new Business('tcp', this.client);
        this.sacpClient.setLogger(log);

        this.client.on('data', (buffer) => {
            this.sacpClient.read(buffer);
        });
        this.client.on('close', () => {
            log.info('TCP connection closed');
            this.socket && this.socket.emit('connection:close');
        });
        this.client.on('error', (err) => {
            log.error(`TCP connection error: ${err}`);
        });
    }

    public onConnection = (socket: SocketServer) => {
        wifiServerManager.onConnection(socket);
        // this.heartBeatWorker && this.heartBeatWorker.terminate();
    }

    public onDisconnection = (socket: SocketServer) => {
        wifiServerManager.onDisconnection(socket);
    }

    public refreshDevices = () => {
        wifiServerManager.refreshDevices();
    }

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        this.socket = socket;
        this.sacpClient.setHandler(0x01, 0x03, (data) => {
            const state = {
                toolHead: DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
                series: 'A400',
                status: WORKFLOW_STATE_PAUSED,
                headType: HEAD_PRINTING,
                isHomed: true,
                err: null
            };
            this.socket && this.socket.emit('connection:connected', {
                state,
                err: state?.err,
                type: CONNECTION_TYPE_WIFI
            });
            this.sacpClient.ack(0x01, 0x03, data.packet, Buffer.alloc(1, 0));
            // setTimeout(() => {
            //     this.sacpClient.requestHome().then((res) => {
            //         log.info(`request homing: ${res.response}`);
            //     }).then(() => {
            //     });
            // }, 2000);
            this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
                const info = moduleInfos.find(moduleInfo => moduleInfo.moduleId === 14);
                this.sacpClient.getLaserToolHeadInfo(info.key).then(({ laserToolHeadInfo }) => {
                    this.laserFocalLength = laserToolHeadInfo.laserFocalLength;
                    log.debug(`laserToolHeadInfo.laserFocalLength, ${laserToolHeadInfo.laserFocalLength}`);
                    this.socket && this.socket.emit('Marlin:state', {
                        state: {
                            isHomed: true,
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
            });
        });
        // this.sacpClient.setHandler(0x01, 0x36, (data) => {
        //     console.log('0x0136', data);
        // });
        this.client.connect({
            host: options.address,
            port: 8888
        }, () => {
            log.info('TCP connected');
            const result = {
                msg: '',
                data: {
                    hasEnclosure: false,
                    headType: 2,
                    readonly: false,
                    series: 'Snapmaker A400',
                    token: '415344a6-f7b7-4900-a391-aa6695e2dfdb'
                },
                text: '{"token":"415344a6-f7b7-4900-a391-aa6695e2dfdb","readonly":false,"series":"Snapmaker A400","headType":2,"hasEnclosure":false}'
            };
            this.socket && this.socket.emit('connection:open', result);
        });
    }

    public connectionClose = (socket: SocketServer, options: EventOptions) => {
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

    public getCameraCalibration = (callback: (matrix: CalibrationInfo) => void) => {
        return this.sacpClient.getCameraCalibration(ToolHeadType.LASER10000mW).then(({ response }) => {
            if (response.result === 0) {
                const calibrationInfo = new CalibrationInfo().fromBuffer(response.data);
                callback(calibrationInfo);
            } else {
                callback(new CalibrationInfo());
            }
        });
    }

    public getPhoto = (callback: (result: { success: boolean, filename: string }) => void) => {
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

    public getCalibrationPhoto = (callback: (result: { success: boolean, filename: string }) => void) => {
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

    public setMatrix = (params: { matrix: CalibrationInfo }, callback: (result: string) => void) => {
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

    // public executeGcode = async (options: EventOptions, callback: () => void) => {
    //     const { gcode } = options;
    //     const gcodeLines = gcode.split('\n');
    //     // callback && callback();
    //     log.debug(`executeGcode, ${gcodeLines}`);
    //     try {
    //         callback && callback();
    //         this.socket && this.socket.emit('connection:executeGcode', { msg: '', res: null });
    //     } catch (e) {
    //         log.error(`execute gcode error: ${e}`);
    //     }
    // };

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
            }).then(() => {
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
