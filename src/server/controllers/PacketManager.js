import {
    GCODE_REQUEST_EVENT_ID,
    // GCODE_RESPONSE_EVENT_ID,
    PRINT_GCODE_REQUEST_EVENT_ID,
    // PRINT_GCODE_RESPONSE_EVENT_ID,
    FILE_OPERATION_REQUEST_EVENT_ID,
    // FILE_OPERATION_RESPONSE_EVENT_ID,
    STATUS_SYNC_REQUEST_EVENT_ID,
    // STATUS_RESPONSE_EVENT_ID,
    SETTINGS_REQUEST_EVENT_ID
    // SETTINGS_RESPONSE_EVENT_ID,
    // MOVEMENT_REQUEST_EVENT_ID,
    // MOVEMENT_RESPONSE_EVENT_ID,
    // LASER_CAMERA_OPERATION_REQUEST_EVENT_ID,
    // LASER_CAMERA_OPERATION_RESPONSE_EVENT_ID
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
*/

function toByte(values) {
    const result = new Uint8Array(4 * values.length);
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        result[i * 4 + 0] = (value >> 24) & 0xff;
        result[i * 4 + 1] = (value >> 16) & 0xff;
        result[i * 4 + 2] = (value >> 8) & 0xff;
        result[i * 4 + 3] = value & 0xff;
    }
    return result;
}

function toValue(buffer, offset, byteLength) {
    if (byteLength === 4) {
        return (buffer[offset] << 24) + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + buffer[offset + 3];
    } else if (byteLength === 2) {
        return (buffer[offset] << 8) + buffer[offset + 1];
    } else {
        return -1;
    }
}

class PacketManager {
    constructor() {
        // this.metaData = new Uint8Array(9);
        this.metaData = new Uint8Array(8);
        this.marker = 0xaa55;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
        this.version = 0x00;
        this.checkSum = 0x0000;
        this.eventID = 0x01;
        this.index = 0x00000000;
        this.content = null;
    }

    resetDefaultMetaData() {
        this.marker = 0xaa55;
        this.version = 0x01;
        this.checkSum = 0x0000;
        this.eventID = 0x01;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
    }

    buildPacket(eventID, content) {
        this.resetDefaultMetaData();
        this.setEventID(eventID);
        // return this.pack(content);
        return this.packWithoutIndex(content);
    }

    pack(content) {
        // this.resetDefaultMetaData();
        let contentBuffer = null;
        if (Buffer.isBuffer(content)) {
            contentBuffer = content;
            // this.setContent(content.toString('utf-8'));
            this.setContent(content);
        } else {
            // TODO
            // this.setContent(content);
            this.setContent(content.replace(/[\n\r]/g, ''));
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }
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
        this.checkSum = this.calculateCheckSum();

        this.metaData[0] = this.marker >> 8;
        this.metaData[1] = this.marker & 0xff;
        this.metaData[4] = this.version;
        // this.metaData[8] = this.eventID;

        this.metaData[2] = this.length >> 8;
        this.metaData[3] = this.length & 0xff;
        this.metaData[5] = this.lengthVerify;
        this.metaData[6] = this.checkSum >> 8;
        this.metaData[7] = this.checkSum & 0xff;

        const metaBuffer = Buffer.from(this.metaData, 'utf-8');
        const buffer = Buffer.concat([metaBuffer, dataBuffer], metaBuffer.length + dataBuffer.length);
        return buffer;
    }

