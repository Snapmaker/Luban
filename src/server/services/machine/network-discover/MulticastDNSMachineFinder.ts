import EventEmitter from 'events';
import { some } from 'lodash';
import createMDNSClient from 'multicast-dns';

import { MachineFinder, NetworkedMachineInfo } from './NetworkedMachine';

interface MulticastDNSClient extends EventEmitter {
    query: (q: Array<{ name: string; type: string }>) => void;
}


class MulticastDNSMachineFinder implements MachineFinder {
    private client: MulticastDNSClient;

    // Map <IP, NetworkedMachine>
    // we use Map here to filter out duplicated machines with the same IP
    private networkedMachines = new Map<string, NetworkedMachineInfo>();

    private createMulticastDNSClient(): void {
        if (!this.client) {
            this.client = createMDNSClient();

            this.client.on('response', (response) => {
                const matched = some(response.answers, (answer) => {
                    return (answer.type === 'PTR' && answer.name === '_printer._udp.local');
                });

                if (matched && response.additionals.length > 0) {
                    const aRecord = response.additionals[0];
                    if (!aRecord.data) {
                        return;
                    }

                    const machine: NetworkedMachineInfo = {
                        name: aRecord.name,
                        address: aRecord.data,
                        lastSeen: +new Date(),
                    };

                    this.networkedMachines.set(machine.address, machine);
                }
            });
        }
    }

    private sendDiscoverMessage(): void {
        this.createMulticastDNSClient();

        this.client.query([
            {
                name: '_printer._tcp.local',
                type: 'PTR',
            },
            {
                name: '_printer._udp.local',
                type: 'PTR',
            }
        ]);
    }

    public async list(): Promise<NetworkedMachineInfo[]> {
        // send discover message
        this.sendDiscoverMessage();

        // wait to collect responses
        await new Promise((resolve) => setTimeout(() => resolve(true), 1000));

        const machines = [];

        const now = +new Date();
        for (const server of this.networkedMachines.values()) {
            if (now - server.lastSeen <= 10000) {
                machines.push(server);
            }
        }

        return machines;
    }
}

export default MulticastDNSMachineFinder;
