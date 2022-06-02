import { includes, find } from 'lodash';
import net from 'net';
import Business, { CoordinateType } from './Business';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import { COORDINATE_AXIS, WORKFLOW_STATUS_MAP, HEAD_PRINTING, EMERGENCY_STOP_BUTTON, ENCLOSURE_MODULES, AIR_PURIFIER_MODULES, ROTARY_MODULES, MODULEID_TOOLHEAD_MAP, CNC_MODULE, LASER_MODULE, PRINTING_MODULE, HEAD_CNC, HEAD_LASER } from '../../../../app/constants';
import { readString, readUint8 } from '../../../lib/SACP-SDK/SACP/helper';
import GetHotBed from '../../../lib/SACP-SDK/SACP/business/models/GetHotBed';
import CoordinateSystemInfo from '../../../lib/SACP-SDK/SACP/business/models/CoordinateSystemInfo';
import { EventOptions, MarlinStateData } from '../types';
import ExtruderInfo from '../../../lib/SACP-SDK/SACP/business/models/ExtruderInfo';
import CoordinateInfo, { Direction } from '../../../lib/SACP-SDK/SACP/business/models/CoordinateInfo';
import { ResponseCallback } from '../../../lib/SACP-SDK/SACP/communication/Dispatcher';

const log = logger('lib:SocketBASE');

class SocketBASE {
    private heartbeatTimer;

    socket: SocketServer;

    sacpClient: Business;

    subscribeLogCallback: ResponseCallback;

    subscribeHeartCallback: ResponseCallback;

    subscribeNozzleCallback: ResponseCallback;

    subscribeHotBedCallback: ResponseCallback;

    subscribeCoordinateCallback: ResponseCallback;

