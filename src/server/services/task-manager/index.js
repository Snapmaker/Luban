import TaskManager, { TASK_TYPE_GENERATE_GCODE, TASK_TYPE_GENERATE_TOOLPATH } from './TaskManager';

const instance = new TaskManager();

async function loopFunc() {
    await instance.schedule();
    if (instance.hasIdleTask()) {
        setTimeout(loopFunc, 50);
    } else {
        setTimeout(loopFunc, 500);
    }
}

const start = () => {
    loopFunc();
};

const stop = () => {
    // Keep empty currently
};

const addGenerateToolPathTask = (socket, task) => {
    instance.addTask(task.data, task.taskId, task.headerType, TASK_TYPE_GENERATE_TOOLPATH);
};

const addGenerateGcodeTask = (socket, task) => {
    instance.addTask(task.data, task.taskId, task.headerType, TASK_TYPE_GENERATE_GCODE);
};

const onConnection = (socket) => {
    instance.removeAllListeners('taskProgress:generateToolPath');
    instance.removeAllListeners('taskProgress:generateGcode');
    instance.removeAllListeners('taskCompleted:generateToolPath');
    instance.removeAllListeners('taskCompleted:generateGcode');
    instance.on('taskProgress:generateToolPath', (progress) => {
        socket.emit('taskProgress:generateToolPath', progress);
    });
    instance.on('taskProgress:generateGcode', (progress) => {
        socket.emit('taskProgress:generateGcode', progress);
    });

    instance.on('taskCompleted:generateToolPath', (task) => {
        socket.emit('taskCompleted:generateToolPath', task);
    });
    instance.on('taskCompleted:generateGcode', (task) => {
        socket.emit('taskCompleted:generateGcode', task);
    });
};

export default {
    instance,
    start,
    stop,
    addGenerateToolPathTask,
    addGenerateGcodeTask,
    onConnection
};
