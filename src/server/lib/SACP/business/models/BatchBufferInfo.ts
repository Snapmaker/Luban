import { readUint16, readUint32, writeUint16, writeUint32 } from '../../helper';
import { Serializable } from '../../Serializable';

export default class BatchBufferInfo implements Serializable {
    lineNumber: number;

    batchBufferLength: number;

    constructor(lineNumber?: number, batchBufferLength?: number) {
        this.lineNumber = lineNumber ?? 0;
        this.batchBufferLength = batchBufferLength ?? 0;
    }

    toBuffer(): Buffer {
        const buffer = Buffer.alloc(4 + 2, 0);
        const nextOffset = writeUint32(buffer, 0, this.lineNumber);
        writeUint16(buffer, nextOffset, this.batchBufferLength);
        return buffer;
    }

    fromBuffer(buffer: Buffer) {
        this.lineNumber = readUint32(buffer, 0);
        this.batchBufferLength = readUint16(buffer, 4);
        return this;
    }
}
