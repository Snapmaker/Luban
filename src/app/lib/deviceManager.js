import EventEmitter from 'events';
import { createSocket } from 'dgram';
import logger from './logger';

const log = logger('lib:deviceManager');

const DISCOVER_SERVER_PORT = 20054;


/**
 * A singleton to manage devices remotely.
 */
class DeviceManager extends EventEmitter {
    client = createSocket('udp4');
    devices = [];
    refreshing = false;

    constructor() {
        super();
        this.init();
    }

    init() {
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

            const device = { name, address };
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                if (part.indexOf(':') === -1) {
                    continue;
                }
                const [key, value] = part.split(':');

                device[key.toLowerCase()] = value;
            }

            this.devices.push(device);
            this.emit('devices', this.devices);
        });
    }

    refreshDevices() {
        // Clear devices and send broadcast only when not refreshing to avoid duplicated refresh
        if (this.refreshing) {
            return;
        }

        this.refreshing = true;
        this.devices = [];

        const message = Buffer.from('discover');
        this.client.send(message, DISCOVER_SERVER_PORT, '172.18.1.255', (err) => {
            if (err) {
                log.error(err);
                this.refreshing = false;
            }
        });

        setTimeout(() => {
            this.refreshing = false;
        }, 3000);
    }
}

const deviceManager = new DeviceManager();

export default deviceManager;
