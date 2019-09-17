import serverManager from '../../lib/ServerManager';

const onConnection = (socket) => {
    serverManager.on('servers', (servers) => {
        socket.emit('http:discover', servers);
    });
};

const handleDiscover = () => {
    serverManager.refreshDevices();
};

export default {
    onConnection,
    handleDiscover
};
