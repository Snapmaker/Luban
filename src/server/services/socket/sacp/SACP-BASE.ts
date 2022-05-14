import { includes, find } from 'lodash';
import Business from '../../../lib/SACP-SDK/SACP/business/Business';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import { WORKFLOW_STATUS_MAP, EMERGENCY_STOP_BUTTON, ENCLOSURE_MODULES, AIR_PURIFIER_MODULES, ROTARY_MODULES } from '../../../../app/constants';
import { readUint8 } from '../../../lib/SACP-SDK/SACP/helper';
import GetHotBed from '../../../lib/SACP-SDK/SACP/business/models/GetHotBed';
import CoordinateSystemInfo from '../../../lib/SACP-SDK/SACP/business/models/CoordinateSystemInfo';
import { MarlinStateData } from '../types';
import { HEAD_PRINTING } from '../../../constants';
import ExtruderInfo from '../../../lib/SACP-SDK/SACP/business/models/ExtruderInfo';

const log = logger('lib:SocketBASE');

class SocketBASE {
    private heartbeatTimer;

    socket: SocketServer;

    sacpClient: Business;

    public startHeartbeatBase = (sacpClient: Business) => {
        this.sacpClient = sacpClient;
        let statusKey = 0;
        // this.socket = socket;
        const moduleStatusList = {
            rotaryModule: false,
            airPurifier: false,
            emergencyStopButton: false,
            enclosure: false
        };
        let stateData: MarlinStateData;
        // get position
        this.sacpClient.subscribeCurrentCoordinateInfo({ interval: 2000 }, (data) => {
            console.log('subscribePosition');
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
            console.log('subScribePosition', pos, originOffset);
        });
        // get hot bed temperature
        this.sacpClient.subscribeHotBedTemperature({ interval: 2000 }, (data) => {
            console.log('subscribeHotBed', data);
            const hotBedInfo = new GetHotBed().fromBuffer(data.response.data);
            console.log({ hotBedInfo });
            stateData = {
                ...stateData,
                heatedBedTargetTemperature: hotBedInfo?.zoneList[0]?.targetTemzperature || 0,
                heatedBedTemperature: hotBedInfo?.zoneList[0]?.currentTemperature || 0
            };
        });
        // get nozzle temperature
        this.sacpClient.subscribeNozzleInfo({ interval: 2000 }, ({ response }) => {
            const nozzleInfo = new ExtruderInfo().fromBuffer(response.data);
            const leftInfo = find(nozzleInfo.extruderList, { index: 0 });
            const rightInfo = find(nozzleInfo.extruderList, { index: 1 });
            stateData = {
                ...stateData,
                nozzleTemperature: leftInfo.currentTemperature,
                nozzleTargetTemperature: leftInfo.targetTemperature,
                nozzleRightTargetTemperature: rightInfo?.targetTemperature || 0,
                nozzleRightTemperature: rightInfo?.currentTemperature || 0
            };
        });
        // get workflow status, moduleInfo, emergency button status
        this.sacpClient.subscribeHeartbeat({ interval: 2000 }, async (data) => {
            log.info(`receive heartbeat: ${data.response}`);
            statusKey = readUint8(data.response.data, 0);
            stateData = {
                ...stateData,
                status: WORKFLOW_STATUS_MAP[statusKey]
            };
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
            await this.sacpClient.getEmergencyStopInfo().then(() => {
                // console.log('emergencyStatus', emergencyStatus);
            });
            clearTimeout(this.heartbeatTimer);
            // this.heartbeatTimer = setTimeout(() => {
            //     log.info('TCP connection closed');
            //     this.socket && this.socket.emit('connection:close');
            // }, 2000); // TODO: should change this after file transfer ready
            this.socket && this.socket.emit('Marlin:state', { state: {
                ...stateData,
                moduleStatusList,
                headType: HEAD_PRINTING
            } });
        }).then((res) => {
            log.info(`subscribe heartbeat success: ${res}`);
        });
    };
}

export default SocketBASE;
