import { readArray } from '../../helper';
import { Serializable } from '../../Serializable';
import CoordinateInfo from './CoordinateInfo';

export default class MachineSize implements Serializable {
    axisLength: CoordinateInfo[];

    homeOffset: CoordinateInfo[];

    constructor(axisLength?: CoordinateInfo[], homeOffset?: CoordinateInfo[]) {
        this.axisLength = axisLength ?? [];
        this.homeOffset = homeOffset ?? [];
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        const axisLengthBuffer = readArray(buffer, 0);
        this.axisLength = CoordinateInfo.parseArray(axisLengthBuffer);

        const homeOffsetBuffer = readArray(buffer, axisLengthBuffer.byteLength);
        this.homeOffset = CoordinateInfo.parseArray(homeOffsetBuffer);
    }
}
