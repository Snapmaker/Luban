import { readString, readUint32, stringToBuffer, writeUint32 } from '../../helper';
import { Serializable } from '../../Serializable';

export default class PrintBatchGcode implements Serializable {
    startLineNumber: number;

    endLineNumber: number;

    gcodeBatch: string;

    constructor(startLineNumber?: number, endLineNumber?: number, gcodeBatch?: string) {
        this.startLineNumber = startLineNumber ?? 0;
        this.endLineNumber = endLineNumber ?? 0;
        this.gcodeBatch = gcodeBatch ?? '';
    }

    toBuffer(): Buffer {
        const buffer = Buffer.alloc(8);
        writeUint32(buffer, 0, this.startLineNumber);
        writeUint32(buffer, 4, this.endLineNumber);
        return Buffer.concat([buffer, stringToBuffer(this.gcodeBatch)]);
    }

    fromBuffer(buffer: Buffer) {
        this.startLineNumber = readUint32(buffer, 0);
        this.endLineNumber = readUint32(buffer, 4);
        this.gcodeBatch = readString(buffer, 8).result;
        return this;
    }
}
