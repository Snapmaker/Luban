import ControllerEvent from '../../../app/connection/controller-events';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../constants';
import SocketServer from '../../lib/SocketManager';
import MachineDiscoverer from '../machine/MachineDiscoverer';
import socketHttp from '../machine/channels/socket-http';

interface DiscoverMachineOptions {
    connectionType: 'wifi' | 'serial';
}

const discoverMachine = (socket: SocketServer, options: DiscoverMachineOptions) => {
    const { connectionType } = options;

    switch (connectionType) {
        case CONNECTION_TYPE_WIFI: {
            socketHttp.refreshDevices();
            break;
        }
        case CONNECTION_TYPE_SERIAL: {
            const discoverer = MachineDiscoverer.getInstance();
            discoverer.discoverSerialPorts({
                callback: (discoverResult) => {
                    socket.emit('machine:serial-discover', discoverResult);
                }
            });
            break;
        }
        default:
            break;
    }
};

interface SubscribeDiscoverMachineOptions {
    connectionType: 'wifi' | 'serial';
}

const subscribeDiscoverMachine = (socket: SocketServer, options: SubscribeDiscoverMachineOptions) => {
    if (options.connectionType === CONNECTION_TYPE_WIFI) {
        socketHttp.onSubscribe(socket);
    } else if (options.connectionType === CONNECTION_TYPE_SERIAL) {
        const discoverer = MachineDiscoverer.getInstance();
        discoverer.subscribeDiscoverMachines({
            connectionType: CONNECTION_TYPE_SERIAL,
            interval: 3000,
            callback: (discoverResult) => {
                console.log('discoverResult =', discoverResult);
                socket.emit('machine:serial-discover', discoverResult);
            },
        });
    }
};

const unsubscribeDiscoverMachine = (socket: SocketServer, options: SubscribeDiscoverMachineOptions) => {
    if (options.connectionType === CONNECTION_TYPE_WIFI) {
        socketHttp.onDisSubscribe(socket);
    } else if (options.connectionType === CONNECTION_TYPE_SERIAL) {
        const discoverer = MachineDiscoverer.getInstance();
        discoverer.unsubscribeDiscoverMachines({
            connectionType: CONNECTION_TYPE_SERIAL,
        });
    }
};

function register(socketServer: SocketServer): void {
    socketServer.registerEvent(ControllerEvent.DiscoverMachine, discoverMachine);

    socketServer.registerEvent(ControllerEvent.DiscoverMachineStart, subscribeDiscoverMachine);
    socketServer.registerEvent(ControllerEvent.DiscoverMachineEnd, unsubscribeDiscoverMachine);
}

export {
    register
};
