import { readBool, readUint8 } from '../../helper';
import { Serializable } from '../../Serializable';

enum Axis {
    X1, Y1, Z1, A1, B1, C1, X2, E1, E2
}

export default class AxisMotorState implements Serializable {
    axis: Axis;

    isOn: boolean;

    constructor(axis?: Axis, isOn?: boolean) {
        this.axis = axis ?? Axis.X1;
        this.isOn = isOn ?? false;
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        this.axis = readUint8(buffer, 0);
        this.isOn = readBool(buffer, 1);
        return this;
    }
}
