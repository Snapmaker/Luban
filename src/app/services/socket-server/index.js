import SocketServer from './SocketServer';

const instance = new SocketServer();

const start = (server) => {
    instance.start(server);
};

const stop = () => {
    instance.stop();
};

export default {
    instance,
    start,
    stop
};
