import { Socket } from 'socket.io-client';

const TASK_STATUS_IDLE = 'idle';

class Task {
    public taskId: string;

    private modelId: string;

    public socket: Socket;

    public data: {
        taskAsyncFor: unknown
    };

    public taskType: string;

    public headType: string;

    public taskStatus: string;

    public failedCount: number;

    public finishTime: number;

    public filenames = ''

    public gcodeFile = ''

    public viewPathFile = ''

    public filename = ''

    public width = ''

    public height = ''

    public stlInfo = ''

    public svgInfo = ''

    public terminateFn: Function = () => {};

    constructor(taskId, socket, data, taskType, headType, modelId = '') {
        this.taskId = taskId;
        this.modelId = modelId;
        this.socket = socket;
        this.data = data;
        this.taskType = taskType;
        this.headType = headType;
        this.taskStatus = TASK_STATUS_IDLE; // idle, previewing, previewed, deprecated
        this.failedCount = 0;
        this.finishTime = 0;
    }

    public equal(task) {
        return task && task.taskId === this.taskId && task.taskType === this.taskType && task.modelId === this.modelId;
    }

    public getData() {
        return {
            ...this,
            socket: null
        };
    }
}

export default Task;
