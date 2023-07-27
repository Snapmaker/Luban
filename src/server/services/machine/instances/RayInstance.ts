import { includes } from 'lodash';

import {
    LASER_HEAD_MODULE_IDS,
    MODULEID_TOOLHEAD_MAP,
} from '../../../../app/constants/machines';
import { HEAD_LASER } from '../../../constants';
import logger from '../../../lib/logger';
import SacpSerialChannel from '../channels/SacpSerialChannel';
import SacpUdpChannel from '../channels/SacpUdpChannel';
import SocketSerial from '../channels/socket-serial';
import { ConnectedData } from '../types';
import MachineInstance from './Instance';
import { SnapmakerRayMachine } from '../../../../app/machines';

const log = logger('services:machine:instances:RayInstance');


class RayMachineInstance extends MachineInstance {
    public onMachineReady(): void {
        log.info('Machine is ready.');

        if (this.channel instanceof SacpSerialChannel) {
            this._onMachineReadySACP();
        } else if (this.channel instanceof SacpUdpChannel) {
            this._onMachineReadySACP();
        }

        if (this.channel instanceof SocketSerial) {
            // Not implemented
            // M2000 U5 to switch protocol to SACP
            // (this.channel as SocketSerial).command(this.socket, {
            //    gcode: 'M2000 U5',
            // });
        }
    }

    private async _onMachineReadySACP() {
        const state: ConnectedData = {};

        // TODO: Heartbeat is not working for now
        // (this.channel as SocketSerialNew).startHeartbeat();

        // Get Machine Info
        const { data: machineInfo } = await (this.channel as SacpSerialChannel).getMachineInfo();
        log.info(`Machine Firmware Version: ${machineInfo.masterControlFirmwareVersion}`);

        state.series = SnapmakerRayMachine.identifier;

        // module info
        const { data: moduleInfos } = await (this.channel as SacpSerialChannel).getModuleInfo();
        console.log('moduleInfos =', moduleInfos);

        /*
        moduleInfos = [
          ,
          ModuleInfo {
            key: 2,
            moduleId: 518,
            moduleIndex: 0,
            moduleState: 2,
            serialNumber: 524287,
            hardwareVersion: 255,
            moduleFirmwareVersion: 'v1.0.0',
            byteLength: 18
          },
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
    }
}

export default RayMachineInstance;
