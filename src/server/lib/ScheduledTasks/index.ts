import schedule from 'node-schedule';
import EventEmitter from 'events';
import { Socket } from 'socket.io';

import logger from '../logger';

const log = logger('service:schedule-task');

class ScheduledTasks extends EventEmitter {
    private socket: Socket;

    private taskHandles: schedule.Job[] = [];

    public constructor(socket) {
        super();
        this.socket = socket;
        log.warn('Starting ...........^v^');

        this.dailyLifeLog();

        log.warn('started...........^v^');
    }

    public cancelTasks() {
        this.taskHandles.forEach((job) => {
            job.cancel();
        });
        log.warn('cancelled...........^v^');
        this.taskHandles = [];
    }

    private dailyLifeLog() {
        const job = schedule.scheduleJob('0 0 */12 * * *', (dt) => {
            const tm = new Date();
            log.info(`Start schedule job:dailyLifeLog, which is supposed to run at:${dt.toUTCString()}, but actually ran at ${tm.toUTCString()}`);

            this.socket.emit('daily:heartbeat');
        });
        this.taskHandles.push(job);
    }
}

export default ScheduledTasks;
