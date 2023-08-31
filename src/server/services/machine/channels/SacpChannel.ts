import { WorkflowStatus } from '@snapmaker/luban-platform';
import { ResponseCallback } from '@snapmaker/snapmaker-sacp-sdk';
import { PeerId } from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Header';
import { readString, readUint16, readUint32, readUint8 } from '@snapmaker/snapmaker-sacp-sdk/dist/helper';
import {
    AirPurifierInfo,
    CncSpeedState,
    CoordinateInfo,
    CoordinateSystemInfo,
    EnclosureInfo,
    ExtruderInfo,
    GcodeCurrentLine,
    GetHotBed,
    LaserTubeState,
    MachineInfo,
    ModuleInfo,
    NetworkConfiguration,
    NetworkOptions,
    NetworkStationState,
} from '@snapmaker/snapmaker-sacp-sdk/dist/models';
import { Direction } from '@snapmaker/snapmaker-sacp-sdk/dist/models/CoordinateInfo';
import { find, includes } from 'lodash';
import net from 'net';

import {
    A400_HEADT_BED_FOR_SM2,
    COORDINATE_AXIS,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    HEADT_BED_FOR_SM2,
    LOAD_FIMAMENT,
    UNLOAD_FILAMENT,
    WORKFLOW_STATUS_MAP
} from '../../../../app/constants';
import {
    AIR_PURIFIER,
    AIR_PURIFIER_MODULE_IDS,
    CNC_HEAD_MODULE_IDS,
    DUAL_EXTRUDER_TOOLHEAD_FOR_SM2,
    EMERGENCY_STOP_BUTTON,
    ENCLOSURE_FOR_ARTISAN,
    ENCLOSURE_FOR_SM2,
    ENCLOSURE_MODULE_IDS,
    isDualExtruder,
    LASER_HEAD_MODULE_IDS,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    MODULEID_MAP,
    MODULEID_TOOLHEAD_MAP,
    PRINTING_HEAD_MODULE_IDS,
    ROTARY_MODULE_IDS,
    SNAPMAKER_J1_HEATED_BED,
    STANDARD_CNC_TOOLHEAD_FOR_SM2,
} from '../../../../app/constants/machines';
import {
    COMPLUTE_STATUS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
} from '../../../constants';
import logger from '../../../lib/logger';
import SacpClient, { CoordinateType } from '../sacp/SacpClient';
import { MarlinStateData } from '../types';
import Channel, {
    CncChannelInterface,
    EnclosureChannelInterface,
    GcodeChannelInterface,
    LaserChannelInterface,
    NetworkServiceChannelInterface,
    PrintJobChannelInterface,
    SystemChannelInterface,
    UpgradeFirmwareOptions,
    AirPurifierChannelInterface,
    FileChannelInterface,
    UploadFileOptions
} from './Channel';

const log = logger('machine:channels:SacpChannel');

