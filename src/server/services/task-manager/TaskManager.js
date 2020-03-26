import EventEmitter from 'events';
import logger from '../../lib/logger';
import { generateToolPath } from './generateToolPath';
import { generateGcode } from './generateGcode';

const log = logger('service:TaskManager');

const MAX_TRY_COUNT = 2;

const TASK_STATUS_IDLE = 'idle';
const TASK_STATUS_DEPRECATED = 'deprecated';
const TASK_STATUS_FAILED = 'failed';
const TASK_STATUS_COMPLETED = 'completed';

export const TASK_TYPE_GENERATE_TOOLPATH = 'generateToolPath';
export const TASK_TYPE_GENERATE_GCODE = 'generateGcode';


class TaskManager extends EventEmitter {
    constructor() {
        super();

        this.tasks = [];
        this.status = 'idle'; // idle, running
        this.counter = 0;
    }

    hasIdleTask() {
        for (const task of this.tasks) {
            if (task.taskStatus === TASK_STATUS_IDLE && task.failedCount < MAX_TRY_COUNT) {
                return true;
            }
        }
        return false;
    }

    // TODO: use another to do CPU intense workload.
    async schedule() {
        if (this.status === 'running') {
            log.info('Scheduling task Missed');
            return;
        }

        // Mark as running
        this.status = 'running';

        let taskSelected = null;
        for (const task of this.tasks) {
            if (task.taskStatus === TASK_STATUS_IDLE && task.failedCount < MAX_TRY_COUNT) {
                taskSelected = task;
                break;
            }
        }
        if (taskSelected !== null) {
            // Add counter
            this.counter++;
            if (this.counter % 20 === 0) {
                log.info('Scheduling task * 20');
            }

            log.debug(taskSelected);

            if (taskSelected.taskType === 'generateToolPath') {
                await this.generateToolPathTaskHandle(taskSelected);
            } else if (taskSelected.taskType === 'generateGcode') {
                await this.generateGcodeTaskHandle(taskSelected);
            } else {
                taskSelected.taskStatus = TASK_STATUS_DEPRECATED;
            }
        }

        this.status = 'idle';
    }

    async generateToolPathTaskHandle(taskSelected) {
        try {
            let currentProgress = 0;
            const res = await generateToolPath(taskSelected.data, (p) => {
                if (p - currentProgress > 0.05) {
                    currentProgress = p;
                    taskSelected.socket.emit('taskProgress:generateGcode', {
                        progress: p,
                        headType: taskSelected.headType
                    });
                }
            });

            taskSelected.filename = res.filename;
            if (taskSelected.taskStatus !== TASK_STATUS_DEPRECATED) {
                taskSelected.taskStatus = TASK_STATUS_COMPLETED;
                taskSelected.finishTime = new Date().getTime();
                taskSelected.socket.emit('taskCompleted:generateToolPath', this.getTaskData(taskSelected));
            }
        } catch (e) {
            log.error(e);
            this.status = TASK_STATUS_IDLE;

            taskSelected.failedCount += 1;
            if (taskSelected.failedCount === MAX_TRY_COUNT) {
                taskSelected.taskStatus = TASK_STATUS_FAILED;
                taskSelected.finishTime = new Date().getTime();

                taskSelected.socket.emit('taskCompleted:generateToolPath', this.getTaskData(taskSelected));
            }
        }
    }

    async generateGcodeTaskHandle(taskSelected) {
        try {
            let currentProgress = 0;
            const res = await generateGcode(taskSelected.data, (p) => {
                if (p - currentProgress > 0.05) {
                    currentProgress = p;
                    taskSelected.socket.emit('taskProgress:generateGcode', {
                        progress: p,
                        headType: taskSelected.headType
                    });
                }
            });

            taskSelected.gcodeFile = res.gcodeFile;
            if (taskSelected.taskStatus !== TASK_STATUS_DEPRECATED) {
                taskSelected.taskStatus = TASK_STATUS_COMPLETED;
                taskSelected.finishTime = new Date().getTime();

                taskSelected.socket.emit('taskCompleted:generateGcode', this.getTaskData(taskSelected));
            }
        } catch (e) {
            log.error(e);
            this.status = TASK_STATUS_IDLE;

            taskSelected.failedCount += 1;
            if (taskSelected.failedCount === MAX_TRY_COUNT) {
                taskSelected.taskStatus = TASK_STATUS_FAILED;
                taskSelected.finishTime = new Date().getTime();

                taskSelected.socket.emit('taskCompleted:generateGcode', this.getTaskData(taskSelected));
            }
        }
    }

    addTask(socket, data, taskId, headType, taskType) {
        const task = {};
        task.socket = socket;
        task.taskId = taskId;
        task.taskType = taskType;
        task.headType = headType;
        task.data = data;
        task.taskStatus = TASK_STATUS_IDLE; // idle, previewing, previewed, deprecated
        task.failedCount = 0;
        task.finishTime = 0;
        // const { uploadName } = modelInfo;
        this.tasks.forEach(e => {
            if (e.taskId === taskId && e.taskType === taskType) {
                e.taskStatus = TASK_STATUS_DEPRECATED;
            }
        });
        this.tasks.push(task);

        const now = new Date().getTime();
        this.tasks = this.tasks.filter(t => {
            // Keep only unfinished tasks or recent (10 min) finished tasks
            return t.taskStatus !== TASK_STATUS_DEPRECATED
                && (t.finishTime === 0 || t.finishTime > now - 60 * 10);
        });
    }

    getTaskData(task) {
        return {
            ...task,
            socket: null
        };
    }
}

export default TaskManager;
