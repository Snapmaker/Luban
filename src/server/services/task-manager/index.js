import TaskManager, {
    TASK_TYPE_GENERATE_GCODE,
    TASK_TYPE_GENERATE_TOOLPATH,
    TASK_TYPE_PROCESS_IMAGE
} from './TaskManager';

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
    instance.addTask(socket, task.data, task.taskId, task.headType, TASK_TYPE_GENERATE_TOOLPATH);
};

const addGenerateGcodeTask = (socket, task) => {
    instance.addTask(socket, task.data, task.taskId, task.headType, TASK_TYPE_GENERATE_GCODE);
};

const addProcessImageTask = (socket, task) => {
    instance.addTask(socket, task.data, task.taskId, task.headType, TASK_TYPE_PROCESS_IMAGE);
};

export default {
    instance,
    start,
    stop,
    addGenerateToolPathTask,
    addGenerateGcodeTask,
    addProcessImageTask
};
