import { SerialPort } from 'serialport';

import { CONNECTION_TYPE_SERIAL } from '../../constants';
import logger from '../../lib/logger';

const log = logger('service:machine:MachineDiscoverer');

interface DiscoverResult {
    devices: object[];
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

    public subscribeDiscoverMachines(options: SubscribeOptions): void {
        if (options.connectionType === CONNECTION_TYPE_SERIAL) {
            // In case has been subscribed
            if (this.serialPortTimer) {
                clearInterval(this.serialPortTimer);
                this.serialPortTimer = null;
            }

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
        if (options.connectionType === CONNECTION_TYPE_SERIAL) {
            if (this.serialPortTimer) {
                clearInterval(this.serialPortTimer);
                this.serialPortTimer = null;
            }
        }
    }
}

export default MachineDiscoverer;