    packWithoutIndex(content) {
        // this.resetDefaultMetaData();
        let contentBuffer = null;
        if (Buffer.isBuffer(content)) {
            contentBuffer = content;
            // this.setContent(content.toString('utf-8'));
            this.setContent(content);
        } else {
            // TODO
            // this.setContent(content);
            this.setContent(content.replace(/[\n\r]/g, ''));
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }
        const eventIDBuffer = Buffer.from([this.eventID], 'utf-8');

        const dataLength = eventIDBuffer.length + contentBuffer.length;
        const dataBuffer = Buffer.concat([eventIDBuffer, contentBuffer], dataLength);
        this.length = dataLength;

        this.lengthVerify = (this.length >> 8) ^ (this.length & 0xff);
        this.checkSum = this.calculateCheckSum();

        this.metaData[0] = this.marker >> 8;
        this.metaData[1] = this.marker & 0xff;
        this.metaData[4] = this.version;
        // this.metaData[8] = this.eventID;

        this.metaData[2] = this.length >> 8;
        this.metaData[3] = this.length & 0xff;
        this.metaData[5] = this.lengthVerify;
        this.metaData[6] = this.checkSum >> 8;
        this.metaData[7] = this.checkSum & 0xff;

        const metaBuffer = Buffer.from(this.metaData, 'utf-8');
        const buffer = Buffer.concat([metaBuffer, dataBuffer], metaBuffer.length + dataBuffer.length);
        console.log('buffer', buffer);
        return buffer;
    }

    unpackBackup(buffer) {
        console.log('unpack data type = ', typeof buffer, Buffer.isBuffer(buffer));
        console.log('unpack data = ', buffer);

        if (!Buffer.isBuffer(buffer)) {
            return buffer;
        }

        this.marker = (buffer[0] << 8) + buffer[1];
        this.length = (buffer[2] << 8) + buffer[3];
        this.version = buffer[4];
        this.lengthVerify = buffer[5];
        this.checkSum = (buffer[6] << 8) + buffer[7];
        this.eventID = buffer[8];
        const bufferLength = buffer.length;
        const contentBuffer = buffer.slice(9, bufferLength);
        console.log('unpack contentBuffer = ', contentBuffer);
        this.content = contentBuffer.toString();
        console.log('this.', this);
        return this.content;
    }

    unpack(buffer) {
        console.log('unpack data = ', buffer.length, buffer);

        if (!Buffer.isBuffer(buffer)) {
            return buffer;
        }
        this.eventID = buffer[0];
        // const subEventID = buffer[0];
        const subEventID = buffer[1];

        switch (this.eventID) {
            case 0x02:
                this.content = buffer.slice(1).toString();
                console.log('xddccc ', this.content, buffer);
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
                        // TODO outdated
                        this.content = { x: 0, y: 0, z: 0, e: 0, bedTemp: 0, bedTargetTemp: 0, headTemp: 0, headTargetTemp: 0, feedRate: 0, laserPower: 0, spindleSpeed: 0, printState: 0, outerState: 0, headState: 0 };
                        this.content.x = (buffer[1] << 24) + (buffer[2] << 16) + (buffer[3] << 8) + buffer[4];
                        this.content.y = (buffer[5] << 24) + (buffer[6] << 16) + (buffer[7] << 8) + buffer[8];
                        this.content.z = (buffer[9] << 24) + (buffer[10] << 16) + (buffer[11] << 8) + buffer[12];
                        this.content.e = (buffer[13] << 24) + (buffer[14] << 16) + (buffer[15] << 8) + buffer[16];
                        this.content.bedTemp = (buffer[17] << 8) + buffer[18];
                        this.content.bedTargetTemp = (buffer[19] << 8) + buffer[20];
                        this.content.headTemp = (buffer[21] << 8) + buffer[22];
                        this.content.headTargetTemp = (buffer[23] << 8) + buffer[24];
                        this.content.feedRate = (buffer[25] << 8) + buffer[26];
                        this.content.laserPower = (buffer[27] << 24) + (buffer[28] << 16) + (buffer[29] << 8) + buffer[30];
                        this.content.spindleSpeed = (buffer[31] << 24) + (buffer[32] << 16) + (buffer[33] << 8) + buffer[34];
                        this.content.printState = buffer[35];
                        this.content.outerState = buffer[36];
                        this.content.headState = buffer[37];
                        break;
                    case 0x02:
                        this.content = (buffer[1] << 24) + (buffer[2] << 16) + (buffer[3] << 8) + buffer[4];
                        break;
                    default:
                        break;
                }
                break;
            case 0x0a:
                switch (subEventID) {
                    case 0x01:
                        this.content = buffer[2];
                        break;
                    case 0x02:
                        this.content = 'ok';
                        console.log('calibration finished.', buffer);
                        break;
                    case 0x03:
                        // this.content = buffer[2];
                        console.log('calibration goto point i ok.', buffer);
                        this.content = 'ok';
                        break;
                    case 0x04:
                        this.content = 'ok';
                        console.log('manual calibration finished.', buffer);
                        break;
                    case 0x05:
                        this.content = 'ok';
                        console.log('calibration point i offset ok.', buffer);
                        break;
                    case 0x06:
                        this.content = 'ok';
                        console.log('calibration Z offset ok.', buffer);
                        break;
                    case 0x07:
                        this.content = 'ok';
                        console.log('calibration saved.', buffer);
                        break;
                    case 0x08:
                        this.content = 'ok';
                        console.log('exit calibration', buffer);
                        break;
                    case 0x09:
                        this.content = 'ok';
                        console.log('reset calibration', buffer);
                        break;
                    case 0x0a:
                        // this.content = (buffer[1] << 24) + (buffer[2] << 16) + (buffer[3] << 8) + buffer[4];
                        //const content2 = toValue(buffer, 1, 4);
                        this.content = toValue(buffer, 2, 4);
                        console.log('ccc ', this.content);
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
                    default:
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
            default:
                this.content = 'ok';
                console.log('default console ok');
                break;
        }

        // const bufferLength = buffer.length;
        // const contentBuffer = buffer.slice(9, bufferLength);
        // console.log('unpack contentBuffer = ', contentBuffer);
        // this.content = contentBuffer.toString();
        // console.log('this pm = ', this);
        return this.content;
    }

