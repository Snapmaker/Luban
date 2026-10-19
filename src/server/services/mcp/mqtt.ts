import { EventEmitter } from 'events';
import net from 'net';
import tls from 'tls';

// Minimal MQTT 3.1.1 client over the Node built-ins - hand-rolled for the
// same reason as the MCP transport itself: Electron 15 embeds Node 16 and
// the tree takes no new dependencies. Only what the probe feed needs is
// implemented: CONNECT/CONNACK, SUBSCRIBE (QoS 0/1), incoming PUBLISH with
// PUBACK for QoS 1, outgoing PUBLISH at QoS 0, and keepalive pings.

const PACKET = {
    CONNECT: 1,
    CONNACK: 2,
    PUBLISH: 3,
    PUBACK: 4,
    SUBSCRIBE: 8,
    SUBACK: 9,
    PINGREQ: 12,
    PINGRESP: 13,
    DISCONNECT: 14,
};

const KEEPALIVE_SECONDS = 60;
const CONNECT_TIMEOUT_MS = 15000;

const CONNACK_ERRORS: { [code: number]: string } = {
    1: 'unacceptable protocol version',
    2: 'identifier rejected',
    3: 'server unavailable',
    4: 'bad user name or password',
    5: 'not authorized',
};

function encodeString(text: string): Buffer {
    const body = Buffer.from(text, 'utf8');
    const length = Buffer.alloc(2);
    length.writeUInt16BE(body.length, 0);
    return Buffer.concat([length, body]);
}

function encodeRemainingLength(length: number): Buffer {
    const bytes: number[] = [];
    let remaining = length;
    do {
        let digit = remaining % 128;
        remaining = Math.floor(remaining / 128);
        if (remaining > 0) {
            digit |= 0x80;
        }
        bytes.push(digit);
    } while (remaining > 0);
    return Buffer.from(bytes);
}

function packet(typeAndFlags: number, body: Buffer): Buffer {
    return Buffer.concat([Buffer.from([typeAndFlags]), encodeRemainingLength(body.length), body]);
}

export interface MqttClientOptions {
    host: string;
    port: number;
    tls: boolean;
    clientId: string;
    username?: string;
    password?: string;
}

/**
 * Events: 'connect' (CONNACK accepted), 'message' (topic, payload string),
 * 'error' (Error), 'close'. The owner is responsible for reconnecting; a
 * closed client is not reusable.
 */
export class MqttClient extends EventEmitter {
    private options: MqttClientOptions;

    private socket: net.Socket | null = null;

    private buffer: Buffer = Buffer.alloc(0);

    private pingTimer: NodeJS.Timeout | null = null;

    private connectTimer: NodeJS.Timeout | null = null;

    private nextPacketId = 1;

    private ended = false;

    public connected = false;

    public constructor(options: MqttClientOptions) {
        super();
        this.options = options;
    }

    public connect(): void {
        const onSocketUp = () => this.sendConnect();
        this.socket = this.options.tls
            ? tls.connect({ host: this.options.host, port: this.options.port, servername: this.options.host }, onSocketUp)
            : net.connect({ host: this.options.host, port: this.options.port }, onSocketUp);
        this.socket.on('data', (chunk: Buffer) => this.onData(chunk));
        this.socket.on('error', (err: Error) => this.fail(err));
        this.socket.on('close', () => this.onClose());
        this.connectTimer = setTimeout(() => {
            this.fail(new Error(`Timed out connecting to ${this.options.host}:${this.options.port}`));
        }, CONNECT_TIMEOUT_MS);
    }

    /** Subscribe at QoS 1 so brokers redeliver a reading lost in transit. */
    public subscribe(topics: string[]): void {
        if (!topics.length) {
            return;
        }
        const id = this.claimPacketId();
        const idBuffer = Buffer.alloc(2);
        idBuffer.writeUInt16BE(id, 0);
        const body = Buffer.concat([
            idBuffer,
            ...topics.map((topic) => Buffer.concat([encodeString(topic), Buffer.from([1])])),
        ]);
        this.write(packet((PACKET.SUBSCRIBE << 4) | 0x02, body));
    }

    /** Fire-and-forget publish at QoS 0 (used to prime Adafruit IO /get). */
    public publish(topic: string, payload: string): void {
        const body = Buffer.concat([encodeString(topic), Buffer.from(payload, 'utf8')]);
        this.write(packet(PACKET.PUBLISH << 4, body));
    }

