import { asyncFor } from '../../../shared/lib/array-async';
import { EPS } from '../../constants';
import logger from '../../lib/logger';
import { parseLubanGcodeHeader } from '../../lib/parseGcodeHeader';

import Task, { TGcodeFile } from './Task';
import workerManager, { IWorkerManager } from './workerManager';

const log = logger('service:TaskManager');

// const TASK_STATUS_IDLE = 'idle';
const TASK_STATUS_DEPRECATED = 'deprecated';
const TASK_STATUS_FAILED = 'failed';
const TASK_STATUS_COMPLETED = 'completed';

export const TASK_TYPE_GENERATE_TOOLPATH = 'generateToolPath';
export const TASK_TYPE_GENERATE_VIEWPATH = 'generateViewPath';
export const TASK_TYPE_GENERATE_GCODE = 'generateGcode';
export const TASK_TYPE_PROCESS_IMAGE = 'processImage';
export const TASK_TYPE_CUT_MODEL = 'cutModel';
export const TASK_TYPE_CLIPPING_SVG = 'svgClipping';

/**
 * Task Type to Runner name (i.e. Runner file name).
 */
const TASK_TYPE_RUNNER_MAP = {
    [TASK_TYPE_GENERATE_TOOLPATH]: 'generateToolPath',
    [TASK_TYPE_GENERATE_GCODE]: 'generateGcode',
    [TASK_TYPE_GENERATE_VIEWPATH]: 'generateViewPath',
    [TASK_TYPE_PROCESS_IMAGE]: 'processImage',
    [TASK_TYPE_CUT_MODEL]: 'cutModel',
    [TASK_TYPE_CLIPPING_SVG]: 'svgClipping',
};

type TPayload = {
    gcodeFile: {
        estimatedTime: string;
        boundingBox: string;
        name: string;
        size: string;
        lastModified: string;
        thumbnail: string;
    }
}

class TaskManager {
    private workerManager: IWorkerManager = workerManager;

    private tasks: Task[] = [];

    private exec(runnerName: string, task: Task) {
        const { terminate } = this.workerManager[runnerName]([task.data], (payload) => {
            if (payload.status === 'progress') {
                this.onProgress(task, payload.value);
            } else if (payload.status === 'complete') {
                this.onComplete(task, payload.value);
            } else if (payload.status === 'fail') {
                this.onFail(task, payload.value);
            }
        });
        task.terminateFn = terminate;
    }

    private onProgress(task: Task, p: number) {
        task.socket.emit(`taskProgress:${task.taskType}`, {
            progress: p,
            headType: task.headType
        });
    }

    private onComplete(task: Task, res: unknown) {
        log.info(`Task ${task.taskType} completed.`);

        if (task.taskType === TASK_TYPE_GENERATE_TOOLPATH) {
            task.filenames = res as string;
        } else if (task.taskType === TASK_TYPE_GENERATE_GCODE) {
            const gcodeHeader = parseLubanGcodeHeader((res as { filePath: string }).filePath);
            const gcodeFile = { ...(res as TPayload).gcodeFile, header: gcodeHeader };
            task.gcodeFile = gcodeFile as TGcodeFile;
        } else if (task.taskType === TASK_TYPE_GENERATE_VIEWPATH) {
            task.viewPathFile = (res as { viewPathFile: string }).viewPathFile;
        } else if (task.taskType === TASK_TYPE_PROCESS_IMAGE) {
            const { filename, width, height } = res as {
                filename: string, width: string, height: string
            };
            task.filename = filename;
            task.width = width;
            task.height = height;
        } else if (task.taskType === TASK_TYPE_CUT_MODEL) {
            const { stlFile, svgFiles } = res as {
                stlFile: string, svgFiles: string
            };
            task.stlInfo = stlFile;
            task.svgInfo = svgFiles;
        } else {
            task.result = res;
        }

        if (task.taskStatus !== TASK_STATUS_DEPRECATED) {
            task.taskStatus = TASK_STATUS_COMPLETED;
            task.finishTime = new Date().getTime();
            task.socket.emit(`taskCompleted:${task.taskType}`, task.getData());
        }
        this.tasks.splice(this.tasks.indexOf(task), 1);
    }

    private onFail(task: Task, res: string) {
        log.warn(`Task ${task.taskType} failed. err msg:`);
        log.warn(res);

        if (task.taskStatus !== TASK_STATUS_DEPRECATED) {
            task.taskStatus = TASK_STATUS_FAILED;
            task.finishTime = new Date().getTime();

            task.socket.emit(`taskCompleted:${task.taskType}`, task.getData());
        }
        this.tasks.splice(this.tasks.indexOf(task), 1);
    }

    private async taskHandle(task: Task) {
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

        const runnerName = TASK_TYPE_RUNNER_MAP[task.taskType];
        if (runnerName) {
            this.exec(runnerName, task);
        } else {
            log.warn(`task runner for ${task.taskType} no found`);
        }

        /*
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
        */
    }

    public async addTask(task: Task) {
        let exists = false;
        this.tasks.forEach((t) => {
            if (t.equal(task)) {
                t.taskStatus = TASK_STATUS_DEPRECATED;
                exists = true;
            }
        });
        if (!exists) {
            this.tasks.push(task);
        }

        this.taskHandle(task);
    }

    public cancelTask(taskId: string) {
        const res = this.tasks.find((task) => task.taskId === taskId);
        if (res) {
            res.terminateFn();
            log.info(`task: ${taskId} has been cancelled`);
        }
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

const addSVGClipping = (socket, task) => {
    manager.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_CLIPPING_SVG, task.headType));
};

const cancelTask = (socket, taskId) => {
    manager.cancelTask(taskId);
};

export default {
    addGenerateToolPathTask,
    addGenerateGcodeTask,
    addProcessImageTask,
    addCutModelTask,
    addGenerateViewPathTask,
    cancelTask,
    addSVGClipping
};
