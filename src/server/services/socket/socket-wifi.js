import serverManager from '../../lib/ServerManager';

export const httpDiscover = (socket) => {
    serverManager.refreshDevices();

    serverManager.once('devices', (devices) => {
        socket.emit('discoverSnapmaker:devices', devices);
    });
};
