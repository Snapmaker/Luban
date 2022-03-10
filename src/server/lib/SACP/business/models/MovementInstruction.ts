import { readFloat, readUint16, readUint8 } from '../../helper';
import { Serializable } from '../../Serializable';

enum MoveDirection {
    X1, Y1, Z1, A1, B1, C1, X2
}

export default class MovementInstruction implements Serializable {
    direction: MoveDirection;

    distance: number;

    speed: number;

    constructor(direction?: MoveDirection, distance?: number, speed?: number) {
        this.direction = direction ?? 0;
        this.distance = distance ?? 0;
        this.speed = speed ?? 0;
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        this.direction = readUint8(buffer, 0) as MoveDirection;
        this.distance = readFloat(buffer, 1);
        this.speed = readUint16(buffer, 5);
        return this;
    }
}
