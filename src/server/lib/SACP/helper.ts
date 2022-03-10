// reference: https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/1977492167/3.0-


export function readBool(buffer: Buffer, offset: number = 0) {
    const value = buffer.readUInt8(offset);
    if (value === 0) {
        return false;
    } else if (value === 1) {
        return true;
    } else {
        throw new Error('can not read buffer to bool');
    }
}

export function writeBool(buffer: Buffer, offset: number = 0, value: number) {
    let val = 0;
    if (value) {
        val = 1;
    }
    const nextOffset = buffer.writeUInt8(val, offset);
    return nextOffset;
}

export function readUint8(buffer: Buffer, offset: number = 0) {
    return buffer.readUInt8(offset);
}

export function writeUint8(buffer: Buffer, offset: number = 0, value: number) {
    const nextOffset = buffer.writeUInt8(value, offset);
    return nextOffset;
}

export function readInt8(buffer: Buffer, offset: number = 0) {
    return buffer.readInt8(offset);
}

export function writeInt8(buffer: Buffer, offset: number = 0, value: number) {
    const nextOffset = buffer.writeInt8(value, offset);
    return nextOffset;
}

export function readUint16(buffer: Buffer, offset: number = 0) {
    return buffer.readUInt16LE(offset);
}

export function writeUint16(buffer: Buffer, offset: number = 0, value: number) {
    const nextOffset = buffer.writeUInt16LE(value, offset);
    return nextOffset;
}

export function readInt16(buffer: Buffer, offset: number = 0) {
    return buffer.readInt16LE(offset);
}

export function writeInt16(buffer: Buffer, offset: number = 0, value: number) {
    const nextOffset = buffer.writeInt16LE(value, offset);
    return nextOffset;
}

export function readUint32(buffer: Buffer, offset: number = 0) {
    return buffer.readUInt32LE(offset);
}

export function writeUint32(buffer: Buffer, offset: number = 0, value: number) {
    const nextOffset = buffer.writeUInt32LE(value, offset);
    return nextOffset;
}

export function readInt32(buffer: Buffer, offset: number = 0) {
    return buffer.readInt32LE(offset);
}

export function writeInt32(buffer: Buffer, offset: number = 0, value: number) {
    const nextOffset = buffer.writeInt32LE(value, offset);
    return nextOffset;
}

export function readFloat(buffer: Buffer, offset: number = 0) {
    return readInt32(buffer, offset) / 1000;
}

export function writeFloat(buffer: Buffer, offset: number = 0, value: number) {
    const floatToIntVal = (value * 1000) ^ 0;
    const nextOffset = writeInt32(buffer, offset, floatToIntVal);
    return nextOffset;
}

export function readString(buffer: Buffer, offset: number = 0) {
    const bytesToStorelength = 2;
    const strLength = readUint16(buffer, offset);
    const strBuffer = buffer.slice(offset + bytesToStorelength, offset + bytesToStorelength + strLength);
    return {
        nextOffset: offset + bytesToStorelength + strLength,
        result: Buffer.from(strBuffer).toString()
    };
}

// export function writeString(buffer: Buffer, offset: number = 0, value: string) {
//     const nextOffset = writeUint16(buffer, offset, value.length);
//     const numOfBytes = buffer.write(value, nextOffset);
//     return nextOffset + numOfBytes;
// }

export function stringToBuffer(str: string) {
    const buffer = Buffer.from(str);
    const lenBuffer = Buffer.alloc(2, 0);
    writeUint16(lenBuffer, 0, buffer.byteLength);
    return Buffer.concat([lenBuffer, buffer]);
}

export function readArray(buffer: Buffer, offset: number = 0) {
    const bytesToStorelength = 1;
    const arrLength = readUint8(buffer, offset);
    const arrBuffer = buffer.slice(offset + bytesToStorelength, offset + arrLength);
    return arrBuffer;
}

export function writeArray(buffer: Buffer, offset: number = 0, value: Buffer) {
    const nextOffset = writeUint8(buffer, offset, value.byteLength);
    buffer.fill(value, nextOffset);
    return nextOffset + value.byteLength;
}

export function readSOF(buffer: Buffer, offset: number = 0) {
    return buffer.readUInt16BE(offset); // notice, there is an exception
}

export function writeSOF(buffer: Buffer, offset: number = 0, value: number) {
    return buffer.writeUInt16BE(value, offset); // notice, there is an exception
}

// calcChecksum() and calcCRC8() are copied from Fabscreen
export function calcChecksum(buffer: Buffer, offset: number, length: number) {
    // TCP/IP checksum
    // https://locklessinc.com/articles/tcp_checksum/
    let sum = 0;
    for (let i = 0; i < length - 1; i += 2) {
        sum += (buffer[offset + i] & 0xFF) * 0x100 + (buffer[offset + i + 1] & 0xFF);
    }
    if ((length & 1) > 0) {
        sum += (buffer[offset + length - 1] & 0xFF);
    }
    while ((sum >> 16) > 0) {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }
    return ((~sum) & 0xFFFF);
}

export function calcCRC8(buffer: Buffer, offset: number, length: number) {
    let crc = 0x00;
    const poly = 0x07;
    for (let i = offset; i < offset + length; i++) {
        for (let j = 0; j < 8; j++) {
            const bit = ((buffer[i] >> (7 - j) & 1) === 1);
            const c07 = ((crc >> 7 & 1) === 1);
            crc <<= 1;
            if (c07 !== bit) {
                crc ^= poly;
            }
        }
    }
    crc &= 0xff;
    return crc;
}
