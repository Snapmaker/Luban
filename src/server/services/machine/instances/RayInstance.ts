import { PeerId } from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Header';
import { includes } from 'lodash';

import {
    LASER_HEAD_MODULE_IDS,
    MODULEID_TOOLHEAD_MAP,
} from '../../../../app/constants/machines';
import { SnapmakerRayMachine } from '../../../../app/machines';
import { HEAD_LASER } from '../../../constants';
import logger from '../../../lib/logger';
import { PrintJobChannelInterface } from '../channels/Channel';
import SacpChannelBase from '../channels/SacpChannel';
import SacpSerialChannel from '../channels/SacpSerialChannel';
import SacpUdpChannel from '../channels/SacpUdpChannel';
import TextSerialChannel from '../channels/TextSerialChannel';
import { ConnectedData } from '../types';
import MachineInstance from './Instance';

const log = logger('services:machine:instances:RayInstance');


class RayMachineInstance extends MachineInstance {
    private async _prepareMachineSACP() {
        // configure channel
        (this.channel as SacpChannelBase).setFilePeerId(PeerId.CONTROLLER);

        const state: ConnectedData = {};

        // TODO: Heartbeat is not working for now
        // (this.channel as SocketSerialNew).startHeartbeat();

        // Get Machine Info
        const machineInfo = await (this.channel as SacpChannelBase).getMachineInfo();
        log.info(`Machine Firmware Version: ${machineInfo.masterControlFirmwareVersion}`);

        state.series = SnapmakerRayMachine.identifier;

        // module info
        const moduleInfos = await (this.channel as SacpChannelBase).getModuleInfo();

        /*
        moduleInfos = [
          ModuleInfo {
            key: 3,
            moduleId: 520,
            moduleIndex: 0,
            moduleState: 1,
            serialNumber: 524287,
            hardwareVersion: 255,
            moduleFirmwareVersion: 'v1.0.0',
            byteLength: 18
          },
        ]
        */

        const moduleListStatus = {
            // airPurifier: false,
            emergencyStopButton: false,
            // enclosure: false,
            rotaryModule: false
        };

        moduleInfos.forEach(module => {
            if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_LASER;
                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
            }
        });
        state.moduleStatusList = moduleListStatus;

        this.socket.emit('connection:connected', { state: state, err: '' });

        // Start heartbeat
        await this.channel.startHeartbeat();

        // subscribe to machine errors
        // 0x04, 0x00

        // Subscribe job progress
        await (this.channel as PrintJobChannelInterface).subscribeGetPrintCurrentLineNumber();
    }

    public async onPrepare(): Promise<void> {
        log.info('On preparing machine...');

        if (this.channel instanceof SacpSerialChannel) {
            await this._prepareMachineSACP();
        } else if (this.channel instanceof SacpUdpChannel) {
            await this._prepareMachineSACP();
        }

        if (this.channel instanceof TextSerialChannel) {
            // Not implemented
            // M2000 U5 to switch protocol to SACP
            // (this.channel as SocketSerial).command(this.socket, {
            //    gcode: 'M2000 U5',
            // });
        }
    }

    public async onClosing(): Promise<void> {
        log.info('On closing connection...');

        log.info('Stop heartbeat.');
        // await this.channel.stopHeartbeat();
        // Remove await temporarily, it blocks other unsubscribes
        await this.channel.stopHeartbeat();

        await (this.channel as PrintJobChannelInterface).unsubscribeGetPrintCurrentLineNumber();

        log.info('Closing, cleanup done.');
    }
}

export default RayMachineInstance;
