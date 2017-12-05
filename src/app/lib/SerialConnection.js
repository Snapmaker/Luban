import { EventEmitter } from 'events';
import SerialPort from 'serialport';
import logger from './logger';

const log = logger('lib:SerialConnection');
const Readline = SerialPort.parsers.Readline;

const defaultSettings = Object.freeze({
    baudRate: 115200
});

const toIdent = (options) => {
    // Only the path option is required for generate ident property
    const { port } = { ...options };
    return JSON.stringify({ type: 'serial', port: port });
};

class SerialConnection extends EventEmitter {
    type = 'serial';
    port = null; // Serialport
    parser = null; // Readline parser
    writeFilter = (data) => data;

    eventListener = {
        data: (data) => {
            this.emit('data', data);
        },
        open: () => {
            this.emit('open');
        },
        close: (err) => {
            if (err) {
                log.warn(`The serial port "${this.settings.port}" was disconnected from the host`);
            }
            this.emit('close', err);
        },
        error: (err) => {
            this.emit('error', err);
        }
    };

    constructor(options) {
        super();

        const { writeFilter } = { ...options };

        if (writeFilter) {
            if (typeof writeFilter !== 'function') {
                throw new TypeError(`"WriteFilter" must be a function: ${writeFilter}`);
            }
            this.writeFilter = writeFilter;
        }

        const settings = Object.assign({}, ...options, defaultSettings);

        Object.defineProperties(this, {
            settings: {
                enumerable: true,
                value: settings,
                writeable: false
            }
        });
    }
    get ident() {
        return toIdent(this.settings);
    }
    get isOpen() {
        return this.port && this.port.isOpen;
    }
    get isClose() {
        return !this.isOpen;
    }

    // @param {function} callback The error-first callback.
    open(callback) {
        if (this.port) {
            const err = new Error(`Cannot open serial port "${this.settings.port}"`);
            callback(err);
            return;
        }

        const { port } = this.settings;

        this.port = new SerialPort(port, {
            autoOpen: false,
            baudRate: 115200
        });

        this.port.on('open', this.eventListener.open);
        this.port.on('close', this.eventListener.close);
        this.port.on('error', this.eventListener.error);

        this.parser = this.port.pipe(new Readline({ delimiter: '\n' }));
        this.parser.on('data', this.eventListener.data);

        this.port.open(callback);
    }
    // @param {function} callback The error-first callback.
    close(callback) {
        if (!this.port) {
            const err = new Error(`Cannot close serial port "${this.settings.port}"`);
            callback && callback(err);
            return;
        }

        this.port.removeListener('open', this.eventListener.open);
        this.port.removeListener('close', this.eventListener.close);
        this.port.removeListener('error', this.eventListener.error);
        this.port.removeListener('data', this.eventListener.data);

        this.port.close(callback);
        this.port = null;
        this.parser = null;
    }
    write(data, context) {
        if (!this.port) {
            return;
        }
        data = this.writeFilter(data, context);

        this.port.write(data);
    }
}

export { toIdent };
export default SerialConnection;

