import SerialPort from 'serialport';
import { includes } from 'lodash';
import logger from '../../../lib/logger';
import Business from '../../../lib/SACP-SDK/SACP/business/Business';
import SocketServer from '../../../lib/SocketManager';
import SocketBASE from './SACP-BASE';
import { SERIAL_MAP_SACP, PRINTING_MODULE, CNC_MODULE, LASER_MODULE, MODULEID_TOOLHEAD_MAP, ROTARY_MODULES, EMERGENCY_STOP_BUTTON } from '../../../../app/constants';
import { ConnectedData } from '../types';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
// import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_PRINTING } from '../../../constants';

const log = logger('lib:SocketSerial');

class SocketSerialNew extends SocketBASE {
    private serialport: SerialPort;

    private availPorts: any;

    static async getAvailPost() {
        const list = await SerialPort.list();
        log.debug(`static ${list[0]}`);
        return list;
    }

    public connectionOpen = async (socket: SocketServer) => {
        this.availPorts = await SerialPort.list();
        this.socket = socket;
        log.debug(`avalid ${this.availPorts[0].path}`);
        if (this.availPorts.length > 0) {
            this.serialport = new SerialPort(this.availPorts[0].path, {
                autoOpen: false,
                baudRate: 115200
            });
            this.sacpClient = new Business('serialport', this.serialport);
            this.serialport.on('data', (data) => {
                console.log('data', data);
                this.sacpClient.read(data);
            });
            this.serialport.once('open', () => {
                log.debug(`${this.availPorts[0].path} opened`);
                this.serialport.write('M2000 S5 P1\r\n');
                setTimeout(async () => {
                    // TO DO: Need to get seriesSize for 'connection:connected' event
                    let state: ConnectedData = {};
                    await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
                        Object.keys(moduleInfos).forEach(key => {
                            log.debug(`key: ${key}, value: ${moduleInfos[key]}`);
                            Object.keys(moduleInfos[key]).forEach(childKey => {
                                log.debug(`childKey: ${childKey}, value: ${moduleInfos[key][childKey]}`);
                            });
                        });
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
                        // Object.keys(coordinateInfos).forEach(key => {
                        //     log.debug(`key: ${key}`);
                        //     Object.keys(coordinateInfos[key]).forEach(childKey => {
                        //         log.debug(`childKey: ${childKey}, value: ${coordinateInfos[key][childKey]}`);
                        //     });
                        // });
                        const isHomed = !(coordinateInfos?.coordinateSystemInfo?.homed); // 0: homed, 1: need to home
                        state.isHomed = isHomed;
                    });
                    await this.sacpClient.getMachineInfo().then(({ data: machineInfos }) => {
                        Object.keys(machineInfos).forEach(key => {
                            log.debug(`key: ${key}, value: ${machineInfos[key]}`);
                        });
                        // result = {
                        //     series: SERIAL_MAP_SACP[machineInfos.type]
                        // };
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

    public goHome = () => {
        this.sacpClient.requestHome().then(({ response }) => {
            console.log({ response });
        });
    }
}

export default new SocketSerialNew();
