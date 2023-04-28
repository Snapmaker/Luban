import { Socket } from 'socket.io-client';

const TASK_STATUS_IDLE = 'idle';
export type TGcodeFile = {
    estimatedTime: string;
    boundingBox: string;
    name: string;
    size: string;
    lastModified: string;
    thumbnail: string;
    header: {
        type: string,
        'work_speed': string,
        'estimated_time': string,
        'jog_speed': string,
        power: string,
    }
}

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

    public filenames = '';

    public gcodeFile: TGcodeFile = {} as TGcodeFile;

    public viewPathFile = '';

    public filename = '';

    public width = '';

    public height = '';

    public stlInfo = '';

    public svgInfo = '';

    // result object that encapsure result of task
    public result = null;

    public terminateFn: () => void;

    public constructor(taskId: string, socket: Socket, data: {
        taskAsyncFor: unknown
    }, taskType: string, headType: string, modelId = '') {
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

    public equal(task: Task) {
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
