import SocketEvent from '../../../app/communication/socket-events';
import type SocketServer from '../../lib/SocketManager';
import logger from '../../lib/logger';
import MachineDiscoverer from '../machine/MachineDiscoverer';
import { ConnectionType } from '../machine/types';


const log = logger('socket:discover-handlers');

interface DiscoverMachineOptions {
    connectionType: 'wifi' | 'serial';
}

const discoverMachine = (socket: SocketServer, options: DiscoverMachineOptions) => {
    const { connectionType } = options;

    switch (connectionType) {
        case ConnectionType.WiFi: {
            const discoverer = MachineDiscoverer.getInstance();
            discoverer.discoverNetworkedMachines({
                callback: (discoverResult) => {
                    socket.emit('machine:discover', discoverResult);
                }
            });

            break;
        }
        case ConnectionType.Serial: {
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
    if (options.connectionType === ConnectionType.WiFi) {
        const discoverer = MachineDiscoverer.getInstance();
        discoverer.subscribeDiscoverMachines({
            connectionType: ConnectionType.WiFi,
            interval: 5000,
            callback: (discoverResult) => {
                socket.emit('machine:discover', discoverResult);
            },
        });
    } else if (options.connectionType === ConnectionType.Serial) {
        const discoverer = MachineDiscoverer.getInstance();
        discoverer.subscribeDiscoverMachines({
            connectionType: ConnectionType.Serial,
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
    socketServer.registerEvent(SocketEvent.DiscoverMachine, discoverMachine);

    socketServer.registerEvent(SocketEvent.DiscoverMachineStart, subscribeDiscoverMachine);
    socketServer.registerEvent(SocketEvent.DiscoverMachineEnd, unsubscribeDiscoverMachine);
}

export {
    register
};
