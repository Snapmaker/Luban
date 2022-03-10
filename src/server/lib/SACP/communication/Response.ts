import { Serializable } from '../Serializable';
import { readUint8, writeUint8 } from '../helper';

export default class Response implements Serializable {
    result: number;

    data: Buffer;

    constructor(result?: number, data?: Buffer) {
        this.result = result ?? 0;
        this.data = data ?? Buffer.alloc(0);
    }

    toBuffer(): Buffer {
        const buffer = Buffer.alloc(1, 0);
        writeUint8(buffer, 0, this.result);
        return Buffer.concat([buffer, this.data]);
    }

    fromBuffer(buffer: Buffer) {
        this.result = readUint8(buffer, 0);
        this.data = buffer.slice(1);
        return this;
    }
}
