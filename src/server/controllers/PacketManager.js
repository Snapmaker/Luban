import fs from 'fs';

import logger from '../lib/logger';

import {
    GCODE_REQUEST_EVENT_ID,
    // GCODE_RESPONSE_EVENT_ID,
    PRINT_GCODE_REQUEST_EVENT_ID,
    // PRINT_GCODE_RESPONSE_EVENT_ID,
    FILE_OPERATION_REQUEST_EVENT_ID,
    // FILE_OPERATION_RESPONSE_EVENT_ID,
    STATUS_SYNC_REQUEST_EVENT_ID,
    // STATUS_RESPONSE_EVENT_ID,
    SETTINGS_REQUEST_EVENT_ID,
    // SETTINGS_RESPONSE_EVENT_ID,
    MOVEMENT_REQUEST_EVENT_ID,
    // MOVEMENT_RESPONSE_EVENT_ID,
    // LASER_CAMERA_OPERATION_REQUEST_EVENT_ID,
    // LASER_CAMERA_OPERATION_RESPONSE_EVENT_ID
    UPDATE_REQUEST_EVENT_ID
} from './constants';

/*
const GCODE_REQUEST_EVENT_ID = 0x01;
const GCODE_RESPONSE_EVENT_ID = 0x02;
const PRINT_GCODE_REQUEST_EVENT_ID = 0x03;
const PRINT_GCODE_RESPONSE_EVENT_ID = 0x04;
const FILE_OPERATION_REQUEST_EVENT_ID = 0x05;
const FILE_OPERATION_RESPONSE_EVENT_ID = 0x06;
const STATUS_SYNC_REQUEST_EVENT_ID = 0x07;
const STATUS_RESPONSE_EVENT_ID = 0x08;
const SETTINGS_REQUEST_EVENT_ID = 0x09;
const SETTINGS_RESPONSE_EVENT_ID = 0x0a;
const MOVEMENT_REQUEST_EVENT_ID = 0x0b;
const MOVEMENT_RESPONSE_EVENT_ID = 0x0c;
const LASER_CAMERA_OPERATION_REQUEST_EVENT_ID = 0x0d;
const LASER_CAMERA_OPERATION_RESPONSE_EVENT_ID = 0x0e;
const UPDATE_REQUEST_EVENT_ID = 0xa9;

saveCalibration
*/

function toByte(values, byteLength) {
    if (byteLength === 4) {
        // Uint8Array
        const result = new Int8Array(4 * values.length);
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            result[i * 4 + 0] = (value >> 24) & 0xff;
            result[i * 4 + 1] = (value >> 16) & 0xff;
            result[i * 4 + 2] = (value >> 8) & 0xff;
            result[i * 4 + 3] = value & 0xff;
        }
        return result;
    } else if (byteLength === 2) {
        const result = new Int8Array(2 * values.length);
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            result[i * 4 + 0] = (value >> 8) & 0xff;
            result[i * 4 + 1] = value & 0xff;
        }
        return result;
    } else {
        return null;
    }
}


/*
*/

function toValue(buffer, offset, byteLength) {
    if (byteLength === 4) {
        return (buffer[offset] << 24) + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + buffer[offset + 3];
    } else if (byteLength === 2) {
        return (buffer[offset] << 8) + buffer[offset + 1];
    } else {
        return null;
    }
}

const log = logger('controllers:PacketManager');

class PacketManager {
    constructor() {
        // this.metaData = new Uint8Array(9);
        this.metaData = new Uint8Array(8);
        this.marker = 0xaa55;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
        this.version = 0x00;
        this.checkSum = 0x0000;
        this.eventID = 0x00;
        this.index = 0x00000000;
        this.content = {};
        this.content.moduleID = null;
        this.updatePacket = null;
        this.updateCount = 0;
    }

    resetDefaultMetaData() {
        this.marker = 0xaa55;
        this.version = 0x00;
        this.checkSum = 0x0000;
        this.eventID = 0x00;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
    }

    buildPacket(eventID, content) {
        this.resetDefaultMetaData();
        this.setEventID(eventID);
        // return this.pack(content);
        return this.packWithoutIndex(content);
    }

