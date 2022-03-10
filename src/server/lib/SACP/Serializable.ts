export interface Serializable {
    toBuffer(): Buffer;

    fromBuffer(buffer: Buffer): any;
}
