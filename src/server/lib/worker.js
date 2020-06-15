import EventEmmiter from 'events';
import { KEY_MSG_TYPE, MessageTypes } from '../../shared/constants/task';

const { Worker, isMainThread, parentPort } = require('worker_threads');


export class WorkerController extends EventEmmiter {
    worker = null;

    taskName = null;

    constructor() {
        if (!isMainThread) process.exit();
        super();
        this.worker = new Worker('./worker.js');
        this.worker.on('message', this.onMessage.bind(this));
        this.worker.on('exit', (code) => {
            if (code !== 0) this.emit('message', { result: 'fail', tips: '处理线程意外终止' });
        });
    }

    startTask(taskName, data) {
        this.taskName = taskName;
        this.worker.postMessage({ taskName, data, [KEY_MSG_TYPE]: MessageTypes.StartTask });
    }

    onMessage(message) {
        this.emit('message', message);
    }
}

export class WorkerEntity extends EventEmmiter {
    constructor() {
        if (isMainThread) process.exit();
        super();
        parentPort.on('message', this.onMessage.bind(this));
    }

    onMessage(message) {
        const { [KEY_MSG_TYPE]: msgType, ...data } = message;
        this.emit(msgType, data);
    }

    postMessage(msgType, message) {
        parentPort.postMessage({ ...message, [KEY_MSG_TYPE]: msgType });
    }
}
