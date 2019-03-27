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

export default {
    instance,
    start,
    stop
};
