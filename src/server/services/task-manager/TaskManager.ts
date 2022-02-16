import logger from '../../lib/logger';
import { EPS } from '../../constants';
import Task from './Task';
import { asyncFor } from '../../../shared/lib/array-async';
import DataStorage from '../../DataStorage';
import workerManager from './workerManager';

// const TASK_STATUS_IDLE = 'idle';
const TASK_STATUS_DEPRECATED = 'deprecated';
const TASK_STATUS_FAILED = 'failed';
const TASK_STATUS_COMPLETED = 'completed';

export const TASK_TYPE_GENERATE_TOOLPATH = 'generateToolPath';
export const TASK_TYPE_GENERATE_VIEWPATH = 'generateViewPath';
export const TASK_TYPE_GENERATE_GCODE = 'generateGcode';
export const TASK_TYPE_PROCESS_IMAGE = 'processImage';
export const TASK_TYPE_CUT_MODEL = 'cutModel';

const log = logger('service:TaskManager');

class TaskManager {
    private workerManager = workerManager;

    private tasks: Task[] = []

    private exec(runnerName: string, task) {
        const tmpDir = DataStorage.tmpDir;
        this.workerManager[runnerName]([task.data, tmpDir], (payload) => {
            if (payload.status === 'progress') {
                this.onProgress(task, payload.value);
            } else if (payload.status === 'complete') {
                this.onComplete(task, payload.value);
            } else if (payload.status === 'fail') {
                this.onFail(task, payload.value);
            }
        });
    }

    private onProgress(task, p) {
        task.socket.emit(`taskProgress:${task.taskType}`, {
            progress: p,
            headType: task.headType
        });
    }

    private onComplete(task: Task, res: any) {
        if (task.taskType === TASK_TYPE_GENERATE_TOOLPATH) {
            task.filenames = res;
        } else if (task.taskType === TASK_TYPE_GENERATE_GCODE) {
            task.gcodeFile = res.gcodeFile;
        } else if (task.taskType === TASK_TYPE_GENERATE_VIEWPATH) {
            task.viewPathFile = res.viewPathFile;
        } else if (task.taskType === TASK_TYPE_PROCESS_IMAGE) {
            task.filename = res.filename;
            task.width = res.width;
            task.height = res.height;
        } else if (task.taskType === TASK_TYPE_CUT_MODEL) {
            task.stlInfo = res.stlFile;
            task.svgInfo = res.svgFiles;
        }

        if (task.taskStatus !== TASK_STATUS_DEPRECATED) {
            task.taskStatus = TASK_STATUS_COMPLETED;
            task.finishTime = new Date().getTime();
            task.socket.emit(`taskCompleted:${task.taskType}`, task.getData());
        }
    }

    private onFail(task: Task, res: string) {
        log.error(res);

        if (task.taskStatus !== TASK_STATUS_DEPRECATED) {
            task.taskStatus = TASK_STATUS_FAILED;
            task.finishTime = new Date().getTime();

            task.socket.emit(`taskCompleted:${task.taskType}`, task.getData());
        }
    }

    async taskHandle(task: Task) {
        let currentProgress = 0;
        const onProgress = (p) => {
            if (p - currentProgress > EPS) {
                currentProgress = p;
                task.socket.emit(`taskProgress:${task.taskType}`, {
                    progress: p,
                    headType: task.headType
                });
            }
        };

        const taskAsyncFor = async (start, end, interval = 1, func, asyncTime = 1000, setTime = 10) => {
            await asyncFor(start, end, interval, (i) => {
                if (task.taskStatus === TASK_STATUS_DEPRECATED) {
                    return;
                }
                func(i);
            }, asyncTime, setTime);
        };

        task.data.taskAsyncFor = taskAsyncFor;
        onProgress(0.05);

        if (task.taskType === TASK_TYPE_GENERATE_TOOLPATH) {
            this.exec('generateToolPath', task);
        } else if (task.taskType === TASK_TYPE_GENERATE_GCODE) {
            this.exec('generateGcode', task);
        } else if (task.taskType === TASK_TYPE_GENERATE_VIEWPATH) {
            this.exec('generateViewPath', task);
        } else if (task.taskType === TASK_TYPE_PROCESS_IMAGE) {
            this.exec('processImage', task);
        } else if (task.taskType === TASK_TYPE_CUT_MODEL) {
            this.exec('cutModel', task);
        }
    }

    public async addTask(task: Task) {
        this.tasks.forEach(t => {
            if (t.equal(task)) {
                t.taskStatus = TASK_STATUS_DEPRECATED;
            }
        });

        this.taskHandle(task);
    }
}

const manager = new TaskManager();

const addGenerateToolPathTask = (socket, taskArray) => {
    manager.addTask(new Task(taskArray[0].taskId, socket, taskArray, TASK_TYPE_GENERATE_TOOLPATH, taskArray[0].headType));
};

const addGenerateGcodeTask = (socket, task) => {
    manager.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_GCODE, task.headType));
};

const addGenerateViewPathTask = (socket, task) => {
    manager.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_VIEWPATH, task.headType));
};

const addProcessImageTask = (socket, task) => {
    manager.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_PROCESS_IMAGE, task.headType));
};

const addCutModelTask = (socket, task) => {
    manager.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_CUT_MODEL, task.headType));
};

export default {
    addGenerateToolPathTask,
    addGenerateGcodeTask,
    addProcessImageTask,
    addCutModelTask,
    addGenerateViewPathTask
};
