import { includes } from 'lodash';

import {
    CNC_HEAD_MODULE_IDS,
    EMERGENCY_STOP_BUTTON,
    LASER_HEAD_MODULE_IDS,
    MODULEID_TOOLHEAD_MAP,
    PRINTING_HEAD_MODULE_IDS,
    ROTARY_MODULES,
} from '../../../../app/constants/machines';
import { SnapmakerJ1Machine } from '../../../../app/machines';
import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../../constants';
import logger from '../../../lib/logger';
import SacpSerialChannel from '../channels/SacpSerialChannel';
import SacpTcpChannel from '../channels/SacpTcpChannel';
import TextSerialChannel from '../channels/TextSerialChannel';
import { ConnectedData } from '../types';
import MachineInstance from './Instance';

const log = logger('machine:instance:J1Instance');


class J1MachineInstance extends MachineInstance {
    public async onPrepare(): Promise<void> {
        log.info('onPrepare');

        if (this.channel instanceof SacpSerialChannel) {
            await this._onMachineReadySACP();
        } else if (this.channel instanceof SacpTcpChannel) {
            await this._onMachineReadySACP();
        }
        if (this.channel instanceof TextSerialChannel) {
            // Not implemented
        }
    }

    private async _onMachineReadySACP() {
        // TO DO: Need to get seriesSize for 'connection:connected' event
        const state: ConnectedData = {};

        // machine info
        state.series = SnapmakerJ1Machine.identifier;

        // module info
        const { data: moduleInfos } = await (this.channel as SacpSerialChannel).getModuleInfo();

        const moduleListStatus = {
            // airPurifier: false,
            emergencyStopButton: false,
            // enclosure: false,
            rotaryModule: false
        };

        const toolHeadModules = [];
        moduleInfos.forEach(module => {
            if (includes(PRINTING_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_PRINTING;
                toolHeadModules.push(module);
            } else if (includes(LASER_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_LASER;
                toolHeadModules.push(module);
            } else if (includes(CNC_HEAD_MODULE_IDS, module.moduleId)) {
                state.headType = HEAD_CNC;
                toolHeadModules.push(module);
            }
            if (includes(ROTARY_MODULES, module.moduleId)) {
                moduleListStatus.rotaryModule = true;
            }
            if (includes(EMERGENCY_STOP_BUTTON, module.moduleId)) {
                moduleListStatus.emergencyStopButton = true;
            }
        });

        if (toolHeadModules.length === 0) {
            state.toolHead = MODULEID_TOOLHEAD_MAP['0']; // default extruder
        } else if (toolHeadModules.length === 1) {
            const module = toolHeadModules[0];
            state.toolHead = MODULEID_TOOLHEAD_MAP[module.moduleId];
        } else if (toolHeadModules.length === 2) {
            // hard-coded IDEX head for J1, refactor this later.
            state.toolHead = MODULEID_TOOLHEAD_MAP['00'];
        }

        state.moduleStatusList = moduleListStatus;

        // Get Coordinate Info
        // const { data: coordinateInfos } = await this.channel.getCoordinateInfo();
        // const isHomed = !(coordinateInfos?.coordinateSystemInfo?.homed); // 0: homed, 1: need to home
        // For J1, it's not need to go home when connected
        state.isHomed = true;
        state.isMoving = false;

        this.socket.emit('connection:connected', { state: state, err: '' });

        // Start heartbeat
        await this.channel.startHeartbeat();
    }
}

export default J1MachineInstance;
