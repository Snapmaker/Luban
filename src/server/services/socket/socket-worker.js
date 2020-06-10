import { WorkerController } from '../../lib/worker';

const create = (socket, params) => {
    const { taskName, ...data } = params;
    const worker = new WorkerController();

    worker.startTask(taskName, data);

    worker.on('progress', (message) => {
        socket.emit('worker.progress', message);
    });
};

export default {
    create
};
