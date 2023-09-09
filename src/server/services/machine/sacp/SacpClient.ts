import path from 'path';
import zlib from 'zlib';
import fs from 'fs';
import crypto from 'crypto';
import { includes } from 'lodash';
import readline from 'linebyline';
import {
    BatchBufferInfo,
    CalibrationInfo,
    CoordinateInfo,
    CoordinateSystemInfo,
    ExtruderMovement,
    ExtruderOffset,
    FdmToolHeadInfo,
    GcodeFileInfo,
    GetHotBed,
    LaserCalibration,
    LaserToolHeadInfo,
    MachineInfo,
    MachineSize,
    ModuleInfo,
    MovementInstruction,
    PrintBatchGcode,
    SetLaserPower,
    WifiConnectionInfo,
    NetworkConfiguration,
    NetworkOptions,
    NetworkStationState,
    EnclosureInfo,
    AirPurifierInfo,
} from '@snapmaker/snapmaker-sacp-sdk/dist/models';
import {
    Serializable
} from '@snapmaker/snapmaker-sacp-sdk/dist/types';
import { Dispatcher, RequestData, Response, ResponseCallback, ResponseData } from '@snapmaker/snapmaker-sacp-sdk';
import {
    readFloat,
    readString,
    readUint16,
    readUint32,
    readUint8,
    stringToBuffer,
    writeBool,
    writeFloat,
    writeInt16,
    writeInt8,
    writeUint16,
    writeUint32,
    writeUint8,
    readBool,
} from '@snapmaker/snapmaker-sacp-sdk/dist/helper';
import { PeerId } from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Header';
import { MoveDirection } from '@snapmaker/snapmaker-sacp-sdk/dist/models/MovementInstruction';

import DataStorage from '../../../DataStorage';

interface Logger {
    error(msg: string): void;
    warn(msg: string): void;
    info(msg: string): void;
    debug(msg: string): void;
}

class LaserLockStatus implements Serializable {
    public lockStatus: boolean;

    public toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    public fromBuffer(buffer: Buffer) {
        this.lockStatus = readBool(buffer, 0);
    }
}


export enum CoordinateType {
    MACHINE, WORKSPACE
}

export enum HeadType {
    PRINTING, CNC, LASER
}

export type RequestPhotoInfo = {
    index: number;
    x: number;
    y: number;
    z: number;
    feedRate: number;
    photoQuality: number;
}

export enum ToolHeadType {
    LASER1600mW, LASER10000mW
}

interface CompressUploadFileOptions {
    renderName?: string;

    onProgress?: (progress: number) => void;
    onCompressing?: () => void;
    onDecompressing?: () => void;
    onFailed?: (reason: string) => void;
}

export default class SacpClient extends Dispatcher {
    private log: Logger = console;

    private filePeerId: PeerId = PeerId.SCREEN;

    public constructor(type: string, socket) {
        super(type, socket);
        this.setHandler(0xb0, 0x00, async (data) => {
            const { nextOffset, result: filename } = readString(data.param, 0);
            const fileLength = readUint32(data.param, nextOffset);
            const chunks = readUint16(data.param, nextOffset + 4);
            const { result: md5HexStr } = readString(data.param, nextOffset + 6);

            this.ack(0xb0, 0x00, data.packet, Buffer.alloc(1, 0));

            // const hash = crypto.createHash('md5');
            const outputStream = fs.createWriteStream(path.join(DataStorage.tmpDir, filename)); // need to rename this filename

            let chunkIndex = 0;
            let receivedLength = 0;
            const md5Buffer = stringToBuffer(md5HexStr);

            const requestPacket = async () => {
                if (chunkIndex <= chunks - 1) {
                    const chunkIndexBuffer = Buffer.alloc(2, 0);
                    writeUint16(chunkIndexBuffer, 0, chunkIndex);
                    const buffer = Buffer.concat([md5Buffer, chunkIndexBuffer]);

                    await this.send(0xb0, 0x01, PeerId.SCREEN, buffer).then((res) => {
                        if (res.response.result === 0) {
                            const { nextOffset: _nextOffset, result: md5HexStr1 } = readString(res.response.data, 0);
                            const chunkIndex1 = readUint16(res.response.data, _nextOffset);
                            const len = readUint16(res.response.data, _nextOffset + 2);
                            receivedLength += len;
                            const chunk = res.response.data.slice(_nextOffset + 2 + 2, _nextOffset + 2 + 2 + len);
                            this.log.debug(`received chunk: ${chunkIndex} success, ${md5HexStr1}, ${chunkIndex1}, ${len}`);
                            outputStream.write(chunk, (err) => {
                                if (err) {
                                    this.log.error(`write chunk error: ${err}`);
                                } else {
                                    // hash.update(chunk);
                                }
                            });
                        } else {
                            this.log.debug(`received chunk: ${chunkIndex} fail`);
                        }
                    });
                    chunkIndex++;
                    await requestPacket();
                }
            };
            await requestPacket();
            outputStream.end();
            let resultBuffer = Buffer.alloc(1, 0);
            const filenameBuffer = stringToBuffer(filename);
            if (fileLength !== receivedLength) {
                resultBuffer = Buffer.alloc(1, 1);
            }
            this.send(0xb0, 0x02, PeerId.SCREEN, Buffer.concat([resultBuffer, filenameBuffer, md5Buffer]));
        });
    }

    public setLogger(log: Logger) {
        this.log = log;
    }

    public setFilePeerId(peerId: PeerId): void {
        this.filePeerId = peerId;
    }

