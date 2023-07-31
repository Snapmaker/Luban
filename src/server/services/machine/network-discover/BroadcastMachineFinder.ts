import { createSocket } from 'dgram';
import EventEmitter from 'events';
import zipWith from 'lodash/zipWith';
import os from 'os';

import { NetworkedMachineInfo } from './NetworkedMachine';
import { DISCOVER_SERVER_PORT, log } from './NetworkedMachineFinder';

/**
 * A singleton to manage devices remotely.
 */
export default class BroadcastMachineFinder extends EventEmitter {
    private client = createSocket('udp4');

    // Map <IP, NetworkedMachine>
    // we use Map here to filter out duplicated machines with the same IP
    private networkedMachines = new Map<string, NetworkedMachineInfo>();

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

            const device: NetworkedMachineInfo = {
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
                } else if (key === 'SACP') {
                    device.protocol = 'SACP';
                } else {
                    // unknown attribute
                    device[key.toLowerCase()] = value;
                }
            }
            device.lastSeen = +new Date();

            this.networkedMachines.set(address, device);
        });
    }

    private sendDiscoverMessage(): void {
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

    public async list(): Promise<NetworkedMachineInfo[]> {
        // send discover message
        this.sendDiscoverMessage();

        // wait to collect responses
        await new Promise((resolve) => setTimeout(() => resolve(true), 1000));


        // collect devices
        const recentMachines = [];
        const now = +new Date();
        for (const machine of this.networkedMachines.values()) {
            if (now - machine.lastSeen <= 10000) {
                recentMachines.push(machine);
            }
        }

        return recentMachines;
    }
}
