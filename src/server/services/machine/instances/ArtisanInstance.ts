import { includes } from 'lodash';

import {
    CNC_HEAD_MODULE_IDS,
    EMERGENCY_STOP_BUTTON,
    LASER_HEAD_MODULE_IDS,
    MODULEID_TOOLHEAD_MAP,
    PRINTING_HEAD_MODULE_IDS,
    ROTARY_MODULES,
} from '../../../../app/constants/machines';
import { SnapmakerArtisanMachine } from '../../../../app/machines';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import logger from '../../../lib/logger';
import SacpSerialChannel from '../channels/SacpSerialChannel';
import SocketSerial from '../channels/socket-serial';
import { ConnectedData } from '../types';
import MachineInstance from './Instance';

const log = logger('machine:ArtisanMachineInstance');


class ArtisanMachineInstance extends MachineInstance {
    public onMachineReady(): void {
        log.info('Machine is ready.');

        if (this.channel instanceof SacpSerialChannel) {
            this._onMachineReadySACP();
        }
        if (this.channel instanceof SocketSerial) {
            // Not implemented
        }
    }

    private async _onMachineReadySACP() {
        // TO DO: Need to get seriesSize for 'connection:connected' event
        const state: ConnectedData = {};

        // machine info
        state.series = SnapmakerArtisanMachine.identifier;

        // module info
        const { data: moduleInfos } = await (this.channel as SacpSerialChannel).getModuleInfo();

        const moduleListStatus = {
            // airPurifier: false,
            emergencyStopButton: false,
            // enclosure: false,
            rotaryModule: false
        };
        moduleInfos.forEach(module => {
            // let ariPurifier = false;
            if (includes(PRINTING_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_PRINTING;
                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
            } else if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_LASER;
                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
            } else if (includes(CNC_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_CNC;
                state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
            }
            if (includes(ROTARY_MODULES, module.moduleId)) {
                moduleListStatus.rotaryModule = true;
            }
            if (includes(EMERGENCY_STOP_BUTTON, module.moduleId)) {
                moduleListStatus.emergencyStopButton = true;
            }
        });
        state.moduleStatusList = moduleListStatus;


        // Get Coordinate Info
        const { data: coordinateInfos } = await (this.channel as SacpSerialChannel).getCoordinateInfo();
        const isHomed = !(coordinateInfos?.coordinateSystemInfo?.homed); // 0: homed, 1: need to home
        state.isHomed = isHomed;
        state.isMoving = false;

        this.socket.emit('connection:connected', { state: state, err: '' });

        // Start heartbeat
        (this.channel as SacpSerialChannel).startHeartbeat();
    }
}

export default ArtisanMachineInstance;
