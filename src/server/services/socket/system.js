import { freemem } from 'os';

const getSystemFreeMemorySize = (actions) => {
    actions.next(freemem() / 1024);
    actions.complete();
};

export default {
    getSystemFreeMemorySize
};
