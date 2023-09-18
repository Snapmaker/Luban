import MachineInstance from './Instance';
import logger from '../../../lib/logger';

const log = logger('machine:instance:SM2Instance');

class SM2Instance extends MachineInstance {
    public async onPrepare(): Promise<void> {
        log.info('On preparing machine...');

        // Start heartbeat
        await this.channel.startHeartbeat();
    }
}

export default SM2Instance;
