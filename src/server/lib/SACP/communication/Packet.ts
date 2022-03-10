import { Serializable } from '../Serializable';
import { calcChecksum, writeUint16 } from '../helper';
import Header from './Header';

export default class Packet implements Serializable {
    header: Header;

    payload: Buffer;

    checksum: Buffer;

    constructor(header?: Header, payload?: Buffer, checksum?: Buffer) {
        this.header = header ?? new Header();
        this.payload = payload ?? Buffer.alloc(0);
        this.checksum = checksum ?? Buffer.alloc(2, 0);
    }

    fromBuffer(buffer: Buffer) {
        this.header = new Header().parse(buffer.slice(0, 13));
        this.payload = buffer.slice(13, buffer.length - 2);
        this.checksum = buffer.slice(buffer.length - 2);
        return this;
    }

    toBuffer() {
        const buffer = Buffer.concat([this.header.toBuffer(), this.payload]);
        const checksumNumber = calcChecksum(buffer, 7, buffer.byteLength - 7);
        this.checksum = Buffer.alloc(2, 0);
        writeUint16(this.checksum, 0, checksumNumber);
        return Buffer.concat([buffer, this.checksum]);
    }
}
