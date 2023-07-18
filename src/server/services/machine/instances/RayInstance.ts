import { includes } from 'lodash';

import {
    LASER_HEAD_MODULE_IDS,
    MODULEID_TOOLHEAD_MAP,
} from '../../../../app/constants/machines';
import { HEAD_LASER } from '../../../constants';
import logger from '../../../lib/logger';
import SocketSerialNew from '../channels/SACP-SERIAL';
import SocketSerial from '../channels/socket-serial';
import { ConnectedData } from '../types';
import MachineInstance from './Instance';

const log = logger('machine:RayMachineInstance');


class RayMachineInstance extends MachineInstance {
    public onMachineReady(): void {
        log.info('Machine is ready.');

        if (this.channel instanceof SocketSerialNew) {
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

        this.socket.emit('connection:connected', { state: state, err: '' });

        // TODO: Heartbeat is not working for now
        // (this.channel as SocketSerialNew).startHeartbeat();

        const { data: machineInfo } = await (this.channel as SocketSerialNew).getMachineInfo();
        console.log('machineInfo =', machineInfo);

        // module info
        const { data: moduleInfos } = await (this.channel as SocketSerialNew).getModuleInfo();
        console.log('moduleInfos =', moduleInfos);

        const moduleListStatus = {
            // airPurifier: false,
            emergencyStopButton: false,
            // enclosure: false,
            rotaryModule: false
        };

        moduleInfos.forEach(module => {
            // let ariPurifier = false;
            if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_LASER;
                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
            }
        });
        state.moduleStatusList = moduleListStatus;
    }
}

export default RayMachineInstance;
