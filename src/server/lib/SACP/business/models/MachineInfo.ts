import { readString, readUint32, readUint8 } from '../../helper';
import { Serializable } from '../../Serializable';

enum MachineType {
    A150, A250, A350, A400, J1
}

export default class MachineInfo implements Serializable {
    type: MachineType;

    masterControlHardwareVersion: number;

    masterControlSerialNumber: number;

    masterControlFirmwareVersion: string;

    constructor(type?: MachineType, masterControlHardwareVersion?: number, masterControlSerialNumber?: number, masterControlFirmwareVersion?: string) {
        this.type = type ?? MachineType.A150;
        this.masterControlHardwareVersion = masterControlHardwareVersion ?? 0;
        this.masterControlSerialNumber = masterControlSerialNumber ?? 0;
        this.masterControlFirmwareVersion = masterControlFirmwareVersion ?? '';
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        this.type = readUint8(buffer, 0);
        this.masterControlHardwareVersion = readUint8(buffer, 1);
        this.masterControlSerialNumber = readUint32(buffer, 2);
        this.masterControlFirmwareVersion = readString(buffer, 6).result;
        return this;
    }
}
