import { SerialPort } from 'serialport';

import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../constants';
import logger from '../../lib/logger';
import { NetworkedMachine } from './network-discover/NetworkedMachine';
import networkedMachineFinder from './network-discover/NetworkedMachineFinder';

const log = logger('service:machine:MachineDiscoverer');

interface DiscoverResult {
    devices: object[] | NetworkedMachine[];
}

interface DiscoverOptions {
    callback: (discoverResult: DiscoverResult) => void;
}

interface SubscribeOptions {
    connectionType: 'wifi' | 'serial';
    interval?: number; // in milliseconds
    callback: (discoverResult: DiscoverResult) => void;
}

interface UnsubscribeOptions {
    connectionType: 'wifi' | 'serial';
}

class MachineDiscoverer {
    private static instance = null;

    public static getInstance(): MachineDiscoverer {
        if (!this.instance) {
            this.instance = new MachineDiscoverer();
        }
        return this.instance;
    }

    private serialPortTimer = null;
    private networkTimer = null;

    public async discoverSerialPorts(options: DiscoverOptions): Promise<void> {
        try {
            const ports = await SerialPort.list();

            const availablePorts = ports
                .filter((port) => {
                    return port.productId;
                })
                .map((port) => {
                    return {
                        port: port.path,
                        manufacturer: port.manufacturer,
                        serialNumber: port.serialNumber,
                    };
                });

            options.callback({
                devices: availablePorts,
            });
        } catch (err) {
            log.error(err);
        }
    }

    public async discoverNetworkedMachines(options: DiscoverOptions): Promise<void> {
        try {
            const devices = await networkedMachineFinder.list();
            options.callback({
                devices: devices,
            });
        } catch (err) {
            log.error(err);
        }
    }

    public subscribeDiscoverMachines(options: SubscribeOptions): void {
        if (options.connectionType === CONNECTION_TYPE_WIFI) {
            // In case has been subscribed
            if (this.networkTimer) {
                clearInterval(this.networkTimer);
                this.networkTimer = null;
            }

            // get immediately
            this.discoverNetworkedMachines({
                callback: options.callback,
            });

            // start discover periodically
            const interval = options?.interval || 10000; // 10s by default
            this.networkTimer = setInterval(() => {
                this.discoverNetworkedMachines({
                    callback: options.callback,
                });
            }, interval);
        } else if (options.connectionType === CONNECTION_TYPE_SERIAL) {
            // In case has been subscribed
            if (this.serialPortTimer) {
                clearInterval(this.serialPortTimer);
                this.serialPortTimer = null;
            }

            // get immediately
            this.discoverSerialPorts({
                callback: options.callback,
            });

            // start list serial ports periodically
            const interval = options?.interval || 10000; // 10s by default
            this.serialPortTimer = setInterval(() => {
                this.discoverSerialPorts({
                    callback: options.callback,
                });
            }, interval);
        }
    }

    public unsubscribeDiscoverMachines(options: UnsubscribeOptions): void {
        if (options.connectionType === CONNECTION_TYPE_WIFI) {
            if (this.networkTimer) {
                clearInterval(this.networkTimer);
                this.networkTimer = null;
            }
        } else if (options.connectionType === CONNECTION_TYPE_SERIAL) {
            if (this.serialPortTimer) {
                clearInterval(this.serialPortTimer);
                this.serialPortTimer = null;
            }
        }
    }
}

export default MachineDiscoverer;
