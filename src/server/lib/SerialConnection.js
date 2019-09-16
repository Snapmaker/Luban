import { EventEmitter } from 'events';
import SerialPort from 'serialport';
import { Transform } from 'stream';
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

function verifyCheckSum(checkSum, data) {
    let sum = 0;
    const length = data.length;
    for (let i = 0; i < length - 1; i += 2) {
        sum += ((data[i] & 0xff) << 8) + (data[i + 1] & 0xff);
    }
    if ((data.length & 1) > 0) {
        sum += (data[length - 1] & 0xff);
    }
    while (sum > 0xffff) {
        sum = ((sum >> 16) & 0xffff) + (sum & 0xffff);
    }
    return ((~sum) & 0xffff) === checkSum;
}

class DelimiterParser extends Transform {
    constructor() {
        super();
        this.encoding = 'utf-8';
        this.buffer = Buffer.alloc(0);
    }

    _transform(chunk, encoding, cb) {
        // meta length
        const offset = 8;
        let data = Buffer.concat([this.buffer, chunk]);
        // console.log('new protocol transform raw dataaaaaaaaaaaaa=======================', data);
        while (data.length > 0) {
            // TODO meta data might be cut into two chunks
            if (data[0] !== 0xaa) {
                data = data.slice(1);
                continue;
            } else {
                if (data.length === 1) {
                    this.buffer = data;
                    data = data.slice(1);
                    continue;
                } else if (data[1] !== 0x55) {
                    data = data.slice(2);
                    continue;
                }
            }
            if (data.length <= 9) {
                this.buffer = data;
                break;
            }
            const contentLength = (data[2] << 8) + data[3];
            const checkSum = (data[6] << 8) + data[7];
            if (data.length < contentLength + offset) {
                this.buffer = data;
                break;
            }
            const dataBuffer = data.slice(offset, contentLength + offset);
            const tailBuffer = data.slice(contentLength + offset);
            if (verifyCheckSum(checkSum, dataBuffer)) {
                this.push(dataBuffer);
                if (tailBuffer) {
                    this.buffer = tailBuffer;
                } else {
                    this.buffer = Buffer.alloc(0);
                }
            }
            data = data.slice(contentLength + offset);
        }

        cb();
    }

    _flush(cb) {
        this.push(this.buffer);
        this.buffer = Buffer.alloc(0);
        cb();
    }
}

class SerialConnection extends EventEmitter {
    constructor(options) {
        super();
        const { writeFilter } = { ...options };
        this.type = 'serial';
        this.port = null; // Serialport
        this.parser = null; // Readline parser
        // this.parser2 = null; // Readline parser
        this.writeFilter = (data) => data;
        this.newProtocolEnabled = options.newProtocolEnabled;
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
        this.eventListener = {
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
    }

    get ident() {
        return toIdent(this.settings);
    }

    get isOpen() {
        return this.port && this.port.isOpen;
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
        /*
        if (this.newProtocolEnabled) {
            this.parser = this.port.pipe(new DelimiterParser());
        } else {
            this.parser = this.port.pipe(new Readline({ delimiter: '\n' }));
        }
        this.parser.on('data', this.eventListener.data);
        */
        this.parser = this.port.pipe(new DelimiterParser());
        this.parser.on('data', this.eventListener.data);
        this.parser2 = this.port.pipe(new Readline({ delimiter: '\n' }));
        this.parser2.on('data', this.eventListener.data);
        this.port.on('open', this.eventListener.open);
        this.port.on('close', this.eventListener.close);
        this.port.on('error', this.eventListener.error);

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

        console.log('final output data >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', data);
        this.port.write(data, 'utf-8');
    }
}

export { toIdent };
export default SerialConnection;