    getMarker() {
        return this.marker;
    }

    getEventID() {
        return this.eventID;
    }

    getContent() {
        return this.content;
    }

    getVersion() {
        return this.version;
    }

    setMarker(marker) {
        this.marker = marker;
    }

    setEventID(eventID) {
        this.eventID = eventID;
    }

    setContent(content) {
        this.content = content;
    }

    setVersion(version) {
        this.version = version;
    }

    calculateCheckSumWithIndex() {
        let sum = 0;
        const eventIDBuffer = Buffer.from([this.eventID], 'utf-8');
        this.index = 0;
        const index = new Uint8Array(4);
        index[0] = (this.index >> 24) & 0xff;
        index[1] = (this.index >> 16) & 0xff;
        index[2] = (this.index >> 8) & 0xff;
        index[3] = this.index & 0xff;
        const indexBuffer = Buffer.from(index, 'utf-8');
        // const contentBuffer = Buffer.from(this.content, 'utf-8');
        let contentBuffer = null;
        if (Buffer.isBuffer(this.content)) {
            contentBuffer = this.content;
            // console.log('is B ', contentBuffer);
        } else {
            contentBuffer = Buffer.from(this.content, 'utf-8');
            // console.log('is not B ', contentBuffer);
        }
        const dataLength = eventIDBuffer.length + indexBuffer.length + contentBuffer.length;
        const dataBuffer = Buffer.concat([eventIDBuffer, indexBuffer, contentBuffer], dataLength);

        for (let i = 0; i < dataBuffer.length - 1; i += 2) {
            sum += ((dataBuffer[i] & 0xff) << 8) + (dataBuffer[i + 1] & 0xff);
        }
        if ((dataLength & 1) > 0) {
            sum += (dataBuffer[dataLength - 1] & 0xff);
        }
        while ((sum >> 16) > 0) {
            sum = (sum & 0xffff) + (sum >> 16);
        }
        return ((~sum) & 0xffff);
    }

