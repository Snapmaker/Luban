import ConnectionInterface from './ConnectionInterface';
import SACP from '../communication/Communication';

export default class SerialPortConnections implements ConnectionInterface {
    socket: any;

    sacp: SACP;

    constructor(sacp: SACP, socket: any) {
        this.sacp = sacp;
        this.socket = socket;
    }

    read(buffer: Buffer) {
        this.sacp.receive(buffer);
    }

    end() {
        this.sacp.end();
    }

    write(buffer: Buffer) {
        this.socket.write(buffer);
    }
}
