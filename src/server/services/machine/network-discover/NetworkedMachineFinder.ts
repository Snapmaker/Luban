
import logger from '../../../lib/logger';
import { MachineFinder, NetworkedMachineInfo } from './NetworkedMachine';
import MulticastDNSMachineFinder from './MulticastDNSMachineFinder';
import BroadcastMachineFinder from './BroadcastMachineFinder';

export const log = logger('machine:network-discover:NetworkedMachineFinder');

export const DISCOVER_SERVER_PORT = 20054;


class NetworkedMachineFinder implements MachineFinder {
    private finders: MachineFinder[] = [];

    public constructor() {
        this.finders.push(new BroadcastMachineFinder());
        this.finders.push(new MulticastDNSMachineFinder());
    }

    public async list(): Promise<NetworkedMachineInfo[]> {
        const result = [];

        for (const finder of this.finders) {
            const machines = await finder.list();
            result.push(...machines);
        }

        return result;
    }
}

const networkedMachineFinder = new NetworkedMachineFinder();

export default networkedMachineFinder;
