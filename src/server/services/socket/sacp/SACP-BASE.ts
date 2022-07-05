import { includes, find } from 'lodash';
import net from 'net';
import Business, { CoordinateType } from './Business';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, LEVEL_TWO_POWER_LASER_FOR_SM2, CNC_MODULE, LASER_MODULE, PRINTING_MODULE, HEAD_CNC, HEAD_LASER,
    COORDINATE_AXIS, WORKFLOW_STATUS_MAP, HEAD_PRINTING, EMERGENCY_STOP_BUTTON, ENCLOSURE_MODULES, AIR_PURIFIER_MODULES, ROTARY_MODULES, MODULEID_TOOLHEAD_MAP, A400_HEADT_BED_FOR_SM2, HEADT_BED_FOR_SM2, LEVEL_ONE_POWER_LASER_FOR_SM2, LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2, STANDARD_CNC_TOOLHEAD_FOR_SM2, RIGHT_EXTRUDER, LEFT_EXTRUDER, MODULEID_MAP } from '../../../../app/constants';
import { readString, readUint8 } from '../../../lib/SACP-SDK/SACP/helper';
import GetHotBed from '../../../lib/SACP-SDK/SACP/business/models/GetHotBed';
import CoordinateSystemInfo from '../../../lib/SACP-SDK/SACP/business/models/CoordinateSystemInfo';
import { EventOptions, MarlinStateData } from '../types';
import ExtruderInfo from '../../../lib/SACP-SDK/SACP/business/models/ExtruderInfo';
import CoordinateInfo, { Direction } from '../../../lib/SACP-SDK/SACP/business/models/CoordinateInfo';
import CncSpeedState from '../../../lib/SACP-SDK/SACP/business/models/CncSpeedState';
import { ResponseCallback } from '../../../lib/SACP-SDK/SACP/communication/Dispatcher';
import { SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2 } from '../../../constants';

const log = logger('lib:SocketBASE');

class SocketBASE {
    private heartbeatTimer;

    public socket: SocketServer;

    public sacpClient: Business;

    public moduleInfos: any = {};

    public currentWorkNozzle:number = 0


    public subscribeLogCallback: ResponseCallback;

    public subscribeHeartCallback: ResponseCallback;

    public subscribeNozzleCallback: ResponseCallback;

    public subscribeHotBedCallback: ResponseCallback;

    public subscribeCoordinateCallback: ResponseCallback;

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
                this.socket && this.socket.emit('connection:close');
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


