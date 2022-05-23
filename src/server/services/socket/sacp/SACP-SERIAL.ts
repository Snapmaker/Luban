import SerialPort from 'serialport';
import fs from 'fs';
// import path from 'path';
import crypto from 'crypto';
import { includes } from 'lodash';
import logger from '../../../lib/logger';
import Business from './Business';
import SocketServer from '../../../lib/SocketManager';
import SocketBASE from './SACP-BASE';
import { SERIAL_MAP_SACP, PRINTING_MODULE, CNC_MODULE, LASER_MODULE, MODULEID_TOOLHEAD_MAP, ROTARY_MODULES, EMERGENCY_STOP_BUTTON } from '../../../../app/constants';
import { ConnectedData, EventOptions } from '../types';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import DataStorage from '../../../DataStorage';
// import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_PRINTING } from '../../../constants';

const log = logger('lib:SocketSerial');

class SocketSerialNew extends SocketBASE {
    private serialport: SerialPort;

    private availPorts: any;

    public startTime: number;

    // public sent: number;

    // public total: number;

    static async getAvailPost() {
        const list = await SerialPort.list();
        log.debug(`static ${list[0]}`);
        return list;
    }

    public connectionOpen = async (socket: SocketServer, options) => {
        this.availPorts = await SerialPort.list();
        this.socket = socket;
        if (this.availPorts.length > 0) {
            this.serialport = new SerialPort(options.port ?? this.availPorts[0].path, {
                autoOpen: false,
                baudRate: 115200
            });
            this.sacpClient = new Business('serialport', this.serialport);
            this.serialport.on('data', (data) => {
                // console.log('data', data);
                this.sacpClient.read(data);
            });
            this.serialport.once('open', () => {
                log.debug(`${options.port ?? this.availPorts[0].path} opened`);
                this.serialport.write('M2000 S5 P1\r\n');
                setTimeout(async () => {
                    // TO DO: Need to get seriesSize for 'connection:connected' event
                    let state: ConnectedData = {};
                    await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
                        const moduleListStatus = {
                            // airPurifier: false,
                            emergencyStopButton: false,
                            // enclosure: false,
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
                        });
                        state.moduleStatusList = moduleListStatus;
                    });
                    await this.sacpClient.getCurrentCoordinateInfo().then(({ data: coordinateInfos }) => {
                        const isHomed = !(coordinateInfos?.coordinateSystemInfo?.homed); // 0: homed, 1: need to home
                        state.isHomed = isHomed;
                    });
                    await this.sacpClient.getMachineInfo().then(({ data: machineInfos }) => {
                        Object.keys(machineInfos).forEach(key => {
                            log.debug(`key: ${key}, value: ${machineInfos[key]}`);
                        });

                        state = {
                            ...state,
                            series: SERIAL_MAP_SACP[machineInfos.type]
                        };
                        log.debug(`serial, ${SERIAL_MAP_SACP[machineInfos.type]}`);
                    });
                    // const getCurrentCoordinateInfo = this.sacpClient.getCurrentCoordinateInfo();
                    // const getMachineInfo = this.sacpClient.getMachineInfo();
                    // Promise.allSettled([this.sacpClient.getCurrentCoordinateInfo(), this.sacpClient.getMachineInfo()]).then((
                    //     res
                    // //         [
                    // //     { data: coordinateInfos },
                    // //     { data: machineInfos }
                    // // ]
                    // ) => {
                    //     // let state = {};
                    //     log.debug(`getMachineInfo, ${res}`);
                    //     // const coordinateInfos = resArr[0];
                    //     // const machineInfos = resArr[1];
                    //     // const isHomed = !(coordinateInfos?.coordinateSystemInfo?.homed); // 0: homed, 1: need to home
                    //     // state = {
                    //     //     series: SERIAL_MAP_SACP[machineInfos.type],
                    //     //     isHomed
                    //     // };
                    // }).catch(err => {
                    //     log.debug(`errArr, ${err}`);
                    // });
                    // this.socket && this.socket.emit('Marlin:state', result)
                    this.socket && this.socket.emit('connection:connected', { state: state });
                    this.startHeartbeatBase(this.sacpClient);
                }, 2000);
            });
            this.serialport.open();
        }
    }

    public connectionClose = () => {
        this.serialport?.close();
        this.serialport?.destroy();
        this.sacpClient?.dispose();
        this.socket.emit('connection:close');
    }

    public startGcode = async (options: EventOptions) => {
        const { headType } = options;
        let type = 0;
        if (headType === HEAD_PRINTING) {
            type = 0;
        } else if (headType === HEAD_LASER) {
            type = 2;
        } else if (headType === HEAD_CNC) {
            type = 1;
        }
        const gcodeFilePath = `${DataStorage.tmpDir}/${options.uploadName}`;
        await this.goHome();
        await this.sacpClient.startPrintSerial(gcodeFilePath, ({ lineNumber, length, elapsedTime: sliceTime }) => {
            const elapsedTime = new Date().getTime() - this.startTime;
            const progress = lineNumber / length;
            const remainingTime = (1 - (progress)) * progress * elapsedTime / progress + (1 - progress) * (1 - progress) * (sliceTime * 1000);
            const data = {
                total: length,
                sent: lineNumber,
                progress: lineNumber / length,
                elapsedTime,
                remainingTime
            };
            this.socket.emit('sender:status', ({ data }));
        });
        const md5 = crypto.createHash('md5');
        const readStream = fs.createReadStream(gcodeFilePath);
        readStream.on('data', buf => {
            md5.update(buf);
        });
        readStream.once('end', () => {
            this.sacpClient.startPrint(md5.digest().toString('hex'), options.uploadName, type).then(({ response }) => {
                log.info(`startPrinting: ${response.result}`);
                this.startTime = new Date().getTime();
            });
        });
    }
}


export default new SocketSerialNew();
