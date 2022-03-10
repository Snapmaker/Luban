export default interface ConnectionInterface {
    write: (buffer: Buffer) => void;

    read: (buffer: Buffer) => void;

    end: () => void;
}