    public startHeartbeatBase = (sacpClient: Business, client?: net.Socket) => {
        this.sacpClient = sacpClient;
        let stateData: MarlinStateData = {};
        let statusKey = 0;
        const moduleStatusList = {
            rotaryModule: false,
            airPurifier: false,
            emergencyStopButton: false,
            enclosure: false
        };
        this.sacpClient.logFeedbackLevel(2).then(({ response }) => {
            log.info(`logLevel, ${response}`);
            if (response.result === 0) {
                this.subscribeLogCallback = (data) => {
                    const result = readString(data.response.data, 1).result;
                    console.log('logData', result, data);
                    this.socket && this.socket.emit('serialport:read', { data: result });
                };
                this.sacpClient.subscribeLogFeedback({ interval: 60000 }, this.subscribeLogCallback);
            }
        });
        this.sacpClient.setHandler(0x01, 0x36, ({ param }) => {
            const isHomed = readUint8(param, 0);
            stateData = {
                ...stateData,
                isHomed: !isHomed
            };
            if (stateData.headType !== HEAD_PRINTING) {
                this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE).then(({ response }) => {
                    log.info(`updateCoordinateType, ${response.result}`);
                });
            }
            this.socket && this.socket.emit('move:status', { isHoming: false });
        });
        this.subscribeHeartCallback = async (data) => {
            statusKey = readUint8(data.response.data, 0);
            stateData.airPurifier = false;
            if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = setTimeout(() => {
                client && client.destroy();
                log.info('TCP close');
                this.socket && this.socket.emit('connection:close')
            }, 10000);
            await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
                // log.info(`revice moduleInfo: ${data.response}`);
                moduleInfos.forEach(module => {
                    if (includes(EMERGENCY_STOP_BUTTON, module.moduleId)) {
                        moduleStatusList.emergencyStopButton = true;
                    }
                    if (includes(ENCLOSURE_MODULES, module.moduleId)) {
                        moduleStatusList.enclosure = true;
                    }
                    if (includes(ROTARY_MODULES, module.moduleId)) {
                        moduleStatusList.rotaryModule = true;
                    }
                    if (includes(AIR_PURIFIER_MODULES, module.moduleId)) {
                        stateData.airPurifier = true;
                        // need to update airPurifier status
                    }
                    if (includes(PRINTING_MODULE, module.moduleId)) {
                        stateData.headType = HEAD_PRINTING;
                        stateData.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                    } else if (includes(LASER_MODULE, module.moduleId)) {
                        stateData.headType = HEAD_LASER;
                        stateData.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                    } else if (includes(CNC_MODULE, module.moduleId)) {
                        stateData.headType = HEAD_CNC;
                        stateData.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
                    }
                });
            });
            // stateData.status = WORKFLOW_STATUS_MAP[statusKey];
            this.socket && this.socket.emit('Marlin:state', { state: {
                ...stateData,
                status: WORKFLOW_STATUS_MAP[statusKey],
                moduleList: moduleStatusList,
            } });
        };
        this.sacpClient.subscribeHeartbeat({ interval: 1000 }, this.subscribeHeartCallback).then((res) => {
            log.info(`subscribe heartbeat success: ${res.code}`);
        });
        this.subscribeHotBedCallback = (data) => {
            const hotBedInfo = new GetHotBed().fromBuffer(data.response.data);
            // log.info(`hotbedInfo, ${hotBedInfo}`);
            stateData = {
                ...stateData,
                heatedBedTargetTemperature: hotBedInfo?.zoneList[0]?.targetTemzperature || 0,
                heatedBedTemperature: hotBedInfo?.zoneList[0]?.currentTemperature || 0
            };
        };
        this.sacpClient.subscribeHotBedTemperature({ interval: 1000 }, this.subscribeHotBedCallback).then(res => {
            log.info(`subscribe hotbed success: ${res}`);
        });
        this.subscribeNozzleCallback = (data) => {
            const nozzleInfo = new ExtruderInfo().fromBuffer(data.response.data);
            // log.info(`nozzleInfo, ${nozzleInfo}`);
            const leftInfo = find(nozzleInfo.extruderList, { index: 0 });
            const rightInfo = find(nozzleInfo.extruderList, { index: 1 });
            stateData = {
                ...stateData,
                nozzleTemperature: leftInfo.currentTemperature,
                nozzleTargetTemperature: leftInfo.targetTemperature,
                nozzleRightTargetTemperature: rightInfo?.targetTemperature || 0,
                nozzleRightTemperature: rightInfo?.currentTemperature || 0
            };
        };
        this.sacpClient.subscribeNozzleInfo({ interval: 1000 }, this.subscribeNozzleCallback).then(res => {
            log.info(`subscribe nozzle success: ${res}`);
        });
        this.subscribeCoordinateCallback = (data) => {
            // log.info(`revice coordinate: ${data.response}`);
            const response = data.response;
            const coordinateInfos = new CoordinateSystemInfo().fromBuffer(response.data);
            const currentCoordinate = coordinateInfos.coordinates;
            const originCoordinate = coordinateInfos.originOffset;
            const pos = {
                x: currentCoordinate[0].value,
                y: currentCoordinate[1].value,
                z: currentCoordinate[2].value,
                b: currentCoordinate[3].value,
                isFourAxis: moduleStatusList.rotaryModule
            };
            const originOffset = {
                x: originCoordinate[0].value,
                y: originCoordinate[1].value,
                z: originCoordinate[2].value,
                b: originCoordinate[3].value
            };
            const isHomed = !(coordinateInfos?.homed); // 0: homed, 1: need to home

            stateData = {
                ...stateData,
                pos,
                originOffset,
                isHomed,
                // isMoving: false
            };
        };
        this.sacpClient.subscribeCurrentCoordinateInfo({ interval: 1000 }, this.subscribeCoordinateCallback).then(res => {
            log.info(`subscribe coordination success: ${res}`);
        });
    };

    public executeGcode = async (options: EventOptions, callback: () => void) => {
        log.info('run executeGcode');
        const { gcode } = options;
        const gcodeLines = gcode.split('\n');
        // callback && callback();
        log.debug(`executeGcode, ${gcodeLines}`);
        gcodeLines.forEach(_gcode => {
            this.sacpClient.executeGcode(_gcode).then(res => {
                log.info(`execute gcode: ${res}`);
            });
        });
        try {
            callback && callback();
            this.socket && this.socket.emit('connection:executeGcode', { msg: '', res: null });
        } catch (e) {
            log.error(`execute gcode error: ${e}`);
        }
    };

    public goHome = async (hasHomingModel = false) => {
        log.info('onClick gohome');
        hasHomingModel && this.socket && this.socket.emit('move:status', { isHoming: true });
        await this.sacpClient.updateCoordinate(CoordinateType.MACHINE).then(res => {
            log.info(`Update Coordinate: ${res}`);
        });
        await this.sacpClient.requestHome().then(({ response }) => {
            log.info(`Go-Home, ${response}`);
            this.socket && this.socket.emit('serialport:read', { data: response.result === 0 ? 'OK' : 'WARNING' });
        });
    }

    public coordinateMove = async ({ moveOrders, jogSpeed, headType }) => {
        log.info(`coordinate: ${moveOrders}, ${headType}`);
        this.socket && this.socket.emit('move:status', { isMoving: true });
        const distances = [];
        const directions = [];
        moveOrders.forEach(item => {
            directions.push(COORDINATE_AXIS[item.axis]);
            distances.push(item.distance);
        });

        await this.sacpClient.requestAbsoluteCooridateMove(directions, distances, jogSpeed, CoordinateType.MACHINE).then(res => {
            log.info(`Coordinate Move: ${res.response.result}`);
            this.socket && this.socket.emit('serialport:read', { data: res.response.result === 0 ? 'OK' : 'WARNING' });
            this.socket && this.socket.emit('move:status', { isMoving: false });
        });
    }

    public setWorkOrigin = async ({ xPosition, yPosition, zPosition, bPosition }) => {
        log.info(`position: ${xPosition}, ${yPosition}, ${zPosition}, ${bPosition}`);
        const coordinateInfos = [new CoordinateInfo(Direction.X1, 0), new CoordinateInfo(Direction.Y1, 0), new CoordinateInfo(Direction.Z1, 0)];
        if (bPosition) {
            coordinateInfos.push(new CoordinateInfo(Direction.B1, 0));
        }
        await this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE).then(res => {
            log.info(`update CoordinateType, ${res}`);
        });
        await this.sacpClient.setWorkOrigin(coordinateInfos).then(res => {
            log.info(`Set Work Origin: ${res.data}`);
        });
    }

    public stopGcode = (options) => {
        this.sacpClient.stopPrint().then(res => {
            log.info(`Stop Print: ${res}`);
            const { eventName } = options;
            eventName && this.socket && this.socket.emit(eventName, {});
        });
    }

    public pauseGcode = (options) => {
        this.sacpClient.pausePrint().then(res => {
            log.info(`Pause Print: ${res}`);
            const { eventName } = options;
            eventName && this.socket && this.socket.emit(eventName, {});
        });
    }

    public resumeGcode = (options, callback) => {
        this.sacpClient.resumePrint().then(res => {
            log.info(`Resume Print: ${res}`);
            callback && callback({ msg: res.response.result, code: res.response.result })

        });
    }
}

export default SocketBASE;
