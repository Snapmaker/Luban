import { WorkerEntity, MessageTypes } from './lib/worker';

import getTaskHandler from './workers';

const entity = new WorkerEntity();
console.log('aaaa', MessageTypes.StartTask);
entity.on(MessageTypes.StartTask, (task) => {
    console.log('worker received event', task);
    const { taskName, data } = task;
    const handler = getTaskHandler(taskName);
    handler.startTask({
        data,
        onProgress: (message) => {
            console.log('server.worker', message, ...message);
            entity.postMessage(MessageTypes.Message, { ...message, type: 'progress' });
        },
        onComplete: (message) => {
            entity.postMessage(MessageTypes.Complete, { ...message, type: 'complete' });
        },
        onFail: (message) => {
            entity.postMessage(MessageTypes.Complete, { ...message, type: 'fail' });
        }
    });
});

console.log('bbbb');
// const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');


// parentPort.on('message', (ev) => {
//     console.log(ev);
// });
// const msg = '工作线程向主线程发送消息';
// parentPort.postMessage(msg); // 也可以是self.postMessage, msg可以直接是对象