    public end(): void {
        this.ended = true;
        if (this.socket && this.connected) {
            try {
                this.write(packet(PACKET.DISCONNECT << 4, Buffer.alloc(0)));
            } catch (err) {
                // Socket already dying; close handles the rest.
            }
        }
        this.teardown();
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }

    private claimPacketId(): number {
        const id = this.nextPacketId;
        this.nextPacketId = (this.nextPacketId % 65535) + 1;
        return id;
    }

    private sendConnect(): void {
        const flags = 0x02 // clean session
            | (this.options.username ? 0x80 : 0)
            | (this.options.password ? 0x40 : 0);
        const head = Buffer.concat([
            encodeString('MQTT'),
            Buffer.from([4, flags]), // protocol level 4 = MQTT 3.1.1
            Buffer.from([(KEEPALIVE_SECONDS >> 8) & 0xff, KEEPALIVE_SECONDS & 0xff]),
        ]);
        const payload = Buffer.concat([
            encodeString(this.options.clientId),
            this.options.username ? encodeString(this.options.username) : Buffer.alloc(0),
            this.options.password ? encodeString(this.options.password) : Buffer.alloc(0),
        ]);
        this.write(packet(PACKET.CONNECT << 4, Buffer.concat([head, payload])));
    }

    private write(data: Buffer): void {
        if (this.socket && !this.socket.destroyed) {
            this.socket.write(data);
        }
    }

    private fail(err: Error): void {
        if (this.ended) {
            return;
        }
        this.emit('error', err);
        this.end();
        this.emit('close');
    }

    private onClose(): void {
        const wasEnded = this.ended;
        this.teardown();
        if (!wasEnded) {
            this.ended = true;
            this.emit('close');
        }
    }

    private teardown(): void {
        this.connected = false;
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.connectTimer) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
        }
    }

    private onData(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        // Parse complete packets: fixed header byte, varint remaining length,
        // then the body. Partial packets stay buffered for the next chunk.
        for (;;) {
            if (this.buffer.length < 2) {
                return;
            }
            let remaining = 0;
            let multiplier = 1;
            let offset = 1;
            for (;;) {
                if (offset >= this.buffer.length) {
                    return; // length varint incomplete
                }
                const digit = this.buffer[offset];
                remaining += (digit & 0x7f) * multiplier;
                multiplier *= 128;
                offset += 1;
                if ((digit & 0x80) === 0) {
                    break;
                }
                if (offset > 5) {
                    this.fail(new Error('Malformed MQTT remaining-length'));
                    return;
                }
            }
            if (this.buffer.length < offset + remaining) {
                return;
            }
            const flags = this.buffer[0] & 0x0f;
            const type = this.buffer[0] >> 4;
            const body = this.buffer.slice(offset, offset + remaining);
            this.buffer = this.buffer.slice(offset + remaining);
            this.onPacket(type, flags, body);
        }
    }

    private onPacket(type: number, flags: number, body: Buffer): void {
        if (type === PACKET.CONNACK) {
            const code = body.length >= 2 ? body[1] : 255;
            if (code !== 0) {
                this.fail(new Error(`MQTT connection refused: ${CONNACK_ERRORS[code] || `code ${code}`}`));
                return;
            }
            this.connected = true;
            if (this.connectTimer) {
                clearTimeout(this.connectTimer);
                this.connectTimer = null;
            }
            this.pingTimer = setInterval(() => {
                this.write(packet(PACKET.PINGREQ << 4, Buffer.alloc(0)));
            }, (KEEPALIVE_SECONDS * 1000) / 2);
            this.emit('connect');
            return;
        }
        if (type === PACKET.PUBLISH) {
            if (body.length < 2) {
                return;
            }
            const topicLength = body.readUInt16BE(0);
            let cursor = 2 + topicLength;
            if (body.length < cursor) {
                return;
            }
            const topic = body.slice(2, cursor).toString('utf8');
            const qos = (flags >> 1) & 0x03;
            if (qos > 0) {
                if (body.length < cursor + 2) {
                    return;
                }
                const packetId = body.slice(cursor, cursor + 2);
                cursor += 2;
                this.write(packet(PACKET.PUBACK << 4, packetId));
            }
            this.emit('message', topic, body.slice(cursor).toString('utf8'));
        }
        // SUBACK/PUBACK-in/PINGRESP need no action beyond keeping the
        // connection alive; unknown packet types are ignored.
    }
}
