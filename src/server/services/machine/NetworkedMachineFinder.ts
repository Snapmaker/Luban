import { createSocket } from 'dgram';
import EventEmitter from 'events';
import zipWith from 'lodash/zipWith';
import os from 'os';

import logger from '../../lib/logger';

const log = logger('lib:deviceManager');

const DISCOVER_SERVER_PORT = 20054;

export interface NetworkedMachine {
    name: string;
    address: string; // IP address
    lastSeen: number; // timestamp
    model?: string; // indicates which machine model it is
    protocol?: string; // indicates which protocol it uses
}


/**
 * A singleton to manage devices remotely.
 */
class NetworkedMachineFinder extends EventEmitter {
    private client = createSocket('udp4');
    private networkedMachines = new Map<string, NetworkedMachine>();

    public constructor() {
        super();
        this.init();
    }

    public init(): void {
        this.client.bind(() => {
            this.client.setBroadcast(true);
        });

        this.client.on('message', (msg) => {
            const message = msg.toString('utf8');

            const parts = message.split('|');
            if (parts.length === 0 || parts[0].indexOf('@') === -1) {
                // Not a valid message
                return;
            }
            const [name, address] = parts[0].split('@');

            const device: NetworkedMachine = {
                name,
                address,
                lastSeen: 0,
            };
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                if (part.indexOf(':') === -1) {
                    continue;
                }
                const [key, value] = part.split(':');

                if (key === 'model') {
                    device.model = value;
                } else if (key === 'sacp') {
                    device.protocol = 'sacp';
                } else {
                    // unknown attribute
                    device[key.toLowerCase()] = value;
                }
            }
            device.lastSeen = +new Date();

            this.networkedMachines.set(address, device);
        });
    }

    private sendDiscoverMessage() {
        const message = Buffer.from('discover');

        const ifaces = os.networkInterfaces();
        for (const key of Object.keys(ifaces)) {
            const iface = ifaces[key];
            for (const address of iface) {
                if (address.family === 'IPv4' && !address.internal) {
                    const broadcastAddress = zipWith(
                        address.address.split('.').map(d => Number(d)),
                        address.netmask.split('.').map(d => Number(d)),
                        (p, q) => {
                            return (p | (~q & 255));
                        }
                    ).join('.');

                    this.client.send(message, DISCOVER_SERVER_PORT, broadcastAddress, (err) => {
                        if (err) {
                            log.error(err.message);
                        }
                    });
                }
            }
        }
    }

    public async list(): Promise<NetworkedMachine[]> {
        // send discover message
        this.sendDiscoverMessage();

        // debounce to avoid multiple sequential calls
        // Note: 500ms reaction time, 3000ms is too long.
        await new Promise((resolve) => setTimeout(() => resolve(true), 1000));

        const newTime = +new Date();

        // collect devices
        const recentMachines = [];
        for (const server of this.networkedMachines.values()) {
            if (newTime - server.lastSeen <= 10000) {
                recentMachines.push(server);
            }
        }

        return recentMachines;
    }
}

const networkedMachineFinder = new NetworkedMachineFinder();

export default networkedMachineFinder;
