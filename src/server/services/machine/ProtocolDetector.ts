import net from 'net';
import { SerialPort } from 'serialport';

import {
    PORT_SCREEN_HTTP,
    PORT_SCREEN_SACP,
} from '../../constants';
import logger from '../../lib/logger';
import { sacpUdpChannel } from './channels/SacpUdpChannel';

const log = logger('services:machine:ProtocolDetector');

export enum NetworkProtocol {
    Unknown = 'Unknown',
    HTTP = 'HTTP',
    SacpOverTCP = 'SACP-TCP',
    SacpOverUDP = 'SACP-UDP',
}

export enum SerialPortProtocol {
    PlainText = 'text',
    SacpOverSerialPort = 'SACP-Serial',
}


class ProtocolDetector {
    private async tryConnectHTTP(host: string): Promise<boolean> {
        log.debug(`Try connect to ${host} via HTTP channel...`);
        const port = PORT_SCREEN_HTTP;

        return new Promise((resolve) => {
            const tcpSocket = net.createConnection({
                host,
                port,
                timeout: 1000
            }, () => {
                tcpSocket.destroy();
                resolve(true);
                log.debug(`try connect ${host}:${port}, connected.`);
            });
            tcpSocket.once('timeout', () => {
                tcpSocket.destroy();
                log.debug(`try connect ${host}:${port}, timeout`);
                resolve(false);
            });
            tcpSocket.once('error', (e) => {
                tcpSocket.destroy();
                log.debug(`try connect ${host}:${port}, error: ${e}`);
                resolve(false);
            });
        });
    }

    private async tryConnectSacpTcp(host: string): Promise<boolean> {
        log.debug(`Try connect to ${host} via SACP over TCP channel...`);
        const port = PORT_SCREEN_SACP;

        return new Promise((resolve) => {
            const tcpSocket = net.createConnection({
                host,
                port,
                timeout: 1000
            }, () => {
                tcpSocket.destroy();
                resolve(true);
                log.debug(`try connect ${host}:${port}, connected.`);
            });
            tcpSocket.once('timeout', () => {
                tcpSocket.destroy();
                log.debug(`try connect ${host}:${port}, timeout`);
                resolve(false);
            });
            tcpSocket.once('error', (e) => {
                tcpSocket.destroy();
                log.debug(`try connect ${host}:${port}, error: ${e}`);
                resolve(false);
            });
        });
    }

    /**
     * Try connect to machine via SACP over UDP.
     */
    private tryConnectSacpUdp = async (host: string) => {
        const port = 2016;
        log.debug(`Try connect to ${host} via SACP over UDP channel...`);
        try {
            const result = await sacpUdpChannel.test(host, port);
            if (result) {
                log.debug('SACP over UDP channel: connected.');
            } else {
                log.debug('SACP over UDP channel: failed to connect.');
            }
            return result;
        } catch (e) {
            log.error(e);
            return false;
        }
    };

    /**
     * Detect network protocol.
     */
    public async detectNetworkProtocol(host: string): Promise<NetworkProtocol> {
        const [resSACP, resHTTP, sacpUdpResponse] = await Promise.allSettled([
            this.tryConnectSacpTcp(host),
            this.tryConnectHTTP(host),
            this.tryConnectSacpUdp(host),
        ]);

        if (resHTTP.status === 'fulfilled' && resHTTP.value) {
            return NetworkProtocol.HTTP;
        } else if (resSACP.status === 'fulfilled' && resSACP.value) {
            return NetworkProtocol.SacpOverTCP;
        } else if (sacpUdpResponse.status === 'fulfilled' && sacpUdpResponse.value) {
            return NetworkProtocol.SacpOverUDP;
        }

        return NetworkProtocol.Unknown;
    }

    /**
     * Detect serial port protocol.
     */
    public async detectSerialPortProtocol(port: string): Promise<SerialPortProtocol> {
        let protocol: SerialPortProtocol = SerialPortProtocol.PlainText;
        let hasData = false;

        const trySerialConnect = new SerialPort({
            path: port,
            baudRate: 115200,
            autoOpen: false,
        });

        setTimeout(() => {
            if (!hasData) {
                protocol = SerialPortProtocol.SacpOverSerialPort;
                trySerialConnect?.close();
            }
        }, 1000);

        await new Promise((resolve) => {
            let responseBuffer = Buffer.alloc(0);
            trySerialConnect.on('data', (data) => {
                hasData = true;

                // SACP => SACP
                if (data[0].toString(16) === 'aa' && data[1].toString(16) === '55') {
                    protocol = SerialPortProtocol.SacpOverSerialPort;
                    trySerialConnect?.close();
                }

                // concat all previous buffer
                responseBuffer = Buffer.concat([responseBuffer, data]);
                const m1006Response = responseBuffer.toString();

                // M1006 response: SACP V1 => SACP
                if (m1006Response.match(/SACP/g)) {
                    protocol = SerialPortProtocol.SacpOverSerialPort;
                    trySerialConnect?.close();
                }

                // ok => plaintext protocol
                if (m1006Response.match(/ok/g)) {
                    protocol = SerialPortProtocol.PlainText;
                    trySerialConnect?.close();
                }
            });
            trySerialConnect.on('close', () => {
                resolve(true);
            });
            trySerialConnect.on('error', (err) => {
                log.error(`error = ${err}`);
            });
            trySerialConnect.once('open', () => {
                // Use M1006 to detect if SACP is supported
                // Expected response: SACP V1
                trySerialConnect.write('M1006\r\n');
            });
            trySerialConnect.open();
        });

        return protocol;
    }
}


export default ProtocolDetector;
