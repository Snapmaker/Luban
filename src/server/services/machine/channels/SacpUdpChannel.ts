import dgram from 'dgram';

import SocketBASE from './SACP-BASE';
import logger from '../../../lib/logger';
import SocketServer from '../../../lib/SocketManager';
import { EventOptions } from '../types';
import Business from '../sacp/Business';
import { CONNECTION_TYPE_WIFI } from '../../../constants';

const log = logger('machine:channel:SacpUdpChannel');

class SacpUdpChannel extends SocketBASE {
    // private client: dgram.
    private socketClient = dgram.createSocket('udp4');

    public constructor() {
        super();

        this.socketClient.bind(8889, () => {
            log.debug('Bind local port 8889');
        });

        this.socketClient.on('message', (buffer) => {
            this.sacpClient.read(buffer);
        });
        this.socketClient.on('close', () => {
            log.info('TCP connection closed');
            const result = {
                code: 200,
                data: {},
                msg: '',
                text: ''
            };
            this.socket && this.socket.emit('connection:close', result);
        });
        this.socketClient.on('error', (err) => {
            log.error(`TCP connection error: ${err}`);
        });
    }

    public test = async (host: string, port: number) => {
        this.sacpClient = new Business('udp', {
            socket: this.socketClient,
            host,
            port,
        });

        const { data } = await this.sacpClient.getMachineInfo();
        return !!data;
    };

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        this.socket = socket;

        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });

        console.log('connectionOpen, options =', options);

        this.sacpClient = new Business('udp', {
            socket: this.socketClient,
            host: options.address,
            port: 2016, // 8889
        });

        this.socket && this.socket.emit('connection:open', {});

        // TODO: Getting other info
        this.socket && this.socket.emit('connection:connected', {
            state: {},
            err: null,
            type: CONNECTION_TYPE_WIFI,
        });

        this.emit('connected');
    }

    public connectionClose = (socket: SocketServer, options: EventOptions) => {
        this.sacpClient?.dispose();

        const result = {
            code: 200,
            data: {},
            msg: '',
            text: ''
        };
        socket && socket.emit(options.eventName, result);
    }

    public startHeartbeat = () => {
        log.info('Start heartbeat.');
    };
}

const channel = new SacpUdpChannel();

export {
    channel as sacpUdpChannel,
};

export default SacpUdpChannel;
