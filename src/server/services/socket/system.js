import { freemem } from 'os';
import isElectron from 'is-electron';

const getSystemFreeMemorySize = (actions) => {
    if (isElectron) {
        actions.next(process.getSystemMemoryInfo().free);
    } else {
        actions.next(freemem() / 1024);
    }
    actions.complete();
};

export default {
    getSystemFreeMemorySize
};