    packFeeder(content) {
        let contentBuffer = null;
        if (Buffer.isBuffer(content)) {
            contentBuffer = content;
            this.setContent(content);
        } else {
            this.setContent(content.replace(/[\n\r]/g, ''));
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }
        this.setEventID(0x01);
        const eventIDBuffer = Buffer.from([this.eventID], 'utf-8');
        // send 1 line gcode
        this.index = 0;
        const index = new Uint8Array(4);
        index[0] = (this.index >> 24) & 0xff;
        index[1] = (this.index >> 16) & 0xff;
        index[2] = (this.index >> 8) & 0xff;
        index[3] = this.index & 0xff;
        const indexBuffer = Buffer.from(index, 'utf-8');

        const dataLength = eventIDBuffer.length + indexBuffer.length + contentBuffer.length;
        const dataBuffer = Buffer.concat([eventIDBuffer, indexBuffer, contentBuffer], dataLength);
        this.length = dataLength;

        this.lengthVerify = (this.length >> 8) ^ (this.length & 0xff);
        this.checkSum = this.calculateCheckSum(dataBuffer);

        this.metaData[0] = (this.marker >> 8) & 0xff;
        this.metaData[1] = this.marker & 0xff;
        this.metaData[4] = this.version;

        this.metaData[2] = (this.length >> 8) & 0xff;
        this.metaData[3] = this.length & 0xff;
        this.metaData[5] = this.lengthVerify;
        this.metaData[6] = (this.checkSum >> 8) & 0xff;
        this.metaData[7] = this.checkSum & 0xff;

        const metaBuffer = Buffer.from(this.metaData, 'utf-8');
        const buffer = Buffer.concat([metaBuffer, dataBuffer], metaBuffer.length + dataBuffer.length);
        return buffer;
    }

    packSender(content, lineNumber) {
        this.setEventID(0x03);
        const eventIDBuffer = Buffer.from([this.eventID], 'utf-8');
        // TODO adding non-zero lineNumber can not pass checksum
        this.index = lineNumber;
        // this.index = 0;
        const index = new Uint8Array(4);
        index[0] = (this.index >> 24) & 0xff;
        index[1] = (this.index >> 16) & 0xff;
        index[2] = (this.index >> 8) & 0xff;
        index[3] = this.index & 0xff;
        const indexBuffer = Buffer.from(index, 'utf-8');

        let contentBuffer = null;
        if (Buffer.isBuffer(content)) {
            contentBuffer = content;
            this.setContent(content);
        } else {
            this.setContent(content.replace(/[\n\r]/g, ''));
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }

        const dataLength = eventIDBuffer.length + indexBuffer.length + contentBuffer.length;
        const dataBuffer = Buffer.concat([eventIDBuffer, indexBuffer, contentBuffer], dataLength);
        this.length = dataLength;

        this.lengthVerify = (this.length >> 8) ^ (this.length & 0xff);
        this.checkSum = this.calculateCheckSum(dataBuffer);

        this.metaData[0] = this.marker >> 8;
        this.metaData[1] = this.marker & 0xff;
        this.metaData[4] = this.version;

        this.metaData[2] = (this.length >> 8) & 0xff;
        this.metaData[3] = this.length & 0xff;
        this.metaData[5] = this.lengthVerify;
        this.metaData[6] = (this.checkSum >> 8) & 0xff;
        this.metaData[7] = this.checkSum & 0xff;

        const metaBuffer = Buffer.from(this.metaData, 'utf-8');
        const buffer = Buffer.concat([metaBuffer, dataBuffer], metaBuffer.length + dataBuffer.length);
        return buffer;
    }

