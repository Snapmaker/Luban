import EventEmmiter from 'events';

const { Worker, isMainThread, parentPort } = require('worker_threads');


const KEY_MSG_TYPE = '__KEY_MSG_TYPE__';

export const MessageTypes = {
    StartTask: '__START_TASK__',
    Message: '__MESSAGE__',
    Complete: '__COMPLETE__',
    Fail: '__FAIL__'
};

export class WorkerController extends EventEmmiter {
    worker = null;

    constructor() {
        if (!isMainThread) process.exit();
        super();
        this.worker = new Worker('./worker.js');
        this.worker.on('message', this.onMessage.bind(this));
        this.worker.on('exit', (code) => {
            if (code !== 0) this.emit('fail', '处理线程意外终止');
        });
    }

    startTask(taskName, data) {
        this.worker.postMessage({ taskName, data, [KEY_MSG_TYPE]: MessageTypes.StartTask });
    }

    onMessage(message) {
        console.log('controller received', message);
    }
}

export class WorkerEntity extends EventEmmiter {
    constructor() {
        if (isMainThread) process.exit();
        super();
        parentPort.on('message', this.onMessage.bind(this));
    }

    onMessage(message) {
        console.log('worker received:', message);
        const { [KEY_MSG_TYPE]: msgType, ...data } = message;

        console.log(msgType, data);
        this.emit(msgType, data);
    }

    postMessage(msgType, message) {
        console.log('----', msgType, message);
        parentPort.postMessage({ ...message, [KEY_MSG_TYPE]: msgType });
    }
}
