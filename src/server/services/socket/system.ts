import { freemem } from 'os';

const getSystemFreeMemorySize = (actions) => {
    if (process.getSystemMemoryInfo) {
        actions.next(process.getSystemMemoryInfo().free);
    } else {
        actions.next(freemem() / 1024);
    }
    actions.complete();
};

export default {
    getSystemFreeMemorySize
};