class SacpChannelBase extends Channel implements
    GcodeChannelInterface,
    SystemChannelInterface,
    FileChannelInterface,
    NetworkServiceChannelInterface,
    PrintJobChannelInterface,
    LaserChannelInterface,
    CncChannelInterface,
    EnclosureChannelInterface,
    AirPurifierChannelInterface {
    private heartbeatTimer;

    public sacpClient: SacpClient;

    public subscribeLogCallback: ResponseCallback;

    public subscribeHeartCallback: ResponseCallback;

    public subscribeNozzleCallback: ResponseCallback;

    public subscribeHotBedCallback: ResponseCallback;

    public subscribeCoordinateCallback: ResponseCallback;

    public subscribeCncSpeedStateCallback: ResponseCallback;

    public subscribeLaserPowerCallback: ResponseCallback;

    public subscribeGetCurrentGcodeLineCallback: ResponseCallback;

    public subscribeEnclosureInfoCallback: ResponseCallback;

    public subscribePurifierInfoCallback: ResponseCallback;

    private filamentAction = false;

    private filamentActionType = 'load';

    private filamentActionModule = null;

    private moduleInfos: { [key: string]: ModuleInfo | ModuleInfo[] } = {};

    public currentWorkNozzle: number;

    private resumeGcodeCallback: ({ msg, code }) => void = null;

    public readyToWork = false;

    public headType: string = HEAD_PRINTING;

    public cncTargetSpeed: number;

    // gcode total lines
    public filename: string = '';
    public totalLine: number | null = null;
    public estimatedTime: number | null = null;
    public startTime: number;
    public machineStatus: string = WorkflowStatus.Idle;

    public setFilePeerId(peerId: PeerId): void {
        if (this.sacpClient) {
            this.sacpClient.setFilePeerId(peerId);
        }
    }

    /**
     * Get laser module info.
     */
    private getLaserToolHeadModule(): ModuleInfo | null {
        for (const key of Object.keys(this.moduleInfos)) {
            const module = this.moduleInfos[key];
            if (module && module instanceof ModuleInfo) {
                if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                    return module;
                }
            }
        }

        return null;
    }

    private getEnclosureModule(): ModuleInfo | null {
        for (const key of Object.keys(this.moduleInfos)) {
            const module = this.moduleInfos[key];
            if (module && module instanceof ModuleInfo) {
                if (includes(ENCLOSURE_MODULE_IDS, module.moduleId)) {
                    return module;
                }
            }
        }

        return null;
    }

    private getAirPurifierModule(): ModuleInfo | null {
        for (const key of Object.keys(this.moduleInfos)) {
            const module = this.moduleInfos[key];
            if (module && module instanceof ModuleInfo) {
                if (includes(AIR_PURIFIER_MODULE_IDS, module.moduleId)) {
                    return module;
                }
            }
        }

        return null;
    }

    // interface: GcodeChannelInterface

    /**
     * Generic execute G-code commands.
     */
    public async executeGcode(gcode: string): Promise<boolean> {
        const gcodeLines = gcode.split('\n');

        const promises = [];
        gcodeLines.forEach(_gcode => {
            promises.push(this.sacpClient.executeGcode(_gcode));
        });

        const results = await Promise.all(promises);

        // if any gcode line fails, then fails
        for (const res of results) {
            if (res.response.result !== 0) {
                return false;
            }
        }

        return true;
    }

    // interface: SystemChannelInterface

    /**
     * Get Machine info.
     */
    public async getMachineInfo(): Promise<MachineInfo> {
        const { data: machineInfo } = await this.sacpClient.getMachineInfo();

        return machineInfo;
    }

    /**
     * Export Log in machine to external storage.
     */
    public async exportLogToExternalStorage(): Promise<boolean> {
        return this.sacpClient.exportLogToExternalStorage();
    }

    public async getFirmwareVersion(): Promise<string> {
        const machineInfo = await this.getMachineInfo();

        const version = machineInfo.masterControlFirmwareVersion;
        log.info(`Get firmware version: ${version}`);

        return version;
    }

    public async upgradeFirmwareFromFile(options: UpgradeFirmwareOptions): Promise<boolean> {
        log.info(`Upgrading firmware from file: ${options.filename}`);
        const filename = options.filename;

        const res = await this.sacpClient.upgradeFirmwareFromFile(filename);
        log.info(`Upgrade firmware result = ${res.response.result}`);

        return res.response.result === 0;
    }

    // interface: FileChannelInterface

    public async uploadFile(options: UploadFileOptions): Promise<boolean> {
        const { filePath, targetFilename } = options;
        log.info(`Upload file to controller... ${filePath}`);

        return this.sacpClient.uploadFile(filePath, targetFilename);
    }

    public async compressUploadFile(options: UploadFileOptions): Promise<boolean> {
        const { filePath, targetFilename, onProgress } = options;
        log.info(`Compress and upload file to controller... ${filePath}`);

        return this.sacpClient.uploadFileCompressed(
            filePath,
            targetFilename,
            onProgress
        );
    }

    // interface: LaserChannelInterface

    public async getCrosshairOffset(): Promise<{ x: number; y: number }> {
        const module = this.getLaserToolHeadModule();
        if (!module) {
            return null;
        }

        const offset = await this.sacpClient.getCrosshairOffset(module.key);

        log.info(`Get crosshair offset: (${offset.x}, ${offset.y})`);
        return offset;
    }

    public async setCrosshairOffset(x: number, y: number): Promise<boolean> {
        const module = this.getLaserToolHeadModule();
        if (!module) {
            return false;
        }

        const success = await this.sacpClient.setCrosshairOffset(module.key, x, y);
        log.info(`Set crosshair offset: (${x}, ${y}), ${success ? 'success' : 'failed'}`);
        return success;
    }

    public async getFireSensorSensitivity(): Promise<number> {
        const module = this.getLaserToolHeadModule();
        if (!module) {
            return -1;
        }

        const sensitivity = await this.sacpClient.getFireSensorSensitivity(module.key);

        log.info(`Get fire sensor sensitivity: ${sensitivity}`);
        return sensitivity;
    }

    public async setFireSensorSensitivity(sensitivity: number): Promise<boolean> {
        const module = this.getLaserToolHeadModule();
        if (!module) {
            return false;
        }

        const success = await this.sacpClient.setFireSensorSensitivity(module.key, sensitivity);
        log.info(`Set fire sensor sensitivity: ${sensitivity}, ${success ? 'success' : 'failed'}`);
        return success;
    }

    // interface: CncChannelInterface

    public async setSpindleSpeed(speed: number): Promise<boolean> {
        // Only supports level 2 CNC module
        const toolhead = this.moduleInfos && this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2];
        if (!toolhead) {
            log.error(`no match ${LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2}, moduleInfos:${this.moduleInfos}`,);
            return false;
        }

        log.info(`Set spindle speed: ${speed} RPM`);
        const { response } = await this.sacpClient.setToolHeadSpeed(toolhead.key, speed);
        return response.result === 0;
    }

    public async setSpindleSpeedPercentage(percent: number): Promise<boolean> {
        const toolhead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2] || this.moduleInfos[STANDARD_CNC_TOOLHEAD_FOR_SM2]);
        if (!toolhead) {
            log.error(`no match cnc tool head, moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            return false;
        }

        log.info(`Set spindle speed: ${percent}%`);

        const { response } = await this.sacpClient.setCncPower(toolhead.key, percent);
        return response.result === 0;
    }

    public async spindleOn(): Promise<boolean> {
        const toolhead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2] || this.moduleInfos[STANDARD_CNC_TOOLHEAD_FOR_SM2]);
        if (!toolhead) {
            log.error('No matched CNC module');
            return false;
        }

        const { response } = await this.sacpClient.switchCNC(toolhead.key, true);
        return response.result === 0;
    }

    public async spindleOff(): Promise<boolean> {
        const toolhead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_CNC_TOOLHEAD_FOR_SM2] || this.moduleInfos[STANDARD_CNC_TOOLHEAD_FOR_SM2]);
        if (!toolhead) {
            log.error('No matched CNC module');
            return false;
        }

        const { response } = await this.sacpClient.switchCNC(toolhead.key, false);
        return response.result === 0;
    }

    // interface: EnclosureChannelInterface

    public async getEnclosreInfo(): Promise<EnclosureInfo | null> {
        const module = this.getEnclosureModule();
        if (!module) {
            return null;
        }

        const { response, data: enclosureInfo } = await this.sacpClient.getEnclousreInfo(module.key);

        if (response.result === 0) {
            return enclosureInfo;
        } else {
            return null;
        }
    }

    public async setEnclosureLight(intensity: number): Promise<boolean> {
        const module = this.getEnclosureModule();
        if (!module) {
            return false;
        }

        const { response } = await this.sacpClient.setEnclosureLight(module.key, intensity);

        log.info(`Set enclosure light to ${intensity}, result = ${response.result}`);

        return response.result === 0;
    }

    public async setEnclosureFan(strength: number): Promise<boolean> {
        const module = this.getEnclosureModule();
        if (!module) {
            return false;
        }

        const { response } = await this.sacpClient.setEnclosureFan(module.key, strength);

        log.info(`Set enclosure fan to ${strength}, result = ${response.result}`);

        return response.result === 0;
    }

    public async setDoorDetection(options) {
        const moduleInfo = this.moduleInfos && (this.moduleInfos[ENCLOSURE_FOR_ARTISAN] || this.moduleInfos[ENCLOSURE_FOR_SM2]);
        let headTypeKey = 0;
        switch (this.headType) {
            case HEAD_PRINTING:
                headTypeKey = 0;
                break;
            case HEAD_LASER:
                headTypeKey = 1;
                break;
            case HEAD_CNC:
                headTypeKey = 2;
                break;
            default:
                break;
        }
        this.sacpClient.setEnclosureDoorEnabled(moduleInfo.key, options.enable ? 1 : 0, headTypeKey).then(({ response }) => {
            log.info(`Update enclosure door enabled: ${response.result}`);
        });
    }

    // interface: AirPurifierChannelInterface

    public async getAirPurifierInfo(): Promise<AirPurifierInfo> {
        const module = this.getAirPurifierModule();
        if (!module) {
            return null;
        }

        const { response, data: airPurifierInfo } = await this.sacpClient.getAirPurifierInfo(module.key);

        if (response.result === 0) {
            return airPurifierInfo;
        } else {
            return null;
        }
    }

    public async turnOnAirPurifier(): Promise<boolean> {
        const module = this.getAirPurifierModule();
        if (!module) {
            return false;
        }
        const { response } = await this.sacpClient.setPurifierSwitch(module.key, true);

        return response.result === 0;
    }

    public async turnOffAirPurifier(): Promise<boolean> {
        const module = this.getAirPurifierModule();
        if (!module) {
            return false;
        }
        const { response } = await this.sacpClient.setPurifierSwitch(module.key, false);

        return response.result === 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async setAirPurifierStrength(strength: 1 | 2 | 3): Promise<boolean> {
        const module = this.getAirPurifierModule();
        if (!module) {
            return false;
        }

        const { response } = await this.sacpClient.setPurifierSpeed(module.key, strength);
        return response.result === 0;
    }

    public async setFilterWorkSpeed(options) {
        const moduleInfo = this.moduleInfos && this.moduleInfos[AIR_PURIFIER];
        this.sacpClient.setPurifierSpeed(moduleInfo.key, options.value).then(({ response }) => {
            log.info(`Update Purifier speed, ${response.result}, ${options.value}`);
        });
    }

    // interface: PrintJobChannelInterface

    private async getPrintJobFileInfo(): Promise<void> {
        const { data } = await this.sacpClient.getPrintingFileInfo();

        if (!data.totalLine) {
            return;
        }

        this.filename = data.filename;
        this.totalLine = data.totalLine;
        this.estimatedTime = data.estimatedTime;
    }

    public async subscribeGetPrintCurrentLineNumber(): Promise<boolean> {
        // Subscribe to line number
        const callback: ResponseCallback = ({ response }) => {
            if (!this.totalLine && includes([WorkflowStatus.Running, WorkflowStatus.Paused], this.machineStatus)) {
                this.getPrintJobFileInfo();
            }

            // line number
            const currentLineNumberInfo = new GcodeCurrentLine().fromBuffer(response.data);

            const currentLine = currentLineNumberInfo.currentLine;

            let progress;
            if (this.totalLine === 0) {
                progress = 0;
            } else if (currentLine >= this.totalLine) {
                progress = 1;
            } else {
                progress = Math.round((currentLine / this.totalLine) * 100) / 100;
            }

            const sliceTime = new Date().getTime() - this.startTime;

            const remainingTime = (1 - (progress)) * progress * (this.estimatedTime * 1000) / progress + (1 - progress) * (1 - progress) * sliceTime;

            const data = {
                filename: this.filename,
                sent: currentLine,
                total: this.totalLine,
                progress: progress,
                // printStatus: progress === 1 ? COMPLUTE_STATUS : '',
                estimatedTime: this.estimatedTime * 1000,
                elapsedTime: sliceTime,
                remainingTime: remainingTime,
            };

            if (includes([WorkflowStatus.Running, WorkflowStatus.Paused], this.machineStatus)) {
                this.socket && this.socket.emit('sender:status', ({ data }));
            }
        };

        const res = await this.sacpClient.subscribeGetPrintCurrentLineNumber(
            { interval: 2000 },
            callback
        );

        // Subscribe to print time
        const callback2: ResponseCallback = ({ response }) => {
            const sliceTime = readUint32(response.data);
            this.startTime = new Date().getTime() - sliceTime * 1000;
        };

        const res2 = await this.sacpClient.subscribeGetPrintingTime({ interval: 5000 }, callback2);

        return res.code === 0 && res2.code === 0;
    }

    public async unsubscribeGetPrintCurrentLineNumber(): Promise<boolean> {
        const res = await this.sacpClient.unSubscribeGetPrintCurrentLineNumber(null);
        return res.code === 0;
    }



    // old heartbeat base, refactor needed
    public startHeartbeatBase = async (sacpClient: SacpClient, client?: net.Socket) => {
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
                    if (result === null) {
                        log.warn('subscribed log is null');
                    }
                    // this.socket && this.socket.emit('serialport:read', { data: result });
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

        this.sacpClient.setHandler(0x04, 0x00, ({ param }) => {
            const level = readUint8(param, 0);
            const owner = readUint16(param, 1);
            const error = readUint8(param, 3);
            this.socket && this.socket.emit('manager:error', { level, owner, errorCode: error });
        });

        this.subscribeHeartCallback = async (data) => {
            statusKey = readUint8(data.response.data, 0);

            if (this.heartbeatTimer) {
                clearTimeout(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }

            this.heartbeatTimer = setTimeout(() => {
                client && client.destroy();
                log.info('TCP close');
                this.socket && this.socket.emit('connection:close');
            }, 10000);

            this.machineStatus = WORKFLOW_STATUS_MAP[statusKey];

            // TODO: Refactor this
            this.socket && this.socket.emit('Marlin:state', {
                state: {
                    ...stateData,
                    moduleStatusList,
                    status: this.machineStatus,
                    moduleList: moduleStatusList,
                }
            });
        };

        // Subscribe heart beat
        this.sacpClient.subscribeHeartbeat({ interval: 1000 }, this.subscribeHeartCallback).then((res) => {
            log.info(`subscribe heartbeat success: ${res.code}`);
        });

        // Get module infos
        await this.sacpClient.getModuleInfo().then(({ data: moduleInfos }) => {
            // log.info(`revice moduleInfo: ${data.response}`);
            stateData.airPurifier = false;

            const toolHeadModules = [];
            this.moduleInfos = {};

            moduleInfos.forEach(module => {
                if (includes(EMERGENCY_STOP_BUTTON, module.moduleId)) {
                    moduleStatusList.emergencyStopButton = true;
                }
                if (includes(ENCLOSURE_MODULE_IDS, module.moduleId)) {
                    moduleStatusList.enclosure = true;
                }
                if (includes(ROTARY_MODULE_IDS, module.moduleId)) {
                    moduleStatusList.rotaryModule = true;
                }

                if (includes(AIR_PURIFIER_MODULE_IDS, module.moduleId)) {
                    stateData.airPurifier = true;
                    // need to update airPurifier status
                }
                if (includes(PRINTING_HEAD_MODULE_IDS, module.moduleId)) {
                    stateData.headType = HEAD_PRINTING;
                    this.headType = HEAD_PRINTING;
                    toolHeadModules.push(module);
                } else if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                    stateData.headType = HEAD_LASER;
                    this.headType = HEAD_LASER;
                    toolHeadModules.push(module);
                } else if (includes(CNC_HEAD_MODULE_IDS, module.moduleId)) {
                    stateData.headType = HEAD_CNC;
                    this.headType = HEAD_CNC;
                    toolHeadModules.push(module);
                }

                const keys = Object.keys(MODULEID_MAP);
                if (includes(keys, String(module.moduleId))) {
                    const moduleIDName = MODULEID_MAP[module.moduleId];

                    // TODO: Consider more than one tool head modules
                    if (!this.moduleInfos[moduleIDName]) {
                        this.moduleInfos[moduleIDName] = module;
                    } else {
                        const modules = this.moduleInfos[moduleIDName];
                        if (Array.isArray(modules)) {
                            modules.push(module);
                        } else {
                            // convert single item to list
                            this.moduleInfos[moduleIDName] = [modules, module];
                        }
                    }
                }
            });

            if (toolHeadModules.length === 0) {
                stateData.toolHead = MODULEID_TOOLHEAD_MAP['0']; // default extruder
            } else if (toolHeadModules.length === 1) {
                const module = toolHeadModules[0];
                stateData.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
            } else if (toolHeadModules.length === 2) {
                // hard-coded IDEX head for J1, refactor this later.
                stateData.toolHead = MODULEID_TOOLHEAD_MAP['00'];
            }
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

            if (nozzleInfo.extruderList.length === 1) {
                const extruderInfo = nozzleInfo.extruderList[0];

                // FIXME: Use key as extruderIndex is not accurate
                const extruderIndex = nozzleInfo.key;

                const nozzleSizeList = stateData.nozzleSizeList || [];

                // FIXME: Use nozzleInfo to determine work nozzle is not accurate
                if (extruderInfo.status === 1) {
                    this.currentWorkNozzle = extruderIndex;
                }

                if (extruderInfo.diameter !== nozzleSizeList[extruderIndex]) {
                    nozzleSizeList[extruderIndex] = extruderInfo.diameter;
                }

                if (extruderIndex === 0) {
                    stateData = {
                        ...stateData,
                        nozzleSizeList,
                        nozzleTemperature: extruderInfo.currentTemperature,
                        nozzleTargetTemperature: extruderInfo.targetTemperature,
                        currentWorkNozzle: this.currentWorkNozzle,
                    };
                } else {
                    stateData = {
                        ...stateData,
                        nozzleSizeList,
                        nozzleRightTargetTemperature: extruderInfo?.targetTemperature || 0,
                        nozzleRightTemperature: extruderInfo?.currentTemperature || 0,
                        currentWorkNozzle: this.currentWorkNozzle,
                    };
                }
            } else if (nozzleInfo.extruderList.length === 2) {
                const leftInfo = find(nozzleInfo.extruderList, { index: 0 });
                const rightInfo = find(nozzleInfo.extruderList, { index: 1 }) || {};

                this.currentWorkNozzle = rightInfo.status === 1 ? 1 : 0;
                stateData = {
                    ...stateData,
                    nozzleSizeList: [leftInfo.diameter, rightInfo.diameter],
                    nozzleTemperature: leftInfo.currentTemperature,
                    nozzleTargetTemperature: leftInfo.targetTemperature,
                    nozzleRightTargetTemperature: rightInfo?.targetTemperature || 0,
                    nozzleRightTemperature: rightInfo?.currentTemperature || 0,
                    currentWorkNozzle: this.currentWorkNozzle
                };
            }
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
                b: currentCoordinate[4].value,
                isFourAxis: moduleStatusList.rotaryModule
            };
            const originOffset = {
                x: originCoordinate[0].value,
                y: originCoordinate[1].value,
                z: originCoordinate[2].value,
                b: originCoordinate[4].value
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
        this.subscribeCncSpeedStateCallback = (data) => {
            const cncSpeedState = new CncSpeedState().fromBuffer(data.response.data);
            const { targetSpeed, currentSpeed } = cncSpeedState;
            this.cncTargetSpeed = targetSpeed;
            stateData = {
                ...stateData,
                cncTargetSpindleSpeed: targetSpeed,
                cncCurrentSpindleSpeed: currentSpeed
            };
        };
        this.sacpClient.subscribeCncSpeedState({ interval: 1000 }, this.subscribeCncSpeedStateCallback).then(res => {
            log.info(`subscribe cnc speed state success: ${res}`);
        });
        this.subscribeLaserPowerCallback = (data) => {
            const laserTubeState = new LaserTubeState().fromBuffer(data.response.data.slice(1));
            const { currentPower: laserCurrentPower, targetPower: laserTargetPower } = laserTubeState;
            stateData = {
                ...stateData,
                laserPower: laserCurrentPower,
                laserTargetPower
            };
        };
        this.sacpClient.subscribeLaserPowerState({ interval: 1000 }, this.subscribeLaserPowerCallback).then(res => {
            log.info(`subscribe laser power state success: ${res}`);
        });

        // TODO: Note this is only for Artisan + J1, not for RayInstance, refactor this
        this.subscribeGetCurrentGcodeLineCallback = async ({ response }) => {
            if (!this.totalLine || !this.estimatedTime) {
                this.sacpClient.getPrintingFileInfo().then((result) => {
                    const { totalLine, estimatedTime } = result.data;
                    if (totalLine) {
                        this.totalLine = totalLine;
                    }
                    if (estimatedTime) {
                        this.estimatedTime = estimatedTime;
                    }
                });
            }
            const { currentLine } = new GcodeCurrentLine().fromBuffer(response.data);
            const progress = Math.round((currentLine / this.totalLine) * 100) / 100;
            const sliceTime = new Date().getTime() - this.startTime;
            const remainingTime = (1 - (progress)) * progress * (this.estimatedTime * 1000) / progress + (1 - progress) * (1 - progress) * sliceTime;
            const data = {
                sent: currentLine,
                total: this.totalLine,
                elapsedTime: sliceTime,
                estimatedTime: this.estimatedTime * 1000,
                progress: currentLine === this.totalLine ? 1 : progress,
                remainingTime: remainingTime,
                printStatus: currentLine === this.totalLine ? COMPLUTE_STATUS : ''
            };

            if (includes([WorkflowStatus.Running, WorkflowStatus.Paused], this.machineStatus)) {
                this.socket && this.socket.emit('sender:status', ({ data }));
            }
        };
        this.sacpClient.subscribeGetPrintCurrentLineNumber({ interval: 1000 }, this.subscribeGetCurrentGcodeLineCallback);
        this.sacpClient.subscribeGetPrintingTime({ interval: 1000 }, (response) => {
            const sliceTime = response.response.data.readUInt32LE(0);
            this.startTime = new Date().getTime() - sliceTime * 1000;
        });
        this.subscribeEnclosureInfoCallback = (data) => {
            const { ledValue, testStatus, fanlevel } = new EnclosureInfo().fromBuffer(data.response.data);
            let headTypeKey = 0;
            switch (this.headType) {
                case HEAD_PRINTING:
                    headTypeKey = 0;
                    break;
                case HEAD_LASER:
                    headTypeKey = 1;
                    break;
                case HEAD_CNC:
                    headTypeKey = 2;
                    break;
                default:
                    break;
            }
            const { State } = find(testStatus, { workType: headTypeKey });
            stateData = {
                ...stateData,
                ledValue,
                fanLevel: fanlevel,
                isDoorEnable: State,
            };
        };
        this.sacpClient.subscribeEnclosureInfo({ interval: 1000 }, this.subscribeEnclosureInfoCallback).then(res => {
            log.info(`subscribe enclosure info, ${res.response.result}`);
        });
        this.subscribePurifierInfoCallback = (data) => {
            const { airPurifierStatus: { fanState, speedLevel, lifeLevel, powerState } } = new AirPurifierInfo().fromBuffer(data.response.data);
            stateData = {
                ...stateData,
                airPurifierHasPower: powerState,
                airPurifierSwitch: fanState,
                airPurifierFanSpeed: speedLevel,
                airPurifierFilterHealth: lifeLevel - 1
            };
        };
        this.sacpClient.subscribePurifierInfo({ interval: 1000 }, this.subscribePurifierInfoCallback).then(res => {
            log.info(`subscribe purifier info, ${res.response.result}`);
        });
    };

    public setROTSubscribeApi = () => {
        log.info('ack ROT api');
        this.sacpClient.handlerCoordinateMovementReturn(() => {
            this.socket && this.socket.emit('move:status', { isMoving: false });
            if (this.readyToWork) {
                log.info('ready to work');
                this.socket && this.socket.emit('connection:headBeginWork', { headType: this.headType });
                this.readyToWork = false;
            }
        });
        this.sacpClient.handlerSwitchNozzleReturn(async (data) => {
            if (this.filamentAction && data === 0) {
                const module = this.filamentActionModule;
                if (this.filamentActionType === UNLOAD_FILAMENT) {
                    const { response } = await this.sacpClient.ExtruderMovement(module.key, 0, 6, 200, 60, 150);
                    if (response.result !== 0) {
                        this.socket && this.socket.emit('connection:unloadFilament');
                    }
                } else {
                    const { response } = await this.sacpClient.ExtruderMovement(module.key, 0, 60, 200, 0, 0);
                    if (response.result !== 0) {
                        this.socket && this.socket.emit('connection:loadFilament');
                    }
                }
            } else {
                this.socket && this.socket.emit(this.filamentActionType === LOAD_FIMAMENT ? 'connection:loadFilament' : 'connection:unloadFilament');
            }
        });
        this.sacpClient.handlerExtruderMovementReturn(() => {
            this.filamentAction = false;
            this.socket && this.socket.emit(this.filamentActionType === LOAD_FIMAMENT ? 'connection:loadFilament' : 'connection:unloadFilament');
        });
        this.sacpClient.handlerExtruderZOffsetReturn((data) => {
            log.info(`extruderZOffsetReturn, ${data}`);
        });
        this.sacpClient.handlerStartPrintReturn((data) => {
            log.info(`handlerStartPrintReturn, ${data}`);
        });
        this.sacpClient.handlerStopPrintReturn((data) => {
            log.info(`handlerStopPrintReturn, ${data}`);
            this.socket && this.socket.emit('connection:stopGcode', {});
        });
        this.sacpClient.handlerPausePrintReturn((data) => {
            log.info(`handlerPausePrintReturn, ${data}`);
            this.socket && this.socket.emit('connection:pauseGcode', {});
        });
        this.sacpClient.handlerResumePrintReturn((data) => {
            log.info(`handlerResumePrintreturn, ${data}`);
            this.resumeGcodeCallback && this.resumeGcodeCallback({ msg: data, code: data });
        });
    };

    public getModuleInfo = async () => {
        const res = await this.sacpClient.getModuleInfo();

        // save module info in channel
        this.moduleInfos = {};
        for (const module of res.data) {
            const keys = Object.keys(MODULEID_MAP);

            if (includes(keys, String(module.moduleId))) {
                const identifier = MODULEID_MAP[module.moduleId];

                if (!this.moduleInfos[identifier]) {
                    this.moduleInfos[identifier] = module;
                } else {
                    const modules = this.moduleInfos[identifier];
                    if (Array.isArray(modules)) {
                        modules.push(module);
                    } else {
                        // convert single item to list
                        this.moduleInfos[identifier] = [modules, module];
                    }
                }
            }
        }

        return res;
    };

    public getCoordinateInfo = async () => {
        return this.sacpClient.getCurrentCoordinateInfo();
    };

    public goHome = async (headType?: string) => {
        log.info('onClick gohome');
        await this.sacpClient.updateCoordinate(CoordinateType.MACHINE).then(res => {
            log.info(`Update Coordinate: ${res}`);
        });
        await this.sacpClient.requestHome().then(({ response }) => {
            log.info(`Go-Home, ${response}`);
            this.socket && this.socket.emit('serialport:read', { data: response.result === 0 ? 'OK' : 'WARNING' });
        });
        if (headType === HEAD_LASER || headType === HEAD_CNC) {
            await this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE).then(res => {
                log.info(`Update Coordinate: ${res}`);
            });
        }
    };

    public coordinateMove = async ({ moveOrders, jogSpeed, headType, beforeGcodeStart = false }) => {
        log.info(`coordinate: ${JSON.stringify(moveOrders)}, ${headType}`);
        this.socket && this.socket.emit('move:status', { isMoving: true });
        const distances = [];
        const directions = [];
        moveOrders.forEach(item => {
            directions.push(COORDINATE_AXIS[item.axis]);
            distances.push(item.distance);
        });
        this.readyToWork = beforeGcodeStart;
        await this.sacpClient.requestAbsoluteCooridateMove(directions, distances, jogSpeed, CoordinateType.MACHINE).then(res => {
            log.info(`Coordinate Move: ${res.response.result}`);
            this.socket && this.socket.emit('serialport:read', { data: res.response.result === 0 ? 'CANRUNNING' : 'WARNING' });
        });
    };

    public setWorkOrigin = async ({ xPosition, yPosition, zPosition, bPosition }) => {
        log.info(`position: ${xPosition}, ${yPosition}, ${zPosition}, ${bPosition}`);
        const coordinateInfos = [new CoordinateInfo(Direction.X1, 0), new CoordinateInfo(Direction.Y1, 0), new CoordinateInfo(Direction.Z1, 0)];
        if (bPosition) {
            coordinateInfos.push(new CoordinateInfo(Direction.B1, 0));
        }
        await this.sacpClient.setWorkOrigin(coordinateInfos).then(res => {
            log.info(`Set Work Origin: ${res.data}`);
        });
        // to: only laser/cnc
    };

    public stopGcode = () => {
        this.sacpClient.stopPrint().then(res => {
            log.info(`Stop Print: ${res}`);
            // eventName && this.socket && this.socket.emit(eventName, {});
        });
    };

    public pauseGcode = () => {
        this.sacpClient.pausePrint().then(res => {
            log.info(`Pause Print: ${res}`);
            // eventName && this.socket && this.socket.emit(eventName, {});
        });
    };

    public resumeGcode = (options, callback) => {
        callback && (this.resumeGcodeCallback = callback);
        this.sacpClient.resumePrint().then(res => {
            log.info(`Resume Print: ${res}`);
            // callback && callback({ msg: res.response.result, code: res.response.result });
        });
    };

    private getToolHeadModule(extruderIndex: number | string): { module: ModuleInfo, extruderIndex: number } {
        extruderIndex = Number(extruderIndex);

        const modules = this.moduleInfos && (this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2] || this.moduleInfos[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]);
        if (!modules) {
            return null;
        }

        let targetModule: ModuleInfo = null;
        if (Array.isArray(modules)) {
            extruderIndex = Number(extruderIndex);
            for (const module of modules) {
                if (module.moduleIndex === extruderIndex) {
                    targetModule = module;
                    extruderIndex = 0;
                    break;
                }
            }
        } else {
            targetModule = modules;
        }

        return {
            module: targetModule,
            extruderIndex,
        };
    }

    /**
     * Switch active extruder.
     */
    public async switchExtruder(extruderIndex: number | string) {
        const { module, extruderIndex: newExtruderIndex } = this.getToolHeadModule(extruderIndex);
        if (!module) {
            log.error(`No matched print module for extruder ${extruderIndex}`);
            return;
        }

        // const key = toolhead && toolhead.key;
        await this.sacpClient.SwitchExtruder(module.key, newExtruderIndex);
        log.info(`SACP: Switch extruder to module ${module.moduleId} [key: ${module.key}, extruderIndex: ${extruderIndex}]`);
    }

    /**
     * Set extruder temperature.
     */
    public updateNozzleTemperature = async (extruderIndex: number | string, temperature: number) => {
        const { module, extruderIndex: newExtruderIndex } = this.getToolHeadModule(extruderIndex);
        if (!module) {
            log.error(`No matched print module for extruder ${extruderIndex}`);
            return;
        }

        const { response } = await this.sacpClient.SetExtruderTemperature(module.key, newExtruderIndex, temperature);

        if (response.result === 0) {
            log.info(`SACP: Set extruder temperature to ${temperature} [key:[${module.key}], extruderIndex: ${extruderIndex}]`);
        }
    };

    public async loadFilament(extruderIndex: number | string, eventName: string) {
        const { module, extruderIndex: newExtruderIndex } = this.getToolHeadModule(extruderIndex);
        if (!module) {
            log.error(`No matched print module for extruder ${extruderIndex}`);
            return;
        }

        if (Number(extruderIndex) === this.currentWorkNozzle) {
            this.filamentAction = true;
            this.filamentActionType = LOAD_FIMAMENT;
            this.filamentActionModule = module;
            await this.sacpClient.ExtruderMovement(module.key, 0, 60, 200, 0, 0);
        } else {
            const { response } = await this.sacpClient.SwitchExtruder(module.key, newExtruderIndex);
            if (response.result === 0) {
                this.filamentAction = true;
                this.filamentActionType = LOAD_FIMAMENT;
                this.filamentActionModule = module;
            } else {
                this.filamentAction = false;
                this.socket && this.socket.emit(eventName);
            }
        }
    }

    public async unloadFilament(extruderIndex: number | string, eventName: string) {
        const { module, extruderIndex: newExtruderIndex } = this.getToolHeadModule(extruderIndex);
        if (!module) {
            log.error(`non-eixst toolHead, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        if (Number(extruderIndex) === this.currentWorkNozzle) {
            this.filamentAction = true;
            this.filamentActionType = UNLOAD_FILAMENT;
            this.filamentActionModule = module;
            this.sacpClient.ExtruderMovement(module.key, 0, 6, 200, 60, 150);
        } else {
            const { response } = await this.sacpClient.SwitchExtruder(module.key, newExtruderIndex);
            if (response.result === 0) {
                this.filamentAction = true;
                this.filamentActionType = UNLOAD_FILAMENT;
                this.filamentActionModule = module;
            } else {
                this.filamentAction = false;
                this.socket && this.socket.emit(eventName);
            }
        }
    }

    public updateBedTemperature = (zoneIndex, temperature) => {
        const heatBedModule = this.moduleInfos && (
            this.moduleInfos[A400_HEADT_BED_FOR_SM2]
            || this.moduleInfos[HEADT_BED_FOR_SM2]
            || this.moduleInfos[SNAPMAKER_J1_HEATED_BED]
        ); //
        if (!heatBedModule) {
            log.error('Can not find heated bed module. Command ignored.');
            return;
        }

        this.sacpClient.setHotBedTemperature(heatBedModule.key, zoneIndex, temperature).then(() => {
            log.info(`SACP: Set heated bed target temperature to ${temperature}, module ID = ${heatBedModule.moduleId}`);
        });
    };

    public async updateNozzleOffset(extruderIndex, direction, distance) {
        const toolHead = this.moduleInfos
            && (this.moduleInfos[DUAL_EXTRUDER_TOOLHEAD_FOR_SM2] || this.moduleInfos[SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2]);
        // || this.moduleInfos[HEADT_BED_FOR_SM2]); //
        if (!toolHead) {
            log.error(`non-eixst toolHead 3dp, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        log.info(`SetExtruderOffset key:${toolHead.key} extruderIndex: ${extruderIndex}, direction: ${direction}, distance:${distance}`);
        const response = await this.sacpClient.SetExtruderOffset(toolHead.key, extruderIndex, distance);
        log.info(`SetExtruderOffset, ${JSON.stringify(response)}`);
    }

    // // workspeed
    // public async getWorkSpeed(options) {
    //     const { eventName } = options;
    //     const subscribeWorkSpeedCallback = (data) => {
    //         const workSpeedInfo = new GetWorkSpeed().fromBuffer(data.response.data);
    //         log.info(`workSpeedInfo, ${workSpeedInfo}`);
    //         this.socket && this.socket.emit(eventName, { data: workSpeedInfo.feedRate });
    //     };

    //     this.sacpClient.subscribeWorkSpeed({ interval: 1000 }, subscribeWorkSpeedCallback).then((res) => {
    //         log.info(`subscribe workspeed success: ${res.code}`);
    //     });
    // }

    public async updateWorkSpeed(toolhead, workSpeed, extruderIndex = 0) {
        const headModule = this.moduleInfos && (this.moduleInfos[toolhead]); //
        if (!headModule) {
            log.error(`non-eixst toolhead[${toolhead}], moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            return;
        }

        log.info(`updateWorkSpeed headModule.key: ${headModule.key}, extruderIndex: ${extruderIndex}, workSpeed: ${workSpeed}}`);
        const leftResponse = await this.sacpClient.setWorkSpeed(headModule.key, extruderIndex, workSpeed);
        log.info(`updateWorkSpeed leftResponse, ${JSON.stringify(leftResponse)}`);


        if (isDualExtruder(toolhead)) {
            const rightResponse = await this.sacpClient.setWorkSpeed(headModule.key, 1, workSpeed);
            log.info(`updateWorkSpeed rightResponse, ${JSON.stringify(rightResponse)}`);
        }
    }


    public updateLaserPower = (value) => {
        const laserLevelTwoHead = this.moduleInfos && (this.moduleInfos[LEVEL_TWO_POWER_LASER_FOR_SM2] || this.moduleInfos[LEVEL_ONE_POWER_LASER_FOR_SM2]); //
        if (!laserLevelTwoHead) {
            log.error(`non-eixst laserLevelHead, moduleInfos:${this.moduleInfos}`,);
            return;
        }

        this.sacpClient.SetLaserPower(laserLevelTwoHead.key, value).then(({ response }) => {
            log.info(`updateLaserPower, ${JSON.stringify(response)}`);
        });
    };

    public async setAbsoluteWorkOrigin({ z, isRotate = false }: {
        x: number, y: number, z: number, isRotate: boolean
    }) {
        try {
            const res1 = await this.sacpClient.updateCoordinate(CoordinateType.MACHINE);
            log.debug(`updateCoordinate CoordinateType.MACHINE res: ${JSON.stringify(res1)}`);
            await this.sacpClient.getCurrentCoordinateInfo().then(async ({ coordinateSystemInfo }) => {
                const zNow = coordinateSystemInfo.coordinates.find(item => item.key === Direction.Z1).value;
                log.debug(`current positions, ${zNow}, ${z}`);
                // calculate the absolute distance on seperate axis, same reason with coordinate moving func 'coordinateMove'

                const newZ = new CoordinateInfo(Direction.Z1, isRotate ? 0 : zNow - z);
                const newCoord = [newZ];
                log.debug(`new positions, ${zNow - z}, ${JSON.stringify(newCoord)}`);
                await this.sacpClient.updateCoordinate(CoordinateType.WORKSPACE);
                const res = await this.sacpClient.setWorkOrigin(newCoord);
                log.debug(`setAbsoluteWorkOrigin res:${JSON.stringify(res)}`);
            });
        } catch (e) {
            log.error(`getLaserMaterialThickness error: ${e}`);
        }
    }

    //
    public async laserSetWorkHeight(options) {
        const { toolHead, materialThickness, isRotate } = options;
        const headModule = this.moduleInfos && (this.moduleInfos[toolHead]); //
        if (!headModule) {
            log.error(`non-eixst toolhead[${toolHead}], moduleInfos:${JSON.stringify(this.moduleInfos)}`,);
            return;
        }
        const { laserToolHeadInfo } = await this.sacpClient.getLaserToolHeadInfo(headModule.key);
        log.debug(`laserFocalLength:${laserToolHeadInfo.laserFocalLength}, materialThickness: ${materialThickness}, platformHeight:${laserToolHeadInfo.platformHeight}`);
        await this.setAbsoluteWorkOrigin({
            x: 0,
            y: 0,
            z: laserToolHeadInfo.laserFocalLength + laserToolHeadInfo.platformHeight + materialThickness,
            isRotate
        });
    }

    /**
     * Configure machine network.
     *
     * Note that this API is only implemented by Ray.
     */
    public async configureNetwork(networkOptions: NetworkOptions): Promise<boolean> {
        return this.sacpClient.configureNetwork(networkOptions);
    }

    public async getNetworkConfiguration(): Promise<NetworkConfiguration> {
        return this.sacpClient.getNetworkConfiguration();
    }

    public async getNetworkStationState(): Promise<NetworkStationState> {
        return this.sacpClient.getNetworkStationState();
    }
}

export default SacpChannelBase;
