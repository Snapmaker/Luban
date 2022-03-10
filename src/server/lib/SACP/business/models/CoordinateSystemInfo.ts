import { readBool, readUint8 } from '../../helper';
import { Serializable } from '../../Serializable';
import CoordinateInfo from './CoordinateInfo';

export default class CoordinateSystemInfo implements Serializable {
    homed: number;

    coordinateSystemId: number;

    isOriginOffsetCoordinateSystem: boolean;

    coordinates: CoordinateInfo[];

    originOffset: CoordinateInfo[];

    constructor(homed?: number, coordinateSystemId?: number, isOriginOffsetCoordinateSystem?: boolean, coordinates?: CoordinateInfo[], originOffset?: CoordinateInfo[]) {
        this.homed = homed ?? 1;
        this.coordinateSystemId = coordinateSystemId ?? 0;
        this.isOriginOffsetCoordinateSystem = isOriginOffsetCoordinateSystem ?? true;
        this.coordinates = coordinates ?? [];
        this.originOffset = originOffset ?? [];
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        this.homed = readUint8(buffer, 0);
        this.coordinateSystemId = readUint8(buffer, 1);
        this.isOriginOffsetCoordinateSystem = readBool(buffer, 2);

        const coordinatesBuffer = buffer.slice(3);
        this.coordinates = CoordinateInfo.parseArray(coordinatesBuffer);

        const originOffsetBuffer = buffer.slice(this.coordinates.length * CoordinateInfo.byteLength + 3);
        this.originOffset = CoordinateInfo.parseArray(originOffsetBuffer);
        return this;
    }
}