    packWithoutIndex(content) {
        let contentBuffer = null;
        if (Buffer.isBuffer(content)) {
            contentBuffer = content;
            this.setContent(content);
        } else {
            // TODO
            // this.setContent(content);
            this.setContent(content.replace(/[\n\r]/g, ''));
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }
        // this.setEventID(eventID);
        const eventIDBuffer = Buffer.from([this.eventID], 'utf-8');

        const dataLength = eventIDBuffer.length + contentBuffer.length;
        const dataBuffer = Buffer.concat([eventIDBuffer, contentBuffer], dataLength);
        this.length = dataLength;

        this.lengthVerify = (this.length >> 8) ^ (this.length & 0xff);
        this.checkSum = this.calculateCheckSum(dataBuffer);

        this.metaData[0] = this.marker >> 8;
        this.metaData[1] = this.marker & 0xff;
        this.metaData[4] = this.version;

        this.metaData[2] = this.length >> 8;
        this.metaData[3] = this.length & 0xff;
        this.metaData[5] = this.lengthVerify;
        this.metaData[6] = this.checkSum >> 8;
        this.metaData[7] = this.checkSum & 0xff;

        const metaBuffer = Buffer.from(this.metaData, 'utf-8');
        const buffer = Buffer.concat([metaBuffer, dataBuffer], metaBuffer.length + dataBuffer.length);
        return buffer;
    }

