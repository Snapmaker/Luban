import TaskManager, {
    Task,
    TASK_TYPE_GENERATE_GCODE,
    TASK_TYPE_GENERATE_TOOLPATH,
    TASK_TYPE_GENERATE_VIEWPATH,
    TASK_TYPE_PROCESS_IMAGE,
    TASK_TYPE_CUT_MODEL
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
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_TOOLPATH, task.headType, task.modelId));
};

const addGenerateGcodeTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_GCODE, task.headType));
};

const addGenerateViewPathTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_GENERATE_VIEWPATH, task.headType));
};

const addProcessImageTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_PROCESS_IMAGE, task.headType));
};

const addCutModelTask = (socket, task) => {
    instance.addTask(new Task(task.taskId, socket, task.data, TASK_TYPE_CUT_MODEL, task.headType));
};

export default {
    instance,
    start,
    stop,
    addGenerateToolPathTask,
    addGenerateGcodeTask,
    addProcessImageTask,
    addCutModelTask,
    addGenerateViewPathTask
};
