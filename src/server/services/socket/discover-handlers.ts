import ControllerEvent from '../../../app/connection/controller-events';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../constants';
import type SocketServer from '../../lib/SocketManager';
import logger from '../../lib/logger';
import MachineDiscoverer from '../machine/MachineDiscoverer';


const log = logger('socket:discover-handlers');

interface DiscoverMachineOptions {
    connectionType: 'wifi' | 'serial';
}

const discoverMachine = (socket: SocketServer, options: DiscoverMachineOptions) => {
    const { connectionType } = options;

    switch (connectionType) {
        case CONNECTION_TYPE_WIFI: {
            const discoverer = MachineDiscoverer.getInstance();
            discoverer.discoverNetworkedMachines({
                callback: (discoverResult) => {
                    socket.emit('machine:discover', discoverResult);
                }
            });

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
    log.info('Subscribe discover machines...');
    if (options.connectionType === CONNECTION_TYPE_WIFI) {
        const discoverer = MachineDiscoverer.getInstance();
        discoverer.subscribeDiscoverMachines({
            connectionType: CONNECTION_TYPE_WIFI,
            interval: 5000,
            callback: (discoverResult) => {
                socket.emit('machine:discover', discoverResult);
            },
        });
    } else if (options.connectionType === CONNECTION_TYPE_SERIAL) {
        const discoverer = MachineDiscoverer.getInstance();
        discoverer.subscribeDiscoverMachines({
            connectionType: CONNECTION_TYPE_SERIAL,
            interval: 5000,
            callback: (discoverResult) => {
                socket.emit('machine:serial-discover', discoverResult);
            },
        });
    }
};

const unsubscribeDiscoverMachine = (socket: SocketServer, options: SubscribeDiscoverMachineOptions) => {
    log.info('Unsubscribe discover machines...');
    const discoverer = MachineDiscoverer.getInstance();
    discoverer.unsubscribeDiscoverMachines({
        connectionType: options.connectionType,
    });
};

function register(socketServer: SocketServer): void {
    socketServer.registerEvent(ControllerEvent.DiscoverMachine, discoverMachine);

    socketServer.registerEvent(ControllerEvent.DiscoverMachineStart, subscribeDiscoverMachine);
    socketServer.registerEvent(ControllerEvent.DiscoverMachineEnd, unsubscribeDiscoverMachine);
}

export {
    register
};