                    const keys = Object.keys(MODULEID_MAP);
                    if (includes(keys, String(module.moduleId))) {
                        this.moduleInfos[MODULEID_MAP[module.moduleId]] = module;
                    }
                });
            });
            // stateData.status = WORKFLOW_STATUS_MAP[statusKey];


            // public async getWorkSpeed(options) {
            //     const { toolHead } = options;
            //     const headModule = this.moduleInfos && (this.moduleInfos[toolHead]); //
            //     if (!headModule) {
            //         log.error(`non-eixst toolhead[${toolHead}], moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            //         return;
            //     }
            //     return this.sacpClient.getWorkSpeed(headModule.key);
            //     // console.log(res);
            // }
            // console.log(stateData);
            // await this.getWorkSpeed({ toolHead: stateData.toolHead }).then(res => {
            //     console.log('get workspeed', res);
            //     log.debug(`get workspeed ${JSON.stringify(res)}`);
            // });

            this.socket && this.socket.emit('Marlin:state', { state: {
                ...stateData,
                status: WORKFLOW_STATUS_MAP[statusKey],
                headType: HEAD_PRINTING,
                moduleStatusList,
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
            const rightInfo = find(nozzleInfo.extruderList, { index: 1 }) || {};

            this.currentWorkNozzle = rightInfo.status === 1 ? 1 : 0;
            stateData = {
                ...stateData,
                currentWorkNozzle: rightInfo.status === 1 ? RIGHT_EXTRUDER : LEFT_EXTRUDER,
                nozzleStatus: leftInfo.status,
                nozzleRightStatus: rightInfo.status,

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
        this.sacpClient.subscribeCncSpeedState({ interval: 1000 }, (data) => {
            // log.info(`revice coordinate: ${data.response}`);
            const response = data.response;
            const cncSpeedState = new CncSpeedState().fromBuffer(response.data);
            // console.log('cncSpeedState', cncSpeedState);
            stateData = {
                ...stateData,
                cncCurrentSpindleSpeed: cncSpeedState.currentSpeed,
                cncTargetSpindleSpeed: cncSpeedState.targetSpeed
            };
        }).then(res => {
            log.info(`subscribe coordination success: ${res}`);
        });
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
        log.info(`coordinate: ${JSON.stringify(moveOrders)}, ${headType}`);
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
            // console.log(res);
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
            callback && callback({ msg: res.response.result, code: res.response.result });
        });
    }

    public async switchExtruder(extruderIndex) {
        const toolhead = this.moduleInfos && this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2];
        if (!toolhead) {
            log.error(`no match toolhead 3dp, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        await this.goHome();
        const key = toolhead && toolhead.key;
        const response = await this.sacpClient.SwitchExtruder(key, extruderIndex);
        log.info(`SwitchExtruder to extruderIndex:${extruderIndex}, ${JSON.stringify(response)}`);
    }

    public updateNozzleTemperature = (extruderIndex, temperature) => {
        const toolhead = this.moduleInfos && (this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2] || this.moduleInfos[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]);
        if (!toolhead) {
            log.error(`no match toolhead 3dp:[${toolhead}], moduleInfos:${this.moduleInfos}`,);
            return;
        }
        const key = toolhead && toolhead.key;
        this.sacpClient.SetExtruderTemperature(key, extruderIndex, temperature).then(({ response }) => {
            log.info(`SetExtruderTemperature,key:[${key}], extruderIndex:[${extruderIndex}], temperature:[${temperature}] ${JSON.stringify(response)}`);
        });
    }

    public async loadFilament(extruderIndex) {
        const toolHead = this.moduleInfos && (this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2] || this.moduleInfos[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]);// || this.moduleInfos[HEADT_BED_FOR_SM2]); //
        if (!toolHead) {
            log.error(`non-eixst toolHead, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        // (this.currentWorkNozzle !== extruderIndex) && await this.goHome();
        const _ = await this.sacpClient.SwitchExtruder(toolHead.key, extruderIndex);
        log.info(`loadFilament SwitchExtruder:[${extruderIndex}], ${JSON.stringify(_)}`);
        const response = await this.sacpClient.ExtruderMovement(toolHead.key, 0, 60, 200, 0, 0);
        log.info(`loadFilament, ${JSON.stringify(response)}`);
    }

    public async unloadFilament(extruderIndex) {
        const toolHead = this.moduleInfos && (this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2] || this.moduleInfos[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]);
        if (!toolHead) {
            log.error(`non-eixst toolHead, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        // await this.goHome();
        const _ = await this.sacpClient.SwitchExtruder(toolHead.key, extruderIndex);
        log.info(`unloadFilament SwitchExtruder:[${extruderIndex}], ${JSON.stringify(_)}`);
        const response = await this.sacpClient.ExtruderMovement(toolHead.key, 0, 6, 200, 60, 150);
        log.info(`unloadFilament, ${JSON.stringify(response)}`);
    }


    public updateBedTemperature = (zoneIndex, temperature) => {
        const heatBed = this.moduleInfos && (this.moduleInfos[A400_HEADT_BED_FOR_SM2] || this.moduleInfos[HEADT_BED_FOR_SM2]); //
        if (!heatBed) {
            log.error(`non-eixst heatBed, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        this.sacpClient.setHotBedTemperature(heatBed.key, zoneIndex, temperature).then(({ response }) => {
            log.info(`updateBedTemperature, ${JSON.stringify(response)}`);
        });
    }

    public async updateNozzleOffset(extruderIndex, direction, distance) {
        const toolHead = this.moduleInfos && (this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2] || this.moduleInfos[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]);// || this.moduleInfos[HEADT_BED_FOR_SM2]); //
        if (!toolHead) {
            log.error(`non-eixst toolHead 3dp, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        log.info(`SetExtruderOffset key:${toolHead.key} extruderIndex: ${extruderIndex}, direction: ${direction}, distance:${distance}`);
        const response = await this.sacpClient.SetExtruderOffset(toolHead.key, extruderIndex, direction, distance);
        log.info(`SetExtruderOffset, ${JSON.stringify(response)}`);
    }

    // workspeed
    public async updateWorkSpeed(toolhead, workSpeed, extruderIndex = 0) {
        const headModule = this.moduleInfos && (this.moduleInfos[toolhead]); //
        if (!headModule) {
            log.error(`non-eixst toolhead[${toolhead}], moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            return;
        }

        log.info(`updateWorkSpeed headModule.key: ${headModule.key}, extruderIndex: ${extruderIndex}, workSpeed: ${workSpeed}}`);
        const leftResponse = await this.sacpClient.setWorkSpeed(headModule.key, extruderIndex, workSpeed);
        log.info(`updateWorkSpeed leftResponse, ${JSON.stringify(leftResponse)}`);


        if (toolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            const rightResponse = await this.sacpClient.setWorkSpeed(headModule.key, 1, workSpeed);
            log.info(`updateWorkSpeed rightResponse, ${JSON.stringify(rightResponse)}`);
        }
    }


    public updateLaserPower = (value) => {
        console.log('set laser power', value);
        const laserLevelTwoHead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_POWER_LASER_FOR_SM2] || this.moduleInfos[LEVEL_ONE_POWER_LASER_FOR_SM2]); //
        if (!laserLevelTwoHead) {
            log.error(`non-eixst laserLevelHead, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        this.sacpClient.SetLaserPower(laserLevelTwoHead.key, value).then(({ response }) => {
            log.info(`updateLaserPower, ${JSON.stringify(response)}`);
        });
    }

    public switchCNC = async function (headStatus) {
        const toolhead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2] || this.moduleInfos[STANDARD_CNC_TOOLHEAD_FOR_SM2]);
        if (!toolhead) {
            log.error(`no match ${LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2} or ${STANDARD_CNC_TOOLHEAD_FOR_SM2}:1 , moduleInfos:${this.moduleInfos}`,);
            return;
        }

        // return
        const { response } = await this.sacpClient.switchCNC(toolhead.key, !headStatus);
        log.info(`switchCNC to [${!headStatus}], ${JSON.stringify(response)}`);
        // return response;
    }

    public updateToolHeadSpeed = (speed) => {
        const toolhead = this.moduleInfos && this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2];
        if (!toolhead) {
            log.error(`no match ${LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2}, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        this.sacpClient.setToolHeadSpeed(toolhead.key, speed).then(({ response }) => {
            log.info(`updateToolHeadSpeed Speed:[${speed}], ${JSON.stringify(response)}`);
        });
    }

    public setCncPower = (targetPower) => {
        const toolhead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2] || this.moduleInfos[STANDARD_CNC_TOOLHEAD_FOR_SM2]);
        if (!toolhead) {
            log.error(`no match cnc tool head, moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            return;
        }

        this.sacpClient.setCncPower(toolhead.key, targetPower).then(({ response }) => {
            log.info(`setCncPower setCncPower:[${targetPower}]%, ${JSON.stringify(response)}`);
        });
    }

    public async setAbsoluteWorkOrigin({ x, y, z }) {
        try {
            const res1 = await this.sacpClient.updateCoordinate(CoordinateType.MACHINE);
            log.debug(`updateCoordinate CoordinateType.MACHINE res: ${JSON.stringify(res1)}`);
            await this.sacpClient.getCurrentCoordinateInfo().then(async ({ coordinateSystemInfo }) => {
                const xNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.X1).value;
                const yNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Y1).value;
                const zNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Z1).value;
                log.debug(`current positions, ${xNow}, ${yNow}, ${zNow}`);

                await this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE);
                const newX = new CoordinateInfo(Direction.X1, xNow - x);
                const newY = new CoordinateInfo(Direction.Y1, yNow - y);
                const newZ = new CoordinateInfo(Direction.Z1, zNow - z);
                const newCoord = [newX, newY, newZ];
                log.debug(`new positions, ${JSON.stringify(newCoord)}`);

                const res = await this.sacpClient.setWorkOrigin(newCoord);
                log.debug(`setAbsoluteWorkOrigin res:${JSON.stringify(res)}`);
            });
        } catch (e) {
            log.error(`getLaserMaterialThickness error: ${e}`);
        }
    }

    //
    public async laserSetWorkHeight(options) {
        const { toolHead, materialThickness } = options;
        const headModule = this.moduleInfos && (this.moduleInfos[toolHead]); //
        if (!headModule) {
            log.error(`non-eixst toolhead[${toolHead}], moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            return;
        }
        const { laserToolHeadInfo } = await this.sacpClient.getLaserToolHeadInfo(headModule.key);
        log.debug(`laserFocalLength:${laserToolHeadInfo.laserFocalLength}, materialThickness: ${materialThickness}, platformHeight:${laserToolHeadInfo.platformHeight}`);
        await this.setAbsoluteWorkOrigin({ x: 0, y: 0, z: laserToolHeadInfo.laserFocalLength + laserToolHeadInfo.platformHeight + materialThickness });
    }
}

export default SocketBASE;
