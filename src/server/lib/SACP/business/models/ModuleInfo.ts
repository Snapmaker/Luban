// https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/1984824794/Re?focusedCommentId=2001966795#Data-Format.1

import { readString, readUint16, readUint32, readUint8 } from '../../helper';
import { Serializable } from '../../Serializable';

enum FMDIndex {
    LEFT, RIGHT
}

enum LinearModuleIndex {
    X1 = 1, Y1, Z1, X2, Y2, Z2
}

enum ModuleState {
    NORMAL, UPGRADING, UNAVAIL, UPGRAD_FAIL, OTHER
}

type ModuleIndex = FMDIndex | LinearModuleIndex;
export default class ModuleInfo implements Serializable {
    key: number;

    moduleId: number;

    moduleIndex: ModuleIndex;

    moduleState: ModuleState;

    serialNumber: number;

    hardwareVersion: number;

    moduleFirmwareVersion: string;

    constructor(
        key?: number, moduleId?: number, moduleIndex?: ModuleIndex, moduleState?: ModuleState,
        serialNumber?: number, hardwareVersion?: number, moduleFirmwareVersion?: string
    ) {
        this.key = key ?? 0;
        this.moduleId = moduleId ?? 0;
        this.moduleIndex = moduleIndex ?? FMDIndex.LEFT;
        this.moduleState = moduleState ?? ModuleState.NORMAL;
        this.serialNumber = serialNumber ?? 0;
        this.hardwareVersion = hardwareVersion ?? 0;
        this.moduleFirmwareVersion = moduleFirmwareVersion ?? '';
    }

    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    fromBuffer(buffer: Buffer) {
        this.key = readUint8(buffer, 0);
        this.moduleId = readUint16(buffer, 1);
        this.moduleIndex = readUint8(buffer, 3) as ModuleIndex;
        this.moduleState = readUint8(buffer, 4) as ModuleState;
        this.serialNumber = readUint32(buffer, 5);
        this.hardwareVersion = readUint8(buffer, 9);
        this.moduleFirmwareVersion = readString(buffer, 10).result;
        return this;
    }

    getByteLength() {
        return 10 + 2 + Buffer.from(this.moduleFirmwareVersion).byteLength;
    }

    static parseArray(buffer: Buffer) {
        const result = [];
        const arrLength = readUint8(buffer, 0);
        const targetBuffer = buffer.slice(1);
        let byteLength = 0;
        for (let i = 0; i < arrLength; i++) {
            const info = targetBuffer.slice(byteLength);
            const moduleInfo = new ModuleInfo().fromBuffer(info);
            result.push(moduleInfo);
            byteLength += moduleInfo.getByteLength();
        }
        return result;
    }
}