    unpack(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            return buffer;
        }
        this.eventID = buffer[0];
        const subEventID = buffer[1];
        let packetIndex = 0;
        switch (this.eventID) {
            case 0x02:
                this.content = buffer.slice(1).toString();
                break;
            case 0x04:
                // TODO
                this.content = 'ok';
                break;
            case 0x06:
                // TODO
                this.content = 'ok';
                break;
            case 0x08:
                switch (subEventID) {
                    case 0x01:
                        this.content = { pos: {}, temperature: {} };
                        this.content.pos.x = String(toValue(buffer, 2, 4) / 1000);
                        this.content.pos.y = String(toValue(buffer, 6, 4) / 1000);
                        this.content.pos.z = String(toValue(buffer, 10, 4) / 1000);
                        this.content.pos.e = String(toValue(buffer, 14, 4) / 1000);
                        this.content.temperature.b = String(toValue(buffer, 18, 2));
                        this.content.temperature.bTarget = String(toValue(buffer, 20, 2));
                        this.content.temperature.t = String(toValue(buffer, 22, 2));
                        this.content.temperature.tTarget = String(toValue(buffer, 24, 2));
                        this.content.feedRate = toValue(buffer, 26, 2);
                        this.content.headPower = toValue(buffer, 28, 4) / 1000;
                        this.content.spindleSpeed = toValue(buffer, 32, 4);
                        this.content.printState = buffer[36];
                        this.content.outerEquip = buffer[37];
                        this.content.headTypeID = buffer[38];
                        switch (this.content.headTypeID) {
                            case 1:
                                this.content.headType = '3DP';
                                break;
                            case 2:
                                this.content.headType = 'CNC';
                                break;
                            case 3:
                                this.content.headType = 'LASER';
                                break;
                            default:
                                this.content.headType = 'UNKNOWN';
                                break;
                        }
                        break;
                    case 0x02:
                        this.content = toValue(buffer, 2, 4);
                        break;
                    case 0x03:
                        this.content = 'start';
                        break;
                    case 0x04:
                        if (buffer[2] === 0x00) {
                            this.content = 'pause succeed';
                        } else {
                            this.content = 'pause fail';
                        }
                        break;
                    case 0x05:
                        if (buffer[2] === 0x00) {
                            this.content = 'resume succeed';
                        } else {
                            this.content = 'resume fail';
                        }
                        break;
                    case 0x06:
                        if (buffer[2] === 0x00) {
                            this.content = 'stop succeed';
                        } else {
                            this.content = 'stop fail';
                        }
                        break;
                    case 0x07:
                        if (buffer[2] === 0x00) {
                            this.content = 'finish succeed';
                        } else {
                            this.content = 'finish fail';
                        }
                        break;
                    case 0x0e:
                        this.content = { isHomed: false, originOffset: {} };
                        this.content.isHomed = !buffer[2];
                        // this.content.isAligned = !buffer[3];
                        // this.content.coordinateID = buffer[4];
                        this.content.originOffset.x = toValue(buffer, 5, 4) / 1000;
                        this.content.originOffset.y = toValue(buffer, 9, 4) / 1000;
                        this.content.originOffset.z = toValue(buffer, 13, 4) / 1000;
                        break;
                    default:
                        this.content = 'ok';
                        break;
                }
                break;
            case 0x09:
                // TODO
                this.content = 'ok';
                break;
            case 0x0a:
                switch (subEventID) {
                    case 0x01:
                        this.content = buffer[2];
                        break;
                    case 0x02:
                        // calibration finished
                        this.content = 'ok';
                        break;
                    case 0x03:
                        // calibration go to point i ok
                        this.content = 'ok';
                        break;
                    case 0x04:
                        // manual calibration finished
                        this.content = 'ok';
                        break;
                    case 0x05:
                        // calibration point i offset ok
                        this.content = 'ok';
                        break;
                    case 0x06:
                        // calibration Z offset ok
                        this.content = 'ok';
                        break;
                    case 0x07:
                        // calibration saved
                        this.content = 'ok';
                        break;
                    case 0x08:
                        // exit calibration
                        this.content = 'ok';
                        break;
                    case 0x09:
                        // reset calibration
                        this.content = 'ok';
                        break;
                    case 0x0a:
                        // this.content = (buffer[1] << 24) + (buffer[2] << 16) + (buffer[3] << 8) + buffer[4];
                        // const content2 = toValue(buffer, 1, 4);
                        this.content.zFocus = toValue(buffer, 2, 4);
                        break;
                    case 0x0b:
                        this.content = buffer[2];
                        break;
                    case 0x0c:
                        this.content = buffer[2];
                        break;
                    case 0x0d:
                        this.content = buffer[2];
                        break;
                    case 0x14:
                        this.content = {};
                        // outdated
                        /*
                        this.content.xSize = toValue(buffer, 3, 4) / 1000;
                        this.content.ySize = toValue(buffer, 7, 4) / 1000;
                        this.content.zSize = toValue(buffer, 11, 4) / 1000;
                        this.content.xHomeDirection = toValue(buffer, 15, 4) || -1;
                        this.content.yHomeDiretion = toValue(buffer, 19, 4) || -1;
                        this.content.zHomeDirection = toValue(buffer, 23, 4) || -1;
                        this.content.xMotorDirection = toValue(buffer, 27, 4) || -1;
                        this.content.yMotorDirection = toValue(buffer, 31, 4) || -1;
                        this.content.zMotorDirection = toValue(buffer, 35, 4) || -1;
                        this.content.xOffset = toValue(buffer, 39, 4) / 1000 || 0;
                        this.content.yOffset = toValue(buffer, 43, 4) / 1000 || 0;
                        this.content.zOffset = toValue(buffer, 47, 4) / 1000 || 0;
                        */
                        this.content.machineSizeType = buffer[3];
                        this.content.xSize = toValue(buffer, 4, 4) / 1000;
                        this.content.ySize = toValue(buffer, 8, 4) / 1000;
                        this.content.zSize = toValue(buffer, 12, 4) / 1000;
                        this.content.xHomeDirection = toValue(buffer, 16, 4) || -1;
                        this.content.yHomeDiretion = toValue(buffer, 20, 4) || -1;
                        this.content.zHomeDirection = toValue(buffer, 24, 4) || -1;
                        this.content.xMotorDirection = toValue(buffer, 28, 4) || -1;
                        this.content.yMotorDirection = toValue(buffer, 32, 4) || -1;
                        this.content.zMotorDirection = toValue(buffer, 36, 4) || -1;
                        this.content.xOffset = toValue(buffer, 40, 4) / 1000 || 0;
                        this.content.yOffset = toValue(buffer, 44, 4) / 1000 || 0;
                        this.content.zOffset = toValue(buffer, 48, 4) / 1000 || 0;
                        break;
                    default:
                        this.content = 'ok';
                        break;
                }
                break;
            case 0x0c:
                // TODO
                this.content = 'ok';
                break;
            case 0x0e:
                // TODO
                this.content = 'ok';
                break;
            case 0x11:
                // TODO
                this.content = 'ok';
                break;
            case 0xaa:
                // TODO update firmware
                switch (subEventID) {
                    case 0x00:
                        this.content = 'ok';
                        break;
                    case 0x01:
                        packetIndex = (buffer[2] << 8) + buffer[3];
                        this.content = packetIndex;
                        break;
                    case 0x02:
                        this.content = buffer[2];
                        break;
                    case 0x03:
                        this.content = String(buffer.slice(2));
                        break;
                    case 0x07:
                        this.content.moduleID = toValue(buffer, 2, 4);
                        this.content.moduleVersion = String(buffer.slice(6));
                        break;
                    default:
                        this.content = 'ok';
                        break;
                }
                break;
            default:
                // this.content = buffer;
                this.content = 'ok';
                break;
        }

