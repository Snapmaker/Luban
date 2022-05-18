import { includes, find } from 'lodash';
import Business, { CoordinateType } from '../../../lib/SACP-SDK/SACP/business/Business';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import { COORDINATE_AXIS, WORKFLOW_STATUS_MAP, HEAD_PRINTING, EMERGENCY_STOP_BUTTON, ENCLOSURE_MODULES, AIR_PURIFIER_MODULES, ROTARY_MODULES } from '../../../../app/constants';
import { readUint8 } from '../../../lib/SACP-SDK/SACP/helper';
import GetHotBed from '../../../lib/SACP-SDK/SACP/business/models/GetHotBed';
import CoordinateSystemInfo from '../../../lib/SACP-SDK/SACP/business/models/CoordinateSystemInfo';
import { EventOptions, MarlinStateData } from '../types';
import ExtruderInfo from '../../../lib/SACP-SDK/SACP/business/models/ExtruderInfo';
import CoordinateInfo, { Direction } from '../../../lib/SACP-SDK/SACP/business/models/CoordinateInfo';

const log = logger('lib:SocketBASE');

class SocketBASE {
    // private heartbeatTimer;

    socket: SocketServer;

    sacpClient: Business;

    public startHeartbeatBase = (sacpClient: Business) => {
        this.sacpClient = sacpClient;
        let stateData: MarlinStateData;
        let statusKey = 0;
        const moduleStatusList = {
            rotaryModule: false,
            airPurifier: false,
            emergencyStopButton: false,
            enclosure: false
        };
        this.sacpClient.subscribeHeartbeat({ interval: 1000 }, async (data) => {
            // log.info(`receive heartbeat: ${data.response}`);
            statusKey = readUint8(data.response.data, 0);
            await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
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
                        // new to update airPurifier status
                    }
                });
            });
            // stateData.status = WORKFLOW_STATUS_MAP[statusKey];
            this.socket && this.socket.emit('Marlin:state', { state: {
                ...stateData,
                status: WORKFLOW_STATUS_MAP[statusKey],
                headType: HEAD_PRINTING,
                moduleStatusList,
            } });
            // clearTimeout(this.heartbeatTimer);
            // this.heartbeatTimer = setTimeout(() => {
            //     log.info('TCP connection closed');
            //     this.socket && this.socket.emit('connection:close');
            // }, 60000); // TODO: should change this after file transfer ready
        }).then((res) => {
            log.info(`subscribe heartbeat success: ${res}`);
        });
        this.sacpClient.subscribeHotBedTemperature({ interval: 1000 }, (data) => {
            // log.info(`revice hotbed: ${data.response}`);
            const hotBedInfo = new GetHotBed().fromBuffer(data.response.data);
            stateData = {
                ...stateData,
                heatedBedTargetTemperature: hotBedInfo?.zoneList[0]?.targetTemzperature || 0,
                heatedBedTemperature: hotBedInfo?.zoneList[0]?.currentTemperature || 0
            };
        }).then(res => {
            log.info(`subscribe hotbed success: ${res}`);
        });
        this.sacpClient.subscribeNozzleInfo({ interval: 1000 }, (data) => {
            // log.info(`revice nozzle: ${data.response}`);
            const nozzleInfo = new ExtruderInfo().fromBuffer(data.response.data);
            const leftInfo = find(nozzleInfo.extruderList, { index: 0 });
            const rightInfo = find(nozzleInfo.extruderList, { index: 1 });
            stateData = {
                ...stateData,
                nozzleTemperature: leftInfo.currentTemperature,
                nozzleTargetTemperature: leftInfo.targetTemperature,
                nozzleRightTargetTemperature: rightInfo?.targetTemperature || 0,
                nozzleRightTemperature: rightInfo?.currentTemperature || 0
            };
        }).then(res => {
            log.info(`subscribe nozzle success: ${res}`);
        });
        this.sacpClient.subscribeCurrentCoordinateInfo({ interval: 1000 }, (data) => {
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
            stateData = {
                ...stateData,
                pos,
                originOffset
            };
            // console.log('originOffset', originOffset, pos);
        }).then(res => {
            log.info(`subscribe coordination success: ${res}`);
        });
    };

    public executeGcode = async (options: EventOptions, callback: () => void) => {
        log.info('run executeGcode');
        const { gcode } = options;
        const gcodeLines = gcode.split('\n');
        // callback && callback();
        log.debug(`executeGcode, ${gcodeLines}`);
        this.sacpClient.executeGcode(gcode).then(res => {
            log.info(`execute gcode: ${res}`);
        });
        try {
            callback && callback();
            this.socket && this.socket.emit('connection:executeGcode', { msg: '', res: null });
        } catch (e) {
            log.error(`execute gcode error: ${e}`);
        }
    };

    public goHome = async () => {
        log.info('onClick gohome');
        await this.sacpClient.updateCoordinate(CoordinateType.MACHINE).then(res => {
            log.info(`Update Coordinate: ${res}`);
        });
        await this.sacpClient.requestHome().then(({ response }) => {
            log.info(`Go-Home, ${response}`);
        });
    }

    public coordinateMove = async ({ moveOrders, jogSpeed, headType }) => {
        log.info(`coordinate: ${moveOrders}, ${headType}`);
        const distances = [];
        const directions = [];
        moveOrders.forEach(item => {
            directions.push(COORDINATE_AXIS[item.axis]);
            distances.push(item.distance);
        });
        // await this.sacpClient.updateCoordinate(headType === HEAD_PRINTING ? CoordinateType.MACHINE : CoordinateType.WORKSPACE).then(res => {
        //     log.info(`Update CoordinateType: ${res}`);
        // });
        await this.sacpClient.requestAbsoluteCooridateMove(directions, distances, jogSpeed, CoordinateType.MACHINE).then(res => {
            log.info(`Coordinate Move: ${res}`);
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
            // console.log(res);
        });
    }

    public stopPrint = () => {
        this.sacpClient.stopPrint().then(res => {
            log.info(`Stop Print: ${res}`);
        });
    }

    public pauseGcode = () => {
        this.sacpClient.pausePrint().then(res => {
            log.info(`Pause Print: ${res}`);
        });
    }

    public resumeGcode = () => {
        this.sacpClient.resumePrint().then(res => {
            log.info(`Resume Print: ${res}`);
        });
    }
}

export default SocketBASE;
