import TaskManager from './TaskManager';

const instance = new TaskManager();

async function loopFunc() {
    await instance.schedule();
    setTimeout(loopFunc, 1000);
}

const start = () => {
    loopFunc();
};

const stop = () => {
    // Keep empty currently
};

const taskCommit = (socket, task) => {
    instance.addTask(task, task.taskID);
};

const onConnection = (socket) => {
    instance.on('taskProgress', (progress) => {
        socket.emit('task:progress', progress);
    });

    instance.removeAllListeners('taskCompleted');
    instance.on('taskCompleted', (task) => {
        socket.emit('task:completed', {
            taskID: task.taskID,
            status: task.taskStatus,
            filename: task.filename
        });
    });
};

export default {
    instance,
    start,
    stop,
    taskCommit,
    onConnection
};
