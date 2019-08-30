import {
    GCODE_REQUEST_EVENT_ID,
    // GCODE_RESPONSE_EVENT_ID,
    PRINT_GCODE_REQUEST_EVENT_ID,
    // PRINT_GCODE_RESPONSE_EVENT_ID,
    FILE_OPERATION_REQUEST_EVENT_ID,
    // FILE_OPERATION_RESPONSE_EVENT_ID,
    STATUS_SYNC_REQUEST_EVENT_ID,
    STATUS_RESPONSE_EVENT_ID,
    SETTINGS_REQUEST_EVENT_ID,
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

class PacketManager {
    constructor() {
        this.metaData = new Uint8Array(9);
        this.marker = 0x0000;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
        this.version = 0x00;
        this.checkSum = 0x0000;
        this.eventID = 0x00;
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
        this.pack(content);
    }

    pack(content) {
        this.resetDefaultMetaData();
        let contentBuffer = null;
        if (Buffer.isBuffer(content)) {
            contentBuffer = content;
        } else {
            this.setContent(content);
            contentBuffer = Buffer.from(this.content, 'utf-8');
        }
        this.length = contentBuffer.length;
        this.lengthVerify = (this.length >> 8) ^ (this.length & 0xff);
        this.checkSum = this.calculateCheckSum();

        this.metaData[0] = this.marker >> 8;
        this.metaData[1] = this.marker & 0xff;
        this.metaData[4] = this.version;
        this.metaData[8] = this.eventID;

        this.metaData[2] = this.length >> 8;
        this.metaData[3] = this.length & 0xff;
        this.metaData[5] = this.lengthVerify;
        this.metaData[6] = this.checkSum >> 8;
        this.metaData[7] = this.checkSum & 0xff;

        const metaBuffer = Buffer.from(this.metaData, 'utf-8');
        const buffer = Buffer.concat([metaBuffer, contentBuffer], this.length + 9);

        // console.log('pack buffer', buffer, this.content);
        return buffer;
    }

    unpack(buffer) {
        if (typeof buffer === 'string') {
            // console.log('unpack buffer', buffer);
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
        this.content = contentBuffer.toString();
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

    calculateCheckSum() {
        let sum = 0;
        const offset = 0;
        const contentBuffer = Buffer.from(this.content, 'utf-8');

        console.log('sum0 ', this.content, contentBuffer);
        for (let i = 0; i < this.length - 1; i += 2) {
            sum += (contentBuffer[offset + i] & 0xff) * 0x100 + (contentBuffer[offset + i + 1] & 0xff);
        }
        if ((this.length & 1) > 0) {
            sum += (contentBuffer[offset + this.length - 1] & 0xff);
        }
        while ((sum >> 16) > 0) {
            sum = (sum & 0xffff) + (sum >> 16);
        }
        console.log('sum ', sum);
        return ((~sum) & 0xffff);
    }

    verifyCheckSum() {
    }

    stringToBuffer(str) {
        return Buffer.from(str, 'utf-8');
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
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x01]));
    }

    statusRequestMachineAbnormalStatus() {
        const content = new Uint8Array(1);
        content[0] = 0x02;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x02]));
    }

    statusRequestMachineStartPrint() {
        const content = new Uint8Array(1);
        content[0] = 0x03;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x03]));
    }

    statusRequestMachinePausePrint() {
        const content = new Uint8Array(1);
        content[0] = 0x04;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x04]));
    }

    statusRequestMachineResumePrint() {
        const content = new Uint8Array(1);
        content[0] = 0x05;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x05]));
    }

    statusRequestMachineStopPrint() {
        const content = new Uint8Array(1);
        content[0] = 0x06;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x06]));
    }

    statusRequestMachineFinishPrint() {
        const content = new Uint8Array(1);
        content[0] = 0x07;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    statusRequestLineNumber() {
        const content = new Uint8Array(1);
        content[0] = 0x08;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x08]));
    }

    statusRequestPrintProgress() {
        const content = new Uint8Array(1);
        content[0] = 0x09;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x09]));
    }

    statusRequestResetErrorFlag() {
        const content = new Uint8Array(1);
        content[0] = 0x0a;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }

    statusRequestResumePrintLocal() {
        const content = new Uint8Array(1);
        content[0] = 0x0b;
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0b]));
    }

    statusRequestResumePrintUSB() {
        this.buildPacket(STATUS_SYNC_REQUEST_EVENT_ID, Buffer.from([0x0c]));
    }

    statusSyncMachineStatus(x, y, z, e) {
        const subEventID = new Uint8Array(1);
        subEventID[0] = 0x01;
        const pos = new Uint32Array(4);
        pos[0] = x * 1000;
        pos[1] = y * 1000;
        pos[2] = z * 1000;
        pos[3] = e * 1000;

        const subEventBuffer = Buffer.from(subEventID, 'utf-8');
        const posBuffer = Buffer.from(pos, 'utf-8');
        const contentBuffer = Buffer.concat([subEventBuffer, posBuffer], subEventBuffer.length + posBuffer.length);
        this.buildPacket(STATUS_RESPONSE_EVENT_ID, contentBuffer);
    }

    startAutoCalibration() {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x02]));
    }

    startManualCalibration() {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x04]));
    }

    gotoCalibrationPoint(point) {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x04, (point & 0xff)]));
    }

    moveCalibrationPoint(offset) {
        const operationID = new Uint8Array(1);
        operationID[0] = 0x06;
        const operationBuffer = Buffer.from(operationID, 'utf-8');
        const offsetArray = new Uint32Array(1);
        offsetArray[0] = offset * 1000;
        const offsetBuffer = Buffer.from(offsetArray, 'utf-8');
        const contentBuffer = Buffer.concat([operationBuffer, offsetBuffer], operationBuffer.length + offsetBuffer.length);
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, contentBuffer);
    }

    saveCalibration() {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }

    exitCalibration() {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x08]));
    }

    resetCalibration() {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x09]));
    }

    getLaserFocalLength() {
        this.buildPacket(SETTINGS_REQUEST_EVENT_ID, Buffer.from([0x0a]));
    }
    // TODO

    /*
    startUpdate() {
        this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x00]));
    }

    requestUpdatePackage() {
        this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x01]));
    }

    // TODO
    sendUpdatePackage(opCode, index, updatePackage) {
        // this.buildPacket(UPDATE_REQUEST_EVENT_ID, contentBuffer);
    }

    checkControllerVersion() {
        this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x03]));
    }

    requestModuleVersion() {
        this.buildPacket(UPDATE_REQUEST_EVENT_ID, Buffer.from([0x07]));
    }
    */
}

export default PacketManager;
