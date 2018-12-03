import CNCEngine from './CNCEngine';

const instance = new CNCEngine();

const start = (server, controller) => {
    instance.start(server, controller);
};

const stop = () => {
    instance.stop();
};

export default {
    instance,
    start,
    stop
};
