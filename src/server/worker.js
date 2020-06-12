
import { WorkerEntity } from './lib/worker';
import { MessageTypes } from '../shared/constants/task';

import getTaskHandler from './tasks';

const entity = new WorkerEntity();

entity.on(MessageTypes.StartTask, (task) => {
    console.log('worker received event', task);
    const { taskName, data } = task;
    const handler = getTaskHandler(taskName);
    try {
        handler.startTask({
            data,
            onProgress: (message) => {
                entity.postMessage(MessageTypes.Progress, message);
            },
            onComplete: (message) => {
                entity.postMessage(MessageTypes.Complete, message);
            },
            onFail: (message) => {
                entity.postMessage(MessageTypes.Fail, message);
            }
        }).catch(e => { console.log('task Promise reject', e); });
    } catch (e) {
        console.log('task process exception', e);
    }
});
