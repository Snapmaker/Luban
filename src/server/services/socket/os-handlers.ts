import os from 'os';
import wifi from 'node-wifi';

import type SocketServer from '../../lib/SocketManager';
import SocketEvent from '../../../app/communication/socket-events';
import logger from '../../lib/logger';


const log = logger('socket:os-handlers');


const listAvaiableNetworks = (socket) => {
    const interfaces = os.networkInterfaces();

    const ipv4Interfaces = Object.keys(interfaces).filter((iface) => {
        const addresses = interfaces[iface];

        return addresses.some(address => address.family === 'IPv4' && !address.internal);
    });

    const emitNetworks = (networks) => {
        socket.emit(SocketEvent.ListWiFiNetworks, networks);
    };

    if (ipv4Interfaces.length === 0) {
        log.error('No available IPv4 interfaces.');
        emitNetworks([]);
        return;
    }

    // Use first interface
    wifi.init({
        iface: ipv4Interfaces[0],
    });

    wifi.scan((error, networks) => {
        if (error) {
            log.error(error);
            emitNetworks([]);
        } else {
            const networkMap = new Map<string, number>();
            for (const network of networks) {
                const signalLevel = network.signal_level;

                if (!networkMap.has(network.ssid) || signalLevel < networkMap[network.ssid]) {
                    networkMap[network.ssid] = signalLevel;
                }
                // networkMap.add(network.ssid);
            }

            const networkResult: string[] = Object.entries(networkMap)
                .sort((a, b) => b[1] - a[1]) // bigger signal first
                .map(pair => pair[0]);

            emitNetworks(networkResult);
        }
    });
};


function register(socketServer: SocketServer): void {
    socketServer.registerEvent(SocketEvent.ListWiFiNetworks, listAvaiableNetworks);
}

export {
    register,
};
