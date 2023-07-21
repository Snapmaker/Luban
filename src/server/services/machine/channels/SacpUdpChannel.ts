import dgram from 'dgram';
import path from 'path';

import DataStorage from '../../../DataStorage';
import { CONNECTION_TYPE_WIFI } from '../../../constants';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import Business from '../sacp/Business';
import { EventOptions } from '../types';
import SocketBASE from './SACP-BASE';

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

    public async test(host: string, port: number) {
        const sacpResponse = (async () => {
            this.sacpClient = new Business('udp', {
                socket: this.socketClient,
                host,
                port,
            });
            this.sacpClient.setLogger(log);

            const { data } = await this.sacpClient.getMachineInfo();
            return !!data;
        })();

        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 2000));

        return Promise.race([sacpResponse, timeoutPromise]);
    }

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        this.socket = socket;

        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });

        log.info(`connectionOpen, options = ${options}`);

        this.sacpClient = new Business('udp', {
            socket: this.socketClient,
            host: options.address,
            port: 2016, // 8889
        });
        this.sacpClient.setLogger(log);

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

    public uploadFile = async (options: EventOptions) => {
        const { eventName } = options;

        const { gcodePath, renderGcodeFileName } = options;
        log.info(`Upload file to controller... ${gcodePath}`);

        const gcodeFullPath = path.resolve(`${DataStorage.tmpDir}${gcodePath}`);
        // Note: Use upload large file API instead of upload file API, newer firmware will implement this API
        // rather than the old ones.
        const res = await this.sacpClient.uploadLargeFile(gcodeFullPath, renderGcodeFileName);

        if (res.response.result === 0) {
            const result = {
                err: null,
                text: ''
            };
            this.socket && this.socket.emit(eventName, result);
        } else {
            const result = {
                err: 'failed',
                text: 'Failed to upload file',
            };
            this.socket && this.socket.emit(eventName, result);
        }
    };
}

const channel = new SacpUdpChannel();

export {
    channel as sacpUdpChannel
};

export default SacpUdpChannel;
