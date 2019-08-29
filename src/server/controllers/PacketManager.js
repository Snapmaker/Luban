class PacketManager {
    constructor() {
        this.metaData = new Uint8Array(9);
        this.marker = 0x0000;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
        this.version = 0x00;
        this.checkSum = 0x0000;
        this.eventID  = 0x00;
        this.content = '';
    }

    resetDefaultMetaData() {
        this.marker = 0xaa55;
        this.version = 0x01;
        this.checkSum = 0x0000;
        this.eventID  = 0x01;
        this.length = 0x0000;
        this.lengthVerify = 0x00;
    }

    pack(content) {
        this.resetDefaultMetaData();
        this.content = content;
        const contentBuffer = Buffer.from(this.content, 'utf-8');
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
        return buffer;
    }

    unpack(buffer) {
        if (typeof buffer === 'string') {
            console.log('unpack buffer', buffer);
            return buffer;
        }

        this.marker = (buffer[0] << 8) + buffer[1];
        this.length = (buffer[2] << 8) + buffer[3];
        this.version = buffer[4];
        this.lengthVerify = buffer[5];
        this.checkSum = (buffer[6] << 8) + buffer[7];
        this.eventID  = buffer[8];
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
        const offset = 8;
        const contentBuffer = Buffer.from(this.content, 'utf-8');

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

}

export default PacketManager;

/*
const p1 = new PacketManager();
console.log('p1', p1);


gcode = 'G0 X0';
const buffer = p1.pack(gcode);
const up1 = p1.unpack(buffer);
console.log('p2', p1);
console.log('buffer1 ', buffer);
console.log('up1', up1);
*/
