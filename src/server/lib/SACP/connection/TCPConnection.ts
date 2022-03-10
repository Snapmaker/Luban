import { Socket } from 'net';
import SACP from '../communication/Communication';
import ConnectionInterface from './ConnectionInterface';

export default class TCPConnections implements ConnectionInterface {
    socket: Socket;

    sacp: SACP;

    constructor(sacp: SACP, socket: Socket) {
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
