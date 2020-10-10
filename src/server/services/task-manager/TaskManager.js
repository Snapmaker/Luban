import EventEmitter from 'events';
import logger from '../../lib/logger';
import { generateToolPath } from './generateToolPath';
import { generateGcode } from './generateGcode';
import { generateViewPath } from './generateViewPath';

const log = logger('service:TaskManager');

const MAX_TRY_COUNT = 2;

const TASK_STATUS_IDLE = 'idle';
const TASK_STATUS_DEPRECATED = 'deprecated';
const TASK_STATUS_FAILED = 'failed';
const TASK_STATUS_COMPLETED = 'completed';

export const TASK_TYPE_GENERATE_TOOLPATH = 'generateToolPath';
export const TASK_TYPE_GENERATE_VIEWPATH = 'generateViewPath';
export const TASK_TYPE_GENERATE_GCODE = 'generateGcode';

export class Task {
    constructor(taskId, socket, data, taskType, headType) {
        this.taskId = taskId;
        this.socket = socket;
        this.data = data;
        this.taskType = taskType;
        this.headType = headType;
        this.taskStatus = TASK_STATUS_IDLE; // idle, previewing, previewed, deprecated
        this.failedCount = 0;
        this.finishTime = 0;
    }

    equal(task) {
        return task && task.taskId === this.taskId && task.taskType === this.taskType;
    }

    getData() {
        return {
            ...this,
            socket: null
        };
    }
}

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

            // log.debug(taskSelected);

            await this.taskHandle(taskSelected);
        }

        this.status = 'idle';
    }

    async taskHandle(taskSelected) {
        try {
            let currentProgress = 0;
            const onProgress = (p) => {
                if (p - currentProgress > 0.05) {
                    currentProgress = p;
                    taskSelected.socket.emit(`taskProgress:${taskSelected.taskType}`, {
                        progress: p,
                        headType: taskSelected.headType
                    });
                }
            };
            if (taskSelected.taskType === TASK_TYPE_GENERATE_TOOLPATH) {
                const res = await generateToolPath(taskSelected.data, onProgress);
                taskSelected.filename = res.filename;
            } else if (taskSelected.taskType === TASK_TYPE_GENERATE_GCODE) {
                const res = await generateGcode(taskSelected.data, onProgress);
                taskSelected.gcodeFile = res.gcodeFile;
            } else if (taskSelected.taskType === TASK_TYPE_GENERATE_VIEWPATH) {
                const res = await generateViewPath(taskSelected.data, onProgress);
                taskSelected.viewPathFile = res.viewPathFile;
            }

            if (taskSelected.taskStatus !== TASK_STATUS_DEPRECATED) {
                taskSelected.taskStatus = TASK_STATUS_COMPLETED;
                taskSelected.finishTime = new Date().getTime();
                taskSelected.socket.emit(`taskCompleted:${taskSelected.taskType}`, taskSelected.getData());
            }
        } catch (e) {
            log.error(e);
            this.status = TASK_STATUS_IDLE;

            taskSelected.failedCount += 1;
            if (taskSelected.failedCount === MAX_TRY_COUNT) {
                taskSelected.taskStatus = TASK_STATUS_FAILED;
                taskSelected.finishTime = new Date().getTime();

                taskSelected.socket.emit(`taskCompleted:${taskSelected.taskType}`, taskSelected.getData());
            }
        }
    }

    addTask(task) {
        this.tasks.forEach(t => {
            if (t.equal(task)) {
                t.taskStatus = TASK_STATUS_DEPRECATED;
            }
        });
        this.tasks.push(task);

        this.cleanTasks();
    }

    cleanTasks() {
        const now = new Date().getTime();
        this.tasks = this.tasks.filter(t => {
            return t.taskStatus !== TASK_STATUS_DEPRECATED
                && (t.finishTime === 0 || t.finishTime > now - 60 * 10);
        });
    }
}

export default TaskManager;
