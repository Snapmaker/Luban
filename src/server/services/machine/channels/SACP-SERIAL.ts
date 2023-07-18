import crypto from 'crypto';
import fs from 'fs';
import { SerialPort } from 'serialport';

import { SACP_TYPE_SERIES_MAP } from '../../../../app/constants/machines';
import DataStorage from '../../../DataStorage';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import Business from '../sacp/Business';
import { EventOptions } from '../types';
import { ChannelEvent } from './ChannelEvent';
import SocketBASE from './SACP-BASE';

const log = logger('lib:SocketSerial');

class SocketSerialNew extends SocketBASE {
    private serialport: SerialPort;

    private availPorts: {
        path: string
    }[];

    // public startTime: number;

    // public sent: number;

    // public total: number;

    public connectionOpen = async (socket: SocketServer, options) => {
        this.availPorts = await SerialPort.list();
        this.socket = socket;
        if (this.availPorts.length > 0) {
            this.socket && this.socket.emit('connection:connecting', { isConnecting: true });
            this.serialport = new SerialPort({
                path: options.port ? options.port : this.availPorts[0].path,
                baudRate: 115200,
                autoOpen: false,
            });
            this.sacpClient = new Business('serialport', this.serialport);

            this.serialport.on('data', (data) => {
                // console.log(data.toString());
                this.sacpClient.read(data);
            });

            this.serialport.on('error', (err) => {
                log.error(`Serial connection error: ${err}`);
                this.socket.emit('connection:connected', { err: 'this machine is not ready' });
            });

            this.serialport.on('close', () => {
                log.info('serial close');
                this.socket.emit('connection:close');
            });

            // When serialport connected, we detect the machine identifier
            this.serialport.once('open', () => {
                log.debug(`Serial port ${options.port || this.availPorts[0].path} opened`);

                // Force switch to SACP
                this.serialport.write('\r\n');
                this.serialport.write('M2000 S5 P1\r\n');
                // this.serialport.write('M2000 U5\r\n');
                this.serialport.write('$PS\r\n');

                log.error('M2000 sent');

                // Wait (at least 100ms) to let controller switch to SACP
                // Then we get machine info, this is required to detect the machine
                setTimeout(async () => {
                    // Get Machine Info
                    const { data: machineInfos } = await this.getMachineInfo();
                    const machineIdentifier = SACP_TYPE_SERIES_MAP[machineInfos.type];
                    log.debug(`Get machine info, type = ${machineInfos.type}`);
                    log.debug(`Get machine info, machine identifier = ${machineIdentifier}`);

                    // Machine detected
                    this.emit(ChannelEvent.Ready, {
                        machineIdentifier,
                    });
                }, 1000);
            });

            // Open serial port
            this.serialport.open();
        }
    };

    public connectionClose = async () => {
        this.socket && this.socket.emit('connection:connecting', { isConnecting: true });
        // await this.sacpClient.unSubscribeLogFeedback(this.subscribeLogCallback).then(res => {
        //     log.info(`unsubscribeLog: ${res}`);
        // });
        // await this.sacpClient.unSubscribeCurrentCoordinateInfo(this.subscribeCoordinateCallback).then(res => {
        //     log.info(`unSubscribeCoordinate: ${res}`);
        // });
        // await this.sacpClient.unSubscribeHotBedTemperature(this.subscribeHotBedCallback).then(res => {
        //     log.info(`unSubscribeHotBed, ${res}`);
        // });
        // await this.sacpClient.unSubscribeNozzleInfo(this.subscribeNozzleCallback).then(res => {
        //     log.info(`unSubscribeNozzle: ${res}`);
        // });
        // await this.sacpClient.unsubscribeHeartbeat(this.subscribeHeartCallback).then(res => {
        //     log.info(`unSubscribeHeart, ${res}`);
        // });
        this.serialport?.close();
        this.serialport?.destroy();
        // this.sacpClient?.dispose();
        this.socket.emit('connection:close');
    };

    public startHeartbeat = () => {
        this.startHeartbeatBase(this.sacpClient);
        this.setROTSubscribeApi();
    };

    public startGcode = async (options: EventOptions) => {
        const { headType } = options;
        log.info(`serial start gcode, ${headType}`);
        let type = 0;
        if (headType === HEAD_PRINTING) {
            type = 0;
        } else if (headType === HEAD_LASER) {
            type = 2;
        } else if (headType === HEAD_CNC) {
            type = 1;
        }
        const gcodeFilePath = `${DataStorage.tmpDir}/${options.uploadName}`;
        await this.sacpClient.startPrintSerial(gcodeFilePath, ({ length }) => {
            this.totalLine !== length && (this.totalLine = length);
        });
        const md5 = crypto.createHash('md5');
        const readStream = fs.createReadStream(gcodeFilePath);
        readStream.on('data', buf => {
            md5.update(buf);
        });
        readStream.once('end', async () => {
            this.sacpClient.startPrint(md5.digest().toString('hex'), options.uploadName, type).then(({ response }) => {
                log.info(`startPrinting: ${response.result}`);
                response.result === 0 && (this.startTime = new Date().getTime());
            });
        });
    };
}

export const socketSerialNew = new SocketSerialNew();

export default SocketSerialNew;
