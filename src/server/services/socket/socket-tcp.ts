import net from 'net';
import wifiServerManager from './WifiServerManager';
import type SocketServer from '../../lib/SocketManager';
import { EventOptions } from './socket-http';
import logger from '../../lib/logger';
import { CONNECTION_TYPE_WIFI, HEAD_PRINTING, SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL } from '../../constants';
import Business from '../../lib/SACP-SDK/SACP/business/Business';
// import { readUint8 } from '../../lib/SACP-SDK/SACP/helper';
import { RequestData } from '../../lib/SACP-SDK/SACP/communication/Dispatcher';
import { readString, readUint32, stringToBuffer, writeUint32 } from '../../lib/SACP-SDK/SACP/helper';

const log = logger('lib:SocketTCP');

class SocketTCP {
    private heartbeatTimer;

    private socket: SocketServer;

    private client: net.Socket;

    private sacpClient: Business;

    constructor() {
        this.client = new net.Socket();
        this.sacpClient = new Business('tcp', this.client);
        this.client.on('data', (buffer) => {
            this.sacpClient.read(buffer);
        });
        this.client.on('close', () => {
            log.info('TCP connection closed');
            this.socket && this.socket.emit('connection:close');
        });
        this.client.on('error', (err) => {
            log.error(`TCP connection error: ${err}`);
        });
    }

    public onConnection = (socket: SocketServer) => {
        wifiServerManager.onConnection(socket);
        // this.heartBeatWorker && this.heartBeatWorker.terminate();
    }

    public onDisconnection = (socket: SocketServer) => {
        wifiServerManager.onDisconnection(socket);
    }

    public refreshDevices = () => {
        wifiServerManager.refreshDevices();
    }

    public connectionOpen = (socket: SocketServer, options: EventOptions) => {
        this.socket = socket;
        this.sacpClient.setHandler(0x01, 0x03, () => {
            const state: any = {
                toolHead: SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
                series: 'A400',
                headType: HEAD_PRINTING,
                isHomed: true,
                err: null
            };
            this.socket && this.socket.emit('connection:connected', {
                state,
                err: state?.err,
                type: CONNECTION_TYPE_WIFI
            });

            this.sacpClient.requestHome().then((res) => {
                log.info(`request homing: ${res.response}`);
            });
        });
        this.client.connect({
            host: options.address,
            port: 8080
        }, () => {
            log.info('TCP connected');
            const result: any = {
                msg: '',
                data: {
                    hasEnclosure: false,
                    headType: 1,
                    readonly: false,
                    series: 'Snapmaker A400',
                    token: '415344a6-f7b7-4900-a391-aa6695e2dfdb'
                },
                text: '{"token":"415344a6-f7b7-4900-a391-aa6695e2dfdb","readonly":false,"series":"Snapmaker A400","headType":1,"hasEnclosure":false}'
            };
            this.socket && this.socket.emit('connection:open', result);
        });
    }

    public connectionClose = (socket: SocketServer, options: EventOptions) => {
        this.client.destroy();
        if (this.client.destroyed) {
            log.info('TCP manually closed');
            const result: any = {
                code: 200,
                data: {},
                msg: '',
                text: ''
            };
            socket && socket.emit(options.eventName, result);
        }
    }

    public startHeartbeat = (socket, options) => {
        console.log(socket, options);
        this.sacpClient.subscribeHeartbeat({ interval: 1000 }, (data) => {
            log.info(`receive heartbeat: ${data.response}`);
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = setTimeout(() => {
                log.info('TCP connection closed');
                this.socket && this.socket.emit('connection:close');
            }, 3000);
        }).then((res) => {
            log.info(`subscribe heartbeat success: ${res.response}`);
        });
    };

    public uploadFile = () => {
        const filename = 'a.gcode';
        const md5Str = '4ae09d45eac4aa08d013b5f2e01c67f6';
        const fileLength = 4;


        this.sacpClient.setHandler(0xb0, 0x01, (data: RequestData) => {
            const { nextOffset, result: md5 } = readString(data.param);
            const index = readUint32(data.param, nextOffset);
            log.info(`receive file chunk request: md5: ${md5}, index: ${index}`);

            const md5Buffer = stringToBuffer(md5);
            const indexBuffer = Buffer.alloc(4, 0);
            writeUint32(indexBuffer, 0, index);
            const chunkBuffer = stringToBuffer('G28\n');

            const buffer = Buffer.concat([Buffer.alloc(1, 0), md5Buffer, indexBuffer, chunkBuffer]);
            this.sacpClient.ack(0xb0, 0x02, data.packet, buffer);
        });

        // handle file upload result
        this.sacpClient.setHandler(0xb0, 0x02, (data: RequestData) => {
            if (data.response === 0) {
                log.info('file upload success');
            } else {
                log.error('file upload fail');
            }
            this.sacpClient.ack(0xb0, 0x02, data.packet, Buffer.alloc(1, 0));
        });

        this.sacpClient.uploadFile(filename, md5Str, fileLength).then((res) => {
            if (res.response === 0) {
                log.info('ready to upload file');
            } else {
                log.error('can not upload file');
            }
        });
    }

    // public executeGcode = (options: EventOptions, callback) => {
    //     return new Promise(resolve => {
    //         const { gcode } = options;
    //         const split = gcode.split('\n');
    //         this.gcodeInfos.push({
    //             gcodes: split,
    //             callback: (result) => {
    //                 callback && callback(result);
    //                 resolve(result);
    //             }
    //         });
    //         this.startExecuteGcode();
    //     });
    // };
}

export default new SocketTCP();