    public async executeGcode(gcode: string) {
        return this.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer(gcode)).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async logFeedbackLevel(level = 2) {
        return this.send(0x01, 0x10, PeerId.CONTROLLER, Buffer.alloc(1, level)).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async subscribeLogFeedback({ interval = 3600000 }, callback: ResponseCallback) {
        return this.subscribe(0x01, 0xa1, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async unSubscribeLogFeedback(callback: ResponseCallback) {
        return this.unsubscribe(0x01, 0xa1, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async getPrintingFileInfo() {
        return this.send(0xac, 0x1a, this.filePeerId, Buffer.alloc(1, 0)).then(({ response, packet }) => {
            const data = {
                filename: '',
                totalLine: 0,
                estimatedTime: 0
            };
            if (response.result === 0) {
                const { nextOffset, result } = readString(response.data);
                data.filename = result;
                const totalLines = readUint32(response.data, nextOffset);
                const estimatedTime = readUint32(response.data, nextOffset + 4);
                data.totalLine = totalLines;
                data.estimatedTime = estimatedTime;
            }
            return { response, packet, data };
        });
    }

    public async subscribeGetPrintCurrentLineNumber({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0xac, 0xa0, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async unSubscribeGetPrintCurrentLineNumber(callback: ResponseCallback) {
        return this.unsubscribe(0xac, 0xa0, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async subscribeGetPrintingTime({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0xac, 0xa5, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async subscribeGetPrintingProgress({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0xb0, 0xa0, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async subscribeGetPrintingEstimatedTime({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0xb0, 0xa1, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    // set Handler API list for RTO
    // 0x10, 0x05
    public handlerSwitchNozzleReturn(callback: (res) => void) {
        this.setHandler(0x10, 0x0b, (request: RequestData) => {
            const result = readUint8(request.packet.payload);
            this.ack(0x10, 0x0b, request.packet, Buffer.alloc(1, 0));
            callback && callback(result);
        });
    }

    // 0x10, 0x09
    public handlerExtruderMovementReturn(callback) {
        this.setHandler(0x10, 0x0c, (request: RequestData) => {
            this.ack(0x10, 0x0c, request.packet, Buffer.alloc(1, 0));
            callback && callback(request);
        });
    }

    // 0xa0, 0x15
    public handlerExtruderZOffsetReturn(callback) {
        this.setHandler(0xa0, 0x19, (request: RequestData) => {
            this.ack(0xa0, 0x19, request.packet, Buffer.alloc(1, 0));
            callback && callback(request);
        });
    }

    // 0x10, 0x34
    public async handlerCoordinateMovementReturn(callback) {
        this.setHandler(0x01, 0x33, (request: RequestData) => {
            this.ack(0x01, 0x33, request.packet, Buffer.alloc(1, 0));
            this.log.info('request coordinate');
            callback && callback(request);
        });
    }

    public handlerStartPrintReturn(callback) {
        this.setHandler(0xac, 0x14, (request: RequestData) => {
            this.ack(0xac, 0x14, request.packet, Buffer.alloc(1, 0));
            this.log.info('request startprint return');
            callback && callback(request);
        });
    }

    public handlerStopPrintReturn(callback) {
        this.setHandler(0xac, 0x17, (request: RequestData) => {
            this.ack(0xac, 0x17, request.packet, Buffer.alloc(1, 0));
            this.log.info('request stopprint return');
            callback && callback(request);
        });
    }

    public handlerPausePrintReturn(callback) {
        this.setHandler(0xac, 0x15, (request: RequestData) => {
            this.ack(0xac, 0x15, request.packet, Buffer.alloc(1, 0));
            this.log.info('request pause print return');
            callback && callback(request);
        });
    }

    public handlerResumePrintReturn(callback) {
        this.setHandler(0xac, 0x16, (request: RequestData) => {
            this.ack(0xac, 0x16, request.packet, Buffer.alloc(1, 0));
            this.log.info('request resume print return');
            const result = readUint8(request.packet.payload);
            callback && callback(result);
        });
    }

    public async getEmergencyStopInfo() {
        return this.send(0x01, 0x3b, PeerId.CONTROLLER, Buffer.alloc(0)).then(({ response, packet }) => {
            // const isTouch = readBool(response.data);
            return { packet, data: response };
        });
    }

    public async takePhoto({ index = 0, x = 0, y = 0, z = 0, feedRate = 0, photoQuality = 0 }: RequestPhotoInfo) {
        const buffer = Buffer.alloc(16, 0);
        let nextOffset = 0;
        nextOffset = writeUint8(buffer, nextOffset, index);
        nextOffset = writeFloat(buffer, nextOffset, x);
        nextOffset = writeFloat(buffer, nextOffset, y);
        nextOffset = writeFloat(buffer, nextOffset, z);
        nextOffset = writeUint16(buffer, nextOffset, feedRate);
        writeUint8(buffer, nextOffset, photoQuality);
        return this.send(0xb0, 0x04, PeerId.SCREEN, buffer);
    }

    public async getCameraCalibration(toolHeadType: ToolHeadType = ToolHeadType.LASER1600mW) {
        return this.send(0xb0, 0x03, PeerId.SCREEN, Buffer.alloc(1, toolHeadType)).then(({ response, packet }) => {
            let calibrationInfo = null;
            if (response.result === 0) {
                calibrationInfo = new CalibrationInfo().fromBuffer(response.data);
            }
            return { response, packet, calibrationInfo };
        });
    }

    public async getPhoto(index = 0) {
        return this.send(0xb0, 0x05, PeerId.SCREEN, Buffer.alloc(1, index)).then(({ response, packet }) => {
            const data = {
                filename: '',
                md5Str: ''
            };
            if (response.result === 0) {
                const { nextOffset, result } = readString(response.data);
                data.filename = result;
                const res = readString(response.data, nextOffset);
                data.md5Str = res.result;
            }
            return { response, packet, data };
        });
    }

    public async getCalibrationPhoto(toolHeadType: ToolHeadType = ToolHeadType.LASER1600mW) {
        return this.send(0xb0, 0x06, PeerId.SCREEN, Buffer.alloc(1, toolHeadType)).then(({ response, packet }) => {
            const data = {
                filename: '',
                md5Str: ''
            };
            if (response.result === 0) {
                const { nextOffset, result } = readString(response.data);
                data.filename = result;
                const res = readString(response.data, nextOffset);
                data.md5Str = res.result;
            }
            return { response, packet, data };
        });
    }

    public async setMatrix(toolHeadType: ToolHeadType = ToolHeadType.LASER1600mW, matrix: CalibrationInfo) {
        const calibrationInfo = new CalibrationInfo(matrix.points, matrix.corners);
        return this.send(0xb0, 0x07, PeerId.SCREEN, Buffer.concat([Buffer.alloc(1, toolHeadType), calibrationInfo.toBuffer()]));
    }

    public async startScreenPrint({ headType = HeadType.PRINTING, filename = '', hash = '' }) {
        const filenameBuffer = stringToBuffer(filename);
        const hashBuffer = stringToBuffer(hash);
        return this.send(0xb0, 0x08, PeerId.SCREEN, Buffer.concat([Buffer.alloc(1, headType), filenameBuffer, hashBuffer])).then(res => {
            return res;
        });
    }

    public async getLaserMaterialThickness({ x = 0, y = 0, feedRate = 0 }: {
        token: string, x: number, y: number, feedRate: number
    }) {
        // const tokenBuffer = stringToBuffer(token);
        const buffer = Buffer.alloc(10, 0);
        let nextOffset = 0;
        nextOffset = writeFloat(buffer, nextOffset, x);
        nextOffset = writeFloat(buffer, nextOffset, y);
        writeUint16(buffer, nextOffset, feedRate);
        return this.send(0xb0, 0x09, PeerId.SCREEN, Buffer.concat([buffer])).then(({ response, packet }) => {
            let thickness = 0;
            if (response.result === 0) {
                thickness = readFloat(response.data);
            }
            return { response, packet, thickness };
        });
    }

    public async setWorkOrigin(coordinateInfos: Array<CoordinateInfo>) {
        let buffer = Buffer.alloc(0);
        const lenBuffer = Buffer.alloc(1, 0);
        writeUint8(lenBuffer, 0, coordinateInfos.length);
        buffer = Buffer.concat([buffer, lenBuffer]);

        coordinateInfos.forEach(item => {
            const m = new CoordinateInfo(item.key, item.value).toBuffer();
            buffer = Buffer.concat([buffer, m]);
        });
        return this.send(0x01, 0x32, PeerId.CONTROLLER, buffer);
    }

    public async moveAbsolutely(movementInstructions: Array<MovementInstruction>, speed = 0) {
        const speedBuffer = Buffer.alloc(2, 0);
        writeUint16(speedBuffer, 0, speed);
        let buffer = Buffer.alloc(0);

        const lenBuffer = Buffer.alloc(1, 0);
        writeUint8(lenBuffer, 0, movementInstructions.length);
        buffer = Buffer.concat([buffer, lenBuffer]);

        movementInstructions.forEach(item => {
            const m = new MovementInstruction(item.direction, item.distance).toBuffer();
            buffer = Buffer.concat([buffer, m]);
        });
        return this.send(0x01, 0x34, PeerId.CONTROLLER, Buffer.concat([buffer, speedBuffer]));
    }

    // 0x12 Laser functions

    public async getLaserToolHeadInfo(key: number) {
        const buffer = Buffer.alloc(1, 0);
        writeUint8(buffer, 0, key);
        return this.send(0x12, 0x01, PeerId.CONTROLLER, buffer).then(({ response }) => {
            let laserToolHeadInfo = new LaserToolHeadInfo();
            if (response.result === 0) {
                laserToolHeadInfo = laserToolHeadInfo.fromBuffer(response.data);
            }
            return { response, laserToolHeadInfo };
        });
    }

    public async getLaserLockStatus(key: number) {
        // const writeBuffer = Buffer.alloc(2, 0);
        // writeUint8(writeBuffer, 0, key);
        // writeBool(writeBuffer, 1, 1);
        // const { response } = await this.send(0x12, 0x07, PeerId.CONTROLLER, writeBuffer);
        const buffer = Buffer.alloc(1, 0);
        writeUint8(buffer, 0, key);
        return this.send(0x12, 0x0a, PeerId.CONTROLLER, buffer)
            .then(({ response }) => {
                const laserLockStatus = new LaserLockStatus();
                if (response.result === 0) {
                    laserLockStatus.fromBuffer(response.data);
                }
                return { response, laserLockStatus };
            });
    }

    public async getCrosshairOffset(key: number): Promise<{ x: number; y: number }> {
        const buffer = Buffer.alloc(1, 0);
        writeUint8(buffer, 0, key);

        const { response } = await this.send(0x12, 0x11, PeerId.CONTROLLER, buffer);

        if (response.result === 0) {
            const x = readFloat(response.data, 0);
            const y = readFloat(response.data, 4);

            return { x, y };
        } else {
            return { x: 0, y: 0 };
        }
    }

    public async setCrosshairOffset(key: number, x: number, y: number): Promise<boolean> {
        const buffer = Buffer.alloc(9, 0);
        writeUint8(buffer, 0, key);
        writeFloat(buffer, 1, x);
        writeFloat(buffer, 5, y);

        const { response } = await this.send(0x12, 0x10, PeerId.CONTROLLER, buffer);

        if (response.result === 0) {
            return true;
        } else {
            return false;
        }
    }

    public async getFireSensorSensitivity(key: number): Promise<number> {
        const buffer = Buffer.alloc(1, 0);
        writeUint8(buffer, 0, key);

        const { response } = await this.send(0x12, 0x0e, PeerId.CONTROLLER, buffer);

        if (response.result === 0) {
            const sensitivity = readUint16(response.data, 0);

            return sensitivity;
        } else {
            return -1;
        }
    }

    public async setFireSensorSensitivity(key: number, sensitivity: number): Promise<boolean> {
        const buffer = Buffer.alloc(3, 0);
        writeUint8(buffer, 0, key);
        writeUint16(buffer, 1, sensitivity);

        const { response } = await this.send(0x12, 0x0d, PeerId.CONTROLLER, buffer);

        if (response.result === 0) {
            return true;
        } else {
            return false;
        }
    }

    // ----------

    public async subscribeHeartbeat({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x01, 0xa0, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async unsubscribeHeartbeat(callback: ResponseCallback) {
        return this.unsubscribe(0x01, 0xa0, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async configureNetwork(options: NetworkOptions): Promise<boolean> {
        // const networkMode = options?.networkMode || 1; // station default
        const networkOptions = new NetworkConfiguration(options);

        const { response } = await this.send(0x01, 0x15, PeerId.CONTROLLER, networkOptions.toBuffer());
        return response.result === 0;
    }

    /**
     * Export Log to Storage
     *
     * 0x01 0x16 Export Log to External Storage
     * 0x01 0x17 Export Log Result
     */
    public async exportLogToExternalStorage(): Promise<boolean> {
        return new Promise((resolve) => {
            // handle export result
            this.setHandler(0x01, 0x17, (data) => {
                this.ack(0x01, 0x17, data.packet, Buffer.alloc(1, 0));
                if (readUint8(data.param) === 0) {
                    this.log.info('Exporting log to external storage successfully.');
                    resolve(true);
                } else {
                    this.log.info('Failed to exporting log to external storage.');
                    resolve(false);
                }
            });

            // 0 stands for SD card
            const buffer = Buffer.alloc(1, 0);
            this.send(0x01, 0x16, PeerId.CONTROLLER, buffer)
                .then(({ response }) => {
                    if (response.result === 0) {
                        // wait for result
                        this.log.info('Requested for exporting log to external storage.');
                    } else {
                        this.log.info('Requested for exporting log to external storage. Failed.');
                        // fail already
                        resolve(false);
                    }
                });
        });
    }

    // 0x01 0x2X Get Machine Info

    public async getModuleInfo() {
        return this.send(0x01, 0x20, PeerId.CONTROLLER, Buffer.alloc(0)).then(({ response, packet }) => {
            const moduleInfos = ModuleInfo.parseArray(response.data) as ModuleInfo[];
            return { code: response.result, packet, data: moduleInfos as ModuleInfo[] };
        });
    }

    public async getMachineInfo() {
        const { response, packet } = await this.send(0x01, 0x21, PeerId.CONTROLLER, Buffer.alloc(0));

        const machineInfo = new MachineInfo().fromBuffer(response.data);
        return { code: response.result, packet, data: machineInfo as MachineInfo };
    }

    // unimplemented by master control
    public async getMachineSize() {
        return this.send(0x01, 0x22, PeerId.CONTROLLER, Buffer.alloc(0)).then(({ response, packet }) => {
            const machineSize = new MachineSize().fromBuffer(response.data);
            return { response, packet, data: { machineSize }, machineSize };
        });
    }

    /**
     * Get Network Configuration.
     *
     * 0x01 0x25
     */
    public async getNetworkConfiguration(): Promise<NetworkConfiguration> {
        const { response } = await this.send(0x01, 0x25, PeerId.CONTROLLER, Buffer.alloc(0));

        const networkConfiguration = new NetworkConfiguration().fromBuffer(response.data);
        return networkConfiguration;
    }

    /**
     * Get Network station state.
     *
     * Available only when network mode is NetworkMode.Station (networkConfiguration.networkMode).
     *
     * 1) network state
     * 2) RSSI network strength
     * 3) IP address
     */
    public async getNetworkStationState(): Promise<NetworkStationState> {
        const { response } = await this.send(0x01, 0x26, PeerId.CONTROLLER, Buffer.alloc(0));

        const networkStationState = new NetworkStationState().fromBuffer(response.data);

        return networkStationState;
    }

    public async getCurrentCoordinateInfo() {
        return this.send(0x01, 0x30, PeerId.CONTROLLER, Buffer.alloc(0)).then(({ response, packet }) => {
            const coordinateSystemInfo = new CoordinateSystemInfo().fromBuffer(response.data);
            return { response, packet, data: { coordinateSystemInfo }, coordinateSystemInfo };
        });
    }

    public async updateCoordinate(coordinateType: CoordinateType) {
        return this.send(0x01, 0x31, PeerId.CONTROLLER, Buffer.alloc(1, coordinateType)).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async subscribeCurrentCoordinateInfo({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x01, 0xa2, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async unSubscribeCurrentCoordinateInfo(callback: ResponseCallback) {
        return this.unsubscribe(0x01, 0xa2, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async movementInstruction(direction: MoveDirection, distance: number, speed: number) {
        const info = new MovementInstruction(direction, distance, speed);
        return this.send(0x01, 0x34, PeerId.CONTROLLER, info.toBuffer()).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async requestHome(number = 0) {
        return this.send(0x01, 0x35, PeerId.CONTROLLER, Buffer.alloc(1, number)).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async requestAbsoluteCooridateMove(directions: MoveDirection[] = [0], distances: number[] = [0], jogSpeed = 0.1, coordinateType: CoordinateType) {
        const paramBuffer = new MovementInstruction(undefined, undefined, jogSpeed, directions, distances, coordinateType).toArrayBuffer();
        return this.send(0x01, 0x34, PeerId.CONTROLLER, paramBuffer, true).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async startPrint(md5: string, gcodeName: string, headType: number) {
        const info = new GcodeFileInfo(md5, gcodeName, headType);
        return this.send(0xac, 0x03, PeerId.CONTROLLER, info.toBuffer(), true).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async stopPrint() {
        return this.send(0xac, 0x06, PeerId.CONTROLLER, Buffer.alloc(0), true).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async pausePrint() {
        return this.send(0xac, 0x04, PeerId.CONTROLLER, Buffer.alloc(0), true).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async resumePrint() {
        return this.send(0xac, 0x05, PeerId.CONTROLLER, Buffer.alloc(0), true).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async resumePrintForScreen() {
        return this.send(0xb0, 0x0a, PeerId.SCREEN, Buffer.alloc(0)).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async getGocdeFile() {
        return this.send(0xac, 0x00, PeerId.CONTROLLER, Buffer.alloc(0)).then(({ response, packet }) => {
            const gcodeFileInfo = new GcodeFileInfo().fromBuffer(response.data);
            return { response, packet, data: { gcodeFileInfo } };
        });
    }

    public async laserCalibration(calibrationMode: number) {
        const info = new LaserCalibration(calibrationMode);
        return this.send(0xa8, 0x02, PeerId.CONTROLLER, info.toBuffer()).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async laserCalibrationSave(type: number) {
        return this.send(0xa8, 0x03, PeerId.CONTROLLER, Buffer.alloc(1, type)).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SetLaserPower(key: number, power: number) {
        const info = new SetLaserPower(key, power);
        return this.send(0x12, 0x02, PeerId.CONTROLLER, info.toBuffer()).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SetBrightness(key: number, brightness: number) {
        const tobuffer = Buffer.alloc(1 + 1, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, brightness);
        return this.send(0x12, 0x03, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SetFocalLength(key: number, focalLength: number) {
        const tobuffer = Buffer.alloc(1 + 1, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, focalLength);
        return this.send(0x12, 0x04, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async TemperatureProtect(key: number, protectTemperature: number, recoverTemperature: number) {
        const tobuffer = Buffer.alloc(1 + 1 + 1, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, protectTemperature);
        writeInt8(tobuffer, 2, recoverTemperature);
        return this.send(0x12, 0x05, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }


    public async SetLaserLock(key: number, lockStatus: number) {
        const tobuffer = Buffer.alloc(1 + 1, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, lockStatus);
        return this.send(0x12, 0x07, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async GetFDMInfo(key: number) {
        const info = new FdmToolHeadInfo(key);
        return this.send(0x10, 0x01, PeerId.CONTROLLER, info.toBuffer()).then(({ response, packet }) => {
            const getFDMInfo = new FdmToolHeadInfo().fromBuffer(response.data);
            return { response, packet, data: { getFDMInfo } };
        });
    }

    public async subscribeNozzleInfo({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x10, 0xa0, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async unSubscribeNozzleInfo(callback: ResponseCallback) {
        return this.unsubscribe(0x10, 0xa0, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async GetHotBed(key: number) {
        const info = new GetHotBed(key);
        return this.send(0x14, 0x01, PeerId.CONTROLLER, info.toBuffer()).then(({ response, packet }) => {
            const hotBedInfo = new GetHotBed().fromBuffer(response.data);
            return { response, packet, data: { hotBedInfo } };
        });
    }

    public async subscribeHotBedTemperature({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x14, 0xa0, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async unSubscribeHotBedTemperature(callback: ResponseCallback) {
        return this.unsubscribe(0x14, 0xa0, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async subscribeEnclosureInfo({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x15, 0xa0, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async subscribePurifierInfo({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x17, 0xa0, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async subscribeWorkSpeed({ interval = 1000 }, callback: ResponseCallback) {
        this.log.info('subscribeWorkSpeed');
        return this.subscribe(0xac, 0xa4, interval, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async unSubscribeWorkSpeed(callback: ResponseCallback) {
        return this.unsubscribe(0xac, 0xa4, callback).then(({ response, packet }) => {
            return { code: response.result, packet, data: {} };
        });
    }

    public async SetExtruderTemperature(key: number, extruderIndex: number, temperature: number) {
        const tobuffer = Buffer.alloc(1 + 1 + 2, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, extruderIndex);
        writeInt16(tobuffer, 2, temperature);
        return this.send(0x10, 0x02, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SetFilamentstatus(key: number, extruderIndex: number, filamentstatus: number) {
        const tobuffer = Buffer.alloc(1 + 1 + 1, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, extruderIndex);
        writeUint8(tobuffer, 2, filamentstatus);
        return this.send(0x10, 0x04, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SwitchExtruder(key: number, extruderIndex: number) {
        const tobuffer = Buffer.alloc(1 + 1, 0);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, extruderIndex);
        return this.send(0x10, 0x05, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SetExtruderSpeed(key: number, fansIndex: number, speedLevel: number) {
        const tobuffer = Buffer.alloc(1 + 1 + 1);
        writeUint8(tobuffer, 0, key);
        writeUint8(tobuffer, 1, fansIndex);
        writeUint8(tobuffer, 2, speedLevel);
        return this.send(0x10, 0x06, PeerId.CONTROLLER, tobuffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async SetExtruderOffset(key: number, index: number, distance: number) {
        const info = new ExtruderOffset(key, index, distance);
        return this.send(0xa0, 0x15, PeerId.CONTROLLER, info.toBuffer(), true).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async GetExtruderOffset(key: number) {
        return this.send(0x10, 0x08, PeerId.CONTROLLER, Buffer.alloc(1, key)).then(({ response, packet }) => {
            const ExtruderOffsetInfo = new ExtruderOffset().fromBuffer(response.data);
            return { response, packet, data: { ExtruderOffsetInfo } };
        });
    }

    public async ExtruderMovement(key: number, movementType: number, lengthIn: number, speedIn: number, lengthOut: number, speedOut: number) {
        const info = new ExtruderMovement(key, movementType, lengthIn, speedIn, lengthOut, speedOut);
        this.log.info(`Extruder Move: type = ${movementType}, in: ${lengthIn} speed: ${speedIn}, out: ${lengthOut} speed: ${speedOut}`);
        return this.send(0x10, 0x09, PeerId.CONTROLLER, info.toBuffer()).then(({ response, packet }) => {
            this.log.info('Extruder Move: done');
            return { response, packet };
        });
    }

    public async uploadFile(filePath: string, renderName?: string): Promise<boolean> {
        const sizePerChunk = 60 * 1024;
        this.setHandler(0xb0, 0x01, (data) => {
            const { nextOffset, result: md5HexStr } = readString(data.param);
            const index = readUint16(data.param, nextOffset);

            const inputStream = fs.createReadStream(filePath, {
                start: index * sizePerChunk, end: (index + 1) * sizePerChunk - 1, highWaterMark: sizePerChunk
            });
            let buffer = Buffer.alloc(1, 200); // result = 1, means file EOF reached
            let finalBuf = Buffer.alloc(0);
            inputStream.on('data', (buf: Buffer) => {
                finalBuf = Buffer.concat([finalBuf, buf]);
            });
            inputStream.on('end', () => {
                const md5Buffer = stringToBuffer(md5HexStr);
                const indexBuffer = Buffer.alloc(2, 0);
                writeUint16(indexBuffer, 0, index);
                // const chunkLengthBuffer = Buffer.alloc(2, 0);
                // writeUint16(chunkLengthBuffer, 0, finalBuf.byteLength);
                // const chunkBuffer = Buffer.concat([chunkLengthBuffer, finalBuf]); //stringToBuffer(finalBuf.toString());
                const chunkBuffer = stringToBuffer(finalBuf as unknown as string);
                buffer = Buffer.concat([Buffer.alloc(1, 0), md5Buffer, indexBuffer, chunkBuffer]);
                this.ack(0xb0, 0x01, data.packet, buffer);
            });
            inputStream.once('error', () => {
                this.ack(0xb0, 0x01, data.packet, buffer);
            });
        });

        return new Promise<boolean>((resolve, reject) => {
            // handle file upload result
            this.setHandler(0xb0, 0x02, (data) => {
                const result = readUint8(data.param);
                if (result === 0) {
                    this.log.info('file upload success');
                } else {
                    this.log.error('file upload fail');
                }
                this.ack(0xb0, 0x02, data.packet, Buffer.alloc(1, 0));
                resolve(result === 0);
            });

            if (fs.existsSync(filePath)) {
                const hash = crypto.createHash('md5');
                const inputStream = fs.createReadStream(filePath);
                inputStream.on('data', (data) => {
                    hash.update(data);
                });
                inputStream.on('end', () => {
                    const md5HexStr = hash.digest('hex');
                    const filename = path.basename(filePath);
                    const fileLength = fs.statSync(filePath).size;
                    const chunks = Math.ceil(fileLength / sizePerChunk);

                    const filenameBuffer = renderName ? stringToBuffer(renderName) : stringToBuffer(filename);
                    const fileLengthBuffer = Buffer.alloc(4, 0);
                    writeUint32(fileLengthBuffer, 0, fileLength);
                    const md5Buffer = stringToBuffer(md5HexStr);
                    const chunksBuffer = Buffer.alloc(2, 0);
                    writeUint16(chunksBuffer, 0, chunks);

                    const buffer = Buffer.concat([filenameBuffer, fileLengthBuffer, chunksBuffer, md5Buffer]);
                    this.send(0xb0, 0x00, PeerId.SCREEN, buffer).catch(err => {
                        reject(err);
                    });
                });
            } else {
                reject(new Error(`can not upload missing file: ${filePath}`));
            }
        });
    }

    /**
     * Upload large file.
     *
     * - 0xb0 0x10: Start upload file request
     * - 0xb0 0x11: Send file chuck
     * - 0xb0 0x02: Upload finished (from controller)
     *
     * TODO: need option: chuckSize
     * TODO: need option: peerId
     */
    public async uploadFileCompressed(filePath: string, options?: CompressUploadFileOptions): Promise<boolean> {
        if (!fs.existsSync(filePath)) {
            this.log.error(`File does not exist ${filePath}`);
            return false;
        }

        if (options?.onCompressing) {
            options.onCompressing();
        }

        // Prepare compresssed data
        let compressedData;
        try {
            compressedData = await new Promise<Buffer>((resolve, reject) => {
                const readStream = fs.createReadStream(filePath);
                let fileData = Buffer.alloc(0);

                readStream.on('data', (chunk: Buffer) => {
                    fileData = Buffer.concat([fileData, chunk]);
                });

                readStream.on('end', () => {
                    zlib.deflate(fileData, { level: zlib.constants.Z_BEST_SPEED }, (err, buffer) => {
                        if (err) {
                            reject(new Error(`Unable to compress target file: ${filePath}`));
                            return;
                        }

                        resolve(buffer);
                    });
                });

                readStream.once('error', () => {
                    reject(new Error(`Unable to read target file: ${filePath}`));
                    // result = 0, means resource unable to use
                    // const buffer = Buffer.alloc(1, 9);
                    // this.ack(0xb0, 0x11, data.packet, buffer);
                });
            });
        } catch (e) {
            this.log.error(e);
            return false;
        }

        const uploadInfo = {
            totalChucks: 0,
            currentIndex: 0,
            progress: 0,
        };

        // const sizePerChunk = 968;
        const sizePerChunk = 960;
        this.setHandler(0xb0, 0x11, (data) => {
            // md5
            const { nextOffset, result: md5HexStr } = readString(data.param);

            // index
            const index = readUint32(data.param, nextOffset);

            // Log so we can see file transfer process
            if (index % 50 === 0) {
                this.log.info(`request file chuck index = ${index}`);
            }
            uploadInfo.currentIndex = index;

            // report progress
            if (index + 1 === uploadInfo.totalChucks) {
                // final chunk, assume that we are starting decompressing (on the controller end)
                if (options?.onDecompressing) {
                    options.onDecompressing();
                }
            } else {
                // still uploading, progress precises to 0.1 for better performance
                const progress = (index + 1) / uploadInfo.totalChucks;
                if (Math.ceil(progress * 1000) > Math.ceil(uploadInfo.progress * 1000)) {
                    uploadInfo.progress = progress;

                    if (options?.onProgress) {
                        options.onProgress(progress);
                    }
                }
            }

            // sending file
            const start = sizePerChunk * index;
            const end = sizePerChunk * (index + 1);

            const finalBuf = compressedData.slice(start, end);
            // md5
            const md5Buffer = stringToBuffer(md5HexStr);

            // index
            const indexBuffer = Buffer.alloc(4, 0);
            writeUint32(indexBuffer, 0, index);

            // chuck
            const chunkBuffer = stringToBuffer(finalBuf as unknown as string);

            const responseBuffer = Buffer.concat([
                Buffer.alloc(1, 0), // 0: success
                md5Buffer,
                indexBuffer,
                chunkBuffer,
            ]);

            this.ack(0xb0, 0x11, data.packet, responseBuffer);
        });

        return new Promise<boolean>((resolve, reject) => {
            // handle file upload result
            this.setHandler(0xb0, 0x02, (data) => {
                const result = readUint8(data.param);
                if (result === 0) {
                    this.log.info('File upload successful.');
                } else {
                    this.log.error(`File upload failed, result = ${result}`);
                    if (options.onFailed) {
                        switch (result) {
                            case 12:
                                options.onFailed('SD card unavailable.');
                                break;
                            default:
                                options.onFailed('Failed to validate file.');
                                break;
                        }
                    }
                }
                this.ack(0xb0, 0x02, data.packet, Buffer.alloc(1, 0));

                resolve(result === 0);
            });

            // Start a file transfer request
            const hash = crypto.createHash('md5');
            hash.update(compressedData);

            // file name
            const filename = path.basename(filePath);
            const filenameBuffer = options?.renderName ? stringToBuffer(options.renderName) : stringToBuffer(filename);

            // file length
            const fileLengthBuffer = Buffer.alloc(4, 0);
            const fileLength = fs.statSync(filePath).size;
            writeUint32(fileLengthBuffer, 0, fileLength);

            // number of chucks
            const chunksBuffer = Buffer.alloc(4, 0);
            const chunks = Math.ceil(compressedData.byteLength / sizePerChunk);
            writeUint32(chunksBuffer, 0, chunks);
            uploadInfo.totalChucks = chunks;

            // md5
            const md5HexStr = hash.digest('hex');
            const md5Buffer = stringToBuffer(md5HexStr);

            const buffer = Buffer.concat([
                filenameBuffer,
                fileLengthBuffer,
                chunksBuffer,
                md5Buffer,
            ]);
            this.log.info(`Start file transfer... file size = ${fileLength}, chuck count = ${chunks}`);
            this.send(0xb0, 0x10, PeerId.CONTROLLER, buffer)
                .then(({ response }) => {
                    if (response.result !== 0) {
                        this.log.info(`Start file transfer failed, result = ${response.result}`);

                        if (options.onFailed) {
                            switch (response.result) {
                                case 12:
                                    options.onFailed('SD card unavailable.');
                                    break;
                                default:
                                    options.onFailed('Failed to start file uploading.');
                                    break;
                            }
                        }
                        resolve(false);
                    }
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    public startPrintSerial(filePath: string, callback?: (printInfo) => void) {
        const content: string[] = [];
        let elapsedTime = 0;
        const rl = readline(filePath);
        rl.on('line', (line: string) => {
            line[0] !== ';' && content.push(`${line}\n`);
            if (includes(line, ';estimated_time(s)')) {
                elapsedTime = parseFloat(line.slice(19));
            }
        }).on('error', (e) => {
            this.log.error(e);
        });
        this.setHandler(0xac, 0x02, async ({ param, packet }: RequestData) => {
            const batchBufferInfo = new BatchBufferInfo().fromBuffer(param);
            // const content = await readGcodeFileByLines(filePath);
            let result = 0;
            const printBatchGcode = new PrintBatchGcode(batchBufferInfo.lineNumber, batchBufferInfo.lineNumber, content[batchBufferInfo.lineNumber]);
            if (batchBufferInfo.lineNumber === content.length - 1) {
                result = 201;
            }
            const res = new Response(result, printBatchGcode.toBuffer());
            this.ack(0xac, 0x02, packet, res.toBuffer());
            callback && callback({ lineNumber: batchBufferInfo.lineNumber, length: content.length, elapsedTime });
        });
        this.setHandler(0xac, 0x01, (request: RequestData) => {
            this.ack(0xac, 0x01, request.packet, Buffer.alloc(1, 0));
        });
    }

    // TODO
    public async setHotBedTemperature(key: number, zoneIndex: number, temperature: number) {
        const buffer = Buffer.alloc(4, 0);
        writeUint8(buffer, 0, key);
        writeUint8(buffer, 1, zoneIndex);
        writeInt16(buffer, 2, temperature);
        return this.send(0x14, 0x02, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            // const hotBedInfo = new GetHotBed().fromBuffer(response.data);
            return { response, packet, data: {} };
        });
    }

    public async subscribeCncSpeedState({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x11, 0xa0, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async subscribeLaserPowerState({ interval = 1000 }, callback: ResponseCallback) {
        return this.subscribe(0x12, 0xa1, interval, callback).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async setCncPower(key: number, targetPower: number) {
        const buffer = Buffer.alloc(2, 0);
        writeUint8(buffer, 0, key);
        writeUint8(buffer, 1, targetPower);
        return this.send(0x11, 0x02, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async setToolHeadSpeed(key: number, targetSpeed: number) {
        const buffer = Buffer.alloc(5, 0);
        writeUint8(buffer, 0, key);
        writeUint32(buffer, 1, targetSpeed);
        return this.send(0x11, 0x03, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async switchCNC(key: number, status: boolean) {
        const buffer = Buffer.alloc(2, 0);
        writeUint8(buffer, 0, key);
        writeBool(buffer, 1, status ? 1 : 0);
        return this.send(0x11, 0x05, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }


    public async setWorkSpeed(key: number, extruderIndex: number, targetSpeed: number) {
        const buffer = Buffer.alloc(4, 0);
        writeUint8(buffer, 0, key);
        writeUint8(buffer, 1, extruderIndex);
        writeInt16(buffer, 2, targetSpeed);
        return this.send(0xac, 0x0e, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async getWorkSpeed(key: number) {
        const buffer = Buffer.alloc(1, 0);
        writeUint8(buffer, 0, key);
        return this.send(0xac, 0x0f, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    public async wifiConnection(hostName: string, clientName: string, token: string, callback: () => void) {
        const info = new WifiConnectionInfo(hostName, clientName, token).toBuffer();
        this.setHandler(0x01, 0x06, ({ packet }: RequestData) => {
            const res = new Response(0);
            this.ack(0x01, 0x06, packet, res.toBuffer());
            callback && callback();
        });
        return this.send(0x01, 0x05, PeerId.SCREEN, info, false).then(({ response, packet }) => {
            // return res;
            return { response, packet };
        });
    }

    public async wifiConnectionHeartBeat() {
        return this.send(0xb0, 0x0b, PeerId.SCREEN, Buffer.alloc(0)).then(({ response, packet }) => {
            return { response, packet };
        });
    }

    public async wifiConnectionClose() {
        return this.send(0x01, 0x06, PeerId.SCREEN, Buffer.alloc(0)).then(({ response, packet }) => {
            this.log.info('close response');
            return { response, packet };
        });
    }

    public async getEnclousreInfo(key: number) {
        const buffer = Buffer.alloc(1, key);
        const { response, packet } = await this.send(0x15, 0x01, PeerId.CONTROLLER, buffer);

        this.log.info(`Get enclosure info, result = ${response.result}`);
        if (response.result === 0) {
            const enclosureInfo = new EnclosureInfo();
            enclosureInfo.fromBuffer(response.data);
            return { response, packet, data: enclosureInfo };
        } else {
            return { response, packet };
        }
    }

    public async setEnclosureLight(key: number, value: number) {
        const buffer = Buffer.alloc(2);
        writeUint8(buffer, 0, key);
        writeUint8(buffer, 1, value);
        const { response, packet } = await this.send(0x15, 0x02, PeerId.CONTROLLER, buffer);
        this.log.info(`Set enclosure light indensity: ${response.result}`);
        return { response, packet };
    }

    public async setEnclosureDoorEnabled(key: number, headTypeKey: number, value: boolean) {
        const buffer = Buffer.alloc(3);
        writeUint8(buffer, 0, key);
        writeInt8(buffer, 1, headTypeKey);
        writeBool(buffer, 2, value ? 1 : 0);
        return this.send(0x15, 0x03, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            this.log.info(`set Enclosure door enabled: ${response.result}`);
            return { response, packet };
        });
    }

    public async setEnclosureFan(key: number, value: number) {
        const buffer = Buffer.alloc(2);
        writeUint8(buffer, 0, key);
        writeUint8(buffer, 1, value);
        const { response, packet } = await this.send(0x15, 0x04, PeerId.CONTROLLER, buffer);
        this.log.info(`Set enclosure fan strength to ${value}, result = ${response.result}`);
        return { response, packet };
    }

    public async getAirPurifierInfo(key: number) {
        const buffer = Buffer.alloc(1, key);
        const { response, packet } = await this.send(0x17, 0x01, PeerId.CONTROLLER, buffer);

        this.log.info(`Get air purifier info, result = ${response.result}`);
        if (response.result === 0) {
            const airPurifierInfo = new AirPurifierInfo();
            airPurifierInfo.fromBuffer(response.data);
            return { response, packet, data: airPurifierInfo };
        } else {
            return { response, packet };
        }
    }

    public async setPurifierSpeed(key, speed) {
        const buffer = Buffer.alloc(2);
        writeUint8(buffer, 0, key);
        writeUint8(buffer, 1, speed);
        return this.send(0x17, 0x02, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet };
        });
    }

    public async setPurifierSwitch(key, value) {
        const buffer = Buffer.alloc(2);
        writeUint8(buffer, 0, key);
        writeBool(buffer, 1, value ? 1 : 0);
        return this.send(0x17, 0x03, PeerId.CONTROLLER, buffer).then(({ response, packet }) => {
            return { response, packet, data: {} };
        });
    }

    // - System

    public async upgradeFirmwareFromFile(filename: string) {
        return new Promise<ResponseData>((resolve, reject) => {
            // Watch upgrade preparation result
            this.setHandler(0xad, 0x03, (data) => {
                const upgradeCode = readUint8(data.param);

                // ACK
                this.ack(0xad, 0x03, data.packet, Buffer.alloc(1, 0));

                // code = 0 means preparation is done
                // code != 0 means preparation is blocked (something wrong with firmware file)
                if (upgradeCode !== 0) {
                    resolve({
                        response: {
                            result: upgradeCode,
                        }
                    } as ResponseData);
                }
            });

            // Watch upgrade result
            this.setHandler(0xad, 0x10, (data) => {
                const upgradeCode = readUint8(data.param);

                this.ack(0xad, 0x10, data.packet, Buffer.alloc(1, 0));

                // code = 0 means ugprade success
                // code != 0 means upgrade failed
                resolve({
                    response: {
                        result: upgradeCode,
                    }
                } as ResponseData);
            });

            // Request upgrade
            const resourceBuffer = Buffer.alloc(1, 0); // defaults to SD Card
            const filenameBuffer = stringToBuffer(filename);
            const buffer = Buffer.concat([resourceBuffer, filenameBuffer]);
            this.send(0xad, 0x00, PeerId.CONTROLLER, buffer)
                .catch((err) => reject(err));
        });
    }
}
