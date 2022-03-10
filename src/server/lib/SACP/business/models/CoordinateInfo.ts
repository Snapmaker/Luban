import { readFloat, readUint8 } from '../../helper';
import { Serializable } from '../../Serializable';

enum Direction {
    X1, Y1, Z1, A1, B1, C1, X2
}

export default class CoordinateInfo implements Serializable {
    static byteLength: number = 5;

    key: Direction;

    value: number;

    constructor(key?: Direction, value?: number) {
        this.key = key ?? Direction.X1;
        this.value = value ?? 0.0;
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        this.key = readUint8(buffer) as Direction;
        this.value = readFloat(buffer, 1);
        return this;
    }

    static parseArray(buffer: Buffer): CoordinateInfo[] {
        const result = [];
        const arrLength = readUint8(buffer, 0);
        const targetBuffer = buffer.slice(1);
        for (let i = 0; i < arrLength; i++) {
            const info = targetBuffer.slice(i * CoordinateInfo.byteLength, (i + 1) * CoordinateInfo.byteLength);
            result.push(new CoordinateInfo().fromBuffer(info));
        }
        return result;
    }
}
