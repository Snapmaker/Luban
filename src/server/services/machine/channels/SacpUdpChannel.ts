import dgram from 'dgram';

import { SACP_TYPE_SERIES_MAP } from '../../../../app/constants/machines';
import logger from '../../../lib/logger';
import SacpClient from '../sacp/SacpClient';
import { ChannelEvent } from './ChannelEvent';
import SacpChannelBase from './SacpChannel';

const log = logger('machine:channels:SacpUdpChannel');

class SacpUdpChannel extends SacpChannelBase {
    // private client: dgram.
    private socketClient = dgram.createSocket('udp4');

    private heartbeatTimer2 = null;

    public constructor() {
        super();

        this.socketClient.bind(8889, () => {
            log.debug('Bind local port 8889');
        });

        this.socketClient.on('message', (buffer) => {
            // Only when connection is established, then SACP client will be created
            if (this.sacpClient) {
                this.sacpClient.read(buffer);
            }
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

    public async test(host: string, port: number): Promise<boolean> {
        const sacpResponse = (async () => {
            this.sacpClient = new SacpClient('udp', {
                socket: this.socketClient,
                host,
                port,
            });
            this.sacpClient.setLogger(log);

            const { data } = await this.sacpClient.getMachineInfo();
            return !!data;
        })();

        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));

        return Promise.race([sacpResponse, timeoutPromise]);
    }

    public async connectionOpen(options: { address: string }): Promise<boolean> {
        log.debug(`connectionOpen(): options = ${options}`);

        this.emit(ChannelEvent.Connecting);

        this.sacpClient = new SacpClient('udp', {
            socket: this.socketClient,
            host: options.address,
            port: 8889,
        });
        this.sacpClient.setLogger(log);

        // Get Machine Info
        const machineInfo = await this.getMachineInfo();
        const machineIdentifier = SACP_TYPE_SERIES_MAP[machineInfo.type];
        log.debug(`Get machine info, type = ${machineInfo.type}`);
        log.debug(`Get machine info, machine identifier = ${machineIdentifier}`);

        // Once responsed, it's connected
        this.emit(ChannelEvent.Connected);

        // Machine detected
        this.emit(ChannelEvent.Ready, {
            machineIdentifier,
        });

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async connectionClose(options?: { force: boolean }): Promise<boolean> {
        // UDP is stateless, not need to close
        this.sacpClient?.dispose();

        return true;
    }

    public async startHeartbeat(): Promise<void> {
        return super.startHeartbeat();
    }

    public async stopHeartbeat(): Promise<void> {
        // Remove heartbeat timeout check
        if (this.heartbeatTimer2) {
            clearTimeout(this.heartbeatTimer2);
            this.heartbeatTimer2 = null;
        }

        // Cancel subscription of heartbeat
        const res = await this.sacpClient.unsubscribeHeartbeat(null);
        log.info(`Unsubscribe heartbeat, result = ${res.code}`);
    }
}

const channel = new SacpUdpChannel();

export {
    channel as sacpUdpChannel
};

export default SacpUdpChannel;
