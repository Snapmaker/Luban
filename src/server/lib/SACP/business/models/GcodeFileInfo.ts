import { readString, stringToBuffer } from '../../helper';
import { Serializable } from '../../Serializable';

export default class GcodeFileInfo implements Serializable {
    md5: string;

    gcodeName: string;

    constructor(md5: string = '', gcodeName: string = '') {
        this.md5 = md5;
        this.gcodeName = gcodeName;
    }

    toBuffer(): Buffer {
        return Buffer.concat([stringToBuffer(this.md5), stringToBuffer(this.gcodeName)]);
    }

    fromBuffer(buffer: Buffer) {
        const { nextOffset, result: md5 } = readString(buffer, 0);
        this.md5 = md5;
        this.gcodeName = readString(buffer, nextOffset).result;
        return this;
    }
}