        // const bufferLength = buffer.length;
        // const contentBuffer = buffer.slice(9, bufferLength);
        // this.content = contentBuffer.toString();
        return this.content;
    }

    setEventID(eventID) {
        this.eventID = eventID;
    }

    setContent(content) {
        this.content = content;
    }

    // calculateCheckSum(hasIndex) {
    calculateCheckSum(dataBuffer) {
        let sum = 0;
        for (let i = 0; i < dataBuffer.length - 1; i += 2) {
            sum += ((dataBuffer[i] & 0xff) << 8) + (dataBuffer[i + 1] & 0xff);
        }
        if ((dataBuffer.length & 1) > 0) {
            sum += (dataBuffer[dataBuffer.length - 1] & 0xff);
        }
        while ((sum >> 16) > 0) {
            sum = (sum & 0xffff) + (sum >> 16);
        }
        return ((~sum) & 0xffff);
    }

    gcodeRequest(gcode) {
        return this.buildPacket(GCODE_REQUEST_EVENT_ID, gcode);
    }

    printGcodeRequest(gcode) {
        return this.buildPacket(PRINT_GCODE_REQUEST_EVENT_ID, gcode);
    }

    fileOperationRequestMount() {
        const content = new Uint8Array(1);
        content[0] = 0x00;
        return this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, Buffer.from([0x00]));
    }

    fileOperationRequestGetFiles(rewind) {
        if (rewind) {
            return this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, Buffer.from([0x04, 0x01]));
        } else {
            return this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, Buffer.from([0x04, 0x00]));
        }
    }

    fileOperationRequestPrintFile(filename) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x06;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const filenameBuffer = Buffer.from(filename, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, filenameBuffer], operationBuffer.length + filenameBuffer.length);
        return this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, contentBuffer);
    }

    statusRequestMachineStatus() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x01]));
    }

    statusRequestMachineAbnormalStatus() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x02]));
    }

    statusRequestMachineStartPrint() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x03]));
    }

    statusRequestMachinePausePrint() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x04]));
    }

    statusRequestMachineResumePrint() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x05]));
    }

    statusRequestMachineStopPrint() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x06]));
    }

    statusRequestMachineFinishPrint() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    statusRequestLineNumber() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x08]));
    }

    statusRequestPrintProgress() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x09]));
    }

    statusRequestResetErrorFlag() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }

    statusRequestResumePrintLocal() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0b]));
    }

    statusRequestResumePrintUSB() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0c]));
    }

    statusRequestCoordinateSystem() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0e]));
    }

    statusSyncMachineStatus(x, y, z, e) {
        const subEventID = new Uint8Array(1);
        subEventID[0] = 0x01;
        const subEventBuffer = Buffer.from(subEventID, 'utf-8');
        const pos = toByte([x * 1000, y * 1000, z * 1000, e * 1000], 4);
        const posBuffer = Buffer.from(pos, 'utf-8');
        const contentBuffer = Buffer.concat([subEventBuffer, posBuffer], subEventBuffer.length + posBuffer.length);
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, contentBuffer);
    }

    startAutoCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x02]));
    }

    startManualCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x04]));
    }

    gotoCalibrationPoint(point) {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x05, (point & 0xff)]));
    }

    changeCalibrationZOffset(offset) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x06;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const offsetArray = toByte([offset * 1000], 4);
        const offsetBuffer = Buffer.from(offsetArray, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, offsetBuffer], operationBuffer.length + offsetBuffer.length);
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, contentBuffer);
    }

    saveCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    getLaserFocus() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }

    setLaserFocus(focusHeigh) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x0b;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const sizeArray = toByte([focusHeigh * 1000], 4);
        const sizeBuffer = Buffer.from(sizeArray, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, sizeBuffer], operationBuffer.length + sizeBuffer.length);
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from(contentBuffer));
    }

    drawCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x0c]));
    }

    drawRuler() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x0e]));
    }

    enterSetFocus(laserState) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x0c;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const { txtFocusZ, txtFocusX, txtFocusY } = laserState;
        const sizeArray = toByte([txtFocusX * 1000, txtFocusY * 1000, txtFocusZ * 1000], 4);
        const sizeBuffer = Buffer.from(sizeArray, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, sizeBuffer], operationBuffer.length + sizeBuffer.length);
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from(contentBuffer));
    }

    laserMoveRequire(laserState) {
        const { txtMovementZ, txtMovementX, txtMovementY, relativeMode } = laserState;
        const operationID = new Uint8Array(1);
        if (relativeMode) {
            operationID[0] = 0x03;
        } else {
            operationID[0] = 0x02;
        }
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const sizeArray = toByte([txtMovementX * 1000, txtMovementY * 1000, txtMovementZ * 1000], 4);
        const sizeBuffer = Buffer.from(sizeArray, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, sizeBuffer], operationBuffer.length + sizeBuffer.length);
        return this.buildPacket(MOVEMENT_REQUEST_EVENT_ID, Buffer.from(contentBuffer));
    }

    getMachineSetting() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x14]));
    }

    setMachineSetting(machineSetting) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x01;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const { xOffset, yOffset, zOffset,
            xSize, ySize, zSize,
            xMotorDirection, yMotorDirection, zMotorDirection,
            xHomeDirection, yHomeDirection, zHomeDirection
        } = machineSetting;
        const sizeArray = toByte([xSize * 1000, ySize * 1000, zSize * 1000], 4);
        const offsetArray = toByte([xOffset * 1000, yOffset * 1000, zOffset * 1000], 4);
        const directionArray = toByte([xHomeDirection, yHomeDirection, zHomeDirection, xMotorDirection, yMotorDirection, zMotorDirection], 4);
        const sizeBuffer = Buffer.from(sizeArray, 'utf-8');
        const offsetBuffer = Buffer.from(offsetArray, 'utf-8');
        const directionBuffer = Buffer.from(directionArray, 'utf-8');
        const contentBuffer = Buffer.concat(
            [operationBuffer, sizeBuffer, directionBuffer, offsetBuffer],
            operationBuffer.length + sizeBuffer.length + offsetBuffer.length + directionBuffer.length
        );
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from(contentBuffer));
    }

    setLightMode(lightMode) {
        if (lightMode === 'status') {
            return this.buildPacket(MOVEMENT_REQUEST_EVENT_ID, Buffer.from([0x03, 0x00]));
        } else {
            return this.buildPacket(MOVEMENT_REQUEST_EVENT_ID, Buffer.from([0x03, 0x01]));
        }
    }

    setLightStatus(lightStatus) {
        if (lightStatus) {
            return this.buildPacket(MOVEMENT_REQUEST_EVENT_ID, Buffer.from([0x02, 0x01]));
        } else {
            return this.buildPacket(MOVEMENT_REQUEST_EVENT_ID, Buffer.from([0x02, 0x00]));
        }
    }

    exitCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x08]));
    }

    /*
    resetCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x09]));
    }
    */

    getLaserFocalLength() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }

    startUpdate() {
        return this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x00]));
    }

    requestUpdatePacket() {
        return this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x01]));
    }

    sendUpdatePacket(index) {
        const metaData = new Uint8Array(3);
        // operation ID
        metaData[0] = 0x01;
        // packet number
        metaData[1] = (index >> 8) & 0xff;
        metaData[2] = index & 0xff;
        const packetBuffer = this.getPacketByIndex(index);
        if (!packetBuffer) {
            // end update
            return this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x02]));
        }
        const metaBuffer = Buffer.from(metaData, 'utf-8');
        const contentBuffer = Buffer.concat([metaBuffer, packetBuffer], metaBuffer.length + packetBuffer.length);
        return this.buildPacket(UPDATE_REQUEST_EVENT_ID, contentBuffer);
    }

    queryFirmwareVersion() {
        return this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x03]));
    }

    queryUpdateStatus() {
        return this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x05]));
    }

    queryModuleVersion() {
        return this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    getLightStatus() {
        return this.buildPacket(MOVEMENT_REQUEST_EVENT_ID, Buffer.from([0x01]));
    }

    parseUpdateFile(filename) {
        // buffer: encoding -> null
        this.updatePacket = fs.readFileSync(filename, null);
        const length = this.updatePacket.length;
        this.updateCount = Math.floor(length / 512);
        if (length % 512) {
            this.updateCount += 1;
        }
    }

    parseOriginUpdateFile(filename, type) {
        // buffer: encoding -> null jt origin
        const originPacket = fs.readFileSync(filename, null);
        const originLength = originPacket.length;
        // const fileBuff = Buffer.alloc(originLength + 2048, 0);
        const fileBuff = Buffer.alloc(2048, 0);
        let index = 0;
        if (type === 'MainControl') {
            // fileBuff[index] = 0;
            fileBuff[index++] = 0;
        } else if (type === 'Module') {
            // fileBuff[index] = 1;
            fileBuff[index++] = 1;
        } else {
            // fileBuff[index] = 0;
            log.error('Not support the type');
        }
        fileBuff[index++] = (0 >> 8) & 0xff;
        fileBuff[index++] = 0 & 0xff;
        fileBuff[index++] = (20 >> 8) & 0xff;
        fileBuff[index++] = 20 & 0xff;
        const date = new Date();
        const bVersion = Buffer.from(`Snapmaker_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}${date.getMinutes()}`);
        const versionLen = bVersion.length >= 31 ? 31 : bVersion.length;
        bVersion.copy(fileBuff, index, 0, versionLen);
        index += versionLen;
        index = 40;
        fileBuff[index++] = originLength & 0xff;
        fileBuff[index++] = (originLength >> 8) & 0xff;
        fileBuff[index++] = (originLength >> 16) & 0xff;
        fileBuff[index++] = (originLength >> 24) & 0xff;
        index = 44;
        let checksum = 0;
        for (let j = 0; j < originLength; j++) {
            checksum += originPacket[j];
        }
        fileBuff[index++] = checksum & 0xff;
        fileBuff[index++] = (checksum >> 8) & 0xff;
        fileBuff[index++] = (checksum >> 16) & 0xff;
        fileBuff[index++] = (checksum >> 24) & 0xff;
        // force update,
        // TODO
        // let updateFlag = 0;
        // updateFlag |= 1;
        const updateFlag = 0;
        fileBuff[index++] = (updateFlag >> 24) & 0xff;
        fileBuff[index++] = (updateFlag >> 16) & 0xff;
        fileBuff[index++] = (updateFlag >> 8) & 0xff;
        fileBuff[index++] = (updateFlag) & 0xff;
        const totalLength = originLength + fileBuff.length;
        this.updatePacket = Buffer.concat([fileBuff, originPacket], totalLength);
        this.updateCount = Math.floor(totalLength / 512);
        if (totalLength % 512) {
            this.updateCount += 1;
        }
    }

    getPacketByIndex(index) {
        if (index >= this.updateCount) {
            return null;
        }
        const start = index * 512;
        const end = start + 512;
        return this.updatePacket.slice(start, end);
    }

    switchOff() {
        const exit = new Uint8Array(10);
        exit[0] = 0xaa;
        exit[1] = 0x55;
        exit[2] = 0x00;
        exit[3] = 0x02;
        exit[4] = 0x00;
        exit[5] = 0x02;
        exit[6] = 0xf6;
        exit[7] = 0xe7;
        exit[8] = 0x09;
        exit[9] = 0x18;
        return Buffer.from(exit, 'utf-8');
    }
}

export default PacketManager;