    calculateCheckSum() {
        let sum = 0;
        const eventIDBuffer = Buffer.from([this.eventID], 'utf-8');
        let contentBuffer = null;
        if (Buffer.isBuffer(this.content)) {
            contentBuffer = this.content;
        } else {
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }
        const dataLength = eventIDBuffer.length + contentBuffer.length;
        const dataBuffer = Buffer.concat([eventIDBuffer, contentBuffer], dataLength);

        for (let i = 0; i < dataBuffer.length - 1; i += 2) {
            sum += ((dataBuffer[i] & 0xff) << 8) + (dataBuffer[i + 1] & 0xff);
        }
        if ((dataLength & 1) > 0) {
            sum += (dataBuffer[dataLength - 1] & 0xff);
        }
        while ((sum >> 16) > 0) {
            sum = (sum & 0xffff) + (sum >> 16);
        }
        return ((~sum) & 0xffff);
    }

    gcodeRequest(gcode) {
        this.buildPacket(GCODE_REQUEST_EVENT_ID, gcode);
    }

    printGcodeRequest(gcode) {
        this.buildPacket(PRINT_GCODE_REQUEST_EVENT_ID, gcode);
    }

    fileOperationRequestMount() {
        const content = new Uint8Array(1);
        content[0] = 0x00;
        this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, Buffer.from([0x00]));
    }

    fileOperationRequestGetFiles(rewind) {
        if (rewind) {
            this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, Buffer.from([0x04, 0x01]));
        } else {
            this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, Buffer.from([0x04, 0x00]));
        }
    }

    fileOperationRequestPrintFile(filename) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x06;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const filenameBuffer = Buffer.from(filename, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, filenameBuffer], operationBuffer.length + filenameBuffer.length);
        this.buildPacket(FILE_OPERATION_REQUEST_EVENT_ID, contentBuffer);
    }

    statusRequestMachineStatus() {
        const content = new Uint8Array(1);
        content[0] = 0x01;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x01]));
    }

    statusRequestMachineAbnormalStatus() {
        const content = new Uint8Array(1);
        content[0] = 0x02;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x02]));
    }

    statusRequestMachineStartPrint() {
        const content = new Uint8Array(1);
        content[0] = 0x03;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x03]));
    }

    statusRequestMachinePausePrint() {
        const content = new Uint8Array(1);
        content[0] = 0x04;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x04]));
    }

    statusRequestMachineResumePrint() {
        const content = new Uint8Array(1);
        content[0] = 0x05;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x05]));
    }

    statusRequestMachineStopPrint() {
        const content = new Uint8Array(1);
        content[0] = 0x06;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x06]));
    }

    statusRequestMachineFinishPrint() {
        const content = new Uint8Array(1);
        content[0] = 0x07;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    statusRequestLineNumber() {
        const content = new Uint8Array(1);
        content[0] = 0x08;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x08]));
    }

    statusRequestPrintProgress() {
        const content = new Uint8Array(1);
        content[0] = 0x09;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x09]));
    }

    statusRequestResetErrorFlag() {
        const content = new Uint8Array(1);
        content[0] = 0x0a;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }

    statusRequestResumePrintLocal() {
        const content = new Uint8Array(1);
        content[0] = 0x0b;
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0b]));
    }

    statusRequestResumePrintUSB() {
        return this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0c]));
    }

    statusSyncMachineStatus(x, y, z, e) {
        const subEventID = new Uint8Array(1);
        subEventID[0] = 0x01;
        const subEventBuffer = Buffer.from(subEventID, 'utf-8');
        const pos = toByte([x * 1000, y * 1000, z * 1000, e * 1000]);
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
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x04, (point & 0xff)]));
    }

    moveCalibrationPoint(offset) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x06;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        // const offsetArray = new Uint32Array(1);
        // offsetArray[0] = offset * 1000;
        const offsetArray = toByte([offset * 1000]);
        const offsetBuffer = Buffer.from(offsetArray, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, offsetBuffer], operationBuffer.length + offsetBuffer.length);
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, contentBuffer);
    }

    saveCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    exitCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x08]));
    }

    resetCalibration() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x09]));
    }

    getLaserFocalLength() {
        return this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }
}

export default PacketManager;
