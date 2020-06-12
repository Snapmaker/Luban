import { WorkerController } from '../../lib/worker';

const create = (socket, params) => {
    console.log('received task', params);
    const { taskName, taskId, ...data } = params;
    const worker = new WorkerController();

    worker.startTask(taskName, data);

    worker.on('message', (message) => {
        socket.emit(taskName, { ...message, taskId });
    });
};

export default {
    create
};
